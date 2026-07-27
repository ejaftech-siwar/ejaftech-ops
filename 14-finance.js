// ═══════════════════════════════════════════════════════════════════════════
//  14-finance.js  (v179)
//  The revenue side of the business. Girêk already knew what work COST —
//  logged hours × hourlyCost, per-diems, and material consumption. It did not
//  know what that work was WORTH, so no quotation could be issued, scope creep
//  went unbilled, and margin could only be guessed at.
//
//    A. Currency        — IQD/USD with the applied rate stored on every document
//    B. Quotations      — priced offer -> client approval -> contract value
//    C. Variations      — change orders that revise the contract value
//    D. Project P&L     — revenue vs cost, built on the existing projectEconomics
//
//  Isolated in its own module: separate collections, separate state keys, no
//  mutation of anything another feature owns.
// ═══════════════════════════════════════════════════════════════════════════

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  A.  CURRENCY                                                          ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// Iraq runs a dual-currency market and the official and parallel rates differ
// materially. A contract priced today must therefore carry the rate that was
// applied to it: recomputing an old document at today's rate silently rewrites
// history and is the single easiest way to lose money on a long project.

const CUR_CODES = ["IQD","USD"];
const CUR_INFO  = { IQD:{sym:"IQD", dp:0}, USD:{sym:"$", dp:2} };

function curDoc(){
  return (state.settingsDocs||[]).find(x=>x.id==="currency") || {};
}
function curBase(){      const d=curDoc(); return CUR_CODES.includes(d.base)?d.base:"IQD"; }
function curSecondary(){ const d=curDoc(); return CUR_CODES.includes(d.secondary)?d.secondary:"USD"; }
// Units of BASE per one unit of SECONDARY (e.g. 1470 IQD per 1 USD).
function curRate(){
  const r = Number(curDoc().rate);
  return (isFinite(r) && r > 0) ? r : 0;
}
// Every figure typed into a money field passes through here. A single stray
// letter used to turn one line into NaN, and NaN propagates: the subtotal, the
// tax, the total and the whole project P&L all became NaN from one keystroke.
// Anything that is not a finite number counts as zero.
function num(v){
  if(v===null || v===undefined || v==="") return 0;
  const n = Number(String(v).replace(/,/g,"").trim());
  return isFinite(n) ? n : 0;
}
function curRateUpdated(){ return curDoc().rateAt || ""; }

// Convert between the two configured currencies. Returns null when the rate is
// unknown, so callers show "—" instead of a fabricated number.
function curConvert(amount, from, to, rate){
  const a = num(amount);
  const r = num(rate) || curRate();
  if(!from || !to || from===to) return a;
  if(!r) return null;
  if(from===curSecondary() && to===curBase()) return a * r;
  if(from===curBase() && to===curSecondary()) return a / r;
  return null;
}

function curFmt(amount, code){
  const c = CUR_CODES.includes(code) ? code : curBase();
  const i = CUR_INFO[c] || {sym:c, dp:0};
  const n = num(amount);
  const s = n.toLocaleString(undefined,{minimumFractionDigits:i.dp, maximumFractionDigits:i.dp});
  return c==="USD" ? `$${s}` : `${s} ${i.sym}`;
}
// Primary amount plus its counterpart at the document's own rate.
function curDual(amount, code, rate){
  const c = CUR_CODES.includes(code) ? code : curBase();
  const other = (c===curBase()) ? curSecondary() : curBase();
  const conv = curConvert(amount, c, other, rate);
  const main = curFmt(amount, c);
  if(conv===null) return main;
  return `${main} <span style="color:var(--muted);font-weight:500">\u2248 ${curFmt(conv, other)}</span>`;
}
function curDualPlain(amount, code, rate){
  const c = CUR_CODES.includes(code) ? code : curBase();
  const other = (c===curBase()) ? curSecondary() : curBase();
  const conv = curConvert(amount, c, other, rate);
  return conv===null ? curFmt(amount,c) : `${curFmt(amount,c)} \u2248 ${curFmt(conv,other)}`;
}
Object.assign(window,{num, CUR_CODES, CUR_INFO, curDoc, curBase, curSecondary, curRate,
  curRateUpdated, curConvert, curFmt, curDual, curDualPlain});

window._curForm = window._curForm || null;
window.curSetRate = async function(v){
  if(!isAdmin()) return toast("Admin only");
  const r = Number(String(v||"").replace(/,/g,"").trim());
  if(!isFinite(r) || r<=0) return toast("\u26a0 Enter the rate as a positive number");
  if(r > 100000) return toast("\u26a0 That rate looks wrong \u2014 check it");
  const d = curDoc();
  const docs = state.settingsDocs || (state.settingsDocs=[]);
  const cur = docs.find(x=>x.id==="currency");
  const next = {...d, id:"currency", base:curBase(), secondary:curSecondary(),
                rate:r, rateAt:new Date().toISOString()};
  if(cur) Object.assign(cur,next); else docs.push(next);
  render();
  try{ await fbSave("settings", next); saveToast("Exchange rate updated \u2713"); }
  catch(e){ toast("\u26a0 Could not save the rate"); }
};
window.curSetPair = async function(which, code){
  if(!isAdmin()) return toast("Admin only");
  if(!CUR_CODES.includes(code)) return;
  const d = curDoc();
  const next = {...d, id:"currency", base:curBase(), secondary:curSecondary(), [which]:code};
  if(next.base===next.secondary) return toast("\u26a0 The two currencies must differ");
  const docs = state.settingsDocs || (state.settingsDocs=[]);
  const cur = docs.find(x=>x.id==="currency");
  if(cur) Object.assign(cur,next); else docs.push(next);
  render();
  try{ await fbSave("settings", next); }catch(e){ toast("\u26a0 Could not save"); }
};

