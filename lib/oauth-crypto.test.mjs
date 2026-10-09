import {test} from "node:test";
import assert from "node:assert/strict";
import {nonce,challenge,seal,unseal} from "./oauth-crypto.mjs";
test("PKCE uses the RFC 7636 SHA-256 challenge",async()=>{assert.equal(await challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");});
test("encrypted credentials cannot move between owners or accounts",async()=>{const secret=nonce(),value={access_token:"test-token",refresh_token:"test-refresh"},aad='["owner-a","google","a@example.com"]',encrypted=await seal(value,secret,aad);assert.ok(!encrypted.includes("test-token"));assert.deepEqual(await unseal(encrypted,secret,aad),value);await assert.rejects(()=>unseal(encrypted,secret,'["owner-b","google","a@example.com"]'));await assert.rejects(()=>unseal(encrypted,secret,'["owner-a","google","b@example.com"]'));await assert.rejects(()=>unseal(encrypted,nonce(),aad));});
test("separate authorizations use distinct cryptographic random nonces",()=>{const values=Array.from({length:100},()=>nonce());assert.equal(new Set(values).size,100);assert.ok(values.every(v=>/^[A-Za-z0-9_-]{43}$/.test(v)));});
