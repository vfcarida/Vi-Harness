/**
 * Transport Registry Unit Tests (P012).
 */
import { describe, it, expect } from 'vitest';
import { TransportRegistry } from '../../../src/infra/mcp/transport-registry.js';
import { StdioTransport } from '../../../src/infra/mcp/transports/stdio-transport.js';
import { HttpTransport } from '../../../src/infra/mcp/transports/http-transport.js';
import type { Transport } from '../../../src/infra/mcp/transports/types.js';

describe('Transport Registry — P012', () => {
  it('1. should list built-in stdio, http, and sse transports', () => {
    const registry = new TransportRegistry();
    const list = registry.list();

    expect(list).toContain('stdio');
    expect(list).toContain('http');
    expect(list).toContain('sse');
  });

  it('2. should instantiate built-in StdioTransport and HttpTransport', () => {
    const registry = new TransportRegistry();

    const stdio = registry.create('stdio');
    expect(stdio).toBeInstanceOf(StdioTransport);

    const http = registry.create('http', { port: 8080 });
    expect(http).toBeInstanceOf(HttpTransport);
  });

  it('3. should support registering custom transports', () => {
    const registry = new TransportRegistry();

    class CustomTransport implements Transport {
      readonly name = 'custom';
      readonly isRunning = false;
      async start() {}
      async stop() {}
      onMessage() {}
    }

    registry.register('custom', () => new CustomTransport());

    expect(registry.has('custom')).toBe(true);
    const inst = registry.create('custom');
    expect(inst).toBeInstanceOf(CustomTransport);
  });

  it('4. should throw clear error on unknown transport type', () => {
    const registry = new TransportRegistry();
    expect(() => registry.create('websocket')).toThrow(/not registered/i);
  });

  it('5. should instantiate transport from TransportConfig object', () => {
    const registry = new TransportRegistry();
    const transport = registry.createFromConfig({
      type: 'http',
      options: { port: 9000 },
    });
    expect(transport).toBeInstanceOf(HttpTransport);
  });
});