function renderCurrency(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const r = curRate(), at = curRateUpdated();
  return `<div class="card">
    <div class="sec-hdr">\u{1F4B1} Currencies</div>
    <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:10px">
      Every quotation, variation and contract stores <strong>the rate that was applied to it</strong>.
      Changing the rate here affects new documents only \u2014 an issued quotation keeps the figure the client agreed to.
    </p>
    <div class="form-grid">
      <div class="field"><label>Contract currency</label>
        <div style="display:flex;gap:5px">${CUR_CODES.map(c=>`<button class="btn btn-sm ${curBase()===c?"":"btn-secondary"}" style="${curBase()===c?"background:#03308B;color:#fff;border:none;":""}font-weight:700" onclick="curSetPair('base','${c}')">${c}</button>`).join("")}</div>
      </div>
      <div class="field"><label>Reported alongside</label>
        <div style="display:flex;gap:5px">${CUR_CODES.map(c=>`<button class="btn btn-sm ${curSecondary()===c?"":"btn-secondary"}" style="${curSecondary()===c?"background:#03308B;color:#fff;border:none;":""}font-weight:700" onclick="curSetPair('secondary','${c}')">${c}</button>`).join("")}</div>
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Rate \u2014 ${escapeHtml(curBase())} per 1 ${escapeHtml(curSecondary())}</label>
        <input value="${r?escapeHtml(String(r)):""}" inputmode="decimal" placeholder="e.g. 1470"
               onchange="curSetRate(this.value)">
        <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">
          ${r ? `1 ${escapeHtml(curSecondary())} = ${escapeHtml(String(r))} ${escapeHtml(curBase())}${at?` \u00b7 set ${escapeHtml(String(at).slice(0,10))}`:""}`
              : `No rate set \u2014 amounts show in their own currency only, with no conversion.`}
        </div>
      </div>
    </div>
    ${r?`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:10px;font-size:12px;line-height:2">
      <strong>Check:</strong><br>
      1,000,000 ${escapeHtml(curBase())} \u2192 ${curFmt(curConvert(1000000,curBase(),curSecondary()),curSecondary())}<br>
      1,000 ${escapeHtml(curSecondary())} \u2192 ${curFmt(curConvert(1000,curSecondary(),curBase()),curBase())}
    </div>`:""}
  </div>`;
}
Object.assign(window,{renderCurrency});

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  B.  QUOTATIONS                                                        ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// A priced offer the client can accept in their own portal. On acceptance it
// becomes the project's contract value, which is what the whole P&L hangs on.

const QUO_STATUS = {
  draft:    {lb:"Draft",    bg:"#ECEFF1", fg:"#546E7A", ic:"\u270e"},
  sent:     {lb:"Sent",     bg:"#E3F2FD", fg:"#1565C0", ic:"\u2709"},
  accepted: {lb:"Accepted", bg:"#E8F5E9", fg:"#2E7D32", ic:"\u2713"},
  declined: {lb:"Declined", bg:"#FDECEA", fg:"#C62828", ic:"\u2716"},
  expired:  {lb:"Expired",  bg:"#FFF3E0", fg:"#E65100", ic:"\u23F1"},
};
const LINE_KINDS = [
  {k:"material", lb:"Material", ic:"\u{1F527}"},
  {k:"labour",   lb:"Labour",   ic:"\u{1F477}"},
  {k:"other",    lb:"Other",    ic:"\u{1F4CE}"},
];

function quoteBlank(){
  return {client:"", project:"", title:"", date:(typeof todayStr==="function"?todayStr():""),
          validDays:30, currency:curBase(), rate:curRate(), taxPct:0, discountPct:0,
          status:"draft", terms:"", notes:"", lines:[]};
}
window._quo    = window._quo    || quoteBlank();
window._quoId  = window._quoId  || null;
window._quoView= window._quoView|| "list";

// A quote is expired once its validity has run out, whatever the stored status
// says — the stored value is never silently rewritten, only displayed as such.
function quoteEffectiveStatus(q){
  if(!q) return "draft";
  if(q.status==="accepted" || q.status==="declined") return q.status;
  const days = Number(q.validDays||0);
  if(q.status==="sent" && q.date && days>0){
    const due = new Date(String(q.date)+"T00:00:00Z");
    due.setUTCDate(due.getUTCDate()+days);
    const today = (typeof todayStr==="function") ? todayStr() : new Date().toISOString().slice(0,10);
    if(due.toISOString().slice(0,10) < today) return "expired";
  }
  return q.status||"draft";
}
function quoteValidUntil(q){
  const days=Number(q&&q.validDays||0);
  if(!q||!q.date||!days) return "";
  const d=new Date(String(q.date)+"T00:00:00Z");
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
// One line's net value, discount applied at line level first.
function lineNet(l){
  const qty  = num(l&&l.qty);
  const rate = num(l&&l.unitPrice);
  const disc = Math.min(100, Math.max(0, num(l&&l.discountPct)));
  const gross = qty*rate;
  const net = gross - (gross*disc/100);
  return isFinite(net) ? net : 0;
}
function quoteTotals(q){
  const lines=(q&&q.lines)||[];
  const sub = lines.reduce((s,l)=>s+lineNet(l),0);
  const dPct = Math.min(100, Math.max(0, num(q&&q.discountPct)));
  const disc = sub*dPct/100;
  const net  = sub-disc;
  const tPct = Math.max(0, num(q&&q.taxPct));
  const tax  = net*tPct/100;
  const total= net+tax;
  const byKind={};
  LINE_KINDS.forEach(k=>byKind[k.k]=lines.filter(l=>(l.kind||"other")===k.k).reduce((s,l)=>s+lineNet(l),0));
  const hours=lines.filter(l=>(l.kind||"")==="labour").reduce((s,l)=>s+num(l.qty),0);
  return {sub:+sub.toFixed(2), discPct:dPct, disc:+disc.toFixed(2), net:+net.toFixed(2),
          taxPct:tPct, tax:+tax.toFixed(2), total:+total.toFixed(2), byKind, hours:+hours.toFixed(2),
          count:lines.length};
}
Object.assign(window,{QUO_STATUS, LINE_KINDS, quoteBlank, quoteEffectiveStatus,
                      quoteValidUntil, lineNet, quoteTotals});

// ── Editing ──
window.quoSet = function(k,v){
  window._quo[k]=v;
  if(k==="currency"){ window._quo.rate = curRate(); render(); return; }
  if(k==="taxPct"||k==="discountPct"||k==="validDays"||k==="date") return quoRefreshTotals();
};
window.quoLineAdd = function(kind){
  window._quo.lines.push({kind:kind||"material", code:"", desc:"", unit:"", qty:1, unitPrice:0, discountPct:0});
  render();
};
window.quoLineDel = function(i){ window._quo.lines.splice(i,1); render(); };
window.quoLineSet = function(i,k,v){
  const l=window._quo.lines[i]; if(!l) return;
  l[k]=v;
  quoRefreshTotals();
};
window.quoLinePick = function(i, code){
  const l=window._quo.lines[i]; if(!l) return;
  const p = (typeof partByCode==="function") ? partByCode(code) : null;
  l.code = code||"";
  if(p){ l.desc=p.name||""; l.unit=p.unit||""; if(!Number(l.unitPrice)) l.unitPrice=Number(p.unitCost||0); }
  render();
};
// Totals are recomputed in place: rebuilding the whole screen on every
// keystroke is what made earlier forms feel like they were fighting the user.
function quoRefreshTotals(){
  const t=quoteTotals(window._quo), q=window._quo;
  const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
  set("quoSub",  curFmt(t.sub,q.currency));
  set("quoDisc", t.disc?("- "+curFmt(t.disc,q.currency)):"\u2014");
  set("quoTax",  t.tax?curFmt(t.tax,q.currency):"\u2014");
  set("quoTotal",curDual(t.total,q.currency,q.rate));
  set("quoHours",t.hours?fmtHM(t.hours):"\u2014");
  (window._quo.lines||[]).forEach((l,i)=>{
    const e=document.getElementById("quoLine"+i);
    if(e) e.textContent = curFmt(lineNet(l), q.currency);
  });
}
Object.assign(window,{quoRefreshTotals});

window.quoNew = function(){
  window._quo = quoteBlank();
  window._quoId = null;
  window._quoView = "edit";
  render();
};
window.quoEdit = function(id){
  const q=(state.quotes||[]).find(x=>x.id===id);
  if(!q) return toast("Quotation not found");
  window._quo = {...quoteBlank(), ...q, lines:(q.lines||[]).map(l=>({...l}))};
  window._quoId = id;
  window._quoView = "edit";
  render();
};
window.quoCancel = function(){ window._quoView="list"; window._quoId=null; render(); };

window.quoSave = async function(){
  if(!isAdmin()) return toast("Admin only");
  const q=window._quo;
  if(!String(q.client||"").trim())  return toast("\u26a0 Choose the client");
  if(!String(q.title||"").trim())   return toast("\u26a0 Give the quotation a title");
  if(!(q.lines||[]).length)         return toast("\u26a0 Add at least one line");
  const bad=(q.lines||[]).findIndex(l=>!String(l.desc||l.code||"").trim());
  if(bad>=0) return toast(`\u26a0 Line ${bad+1} has no description`);
  const t=quoteTotals(q);
  const payload={
    id: window._quoId||undefined,
    ref: q.ref || "",
    client:String(q.client).trim(),
    // The client's id as well as their name: a security rule can compare an id
    // but not a display name, so this is what makes per-client read scoping
    // possible later without touching any existing document.
    clientId: ((state.clients||[]).find(x=>(x.name||"").trim()===String(q.client||"").trim())||{}).id || "",
    project:String(q.project||"").trim(),
    title:String(q.title).trim(), date:q.date||"", validDays:Number(q.validDays||0),
    currency: CUR_CODES.includes(q.currency)?q.currency:curBase(),
    rate: Number(q.rate||0),
    taxPct:Number(q.taxPct||0), discountPct:Number(q.discountPct||0),
    status:q.status||"draft", terms:String(q.terms||""), notes:String(q.notes||""),
    lines:(q.lines||[]).map(l=>({kind:l.kind||"other", code:String(l.code||""),
      desc:String(l.desc||""), unit:String(l.unit||""), qty:Number(l.qty||0),
      unitPrice:Number(l.unitPrice||0), discountPct:Number(l.discountPct||0)})),
    total:t.total, net:t.net, hours:t.hours,
    updatedAt:new Date().toISOString(),
    ...(window._quoId?{}:{createdAt:new Date().toISOString(),
        createdBy:(state.profile&&(state.profile.name||state.profile.email))||""}),
  };
  // A reference is issued once, on first save, and never changes afterwards.
  if(!payload.ref){
    try{ payload.ref = await generateRefNo("QUOTATION", {project:payload.project, client:payload.client}); }
    catch(e){ payload.ref = ""; }
  }
  await fbSave("quotes", payload);
  window._quoView="list"; window._quoId=null;
  saveToast(window._quoId?"Quotation updated \u2713":"Quotation saved \u2713");
  render();
};
window.quoDel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const q=(state.quotes||[]).find(x=>x.id===id); if(!q) return;
  if(quoteEffectiveStatus(q)==="accepted" &&
     !await uiConfirm(`"${q.title}" was accepted by the client and may back a live contract value.\n\nDelete it anyway?`)) return;
  else if(quoteEffectiveStatus(q)!=="accepted" && !await uiConfirm("Delete this quotation?")) return;
  await fbDelete("quotes", id);
  toast("Quotation deleted");
};
window.quoStatus = async function(id, next){
  if(!isAdmin()) return toast("Admin only");
  const q=(state.quotes||[]).find(x=>x.id===id); if(!q) return;
  await fbSave("quotes", {...q, status:next, statusAt:new Date().toISOString(),
    statusBy:(state.profile&&(state.profile.name||state.profile.email))||""});
  saveToast(`Marked ${(QUO_STATUS[next]||{lb:next}).lb} \u2713`);
};

// Acceptance is the moment a quotation becomes money: it writes the contract
// value onto the project. Done explicitly and reviewably rather than silently.
window.quoAccept = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const q=(state.quotes||[]).find(x=>x.id===id); if(!q) return toast("Quotation not found");
  const t=quoteTotals(q);
  const proj=(state.projects||[]).find(p=>(p.name||"").trim()===String(q.project||"").trim());
  if(!proj){
    if(!await uiConfirm(`Mark "${q.title}" accepted?\n\nIt is not linked to a project, so no contract value will be written. Link it to a project first if you want the P&L to follow.`)) return;
    return quoStatus(id,"accepted");
  }
  const prev=Number(proj.contractValue||0);
  const msg = prev
    ? `Accept "${q.title}"?\n\nProject "${proj.name}" already carries a contract value of ${curDualPlain(prev, q.currency, q.rate)}.\nIt will be REPLACED by ${curDualPlain(t.total, q.currency, q.rate)}.\n\nUse a variation instead if this is additional work.`
    : `Accept "${q.title}"?\n\nContract value ${curDualPlain(t.total, q.currency, q.rate)} will be written to project "${proj.name}"${t.hours?`, and ${fmtHM(t.hours)} of quoted labour recorded`:""}.`;
  if(!await uiConfirm(msg)) return;
  await fbSave("quotes", {...q, status:"accepted", statusAt:new Date().toISOString(),
    statusBy:(state.profile&&(state.profile.name||state.profile.email))||""});
  await fbSave("projects", {...proj,
    contractValue: t.total,
    contractCurrency: q.currency,
    contractRate: Number(q.rate||0),
    contractQuoteRef: q.ref||"",
    ...(t.hours && !Number(proj.estimatedHours) ? {estimatedHours:t.hours} : {}),
  });
  saveToast(`Accepted \u2014 contract value written to ${proj.name} \u2713`);
};

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  C.  VARIATIONS (change orders)                                        ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// Scope creep that nobody priced is unpaid work. A variation is an explicit,
// approvable delta to the contract value, positive or negative.

const VAR_STATUS = {
  draft:    {lb:"Draft",    bg:"#ECEFF1", fg:"#546E7A", ic:"\u270e"},
  submitted:{lb:"Submitted",bg:"#FFF8E1", fg:"#8F6E22", ic:"\u23F3"},
  approved: {lb:"Approved", bg:"#E8F5E9", fg:"#2E7D32", ic:"\u2713"},
  rejected: {lb:"Rejected", bg:"#FDECEA", fg:"#C62828", ic:"\u2716"},
};
function varBlank(){
  return {project:"", title:"", reason:"", date:(typeof todayStr==="function"?todayStr():""),
          currency:curBase(), rate:curRate(), status:"draft", lines:[], notes:""};
}
window._var     = window._var     || varBlank();
window._varId   = window._varId   || null;
window._varView = window._varView || "list";

function varTotals(v){
  const lines=(v&&v.lines)||[];
  const total=lines.reduce((s,l)=>s+lineNet(l),0);
  const hours=lines.filter(l=>(l.kind||"")==="labour").reduce((s,l)=>s+num(l.qty),0);
  return {total:+total.toFixed(2), hours:+hours.toFixed(2), count:lines.length};
}
// Only APPROVED variations move the contract value. Drafts and submissions are
// visible but never counted, so the revised figure is always defensible.
function variationsFor(projectName, onlyApproved){
  const n=String(projectName||"").trim();
  return (state.variations||[])
    .filter(v=>String(v.project||"").trim()===n)
    .filter(v=>!onlyApproved || v.status==="approved")
    .slice().sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
}
function variationsValue(projectName){
  return variationsFor(projectName,true).reduce((s,v)=>s+varTotals(v).total,0);
}
function variationsHours(projectName){
  return variationsFor(projectName,true).reduce((s,v)=>s+varTotals(v).hours,0);
}
Object.assign(window,{VAR_STATUS, varBlank, varTotals, variationsFor, variationsValue, variationsHours});

window.varNew  = function(){ window._var=varBlank(); window._varId=null; window._varView="edit"; render(); };
window.varEdit = function(id){
  const v=(state.variations||[]).find(x=>x.id===id);
  if(!v) return toast("Variation not found");
  window._var={...varBlank(), ...v, lines:(v.lines||[]).map(l=>({...l}))};
  window._varId=id; window._varView="edit"; render();
};
window.varCancel  = function(){ window._varView="list"; window._varId=null; render(); };
window.varSet     = function(k,v){ window._var[k]=v; if(k==="currency"){ window._var.rate=curRate(); render(); } };
window.varLineAdd = function(kind){ window._var.lines.push({kind:kind||"material",code:"",desc:"",unit:"",qty:1,unitPrice:0,discountPct:0}); render(); };
window.varLineDel = function(i){ window._var.lines.splice(i,1); render(); };
window.varLineSet = function(i,k,val){
  const l=window._var.lines[i]; if(!l) return;
  l[k]=val;
  const t=varTotals(window._var);
  const e=document.getElementById("varTotal"); if(e) e.innerHTML=curDual(t.total, window._var.currency, window._var.rate);
  const c=document.getElementById("varLine"+i); if(c) c.textContent=curFmt(lineNet(l), window._var.currency);
};
window.varLinePick = function(i,code){
  const l=window._var.lines[i]; if(!l) return;
  const p=(typeof partByCode==="function")?partByCode(code):null;
  l.code=code||"";
  if(p){ l.desc=p.name||""; l.unit=p.unit||""; if(!Number(l.unitPrice)) l.unitPrice=Number(p.unitCost||0); }
  render();
};
window.varSave = async function(){
  if(!isAdmin()) return toast("Admin only");
  const v=window._var;
  if(!String(v.project||"").trim()) return toast("\u26a0 Choose the project this varies");
  if(!String(v.title||"").trim())   return toast("\u26a0 Give the variation a title");
  if(!String(v.reason||"").trim())  return toast("\u26a0 State the reason \u2014 this is what the client approves");
  if(!(v.lines||[]).length)         return toast("\u26a0 Add at least one line");
  const t=varTotals(v);
  const payload={
    id: window._varId||undefined,
    ref: v.ref||"",
    project:String(v.project).trim(), title:String(v.title).trim(),
    reason:String(v.reason).trim(), date:v.date||"",
    currency: CUR_CODES.includes(v.currency)?v.currency:curBase(),
    rate:Number(v.rate||0), status:v.status||"draft", notes:String(v.notes||""),
    lines:(v.lines||[]).map(l=>({kind:l.kind||"other", code:String(l.code||""),
      desc:String(l.desc||""), unit:String(l.unit||""), qty:Number(l.qty||0),
      unitPrice:Number(l.unitPrice||0), discountPct:Number(l.discountPct||0)})),
    total:t.total, hours:t.hours,
    updatedAt:new Date().toISOString(),
    ...(window._varId?{}:{createdAt:new Date().toISOString(),
        createdBy:(state.profile&&(state.profile.name||state.profile.email))||""}),
  };
  if(!payload.ref){
    try{ payload.ref = await generateRefNo("VARIATION", {project:payload.project}); }catch(e){ payload.ref=""; }
  }
  await fbSave("variations", payload);
  window._varView="list"; window._varId=null;
  saveToast("Variation saved \u2713");
  render();
};
window.varStatus = async function(id,next){
  if(!isAdmin()) return toast("Admin only");
  const v=(state.variations||[]).find(x=>x.id===id); if(!v) return;
  const t=varTotals(v);
  if(next==="approved"){
    const cur=variationsValue(v.project);
    if(!await uiConfirm(`Approve "${v.title}"?\n\n${curDualPlain(t.total, v.currency, v.rate)} will be added to the revised contract value of "${v.project}".\nApproved variations there currently total ${curDualPlain(cur, v.currency, v.rate)}.`)) return;
  }
  await fbSave("variations", {...v, status:next, statusAt:new Date().toISOString(),
    statusBy:(state.profile&&(state.profile.name||state.profile.email))||""});
  saveToast(`Variation ${(VAR_STATUS[next]||{lb:next}).lb.toLowerCase()} \u2713`);
};
window.varDel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const v=(state.variations||[]).find(x=>x.id===id); if(!v) return;
  const extra = v.status==="approved" ? "\n\nIt is APPROVED and currently counts towards the revised contract value." : "";
  if(!await uiConfirm(`Delete "${v.title}"?${extra}`)) return;
  await fbDelete("variations", id);
  toast("Variation deleted");
};

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  D.  PROJECT P&L                                                       ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// Built ON TOP of the existing projectEconomics rather than beside it, so there
// is one definition of cost in the app. What is added here is the revenue side:
// the contract value can now be revised by approved variations, and material
// consumption joins labour and per-diems on the cost side.

function projectFinance(name){
  const n=String(name||"").trim();
  const p=(state.projects||[]).find(x=>(x.name||"").trim()===n);
  if(!p) return null;
  const cur  = CUR_CODES.includes(p.contractCurrency) ? p.contractCurrency : curBase();
  const rate = Number(p.contractRate||0) || curRate();

  const base   = Number(p.contractValue||0);
  const varVal = variationsValue(n);
  const revenue= base + varVal;

  // Cost: labour and per-diems come from the existing engine so the two screens
  // can never disagree; materials are added from recorded consumption.
  const econ = (typeof projectEconomics==="function") ? projectEconomics(n) : null;
  const hours   = econ ? Number(econ.hours||0)
                       : (state.daily||[]).filter(r=>(r.project||"").trim()===n)
                           .reduce((s,r)=>s+Number(r.duration||0),0);
  const hourly  = Number(p.hourlyCost||0);
  const labour  = econ ? (hours*hourly) : hours*hourly;
  const perDiem = econ ? Number(econ.perDiem||0)
                       : (state.travel||[]).filter(t=>(t.project||"").trim()===n)
                           .reduce((s,t)=>s+Number(t.perDiem||0),0);
  const material= (typeof partsConsumption==="function") ? Number(partsConsumption(n).totalCost||0) : 0;
  const cost    = labour + perDiem + material;

  const quotes = (state.quotes||[]).filter(q=>String(q.project||"").trim()===n);
  const margin = revenue>0 ? revenue-cost : null;
  return {
    project:p, currency:cur, rate,
    base, variations:varVal, variationCount:variationsFor(n,true).length,
    pendingVariations:(state.variations||[]).filter(v=>String(v.project||"").trim()===n && v.status==="submitted").length,
    revenue,
    hours:+hours.toFixed(1), hourly, labour:Math.round(labour),
    perDiem:Math.round(perDiem), material:Math.round(material), cost:Math.round(cost),
    margin: margin===null?null:Math.round(margin),
    marginPct: revenue>0 ? Math.round((revenue-cost)/revenue*100) : null,
    level: revenue<=0 ? "unknown" : cost>revenue ? "loss" : cost>revenue*0.85 ? "tight" : "healthy",
    quotedHours: variationsHours(n) + quotes.filter(q=>q.status==="accepted").reduce((s,q)=>s+Number(q.hours||0),0),
    quotes,
  };
}
Object.assign(window,{projectFinance});

const FIN_LEVEL={healthy:{bg:"#E8F5E9",fg:"#2E7D32",lb:"Healthy"},
                 tight:{bg:"#FFF8E1",fg:"#8F6E22",lb:"Tight"},
                 loss:{bg:"#FDECEA",fg:"#C62828",lb:"Loss"},
                 unknown:{bg:"#F5F8FC",fg:"#6B7B8F",lb:"No contract value"}};

function financeRow(l,v,strong){
  return `<tr><td style="padding:5px 8px;border-bottom:1px solid var(--line);font-size:11px;${strong?"font-weight:800":"color:var(--muted)"}">${l}</td>
    <td style="padding:5px 8px;border-bottom:1px solid var(--line);text-align:right;font-size:${strong?"13px":"12px"};${strong?"font-weight:800":""}">${v}</td></tr>`;
}
// The P&L card, reused on the Finance screen and anywhere a project is shown.
function projectFinanceCard(name){
  const f=projectFinance(name);
  if(!f) return "";
  const L=FIN_LEVEL[f.level];
  return `<div class="card" style="border-left:4px solid ${L.fg}">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\u{1F4CA} ${escapeHtml(name)}
      <span style="background:${L.bg};color:${L.fg};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800">${L.lb}${f.marginPct!=null?` \u00b7 ${f.marginPct}%`:""}</span>
    </div>
    <table style="border-collapse:collapse;width:100%">
      ${financeRow("Contract value", curDual(f.base,f.currency,f.rate))}
      ${f.variationCount?financeRow(`Approved variations (${f.variationCount})`, (f.variations>=0?"+ ":"- ")+curFmt(Math.abs(f.variations),f.currency)):""}
      ${financeRow("Revenue", curDual(f.revenue,f.currency,f.rate), true)}
      ${financeRow(`Labour \u00b7 ${fmtHM(f.hours)} @ ${curFmt(f.hourly,f.currency)}/h`, curFmt(f.labour,f.currency))}
      ${f.perDiem?financeRow("Travel per-diem", curFmt(f.perDiem,f.currency)):""}
      ${f.material?financeRow("Material consumed", curFmt(f.material,f.currency)):""}
      ${financeRow("Cost", curDual(f.cost,f.currency,f.rate), true)}
      ${financeRow("Margin", f.margin===null?'<span style="color:var(--muted)">\u2014</span>'
        :`<span style="color:${L.fg}">${curDual(f.margin,f.currency,f.rate)}</span>`, true)}
    </table>
    ${!f.hourly?`<div style="font-size:10px;color:#E65100;margin-top:8px;line-height:1.6">\u26a0 No hourly cost set for this project, so labour counts as zero. Set it in <strong>Projects \u2192 edit</strong>.</div>`:""}
    ${f.pendingVariations?`<div style="font-size:10px;color:#8F6E22;margin-top:8px;line-height:1.6">\u23F3 ${f.pendingVariations} variation(s) submitted and not yet approved \u2014 not counted above.</div>`:""}
    ${f.revenue<=0?`<div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.6">No contract value yet. Accept a quotation, or set it directly in <strong>Projects \u2192 edit</strong>.</div>`:""}
  </div>`;
}
Object.assign(window,{projectFinanceCard, FIN_LEVEL});

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  SCREENS                                                               ║
// ╚═════════════════════════════════════════════════════════════════════════╝
window._finView = window._finView || "pl";

function _finLineEditor(kind, lines, setFn, pickFn, delFn, addFn, currency, idPfx){
  const cat=(typeof partsList==="function")?partsList():[];
  return `${lines.map((l,i)=>`<div style="border:1px solid var(--line);border-radius:8px;padding:8px;margin-top:8px">
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:800;color:var(--muted);min-width:20px">${String(i+1).padStart(2,"0")}</span>
      <select onchange="${setFn}(${i},'kind',this.value)" style="width:104px;font-size:11px">
        ${LINE_KINDS.map(k=>`<option value="${k.k}" ${(l.kind||"material")===k.k?"selected":""}>${k.ic} ${k.lb}</option>`).join("")}
      </select>
      ${cat.length?`<select onchange="${pickFn}(${i},this.value)" style="flex:1;min-width:120px;font-size:11px">
        <option value="">\u2014 free text \u2014</option>
        ${cat.map(p=>`<option value="${escapeHtml(p.code||"")}" ${String(l.code||"")===String(p.code||"")?"selected":""}>${escapeHtml(p.code||"")} \u00b7 ${escapeHtml(p.name||"")}</option>`).join("")}
      </select>`:""}
      <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="${delFn}(${i})">\u00d7</button>
    </div>
    <input value="${escapeHtml(l.desc||"")}" oninput="${setFn}(${i},'desc',this.value)" placeholder="Description" style="width:100%;margin-top:6px">
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
      <input value="${escapeHtml(String(l.qty==null?"":l.qty))}" oninput="${setFn}(${i},'qty',this.value)" placeholder="${(l.kind==='labour')?'Hours':'Qty'}" inputmode="decimal" style="width:74px">
      <input value="${escapeHtml(l.unit||"")}" oninput="${setFn}(${i},'unit',this.value)" placeholder="Unit" style="width:64px">
      <input value="${escapeHtml(String(l.unitPrice==null?"":l.unitPrice))}" oninput="${setFn}(${i},'unitPrice',this.value)" placeholder="Unit price" inputmode="decimal" style="width:104px">
      <input value="${escapeHtml(String(l.discountPct||""))}" oninput="${setFn}(${i},'discountPct',this.value)" placeholder="Disc %" inputmode="decimal" style="width:70px">
      <span style="margin-left:auto;font-size:12px;font-weight:800" id="${idPfx}${i}">${curFmt(lineNet(l),currency)}</span>
    </div>
  </div>`).join("")}
  <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
    ${LINE_KINDS.map(k=>`<button class="btn btn-sm btn-secondary" onclick="${addFn}('${k.k}')">+ ${k.ic} ${k.lb}</button>`).join("")}
  </div>`;
}

function renderQuotes(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const clients=(state.clients||[]).map(c=>c.name).filter(Boolean).sort();
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();

  if(window._quoView==="edit"){
    const q=window._quo, t=quoteTotals(q), vu=quoteValidUntil(q);
    return `<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${window._quoId?"Edit quotation":"New quotation"}
        ${q.ref?`<span style="font-size:11px;color:var(--muted);font-weight:600">${escapeHtml(q.ref)}</span>`:""}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="quoCancel()">Cancel</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Client <span class="req">*</span></label>
          <select onchange="quoSet('client',this.value)"><option value="">\u2014 select \u2014</option>
            ${clients.map(c=>`<option ${q.client===c?"selected":""}>${escapeHtml(c)}</option>`).join("")}</select></div>
        <div class="field"><label>Project <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 links the P&amp;L</span></label>
          <select onchange="quoSet('project',this.value)"><option value="">\u2014 none \u2014</option>
            ${projects.map(p=>`<option ${q.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Title <span class="req">*</span></label>
          <input value="${escapeHtml(q.title||"")}" oninput="quoSet('title',this.value)" placeholder="e.g. CCTV expansion \u2014 north gate"></div>
        <div class="field"><label>Date</label><input type="date" value="${escapeHtml(q.date||"")}" onchange="quoSet('date',this.value);render()"></div>
        <div class="field"><label>Valid for (days)</label><input value="${escapeHtml(String(q.validDays||""))}" oninput="quoSet('validDays',this.value)" inputmode="numeric" onchange="render()"></div>
        <div class="field"><label>Currency</label>
          <select onchange="quoSet('currency',this.value)">${CUR_CODES.map(c=>`<option ${q.currency===c?"selected":""}>${c}</option>`).join("")}</select></div>
        <div class="field"><label>Rate applied</label>
          <input value="${escapeHtml(String(q.rate||""))}" oninput="quoSet('rate',this.value)" inputmode="decimal" placeholder="${curRate()||"not set"}">
          <div style="font-size:10px;color:var(--muted);margin-top:4px">Frozen on this quotation \u2014 a later rate change does not alter it.</div></div>
      </div>
      ${vu?`<div style="font-size:11px;color:var(--muted);margin-top:8px">Valid until <strong>${escapeHtml(fmtDate(vu))}</strong></div>`:""}
    </div>

    <div class="card">
      <div class="sec-hdr">Lines <span style="font-size:10px;color:var(--muted);font-weight:500">(${t.count})</span></div>
      ${_finLineEditor("quo", q.lines, "quoLineSet", "quoLinePick", "quoLineDel", "quoLineAdd", q.currency, "quoLine")}
    </div>

    <div class="card">
      <div class="sec-hdr">Totals</div>
      <div class="form-grid">
        <div class="field"><label>Overall discount %</label><input value="${escapeHtml(String(q.discountPct||""))}" oninput="quoSet('discountPct',this.value)" inputmode="decimal" placeholder="0"></div>
        <div class="field"><label>Tax %</label><input value="${escapeHtml(String(q.taxPct||""))}" oninput="quoSet('taxPct',this.value)" inputmode="decimal" placeholder="0"></div>
      </div>
      <table style="border-collapse:collapse;width:100%;margin-top:10px">
        ${financeRow("Subtotal", `<span id="quoSub">${curFmt(t.sub,q.currency)}</span>`)}
        ${financeRow("Discount", `<span id="quoDisc">${t.disc?"- "+curFmt(t.disc,q.currency):"\u2014"}</span>`)}
        ${financeRow("Tax",      `<span id="quoTax">${t.tax?curFmt(t.tax,q.currency):"\u2014"}</span>`)}
        ${financeRow("Quoted labour", `<span id="quoHours">${t.hours?fmtHM(t.hours):"\u2014"}</span>`)}
        ${financeRow("Total", `<span id="quoTotal">${curDual(t.total,q.currency,q.rate)}</span>`, true)}
      </table>
      <div class="field" style="margin-top:10px"><label>Terms</label>
        <textarea rows="2" oninput="quoSet('terms',this.value)" placeholder="Payment terms, exclusions, lead time\u2026">${escapeHtml(q.terms||"")}</textarea></div>
      <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="quoSave()">Save quotation</button>
    </div>`;
  }

  const rows=(state.quotes||[]).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const sum=(st)=>rows.filter(q=>quoteEffectiveStatus(q)===st).reduce((s,q)=>s+Number(q.total||0),0);
  return `<div class="card">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="quoNew()">+ New quotation</button>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${rows.length} quotation(s)</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-top:12px">
      ${[["Sent","sent"],["Accepted","accepted"],["Declined","declined"]].map(([lb,st])=>{
        const S=QUO_STATUS[st];
        return `<div style="background:${S.bg};border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:13px;font-weight:800;color:${S.fg}">${curFmt(sum(st),curBase())}</div>
          <div style="font-size:10px;color:${S.fg}">${lb}</div></div>`;}).join("")}
    </div>
  </div>
  ${!rows.length?`<div class="card"><div class="empty">No quotations yet.</div></div>`:rows.map(q=>{
    const st=quoteEffectiveStatus(q), S=QUO_STATUS[st]||QUO_STATUS.draft, t=quoteTotals(q);
    return `<div class="card">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${escapeHtml(q.title||"\u2014")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${q.ref?escapeHtml(q.ref)+" \u00b7 ":""}${escapeHtml(q.client||"\u2014")}${q.project?" \u00b7 "+escapeHtml(q.project):""}<br>
            ${q.date?escapeHtml(fmtDate(q.date)):"\u2014"}${quoteValidUntil(q)?` \u00b7 valid until ${escapeHtml(fmtDate(quoteValidUntil(q)))}`:""}
          </div>
        </div>
        <span style="background:${S.bg};color:${S.fg};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap">${S.ic} ${S.lb}</span>
      </div>
      <div style="font-size:15px;font-weight:800;margin-top:8px">${curDual(t.total,q.currency,q.rate)}</div>
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="quoEdit('${q.id}')">\u270e Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="quotePDF('${q.id}')">\u{1F4C4} PDF</button>
        ${st==="draft"?`<button class="btn btn-sm btn-secondary" onclick="quoStatus('${q.id}','sent')">Mark sent</button>`:""}
        ${(st==="sent"||st==="expired")?`<button class="btn btn-sm" style="background:#2E7D32;color:#fff;border:none" onclick="quoAccept('${q.id}')">\u2713 Accept</button>
          <button class="btn btn-sm btn-secondary" onclick="quoStatus('${q.id}','declined')">Decline</button>`:""}
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="quoDel('${q.id}')">\u00d7</button>
      </div>
    </div>`;}).join("")}`;
}

function renderVariations(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();
  if(window._varView==="edit"){
    const v=window._var, t=varTotals(v);
    return `<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${window._varId?"Edit variation":"New variation"}
        ${v.ref?`<span style="font-size:11px;color:var(--muted);font-weight:600">${escapeHtml(v.ref)}</span>`:""}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="varCancel()">Cancel</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Project <span class="req">*</span></label>
          <select onchange="varSet('project',this.value)"><option value="">\u2014 select \u2014</option>
            ${projects.map(p=>`<option ${v.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        <div class="field"><label>Date</label><input type="date" value="${escapeHtml(v.date||"")}" onchange="varSet('date',this.value)"></div>
        <div class="field" style="grid-column:1/-1"><label>Title <span class="req">*</span></label>
          <input value="${escapeHtml(v.title||"")}" oninput="varSet('title',this.value)" placeholder="e.g. Additional 6 cameras \u2014 basement"></div>
        <div class="field" style="grid-column:1/-1"><label>Reason <span class="req">*</span> <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 this is what the client approves</span></label>
          <textarea rows="2" oninput="varSet('reason',this.value)" placeholder="Why the scope changed and who asked for it">${escapeHtml(v.reason||"")}</textarea></div>
        <div class="field"><label>Currency</label>
          <select onchange="varSet('currency',this.value)">${CUR_CODES.map(c=>`<option ${v.currency===c?"selected":""}>${c}</option>`).join("")}</select></div>
        <div class="field"><label>Rate applied</label><input value="${escapeHtml(String(v.rate||""))}" oninput="varSet('rate',this.value)" inputmode="decimal" placeholder="${curRate()||"not set"}"></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.6">A negative quantity or price records a REDUCTION in scope \u2014 omissions are variations too.</div>
    </div>
    <div class="card">
      <div class="sec-hdr">Lines <span style="font-size:10px;color:var(--muted);font-weight:500">(${t.count})</span></div>
      ${_finLineEditor("var", v.lines, "varLineSet", "varLinePick", "varLineDel", "varLineAdd", v.currency, "varLine")}
      <table style="border-collapse:collapse;width:100%;margin-top:12px">
        ${financeRow("Variation value", `<span id="varTotal">${curDual(t.total,v.currency,v.rate)}</span>`, true)}
      </table>
      <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="varSave()">Save variation</button>
    </div>`;
  }
  const rows=(state.variations||[]).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  return `<div class="card">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="varNew()">+ New variation</button>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${rows.length} variation(s)</span>
    </div>
  </div>
  ${!rows.length?`<div class="card"><div class="empty">No variations yet.</div></div>`:rows.map(v=>{
    const S=VAR_STATUS[v.status||"draft"]||VAR_STATUS.draft, t=varTotals(v);
    return `<div class="card">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${escapeHtml(v.title||"\u2014")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${v.ref?escapeHtml(v.ref)+" \u00b7 ":""}${escapeHtml(v.project||"\u2014")} \u00b7 ${v.date?escapeHtml(fmtDate(v.date)):"\u2014"}</div>
        </div>
        <span style="background:${S.bg};color:${S.fg};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap">${S.ic} ${S.lb}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.6">${escapeHtml(v.reason||"")}</div>
      <div style="font-size:15px;font-weight:800;margin-top:8px;color:${t.total<0?"#C62828":"inherit"}">${t.total<0?"- ":""}${curDual(Math.abs(t.total),v.currency,v.rate)}</div>
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="varEdit('${v.id}')">\u270e Edit</button>
        ${v.status==="draft"?`<button class="btn btn-sm btn-secondary" onclick="varStatus('${v.id}','submitted')">Submit</button>`:""}
        ${v.status==="submitted"?`<button class="btn btn-sm" style="background:#2E7D32;color:#fff;border:none" onclick="varStatus('${v.id}','approved')">\u2713 Approve</button>
          <button class="btn btn-sm btn-secondary" onclick="varStatus('${v.id}','rejected')">Reject</button>`:""}
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="varDel('${v.id}')">\u00d7</button>
      </div>
    </div>`;}).join("")}`;
}

function renderFinance(){
  if(!(isAdmin()||hasCap("canAnalytics"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  let h=_pills('_finView',[{id:"pl",ic:"\u{1F4CA}",lb:"P&L"},{id:"quotes",ic:"\u{1F4B0}",lb:"Quotations"},
                           {id:"variations",ic:"\u{1F501}",lb:"Variations"},{id:"currency",ic:"\u{1F4B1}",lb:"Currency"}]);
  const v=window._finView||"pl";
  if(v==="quotes")     return h + renderQuotes();
  if(v==="variations") return h + renderVariations();
  if(v==="currency")   return h + renderCurrency();

  const names=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();
  const all=names.map(n=>projectFinance(n)).filter(Boolean);
  const withValue=all.filter(f=>f.revenue>0);
  const rev=withValue.reduce((s,f)=>s+f.revenue,0);
  const cost=withValue.reduce((s,f)=>s+f.cost,0);
  const marg=rev-cost;
  return h + `<div class="card">
    <div class="sec-hdr">Portfolio</div>
    ${!withValue.length?`<div style="font-size:11px;color:var(--muted);line-height:1.7">No project carries a contract value yet. Accept a quotation, or set the value directly in <strong>Projects \u2192 edit</strong>.</div>`
    :`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px">
      ${[["Revenue",curFmt(rev,curBase()),"#03308B"],["Cost",curFmt(cost,curBase()),"#6D4C41"],
         ["Margin",curFmt(marg,curBase()),marg<0?"#C62828":"#2E7D32"],
         ["Margin %",rev>0?Math.round(marg/rev*100)+"%":"\u2014",marg<0?"#C62828":"#2E7D32"]]
        .map(([l,val,c])=>`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:14px;font-weight:800;color:${c}">${val}</div>
          <div style="font-size:10px;color:var(--muted)">${l}</div></div>`).join("")}
    </div>
    ${curRate()?`<div style="font-size:10px;color:var(--muted);margin-top:9px">Totals shown in ${escapeHtml(curBase())} at each document's own rate. 1 ${escapeHtml(curSecondary())} = ${escapeHtml(String(curRate()))} ${escapeHtml(curBase())}.</div>`:`<div style="font-size:10px;color:#E65100;margin-top:9px">No exchange rate set \u2014 amounts in a second currency cannot be converted. Set it under <strong>Currency</strong>.</div>`}`}
  </div>
  ${all.map(f=>projectFinanceCard(f.project.name)).join("")}`;
}
Object.assign(window,{renderFinance, renderQuotes, renderVariations});

// ── Quotation PDF ────────────────────────────────────────────────────────
window.quotePDF = async function(id){
  const q=(state.quotes||[]).find(x=>x.id===id);
  if(!q) return toast("Quotation not found");
  const t=quoteTotals(q), vu=quoteValidUntil(q), st=quoteEffectiveStatus(q);
  const TH='padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left';
  const TD='padding:6px 9px;border:1px solid #D6E4F0';
  const row=(l,v,strong)=>`<tr>
    <td style="padding:6px 10px;border:1px solid #D6E4F0;${strong?"font-weight:800":""};width:60%">${l}</td>
    <td style="padding:6px 10px;border:1px solid #D6E4F0;text-align:right;${strong?"font-weight:800;font-size:13px":""}">${v}</td></tr>`;
  const body=`
  <div class="ksec"><span class="kbad">01</span><h3>Quotation</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${row("Client", escapeHtml(q.client||"\u2014"))}
    ${q.project?row("Project", escapeHtml(q.project)):""}
    ${row("Title", escapeHtml(q.title||"\u2014"))}
    ${row("Date", q.date?escapeHtml(fmtDate(q.date)):"\u2014")}
    ${vu?row("Valid until", escapeHtml(fmtDate(vu))):""}
    ${row("Currency", escapeHtml(q.currency||curBase()) + (Number(q.rate)?` \u00b7 rate applied ${escapeHtml(String(q.rate))} ${escapeHtml(curBase())} per 1 ${escapeHtml(curSecondary())}`:""))}
    ${row("Status", escapeHtml((QUO_STATUS[st]||{lb:st}).lb))}
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">02</span><h3>Priced Scope</h3></div>
  <table style="border-collapse:collapse;width:100%">
    <thead><tr>
      <th style="${TH};width:34px;text-align:center">#</th>
      <th style="${TH}">Description</th>
      <th style="${TH};width:64px">Type</th>
      <th style="${TH};width:60px;text-align:right">Qty</th>
      <th style="${TH};width:52px">Unit</th>
      <th style="${TH};width:92px;text-align:right">Unit price</th>
      <th style="${TH};width:56px;text-align:right">Disc</th>
      <th style="${TH};width:104px;text-align:right">Amount</th>
    </tr></thead>
    <tbody>${(q.lines||[]).map((l,i)=>`<tr>
      <td style="${TD};text-align:center">${String(i+1).padStart(2,"0")}</td>
      <td style="${TD}"><strong>${escapeHtml(l.desc||l.code||"\u2014")}</strong>${l.code&&l.desc?`<br><span style="font-size:9px;color:#6B7B8F">${escapeHtml(l.code)}</span>`:""}</td>
      <td style="${TD};font-size:10px">${escapeHtml((LINE_KINDS.find(k=>k.k===(l.kind||"other"))||{lb:"Other"}).lb)}</td>
      <td style="${TD};text-align:right">${escapeHtml(String(Number(l.qty||0)))}</td>
      <td style="${TD};font-size:10px">${escapeHtml(l.unit||"\u2014")}</td>
      <td style="${TD};text-align:right">${curFmt(l.unitPrice||0,q.currency)}</td>
      <td style="${TD};text-align:right">${Number(l.discountPct)?escapeHtml(String(l.discountPct))+"%":"\u2014"}</td>
      <td style="${TD};text-align:right;font-weight:700">${curFmt(lineNet(l),q.currency)}</td>
    </tr>`).join("")}</tbody>
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">03</span><h3>Summary</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${row("Subtotal", curFmt(t.sub,q.currency))}
    ${t.disc?row(`Discount ${t.discPct}%`, "- "+curFmt(t.disc,q.currency)):""}
    ${t.tax?row(`Tax ${t.taxPct}%`, curFmt(t.tax,q.currency)):""}
    ${row("Total", curDualPlain(t.total,q.currency,q.rate), true)}
    ${t.hours?row("Labour included", fmtHM(t.hours)):""}
  </table>
  ${q.terms?`<div style="margin-top:12px"><div style="font-weight:800;font-size:12px;color:#03308B;margin-bottom:5px">Terms</div>
    <div style="font-size:11px;line-height:1.8;white-space:pre-wrap">${escapeHtml(q.terms)}</div></div>`:""}
  <div style="margin-top:10px;font-size:10px;font-style:italic;color:#555;line-height:1.7">
    Prices are stated in ${escapeHtml(q.currency||curBase())} at the exchange rate recorded on this document; a later change in the market rate does not alter this quotation.
    ${vu?` This offer is open for acceptance until ${escapeHtml(fmtDate(vu))}.`:""}
  </div>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">04</span><h3>Acceptance</h3></div>
  <table style="border-collapse:collapse;width:100%"><tr>
    ${sigBlockHTML("quo_eng", (state.profile&&(state.profile.name||state.profile.employeeName))||"", "For EJAF Technology", "EJAF Technology")}
    ${sigBlockHTML("quo_cli", "", "For the client", q.client||"")}
  </tr></table>`;
  await openReportPDF("QUOTATION", `${q.client||""} \u00b7 ${q.title||""}`, body,
    {project:q.project||"", client:q.client||""});
  toast("Quotation ready!");
};
Object.assign(window,{quotePDF});
