import * as vscode from 'vscode';
import { LLMClient, ChatMessage } from './llmClient';

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _messages: ChatMessage[] = [];
  private _llmClient: LLMClient;

  public static createOrShow(
    extensionUri: vscode.Uri,
    llmClient: LLMClient
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      return ChatPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'localLLMChat',
      'Local LLM Chat',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, llmClient);
    return ChatPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly _extensionUri: vscode.Uri,
    llmClient: LLMClient
  ) {
    this._panel = panel;
    this._llmClient = llmClient;

    this._panel.webview.html = this._getHtmlContent();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'sendMessage':
            await this._handleUserMessage(message.text);
            break;
          case 'clearChat':
            this._messages = [];
            this._panel.webview.postMessage({ command: 'clearMessages' });
            break;
          case 'getModels':
            await this._fetchModels();
            break;
          case 'setModel':
            this._llmClient.updateConfig({ model: message.model });
            vscode.workspace.getConfiguration('localLLM').update('model', message.model, true);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public sendInitialMessage(text: string) {
    this._panel.webview.postMessage({
      command: 'setInput',
      text
    });
  }

  private async _fetchModels() {
    const result = await this._llmClient.testConnection();
    this._panel.webview.postMessage({
      command: 'modelsLoaded',
      models: result.models,
      success: result.success,
      error: result.error
    });
  }

  private async _handleUserMessage(text: string) {
    this._messages.push({ role: 'user', content: text });

    this._panel.webview.postMessage({
      command: 'startAssistantMessage'
    });

    let hasError = false;

    await this._llmClient.chat(this._messages, {
      onToken: (token) => {
        this._panel.webview.postMessage({
          command: 'appendToken',
          token
        });
      },
      onComplete: (fullResponse) => {
        this._messages.push({ role: 'assistant', content: fullResponse });
        this._panel.webview.postMessage({ command: 'finishMessage' });
      },
      onError: (error) => {
        hasError = true;
        this._panel.webview.postMessage({
          command: 'error',
          message: `Error: ${error.message}\n\nMake sure your LLM server is running and check the settings.`
        });
      }
    });

    if (hasError) {
      this._messages.pop(); // Remove failed user message
    }
  }

  private _getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Local LLM Chat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    #toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    #toolbar label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }

    #model-select {
      flex: 1;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 3px 6px;
      font-size: 12px;
      border-radius: 3px;
    }

    #refresh-btn, #clear-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 10px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 11px;
      white-space: nowrap;
    }

    #refresh-btn:hover, #clear-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    #status-bar {
      padding: 4px 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      min-height: 22px;
    }

    #status-bar.error { color: var(--vscode-errorForeground); }
    #status-bar.success { color: var(--vscode-terminal-ansiGreen); }

    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 100%;
    }

    .message-role {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .message.user .message-role { color: var(--vscode-terminal-ansiBlue); }
    .message.assistant .message-role { color: var(--vscode-terminal-ansiGreen); }

    .message-content {
      padding: 8px 12px;
      border-radius: 6px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message.user .message-content {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }

    .message.assistant .message-content {
      background: var(--vscode-editor-selectionBackground);
    }

    .message.error .message-content {
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-errorForeground);
    }

    .cursor {
      display: inline-block;
      width: 2px;
      height: 1em;
      background: currentColor;
      animation: blink 0.7s step-end infinite;
      vertical-align: text-bottom;
      margin-left: 1px;
    }
    @keyframes blink { 50% { opacity: 0; } }

    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      margin: 4px 0;
    }

    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 12px;
    }

    #input-area {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
      flex-shrink: 0;
    }

    #user-input {
      width: 100%;
      min-height: 60px;
      max-height: 200px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      resize: vertical;
      border-radius: 4px;
    }

    #user-input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    #send-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #send-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 16px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 13px;
    }

    #send-btn:hover { background: var(--vscode-button-hoverBackground); }
    #send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    #hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    #empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--vscode-descriptionForeground);
      gap: 8px;
    }

    #empty-state h2 { font-size: 18px; font-weight: 400; }
    #empty-state p { font-size: 12px; }
  </style>
