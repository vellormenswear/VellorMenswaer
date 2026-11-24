import {randomBytes,createHash,timingSafeEqual,scrypt as nativeScrypt} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(nativeScrypt);
export const randomToken=()=>randomBytes(32).toString('base64url');
export const sha256=s=>createHash('sha256').update(s).digest('hex');
export async function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>128)throw new Error('Senha deve conter entre 12 e 128 caracteres.');const salt=randomBytes(16).toString('hex');const derived=await scrypt(password,salt,64,{N:16384,r:8,p:1});return `scrypt$16384$8$1$${salt}$${derived.toString('hex')}`;}
export async function passwordVerify(password,stored){try{const [alg,n,r,p,salt,hex]=stored.split('$');if(typeof password!=='string'||password.length>128||alg!=='scrypt'||n!=='16384'||r!=='8'||p!=='1'||!(/^[0-9a-f]{32}$/).test(salt)||!(/^[0-9a-f]{128}$/).test(hex))return false;const a=Buffer.from(hex,'hex');const b=await scrypt(password,salt,a.length,{N:16384,r:8,p:1});return a.length===b.length&&timingSafeEqual(a,b);}catch{return false}}
export function secureCompare(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)}
