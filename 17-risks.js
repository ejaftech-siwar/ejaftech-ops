// ═══════════════════════════════════════════════════════════════════════════
//  17-risks.js  (v211)
//  The risk register — the one PMBOK performance domain the app had nothing
//  for. Every other domain was covered: the team, the work, delivery,
//  measurement, stakeholders. Uncertainty was not recorded anywhere, so the
//  only record of a risk was the incident it eventually became.
//
//  The design decision that matters: a risk that materialises becomes an
//  INCIDENT with one tap, carrying its description and its planned response
//  across. Registers die when they are written once for a tender and never
//  opened again; this one is wired into the work, so it stays alive.
// ═══════════════════════════════════════════════════════════════════════════

// Probability and impact on the 1–5 scale the standard uses. Words, not bare
// numbers, because "3" means nothing to the engineer being asked to assess it.
const RISK_PROB = [
  {v:1, lb:"Rare",        note:"Would be surprising"},
  {v:2, lb:"Unlikely",    note:"Has happened elsewhere"},
  {v:3, lb:"Possible",    note:"Could reasonably occur"},
  {v:4, lb:"Likely",      note:"Expect it more often than not"},
  {v:5, lb:"Almost certain", note:"Assume it will happen"},
];
const RISK_IMPACT = [
  {v:1, lb:"Negligible", note:"Absorbed without noticing"},
  {v:2, lb:"Minor",      note:"A day or two, or a small cost"},
  {v:3, lb:"Moderate",   note:"A visible delay or overspend"},
  {v:4, lb:"Major",      note:"Milestone missed, client informed"},
  {v:5, lb:"Severe",     note:"Contract, safety or reputation at stake"},
];
// The four responses to a threat, plus the one that is not a response at all
// but is honest about it.
const RISK_RESPONSE = [
  {k:"avoid",    lb:"Avoid",    ic:"\u{1F6AB}", note:"Change the plan so it cannot occur"},
  {k:"mitigate", lb:"Mitigate", ic:"\u{1F6E1}\uFE0F", note:"Reduce how likely it is, or how much it hurts"},
  {k:"transfer", lb:"Transfer", ic:"\u{1F91D}", note:"Insurance, warranty, or a subcontractor's liability"},
  {k:"accept",   lb:"Accept",   ic:"\u{1F440}", note:"Carry it knowingly and watch it"},
  {k:"escalate", lb:"Escalate", ic:"\u2B06\uFE0F", note:"Beyond this project's authority to decide"},
];
const RISK_STATUS = {
  open:       {lb:"Open",        bg:"#FFF3E0", fg:"#E65100"},
  monitoring: {lb:"Monitoring",  bg:"#E3F2FD", fg:"#1565C0"},
  occurred:   {lb:"Occurred",    bg:"#FDECEA", fg:"#C62828"},
  closed:     {lb:"Closed",      bg:"#E8F5E9", fg:"#2E7D32"},
};
// Categories drawn from what actually goes wrong on an ELV contract, not from
// a generic template.
const RISK_CATEGORY = [
  {k:"site",      lb:"Site access / readiness", ic:"\u{1F3D7}\uFE0F"},
  {k:"supply",    lb:"Supply / lead time",      ic:"\u{1F4E6}"},
  {k:"technical", lb:"Technical / integration", ic:"\u{1F527}"},
  {k:"resource",  lb:"People / skills",         ic:"\u{1F465}"},
  {k:"client",    lb:"Client / approvals",      ic:"\u{1F4DD}"},
  {k:"safety",    lb:"Safety",                  ic:"\u26A0\uFE0F"},
  {k:"commercial",lb:"Commercial / payment",    ic:"\u{1F4B0}"},
  {k:"external",  lb:"External (power, permits, weather)", ic:"\u{1F327}\uFE0F"},
];

function riskBlank(){
  return {title:"", project:"", category:"technical", cause:"", effect:"",
          probability:3, impact:3, response:"mitigate", responsePlan:"",
          owner:"", dueDate:"", status:"open",
          residualProbability:0, residualImpact:0, notes:""};
}
window._risk     = window._risk     || riskBlank();
window._riskId   = window._riskId   || null;
window._riskView = window._riskView || "list";
window._riskFilter = window._riskFilter || {project:"", status:"", category:""};

