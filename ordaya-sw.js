// Host on www.launchmere.com only after approval. Cache public shell bytes only.
const CACHE='ordaya-standard-shell-v1';
const BASE='https://gwsgdghknbqcfvkojtuw.supabase.co/functions/v1/ordaya-commercial-assets/';
const assets=new Set(['bootstrap.mjs','assets/workspace-bundle.js','assets/stage1-entry.js','assets/stage1-standard.css','assets/workspace-stage1-standard.js','assets/commercial-auth.mjs']);
function standard(url){
 return url.origin===self.location.origin&&url.pathname==='/ordaya'&&
  url.searchParams.getAll('app').join(',')==='1'&&url.searchParams.getAll('pilot').join(',')==='1'&&
  [...url.searchParams.keys()].every(key=>['app','pilot'].includes(key));
}
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||req.headers.has('Authorization'))return;
 const navigation=req.mode==='navigate'&&standard(url);
 const asset=url.href.startsWith(BASE)&&assets.has((url.origin+url.pathname).slice(BASE.length));
 if(!navigation&&!asset)return;
 event.respondWith((async()=>{
  if(asset){
   const client=event.clientId&&await self.clients.get(event.clientId);
   if(!client||!standard(new URL(client.url)))return fetch(req);
  }
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(req);
   if(response.ok&&!response.redirected&&!/private|no-store/i.test(response.headers.get('cache-control')||''))await cache.put(req,response.clone());
   return response;
  }catch(error){const stored=await cache.match(req);if(stored)return stored;throw error;}
 })());
});
