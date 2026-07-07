function todayStr(){ return new Date().toISOString().slice(0,10); }


// ═══════════════════════════════════════════════════════════════════════
//  TECHNICAL REPORT  (Daily Log technical view: classifications + hours + days)
// ═══════════════════════════════════════════════════════════════════════

// All available columns (key → label). Admin chooses which to show.
const TECH_COLUMNS = [
  {key:"date",         label:"Date"},
  {key:"day",          label:"Day"},
  {key:"time",         label:"Time"},
  {key:"employee",     label:"Employee"},
  {key:"project",      label:"Project"},
  {key:"area",         label:"Area"},
  {key:"site",         label:"Site"},
  {key:"workType",     label:"Work Type"},
  {key:"taskStatus",   label:"Status"},
  {key:"taskCategory", label:"Category"},
  {key:"taskSubcategory",label:"Subcategory"},
  {key:"location",     label:"Location"},
  {key:"hours",        label:"Hours"},
  {key:"resolutionText",label:"Resolution Text"},
  // ── Device columns (pulled from the central devices collection via the entry's deviceSerial) ──
  {key:"dev_deviceName",  label:"Device Name",  device:true},
  {key:"dev_serialNumber",label:"Serial Number",device:true},
  {key:"dev_deviceCode",  label:"Device Code",  device:true},
  {key:"dev_ipAddress",   label:"IP Address",   device:true},
  {key:"dev_vendor",      label:"Vendor",       device:true},
  {key:"dev_model",       label:"Model",        device:true},
  {key:"dev_installDate", label:"Install Date", device:true},
  {key:"dev_warrantyExp", label:"Warranty Exp", device:true},
  {key:"dev_stack",       label:"Stack",        device:true},
  {key:"dev_status",      label:"Device Status",device:true},
];
const TECH_COLS_DEFAULT = ["date","day","time","employee","project","area","site","workType","taskStatus","taskCategory","taskSubcategory","hours"];

// Resolve a device-column value for a daily row by looking up its deviceSerial in the central registry
function techDeviceValue(row, key){
  if(!row.deviceSerial) return "";
  const d = (state.devices||[]).find(x=>x.serialNumber===row.deviceSerial);
  if(!d) return "";
  const field = key.replace("dev_","");
  const val = d[field] || "";
  if(field === "installDate" || field === "warrantyExp") return toDateStr(val);
  return val;
}

// Which columns are currently active
function activeTechCols(){
  const sel = state.techReportCols;
  if(Array.isArray(sel) && sel.length) return sel;
  return TECH_COLS_DEFAULT;
}

