// The supplier's own commercial address is the sole source of the Pix municipality.
const uf='AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO';
const validCity=city=>{
 const value=String(city||'').trim().replace(/\s+/g,' ');
 if(value.length<2||value.length>120||!/^[\p{L}\p{M} .’'\-]+$/u.test(value)||!/\p{L}/u.test(value)||/^(rua|r\.|avenida|av\.|estrada|rodovia|travessa|bairro|cep|logradouro|praça|alameda|quadra|lote)\s/i.test(value))return null;
 return value;
};
export function cityFromSupplierAddress(address){
 const text=String(address||'').trim();
 // Prefer an explicitly labeled municipality, not a guessed neighborhood.
 const labeled=text.match(/(?:^|[,;\n])\s*(?:cidade|munic[ií]pio)\s*:\s*([^,;\n/]+?)(?=\s*(?:\/\s*[A-Za-z]{2}\b|[,;\n]|$))/i);
 if(labeled)return validCity(labeled[1].replace(new RegExp('\\s+-\\s*(?:'+uf+')$','i'),''));
 // Standard full address: street, number, district, City/UF (optional CEP).
 const pattern=new RegExp('(?:^|[,;\\n]|\\s[–—]\\s)\\s*([\\p{L}\\p{M} .’\\x27\\-]+?)\\s*(?:/|\\s+-\\s+|,\\s*)\\s*(?:'+uf+')(?=\\s*(?:$|[,;\\n–—-]|CEP\\b|\\d{5}-?\\d{3}\\b))','giu');
 const matches=[...text.matchAll(pattern)].map(m=>validCity(m[1])).filter(Boolean);
 return matches.length===1?matches[0]:null;
}
