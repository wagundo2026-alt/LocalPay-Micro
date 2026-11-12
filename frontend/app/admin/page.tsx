'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ShieldCheck,Store,CreditCard,Wallet,ArrowRight} from 'lucide-react';
import {getSupabaseBrowser} from '../../lib/supabase-browser';
const API='/api/backend';
type Summary={merchants:number;verified_test_transactions:number;test_payment_volume_cents:number;mode:string;platform_revenue_cents:number};
export default function Admin(){
 const router=useRouter();const [data,setData]=useState<Summary|null>(null);const [message,setMessage]=useState('Checking your permissions...');const [tab,setTab]=useState<'summary'|'merchants'|'transactions'>('summary');const [rows,setRows]=useState<Record<string,unknown>[]>([]);const [token,setToken]=useState('');
 useEffect(()=>{getSupabaseBrowser().auth.getUser().then(async ({data:{user}})=>{
  if(!user){router.replace('/login');return;}
  const {data:{session}}=await getSupabaseBrowser().auth.getSession();
  if(!session){router.replace('/login');return;}
  setToken(session.access_token);
  const response=await fetch(API+'/api/admin/summary',{headers:{Authorization:'Bearer '+session.access_token}});
  const json=await response.json();
  if(response.status===403)throw new Error('This page is for authorized LocalPay administrators only.');
  if(!response.ok)throw new Error(json.error||'Unable to load administration.');
  setData(json.data);setMessage('');
 }).catch(e=>setMessage(e instanceof Error?e.message:'Administrator area unavailable.'));},[router]);
 async function changeTab(next:'summary'|'merchants'|'transactions'){
  setTab(next);setRows([]);if(next==='summary')return;
  try{
   const res=await fetch(API+'/api/admin/'+next,{headers:{Authorization:'Bearer '+token}});
   const json=await res.json();
   if(!res.ok)throw Error(json.error||'Unable to load records.');
   setRows(json.data||[]);setMessage('');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not load records.');}
 }
 const money=(cents:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(cents/100);
 return <main className="lp-admin-page"><div className="lp-marketing-inner"><Link href="/dashboard" className="lp-small-link">← Back to my business</Link><div className="lp-eyebrow">PLATFORM ADMINISTRATION</div><h1>Keeping LocalPay running smoothly.</h1><p>Restricted workspace for authorized platform administrators. All figures are sandbox test records.</p>{message&&<div role="status" className="lp-alert lp-alert-error">{message}</div>}{data&&<><div className="lp-stat-grid"><div className="lp-stat"><span className="lp-stat-icon emerald"><Store size={20}/></span><span className="lp-stat-label">Merchants</span><div className="lp-stat-number">{data.merchants}</div></div><div className="lp-stat"><span className="lp-stat-icon blue"><CreditCard size={20}/></span><span className="lp-stat-label">Verified test payments</span><div className="lp-stat-number">{data.verified_test_transactions}</div></div><div className="lp-stat"><span className="lp-stat-icon amber"><Wallet size={20}/></span><span className="lp-stat-label">Test payment volume</span><div className="lp-stat-number">{money(data.test_payment_volume_cents)}</div></div><div className="lp-stat"><span className="lp-stat-icon violet"><ShieldCheck size={20}/></span><span className="lp-stat-label">Real platform revenue</span><div className="lp-stat-number">{money(0)}</div></div></div><div className="lp-admin-tabs">{(['summary','merchants','transactions'] as const).map(x=><button className={tab===x?'selected':''} onClick={()=>changeTab(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</div><section className="lp-card">{tab==='summary'?<div><h2>Test-mode overview</h2><p>We're not processing real payments yet. Real merchant settlement and billing remain disabled until provider onboarding and security checks are complete.</p></div>:<><h2>{tab==='merchants'?'Registered businesses':'Recent payments'}</h2>{rows.length?<div className="lp-table-wrap"><table className="lp-table"><thead><tr>{Object.keys(rows[0]).map(k=><th key={k}>{k.replace(/_/g,' ')}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{Object.keys(rows[0]).map(k=><td key={k}>{String(r[k]??'—')}</td>)}</tr>)}</tbody></table></div>:<p>No records found.</p>}</>}</section></>}</div></main>;
}
