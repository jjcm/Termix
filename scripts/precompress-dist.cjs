#!/usr/bin/env node
/**
 * Pre-generates .gz and .br siblings for the compressible static files in
 * dist/ so nginx's gzip_static/brotli_static modules can serve them without
 * recompressing on every request. Runs as part of `npm run build`, after
 * `vite build`.
 *
 * Uses only Node's built-in zlib (gzip level 9, brotli quality 11), so it
 * adds no dependencies. Files that don't shrink are skipped.
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DIST = path.join(__dirname, "..", "dist");
const COMPRESSIBLE = new Set([
  ".js",
  ".mjs",
  ".css",
  ".html",
  ".svg",
  ".json",
  ".txt",
  ".xml",
  ".wasm",
  ".ttf",
  ".otf",
  ".eot",
  ".map",
  ".webmanifest",
]);
const MIN_BYTES = 1024;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

if (!fs.existsSync(DIST)) {
  console.error(`precompress-dist: ${DIST} does not exist, run vite build first`);
  process.exit(1);
}

// The backend build output lives in dist/backend and is executed by Node, not
// served over HTTP -- compressing it would be wasted work.
const SKIP_DIRS = new Set([path.join(DIST, "backend")]);

let files = 0;
let rawTotal = 0;
let gzTotal = 0;
let brTotal = 0;

for (const file of walk(DIST)) {
  if ([...SKIP_DIRS].some((d) => file.startsWith(d + path.sep))) continue;
  const ext = path.extname(file).toLowerCase();
  if (!COMPRESSIBLE.has(ext)) continue;
  if (file.endsWith(".gz") || file.endsWith(".br")) continue;

  const raw = fs.readFileSync(file);
  if (raw.length < MIN_BYTES) continue;

  const gz = zlib.gzipSync(raw, { level: zlib.constants.Z_BEST_COMPRESSION });
  const br = zlib.brotliCompressSync(raw, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  });

  if (gz.length < raw.length) {
    fs.writeFileSync(file + ".gz", gz);
    gzTotal += gz.length;
  }
  if (br.length < raw.length) {
    fs.writeFileSync(file + ".br", br);
    brTotal += br.length;
  }
  files += 1;
  rawTotal += raw.length;
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + "MB";
console.log(
  `precompress-dist: ${files} files, raw ${mb(rawTotal)} -> gzip ${mb(gzTotal)} / brotli ${mb(brTotal)}`,
);
