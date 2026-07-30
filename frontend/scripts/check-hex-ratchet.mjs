// Ratchet for raw hex colours outside the primitives layer.
//
// CSS has a historical baseline that can only move toward zero.
// TypeScript and TSX have no baseline: comments are ignored and every raw
// hexadecimal colour in source literals is rejected immediately.

import stylelint from 'stylelint'
import ts from 'typescript'
import {
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  dirname,
  extname,
  join,
  relative,
} from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const sourceRoot = join(root, 'src')
const baselineFile = join(root, '.stylelint-hex-baseline.json')
const baseline = JSON.parse(
  readFileSync(baselineFile, 'utf8'),
).maxHexColours
const hexPattern = /#[0-9a-fA-F]{3,8}\b/g

const { results } = await stylelint.lint({
  files: 'src/**/*.css',
  cwd: root,
})

let cssCount = 0
const cssByFile = {}

for (const result of results) {
  const filePath = result.source.replace(`${root}/`, '')
  const hexCount = result.warnings.filter(
    (warning) => warning.rule === 'color-no-hex',
  ).length

  if (hexCount > 0) {
    cssByFile[filePath] = hexCount
    cssCount += hexCount
  }
}

const worstCssFiles = Object.entries(cssByFile)
  .sort((first, second) => second[1] - first[1])
  .slice(0, 8)

if (cssCount > baseline) {
  console.error(
    `\n✗ Raw CSS hex colours: ${cssCount}, up from the baseline of ${baseline}.`,
  )
  console.error(
    '  New raw hex was added. Use a semantic token instead.',
  )
  console.error('  Worst files:')

  for (const [filePath, count] of worstCssFiles) {
    console.error(`     ${String(count).padStart(4)}  ${filePath}`)
  }

  process.exit(1)
}

if (cssCount < baseline) {
  console.error(
    `\n✗ Raw CSS hex colours: ${cssCount}, below the baseline of ${baseline}.`,
  )
  console.error(
    `  Hex was tokenised - set maxHexColours to ${cssCount}`,
  )
  console.error('  in .stylelint-hex-baseline.json.')
  process.exit(1)
}

function findTypeScriptFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory)) {
    const filePath = join(directory, entry)
    const stats = statSync(filePath)

    if (stats.isDirectory()) {
      files.push(...findTypeScriptFiles(filePath))
      continue
    }

    const extension = extname(filePath)

    if (extension === '.ts' || extension === '.tsx') {
      files.push(filePath)
    }
  }

  return files
}

const typeScriptMatches = []

function recordLiteralMatches(sourceFile, filePath, node) {
  const literalText = node.getText(sourceFile)
  const literalStart = node.getStart(sourceFile)

  for (const match of literalText.matchAll(hexPattern)) {
    const offset = literalStart + (match.index ?? 0)
    const position = sourceFile.getLineAndCharacterOfPosition(offset)

    typeScriptMatches.push({
      filePath: relative(root, filePath),
      line: position.line + 1,
      column: position.character + 1,
      value: match[0],
    })
  }
}

function inspectTypeScriptNode(sourceFile, filePath, node) {
  const isLiteral =
    ts.isStringLiteral(node)
    || ts.isNoSubstitutionTemplateLiteral(node)
    || node.kind === ts.SyntaxKind.TemplateHead
    || node.kind === ts.SyntaxKind.TemplateMiddle
    || node.kind === ts.SyntaxKind.TemplateTail
    || node.kind === ts.SyntaxKind.JsxText

  if (isLiteral) {
    recordLiteralMatches(sourceFile, filePath, node)
  }

  ts.forEachChild(
    node,
    (child) => inspectTypeScriptNode(sourceFile, filePath, child),
  )
}

for (const filePath of findTypeScriptFiles(sourceRoot)) {
  const sourceText = readFileSync(filePath, 'utf8')
  const scriptKind = extname(filePath) === '.tsx'
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )

  inspectTypeScriptNode(sourceFile, filePath, sourceFile)
}

if (typeScriptMatches.length > 0) {
  console.error(
    `\n✗ Raw TypeScript/TSX hex colours: ${typeScriptMatches.length}.`,
  )
  console.error(
    '  Use semantic CSS classes or var(--color-*) token references instead.',
  )

  for (const match of typeScriptMatches) {
    console.error(
      `     ${match.filePath}:${match.line}:${match.column} ${match.value}`,
    )
  }

  process.exit(1)
}

console.log(
  `✓ Raw CSS hex colours: ${cssCount}, at the baseline.`,
)
console.log(
  '✓ Raw TypeScript/TSX hex colours: 0.',
)
