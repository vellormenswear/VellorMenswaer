import {ensure} from './http.js';
import {productSlugBase} from './product-slug-base.mjs';
// Shared transaction lock serializes automatic slug selection in both creation paths.
export async function resolveProductSlug(c,{name,requested='',id=null}){
 await c.query('SELECT pg_advisory_xact_lock($1)',[8033335]);
 let existing=null;
 if(id){const r=await c.query('SELECT slug FROM products WHERE id=$1 FOR UPDATE',[id]);ensure(r.rowCount,'Produto não encontrado.',404);existing=r.rows[0].slug;}
 const manual=String(requested||'').trim().toLowerCase();
 if(!manual&&existing)return existing;
 if(manual){ensure(/^[a-z0-9-]{1,200}$/.test(manual)&&/[a-z0-9]/.test(manual),'Identificador URL inválido. Use letras, números e hífens.');const r=await c.query('SELECT 1 FROM products WHERE slug=$1 AND ($2::uuid IS NULL OR id<>$2)',[manual,id]);ensure(!r.rowCount,'Este identificador URL já está em uso.',409);return manual;}
 const base=productSlugBase(name);
 for(let n=1;n<=10000;n++){const candidate=n===1?base:base+'-'+n;const r=await c.query('SELECT 1 FROM products WHERE slug=$1',[candidate]);if(!r.rowCount)return candidate;}
 throw new Error('Não foi possível gerar identificador único.');
}
