import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
const source = await readFile(resolve(root,'dist/server/index.js'),'utf8');
const worker = (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
assert.equal(typeof worker.fetch,'function');
const request = path => new Request('https://test.chatgpt.site'+path);
const home = await worker.fetch(request('/'),{});
assert.equal(home.status,200);
assert.equal(await home.text(),await readFile(resolve(root,'index.html'),'utf8'));
for (const path of ['/app.js','/map.js','/groq-chat.js','/source-text.js','/style.css','/assets/eyes.webp']) {
  const response = await worker.fetch(request(path),{});
  assert.equal(response.status,200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(resolve(root,path.slice(1))));
}
for (const path of ['/.env','/.git/config','/.openai/hosting.json','/server.py','/chat-policy.json','/worker/chat.js','/tests/test_chat.py']) assert.equal((await worker.fetch(request(path),{})).status,404);
const manifest = JSON.parse(await readFile(resolve(root,'dist/.openai/hosting.json'),'utf8'));
assert.equal(manifest.project_id,JSON.parse(await readFile(resolve(root,'.openai/hosting.json'),'utf8')).project_id);
assert(!manifest.static);
console.log('PASS: standalone ESM Worker; original assets unchanged; private files excluded; Site identity preserved.');
