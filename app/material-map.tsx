'use client';

import {useEffect,useRef,useState} from 'react';
import type * as Leaflet from 'leaflet';
import {hasCoordinates} from '@/lib/location';
import type {Item} from '@/lib/materials';
import 'leaflet/dist/leaflet.css';
import './material-map.css';

export default function MaterialMap({items,center,onSelect}:{items:Item[];center:{lat:number;lng:number};onSelect:(item:Item)=>void}) {
 const container=useRef<HTMLDivElement>(null);
 const map=useRef<Leaflet.Map|null>(null);
 const library=useRef<typeof Leaflet|null>(null);
 const pins=useRef<Leaflet.LayerGroup|null>(null);
 const tiles=useRef<Leaflet.TileLayer|null>(null);
 const latest=useRef({items,center,onSelect});latest.current={items,center,onSelect};
 const [ready,setReady]=useState(false),[error,setError]=useState('');

 useEffect(()=>{
  let cancelled=false;
  import('leaflet').then(L=>{
   if(cancelled||!container.current)return;
   library.current=L;
   const {center}=latest.current;
   const m=L.map(container.current,{scrollWheelZoom:false}).setView([center.lat,center.lng],11);
   map.current=m;
   tiles.current=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
   }).on('tileerror',()=>setError('Some map tiles could not load. Pins and the listing grid still work.')).addTo(m);
   pins.current=L.layerGroup().addTo(m);
   setReady(true);
  }).catch(()=>setError('The map could not load. You can still select a listing below.'));
  return()=>{cancelled=true;map.current?.remove();map.current=null;pins.current=null;};
 },[]);

 useEffect(()=>{
  const L=library.current,m=map.current,group=pins.current;
  if(!ready||!L||!m||!group)return;
  group.clearLayers();
  L.circleMarker([center.lat,center.lng],{radius:7,color:'#315485',fillOpacity:1}).bindTooltip('Your search location').addTo(group);
  // Group identical approximate coordinates so overlapping listings remain selectable.
  const locations=new Map<string,Item[]>();
  for(const item of items.filter(hasCoordinates)){
   const key=`${item.lat},${item.lng}`;
   locations.set(key,[...(locations.get(key)||[]),item]);
  }
  for(const grouped of locations.values()){
   const item=grouped[0],popup=document.createElement('div');
   popup.className='material-map-popup';
   for(const listing of grouped){
    const button=document.createElement('button');button.type='button';
    button.textContent=`${listing.title} · ${Number(listing.price)>0?'$'+Number(listing.price).toFixed(2):'Free'}${listing.status==='reserved'?' · Reserved':''}`;
    button.addEventListener('click',()=>latest.current.onSelect(listing));popup.append(button);
   }
   const label=grouped.length>1?`${grouped.length} items`:Number(item.price)>0?'$'+Number(item.price).toFixed(2):'Free';
   L.marker([item.lat,item.lng],{title:grouped.map(i=>i.title).join(', '),
    icon:L.divIcon({className:'material-map-pin',html:label,iconSize:[76,34],iconAnchor:[38,34]})
   }).bindPopup(popup).addTo(group);
  }
 },[ready,items,center.lat,center.lng]);

 useEffect(()=>{if(ready)map.current?.setView([center.lat,center.lng],11);},[ready,center.lat,center.lng]);
 function fit(){
  const L=library.current,m=map.current;if(!L||!m)return;
  m.fitBounds(L.latLngBounds([[center.lat,center.lng],...items.filter(hasCoordinates).map(i=>[i.lat,i.lng] as [number,number])]),{padding:[45,45],maxZoom:13});
 }
 return <section className="material-map" aria-label="Map of matching materials">
  <div className="material-map-toolbar"><p>{items.length} matching materials · Select a pin to view listings.</p><button type="button" onClick={fit} disabled={!ready}>Show all results</button></div>
  <div ref={container} className="material-map-canvas" aria-label="Interactive material map"/>
  {!ready&&!error&&<p role="status">Loading map…</p>}
  {error&&<p role="status">{error} {ready&&<button type="button" onClick={()=>{setError('');tiles.current?.redraw();}}>Retry map tiles</button>}</p>}
  <p className="material-map-note">Pins show approximate pickup areas. Search and category filters above update the map and the listings below.</p>
 </section>;
}
