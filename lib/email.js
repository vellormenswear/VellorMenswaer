const FROM='contato@vellorwear.com.br';
export function emailConfigured(env=process.env){return Boolean(env.SMTP2GO_API_KEY)}
export async function sendMail(to,subject,html){
 if(!emailConfigured())return false;
 const r=await fetch('https://api.smtp2go.com/v3/email/send',{method:'POST',headers:{'X-Smtp2go-Api-Key':process.env.SMTP2GO_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({sender:FROM,to:[to],subject,html_body:html,custom_headers:[{header:'Reply-To',value:FROM}],fastaccept:false})});
 const result=await r.json().catch(()=>null);
 if(!r.ok||result?.data?.succeeded!==1||result?.data?.failed!==0)throw Error('Falha ao enviar e-mail.');
 return true;
}
