// ═══════════════════════════════════════════════════════════════════════════
//  16-advances.js  (v187)
//  Work advances and the reimbursement claim that settles them.
//
//  Modelled directly on the company's own "Local Transportation and Expense
//  Report — Reimbursement Claim" form, not on a generic template:
//    · four expense groups — Fuel/Benzene, Taxi/Bus, Phone, Others
//    · every group carries a USD column AND an IQD column, because a single
//      trip really is paid in whichever currency the driver accepts
//    · advances are deducted per currency, and the remainder is what the
//      company owes the employee — or what the employee owes back
//
//  NOTE on the source spreadsheet: its IQD subtotal used =SUM(E36:L36), which
//  adds the USD columns into the IQD total. The USD subtotal (=SUM of the four
//  USD cells) was right. Here each currency is summed from its own columns
//  only, so the two can never contaminate one another.
//
//  Deliberately separate from the `expenses` ledger: that records what the
//  COMPANY paid a supplier; this records what an EMPLOYEE spent out of pocket
//  or out of an advance. Keeping them apart is what stops the same fuel
//  receipt being counted twice against a project.
// ═══════════════════════════════════════════════════════════════════════════

const EXR_GROUPS = [
  {k:"fuel",  lb:"Fuel / Benzene",          ic:"\u26FD"},
  {k:"taxi",  lb:"Taxi / Bus",              ic:"\u{1F695}"},
  {k:"phone", lb:"Phone (minutes/charge)",  ic:"\u{1F4DE}"},
  {k:"other", lb:"Others",                  ic:"\u{1F4CE}"},
];
const EXR_STATUS = {
  draft:     {lb:"Draft",     bg:"#ECEFF1", fg:"#546E7A", ic:"\u270e"},
  submitted: {lb:"Submitted", bg:"#FFF8E1", fg:"#8F6E22", ic:"\u23F3"},
  approved:  {lb:"Approved",  bg:"#E3F2FD", fg:"#1565C0", ic:"\u2713"},
  paid:      {lb:"Settled",   bg:"#E8F5E9", fg:"#2E7D32", ic:"\u{1F4B5}"},
  rejected:  {lb:"Returned",  bg:"#FDECEA", fg:"#C62828", ic:"\u2716"},
};
const ADV_STATUS = {
  open:    {lb:"Open",    bg:"#FFF3E0", fg:"#E65100"},
  partly:  {lb:"Partly settled", bg:"#FFF8E1", fg:"#8F6E22"},
  settled: {lb:"Settled", bg:"#E8F5E9", fg:"#2E7D32"},
};

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  A.  ADVANCES                                                        ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function advBlank(){
  return {employee:"", project:"", date:(typeof todayStr==="function"?todayStr():""),
          usd:"", iqd:"", purpose:"", ref:"", method:"", notes:""};
}
window._adv     = window._adv     || advBlank();
window._advId   = window._advId   || null;
window._advView = window._advView || "list";

function advancesFor(employee, onlyOpen){
  const e=String(employee||"").trim();
  return (state.advances||[]).filter(a=>{
    if(e && String(a.employee||"").trim()!==e) return false;
    if(onlyOpen && advSettledFully(a)) return false;
    return true;
  }).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
}
// How much of an advance has been consumed by approved claims.
function advApplied(advId){
  let usd=0, iqd=0;
  (state.expenseReports||[]).forEach(r=>{
    if(!["approved","paid"].includes(r.status)) return;
    ((r.advanceIds)||[]).forEach(x=>{
      if(x && x.id===advId){ usd+=num(x.usd); iqd+=num(x.iqd); }
    });
  });
  return {usd:+usd.toFixed(2), iqd:Math.round(iqd)};
}
function advOutstanding(a){
  const ap=advApplied(a.id);
  return {usd:+Math.max(0,num(a.usd)-ap.usd).toFixed(2),
          iqd:Math.max(0,num(a.iqd)-ap.iqd), applied:ap};
}
function advSettledFully(a){
  const o=advOutstanding(a);
  return o.usd<=0.005 && o.iqd<=0;
}
function advStatusOf(a){
  const o=advOutstanding(a);
  if(o.usd<=0.005 && o.iqd<=0) return "settled";
  if(o.applied.usd>0 || o.applied.iqd>0) return "partly";
  return "open";
}
// Company-wide exposure: cash handed out and not yet accounted for.
function advOutstandingTotals(){
  let usd=0, iqd=0, count=0;
  (state.advances||[]).forEach(a=>{
    const o=advOutstanding(a);
    if(o.usd>0.005||o.iqd>0){ usd+=o.usd; iqd+=o.iqd; count++; }
  });
  return {usd:+usd.toFixed(2), iqd:Math.round(iqd), count};
}
Object.assign(window,{EXR_GROUPS, EXR_STATUS, ADV_STATUS, advBlank, advancesFor,
  advApplied, advOutstanding, advSettledFully, advStatusOf, advOutstandingTotals});

