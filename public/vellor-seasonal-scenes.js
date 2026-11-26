/* Local, trusted seasonal artwork; each visible object can respond independently. */
(()=>{'use strict';
if(!window.customElements||customElements.get('vellor-seasonal-scene'))return;
const assets=Object.freeze({reveillon:'balls',carnaval:'confetti',pascoa:'eggs',maes:'flowers',namorados:'hearts',pais:'stars',halloween:'pumpkins',blackfriday:'tags',natal:'christmas'});
const cache=new Map();let seq=0;
const allowed=new Set(['svg','defs','radialGradient','linearGradient','stop','filter','feDropShadow','mask','rect','g','ellipse','path','circle']);
function parse(source){
 const d=new DOMParser().parseFromString(source,'image/svg+xml'),svg=d.documentElement;
 if(svg.localName!=='svg'||svg.namespaceURI!=='http://www.w3.org/2000/svg')throw Error('Invalid seasonal SVG');
 const prefix='vll-season-'+(++seq)+'-';
 for(const el of [svg,...svg.querySelectorAll('*')]){
  if(!allowed.has(el.localName)||el.namespaceURI!==svg.namespaceURI)throw Error('Invalid seasonal artwork tag');
  for(const a of [...el.attributes]){
   if(/^on/i.test(a.name)||/^(?:href|xlink:href|style|src)$/i.test(a.name))throw Error('Invalid seasonal artwork attribute');
   if(a.value.includes('url(')&&!/^(?:url\(#[\w-]+\))$/.test(a.value))throw Error('Invalid seasonal artwork reference');
   if(a.name==='id')el.setAttribute('id',prefix+a.value);
   else if(a.value.startsWith('url(#'))el.setAttribute(a.name,a.value.replace('url(#','url(#'+prefix));
  }
 }
 svg.removeAttribute('aria-hidden');svg.setAttribute('role','group');svg.setAttribute('aria-label','Decoração comemorativa interativa');svg.setAttribute('focusable','false');svg.setAttribute('class','campaign-scene-art');
 return document.importNode(svg,true);
}
function load(theme){
 if(!Object.hasOwn(assets,theme))return Promise.reject(Error('Invalid theme'));
 if(!cache.has(theme))cache.set(theme,fetch('/campaign-'+assets[theme]+'.svg?v=4',{cache:'force-cache',credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Seasonal art unavailable');return r.text()}).catch(e=>{cache.delete(theme);throw e}));
 return cache.get(theme);
}
class SeasonalScene extends HTMLElement{
 static get observedAttributes(){return ['data-theme']}
 connectedCallback(){this.render();this.observeSpace()}
 disconnectedCallback(){this.revision=(this.revision||0)+1;this.observer?.disconnect();if(this.frame)cancelAnimationFrame(this.frame);this.frame=0}
 attributeChangedCallback(){if(this.isConnected)this.render()}
 observeSpace(){
  this.observer?.disconnect();const host=this.parentElement;if(!host)return;
  const schedule=()=>{if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;if(!this.isConnected)return;this.measure()})};
  if(window.ResizeObserver){this.observer=new ResizeObserver(schedule);for(const el of [host,...host.querySelectorAll(':scope > .brand,:scope > .vll-brand,:scope > img,:scope > .hd-left,:scope > .hd-right,:scope > .vll-header-left,:scope > .vll-header-right')])this.observer.observe(el)}
  schedule();
 }
 measure(){
  const host=this.parentElement,logo=host?.querySelector(':scope > .brand,:scope > .vll-brand,:scope > img');if(!host||!logo)return;
  const a=host.getBoundingClientRect(),b=logo.getBoundingClientRect(),left=this.classList.contains('left');
  const gap=a.width<=760?4:10;
  // Decorations hug the actual header edge. Navigation is layered above them.
  const edge=0;
  const available=Math.floor((left?b.left-a.left:a.right-b.right)-edge-gap);
  this.style.setProperty('--scene-edge',edge+'px');this.style.setProperty('--scene-available',Math.max(0,available)+'px');
  this.toggleAttribute('data-no-space',available<24);
 }
 async render(){
  const theme=this.getAttribute('data-theme');const revision=this.revision=(this.revision||0)+1;
  this.removeAttribute('data-scene-ready');this.replaceChildren();
  if(!Object.hasOwn(assets,theme||''))return;
  try{
   const source=await load(theme);if(!this.isConnected||this.revision!==revision)return;
   const svg=parse(source);
   for(const item of svg.querySelectorAll('[data-motion]')){
    item.setAttribute('role','button');item.setAttribute('tabindex','0');item.setAttribute('aria-label',item.getAttribute('data-label')||'Animar enfeite');
    let timer;const activate=()=>{clearTimeout(timer);item.classList.remove('is-active');void item.getBoundingClientRect();item.classList.add('is-active');timer=setTimeout(()=>item.classList.remove('is-active'),1300)};
    item.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')activate()});
    item.addEventListener('click',e=>{e.stopPropagation();activate()});
    item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});
   }
   this.append(svg);this.setAttribute('data-scene-ready','');this.measure();
  }catch{/* Static background remains available if the local artwork cannot load. */}
 }
}
customElements.define('vellor-seasonal-scene',SeasonalScene);
})();