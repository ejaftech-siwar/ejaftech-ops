function visibleEmployees(){
  let emps = isEmployee() ? [state.profile.employeeName] : allEmployees();
  if(isEmployee()) return emps.filter(Boolean);

  // Branch filter: keep only employees whose profile branch matches
  const bf = state.globalBranchFilter || "";
  if(bf){
    const inBranch = new Set([
      ...state.users.filter(u=>(u.branch||"")===bf).map(u=>u.employeeName||u.name),
      ...(state.nametagEmployees||[]).filter(n=>(n.branch||"")===bf).map(n=>n.name),
    ].filter(Boolean));
    emps = emps.filter(e=>inBranch.has(e));
  }
  // Staff-department filter: keep only employees whose profile dept matches
  const edf = state.globalEmpDeptFilter || "";
  if(edf){
    const inDept = new Set([
      ...state.users.filter(u=>(u.userDept||"")===edf).map(u=>u.employeeName||u.name),
      ...(state.nametagEmployees||[]).filter(n=>(n.dept||"")===edf).map(n=>n.name),
    ].filter(Boolean));
    emps = emps.filter(e=>inDept.has(e));
  }
  // Explicit employee multi-select
  const sel = state.globalEmployeeFilter || [];
  if(sel.length > 0) emps = emps.filter(e=>sel.includes(e));

  return emps.filter(Boolean);
}

function summary(){
  const emps = visibleEmployees();
  const depts = deptNames();
  return emps.filter(Boolean).map(emp=>{
    const d=apprFilter(applyReportFilters(state.daily)).filter(r=>r.employee===emp);
    const o=applyReportFilters(state.overtime).filter(r=>r.employee===emp);
    const t=applyReportFilters(state.travel).filter(r=>r.employee===emp);
    const lv=applyReportFilters(state.leaves,"from").filter(r=>r.employee===emp);
    // Build per-department hours object dynamically
    const byDept = {};
    let total = 0;
    depts.forEach(dn => {
      const h = d.filter(r=>r.dept===dn).reduce((s,r)=>s+Number(r.duration||0),0);
      byDept[dn] = h;
      total += h;
    });
    // legacy fields for backwards compatibility
    const ent = byDept["Enterprise"] || 0;
    const sec = byDept["Security"] || 0;
    const eja = byDept["Ejaf"] || 0;
    const ot=o.reduce((s,r)=>s+Number(r.hours||0),0);
    const tDays=t.reduce((s,r)=>s+Number(r.days||0),0);
    const pd=t.reduce((s,r)=>s+Number(r.perDiem||0),0);
    // Leave breakdown — robust calculation handling all kinds
    // Priority: 1) saved days field, 2) saved hours/9, 3) compute from kind
    const leaveDays = lv.reduce((sum, r) => {
      // If days field exists and is valid, use it
      if(r.days !== undefined && r.days !== null && !isNaN(Number(r.days))){
        return sum + Number(r.days);
      }
      // Else if hours field exists, convert
      if(r.hours !== undefined && r.hours !== null && !isNaN(Number(r.hours))){
        return sum + (Number(r.hours) / WORK_HOURS_PER_DAY);
      }
      // Else compute from leave structure
      const amt = computeLeaveAmount(r);
      return sum + amt.days;
    }, 0);
    const leaveBreakdown = {};
    LEAVE_TYPES.forEach(lt => {
      const items = lv.filter(r=>r.type===lt.id);
      leaveBreakdown[lt.id] = items.reduce((sum, r) => {
        if(r.days !== undefined && r.days !== null && !isNaN(Number(r.days))) return sum + Number(r.days);
        if(r.hours !== undefined && r.hours !== null && !isNaN(Number(r.hours))) return sum + (Number(r.hours) / WORK_HOURS_PER_DAY);
        return sum + computeLeaveAmount(r).days;
      }, 0);
    });
    return{emp,byDept,ent,sec,eja,total,ot,tDays,pd,sessions:d.length,leaveDays,leaveBreakdown};
  });
}

function donutSVG(slices,total){
  if(total===0){
    return `<svg class="donut-svg" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="80" fill="none" stroke="#E0E8F0" stroke-width="32"/>
      <text x="100" y="105" text-anchor="middle" font-family="DM Serif Display" font-size="22" fill="#6B7B8F">No Data</text></svg>`;
  }
  const r=80,cx=100,cy=100;
  let cum=-Math.PI/2;
  const segs=slices.filter(s=>s.value>0).map(s=>{
    const a=(s.value/total)*Math.PI*2;
    const x1=cx+r*Math.cos(cum),y1=cy+r*Math.sin(cum);
    cum+=a;
    const x2=cx+r*Math.cos(cum),y2=cy+r*Math.sin(cum);
    const large=a>Math.PI?1:0;
    return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${s.color}" stroke="white" stroke-width="2"/>`;
  }).join("");
  return `<svg class="donut-svg" viewBox="0 0 200 200">${segs}
    <circle cx="${cx}" cy="${cy}" r="48" fill="white"/>
    <text x="100" y="95" text-anchor="middle" font-family="DM Serif Display" font-size="20" fill="#1B3A6B" font-weight="700">${fmtHM(total)}</text>
    <text x="100" y="115" text-anchor="middle" font-family="Inter" font-size="10" fill="#6B7B8F" letter-spacing="1">TOTAL HOURS</text></svg>`;
}

// ═══════════════════════════════════════════════════════════════════════
//  DASHBOARD INTELLIGENCE — v132
//  Turns the dashboard from "what happened" into "what needs me now".
//  Every figure below is clickable and lands on the record behind it.
// ═══════════════════════════════════════════════════════════════════════

// Effective period (falls back to the current month when no range is set)
const _F=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
function _dashRange(){
  const f=getPeriodFrom(), t=getPeriodTo();
  // filterByPeriod() returns EVERYTHING when no range is set, so the KPIs are
  // all-time. Pretending otherwise would make the trend chips lie — instead we
  // flag it unbounded, suppress trends, and spark the last 60 days.
  if(!f && !t){
    const n=appNow(), s=new Date(n); s.setDate(s.getDate()-59);
    return {from:"0000-01-01",to:"9999-12-31",sparkFrom:_F(s),sparkTo:_F(n),unbounded:true};
  }
  const n=appNow();
  return {from:f||"0000-01-01", to:t||_F(n), unbounded:false};
}
// The equally-long window immediately before it — the basis for every trend
function _prevRange(){
  const R=_dashRange();
  if(R.unbounded) return null;          // nothing honest to compare against
  const {from,to}=R;
  const a=new Date(from+"T00:00:00"), b=new Date(to+"T00:00:00");
  const days=Math.round((b-a)/864e5)+1;
  const pb=new Date(a); pb.setDate(pb.getDate()-1);
  const pa=new Date(pb); pa.setDate(pa.getDate()-days+1);
  const F=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  return {from:F(pa),to:F(pb),days};
}
const _inRange=(d,r)=>d && String(d)>=r.from && String(d)<=r.to;

// ── 2 · trend chip + sparkline ────────────────────────────────────────
function _trendChip(cur,prev){
  if(prev===null||prev===undefined) return "";        // period unbounded — no baseline
  if(!prev){ return cur? `<span class="dsh-trend new">new</span>` : ""; }
  const pct=Math.round(((cur-prev)/prev)*100);
  if(pct===0) return `<span class="dsh-trend flat">— 0%</span>`;
  const up=pct>0;
  return `<span class="dsh-trend ${up?"up":"down"}">${up?"▲":"▼"} ${Math.abs(pct)}%</span>`;
}
function _sparkline(vals,color){
  if(!vals||vals.length<2) return "";
  const mx=Math.max(...vals,0.0001), n=vals.length;
  const pts=vals.map((v,i)=>`${(i/(n-1)*100).toFixed(1)},${(26-(v/mx)*22).toFixed(1)}`).join(" ");
  return `<svg class="dsh-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
// daily totals across the current range — feeds the sparklines
function _dailySeries(rows,field,r){
  const win = r.unbounded ? {from:r.sparkFrom,to:r.sparkTo} : r;
  const map={}; (rows||[]).forEach(x=>{ if(_inRange(x.date,win)) map[x.date]=(map[x.date]||0)+Number(x[field]||0); });
  const out=[]; const a=new Date(win.from+"T00:00:00"), b=new Date(win.to+"T00:00:00");
  for(let d=new Date(a); d<=b; d.setDate(d.getDate()+1)){
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    out.push(map[k]||0);
  }
  return out.length>60?out.slice(-60):out;
}

// ── 1 · extra signals for the attention strip ─────────────────────────
function dashAlerts(){
  const out=[];
  try{   // critical / high incidents still open
    const crit=(state.incidents||[]).filter(i=>!["Resolved","Closed"].includes(i.status||"Open")
      && ["Critical","High"].includes(i.severity||""));
    if(crit.length) out.push({ic:"🚨",t:`${crit.length} critical incident${crit.length>1?"s":""} open`,m:"High or critical severity",go:"Incidents",c:"#C62828"});
  }catch(e){}
  try{   // work items nobody has touched for a fortnight
    if(typeof buildWorkItems==="function"){
      const cut=new Date(appNow()); cut.setDate(cut.getDate()-14);
      const C=`${cut.getFullYear()}-${String(cut.getMonth()+1).padStart(2,"0")}-${String(cut.getDate()).padStart(2,"0")}`;
      const stale=buildWorkItems(state.daily||[]).filter(w=>!w.closed && !w.unclassified && w.lastDate && w.lastDate<C);
      window._staleWI=stale;
      if(stale.length) out.push({ic:"🧵",t:`${stale.length} work item${stale.length>1?"s":""} stalled`,m:"Open with no visit for 14+ days — tap to review",fn:"dashShowStalled()",c:"#E65100"});
    }
  }catch(e){}
  try{   // did I log my own work today?
    const me=(state.profile&&(state.profile.employeeName||state.profile.name))||"";
    if(me && (isEmployee()||isAdmin())){
      const mine=(state.daily||[]).some(r=>r.employee===me && r.date===today());
      if(!mine) out.push({ic:"📝",t:"No work entry logged today",m:"Record today's work before you finish",go:"Daily Log",c:"#2E5FA3"});
    }
  }catch(e){}
  return out;
}

// ── 4 · today's field picture ─────────────────────────────────────────
function dashFieldToday(){
  const t=today();
  const rows=(state.daily||[]).filter(r=>r.date===t);
  const roster=(typeof visibleEmployees==="function")?visibleEmployees().filter(Boolean):[];
  const active={};
  rows.forEach(r=>{
    const e=r.employee||"—";
    (active[e]=active[e]||{emp:e,hrs:0,places:new Set(),projects:new Set()});
    active[e].hrs+=Number(r.duration||0);
    const pl=[r.area,r.site].filter(Boolean).join(" › ")||r.location||"";
    if(pl) active[e].places.add(pl);
    if(r.project) active[e].projects.add(r.project);
  });
  const list=Object.values(active).map(a=>({...a,places:[...a.places],projects:[...a.projects]}))
    .sort((a,b)=>b.hrs-a.hrs);
  const silent=roster.filter(e=>!active[e]);
  if(!list.length && !silent.length) return "";
  return `<div class="card">
    <div class="dsh-head"><span class="dsh-h1">📍 Today in the field</span></div>
    <div class="dsh-h2">${list.length} active${silent.length?` · ${silent.length} not logged yet`:""}</div>
    ${list.length?`<div style="display:grid;gap:7px;margin-top:8px">
      ${list.map(a=>`<button class="dsh-row" onclick="dashOpenEmployee('${escapeHtml(a.emp).replace(/'/g,"\\'")}')">
        <span class="dsh-dot" style="background:#2E7D32"></span>
        <span style="flex:1;min-width:0">
          <span style="font-weight:700;font-size:13px;color:var(--text)">${escapeHtml(a.emp)}</span>
          <span style="display:block;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(a.places.join(" · ")||a.projects.join(" · ")||"—")}</span>
        </span>
        <span style="font-weight:800;font-size:12px;color:#2E7D32">${fmtHM(a.hrs)}</span>
      </button>`).join("")}
    </div>`:""}
    ${silent.length?`<div style="margin-top:10px;display:flex;gap:5px;flex-wrap:wrap;align-items:center">
      <span style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Not logged yet</span>
      ${silent.slice(0,10).map(e=>`<span style="font-size:11px;background:#FFF3E0;color:#E65100;padding:3px 9px;border-radius:12px;font-weight:700">${escapeHtml(e)}</span>`).join("")}
      ${silent.length>10?`<span style="font-size:11px;color:var(--muted)">+${silent.length-10}</span>`:""}
    </div>`:""}
  </div>`;
}

// ── 3 · project health matrix (RAG) ───────────────────────────────────
function dashProjectHealth(){
  const r=_dashRange();
  const projects=(state.projects||[]).filter(p=>(p.name||"").trim());
  if(!projects.length) return "";
  const rowsAll=state.daily||[];
  const cards=projects.map(p=>{
    const nm=(p.name||"").trim();
    const mine=rowsAll.filter(x=>(x.project||"").trim()===nm);
    const hrs=mine.filter(x=>_inRange(x.date,r)).reduce((s,x)=>s+Number(x.duration||0),0);
    const totalHrs=mine.reduce((s,x)=>s+Number(x.duration||0),0);
    const est=Number(p.estimatedHours||0);
    const pct=est>0?Math.round(totalHrs/est*100):null;
    const last=mine.reduce((m,x)=>String(x.date||"")>m?String(x.date):m,"");
    const inc=(state.incidents||[]).filter(i=>(i.project||"").trim()===nm&&!["Resolved","Closed"].includes(i.status||"Open")).length;
    const pms=(state.pmSchedules||[]).filter(s=>(s.project||"").trim()===nm&&s.active!==false);
    const od=pms.filter(s=>pmDaysLeft(s)<0).length;
    const compliance=pms.length?Math.round((pms.length-od)/pms.length*100):null;
    // RAG: overdue PM or open incidents or budget overrun or gone quiet
    let rag="Green";
    const quiet = last && ((new Date(today())-new Date(last))/864e5)>14;
    if(inc||od||quiet||(pct!==null&&pct>100)) rag="Amber";
    if(inc>2||od>1||(pct!==null&&pct>115)) rag="Red";
    return {nm,hrs,totalHrs,est,pct,last,inc,od,compliance,rag,active:hrs>0};
  }).filter(x=>x.active||x.inc||x.od)
    .sort((a,b)=>({Red:0,Amber:1,Green:2}[a.rag]-{Red:0,Amber:1,Green:2}[b.rag])||b.hrs-a.hrs);
  if(!cards.length) return "";
  // Attention first, then the busiest — a wall of 17 green rows helps nobody.
  const needs=cards.filter(c=>c.rag!=="Green");
  const shown=(needs.length>=6?needs:cards).slice(0,8);
  const RC={Red:"#C62828",Amber:"#E65100",Green:"#2E7D32"};
  return `<div class="card">
    <div class="dsh-head"><span class="dsh-h1">🏗 Project health</span>${cards.length>6?`<span class="dsh-count">${cards.length}</span>`:""}</div>
    <div class="dsh-h2">${shown.length===cards.length?`${cards.length} active project${cards.length>1?"s":""}`:`showing ${shown.length} of ${cards.length} — those needing attention first`}</div>
    <div style="display:grid;gap:8px;margin-top:8px">
      ${shown.map(c=>`<button class="dsh-proj" style="border-left-color:${RC[c.rag]}" onclick="dashOpenProject('${escapeHtml(c.nm).replace(/'/g,"\\'")}')">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:800;font-size:13px;color:var(--text)">${escapeHtml(c.nm)}</span>
          <span style="font-size:12px;font-weight:800;color:${RC[c.rag]}">${fmtHM(c.hrs)}</span>
        </div>
        ${c.pct!==null?`<div style="margin-top:6px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-weight:700"><span>BUDGET</span><span>${fmtHM(c.totalHrs)} / ${c.est}h · ${c.pct}%</span></div>
          <div style="height:6px;background:var(--line);border-radius:4px;overflow:hidden;margin-top:3px"><div style="height:100%;width:${Math.min(100,c.pct)}%;background:${c.pct>100?"#C62828":"linear-gradient(90deg,#C9A84C,#E9CC7A)"};border-radius:4px"></div></div>
        </div>`:""}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">
          ${c.compliance!==null?`<span class="dsh-chip" style="background:${c.od?"#FFF3E0":"#E8F5E9"};color:${c.od?"#E65100":"#2E7D32"}">PM ${c.compliance}%</span>`:""}
          ${c.od?`<span class="dsh-chip" style="background:#FDECEA;color:#C62828">${c.od} overdue</span>`:""}
          ${c.inc?`<span class="dsh-chip" style="background:#FDECEA;color:#C62828">${c.inc} incident${c.inc>1?"s":""}</span>`:""}
          ${c.last?`<span class="dsh-chip" style="background:var(--line);color:var(--muted)">last ${fmtDate(c.last)}</span>`:""}
        </div>
      </button>`).join("")}
    </div>
  </div>`;
}

// ── 5 · repeat-offender devices ───────────────────────────────────────
function dashProblemDevices(){
  const cut=new Date(appNow()); cut.setDate(cut.getDate()-90);
  const C=`${cut.getFullYear()}-${String(cut.getMonth()+1).padStart(2,"0")}-${String(cut.getDate()).padStart(2,"0")}`;
  const tally={};
  (state.incidents||[]).forEach(i=>{
    if(!i.deviceSerial || String(i.date||"")<C) return;
    (tally[i.deviceSerial]=tally[i.deviceSerial]||{sn:i.deviceSerial,n:0,project:i.project||"",last:""});
    tally[i.deviceSerial].n++;
    if(String(i.date)>tally[i.deviceSerial].last) tally[i.deviceSerial].last=String(i.date);
  });
  const top=Object.values(tally).filter(x=>x.n>1).sort((a,b)=>b.n-a.n).slice(0,5);
  if(!top.length) return "";
  return `<div class="card" style="border-left:4px solid #C62828">
    <div class="dsh-head"><span class="dsh-h1">🔁 Repeat offenders</span></div>
    <div class="dsh-h2">Most incidents in the last 90 days</div>
    <div style="display:grid;gap:7px;margin-top:8px">
      ${top.map(d=>{
        const dev=(state.devices||[]).find(x=>x.serialNumber===d.sn);
        return `<button class="dsh-row" onclick="window.incProjFilter='${escapeHtml(d.project||"").replace(/'/g,"\\'")}';switchTab('Incidents')">
          <span class="dsh-dot" style="background:#C62828"></span>
          <span style="flex:1;min-width:0">
            <span style="font-weight:700;font-size:13px;color:var(--text)">${escapeHtml(dev?(dev.deviceName||dev.model||d.sn):d.sn)}</span>
            <span style="display:block;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml([d.project,dev&&dev.site,"last "+fmtDate(d.last)].filter(Boolean).join(" · "))}</span>
          </span>
          <span style="font-weight:800;font-size:13px;color:#C62828">${d.n}×</span>
        </button>`;}).join("")}
    </div>
    <p style="font-size:10px;color:var(--muted);margin:9px 0 0">Repeated failures on the same unit usually cost more than replacing it.</p>
  </div>`;
}

// ── 6 · the technician's own day ──────────────────────────────────────
function dashMyDay(){
  const me=(state.profile&&(state.profile.employeeName||state.profile.name))||"";
  if(!me) return "";
  const t=today();
  const mineToday=(state.daily||[]).filter(r=>r.employee===me&&r.date===t);
  const hrs=mineToday.reduce((s,r)=>s+Number(r.duration||0),0);
  const r=_dashRange();
  const mineRange=(state.daily||[]).filter(x=>x.employee===me&&_inRange(x.date,r));
  const rangeHrs=mineRange.reduce((s,x)=>s+Number(x.duration||0),0);
  let open=0;
  try{ if(typeof buildWorkItems==="function")
    open=buildWorkItems((state.daily||[]).filter(x=>x.employee===me)).filter(w=>!w.closed).length; }catch(e){}
  const uid=state.profile&&state.profile.uid;
  const tasks=(state.tasks||[]).filter(x=>x.assignedToUid===uid&&x.status==="pending").length;
  return `<div class="card" style="border-left:4px solid #2E5FA3">
    <div class="card-title">🎯 My day</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px">
      <button class="dsh-mini" onclick="dashClearJumps();switchTab('Daily Log')"><span class="dsh-mv" style="color:${hrs?"#2E7D32":"#C62828"}">${fmtHM(hrs)}</span><span class="dsh-ml">logged today</span></button>
      <button class="dsh-mini" onclick="dashClearJumps();switchTab('Daily Log')"><span class="dsh-mv" style="color:#2E5FA3">${fmtHM(rangeHrs)}</span><span class="dsh-ml">this period</span></button>
      <button class="dsh-mini" onclick="dashClearJumps();switchTab('Daily Log')"><span class="dsh-mv" style="color:${open?"#E65100":"#2E7D32"}">${open}</span><span class="dsh-ml">open work items</span></button>
      <button class="dsh-mini" onclick="switchTab('My Tasks')"><span class="dsh-mv" style="color:${tasks?"#E65100":"#2E7D32"}">${tasks}</span><span class="dsh-ml">tasks pending</span></button>
    </div>
  </div>`;
}
Object.assign(window,{dashAlerts,dashFieldToday,dashProjectHealth,dashProblemDevices,dashMyDay,_dashRange,_prevRange,_trendChip,_sparkline,_dailySeries,_inRange});

// Tapping a person opens the Daily Log filtered to them — and lands on the
// entries list, not the blank "add entry" form.
// Open ONE work item: filter the log to exactly the entries that make up that
// job, so tapping a stalled row lands on the job itself, not a generic list.
// Clear every jump-filter so a plain navigation never lands on a stale view
window.dashClearJumps=function(){
  window._logEmpFilter=""; window._logProjFilter=""; window._logWiIds=null; window._logWiLabel="";
};
window.dashOpenWorkItem=function(key){
  const w=(window._staleWI||[]).find(x=>x.key===key);
  if(!w) return switchTab("Daily Log");
  window._logWiIds   = w.entries.map(e=>e.id).filter(Boolean);
  window._logWiLabel = [w.title,w.scopeLabel].filter(Boolean).join(" · ");
  window._logEmpFilter=""; window._logProjFilter="";
  switchTab("Daily Log");
  setTimeout(()=>{ const el=document.getElementById("dailyListTop");
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); },300);
};
window.dashOpenProject=function(name){
  window._logWiIds=null;
  window._logProjFilter=name;
  window._logEmpFilter="";
  switchTab("Daily Log");
  setTimeout(()=>{ const el=document.getElementById("dailyListTop");
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); },300);
};
window.dashOpenEmployee=function(name){
  window._logEmpFilter=name;
  window._logProjFilter=""; window._logWiIds=null;          // the Daily Log's own jump-filter (has its own banner + Clear)
  switchTab("Daily Log");
  setTimeout(()=>{                    // land on the entries, not the blank add-entry form
    const el=document.getElementById("dailyListTop");
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
  },300);
};
// Stalled work items: a triage list you can actually act on
window._showStalled=false;
window.dashShowStalled=function(){
  window._showStalled=!window._showStalled;
  switchTab("Dashboard");
  setTimeout(()=>{ const el=document.getElementById("stalledPanel");
    if(el) el.scrollIntoView({behavior:"smooth",block:"center"}); },260);
};
// Close a whole work item in one action. A job's status is the status of its
// LATEST entry, so closing the job means closing that entry — but hunting for
// it among twenty tickets is exactly the friction that leaves jobs open.
window.closeWorkItem = async function(key){
  const w=(window._staleWI||[]).find(x=>x.key===key);
  if(!w) return;
  const last=w.entries[w.entries.length-1];
  if(!last) return;
  // Prefer one of the statuses this company actually configured
  const configured=(state.techStatuses||[]).map(s=>s.name).filter(Boolean);
  const closer=configured.find(s=>isClosedStatus(s)) || "Closed";
  if(!await uiConfirm(
      `Close this work item?\n\n${w.title}\n${w.scopeLabel||""}\n\nAll ${w.visits} entr${w.visits===1?"y":"ies"} in this job are covered — its latest entry (#${last.entryNo||"—"}, ${fmtDate(last.date)}) will be set to "${closer}".`,
      {danger:false, okText:"Close job", title:"Close work item"})) return;
  await fbSave("daily",{...last, taskStatus:closer});
  saveToast(`Work item closed — ${w.visits} entr${w.visits===1?"y":"ies"} ✓`);
  render();
};

