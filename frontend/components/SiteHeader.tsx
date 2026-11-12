'use client';
import {useLanguage} from '../lib/language';
import Link from 'next/link';import {usePathname} from 'next/navigation';import {ArrowRight,Menu,ShieldCheck,Wallet} from 'lucide-react';import {useState} from 'react';
export default function SiteHeader(){
 const {t}=useLanguage();
 const path=usePathname();const [open,setOpen]=useState(false);
 if(path.startsWith('/dashboard')||path.startsWith('/onboarding')||path.startsWith('/pay/')||path.startsWith('/receipt/')||path.startsWith('/payment/')||path.startsWith('/auth/')||['/login','/register','/forgot-password'].includes(path))return null;
 return <><header className="lp-public-header"><div className="lp-public-nav"><Link href="/" className="lp-logo"><span className="lp-logo-icon"><Wallet size={21}/></span><span>localpay<span className="lp-logo-dot">.</span><small>MICRO BUSINESS</small></span></Link><nav className={open?'lp-public-links open':'lp-public-links'}><Link href="/#how-it-works" onClick={()=>setOpen(false)}>{t('nav.how')}</Link><Link href="/#features" onClick={()=>setOpen(false)}>{t('nav.features')}</Link><Link href="/pricing" onClick={()=>setOpen(false)}>{t('nav.pricing')}</Link><Link href="/login" onClick={()=>setOpen(false)}>{t('nav.login')}</Link><Link href="/register" className="lp-public-cta" onClick={()=>setOpen(false)}>{t('nav.start')} <ArrowRight size={16}/></Link></nav><button className="lp-public-menu" onClick={()=>setOpen(!open)} aria-label="Toggle navigation"><Menu/></button></div></header><div className="lp-demo-strip"><ShieldCheck size={14}/> Hackathon sandbox · No real payments are processed</div></>;
}
