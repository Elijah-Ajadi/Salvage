import {env} from 'cloudflare:workers';
export function bindings(){return env as unknown as {DB:D1Database;FILES:R2Bucket;OPENAI_API_KEY?:string;OPENAI_VISION_MODEL?:string};}
export function db(){return bindings().DB;}
export async function geocode(address:string){const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,{headers:{'User-Agent':'Salvage/1.0 (local material exchange)'}});if(!r.ok)throw Error('Location lookup is unavailable. Please try again.');const a:any=await r.json();if(!a.length)throw Error('We couldn’t find that address. Include the city and ZIP code.');return {lat:Number(a[0].lat),lng:Number(a[0].lon)};}
