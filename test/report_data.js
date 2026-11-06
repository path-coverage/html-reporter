// For every sample under samples/ holding a run's two JSON files,
// path_coverage.json and path_coverage.source.json, writes its report
// with report.js into a temporary dir, and checks each page's data is
// the sample's X.data.json beside its X.html. Prints a line per page;
// exits non-zero if any page's data differs or is missing.

'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const SAMPLES = path.join(ROOT, 'samples')

// Every X.data.json file under dir, relative to it.
function datas(dir, rel = '') {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((entry) => {
    const own = path.join(rel, entry.name)
    if (entry.isDirectory()) return datas(dir, own)
    return entry.name.endsWith('.data.json') ? [own] : []
  })
}

// The data inline in the page at file, parsed; null for no page.
function pageData(file) {
  if (!fs.existsSync(file)) return null
  const found = fs.readFileSync(file, 'utf8').match(/window\.pathCoverage = (.*);\n/)
  return found && JSON.parse(found[1])
}

let failed = 0
const runs = fs.readdirSync(SAMPLES)
  .filter((name) => fs.existsSync(path.join(SAMPLES, name, 'path_coverage.source.json')))
for (const name of runs) {
  const sample = path.join(SAMPLES, name)
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `report-${name}-`))
  execFileSync('node', [path.join(ROOT, 'report.js'), sample, out])
  for (const data of datas(sample)) {
    const want = JSON.parse(fs.readFileSync(path.join(sample, data), 'utf8'))
    const got = pageData(path.join(out, data.replace(/\.data\.json$/, '.html')))
    const same = JSON.stringify(got) === JSON.stringify(want)
    if (!same) failed++
    console.log(`${same ? 'same' : 'DIFFERS'} ${name}/${data}`)
  }
}
console.log(`${failed} page(s) differ`)
process.exit(failed === 0 ? 0 : 1)
