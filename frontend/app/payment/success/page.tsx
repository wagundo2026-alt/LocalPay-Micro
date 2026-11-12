'use client';
import {useEffect,useState,Suspense} from 'react';import {useSearchParams} from 'next/navigation';import Link from 'next/link';import {useLanguage} from '../../../lib/language';import {CheckCircle2,Clock3,ShieldCheck} from 'lucide-react';
const API='/api/backend';
function Result(){const {t}=useLanguage();const params=useSearchParams();const ref=params.get('reference')||'';const [status,setStatus]=useState('checking');const [error,setError]=useState('');
 useEffect(()=>{if(!/^LPM-[a-f0-9]{32}$/.test(ref)){setStatus('error');setError('Invalid payment reference.');return;}
 let active=true;let timer:ReturnType<typeof setTimeout>;
 const check=async(retry:number)=>{try{const r=await fetch(API+'/api/payments/verify/'+encodeURIComponent(ref),{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not verify payment.');const result=j.data?.status||'pending';if(!active)return;setStatus(result);if(result==='pending'&&retry<5)timer=setTimeout(()=>check(retry+1),4000);}
 catch(e){if(active){setStatus('error');setError(e instanceof Error?e.message:'Verification unavailable.');}}};
 check(0);return()=>{active=false;clearTimeout(timer)};},[ref]);
 const paid=status==='successful';
 return <main className="lp-pay-page"><div className="lp-pay-container"><section className="lp-card lp-pay-box lp-result"><div className={'lp-result-icon '+(paid?'lp-confirmed':'')} >{paid?<CheckCircle2 size={36}/>:<Clock3 size={36}/>}</div><h1>{paid?t('result.verified'):status==='error'?t('result.unverified'):t('result.waiting')}</h1><p>{paid?t('result.provider'):status==='error'?error:t('result.pendingNotice')}</p><p className="lp-reference">{ref}</p>{paid?<Link href={'/receipt/'+encodeURIComponent(ref)} className="lp-primary lp-full">{t('result.receipt')}</Link>:<button className="lp-primary lp-full" onClick={()=>window.location.reload()}>{t('result.retry')}</button>}<p className="lp-safe-small"><ShieldCheck size={15}/> {t('result.test')}</p></section></div></main>;
}
export default function PaymentSuccess(){return <Suspense fallback={<main className="lp-pay-page">Checking your test payment...</main>}><Result/></Suspense>;}
