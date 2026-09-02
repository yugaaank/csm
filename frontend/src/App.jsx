import { useEffect, useState } from 'react'

const API = ''
async function jget(p){ const r=await fetch(API+p); if(!r.ok) throw new Error(p); return r.json() }
function fmtTime(iso){ try{ return new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}) }catch{ return iso } }
function fmtDate(iso){ try{ return new Date(iso).toLocaleString() }catch{ return iso } }

function sevBadge(s){
  if(s==='CRITICAL') return 'badge-critical'
  if(s==='HIGH') return 'badge-green'
  if(s==='MEDIUM') return 'badge-green-soft'
  return 'badge-low'
}
function sevTagColor(s){
  if(s==='HIGH') return '#00ED64'
  if(s==='CRITICAL') return '#7B3FF2'
  if(s==='MEDIUM') return '#FA6E39'
  return '#3D4F9F'
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
    await loadAll(); setBusy(false)
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
  const scoreColor = score >= 80 ? 'var(--brand-green)' : score >= 40 ? '#FA6E39' : '#7B3FF2'

  return (
    <>
      <div className="promo">MongoDB-style CSM — Built on Floci local AWS • <a href="#">Read the docs →</a></div>

      <nav className="nav">
        <div className="nav-left">
          <div className="logo"><span className="logo-mark">◈</span> CSM</div>
          <div className="nav-links" style={{marginLeft:12}}>
            <a href="#">Overview</a><a href="#">Events</a><a href="#">Alerts</a><a href="#">Timeline</a>
          </div>
        </div>
        <div className="nav-right">
          <a className="link" href="#">Sign in</a>
          <button className="btn-pill btn-primary" onClick={runSimulate} disabled={busy}>{busy?'Running…':'Try Free — Run Demo'}</button>
        </div>
      </nav>

      <section className="hero-dark">
        <div className="hero-grid">
          <div>
            <div className="hero-kicker">Floci • Cloud Security Operations</div>
            <h1 className="hero-title">One platform.<br/>Total visibility.</h1>
            <p className="hero-sub">Collect every S3 and IAM event from Floci, detect 5 threats with rule-based checks, score risk 0–100 and map to MITRE ATT&CK — all in one MongoDB-inspired operations view.</p>
            <div className="hero-actions">
              <button className="btn-pill btn-primary" onClick={runSimulate} disabled={busy}>{busy?'Running…':'Run Demo Scenario'}</button>
              <button className="btn-secondary-on-dark" onClick={loadAll}>Refresh</button>
            </div>
            <div className="score-pill">
              <span style={{width:10,height:10,borderRadius:999,background:scoreColor,display:'inline-block'}} />
              <span>Security Score <b>{score}/100</b></span>
              <span style={{color:'var(--on-dark-muted)'}}>{overview? `${overview.open_alerts} open • ${overview.total_events} events`:'—'}</span>
            </div>
          </div>

          <div className="code-mockup">
            <div className="code-dots"><i/><i/><i/></div>
            <pre>{`// normalized event → detector → alert
{
  "user": "alice",
  "service": "S3",
  "action": "PutBucketAcl",
  "resource": "csm-public-bucket",
  "source_ip": "127.0.0.1",
  "status": "success"
}
→ HIGH  Public S3 Bucket  85
  T1530 - Data from Cloud Storage
→ MITRE + recommendation`}</pre>
          </div>
        </div>
        <div style={{maxWidth:1280,margin:'40px auto 0',background:'var(--teal)',borderRadius:12,padding:24,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,border:'1px solid var(--hairline-dark)'}}>
          <div><div style={{fontSize:11,letterSpacing:1,textTransform:'uppercase',color:'var(--on-dark-muted)'}}>Total Events</div><div style={{fontSize:28,fontWeight:500,marginTop:6}}>{overview?.total_events ?? '—'}</div></div>
          <div><div style={{fontSize:11,letterSpacing:1,textTransform:'uppercase',color:'var(--on-dark-muted)'}}>Critical</div><div style={{fontSize:28,fontWeight:500,marginTop:6, color:'#fff'}}>{by.CRITICAL ?? 0}</div></div>
          <div><div style={{fontSize:11,letterSpacing:1,textTransform:'uppercase',color:'var(--on-dark-muted)'}}>High</div><div style={{fontSize:28,fontWeight:500,marginTop:6, color:'var(--brand-green)'}}>{by.HIGH ?? 0}</div></div>
          <div><div style={{fontSize:11,letterSpacing:1,textTransform:'uppercase',color:'var(--on-dark-muted)'}}>Medium</div><div style={{fontSize:28,fontWeight:500,marginTop:6}}>{by.MEDIUM ?? 0}</div></div>
        </div>
      </section>

      <section className="section-soft">
        <div className="section-head">
          <div>
            <h2 className="section-title">Monitor every API call.</h2>
            <p className="section-desc">Floci emits S3 and IAM operations. The collector normalizes them, the detector flags 5 patterns, and the dashboard turns them into auditable findings.</p>
          </div>
          <div className="filters">
            <select className="select" value={fService} onChange={e=>setFService(e.target.value)}>
              <option value="">All services</option><option>S3</option><option>IAM</option>
            </select>
            <div className="search-pill"><span style={{color:'var(--stone)'}}>⌕</span><input placeholder="User" value={fUser} onChange={e=>setFUser(e.target.value)} style={{border:0,outline:0}} /></div>
            <div className="search-pill"><span style={{color:'var(--stone)'}}>⌕</span><input placeholder="Action" value={fAction} onChange={e=>setFAction(e.target.value)} style={{border:0,outline:0}} /></div>
          </div>
        </div>

        <div style={{maxWidth:1280,margin:'0 auto',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16, marginBottom:24}}>
          <div className="stat-card featured"><div className="stat-label">Security Score</div><div className="stat-value" style={{color:'var(--brand-green-dark)'}}>{score}/100</div><div className="stat-sub">{overview?.open_alerts ?? 0} open alerts</div></div>
          <div className="stat-card"><div className="stat-label">Total Alerts</div><div className="stat-value">{overview?.total_alerts ?? 0}</div><div className="stat-sub">All severities</div></div>
          <div className="stat-card"><div className="stat-label">Pricing-style tiers</div><div className="stat-value" style={{fontSize:18}}>Free • Flex • Dedicated</div><div className="stat-sub">Inspired by MongoDB 3-tier</div></div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="card-head"><h3>Event stream</h3><span>{filteredEvents.length} events</span></div>
            <div style={{overflow:'auto', maxHeight:520}}>
              <table className="table">
                <thead><tr><th>Time</th><th>User</th><th>Service</th><th>Action</th><th>Resource</th></tr></thead>
                <tbody>
                  {filteredEvents.length===0 && <tr><td colSpan={5} className="empty">No events — run demo</td></tr>}
                  {filteredEvents.map(r=>(
                    <tr key={r.id}>
                      <td className="mono">{fmtTime(r.timestamp)}</td>
                      <td>{r.user}</td>
                      <td><span className="badge badge-green-soft" style={{padding:'2px 8px'}}>{r.service}</span></td>
                      <td>{r.action}</td>
                      <td className="mono" title={r.resource}>{r.resource || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Security alerts</h3><span>{filteredAlerts.length} findings</span></div>
            <div style={{display:'flex',gap:8,padding:'12px 16px',borderBottom:'1px solid var(--hairline-soft)',flexWrap:'wrap'}}>
              <select className="select" style={{minWidth:140,height:36}} value={fSev} onChange={e=>setFSev(e.target.value)}>
                <option value="">All severity</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
              </select>
              <select className="select" style={{minWidth:140,height:36}} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                <option value="">All status</option><option>OPEN</option><option>REVIEWED</option><option>RESOLVED</option>
              </select>
            </div>
            <div className="alerts" style={{maxHeight:520,overflow:'auto'}}>
              {filteredAlerts.length===0 && <div className="empty">No alerts — clean bill of health</div>}
              {filteredAlerts.map(a=>(
                <div key={a.id} className="alert-card" onClick={()=>openDrawer(a.id)}>
                  <div className="alert-top">
                    <span className={`badge ${sevBadge(a.severity)}`}>{a.severity}</span>
                    <span style={{fontSize:12,color:'var(--steel)'}}>{fmtTime(a.created_at)} • {a.status}</span>
                    <span style={{marginLeft:'auto',fontSize:12,fontWeight:600, color:sevTagColor(a.severity)}}>{a.risk_score}/100</span>
                  </div>
                  <h4 className="alert-title">{a.title}</h4>
                  <div className="alert-meta"><span>MITRE <b style={{color:'var(--ink)'}}>{a.mitre_technique||'—'}</b></span></div>
                  <div className="alert-desc">{a.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Event timeline</h2>
            <p className="section-desc">Last 50 events chronological — the audit trail that turns isolated actions into an incident story.</p>
          </div>
          <span className="badge badge-green-soft">Last 50 • live</span>
        </div>
        <div className="card" style={{maxWidth:1280,margin:'0 auto'}}>
          <div className="timeline">
            {timeline.length===0 && <div className="empty">No timeline</div>}
            {timeline.map((r,i)=>(
              <div key={i} className="step">
                <div className="step-when">{fmtTime(r.timestamp)}<br/><b>{r.user}</b></div>
                <div>
                  <div className="step-what">{r.action} <span style={{color:'var(--steel)',fontWeight:400}}>• {r.service}</span></div>
                  <div className="step-res">{r.resource || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-soft" style={{padding:'32px'}}>
        <div style={{maxWidth:1280,margin:'0 auto',background:'var(--teal-deep)',borderRadius:12,padding:32,display:'flex',justifyContent:'space-between',gap:20,alignItems:'center',flexWrap:'wrap'}}>
          <div><div style={{color:'var(--on-dark)',fontSize:22,fontWeight:500}}>Ready to test the pipeline?</div><div style={{color:'var(--on-dark-muted)',fontSize:14,marginTop:6}}>One click creates a public bucket, an admin policy, a new key and a deletion — then watch findings appear.</div></div>
          <button className="btn-pill btn-primary" onClick={runSimulate} disabled={busy}>{busy?'Running…':'Run Demo Again'}</button>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-grid">
          <div><h4>CSM</h4><div style={{color:'var(--on-dark-muted)',fontSize:13,lineHeight:1.6}}>Floci local AWS • Flask • SQLite • MITRE ATT&CK. College project — no auto-remediation, detection only.</div></div>
          <div><h4>Product</h4><a href="#">Overview</a><a href="#">Events</a><a href="#">Alerts</a><a href="#">Timeline</a></div>
          <div><h4>Resources</h4><a href="#">DESIGN.md</a><a href="#">API Docs</a><a href="#">Floci Setup</a></div>
          <div><h4>MongoDB-inspired</h4><div style={{color:'var(--on-dark-muted)',fontSize:13}}>Deep teal hero + green pills • 12px cards • Euclid Circular A</div></div>
        </div>
      </footer>

      <div className={`drawer ${drawer?'':'hidden'}`}>
        <div className="backdrop" onClick={()=>setDrawer(null)} />
        <div className="drawer-panel">
          {drawer && <>
            <div className="drawer-head">
              <button className="close" onClick={()=>setDrawer(null)}>✕</button>
              <span className={`badge ${sevBadge(drawer.severity)}`}>{drawer.severity}</span>
              <h2 style={{margin:'10px 0 0'}}>{drawer.title}</h2>
              <div style={{marginTop:6,fontSize:13,color:'var(--steel)'}}>{fmtDate(drawer.created_at)} • {drawer.status} • {drawer.risk_score}/100</div>
            </div>
            <div style={{padding:20}}>
              <div className="kv"><label>User</label><div className="mono">{drawer.event?.user || '—'}</div></div>
              <div className="kv"><label>Service / Action</label><div className="mono">{drawer.event? `${drawer.event.service} ${drawer.event.action}`:'—'}</div></div>
              <div className="kv"><label>Resource</label><div className="mono" style={{wordBreak:'break-all'}}>{drawer.event?.resource || '—'}</div></div>
              <div className="kv"><label>MITRE</label><div className="mono">{drawer.mitre_technique || '—'}</div></div>
              <div className="kv"><label>Reason</label><div>{drawer.description}</div></div>
              <div className="kv"><label>Recommendation</label><div style={{color:'var(--brand-green-dark)',fontWeight:500}}>{drawer.recommendation}</div></div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}>
                <button className="btn-pill btn-primary" onClick={()=>setStatus(drawer.id,'RESOLVED')}>Mark Resolved</button>
                <button className="btn-secondary" onClick={()=>setStatus(drawer.id,'REVIEWED')}>Reviewed</button>
                <button className="btn-secondary" onClick={()=>setStatus(drawer.id,'OPEN')}>Reopen</button>
              </div>
            </div>
          </>}
        </div>
      </div>
    </>
  )
}
