import {sql} from '@/lib/db';
import {identityFromRows,publicLegalIdentity,IDENTITY_FIELDS} from '@/lib/store-identity.mjs';
import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const {rows}=await sql('SELECT key,value FROM store_settings WHERE key=ANY($1::text[]) AND sensitive=false',[IDENTITY_FIELDS]);
  return NextResponse.json(publicLegalIdentity(identityFromRows(rows)),{headers:{'Cache-Control':'no-store'}});
 }catch{
  // Falha no DB não autoriza expor cadastro incompleto.
  return NextResponse.json({complete:false},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
