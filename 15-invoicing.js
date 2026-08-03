// ═══════════════════════════════════════════════════════════════════════════
//  15-invoicing.js  (v184)
//  The collection side of the money. Girêk knew what a project was WORTH
//  (quotations, variations) and what it COST (labour, expenses). It did not
//  know what had been BILLED, what had been COLLECTED, or when the rest is due
//  — and a contractor with a 30% margin still fails if the cash arrives 120
//  days after the wages went out.
//
//    A. Invoices        — issued, part-paid, paid; retention withheld
//    B. Payments        — receipts recorded against an invoice
//    C. Ageing          — 0-30 / 31-60 / 61-90 / 90+ on what is outstanding
//    D. Cash position   — receivable against unpaid expenses
//
//  Nothing here changes how revenue or margin are computed: an invoice records
//  a CLAIM on revenue already recognised from the contract and its variations.
//  Billing and earning are deliberately kept as separate dimensions so neither
//  can quietly inflate the other.
// ═══════════════════════════════════════════════════════════════════════════

const INV_STATUS = {
  draft:     {lb:"Draft",      bg:"#ECEFF1", fg:"#546E7A", ic:"\u270e"},
  issued:    {lb:"Issued",     bg:"#E3F2FD", fg:"#1565C0", ic:"\u2709"},
  part:      {lb:"Part paid",  bg:"#FFF8E1", fg:"#8F6E22", ic:"\u25D1"},
  paid:      {lb:"Paid",       bg:"#E8F5E9", fg:"#2E7D32", ic:"\u2713"},
  overdue:   {lb:"Overdue",    bg:"#FDECEA", fg:"#C62828", ic:"\u23F0"},
  cancelled: {lb:"Cancelled",  bg:"#ECEFF1", fg:"#90A4AE", ic:"\u2716"},
};
const INV_TERMS = [0, 15, 30, 45, 60, 90];

function invBlank(){
  return {project:"", client:"", clientId:"", title:"", date:(typeof todayStr==="function"?todayStr():""),
          termDays:30, currency:curBase(), rate:curRate(), taxPct:0, retentionPct:0,
          status:"draft", lines:[], notes:"", terms:"", payments:[],
          retentionReleased:false, retentionReleasedDate:""};
}
window._inv     = window._inv     || invBlank();
window._invId   = window._invId   || null;
window._invView = window._invView || "list";
window._invPay  = window._invPay  || null;   // id of the invoice being receipted

const _invToday = ()=> (typeof todayStr==="function") ? todayStr() : new Date().toISOString().slice(0,10);
function invDueDate(v){
  if(!v || !v.date) return "";
  const d=new Date(String(v.date)+"T00:00:00Z");
  if(isNaN(d)) return "";
  d.setUTCDate(d.getUTCDate()+Math.max(0, num(v.termDays)));
  return d.toISOString().slice(0,10);
}
function daysPastDue(v){
  const due=invDueDate(v);
  if(!due) return 0;
  const a=new Date(due+"T00:00:00Z"), b=new Date(_invToday()+"T00:00:00Z");
  return Math.round((b-a)/86400000);
}

// The money maths. Retention is withheld FROM the invoice, so it is not
// collectable until it is released — keeping it inside "outstanding" would
// overstate what the client actually owes today.
function invTotals(v){
  const lines=(v&&v.lines)||[];
  const sub  = lines.reduce((s,l)=>s+lineNet(l),0);
  const tPct = Math.max(0, num(v&&v.taxPct));
  const tax  = sub*tPct/100;
  const total= sub+tax;
  const rPct = Math.min(100, Math.max(0, num(v&&v.retentionPct)));
  const retention = total*rPct/100;
  const released  = !!(v&&v.retentionReleased);
  const claimable = released ? total : (total - retention);
  const paid = ((v&&v.payments)||[]).reduce((s,p)=>s+num(p&&p.amount),0);
  const outstanding = Math.max(0, claimable - paid);
  return {
    sub:+sub.toFixed(2), taxPct:tPct, tax:+tax.toFixed(2), total:+total.toFixed(2),
    retentionPct:rPct, retention:+retention.toFixed(2), retentionReleased:released,
    claimable:+claimable.toFixed(2), paid:+paid.toFixed(2),
    outstanding:+outstanding.toFixed(2), count:lines.length,
    overpaid: +Math.max(0, paid - claimable).toFixed(2),
  };
}
// The status shown is derived, never trusted from the stored field alone: an
// invoice becomes overdue by the passage of time, not by anyone editing it.
function invStatus(v){
  if(!v) return "draft";
  if(v.status==="draft" || v.status==="cancelled") return v.status;
  const t=invTotals(v);
  if(t.outstanding<=0.005) return "paid";
  if(t.paid>0) return (daysPastDue(v)>0) ? "overdue" : "part";
  return (daysPastDue(v)>0) ? "overdue" : "issued";
}
function invoicesFor(projectName, from, to){
  const n=String(projectName||"").trim();
  return (state.invoices||[]).filter(v=>{
    if(n && String(v.project||"").trim()!==n) return false;
    if(from && String(v.date||"")<from) return false;
    if(to   && String(v.date||"")>to)   return false;
    return true;
  }).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
}

