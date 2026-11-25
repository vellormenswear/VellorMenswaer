import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEGAL_POLICIES,LEGAL_LINKS} from '../lib/vellor-policies.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages=['entregas','trocas-e-devolucoes','privacidade','termos-de-compra'];
test('todas as 4 políticas possuem páginas, conteúdo e links estáveis',()=>{
 assert.equal(LEGAL_LINKS.length,4);
 for(const slug of pages){
  const page=read('app/'+slug+'/page.jsx');
  assert.match(page,/PolicyPage/);
  assert.ok(page.includes('slug="'+slug+'"'));
  assert.ok(LEGAL_POLICIES[slug].sections.length>=5);
  assert.ok(LEGAL_LINKS.some(link=>link.href==='/'+slug));
 }
 const layout=read('components/PolicyPage.jsx');
 assert.ok(layout.includes('LEGAL_POLICIES[slug]'));
 assert.ok(layout.includes("Frame user={null}"));
});
test('política de entrega confirma postagem até 3 dias, separada da entrega',()=>{
 const text=JSON.stringify(LEGAL_POLICIES.entregas);
 assert.match(text,/em até 3 dias após a confirmação do pagamento/);
 assert.match(text,/prazo de entrega/);
 assert.match(text,/postagem/);
 assert.match(text,/imprevisto/);
 assert.doesNotMatch(text,/fornecedor|dropshipping/i);
});
test('devolução observa arrependimento de 7 dias corridos e frete sem cobrança',()=>{
 const text=JSON.stringify(LEGAL_POLICIES['trocas-e-devolucoes']);
 assert.match(text,/7 dias corridos/);
 assert.match(text,/sem precisar apresentar justificativa/);
 assert.match(text,/não tem cobrança de frete/);
 assert.match(text,/integralmente os valores pagos/);
 assert.match(text,/embalagem original intacta/);
 assert.match(text,/Minha Conta/);
});
test('privacidade descreve dados, finalidades, pagamentos, retenção e direitos LGPD',()=>{
 const text=JSON.stringify(LEGAL_POLICIES.privacidade);
 for(const phrase of ['LGPD','InfinitePay','endereços','autenticar','obrigações','atendimento'])assert.ok(text.toLowerCase().includes(phrase.toLowerCase()));
 assert.doesNotMatch(text,/100% segura|garantia absoluta/i);
});
test('rodapés da vitrine e das páginas internas exibem proteção e políticas',()=>{
 const html=read('public/vitrine.html'),frame=read('components/Frame.jsx');
 for(const [x,y] of [['/entregas','Entrega e prazos'],['/trocas-e-devolucoes','Trocas e devoluções'],['/privacidade','Política de privacidade'],['/termos-de-compra','Termos de compra']]){
  assert.ok(html.includes(x));
  assert.ok(frame.includes(x));
 }
 assert.ok(html.includes('vellor-trust'));
 assert.ok(frame.includes('vll-trust'));
 assert.equal((html.match(/id="vellor-faq-heading"/g)||[]).length,1);
 assert.ok(!html.includes('fornecedores'));
});
test('checkout, retorno e atendimento público não mencionam repasses operacionais',()=>{
 const a=read('app/finalizar/page.jsx'),b=read('app/pagamento/grupos/page.jsx');
 const c=read('lib/support-faq.mjs'),js=read('public/vellor-approved.js');
 for(const src of [a,b,c])assert.doesNotMatch(src,/fornecedor(es)?|split|repasses Pix/i);
 assert.ok(a.includes('href="/entregas"'));
 assert.ok(a.includes('href="/trocas-e-devolucoes"'));
 assert.ok(js.includes('Envio em até 3 dias após a confirmação'));
});
test('estilos visuais acessíveis em desktop e celular',()=>{
 const css=read('public/vellor-approved.css'),next=read('app/globals.css');
 assert.ok(css.includes('.vellor-trust-grid'));
 assert.ok(css.includes('.vellor-footer-policies'));
 assert.ok(next.includes('.vll-policy-layout'));
 assert.ok(next.includes('.vll-trust-grid'));
 assert.ok(next.includes('@media(max-width:550px)'));
});

test('contato comercial oficial está disponível no site e nas respostas de e-mail',()=>{
 const email='contato@vellormenswear.com.br';
 for(const file of ['public/vitrine.html','components/Frame.jsx','components/PolicyPage.jsx','components/SupportWidget.jsx','app/contato/page.jsx'])assert.ok(read(file).includes('mailto:'+email),file);
 for(const file of ['public/vitrine.html','components/Frame.jsx'])assert.ok(read(file).includes('/contato'),file);
 assert.ok(read('lib/email.js').includes("reply_to:'"+email+"'"));
});
