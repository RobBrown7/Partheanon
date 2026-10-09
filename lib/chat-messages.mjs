import {z} from "zod";

export const USER_MESSAGE_LIMIT=20000;
export const ASSISTANT_MESSAGE_LIMIT=30000;
export const CHAT_HISTORY_LIMIT=16;
export const CHAT_CONTEXT_LIMIT=60000;
export const CHAT_REQUEST_BYTE_LIMIT=400000;

const messageSchema=z.discriminatedUnion("role",[
 z.object({role:z.literal("user"),content:z.string().min(1).max(USER_MESSAGE_LIMIT)}),
 z.object({role:z.literal("assistant"),content:z.string().min(1).max(ASSISTANT_MESSAGE_LIMIT)})
]);
// Assistant replies are returned by the server and then sent back as history.
// Their limit must accommodate a full reply, independently of the input limit.
export function prepareChatMessages(input){
 const result=z.array(messageSchema).min(1).max(CHAT_HISTORY_LIMIT).safeParse(input);
 if(!result.success){
  const issue=result.error.issues.find(i=>i.code==="too_big"&&i.path.at(-1)==="content");
  if(issue){
   const assistant=Array.isArray(input)&&input[issue.path[0]]?.role==="assistant";
   throw new Error(assistant?"An earlier Aegis reply is too long to send. Start a new conversation and include your latest planning details.":`Your message is too long. Keep it within ${USER_MESSAGE_LIMIT.toLocaleString("en-US")} characters, or send it in parts.`);
  }
  throw new Error("Send a message to Aegis with valid conversation history.");
 }
 const messages=result.data;
 if(messages.at(-1)?.role!=="user")throw new Error("Send a user message.");
 // Keep complete recent messages. Never cut the latest request or rewrite it.
 let start=messages.length,total=0;
 while(start>0&&total+messages[start-1].content.length<=CHAT_CONTEXT_LIMIT){total+=messages[--start].content.length;}
 const recent=messages.slice(start);
 // Avoid a dangling assistant reply when its preceding question was dropped.
 while(recent[0]?.role==="assistant")recent.shift();
 return recent;
}