// Ageing buckets, on what is genuinely outstanding today.
const AGE_BUCKETS=[
  {k:"current", lb:"Not yet due", lo:-99999, hi:0,     color:"#2E7D32"},
  {k:"d30",     lb:"1\u201330 days",  lo:1,  hi:30,    color:"#8F6E22"},
  {k:"d60",     lb:"31\u201360 days", lo:31, hi:60,    color:"#E65100"},
  {k:"d90",     lb:"61\u201390 days", lo:61, hi:90,    color:"#D84315"},
  {k:"d90p",    lb:"Over 90 days",    lo:91, hi:99999, color:"#C62828"},
];
function invAgeing(projectName, targetCur){
  const cur = CUR_CODES.includes(targetCur) ? targetCur : curBase();
  const out = {}; AGE_BUCKETS.forEach(b=>out[b.k]={amount:0, count:0});
  let total=0, unconverted=0, retentionHeld=0;
  invoicesFor(projectName).forEach(v=>{
    const st=invStatus(v);
    if(st==="draft" || st==="cancelled") return;
    const t=invTotals(v);
    const conv=(x)=>{
      const from = CUR_CODES.includes(v.currency)?v.currency:curBase();
      if(from===cur) return x;
      const r=num(v.rate);
      if(!r) return null;                       // same strictness as expenses
      return curConvert(x, from, cur, r);
    };
    if(!t.retentionReleased && t.retention>0){
      const rc=conv(t.retention);
      if(rc!==null) retentionHeld+=rc;
    }
    if(t.outstanding<=0) return;
    const amt=conv(t.outstanding);
    if(amt===null){ unconverted++; return; }
    const d=daysPastDue(v);
    const b=AGE_BUCKETS.find(x=>d>=x.lo && d<=x.hi) || AGE_BUCKETS[0];
    out[b.k].amount+=amt; out[b.k].count++;
    total+=amt;
  });
  AGE_BUCKETS.forEach(b=>out[b.k].amount=Math.round(out[b.k].amount));
  return {buckets:out, total:Math.round(total), unconverted,
          retentionHeld:Math.round(retentionHeld), currency:cur};
}

// Billed against earned, so under- and over-billing are both visible.
function invBillingPosition(projectName){
  const f=(typeof projectFinance==="function") ? projectFinance(projectName) : null;
  if(!f) return null;
  const cur=f.currency;
  let billed=0, collected=0, unconverted=0;
  invoicesFor(projectName).forEach(v=>{
    const st=invStatus(v);
    if(st==="draft"||st==="cancelled") return;
    const t=invTotals(v);
    const from=CUR_CODES.includes(v.currency)?v.currency:curBase();
    const cv=(x)=>{ if(from===cur) return x; const r=num(v.rate); return r?curConvert(x,from,cur,r):null; };
    const b=cv(t.total), p=cv(t.paid);
    if(b===null||p===null){ unconverted++; return; }
    billed+=b; collected+=p;
  });
  const earned=f.revenue;
  return {currency:cur, earned, billed:Math.round(billed), collected:Math.round(collected),
          unbilled:Math.round(earned-billed), uncollected:Math.round(billed-collected),
          unconverted,
          pctBilled: earned>0 ? Math.round(billed/earned*100) : null,
          pctCollected: billed>0 ? Math.round(collected/billed*100) : null};
}

// Money in against money out: the number that says whether wages can be paid.
function cashPosition(targetCur){
  const cur = CUR_CODES.includes(targetCur) ? targetCur : curBase();
  const age = invAgeing("", cur);
  let payable=0, payUnconverted=0;
  (state.expenses||[]).forEach(e=>{
    if(e.paid) return;
    const v=(typeof expInBase==="function") ? expInBase(e, cur) : null;
    if(v===null){ payUnconverted++; return; }
    payable+=v;
  });
  return {currency:cur, receivable:age.total, payable:Math.round(payable),
          net:Math.round(age.total-payable), retentionHeld:age.retentionHeld,
          unconverted:age.unconverted+payUnconverted, ageing:age};
}
Object.assign(window,{INV_STATUS, INV_TERMS, invBlank, invDueDate, daysPastDue, invTotals,
  invStatus, invoicesFor, AGE_BUCKETS, invAgeing, invBillingPosition, cashPosition});

// ── Editing ──────────────────────────────────────────────────────────────
window.invSet = function(k,v){
  window._inv[k]=v;
  if(k==="currency"){ window._inv.rate=curRate(); return render(); }
  if(k==="project"){
    // Carry the client across so the invoice header fills itself.
    const p=(state.projects||[]).find(x=>(x.name||"").trim()===String(v||"").trim());
    if(p && p.client){
      window._inv.client=p.client;
      const c=(state.clients||[]).find(x=>(x.name||"").trim()===String(p.client).trim());
      window._inv.clientId=c?c.id:"";
    }
    return render();
  }
  if(k==="date"||k==="termDays") return render();
  invRefresh();
};
window.invLineAdd = function(kind){
  window._inv.lines.push({kind:kind||"other", code:"", desc:"", unit:"", qty:1, unitPrice:0, discountPct:0});
  render();
};
window.invLineDel = function(i){ window._inv.lines.splice(i,1); render(); };
window.invLineSet = function(i,k,v){
  const l=window._inv.lines[i]; if(!l) return;
  l[k]=v; invRefresh();
};
window.invLinePick = function(i,code){
  const l=window._inv.lines[i]; if(!l) return;
  const p=(typeof partByCode==="function")?partByCode(code):null;
  l.code=code||"";
  if(p){ l.desc=p.name||""; l.unit=p.unit||""; if(!num(l.unitPrice)) l.unitPrice=num(p.unitCost); }
  render();
};
function invRefresh(){
  const v=window._inv, t=invTotals(v);
  const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
  set("invSub",  curFmt(t.sub,v.currency));
  set("invTax",  t.tax?curFmt(t.tax,v.currency):"\u2014");
  set("invRet",  t.retention?("- "+curFmt(t.retention,v.currency)):"\u2014");
  set("invTotal",curDual(t.total,v.currency,v.rate));
  set("invDue",  curFmt(t.claimable,v.currency));
  (v.lines||[]).forEach((l,i)=>{
    const e=document.getElementById("invLine"+i);
    if(e) e.textContent=curFmt(lineNet(l), v.currency);
  });
}
Object.assign(window,{invRefresh});

