const { app, BrowserWindow, dialog } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

function getOutDir() {
  return path.join(__dirname, "..", "out");
}

function mime(ext) {
  const m = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
  };
  return m[ext.toLowerCase()] || "application/octet-stream";
}

function createStaticServer(rootDir) {
  const root = path.resolve(rootDir);
  return http.createServer((req, res) => {
    const pathname = decodeURIComponent(url.parse(req.url).pathname || "/");
    if (pathname.includes("..")) {
      res.writeHead(403);
      return res.end();
    }
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.join(root, rel);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404);
        return res.end("Not found");
      }
      fs.readFile(filePath, (e2, buf) => {
        if (e2) {
          res.writeHead(500);
          return res.end();
        }
        res.writeHead(200, { "Content-Type": mime(path.extname(filePath)) });
        res.end(buf);
      });
    });
  });
}

let server;

function startServer(outDir) {
  return new Promise((resolve, reject) => {
    server = createStaticServer(outDir);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(`http://127.0.0.1:${addr.port}/`);
    });
    server.on("error", reject);
  });
}

function createWindow(loadUrl) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.loadURL(loadUrl);
}

app.whenReady().then(async () => {
  const outDir = getOutDir();
  const indexHtml = path.join(outDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    dialog.showErrorBox(
      "Dashboard Premi",
      `Build aplikasi tidak ditemukan.\n\nJalankan di folder proyek:\n  npm run build\n\nLalu jalankan lagi aplikasi ini.`,
    );
    app.quit();
    return;
  }
  try {
    const loadUrl = await startServer(outDir);
    createWindow(loadUrl);
  } catch (e) {
    dialog.showErrorBox("Dashboard Premi", `Gagal menyajikan aplikasi:\n${e?.message || e}`);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
    server = null;
  }
  app.quit();
});

app.on("before-quit", () => {
  if (server) {
    server.close();
    server = null;
  }
});
