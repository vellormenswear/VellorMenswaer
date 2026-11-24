import {randomBytes,createHash,timingSafeEqual,scrypt as nativeScrypt} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(nativeScrypt);
export const randomToken=()=>randomBytes(32).toString('base64url');
export const sha256=s=>createHash('sha256').update(s).digest('hex');
// OWASP scrypt configuration with bounded memory; legacy hashes remain readable.
const CURRENT={N:32768,r:8,p:3,maxmem:64*1024*1024};
const LEGACY={N:16384,r:8,p:1,maxmem:64*1024*1024};
export const validPassword=p=>typeof p==='string'&&p.length>=12&&p.length<=128&&Buffer.byteLength(p,'utf8')<=512;
export const needsPasswordUpgrade=stored=>typeof stored==='string'&&stored.startsWith('scrypt$16384$8$1$');
export async function passwordHash(password){
 if(!validPassword(password))throw new Error('Senha deve conter entre 12 e 128 caracteres.');
 const salt=randomBytes(16).toString('hex');
 const derived=await scrypt(password,salt,64,CURRENT);
 return 'scrypt$32768$8$3$'+salt+'$'+derived.toString('hex');
}
export async function passwordVerify(password,stored){
 try{
  if(typeof password!=='string'||password.length>128||Buffer.byteLength(password,'utf8')>512||typeof stored!=='string')return false;
  const parts=stored.split('$');if(parts.length!==6)return false;
  const [alg,n,r,p,salt,hex]=parts;
  if(alg!=='scrypt'||r!=='8'||!/^([0-9a-f]{32})$/.test(salt)||!/^([0-9a-f]{128})$/.test(hex))return false;
  const config=n==='32768'&&p==='3'?CURRENT:n==='16384'&&p==='1'?LEGACY:null;if(!config)return false;
  const a=Buffer.from(hex,'hex'),b=await scrypt(password,salt,64,config);
  return timingSafeEqual(a,b);
 }catch{return false}
}
// A fake hash makes absent/suspended account checks perform comparable work.
export const DUMMY_PASSWORD_HASH='scrypt$32768$8$3$'+'0'.repeat(32)+'$'+'0'.repeat(128);
export function secureCompare(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)}
