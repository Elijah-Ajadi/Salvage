'use client';

import {useState} from 'react';
import {Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export default function DeleteListing({id,title,onDeleted}:{id:string;title:string;onDeleted:()=>void}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function remove(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/salvage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Could not delete the listing.');
   setOpen(false);onDeleted();
  }catch(e){setError(e instanceof Error?e.message:'Could not delete the listing.');}finally{setBusy(false);}
 }
 return <>
  <button className="pickup-secondary full" onClick={()=>{setError('');setOpen(true);}}><Trash2 size={18}/> Delete listing</button>
  <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}>
   <DialogContent className="salvage-modal">
    <DialogTitle>Delete this listing?</DialogTitle>
    <DialogDescription>“{title}” will be removed from the marketplace and your listings. Reserved or claimed items cannot be deleted.</DialogDescription>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <div className="pickup-buttons">
     <button className="pickup-secondary" disabled={busy} onClick={()=>setOpen(false)}>Keep listing</button>
     <button className="primary" disabled={busy} onClick={remove}>{busy?'Deleting…':'Delete listing'}</button>
    </div>
   </DialogContent>
  </Dialog>
 </>;
}
