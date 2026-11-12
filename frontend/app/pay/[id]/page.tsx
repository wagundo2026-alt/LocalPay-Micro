'use client';
import {useParams,useRouter} from 'next/navigation';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useLanguage} from '../../../lib/language';
import {ArrowRight,CheckCircle2,CreditCard,LockKeyhole,ShieldCheck,Store} from 'lucide-react';
const API='/api/backend';
type PayInfo={business_name:string;merchant_category:string|null;merchant_town:string|null;merchant_province:string|null;merchant_reference:string;amount_cents:number;currency:string;description:string;expires_at:string;mode:string};
const money=(c:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(c/100);
export default function Checkout(){
 const {t,locale}=useLanguage();
 const params=useParams();const id=String(params.id||'');const [data,setData]=useState<PayInfo|null>(null);const [email,setEmail]=useState('');const [payerName,setPayerName]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;fetch(API+'/api/checkout/'+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||t('checkout.unavailable'));if(active)setData(j.data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:t('checkout.unavailable'));}).finally(()=>{if(active)setLoading(false)});return()=>{active=false};},[id]);
 async function pay(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  try{
   const r=await fetch(API+'/api/payments/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:id,email:email.trim(),payer_name:payerName.trim()})});
   const j=await r.json();if(!r.ok)throw new Error(j.error||t('checkout.error'));
   const url=String(j.data?.checkout_url||'');
   if(!url.startsWith('https://checkout.paystack.com/'))throw new Error(t('checkout.invalidUrl'));
   window.location.assign(url);
  }catch(e){setError(e instanceof Error?e.message:t('checkout.error'));setBusy(false);}
 }
 return <main className="lp-pay-page"><div className="lp-pay-container"><div className="lp-pay-brand"><span className="lp-pay-mark"><Store size={25}/></span><strong>localpay<span style={{color:'#10b981'}}>.</span></strong><span className="lp-test-tag">{t('common.test')}</span></div>{loading?<div className="lp-card lp-pay-box">{t('checkout.loading')}</div>:!data?<div className="lp-card lp-pay-box"><h1>{t('checkout.unavailable')}</h1><p>{error||t('checkout.expired')}</p><Link href="/" className="lp-primary">{t('common.back')}</Link></div>:<div className="lp-card lp-pay-box"><div className="lp-pay-store"><div className="lp-pay-store-icon"><Store size={24}/></div><div><small>{t('checkout.from')}</small><h2>{data.business_name}</h2><p>{[data.merchant_category,data.merchant_town,data.merchant_province].filter(Boolean).join(' · ')}</p><small>{t('checkout.merchantReference')}: {data.merchant_reference}</small></div></div><p className="lp-field-hint"><ShieldCheck size={15}/> {t('checkout.merchantNotice')}</p><div className="lp-pay-amount"><span>{t('checkout.amount')}</span><h1>{money(data.amount_cents)}</h1><p>{data.description||t('checkout.description')}</p></div><p className="lp-field-hint">{t('checkout.expires')} {new Date(data.expires_at).toLocaleString(locale==='ve'?'ve-ZA':'en-ZA')}</p><div className="lp-pay-divider"/><form onSubmit={pay} className="lp-form"><label htmlFor="customer-name">{t('checkout.payerName')}</label><input id="customer-name" type="text" required minLength={2} maxLength={100} autoComplete="name" placeholder={t('checkout.namePlaceholder')} value={payerName} onChange={e=>setPayerName(e.target.value)}/><label htmlFor="customer-email">{t('checkout.payerEmail')}</label><input id="customer-email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/><p className="lp-field-hint">{t('checkout.payerNotice')}</p>{error&&<div className="lp-alert lp-alert-error" role="alert">{error}</div>}<button type="submit" className="lp-primary lp-full" disabled={busy}>{busy?t('checkout.opening'):t('checkout.continue')}<ArrowRight size={17}/></button></form><div className="lp-pay-secure"><ShieldCheck size={16}/> {t('checkout.hosted')}</div></div>}<p className="lp-pay-footer"><LockKeyhole size={15}/> {t('checkout.testNotice')}</p></div></main>;
}