function dashStalledPanel(){
  if(!window._showStalled) return "";
  const list=window._staleWI||[];
  const t=today();
  const days=d=>Math.round((new Date(t)-new Date(d))/864e5);
  return `<div class="card" id="stalledPanel" style="border-left:4px solid #E65100">
    <div class="dsh-head">
      <span class="dsh-h1">🧵 Stalled work items</span>
      <button class="btn btn-sm btn-secondary" onclick="window._showStalled=false;render()">Hide</button>
    </div>
    <div class="dsh-h2">Open jobs with no visit for 14+ days. Entries group into one job by project · area · site · device · category — closing a job covers every entry inside it. Rows that differ in any of those are separate jobs.</div>
    ${list.length?`<div style="display:grid;gap:7px;margin-top:9px">
      ${list.slice(0,25).map(w=>`<div class="dsh-row" style="cursor:default">
        <span class="dsh-dot" style="background:var(--warn)"></span>
        <span style="flex:1;min-width:0;cursor:pointer" onclick="dashOpenWorkItem('${escapeHtml(w.key).replace(/'/g,"\\'")}')">
          <span style="font-weight:700;font-size:var(--f-lg);color:var(--text)">${escapeHtml(w.title)}</span>
          <span style="display:block;font-size:var(--f-sm);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(w.scopeLabel||"—")} · ${escapeHtml(w.status)}</span>
          <span style="display:block;font-size:var(--f-2xs);color:var(--muted);margin-top:2px">${w.visits} entr${w.visits===1?"y":"ies"} · idle ${days(w.lastDate)}d · last ${fmtDate(w.lastDate)}</span>
        </span>
        <button class="btn btn-sm" style="background:var(--ok);color:#fff;border:none;font-weight:800;white-space:nowrap;flex:0 0 auto" onclick="closeWorkItem('${escapeHtml(w.key).replace(/'/g,"\\'")}')">✓ Close job</button>
      </div>`).join("")}
    </div>${list.length>25?`<div style="font-size:11px;color:var(--muted);margin-top:7px">Showing the 25 longest-idle of ${list.length}.</div>`:""}`
    :`<div class="empty empty2" style="margin-top:8px"><span class="e-ic">✅</span><div class="e-t">Nothing stalled</div><div class="e-m">Every open job has been visited recently</div></div>`}
  </div>`;
}
// ① Filters now lives in Logs as its own tab
function renderFiltersTab(){
  if(isEmployee()) return `<div class="card"><div class="empty">Filters are managed by your administrator.</div></div>`;
  return `<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:#fff;padding:16px">
      <div style="font-family:'DM Serif Display',serif;font-size:18px">🔎 Filters</div>
      <div style="font-size:11px;opacity:.85">Applies across the Dashboard, Logs, Reports and Analytics</div>
    </div>` + renderEmployeeFilterUI("Filters");
}
Object.assign(window,{renderFiltersTab,dashStalledPanel});

function renderDashboard(){
  const s=summary();
  const tHrs=s.reduce((a,b)=>a+b.total,0);
  const tOT=s.reduce((a,b)=>a+b.ot,0);
  const tTr=s.reduce((a,b)=>a+b.tDays,0);
  const tPD=s.reduce((a,b)=>a+b.pd,0);

  // Export button at the top
  // The period and every filter now live centrally: the header pill (shown on
  // ALL tabs) and Logs → Filters. The dashboard carries figures, not chrome.
  const exportBar = '';

  const dT={};
  state.departments.forEach(d=>{
    dT[d.name] = s.reduce((acc,r)=>acc+(r.byDept[d.name]||0), 0);
  });

  // ── "Your day" command center ──
  const _hr=new Date().getHours();
  const _greet=_hr<12?"Good morning":_hr<17?"Good afternoon":"Good evening";
  const _gIcon=_hr<12?"☀️":_hr<17?"🌤️":"🌙";
  const _fname=((state.profile&&(state.profile.name||state.profile.employeeName))||"").split(" ")[0];
  const _acts=[];
  try{ if(isAdmin()&&typeof pmStatusCounts==="function"){ const pc=pmStatusCounts();
    if(pc.overdue+pc.soon>0) _acts.push({ic:"🛠️",t:`${pc.overdue+pc.soon} maintenance task${pc.overdue+pc.soon>1?"s":""} due`,m:pc.overdue?`${pc.overdue} overdue`:"within 7 days",go:"Maintenance",c:pc.overdue?"#C62828":"#E65100"}); } }catch(e){}
  try{ if(!isEmployee()&&typeof getSLA==="function"){ const sla=getSLA(); let risk=0;
    (state.clientRequests||[]).forEach(r=>{ if(!r.createdAt||REQ_FINAL_RE.test(r.status||""))return;
      const isN=!r.respondedAt; const lim=(isN?sla.responseHrs:sla.completeHrs)*36e5;
      if(new Date(r.createdAt).getTime()+lim-Date.now()<lim*0.25) risk++; });
    if(risk>0) _acts.push({ic:"⏱",t:`${risk} request${risk>1?"s":""} need attention`,m:"SLA at risk or breached",go:"Requests",c:"#C62828"}); } }catch(e){}
  try{ const me=state.profile&&state.profile.uid;
    const myT=(state.tasks||[]).filter(t=>t.assignedToUid===me&&t.status==="pending").length;
    if(myT>0) _acts.push({ic:"📋",t:`${myT} task${myT>1?"s":""} awaiting your confirmation`,m:"Assigned to you",go:"My Tasks",c:"#2E5FA3"}); }catch(e){}
  try{ if(isAdmin()){ const init=(typeof reqInitialStatus==="function")?reqInitialStatus():"new";
    const nw=(state.clientRequests||[]).filter(r=>(r.status||init)===init).length;
    if(nw>0) _acts.push({ic:"📨",t:`${nw} new client request${nw>1?"s":""}`,m:"Not yet reviewed",go:"Requests",c:"#6A1B9A"}); } }catch(e){}
  try{ if(typeof dashAlerts==="function") dashAlerts().forEach(a=>_acts.push(a)); }catch(e){}
  try{ if(isAdmin()||isHR()){
    const pv=visibleRows(state.daily||[]).filter(r=>isPendingAppr(r)&&canApprove(r)).length;
    if(pv) _acts.push({ic:"✅",t:`${pv} entr${pv===1?"y":"ies"} awaiting your approval`,
      m:"Review them before they reach payroll reports",go:"Approvals",c:"#2E7D32"});
  } }catch(e){}
  const hero=`<div class="card day-hero">
    <div class="dh-top">
      <div><div class="dh-greet">${_greet}${_fname?`, ${escapeHtml(_fname)}`:""} ${_gIcon}</div>
      <div class="dh-date">${new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div></div>
      <div class="dh-badge ${_acts.length?"warm":"calm"}">${_acts.length?`<span class="cnt" data-v="${_acts.length}" data-fmt="int">0</span> need${_acts.length===1?"s":""} you`:"✅ All clear"}</div>
    </div>
    ${_acts.length?`<div class="dh-acts">${_acts.map(a=>`<button class="dh-act" style="border-left-color:${a.c}" onclick="${a.fn?a.fn:`switchTab('${a.go}')`}">
      <span class="dh-ic">${a.ic}</span><span class="dh-body"><span class="dh-t">${a.t}</span><span class="dh-m">${a.m}</span></span><span class="dh-go">›</span></button>`).join("")}</div>`
    :`<div class="dh-clear">Nothing is waiting on you right now — enjoy the calm ${_gIcon}</div>`}
  </div>`;

  // ── period-over-period comparison for every headline figure ──
  const _R=_dashRange(), _P=_prevRange();
  const _emps=(typeof visibleEmployees==="function")?visibleEmployees().filter(Boolean):[];
  const _mine=(rows)=>_emps.length?(rows||[]).filter(x=>_emps.includes(x.employee)):(rows||[]);
  const _sum=(rows,f,rg)=>rg?_mine(rows).filter(x=>_inRange(x.date,rg)).reduce((s,x)=>s+Number(x[f]||0),0):null;
  const _pHrs=_sum(state.daily,"duration",_P);
  const _pOT =_sum(state.overtime,"hours",_P)||_sum(state.overtime,"duration",_P);
  const _pTr =_sum(state.travel,"days",_P);
  const _pPD =_sum(state.travel,"perDiem",_P);
  const _kpi=(accent,label,val,fmt,sub,prev,cur,series)=>`
    <div class="kpi" style="--accent:${accent}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value"><span class="cnt" data-v="${val}" data-fmt="${fmt}">${fmt==="hm"?"0:00":"0"}</span></div>
      <div class="kpi-sub">${sub} ${_trendChip(cur,prev)}</div>
      ${_sparkline(series,accent)}
    </div>`;
  let h = (typeof partialDataNotice==="function"?partialDataNotice():"") + hero + exportBar + (isEmployee()&&typeof dashMyDay==="function"?dashMyDay():"") + `<div class="kpi-grid">
    ${_kpi("#2E5FA3","Total Hours",tHrs,"hm",isEmployee()?"your hours":apprFilter(applyReportFilters(visibleRows(state.daily))).length+" sessions",_pHrs,tHrs,_dailySeries(_mine(state.daily),"duration",_R))}
    ${_kpi("#E65100","Overtime",tOT,"hm",applyReportFilters(visibleRows(state.overtime)).length+" entries",_pOT,tOT,_dailySeries(_mine(state.overtime),"hours",_R))}
    ${_kpi("#2E7D32","Travel Days",tTr,"int",applyReportFilters(visibleRows(state.travel)).length+" trips",_pTr,tTr,_dailySeries(_mine(state.travel),"days",_R))}
    ${_kpi("#6A1B9A","Per Diem",tPD,"money","IQD total",_pPD,tPD,_dailySeries(_mine(state.travel),"perDiem",_R))}
  </div>`;
  // ── the operational picture, above the historical charts ──
  if(!isEmployee()){
    try{ h += dashStalledPanel() + dashFieldToday() + dashProjectHealth() + dashProblemDevices(); }catch(e){ console.error("dash blocks",e); }
  }

  if(!isEmployee()){
    h+=`<div class="card"><div class="card-title">Employee Hours Distribution</div>
      <div class="donut-container">
        ${donutSVG(s.map((r,i)=>({label:r.emp.split(" ")[0],value:r.total,color:EMP_COLORS[i%EMP_COLORS.length]})),tHrs)}
        <div class="donut-legend">
          ${s.map((r,i)=>`<div class="donut-leg-item">
            <span class="donut-leg-swatch" style="background:${EMP_COLORS[i%EMP_COLORS.length]}"></span>
            <span class="donut-leg-name">${escapeHtml(r.emp)}</span>
            <span class="donut-leg-val">${fmtHM(r.total)}</span>
            <span class="donut-leg-pct">${tHrs>0?((r.total/tHrs)*100).toFixed(1):"0.0"}%</span>
          </div>`).join("")}
        </div></div></div>`;
  }

  h+=`<div class="card"><div class="card-title">Department Performance</div>`;
  const allDepts = state.departments;
  if(allDepts.length === 0){
    h+=`<div class="empty">No departments configured. ${isHR()?'<br>Go to <strong>Departments</strong> tab to add departments.':''}</div>`;
  } else {
    allDepts.forEach(dept=>{
      const tot = s.reduce((acc,r)=>acc+(r.byDept[dept.name]||0), 0);
      const mx = Math.max(...s.map(r=>r.byDept[dept.name]||0), 0.01);
      h+=`<div class="dept-block" style="border:1px solid var(--line)">
        <div class="dept-head" style="background:linear-gradient(135deg,${dept.color},${dept.color}DD)"><h3>${escapeHtml(dept.name)}</h3><span class="total">${fmtHM(tot)}</span></div>
        <div class="dept-body">
          ${s.map(r=>{
            const hrs = r.byDept[dept.name] || 0;
            const pct = tot>0 ? (hrs/tot*100) : 0;
            const bw = hrs/mx*100;
            return `<div class="dept-row">
              <span class="name">${escapeHtml(r.emp)}</span>
              <span class="hrs">${fmtHM(hrs)}</span>
              <span class="pct">${pct.toFixed(1)}%</span>
              <div class="bar-container"><div class="bar-fill" style="width:${bw}%;background:${dept.color}"></div></div></div>`;
          }).join("")}
        </div></div>`;
    });
  }
  h+=`</div>`;

  // "Export Data" card removed — all exports are in Reports / HR Report tabs
  // (employees see them only when granted 📊 View Reports by the admin).

  return h;
}

