import {sql,db} from '@/lib/db';
import {applyMarketplaceMigrations,MarketplaceSchemaError} from '@/lib/marketplace-auto-schema.mjs';
import {requireRole} from '@/lib/auth';
import {ok,fail,originGuard,HttpError} from '@/lib/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// Diagnóstico GET é somente leitura; inicialização POST exige sessão administrativa e origem autorizada.
const requiredTables=[
  'suppliers','supplier_invites','supplier_submissions',
  'supplier_order_groups','supplier_cancel_events','supplier_price_requests',
  'finance_adjustments','supplier_stock_reservations','checkout_coupon_redemptions',
  'infinitepay_checkout_batches','infinitepay_webhook_events','supplier_manual_payouts','supplier_notification_reads','supplier_pix_accounts','product_code_counters'
];

async function diagnostic(){
    const tables=await sql(`
      SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name=ANY($1::text[])`,[requiredTables]);
    const found=new Set(tables.rows.map(x=>x.table_name));
    const missingTables=requiredTables.filter(x=>!found.has(x));
    const columns=await sql(`
      SELECT table_name,column_name FROM information_schema.columns
       WHERE table_schema='public'
         AND ((table_name='products' AND column_name IN ('supplier_id','product_code'))
          OR (table_name='product_variants' AND column_name='supplier_cost_cents')
          OR (table_name='supplier_order_groups' AND column_name='checkout_batch_id')
          OR (table_name='supplier_manual_payouts' AND column_name='pix_key_suffix'))`);
    const foundColumns=new Set(columns.rows.map(x=>x.table_name+'.'+x.column_name));
    const requiredColumns=['products.supplier_id','products.product_code','product_variants.supplier_cost_cents','supplier_order_groups.checkout_batch_id','supplier_manual_payouts.pix_key_suffix'];
    const missingColumns=requiredColumns.filter(x=>!foundColumns.has(x));
    const migrationsTable=await sql("SELECT to_regclass('public.schema_migrations') AS table_ref");
    const versions=migrationsTable.rows[0]?.table_ref
      ? (await sql(`SELECT version FROM schema_migrations
          WHERE version IN ('002_marketplace.sql','003_supplier_changes.sql','004_paid_orders_only.sql','008_infinitepay.sql','009_supplier_notifications.sql','010_supplier_pix.sql','011_category_hierarchy.sql','012_request_conversations.sql','013_infinitepay_default.sql','014_launch_archive.sql','015_product_codes.sql')
          ORDER BY version`)).rows.map(x=>x.version) : [];
    const missingMigrations=['002_marketplace.sql','003_supplier_changes.sql','004_paid_orders_only.sql','008_infinitepay.sql','009_supplier_notifications.sql','010_supplier_pix.sql','011_category_hierarchy.sql','012_request_conversations.sql','013_infinitepay_default.sql','014_launch_archive.sql','015_product_codes.sql'].filter(x=>!versions.includes(x));
    return {ready:missingTables.length===0&&missingColumns.length===0&&missingMigrations.length===0,
       missing_tables:missingTables,missing_columns:missingColumns,missing_migrations:missingMigrations};
}
export async function GET(req){
  try{await requireRole(req,['admin','super_admin']);return ok(await diagnostic())}
  catch(e){return fail(e)}
}
export async function POST(req){
  try {
    originGuard(req);
    await requireRole(req,['admin','super_admin']);
    const result=await applyMarketplaceMigrations(()=>db().connect());
    return ok({...await diagnostic(),automatic_migrations:result.applied});
  } catch(e){
    if(e instanceof HttpError)return fail(e);
    if(e instanceof MarketplaceSchemaError)return ok({error:e.message},503);
    console.error('Vellor marketplace: falha ao executar migrações automáticas',e);
    return ok({error:'Não foi possível preparar o banco automaticamente. Verifique permissão para criar/alterar tabelas na conexão Neon e os logs da Vercel. Nenhuma alteração parcial foi mantida.'},503);
  }
}
