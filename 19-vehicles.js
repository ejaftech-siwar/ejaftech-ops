// ═══════════════════════════════════════════════════════════════════════════
//  19-vehicles.js — FLEET REGISTER & MAINTENANCE (v261)
//
//  Company vehicles, what has been done to them, and what is falling due.
//
//  Two things drive a fleet, and they are not the same thing:
//    · a DATE — the annual registration, the insurance, a booked service;
//    · a DISTANCE — an oil change is due after so many kilometres, whatever
//      the calendar says.
//  A van that sits idle for two months is not due for oil; a van doing airport
//  runs may be due twice in that time. So both are tracked, both raise their
//  own reminder, and whichever arrives first is the one that is shown.
//
//  Costs are recorded per job and per part, in the currency actually paid.
//  USD and IQD are never added together — the same rule that governs every
//  other figure in this application.
// ═══════════════════════════════════════════════════════════════════════════

const VEH_STATUS = [
  {k:"active",   n:"In service",   c:"#2E7D32"},
  {k:"workshop", n:"In workshop",  c:"#E65100"},
  {k:"idle",     n:"Off road",     c:"#5E5E5E"},
  {k:"sold",     n:"Disposed",     c:"#9E9E9E"},
];

// The jobs a light fleet actually books. Free text is still allowed — this
// list exists to stop the same job being spelled four ways across a year.
const VEH_JOB_TYPES = [
  "Oil & filter change", "Engine service", "Brake service", "Tyre replacement",
  "Battery replacement", "Air conditioning", "Suspension", "Electrical",
  "Body repair", "Annual registration", "Insurance renewal", "Inspection",
  "Accident repair", "Other",
];

// How close is close enough to warn. A week of notice on a date, and 500 km on
// a distance, are what make a reminder useful rather than merely accurate.
const VEH_DUE_DAYS = 14;
const VEH_DUE_KM   = 500;

function vehBlank(){
  return {
    name:"", plate:"", make:"", model:"", year:"",
    licenceNo:"", licenceExpiry:"", registrationNo:"", registrationExpiry:"",
    insuranceNo:"", insuranceExpiry:"",
    driver:"", branch:"", department:"", status:"active",
    odometer:"", odometerDate:"",
    oilLastKm:"", oilLastDate:"", oilIntervalKm:"5000",
    nextServiceDate:"", nextServiceNote:"",
    notes:"",
  };
}

function vehJobBlank(){
  return {
    vehicleId:"", date:"", jobType:"", description:"",
    odometer:"", supplier:"", invoiceNo:"",
    parts:[],                        // [{name, qty, unitPrice, currency}]
    labourUsd:"", labourIqd:"",
    nextDueDate:"", nextDueKm:"",
    notes:"",
  };
}

// ── money ───────────────────────────────────────────────────────────────
// Every total is a PAIR. There is no blended figure anywhere in this module,
// because there is no honest exchange rate to blend with.
function vehNum(v){
  const x = Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, ""));
  return isFinite(x) ? x : 0;
}
function vehJobCost(job){
  let usd = vehNum(job && job.labourUsd), iqd = vehNum(job && job.labourIqd);
  ((job && job.parts) || []).forEach(p => {
    const line = vehNum(p.qty || 1) * vehNum(p.unitPrice);
    if(String(p.currency || "USD").toUpperCase() === "IQD") iqd += line; else usd += line;
  });
  return {usd, iqd};
}
function vehTotals(jobs){
  return (jobs || []).reduce((t, j) => {
    const c = vehJobCost(j);
    t.usd += c.usd; t.iqd += c.iqd; t.count++;
    return t;
  }, {usd:0, iqd:0, count:0});
}
function vehMoney(usd, iqd){
  const bits = [];
  if(usd) bits.push("USD " + Math.round(usd).toLocaleString());
  if(iqd) bits.push("IQD " + Math.round(iqd).toLocaleString());
  return bits.join("  +  ");
}

