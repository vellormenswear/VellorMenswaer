import {NextResponse} from 'next/server';
import {checkoutReady} from '@/lib/supplier-checkout.mjs';
export function GET(){return NextResponse.json({orders_open:checkoutReady(process.env),mode:process.env.MP_MODE||'disabled'},{headers:{'Cache-Control':'no-store'}})}
