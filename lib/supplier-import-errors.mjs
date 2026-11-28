export class SupplierImportError extends Error{
 constructor(code,message,status=null){super(message);this.name='SupplierImportError';this.code=code;this.status=status;}
}
export const importError=(code,message,status=null)=>new SupplierImportError(code,message,status);
export function safeImportError(e){
 if(e instanceof SupplierImportError)return {code:e.code,message:e.message,...(e.status?{status:e.status}:{})};
 const code=String(e?.code||'');
 if(['ENOTFOUND','ENODATA','EAI_AGAIN','ESERVFAIL'].includes(code))return {code:'DNS',message:'Não foi possível localizar o servidor do fornecedor.'};
 if(['ETIMEDOUT','ETIMEOUT'].includes(code))return {code:'TIMEOUT',message:'O fornecedor não respondeu dentro do tempo de consulta.'};
 if(['CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN'].includes(code))return {code:'TLS',message:'O certificado HTTPS do fornecedor não pôde ser validado.'};
 if(['ECONNRESET','ECONNREFUSED','EHOSTUNREACH','ENETUNREACH','EPIPE'].includes(code))return {code:'CONNECTION',message:'Falha de conexão com o servidor do fornecedor.'};
 return {code:'UNKNOWN',message:'Não foi possível processar o anúncio. Tente novamente ou complete os dados manualmente.'};
}
export function logImportFailure(stage,e){const detail=safeImportError(e);console.warn('[supplier-import]',JSON.stringify({stage,code:detail.code,status:detail.status||null}));return detail;}
