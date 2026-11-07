// Rewrites every sample page under samples/ that has its X.data.json
// beside it as report.js's page() draws that data now, so each page
// embeds the current template, style and scripts. Prints each page
// rewritten.

'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SAMPLES = path.join(ROOT, 'samples')

const HELP = `Usage: node bin/refresh_samples.js [OPTIONS]

Rewrites each sample page under samples/ written whole, X.html with
its X.data.json beside it, from that data with report.js's page(),
so it embeds the current page.html, style.css and scripts. Run it
after changing any of those, then bin/test.sh.

Options:
  -h    Show this help

Example:
  node bin/refresh_samples.js`

// Every X.data.json file under dir, as a full path.
function datas(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const own = path.join(dir, entry.name)
    if (entry.isDirectory()) return datas(own)
    return entry.name.endsWith('.data.json') ? [own] : []
  })
}

// Rewrites each sample page that has its data beside it; returns
// the exit status.
function main(args) {
  if (args[0] === '-h') {
    console.log(HELP)
    return 0
  }
  const { page } = require(path.join(ROOT, 'report.js'))
  for (const data of datas(SAMPLES)) {
    const html = data.replace(/\.data\.json$/, '.html')
    if (!fs.existsSync(html)) continue
    fs.writeFileSync(html, page(JSON.parse(fs.readFileSync(data, 'utf8'))))
    console.log(path.relative(ROOT, html))
  }
  return 0
}

process.exit(main(process.argv.slice(2)))
