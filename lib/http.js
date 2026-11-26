import {NextResponse} from 'next/server';
import {readJsonObject,RequestBodyError} from './request-body.mjs';
export class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
export function ensure(cond,message='Dados inválidos.',code=400){if(!cond)throw new HttpError(code,message)}
export function ok(data,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}})}
export function fail(e){const status=e instanceof HttpError?e.status:500;if(status===500)console.error('Vellor Menswear server error',e?.message);return ok({error:status===500?'Erro interno. Tente novamente.':e.message,...(status===422&&e.fields?{fields:e.fields}:{})},status)}
export async function body(req,max=100000){try{return await readJsonObject(req,max)}catch(e){if(e instanceof RequestBodyError)throw new HttpError(e.status,e.message);throw e}}
export function originGuard(req){const origin=req.headers.get('origin');const expected=new URL(req.url).origin;const site=(process.env.SITE_URL||'').replace(/\/$/,'');
 if(origin && origin!==expected && origin!==site)throw new HttpError(403,'Origem não autorizada.');
 if(!origin){const sf=req.headers.get('sec-fetch-site');if(sf&&sf!=='same-origin'&&sf!=='none')throw new HttpError(403,'Origem não autorizada.');}
}
export function uuid(v){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}
export function txt(v,max=255){return String(v??'').trim().slice(0,max)}
export const email=v=>txt(v,250).toLowerCase();
