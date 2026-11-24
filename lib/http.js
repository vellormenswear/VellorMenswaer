import {NextResponse} from 'next/server';
export class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
export function ensure(cond,message='Dados inválidos.',code=400){if(!cond)throw new HttpError(code,message)}
export function ok(data,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(status===429?{'Retry-After':'60'}:{})}})}
export function fail(e){const status=e instanceof HttpError?e.status:500;if(status===500)console.error('Vellor Menswear server error',{name:e?.name||'Error',code:typeof e?.code==='string'&&/^[A-Z0-9_]{1,30}$/.test(e.code)?e.code:undefined});return ok({error:status===500?'Erro interno. Tente novamente.':e.message},status)}
export async function readLimitedText(req,max=100000){
 const declared=req.headers.get('content-length');if(declared!==null)ensure(/^\d+$/.test(declared)&&Number(declared)<=max,'Corpo muito grande.',413);
 if(!req.body)return '';
 const reader=req.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});let total=0,s='';
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel().catch(()=>{});throw new HttpError(413,'Corpo muito grande.');}s+=decoder.decode(value,{stream:true});}s+=decoder.decode();return s;}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Corpo inválido.');}finally{reader.releaseLock()}
}
export async function body(req,max=100000){const s=await readLimitedText(req,max);try{const data=JSON.parse(s);ensure(data&&typeof data==='object'&&!Array.isArray(data),'JSON inválido.');return data}catch{throw new HttpError(400,'JSON inválido.')}}
export function originGuard(req){const origin=req.headers.get('origin');const expected=new URL(req.url).origin;const site=(process.env.SITE_URL||'').replace(/\/$/,'');
 if(origin && origin!==expected && origin!==site)throw new HttpError(403,'Origem não autorizada.');
 if(!origin){const sf=req.headers.get('sec-fetch-site');if(sf&&sf!=='same-origin'&&sf!=='none')throw new HttpError(403,'Origem não autorizada.');}
}
export function uuid(v){return typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}
export function txt(v,max=255){return String(v??'').trim().slice(0,max)}
export const email=v=>txt(v,250).toLowerCase();
