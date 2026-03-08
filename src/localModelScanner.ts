import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

export type ModelType = 'ollama' | 'gguf' | 'huggingface';

export interface LocalModel {
  name: string;
  path?: string;
  type: ModelType;
  format?: string;   // e.g. 'safetensors', 'pytorch', 'gguf'
  size?: number;
}

const DEFAULT_SCAN_DIRS: string[] = [
  path.join(os.homedir(), 'models'),
  path.join(os.homedir(), 'Models'),
  path.join(os.homedir(), '.cache', 'huggingface', 'hub'),
  path.join(os.homedir(), '.cache', 'lm-studio', 'models'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'llama.cpp', 'models'),
  path.join(os.homedir(), '.local', 'share', 'nomic.ai', 'gpt4all'),
  path.join(os.homedir(), 'AppData', 'Local', 'nomic.ai', 'GPT4All'),
];

// ── Ollama ──────────────────────────────────────────────────────────────────

export function isOllamaInstalled(): boolean {
  try {
    execSync('ollama --version', { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export function listOllamaModels(): LocalModel[] {
  try {
    const output = execSync('ollama list', { encoding: 'utf8', timeout: 5000 });
    return output.split('\n').slice(1)
      .filter(l => l.trim())
      .map(l => ({ name: l.trim().split(/\s+/)[0], type: 'ollama' as ModelType }))
      .filter(m => m.name);
  } catch {
    return [];
  }
}

// ── GGUF ────────────────────────────────────────────────────────────────────

function walkFiles(dir: string, depth = 0): string[] {
  if (depth > 4) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile()) {
        results.push(full);
      } else if (e.isDirectory() && !e.name.startsWith('.')) {
        results.push(...walkFiles(full, depth + 1));
      }
    }
    return results;
  } catch {
    return [];
  }
}

function walkDirs(dir: string, depth = 0): string[] {
  if (depth > 4) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.')) {
        const full = path.join(dir, e.name);
        results.push(full);
        results.push(...walkDirs(full, depth + 1));
      }
    }
    return results;
  } catch {
    return [];
  }
}

export function scanForGgufModels(extraDirs: string[] = []): LocalModel[] {
  const seen = new Set<string>();
  const models: LocalModel[] = [];

  for (const dir of [...DEFAULT_SCAN_DIRS, ...extraDirs]) {
    for (const filePath of walkFiles(dir)) {
      if (!filePath.toLowerCase().endsWith('.gguf')) continue;
      if (seen.has(filePath)) continue;
      seen.add(filePath);
      try {
        const stats = fs.statSync(filePath);
        models.push({
          name: path.basename(filePath, '.gguf'),
          path: filePath,
          type: 'gguf',
          format: 'gguf',
          size: stats.size
        });
      } catch {}
    }
  }
  return models;
}

// ── HuggingFace model folders ────────────────────────────────────────────────

const HF_WEIGHT_EXTENSIONS = ['.safetensors', '.bin', '.pt', '.pth'];

function detectHuggingFaceFormat(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir).map(f => f.toLowerCase());
    if (!files.includes('config.json')) return null;
    if (files.some(f => f.endsWith('.safetensors'))) return 'safetensors';
    if (files.some(f => f.endsWith('.bin')))          return 'pytorch';
    if (files.some(f => f.endsWith('.onnx')))         return 'onnx';
    return null;
  } catch {
    return null;
  }
}

function modelNameFromDir(dir: string): string {
  // Try reading model name from config.json
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    if (cfg._name_or_path) return path.basename(cfg._name_or_path);
  } catch {}
  return path.basename(dir);
}

function folderSizeEstimate(dir: string): number {
  try {
    return fs.readdirSync(dir)
      .filter(f => HF_WEIGHT_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext)))
      .reduce((sum, f) => {
        try { return sum + fs.statSync(path.join(dir, f)).size; } catch { return sum; }
      }, 0);
  } catch {
    return 0;
  }
}

export function scanForHuggingFaceModels(extraDirs: string[] = []): LocalModel[] {
  const seen = new Set<string>();
  const models: LocalModel[] = [];

  for (const base of [...DEFAULT_SCAN_DIRS, ...extraDirs]) {
    for (const dir of [base, ...walkDirs(base)]) {
      if (seen.has(dir)) continue;
      const fmt = detectHuggingFaceFormat(dir);
      if (!fmt) continue;
      seen.add(dir);
      models.push({
        name: modelNameFromDir(dir),
        path: dir,
        type: 'huggingface',
        format: fmt,
        size: folderSizeEstimate(dir)
      });
    }
  }
  return models;
}

// ── Combined discovery ───────────────────────────────────────────────────────

export function discoverAllModels(extraDirs: string[] = []): LocalModel[] {
  const models: LocalModel[] = [];
  if (isOllamaInstalled()) models.push(...listOllamaModels());
  models.push(...scanForGgufModels(extraDirs));
  models.push(...scanForHuggingFaceModels(extraDirs));
  return models;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}