// Bill a share of the contract without retyping it — the common case in ELV
// work, where payment lands on milestones rather than on materials.
window.invFromContract = function(pct){
  const v=window._inv;
  const p=(state.projects||[]).find(x=>(x.name||"").trim()===String(v.project||"").trim());
  if(!p) return toast("\u26a0 Choose the project first");
  const f=(typeof projectFinance==="function")?projectFinance(p.name):null;
  const base=f?f.revenue:num(p.contractValue);
  if(base<=0) return toast("\u26a0 This project has no contract value yet");
  const share=Math.round(base*num(pct)/100);
  v.currency = CUR_CODES.includes(p.contractCurrency)?p.contractCurrency:curBase();
  v.rate     = num(p.contractRate)||curRate();
  v.lines.push({kind:"other", code:"", unit:"",
    desc:`${pct}% of contract value \u2014 ${p.name}`, qty:1, unitPrice:share, discountPct:0});
  render();
};

window.invNew  = function(){ window._inv=invBlank(); window._invId=null; window._invView="edit"; render(); };
window.invEdit = function(id){
  const v=(state.invoices||[]).find(x=>x.id===id);
  if(!v) return toast("Invoice not found");
  window._inv={...invBlank(), ...v, lines:(v.lines||[]).map(l=>({...l})),
               payments:(v.payments||[]).map(p=>({...p}))};
  window._invId=id; window._invView="edit"; render();
};
window.invCancelEdit=function(){ window._invView="list"; window._invId=null; render(); };

window.invSave = async function(){
  if(!isAdmin()) return toast("Admin only");
  const v=window._inv;
  if(!String(v.project||"").trim()) return toast("\u26a0 Choose the project");
  if(!String(v.client||"").trim())  return toast("\u26a0 The invoice needs a client");
  if(!(v.lines||[]).length)         return toast("\u26a0 Add at least one line");
  const bad=(v.lines||[]).findIndex(l=>!String(l.desc||l.code||"").trim());
  if(bad>=0) return toast(`\u26a0 Line ${bad+1} has no description`);
  const t=invTotals(v);
  if(t.total<=0) return toast("\u26a0 The invoice total must be greater than zero");
  const payload={
    id: window._invId||undefined,
    ref: v.ref||"",
    project:String(v.project).trim(), client:String(v.client).trim(),
    clientId: v.clientId || ((state.clients||[]).find(c=>(c.name||"").trim()===String(v.client||"").trim())||{}).id || "",
    title:String(v.title||"").trim(), date:v.date||"", termDays:Math.max(0,num(v.termDays)),
    currency: CUR_CODES.includes(v.currency)?v.currency:curBase(), rate:num(v.rate),
    taxPct:num(v.taxPct), retentionPct:Math.min(100,Math.max(0,num(v.retentionPct))),
    status: v.status||"draft",
    lines:(v.lines||[]).map(l=>({kind:l.kind||"other", code:String(l.code||""),
      desc:String(l.desc||""), unit:String(l.unit||""), qty:num(l.qty),
      unitPrice:num(l.unitPrice), discountPct:num(l.discountPct)})),
    payments:(v.payments||[]).map(p=>({date:String(p.date||""), amount:num(p.amount),
      method:String(p.method||""), ref:String(p.ref||"")})),
    retentionReleased:!!v.retentionReleased, retentionReleasedDate:v.retentionReleasedDate||"",
    notes:String(v.notes||""), terms:String(v.terms||""),
    total:t.total, retention:t.retention, claimable:t.claimable,
    updatedAt:new Date().toISOString(),
    ...(window._invId?{}:{createdAt:new Date().toISOString(),
      createdBy:(state.profile&&(state.profile.name||state.profile.email))||""}),
  };
  // Once issued, the number is on a document the client holds.
  const priorI = window._invId ? (state.invoices||[]).find(x=>x.id===window._invId) : null;
  if(priorI && priorI.status && priorI.status!=="draft" && priorI.ref &&
     String(v.ref||"").trim() !== String(priorI.ref).trim())
    return toast(`\u26a0 ${priorI.ref} has been issued \u2014 its number can no longer be changed`);
  payload.ref = String(v.ref||"").trim();
  if(!payload.ref){
    try{ payload.ref = await generateRefNo("INVOICE", {project:payload.project, client:payload.client}); }
    catch(e){ payload.ref=""; }
  }
  await fbSave("invoices", payload);
  window._invView="list"; window._invId=null;
  saveToast("Invoice saved \u2713"); render();
};
window.invIssue = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const v=(state.invoices||[]).find(x=>x.id===id); if(!v) return;
  const t=invTotals(v);
  if(!await uiConfirm(`Issue invoice ${v.ref||""} for ${curDualPlain(t.total,v.currency,v.rate)}?\n\nDue ${invDueDate(v)?fmtDate(invDueDate(v)):"on receipt"}.${t.retention?`\n${curFmt(t.retention,v.currency)} retention is withheld, leaving ${curFmt(t.claimable,v.currency)} collectable now.`:""}`)) return;
  await fbSave("invoices", {...v, status:"issued", issuedAt:new Date().toISOString()});
  saveToast("Invoice issued \u2713");
};
window.invCancel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const v=(state.invoices||[]).find(x=>x.id===id); if(!v) return;
  const t=invTotals(v);
  if(t.paid>0 && !await uiConfirm(`${curFmt(t.paid,v.currency)} has already been received against ${v.ref||"this invoice"}.\n\nCancel it anyway? The receipts stay on record.`)) return;
  if(t.paid<=0 && !await uiConfirm(`Cancel invoice ${v.ref||""}?`)) return;
  await fbSave("invoices", {...v, status:"cancelled"});
  toast("Invoice cancelled");
};
window.invDel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const v=(state.invoices||[]).find(x=>x.id===id); if(!v) return;
  const t=invTotals(v);
  const warn = t.paid>0 ? `\n\n\u26a0 ${curFmt(t.paid,v.currency)} of receipts is recorded against it and will be deleted too.` : "";
  if(!await uiConfirm(`Delete invoice ${v.ref||""}?${warn}`)) return;
  await fbDelete("invoices", id);
  toast("Invoice deleted");
};
window.invReleaseRetention = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const v=(state.invoices||[]).find(x=>x.id===id); if(!v) return;
  const t=invTotals(v);
  if(!t.retention) return toast("No retention was withheld on this invoice");
  if(t.retentionReleased) return toast("Retention is already released");
  if(!await uiConfirm(`Release ${curFmt(t.retention,v.currency)} of retention on ${v.ref||"this invoice"}?\n\nIt becomes collectable and joins the ageing from today.`)) return;
  await fbSave("invoices", {...v, retentionReleased:true, retentionReleasedDate:_invToday()});
  saveToast("Retention released \u2713");
};

