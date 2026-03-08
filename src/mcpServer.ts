import * as http from 'http';
import * as vscode from 'vscode';
import { LLMClient, ChatMessage } from './llmClient';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string };
}

const MCP_TOOLS = [
  {
    name: 'chat',
    description: 'Send a conversation to the local LLM and get a response.',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role:    { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' }
            },
            required: ['role', 'content']
          },
          description: 'Conversation history'
        },
        system: {
          type: 'string',
          description: 'Optional system prompt (overrides extension default)'
        }
      },
      required: ['messages']
    }
  },
  {
    name: 'explain_code',
    description: 'Ask the local LLM to explain what a piece of code does.',
    inputSchema: {
      type: 'object',
      properties: {
        code:     { type: 'string', description: 'Source code to explain' },
        language: { type: 'string', description: 'Programming language (optional)' }
      },
      required: ['code']
    }
  },
  {
    name: 'refactor_code',
    description: 'Ask the local LLM to suggest refactoring improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        code:     { type: 'string', description: 'Source code to refactor' },
        language: { type: 'string', description: 'Programming language (optional)' }
      },
      required: ['code']
    }
  },
  {
    name: 'complete',
    description: 'Complete an arbitrary prompt with the local LLM.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt text to complete' }
      },
      required: ['prompt']
    }
  }
];

export class MCPServer {
  private _server: http.Server | null = null;
  private _port: number;
  private _llmClient: LLMClient;
  private _modelName: string = '(no model selected)';
  private _outputChannel: vscode.OutputChannel;

  constructor(llmClient: LLMClient, port: number) {
    this._llmClient = llmClient;
    this._port = port;
    this._outputChannel = vscode.window.createOutputChannel('Local LLM MCP');
  }

  get port() { return this._port; }

  updateClient(client: LLMClient, modelName: string) {
    this._llmClient = client;
    this._modelName = modelName;
  }

  start(): void {
    this._server = http.createServer((req, res) => this._handleRequest(req, res));
    this._server.listen(this._port, '127.0.0.1', () => {
      this._outputChannel.appendLine(`[MCP] Server ready → http://127.0.0.1:${this._port}/mcp`);
    });
    this._server.on('error', err => {
      this._outputChannel.appendLine(`[MCP] Server error: ${err.message}`);
    });
  }

  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // CORS — allow MCP clients running in browsers or Electron apps
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Health / discovery endpoint
    if (req.method === 'GET' && req.url === '/') {
      this._json(res, 200, {
        name: 'local-llm-connect',
        version: '2.0.0',
        description: 'Local LLM MCP server — VS Code extension',
        mcpEndpoint: `http://127.0.0.1:${this._port}/mcp`,
        currentModel: this._modelName
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const rpc: JsonRpcRequest = JSON.parse(body);
          // Notifications have no id — do not respond
          if (rpc.id === undefined && rpc.method.startsWith('notifications/')) {
            res.writeHead(204); res.end(); return;
          }
          const response = await this._dispatch(rpc);
          this._json(res, 200, response);
        } catch {
          this._json(res, 400, {
            jsonrpc: '2.0', id: null,
            error: { code: -32700, message: 'Parse error' }
          });
        }
      });
      return;
    }

    res.writeHead(404); res.end();
  }

  private async _dispatch(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const id = req.id ?? null;
    const ok  = (result: any): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });
    const err = (code: number, message: string): JsonRpcResponse =>
      ({ jsonrpc: '2.0', id, error: { code, message } });

    switch (req.method) {
      case 'initialize':
        return ok({
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'local-llm-connect', version: '2.0.0' }
        });

      case 'ping':
        return ok({});

      case 'tools/list':
        return ok({ tools: MCP_TOOLS });

      case 'tools/call': {
        const { name, arguments: args } = req.params ?? {};
        if (!name) return err(-32602, 'Missing tool name');
        return this._callTool(id, name, args ?? {});
      }

      default:
        return err(-32601, `Method not found: ${req.method}`);
    }
  }

  private async _callTool(
    id: string | number | null,
    name: string,
    args: Record<string, any>
  ): Promise<JsonRpcResponse> {
    let messages: ChatMessage[];

    switch (name) {
      case 'chat':
        messages = args.system
          ? [{ role: 'system', content: args.system }, ...args.messages]
          : args.messages;
        break;

      case 'explain_code':
        messages = [{
          role: 'user',
          content: `Explain what the following ${args.language ?? ''} code does, step by step:\n\`\`\`${args.language ?? ''}\n${args.code}\n\`\`\``
        }];
        break;

      case 'refactor_code':
        messages = [{
          role: 'user',
          content: `Refactor the following ${args.language ?? ''} code for readability and performance. Show improved code with explanation:\n\`\`\`${args.language ?? ''}\n${args.code}\n\`\`\``
        }];
        break;

      case 'complete':
        messages = [{ role: 'user', content: args.prompt }];
        break;

      default:
        return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${name}` } };
    }

    try {
      const text = await this._infer(messages);
      this._outputChannel.appendLine(`[MCP] tool=${name} → ${text.length} chars`);
      return {
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text }],
          isError: false
        }
      };
    } catch (e) {
      const msg = (e as Error).message;
      this._outputChannel.appendLine(`[MCP] tool=${name} error: ${msg}`);
      return {
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
      };
    }
  }

  private _infer(messages: ChatMessage[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let full = '';
      this._llmClient.chat(messages, {
        onToken:    t  => { full += t; },
        onComplete: () => resolve(full),
        onError:    e  => reject(e)
      });
    });
  }

  private _json(res: http.ServerResponse, code: number, body: any) {
    const data = JSON.stringify(body);
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(data);
  }

  /** Returns a ready-to-paste Claude Desktop config snippet */
  claudeDesktopConfig(): string {
    const bridgePath = `http://127.0.0.1:${this._port}/mcp`;
    return JSON.stringify({
      mcpServers: {
        'local-llm': {
          url: bridgePath,
          transport: 'http'
        }
      }
    }, null, 2);
  }

  stop(): void {
    this._server?.close();
    this._server = null;
  }

  dispose(): void {
    this.stop();
    this._outputChannel.dispose();
  }
}
