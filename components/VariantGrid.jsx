'use client';
import {useState} from 'react';
import {quickColors,SHOE_SIZES,WATCH_SIZE} from '@/lib/variant-options.mjs';
export default function VariantGrid({root,onGenerate,disabled=false}){
 const [colors,setColors]=useState([]),[sizes,setSizes]=useState([]),[customColor,setCustomColor]=useState(''),[customSize,setCustomSize]=useState('');
 const toggle=(set,value)=>set(old=>old.includes(value)?old.filter(x=>x!==value):[...old,value]);
 const add=(set,value,clear)=>{const v=value.trim();if(v){set(old=>old.includes(v)?old:[...old,v]);clear('')}};
 const palette=quickColors(root),watch=root==='relogios',selectedSizes=watch?[WATCH_SIZE]:sizes;
 const colorChoices=[...palette,...colors.filter(v=>!palette.some(([n])=>n===v)).map(v=>[v,null])];
 const sizeChoices=[...new Set([...(root==='calcados'?SHOE_SIZES:root==='vestuario'?['PP','P','M','G','GG','XG','XXG','Único']:['Único','P','M','G']),...sizes])];
 return <fieldset className="vll-variant-options field" disabled={disabled}><legend>{watch?'Cores':'Cores e tamanhos'}</legend>
 <label>Cores</label><div className="vll-option-grid" role="group" aria-label="Selecionar várias cores">{colorChoices.map(([name,hex])=><button key={name} type="button" className="vll-option-chip" aria-label={name} aria-pressed={colors.includes(name)} onClick={()=>toggle(setColors,name)}>{hex&&<span className="vll-color-swatch" style={{backgroundColor:hex}} aria-hidden="true"/>}{name}</button>)}</div>
 <div className="flexrow"><input className="form" aria-label="Outra cor" placeholder="Outra cor" maxLength={120} value={customColor} onChange={e=>setCustomColor(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add(setColors,customColor,setCustomColor)}}}/><button type="button" className="tiny" onClick={()=>add(setColors,customColor,setCustomColor)}>Adicionar cor</button></div>
 {watch?<p className="small">Tamanho único</p>:<><label>{root==='calcados'?'Numeração (BR)':'Tamanhos'}</label><div className="vll-option-grid" role="group" aria-label="Selecionar vários tamanhos">{sizeChoices.map(size=><button key={size} type="button" className="vll-option-chip vll-size-chip" aria-label={size} aria-pressed={sizes.includes(size)} onClick={()=>toggle(setSizes,size)}>{size}</button>)}</div>
 <div className="flexrow"><input className="form" aria-label="Outro tamanho" placeholder="Outro tamanho" maxLength={root==='calcados'?2:30} value={customSize} onChange={e=>setCustomSize(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add(setSizes,customSize,setCustomSize)}}}/><button type="button" className="tiny" onClick={()=>add(setSizes,customSize,setCustomSize)}>Adicionar tamanho</button></div></>}
 <div className="flexrow"><button type="button" className="tiny" disabled={!colors.length||!selectedSizes.length} onClick={()=>onGenerate(colors,selectedSizes)}>Gerar {colors.length*selectedSizes.length} variações</button></div></fieldset>;
}
