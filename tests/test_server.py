"""作者：Wangyuan；日期：2026-10-29。职责：验证固定静态文件与健康接口边界。"""
import threading
import unittest
from urllib.request import urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
from serve import Handler


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close()

    def test_health(self):
        with urlopen(self.url + '/healthz') as response:
            self.assertEqual(response.status, 200)

    def test_source_and_traversal_not_served(self):
        for name in ['/serve.py', '/../README.md', '/%2e%2e/README.md', '/.env']:
            with self.subTest(name=name), self.assertRaises(HTTPError) as error:
                urlopen(self.url + name)
            self.assertEqual(error.exception.code, 404)

    def test_assets_and_policy(self):
        for name in ['/', '/sw.js', '/app.js', '/manifest.webmanifest', '/icon.svg']:
            with urlopen(self.url + name) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("connect-src 'self'", response.headers['Content-Security-Policy'])


if __name__ == '__main__':
    unittest.main()
