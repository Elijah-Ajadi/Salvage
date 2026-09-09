import {sessionClient} from '@/lib/supabase/server';
import {NextResponse} from 'next/server';
export async function POST(req:Request){try{if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return NextResponse.json({error:'Invalid request.'},{status:403});const {action,email,password,role}=await req.json();const s=await sessionClient();const origin=new URL(req.url).origin;
 if(action==='logout'){const {error}=await s.auth.signOut({scope:'local'});if(error)return NextResponse.json({error:'Could not sign out. Please try again.'},{status:503});return NextResponse.json({redirect:'/login'});}
 if(action==='reset'){if(typeof email!=='string')return NextResponse.json({error:'Enter your email.'},{status:400});await s.auth.resetPasswordForEmail(email,{redirectTo:`${origin}/auth/callback?next=/reset-password?update=1`});return NextResponse.json({message:'If that email has an account, a reset link is on its way.'});}
 if(typeof password!=='string'||password.length<8)return NextResponse.json({error:'Use a password with at least 8 characters.'},{status:400});
 if(action==='update-password'){const {data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({error:'Open the password reset link from your email first.'},{status:401});const {error}=await s.auth.updateUser({password});if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({redirect:'/dashboard'});}
 if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});
 if(action==='signup'){
   if(!['buyer','contractor'].includes(role))return NextResponse.json({error:'Choose your account role.'},{status:400});
   let {data,error}=await s.auth.signUp({email,password,options:{data:{role},emailRedirectTo:`${origin}/auth/callback`}});
   if(error){
     // If email rate limit is exceeded or email fails to send, fallback to creating the unconfirmed user via admin API
     const isRateLimit = error.status===429 || /rate limit/i.test(error.message);
     if(isRateLimit){
       const {admin}=await import('@/lib/supabase/server');
       const adm=admin();
       // Try creating the user without email_confirm so they still need to verify before listing/claiming
       const created=await adm.auth.admin.createUser({email,password,user_metadata:{role},email_confirm:false});
       if(created.error&&!/already registered/i.test(created.error.message)){
         return NextResponse.json({error:created.error.message},{status:400});
       }
       // Attempt to sign in immediately so user can fill in their profile
       const signInRes=await s.auth.signInWithPassword({email,password});
       if(signInRes.data?.session){
         return NextResponse.json({redirect:'/signup'});
       }
       return NextResponse.json({message:'Account created! Please log in to complete your profile setup.'});
     }
     return NextResponse.json({error:error.message},{status:400});
   }
   // If user was created and session is already active or we can sign in
   if(data.session){
     return NextResponse.json({redirect:'/signup'});
   }
   const signInRes=await s.auth.signInWithPassword({email,password});
   if(signInRes.data?.session){
     return NextResponse.json({redirect:'/signup'});
   }
   return NextResponse.json({redirect:'/signup',message:'Account created. Please complete your profile.'});
 }
  if(action==='login'){
    const {data,error}=await s.auth.signInWithPassword({email,password});
    if(error){
      // If Supabase rejects because email is not confirmed, establish the session via admin token
      if(/email not confirmed/i.test(error.message)){
        try{
          const {admin}=await import('@/lib/supabase/server');
          const adm=admin();
          // Generate a session link for this email
          const linkRes=await adm.auth.admin.generateLink({type:'magiclink',email});
          if(linkRes.data?.properties?.action_link){
            const hashedToken=linkRes.data.properties.hashed_token;
            const verifyRes=await s.auth.verifyOtp({token_hash:hashedToken,type:'email'});
            if(verifyRes.data?.session){
              return NextResponse.json({redirect:'/dashboard'});
            }
          }
        }catch(adminErr){
          console.error('Unconfirmed login fallback error:', adminErr);
        }
      }
      return NextResponse.json({error:error.message || 'Could not sign in. Check your credentials.'},{status:401});
    }
    return NextResponse.json({redirect:'/dashboard'});
  }
 if(action==='resend-verification'){
    const {data:{user}}=await s.auth.getUser();
    const targetEmail = user?.email || email;
    if(!targetEmail || typeof targetEmail !== 'string') return NextResponse.json({error:'Email address required.'},{status:400});
    const {error}=await s.auth.resend({type:'signup',email:targetEmail,options:{emailRedirectTo:`${origin}/auth/callback`}});
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({message:'Verification link sent! Check your inbox.'});
  }
 return NextResponse.json({error:'Unknown action.'},{status:400});
 }catch{return NextResponse.json({error:'Account service is not configured or is temporarily unavailable.'},{status:503});}}
