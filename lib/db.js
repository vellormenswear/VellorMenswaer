import pg from 'pg';
let pool;
export function db(){
 if(!process.env.DATABASE_URL)throw new Error('Configure DATABASE_URL no Neon.');
 if(!pool)pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:8000,idleTimeoutMillis:30000,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:true}});
 return pool;
}
export const sql=(q,p=[])=>db().query(q,p);
export async function transaction(fn){const c=await db().connect();try{await c.query('BEGIN');const ret=await fn(c);await c.query('COMMIT');return ret}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
export async function audit(actor,action,type,id,before=null,after=null){await sql('INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,before_data,after_data) VALUES ($1,$2,$3,$4,$5,$6)',[actor||null,action,type,id?.toString()||null,JSON.stringify(before),JSON.stringify(after)]);}
