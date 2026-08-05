// ═══════════════════════════════════════════════════════════════════════════
//  18-performance.js  (v216)
//  Earned value, and the environmental footprint of the work.
//
//  The app already recorded what was ESTIMATED and what was SPENT. What it
//  could not answer was the question a client asks in a progress meeting: are
//  we on track, and if not, where will this end up? Two hours of logged time
//  and a cost figure cannot answer that on their own — they need a baseline to
//  be measured against.
//
//  A baseline is a snapshot: the hours, the value and the dates as they were
//  agreed. Frozen deliberately. Comparing today's spend against today's plan is
//  circular, and a plan that moves whenever reality moves is not a plan.
//
//  Sustainability is folded in here rather than given its own module because it
//  answers the same shape of question from the same records: fuel already sits
//  in the expense ledger and in every reimbursement claim, and travel already
//  carries its distance in days. Nobody has to enter anything twice.
// ═══════════════════════════════════════════════════════════════════════════

// ── Emission factors ────────────────────────────────────────────────────
// Deliberately editable and deliberately labelled as defaults. These are broad
// public averages; a company reporting to a client under a contractual clause
// should replace them with whatever its own scheme mandates. Publishing a
// number derived from a factor nobody can see or change is worse than
// publishing nothing.
const CO2_DEFAULTS = {
  dieselPerLitre: 2.68,      // kg CO2e per litre, diesel
  petrolPerLitre: 2.31,      // kg CO2e per litre, petrol
  litrePrice:     1000,      // local currency per litre — used to turn spend into volume
  kmPerTravelDay: 120,       // average distance covered on a travel day
  co2PerKm:       0.17,      // kg CO2e per km, light commercial vehicle
  gridPerKwh:     0.55,      // kg CO2e per kWh — only used if consumption is recorded
  fuelType:       "diesel",
};
function co2Cfg(){
  const d=(state.settingsDocs||[]).find(x=>x.id==="sustainability")||{};
  const out={};
  Object.keys(CO2_DEFAULTS).forEach(k=>{
    out[k] = (d[k]===undefined||d[k]===null||d[k]==="") ? CO2_DEFAULTS[k] : d[k];
  });
  out.perLitre = String(out.fuelType)==="petrol" ? num(out.petrolPerLitre) : num(out.dieselPerLitre);
  return out;
}
Object.assign(window,{CO2_DEFAULTS, co2Cfg});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  A.  BASELINE                                                        ║
// ╚═══════════════════════════════════════════════════════════════════════╝
// Stored on the project itself: a baseline belongs to the thing it describes,
// and keeping it there means it travels with the project into every report.
function baselineOf(projectName){
  const p=(state.projects||[]).find(x=>String(x.name||"").trim()===String(projectName||"").trim());
  if(!p || !p.baseline) return null;
  const b=p.baseline;
  if(!num(b.hours) && !num(b.value)) return null;
  return {
    hours:num(b.hours), value:num(b.value), currency:b.currency||curBase(),
    start:String(b.start||""), end:String(b.end||""),
    setAt:String(b.setAt||""), setBy:String(b.setBy||""), note:String(b.note||""),
  };
}
function hasBaseline(projectName){ return !!baselineOf(projectName); }

