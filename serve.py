"""作者：Wangyuan；日期：2026-10-29。职责：只提供离线工作台公开静态文件及健康检查。"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
FILES = {'/': ('index.html', 'text/html'), '/index.html': ('index.html', 'text/html'),
         '/app.js': ('app.js', 'text/javascript'), '/sw.js': ('sw.js', 'text/javascript'),
         '/styles.css': ('styles.css', 'text/css'), '/icon.svg': ('icon.svg', 'image/svg+xml'),
         '/manifest.webmanifest': ('manifest.webmanifest', 'application/manifest+json')}


class Handler(BaseHTTPRequestHandler):
    """固定文件清单，不暴露源码目录、运行文件或路径遍历入口。"""
    def do_GET(self) -> None:
        """处理公开静态路由与健康检查。"""
        path = urlsplit(self.path).path
        if path == '/healthz':
            data, kind, status = json.dumps({'ok': True}).encode(), 'application/json', 200
        elif path in FILES:
            filename, kind = FILES[path]
            data, status = (ROOT / filename).read_bytes(), 200
        else:
            data, kind, status = b'Not found', 'text/plain', 404
        self.send_response(status)
        self.send_header('Content-Type', kind + '; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    ThreadingHTTPServer((os.environ.get('HOST', '127.0.0.1'), int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
