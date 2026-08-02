// Ratchet for raw rgb()/hsl() colour functions outside the token layer.
//
// Mirrors check-hex-ratchet.mjs: a historical baseline that can only move
// toward zero, never up. tokens/primitives.css, tokens/semantic.css and
// tokens/dark.css are exempt (see .stylelintrc.json overrides) because
// semantic.css and dark.css legitimately alpha-blend colours for translucent
// chrome - glass surfaces, scrims, shadow colours - documented inline where
// each token is defined. Every other stylesheet must reference one of those
// tokens instead of writing rgb()/hsl() directly.

import stylelint from 'stylelint'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const baselineFile = join(root, '.stylelint-color-function-baseline.json')
const baseline = JSON.parse(
  readFileSync(baselineFile, 'utf8'),
).maxColorFunctionUses

const { results } = await stylelint.lint({
  files: 'src/**/*.css',
  cwd: root,
})

let count = 0
const byFile = {}

for (const result of results) {
  const filePath = result.source.replace(`${root}/`, '')
  const matchCount = result.warnings.filter(
    (warning) => warning.rule === 'function-disallowed-list',
  ).length

  if (matchCount > 0) {
    byFile[filePath] = matchCount
    count += matchCount
  }
}

const worstFiles = Object.entries(byFile)
  .sort((first, second) => second[1] - first[1])
  .slice(0, 8)

if (count > baseline) {
  console.error(
    `\n✗ Raw CSS rgb()/hsl() colour functions: ${count}, up from the baseline of ${baseline}.`,
  )
  console.error(
    '  New raw rgb()/hsl() was added outside the token layer. Use a semantic token instead.',
  )
  console.error('  Worst files:')

  for (const [filePath, fileCount] of worstFiles) {
    console.error(`     ${String(fileCount).padStart(4)}  ${filePath}`)
  }

  process.exit(1)
}

if (count < baseline) {
  console.error(
    `\n✗ Raw CSS rgb()/hsl() colour functions: ${count}, below the baseline of ${baseline}.`,
  )
  console.error(
    `  Colour functions were tokenised - set maxColorFunctionUses to ${count}`,
  )
  console.error('  in .stylelint-color-function-baseline.json.')
  process.exit(1)
}

console.log(
  `✓ Raw CSS rgb()/hsl() colour functions: ${count}, at the baseline.`,
)
