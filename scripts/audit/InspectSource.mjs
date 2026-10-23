import ts from 'typescript';
const observers = new Set(['watch', 'watchEffect', 'watchPostEffect', 'watchSyncEffect', '$watch', '$subscribe']);
const _compact = (value) => value.replace(/\s/g, '');
function _scriptText(file, raw) {
  if (!file.endsWith('.vue')) return raw;
  const characters = raw.split('').map((character) => character === '\n' ? '\n' : ' ');
  for (const match of raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const start = match.index + match[0].indexOf('>') + 1;
    characters.splice(start, match[1].length, ...match[1].split(''));
  }
  return characters.join('');
}
function _imports(source) {
  const aliases = new Map();
  const namespaces = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'vue') continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) for (const entry of bindings.elements) aliases.set(entry.name.text, entry.propertyName?.text ?? entry.name.text);
  }
  return { aliases, namespaces };
}
function _observerName(expression, bindings) {
  if (ts.isIdentifier(expression)) return bindings.aliases.get(expression.text) ?? (observers.has(expression.text) ? expression.text : undefined);
  const member = ts.isPropertyAccessExpression(expression) ? expression.name.text
    : ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression) ? expression.argumentExpression.text : undefined;
  if (!member || !observers.has(member)) return;
  if (member.startsWith('$') || bindings.namespaces.has(expression.expression.getText())) return member;
}
function _contains(node, predicate) {
  if (predicate(node)) return true;
  return !!ts.forEachChild(node, (child) => _contains(child, predicate) || undefined);
}
function _enclosingFunction(node) {
  let current = node.parent;
  while (current && !ts.isFunctionLike(current)) current = current.parent;
  return current;
}
function _counterOrigin(initialiser) {
  if (!initialiser) return;
  if (ts.isIdentifier(initialiser)) return initialiser.text;
  if (ts.isPrefixUnaryExpression(initialiser) || ts.isPostfixUnaryExpression(initialiser)) return initialiser.operand.getText();
}
function _mutationName(node) {
  if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) return node.operand.getText();
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(node.operatorToken.kind)) return node.left.getText();
}
function _isCapturedCounter(node, mutations) {
  const origin = _counterOrigin(node.initializer);
  const owner = _enclosingFunction(node);
  if (!origin || !mutations.has(origin) || !owner || !ts.isIdentifier(node.name)) return false;
  const name = node.name.text;
  const _compares = (candidate) => ts.isBinaryExpression(candidate)
    && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(candidate.operatorToken.kind)
    && [[name, origin], [origin, name]].some(([left, right]) => candidate.left.getText() === left && candidate.right.getText() === right);
  return _contains(owner, ts.isAwaitExpression) && _contains(owner, _compares);
}
export function inspectSource(file, raw) {
  const source = ts.createSourceFile(file + '.ts', _scriptText(file, raw), ts.ScriptTarget.Latest, true);
  const bindings = _imports(source);
  const findings = [];
  const mutations = new Set();
  function _collect(node) {
    const name = _mutationName(node);
    if (name) mutations.add(name);
    ts.forEachChild(node, _collect);
  }
  _collect(source);
  function _add(node, kind, key, message) {
    findings.push({ kind, key: file + ':' + key, file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message });
  }
  function _visit(node) {
    if (ts.isCallExpression(node)) {
      const name = _observerName(node.expression, bindings);
      if (observers.has(name)) _add(node, 'observer', name + '(' + _compact(node.arguments[0]?.getText(source) ?? '') + ')', 'Use explicit actions, component events or lifecycle hooks instead of observers.');
    }
    if (ts.isFunctionLike(node) && node.body && node.type && ['void', 'Promise<void>'].includes(_compact(node.type.getText(source)))) {
      _add(node, 'return', node.name?.getText(source) ?? '(callback)', 'Infer the implementation return type or document its required constraint.');
    }
    if ((ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) && (/generation|epoch|(?:request|operation|playback|detail)(?:Version|Token|Sequence)/i.test(node.name.getText(source)) || _isCapturedCounter(node, mutations))) {
      _add(node, 'counter', node.name.getText(source), 'Review and remove generation-based async invalidation.');
    }
    ts.forEachChild(node, _visit);
  }
  _visit(source);
  return findings;
}
