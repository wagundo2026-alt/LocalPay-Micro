'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowser } from '../../lib/supabase-browser';
type Result = { name:string; status:'working'|'failed'; details:string };
export default function ConnectionCheck(){
 const [checks,setChecks]=useState<Result[]>([]);
 const [busy,setBusy]=useState(false);
 async function run(){
  setBusy(true);setChecks([]);
  const results:Result[]=[];
  try{
   const res=await fetch('/api/backend/api/health',{cache:'no-store'});
   const json=await res.json();
   const working=res.ok && json?.data?.status==='ok';
   results.push({name:'Render backend',status:working?'working':'failed',details:working?'Backend responds correctly. Database configured: '+String(json.data.database_configured):json?.error||'Backend responded with HTTP '+res.status});
  }catch(e){results.push({name:'Render backend',status:'failed',details:e instanceof Error?e.message:'Unable to contact Render via Vercel.'});}
  try{
   const response=await fetch('/api/backend/api/health/database',{cache:'no-store'});
   const json=await response.json();
   results.push({
    name:'Supabase database from Render',
    status:response.ok&&json?.data?.database==='connected'?'working':'failed',
    details:response.ok?'Render can query the merchants table.':json?.error||'HTTP '+response.status+' — check Render database configuration.',
   });
  }catch(e){
   results.push({name:'Supabase database from Render',status:'failed',details:e instanceof Error?e.message:'Database check unavailable.'});
  }
  try{
   const supabase=getSupabaseBrowser();
   const {data,error}=await supabase.auth.getUser();
   if(error) results.push({name:'Supabase authentication',status:'failed',details:error.message});
   else results.push({name:'Supabase authentication',status:'working',details:data.user?'Logged-in session verified.':'Supabase is reachable. Sign in to use your dashboard.'});
  }catch(e){results.push({name:'Supabase authentication',status:'failed',details:e instanceof Error?e.message:'Supabase could not be reached.'});}
  setChecks(results);setBusy(false);
 }
 return <main className="lp-legal-page"><div className="lp-eyebrow">CONNECTION TROUBLESHOOTING</div><h1>Let's get your business connected.</h1><p style={{color:'#718790',lineHeight:1.7}}>This page safely checks whether the LocalPay backend and your Supabase login are reachable. It never displays passwords, access tokens, or private keys.</p><button type="button" className="lp-primary" onClick={run} disabled={busy}><RefreshCw size={17}/>{busy?'Checking your connections…':'Check my connections'}</button><div style={{marginTop:24,display:'grid',gap:15}}>{checks.map(r=><section key={r.name} className="lp-card"><div style={{display:'flex',gap:12,alignItems:'center',marginBottom:10}}>{r.status==='working'?<CheckCircle2 color="#059669"/>:<AlertTriangle color="#d97706"/>}<strong>{r.name}: {r.status==='working'?'Connected':'Needs attention'}</strong></div><p style={{lineHeight:1.7,overflowWrap:'anywhere'}}>{r.details}</p></section>)}</div><div style={{marginTop:32}}><Link className="lp-secondary" href="/dashboard">Return to dashboard</Link></div><p className="lp-safe-small"><ShieldCheck size={15}/> Your credentials are never included in the diagnostic results.</p></main>;
}
