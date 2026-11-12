'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * LocalPay interface localization: deterministic translation dictionaries.
 * Financial values, transaction references and server-side statuses MUST
 * remain server-authored and are never passed through generative AI.
 * Tshivenda copy is a draft pending review by a native-language specialist
 * before production use, especially for payment consent and safety notices.
 */
export type Locale = 'en' | 've';
type Messages = Record<string, string>;

const en: Messages = {
 'language':'Language',
 'nav.how':'How it works','nav.features':'Features','nav.pricing':'Subscription','nav.login':'Log in','nav.start':'Start for free',
 'common.back':'Back to LocalPay','common.wait':'Please wait...','common.name':'Your name','common.email':'Email address','common.password':'Password',
 'common.save':'Save','common.cancel':'Cancel','common.success':'Successful','common.pending':'Pending','common.failed':'Failed','common.amount':'Amount (ZAR)','common.test':'PAYSTACK TEST MODE',
 'checkout.loading':'Getting this payment ready...',
 'checkout.unavailable':'We couldn’t open that payment link.',
 'checkout.expired':'This payment request has expired or already been used. Ask the merchant for a new link.',
 'checkout.from':'PAYMENT REQUEST FROM',
 'checkout.merchantReference':'LocalPay merchant reference',
 'checkout.merchantNotice':'These business details were provided during merchant onboarding. They have not been independently verified. Confirm the business and amount before paying.',
 'checkout.amount':'Amount to pay (ZAR)',
 'checkout.description':'Payment request',
 'checkout.expires':'One-time payment request · Expires',
 'checkout.payerName':'Your name (shown to the merchant)',
 'checkout.namePlaceholder':'Your full name',
 'checkout.payerEmail':'Your email (shown to the merchant)',
 'checkout.payerNotice':'Your name and email help the merchant recognise this payment. They are self-reported, not identity verification. The merchant can view them.',
 'checkout.opening':'Opening Paystack...',
 'checkout.continue':'Continue to secure test checkout',
 'checkout.hosted':'Checkout is hosted by Paystack. LocalPay does not collect your card number or CVV.',
 'checkout.testNotice':'This checkout is for testing. No real money will be charged.',
 'checkout.error':'Checkout is not available.',
 'checkout.invalidUrl':'No trusted Paystack checkout URL was returned.',
 'auth.back':'Back to home','auth.headline':'Your business has big potential.','auth.slogan':'Let’s grow it.',
 'auth.story':'No card machine required for payment links. Keep payments simple and review verified test sales.',
 'auth.welcome':'Welcome back','auth.loginTitle':'Good to have you back.','auth.loginDesc':'Sign in to manage your business.',
 'auth.registerTitle':'Let’s get your business started.','auth.registerDesc':'Create an account for your small business.',
 'auth.forgotTitle':'Forgot your password?','auth.forgotDesc':'We will email a password-reset link.',
 'auth.fullName':'Your full name','auth.businessName':'Business name','auth.forgot':'Forgot password?',
 'auth.passwordHint':'At least 8 characters','auth.confirmPassword':'Confirm password',
 'auth.agree':'I agree to the terms of use and privacy notice.',
 'auth.create':'Create my test account','auth.sendReset':'Send reset link','auth.signIn':'Sign in to my account',
 'auth.haveAccount':'Already have an account?','auth.signInShort':'Sign in','auth.newUser':'New to LocalPay?',
 'auth.createAccount':'Create a free account',
 'dashboard.overview':'Overview','dashboard.payments':'Payment links','dashboard.qr':'My QR codes',
 'dashboard.transactions':'Transactions','dashboard.analytics':'Sales insights',
 'dashboard.plan':'My plan','dashboard.settings':'Business settings',
 'dashboard.welcome':'Welcome back','dashboard.paymentsTitle':'Payment links',
 'dashboard.qrTitle':'Your payment QR codes','dashboard.transactionsTitle':'Your transactions',
 'dashboard.analyticsTitle':'Sales insights','dashboard.planTitle':'Plans that fit your business',
 'dashboard.settingsTitle':'Business settings','dashboard.createLink':'Create payment link',
 'dashboard.newPayment':'Create a new payment request','dashboard.description':'What is this payment for?',
 'dashboard.linkNote':'Each payment link is unique, works for one checkout attempt and expires after 24 hours.',
 'dashboard.paymentHistory':'Payment history','dashboard.payer':'Payer (self-reported)',
 'dashboard.status':'Status','dashboard.reference':'Payment reference','dashboard.date':'Date',
 'dashboard.noPayer':'Not provided','dashboard.disable':'Disable',
 'dashboard.copy':'Copy','dashboard.download':'Download','dashboard.logout':'Log out',
 'dashboard.refresh':'Refresh','dashboard.test':'These are test transactions, not real settlements.',
 'onboard.heading':'Tell us about your business',
 'onboard.description':'Tell us about your shop so we can set up your merchant dashboard.',
 'onboard.setup':'Set up your local business','onboard.business':'What is your business called?',
 'onboard.category':'Business type','onboard.province':'Province','onboard.town':'Your town or area',
 'onboard.open':'Open my dashboard','onboard.opening':'Setting things up...',
 'onboard.almost':'ALMOST THERE','onboard.test':'Basic from R49/month · test mode (no subscription charges)',
 'onboard.proof':'No card machine required for payment links',
 'onboard.error':'Could not finish setup.',
 'language.review':'Tshivenda wording is being reviewed. Confirm all payment details before continuing.'
};