window.baselineSet = async function(projectName){
  if(!isAdmin()) return toast("Admin only");
  const p=(state.projects||[]).find(x=>String(x.name||"").trim()===String(projectName||"").trim());
  if(!p) return toast("Project not found");
  const f=(typeof projectFinance==="function")?projectFinance(p.name):null;
  const hours=num(p.estimatedHours);
  const value=f?f.revenue:num(p.contractValue);
  if(!hours && !value) return toast("\u26a0 Set estimated hours or a contract value first \u2014 there is nothing to baseline");
  const existing=baselineOf(p.name);
  if(existing && !await uiConfirm(
      `This project already has a baseline from ${existing.setAt?fmtDate(existing.setAt.slice(0,10)):"earlier"}.\n\n` +
      `Replacing it resets every variance figure to zero, so past performance disappears from the record. ` +
      `A change of scope is normally handled with a variation order instead \u2014 that keeps the history.\n\nReplace it anyway?`,
      {danger:true, okText:"Replace baseline"})) return;
  await fbSave("projects", {...p, baseline:{
    hours, value, currency:(f?f.currency:curBase()),
    start:String(p.startDate||""), end:String(p.endDate||""),
    setAt:new Date().toISOString(),
    setBy:(state.profile&&(state.profile.name||state.profile.employeeName))||"",
    note:"",
  }});
  saveToast("Baseline set \u2713");
};
window.baselineClear = async function(projectName){
  if(!isAdmin()) return toast("Admin only");
  const p=(state.projects||[]).find(x=>String(x.name||"").trim()===String(projectName||"").trim());
  if(!p) return;
  if(!await uiConfirm(`Remove the baseline from ${p.name}?\n\nEarned-value figures stop being available for this project.`)) return;
  const {baseline, ...rest}=p;
  await fbSave("projects", {...rest, baseline:null});
  toast("Baseline removed");
};
Object.assign(window,{baselineOf, hasBaseline});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  B.  EARNED VALUE                                                    ║
// ╚═══════════════════════════════════════════════════════════════════════╝
// PV — what the plan says should have been done by now.
// EV — what has actually been earned, valued at the plan's own rate.
// AC — what it has actually cost.
//
// The subtlety that makes or breaks this: EV must be measured in the SAME
// currency as PV, which means valuing progress at the BASELINE rate, not at
// what it happened to cost. Using actual cost for both makes CPI exactly 1.00
// for ever, which is the commonest way earned value is got wrong.
function evmFor(projectName, asOf){
  const b=baselineOf(projectName);
  if(!b) return null;
  const f=(typeof projectFinance==="function")?projectFinance(projectName):null;
  if(!f) return null;
  const today=asOf || ((typeof todayStr==="function")?todayStr():new Date().toISOString().slice(0,10));

  // Hours are the measure of progress: they are recorded daily, approved, and
  // exist for every project. A percent-complete typed by hand would be an
  // opinion; hours are a record.
  const doneHours = (state.daily||[])
    .filter(r=>String(r.project||"").trim()===String(projectName||"").trim())
    .filter(r=>!r.date || String(r.date)<=today)
    .reduce((s,r)=>s+Number(r.duration||0),0);

  const bac = b.value;                        // budget at completion
  const pctComplete = b.hours>0 ? Math.min(1, doneHours/b.hours) : 0;
  const ev  = bac * pctComplete;              // earned value
  const ac  = f.cost;                         // actual cost

  // Planned value needs the schedule. Without dates the time question cannot be
  // answered at all, and inventing a straight line would be a fabrication.
  let pv=null, schedulePct=null;
  if(b.start && b.end && b.start<=b.end){
    const s=new Date(b.start+"T00:00:00Z"), e=new Date(b.end+"T00:00:00Z"), n=new Date(today+"T00:00:00Z");
    const span=e-s;
    if(span>0){
      schedulePct=Math.min(1, Math.max(0, (n-s)/span));
      pv=bac*schedulePct;
    }
  }
  const cpi = ac>0 ? ev/ac : null;            // cost performance
  const spi = (pv!=null && pv>0) ? ev/pv : null;  // schedule performance
  const eac = (cpi && cpi>0) ? bac/cpi : null;    // estimate at completion
  const etc = (eac!=null) ? Math.max(0, eac-ac) : null;
  const vac = (eac!=null) ? bac-eac : null;       // variance at completion

  return {
    currency:b.currency, baseline:b,
    bac:Math.round(bac), hoursPlanned:b.hours, hoursDone:Math.round(doneHours*100)/100,
    pctComplete:Math.round(pctComplete*1000)/10,
    schedulePct: schedulePct==null?null:Math.round(schedulePct*1000)/10,
    pv: pv==null?null:Math.round(pv), ev:Math.round(ev), ac:Math.round(ac),
    cv: Math.round(ev-ac), sv: pv==null?null:Math.round(ev-pv),
    cpi: cpi==null?null:Math.round(cpi*100)/100,
    spi: spi==null?null:Math.round(spi*100)/100,
    eac: eac==null?null:Math.round(eac),
    etc: etc==null?null:Math.round(etc),
    vac: vac==null?null:Math.round(vac),
    asOf:today,
  };
}
// An index is meaningless without a reading. 0.9 sounds close to 1 and is not.
function evmVerdict(v){
  if(v==null) return {k:"none", lb:"Not measured", bg:"#ECEFF1", fg:"#546E7A", note:"No figure available"};
  if(v>=1.05) return {k:"ahead", lb:"Ahead", bg:"#E8F5E9", fg:"#2E7D32", note:"Better than planned"};
  if(v>=0.95) return {k:"ontrack", lb:"On track", bg:"#E8F5E9", fg:"#2E7D32", note:"Within 5% of plan"};
  if(v>=0.85) return {k:"slipping", lb:"Slipping", bg:"#FFF8E1", fg:"#8F6E22", note:"Drifting; worth acting on now"};
  return {k:"poor", lb:"Off plan", bg:"#FDECEA", fg:"#C62828", note:"Materially behind; needs a decision"};
}
Object.assign(window,{evmFor, evmVerdict});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  C.  SUSTAINABILITY                                                  ║
// ╚═══════════════════════════════════════════════════════════════════════╝
// Computed entirely from records that already exist. Fuel is in the expense
// ledger and in every reimbursement claim; travel carries its duration. Asking
// anyone to log emissions separately would guarantee the data was never
// entered, and a footprint nobody maintains is worse than none.
function footprintFor(projectName, from, to){
  const cfg=co2Cfg();
  const inRange=(d)=>{ const s=String(d||""); if(!s) return false;
    if(from && s<from) return false; if(to && s>to) return false; return true; };
  const matches=(p)=>!projectName || String(p||"").trim()===String(projectName||"").trim();

  // 1) Fuel bought through the expense ledger. Spend is converted to litres at
  //    the configured price, because nobody records litres — they record what
  //    the receipt said.
  let fuelSpend=0, fuelUnconverted=0;
  (state.expenses||[]).forEach(e=>{
    if(String(e.category||"")!=="fuel") return;
    if(!matches(e.project) || !inRange(e.date)) return;
    const v=(typeof expInBase==="function")?expInBase(e, curBase()):null;
    if(v===null){ fuelUnconverted++; return; }
    fuelSpend+=v;
  });
  // 2) Fuel claimed back by employees on the transport form.
  (state.expenseReports||[]).forEach(r=>{
    if(!["approved","paid"].includes(String(r.status||""))) return;
    if(!inRange(r.date)) return;
    const rate=num(r.rate)||curRate();
    (r.lines||[]).forEach(l=>{
      if(!matches(l.project)) return;
      const iqd=num(l.fuelIQD), usd=num(l.fuelUSD);
      if(curBase()==="IQD") fuelSpend += iqd + (usd&&rate ? usd*rate : 0);
      else                  fuelSpend += usd + (iqd&&rate ? iqd/rate : 0);
    });
  });
  const litres = cfg.litrePrice>0 ? fuelSpend/cfg.litrePrice : 0;
  const fuelCo2 = litres * cfg.perLitre;

  // 3) Travel days, where no fuel receipt exists but distance was covered.
  let travelDays=0;
  (state.travel||[]).forEach(t=>{
    if(!matches(t.project)) return;
    const d=String(t.from||t.date||"");
    if(!inRange(d)) return;
    travelDays += num(t.days) || 1;
  });
  const travelKm  = travelDays * num(cfg.kmPerTravelDay);
  const travelCo2 = travelKm * num(cfg.co2PerKm);

  // 4) Parts replaced — electrical waste that a handover often has to declare.
  let partsReplaced=0;
  (state.daily||[]).forEach(r=>{
    if(!matches(r.project) || !inRange(r.date)) return;
    (r.partsUsed||[]).forEach(p=>{ partsReplaced += num(p.qty)||0; });
  });

  const total=fuelCo2+travelCo2;
  return {
    currency:curBase(),
    fuelSpend:Math.round(fuelSpend), litres:Math.round(litres*10)/10,
    fuelCo2:Math.round(fuelCo2), travelDays, travelKm:Math.round(travelKm),
    travelCo2:Math.round(travelCo2), totalCo2:Math.round(total),
    tonnes:Math.round(total/1000*100)/100,
    partsReplaced:Math.round(partsReplaced*100)/100,
    unconverted:fuelUnconverted,
    // A total on its own is not actionable; intensity lets one project be
    // compared with another regardless of size.
    perHour:(function(){
      const h=(state.daily||[]).filter(r=>matches(r.project)&&inRange(r.date))
        .reduce((s,r)=>s+Number(r.duration||0),0);
      return h>0 ? Math.round(total/h*100)/100 : null;
    })(),
    cfg,
  };
}
window.co2Set = async function(key, value){
  if(!isAdmin()) return toast("Admin only");
  if(!Object.prototype.hasOwnProperty.call(CO2_DEFAULTS, key)) return;
  const cur=(state.settingsDocs||[]).find(x=>x.id==="sustainability")||{};
  const v=(key==="fuelType") ? String(value||"diesel") : num(value);
  const doc={...cur, id:"sustainability", [key]:v};
  state.settingsDocs=[...(state.settingsDocs||[]).filter(x=>x.id!=="sustainability"), doc];
  render();
  try{ await fbSave("settings", doc); }
  catch(e){ toast("Could not save: "+(e&&e.message||e)); }
};
Object.assign(window,{footprintFor});

