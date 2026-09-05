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
  const [theme,setTheme]=useState(()=>{
    if(typeof window==='undefined') return 'light'
    const s=localStorage.getItem('csm-theme')
    if(s) return s
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(()=>{ document.documentElement.setAttribute('data-theme',theme); localStorage.setItem('csm-theme',theme) },[theme])

  const [overview,setOverview]=useState(null)
  const [events,setEvents]=useState([])
  const [alerts,setAlerts]=useState([])
  const [timeline,setTimeline]=useState([])
  const [drawer,setDrawer]=useState(null)
  const [busy,setBusy]=useState(false)
  const [mlStatus,setMlStatus]=useState(null)
  const [mlBusy,setMlBusy]=useState(false)
  const [fService,setFService]=useState('')
  const [fUser,setFUser]=useState('')
  const [fAction,setFAction]=useState('')
  const [fSev,setFSev]=useState('')
  const [fStatus,setFStatus]=useState('')
  const [metrics,setMetrics]=useState(null)

  async function loadAll(){
    try{
      const [o,e,a,t,m,met]=await Promise.all([
        jget('/api/overview'),
        jget('/api/events?limit=100'),
        jget('/api/alerts'),
        jget('/api/timeline'),
        jget('/api/ml/status').catch(()=> null),
        jget('/api/metrics').catch(()=> null),
      ])
      setOverview(o); setEvents(e); setAlerts(a); setTimeline(t); if(m) setMlStatus(m); if(met && !met.error) setMetrics(met)
    }catch(e){ console.error(e) }
  }
  useEffect(()=>{ loadAll(); const id=setInterval(loadAll,8000); return ()=>clearInterval(id) },[])

  async function runSimulate(){
    setBusy(true)
    try{ await fetch(API+'/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:'alice'})}) }catch{}
    await loadAll(); setBusy(false)
  }
  async function handleRetrain(){
    setMlBusy(true)
    try{
      const r = await fetch(API+'/api/ml/train',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contamination:0.05})})
      const j = await r.json()
      if(j.status) setMlStatus(j.status)
    }catch(e){ console.error(e) }
    await loadAll(); setMlBusy(false)
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
          <span style={{fontSize:11,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--ink-faint)',marginLeft:12}}>Floci • Cloud Security Monitor</span>
          {mlStatus && (
            <span className={`badge ${mlStatus.ready ? 'badge-teal' : 'badge-paper'}`} style={{marginLeft:10, fontSize:10, letterSpacing:'0.06em'}} title={mlStatus.model_path || ''}>
              {mlStatus.ready ? '◉ ML ready' : '○ ML training needed'}
            </span>
          )}
        </div>
        <div className="nav-right">
          <button className="theme-toggle" aria-label="Toggle theme" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} title={theme==='light'?'Dark mode':'Light mode'}>
            {theme==='light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            )}
          </button>
        </div>
      </nav>

      {/* Hero — Small SVG Texture — No Blur */}
      <section className="hero-blur">
        <div className="hero-blur-bg">
          <div className="hero-texture">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <defs>
                <pattern id="mech-fine" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 H 0 V 32" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.07"/>
                  <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="32 32" dur="20s" repeatCount="indefinite"/>
                </pattern>
                <pattern id="mech-major" width="160" height="160" patternUnits="userSpaceOnUse">
                  <path d="M 160 0 H 0 V 160" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.09"/>
                  <circle cx="80" cy="80" r="0.9" fill="currentColor" opacity="0.18"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mech-fine)" color="var(--ink-faint)"/>
              <rect width="100%" height="100%" fill="url(#mech-major)" color="var(--hairline)"/>
              <g fill="none" stroke="currentColor" opacity="0.11" color="var(--hairline)">
                <line x1="0" y1="50%" x2="100%" y2="50%" strokeDasharray="6 10" strokeWidth="0.6"/>
                <line x1="50%" y1="0" x2="50%" y2="100%" strokeDasharray="6 10" strokeWidth="0.6"/>
              </g>
              <g color="var(--ink-faint)" opacity="0.13">
                <circle cx="50%" cy="50%" r="42" fill="none" stroke="currentColor" strokeWidth="0.7" strokeDasharray="3 5"/>
                <circle cx="50%" cy="50%" r="1.8" fill="currentColor"/>
                {/* mechanical ticks removed — keep center only */}
              </g>
            </svg>
          </div>
        </div>
        <div className="hero-blur-content">
          <div className="hero-kicker reveal">Floci - Cloud Security Operations</div>
          <h1 className="hero-title reveal reveal-1">One platform.<br/>Total visibility.</h1>
          <p className="hero-sub reveal reveal-2">Every S3 and IAM event from Floci, flagged by five rules + ML anomaly detection, mapped to MITRE — one calm view.</p>
          <div className="hero-actions reveal reveal-3">
            <button className="btn btn-primary hero-cta" onClick={runSimulate} disabled={busy}>{busy?'Running-':'Run demo scenario'}</button>
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

        {metrics && (
          <div className="card" style={{maxWidth:1280, margin:'0 auto 20px', padding:'16px 20px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
              <div>
                <div className="eyebrow">Model Evaluation — labeled 500 (400 benign / 100 attack)</div>
                <div style={{fontSize:13, color:'var(--ink-muted)', marginTop:4}}>Rules vs ML vs Combined — higher recall = fewer missed attacks</div>
              </div>
              <button className="btn-secondary" style={{height:32, fontSize:12}} onClick={async()=>{
                const r=await fetch(API+'/api/metrics'); const j=await r.json(); if(!j.error) setMetrics(j);
                // also trigger evaluate via API if needed: POST to train then evaluate
              }}>Refresh metrics</button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginTop:14}}>
              {['rules','ml','combined'].map(k=>{
                const m=metrics[k];
                if(!m) return null;
                const isBest = k==='combined';
                return (
                  <div key={k} style={{border:`1px solid ${isBest?'var(--teal)':'var(--hairline)'}`, borderRadius:8, padding:12, background: isBest?'rgba(42,157,153,0.06)':'var(--surface)'}}>
                    <div style={{fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color: isBest?'var(--teal)':'var(--ink-faint)'}}>{k} {isBest&&'★'}</div>
                    <div style={{marginTop:6, fontSize:13, display:'grid', gap:2}}>
                      <div>Precision <b>{(m.precision*100).toFixed(0)}%</b> <span style={{color:'var(--ink-faint)'}}>• Recall <b>{(m.recall*100).toFixed(0)}%</b></span></div>
                      <div>F1 <b>{(m.f1*100).toFixed(0)}%</b> <span style={{color:'var(--ink-faint)'}}>• Acc {(m.accuracy*100).toFixed(0)}%</span></div>
                      <div style={{fontSize:11, color:'var(--ink-muted)'}}>TP {m.tp} FP {m.fp} FN {m.fn} TN {m.tn}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{marginTop:10, fontSize:11, color:'var(--ink-faint)'}}>Run <code>uv run python scripts/evaluate.py</code> to recompute from <code>data/labeled.json</code> → <code>ml/metrics.json</code>.</div>
          </div>
        )}

        <div className="section-head">
          <div>
            <div className="eyebrow">Monitoring</div>
            <h2 className="section-title">Monitor every API call.</h2>
            <p className="section-desc">Floci emits S3 and IAM operations. The collector normalizes them, five rules + ML anomaly detection flag threats, and the dashboard turns them into auditable findings.</p>
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
              {filteredAlerts.map(a=>{
                const isML = a.title.includes('ML')
                return (
                <div key={a.id} className="alert-card" onClick={()=>openDrawer(a.id)} style={isML ? {borderLeft:'3px solid var(--teal)', background:'rgba(42,157,153,0.04)'} : {}}>
                  <div className="alert-top">
                    <span className={`badge ${sevBadge(a.severity)}`}>{a.severity}</span>
                    {isML && <span className="badge badge-teal" style={{fontSize:10}}>ML</span>}
                    <span style={{fontSize:12,color:'var(--ink-muted)'}}>{fmtTime(a.created_at)} - {a.status}</span>
                    <span style={{marginLeft:'auto',fontSize:12,fontWeight:600}}>{a.risk_score}/100</span>
                  </div>
                  <h4 className="alert-title">{a.title}</h4>
                  <div className="alert-meta"><span>MITRE <b style={{color:'var(--ink)'}}>{a.mitre_technique||'-'}</b></span></div>
                  <div className="alert-desc">{a.description}</div>
                </div>
                )})}
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
        <div className="card" style={{maxWidth:1280,margin:'0 auto',maxHeight:380,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div className="timeline" style={{maxHeight:380,overflowY:'auto'}}>
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

      <footer className="footer">
        <div style={{maxWidth:1280,margin:'0 auto',display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',fontSize:12,color:'var(--ink-muted)'}}>
          <span>CSM • Floci • Flask • SQLite • MITRE ATT&CK</span>
          <span>College project — detection only, no auto-remediation</span>
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
                <button className="btn-secondary" onClick={async()=>{
                  await fetch(API+'/api/alerts/'+drawer.id+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_false_positive:true, reason:'marked via UI'})});
                  setDrawer({...drawer, status:'RESOLVED'});
                  loadAll();
                }} title="Exclude this event from next ML training" style={{borderColor:'var(--teal)', color:'var(--teal)'}}>False Positive</button>
              </div>
              <div style={{marginTop:10, fontSize:11, color:'var(--ink-faint)'}}>False Positive excludes this event from next <code>Retrain ML</code> — feedback loop.</div>
            </div>
          </>}
        </div>
      </div>
    </>
  )
}
