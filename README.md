# html-reporter

The HTML report of path coverage, shared by every port (Ruby, Python).
A port computes; this draws.

A port writes one data object per page, as `schema.json` has it, and
fills `page.html` with it. In the browser, `render.js` draws the page
from the data, then the page's other scripts run on what it drew.

## Writing a page

`pages.json` says how a port fills `page.html`:

- `{{style}}`: the text of `style.css`.
- `{{data}}`: the page's data as JSON, every `</` written `<\/`, so
  no string in it can close the script it is in.
- `{{script}}`: the texts of the page's scripts, in order: for the
  index, `render.js sort.js tabs.js settings.js theme.js`; for a file's
  page, `render.js side.js settings.js theme.js`.

Each page is one self-contained file, so it opens from `file://`.

## The data

`schema.json` is the contract. Its rule: any number a page shows that
is not a plain count, eg a percent, a card's paths not taken, is
computed by the port, so the page and the port's console never
disagree. Syntax colouring stays in each port, as only it can lex its
language: every fragment of code is `{text, tokens}`, each token
`[from, to, class]`, columns counting characters. A fold's rows come
laid out: the port gives each row's branch, label and cells.

`render.js` refuses data of another schema, so a stale copy of it in a
port fails loudly.

## Testing

`bin/test.sh` draws every sample under `samples/` and checks it has
the same title and `<main>` as the page its port wrote whole, once
every script has run. `samples/demo` is the Ruby gem's demo,
`samples/index` an index with groups and a file of no method paths,
and `samples/safe` a page with `&.` chains.

## Ports

Each port keeps a copy of these files in its own tree, so a gem or a
wheel needs nothing at install time.
