'use client';
import {useId} from 'react';
export default function CategoryPicker({categories=[],value='',onChange}){
 const id=useId(),selected=categories.find(c=>c.id===value),parent=selected?.parent_id||selected?.id||'';
 const roots=categories.filter(c=>!c.parent_id&&(c.active!==false||c.id===parent));
 const subs=categories.filter(c=>c.parent_id===parent&&(c.active!==false||c.id===value));
 return <fieldset className="vll-category-picker"><legend>Classificação do produto</legend><div className="formgrid vll-category-fields"><div className="field"><label htmlFor={id+'-root'}>Categoria principal</label><select id={id+'-root'} value={parent} onChange={e=>onChange(e.target.value)}><option value="">Selecione a categoria</option>{roots.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="field"><label htmlFor={id+'-sub'}>Subcategoria</label><select id={id+'-sub'} value={selected?.parent_id?value:''} disabled={!parent||!subs.length} onChange={e=>onChange(e.target.value||parent)}><option value="">{!parent?'Selecione a categoria primeiro':!subs.length?'Nenhuma subcategoria disponível':'Selecione a subcategoria (opcional)'}</option>{subs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>{selected&&<p className="vll-category-path"><span>Selecionado:</span> <b>{roots.find(c=>c.id===parent)?.name||selected.name}</b>{selected.parent_id&&<> <span aria-hidden="true">›</span> <b>{selected.name}</b></>}</p>}</fieldset>
}
