#!/usr/bin/env node
// Writes the HTML report of a path coverage run from its two JSON
// files: path_coverage.json, the counts, and
// path_coverage.source.json, what drawing the code needs of each
// file's source. Every page is page.html with its data inline,
// drawn in the browser by render.js, so a port of path coverage to
// another language writes the two JSON files and nothing more.

'use strict'

const fs = require('fs')
const path = require('path')

const HELP = `Usage: report.js IN_DIR [OUT_DIR]

Reads IN_DIR/path_coverage.json and IN_DIR/path_coverage.source.json
and writes the HTML report into OUT_DIR, which defaults to IN_DIR:
index.html, and files/PATH.html for each covered file.

Options:
  -h    Show this help

Example:
  node report.js reports/paths`

// The version of schema.json the page data follows.
const SCHEMA = 1

// The text of one of the renderer's files, beside this one.
function asset(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8')
}

// The page drawing data: the template pages.json names, its style
// the style sheet, its data the data, and its script the scripts its
// kind of page runs.
function page(data) {
  const pages = JSON.parse(asset('pages.json'))
  const scripts = pages.scripts[data.page]
  return fill(asset(pages.template), {
    style: asset(pages.style),
    data: inline(data),
    script: scripts.map(asset).join('')
  })
}

// data as JSON to put inside a script, every </ written <\/ so no
// string in it can close the script.
function inline(data) {
  return JSON.stringify(data).replace(/<\//g, '<\\/')
}

// template with each {{name}} replaced by values[name].
function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`no value for {{${name}}}`)
    return values[name]
  })
}

// The file a decision or card is in: its name minus :line:column.
function fileOf(name) {
  return name.replace(/:\d+:\d+$/, '')
}

// [line, column] of a decision's or card's name.
function placeOf(name) {
  const [, line, column] = name.match(/:(\d+):(\d+)$/)
  return [Number(line), Number(column)]
}

// The percent of possible paths taken, rounded; null when none is
// possible.
function percent([taken, possible]) {
  return possible === 0 ? null : Math.round((100 * taken) / possible)
}

// [taken, possible] pairs added together.
function add(pairs) {
  return pairs.reduce(([t, p], [more, of]) => [t + more, p + of], [0, 0])
}

// The [taken, possible] paths of a card's rows: the paths taken,
// where known, and every path.
function cardPaths(card) {
  const rows = card.rows
  const taken = rows.reduce((sum, row) => sum + (row.taken ?? 0), 0)
  return [taken, rows.reduce((sum, row) => sum + row.paths, 0)]
}

// The index page's data: a table of every file with a decision, then one
// per group, and one of the files no group holds, if any.
function indexData(report, source) {
  const cards = Object.entries(report.cards || {})
  const byFile = new Map()
  for (const decision of Object.keys(report.paths || {})) {
    const file = fileOf(decision)
    byFile.set(file, (byFile.get(file) || 0) + 1)
  }
  const rows = [...byFile.keys()].sort().map((file) => {
    const own = cards.filter(([key]) => fileOf(key) === file)
    const combined = add(own.map(([, card]) => cardPaths(card)))
    return { path: file, decisions: byFile.get(file), combined }
  })
  const table = (name, own) => ({
    name,
    rows: own.map((row) => ({ path: row.path, ...totals(row) })),
    total: totals({
      decisions: own.reduce((sum, row) => sum + row.decisions, 0),
      combined: add(own.map((row) => row.combined))
    })
  })
  const tables = [table('All files', rows)]
  const groups = Object.entries(source.groups || {})
  if (groups.length > 0) {
    for (const [name, files] of groups) {
      tables.push(table(name, rows.filter((row) => files.includes(row.path))))
    }
    const grouped = new Set(groups.flatMap(([, files]) => files))
    const rest = rows.filter((row) => !grouped.has(row.path))
    if (rest.length > 0) tables.push(table('Ungrouped', rest))
  }
  return { schema: SCHEMA, page: 'index', tables, ignored: source.ignored }
}

// A row's decisions, its [taken, possible] paths combined, and their
// percent.
function totals(row) {
  return { decisions: row.decisions, combined: row.combined, percent: percent(row.combined) }
}

// True when an operand's counts leave it a gap: never evaluated, or,
// unless it can have one outcome only, never true or never false.
function operandGap(counts) {
  if (counts.truthy === 0 && counts.falsy === 0) return true
  if (counts.only) return false
  return counts.truthy === 0 || counts.falsy === 0
}

