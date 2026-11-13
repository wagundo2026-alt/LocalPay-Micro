'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {AlertTriangle, CheckCircle2, ClipboardList, Plus, RefreshCw, TrendingUp} from 'lucide-react';

type Plan='starter'|'basic'|'pro'|'pro_plus';
type Expense={id:string;label:string;amount_cents:number;expense_date:string};
type Stock={id:string;name:string;quantity:number;low_stock_threshold:number};
const api='/api/backend';
const money=(cents:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(cents/100);

async function authorised<T>(path:string,token:string,options?:RequestInit):Promise<T>{
 const response=await fetch(api+path,{...options,cache:'no-store',headers:{
  Authorization:'Bearer '+token,...(options?.body?{'Content-Type':'application/json'}:{}),...options?.headers
 }});
 const json=await response.json().catch(()=>({data:null,error:'Unexpected server response.'}));
 if(!response.ok)throw new Error(json.error||'Could not complete the request.');
 return json.data as T;
}

export default function BusinessTools({plan,token,verifiedTestSalesCents}:{plan:Plan;token:string;verifiedTestSalesCents:number}){
 const [expenses,setExpenses]=useState<Expense[]>([]);
 const [stock,setStock]=useState<Stock[]>([]);
 const [expenseLabel,setExpenseLabel]=useState('');
 const [expenseAmount,setExpenseAmount]=useState('');
 const [stockName,setStockName]=useState('');
 const [stockQuantity,setStockQuantity]=useState('0');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [loaded,setLoaded]=useState(false);
 const inventory=plan==='pro_plus';
 useEffect(()=>{
  let active=true;
  if(!token || !['pro','pro_plus'].includes(plan))return;
  Promise.all([
   authorised<Expense[]>('/api/merchant/expenses',token),
   inventory?authorised<Stock[]>('/api/merchant/inventory',token):Promise.resolve([])
  ]).then(([e,s])=>{if(active){setExpenses(e);setStock(s);setLoaded(true);}})
    .catch((e:unknown)=>{if(active)setError(e instanceof Error?e.message:'Unable to load your business tools.');});
  return()=>{active=false};
 },[token,plan,inventory]);
 if(!['pro','pro_plus'].includes(plan))return null;
 const expenseTotal=expenses.reduce((sum,item)=>sum+item.amount_cents,0);
 const currentMonth=new Date().toISOString().slice(0,7);
 const monthlyExpenses=expenses.filter(item=>item.expense_date.slice(0,7)===currentMonth)
  .reduce((sum,item)=>sum+item.amount_cents,0);
 async function addExpense(e:FormEvent){
  e.preventDefault();setError('');setNotice('');
  const amount=Math.round(Number(expenseAmount)*100);
  if(expenseLabel.trim().length<2||!Number.isSafeInteger(amount)||amount<1){
   setError('Enter an expense name and a positive amount.');return;
  }
  setBusy(true);
  try{
   const row=await authorised<Expense>('/api/merchant/expenses',token,{method:'POST',body:JSON.stringify({label:expenseLabel.trim(),amount_cents:amount})});
   setExpenses(old=>[row,...old]);setExpenseLabel('');setExpenseAmount('');setNotice('Expense recorded.');
  }catch(ex){setError(ex instanceof Error?ex.message:'Expense could not be recorded.');}
  finally{setBusy(false);}
 }
 async function addStock(e:FormEvent){
  e.preventDefault();setError('');setNotice('');
  const quantity=Number(stockQuantity);
  if(stockName.trim().length<2||!Number.isInteger(quantity)||quantity<0){
   setError('Enter an item name and non-negative whole-number quantity.');return;
  }
  setBusy(true);
  try{
   const row=await authorised<Stock>('/api/merchant/inventory',token,{method:'POST',body:JSON.stringify({name:stockName.trim(),quantity,low_stock_threshold:5})});
   setStock(old=>[...old,row].sort((a,b)=>a.name.localeCompare(b.name)));setStockName('');setStockQuantity('0');setNotice('Stock item saved.');
  }catch(ex){setError(ex instanceof Error?ex.message:'Stock could not be saved.');}
  finally{setBusy(false);}
 }
 async function adjustStock(item:Stock,next:number){
  if(next<0||busy)return;setBusy(true);setError('');setNotice('');
  try{
   const updated=await authorised<Stock>('/api/merchant/inventory/'+encodeURIComponent(item.id),token,{method:'PATCH',body:JSON.stringify({quantity:next})});
   setStock(old=>old.map(entry=>entry.id===updated.id?updated:entry));
  }catch(ex){setError(ex instanceof Error?ex.message:'Could not update stock.');}
  finally{setBusy(false);}
 }
 return <section style={{display:'grid',gap:20,marginTop:20}}>
  {error&&<div className="lp-alert lp-alert-error" role="alert">{error}</div>}
  {notice&&<div className="lp-alert lp-alert-success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
  <section className="lp-card" style={{padding:24}}>
   <div className="lp-card-head"><div><div className="lp-eyebrow">PRO · PRO PLUS</div><h2>Expense tracking</h2><p>Keep track of what your business spends.</p></div><TrendingUp size={22}/></div>
   <div className="lp-stat-grid">
    <article className="lp-stat"><div className="lp-stat-label">Recorded expenses this month</div><div className="lp-stat-number">{money(monthlyExpenses)}</div></article>
    <article className="lp-stat"><div className="lp-stat-label">All recorded expenses</div><div className="lp-stat-number">{money(expenseTotal)}</div></article>
    <article className="lp-stat"><div className="lp-stat-label">Test sales minus recorded expenses</div><div className="lp-stat-number">{money(verifiedTestSalesCents-expenseTotal)}</div></article>
   </div>
   <p className="lp-field-hint">Illustrative test-sales margin only, not accounting profit. Does not include unrecorded expenses, cash sales, fees or tax. Figures may exclude expenses beyond the 500 most recent records.</p>
   <form onSubmit={addExpense} className="lp-form" style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',margin:'18px 0'}}>
    <label style={{flex:'2 1 180px'}}>Expense name<input required maxLength={120} minLength={2} value={expenseLabel} onChange={e=>setExpenseLabel(e.target.value)} placeholder="e.g. Electricity"/></label>
    <label style={{flex:'1 1 140px'}}>Amount (R)<input required type="number" min="0.01" max="1000000" step="0.01" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)} placeholder="120.00"/></label>
    <button type="submit" className="lp-primary" disabled={busy}><Plus size={17}/> Add expense</button>
   </form>
   <h3>Recent expenses</h3>
   {!loaded?<p>Loading expenses…</p>:expenses.length===0?<p>No expenses recorded yet.</p>:
    <div className="lp-table-wrap"><table className="lp-table"><thead><tr><th>Expense</th><th>Date</th><th>Amount</th></tr></thead><tbody>{expenses.slice(0,12).map(e=><tr key={e.id}><td>{e.label}</td><td>{e.expense_date}</td><td>{money(e.amount_cents)}</td></tr>)}</tbody></table></div>}
  </section>
  {inventory&&<section className="lp-card" style={{padding:24}}>
   <div className="lp-card-head"><div><div className="lp-eyebrow">PRO PLUS</div><h2>Stock monitoring</h2><p>Record your stock and spot low quantities.</p></div><ClipboardList size={22}/></div>
   <form onSubmit={addStock} className="lp-form" style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',margin:'18px 0'}}>
    <label style={{flex:'2 1 200px'}}>Item name<input required minLength={2} maxLength={120} value={stockName} onChange={e=>setStockName(e.target.value)} placeholder="e.g. Bread loaf"/></label>
    <label style={{flex:'1 1 130px'}}>Starting quantity<input required type="number" min="0" max="1000000" step="1" value={stockQuantity} onChange={e=>setStockQuantity(e.target.value)}/></label>
    <button className="lp-primary" type="submit" disabled={busy}><Plus size={17}/> Add stock</button>
   </form>
   {!loaded?<p>Loading inventory…</p>:stock.length===0?<p>Start by adding your first stock item.</p>:
    <div className="lp-table-wrap"><table className="lp-table"><thead><tr><th>Product</th><th>Quantity</th><th>Update quantity</th></tr></thead><tbody>{stock.map(item=><tr key={item.id}><td><strong>{item.name}</strong>{item.quantity<=item.low_stock_threshold&&<small style={{display:'block',color:'#d97706'}}><AlertTriangle size={12}/> Low stock</small>}</td><td>{item.quantity}</td><td><div style={{display:'flex',gap:8}}><button className="lp-secondary" type="button" disabled={busy||item.quantity===0} onClick={()=>adjustStock(item,item.quantity-1)} aria-label={'Reduce '+item.name+' quantity'}>−</button><button type="button" className="lp-secondary" disabled={busy} onClick={()=>adjustStock(item,item.quantity+1)} aria-label={'Increase '+item.name+' quantity'}>+</button></div></td></tr>)}</tbody></table></div>}
   <p className="lp-field-hint"><RefreshCw size={14}/> Stock quantities are managed manually and do not decrease automatically after a payment.</p>
  </section>}
 </section>;
}