// Score = probability × impact, the standard 5×5 matrix. Bands are named so a
// number never has to be interpreted on the spot.
function riskScore(r){
  const p=Math.min(5,Math.max(1, num(r&&r.probability)||1));
  const i=Math.min(5,Math.max(1, num(r&&r.impact)||1));
  return p*i;
}
function riskResidual(r){
  const p=num(r&&r.residualProbability), i=num(r&&r.residualImpact);
  if(!p || !i) return null;                     // not assessed yet
  return Math.min(5,Math.max(1,p))*Math.min(5,Math.max(1,i));
}
function riskBand(score){
  const s=Number(score)||0;
  if(s>=15) return {k:"extreme", lb:"Extreme", bg:"#C62828", fg:"#fff",    note:"Act now; escalate if it cannot be reduced"};
  if(s>=10) return {k:"high",    lb:"High",    bg:"#EF6C00", fg:"#fff",    note:"A named owner and a dated plan are required"};
  if(s>=5)  return {k:"medium",  lb:"Medium",  bg:"#FFF8E1", fg:"#8F6E22", note:"Plan a response and review it regularly"};
  return              {k:"low",     lb:"Low",     bg:"#E8F5E9", fg:"#2E7D32", note:"Monitor; no action needed while it stays here"};
}
function risksFor(projectName, opts){
  opts=opts||{};
  const n=String(projectName||"").trim();
  return (state.risks||[]).filter(r=>{
    if(n && String(r.project||"").trim()!==n) return false;
    if(opts.status && String(r.status||"open")!==opts.status) return false;
    if(opts.category && String(r.category||"")!==opts.category) return false;
    if(opts.openOnly && ["closed"].includes(String(r.status||"open"))) return false;
    return true;
  }).slice().sort((a,b)=> riskScore(b)-riskScore(a) ||
      String(a.title||"").localeCompare(String(b.title||"")));
}
// Project-level exposure: the number a manager needs before a site meeting.
function riskExposure(projectName){
  const live=risksFor(projectName,{openOnly:true});
  const bands={extreme:0,high:0,medium:0,low:0};
  let worst=null, overdue=0;
  const today=(typeof todayStr==="function")?todayStr():new Date().toISOString().slice(0,10);
  live.forEach(r=>{
    const b=riskBand(riskScore(r));
    bands[b.k]++;
    if(!worst || riskScore(r)>riskScore(worst)) worst=r;
    if(r.dueDate && String(r.dueDate)<today && String(r.status||"open")!=="closed") overdue++;
  });
  return {count:live.length, bands, worst, overdue,
          occurred:(state.risks||[]).filter(r=>String(r.project||"").trim()===String(projectName||"").trim()
            && String(r.status)==="occurred").length};
}
Object.assign(window,{RISK_PROB, RISK_IMPACT, RISK_RESPONSE, RISK_STATUS, RISK_CATEGORY,
  riskBlank, riskScore, riskResidual, riskBand, risksFor, riskExposure});

// ── Editing ──────────────────────────────────────────────────────────────
window.riskSet = function(k,v){
  window._risk[k]=v;
  // Probability, impact and response change what the form shows next, so those
  // repaint. Free text must not: rebuilding on a keystroke throws the caret
  // away and scrolls the page.
  if(["probability","impact","residualProbability","residualImpact","response","status","category"].includes(k)) return render();
  riskRefreshScore();
};
function riskRefreshScore(){
  const r=window._risk;
  const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
  const s=riskScore(r), b=riskBand(s);
  set("rkScore", `<span style="background:${b.bg};color:${b.fg};padding:2px 10px;border-radius:10px;font-weight:800">${s} \u00b7 ${escapeHtml(b.lb)}</span>`);
  set("rkBandNote", escapeHtml(b.note));
  const res=riskResidual(r);
  set("rkResidual", res==null ? "\u2014"
    : `<span style="background:${riskBand(res).bg};color:${riskBand(res).fg};padding:2px 10px;border-radius:10px;font-weight:800">${res} \u00b7 ${escapeHtml(riskBand(res).lb)}</span>`);
}
window.riskNew  = function(){ window._risk=riskBlank(); window._riskId=null; window._riskView="edit"; render(); };
window.riskEdit = function(id){
  const r=(state.risks||[]).find(x=>x.id===id);
  if(!r) return toast("Risk not found");
  window._risk={...riskBlank(), ...r};
  window._riskId=id; window._riskView="edit"; render();
};
window.riskCancel=function(){ window._riskView="list"; window._riskId=null; render(); };
window.riskFilter=function(k,v){ window._riskFilter[k]=v; render(); };

