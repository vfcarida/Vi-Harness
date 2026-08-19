#!/usr/bin/env node
/**
 * Agent Client Protocol (ACP) Server CLI Command.
 *
 * Usage:
 *   vi-harness --acp stdio
 *   vi-harness --acp http --acp-port 3101
 *   npx tsx src/cli/commands/acp.ts [options]
 */
import { AcpServer } from '../../infra/acp/acp-server.js';
import { StdioTransport } from '../../infra/mcp/transports/stdio-transport.js';
import { HttpTransport } from '../../infra/mcp/transports/http-transport.js';
import { DefaultAgentRuntime } from '../../runtime/default-agent-runtime.js';
import { DefaultContextCompiler } from '../../infra/compiler/default-context-compiler.js';
import { DefaultToolRegistry } from '../../infra/tools/default-tool-registry.js';
import { DefaultToolExecutor } from '../../infra/tools/default-tool-executor.js';
import { OpenAICompatibleProvider } from '../../infra/model/openai-compatible-provider.js';
import { MockModelProvider } from '../../infra/model/mock-model-provider.js';
import { UuidV7IdFactory } from '../../infra/id/uuid-id-factory.js';
import { SystemClock } from '../../infra/time/system-clock.js';
import { UtilityModelRouter } from '../../infra/router/utility-model-router.js';
import { ProviderHealthStatus } from '../../core/index.js';

export interface AcpCliArgs {
  transport: 'stdio' | 'http';
  port: number;
  host: string;
  modelId: string;
  providerId: string;
  help: boolean;
}

export function parseAcpArgs(args: string[]): AcpCliArgs {
  const result: AcpCliArgs = {
    transport: 'stdio',
    port: 3101,
    host: '127.0.0.1',
    modelId: 'gpt-4o',
    providerId: 'openai',
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--acp' && i + 1 < args.length) {
      result.transport = args[++i]! as 'stdio' | 'http';
    } else if (arg === 'stdio' || arg === 'http') {
      result.transport = arg;
    } else if ((arg === '--acp-port' || arg === '--port' || arg === '-p') && i + 1 < args.length) {
      result.port = parseInt(args[++i]!, 10) || 3101;
    } else if (arg === '--host' && i + 1 < args.length) {
      result.host = args[++i]!;
    } else if ((arg === '--model' || arg === '-m') && i + 1 < args.length) {
      result.modelId = args[++i]!;
    } else if ((arg === '--provider' || arg === '--prov') && i + 1 < args.length) {
      result.providerId = args[++i]!;
    }
  }

  return result;
}

export async function runAcpCli(rawArgs: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseAcpArgs(rawArgs);

  if (args.help) {
    console.log(`
======================================================================
     Vi-Harness Agent Client Protocol (ACP) Automation Server CLI
======================================================================

Usage:
  vi-harness --acp stdio
  vi-harness --acp http --acp-port 3101 [--model <modelId>]
`);
    return;
  }

  const idFactory = new UuidV7IdFactory();
  const clock = new SystemClock();

  const provider =
    args.providerId === 'mock'
      ? new MockModelProvider({ descriptor: { id: args.modelId }, providerId: 'mock' })
      : new OpenAICompatibleProvider({
          apiKey: process.env['OPENAI_API_KEY'] ?? 'dummy-key',
          defaultModelId: args.modelId,
          providerId: args.providerId,
        });

  const router = new UtilityModelRouter();
  router.registerProvider(provider);

  const toolRegistry = new DefaultToolRegistry();
  const toolExecutor = new DefaultToolExecutor({ registry: toolRegistry, idFactory });
  const compiler = new DefaultContextCompiler({ idFactory, clock });

  const runtime = new DefaultAgentRuntime({
    router,
    compiler,
    toolExecutor,
    idFactory,
    clock,
  });

  const server = new AcpServer({
    runtime,
    idFactory,
    clock,
  });

  if (args.transport === 'http') {
    const transport = new HttpTransport({
      port: args.port,
      host: args.host,
    });
    await server.listen(transport);
    console.error(`[ACP] Automation Server listening on HTTP http://${args.host}:${args.port}/rpc`);
  } else {
    const transport = new StdioTransport();
    await server.listen(transport);
    console.error('[ACP] Automation Server listening on stdio (line-delimited JSON-RPC 2.0)');
  }
}

if (process.argv[1]?.endsWith('acp.ts') || process.argv[1]?.endsWith('acp.js')) {
  runAcpCli().catch((err) => {
    console.error('[ERROR] ACP Server failed:', err);
    process.exit(1);
  });
}
