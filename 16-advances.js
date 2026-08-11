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
  // Closed by an administrator rather than by a claim \u2014 cash returned intact,
  // or written off. Kept distinct from "Settled" so the books stay legible.
  closed:  {lb:"Closed by hand", bg:"#ECEFF1", fg:"#455A64"},
};

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  A.  ADVANCES                                                        ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function advBlank(){
  // `projects` is the real field. `project` is kept in step with it as a joined
  // string purely so that older records, the global search index and every
  // screen that already prints a.project keep working untouched.
  return {employee:"", project:"", projects:[], date:(typeof todayStr==="function"?todayStr():""),
          usd:"", iqd:"", purpose:"", ref:"", method:"", notes:""};
}
// Older advances stored a single name. Read them as a one-item list so nothing
// recorded before this version loses its project.
function advProjectsOf(a){
  if(!a) return [];
  if(Array.isArray(a.projects) && a.projects.length) return a.projects.filter(Boolean);
  const one=String(a.project||"").trim();
  return one?[one]:[];
}
Object.assign(window,{advProjectsOf});
window._adv     = window._adv     || advBlank();
window._advId   = window._advId   || null;
window._advView = window._advView || "list";

function advancesFor(employee, onlyOpen){
  const e=String(employee||"").trim();
  return (state.advances||[]).filter(a=>{
    if(!a) return false;
    if(e && String(a.employee||"").trim()!==e) return false;
    // Closed by hand counts as finished: it must never be offered to a claim.
    if(onlyOpen && (advSettledFully(a) || advManuallyClosed(a))) return false;
    return true;
  }).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
}
// How much of an advance has been consumed by approved claims.
function advApplied(advId){
  let usd=0, iqd=0;
  (state.expenseReports||[]).forEach(r=>{
    if(!["approved","paid"].includes(r.status)) return;
    const mine=((r.advanceIds)||[]).filter(x=>x && x.id===advId);
    if(!mine.length) return;

    // What this claim actually justifies, per currency, and what it claims to
    // draw down. Each currency is scaled on its own \u2014 dollars can be fully
    // spent while dinars are not.
    const t=exrTotals(r);
    const drawnUSD=((r.advanceIds)||[]).reduce((s,x)=>s+num(x&&x.usd),0);
    const drawnIQD=((r.advanceIds)||[]).reduce((s,x)=>s+num(x&&x.iqd),0);
    // Ratio of 1 means the spend covered the draw; below 1 means part of the
    // advance was never spent and therefore was never discharged.
    const kUSD = drawnUSD>0 ? Math.min(1, t.subUSD/drawnUSD) : 1;
    const kIQD = drawnIQD>0 ? Math.min(1, t.subIQD/drawnIQD) : 1;

    mine.forEach(x=>{ usd += num(x.usd)*kUSD; iqd += num(x.iqd)*kIQD; });
  });
  return {usd:+usd.toFixed(2), iqd:Math.round(iqd)};
}
function advOutstanding(a){
  if(!a) return {usd:0, iqd:0, applied:{usd:0, iqd:0}};
  const ap=advApplied(a.id);
  return {usd:+Math.max(0,num(a.usd)-ap.usd).toFixed(2),
          iqd:Math.max(0,num(a.iqd)-ap.iqd), applied:ap};
}
// A manual close is an accounting act, not a display toggle: it says the money
// came back (or was written off) outside the claim process. It carries its own
// reason and signature, and it never rewrites the claim arithmetic \u2014
// advApplied() stays untouched so the audit trail remains honest about what a
// claim actually settled versus what an administrator closed by hand.
function advManuallyClosed(a){ return !!(a && a.closedManually); }

function advSettledFully(a){
  if(!a) return false;
  const o=advOutstanding(a);
  return o.usd<=0.005 && o.iqd<=0;
}
function advStatusOf(a){
  if(!a) return "open";
  const o=advOutstanding(a);
  if(o.usd<=0.005 && o.iqd<=0) return "settled";
  // Closed by hand while a balance remained: still closed, but labelled
  // differently so nobody mistakes it for a claim-settled advance.
  if(advManuallyClosed(a)) return "closed";
  if(o.applied.usd>0 || o.applied.iqd>0) return "partly";
  return "open";
}
// Company-wide exposure: cash handed out and not yet accounted for.
function advOutstandingTotals(){
  let usd=0, iqd=0, count=0;
  (state.advances||[]).forEach(a=>{
    if(!a) return;
    if(advManuallyClosed(a)) return;   // money is back \u2014 no longer exposure
    const o=advOutstanding(a);
    if(o.usd>0.005||o.iqd>0){ usd+=o.usd; iqd+=o.iqd; count++; }
  });
  return {usd:+usd.toFixed(2), iqd:Math.round(iqd), count};
}
Object.assign(window,{EXR_GROUPS, EXR_STATUS, ADV_STATUS, advBlank, advancesFor,
  advApplied, advOutstanding, advSettledFully, advStatusOf, advOutstandingTotals,
  advManuallyClosed});

// Close an advance without a claim: the cash came back intact, or the balance
// is being written off. Admin only, because it removes money from the company's
// outstanding exposure. The reason is required \u2014 a closure nobody can explain
// later is exactly the hole this feature could otherwise create.
window.advCloseManual = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const a=(state.advances||[]).find(x=>x.id===id); if(!a) return;
  const o=advOutstanding(a);
  const bal=`${o.usd>0?_usd(o.usd):""}${o.usd>0&&o.iqd>0?" + ":""}${o.iqd>0?_iqd(o.iqd):""}`;
  const why = (typeof uiPrompt==="function")
    ? await uiPrompt(`Close this advance with ${bal} still outstanding?\n\nWhy is it being closed?`, "Cash returned in full")
    : "Closed by hand";
  if(why===null || why===false) return;                 // cancelled
  const reason=String(why||"").trim();
  if(!reason) return toast("\u26a0 A reason is required to close an advance");
  try{
    await fbSave("advances", {...a, closedManually:true, closedReason:reason,
      closedBy:(state.profile&&(state.profile.name||state.profile.employeeName))||"Admin",
      closedAt:new Date().toISOString()});
    toast("\u2713 Advance closed \u2014 removed from outstanding");
  }catch(e){ toast("Failed: "+e.message); }
};
window.advReopen = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const a=(state.advances||[]).find(x=>x.id===id); if(!a) return;
  if(typeof uiConfirm==="function" && !(await uiConfirm("Reopen this advance? It goes back into outstanding."))) return;
  try{
    await fbSave("advances", {...a, closedManually:false, closedReason:"", closedBy:"", closedAt:""});
    toast("Advance reopened");
  }catch(e){ toast("Failed: "+e.message); }
};
Object.assign(window,{advCloseManual, advReopen});

