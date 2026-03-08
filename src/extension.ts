import * as vscode from 'vscode';
import { LLMClient, LLMConfig } from './llmClient';
import { ChatPanel } from './chatPanel';
import { ServerManager } from './serverManager';
import { MCPServer } from './mcpServer';
import { discoverAllModels, formatSize, LocalModel } from './localModelScanner';

let serverManager: ServerManager;
let mcpServer: MCPServer;
let llmClient: LLMClient;
let statusBarItem: vscode.StatusBarItem;

function getLLMConfig(serverUrl: string, apiType: 'ollama' | 'openai-compatible', model: string): LLMConfig {
  const cfg = vscode.workspace.getConfiguration('localLLM');
  return {
    serverUrl,
    apiType,
    model,
    temperature: cfg.get('temperature') ?? 0.7,
    maxTokens: cfg.get('maxTokens') ?? 2048,
    systemPrompt: cfg.get('systemPrompt') || 'You are a helpful AI coding assistant. Be concise and precise.'
  };
}

function setStatus(text: string, tooltip?: string) {
  statusBarItem.text = `$(hubot) ${text}`;
  statusBarItem.tooltip = tooltip ?? text;
}

async function pickAndStartModel(): Promise<boolean> {
  setStatus('Scanning for models...');

  const extraDirs: string[] = vscode.workspace.getConfiguration('localLLM').get('extraModelPaths') ?? [];
  const models = discoverAllModels(extraDirs);

  if (models.length === 0) {
    setStatus('No models found');
    const action = await vscode.window.showWarningMessage(
      'No local LLM models found on this machine.\n' +
      'Install Ollama (ollama.com) and pull a model, or place a .gguf file in ~/models.',
      'Open Ollama Site',
      'Set Custom Path'
    );
    if (action === 'Open Ollama Site') {
      vscode.env.openExternal(vscode.Uri.parse('https://ollama.com'));
    } else if (action === 'Set Custom Path') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'localLLM.extraModelPaths');
    }
    return false;
  }

  // Build quick-pick items
  type ModelItem  = vscode.QuickPickItem & { model: LocalModel };
  type ActionItem = vscode.QuickPickItem & { action: 'addFolder' };
  type PickItem   = ModelItem | ActionItem;

  const modelItems: ModelItem[] = models.map(m => {
    let description = '';
    if (m.type === 'ollama')        description = 'Ollama';
    else if (m.type === 'gguf')     description = `GGUF · ${formatSize(m.size ?? 0)}`;
    else if (m.type === 'huggingface') description = `${(m.format ?? 'HuggingFace').toUpperCase()} · ${formatSize(m.size ?? 0)}`;
    return { label: m.name, description, detail: m.path, model: m };
  });

  const addFolderItem: ActionItem = {
    label: '$(folder-opened)  Add folder...',
    description: 'Browse for a folder containing model files',
    action: 'addFolder'
  };

  const items: PickItem[] = [
    ...modelItems,
    { kind: vscode.QuickPickItemKind.Separator, label: '' } as PickItem,
    addFolderItem
  ];

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Select Local LLM Model',
    placeHolder: `${models.length} model(s) found — or add a folder`,
    matchOnDescription: true
  });

  if (!selected) { setStatus('No model selected'); return false; }

  // Handle "Add folder"
  if ('action' in selected && selected.action === 'addFolder') {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: false, canSelectFolders: true, canSelectMany: false,
      title: 'Select folder containing model files'
    });
    if (!uris || uris.length === 0) { setStatus('No model selected'); return false; }
    const folderPath = uris[0].fsPath;
    const cfg = vscode.workspace.getConfiguration('localLLM');
    const existing: string[] = cfg.get('extraModelPaths') ?? [];
    if (!existing.includes(folderPath)) {
      await cfg.update('extraModelPaths', [...existing, folderPath], vscode.ConfigurationTarget.Global);
    }
    return pickAndStartModel();
  }

  const modelSelected = selected as ModelItem;
  setStatus(`Starting ${modelSelected.model.name}...`);

  try {
    const info = await serverManager.startForModel(modelSelected.model);
    const config = getLLMConfig(info.url, info.apiType, info.model);
    llmClient.updateConfig(config);
    mcpServer.updateClient(llmClient, info.model);
    setStatus(`${info.model}`, `Server: ${info.url} | MCP: http://127.0.0.1:${mcpServer.port}/mcp`);
    return true;
  } catch (err) {
    setStatus('Server failed to start');
    vscode.window.showErrorMessage(`Failed to start server: ${(err as Error).message}`);
    return false;
  }
}

