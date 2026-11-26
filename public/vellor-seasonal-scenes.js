/* Portable SVG scene renderer; animated CSS fallback if inline SVG fails. */
(function(){'use strict';
if(window.__vellorSeasonalScenes)return;window.__vellorSeasonalScenes=true;
var assets={reveillon:'balls',carnaval:'confetti',pascoa:'eggs',maes:'flowers',namorados:'hearts',pais:'stars',halloween:'pumpkins',blackfriday:'tags',natal:'christmas'};
var allowed=['svg','defs','radialGradient','linearGradient','stop','filter','feDropShadow','mask','rect','g','ellipse','path','circle','image','text'];
var cache={},seq=0,scenes=[],scheduled=false,root=document.documentElement;
var arr=function(x){return Array.prototype.slice.call(x)};
var has=function(k){return Object.prototype.hasOwnProperty.call(assets,k)};
function parse(source){
 var d=new DOMParser().parseFromString(source,'image/svg+xml'),svg=d.documentElement;
 if(svg.localName!=='svg'||svg.namespaceURI!=='http://www.w3.org/2000/svg'||d.getElementsByTagName('parsererror').length)throw Error('Invalid seasonal SVG');
 var prefix='vll-season-'+(++seq)+'-';
 [svg].concat(arr(svg.querySelectorAll('*'))).forEach(function(el){
  if(allowed.indexOf(el.localName)<0||el.namespaceURI!==svg.namespaceURI)throw Error('Invalid seasonal artwork tag');
  arr(el.attributes).forEach(function(a){
   if(a.name==='href'&&el.localName==='image'&&a.value==='/logo-vellor-wear.svg'){el.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',a.value);return}
   if(/^on/i.test(a.name)||/^(?:href|xlink:href|style|src)$/i.test(a.name))throw Error('Invalid seasonal artwork attribute');
   if(a.value.indexOf('url(')!==-1&&!/^url\(#[\w-]+\)$/.test(a.value))throw Error('Invalid seasonal artwork reference');
   if(a.name==='id')el.setAttribute('id',prefix+a.value);
   else if(a.value.indexOf('url(#')===0)el.setAttribute(a.name,a.value.replace('url(#','url(#'+prefix));
  });
 });
 svg.removeAttribute('aria-hidden');svg.setAttribute('role','group');svg.setAttribute('aria-label','Decoração comemorativa interativa');svg.setAttribute('focusable','false');svg.setAttribute('class','campaign-scene-art');
 return document.importNode(svg,true);
}
function load(theme,side,done){
 var key=theme+':'+side;if(typeof cache[key]==='string'){done(null,cache[key]);return}
 if(Array.isArray(cache[key])){cache[key].push(done);return}
 cache[key]=[done];var xhr=new XMLHttpRequest();
 function finish(err){var listeners=cache[key];if(!Array.isArray(listeners))return;if(err)delete cache[key];else cache[key]=xhr.responseText;listeners.forEach(function(cb){cb(err,err?null:xhr.responseText)})}
 xhr.open('GET','/campaign-'+assets[theme]+(side==='right'?'-right':'')+'.svg?v=7',true);xhr.timeout=12000;
 xhr.onload=function(){finish(xhr.status>=200&&xhr.status<300?null:Error('Seasonal art unavailable'))};xhr.onerror=xhr.ontimeout=function(){finish(Error('Seasonal art unavailable'))};try{xhr.send()}catch(e){finish(e)}
}
function clear(host){while(host.firstChild)host.removeChild(host.firstChild)}
function attached(host){return root.contains(host)}
function fallback(host,theme){
 clear(host);host.removeAttribute('data-scene-ready');host.setAttribute('data-scene-fallback','');
 var layer=document.createElement('span');layer.className='campaign-fallback-atmosphere';layer.setAttribute('aria-hidden','true');
 var kinds={natal:'snow',halloween:'bat',blackfriday:'coupon',maes:'petal',namorados:'petal',carnaval:'confetti',pais:'confetti',reveillon:'spark',pascoa:'spark'};
 var kind=kinds[theme]||'spark';for(var i=0;i<9;i++){var p=document.createElement('i');p.className='campaign-fallback-particle '+kind;p.style.left=((i*37)%88+3)+'%';p.style.animationDelay=(-i*.71)+'s';if(kind==='coupon')p.textContent='%';layer.appendChild(p)}host.appendChild(layer)
}
function measure(host){
 var parent=host.parentNode;if(!parent||!parent.getBoundingClientRect)return;
 var logo=null;for(var i=0;i<parent.children.length;i++){var child=parent.children[i];if(child.classList.contains('brand')||child.classList.contains('vll-brand')||child.tagName==='IMG'){logo=child;break}}
 if(!logo)return;var a=parent.getBoundingClientRect(),b=logo.getBoundingClientRect(),left=host.classList.contains('left');
 if(a.width<1||b.width<1)return;
 var gap=a.width<=760?4:10;const edge=0;
 var available=Math.floor((left?b.left-a.left:a.right-b.right)-edge-gap);
 var target=a.width<=760?Math.min(70,Math.max(34,a.width*.12)):Math.min(168,Math.max(72,a.width*.11));
 var intensity=parent.getAttribute('data-season-intensity')||root.getAttribute('data-season-intensity');
 if(intensity==='moderada')target=a.width<=760?Math.min(83,Math.max(42,a.width*.14)):Math.min(190,Math.max(90,a.width*.13));
 if(intensity==='festiva')target=a.width<=760?Math.min(94,Math.max(48,a.width*.16)):Math.min(218,Math.max(112,a.width*.15));
 if(parent.classList.contains('campaign-admin-preview'))target=Math.min(135,a.width*(intensity==='festiva'?0.23:intensity==='moderada'?0.19:0.15));
 var w=Math.max(0,Math.min(available,target,a.height*160/88));host.style.width=w+'px';host.style.setProperty('height',(w*88/160)+'px','important');
 if(available<24)host.setAttribute('data-no-space','');else host.removeAttribute('data-no-space')
}
function render(host,state){
 var theme=host.getAttribute('data-theme'),side=host.classList.contains('right')?'right':'left';
 if(!has(theme)){clear(host);host.removeAttribute('data-scene-ready');return}
 var rev=++state.rev;fallback(host,theme);measure(host);
 load(theme,side,function(err,source){
  if(!attached(host)||state.rev!==rev)return;
  if(err){if(++state.failures<=2)state.timer=setTimeout(function(){if(attached(host)&&state.rev===rev)render(host,state)},state.failures*2500);return}
  try{var svg=parse(source);
   arr(svg.querySelectorAll('[data-motion]')).forEach(function(item){
    item.setAttribute('role','button');item.setAttribute('tabindex','0');item.setAttribute('aria-label',item.getAttribute('data-label')||'Animar enfeite');
    var timer;function activate(){clearTimeout(timer);item.classList.remove('is-active');void item.getBoundingClientRect();item.classList.add('is-active');timer=setTimeout(function(){item.classList.remove('is-active')},1300)}
    item.addEventListener(window.PointerEvent?'pointerenter':'mouseenter',function(e){if(!e.pointerType||e.pointerType==='mouse')activate()});
    item.addEventListener('click',function(e){e.stopPropagation();activate()});
    item.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '||e.keyCode===13||e.keyCode===32){e.preventDefault();activate()}});
   });
   clear(host);host.appendChild(svg);host.removeAttribute('data-scene-fallback');host.setAttribute('data-scene-ready','');measure(host)
  }catch(e){/* The independent fallback stays visible and animated. */}
 })
}
// Campaign activation is controlled only by the administration panel.
root.removeAttribute('data-season-motion');
try{localStorage.removeItem('vellor-season-motion')}catch(e){}
var resize=window.ResizeObserver?new ResizeObserver(function(){scenes.forEach(function(s){measure(s.host)})}):null;
function scan(){scheduled=false;scenes=scenes.filter(function(s){if(attached(s.host))return true;clearTimeout(s.timer);s.rev++;if(resize&&s.parent&&!attached(s.parent))resize.unobserve(s.parent);return false});
 arr(document.querySelectorAll('vellor-seasonal-scene.campaign-ornament')).forEach(function(host){var s=null;for(var i=0;i<scenes.length;i++)if(scenes[i].host===host){s=scenes[i];break}
 if(!s){s={host:host,parent:host.parentNode,rev:0,failures:0,theme:null};scenes.push(s);if(resize&&s.parent)resize.observe(s.parent)}
 var theme=host.getAttribute('data-theme');if(s.theme!==theme){s.theme=theme;s.failures=0;clearTimeout(s.timer);render(host,s)}measure(host)})}
function schedule(){if(scheduled)return;scheduled=true;(window.requestAnimationFrame||function(f){setTimeout(f,16)})(scan)}
if(window.MutationObserver)new MutationObserver(schedule).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-theme','data-season','data-season-intensity','hidden']});else setInterval(schedule,1500);
window.addEventListener('resize',schedule);window.addEventListener('load',schedule);window.addEventListener('pageshow',schedule);document.addEventListener('visibilitychange',function(){if(!document.hidden)schedule()});
schedule()
})();
