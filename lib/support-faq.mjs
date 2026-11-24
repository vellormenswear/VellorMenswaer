const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
export const orderQuestion=q=>/(meu pedido|minha compra|pedido\s*#?\s*\d+|rastre|cade|onde esta|status do pedido|meu estorno|meu pagamento)/.test(norm(q));
export const orderNumber=q=>norm(q).match(/(?:pedido\s*#?\s*|#)(\d{1,12})\b/)?.[1]||null;
export const humanQuestion=q=>/(falar com (?:um |uma |a )?(?:atendente|humano|equipe|pessoa)|atendimento humano|quero (?:um )?atendente|nao resolveu|nao ajudou|reclamacao|fui cobrado duas vezes|cobranca indevida)/.test(norm(q));
const rules=[
 ['refund',/(estorno|reembolso|dinheiro de volta|devolucao do dinheiro)/,'O estorno é devolvido pelo meio de pagamento original após a confirmação da devolução. O prazo de crédito depende do seu banco ou cartão. Acompanhe em Minha Conta > Meus pedidos. Se estiver pendente ou precisar de ajuda, converse com nossa equipe.'],
 ['return',/(troca|trocar|devolu|devolv|cancel|defeito|arrepend)/,'Nas compras online, você pode desistir em até 7 dias corridos após o recebimento, sem precisar justificar. Para devolver ou cancelar, acesse Minha Conta > Meus pedidos > Solicitar atendimento. Você poderá conversar com a equipe em Solicitações. Consulte Trocas e Devoluções no rodapé.'],
 ['shipping',/(prazo|entrega|demora|chega|rastre|frete|envio|postagem|transportadora)/,'A VELLOR providencia o envio em até 3 dias após a confirmação do pagamento. O prazo de entrega é diferente da postagem e varia conforme o produto e o destino. O frete está incluído no preço. Confira a estimativa no carrinho e acompanhe o rastreamento em Minha Conta.'],
 ['payment',/(pagamento|cartao|pix|boleto|parcela|visa|mastercard|amex|elo|pagar)/,'Aceitamos Pix e cartões Visa, Mastercard, Elo e American Express pelo checkout oficial da InfinitePay. Parcelamento e condições são exibidos no checkout. O chat não recebe dados completos de cartão, senhas ou códigos de autenticação.'],
 ['failure',/(erro|falh|recus|nao consigo|nao funciona|nao aprova|travou)/,'Se houver erro no checkout, confira seu carrinho, endereço e conexão. Se o pagamento foi debitado, não pague novamente antes de conferir a confirmação em Minha Conta. A equipe pode verificar a situação pelo atendimento humano.'],
 ['coupon',/(cupom|desconto|promocao)/,'Insira o código do cupom no carrinho ou na finalização e confira o desconto aplicado no resumo. Cada cupom tem condições próprias. Não posso criar descontos nem alterar preços pelo chat.'],
 ['account',/(cadastro|criar conta|login|senha|esqueci|endereco|cep)/,'Em Minha Conta, você pode entrar, criar sua conta, cadastrar endereços ou recuperar a senha. Para recuperar, escolha Esqueci a senha e informe seu e-mail no formulário oficial. Nunca envie sua senha pelo chat.'],
 ['size',/(tamanho|medida|caimento|serve|numeracao|numero do sapato|p m g)/,'Confira os tamanhos disponíveis na página do produto. O caimento varia de acordo com o modelo. Se precisar de medidas específicas, informe qual produto está vendo à equipe; não vou inventar medidas.'],
 ['color',/(cor\b|cores|variacao|estoque|disponivel|disponibilidade|foto)/,'Na página do produto, selecione a cor ou variação desejada e confira a foto, tamanhos e disponibilidade. Se uma opção não estiver disponível, escolha outra ou pergunte à equipe.'],
 ['care',/(lavag|lavar|limpez|cuidar|tecido|material|conserva)/,'Os cuidados variam conforme o material. Consulte a descrição e a etiqueta da peça. Informe o nome do produto à equipe caso precise de orientação específica.'],
 ['privacy',/(privacidade|dados pessoais|lgpd|seguranca|seguro|confiavel)/,'O pagamento ocorre no checkout oficial da InfinitePay, e o site utiliza HTTPS. Consulte a Política de Privacidade e os Termos de Compra no rodapé. Não compartilhe senhas, códigos ou dados completos do cartão pelo chat.'],
 ['buy',/(comprar|compra|carrinho|finaliz|como pedir)/,'Para comprar: escolha o produto, selecione sua variação e tamanho quando necessário, adicione ao carrinho, entre ou crie sua conta, confira o endereço e finalize no checkout oficial quando os pedidos estiverem habilitados. O pedido é registrado após a confirmação do pagamento.']
];
export function supportReply(question,history=[]){
 const s=norm(question);
 if(/^(oi|ola|bom dia|boa tarde|boa noite|e ai)[!?.\s]*$/.test(s))return 'Olá! Sou o assistente VELLOR. Posso ajudar você a escolher produtos, comprar, acompanhar pedidos, entender pagamentos e solicitar trocas. Como posso ajudar?';
 if(/^(obrigad[oa]|valeu|agradecido|ok|entendi|beleza)[!?.\s]*$/.test(s))return 'Por nada! Se precisar de mais alguma informação, estou por aqui.';
 if(humanQuestion(s))return 'Vou encaminhar sua conversa à equipe VELLOR. Você poderá acompanhar as respostas aqui.';
 const matches=rules.filter(([,re])=>re.test(s));
 if(matches.length)return matches.slice(0,3).map(([, ,reply])=>reply).join('\n\n');
 if(/^(e\s+)?(quanto tempo|quantos dias|e depois|como assim|como faco|e se|qual o prazo)/.test(s)){
  const previous=[...history].reverse().find(m=>m.sender_kind==='visitor'&&norm(m.body)!==s);
  if(previous){const found=rules.find(([,re])=>re.test(norm(previous.body)));if(found)return found[2];}
 }
 return 'Quero entender melhor sua dúvida. Você precisa de ajuda com um produto, prazo de entrega, pagamento, tamanho, troca ou um pedido que já fez? Conte um pouco mais. Se preferir, posso encaminhar você à equipe VELLOR.';
}
