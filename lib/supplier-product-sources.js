import {supplierUrl} from './supplier-public-fetch.mjs';
import {HttpError} from './http';
function column(kind){if(kind==='product')return 'product_id';if(kind==='submission')return 'submission_id';throw Error('Invalid source kind')}
export async function setProductSource(c,kind,id,raw){
 if(raw===undefined)return;
 const key=column(kind);
 if(raw===''){await c.query('DELETE FROM supplier_product_sources WHERE '+key+'=$1',[id]);return}
 let url;try{url=supplierUrl(raw).href}catch{throw new HttpError(422,'Informe a URL HTTPS pública do anúncio ou deixe o campo em branco.')}
 await c.query('INSERT INTO supplier_product_sources('+key+',source_url) VALUES($1,$2) ON CONFLICT('+key+') DO UPDATE SET source_url=excluded.source_url,last_checked_at=CASE WHEN supplier_product_sources.source_url=excluded.source_url THEN supplier_product_sources.last_checked_at ELSE NULL END',[id,url]);
}
export async function copyProductSource(c,from,fromId,to,toId){
 const a=column(from);column(to);
 const r=await c.query('SELECT source_url FROM supplier_product_sources WHERE '+a+'=$1',[fromId]);
 if(r.rowCount)await setProductSource(c,to,toId,r.rows[0].source_url);
 else await setProductSource(c,to,toId,'');
}
