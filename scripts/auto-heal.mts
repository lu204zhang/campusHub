import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface SourceFile {
  path: string;
  content: string;
}

interface AgentPatch {
  summary: string;
  files: SourceFile[];
}

interface ApplyResult {
  changed: string[];
  rejected: string[];
}

const ENDPOINT = 'https://models.github.ai/inference/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4.1';
// Keeps the request inside GitHub Models' free-tier input limit (~8k tokens).
const MAX_LOG_CHARS = 6_000;
const MAX_CONTEXT_CHARS = 16_000;

const INSTRUCTION =
  'Parse the attached Jest failure log. Locate the source code causing the failure in src/ and generate a patch that fixes the bug without breaking existing tests.';

const SYSTEM_PROMPT = [
  'You are a senior TypeScript engineer repairing a failing CI run for a multi-tenant Express + Mongoose backend.',
  INSTRUCTION,
  'Rules:',
  '- Only edit the application files under src/ that are provided. Never edit test files (__tests__/, *.test.ts, src/test/); the tests define the expected behavior.',
  '- Make the smallest change that fixes the root cause.',
  '- Keep strict TypeScript: no `any`, no @ts-ignore, no eslint-disable comments, no unsafe casts.',
  '- Keep every database query scoped by tenantId.',
  'Respond with one JSON object and nothing else, in this shape:',
  '{"summary": "<root cause and fix in a short paragraph>", "files": [{"path": "src/...", "content": "<complete new file content>"}]}',
  'Return "files": [] if the failure cannot be fixed by changing application code.',
].join('\n');

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

function truncate(text: string, max: number): string {
  return text.length <= max
    ? text
    : `${text.slice(0, max)}\n... [truncated ${text.length - max} characters]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSource(root: string, file: string): string {
  return readFileSync(path.join(root, file), 'utf8');
}

export function isTestPath(file: string): boolean {
  return file.includes('/__tests__/') || file.endsWith('.test.ts') || file.startsWith('src/test/');
}

export function findReferencedFiles(log: string, root: string): string[] {
  const matches = log.match(/\bsrc\/[\w./-]+\.ts\b/g) ?? [];
  return [...new Set(matches)].filter((file) => existsSync(path.join(root, file)));
}

export function findRelativeImports(file: string, content: string, root: string): string[] {
  const imports: string[] = [];
  for (const match of content.matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)) {
    const specifier = match[1];
    if (specifier === undefined) {
      continue;
    }
    const base = path.posix.join(path.posix.dirname(file), specifier);
    const resolved = [`${base}.ts`, `${base}/index.ts`].find((candidate) =>
      existsSync(path.join(root, candidate)),
    );
    if (resolved !== undefined) {
      imports.push(resolved);
    }
  }
  return imports;
}

function stem(file: string): string {
  return path.posix.basename(file).replace(/(\.test)?\.ts$/, '');
}

export function collectContext(log: string, root: string): SourceFile[] {
  const referenced = findReferencedFiles(log, root);
  const testFiles = referenced.filter(isTestPath);
  const testStems = new Set(testFiles.map(stem));
  const importedSources = testFiles
    .flatMap((file) => findRelativeImports(file, readSource(root, file), root))
    .filter((file) => !isTestPath(file))
    // The module a test file is named after is the most likely culprit, so it goes first.
    .sort((a, b) => Number(testStems.has(stem(b))) - Number(testStems.has(stem(a))));

  const ordered = [
    ...new Set([
      ...referenced.filter((file) => !isTestPath(file)),
      ...importedSources,
      ...testFiles,
    ]),
  ];

  const context: SourceFile[] = [];
  let size = 0;
  for (const file of ordered) {
    const content = readSource(root, file);
    if (size + content.length > MAX_CONTEXT_CHARS) {
      continue;
    }
    context.push({ path: file, content });
    size += content.length;
  }
  return context;
}

export function buildUserPrompt(log: string, context: readonly SourceFile[]): string {
  const files = context
    .map((file) => `### ${file.path}\n\`\`\`ts\n${file.content}\n\`\`\``)
    .join('\n\n');
  return `## Jest failure log\n\`\`\`\n${truncate(log, MAX_LOG_CHARS)}\n\`\`\`\n\n## Source files\n${files}`;
}

