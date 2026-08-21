/**
 * Standard I/O (stdio) Transport for MCP.
 *
 * Implements newline-delimited JSON-RPC 2.0 communication over standard input/output streams.
 * Handles line buffering across chunk boundaries, backpressure, and graceful shutdown.
 */
import type { Transport, StdioTransportOptions, JsonRpcHandler } from './types.js';
import type { McpJsonRpcRequest, McpJsonRpcResponse } from '../mcp-types.js';

export class StdioTransport implements Transport {
  public readonly name = 'stdio';
  private running = false;
  private messageHandler?: JsonRpcHandler;
  private readonly inStream: NodeJS.ReadableStream;
  private readonly outStream: NodeJS.WritableStream;
  private readonly maxLineLength: number;
  private buffer = '';
  private activeRequestCount = 0;
  private onDataBound?: (chunk: Buffer | string) => void;
  private isDraining = false;

  constructor(options?: StdioTransportOptions) {
    this.inStream = options?.inStream ?? process.stdin;
    this.outStream = options?.outStream ?? process.stdout;
    this.maxLineLength = options?.maxLineLength ?? 10 * 1024 * 1024; // 10MB default
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isDrainingStream(): boolean {
    return this.isDraining;
  }

  onMessage(handler: JsonRpcHandler): void {
    this.messageHandler = handler;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.buffer = '';

    this.onDataBound = (chunk: Buffer | string) => {
      this.handleChunk(chunk.toString('utf-8'));
    };

    this.inStream.on('data', this.onDataBound);
  }

  private handleChunk(chunk: string): void {
    this.buffer += chunk;

    if (this.buffer.length > this.maxLineLength) {
      this.writeResponse({
        jsonrpc: '2.0',
        id: null as any,
        error: { code: -32600, message: 'Line length limit exceeded (max 10MB)' },
      });
      this.buffer = '';
      return;
    }

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.length > 0) {
        this.processLine(line);
      }
    }
  }

  private async processLine(line: string): Promise<void> {
    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.writeResponse({
        jsonrpc: '2.0',
        id: null as any,
        error: { code: -32700, message: 'Parse error: Invalid JSON' },
      });
      return;
    }

    if (!this.messageHandler) {
      this.writeResponse({
        jsonrpc: '2.0',
        id: parsed?.id ?? null,
        error: { code: -32603, message: 'Server not ready: No message handler registered' },
      });
      return;
    }

    this.activeRequestCount++;
    try {
      const response = await this.messageHandler(parsed as McpJsonRpcRequest);
      if (response) {
        await this.writeResponse(response);
      }
    } catch (err: any) {
      await this.writeResponse({
        jsonrpc: '2.0',
        id: parsed?.id ?? null,
        error: { code: -32603, message: `Internal handler error: ${err?.message ?? String(err)}` },
      });
    } finally {
      this.activeRequestCount--;
    }
  }

  private async writeResponse(response: McpJsonRpcResponse): Promise<void> {
    if (!this.running) return;

    const payload = JSON.stringify(response) + '\n';
    const canWrite = this.outStream.write(payload, 'utf-8');

    if (!canWrite) {
      // Handle backpressure
      await new Promise<void>((resolve) => {
        this.isDraining = true;
        this.outStream.once('drain', () => {
          this.isDraining = false;
          resolve();
        });
      });
    }
  }

  async sendNotification(method: string, params?: unknown): Promise<void> {
    if (!this.running) return;

    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    const payload = JSON.stringify(notification) + '\n';
    this.outStream.write(payload, 'utf-8');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.onDataBound) {
      this.inStream.removeListener('data', this.onDataBound);
    }

    // Await any in-flight active requests
    const timeout = Date.now() + 3000;
    while (this.activeRequestCount > 0 && Date.now() < timeout) {
      await new Promise((r) => setTimeout(r, 20));
    }

    this.buffer = '';
  }
}
