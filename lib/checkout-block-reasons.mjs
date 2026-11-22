// Mensagens estaticas da aplicacao. Nenhum dado pessoal ou segredo no codigo de bloqueio.
const codes=new Map([
 ['Produto indisponível no catálogo.','PRODUCT_UNAVAILABLE'],
 ['Produto indisponível para venda.','PRODUCT_UNAVAILABLE'],
 ['Quantidade maior que o estoque.','STOCK_INSUFFICIENT'],
 ['Cupom esgotado.','COUPON_EXHAUSTED'],
 ['O frete já deve estar incluído no valor dos produtos.','SHIPPING_NOT_INCLUDED'],
 ['Este produto está temporariamente indisponível para compra.','SELLER_OR_PRODUCT_NOT_READY'],
 ['Produto indisponível.','PRODUCT_UNAVAILABLE'],
 ['Cupom reduz o preço abaixo do custo de fornecimento.','DISCOUNT_EXCEEDS_LIMIT'],
 ['Estoque reservado por outro checkout. Tente novamente mais tarde.','STOCK_RESERVED'],
 ['Desconto do grupo inválido.','DISCOUNT_INVALID'],
 ['Itens da tentativa não encontrados.','ITEMS_MISSING'],
 ['O prazo desta tentativa de pagamento expirou. Crie um novo checkout.','CHECKOUT_EXPIRED']
]);
export function checkoutBlockCode(message){return codes.get(String(message||''))||'CHECKOUT_CONFLICT'}
