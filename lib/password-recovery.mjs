import {randomInt,createHmac} from 'node:crypto';
export const validRecoveryCode=code=>typeof code==='string'&&/^\d{6}$/.test(code);
export const validRecoveryChallenge=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export const generateRecoveryCode=()=>String(randomInt(0,1000000)).padStart(6,'0');
// The challenge is random, never persisted in plaintext; the SMTP credential stays server-side.
// A domain-separated HMAC prevents offline guessing of six-digit codes from database hashes.
export function recoveryCodeHash(mail,challenge,code,secret=process.env.SMTP2GO_API_KEY){
 if(!secret||!validRecoveryCode(code)||!validRecoveryChallenge(challenge))throw Error('Código de recuperação inválido.');
 return createHmac('sha256',secret).update(JSON.stringify(['vellor-password-recovery-v1',mail,challenge,code])).digest('hex');
}
export function recoveryEmail(code){
 if(!validRecoveryCode(code))throw Error('Código de recuperação inválido.');
 return `<div style="margin:0;padding:24px 12px;background:#faf9f6;font-family:Arial,sans-serif;color:#15241e"><div style="max-width:520px;margin:auto;background:#fff;border:1px solid #eae9e5;border-radius:14px;overflow:hidden"><div style="background:#10362c;background-image:linear-gradient(90deg,#10362c,#242326,#401328);text-align:center;padding:24px 16px"><img src="https://www.vellorwear.com.br/logo-vellor-approved.png" alt="VELLOR WEAR" width="220" style="display:inline-block;max-width:100%;height:auto;color:#fff"></div><div style="padding:24px;text-align:center"><h1 style="font-size:22px;color:#10362c;margin:0 0 16px">Redefinição de senha</h1><p>Use o código abaixo para redefinir a senha da sua conta VELLOR.</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;background:#faf9f6;border:1px solid #b49965;border-radius:10px;padding:16px;color:#10362c">${code}</p><p>O código é válido por 30 minutos e só pode ser utilizado uma vez. Não compartilhe este código.</p><p>Se você não solicitou a redefinição, ignore este e-mail.</p></div></div></div>`;
}
