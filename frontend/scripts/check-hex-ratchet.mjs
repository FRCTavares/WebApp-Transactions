// Ratchet for raw hex colours outside the primitives layer.
//
// Every dark-mode bug found during the design-system migration traced to a
// hardcoded hex colour that did not respond to the theme. Removing all 527 at
// once is a large effort; this stops the count from ever growing in the
// meantime, and forces the recorded baseline down as they are fixed - so the
// number can only ratchet toward zero.
//
// Fails when the count is ABOVE the baseline (a regression) or BELOW it (fixes
// landed - lower the committed baseline to lock them in).

import stylelint from 'stylelint'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const baselineFile = join(root, '.stylelint-hex-baseline.json')
const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')).maxHexColours

const { results } = await stylelint.lint({
  files: 'src/**/*.css',
  cwd: root,
})

let count = 0
const byFile = {}
for (const r of results) {
  const n = r.warnings.filter((w) => w.rule === 'color-no-hex').length
  if (n) { byFile[r.source.replace(root + '/', '')] = n; count += n }
}

const top = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 8)

if (count > baseline) {
  console.error(`\n✗ Raw hex colours: ${count}, up from the baseline of ${baseline}.`)
  console.error('  New raw hex was added. Use a semantic token (var(--color-*)) instead.')
  console.error('  Worst files:')
  for (const [f, n] of top) console.error(`     ${String(n).padStart(4)}  ${f}`)
  process.exit(1)
}

if (count < baseline) {
  console.error(`\n✗ Raw hex colours: ${count}, below the baseline of ${baseline}.`)
  console.error(`  Hex was tokenised - lock it in by setting maxHexColours to ${count}`)
  console.error(`  in .stylelint-hex-baseline.json.`)
  process.exit(1)
}

console.log(`✓ Raw hex colours: ${count}, at the baseline. No new hex added.`)
