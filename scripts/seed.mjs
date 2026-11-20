import fs from 'node:fs/promises';import pg from 'pg';
if(!process.env.DATABASE_URL)throw new Error('Configure DATABASE_URL e rode npm run db:migrate.');
const rows=JSON.parse(await fs.readFile('data/catalogo-nacional.json','utf8'));
if(rows.length!==104||rows.some(x=>x.shipping!=='nacional'))throw new Error('Catálogo nacional não passou na verificação.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},max:1});const c=await pool.connect();
const cents=v=>v===null||v===undefined?null:Math.round(Number(v)*100);
const slugify=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
try{await c.query('BEGIN');let created=0,variants=0;
 for(const p of rows){const cat=p.category||'Outros',cs=slugify(cat);const category=await c.query('INSERT INTO categories(name,slug) VALUES($1,$2) ON CONFLICT(slug) DO UPDATE SET name=excluded.name RETURNING id',[cat,cs]);
 const product=await c.query(`INSERT INTO products(name,slug,description,category_id,shipping,active,hidden) VALUES($1,$2,$3,$4,'nacional',true,false) ON CONFLICT(slug) DO NOTHING RETURNING id`,[p.name,p.slug,p.description||'',category.rows[0].id]);
 const id=product.rows[0]?.id||(await c.query('SELECT id FROM products WHERE slug=$1',[p.slug])).rows[0].id;if(product.rowCount)created++;
 const sizes=Array.isArray(p.sizes)?p.sizes:(typeof p.sizes==='string'?p.sizes.split(',').map(s=>s.trim()).filter(Boolean):[]);
 const rr=await c.query(`INSERT INTO product_variants(product_id,sku,label,price_cents,original_price_cents,sizes,stock,primary_image_url,source_filename,metadata,active)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(sku) DO NOTHING RETURNING id`,[id,p.sku,p.variant||'Padrão',cents(p.price_brl),cents(p.base_price_brl),sizes,p.stock??null,p.image_url||null,p.photo_filename||null,JSON.stringify({reference:p.reference||null,notice:p.notice||null,delivery_days:p.delivery_days||null}),p.public_ready]);
 if(rr.rowCount){variants++;if(p.image_url)await c.query('INSERT INTO product_images(product_id,variant_id,url,source_filename,alt) VALUES($1,$2,$3,$4,$5)',[id,rr.rows[0].id,p.image_url,p.photo_filename,p.name+' — '+p.variant]);}
 }
 await c.query('COMMIT');console.log(JSON.stringify({models_created:created,variants_created:variants,total_rows:rows.length},null,2));
}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await pool.end()}
