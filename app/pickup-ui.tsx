'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowUpRight,CalendarDays,ReceiptText,ShieldCheck,PackageCheck} from 'lucide-react';
import {openReceiptWindow,type ReceiptData} from '@/lib/receipt';
import type {Item} from '@/lib/materials';
import './pickups.css';

async function action(body:object){const r=await fetch('/api/pickups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Please try again.');return d;}
async function authorize(id:string){const r=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create-checkout',reservationId:id})});const d=await r.json();if(!r.ok)throw Error(d.error);window.location.href=d.url;}
const pickupLabel=(p:any)=>p.status==='reserved'&&!p.contractor_confirmed_at?'Awaiting contractor confirmation':labels[p.status];
const date=(s:string)=>new Date(s).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
const localInput=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
const labels:Record<string,string>={checkout:'Awaiting card authorization',reserved:'Reserved — inspect at pickup',accepting:'Confirming your payment',accepted:'Accepted — awaiting handover',collected:'Collected',cancelled:'Cancelled — invalid for pickup',expired:'Expired — invalid for pickup',declined:'Declined — invalid for pickup'};

export function ReserveForm({item,onDone}:{item:Item;onDone?:()=>void}){
 const [start,setStart]=useState(()=>localInput(new Date(Date.now()+3600000))),[end,setEnd]=useState(()=>localInput(new Date(Date.now()+7200000))),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="form-stack pickup-reserve" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const d=await action({action:'reserve',listingId:item.id,start:new Date(start).toISOString(),end:new Date(end).toISOString()});onDone?.();window.location.href=d.receiptUrl;}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
  <h3>Choose your pickup window</h3><p className="muted">Request a window you can collect in. The contractor must confirm it before you travel or accept the item. Two active reservations per buyer.</p>
  <p><strong>Functionality:</strong> {item.functionality||'Untested'} — inspect before accepting.</p>
  <label>Pickup starts<input type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)}/></label>
  <label>Pickup ends<input type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)}/></label>
  <p className="muted">Choose a window of up to 4 hours within the next 3 days. The reservation expires 30 minutes after it ends. All times use your device’s time zone.</p>
  {Number(item.price)>0&&<p className="ai-note">${Number(item.price).toFixed(2)} will be held on your card. You pay only when you inspect and accept the item. Complete card authorization on the receipt to secure this pickup.</p>}
  {error&&<p role="alert" className="auth-error">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Reserving…':'Reserve pickup'}</button>
 </form>;
}

export function ReportForm({listingId,reservationId,noShow=false}:{listingId:string;reservationId?:string;noShow?:boolean}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState('misrepresented'),[details,setDetails]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <div className="pickup-report"><button type="button" className="pickup-secondary" onClick={()=>setOpen(!open)}>Report listing or user</button>{open&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await action({action:'report',listingId,reservationId,reason,details});setMessage('Report submitted for review. View updates under Reports & appeals.');setOpen(false);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>
 <label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}><option value="misrepresented">Condition differs from listing</option><option value="missing_item">Item does not exist / unavailable</option><option value="unsafe">Unsafe behavior</option>{noShow&&<option value="no_show">Buyer did not show up</option>}<option value="other">Other concern</option></select></label>
 <label>What happened? Include dates and any evidence you can describe.<textarea required minLength={10} maxLength={2000} value={details} onChange={e=>setDetails(e.target.value)}/></label><button className="primary" disabled={busy}>Submit report</button></form>}{message&&<p role="status">{message}</p>}</div>;
}

