import {resolve4} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP,BlockList} from 'node:net';
import {importError} from './supplier-import-errors.mjs';
const blocked=new BlockList();
for(const [address,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])blocked.addSubnet(address,bits,'ipv4');
export function supplierUrl(raw){
 if(typeof raw!=='string'||raw.length>2048)throw importError('INVALID_URL','Informe uma URL HTTPS válida.');
 let u;try{u=new URL(raw)}catch{throw importError('INVALID_URL','Informe uma URL HTTPS válida.')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(u.hostname)||!u.hostname.includes('.')||u.hostname.endsWith('.')||/\.(local|internal|localhost|test|invalid|example|onion)$/i.test(u.hostname))throw importError('UNSAFE_URL','Informe o endereço HTTPS público do anúncio.');
 u.hash='';return u;
}
export const isPublicIPv4=ip=>isIP(ip)===4&&!blocked.check(ip,'ipv4');
const timeout=()=>importError('TIMEOUT','O fornecedor não respondeu dentro do tempo de consulta.');
async function addresses(host,limit){let timer;try{return await Promise.race([resolve4(host),new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeout()),limit)})])}finally{clearTimeout(timer)}}
export function supplierRedirect(current,location){
 if(typeof location!=='string'||!location)throw importError('REDIRECT','O fornecedor enviou um redirecionamento inválido.');
 try{return supplierUrl(new URL(location,current).href)}catch{throw importError('UNSAFE_REDIRECT','O anúncio redirecionou para um endereço não permitido.')}
}
export function supplierHttpError(status){
 const message={401:'O fornecedor exige autenticação.',403:'O fornecedor recusou a consulta automatizada.',404:'O anúncio não foi encontrado.',429:'O fornecedor limitou as consultas. Tente novamente mais tarde.'}[status]||(status>=500?'O servidor do fornecedor apresentou uma falha.':'O fornecedor retornou uma resposta HTTP incompatível.');
 return importError('HTTP_'+status,message,status);
}
async function requestPage(url,ip,limit,kind){
 return await new Promise((resolve,reject)=>{
  let timer,done=false;
  const finish=(err,value)=>{if(done)return;done=true;clearTimeout(timer);if(err)reject(err);else resolve(value)};
  const req=request(url,{agent:false,family:4,lookup:(_host,opts,cb)=>opts?.all?cb(null,[{address:ip,family:4}]):cb(null,ip,4),headers:{Accept:kind==='json'?'application/json':'text/html,application/xhtml+xml','Accept-Encoding':'identity','User-Agent':'VellorStockImport/1.0'}},res=>{
   const status=res.statusCode;
   if([301,302,303,307,308].includes(status)){finish(null,{redirect:res.headers.location||''});res.destroy();return}
   if(status!==200){finish(supplierHttpError(status));res.destroy();return}
   const mime=res.headers['content-type']||'';
   if(!(kind==='json'?/^application\/(?:json|[\w.+-]+\+json)\b/i:/^(?:text\/html|application\/xhtml\+xml)\b/i).test(mime)){finish(importError('CONTENT_TYPE','O fornecedor não retornou o formato esperado.'));res.destroy();return}
   const chunks=[];let total=0;
   res.on('data',c=>{total+=c.length;if(total>2*1024*1024){finish(importError('RESPONSE_TOO_LARGE','A página excede o tamanho permitido.'));req.destroy();return}chunks.push(c)});
   res.on('error',e=>finish(e));res.on('aborted',()=>finish(importError('CONNECTION','A resposta do fornecedor foi interrompida.')));res.on('end',()=>finish(null,{html:Buffer.concat(chunks).toString('utf8'),url:url.href}));
  });
  timer=setTimeout(()=>{finish(timeout());req.destroy()},limit);
  req.on('error',e=>finish(e));req.end();
 });
}
export async function fetchSupplierPage(raw,{kind='html',deadline=Date.now()+11000,resolve=addresses,read=requestPage}={}){
 let url=supplierUrl(raw);const visited=new Set();
 for(let hop=0;hop<=4;hop++){
  if(visited.has(url.href))throw importError('REDIRECT_LOOP','O fornecedor está redirecionando a página repetidamente.');
  visited.add(url.href);
  let remaining=deadline-Date.now();if(remaining<=0)throw timeout();
  const ips=await resolve(url.hostname,Math.min(3000,remaining));
  if(!ips.length||ips.some(ip=>!isPublicIPv4(ip)))throw importError('UNSAFE_ADDRESS','Endereço do fornecedor não permitido.');
  remaining=deadline-Date.now();if(remaining<=0)throw timeout();
  const result=await read(url,ips[0],Math.min(8000,remaining),kind);
  if(!Object.hasOwn(result,'redirect'))return result;
  url=supplierRedirect(url,result.redirect);
 }
 throw importError('REDIRECT_LIMIT','O anúncio possui redirecionamentos demais.');
}
