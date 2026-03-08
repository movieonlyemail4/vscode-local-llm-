# 🤖 Local LLM Connect

**Run local AI models directly in VS Code — no cloud, no API keys, no manual server setup.**

The extension scans your machine for models, starts the inference server automatically, and exposes a built-in MCP endpoint so any AI client (Claude Desktop, Cursor, Continue.dev) can use your local model too.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔍 **Auto model discovery** | Scans common folders for GGUF, SafeTensors, PyTorch, and Ollama models |
| ⚡ **Auto server start** | Starts `llama-server` or `ollama serve` automatically — no terminal needed |
| 🌐 **MCP server** | Built-in MCP endpoint at `http://127.0.0.1:3333/mcp` for any MCP client |
| 💬 **Chat panel** | Full streaming chat with your local model |
| 🔧 **Code tools** | Explain, refactor, and ask about selected code |
| 📁 **Add any folder** | Browse to any folder to add more models on the fly |
| 🔌 **Format support** | GGUF · SafeTensors · PyTorch · Ollama |

---

## 📦 Supported Model Formats

| Format | Runtime needed | Where to get models |
|--------|---------------|---------------------|
| **GGUF** | [llama.cpp](https://github.com/ggml-org/llama.cpp) (`llama-server` in PATH) | [HuggingFace](https://huggingface.co/models?library=gguf) — search any model + GGUF |
| **SafeTensors / PyTorch** | Python + `transformers` (auto-installed) | [HuggingFace](https://huggingface.co/models) — any standard model |
| **Ollama** | [Ollama](https://ollama.com) | `ollama pull llama3` |

### Auto-scanned directories

The extension looks for models in these locations automatically:

```
~/models             ~/Models             ~/Downloads
~/Documents          ~/.cache/huggingface/hub
~/.cache/lm-studio/models
~/llama.cpp/models   ~/.local/share/nomic.ai/gpt4all
```

Plus any custom paths you add via the **"+ Add folder..."** option or settings.

---

## 🚀 Quick Start

### 1. Prerequisites

Pick **one** of the following (or both):

**Option A — GGUF models (fastest)**
```bash
# Build llama.cpp (or download a release binary)
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target llama-server -j$(nproc)
sudo cp build/bin/llama-server /usr/local/bin/

# Download any GGUF model to ~/models/
# e.g. from https://huggingface.co/models?library=gguf
```

**Option B — Ollama models (easiest)**
```bash
# Install from https://ollama.com, then:
ollama pull llama3          # or any model
```

### 2. Install the Extension

**From VS Code Marketplace** *(coming soon)*
- Search for `Local LLM Connect` in the Extensions panel

**From VSIX**
```bash
# Download the latest .vsix from GitHub Releases, then:
code --install-extension local-llm-connect-2.0.0.vsix
```

**From source**
```bash
git clone https://github.com/YOUR_USERNAME/local-llm-connect
cd local-llm-connect
npm install
npm run compile
# Press F5 in VS Code to run, or package with vsce
```

### 3. Use It

1. Open VS Code — look for `⊙ Select Model` in the bottom-right status bar
2. Press **Ctrl+Shift+M** to scan and pick a model
3. The server starts automatically
4. Press **Ctrl+Shift+L** to open the chat panel

---

## 🔌 MCP Integration

The extension starts an **MCP server** automatically on `http://127.0.0.1:3333/mcp`.

Run `Ctrl+Shift+P` → **Local LLM: Show MCP Connection Info** for a full guide. Quick configs:

### Claude Desktop
Edit `~/.config/claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "local-llm": {
      "url": "http://127.0.0.1:3333/mcp",
      "transport": "http"
    }
  }
}
```

### Cursor / Windsurf / Continue.dev
```json
{
  "mcpServers": {
    "local-llm": {
      "url": "http://127.0.0.1:3333/mcp",
      "transport": "http"
    }
  }
}
```

### Test with curl
```bash
curl -X POST http://127.0.0.1:3333/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0", "id": 1, "method": "tools/call",
    "params": {
      "name": "chat",
      "arguments": {
        "messages": [{"role": "user", "content": "Hello! What can you do?"}]
      }
    }
  }'
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `chat` | Full conversation with message history |
| `explain_code` | Explain a code snippet |
| `refactor_code` | Suggest code improvements |
| `complete` | Complete any text prompt |

---

## ⌨️ Commands & Shortcuts

| Command | Shortcut | Description |
|---------|----------|-------------|
| Local LLM: Select Model | `Ctrl+Shift+M` | Scan machine and pick a model |
| Local LLM: Open Chat | `Ctrl+Shift+L` | Open the chat panel |
| Local LLM: Ask About Selection | `Ctrl+Shift+A` | Ask about selected code/text |
| Local LLM: Explain Selected Code | Right-click menu | Explain selected code |
| Local LLM: Refactor Selected Code | Right-click menu | Refactor selected code |
| Local LLM: Show MCP Connection Info | Command Palette | Get MCP endpoint and connection configs |
| Local LLM: Stop Server | Command Palette | Stop the running inference server |

---

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `localLLM.mcpPort` | `3333` | MCP server port |
| `localLLM.extraModelPaths` | `[]` | Extra directories to scan for models |
| `localLLM.temperature` | `0.7` | Generation temperature (0–2) |
| `localLLM.maxTokens` | `2048` | Max tokens per response |
| `localLLM.systemPrompt` | *(coding assistant)* | System prompt for all requests |

---

## 🏗️ Architecture

```
VS Code Extension
├── localModelScanner.ts   — scans filesystem for GGUF / HuggingFace / Ollama models
├── serverManager.ts       — starts llama-server, ollama serve, or Python/transformers server
├── mcpServer.ts           — MCP HTTP server (port 3333) for external AI clients
├── llmClient.ts           — HTTP client for Ollama/OpenAI-compatible APIs (streaming)
├── chatPanel.ts           — WebView chat UI
└── extension.ts           — commands, status bar, activation
```

```
External MCP clients  ──→  MCP server (port 3333)  ──→  local model
VS Code chat panel    ──→  LLM client              ──→  local model
                                                         ↑
                                              llama-server / ollama / python
```

---

## 🛠️ Development

```bash
git clone https://github.com/YOUR_USERNAME/local-llm-connect
cd local-llm-connect
npm install
npm run compile      # or: npm run watch
# Press F5 in VS Code to launch Extension Development Host
```

To package:
```bash
npm install -g @vscode/vsce
vsce package         # → local-llm-connect-2.0.0.vsix
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first to discuss.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

## 📄 License

MIT — see [LICENSE](LICENSE)
