// Read inert HTML only. Use explicit product galleries and image properties,
// rather than importing every image on the page (logos, recommendations, ads).
import {supplierUrl} from './supplier-public-fetch.mjs';
const entity=s=>String(s??'').replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d{1,7}|#x[0-9a-f]{1,6});/gi,m=>{const k=m.slice(1,-1).toLowerCase(),names={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};if(Object.hasOwn(names,k))return names[k];const n=k.startsWith('#x')?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):m;});
const text=(s,max)=>entity(s).replace(/\s+/g,' ').trim().slice(0,max);
function attrs(tag){
 const result=Object.create(null);
 for(const m of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/g)){
  const k=m[1].toLowerCase();if(!Object.hasOwn(result,k))result[k]=entity(m[2]??m[3]??m[4]);
 }
 return result;
}
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const galleryNames=new Set(['product-gallery','product-image-gallery','product-media-gallery','product__media-gallery','product__media-list','woocommerce-product-gallery','ui-pdp-gallery','product-images','product-image-slider','product-gallery__images','product-photos','product-detail-gallery','product-image-carousel']);
const excludedNames=/^(?:related(?:[-_].*)?|recommendations?(?:[-_].*)?|upsells?|cross[-_]?sells?|banner(?:[-_].*)?|logo(?:[-_].*)?|reviews?(?:[-_].*)?|advert(?:[-_].*)?|social(?:[-_].*)?)$/i;
function validImage(raw,base){
 if(typeof raw!=='string'||!raw.trim()||/^data:|^blob:/i.test(raw))return '';
 try{const u=supplierUrl(new URL(raw,base).href);if(u.href.length>1000||/\.(?:svg|ico)(?:$|[?#])/i.test(u.href)||/(?:^|[\/_-])(?:placeholder|spacer|transparent|pixel|logo|sprite|favicon)(?:[\/_.-]|$)/i.test(u.pathname))return '';return u.href}catch{return ''}
}
function responsive(raw,base){
 const candidates=[];
 for(const m of String(raw||'').matchAll(/(?:^|,)\s*([^\s,]+)(?:\s+(\d+(?:\.\d+)?)([wx]))?\s*(?=,|$)/g)){
  const url=validImage(m[1],base);if(url)candidates.push({url,score:m[3]==='w'?Number(m[2]):m[3]==='x'?Number(m[2])*1000:1});
 }
 return candidates.sort((a,b)=>b.score-a.score)[0]?.url||'';
}
function source(a,base){
 if((Number(a.width)>0&&Number(a.width)<80)||(Number(a.height)>0&&Number(a.height)<80))return '';
 for(const value of [a['data-zoom-image'],a['data-large_image'],a['data-full'],a['data-original'],responsive(a['data-srcset'],base),responsive(a.srcset,base),a['data-src'],a['data-lazy-src'],a.src,a.content,a.href]){
  const url=validImage(value,base);if(url)return url;
 }
 return '';
}
export function extractProductPageImages(html,base){
 // Ignore raw text, comments and templates; never execute scripts or inspect private sessions.
 const cleaned=String(html).replace(/<!--[\s\S]*?-->|<(script|style|template|noscript|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const stack=[],photos=[],titles=[],microNames=[],descriptions=[],categories=[];
 let galleryRoots=0,productRoots=0;
 const add=url=>{if(url&&!photos.includes(url)&&photos.length<30)photos.push(url)};
 for(const match of cleaned.matchAll(/<\/?[a-zA-Z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g)){
  const token=match[0];
  if(token[0]!=='<'){
   const frame=stack.at(-1);if(frame&&!frame.excluded){for(const capture of frame.captures)if(capture.value.length<4000)capture.value+=token.slice(0,4000-capture.value.length);}
   continue;
  }
  const close=token.match(/^<\/([\w:-]+)/);if(close){const tag=close[1].toLowerCase(),at=stack.map(f=>f.tag).lastIndexOf(tag);if(at>=0)stack.length=at;continue;}
  const name=token.match(/^<([\w:-]+)/);if(!name)continue;
  const tag=name[1].toLowerCase(),a=attrs(token),parent=stack.at(-1);
  const cls=(String(a.class||'')+' '+String(a.id||'')).split(/\s+/).filter(Boolean);
  const excluded=Boolean(parent?.excluded||['header','footer','nav','aside'].includes(tag)||cls.some(x=>excludedNames.test(x)));
  const product=!excluded&&String(a.itemtype||'').split(/\s+/).some(x=>/^https?:\/\/schema\.org\/Product$/i.test(x));
  if(product)productRoots++;
  const inProduct=!excluded&&(product||parent?.inProduct)&&!String(a.itemtype||'').split(/\s+/).some(x=>/^https?:\/\/schema\.org\/(?:Organization|Brand|Review|AggregateRating)$/i.test(x));
  const ownGallery=!excluded&&(tag==='media-gallery'||cls.some(x=>galleryNames.has(x)));
  if(ownGallery&&!parent?.gallery)galleryRoots++;
  const gallery=!excluded&&(ownGallery||parent?.gallery);
  const prop=String(a.itemprop||'').split(/\s+/);
  const captures=excluded?[]:[...(parent?.captures||[])];
  const capture=(list,value='')=>{const c={value};list.push(c);captures.push(c)};
  if(!excluded&&tag==='h1')capture(titles,a.content||'');
  if(inProduct&&prop.includes('name'))capture(microNames,a.content||'');
  if(inProduct&&prop.includes('description'))capture(descriptions,a.content||'');
  if(inProduct&&prop.includes('category'))capture(categories,a.content||'');
  if(!excluded){
   if((gallery&&['img','source'].includes(tag))||(inProduct&&prop.includes('image')&&['img','source','meta','link','a'].includes(tag)))add(source(a,base));
   if(gallery&&tag==='a'&&/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(a.href||''))add(validImage(a.href,base));
   if(gallery&&a.style){for(const m of a.style.matchAll(/background-image\s*:\s*url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]+))\s*\)/gi))add(validImage(m[1]??m[2]??m[3],base))}
  }
  if(!voidTags.has(tag)&&!token.endsWith('/>')){if(stack.length>=128)return {identified:false,name:'',description:'',category:'',photos:[]};stack.push({tag,excluded,inProduct,gallery,captures});}
 }
 const unique=(list,max)=>[...new Set(list.map(x=>text(x.value,max)).filter(Boolean))];
 const names=unique(microNames,220),heads=unique(titles,220),desc=unique(descriptions,4000),cats=unique(categories,200);
 const single=productRoots<=1&&galleryRoots<=1;
 const identified=single&&(productRoots===1&&names.length===1||galleryRoots===1&&heads.length===1);
 return {identified,name:identified?(names[0]||heads[0]||''):'',description:desc.length===1?desc[0]:'',category:cats.length===1?cats[0]:'',photos:single?photos:[]};
}
