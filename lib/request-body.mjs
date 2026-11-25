export class RequestBodyError extends Error{constructor(status,message){super(message);this.status=status}}
export async function readJsonObject(req,max=100000){
 const declared=req.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>max))throw new RequestBodyError(413,'Corpo muito grande.');
 if(!req.body)throw new RequestBodyError(400,'Corpo ausente.');
 const reader=req.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let length=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){try{await reader.cancel()}catch{}throw new RequestBodyError(413,'Corpo muito grande.')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}
 catch(e){if(e instanceof RequestBodyError)throw e;throw new RequestBodyError(400,'Corpo inválido.')}finally{reader.releaseLock()}
 let value;try{value=JSON.parse(text)}catch{throw new RequestBodyError(400,'JSON inválido.')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new RequestBodyError(400,'Formato inválido.');
 return value;
}
