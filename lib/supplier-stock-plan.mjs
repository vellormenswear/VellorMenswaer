import {combinationKey} from './variant-grid.mjs';
// Match only an unambiguous individual color/size; never infer stock from missing rows.
export function stockUpdates(local,remote){
 const unique=new Map(),duplicates=new Set();
 for(const r of remote||[]){
  if(!r.label||!Array.isArray(r.sizes)||r.sizes.length!==1||!r.sizes[0])continue;
  const key=combinationKey(r.label,r.sizes[0]);if(unique.has(key))duplicates.add(key);unique.set(key,r);
 }
 const counts=new Map();
 for(const v of local){if(v.label&&v.sizes?.length===1){const k=combinationKey(v.label,v.sizes[0]);counts.set(k,(counts.get(k)||0)+1)}}
 const updates=[];
 for(const v of local){
  if(!v.active||!v.label||v.sizes?.length!==1)continue;
  const k=combinationKey(v.label,v.sizes[0]),r=unique.get(k);
  if(!r||duplicates.has(k)||counts.get(k)!==1)continue;
  const stock=Number.isInteger(r.reported_stock)&&r.reported_stock>=0&&r.reported_stock<=2147483647?r.reported_stock:null;
  const available=typeof r.supplier_available==='boolean'?r.supplier_available:null;
  if(stock===null&&available===null)continue;
  if(stock!==null&&stock!==v.reported_stock||available!==null&&available!==v.supplier_available)updates.push({id:v.id,reported_stock:stock,supplier_available:available});
 }
 return updates;
}