const ve: Messages = {
 'language':'Luambo',
 'nav.how':'Zwi shuma hani','nav.features':'Zwine ra zwi ita','nav.pricing':'Mbekanyamushumo','nav.login':'Dzhena','nav.start':'Thomani mahala',
 'common.back':'Humelani kha LocalPay','common.wait':'Kha vha lindele...','common.name':'Dzina lavho','common.email':'Adiresi ya imeili','common.password':'Phasiwede',
 'common.save':'Vhulungani','common.cancel':'Litshani','common.success':'Zwo bvelela','common.pending':'Zwo lindelwa','common.failed':'A zwo ngo bvelela','common.amount':'Mutengo (ZAR)','common.test':'MULINGO WA PAYSTACK',
 'checkout.loading':'Ri khou lugisela mbadelo yavho...',
 'checkout.unavailable':'A ri koni u vula linki iyi ya mbadelo.',
 'checkout.expired':'Linki iyi ya mbadelo yo fhela kana yo no shumiswa. Kha vha humbele linki ntswa.',
 'checkout.from':'VHA KHOU BADALA KHA',
 'checkout.merchantReference':'Nomboro ya murengisi ya LocalPay',
 'checkout.merchantNotice':'Mafhungo aya a bindu o ṋekedzwa musi hu tshi itwa nḓwaliso. Ha athu u khwaṱhisedzwa nga nnḓa. Kha vha sedze dzina ḽa bindu na mutengo musi vha sa athu u badala.',
 'checkout.amount':'Mutengo une wa ḓo badelwa (ZAR)',
 'checkout.description':'Khumbelo ya mbadelo',
 'checkout.expires':'Linki ya mbadelo ya luthihi · I fhela nga',
 'checkout.payerName':'Dzina ḽavho (ḽi ḓo vhonwa nga murengisi)',
 'checkout.namePlaceholder':'Dzina ḽavho ḽo fhelelaho',
 'checkout.payerEmail':'Imeili yavho (i ḓo vhonwa nga murengisi)',
 'checkout.payerNotice':'Dzina na imeili yavho zwi thusa murengisi u ḓivha mbadelo. A zwi khwaṱhisedzi uri vha nnyi. Murengisi u ḓo zwi vhona.',
 'checkout.opening':'Ri khou vula Paystack...',
 'checkout.continue':'Bvelani phanḓa kha mbadelo ya mulingo yo tsireledzeaho',
 'checkout.hosted':'Mbadelo i itwa kha Paystack. LocalPay a i kuvhanganyi nomboro ya garata kana CVV yavho.',
 'checkout.testNotice':'Uyu ndi mulingo fhedzi. A hu na tshelede ya vhukuma ine ya ḓo bviswa.',
 'checkout.error':'Mbadelo a i khou shuma zwino.',
 'checkout.invalidUrl':'Adiresi ya Paystack a yo ngo khwaṱhisedzwa.',
 'auth.back':'Humelani hayani','auth.headline':'Bindu ḽavho ḽi na tshikhala tshihulu.','auth.slogan':'Kha ri ḽi aluse.',
 'auth.story':'A hu ṱoḓei mutshini wa garata kha linki dza mbadelo. Sedzani mbadelo dza mulingo dzo khwaṱhisedzwaho.',
 'auth.welcome':'Vho dovha vha vhuya','auth.loginTitle':'Ri a vha ṱanganedza.','auth.loginDesc':'Dzhena u langa bindu ḽavho.',
 'auth.registerTitle':'Kha ri thome bindu ḽavho.','auth.registerDesc':'Vhulani akhaunthu ya bindu ḽavho.',
 'auth.forgotTitle':'Vho hangwa phasiwede?','auth.forgotDesc':'Ri ḓo rumela linki ya u shandukisa phasiwede nga imeili.',
 'auth.fullName':'Dzina ḽavho ḽo fhelelaho','auth.businessName':'Dzina ḽa bindu','auth.forgot':'Vho hangwa phasiwede?',
 'auth.passwordHint':'Maḽeḓere a si fhasi ha 8','auth.confirmPassword':'Khwaṱhisedzani phasiwede',
 'auth.agree':'Ndi tendelana na milayo ya tshumiso na ndaulo ya mafhungo a phuraivethe.',
 'auth.create':'Vhulani akhaunthu ya mulingo','auth.sendReset':'Rumelani linki ya phasiwede','auth.signIn':'Dzhena kha akhaunthu yanga',
 'auth.haveAccount':'Vha na akhaunthu?','auth.signInShort':'Dzhena','auth.newUser':'Vha kha ḓi vha vhaswa kha LocalPay?',
 'auth.createAccount':'Vhulani akhaunthu ya mahala',
 'dashboard.overview':'Mbonalo ya bindu','dashboard.payments':'Linki dza mbadelo','dashboard.qr':'Khodi dzanga dza QR',
 'dashboard.transactions':'Mbadelo','dashboard.analytics':'Mafhungo a thengiso',
 'dashboard.plan':'Mbekanyamushumo yanga','dashboard.settings':'Nzudzanyo dza bindu',
 'dashboard.welcome':'Ri a vha ṱanganedza','dashboard.paymentsTitle':'Linki dza mbadelo',
 'dashboard.qrTitle':'Khodi dza QR dza mbadelo','dashboard.transactionsTitle':'Mbadelo dzavho',
 'dashboard.analyticsTitle':'Mafhungo a thengiso','dashboard.planTitle':'Mbekanyamushumo dza bindu',
 'dashboard.settingsTitle':'Nzudzanyo dza bindu','dashboard.createLink':'Itani linki ya mbadelo',
 'dashboard.newPayment':'Itani khumbelo ntswa ya mbadelo','dashboard.description':'Mbadelo iyi ndi ya mini?',
 'dashboard.linkNote':'Linki inwe na inwe yo khethea, i shumiswa luthihi, nahone i fhela nga awara dza 24.',
 'dashboard.paymentHistory':'Divhazwakale ya mbadelo','dashboard.payer':'Mubadeli (o ḓiṋekedza mafhungo)',
 'dashboard.status':'Tshiimo','dashboard.reference':'Nomboro ya mbadelo','dashboard.date':'Ḓuvha',
 'dashboard.noPayer':'A zwo ngo ṋekedzwa','dashboard.disable':'Imisani','dashboard.copy':'Kopani',
 'dashboard.download':'Dzhiani','dashboard.logout':'Bvani','dashboard.refresh':'Dovhololani',
 'dashboard.test':'Idzi ndi mbadelo dza mulingo, a si dza tshelede ya vhukuma.',
 'onboard.heading':'Kha vha ri vhudze nga bindu ḽavho',
 'onboard.description':'Kha vha ri vhudze nga ha vhengele ḽavho uri ri lugise mbonalo ya bindu.',
 'onboard.setup':'Lugisani bindu ḽavho','onboard.business':'Dzina ḽa bindu ḽavho ndi ḽifhio?',
 'onboard.category':'Lushaka lwa bindu','onboard.province':'Vundu','onboard.town':'Ḓorobo kana fhethu hune vha vha hone',
 'onboard.open':'Vulani mbonalo ya bindu','onboard.opening':'Ri khou lugisa...',
 'onboard.almost':'VHO NO VHA TSINI','onboard.test':'Basic u bva kha R49 nga nwedzi · mulingo (a hu na mbadelo dza subscription)',
 'onboard.proof':'A hu ṱoḓei mutshini wa garata kha linki dza mbadelo',
 'onboard.error':'A ro ngo kona u fhedza nzudzanyo.',
 'language.review':'Maipfi a Tshivenḓa a kha ḓi sedzuluswa. Kha vha khwaṱhisedze mafhungo a mbadelo.'
};

const messages: Record<Locale,Messages> = { en, ve };
type LanguageContextValue={locale:Locale;setLocale:(locale:Locale)=>void;t:(key:string)=>string};
const LanguageContext=createContext<LanguageContextValue>({locale:'en',setLocale:()=>{},t:(key)=>en[key]||key});

export function LanguageProvider({children}:{children:ReactNode}){
 const [locale,setLocale]=useState<Locale>('en');
 useEffect(()=>{
  try {
   const saved=window.localStorage.getItem('localpay-language');
   if(saved==='en'||saved==='ve')setLocale(saved);
  }catch { /* storage may be blocked */ }
 },[]);
 useEffect(()=>{
  document.documentElement.lang=locale;
  try { window.localStorage.setItem('localpay-language',locale); }catch { /* private mode */ }
 },[locale]);
 const value=useMemo(()=>({locale,setLocale,t:(key:string)=>messages[locale][key]||en[key]||key}),[locale]);
 return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){return useContext(LanguageContext);}
