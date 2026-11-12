'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
 ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, CircleHelp,
 Clock3, Copy, CreditCard, Download, ExternalLink, LayoutDashboard, Link2, LogOut, Landmark,
 Menu, Plus, QrCode, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Store,
 Wallet, X, Zap
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import dynamic from 'next/dynamic';
const SalesAreaChart = dynamic(()=>import('./SalesAreaChart'), {ssr:false,loading:()=>null});
import { getSupabaseBrowser } from '../lib/supabase-browser';
import {useLanguage} from '../lib/language';

type View = 'overview' | 'payments' | 'qr-code' | 'transactions' | 'analytics' | 'payouts' | 'subscription' | 'settings';
type Merchant = { id:string; business_name:string; category:string|null; province:string|null; town:string|null };
type PaymentLink = { id:string; token:string; amount_cents:number; description:string; active:boolean; created_at:string; expires_at:string; consumed_at:string|null };
type Transaction = { id:string; reference:string; amount_cents:number; status:string; provider:string; created_at:string; payer_name:string|null; payer_email:string|null };
type Summary = {gross_cents:number;successful_count:number;pending_count:number};
type ChartDay = {date:string;total_cents:number;count:number};
type PayoutRecord = {id:string;amount_cents:number;currency:string;status:string;created_at:string;settled_at:string|null};
type PayoutInfo = {
 currency:string;mode:'PAYSTACK_TEST';real_payouts_enabled:boolean;
 bank_account_connected:boolean;bank_account_verified:boolean;
 provider_multi_merchant_approved:boolean;
 available_to_withdraw_cents:number;confirmed_real_settlements_cents:number;
 verified_test_sales_cents:number;verified_test_sales_count:number;
 payouts:PayoutRecord[];notice:string;
};
type PlanInfo = {plan:'starter'|'basic'|'pro'|'pro_plus';name:string;price_cents:number;monthly_limit:number;used:number;remaining:number;next_reset:string;upgrade_request:{requested_plan:string;created_at:string}|null;billing_enabled:boolean};
type ApiResult<T> = {data:T|null;error:string|null};
const API='/api/backend';
const money=(cents:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(cents/100);
const date=(s:string)=>new Date(s).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'});
const menu: {slug:View;label:string;icon:typeof LayoutDashboard}[]=[
 {slug:'overview',label:'Overview',icon:LayoutDashboard},
 {slug:'payments',label:'Payment links',icon:Link2},
 {slug:'qr-code',label:'My QR codes',icon:QrCode},
 {slug:'transactions',label:'Transactions',icon:CreditCard},
 {slug:'analytics',label:'Sales insights',icon:BarChart3},
 {slug:'payouts',label:'Payouts',icon:Landmark},
 {slug:'subscription',label:'My plan',icon:Sparkles},
 {slug:'settings',label:'Business settings',icon:Settings}
];
async function callApi<T>(path:string,token:string,options?:RequestInit):Promise<T>{
 if(!API)throw new Error('Backend URL not configured. Add NEXT_PUBLIC_API_URL in Vercel.');
 let res: Response;
 try {
  res=await fetch(API+path,{...options,headers:{'Authorization':'Bearer '+token,...(options?.body?{'Content-Type':'application/json'}:{}),...options?.headers},cache:'no-store'});
 } catch {
  throw new Error('Cannot connect to LocalPay right now. The Render service may be starting or unavailable. Try again shortly or check the Connection Check page.');
 }
 const data:ApiResult<T>=await res.json().catch(()=>({data:null,error:'The server did not return a valid response.'}));
 if(!res.ok)throw new Error(data.error || 'Unable to load. Please try again.');
 return data.data as T;
}
export default function MerchantWorkspace({view}: {view:View}){
 const router=useRouter();
 const {t}=useLanguage();
 const [merchant,setMerchant]=useState<Merchant|null>(null);
 const [token,setToken]=useState('');
 const [loading,setLoading]=useState(true);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [sidebar,setSidebar]=useState(false);
 const [links,setLinks]=useState<PaymentLink[]>([]);
 const [transactions,setTransactions]=useState<Transaction[]>([]);
 const [transactionCount,setTransactionCount]=useState(0);
 const [summary,setSummary]=useState<Summary>({gross_cents:0,successful_count:0,pending_count:0});
 const [chart,setChart]=useState<ChartDay[]>([]);
 const [amount,setAmount]=useState('20');
 const [description,setDescription]=useState('');
 const [query,setQuery]=useState('');
 const [statusFilter,setStatusFilter]=useState('all');
 const [lastLink,setLastLink]=useState<PaymentLink|null>(null);
 const [profile,setProfile]=useState({business_name:'',category:'',province:'',town:''});
 const [qrSelected,setQrSelected]=useState('');
 const [planInfo,setPlanInfo]=useState<PlanInfo|null>(null);
 const [payoutInfo,setPayoutInfo]=useState<PayoutInfo|null>(null);
 const [checkoutOrigin,setCheckoutOrigin]=useState('');
 // A payment URL must use a dedicated public production domain. Preview
 // deployment hosts are often protected by Vercel Authentication.
 const shareUrl=(link:PaymentLink)=>checkoutOrigin?checkoutOrigin+'/pay/'+encodeURIComponent(link.token):'';
 const navigate=(slug:View)=>slug==='overview'?'/dashboard':'/dashboard/'+slug;
 async function refresh(accessToken:string){
  type WorkspaceData={
   merchant:Merchant;
   summary?:Summary;
   links?:PaymentLink[];
   transactions?:Transaction[];
   transaction_count?:number;
   analytics?:{daily:ChartDay[]};
   plan?:PlanInfo;
   checkout_origin?:string;
  };
  // One request per page; the server authenticates once and loads only the data
  // needed for the active view. No stale caching of payment or sales status.
  const data=await callApi<WorkspaceData>('/api/dashboard/bootstrap?view='+encodeURIComponent(view),accessToken);
  const m=data.merchant;
  // Reject malformed or protected preview hosts rather than shipping broken
  // customer links that require a Vercel account.
  const origin=data.checkout_origin || process.env.NEXT_PUBLIC_CHECKOUT_ORIGIN || '';
  let publicOrigin='';
  try {
   const u=new URL(origin);
   if(u.protocol==='https:' && !u.username && !u.password && !u.search && !u.hash && u.pathname==='/' &&
      !/^local-pay-micro-[a-z0-9-]+\.vercel\.app$/i.test(u.hostname)) publicOrigin=u.origin;
  }catch { /* Missing production configuration. Keep sharing disabled. */ }
  setCheckoutOrigin(publicOrigin);
  setMerchant(m);
  setProfile({business_name:m.business_name,category:m.category||'',province:m.province||'',town:m.town||''});
  if(data.summary)setSummary(data.summary);
  if(data.links)setLinks(data.links);
  if(data.transactions)setTransactions(data.transactions);
  if(typeof data.transaction_count==='number')setTransactionCount(data.transaction_count);
  if(data.analytics)setChart(data.analytics.daily||[]);
  if(data.plan)setPlanInfo(data.plan);
  if(view==='payouts')setPayoutInfo(await callApi<PayoutInfo>('/api/merchant/payouts',accessToken));
 }
 useEffect(()=>{
  let active=true;
  async function boot(){
   try{
    const supabase=getSupabaseBrowser();
    // getSession reuses the local session instead of making an extra auth
    // network round-trip. Flask verifies the access token server-side.
    const {data:{session},error:sessionError}=await supabase.auth.getSession();
    if(sessionError || !session?.access_token){router.replace('/login');return;}
    if(!active)return;
    setToken(session.access_token);
    await refresh(session.access_token);
   }catch(e){
    if(!active)return;
    const message=e instanceof Error?e.message:'Unable to load dashboard.';
    if(message.includes('Complete merchant onboarding')){router.replace('/onboarding');return;}
    if(message.includes('Invalid or expired session') || message.includes('Authentication required')){router.replace('/login');return;}
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
 async function revokeLink(link:PaymentLink){
  if(!token || !linkAvailable(link))return;
  if(!window.confirm('Disable this payment link? A new checkout cannot start from it.'))return;
  setPending(true);setError('');setSuccess('');
  try{
   await callApi('/api/payment-links/'+encodeURIComponent(link.id)+'/revoke',token,{method:'POST'});
   setLinks(prev=>prev.map(item=>item.id===link.id?{...item,active:false}:item));
   if(lastLink?.id===link.id)setLastLink(null);
   setSuccess('The payment link is now disabled.');
  }catch(e){setError(e instanceof Error?e.message:'Could not disable the payment link.');}
  finally{setPending(false);}
 }
 async function requestUpgrade(plan:'basic'|'pro'|'pro_plus'){
  if(!token || pending)return;
  setPending(true);setError('');setSuccess('');
  try{
   const result=await callApi<{requested_plan:string;status:string;message:string}>('/api/merchant/upgrade-request',token,{method:'POST',body:JSON.stringify({plan})});
   setSuccess(result.message);
   setPlanInfo(await callApi<PlanInfo>('/api/merchant/plan',token));
  }catch(e){setError(e instanceof Error?e.message:'Could not request an upgrade.');}
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
 async function downloadQr(link:PaymentLink){
  try{
   const element=document.getElementById('localpay-qr-svg');
   if(!(element instanceof SVGSVGElement))throw new Error('QR code is not ready. Please try again.');
   const cloned=element.cloneNode(true) as SVGSVGElement;
   cloned.setAttribute('xmlns','http://www.w3.org/2000/svg');
   cloned.setAttribute('width','600');cloned.setAttribute('height','600');
   const xml=new XMLSerializer().serializeToString(cloned);
   const blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const image=new Image();
   image.onload=()=>{
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=860;
    const context=canvas.getContext('2d');
    if(!context){URL.revokeObjectURL(url);setError('Unable to generate image on this browser.');return;}
    context.fillStyle='#ffffff';context.fillRect(0,0,720,860);
    context.drawImage(image,60,55,600,600);
    context.fillStyle='#123b3d';context.textAlign='center';
    context.font='bold 35px Arial, sans-serif';context.fillText(money(link.amount_cents),360,725);
    context.font='24px Arial, sans-serif';context.fillText((merchant?.business_name||'LocalPay merchant').slice(0,32),360,775);
    context.font='16px Arial, sans-serif';context.fillStyle='#64748b';context.fillText('LOCALPAY MICRO · PAYSTACK TEST MODE',360,815);
    const anchor=document.createElement('a');
    anchor.href=canvas.toDataURL('image/png');
    anchor.download='localpay-qr-'+link.token.slice(0,8)+'.png';
    anchor.click();URL.revokeObjectURL(url);
    setSuccess('QR code downloaded. Ready to display or print.');
   };
   image.onerror=()=>{URL.revokeObjectURL(url);setError('Could not generate QR image. Please try again.');};
   image.src=url;
  }catch(e){setError(e instanceof Error?e.message:'QR download failed.');}
 }
 async function copy(value:string){if(!value){setError('Public checkout address has not been configured. The merchant cannot share a protected Vercel deployment link.');return;}try{await navigator.clipboard.writeText(value);setSuccess('Copied! Your link is ready to share.');}catch{setError('Copy is unavailable. Please select the link manually.');}}
 async function logout(){await getSupabaseBrowser().auth.signOut();router.replace('/login');router.refresh();}
 const recent=transactions.slice(0,6);
 const linkAvailable=(l:PaymentLink)=>l.active&&!l.consumed_at&&new Date(l.expires_at).getTime()>Date.now();
 const selected=links.find(l=>l.id===qrSelected&&linkAvailable(l))||links.find(linkAvailable);
 const filtered=transactions.filter(t=>(statusFilter==='all'||t.status===statusFilter) &&
   (t.reference.toLowerCase().includes(query.toLowerCase())||t.provider.toLowerCase().includes(query.toLowerCase())));
 const days=useMemo(()=>chart.slice(-14).map(d=>({day:date(d.date),sales:d.total_cents/100})),[chart]);
 const displayName=merchant?.business_name||'Your business';
 const headings:Record<View,{eyebrow:string;title:string;subtitle:string}>={
  overview:{eyebrow:'YOUR BUSINESS AT A GLANCE',title:'Welcome back 👋',subtitle:'Here’s how your business is doing. One sale at a time.'},
  payments:{eyebrow:'GET PAID, YOUR WAY',title:'Payment links',subtitle:'Each request creates a unique, one-time link that expires after 24 hours.'},
  'qr-code':{eyebrow:'SCAN. PAY. DONE.',title:'Your payment QR codes',subtitle:'Let your customers scan and pay straight from their phones.'},
  transactions:{eyebrow:'EVERY PAYMENT IN ONE PLACE',title:'Your transactions',subtitle:'Know what’s paid, what’s pending and what needs your attention.'},
  analytics:{eyebrow:'KNOW YOUR NUMBERS',title:'Sales insights',subtitle:'Simple numbers that help you make smarter business decisions.'},
  payouts:{eyebrow:'PAYMENTS AND SETTLEMENTS',title:'Payouts',subtitle:'See verified test activity and understand when real bank settlements become available.'},
  subscription:{eyebrow:'GROW AT YOUR PACE',title:'Plans that fit your hustle',subtitle:'Track your monthly checkout limit and request more capacity as your business grows.'},
  settings:{eyebrow:'MAKE IT YOURS',title:'Business settings',subtitle:'Keep your business details current and familiar to customers.'}
 };
 const heading=headings[view];
 if(loading)return <main className="lp-loading"><div className="lp-loader"/><h2>Getting your shop ready...</h2><p>Just fetching your business information.</p></main>;
 if(!merchant)return <main className="lp-loading" style={{padding:24}}><div className="lp-empty-icon"><RefreshCw size={25}/></div><h2>We couldn’t load your business yet</h2><p style={{maxWidth:520,textAlign:'center'}}>{error||'Your dashboard is temporarily unavailable.'}</p><div style={{display:'flex',gap:12,marginTop:22,flexWrap:'wrap',justifyContent:'center'}}><button className="lp-primary" onClick={()=>window.location.reload()}>Try again</button><Link className="lp-secondary" href="/onboarding">Set up my business</Link><Link className="lp-secondary" href="/connection-check">Check connection</Link></div><p style={{marginTop:16,fontSize:12,color:'#81949c'}}>Your sales figures are not shown until the backend confirms the data.</p></main>;
 return <div className="lp-app">
  {sidebar&&<button className="lp-overlay" aria-label="Close menu" onClick={()=>setSidebar(false)}/>}
  <aside className={'lp-sidebar '+(sidebar?'lp-sidebar-open':'')}>
   <Link href="/" className="lp-logo"><span className="lp-logo-icon"><Wallet size={22}/></span><span>localpay<span className="lp-logo-dot">.</span><small>MICRO BUSINESS</small></span></Link>
   <div className="lp-side-caption">YOUR WORKSPACE</div>
   <nav className="lp-side-nav" aria-label="Merchant navigation">
    {menu.map(m=><Link key={m.slug} className={'lp-side-link '+(view===m.slug?'active':'')} href={navigate(m.slug)} onClick={()=>setSidebar(false)}><m.icon size={19}/>{t('dashboard.'+({'overview':'overview','payments':'payments','qr-code':'qr','transactions':'transactions','analytics':'analytics','payouts':'payouts','subscription':'plan','settings':'settings'}[m.slug]))}{view===m.slug&&<ChevronRight size={15} className="lp-side-chevron"/>}</Link>)}
   </nav>
   <div className="lp-side-bottom"><div className="lp-help"><ShieldCheck size={17}/><div><strong>Paystack test mode</strong><span>No real money is moving.</span></div></div>
    <button className="lp-side-link lp-logout" onClick={logout}><LogOut size={18}/> Sign out</button>
   </div>
  </aside>
  <div className="lp-main">
   <header className="lp-topbar"><button className="lp-menu-btn" aria-label="Open menu" onClick={()=>setSidebar(true)}><Menu/></button><div className="lp-breadcrumb">Workspace <ChevronRight size={14}/> <strong>{t('dashboard.'+({'overview':'overview','payments':'payments','qr-code':'qr','transactions':'transactions','analytics':'analytics','payouts':'payouts','subscription':'plan','settings':'settings'}[view]))}</strong></div><div className="lp-top-right"><span className="lp-test-tag"><span className="lp-live-dot"/> TEST MODE</span><div className="lp-avatar">{displayName.slice(0,1).toUpperCase()}</div></div></header>
   <main className="lp-content">
    <div className="lp-head-row"><div><div className="lp-eyebrow">{heading.eyebrow}</div><h1>{t('dashboard.'+({'overview':'welcome','payments':'paymentsTitle','qr-code':'qrTitle','transactions':'transactionsTitle','analytics':'analyticsTitle','payouts':'payoutsTitle','subscription':'planTitle','settings':'settingsTitle'}[view]))}</h1><p>{heading.subtitle}</p></div>{view==='overview'&&<Link className="lp-primary" href="/dashboard/payments"><Plus size={18}/> {t('dashboard.createLink')}</Link>}{(view==='overview'||view==='transactions')&&<button className="lp-icon-btn" title={t('dashboard.refresh')} onClick={recheck} disabled={pending}><RefreshCw size={18}/></button>}</div>
    {merchant&&<div className="lp-greeting"><span className="lp-greeting-icon"><Store size={18}/></span><div><strong>{displayName}</strong><span>{merchant.town||'South Africa'} · Your business workspace</span></div><span className="lp-good-badge"><Check size={13}/> Account ready</span></div>}
    {(view==='payments'||view==='qr-code')&&!checkoutOrigin&&<div className="lp-alert lp-alert-error" role="alert">Public payment links are temporarily unavailable. Configure the public FRONTEND_URL on Render so customers are sent to checkout instead of Vercel sign-in. Please do not distribute preview deployment links.</div>}
    {error&&<div className="lp-alert lp-alert-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
    {success&&<div className="lp-alert lp-alert-success" role="status"><Check size={17}/>{success}<button onClick={()=>setSuccess('')} aria-label="Dismiss message"><X size={16}/></button></div>}
    {view==='overview'&&<>
     <div className="lp-stat-grid">
      <article className="lp-stat"><div className="lp-stat-icon emerald"><Wallet size={19}/></div><div className="lp-stat-label">Verified test sales</div><div className="lp-stat-number">{money(summary.gross_cents)}</div><div className="lp-stat-detail"><Check size={14}/> {summary.successful_count} successful payments</div></article>
      <article className="lp-stat"><div className="lp-stat-icon blue"><ArrowDownLeft size={19}/></div><div className="lp-stat-label">Transactions received</div><div className="lp-stat-number">{transactionCount}</div><div className="lp-stat-detail">From your payment requests</div></article>
      <article className="lp-stat"><div className="lp-stat-icon amber"><Clock3 size={19}/></div><div className="lp-stat-label">Waiting for payment</div><div className="lp-stat-number">{summary.pending_count}</div><div className="lp-stat-detail">Not included in sales yet</div></article>
      <article className="lp-stat"><div className="lp-stat-icon violet"><Link2 size={19}/></div><div className="lp-stat-label">Your payment links</div><div className="lp-stat-number">{links.length}</div><div className="lp-stat-detail">Ready to share with customers</div></article>
     </div>
     <div className="lp-columns"><section className="lp-card lp-chart-card"><div className="lp-card-head"><div><h2>Sales over time</h2><p>Your verified test payments for recent days</p></div><Link href="/dashboard/analytics" className="lp-small-link">View insights <ArrowUpRight size={15}/></Link></div>{days.length?<div className="lp-chart"><SalesAreaChart days={days} variant="overview"/></div>:<Empty icon={BarChart3} title="Your sales story starts here" description="Once your first test payment is verified, a sales chart will appear."/>}</section>
      <section className="lp-card lp-next-card"><div className="lp-card-head"><div><h2>Quick actions</h2><p>Everything you need for the next sale</p></div></div><Link href="/dashboard/payments" className="lp-action"><span className="lp-action-icon"><Plus size={20}/></span><span><strong>Request a payment</strong><small>Create a shareable link</small></span><ArrowRight size={17}/></Link><Link href="/dashboard/qr-code" className="lp-action"><span className="lp-action-icon"><QrCode size={20}/></span><span><strong>Show a QR code</strong><small>Let customers scan to pay</small></span><ArrowRight size={17}/></Link><Link href="/dashboard/transactions" className="lp-action"><span className="lp-action-icon"><CreditCard size={20}/></span><span><strong>Review transactions</strong><small>Check what’s been paid</small></span><ArrowRight size={17}/></Link><div className="lp-tip"><Zap size={18}/><span><strong>A little tip:</strong> Share a payment link on WhatsApp to make checkout easier for customers.</span></div></section></div>
     <section className="lp-card"><div className="lp-card-head"><div><h2>Recent activity</h2><p>Every payment, in plain sight</p></div><Link href="/dashboard/transactions" className="lp-small-link">View all <ArrowUpRight size={15}/></Link></div><TransactionTable transactions={recent}/></section>
    </>}
    {view==='payouts'&&<div className="lp-payouts-page">
      <div className="lp-alert lp-alert-error" role="status">
        <ShieldCheck size={18}/> {t('payouts.testNotice')}
      </div>
      <div className="lp-stat-grid">
       <article className="lp-stat"><div className="lp-stat-icon emerald"><Wallet size={19}/></div>
        <div className="lp-stat-label">{t('payouts.withdrawable')}</div>
        <div className="lp-stat-number">{money(payoutInfo?.available_to_withdraw_cents??0)}</div>
        <div className="lp-stat-detail">{t('payouts.noWithdrawals')}</div></article>
       <article className="lp-stat"><div className="lp-stat-icon blue"><Check size={19}/></div>
        <div className="lp-stat-label">{t('payouts.testSales')}</div>
        <div className="lp-stat-number">{money(payoutInfo?.verified_test_sales_cents??0)}</div>
        <div className="lp-stat-detail">{payoutInfo?.verified_test_sales_count??0} {t('payouts.testTransactions')}</div></article>
       <article className="lp-stat"><div className="lp-stat-icon violet"><Landmark size={19}/></div>
        <div className="lp-stat-label">{t('payouts.settled')}</div>
        <div className="lp-stat-number">{money(payoutInfo?.confirmed_real_settlements_cents??0)}</div>
        <div className="lp-stat-detail">{t('payouts.noLiveSettlement')}</div></article>
      </div>
      <section className="lp-card" style={{marginTop:20}}>
       <div className="lp-card-head"><div><h2>{t('payouts.method')}</h2><p>{t('payouts.methodDesc')}</p></div><Landmark size={24}/></div>
       <div className="lp-link-list">
        <div className="lp-link-row"><strong>{t('payouts.bankAccount')}</strong>
        <span>{t('payouts.notConnected')}</span></div>
        <div className="lp-link-row"><strong>{t('payouts.merchantVerification')}</strong>
        <span>{t('payouts.notVerified')}</span></div>
        <div className="lp-link-row"><strong>{t('payouts.providerApproval')}</strong>
        <span>{t('payouts.notApproved')}</span></div>
       </div>
       <p className="lp-field-hint">{t('payouts.bankWarning')}</p>
       <button type="button" className="lp-secondary" disabled title={t('payouts.notAvailable')}>
        <ShieldCheck size={16}/> {t('payouts.withdrawDisabled')}
       </button>
      </section>
      <section className="lp-card" style={{marginTop:20}}>
       <div className="lp-card-head"><div><h2>{t('payouts.history')}</h2>
       <p>{t('payouts.historyDescription')}</p></div></div>
       {payoutInfo?.payouts?.length?<div className="lp-table-wrap"><table className="lp-table">
       <thead><tr><th>{t('payouts.date')}</th><th>{t('payouts.amount')}</th><th>{t('payouts.status')}</th></tr></thead>
       <tbody>{payoutInfo.payouts.map(p=><tr key={p.id}><td>{date(p.created_at)}</td>
       <td>{money(p.amount_cents)}</td><td>{p.status}</td></tr>)}</tbody></table></div>:
       <p>{t('payouts.noHistory')}</p>}
      </section>
    </div>}
    {(view==='payments'||view==='qr-code')&&<>
      {view==='payments'&&<div className="lp-columns lp-payment-columns"><section className="lp-card"><div className="lp-card-head"><div><h2>{t('dashboard.newPayment')}</h2><p>Simple as setting a price and sharing the link.</p></div><span className="lp-chip">NO CARD MACHINE</span></div><form className="lp-form" onSubmit={createLink}><label htmlFor="lp-amount">{t('common.amount')}</label><div className="lp-amount-field"><span>R</span><input id="lp-amount" type="number" step="0.01" min="1" max="100000" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="20.00"/></div><label htmlFor="lp-desc">{t('dashboard.description')}</label><input id="lp-desc" value={description} maxLength={180} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Haircut, lunch or groceries"/><p className="lp-field-hint">{t('dashboard.linkNote')}</p><button className="lp-primary lp-full" disabled={pending} type="submit"><Plus size={18}/>{pending?t('common.wait'):t('dashboard.createLink')}</button></form></section><section className="lp-card lp-info-card"><div className="lp-info-graphic"><Link2 size={42}/></div><h2>Get paid without the awkward follow-ups.</h2><p>A customer can open your link on their phone, pay using the provider’s secure test checkout, and you can see the verified status right here.</p><div className="lp-info-foot"><ShieldCheck size={18}/> We only show payments as complete after server-side verification.</div></section></div>}
      {lastLink&&view==='payments'&&<section className="lp-card lp-new-link"><div><span className="lp-chip">JUST CREATED</span><h2>Your payment link is ready!</h2><p>{money(lastLink.amount_cents)} · {lastLink.description} · Expires {new Date(lastLink.expires_at).toLocaleString('en-ZA')}</p></div><div className="lp-share-line"><input readOnly value={shareUrl(lastLink)} aria-label="New payment link" placeholder="Public checkout domain not configured"/><button className="lp-secondary" disabled={!checkoutOrigin} onClick={()=>copy(shareUrl(lastLink))}><Copy size={16}/> Copy</button><a className="lp-secondary" aria-disabled={!checkoutOrigin} onClick={e=>{if(!checkoutOrigin)e.preventDefault();}} target="_blank" rel="noreferrer" href={checkoutOrigin?'https://wa.me/?text='+encodeURIComponent('You can pay me here: '+shareUrl(lastLink)):'#'}>WhatsApp <ExternalLink size={15}/></a></div></section>}
      {view==='qr-code'&&<>
       <div className="lp-columns lp-payment-columns">
        <section className="lp-card">
         <div className="lp-card-head"><div><h2>Create a QR payment request</h2><p>Set the amount, then share your QR with customers.</p></div><span className="lp-chip">FREE TO CREATE</span></div>
         <form className="lp-form" onSubmit={createLink}>
          <label htmlFor="lp-qr-amount">{t('common.amount')}</label>
          <div className="lp-amount-field"><span>R</span><input id="lp-qr-amount" required type="number" min="1" max="100000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
          <label htmlFor="lp-qr-description">{t('dashboard.description')}</label>
          <input id="lp-qr-description" maxLength={180} placeholder="e.g. Lunch special, haircut or groceries" value={description} onChange={e=>setDescription(e.target.value)}/>
          <button className="lp-primary lp-full" type="submit" disabled={pending}><QrCode size={18}/>{pending?'Creating QR...':'Generate my QR code'}</button>
         </form>
        </section>
        <section className="lp-card lp-qr-card lp-qr-preview">
         <div><h2>Ready to scan</h2><p>Choose any saved payment request to display its QR code, or create a new one using the form.</p>
         {links.some(linkAvailable)&&<><label htmlFor="lp-select-qr" className="lp-qr-label">Payment request</label>
         <select id="lp-select-qr" className="lp-select" value={selected?.id||''} onChange={e=>setQrSelected(e.target.value)}>
          {links.filter(linkAvailable).map(link=><option key={link.id} value={link.id}>{link.description} · {money(link.amount_cents)}</option>)}
         </select></>}
         {selected&&checkoutOrigin&&<div className="lp-qr-actions">
          <button className="lp-secondary" type="button" onClick={()=>copy(shareUrl(selected))}><Copy size={16}/> Copy link</button>
          <button className="lp-secondary" type="button" onClick={()=>downloadQr(selected)}><Download size={16}/> Download PNG</button>
          <a href={shareUrl(selected)} target="_blank" rel="noopener noreferrer" className="lp-secondary"><ExternalLink size={16}/> Test checkout</a>
         </div>}</div>
         {selected&&selected.active&&checkoutOrigin?
          <div className="lp-qr-paper"><QRCodeSVG id="localpay-qr-svg" value={shareUrl(selected)} size={230} includeMargin level="H"/><strong>{money(selected.amount_cents)}</strong><span>{displayName}</span><small>PAYSTACK TEST CHECKOUT</small></div>
          :<Empty icon={QrCode} title="Your first QR is one click away" description="Enter an amount and select Generate my QR code to begin."/>}
        </section>
       </div>
       {selected&&<div className="lp-tip lp-wide-tip"><ShieldCheck size={18}/> QR codes open the LocalPay checkout page. They do not confirm payment: only a successful Paystack server verification does that. This is test mode and no real money moves.</div>}
      </>}
      {view==='payments'&&<section className="lp-card"><div className="lp-card-head"><div><h2>Your payment links</h2><p>All your requests in one place</p></div><span className="lp-muted">{links.length} links</span></div>{links.length?<div className="lp-link-list">{links.map(l=><div className="lp-link-row" key={l.id}><div className="lp-link-icon"><Link2 size={19}/></div><div className="lp-link-info"><strong>{l.description}</strong><span>{linkAvailable(l)?'Active · expires '+date(l.expires_at):'Used or expired'}</span></div><strong>{money(l.amount_cents)}</strong><button disabled={!linkAvailable(l)||!checkoutOrigin} className="lp-icon-btn" title="Copy payment URL" onClick={()=>copy(shareUrl(l))}><Copy size={17}/></button>{linkAvailable(l)&&checkoutOrigin&&<><a className="lp-icon-btn" href={shareUrl(l)} target="_blank" rel="noreferrer" title="Open checkout"><ExternalLink size={17}/></a><button className="lp-secondary" type="button" disabled={pending} onClick={()=>revokeLink(l)}><X size={15}/> {t('dashboard.disable')}</button></>}</div>)}</div>:<Empty icon={Link2} title="No payment links yet" description="Create your first payment request above — it takes just a moment."/>}</section>}
    </>}
    {view==='transactions'&&<section className="lp-card"><div className="lp-card-head"><div><h2>{t('dashboard.paymentHistory')}</h2><p>Showing verified and pending test transactions</p></div><button className="lp-secondary" onClick={exportCsv} disabled={pending}><Download size={16}/> Download CSV</button></div><div className="lp-table-toolbar"><div className="lp-search"><Search size={17}/><input aria-label="Search transactions" placeholder="Search reference or provider" value={query} onChange={e=>setQuery(e.target.value)}/></div><select className="lp-select lp-filter" aria-label="Filter transaction status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="successful">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></div><TransactionTable transactions={filtered}/></section>}
    {view==='analytics'&&<><div className="lp-stat-grid"><article className="lp-stat"><div className="lp-stat-icon emerald"><Wallet size={19}/></div><div className="lp-stat-label">Total verified test sales</div><div className="lp-stat-number">{money(summary.gross_cents)}</div></article><article className="lp-stat"><div className="lp-stat-icon blue"><CreditCard size={19}/></div><div className="lp-stat-label">Successful payments</div><div className="lp-stat-number">{summary.successful_count}</div></article><article className="lp-stat"><div className="lp-stat-icon amber"><Clock3 size={19}/></div><div className="lp-stat-label">Pending payments</div><div className="lp-stat-number">{summary.pending_count}</div></article><article className="lp-stat"><div className="lp-stat-icon violet"><ArrowUpRight size={19}/></div><div className="lp-stat-label">Average paid sale</div><div className="lp-stat-number">{money(summary.successful_count?Math.round(summary.gross_cents/summary.successful_count):0)}</div></article></div><section className="lp-card lp-chart-card lp-large-chart"><div className="lp-card-head"><div><h2>How sales are growing</h2><p>Verified test sales by day (ZAR)</p></div></div>{days.length?<div className="lp-chart"><SalesAreaChart days={days} variant="analytics"/></div>:<Empty icon={BarChart3} title="A fresh start" description="Your sales chart will grow as payments are verified."/>}</section><div className="lp-tip lp-wide-tip"><CircleHelp size={18}/> These figures are test transactions. They are not evidence of real sales or settlements.</div></>}
    {view==='subscription'&&<>
     <section className="lp-card lp-subscription-dashboard">
      <div className="lp-eyebrow">YOUR MONTHLY CHECKOUT ALLOWANCE</div>
      <h2>{planInfo?.name||'Starter'} plan <span className="lp-chip">TEST MODE</span></h2>
      <p className="lp-plan-price">{money(planInfo?.price_cents??0)}<small>/month · {planInfo?.plan==='starter'?'free Starter':'proposed upgrade'}</small></p>
      <p><strong>{planInfo?.used??0} of {planInfo?.monthly_limit??200}</strong> Paystack checkout attempts used this month · <strong>{planInfo?.remaining??200} remaining</strong></p>
      <div className="lp-quota-track" role="progressbar" aria-label="Monthly checkout allowance used" aria-valuenow={planInfo?.used??0} aria-valuemin={0} aria-valuemax={planInfo?.monthly_limit??200}><div style={{width:((planInfo?.used??0)/(planInfo?.monthly_limit||200)*100)+'%'}}/></div>
      <p className="lp-field-hint">Limits reset at 00:00 UTC on the first day of each month (next reset: {planInfo?.next_reset?new Date(planInfo.next_reset).toLocaleDateString('en-ZA'):'next month'}). Failed and abandoned checkout attempts count. Generating a QR or link does not consume an attempt.</p>
      {planInfo?.remaining===0&&<div className="lp-alert lp-alert-error">You have reached your monthly checkout limit. Request a higher plan or wait for the next monthly reset.</div>}
      {planInfo?.upgrade_request&&<div className="lp-tip lp-wide-tip"><Clock3 size={17}/> Your {planInfo.upgrade_request.requested_plan.replace('_',' ')} upgrade request is pending. Your current quota stays the same until an authorised activation. No payment has been taken.</div>}
     </section>
     <div className="lp-plan-grid">
      {([
       {key:'starter' as const,name:'Starter',price:0,limit:200,subtitle:'No monthly subscription for micro-businesses',features:['Payment links and QR codes','Essential payment records']},
       {key:'basic' as const,name:'Basic',price:4900,limit:500,subtitle:'Optional insights and more checkouts',features:['Everything in Starter','Additional checkout capacity and planned reports']}, 
       {key:'pro' as const,name:'Pro',price:9900,limit:1000,subtitle:'For busy spaza shops and takeaways',features:['Everything in Basic','Downloadable reports and insights']},
       {key:'pro_plus' as const,name:'Pro Plus',price:19900,limit:5000,subtitle:'For higher-volume shops and restaurants',features:['Everything in Pro','More monthly checkout capacity']}
      ]).map(p=><article key={p.key} className={'lp-card lp-plan '+(planInfo?.plan===p.key?'lp-plan-active':'')}>
        <span className="lp-chip">{planInfo?.plan===p.key?'CURRENT SANDBOX PLAN':'PROPOSED UPGRADE'}</span>
        <h2>{p.name}</h2><p className="lp-plan-price">{money(p.price)}<small>/month</small></p>
        <p><strong>{p.limit.toLocaleString('en-ZA')}</strong> checkout attempts per month</p>
        <p>{p.subtitle}</p>
        <div className="lp-plan-features">{p.features.map(f=><div key={f}><Check size={16}/>{f}</div>)}</div>
        {planInfo?.plan===p.key?<button type="button" className="lp-primary lp-full" disabled>Current plan</button>:
          p.key!=='starter'&&(!planInfo || (p.key==='basic'&&planInfo.plan!=='starter')||(p.key==='pro'&&planInfo.plan==='pro_plus')||planInfo.upgrade_request)?
            <button type="button" className="lp-primary lp-full" disabled>{planInfo?.upgrade_request?'Upgrade request pending':'Not available'}</button>:
          p.key==='starter'?<button type="button" className="lp-primary lp-full" disabled>Free Starter</button>:
          <button type="button" className="lp-primary lp-full" disabled={pending} onClick={()=>requestUpgrade(p.key as 'basic'|'pro'|'pro_plus')}>{pending?'Requesting…':'Request upgrade'} <ArrowRight size={16}/></button>}
       </article>)}
     </div>
     <div className="lp-tip lp-wide-tip"><ShieldCheck size={18}/> Starter is R0/month. Basic, Pro and Pro Plus are optional proposed upgrades; no subscription fee is currently collected. A capped 1% introductory merchant fee for the first three months is proposed only for an approved future pilot, not active in Paystack sandbox. Normal provider fees would apply outside the promotion. No real settlement or fee reimbursement is enabled.</div>
    </>}
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
 const {t:translate}=useLanguage();
 if(!transactions.length)return <Empty icon={CreditCard} title="Nothing here yet" description="Your transactions will show up as soon as a customer starts a payment."/>;
 return <div className="lp-table-wrap"><table className="lp-table"><thead><tr><th>{translate('dashboard.reference')}</th><th>{translate('dashboard.payer')}</th><th>{translate('dashboard.date')}</th><th>{translate('common.amount')}</th><th>{translate('dashboard.status')}</th><th>Receipt</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td><strong>{t.reference.slice(0,16)}…</strong><small>{t.provider==='paystack'?'Paystack test':'Demo simulator'}</small></td><td><strong>{t.payer_name||translate('dashboard.noPayer')}</strong><small>{t.payer_email||'Payer not identified'}</small></td><td>{date(t.created_at)}</td><td><strong>{money(t.amount_cents)}</strong></td><td><span className={'lp-status lp-status-'+t.status}>{t.status}</span></td><td><Link className="lp-table-action" href={'/receipt/'+encodeURIComponent(t.reference)}><ExternalLink size={15}/> View</Link></td></tr>)}</tbody></table></div>;
}