export default function PickupUI({id,reportsOnly=false}:{id?:string;reportsOnly?:boolean}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[inspected,setInspected]=useState(false),[extension,setExtension]=useState(''),[rating,setRating]=useState(5),[comment,setComment]=useState('');
 async function refresh(){try{const r=await fetch('/api/pickups'+(reportsOnly?'?reports=1':id?'?id='+id:''));const d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{refresh();const t=setInterval(refresh,15000);return()=>clearInterval(t);},[id,reportsOnly]);
 async function run(body:object){setBusy(true);setError('');try{await action(body);await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const p=data?.pickups?.[0];
 function download(){
  const payment=Array.isArray(p.payment)?p.payment[0]:p.payment;const paid=payment?.status==='paid';
  const receipt:ReceiptData={receiptNumber:'SAL-'+p.id,type:paid?'purchase':'reservation',date:date(p.created_at),
   item:{id:p.listing_id,title:p.item_title,category:'Salvage material',material:p.item_functionality,condition:p.item_functionality,address:p.item.address},buyer:p.buyer,seller:p.contractor,
   payment:{amount:p.amount_cents/100,currency:'usd',method:paid?'Card payment':'Reservation — no payment collected',status:payment?.status||'Free reservation',test:payment&&!payment.livemode,refundedAmount:(payment?.refunded_cents||0)/100},
   pickup:{status:pickupLabel(p),window:date(p.pickup_start)+' – '+date(p.pickup_end),deadline:date(p.deadline),liveUrl:window.location.origin+'/receipts/'+p.id}};
  openReceiptWindow(receipt);
 }
 return <section className="pickup-page" aria-label={reportsOnly?'Reports and appeals':'Pickup reservations'}>
 <div className="page-heading records-heading"><div><div className="eyebrow"><span/> {reportsOnly?'SUPPORT & SAFETY':'YOUR PICKUP WORKSPACE'}</div><h1>{reportsOnly?(data?.admin?'Safety review queue':'Reports & appeals'):id?'Your pickup receipt':'Pickups & reservations'}</h1><p>{reportsOnly?'Follow your reports, review decisions, and submit an appeal.':id?'Keep your pickup details, payment, and handover together.':'From reservation to handover. Every pickup, in one place.'}</p></div><span className="records-heading-icon" aria-hidden="true">{reportsOnly?<ShieldCheck size={28}/>:<ReceiptText size={28}/>}</span></div>
 {id&&<a className="records-back" href="/pickups"><ArrowLeft size={16}/> All pickups & reservations</a>}
 {!id&&data&&<div className="records-summary"><div><span className="strip-icon">{reportsOnly?<ShieldCheck size={22}/>:<PackageCheck size={22}/>}</span><div><strong>{reportsOnly?data.reports.length+' reports':data.pickups.filter((r:any)=>['checkout','reserved','accepting','accepted'].includes(r.status)).length+' active pickups'}</strong><p>{reportsOnly?'Reports are reviewed before account restrictions are applied.':'Your existing receipt follows each reservation through collection.'}</p></div></div><span className="records-live"><i className="live-dot"/> Updated live</span></div>}
 {error&&<p className="auth-error" role="alert">{error}</p>}
 {!data?<div className="records-loading" role="status">Loading your records…</div>:reportsOnly?<>{data.reports.length===0?<div className="empty-state records-empty"><ShieldCheck size={40}/><h3>No reports to follow up on</h3><p>Reports you submit or receive will appear here, along with decisions and appeal options.</p></div>:data.reports.map((r:any)=><ReportCard key={r.id} report={r} admin={data.admin} userId={data.userId} refresh={refresh}/>)}</>:!id?<>{!data.pickups.length?<div className="empty-state records-empty"><ReceiptText size={40}/><h3>Your pickups start here</h3><p>When an item is reserved, its receipt and pickup details will appear here.</p><a className="primary" href="/dashboard">Back to your dashboard <ArrowUpRight size={16}/></a></div>:<div className="pickup-grid">{data.pickups.map((r:any)=><a className="pickup-card pickup-list-card" key={r.id} href={'/receipts/'+r.id}><span className="pickup-status" data-status={r.status}>{pickupLabel(r)}</span><h2>{r.item_title}</h2><p className="records-date"><CalendarDays size={16}/><span>{date(r.pickup_start)} – {date(r.pickup_end)}</span></p><p>{r.amount_cents?'$'+(r.amount_cents/100).toFixed(2):'Free pickup'} · {data.userId===r.buyer_id?'Buyer':'Contractor'}</p><span className="records-open">View pickup receipt <ArrowUpRight size={16}/></span></a>)}</div>}</>:!p?<p>This receipt does not exist or belongs to another account.</p>:<>
 <article className="pickup-card pickup-receipt"><span className="pickup-status" data-status={p.status}>{pickupLabel(p)}</span><h1>{p.item_title}</h1><p className="muted">Receipt SAL-{p.id}</p>
 <p><strong>Functionality:</strong> {p.item_functionality}</p><p>{p.item.description}</p>
 <dl><dt>Pickup window</dt><dd>{date(p.pickup_start)} – {date(p.pickup_end)}</dd><dt>Contractor confirmation</dt><dd>{p.contractor_confirmed_at?'Confirmed '+date(p.contractor_confirmed_at):'Awaiting confirmation'}</dd><dt>Reservation deadline</dt><dd>{date(p.deadline)}</dd><dt>Amount</dt><dd>{p.amount_cents?'$'+(p.amount_cents/100).toFixed(2):'Free'}</dd><dt>Buyer</dt><dd>{p.buyer.name} · {p.buyer.email}</dd><dt>Contractor</dt><dd>{p.contractor.name} · {p.contractor.email}{p.contractor.phone&&' · '+p.contractor.phone}</dd>{p.item.address&&<><dt>Pickup address</dt><dd>{p.item.address}</dd></>}</dl>
 {['cancelled','expired','declined'].includes(p.status)&&<p className="auth-error">This receipt is no longer valid for pickup. The item may be reserved by someone else. Any uncollected card hold is released; your bank controls when it disappears.</p>}
 {p.status==='reserved'&&p.amount_cents>0&&<p className="ai-note">Funds are authorized, not paid. Inspect the item before accepting. The contractor cannot charge you using this receipt.</p>}
 {p.status==='collected'&&<p>Both parties confirmed handover on {date(p.collected_at)}.</p>}
 <button className="pickup-secondary" onClick={download}>Print / download this receipt</button><p className="muted">Downloaded receipts are snapshots. Always open this live receipt to check its current status.</p>
 </article>
 <section className="pickup-card form-stack">
 {['checkout','reserved'].includes(p.status)&&!p.contractor_confirmed_at&&(data.userId===p.contractor_id?<><p>A buyer requested this pickup window. Confirm that you can make the item available, or cancel the reservation.</p><button className="primary full" disabled={busy} onClick={()=>run({action:'confirm-window',id:p.id})}>Confirm pickup window</button></>:<p className="ai-note">Your pickup window is awaiting contractor confirmation. Wait for confirmation before travelling. You can cancel before acceptance.</p>)}

 {p.status==='checkout'&&data.userId===p.buyer_id&&<button className="primary full" disabled={busy} onClick={async()=>{setBusy(true);try{await authorize(p.id);}catch(e){setError((e as Error).message);setBusy(false);}}}>Authorize ${(p.amount_cents/100).toFixed(2)} — pay after inspection</button>}
 {p.status==='reserved'&&data.userId===p.buyer_id&&<><label className="pickup-check"><input type="checkbox" checked={inspected} onChange={e=>setInspected(e.target.checked)}/>I have inspected this item in person and accept its condition and price.</label><button className="primary full" disabled={busy||!inspected||!p.contractor_confirmed_at||Date.now()<Date.parse(p.pickup_start)-900000} onClick={()=>run({action:'accept',id:p.id,inspected:true})}>{p.amount_cents?`Accept item and pay $${(p.amount_cents/100).toFixed(2)}`:'Accept item for pickup'}</button><p className="muted">Acceptance opens 15 minutes before your pickup window. Ask the contractor to confirm handover after acceptance.</p><button className="pickup-secondary" disabled={busy} onClick={()=>run({action:'decline',id:p.id})}>Decline item — do not pay</button></>}
 {p.status==='accepting'&&<p>Payment is being confirmed. Do not hand over the item until this receipt confirms success.</p>}
 {p.status==='accepted'&&data.userId===p.contractor_id&&<button className="primary full" disabled={busy} onClick={()=>run({action:'collect',id:p.id})}>Confirm item handed over</button>}
 {p.status==='accepted'&&data.userId===p.buyer_id&&<p>You accepted this item. Ask the contractor to confirm collection here. Report any handover problem below.</p>}
 {['checkout','reserved'].includes(p.status)&&<button className="pickup-secondary" disabled={busy} onClick={()=>run({action:'cancel',id:p.id})}>Cancel reservation</button>}
 {p.status==='reserved'&&<><label>{data.userId===p.contractor_id?'Offer a later pickup end time':'Request a later pickup end time'}<input type="datetime-local" value={extension} onChange={e=>setExtension(e.target.value)}/></label><button className="pickup-secondary" disabled={busy||!extension} onClick={()=>run({action:'extend',id:p.id,end:new Date(extension).toISOString()})}>{data.userId===p.contractor_id?'Extend and confirm window':'Request more time'}</button><p className="muted">Extending keeps the original start time. Both participants receive an update.</p></>}
 {p.extension_status&&<p>Extension: {p.extension_status} {p.requested_end&&'to '+date(p.requested_end)}</p>}
 {p.status==='reserved'&&p.extension_status==='pending'&&data.userId===p.contractor_id&&<div className="pickup-buttons"><button className="primary" disabled={busy} onClick={()=>run({action:'decide-extension',id:p.id,approve:true})}>Approve extension</button><button className="pickup-secondary" disabled={busy} onClick={()=>run({action:'decide-extension',id:p.id,approve:false})}>Decline extension</button></div>}
 {p.status==='collected'&&!p.review&&<><h2>Review this pickup</h2><label>Rating<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label><label>Comment<textarea maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)}/></label><button className="primary" disabled={busy} onClick={()=>run({action:'review',id:p.id,rating,comment})}>Save review</button></>}
 {p.review&&<p>Your review: {p.review.rating}/5 — {p.review.comment}</p>}
 <ReportForm listingId={p.listing_id} reservationId={p.id} noShow={!!p.contractor_confirmed_at&&p.status==='expired'&&p.end_reason!=='checkout_incomplete'&&data.userId===p.contractor_id}/>
 </section></>}
 </section>;
}

function ReportCard({report:r,admin,userId,refresh}:{report:any;admin:boolean;userId:string;refresh:()=>void}){
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(body:object){setBusy(true);try{await action(body);refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <article className="pickup-card form-stack"><div className="records-report-heading"><h2>{r.reason.replaceAll('_',' ')}</h2><span className="pickup-status" data-status={r.status}>{r.status}</span></div><p>{r.details}</p><p>{date(r.created_at)}</p>{r.resolution&&<p>Decision: {r.resolution}</p>}{r.appeal&&<p>Appeal: {r.appeal}</p>}{error&&<p role="alert" className="auth-error">{error}</p>}
 {(admin||(r.target_id===userId&&r.status==='upheld'))&&<label>{admin?'Review explanation':'Explain your appeal'}<textarea minLength={10} maxLength={2000} value={text} onChange={e=>setText(e.target.value)}/></label>}
 {admin?<div className="pickup-buttons"><button className="primary" disabled={busy||text.trim().length<10} onClick={()=>submit({action:'review-report',id:r.id,decision:'upheld',resolution:text})}>Uphold report</button><button className="pickup-secondary" disabled={busy||text.trim().length<10} onClick={()=>submit({action:'review-report',id:r.id,decision:'dismissed',resolution:text})}>Dismiss report</button></div>:r.target_id===userId&&r.status==='upheld'&&<button className="primary" disabled={busy||text.trim().length<10} onClick={()=>submit({action:'appeal',id:r.id,details:text})}>Submit appeal</button>}
 </article>;
}
