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
  async rewrites(){return {beforeFiles:[{source:'/',destination:'/vitrine.html'}],afterFiles:[],fallback:[{source:'/:categoria([a-z0-9-]+)',destination:'/vitrine.html'}]}},,
  async headers(){return [
    {source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Content-Type-Options',value:'nosniff'}]},
    {source:'/:path*',headers:[{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'X-Content-Type-Options',value:'nosniff'}]}
  ]}
};
export default nextConfig;
