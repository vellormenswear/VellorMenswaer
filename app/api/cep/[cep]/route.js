import {ok,fail,ensure,HttpError} from '@/lib/http';
import {cepFields} from '@/lib/address-recipient.mjs';
export const dynamic='force-dynamic';
export async function GET(req,{params}){try{const {cep}=await params;const code=cep.replace(/\D/g,'');ensure(code.length===8,'CEP deve conter 8 dígitos.');let r;try{r=await fetch(`https://viacep.com.br/ws/${code}/json/`,{cache:'no-store',signal:AbortSignal.timeout(8000)})}catch{throw new HttpError(503,'Consulta de CEP indisponível. Preencha o endereço manualmente.')}ensure(r.ok,'Consulta de CEP indisponível.',502);const d=await r.json();ensure(!d.erro,'CEP não encontrado.',404);return ok({cep:code,...cepFields(d)})}catch(e){return fail(e)}}
