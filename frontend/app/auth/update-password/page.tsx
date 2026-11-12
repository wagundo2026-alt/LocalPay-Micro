'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CheckCircle2, LockKeyhole } from 'lucide-react';
import { getSupabaseBrowser } from '../../../lib/supabase-browser';

export default function UpdatePasswordPage() {
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [busy,setBusy]=useState(false);
 async function update(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');setSuccess('');
  if(password.length<8) return setError('Choose at least 8 characters.');
  if(password!==confirm)return setError('The passwords do not match.');
  setBusy(true);
  try {
   const supabase=getSupabaseBrowser();
   const {data:{user},error:userError}=await supabase.auth.getUser();
   if(userError || !user) throw new Error('Your recovery link is invalid or has expired. Please request another link.');
   const {error}=await supabase.auth.updateUser({password});
   if(error)throw error;
   setSuccess('Your password is updated. You can now sign in.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to update your password.');}finally{setBusy(false);}
 }
 return <main className="auth-form-side" style={{minHeight:'75vh'}}><div className="auth-form-wrap">
 <div className="auth-form-mark"><LockKeyhole/></div><div className="auth-kicker">ACCOUNT RECOVERY</div><h1 style={{fontSize:34,fontWeight:800,marginBottom:10}}>Choose a new password</h1><p style={{color:'#607783',marginBottom:25}}>Use at least 8 characters to protect your business account.</p>
 {error&&<p className="auth-message error" role="alert">{error}</p>}
 {success&&<div className="auth-message success" role="status"><CheckCircle2 size={20}/>{success}</div>}
 {!success&&<form className="auth-form" onSubmit={update}>
 <label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/>
 <label htmlFor="confirm-new-password">Confirm new password</label><input id="confirm-new-password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)}/>
 <button className="auth-submit" type="submit" disabled={busy}>{busy?'Updating…':'Save new password'}</button>
 </form>}
 <div className="auth-footline"><Link href="/login">Back to login</Link></div>
 </div></main>
}