// ═══════════════════════════════════════════════════════════════════════
//  DAILY LOG
// ═══════════════════════════════════════════════════════════════════════
// ── Daily Log AUTO-DRAFT: never lose a half-filled entry again ──
// Event-driven (no timers): every input/change while on Daily Log persists
// the form locally; restored automatically after any reload/crash.
const DAILY_DRAFT_KEY='girek-draft-daily-v1';
let _draftTimer=null;
function saveDailyDraft(){
  try{
    if(window._draftSuspend) return;
    if(state.tab!=="Daily Log" || !dailyForm || dailyEditId) return;
    localStorage.setItem(DAILY_DRAFT_KEY, JSON.stringify(dailyForm));
  }catch(e){
    // Quota (photos too large): keep the text fields at least
    try{ const {resolutionImages, ...rest}=dailyForm; rest._imagesDropped=true;
         localStorage.setItem(DAILY_DRAFT_KEY, JSON.stringify(rest)); }catch(_){}
  }
}
function scheduleDailyDraft(){ clearTimeout(_draftTimer); _draftTimer=setTimeout(saveDailyDraft, 700); }
function loadDailyDraft(){
  try{ const s=localStorage.getItem(DAILY_DRAFT_KEY); return s?JSON.parse(s):null; }catch(e){ return null; }
}
function clearDailyDraft(){
  clearTimeout(_draftTimer); _draftTimer=null;   // cancel any pending write (race fix)
  window._draftSuspend=true;                     // ignore input/change events fired by the re-render
  setTimeout(()=>{window._draftSuspend=false;},900);
  try{ localStorage.removeItem(DAILY_DRAFT_KEY); }catch(e){}
}
document.addEventListener('input',  ()=>{ if(state.tab==="Daily Log" && !window._draftSuspend) scheduleDailyDraft(); });
document.addEventListener('change', ()=>{ if(state.tab==="Daily Log" && !window._draftSuspend) scheduleDailyDraft(); });
window.addEventListener('beforeunload', saveDailyDraft);

// Link this entry to an existing open work item. If that item is only held
// together by its signature (legacy), we mint a real threadId and stamp it on
// every entry of the item — so the chain survives any later reclassification.
window.dailyLinkThread=async function(key){
  const open=openWorkItemsFor(dailyForm);
  const w=open.find(x=>x.key===key); if(!w) return;
  let tid=w.entries.map(e=>e.threadId).find(Boolean);
  if(!tid){
    tid="wi_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    for(const e of w.entries){ if(!e.threadId) await fbSave("daily",{...e,threadId:tid}); }
  }
  dailyForm.threadId=tid;
  if(!dailyForm.taskCategory)    dailyForm.taskCategory=w.taskCategory||"";
  if(!dailyForm.taskSubcategory) dailyForm.taskSubcategory=w.taskSubcategory||"";
  toast(`🧵 Linked — visit #${w.visits+1} of this work item`);
  render();
};
window.dailyUnlinkThread=function(){ dailyForm.threadId=""; toast("Starting a NEW work item"); render(); };

