import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
// All limits are fixed 15-minute windows, not sliding account lockouts.
export const RATE_POLICIES=Object.freeze({
 login:{source:90,identity:30,global:3000},
 register:{source:30,identity:8,global:1000},
 forgot:{source:30,identity:6,global:1000},
 reset:{source:40,identity:6,global:1000},
 support:{source:120,identity:100,global:6000},
 telemetry:{source:360,global:12000},
 quote:{source:180,global:6000},
 paymentWebhook:{source:1200,global:12000}
});
export function trustedSource(headers,vercel=process.env.VERCEL==='1'){
 if(!vercel)return null;
 const value=(headers.get('x-vercel-forwarded-for')||'').trim();
 return isIP(value)?value.toLowerCase():null;
}
const key=(scope,type,value)=>createHash('sha256').update(JSON.stringify(['vellor-rate-v1',scope,type,value])).digest('hex');
export function rateBuckets(scope,source,identity){
 const policy=RATE_POLICIES[scope];if(!policy)throw Error('Unknown rate policy');
 const buckets=[];
 if(source)buckets.push({key:key(scope,'source',source),limit:policy.source});
 if(identity&&policy.identity)buckets.push({key:key(scope,'identity',String(identity).toLowerCase()),limit:policy.identity});
 buckets.push({key:key(scope,'global','all'),limit:policy.global});
 return buckets;
}
export const RATE_SQL=`INSERT INTO auth_attempts(key_hash,failures,updated_at,locked_until)
 VALUES($1,1,now(),NULL)
 ON CONFLICT(key_hash) DO UPDATE SET
 failures=CASE WHEN auth_attempts.updated_at<=now()-interval '15 minutes' THEN 1 ELSE auth_attempts.failures+1 END,
 updated_at=CASE WHEN auth_attempts.updated_at<=now()-interval '15 minutes' THEN now() ELSE auth_attempts.updated_at END
 WHERE auth_attempts.updated_at<=now()-interval '15 minutes' OR auth_attempts.failures<$2
 RETURNING failures`;
export async function consumeRate(query,buckets){
 for(const bucket of buckets){const r=await query(RATE_SQL,[bucket.key,bucket.limit]);if(!r.rowCount)return false;}
 return true;
}
