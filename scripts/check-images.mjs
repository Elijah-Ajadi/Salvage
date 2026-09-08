import { readFile } from 'node:fs/promises';
const source = await readFile('lib/materials.ts','utf8');
const urls = [...source.matchAll(/photo:'([^']+)'/g)].map(m=>m[1]);
await Promise.all(urls.map(async url=>{try {const r=await fetch(url,{signal:AbortSignal.timeout(20000)}); console.log(new URL(url).hostname,r.status,r.headers.get('content-type'));await r.body?.cancel();}catch{console.log(new URL(url).hostname,'UNAVAILABLE');}}));