// { line => {status, span} } of each line a decision of the file covers,
// spans that overlap merged, a merged span gaps if any of its decisions
// has gaps.
function marks(decisions, operands) {
  const spans = Object.entries(decisions).map(([name, decision]) => {
    const gaps = (operands[name] || []).some(operandGap)
    return [decision.span, gaps ? 'gaps' : 'covered']
  })
  spans.sort((a, b) => a[0][0] - b[0][0])
  const blocks = []
  for (const [span, status] of spans) {
    const last = blocks[blocks.length - 1]
    if (last && last[0][1] >= span[0]) {
      last[0] = [last[0][0], Math.max(last[0][1], span[1])]
      if (status === 'gaps') last[1] = 'gaps'
    } else {
      blocks.push([[span[0], span[1]], status])
    }
  }
  const byLine = new Map()
  for (const [span, status] of blocks) {
    for (let line = span[0]; line <= span[1]; line++) {
      byLine.set(line, { status, span })
    }
  }
  return byLine
}

// The rows of a decision's fold, its columns the decision's paths, never taken
// first, its own row given each column's count.
function fold(decision, taken) {
  const order = taken
    .map((each, i) => [each.count === 0 ? 0 : 1, i])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([, i]) => i)
  return decision.fold.map((row, i) => {
    if (i === 0) return { ...row, counts: order.map((j) => taken[j].count) }
    if (!row.cells) return row
    return { ...row, cells: order.map((j) => row.cells[j]) }
  })
}

// covered when every row's taken is all of its paths and its method,
// if it is a method's, was called; gaps otherwise.
function status(card) {
  const done = card.rows.every((row) => row.taken === row.paths)
  return done && card.calls !== 0 ? 'covered' : 'gaps'
}

// The data of one card, as its file's page draws it.
function cardData(key, card, report, source, decisions) {
  const isTop = card.calls === null || card.calls === undefined
  const [first, column] = placeOf(key)
  const place = isTop
    ? { first: card.first, last: card.last, column: 0, status: status(card),
        top: true, decisions: card.rows.length }
    : { first, last: card.last, column, status: status(card),
        top: false, decisions: null }
  const [taken, size] = cardPaths(card)
  const title = {
    name: card.name === null || card.name === undefined ? '' : String(card.name),
    calls: card.calls, ways: card.ways, notTaken: size - taken, taken
  }
  const rows = card.rows.map((row) => ({
    at: row.at,
    decision: row.decision,
    top: source.labels[row.top],
    paths: row.paths,
    taken: row.taken,
    fold: row.decision ? fold(decisions[row.decision], report.paths[row.decision].taken) : null
  }))
  return { ...place, title, rows }
}

// The file page's data of the file at file.
function fileData(file, report, source) {
  const own = source.files[file]
  const byLine = marks(own.decisions, report.decisions || {})
  const lines = own.lines.map((line, i) => {
    const mark = byLine.get(i + 1)
    return {
      text: line.text,
      tokens: line.tokens,
      status: mark ? mark.status : null,
      span: mark ? mark.span : null
    }
  })
  const cards = Object.entries(report.cards || {})
    .filter(([key]) => fileOf(key) === file)
    .map(([key, card]) => cardData(key, card, report, source, own.decisions))
  return { schema: SCHEMA, page: 'file', path: file, lines, cards }
}

// Writes the report of the run in inDir into outDir.
function write(inDir, outDir) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(inDir, name), 'utf8'))
  const report = read('path_coverage.json')
  const source = read('path_coverage.source.json')
  fs.mkdirSync(outDir, { recursive: true })
  fs.rmSync(path.join(outDir, 'files'), { recursive: true, force: true })
  fs.writeFileSync(path.join(outDir, 'index.html'), page(indexData(report, source)))
  for (const file of Object.keys(source.files)) {
    const out = path.join(outDir, 'files', `${file}.html`)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, page(fileData(file, report, source)))
  }
}

// Runs as the command line says; returns the exit status.
function main(args) {
  if (args[0] === '-h') {
    console.log(HELP)
    return 0
  }
  if (args.length < 1 || args.length > 2) {
    console.error(HELP)
    return 2
  }
  write(args[0], args[1] || args[0])
  return 0
}

if (require.main === module) process.exit(main(process.argv.slice(2)))

module.exports = { indexData, fileData, page }
