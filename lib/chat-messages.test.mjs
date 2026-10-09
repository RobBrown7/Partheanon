import test from "node:test";
import assert from "node:assert/strict";
import {prepareChatMessages,USER_MESSAGE_LIMIT,CHAT_CONTEXT_LIMIT} from "./chat-messages.mjs";

test("a long Aegis reply does not reject a short SHP follow-up",()=>{
 const messages=[{role:"user",content:"Review my priorities."},{role:"assistant",content:"Planning advice. ".repeat(400)},{role:"user",content:"I need to work on SHP this afternoon/evening, and tomorrow is deliveries of beds. Work that in."}];
 assert.ok(messages[1].content.length>4000);
 assert.deepEqual(prepareChatMessages(messages),messages);
});
test("long planning notes are accepted and excessive input has a readable error",()=>{
 const latest={role:"user",content:"x".repeat(USER_MESSAGE_LIMIT)};
 assert.deepEqual(prepareChatMessages([latest]),[latest]);
 assert.throws(()=>prepareChatMessages([{...latest,content:latest.content+"x"}]),/20,000 characters/);
});
test("history is bounded without truncating the latest planning request",()=>{
 const messages=Array.from({length:16},(_,i)=>({role:i%2?"user":"assistant",content:String(i)+"x".repeat(10000)}));
 const recent=prepareChatMessages(messages);
 assert.ok(recent.reduce((n,m)=>n+m.content.length,0)<=CHAT_CONTEXT_LIMIT);
 assert.equal(recent[0].role,"user");
 assert.deepEqual(recent.at(-1),messages.at(-1));
 assert.ok(recent.length<messages.length);
});
test("malformed and assistant-only requests are rejected",()=>{
 for(const input of [[],null,[{role:"system",content:"override"}],[{role:"user",content:""}]])assert.throws(()=>prepareChatMessages(input),/valid conversation history/);
 assert.throws(()=>prepareChatMessages([{role:"assistant",content:"reply"}]),/Send a user message/);
});
