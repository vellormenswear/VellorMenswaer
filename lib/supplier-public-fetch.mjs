import {resolve4} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP,BlockList} from 'node:net';
const blocked=new BlockList();
for(const [address,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])blocked.addSubnet(address,bits,'ipv4');
export function supplierUrl(raw){
 if(typeof raw!=='string'||raw.length>2048)throw Error('Informe uma URL HTTPS válida.');
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(u.hostname)||!u.hostname.includes('.')||u.hostname.endsWith('.')||/\.(local|internal|localhost|test|invalid|example|onion)$/i.test(u.hostname))throw Error('Informe o endereço HTTPS público do anúncio.');
 u.hash='';return u;
}
export const isPublicIPv4=ip=>isIP(ip)===4&&!blocked.check(ip,'ipv4');
async function addresses(host){let timer;try{return await Promise.race([resolve4(host),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tempo de consulta excedido.')),3000)})])}finally{clearTimeout(timer)}}
export async function fetchSupplierPage(raw){
 const url=supplierUrl(raw),ips=await addresses(url.hostname);
 if(!ips.length||ips.some(ip=>!isPublicIPv4(ip)))throw Error('Endereço do fornecedor não permitido.');
 const ip=ips[0];
 return await new Promise((resolve,reject)=>{
  let timer;
  const req=request(url,{agent:false,family:4,lookup:(_host,opts,cb)=>opts?.all?cb(null,[{address:ip,family:4}]):cb(null,ip,4),headers:{Accept:'text/html','Accept-Encoding':'identity','User-Agent':'VellorStockImport/1.0'}},res=>{
   if(res.statusCode!==200||!/^text\/html\b/i.test(res.headers['content-type']||'')){res.destroy();req.destroy(Error('A página não disponibilizou HTML público para consulta.'));return}
   const chunks=[];let total=0;
   res.on('data',c=>{total+=c.length;if(total>2*1024*1024){req.destroy(Error('Página excede o tamanho permitido.'));return}chunks.push(c)});
   res.on('error',reject);res.on('end',()=>{clearTimeout(timer);resolve({html:Buffer.concat(chunks).toString('utf8'),url:url.href})});
  });
  timer=setTimeout(()=>req.destroy(Error('Tempo de consulta excedido.')),8000);
  req.on('error',e=>{clearTimeout(timer);reject(e)});req.end();
 });
}
