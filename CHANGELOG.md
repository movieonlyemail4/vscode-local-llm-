# Changelog

## [2.0.0] - 2025-03-08

### Added
- Auto-detect local LLM models on your machine (no manual server setup)
- Support for GGUF models via llama-server (llama.cpp)
- Support for HuggingFace SafeTensors and PyTorch models via Python/transformers
- Support for Ollama models (auto-starts `ollama serve` if not running)
- **MCP server** — expose your local LLM to any MCP client (Claude Desktop, Cursor, Continue.dev)
- Model picker with `+ Add folder...` option to scan custom directories
- Status bar item showing current model and server URL
- `Local LLM: Show MCP Connection Info` command with ready-to-paste configs
- Auto-install Python dependencies (torch, transformers) for HuggingFace models
- Scans common model directories: `~/models`, `~/Downloads`, `~/.cache/huggingface`, LM Studio cache, GPT4All, and more

### Changed
- Removed dependency on LM Studio or any external server — the extension manages everything
- Removed manual `serverUrl` and `apiType` settings (now auto-configured)
- Added `localLLM.mcpPort` setting (default: 3333)
- Added `localLLM.extraModelPaths` setting for custom scan directories

### Removed
- Manual server URL configuration
- LM Studio-specific settings

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Chat panel with streaming responses
- Ollama and LM Studio support
- Ask About Selection, Explain Code, Refactor Code commands
- Keyboard shortcuts
