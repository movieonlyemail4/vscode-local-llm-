import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ChildProcess, spawn, execSync } from 'child_process';
import * as vscode from 'vscode';
import { LocalModel } from './localModelScanner';

export interface ServerInfo {
  url: string;
  apiType: 'ollama' | 'openai-compatible';
  model: string;
}

const LLAMA_SERVER_CANDIDATES = [
  'llama-server',
  path.join(os.homedir(), 'llama.cpp', 'llama-server'),
  path.join(os.homedir(), 'llama.cpp', 'build', 'bin', 'llama-server'),
  '/usr/local/bin/llama-server',
  '/usr/bin/llama-server',
  '/opt/homebrew/bin/llama-server',
];

// Minimal OpenAI-compatible server for HuggingFace / SafeTensors / PyTorch models
const HF_SERVER_SCRIPT = `
import sys, json, uuid, argparse, traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread

parser = argparse.ArgumentParser()
parser.add_argument('--model', required=True)
parser.add_argument('--port', type=int, default=8766)
args = parser.parse_args()

print(f"[hf-server] Loading {args.model} ...", flush=True)

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer

device = "cuda" if torch.cuda.is_available() else "cpu"
dtype  = torch.float16 if device == "cuda" else torch.float32

tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
model     = AutoModelForCausalLM.from_pretrained(
    args.model, torch_dtype=dtype, device_map="auto", trust_remote_code=True
)
model.eval()
print(f"[hf-server] Ready on port {args.port} (device={device})", flush=True)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok"})
        elif self.path == "/v1/models":
            self._json(200, {"object": "list", "data": [{"id": args.model, "object": "model"}]})
        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        if self.path != "/v1/chat/completions":
            self.send_response(404); self.end_headers(); return
        try:
            length  = int(self.headers["Content-Length"])
            body    = json.loads(self.rfile.read(length))
            messages    = body.get("messages", [])
            stream      = body.get("stream", False)
            max_tokens  = body.get("max_tokens", 512)
            temperature = float(body.get("temperature", 0.7))

            if hasattr(tokenizer, "apply_chat_template"):
                prompt = tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )
            else:
                prompt = "\\n".join(f"{m['role']}: {m['content']}" for m in messages) + "\\nassistant:"

            inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
            do_sample = temperature > 0

            if stream:
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()

                streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
                gen_kwargs = dict(**inputs, streamer=streamer,
                                  max_new_tokens=max_tokens,
                                  temperature=temperature if do_sample else 1.0,
                                  do_sample=do_sample)
                t = Thread(target=lambda: model.generate(**gen_kwargs))
                t.start()

                cid = f"chatcmpl-{uuid.uuid4().hex[:8]}"
                for token in streamer:
                    chunk = {"id": cid, "object": "chat.completion.chunk",
                             "choices": [{"delta": {"content": token}, "index": 0, "finish_reason": None}]}
                    self.wfile.write(f"data: {json.dumps(chunk)}\\n\\n".encode())
                    self.wfile.flush()
                self.wfile.write(b"data: [DONE]\\n\\n")
                t.join()
            else:
                with torch.no_grad():
                    out = model.generate(**inputs, max_new_tokens=max_tokens,
                                        temperature=temperature if do_sample else 1.0,
                                        do_sample=do_sample)
                text = tokenizer.decode(out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
                self._json(200, {
                    "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
                    "object": "chat.completion",
                    "choices": [{"message": {"role": "assistant", "content": text},
                                 "finish_reason": "stop", "index": 0}]
                })
        except Exception:
            traceback.print_exc(file=sys.stderr)
            self.send_response(500); self.end_headers()

HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
`;

export class ServerManager {
  private _process: ChildProcess | null = null;
  private _serverInfo: ServerInfo | null = null;
  private _outputChannel: vscode.OutputChannel;
  private _hfScriptPath: string;

  constructor() {
    this._outputChannel = vscode.window.createOutputChannel('Local LLM Server');
    this._hfScriptPath = path.join(os.tmpdir(), 'local_llm_hf_server.py');
  }

  get serverInfo(): ServerInfo | null { return this._serverInfo; }

  async isOllamaRunning(): Promise<boolean> {
    return this._pingHttp('http://localhost:11434/api/tags');
  }

  findLlamaServer(): string | null {
    try {
      const cmd = process.platform === 'win32' ? 'where llama-server' : 'which llama-server';
      const r = execSync(cmd, { encoding: 'utf8', timeout: 2000 }).trim();
      if (r) return r;
    } catch {}
    for (const p of LLAMA_SERVER_CANDIDATES) {
      try { if (fs.existsSync(p)) return p; } catch {}
    }
    return null;
  }

  async startForModel(model: LocalModel): Promise<ServerInfo> {
    if (model.type === 'ollama')       return this._startOllama(model.name);
    if (model.type === 'gguf')         return this._startLlamaServer(model);
    if (model.type === 'huggingface')  return this._startHuggingFaceServer(model);
    throw new Error(`Unsupported model type: ${model.type}`);
  }

  // ── Ollama ──────────────────────────────────────────────────────────────

  private async _startOllama(modelName: string): Promise<ServerInfo> {
    if (!await this.isOllamaRunning()) {
      this._outputChannel.appendLine('[Local LLM] Starting Ollama...');
      this._outputChannel.show(true);
      this._process = spawn('ollama', ['serve'], { stdio: ['ignore', 'pipe', 'pipe'] });
      this._process.stdout?.on('data', (d: Buffer) => this._outputChannel.append(d.toString()));
      this._process.stderr?.on('data', (d: Buffer) => this._outputChannel.append(d.toString()));
      await this._waitForHttp('http://localhost:11434/api/tags', 20000);
    }
    this._serverInfo = { url: 'http://localhost:11434', apiType: 'ollama', model: modelName };
    return this._serverInfo;
  }

