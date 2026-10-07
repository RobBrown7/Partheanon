import {getChatGPTUser} from "./chatgpt-auth";
import {getDb} from "../db";
import {preferences} from "../db/schema";
import {eq} from "drizzle-orm";
import {validTheme} from "../lib/theme";
import type { Metadata,Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Partheanon · Your commitments, in perspective",description:"Forge’s private command center for calendars, tasks, deadlines, and protected work time.",manifest:"/manifest.webmanifest",icons:{icon:"/favicon.svg",apple:"/icon.png"},appleWebApp:{capable:true,title:"Partheanon",statusBarStyle:"default"}};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#183b36"};
export default async function RootLayout({children}:{children:React.ReactNode}){const user=await getChatGPTUser();const rows=user?await getDb().select({theme:preferences.theme}).from(preferences).where(eq(preferences.owner,user.userId)):[];return <html lang="en" data-theme={validTheme(rows[0]?.theme)}><body>{children}</body></html>;}
