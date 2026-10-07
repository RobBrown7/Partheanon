import { getChatGPTUser } from "../app/chatgpt-auth";
export const privateHeaders={"Cache-Control":"private, no-store"};
export function json(data:unknown,status=200){return Response.json(data,{status,headers:privateHeaders});}
export async function authorize(request:Request,checkOrigin=true){
 if(checkOrigin&&request.method!=="GET") {const origin=request.headers.get("origin");if(!origin||origin!==new URL(request.url).origin)throw new Error("Request origin rejected");}
 const user=await getChatGPTUser();if(!user)throw new Error("Sign in with ChatGPT to continue");return user.userId;
}
export function failure(e:unknown){const msg=e instanceof Error?e.message:"Request failed";return json({error:msg},msg.includes("Sign in")?401:msg.includes("origin")?403:400);}
