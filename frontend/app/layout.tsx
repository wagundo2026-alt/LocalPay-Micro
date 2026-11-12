import './globals.css';
import type { Metadata } from 'next';
import SiteHeader from '../components/SiteHeader';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {LanguageProvider} from '../lib/language';
export const metadata: Metadata = {
 title:'LocalPay Micro | Easy payments for spaza shops and local traders',
 description:'Simple QR payment requests, payment links and transaction tools for South African informal traders, small restaurants, local food shops and spaza owners. Hackathon test mode.'
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
 return <html lang="en" suppressHydrationWarning><body><LanguageProvider><LanguageSwitcher/><SiteHeader/>{children}</LanguageProvider></body></html>;
}
