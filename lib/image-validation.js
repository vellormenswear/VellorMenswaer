import {ensure} from '@/lib/http';
import {IMAGE_TYPES,validImageSignature} from './image-signature.mjs';
export async function validateImage(file){
 ensure(file&&typeof file.arrayBuffer==='function','Arquivo ausente.');
 ensure(file.size>100&&file.size<4*1024*1024,'Imagem deve ter até 4 MB.');
 ensure(Object.hasOwn(IMAGE_TYPES,file.type),'Formato de imagem inválido.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 ensure(validImageSignature(file.type,bytes),'O arquivo não corresponde a uma imagem válida.');
 return IMAGE_TYPES[file.type];
}
