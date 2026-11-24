'use client';
export default function CategoryPicker({categories=[],value='',onChange}){
 const selected=categories.find(c=>c.id===value),parent=selected?.parent_id||selected?.id||'';
 const roots=categories.filter(c=>!c.parent_id&&(c.active!==false||c.id===parent));
 const subs=categories.filter(c=>c.parent_id===parent&&(c.active!==false||c.id===value));
 return <div className="formgrid"><div className="field"><label>Categoria principal</label><select value={parent} onChange={e=>onChange(e.target.value)}><option value="">Selecione</option>{roots.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="field"><label>Subcategoria</label><select value={selected?.parent_id?value:''} disabled={!parent||!subs.length} onChange={e=>onChange(e.target.value||parent)}><option value="">Sem subcategoria</option>{subs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
}
