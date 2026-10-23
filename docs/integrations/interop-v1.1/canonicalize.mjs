// Exact receiver canonicalization functions from deployed source 5b9398dacb454be239d78cbdc5555975aab3457d.
export function canonicalJson(value){
 if(value===undefined)return 'null';
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function ingestFingerprintInput(value){
 if(value?.schemaVersion!=='partheanon.sync.v1')return canonicalJson(value);
 const {generatedAt,...stable}=value;return canonicalJson(stable);
}
export async function receiptDigest(envelope){
 const bytes=new TextEncoder().encode(ingestFingerprintInput(envelope));
 return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