window.advSet   = function(k,v){ window._adv[k]=v; };
window.advNew   = function(){ window._adv=advBlank(); window._advId=null; window._advView="edit"; render(); };
window.advEdit  = function(id){
  const a=(state.advances||[]).find(x=>x.id===id);
  if(!a) return toast("Advance not found");
  window._adv={...advBlank(), ...a, usd:String(a.usd||""), iqd:String(a.iqd||"")};
  window._advId=id; window._advView="edit"; render();
};
window.advCancel=function(){ window._advView="list"; window._advId=null; render(); };
window.advSave  = async function(){
  if(!isAdmin()) return toast("Admin only");
  const a=window._adv;
  if(!String(a.employee||"").trim()) return toast("\u26a0 Who is the advance for?");
  const usd=num(a.usd), iqd=num(a.iqd);
  if(usd<=0 && iqd<=0) return toast("\u26a0 Enter an amount in USD, IQD, or both");
  if(!String(a.purpose||"").trim()) return toast("\u26a0 State what the advance is for");
  await fbSave("advances",{
    id: window._advId||undefined,
    employee:String(a.employee).trim(), project:String(a.project||"").trim(),
    date:a.date||"", usd, iqd,
    purpose:String(a.purpose).trim(), ref:String(a.ref||"").trim(),
    method:String(a.method||"").trim(), notes:String(a.notes||""),
    updatedAt:new Date().toISOString(),
    ...(window._advId?{}:{createdAt:new Date().toISOString(),
      createdBy:(state.profile&&(state.profile.name||state.profile.email))||""}),
  });
  window._advView="list"; window._advId=null;
  saveToast("Advance recorded \u2713"); render();
};
window.advDel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const a=(state.advances||[]).find(x=>x.id===id); if(!a) return;
  const ap=advApplied(id);
  const warn=(ap.usd>0||ap.iqd>0)
    ? `\n\n\u26a0 An approved claim has already been set against it (${ap.usd?"$"+ap.usd:""}${ap.usd&&ap.iqd?" + ":""}${ap.iqd?ap.iqd+" IQD":""}). Deleting it will leave that claim unmatched.`
    : "";
  if(!await uiConfirm(`Delete the advance to ${a.employee}?${warn}`)) return;
  await fbDelete("advances", id);
  toast("Advance deleted");
};

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  B.  EXPENSE REPORT (reimbursement claim)                            ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function exrLineBlank(){
  const L={date:"", desc:"", invoiceNo:"", project:""};
  EXR_GROUPS.forEach(g=>{ L[g.k+"USD"]=""; L[g.k+"IQD"]=""; });
  return L;
}
function exrBlank(){
  return {employee:"", title:"", department:"", manager:"",
          date:(typeof todayStr==="function"?todayStr():""), periodFrom:"", periodTo:"",
          lines:[exrLineBlank()], advanceIds:[], status:"draft",
          approvedBy:"", completedBy:"", notes:""};
}
window._exr     = window._exr     || exrBlank();
window._exrId   = window._exrId   || null;
window._exrView = window._exrView || "list";

// Each currency is summed from its OWN columns only. This is the correction to
// the source spreadsheet, where the IQD subtotal swept up the USD cells too.
function exrTotals(r){
  const lines=(r&&r.lines)||[];
  const byGroup={};
  EXR_GROUPS.forEach(g=>{ byGroup[g.k]={usd:0, iqd:0}; });
  lines.forEach(l=>{
    EXR_GROUPS.forEach(g=>{
      byGroup[g.k].usd += num(l[g.k+"USD"]);
      byGroup[g.k].iqd += num(l[g.k+"IQD"]);
    });
  });
  const subUSD = EXR_GROUPS.reduce((s,g)=>s+byGroup[g.k].usd, 0);
  const subIQD = EXR_GROUPS.reduce((s,g)=>s+byGroup[g.k].iqd, 0);
  const advUSD = ((r&&r.advanceIds)||[]).reduce((s,x)=>s+num(x&&x.usd), 0);
  const advIQD = ((r&&r.advanceIds)||[]).reduce((s,x)=>s+num(x&&x.iqd), 0);
  const dueUSD = subUSD - advUSD;
  const dueIQD = subIQD - advIQD;
  const filled = lines.filter(l=>String(l.desc||"").trim() ||
    EXR_GROUPS.some(g=>num(l[g.k+"USD"])||num(l[g.k+"IQD"]))).length;
  return {byGroup, subUSD:+subUSD.toFixed(2), subIQD:Math.round(subIQD),
          advUSD:+advUSD.toFixed(2), advIQD:Math.round(advIQD),
          dueUSD:+dueUSD.toFixed(2), dueIQD:Math.round(dueIQD),
          lines:lines.length, filled,
          // A negative "due" means the employee is holding company money.
          owedToEmployee: dueUSD>0 || dueIQD>0,
          owedByEmployee: dueUSD<0 || dueIQD<0};
}
// What an approved claim contributes to a project's cost, converted to the
// project's own currency at the rate stored on the report.
function exrProjectCost(projectName, targetCur, from, to){
  const n=String(projectName||"").trim();
  const cur=CUR_CODES.includes(targetCur)?targetCur:curBase();
  let total=0, unconverted=0, count=0;
  (state.expenseReports||[]).forEach(r=>{
    if(!["approved","paid"].includes(r.status)) return;
    const d=String(r.date||"");
    if(from && d && d<from) return;
    if(to   && d && d>to)   return;
    const rate=num(r.rate)||curRate();
    ((r.lines)||[]).forEach(l=>{
      if(String(l.project||"").trim()!==n) return;
      let usd=0, iqd=0;
      EXR_GROUPS.forEach(g=>{ usd+=num(l[g.k+"USD"]); iqd+=num(l[g.k+"IQD"]); });
      if(!usd && !iqd) return;
      count++;
      if(cur==="IQD"){
        if(usd && !rate){ unconverted++; total+=iqd; return; }
        total += iqd + (usd?usd*rate:0);
      } else {
        if(iqd && !rate){ unconverted++; total+=usd; return; }
        total += usd + (iqd?iqd/rate:0);
      }
    });
  });
  return {total: cur==="IQD"?Math.round(total):+total.toFixed(2), unconverted, count};
}
Object.assign(window,{exrLineBlank, exrBlank, exrTotals, exrProjectCost});

