import './globals.css';import type {Metadata} from 'next';import SiteHeader from '../components/SiteHeader';
export const metadata:Metadata={title:'LocalPay Micro | Small business, big possibilities',description:'QR codes, payment links and simple tools to help South African small businesses grow. Test mode only.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body><SiteHeader/>{children}</body></html>;}
