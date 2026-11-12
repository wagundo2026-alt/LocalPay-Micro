'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
 ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, CircleHelp,
 Clock3, Copy, CreditCard, Download, ExternalLink, LayoutDashboard, Link2, LogOut,
 Menu, Plus, QrCode, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Store,
 Wallet, X, Zap
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { getSupabaseBrowser } from '../lib/supabase-browser';

type View = 'overview' | 'payments' | 'qr-code' | 'transactions' | 'analytics' | 'subscription' | 'settings';
type Merchant = { id:string; business_name:string; category:string|null; province:string|null; town:string|null };
type PaymentLink = { id:string; token:string; amount_cents:number; description:string; active:boolean; created_at:string };
type Transaction = { id:string; reference:string; amount_cents:number; status:string; provider:string; created_at:string };
type Summary = {gross_cents:number;successful_count:number;pending_count:number};
type ChartDay = {date:string;total_cents:number;count:number};
type ApiResult<T> = {data:T|null;error:string|null};
const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const money=(cents:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(cents/100);
const date=(s:string)=>new Date(s).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'});
const menu: {slug:View;label:string;icon:typeof LayoutDashboard}[]=[
 {slug:'overview',label:'Overview',icon:LayoutDashboard},
 {slug:'payments',label:'Payment links',icon:Link2},
 {slug:'qr-code',label:'My QR codes',icon:QrCode},
 {slug:'transactions',label:'Transactions',icon:CreditCard},
 {slug:'analytics',label:'Sales insights',icon:BarChart3},
 {slug:'subscription',label:'My plan',icon:Sparkles},
 {slug:'settings',label:'Business settings',icon:Settings}
];
async function callApi<T>(path:string,token:string,options?:RequestInit):Promise<T>{
 if(!API)throw new Error('Backend URL not configured. Add NEXT_PUBLIC_API_URL in Vercel.');
 let res: Response;
 try {
  res=await fetch(API+path,{...options,headers:{'Authorization':'Bearer '+token,...(options?.body?{'Content-Type':'application/json'}:{}),...options?.headers},cache:'no-store'});
 } catch {
  throw new Error('Cannot connect to LocalPay’s backend. Check that Render is Live and the Vercel NEXT_PUBLIC_API_URL points to https://localpay-micro1.onrender.com. If Render is live, check its FRONTEND_ORIGINS/CORS setting.');
 }
 const data:ApiResult<T>=await res.json().catch(()=>({data:null,error:'The server did not return a valid response.'}));
 if(!res.ok)throw new Error(data.error || 'Unable to load. Please try again.');
 return data.data as T;
}
export default function MerchantWorkspace({view}: {view:View}){
 const router=useRouter();
 const [merchant,setMerchant]=useState<Merchant|null>(null);
 const [token,setToken]=useState('');
 const [loading,setLoading]=useState(true);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [sidebar,setSidebar]=useState(false);
 const [links,setLinks]=useState<PaymentLink[]>([]);
 const [transactions,setTransactions]=useState<Transaction[]>([]);
 const [summary,setSummary]=useState<Summary>({gross_cents:0,successful_count:0,pending_count:0});
 const [chart,setChart]=useState<ChartDay[]>([]);
 const [amount,setAmount]=useState('20');
 const [description,setDescription]=useState('');
 const [query,setQuery]=useState('');
 const [statusFilter,setStatusFilter]=useState('all');
 const [lastLink,setLastLink]=useState<PaymentLink|null>(null);
 const [profile,setProfile]=useState({business_name:'',category:'',province:'',town:''});
 const [qrSelected,setQrSelected]=useState('');
 const shareUrl=(link:PaymentLink)=>typeof window==='undefined'?'':window.location.origin+'/pay/'+link.token;
 const navigate=(slug:View)=>slug==='overview'?'/dashboard':'/dashboard/'+slug;
 async function refresh(accessToken:string){
  const [m,s,l,t,a]=await Promise.all([
   callApi<Merchant>('/api/merchant/me',accessToken),
   callApi<Summary>('/api/dashboard/summary',accessToken),
   callApi<PaymentLink[]>('/api/payment-links',accessToken),
   callApi<Transaction[]>('/api/transactions',accessToken),
   callApi<{daily:ChartDay[]}>('/api/dashboard/analytics',accessToken),
  ]);
  setMerchant(m);setProfile({business_name:m.business_name,category:m.category||'',province:m.province||'',town:m.town||''});
  setSummary(s);setLinks(l);setTransactions(t);setChart(a.daily||[]);
 }
 useEffect(()=>{
  let active=true;
  async function boot(){
   try{
    const supabase=getSupabaseBrowser();
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError || !user){router.replace('/login');return;}
    const {data:{session}}=await supabase.auth.getSession();
    if(!session){router.replace('/login');return;}
    if(!active)return;
    setToken(session.access_token);
    await refresh(session.access_token);
   }catch(e){
    if(!active)return;
    const message=e instanceof Error?e.message:'Unable to load dashboard.';
    if(message.includes('Complete merchant onboarding') || message.includes('404')){router.replace('/onboarding');return;}
    setError(message);
   }finally{if(active)setLoading(false);}
  }
  boot();
  return()=>{active=false};
 },[router]);
 async function recheck(){
  if(!token)return;
  setError('');setPending(true);
  try{await refresh(token);setSuccess('Your sales are up to date.');}
  catch(e){setError(e instanceof Error?e.message:'Could not refresh data.');}
  finally{setPending(false);}
 }
 async function createLink(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');setSuccess('');
  const cents=Math.round(Number(amount)*100);
  if(!Number.isFinite(cents)||cents<100||cents>10000000){setError('Enter an amount between R1 and R100,000.');return;}
  setPending(true);
  try{
   const created=await callApi<PaymentLink>('/api/payment-links',token,{method:'POST',body:JSON.stringify({amount_cents:cents,description:description.trim()||'Payment'})});
   setLinks(prev=>[created,...prev]);setLastLink(created);setQrSelected(created.id);setDescription('');
   setSuccess('Done! Your new payment link is ready to share.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to create link.');}
  finally{setPending(false);}
 }
 async function saveProfile(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setPending(true);setError('');setSuccess('');
  try{const updated=await callApi<Merchant>('/api/merchant/me',token,{method:'PATCH',body:JSON.stringify(profile)});setMerchant(updated);setSuccess('Your business details have been saved.');}
  catch(e){setError(e instanceof Error?e.message:'Could not save settings.');}
  finally{setPending(false);}
 }
 async function exportCsv(){
  setPending(true);setError('');
  try{
   if(!API)throw new Error('Backend URL not configured.');
   const res=await fetch(API+'/api/transactions/export.csv',{headers:{Authorization:'Bearer '+token}});
   if(!res.ok)throw new Error('Unable to download report.');
   const url=URL.createObjectURL(await res.blob());
   const a=document.createElement('a');a.href=url;a.download='localpay-transactions.csv';a.click();URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:'Download failed.');}
  finally{setPending(false);}
 }
 async function copy(value:string){try{await navigator.clipboard.writeText(value);setSuccess('Copied! Your link is ready to share.');}catch{setError('Copy is unavailable. Please select the link manually.');}}
 async function logout(){await getSupabaseBrowser().auth.signOut();router.replace('/login');router.refresh();}
 const paid=transactions.filter(t=>t.status==='successful');
 const recent=transactions.slice(0,6);
 const selected=links.find(l=>l.id===qrSelected)||links[0];
 const filtered=transactions.filter(t=>(statusFilter==='all'||t.status===statusFilter) &&
   (t.reference.toLowerCase().includes(query.toLowerCase())||t.provider.toLowerCase().includes(query.toLowerCase())));
 const days=useMemo(()=>chart.slice(-14).map(d=>({day:date(d.date),sales:d.total_cents/100})),[chart]);
 const displayName=merchant?.business_name||'Your business';
 const headings:Record<View,{eyebrow:string;title:string;subtitle:string}>={
  overview:{eyebrow:'YOUR BUSINESS AT A GLANCE',title:'Welcome back 👋',subtitle:'Here’s how your business is doing. One sale at a time.'},
  payments:{eyebrow:'GET PAID, YOUR WAY',title:'Payment links',subtitle:'Create a link once. Send it on WhatsApp, SMS or anywhere your customers are.'},
  'qr-code':{eyebrow:'SCAN. PAY. DONE.',title:'Your payment QR codes',subtitle:'Let your customers scan and pay straight from their phones.'},
  transactions:{eyebrow:'EVERY PAYMENT IN ONE PLACE',title:'Your transactions',subtitle:'Know what’s paid, what’s pending and what needs your attention.'},
  analytics:{eyebrow:'KNOW YOUR NUMBERS',title:'Sales insights',subtitle:'Simple numbers that help you make smarter business decisions.'},
  subscription:{eyebrow:'GROW AT YOUR PACE',title:'Plans that fit your hustle',subtitle:'Start for free. Upgrade only when your business needs more.'},
  settings:{eyebrow:'MAKE IT YOURS',title:'Business settings',subtitle:'Keep your business details current and familiar to customers.'}
 };
 const heading=headings[view];
 if(loading)return <main className="lp-loading"><div className="lp-loader"/><h2>Getting your shop ready...</h2><p>Just fetching your business information.</p></main>;
 if(!merchant)return <main className="lp-loading" style={{padding:24}}><div className="lp-empty-icon"><RefreshCw size={25}/></div><h2>We couldn’t load your business yet</h2><p style={{maxWidth:520,textAlign:'center'}}>{error||'Your dashboard is temporarily unavailable.'}</p><div style={{display:'flex',gap:12,marginTop:22,flexWrap:'wrap',justifyContent:'center'}}><button className="lp-primary" onClick={()=>window.location.reload()}>Try again</button><Link className="lp-secondary" href="/onboarding">Set up my business</Link></div><p style={{marginTop:16,fontSize:12,color:'#81949c'}}>Your sales figures are not shown until the backend confirms the data.</p></main>;
 return <div className="lp-app">
  {sidebar&&<button className="lp-overlay" aria-label="Close menu" onClick={()=>setSidebar(false)}/>}
  <aside className={'lp-sidebar '+(sidebar?'lp-sidebar-open':'')}>
   <Link href="/" className="lp-logo"><span className="lp-logo-icon"><Wallet size={22}/></span><span>localpay<span className="lp-logo-dot">.</span><small>MICRO BUSINESS</small></span></Link>
   <div className="lp-side-caption">YOUR WORKSPACE</div>
   <nav className="lp-side-nav" aria-label="Merchant navigation">
    {menu.map(m=><Link key={m.slug} className={'lp-side-link '+(view===m.slug?'active':'')} href={navigate(m.slug)} onClick={()=>setSidebar(false)}><m.icon size={19}/>{m.label}{view===m.slug&&<ChevronRight size={15} className="lp-side-chevron"/>}</Link>)}
   </nav>
   <div className="lp-side-bottom"><div className="lp-help"><ShieldCheck size={17}/><div><strong>Paystack test mode</strong><span>No real money is moving.</span></div></div>
    <button className="lp-side-link lp-logout" onClick={logout}><LogOut size={18}/> Sign out</button>
   </div>
  </aside>
  <div className="lp-main">
   <header className="lp-topbar"><button className="lp-menu-btn" aria-label="Open menu" onClick={()=>setSidebar(true)}><Menu/></button><div className="lp-breadcrumb">Workspace <ChevronRight size={14}/> <strong>{menu.find(m=>m.slug===view)?.label}</strong></div><div className="lp-top-right"><span className="lp-test-tag"><span className="lp-live-dot"/> TEST MODE</span><div className="lp-avatar">{displayName.slice(0,1).toUpperCase()}</div></div></header>
   <main className="lp-content">
    <div className="lp-head-row"><div><div className="lp-eyebrow">{heading.eyebrow}</div><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>{view==='overview'&&<Link className="lp-primary" href="/dashboard/payments"><Plus size={18}/> Create a payment link</Link>}{(view==='overview'||view==='transactions')&&<button className="lp-icon-btn" title="Refresh" onClick={recheck} disabled={pending}><RefreshCw size={18}/></button>}</div>
    {merchant&&<div className="lp-greeting"><span className="lp-greeting-icon"><Store size={18}/></span><div><strong>{displayName}</strong><span>{merchant.town||'South Africa'} · Your business workspace</span></div><span className="lp-good-badge"><Check size={13}/> Account ready</span></div>}
    {error&&<div className="lp-alert lp-alert-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
    {success&&<div className="lp-alert lp-alert-success" role="status"><Check size={17}/>{success}<button onClick={()=>setSuccess('')} aria-label="Dismiss message"><X size={16}/></button></div>}
    {view==='overview'&&<>
     <div className="lp-stat-grid">
      <article className="lp-stat"><div className="lp-stat-icon emerald"><Wallet size={19}/></div><div className="lp-stat-label">Verified test sales</div><div className="lp-stat-number">{money(summary.gross_cents)}</div><div className="lp-stat-detail"><Check size={14}/> {summary.successful_count} successful payments</div></article>
      <article className="lp-stat"><div className="lp-stat-icon blue"><ArrowDownLeft size={19}/></div><div className="lp-stat-label">Transactions received</div><div className="lp-stat-number">{transactions.length}</div><div className="lp-stat-detail">From your payment requests</div></article>
      <article className="lp-stat"><div className="lp-stat-icon amber"><Clock3 size={19}/></div><div className="lp-stat-label">Waiting for payment</div><div className="lp-stat-number">{summary.pending_count}</div><div className="lp-stat-detail">Not included in sales yet</div></article>
      <article className="lp-stat"><div className="lp-stat-icon violet"><Link2 size={19}/></div><div className="lp-stat-label">Your payment links</div><div className="lp-stat-number">{links.length}</div><div className="lp-stat-detail">Ready to share with customers</div></article>
     </div>
     <div className="lp-columns"><section className="lp-card lp-chart-card"><div className="lp-card-head"><div><h2>Sales over time</h2><p>Your verified test payments for recent days</p></div><Link href="/dashboard/analytics" className="lp-small-link">View insights <ArrowUpRight size={15}/></Link></div>{days.length?<div className="lp-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={days}><defs><linearGradient id="lpChart" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.26}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e6edf0"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#7c909a'}}/><Tooltip formatter={(v: unknown)=>money((Number(v)||0)*100)}/><Area type="monotone" dataKey="sales" stroke="#059669" strokeWidth={3} fill="url(#lpChart)"/></AreaChart></ResponsiveContainer></div>:<Empty icon={BarChart3} title="Your sales story starts here" description="Once your first test payment is verified, a sales chart will appear."/>}</section>
      <section className="lp-card lp-next-card"><div className="lp-card-head"><div><h2>Quick actions</h2><p>Everything you need for the next sale</p></div></div><Link href="/dashboard/payments" className="lp-action"><span className="lp-action-icon"><Plus size={20}/></span><span><strong>Request a payment</strong><small>Create a shareable link</small></span><ArrowRight size={17}/></Link><Link href="/dashboard/qr-code" className="lp-action"><span className="lp-action-icon"><QrCode size={20}/></span><span><strong>Show a QR code</strong><small>Let customers scan to pay</small></span><ArrowRight size={17}/></Link><Link href="/dashboard/transactions" className="lp-action"><span className="lp-action-icon"><CreditCard size={20}/></span><span><strong>Review transactions</strong><small>Check what’s been paid</small></span><ArrowRight size={17}/></Link><div className="lp-tip"><Zap size={18}/><span><strong>A little tip:</strong> Share a payment link on WhatsApp to make checkout easier for customers.</span></div></section></div>
     <section className="lp-card"><div className="lp-card-head"><div><h2>Recent activity</h2><p>Every payment, in plain sight</p></div><Link href="/dashboard/transactions" className="lp-small-link">View all <ArrowUpRight size={15}/></Link></div><TransactionTable transactions={recent}/></section>
    </>}
    {(view==='payments'||view==='qr-code')&&<>
      {view==='payments'&&<div className="lp-columns lp-payment-columns"><section className="lp-card"><div className="lp-card-head"><div><h2>Create a new payment request</h2><p>Simple as setting a price and sharing the link.</p></div><span className="lp-chip">NO CARD MACHINE</span></div><form className="lp-form" onSubmit={createLink}><label htmlFor="lp-amount">Amount (ZAR)</label><div className="lp-amount-field"><span>R</span><input id="lp-amount" type="number" step="0.01" min="1" max="100000" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="20.00"/></div><label htmlFor="lp-desc">What is this payment for?</label><input id="lp-desc" value={description} maxLength={180} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Haircut, lunch or groceries"/><p className="lp-field-hint">Customers will see this description at checkout.</p><button className="lp-primary lp-full" disabled={pending} type="submit"><Plus size={18}/>{pending?'Creating link...':'Create payment link'}</button></form></section><section className="lp-card lp-info-card"><div className="lp-info-graphic"><Link2 size={42}/></div><h2>Get paid without the awkward follow-ups.</h2><p>A customer can open your link on their phone, pay using the provider’s secure test checkout, and you can see the verified status right here.</p><div className="lp-info-foot"><ShieldCheck size={18}/> We only show payments as complete after server-side verification.</div></section></div>}
      {lastLink&&view==='payments'&&<section className="lp-card lp-new-link"><div><span className="lp-chip">JUST CREATED</span><h2>Your payment link is ready!</h2><p>{money(lastLink.amount_cents)} · {lastLink.description}</p></div><div className="lp-share-line"><input readOnly value={shareUrl(lastLink)} aria-label="New payment link"/><button className="lp-secondary" onClick={()=>copy(shareUrl(lastLink))}><Copy size={16}/> Copy</button><a className="lp-secondary" target="_blank" rel="noreferrer" href={'https://wa.me/?text='+encodeURIComponent('You can pay me here: '+shareUrl(lastLink))}>WhatsApp <ExternalLink size={15}/></a></div></section>}
      {view==='qr-code'&&<section className="lp-card lp-qr-card"><div><h2>A QR code for every payment link.</h2><p>Choose a payment link, then let your customer scan. You can print the code or show it on your phone.</p><label htmlFor="lp-select-qr" className="lp-qr-label">Select a payment request</label><select id="lp-select-qr" className="lp-select" value={selected?.id||''} onChange={e=>setQrSelected(e.target.value)}>{links.map(l=><option key={l.id} value={l.id}>{l.description} · {money(l.amount_cents)}</option>)}</select>{selected&&<div className="lp-qr-actions"><button className="lp-secondary" onClick={()=>copy(shareUrl(selected))}><Copy size={16}/> Copy link</button><button className="lp-secondary" onClick={()=>window.print()}><Download size={16}/> Print QR</button></div>}</div>{selected?<div className="lp-qr-paper"><QRCodeSVG value={shareUrl(selected)} size={230} includeMargin level="M"/><strong>{money(selected.amount_cents)}</strong><span>{displayName}</span><small>PAYSTACK TEST CHECKOUT</small></div>:<Empty icon={QrCode} title="No QR codes just yet" description="Create your first payment link and your QR will appear here."/>}</section>}
      {view==='payments'&&<section className="lp-card"><div className="lp-card-head"><div><h2>Your payment links</h2><p>All your requests in one place</p></div><span className="lp-muted">{links.length} links</span></div>{links.length?<div className="lp-link-list">{links.map(l=><div className="lp-link-row" key={l.id}><div className="lp-link-icon"><Link2 size={19}/></div><div className="lp-link-info"><strong>{l.description}</strong><span>Created {date(l.created_at)}</span></div><strong>{money(l.amount_cents)}</strong><button className="lp-icon-btn" title="Copy payment URL" onClick={()=>copy(shareUrl(l))}><Copy size={17}/></button><a className="lp-icon-btn" href={shareUrl(l)} target="_blank" rel="noreferrer" title="Open checkout"><ExternalLink size={17}/></a></div>)}</div>:<Empty icon={Link2} title="No payment links yet" description="Create your first payment request above — it takes just a moment."/>}</section>}
    </>}
    {view==='transactions'&&<section className="lp-card"><div className="lp-card-head"><div><h2>Payment history</h2><p>Showing verified and pending test transactions</p></div><button className="lp-secondary" onClick={exportCsv} disabled={pending}><Download size={16}/> Download CSV</button></div><div className="lp-table-toolbar"><div className="lp-search"><Search size={17}/><input aria-label="Search transactions" placeholder="Search reference or provider" value={query} onChange={e=>setQuery(e.target.value)}/></div><select className="lp-select lp-filter" aria-label="Filter transaction status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="successful">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></div><TransactionTable transactions={filtered}/></section>}
    {view==='analytics'&&<><div className="lp-stat-grid"><article className="lp-stat"><div className="lp-stat-icon emerald"><Wallet size={19}/></div><div className="lp-stat-label">Total verified test sales</div><div className="lp-stat-number">{money(summary.gross_cents)}</div></article><article className="lp-stat"><div className="lp-stat-icon blue"><CreditCard size={19}/></div><div className="lp-stat-label">Successful payments</div><div className="lp-stat-number">{summary.successful_count}</div></article><article className="lp-stat"><div className="lp-stat-icon amber"><Clock3 size={19}/></div><div className="lp-stat-label">Pending payments</div><div className="lp-stat-number">{summary.pending_count}</div></article><article className="lp-stat"><div className="lp-stat-icon violet"><ArrowUpRight size={19}/></div><div className="lp-stat-label">Average paid sale</div><div className="lp-stat-number">{money(paid.length?Math.round(summary.gross_cents/paid.length):0)}</div></article></div><section className="lp-card lp-chart-card lp-large-chart"><div className="lp-card-head"><div><h2>How sales are growing</h2><p>Verified test sales by day (ZAR)</p></div></div>{days.length?<div className="lp-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={days}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5edf0"/><XAxis dataKey="day" tick={{fontSize:11,fill:'#6a7e87'}} tickLine={false} axisLine={false}/><Tooltip formatter={(v: unknown)=>money((Number(v)||0)*100)}/><Area dataKey="sales" type="monotone" stroke="#059669" fill="#d1fae5" strokeWidth={3}/></AreaChart></ResponsiveContainer></div>:<Empty icon={BarChart3} title="A fresh start" description="Your sales chart will grow as payments are verified."/>}</section><div className="lp-tip lp-wide-tip"><CircleHelp size={18}/> These figures are test transactions. They are not evidence of real sales or settlements.</div></>}
    {view==='subscription'&&<div className="lp-plan-grid">{[{name:'Starter',price:'R0',features:['Payment links & QR codes','Basic transaction history','Simple sales overview'],current:true},{name:'Growth',price:'R49',features:['Everything in Starter','Downloadable sales reports','More business insights']},{name:'Business',price:'R99',features:['Everything in Growth','Team access (planned)','Priority support (planned)']}].map(p=><article key={p.name} className={'lp-card lp-plan '+(p.current?'lp-plan-active':'')}><span className="lp-chip">{p.current?'CURRENT FREE PLAN':'COMING SOON'}</span><h2>{p.name}</h2><p className="lp-plan-price">{p.price}<small>/month</small></p><p>Designed for businesses at your stage.</p><div className="lp-plan-features">{p.features.map(f=><div key={f}><Check size={16}/>{f}</div>)}</div><button disabled className="lp-primary lp-full">{p.current?'Your current plan':'Billing not connected yet'}</button></article>)}</div>}
    {view==='settings'&&<section className="lp-card lp-settings-card"><div className="lp-card-head"><div><h2>Your business details</h2><p>This is the name your customers will recognize on checkout.</p></div><Store size={23} color="#059669"/></div><form className="lp-form" onSubmit={saveProfile}><label htmlFor="setting-business">Business name</label><input id="setting-business" required minLength={2} maxLength={100} value={profile.business_name} onChange={e=>setProfile(p=>({...p,business_name:e.target.value}))}/><label htmlFor="setting-category">Business category</label><input id="setting-category" value={profile.category} maxLength={80} onChange={e=>setProfile(p=>({...p,category:e.target.value}))} placeholder="e.g. Spaza shop, Salon"/><div className="lp-two-fields"><div><label htmlFor="setting-town">Town / Area</label><input id="setting-town" value={profile.town} maxLength={80} onChange={e=>setProfile(p=>({...p,town:e.target.value}))}/></div><div><label htmlFor="setting-province">Province</label><input id="setting-province" value={profile.province} maxLength={80} onChange={e=>setProfile(p=>({...p,province:e.target.value}))}/></div></div><label>Merchant ID (read-only)</label><input value={merchant?.id||''} readOnly/><button className="lp-primary" disabled={pending} type="submit"><Check size={18}/>{pending?'Saving...':'Save business details'}</button></form></section>}
    <p className="lp-bottom-note"><ShieldCheck size={15}/> LocalPay Micro is currently running in sandbox mode. Do not accept real payments until your payment provider approves the merchant flow.</p>
   </main>
  </div>
 </div>;
}
function Empty({icon:Icon,title,description}:{icon:typeof Link2;title:string;description:string}){
 return <div className="lp-empty"><div className="lp-empty-icon"><Icon size={25}/></div><strong>{title}</strong><p>{description}</p></div>;
}
function TransactionTable({transactions}:{transactions:Transaction[]}){
 if(!transactions.length)return <Empty icon={CreditCard} title="Nothing here yet" description="Your transactions will show up as soon as a customer starts a payment."/>;
 return <div className="lp-table-wrap"><table className="lp-table"><thead><tr><th>Payment reference</th><th>Date</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td><strong>{t.reference.slice(0,16)}…</strong><small>{t.provider==='paystack'?'Paystack test':'Demo simulator'}</small></td><td>{date(t.created_at)}</td><td><strong>{money(t.amount_cents)}</strong></td><td><span className={'lp-status lp-status-'+t.status}>{t.status}</span></td><td><Link className="lp-table-action" href={'/receipt/'+encodeURIComponent(t.reference)}><ExternalLink size={15}/> View</Link></td></tr>)}</tbody></table></div>;
}
