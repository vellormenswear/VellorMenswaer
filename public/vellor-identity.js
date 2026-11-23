(function(){
 const node=document.getElementById('vellor-legal-identity');
 if(!node)return;
 fetch('/api/store/identity',{cache:'no-store'})
  .then(r=>r.ok?r.json():null)
  .then(data=>{
   if(!data?.complete)return;
   const title=document.createElement('strong');
   title.textContent='Identificação do responsável comercial';
   const line=document.createElement('p');
   line.textContent=data.legal_name+' · '+data.legal_document_kind+': '+data.legal_document;
   const address=document.createElement('p');
   address.textContent=data.legal_address;
   const email=document.createElement('a');
   email.href='mailto:'+data.legal_email;
   email.textContent=data.legal_email;
   node.replaceChildren(title,line,address,email);
   node.hidden=false;
  }).catch(()=>{});
})();
