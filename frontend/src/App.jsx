import { useEffect, useState } from 'react'

const API = ''

async function jget(p){ const r=await fetch(API+p); if(!r.ok) throw new Error(p); return r.json() }

function fmtTime(iso){
  try{ return new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}) }catch{ return iso }
}
function fmtDate(iso){
  try{ return new Date(iso).toLocaleString() }catch{ return iso }
}

export default function App(){
  const [overview,setOverview]=useState(null)
  const [events,setEvents]=useState([])
  const [alerts,setAlerts]=useState([])
  const [timeline,setTimeline]=useState([])
  const [drawer,setDrawer]=useState(null)
  const [busy,setBusy]=useState(false)

  const [fService,setFService]=useState('')
  const [fUser,setFUser]=useState('')
  const [fAction,setFAction]=useState('')
  const [fSev,setFSev]=useState('')
  const [fStatus,setFStatus]=useState('')

  async function loadAll(){
    try{
      const [o,e,a,t]=await Promise.all([
        jget('/api/overview'),
        jget('/api/events?limit=100'),
        jget('/api/alerts'),
        jget('/api/timeline'),
      ])
      setOverview(o); setEvents(e); setAlerts(a); setTimeline(t)
    }catch(e){ console.error(e) }
  }
  useEffect(()=>{ loadAll(); const id=setInterval(loadAll,8000); return ()=>clearInterval(id) },[])

  async function runSimulate(){
    setBusy(true)
    try{ await fetch(API+'/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:'alice'})}) }catch{}
    await loadAll()
    setBusy(false)
  }
  async function openDrawer(id){
    const d=await jget('/api/alerts/'+id)
    setDrawer(d)
  }
  async function setStatus(id,status){
    await fetch(API+'/api/alerts/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})})
    if(drawer && drawer.id===id) setDrawer({...drawer,status})
    loadAll()
  }

  // derived filters
  const filteredEvents = events.filter(r=>{
    if(fService && r.service!==fService) return false
    if(fUser && !r.user.toLowerCase().includes(fUser.toLowerCase())) return false
    if(fAction && !r.action.toLowerCase().includes(fAction.toLowerCase())) return false
    return true
  })
  const filteredAlerts = alerts.filter(r=>{
    if(fSev && r.severity!==fSev) return false
    if(fStatus && r.status!==fStatus) return false
    return true
  })

  const score = overview?.security_score ?? 0
  const by = overview?.by_severity || {}

  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <div className="nav-menu">
            <div className="hamburger"><i/><i/><i/></div>
            <span>Menu</span>
          </div>
          <span style={{color:'#313131'}}>|</span>
          <span style={{fontSize:10,letterSpacing:'0.2em',textTransform:'uppercase',color:'#7D7D7D'}}>Floci • Operations</span>
        </div>
        <div className="nav-center">
          <div className="bull">⬢</div>
          <span style={{fontSize:13,letterSpacing:'0.18em',textTransform:'uppercase',fontWeight:700}}>CSM</span>
        </div>
        <div className="nav-right">
          <span style={{fontSize:10,letterSpacing:'0.16em',textTransform:'uppercase',color:'#7D7D7D'}} className="hide-mobile">LIVE</span>
          <span className="live-dot" />
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2"><circle cx="11" cy="11" r="7"/><path d="M20 20L16 16"/></svg>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-media" />
        <div className="hero-inner">
          <div className="kicker">Floci <b>•</b> Cloud Security <b>•</b> Operations Monitor</div>
          <h1 className="display">Cloud<br/>Security<br/><span className="gold">Monitor</span></h1>
          <p className="sub">Jet-black security operations. Five rule-based detections. MITRE ATT&CK mapping. Every Floci event becomes a finding — exposed in absolute black with Lamborghini Gold as the only warning.</p>
          <div className="hero-actions">
            <button className="btn-gold" onClick={runSimulate} disabled={busy}>{busy?'Running…':'Run Demo Scenario'}</button>
            <button className="btn-ghost" onClick={loadAll}>Refresh</button>
          </div>
          <div className="score-wrap" style={{marginTop:32, minWidth:320, maxWidth:420, width:'100%'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,letterSpacing:'0.18em',textTransform:'uppercase',color:'#7D7D7D'}}>
              <span>Security Score</span><span style={{color:'#fff',fontWeight:700}}>{score}/100</span>
            </div>
            <div className="score-bar"><div className="score-fill" style={{width: score+'%'}}/></div>
            <div className="score-label">{overview? `${overview.open_alerts} open alerts • ${overview.total_events} events` : '—'}</div>
          </div>
        </div>
        <div className="hero-metrics">
          <div className="metric">
            <div><div className="metric-label">Total<br/>Events</div><div className="metric-sub">{overview?.total_events ?? '—'} collected</div></div>
            <div className="metric-value">{overview?.total_events ?? '—'}</div>
          </div>
          <div className="metric">
            <div><div className="metric-label">Critical<br/>Alerts</div><div className="metric-sub" style={{color:'#ff3b3b'}}>Immediate action</div></div>
            <div className="metric-value critical">{by.CRITICAL ?? 0}</div>
          </div>
          <div className="metric">
            <div><div className="metric-label">High<br/>Alerts</div><div className="metric-sub">Requires review</div></div>
            <div className="metric-value high">{by.HIGH ?? 0}</div>
          </div>
          <div className="metric">
            <div><div className="metric-label">Medium<br/>Alerts</div><div className="metric-sub">Monitor</div></div>
            <div className="metric-value">{by.MEDIUM ?? 0}</div>
          </div>
        </div>
        <button className="hex-pause" aria-label="pause"><span/></button>
        <div className="progress"><i style={{width: score+'%'}}/></div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Recent<br/><em>Activity</em></h2>
            <p className="section-desc">Every S3 and IAM operation from Floci, normalized to a single event stream. Darkness is the canvas — activity is the light.</p>
          </div>
          <div className="filters">
            <select className="select" value={fService} onChange={e=>setFService(e.target.value)}>
              <option value="">All Services</option><option>S3</option><option>IAM</option>
            </select>
            <input className="input" placeholder="User" value={fUser} onChange={e=>setFUser(e.target.value)} />
            <input className="input" placeholder="Action" value={fAction} onChange={e=>setFAction(e.target.value)} />
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="card-head"><h3>Event Stream</h3><span>{filteredEvents.length} events</span></div>
            <div style={{overflow:'auto', maxHeight:520}}>
              <table className="table">
                <thead><tr><th>Time</th><th>User</th><th>Service</th><th>Action</th><th>Resource</th></tr></thead>
                <tbody>
                  {filteredEvents.length===0 && <tr><td colSpan={5} className="empty">No events</td></tr>}
                  {filteredEvents.map(r=>(
                    <tr key={r.id}>
                      <td className="mono">{fmtTime(r.timestamp)}</td>
                      <td>{r.user}</td>
                      <td>{r.service}</td>
                      <td>{r.action}</td>
                      <td className="mono" title={r.resource}>{r.resource || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Security Alerts</h3><span>{filteredAlerts.length} findings</span></div>
            <div style={{display:'flex',gap:8,padding:'12px 18px',borderBottom:'1px solid #1e1e1e',flexWrap:'wrap'}}>
              <select className="select" style={{minWidth:140}} value={fSev} onChange={e=>setFSev(e.target.value)}>
                <option value="">All Severity</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
              </select>
              <select className="select" style={{minWidth:140}} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                <option value="">All Status</option><option>OPEN</option><option>REVIEWED</option><option>RESOLVED</option>
              </select>
            </div>
            <div className="alerts" style={{maxHeight:520,overflow:'auto'}}>
              {filteredAlerts.length===0 && <div className="empty">No alerts</div>}
              {filteredAlerts.map(a=>(
                <div key={a.id} className="alert" onClick={()=>openDrawer(a.id)}>
                  <div className="alert-top">
                    <span className={`badge badge-${a.severity}`}>{a.severity}</span>
                    <span style={{fontSize:10,letterSpacing:'0.14em',textTransform:'uppercase',color:'#7D7D7D'}}>{fmtTime(a.created_at)} • {a.status}</span>
                    <span style={{marginLeft:'auto',fontFamily:'JetBrains Mono',fontSize:10, color:'#7D7D7D'}}>{a.risk_score}/100</span>
                  </div>
                  <h3 className="alert-title">{a.title}</h3>
                  <div className="alert-meta"><span>MITRE <b>{a.mitre_technique||'—'}</b></span></div>
                  <div className="alert-desc">{a.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{background:'#080808'}}>
        <div className="section-head">
          <h2 className="section-title">Event<br/><em>Timeline</em></h2>
          <span style={{fontSize:10,letterSpacing:'0.18em',textTransform:'uppercase',color:'#7D7D7D'}}>Last 50 — chronological</span>
        </div>
        <div className="card">
          <div className="timeline">
            {timeline.length===0 && <div className="empty" style={{padding:18}}>No timeline</div>}
            {timeline.map((r,i)=>(
              <div key={i} className="step">
                <div className="step-when">{fmtTime(r.timestamp)} <b>{r.user}</b></div>
                <div>
                  <div className="step-what">{r.action} <span style={{color:'#7D7D7D',fontWeight:400}}>• {r.service}</span></div>
                  <div className="step-res">{r.resource || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{padding:'32px',borderTop:'1px solid #202020',background:'#080808',display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:16,fontSize:10,letterSpacing:'0.16em',textTransform:'uppercase',color:'#7D7D7D'}}>
        <span>CSM • Floci AWS • Flask • SQLite • MITRE ATT&CK</span>
        <span style={{color:'#FFC000'}}>Lamborghini Design System — Absolute Black + Gold</span>
      </footer>

      <div className={`drawer ${drawer?'':'hidden'}`}>
        <div className="backdrop" onClick={()=>setDrawer(null)} />
        <div className="drawer-panel">
          {drawer && <>
            <div className="drawer-head">
              <button className="close" onClick={()=>setDrawer(null)}>✕</button>
              <span className={`badge badge-${drawer.severity}`}>{drawer.severity}</span>
              <h2>{drawer.title}</h2>
              <div style={{marginTop:8,fontSize:11,color:'#7D7D7D'}}>{fmtDate(drawer.created_at)} • {drawer.status} • {drawer.risk_score}/100</div>
            </div>
            <div className="drawer-body">
              <div className="kv"><label>User</label><div className="mono">{drawer.event?.user || '—'}</div></div>
              <div className="kv"><label>Service / Action</label><div className="mono">{drawer.event? `${drawer.event.service} ${drawer.event.action}`:'—'}</div></div>
              <div className="kv"><label>Resource</label><div className="mono" style={{wordBreak:'break-all'}}>{drawer.event?.resource || '—'}</div></div>
              <div className="kv"><label>MITRE</label><div className="mono">{drawer.mitre_technique || '—'}</div></div>
              <div className="kv"><label>Reason</label><div>{drawer.description}</div></div>
              <div className="kv"><label>Recommendation</label><div style={{color:'#FFCE3E'}}>{drawer.recommendation}</div></div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                <button className="btn-gold" style={{padding:'12px 18px',fontSize:12}} onClick={()=>setStatus(drawer.id,'RESOLVED')}>Mark Resolved</button>
                <button className="btn-ghost" onClick={()=>setStatus(drawer.id,'REVIEWED')}>Reviewed</button>
                <button className="btn-ghost" onClick={()=>setStatus(drawer.id,'OPEN')}>Reopen</button>
              </div>
            </div>
          </>}
        </div>
      </div>
    </>
  )
}
