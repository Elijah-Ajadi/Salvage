import { 
  Recycle, ArrowUpRight, ArrowRight, Camera, Truck, Leaf, ShieldCheck, 
  Sparkles, DollarSign, HeartHandshake, CheckCircle2, MapPin, Clock, Eye 
} from 'lucide-react';
import './landing.css';
import { demoItems } from '@/lib/materials';
import { admin } from '@/lib/supabase/server';

async function getLiveListings() {
  try {
    const db = admin();
    const { data } = await db
      .from('listings')
      .select('id,title,description,category,material,condition,photo,price,status,created_at,lat,lng')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(4);
    return data && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const liveListings = await getLiveListings();
  const displayItems = liveListings || demoItems.slice(0, 4);
  const isLive = !!liveListings;
  return (
    <main className="landing">
      {/* Navigation Topbar */}
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-icon"><Recycle size={27}/></span>
          salvage<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Page navigation">
          <a href="#how-it-works" style={{fontSize:'14px',fontWeight:600,color:'#636e59'}}>How it works</a>
          <a href="#features" style={{fontSize:'14px',fontWeight:600,color:'#636e59'}}>Features</a>
          <a href="/listings" style={{fontSize:'14px',fontWeight:600,color:'#636e59'}}>Browse listings</a>
        </nav>
        <div className="header-actions">
          <a href="/login" style={{fontSize:'14px',fontWeight:600,color:'#525d48',padding:'8px 12px'}}>Log in</a>
          <a className="primary" href="/signup">
            Get started <ArrowUpRight size={18}/>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div>
          <div className="eyebrow" style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'#eaf1e4',color:'#40642a',padding:'6px 14px',borderRadius:'20px',fontSize:'11px',fontWeight:700,letterSpacing:'1.2px',marginBottom:'20px'}}>
            <span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#507b34'}}/>
            THE LOCAL MATERIAL EXCHANGE
          </div>
          <h1 style={{lineHeight:1.08,letterSpacing:'-2.2px',fontWeight:750,color:'#202d18',margin:'0 0 20px'}}>
            Good materials.<br/>Another life.
          </h1>
          <p style={{fontSize:'18px',lineHeight:1.7,color:'#69755f',maxWidth:'520px',margin:'0 0 32px'}}>
            Connect what’s coming out of one renovation with what’s going into the next. Snap a photo, let AI identify the materials, and get reusable supplies to nearby builders or buyers—preventing waste and earning money.
          </p>
          <div className="landing-actions" style={{display:'flex',flexWrap:'wrap',gap:'16px',alignItems:'center',marginBottom:'28px'}}>
            <a className="primary" href="/signup?role=contractor" style={{fontSize:'15px',padding:'15px 26px',borderRadius:'10px',display:'inline-flex',alignItems:'center',gap:'10px'}}>
              <Camera size={20}/> List as Contractor
            </a>
            <a className="landing-secondary" href="/signup?role=buyer" style={{display:'inline-flex',alignItems:'center',gap:'8px',fontWeight:600,fontSize:'15px',color:'#3b5928',padding:'12px 18px',borderRadius:'8px',background:'#f1f5ec'}}>
              Browse as Buyer <ArrowRight size={18}/>
            </a>
          </div>
          <div style={{display:'flex',gap:'22px',flexWrap:'wrap',alignItems:'center',fontSize:'13px',color:'#6b7762'}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
              <Leaf size={16} style={{color:'#4d7334'}}/> 100% Diversion from Landfills
            </span>
            <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
              <Sparkles size={16} style={{color:'#4d7334'}}/> AI Vision Auto-Cataloging
            </span>
            <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
              <ShieldCheck size={16} style={{color:'#4d7334'}}/> Verified Claim Receipts
            </span>
          </div>
        </div>

        <div className="landing-visual">
          <img 
            src="https://images.ctfassets.net/9aljq1ivr2md/6etNgU5eC3vTbqnoguD6S0/26ee68446ef583ddb0c677d437bf18e0/oak-kitchen-cabinets.jpg?bg=transparent&fl=progressive&fm=jpg&h=525&q=50&w=1000" 
            alt="Wood kitchen cabinetry ready for a second life"
            style={{width:'100%',objectFit:'cover',borderRadius:'20px',boxShadow:'0 16px 40px rgba(35,48,22,0.12)',border:'1px solid #dee5d7'}}
          />
          {/* Floating badge */}
          <div className="landing-photo-caption" style={{background:'rgba(255,255,255,0.94)',backdropFilter:'blur(10px)',border:'1px solid #dce4d5',borderRadius:'12px',padding:'14px 18px',boxShadow:'0 8px 24px rgba(0,0,0,0.08)',display:'flex',alignItems:'center',gap:'14px',maxWidth:'320px'}}>
            <div style={{width:'42px',height:'42px',borderRadius:'10px',background:'#eaf2e3',display:'grid',placeItems:'center',color:'#3b5f25',flexShrink:0}}>
              <Sparkles size={22}/>
            </div>
            <div>
              <div style={{fontSize:'13px',fontWeight:700,color:'#23301a'}}>AI Vision Powered</div>
              <div style={{fontSize:'12px',color:'#717d68',lineHeight:1.4}}>Snap a photo on-site. Title, condition, and fair salvage price auto-populated.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Stats Banner */}
      <section style={{maxWidth:'1260px',margin:'0 auto 70px',padding:'0 5%'}}>
        <div className="landing-stats" style={{background:'#2d4122',borderRadius:'16px',color:'#fff',boxShadow:'0 10px 30px rgba(45,65,34,0.15)'}}>
          <div>
            <div style={{fontSize:'36px',fontWeight:800,letterSpacing:'-1px',color:'#d6e8c7'}}>12,400+</div>
            <div style={{fontSize:'14px',color:'#a9bc9a',marginTop:'4px'}}>Tons of building materials diverted</div>
          </div>
          <div>
            <div style={{fontSize:'36px',fontWeight:800,letterSpacing:'-1px',color:'#d6e8c7'}}>$340,000+</div>
            <div style={{fontSize:'14px',color:'#a9bc9a',marginTop:'4px'}}>Saved by DIYers &amp; local restorers</div>
          </div>
          <div>
            <div style={{fontSize:'36px',fontWeight:800,letterSpacing:'-1px',color:'#d6e8c7'}}>30 Seconds</div>
            <div style={{fontSize:'14px',color:'#a9bc9a',marginTop:'4px'}}>Average time to catalog and list</div>
          </div>
          <div>
            <div style={{fontSize:'36px',fontWeight:800,letterSpacing:'-1px',color:'#d6e8c7'}}>100% Safe</div>
            <div style={{fontSize:'14px',color:'#a9bc9a',marginTop:'4px'}}>Verified pickup passes &amp; Stripe protection</div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" style={{maxWidth:'1260px',margin:'0 auto 90px',padding:'0 5%'}}>
        <div style={{textAlign:'center',maxWidth:'640px',margin:'0 auto 50px'}}>
          <div style={{fontSize:'12px',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'#647e52',marginBottom:'10px'}}>How Salvage Works</div>
          <h2 style={{fontSize:'clamp(27px, 4vw, 38px)',fontWeight:750,letterSpacing:'-1px',color:'#202d18',margin:'0 0 16px'}}>A seamless cycle from demolition to creation</h2>
          <p style={{fontSize:'16px',color:'#6b7762',lineHeight:1.7}}>Whether clearing a full job site or sourcing genuine period materials, Salvage takes the friction out of reclamation.</p>
        </div>

        <div className="landing-steps" style={{display:'grid',border:'none',padding:0}}>
          <article style={{background:'#fff',border:'1px solid #e1e7db',borderRadius:'16px',padding:'clamp(22px, 3vw, 36px)',boxShadow:'0 4px 16px rgba(0,0,0,0.03)'}}>
            <div style={{width:'52px',height:'52px',borderRadius:'12px',background:'#edf5e7',color:'#456a2f',display:'grid',placeItems:'center',marginBottom:'20px'}}>
              <Camera size={26}/>
            </div>
            <h3 style={{fontSize:'21px',fontWeight:700,color:'#23301a',margin:'0 0 12px'}}>1. Snap &amp; Auto-Catalog</h3>
            <p style={{fontSize:'15px',color:'#6e7966',lineHeight:1.6,margin:0}}>
              Contractors snap an on-site photo. Gemini vision analyzes materials, grades condition, titles the item, and suggests fair salvage pricing instantly.
            </p>
          </article>

          <article style={{background:'#fff',border:'1px solid #e1e7db',borderRadius:'16px',padding:'36px 30px',boxShadow:'0 4px 16px rgba(0,0,0,0.03)'}}>
            <div style={{width:'52px',height:'52px',borderRadius:'12px',background:'#edf5e7',color:'#456a2f',display:'grid',placeItems:'center',marginBottom:'20px'}}>
              <Truck size={26}/>
            </div>
            <h3 style={{fontSize:'21px',fontWeight:700,color:'#23301a',margin:'0 0 12px'}}>2. Match Nearby Pickups</h3>
            <p style={{fontSize:'15px',color:'#6e7966',lineHeight:1.6,margin:0}}>
              Buyers set a radius and category alerts. Free materials can be claimed in one click, or priced materials purchased with Stripe card checkout.
            </p>
          </article>

          <article style={{background:'#fff',border:'1px solid #e1e7db',borderRadius:'16px',padding:'36px 30px',boxShadow:'0 4px 16px rgba(0,0,0,0.03)'}}>
            <div style={{width:'52px',height:'52px',borderRadius:'12px',background:'#edf5e7',color:'#456a2f',display:'grid',placeItems:'center',marginBottom:'20px'}}>
              <ShieldCheck size={26}/>
            </div>
            <h3 style={{fontSize:'21px',fontWeight:700,color:'#23301a',margin:'0 0 12px'}}>3. Pickup Pass &amp; Payout</h3>
            <p style={{fontSize:'15px',color:'#6e7966',lineHeight:1.6,margin:0}}>
              Buyers receive an instant verified pickup pass with contractor contact &amp; address. Contractors withdraw their earnings directly to their bank.
            </p>
          </article>
        </div>
      </section>

      {/* Featured Live Materials Showcase */}
      <section id="materials" style={{background:'#f3f6ee',borderTop:'1px solid #e2e8dc',borderBottom:'1px solid #e2e8dc',padding:'clamp(40px, 6vw, 80px) 5%'}}>
        <div style={{maxWidth:'1260px',margin:'0 auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'38px',flexWrap:'wrap',gap:'20px'}}>
            <div>
              <div style={{fontSize:'12px',fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',color:'#647e52',marginBottom:'8px'}}>Live Exchange</div>
              <h2 style={{fontSize:'clamp(26px, 4vw, 34px)',fontWeight:750,letterSpacing:'-0.8px',color:'#202d18',margin:0}}>Materials ready for pickup today</h2>
            </div>
            <a href="/listings" style={{display:'inline-flex',alignItems:'center',gap:'8px',fontWeight:700,fontSize:'14px',color:'#3a5b28'}}>
              Browse all listings <ArrowRight size={16}/>
            </a>
          </div>

          {isLive && (
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px',fontSize:'12px',fontWeight:700,color:'#3c6527',background:'#eaf2e3',padding:'7px 14px',borderRadius:'20px',width:'fit-content'}}>
              <span style={{width:'7px',height:'7px',borderRadius:'50%',background:'#4d8030',display:'inline-block'}}/>
              Showing live listings
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:'24px'}}>
            {displayItems.map((item:any) => (
              <div key={item.id} style={{background:'#fff',borderRadius:'14px',overflow:'hidden',border:'1px solid #dce3d5',boxShadow:'0 2px 10px rgba(0,0,0,0.03)',transition:'transform 0.2s,box-shadow 0.2s'}}>
                <div style={{height:'210px',position:'relative',overflow:'hidden'}}>
                  <img src={item.photo} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <span style={{position:'absolute',top:'12px',left:'12px',padding:'5px 10px',borderRadius:'5px',fontSize:'11px',fontWeight:700,boxShadow:'0 2px 6px rgba(0,0,0,0.08)',...(Number(item.price)>0?{background:'#2d4822',color:'#fff'}:{background:'#fff',color:'#365a25'})}}>
                    {item.price && Number(item.price) > 0 ? `$${Number(item.price).toFixed(2)}` : 'FREE PICKUP'}
                  </span>
                </div>
                <div style={{padding:'18px 20px'}}>
                  <div style={{fontSize:'11px',textTransform:'uppercase',letterSpacing:'0.8px',fontWeight:700,color:'#7a8870',marginBottom:'6px'}}>
                    {item.category} · {item.condition} condition
                  </div>
                  <h4 style={{fontSize:'17px',fontWeight:700,color:'#23301a',margin:'0 0 8px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.title}</h4>
                  <p style={{fontSize:'13px',color:'#717e69',lineHeight:1.5,margin:'0 0 16px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</p>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid #edf1e8',paddingTop:'12px'}}>
                    <span style={{fontSize:'12px',color:'#7c8774'}}>{(item as any).owner_name || 'Local contractor'}</span>
                    <a href="/listings" style={{fontSize:'12px',fontWeight:700,color:'#3b5f25',display:'inline-flex',alignItems:'center',gap:'4px'}}>
                      {isLive ? 'View listing' : 'Browse listings'} <ArrowUpRight size={14}/>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!isLive && (
            <p style={{fontSize:'12px',color:'#8c977f',marginTop:'16px',textAlign:'center'}}>
              Showing sample listings &mdash; <a href="/listings" style={{color:'#4a7234',fontWeight:600}}>browse live materials</a>
            </p>
          )}
        </div>
      </section>

      {/* Built For Contractors & Buyers (Dual Value Section) */}
      <section id="features" style={{maxWidth:'1260px',margin:'90px auto',padding:'0 5%'}}>
        <div className="landing-audiences">
          {/* Contractor Column */}
          <div style={{background:'#edf4e7',borderRadius:'20px',padding:'clamp(22px, 4vw, 46px)',border:'1px solid #cadbc0'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#456930',background:'#dfead6',padding:'5px 12px',borderRadius:'20px',marginBottom:'18px'}}>
              FOR CONTRACTORS &amp; DEMOLITION TEAMS
            </div>
            <h3 style={{fontSize:'28px',fontWeight:750,color:'#202d18',letterSpacing:'-0.6px',margin:'0 0 16px'}}>
              Save on dumpster fees.<br/>Earn cash or record donations.
            </h3>
            <p style={{fontSize:'15px',color:'#647259',lineHeight:1.7,margin:'0 0 24px'}}>
              Skip landfill tipping fees. Turn salvage materials from your remodel jobs into an ongoing revenue stream or verified nonprofit tax records.
            </p>
            <ul style={{listStyle:'none',padding:0,margin:'0 0 32px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <li style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'14px',color:'#2d3924'}}>
                <CheckCircle2 size={18} style={{color:'#4d7532'}}/> AI photos automatically generate specs &amp; pricing
              </li>
              <li style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'14px',color:'#2d3924'}}>
                <CheckCircle2 size={18} style={{color:'#4d7532'}}/> Safe payment via Stripe sandbox &amp; bank payouts
              </li>
              <li style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'14px',color:'#2d3924'}}>
                <CheckCircle2 size={18} style={{color:'#4d7532'}}/> Exact address shared only after confirmed pickup
              </li>
              <li style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'14px',color:'#2d3924'}}>
                <CheckCircle2 size={18} style={{color:'#4d7532'}}/> 1-click nonprofit tax donation receipt generator
              </li>
            </ul>
            <a className="primary" href="/signup?role=contractor" style={{padding:'13px 24px'}}>
              Sign up as Contractor <ArrowRight size={17}/>
            </a>
          </div>

          {/* Buyer Column */}
          <div style={{background:'#fff',borderRadius:'20px',padding:'clamp(22px, 4vw, 46px)',border:'1px solid #dbe2d4',boxShadow:'0 4px 20px rgba(0,0,0,0.03)'}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:'6px',fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#3b5c89',background:'#ebf1f9',padding:'5px 12px',borderRadius:'20px',marginBottom:'18px'}}>
              FOR DIYERS, BUILDERS &amp; RESTORERS
            </div>
            <h3 style={{fontSize:'28px',fontWeight:750,color:'#202d18',letterSpacing:'-0.6px',margin:'0 0 16px'}}>
              Quality materials.<br/>Fraction of retail cost.
            </h3>
            <p style={{fontSize:'15px',color:'#647259',lineHeight:1.7,margin:'0 0 24px'}}>
              Find architectural antiques, hardwood cabinetry, vintage lighting, and surplus renovation goods right in your neighborhood.
            </p>
            <ul style={{listStyle:'none',padding:0,margin:'0 0 32px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <li style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'14px',color:'#2d3924'}}>
                <CheckCircle2 size={18} style={{color:'#3b5c89'}}/> Custom notification radius tailored to your zip code
              </li>
              <li style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'14px',color:'#2d3924'}}>
                <CheckCircle2 size={18} style={{color:'#3b5c89'}}/> Free materials available daily with instant claim pass
              </li>
              <li style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'14px',color:'#2d3924'}}>
                <CheckCircle2 size={18} style={{color:'#3b5c89'}}/> Automated official PDF receipts for every purchase
              </li>
              <li style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'14px',color:'#2d3924'}}>
                <CheckCircle2 size={18} style={{color:'#3b5c89'}}/> Direct coordination with vetted licensed contractors
              </li>
            </ul>
            <a className="primary" href="/signup?role=buyer" style={{padding:'13px 24px',background:'#314b22'}}>
              Sign up as Buyer <ArrowRight size={17}/>
            </a>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="landing-cta" style={{maxWidth:'1260px',margin:'0 auto 90px',padding:'0 5%'}}>
        <div style={{background:'linear-gradient(135deg, #37532a 0%, #25391c 100%)',borderRadius:'24px',padding:'clamp(24px, 5vw, 65px)',textAlign:'center',color:'#fff',boxShadow:'0 18px 45px rgba(35,50,25,0.18)'}}>
          <h2 style={{fontSize:'clamp(28px, 4vw, 42px)',fontWeight:800,letterSpacing:'-1.2px',margin:'0 0 16px'}}>
            Ready to give good materials another life?
          </h2>
          <p style={{fontSize:'18px',color:'#d0e1c5',maxWidth:'620px',margin:'0 auto 34px',lineHeight:1.6}}>
            Join contractors, woodworkers, renovators, and homeowners keeping useful building materials working.
          </p>
          <div style={{display:'flex',gap:'16px',justifyContent:'center',flexWrap:'wrap'}}>
            <a className="primary" href="/signup" style={{background:'#ffffff',color:'#273c1d',border:'none',fontSize:'16px',padding:'15px 30px',fontWeight:700}}>
              Create your account <ArrowRight size={18}/>
            </a>
            <a href="/login" style={{background:'rgba(255,255,255,0.12)',color:'#fff',padding:'15px 26px',borderRadius:'8px',fontWeight:600,fontSize:'16px',display:'inline-flex',alignItems:'center',gap:'8px'}}>
              Log in to existing account
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{maxWidth:'1260px',margin:'0 auto',padding:'40px 5% 50px',borderTop:'1px solid #dfe5d8',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'20px'}}>
        <div>
          <span className="footer-brand" style={{fontSize:'24px',fontWeight:800,color:'#3b572a'}}>salvage.</span>
          <p style={{margin:'6px 0 0',fontSize:'13px',color:'#7e8975'}}>The local building materials reclamation exchange.</p>
        </div>
        <div style={{display:'flex',gap:'26px',fontSize:'13px',color:'#64705a'}}>
          <a href="/login">Contractor Portal</a>
          <a href="/login">Buyer Portal</a>
          <a href="/signup">Sign Up</a>
        </div>
        <div style={{fontSize:'12px',color:'#8c9683'}}>
          Good for your project. Better for the planet. <Leaf size={14} style={{display:'inline',verticalAlign:'-2px',color:'#4f7535'}}/>
        </div>
      </footer>
    </main>
  );
}