window.advSet   = function(k,v){ window._adv[k]=v; };
window._advProjDraft = window._advProjDraft || "";
window.advProjDraft  = function(v){ window._advProjDraft=String(v||""); };  // no render \u2014 typing must not rebuild
function _advProjList(){
  if(!Array.isArray(window._adv.projects)) window._adv.projects=[];
  return window._adv.projects;
}
window.advProjToggle = function(name){
  const L=_advProjList(), n=String(name||"").trim();
  if(!n) return;
  const i=L.indexOf(n);
  if(i>=0) L.splice(i,1); else L.push(n);
  render();
};
window.advProjDel = function(i){ _advProjList().splice(i,1); render(); };
// Free text, for a job that is not on the projects list yet \u2014 a one-off site,
// or a name the office uses before the project record is created.
window.advProjAdd = function(){
  const L=_advProjList();
  const raw=String(window._advProjDraft||"").trim();
  if(!raw) return toast("\u26a0 Type a project name first");
  // Several can be pasted at once, separated by a comma.
  const parts=raw.split(/[,\u060c]/).map(s=>s.trim()).filter(Boolean);
  let added=0;
  parts.forEach(p=>{
    if(L.some(x=>String(x).toLowerCase()===p.toLowerCase())) return;
    L.push(p); added++;
  });
  window._advProjDraft="";
  render();
  toast(added?`${added} project(s) added \u2713`:"Already on this advance");
};
window.advNew   = function(){ window._adv=advBlank(); window._advId=null; window._advView="edit"; window._advProjDraft=""; render(); };
window.advEdit  = function(id){
  const a=(state.advances||[]).find(x=>x.id===id);
  if(!a) return toast("Advance not found");
  window._adv={...advBlank(), ...a, projects:advProjectsOf(a),
               usd:String(a.usd||""), iqd:String(a.iqd||"")};
  window._advProjDraft="";
  window._advId=id; window._advView="edit"; render();
};
window.advCancel=function(){ window._advView="list"; window._advId=null; render(); };
window.advSave  = async function(){
  if(!isAdmin()) return toast("Admin only");
  const a=window._adv;
  if(!String(a.employee||"").trim()) return toast("\u26a0 Who is the advance for?");
  const usd=num(a.usd), iqd=num(a.iqd);
  if(usd<=0 && iqd<=0) return toast("\u26a0 Enter an amount in USD, IQD, or both");
  const advProjList=Array.from(new Set((a.projects||[])
    .map(p=>String(p||"").trim()).filter(Boolean)));
  if(!String(a.purpose||"").trim()) return toast("\u26a0 State what the advance is for");
  await fbSave("advances",{
    id: window._advId||undefined,
    employee:String(a.employee).trim(),
    projects: advProjList,
    // Mirrored so the global search index and every older screen that reads a
    // plain `project` string keep working without being touched.
    project: advProjList.join(" \u00b7 "),
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
          // One claim commonly covers several jobs in the same week \u2014 Alwazir on
          // Monday, Iratrac on Wednesday. `projects` is the declared scope of the
          // claim; each line still carries the ONE project it actually belongs to,
          // because a single taxi fare cannot be split across two jobs by guessing.
          projects:[],
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
  // Per-project subtotals. USD and IQD are accumulated separately and are
  // never added together \u2014 the same rule the group totals follow. Lines with
  // no project fall into a single "Unassigned" bucket rather than being
  // dropped, so the project rows always add back up to the claim subtotal.
  const byProject={};
  lines.forEach(l=>{
    let u=0, q=0;
    EXR_GROUPS.forEach(g=>{ u+=num(l[g.k+"USD"]); q+=num(l[g.k+"IQD"]); });
    if(!u && !q && !String(l.desc||"").trim()) return;
    const key=String(l.project||"").trim() || "\u2014 Unassigned";
    if(!byProject[key]) byProject[key]={usd:0, iqd:0, lines:0};
    byProject[key].usd+=u; byProject[key].iqd+=q; byProject[key].lines++;
  });
  const projectRows=Object.keys(byProject).sort((a,b)=>{
    if(a.startsWith("\u2014")) return 1;
    if(b.startsWith("\u2014")) return -1;
    return a.localeCompare(b);
  }).map(k=>({name:k, usd:+byProject[k].usd.toFixed(2),
              iqd:Math.round(byProject[k].iqd), lines:byProject[k].lines}));

  const subUSD = EXR_GROUPS.reduce((s,g)=>s+byGroup[g.k].usd, 0);
  const subIQD = EXR_GROUPS.reduce((s,g)=>s+byGroup[g.k].iqd, 0);
  const advUSD = ((r&&r.advanceIds)||[]).reduce((s,x)=>s+num(x&&x.usd), 0);
  const advIQD = ((r&&r.advanceIds)||[]).reduce((s,x)=>s+num(x&&x.iqd), 0);
  const dueUSD = subUSD - advUSD;
  const dueIQD = subIQD - advIQD;
  const filled = lines.filter(l=>String(l.desc||"").trim() ||
    EXR_GROUPS.some(g=>num(l[g.k+"USD"])||num(l[g.k+"IQD"]))).length;
  return {byGroup, byProject, projectRows, subUSD:+subUSD.toFixed(2), subIQD:Math.round(subIQD),
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

// What the next auto-issued reference would look like, shown as a placeholder
// so the person can see the house format before deciding to override it.
function _exrRefHint(){
  const y=new Date().getFullYear();
  return `EXP-${y}-0001`;
}
window._exrRefHint=_exrRefHint;
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
// The project breakdown as a table body. Built once as a string so the form
// and the live refresh cannot drift apart into two different layouts.
function exrProjectRowsHTML(t){
  const rows=t.projectRows||[];
  if(!rows.length) return `<tr><td colspan="4" style="padding:8px;font-size:11px;color:var(--muted);line-height:1.7">No expense rows yet.</td></tr>`;
  const TD='padding:5px 8px;border-bottom:1px solid var(--line);font-size:11px';
  const body=rows.map(p=>`<tr>
    <td style="${TD}">${escapeHtml(p.name)}</td>
    <td style="${TD};text-align:center;color:var(--muted)">${p.lines}</td>
    <td style="${TD};text-align:right">${p.usd?_usd(p.usd):"\u2014"}</td>
    <td style="${TD};text-align:right">${p.iqd?p.iqd.toLocaleString():"\u2014"}</td></tr>`).join("");
  // The check row exists so a reader can see the parts add back to the whole.
  return body + `<tr>
    <td style="${TD};font-weight:800">All projects</td>
    <td style="${TD};text-align:center;color:var(--muted)">${rows.reduce((s,p)=>s+p.lines,0)}</td>
    <td style="${TD};text-align:right;font-weight:800">${_usd(t.subUSD)}</td>
    <td style="${TD};text-align:right;font-weight:800">${t.subIQD.toLocaleString()}</td></tr>`;
}
Object.assign(window,{exrProjectRowsHTML});

// A single equivalent figure, for budgeting only. It is fenced off from the
// settlement deliberately: the two due lines are what actually gets paid, and
// nothing here may be mistaken for them.
function exrMemoHTML(r,t){
  const rate=num(r&&r.rate)||curRate();
  if(!rate) return "";
  const eqUSD=t.dueUSD + (t.dueIQD/rate);
  const eqIQD=t.dueIQD + (t.dueUSD*rate);
  return `<div style="background:var(--bg);border:1px dashed var(--line);border-radius:8px;padding:9px;margin-top:10px">
    <div style="font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.4px;margin-bottom:5px">MEMORANDUM ONLY \u00b7 NOT PAYABLE</div>
    <div style="font-size:11px;line-height:1.8">
      At <strong>1 USD = ${escapeHtml(String(rate))} IQD</strong>, the whole settlement is worth about
      <strong>${eqUSD<0?"-":""}$${Math.abs(eqUSD).toLocaleString(undefined,{maximumFractionDigits:2})}</strong>
      or <strong>${eqIQD<0?"-":""}${Math.abs(Math.round(eqIQD)).toLocaleString()} IQD</strong>.
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:5px;line-height:1.7">A single figure for budgeting only. Payment is made in each currency separately, from the two lines above.</div>
  </div>`;
}
Object.assign(window,{exrMemoHTML});

function exrRefresh(){
  const t=exrTotals(window._exr);
  const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
  EXR_GROUPS.forEach(g=>{
    set("exrG_"+g.k+"_usd", t.byGroup[g.k].usd?("$"+t.byGroup[g.k].usd.toLocaleString()):"\u2014");
    set("exrG_"+g.k+"_iqd", t.byGroup[g.k].iqd?t.byGroup[g.k].iqd.toLocaleString():"\u2014");
  });
  set("exrProjBody", exrProjectRowsHTML(t));
  set("exrMemo", exrMemoHTML(window._exr, t));
  set("exrAdvSumUSD", _usd(t.advUSD));
  set("exrAdvSumIQD", t.advIQD.toLocaleString()+" IQD");
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
  if(!Array.isArray(r.advanceIds)) r.advanceIds=[];
  let added=0;
  open.forEach(a=>{
    if(_exrHasAdv(a.id)) return;            // already here, and possibly edited
    const o=advOutstanding(a);
    if(o.usd<=0 && o.iqd<=0) return;
    r.advanceIds.push({id:a.id, ref:a.ref||a.purpose||"", date:a.date||"", usd:o.usd, iqd:o.iqd});
    added++;
  });
  render();
  toast(added ? `${added} advance(s) added \u2014 ${r.advanceIds.length} on this claim`
              : "Every open advance is already on this claim");
};
// ── Project scope ──────────────────────────────────────────────────────
// Ticking a project here does not move any money; it declares which jobs this
// claim is allowed to charge, so the per-line dropdown can put them first and
// the settlement can print a subtotal for each one.
window.exrProjToggle = function(name){
  const r=window._exr;
  if(!Array.isArray(r.projects)) r.projects=[];
  const i=r.projects.indexOf(name);
  if(i>=0) r.projects.splice(i,1); else r.projects.push(name);
  render();
};
window.exrProjClear = function(){ window._exr.projects=[]; render(); };

// ── Advances: add them one at a time, or all at once ────────────────────
// The old behaviour REPLACED the whole list on every press, which quietly
// discarded any amount that had been adjusted by hand. Adding is now additive
// and refuses duplicates, so pressing the button twice is harmless.
function _exrHasAdv(id){ return ((window._exr.advanceIds)||[]).some(x=>x&&x.id===id); }
window._exrHasAdv=_exrHasAdv;

window.exrAddAdvance = function(id){
  const r=window._exr;
  if(!Array.isArray(r.advanceIds)) r.advanceIds=[];
  if(_exrHasAdv(id)) return toast("That advance is already on this claim");
  const a=(state.advances||[]).find(x=>x.id===id);
  if(!a) return toast("Advance not found");
  const o=advOutstanding(a);
  if(o.usd<=0 && o.iqd<=0) return toast("That advance is already fully settled");
  r.advanceIds.push({id:a.id, ref:a.ref||a.purpose||"", date:a.date||"", usd:o.usd, iqd:o.iqd});
  render();
  toast("Advance added \u2713");
};
window.exrPickerToggle = function(){ window._exrPicker=!window._exrPicker; render(); };
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
    projects:Array.isArray(r.projects)?r.projects.slice():[],
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
  // Once approved the number has been quoted to finance, so it is frozen.
  const prior = window._exrId ? (state.expenseReports||[]).find(x=>x.id===window._exrId) : null;
  const locked = prior && ["approved","paid"].includes(prior.status) && prior.ref;
  if(locked && String(r.ref||"").trim() !== String(prior.ref).trim())
    return toast(`\u26a0 ${prior.ref} is approved \u2014 its number can no longer be changed`);
  const payload={
    id: window._exrId||undefined,
    ref: (locked ? prior.ref : String(r.ref||"").trim()),
    employee:String(r.employee).trim(), title:String(r.title||"").trim(),
    department:String(r.department||"").trim(), manager:String(r.manager||"").trim(),
    date:r.date||"", periodFrom:r.periodFrom||"", periodTo:r.periodTo||"",
    rate: num(r.rate)||curRate(),
    projects: Array.from(new Set((r.projects||[]).map(p=>String(p||"").trim()).filter(Boolean))),
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
  // A reference typed by hand is authoritative and is never replaced: some
  // claims must carry the company's own filing number rather than the app's.
  // The automatic sequence is only consumed when the field was left blank, so
  // overriding one claim does not create a gap in the app's own numbering.
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
  // Approving straight from Returned skips the resubmit step, so say so plainly
  // rather than letting an administrator do it without noticing.
  if(next==="approved" && r.status==="rejected"){
    if(!await uiConfirm(`${r.ref||"This claim"} was returned to ${r.employee}.\n\nApprove it anyway, without waiting for a corrected version?`)) return;
  }
  if(next==="approved"){
    const nUSD=(v)=>"$"+Math.abs(v).toLocaleString(undefined,{maximumFractionDigits:2});
    const nIQD=(v)=>Math.abs(v).toLocaleString()+" IQD";
    // Show a currency only if it appears anywhere in this claim, so a dinar-only
    // claim is not padded with rows of "$0.00".
    const hasUSD = t.subUSD>0 || t.advUSD>0;
    const hasIQD = t.subIQD>0 || t.advIQD>0;
    const line=(label, u, q)=>{
      const parts=[];
      if(hasUSD) parts.push(nUSD(u));
      if(hasIQD) parts.push(nIQD(q));
      return `${label}: ${parts.join("  +  ")}`;
    };
    const rows=[
      line("Expenses claimed", t.subUSD, t.subIQD),
      line("Advances applied", t.advUSD, t.advIQD),
    ];
    // The balance is stated as a plain sentence, with its direction spelled out,
    // because a bare negative number is the easiest thing in the world to misread.
    const verdicts=[];
    const say=(amount, fmt)=>{
      if(amount>0) verdicts.push(`${fmt(amount)} to be reimbursed to ${r.employee}.`);
      else if(amount<0) verdicts.push(`${r.employee} must return ${fmt(amount)}.`);
    };
    if(hasUSD) say(t.dueUSD, nUSD);
    if(hasIQD) say(t.dueIQD, nIQD);
    const verdict = verdicts.length===0
      ? "The advances cover the expenses exactly \u2014 nothing changes hands."
      : verdicts.join("\n");

    const applied=(r.advanceIds||[]).length;
    const msg = `Approve ${r.ref||"this claim"}?\n\n`
      + rows.join("\n") + "\n" + "\u2500".repeat(28) + "\n"
      + verdict + "\n\n"
      + (applied
          ? `${applied} advance(s) will be marked as accounted for by this claim.`
          : `\u26a0 No advance is applied to this claim, so nothing will be settled against ${r.employee}.`);
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
    const chosen=advProjectsOf(a);
    // Names already picked are not repeated in the suggestion row; a typed-in
    // name that is not a registered project simply stays as a chip.
    const known=projects.filter(p=>!chosen.includes(p));
    return `<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${window._advId?"Edit advance":"New work advance"}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="advCancel()">Cancel</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Employee <span class="req">*</span></label>
          <select onchange="advSet('employee',this.value)"><option value="">\u2014 select \u2014</option>
            ${people.map(p=>`<option ${a.employee===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Projects
          <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 optional, choose as many as this advance funds</span></label>
          ${chosen.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px">
            ${chosen.map((p,i)=>`<span style="display:inline-flex;align-items:center;gap:6px;background:#03308B;color:#C9A84C;border-radius:16px;padding:6px 8px 6px 11px;font-size:11px;font-weight:700">
              ${escapeHtml(p)}
              <button type="button" onclick="advProjDel(${i})" style="background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:50%;width:17px;height:17px;line-height:1;font-size:11px;cursor:pointer;padding:0">\u00d7</button>
            </span>`).join("")}
          </div>`:`<div style="font-size:11px;color:var(--muted);margin-bottom:7px;line-height:1.6">No project yet \u2014 the advance is recorded against the employee only.</div>`}
          ${known.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            ${known.map(p=>{ const on=chosen.some(x=>x===p);
              return `<button type="button" onclick="advProjToggle(${jsArg(p)})" style="padding:6px 10px;border-radius:16px;border:1.5px solid ${on?"#03308B":"var(--line)"};background:${on?"#03308B":"var(--card)"};color:${on?"#C9A84C":"var(--navy)"};font-size:11px;font-weight:700;cursor:pointer">${on?"\u2713 ":"+ "}${escapeHtml(p)}</button>`;
            }).join("")}
          </div>`:""}
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <input id="advProjInput" value="${escapeHtml(window._advProjDraft||"")}"
                   oninput="advProjDraft(this.value)"
                   onkeydown="if(event.key==='Enter'){event.preventDefault();advProjAdd();}"
                   placeholder="Or type a project name\u2026" style="flex:1;min-width:150px">
            <button type="button" class="btn btn-sm btn-secondary" onclick="advProjAdd()">+ Add</button>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:5px;line-height:1.6">
            Tap a name to add or remove it. Anything not on the list can be typed in \u2014 useful for a site that has no project record yet. Separate several with a comma.
          </div></div>
        <div class="field"><label>Date</label><input type="date" value="${escapeHtml(a.date||"")}" onchange="advSet('date',this.value)"></div>
        <div class="field"><label>Reference</label><input value="${escapeHtml(a.ref||"")}" oninput="advSet('ref',this.value)" placeholder="Voucher / receipt no."></div>
        <div class="field"><label>Amount USD</label><input value="${escapeHtml(String(a.usd||""))}" oninput="advSet('usd',this.value)" inputmode="decimal" placeholder="0"></div>
        <div class="field"><label>Amount IQD</label><input value="${escapeHtml(String(a.iqd||""))}" oninput="advSet('iqd',this.value)" inputmode="decimal" placeholder="0"></div>
        <div class="field" style="grid-column:1/-1"><label>Purpose <span class="req">*</span></label>
          <input value="${escapeHtml(a.purpose||"")}" oninput="advSet('purpose',this.value)" placeholder="e.g. Fuel and transport \u2014 Basra site visit"></div>
        <div class="field"><label>Paid by <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 method</span></label>
          <input value="${escapeHtml(a.method||"")}" oninput="advSet('method',this.value)" placeholder="Cash / transfer"></div>
        <div class="field"><label>Issued by <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 accountant / cashier</span></label>
          <input list="advIssuers" value="${escapeHtml(a.issuedBy||"")}" oninput="advSet('issuedBy',this.value)" placeholder="Who released the cash">
          <datalist id="advIssuers">${people.map(p=>`<option>${escapeHtml(p)}</option>`).join("")}</datalist>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">Names the person who authorised the payment, so the register can show who released each amount \u2014 not only who received it.</div></div>
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
  ${!rows.length?`<div class="card">`+emptyState({icon:"\u{1F4B3}",title:"No work advances recorded",
      why:"Cash handed to an employee before a trip stays a company liability until a claim accounts for it. This is where that money is tracked.",
      steps:["Choose the employee and the amount \u2014 USD, IQD, or both","State what it is for","Settle it later from the employee's expense report"],
      action:{label:"+ New advance", onclick:"advNew()"},
      hint:"The expense report pulls open advances in automatically, so the deduction is never typed from memory."})+`</div>`:rows.map(a=>{
    const st=advStatusOf(a), S=ADV_STATUS[st], o=advOutstanding(a);
    return `<div class="card" style="border-left:4px solid ${S.fg}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${escapeHtml(a.employee||"\u2014")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${escapeHtml(a.purpose||"")}<br>
            ${a.date?escapeHtml(fmtDate(a.date)):"\u2014"}${(()=>{const ps=advProjectsOf(a);return ps.length?" \u00b7 "+ps.map(p=>escapeHtml(p)).join(" \u00b7 "):"";})()}${a.ref?" \u00b7 "+escapeHtml(a.ref):""}
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
      ${advManuallyClosed(a)?`<div style="background:#ECEFF1;border-radius:8px;padding:8px 10px;margin-top:8px;font-size:10px;color:#37474F;line-height:1.7">
        <strong>Closed by hand</strong> \u00b7 ${escapeHtml(a.closedBy||"\u2014")}${a.closedAt?" \u00b7 "+escapeHtml(fmtDate(String(a.closedAt).slice(0,10))):""}
        ${a.closedReason?`<br>${escapeHtml(a.closedReason)}`:""}
      </div>`:""}
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="advEdit('${a.id}')">\u270e Edit</button>
        ${isAdmin()?(advManuallyClosed(a)
          ? `<button class="btn btn-sm btn-secondary" onclick="advReopen('${a.id}')">\u21ba Reopen</button>`
          : ((o.usd>0||o.iqd>0)
             ? `<button class="btn btn-sm btn-secondary" onclick="advCloseManual('${a.id}')" title="The money came back without an expense claim">\u2713 Close</button>`
             : "")):""}
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="advDel('${a.id}')">\u00d7</button>
      </div>
    </div>`;}).join("")}`;
}

// ═══ ADVANCES REGISTER (v221) ════════════════════════════════════════════
// Everything handed out, what came back, and what is still against each
// person. The two currencies are tallied separately throughout \u2014 a dollar and
// a dinar are never added into one figure.
window._advRep = window._advRep || {employee:"", status:"", from:"", to:""};

function advRegRows(){
  const f=window._advRep;
  const from=String(f.from||""), to=String(f.to||"");
  return (state.advances||[]).filter(a=>{
    if(!a) return false;                       // a malformed record, not a row
    if(f.employee && String(a.employee||"").trim()!==f.employee) return false;
    const d=String(a.date||"");
    if(from && d && d<from) return false;
    if(to   && d && d>to)   return false;
    if(f.status){
      const st=advStatusOf(a);
      if(f.status==="outstanding"){ if(st==="settled"||st==="closed") return false; }
      else if(f.status==="closed"){ if(st!=="settled" && st!=="closed") return false; }
      else if(st!==f.status) return false;
    }
    return true;
  }).map(a=>{
    const o=advOutstanding(a);
    const closed=advManuallyClosed(a);
    return {a, st:advStatusOf(a), closed,
            usd:num(a.usd), iqd:num(a.iqd),
            apUSD:o.applied.usd, apIQD:o.applied.iqd,
            // Closed by hand: nothing is still held, whatever the claim maths says.
            outUSD:closed?0:o.usd, outIQD:closed?0:o.iqd,
            // Kept so the document can still show what was written off.
            unclearedUSD:o.usd, unclearedIQD:o.iqd};
  }).sort((x,y)=>String(y.a.date||"").localeCompare(String(x.a.date||""))
              || String(x.a.employee||"").localeCompare(String(y.a.employee||"")));
}

function advRegTotals(rows){
  const T={usd:0,iqd:0,apUSD:0,apIQD:0,outUSD:0,outIQD:0};
  rows.forEach(r=>{ T.usd+=r.usd; T.iqd+=r.iqd; T.apUSD+=r.apUSD; T.apIQD+=r.apIQD;
                    T.outUSD+=r.outUSD; T.outIQD+=r.outIQD; });
  // Per person, so a supervisor can see instantly who is carrying company cash.
  const byEmp={};
  rows.forEach(r=>{
    const k=String(r.a.employee||"\u2014").trim()||"\u2014";
    if(!byEmp[k]) byEmp[k]={usd:0,iqd:0,outUSD:0,outIQD:0,n:0};
    byEmp[k].usd+=r.usd; byEmp[k].iqd+=r.iqd;
    byEmp[k].outUSD+=r.outUSD; byEmp[k].outIQD+=r.outIQD; byEmp[k].n++;
  });
  const empRows=Object.keys(byEmp).sort().map(k=>({name:k,
    usd:+byEmp[k].usd.toFixed(2), iqd:Math.round(byEmp[k].iqd),
    outUSD:+byEmp[k].outUSD.toFixed(2), outIQD:Math.round(byEmp[k].outIQD), n:byEmp[k].n}));
  return {usd:+T.usd.toFixed(2), iqd:Math.round(T.iqd),
          apUSD:+T.apUSD.toFixed(2), apIQD:Math.round(T.apIQD),
          outUSD:+T.outUSD.toFixed(2), outIQD:Math.round(T.outIQD),
          count:rows.length, empRows};
}
Object.assign(window,{advRegRows, advRegTotals});

// Jump from the register straight into the advance form. The form belongs to
// the Finance tab, so this moves there rather than duplicating it.
window.advEditFrom = function(id){
  if(!isAdmin()) return toast("Admin only");
  if(typeof advEdit!=="function") return;
  advEdit(id);
  window._finView="advances";
  if(typeof switchTab==="function") switchTab("Finance"); else render();
};
window.advRepSet = function(k,v){ window._advRep[k]=v; render(); };
window.advRepClear = function(){ window._advRep={employee:"",status:"",from:"",to:""}; render(); };

function renderAdvancesRegister(){
  if(!(isAdmin()||hasCap("canAnalytics")))
    return `<div class="card"><div class="empty">No access.</div></div>`;
  const f=window._advRep;
  const people=(typeof allEmployees==="function")?allEmployees().slice().sort():[];
  const rows=advRegRows(), T=advRegTotals(rows);
  const TD='padding:6px 8px;border-bottom:1px solid var(--line);font-size:11px';
  const NM=TD+';text-align:right;white-space:nowrap';
  const money=(u,q)=>`${u?_usd(u):"\u2014"}${q?`<br><span style="color:var(--muted)">${q.toLocaleString()} IQD</span>`:""}`;
  // Pin the name column: with ten columns on a phone you would otherwise reach
  // "Outstanding" with no way to see whose balance it is.
  const STICK_H='position:sticky;left:0;z-index:2;background:var(--navy)';
  const STICK_C='font-weight:700;position:sticky;left:0;z-index:1;background:var(--card);'
               +'box-shadow:1px 0 0 var(--line);white-space:normal;min-width:96px';

  return `<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\u{1F4B3} Advances register
      <span style="font-size:10px;color:var(--muted);font-weight:500">${T.count} advance(s)</span>
      <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="advRegisterPDF()">\u{1F4C4} PDF</button>
      <button class="btn btn-sm btn-secondary" onclick="advRegisterExcel()">\u{1F4CA} Excel</button></div>
    ${typeof refOverrideField==="function"?refOverrideField():""}
    <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:10px">
      Every advance paid out, what has been accounted for against it, and what is still held by the employee.
      US dollars and Iraqi dinars are tallied in separate columns and are never added together.
    </p>
    <div class="form-grid">
      <div class="field"><label>Employee</label>
        <select onchange="advRepSet('employee',this.value)"><option value="">\u2014 everyone \u2014</option>
          ${people.map(p=>`<option ${f.employee===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
      <div class="field"><label>Status</label>
        <select onchange="advRepSet('status',this.value)">
          <option value="" ${!f.status?"selected":""}>\u2014 all \u2014</option>
          <option value="outstanding" ${f.status==="outstanding"?"selected":""}>Still outstanding</option>
          <option value="open"    ${f.status==="open"?"selected":""}>Open \u2014 nothing settled</option>
          <option value="partly"  ${f.status==="partly"?"selected":""}>Partly settled</option>
          <option value="settled" ${f.status==="settled"?"selected":""}>Settled by claim</option>
          <option value="closed"  ${f.status==="closed"?"selected":""}>Closed (settled or by hand)</option>
        </select></div>
      <div class="field"><label>From</label><input type="date" value="${escapeHtml(f.from||"")}" onchange="advRepSet('from',this.value)"></div>
      <div class="field"><label>To</label><input type="date" value="${escapeHtml(f.to||"")}" onchange="advRepSet('to',this.value)"></div>
    </div>
    ${(f.employee||f.status||f.from||f.to)?`<button class="btn btn-sm btn-secondary" onclick="advRepClear()">Clear filters</button>`:""}
  </div>

  ${!rows.length?`<div class="card"><div class="empty">
      <div style="font-size:30px">\u{1F4B3}</div>
      <div style="font-weight:800;margin-top:6px">No advances match</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.7">
        ${(f.employee||f.status||f.from||f.to)?"Widen or clear the filters above.":"Advances recorded under Finance \u2192 Advances appear here."}</div>
    </div></div>`
  :`<div class="card">
    <div class="sec-hdr">Detail</div>
    <div style="font-size:10px;color:var(--muted);margin:-6px 0 8px">Swipe the table sideways to see every column.</div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>
        <th style="${STICK_H}">Employee</th>
        <th>Date</th>
        <th>Reference</th>
        <th>Purpose</th>
        <th>Projects</th>
        <th>Issued by</th>
        <th style="text-align:right">Advanced</th>
        <th style="text-align:right">Accounted</th>
        <th style="text-align:right">Outstanding</th>
        <th style="text-align:center">Status</th>
        ${isAdmin()?`<th style="text-align:center">Action</th>`:""}
      </tr></thead>
      <tbody>${rows.map(r=>{const S=ADV_STATUS[r.st]||ADV_STATUS.open; const ps=advProjectsOf(r.a);
        return `<tr>
        <td style="${STICK_C}">${escapeHtml(r.a.employee||"\u2014")}</td>
        <td>${r.a.date?escapeHtml(fmtDate(r.a.date)):"\u2014"}</td>
        <td>${escapeHtml(r.a.ref||"\u2014")}</td>
        <td style="white-space:normal;min-width:130px">${escapeHtml(r.a.purpose||"\u2014")}</td>
        <td style="white-space:normal;min-width:120px;font-size:10px">${ps.length?ps.map(p=>escapeHtml(p)).join(" \u00b7 "):"\u2014"}</td>
        <td>${escapeHtml(r.a.issuedBy||"\u2014")}</td>
        <td style="text-align:right">${money(r.usd,r.iqd)}</td>
        <td style="text-align:right">${(r.apUSD||r.apIQD)?money(r.apUSD,r.apIQD):"\u2014"}</td>
        <td style="text-align:right;font-weight:800;color:${(r.outUSD||r.outIQD)?"#E65100":"var(--muted)"}">${(r.outUSD||r.outIQD)?money(r.outUSD,r.outIQD):"\u2014"}</td>
        <td style="text-align:center"><span style="background:${S.bg};color:${S.fg};padding:2px 8px;border-radius:10px;font-size:9.5px;font-weight:800;white-space:nowrap">${S.lb}</span>
          ${r.a.closedManually&&r.a.closedReason?`<div style="font-size:9px;color:var(--muted);margin-top:3px;white-space:normal">${escapeHtml(r.a.closedReason)}</div>`:""}</td>
        ${isAdmin()?`<td style="text-align:center;white-space:nowrap">
          <button class="btn btn-sm btn-secondary" style="padding:3px 8px;font-size:10px" onclick="advEditFrom('${r.a.id}')" title="Correct the amount, purpose or projects">\u270e</button>
          ${(r.outUSD>0||r.outIQD>0)?`<button class="btn btn-sm btn-secondary" style="padding:3px 8px;font-size:10px" onclick="advCloseManual('${r.a.id}')" title="The balance came back without a claim">\u2713</button>`
            :(advManuallyClosed(r.a)?`<button class="btn btn-sm btn-secondary" style="padding:3px 8px;font-size:10px" onclick="advReopen('${r.a.id}')" title="Reopen">\u21ba</button>`:"")}
        </td>`:""}
      </tr>`;}).join("")}
      <tr style="background:var(--bg)">
        <td style="font-weight:800;white-space:normal;position:sticky;left:0;background:var(--bg);z-index:1" colspan="6">Totals \u00b7 ${T.count} advance(s)</td>
        <td style="text-align:right;font-weight:800">${money(T.usd,T.iqd)}</td>
        <td style="text-align:right;font-weight:800">${money(T.apUSD,T.apIQD)}</td>
        <td style="text-align:right;font-weight:800;color:#E65100">${money(T.outUSD,T.outIQD)}</td>
        <td></td>${isAdmin()?`<td></td>`:""}
      </tr></tbody>
    </table></div>
  </div>

  <div class="card">
    <div class="sec-hdr">Held by each person</div>
    <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:9px">
      Company cash still in someone's hands. This is the figure to chase before issuing a new advance.</p>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr>
        <th>Employee</th>
        <th style="text-align:center">Advances</th>
        <th style="text-align:right">Total advanced</th>
        <th style="text-align:right">Still outstanding</th>
      </tr></thead>
      <tbody>${T.empRows.map(e=>`<tr>
        <td style="font-weight:700;white-space:normal">${escapeHtml(e.name)}</td>
        <td style="text-align:center;color:var(--muted)">${e.n}</td>
        <td style="text-align:right">${money(e.usd,e.iqd)}</td>
        <td style="text-align:right;font-weight:800;color:${(e.outUSD||e.outIQD)?"#E65100":"var(--green)"}">${(e.outUSD||e.outIQD)?money(e.outUSD,e.outIQD):"clear"}</td>
      </tr>`).join("")}</tbody>
    </table></div>
  </div>`}`;
}
Object.assign(window,{renderAdvancesRegister});

// ── Advances register \u2192 PDF, in the same house style as every other document.
window.advRegisterPDF = async function(){
  const rows=advRegRows(), T=advRegTotals(rows), f=window._advRep;
  if(!rows.length) return toast("Nothing to print \u2014 no advances match the filters");
  const TH='padding:5px 6px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:center;font-size:8pt';
  const TD='padding:5px 6px;border:1px solid #D6E4F0;font-size:8.5pt';
  const NUM=TD+';text-align:right;white-space:nowrap';
  const R2=(l,v,strong)=>`<tr><td style="padding:6px 10px;border:1px solid #D6E4F0;${strong?"font-weight:800":""};width:62%">${l}</td>
    <td style="padding:6px 10px;border:1px solid #D6E4F0;text-align:right;${strong?"font-weight:800;font-size:13px":""}">${v}</td></tr>`;
  const K=(()=>{let n=0;return()=>String(++n).padStart(2,"0");})();
  const per=(f.from||f.to)?`${f.from?fmtDate(f.from):"\u2014"} \u2192 ${f.to?fmtDate(f.to):"\u2014"}`:"All dates";
  const stLabel={outstanding:"Still outstanding", open:"Open", partly:"Partly settled",
                 settled:"Settled by claim", closed:"Closed"}[f.status]||"All statuses";

  const body=`
  <div class="ksec"><span class="kbad">${K()}</span><h3>Register Particulars</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${R2("Employee", escapeHtml(f.employee||"All employees"))}
    ${R2("Period", escapeHtml(per))}
    ${R2("Status filter", escapeHtml(stLabel))}
    ${R2("Advances listed", String(T.count))}
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">${K()}</span><h3>Advances Paid Out</h3></div>
  <table style="border-collapse:collapse;width:100%">
    <thead><tr>
      <th style="${TH};text-align:left">Employee</th>
      <th style="${TH};width:60px">Date</th>
      <th style="${TH};width:62px">Reference</th>
      <th style="${TH};text-align:left">Purpose</th>
      <th style="${TH};width:66px">Issued by</th>
      <th style="${TH};width:74px">Advanced</th>
      <th style="${TH};width:74px">Accounted</th>
      <th style="${TH};width:74px">Outstanding</th>
      <th style="${TH};width:62px">Status</th>
    </tr></thead>
    <tbody>${rows.map(r=>{const S=ADV_STATUS[r.st]||ADV_STATUS.open; const ps=advProjectsOf(r.a);
      const m=(u,q)=>`${u?"$"+u.toLocaleString():""}${u&&q?"<br>":""}${q?q.toLocaleString()+" IQD":""}`||"\u2014";
      return `<tr>
      <td style="${TD}">${escapeHtml(r.a.employee||"\u2014")}</td>
      <td style="${TD};text-align:center">${r.a.date?escapeHtml(fmtDate(r.a.date)):"\u2014"}</td>
      <td style="${TD};text-align:center">${escapeHtml(r.a.ref||"\u2014")}</td>
      <td style="${TD}">${escapeHtml(r.a.purpose||"\u2014")}${ps.length?`<br><span style="font-size:7.5pt;color:#555">${ps.map(p=>escapeHtml(p)).join(" \u00b7 ")}</span>`:""}</td>
      <td style="${TD};text-align:center">${escapeHtml(r.a.issuedBy||"\u2014")}</td>
      <td style="${NUM}">${m(r.usd,r.iqd)||"\u2014"}</td>
      <td style="${NUM}">${m(r.apUSD,r.apIQD)||"\u2014"}</td>
      <td style="${NUM};font-weight:800">${m(r.outUSD,r.outIQD)||"\u2014"}</td>
      <td style="${TD};text-align:center;font-size:7.5pt">${escapeHtml(S.lb)}</td>
    </tr>`;}).join("")}
    <tr>
      <td style="${TD};font-weight:800;background:#F5F8FC" colspan="5">Totals \u00b7 ${T.count} advance(s)</td>
      <td style="${NUM};font-weight:800;background:#F5F8FC">${T.usd?"$"+T.usd.toLocaleString():""}${T.usd&&T.iqd?"<br>":""}${T.iqd?T.iqd.toLocaleString()+" IQD":""}</td>
      <td style="${NUM};font-weight:800;background:#F5F8FC">${T.apUSD?"$"+T.apUSD.toLocaleString():""}${T.apUSD&&T.apIQD?"<br>":""}${T.apIQD?T.apIQD.toLocaleString()+" IQD":""}</td>
      <td style="${NUM};font-weight:800;background:#F5F8FC">${T.outUSD?"$"+T.outUSD.toLocaleString():""}${T.outUSD&&T.outIQD?"<br>":""}${T.outIQD?T.outIQD.toLocaleString()+" IQD":""}</td>
      <td style="${TD};background:#F5F8FC"></td>
    </tr></tbody>
  </table>
  <div style="margin-top:6px;font-size:8pt;font-style:italic;color:#555;line-height:1.6">
    US dollars and Iraqi dinars are listed and totalled separately. No figure in this register combines the two currencies.
  </div>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">${K()}</span><h3>Balance Held by Each Employee</h3></div>
  <table style="border-collapse:collapse;width:100%">
    <thead><tr>
      <th style="${TH};text-align:left">Employee</th>
      <th style="${TH};width:60px">Advances</th>
      <th style="${TH};width:96px">Total advanced</th>
      <th style="${TH};width:96px">Still outstanding</th>
    </tr></thead>
    <tbody>${T.empRows.map(e=>`<tr>
      <td style="${TD}">${escapeHtml(e.name)}</td>
      <td style="${TD};text-align:center">${e.n}</td>
      <td style="${NUM}">${e.usd?"$"+e.usd.toLocaleString():""}${e.usd&&e.iqd?"<br>":""}${e.iqd?e.iqd.toLocaleString()+" IQD":""}</td>
      <td style="${NUM};font-weight:800">${(e.outUSD||e.outIQD)?`${e.outUSD?"$"+e.outUSD.toLocaleString():""}${e.outUSD&&e.outIQD?"<br>":""}${e.outIQD?e.outIQD.toLocaleString()+" IQD":""}`:"clear"}</td>
    </tr>`).join("")}</tbody>
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">${K()}</span><h3>Certification</h3></div>
  <p style="font-size:9pt;line-height:1.8">
    The advances listed above are recorded as paid out by the company. Amounts shown as outstanding remain the
    responsibility of the named employee until accounted for by an approved expense claim or returned to the company.
  </p>
  <table style="border-collapse:collapse;width:100%"><tr>
    ${sigBlockHTML("advreg_prep", (state.profile&&(state.profile.name||state.profile.employeeName))||"", "Prepared by", "EJAF Technology")}
    ${sigBlockHTML("advreg_acc", "", "Accountant", "EJAF Technology")}
    ${sigBlockHTML("advreg_apr", "", "Approved by", "EJAF Technology")}
  </tr></table>`;

  await openReportPDF("ADVANCES_REGISTER", per, body, {project:"", client:""});
  toast("Advances register ready!");
};

// ── Advances register \u2192 Excel, with live formulas so finance can re-check.
window.advRegisterExcel = function(){
  const rows=advRegRows(), T=advRegTotals(rows), f=window._advRep;
  if(!rows.length) return toast("Nothing to export \u2014 no advances match the filters");
  if(typeof XLSX==="undefined") return toast("Excel engine not loaded");
  try{
  const per=(f.from||f.to)?`${f.from||"start"} \u2192 ${f.to||"today"}`:"All dates";
  const stLabel={outstanding:"Still outstanding", open:"Open", partly:"Partly settled",
                 settled:"Settled by claim", closed:"Closed"}[f.status]||"All statuses";

  // Built as a plain array-of-arrays and converted with aoa_to_sheet \u2014 the same
  // path every other working export in this app uses. Styling is applied
  // afterwards by xlDress, so presentation never risks the data.
  const manualRef=String(window._refOverride||"").trim();
  if(manualRef) window._refOverride="";
  const A=[];
  A.push([(typeof xlBrandName==="function")?xlBrandName():"EJAF TECHNOLOGY"]);
  A.push(["Advances Register" + (manualRef?"  \u00b7  "+manualRef:"")]);
  A.push([`${f.employee||"All employees"}  \u00b7  ${per}  \u00b7  ${stLabel}`]);
  A.push([]);
  A.push(["Employee","Date","Reference","Purpose","Projects","Issued by",
          "Advanced USD","Advanced IQD","Accounted USD","Accounted IQD",
          "Outstanding USD","Outstanding IQD","Status"]);
  const HDR=A.length-1;                       // 0-based index of the header row
  const FIRST=A.length+1;                     // 1-based first data row
  rows.forEach(r=>{
    const rn=A.length+1;
    A.push([r.a.employee||"", r.a.date||"", r.a.ref||"", r.a.purpose||"",
            advProjectsOf(r.a).join(" \u00b7 "), r.a.issuedBy||"",
            r.usd||0, r.iqd||0, r.apUSD||0, r.apIQD||0,
            // Live: correct an accounted figure and the balance re-computes.
            {f:`MAX(0,G${rn}-I${rn})`}, {f:`MAX(0,H${rn}-J${rn})`},
            (ADV_STATUS[r.st]||{lb:""}).lb]);
  });
  const LAST=A.length;
  const TOTROW=A.length;                       // 0-based index of the total row
  A.push([`TOTAL \u00b7 ${T.count} advance(s)`,"","","","","",
    {f:`SUM(G${FIRST}:G${LAST})`},{f:`SUM(H${FIRST}:H${LAST})`},
    {f:`SUM(I${FIRST}:I${LAST})`},{f:`SUM(J${FIRST}:J${LAST})`},
    {f:`SUM(K${FIRST}:K${LAST})`},{f:`SUM(L${FIRST}:L${LAST})`},""]);
  A.push([]);
  A.push(["US dollars and Iraqi dinars are held in separate columns and are never added together. Outstanding balances are live formulas."]);

  const ws=XLSX.utils.aoa_to_sheet(A);
  ws["!cols"]=[{wch:22},{wch:12},{wch:15},{wch:30},{wch:24},{wch:18},
               {wch:15},{wch:16},{wch:15},{wch:16},{wch:16},{wch:17},{wch:16}];
  ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:12}},
                 {s:{r:1,c:0},e:{r:1,c:12}},
                 {s:{r:2,c:0},e:{r:2,c:12}},
                 {s:{r:TOTROW,c:0},e:{r:TOTROW,c:5}},
                 {s:{r:A.length-1,c:0},e:{r:A.length-1,c:12}}];
  if(typeof xlDress==="function") xlDress(ws, {
    rows:{0:"title", 1:"subtitle", 2:"subtitle", [HDR]:"header", [TOTROW]:"total",
          [A.length-1]:"note"},
    colStyles:{0:"label", 1:"date", 6:"usd", 7:"iqd", 8:"usd", 9:"iqd", 10:"usd", 11:"iqd"},
    rowsHt:[{hpt:26},{hpt:18},{hpt:16},{hpt:6},{hpt:30}]
  });

  // ── Sheet 2: what each person still holds ──
  const B=[];
  B.push([(typeof xlBrandName==="function")?xlBrandName():"EJAF TECHNOLOGY"]);
  B.push(["Balance Held by Each Employee"]);
  B.push([per]);
  B.push([]);
  B.push(["Employee","Advances","Advanced USD","Advanced IQD","Outstanding USD","Outstanding IQD"]);
  const BHDR=B.length-1, EF=B.length+1;
  T.empRows.forEach(e=>{
    const nm=`"${String(e.name).replace(/"/g,'""')}"`;
    B.push([e.name,
      {f:`COUNTIF(Advances!$A$${FIRST}:$A$${LAST},${nm})`},
      {f:`SUMIF(Advances!$A$${FIRST}:$A$${LAST},${nm},Advances!$G$${FIRST}:$G$${LAST})`},
      {f:`SUMIF(Advances!$A$${FIRST}:$A$${LAST},${nm},Advances!$H$${FIRST}:$H$${LAST})`},
      {f:`SUMIF(Advances!$A$${FIRST}:$A$${LAST},${nm},Advances!$K$${FIRST}:$K$${LAST})`},
      {f:`SUMIF(Advances!$A$${FIRST}:$A$${LAST},${nm},Advances!$L$${FIRST}:$L$${LAST})`}]);
  });
  const EL=B.length, BTOT=B.length;
  B.push(["TOTAL",{f:`SUM(B${EF}:B${EL})`},{f:`SUM(C${EF}:C${EL})`},
          {f:`SUM(D${EF}:D${EL})`},{f:`SUM(E${EF}:E${EL})`},{f:`SUM(F${EF}:F${EL})`}]);
  B.push([]);
  B.push(["Every figure here is pulled from the Advances sheet by formula, so the two can never disagree."]);
  const ws2=XLSX.utils.aoa_to_sheet(B);
  ws2["!cols"]=[{wch:26},{wch:12},{wch:16},{wch:17},{wch:17},{wch:18}];
  ws2["!merges"]=[{s:{r:0,c:0},e:{r:0,c:5}},{s:{r:1,c:0},e:{r:1,c:5}},
                  {s:{r:2,c:0},e:{r:2,c:5}},{s:{r:B.length-1,c:0},e:{r:B.length-1,c:5}}];
  if(typeof xlDress==="function") xlDress(ws2, {
    rows:{0:"title", 1:"subtitle", 2:"subtitle", [BHDR]:"header", [BTOT]:"total",
          [B.length-1]:"note"},
    colStyles:{0:"label", 1:"int", 2:"usd", 3:"iqd", 4:"usd", 5:"iqd"},
    rowsHt:[{hpt:26},{hpt:18},{hpt:16},{hpt:6},{hpt:30}]
  });

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws,  "Advances");
  XLSX.utils.book_append_sheet(wb, ws2, "By Employee");
  XLSX.writeFile(wb, `Advances-register-${(typeof todayStr==="function"?todayStr():"export")}.xlsx`);
  toast("\u2713 Excel exported");
  }catch(e){ console.error(e); toast("Excel export failed: "+e.message); }
};
Object.assign(window,{advRegisterPDF, advRegisterExcel});