window.riskSave = async function(){
  if(!(isAdmin()||hasCap("canAnalytics"))) return toast("You cannot edit the risk register");
  const r=window._risk;
  if(!String(r.title||"").trim())   return toast("\u26a0 Describe the risk in one line");
  if(!String(r.project||"").trim()) return toast("\u26a0 Which project does it threaten?");
  // A risk without an owner is a risk nobody is watching. High and extreme
  // risks are exactly the ones that get left unowned, so the check bites there.
  const band=riskBand(riskScore(r)).k;
  if((band==="high"||band==="extreme") && !String(r.owner||"").trim())
    return toast("\u26a0 A high or extreme risk needs a named owner");
  if((band==="high"||band==="extreme") && r.response!=="accept" && !String(r.responsePlan||"").trim())
    return toast("\u26a0 State what will be done about it");
  await fbSave("risks", {
    id: window._riskId||undefined,
    title:String(r.title).trim(), project:String(r.project).trim(),
    category:String(r.category||"technical"),
    cause:String(r.cause||"").trim(), effect:String(r.effect||"").trim(),
    probability:Math.min(5,Math.max(1,num(r.probability)||1)),
    impact:Math.min(5,Math.max(1,num(r.impact)||1)),
    response:String(r.response||"mitigate"), responsePlan:String(r.responsePlan||"").trim(),
    owner:String(r.owner||"").trim(), dueDate:String(r.dueDate||""),
    status:String(r.status||"open"),
    residualProbability:num(r.residualProbability), residualImpact:num(r.residualImpact),
    notes:String(r.notes||""),
    score:riskScore(r),
    updatedAt:new Date().toISOString(),
    ...(window._riskId?{}:{createdAt:new Date().toISOString(),
      createdBy:(state.profile&&(state.profile.name||state.profile.employeeName))||""}),
  });
  window._riskView="list"; window._riskId=null;
  saveToast("Risk saved \u2713"); render();
};
window.riskStatus = async function(id, next){
  const r=(state.risks||[]).find(x=>x.id===id); if(!r) return;
  if(!(isAdmin()||hasCap("canAnalytics"))) return toast("You cannot change this");
  if(next==="closed" && !await uiConfirm(`Close "${r.title}"?\n\nIt stays on the register as a closed entry \u2014 a risk that was managed is worth keeping on record.`)) return;
  await fbSave("risks", {...r, status:next, statusAt:new Date().toISOString()});
  saveToast(`Marked ${(RISK_STATUS[next]||{lb:next}).lb.toLowerCase()} \u2713`);
};
window.riskDel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const r=(state.risks||[]).find(x=>x.id===id); if(!r) return;
  if(!await uiConfirm(`Delete "${r.title}" from the register?\n\nIf it was managed rather than mistaken, close it instead \u2014 a closed risk is evidence that the project was run properly.`)) return;
  await fbDelete("risks", id);
  toast("Risk deleted");
};

// The join that keeps the register alive: a risk that happens becomes an
// incident, carrying everything already written about it. Without this the
// register is a document written once for a tender and never opened again.
window.riskToIncident = async function(id){
  const r=(state.risks||[]).find(x=>x.id===id); if(!r) return;
  if(!await uiConfirm(`"${r.title}" has occurred?\n\nAn incident will be opened with what you already recorded, and the risk will be marked as occurred.`)) return;
  await fbSave("risks", {...r, status:"occurred", occurredAt:new Date().toISOString()});
  const today=(typeof todayStr==="function")?todayStr():new Date().toISOString().slice(0,10);
  window.incForm={
    ...(typeof incBlank==="function" ? incBlank() : {}),
    title: r.title,
    project: r.project,
    startDate: today,
    description: [
      r.cause?`Cause identified in the risk register: ${r.cause}`:"",
      r.effect?`Expected effect: ${r.effect}`:"",
      `Raised from risk register (score ${riskScore(r)} \u2014 ${riskBand(riskScore(r)).lb}).`
    ].filter(Boolean).join("\n"),
    actionTaken: r.responsePlan ? `Planned response was: ${r.responsePlan}` : "",
    photos: [],
  };
  window.incEditId=null;
  if(typeof switchTab==="function") switchTab("Incidents"); else { state.tab="Incidents"; render(); }
  toast("Incident opened from the risk \u2014 complete and save it");
};

