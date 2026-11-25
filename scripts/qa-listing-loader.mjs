import {pathToFileURL,fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function resolve(specifier,context,nextResolve){
 if(specifier.startsWith('@/')){let p=path.join(root,specifier.slice(2));if(!path.extname(p)&&existsSync(p+'.js'))p+='.js';return nextResolve(pathToFileURL(p).href,context);}
 if(specifier==='next/server')return nextResolve('next/server.js',context);
 return nextResolve(specifier,context);
}
