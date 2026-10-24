// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const _root = fileURLToPath(new URL('../../../', import.meta.url));
const _sourceDirectory = resolve(_root, 'src');
const _configuration = ts.readConfigFile(resolve(_root, 'tsconfig.app.json'), ts.sys.readFile);
const _compilerOptions = ts.parseJsonConfigFileContent(_configuration.config, ts.sys, _root).options;
const _manager = resolve(_sourceDirectory, 'platform/browser/BrowserProcessManager.ts');
const _client = resolve(_sourceDirectory, 'platform/browser/BrowserEngineClient.ts');
function _dependencies(entry: string) {
  const visited = new Set<string>();
  const pending = [entry];
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      const target = ts.resolveModuleName(specifier.text, file, _compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
      if (target && resolve(target).startsWith(_sourceDirectory + sep)) pending.push(resolve(target));
    }
  }
  return visited;
}
describe('browser engine dependency boundary', () => {
  it('keeps sibling implementations independent, including type and barrel imports', () => {
    expect(_dependencies(_client)).not.toContain(_manager);
    expect(_dependencies(_manager)).not.toContain(_client);
  });
  it('keeps the Worker process independent of platform implementations', () => {
    const dependencies = _dependencies(resolve(_sourceDirectory, 'utility/BrowserWorkerProcess.ts'));
    expect([...dependencies].filter(file => file.startsWith(resolve(_sourceDirectory, 'platform') + sep))).toEqual([]);
  });
  it('keeps the base independent of concrete host implementations', () => {
    const dependencies = _dependencies(resolve(_sourceDirectory, 'platform/base/UciEngineClientBase.ts'));
    const hostDirectories = ['browser', 'nwjs'].map(host => resolve(_sourceDirectory, 'platform', host) + sep);
    expect([...dependencies].filter(file => hostDirectories.some(directory => file.startsWith(directory)))).toEqual([]);
  });
  it('allows composition to construct both implementations', () => {
    const dependencies = _dependencies(resolve(_sourceDirectory, 'platform/browser/BrowserPlatformService.ts'));
    expect(dependencies).toContain(_manager);
    expect(dependencies).toContain(_client);
  });
});