// ── Cards ────────────────────────────────────────────────────────────────
function _pfKV(label, value, note, colour){
  return `<tr>
    <td style="padding:6px 8px;border-bottom:1px solid var(--line);font-size:11px;color:var(--muted)">
      ${escapeHtml(label)}${note?`<div style="font-size:9.5px;opacity:.8;line-height:1.5">${escapeHtml(note)}</div>`:""}</td>
    <td style="padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;font-size:12px;font-weight:700${colour?`;color:${colour}`:""}">${value}</td>
  </tr>`;
}
// The earned-value card. Each index is shown WITH its reading, because "0.87"
// means nothing to most people and "Slipping" means something to everyone.
function evmCard(projectName){
  const v=evmFor(projectName);
  if(!v){
    if(!(isAdmin()||hasCap("canAnalytics"))) return "";
    return `<div class="card" style="border-left:4px solid var(--line)">
      <div class="sec-hdr">\u{1F4D0} Earned value</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.75">
        No baseline has been set for this project, so there is nothing to measure against.
        A baseline freezes the estimated hours, the agreed value and the dates as they stand today;
        every variance figure afterwards is measured from that point.
      </div>
      ${isAdmin()?`<button class="btn btn-sm btn-primary" style="margin-top:10px" onclick="baselineSet(${jsArg(projectName)})">Set the baseline from today's figures</button>`:""}
    </div>`;
  }
  const cpi=evmVerdict(v.cpi), spi=evmVerdict(v.spi);
  const cur=v.currency;
  return `<div class="card" style="border-left:4px solid ${v.cpi!=null&&v.cpi<0.95?"#C62828":"#2E7D32"}">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      \u{1F4D0} Earned value
      <span style="margin-left:auto;font-size:10px;color:var(--muted);font-weight:500">
        baseline ${v.baseline.setAt?escapeHtml(fmtDate(v.baseline.setAt.slice(0,10))):"\u2014"}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:10px">
      <div style="background:${cpi.bg};color:${cpi.fg};border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:17px;font-weight:800">${v.cpi==null?"\u2014":v.cpi.toFixed(2)}</div>
        <div style="font-size:10px;font-weight:700">Cost \u00b7 ${escapeHtml(cpi.lb)}</div>
        <div style="font-size:9px;opacity:.85;line-height:1.4;margin-top:2px">${escapeHtml(cpi.note)}</div>
      </div>
      <div style="background:${spi.bg};color:${spi.fg};border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:17px;font-weight:800">${v.spi==null?"\u2014":v.spi.toFixed(2)}</div>
        <div style="font-size:10px;font-weight:700">Schedule \u00b7 ${escapeHtml(spi.lb)}</div>
        <div style="font-size:9px;opacity:.85;line-height:1.4;margin-top:2px">${v.spi==null?"No dates on the baseline":escapeHtml(spi.note)}</div>
      </div>
    </div>
    <table style="border-collapse:collapse;width:100%">
      ${_pfKV("Progress", `${v.pctComplete}%`, `${fmtHM(v.hoursDone)} of ${fmtHM(v.hoursPlanned)} planned`)}
      ${v.schedulePct!=null?_pfKV("Time elapsed", `${v.schedulePct}%`, "of the baseline period"):""}
      ${_pfKV("Budget at completion", curFmt(v.bac,cur), "the agreed value")}
      ${v.pv!=null?_pfKV("Planned value", curFmt(v.pv,cur), "what should have been earned by now"):""}
      ${_pfKV("Earned value", curFmt(v.ev,cur), "progress valued at the baseline rate")}
      ${_pfKV("Actual cost", curFmt(v.ac,cur), "what it has cost so far")}
      ${_pfKV("Cost variance", `${v.cv>=0?"+":""}${curFmt(v.cv,cur)}`, "earned minus spent", v.cv<0?"#C62828":"#2E7D32")}
      ${v.sv!=null?_pfKV("Schedule variance", `${v.sv>=0?"+":""}${curFmt(v.sv,cur)}`, "earned minus planned", v.sv<0?"#C62828":"#2E7D32"):""}
    </table>
    ${v.eac!=null?`<div style="background:${v.vac<0?"#FDECEA":"#E8F5E9"};border-radius:var(--r-md);padding:10px 12px;margin-top:10px">
      <div style="font-size:12px;font-weight:800;color:${v.vac<0?"#C62828":"#2E7D32"}">
        Forecast final cost: ${curFmt(v.eac,cur)}</div>
      <div style="font-size:10.5px;color:var(--muted);line-height:1.7;margin-top:3px">
        At the rate this project is currently consuming budget it finishes
        ${v.vac<0?`<strong style="color:#C62828">${curFmt(Math.abs(v.vac),cur)} over</strong>`
                 :`<strong style="color:#2E7D32">${curFmt(v.vac,cur)} under</strong>`} the agreed value.
        ${v.etc!=null?`A further ${curFmt(v.etc,cur)} is expected to complete it.`:""}
      </div>
    </div>`:""}
    ${isAdmin()?`<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" onclick="baselineSet(${jsArg(projectName)})">Re-baseline</button>
      <button class="btn btn-sm btn-secondary" onclick="baselineClear(${jsArg(projectName)})">Remove baseline</button>
    </div>`:""}
  </div>`;
}

// The footprint card. Stated as a measured estimate with its factors visible,
// because a carbon figure presented as fact — when it is derived from an
// average price per litre — would not survive the first question about it.
function footprintCard(projectName, from, to){
  const f=footprintFor(projectName, from, to);
  if(!f.totalCo2 && !f.partsReplaced) return "";
  return `<div class="card" style="border-left:4px solid #2E7D32">
    <div class="sec-hdr">\u{1F331} Environmental footprint</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px">
      <div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800;color:#2E7D32">${f.tonnes}</div>
        <div style="font-size:10px;color:var(--muted)">tonnes CO\u2082e</div></div>
      <div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800">${f.litres.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--muted)">litres of fuel</div></div>
      <div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800">${f.travelKm.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--muted)">km travelled</div></div>
      ${f.perHour!=null?`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800">${f.perHour}</div>
        <div style="font-size:10px;color:var(--muted)">kg per work hour</div></div>`:""}
      ${f.partsReplaced?`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:800">${f.partsReplaced}</div>
        <div style="font-size:10px;color:var(--muted)">parts replaced</div></div>`:""}
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:9px;line-height:1.7">
      An estimate, not a measurement: fuel spend of ${curFmt(f.fuelSpend,f.currency)} is converted at
      ${escapeHtml(String(f.cfg.litrePrice))} per litre and ${escapeHtml(String(f.cfg.perLitre))} kg CO\u2082e per litre
      (${escapeHtml(String(f.cfg.fuelType))}); travel is counted at ${escapeHtml(String(f.cfg.kmPerTravelDay))} km per day.
      ${isAdmin()?`These factors are editable under Technical Classifications \u2192 Sustainability.`:""}
    </div>
    ${f.unconverted?`<div style="font-size:10px;color:#C62828;margin-top:6px;line-height:1.6">
      ${f.unconverted} fuel entr${f.unconverted===1?"y":"ies"} in another currency carr${f.unconverted===1?"ies":"y"} no rate and ${f.unconverted===1?"is":"are"} excluded.</div>`:""}
  </div>`;
}
Object.assign(window,{evmCard, footprintCard});
