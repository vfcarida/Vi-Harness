import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Locate parser file
const parserFile = fs.existsSync('./parser.js') ? './parser.js' : './index.js';
const module = await import(parserFile);
const parseMarkdown = module.parseMarkdown || module.default?.parseMarkdown || module.default;

assert.ok(typeof parseMarkdown === 'function', 'parseMarkdown must be a function export');

// Test 1: Headings
const h1 = parseMarkdown('# Main Title');
assert.ok(h1.includes('<h1>Main Title</h1>'), `Expected <h1>, got: ${h1}`);

const h2 = parseMarkdown('## Subtitle');
assert.ok(h2.includes('<h2>Subtitle</h2>'), `Expected <h2>, got: ${h2}`);

// Test 2: Unordered list
const list = parseMarkdown('- Apple\n- Banana');
assert.ok(list.includes('<li>Apple</li>'), `Expected <li>Apple</li>, got: ${list}`);
assert.ok(list.includes('<li>Banana</li>'), `Expected <li>Banana</li>, got: ${list}`);

// Test 3: Paragraph
const p = parseMarkdown('Just normal text');
assert.ok(p.includes('<p>Just normal text</p>'), `Expected <p>, got: ${p}`);

console.log('ALL CLI_MARKDOWN_PARSER TESTS PASSED (AC)');
