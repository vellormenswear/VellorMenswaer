import {sql} from '@/lib/db';
import {HttpError} from '@/lib/http';
import {trustedSource,rateBuckets,consumeRate} from './rate-limit-core.mjs';
export async function limitRequest(req,scope,{identity}={}){
 const buckets=rateBuckets(scope,trustedSource(req.headers),identity);
 if(!await consumeRate(sql,buckets))throw new HttpError(429,'Muitas solicitações. Tente novamente em alguns minutos.');
}
