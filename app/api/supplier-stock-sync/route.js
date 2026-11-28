import {body,originGuard,fail,HttpError} from '@/lib/http';
import {GET as catalog} from '../catalog/route.js';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Compatibility for cached storefronts: read local catalog only; never call the supplier or mutate availability.
export async function POST(req){try{originGuard(req);const x=await body(req,2048);if(typeof x.slug!=='string'||!x.slug||x.slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.slug))throw new HttpError(400,'Produto inválido.');const url=new URL('/api/catalog',req.url);url.searchParams.set('slug',x.slug);return catalog(new Request(url));}catch(e){return fail(e)}}
