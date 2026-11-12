'use client';
import {useParams,useRouter} from 'next/navigation';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,CreditCard,LockKeyhole,ShieldCheck,Store} from 'lucide-react';
const API='/api/backend';
type PayInfo={token:string;business_name:string;amount_cents:number;description:string;mode:string};
const money=(c:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(c/100);
export default function Checkout(){
 const params=useParams();const id=String(params.id||'');const [data,setData]=useState<PayInfo|null>(null);const [email,setEmail]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;fetch(API+'/api/checkout/'+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Payment link unavailable');if(active)setData(j.data)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load payment request.');}).finally(()=>{if(active)setLoading(false)});return()=>{active=false};},[id]);
 async function pay(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError('');
  try{
   const r=await fetch(API+'/api/payments/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:id,email:email.trim()})});
   const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not start payment.');
   const url=String(j.data?.checkout_url||'');
   if(!url.startsWith('https://checkout.paystack.com/'))throw new Error('No trusted Paystack checkout URL was returned.');
   window.location.assign(url);
  }catch(e){setError(e instanceof Error?e.message:'Checkout is not available.');setBusy(false);}
 }
 return <main className="lp-pay-page"><div className="lp-pay-container"><div className="lp-pay-brand"><span className="lp-pay-mark"><Store size={25}/></span><strong>localpay<span style={{color:'#10b981'}}>.</span></strong><span className="lp-test-tag">PAYSTACK TEST MODE</span></div>{loading?<div className="lp-card lp-pay-box">Getting this payment ready...</div>:!data?<div className="lp-card lp-pay-box"><h1>We couldn’t open that payment link.</h1><p>{error||'Please ask the business to share a new link.'}</p><Link href="/" className="lp-primary">Back to LocalPay</Link></div>:<div className="lp-card lp-pay-box"><div className="lp-pay-store"><div className="lp-pay-store-icon"><Store size={24}/></div><div><small>YOU’RE PAYING</small><h2>{data.business_name}</h2></div></div><div className="lp-pay-amount"><span>Amount to pay</span><h1>{money(data.amount_cents)}</h1><p>{data.description||'Payment request'}</p></div><div className="lp-pay-divider"/><form onSubmit={pay} className="lp-form"><label htmlFor="customer-email">Your email for the payment confirmation</label><input id="customer-email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/><p className="lp-field-hint">We use this only to start the Paystack test checkout.</p>{error&&<div className="lp-alert lp-alert-error" role="alert">{error}</div>}<button type="submit" className="lp-primary lp-full" disabled={busy}>{busy?'Opening Paystack...':'Continue to secure test checkout'}<ArrowRight size={17}/></button></form><div className="lp-pay-secure"><ShieldCheck size={16}/> Checkout is hosted by Paystack. We never see your card details.</div></div>}<p className="lp-pay-footer"><LockKeyhole size={15}/> This checkout is for testing. No real money will be charged.</p></div></main>;
}
