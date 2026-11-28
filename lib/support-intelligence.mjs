// Deterministic Portuguese intent/context engine; no paid model, invented data or account actions.
const plain=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function normalizeSupport(s){return plain(s).replace(/\bvc\b/g,'voce').replace(/\bvcs\b/g,'voces').replace(/\bpq\b/g,'porque').replace(/\bq\b/g,'que').replace(/\bn\b/g,'nao').replace(/\bta\b/g,'esta').replace(/\bpgt[o]?\b/g,'pagamento').replace(/\bpg\b/g,'paguei').replace(/\bentega\b/g,'entrega').replace(/\bcancel[ae]mento\b/g,'cancelamento').replace(/\btroka\b/g,'troca').replace(/\s+/g,' ').trim();}
export const SUMMARY_PROMPT='Descreva brevemente o motivo do seu atendimento.';
export function classifySupport(message){
 const q=normalizeSupport(message);
 if(/cancel|desist/.test(q))return 'Cancelamento de pedido';
 if(/estorno|reembolso|dinheiro de volta/.test(q))return 'Solicitação de reembolso';
 if(/defeit|rasgad|quebrad|danificad|avariad/.test(q))return 'Produto com defeito';
 if(/troca|trocar|ficou (?:pequen|grand)|tamanho errado|numeracao errada/.test(q))return /tamanho|numeracao|pequen|grand/.test(q)?'Troca de tamanho':'Troca de produto';
 if(/devolu|devolv/.test(q))return 'Devolução de produto';
 if(/entreg|rastre|postag|atras|nao cheg|extravi/.test(q))return 'Problema com a entrega';
 if(/pagament|paguei|pix|cobran|cartao/.test(q))return 'Problema com o pagamento';
 if(/login|senha|entrar na conta|acesso|cadastro/.test(q))return 'Problema de acesso à conta';
 return 'Atendimento ao cliente';
}
const productWords=/\b(?:camis[ae]s?|camisetas?|calcas?|bermudas?|tenis|sapatos?|vestidos?|saias?|relogios?|acessorios?|jaquetas?|casacos?|blusas?|bolsas?|sandalias?|chinelos?|shorts?|produtos?)\b/;
const colors=['preto','preta','branco','branca','azul','verde','vermelho','vermelha','cinza','marrom','bege','rosa','amarelo','amarela','roxo','roxa','vinho','laranja'];
const words=s=>s.match(/[a-z0-9]+/g)||[];
const stop=new Set('eu voce voces tem quero queria gostaria preciso gostaria de do da dos das um uma o a os as com em para por e que qual quais quanto custa preco valor mostre mostra me recomende recomenda sugira sugestao sugestoes encontre buscar procura procurando produto produtos disponivel disponiveis estoque cor cores tamanho tamanhos numero numeracao tamanho g p m gg xg pp masculino masculina feminino feminina ate abaixo menos reais r veja vende vendem vendido'.split(' '));
const canonical=s=>({camisetas:'camiseta',camisas:'camisa',calcas:'calca',bermudas:'bermuda',vestidos:'vestido',saias:'saia',relogios:'relogio',sapatos:'sapato',jaquetas:'jaqueta',blusas:'blusa',bolsas:'bolsa',preta:'preto',branca:'branco',vermelha:'vermelho',amarela:'amarelo',roxa:'roxo'}[s]||s);
export function productIntent(message,history=[]){
 const q=normalizeSupport(message);
 if(/pedido|pagamento|entrega|troca|cancel|devolu|estorno|senha|login|frete/.test(q))return null;
 const last=[...history].reverse().find(x=>x.sender_kind==='visitor'&&normalizeSupport(x.body)!==q&&productWords.test(normalizeSupport(x.body)));
 const follow=/^(?:e\s+)?(?:na cor|no tamanho|tamanho|tem|quanto|qual|ou|mais|ate|abaixo|preto|preta|branco|branca|azul|verde|rosa|sim)\b/.test(q);
 const direct=productWords.test(q)||/\b(recomende|recomenda|sugira|sugestao|procurando|busco|procuro)\b/.test(q);
 if(!direct&&!(last&&follow))return null;
 const prior=!direct&&last?normalizeSupport(last.body):'';
 const sizeMatch=q.match(/\b(?:tamanho|numero|numeracao)\s+(pp|p|m|g|gg|xg|xxg|\d{2})\b/);
 const previousSize=prior.match(/\b(?:tamanho|numero|numeracao)\s+(pp|p|m|g|gg|xg|xxg|\d{2})\b/);
 const color=colors.find(c=>words(q).includes(c))||colors.find(c=>words(prior).includes(c))||'';
 const budget=q.match(/(?:ate|abaixo de|menos de)\s*(?:r\$\s*)?(\d{1,6})(?:[,.](\d{1,2}))?/);
 const source=direct?q:prior;
 const tokens=[...new Set(words(source).filter(w=>!stop.has(w)&&!colors.includes(w)&&!/\d/.test(w)&&w.length>=3&&w!=='r').map(canonical))].slice(0,6);
 const department=/\b(?:feminino|feminina)\b/.test(q+' '+prior)?'feminino':/\b(?:masculino|masculina)\b/.test(q+' '+prior)?'masculino':null;
 return {tokens,color:canonical(color),size:(sizeMatch?.[1]||previousSize?.[1]||'').toUpperCase(),maxCents:budget?Number(budget[1])*100+Number((budget[2]||'').padEnd(2,'0')):null,department};
}
export function productAnswer(rows){
 if(!rows.length)return 'Não encontrei uma opção disponível que corresponda a todos os critérios informados no catálogo atual. Podemos procurar outra cor, tamanho ou faixa de preço.';
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)/100);
 return 'Encontrei estas opções disponíveis no catálogo da VELLOR:\n'+rows.map(r=>r.name+(r.variant?' — '+r.variant:'')+' | '+money(r.price_cents)+(r.sizes?.length?' | Tamanhos: '+r.sizes.join(', '):'')).join('\n')+'\nConfira o produto na vitrine para confirmar a disponibilidade e as condições no checkout.';
}
export function orderContext(message,history,orderNumber,orderQuestion){
 const q=normalizeSupport(message),prev=[...history].reverse().filter(m=>m.sender_kind==='visitor'&&normalizeSupport(m.body)!==q);
 const current=orderNumber(q);
 if(current)return current;
 if(/^#?\d{1,12}$/.test(q)&&prev.some(m=>orderQuestion(m.body)))return q.replace('#','');
 if(orderQuestion(q)||/^(?:e\s+)?(?:rastreio|rastreamento|pagamento|postagem|status)\b/.test(q)){
  for(const m of prev){const n=orderNumber(m.body);if(n)return n;if(/^#?\d{1,12}$/.test(m.body)&&prev.some(x=>orderQuestion(x.body)))return m.body.replace('#','');if(productWords.test(normalizeSupport(m.body)))break;}
 }
 return null;
}
