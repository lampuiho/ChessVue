import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectSource } from './audit/InspectSource.mjs';
import { inspectStyles } from './audit/InspectStyles.mjs';

export function auditRepository(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'scripts/CodeAuditPolicy.json'), 'utf8'));
  const findings = [];
  const observed = new Map();
  function _inspect(filename) {
    const raw = fs.readFileSync(path.join(root, filename), 'utf8');
    const sourceFindings = filename.endsWith('.css') ? [] : inspectSource(filename, raw);
    for (const item of [...sourceFindings, ...inspectStyles(filename, raw)]) {
      const allowance = item.kind === 'observer' ? undefined : policy[item.kind]?.[item.key];
      const count = (observed.get(item.key) ?? 0) + 1;
      observed.set(item.key, count);
      if (!allowance?.trim() || count > 1) findings.push(item);
    }
  }
  function _walk(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const filename = directory ? directory + '/' + entry.name : entry.name;
      if (entry.isDirectory()) _walk(filename);
      else if (/\.(?:ts|vue|mjs|css)$/.test(entry.name)) _inspect(filename);
    }
  }
  for (const directory of ['src', 'journeys', 'e2e', 'scripts']) _walk(directory);
  for (const filename of fs.readdirSync(root).filter((name) => /config\.(?:ts|mjs)$/.test(name))) _inspect(filename);
  for (const [kind, exceptions] of Object.entries(policy)) for (const key of Object.keys(exceptions)) {
    if (!observed.has(key)) findings.push({ kind, key, file: 'scripts/CodeAuditPolicy.json', line: 1, message: 'Remove unused audit exception.' });
  }
  return findings;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = auditRepository();
  for (const finding of findings) console.error(`${finding.file}:${finding.line} ${finding.kind}: ${finding.message} [${finding.key}]`);
  if (findings.length) process.exitCode = 1;
  else console.log('Code audit passed: no observers, invalidation counters, redundant return annotations or component style blocks found.');
}