// ── due dates and due distances ─────────────────────────────────────────
function vehDaysUntil(dateStr){
  if(!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if(isNaN(d)) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}

// The oil position, expressed the way a driver thinks about it: how far is
// left, not what the odometer read last time.
function vehOil(v){
  const interval = vehNum(v.oilIntervalKm) || 5000;
  const last = vehNum(v.oilLastKm);
  const now  = vehNum(v.odometer);
  if(!last && !now) return {due:null, remaining:null, interval, nextAtKm:null};
  const nextAtKm = last + interval;
  const remaining = nextAtKm - now;
  return {
    interval, nextAtKm, remaining,
    due: remaining <= 0 ? "over" : (remaining <= VEH_DUE_KM ? "soon" : "ok"),
  };
}

// Everything falling due on one vehicle, worst first, so a list can show the
// single most urgent thing without the reader assembling it themselves.
function vehAlerts(v){
  const out = [];
  const dateItem = (label, dateStr) => {
    const d = vehDaysUntil(dateStr);
    if(d == null) return;
    if(d < 0)               out.push({sev:"over", label, text:`${label} expired ${Math.abs(d)} day${Math.abs(d)===1?"":"s"} ago`, days:d});
    else if(d <= VEH_DUE_DAYS) out.push({sev:"soon", label, text:`${label} due in ${d} day${d===1?"":"s"}`, days:d});
  };
  dateItem("Licence",        v.licenceExpiry);
  dateItem("Registration",   v.registrationExpiry);
  dateItem("Insurance",      v.insuranceExpiry);
  dateItem("Service",        v.nextServiceDate);

  const oil = vehOil(v);
  if(oil.due === "over")      out.push({sev:"over", label:"Oil change", text:`Oil change overdue by ${Math.abs(Math.round(oil.remaining)).toLocaleString()} km`, days:-1});
  else if(oil.due === "soon") out.push({sev:"soon", label:"Oil change", text:`Oil change due in ${Math.round(oil.remaining).toLocaleString()} km`, days:1});

  return out.sort((a,b) => (a.sev === b.sev ? (a.days||0) - (b.days||0) : (a.sev === "over" ? -1 : 1)));
}

function vehJobsFor(id){
  return (state.vehicleJobs || []).filter(j => j.vehicleId === id)
    .slice().sort((a,b) => String(b.date||"").localeCompare(String(a.date||"")));
}
function vehById(id){ return (state.vehicles || []).find(v => v.id === id) || null; }
function vehLabel(v){
  if(!v) return "";
  return [v.name, v.plate].filter(Boolean).join(" \u00b7 ") || v.plate || v.name || "Vehicle";
}

// Fleet-wide, for the dashboard strip and the report header.
function vehFleetAlerts(){
  const out = [];
  (state.vehicles || []).forEach(v => {
    if(v.status === "sold") return;          // a disposed vehicle owes nothing
    vehAlerts(v).forEach(a => out.push(Object.assign({vehicle:v}, a)));
  });
  return out.sort((a,b) => (a.sev === b.sev ? (a.days||0) - (b.days||0) : (a.sev === "over" ? -1 : 1)));
}

Object.assign(window, {VEH_STATUS, VEH_JOB_TYPES, VEH_DUE_DAYS, VEH_DUE_KM,
  vehBlank, vehJobBlank, vehNum, vehJobCost, vehTotals, vehMoney,
  vehDaysUntil, vehOil, vehAlerts, vehJobsFor, vehById, vehLabel, vehFleetAlerts});

// ═══ EDITING ═══════════════════════════════════════════════════════════════
window._veh      = window._veh      || vehBlank();
window._vehId    = window._vehId    || null;
window._vehView  = window._vehView  || "list";      // list | edit | jobs
window._vehJob   = window._vehJob   || vehJobBlank();
window._vehJobId = window._vehJobId || null;
window._vehFocus = window._vehFocus || null;        // vehicle whose history is open

window.vehSet = function(k, v){ window._veh[k] = v; };
window.vehNew = function(){ window._veh = vehBlank(); window._vehId = null; window._vehView = "edit"; render(); };
window.vehEdit = function(id){
  const v = vehById(id); if(!v) return;
  window._veh = Object.assign(vehBlank(), v);
  window._vehId = id; window._vehView = "edit"; render();
};
window.vehCancel = function(){ window._vehView = "list"; window._vehId = null; render(); };

window.vehSave = async function(){
  const v = window._veh;
  if(!String(v.name || "").trim() && !String(v.plate || "").trim())
    return toast("\u26a0 Give the vehicle a name or a plate number");
  const rec = Object.assign({}, v);
  if(window._vehId) rec.id = window._vehId;
  try{
    await fbSave("vehicles", rec);
    window._vehView = "list"; window._vehId = null; window._veh = vehBlank();
    render(); toast("Vehicle saved \u2713");
  }catch(e){ toast("Could not save the vehicle"); }
};

window.vehDelete = async function(id){
  const v = vehById(id); if(!v) return;
  const n = vehJobsFor(id).length;
  if(!confirm(`Delete ${vehLabel(v)}?${n ? `\n\n${n} maintenance record${n===1?"":"s"} will be kept, but will no longer name a vehicle.` : ""}`)) return;
  try{ await fbDelete("vehicles", id); render(); toast("Vehicle deleted"); }
  catch(e){ toast("Could not delete that vehicle"); }
};

// ── maintenance jobs ────────────────────────────────────────────────────
window.vehJobSet = function(k, v){ window._vehJob[k] = v; };
window.vehJobNew = function(vehicleId){
  window._vehJob = vehJobBlank();
  window._vehJob.vehicleId = vehicleId || "";
  window._vehJob.date = (typeof todayStr === "function") ? todayStr() : "";
  const v = vehById(vehicleId);
  if(v) window._vehJob.odometer = v.odometer || "";
  window._vehJobId = null; window._vehView = "job"; render();
};
window.vehJobEdit = function(id){
  const j = (state.vehicleJobs || []).find(x => x.id === id); if(!j) return;
  window._vehJob = Object.assign(vehJobBlank(), j, {parts:(j.parts || []).map(p => Object.assign({}, p))});
  window._vehJobId = id; window._vehView = "job"; render();
};
window.vehJobCancel = function(){ window._vehView = window._vehFocus ? "jobs" : "list"; window._vehJobId = null; render(); };

window.vehPartAdd = function(){ window._vehJob.parts.push({name:"", qty:"1", unitPrice:"", currency:"USD"}); render(); };
window.vehPartDel = function(i){ window._vehJob.parts.splice(i, 1); render(); };
window.vehPartSet = function(i, k, v){ if(window._vehJob.parts[i]) window._vehJob.parts[i][k] = v; };

window.vehJobSave = async function(){
  const j = window._vehJob;
  if(!j.vehicleId) return toast("\u26a0 Choose the vehicle");
  if(!j.date)      return toast("\u26a0 Enter the date of the work");
  const rec = Object.assign({}, j, {parts:(j.parts || []).filter(p => String(p.name || "").trim())});
  if(window._vehJobId) rec.id = window._vehJobId;
  try{
    await fbSave("vehicleJobs", rec);
    // Recording an oil change moves the vehicle's oil baseline forward. Doing
    // it here rather than asking again is the whole point of recording it: the
    // next reminder is computed from what was actually done.
    const veh = vehById(j.vehicleId);
    if(veh){
      const upd = Object.assign({}, veh);
      let touched = false;
      if(vehNum(j.odometer) > vehNum(veh.odometer)){
        upd.odometer = j.odometer; upd.odometerDate = j.date; touched = true;
      }
      if(/oil/i.test(j.jobType || "") && vehNum(j.odometer)){
        upd.oilLastKm = j.odometer; upd.oilLastDate = j.date; touched = true;
      }
      if(j.nextDueDate){ upd.nextServiceDate = j.nextDueDate; upd.nextServiceNote = j.jobType || ""; touched = true; }
      if(touched){ try{ await fbSave("vehicles", upd); }catch(e){} }
    }
    window._vehJobId = null; window._vehJob = vehJobBlank();
    window._vehView = window._vehFocus ? "jobs" : "list";
    render(); toast("Maintenance record saved \u2713");
  }catch(e){ toast("Could not save that record"); }
};

window.vehJobDelete = async function(id){
  if(!confirm("Delete this maintenance record? This cannot be undone.")) return;
  try{ await fbDelete("vehicleJobs", id); render(); toast("Record deleted"); }
  catch(e){ toast("Could not delete that record"); }
};

window.vehOpenJobs = function(id){ window._vehFocus = id; window._vehView = "jobs"; render(); };
window.vehBackToList = function(){ window._vehFocus = null; window._vehView = "list"; render(); };

// ═══ SCREENS ═══════════════════════════════════════════════════════════════
function _vehBadge(text, bg, fg){
  return `<span style="background:${bg};color:${fg};border-radius:20px;padding:2px 9px;font-size:10.5px;font-weight:700;white-space:nowrap">${escapeHtml(text)}</span>`;
}
function _vehAlertPill(a){
  const over = a.sev === "over";
  return _vehBadge(a.text, over ? "#FDECEA" : "#FFF3E0", over ? "#C62828" : "#E65100");
}
function _vehSel(label, val, opts, onchange, extra){
  return `<div class="field"><label>${escapeHtml(label)}</label>
    <select class="input" onchange="${onchange}">
      <option value="">\u2014 choose \u2014</option>
      ${(opts||[]).map(o => `<option ${val===o?"selected":""}>${escapeHtml(o)}</option>`).join("")}
    </select>${extra||""}</div>`;
}

// ═══ FLEET WORKING TOOLS (v262) ══════════════════════════════════════
// A register of five vehicles reads fine as a plain list. A register of thirty
// does not: finding one van means scrolling past twenty-nine, and the two that
// are overdue are indistinguishable from the rest until you read every card.
// Search, filter and a fleet summary are what turn the list into a tool.
window._vehQ      = window._vehQ      || "";   // search text
window._vehFilter = window._vehFilter || "all";// all | due | over | active | inactive
window.vehSearch  = function(q){
  window._vehQ = q || "";
  // Repaint the list ALONE. Rebuilding the tab would take the caret out of the
  // search box on the first keystroke, which makes the box unusable.
  const el = document.getElementById("vehListBody");
  if(el) el.innerHTML = vehListBodyHTML(); else render();
};
window.vehSetFilter = function(f){ window._vehFilter = f || "all"; render(); };

// One place decides which vehicles are on screen, so the count in the header
// and the cards below it can never disagree.
function vehVisible(){
  const q = String(window._vehQ||"").trim().toLowerCase();
  const f = window._vehFilter || "all";
  return (state.vehicles || []).slice()
    .filter(v => {
      if(q){
        const hay = [v.name,v.plate,v.make,v.model,v.year,v.driver,v.licenceNo,v.notes]
          .filter(Boolean).join(" ").toLowerCase();
        if(hay.indexOf(q) < 0) return false;
      }
      if(f === "all") return true;
      if(f === "active")   return (v.status||"active") === "active";
      if(f === "inactive") return (v.status||"active") !== "active";
      const al = vehAlerts(v);
      if(f === "over") return al.some(a => a.sev === "over");
      if(f === "due")  return al.length > 0;
      return true;
    })
    .sort((a,b) => {
      // Anything overdue rises to the top: the list should answer "what needs
      // me today" before it answers "what do we own".
      const sev = x => { const al = vehAlerts(x);
        return al.some(a=>a.sev==="over") ? 0 : al.length ? 1 : 2; };
      const d = sev(a) - sev(b);
      if(d) return d;
      return String(a.name||a.plate||"").localeCompare(String(b.name||b.plate||""));
    });
}

// Fleet-wide numbers, so the manager sees the shape of the fleet before the detail.
function vehFleetSummary(){
  const all = state.vehicles || [];
  const jobs = state.vehicleJobs || [];
  let usd = 0, iqd = 0;
  jobs.forEach(j => { const c = vehJobCost(j); usd += c.usd || 0; iqd += c.iqd || 0; });
  const alerts = vehFleetAlerts();
  return {
    count: all.length,
    active: all.filter(v => (v.status||"active") === "active").length,
    over: alerts.filter(a => a.sev === "over").length,
    soon: alerts.filter(a => a.sev === "soon").length,
    jobs: jobs.length, usd, iqd,
  };
}

function vehFilterPills(){
  const s = vehFleetSummary();
  const f = window._vehFilter || "all";
  const pill = (k, label, n, colour) => `<button type="button" class="btn btn-sm"
    onclick="vehSetFilter(${jsArg(k)})"
    style="background:${f===k?(colour||"#1B3A6B"):"var(--card)"};color:${f===k?"#fff":"var(--fg)"};border:1px solid ${f===k?(colour||"#1B3A6B"):"var(--line)"};font-weight:${f===k?"700":"400"}">${escapeHtml(label)}${n!=null?` (${n})`:""}</button>`;
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
    ${pill("all","All", s.count)}
    ${s.over ? pill("over","Overdue", s.over, "#C62828") : ""}
    ${(s.over+s.soon) ? pill("due","Needs attention", s.over+s.soon, "#E65100") : ""}
    ${pill("active","In service", s.active)}
    ${s.count-s.active ? pill("inactive","Off road", s.count-s.active, "#5E5E5E") : ""}
  </div>`;
}

function renderVehicleList(){
  const sum = vehFleetSummary();
  const fleet = vehFleetAlerts();
  const over = fleet.filter(a => a.sev === "over").length;
  const soon = fleet.filter(a => a.sev === "soon").length;

  return `${_rptHero("\u{1F697}","Vehicles","Fleet register, maintenance history and what is falling due",
      "linear-gradient(135deg,#12324F 0%,#1B4F72 60%,#2874A6 100%)")}

  ${fleet.length ? `<div class="card" style="border:2px solid ${over?"#C62828":"#E65100"}">
    <div class="card-title">\u23F0 Falling due ${over?`<span style="color:#C62828">\u00b7 ${over} overdue</span>`:""}${soon?`<span style="color:#E65100"> \u00b7 ${soon} soon</span>`:""}</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
      ${fleet.slice(0,8).map(a => `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
        <span style="flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(vehLabel(a.vehicle))}</span>
        ${_vehAlertPill(a)}
        <button class="btn btn-sm btn-secondary" onclick="vehOpenJobs(${jsArg(a.vehicle.id)})">Open</button>
      </div>`).join("")}
      ${fleet.length>8 ? `<div style="font-size:11px;color:var(--muted)">and ${fleet.length-8} more\u2026</div>` : ""}
    </div>
  </div>` : ""}

  <div class="card">
    <div class="card-title" style="display:flex;align-items:center;gap:8px">
      \u{1F697} Fleet <span style="font-weight:400;color:var(--muted)">(${sum.count})</span>
      <button class="btn btn-sm btn-primary" style="margin-inline-start:auto;background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="vehNew()">+ Add vehicle</button>
    </div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--muted);margin-top:4px">
      <span>\u{1F527} ${sum.jobs} job${sum.jobs===1?"":"s"} recorded</span>
      ${(sum.usd||sum.iqd) ? `<span>\u{1F4B0} spent to date <strong style="color:var(--fg)">${escapeHtml(vehMoney(sum.usd, sum.iqd))}</strong></span>` : ""}
    </div>
    <input class="input" style="margin-top:9px" placeholder="\u{1F50D} Search by name, plate, driver or model\u2026"
           value="${escapeHtml(window._vehQ||"")}" oninput="vehSearch(this.value)">
    ${vehFilterPills()}
    <div id="vehListBody">${vehListBodyHTML()}</div>
  </div>`;
}

// The cards alone. Kept apart from the surrounding card so that typing in the
// search box redraws THIS and nothing else — the box keeps focus and the
// caret stays where the person left it.
function vehListBodyHTML(){
  const rows = vehVisible();
  const total = (state.vehicles||[]).length;
  if(!total) return `<div style="color:var(--muted);font-size:13px;margin-top:8px">No vehicles yet. Add the first one above.</div>`;
  if(!rows.length) return `<div style="color:var(--muted);font-size:13px;margin-top:8px">Nothing matches that search or filter.</div>`;
  return `${`<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
      ${rows.map(v => {
        const st = VEH_STATUS.find(s => s.k === v.status) || VEH_STATUS[0];
        const al = vehAlerts(v);
        const oil = vehOil(v);
        const jobs = vehJobsFor(v.id);
        const tot = vehTotals(jobs);
        return `<div style="border:1px solid ${al.some(a=>a.sev==="over")?"#C62828":"var(--line)"};border-radius:12px;padding:10px 12px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:800;font-size:14px">${escapeHtml(v.name || v.plate || "Vehicle")}</span>
            ${v.plate ? _vehBadge(v.plate, "#E3F2FD", "#1565C0") : ""}
            ${_vehBadge(st.n, "#F1F1F1", st.c)}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">
            ${[v.make, v.model, v.year].filter(Boolean).map(escapeHtml).join(" \u00b7 ")}
            ${v.driver ? ` \u00b7 \u{1F464} ${escapeHtml(v.driver)}` : ""}
          </div>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;margin-top:6px">
            ${v.odometer ? `<span>\u{1F6E3}\uFE0F ${vehNum(v.odometer).toLocaleString()} km</span>` : ""}
            ${oil.remaining != null ? `<span style="color:${oil.due==="over"?"#C62828":oil.due==="soon"?"#E65100":"var(--muted)"}">\u{1F6E2}\uFE0F ${oil.remaining>0?`${Math.round(oil.remaining).toLocaleString()} km to oil`:`oil overdue ${Math.abs(Math.round(oil.remaining)).toLocaleString()} km`}</span>` : ""}
            ${jobs.length ? `<span>\u{1F527} ${jobs.length} job${jobs.length===1?"":"s"}</span>` : ""}
            ${(tot.usd||tot.iqd) ? `<span style="font-weight:700">${escapeHtml(vehMoney(tot.usd, tot.iqd))}</span>` : ""}
          </div>
          ${al.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">${al.slice(0,3).map(_vehAlertPill).join("")}</div>` : ""}
          <div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap">
            <button class="btn btn-sm btn-secondary" onclick="vehOpenJobs(${jsArg(v.id)})">\u{1F527} Maintenance (${jobs.length})</button>
            <button class="btn btn-sm btn-secondary" onclick="vehJobNew(${jsArg(v.id)})">+ Record work</button>
            <button class="btn btn-sm btn-secondary" onclick="vehEdit(${jsArg(v.id)})">Edit</button>
            <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="vehDelete(${jsArg(v.id)})">Delete</button>
          </div>
        </div>`;
      }).join("")}
    </div>`}`;
}

function renderVehicleEdit(){
  const v = window._veh;
  const people = (typeof allEmployees === "function") ? allEmployees() : [];
  const branches = (state.branches || []).map(b => b.name).filter(Boolean);
  const depts = (state.departments || []).map(d => d.name).filter(Boolean);
  const oil = vehOil(v);
  const F = (label, key, type, ph) => `<div class="field"><label>${escapeHtml(label)}</label>
    <input class="input" ${type?`type="${type}"`:""} ${type==="number"?'inputmode="numeric"':""}
      value="${escapeHtml(v[key]||"")}" oninput="vehSet(${jsArg(key)},this.value)"
      ${ph?`placeholder="${escapeHtml(ph)}"`:""}></div>`;

  return `${_rptHero("\u{1F697}", window._vehId ? "Edit vehicle" : "New vehicle",
      "Identity, papers, and the two clocks that drive its reminders",
      "linear-gradient(135deg,#12324F 0%,#1B4F72 60%,#2874A6 100%)")}

  <div class="card">
    <div class="card-title">Identity</div>
    <div class="grid2">
      ${F("Vehicle name", "name", "", "e.g. Hilux \u2014 Team A")}
      ${F("Plate number", "plate", "", "e.g. 21 A 12345")}
      ${F("Make", "make", "", "Toyota")}
      ${F("Model", "model", "", "Hilux")}
      ${F("Year", "year", "", "2021")}
      <div class="field"><label>Status</label>
        <select class="input" onchange="vehSet('status',this.value);render()">
          ${VEH_STATUS.map(s => `<option value="${s.k}" ${v.status===s.k?"selected":""}>${escapeHtml(s.n)}</option>`).join("")}
        </select></div>
      ${_vehSel("Assigned driver", v.driver, people, "vehSet('driver',this.value)")}
      ${_vehSel("Branch", v.branch, branches, "vehSet('branch',this.value)")}
      ${_vehSel("Department", v.department, depts, "vehSet('department',this.value)")}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Papers</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
      Each expiry date raises its own reminder ${VEH_DUE_DAYS} days ahead, and keeps raising it once it has passed.
    </div>
    <div class="grid2">
      ${F("Licence number", "licenceNo")}
      ${F("Licence expiry", "licenceExpiry", "date")}
      ${F("Annual registration number", "registrationNo")}
      ${F("Registration expiry", "registrationExpiry", "date")}
      ${F("Insurance policy number", "insuranceNo")}
      ${F("Insurance expiry", "insuranceExpiry", "date")}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Odometer & oil</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
      Oil is due on DISTANCE, not on the calendar. Record the reading at the last change and how far it runs between changes; the reminder is worked out from there and moves forward on its own each time an oil change is recorded.
    </div>
    <div class="grid2">
      ${F("Current odometer (km)", "odometer", "number")}
      ${F("Reading taken on", "odometerDate", "date")}
      ${F("Odometer at last oil change", "oilLastKm", "number")}
      ${F("Last oil change on", "oilLastDate", "date")}
      ${F("Change oil every (km)", "oilIntervalKm", "number")}
    </div>
    ${oil.remaining != null ? `<div style="margin-top:8px;padding:9px 12px;border-radius:10px;background:${oil.due==="over"?"rgba(198,40,40,.10)":oil.due==="soon"?"rgba(230,81,0,.10)":"rgba(46,125,50,.08)"};border:1px solid ${oil.due==="over"?"#C62828":oil.due==="soon"?"#E65100":"#2E7D32"};font-size:12px;font-weight:700;color:${oil.due==="over"?"#C62828":oil.due==="soon"?"#E65100":"#2E7D32"}">
      ${oil.remaining > 0
        ? `Next oil change at ${Math.round(oil.nextAtKm).toLocaleString()} km \u2014 ${Math.round(oil.remaining).toLocaleString()} km to go`
        : `Oil change overdue by ${Math.abs(Math.round(oil.remaining)).toLocaleString()} km`}
    </div>` : ""}
  </div>

  <div class="card">
    <div class="card-title">Next booked service</div>
    <div class="grid2">
      ${F("Date", "nextServiceDate", "date")}
      ${F("What for", "nextServiceNote", "", "e.g. 20,000 km service")}
    </div>
    <div class="field full" style="margin-top:8px"><label>Notes</label>
      <textarea rows="3" oninput="vehSet('notes',this.value)" placeholder="Anything worth knowing about this vehicle">${escapeHtml(v.notes||"")}</textarea></div>
  </div>

  <div class="card">
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="background:#2E7D32;color:#fff;border:none;font-weight:700" onclick="vehSave()">\u{1F4BE} Save vehicle</button>
      <button class="btn btn-secondary" onclick="vehCancel()">Cancel</button>
    </div>
  </div>`;
}

function renderVehicleJobs(){
  const v = vehById(window._vehFocus);
  if(!v){ window._vehView = "list"; return renderVehicleList(); }
  const jobs = vehJobsFor(v.id);
  const tot = vehTotals(jobs);
  const al = vehAlerts(v);

  const oil = vehOil(v);
  const last = jobs.length ? jobs[0] : null;
  // Cost per kilometre is the number that tells a manager whether a vehicle is
  // worth keeping. It needs a distance travelled, so it appears only once the
  // odometer has moved since the first recorded job.
  const kmSpan = (()=>{
    const odos = jobs.map(j=>vehNum(j.odometer)).filter(x=>x>0);
    if(odos.length < 2) return 0;
    return Math.max(...odos) - Math.min(...odos);
  })();
  const perKm = kmSpan > 0 && tot.usd ? (tot.usd / kmSpan) : 0;

  return `${_rptHero("\u{1F527}", vehLabel(v), "Maintenance history",
      "linear-gradient(135deg,#12324F 0%,#1B4F72 60%,#2874A6 100%)")}

  <div class="card">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-sm btn-secondary" onclick="vehBackToList()">\u2190 Fleet</button>
      <button class="btn btn-sm btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="vehJobNew(${jsArg(v.id)})">+ Record work</button>
      <button class="btn btn-sm btn-secondary" onclick="vehEdit(${jsArg(v.id)})">Edit vehicle</button>
    </div>
    ${al.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">${al.map(_vehAlertPill).join("")}</div>` : ""}
  </div>

  <div class="card">
    <div class="card-title">\u{1F4CB} At a glance</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
      ${[
        v.odometer ? ["Odometer", vehNum(v.odometer).toLocaleString()+" km", ""] : null,
        oil.remaining != null
          ? ["Next oil change",
             oil.remaining > 0 ? Math.round(oil.remaining).toLocaleString()+" km" : "overdue",
             oil.due==="over" ? "#C62828" : oil.due==="soon" ? "#E65100" : "#2E7D32"]
          : null,
        oil.nextAtKm ? ["Due at", vehNum(oil.nextAtKm).toLocaleString()+" km", ""] : null,
        last && last.date ? ["Last work", fmtDate(last.date), ""] : null,
        ["Jobs", String(tot.count), ""],
        (tot.usd||tot.iqd) ? ["Spent to date", vehMoney(tot.usd, tot.iqd), ""] : null,
        perKm ? ["Cost per km", "USD " + perKm.toFixed(3), ""] : null,
      ].filter(Boolean).map(([lb,val,col])=>`
        <div style="flex:1;min-width:118px;border:1px solid var(--line);border-radius:10px;padding:9px 10px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">${escapeHtml(lb)}</div>
          <div style="font-size:15px;font-weight:800;margin-top:2px;${col?`color:${col}`:""}">${escapeHtml(val)}</div>
        </div>`).join("")}
    </div>
    ${perKm ? `<div style="font-size:10px;color:var(--muted);margin-top:7px">Cost per km is USD spend over the ${kmSpan.toLocaleString()} km between the first and last recorded job. IQD costs are excluded from it, because the two currencies are never merged.</div>` : ""}
  </div>

  ${jobs.length ? jobs.map(j => {
    const c = vehJobCost(j);
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-weight:800">${escapeHtml(j.jobType || "Maintenance")}</span>
        ${_vehBadge(j.date ? fmtDate(j.date) : "no date", "#E3F2FD", "#1565C0")}
        ${j.odometer ? _vehBadge(vehNum(j.odometer).toLocaleString() + " km", "#F1F1F1", "#555") : ""}
        <span style="margin-inline-start:auto;font-weight:700">${escapeHtml(vehMoney(c.usd, c.iqd))}</span>
      </div>
      ${j.description ? `<div style="font-size:12px;margin-top:5px;line-height:1.6">${escapeHtml(j.description)}</div>` : ""}
      ${(j.parts||[]).length ? `<div style="overflow-x:auto;margin-top:7px"><table class="tbl" style="font-size:11px">
        <thead><tr><th>Part</th><th>Qty</th><th>Unit</th><th>Line</th></tr></thead>
        <tbody>${j.parts.map(p => `<tr>
          <td>${escapeHtml(p.name||"")}</td><td>${escapeHtml(String(p.qty||""))}</td>
          <td>${escapeHtml(String(p.currency||"USD"))} ${vehNum(p.unitPrice).toLocaleString()}</td>
          <td>${escapeHtml(String(p.currency||"USD"))} ${(vehNum(p.qty||1)*vehNum(p.unitPrice)).toLocaleString()}</td>
        </tr>`).join("")}</tbody></table></div>` : ""}
      <div style="font-size:11px;color:var(--muted);margin-top:6px">
        ${j.supplier ? `\u{1F3EA} ${escapeHtml(j.supplier)}` : ""}
        ${j.invoiceNo ? ` \u00b7 Invoice ${escapeHtml(j.invoiceNo)}` : ""}
        ${j.nextDueDate ? ` \u00b7 Next: ${fmtDate(j.nextDueDate)}` : ""}
        ${j.nextDueKm ? ` \u00b7 or at ${vehNum(j.nextDueKm).toLocaleString()} km` : ""}
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-sm btn-secondary" onclick="vehJobEdit(${jsArg(j.id)})">Edit</button>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="vehJobDelete(${jsArg(j.id)})">Delete</button>
      </div>
    </div>`;
  }).join("") : `<div class="card"><div style="color:var(--muted);font-size:13px">No maintenance recorded for this vehicle yet.</div></div>`}`;
}

function renderVehicleJobEdit(){
  const j = window._vehJob;
  const c = vehJobCost(j);
  const vehicles = (state.vehicles || []);
  return `${_rptHero("\u{1F527}", window._vehJobId ? "Edit maintenance record" : "Record maintenance",
      "What was done, what it cost, and when it comes round again",
      "linear-gradient(135deg,#12324F 0%,#1B4F72 60%,#2874A6 100%)")}

  <div class="card">
    <div class="card-title">The job</div>
    <div class="grid2">
      <div class="field"><label>Vehicle</label>
        <select class="input" onchange="vehJobSet('vehicleId',this.value);render()">
          <option value="">\u2014 choose \u2014</option>
          ${vehicles.map(v => `<option value="${escapeHtml(v.id)}" ${j.vehicleId===v.id?"selected":""}>${escapeHtml(vehLabel(v))}</option>`).join("")}
        </select></div>
      <div class="field"><label>Date</label>
        <input class="input" type="date" value="${escapeHtml(j.date||"")}" oninput="vehJobSet('date',this.value)"></div>
      <div class="field"><label>Type of work</label>
        <input class="input" list="veh_job_types" value="${escapeHtml(j.jobType||"")}"
               oninput="vehJobSet('jobType',this.value)" placeholder="Type or choose">
        <datalist id="veh_job_types">${VEH_JOB_TYPES.map(t => `<option value="${escapeHtml(t)}">`).join("")}</datalist></div>
      <div class="field"><label>Odometer at the time (km)</label>
        <input class="input" inputmode="numeric" value="${escapeHtml(j.odometer||"")}" oninput="vehJobSet('odometer',this.value)"></div>
      <div class="field"><label>Workshop / supplier</label>
        <input class="input" value="${escapeHtml(j.supplier||"")}" oninput="vehJobSet('supplier',this.value)"></div>
      <div class="field"><label>Invoice number</label>
        <input class="input" value="${escapeHtml(j.invoiceNo||"")}" oninput="vehJobSet('invoiceNo',this.value)"></div>
      <div class="field full"><label>What was done</label>
        <textarea rows="3" oninput="vehJobSet('description',this.value)" placeholder="Describe the work">${escapeHtml(j.description||"")}</textarea></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title" style="display:flex;align-items:center;gap:8px">
      Parts replaced
      <button class="btn btn-sm btn-secondary" style="margin-inline-start:auto" onclick="vehPartAdd()">+ Add part</button>
    </div>
    ${(j.parts||[]).length ? `<div style="overflow-x:auto"><table class="tbl" style="min-width:520px">
      <thead><tr><th>Part</th><th>Qty</th><th>Unit price</th><th>Currency</th><th></th></tr></thead>
      <tbody>${j.parts.map((p,i) => `<tr>
        <td><input class="input" value="${escapeHtml(p.name||"")}" onchange="vehPartSet(${i},'name',this.value)"></td>
        <td><input class="input" inputmode="decimal" value="${escapeHtml(String(p.qty||""))}" onchange="vehPartSet(${i},'qty',this.value);render()"></td>
        <td><input class="input" inputmode="decimal" value="${escapeHtml(String(p.unitPrice||""))}" onchange="vehPartSet(${i},'unitPrice',this.value);render()"></td>
        <td><select class="input" onchange="vehPartSet(${i},'currency',this.value);render()">
          ${["USD","IQD"].map(cu => `<option ${String(p.currency||"USD")===cu?"selected":""}>${cu}</option>`).join("")}</select></td>
        <td><button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="vehPartDel(${i})">\u00d7</button></td>
      </tr>`).join("")}</tbody></table></div>`
      : `<div style="color:var(--muted);font-size:13px">No parts recorded.</div>`}
    <div class="grid2" style="margin-top:10px">
      <div class="field"><label>Labour (USD)</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(j.labourUsd||"")}" oninput="vehJobSet('labourUsd',this.value)" onchange="render()"></div>
      <div class="field"><label>Labour (IQD)</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(j.labourIqd||"")}" oninput="vehJobSet('labourIqd',this.value)" onchange="render()"></div>
    </div>
    ${(c.usd||c.iqd) ? `<div style="margin-top:9px;padding:9px 12px;border-radius:10px;background:rgba(46,125,50,.08);border:1px solid #2E7D32;font-size:13px;font-weight:800;color:#2E7D32">
      Total: ${escapeHtml(vehMoney(c.usd, c.iqd))}
    </div>
    <div style="font-size:10.5px;color:var(--muted);margin-top:4px">USD and IQD are kept apart. There is no blended figure, because there is no honest rate to blend with.</div>` : ""}
  </div>

  <div class="card">
    <div class="card-title">When it comes round again</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
      Either or both. Whichever arrives first is the one that raises the reminder.
    </div>
    <div class="grid2">
      <div class="field"><label>Next due on</label>
        <input class="input" type="date" value="${escapeHtml(j.nextDueDate||"")}" oninput="vehJobSet('nextDueDate',this.value)"></div>
      <div class="field"><label>Or at odometer (km)</label>
        <input class="input" inputmode="numeric" value="${escapeHtml(j.nextDueKm||"")}" oninput="vehJobSet('nextDueKm',this.value)"></div>
    </div>
  </div>

  <div class="card">
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="background:#2E7D32;color:#fff;border:none;font-weight:700" onclick="vehJobSave()">\u{1F4BE} Save record</button>
      <button class="btn btn-secondary" onclick="vehJobCancel()">Cancel</button>
    </div>
  </div>`;
}

function renderVehicles(){
  if(!(isAdmin() || isHR() || hasCap("canFinance") || hasCap("canAssets")))
    return `<div class="card"><div class="empty">No access.</div></div>`;
  const v = window._vehView;
  if(v === "edit") return renderVehicleEdit();
  if(v === "job")  return renderVehicleJobEdit();
  if(v === "jobs") return renderVehicleJobs();
  return renderVehicleList();
}
Object.assign(window, {renderVehicles, renderVehicleList, renderVehicleEdit,
  renderVehicleJobs, renderVehicleJobEdit});

// ═══════════════════════════════════════════════════════════════════════════
//  VEHICLE MAINTENANCE REPORT  (Finance Report → Vehicles)
//
//  Built on the same machinery as every other report in this application:
//  its own document series (VEH), the document-number override, the branding
//  link, the PDF / Word / Excel toggle, signatures, and the rule that anything
//  left blank is left out of the finished document.
// ═══════════════════════════════════════════════════════════════════════════
window._vr = window._vr || {
  from:"", to:"", vehicleId:"", jobType:"",
  preparedBy:"", preparedByOther:false, approvedBy:"", approvedByOther:false,
  notes:"", groupBy:"vehicle",          // vehicle | type
};
window.vrSet = function(k,v){ window._vr[k]=v; render(); };

// Jobs inside the reporting window, honouring the filters.
function vrJobs(){
  const f = window._vr;
  return (state.vehicleJobs || []).filter(j => {
    if(f.vehicleId && j.vehicleId !== f.vehicleId) return false;
    if(f.jobType && String(j.jobType||"") !== f.jobType) return false;
    const d = String(j.date || "");
    if(f.from && d < f.from) return false;
    if(f.to   && d > f.to)   return false;
    return true;
  }).sort((a,b) => String(a.date||"").localeCompare(String(b.date||"")));
}

function renderVehicleReport(){
  const f = window._vr;
  const jobs = vrJobs();
  const tot = vehTotals(jobs);
  const everyone = Array.from(new Set((state.users||[]).map(u=>(u.employeeName||u.name||"").trim())
    .filter(Boolean).concat(typeof allEmployees==="function"?allEmployees():[]))).sort();

  // Per-vehicle summary, so the reader sees where the money went before the detail
  const byVeh = {};
  jobs.forEach(j => {
    const k = j.vehicleId || "_none";
    (byVeh[k] = byVeh[k] || {jobs:[], usd:0, iqd:0});
    const c = vehJobCost(j);
    byVeh[k].jobs.push(j); byVeh[k].usd += c.usd; byVeh[k].iqd += c.iqd;
  });

  return `${_rptHero("\u{1F697}","Vehicle Maintenance Report",
      "What was done to the fleet, on what, and what it cost",
      "linear-gradient(135deg,#12324F 0%,#1B4F72 60%,#2874A6 100%)")}

  <div class="card">
    <div class="card-title">Period & filters</div>
    <div class="grid2">
      <div class="field"><label>From</label>
        <input class="input" type="date" value="${escapeHtml(f.from)}" onchange="vrSet('from',this.value)"></div>
      <div class="field"><label>To</label>
        <input class="input" type="date" value="${escapeHtml(f.to)}" onchange="vrSet('to',this.value)"></div>
      <div class="field"><label>Vehicle</label>
        <select class="input" onchange="vrSet('vehicleId',this.value)">
          <option value="">All vehicles</option>
          ${(state.vehicles||[]).map(v => `<option value="${escapeHtml(v.id)}" ${f.vehicleId===v.id?"selected":""}>${escapeHtml(vehLabel(v))}</option>`).join("")}
        </select></div>
      <div class="field"><label>Type of work</label>
        <select class="input" onchange="vrSet('jobType',this.value)">
          <option value="">All work</option>
          ${VEH_JOB_TYPES.map(t => `<option ${f.jobType===t?"selected":""}>${escapeHtml(t)}</option>`).join("")}
        </select></div>
      ${_syncSel("\u270D\uFE0F Prepared by", everyone, "window._vr.preparedBy", "window._vr.preparedByOther", f.preparedBy, f.preparedByOther, "Name and title")}
      ${_syncSel("\u2705 Approved by",  everyone, "window._vr.approvedBy", "window._vr.approvedByOther", f.approvedBy, f.approvedByOther, "Name and title")}
      <div class="field full"><label>Notes for this report</label>
        <textarea rows="2" oninput="window._vr.notes=this.value" placeholder="Optional \u2014 left out of the document when blank">${escapeHtml(f.notes)}</textarea></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">\u{1F4CA} What this covers</div>
    ${jobs.length ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
      <div style="flex:1;min-width:110px;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--muted)">Jobs</div>
        <div style="font-size:20px;font-weight:800">${tot.count}</div></div>
      <div style="flex:1;min-width:110px;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--muted)">Vehicles</div>
        <div style="font-size:20px;font-weight:800">${Object.keys(byVeh).length}</div></div>
      <div style="flex:2;min-width:150px;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--muted)">Total spent</div>
        <div style="font-size:17px;font-weight:800">${escapeHtml(vehMoney(tot.usd, tot.iqd)) || "\u2014"}</div></div>
    </div>
    <div style="overflow-x:auto;margin-top:10px"><table class="tbl" style="min-width:460px">
      <thead><tr><th>Vehicle</th><th>Jobs</th><th>USD</th><th>IQD</th></tr></thead>
      <tbody>${Object.entries(byVeh).map(([k,g]) => {
        const v = vehById(k);
        return `<tr><td><strong>${escapeHtml(v ? vehLabel(v) : "Unassigned")}</strong></td>
          <td>${g.jobs.length}</td>
          <td>${g.usd ? Math.round(g.usd).toLocaleString() : ""}</td>
          <td>${g.iqd ? Math.round(g.iqd).toLocaleString() : ""}</td></tr>`;
      }).join("")}</tbody></table></div>`
      : `<div style="color:var(--muted);font-size:13px;margin-top:6px">No maintenance falls in this period.</div>`}
  </div>

  <div class="card">
    <div class="card-title">\u270D\uFE0F Signatures</div>
    ${typeof signaturePad==="function"?signaturePad("vr_prep","Prepared by","The author signs here"):""}
    ${typeof signaturePad==="function"?signaturePad("vr_appr","Approved by","EJAF approval"):""}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#12324F 0%,#1B4F72 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${typeof rptFormatToggle==="function"?rptFormatToggle(true):""}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%"
      onclick="generateVehicleReport()">${_fmtIcon()} Generate Vehicle Maintenance Report (${_fmtName()})</button>
  </div>`;
}

window.generateVehicleReport = async function(){
  const f = window._vr;
  const jobs = vrJobs();
  if(!jobs.length) return toast("\u26a0 No maintenance falls in this period");
  const esc = v => escapeHtml(String(v==null?"":v));
  const K = (()=>{ let n=0; return ()=>String(++n).padStart(2,"0"); })();
  const head = t => `<div style="margin:16px 0 6px;padding:5px 9px;background:#12324F;color:#fff;font-weight:700;font-size:12px;border-radius:3px">${K()}. ${esc(t)}</div>`;
  const period = [f.from?fmtDate(f.from):"", f.to?fmtDate(f.to):""].filter(Boolean).join(" \u2014 ");
  const tot = vehTotals(jobs);
  let body = "";

  // 1. Scope of the report — blank filters simply are not mentioned
  body += rptSect(t=>head(t), "Report Scope", rptTable(`
    ${rptRow("Reporting period", period)}
    ${rptRow("Vehicle", f.vehicleId ? vehLabel(vehById(f.vehicleId)) : "All vehicles")}
    ${rptRow("Type of work", f.jobType)}
    ${rptRow("Jobs covered", String(tot.count))}
    ${rptRow("Prepared by", f.preparedBy)}
    ${rptRow("Approved by", f.approvedBy)}`));

  // 2. Where the money went, per vehicle
  const byVeh = {};
  jobs.forEach(j => {
    const k = j.vehicleId || "_none";
    (byVeh[k] = byVeh[k] || {jobs:[], usd:0, iqd:0});
    const c = vehJobCost(j);
    byVeh[k].jobs.push(j); byVeh[k].usd += c.usd; byVeh[k].iqd += c.iqd;
  });
  body += rptSect(t=>head(t), "Cost by Vehicle", rptGrid(
    ["Vehicle","Plate","Jobs","USD","IQD"],
    Object.entries(byVeh).map(([k,g]) => {
      const v = vehById(k);
      return [ v ? (v.name || v.plate || "Vehicle") : "Unassigned", v ? v.plate : "",
               String(g.jobs.length),
               g.usd ? Math.round(g.usd).toLocaleString() : "",
               g.iqd ? Math.round(g.iqd).toLocaleString() : "" ];
    }), "#12324F"));

  // 3. Every job, with its parts. A vehicle with no work in the window is not
  //    listed at all — there is nothing to say about it.
  Object.entries(byVeh).forEach(([k,g]) => {
    const v = vehById(k);
    let inner = rptTable(`
      ${rptRow("Plate", v && v.plate)}
      ${rptRow("Make / model", v ? [v.make, v.model, v.year].filter(Boolean).join(" ") : "")}
      ${rptRow("Assigned driver", v && v.driver)}
      ${rptRow("Odometer", v && v.odometer ? vehNum(v.odometer).toLocaleString()+" km" : "")}
      ${rptRow("Spent in this period", vehMoney(g.usd, g.iqd))}`);
    inner += rptGrid(
      ["Date","Work","Odometer","Parts","Supplier","Invoice","Cost"],
      g.jobs.map(j => {
        const c = vehJobCost(j);
        const parts = (j.parts||[]).map(p =>
          `${p.name} \u00d7${vehNum(p.qty||1)} @ ${String(p.currency||"USD")} ${vehNum(p.unitPrice).toLocaleString()}`).join("; ");
        return [ j.date ? fmtDate(j.date) : "",
                 [j.jobType, j.description].filter(Boolean).join(" \u2014 "),
                 j.odometer ? vehNum(j.odometer).toLocaleString()+" km" : "",
                 parts, j.supplier, j.invoiceNo, vehMoney(c.usd, c.iqd) ];
      }), "#12324F");
    body += rptSect(t=>head(t), v ? vehLabel(v) : "Unassigned records", inner);
  });

  // 4. The two currencies, side by side and never added
  body += head("Total") + rptTable(`
    ${rptRow("Jobs", String(tot.count))}
    ${rptRow("Total USD", tot.usd ? "USD " + Math.round(tot.usd).toLocaleString() : "")}
    ${rptRow("Total IQD", tot.iqd ? "IQD " + Math.round(tot.iqd).toLocaleString() : "")}`)
    + `<div style="font-size:9.5px;color:#777;margin-top:4px">Currencies are reported separately as they were paid.</div>`;

  body += rptSect(t=>head(t), "Notes", rptFilled(f.notes)
    ? `<div style="font-size:11px;line-height:1.75">${typeof textWithTablesHTML==="function"?textWithTablesHTML(f.notes,{dash:false}):esc(f.notes)}</div>` : "");

  if(typeof sigAny==="function" && sigAny(["vr_prep","vr_appr"])){
    body += head("Signatures") + (typeof sigRow==="function" ? sigRow([
      ["vr_prep", f.preparedBy || "Prepared by", "Fleet / Operations", "EJAF Technology"],
      ["vr_appr", f.approvedBy || "Approved by", "Finance",            "EJAF Technology"],
    ]) : "");
  }

  await openReportPDF("VEHICLE_REPORT", period || "All dates", body, {});
  toast("Vehicle maintenance report ready!");
};
Object.assign(window, {renderVehicleReport, generateVehicleReport, vrJobs});
