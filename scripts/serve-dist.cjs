const http = require('http');
const fs = require('fs');
const path = require('path');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const root = path.resolve(__dirname, '..', 'dist');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const requestedPath = (req.url || '/').split('?')[0];
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
  const filePath = path.join(root, relativePath);

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }

    sendFile(res, path.join(root, 'index.html'));
  });
});

server.listen(port, host, () => {
  console.log(`Serving dist at http://${host}:${port}`);
});
