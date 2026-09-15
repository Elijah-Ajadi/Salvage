'use client';
import PickupUI,{ReserveForm,ReportForm} from '@/app/pickup-ui';
import {hasCoordinates} from '@/lib/location';
import { useEffect, useState, useRef } from 'react';
import { 
  ArrowUpRight, ArrowRight, Plus, Search, MapPin, Bell, Recycle, LayoutGrid, Map, 
  SlidersHorizontal, DoorOpen, Lamp, PanelsTopLeft, Refrigerator, Grid2X2, Shapes, 
  Leaf, Clock, Check, Camera, LocateFixed, Truck, ChevronDown, Package, HeartHandshake, 
  X, DollarSign, Wallet, FileText, ArrowDownToLine, ReceiptText, ExternalLink, Download 
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { categories, distance, type Item } from '@/lib/materials';
import { openReceiptWindow, type ReceiptData } from '@/lib/receipt';

const icons=[LayoutGrid,PanelsTopLeft,Lamp,DoorOpen,Refrigerator,Grid2X2,Shapes];
const initialProfile={name:'',email:'',phone:'',role:'buyer',locatedAddress:'',address:'',lat:NaN,lng:NaN,radius:20,preferences:categories.slice(1),emailVerified:undefined as boolean|undefined};
const blank={visibility_radius:20,functionality:'Untested',evidence_note:'',evidencePhoto:'',locatedAddress:'',title:'',description:'',category:'Other',material:'',condition:'Good',address:'',lat:30.2672,lng:-97.7431,photo:'',price:'' as string|number,suggestedPrice:null as number|null};

export default function Salvage({mode,initialAccount,initialView,receiptId}:{mode:string;initialAccount:any;initialView?:string;receiptId?:string}){
 const [items,setItems]=useState<Item[]>([]);
 const [live,setLive]=useState(false);
 const [profile,setProfile]=useState<typeof initialProfile>({...initialProfile,...initialAccount});
 const [registered,setRegistered]=useState(true);
 const [view,setView]=useState(initialView||(mode==='contractor'?'My listings':'Explore'));
 const [category,setCategory]=useState('All materials');
 const [search,setSearch]=useState('');
 const [sort,setSort]=useState('nearest');
 const [layout,setLayout]=useState('grid');
 const [modal,setModal]=useState('');
 const [selected,setSelected]=useState<Item|null>(null);
 const [draft,setDraft]=useState(blank);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [notes,setNotes]=useState<any[]>([]);
 const [aiNote,setAiNote]=useState('');
 const [aiProgress,setAiProgress]=useState(0);
 const [donation,setDonation]=useState({nonprofit:'',value:''});
 const [checkingPayment,setCheckingPayment]=useState(false);

 // Earnings & Withdrawal state (Contractor)
 const [earnings,setEarnings]=useState<{
   testMode?:boolean;
   totalEarned:number;
   totalWithdrawn:number;
   pendingWithdrawal:number;
   availableBalance:number;
   sales:any[];
   payouts:any[];
 }>({totalEarned:0,totalWithdrawn:0,pendingWithdrawal:0,availableBalance:0,sales:[],payouts:[]});

 const [withdrawalDraft,setWithdrawalDraft]=useState({
   amount:'',
   paymentMethod:'Bank Transfer (ACH)',
   accountDetails:'',
   notes:''
 });

 // Payment & Claim History state (Buyer)
 const [buyerHistory,setBuyerHistory]=useState<any[]>([]);

 const withdrawalKey=useRef<string|null>(null);
 const cameraInput=useRef<HTMLInputElement>(null);
 const galleryInput=useRef<HTMLInputElement>(null);
 const signingOut=useRef(false);
 const profileRef=useRef(profile);profileRef.current=profile;
 const editing=useRef(false);
 editing.current=!!modal;
 const notify=(s:string)=>setMessage(s);

 async function api(action:string,data:any={}){
   const res=await fetch('/api/salvage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})}); 
   const result:any=await res.json(); 
   if(res.status===401)window.location.href='/login';
   if(!res.ok)throw Error(result.error||'Please try again.');
   return result;
 }

 async function fetchEarnings(){
   try{
     const r=await fetch('/api/payments?type=earnings');
     if(r.ok){
       const d=await r.json();
       setEarnings(d);
     }
   }catch{}
 }

 async function fetchBuyerHistory(){
   try{
     const r=await fetch('/api/payments?type=buyer-history');
     if(r.ok){
       const d=await r.json();
       setBuyerHistory(d.history||[]);
     }
   }catch{}
 }

 async function refresh(){
   try{
     if(signingOut.current)return;
     const current=profileRef.current;
     const query=hasCoordinates(current)?`?lat=${current.lat}&lng=${current.lng}`:'';
     const r=await fetch('/api/salvage'+query);
     if(!r.ok)return;
     const d:any=await r.json();
     setLive(true);
     setItems(d.items);
     const requested=new URLSearchParams(window.location.search).get('item');
     if(requested){const item=d.items.find((i:Item)=>i.id===requested);if(item)setSelected(item);window.history.replaceState({},'',window.location.pathname);}
     if(d.profile){
       if(!editing.current)setProfile(d.profile);
       setRegistered(true);
     }
     setNotes(d.notifications||[]);
     if(mode==='contractor')fetchEarnings();
     if(mode==='buyer')fetchBuyerHistory();
   }catch{}
 }

 useEffect(()=>{refresh();const t=setInterval(refresh,15000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(message){const t=setTimeout(()=>setMessage(''),6500);return()=>clearTimeout(t);}},[message]);

 // Handle Stripe success redirect
 useEffect(()=>{
   const p=new URLSearchParams(window.location.search);
   const sid=p.get('session');
   if(p.get('payment')==='cancelled'&&p.get('order')){fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancel-checkout',orderId:p.get('order')})}).then(async r=>{const d=await r.json();notify(r.ok?'Checkout cancelled. The item is available again.':d.error);}).catch(()=>notify('Could not cancel checkout. Its reservation will expire automatically.'));window.history.replaceState({},'',window.location.pathname);}
   if(p.get('payment')==='success'&&sid){
     setCheckingPayment(true);
     window.history.replaceState({},'',window.location.pathname);
     (async()=>{
       try{
         const r=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify-payment',sessionId:sid})});
         const d:any=await r.json();
         if(r.ok){
           if(d.receiptUrl){window.location.href=d.receiptUrl;return;}
           notify('Payment confirmed! Receipt generated.');
           await refresh();
           if(d.receipt){
             openReceiptWindow(d.receipt);
           }
         }else{
           notify(d.error||'Payment verification failed. Contact support.');
         }
       }catch{
         notify('Could not verify payment.');
       }finally{
         setCheckingPayment(false);
       }
     })();
   }
 },[]);

 function location(target:'profile'|'draft'){
   if(!navigator.geolocation){notify('Location is unavailable. Enter a pickup address.');return;}
   navigator.geolocation.getCurrentPosition(async p=>{
     const coords={lat:p.coords.latitude,lng:p.coords.longitude};
     let address=`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
     try{
       const r=await fetch(`/api/location?lat=${coords.lat}&lng=${coords.lng}`);
       const d:any=await r.json();
       if(d.address)address=d.address;
     }catch{};
     if(target==='profile')setProfile(v=>({...v,...coords,address,locatedAddress:address}));
     else setDraft(v=>({...v,...coords,address,locatedAddress:address}));
   },()=>notify('Location access was declined. You can enter an address instead.'));
 }

 async function saveProfile(e:React.FormEvent){
   e.preventDefault();
   setBusy(true);
   try{
     if(modal==='location'&&!registered){
       const res=await fetch('/api/location?q='+encodeURIComponent(profile.address));
       const found:any=await res.json();
       if(!res.ok)throw Error(found.error);
       profileRef.current={...profile,...found};
       setProfile(profileRef.current);
       await refresh();
       setModal('');
       return;
     }
     const d=await api('profile',{profile});
     setProfile(d.profile);
     profileRef.current=d.profile;
     setRegistered(true);
     setModal('');
     notify('Your pickup preferences are saved.');
     await refresh();
   }catch(e:any){notify(e.message);}finally{setBusy(false);}
 }

 async function photo(file:File|undefined){
   if(!file)return;
   if(file.size>10*1024*1024){notify('Choose a photo smaller than 10 MB.');return;}
   setBusy(true);
   setAiProgress(5);
   setAiNote('Reading your photo…');
   try{
     const image=await new Promise<string>((resolve,reject)=>{
       const im=new Image();
       im.onload=()=>{
         const c=document.createElement('canvas');
         const ratio=Math.min(1,1280/Math.max(im.width,im.height));
         c.width=im.width*ratio;
         c.height=im.height*ratio;
         c.getContext('2d')!.drawImage(im,0,0,c.width,c.height);
         resolve(c.toDataURL('image/jpeg',.85));
         URL.revokeObjectURL(im.src);
       };
       im.onerror=reject;
       im.src=URL.createObjectURL(file);
     });
     setDraft(v=>({...v,photo:image}));
     setAiProgress(25);
     setAiNote('Uploading to AI…');
     await new Promise(r=>setTimeout(r,300));
     setAiProgress(45);
     setAiNote('Identifying materials…');
     const d=await api('analyze',{image});
     setAiProgress(90);
     setDraft(v=>({...v,...d,suggestedPrice:typeof d.suggestedPrice==='number'?d.suggestedPrice:null,price:''}));
     await new Promise(r=>setTimeout(r,200));
     setAiProgress(100);
     setAiNote('Photo analyzed. Check the details, then publish.');
   }catch(e:any){
     setAiProgress(0);
     setAiNote(e.message||"We couldn't read that photo. Fill in the details below.");
   }finally{
     setBusy(false);
   }
 }

 async function publish(e:React.FormEvent){
   e.preventDefault();
   if(profile.emailVerified===false){notify('Please verify your email to list items.');return;}
   setBusy(true);
   try{
     const price=draft.price===''?0:Number(draft.price);
     await api('publish',{listing:{...draft,price:Number.isFinite(price)&&price>=0?price:0}});
     setModal('');
     setDraft(blank);
     notify(price>0?'Listed! Buyers can now purchase your item.':'Listed! Nearby buyers can now claim your item for free.');
     setView('My listings');
     await refresh();
   }catch(e:any){notify(e.message);}finally{setBusy(false);}
 }

 async function submitWithdrawal(e:React.FormEvent){
   e.preventDefault();
   setBusy(true);
   try{
     const r=await fetch('/api/payments',{
       method:'POST',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({action:'request-payout',...withdrawalDraft,requestKey:withdrawalKey.current||(withdrawalKey.current=crypto.randomUUID())})
     });
     const d:any=await r.json();
     if(!r.ok)throw Error(d.error||'Failed to submit withdrawal request.');
     withdrawalKey.current=null;
     notify(d.testMode?'Demo withdrawal completed. No real money was transferred.':'Withdrawal request saved for manual processing. No transfer has been made yet.');
     setModal('');
     setWithdrawalDraft({amount:'',paymentMethod:'Bank Transfer (ACH)',accountDetails:'',notes:''});
     await fetchEarnings();
   }catch(e:any){notify(e.message);}finally{setBusy(false);}
 }

 async function showBuyerReceipt(item:any){try{const r=await fetch('/api/payments?type=receipt&listingId='+encodeURIComponent(item.id));const d=await r.json();if(!r.ok)throw Error(d.error);if(d.receiptUrl){window.location.href=d.receiptUrl;return;}openReceiptWindow(d.receipt);}catch(e:any){notify(e.message);}}

 const filtered=items.filter(i=>(view==='My listings'?i.mine:view==='My pickups'?i.claimedMine:(i.status==='available'||i.status==='reserved'))&&(category==='All materials'||i.category===category)&&`${i.title} ${i.material} ${i.description}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sort==='newest'?b.created_at-a.created_at:distance(profile,a)-distance(profile,b));
 const openAdd=()=>{if(!registered||profile.role!=='contractor'){setModal('profile');setProfile(v=>({...v,role:'contractor'}));notify('Save your contractor profile once, then start listing.');}else{setDraft({...blank,visibility_radius:profile.radius,address:profile.address,lat:profile.lat,lng:profile.lng});setAiNote('');setAiProgress(0);setModal('add');location('draft');}};

 const recordsView=view==='My pickups'||view==='Reports & appeals';
 useEffect(()=>{if(!initialView){const requested=new URLSearchParams(window.location.search).get('view');if(requested&&['Explore','My listings','Payment History','Earnings & Payouts'].includes(requested))setView(requested);}},[initialView]);
 const navItems=mode==='contractor'
   ?['My listings','My pickups','Earnings & Payouts','Reports & appeals']
   :['Explore','My pickups','Payment History','Reports & appeals'];

 return <div className="app-shell">
  <header className="topbar">
    <a className="brand" href="/"><span className="brand-icon"><Recycle size={27}/></span>salvage<span className="brand-dot">.</span></a>
    <nav>
      {navItems.map(v=><button key={v} className={view===v?'nav-active':''} aria-current={view===v?'page':undefined} onClick={()=>{if(v==='My pickups'||v==='Reports & appeals'){window.location.href=v==='My pickups'?'/pickups':'/reports';return;}if(initialView){window.location.href=(mode==='contractor'?'/contractor':'/buyer')+'?view='+encodeURIComponent(v);return;}setView(v);setCategory('All materials');}}>{v==='My pickups'&&mode==='contractor'?'Reservations':v}</button>)}
    </nav>
    <div className="header-actions">
      <button className="icon-button notification" aria-label="Notifications" onClick={()=>setModal('notifications')}><Bell size={21}/>{notes.some(n=>!n.read_at)&&<i/>}</button>
      <button className="avatar" onClick={()=>setModal('profile')} aria-label="Your profile">{profile.name?profile.name.split(' ').map(s=>s[0]).slice(0,2).join(''):'JD'}</button>
      <button className="signout-link" disabled={busy} onClick={async()=>{signingOut.current=true;setBusy(true);try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw Error('Could not log out. Please try again.');window.location.replace('/login');}catch(e:any){signingOut.current=false;setBusy(false);notify(e.message);}}}>Log out</button>
      {mode==='contractor'&&<button className="primary add-top" onClick={openAdd}><Plus size={19}/> Add item</button>}
    </div>
  </header>

  <main className="workspace">
   {recordsView?<PickupUI id={receiptId} reportsOnly={view==='Reports & appeals'}/>:<>
   <div className="page-heading">
     <div>
       <div className="eyebrow"><span/> {mode==='contractor'?'YOUR CONTRACTOR WORKSPACE':'THE LOCAL MATERIAL EXCHANGE'}</div>
       <h1>
         {view==='Explore'?'Good materials. Another life.'
           :view==='My listings'?'Less waste. More possibility.'
           :view==='Earnings & Payouts'?'Earnings & Payouts'
           :view==='Payment History'?'Purchases & Claim Receipts'
           :'Your next great find.'}
       </h1>
       <p>
         {view==='Explore'?'Find reusable building materials around the corner. Save them from the dumpster.'
           :view==='My listings'?"Everything you've put back to work, in one place."
           :view==='Earnings & Payouts'?(earnings.testMode?'Stripe test mode: earnings and withdrawals are simulated. No real money moves.':'Track confirmed sales and request a withdrawal for manual processing.')
           :view==='Payment History'?'View your paid orders and verified free claim receipts for pickup.'
           :'Arrange a pickup and give these materials a new home.'}
       </p>
     </div>
     <button className="location-button" onClick={()=>setModal('location')}><MapPin size={18}/><span>{profile.address||'Set your location'}<small>Nearby listings</small></span><ChevronDown size={16}/></button>
   </div>

   {/* Email verification alert */}
   {profile.emailVerified===false&&<div className="ai-note" style={{background:'#fff3cd',color:'#856404',borderColor:'#ffeeba',marginBottom:'20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'10px'}}>
     <span><strong>Email verification required:</strong> Please verify your email address to {mode==='contractor'?'list materials':'reserve a pickup window'}.</span>
     <button className="primary" style={{fontSize:'12px',padding:'6px 14px',minHeight:'34px'}} disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resend-verification',email:profile.email})});const d:any=await r.json();if(!r.ok)throw Error(d.error);notify(d.message);}catch(e:any){notify(e.message);}finally{setBusy(false);}}}>Resend verification link</button>
   </div>}

   {/* CONTRACTOR: Earnings & Payouts View */}
   {view==='Earnings & Payouts'&&(
     <div>
       <div className="earnings-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'20px',marginBottom:'30px'}}>
         <div className="earnings-card highlight" style={{background:'#edf5e7',border:'1px solid #b5d4a4',borderRadius:'12px',padding:'22px 24px',boxShadow:'0 2px 8px rgba(35,50,25,0.05)'}}>
           <div className="kicker" style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1px',color:'#506e3e'}}><Wallet size={16}/> Available for Withdrawal</div>
           <div className="amount" style={{fontSize:'32px',fontWeight:700,color:'#2c541b',letterSpacing:'-0.8px',marginTop:'6px'}}>${earnings.availableBalance.toFixed(2)}</div>
         </div>
         <div className="earnings-card" style={{background:'#fff',border:'1px solid #dce2d4',borderRadius:'12px',padding:'22px 24px',boxShadow:'0 2px 8px rgba(35,50,25,0.03)'}}>
           <div className="kicker" style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1px',color:'#737d68'}}><DollarSign size={16}/> Total Sales Earned</div>
           <div className="amount" style={{fontSize:'32px',fontWeight:700,color:'#232e1a',letterSpacing:'-0.8px',marginTop:'6px'}}>${earnings.totalEarned.toFixed(2)}</div>
         </div>
         <div className="earnings-card" style={{background:'#fff',border:'1px solid #dce2d4',borderRadius:'12px',padding:'22px 24px',boxShadow:'0 2px 8px rgba(35,50,25,0.03)'}}>
           <div className="kicker" style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1px',color:'#737d68'}}><Clock size={16}/> Pending Requests</div>
           <div className="amount" style={{fontSize:'32px',fontWeight:700,color:'#232e1a',letterSpacing:'-0.8px',marginTop:'6px'}}>${earnings.pendingWithdrawal.toFixed(2)}</div>
         </div>
         <div className="earnings-card" style={{background:'#fff',border:'1px solid #dce2d4',borderRadius:'12px',padding:'22px 24px',boxShadow:'0 2px 8px rgba(35,50,25,0.03)'}}>
           <div className="kicker" style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1px',color:'#737d68'}}><Check size={16}/> Total Paid Out</div>
           <div className="amount" style={{fontSize:'32px',fontWeight:700,color:'#232e1a',letterSpacing:'-0.8px',marginTop:'6px'}}>${earnings.totalWithdrawn.toFixed(2)}</div>
         </div>
       </div>

       <div style={{display:'flex',gap:'12px',marginBottom:'28px'}}>
         <button className="primary" onClick={()=>setModal('withdraw')} disabled={earnings.availableBalance<=0}>
           <ArrowDownToLine size={18}/> Request Withdrawal
         </button>
         <button className="primary" style={{background:'#fff',color:'#456531',borderColor:'#cfdbbe'}} onClick={fetchEarnings}>
           Refresh
         </button>
       </div>

       {/* Sold Items Table */}
       <div className="section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'36px 0 16px'}}>
         <h2 style={{fontSize:'20px',fontWeight:700,letterSpacing:'-0.4px',color:'#232d1c',margin:0}}>Completed Sales ({earnings.sales.length})</h2>
       </div>
       <div className="data-table-container" style={{background:'#fff',border:'1px solid #dbe2d4',borderRadius:'12px',overflowX:'auto',boxShadow:'0 2px 6px rgba(0,0,0,0.03)',marginBottom:'32px'}}>
         {earnings.sales.length?(
           <table className="data-table" style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',textAlign:'left'}}>
             <thead>
               <tr style={{background:'#f3f6ee',borderBottom:'1px solid #dce4d5'}}>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Item Title</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Category</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Buyer</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Sale Date</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px',textAlign:'right'}}>Amount</th>
               </tr>
             </thead>
             <tbody>
                {earnings.sales.map(s=>(
                  <tr key={s.id}>
                    <td>
                      <strong style={{color:'#1c2615',display:'block'}}>{s.title}</strong>
                      <span style={{fontSize:'12px',color:'#76846d'}}>{s.material} · {s.condition}</span>
                    </td>
                    <td>
                      <span style={{display:'inline-block',background:'#f1f4ed',padding:'3px 9px',borderRadius:'5px',fontSize:'12px',color:'#455938',fontWeight:500}}>
                        {s.category}
                      </span>
                    </td>
                    <td>
                      <strong style={{color:'#293420',display:'block',fontSize:'13px'}}>{s.buyer?.name && s.buyer?.name !== 'None' ? s.buyer.name : s.buyer?.email ? s.buyer.email.split('@')[0] : 'Buyer'}</strong>
                      {s.buyer?.email && <span style={{color:'#77826f',fontSize:'12px',display:'block'}}>{s.buyer.email}</span>}
                    </td>
                    <td style={{color:'#5b6752'}}>{new Date(s.created_at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:'#2e5a23',fontSize:'16px'}}>${Number(s.price).toFixed(2)}</td>
                  </tr>
                ))}
             </tbody>
           </table>
         ):(
           <div className="empty-state">
             <Package size={32}/>
             <h3>No sales yet</h3>
             <p>When buyers purchase materials you've priced, your earnings will appear here.</p>
           </div>
         )}
       </div>

       {/* Withdrawal Requests Table */}
       <div className="section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'36px 0 16px'}}>
         <h2 style={{fontSize:'20px',fontWeight:700,letterSpacing:'-0.4px',color:'#232d1c',margin:0}}>Payout Requests ({earnings.payouts.length})</h2>
       </div>
       <div className="data-table-container" style={{background:'#fff',border:'1px solid #dbe2d4',borderRadius:'12px',overflowX:'auto',boxShadow:'0 2px 6px rgba(0,0,0,0.03)',marginBottom:'32px'}}>
         {earnings.payouts.length?(
           <table className="data-table" style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',textAlign:'left'}}>
             <thead>
               <tr style={{background:'#f3f6ee',borderBottom:'1px solid #dce4d5'}}>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Request Date</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Method</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Account Details</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Status</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px',textAlign:'right'}}>Amount</th>
               </tr>
             </thead>
             <tbody>
               {earnings.payouts.map(p=>(
                 <tr key={p.id}>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8',color:'#5b6752'}}>{new Date(p.created_at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}</td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8'}}><strong>{p.payment_method}</strong></td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8'}}><code style={{fontSize:'12px',background:'#f0f2eb',padding:'4px 8px',borderRadius:'5px',color:'#354526'}}>{p.account_details}</code></td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8'}}><span className={`status-pill ${p.status}`}>{!p.livemode?'Demo completed':p.status}</span></td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8',textAlign:'right',fontWeight:700,fontSize:'15px'}}>${Number(p.amount).toFixed(2)}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         ):(
           <div className="empty-state" style={{padding:'35px 20px'}}>
             <p>No withdrawal requests submitted yet.</p>
           </div>
         )}
       </div>
     </div>
   )}

   {/* BUYER: Payment & Claim History View */}
   {view==='Payment History'&&(
     <div>
       <div className="section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'36px 0 16px'}}>
         <h2 style={{fontSize:'20px',fontWeight:700,letterSpacing:'-0.4px',color:'#232d1c',margin:0}}>Purchases &amp; Claim Passes ({buyerHistory.length})</h2>
       </div>
       <div className="data-table-container" style={{background:'#fff',border:'1px solid #dbe2d4',borderRadius:'12px',overflowX:'auto',boxShadow:'0 2px 6px rgba(0,0,0,0.03)',marginBottom:'32px'}}>
         {buyerHistory.length?(
           <table className="data-table" style={{width:'100%',borderCollapse:'collapse',fontSize:'14px',textAlign:'left'}}>
             <thead>
               <tr style={{background:'#f3f6ee',borderBottom:'1px solid #dce4d5'}}>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Item</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Category</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Contractor / Contact</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Type</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px'}}>Price</th>
                 <th style={{padding:'14px 20px',color:'#49593e',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.7px',textAlign:'right'}}>Receipt / Pass</th>
               </tr>
             </thead>
             <tbody>
               {buyerHistory.map(item=>(
                 <tr key={item.id}>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8'}}>
                     <strong style={{color:'#1c2615',display:'block'}}>{item.title}</strong>
                     <span style={{fontSize:'12px',color:'#76846d'}}>{item.material} · {item.condition}</span>
                   </td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8'}}>
                     <span style={{display:'inline-block',background:'#f1f4ed',padding:'3px 9px',borderRadius:'5px',fontSize:'12px',color:'#455938',fontWeight:500}}>
                       {item.category}
                     </span>
                   </td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8'}}>
                     <strong style={{color:'#293420',display:'block',fontSize:'13px'}}>{item.seller?.name && item.seller?.name !== 'None' ? item.seller.name : item.seller?.email ? item.seller.email.split('@')[0] : 'Contractor'}</strong>
                     {item.seller?.email&&<span style={{color:'#77826f',fontSize:'12px',display:'block'}}>{item.seller.email}</span>}
                   </td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8'}}>
                     <span className={`status-pill ${Number(item.price)>0?'paid':'completed'}`}>
                       {Number(item.price)>0?'Paid Purchase':'Free Claim'}
                     </span>
                   </td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8',fontWeight:700,color:Number(item.price)>0?'#2e5a23':'#3b5c89',fontSize:'15px'}}>
                     {Number(item.price)>0?`$${Number(item.price).toFixed(2)}`:'FREE'}
                   </td>
                   <td style={{padding:'16px 20px',borderBottom:'1px solid #edf1e8',textAlign:'right'}}>
                     <button className="receipt-action-btn" onClick={()=>showBuyerReceipt(item)}>
                       <ReceiptText size={15}/> View Receipt
                     </button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         ):(
           <div className="empty-state">
             <Package size={32}/>
             <h3>No claimed or purchased materials yet</h3>
             <p>Explore materials nearby to claim free salvage or buy discounted supplies.</p>
             <button className="primary" onClick={()=>setView('Explore')}>Explore Materials</button>
           </div>
         )}
       </div>
     </div>
   )}

   {/* Standard Marketplace & Contractor Listings View */}
   {view!=='Earnings & Payouts'&&view!=='Payment History'&&(
     <>
       {mode==='contractor'?<div className="contractor-action"><div><span className="contractor-camera"><Camera size={28}/></span><h2>Out with the old.<br/>On to its next project.</h2><p>Take a photo. Confirm the details. We'll find it a new home.</p></div><button className="primary" onClick={openAdd}><Plus size={22}/> Add an item</button></div>:<div className="intro-strip"><div className="strip-icon"><Leaf size={25}/></div><div><strong>Still useful. Just needs a new home.</strong><span>All materials are free or priced. You handle the pickup.</span></div><div className="strip-right"><button onClick={()=>setModal('profile')}>Your buyer preferences <ArrowUpRight size={18}/></button></div></div>}

       <div className="search-row"><div className="search-box"><Search size={21}/><input aria-label="Search materials" placeholder="Search cabinets, doors, tile, and more…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Clear search" onClick={()=>setSearch('')}><X size={17}/></button>}</div><button className="filter-button" onClick={()=>setModal('location')}><SlidersHorizontal size={18}/> Filters <span>{profile.radius} mi</span></button></div>
       <div className="category-row">{categories.map((c,i)=>{const Icon=icons[i];return <button key={c} onClick={()=>setCategory(c)} className={category===c?'category active':'category'}><Icon size={18}/>{c}</button>;})}</div>
       {!hasCoordinates(profile)&&<div className="ai-note">Your address is saved. Confirm your map location to find nearby materials.<button className="primary" onClick={()=>setModal('location')}>Set location</button></div>}

       <div className="results-bar">
         <div><h2>{view==='Explore'?'Available nearby':view}</h2><span>{filtered.length} materials <span className="live-dot"/> {items.some(i=>i.demo)?'Sample listings':'Updated live'}</span></div>
         <div className="results-options">
           <Select value={sort} onValueChange={v=>setSort(v||'nearest')}><SelectTrigger className="sort-select"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="nearest">Nearest first</SelectItem><SelectItem value="newest">Newest first</SelectItem></SelectContent></Select>
           <Tabs value={layout} onValueChange={setLayout}><TabsList className="view-toggle"><TabsTrigger value="grid" aria-label="Grid view"><LayoutGrid size={17}/></TabsTrigger><TabsTrigger value="map" aria-label="Map view"><Map size={17}/></TabsTrigger></TabsList></Tabs>
         </div>
       </div>

       {layout==='map'&&hasCoordinates(profile)&&<div className="map-panel"><iframe title="Map of your pickup area" src={`https://www.openstreetmap.org/export/embed.html?bbox=${profile.lng-.2}%2C${profile.lat-.14}%2C${profile.lng+.2}%2C${profile.lat+.14}&layer=mapnik&marker=${profile.lat}%2C${profile.lng}`}/><div className="map-caption"><MapPin size={17}/> Your search area · Choose an item below for its pickup area.</div></div>}

       <div className="material-grid">
         {filtered.map(item=><button className="material-card" key={item.id} onClick={()=>setSelected(item)}>
           <div className="card-photo">
             <img src={item.photo} alt={item.title}/>
             <span className={`free-badge${Number(item.price)>0?' card-price-badge':''}`}>{item.status==='available'?(Number(item.price)>0?`$${Number(item.price).toFixed(2)}`:'FREE'):item.status.toUpperCase()}</span>
             <span className="photo-arrow"><ArrowUpRight size={18}/></span>
           </div>
           <div className="card-body">
             <div className="card-kicker"><span>{item.category}</span><span className={`condition ${item.condition.toLowerCase()}`}><i/>{item.condition}</span></div>
             <h3>{item.title}</h3>
             <p>{item.description}</p>
             <div className="card-meta"><span><MapPin size={14}/>{hasCoordinates(profile)?distance(profile,item).toFixed(1)+' mi':'Location not set'} · {item.area||'Nearby'}</span><span><Clock size={13}/>{item.demo?item.age:timeAgo(item.created_at)}</span></div>
             <div className="card-bottom"><span><span className="mini-avatar">{item.owner_name?.slice(0,1)||'S'}</span>{item.owner_name||'Local contractor'}</span><span className="pickup-text"><Truck size={14}/>{item.status==='available'?(Number(item.price)>0?'For sale':'Pickup ready'):item.status==='claimed'?'Claimed':'Donated'}</span></div>
           </div>
         </button>)}
       </div>

       {!filtered.length&&<div className="empty-state"><Package size={36}/><h3>{view==='Explore'?'No materials in this search yet.':'Nothing here just yet.'}</h3><p>{view==='Explore'?'Check your location or try another category. Listings use the contractor’s selected radius.':'Explore nearby materials or list something worth saving.'}</p><button className="primary" onClick={()=>{setCategory('All materials');setSearch('');if(view==='Explore')setModal('location');else if(mode==='contractor')openAdd();else setView('Explore');}}> {view==='Explore'?'Adjust search area':mode==='contractor'?'List your first item':'Explore materials'} <ArrowRight size={17}/></button></div>}
     </>
   )}

   <div className="bottom-note"><Recycle size={17}/><span>A second life for materials. A little less in the landfill.</span></div>
  </>}
  </main>

  <footer><a className="footer-brand" href="/">salvage.</a><span>Built for the next build.</span><span className="footer-right">Good for your project. Better for the planet. <Leaf size={14}/></span></footer>
  {mode==='contractor'&&!recordsView&&<button className="mobile-add primary" onClick={openAdd}><Plus size={22}/> Add item</button>}

  {/* Modal Dialogs */}
  <Dialog open={!!modal} onOpenChange={o=>{if(!o)setModal('');}}>
   <DialogContent className="salvage-modal">
    <DialogTitle>
      {modal==='add'?'Give it another life.'
        :modal==='notifications'?'Your updates'
        :modal==='donate'?'Record a nonprofit donation'
        :modal==='withdraw'?'Request Payout'
        :modal==='profile'?'Your Salvage profile'
        :'Your pickup area'}
    </DialogTitle>
    <DialogDescription>
      {modal==='add'?'One photo. A few details. Out of the dumpster.'
        :modal==='notifications'?'New matches and pickup activity appear here.'
        :modal==='donate'?'Save the details and download a donation record.'
        :modal==='withdraw'?(earnings.testMode?'Demo withdrawal: no real money will move. Use sample account details.':'Submit a withdrawal request for manual processing. This does not transfer funds automatically.')
        :modal==='profile'?'Set this up once. Get back to the job.'
        :'Find materials close enough to collect.'}
    </DialogDescription>

    {/* Contractor: Request Withdrawal Modal */}
    {modal==='withdraw'&&<form onSubmit={submitWithdrawal} className="form-stack">
      <div className="account-role" style={{background:'#edf5e7',color:'#355923'}}>
        <Wallet size={18}/> Available balance: <strong>${earnings.availableBalance.toFixed(2)}</strong>
      </div>
      <label>
        Withdrawal Amount (USD)
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:'12px',color:'#718262',fontSize:'15px',pointerEvents:'none'}}>$</span>
          <input 
            type="number" 
            min="1" 
            max={earnings.availableBalance} 
            step="0.01" 
            required 
            placeholder="0.00" 
            value={withdrawalDraft.amount} 
            onChange={e=>setWithdrawalDraft({...withdrawalDraft,amount:e.target.value})} 
            style={{paddingLeft:'26px'}}
          />
        </div>
      </label>
      <label>
        Payout Method
        <Select value={withdrawalDraft.paymentMethod} onValueChange={v=>setWithdrawalDraft({...withdrawalDraft,paymentMethod:v||'Bank Transfer (ACH)'})}>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="Bank Transfer (ACH)">Bank Transfer (ACH Direct Deposit)</SelectItem>
            <SelectItem value="Stripe Payout">Stripe Connected Payout</SelectItem>
            <SelectItem value="PayPal">PayPal</SelectItem>
            <SelectItem value="Zelle">Zelle</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <label>
        Account / Routing Details
        <textarea 
          required 
          placeholder="e.g., Routing: 123456789, Account: 987654321, Bank Name: Chase" 
          value={withdrawalDraft.accountDetails} 
          onChange={e=>setWithdrawalDraft({...withdrawalDraft,accountDetails:e.target.value})}
        />
      </label>
      <label>
        Notes (Optional)
        <input 
          placeholder="Optional memo or reference" 
          value={withdrawalDraft.notes} 
          onChange={e=>setWithdrawalDraft({...withdrawalDraft,notes:e.target.value})}
        />
      </label>
      <button className="primary full" disabled={busy || !withdrawalDraft.amount || Number(withdrawalDraft.amount)<=0 || Number(withdrawalDraft.amount)>earnings.availableBalance}>
        {busy?'Submitting…':'Submit Withdrawal Request'} <ArrowDownToLine size={18}/>
      </button>
    </form>}

    {/* Add Item Modal */}
    {modal==='add'&&<form onSubmit={publish} className="form-stack">
     <div className="listing-photo-controls">
       {draft.photo&&<img className="listing-photo-preview" src={draft.photo} alt="Your item"/>}
       <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden disabled={busy} aria-label="Take an item photo" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void photo(file);}}/>
       <input ref={galleryInput} type="file" accept="image/*" hidden disabled={busy} aria-label="Choose an item photo from gallery" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void photo(file);}}/>
       <button type="button" className="primary full listing-camera-button" disabled={busy} onClick={()=>cameraInput.current?.click()}><Camera size={24}/>{draft.photo?'Retake photo':'Take a photo'}</button>
       <button type="button" className="listing-gallery-button" disabled={busy} onClick={()=>galleryInput.current?.click()}>Choose from gallery</button>
       {!draft.photo&&<p className="muted">Photograph your item and we’ll fill in the details for you.</p>}
     </div>
     {aiNote&&(aiProgress>0&&aiProgress<100
      ?<div className="ai-note-progress" role="status"><div className="progress-fill" style={{width:`${aiProgress}%`}}/><div className="progress-shimmer"/><div className="progress-content"><span>{aiNote}</span><span className="progress-percent">{aiProgress}%</span></div></div>
      :<p className="ai-note" role="status">{aiNote}</p>
     )}
     {draft.suggestedPrice!==null&&draft.suggestedPrice!==undefined&&<div className="price-suggestion"><span>💡 AI suggests: <strong>${Number(draft.suggestedPrice).toFixed(2)}</strong> based on salvage value</span><button type="button" onClick={()=>setDraft(v=>({...v,price:draft.suggestedPrice??0}))}>Use this</button></div>}
     <label>Title<input required value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
     <div className="form-two"><label>Category<Select value={draft.category} onValueChange={v=>setDraft({...draft,category:v||'Other'})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{categories.slice(1).map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></label><label>Condition<Select value={draft.condition} onValueChange={v=>setDraft({...draft,condition:v||'Good'})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Excellent','Good','Fair','Poor'].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></label></div>
     <label>Does it work?<select value={draft.functionality} onChange={e=>setDraft({...draft,functionality:e.target.value})}>{['Working — tested','Untested','Not working / parts only'].map(v=><option key={v}>{v}</option>)}</select><small>AI estimates visible condition only. Choose “Working — tested” only if you tested it yourself.</small></label>
     <label>Condition evidence / test notes<textarea maxLength={1000} value={draft.evidence_note} onChange={e=>setDraft({...draft,evidence_note:e.target.value})} placeholder="What did you test? Describe visible defects."/></label>
     <label>Additional evidence photo <small>Required for items priced $250 or more, or when additional verification is requested.</small><input type="file" accept="image/*" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);try{if(file.size>10*1024*1024)throw Error('Choose a photo under 10 MB.');const url=URL.createObjectURL(file);try{const im=new Image();await new Promise<void>((resolve,reject)=>{im.onload=()=>resolve();im.onerror=()=>reject(Error('Could not read the photo.'));im.src=url;});const c=document.createElement('canvas');const ratio=Math.min(1,640/Math.max(im.width,im.height));c.width=im.width*ratio;c.height=im.height*ratio;c.getContext('2d')!.drawImage(im,0,0,c.width,c.height);setDraft(v=>({...v,evidencePhoto:c.toDataURL('image/jpeg',.7)}));}finally{URL.revokeObjectURL(url);}}catch(e:any){notify(e.message);}finally{setBusy(false);}}}/>{draft.evidencePhoto&&<img className="listing-photo-preview" src={draft.evidencePhoto} alt="Additional evidence"/>}</label>
     <label>Material<input required value={draft.material} onChange={e=>setDraft({...draft,material:e.target.value})}/></label>
     <label>Description<textarea required value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
     <label style={{gap:'6px'}}>Price (USD)<small style={{color:'#7a8a6a',fontSize:'12px'}}>Leave blank or 0 to list for free. AI suggestion shown above.</small><div style={{position:'relative',display:'flex',alignItems:'center'}}><span style={{position:'absolute',left:'12px',color:'#718262',fontSize:'15px',pointerEvents:'none'}}>$</span><input type="number" min="0" step="0.01" placeholder="0.00 — free" value={draft.price===''?'':draft.price} onChange={e=>setDraft({...draft,price:e.target.value===''?'':parseFloat(e.target.value)||0})} style={{paddingLeft:'26px'}}/></div></label>
     <label>Pickup address<div className="input-action"><input required value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})}/><button type="button" aria-label="Use current location" onClick={()=>location('draft')}><LocateFixed size={20}/></button></div></label>
     <small>Exact address and your contact details are shared only with the buyer who claims it.</small>
     <label>Listing visibility <strong>{draft.visibility_radius} miles</strong><Slider value={[draft.visibility_radius]} onValueChange={v=>setDraft({...draft,visibility_radius:Array.isArray(v)?v[0]:v})} min={1} max={100} step={1}/><small>People within this distance of the pickup location can find this item.</small></label>
     <button className="primary full" disabled={busy||!draft.photo}>{busy?'Working…':profile.emailVerified===false?'Verify email to publish':Number(draft.price)>0?`Publish for $${Number(draft.price).toFixed(2)}`:'Publish free listing'} <ArrowRight size={18}/></button>
    </form>}

    {/* Profile & Location Modal */}
    {(modal==='profile'||modal==='location')&&<form onSubmit={saveProfile} className="form-stack">{modal==='profile'&&<><div className="account-role"><Check size={17}/> {mode==='contractor'?'Contractor':'Buyer'} account</div><label>Name or organization<input required value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><div className="form-two"><label>Email<input type="email" required value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})}/></label><label>Phone<input type="tel" value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}/></label></div></>}<label>Location or ZIP code<div className="input-action"><input required value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/><button type="button" aria-label="Use current location" onClick={()=>location('profile')}><LocateFixed size={20}/></button></div></label><label>Notification radius <strong>{profile.radius} miles</strong><Slider value={[profile.radius]} onValueChange={v=>setProfile({...profile,radius:Array.isArray(v)?v[0]:v})} min={1} max={100} step={1}/></label><label>Notify me about</label><div className="preference-grid">{categories.slice(1).map(c=><label key={c}><Checkbox checked={profile.preferences.includes(c)} onCheckedChange={v=>setProfile({...profile,preferences:v?[...profile.preferences,c]:profile.preferences.filter(x=>x!==c)})}/>{c}</label>)}</div><button disabled={busy} className="primary full">{busy?'Saving…':'Save preferences'}<Check size={18}/></button>{!registered&&<a className="signin-link" href="/login">Log in to save your profile</a>}</form>}

    {/* Notifications Modal */}
    {modal==='notifications'&&<div className="notification-list">{notes.length?notes.map(n=><button key={n.id} onClick={async()=>{await api('read',{id:n.id});setModal('');const i=items.find(i=>i.id===n.listing_id);if(i)setSelected(i);refresh();}}><Bell size={20}/><span>{n.message}<small>{timeAgo(n.created_at)}</small></span></button>):<div className="empty-state"><Bell size={30}/><h3>You're all caught up.</h3><p>Save your categories and radius to receive matching listings here.</p><button className="primary" onClick={()=>setModal('profile')}>Set preferences</button></div>}</div>}

    {/* Donate Modal */}
    {modal==='donate'&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api('donate',{id:selected!.id,...donation});downloadReceipt(selected!,donation);setModal('');setSelected(null);refresh();notify('Donation recorded and receipt downloaded.');}catch(e:any){notify(e.message);}finally{setBusy(false);}}}><label>Nonprofit name<input required value={donation.nonprofit} onChange={e=>setDonation({...donation,nonprofit:e.target.value})}/></label><label>Your estimated value (USD)<input type="number" min="0" step="0.01" required value={donation.value} onChange={e=>setDonation({...donation,value:e.target.value})}/></label><p className="muted">This is your donation record, not an acknowledgment issued by the nonprofit. Keep the nonprofit's receipt with it.</p><button className="primary" disabled={busy}>Record &amp; download <HeartHandshake size={18}/></button></form>}
   </DialogContent>
  </Dialog>

  {/* Item Detail Modal */}
  <Dialog open={!!selected&&modal!=='donate'} onOpenChange={o=>{if(!o)setSelected(null);}}>
   <DialogContent className="salvage-modal item-modal">
    <DialogTitle>{selected?.title}</DialogTitle>
    <DialogDescription>{selected?.category} · {selected?.material} · {selected?.condition} condition</DialogDescription>
    {selected&&<>
     <img className="detail-photo" src={selected.photo} alt={selected.title}/>
     {Number(selected.price)>0
      ?<div className="detail-free"><span style={{background:'#2e4b21',color:'#fff',padding:'4px 14px',borderRadius:'6px',fontSize:'22px',fontWeight:700}}>${Number(selected.price).toFixed(2)}</span><span>Salvage material · Stripe-secured payment.</span></div>
      :<div className="detail-free">Free <span>Give it a new home.</span></div>
     }
     <p>{selected.description}</p><p><strong>Functionality:</strong> {selected.functionality||'Untested'}</p>{selected.evidence_note&&<p>Contractor’s evidence: {selected.evidence_note}</p>}{selected.evidence_photo&&<img className="detail-photo" src={selected.evidence_photo} alt="Additional condition evidence"/>}{!!selected.owner_review_count&&<p>{selected.owner_rating}/5 from {selected.owner_review_count} completed pickup reviews</p>}
     <div className="detail-location"><MapPin size={20}/><span>{selected.address||`${selected.area||'Local pickup'} · ${distance(profile,selected).toFixed(1)} miles away`}<small>{selected.address?'Coordinate a pickup time before visiting.':'Exact pickup address is shared after claiming.'}</small></span></div>
     {selected.contact&&<div className="contact-card"><strong>{selected.contact.name}</strong><a href={`mailto:${selected.contact.email}`}>{selected.contact.email}</a>{selected.contact.phone&&<a href={`tel:${selected.contact.phone}`}>{selected.contact.phone}</a>}</div>}
     {selected.demo&&<p className="sample-note">Sample listing · This shows what materials will look like on Salvage.</p>}
     {!selected.demo&&selected.status==='available'&&!selected.mine&&profile.role==='buyer'&&<ReserveForm item={selected}/>}
     {!selected.demo&&selected.status==='reserved'&&!selected.mine&&!selected.claimedMine&&profile.role==='buyer'&&<button className="pickup-secondary" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/pickups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'waitlist',listingId:selected.id})});const d=await r.json();if(!r.ok)throw Error(d.error);notify('You are on the waitlist. We will notify you in the app if this item becomes available.');}catch(e:any){notify(e.message);}finally{setBusy(false);}}}>Join waitlist</button>}
     {!selected.demo&&!selected.mine&&<ReportForm listingId={selected.id}/>}
     {selected.mine&&selected.status==='available'&&<button className="primary full" onClick={()=>setModal('donate')}><HeartHandshake size={19}/> Mark donated to nonprofit</button>}
     {selected.status!=='available'&&<div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'10px'}}>
       <p className="ai-note"><Check size={17}/> {selected.status==='reserved'?'Reserved — manage the pickup on your receipt.':selected.status==='claimed'?'Collected / claimed — view your receipt.':'Donated — another life made possible.'}</p>
       {selected.claimedMine&&<button className="primary full" style={{background:'#f3f7ee',color:'#395826',borderColor:'#c4d5b9'}} onClick={()=>showBuyerReceipt(selected)}>
         <ReceiptText size={18}/> View Pickup Pass &amp; Receipt
       </button>}
     </div>}
    </>}
   </DialogContent>
  </Dialog>

  {message&&<div className="toast" role="status"><span>{message}</span><button onClick={()=>setMessage('')} aria-label="Dismiss"><X size={18}/></button></div>}
 </div>;
}

function timeAgo(ts:number){const mins=Math.max(1,Math.round((Date.now()-ts)/60000));return mins<60?`${mins}m ago`:mins<1440?`${Math.floor(mins/60)}h ago`:`${Math.floor(mins/1440)}d ago`;}
function downloadReceipt(i:Item,d:{nonprofit:string,value:string}){const text=`SALVAGE — DONATION RECORD\n\nItem: ${i.title}\nDescription: ${i.description}\nEstimated value (donor provided): $${Number(d.value).toFixed(2)}\nNonprofit: ${d.nonprofit}\nDate: ${new Date().toLocaleDateString()}\nListing: ${i.id}\n\nThis record is not a nonprofit acknowledgment or a valuation. Retain the receiving organization's receipt.`;const url=URL.createObjectURL(new Blob([text],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=`salvage-donation-${i.id}.txt`;a.click();URL.revokeObjectURL(url);}
