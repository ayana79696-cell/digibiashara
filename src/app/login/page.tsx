'use client';
import {useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

function client(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return null;
 const storage=Capacitor.isNativePlatform()?{
  getItem:async(k:string)=>{const native=await Preferences.get({key:k});if(native.value!==null)return native.value;try{return window.localStorage.getItem(k)}catch{return null}},
  setItem:async(k:string,v:string)=>{await Preferences.set({key:k,value:v});try{window.localStorage.setItem(k,v)}catch{}},
  removeItem:async(k:string)=>{await Preferences.remove({key:k});try{window.localStorage.removeItem(k)}catch{}}
 }:undefined;
 return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,...(storage?{storage}: {})}});
}

export default function Login(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[mode,setMode]=useState<'login'|'reset'>('login');
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage('');
  const supabase=client();if(!supabase){setMessage('Sign-in is not configured. Please contact DigiBiashara support.');setBusy(false);return}
  if(mode==='reset'){
   const {error}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:new URL('/reset-password',window.location.origin).toString()});
   setMessage(error?'Password setup email could not be sent: '+error.message:'If this email has a DigiBiashara account, a secure password setup link will be sent. Check your inbox and spam folder.');
   setBusy(false);return;
  }
  const {data,error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
  if(error){setMessage(error.message==='Invalid login credentials'?'Invalid email or password. If this is your first login, choose “Set up / reset password” to create your password securely.':error.message);setBusy(false);return}
  const {data:isAdmin,error:adminError}=await supabase.rpc('is_platform_admin');
  if(!adminError&&isAdmin===true){location.href='/admin';return}
  await supabase.auth.signOut();
  setMessage('This sign-in is reserved for DigiBiashara platform administrators. Use Owner login or Employee login on the BranchPilot home page for your business workspace.');
  setBusy(false);return
 }
 return <main className="bp-auth-page">
  <section className="bp-auth-card">
   <Link href="/" className="bp-auth-back">← Back to DigiBiashara</Link>
   <div className="bp-auth-brand"><img src="/digibiashara-logo.svg" alt="DigiBiashara"/><span><strong>DigiBiashara</strong><small>PLATFORM ADMINISTRATOR</small></span></div>
   <span className="bp-auth-icon">⌁</span>
   <h1>{mode==='login'?'Platform access.':'Secure password setup.'}</h1>
   <p>{mode==='login'?'This sign-in is reserved for authorised DigiBiashara platform administrators. Business owners and employees should use their dedicated BranchPilot login.':'Enter your registered administrator email. We will send a secure password setup link if the account exists.'}</p>
   <form onSubmit={submit}>
    <label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>
    {mode==='login'&&<><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></>}
    {message&&<p className="bp-auth-message" role="alert">{message}</p>}
    <button className="bp-auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Enter administrator console →':'Send password setup link →'}</button>
   </form>
   <button type="button" className="bp-auth-switch" onClick={()=>{setMode(mode==='login'?'reset':'login');setMessage('')}}>{mode==='login'?'First time here? Set up / reset password':'Back to sign in'}</button>
   <p className="bp-auth-hint">For security, administrator access is checked against the platform administrator role. Business access requires an active membership and subscription.</p>
  </section>
 </main>
}