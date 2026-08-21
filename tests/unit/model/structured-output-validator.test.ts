import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { StructuredOutputValidator } from '../../../src/infra/model/structured-output-validator.js';

describe('StructuredOutputValidator', () => {
  const PlanSchema = z.object({
    goal: z.string(),
    steps: z.array(z.string()).min(1),
    estimatedDurationMinutes: z.number().positive(),
  });

  it('validates raw JSON string adhering to Zod schema', () => {
    const rawJson = JSON.stringify({
      goal: 'Refactor auth module',
      steps: ['Audit credentials', 'Implement JWT verification'],
      estimatedDurationMinutes: 45,
    });

    const result = StructuredOutputValidator.validateZod(rawJson, PlanSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goal).toBe('Refactor auth module');
      expect(result.data.steps).toHaveLength(2);
    }
  });

  it('extracts and validates JSON enclosed in markdown code blocks', () => {
    const markdownText = `
Here is the architectural plan:

\`\`\`json
{
  "goal": "Migrate database schema",
  "steps": ["Create migration file", "Run drizzle-kit migrate"],
  "estimatedDurationMinutes": 20
}
\`\`\`

Let me know if you want me to execute this.
`;

    const result = StructuredOutputValidator.validateZod(markdownText, PlanSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goal).toBe('Migrate database schema');
    }
  });

  it('detects schema violation and generates corrective retry prompt', () => {
    const invalidJson = JSON.stringify({
      goal: 'Fix bug',
      steps: [], // min(1) violation
      estimatedDurationMinutes: -5, // positive violation
    });

    const result = StructuredOutputValidator.validateZod(invalidJson, PlanSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('steps');
      expect(result.retryPrompt).toContain('expected schema');
    }
  });

  it('validates against StructuredOutputSchema JSON Schema definition', () => {
    const schemaDef = {
      name: 'file_edit_plan',
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['path', 'action'],
      },
    };

    const validContent = JSON.stringify({ path: 'src/index.ts', action: 'modify' });
    const successResult = StructuredOutputValidator.validateSchema(validContent, schemaDef);
    expect(successResult.success).toBe(true);

    const missingField = JSON.stringify({ path: 'src/index.ts' });
    const failResult = StructuredOutputValidator.validateSchema(missingField, schemaDef);
    expect(failResult.success).toBe(false);
    if (!failResult.success) {
      expect(failResult.error).toContain("Missing required property 'action'");
      expect(failResult.retryPrompt).toContain('required fields: path, action');
    }
  });
});