export function activate(context: vscode.ExtensionContext) {
  serverManager = new ServerManager();
  llmClient = new LLMClient(getLLMConfig('http://localhost:11434', 'ollama', ''));

  // Start MCP server immediately on activate
  const mcpPort: number = vscode.workspace.getConfiguration('localLLM').get('mcpPort') ?? 3333;
  mcpServer = new MCPServer(llmClient, mcpPort);
  mcpServer.start();

  // Status bar — click to select model
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'localLLM.selectModel';
  setStatus('Select Model');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('localLLM') && serverManager.serverInfo) {
      const info = serverManager.serverInfo;
      llmClient.updateConfig(getLLMConfig(info.url, info.apiType, info.model));
    }
  });

  // ── Commands ────────────────────────────────────────────────────────────

  const selectModelCmd = vscode.commands.registerCommand('localLLM.selectModel', async () => {
    await pickAndStartModel();
  });

  const openChatCmd = vscode.commands.registerCommand('localLLM.openChat', async () => {
    if (!serverManager.serverInfo) { if (!await pickAndStartModel()) return; }
    ChatPanel.createOrShow(context.extensionUri, llmClient);
  });

  const askSelectionCmd = vscode.commands.registerCommand('localLLM.askSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage('Please select some text first.'); return;
    }
    if (!serverManager.serverInfo) { if (!await pickAndStartModel()) return; }
    const selectedText = editor.document.getText(editor.selection);
    const question = await vscode.window.showInputBox({
      prompt: 'What would you like to ask about the selected text?',
      placeHolder: 'e.g., "What does this do?" or "Are there any bugs?"'
    });
    if (!question) return;
    const panel = ChatPanel.createOrShow(context.extensionUri, llmClient);
    panel.sendInitialMessage(`${question}\n\n\`\`\`${editor.document.languageId}\n${selectedText}\n\`\`\``);
  });

  const explainCmd = vscode.commands.registerCommand('localLLM.explainCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage('Please select some code first.'); return;
    }
    if (!serverManager.serverInfo) { if (!await pickAndStartModel()) return; }
    const lang = editor.document.languageId;
    const panel = ChatPanel.createOrShow(context.extensionUri, llmClient);
    panel.sendInitialMessage(
      `Please explain what the following ${lang} code does, step by step:\n\n\`\`\`${lang}\n${editor.document.getText(editor.selection)}\n\`\`\``
    );
  });

  const refactorCmd = vscode.commands.registerCommand('localLLM.refactorCode', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage('Please select some code first.'); return;
    }
    if (!serverManager.serverInfo) { if (!await pickAndStartModel()) return; }
    const lang = editor.document.languageId;
    const panel = ChatPanel.createOrShow(context.extensionUri, llmClient);
    panel.sendInitialMessage(
      `Please refactor the following ${lang} code to improve readability, performance, and best practices. Show the improved version with a brief explanation:\n\n\`\`\`${lang}\n${editor.document.getText(editor.selection)}\n\`\`\``
    );
  });

  const stopServerCmd = vscode.commands.registerCommand('localLLM.stopServer', () => {
    serverManager.stopServer();
    setStatus('Server stopped — click to select model');
    vscode.window.showInformationMessage('Local LLM server stopped.');
  });

  const showMcpInfoCmd = vscode.commands.registerCommand('localLLM.showMcpInfo', async () => {
    const port = mcpServer.port;
    const endpoint = `http://127.0.0.1:${port}/mcp`;

    const choice = await vscode.window.showInformationMessage(
      `MCP Server is running at ${endpoint}`,
      'Copy Endpoint',
      'Show Connection Guide'
    );

    if (choice === 'Copy Endpoint') {
      await vscode.env.clipboard.writeText(endpoint);
      vscode.window.showInformationMessage('MCP endpoint copied to clipboard.');
    } else if (choice === 'Show Connection Guide') {
      const panel = vscode.window.createWebviewPanel(
        'localLLMMcpGuide', 'MCP Connection Guide', vscode.ViewColumn.One,
        { enableScripts: false }
      );
      panel.webview.html = getMcpGuideHtml(port);
    }
  });

  const configureCmd = vscode.commands.registerCommand('localLLM.configure', () => {
    vscode.commands.executeCommand('workbench.action.openSettings', 'localLLM');
  });

  context.subscriptions.push(
    selectModelCmd, openChatCmd, askSelectionCmd, explainCmd,
    refactorCmd, stopServerCmd, showMcpInfoCmd, configureCmd,
    { dispose: () => { serverManager.dispose(); mcpServer.dispose(); } }
  );

  // Auto-scan on first launch
  const hasShownWelcome = context.globalState.get('localLLM.welcomeShown');
  if (!hasShownWelcome) {
    context.globalState.update('localLLM.welcomeShown', true);
    vscode.window.showInformationMessage(
      'Local LLM Connect: Scan for models on this machine?',
      'Scan Now', 'Later'
    ).then(sel => { if (sel === 'Scan Now') pickAndStartModel(); });
  }
}

export function deactivate() {
  serverManager?.dispose();
  mcpServer?.dispose();
}

function getMcpGuideHtml(port: number): string {
  const endpoint = `http://127.0.0.1:${port}/mcp`;
  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: var(--vscode-font-family); padding: 24px; max-width: 700px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
    pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
    .tag { display: inline-block; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; padding: 1px 7px; font-size: 11px; margin-left: 6px; }
    p { line-height: 1.6; }
  </style>
</head><body>
  <h1>MCP Server — Connection Guide</h1>
  <p>Your local LLM is exposed as an MCP server. Connect any MCP-compatible client using the endpoint below.</p>
  <pre>${endpoint}</pre>

  <h2>Cursor / Windsurf / Continue.dev <span class="tag">HTTP</span></h2>
  <p>Add to your MCP config file:</p>
  <pre>{
  "mcpServers": {
    "local-llm": {
      "url": "${endpoint}",
      "transport": "http"
    }
  }
}</pre>

  <h2>Claude Desktop <span class="tag">HTTP</span></h2>
  <p>Edit <code>~/.config/claude/claude_desktop_config.json</code>:</p>
  <pre>{
  "mcpServers": {
    "local-llm": {
      "url": "${endpoint}",
      "transport": "http"
    }
  }
}</pre>

  <h2>Any HTTP MCP client</h2>
  <p>POST JSON-RPC 2.0 requests to <code>${endpoint}</code></p>
  <p>Available tools: <code>chat</code>, <code>explain_code</code>, <code>refactor_code</code>, <code>complete</code></p>
  <pre>curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "chat",
      "arguments": {
        "messages": [{"role": "user", "content": "Hello!"}]
      }
    }
  }'</pre>
</body></html>`;
}
