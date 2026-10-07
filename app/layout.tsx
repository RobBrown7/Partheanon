import type { Metadata,Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Partheanon · Your commitments, in perspective",description:"Forge’s private command center for calendars, tasks, deadlines, and protected work time.",manifest:"/manifest.webmanifest",icons:{icon:"/favicon.svg",apple:"/icon.png"},appleWebApp:{capable:true,title:"Partheanon",statusBarStyle:"default"}};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#183b36"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
