// For every page under samples/, a .data.json beside the .html written
// whole: fills page.html with the data, loads both pages in
// headless Chrome, and checks the drawn page has the same title and
// the same <main>, after every script has run, as the whole one.
// Prints a line per page, and the first difference of each that
// differs; exits 1 if any does.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const SAMPLES = path.join(ROOT, 'samples');
const OUT = process.env.OUT || '/tmp/drawn';

// The text of the reporter's file named name.
const asset = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

// The page drawn from data, as report.js writes it: page.html, its style
// the style sheet, its data the data, its script the page's scripts.
function shell(data) {
  const pages = JSON.parse(asset('pages.json'));
  const scripts = pages.scripts[data.page].map(asset).join('');
  const values = {
    style: asset(pages.style),
    data: JSON.stringify(data).replace(/<\//g, '<\\/'),
    script: scripts
  };
  return asset(pages.template).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
}

// Every .html under dir that has a .data.json beside it.
function pages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { return pages(full); }
    const data = full.replace(/\.html$/, '.data.json');
    return entry.name.endsWith('.html') && fs.existsSync(data) ? [full] : [];
  });
}

// The title and <main> of the page at file, once loaded.
async function drawn(browser, file) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + file);
  const got = await page.evaluate(() => ({
    title: document.title,
    main: document.querySelector('main').outerHTML
  }));
  await page.close();
  return { ...got, errors };
}

// Where a and b first differ, with some text around it.
function difference(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) { i += 1; }
  const from = Math.max(0, i - 120);
  return `at ${i}\n  whole: ${a.slice(from, i + 120)}\n  drawn: ${b.slice(from, i + 120)}`;
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  let failed = 0;
  for (const whole of pages(SAMPLES)) {
    const name = path.relative(SAMPLES, whole);
    const data = JSON.parse(fs.readFileSync(whole.replace(/\.html$/, '.data.json'), 'utf8'));
    const out = path.join(OUT, name);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, shell(data));
    const a = await drawn(browser, whole);
    const b = await drawn(browser, out);
    const problems = [];
    if (b.errors.length) { problems.push('errors: ' + b.errors.join('; ')); }
    if (a.title !== b.title) { problems.push(`title: ${a.title} vs ${b.title}`); }
    if (a.main !== b.main) { problems.push('main ' + difference(a.main, b.main)); }
    if (problems.length) {
      failed += 1;
      console.log(`DIFFERS ${name}\n  ${problems.join('\n  ')}`);
    } else {
      console.log(`same    ${name}`);
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
