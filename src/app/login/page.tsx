'use client';
import {useState} from 'react';
import Link from 'next/link';
import {createClient} from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const APP_URL='https://digibiashara-tau.vercel.app';
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
   const {error}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:APP_URL+'/reset-password'});
   setMessage(error?'Password setup email could not be sent: '+error.message:'If this email has a DigiBiashara account, a secure password setup link will be sent. Check your inbox and spam folder.');
   setBusy(false);return;
  }
  const {data,error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
  if(error){setMessage(error.message==='Invalid login credentials'?'Invalid email or password. If this is your first login, choose “Set up / reset password” to create your password securely.':error.message);setBusy(false);return}
  const {data:isAdmin,error:adminError}=await supabase.rpc('is_platform_admin');
  if(!adminError&&isAdmin===true){location.href='/admin';return}
  const {data:membership}=await supabase.from('business_memberships').select('business_id').eq('user_id',data.user.id).eq('is_active',true).limit(1).maybeSingle();
  if(membership){location.href='/business';return}
  await supabase.auth.signOut();setMessage('This account has not been assigned to a DigiBiashara workspace. Ask your platform administrator to complete the business setup.');setBusy(false)
 }
 return <main className="wrap"><nav className="nav"><Link className="logo" href="/">DigiBiashara<span className="logo-dot">.</span></Link><Link href="/" className="muted">Back to home</Link></nav><section className="panel form"><div className="eyebrow">SECURE WORKSPACE</div><h1>{mode==='login'?'Welcome back':'Set up your password'}</h1><p className="muted">{mode==='login'?'Sign in to your business workspace. New business owners can create their password using the secure email link.':'Enter the email your platform administrator registered. We’ll send a secure link to create or reset your password.'}</p><form onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/>{mode==='login'&&<><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></>}{message&&<p className="notice" role="alert">{message}</p>}<button className="button" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in securely':'Send password setup link'}</button></form><p className="muted"><button type="button" className="text-button" onClick={()=>{setMode(mode==='login'?'reset':'login');setMessage('')}}>{mode==='login'?'First time here? Set up / reset password':'Back to sign in'}</button></p><p className="muted tiny">For security, password setup requires access to the registered email inbox. Business access also requires an active membership and subscription.</p></section></main>
}