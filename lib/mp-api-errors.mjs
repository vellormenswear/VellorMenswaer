// Permite diagnosticar falhas do provedor SEM registrar credenciais, dados do
// comprador, cartoes, documentos ou o corpo completo de uma resposta.
const safeCode=value=>{
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const code=String(value).trim();
 return /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,47}$/.test(code)&&
  !/^(?:APP_USR|TEST|Bearer|eyJ)/i.test(code)?code:null;
};
const safeRequestId=value=>{
 if(typeof value!=='string')return null;
 const id=value.trim();
 return /^[a-zA-Z0-9_-]{6,120}$/.test(id)?id:null;
};
export function mpApiErrorSummary(status,payload,requestId){
 const detail=payload&&typeof payload==='object'?payload:{};
 const causes=Array.isArray(detail.cause)?detail.cause:[];
 const cause_codes=causes.slice(0,5).map(c=>safeCode(c?.code)).filter(Boolean);
 return {http_status:Number(status)||null,
  code:safeCode(detail.error)||safeCode(detail.code)||null,
  cause_codes,request_id:safeRequestId(requestId)};
}
