# CLI Markdown Parser Specification

Create a module in `parser.js` (or `index.js`) that exports a `parseMarkdown(markdown: string)` function.

## Requirements:
1. Parse `# Heading 1` to `<h1>Heading 1</h1>`
2. Parse `## Heading 2` to `<h2>Heading 2</h2>`
3. Parse `### Heading 3` to `<h3>Heading 3</h3>`
4. Parse unordered list lines starting with `- item` into `<ul><li>item</li></ul>` blocks.
5. Non-heading, non-list lines are wrapped in `<p>text</p>`.

## Example:
```javascript
import { parseMarkdown } from './parser.js';

const html = parseMarkdown('# Hello\n- Item 1\n- Item 2\nParagraph');
```
Output:
`<h1>Hello</h1>\n<ul><li>Item 1</li><li>Item 2</li></ul>\n<p>Paragraph</p>`
