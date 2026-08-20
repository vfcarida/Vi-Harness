// Pattern: Built-in Web UI & Server Bundle (ref: DeepSeek Harness)
/**
 * Web Bundle.
 *
 * Provides web dashboard, real-time WebSocket events, and ACP JSON-RPC automation server.
 */
import type { Bundle } from '../core/plugin/composition.js';

export const WEB_BUNDLE: Bundle = {
  name: 'web',
  description: 'Web dashboard, real-time streaming WebSocket server, and ACP automation server',
  plugins: [
    {
      id: 'http-server',
      plugin: '@vi-harness/server-fastify',
      config: { port: 3000 },
    },
    {
      id: 'acp-server',
      plugin: '@vi-harness/acp-jsonrpc-server',
      config: { endpoint: '/acp' },
    },
    {
      id: 'ui-dashboard',
      plugin: '@vi-harness/dashboard-static-ui',
    },
  ],
};
