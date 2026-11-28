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
 return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VELLOR WEAR | Recuperação de senha</title></head>
<body style="margin:0;padding:0;background:#f7f6f2;font-family:Arial,Helvetica,sans-serif;color:#15241e">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f7f6f2" style="background:#f7f6f2"><tr><td align="center" style="padding:28px 12px">
<!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #eae9e5;border-radius:12px;overflow:hidden">
<tr><td align="center" bgcolor="#242326" style="padding:29px 20px;background-color:#242326;background-image:linear-gradient(90deg,#10362c 0%,#242326 50%,#401328 100%);border-bottom:2px solid #b49965;border-radius:11px 11px 0 0">
<img src="https://www.vellorwear.com.br/logo-vellor-approved.png" alt="VELLOR WEAR" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;color:#d6bd91;font-size:22px;letter-spacing:4px">
</td></tr>
<tr><td style="padding:32px 26px 28px;font-size:15px;line-height:1.65">
<p style="margin:0 0 10px;color:#65776b;font-size:11px;letter-spacing:2px;font-weight:bold">SEGURANÇA DA CONTA</p>
<h1 style="margin:0 0 22px;color:#10362c;font-size:25px;font-weight:600;line-height:1.3">Recuperação de senha</h1>
<p style="margin:0 0 12px">Olá,</p>
<p style="margin:0 0 24px">Recebemos uma solicitação para redefinir a senha da sua conta VELLOR WEAR. Para continuar, informe o código de verificação abaixo na tela de recuperação da nossa loja.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#f7f6f2" style="padding:20px 8px;border:1px solid #b49965;border-radius:8px;background:#f7f6f2">
<p style="margin:0 0 9px;font-size:11px;letter-spacing:1.6px;font-weight:bold;color:#52675a">SEU CÓDIGO DE VERIFICAÇÃO</p>
<p style="margin:0;font-size:34px;font-weight:bold;letter-spacing:6px;line-height:1.3;color:#10362c;font-family:Arial,Helvetica,sans-serif">${code}</p>
<p style="margin:12px 0 0;color:#52675a;font-size:12px">Válido por 30 minutos</p>
</td></tr></table>
<p style="margin:22px 0 10px">Por segurança, este código é de uso único e não deve ser compartilhado com ninguém.</p>
<p style="margin:0 0 22px">Caso você não tenha solicitado a redefinição da senha, desconsidere esta mensagem.</p>
<p style="margin:0">Atenciosamente,<br><strong style="color:#10362c">Equipe VELLOR WEAR</strong></p>
</td></tr>
<tr><td align="center" bgcolor="#f7f6f2" style="background:#f7f6f2;padding:20px 24px;border-top:1px solid #eae9e5;font-size:12px;line-height:1.65;color:#52675a;border-radius:0 0 11px 11px">
<p style="margin:0 0 8px">Este é um e-mail automático. <strong>Por favor, não responda a esta mensagem.</strong></p>
<p style="margin:0;letter-spacing:1.5px;font-size:11px;font-weight:bold;color:#10362c">VELLOR WEAR</p>
<p style="margin:3px 0 0">Moda masculina e feminina</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}
