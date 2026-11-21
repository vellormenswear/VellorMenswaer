// Utilizado pelo cabeçalho nas páginas que não fornecem callback local de logout.
// Só redireciona depois que o servidor revoga a sessão e expira o cookie.
export async function logoutAndRedirect(request,redirect){
 const response=await request('/api/auth/logout',{
  method:'POST',headers:{'Content-Type':'application/json'},body:'{}',
  credentials:'same-origin',cache:'no-store'
 });
 if(!response.ok){
  const result=await response.json().catch(()=>({}));
  throw new Error(result.error||'Não foi possível encerrar a sessão. Tente novamente.');
 }
 redirect('/conta');
}