export function parseAgentResponse(raw: string): AgentPatch {
  const jsonText = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed: unknown = JSON.parse(jsonText);
  if (!isRecord(parsed) || typeof parsed.summary !== 'string' || !Array.isArray(parsed.files)) {
    throw new Error('Agent response must be a JSON object with "summary" and "files".');
  }

  const entries: unknown[] = parsed.files;
  const files = entries.map((entry): SourceFile => {
    if (!isRecord(entry) || typeof entry.path !== 'string' || typeof entry.content !== 'string') {
      throw new Error('Each entry in "files" must have string "path" and "content".');
    }
    return { path: entry.path, content: entry.content };
  });

  return { summary: parsed.summary, files };
}

export function applyPatch(
  patch: AgentPatch,
  editable: ReadonlySet<string>,
  root: string,
): ApplyResult {
  const result: ApplyResult = { changed: [], rejected: [] };
  for (const file of patch.files) {
    const normalized = path.posix.normalize(file.path);
    // Model output is untrusted: only overwrite application files that were sent as context.
    if (!editable.has(normalized) || isTestPath(normalized)) {
      result.rejected.push(file.path);
      continue;
    }
    if (readSource(root, normalized) === file.content) {
      continue;
    }
    writeFileSync(path.join(root, normalized), file.content);
    result.changed.push(normalized);
  }
  return result;
}

async function requestPatch(token: string, model: string, userPrompt: string): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(
      `GitHub Models request failed (${response.status}): ${truncate(bodyText, 500)}`,
    );
  }

  const parsed: unknown = JSON.parse(bodyText);
  const choices: unknown[] =
    isRecord(parsed) && Array.isArray(parsed.choices) ? parsed.choices : [];
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message) || typeof first.message.content !== 'string') {
    throw new Error('GitHub Models response did not contain a message.');
  }
  return first.message.content;
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile !== undefined) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

function writeSummary(model: string, patch: AgentPatch, result: ApplyResult): void {
  const lines = [
    '## Auto-heal summary',
    '',
    `Generated by \`${model}\` via GitHub Models from the failing Jest log.`,
    '',
    patch.summary,
    '',
    '### Files changed',
    ...result.changed.map((file) => `- \`${file}\``),
  ];
  if (result.rejected.length > 0) {
    lines.push('', '### Edits rejected (outside the allowed files)');
    lines.push(...result.rejected.map((file) => `- \`${file}\``));
  }
  const summary = lines.join('\n');
  console.log(summary);

  const summaryFile = process.env.AUTO_HEAL_SUMMARY;
  if (summaryFile !== undefined) {
    writeFileSync(summaryFile, `${summary}\n`);
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const log = stripAnsi(readFileSync(process.env.AUTO_HEAL_LOG ?? 'test-results.log', 'utf8'));
  const context = collectContext(log, root);
  const editable = new Set(context.map((file) => file.path).filter((file) => !isTestPath(file)));

  if (editable.size === 0) {
    console.log('The Jest log does not reference any application source file; nothing to fix.');
    setOutput('changed', 'false');
    return;
  }

  console.log(`Context files: ${context.map((file) => file.path).join(', ')}`);
  const userPrompt = buildUserPrompt(log, context);

  if (process.env.AUTO_HEAL_DRY_RUN === 'true') {
    console.log(`${SYSTEM_PROMPT}\n\n${userPrompt}`);
    setOutput('changed', 'false');
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (token === undefined || token.length === 0) {
    throw new Error('GITHUB_TOKEN is required to call GitHub Models.');
  }
  const model = process.env.AUTO_HEAL_MODEL ?? DEFAULT_MODEL;

  const patch = parseAgentResponse(await requestPatch(token, model, userPrompt));
  const result = applyPatch(patch, editable, root);
  writeSummary(model, patch, result);
  setOutput('changed', result.changed.length > 0 ? 'true' : 'false');
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
