import {requireChatGPTUser} from "../chatgpt-auth";
import {connectorsForRequest} from "../../lib/connectors";
export const dynamic="force-dynamic";
export default async function ConnectionDiagnostics(){
 await requireChatGPTUser("/connection-diagnostics");
 const context=await connectorsForRequest().getContext();
 const report=context.status==="success"?{status:context.status,connectors:context.connectors.map(c=>({connectorId:c.connectorId,policy:c.policy,profileTool:c.tools?.find(t=>t.actionName.replace(/-/g,"_")==="get_profile")||null}))}:context;
 return <main style={{padding:32,maxWidth:1000,margin:"auto"}}><h1>Connection diagnostics</h1><p>Account selection capabilities reported by this signed-in request. This does not change any provider settings.</p><a href="/?view=connections">Back to Connections</a><details style={{marginTop:24}}><summary>Technical account-selection report</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginTop:24}}>{JSON.stringify(report,null,2)}</pre></details></main>;
}
