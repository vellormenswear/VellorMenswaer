/** @type {import('next').NextConfig} */
const nextConfig={
  reactStrictMode:true,
  poweredByHeader:false,
  async rewrites(){return [{source:'/',destination:'/vitrine.html'},{source:'/categorias/:categoria',destination:'/vitrine.html'},{source:'/categorias/:categoria/:subcategoria',destination:'/vitrine.html'}]},
  async headers(){return [
    {source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Content-Type-Options',value:'nosniff'}]},
    {source:'/:path*',headers:[{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'X-Content-Type-Options',value:'nosniff'}]}
  ]}
};
export default nextConfig;