// ── Payments ─────────────────────────────────────────────────────────────
window._payForm = window._payForm || {date:"", amount:"", method:"", ref:""};
window.payOpen  = function(id){
  const v=(state.invoices||[]).find(x=>x.id===id); if(!v) return;
  const t=invTotals(v);
  window._invPay=id;
  window._payForm={date:_invToday(), amount:String(t.outstanding||""), method:"", ref:""};
  render();
};
window.payClose = function(){ window._invPay=null; render(); };
window.paySet   = function(k,v){ window._payForm[k]=v; };
window.payAdd   = async function(){
  if(!isAdmin()) return toast("Admin only");
  const v=(state.invoices||[]).find(x=>x.id===window._invPay);
  if(!v) return toast("Invoice not found");
  const f=window._payForm, amt=num(f.amount);
  if(amt<=0) return toast("\u26a0 Enter the amount received");
  if(!String(f.date||"").trim()) return toast("\u26a0 Enter the date it was received");
  const t=invTotals(v);
  if(amt > t.outstanding + 0.005 &&
     !await uiConfirm(`${curFmt(amt,v.currency)} is more than the ${curFmt(t.outstanding,v.currency)} outstanding.\n\nRecord it anyway? The excess will show as overpaid.`)) return;
  const payments=[...(v.payments||[]), {date:f.date, amount:amt,
    method:String(f.method||"").trim(), ref:String(f.ref||"").trim()}];
  await fbSave("invoices", {...v, payments});
  window._invPay=null;
  saveToast(`Receipt of ${curFmt(amt,v.currency)} recorded \u2713`);
};
window.payDel = async function(id, idx){
  if(!isAdmin()) return toast("Admin only");
  const v=(state.invoices||[]).find(x=>x.id===id); if(!v) return;
  const p=(v.payments||[])[idx]; if(!p) return;
  if(!await uiConfirm(`Remove the receipt of ${curFmt(num(p.amount),v.currency)} dated ${p.date?fmtDate(p.date):"\u2014"}?`)) return;
  const payments=(v.payments||[]).filter((_,i)=>i!==idx);
  await fbSave("invoices", {...v, payments});
  toast("Receipt removed");
};

// ── Screens ──────────────────────────────────────────────────────────────
function invRow(l,v,strong){
  return `<tr><td style="padding:5px 8px;border-bottom:1px solid var(--line);font-size:11px;${strong?"font-weight:800":"color:var(--muted)"}">${l}</td>
    <td style="padding:5px 8px;border-bottom:1px solid var(--line);text-align:right;font-size:${strong?"13px":"12px"};${strong?"font-weight:800":""}">${v}</td></tr>`;
}

