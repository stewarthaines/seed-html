/**
 * Zero-dependency static server for the packaged SEED.html dist/.
 *
 * localhost is a secure context, so the app behaves exactly as on the hosted
 * site: service worker, OPFS project storage, the extensions and plugins
 * catalogs. Binds 127.0.0.1 only — this serves one person's editor, not a LAN.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const DEFAULT_PORT = 8417;
const PORT_ATTEMPTS = 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.xhtml': 'application/xhtml+xml; charset=utf-8',
  '.epub': 'application/epub+zip',
  '.zip': 'application/zip',
};

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {
    // No opener available — the printed URL is enough.
  });
}

export function serve(argv) {
  const portFlag = argv.indexOf('--port');
  const requestedPort =
    portFlag !== -1 ? Number(argv[portFlag + 1]) : Number(process.env.PORT) || DEFAULT_PORT;
  const noOpen = argv.includes('--no-open');

  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('seed-html: packaged dist/ is missing — this is a broken install.');
    process.exit(1);
  }

  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(DIST, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      file = join(file, 'index.html');
    }
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      // The app's own service worker manages caching; keep the server honest.
      'cache-control': 'no-cache',
    });
    createReadStream(file).pipe(res);
  });

  let attempts = 0;
  const tryListen = port => {
    server.once('error', error => {
      if (error.code === 'EADDRINUSE' && attempts < PORT_ATTEMPTS) {
        attempts += 1;
        tryListen(port + 1);
      } else {
        console.error(`seed-html: could not bind a port (${error.code ?? error})`);
        process.exit(1);
      }
    });
    server.listen(port, '127.0.0.1', () => {
      const url = `http://localhost:${port}/`;
      console.log(`SEED.html (Simple EPUB Editor) serving at ${url}`);
      console.log('Projects are stored by your browser for this address. Ctrl+C to stop.');
      if (!noOpen) openBrowser(url);
    });
  };
  tryListen(Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : DEFAULT_PORT);
}
