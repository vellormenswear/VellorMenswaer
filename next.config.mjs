/** @type {import('next').NextConfig} */
const nextConfig={
  reactStrictMode:true,
  poweredByHeader:false,
  async redirects(){return [
    {source:'/vitrine.html',destination:'/',permanent:true},
    {source:'/categorias/:categoria/todos',destination:'/:categoria',permanent:true},
    {source:'/categorias/:categoria/:subcategoria',destination:'/:subcategoria',permanent:true},
    {source:'/categorias/:categoria',destination:'/:categoria',permanent:true},
  ]},
  async rewrites(){return {beforeFiles:[{source:'/',destination:'/vitrine.html'}],afterFiles:[],fallback:[{source:'/:categoria([a-z0-9-]+)',destination:'/vitrine.html'}]}},
  async headers(){return [
    {source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Content-Type-Options',value:'nosniff'}]},
    {source:'/:path*',headers:[{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},{key:'Content-Security-Policy-Report-Only',value:"default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.checkout.infinitepay.io"}]}
  ]}
};
export default nextConfig;
