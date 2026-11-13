import Link from 'next/link';
import { ArrowRight, Check, Clock3, ShieldCheck } from 'lucide-react';

const plans = [
 {name:'Starter',price:'R0',limit:'200',audience:'Start accepting digital payments for free',features:['No monthly fee for small businesses','Payment links and QR codes','Basic payment confirmation','Limited transaction history'],planned:['Sales reports and analytics are not included'],featured:true},
 {name:'Basic',price:'R49',limit:'500',audience:'Track your sales as your business grows',features:['Everything in Starter','Full transaction history','Daily and weekly sales summaries','Downloadable basic sales report'],planned:[]},
 {name:'Pro',price:'R99',limit:'1,000',audience:'Understand your business performance',features:['Everything in Basic','Sales trends and performance charts','Downloadable transaction reports'],planned:['Expense tracking and profit estimates','Advanced reports']},
 {name:'Pro Plus',price:'R199',limit:'5,000',audience:'For higher-volume shops and restaurants',features:['Everything in Pro','More monthly checkout capacity'],planned:['Inventory and stock monitoring','Multiple staff accounts','Detailed financial summaries','Priority support']}
];
export default function Pricing(){
 return <main className="lp-pricing-page">
  <section className="lp-pricing-hero">
   <div className="lp-eyebrow">LOW-COST DIGITAL PAYMENTS FOR MICRO-BUSINESSES</div>
   <h1>Start free. <span>Grow with better tools.</span></h1>
   <p>Starter handles payments for free. Basic helps track sales. Pro adds trends. Pro Plus is designed for higher-volume merchants. Paid upgrades are proposed.</p>
  </section>
  <div className="lp-pricing-grid lp-tier-grid">
   {plans.map(p=><article key={p.name} className={'lp-card lp-pricing-card '+(p.featured?'lp-pricing-featured':'')}>
    <span className="lp-chip">{p.name==='Starter'?'FREE STARTER · TEST MODE':'OPTIONAL PREMIUM · PROPOSED'}</span>
    <h2>{p.name}</h2><p>{p.audience}</p>
    <div className="lp-pricing-cost">{p.price}<span>/month</span></div>
    <div className="lp-tier-limit"><strong>{p.limit}</strong><span>Checkout attempts / month · test mode</span></div>
    <Link className={'lp-primary lp-full '+(!p.featured?'lp-pricing-alt':'')} href="/register">{p.name==='Starter'?'Start with R0 Starter':'Create a free test account'} <ArrowRight size={17}/></Link>
    <div className="lp-pricing-list">{p.features.map(feature=><div key={feature}><Check size={17}/>{feature}</div>)}{p.planned.map(feature=><div key={feature} style={{color:"#64748b"}}><Clock3 size={17}/>{feature} <small>(planned)</small></div>)}</div>
   </article>)}
  </div>
  <section className="lp-pricing-faq" aria-labelledby="processing-title">
   <div className="lp-eyebrow">TRANSPARENT PAYMENT COSTS</div>
   <h2 id="processing-title">Subscription and payment-processing costs are different.</h2>
   <p>Starter has no compulsory monthly subscription. Payment providers charge a separate fee when an actual payment is processed. We aim to prioritise lower-cost bank/EFT options where available, subject to provider and merchant eligibility.</p>
   <p>Our proposed introductory promotion would let eligible merchants pay 1% for successful payments during their first three months, with LocalPay covering the difference <strong>only within a disclosed monthly subsidy cap</strong>. The proposed cap is R30 per merchant per month. Once the cap is used or the promotion ends, the provider’s disclosed standard charges apply. The promotion is not active and cannot yet be applied to real payments.</p>
   <div className="lp-table-wrap">
    <table className="lp-table"><thead><tr><th>R20 EFT example</th><th>Amount</th></tr></thead>
     <tbody>
      <tr><td>Merchant fee during proposed 1% promotion</td><td>R0.20</td></tr>
      <tr><td>Standard Paystack EFT processing cost (2% before VAT)</td><td>R0.40</td></tr>
      <tr><td>Proposed LocalPay subsidy (before VAT)</td><td>R0.20</td></tr>
     </tbody>
    </table>
   </div>
   <p className="lp-field-hint">This is an illustration, not a live fee deduction. Provider fees may attract 15% VAT, so the actual subsidy including VAT could be higher. Never infer a completed payment from a screenshot.</p>
   <p className="lp-field-hint">Illustrative published Paystack South Africa prices are 2% for supported EFT and 2.9% + R1 for local cards, excluding VAT. Actual method availability and charges depend on provider terms. No live merchant settlement or subsidy reimbursement is enabled.</p>
  </section>
  <div className="lp-pricing-note"><ShieldCheck size={20}/><p><strong>Paystack TEST mode:</strong> No real money moves. New merchants receive the Starter sandbox tier with a limit of 200 initiated checkouts per month. Starter includes only essential payment records; downloadable reports require an activated Basic plan or higher. Advanced expense, inventory and staff tools are not yet implemented. Paid subscriptions are proposed; no money is collected for upgrades. Upgrade requests must be approved and activated by an authorised operator. QR/link generation does not use checkout attempts. No 1% promotional subsidy is operational.</p></div>
  <section className="lp-pricing-faq"><div className="lp-eyebrow">MADE FOR LOCAL TRADE</div><h2>Frequently asked questions</h2>
   <article><strong>Can I use LocalPay without paying R49 every month?</strong><p>Yes. The Starter tier has a R0 monthly subscription for QR and payment-link tools. Live processing still requires an approved payment provider, which may charge transaction fees.</p></article>
   <article><strong>Can I upgrade later?</strong><p>Yes. You can request a paid plan from the dashboard. Upgrades currently do not collect a subscription fee or automatically change your entitlement.</p></article>
   <article><strong>Do you currently charge merchants just 1%?</strong><p>No. The introductory 1% offer is a proposed, capped subsidy for a future provider-approved live pilot. LocalPay currently operates in test mode only.</p></article>
  </section>
 </main>;
}
