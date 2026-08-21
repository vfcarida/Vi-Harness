/**
 * Automated API Reference Documentation Generator.
 *
 * Scans public TypeScript export boundaries (src/index.ts, src/core, src/infra, src/runtime, src/di)
 * and generates a comprehensive, browsable Markdown API Reference in docs/api-reference.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ApiSection {
  title: string;
  description: string;
  sourceFile: string;
}

const API_SECTIONS: ApiSection[] = [
  {
    title: 'Core Domain Interfaces',
    description: 'Vendor-neutral contracts, domain models, and lifecycle state interfaces.',
    sourceFile: 'src/core/index.ts',
  },
  {
    title: 'Runtime & Orchestration Layer',
    description: 'Execution loop, state machine, Dual-Model Architect/Editor, and observer hub.',
    sourceFile: 'src/runtime/index.ts',
  },
  {
    title: 'Model Providers & Resilience',
    description: 'Native Anthropic (with Prompt Caching), Google Gemini, OpenAI-compatible, and CircuitBreaker.',
    sourceFile: 'src/infra/index.ts',
  },
  {
    title: 'Context Compiler & Compaction',
    description: '6-stage progressive compaction, L0-L3 tier budgeting, and prefix caching tracking.',
    sourceFile: 'src/infra/index.ts',
  },
  {
    title: 'Security & Policy Engine',
    description: 'Deny-first policy engine, credential protection, workspace containment, and secret scrubbing.',
    sourceFile: 'src/infra/index.ts',
  },
  {
    title: 'Telemetry & Distributed Observability',
    description: 'OpenTelemetry (OTLP) traces & metrics, JSONL journals, and SFT/DPO trajectory distillation.',
    sourceFile: 'src/infra/index.ts',
  },
  {
    title: 'Dependency Injection (DI)',
    description: 'Inversion-of-Control container, typed service tokens, and default module wiring.',
    sourceFile: 'src/di/index.ts',
  },
];

function generateMarkdown(): string {
  let doc = `# Vi-Harness Public API Reference\n\n`;
  doc += `> Auto-generated API documentation for Vi-Harness v0.1.0.\n\n`;
  doc += `Vi-Harness provides a modular, model-agnostic, evidence-driven coding-agent harness.\n\n`;
  doc += `## Table of Contents\n\n`;

  for (let i = 0; i < API_SECTIONS.length; i++) {
    const s = API_SECTIONS[i]!;
    const slug = s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    doc += `${i + 1}. [${s.title}](#${slug})\n`;
  }
  doc += `\n---\n\n`;

  for (const s of API_SECTIONS) {
    doc += `## ${s.title}\n\n`;
    doc += `${s.description}\n\n`;
    doc += `**Export Source**: \`${s.sourceFile}\`\n\n`;

    const fullPath = path.join(process.cwd(), s.sourceFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const exportMatches = content.match(/export\s+(?:type\s+)?{([^}]+)}/g) ?? [];
      const symbols: string[] = [];

      for (const m of exportMatches) {
        const cleaned = m.replace(/export\s+(?:type\s+)?{/, '').replace('}', '');
        const items = cleaned.split(',').map((item) => item.trim()).filter(Boolean);
        symbols.push(...items);
      }

      if (symbols.length > 0) {
        doc += `### Exported Symbols & Interfaces\n\n`;
        const uniqueSymbols = Array.from(new Set(symbols)).sort();
        for (const sym of uniqueSymbols) {
          doc += `- \`${sym}\`\n`;
        }
        doc += `\n`;
      }
    }
    doc += `---\n\n`;
  }

  doc += `## Quickstart Initialization\n\n`;
  doc += `\`\`\`typescript\n`;
  doc += `import { createRuntime } from 'vi-harness';\n\n`;
  doc += `const runtime = createRuntime({\n`;
  doc += `  profile: 'headless',\n`;
  doc += `});\n\n`;
  doc += `const result = await runtime.execute({\n`;
  doc += `  description: 'Fix syntax error in index.ts',\n`;
  doc += `});\n`;
  doc += `\`\`\`\n`;

  return doc;
}

const outputPath = path.join(process.cwd(), 'docs', 'api-reference.md');
fs.writeFileSync(outputPath, generateMarkdown(), 'utf-8');
console.log(`✅ API Reference documentation generated at ${outputPath}`);
