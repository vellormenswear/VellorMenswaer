(()=>{if(window.__vellorCampaigns)return;window.__vellorCampaigns=true;
 const themes=new Set(["reveillon","carnaval","pascoa","maes","namorados","pais","halloween","blackfriday","natal","custom"]);let last=null;
 function apply(c){const root=document.documentElement;const decorated=c&&c.decoration&&themes.has(c.theme)&&c.theme!=='custom';if(decorated){root.dataset.season=c.theme;root.dataset.seasonIntensity=c.intensity}else{delete root.dataset.season;delete root.dataset.seasonIntensity}
 const header=document.querySelector('.site-header,.vll-site-header');if(!header)return;
 for(const side of ['left','right']){let o=header.querySelector('.campaign-ornament.'+side);if(!o){o=document.createElement('span');o.className='campaign-ornament '+side;o.setAttribute('aria-hidden','true');header.append(o)}}
 let banner=document.getElementById('vellor-campaign-announcement');if(!banner){banner=document.createElement('aside');banner.id='vellor-campaign-announcement';banner.className='campaign-announcement';banner.append(document.createElement('strong'),document.createElement('small'));header.after(banner)}
 banner.hidden=!(c&&(c.headline||c.message));banner.firstChild.textContent=c?.headline||'';banner.lastChild.textContent=c?.message||'';
 }
 async function refresh(){try{const r=await fetch('/api/store/campaign',{cache:'no-store'});if(!r.ok)return;const {campaign:c}=await r.json();apply(c);const key=c?c.id+'|'+c.updated_at:null;if(last!==key){const prior=last;last=key;if(prior!==null||key!==null)window.dispatchEvent(new Event('vellor:campaignchange'))}}catch{}}
 refresh();setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});window.addEventListener('pageshow',refresh);
})();
