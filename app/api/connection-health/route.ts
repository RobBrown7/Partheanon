import {authorize,json,failure} from "../../../lib/api";
import {connectionHealth} from "../../../lib/connection-health";
export const dynamic="force-dynamic";
export async function POST(r:Request){try{await authorize(r);return json(await connectionHealth());}catch(e){return failure(e);}}