function renderDailyLog(){
  // A forgotten MANUAL date/time override silently shifts every date in the
  // app — never let it hide. Shown wherever dates actually matter.
  const _mo=(typeof _dtDoc==="function")&&_dtDoc().mode==="manual"
    ? `<div class="card" style="background:#FFF3E0;border:1.5px solid #E65100;padding:11px 13px">
        <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:800;color:#BF360C">🕐 MANUAL DATE &amp; TIME IS ON</span>
          <span style="flex:1;min-width:150px;font-size:11px;color:#7A4A10">The app is using <strong>${today()}</strong>, not the real clock.</span>
          <button class="btn btn-sm" style="background:#E65100;color:#fff;border:none;font-weight:700" onclick="clearManualDT()">⚡ Back to automatic</button>
        </div>
      </div>` : "";
  if(!dailyForm){
    const _draft=loadDailyDraft();
    if(_draft && !dailyEditId){
      dailyForm=_draft;
      if(!window._draftToastShown){ window._draftToastShown=true;
        setTimeout(()=>toast(_draft._imagesDropped?"Draft restored (photos need re-attaching) ✓":"Draft restored — continue where you left off ✓"),400); }
    }
  }
  if(!dailyForm){
    dailyForm={
      date:today(), dateAuto:true,   // cleared the moment the user picks a date
      employee:isEmployee()?state.profile.employeeName:"",
      project:"",projectCode:"",pmFinal:false,start:"",end:"",location:"",
      site:"",equipment:"",area:"",  // area + site (from project's areas)
      deviceSerial:"",  // optional device reference (Asset Management)
      workType:"",taskStatus:"",taskCategory:"",taskSubcategory:"",  // technical classification
      threadId:"",  // link to an existing work item (empty = new work item)
      resolutionText:"",  // mandatory text explanation
      resolutionImages:[], // array of base64 compressed images
      notes:""
    };
  }
  // ── Date roll, AFTER the form exists (a draft restored above may carry
  //    yesterday's date). Drafts written before v128 have no `dateAuto` key
  //    at all — back then the date was ALWAYS auto-filled, so treat a missing
  //    flag as auto. Any roll on a restored draft is announced, never silent.
  if(!dailyEditId){
    if(dailyForm.dateAuto===undefined) dailyForm.dateAuto = true;   // legacy draft
    const _was=dailyForm.date;
    if(rollAutoDate(dailyForm) && _was){
      setTimeout(()=>saveToast(`📅 Draft was from ${fmtDate(_was)} — date updated to today`),700);
    }
  }
  // Ensure fields exist (backward compat for edit)
  if(!dailyForm.resolutionImages) dailyForm.resolutionImages = [];
  if(typeof dailyForm.resolutionText === 'undefined') dailyForm.resolutionText = "";
  if(typeof dailyForm.site === 'undefined') dailyForm.site = "";
  if(typeof dailyForm.equipment === 'undefined') dailyForm.equipment = "";
  if(typeof dailyForm.area === 'undefined') dailyForm.area = "";
  if(typeof dailyForm.deviceSerial === 'undefined') dailyForm.deviceSerial = "";
  if(typeof dailyForm.workType === 'undefined') dailyForm.workType = "";
  if(typeof dailyForm.taskStatus === 'undefined') dailyForm.taskStatus = "";
  if(typeof dailyForm.taskCategory === 'undefined') dailyForm.taskCategory = "";
  if(typeof dailyForm.taskSubcategory === 'undefined') dailyForm.taskSubcategory = "";
  const dur=timeToHrs(dailyForm.start,dailyForm.end);
  const dept=projDept(dailyForm.project);
  // Use the UNIFIED global filters (employees/branch/staff-dept/task-dept/projects/locations)
  // plus the local "# Entry" filter which only makes sense here in the Daily Log.
  const _jumped = !!(window._logEmpFilter || window._logProjFilter || window._logWiIds || dailyEntryNo);
  // When the user has deliberately jumped to specific records (a stalled work
  // item, a person, a project, an entry number), the period filter is bypassed
  // — those records are usually OLDER than the active period by definition.
  const _base = _jumped ? visibleRows(state.daily) : apprFilter(applyReportFilters(visibleRows(state.daily)));
  const rows=_base.filter(r=>{
    if(dailyEntryNo && Number(r.entryNo||0) !== Number(dailyEntryNo)) return false;
    if(window._logEmpFilter && (r.employee||"") !== window._logEmpFilter) return false;   // jump-from-alert filter
    if(window._logProjFilter && (r.project||"").trim() !== window._logProjFilter) return false;  // jump-from-dashboard project filter
    if(window._logWiIds && !window._logWiIds.includes(r.id)) return false;                       // jump-to-one-work-item filter
    return true;
  }).sort((a,b)=>{
    // Ascending by entry number (001 at top → latest at bottom)
    // Entries without numbers go last, sorted by date
    const an = Number(a.entryNo||0), bn = Number(b.entryNo||0);
    if(an && bn) return an - bn;
    if(an && !bn) return -1;
    if(!an && bn) return 1;
    return (a.date||"").localeCompare(b.date||"");
  });
  // Active jump-filter banner (set by Smart Alerts)
  const _jumpWhat = window._logEmpFilter || window._logProjFilter || (window._logWiIds ? (window._logWiLabel||"work item") : "") || "";
  const _jumpBanner = _jumpWhat ? `<div class="card" style="border-left:4px solid #E65100;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:13px;font-weight:700;color:var(--text)">🔎 Showing entries for: <span style="color:#E65100">${escapeHtml(_jumpWhat)}</span> <span style="font-size:11px;color:var(--muted)">(${rows.length} entr${rows.length===1?'y':'ies'}${getPeriodFrom()||getPeriodTo()?" · period filter bypassed":""})</span></span>
      <button class="btn btn-sm" style="background:#C62828;color:white;border:none;font-weight:700" onclick="window._logEmpFilter='';window._logProjFilter='';window._logWiIds=null;window._logWiLabel='';render()">${ICN.x} Clear filter</button>
    </div>` : "";
  // Project options for filter
  const projOptions = [...new Set(state.daily.map(r=>r.project).filter(Boolean))].sort();
  const empOptions=allEmployees();
  // Location stats (hours by location) — respect active period
  const locStats = state.locations.map(l=>{
    const items = filterByPeriod(visibleRows(state.daily)).filter(r=>r.location===l.name);
    const hours = items.reduce((s,r)=>s+Number(r.duration||0),0);
    return {name:l.name, count:items.length, hours};
  }).filter(l=>l.count>0);

  return `${_mo}${_jumpBanner}<div class="card">
    <div class="sec-hdr">${dailyEditId?"Edit":"Add"} Work Entry</div>
    <div class="form-grid">
      <div class="field"><label>Date <span class="req">*</span></label>
        <input type="date" value="${dailyForm.date}" onchange="window.dailyForm.date=this.value;window.dailyForm.dateAuto=false;render()"></div>
      <div class="field"><label>Employee <span class="req">*</span></label>
        ${isEmployee() && !isSupervisor()
          ?(state.profile.employeeName
            ?`<select onchange="window.dailyForm.employee=this.value;render()">
                <option value="${escapeHtml(state.profile.employeeName)}" selected>${escapeHtml(state.profile.employeeName)}</option>
              </select>`
            :`<div style="padding:10px 12px;background:#FFEBEE;border:1px solid #EF9A9A;border-radius:8px;font-size:12px;color:#C62828;font-weight:600">
                ⚠ Your account has no employee profile linked.<br>
                <span style="font-weight:400">Ask your administrator to set your "Employee Name" in the Users tab.</span>
              </div>`)
          :`<select onchange="window.dailyForm.employee=this.value;render()"><option value="">— Select —</option>${(isSupervisor()&&!isHR()?myTeamEmployees():empOptions).map(e=>`<option ${e===dailyForm.employee?"selected":""}>${escapeHtml(e)}</option>`).join("")}</select>
          ${isSupervisor()&&!isHR()?`<p style="font-size:11px;color:#6A1B9A;margin-top:4px">👔 You can log for your team members.</p>`:''}`}
      </div>
      <div class="field full"><label>Project <span class="req">*</span></label>
        <select onchange="window.dailyForm.project=this.value;window.dailyForm.projectCode='';window.dailyForm.pmFinal=false;window.dailyForm.area='';window.dailyForm.site='';render()">
          <option value="">— Select —</option>
          ${state.projects.map(p=>{const n=(p.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===(dailyForm.project||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}
        </select></div>
      ${(()=>{
        const _pc = state.projects.find(p=>(p.name||"").trim()===(dailyForm.project||"").trim());
        const _codes = (_pc && Array.isArray(_pc.codes)) ? _pc.codes : [];
        if(!_codes.length) return "";
        const _isPM = String(dailyForm.projectCode||"").trim().toLowerCase()==="preventive maintenance";
        return `<div class="field full"><label>🔖 Project Code <span style="font-size:10px;color:var(--muted)">(which work stream / contract)</span></label>
        <select onchange="window.dailyForm.projectCode=this.value;window.dailyForm.pmFinal=false;render()">
          <option value="">— None —</option>
          ${_codes.map(c=>`<option ${dailyForm.projectCode===c?"selected":""}>${escapeHtml(c)}</option>`).join("")}
        </select>
        ${_isPM&&isAdmin()?`<label style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:9px 12px;background:#FFF3E0;border:1px solid #EAD3AE;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;color:#7A4A00">
          <input type="checkbox" ${dailyForm.pmFinal?"checked":""} onchange="window.dailyForm.pmFinal=this.checked" style="width:16px;height:16px;accent-color:#E65100">
          🏁 Final log of this maintenance round — closes it & sets the next due date from THIS entry's date
        </label>`:_isPM?`<p style="font-size:10px;color:var(--muted);margin-top:5px">🛠 This entry counts as a maintenance session.</p>`:""}
        </div>`;
      })()}
      ${(()=>{
        const proj = state.projects.find(p=>(p.name||"").trim()===(dailyForm.project||"").trim());
        const areas = proj ? getProjectAreas(proj) : [];
        const activeAreas = areas.filter(a=>a.active!==false);  // only active areas
        if(activeAreas.length===0) return "";  // project has no areas → skip
        const selArea = activeAreas.find(a=>a.name===dailyForm.area);
        const sites = (selArea?.sites||[]).filter(s=>s.active!==false);  // only active sites
        const siteReq = !isAdmin() && getEmpPermissions(dailyForm.employee||state.profile.employeeName||"").equipmentRequired;
        return `
      <div class="field full"><label>🗺️ Area ${siteReq?'<span class="req">*</span>':'<span style="font-size:10px;color:var(--muted)">(optional)</span>'}</label>
        <select onchange="window.dailyForm.area=this.value;window.dailyForm.site='';render()">
          <option value="">— Select Area —</option>
          ${activeAreas.map(a=>`<option value="${escapeHtml(a.name)}" ${a.name===(dailyForm.area||"")?"selected":""}>${escapeHtml(a.name)}</option>`).join("")}
        </select></div>
      ${dailyForm.area && sites.length>0 ? `
      <div class="field full"><label>📍 Site ${siteReq?'<span class="req">*</span>':'<span style="font-size:10px;color:var(--muted)">(optional)</span>'}</label>
        <select onchange="window.dailyForm.site=this.value;render()">
          <option value="">— Select Site —</option>
          ${sites.map(s=>`<option value="${escapeHtml(s.name)}" ${s.name===(dailyForm.site||"")?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}
        </select></div>` : (dailyForm.area ? `<div class="field full"><div style="font-size:11px;color:#888;padding:6px 10px;background:#F7F7F7;border-radius:8px">No active sites in this area.</div></div>` : '')}`;
      })()}
      ${(()=>{
        // ── Device Tracking: only for employees granted the permission (admin always sees it) ──
        const emp = dailyForm.employee || state.profile.employeeName || "";
        const perms = getEmpPermissions(emp);
        if(!isAdmin() && !perms.deviceTracking) return "";  // hidden unless permitted
        if(!dailyForm.site) return "";  // need a site first to filter devices
        // Devices that belong to the chosen project + site
        const siteDevices = (state.devices||[]).filter(d=>
          (d.project||"")===(dailyForm.project||"") && (d.site||"")===(dailyForm.site||"")
        );
        if(siteDevices.length===0) return `<div class="field full"><div style="font-size:11px;color:#888;padding:6px 10px;background:#F7F7F7;border-radius:8px">📟 No devices registered at this site.</div></div>`;
        const canFull = isAdmin() || perms.fullDeviceEdit;
        const selDev = siteDevices.find(d=>d.serialNumber===dailyForm.deviceSerial);
        return `
      <div class="field full"><label>📟 Device <span style="font-size:10px;color:var(--muted)">(optional — tracked centrally)</span></label>
        <select onchange="window.dailyForm.deviceSerial=this.value;window._loadDeviceEdit(this.value);render()">
          <option value="">— Select Device —</option>
          ${siteDevices.map(d=>`<option value="${escapeHtml(d.serialNumber)}" ${d.serialNumber===(dailyForm.deviceSerial||"")?"selected":""}>${escapeHtml(d.deviceName||d.serialNumber)}${d.ipAddress?' · '+escapeHtml(d.ipAddress):''}</option>`).join("")}
        </select></div>
      ${selDev ? `
      <div class="field full" style="background:#F0F7FF;border:1px solid #B3D4FF;border-radius:12px;padding:12px;margin-top:2px">
        <div style="font-size:12px;font-weight:800;color:#03308B;margin-bottom:8px">🔧 Update device: ${escapeHtml(selDev.deviceName||selDev.serialNumber)}
          <span style="font-size:10px;font-weight:600;color:#1565C0;background:#E3F2FD;padding:1px 7px;border-radius:8px;margin-left:4px">syncs centrally</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">Status</label>
            <select onchange="window._setDevEdit('status',this.value)" style="width:100%;padding:7px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px;background:var(--card)">
              ${DEVICE_STATUSES.map(s=>`<option value="${escapeHtml(s)}" ${s===(window._devEdit?.status ?? selDev.status)?"selected":""}>${escapeHtml(s)}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">Install Date</label>
            <input type="date" value="${escapeHtml(window._devEdit?.installDate ?? selDev.installDate ?? '')}" onchange="window._setDevEdit('installDate',this.value)" style="width:100%;padding:6px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px">
          </div>
          ${canFull ? `
          <div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">IP Address</label>
            <input value="${escapeHtml(window._devEdit?.ipAddress ?? selDev.ipAddress ?? '')}" onchange="window._setDevEdit('ipAddress',this.value)" style="width:100%;padding:6px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px"></div>
          <div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">Model</label>
            <input value="${escapeHtml(window._devEdit?.model ?? selDev.model ?? '')}" onchange="window._setDevEdit('model',this.value)" style="width:100%;padding:6px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px"></div>
          <div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">Vendor</label>
            <input value="${escapeHtml(window._devEdit?.vendor ?? selDev.vendor ?? '')}" onchange="window._setDevEdit('vendor',this.value)" style="width:100%;padding:6px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px"></div>
          <div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">Warranty Exp.</label>
            <input type="date" value="${escapeHtml(window._devEdit?.warrantyExp ?? selDev.warrantyExp ?? '')}" onchange="window._setDevEdit('warrantyExp',this.value)" style="width:100%;padding:6px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px"></div>
          <div><label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">Stack</label>
            <input value="${escapeHtml(window._devEdit?.stack ?? selDev.stack ?? '')}" onchange="window._setDevEdit('stack',this.value)" style="width:100%;padding:6px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px"></div>
          ` : `<div style="grid-column:1/3;font-size:10px;color:#94A3B8">Only Status & Install Date are editable. Full edit needs admin permission.</div>`}
        </div>
        <div style="font-size:10px;color:#64748B;margin-top:6px">Saving this entry will update the device in the central registry.</div>
      </div>` : ''}`;
      })()}
      <div class="field"><label>Start</label>
        <input type="time" value="${dailyForm.start}" onchange="window.dailyForm.start=this.value;render()"></div>
      <div class="field"><label>End</label>
        <input type="time" value="${dailyForm.end}" onchange="window.dailyForm.end=this.value;render()"></div>
      <div class="field full"><label>Location <span class="req">*</span></label>
        <select onchange="window.dailyForm.location=this.value;render()">
          <option value="">— Select Location —</option>
          ${state.locations.map(l=>{const n=(l.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===(dailyForm.location||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}
        </select></div>
      ${!isAdmin() && !dailyEditId && getEmpPermissions(dailyForm.employee||state.profile.employeeName||"").gpsRequired ? `
      <div class="field full">
        <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:#E8F5E9;border:1px solid #A5D6A7;border-radius:8px;font-size:12px;color:#2E7D32">
          <span style="font-size:16px">🛰️</span>
          <div>
            <strong>GPS will be captured automatically</strong> when you save this entry.<br>
            <span style="font-size:11px;color:#558B2F">Please allow location access if your browser asks. The entry saves even if GPS is unavailable.</span>
          </div>
        </div>
      </div>` : ''}
      <div class="field"><label>Duration</label>
        <div class="auto green ${dur>0?"":"empty"}">${dur>0?fmtHM(dur):"—"}</div></div>
      <div class="field"><label>Dept (auto)</label>
        <div class="auto purple ${dept?"":"empty"}">${dept||"—"}</div></div>
      <div class="field full"><label>Notes</label>
        <input value="${escapeHtml(dailyForm.notes||"")}" oninput="window.dailyForm.notes=this.value" placeholder="Optional"></div>

      <!-- ═══ RESOLUTION SECTION (MANDATORY) ═══ -->
      <div class="field full" style="margin-top:6px">
        <div style="background:linear-gradient(135deg,#FFF8E1 0%,#FFFEF7 100%);border:2px solid #C9A84C;border-radius:12px;padding:14px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px dashed #C9A84C">
            <span style="background:#C9A84C;color:#1B3A6B;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:800;letter-spacing:0.5px">RESOLUTION</span>
            <span style="font-size:12px;color:#7F6000;font-weight:600">📋 Required — Document work performed</span>
          </div>

          <!-- ═══ WORK ITEM LINK — continue an open job instead of starting a new one ═══ -->
          ${(()=>{
            const open=(typeof openWorkItemsFor==="function")?openWorkItemsFor(dailyForm).filter(w=>!dailyEditId||!w.entries.some(e=>e.id===dailyEditId)):[];
            const linked=dailyForm.threadId?open.find(w=>w.key===dailyForm.threadId||w.entries.some(e=>e.threadId===dailyForm.threadId)):null;
            if(!open.length && !dailyForm.threadId) return "";
            return `<div style="background:#EEF4FF;border:1.5px solid #2E5FA3;border-radius:8px;padding:10px;margin-bottom:12px">
              <div style="font-size:11px;font-weight:800;color:#1B3A6B;margin-bottom:7px">🧵 WORK ITEM ${linked?`— continuing`:`— ${open.length} open here`}</div>
              ${linked?`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="flex:1;font-size:12px;color:#03308B;font-weight:700">${escapeHtml(linked.title)} · visit #${linked.visits+1} · since ${fmtDate(linked.firstDate)}</span>
                  <button type="button" class="btn btn-sm btn-secondary" onclick="dailyUnlinkThread()">✕ New instead</button>
                </div>`
              :`<div style="font-size:11px;color:#456;margin-bottom:7px">Is this a follow-up visit? Link it so the job keeps ONE status history instead of counting twice.</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${open.slice(0,4).map(w=>`<button type="button" class="btn btn-sm btn-secondary" style="font-size:11px;text-align:left" onclick="dailyLinkThread('${w.key}')">↳ ${escapeHtml(w.title)} <span style="opacity:.7">· ${escapeHtml(w.status)} · ${w.visits} visit${w.visits>1?"s":""}</span></button>`).join("")}
                </div>`}
            </div>`;})()}

          <!-- Technical Classification: Work Type, Status, Category, Subcategory -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:#5C4A12;margin-bottom:3px">🧭 Work Type</label>
              <select onchange="window.dailyForm.workType=this.value" style="width:100%;padding:7px 8px;border:1px solid #C9A84C;border-radius:8px;font-size:12px;background:var(--card)">
                <option value="">— Select —</option>
                ${getWorkTypes().map(w=>`<option value="${escapeHtml(w)}" ${w===(dailyForm.workType||"")?"selected":""}>${escapeHtml(w)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:#5C4A12;margin-bottom:3px">📊 Task Status</label>
              <select onchange="window.dailyForm.taskStatus=this.value" style="width:100%;padding:7px 8px;border:1px solid #C9A84C;border-radius:8px;font-size:12px;background:var(--card)">
                <option value="">— Select —</option>
                ${getTaskStatuses().map(s=>`<option value="${escapeHtml(s)}" ${s===(dailyForm.taskStatus||"")?"selected":""}>${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:#5C4A12;margin-bottom:3px">🗂️ Category</label>
              <select onchange="window.dailyForm.taskCategory=this.value;window.dailyForm.taskSubcategory='';render()" style="width:100%;padding:7px 8px;border:1px solid #C9A84C;border-radius:8px;font-size:12px;background:var(--card)">
                <option value="">— Select —</option>
                ${Object.keys(getTaskCategories()).map(c=>`<option value="${escapeHtml(c)}" ${c===(dailyForm.taskCategory||"")?"selected":""}>${escapeHtml(c)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:#5C4A12;margin-bottom:3px">📁 Subcategory</label>
              <select onchange="window.dailyForm.taskSubcategory=this.value" style="width:100%;padding:7px 8px;border:1px solid #C9A84C;border-radius:8px;font-size:12px;background:var(--card)" ${!dailyForm.taskCategory?'disabled':''}>
                <option value="">${dailyForm.taskCategory?'— Select —':'Pick category first'}</option>
                ${(getTaskCategories()[dailyForm.taskCategory]||[]).map(sc=>`<option value="${escapeHtml(sc)}" ${sc===(dailyForm.taskSubcategory||"")?"selected":""}>${escapeHtml(sc)}</option>`).join("")}
              </select>
            </div>
          </div>

          <!-- Resolution Text -->
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:12px;font-weight:700;color:#5C4A12;margin-bottom:4px">
              Work / Troubleshooting Description <span style="color:#C53030">*</span>
            </label>
            <textarea
              rows="3"
              placeholder="Briefly describe what was done, troubleshooting steps, issues resolved..."
              oninput="window.dailyForm.resolutionText=this.value"
              style="width:100%;padding:8px 10px;border:1px solid #C9A84C;border-radius:8px;font-family:inherit;font-size:13px;resize:vertical;background:var(--card)">${escapeHtml(dailyForm.resolutionText||"")}</textarea>
            <div style="font-size:10px;color:#7F6000;margin-top:3px">
              ${(dailyForm.resolutionText||"").length} characters · minimum 10 required
            </div>
          </div>

          <!-- Spare parts consumed (13-fieldops.js) -->
          ${typeof renderPartsLines==="function"?renderPartsLines():""}

          <!-- Image Upload -->
          <div>
            <label style="display:block;font-size:12px;font-weight:700;color:#5C4A12;margin-bottom:4px">
              Photos <span style="color:#C53030">*</span>
              <span style="font-weight:500;color:#7F6000;font-size:11px">(1-3 images, auto-compressed)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              id="resImageInput"
              onchange="handleResolutionImages(this.files)"
              ${(dailyForm.resolutionImages||[]).length >= 3 ? 'disabled' : ''}
              style="width:100%;padding:8px;border:1px dashed #C9A84C;border-radius:8px;background:var(--card);font-size:12px;cursor:pointer">
            <div style="font-size:10px;color:#7F6000;margin-top:3px">
              ${(dailyForm.resolutionImages||[]).length}/3 images uploaded
              ${(dailyForm.resolutionImages||[]).length >= 3 ? ' · Maximum reached. Remove one to add another.' : ''}
            </div>

            <!-- Image Previews -->
            ${(dailyForm.resolutionImages||[]).length > 0 ? `
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:10px">
                ${(dailyForm.resolutionImages||[]).map((img,idx)=>`
                  <div style="position:relative;border:2px solid #C9A84C;border-radius:8px;overflow:hidden;background:var(--card);aspect-ratio:1">
                    <img src="${img.data}" style="width:100%;height:100%;object-fit:cover;display:block" alt="Resolution ${idx+1}">
                    <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(27,58,107,0.85);color:white;padding:3px 5px;font-size:9px;font-weight:600;text-align:center">
                      ${img.sizeKB || base64SizeKB(img.data)} KB
                    </div>
                    ${isAdmin() ? `<button type="button" onclick="removeResolutionImage(${idx})" style="position:absolute;top:3px;right:3px;background:#C53030;color:white;border:none;width:24px;height:24px;border-radius:50%;cursor:pointer;font-weight:700;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.3)" title="Remove (Admin only)">×</button>` : ''}
                  </div>
                `).join("")}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveDaily()">${dailyEditId?"Update":"Add Entry"}</button>
      ${dailyEditId?`<button class="btn btn-ghost" onclick="cancelDaily()">Cancel</button>`:!isEmployee()?`<button class="btn btn-ghost" style="background:#FFF8E1;border:1px solid #C9A84C;color:#7F6000" onclick="saveDailyAndNext()" title="Save and keep ALL task details (incl. resolution) to add the same task for another employee">💾 Save & Add for Another Employee</button>`:""}
    </div>
  </div>

  ${!isEmployee() && locStats.length>0 ? `<div class="card">
    <div class="card-title">📍 Location Statistics</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
      ${locStats.map(l=>`
        <div style="border:1px solid var(--line);border-left:4px solid #2E5FA3;border-radius:8px;padding:10px 12px;background:var(--card)">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:0.5px">📍 ${escapeHtml(l.name)}</div>
          <div style="font-family:'DM Serif Display',serif;font-size:18px;color:#2E5FA3;margin-top:2px">${fmtHM(l.hours)}</div>
          <div style="font-size:10px;color:var(--muted)">${l.count} ${l.count===1?'entry':'entries'}</div>
        </div>
      `).join("")}
    </div>
  </div>` : ""}

  <div class="card">
    <div class="filter-row">
      <span class="card-title" style="margin:0">Work Log</span>
      <span class="count-pill">${rows.length}</span>
      <div style="display:flex;gap:6px;margin-left:auto;flex-wrap:wrap;align-items:center">
        <div style="display:flex;align-items:center;gap:3px;background:#f5f7ff;border:1px solid var(--line);border-radius:8px;padding:0 6px">
          <span style="font-size:10px;color:#888;white-space:nowrap"># Entry</span>
          <input type="number" min="1" placeholder="e.g. 12" value="${dailyEntryNo}"
            onchange="window.dailyEntryNo=this.value;render()"
            style="width:64px;border:none;background:transparent;font-size:11px;padding:5px 2px;outline:none">
          ${dailyEntryNo?`<button onclick="window.dailyEntryNo='';render()" style="border:none;background:none;cursor:pointer;color:#c62828;font-size:12px;padding:0 2px">${ICN.x}</button>`:""}
        </div>
        
      </div>
    </div>
    ${!isEmployee()?renderEmployeeFilterUI("Filter Work Log"):""}
    <div id="dailyListTop"></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th style="width:48px;text-align:center">#</th><th>Date</th>${!isEmployee()?"<th>Employee</th>":""}<th>Project</th><th>Dept</th><th>Location</th><th>Hrs</th><th>Resolution</th><th></th></tr></thead>
      <tbody>${rows.length===0?`<tr><td colspan="8" class="empty empty2"><span class="e-ic">🔧</span><div class="e-t">No work entries in this period</div><div class="e-m">Widen the date range — or add your first entry above</div></td></tr>`:(window._dailyShowAll?rows:rows.slice(0,50)).map(r=>{
        const canEdit=isHR()||r.employee===state.profile.employeeName;
        const imgs = (r.resolutionImages||[]);
        const hasRes = imgs.length > 0 || (r.resolutionText||"").length > 0;
        return `<tr>
          <td style="text-align:center;font-size:11px;font-weight:700;color:#03308B;background:#f0f4ff;white-space:nowrap">${r.entryNo ? formatEntryNo(r.entryNo) : '<span style="color:#bbb">—</span>'}</td>
          <td>${fmtDate(r.date)}${(()=>{ const b=apprBadge(r); if(!b) return "";
            const note = isRejectedAppr(r)&&r.approvalNote
              ? `<div style="font-size:var(--f-2xs);color:var(--danger);margin-top:3px;line-height:1.45;max-width:150px;white-space:normal">↩ ${escapeHtml(r.approvalNote)}</div>` : "";
            return `<div style="margin-top:4px">${b}${note}</div>`; })()}</td>
          ${!isEmployee()?`<td>${employeeBadge(r.employee)}${(r.gpsLat!=null||r.gpsDenied)&&typeof geoBadge==="function"?`<br>${geoBadge(r)}`:""}</td>`:""}
          <td>${escapeHtml(r.project||"")}${r.projectCode?` <span style="font-size:9px;background:#FFF3E0;color:#E65100;border:1px solid #EAD3AE;padding:1px 6px;border-radius:8px;font-weight:800">${escapeHtml(r.projectCode)}</span>`:""}${(r.area||r.site)?`<div style="font-size:10px;color:#1565C0;margin-top:2px">${r.area?`🗺️ ${escapeHtml(r.area)}`:''}${r.site?` · 📍 ${escapeHtml(r.site)}`:''}</div>`:''}</td>
          <td>${deptBadge(r.dept)}</td>
          <td>${r.location?`<span style="background:#E3F2FD;color:#1565C0;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">📍 ${escapeHtml(r.location)}</span>`:'<span style="color:#bbb;font-style:italic;font-size:11px">—</span>'} ${gpsBadgeHTML(r)}</td>
          <td><strong style="color:#2E7D32">${fmtHM(r.duration)}</strong></td>
          <td>${hasRes?`<button class="btn btn-sm" style="background:#FFF8E1;border:1px solid #C9A84C;color:#7F6000;font-weight:700" onclick="viewResolution('${r.id}')" title="View resolution">📷 ${imgs.length}</button>`:'<span style="color:#bbb;font-style:italic;font-size:11px">—</span>'}</td>
          <td>${canEdit?`<button class="btn btn-sm btn-secondary" onclick="editDaily('${r.id}')">${ICN.edit}</button>
              <button class="btn btn-sm btn-danger" onclick="delDaily('${r.id}')">${ICN.del}</button>`:""}${canUseWhatsApp() && (waGetSettings().triggers||[]).includes("daily")?`<button class="btn btn-sm" style="background:#25D366;color:white;border:none;font-weight:700;margin-left:4px" onclick="openWaShareById('${r.id}')" title="Share to WhatsApp">📲</button>`:""}${canUseEmail() && (emailGetSettings().triggers||[]).includes("daily")?`<button class="btn btn-sm" style="background:#03308B;color:white;border:none;font-weight:700;margin-left:4px" onclick="openEmailShareById('${r.id}')" title="Send Email">📧</button>`:""}</td>
        </tr>`;}).join("")}</tbody>
    </table></div>
    ${rows.length>50 && !window._dailyShowAll?`<div style="text-align:center;margin-top:10px"><button class="btn btn-ghost" style="background:#E3F2FD;border:1px solid #90CAF9;color:#1565C0;font-weight:700" onclick="window._dailyShowAll=true;render()">▼ Show all ${rows.length} entries (showing 50)</button></div>`:''}
    ${window._dailyShowAll && rows.length>50?`<div style="text-align:center;margin-top:10px"><button class="btn btn-ghost" style="background:#F5F5F5;border:1px solid #ccc;color:#666;font-weight:600" onclick="window._dailyShowAll=false;render()">▲ Show less (recent 50)</button></div>`:''}
  </div>`;
}

async function saveDaily(){
  // Specific validation messages — tell the user exactly what's missing
  if(isEmployee() && !state.profile.employeeName){
    return toast("⚠ Your account has no employee profile — contact your admin");
  }
  if(!dailyForm.employee) return toast("⚠ Employee field is empty");
  if(!dailyForm.date)     return toast("⚠ Date is required");
  if(!dailyForm.project)  return toast("⚠ Please select a Project");
  if(!dailyForm.location) return toast("⚠ Please select a Location");

  // ── Per-employee permission checks ──
  // Admin: resolution photos optional always. Employee: depends on their permission record.
  const perms = getEmpPermissions(dailyForm.employee);

  // Resolution validation for new entries
  if(!dailyEditId){
    const txt = (dailyForm.resolutionText||"").trim();
    if(isAdmin()){
      // Admin: text optional too if resolution not strictly needed — keep min text rule relaxed
      if(txt.length > 0 && txt.length < 10) return toast("Resolution description too short (min 10 chars)");
    } else if(perms.resolutionRequired){
      if(txt.length < 10) return toast("Resolution description required (min 10 chars)");
      if(!dailyForm.resolutionImages || dailyForm.resolutionImages.length < 1){
        return toast("At least 1 resolution photo is required");
      }
      // Technical classification also required when resolution is enabled
      if(!dailyForm.workType) return toast("⚠ Please select a Work Type");
      if(!dailyForm.taskStatus) return toast("⚠ Please select a Task Status");
      if(!dailyForm.taskCategory) return toast("⚠ Please select a Category");
      if(!dailyForm.taskSubcategory) return toast("⚠ Please select a Subcategory");
    }
  }

  // Area/Site requirement: if admin enabled it for this employee AND the project has areas,
  // the employee must pick an area and a site.
  if(!isAdmin() && perms.equipmentRequired){
    const proj = state.projects.find(p=>(p.name||"").trim()===(dailyForm.project||"").trim());
    const areas = proj ? getProjectAreas(proj).filter(a=>a.active!==false) : [];
    if(areas.length > 0){
      if(!dailyForm.area) return toast("⚠ Please select an Area (required)");
      const selArea = areas.find(a=>a.name===dailyForm.area);
      const sites = (selArea?.sites||[]).filter(s=>s.active!==false);
      if(sites.length > 0 && !dailyForm.site){
        return toast("⚠ Please select a Site (required)");
      }
    }
  }

  // Strict employee guard: force own name on save (defense in depth)
  // Supervisors may save for their team; plain employees are locked to themselves.
  if(isEmployee() && !isSupervisor()){
    dailyForm.employee = state.profile.employeeName;  // force override (validated above)
  } else if(isSupervisor() && !isHR()){
    // Supervisor: ensure the chosen employee is actually on their team
    const team = myTeamEmployees();
    if(!team.includes(dailyForm.employee)){
      return toast("⚠ You can only log for your team members");
    }
  }

  // ── GPS capture (new entries only) ──
  // Admin: GPS never forced. Employee: captured based on permission (but save allowed even if denied)
  let gpsData = {};
  if(!dailyEditId && !isAdmin() && perms.gpsRequired){
    toast("📡 Capturing GPS location...");
    const gps = await captureGPS();
    if(gps.denied){
      gpsData = { gpsDenied: gps.reason || "Location denied" };
      saveToast("⚠ Location unavailable — entry saved with 'GPS denied' note");
    } else {
      gpsData = { gpsLat: gps.lat, gpsLng: gps.lng, gpsAccuracy: gps.accuracy };
    }
  }

  // Auto-assign entry number for new entries only
  const entryNoToSave = dailyEditId ? undefined : getNextDailyEntryNo();
  const savedRecord = {
    ...dailyForm,
    duration:+timeToHrs(dailyForm.start,dailyForm.end).toFixed(4),
    dept:projDept(dailyForm.project),
    ...(entryNoToSave ? {entryNo: entryNoToSave} : {}),
    // Material consumption, sanitised: the spread above would persist blank
    // lines and string quantities. Each line keeps its OWN price so a later
    // catalogue change never rewrites a historical job cost.
    partsUsed: Array.isArray(dailyForm.partsUsed)
      ? dailyForm.partsUsed
          .filter(l => String((l&&(l.name||l.code))||"").trim() && Number((l&&l.qty)||0) > 0)
          .map(l => ({code:String(l.code||"").trim(), name:String(l.name||"").trim(),
                      unit:String(l.unit||"").trim(), qty:Number(l.qty||0),
                      unitCost: (l.unitCost===""||l.unitCost==null) ? 0 : Number(l.unitCost||0)}))
      : [],
  };
  const isNewDailyEntry = !dailyEditId;
  // New work enters the review queue. A reviewer's OWN entry is auto-approved
  // (nobody reviews themselves), and re-saving a RETURNED entry resubmits it —
  // which is precisely what acting on the reviewer's note means.
  const _prevRow  = dailyEditId ? (state.daily||[]).find(x=>x.id===dailyEditId) : null;
  const _selfRev  = (isAdmin()||isHR()) && !canApprove({employee: savedRecord.employee});
  const _apprNext = _selfRev ? APPR.APPROVED
                  : (isNewDailyEntry || !_prevRow || isRejectedAppr(_prevRow)) ? APPR.SUBMITTED
                  : apprOf(_prevRow);
  await fbSave("daily",{
    id:dailyEditId||undefined,
    ...savedRecord,
    approval:_apprNext,
    approvalNote: _apprNext===APPR.SUBMITTED ? "" : ((_prevRow&&_prevRow.approvalNote)||""),
    createdBy:state.profile.uid,
    ...gpsData,
  });

  // ── PM sync: a "Preventive Maintenance"-coded entry advances the Maintenance tab ──
  if(String(savedRecord.projectCode||"").trim().toLowerCase()==="preventive maintenance"
     && typeof window.pmOnDailySaved==="function"){
    window.pmOnDailySaved(savedRecord, !!dailyForm.pmFinal, isNewDailyEntry);
  }

  // ── Central device sync: if a device was selected and edited, update the devices collection ──
  if(dailyForm.deviceSerial && window._devEdit){
    const dev = (state.devices||[]).find(d=>d.serialNumber===dailyForm.deviceSerial);
    if(dev){
      const perms2 = getEmpPermissions(dailyForm.employee||state.profile.employeeName||"");
      const canFull = isAdmin() || perms2.fullDeviceEdit;
      // Basic fields everyone with tracking can update
      const patch = {
        status: window._devEdit.status ?? dev.status,
        installDate: window._devEdit.installDate ?? dev.installDate,
        updatedAt: new Date().toISOString(),
        updatedFrom: "daily-log",
        updatedByName: dailyForm.employee||state.profile.employeeName||"",
      };
      // Full-edit fields only if permitted
      if(canFull){
        if(window._devEdit.ipAddress !== undefined) patch.ipAddress = window._devEdit.ipAddress;
        if(window._devEdit.model !== undefined) patch.model = window._devEdit.model;
        if(window._devEdit.vendor !== undefined) patch.vendor = window._devEdit.vendor;
        if(window._devEdit.warrantyExp !== undefined) patch.warrantyExp = window._devEdit.warrantyExp;
        if(window._devEdit.stack !== undefined) patch.stack = window._devEdit.stack;
      }
      try{
        const {db, doc, setDoc} = window.__fb;
        await setDoc(doc(db,"devices",dev.id), patch, {merge:true});
        saveToast("📟 Device updated centrally ✓");
      }catch(e){ /* device sync is best-effort; entry already saved */ }
    }
  }
  window._devEdit = null;

  clearDailyDraft();                 // MUST run BEFORE render(): otherwise the
  window._draftToastShown=false;     // re-render finds the old draft and restores it
  dailyForm=null;dailyEditId=null;
  render();
  window.scrollTo({top:0, behavior:'smooth'});   // fresh blank form, back at Employee
  saveToast("Saved ✓");
  // WhatsApp stays manual (📲 button per row).
  // Email logic:
  //  - If a "Save & Add" sequence is in progress, this entry is the FINAL one:
  //    add it to the buffer and send ONE combined email for all employees now.
  //  - Otherwise, send a single auto-email for just this entry.
  if(isNewDailyEntry && (emailGetSettings().triggers||[]).includes("daily")){
    if(_emailBuffer.length > 0){
      _emailBuffer.push(savedRecord);          // include this last employee
      if(_emailBufferTimer){ clearTimeout(_emailBufferTimer); _emailBufferTimer = null; }
      flushTaskEmailBuffer();                  // combined email, immediately
    } else {
      autoSendTaskEmail(savedRecord);          // single-entry email
    }
  }
}
async function saveDailyAndNext(){
  if(!dailyForm.employee||!dailyForm.project||!dailyForm.date)return toast("Required: Employee, Date, Project");
  if(!dailyForm.location)return toast("Location is required");
  // Resolution validation (photos optional for Admin)
  const txt = (dailyForm.resolutionText||"").trim();
  if(txt.length < 10) return toast("Resolution description required (min 10 chars)");
  if(!isAdmin() && (!dailyForm.resolutionImages || dailyForm.resolutionImages.length < 1)){
    return toast("At least 1 resolution photo is required");
  }
  if(isEmployee()) return toast("Use Save for single entry");
  // Save first
  const entryNoNext = getNextDailyEntryNo();
  const recordForEmail = {
    ...dailyForm,
    duration:+timeToHrs(dailyForm.start,dailyForm.end).toFixed(4),
    dept:projDept(dailyForm.project),
    entryNo: entryNoNext,
  };
  await fbSave("daily",{
    id:undefined,
    ...recordForEmail,
    approval: ((isAdmin()||isHR()) && !canApprove({employee: recordForEmail.employee})) ? APPR.APPROVED : APPR.SUBMITTED,
    createdBy:state.profile.uid,
  });
  // Accumulate this entry for a SINGLE combined email (all employees on the task).
  // A debounce timer fires the email a few seconds after the last "Save & Add".
  if((emailGetSettings().triggers||[]).includes("daily")){
    bufferTaskEmail(recordForEmail);
  }
  // SAME TASK, ANOTHER EMPLOYEE: keep EVERYTHING the user filled —
  // date/time/project/location/area/site, equipment/device, the full
  // Resolution (work type, status, category, subcategory, text, photos)
  // and notes. Only the employee is cleared for the next person.
  const savedEmp = dailyForm.employee;
  window._devEdit = null;        // device-edit buffer applies to the saved entry only
  dailyForm = { ...dailyForm, employee: "" };
  saveDailyDraft();   // carried task survives even a sudden reload
  render();
  // Scroll back to the top of the form so the user clearly sees the fresh entry
  window.scrollTo({top:0, behavior:'smooth'});
  saveToast(`Saved for ${savedEmp} ✓ — same task ready for next employee`);
}

// ── Combined email buffer for "Save & Add for Another Employee" ──
// Collects entries, then sends ONE email listing all employees after a pause.
let _emailBuffer = [];
let _emailBufferTimer = null;
function bufferTaskEmail(record){
  _emailBuffer.push(record);
  if(_emailBufferTimer) clearTimeout(_emailBufferTimer);
  // Fallback: if the user never clicks the final "Add Work Entry", send the
  // combined email automatically 60s after the last "Save & Add".
  _emailBufferTimer = setTimeout(flushTaskEmailBuffer, 60000);
  toast(`📧 ${_emailBuffer.length} employee(s) queued — click "Add Work Entry" for the last one to send the combined email`);
}
async function flushTaskEmailBuffer(){
  if(_emailBuffer.length === 0) return;
  const entries = _emailBuffer.slice();
  _emailBuffer = [];
  if(_emailBufferTimer){ clearTimeout(_emailBufferTimer); _emailBufferTimer = null; }

  const s = emailGetSettings();
  if(!s.enabled || !s.autoSend) return;
  if(!s.serviceId || !s.templateId || !s.publicKey) return;
  if(typeof emailjs === "undefined") return;
  const recipients = resolveEmailRecipients();
  if(recipients.length === 0) return;

  // Build a combined body: shared task details + list of all employees
  const first = entries[0];
  const names = entries.map(e=>e.employee).filter(Boolean);
  const combined = { ...first, employee: names.join(", ") };
  const body = buildEmailBodyAuto(combined);

  try{
    emailjs.init({publicKey:s.publicKey});
    let sent = 0;
    for(const r of recipients){
      await emailjs.send(s.serviceId, s.templateId, {
        subject: s.subject || "New Task — EJAF Operations",
        message: body,
        to_email: r.email,
      });
      sent++;
    }
    toast(`📧 Combined email (${names.length} employees) sent to ${sent} recipient${sent>1?'s':''}`);
  }catch(e){
    toast("Auto-email failed: " + (e.text||e.message||"check setup"));
  }
}
window.flushTaskEmailBuffer = flushTaskEmailBuffer;

// ═══ RESOLUTION IMAGE HANDLERS ═══
async function handleResolutionImages(fileList){
  if(!fileList || fileList.length === 0) return;
  const current = dailyForm.resolutionImages || [];
  const remaining = 3 - current.length;
  if(remaining <= 0){
    toast("Maximum 3 images reached. Remove one first.");
    return;
  }
  const filesToProcess = Array.from(fileList).slice(0, remaining);
  toast(`Compressing ${filesToProcess.length} image(s)...`);
  try{
    for(const file of filesToProcess){
      // Reject files over 10MB raw (would be too slow to compress on phone)
      if(file.size > 10 * 1024 * 1024){
        toast(`${file.name} too large (max 10MB)`); continue;
      }
      const base64 = await compressImage(file, 1024, 0.6);
      const sizeKB = base64SizeKB(base64);
      if(sizeKB > 500){
        toast(`Image too large after compression (${sizeKB} KB). Skipped.`); continue;
      }
      current.push({ data: base64, sizeKB, addedAt: new Date().toISOString() });
    }
    dailyForm.resolutionImages = current;
    // Clear file input
    const inp = document.getElementById('resImageInput');
    if(inp) inp.value = '';
    render();
    toast(`✓ ${current.length} image(s) ready`);
  }catch(e){
    console.error(e);
    toast("Image processing failed: " + e.message);
  }
}

async function removeResolutionImage(index){
  if(!isAdmin()){
    toast("Only Admin can remove resolution images");
    return;
  }
  if(!await uiConfirm("Remove this resolution image?")) return;
  const arr = dailyForm.resolutionImages || [];
  arr.splice(index, 1);
  dailyForm.resolutionImages = arr;
  render();
  toast("Image removed");
}

// Remove a resolution image from a SAVED record (admin-only, for space cleanup)
async function deleteResolutionImageFromRecord(recordId, imageIndex){
  if(!isAdmin()){
    toast("Only Admin can delete resolution images from records");
    return;
  }
  if(!await uiConfirm(`Permanently remove image ${imageIndex+1} from this record?\nThis cannot be undone.`)) return;
  const rec = state.daily.find(r => r.id === recordId);
  if(!rec) return toast("Record not found");
  const imgs = (rec.resolutionImages || []).slice();
  imgs.splice(imageIndex, 1);
  await fbSave("daily", { ...rec, id: recordId, resolutionImages: imgs });
  toast(`Image removed. Record now has ${imgs.length} image(s).`);
}

// View resolution details in a modal overlay
function viewResolution(recordId){
  const r = state.daily.find(x => x.id === recordId);
  if(!r) return toast("Record not found");
  const imgs = r.resolutionImages || [];
  const txt = r.resolutionText || "";
  const overlay = document.createElement('div');
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,35,71,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--card);border-radius:16px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:0;box-shadow:0 24px 64px rgba(0,0,0,0.4)">
      <div style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;padding:16px 20px;border-radius:16px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11px;letter-spacing:2px;color:#C9A84C;font-weight:700">RESOLUTION</div>
          <div style="font-size:16px;font-weight:700;margin-top:2px">${escapeHtml(r.employee||"")} · ${fmtDate(r.date)}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:2px">${escapeHtml(r.project||"")}</div>
        </div>
        <button onclick="this.closest('div[style*=\\'position:fixed\\']').remove()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;font-weight:700">×</button>
      </div>
      <div style="padding:20px">
        ${(r.workType||r.taskStatus||r.taskCategory||r.taskSubcategory||r.area||r.site) ? `
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
            ${r.workType?`<span style="background:#E8EAF6;color:#3949AB;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700">🧭 ${escapeHtml(r.workType)}</span>`:''}
            ${r.taskStatus?`<span style="background:#E0F2F1;color:#00897B;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700">📊 ${escapeHtml(r.taskStatus)}</span>`:''}
            ${r.taskCategory?`<span style="background:#FCE4EC;color:#C2185B;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700">🗂️ ${escapeHtml(r.taskCategory)}${r.taskSubcategory?' › '+escapeHtml(r.taskSubcategory):''}</span>`:''}
            ${r.area?`<span style="background:#E8F5E9;color:#2E7D32;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700">🗺️ ${escapeHtml(r.area)}</span>`:''}
            ${r.site?`<span style="background:#E3F2FD;color:#1565C0;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700">📍 ${escapeHtml(r.site)}</span>`:''}
          </div>
        ` : ''}
        ${(()=>{ const b=apprBadge(r); if(!b) return "";
          const note = isRejectedAppr(r)&&r.approvalNote
            ? `<div style="font-size:var(--f-sm);color:var(--danger);margin-top:5px;line-height:1.55">↩ ${escapeHtml(r.approvalNote)}${r.approvalBy?` — ${escapeHtml(r.approvalBy)}`:""}</div>` : "";
          return `<div style="margin:0 0 10px">${b}${note}</div>`; })()}
        ${(()=>{   // ═══ WORK ITEM JOURNEY — this entry's place in the job's history ═══
          try{
            const all=(state.daily||[]).filter(x=>(x.project||"")===(r.project||"")&&(x.area||"")===(r.area||"")&&(x.site||"")===(r.site||""));
            const w=buildWorkItems(all).find(x=>x.entries.some(e=>e.id===r.id));
            if(!w||w.visits<2) return "";
            const idx=w.entries.findIndex(e=>e.id===r.id)+1;
            return `<div style="margin:0 0 14px;background:#F7F9FF;border:1px solid #DCE6F7;border-radius:8px;padding:10px 12px">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                <span style="font-size:10px;font-weight:800;color:#1B3A6B;letter-spacing:.4px">🧵 WORK ITEM · VISIT ${idx}/${w.visits}</span>
                <span style="font-size:10px;background:${w.closed?'#E8F5E9':'#FFF3E0'};color:${w.closed?'#2E7D32':'#E65100'};padding:2px 9px;border-radius:8px;font-weight:800">${escapeHtml(w.status)}</span>
                <span style="font-size:10px;color:#7A8AA0">${fmtHM(w.hours)} total</span>
              </div>
              <div style="display:flex;align-items:center;gap:0;flex-wrap:wrap">
                ${w.timeline.map((t,i)=>`${i?`<span style="color:#B8C6DC;margin:0 5px;font-size:11px">→</span>`:""}<span title="${escapeHtml(t.by)}" style="font-size:10px;background:var(--card);border:1px solid #DCE6F7;color:#1B3A6B;padding:3px 9px;border-radius:8px;font-weight:700">${escapeHtml(t.status)} <span style="color:#8A9AB0;font-weight:500">${fmtDate(t.date)}</span></span>`).join("")}
              </div>
            </div>`;
          }catch(e){ return ""; }
        })()}
        ${txt ? `
          <div style="margin-bottom:16px">
            <div style="font-size:11px;color:#7F6000;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">📋 Description</div>
            <div style="background:#FFFEF7;border-left:3px solid #C9A84C;padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.7;color:#1A202C;white-space:pre-wrap">${escapeHtml(txt)}</div>
          </div>
        ` : ''}
        ${imgs.length > 0 ? `
          <div>
            <div style="font-size:11px;color:#1B3A6B;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">📷 Photos (${imgs.length})</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
              ${imgs.map((img,idx)=>`
                <div style="border:2px solid #E0E6ED;border-radius:8px;overflow:hidden;background:#F7FAFC">
                  <img src="${img.data}" style="width:100%;height:auto;display:block;cursor:pointer" onclick="window.open('${img.data}','_blank')" alt="Photo ${idx+1}">
                  <div style="padding:5px 8px;background:#1B3A6B;color:white;font-size:10px;font-weight:600;display:flex;justify-content:space-between;align-items:center">
                    <span>📷 ${idx+1} · ${img.sizeKB||base64SizeKB(img.data)} KB</span>
                    ${isAdmin() ? `<button onclick="uiConfirm('Delete this image from this record?').then(ok=>{if(ok)deleteResolutionImageFromRecord('${recordId}',${idx});this.closest('div[style*=position]').remove()})" style="background:#C53030;color:white;border:none;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:700" title="Admin: Delete">×</button>` : ''}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
window.viewResolution = viewResolution;

// Bulk-purge resolution images older than N months (Admin only)
async function purgeResolutionImagesCustom(){
  if(!isAdmin()) return toast("Admin only");
  const from = document.getElementById("purgeFrom")?.value || "";
  const to   = document.getElementById("purgeTo")?.value   || "";
  const proj = document.getElementById("purgeProject")?.value || "";
  if(!from && !to && !proj){
    return toast("Select at least a date range or project");
  }
  const candidates = state.daily.filter(r => {
    if((r.resolutionImages||[]).length === 0) return false;
    if(from && (r.date||"") < from) return false;
    if(to   && (r.date||"") > to)   return false;
    if(proj && r.project !== proj)  return false;
    return true;
  });
  if(candidates.length === 0){
    return toast("No matching records with images found");
  }
  const desc = [
    from||to ? `Period: ${from||"start"} → ${to||"today"}` : "",
    proj ? `Project: ${proj}` : ""
  ].filter(Boolean).join("\n");
  if(!await uiConfirm(`Purge images from ${candidates.length} record(s)?\n${desc}\n\nText descriptions will be kept.\nThis cannot be undone.`)) return;
  let cleaned = 0;
  for(const rec of candidates){
    await fbSave("daily", { ...rec, id: rec.id, resolutionImages: [] });
    cleaned++;
  }
  toast(`✓ Cleaned ${cleaned} record(s) — space freed`);
}
window.purgeResolutionImagesCustom = purgeResolutionImagesCustom;
function editDaily(id){
  const r=state.daily.find(x=>x.id===id);
  if(r){
    dailyForm={
      ...r,
      location:r.location||"",
      resolutionText:r.resolutionText||"",
      resolutionImages:r.resolutionImages||[],
      deviceSerial:r.deviceSerial||"",
    };
    dailyEditId=id;
    // Pre-load the device edit buffer if this entry references a device
    if(r.deviceSerial){ window._loadDeviceEdit(r.deviceSerial); } else { window._devEdit = null; }
    render();
    window.scrollTo(0,0);
  }
}
async function delDaily(id){if(await uiConfirm("Delete this entry?")){await fbDelete("daily",id);toast("Deleted");}}
function cancelDaily(){dailyForm=null;dailyEditId=null;render();}
Object.assign(window,{
  saveDaily,saveDailyAndNext,editDaily,delDaily,cancelDaily,
  handleResolutionImages, removeResolutionImage,
  deleteResolutionImageFromRecord
});
Object.defineProperty(window,'dailyForm',{get:()=>dailyForm,set:v=>dailyForm=v});
Object.defineProperty(window,'dailyLocFilter',{get:()=>dailyLocFilter,set:v=>dailyLocFilter=v});
Object.defineProperty(window,'dailyFilter',{get:()=>dailyFilter,set:v=>dailyFilter=v});
Object.defineProperty(window,'dailyProjFilter',{get:()=>dailyProjFilter,set:v=>dailyProjFilter=v});
Object.defineProperty(window,'dailyEntryNo',{get:()=>dailyEntryNo,set:v=>dailyEntryNo=v});

// ═══════════════════════════════════════════════════════════════════════
//  OVERTIME
// ═══════════════════════════════════════════════════════════════════════
function renderOvertime(){
  rollAutoDate(window.otForm);
  if(!otForm){
    otForm={date:today(),dateAuto:true,employee:isEmployee()?state.profile.employeeName:"",hours:"",start:"",end:"",project:"",location:"",notes:""};
  }
  const dept=projDept(otForm.project),day=dayName(otForm.date);
  const rows=applyReportFilters(visibleRows(state.overtime));
  const empOptions=allEmployees();

  return `<div class="card">
    <div class="sec-hdr">${otEditId?"Edit":"Add"} Overtime</div>
    <div class="form-grid">
      <div class="field"><label>Employee <span class="req">*</span></label>
        ${isEmployee()?`<select onchange="window.otForm.employee=this.value;render()"><option value="${escapeHtml(state.profile.employeeName||"")}" selected>${escapeHtml(state.profile.employeeName||"")}</option></select>`:`<select onchange="window.otForm.employee=this.value;render()"><option value="">— Select —</option>${empOptions.map(e=>`<option ${e===otForm.employee?"selected":""}>${escapeHtml(e)}</option>`).join("")}</select>`}</div>
      <div class="field"><label>Date <span class="req">*</span></label><input type="date" value="${otForm.date}" onchange="window.otForm.date=this.value;window.otForm.dateAuto=false;render()"></div>
      <div class="field"><label>Start Time <span class="req">*</span></label>
        <input type="time" value="${otForm.start||''}" onchange="window.otForm.start=this.value;window.updateOTDuration();render()"></div>
      <div class="field"><label>End Time <span class="req">*</span></label>
        <input type="time" value="${otForm.end||''}" onchange="window.otForm.end=this.value;window.updateOTDuration();render()"></div>
      <div class="field"><label>OT Duration (auto)</label><div class="auto orange ${otForm.hours&&Number(otForm.hours)>0?"":"empty"}" style="font-weight:800;font-size:16px;color:#E65100">${otForm.hours&&Number(otForm.hours)>0?fmtHM(Number(otForm.hours)):"—"}</div></div>
      <div class="field"><label>Day (auto)</label><div class="auto green ${day?"":"empty"}">${day||"—"}</div></div>
      <div class="field full"><label>Project</label><select onchange="window.otForm.project=this.value;render()"><option value="">— Select —</option>${state.projects.map(p=>{const n=(p.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===(otForm.project||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}</select></div>
      <div class="field"><label>Dept (auto)</label><div class="auto purple ${dept?"":"empty"}">${dept||"—"}</div></div>
      <div class="field"><label>Location</label><select onchange="window.otForm.location=this.value"><option value="">— Select —</option>${state.locations.map(l=>{const n=(l.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===(otForm.location||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}</select></div>
      <div class="field full"><label>Notes</label><input value="${escapeHtml(otForm.notes||"")}" oninput="window.otForm.notes=this.value" placeholder="Optional"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveOT()">${otEditId?"Update":"Add"}</button>
      ${otEditId?`<button class="btn btn-ghost" onclick="cancelOT()">Cancel</button>`:!isEmployee()?`<button class="btn btn-ghost" style="background:#FFF8E1;border:1px solid #C9A84C;color:#7F6000" onclick="saveOTAndNext()" title="Save and keep date/hours/project to add same OT for another employee">💾 Save & Add for Another Employee</button>`:""}
    </div>
  </div>

  ${renderEmployeeFilterUI("Filter Overtime")}

  <div class="card">
    <div class="filter-row"><span class="card-title" style="margin:0">Overtime Log</span><span class="count-pill">${rows.length}</span></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>${!isEmployee()?"<th>Employee</th>":""}<th>Date</th><th>Day</th><th>Hrs</th><th>Project</th><th>Location</th><th></th></tr></thead>
      <tbody>${rows.length===0?`<tr><td colspan="7" class="empty empty2"><span class="e-ic">⏰</span><div class="e-t">No overtime recorded</div><div class="e-m">Overtime you log will appear here</div></td></tr>`:rows.map(r=>{
        const canEdit=isHR()||r.employee===state.profile.employeeName;
        return `<tr>
          ${!isEmployee()?`<td>${employeeBadge(r.employee)}${(r.gpsLat!=null||r.gpsDenied)&&typeof geoBadge==="function"?`<br>${geoBadge(r)}`:""}</td>`:""}
          <td>${fmtDate(r.date)}${r.start&&r.end?`<br><span style="font-size:10px;color:#888">${r.start}–${r.end}</span>`:""}</td><td style="color:#2E7D32;font-weight:700">${r.day||""}</td>
          <td><strong style="color:#E65100">${fmtHM(r.hours)}</strong></td>
          <td>${escapeHtml(r.project||"—")}</td><td>${escapeHtml(r.location||"—")}</td>
          <td>${canEdit?`<button class="btn btn-sm btn-secondary" onclick="editOT('${r.id}')">${ICN.edit}</button>
              <button class="btn btn-sm btn-danger" onclick="delOT('${r.id}')">${ICN.del}</button>`:""}</td>
        </tr>`;}).join("")}</tbody>
    </table></div>
  </div>`;
}
async function saveOT(){
  if(!otForm.employee||!otForm.date) return toast("Required: Employee and Date");
  if(!otForm.start||!otForm.end) return toast("Required: Start Time and End Time");
  const computed = timeToHrs(otForm.start, otForm.end);
  if(computed <= 0) return toast("End time must be after start time");
  otForm.hours = computed.toFixed(4);
  // Strict employee guard: force own name on save
  if(isEmployee()){
    if(!state.profile.employeeName) return toast("Your account has no employee profile. Contact admin.");
    otForm.employee = state.profile.employeeName;
  }
  await fbSave("overtime",{
    id:otEditId||undefined,
    ...otForm,hours:+otForm.hours,
    dept:projDept(otForm.project),day:dayName(otForm.date),
    createdBy:state.profile.uid,
  });
  const _wasEditOT=!!otEditId;
  otForm=null;otEditId=null;
  render(); window.scrollTo({top:0,behavior:'smooth'});   // fresh blank form (missing render() left dead inputs)
  toast(_wasEditOT?"Updated ✓":"Saved ✓");
}
async function saveOTAndNext(){
  if(!otForm.employee||!otForm.date)return toast("Required: Employee and Date");
  if(!otForm.start||!otForm.end) return toast("Required: Start Time and End Time");
  if(isEmployee()) return toast("Use Save for single entry");
  const computed = timeToHrs(otForm.start, otForm.end);
  if(computed <= 0) return toast("End time must be after start time");
  otForm.hours = computed.toFixed(4);
  await fbSave("overtime",{
    id:undefined,
    ...otForm,hours:+otForm.hours,
    dept:projDept(otForm.project),day:dayName(otForm.date),
    createdBy:state.profile.uid,
  });
  const savedEmp = otForm.employee;
  otForm = {...otForm, employee:""};
  render();
  saveToast(`Saved for ${savedEmp} ✓ — Select next employee`);
}
function editOT(id){const r=state.overtime.find(x=>x.id===id);if(r){otForm={...r,hours:String(r.hours||""),start:r.start||"",end:r.end||""};otEditId=id;render();window.scrollTo(0,0);}}
async function delOT(id){if(await uiConfirm("Delete?")){await fbDelete("overtime",id);toast("Deleted");}}
function cancelOT(){otForm=null;otEditId=null;render();}
Object.assign(window,{saveOT,saveOTAndNext,editOT,delOT,cancelOT});
window.updateOTDuration = function(){
  // Compute decimal hours from start/end times (same logic as Daily Log)
  const computed = timeToHrs(otForm.start, otForm.end);
  otForm.hours = computed > 0 ? computed.toFixed(4) : "";
};

Object.defineProperty(window,'otForm',{get:()=>otForm,set:v=>otForm=v});

// ═══════════════════════════════════════════════════════════════════════
//  TRAVEL
// ═══════════════════════════════════════════════════════════════════════
// Travel spans are INCLUSIVE: 20 → 22 Jul is 3 per-diem days.
function trDaysBetween(from,to){
  if(!from||!to) return 0;
  const a=new Date(from+"T00:00:00"), b=new Date(to+"T00:00:00");
  if(isNaN(a)||isNaN(b)) return 0;
  const n=Math.round((b-a)/86400000)+1;
  return n>0?n:0;
}
// Keep `days` (and therefore per diem) in sync with the chosen range
function trSyncDays(){
  const f=window.trForm; if(!f) return;
  if(f.date && f.dateTo){
    const n=trDaysBetween(f.date,f.dateTo);
    f.days = n>0 ? String(n) : "";
  }
  if(typeof render==="function") render();
}
Object.assign(window,{trDaysBetween,trSyncDays});

function renderTravel(){
  rollAutoDate(window.trForm);
  if(!trForm){
    trForm={date:today(),dateTo:today(),dateAuto:true,employee:isEmployee()?state.profile.employeeName:"",days:"1",project:"",location:"",notes:""};
  }
  const dept=projDept(trForm.project),pd=trForm.days?Number(trForm.days)*PER_DIEM_RATE:0;
  const rows=applyReportFilters(visibleRows(state.travel));
  const empOptions=allEmployees();

  return `<div class="card">
    <div class="sec-hdr">${trEditId?"Edit":"Add"} Travel</div>
    <div class="form-grid">
      <div class="field"><label>Employee <span class="req">*</span></label>
        ${isEmployee()?`<select onchange="window.trForm.employee=this.value;render()"><option value="${escapeHtml(state.profile.employeeName||"")}" selected>${escapeHtml(state.profile.employeeName||"")}</option></select>`:`<select onchange="window.trForm.employee=this.value;render()"><option value="">— Select —</option>${empOptions.map(e=>`<option ${e===trForm.employee?"selected":""}>${escapeHtml(e)}</option>`).join("")}</select>`}</div>
      <div class="field"><label>From <span class="req">*</span></label><input type="date" value="${trForm.date}" onchange="window.trForm.date=this.value;window.trForm.dateAuto=false;if(!window.trForm.dateTo||window.trForm.dateTo<this.value)window.trForm.dateTo=this.value;trSyncDays()"></div>
      <div class="field"><label>To <span class="req">*</span></label><input type="date" min="${trForm.date||""}" value="${trForm.dateTo||""}" onchange="window.trForm.dateTo=this.value;window.trForm.dateAuto=false;trSyncDays()"></div>
      <div class="field"><label>Days (auto)</label><div class="auto green ${Number(trForm.days)>0?"":"empty"}">${Number(trForm.days)>0?trForm.days+(Number(trForm.days)===1?" day":" days"):"—"}</div></div>
      <div class="field"><label>Per Diem (auto)</label><div class="auto yellow ${pd>0?"":"empty"}">${pd>0?fmtMoney(pd)+" IQD":"—"}</div></div>
      <div class="field full"><label>Project</label><select onchange="window.trForm.project=this.value;render()"><option value="">— Select —</option>${state.projects.map(p=>{const n=(p.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===(trForm.project||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}</select></div>
      <div class="field"><label>Dept (auto)</label><div class="auto purple ${dept?"":"empty"}">${dept||"—"}</div></div>
      <div class="field"><label>Location</label><select onchange="window.trForm.location=this.value"><option value="">— Select —</option>${state.locations.map(l=>{const n=(l.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===(trForm.location||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}</select></div>
      <div class="field"><label>Per Diem Status</label><select onchange="window.trForm.perDiemStatus=this.value;render()">
        <option value="received" ${(trForm.perDiemStatus||"received")==="received"?"selected":""}>✅ Received</option>
        <option value="not_received" ${trForm.perDiemStatus==="not_received"?"selected":""}>❌ Not Received</option>
      </select></div>
      <div class="field full"><label>Notes</label><input value="${escapeHtml(trForm.notes||"")}" oninput="window.trForm.notes=this.value" placeholder="Optional"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveTr()">${trEditId?"Update":"Add"}</button>
      ${trEditId?`<button class="btn btn-ghost" onclick="cancelTr()">Cancel</button>`:!isEmployee()?`<button class="btn btn-ghost" style="background:#FFF8E1;border:1px solid #C9A84C;color:#7F6000" onclick="saveTrAndNext()" title="Save and keep date/days/project to add same travel for another employee">💾 Save & Add for Another Employee</button>`:""}
      <span style="font-size:11px;color:var(--muted);align-self:center;margin-left:auto">Rate: 40,000 IQD/day</span>
    </div>
  </div>

  ${renderEmployeeFilterUI("Filter Travel")}

  <div class="card">
    <div class="filter-row"><span class="card-title" style="margin:0">Travel Log</span><span class="count-pill">${rows.length}</span></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>${!isEmployee()?"<th>Employee</th>":""}<th>From</th><th>To</th><th>Days</th><th>Project</th><th>Location</th><th>Per Diem</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.length===0?`<tr><td colspan="9" class="empty empty2"><span class="e-ic">✈️</span><div class="e-t">No trips recorded</div><div class="e-m">Travel entries with per-diem will appear here</div></td></tr>`:rows.map(r=>{
        const canEdit=isHR()||r.employee===state.profile.employeeName;
        const pdRec=(r.perDiemStatus||"received")==="received";
        return `<tr>
          ${!isEmployee()?`<td>${employeeBadge(r.employee)}${(r.gpsLat!=null||r.gpsDenied)&&typeof geoBadge==="function"?`<br>${geoBadge(r)}`:""}</td>`:""}
          <td>${fmtDate(r.date)}</td><td>${(()=>{const t=trEnd(r);return (t&&t!==r.date)?fmtDate(t):'<span style="color:#9AA7B8">—</span>';})()}</td><td>${r.days}</td>
          <td>${escapeHtml(r.project||"—")}</td><td>${escapeHtml(r.location||"—")}</td>
          <td><strong style="color:#7F6000">${fmtMoney(r.perDiem)}</strong></td>
          <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;background:${pdRec?'#E8F5E9':'#FFEBEE'};color:${pdRec?'#2E7D32':'#C62828'}">${pdRec?'✅ Received':'❌ Not Received'}</span></td>
          <td>${canEdit?`<button class="btn btn-sm btn-secondary" onclick="editTr('${r.id}')">${ICN.edit}</button>
              <button class="btn btn-sm btn-danger" onclick="delTr('${r.id}')">${ICN.del}</button>`:""}</td>
        </tr>`;}).join("")}</tbody>
    </table></div>
  </div>`;
}
async function saveTr(){
  if(!trForm.employee||!trForm.date||!trForm.dateTo)return toast("Required: Employee, From and To dates");
  if(trForm.dateTo<trForm.date) return toast("⚠ 'To' date cannot be before 'From'");
  trSyncDays();
  if(!Number(trForm.days)) return toast("⚠ Invalid travel range");
  // Strict employee guard: force own name on save
  if(isEmployee()){
    if(!state.profile.employeeName) return toast("Your account has no employee profile. Contact admin.");
    trForm.employee = state.profile.employeeName;
  }
  await fbSave("travel",{
    id:trEditId||undefined,
    ...trForm,days:+trForm.days,
    dateTo: trForm.dateTo||trForm.date,
    dept:projDept(trForm.project),
    perDiem:+trForm.days*PER_DIEM_RATE,
    perDiemStatus: trForm.perDiemStatus||"received",
    createdBy:state.profile.uid,
  });
  const _wasEditTr=!!trEditId;
  trForm=null;trEditId=null;
  render(); window.scrollTo({top:0,behavior:'smooth'});
  toast(_wasEditTr?"Updated ✓":"Saved ✓");
}
async function saveTrAndNext(){
  if(!trForm.employee||!trForm.date||!trForm.dateTo)return toast("Required: Employee, From and To dates");
  if(trForm.dateTo<trForm.date) return toast("⚠ 'To' date cannot be before 'From'");
  trSyncDays();
  if(!Number(trForm.days)) return toast("⚠ Invalid travel range");
  if(isEmployee()) return toast("Use Save for single entry");
  await fbSave("travel",{
    id:undefined,
    ...trForm,days:+trForm.days,
    dateTo: trForm.dateTo||trForm.date,
    dept:projDept(trForm.project),
    perDiem:+trForm.days*PER_DIEM_RATE,
    perDiemStatus: trForm.perDiemStatus||"received",
    createdBy:state.profile.uid,
  });
  const savedEmp = trForm.employee;
  trForm = {...trForm, employee:""};
  render();
  saveToast(`Saved for ${savedEmp} ✓ — Select next employee`);
}
function editTr(id){
  const r=state.travel.find(x=>x.id===id);
  if(!r) return;
  // Legacy rows stored only a start date + a day count — derive the end date
  // so the range picker shows something meaningful.
  let to=r.dateTo;
  if(!to && r.date && Number(r.days)>0){
    const d0=new Date(r.date+"T00:00:00");
    d0.setDate(d0.getDate()+Number(r.days)-1);
    to=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,"0")}-${String(d0.getDate()).padStart(2,"0")}`;
  }
  trForm={...r,days:String(r.days),dateTo:to||r.date,dateAuto:false};
  trEditId=id; render(); window.scrollTo(0,0);
}
async function delTr(id){if(await uiConfirm("Delete?")){await fbDelete("travel",id);toast("Deleted");}}
function cancelTr(){trForm=null;trEditId=null;render();}
Object.assign(window,{saveTr,saveTrAndNext,editTr,delTr,cancelTr});
Object.defineProperty(window,'trForm',{get:()=>trForm,set:v=>trForm=v});

// ═══════════════════════════════════════════════════════════════════════
//  LEAVES MODULE (vacations, sick days, etc.)
// ═══════════════════════════════════════════════════════════════════════
/* leave state hoisted to top (TDZ fix) */

const LEAVE_TYPES = [
  {id:"annual", label:"Annual Leave", color:"#2E7D32"},
  {id:"sick", label:"Sick Leave", color:"#C62828"},
  {id:"unpaid", label:"Unpaid Leave", color:"#6B7B8F"},
  {id:"emergency", label:"Emergency", color:"#E65100"},
  {id:"maternity", label:"Maternity/Paternity", color:"#6A1B9A"},
  {id:"other", label:"Other", color:"#1565C0"},
];

// Work day configuration (used for sub-day leave conversions)
const WORK_HOURS_PER_DAY = 9;       // 8:30 → 17:30 = 9 hours
const HALF_DAY_FIRST_START = "08:30";
const HALF_DAY_FIRST_END   = "13:00";
const HALF_DAY_SECOND_START= "13:00";
const HALF_DAY_SECOND_END  = "17:30";
const HALF_DAY_HOURS = 4.5;          // each half = 4.5 hours

function leaveTypeInfo(id){
  return LEAVE_TYPES.find(t=>t.id===id) || LEAVE_TYPES[LEAVE_TYPES.length-1];
}

function leaveTypeBadge(type){
  const t = leaveTypeInfo(type);
  return `<span style="background:${t.color}22;color:${t.color};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px">${t.label}</span>`;
}

function daysBetween(from, to){
  if(!from || !to) return 0;
  const d1 = new Date(from), d2 = new Date(to);
  const diff = Math.round((d2 - d1) / (1000*60*60*24)) + 1;
  return Math.max(0, diff);
}

// Compute total hours for a leave entry based on its kind
// Returns { hours, days } where days = hours / WORK_HOURS_PER_DAY
function computeLeaveAmount(leave){
  const kind = leave.kind || "full";
  if(kind === "full"){
    const days = daysBetween(leave.from, leave.to);
    return { hours: days * WORK_HOURS_PER_DAY, days: days, label: `${days} day${days===1?'':'s'}` };
  }
  if(kind === "half"){
    const halfLabel = leave.halfPart === "second" ? "Second Half (13:00-17:30)" : "First Half (08:30-13:00)";
    return { hours: HALF_DAY_HOURS, days: HALF_DAY_HOURS / WORK_HOURS_PER_DAY, label: halfLabel };
  }
  if(kind === "hourly"){
    const h = timeToHrs(leave.startTime, leave.endTime);
    return { hours: h, days: h / WORK_HOURS_PER_DAY, label: `${leave.startTime || '?'} → ${leave.endTime || '?'} (${fmtHM(h)})` };
  }
  return { hours: 0, days: 0, label: "" };
}

function leaveKindBadge(kind){
  const map = {
    full:    { label: "Full Day",  color: "#2E7D32" },
    half:    { label: "Half Day",  color: "#E65100" },
    hourly:  { label: "Hourly",    color: "#1565C0" },
  };
  const m = map[kind || "full"];
  return `<span style="background:${m.color}22;color:${m.color};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px">${m.label}</span>`;
}

function renderLeaves(){
  if(!leaveForm){
    leaveForm = {
      employee: isEmployee() ? state.profile.employeeName : "",
      type: "annual",
      kind: "full",
      from: today(),
      to: today(),
      halfPart: "first",            // for half-day: "first" or "second"
      startTime: "10:00",            // for hourly
      endTime: "12:00",
      notes: "",
    };
  }
  const emps = isEmployee() ? [state.profile.employeeName] : allEmployees();
  const visibleLeaves = applyReportFilters(
    isEmployee()
      ? state.leaves.filter(l => l.employee === state.profile.employeeName)
      : state.leaves,
    "from"
  );

  // Compute current form amount preview
  const formAmount = computeLeaveAmount(leaveForm);

  // Stats per type (sum hours + equivalent days)
  const stats = LEAVE_TYPES.map(t => {
    const items = visibleLeaves.filter(l => l.type === t.id);
    const totalHours = items.reduce((s,l)=> s + Number(l.hours || (Number(l.days||0) * WORK_HOURS_PER_DAY)), 0);
    const totalDays = totalHours / WORK_HOURS_PER_DAY;
    return {...t, count: items.length, hours: totalHours, days: totalDays};
  });

  // Annual leaves can use kind selector; others are full-day only
  const isAnnual = leaveForm.type === "annual";
  if(!isAnnual) leaveForm.kind = "full";  // force full-day for non-annual

  return `<div class="card">
    <div class="sec-hdr">${leaveEditId?"Edit":"Add"} Leave</div>
    <div class="form-grid">
      <div class="field"><label>Employee <span class="req">*</span></label>
        ${isEmployee()
          ? `<select onchange="window.leaveForm.employee=this.value;render()"><option value="${escapeHtml(state.profile.employeeName||"")}" selected>${escapeHtml(state.profile.employeeName||"")}</option></select>`
          : `<select onchange="window.leaveForm.employee=this.value;render()">
              <option value="">— Select —</option>
              ${emps.map(e=>`<option value="${escapeHtml(e)}" ${e===leaveForm.employee?"selected":""}>${escapeHtml(e)}</option>`).join("")}
            </select>`}
      </div>
      <div class="field"><label>Leave Type <span class="req">*</span></label>
        <select onchange="window.leaveForm.type=this.value;if(this.value!=='annual')window.leaveForm.kind='full';render()">
          ${LEAVE_TYPES.map(t=>`<option value="${t.id}" ${leaveForm.type===t.id?"selected":""}>${t.label}</option>`).join("")}
        </select>
      </div>

      ${isAnnual ? `<div class="field full" style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:10px">
        <label style="color:#7F6000;font-size:12px;font-weight:700">Annual Leave Kind</label>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          <label style="flex:1;min-width:100px;cursor:pointer;display:flex;align-items:center;gap:6px;padding:8px 10px;border:2px solid ${leaveForm.kind==='full'?'#2E7D32':'#E0E0E0'};border-radius:8px;background:${leaveForm.kind==='full'?'#E8F5E9':'white'};transition:all 0.2s">
            <input type="radio" name="leavekind" value="full" ${leaveForm.kind==='full'?'checked':''} onchange="window.leaveForm.kind='full';render()" style="margin:0">
            <span style="font-size:13px;font-weight:600;color:${leaveForm.kind==='full'?'#2E7D32':'#666'}">📅 Full Day</span>
          </label>
          <label style="flex:1;min-width:100px;cursor:pointer;display:flex;align-items:center;gap:6px;padding:8px 10px;border:2px solid ${leaveForm.kind==='half'?'#E65100':'#E0E0E0'};border-radius:8px;background:${leaveForm.kind==='half'?'#FFF3E0':'white'};transition:all 0.2s">
            <input type="radio" name="leavekind" value="half" ${leaveForm.kind==='half'?'checked':''} onchange="window.leaveForm.kind='half';render()" style="margin:0">
            <span style="font-size:13px;font-weight:600;color:${leaveForm.kind==='half'?'#E65100':'#666'}">🌓 Half Day</span>
          </label>
          <label style="flex:1;min-width:100px;cursor:pointer;display:flex;align-items:center;gap:6px;padding:8px 10px;border:2px solid ${leaveForm.kind==='hourly'?'#1565C0':'#E0E0E0'};border-radius:8px;background:${leaveForm.kind==='hourly'?'#E3F2FD':'white'};transition:all 0.2s">
            <input type="radio" name="leavekind" value="hourly" ${leaveForm.kind==='hourly'?'checked':''} onchange="window.leaveForm.kind='hourly';render()" style="margin:0">
            <span style="font-size:13px;font-weight:600;color:${leaveForm.kind==='hourly'?'#1565C0':'#666'}">🕐 Hourly</span>
          </label>
        </div>
      </div>` : ""}

      ${leaveForm.kind === "full" ? `
        <div class="field"><label>From <span class="req">*</span></label>
          <input type="date" value="${leaveForm.from}" onchange="window.leaveForm.from=this.value;render()"></div>
        <div class="field"><label>To <span class="req">*</span></label>
          <input type="date" value="${leaveForm.to}" onchange="window.leaveForm.to=this.value;render()"></div>
      ` : `
        <div class="field"><label>Date <span class="req">*</span></label>
          <input type="date" value="${leaveForm.from}" onchange="window.leaveForm.from=this.value;window.leaveForm.to=this.value;render()"></div>
      `}

      ${leaveForm.kind === "half" ? `
        <div class="field"><label>Which Half? <span class="req">*</span></label>
          <select onchange="window.leaveForm.halfPart=this.value;render()">
            <option value="first" ${leaveForm.halfPart==='first'?'selected':''}>🌅 First Half — 08:30 to 13:00 (Late Arrival)</option>
            <option value="second" ${leaveForm.halfPart==='second'?'selected':''}>🌇 Second Half — 13:00 to 17:30 (Early Leave)</option>
          </select>
        </div>
      ` : ""}

      ${leaveForm.kind === "hourly" ? `
        <div class="field"><label>Start Time <span class="req">*</span></label>
          <input type="time" value="${leaveForm.startTime}" onchange="window.leaveForm.startTime=this.value;render()"></div>
        <div class="field"><label>End Time <span class="req">*</span></label>
          <input type="time" value="${leaveForm.endTime}" onchange="window.leaveForm.endTime=this.value;render()"></div>
      ` : ""}

      <div class="field"><label>Duration (auto)</label>
        <input value="${formAmount.label}" disabled style="background:#E8F2E8;color:#2E7D32;font-weight:700"></div>
      <div class="field"><label>Equivalent</label>
        <input value="${formAmount.hours.toFixed(2)}h = ${formAmount.days.toFixed(2)} day${formAmount.days===1?'':'s'}" disabled style="background:#F0F4FA;color:#1B3A6B;font-weight:700;font-family:Georgia,serif"></div>
      <div class="field full"><label>Preview</label>
        <div style="padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);display:flex;align-items:center;gap:8px;flex-wrap:wrap">${leaveTypeBadge(leaveForm.type)} ${leaveKindBadge(leaveForm.kind)}</div></div>
      <div class="field full"><label>Notes</label>
        <input value="${escapeHtml(leaveForm.notes||'')}" oninput="window.leaveForm.notes=this.value" placeholder="Reason or additional info (optional)"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveLeave()">${leaveEditId?"Update":"Add Leave"}</button>
      ${leaveEditId?`<button class="btn btn-ghost" onclick="cancelLeave()">Cancel</button>`:!isEmployee()?`<button class="btn btn-ghost" style="background:#FFF8E1;border:1px solid #C9A84C;color:#7F6000" onclick="saveLeaveAndNext()" title="Save and keep dates/type to add same leave for another employee">💾 Save & Add for Another Employee</button>`:""}
    </div>
  </div>

  ${!isEmployee() ? `<div class="card">
    <div class="card-title">📊 Leave Summary</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
      ${stats.filter(s=>s.count>0).map(s=>`
        <div style="border:1px solid var(--line);border-left:4px solid ${s.color};border-radius:8px;padding:10px 12px;background:var(--card)">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:0.5px">${s.label}</div>
          <div style="font-family:'DM Serif Display',serif;font-size:22px;color:${s.color};margin-top:2px">${s.days.toFixed(2)} <span style="font-size:12px;color:var(--muted);font-family:inherit">days</span></div>
          <div style="font-size:11px;color:${s.color};font-weight:600">${s.hours.toFixed(1)}h equivalent</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">${s.count} leave${s.count===1?'':'s'}</div>
        </div>
      `).join("") || '<div class="empty">No leaves recorded yet</div>'}
    </div>
    <div style="margin-top:10px;padding:8px 12px;background:#F0F4FA;border-radius:8px;font-size:11px;color:var(--muted);font-style:italic">
      💡 Equivalent days = total hours ÷ ${WORK_HOURS_PER_DAY} (work day length)
    </div>
  </div>` : ""}

  ${renderEmployeeFilterUI("Filter Leaves")}

  <div class="card">
    <div class="card-title">Leave Log · ${visibleLeaves.length}</div>
    ${visibleLeaves.length===0?`<div class="empty empty2"><span class="e-ic">🌴</span><div class="e-t">No leaves recorded</div><div class="e-m">Approved leaves will show up here</div></div>`:`
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>
        <th>Employee</th><th>Type</th><th>Kind</th><th>Date</th><th>Detail</th><th>Hours</th><th>Days Eq.</th><th>Notes</th><th></th>
      </tr></thead>
      <tbody>${visibleLeaves
        .slice()
        .sort((a,b)=>(b.from||"").localeCompare(a.from||""))
        .map(l=>{
          const lk = l.kind || "full";
          const amt = computeLeaveAmount(l);
          const dateStr = (l.from === l.to || !l.to) ? (l.from||'') : `${l.from} → ${l.to}`;
          let detail = '';
          if(lk === 'full') detail = `${daysBetween(l.from, l.to)} day${daysBetween(l.from,l.to)===1?'':'s'}`;
          else if(lk === 'half') detail = l.halfPart==='second' ? '13:00→17:30' : '08:30→13:00';
          else if(lk === 'hourly') detail = `${l.startTime||'?'}→${l.endTime||'?'}`;
          return `<tr>
            <td><strong>${escapeHtml(l.employee||'')}</strong></td>
            <td>${leaveTypeBadge(l.type)}</td>
            <td>${leaveKindBadge(lk)}</td>
            <td style="font-size:12px">${escapeHtml(dateStr)}</td>
            <td style="font-size:12px;color:var(--muted)">${detail}</td>
            <td style="font-weight:700;color:#1B3A6B">${amt.hours.toFixed(2)}h</td>
            <td style="font-weight:700;color:${leaveTypeInfo(l.type).color}">${amt.days.toFixed(2)}</td>
            <td style="font-size:11px;color:var(--muted);max-width:150px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(l.notes||'')}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="editLeave('${l.id}')">${ICN.edit}</button>
              ${(isHR()||l.employee===state.profile.employeeName)?`<button class="btn btn-sm btn-danger" onclick="delLeave('${l.id}')">${ICN.del}</button>`:''}
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table></div>`}
  </div>`;
}

async function saveLeave(){
  if(!leaveForm.employee)return toast("Employee required");
  // Strict employee guard: force own name on save
  if(isEmployee()){
    if(!state.profile.employeeName) return toast("Your account has no employee profile. Contact admin.");
    leaveForm.employee = state.profile.employeeName;
  }
  const kind = leaveForm.kind || "full";
  if(kind === "full"){
    if(!leaveForm.from || !leaveForm.to) return toast("From and To dates required");
    if(leaveForm.from > leaveForm.to) return toast("From date must be before To date");
  } else if(kind === "half"){
    if(!leaveForm.from) return toast("Date required");
    leaveForm.to = leaveForm.from;
    if(!leaveForm.halfPart) leaveForm.halfPart = "first";
  } else if(kind === "hourly"){
    if(!leaveForm.from) return toast("Date required");
    if(!leaveForm.startTime || !leaveForm.endTime) return toast("Start and End times required");
    if(leaveForm.startTime >= leaveForm.endTime) return toast("End must be after Start");
    leaveForm.to = leaveForm.from;
  }
  const amount = computeLeaveAmount(leaveForm);
  await fbSave("leaves", {
    id: leaveEditId || undefined,
    ...leaveForm,
    hours: amount.hours,
    days: amount.days,
    createdBy: state.profile.uid,
  });
  const _wasEditLv = !!leaveEditId;
  leaveForm = null; leaveEditId = null;
  render(); window.scrollTo({top:0,behavior:'smooth'});
  toast(_wasEditLv ? "Updated ✓" : "Added ✓");
}
async function saveLeaveAndNext(){
  if(!leaveForm.employee)return toast("Employee required");
  if(isEmployee()) return toast("Use Save for single entry");
  const kind = leaveForm.kind || "full";
  if(kind === "full"){
    if(!leaveForm.from || !leaveForm.to) return toast("From and To dates required");
    if(leaveForm.from > leaveForm.to) return toast("From date must be before To date");
  } else if(kind === "half"){
    if(!leaveForm.from) return toast("Date required");
    leaveForm.to = leaveForm.from;
  } else if(kind === "hourly"){
    if(!leaveForm.from) return toast("Date required");
    if(!leaveForm.startTime || !leaveForm.endTime) return toast("Start and End times required");
    if(leaveForm.startTime >= leaveForm.endTime) return toast("End must be after Start");
    leaveForm.to = leaveForm.from;
  }
  const amount = computeLeaveAmount(leaveForm);
  await fbSave("leaves", {
    id: undefined,
    ...leaveForm,
    hours: amount.hours,
    days: amount.days,
    createdBy: state.profile.uid,
  });
  const savedEmp = leaveForm.employee;
  leaveForm = {...leaveForm, employee:""};
  render();
  saveToast(`Saved for ${savedEmp} ✓ — Select next employee`);
}
function editLeave(id){
  const r = state.leaves.find(x=>x.id===id);
  if(r){
    // Ensure backward compatibility - older entries won't have kind/hours
    const leave = {...r, kind: r.kind || "full"};
    if(!leave.startTime) leave.startTime = "10:00";
    if(!leave.endTime) leave.endTime = "12:00";
    if(!leave.halfPart) leave.halfPart = "first";
    leaveForm = leave;
    leaveEditId = id;
    render();
    window.scrollTo(0,0);
  }
}
async function delLeave(id){
  if(await uiConfirm("Delete this leave entry?")){ await fbDelete("leaves", id); toast("Deleted"); }
}
function cancelLeave(){ leaveForm = null; leaveEditId = null; render(); }
Object.assign(window, {saveLeave, saveLeaveAndNext, editLeave, delLeave, cancelLeave});
Object.defineProperty(window, 'leaveForm', {get:()=>leaveForm, set:v=>leaveForm=v, configurable:true});


// ═══════════════════════════════════════════════════════════════════════
//  HR REPORT
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
//  TECHNICAL REPORT — EXPORTS (PDF + Excel)
// ═══════════════════════════════════════════════════════════════════════
window.exportTechPDF = async function(){
  if(!canSeeReports()) return toast("Access denied");
  const rows = apprFilter(applyReportFilters(visibleRows(state.daily))).sort((a,b)=>{
    const d=(a.date||"").localeCompare(b.date||"");
    return d!==0?d:(a.entryNo||0)-(b.entryNo||0);
  });
  const cols = activeTechCols();
  const colDefs = TECH_COLUMNS.filter(c=>cols.includes(c.key));
  const period = getPeriod();
  const totalTasks = rows.length;
  const totalHours = rows.reduce((s,r)=>s+Number(r.duration||0),0);
  const workDays = new Set(rows.map(r=>`${r.employee}|${r.date}`)).size;
  const byCat = {}; rows.forEach(r=>{const c=r.taskCategory||"(none)";byCat[c]=(byCat[c]||0)+1;});
  const byStatus = statusCountsByWorkItem(rows);   // v125: count work items, not entries
  const lbl = (typeof reportFilterLabel==="function")?reportFilterLabel():"";

  const cellVal = (r,key)=>{
    if(key==="hours") return fmtHM(r.duration);
    if(key==="date") return fmtDate(r.date);
    if(key==="day") return r.day || dayName(r.date);
    if(key==="time") return (r.start&&r.end)?`${r.start}–${r.end}`:"";
    if(key&&key.startsWith("dev_")) return escapeHtml(techDeviceValue(r, key));
    if(key==="resolutionText") return escapeHtml(r.resolutionText||"");
    return escapeHtml(String(r[key]||""));
  };

  const bodyHTML = `
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 In the print dialog, choose <strong>"Save as PDF"</strong>
      <br><br><button onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888">Close</button>
    </div>
    ${lbl?`<div style="font-size:11px;color:#03308B;background:#f0f4ff;border-radius:8px;padding:7px 12px;margin-bottom:12px"><strong>Filter:</strong> ${escapeHtml(lbl)}</div>`:''}
    <div class="ksec"><span class="kbad">01</span><h3>Executive Summary</h3></div>
    <div class="kr">
      <div class="kc kb"><div class="kl">Total Tasks</div><div class="kv">${totalTasks}</div><div class="ks">tasks</div></div>
      <div class="kc ko"><div class="kl">Total Hours</div><div class="kv">${fmtHM(totalHours)}</div><div class="ks">logged</div></div>
      <div class="kc kg"><div class="kl">Work Days</div><div class="kv">${workDays}</div><div class="ks">employee-days</div></div>
    </div>
    <div class="ksec"><span class="kbad">02</span><h3>Breakdown</h3></div>
    <table><thead><tr><th>Category</th><th style="text-align:right">Tasks</th></tr></thead>
      <tbody>${Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]).map(c=>`<tr><td>${escapeHtml(c)}</td><td style="text-align:right;font-weight:700">${byCat[c]}</td></tr>`).join("")}</tbody></table>
    <table><thead><tr><th>Status (by work item)</th><th style="text-align:right">Work items</th></tr></thead>
      <tbody>${Object.keys(byStatus).sort((a,b)=>byStatus[b]-byStatus[a]).map(s=>`<tr><td>${escapeHtml(s)}</td><td style="text-align:right;font-weight:700">${byStatus[s]}</td></tr>`).join("")}</tbody></table>
    ${(typeof workItemsReportHTML==="function")?workItemsReportHTML(rows,"03"):""}
    <div class="ksec"><span class="kbad">04</span><h3>Detailed Entries (${rows.length})</h3></div>
    <table><thead><tr>${colDefs.map(c=>`<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${colDefs.map(c=>`<td>${cellVal(r,c.key)}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  await openReportPDF("TECHNICAL_REPORT", period, bodyHTML);
  toast("PDF export ready!");
};

window.exportTechExcel = async function(){
  if(!canSeeReports()) return toast("Access denied");
  try{
    const rows = apprFilter(applyReportFilters(visibleRows(state.daily))).sort((a,b)=>{
      const d=(a.date||"").localeCompare(b.date||"");
      return d!==0?d:(a.entryNo||0)-(b.entryNo||0);
    });
    const cols = activeTechCols();
    const colDefs = TECH_COLUMNS.filter(c=>cols.includes(c.key));
    const wb = XLSX.utils.book_new();
    const NAVY="03308B", GOLD="C9A84C", WHITE="FFFFFF";
    const hd={font:{bold:true,sz:10,color:{rgb:WHITE}},fill:{fgColor:{rgb:NAVY}}};
    const setC=(ws,a,v,s)=>{ws[a]={v:v,t:typeof v==='number'?'n':'s'};if(s)ws[a].s=s;};

    // Sheet 1: Tasks
    const ws={};
    const colLetter=(n)=>{let s="";n++;while(n>0){let m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;};
    const lastCol=colLetter(colDefs.length-1);
    // Branded title banner (navy background, gold text) — matches HR report
    setC(ws,'A1',`EJAF  •  TECHNICAL REPORT  —  ${getPeriod()}`,{font:{bold:true,sz:16,color:{rgb:GOLD}},fill:{fgColor:{rgb:NAVY}},alignment:{horizontal:"center",vertical:"center"}});
    ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:colDefs.length-1}}];
    colDefs.forEach((c,i)=>setC(ws,`${colLetter(i)}2`,c.label,hd));
    rows.forEach((r,ri)=>{
      colDefs.forEach((c,ci)=>{
        let v=r[c.key]||"";
        if(c.key==="hours")v=fmtHM(r.duration);
        else if(c.key==="time")v=(r.start&&r.end)?`${r.start}–${r.end}`:"";
        else if(c.key==="date")v=fmtDate(r.date);
        else if(c.key==="day")v=r.day||dayName(r.date);
        else if(c.key&&c.key.startsWith("dev_"))v=techDeviceValue(r, c.key);
        setC(ws,`${colLetter(ci)}${ri+3}`,v,{font:{sz:10},fill:{fgColor:{rgb:ri%2?"F0F4FF":WHITE}}});
      });
    });
    ws['!ref']=`A1:${lastCol}${rows.length+2}`;
    ws['!cols']=colDefs.map(()=>({wch:16}));
    ws['!rows']=[{hpt:26}];
    XLSX.utils.book_append_sheet(wb,ws,"Technical Tasks");

    // Sheet 2: Summary
    const byCat={};rows.forEach(r=>{const c=r.taskCategory||"(none)";byCat[c]=(byCat[c]||0)+1;});
    const byStatus=statusCountsByWorkItem(rows);   // v125: count work items, not entries
    const _wis=(typeof buildWorkItems==="function")?buildWorkItems(rows):[];
    const ws2={};
    setC(ws2,'A1','TECHNICAL SUMMARY',{font:{bold:true,sz:14,color:{rgb:GOLD}},fill:{fgColor:{rgb:NAVY}}});
    setC(ws2,'A3','Total Tasks',{font:{bold:true}});setC(ws2,'B3',rows.length);
    setC(ws2,'A4','Total Hours',{font:{bold:true}});setC(ws2,'B4',fmtHM(rows.reduce((s,r)=>s+Number(r.duration||0),0)));
    setC(ws2,'A5','Work Days',{font:{bold:true}});setC(ws2,'B5',new Set(rows.map(r=>`${r.employee}|${r.date}`)).size);
    setC(ws2,'A7','BY CATEGORY',hd);setC(ws2,'B7','Count',hd);
    let rr=8;Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]).forEach(c=>{setC(ws2,`A${rr}`,c);setC(ws2,`B${rr}`,byCat[c]);rr++;});
    rr++;setC(ws2,`A${rr}`,'BY STATUS',hd);setC(ws2,`B${rr}`,'Count',hd);rr++;
    Object.keys(byStatus).sort((a,b)=>byStatus[b]-byStatus[a]).forEach(s=>{setC(ws2,`A${rr}`,s);setC(ws2,`B${rr}`,byStatus[s]);rr++;});
    ws2['!ref']=`A1:B${rr}`;ws2['!cols']=[{wch:24},{wch:12}];
    XLSX.utils.book_append_sheet(wb,ws2,"Summary");

    // Sheet 3: Work Items — one row per JOB with its full status journey
    if(_wis.length){
      const ws3={};
      setC(ws3,'A1','WORK ITEMS',{font:{bold:true,sz:14,color:{rgb:GOLD}},fill:{fgColor:{rgb:NAVY}}});
      setC(ws3,'A2',`${_wis.length} job(s) · ${_wis.filter(w=>!w.closed).length} still open · from ${rows.length} entries`,{font:{italic:true,sz:10,color:{rgb:"6B7B8F"}}});
      const hdr=['Work item','Scope','First','Last','Status journey','Current status','Visits','Hours','Team'];
      hdr.forEach((h,i)=>setC(ws3,String.fromCharCode(65+i)+'4',h,{font:{bold:true,color:{rgb:"FFFFFF"}},fill:{fgColor:{rgb:NAVY}}}));
      _wis.forEach((w,i)=>{
        const row=5+i;
        const vals=[w.title,w.scopeLabel,w.firstDate,w.lastDate,w.timeline.map(t=>t.status).join(" → "),w.status,w.visits,fmtHM(w.hours),w.employees.join(", ")];
        vals.forEach((v,j)=>setC(ws3,String.fromCharCode(65+j)+row,v,{}));
      });
      ws3['!ref']=`A1:I${4+_wis.length}`;
      ws3['!cols']=[{wch:26},{wch:30},{wch:11},{wch:11},{wch:34},{wch:14},{wch:7},{wch:9},{wch:20}];
      XLSX.utils.book_append_sheet(wb,ws3,"Work Items");
    }

    XLSX.writeFile(wb,`EJAF_Technical_Report_${todayStr()}.xlsx`);
    toast("Excel exported ✓");
  }catch(e){ toast("Export failed: "+(e.message||"error")); }
};


// ── Animated count-ups (respects reduced-motion; runs once per render) ──
window._runCountUps=function(root){
  try{
    if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      (root||document).querySelectorAll(".cnt").forEach(el=>{ el.textContent=_cntFmt(el); });
      return;
    }
    (root||document).querySelectorAll(".cnt").forEach(el=>{
      if(el.dataset.done)return; el.dataset.done="1";
      const target=Number(el.dataset.v)||0, t0=performance.now(), dur=650;
      const step=(now)=>{
        const p=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-p,3);   // easeOutCubic
        el.textContent=_cntFmt(el, target*e);
        if(p<1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }catch(e){}
};
function _cntFmt(el,v){
  const t=(v===undefined)?Number(el.dataset.v)||0:v;
  const f=el.dataset.fmt||"int";
  if(f==="hm") return fmtHM(t);
  if(f==="money") return fmtMoney(Math.round(t));
  return String(Math.round(t));
}

// ═══════════════════════════════════════════════════════════════════════
//  APPROVALS — the supervisor's review queue (v144)
//  Grouped by person, because that is how a supervisor thinks: "what did
//  Ali submit this week?" — not "here are 40 unrelated rows".
// ═══════════════════════════════════════════════════════════════════════
window._apprView = window._apprView || "pending";

// Reports must never quietly omit work. When entries are pending the report
// says so, whether or not the exclusion switch is on.
function apprNotice(){
  try{
    const scope = applyReportFilters(visibleRows(state.daily||[]));
    const pend  = scope.filter(isPendingAppr).length;
    const ret   = scope.filter(isRejectedAppr).length;
    if(!pend && !ret) return "";
    const on = apprRequired();
    const bits=[]; if(pend) bits.push(`${pend} pending review`); if(ret) bits.push(`${ret} returned`);
    return `<div class="card" style="border-left:4px solid var(--warn);background:var(--warn-bg)">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:var(--f-2xl)">⏳</span>
        <div style="flex:1;min-width:180px">
          <div style="font-size:var(--f-lg);font-weight:800;color:var(--warn-ink)">${bits.join(" · ")}</div>
          <div style="font-size:var(--f-sm);color:var(--warn-ink);opacity:.85;margin-top:2px;line-height:1.5">${on
            ? "These entries are EXCLUDED from the figures below until approved."
            : "These entries ARE included in the figures below — they have not been reviewed yet."}</div>
        </div>
        ${(isAdmin()||isHR())?`<button class="btn btn-sm btn-secondary" onclick="switchTab('Approvals')">Review →</button>`:""}
      </div></div>`;
  }catch(e){ return ""; }
}
window.apprNotice=apprNotice;

function renderApprovals(){
  if(!(isAdmin()||isHR())) return `<div class="card"><div class="empty">Reviewers only.</div></div>`;
  const all = visibleRows(state.daily||[]);
  const pending  = all.filter(isPendingAppr);
  const returned = all.filter(isRejectedAppr);
  const view = window._apprView;
  const rows = view==="returned" ? returned : pending;

  // group by employee, newest first inside each group
  const byEmp = {};
  rows.forEach(r=>{ const e=r.employee||"—"; (byEmp[e]=byEmp[e]||[]).push(r); });
  Object.values(byEmp).forEach(l=>l.sort((a,b)=>String(b.date).localeCompare(String(a.date))));
  const groups = Object.entries(byEmp)
    .map(([emp,list])=>({emp,list,hours:list.reduce((s,r)=>s+Number(r.duration||0),0)}))
    .sort((a,b)=>b.list.length-a.list.length);

  const enforce = apprRequired();
  const row = (r)=>{
    const mine = !canApprove(r);
    return `<div class="appr-row">
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--f-lg);font-weight:700;color:var(--text)">
          #${r.entryNo||"—"} · ${fmtDate(r.date)} · ${fmtHM(r.duration)}
          ${apprBadge(r)}
        </div>
        <div style="font-size:var(--f-sm);color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml([r.project,r.area,r.site].filter(Boolean).join(" › ")||"—")}
          ${r.taskStatus?` · ${escapeHtml(r.taskStatus)}`:""}
        </div>
        ${r.resolutionText?`<div style="font-size:var(--f-sm);color:var(--muted);margin-top:3px;line-height:1.5">${escapeHtml(String(r.resolutionText).slice(0,140))}${String(r.resolutionText).length>140?"…":""}</div>`:""}
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-sm btn-secondary" onclick="editDaily('${r.id}')" title="Open the full entry">${ICN.edit}</button>
        ${mine?`<span style="font-size:var(--f-2xs);color:var(--muted);max-width:96px;line-height:1.4">your own entry</span>`
        :`<button class="btn btn-sm" style="background:var(--ok);color:#fff;border:none;font-weight:800" onclick="approveEntry('${r.id}')">✓ Approve</button>
          <button class="btn btn-sm" style="background:var(--danger-bg);color:var(--danger);border:none;font-weight:800" onclick="rejectEntry('${r.id}')">↩ Return</button>`}
      </div>
    </div>`;
  };

  return `
  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:#fff;padding:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:var(--f-4xl)">✅ Approvals</div>
        <div style="font-size:var(--f-sm);opacity:.85">Review work entries before they reach payroll reports</div>
      </div>
      <div style="text-align:center">
        <div style="font-family:'DM Serif Display',serif;font-size:var(--f-5xl);color:${pending.length?'#FFD54F':'#A5D6A7'}">${pending.length}</div>
        <div style="font-size:var(--f-2xs);letter-spacing:1px;opacity:.8">PENDING</div>
      </div>
    </div>
  </div>

  ${isAdmin()?`<div class="card" style="border-left:4px solid ${enforce?'var(--ok)':'var(--warn)'}">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:190px">
        <div style="font-size:var(--f-lg);font-weight:800;color:var(--text)">${enforce?"🔒":"🔓"} Reports count ${enforce?"approved entries only":"all entries"}</div>
        <div style="font-size:var(--f-sm);color:var(--muted);margin-top:3px;line-height:1.55">${enforce
          ? "Pending and returned entries are excluded from HR and Daily Log reports until approved."
          : "Nothing is excluded yet — reports show every entry and simply state how many are still pending. Turn this on once the team is used to submitting."}</div>
      </div>
      <button class="btn btn-sm ${enforce?"btn-secondary":""}" style="${enforce?"":"background:var(--ok);color:#fff;border:none;"}font-weight:800" onclick="toggleApprEnforce(${enforce?"false":"true"})">${enforce?"Turn off":"Turn on"}</button>
    </div>
  </div>`:""}

  <div class="card" style="padding:10px 12px">
    <div style="display:flex;gap:6px">
      <button class="btn ${view!=="returned"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window._apprView='pending';render()">⏳ Pending ${pending.length?`(${pending.length})`:""}</button>
      <button class="btn ${view==="returned"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window._apprView='returned';render()">↩ Returned ${returned.length?`(${returned.length})`:""}</button>
    </div>
  </div>

  ${groups.length===0
    ? `<div class="card"><div class="empty empty2"><span class="e-ic">${view==="returned"?"↩":"✅"}</span>
        <div class="e-t">${view==="returned"?"Nothing returned":"Everything reviewed"}</div>
        <div class="e-m">${view==="returned"?"No entries are waiting for an employee to fix":"No entries are waiting for your review"}</div></div></div>`
    : groups.map(g=>`<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:var(--s-2)">
          <div>
            <div style="font-family:'DM Serif Display',serif;font-size:var(--f-3xl);color:var(--text)">${escapeHtml(g.emp)}</div>
            <div style="font-size:var(--f-sm);color:var(--muted)">${g.list.length} entr${g.list.length===1?"y":"ies"} · ${fmtHM(g.hours)}</div>
          </div>
          ${view!=="returned" && g.list.some(r=>canApprove(r))
            ? `<button class="btn btn-sm" style="background:var(--ok);color:#fff;border:none;font-weight:800" onclick="approveAllFor('${escapeHtml(g.emp).replace(/'/g,"\\'")}')">✓ Approve all</button>`:""}
        </div>
        ${g.list.map(row).join("")}
      </div>`).join("")}`;
}
Object.assign(window,{renderApprovals});
