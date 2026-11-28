import {combinationKey} from './variant-grid.mjs';
// Presentation-only grouping. Never merge SKUs, infer sizes or overwrite existing prices/photos on load.
export function colorGroups(rows){
 const groups=new Map();
 for(const [i,row] of rows.entries()){
  const color=String(row.label??'').trim(),key=color?combinationKey(color,''):'unlabeled:'+(row.key??row.id??i);
  if(!groups.has(key))groups.set(key,{key,label:color,rows:[]});
  groups.get(key).rows.push(row);
 }
 return [...groups.values()];
}
export function sharedValue(rows,field){
 const values=[...new Set(rows.map(r=>String(r[field]??'')))];
 return {value:values.length===1?values[0]:'',mixed:values.length>1,values};
}
export function patchRows(rows,keys,patch){
 const chosen=new Set(keys);return rows.map(row=>chosen.has(row.key)?{...row,...patch}:row);
}
export function initialPriceMode(rows,fields){return fields.every(f=>!sharedValue(rows,f).mixed)?'unique':'color';}
export function effectivePriceMode(rows,fields,mode){return mode==='unique'&&fields.every(f=>!sharedValue(rows,f).mixed)?'unique':'color';}
