import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck, Store, UtensilsCrossed, ShoppingBasket, QrCode, ReceiptText } from 'lucide-react';
const features=[
 'Create payment links for any sale',
 'Display QR codes at your counter or stall',
 'Check verified test transactions',
 'See daily sales and payment history',
 'Download transaction reports',
 'Manage your shop from a phone'
];
export default function Pricing(){
 return <main className="lp-pricing-page">
  <section className="lp-pricing-hero">
   <div className="lp-eyebrow">ONE SIMPLE SUBSCRIPTION · BUILT FOR LOCAL BUSINESS</div>
   <h1>Affordable payment tools for <span>your everyday hustle.</span></h1>
   <p>Whether you run a spaza shop, sell meals at a food stall, manage a small restaurant or own a local food shop, LocalPay keeps payments simple.</p>
  </section>
  <div className="lp-pricing-grid lp-subscription-grid">
   <article className="lp-card lp-pricing-card lp-pricing-featured">
    <span className="lp-chip">PROPOSED MONTHLY SUBSCRIPTION</span>
    <h2>LocalPay Subscription</h2>
    <p>Everything a small local business needs, in one easy-to-understand package.</p>
    <div className="lp-pricing-cost">R49<span>/month · proposed</span></div>
    <p>Built for traders who need to keep costs predictable. Provider transaction fees are additional and will be disclosed before any live launch.</p>
    <Link href="/register" className="lp-primary lp-full">Create your test account <ArrowRight size={18}/></Link>
    <div className="lp-pricing-list">{features.map(feature=><div key={feature}><Check size={17}/>{feature}</div>)}</div>
   </article>
   <aside className="lp-card lp-subscription-story">
    <span className="lp-eyebrow">MADE FOR THE BUSINESSES AROUND US</span>
    <h2>One subscription. Many ways to earn.</h2>
    <div className="lp-subscription-type"><Store size={20}/><div><strong>Spaza shops</strong><span>Let customers scan a QR code at the till.</span></div></div>
    <div className="lp-subscription-type"><UtensilsCrossed size={20}/><div><strong>Small restaurants & takeaways</strong><span>Share payment links for meals and orders.</span></div></div>
    <div className="lp-subscription-type"><ShoppingBasket size={20}/><div><strong>Local food shops & informal traders</strong><span>Keep payment records without complicated systems.</span></div></div>
    <div className="lp-subscription-type"><ReceiptText size={20}/><div><strong>Market stalls & street-food sellers</strong><span>Show a QR code from a phone or printed sign.</span></div></div>
   </aside>
  </div>
  <div className="lp-pricing-note"><ShieldCheck size={20}/><p><strong>Hackathon test mode:</strong> The R49/month subscription is a proposed business model, not a charge being collected today. Subscription billing and live card payments are not enabled. Creating a test account does not start a paid subscription.</p></div>
  <section className="lp-pricing-faq"><div className="lp-eyebrow">STRAIGHT ANSWERS</div><h2>Questions from local traders</h2>
   <article><strong>Will I be charged R49 when I sign up?</strong><p>No. This is a sandbox prototype. R49/month is the proposed price for a future live subscription, not an active charge.</p></article>
   <article><strong>Do I need a card machine?</strong><p>No. LocalPay demonstrates QR and payment-link checkouts that can be shared or displayed using a phone.</p></article>
   <article><strong>Are payment-provider fees included?</strong><p>No. Any future live provider processing fees would be additional and shown clearly before launch.</p></article>
  </section>
 </main>;
}
