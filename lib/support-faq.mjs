const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function supportReply(question){
 const s=norm(question);
 if(/(prazo|entrega|demora|chega|rastre|frete|envio)/.test(s))
  return 'Os prazos dependem de cada produto e são informados pelo fornecedor. Consulte a estimativa no carrinho; produtos de fornecedores diferentes podem chegar em entregas separadas. Se o prazo não aparecer, solicite um atendente para confirmar.';
 if(/(comprar|compra|pedido|carrinho|finaliz|cadastro|criar conta)/.test(s))
  return 'Para comprar: escolha o produto e sua variação, adicione ao carrinho, entre ou crie sua conta, informe o endereço e avance para a finalização quando os pedidos estiverem habilitados. Precisa de ajuda em alguma etapa?';
 if(/(tamanho|medida|caimento|serve|numero|numera)/.test(s))
  return 'Confira as opções de tamanho e variação na página do produto. O caimento e as medidas variam conforme o modelo. Se faltar uma medida específica, peça atendimento humano para verificarmos.';
 if(/(troca|devolu|reembolso|cancel|defeito)/.test(s))
  return 'Posso orientar sobre trocas, devoluções e cancelamentos. Para analisar o seu caso, peça atendimento humano. Não envie dados bancários ou senhas pelo chat.';
 if(/(pagamento|cartao|cartão|pix|boleto|parcela)/.test(s))
  return 'As formas de pagamento disponíveis aparecem na etapa oficial de finalização, quando habilitada. O chat não recebe dados de cartão, senhas ou códigos de autenticação.';
 if(/(lavag|lavar|limpez|cuidar|tecido)/.test(s))
  return 'Os cuidados variam por peça e material. Consulte a etiqueta e a descrição do produto; se precisar de instruções específicas, solicite atendimento humano.';
 return 'Posso ajudar com prazos de entrega, como comprar, tamanhos, pagamentos, cuidados e trocas. Se preferir, selecione “Falar com um atendente” para enviar a conversa aos administradores.';
}
