import { useEffect, useState } from 'react'

const API = ''
async function jget(p){ const r=await fetch(API+p); if(!r.ok) throw new Error(p); return r.json() }
function fmtTime(iso){ try{ return new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) }catch{ return iso } }
function fmtDate(iso){ try{ return new Date(iso).toLocaleString() }catch{ return iso } }

function sevBadge(s){
  if(s==='CRITICAL') return 'badge-critical'
  if(s==='HIGH') return 'badge-orange'
  if(s==='MEDIUM') return 'badge-purple'
  return 'badge-paper'
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

  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <div className="logo"><span className="logo-mark">◈</span> CSM</div>
          <div className="nav-links"><a href="#">Overview</a><a href="#">Events</a><a href="#">Alerts</a><a href="#">Timeline</a></div>
        </div>
        <div className="nav-right">
          <a href="#" style={{fontSize:14,color:'var(--ink-muted)',fontWeight:500}}>Sign in</a>
          <button className="btn btn-primary" onClick={runSimulate} disabled={busy}>{busy?'Running-':'Try free'}</button>
        </div>
      </nav>

      <section className="hero-band">
        <div className="stickers"><i/><i/><i/><i/><i/></div>
        <div className="hero-grid">
          <div>
            <div className="eyebrow reveal" style={{color:'var(--sky)'}}>Floci - Cloud Security Operations</div>
            <h1 className="hero-title reveal reveal-1">One platform.<br/>Total visibility.</h1>
            <p className="hero-sub reveal reveal-2">Every S3 and IAM event from Floci, flagged by five rules and mapped to MITRE, in one calm, paper-soft view.</p>
            <div className="reveal reveal-3" style={{marginTop:20, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'}}>
              <button className="btn btn-primary" style={{padding:'12px 22px'}} onClick={runSimulate} disabled={busy}>{busy?'Running-':'Run demo scenario'}</button>
              <span style={{fontSize:13, color:'rgba(255,255,255,0.6)'}}>No install - Local AWS - 8s poll</span>
            </div>
            <div className="score-pill reveal reveal-4">
              <span style={{width:8,height:8,borderRadius:999,background: score>=80?'var(--green)':score>=40?'var(--orange)':'var(--pink)',display:'inline-block'}} />
              <span>Security Score <b>{score}/100</b></span>
              <span style={{color:'rgba(255,255,255,0.6)'}}>{overview? `${overview.open_alerts} open - ${overview.total_events} events` : '-'}</span>
              <button onClick={loadAll} style={{marginLeft:6,background:'transparent',border:0,color:'rgba(255,255,255,0.6)',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>Refresh</button>
            </div>
          </div>

          <div className="code-card reveal reveal-3">
            <div className="code-dots"><i/><i/><i/></div>
            <pre>{`// normalized event -> detector -> alert
{
  "user": "alice",
  "service": "S3",
  "action": "PutBucketAcl",
  "resource": "csm-public-bucket"
}
- HIGH  Public S3 Bucket  85
  T1530 - Data from Cloud Storage`}</pre>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="stats">
          <div className="stat-card"><div className="stat-label">Total Events</div><div className="stat-value">{overview?.total_events ?? '-'}</div><div className="stat-sub">Collected from Floci</div></div>
          <div className="stat-card"><div className="stat-label">Critical</div><div className="stat-value">{by.CRITICAL ?? 0}</div><div className="stat-sub" style={{color:'var(--pink)'}}>Immediate action</div></div>
          <div className="stat-card"><div className="stat-label">High</div><div className="stat-value" style={{color:'var(--orange)'}}>{by.HIGH ?? 0}</div><div className="stat-sub">Requires review</div></div>
          <div className="stat-card"><div className="stat-label">Medium</div><div className="stat-value">{by.MEDIUM ?? 0}</div><div className="stat-sub">Monitor</div></div>
        </div>

        <div className="section-head">
          <div>
            <div className="eyebrow">Monitoring</div>
            <h2 className="section-title">Monitor every API call.</h2>
            <p className="section-desc">Floci emits S3 and IAM operations. The collector normalizes them, the detector flags five patterns, and the dashboard turns them into auditable findings.</p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <select className="select" value={fService} onChange={e=>setFService(e.target.value)}>
              <option value="">All services</option><option>S3</option><option>IAM</option>
            </select>
            <div className="search"><input className="input" placeholder="User" value={fUser} onChange={e=>setFUser(e.target.value)} /></div>
            <div className="search"><input className="input" placeholder="Action" value={fAction} onChange={e=>setFAction(e.target.value)} /></div>
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <div className="card-head"><h3>Event stream</h3><span>{filteredEvents.length} events</span></div>
            <div style={{overflow:'auto', maxHeight:520}}>
              <table className="table">
                <thead><tr><th>Time</th><th>User</th><th>Service</th><th>Action</th><th>Resource</th></tr></thead>
                <tbody>
                  {filteredEvents.length===0 && <tr><td colSpan={5} className="empty">No events - run demo</td></tr>}
                  {filteredEvents.map(r=>(
                    <tr key={r.id}>
                      <td className="mono">{fmtTime(r.timestamp)}</td>
                      <td>{r.user}</td>
                      <td><span className="badge badge-paper">{r.service}</span></td>
                      <td>{r.action}</td>
                      <td className="mono" title={r.resource}>{r.resource || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Security alerts</h3><span>{filteredAlerts.length} findings</span></div>
            <div style={{display:'flex',gap:8,padding:'12px 16px',borderBottom:'1px solid var(--hairline)',flexWrap:'wrap'}}>
              <select className="select" style={{minWidth:140,height:32}} value={fSev} onChange={e=>setFSev(e.target.value)}>
                <option value="">All severity</option><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option>
              </select>
              <select className="select" style={{minWidth:140,height:32}} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                <option value="">All status</option><option>OPEN</option><option>REVIEWED</option><option>RESOLVED</option>
              </select>
            </div>
            <div className="alerts" style={{maxHeight:520,overflow:'auto'}}>
              {filteredAlerts.length===0 && <div className="empty">No alerts - clean bill of health</div>}
              {filteredAlerts.map(a=>(
                <div key={a.id} className="alert-card" onClick={()=>openDrawer(a.id)}>
                  <div className="alert-top">
                    <span className={`badge ${sevBadge(a.severity)}`}>{a.severity}</span>
                    <span style={{fontSize:12,color:'var(--ink-muted)'}}>{fmtTime(a.created_at)} - {a.status}</span>
                    <span style={{marginLeft:'auto',fontSize:12,fontWeight:600}}>{a.risk_score}/100</span>
                  </div>
                  <h4 className="alert-title">{a.title}</h4>
                  <div className="alert-meta"><span>MITRE <b style={{color:'var(--ink)'}}>{a.mitre_technique||'-'}</b></span></div>
                  <div className="alert-desc">{a.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-white">
        <div className="section-head">
          <div>
            <div className="eyebrow">Audit trail</div>
            <h2 className="section-title">Event timeline</h2>
            <p className="section-desc">Last 50 events chronological - the story that turns isolated actions into an incident.</p>
          </div>
          <span className="badge badge-paper">Last 50 - live</span>
        </div>
        <div className="card" style={{maxWidth:1280,margin:'0 auto'}}>
          <div className="timeline">
            {timeline.length===0 && <div className="empty">No timeline</div>}
            {timeline.map((r,i)=>(
              <div key={i} className="step">
                <div className="step-when">{fmtTime(r.timestamp)}<br/><b>{r.user}</b></div>
                <div>
                  <div className="step-what">{r.action} <span style={{color:'var(--ink-muted)',fontWeight:400}}>- {r.service}</span></div>
                  <div className="step-res">{r.resource || '-'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{paddingTop:0}}>
        <div style={{maxWidth:1280,margin:'0 auto',background:'var(--ink)',borderRadius:12,padding:24,display:'flex',justifyContent:'space-between',gap:20,alignItems:'center',flexWrap:'wrap'}}>
          <div><div style={{color:'white',fontSize:18,fontWeight:600}}>Ready to test the pipeline?</div><div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>One click creates a public bucket, an admin policy, a new key and a deletion.</div></div>
          <button className="btn btn-primary" onClick={runSimulate} disabled={busy}>{busy?'Running-':'Run demo again'}</button>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-grid">
          <div><h4>CSM</h4><div style={{color:'var(--ink-muted)',fontSize:13,lineHeight:1.5}}>Floci local AWS - Flask - SQLite - MITRE ATT&CK. College project - detection only.</div></div>
          <div><h4>Product</h4><a href="#">Overview</a><a href="#">Events</a><a href="#">Alerts</a><a href="#">Timeline</a></div>
          <div><h4>Resources</h4><a href="#">DESIGN.md</a><a href="#">API Docs</a><a href="#">Floci Setup</a></div>
          <div><h4>Notion-inspired</h4><div style={{color:'var(--ink-muted)',fontSize:13}}>Paper canvas #F6F5F4 - Inter tight tracking - blue pill #0075DE</div></div>
        </div>
      </footer>

      <div className={`drawer ${drawer?'':'hidden'}`}>
        <div className="backdrop" onClick={()=>setDrawer(null)} />
        <div className="drawer-panel">
          {drawer && <>
            <div className="drawer-head">
              <button className="close" onClick={()=>setDrawer(null)}>x</button>
              <span className={`badge ${sevBadge(drawer.severity)}`}>{drawer.severity}</span>
              <h2 style={{margin:'10px 0 0'}}>{drawer.title}</h2>
              <div style={{marginTop:6,fontSize:13,color:'var(--ink-muted)'}}>{fmtDate(drawer.created_at)} - {drawer.status} - {drawer.risk_score}/100</div>
            </div>
            <div style={{padding:20}}>
              <div className="kv"><label>User</label><div className="mono">{drawer.event?.user || '-'}</div></div>
              <div className="kv"><label>Service / Action</label><div className="mono">{drawer.event? `${drawer.event.service} ${drawer.event.action}`:'-'}</div></div>
              <div className="kv"><label>Resource</label><div className="mono" style={{wordBreak:'break-all'}}>{drawer.event?.resource || '-'}</div></div>
              <div className="kv"><label>MITRE</label><div className="mono">{drawer.mitre_technique || '-'}</div></div>
              <div className="kv"><label>Reason</label><div>{drawer.description}</div></div>
              <div className="kv"><label>Recommendation</label><div style={{color:'var(--primary)',fontWeight:500}}>{drawer.recommendation}</div></div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}>
                <button className="btn btn-primary" onClick={()=>setStatus(drawer.id,'RESOLVED')}>Mark Resolved</button>
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
