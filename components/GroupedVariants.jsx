'use client';
import {useState} from 'react';
import {colorGroups,sharedValue,initialPriceMode} from '@/lib/grouped-variants.mjs';
import {CLOTHING_COLORS} from '@/lib/variant-options.mjs';
import {combinationKey} from '@/lib/variant-grid.mjs';
import {reaisToCents} from '@/lib/listing-editor.mjs';
import styles from './GroupedVariants.module.css';

const money=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function ColorHeading({label,count}){
 const swatch=CLOTHING_COLORS.find(([name])=>combinationKey(name,'')===combinationKey(label,''))?.[1];
 return <div className={styles.colorHead}>{swatch&&<span className="vll-color-swatch" style={{backgroundColor:swatch}} aria-hidden="true"/>}<strong>{label||'Variação única'}</strong><small>{count} {count===1?'variação':'variações'}</small></div>;
}
export function PriceMode({mode,onChange}){
 return <div className={styles.mode} role="group" aria-label="Modo de preço">{[['unique','Preço único'],['color','Preço por variação']].map(([key,label])=><button type="button" className="vll-option-chip" key={key} aria-pressed={mode===key} onClick={()=>onChange(key)}>{label}</button>)}</div>;
}
export function GroupPrices({rows,fields,onChange,scope,margin=false,errors}){
 return <div className={styles.prices}>{fields.map(({key,label})=>{const value=sharedValue(rows,key),err=errors?.(rows,key);return <label key={key} className="field" data-field={err?.name}><span>{label}</span><input aria-label={label+' — '+scope} inputMode="decimal" placeholder={value.mixed?'Valores diferentes já cadastrados':'0,00'} value={value.value} aria-invalid={!!err} onChange={e=>onChange(rows,{[key]:e.target.value})}/>{err&&<small role="alert" className={styles.error}>{err.message}</small>}{value.mixed&&<small className="small">Valores atuais: {value.values.filter(Boolean).join(' / ')||'—'}</small>}</label>})}{margin&&(()=>{const c=sharedValue(rows,'cost'),s=sharedValue(rows,'sale'),cost=reaisToCents(c.value),sale=reaisToCents(s.value);return cost!==null&&sale!==null?<div className={styles.margin}><span>Lucro bruto <b>{money(sale-cost)}</b></span><span>Margem bruta <b>{sale>0?((sale-cost)/sale*100).toFixed(1).replace('.',','):'0'}%</b></span><small>Antes de taxas e impostos.</small></div>:null})()}</div>;
}
export default function GroupedVariants({rows,fields,onPatch,onUpload,onRemove,canRemove,renderDetails,errors,uploading,admin=false,allowImageUrl=false}){
 const [mode,setMode]=useState(()=>initialPriceMode(rows,fields.map(f=>f.key)));
 const groups=colorGroups(rows);
 const patch=(list,data)=>onPatch(list.map(v=>v.key),data);
 return <div className={styles.panel} data-grouped-variants>
  <PriceMode mode={mode} onChange={setMode}/>
  {mode==='unique'&&<GroupPrices rows={rows} fields={fields} onChange={patch} scope="Todas as variações" margin={admin} errors={errors}/>}
  {groups.map(group=>{
   const first=group.rows[0],photo=sharedValue(group.rows,'image_url'),name=group.label||'Variação única';
   const photoErr=errors?.(group.rows,'image_url');
   return <section className={styles.color} key={group.key} data-color-group={name}>
    <ColorHeading label={group.label} count={group.rows.length}/>
    <div className={styles.content}>
     <div className={styles.photo}>
      {photo.value&&<img src={photo.value} alt={'Foto — '+name}/>}
      <label className={styles.upload} data-field={photoErr?.name}><strong>Adicionar foto — {name}</strong><input type="file" aria-label={'Adicionar foto — '+name} accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];if(file)onUpload(group.rows,file);e.target.value=''}}/></label>
      {photo.value&&<button type="button" className="tiny" disabled={uploading} onClick={()=>patch(group.rows,{image_url:''})}>{admin?'Usar foto principal':'Remover foto'}</button>}
      {photo.mixed&&<small className="small">Fotos anteriores diferentes serão mantidas até substituir a foto desta cor.</small>}
      {photoErr&&<small role="alert" className={styles.error}>{photoErr.message}</small>}
      {allowImageUrl&&<details className={styles.imageDetails}><summary>URL da imagem (opcional)</summary><label className="field"><input aria-label={'URL da imagem — '+name} value={photo.value} onChange={e=>patch(group.rows,{image_url:e.target.value})}/></label></details>}
     </div>
     {mode==='color'&&<GroupPrices rows={group.rows} fields={fields} onChange={patch} scope={name} margin={admin} errors={errors}/>}
     <div className={styles.sizes} role="group" aria-label={'Disponibilidade — '+name}>
      {group.rows.map(v=>{const size=v.sizes?.join(', ')||'Único',available=v.active!==false&&v.supplier_available===true,err=errors?.([v],'supplier_available');return <div key={v.key} className={styles.sizeWrap} data-field={err?.name}><button type="button" className={styles.size} aria-label={name+' '+size+' — '+(available?'Disponível':'Indisponível')} aria-pressed={available} onClick={()=>patch([v],{supplier_available:!available,...(admin&&!available?{active:true}:{})})}><b>{size}</b><small>{available?'Disponível':'Indisponível'}</small></button>{err&&<small className={styles.error} role="alert">{err.message}</small>}</div>})}
     </div>
     {renderDetails&&<details className={styles.details}><summary>Detalhes das variações</summary>{group.rows.map(v=><div key={v.key} className={styles.detailRow}><div className={styles.detailHead}><b>{v.sizes?.join(', ')||'Variação única'}</b>{canRemove?.(v)&&<button type="button" className="tiny danger" onClick={()=>onRemove(v.key)}>Remover</button>}</div>{renderDetails(v,rows.indexOf(v))}</div>)}</details>}
    </div>
   </section>;
  })}
 </div>;
}