window.exrSet     = function(k,v){ window._exr[k]=v; if(k==="employee") render(); };
window.exrLineAdd = function(){ window._exr.lines.push(exrLineBlank()); render(); };
window.exrLineDel = function(i){
  window._exr.lines.splice(i,1);
  if(!window._exr.lines.length) window._exr.lines.push(exrLineBlank());
  render();
};
window.exrLineSet = function(i,k,v){
  const l=window._exr.lines[i]; if(!l) return;
  l[k]=v; exrRefresh();
};
function exrRefresh(){
  const t=exrTotals(window._exr);
  const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
  EXR_GROUPS.forEach(g=>{
    set("exrG_"+g.k+"_usd", t.byGroup[g.k].usd?("$"+t.byGroup[g.k].usd.toLocaleString()):"\u2014");
    set("exrG_"+g.k+"_iqd", t.byGroup[g.k].iqd?t.byGroup[g.k].iqd.toLocaleString():"\u2014");
  });
  set("exrSubUSD", "$"+t.subUSD.toLocaleString());
  set("exrSubIQD", t.subIQD.toLocaleString()+" IQD");
  set("exrAdvUSD", t.advUSD?("- $"+t.advUSD.toLocaleString()):"\u2014");
  set("exrAdvIQD", t.advIQD?("- "+t.advIQD.toLocaleString()+" IQD"):"\u2014");
  set("exrDueUSD", `<span style="color:${t.dueUSD<0?"#C62828":"#2E7D32"}">${t.dueUSD<0?"-":""}$${Math.abs(t.dueUSD).toLocaleString()}</span>`);
  set("exrDueIQD", `<span style="color:${t.dueIQD<0?"#C62828":"#2E7D32"}">${t.dueIQD<0?"-":""}${Math.abs(t.dueIQD).toLocaleString()} IQD</span>`);
  const lbl=document.getElementById("exrDueLabel");
  if(lbl) lbl.textContent = t.owedByEmployee ? "To be returned by the employee" : "Reimbursement due to the employee";
}
Object.assign(window,{exrRefresh});

// Pull the employee's open advances onto the claim, so the deduction is never
// typed from memory.
window.exrPullAdvances = function(){
  const r=window._exr;
  const emp=String(r.employee||"").trim();
  if(!emp) return toast("\u26a0 Choose the employee first");
  const open=advancesFor(emp, true);
  if(!open.length) return toast("No open advances for this person");
  r.advanceIds = open.map(a=>{
    const o=advOutstanding(a);
    return {id:a.id, ref:a.ref||"", date:a.date||"", usd:o.usd, iqd:o.iqd};
  }).filter(x=>x.usd>0 || x.iqd>0);
  render();
  toast(`${r.advanceIds.length} open advance(s) applied`);
};
window.exrAdvDel = function(i){ window._exr.advanceIds.splice(i,1); render(); };
window.exrAdvSet = function(i,k,v){
  const a=window._exr.advanceIds[i]; if(!a) return;
  a[k]=num(v); exrRefresh();
};

window.exrNew  = function(){
  window._exr=exrBlank(); window._exrId=null; window._exrView="edit";
  const me=(state.profile&&(state.profile.employeeName||state.profile.name))||"";
  if(me) window._exr.completedBy=me;
  render();
};
window.exrEdit = function(id){
  const r=(state.expenseReports||[]).find(x=>x.id===id);
  if(!r) return toast("Report not found");
  window._exr={...exrBlank(), ...r,
    lines:(r.lines||[]).map(l=>({...l})),
    advanceIds:(r.advanceIds||[]).map(a=>({...a}))};
  if(!window._exr.lines.length) window._exr.lines=[exrLineBlank()];
  window._exrId=id; window._exrView="edit"; render();
};
window.exrCancel=function(){ window._exrView="list"; window._exrId=null; render(); };

window.exrSave = async function(){
  const r=window._exr;
  if(!String(r.employee||"").trim()) return toast("\u26a0 Whose claim is this?");
  const t=exrTotals(r);
  if(!t.filled) return toast("\u26a0 Add at least one expense line");
  const bad=(r.lines||[]).findIndex(l=>{
    const any=EXR_GROUPS.some(g=>num(l[g.k+"USD"])||num(l[g.k+"IQD"]));
    return any && !String(l.desc||"").trim();
  });
  if(bad>=0) return toast(`\u26a0 Line ${bad+1} has an amount but no description`);
  const payload={
    id: window._exrId||undefined,
    ref: r.ref||"",
    employee:String(r.employee).trim(), title:String(r.title||"").trim(),
    department:String(r.department||"").trim(), manager:String(r.manager||"").trim(),
    date:r.date||"", periodFrom:r.periodFrom||"", periodTo:r.periodTo||"",
    rate: num(r.rate)||curRate(),
    lines:(r.lines||[]).filter(l=>String(l.desc||"").trim() ||
        EXR_GROUPS.some(g=>num(l[g.k+"USD"])||num(l[g.k+"IQD"])))
      .map(l=>{
        const o={date:String(l.date||""), desc:String(l.desc||"").trim(),
                 invoiceNo:String(l.invoiceNo||"").trim(), project:String(l.project||"").trim()};
        EXR_GROUPS.forEach(g=>{ o[g.k+"USD"]=num(l[g.k+"USD"]); o[g.k+"IQD"]=num(l[g.k+"IQD"]); });
        return o;
      }),
    advanceIds:(r.advanceIds||[]).map(a=>({id:a.id, ref:String(a.ref||""), date:String(a.date||""),
      usd:num(a.usd), iqd:num(a.iqd)})),
    status:r.status||"draft",
    approvedBy:String(r.approvedBy||"").trim(), completedBy:String(r.completedBy||"").trim(),
    notes:String(r.notes||""),
    subUSD:t.subUSD, subIQD:t.subIQD, advUSD:t.advUSD, advIQD:t.advIQD,
    dueUSD:t.dueUSD, dueIQD:t.dueIQD,
    updatedAt:new Date().toISOString(),
    ...(window._exrId?{}:{createdAt:new Date().toISOString(),
      createdBy:(state.profile&&(state.profile.name||state.profile.email))||""}),
  };
  if(!payload.ref){
    try{ payload.ref = await generateRefNo("EXPENSE_CLAIM", {project:""}); }catch(e){ payload.ref=""; }
  }
  await fbSave("expenseReports", payload);
  window._exrView="list"; window._exrId=null;
  saveToast("Claim saved \u2713"); render();
};
window.exrStatus = async function(id, next){
  const r=(state.expenseReports||[]).find(x=>x.id===id); if(!r) return;
  if(next!=="submitted" && !isAdmin()) return toast("Only a manager can approve or settle a claim");
  const t=exrTotals(r);
  if(next==="approved"){
    const msg = t.owedByEmployee
      ? `Approve ${r.ref||"this claim"}?\n\nThe advances exceed the expenses, so ${r.employee} must return ${t.dueUSD<0?"$"+Math.abs(t.dueUSD):""}${t.dueUSD<0&&t.dueIQD<0?" and ":""}${t.dueIQD<0?Math.abs(t.dueIQD)+" IQD":""}.`
      : `Approve ${r.ref||"this claim"}?\n\n${t.dueUSD>0?"$"+t.dueUSD:""}${t.dueUSD>0&&t.dueIQD>0?" and ":""}${t.dueIQD>0?t.dueIQD+" IQD":""} to be reimbursed to ${r.employee}.\n\nThe applied advances will be marked as accounted for.`;
    if(!await uiConfirm(msg)) return;
  }
  await fbSave("expenseReports", {...r, status:next, statusAt:new Date().toISOString(),
    statusBy:(state.profile&&(state.profile.name||state.profile.email))||"",
    ...(next==="approved"?{approvedBy:(state.profile&&(state.profile.name||state.profile.email))||r.approvedBy||""}:{})});
  saveToast(`Claim ${(EXR_STATUS[next]||{lb:next}).lb.toLowerCase()} \u2713`);
};
window.exrDel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const r=(state.expenseReports||[]).find(x=>x.id===id); if(!r) return;
  const extra=["approved","paid"].includes(r.status)
    ? "\n\n\u26a0 It is approved, so the advances it settles will become outstanding again." : "";
  if(!await uiConfirm(`Delete claim ${r.ref||""}?${extra}`)) return;
  await fbDelete("expenseReports", id);
  toast("Claim deleted");
};

