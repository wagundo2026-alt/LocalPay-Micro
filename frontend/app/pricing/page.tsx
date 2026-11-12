import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck, Store, UtensilsCrossed, ShoppingBasket, ReceiptText } from 'lucide-react';

// This is a proposed subsidy policy, NOT an activated settlement arrangement.
// Providers currently deduct their own fees; LocalPay cannot yet reimburse them.
const samples=[
 {sale:'R20',merchant:'R0.20',eft:'R0.26',card:'R1.62'},
 {sale:'R100',merchant:'R1.00',eft:'R1.30',card:'R3.49'},
 {sale:'R500',merchant:'R5.00',eft:'R6.50',card:'R12.83'},
];

const plans=[
 {name:'Basic',price:'R49',limit:'200',audience:'For a small stall or part-time trader',features:['200 checkout attempts per month','QR codes and payment links','Transaction history','Simple sales dashboard']},
 {name:'Pro',price:'R99',limit:'1,000',audience:'For a busy spaza shop or takeaway',features:['1,000 checkout attempts per month','Everything in Basic','Downloadable sales reports','Sales insights'],featured:true},
 {name:'Pro Plus',price:'R199',limit:'5,000',audience:'For a high-volume shop or restaurant',features:['5,000 checkout attempts per month','Everything in Pro','Room for busier daily trading','Priority support (planned)']}
];
export default function Pricing(){
 return <main className="lp-pricing-page">
  <section className="lp-pricing-hero">
   <div className="lp-eyebrow">PREDICTABLE COSTS FOR EVERY KIND OF LOCAL BUSINESS</div>
   <h1>Start small. <span>Upgrade as you grow.</span></h1>
   <p>Built for informal traders, spaza shops, food stores and small restaurants. Pay for the level of monthly checkout capacity that suits your business.</p>
  </section>
  <div className="lp-pricing-grid lp-tier-grid">
   {plans.map(p=><article key={p.name} className={'lp-card lp-pricing-card '+(p.featured?'lp-pricing-featured':'')}>
    <span className="lp-chip">{p.featured?'FOR GROWING BUSINESSES':'PROPOSED SUBSCRIPTION'}</span>
    <h2>{p.name}</h2><p>{p.audience}</p>
    <div className="lp-pricing-cost">{p.price}<span>/month</span></div>
    <div className="lp-tier-limit"><strong>{p.limit}</strong><span>Paystack checkout attempts / month</span></div>
    <Link className={'lp-primary lp-full '+(!p.featured?'lp-pricing-alt':'')} href="/register">{p.name==='Basic'?'Start with Basic':'Create a test account'} <ArrowRight size={17}/></Link>
    <div className="lp-pricing-list">{p.features.map(feature=><div key={feature}><Check size={17}/>{feature}</div>)}</div>
   </article>)}
  </div>
  <section className="lp-pricing-faq" aria-labelledby="subsidy-title">
   <div className="lp-eyebrow">PROPOSED PAYMENT FEE POLICY · NOT LIVE</div>
   <h2 id="subsidy-title">Just 1% for merchants. We plan to cover the rest.</h2>
   <p>Our goal is for merchants to bear only 1% of each successful local transaction. LocalPay would pay the difference between that 1% and the actual payment-provider processing charge. This arrangement requires a funded subsidy reserve, merchant settlement integration, provider approval and operational controls before launch. It is not active in Paystack test mode.</p>
   <div className="lp-table-wrap">
    <table className="lp-table">
     <thead><tr><th>Customer pays</th><th>Merchant's target fee (1%)</th><th>LocalPay subsidy: EFT*</th><th>LocalPay subsidy: local card*</th></tr></thead>
     <tbody>{samples.map(row=><tr key={row.sale}><td>{row.sale}</td><td>{row.merchant}</td><td>{row.eft}</td><td>{row.card}</td></tr>)}</tbody>
    </table>
   </div>
   <p className="lp-field-hint">*Illustrative South African Paystack standard rates: EFT 2%, local cards 2.9% + R1, plus 15% VAT on provider fees, rounded to cents; merchant target fee assumes 1% of sale. Actual subsidy depends on payment method, contract, tax treatment and processing costs. This is not a live or guaranteed merchant charge.</p>
  </section>
  <div className="lp-pricing-note"><ShieldCheck size={20}/><p><strong>Important:</strong> These are proposed software subscription prices. Billing is not live, so new merchants currently use the Basic sandbox limit. Upgrade requests are recorded but do not activate higher limits or charge money. The monthly limits count initiated Paystack checkout sessions (including abandoned or failed attempts), reset at 00:00 UTC on the first day of each month, and are enforced by the backend. Creating payment links and QR codes does not use the transaction quota. Payment-provider fees remain charged by Paystack in the sandbox; the planned 1% merchant cap and LocalPay subsidy are NOT activated and must not be presented as current settlement behavior.</p></div>
  <section className="lp-pricing-faq"><div className="lp-eyebrow">MADE FOR LOCAL TRADE</div><h2>Find the right fit</h2>
   <article><strong>What if I reach my limit?</strong><p>Existing links stay available, but no new checkout session can begin until the next monthly reset or a higher plan is activated. Request an upgrade from your dashboard.</p></article>
   <article><strong>Will clicking upgrade charge my card?</strong><p>No. Billing is not connected yet. The button submits a request for future activation, rather than pretending a payment succeeded.</p></article>
   <article><strong>Will I really pay only 1% today?</strong><p>Not yet. During this hackathon, Paystack test mode applies and no funds settle. We are proposing a future 1% merchant fee with LocalPay subsidising the difference, subject to approved provider settlement mechanics and sufficient funding.</p></article>
  </section>
 </main>;
}
