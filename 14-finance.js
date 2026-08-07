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
  return {client:"", clientOther:false, project:"", title:"", date:(typeof todayStr==="function"?todayStr():""),
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
window.quoClientPick = function(v){
  if(v==="__other"){ window._quo.clientOther=true; window._quo.client=""; return render(); }
  window._quo.clientOther=false; window._quo.client=v; render();
};
window.quoClientMode = function(other){
  window._quo.clientOther=!!other;
  if(!other) window._quo.client="";
  render();
};
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
    clientOther: !!q.clientOther,      // typed by hand, not a registered client
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
  // An accepted quotation's number has been quoted to the client, so it freezes.
  const priorQ = window._quoId ? (state.quotes||[]).find(x=>x.id===window._quoId) : null;
  if(priorQ && priorQ.status==="accepted" && priorQ.ref &&
     String(q.ref||"").trim() !== String(priorQ.ref).trim())
    return toast(`\u26a0 ${priorQ.ref} is accepted \u2014 its number can no longer be changed`);
  payload.ref = String(q.ref||"").trim();
  // A hand-typed number is used verbatim and does not consume the sequence.
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
  const priorV = window._varId ? (state.variations||[]).find(x=>x.id===window._varId) : null;
  if(priorV && priorV.status==="approved" && priorV.ref &&
     String(v.ref||"").trim() !== String(priorV.ref).trim())
    return toast(`\u26a0 ${priorV.ref} is approved \u2014 its number can no longer be changed`);
  payload.ref = String(v.ref||"").trim();
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


// ── Overtime multiplier ───────────────────────────────────────────────────
// Overtime was not costed anywhere: projectEconomics reads state.daily only,
// so the most expensive hours in the business were invisible in the margin.
// The multiplier defaults to 1.0 so enabling this changes no historical figure
// until you deliberately set the premium you actually pay.
function otMultiplier(){
  const d=(state.settingsDocs||[]).find(x=>x.id==="finance")||{};
  const m=Number(d.otMultiplier);
  return (isFinite(m) && m>0) ? m : 1;
}
window.setOtMultiplier = async function(v){
  if(!isAdmin()) return toast("Admin only");
  const m=num(v);
  if(m<=0 || m>5) return toast("\u26a0 Enter a multiplier between 0 and 5 (1.5 = time and a half)");
  const d=(state.settingsDocs||[]).find(x=>x.id==="finance")||{};
  const docs=state.settingsDocs||(state.settingsDocs=[]);
  const cur=docs.find(x=>x.id==="finance");
  const next={...d, id:"finance", otMultiplier:m};
  if(cur) Object.assign(cur,next); else docs.push(next);
  render();
  try{ await fbSave("settings", next); saveToast("Overtime multiplier saved \u2713"); }
  catch(e){ toast("\u26a0 Could not save"); }
};

// ── Monthly cost ──────────────────────────────────────────────────────────
// "What does this project cost us, per month" needs every cost stream bucketed
// by the month it belongs to. Travel is assigned to the month it STARTED, which
// is the month the per-diem was committed.
const _ym = (d)=>String(d||"").slice(0,7);
function projectMonthly(name){
  const n=String(name||"").trim();
  const p=(state.projects||[]).find(x=>(x.name||"").trim()===n);
  const rate=num(p&&p.hourlyCost);
  const otx=otMultiplier();
  const M={};
  const touch=(m)=>{ if(!m) return null;
    if(!M[m]) M[m]={month:m, hours:0, otHours:0, labour:0, otCost:0, perDiem:0, material:0, expenses:0, byCat:{}, entries:0};
    return M[m]; };
  (state.daily||[]).forEach(r=>{
    if((r.project||"").trim()!==n) return;
    const b=touch(_ym(r.date)); if(!b) return;
    b.hours += num(r.duration); b.entries++;
    b.material += (typeof partsEntryCost==="function") ? num(partsEntryCost(r)) : 0;
  });
  (state.overtime||[]).forEach(o=>{
    if((o.project||"").trim()!==n) return;
    const b=touch(_ym(o.date)); if(!b) return;
    b.otHours += num(o.hours);
  });
  (state.travel||[]).forEach(t=>{
    if((t.project||"").trim()!==n) return;
    const b=touch(_ym(t.from||t.date)); if(!b) return;
    b.perDiem += num(t.perDiem);
  });
  const pcur=(p&&CUR_CODES.includes(p.contractCurrency))?p.contractCurrency:curBase();
  (state.expenses||[]).forEach(e=>{
    if((e.project||"").trim()!==n) return;
    const b=touch(_ym(e.date)); if(!b) return;
    const v=expInBase(e,pcur);
    if(v===null) return;                       // unconvertible: reported, not guessed
    b.expenses += v;
    b.byCat[e.category||"other"] = (b.byCat[e.category||"other"]||0) + v;
  });
  const rows=Object.values(M).sort((a,b)=>a.month.localeCompare(b.month));
  rows.forEach(b=>{
    b.labour = b.hours*rate;
    b.otCost = b.otHours*rate*otx;
    b.cost   = Math.round(b.labour + b.otCost + b.perDiem + b.material + b.expenses);
    b.expenses = Math.round(b.expenses);
    b.labour = Math.round(b.labour); b.otCost = Math.round(b.otCost);
    b.perDiem= Math.round(b.perDiem); b.material=Math.round(b.material);
    b.hours=+b.hours.toFixed(1); b.otHours=+b.otHours.toFixed(1);
  });
  const tot=rows.reduce((a,b)=>({hours:a.hours+b.hours, otHours:a.otHours+b.otHours,
    labour:a.labour+b.labour, otCost:a.otCost+b.otCost, perDiem:a.perDiem+b.perDiem,
    material:a.material+b.material, expenses:a.expenses+b.expenses,
    cost:a.cost+b.cost, entries:a.entries+b.entries}),
    {hours:0,otHours:0,labour:0,otCost:0,perDiem:0,material:0,expenses:0,cost:0,entries:0});
  return {rows, total:tot, rate, otx};
}
// The same, across every project, so the company's monthly burn is visible.
function companyMonthly(){
  const M={};
  // projectMonthly() resolves a project by NAME, so two records sharing a name
  // would have their cost counted twice over. Names are meant to be unique, but
  // the company total must not silently double if one ever slips through.
  const names=[...new Set((state.projects||[]).map(p=>String(p.name||"").trim()).filter(Boolean))];
  names.forEach(nm=>{
    projectMonthly(nm).rows.forEach(b=>{
      if(!M[b.month]) M[b.month]={month:b.month, hours:0, otHours:0, labour:0, otCost:0, perDiem:0, material:0, expenses:0, cost:0, entries:0};
      ["hours","otHours","labour","otCost","perDiem","material","expenses","cost","entries"].forEach(k=>M[b.month][k]+=b[k]);
    });
  });
  return Object.values(M).sort((a,b)=>a.month.localeCompare(b.month));
}
const monthLabel=(ym)=>{
  const [y,m]=String(ym||"").split("-");
  const N=["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (N[+m]||m)+" "+String(y||"").slice(2);
};
Object.assign(window,{otMultiplier, projectMonthly, companyMonthly, monthLabel});

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
  // Overtime is real money and was previously counted nowhere.
  const otHours = (state.overtime||[]).filter(o=>(o.project||"").trim()===n)
                    .reduce((s,o)=>s+num(o.hours),0);
  const otCost  = otHours * hourly * otMultiplier();
  // Ledger expenses: subcontractors, fuel, purchases and the rest. They never
  // overlap the derived streams above, so nothing is counted twice.
  const exp     = expenseTotals(n, cur);
  const cost    = labour + otCost + perDiem + material + exp.total;

  const quotes = (state.quotes||[]).filter(q=>String(q.project||"").trim()===n);
  const margin = revenue>0 ? revenue-cost : null;
  return {
    project:p, currency:cur, rate,
    base, variations:varVal, variationCount:variationsFor(n,true).length,
    pendingVariations:(state.variations||[]).filter(v=>String(v.project||"").trim()===n && v.status==="submitted").length,
    revenue,
    hours:+hours.toFixed(1), hourly, labour:Math.round(labour),
    otHours:+otHours.toFixed(1), otCost:Math.round(otCost), otx:otMultiplier(),
    expenses:exp.total, expenseCount:exp.count, expensesByCat:exp.byCat,
    expensesUnpaid:exp.unpaid, expensesUnconverted:exp.unconverted,
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


window._finMonthly = window._finMonthly || {};
window.finToggleMonthly = function(name){
  window._finMonthly[name] = !window._finMonthly[name];
  render();
};
// One monthly table, used for a single project and for the whole company.
function monthlyTable(rows, cur, showEntries){
  if(!rows.length) return `<div style="font-size:11px;color:var(--muted);padding:8px 0">No cost recorded yet.</div>`;
  const TH='padding:5px 7px;border-bottom:2px solid var(--line);font-size:10px;color:var(--muted);text-align:right;white-space:nowrap';
  const TD='padding:5px 7px;border-bottom:1px solid var(--line);font-size:11px;text-align:right;white-space:nowrap';
  const tot=rows.reduce((a,b)=>({hours:a.hours+b.hours,otHours:a.otHours+b.otHours,labour:a.labour+b.labour,
    otCost:a.otCost+b.otCost,perDiem:a.perDiem+b.perDiem,material:a.material+b.material,
    expenses:a.expenses+(b.expenses||0),cost:a.cost+b.cost}),
    {hours:0,otHours:0,labour:0,otCost:0,perDiem:0,material:0,expenses:0,cost:0});
  const anyOT=rows.some(r=>r.otHours>0), anyPD=rows.some(r=>r.perDiem>0), anyMat=rows.some(r=>r.material>0),
        anyExp=rows.some(r=>(r.expenses||0)>0);
  return `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:${360+(anyOT?90:0)+(anyExp?90:0)}px">
    <thead><tr>
      <th style="${TH};text-align:left">Month</th>
      <th style="${TH}">Hours</th>
      <th style="${TH}">Labour</th>
      ${anyOT?`<th style="${TH}">Overtime</th>`:""}
      ${anyPD?`<th style="${TH}">Travel</th>`:""}
      ${anyMat?`<th style="${TH}">Material</th>`:""}
      ${anyExp?`<th style="${TH}">Expenses</th>`:""}
      <th style="${TH}">Cost</th>
    </tr></thead>
    <tbody>${rows.map(b=>`<tr>
      <td style="${TD};text-align:left;font-weight:700">${escapeHtml(monthLabel(b.month))}</td>
      <td style="${TD}">${fmtHM(b.hours)}</td>
      <td style="${TD}">${curFmt(b.labour,cur)}</td>
      ${anyOT?`<td style="${TD};color:${b.otCost?"#E65100":"var(--muted)"}">${b.otCost?curFmt(b.otCost,cur):"\u2014"}</td>`:""}
      ${anyPD?`<td style="${TD}">${b.perDiem?curFmt(b.perDiem,cur):"\u2014"}</td>`:""}
      ${anyMat?`<td style="${TD}">${b.material?curFmt(b.material,cur):"\u2014"}</td>`:""}
      ${anyExp?`<td style="${TD};color:${b.expenses?"#5E35B1":"var(--muted)"}">${b.expenses?curFmt(b.expenses,cur):"\u2014"}</td>`:""}
      <td style="${TD};font-weight:800">${curFmt(b.cost,cur)}</td>
    </tr>`).join("")}</tbody>
    <tfoot><tr>
      <td style="${TD};text-align:left;font-weight:800;border-top:2px solid var(--line)">Total</td>
      <td style="${TD};font-weight:800;border-top:2px solid var(--line)">${fmtHM(tot.hours)}</td>
      <td style="${TD};font-weight:800;border-top:2px solid var(--line)">${curFmt(tot.labour,cur)}</td>
      ${anyOT?`<td style="${TD};font-weight:800;border-top:2px solid var(--line)">${curFmt(tot.otCost,cur)}</td>`:""}
      ${anyPD?`<td style="${TD};font-weight:800;border-top:2px solid var(--line)">${curFmt(tot.perDiem,cur)}</td>`:""}
      ${anyMat?`<td style="${TD};font-weight:800;border-top:2px solid var(--line)">${curFmt(tot.material,cur)}</td>`:""}
      ${anyExp?`<td style="${TD};font-weight:800;border-top:2px solid var(--line)">${curFmt(tot.expenses,cur)}</td>`:""}
      <td style="${TD};font-weight:800;border-top:2px solid var(--line)">${curFmt(tot.cost,cur)}</td>
    </tr></tfoot>
  </table></div>`;
}
Object.assign(window,{monthlyTable});

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
      ${f.otHours?financeRow(`Overtime \u00b7 ${fmtHM(f.otHours)}${f.otx!==1?` @ \u00d7${f.otx}`:""}`, curFmt(f.otCost,f.currency)):""}
      ${f.perDiem?financeRow("Travel per-diem", curFmt(f.perDiem,f.currency)):""}
      ${f.material?financeRow("Material consumed", curFmt(f.material,f.currency)):""}
      ${Object.entries(f.expensesByCat||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
        financeRow(`${EXP_CAT(k).ic} ${EXP_CAT(k).lb}`, curFmt(v,f.currency))).join("")}
      ${financeRow("Cost", curDual(f.cost,f.currency,f.rate), true)}
      ${financeRow("Margin", f.margin===null?'<span style="color:var(--muted)">\u2014</span>'
        :`<span style="color:${L.fg}">${curDual(f.margin,f.currency,f.rate)}</span>`, true)}
    </table>
    ${!f.hourly?`<div style="font-size:10px;color:#E65100;margin-top:8px;line-height:1.6">\u26a0 No hourly cost set for this project, so labour counts as zero. Set it in <strong>Projects \u2192 edit</strong>.</div>`:""}
    ${f.expensesUnpaid?`<div style="font-size:10px;color:#E65100;margin-top:8px;line-height:1.6">\u{1F4B8} ${curFmt(f.expensesUnpaid,f.currency)} of these expenses is still unpaid \u2014 committed, not yet out the door.</div>`:""}
    ${f.expensesUnconverted?`<div style="font-size:10px;color:#C62828;margin-top:8px;line-height:1.6">\u26a0 ${f.expensesUnconverted} expense(s) are in another currency with no rate recorded, so they are NOT in the total above. Fix them in the ledger.</div>`:""}
    ${f.pendingVariations?`<div style="font-size:10px;color:#8F6E22;margin-top:8px;line-height:1.6">\u23F3 ${f.pendingVariations} variation(s) submitted and not yet approved \u2014 not counted above.</div>`:""}
    ${f.revenue<=0?`<div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.6">No contract value yet. Accept a quotation, or set it directly in <strong>Projects \u2192 edit</strong>.</div>`:""}
    <button class="btn btn-sm btn-secondary" style="margin-top:10px;width:100%" onclick="finToggleMonthly(${jsArg(name)})">
      ${window._finMonthly[name]?"\u25B4 Hide":"\u25BE Show"} month by month</button>
    ${window._finMonthly[name]?`<div style="margin-top:10px">${monthlyTable(projectMonthly(name).rows, f.currency)}</div>`:""}
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
          ${q.clientOther
            ? `<input value="${escapeHtml(q.client||"")}" oninput="quoSet('client',this.value)" placeholder="Type the client name" autofocus>
               <button class="btn btn-sm btn-secondary" style="margin-top:5px;font-size:10px" onclick="quoClientMode(false)">\u2190 Pick a registered client</button>`
            : `<select onchange="quoClientPick(this.value)">
                 <option value="">\u2014 select \u2014</option>
                 ${clients.map(c=>`<option ${q.client===c?"selected":""}>${escapeHtml(c)}</option>`).join("")}
                 <option value="__other">\u270e Type a name not on the list\u2026</option>
               </select>`}
          ${q.clientOther?`<div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">A name typed here is not added to your client list \u2014 use it for a prospect, then register them properly once the work is won.</div>`:""}
        </div>
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
        <div class="field" style="grid-column:1/-1"><label>Document number
          <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 leave blank to let the app issue one</span></label>
          <input value="${escapeHtml(q.ref||"")}" oninput="quoSet('ref',this.value)"
                 placeholder="e.g. EJ\\EBL\\04\\FFIN-20260003">
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">
            Type a number when company filing requires its own format; it is then used exactly as written and the app's sequence is left untouched.
            ${q.ref?`<br><strong>Fixed once the document is accepted.</strong>`:""}
          </div>
        </div>
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
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Output format for this and every document</div>
        ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${typeof rptFormatToggle==="function"?rptFormatToggle():""}
      </div>
    </div>`;
  }

  const rows=(state.quotes||[]).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const sum=(st)=>rows.filter(q=>quoteEffectiveStatus(q)===st).reduce((s,q)=>s+Number(q.total||0),0);
  return `<div class="card">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="quoNew()">+ New quotation</button>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${rows.length} quotation(s)</span>
    </div>
    <div style="margin-top:10px">
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Share as \u2014 the button on each quotation follows this choice</div>
      ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${typeof rptFormatToggle==="function"?rptFormatToggle():""}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-top:12px">
      ${[["Sent","sent"],["Accepted","accepted"],["Declined","declined"]].map(([lb,st])=>{
        const S=QUO_STATUS[st];
        return `<div style="background:${S.bg};border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:13px;font-weight:800;color:${S.fg}">${curFmt(sum(st),curBase())}</div>
          <div style="font-size:10px;color:${S.fg}">${lb}</div></div>`;}).join("")}
    </div>
  </div>
  ${!rows.length?`<div class="card">`+emptyState({icon:"\u{1F4B0}",title:"No quotations yet",
      why:"A quotation is the priced offer. When the client accepts it, its total becomes the project's contract value \u2014 which is what every margin figure is measured against.",
      steps:["Choose the client and the project","Add material, labour and other lines","Send it, then mark it accepted when the client agrees"],
      action:{label:"+ New quotation", onclick:"quoNew()"},
      hint:"For a prospect who is not a registered client yet, type the name directly on the quotation."})+`</div>`:rows.map(q=>{
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
        <button class="btn btn-sm btn-secondary" onclick="quotePDF('${q.id}')">${window._rptFormat==="word"?"\u{1F4DD} Word":"\u{1F4C4} PDF"}</button>
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
        <div class="field" style="grid-column:1/-1"><label>Document number
          <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 leave blank to let the app issue one</span></label>
          <input value="${escapeHtml(v.ref||"")}" oninput="varSet('ref',this.value)"
                 placeholder="e.g. EJ\\EBL\\04\\FFIN-20260003">
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">
            Type a number when company filing requires its own format; it is then used exactly as written and the app's sequence is left untouched.
            ${v.ref?`<br><strong>Fixed once the document is approved.</strong>`:""}
          </div>
        </div>
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
  let h=_pills('_finView',[{id:"pl",ic:"\u{1F4CA}",lb:"P&L"},{id:"invoices",ic:"\u{1F9FE}",lb:"Invoices"},{id:"expenses",ic:"\u{1F4B8}",lb:"Expenses"},{id:"advances",ic:"\u{1F4B3}",lb:"Advances"},{id:"quotes",ic:"\u{1F4B0}",lb:"Quotations"},
                           {id:"variations",ic:"\u{1F501}",lb:"Variations"},{id:"currency",ic:"\u{1F4B1}",lb:"Currency"}]);
  // These two screens moved to Reports \u2192 Finance Report (v217). A saved
  // _finView from before the move would silently land on the P&L, so it is
  // redirected instead of ignored.
  if(window._finView==="claims" || window._finView==="report"){
    window._finRepView = window._finView==="report" ? "cost" : "claims";
    window._finView = "pl";
    if(typeof switchTab==="function"){ setTimeout(()=>switchTab("Finance Report"), 0); }
  }
  const v=window._finView||"pl";
  if(v==="invoices")   return h + renderInvoices();
  if(v==="expenses")   return h + renderExpenses();
  if(v==="advances")   return h + renderAdvances();
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
  ${(()=>{const cm=companyMonthly(); if(!cm.length) return "";
    const worst=cm.slice().sort((a,b)=>b.cost-a.cost)[0];
    return `<div class="card">
      <div class="sec-hdr">\u{1F4C6} Company cost, month by month</div>
      <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:9px">
        Every project combined. Labour is logged hours \u00d7 the project's hourly cost; overtime is charged at \u00d7${otMultiplier()}${otMultiplier()===1?" (no premium set)":""}.
      </p>
      ${monthlyTable(cm, curBase())}
      ${worst?`<div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.6">Heaviest month so far: <strong>${escapeHtml(monthLabel(worst.month))}</strong> at ${curFmt(worst.cost,curBase())}.</div>`:""}
      <div class="field" style="margin-top:12px"><label>Overtime multiplier</label>
        <input value="${escapeHtml(String(otMultiplier()))}" inputmode="decimal" onchange="setOtMultiplier(this.value)" style="max-width:120px">
        <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">1 = paid at the normal rate \u00b7 1.5 = time and a half. Applies to every overtime hour in the figures above.</div>
      </div>
    </div>`;})()}
  ${all.map(f=>projectFinanceCard(f.project.name)+(typeof projectBillingCard==="function"?projectBillingCard(f.project.name):"")).join("")}`;
}
Object.assign(window,{renderFinance, renderQuotes, renderVariations});

// ═══ FINANCE REPORT (v217) ═══════════════════════════════════════════════
// Expense Reports and the Cost Report are not day-to-day finance entry the way
// invoices and advances are \u2014 they are documents that get produced, signed and
// filed. That is what the Reports tab is for, so they now live there. The data,
// the numbering and every calculation are untouched; only the doorway moved.
function renderFinanceReport(){
  if(!(isAdmin()||hasCap("canAnalytics")||isEmployee()))
    return `<div class="card"><div class="empty">No access.</div></div>`;
  const h=_pills('_finRepView',[{id:"claims",ic:"\u{1F9FE}",lb:"Expense Reports"},
                                {id:"cost",  ic:"\u{1F4CA}",lb:"Cost Report"}]);
  const v=window._finRepView||"claims";
  if(v==="cost") return h + renderCostReport();
  return h + renderExpenseClaims();
}
Object.assign(window,{renderFinanceReport});

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

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  E.  EXPENSE LEDGER                                                    ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// Labour, overtime, per-diem and material are DERIVED from operational records.
// Everything else a project actually spends — subcontractors, fuel, purchases,
// equipment hire, permits — has no operational trace at all, so until now it was
// simply missing from the margin. This is the ledger for those, kept separate so
// nothing is ever counted twice: an expense category never duplicates a derived
// stream, and the report states which is which.

const EXP_CATS = [
  {k:"subcontractor", lb:"Subcontractor",   ic:"\u{1F477}", color:"#5E35B1"},
  {k:"purchase",      lb:"Purchase",        ic:"\u{1F6D2}", color:"#00695C"},
  {k:"fuel",          lb:"Fuel",            ic:"\u26FD",    color:"#EF6C00"},
  {k:"vehicle",       lb:"Vehicle / hire",  ic:"\u{1F697}", color:"#00838F"},
  {k:"transport",     lb:"Transport",       ic:"\u{1F69A}", color:"#3949AB"},
  {k:"accommodation", lb:"Accommodation",   ic:"\u{1F3E8}", color:"#8E24AA"},
  {k:"permit",        lb:"Permit / fee",    ic:"\u{1F4DC}", color:"#6D4C41"},
  {k:"tool",          lb:"Tools",           ic:"\u{1F6E0}\uFE0F", color:"#455A64"},
  {k:"other",         lb:"Other",           ic:"\u{1F4CE}", color:"#546E7A"},
];
const EXP_CAT = (k)=>EXP_CATS.find(c=>c.k===k) || EXP_CATS[EXP_CATS.length-1];
const PAY_STATUS = {
  unpaid:{lb:"Unpaid",  bg:"#FFF3E0", fg:"#E65100"},
  paid:  {lb:"Paid",    bg:"#E8F5E9", fg:"#2E7D32"},
};

function expBlank(){
  return {project:"", date:(typeof todayStr==="function"?todayStr():""), category:"subcontractor",
          desc:"", payee:"", invoiceRef:"", amount:"", currency:curBase(), rate:curRate(),
          paid:false, paidDate:"", method:"", notes:""};
}
window._exp    = window._exp    || expBlank();
window._expId  = window._expId  || null;
window._expView= window._expView|| "list";
window._expFilter = window._expFilter || {project:"", category:"", from:"", to:""};

// Amounts are converted into the contract currency of the project they belong
// to, using each expense's OWN stored rate — never today's.
function expInBase(e, targetCur){
  const to = CUR_CODES.includes(targetCur) ? targetCur : curBase();
  const from = CUR_CODES.includes(e&&e.currency) ? e.currency : curBase();
  const v = num(e&&e.amount);
  if(from===to) return v;
  // Deliberately STRICTER than curConvert, which falls back to today's rate for
  // an approximate on-screen figure. An accounting total must not quietly adopt
  // the current market rate for a cost incurred months ago, so a cross-currency
  // expense with no rate of its own is reported as unconvertible instead.
  const r = num(e&&e.rate);
  if(!r) return null;
  const c = curConvert(v, from, to, r);
  return c===null ? null : c;
}
function expensesFor(projectName, from, to){
  const n=String(projectName||"").trim();
  return (state.expenses||[]).filter(e=>{
    if(n && String(e.project||"").trim()!==n) return false;
    if(from && String(e.date||"")<from) return false;
    if(to   && String(e.date||"")>to)   return false;
    return true;
  }).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
}
// Totals per category, plus what could not be converted.
function expenseTotals(projectName, targetCur, from, to){
  const rows=expensesFor(projectName, from, to);
  const byCat={}; let total=0, unconverted=0, unpaid=0;
  rows.forEach(e=>{
    const v=expInBase(e, targetCur);
    const k=e.category||"other";
    if(v===null){ unconverted++; return; }
    byCat[k]=(byCat[k]||0)+v;
    total+=v;
    if(!e.paid) unpaid+=v;
  });
  return {rows, byCat, total:Math.round(total), unconverted, unpaid:Math.round(unpaid), count:rows.length};
}
Object.assign(window,{EXP_CATS, EXP_CAT, PAY_STATUS, expBlank, expInBase, expensesFor, expenseTotals});

window.expSet  = function(k,v){ window._exp[k]=v; if(k==="currency"){ window._exp.rate=curRate(); render(); } };
window.expNew  = function(){ window._exp=expBlank(); window._expId=null; window._expView="edit"; render(); };
window.expEdit = function(id){
  const e=(state.expenses||[]).find(x=>x.id===id);
  if(!e) return toast("Expense not found");
  window._exp={...expBlank(), ...e}; window._expId=id; window._expView="edit"; render();
};
window.expCancel=function(){ window._expView="list"; window._expId=null; render(); };
window.expFilter=function(k,v){ window._expFilter[k]=v; render(); };

window.expSave = async function(){
  if(!isAdmin()) return toast("Admin only");
  const e=window._exp;
  if(!String(e.project||"").trim()) return toast("\u26a0 Choose the project this belongs to");
  if(!String(e.desc||"").trim())    return toast("\u26a0 Describe what was spent");
  const amt=num(e.amount);
  if(amt<=0) return toast("\u26a0 Enter an amount greater than zero");
  if(e.paid && !String(e.paidDate||"").trim()) return toast("\u26a0 A paid expense needs its payment date");
  await fbSave("expenses",{
    id: window._expId||undefined,
    project:String(e.project).trim(), date:e.date||"",
    category: EXP_CATS.some(c=>c.k===e.category)?e.category:"other",
    desc:String(e.desc).trim(), payee:String(e.payee||"").trim(),
    invoiceRef:String(e.invoiceRef||"").trim(),
    amount:amt, currency: CUR_CODES.includes(e.currency)?e.currency:curBase(),
    rate:num(e.rate), paid:!!e.paid, paidDate:e.paid?(e.paidDate||""):"",
    method:String(e.method||"").trim(), notes:String(e.notes||""),
    updatedAt:new Date().toISOString(),
    ...(window._expId?{}:{createdAt:new Date().toISOString(),
      createdBy:(state.profile&&(state.profile.name||state.profile.email))||""}),
  });
  window._expView="list"; window._expId=null;
  saveToast("Expense saved \u2713"); render();
};
window.expDel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const e=(state.expenses||[]).find(x=>x.id===id); if(!e) return;
  if(!await uiConfirm(`Delete "${e.desc}" (${curFmt(num(e.amount), e.currency)})?`)) return;
  await fbDelete("expenses", id);
  toast("Expense deleted");
};
window.expTogglePaid = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const e=(state.expenses||[]).find(x=>x.id===id); if(!e) return;
  const now=!e.paid;
  await fbSave("expenses",{...e, paid:now,
    paidDate: now ? (e.paidDate || (typeof todayStr==="function"?todayStr():"")) : ""});
  saveToast(now?"Marked paid \u2713":"Marked unpaid");
};

function renderExpenses(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();
  if(window._expView==="edit"){
    const e=window._exp;
    return `<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${window._expId?"Edit expense":"New expense"}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="expCancel()">Cancel</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Project <span class="req">*</span></label>
          <select onchange="expSet('project',this.value)"><option value="">\u2014 select \u2014</option>
            ${projects.map(p=>`<option ${e.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        <div class="field"><label>Date</label><input type="date" value="${escapeHtml(e.date||"")}" onchange="expSet('date',this.value)"></div>
        <div class="field" style="grid-column:1/-1"><label>Category</label>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            ${EXP_CATS.map(cc=>`<button class="btn btn-sm ${e.category===cc.k?"":"btn-secondary"}" style="${e.category===cc.k?`background:${cc.color};color:#fff;border:none;`:""}font-size:11px;font-weight:700" onclick="expSet('category','${cc.k}');render()">${cc.ic} ${cc.lb}</button>`).join("")}
          </div></div>
        <div class="field" style="grid-column:1/-1"><label>Description <span class="req">*</span></label>
          <input value="${escapeHtml(e.desc||"")}" oninput="expSet('desc',this.value)" placeholder="e.g. Cable pulling subcontract \u2014 basement"></div>
        <div class="field"><label>Paid to</label><input value="${escapeHtml(e.payee||"")}" oninput="expSet('payee',this.value)" placeholder="Supplier / contractor"></div>
        <div class="field"><label>Invoice / receipt no.</label><input value="${escapeHtml(e.invoiceRef||"")}" oninput="expSet('invoiceRef',this.value)"></div>
        <div class="field"><label>Amount <span class="req">*</span></label><input value="${escapeHtml(String(e.amount||""))}" oninput="expSet('amount',this.value)" inputmode="decimal" placeholder="0"></div>
        <div class="field"><label>Currency</label>
          <select onchange="expSet('currency',this.value)">${CUR_CODES.map(x=>`<option ${e.currency===x?"selected":""}>${x}</option>`).join("")}</select></div>
        <div class="field"><label>Rate applied</label><input value="${escapeHtml(String(e.rate||""))}" oninput="expSet('rate',this.value)" inputmode="decimal" placeholder="${curRate()||"not set"}">
          <div style="font-size:10px;color:var(--muted);margin-top:4px">Frozen on this expense, so the project cost never shifts with the market.</div></div>
        <div class="field"><label>Payment</label>
          <div style="display:flex;gap:5px">
            <button class="btn btn-sm ${!e.paid?"":"btn-secondary"}" style="${!e.paid?"background:#E65100;color:#fff;border:none;":""}font-weight:700;font-size:11px" onclick="expSet('paid',false);render()">Unpaid</button>
            <button class="btn btn-sm ${e.paid?"":"btn-secondary"}" style="${e.paid?"background:#2E7D32;color:#fff;border:none;":""}font-weight:700;font-size:11px" onclick="expSet('paid',true);render()">Paid</button>
          </div></div>
        ${e.paid?`<div class="field"><label>Paid on <span class="req">*</span></label><input type="date" value="${escapeHtml(e.paidDate||"")}" onchange="expSet('paidDate',this.value)"></div>
        <div class="field"><label>Method</label><input value="${escapeHtml(e.method||"")}" oninput="expSet('method',this.value)" placeholder="Cash / transfer / cheque"></div>`:""}
        <div class="field" style="grid-column:1/-1"><label>Notes</label>
          <textarea rows="2" oninput="expSet('notes',this.value)">${escapeHtml(e.notes||"")}</textarea></div>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="expSave()">Save expense</button>
    </div>`;
  }
  const F=window._expFilter;
  const rows=expensesFor(F.project, F.from, F.to).filter(e=>!F.category||e.category===F.category);
  const cur=curBase();
  const tot=rows.reduce((s,e)=>{const v=expInBase(e,cur); return s+(v===null?0:v);},0);
  const unpaid=rows.filter(e=>!e.paid).reduce((s,e)=>{const v=expInBase(e,cur); return s+(v===null?0:v);},0);
  const byCat={}; rows.forEach(e=>{const v=expInBase(e,cur); if(v!==null) byCat[e.category||"other"]=(byCat[e.category||"other"]||0)+v;});
  return `<div class="card">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="expNew()">+ New expense</button>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${rows.length} of ${(state.expenses||[]).length}</span>
    </div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>Project</label><select onchange="expFilter('project',this.value)">
        <option value="">All</option>${projects.map(p=>`<option ${F.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
      <div class="field"><label>Category</label><select onchange="expFilter('category',this.value)">
        <option value="">All</option>${EXP_CATS.map(cc=>`<option value="${cc.k}" ${F.category===cc.k?"selected":""}>${cc.ic} ${cc.lb}</option>`).join("")}</select></div>
      <div class="field"><label>From</label><input type="date" value="${escapeHtml(F.from||"")}" onchange="expFilter('from',this.value)"></div>
      <div class="field"><label>To</label><input type="date" value="${escapeHtml(F.to||"")}" onchange="expFilter('to',this.value)"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin-top:12px">
      ${[["Total",curFmt(tot,cur),"#03308B"],["Unpaid",curFmt(unpaid,cur),unpaid?"#E65100":"#2E7D32"],
         ["Entries",String(rows.length),"#546E7A"]]
        .map(([l,v,c])=>`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:14px;font-weight:800;color:${c}">${v}</div>
          <div style="font-size:10px;color:var(--muted)">${l}</div></div>`).join("")}
    </div>
    ${Object.keys(byCat).length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:10px">
      ${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const cc=EXP_CAT(k);
        return `<span style="background:${cc.color}22;color:${cc.color};padding:3px 9px;border-radius:10px;font-size:10px;font-weight:700">${cc.ic} ${cc.lb} ${curFmt(v,cur)}</span>`;}).join("")}
    </div>`:""}
  </div>
  ${!rows.length?`<div class="card"><div class="empty">No expenses match.</div></div>`:rows.map(e=>{
    const cc=EXP_CAT(e.category), P=e.paid?PAY_STATUS.paid:PAY_STATUS.unpaid;
    const conv=expInBase(e,cur);
    return `<div class="card" style="border-left:4px solid ${cc.color}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${cc.ic} ${escapeHtml(e.desc||"\u2014")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${escapeHtml(e.project||"\u2014")} \u00b7 ${e.date?escapeHtml(fmtDate(e.date)):"\u2014"}
            ${e.payee?`<br>to ${escapeHtml(e.payee)}`:""}${e.invoiceRef?` \u00b7 ${escapeHtml(e.invoiceRef)}`:""}
          </div>
        </div>
        <span style="background:${P.bg};color:${P.fg};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap">${P.lb}${e.paid&&e.paidDate?" "+escapeHtml(fmtDate(e.paidDate)):""}</span>
      </div>
      <div style="font-size:15px;font-weight:800;margin-top:8px">${curFmt(num(e.amount), e.currency)}
        ${(e.currency!==cur)?(conv===null
          ? `<span style="font-size:10px;color:#C62828;font-weight:700"> \u26a0 no rate \u2014 excluded from totals</span>`
          : `<span style="font-size:11px;color:var(--muted);font-weight:500"> \u2248 ${curFmt(conv,cur)}</span>`):""}</div>
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="expEdit('${e.id}')">\u270e Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="expTogglePaid('${e.id}')">${e.paid?"Mark unpaid":"Mark paid"}</button>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="expDel('${e.id}')">\u00d7</button>
      </div>
    </div>`;}).join("")}`;
}
Object.assign(window,{renderExpenses});

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  F.  COST & REVENUE REPORT                                             ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// An accountant needs to see the figure, know where it came from, and be able
// to adjust it before signing. So every line arrives PRE-FILLED from the data
// and every line can be overridden — but an override never touches the source
// record: the computed value is kept beside it and the difference is printed.
// That is what makes the report defensible in an audit rather than just tidy.

window._cr = window._cr || {project:"", from:"", to:"", title:"", notes:"",
                            preparedBy:"", overrides:{}, extra:[]};

function crStreams(){
  const m=window._cr, n=String(m.project||"").trim();
  const f=projectFinance(n);
  if(!f) return null;
  const from=m.from||"", to=m.to||"";
  const inR=(d)=>{ if(!d) return false; if(from&&d<from) return false; if(to&&d>to) return false; return true; };
  const p=f.project, rate=num(p.hourlyCost), cur=f.currency;

  const dRows=(state.daily||[]).filter(r=>(r.project||"").trim()===n && (!from&&!to ? true : inR(r.date)));
  const hours=dRows.reduce((s,r)=>s+num(r.duration),0);
  const material=dRows.reduce((s,r)=>s+((typeof partsEntryCost==="function")?num(partsEntryCost(r)):0),0);
  const otH=(state.overtime||[]).filter(o=>(o.project||"").trim()===n && (!from&&!to ? true : inR(o.date)))
              .reduce((s,o)=>s+num(o.hours),0);
  const pd=(state.travel||[]).filter(t=>(t.project||"").trim()===n && (!from&&!to ? true : inR(t.from||t.date)))
              .reduce((s,t)=>s+num(t.perDiem),0);
  const exp=expenseTotals(n, cur, from, to);

  const cost=[
    {k:"labour",   lb:"Labour",            note:`${fmtHM(hours)} at ${curFmt(rate,cur)}/h`, v:Math.round(hours*rate)},
    {k:"overtime", lb:"Overtime",          note:`${fmtHM(otH)} at \u00d7${otMultiplier()}`, v:Math.round(otH*rate*otMultiplier())},
    {k:"material", lb:"Material consumed", note:`from ${dRows.filter(r=>(r.partsUsed||[]).length).length} work entr${dRows.filter(r=>(r.partsUsed||[]).length).length===1?"y":"ies"}`, v:Math.round(material)},
    {k:"perdiem",  lb:"Travel per-diem",   note:"", v:Math.round(pd)},
  ].concat(EXP_CATS.map(cc=>({k:"exp_"+cc.k, lb:cc.lb, note:"expense ledger", v:Math.round(exp.byCat[cc.k]||0)})));

  const varRows=variationsFor(n,true).filter(v=>!from&&!to ? true : inR(v.date));
  const revenue=[
    {k:"contract", lb:"Contract value", note:p.contractQuoteRef?`per ${p.contractQuoteRef}`:"", v:Math.round(num(p.contractValue))},
    ...varRows.map(v=>({k:"var_"+v.id, lb:`Variation: ${v.title||""}`, note:v.ref||"", v:Math.round(varTotals(v).total)})),
  ];
  return {f, cur, cost:cost.filter(x=>x.v!==0), revenue, exp, hours, otH, from, to,
          allCost:cost, unconverted:exp.unconverted};
}
// A line's final value: the override when one exists, otherwise the computed one.
function crVal(line){
  const o=window._cr.overrides[line.k];
  return (o===undefined||o===null||o==="") ? line.v : num(o);
}
function crTotals(){
  const S=crStreams(); if(!S) return null;
  const cost=S.cost.reduce((s,l)=>s+crVal(l),0)
           + window._cr.extra.filter(x=>x.side==="cost").reduce((s,x)=>s+num(x.v),0);
  const rev =S.revenue.reduce((s,l)=>s+crVal(l),0)
           + window._cr.extra.filter(x=>x.side==="revenue").reduce((s,x)=>s+num(x.v),0);
  return {cost:Math.round(cost), revenue:Math.round(rev), margin:Math.round(rev-cost),
          pct: rev>0 ? Math.round((rev-cost)/rev*100) : null, cur:S.cur, S};
}
window.crSet      = function(k,v){ window._cr[k]=v; if(k==="project"||k==="from"||k==="to") render(); };
window.crOverride = function(k,v){
  if(String(v||"").trim()==="") delete window._cr.overrides[k]; else window._cr.overrides[k]=num(v);
  crRefresh();
};
window.crClearOverrides = function(){ window._cr.overrides={}; render(); };
window.crExtraAdd = function(side){ window._cr.extra.push({side, lb:"", v:0, note:""}); render(); };
window.crExtraDel = function(i){ window._cr.extra.splice(i,1); render(); };
window.crExtraSet = function(i,k,v){ const x=window._cr.extra[i]; if(!x) return; x[k]=v; crRefresh(); };
function crRefresh(){
  const T=crTotals(); if(!T) return;
  const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
  set("crRev",   curFmt(T.revenue,T.cur));
  set("crCost",  curFmt(T.cost,T.cur));
  set("crMargin",`<span style="color:${T.margin<0?"#C62828":"#2E7D32"}">${curFmt(T.margin,T.cur)}${T.pct!=null?` (${T.pct}%)`:""}</span>`);
}
Object.assign(window,{crStreams, crVal, crTotals, crRefresh});

function crLineRow(l, editable){
  const ov=window._cr.overrides[l.k];
  const changed = ov!==undefined && ov!==null && ov!=="" && num(ov)!==l.v;
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--line)">
    <div style="flex:1;min-width:130px">
      <div style="font-size:12px;font-weight:${changed?"800":"600"}">${escapeHtml(l.lb)}</div>
      <div style="font-size:10px;color:var(--muted)">${escapeHtml(l.note||"")}${changed?` \u00b7 computed ${curFmt(l.v, crStreams().cur)}`:""}</div>
    </div>
    <input value="${ov!==undefined&&ov!==null&&ov!==""?escapeHtml(String(ov)):""}" placeholder="${l.v}"
      oninput="crOverride(${jsArg(l.k)},this.value)" inputmode="decimal"
      style="width:118px;text-align:right;${changed?"border-color:#E65100;font-weight:800":""}">
    ${changed?`<span style="font-size:10px;color:#E65100;font-weight:700;white-space:nowrap">adjusted</span>`:""}
  </div>`;
}

function renderCostReport(){
  if(!(isAdmin()||hasCap("canAnalytics"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  const m=window._cr;
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();
  const S=m.project?crStreams():null;
  const T=S?crTotals():null;
  const adj=Object.keys(m.overrides||{}).length;

  return `<div class="card">
    <div class="sec-hdr">\u{1F9FE} Cost &amp; revenue report</div>
    <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:10px">
      Every line is filled from the records. Type over any figure to adjust it \u2014 the computed value is kept and printed beside it, so the report shows what was changed and by how much. Nothing you type here alters a single source record.
    </p>
    <div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label>Project <span class="req">*</span></label>
        <select onchange="crSet('project',this.value)"><option value="">\u2014 select \u2014</option>
          ${projects.map(p=>`<option ${m.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
      <div class="field"><label>From</label><input type="date" value="${escapeHtml(m.from||"")}" onchange="crSet('from',this.value)"></div>
      <div class="field"><label>To</label><input type="date" value="${escapeHtml(m.to||"")}" onchange="crSet('to',this.value)"></div>
      <div class="field" style="grid-column:1/-1"><label>Report title</label>
        <input value="${escapeHtml(m.title||"")}" oninput="crSet('title',this.value)" placeholder="e.g. Cost to date \u2014 Q3 2026"></div>
      <div class="field" style="grid-column:1/-1"><label>Prepared by</label>
        <input value="${escapeHtml(m.preparedBy||"")}" oninput="crSet('preparedBy',this.value)" placeholder="Name and title"></div>
    </div>
    ${!m.project?`<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#E65100;line-height:1.6">Pick a project to build the report.</div>`:""}
  </div>
  ${!S?"":`
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Revenue
      <span style="margin-left:auto;font-size:14px;font-weight:800" id="crRev">${curFmt(T.revenue,T.cur)}</span></div>
    ${S.revenue.map(l=>crLineRow(l)).join("")}
    ${m.extra.map((x,i)=>x.side!=="revenue"?"":`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--line)">
      <input value="${escapeHtml(x.lb||"")}" oninput="crExtraSet(${i},'lb',this.value)" placeholder="Description" style="flex:1;min-width:120px">
      <input value="${escapeHtml(String(x.v||""))}" oninput="crExtraSet(${i},'v',this.value)" inputmode="decimal" style="width:118px;text-align:right">
      <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="crExtraDel(${i})">\u00d7</button>
    </div>`).join("")}
    <button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="crExtraAdd('revenue')">+ Add a revenue line</button>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Cost
      <span style="margin-left:auto;font-size:14px;font-weight:800" id="crCost">${curFmt(T.cost,T.cur)}</span></div>
    ${S.cost.map(l=>crLineRow(l)).join("")}
    ${m.extra.map((x,i)=>x.side!=="cost"?"":`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--line)">
      <input value="${escapeHtml(x.lb||"")}" oninput="crExtraSet(${i},'lb',this.value)" placeholder="Description" style="flex:1;min-width:120px">
      <input value="${escapeHtml(String(x.v||""))}" oninput="crExtraSet(${i},'v',this.value)" inputmode="decimal" style="width:118px;text-align:right">
      <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="crExtraDel(${i})">\u00d7</button>
    </div>`).join("")}
    <button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="crExtraAdd('cost')">+ Add a cost line</button>
    ${S.unconverted?`<div style="background:#FDECEA;border:1px solid #EF9A9A;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#C62828;line-height:1.6">\u26a0 ${S.unconverted} expense(s) have no exchange rate recorded and are excluded from every figure here.</div>`:""}
  </div>

  <div class="card" style="border:2px solid ${T.margin<0?"#C62828":"#2E7D32"}">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <strong style="font-size:14px">Margin</strong>
      <span style="margin-left:auto;font-size:18px;font-weight:800" id="crMargin">
        <span style="color:${T.margin<0?"#C62828":"#2E7D32"}">${curFmt(T.margin,T.cur)}${T.pct!=null?` (${T.pct}%)`:""}</span></span>
    </div>
    ${adj?`<div style="font-size:11px;color:#E65100;margin-top:8px;line-height:1.6">\u270e ${adj} line(s) adjusted by hand. The report prints both figures.
      <button class="btn btn-sm btn-secondary" style="margin-left:6px;font-size:10px" onclick="crClearOverrides()">Reset all</button></div>`:""}
    <div class="field" style="margin-top:10px"><label>Commentary <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 printed under the summary</span></label>
      <textarea rows="3" oninput="crSet('notes',this.value)" placeholder="Explain any adjustment, and what the figures mean for this project\u2026">${escapeHtml(m.notes||"")}</textarea></div>
    <div style="margin-top:12px">${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${typeof rptFormatToggle==="function"?rptFormatToggle():""}</div>
    <button class="btn btn-primary" style="width:100%;background:#C9A84C;color:#1B3A6B;border:none;font-weight:800" onclick="costReportDoc()">
      ${window._rptFormat==="word"?"\u{1F4DD} Generate Word":"\u{1F4C4} Generate PDF"}</button>
  </div>`}`;
}

window.costReportDoc = async function(){
  const m=window._cr;
  if(!m.project) return toast("\u26a0 Pick the project first");
  const S=crStreams(), T=crTotals();
  if(!S||!T) return toast("\u26a0 Nothing to report");
  const cur=T.cur, p=S.f.project;
  const period=(m.from||m.to)?`${m.from?fmtDate(m.from):"start"} \u2192 ${m.to?fmtDate(m.to):"date"}`:"Whole project to date";
  const TH='padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left';
  const TD='padding:6px 9px;border:1px solid #D6E4F0';
  const R2=(l,v,strong)=>`<tr><td style="${TD};${strong?"font-weight:800":""};width:62%">${l}</td>
    <td style="${TD};text-align:right;${strong?"font-weight:800;font-size:13px":""}">${v}</td></tr>`;
  const secTable=(lines, extras)=>`<table style="border-collapse:collapse;width:100%">
    <thead><tr><th style="${TH}">Item</th><th style="${TH};width:96px;text-align:right">Computed</th>
      <th style="${TH};width:96px;text-align:right">Reported</th><th style="${TH};width:140px">Basis</th></tr></thead>
    <tbody>${lines.map(l=>{const fin=crVal(l), ch=fin!==l.v;
      return `<tr>
        <td style="${TD}"><strong>${escapeHtml(l.lb)}</strong></td>
        <td style="${TD};text-align:right;${ch?"color:#6B7B8F":""}">${curFmt(l.v,cur)}</td>
        <td style="${TD};text-align:right;font-weight:${ch?"800":"600"};${ch?"color:#E65100":""}">${curFmt(fin,cur)}</td>
        <td style="${TD};font-size:10px">${escapeHtml(l.note||"")}${ch?" \u00b7 adjusted by hand":""}</td>
      </tr>`;}).join("")}
    ${extras.map(x=>`<tr>
        <td style="${TD}"><strong>${escapeHtml(x.lb||"\u2014")}</strong></td>
        <td style="${TD};text-align:right;color:#6B7B8F">\u2014</td>
        <td style="${TD};text-align:right;font-weight:800;color:#E65100">${curFmt(num(x.v),cur)}</td>
        <td style="${TD};font-size:10px">added by hand</td></tr>`).join("")}
    </tbody></table>`;

  const body = `
  <div class="ksec"><span class="kbad">01</span><h3>Project</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${R2("Project", escapeHtml(p.name||"\u2014"))}
    ${R2("Client", escapeHtml(p.client||"\u2014"))}
    ${R2("Period covered", escapeHtml(period))}
    ${R2("Currency", escapeHtml(cur) + (S.f.rate?` \u00b7 rate ${escapeHtml(String(S.f.rate))} ${escapeHtml(curBase())} per 1 ${escapeHtml(curSecondary())}`:""))}
    ${m.preparedBy?R2("Prepared by", escapeHtml(m.preparedBy)):""}
    ${R2("Status", escapeHtml(p.status||"\u2014"))}
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">02</span><h3>Revenue</h3></div>
  ${secTable(S.revenue, m.extra.filter(x=>x.side==="revenue"))}

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">03</span><h3>Cost</h3></div>
  ${secTable(S.cost, m.extra.filter(x=>x.side==="cost"))}
  ${S.unconverted?`<div style="margin-top:8px;font-size:10px;color:#C62828;line-height:1.6">${S.unconverted} expense(s) carry no exchange rate and are excluded from every figure above.</div>`:""}

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">04</span><h3>Result</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${R2("Total revenue", curDualPlain(T.revenue,cur,S.f.rate), true)}
    ${R2("Total cost",    curDualPlain(T.cost,cur,S.f.rate), true)}
    ${R2("Margin", `<span style="color:${T.margin<0?"#C62828":"#2E7D32"}">${curDualPlain(T.margin,cur,S.f.rate)}${T.pct!=null?` \u00b7 ${T.pct}%`:""}</span>`, true)}
    ${R2("Result", T.margin<0?'<span style="color:#C62828;font-weight:800">LOSS</span>':'<span style="color:#2E7D32;font-weight:800">PROFIT</span>', true)}
  </table>
  ${Object.keys(m.overrides||{}).length?`<div style="margin-top:9px;padding:9px 11px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;font-size:10px;color:#7F6000;line-height:1.7">
    ${Object.keys(m.overrides).length} line(s) were adjusted by hand. Both the computed and the reported figure are shown above so the difference is visible.</div>`:""}
  ${m.notes?`<div style="margin-top:10px"><div style="font-weight:800;font-size:12px;color:#03308B;margin-bottom:5px">Commentary</div>
    <div style="font-size:11px;line-height:1.8;white-space:pre-wrap">${escapeHtml(m.notes)}</div></div>`:""}

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">05</span><h3>Month by month</h3></div>
  ${(()=>{const rows=projectMonthly(p.name).rows.filter(b=>{
      if(m.from && b.month < String(m.from).slice(0,7)) return false;
      if(m.to   && b.month > String(m.to).slice(0,7))   return false;
      return true;});
    if(!rows.length) return `<div style="font-size:11px;color:#6B7B8F">No monthly cost in this period.</div>`;
    return `<table style="border-collapse:collapse;width:100%">
      <thead><tr><th style="${TH}">Month</th><th style="${TH};text-align:right">Hours</th>
        <th style="${TH};text-align:right">Labour</th><th style="${TH};text-align:right">Overtime</th>
        <th style="${TH};text-align:right">Travel</th><th style="${TH};text-align:right">Material</th>
        <th style="${TH};text-align:right">Expenses</th><th style="${TH};text-align:right">Cost</th></tr></thead>
      <tbody>${rows.map(b=>`<tr>
        <td style="${TD}"><strong>${escapeHtml(monthLabel(b.month))}</strong></td>
        <td style="${TD};text-align:right">${fmtHM(b.hours)}</td>
        <td style="${TD};text-align:right">${curFmt(b.labour,cur)}</td>
        <td style="${TD};text-align:right">${b.otCost?curFmt(b.otCost,cur):"\u2014"}</td>
        <td style="${TD};text-align:right">${b.perDiem?curFmt(b.perDiem,cur):"\u2014"}</td>
        <td style="${TD};text-align:right">${b.material?curFmt(b.material,cur):"\u2014"}</td>
        <td style="${TD};text-align:right">${b.expenses?curFmt(b.expenses,cur):"\u2014"}</td>
        <td style="${TD};text-align:right;font-weight:800">${curFmt(b.cost,cur)}</td></tr>`).join("")}</tbody></table>`;})()}

  <div class="ksec" style="page-break-before:always"><span class="kbad">06</span><h3>Expense register</h3></div>
  ${(()=>{const rows=S.exp.rows;
    if(!rows.length) return `<div style="font-size:11px;color:#6B7B8F">No ledger expenses in this period.</div>`;
    return `<table style="border-collapse:collapse;width:100%">
      <thead><tr><th style="${TH};width:32px;text-align:center">#</th><th style="${TH}">Date</th>
        <th style="${TH}">Category</th><th style="${TH}">Description</th><th style="${TH}">Paid to</th>
        <th style="${TH}">Ref</th><th style="${TH};text-align:right">Amount</th><th style="${TH};width:58px">Status</th></tr></thead>
      <tbody>${rows.map((e,i)=>`<tr>
        <td style="${TD};text-align:center">${String(i+1).padStart(2,"0")}</td>
        <td style="${TD};font-size:10px">${e.date?escapeHtml(fmtDate(e.date)):"\u2014"}</td>
        <td style="${TD};font-size:10px">${escapeHtml(EXP_CAT(e.category).lb)}</td>
        <td style="${TD}">${escapeHtml(e.desc||"\u2014")}</td>
        <td style="${TD};font-size:10px">${escapeHtml(e.payee||"\u2014")}</td>
        <td style="${TD};font-size:10px">${escapeHtml(e.invoiceRef||"\u2014")}</td>
        <td style="${TD};text-align:right">${curFmt(num(e.amount), e.currency)}</td>
        <td style="${TD};font-size:10px;color:${e.paid?"#2E7D32":"#E65100"};font-weight:700">${e.paid?"Paid":"Unpaid"}</td>
      </tr>`).join("")}</tbody></table>
      ${S.exp.unpaid?`<div style="margin-top:6px;font-size:11px;font-weight:700;color:#E65100">${curFmt(S.exp.unpaid,cur)} of the above is still unpaid.</div>`:""}`;})()}

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">07</span><h3>Declaration</h3></div>
  <p style="font-size:11px;line-height:1.8">These figures were compiled from the operational and financial records held in Gir\u00eak on the date of issue. Amounts are stated in ${escapeHtml(cur)} at the exchange rate recorded on each document.</p>
  <table style="border-collapse:collapse;width:100%"><tr>
    ${sigBlockHTML("cr_prep", m.preparedBy||"", "Prepared by", "EJAF Technology")}
    ${sigBlockHTML("cr_appr", "", "Approved by", "EJAF Technology")}
  </tr></table>`;

  await openReportPDF("COST_REPORT",
    `${p.name} \u00b7 ${period}${m.title?" \u00b7 "+m.title:""}`, body,
    {project:p.name, client:p.client||""});
  toast("Cost report ready!");
};
Object.assign(window,{renderCostReport, costReportDoc});
