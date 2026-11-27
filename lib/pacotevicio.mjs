const BASE='https://api.pacotevicio.dev/v1/track';
const KNOWN=new Set(['pending','collected','in_transit','out_for_delivery','available_for_pickup','tax','delivered','exception','returned','unknown']);
export const normalizeCode=value=>String(value??'').trim().toUpperCase();
export const validCode=code=>/^[A-Z0-9-]{4,100}$/.test(code);
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null;
const str=(v,max=500)=>typeof v==='string'?v.slice(0,max):'';
const status=v=>KNOWN.has(v)?v:'unknown';
export class TrackingError extends Error{constructor(code,status=0){super(code);this.code=code;this.status=status;}}
export function normalizeTracking(data,code){
 if(!data||normalizeCode(data.tracking_code)!==code||!Array.isArray(data.events)||!data.courier)throw new TrackingError('invalid_response');
 // Keep every event, including the mandatory PacoteVício attribution. Never include recipient data or raw provider response.
 return {courier:str(data.courier,80),status:status(data.status),status_updated_at:date(data.status_updated_at),delivered_at:date(data.delivered_at),events:data.events.map(e=>({timestamp:date(e?.timestamp),status:status(e?.status),description:str(e?.description,2000),location:e?.location?{city:str(e.location.city,100),state:str(e.location.state,100),country:str(e.location.country,100),facility:str(e.location.facility,200)}:null}))};
}
export async function trackShipment(code,{apiKey=process.env.PACOTEVICIO_API_KEY,fetcher=fetch}={}){
 code=normalizeCode(code);if(!validCode(code))throw new TrackingError('invalid_code');if(!apiKey)throw new TrackingError('not_configured');
 const r=await fetcher(BASE+'/'+encodeURIComponent(code)+'?retry_level=low',{headers:{'X-API-Key':apiKey,'User-Agent':'VELLOR/1.0',Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(18000)});
 const body=await r.json().catch(()=>null);
 if(!r.ok)throw new TrackingError(typeof body?.error?.code==='string'?body.error.code:'provider_error',r.status);
 return normalizeTracking(body,code);
}
export function trackingErrorMessage(code){
 return ({tracking_not_found:'Código ainda não localizado pela transportadora. Tente novamente mais tarde.',document_required:'Esta transportadora exige dados adicionais. Entre em contato com o atendimento.',multiple_shipments:'O código identifica mais de uma remessa. Entre em contato com o atendimento.',courier_not_detected:'Transportadora ainda não reconhecida. Entre em contato com o atendimento.',invalid_code:'Código de rastreamento inválido. Entre em contato com o atendimento.',quota_exceeded:'Limite de consultas atingido. O último rastreamento disponível foi preservado.',rate_limit_exceeded:'Rastreamento temporariamente ocupado. Tente novamente mais tarde.',not_configured:'Rastreamento automático ainda não disponível.',phone_verification_required:'Rastreamento automático temporariamente indisponível.'})[code]||'Não foi possível atualizar o rastreamento agora. O histórico anterior foi preservado.';
}
export const terminalTracking=s=>Boolean(s?.delivered_at)||['delivered','returned'].includes(s?.status);
