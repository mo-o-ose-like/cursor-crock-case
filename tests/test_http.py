import io
import json
import os
import sys
import threading
import tempfile
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import Handler


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path, data=None, method=None, headers=None):
        raw = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(self.base+path, data=raw, method=method, headers=headers or {})
        try:
            response = urllib.request.urlopen(req, timeout=5)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            return response.status, response.read().decode()

    def body(self):
        return dict(record=dict(deal=dict(title='Пилот'),settings={}), graph=dict(people=[],edges=[]),messages=[dict(role='user',content='Бюджет?')])

    def test_secret_files_are_not_served_even_when_present(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'.env').write_text('AI_API_KEY=dummy-private-value')
            (root/'index.html').write_text('Test app')
            with patch('server.ROOT', root):
                self.assertEqual(self.request('/')[0],200)
                for path in ['/.env','/%2eenv','/.git/config','/server.py']:
                    code,body=self.request(path)
                    self.assertEqual(code,404)
                    self.assertNotIn('dummy-private-value',body)
                    self.assertEqual(self.request(path,method='HEAD')[0],404)

    def test_origin_and_invalid_payload(self):
        self.assertEqual(self.request('/api/chat',self.body(),headers={'Origin':'https://example.invalid'})[0],403)
        self.assertEqual(self.request('/api/chat',[])[0],400)
        self.assertEqual(self.request('/api/chat',{})[0],400)
        self.assertEqual(self.request('/api/missing',self.body())[0],404)

    @patch.dict(os.environ,{},clear=True)
    def test_missing_key_reports_configuration_error(self):
        code,body=self.request('/api/chat',self.body())
        self.assertEqual(code,503)
        self.assertIn('ИИ не подключён',json.loads(body)['error'])

    @patch.dict(os.environ,dict(AI_API_KEY='dummy-secret',AI_MODEL='fixture'))
    def test_model_response_and_rate_limit(self):
        response=dict(mode='ai',answer='Бюджет не указан [S2]',citations=[],suggestions=[])
        with patch('server.ask_model',return_value=response):
            code,body=self.request('/api/chat',self.body())
            self.assertEqual(code,200)
            self.assertEqual(json.loads(body)['mode'],'ai')
            self.assertNotIn('dummy-secret',body)
        error=urllib.error.HTTPError('https://example.invalid',429,'limit',{},io.BytesIO())
        with patch('server.ask_model',side_effect=error):
            code,body=self.request('/api/chat',self.body())
            self.assertEqual(code,429)
            self.assertIn('лимит',json.loads(body)['error'])


if __name__=='__main__':
    unittest.main()
