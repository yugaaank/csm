const $ = s => document.querySelector(s);
const scoreEl = $("#score"), fillEl = $("#score-fill"), metaEl=$("#score-meta");
const stE=$("#st-total-events"), stA=$("#st-total-alerts"), stC=$("#st-crit"), stH=$("#st-high"), stM=$("#st-med");

async function jget(p){ const r=await fetch(p); return r.json(); }

function sevColor(score){
  if(score>=90) return "#ff3b3b";
  if(score>=70) return "#ff8c2a";
  if(score>=40) return "#ffcc2a";
  return "#00d084";
}

async function loadOverview(){
  const o = await jget("/api/overview");
  scoreEl.textContent = o.security_score + "/100";
  fillEl.style.width = o.security_score + "%";
  fillEl.style.background = sevColor(o.security_score);
  metaEl.textContent = o.open_alerts + " open alerts · " + o.total_events + " events";
  stE.textContent = o.total_events;
  stA.textContent = o.total_alerts;
  stC.textContent = o.by_severity.CRITICAL || 0;
  stH.textContent = o.by_severity.HIGH || 0;
  stM.textContent = o.by_severity.MEDIUM || 0;
}

async function loadEvents(){
  const svc=$("#f-service").value, user=$("#f-user").value.trim(), act=$("#f-action").value.trim();
  const q=new URLSearchParams(); if(svc) q.set("service",svc); if(user) q.set("user",user); if(act) q.set("action",act);
  const rows=await jget("/api/events?"+q.toString());
  const tbody=$("#tbl-events tbody"); tbody.innerHTML="";
  rows.forEach(r=>{
    const tr=document.createElement("tr");
    const t = new Date(r.timestamp).toLocaleTimeString();
    tr.innerHTML=`<td class="mono">${t}</td><td>${r.user}</td><td>${r.service}</td><td>${r.action}</td><td class="mono" title="${r.resource}">${r.resource||"-"}</td>`;
    tbody.appendChild(tr);
  });
}

async function loadAlerts(){
  const sev=$("#f-sev").value, status=$("#f-status").value, date=$("#f-date").value;
  const q=new URLSearchParams(); if(sev) q.set("severity",sev); if(status) q.set("status",status); if(date) q.set("date",date);
  const rows=await jget("/api/alerts?"+q.toString());
  const box=$("#alerts"); box.innerHTML="";
  if(!rows.length){ box.innerHTML='<div class="hint" style="padding:12px">No alerts</div>'; return; }
  rows.forEach(a=>{
    const d=document.createElement("div"); d.className="alert";
    const t=new Date(a.created_at).toLocaleString();
    d.innerHTML=`<span class="badge ${a.severity}">${a.severity}</span>
      <h3>${a.title}</h3>
      <div class="meta"><span>${t}</span><span class="mono">${a.mitre_technique||""}</span><span>Score ${a.risk_score}/100</span><span>${a.status}</span></div>
      <div style="font-size:12px;color:#cfe0f5;margin-top:6px">${a.description||""}</div>`;
    d.onclick=()=> openDrawer(a.id);
    box.appendChild(d);
  });
}

async function loadTimeline(){
  const rows=await jget("/api/timeline");
  const box=$("#timeline"); box.innerHTML="";
  rows.forEach(r=>{
    const d=document.createElement("div"); d.className="step";
    const t=new Date(r.timestamp).toLocaleTimeString();
    d.innerHTML=`<div class="when mono">${t} · ${r.user}</div><div class="what">${r.action}</div><div class="when mono">${r.service} · ${r.resource||""}</div>`;
    box.appendChild(d);
  });
}

async function openDrawer(id){
  const a=await jget("/api/alerts/"+id);
  const e=a.event||{};
  const body=$("#drawer-body");
  body.innerHTML=`
    <span class="badge ${a.severity}">${a.severity}</span>
    <h2 style="margin:8px 0">${a.title}</h2>
    <div class="kv"><label>User</label><div class="mono">${e.user||a.user||"-"}</div></div>
    <div class="kv"><label>Time</label><div class="mono">${new Date(a.created_at).toLocaleString()}</div></div>
    <div class="kv"><label>Risk Score</label><div><b>${a.risk_score}/100</b> · ${a.severity}</div></div>
    <div class="kv"><label>MITRE</label><div class="mono">${a.mitre_technique||"-"}</div></div>
    <div class="kv"><label>Reason</label><div>${a.description||""}</div></div>
    <div class="kv"><label>Recommendation</label><div>${a.recommendation||""}</div></div>
    <div class="kv"><label>Status</label><div>${a.status}</div></div>
    <div class="kv"><label>Event</label><div class="mono" style="font-size:11px">${e.service||""} ${e.action||""} ${e.resource||""}</div></div>
    <div class="actions-row">
      <button data-s="REVIEWED">Mark REVIEWED</button>
      <button data-s="RESOLVED">Mark RESOLVED</button>
      <button data-s="OPEN" class="ghost">Reopen</button>
    </div>
  `;
  body.querySelectorAll("button[data-s]").forEach(b=> b.onclick=async()=>{
    await fetch("/api/alerts/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:b.dataset.s})});
    openDrawer(id); loadAlerts(); loadOverview();
  });
  $("#drawer").classList.remove("hidden");
}

$("#drawer-close").onclick=()=> $("#drawer").classList.add("hidden");
$("#drawer").onclick=e=>{ if(e.target.id==="drawer") $("#drawer").classList.add("hidden"); };

$("#btn-simulate").onclick=async()=>{
  const b=$("#btn-simulate"); b.disabled=true; b.textContent="Running…";
  await fetch("/api/simulate",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  b.disabled=false; b.textContent="Run Demo Scenario";
  refresh();
};
$("#btn-refresh").onclick=refresh;
$("#f-service").onchange=loadEvents; $("#f-user").oninput=loadEvents; $("#f-action").oninput=loadEvents;
$("#f-sev").onchange=loadAlerts; $("#f-status").onchange=loadAlerts; $("#f-date").onchange=loadAlerts;

async function refresh(){ await Promise.all([loadOverview(), loadEvents(), loadAlerts(), loadTimeline()]); }
refresh(); setInterval(refresh, 8000);