function renderInvoices(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();
  const clients=(state.clients||[]).map(c=>c.name).filter(Boolean).sort();

  if(window._invView==="edit"){
    const v=window._inv, t=invTotals(v), due=invDueDate(v);
    const cat=(typeof partsList==="function")?partsList():[];
    return `<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${window._invId?"Edit invoice":"New invoice"}
        ${v.ref?`<span style="font-size:11px;color:var(--muted);font-weight:600">${escapeHtml(v.ref)}</span>`:""}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="invCancelEdit()">Cancel</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Project <span class="req">*</span></label>
          <select onchange="invSet('project',this.value)"><option value="">\u2014 select \u2014</option>
            ${projects.map(p=>`<option ${v.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}</select></div>
        <div class="field"><label>Client <span class="req">*</span></label>
          <select onchange="invSet('client',this.value)"><option value="">\u2014 select \u2014</option>
            ${clients.map(c=>`<option ${v.client===c?"selected":""}>${escapeHtml(c)}</option>`).join("")}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Title</label>
          <input value="${escapeHtml(v.title||"")}" oninput="invSet('title',this.value)" placeholder="e.g. Progress claim 2 \u2014 CCTV expansion"></div>
        <div class="field"><label>Invoice date</label><input type="date" value="${escapeHtml(v.date||"")}" onchange="invSet('date',this.value)"></div>
        <div class="field"><label>Payment terms</label>
          <select onchange="invSet('termDays',this.value)">
            ${INV_TERMS.map(d=>`<option value="${d}" ${num(v.termDays)===d?"selected":""}>${d===0?"On receipt":d+" days"}</option>`).join("")}
          </select></div>
        <div class="field"><label>Currency</label>
          <select onchange="invSet('currency',this.value)">${CUR_CODES.map(c=>`<option ${v.currency===c?"selected":""}>${c}</option>`).join("")}</select></div>
        <div class="field"><label>Rate applied</label>
          <input value="${escapeHtml(String(v.rate||""))}" oninput="invSet('rate',this.value)" inputmode="decimal" placeholder="${curRate()||"not set"}">
          <div style="font-size:10px;color:var(--muted);margin-top:4px">Frozen on this invoice.</div></div>
        <div class="field" style="grid-column:1/-1"><label>Document number
          <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 leave blank to let the app issue one</span></label>
          <input value="${escapeHtml(v.ref||"")}" oninput="invSet('ref',this.value)"
                 placeholder="e.g. EJ\\EBL\\04\\FFIN-20260003">
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">
            Type a number when company filing requires its own format; it is then used exactly as written and the app's sequence is left untouched.
            ${v.ref?`<br><strong>Fixed once the document is issued.</strong>`:""}
          </div>
        </div>
      </div>
      ${due?`<div style="font-size:11px;color:var(--muted);margin-top:8px">Due <strong>${escapeHtml(fmtDate(due))}</strong></div>`:""}
    </div>

    <div class="card">
      <div class="sec-hdr">Lines <span style="font-size:10px;color:var(--muted);font-weight:500">(${t.count})</span></div>
      ${(v.lines||[]).map((l,i)=>`<div style="border:1px solid var(--line);border-radius:8px;padding:8px;margin-top:8px">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:800;color:var(--muted);min-width:20px">${String(i+1).padStart(2,"0")}</span>
          <select onchange="invLineSet(${i},'kind',this.value)" style="width:104px;font-size:11px">
            ${LINE_KINDS.map(k=>`<option value="${k.k}" ${(l.kind||"other")===k.k?"selected":""}>${k.ic} ${k.lb}</option>`).join("")}
          </select>
          ${cat.length?`<select onchange="invLinePick(${i},this.value)" style="flex:1;min-width:120px;font-size:11px">
            <option value="">\u2014 free text \u2014</option>
            ${cat.map(p=>`<option value="${escapeHtml(p.code||"")}" ${String(l.code||"")===String(p.code||"")?"selected":""}>${escapeHtml(p.code||"")} \u00b7 ${escapeHtml(p.name||"")}</option>`).join("")}
          </select>`:""}
          <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="invLineDel(${i})">\u00d7</button>
        </div>
        <input value="${escapeHtml(l.desc||"")}" oninput="invLineSet(${i},'desc',this.value)" placeholder="Description" style="width:100%;margin-top:6px">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
          <input value="${escapeHtml(String(l.qty==null?"":l.qty))}" oninput="invLineSet(${i},'qty',this.value)" placeholder="Qty" inputmode="decimal" style="width:74px">
          <input value="${escapeHtml(l.unit||"")}" oninput="invLineSet(${i},'unit',this.value)" placeholder="Unit" style="width:64px">
          <input value="${escapeHtml(String(l.unitPrice==null?"":l.unitPrice))}" oninput="invLineSet(${i},'unitPrice',this.value)" placeholder="Unit price" inputmode="decimal" style="width:104px">
          <input value="${escapeHtml(String(l.discountPct||""))}" oninput="invLineSet(${i},'discountPct',this.value)" placeholder="Disc %" inputmode="decimal" style="width:70px">
          <span style="margin-left:auto;font-size:12px;font-weight:800" id="invLine${i}">${curFmt(lineNet(l),v.currency)}</span>
        </div>
      </div>`).join("")}
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        ${LINE_KINDS.map(k=>`<button class="btn btn-sm btn-secondary" onclick="invLineAdd('${k.k}')">+ ${k.ic} ${k.lb}</button>`).join("")}
      </div>
      ${v.project?`<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Bill a share of the contract \u2014 the usual way milestone claims are raised</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${[10,25,30,50,70,100].map(p=>`<button class="btn btn-sm btn-secondary" onclick="invFromContract(${p})">${p}%</button>`).join("")}
        </div></div>`:""}
    </div>

    <div class="card">
      <div class="sec-hdr">Totals</div>
      <div class="form-grid">
        <div class="field"><label>Tax %</label><input value="${escapeHtml(String(v.taxPct||""))}" oninput="invSet('taxPct',this.value)" inputmode="decimal" placeholder="0"></div>
        <div class="field"><label>Retention % <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 withheld until release</span></label>
          <input value="${escapeHtml(String(v.retentionPct||""))}" oninput="invSet('retentionPct',this.value)" inputmode="decimal" placeholder="0"></div>
      </div>
      <table style="border-collapse:collapse;width:100%;margin-top:10px">
        ${invRow("Subtotal", `<span id="invSub">${curFmt(t.sub,v.currency)}</span>`)}
        ${invRow("Tax", `<span id="invTax">${t.tax?curFmt(t.tax,v.currency):"\u2014"}</span>`)}
        ${invRow("Invoice total", `<span id="invTotal">${curDual(t.total,v.currency,v.rate)}</span>`, true)}
        ${invRow("Retention withheld", `<span id="invRet">${t.retention?"- "+curFmt(t.retention,v.currency):"\u2014"}</span>`)}
        ${invRow("Collectable now", `<span id="invDue">${curFmt(t.claimable,v.currency)}</span>`, true)}
      </table>
      <div class="field" style="margin-top:10px"><label>Payment terms / notes</label>
        <textarea rows="2" oninput="invSet('terms',this.value)" placeholder="Bank details, reference to quote or contract\u2026">${escapeHtml(v.terms||"")}</textarea></div>
      <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="invSave()">Save invoice</button>
    </div>`;
  }

  // ── list + ageing ──
  const cur=curBase();
  const age=invAgeing("", cur), cash=cashPosition(cur);
  const rows=invoicesFor("");
  const payingId=window._invPay;
  return `<div class="card">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="invNew()">+ New invoice</button>
      <span style="font-size:11px;color:var(--muted);margin-left:auto">${rows.length} invoice(s)</span>
    </div>
    <div style="margin-top:10px">${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${typeof rptFormatToggle==="function"?rptFormatToggle():""}</div>
  </div>

  <div class="card">
    <div class="sec-hdr">\u{1F4B0} Cash position</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px">
      ${[["Receivable",curFmt(cash.receivable,cur),"#2E7D32"],
         ["Payable",curFmt(cash.payable,cur),"#C62828"],
         ["Net",curFmt(cash.net,cur),cash.net<0?"#C62828":"#03308B"],
         ["Retention held",curFmt(cash.retentionHeld,cur),"#8F6E22"]]
        .map(([l,val,c])=>`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:9px;text-align:center">
          <div style="font-size:14px;font-weight:800;color:${c}">${val}</div>
          <div style="font-size:10px;color:var(--muted)">${l}</div></div>`).join("")}
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.7">
      Receivable is what clients still owe on issued invoices; payable is expenses recorded but not yet paid.
      Retention is held separately because it is not collectable until released.
    </div>
    ${cash.unconverted?`<div style="background:#FDECEA;border:1px solid #EF9A9A;border-radius:8px;padding:9px 11px;margin-top:9px;font-size:11px;color:#C62828;line-height:1.6">\u26a0 ${cash.unconverted} document(s) in another currency carry no rate and are excluded from these figures.</div>`:""}
  </div>

  <div class="card">
    <div class="sec-hdr">\u23F3 Ageing</div>
    ${!age.total?`<div style="font-size:11px;color:var(--muted)">Nothing outstanding.</div>`:`
    <table style="border-collapse:collapse;width:100%">
      ${AGE_BUCKETS.map(b=>{const x=age.buckets[b.k];
        return x.amount?`<tr>
          <td style="padding:6px 8px;border-bottom:1px solid var(--line);font-size:11px">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${b.color};margin-left:6px"></span>${b.lb}
            <span style="color:var(--muted)"> \u00b7 ${x.count}</span></td>
          <td style="padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;font-weight:800;font-size:12px;color:${b.color}">${curFmt(x.amount,cur)}</td>
        </tr>`:"";}).join("")}
      <tr><td style="padding:7px 8px;font-weight:800;font-size:12px;border-top:2px solid var(--line)">Total outstanding</td>
        <td style="padding:7px 8px;text-align:right;font-weight:800;font-size:13px;border-top:2px solid var(--line)">${curFmt(age.total,cur)}</td></tr>
    </table>`}
  </div>

  ${!rows.length?`<div class="card">`+emptyState({icon:"\u{1F9FE}",title:"No invoices yet",
      why:"Knowing a project is profitable is not the same as knowing the money arrived. Invoices tell you what has been billed, what is still owed, and how late it is.",
      steps:["Pick the project \u2014 the client fills itself in","Bill a share of the contract with one tap, or add lines by hand","Issue it, then record each receipt as it comes in"],
      action:{label:"+ New invoice", onclick:"invNew()"},
      hint:"Retention is withheld until you release it, so it never inflates what the client currently owes."})+`</div>`:rows.map(v=>{
    const st=invStatus(v), S=INV_STATUS[st]||INV_STATUS.draft, t=invTotals(v);
    const d=daysPastDue(v), due=invDueDate(v);
    return `<div class="card" style="border-left:4px solid ${S.fg}">
      <div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:13px">${escapeHtml(v.title||v.ref||"Invoice")}</div>
          <div style="font-size:10px;color:var(--muted);line-height:1.7">
            ${v.ref?escapeHtml(v.ref)+" \u00b7 ":""}${escapeHtml(v.client||"\u2014")}${v.project?" \u00b7 "+escapeHtml(v.project):""}<br>
            ${v.date?escapeHtml(fmtDate(v.date)):"\u2014"}${due?` \u00b7 due ${escapeHtml(fmtDate(due))}`:""}
            ${(st==="overdue"&&d>0)?`<span style="color:#C62828;font-weight:800"> \u00b7 ${d} day${d>1?"s":""} late</span>`:""}
          </div>
        </div>
        <span style="background:${S.bg};color:${S.fg};padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap">${S.ic} ${S.lb}</span>
      </div>
      <table style="border-collapse:collapse;width:100%;margin-top:8px">
        ${invRow("Total", curDual(t.total,v.currency,v.rate), true)}
        ${t.retention?invRow(`Retention ${t.retentionPct}%${t.retentionReleased?" (released)":" (held)"}`, curFmt(t.retention,v.currency)):""}
        ${t.paid?invRow("Received", `<span style="color:#2E7D32">${curFmt(t.paid,v.currency)}</span>`):""}
        ${t.outstanding?invRow("Outstanding", `<span style="color:${d>0?"#C62828":"#8F6E22"};font-weight:800">${curFmt(t.outstanding,v.currency)}</span>`):""}
        ${t.overpaid?invRow("Overpaid", `<span style="color:#E65100">${curFmt(t.overpaid,v.currency)}</span>`):""}
      </table>
      ${(v.payments||[]).length?`<div style="margin-top:8px">
        <div style="font-size:10px;font-weight:800;color:var(--muted);margin-bottom:4px">Receipts</div>
        ${(v.payments||[]).map((p,i)=>`<div style="display:flex;gap:8px;align-items:center;font-size:11px;padding:3px 0;border-bottom:1px solid var(--line)">
          <span>${p.date?escapeHtml(fmtDate(p.date)):"\u2014"}</span>
          <span style="font-weight:700">${curFmt(num(p.amount),v.currency)}</span>
          <span style="color:var(--muted)">${escapeHtml(p.method||"")}${p.ref?" \u00b7 "+escapeHtml(p.ref):""}</span>
          <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto;font-size:10px;padding:1px 6px" onclick="payDel('${v.id}',${i})">\u00d7</button>
        </div>`).join("")}
      </div>`:""}
      ${payingId===v.id?`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:10px">
        <div style="font-size:11px;font-weight:800;margin-bottom:8px">Record a receipt</div>
        <div class="form-grid">
          <div class="field"><label>Date</label><input type="date" value="${escapeHtml(window._payForm.date||"")}" onchange="paySet('date',this.value)"></div>
          <div class="field"><label>Amount</label><input value="${escapeHtml(String(window._payForm.amount||""))}" oninput="paySet('amount',this.value)" inputmode="decimal"></div>
          <div class="field"><label>Method</label><input value="${escapeHtml(window._payForm.method||"")}" oninput="paySet('method',this.value)" placeholder="Transfer / cash / cheque"></div>
          <div class="field"><label>Reference</label><input value="${escapeHtml(window._payForm.ref||"")}" oninput="paySet('ref',this.value)"></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:9px">
          <button class="btn btn-primary btn-sm" onclick="payAdd()">Record</button>
          <button class="btn btn-sm btn-secondary" onclick="payClose()">Cancel</button>
        </div>
      </div>`:""}
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="invEdit('${v.id}')">\u270e Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="invoiceDoc('${v.id}')">${window._rptFormat==="word"?"\u{1F4DD} Word":"\u{1F4C4} PDF"}</button>
        ${st==="draft"?`<button class="btn btn-sm" style="background:#1565C0;color:#fff;border:none" onclick="invIssue('${v.id}')">Issue</button>`:""}
        ${(st==="issued"||st==="part"||st==="overdue")?`<button class="btn btn-sm" style="background:#2E7D32;color:#fff;border:none" onclick="payOpen('${v.id}')">\u{1F4B5} Receipt</button>`:""}
        ${(t.retention&&!t.retentionReleased&&st!=="draft")?`<button class="btn btn-sm btn-secondary" onclick="invReleaseRetention('${v.id}')">Release retention</button>`:""}
        ${st!=="cancelled"&&st!=="draft"?`<button class="btn btn-sm btn-secondary" onclick="invCancel('${v.id}')">Cancel</button>`:""}
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none;margin-left:auto" onclick="invDel('${v.id}')">\u00d7</button>
      </div>
    </div>`;}).join("")}`;
}
Object.assign(window,{renderInvoices});

// ── Invoice document ─────────────────────────────────────────────────────
window.invoiceDoc = async function(id){
  const v=(state.invoices||[]).find(x=>x.id===id);
  if(!v) return toast("Invoice not found");
  const t=invTotals(v), due=invDueDate(v), st=invStatus(v), cur=v.currency;
  const TH='padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left';
  const TD='padding:6px 9px;border:1px solid #D6E4F0';
  const R=(l,x,strong)=>`<tr><td style="${TD};${strong?"font-weight:800":""};width:62%">${l}</td>
    <td style="${TD};text-align:right;${strong?"font-weight:800;font-size:13px":""}">${x}</td></tr>`;
  const body=`
  <div class="ksec"><span class="kbad">01</span><h3>Invoice</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${R("Billed to", escapeHtml(v.client||"\u2014"))}
    ${v.project?R("Project", escapeHtml(v.project)):""}
    ${v.title?R("Description", escapeHtml(v.title)):""}
    ${R("Invoice date", v.date?escapeHtml(fmtDate(v.date)):"\u2014")}
    ${R("Payment due", due?escapeHtml(fmtDate(due)):"On receipt")}
    ${R("Currency", escapeHtml(cur)+(num(v.rate)?` \u00b7 rate applied ${escapeHtml(String(v.rate))} ${escapeHtml(curBase())} per 1 ${escapeHtml(curSecondary())}`:""))}
    ${R("Status", escapeHtml((INV_STATUS[st]||{lb:st}).lb))}
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">02</span><h3>Items</h3></div>
  <table style="border-collapse:collapse;width:100%">
    <thead><tr>
      <th style="${TH};width:34px;text-align:center">#</th><th style="${TH}">Description</th>
      <th style="${TH};width:58px;text-align:right">Qty</th><th style="${TH};width:50px">Unit</th>
      <th style="${TH};width:92px;text-align:right">Rate</th>
      <th style="${TH};width:52px;text-align:right">Disc</th>
      <th style="${TH};width:104px;text-align:right">Amount</th>
    </tr></thead>
    <tbody>${(v.lines||[]).map((l,i)=>`<tr>
      <td style="${TD};text-align:center">${String(i+1).padStart(2,"0")}</td>
      <td style="${TD}"><strong>${escapeHtml(l.desc||l.code||"\u2014")}</strong></td>
      <td style="${TD};text-align:right">${escapeHtml(String(num(l.qty)))}</td>
      <td style="${TD};font-size:10px">${escapeHtml(l.unit||"\u2014")}</td>
      <td style="${TD};text-align:right">${curFmt(num(l.unitPrice),cur)}</td>
      <td style="${TD};text-align:right">${num(l.discountPct)?escapeHtml(String(l.discountPct))+"%":"\u2014"}</td>
      <td style="${TD};text-align:right;font-weight:700">${curFmt(lineNet(l),cur)}</td>
    </tr>`).join("")}</tbody>
  </table>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">03</span><h3>Summary</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${R("Subtotal", curFmt(t.sub,cur))}
    ${t.tax?R(`Tax ${t.taxPct}%`, curFmt(t.tax,cur)):""}
    ${R("Invoice total", curDualPlain(t.total,cur,v.rate), true)}
    ${t.retention?R(`Retention ${t.retentionPct}% withheld${t.retentionReleased?` \u2014 released ${escapeHtml(fmtDate(v.retentionReleasedDate||""))}`:""}`, (t.retentionReleased?"":"- ")+curFmt(t.retention,cur)):""}
    ${R("Amount payable", curDualPlain(t.claimable,cur,v.rate), true)}
    ${t.paid?R("Received to date", curFmt(t.paid,cur)):""}
    ${t.outstanding?R("Balance outstanding", `<span style="color:#C62828">${curFmt(t.outstanding,cur)}</span>`, true):""}
  </table>
  ${(v.payments||[]).length?`<div style="margin-top:10px">
    <div style="font-weight:800;font-size:12px;color:#03308B;margin-bottom:5px">Receipts</div>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr><th style="${TH};width:34px;text-align:center">#</th><th style="${TH}">Date</th>
        <th style="${TH}">Method</th><th style="${TH}">Reference</th>
        <th style="${TH};width:104px;text-align:right">Amount</th></tr></thead>
      <tbody>${(v.payments||[]).map((p,i)=>`<tr>
        <td style="${TD};text-align:center">${String(i+1).padStart(2,"0")}</td>
        <td style="${TD}">${p.date?escapeHtml(fmtDate(p.date)):"\u2014"}</td>
        <td style="${TD};font-size:10px">${escapeHtml(p.method||"\u2014")}</td>
        <td style="${TD};font-size:10px">${escapeHtml(p.ref||"\u2014")}</td>
        <td style="${TD};text-align:right;font-weight:700">${curFmt(num(p.amount),cur)}</td>
      </tr>`).join("")}</tbody></table></div>`:""}
  ${v.terms?`<div style="margin-top:12px"><div style="font-weight:800;font-size:12px;color:#03308B;margin-bottom:5px">Payment terms</div>
    <div style="font-size:11px;line-height:1.8;white-space:pre-wrap">${escapeHtml(v.terms)}</div></div>`:""}
  <div style="margin-top:10px;font-size:10px;font-style:italic;color:#555;line-height:1.7">
    Amounts are stated in ${escapeHtml(cur)} at the exchange rate recorded on this invoice; a later change in the market rate does not alter the sum due.
    ${t.retention&&!t.retentionReleased?` Retention of ${escapeHtml(curFmt(t.retention,cur))} is withheld and becomes payable on release.`:""}
  </div>

  <div class="ksec" style="page-break-inside:avoid"><span class="kbad">04</span><h3>Acknowledgement</h3></div>
  <table style="border-collapse:collapse;width:100%"><tr>
    ${sigBlockHTML("inv_iss", (state.profile&&(state.profile.name||state.profile.employeeName))||"", "For EJAF Technology", "EJAF Technology")}
    ${sigBlockHTML("inv_rec", "", "Received by", v.client||"")}
  </tr></table>`;
  await openReportPDF("INVOICE", `${v.client||""} \u00b7 ${v.ref||v.title||""}`, body,
    {project:v.project||"", client:v.client||""});
  toast("Invoice ready!");
};

// Billing position card, shown beside each project's P&L.
function projectBillingCard(name){
  const b=invBillingPosition(name);
  if(!b || (!b.billed && !b.earned)) return "";
  const cur=b.currency;
  const row=(l,v,c)=>`<tr><td style="padding:5px 8px;border-bottom:1px solid var(--line);font-size:11px;color:var(--muted)">${l}</td>
    <td style="padding:5px 8px;border-bottom:1px solid var(--line);text-align:right;font-size:12px;font-weight:700${c?`;color:${c}`:""}">${v}</td></tr>`;
  return `<div class="card" style="border-left:4px solid #1565C0">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\u{1F4B0} Billing \u2014 ${escapeHtml(name)}
      ${b.pctBilled!=null?`<span style="background:#E3F2FD;color:#1565C0;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800">${b.pctBilled}% billed</span>`:""}
      ${b.pctCollected!=null?`<span style="background:#E8F5E9;color:#2E7D32;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:800">${b.pctCollected}% collected</span>`:""}
    </div>
    <table style="border-collapse:collapse;width:100%">
      ${row("Earned (contract + variations)", curFmt(b.earned,cur))}
      ${row("Invoiced", curFmt(b.billed,cur))}
      ${row("Not yet invoiced", curFmt(b.unbilled,cur), b.unbilled>0?"#E65100":"")}
      ${row("Collected", curFmt(b.collected,cur), "#2E7D32")}
      ${row("Awaiting collection", curFmt(b.uncollected,cur), b.uncollected>0?"#C62828":"")}
    </table>
    ${b.unbilled>0?`<div style="font-size:10px;color:#E65100;margin-top:8px;line-height:1.6">\u26a0 ${curFmt(b.unbilled,cur)} of work has been earned but never invoiced \u2014 money the client does not yet know it owes.</div>`:""}
    ${b.unconverted?`<div style="font-size:10px;color:#C62828;margin-top:6px;line-height:1.6">${b.unconverted} invoice(s) in another currency carry no rate and are excluded.</div>`:""}
  </div>`;
}
Object.assign(window,{invoiceDoc, projectBillingCard});
