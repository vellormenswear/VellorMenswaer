// Diagnostico de build: somente presença e modo, nunca expor segredos.
const e=process.env;
const enabled=k=>e[k]==='true'?'true':e[k]==='false'?'false':'missing';
const report={service:'asaas',environment:'sandbox',
  api_url_ok:e.ASAAS_BASE_URL==='https://api-sandbox.asaas.com/v3',
  key_present:!!e.ASAAS_API_KEY,
  webhook_token_present:typeof e.ASAAS_WEBHOOK_TOKEN==='string'&&e.ASAAS_WEBHOOK_TOKEN.length>=32,
  checkout_enabled:enabled('ASAAS_CHECKOUT_ENABLED'),
  sandbox_buyer_present:!!e.ASAAS_SANDBOX_TEST_CUSTOMER_EMAIL,
  database_present:!!e.DATABASE_URL,
  site_url_valid:/^https:\/\//.test(e.SITE_URL||'')
};
console.info('[vellor.asaas.preflight]',JSON.stringify(report));
