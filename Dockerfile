FROM node:22.12.0-alpine
LABEL org.opencontainers.image.source=https://github.com/path-coverage/html-reporter

COPY report.js pages.json page.html style.css \
     render.js side.js sort.js tabs.js settings.js theme.js \
     /reporter/

ENTRYPOINT ["node", "/reporter/report.js"]
