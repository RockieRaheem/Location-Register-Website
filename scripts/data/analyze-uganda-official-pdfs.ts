import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const projectRoot = process.cwd();
const outputDirectory = path.join(projectRoot, 'data', 'sources', 'uganda', 'official-2024-2025');
const pdfDirectory = path.join(outputDirectory, 'pdf');
const documents = [
  { file: 'Local Goverment Electoral Areas for display.pdf', authority: 'Uganda Electoral Commission', edition: '2025', role: 'electoral-areas' },
  { file: 'Split by village Local Goverment Electoral Areas for display.pdf', authority: 'Uganda Electoral Commission', edition: '2025', role: 'village-electoral-areas' },
  { file: 'Press Release on the Display of Demarcated Local Govt Council Electoral Areas January 2025.pdf', authority: 'Uganda Electoral Commission', edition: '2025', role: 'provenance' },
  { file: 'Kigezi-Sub-Region-Census-2024-Report.pdf', authority: 'Uganda Bureau of Statistics', edition: '2024', role: 'census-validation' },
] as const;

fs.mkdirSync(outputDirectory, { recursive: true });
const manifest = [];
for (const document of documents) {
  const sourcePath = path.join(pdfDirectory, document.file);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing official document: ${document.file}`);
  const data = fs.readFileSync(sourcePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const textFile = `${path.parse(document.file).name}.txt`;
    fs.writeFileSync(path.join(outputDirectory, textFile), result.text.replace(/\r\n/g, '\n'), 'utf8');
    manifest.push({
      ...document,
      originalPath: `data/sources/uganda/official-2024-2025/pdf/${document.file}`,
      extractedTextPath: `data/sources/uganda/official-2024-2025/${textFile}`,
      bytes: data.length,
      pages: result.total,
      characters: result.text.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      extractedAt: new Date().toISOString(),
    });
  } finally {
    await parser.destroy();
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  warning: 'Extracted text is evidence input, not automatically published hierarchy data. Structural reconciliation and human review are required.',
  documents: manifest,
};
fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
