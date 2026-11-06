# html-reporter

The HTML report of path coverage, shared by every port (Ruby, Python).
A port measures; this draws.

A port writes two JSON files and no HTML:

- `path_coverage.json`: the counts, as AIs and other tools read them.
- `path_coverage.source.json`: what drawing each file's code needs and
  only a parser of its language can work out: each line's text and
  coloured tokens, where each decision is, its fold's rows, and each card
  row's top coloured.

`report.js` reads the two and writes the report: `index.html`, and
`files/<path>.html` for each covered file. It needs no package, only
node. The image runs it:

```sh
docker run --rm -v "$PWD/coverage:/paths" ghcr.io/path-coverage/html-reporter /paths
```

Given a second dir, it writes the pages there instead.

## A page

Each page is `page.html` filled as `pages.json` says:

- `{{style}}`: the text of `style.css`.
- `{{data}}`: the page's data as JSON, every `</` written `<\/`, so
  no string in it can close the script it is in.
- `{{script}}`: the texts of the page's scripts, in order: for the
  index, `render.js sort.js tabs.js settings.js theme.js`; for a file's
  page, `render.js side.js settings.js theme.js`.

Each page is one self-contained file, so it opens from `file://`. In
the browser, `render.js` draws the page from its data, as `schema.json`
has it, then the page's other scripts run on what it drew. It refuses
data of another schema.

## Testing

`bin/test.sh`, in Docker, first writes the report of each sample run
under `samples/` holding the two JSON files, and checks each page's
data is the sample's `.data.json`: `samples/demo` is the Ruby gem's
demo, `samples/python-demo` the Python package's. Then it draws every
sample page written whole beside its `.data.json` and checks it has the
same title and `<main>`, once every script has run: `samples/index` is
an index with groups and a file of no method paths, `samples/safe` a
page with `&.` chains.

A push to main tests, then publishes the image, tagged `latest` and
with the commit.
