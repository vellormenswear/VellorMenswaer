import {PERMISSIONS_POLICY} from './lib/browser-policy.mjs';
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
    {source:'/:path*',headers:[{key:'Strict-Transport-Security',value:'max-age=31536000'},{key:'Permissions-Policy',value:PERMISSIONS_POLICY},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'X-Content-Type-Options',value:'nosniff'}]}
  ]}
};
export default nextConfig;
