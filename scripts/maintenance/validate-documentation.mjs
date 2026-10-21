import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const documents = [
  'README.md',
  'data/README.md',
  'scripts/README.md',
  'references/README.md',
  'references/local-imports/README.md',
];

function collectMarkdown(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(root, fullPath).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      if (relativePath === 'docs/audits') continue;
      collectMarkdown(fullPath);
    } else if (entry.name.endsWith('.md')) {
      documents.push(relativePath);
    }
  }
}

collectMarkdown(path.join(root, 'docs'));
const failures = [];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

for (const relativeDocument of documents) {
  const absoluteDocument = path.join(root, relativeDocument);
  if (!fs.existsSync(absoluteDocument)) {
    failures.push(`${relativeDocument}: document is missing`);
    continue;
  }
  const source = fs.readFileSync(absoluteDocument, 'utf8');
  for (const match of source.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '');
    if (!rawTarget || /^(https?:|mailto:|#)/i.test(rawTarget)) continue;
    const fileTarget = decodeURIComponent(rawTarget.split('#')[0]);
    if (!fileTarget) continue;
    const resolved = path.resolve(path.dirname(absoluteDocument), fileTarget);
    if (!fs.existsSync(resolved)) failures.push(`${relativeDocument}: broken link ${rawTarget}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Documentation links valid across ${documents.length} maintained Markdown files.`);
