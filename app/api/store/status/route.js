import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({orders_open:process.env.STORE_OPEN_FOR_ORDERS==='true'&&process.env.MP_MODE==='sandbox'&&process.env.MP_SPLIT_ENABLED==='true'&&Boolean(process.env.MP_CLIENT_ID)&&Boolean(process.env.MP_CLIENT_SECRET)&&Boolean(process.env.MP_TOKEN_ENCRYPTION_KEY)&&Boolean(process.env.MP_WEBHOOK_SECRET)&&Boolean(process.env.DATABASE_URL)&&Boolean(process.env.SITE_URL?.startsWith('https://'))},{headers:{'Cache-Control':'no-store'}})}
