import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

// Copilot CLI receives the prompt as a single argument, which Linux caps at 128 KiB.
const MAX_LOG_CHARS = 15_000;
const MAX_CONTEXT_CHARS = 60_000;

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

export function normalizeLog(rawLog: string): string {
  return (
    rawLog
      .replace(ANSI_PATTERN, '')
      // Windows Jest output uses backslashes; normalize so local runs match the Linux runner.
      .replace(/\bsrc\\[\w.\\/-]+/g, (match) => match.replace(/\\/g, '/'))
      // Passing suites are noise, and their paths must not pull unrelated files into the context.
      .split('\n')
      .filter((line) => !/^PASS\s/.test(line))
      .join('\n')
  );
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

function extractJson(raw: string): string {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  // Tolerate a sentence of prose around the object.
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  return start !== -1 && end > start ? unfenced.slice(start, end + 1) : unfenced;
}

export function parseAgentResponse(raw: string): AgentPatch {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error(`The agent's reply was not valid JSON. It began with: ${truncate(raw, 300)}`);
  }
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

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} must be set.`);
  }
  return value;
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
    `Generated by GitHub Copilot (\`${model}\`) from the failing Jest log.`,
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

interface LoadedContext {
  log: string;
  context: SourceFile[];
  editable: Set<string>;
}

// prepare and apply both rebuild the context from the same log, so the editable set matches.
function loadContext(root: string): LoadedContext {
  const log = normalizeLog(readFileSync(process.env.AUTO_HEAL_LOG ?? 'test-results.log', 'utf8'));
  const context = collectContext(log, root);
  const editable = new Set(context.map((file) => file.path).filter((file) => !isTestPath(file)));
  return { log, context, editable };
}

function prepare(root: string): void {
  const { log, context, editable } = loadContext(root);
  if (editable.size === 0) {
    console.log('The Jest log does not reference any application source file; nothing to fix.');
    setOutput('ready', 'false');
    return;
  }

  const outputDir = requiredEnv('AUTO_HEAL_DIR');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'system-prompt.txt'), SYSTEM_PROMPT);
  writeFileSync(path.join(outputDir, 'prompt.txt'), buildUserPrompt(log, context));
  console.log(`Context files: ${context.map((file) => file.path).join(', ')}`);
  setOutput('ready', 'true');
}

function apply(root: string): void {
  const { editable } = loadContext(root);
  const reply = readFileSync(requiredEnv('AUTO_HEAL_RESPONSE'), 'utf8');
  const patch = parseAgentResponse(reply);
  const result = applyPatch(patch, editable, root);
  writeSummary(process.env.AUTO_HEAL_MODEL ?? 'default model', patch, result);
  setOutput('changed', result.changed.length > 0 ? 'true' : 'false');
}

if (import.meta.main) {
  try {
    const mode = process.argv[2];
    if (mode === 'prepare') {
      prepare(process.cwd());
    } else if (mode === 'apply') {
      apply(process.cwd());
    } else {
      throw new Error('Usage: node scripts/auto-heal.mts <prepare|apply>');
    }
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
