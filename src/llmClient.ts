import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface LLMConfig {
  serverUrl: string;
  apiType: 'ollama' | 'openai-compatible';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallback {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export class LLMClient {
  constructor(private config: LLMConfig) {}

  updateConfig(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config };
  }

  async listModels(): Promise<string[]> {
    try {
      if (this.config.apiType === 'ollama') {
        return await this.listOllamaModels();
      } else {
        return await this.listOpenAIModels();
      }
    } catch (error) {
      throw new Error(`Failed to list models: ${(error as Error).message}`);
    }
  }

  private async listOllamaModels(): Promise<string[]> {
    const response = await this.httpGet(`${this.config.serverUrl}/api/tags`);
    const data = JSON.parse(response);
    return (data.models || []).map((m: { name: string }) => m.name);
  }

  private async listOpenAIModels(): Promise<string[]> {
    const response = await this.httpGet(`${this.config.serverUrl}/v1/models`);
    const data = JSON.parse(response);
    return (data.data || []).map((m: { id: string }) => m.id);
  }

  async chat(messages: ChatMessage[], streamCallback: StreamCallback): Promise<void> {
    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: this.config.systemPrompt },
      ...messages
    ];

    try {
      if (this.config.apiType === 'ollama') {
        await this.ollamaChat(messagesWithSystem, streamCallback);
      } else {
        await this.openAIChat(messagesWithSystem, streamCallback);
      }
    } catch (error) {
      streamCallback.onError(error as Error);
    }
  }

  private async ollamaChat(messages: ChatMessage[], cb: StreamCallback): Promise<void> {
    const body = JSON.stringify({
      model: this.config.model,
      messages,
      stream: true,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens
      }
    });

    await this.httpPostStream(
      `${this.config.serverUrl}/api/chat`,
      body,
      (chunk) => {
        try {
          const lines = chunk.split('\n').filter(l => l.trim());
          for (const line of lines) {
            const data = JSON.parse(line);
            if (data.message?.content) {
              cb.onToken(data.message.content);
            }
            if (data.done) {
              return true; // signal completion
            }
          }
        } catch { /* partial chunk */ }
        return false;
      },
      cb
    );
  }

  private async openAIChat(messages: ChatMessage[], cb: StreamCallback): Promise<void> {
    const body = JSON.stringify({
      model: this.config.model,
      messages,
      stream: true,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    });

    await this.httpPostStream(
      `${this.config.serverUrl}/v1/chat/completions`,
      body,
      (chunk) => {
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return true;
            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) cb.onToken(token);
            } catch { /* skip */ }
          }
        }
        return false;
      },
      cb
    );
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      lib.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private httpPostStream(
    url: string,
    body: string,
    onChunk: (chunk: string) => boolean,
    cb: StreamCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      let fullResponse = '';

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = lib.request(options, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        res.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          // Collect tokens for fullResponse
          const lines = text.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              // Ollama format
              const d = JSON.parse(line);
              if (d.message?.content) fullResponse += d.message.content;
            } catch {
              // OpenAI SSE format
              if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') {
                try {
                  const d = JSON.parse(line.slice(6));
                  const token = d.choices?.[0]?.delta?.content;
                  if (token) fullResponse += token;
                } catch { /* skip */ }
              }
            }
          }
          onChunk(text);
        });

        res.on('end', () => {
          cb.onComplete(fullResponse);
          resolve();
        });

        res.on('error', reject);
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async testConnection(): Promise<{ success: boolean; models: string[]; error?: string }> {
    try {
      const models = await this.listModels();
      return { success: true, models };
    } catch (error) {
      return { success: false, models: [], error: (error as Error).message };
    }
  }
}
