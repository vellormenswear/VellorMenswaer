// A late or locally failed checkout may have been paid at the provider.
// It must be recorded after authoritative verification, but never auto-fulfilled.
export function paymentRequiresReview(status,groups,now=Date.now()){
 if(status==='failed'||!Array.isArray(groups)||!groups.length)return true;
 return groups.some(g=>{const expiry=g.checkout_expires_at?new Date(g.checkout_expires_at).getTime():NaN;return g.payment_status!=='pending'||!Number.isFinite(expiry)||expiry<=now});
}
