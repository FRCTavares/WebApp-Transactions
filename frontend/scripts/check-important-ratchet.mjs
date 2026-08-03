// Ratchet for !important declarations in src/**/*.css.
//
// Mirrors check-hex-ratchet.mjs's up/down-mismatch-both-fail logic, but
// per file: this ratchet is already at its ceiling (see the "policy" field
// in .stylelint-important-baseline.json for the four narrow exceptions that
// remain legitimate going forward). Existing counts are grandfathered and
// must never increase; as files are cleaned up, lower their count in the
// baseline to match - this script fails on a mismatch in either direction
// so the baseline can't silently drift out of sync with reality.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const sourceRoot = join(root, 'src')
const baselineFile = join(root, '.stylelint-important-baseline.json')
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'))
const maxImportantByFile = baseline.maxImportantByFile
const importantPattern = /!important/g

function findCssFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory)) {
    const filePath = join(directory, entry)
    const stats = statSync(filePath)

    if (stats.isDirectory()) {
      files.push(...findCssFiles(filePath))
      continue
    }

    if (extname(filePath) === '.css') {
      files.push(filePath)
    }
  }

  return files
}

const actualByFile = {}
let actualTotal = 0

for (const filePath of findCssFiles(sourceRoot)) {
  const relativePath = relative(root, filePath)
  const sourceText = readFileSync(filePath, 'utf8')
  const matches = sourceText.match(importantPattern)
  const count = matches ? matches.length : 0

  if (count > 0) {
    actualByFile[relativePath] = count
    actualTotal += count
  }
}

const allFiles = new Set([
  ...Object.keys(actualByFile),
  ...Object.keys(maxImportantByFile),
])

const increased = []
const decreased = []

for (const filePath of allFiles) {
  const actual = actualByFile[filePath] ?? 0
  const max = maxImportantByFile[filePath] ?? 0

  if (actual > max) {
    increased.push({ filePath, actual, max })
  } else if (actual < max) {
    decreased.push({ filePath, actual, max })
  }
}

if (increased.length > 0) {
  console.error(
    `\n✗ !important count increased in ${increased.length} file(s).`,
  )
  console.error(
    '  New !important was added. The ratchet is at its ceiling - fix specificity',
  )
  console.error(
    '  instead (see the "policy" field in .stylelint-important-baseline.json for',
  )
  console.error('  the four narrow exceptions that remain permitted).')

  for (const { filePath, actual, max } of increased) {
    console.error(`     ${filePath}: ${actual}, up from baseline of ${max}`)
  }

  process.exit(1)
}

if (decreased.length > 0) {
  console.error(
    `\n✗ !important count decreased in ${decreased.length} file(s).`,
  )
  console.error(
    '  Nice work cleaning these up - update maxImportantByFile in',
  )
  console.error('  .stylelint-important-baseline.json to match:')

  for (const { filePath, actual, max } of decreased) {
    console.error(`     ${filePath}: ${actual}, below baseline of ${max}`)
  }

  process.exit(1)
}

console.log(
  `✓ !important declarations: ${actualTotal}, at the baseline (grandfathered ceiling, no new uses permitted).`,
)
