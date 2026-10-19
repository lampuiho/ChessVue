import ts from 'typescript';
const observers = new Set(['watch', 'watchEffect', 'watchPostEffect', 'watchSyncEffect', '$watch', '$subscribe']);
const compact = (value) => value.replace(/\s/g, '');
function scriptText(file, raw) {
  if (!file.endsWith('.vue')) return raw;
  const characters = raw.split('').map((character) => character === '\n' ? '\n' : ' ');
  for (const match of raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const start = match.index + match[0].indexOf('>') + 1;
    characters.splice(start, match[1].length, ...match[1].split(''));
  }
  return characters.join('');
}
function imports(source) {
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
function observerName(expression, bindings) {
  if (ts.isIdentifier(expression)) return bindings.aliases.get(expression.text) ?? (observers.has(expression.text) ? expression.text : undefined);
  const member = ts.isPropertyAccessExpression(expression) ? expression.name.text
    : ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression) ? expression.argumentExpression.text : undefined;
  if (!member || !observers.has(member)) return;
  if (member.startsWith('$') || bindings.namespaces.has(expression.expression.getText())) return member;
}
function contains(node, predicate) {
  if (predicate(node)) return true;
  return !!ts.forEachChild(node, (child) => contains(child, predicate) || undefined);
}
function enclosingFunction(node) {
  let current = node.parent;
  while (current && !ts.isFunctionLike(current)) current = current.parent;
  return current;
}
function counterOrigin(initialiser) {
  if (!initialiser) return;
  if (ts.isIdentifier(initialiser)) return initialiser.text;
  if (ts.isPrefixUnaryExpression(initialiser) || ts.isPostfixUnaryExpression(initialiser)) return initialiser.operand.getText();
}
function mutationName(node) {
  if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) return node.operand.getText();
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken].includes(node.operatorToken.kind)) return node.left.getText();
}
function isCapturedCounter(node, mutations) {
  const origin = counterOrigin(node.initializer);
  const owner = enclosingFunction(node);
  if (!origin || !mutations.has(origin) || !owner || !ts.isIdentifier(node.name)) return false;
  const name = node.name.text;
  const compares = (candidate) => ts.isBinaryExpression(candidate)
    && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(candidate.operatorToken.kind)
    && [[name, origin], [origin, name]].some(([left, right]) => candidate.left.getText() === left && candidate.right.getText() === right);
  return contains(owner, ts.isAwaitExpression) && contains(owner, compares);
}
export function inspectSource(file, raw) {
  const source = ts.createSourceFile(file + '.ts', scriptText(file, raw), ts.ScriptTarget.Latest, true);
  const bindings = imports(source);
  const findings = [];
  const mutations = new Set();
  function collect(node) {
    const name = mutationName(node);
    if (name) mutations.add(name);
    ts.forEachChild(node, collect);
  }
  collect(source);
  function add(node, kind, key, message) {
    findings.push({ kind, key: file + ':' + key, file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message });
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = observerName(node.expression, bindings);
      if (observers.has(name)) add(node, 'observer', name + '(' + compact(node.arguments[0]?.getText(source) ?? '') + ')', 'Observer needs a justified boundary exception.');
    }
    if (ts.isFunctionLike(node) && node.body && node.type && ['void', 'Promise<void>'].includes(compact(node.type.getText(source)))) {
      add(node, 'return', node.name?.getText(source) ?? '(callback)', 'Infer the implementation return type or document its required constraint.');
    }
    if ((ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) && (/generation|epoch|(?:request|operation|playback|detail)(?:Version|Token|Sequence)/i.test(node.name.getText(source)) || isCapturedCounter(node, mutations))) {
      add(node, 'counter', node.name.getText(source), 'Review and remove generation-based async invalidation.');
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}