function renderTechReport(){
  if(isClient()) return `<div class="card"><div class="empty">Access denied</div></div>`;

  // Apply the unified filters to Daily Log only
  const rows = applyReportFilters(visibleRows(state.daily)).sort((a,b)=>{
    const d=(a.date||"").localeCompare(b.date||"");
    return d!==0?d:(a.entryNo||0)-(b.entryNo||0);
  });

  const cols = activeTechCols();
  const colDefs = TECH_COLUMNS.filter(c=>cols.includes(c.key));

  // ── Summary stats ──
  const totalTasks = rows.length;
  const totalHours = rows.reduce((s,r)=>s+Number(r.duration||0),0);
  // Work days = distinct (employee + date) pairs
  const dayPairs = new Set(rows.map(r=>`${r.employee}|${r.date}`));
  const workDays = dayPairs.size;

  // By category
  const byCat = {};
  rows.forEach(r=>{ const c=r.taskCategory||"(none)"; byCat[c]=(byCat[c]||0)+1; });
  // By status
  const byStatus = {};
  rows.forEach(r=>{ const s=r.taskStatus||"(none)"; byStatus[s]=(byStatus[s]||0)+1; });

  const catColors = {Network:"#1565C0",CCTV:"#6A1B9A",System:"#2E7D32",Maintenance:"#E65100","Onsite Survey":"#00838F",Deployment:"#AD1457",General:"#5D4037",CR:"#C62828"};

  let h = `<div class="card">
    <div class="card-title">🔧 Technical Report</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:8px">Technical breakdown of Daily Log: classifications, hours, and work days. Uses the filters below.</p>
  </div>`;

  // Filters (unified)
  if(!isEmployee()) h += `<div class="card">${renderEmployeeFilterUI("Filter Technical Report")}</div>`;

  // ── Export buttons ──
  if(canSeeReports()){
    h += `<div class="card" style="background:#0F2347">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="color:#C9A84C;font-weight:800;font-size:14px">📤 Export Technical Report</div>
        <div style="display:flex;gap:8px">
          <button class="btn" style="background:#C9A84C;color:#0F2347;border:none;font-weight:700" onclick="exportTechPDF()">📄 PDF</button>
          <button class="btn" style="background:#2E7D32;color:white;border:none;font-weight:700" onclick="exportTechExcel()">📊 Excel</button>
        </div>
      </div>
    </div>`;
  }

  // ── Summary cards ──
  h += `<div class="card">
    <div class="card-title">📊 Summary</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px">
      <div style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);color:white;border-radius:10px;padding:12px"><div style="font-size:11px;opacity:0.8">TOTAL TASKS</div><div style="font-size:24px;font-weight:800">${totalTasks}</div></div>
      <div style="background:linear-gradient(135deg,#2E7D32,#43A047);color:white;border-radius:10px;padding:12px"><div style="font-size:11px;opacity:0.8">TOTAL HOURS</div><div style="font-size:24px;font-weight:800">${fmtHM(totalHours)}</div></div>
      <div style="background:linear-gradient(135deg,#6A1B9A,#8E24AA);color:white;border-radius:10px;padding:12px"><div style="font-size:11px;opacity:0.8">WORK DAYS</div><div style="font-size:24px;font-weight:800">${workDays}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div style="font-size:12px;font-weight:800;color:#C2185B;margin-bottom:6px">By Category</div>
        ${Object.keys(byCat).sort((a,b)=>byCat[b]-byCat[a]).map(c=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:12px;color:#333"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${catColors[c]||'#999'};margin-right:6px"></span>${escapeHtml(c)}</span>
            <span style="font-weight:700;color:${catColors[c]||'#333'};font-size:13px">${byCat[c]}</span>
          </div>`).join("")}
      </div>
      <div>
        <div style="font-size:12px;font-weight:800;color:#00897B;margin-bottom:6px">By Status</div>
        ${Object.keys(byStatus).sort((a,b)=>byStatus[b]-byStatus[a]).map(s=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f0f0f0">
            <span style="font-size:12px;color:#333">${escapeHtml(s)}</span>
            <span style="font-weight:700;color:#00897B;font-size:13px">${byStatus[s]}</span>
          </div>`).join("")}
      </div>
    </div>
  </div>`;

  // ── Column chooser (admin only) ──
  if(isAdmin()){
    h += `<div class="card" style="border:1px solid #6A1B9A">
      <div class="card-title" style="color:#6A1B9A;font-size:14px">⚙️ Choose Columns</div>
      <p style="font-size:11px;color:var(--muted);margin-bottom:10px">Select which columns appear in the table and exports. Saved for everyone.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${TECH_COLUMNS.map(c=>`
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;background:${cols.includes(c.key)?'#F3E5F5':'#F7F7F7'};border:1px solid ${cols.includes(c.key)?'#CE93D8':'#ddd'};padding:5px 10px;border-radius:14px">
            <input type="checkbox" ${cols.includes(c.key)?'checked':''} onchange="toggleTechCol('${c.key}')" style="cursor:pointer">
            ${escapeHtml(c.label)}
          </label>`).join("")}
      </div>
    </div>`;
  }

  // ── Detailed table ──
  h += `<div class="card">
    <div class="filter-row"><span class="card-title" style="margin:0">📋 Detailed Tasks</span><span class="count-pill">${rows.length}</span></div>
    <div style="overflow-x:auto">
      <table class="data-table" style="min-width:${colDefs.length*110}px">
        <thead><tr>${colDefs.map(c=>`<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.length===0?`<tr><td colspan="${colDefs.length}" style="text-align:center;color:#999;padding:20px">No tasks match the filters</td></tr>`:rows.map(r=>`<tr>
            ${colDefs.map(c=>{
              let v = r[c.key];
              if(c.key==="hours") v = fmtHM(r.duration);
              else if(c.key==="date") v = fmtDate(r.date);
              else if(c.key==="day") v = r.day || dayName(r.date);
              else if(c.key==="time") v = (r.start&&r.end)?`${r.start}–${r.end}`:"";
              else if(c.key&&c.key.startsWith("dev_")) v = techDeviceValue(r, c.key);
              else if(c.key==="resolutionText") v = (r.resolutionText||"").slice(0,60)+((r.resolutionText||"").length>60?"…":"");
              return `<td style="font-size:12px">${escapeHtml(String(v||"—"))}</td>`;
            }).join("")}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>`;

  return h;
}

window.toggleTechCol = async function(key){
  if(!isAdmin()) return toast("Admin only");
  let cols = activeTechCols().slice();
  if(cols.includes(key)) cols = cols.filter(k=>k!==key);
  else {
    // keep canonical order
    cols = TECH_COLUMNS.map(c=>c.key).filter(k=>cols.includes(k)||k===key);
  }
  if(cols.length===0) return toast("Keep at least one column");
  const {db, doc, setDoc} = window.__fb;
  await setDoc(doc(db,"settings","techReport"), {columns: cols}, {merge:true});
};


function renderDailyLogReport(){
  if(!canSeeReports()) return `<div class="card"><div class="empty">Access requires report permission.</div></div>`;
  const rows = (typeof applyReportFilters==="function") ? applyReportFilters(state.daily,"date") : (state.daily||[]);
  const period = getPeriodFrom() ? `${fmtDate(getPeriodFrom())} → ${fmtDate(getPeriodTo())}` : "All time — no period set";
  return `<div class="card" style="border-left:4px solid #03308B">
    <div class="sec-hdr">📋 Daily Log Report</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="border:1px solid var(--line);border-radius:10px;padding:12px;background:#F8FAFD">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Period</div>
        <div style="font-weight:800;color:#03308B;margin-top:3px;font-size:13px">📅 ${period}</div>
      </div>
      <div style="border:1px solid var(--line);border-radius:10px;padding:12px;background:#F8FAFD">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Entries in report</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#03308B;margin-top:2px">${rows.length}</div>
      </div>
    </div>
    <p style="font-size:11.5px;color:var(--muted);margin:0 0 14px;line-height:1.6">This report follows the header <strong>period</strong> and all <strong>global filters</strong> (branch, employee, project, work type…). Adjust them, then export.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button onclick="exportDailyPDF()" style="flex:1;min-width:150px;background:#03308B;color:#C9A84C;border:none;padding:14px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 3px 10px rgba(27,58,107,0.22)">📄 Export PDF</button>
      <button onclick="exportDailyExcel()" style="flex:1;min-width:150px;background:#1B5E20;color:#fff;border:none;padding:14px;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 3px 10px rgba(27,94,32,0.22)">📊 Export Excel</button>
    </div>
  </div>`;
}

function renderHRReport(){
  const s=summary();
  const tot=k=>s.reduce((a,b)=>a+b[k],0);
  const td=new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  const emps = visibleEmployees();
  const totalLeaveDays = s.reduce((a,b)=>a+(b.leaveDays||0),0);

  // ═══════ HEADER (Unified Brand Style) ═══════
  let h=`<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;border:2px solid #C9A84C;position:relative;overflow:hidden">
    <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,#C9A84C22,transparent);border-radius:50%"></div>
    <div style="display:flex;align-items:center;gap:14px;position:relative">
      <div style="width:56px;height:56px;border:2px solid #C9A84C;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#1B3A6B">
        <span style="font-family:'DM Serif Display',serif;font-size:18px;color:#C9A84C;font-weight:700">EJAF</span>
      </div>
      <div style="flex:1;min-width:0">
        <h2 style="font-family:'DM Serif Display',serif;font-size:22px;color:white;margin:0;line-height:1.2">HR Comprehensive Report</h2>
        <div style="font-size:11px;color:#C9A84C;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Girêk</div>
        <div style="font-size:11px;color:#B8CFE8;margin-top:6px">Period: <strong>${escapeHtml(getPeriod())}</strong> · Issued: ${td}</div>
        <div style="font-size:10px;color:#8AA8C8;margin-top:2px;font-style:italic">By: ${escapeHtml(state.profile.name||state.profile.email)}</div>
      </div>
    </div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;position:relative">
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="exportExcel()">📊 Export Excel</button>
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="exportPDF()">📄 Export PDF</button>
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="exportDashboardPDF()">📈 Dashboard PDF</button>
    </div>
  </div>`;

  // ═══════ GLOBAL EMPLOYEE FILTER ═══════
  h += renderEmployeeFilterUI("Filter Report by Employees");

  // ═══════ EXECUTIVE KPI SUMMARY ═══════
  const hv = window._hrView || "summary";
  h += _pills('_hrView',[{id:"summary",ic:"📊",lb:"Summary"},{id:"daily",ic:"👥",lb:"Daily"},{id:"leaves",ic:"🏖️",lb:"Leaves"},{id:"overtime",ic:"⏱️",lb:"Overtime"},{id:"travel",ic:"✈️",lb:"Travel"}]);
  if(hv==="summary") h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> Executive Summary</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:10px">
      <div style="border:1px solid var(--line);border-left:4px solid #2E5FA3;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Total Hours</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#2E5FA3;margin-top:2px">${fmtHM(tot("total"))}</div>
        <div style="font-size:10px;color:var(--muted)">${applyReportFilters(state.daily).length} sessions</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #E65100;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Overtime</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#E65100;margin-top:2px">${fmtHM(tot("ot"))}</div>
        <div style="font-size:10px;color:var(--muted)">${applyReportFilters(state.overtime).length} entries</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #2E7D32;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Travel Days</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#2E7D32;margin-top:2px">${tot("tDays")}</div>
        <div style="font-size:10px;color:var(--muted)">${applyReportFilters(state.travel).length} trips</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #6A1B9A;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Per Diem</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#6A1B9A;margin-top:2px">${fmtMoney(tot("pd"))}</div>
        <div style="font-size:10px;color:var(--muted)">IQD total</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #C62828;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Leave Days</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#C62828;margin-top:2px">${totalLeaveDays.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--muted)">${applyReportFilters(state.leaves,"from").length} entries</div>
      </div>
    </div>
  </div>`;

  // ═══════ STAFF WORK SUMMARY (Section 2) ═══════
  if(hv==="daily") h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">02</span> Staff Work Summary</div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);color:white"><th style="color:white">Employee</th>${state.departments.map(d=>`<th style="color:white;border-bottom:3px solid ${d.color}">${escapeHtml(d.name.slice(0,8))}</th>`).join("")}<th style="color:white">Total</th><th style="color:white">OT</th><th style="color:white">Travel</th><th style="color:white">Per Diem</th><th style="color:white">Leave</th></tr></thead>
      <tbody>${s.map((r,idx)=>`<tr style="background:${idx%2?'#F5F8FC':'white'}">
        <td><strong style="color:#1B3A6B">${escapeHtml(r.emp)}</strong></td>
        ${state.departments.map(d=>`<td style="color:${d.color};font-weight:700">${fmtHM(r.byDept[d.name]||0)}</td>`).join("")}
        <td><strong style="color:#1B3A6B">${fmtHM(r.total)}</strong></td>
        <td style="color:#E65100;font-weight:600">${fmtHM(r.ot)}</td>
        <td style="color:#2E7D32;font-weight:600">${r.tDays||0}</td>
        <td style="color:#6A1B9A;font-weight:600">${fmtMoney(r.pd)}</td>
        <td style="color:#C62828;font-weight:600">${(Number(r.leaveDays)||0).toFixed(2)}</td>
      </tr>`).join("")}
      ${!isEmployee()?`<tr style="background:linear-gradient(135deg,#C9A84C,#B58E2E);color:#1B3A6B">
        <td><strong>GRAND TOTAL</strong></td>
        ${state.departments.map(d=>`<td><strong>${fmtHM(s.reduce((acc,r)=>acc+(r.byDept[d.name]||0),0))}</strong></td>`).join("")}
        <td><strong>${fmtHM(tot("total"))}</strong></td>
        <td><strong>${fmtHM(tot("ot"))}</strong></td>
        <td><strong>${tot("tDays")}</strong></td>
        <td><strong>${fmtMoney(tot("pd"))}</strong></td>
        <td><strong>${totalLeaveDays.toFixed(2)}</strong></td></tr>`:""}
      </tbody></table></div>
  </div>`;

  // ═══════ LEAVES SECTION (Section 3) — NEW ═══════
  if(hv==="leaves"){
  h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">03</span> Employee Leaves</div>
    ${state.leaves.length===0?`<div class="empty">No leaves recorded</div>`:`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:14px">
      ${LEAVE_TYPES.map(lt=>{
        const total = s.reduce((sum,r)=>sum+(r.leaveBreakdown?.[lt.id]||0),0);
        if(total===0) return '';
        return `<div style="border:1px solid var(--line);border-left:4px solid ${lt.color};border-radius:8px;padding:10px;background:white">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:0.5px">${lt.label}</div>
          <div style="font-family:'DM Serif Display',serif;font-size:20px;color:${lt.color};margin-top:2px">${total}</div>
          <div style="font-size:10px;color:var(--muted)">days</div>
        </div>`;
      }).filter(Boolean).join("")}
    </div>`}
  </div>`;

  emps.forEach(emp=>{
    const my=applyReportFilters(state.leaves,"from").filter(r=>r.employee===emp);
    if(my.length===0) return;
    const sub=my.reduce((a,r)=>a+Number(r.days||0),0);
    h+=`<div class="card" style="border-left:4px solid #C62828">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">
        <strong style="color:#1B3A6B">📅 ${employeeBadge(emp)}</strong>
        <span style="background:#C62828;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">${sub} days</span>
      </div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Notes</th></tr></thead>
        <tbody>${my.slice().sort((a,b)=>(b.from||"").localeCompare(a.from||"")).map(r=>`<tr>
          <td>${leaveTypeBadge(r.type)}</td>
          <td>${escapeHtml(r.from||'')}</td>
          <td>${escapeHtml(r.to||'')}</td>
          <td><strong style="color:${leaveTypeInfo(r.type).color}">${r.days||0}</strong></td>
          <td style="font-size:12px;color:var(--muted)">${escapeHtml(r.notes||'—')}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </div>`;
  });

  }
  // ═══════ OVERTIME (Section 4) ═══════
  if(hv==="overtime"){
  h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">04</span> Overtime by Employee</div>`;
  emps.forEach(emp=>{
    const my=applyReportFilters(state.overtime).filter(r=>r.employee===emp);
    const sub=my.reduce((a,r)=>a+Number(r.hours||0),0);
    h+=`<div style="border:1px solid var(--line);border-radius:10px;margin-bottom:10px;overflow:hidden;border-left:4px solid #E65100">
      <div style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);color:white;padding:8px 12px;font-weight:700;font-size:12px;display:flex;justify-content:space-between;align-items:center">
        <span>▶ ${employeeBadge(emp)}</span>
        <span style="background:#C9A84C;color:#1B3A6B;padding:2px 10px;border-radius:10px;font-size:11px">${my.length} entries</span>
      </div>
      ${my.length===0?`<div class="empty">No overtime</div>`:`<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Date</th><th>Day</th><th>Hrs</th><th>Project</th><th>Location</th></tr></thead>
        <tbody>${my.map((r,idx)=>`<tr style="background:${idx%2?'#F5F8FC':'white'}"><td>${fmtDate(r.date)}</td><td>${r.day||""}</td><td><strong style="color:#E65100">${fmtHM(r.hours)}</strong></td><td>${escapeHtml(r.project||"—")}</td><td>${escapeHtml(r.location||"—")}</td></tr>`).join("")}</tbody></table></div>`}
      <div style="background:linear-gradient(135deg,#E65100,#BF360C);color:white;padding:8px 12px;font-weight:700;font-size:12px;display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmtHM(sub)}</span></div>
    </div>`;
  });
  h+=`</div>`;

  }
  // ═══════ TRAVEL (Section 5) ═══════
  if(hv==="travel"){
  h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">05</span> Travel by Employee</div>`;
  emps.forEach(emp=>{
    const my=applyReportFilters(state.travel).filter(r=>r.employee===emp);
    const sd=my.reduce((a,r)=>a+Number(r.days||0),0);
    const sp=my.reduce((a,r)=>a+Number(r.perDiem||0),0);
    h+=`<div style="border:1px solid var(--line);border-radius:10px;margin-bottom:10px;overflow:hidden;border-left:4px solid #2E7D32">
      <div style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);color:white;padding:8px 12px;font-weight:700;font-size:12px;display:flex;justify-content:space-between;align-items:center">
        <span>▶ ${employeeBadge(emp)}</span>
        <span style="background:#C9A84C;color:#1B3A6B;padding:2px 10px;border-radius:10px;font-size:11px">${my.length} trips</span>
      </div>
      ${my.length===0?`<div class="empty">No travel</div>`:`<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Date</th><th>Days</th><th>Project</th><th>Location</th><th>Per Diem</th></tr></thead>
        <tbody>${my.map((r,idx)=>`<tr style="background:${idx%2?'#F5F8FC':'white'}"><td>${fmtDate(r.date)}</td><td><strong>${r.days}</strong></td><td>${escapeHtml(r.project||"—")}</td><td>${escapeHtml(r.location||"—")}</td><td><strong style="color:#6A1B9A">${fmtMoney(r.perDiem)}</strong></td></tr>`).join("")}</tbody></table></div>`}
      <div style="background:linear-gradient(135deg,#2E7D32,#1B5E20);color:white;padding:8px 12px;font-weight:700;font-size:12px;display:flex;justify-content:space-between"><span>Subtotal</span><span>${sd} days · ${fmtMoney(sp)} IQD</span></div>
    </div>`;
  });
  h+=`</div>`;

  // Footer
  }
  if(hv==="travel") h+=`<div class="card" style="background:#F5F8FC;text-align:center;padding:14px;font-size:11px;color:var(--muted);border:1px dashed var(--line)">
    <strong style="color:#1B3A6B">EjafTech Operations</strong> · Confidential HR Document · Generated by Girêk
  </div>`;

  return h;
}

// ═══════════════════════════════════════════════════════════════════════
//  PROJECTS (HR+)
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
//  PROJECTS IMPORT MODULE (CSV / Excel)
//  Columns expected: Project | Site | Equipment | Specifications
//  Imports into a chosen department, merging with existing data.
//  Equipment shape on a site: { name, spec } stored inside project.sites[].equipment
// ═══════════════════════════════════════════════════════════════════════

// Trigger a hidden file picker for a given department
window.importProjectsForDept = function(deptName){
  if(!isAdmin()) return toast("Admin only");
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.xlsx,.xls';
  input.onchange = (e)=>{
    const file = e.target.files[0];
    if(file) parseImportFile(file, deptName);
  };
  input.click();
};

// Download a sample template so the admin knows the exact columns
window.downloadImportTemplate = function(){
  const sample = [
    ["Project","Area Name","Site Name","Status"],
    ["Asia Cell","Erbil Area","Tower-A","Active"],
    ["Asia Cell","Erbil Area","Tower-B","Inactive"],
    ["Asia Cell","Duhok Area","Site-North","Active"],
    ["Down Town","Central Zone","Site-X","Active"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  ws['!cols']=[{wch:18},{wch:16},{wch:16},{wch:12}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "Girek_Import_Template.xlsx");
  toast("Template downloaded ✓");
};


// ═══════════════════════════════════════════════════════════════════════
//  SMART ANALYTICS — trends, rankings, forecasts & health (all in-memory)
//  Admin + HR · ignores the global period filter on purpose (trends need
//  full history) · works offline (reads only from state).
// ═══════════════════════════════════════════════════════════════════════
function _anMonths(n){
  const out=[],d=new Date();d.setDate(1);
  for(let i=n-1;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1);
    out.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`);}
  return out;
}
const _anMLabel=(k)=>["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(k.slice(5,7))]+" "+k.slice(2,4);
function _anSpark(vals,color){
  const w=300,h=64,p=6,mx=Math.max(...vals,1);
  const pts=vals.map((v,i)=>[p+i*(w-2*p)/Math.max(vals.length-1,1), h-p-(v/mx)*(h-2*p)]);
  const line=pts.map((pt,i)=>(i?"L":"M")+pt[0].toFixed(1)+" "+pt[1].toFixed(1)).join(" ");
  const area=line+` L${pts[pts.length-1][0].toFixed(1)} ${h-2} L${pts[0][0].toFixed(1)} ${h-2} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:64px;display:block">
    <path d="${area}" fill="${color}" opacity="0.15"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    ${pts.map(pt=>`<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="2.4" fill="${color}"/>`).join("")}
  </svg>`;
}
function _anBar(label,val,max,color,meta){
  const pct=max>0?Math.max(2,Math.round(val/max*100)):0;
  return `<div class="an-row"><div class="an-rl"><span>${escapeHtml(label)}</span><span class="an-rm">${meta||""}</span></div>
    <div class="an-tr"><div class="an-fl" style="width:${pct}%;background:${color}"></div></div></div>`;
}
function _anDelta(cur,prev){
  if(prev<=0) return cur>0?`<span class="an-up">▲ new</span>`:"";
  const d=Math.round((cur-prev)/prev*100);
  if(d===0) return `<span class="an-eq">— 0%</span>`;
  return d>0?`<span class="an-up">▲ ${d}%</span>`:`<span class="an-dn">▼ ${Math.abs(d)}%</span>`;
}
function renderAnalytics(){
  if(!(isAdmin()||isHR())) return `<div class="card"><div class="empty">Admin / HR only.</div></div>`;
  const daily=state.daily||[], devices=state.devices||[], projects=state.projects||[], reqs=state.clientRequests||[];
  const now=new Date(), todayK=now.toISOString().slice(0,7);
  const months=_anMonths(12), prevK=months[months.length-2];

  // 1) Monthly hours
  const byM={}; daily.forEach(r=>{const k=String(r.date||"").slice(0,7); if(k) byM[k]=(byM[k]||0)+Number(r.duration||0);});
  const series=months.map(k=>byM[k]||0);
  const curM=series[series.length-1], prevM=series[series.length-2]||0;

  // 2) Locations
  const locAll={},locCur={},locPrev={};
  daily.forEach(r=>{const L=r.location||"—",k=String(r.date||"").slice(0,7),m=Number(r.duration||0);
    locAll[L]=(locAll[L]||0)+m; if(k===todayK)locCur[L]=(locCur[L]||0)+m; if(k===prevK)locPrev[L]=(locPrev[L]||0)+m;});
  const locTop=Object.entries(locAll).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const locMax=locTop.length?locTop[0][1]:0, locTotal=Object.values(locAll).reduce((s,v)=>s+v,0);

  // 3) Warranty forecast
  const parsed=devices.map(d=>{const s=toDateStr(d.warrantyExp);const t=s?new Date(s):null;
    return {d,w:(t&&!isNaN(t))?t:null};}).filter(x=>x.w);
  const expired=parsed.filter(x=>x.w<now);
  const in30=parsed.filter(x=>{const diff=(x.w-now)/864e5;return diff>=0&&diff<=30;});
  const fut={}; parsed.forEach(x=>{const k=x.w.toISOString().slice(0,7); fut[k]=(fut[k]||0)+1;});
  const futMonths=(()=>{const o=[];for(let i=0;i<6;i++){const x=new Date(now.getFullYear(),now.getMonth()+i,1);
    o.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`);}return o;})();
  const futMax=Math.max(...futMonths.map(k=>fut[k]||0),1);
  const soonest=parsed.filter(x=>x.w>=now).sort((a,b)=>a.w-b.w).slice(0,8);

  // 4) Team (last 90d)
  const D=(n)=>new Date(now-n*864e5).toISOString().slice(0,10);
  const d90=D(90),d28=D(28),d56=D(56);
  const emp={},empA={},empB={},empType={};
  daily.forEach(r=>{const e=r.employee||"—",dt=r.date||"",m=Number(r.duration||0);
    if(dt>=d90){emp[e]=(emp[e]||0)+m;const t=r.workType||"";
      if(t){empType[e]=empType[e]||{};empType[e][t]=(empType[e][t]||0)+1;}}
    if(dt>=d28)empA[e]=(empA[e]||0)+m; else if(dt>=d56)empB[e]=(empB[e]||0)+m;});
  const empTop=Object.entries(emp).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const empMax=empTop.length?empTop[0][1]:0;
  const topType=(e)=>{const t=Object.entries(empType[e]||{}).sort((a,b)=>b[1]-a[1]);return t.length?t[0][0]:"";};

  // 5) Project health
  const projHrs={}; daily.forEach(r=>{const p=(r.project||"").trim(); if(p)projHrs[p]=(projHrs[p]||0)+Number(r.duration||0);});
  const health=projects.filter(p=>Number(p.estimatedHours||0)>0).map(p=>{
    const est=Number(p.estimatedHours)*60, used=projHrs[(p.name||"").trim()]||0;
    return {name:p.name,used,est,pct:Math.round(used/est*100),status:p.status||""};
  }).sort((a,b)=>b.pct-a.pct);

  // 6) Requests
  const rCur=reqs.filter(r=>String(r.createdAt||"").slice(0,7)===todayK).length;
  const rPrev=reqs.filter(r=>String(r.createdAt||"").slice(0,7)===prevK).length;
  const byStatus={}; reqs.forEach(r=>{const s=r.status||"—";byStatus[s]=(byStatus[s]||0)+1;});
  const byClient={}; reqs.forEach(r=>{const cn=r.clientName||"—";byClient[cn]=(byClient[cn]||0)+1;});
  const clTop=Object.entries(byClient).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const done=reqs.filter(r=>r.status==="completed"&&r.updatedAt&&r.createdAt);
  const avgDays=done.length?(done.reduce((s,r)=>s+(new Date(r.updatedAt)-new Date(r.createdAt))/864e5,0)/done.length).toFixed(1):null;
  const pretty=(s)=>String(s||"").replace(/_/g," ").replace(/\b\w/g,ch=>ch.toUpperCase());

  return `
  <div class="card" style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);border:none;color:white">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div><div style="font-size:17px;font-weight:800">📊 Smart Analytics</div>
      <div style="font-size:11px;opacity:.75;margin-top:2px">All-time & recent trends · independent of the period filter · works offline</div></div>
      <div style="text-align:right"><div style="font-size:22px;font-weight:800;color:#C9A84C">${fmtHM(curM)}</div>
      <div style="font-size:10px;opacity:.8">this month ${_anDelta(curM,prevM)}</div></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">📈 Monthly Hours — last 12 months</div>
    ${daily.length?_anSpark(series,"#C9A84C"):'<div class="empty">No work entries yet</div>'}
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px">
      <span>${_anMLabel(months[0])}</span><span>${_anMLabel(months[6])}</span><span>${_anMLabel(months[11])}</span>
    </div>
  </div>
  <div class="an-grid">
    <div class="card">
      <div class="card-title">📍 Top Locations — hours share</div>
      ${locTop.length?locTop.map(([L,v])=>_anBar(L,v,locMax,"#2E5FA3",
        `${fmtHM(v)} · ${locTotal?Math.round(v/locTotal*100):0}% ${_anDelta(locCur[L]||0,locPrev[L]||0)}`)).join(""):'<div class="empty">No data</div>'}
    </div>
    <div class="card">
      <div class="card-title">🛡️ Warranty Forecast</div>
      <div style="display:flex;gap:10px;margin-bottom:12px">
        <div class="an-kpi" style="border-color:#C62828"><div class="an-kv" style="color:#C62828">${expired.length}</div><div class="an-kl">expired</div></div>
        <div class="an-kpi" style="border-color:#E65100"><div class="an-kv" style="color:#E65100">${in30.length}</div><div class="an-kl">&le; 30 days</div></div>
        <div class="an-kpi" style="border-color:#2E7D32"><div class="an-kv" style="color:#2E7D32">${parsed.length}</div><div class="an-kl">tracked</div></div>
      </div>
      ${futMonths.map(k=>_anBar(_anMLabel(k),fut[k]||0,futMax,"#E65100",`${fut[k]||0} device(s)`)).join("")}
      ${soonest.length?`<div style="font-size:11px;color:var(--muted);margin:10px 0 4px;font-weight:700">Soonest to expire:</div>`+
        soonest.map(x=>`<div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--line)">📟 ${escapeHtml(x.d.deviceName||x.d.model||"Device")} <span style="color:var(--muted)">· ${escapeHtml(x.d.serialNumber||"")} · ${escapeHtml(x.d.site||"")} · <strong>${toDateStr(x.d.warrantyExp)}</strong></span></div>`).join(""):""}
    </div>
    <div class="card">
      <div class="card-title">👥 Team Productivity — last 90 days</div>
      ${empTop.length?empTop.map(([e,v])=>_anBar(e,v,empMax,"#6A1B9A",
        `${fmtHM(v)} ${_anDelta(empA[e]||0,empB[e]||0)}${topType(e)?` · ${escapeHtml(topType(e))}`:""}`)).join(""):'<div class="empty">No data</div>'}
      <div style="font-size:10px;color:var(--muted);margin-top:6px">▲▼ compares the last 28 days with the 28 before</div>
    </div>
    <div class="card">
      <div class="card-title">🏗️ Project Health — consumed vs estimated</div>
      ${health.length?health.map(p=>{
        const col=p.pct>100?"#C62828":p.pct>=80?"#E65100":"#2E7D32";
        const flag=p.pct>100?"&#9888; Over budget":p.pct>=80?"Watch":"On track";
        return `<div class="an-row"><div class="an-rl"><span>${escapeHtml(p.name)}${p.status?` <span style="font-size:9px;background:#F0F4FF;color:#03308B;border:1px solid #C9A84C;padding:1px 7px;border-radius:9px;font-weight:800">${escapeHtml(p.status)}</span>`:""}</span>
          <span class="an-rm" style="color:${col};font-weight:800">${p.pct}% · ${flag}</span></div>
          <div class="an-tr"><div class="an-fl" style="width:${Math.min(p.pct,100)}%;background:${col}"></div></div>
          <div style="font-size:10px;color:var(--muted)">${fmtHM(p.used)} of ${fmtHM(p.est)}</div></div>`;
      }).join(""):'<div class="empty">Set Estimated Hours on projects to see health</div>'}
    </div>
    <div class="card">
      <div class="card-title">📨 Client Requests</div>
      <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <div class="an-kpi" style="border-color:#03308B"><div class="an-kv" style="color:#03308B">${rCur}</div><div class="an-kl">this month ${_anDelta(rCur,rPrev)}</div></div>
        <div class="an-kpi" style="border-color:#00897B"><div class="an-kv" style="color:#00897B">${avgDays!==null?avgDays+"d":"—"}</div><div class="an-kl">avg completion</div></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${Object.entries(byStatus).map(([s,n])=>`<span style="font-size:11px;font-weight:700;background:#F0F4FF;color:#03308B;padding:4px 10px;border-radius:12px">${escapeHtml(pretty(s))} · ${n}</span>`).join("")||'<span class="empty">No requests yet</span>'}
      </div>
      ${clTop.length?`<div style="font-size:11px;color:var(--muted);font-weight:700;margin-bottom:4px">Most active clients:</div>`+
        clTop.map(([cn,n])=>_anBar(cn,n,clTop[0][1],"#00897B",`${n} request(s)`)).join(""):""}
    </div>
  </div>`;
}