function renderExpenseClaims(){
  if(!(isAdmin()||hasCap("canAnalytics")||isEmployee())) return `<div class="card"><div class="empty">No access.</div></div>`;
  const people=(typeof allEmployees==="function")?allEmployees().slice().sort():[];
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();

  if(window._exrView==="edit"){
    const r=window._exr, t=exrTotals(r);
    const scope=(r.projects||[]).filter(Boolean);
    // Projects in scope are listed first so the common choice is the near one;
    // everything else stays reachable, because a stray expense should be
    // recordable without first re-declaring the scope.
    const _projOpts=(cur)=>{
      const rest=projects.filter(p=>!scope.includes(p));
      const opt=(p)=>`<option ${String(cur||"")===p?"selected":""}>${escapeHtml(p)}</option>`;
      return `<option value="">\u2014</option>`
        + (scope.length?`<optgroup label="In this claim">${scope.map(opt).join("")}</optgroup>`:"")
        + (rest.length?`<optgroup label="${scope.length?"Other projects":"Projects"}">${rest.map(opt).join("")}</optgroup>`:"")
        + ((cur && !projects.includes(String(cur)))?`<option selected>${escapeHtml(String(cur))}</option>`:"");
    };
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
        <div class="field"><label>Manager <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 prints on the "Approved by" signature</span></label>
          <input list="exrManagers" value="${escapeHtml(r.manager||"")}" oninput="exrSet('manager',this.value)" placeholder="e.g. Waseem Shweiky">
          <datalist id="exrManagers">${people.map(p=>`<option>${escapeHtml(p)}</option>`).join("")}</datalist></div>
        <div class="field"><label>Date</label><input type="date" value="${escapeHtml(r.date||"")}" onchange="exrSet('date',this.value)"></div>
        <div class="field"><label>Period from</label><input type="date" value="${escapeHtml(r.periodFrom||"")}" onchange="exrSet('periodFrom',this.value)"></div>
        <div class="field"><label>Period to</label><input type="date" value="${escapeHtml(r.periodTo||"")}" onchange="exrSet('periodTo',this.value)"></div>
        <div class="field"><label>Exchange rate <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 1 USD = ? IQD</span></label>
          <input value="${escapeHtml(String(r.rate||curRate()||""))}" oninput="exrSet('rate',this.value);exrRefresh()" inputmode="decimal" placeholder="${escapeHtml(String(curRate()||"e.g. 1320"))}">
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">
            The rate this claim was settled at, stored on the document so it stays true even when the company rate moves later.
            ${curRate()?`Company rate today is <strong>${escapeHtml(String(curRate()))}</strong> \u2014 <button type="button" onclick="exrSet('rate',String(curRate()));render()" style="background:none;border:none;color:#03308B;font-weight:800;font-size:10px;cursor:pointer;padding:0;text-decoration:underline">use it</button>.`
                       :`No company rate is set yet \u2014 you can set one under <strong>Finance \u2192 Currency</strong>.`}
            It charges expenses to each project's own currency. <strong>It never merges the two settlement totals.</strong>
          </div></div>
        <div class="field" style="grid-column:1/-1"><label>Document number
          <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 leave blank to let the app issue one</span></label>
          <input value="${escapeHtml(r.ref||"")}" oninput="exrSet('ref',this.value)"
                 placeholder="${escapeHtml(_exrRefHint())}">
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">
            Company filing often needs its own reference \u2014 the form itself carries one like <span style="font-family:monospace">Doc EJ\\EBL\\04\\FFIN-20260003</span>.
            Type it here and it is used exactly as written on the PDF, Excel and Word. Leave it empty and the app issues <span style="font-family:monospace">${escapeHtml(_exrRefHint())}</span> on first save.
            ${r.ref?`<br><strong>This number is fixed once the claim is approved.</strong>`:""}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Projects covered
        <span style="font-size:10px;color:var(--muted);font-weight:500">(${scope.length} selected)</span>
        ${scope.length?`<button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="exrProjClear()">Clear</button>`:""}</div>
      <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:9px">
        One claim may cover several jobs. Tick every project this claim touches \u2014 they move to the top of the
        project box on each row, and the settlement prints a subtotal for each of them.
      </p>
      ${!projects.length?`<div style="font-size:11px;color:#E65100;line-height:1.7">No projects on file yet. Add them under <strong>Database \u2192 Projects</strong>.</div>`
      :`<div style="display:flex;gap:6px;flex-wrap:wrap">
        ${projects.map(p=>{ const on=scope.includes(p);
          return `<button onclick="exrProjToggle(${jsArg(p)})" style="padding:7px 11px;border-radius:16px;border:1.5px solid ${on?"#03308B":"var(--line)"};background:${on?"#03308B":"var(--card)"};color:${on?"#C9A84C":"var(--navy)"};font-size:11px;font-weight:700;cursor:pointer">${on?"\u2713 ":""}${escapeHtml(p)}</button>`;
        }).join("")}
      </div>`}
      ${scope.length?`<div style="font-size:10px;color:var(--muted);margin-top:9px;line-height:1.7">
        Each expense row still belongs to exactly one project \u2014 a single taxi fare cannot be split between two jobs by guessing.
      </div>`:""}
    </div>

    <div class="card">
      <div class="sec-hdr">Expenses <span style="font-size:10px;color:var(--muted);font-weight:500">(${t.filled} of ${t.lines} rows used)</span></div>
      <div style="font-size:10px;color:var(--muted);margin:-6px 0 8px">Swipe the grid sideways to reach every column.</div>
      <div class="tbl-wrap"><table style="border-collapse:collapse;min-width:900px;width:100%">
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
            ${_projOpts(l.project)}</select></td>
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
      </table></div>
      <button class="btn btn-sm btn-secondary" style="margin-top:10px" onclick="exrLineAdd()">+ Add a row</button>
    </div>

    <div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Advances applied
        <span style="font-size:10px;color:var(--muted);font-weight:500">(${(r.advanceIds||[]).length} on this claim)</span>
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="exrPickerToggle()">${window._exrPicker?"Close list":"\u2795 Choose advances"}</button>
        <button class="btn btn-sm btn-secondary" onclick="exrPullAdvances()">\u{1F4E5} Add all open</button></div>

      ${window._exrPicker?(()=>{
        const emp=String(r.employee||"").trim();
        if(!emp) return `<div style="font-size:11px;color:#E65100;line-height:1.7;padding:8px 0">Choose the employee first \u2014 the list shows only what that person is holding.</div>`;
        const open=advancesFor(emp, true).filter(a=>{ const o=advOutstanding(a); return o.usd>0||o.iqd>0; });
        if(!open.length) return `<div style="font-size:11px;color:var(--muted);line-height:1.7;padding:8px 0">${escapeHtml(emp)} has no advance still outstanding.</div>`;
        return `<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px;margin-bottom:10px">
          <div style="font-size:10px;color:var(--muted);line-height:1.7;margin-bottom:7px">Every advance ${escapeHtml(emp)} still holds. Add as many as this claim settles \u2014 the amounts are summed automatically.</div>
          ${open.map(a=>{ const o=advOutstanding(a), on=_exrHasAdv(a.id);
            return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--line)">
              <div style="flex:1;min-width:140px;font-size:11px;line-height:1.6">
                <strong>${escapeHtml(a.ref||a.purpose||"Advance")}</strong>
                <div style="color:var(--muted);font-size:10px">${a.date?escapeHtml(fmtDate(a.date)):"\u2014"}${a.project?" \u00b7 "+escapeHtml(a.project):""} \u00b7 outstanding ${o.usd>0?_usd(o.usd):""}${o.usd>0&&o.iqd>0?" + ":""}${o.iqd>0?_iqd(o.iqd):""}</div>
              </div>
              ${on?`<span style="font-size:10px;font-weight:800;color:#2E7D32;white-space:nowrap">\u2713 Added</span>`
                 :`<button class="btn btn-sm btn-primary" onclick="exrAddAdvance('${a.id}')">Add</button>`}
            </div>`;}).join("")}
        </div>`;})():""}

      ${!(r.advanceIds||[]).length?`<div style="font-size:11px;color:var(--muted);line-height:1.7">No advance applied \u2014 the whole claim will be reimbursed. Use the buttons above to bring in what this person is already holding.</div>`
      :(r.advanceIds||[]).map((a,i)=>`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--line)">
        <div style="flex:1;min-width:120px;font-size:11px">
          <strong>${escapeHtml(a.ref||"Advance")}</strong>
          <span style="color:var(--muted)"> \u00b7 ${a.date?escapeHtml(fmtDate(a.date)):"\u2014"}</span></div>
        <input value="${escapeHtml(String(a.usd||""))}" oninput="exrAdvSet(${i},'usd',this.value)" inputmode="decimal" placeholder="USD" style="width:90px;text-align:right">
        <input value="${escapeHtml(String(a.iqd||""))}" oninput="exrAdvSet(${i},'iqd',this.value)" inputmode="decimal" placeholder="IQD" style="width:110px;text-align:right">
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="exrAdvDel(${i})">\u00d7</button>
      </div>`).join("")}
      ${(r.advanceIds||[]).length?`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:9px 0 0;font-size:11px;font-weight:800">
        <span style="flex:1;min-width:120px">Total advances \u00b7 ${(r.advanceIds||[]).length} applied</span>
        <span id="exrAdvSumUSD" style="width:90px;text-align:right">${_usd(t.advUSD)}</span>
        <span id="exrAdvSumIQD" style="width:110px;text-align:right">${t.advIQD.toLocaleString()} IQD</span>
        <span style="width:26px"></span>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px;line-height:1.7">Each currency is summed on its own. Reduce an amount if this claim only settles part of an advance \u2014 the remainder stays outstanding against the employee.</div>`:""}
    </div>

    <div class="card">
      <div class="sec-hdr">By project</div>
      <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:9px">
        Every row totalled against the job it belongs to. The two currencies are kept in separate columns
        and are never added together; the last line is the whole claim, so the parts can be checked against it.
      </p>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="padding:5px 8px;border-bottom:2px solid var(--line);font-size:10px;text-align:left;color:var(--muted)">Project</th>
          <th style="padding:5px 8px;border-bottom:2px solid var(--line);font-size:10px;text-align:center;color:var(--muted)">Rows</th>
          <th style="padding:5px 8px;border-bottom:2px solid var(--line);font-size:10px;text-align:right;color:var(--muted)">USD</th>
          <th style="padding:5px 8px;border-bottom:2px solid var(--line);font-size:10px;text-align:right;color:var(--muted)">IQD</th>
        </tr></thead>
        <tbody id="exrProjBody">${exrProjectRowsHTML(t)}</tbody>
      </table>
      ${(t.projectRows||[]).some(p=>String(p.name).startsWith("\u2014"))?`<div style="font-size:10px;color:#E65100;margin-top:8px;line-height:1.7">Some rows carry no project. They are still counted in the claim total, but they cannot be charged to a job until one is chosen.</div>`:""}
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
      <div id="exrMemo">${exrMemoHTML(r,t)}</div>
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
    <div style="margin-top:10px">${typeof rptFormatToggle==="function"?rptFormatToggle(true):""}${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}</div>
    <div style="font-size:10px;color:var(--muted);margin-top:2px;line-height:1.6">
      Excel keeps the totals as live formulas, so finance can re-check the arithmetic \u2014 the usual choice for a claim. PDF is the one to sign and file.
    </div>
  </div>
  ${!mine.length?`<div class="card">`+emptyState({icon:"\u{1F9FE}",title:"No expense reports yet",
      why:"This is the company's reimbursement claim: fuel, taxi, phone and other costs an employee paid out of pocket or out of an advance.",
      steps:["Enter each trip on its own line, with the invoice number","Pull in any open advances so they are deducted","Submit it for approval, then export as PDF, Excel or Word"],
      action:{label:"+ New claim", onclick:"exrNew()"},
      hint:"Excel keeps the totals as live formulas, which is what finance usually wants."})+`</div>`:mine.map(r=>{
    const S=EXR_STATUS[r.status||"draft"]||EXR_STATUS.draft, t=exrTotals(r);
    return `<div class="card" style="border-left:4px solid ${S.fg}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${escapeHtml(r.employee||"\u2014")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${r.ref?escapeHtml(r.ref)+" \u00b7 ":""}${r.date?escapeHtml(fmtDate(r.date)):"\u2014"}
            ${(r.periodFrom||r.periodTo)?`<br>${r.periodFrom?escapeHtml(fmtDate(r.periodFrom)):""} \u2192 ${r.periodTo?escapeHtml(fmtDate(r.periodTo)):""}`:""}
            ${r.department?" \u00b7 "+escapeHtml(r.department):""}
            ${(()=>{ const ps=(t.projectRows||[]).filter(p=>!String(p.name).startsWith("\u2014"));
                     if(!ps.length) return "";
                     return `<br><span style="color:#03308B;font-weight:700">${ps.map(p=>escapeHtml(p.name)).join(" \u00b7 ")}</span>`; })()}
            ${(r.advanceIds||[]).length?`<br>${(r.advanceIds||[]).length} advance(s) applied`:""}
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
        <button class="btn btn-sm btn-secondary" onclick="expenseClaimOut('${r.id}')">${window._rptFormat==="excel"?"\u{1F4CA} Excel":window._rptFormat==="word"?"\u{1F4DD} Word":"\u{1F4C4} PDF"}</button>
        ${r.status==="draft"?`<button class="btn btn-sm btn-secondary" onclick="exrStatus('${r.id}','submitted')">Submit</button>`:""}
        ${r.status==="rejected"?`<button class="btn btn-sm btn-secondary" onclick="exrStatus('${r.id}','submitted')">\u21ba Resubmit</button>`:""}
        ${((r.status==="submitted"||r.status==="rejected")&&isAdmin())?`<button class="btn btn-sm" style="background:#1565C0;color:#fff;border:none" onclick="exrStatus('${r.id}','approved')">\u2713 Approve</button>`:""}
        ${(r.status==="submitted"&&isAdmin())?`<button class="btn btn-sm btn-secondary" onclick="exrStatus('${r.id}','rejected')">Return</button>`:""}
        ${(r.status==="approved"&&isAdmin())?`<button class="btn btn-sm" style="background:#2E7D32;color:#fff;border:none" onclick="exrStatus('${r.id}','paid')">\u{1F4B5} Settled</button>`:""}
        ${(r.status==="paid"&&isAdmin())?`<button class="btn btn-sm btn-secondary" onclick="exrStatus('${r.id}','approved')" title="Undo the settled mark">\u21ba Unsettle</button>`:""}
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

  // Counted section numbers: a new section can be inserted without renumbering
  // every heading below it by hand.
  const K=(()=>{let n=0;return()=>String(++n).padStart(2,"0");})();
  const scope=(r.projects||[]).filter(Boolean);
  const pr=t.projectRows||[];

  const body=`
  <div class="ksec"><span class="kbad">${K()}</span><h3>Claim Particulars</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${R("Employee name", escapeHtml(r.employee||"\u2014"))}
    ${r.title?R("Title", escapeHtml(r.title)):""}
    ${r.department?R("Department", escapeHtml(r.department)):""}
    ${r.manager?R("Manager", escapeHtml(r.manager)):""}
    ${R("Date", r.date?escapeHtml(fmtDate(r.date)):"\u2014")}
    ${R("Period", escapeHtml(period))}
    ${R("Status", escapeHtml((EXR_STATUS[r.status||"draft"]||{lb:"Draft"}).lb))}
    ${scope.length?R("Projects covered", scope.map(p=>escapeHtml(p)).join(" \u00b7 ")):""}
    ${(num(r.rate))?R("Exchange rate applied", "1 USD = "+escapeHtml(String(num(r.rate)))+" IQD"):""}
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">${K()}</span><h3>Local Transportation &amp; Expenses</h3></div>
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

  ${pr.length?`<div class="ksec" style="page-break-inside:avoid"><span class="kbad">${K()}</span><h3>Cost by Project</h3></div>
  <table style="border-collapse:collapse;width:100%">
    <thead><tr>
      <th style="${TH};text-align:left">Project</th>
      <th style="${TH};width:52px">Rows</th>
      <th style="${TH};width:88px;text-align:right">USD</th>
      <th style="${TH};width:100px;text-align:right">IQD</th>
    </tr></thead>
    <tbody>${pr.map(p=>`<tr>
      <td style="${TD}">${escapeHtml(p.name)}</td>
      <td style="${TD};text-align:center">${p.lines}</td>
      <td style="${NUM}">${p.usd?escapeHtml(p.usd.toLocaleString()):"\u2014"}</td>
      <td style="${NUM}">${p.iqd?escapeHtml(p.iqd.toLocaleString()):"\u2014"}</td>
    </tr>`).join("")}
    <tr>
      <td style="${TD};font-weight:800;background:#F5F8FC">All projects</td>
      <td style="${TD};text-align:center;font-weight:800;background:#F5F8FC">${pr.reduce((s,p)=>s+p.lines,0)}</td>
      <td style="${NUM};font-weight:800;background:#F5F8FC">${escapeHtml(t.subUSD.toLocaleString())}</td>
      <td style="${NUM};font-weight:800;background:#F5F8FC">${escapeHtml(t.subIQD.toLocaleString())}</td>
    </tr></tbody>
  </table>
  <div style="margin-top:6px;font-size:9px;font-style:italic;color:#555;line-height:1.6">
    Each project is totalled in both currencies side by side. The final line restates the whole claim, so the project figures can be checked against it.
  </div>`:""}

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">${K()}</span><h3>Settlement</h3></div>
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

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">${K()}</span><h3>Authorisation</h3></div>
  <p style="font-size:10.5px;line-height:1.8">
    The expenses listed above were incurred on company business during the period stated, and the supporting invoices have been submitted with this claim.
  </p>
  <table style="border-collapse:collapse;width:100%"><tr>
    ${sigBlockHTML("exr_emp", r.completedBy||r.employee||"", "Completed by \u2014 Employee Signature", "EJAF Technology")}
    ${sigBlockHTML("exr_apr", r.manager||r.approvedBy||"", "Approved by", "EJAF Technology")}
  </tr></table>`;

  await openReportPDF("EXPENSE_CLAIM",
    `${r.employee||""}${period!=="\u2014"?" \u00b7 "+period:""}`, body, {project:"", client:""});
  toast("Expense report ready!");
};
Object.assign(window,{expenseClaimDoc});

// ── Excel export ─────────────────────────────────────────────────────────
// A spreadsheet suits this document better than Word: finance re-checks the
// arithmetic, and a PDF cannot be re-checked. The sheet therefore carries LIVE
// SUM formulas rather than pasted numbers, exactly as the company's own
// template does — with the difference that each currency is summed from its
// own columns, so the dollar figures can never fall into the dinar total.
window.expenseClaimExcel = function(id){
  if(typeof XLSX==="undefined") return toast("Excel library not loaded");
  const r=(state.expenseReports||[]).find(x=>x.id===id);
  if(!r) return toast("Claim not found");
  try{
    const t=exrTotals(r);
    const lines=(r.lines||[]).filter(l=>String(l.desc||"").trim() ||
      EXR_GROUPS.some(g=>num(l[g.k+"USD"])||num(l[g.k+"IQD"])));
    const A=[];
    // Single-use, exactly like the PDF: it stamps this document and then clears
    // itself, so the next export is not silently given the same number.
    const manualRef=String(window._refOverride||"").trim();
    if(manualRef) window._refOverride="";
    A.push([(typeof xlBrandName==="function")?xlBrandName():"EJAF TECHNOLOGY"]);
    A.push(["Local Transportation and Expense Report \u2014 Reimbursement Claim"]);
    A.push([manualRef || r.ref || ""]);
    A.push([]);
    A.push(["Employee name", r.employee||"", "", "Title", r.title||""]);
    A.push(["Department",    r.department||"", "", "Approved by", r.manager||r.approvedBy||""]);
    A.push(["Date",          r.date||"", "", "Period",
            (r.periodFrom||r.periodTo) ? `${r.periodFrom||""} \u2192 ${r.periodTo||""}` : ""]);
    A.push(["Status", (EXR_STATUS[r.status||"draft"]||{lb:"Draft"}).lb]);
    if((r.projects||[]).length) A.push(["Projects covered", (r.projects||[]).join(" \u00b7 ")]);
    if(num(r.rate)) A.push(["Exchange rate", "1 USD = "+num(r.rate)+" IQD", "", "(project costing only \u2014 the two settlement totals are never merged)"]);
    A.push([]);

    // Two header rows, mirroring the merged group headings of the paper form.
    const hdr1=["Date","Description (from beginning to destination)","Invoice nu.","Project"];
    const hdr2=["","","",""];
    EXR_GROUPS.forEach(g=>{ hdr1.push(g.lb, ""); hdr2.push("USD","IQD"); });
    const HDR_ROW=A.length;                 // 0-based index of hdr1
    A.push(hdr1); A.push(hdr2);

    const FIRST=A.length+1;                 // 1-based spreadsheet row of the first data line
    lines.forEach(l=>{
      const row=[l.date||"", l.desc||"", l.invoiceNo||"", l.project||""];
      EXR_GROUPS.forEach(g=>{
        row.push(num(l[g.k+"USD"])||"", num(l[g.k+"IQD"])||"");
      });
      A.push(row);
    });
    const LAST=A.length;                    // 1-based row of the last data line
    const col=(i)=>{ let s="",n=i; do{ s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26)-1; }while(n>=0); return s; };

    // Per-group totals as real formulas, so an edited cell re-totals itself.
    const totals=["Totals","","",""];
    EXR_GROUPS.forEach((g,gi)=>{
      const cU=col(4+gi*2), cI=col(5+gi*2);
      totals.push(lines.length?{f:`SUM(${cU}${FIRST}:${cU}${LAST})`}:0);
      totals.push(lines.length?{f:`SUM(${cI}${FIRST}:${cI}${LAST})`}:0);
    });
    A.push(totals);
    const TOT=A.length;                     // 1-based row of the totals line

    // Currency subtotals, each from ITS OWN four cells only.
    const usdCells=EXR_GROUPS.map((_,gi)=>`${col(4+gi*2)}${TOT}`).join(",");
    const iqdCells=EXR_GROUPS.map((_,gi)=>`${col(5+gi*2)}${TOT}`).join(",");
    // The two currencies keep their own columns \u2014 the last two money columns of
    // the grid \u2014 so the settlement lines up under the figures it settles.
    let _proj=null, _adv=null;              // section anchors for the styling pass
    const NC = 4+EXR_GROUPS.length*2;       // total column count
    const cUSD = col(NC-2), cIQD = col(NC-1);
    const padRows=[];                       // rows whose label spans A..J
    const pad = (label, usd, iqd)=>{
      const row=new Array(NC).fill("");
      row[0]=label; row[NC-2]=usd; row[NC-1]=iqd;
      padRows.push(A.length);               // 0-based index this row will take
      return row;
    };
    A.push([]);
    A.push(pad("", "USD", "IQD"));
    const SET_HDR=A.length-1;               // 0-based, for the header styling
    A.push(pad("Subtotal",
      lines.length?{f:`SUM(${usdCells})`}:0,
      lines.length?{f:`SUM(${iqdCells})`}:0));
    const SUB=A.length;                     // 1-based row of the subtotal line
    const SUB_R=A.length-1;                 // 0-based, for the styling pass
    A.push(pad("Less advances applied", t.advUSD||0, t.advIQD||0));
    const ADV=A.length;
    const ADV_R=A.length-1;                 // 0-based
    A.push(pad(t.owedByEmployee?"TO BE RETURNED BY THE EMPLOYEE":"TOTAL REIMBURSEMENT DUE",
      {f:`${cUSD}${SUB}-${cUSD}${ADV}`},
      {f:`${cIQD}${SUB}-${cIQD}${ADV}`}));
    const SET_TOT=A.length-1;               // 0-based, for the total styling
    // ── Cost by project, as live formulas ──────────────────────────────
    // The project column is D. Each currency is summed across its own four
    // group columns only, so a dollar figure can never reach a dinar total.
    // A project only earns a row if it actually carries money. Printing a
    // project that recorded nothing is noise on a document meant to be signed.
    const _spent={};
    lines.forEach(l=>{
      const k=String(l.project||"").trim()||"\u2014 Unassigned";
      let u=0,q=0; EXR_GROUPS.forEach(g=>{ u+=num(l[g.k+"USD"]); q+=num(l[g.k+"IQD"]); });
      if(!_spent[k]) _spent[k]={usd:0,iqd:0};
      _spent[k].usd+=u; _spent[k].iqd+=q;
    });
    const spentNames=Object.keys(_spent).filter(k=>_spent[k].usd>0 || _spent[k].iqd>0);

    if(lines.length && spentNames.length){
      const named=spentNames.filter(n=>!n.startsWith("\u2014")).sort((a,b)=>a.localeCompare(b));
      const hasUnassigned=spentNames.some(n=>n.startsWith("\u2014"));
      A.push([]);
      A.push(["Cost by project"]);
      A.push(pad("Project","USD","IQD"));
      const PHDR=A.length-1;                // 0-based, for header styling
      const PFIRST=A.length+1;
      named.forEach(nm=>{
        const crit=`"${String(nm).replace(/"/g,'""')}"`;
        const sums=(off)=>EXR_GROUPS.map((_,gi)=>
          `SUMIF($D$${FIRST}:$D$${LAST},${crit},${col(4+gi*2+off)}$${FIRST}:${col(4+gi*2+off)}$${LAST})`).join("+");
        A.push(pad(nm, {f:sums(0)}, {f:sums(1)}));
      });
      const NLAST=A.length;                 // last named-project row
      if(hasUnassigned){
        // Remainder, so the parts always reconcile with the whole.
        const nc=named.length?`-SUM(${cUSD}${PFIRST}:${cUSD}${NLAST})`:"";
        const nd=named.length?`-SUM(${cIQD}${PFIRST}:${cIQD}${NLAST})`:"";
        const usdCellsT=EXR_GROUPS.map((_,gi)=>`${col(4+gi*2)}${TOT}`).join(",");
        const iqdCellsT=EXR_GROUPS.map((_,gi)=>`${col(5+gi*2)}${TOT}`).join(",");
        A.push(pad("\u2014 Unassigned",
                {f:`SUM(${usdCellsT})${nc}`},
                {f:`SUM(${iqdCellsT})${nd}`}));
      }
      const PLAST=A.length;
      A.push(pad("All projects",
              {f:`SUM(${cUSD}${PFIRST}:${cUSD}${PLAST})`},
              {f:`SUM(${cIQD}${PFIRST}:${cIQD}${PLAST})`}));
      const PTOT=A.length-1;                // 0-based, for total styling
      A.push(["These project rows re-total themselves from the table above, and must add back to the claim subtotals."]);
      _proj={hdr:PHDR, tot:PTOT};
    }

    A.push([]);
    A.push(["US dollar and Iraqi dinar amounts are totalled separately and are never combined."]);

    if((r.advanceIds||[]).length){
      A.push([]); A.push(["Advances applied"]);
      A.push(pad("Reference","USD","IQD"));
      const AHDR=A.length-1;
      (r.advanceIds||[]).forEach(a=>{
        const label=[a.ref||"Advance", a.date?`(${a.date})`:""].filter(Boolean).join(" ");
        A.push(pad(label, num(a.usd)||0, num(a.iqd)||0));
      });
      const ALAST=A.length;
      A.push(pad("Total advances applied",
        {f:`SUM(${cUSD}${AHDR+2}:${cUSD}${ALAST})`},
        {f:`SUM(${cIQD}${AHDR+2}:${cIQD}${ALAST})`}));
      _adv={hdr:AHDR, tot:A.length-1};
    }
    if(r.notes){ A.push([]); A.push(["Notes"]); A.push([r.notes]); }
    A.push([]);
    A.push(["Completed by", r.completedBy||r.employee||"", "", "Approved by", r.approvedBy||""]);
    A.push(["Signature","","", "Signature",""]);

    const ws=XLSX.utils.aoa_to_sheet(A);
    // Column A carries both dates and the long settlement labels, so it is
    // sized for the longest of them rather than for a date alone.
    ws["!cols"]=[{wch:34},{wch:40},{wch:14},{wch:22}]
      .concat(EXR_GROUPS.flatMap(()=>[{wch:13},{wch:16}]));
    // Merge the group headings so the sheet reads like the printed form.
    const merges=[{s:{r:0,c:0},e:{r:0,c:3+EXR_GROUPS.length*2}},
                  {s:{r:1,c:0},e:{r:1,c:3+EXR_GROUPS.length*2}}];
    EXR_GROUPS.forEach((_,gi)=>{
      merges.push({s:{r:HDR_ROW,c:4+gi*2}, e:{r:HDR_ROW,c:5+gi*2}});
    });
    ["A","B","C","D"].forEach((_,i)=>merges.push({s:{r:HDR_ROW,c:i},e:{r:HDR_ROW+1,c:i}}));
    // Each summary label spans A..J so it ends beside its figures instead of
    // leaving most of a page blank between the name and the number.
    padRows.forEach(r=>merges.push({s:{r,c:0},e:{r,c:NC-3}}));
    ws["!merges"]=merges;

    // Presentation only \u2014 values, formulas and merges above are left alone.
    if(typeof xlDress==="function"){
      const rowMap={0:"title", 1:"subtitle", 2:"subtitle",
                    [HDR_ROW]:"header", [HDR_ROW+1]:"header",
                    [SET_HDR]:"header", [SET_TOT]:"total"};
      if(_proj){ rowMap[_proj.hdr]="header"; rowMap[_proj.tot]="total"; }
      if(_adv){  rowMap[_adv.hdr]="header";  rowMap[_adv.tot]="total"; }
      // The label cell of each summary row: same style as its row, but pushed
      // right so it sits against the numbers.
      const cellMap={};
      padRows.forEach(r=>{ cellMap[r+",0"]=(rowMap[r]||"label")+"Right"; });
      // These two are plain lines: bold label, ordinary currency figures.
      cellMap[SUB_R+",0"]="labelRight";
      cellMap[ADV_R+",0"]="labelRight";
      xlDress(ws, {
        rows:rowMap,
        cells:cellMap,
        match:[
          [/^(Employee name|Department|Date|Status|Projects covered|Exchange rate|Approved by)$/, "label"],
          [/^Totals$/, "total"],
          [/^(Cost by project|Advances applied|Notes)$/, "section"],
          [/^(These project rows|US dollar and Iraqi)/, "note"],
          [/^(Completed by|Signature)$/, "label"]
        ],
        // Columns 4+ are the money pairs: USD then IQD for each group, so the
        // two currencies carry visibly different formats in the sheet.
        colStyles:Object.fromEntries(EXR_GROUPS.flatMap((_,gi)=>[[4+gi*2,"usd"],[5+gi*2,"iqd"]])),
        rowsHt:[{hpt:24},{hpt:18},{hpt:16}]
      });
    }

    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expense Report");
    const safe=(s)=>String(s||"").replace(/[^A-Za-z0-9._-]+/g,"_").slice(0,40);
    XLSX.writeFile(wb, `Expense_Report_${safe(r.ref||r.employee)}_${r.date||""}.xlsx`);
    toast("Excel exported \u2713");
  }catch(e){
    console.error(e);
    toast("Export failed: "+e.message);
  }
};

// One button, three formats — the toggle above it decides which.
window.expenseClaimOut = function(id){
  if(window._rptFormat==="excel") return expenseClaimExcel(id);
  return expenseClaimDoc(id);
};
Object.assign(window,{expenseClaimExcel, expenseClaimOut});