</head>
<body>
  <div id="toolbar">
    <label>Model:</label>
    <select id="model-select" onchange="handleModelChange()">
      <option value="">-- Loading models... --</option>
    </select>
    <button id="refresh-btn" onclick="loadModels()">⟳ Refresh</button>
    <button id="clear-btn" onclick="clearChat()">Clear</button>
  </div>

  <div id="status-bar">Connecting to LLM server...</div>

  <div id="messages">
    <div id="empty-state">
      <h2>🤖 Local LLM Chat</h2>
      <p>Connect to your local LLM and start chatting.</p>
      <p>Select a model above and type your message below.</p>
    </div>
  </div>

  <div id="input-area">
    <textarea
      id="user-input"
      placeholder="Type your message... (Ctrl+Enter to send)"
      onkeydown="handleKeyDown(event)"
    ></textarea>
    <div id="send-row">
      <span id="hint">Ctrl+Enter to send</span>
      <button id="send-btn" onclick="sendMessage()">Send ▶</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let isGenerating = false;
    let currentAssistantEl = null;
    let currentContentEl = null;
    let fullCurrentText = '';

    // Load models on start
    loadModels();

    function loadModels() {
      document.getElementById('status-bar').textContent = 'Connecting to LLM server...';
      document.getElementById('status-bar').className = '';
      vscode.postMessage({ command: 'getModels' });
    }

    function handleModelChange() {
      const model = document.getElementById('model-select').value;
      if (model) {
        vscode.postMessage({ command: 'setModel', model });
      }
    }

    function clearChat() {
      vscode.postMessage({ command: 'clearChat' });
    }

    function sendMessage() {
      if (isGenerating) return;
      const input = document.getElementById('user-input');
      const text = input.value.trim();
      if (!text) return;

      const model = document.getElementById('model-select').value;
      if (!model) {
        setStatus('Please select a model first.', 'error');
        return;
      }

      input.value = '';
      appendUserMessage(text);
      setGenerating(true);
      vscode.postMessage({ command: 'sendMessage', text });
    }

    function handleKeyDown(e) {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        sendMessage();
      }
    }

    function appendUserMessage(text) {
      hideEmptyState();
      const el = createMessageEl('user', text);
      document.getElementById('messages').appendChild(el);
      scrollToBottom();
    }

    function createMessageEl(role, content = '') {
      const wrapper = document.createElement('div');
      wrapper.className = \`message \${role}\`;

      const roleEl = document.createElement('div');
      roleEl.className = 'message-role';
      roleEl.textContent = role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : 'Error';

      const contentEl = document.createElement('div');
      contentEl.className = 'message-content';
      contentEl.textContent = content;

      wrapper.appendChild(roleEl);
      wrapper.appendChild(contentEl);
      return wrapper;
    }

    function setGenerating(val) {
      isGenerating = val;
      document.getElementById('send-btn').disabled = val;
      document.getElementById('user-input').disabled = val;
      if (val) setStatus('Generating...', '');
    }

    function setStatus(text, cls = '') {
      const bar = document.getElementById('status-bar');
      bar.textContent = text;
      bar.className = cls;
    }

    function hideEmptyState() {
      const el = document.getElementById('empty-state');
      if (el) el.remove();
    }

    function scrollToBottom() {
      const msgs = document.getElementById('messages');
      msgs.scrollTop = msgs.scrollHeight;
    }

    // Markdown-lite: handle code blocks and inline code
    function renderMarkdown(text) {
      // Escape HTML first
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Code blocks
      html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
      // Inline code
      html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      // Bold
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      // Italic
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

      return html;
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.command) {
        case 'modelsLoaded':
          const select = document.getElementById('model-select');
          select.innerHTML = '';
          if (msg.success && msg.models.length > 0) {
            msg.models.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m;
              opt.textContent = m;
              select.appendChild(opt);
            });
            // Auto-select first model
            vscode.postMessage({ command: 'setModel', model: msg.models[0] });
            setStatus(\`Connected — \${msg.models.length} model(s) available\`, 'success');
          } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '-- No models found --';
            select.appendChild(opt);
            setStatus(\`Connection failed: \${msg.error || 'No models found'}\`, 'error');
          }
          break;

        case 'startAssistantMessage':
          hideEmptyState();
          fullCurrentText = '';
          currentAssistantEl = createMessageEl('assistant', '');
          currentContentEl = currentAssistantEl.querySelector('.message-content');
          // Add blinking cursor
          const cursor = document.createElement('span');
          cursor.className = 'cursor';
          currentContentEl.appendChild(cursor);
          document.getElementById('messages').appendChild(currentAssistantEl);
          scrollToBottom();
          break;

        case 'appendToken':
          if (currentContentEl) {
            fullCurrentText += msg.token;
            currentContentEl.innerHTML = renderMarkdown(fullCurrentText) + '<span class="cursor"></span>';
            scrollToBottom();
          }
          break;

        case 'finishMessage':
          if (currentContentEl) {
            currentContentEl.innerHTML = renderMarkdown(fullCurrentText);
          }
          currentAssistantEl = null;
          currentContentEl = null;
          setGenerating(false);
          setStatus('Ready', 'success');
          document.getElementById('user-input').focus();
          break;

        case 'error':
          if (currentAssistantEl) {
            currentAssistantEl.remove();
          }
          currentAssistantEl = null;
          currentContentEl = null;
          hideEmptyState();
          const errEl = createMessageEl('error', msg.message);
          errEl.querySelector('.message-role').textContent = 'Error';
          document.getElementById('messages').appendChild(errEl);
          setGenerating(false);
          setStatus('Error occurred', 'error');
          scrollToBottom();
          break;

        case 'clearMessages':
          const messagesDiv = document.getElementById('messages');
          messagesDiv.innerHTML = \`
            <div id="empty-state">
              <h2>🤖 Local LLM Chat</h2>
              <p>Connect to your local LLM and start chatting.</p>
              <p>Select a model above and type your message below.</p>
            </div>\`;
          setStatus('Chat cleared', '');
          break;

        case 'setInput':
          document.getElementById('user-input').value = msg.text;
          document.getElementById('user-input').focus();
          break;
      }
    });
  </script>
</body>
</html>`;
  }

  public dispose() {
    ChatPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}
