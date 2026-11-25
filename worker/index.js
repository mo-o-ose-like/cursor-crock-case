import {handleChat, jsonResponse} from './chat.js';

// The build embeds the unchanged public files and shared policy into one ESM artifact.
export function createWorker({assets,policy,fetchImpl}) {
  return {
    async fetch(request,env = {}) {
      const path = new URL(request.url).pathname;
      if (path === '/api/chat') {
        if (request.method !== 'POST') return new Response(null,{status:405,headers:{Allow:'POST'}});
        return handleChat(request,env,policy,fetchImpl);
      }
      if (path === '/api/status') {
        if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
        const data = jsonResponse(200,{mode:env.AI_API_KEY?'ai':'local'});
        return request.method==='HEAD'?new Response(null,{headers:data.headers}):data;
      }
      if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
      const asset = Object.hasOwn(assets,path==='/'?'/index.html':path) ? assets[path==='/'?'/index.html':path] : null;
      if (!asset) return new Response('Не найдено.',{status:404});
      const bytes = request.method==='HEAD'?null:Uint8Array.from(atob(asset.data),c => c.charCodeAt(0));
      return new Response(bytes,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
    },
  };
}
