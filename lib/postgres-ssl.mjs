// No pg-connection-string atual, require/prefer/verify-ca ja equivalem a verify-full.
// Tornamos essa verificacao explicita para evitar aviso de seguranca em futuras versoes.
export function normalizePgConnectionString(value){
 if(typeof value!=='string'||!/^postgres(?:ql)?:\/\//i.test(value))return value;
 try{
  const url=new URL(value);
  const mode=url.searchParams.get('sslmode')?.toLowerCase();
  if(!['require','prefer','verify-ca'].includes(mode))return value;
  url.searchParams.set('sslmode','verify-full');
  return url.toString();
 }catch{return value}
}
