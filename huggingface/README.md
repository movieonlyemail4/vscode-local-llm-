---
title: Local LLM Connect — VS Code Extension
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: static
pinned: true
license: mit
tags:
  - vscode
  - extension
  - local-llm
  - ollama
  - gguf
  - mcp
  - code-assistant
  - llama
  - huggingface
---

# 🤖 Local LLM Connect

**A VS Code extension that runs any local LLM model directly in your editor — no cloud, no API keys.**

## What it does

- **Auto-detects** GGUF, SafeTensors, PyTorch, and Ollama models already on your machine
- **Auto-starts** the inference server (llama-server or ollama serve) — no terminal needed
- **Built-in MCP server** so Claude Desktop, Cursor, and Continue.dev can use your local model
- **Chat panel**, explain code, refactor code — all running 100% locally

## Supported model formats

| Format | Source |
|--------|--------|
| **GGUF** | Download from any HuggingFace model page with GGUF files |
| **SafeTensors** | Any standard HuggingFace model |
| **PyTorch (.bin)** | Older HuggingFace format |
| **Ollama** | `ollama pull <model>` |

## Auto-scanned locations

The extension automatically finds models in:
- `~/models`, `~/Downloads`, `~/Documents`
- `~/.cache/huggingface/hub` ← models you've already downloaded via HuggingFace
- `~/.cache/lm-studio/models` ← models downloaded via LM Studio
- `~/llama.cpp/models`, GPT4All folder

## Getting started

### 1. Download a model

Go to any model page on HuggingFace and download a GGUF file, e.g.:
- [Llama-3.2-1B-Instruct-GGUF](https://huggingface.co/hugging-quants/Llama-3.2-1B-Instruct-Q8_0-GGUF)
- [Qwen2.5-1.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF)
- [Mistral-7B-Instruct-GGUF](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF)

Save it to `~/models/` or `~/Downloads/`.

### 2. Install llama-server

```bash
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target llama-server -j$(nproc)
sudo cp build/bin/llama-server /usr/local/bin/
```

Or for Ollama: [download from ollama.com](https://ollama.com)

### 3. Install the extension

```bash
code --install-extension local-llm-connect-2.0.0.vsix
```

Or install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=your-publisher-id.local-llm-connect) *(coming soon)*.

### 4. Use it

- Press **Ctrl+Shift+M** to scan and pick a model
- Press **Ctrl+Shift+L** to open the chat

## MCP Integration

The extension starts an MCP server at `http://127.0.0.1:3333/mcp`.

Add to Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

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

## Links

- **GitHub**: [github.com/YOUR_USERNAME/local-llm-connect](https://github.com/YOUR_USERNAME/local-llm-connect)
- **Issues / Feature Requests**: [GitHub Issues](https://github.com/YOUR_USERNAME/local-llm-connect/issues)
- **VS Code Marketplace**: *(coming soon)*

## License

MIT
