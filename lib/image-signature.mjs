export const IMAGE_TYPES=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'});
export function validImageSignature(type,bytes){
 if(type==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(type==='image/webp')return String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 return false;
}
