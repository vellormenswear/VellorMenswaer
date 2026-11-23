import {HttpError,ensure} from '@/lib/http';
import {asaasSandboxConfigured} from '@/lib/asaas.mjs';
export async function asaasApi(path,{method='GET',data=null}={}){
 ensure(asaasSandboxConfigured(process.env),'Asaas Sandbox nao configurado corretamente.',503);
 ensure(typeof path==='string'&&/^\/[a-z0-9/?=&._%-]+$/i.test(path)&&!path.startsWith('//'),'Endpoint Asaas invalido.',400);
 const url=process.env.ASAAS_BASE_URL+path;
 const response=await fetch(url,{method,headers:{access_token:process.env.ASAAS_API_KEY,
  'User-Agent':'VELLOR-Sandbox/1.0','Content-Type':'application/json',Accept:'application/json'},
  body:data!==null?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok){
  // Nao logar corpo completo: pode conter dados de pessoas, credenciais ou cartoes.
  const code=String(result.errors?.[0]?.code||'ASAAS_API_REJECTED').slice(0,90).replace(/[^A-Z0-9_ -]/gi,'');
  console.error('[asaas.api.failure]',JSON.stringify({path:path.split('?')[0],http_status:response.status,code}));
  throw new HttpError(502,'Asaas recusou a operacao ('+code+', HTTP '+response.status+').');
 }
 return result;
}
