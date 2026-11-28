// Same values used by administration, supplier and the server.
export const SHOE_SIZES=Object.freeze(Array.from({length:16},(_,i)=>String(i+33)));
export const CLOTHING_COLORS=Object.freeze([
 ['Preto','#202020'],['Branco','#ffffff'],['Cinza','#9ca3af'],['Chumbo','#475569'],['Azul-marinho','#162b49'],['Azul','#2563eb'],['Azul-claro','#9bc7ed'],['Verde','#287446'],['Verde-militar','#586342'],['Bege','#d8c2a1'],['Marrom','#805637'],['Caramelo','#b97c40'],['Vinho','#77263c'],['Vermelho','#c63139'],['Rosa','#e6a0b5'],['Roxo','#7856a1'],['Amarelo','#eac54b'],['Laranja','#e47d32'],['Creme','#f5eddb'],['Estampado',null],['Multicolorido',null]
].map(Object.freeze));
export function categoryRootSlug(categories,categoryId){
 const selected=(categories||[]).find(c=>c.id===categoryId);
 if(!selected)return '';
 return selected.parent_slug||(categories||[]).find(c=>c.id===selected.parent_id)?.slug||selected.slug||'';
}
export function normalizeVariantSizes(raw){
 const list=Array.isArray(raw)?raw:typeof raw==='string'?raw.split(','):[];
 return [...new Set(list.map(s=>String(s??'').trim()).filter(s=>s&&s.length<=30))].slice(0,40);
}
export function validFootwearSizes(sizes){
 return sizes.length>0&&sizes.every(s=>/^\d{2}$/.test(s)&&Number(s)>=20&&Number(s)<=60);
}

export const WATCH_SIZE='ÚNICO';
export const QUICK_COLORS=Object.freeze(['Preto','Branco','Cinza','Azul','Verde','Bege','Marrom','Vermelho'].map(name=>CLOTHING_COLORS.find(c=>c[0]===name)));
export const WATCH_COLORS=Object.freeze([['Preto','#202020'],['Prata','#c0c0c0'],['Dourado','#c9a24e'],['Rosé','#c88c83'],['Grafite','#475569'],['Branco','#ffffff'],['Azul','#2563eb'],['Marrom','#805637']].map(Object.freeze));
// Pulseiras e estojos não são relógios; conservar o comportamento anterior.
export function isWatchCategory(root,leaf=root){return root==='relogios'&&!['pulseiras-para-relogios','estojos-e-organizadores'].includes(leaf);}
export function variantRootSlug(categories,categoryId){const root=categoryRootSlug(categories,categoryId),leaf=(categories||[]).find(c=>c.id===categoryId)?.slug;return root==='relogios'&&!isWatchCategory(root,leaf)?leaf:root;}
export function quickColors(root){return root==='relogios'?WATCH_COLORS:QUICK_COLORS;}
