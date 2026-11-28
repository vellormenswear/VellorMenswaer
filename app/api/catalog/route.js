import {CAMPAIGN_JOIN,CAMPAIGN_PRICE,CAMPAIGN_DISCOUNT,CAMPAIGN_PIX_JOIN,CAMPAIGN_PIX_PRICE,pixPlan} from '@/lib/campaign-pricing.mjs';
import {catalogDepartment} from '@/lib/departments.mjs';
import {sql} from '@/lib/db';import {ok,fail,HttpError} from '@/lib/http';
import {CATALOG_IMAGE,CATALOG_FROM,CATALOG_WHERE,CATALOG_SORT_TIME,CATALOG_CURSOR_TIME,parseCatalogPage} from '@/lib/catalog-query.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req){try{
 let page,department,slug;try{const params=new URL(req.url).searchParams;page=parseCatalogPage(params);department=catalogDepartment(params.get('department'));slug=params.get('slug');if(slug!==null&&(!slug||slug.length>200||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)))throw Error('Produto inválido.')}catch(e){throw new HttpError(400,e.message)}
 const r=await sql(`WITH eligible_models AS (
  SELECT DISTINCT p.id,${CATALOG_SORT_TIME} AS sort_at
  ${CATALOG_FROM}
  WHERE ${CATALOG_WHERE}
    AND ($5::text IS NULL OR p.department=$5)
    AND ($6::text IS NULL OR p.slug=$6)
    AND ($1::timestamptz IS NULL OR (${CATALOG_SORT_TIME},p.id)>($1::timestamptz,$2::uuid))
  ORDER BY sort_at,p.id LIMIT $3
 ), selected_models AS (
  SELECT id,sort_at FROM eligible_models ORDER BY sort_at,id LIMIT $4
 )
 SELECT v.sku,p.name,p.slug,p.description,p.department,c.name AS category,c.slug AS category_slug,root.slug AS parent_slug,root.name AS parent_category,v.label AS variant,(${CAMPAIGN_PRICE}) / 100.0 AS price_brl,(${CAMPAIGN_PIX_PRICE}) AS _pix_cents,(${CAMPAIGN_PRICE}) AS _unit_cents,v.supplier_cost_cents AS _cost_cents,v.price_cents / 100.0 AS regular_price_brl,${CAMPAIGN_DISCOUNT} AS promotion_discount_cents,CASE WHEN v.original_price_cents IS NULL THEN null ELSE v.original_price_cents/100.0 END AS base_price_brl,v.sizes,v.preparation_days,v.delivery_days_min,v.delivery_days_max,${CATALOG_IMAGE} AS image_url,p.shipping,
  p.id AS _model_id,to_char(page.sort_at AT TIME ZONE 'UTC','${CATALOG_CURSOR_TIME}') AS _cursor_time,
  (SELECT count(*)>$4 FROM eligible_models) AS _has_more
 ${CATALOG_FROM}
 JOIN selected_models page ON page.id=p.id
 ${CAMPAIGN_JOIN} ${CAMPAIGN_PIX_JOIN}
 LEFT JOIN categories c ON c.id=p.category_id
 LEFT JOIN categories root ON root.id=(to_jsonb(c)->>'parent_id')::uuid
 WHERE ${CATALOG_WHERE}
 ORDER BY page.sort_at,page.id,v.created_at,v.id`,[page.time,page.id,page.limit+1,page.limit,department,slug]);
 const last=r.rows.at(-1),next_cursor=last?._has_more?last._cursor_time+'|'+last._model_id:null;
 const products=r.rows.map(({_model_id,_cursor_time,_has_more,_pix_cents,_unit_cents,_cost_cents,...x})=>{const plan=_pix_cents<_unit_cents&&_unit_cents>_cost_cents?pixPlan([{total:_unit_cents,subtotal:_unit_cents,cost:_cost_cents,items:[{unit_cents:_unit_cents,pix_unit_cents:_pix_cents,qty:1}]}]):{floor:0};return {...x,pix_price_brl:plan.floor>0?(_unit_cents-plan.floor)/100:null,regular_price_brl:Number(x.regular_price_brl),price_brl:x.price_brl===null?null:Number(x.price_brl),base_price_brl:x.base_price_brl===null?null:Number(x.base_price_brl),image_data:x.image_url||null,delivery_days:x.delivery_days_min===null||x.delivery_days_max===null?null:[Number(x.preparation_days||0)+Number(x.delivery_days_min),Number(x.preparation_days||0)+Number(x.delivery_days_max)]}});
 return ok({products,next_cursor,has_more:!!next_cursor});
}catch(e){return fail(e)}}
