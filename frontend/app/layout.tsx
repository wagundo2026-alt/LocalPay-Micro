import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'LocalPay Micro', description: 'Affordable digital payments for South African micro-businesses' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="en"><body><header className="header"><div className="wrap nav"><Link href="/" className="brand">◆ LocalPay <span>Micro</span></Link><nav><Link href="/pricing">Pricing</Link> <Link href="/login">Login</Link> <Link href="/dashboard">Dashboard</Link></nav></div></header><div className="demo">HACKATHON DEMO — NO REAL MONEY IS PROCESSED</div>{children}</body></html>;
}