  // ── llama-server (GGUF) ─────────────────────────────────────────────────

  private async _startLlamaServer(model: LocalModel): Promise<ServerInfo> {
    const bin = this.findLlamaServer();
    if (!bin) throw new Error(
      'llama-server not found. Build llama.cpp and add it to PATH, or use an Ollama model.'
    );

    const port = 8765;
    this._killProcess();
    this._outputChannel.appendLine(`[Local LLM] Starting llama-server: ${model.name}`);
    this._outputChannel.show(true);

    this._process = spawn(bin, ['-m', model.path!, '--port', String(port), '--host', '127.0.0.1', '-c', '4096'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    this._process.stdout?.on('data', (d: Buffer) => this._outputChannel.append(d.toString()));
    this._process.stderr?.on('data', (d: Buffer) => this._outputChannel.append(d.toString()));
    this._process.on('error', err => this._outputChannel.appendLine(`[Local LLM] Error: ${err.message}`));

    await this._waitForHttp(`http://127.0.0.1:${port}/health`, 60000);
    this._serverInfo = { url: `http://127.0.0.1:${port}`, apiType: 'openai-compatible', model: model.name };
    return this._serverInfo;
  }

  // ── HuggingFace / SafeTensors / PyTorch ────────────────────────────────

  private async _startHuggingFaceServer(model: LocalModel): Promise<ServerInfo> {
    const python = await this._findPython();
    if (!python) throw new Error('Python 3 not found. Install Python to run HuggingFace models.');

    await this._ensurePythonDeps(python);

    const port = 8766;
    this._killProcess();

    fs.writeFileSync(this._hfScriptPath, HF_SERVER_SCRIPT, 'utf8');

    this._outputChannel.appendLine(`[Local LLM] Starting HuggingFace server: ${model.name}`);
    this._outputChannel.appendLine(`[Local LLM] Format: ${model.format} | Path: ${model.path}`);
    this._outputChannel.show(true);

    this._process = spawn(python, [this._hfScriptPath, '--model', model.path!, '--port', String(port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    this._process.stdout?.on('data', (d: Buffer) => this._outputChannel.append(d.toString()));
    this._process.stderr?.on('data', (d: Buffer) => this._outputChannel.append(d.toString()));
    this._process.on('error', err => this._outputChannel.appendLine(`[Local LLM] Error: ${err.message}`));

    // HuggingFace models can take a while to load
    await this._waitForHttp(`http://127.0.0.1:${port}/health`, 120000);
    this._serverInfo = { url: `http://127.0.0.1:${port}`, apiType: 'openai-compatible', model: model.name };
    return this._serverInfo;
  }

  private async _findPython(): Promise<string | null> {
    for (const cmd of ['python3', 'python']) {
      try {
        const v = execSync(`${cmd} --version`, { encoding: 'utf8', timeout: 2000 });
        if (v.includes('3.')) return cmd;
      } catch {}
    }
    return null;
  }

  private async _ensurePythonDeps(python: string): Promise<void> {
    const missing: string[] = [];
    for (const pkg of ['torch', 'transformers']) {
      try {
        execSync(`${python} -c "import ${pkg}"`, { timeout: 5000, stdio: 'ignore' });
      } catch {
        missing.push(pkg);
      }
    }
    if (missing.length === 0) return;

    const answer = await vscode.window.showInformationMessage(
      `To run HuggingFace models, these Python packages are needed: ${missing.join(', ')}. Install now?`,
      'Install', 'Cancel'
    );
    if (answer !== 'Install') throw new Error('Required Python packages not installed.');

    this._outputChannel.appendLine(`[Local LLM] Installing: ${missing.join(' ')} ...`);
    this._outputChannel.show(true);

    await new Promise<void>((resolve, reject) => {
      const args = ['-m', 'pip', 'install', '--quiet'];
      // torch with CUDA if nvidia-smi is available
      if (missing.includes('torch')) {
        try {
          execSync('nvidia-smi', { stdio: 'ignore' });
          args.push('torch', '--index-url', 'https://download.pytorch.org/whl/cu121');
        } catch {
          args.push('torch');
        }
        args.push('transformers', 'accelerate');
      } else {
        args.push(...missing);
      }

      const proc = spawn(python, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stdout?.on('data', (d: Buffer) => this._outputChannel.append(d.toString()));
      proc.stderr?.on('data', (d: Buffer) => this._outputChannel.append(d.toString()));
      proc.on('close', code => code === 0 ? resolve() : reject(new Error('pip install failed')));
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private _killProcess() {
    if (this._process) {
      this._process.kill();
      this._process = null;
      this._serverInfo = null;
    }
  }

  private _pingHttp(url: string): Promise<boolean> {
    return new Promise(resolve => {
      const req = http.get(url, res => { res.resume(); resolve((res.statusCode ?? 0) < 500); });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
  }

  private _waitForHttp(url: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const attempt = () => {
        this._pingHttp(url).then(ok => {
          if (ok) return resolve();
          if (Date.now() - start > timeoutMs)
            return reject(new Error(`Server did not become ready within ${timeoutMs / 1000}s`));
          setTimeout(attempt, 800);
        });
      };
      attempt();
    });
  }

  stopServer(): void {
    this._killProcess();
    this._outputChannel.appendLine('[Local LLM] Server stopped.');
  }

  dispose(): void {
    this.stopServer();
    this._outputChannel.dispose();
    try { fs.unlinkSync(this._hfScriptPath); } catch {}
  }
}
