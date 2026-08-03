// Ratchet for raw literal spacing/radius declarations in src/**/*.css.
//
// Mirrors check-important-ratchet.mjs's up/down-mismatch-both-fail logic:
// this ratchet is already at its ceiling. The project has a --space-* and
// --radius-* token scale (src/styles/tokens/primitives.css) but the vast
// majority of padding/margin/gap/border-radius declarations across the
// codebase predate it and still use raw literals (px/rem/%/clamp()/calc()
// etc). Rounding those to the nearest token step can visibly shift a real
// shipped layout, so this script does NOT migrate anything - it only stops
// the count from growing while a future, separate, screenshot-reviewed
// effort migrates the debt down incrementally. Lower a file's count in the
// baseline as it gets cleaned up; this script fails on a mismatch in either
// direction so the baseline can't silently drift out of sync with reality.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const sourceRoot = join(root, 'src')
const baselineFile = join(root, '.stylelint-spacing-baseline.json')
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'))
const maxSpacingByFile = baseline.maxSpacingByFile

const excludedFiles = new Set([
  'src/styles/tokens/primitives.css',
  'src/styles/tokens/semantic.css',
  'src/styles/tokens/dark.css',
])

// Matches padding/margin (and their -top/-right/-bottom/-left/-inline/
// -inline-start/-inline-end/-block/-block-start/-block-end longhands),
// gap/row-gap/column-gap, and border-radius (and its four physical and
// four logical corner longhands), capturing the declaration's value up to
// the terminating `;`. The negative lookbehind keeps this from matching
// inside a custom property name like `--gap-value` or `--padding-inline`.
const declarationPattern =
  /(?<![\w-])(?:padding|margin)(?:-inline-start|-inline-end|-block-start|-block-end|-inline|-block|-top|-right|-bottom|-left)?\s*:\s*([^;{}]+);|(?<![\w-])(?:row-gap|column-gap|gap)\s*:\s*([^;{}]+);|(?<![\w-])(?:border-radius|border-(?:top|bottom)-(?:left|right)-radius|border-(?:start|end)-(?:start|end)-radius)\s*:\s*([^;{}]+);/g

// A value is compliant only if every numeric magnitude in it ultimately
// comes from a var(--space-*) or var(--radius-*) reference. Strip every
// balanced var(--space-...)/var(--radius-...) call (handling a fallback
// argument that may itself contain nested parens) and check whether any
// nonzero numeric magnitude remains - covering bare literals (12px,
// 0.5rem, 999px), unit-less zero and keywords (compliant), and literals
// still present inside calc()/clamp() alongside a token reference.
function stripSpaceAndRadiusVars(value) {
  let result = ''
  let index = 0

  while (index < value.length) {
    const varStart = value.indexOf('var(', index)

    if (varStart === -1) {
      result += value.slice(index)
      break
    }

    const argStart = varStart + 4
    const isSpaceOrRadiusVar = /^\s*--(space|radius)-/.test(
      value.slice(argStart),
    )

    let depth = 1
    let cursor = argStart

    while (cursor < value.length && depth > 0) {
      if (value[cursor] === '(') depth += 1
      else if (value[cursor] === ')') depth -= 1
      cursor += 1
    }

    result += value.slice(index, varStart)

    if (!isSpaceOrRadiusVar) {
      result += value.slice(varStart, cursor)
    }

    index = cursor
  }

  return result
}

function isCompliantValue(rawValue) {
  const value = rawValue.replace(/!important/g, '').trim()
  const stripped = stripSpaceAndRadiusVars(value)
  const magnitudePattern = /-?\d*\.?\d+(?:[a-zA-Z%]+)?/g
  let match

  while ((match = magnitudePattern.exec(stripped)) !== null) {
    const numeric = Number.parseFloat(match[0])

    if (numeric !== 0) {
      return false
    }
  }

  return true
}

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

  if (excludedFiles.has(relativePath)) {
    continue
  }

  const sourceText = readFileSync(filePath, 'utf8')
  let count = 0
  let match

  declarationPattern.lastIndex = 0

  while ((match = declarationPattern.exec(sourceText)) !== null) {
    const value = match[1] ?? match[2] ?? match[3]

    if (!isCompliantValue(value)) {
      count += 1
    }
  }

  if (count > 0) {
    actualByFile[relativePath] = count
    actualTotal += count
  }
}

const allFiles = new Set([
  ...Object.keys(actualByFile),
  ...Object.keys(maxSpacingByFile),
])

const increased = []
const decreased = []

for (const filePath of allFiles) {
  const actual = actualByFile[filePath] ?? 0
  const max = maxSpacingByFile[filePath] ?? 0

  if (actual > max) {
    increased.push({ filePath, actual, max })
  } else if (actual < max) {
    decreased.push({ filePath, actual, max })
  }
}

const worstFiles = Object.entries(actualByFile)
  .sort((first, second) => second[1] - first[1])
  .slice(0, 8)

if (increased.length > 0) {
  console.error(
    `\n✗ Raw literal spacing/radius declarations increased in ${increased.length} file(s).`,
  )
  console.error(
    '  A new padding/margin/gap/border-radius declaration used a raw literal',
  )
  console.error(
    '  instead of a var(--space-*)/var(--radius-*) token. The ratchet is at',
  )
  console.error(
    '  its ceiling - use a token instead (see the "policy" field in',
  )
  console.error('  .stylelint-spacing-baseline.json).')

  for (const { filePath, actual, max } of increased) {
    console.error(`     ${filePath}: ${actual}, up from baseline of ${max}`)
  }

  console.error('\n  Worst files overall:')

  for (const [filePath, count] of worstFiles) {
    console.error(`     ${String(count).padStart(4)}  ${filePath}`)
  }

  process.exit(1)
}

if (decreased.length > 0) {
  console.error(
    `\n✗ Raw literal spacing/radius declarations decreased in ${decreased.length} file(s).`,
  )
  console.error(
    '  Nice work tokenising these - update maxSpacingByFile in',
  )
  console.error('  .stylelint-spacing-baseline.json to match:')

  for (const { filePath, actual, max } of decreased) {
    console.error(`     ${filePath}: ${actual}, below baseline of ${max}`)
  }

  process.exit(1)
}

console.log(
  `✓ Raw literal spacing/radius declarations: ${actualTotal}, at the baseline (grandfathered ceiling, no new uses permitted).`,
)
