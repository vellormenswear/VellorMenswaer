'use client';
import {useState} from 'react';
import {colorGroups,sharedValue} from '@/lib/grouped-variants.mjs';
import {variantAvailable} from '@/lib/stock-availability.mjs';
import {ColorHeading,PriceMode,GroupPrices} from '@/components/GroupedVariants';
import styles from './GroupedVariants.module.css';
const brl=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export default function GroupedReview({variants,prices,onPrices}){
 const [mode,setMode]=useState('unique');
 const rows=variants.map(v=>({...v,key:v.sku,reviewPrice:prices[v.sku]??''}));
 const fields=[{key:'reviewPrice',label:'Preço VELLOR (R$)'}];
 const update=(list,patch)=>onPrices(Object.fromEntries(list.map(v=>[v.sku,patch.reviewPrice])));
 return <div className={styles.panel}><PriceMode mode={mode} onChange={setMode}/>
 {mode==='unique'&&<GroupPrices rows={rows} fields={fields} onChange={update} scope="Todas as variações"/>}
 {colorGroups(rows).map(g=>{const photo=sharedValue(g.rows,'image_url'),cost=sharedValue(g.rows,'cost_cents');return <section key={g.key} className={styles.color} data-color-group={g.label||'Variação única'}><ColorHeading label={g.label} count={g.rows.length}/><div className={styles.content}>
 <div className={styles.photo}>{photo.value?<img src={photo.value} alt={'Foto — '+g.label}/>:photo.mixed?<span className="small">Fotos diferentes já cadastradas</span>:<span className="small">Sem foto — imagem provisória</span>}<b>Preço fornecedor: {cost.mixed?cost.values.map(brl).join(' / '):brl(cost.value)}</b></div>
 {mode==='color'&&<GroupPrices rows={g.rows} fields={fields} onChange={update} scope={g.label}/>}
 <div className={styles.sizes}>{g.rows.map(v=><div key={v.sku} className={styles.size} data-available={variantAvailable(v)} aria-label={(v.sizes||[]).join(', ')+' — '+(variantAvailable(v)?'Disponível':'Indisponível')}><b>{(v.sizes||[]).join(', ')||'Único'}</b><small>{variantAvailable(v)?'Disponível':'Indisponível'}</small></div>)}</div>
 <details className={styles.details}><summary>SKUs das variações</summary>{g.rows.map(v=><p key={v.sku} className="small">{v.sku} · {(v.sizes||[]).join(', ')} · {brl(v.cost_cents)}</p>)}</details></div></section>})}</div>;
}
