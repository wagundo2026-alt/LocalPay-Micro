'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Store, WalletCards } from 'lucide-react';
import { getSupabaseBrowser } from '../lib/supabase-browser';

type Mode = 'login' | 'register' | 'forgot';
export default function AuthPanel({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [confirmPassword,setConfirmPassword] = useState('');
  const [name,setName] = useState('');
  const [business,setBusiness] = useState('');
  const [visible,setVisible] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [accepted,setAccepted] = useState(false);
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setNotice('');
    if (isRegister && (!name.trim() || !business.trim())) return setError('Please add your name and business name.');
    if (!isForgot && password.length < 8) return setError('Your password needs at least 8 characters.');
    if (isRegister && password !== confirmPassword) return setError('Your passwords do not match yet.');
    if (isRegister && !accepted) return setError('Please confirm you agree to the terms and privacy notice.');
    setBusy(true);
    try {
      const supabase = getSupabaseBrowser();
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/auth/callback?next=/auth/update-password' });
        if (error) throw error;
        setNotice('If this email is registered, a password reset link will arrive shortly. Please check your inbox and spam folder.');
      } else if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            emailRedirectTo: window.location.origin + '/auth/callback?next=/dashboard',
            data: { full_name: name.trim(), business_name: business.trim() }
          }
        });
        if (error) throw error;
        if (data.session) { router.replace('/dashboard'); router.refresh(); }
        else setNotice('You’re almost there! Please check your email to confirm your account, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace('/dashboard'); router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  return <main className="auth-shell">
    <aside className="auth-story">
      <div className="auth-story-content">
        <div className="auth-eyebrow"><span className="auth-dot"/> MADE FOR LOCAL BUSINESS</div>
        <h2>Your business has<br/>big potential.<br/><em>Let’s grow it.</em></h2>
        <p>No card machine needed. Keep payments simple, see what you've earned, and focus on serving your customers.</p>
        <div className="auth-mini-card">
          <div className="auth-mini-icon"><WalletCards size={22}/></div>
          <div><strong>Built around your hustle</strong><span>From a spaza shop to a growing salon.</span></div>
        </div>
        <div className="auth-mini-card">
          <div className="auth-mini-icon"><ShieldCheck size={22}/></div>
          <div><strong>Confidence with every sale</strong><span>Know when a payment is actually verified.</span></div>
        </div>
      </div>
      <div className="auth-story-bottom">LOCALPAY MICRO <span>•</span> SOUTH AFRICA</div>
    </aside>
    <section className="auth-form-side">
      <div className="auth-form-wrap">
        <Link href="/" className="auth-back">← Back to home</Link>
        <div className="auth-form-head">
          <div className="auth-form-mark"><Store size={25}/></div>
          <div className="auth-kicker">{isRegister?'YOUR NEXT CHAPTER':isForgot?'ACCOUNT RECOVERY':'WELCOME BACK'}</div>
          <h1>{isRegister?'Let’s get your business started.':isForgot?'Forgot your password?':'Good to have you back.'}</h1>
          <p>{isRegister?'A few details, and you’re on your way to simpler payments.':isForgot?'No stress. We’ll send you a link to set a new password.':'Ready to get back to business? Sign in below.'}</p>
        </div>
        {notice && <div className="auth-message success" role="status"><CheckCircle2 size={19}/><span>{notice}</span></div>}
        {error && <div className="auth-message error" role="alert">{error}</div>}
        <form onSubmit={submit} className="auth-form">
          {isRegister && <>
            <label htmlFor="full-name">Your full name</label>
            <input id="full-name" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required maxLength={100} placeholder="e.g. Ronewa Munyai"/>
            <label htmlFor="business-name">Business name</label>
            <input id="business-name" value={business} onChange={e=>setBusiness(e.target.value)} required maxLength={100} placeholder="e.g. Ronewa’s Hair Studio"/>
          </>}
          <label htmlFor="email">Email address</label>
          <div className="auth-field-icon"><Mail size={18}/><input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
          {!isForgot && <>
            <div className="auth-label-line"><label htmlFor="password">Password</label>{mode==='login'&&<Link href="/forgot-password">Forgot password?</Link>}</div>
            <div className="auth-field-icon"><LockKeyhole size={18}/><input id="password" type={visible?'text':'password'} autoComplete={isRegister?'new-password':'current-password'} minLength={8} placeholder="At least 8 characters" value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" className="auth-toggle" onClick={()=>setVisible(!visible)} aria-label={visible?'Hide password':'Show password'}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
            {isRegister && <><label htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type={visible?'text':'password'} autoComplete="new-password" placeholder="Enter your password again" minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/></>}
          </>}
          {isRegister && <label className="auth-check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} required/><span>I agree to LocalPay’s <Link href="/terms">terms of use</Link> and <Link href="/privacy">privacy notice</Link>. <small>Test account — no real payments or subscription charges yet.</small></span></label>}
          <button type="submit" className="auth-submit" disabled={busy}>{busy?<><LoaderCircle size={18} className="auth-spin"/> Please wait...</>:<>{isRegister?'Create my test account':isForgot?'Send reset link':'Sign in to my account'}<ArrowRight size={19}/></>}</button>
        </form>
        <div className="auth-footline">{isRegister?<>Already have an account? <Link href="/login">Sign in</Link></>:isForgot?<>Remembered your password? <Link href="/login">Back to sign in</Link></>:<>New to LocalPay? <Link href="/register">Create a free account</Link></>}</div>
        <p className="auth-safe"><ShieldCheck size={15}/> Secure authentication by Supabase. This is a test-mode service.</p>
      </div>
    </section>
  </main>;
}
