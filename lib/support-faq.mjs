const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function supportReply(question){
 const s=norm(question);
 if(/(troca|trocar|devolu|devolv|reembolso|cancel|defeito|arrepend)/.test(s))
  return 'Nas compras online, você pode desistir em até 7 dias corridos após o recebimento, sem precisar justificar. Para devolver ou cancelar, acesse Minha Conta > Meus pedidos ou solicite atendimento humano. Consulte a página Trocas e Devoluções no rodapé. Não envie senhas nem dados completos de cartão pelo chat.';
 if(/(prazo|entrega|demora|chega|rastre|frete|envio|postagem)/.test(s))
  return 'A VELLOR providencia o envio em até 3 dias após a confirmação do pagamento. O prazo de entrega é diferente da postagem e varia conforme o produto e o destino. Confira a estimativa no carrinho, acompanhe seus pedidos em Minha Conta ou consulte a página Entrega e Prazos no rodapé. Se houver dúvida, fale com nossa equipe.';
 if(/(comprar|compra|pedido|carrinho|finaliz|cadastro|criar conta)/.test(s))
  return 'Para comprar: escolha o produto e a variação, adicione ao carrinho, entre ou crie sua conta, confira o endereço e finalize pelo checkout oficial quando os pedidos estiverem habilitados. O andamento da compra fica em Minha Conta. Precisa de ajuda em alguma etapa?';
 if(/(tamanho|medida|caimento|serve|numero|numera)/.test(s))
  return 'Confira os tamanhos e variações apresentados no produto. O caimento pode mudar conforme o modelo. Se faltar uma medida específica, fale com a equipe VELLOR.';
 if(/(privacidade|dados pessoais|lgpd)/.test(s))
  return 'A Política de Privacidade da VELLOR está na página Política de Privacidade, no rodapé. Para exercer seus direitos sobre dados pessoais, fale com nossa equipe pelo atendimento, sem compartilhar senhas ou códigos.';
 if(/(pagamento|cartao|cartão|pix|boleto|parcela)/.test(s))
  return 'Os meios de pagamento disponíveis aparecem no checkout oficial da InfinitePay, quando habilitado. O chat não recebe dados completos de cartão, senhas nem códigos de autenticação.';
 if(/(lavag|lavar|limpez|cuidar|tecido)/.test(s))
  return 'Os cuidados variam conforme o material da peça. Consulte a etiqueta e a descrição e, se precisar de orientação, fale com nossa equipe.';
 return 'Posso ajudar com prazos de envio e entrega, como comprar, tamanhos, pagamentos, cuidados e devoluções. Para conversar com a equipe VELLOR, selecione “Falar com um atendente”.';
}