// ── Screen ───────────────────────────────────────────────────────────────
function _rkSel(label, val, opts, onchange, note){
  return `<div class="field">
    <label>${escapeHtml(label)}</label>
    <select onchange="${onchange}">
      ${opts.map(o=>`<option value="${escapeHtml(String(o.v!=null?o.v:o.k))}" ${String(val)===String(o.v!=null?o.v:o.k)?"selected":""}>${o.ic?o.ic+" ":""}${escapeHtml(o.lb)}</option>`).join("")}
    </select>
    ${note?`<div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">${escapeHtml(note)}</div>`:""}
  </div>`;
}

function renderRisks(){
  if(!(isAdmin()||hasCap("canAnalytics")))
    return `<div class="card"><div class="empty">No access to the risk register.</div></div>`;
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();
  const people=(typeof allEmployees==="function")?allEmployees().slice().sort():[];

  if(window._riskView==="edit"){
    const r=window._risk, s=riskScore(r), b=riskBand(s), res=riskResidual(r);
    const cur=RISK_RESPONSE.find(x=>x.k===r.response)||RISK_RESPONSE[1];
    return `<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${window._riskId?"Edit risk":"New risk"}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="riskCancel()">Cancel</button>
      </div>
      <div class="form-grid">
        <div class="field" style="grid-column:1/-1"><label>The risk <span class="req">*</span></label>
          <input value="${escapeHtml(r.title||"")}" oninput="riskSet('title',this.value)"
                 placeholder="e.g. Site power not available for commissioning">
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">
            One line, stated as something that <em>might</em> happen \u2014 not as something that has.
          </div></div>
        <div class="field"><label>Project <span class="req">*</span></label>
          <select onchange="riskSet('project',this.value)"><option value="">\u2014 select \u2014</option>
            ${projects.map(p=>`<option ${r.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        ${_rkSel("Category", r.category, RISK_CATEGORY, "riskSet('category',this.value)")}
        <div class="field" style="grid-column:1/-1"><label>Cause</label>
          <input value="${escapeHtml(r.cause||"")}" oninput="riskSet('cause',this.value)"
                 placeholder="Because\u2026"></div>
        <div class="field" style="grid-column:1/-1"><label>Effect if it happens</label>
          <input value="${escapeHtml(r.effect||"")}" oninput="riskSet('effect',this.value)"
                 placeholder="Which would mean\u2026"></div>
      </div>
    </div>

    <div class="card">
      <div class="sec-hdr">Assessment</div>
      <div class="form-grid">
        ${_rkSel("How likely", r.probability, RISK_PROB, "riskSet('probability',this.value)",
          (RISK_PROB.find(x=>String(x.v)===String(r.probability))||{}).note)}
        ${_rkSel("How bad", r.impact, RISK_IMPACT, "riskSet('impact',this.value)",
          (RISK_IMPACT.find(x=>String(x.v)===String(r.impact))||{}).note)}
      </div>
      <table style="border-collapse:collapse;width:100%;margin-top:8px">
        <tr><td style="padding:6px 8px;border-bottom:1px solid var(--line);font-size:11px;color:var(--muted)">Score \u00b7 likelihood \u00d7 impact</td>
            <td style="padding:6px 8px;border-bottom:1px solid var(--line);text-align:right" id="rkScore">
              <span style="background:${b.bg};color:${b.fg};padding:2px 10px;border-radius:10px;font-weight:800">${s} \u00b7 ${escapeHtml(b.lb)}</span></td></tr>
      </table>
      <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.7" id="rkBandNote">${escapeHtml(b.note)}</div>
    </div>

    <div class="card">
      <div class="sec-hdr">Response</div>
      <div class="form-grid">
        ${_rkSel("Approach", r.response, RISK_RESPONSE, "riskSet('response',this.value)", cur.note)}
        <div class="field"><label>Owner${["high","extreme"].includes(b.k)?' <span class="req">*</span>':""}</label>
          <select onchange="riskSet('owner',this.value)"><option value="">\u2014 nobody yet \u2014</option>
            ${people.map(p=>`<option ${r.owner===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">A risk nobody owns is a risk nobody is watching.</div></div>
        <div class="field" style="grid-column:1/-1"><label>What will be done${["high","extreme"].includes(b.k)&&r.response!=="accept"?' <span class="req">*</span>':""}</label>
          <textarea rows="2" oninput="riskSet('responsePlan',this.value)"
            placeholder="${r.response==="accept"?"Why it is acceptable to carry this":"The action, and by when"}">${escapeHtml(r.responsePlan||"")}</textarea></div>
        <div class="field"><label>Action due by</label>
          <input type="date" value="${escapeHtml(r.dueDate||"")}" onchange="riskSet('dueDate',this.value)"></div>
        ${_rkSel("Status", r.status, Object.entries(RISK_STATUS).map(([k,v])=>({k, lb:v.lb})), "riskSet('status',this.value)")}
      </div>
    </div>

    <div class="card">
      <div class="sec-hdr">After the response \u00b7 <span style="font-weight:500;font-size:11px;color:var(--muted)">optional</span></div>
      <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:9px">
        What remains once the plan is in place. Recording it is how you show a response was worth doing \u2014 and how you catch the ones that changed nothing.
      </p>
      <div class="form-grid">
        ${_rkSel("Residual likelihood", r.residualProbability, [{v:0,lb:"\u2014 not assessed"}].concat(RISK_PROB), "riskSet('residualProbability',this.value)")}
        ${_rkSel("Residual impact", r.residualImpact, [{v:0,lb:"\u2014 not assessed"}].concat(RISK_IMPACT), "riskSet('residualImpact',this.value)")}
      </div>
      <table style="border-collapse:collapse;width:100%;margin-top:6px">
        <tr><td style="padding:6px 8px;font-size:11px;color:var(--muted)">Residual score</td>
            <td style="padding:6px 8px;text-align:right" id="rkResidual">${res==null?"\u2014"
              :`<span style="background:${riskBand(res).bg};color:${riskBand(res).fg};padding:2px 10px;border-radius:10px;font-weight:800">${res} \u00b7 ${escapeHtml(riskBand(res).lb)}</span>`}</td></tr>
      </table>
      <div class="field" style="margin-top:10px"><label>Notes</label>
        <textarea rows="2" oninput="riskSet('notes',this.value)">${escapeHtml(r.notes||"")}</textarea></div>
      <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="riskSave()">Save risk</button>
    </div>`;
  }

  // ── list ──
  const f=window._riskFilter;
  const rows=risksFor(f.project, {status:f.status, category:f.category});
  const live=rows.filter(r=>String(r.status||"open")!=="closed");
  const bands={extreme:0,high:0,medium:0,low:0};
  live.forEach(r=>bands[riskBand(riskScore(r)).k]++);
  const today=(typeof todayStr==="function")?todayStr():new Date().toISOString().slice(0,10);

  return `<div class="card">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="riskNew()">+ New risk</button>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${rows.length} on the register</span>
    </div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>Project</label>
        <select onchange="riskFilter('project',this.value)"><option value="">All projects</option>
          ${projects.map(p=>`<option ${f.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
      <div class="field"><label>Status</label>
        <select onchange="riskFilter('status',this.value)"><option value="">Any status</option>
          ${Object.entries(RISK_STATUS).map(([k,v])=>`<option value="${k}" ${f.status===k?"selected":""}>${escapeHtml(v.lb)}</option>`).join("")}</select></div>
    </div>
    ${live.length?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px;margin-top:10px">
      ${[["extreme","Extreme"],["high","High"],["medium","Medium"],["low","Low"]].map(([k,lb])=>{
        const bb=riskBand(k==="extreme"?25:k==="high"?12:k==="medium"?6:2);
        return `<div style="background:${bb.bg};color:${bb.fg};border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:16px;font-weight:800">${bands[k]}</div>
          <div style="font-size:10px;opacity:.9">${lb}</div></div>`;}).join("")}
    </div>`:""}
  </div>

  ${!rows.length?`<div class="card">${typeof emptyState==="function"?emptyState({
      icon:"\u{1F3AF}", title:"Nothing on the risk register yet",
      why:"A risk is something that has not happened. Writing it down while there is still time to act is the only difference between managing a project and reacting to one.",
      steps:["State what might go wrong, and why","Judge how likely it is and how much it would hurt","Name who owns it and what will be done"],
      action:{label:"+ Record the first risk", onclick:"riskNew()"},
      hint:"When a risk does happen, one tap turns it into an incident with everything you already wrote."
    }):`<div class="empty">No risks recorded.</div>`}</div>`
  :rows.map(r=>{
    const s=riskScore(r), b=riskBand(s), S=RISK_STATUS[r.status||"open"]||RISK_STATUS.open;
    const res=riskResidual(r);
    const cat=RISK_CATEGORY.find(x=>x.k===r.category)||{ic:"",lb:r.category||""};
    const resp=RISK_RESPONSE.find(x=>x.k===r.response)||{ic:"",lb:r.response||""};
    const late=r.dueDate && String(r.dueDate)<today && String(r.status||"open")!=="closed";
    return `<div class="card" style="border-left:4px solid ${b.k==="low"?"#2E7D32":b.bg}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${escapeHtml(r.title||"\u2014")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${cat.ic} ${escapeHtml(cat.lb)}${r.project?" \u00b7 "+escapeHtml(r.project):""}
            ${r.owner?"<br>Owner: "+escapeHtml(r.owner):"<br><span style='color:#E65100'>No owner</span>"}
            ${r.dueDate?` \u00b7 due ${escapeHtml(fmtDate(r.dueDate))}${late?' <span style="color:#C62828;font-weight:800">overdue</span>':""}`:""}
          </div>
        </div>
        <div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <span style="background:${b.bg};color:${b.fg};padding:2px 10px;border-radius:10px;font-size:11px;font-weight:800;white-space:nowrap">${s} \u00b7 ${escapeHtml(b.lb)}</span>
          <span style="background:${S.bg};color:${S.fg};padding:1px 9px;border-radius:10px;font-size:10px;font-weight:700">${escapeHtml(S.lb)}</span>
        </div>
      </div>
      ${(r.cause||r.effect)?`<div style="font-size:11px;color:var(--muted);line-height:1.7;margin-top:7px">
        ${r.cause?`<strong>Because</strong> ${escapeHtml(r.cause)}`:""}${r.cause&&r.effect?" \u2014 ":""}${r.effect?`<strong>which would mean</strong> ${escapeHtml(r.effect)}`:""}
      </div>`:""}
      ${r.responsePlan?`<div style="font-size:11px;line-height:1.7;margin-top:6px">
        ${resp.ic} <strong>${escapeHtml(resp.lb)}:</strong> ${escapeHtml(r.responsePlan)}</div>`:""}
      ${res!=null?`<div style="font-size:10px;color:var(--muted);margin-top:6px">
        After the response: <strong style="color:${riskBand(res).k==="low"?"#2E7D32":riskBand(res).bg}">${res} \u00b7 ${escapeHtml(riskBand(res).lb)}</strong>
        ${res<s?` \u2014 down from ${s}`:res===s?" \u2014 unchanged, so the plan is not working":""}</div>`:""}
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="riskEdit('${r.id}')">\u270e Edit</button>
        ${String(r.status)!=="occurred"&&String(r.status)!=="closed"
          ? `<button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="riskToIncident('${r.id}')">\u26A0 It happened</button>`:""}
        ${String(r.status||"open")==="open"?`<button class="btn btn-sm btn-secondary" onclick="riskStatus('${r.id}','monitoring')">Monitor</button>`:""}
        ${String(r.status)!=="closed"?`<button class="btn btn-sm btn-secondary" onclick="riskStatus('${r.id}','closed')">Close</button>`:""}
        ${isAdmin()?`<button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="riskDel('${r.id}')">\u00d7</button>`:""}
      </div>
    </div>`;}).join("")}`;
}
Object.assign(window,{renderRisks});
