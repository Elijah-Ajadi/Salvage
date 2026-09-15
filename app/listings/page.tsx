'use client';
import { useEffect, useState, useRef } from 'react';
import {
  Recycle, Search, ArrowUpRight, ArrowRight, SlidersHorizontal,
  Leaf, Clock, Sparkles, X, Tag, Check, LogIn, Package
} from 'lucide-react';
import {hasCoordinates} from '@/lib/location';
import { categories } from '@/lib/materials';

type Item = {
  id: string;
  title: string;
  description: string;
  category: string;
  material: string;
  condition: string;
  photo: string;
  price?: number;
  status: string;
  created_at: number;
  lat?: number;
  lng?: number;
  owner_name?: string;
};

const conditionColors: Record<string, { bg: string; color: string }> = {
  Excellent: { bg: '#edf3e8', color: '#3e6b30' },
  Good: { bg: '#f0f4e8', color: '#506437' },
  Fair: { bg: '#fef9eb', color: '#7a6120' },
  Poor: { bg: '#fdf0ec', color: '#8a3a2d' },
};

export default function ListingsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [locationText,setLocationText]=useState('');
  const [visitorLocation,setVisitorLocation]=useState<{lat:number;lng:number}|null>(null);
  const [locationLabel,setLocationLabel]=useState('');
  const [loadError,setLoadError]=useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All materials');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [sort, setSort] = useState<'newest' | 'price-low' | 'price-high'>('newest');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(0);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 6000);
  }

  useEffect(() => {
    document.title = 'Browse Salvage Materials | salvage.';
  }, []);

  useEffect(() => {
    let active=true;
    async function refresh(){
      try{
        const query=visitorLocation?'?lat='+visitorLocation.lat+'&lng='+visitorLocation.lng:'';
        const r=await fetch('/api/salvage'+query);const d=await r.json();
        if(!r.ok)throw Error(d.error||'Could not load listings.');
        if(!active)return;
        setItems(d.items||[]);setIsLoggedIn(!!d.profile);setLoadError('');
        if(d.profile)setLocationLabel(hasCoordinates(d.profile)?d.profile.address:'Set your location in your dashboard');
      }catch(e:any){if(active)setLoadError(e.message);}finally{if(active)setLoading(false);}
    }
    refresh();const timer=setInterval(refresh,15000);
    return()=>{active=false;clearInterval(timer);};
  },[visitorLocation]);

  async function findLocation(e:React.FormEvent){
    e.preventDefault();setBusy(true);
    try{const r=await fetch('/api/location?q='+encodeURIComponent(locationText));const d=await r.json();if(!r.ok)throw Error(d.error);setVisitorLocation(d);setLocationLabel(locationText);}catch(e:any){notify(e.message);}finally{setBusy(false);}
  }

  useEffect(() => {
    let count = 0;
    if (category !== 'All materials') count++;
    if (priceFilter !== 'all') count++;
    setFiltersApplied(count);
  }, [category, priceFilter]);

  async function handleClaim(item: Item) {
    if (!isLoggedIn) {
      window.location.href = `/login?next=/listings`;
      return;
    }
    window.location.href='/buyer?item='+encodeURIComponent(item.id);
  }

  const available = items.filter(i => i.status === 'available'||i.status==='reserved');

  const filtered = available
    .filter(i => category === 'All materials' || i.category === category)
    .filter(i => {
      if (priceFilter === 'free') return !i.price || Number(i.price) === 0;
      if (priceFilter === 'paid') return Number(i.price) > 0;
      return true;
    })
    .filter(i => {
      const q = search.toLowerCase();
      return !q || `${i.title} ${i.material} ${i.description} ${i.category}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'price-low') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sort === 'price-high') return (Number(b.price) || 0) - (Number(a.price) || 0);
      return b.created_at - a.created_at;
    });

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8f4', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Top Navigation */}
      <header className="topbar" style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #e2e5db' }}>
        <a className="brand" href="/">
          <span className="brand-icon"><Recycle size={27} /></span>
          salvage<span className="brand-dot">.</span>
        </a>
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center', marginLeft: 'auto' }}>
          <a href="/" style={{ fontSize: '14px', fontWeight: 600, color: '#636e59', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            Home
          </a>
          <a href="/listings" style={{ fontSize: '14px', fontWeight: 700, color: '#3c5c28', borderBottom: '2px solid #4c7034', paddingBottom: '2px' }}>
            Browse listings
          </a>
          {isLoggedIn === false && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: '8px' }}>
              <a href="/login" style={{ fontSize: '14px', fontWeight: 600, color: '#525d48', padding: '8px 12px' }}>Log in</a>
              <a href="/signup" className="primary" style={{ fontSize: '14px', padding: '10px 18px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                Sign up <ArrowUpRight size={16} />
              </a>
            </div>
          )}
          {isLoggedIn === true && (
            <a href="/dashboard" className="primary" style={{ fontSize: '14px', padding: '10px 18px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
              Dashboard <ArrowRight size={16} />
            </a>
          )}
        </nav>
      </header>

      {/* Hero Banner */}
      <div style={{ background: 'linear-gradient(135deg, #2d4122 0%, #3d5a2a 100%)', color: '#fff', padding: 'clamp(28px, 5vw, 52px) 5%' }}>
        <div style={{ maxWidth: '1260px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.12)', padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', marginBottom: '16px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8ccc6a', display: 'inline-block' }} />
            LIVE MATERIAL EXCHANGE
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 12px', lineHeight: 1.1 }}>
            Browse salvage materials near you
          </h1>
          <p style={{ fontSize: '16px', color: '#c0d4af', margin: '0 0 22px', maxWidth: '560px', lineHeight: 1.6 }}>
            Doors, cabinetry, fixtures, tile and more — reclaimed from renovation sites and ready for their next life.
          </p>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#b0c9a0' }}><Leaf size={15} /> Diverted from landfills</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#b0c9a0' }}><Sparkles size={15} /> AI-cataloged listings</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#b0c9a0' }}><Check size={15} /> Pickup reservations</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1260px', margin: '0 auto', padding: 'clamp(24px, 3vw, 40px) 5%' }}>

        <div style={{marginBottom:20}}><p>{locationLabel||'Choose your location to see nearby materials.'} · Listings use each contractor’s selected radius.</p>{isLoggedIn?<a href="/dashboard">Change your location in your dashboard</a>:<form onSubmit={findLocation} style={{display:'flex',gap:12,flexWrap:'wrap'}}><input required aria-label="City or pickup area" placeholder="City or pickup area" value={locationText} onChange={e=>setLocationText(e.target.value)} style={{padding:12,flex:1,minWidth:180}}/><button className="primary" disabled={busy}>Find nearby listings</button></form>}{loadError&&<p role="alert">{loadError}</p>}</div>
        {/* Search + Controls */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '220px' }}>
            <Search size={18} style={{ color: '#92978a' }} />
            <input
              type="search"
              placeholder="Search by material, title, or category…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search listings"
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', padding: '4px', color: '#8a927e' }}>
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: showFilters ? '#466a32' : '#fff',
              color: showFilters ? '#fff' : '#4a5642',
              border: `1px solid ${showFilters ? '#466a32' : '#dce2d4'}`,
              borderRadius: '8px', padding: '0 17px', height: '49px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all .18s'
            }}
            aria-expanded={showFilters}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal size={17} />
            Filters
            {filtersApplied > 0 && (
              <span style={{ background: showFilters ? 'rgba(255,255,255,0.25)' : '#466a32', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
                {filtersApplied}
              </span>
            )}
          </button>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as any)}
            style={{ background: '#fff', border: '1px solid #dce2d4', borderRadius: '8px', padding: '0 14px', height: '49px', fontSize: '14px', color: '#4a5642', fontWeight: 600, cursor: 'pointer' }}
            aria-label="Sort listings"
          >
            <option value="newest">Newest first</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div style={{ background: '#fff', border: '1px solid #dce2d4', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b7560', marginBottom: '10px' }}>Category</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setCategory(cat)} style={{
                    padding: '7px 14px', borderRadius: '7px', border: '1px solid',
                    borderColor: category === cat ? '#466a32' : '#dce2d4',
                    background: category === cat ? '#466a32' : '#fff',
                    color: category === cat ? '#fff' : '#4a5642',
                    fontSize: '13px', fontWeight: category === cat ? 700 : 500, cursor: 'pointer', transition: 'all .15s'
                  }}>{cat}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6b7560', marginBottom: '10px' }}>Price</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {([['all', 'All prices'], ['free', 'Free only'], ['paid', 'Paid only']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setPriceFilter(v)} style={{
                    padding: '7px 16px', borderRadius: '7px', border: '1px solid',
                    borderColor: priceFilter === v ? '#466a32' : '#dce2d4',
                    background: priceFilter === v ? '#466a32' : '#fff',
                    color: priceFilter === v ? '#fff' : '#4a5642',
                    fontSize: '13px', fontWeight: priceFilter === v ? 700 : 500, cursor: 'pointer', transition: 'all .15s'
                  }}>{label}</button>
                ))}
              </div>
            </div>
            {filtersApplied > 0 && (
              <button
                onClick={() => { setCategory('All materials'); setPriceFilter('all'); }}
                style={{ border: 'none', background: 'none', color: '#d04b3c', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '26px' }}
              >
                <X size={15} /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Category quick-pills */}
        <div className="category-row">
          {categories.map(cat => (
            <button key={cat} className={`category${category === cat ? ' active' : ''}`} onClick={() => setCategory(cat)} style={{ flexShrink: 0 }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Results bar */}
        <div className="results-bar">
          <div>
            <h2 style={{ fontSize: '18px' }}>
              {loading ? 'Loading materials…' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''} available`}
            </h2>
            {!loading && (
              <span>
                <span className="live-dot" />
                Live exchange &mdash; updated in real time
              </span>
            )}
          </div>
          {isLoggedIn === false && !loading && (
            <a href="/login?next=/listings" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#edf3e6', color: '#466a32', border: '1px solid #c4d9b5', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700 }}>
              <LogIn size={16} /> Log in to claim
            </a>
          )}
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="material-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: '11px', overflow: 'hidden', border: '1px solid #e2e5db' }}>
                <div style={{ height: '226px', background: 'linear-gradient(90deg, #f0f1eb 25%, #e8ebe3 50%, #f0f1eb 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                <div style={{ padding: '17px 18px' }}>
                  <div style={{ height: '11px', background: '#eef0ea', borderRadius: '6px', marginBottom: '12px', width: '55%' }} />
                  <div style={{ height: '17px', background: '#eef0ea', borderRadius: '6px', marginBottom: '8px' }} />
                  <div style={{ height: '13px', background: '#eef0ea', borderRadius: '6px', width: '75%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 20px' }}>
            <Package size={44} style={{ color: '#a3aa97' }} />
            <h3>No listings found</h3>
            <p>
              {search || category !== 'All materials' || priceFilter !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'No listings reach this location yet. Check your location or come back soon.'}
            </p>
            {(search || category !== 'All materials' || priceFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setCategory('All materials'); setPriceFilter('all'); }} className="primary" style={{ marginTop: '8px' }}>
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="material-grid">
            {filtered.map(item => {
              const price = Number(item.price) || 0;
              const cond = conditionColors[item.condition] || conditionColors.Fair;
              return (
                <div key={item.id} className="material-card">
                  <div className="card-photo">
                    <img src={item.photo} alt={item.title} loading="lazy" />
                    {price === 0 ? (
                      <span className="free-badge">FREE PICKUP</span>
                    ) : (
                      <span className="free-badge card-price-badge">${price.toFixed(2)}</span>
                    )}
                    <span className="photo-arrow"><ArrowUpRight size={15} /></span>
                  </div>
                  <div className="card-body">
                    <div className="card-kicker">
                      <span>{item.category}</span>
                      <span className={`condition${item.condition === 'Excellent' ? ' excellent' : ''}`} style={{ background: cond.bg, color: cond.color }}>
                        <i />{item.condition}
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="card-meta">
                      <span><Tag size={12} />{item.material}</span>
                      <span><Clock size={12} />{item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent'}</span>
                    </div>
                  </div>
                  <div className="card-bottom" style={{ padding: '12px 18px' }}>
                    <span>
                      <span className="mini-avatar">{(item.owner_name || 'LC').split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()}</span>
                      {item.owner_name || 'Local Contractor'}
                    </span>
                    <button
                      className="primary"
                      style={{ padding: '8px 14px', fontSize: '12px', minHeight: '36px', borderRadius: '7px' }}
                      disabled={busy}
                      onClick={() => handleClaim(item)}
                    >
                      {isLoggedIn === false
                        ? <><LogIn size={13} /> Log in to {price > 0 ? 'buy' : 'claim'}</>
                        : <>{item.status==='reserved'?'View reservation':price > 0 ? `Reserve $${price.toFixed(2)}` : 'Reserve free'} <ArrowUpRight size={13} /></>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Auth nudge for logged-out users */}
        {isLoggedIn === false && !loading && filtered.length > 0 && (
          <div style={{
            margin: '48px auto 0', maxWidth: '680px',
            background: 'linear-gradient(135deg, #2d4122 0%, #3d5a2a 100%)',
            borderRadius: '18px', padding: 'clamp(24px, 4vw, 44px)',
            textAlign: 'center', color: '#fff',
            boxShadow: '0 12px 36px rgba(35,55,22,0.16)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.2px', color: '#a8c98e', marginBottom: '12px' }}>READY TO CLAIM?</div>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 12px' }}>
              Sign up to claim or purchase materials
            </h2>
            <p style={{ fontSize: '15px', color: '#c0d4af', margin: '0 0 24px', lineHeight: 1.6 }}>
              Create a free buyer account to claim items, manage pickup receipts, and track your pickups.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/signup?role=buyer" className="primary" style={{ background: '#fff', color: '#2d4122', border: 'none', fontWeight: 700, fontSize: '15px', padding: '13px 24px' }}>
                Create buyer account <ArrowRight size={17} />
              </a>
              <a href="/login?next=/listings" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', padding: '13px 22px', borderRadius: '8px', fontWeight: 600, fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <LogIn size={17} /> Log in
              </a>
            </div>
          </div>
        )}

        <div style={{ paddingBottom: '64px' }} />
      </div>

      {toast && (
        <div className="toast">
          <span>{toast}</span>
          <button onClick={() => setToast('')}><X size={18} /></button>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%  { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
