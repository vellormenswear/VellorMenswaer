export const THEMES=Object.freeze({
  "reveillon": {
    "id": "reveillon",
    "name": "Réveillon",
    "headline": "Um novo ano. Uma nova versão de você.",
    "left": "#142538",
    "middle": "#24272e",
    "right": "#34303e",
    "accent": "#e6d8bb",
    "ornament": "balls",
    "month": 1,
    "day": 1
  },
  "carnaval": {
    "id": "carnaval",
    "name": "Carnaval",
    "headline": "Sua liberdade. Suas cores. Suas regras.",
    "left": "#103b36",
    "middle": "#252334",
    "right": "#421c46",
    "accent": "#e1bb68",
    "ornament": "confetti",
    "month": 0,
    "day": 0
  },
  "pascoa": {
    "id": "pascoa",
    "name": "Páscoa",
    "headline": "Renove-se. Reinvente-se. Surpreenda-se.",
    "left": "#483024",
    "middle": "#34272c",
    "right": "#38254c",
    "accent": "#d8be8a",
    "ornament": "eggs",
    "month": 0,
    "day": 0
  },
  "maes": {
    "id": "maes",
    "name": "Dia das Mães",
    "headline": "Para quem nos ensinou a ser quem somos.",
    "left": "#402637",
    "middle": "#35252d",
    "right": "#692a43",
    "accent": "#e5b0c0",
    "ornament": "flowers",
    "month": 0,
    "day": 0
  },
  "namorados": {
    "id": "namorados",
    "name": "Dia dos Namorados",
    "headline": "O amor começa nos detalhes.",
    "left": "#46202a",
    "middle": "#38242f",
    "right": "#702038",
    "accent": "#ec9fac",
    "ornament": "hearts",
    "month": 6,
    "day": 12
  },
  "pais": {
    "id": "pais",
    "name": "Dia dos Pais",
    "headline": "Para quem é mais que um exemplo.",
    "left": "#182e45",
    "middle": "#302b30",
    "right": "#483325",
    "accent": "#c7aa78",
    "ornament": "stars",
    "month": 0,
    "day": 0
  },
  "halloween": {
    "id": "halloween",
    "name": "Halloween",
    "headline": "Desperte seu lado mais ousado.",
    "left": "#60300f",
    "middle": "#29202b",
    "right": "#36164c",
    "accent": "#ee9b47",
    "ornament": "pumpkins",
    "month": 10,
    "day": 31
  },
  "blackfriday": {
    "id": "blackfriday",
    "name": "Black Friday",
    "headline": "O extraordinário nunca esteve tão ao seu alcance.",
    "left": "#141414",
    "middle": "#242119",
    "right": "#493616",
    "accent": "#e9c85c",
    "ornament": "tags",
    "month": 0,
    "day": 0
  },
  "natal": {
    "id": "natal",
    "name": "Natal",
    "headline": "O melhor presente é estar presente.",
    "left": "#103b2c",
    "middle": "#30252a",
    "right": "#66202b",
    "accent": "#d9bf82",
    "ornament": "christmas",
    "month": 12,
    "day": 25
  }
});
export const TZ='America/Sao_Paulo';
export const FEE_BUFFER_BPS=1500; // Reserva estimada de 15%; não substitui a tarifa contratual.
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function percentBps(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>=100||Math.abs(value*100-Math.round(value*100))>1e-6)throw Error('Percentual inválido (0 a 99,99).');return Math.round(value*100)}
export const MANUAL_CAMPAIGN_END='9999-12-31T23:59:59.000Z';
export function validCampaign(x){
 if(!x||typeof x!=='object'||!Object.hasOwn(THEMES,x.theme)&&x.theme!=='custom')throw Error('Tema inválido.');
 const name=String(x.name||'').trim(),headline=String(x.headline||'').trim(),message=String(x.message||'').trim();
 if(!name||name.length>100||headline.length>160||message.length>240)throw Error('Revise os textos da campanha.');
 // Dates are internal compatibility metadata, never a scheduling input.
 const start=new Date().toISOString(),end=MANUAL_CAMPAIGN_END;
 if(!['discreta','moderada','festiva'].includes(x.intensity)||typeof x.decoration!=='boolean'||typeof x.enabled!=='boolean'||typeof x.pix_accumulate!=='boolean')throw Error('Configuração inválida.');
 const rules=x.product_discounts||{},pix=x.pix_product_discounts||{};
 function validateRules(r){if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length>500)throw Error('Descontos individuais inválidos.');return Object.fromEntries(Object.entries(r).map(([id,n])=>{if(!idPattern.test(id))throw Error('Produto inválido.');return [id,percentBps(n)]}))}
 return {name,theme:x.theme,headline,message,starts_at:start,ends_at:end,enabled:x.enabled,decoration:x.decoration,intensity:x.intensity,store_bps:percentBps(x.store_percent),product_discounts:validateRules(rules),pix_bps:percentBps(x.pix_percent),pix_product_discounts:validateRules(pix),pix_accumulate:x.pix_accumulate};
}
export function easter(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return new Date(Date.UTC(year,Math.floor(n/31)-1,n%31+1))}
function weekday(year,month,day,occurrence){const first=new Date(Date.UTC(year,month-1,1));return new Date(Date.UTC(year,month-1,1+(day-first.getUTCDay()+7)%7+7*(occurrence-1)))}
export function eventDates(year){return Object.values(THEMES).map(t=>{let d=t.month?new Date(Date.UTC(year,t.month-1,t.day)):null;if(t.id==='pascoa')d=easter(year);if(t.id==='carnaval')d=new Date(easter(year).getTime()-47*86400000);if(t.id==='maes')d=weekday(year,5,0,2);if(t.id==='pais')d=weekday(year,8,0,2);if(t.id==='blackfriday')d=new Date(weekday(year,11,4,4).getTime()+86400000);return {...t,date:d.toISOString().slice(0,10)}})}
export function calendarReminders(now=new Date()){const local=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const v=Object.fromEntries(local.map(p=>[p.type,p.value]));const today=v.year+'-'+v.month+'-'+v.day;const days=Date.parse(today+'T00:00:00Z');return [Number(v.year),Number(v.year)+1].flatMap(year=>eventDates(year)).filter(e=>e.date>=today&&(e.date.slice(0,7)===today.slice(0,7)||Date.parse(e.date+'T00:00:00Z')-days<=7*86400000)).map(e=>({...e,year:Number(e.date.slice(0,4)),stage:Date.parse(e.date+'T00:00:00Z')-days<=7*86400000?'week':'month'}))}
