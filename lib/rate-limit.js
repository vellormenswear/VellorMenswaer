import {sql} from '@/lib/db';
import {sha256} from '@/lib/security';
import {HttpError} from '@/lib/http';
import {isIP} from 'node:net';
// Vercel overwrites its forwarded IP header. No client-provided account identifier
// is trusted as a substitute for the network limit.
export function clientIp(req){
 const raw=(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
 return isIP(raw)?raw:'unknown';
}
// Atomic fixed-window counter, using the existing auth_attempts table.
// Separate namespaces keep login, password recovery and support independent.
export async function takeLimit(scope,identity,limit,seconds){
 const key=sha256('vellor-limit-v2|'+scope+'|'+identity);
 const r=await sql(`INSERT INTO auth_attempts(key_hash,failures,updated_at,locked_until) VALUES($1,1,now(),NULL)
 ON CONFLICT(key_hash) DO UPDATE SET
 failures=CASE WHEN auth_attempts.updated_at<=now()-($2::int*interval '1 second') THEN 1 ELSE LEAST(auth_attempts.failures+1,$3::int+1) END,
 updated_at=CASE WHEN auth_attempts.updated_at<=now()-($2::int*interval '1 second') THEN now() ELSE auth_attempts.updated_at END
 RETURNING failures`,[key,seconds,limit]);
 if(Number(r.rows[0].failures)>limit)throw new HttpError(429,'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
}
