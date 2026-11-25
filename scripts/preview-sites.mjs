import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
// Local bridge for testing the exact standalone Worker artifact. Not part of deployment.
const source=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const port=Number(process.env.PORT || '8082');
const server=createServer(async(req,res)=>{
  try {
    const request=new Request(`http://127.0.0.1:${port}${req.url}`,{
      method:req.method,headers:req.headers,
      ...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{}),
    });
    const response=await worker.fetch(request,{...process.env,AI_REQUIRE_AUTH:'false'});
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500);res.end('Preview error'); }
});
server.listen(port,'127.0.0.1',()=>console.log(`Worker preview: http://127.0.0.1:${port}`));
