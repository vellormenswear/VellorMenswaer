// Nonces are created per request, never stored or reused.
export function contentSecurityPolicy(nonce,dev=false){
 return [
 "default-src 'self'",
 "script-src 'self' 'nonce-"+nonce+"'"+(dev?" 'unsafe-eval'":""),
 "script-src-attr 'none'",
 "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
 "img-src 'self' data: blob: https:",
 "font-src 'self' https://fonts.gstatic.com data:",
 "connect-src 'self'"+(dev?" ws: wss:":""),
 "object-src 'none'",
 "base-uri 'self'",
 "frame-ancestors 'none'",
 "frame-src 'none'",
 "form-action 'self'",
 ...(dev?[]:["upgrade-insecure-requests"])
 ].join('; ');
}
export const PERMISSIONS_POLICY='camera=(), microphone=(), geolocation=(), usb=(), serial=(), hid=(), bluetooth=(), payment=(self), fullscreen=(self)';
