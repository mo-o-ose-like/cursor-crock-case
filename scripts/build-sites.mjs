import {readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.woff':'font/woff','.webp':'image/webp','.svg':'image/svg+xml'};
const assets = {};
async function add(path) {
  const bytes = await readFile(resolve(root,path));
  assets['/'+path] = {type:types[extname(path)],data:bytes.toString('base64')};
}
// Explicitly package only public application files, never .env, backend, tests or credentials.
for (const item of await readdir(root,{withFileTypes:true})) {
  if (item.isFile() && (['index.html','design.html'].includes(item.name) || ['.js','.css','.woff','.webp'].includes(extname(item.name)))) await add(item.name);
}
for (const dir of ['assets','datasets']) {
  for (const item of await readdir(resolve(root,dir),{withFileTypes:true})) {
    if (item.isFile() && (dir==='assets'?['.woff','.webp','.svg'].includes(extname(item.name)):extname(item.name)==='.json')) await add(dir+'/'+item.name);
  }
}
const manifest = JSON.parse(await readFile(resolve(root,'.openai/hosting.json'),'utf8'));
if (!manifest.project_id || manifest.static) throw new Error('Sites Worker needs the existing project_id and no static field.');
const policy = JSON.parse(await readFile(resolve(root,'chat-policy.json'),'utf8'));
const core = await readFile(resolve(root,'worker/chat.js'),'utf8');
const entry = (await readFile(resolve(root,'worker/index.js'),'utf8')).replace(/^import .* from '\.\/chat\.js';\r?\n/m,'');
const bundle = core+'\n'+entry+'\nexport default createWorker({assets:'+JSON.stringify(assets)+',policy:'+JSON.stringify(policy)+'});\n';
const output = resolve(root,'dist');
await rm(output,{recursive:true,force:true});
await mkdir(resolve(output,'server'),{recursive:true});
await mkdir(resolve(output,'.openai'),{recursive:true});
await writeFile(resolve(output,'server/index.js'),bundle);
await writeFile(resolve(output,'.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Sites Worker built: ${Object.keys(assets).length} public files, ${Buffer.byteLength(bundle)} bytes. No secrets included.`);
