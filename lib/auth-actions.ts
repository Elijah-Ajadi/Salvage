import type {SupabaseClient} from '@supabase/supabase-js';
export async function handleAuth(body:any,client:SupabaseClient,origin:string){
 const {action,email,password,role}=body;
 const reply=(data:object,status=200)=>Response.json(data,{status});
 const validEmail=(value:unknown):value is string=>typeof value==='string'&&/^\S+@\S+\.\S+$/.test(value);
 if(action==='logout'){
  const {error}=await client.auth.signOut({scope:'local'});
  return error?reply({error:'Could not sign out. Please try again.'},503):reply({redirect:'/login'});
 }
 if(action==='resend-verification'){
  const {data:{user}}=await client.auth.getUser();
  const target=user?.email||email;
  if(!validEmail(target))return reply({error:'Enter your email address.'},400);
  const {error}=await client.auth.resend({type:'signup',email:target,options:{emailRedirectTo:`${origin}/auth/callback`}});
  if(error)return reply({error:'Could not resend right now. Please wait a minute and try again.'},429);
  return reply({message:'If your account needs confirmation, a link is on its way. Check your inbox and spam folder.'});
 }
 if(action==='reset'){
  if(!validEmail(email))return reply({error:'Enter your email address.'},400);
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:`${origin}/auth/callback?next=/reset-password?update=1`});
  if(error)return reply({error:'Could not send a reset link right now. Please try again later.'},429);
  return reply({message:'If that email has an account, a reset link is on its way.'});
 }
 if(!['signup','login','update-password'].includes(action))return reply({error:'Unknown action.'},400);
 if(typeof password!=='string'||password.length<8)return reply({error:'Use a password with at least 8 characters.'},400);
 if(action==='update-password'){
  const {data:{user}}=await client.auth.getUser();
  if(!user)return reply({error:'Open the password reset link from your email first.'},401);
  const {error}=await client.auth.updateUser({password});
  return error?reply({error:error.message},400):reply({redirect:'/dashboard'});
 }
 if(!validEmail(email))return reply({error:'Enter a valid email address.'},400);
 if(action==='signup'){
  if(!['buyer','contractor'].includes(role))return reply({error:'Choose your account role.'},400);
  const {data,error}=await client.auth.signUp({email,password,options:{data:{role},emailRedirectTo:`${origin}/auth/callback`}});
  if(error)return reply({error:error.message},error.status===429?429:400);
  if(data.session)return reply({redirect:'/signup'});
  return reply({verificationRequired:true,message:'Check your email to confirm your account. Open the confirmation link, then complete your profile.'});
 }
 const {error}=await client.auth.signInWithPassword({email,password});
 if(error)return reply({error:error.code==='email_not_confirmed'?'Confirm your email before logging in. You can resend the link below.':'Could not sign in. Check your email and password.',verificationRequired:error.code==='email_not_confirmed'},401);
 return reply({redirect:'/dashboard'});
}
