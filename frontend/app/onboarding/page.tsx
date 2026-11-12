'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, type FormEvent } from 'react';
import { ArrowRight, Check, ShieldCheck, Store } from 'lucide-react';
import { getSupabaseBrowser } from '../../lib/supabase-browser';
const API='/api/backend';
const provinces=['Limpopo','Gauteng','Mpumalanga','North West','Free State','KwaZulu-Natal','Eastern Cape','Western Cape','Northern Cape'];
export default function Onboarding(){
 const router=useRouter();const [name,setName]=useState('');const [category,setCategory]=useState('Spaza shop');const [province,setProvince]=useState('Limpopo');const [town,setTown]=useState('');const [token,setToken]=useState('');const [pending,setPending]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{getSupabaseBrowser().auth.getUser().then(async ({data:{user}})=>{
  if(!user){router.replace('/login');return;}
  setName(typeof user.user_metadata?.business_name==='string'?user.user_metadata.business_name:'');
  const {data:{session}}=await getSupabaseBrowser().auth.getSession();
  if(!session){router.replace('/login');return;}setToken(session.access_token);
 }).catch(e=>setMessage(e instanceof Error?e.message:'Please sign in again.'));},[router]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!token)return setMessage('Please sign in again to finish setup.');
  setPending(true);setMessage('');
  try{
   const res=await fetch(API+'/api/merchant/onboard',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({business_name:name.trim(),category,province,town:town.trim()})});
   const json=await res.json();if(!res.ok&&res.status!==409)throw new Error(json.error||'Could not save your business.');
   router.replace('/dashboard');router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Could not finish setup.');}finally{setPending(false);}
 }
 return <main className="lp-onboard-page"><div className="lp-onboard-copy"><div className="lp-eyebrow">ALMOST THERE</div><div className="lp-onboard-symbol"><Store size={32}/></div><h1>Tell us a little about your business.</h1><p>From your first customer to your hundredth — we want LocalPay to feel like it was made for you. This takes less than a minute.</p><div className="lp-onboard-proof"><Check size={17}/> No monthly fee to start</div><div className="lp-onboard-proof"><Check size={17}/> No card machine needed</div><div className="lp-onboard-proof"><Check size={17}/> Just one account for your shop</div></div><div className="lp-onboard-form"><div className="lp-card"><h2>Set up your shop</h2><p>Customers will see your business name when they pay.</p>{message&&<div role="alert" className="lp-alert lp-alert-error">{message}</div>}<form className="lp-form" onSubmit={submit}><label htmlFor="on-name">What’s your business called?</label><input id="on-name" value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={100} placeholder="e.g. Mpho’s Fresh Kitchen"/><label htmlFor="on-category">What kind of business is it?</label><select id="on-category" className="lp-select" value={category} onChange={e=>setCategory(e.target.value)}>{['Spaza shop','Food & drinks','Salon & beauty','Barber shop','Clothing & fashion','Market stall','Services','Other'].map(c=><option key={c}>{c}</option>)}</select><label htmlFor="on-province">Province</label><select id="on-province" className="lp-select" value={province} onChange={e=>setProvince(e.target.value)}>{provinces.map(p=><option key={p}>{p}</option>)}</select><label htmlFor="on-town">Your town or area</label><input id="on-town" value={town} onChange={e=>setTown(e.target.value)} maxLength={80} placeholder="e.g. Thohoyandou"/><button className="lp-primary lp-full" disabled={pending||!token} type="submit">{pending?'Setting things up...':'Open my dashboard'}<ArrowRight size={18}/></button></form><p className="lp-safe-small"><ShieldCheck size={15}/> We respect your business information. <Link href="/pricing">View pricing</Link>.</p></div></div></main>;
}
