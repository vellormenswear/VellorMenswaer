'use client';
import {useEffect,useRef,useState} from 'react';
import CategoryPicker from '@/components/CategoryPicker';
import {CLOTHING_COLORS,SHOE_SIZES,categoryRootSlug} from '@/lib/variant-options.mjs';
import {LISTING_LIMIT,listingMoney,validateListing} from '@/lib/supplier-listing-rules.mjs';
import styles from './SupplierListings.module.css';

const statusLabel={pending:'Aguardando aprovação',approved:'Aprovado',rejected:'Rejeitado',inactive:'Inativo'};
const money=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const key=()=>globalThis.crypto.randomUUID();
const variant=()=>({key:key(),id:null,label:'',sizes:[],sku:'',cost_cents:'',stock_mode:'quantity',stock:'0',supplier_available:true,image_url:'',preparation_days:'2',delivery_days_min:'5',delivery_days_max:'15'});
const fresh=()=>({name:'',description:'',department:'',category_id:'',variants:[variant()]});
const editing=a=>({...a,variants:(a.variants||[]).map(v=>({...v,key:v.key||key(),sizes:Array.isArray(v.sizes)?v.sizes:[],cost_cents:v.cost_cents==null?'':(Number(v.cost_cents)/100).toFixed(2).replace('.',','),stock:v.stock==null?'0':String(v.stock),expected_stock:a.status==='approved'&&v.id?v.stock:undefined,supplier_available:v.supplier_available!==false}))});
async function api(action,payload){
 const r=await fetch('/api/suppliers/'+action,{method:payload?'POST':'GET',headers:{'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
 const j=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(j.error||'Não foi possível concluir a operação.');e.fields=j.fields;throw e;}return j;
}
function Field({name,label,error,children}){
 return <div className={'field '+(error?styles.invalid:'')} data-field={name}><label htmlFor={'listing-'+name}>{label}</label>{children}{error&&<span className={styles.error} id={'listing-error-'+name} role="alert">{error}</span>}</div>;
}
export default function SupplierListings({categories,onChanged,refreshToken,listings}){
 const [localList,setList]=useState([]),[localLoading,setLoading]=useState(true),[editor,setEditor]=useState(null),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[notice,setNotice]=useState(null),[errors,setErrors]=useState({}),[busy,setBusy]=useState(false),[uploading,setUploading]=useState({}),[expanded,setExpanded]=useState({});
 const lock=useRef(false),uploads=useRef(new Set()),request=useRef(null),formRef=useRef(null);
 async function load(){try{const j=await api('listings');setList(j.listings||[]);return true;}catch(e){setNotice({error:true,text:e.message});return false;}finally{setLoading(false);}}
 const list=Array.isArray(listings)?listings:localList,loading=!Array.isArray(listings)&&localLoading;
 useEffect(()=>{if(!Array.isArray(listings))load()},[refreshToken,listings]);
 function open(a){if(lock.current||uploads.current.size)return;setEditor(a?editing(a):fresh());request.current=key();setErrors({});setNotice(null);}
 function close(){if(lock.current||uploads.current.size)return;setEditor(null);setErrors({});setNotice(null);}
 function change(k,v){setEditor(p=>p?{...p,[k]:v}:p);setErrors(old=>{const next={...old};delete next[k];return next;});}
 function changeVariant(id,k,v){setEditor(p=>p?{...p,variants:p.variants.map(row=>row.key===id?{...row,[k]:v}:row)}:p);setErrors(old=>{const next={...old};const i=editor?.variants.findIndex(row=>row.key===id);delete next['variants.'+i+'.'+k];return next;});}
 function removeVariant(id){setEditor(p=>({...p,variants:p.variants.filter(v=>v.key!==id)}));setErrors({});}
 function addVariant(){setEditor(p=>({...p,variants:[...p.variants,variant()]}));setErrors({});}
 function splitLegacy(row){
  // O estoque agregado não é distribuído automaticamente: o fornecedor informa cada quantidade.
  setEditor(p=>({...p,variants:p.variants.flatMap(v=>v.key!==row.key?[v]:v.sizes.map(size=>({...v,key:key(),id:null,sku:'',expected_stock:undefined,sizes:[size],stock:'',supplier_available:false})))}));setErrors({});
 }
 function focusFields(fields){setErrors(fields||{});const first=Object.keys(fields||{})[0];if(first)requestAnimationFrame(()=>{const el=Array.from(formRef.current?.querySelectorAll('[data-field]')||[]).find(e=>e.dataset.field===first);el?.scrollIntoView({block:'center',behavior:'smooth'});el?.querySelector('input,select,textarea,button')?.focus({preventScroll:true});});}
 async function upload(row,file,i){if(!file||lock.current||uploads.current.has(row.key))return;uploads.current.add(row.key);setUploading(o=>({...o,[row.key]:true}));try{const f=new FormData();f.set('file',file);const r=await fetch('/api/suppliers/upload',{method:'POST',body:f});const j=await r.json();if(!r.ok||!j.url)throw Error(j.error||'Falha no envio da foto.');changeVariant(row.key,'image_url',j.url);}catch(e){setErrors(o=>({...o,['variants.'+i+'.image_url']:e.message}));}finally{uploads.current.delete(row.key);setUploading(o=>({...o,[row.key]:false}));}}
 async function save(e){
  e.preventDefault();if(lock.current||uploads.current.size||!editor)return;
  const payload={...editor,variants:editor.variants.map(v=>({...v,cost_cents:listingMoney(v.cost_cents)})),request_id:request.current};
  const checked=validateListing(payload,categoryRootSlug(categories,editor.category_id));
  if(Object.keys(checked.errors).length){focusFields(checked.errors);return;}
  lock.current=true;setBusy(true);setErrors({});setNotice(null);
  try{const result=await api(editor.id?'edit':'submit',payload);
   setEditor(null);setNotice({error:false,text:result.status==='inactive'?'Alterações salvas. O anúncio continua inativo.':'Anúncio enviado com sucesso! Aguardando aprovação da equipe VELLOR.'});
   if(onChanged)await onChanged();else await load();
  }catch(e){focusFields(e.fields);setNotice({error:true,text:e.fields?'Revise os campos destacados.':e.message});}finally{lock.current=false;setBusy(false);}
 }
 async function action(a,kind){
  if(lock.current||uploads.current.size)return;
  const confirmText=kind==='delete'?'Excluir este anúncio? Ele sairá da loja e das listagens. Os pedidos anteriores serão preservados.':kind==='deactivate'?'Inativar este anúncio? Ele ficará indisponível para novas compras.':'Enviar este anúncio novamente para aprovação?';
  if(!window.confirm(confirmText))return;
  lock.current=true;setBusy(true);setNotice(null);
  try{await api(kind,{id:a.id,kind:a.kind,revision:a.revision});setNotice({error:false,text:kind==='delete'?'Anúncio excluído.':kind==='deactivate'?'Anúncio inativado.':'Anúncio encaminhado para aprovação.'});if(onChanged)await onChanged();else await load();}
  catch(e){setNotice({error:true,text:e.fields?'Edite e regularize as variações antes de reativar.':e.message});}finally{lock.current=false;setBusy(false);}
 }
 const root=editor?categoryRootSlug(categories,editor.category_id):'';
 const disabled=busy||uploads.current.size>0;
 const filtered=list.filter(a=>(filter==='all'||a.status===filter)&&(!query.trim()||[a.name,a.product_code,...(a.variants||[]).map(v=>v.sku)].join(' ').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))));
 const fieldAttrs=n=>({id:'listing-'+n,'aria-invalid':Boolean(errors[n]),'aria-describedby':errors[n]?'listing-error-'+n:undefined});
 return <section className={'card '+styles.panel}>
  <div className={styles.head}><h2>Meus anúncios</h2>{!editor&&<button type="button" className="btn gold" disabled={disabled} onClick={()=>open()}>+ Novo anúncio</button>}</div>
  {notice&&<p role={notice.error?'alert':'status'} aria-live="polite" className={'notice '+(notice.error?'error':'ok')}>{notice.text}</p>}
  {editor?<form ref={formRef} onSubmit={save} noValidate>
   <h3>{editor.id?'Editar anúncio':'Novo anúncio'}</h3>
   <fieldset disabled={busy} className={styles.fields}>
   <Field name="name" label="Nome do produto" error={errors.name}><input {...fieldAttrs('name')} value={editor.name} onChange={e=>change('name',e.target.value)} maxLength={220}/></Field>
   <Field name="description" label="Descrição" error={errors.description}><textarea {...fieldAttrs('description')} value={editor.description||''} onChange={e=>change('description',e.target.value)} maxLength={4000}/></Field>
   <Field name="department" label="Departamento" error={errors.department}><select {...fieldAttrs('department')} value={editor.department||''} onChange={e=>change('department',e.target.value)}><option value="">Selecione</option><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></Field>
   <div data-field="category_id" className={errors.category_id?styles.invalid:undefined}><CategoryPicker categories={categories} value={editor.category_id} onChange={v=>change('category_id',v)}/>{errors.category_id&&<p className={styles.error} role="alert">{errors.category_id}</p>}</div>
   <h3>Variações</h3>
   {errors.variants&&<p className={styles.error} data-field="variants">{errors.variants}</p>}
   {editor.variants.map((v,i)=>{
    const prefix='variants.'+i+'.',legacy=v.sizes.length>1||v.id&&v.sizes.length!==1;
    const fixed=!!v.id&&!legacy;
    const sizes=root==='calcados'?SHOE_SIZES:root==='vestuario'?['PP','P','M','G','GG','XG','XXG','Único']:['Único','P','M','G'];
    const text=(name,label,type='text')=><Field key={name} name={prefix+name} label={label} error={errors[prefix+name]}><input {...fieldAttrs(prefix+name)} type={type} min={type==='number'?0:undefined} step={type==='number'?1:undefined} inputMode={name==='cost_cents'?'decimal':undefined} readOnly={name==='sku'&&!!v.id} value={v[name]??''} onChange={e=>changeVariant(v.key,name,e.target.value)}/></Field>;
    return <div className={styles.variant} key={v.key}><div className={styles.head}><h4>Variação {i+1}{v.label?' — '+v.label:''}{v.sizes.length?' / '+v.sizes.join(', '):''}</h4><button type="button" className="tiny danger" disabled={disabled||editor.variants.length===1} onClick={()=>removeVariant(v.key)}>Remover</button></div>
     {legacy&&<p className={styles.error}>Esta variação antiga precisa ser substituída por combinações individuais. {v.sizes.length>1&&<button type="button" className="tiny" disabled={disabled||editor.variants.length+v.sizes.length-1>LISTING_LIMIT} onClick={()=>splitLegacy(v)}>Separar tamanhos</button>}{v.sizes.length===0&&<button type="button" className="tiny" disabled={disabled} onClick={()=>{changeVariant(v.key,'id',null);changeVariant(v.key,'sku','');}}>Criar nova combinação</button>}</p>}
     <div className={styles.grid}>
      <Field name={prefix+'label'} label="Cor / modelo" error={errors[prefix+'label']}><input {...fieldAttrs(prefix+'label')} list={'colors-'+v.key} readOnly={fixed} value={v.label} onChange={e=>changeVariant(v.key,'label',e.target.value)} maxLength={120}/><datalist id={'colors-'+v.key}>{CLOTHING_COLORS.map(([c])=><option value={c} key={c}/>)}</datalist></Field>
      <Field name={prefix+'sizes'} label={root==='calcados'?'Numeração (BR)':'Tamanho'} error={errors[prefix+'sizes']}><input {...fieldAttrs(prefix+'sizes')} list={'sizes-'+v.key} readOnly={fixed||legacy} value={v.sizes.join(', ')} onChange={e=>changeVariant(v.key,'sizes',[e.target.value])} maxLength={30}/><datalist id={'sizes-'+v.key}>{sizes.map(x=><option value={x} key={x}/>)}</datalist></Field>
      {text('sku','SKU (opcional se novo)')}{text('cost_cents','Preço do fornecedor (R$)')}
      <Field name={prefix+'stock_mode'} label="Estoque" error={errors[prefix+'stock_mode']}><select {...fieldAttrs(prefix+'stock_mode')} value={v.stock_mode} onChange={e=>changeVariant(v.key,'stock_mode',e.target.value)}><option value="quantity">Quantidade exata</option><option value="availability">Disponibilidade</option></select></Field>
      {v.stock_mode==='quantity'&&text('stock','Quantidade em estoque','number')}
      <div className="field"><label><input type="checkbox" checked={v.supplier_available!==false} onChange={e=>changeVariant(v.key,'supplier_available',e.target.checked)}/> Disponível</label></div>
      {text('preparation_days','Preparação (dias úteis)','number')}{text('delivery_days_min','Entrega mínima (dias úteis)','number')}{text('delivery_days_max','Entrega máxima (dias úteis)','number')}{text('image_url','URL da imagem (opcional)')}
      <div className="field"><label htmlFor={'upload-'+v.key}>Enviar foto</label><input id={'upload-'+v.key} type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading[v.key])} onChange={e=>upload(v,e.target.files?.[0],i)}/>{uploading[v.key]&&<span role="status">Enviando foto...</span>}</div>
      {v.image_url&&<img className="app-variant-preview" src={v.image_url} alt={'Foto '+(v.label||'da variação')}/>}
     </div></div>;
   })}
   <div className={styles.head}><button type="button" className="btn ghost" disabled={disabled||editor.variants.length>=LISTING_LIMIT} onClick={addVariant}>+ Variação</button><button type="button" className="btn ghost" disabled={disabled} onClick={close}>Cancelar</button><button className="btn gold" disabled={disabled}>{busy?'Enviando...':editor.status==='inactive'?'Salvar alterações':'Enviar para aprovação'}</button></div>
   </fieldset>
  </form>:<>
   <div className={styles.grid}><div className="field"><label htmlFor="listing-search">Buscar anúncio</label><input id="listing-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, código ou SKU"/></div><div className="field"><label htmlFor="listing-filter">Status</label><select id="listing-filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option>{Object.entries(statusLabel).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div></div>
   {loading?<p role="status">Carregando anúncios...</p>:filtered.length===0?<p>Nenhum anúncio encontrado.</p>:filtered.map(a=><article key={a.kind+':'+a.id} className={styles.variant}><div className={styles.head}><div><strong>{a.name}</strong><p className="small">{a.product_code||''} · {a.variants?.length||0} variação(ões)</p></div><span className={styles.status} data-status={a.status}>{statusLabel[a.status]||a.status}</span></div>
   {a.admin_note&&a.status==='rejected'&&<p className="small">{a.admin_note}</p>}
   <div className={styles.head}><button type="button" className="tiny" aria-expanded={!!expanded[a.id]} onClick={()=>setExpanded(o=>({...o,[a.id]:!o[a.id]}))}>{expanded[a.id]?'Ocultar':'Visualizar'}</button><button type="button" className="tiny" disabled={disabled} onClick={()=>open(a)}>Editar</button><button type="button" className="tiny" disabled={disabled} onClick={()=>action(a,a.status==='inactive'?'reactivate':'deactivate')}>{a.status==='inactive'?'Reativar':'Inativar'}</button><button type="button" className="tiny danger" disabled={disabled} onClick={()=>action(a,'delete')}>Excluir</button></div>
   {expanded[a.id]&&<div className="tablewrap"><table><thead><tr><th>SKU</th><th>Cor / modelo</th><th>Tamanho</th><th>Fornecimento</th><th>Estoque</th></tr></thead><tbody>{a.variants?.map((v,i)=><tr key={v.id||v.key||i}><td>{v.sku||'—'}</td><td>{v.label}</td><td>{v.sizes?.join(', ')||'—'}</td><td>{money(v.cost_cents)}</td><td>{v.stock_mode==='quantity'?v.stock??0:v.supplier_available!==false?'Disponível':'Indisponível'}</td></tr>)}</tbody></table></div>}
   </article>)}
  </>}
 </section>;
}
