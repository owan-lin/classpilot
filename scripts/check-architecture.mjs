import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const root = resolve('src')
const files = []
function walk(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name)
    if (item.isDirectory()) walk(path)
    else if (/\.(ts|tsx)$/.test(path) && !/\.(test|spec)\./.test(path)) files.push(path)
  }
}
walk(root)
const graph = new Map()
const errors = []
const layer = (path) => relative(root, path).replaceAll('\\', '/').split('/')[0]
for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const edges = []
  function visit(node) {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        ? node.arguments[0] : undefined
    if (specifier && ts.isStringLiteral(specifier)) {
      const name = specifier.text
      if (name.startsWith('.')) {
        const base = resolve(dirname(file), name)
        const target = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
          .find((path) => existsSync(path) && statSync(path).isFile())
        if (target && /\.(ts|tsx)$/.test(target)) {
          edges.push(target)
          const from = layer(file), to = layer(target)
          const forbidden = (from === 'domain' && to !== 'domain') ||
            (from === 'data' && !['data', 'domain'].includes(to)) ||
            (['features', 'ui'].includes(from) && ['data', 'app', 'App.tsx'].includes(to))
          if (forbidden) errors.push(`${relative(root, file)} may not depend on ${relative(root, target)}`)
        }
      } else if (layer(file) === 'domain') errors.push(`Domain must be dependency-free: ${relative(root, file)} imports ${name}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  graph.set(file, edges)
}
const visited = new Set(), active = new Set()
function checkCycle(file, chain = []) {
  if (active.has(file)) { errors.push(`Dependency cycle: ${[...chain, file].map(p => relative(root, p)).join(' -> ')}`); return }
  if (visited.has(file)) return
  active.add(file)
  for (const target of graph.get(file) ?? []) checkCycle(target, [...chain, file])
  active.delete(file)
  visited.add(file)
}
for (const file of files) checkCycle(file)
if (errors.length) throw new Error(errors.join('\n'))
console.log(`Architecture boundaries and dependency cycles checked across ${files.length} modules.`)
