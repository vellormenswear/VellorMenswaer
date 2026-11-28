'use client';
import {useState} from 'react';
import {variantRootSlug,quickColors,SHOE_SIZES,WATCH_SIZE,normalizeVariantSizes,validFootwearSizes} from '@/lib/variant-options.mjs';
import Field from '@/components/Field';

export default function VariantOptions({categories=[],categoryId,label='',sizes=[],onLabel,onSizes,singleSize=false,optionalLabel=false}){
 const root=variantRootSlug(categories,categoryId),palette=quickColors(root);
 const selected=normalizeVariantSizes(sizes);
 const [customSize,setCustomSize]=useState('');
 const [sizeError,setSizeError]=useState('');
 const [customColor,setCustomColor]=useState(false);
 const chosenColor=palette.find(([name])=>name===label);
 const showCustom=customColor||Boolean(label&&!chosenColor);
 const toggleSize=(size)=>{
  setSizeError('');
  if(selected.includes(size))onSizes(selected.filter(s=>s!==size));
  else onSizes(singleSize?[size]:[...selected,size].sort((a,b)=>Number(a)-Number(b)));
 };
 const addCustom=()=>{
  const size=customSize.trim();
  if(!validFootwearSizes([size])){setSizeError('Informe uma numeração brasileira de 20 a 60.');return;}
  if(!selected.includes(size))toggleSize(size);
  setCustomSize('');setSizeError('');
 };
 return <>
 {['vestuario','calcados','relogios'].includes(root)?<fieldset className="vll-variant-options field"><legend>Cor da variação{optionalLabel?' (opcional)':''}</legend>
  <p className="small">Marque uma cor para esta variação. Cadastre outra variação para associar outra cor e sua própria foto.</p>
  <div className="vll-option-grid" role="group" aria-label="Cores disponíveis">{palette.map(([name,hex])=><button key={name} type="button" className="vll-option-chip" aria-pressed={label===name} onClick={()=>{setCustomColor(false);onLabel(name)}}>{hex&&<span className="vll-color-swatch" style={{backgroundColor:hex}} aria-hidden="true"/>}{name}</button>)}
  <button type="button" className="vll-option-chip" aria-pressed={showCustom} onClick={()=>{setCustomColor(true);if(chosenColor)onLabel('')}}>Outra cor / combinação</button></div>
  {showCustom&&<Field label="Nome da cor ou combinação" name="custom-color" value={label} onChange={onLabel}/>}
  {label&&<p className="small">Cor selecionada: <b>{label}</b></p>}
 </fieldset>:<Field label={(root==='calcados'?'Cor / modelo do calçado':'Cor / modelo da variação')+(optionalLabel?' (opcional)':'')} name="variant-label" value={label} onChange={onLabel}/>}
 {root==='relogios'?<p className="small">Tamanho único{selected.length&&selected[0].toUpperCase()!==WATCH_SIZE?' · '+selected.join(', '):''}</p>:root==='calcados'?<fieldset className="vll-variant-options field"><legend>Numeração (BR)</legend>
  <p className="small">{singleSize?'Selecione um número por variação.':'Marque os números disponíveis nesta variação.'}</p>
  <div className="vll-option-grid" role="group" aria-label="Numerações de calçados">{[...new Set([...SHOE_SIZES,...selected])].sort((a,b)=>Number(a)-Number(b)).map(size=><button key={size} type="button" className="vll-option-chip vll-size-chip" aria-pressed={selected.includes(size)} onClick={()=>toggleSize(size)}>{size}</button>)}</div>
  <div className="flexrow"><input className="form" aria-label="Outra numeração" inputMode="numeric" maxLength={2} placeholder="Outro número" value={customSize} onChange={e=>setCustomSize(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustom()}}} style={{maxWidth:145}}/><button type="button" className="tiny" onClick={addCustom}>Adicionar número</button></div>
  {sizeError&&<p role="alert" className="small">{sizeError}</p>}{singleSize&&selected.length>1&&<p role="alert" className="small">Marque apenas uma numeração.</p>}
  <p className="small">Selecionados: {selected.length?selected.join(', '):'nenhum'}</p>
 </fieldset>:root==='vestuario'?<fieldset className="vll-variant-options field"><legend>Tamanhos{optionalLabel?' (opcional)':''}</legend><div className="vll-option-grid" role="group" aria-label="Tamanhos disponíveis">{[...new Set(['PP','P','M','G','GG','XG','XXG','Único',...selected])].map(size=><button type="button" className="vll-option-chip vll-size-chip" key={size} aria-pressed={selected.includes(size)} onClick={()=>toggleSize(size)}>{size}</button>)}</div></fieldset>:<Field label={optionalLabel?'Tamanhos (opcional)':'Tamanhos'} name="sizes" value={Array.isArray(sizes)?sizes.join(', '):sizes} onChange={onSizes}/>}
 </>;
}