// ── Screens ──────────────────────────────────────────────────────────────
function _advRow(l,v,strong){
  return `<tr><td style="padding:5px 8px;border-bottom:1px solid var(--line);font-size:11px;${strong?"font-weight:800":"color:var(--muted)"}">${l}</td>
    <td style="padding:5px 8px;border-bottom:1px solid var(--line);text-align:right;font-size:${strong?"13px":"12px"};${strong?"font-weight:800":""}">${v}</td></tr>`;
}
const _usd=(n)=>"$"+(num(n)).toLocaleString(undefined,{maximumFractionDigits:2});
const _iqd=(n)=>Math.round(num(n)).toLocaleString()+" IQD";

function renderAdvances(){
  if(!(isAdmin()||hasCap("canAnalytics"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  // allEmployees() honours the company roster; dspCandidates() deliberately
  // does not, because the roster control has to be able to show unticked names.
  const people=(typeof allEmployees==="function")?allEmployees().slice().sort():[];
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();

  if(window._advView==="edit"){
    const a=window._adv;
    return `<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${window._advId?"Edit advance":"New work advance"}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="advCancel()">Cancel</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Employee <span class="req">*</span></label>
          <select onchange="advSet('employee',this.value)"><option value="">\u2014 select \u2014</option>
            ${people.map(p=>`<option ${a.employee===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        <div class="field"><label>Project <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 optional</span></label>
          <select onchange="advSet('project',this.value)"><option value="">\u2014 none \u2014</option>
            ${projects.map(p=>`<option ${a.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        <div class="field"><label>Date</label><input type="date" value="${escapeHtml(a.date||"")}" onchange="advSet('date',this.value)"></div>
        <div class="field"><label>Reference</label><input value="${escapeHtml(a.ref||"")}" oninput="advSet('ref',this.value)" placeholder="Voucher / receipt no."></div>
        <div class="field"><label>Amount USD</label><input value="${escapeHtml(String(a.usd||""))}" oninput="advSet('usd',this.value)" inputmode="decimal" placeholder="0"></div>
        <div class="field"><label>Amount IQD</label><input value="${escapeHtml(String(a.iqd||""))}" oninput="advSet('iqd',this.value)" inputmode="decimal" placeholder="0"></div>
        <div class="field" style="grid-column:1/-1"><label>Purpose <span class="req">*</span></label>
          <input value="${escapeHtml(a.purpose||"")}" oninput="advSet('purpose',this.value)" placeholder="e.g. Fuel and transport \u2014 Basra site visit"></div>
        <div class="field"><label>Paid by</label><input value="${escapeHtml(a.method||"")}" oninput="advSet('method',this.value)" placeholder="Cash / transfer"></div>
        <div class="field" style="grid-column:1/-1"><label>Notes</label>
          <textarea rows="2" oninput="advSet('notes',this.value)">${escapeHtml(a.notes||"")}</textarea></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.6">Both currencies may be used on one advance \u2014 fill either, or both.</div>
      <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="advSave()">Save advance</button>
    </div>`;
  }

  const rows=advancesFor("");
  const tot=advOutstandingTotals();
  return `<div class="card">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="advNew()">+ New advance</button>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${rows.length} advance(s)</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:12px">
      ${[["Outstanding USD",_usd(tot.usd),tot.usd?"#E65100":"#2E7D32"],
         ["Outstanding IQD",_iqd(tot.iqd),tot.iqd?"#E65100":"#2E7D32"],
         ["Unsettled",String(tot.count),tot.count?"#E65100":"#2E7D32"]]
        .map(([l,v,c])=>`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:14px;font-weight:800;color:${c}">${v}</div>
          <div style="font-size:10px;color:var(--muted)">${l}</div></div>`).join("")}
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.7">Cash handed out and not yet accounted for by an approved claim. This is company money sitting in pockets.</div>
  </div>
  ${!rows.length?`<div class="card"><div class="empty">No advances yet.</div></div>`:rows.map(a=>{
    const st=advStatusOf(a), S=ADV_STATUS[st], o=advOutstanding(a);
    return `<div class="card" style="border-left:4px solid ${S.fg}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${escapeHtml(a.employee||"\u2014")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${escapeHtml(a.purpose||"")}<br>
            ${a.date?escapeHtml(fmtDate(a.date)):"\u2014"}${a.project?" \u00b7 "+escapeHtml(a.project):""}${a.ref?" \u00b7 "+escapeHtml(a.ref):""}
          </div>
        </div>
        <span style="background:${S.bg};color:${S.fg};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap">${S.lb}</span>
      </div>
      <table style="border-collapse:collapse;width:100%;margin-top:8px">
        ${num(a.usd)?_advRow("Advanced USD", _usd(a.usd)):""}
        ${num(a.iqd)?_advRow("Advanced IQD", _iqd(a.iqd)):""}
        ${(o.applied.usd||o.applied.iqd)?_advRow("Accounted for",
          `${o.applied.usd?_usd(o.applied.usd):""}${o.applied.usd&&o.applied.iqd?" + ":""}${o.applied.iqd?_iqd(o.applied.iqd):""}`):""}
        ${(o.usd>0||o.iqd>0)?_advRow("Still outstanding",
          `<span style="color:#E65100">${o.usd>0?_usd(o.usd):""}${o.usd>0&&o.iqd>0?" + ":""}${o.iqd>0?_iqd(o.iqd):""}</span>`, true):""}
      </table>
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="advEdit('${a.id}')">\u270e Edit</button>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="advDel('${a.id}')">\u00d7</button>
      </div>
    </div>`;}).join("")}`;
}

function renderExpenseClaims(){
  if(!(isAdmin()||hasCap("canAnalytics")||isEmployee())) return `<div class="card"><div class="empty">No access.</div></div>`;
  const people=(typeof allEmployees==="function")?allEmployees().slice().sort():[];
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();

  if(window._exrView==="edit"){
    const r=window._exr, t=exrTotals(r);
    const GH=(g)=>`<th colspan="2" style="padding:4px;border:1px solid var(--line);font-size:10px;text-align:center;background:var(--bg)">${g.ic} ${escapeHtml(g.lb)}</th>`;
    return `<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${window._exrId?"Edit claim":"New reimbursement claim"}
        ${r.ref?`<span style="font-size:11px;color:var(--muted);font-weight:600">${escapeHtml(r.ref)}</span>`:""}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="exrCancel()">Cancel</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Employee name <span class="req">*</span></label>
          <select onchange="exrSet('employee',this.value)"><option value="">\u2014 select \u2014</option>
            ${people.map(p=>`<option ${r.employee===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        <div class="field"><label>Title</label><input value="${escapeHtml(r.title||"")}" oninput="exrSet('title',this.value)"></div>
        <div class="field"><label>Department</label><input value="${escapeHtml(r.department||"")}" oninput="exrSet('department',this.value)"></div>
        <div class="field"><label>Manager</label><input value="${escapeHtml(r.manager||"")}" oninput="exrSet('manager',this.value)"></div>
        <div class="field"><label>Date</label><input type="date" value="${escapeHtml(r.date||"")}" onchange="exrSet('date',this.value)"></div>
        <div class="field"><label>Period from</label><input type="date" value="${escapeHtml(r.periodFrom||"")}" onchange="exrSet('periodFrom',this.value)"></div>
        <div class="field"><label>Period to</label><input type="date" value="${escapeHtml(r.periodTo||"")}" onchange="exrSet('periodTo',this.value)"></div>
        <div class="field"><label>Rate used <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 only for project costing</span></label>
          <input value="${escapeHtml(String(r.rate||curRate()||""))}" oninput="exrSet('rate',this.value)" inputmode="decimal"></div>
      </div>
    </div>

    <div class="card" style="overflow-x:auto">
      <div class="sec-hdr">Expenses <span style="font-size:10px;color:var(--muted);font-weight:500">(${t.filled} of ${t.lines} rows used)</span></div>
      <table style="border-collapse:collapse;min-width:900px;width:100%">
        <thead>
          <tr><th rowspan="2" style="padding:4px;border:1px solid var(--line);font-size:10px;background:var(--bg);width:110px">Date</th>
              <th rowspan="2" style="padding:4px;border:1px solid var(--line);font-size:10px;background:var(--bg);min-width:190px">Description<br><span style="font-weight:400">(from beginning to destination)</span></th>
              <th rowspan="2" style="padding:4px;border:1px solid var(--line);font-size:10px;background:var(--bg);width:96px">Invoice nu.</th>
              <th rowspan="2" style="padding:4px;border:1px solid var(--line);font-size:10px;background:var(--bg);width:130px">Project</th>
              ${EXR_GROUPS.map(GH).join("")}
              <th rowspan="2" style="padding:4px;border:1px solid var(--line);width:34px;background:var(--bg)"></th></tr>
          <tr>${EXR_GROUPS.map(()=>`<th style="padding:3px;border:1px solid var(--line);font-size:9px;background:var(--bg);width:78px">USD</th><th style="padding:3px;border:1px solid var(--line);font-size:9px;background:var(--bg);width:88px">IQD</th>`).join("")}</tr>
        </thead>
        <tbody>${(r.lines||[]).map((l,i)=>`<tr>
          <td style="padding:2px;border:1px solid var(--line)"><input type="date" value="${escapeHtml(l.date||"")}" onchange="exrLineSet(${i},'date',this.value)" style="width:100%;font-size:11px;padding:5px"></td>
          <td style="padding:2px;border:1px solid var(--line)"><input value="${escapeHtml(l.desc||"")}" oninput="exrLineSet(${i},'desc',this.value)" style="width:100%;font-size:11px;padding:5px" placeholder="Erbil office \u2192 Basra site"></td>
          <td style="padding:2px;border:1px solid var(--line)"><input value="${escapeHtml(l.invoiceNo||"")}" oninput="exrLineSet(${i},'invoiceNo',this.value)" style="width:100%;font-size:11px;padding:5px"></td>
          <td style="padding:2px;border:1px solid var(--line)"><select onchange="exrLineSet(${i},'project',this.value)" style="width:100%;font-size:11px;padding:5px">
            <option value="">\u2014</option>${projects.map(p=>`<option ${l.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></td>
          ${EXR_GROUPS.map(g=>`
            <td style="padding:2px;border:1px solid var(--line)"><input value="${escapeHtml(String(l[g.k+"USD"]||""))}" oninput="exrLineSet(${i},'${g.k}USD',this.value)" inputmode="decimal" style="width:100%;font-size:11px;padding:5px;text-align:right"></td>
            <td style="padding:2px;border:1px solid var(--line)"><input value="${escapeHtml(String(l[g.k+"IQD"]||""))}" oninput="exrLineSet(${i},'${g.k}IQD',this.value)" inputmode="decimal" style="width:100%;font-size:11px;padding:5px;text-align:right"></td>`).join("")}
          <td style="padding:2px;border:1px solid var(--line);text-align:center"><button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;padding:2px 6px;font-size:11px" onclick="exrLineDel(${i})">\u00d7</button></td>
        </tr>`).join("")}
        <tr><td colspan="4" style="padding:6px 8px;border:1px solid var(--line);font-weight:800;font-size:11px;text-align:left">Totals</td>
          ${EXR_GROUPS.map(g=>`
            <td style="padding:6px;border:1px solid var(--line);text-align:right;font-weight:800;font-size:11px" id="exrG_${g.k}_usd">${t.byGroup[g.k].usd?_usd(t.byGroup[g.k].usd):"\u2014"}</td>
            <td style="padding:6px;border:1px solid var(--line);text-align:right;font-weight:800;font-size:11px" id="exrG_${g.k}_iqd">${t.byGroup[g.k].iqd?t.byGroup[g.k].iqd.toLocaleString():"\u2014"}</td>`).join("")}
          <td style="border:1px solid var(--line)"></td></tr>
        </tbody>
      </table>
      <button class="btn btn-sm btn-secondary" style="margin-top:10px" onclick="exrLineAdd()">+ Add a row</button>
    </div>

    <div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Advances applied
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="exrPullAdvances()">\u{1F4E5} Pull open advances</button></div>
      ${!(r.advanceIds||[]).length?`<div style="font-size:11px;color:var(--muted);line-height:1.7">No advance applied \u2014 the whole claim will be reimbursed. Use the button above to bring in what this person is already holding.</div>`
      :(r.advanceIds||[]).map((a,i)=>`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--line)">
        <div style="flex:1;min-width:120px;font-size:11px">
          <strong>${escapeHtml(a.ref||"Advance")}</strong>
          <span style="color:var(--muted)"> \u00b7 ${a.date?escapeHtml(fmtDate(a.date)):"\u2014"}</span></div>
        <input value="${escapeHtml(String(a.usd||""))}" oninput="exrAdvSet(${i},'usd',this.value)" inputmode="decimal" placeholder="USD" style="width:90px;text-align:right">
        <input value="${escapeHtml(String(a.iqd||""))}" oninput="exrAdvSet(${i},'iqd',this.value)" inputmode="decimal" placeholder="IQD" style="width:110px;text-align:right">
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="exrAdvDel(${i})">\u00d7</button>
      </div>`).join("")}
    </div>

    <div class="card">
      <div class="sec-hdr">Settlement</div>
      <table style="border-collapse:collapse;width:100%">
        ${_advRow("Subtotal USD", `<span id="exrSubUSD">${_usd(t.subUSD)}</span>`)}
        ${_advRow("Subtotal IQD", `<span id="exrSubIQD">${t.subIQD.toLocaleString()} IQD</span>`)}
        ${_advRow("Advances USD", `<span id="exrAdvUSD">${t.advUSD?("- "+_usd(t.advUSD)):"\u2014"}</span>`)}
        ${_advRow("Advances IQD", `<span id="exrAdvIQD">${t.advIQD?("- "+t.advIQD.toLocaleString()+" IQD"):"\u2014"}</span>`)}
        ${_advRow(`<span id="exrDueLabel">${t.owedByEmployee?"To be returned by the employee":"Reimbursement due to the employee"}</span> \u00b7 USD`,
          `<span id="exrDueUSD"><span style="color:${t.dueUSD<0?"#C62828":"#2E7D32"}">${t.dueUSD<0?"-":""}${_usd(Math.abs(t.dueUSD))}</span></span>`, true)}
        ${_advRow("\u00b7 IQD", `<span id="exrDueIQD"><span style="color:${t.dueIQD<0?"#C62828":"#2E7D32"}">${t.dueIQD<0?"-":""}${Math.abs(t.dueIQD).toLocaleString()} IQD</span></span>`, true)}
      </table>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.7">Each currency is settled against its own advance. A negative figure means the advance exceeded the spend and the balance comes back to the company.</div>
      <div class="form-grid" style="margin-top:10px">
        <div class="field"><label>Completed by</label><input value="${escapeHtml(r.completedBy||"")}" oninput="exrSet('completedBy',this.value)"></div>
        <div class="field"><label>Approved by</label><input value="${escapeHtml(r.approvedBy||"")}" oninput="exrSet('approvedBy',this.value)" placeholder="e.g. General Manager"></div>
        <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea rows="2" oninput="exrSet('notes',this.value)">${escapeHtml(r.notes||"")}</textarea></div>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="exrSave()">Save claim</button>
    </div>`;
  }

  const all=(state.expenseReports||[]).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const mine=isAdmin()||hasCap("canAnalytics") ? all
    : all.filter(r=>String(r.employee||"")===((state.profile&&(state.profile.employeeName||state.profile.name))||""));
  return `<div class="card">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="exrNew()">+ New claim</button>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${mine.length} claim(s)</span>
    </div>
    <div style="margin-top:10px">${typeof rptFormatToggle==="function"?rptFormatToggle():""}</div>
  </div>
  ${!mine.length?`<div class="card"><div class="empty">No claims yet.</div></div>`:mine.map(r=>{
    const S=EXR_STATUS[r.status||"draft"]||EXR_STATUS.draft, t=exrTotals(r);
    return `<div class="card" style="border-left:4px solid ${S.fg}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${escapeHtml(r.employee||"\u2014")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${r.ref?escapeHtml(r.ref)+" \u00b7 ":""}${r.date?escapeHtml(fmtDate(r.date)):"\u2014"}
            ${(r.periodFrom||r.periodTo)?`<br>${r.periodFrom?escapeHtml(fmtDate(r.periodFrom)):""} \u2192 ${r.periodTo?escapeHtml(fmtDate(r.periodTo)):""}`:""}
            ${r.department?" \u00b7 "+escapeHtml(r.department):""}
          </div>
        </div>
        <span style="background:${S.bg};color:${S.fg};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap">${S.ic} ${S.lb}</span>
      </div>
      <table style="border-collapse:collapse;width:100%;margin-top:8px">
        ${t.subUSD?_advRow("Expenses USD", _usd(t.subUSD)):""}
        ${t.subIQD?_advRow("Expenses IQD", _iqd(t.subIQD)):""}
        ${t.advUSD?_advRow("Less advance USD", "- "+_usd(t.advUSD)):""}
        ${t.advIQD?_advRow("Less advance IQD", "- "+_iqd(t.advIQD)):""}
        ${_advRow(t.owedByEmployee?"Employee returns":"Reimburse employee",
          `<span style="color:${t.owedByEmployee?"#C62828":"#2E7D32"}">${t.dueUSD?(t.dueUSD<0?"-":"")+_usd(Math.abs(t.dueUSD)):""}${t.dueUSD&&t.dueIQD?" + ":""}${t.dueIQD?(t.dueIQD<0?"-":"")+_iqd(Math.abs(t.dueIQD)):""}</span>`, true)}
      </table>
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="exrEdit('${r.id}')">\u270e Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="expenseClaimDoc('${r.id}')">${window._rptFormat==="word"?"\u{1F4DD} Word":"\u{1F4C4} PDF"}</button>
        ${r.status==="draft"?`<button class="btn btn-sm btn-secondary" onclick="exrStatus('${r.id}','submitted')">Submit</button>`:""}
        ${(r.status==="submitted"&&isAdmin())?`<button class="btn btn-sm" style="background:#1565C0;color:#fff;border:none" onclick="exrStatus('${r.id}','approved')">\u2713 Approve</button>
          <button class="btn btn-sm btn-secondary" onclick="exrStatus('${r.id}','rejected')">Return</button>`:""}
        ${(r.status==="approved"&&isAdmin())?`<button class="btn btn-sm" style="background:#2E7D32;color:#fff;border:none" onclick="exrStatus('${r.id}','paid')">\u{1F4B5} Settled</button>`:""}
        ${isAdmin()?`<button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="exrDel('${r.id}')">\u00d7</button>`:""}
      </div>
    </div>`;}).join("")}`;
}
Object.assign(window,{renderAdvances, renderExpenseClaims});

// ── Document ─────────────────────────────────────────────────────────────
// Laid out to match the company's own form so an approver recognises it at a
// glance: the same four expense groups, the same USD/IQD pairing, the same
// advances-then-total settlement block, the same two signatures.
window.expenseClaimDoc = async function(id){
  const r=(state.expenseReports||[]).find(x=>x.id===id);
  if(!r) return toast("Claim not found");
  const t=exrTotals(r);
  const TH='padding:5px 6px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:center;font-size:9px';
  const TS='padding:5px 6px;border:1px solid #D6E4F0;background:#1B3A6B;color:#fff;text-align:center;font-size:8.5px';
  const TD='padding:5px 6px;border:1px solid #D6E4F0;font-size:9.5px';
  const NUM=TD+';text-align:right';
  const R=(l,v,strong)=>`<tr><td style="padding:6px 10px;border:1px solid #D6E4F0;${strong?"font-weight:800":""};width:62%">${l}</td>
    <td style="padding:6px 10px;border:1px solid #D6E4F0;text-align:right;${strong?"font-weight:800;font-size:13px":""}">${v}</td></tr>`;
  const period=(r.periodFrom||r.periodTo)
    ? `${r.periodFrom?fmtDate(r.periodFrom):"\u2014"} \u2192 ${r.periodTo?fmtDate(r.periodTo):"\u2014"}` : "\u2014";
  const lines=(r.lines||[]).filter(l=>String(l.desc||"").trim() ||
    EXR_GROUPS.some(g=>num(l[g.k+"USD"])||num(l[g.k+"IQD"])));

  const body=`
  <div class="ksec"><span class="kbad">01</span><h3>Claim Particulars</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${R("Employee name", escapeHtml(r.employee||"\u2014"))}
    ${r.title?R("Title", escapeHtml(r.title)):""}
    ${r.department?R("Department", escapeHtml(r.department)):""}
    ${r.manager?R("Manager", escapeHtml(r.manager)):""}
    ${R("Date", r.date?escapeHtml(fmtDate(r.date)):"\u2014")}
    ${R("Period", escapeHtml(period))}
    ${R("Status", escapeHtml((EXR_STATUS[r.status||"draft"]||{lb:"Draft"}).lb))}
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">02</span><h3>Local Transportation &amp; Expenses</h3></div>
  <table style="border-collapse:collapse;width:100%">
    <thead>
      <tr>
        <th rowspan="2" style="${TH};width:64px">Date</th>
        <th rowspan="2" style="${TH};text-align:left">Description<br><span style="font-weight:400">(from beginning to destination)</span></th>
        <th rowspan="2" style="${TH};width:60px">Invoice nu.</th>
        <th rowspan="2" style="${TH};width:78px">Project</th>
        ${EXR_GROUPS.map(g=>`<th colspan="2" style="${TH}">${escapeHtml(g.lb)}</th>`).join("")}
      </tr>
      <tr>${EXR_GROUPS.map(()=>`<th style="${TS};width:48px">USD</th><th style="${TS};width:56px">IQD</th>`).join("")}</tr>
    </thead>
    <tbody>${lines.map(l=>`<tr>
      <td style="${TD}">${l.date?escapeHtml(fmtDate(l.date)):"\u2014"}</td>
      <td style="${TD}">${escapeHtml(l.desc||"\u2014")}</td>
      <td style="${TD};text-align:center">${escapeHtml(l.invoiceNo||"\u2014")}</td>
      <td style="${TD};font-size:9px">${escapeHtml(l.project||"\u2014")}</td>
      ${EXR_GROUPS.map(g=>`
        <td style="${NUM}">${num(l[g.k+"USD"])?escapeHtml(num(l[g.k+"USD"]).toLocaleString()):""}</td>
        <td style="${NUM}">${num(l[g.k+"IQD"])?escapeHtml(num(l[g.k+"IQD"]).toLocaleString()):""}</td>`).join("")}
    </tr>`).join("")}
    <tr>
      <td colspan="4" style="${TD};font-weight:800;background:#F5F8FC">Totals</td>
      ${EXR_GROUPS.map(g=>`
        <td style="${NUM};font-weight:800;background:#F5F8FC">${t.byGroup[g.k].usd?escapeHtml(t.byGroup[g.k].usd.toLocaleString()):"\u2014"}</td>
        <td style="${NUM};font-weight:800;background:#F5F8FC">${t.byGroup[g.k].iqd?escapeHtml(t.byGroup[g.k].iqd.toLocaleString()):"\u2014"}</td>`).join("")}
    </tr>
    </tbody>
  </table>
  <div style="margin-top:6px;font-size:9px;font-style:italic;color:#555;line-height:1.6">
    Each currency is totalled from its own columns only; US dollar and Iraqi dinar amounts are never combined into a single figure.
  </div>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">03</span><h3>Settlement</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${R("Subtotal \u00b7 USD", "$"+t.subUSD.toLocaleString(), true)}
    ${R("Subtotal \u00b7 IQD", t.subIQD.toLocaleString()+" IQD", true)}
    ${R("Advances \u00b7 USD", t.advUSD?("- $"+t.advUSD.toLocaleString()):"\u2014")}
    ${R("Advances \u00b7 IQD", t.advIQD?("- "+t.advIQD.toLocaleString()+" IQD"):"\u2014")}
    ${R(`<strong>${t.owedByEmployee?"TO BE RETURNED BY THE EMPLOYEE":"TOTAL REIMBURSEMENT DUE"}</strong> \u00b7 USD`,
        `<span style="color:${t.dueUSD<0?"#C62828":"#2E7D32"}">${t.dueUSD<0?"- ":""}$${Math.abs(t.dueUSD).toLocaleString()}</span>`, true)}
    ${R("\u00b7 IQD",
        `<span style="color:${t.dueIQD<0?"#C62828":"#2E7D32"}">${t.dueIQD<0?"- ":""}${Math.abs(t.dueIQD).toLocaleString()} IQD</span>`, true)}
  </table>
  ${(r.advanceIds||[]).length?`<div style="margin-top:10px">
    <div style="font-weight:800;font-size:11px;color:#03308B;margin-bottom:4px">Advances applied</div>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr><th style="${TH};text-align:left">Reference</th><th style="${TH};width:80px">Date</th>
        <th style="${TH};width:80px;text-align:right">USD</th><th style="${TH};width:92px;text-align:right">IQD</th></tr></thead>
      <tbody>${(r.advanceIds||[]).map(a=>`<tr>
        <td style="${TD}">${escapeHtml(a.ref||"Advance")}</td>
        <td style="${TD};text-align:center">${a.date?escapeHtml(fmtDate(a.date)):"\u2014"}</td>
        <td style="${NUM}">${num(a.usd)?escapeHtml(num(a.usd).toLocaleString()):"\u2014"}</td>
        <td style="${NUM}">${num(a.iqd)?escapeHtml(num(a.iqd).toLocaleString()):"\u2014"}</td>
      </tr>`).join("")}</tbody></table></div>`:""}
  ${r.notes?`<div style="margin-top:10px"><div style="font-weight:800;font-size:11px;color:#03308B;margin-bottom:4px">Notes</div>
    <div style="font-size:10.5px;line-height:1.8;white-space:pre-wrap">${escapeHtml(r.notes)}</div></div>`:""}

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">04</span><h3>Authorisation</h3></div>
  <p style="font-size:10.5px;line-height:1.8">
    The expenses listed above were incurred on company business during the period stated, and the supporting invoices have been submitted with this claim.
  </p>
  <table style="border-collapse:collapse;width:100%"><tr>
    ${sigBlockHTML("exr_emp", r.completedBy||r.employee||"", "Completed by \u2014 Employee Signature", "EJAF Technology")}
    ${sigBlockHTML("exr_apr", r.approvedBy||"", "Approved by", "EJAF Technology")}
  </tr></table>`;

  await openReportPDF("EXPENSE_CLAIM",
    `${r.employee||""}${period!=="\u2014"?" \u00b7 "+period:""}`, body, {project:"", client:""});
  toast("Expense report ready!");
};
Object.assign(window,{expenseClaimDoc});
