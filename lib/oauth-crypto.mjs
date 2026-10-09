const encoder=new TextEncoder(),decoder=new TextDecoder();
export function encode64(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");}
export function decode64(value){if(typeof value!=="string"||!/^[A-Za-z0-9_-]+$/.test(value))throw new Error("Invalid encrypted value");return Uint8Array.from(atob(value.replaceAll("-","+").replaceAll("_","/")),c=>c.charCodeAt(0));}
export function nonce(){return encode64(crypto.getRandomValues(new Uint8Array(32)));}
export async function challenge(verifier){return encode64(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(verifier))));}
async function key(value){const bytes=decode64(value);if(bytes.length!==32)throw new Error("OAuth encryption key must contain 32 bytes");return crypto.subtle.importKey("raw",bytes,"AES-GCM",false,["encrypt","decrypt"]);}
export async function seal(value,secret,aad){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(aad)},await key(secret),encoder.encode(JSON.stringify(value)));return `v1.${encode64(iv)}.${encode64(new Uint8Array(ciphertext))}`;}
export async function unseal(value,secret,aad){const [version,iv,data,...extra]=value.split(".");if(version!=="v1"||extra.length)throw new Error("Invalid encrypted value");return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:decode64(iv),additionalData:encoder.encode(aad)},await key(secret),decode64(data))));}
