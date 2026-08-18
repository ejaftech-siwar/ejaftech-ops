window._prPlans=window._prPlans||[];
window._pmRptPlans=window._pmRptPlans||[];
// ── Shared identity/row filters so Reports matches the rest of the app ──
// (parity with applyReportFilters: staff-dept + branch act on WHO the employee
//  is; task-dept + location act on the record itself, guarded by field presence)
function _identityAllowed(list){
  const bf = state.globalBranchFilter || "";
  if(bf){
    const s=new Set([
      ...state.users.filter(u=>(u.branch||"")===bf).map(u=>u.employeeName||u.name),
      ...(state.nametagEmployees||[]).filter(n=>(n.branch||"")===bf).map(n=>n.name),
    ].filter(Boolean));
    list = list.filter(x=>s.has(x));
  }
  const edf = state.globalEmpDeptFilter || "";
  if(edf){
    const s=new Set([
      ...state.users.filter(u=>(u.userDept||"")===edf).map(u=>u.employeeName||u.name),
      ...(state.nametagEmployees||[]).filter(n=>(n.dept||"")===edf).map(n=>n.name),
    ].filter(Boolean));
    list = list.filter(x=>s.has(x));
  }
  return list;
}
function _reportRowOK(r){
  const tdf = state.globalTaskDeptFilter || "";
  if(tdf && ("dept" in r) && r.dept!==tdf) return false;
  const lf = state.globalLocationFilter || "";
  if(lf && ("location" in r) && r.location!==lf) return false;
  return true;
}

function renderFlexReports(){
  const f = state.reportFilter;
  // Default: current month if empty
  if(!f.from && !f.to){
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    f.from = first.toISOString().split("T")[0];
    f.to = today.toISOString().split("T")[0];
  }

  // Filter rows by date range
  const inRange = (r) => {
    if(!r.date) return false;
    if(f.from && r.date < f.from) return false;
    if(f.to && r.date > f.to) return false;
    return true;
  };

  // Apply global employee filter
  const sel = state.globalEmployeeFilter || [];
  const filterByEmp = (rows) => {
    if(sel.length === 0) return rows;
    return rows.filter(r => sel.includes(r.employee));
  };
  // Leaves use 'from' field as date
  const leaveInRange = (l) => {
    if(!l.from) return false;
    if(f.from && l.from < f.from) return false;
    if(f.to && l.from > f.to) return false;
    return true;
  };

  const allowedEmpsBase = isEmployee() ? [state.profile.employeeName] : allEmployees();
  // Apply global employee filter (multi-select)
  let allowedEmps = (sel.length > 0 && !isEmployee())
    ? allowedEmpsBase.filter(e => sel.includes(e))
    : allowedEmpsBase;
  allowedEmps = _identityAllowed(allowedEmps);   // staff-dept + branch (was ignored — the reported bug)
  const projF = f.project || ""; // project filter
  const dailyFiltered = apprFilter(state.daily).filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF || r.project===projF));
  const otFiltered = state.overtime.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF || r.project===projF));
  const trFiltered = state.travel.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF || r.project===projF));
  const lvFiltered = state.leaves.filter(r=>leaveInRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r));

  // Stats per department
  const deptStats = state.departments.map(d=>{
    const dHours = dailyFiltered.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.duration||0),0);
    const dCount = dailyFiltered.filter(r=>r.dept===d.name).length;
    const otHours = otFiltered.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.hours||0),0);
    return {...d, color: deptColor(d.name), hours: dHours, count: dCount, otHours};
  });
  const totalHours = deptStats.reduce((s,d)=>s+d.hours,0);

  // Stats per employee
  const empStats = allowedEmps.map(emp=>{
    const eDaily = dailyFiltered.filter(r=>r.employee===emp);
    const eOT = otFiltered.filter(r=>r.employee===emp);
    const eTr = trFiltered.filter(r=>r.employee===emp);
    const eLv = lvFiltered.filter(r=>r.employee===emp);
    return {
      emp,
      hours: eDaily.reduce((s,r)=>s+Number(r.duration||0),0),
      sessions: eDaily.length,
      ot: eOT.reduce((s,r)=>s+Number(r.hours||0),0),
      travelDays: eTr.reduce((s,r)=>s+Number(r.days||0),0),
      perDiem: eTr.reduce((s,r)=>s+Number(r.perDiem||0),0),
      leaveDays: eLv.reduce((sum, r) => {
        if(r.days !== undefined && r.days !== null && !isNaN(Number(r.days))) return sum + Number(r.days);
        if(r.hours !== undefined && r.hours !== null && !isNaN(Number(r.hours))) return sum + (Number(r.hours) / WORK_HOURS_PER_DAY);
        return sum + computeLeaveAmount(r).days;
      }, 0),
    };
  });

  const presets = [
    {label:"This Month"},
    {label:"Last Month"},
    {label:"Last 3 Months"},
    {label:"Last 6 Months"},
    {label:"This Year"},
  ];

  const td=new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  const totH=empStats.reduce((s,e)=>s+e.hours,0);
  const totOT=empStats.reduce((s,e)=>s+e.ot,0);
  const totTr=empStats.reduce((s,e)=>s+e.travelDays,0);
  const totPD=empStats.reduce((s,e)=>s+e.perDiem,0);
  const totLv=empStats.reduce((s,e)=>s+e.leaveDays,0);

  // ═══════ HEADER (Unified Brand Style) ═══════
  let h=(typeof apprNotice==="function"?apprNotice():"")+`<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;border:2px solid #C9A84C;position:relative;overflow:hidden">
    <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,#C9A84C22,transparent);border-radius:50%"></div>
    <div style="display:flex;align-items:center;gap:14px;position:relative">
      <div style="width:56px;height:56px;border:2px solid #C9A84C;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#1B3A6B">
        <span style="font-family:'DM Serif Display',serif;font-size:18px;color:#C9A84C;font-weight:700">EJAF</span>
      </div>
      <div style="flex:1;min-width:0">
        <h2 style="font-family:'DM Serif Display',serif;font-size:22px;color:white;margin:0;line-height:1.2">Flexible Period Reports</h2>
        <div style="font-size:11px;color:#C9A84C;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Girêk</div>
        <div style="font-size:11px;color:#B8CFE8;margin-top:6px">Range: <strong>${f.from||'start'}</strong> → <strong>${f.to||'today'}</strong> · Issued: ${td}</div>
        <div style="font-size:10px;color:#8AA8C8;margin-top:2px;font-style:italic">By: ${escapeHtml(state.profile.name||state.profile.email)}</div>
      </div>
    </div>
  </div>`;

  // ═══════ FILTER CONTROLS (Section 01) ═══════
  h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">01</span> Filter Period</div>
    <div class="form-grid">
      <div class="field"><label>From Date</label>
        <input type="date" value="${f.from}" onchange="window.setReportFrom(this.value)"></div>
      <div class="field"><label>To Date</label>
        <input type="date" value="${f.to}" onchange="window.setReportTo(this.value)"></div>
    </div>
    <div class="field" style="margin-top:10px">
      <label>Filter by Project</label>
      <select onchange="state.reportFilter.project=this.value;render()" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px">
        <option value="">All Projects</option>
        ${[...new Set([...state.daily,...state.overtime,...state.travel].map(r=>r.project).filter(Boolean))].sort().map(p=>`<option value="${escapeHtml(p)}" ${p===f.project?"selected":""}>${escapeHtml(p)}</option>`).join("")}
      </select>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
      ${presets.map((p,i)=>`<button class="btn btn-sm btn-ghost" onclick="window.applyPreset(${i})">${p.label}</button>`).join("")}
    </div>
  </div>`;

  // ═══════ GLOBAL EMPLOYEE FILTER ═══════
  h += renderEmployeeFilterUI("Filter by Employees");

  // ═══════ EXECUTIVE KPI SUMMARY (Section 02) ═══════
  h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">02</span> Executive Summary</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:10px">
      <div style="border:1px solid var(--line);border-left:4px solid #2E5FA3;border-radius:8px;padding:12px;background:var(--card)">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Total Hours</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#2E5FA3;margin-top:2px">${fmtHM(totH)}</div>
        <div style="font-size:10px;color:var(--muted)">${dailyFiltered.length} sessions</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #E65100;border-radius:8px;padding:12px;background:var(--card)">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Overtime</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#E65100;margin-top:2px">${fmtHM(totOT)}</div>
        <div style="font-size:10px;color:var(--muted)">${otFiltered.length} entries</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #2E7D32;border-radius:8px;padding:12px;background:var(--card)">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Travel Days</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#2E7D32;margin-top:2px">${fmtDays(totTr)}</div>
        <div style="font-size:10px;color:var(--muted)">${trFiltered.length} trips</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #6A1B9A;border-radius:8px;padding:12px;background:var(--card)">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Per Diem</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#6A1B9A;margin-top:2px">${fmtMoney(totPD)}</div>
        <div style="font-size:10px;color:var(--muted)">IQD total</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #C62828;border-radius:8px;padding:12px;background:var(--card)">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Leave Days</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#C62828;margin-top:2px">${fmtDays(totLv)}</div>
        <div style="font-size:10px;color:var(--muted)">${lvFiltered.length} entries</div>
      </div>
    </div>
  </div>`;

  // ═══════ DEPARTMENT PERFORMANCE (Section 03) ═══════
  h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">03</span> Department Performance</div>
    ${deptStats.length===0?`<div class="empty">No departments defined yet</div>`:`
    <div style="display:grid;gap:10px;margin-top:10px">
      ${deptStats.map(d=>{
        const pct = totalHours>0 ? (d.hours/totalHours*100) : 0;
        return `<div style="border:1px solid var(--line);border-left:5px solid ${deptColor(d.name)};border-radius:12px;padding:12px 14px;background:var(--card)">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <strong style="color:${deptColor(d.name)};font-size:14px">${escapeHtml(d.name)}</strong>
            <span style="font-family:'DM Serif Display',serif;font-size:18px;color:${deptColor(d.name)}">${fmtHM(d.hours)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${d.count} entries · ${fmtHM(d.otHours)} OT · ${pct.toFixed(1)}% of total</div>
          <div style="height:6px;background:#F0F0F0;border-radius:4px;overflow:hidden"><div style="height:100%;background:${deptColor(d.name)};width:${pct}%;transition:width 0.4s"></div></div>
        </div>`;
      }).join("")}
    </div>`}
  </div>`;

  // ═══════ EMPLOYEE TABLE (Section 04) ═══════
  if(!isEmployee()){
    h+=`<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">04</span> Employee Breakdown</div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);color:white">
          <th style="color:white">Employee</th>
          <th style="color:white">Hours</th>
          <th style="color:white">Sessions</th>
          <th style="color:white">OT</th>
          <th style="color:white">Travel</th>
          <th style="color:white">Per Diem</th>
          <th style="color:white">Leave</th>
        </tr></thead>
        <tbody>${empStats.map((e,idx)=>`<tr style="background:${idx%2?'#F5F8FC':'white'}">
          <td>${employeeBadge(e.emp)}</td>
          <td><strong style="color:#2E5FA3">${fmtHM(e.hours)}</strong></td>
          <td style="color:var(--muted)">${e.sessions}</td>
          <td style="color:#E65100;font-weight:600">${fmtHM(e.ot)}</td>
          <td style="color:#2E7D32;font-weight:600">${fmtDays(e.travelDays)}d</td>
          <td style="color:#6A1B9A;font-weight:600">${fmtMoney(e.perDiem)}</td>
          <td style="color:#C62828;font-weight:600">${(Number(e.leaveDays)||0).toFixed(2)}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </div>`;
  }

  // ═══════ 🔖 PROJECT CODE BREAKDOWN — sessions & hours per code ═══════
  {
    const codedRows = dailyFiltered.filter(r=>r.projectCode);
    if(codedRows.length){
      const grpC={};
      codedRows.forEach(r=>{const k=(r.project||"—")+"|||"+r.projectCode;(grpC[k]=grpC[k]||{n:0,m:0}).n++;grpC[k].m+=Number(r.duration||0);});
      const rowsC=Object.entries(grpC).sort((x,y)=>y[1].m-x[1].m);
      const isPMc=c=>String(c||"").trim().toLowerCase()==="preventive maintenance";
      h+=`<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">🔖</span> Project Code Breakdown</div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Project</th><th>Code</th><th>Sessions</th><th>Hours</th></tr></thead><tbody>
        ${rowsC.map(([k,v])=>{const i3=k.indexOf("|||");const p=k.slice(0,i3),c=k.slice(i3+3);
          return `<tr><td>${escapeHtml(p)}</td><td><span style="font-size:10px;background:${isPMc(c)?'#FFF3E0':'#F0F4FF'};color:${isPMc(c)?'#E65100':'#03308B'};padding:2px 8px;border-radius:8px;font-weight:700">${escapeHtml(c)}</span></td><td style="font-weight:700">${v.n}</td><td style="font-weight:700;color:#1B3A6B">${fmtHM(v.m)}</td></tr>`;}).join("")}
        </tbody></table></div>
      <p style="font-size:10px;color:var(--muted);margin-top:6px">Sessions = number of work-log entries tagged with the code — e.g. how many visits a maintenance round took.</p>
      </div>`;
    }
  }

  // ═══════ EXPORT BUTTONS (admin/HR, or granted canExport) ═══════
  if(isAdmin()||isHR()||hasCap("canExport")) h+=`<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;border:2px solid #C9A84C">
    <div class="sec-hdr" style="color:#C9A84C;border:none;display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">📤</span> Export Options</div>
    <p style="font-size:12px;color:#B8CFE8;margin:0 0 12px">Export this filtered period in various formats — all with unified professional styling.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="exportFilteredExcel()">📊 Export Excel</button>
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="exportFilteredPDF()">📄 Export PDF</button>
      <button class="btn btn-ghost" style="background:transparent;color:white;border:1px solid #C9A84C" onclick="state.reportFilter={from:'',to:'',project:''};render()">↺ Reset Filter</button>
    </div>
  </div>`;

  return h;
}

window.setReportFrom = (v)=>{state.reportFilter.from=v; render();};
window.setReportTo = (v)=>{state.reportFilter.to=v; render();};
window.setReportProject = (v)=>{state.reportFilter.project=v; render();};
window.applyPreset = (i)=>{
  const presets = [
    ()=>{const d=new Date();return [new Date(d.getFullYear(),d.getMonth(),1), d];},
    ()=>{const d=new Date();const e=new Date(d.getFullYear(),d.getMonth(),0);const s=new Date(e.getFullYear(),e.getMonth(),1);return [s,e];},
    ()=>{const d=new Date();return [new Date(d.getFullYear(),d.getMonth()-3,1), d];},
    ()=>{const d=new Date();return [new Date(d.getFullYear(),d.getMonth()-6,1), d];},
    ()=>{const d=new Date();return [new Date(d.getFullYear(),0,1), d];},
  ];
  const [from,to] = presets[i]();
  state.reportFilter.from = from.toISOString().split("T")[0];
  state.reportFilter.to = to.toISOString().split("T")[0];
  render();
};

async function exportFilteredExcel(){
  if(!await needLib("XLSX","Excel export")) return;
  if(typeof XLSX === 'undefined') return toast('Excel library not loaded');
  try{
    const refNo = await generateRefNo('EXCEL_PERIOD');
    const f = state.reportFilter;
    const inRange = (r) => !r.date ? false : (!(f.from && r.date < f.from) && !(f.to && r.date > f.to));
    const leaveInRange = (l) => !l.from ? false : (!(f.from && l.from < f.from) && !(f.to && l.from > f.to));
    let allowedEmps = isEmployee() ? [state.profile.employeeName] : allEmployees();
    const _selX = state.globalEmployeeFilter || [];
    if(_selX.length>0 && !isEmployee()) allowedEmps = allowedEmps.filter(x=>_selX.includes(x));
    allowedEmps = _identityAllowed(allowedEmps);
    const projF = f.project || "";
    const dr = apprFilter(state.daily).filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF||r.project===projF));
    const or = state.overtime.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF||r.project===projF));
    const tr = state.travel.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF||r.project===projF));
    const lv = state.leaves.filter(r=>leaveInRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r));

    const wb = XLSX.utils.book_new();
    const periodStr = `${f.from || 'start'}_to_${f.to || 'end'}`;

    // ═══════ Unified Color Palette ═══════
    const COLORS = {
      navy:"1B3A6B", navyLight:"2E5FA3", gold:"C9A84C",
      green:"2E7D32", orange:"E65100", purple:"6A1B9A", red:"C62828",
      bgAlt:"F5F8FC", lineGray:"D6E4F0", white:"FFFFFF", textDark:"1A1A2E"
    };

    const titleStyle = {
      font:{bold:true,sz:18,color:{rgb:COLORS.gold},name:"Calibri"},
      fill:{fgColor:{rgb:COLORS.navy}},
      alignment:{horizontal:"center",vertical:"center"},
      border:{top:{style:"medium",color:{rgb:COLORS.gold}},bottom:{style:"medium",color:{rgb:COLORS.gold}}}
    };
    const headerStyle = {
      font:{bold:true,sz:11,color:{rgb:COLORS.white},name:"Calibri"},
      fill:{fgColor:{rgb:COLORS.navy}},
      alignment:{horizontal:"center",vertical:"center"},
      border:{top:{style:"thin",color:{rgb:COLORS.navy}},bottom:{style:"thin",color:{rgb:COLORS.gold}},left:{style:"thin",color:{rgb:COLORS.navy}},right:{style:"thin",color:{rgb:COLORS.navy}}}
    };
    const cellStyle = (alt=false) => ({
      font:{sz:10,color:{rgb:COLORS.textDark}},
      fill:{fgColor:{rgb: alt ? COLORS.bgAlt : COLORS.white}},
      alignment:{vertical:"center"},
      border:{top:{style:"thin",color:{rgb:COLORS.lineGray}},bottom:{style:"thin",color:{rgb:COLORS.lineGray}},left:{style:"thin",color:{rgb:COLORS.lineGray}},right:{style:"thin",color:{rgb:COLORS.lineGray}}}
    });
    const numStyle = (alt=false, color=COLORS.textDark) => ({
      ...cellStyle(alt),
      font:{sz:10,bold:true,color:{rgb:color}},
      alignment:{horizontal:"right",vertical:"center"}
    });
    const empNameStyle = (alt=false) => ({
      ...cellStyle(alt),
      font:{bold:true,sz:10,color:{rgb:COLORS.navy}}
    });
    const totalRowStyle = {
      font:{bold:true,sz:11,color:{rgb:COLORS.navy}},
      fill:{fgColor:{rgb:COLORS.gold}},
      alignment:{vertical:"center",horizontal:"center"},
      border:{top:{style:"medium",color:{rgb:COLORS.navy}},bottom:{style:"medium",color:{rgb:COLORS.navy}},left:{style:"thin",color:{rgb:COLORS.gold}},right:{style:"thin",color:{rgb:COLORS.gold}}}
    };

    const setCell = (ws, addr, val, style) => { ws[addr] = {v:val, t: typeof val === 'number' ? 'n' : 's'}; if(style) ws[addr].s = style; };
    const setMerge = (ws, range) => { if(!ws['!merges']) ws['!merges']=[]; ws['!merges'].push(range); };

    // ═══════ SUMMARY SHEET ═══════
    const ws1 = {};
    setCell(ws1,'A1',`EJAF Technology — Girêk  |  Ref: ${refNo}`,titleStyle);
    setMerge(ws1,{s:{r:0,c:0},e:{r:0,c:7}});
    setCell(ws1,'A2',`Period: ${f.from||'start'} → ${f.to||'end'}  |  Generated: ${new Date().toLocaleString('en-GB')} · By: ${state.profile.name||state.profile.email}`,{font:{italic:true,sz:10,color:{rgb:"6B7B8F"}},alignment:{horizontal:"center"}});
    setMerge(ws1,{s:{r:1,c:0},e:{r:1,c:7}});

    // KPI row
    setCell(ws1,'A4','EXECUTIVE SUMMARY',{...headerStyle,fill:{fgColor:{rgb:COLORS.navyLight}}});
    setMerge(ws1,{s:{r:3,c:0},e:{r:3,c:7}});
    setCell(ws1,'A5','Total Hours',headerStyle);
    setCell(ws1,'B5','Overtime',headerStyle);
    setCell(ws1,'C5','Travel Days',headerStyle);
    setCell(ws1,'D5','Per Diem (IQD)',headerStyle);
    setCell(ws1,'E5','Leave Days',headerStyle);
    setCell(ws1,'F5','Sessions',headerStyle);
    setCell(ws1,'G5','OT Entries',headerStyle);
    setCell(ws1,'H5','Trips',headerStyle);
    const totH = dr.reduce((s,r)=>s+Number(r.duration||0),0);
    const totOT = or.reduce((s,r)=>s+Number(r.hours||0),0);
    const totTr = tr.reduce((s,r)=>s+Number(r.days||0),0);
    const totPD = tr.reduce((s,r)=>s+Number(r.perDiem||0),0);
    const totLv = lv.reduce((s,r)=>s+Number(r.days||0),0);
    setCell(ws1,'A6',fmtHM(totH),numStyle(false,COLORS.navyLight));
    setCell(ws1,'B6',fmtHM(totOT),numStyle(false,COLORS.orange));
    setCell(ws1,'C6',totTr,numStyle(false,COLORS.green));
    setCell(ws1,'D6',totPD,numStyle(false,COLORS.purple));
    setCell(ws1,'E6',totLv,numStyle(false,COLORS.red));
    setCell(ws1,'F6',dr.length,numStyle(false));
    setCell(ws1,'G6',or.length,numStyle(false));
    setCell(ws1,'H6',tr.length,numStyle(false));

    // Department totals
    setCell(ws1,'A8','DEPARTMENT TOTALS',{...headerStyle,fill:{fgColor:{rgb:COLORS.purple}}});
    setMerge(ws1,{s:{r:7,c:0},e:{r:7,c:3}});
    setCell(ws1,'A9','Department',headerStyle);
    setCell(ws1,'B9','Hours',headerStyle);
    setCell(ws1,'C9','Entries',headerStyle);
    setCell(ws1,'D9','OT Hours',headerStyle);
    state.departments.forEach((d,idx)=>{
      const row = 10+idx;
      const alt = idx%2===1;
      const dh = dr.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.duration||0),0);
      const dc = dr.filter(r=>r.dept===d.name).length;
      const oh = or.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.hours||0),0);
      setCell(ws1,`A${row}`,d.name,{...empNameStyle(alt),font:{bold:true,sz:11,color:{rgb:deptColor(d.name).replace('#','')}}});
      setCell(ws1,`B${row}`,fmtHM(dh),numStyle(alt));
      setCell(ws1,`C${row}`,dc,numStyle(alt));
      setCell(ws1,`D${row}`,fmtHM(oh),numStyle(alt,COLORS.orange));
    });

    // Employee totals
    const empRowStart = 11 + state.departments.length;
    setCell(ws1,`A${empRowStart}`,'EMPLOYEE TOTALS',{...headerStyle,fill:{fgColor:{rgb:COLORS.green}}});
    setMerge(ws1,{s:{r:empRowStart-1,c:0},e:{r:empRowStart-1,c:6}});
    const empHeadRow = empRowStart + 1;
    setCell(ws1,`A${empHeadRow}`,'Employee',headerStyle);
    setCell(ws1,`B${empHeadRow}`,'Hours',headerStyle);
    setCell(ws1,`C${empHeadRow}`,'Sessions',headerStyle);
    setCell(ws1,`D${empHeadRow}`,'OT',headerStyle);
    setCell(ws1,`E${empHeadRow}`,'Travel',headerStyle);
    setCell(ws1,`F${empHeadRow}`,'Per Diem',headerStyle);
    setCell(ws1,`G${empHeadRow}`,'Leaves',headerStyle);
    allowedEmps.forEach((e,idx)=>{
      const row = empHeadRow + 1 + idx;
      const alt = idx%2===1;
      const eh = dr.filter(r=>r.employee===e).reduce((s,r)=>s+Number(r.duration||0),0);
      const es = dr.filter(r=>r.employee===e).length;
      const eo = or.filter(r=>r.employee===e).reduce((s,r)=>s+Number(r.hours||0),0);
      const td = tr.filter(r=>r.employee===e).reduce((s,r)=>s+Number(r.days||0),0);
      const pd = tr.filter(r=>r.employee===e).reduce((s,r)=>s+Number(r.perDiem||0),0);
      const lvd = lv.filter(r=>r.employee===e).reduce((s,r)=>s+Number(r.days||0),0);
      setCell(ws1,`A${row}`,e,empNameStyle(alt));
      setCell(ws1,`B${row}`,fmtHM(eh),numStyle(alt,COLORS.navyLight));
      setCell(ws1,`C${row}`,es,numStyle(alt));
      setCell(ws1,`D${row}`,fmtHM(eo),numStyle(alt,COLORS.orange));
      setCell(ws1,`E${row}`,td,numStyle(alt,COLORS.green));
      setCell(ws1,`F${row}`,pd,numStyle(alt,COLORS.purple));
      setCell(ws1,`G${row}`,lvd,numStyle(alt,COLORS.red));
    });
    const grandRow = empHeadRow + 1 + allowedEmps.length;
    setCell(ws1,`A${grandRow}`,'GRAND TOTAL',totalRowStyle);
    setCell(ws1,`B${grandRow}`,fmtHM(totH),totalRowStyle);
    setCell(ws1,`C${grandRow}`,dr.length,totalRowStyle);
    setCell(ws1,`D${grandRow}`,fmtHM(totOT),totalRowStyle);
    setCell(ws1,`E${grandRow}`,totTr,totalRowStyle);
    setCell(ws1,`F${grandRow}`,totPD,totalRowStyle);
    setCell(ws1,`G${grandRow}`,totLv,totalRowStyle);

    ws1['!ref'] = `A1:H${grandRow}`;
    ws1['!cols'] = [{wch:24},{wch:14},{wch:12},{wch:14},{wch:12},{wch:14},{wch:12},{wch:10}];
    ws1['!rows'] = [{hpt:28},{hpt:18},{hpt:8},{hpt:22},{hpt:20},{hpt:22}];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // ═══════ DETAIL SHEETS WITH STYLE ═══════
    const buildDetail = (title, headers, data, accentColor) => {
      const ws = {};
      const accent = accentColor.replace('#','');
      setCell(ws,'A1',title.toUpperCase(),{...titleStyle, fill:{fgColor:{rgb:accent}}});
      setMerge(ws,{s:{r:0,c:0},e:{r:0,c:headers.length-1}});
      headers.forEach((h,i)=>{
        const col = String.fromCharCode(65+i);
        setCell(ws,`${col}2`,h,headerStyle);
      });
      data.forEach((row,idx)=>{
        const alt = idx%2===1;
        const rowNum = 3+idx;
        row.forEach((val,colIdx)=>{
          const col = String.fromCharCode(65+colIdx);
          if(colIdx===0) setCell(ws,`${col}${rowNum}`,val,empNameStyle(alt));
          else if(typeof val === 'number') setCell(ws,`${col}${rowNum}`,val,numStyle(alt));
          else setCell(ws,`${col}${rowNum}`,val,cellStyle(alt));
        });
      });
      ws['!ref'] = `A1:${String.fromCharCode(64+headers.length)}${2+data.length}`;
      ws['!rows'] = [{hpt:26},{hpt:20}];
      return ws;
    };

    const dailyData = dr.map(r=>[employeePlainBadge(r.employee||''),r.date||'',r.project||'',r.dept||'',r.location||'',fmtHM(r.duration),r.notes||'']);
    const wsD = buildDetail('Daily Log', ['Employee','Date','Project','Department','Location','Hours','Notes'], dailyData, COLORS.navyLight);
    wsD['!cols']=[{wch:26},{wch:12},{wch:26},{wch:16},{wch:14},{wch:10},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsD, 'Daily');

    const otData = or.map(r=>[employeePlainBadge(r.employee||''),r.date||'',r.start||'',r.end||'',fmtHM(r.hours),r.project||'',r.dept||'',r.location||'',r.notes||'']);
    const wsO = buildDetail('Overtime Log', ['Employee','Date','Start','End','OT Hours','Project','Department','Location','Notes'], otData, COLORS.orange);
    wsO['!cols']=[{wch:26},{wch:12},{wch:8},{wch:8},{wch:12},{wch:26},{wch:16},{wch:16},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsO, 'Overtime');

    const trData = tr.map(r=>[employeePlainBadge(r.employee||''),r.date||'',trEnd(r),r.days||0,r.project||'',r.location||'',r.perDiem||0,(r.perDiemStatus||'received')==='received'?'Received':'Not Received',r.notes||'']);
    const wsT = buildDetail('Travel Log', ['Employee','From','To','Days','Project','Location','Per Diem','Per Diem Status','Notes'], trData, COLORS.green);
    wsT['!cols']=[{wch:26},{wch:12},{wch:12},{wch:8},{wch:26},{wch:16},{wch:14},{wch:16},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsT, 'Travel');

    const lvData = lv.map(r=>{
      const lt = (typeof leaveTypeInfo==='function') ? leaveTypeInfo(r.type) : {label:r.type||''};
      return [employeePlainBadge(r.employee||''), lt.label||r.type||'', r.from||'', r.to||'', (typeof computeLeaveAmount==='function' ? daysNum(computeLeaveAmount(r).days) : (r.days||0)), r.notes||''];
    });
    const wsL = buildDetail('Leaves Log', ['Employee','Type','From','To','Days','Notes'], lvData, COLORS.red);
    wsL['!cols']=[{wch:26},{wch:18},{wch:12},{wch:12},{wch:8},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsL, 'Leaves');

    // ── Project breakdown sheet ────────────────────────────────────────
    // Grouped from the entries, so work booked to a project that was later
    // renamed still appears rather than dropping out of the totals.
    const _pm={};
    dr.forEach(r=>{ const k=String(r.project||'').trim()||'— Unassigned';
      if(!_pm[k]) _pm[k]={h:0,n:0,ot:0,emps:new Set()};
      _pm[k].h+=Number(r.duration||0); _pm[k].n++; _pm[k].emps.add(r.employee); });
    or.forEach(r=>{ const k=String(r.project||'').trim()||'— Unassigned';
      if(!_pm[k]) _pm[k]={h:0,n:0,ot:0,emps:new Set()};
      _pm[k].ot+=Number(r.hours||0); });
    const _pk=Object.keys(_pm).sort((a,b)=>{
      if(a.startsWith('—')) return 1; if(b.startsWith('—')) return -1;
      return _pm[b].h-_pm[a].h; });
    const _pTot=_pk.reduce((s,k)=>s+_pm[k].h,0);
    const projData=_pk.map(k=>[k,_pm[k].n,_pm[k].emps.size,fmtHM(_pm[k].h),
      _pm[k].ot?fmtHM(_pm[k].ot):'—',
      (_pTot>0?(_pm[k].h/_pTot*100).toFixed(1):'0.0')+'%']);
    projData.push(['TOTAL', dr.length, '', fmtHM(_pTot), fmtHM(totOT), '100%']);
    const wsP = buildDetail('Project Breakdown',
      ['Project','Sessions','People','Hours','Overtime','Share'], projData, COLORS.navyLight);
    wsP['!cols']=[{wch:30},{wch:11},{wch:9},{wch:12},{wch:12},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsP, 'By Project');

    // ── Project-code breakdown sheet ───────────────────────────────────
    const _cm={};
    dr.forEach(r=>{ const k=String(r.projectCode||'').trim()||'— No code';
      if(!_cm[k]) _cm[k]={h:0,n:0,projects:new Set()};
      _cm[k].h+=Number(r.duration||0); _cm[k].n++;
      if(r.project) _cm[k].projects.add(r.project); });
    const _ck=Object.keys(_cm).sort((a,b)=>{
      if(a.startsWith('—')) return 1; if(b.startsWith('—')) return -1;
      return _cm[b].h-_cm[a].h; });
    const _cTot=_ck.reduce((s,k)=>s+_cm[k].h,0);
    const codeData=_ck.map(k=>[k, Array.from(_cm[k].projects).sort().join(' · ')||'—',
      _cm[k].n, fmtHM(_cm[k].h),
      (_cTot>0?(_cm[k].h/_cTot*100).toFixed(1):'0.0')+'%']);
    codeData.push(['TOTAL','', dr.length, fmtHM(_cTot), '100%']);
    const wsC = buildDetail('Project Code Breakdown',
      ['Code','Projects','Sessions','Hours','Share'], codeData, COLORS.orange);
    wsC['!cols']=[{wch:24},{wch:34},{wch:11},{wch:12},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsC, 'By Code');

    XLSX.writeFile(wb, `Period_Report_${periodStr}.xlsx`);
    toast('Filtered Excel exported ✓');
  }catch(e){
    console.error(e);
    toast('Export failed: '+e.message);
  }
}
window.exportFilteredExcel = exportFilteredExcel;

// ═══════════════════════════════════════════════════════════════════════
//  EXPORT FILTERED PDF — Unified Style for the Reports Tab
// ═══════════════════════════════════════════════════════════════════════
async function exportFilteredPDF(){
  try{
    const f = state.reportFilter;
    const inRange = (r) => !r.date ? false : (!(f.from && r.date < f.from) && !(f.to && r.date > f.to));
    const leaveInRange = (l) => !l.from ? false : (!(f.from && l.from < f.from) && !(f.to && l.from > f.to));
    let allowedEmps = isEmployee() ? [state.profile.employeeName] : allEmployees();
    const _selX = state.globalEmployeeFilter || [];
    if(_selX.length>0 && !isEmployee()) allowedEmps = allowedEmps.filter(x=>_selX.includes(x));
    allowedEmps = _identityAllowed(allowedEmps);
    const projF = f.project || "";
    const dr = apprFilter(state.daily).filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF||r.project===projF));
    const or = state.overtime.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF||r.project===projF));
    const tr = state.travel.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF||r.project===projF));
    const lv = state.leaves.filter(r=>leaveInRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r));

    const totH = dr.reduce((s,r)=>s+Number(r.duration||0),0);
    const totOT = or.reduce((s,r)=>s+Number(r.hours||0),0);
    const totTr = tr.reduce((s,r)=>s+Number(r.days||0),0);
    const totPD = tr.reduce((s,r)=>s+Number(r.perDiem||0),0);
    const totLv = lv.reduce((s,r)=>s+Number(r.days||0),0);
    const todayStr = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});

    // Department breakdown
    const deptStats = state.departments.map(d=>{
      const dh = dr.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.duration||0),0);
      const dc = dr.filter(r=>r.dept===d.name).length;
      const oh = or.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.hours||0),0);
      return {...d, hours:dh, count:dc, otHours:oh};
    });

    // Employee summary
    const empStats = allowedEmps.map(emp=>{
      const eDaily = dr.filter(r=>r.employee===emp);
      const eOT = or.filter(r=>r.employee===emp);
      const eTr = tr.filter(r=>r.employee===emp);
      const eLv = lv.filter(r=>r.employee===emp);
      return {
        emp,
        hours: eDaily.reduce((s,r)=>s+Number(r.duration||0),0),
        sessions: eDaily.length,
        ot: eOT.reduce((s,r)=>s+Number(r.hours||0),0),
        travelDays: eTr.reduce((s,r)=>s+Number(r.days||0),0),
        perDiem: eTr.reduce((s,r)=>s+Number(r.perDiem||0),0),
        leaveDays: eLv.reduce((sum, r) => {
        if(r.days !== undefined && r.days !== null && !isNaN(Number(r.days))) return sum + Number(r.days);
        if(r.hours !== undefined && r.hours !== null && !isNaN(Number(r.hours))) return sum + (Number(r.hours) / WORK_HOURS_PER_DAY);
        return sum + computeLeaveAmount(r).days;
      }, 0),
        byDept: state.departments.reduce((acc,d)=>{acc[d.name]=eDaily.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.duration||0),0);return acc;},{}),
      };
    });


    // ── Project breakdown ───────────────────────────────────────────────
    // Grouped from the entries themselves rather than the project register, so
    // work booked to a project that was later renamed or removed still appears
    // instead of vanishing from the totals.
    const projMap={};
    const addTo=(map,key,h,ot,n)=>{ const k=String(key||"").trim()||"\u2014 Unassigned";
      if(!map[k]) map[k]={hours:0,ot:0,count:0,emps:new Set()};
      map[k].hours+=h; map[k].ot+=ot; map[k].count+=n; return map[k]; };
    dr.forEach(r=>{ addTo(projMap, r.project, Number(r.duration||0), 0, 1).emps.add(r.employee); });
    or.forEach(r=>{ addTo(projMap, r.project, 0, Number(r.hours||0), 0); });
    const projStats=Object.keys(projMap).sort((a,b)=>{
      if(a.startsWith("\u2014")) return 1; if(b.startsWith("\u2014")) return -1;
      return projMap[b].hours-projMap[a].hours;
    }).map(k=>({name:k, ...projMap[k], emps:projMap[k].emps.size}));
    const projTotal=projStats.reduce((s,p)=>s+p.hours,0);

    // ── Project-code breakdown ──────────────────────────────────────────
    // Codes are recorded on each daily entry (e.g. AC-001, Preventive
    // Maintenance), which is what finance codes the work against.
    const codeMap={};
    dr.forEach(r=>{ const k=String(r.projectCode||"").trim()||"\u2014 No code";
      if(!codeMap[k]) codeMap[k]={hours:0,count:0,projects:new Set()};
      codeMap[k].hours+=Number(r.duration||0); codeMap[k].count++;
      if(r.project) codeMap[k].projects.add(r.project); });
    const codeStats=Object.keys(codeMap).sort((a,b)=>{
      if(a.startsWith("\u2014")) return 1; if(b.startsWith("\u2014")) return -1;
      return codeMap[b].hours-codeMap[a].hours;
    }).map(k=>({code:k, hours:codeMap[k].hours, count:codeMap[k].count,
                projects:Array.from(codeMap[k].projects).sort()}));
    const codeTotal=codeStats.reduce((s,x)=>s+x.hours,0);

    const PC=["#03308B","#C9A84C","#2E7D32","#E65100","#6A1B9A","#00897B","#3949AB","#D81B60","#5D4037"];

    const kpiCards = `<div class="kpi-grid">
      <div class="kpi" style="border-left-color:#2E5FA3"><div class="kpi-label">Total Hours</div><div class="kpi-val" style="color:#2E5FA3">${fmtHM(totH)}</div><div class="kpi-sub">${dr.length} sessions</div></div>
      <div class="kpi" style="border-left-color:#E65100"><div class="kpi-label">Overtime</div><div class="kpi-val" style="color:#E65100">${fmtHM(totOT)}</div><div class="kpi-sub">${or.length} entries</div></div>
      <div class="kpi" style="border-left-color:#2E7D32"><div class="kpi-label">Travel Days</div><div class="kpi-val" style="color:#2E7D32">${fmtDays(totTr)}</div><div class="kpi-sub">${tr.length} trips</div></div>
      <div class="kpi" style="border-left-color:#6A1B9A"><div class="kpi-label">Per Diem</div><div class="kpi-val" style="color:#6A1B9A">${fmtMoney(totPD)}</div><div class="kpi-sub">IQD total</div></div>
      <div class="kpi" style="border-left-color:#C62828"><div class="kpi-label">Leave Days</div><div class="kpi-val" style="color:#C62828">${fmtDays(totLv)}</div><div class="kpi-sub">${lv.length} entries</div></div>
    </div>`;

    // Department cards
    const deptBlocks = deptStats.map(d=>{
      const totalDept = deptStats.reduce((s,x)=>s+x.hours,0);
      const pct = totalDept>0 ? (d.hours/totalDept*100).toFixed(1) : '0.0';
      return `<div class="dept-card" style="border-left-color:${deptColor(d.name)}">
        <div class="dept-row"><span class="dept-name" style="color:${deptColor(d.name)}">${escapeHtml(d.name)}</span><span class="dept-val" style="color:${deptColor(d.name)}">${fmtHM(d.hours)}</span></div>
        <div class="dept-sub">${d.count} entries · ${fmtHM(d.otHours)} OT · ${pct}% of total</div>
        <div class="bar"><div class="bar-fill" style="background:${deptColor(d.name)};width:${pct}%"></div></div>
      </div>`;
    }).join('');

    // Employee summary table
    const deptHeaders = state.departments.map(d=>`<th style="border-bottom:3px solid ${deptColor(d.name)}">${escapeHtml(d.name.slice(0,10))}</th>`).join('');
    const empRows = empStats.map(r=>`<tr>
      <td><strong style="color:#1B3A6B">${escapeHtml(r.emp)}</strong></td>
      ${state.departments.map(d=>`<td style="color:${deptColor(d.name)};font-weight:700">${fmtHM(r.byDept[d.name]||0)}</td>`).join('')}
      <td><strong style="color:#1B3A6B">${fmtHM(r.hours)}</strong></td>
      <td style="color:#E65100;font-weight:600">${fmtHM(r.ot)}</td>
      <td style="color:#2E7D32;font-weight:600">${fmtDays(r.travelDays)}</td>
      <td style="color:#6A1B9A;font-weight:600">${fmtMoney(r.perDiem)}</td>
      <td style="color:#C62828;font-weight:600">${fmtDays(r.leaveDays)}</td>
    </tr>`).join("");
    const grandRow = !isEmployee()?`<tr class="grand">
      <td>GRAND TOTAL</td>
      ${state.departments.map(d=>`<td>${fmtHM(empStats.reduce((s,e)=>s+(e.byDept[d.name]||0),0))}</td>`).join('')}
      <td>${fmtHM(totH)}</td><td>${fmtHM(totOT)}</td><td>${fmtDays(totTr)}</td><td>${fmtMoney(totPD)}</td><td>${fmtDays(totLv)}</td>
    </tr>`:'';

    const projBlocks = projStats.map((p,i)=>{
      const col=PC[i%PC.length];
      const pct=projTotal>0?(p.hours/projTotal*100).toFixed(1):'0.0';
      return `<div class="dept-card" style="border-left-color:${col}">
        <div class="dept-row"><span class="dept-name" style="color:${col}">${escapeHtml(p.name)}</span>
          <span class="dept-val" style="color:${col}">${fmtHM(p.hours)}</span></div>
        <div class="dept-sub">${p.count} session${p.count===1?'':'s'} · ${p.emps} employee${p.emps===1?'':'s'}${p.ot?` · ${fmtHM(p.ot)} OT`:''} · ${pct}% of hours</div>
        <div class="bar"><div class="bar-fill" style="background:${col};width:${pct}%"></div></div>
      </div>`;}).join('');

    const projRows = projStats.map(p=>`<tr>
      <td><strong style="color:#1B3A6B">${escapeHtml(p.name)}</strong></td>
      <td style="text-align:right">${p.count}</td>
      <td style="text-align:right">${p.emps}</td>
      <td style="text-align:right;font-weight:700">${fmtHM(p.hours)}</td>
      <td style="text-align:right;color:#E65100;font-weight:600">${p.ot?fmtHM(p.ot):'—'}</td>
      <td style="text-align:right;color:#6B7B8F">${projTotal>0?(p.hours/projTotal*100).toFixed(1):'0.0'}%</td>
    </tr>`).join('');

    const codeRows = codeStats.map(x=>`<tr>
      <td><strong style="color:#1B3A6B">${escapeHtml(x.code)}</strong></td>
      <td style="font-size:9px;color:#6B7B8F">${x.projects.length?x.projects.map(p=>escapeHtml(p)).join(' · '):'—'}</td>
      <td style="text-align:right">${x.count}</td>
      <td style="text-align:right;font-weight:700">${fmtHM(x.hours)}</td>
      <td style="text-align:right;color:#6B7B8F">${codeTotal>0?(x.hours/codeTotal*100).toFixed(1):'0.0'}%</td>
    </tr>`).join('');

    const rangeLabel=`${f.from||'Start'} → ${f.to||'Today'}${f.project?' · Project: '+f.project:''}`;
    const kpiCardsU=`<div class="kr">
      <div class="kc kb"><div class="kl">Total Hours</div><div class="kv">${fmtHM(totH)}</div><div class="ks">${dr.length} sessions</div></div>
      <div class="kc ko"><div class="kl">Overtime</div><div class="kv">${fmtHM(totOT)}</div><div class="ks">${or.length} entries</div></div>
      <div class="kc kg"><div class="kl">Travel Days</div><div class="kv">${fmtDays(totTr)}</div><div class="ks">${tr.length} trips</div></div>
      <div class="kc kp"><div class="kl">Per Diem</div><div class="kv">${fmtMoney(totPD)}</div><div class="ks">IQD total</div></div>
      <div class="kc krd"><div class="kl">Leave Days</div><div class="kv">${fmtDays(totLv)}</div><div class="ks">${lv.length} entries</div></div>
    </div>`;
    // Counted section numbers: adding a section never means renumbering by hand.
    const KS=(()=>{let n=0;return()=>String(++n).padStart(2,"0");})();
    const bodyHTMLF=`
      <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
        📄 Choose <strong>"Save as PDF"</strong> in the print dialog
        <br><br><button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
        <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
      </div>
      <div class="ksec"><span class="kbad">${KS()}</span><h3>Executive Summary</h3></div>
      ${kpiCardsU}
      <div class="ksec"><span class="kbad">${KS()}</span><h3>Department Performance</h3></div>
      ${deptBlocks||'<div class="empty">No departments configured</div>'}
      ${!isEmployee()?`<div class="ksec"><span class="kbad">${KS()}</span><h3>Employee Breakdown</h3></div>
      <table><thead><tr><th>Employee</th>${deptHeaders}<th>Total</th><th>OT</th><th>Travel</th><th>Per Diem</th><th>Leave</th></tr></thead>
      <tbody>${empRows}</tbody><tfoot>${grandRow}</tfoot></table>`:''}

      ${projStats.length?`<div class="ksec"><span class="kbad">${KS()}</span><h3>Project Breakdown</h3></div>
      <div class="grid2">${projBlocks}</div>
      <table><thead><tr><th>Project</th><th style="text-align:right">Sessions</th><th style="text-align:right">People</th>
        <th style="text-align:right">Hours</th><th style="text-align:right">Overtime</th><th style="text-align:right">Share</th></tr></thead>
      <tbody>${projRows}</tbody>
      <tfoot><tr><td>TOTAL</td><td style="text-align:right">${dr.length}</td><td style="text-align:right">—</td>
        <td style="text-align:right">${fmtHM(projTotal)}</td><td style="text-align:right">${fmtHM(totOT)}</td>
        <td style="text-align:right">100%</td></tr></tfoot></table>`:''}

      ${codeStats.length?`<div class="ksec"><span class="kbad">${KS()}</span><h3>Project Code Breakdown</h3></div>
      <p style="font-size:9.5px;color:#6B7B8F;line-height:1.7;margin:0 0 6px">
        Hours grouped by the code recorded on each entry — the reference the work is charged against.
        Entries carrying no code are listed last, so these figures still reconcile with the summary above.</p>
      <table><thead><tr><th>Code</th><th>Projects</th><th style="text-align:right">Sessions</th>
        <th style="text-align:right">Hours</th><th style="text-align:right">Share</th></tr></thead>
      <tbody>${codeRows}</tbody>
      <tfoot><tr><td>TOTAL</td><td></td><td style="text-align:right">${dr.length}</td>
        <td style="text-align:right">${fmtHM(codeTotal)}</td><td style="text-align:right">100%</td></tr></tfoot></table>`:''}
      <script>setTimeout(()=>window.print(),500)<\/script>`;
    await openReportPDF("PERIOD_REPORT", rangeLabel, bodyHTMLF);
    toast('PDF export ready!');
  }catch(e){
    console.error(e);
    toast('PDF export failed: '+e.message);
  }
}
window.exportFilteredPDF = exportFilteredPDF;

// ═══════════════════════════════════════════════════════════════════════
//  EXPORT: Real .xlsx (SheetJS) — in addition to existing CSV/PDF
// ═══════════════════════════════════════════════════════════════════════
async function exportExcel(){
  if(!await needLib("XLSX","Excel export")) return;
  if(typeof XLSX === 'undefined'){return toast('Excel library not loaded');}
  try{
    const period = (typeof getPeriod==='function' ? getPeriod() : 'Report');
    const periodSafe = period.replace(/[^a-z0-9]+/gi,'_');
    const todayStr = new Date().toISOString().split('T')[0];
    const refNo = await generateRefNo('EXCEL_HR');
    const wb = XLSX.utils.book_new();
    const s = summary();
    const tot = k => s.reduce((a,b)=>a+b[k],0);

    // Color palette matching the app
    const COLORS = {
      navy: "1B3A6B", navyLight: "2E5FA3", gold: "C9A84C", goldDark: "B58E2E",
      green: "2E7D32", greenBg: "E8F2E8",
      orange: "E65100", orangeBg: "FCEAE0",
      purple: "6A1B9A", purpleBg: "F0E8F7",
      yellow: "FFF2CC", yellowText: "7F6000",
      bgAlt: "F5F8FC", lineGray: "D6E4F0",
      white: "FFFFFF", textDark: "1A1A2E"
    };

    // Style helpers
    const titleStyle = {
      font:{bold:true,sz:18,color:{rgb:COLORS.gold},name:"Calibri"},
      fill:{fgColor:{rgb:COLORS.navy}},
      alignment:{horizontal:"center",vertical:"center"},
      border:{top:{style:"medium",color:{rgb:COLORS.gold}},bottom:{style:"medium",color:{rgb:COLORS.gold}}}
    };
    const subtitleStyle = {
      font:{italic:true,sz:10,color:{rgb:"6B7B8F"}},
      alignment:{horizontal:"center"}
    };
    const headerStyle = {
      font:{bold:true,sz:11,color:{rgb:COLORS.white},name:"Calibri"},
      fill:{fgColor:{rgb:COLORS.navy}},
      alignment:{horizontal:"center",vertical:"center"},
      border:{
        top:{style:"thin",color:{rgb:COLORS.navy}},
        bottom:{style:"thin",color:{rgb:COLORS.gold}},
        left:{style:"thin",color:{rgb:COLORS.navy}},
        right:{style:"thin",color:{rgb:COLORS.navy}}
      }
    };
    const cellStyle = (alt=false) => ({
      font:{sz:10,color:{rgb:COLORS.textDark}},
      fill:{fgColor:{rgb: alt ? COLORS.bgAlt : COLORS.white}},
      alignment:{vertical:"center"},
      border:{
        top:{style:"thin",color:{rgb:COLORS.lineGray}},
        bottom:{style:"thin",color:{rgb:COLORS.lineGray}},
        left:{style:"thin",color:{rgb:COLORS.lineGray}},
        right:{style:"thin",color:{rgb:COLORS.lineGray}}
      }
    });
    const numStyle = (alt=false) => ({
      ...cellStyle(alt),
      font:{sz:10,bold:true,color:{rgb:COLORS.textDark}},
      alignment:{horizontal:"right",vertical:"center"}
    });
    const empNameStyle = (alt=false) => ({
      ...cellStyle(alt),
      font:{bold:true,sz:10,color:{rgb:COLORS.navy}}
    });
    const deptStyle = (color, alt=false) => ({
      ...cellStyle(alt),
      font:{bold:true,sz:10,color:{rgb:color.replace('#','')}},
      alignment:{horizontal:"center",vertical:"center"}
    });
    const totalRowStyle = {
      font:{bold:true,sz:11,color:{rgb:COLORS.navy}},
      fill:{fgColor:{rgb:"BDD7EE"}},
      alignment:{vertical:"center"},
      border:{
        top:{style:"medium",color:{rgb:COLORS.navy}},
        bottom:{style:"medium",color:{rgb:COLORS.navy}}
      }
    };

    // Helper to apply style to a cell
    const setCell = (ws, addr, value, style) => {
      ws[addr] = {v: value, t: typeof value === 'number' ? 'n' : 's', s: style};
    };
    const setMerge = (ws, range) => {
      ws['!merges'] = ws['!merges'] || [];
      ws['!merges'].push(range);
    };

    // ═════════════════════════════════════════════════════
    // SHEET 1: SUMMARY (with full styling)
    // ═════════════════════════════════════════════════════
    const ws1 = {};
    const depts = state.departments;
    const numCols = 6 + depts.length; // Employee + depts + Total + OT + Travel + PerDiem + Leave
    const lastColLetter = XLSX.utils.encode_col(numCols - 1);

    // Title row (row 1)
    setCell(ws1, 'A1', `EJAF TECHNOLOGY — Girêk  |  Ref: ${refNo}`, titleStyle);
    setMerge(ws1, {s:{r:0,c:0},e:{r:0,c:numCols-1}});

    // Subtitle (row 2)
    setCell(ws1, 'A2', `Period: ${period}  |  Ref: ${refNo}  |  Generated: ${new Date().toLocaleString('en-GB')}  |  By: ${state.profile.name||state.profile.email}`, subtitleStyle);
    setMerge(ws1, {s:{r:1,c:0},e:{r:1,c:numCols-1}});

    // Empty row 3, then headers row 4
    ws1['!rows'] = [{hpt:28},{hpt:18},{hpt:8},{hpt:22}]; // row heights

    // Headers (row 4 = index 3)
    setCell(ws1, 'A4', 'Employee', headerStyle);
    depts.forEach((d, i) => {
      const col = XLSX.utils.encode_col(1 + i);
      setCell(ws1, `${col}4`, d.name, {
        ...headerStyle,
        fill:{fgColor:{rgb: deptColor(d.name).replace('#','')}}
      });
    });
    const totalCol = XLSX.utils.encode_col(1 + depts.length);
    const otCol = XLSX.utils.encode_col(2 + depts.length);
    const trCol = XLSX.utils.encode_col(3 + depts.length);
    const pdCol = XLSX.utils.encode_col(4 + depts.length);
    const lvCol = XLSX.utils.encode_col(5 + depts.length);
    setCell(ws1, `${totalCol}4`, 'Total Hrs', headerStyle);
    setCell(ws1, `${otCol}4`, 'OT Hrs', headerStyle);
    setCell(ws1, `${trCol}4`, 'Travel Days', headerStyle);
    setCell(ws1, `${pdCol}4`, 'Per Diem (IQD)', headerStyle);
    setCell(ws1, `${lvCol}4`, 'Leave Days', {...headerStyle, fill:{fgColor:{rgb:'C62828'}}});

    // Data rows (starting row 5 = index 4)
    s.forEach((r, idx) => {
      const rowNum = 5 + idx;
      const alt = idx % 2 === 1;
      setCell(ws1, `A${rowNum}`, r.emp, empNameStyle(alt));
      depts.forEach((d, i) => {
        const col = XLSX.utils.encode_col(1 + i);
        const hrs = r.byDept[d.name] || 0;
        setCell(ws1, `${col}${rowNum}`, fmtHM(hrs), deptStyle(deptColor(d.name), alt));
      });
      setCell(ws1, `${totalCol}${rowNum}`, fmtHM(r.total), {...numStyle(alt), font:{bold:true,sz:11,color:{rgb:COLORS.navy}}});
      setCell(ws1, `${otCol}${rowNum}`, fmtHM(r.ot), numStyle(alt));
      setCell(ws1, `${trCol}${rowNum}`, r.tDays || 0, numStyle(alt));
      setCell(ws1, `${pdCol}${rowNum}`, r.pd || 0, {...numStyle(alt), numFmt:'#,##0'});
      setCell(ws1, `${lvCol}${rowNum}`, Math.round((r.leaveDays||0)*100)/100, {...numStyle(alt), font:{bold:true,sz:11,color:{rgb:'C62828'}}});
    });

    // Grand total row
    if(!isEmployee()){
      const totalRow = 5 + s.length;
      setCell(ws1, `A${totalRow}`, 'GRAND TOTAL', totalRowStyle);
      depts.forEach((d, i) => {
        const col = XLSX.utils.encode_col(1 + i);
        const sum = s.reduce((acc, r) => acc + (r.byDept[d.name] || 0), 0);
        setCell(ws1, `${col}${totalRow}`, fmtHM(sum), {...totalRowStyle, alignment:{horizontal:"center"}});
      });
      setCell(ws1, `${totalCol}${totalRow}`, fmtHM(tot('total')), {...totalRowStyle, alignment:{horizontal:"right"}});
      setCell(ws1, `${otCol}${totalRow}`, fmtHM(tot('ot')), {...totalRowStyle, alignment:{horizontal:"right"}});
      setCell(ws1, `${trCol}${totalRow}`, tot('tDays'), {...totalRowStyle, alignment:{horizontal:"right"}});
      setCell(ws1, `${pdCol}${totalRow}`, tot('pd'), {...totalRowStyle, alignment:{horizontal:"right"}, numFmt:'#,##0'});
      setCell(ws1, `${lvCol}${totalRow}`, s.reduce((a,b)=>a+(b.leaveDays||0),0), {...totalRowStyle, alignment:{horizontal:"right"}});
    }

    // Set range and column widths
    const lastRow = isEmployee() ? 4 + s.length : 5 + s.length;
    ws1['!ref'] = `A1:${lastColLetter}${lastRow}`;
    ws1['!cols'] = [
      {wch:24},
      ...depts.map(()=>({wch:13})),
      {wch:11},
      {wch:10},
      {wch:11},
      {wch:14},
      {wch:11},
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // ═════════════════════════════════════════════════════
    // SHEET 2-4: Detail logs (with styling)
    // ═════════════════════════════════════════════════════
    const buildDetailSheet = (title, headers, rows, accentColor) => {
      const ws = {};
      const cols = headers.length;
      const lastCol = XLSX.utils.encode_col(cols - 1);

      // Title
      setCell(ws, 'A1', title.toUpperCase(), {
        font:{bold:true,sz:14,color:{rgb:COLORS.white}},
        fill:{fgColor:{rgb: accentColor.replace('#','')}},
        alignment:{horizontal:"center",vertical:"center"}
      });
      setMerge(ws, {s:{r:0,c:0},e:{r:0,c:cols-1}});

      // Headers (row 2)
      headers.forEach((h, i) => {
        const col = XLSX.utils.encode_col(i);
        setCell(ws, `${col}2`, h, headerStyle);
      });

      // Data
      rows.forEach((row, idx) => {
        const rowNum = 3 + idx;
        const alt = idx % 2 === 1;
        row.forEach((val, i) => {
          const col = XLSX.utils.encode_col(i);
          const isNum = typeof val === 'number';
          setCell(ws, `${col}${rowNum}`, val, isNum ? numStyle(alt) : cellStyle(alt));
        });
      });

      ws['!ref'] = `A1:${lastCol}${Math.max(2, 2 + rows.length)}`;
      ws['!rows'] = [{hpt:24},{hpt:20}];
      return ws;
    };

    // Daily
    const dRows = applyReportFilters(isHR() ? state.daily : state.daily.filter(r=>r.employee===state.profile.employeeName));
    const dailyData = dRows.map(r=>[r.date||'', r.employee||'', r.project||'', r.dept||'', r.location||'', r.start||'', r.end||'', fmtHM(r.duration), r.notes||'']);
    const ws2 = buildDetailSheet('Daily Work Log', ['Date','Employee','Project','Department','Location','Start','End','Duration','Notes'], dailyData, '#'+COLORS.navy);
    ws2['!cols']=[{wch:12},{wch:22},{wch:26},{wch:14},{wch:8},{wch:8},{wch:11},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws2, 'Daily Work');

    // Overtime
    const oRows = applyReportFilters(isHR() ? state.overtime : state.overtime.filter(r=>r.employee===state.profile.employeeName));
    const otData = oRows.map(r=>[r.employee||'', r.date||'', r.day||'', r.start||'', r.end||'', fmtHM(r.hours), r.project||'', r.dept||'', r.location||'', r.notes||'']);
    const ws3 = buildDetailSheet('Overtime Log', ['Employee','Date','Day','Start','End','OT Hours','Project','Department','Location','Notes'], otData, '#'+COLORS.orange);
    ws3['!cols']=[{wch:22},{wch:12},{wch:8},{wch:8},{wch:8},{wch:11},{wch:26},{wch:14},{wch:14},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws3, 'Overtime');

    // Travel
    const tRows = applyReportFilters(isHR() ? state.travel : state.travel.filter(r=>r.employee===state.profile.employeeName));
    const trData = tRows.map(r=>[r.employee||'', r.date||'', trEnd(r), r.days||0, r.project||'', r.dept||'', r.location||'', r.perDiem||0, (r.perDiemStatus||'received')==='received'?'Received':'Not Received', r.notes||'']);
    const ws4 = buildDetailSheet('Travel Log', ['Employee','From','To','Days','Project','Department','Location','Per Diem (IQD)','Per Diem Status','Notes'], trData, '#'+COLORS.green);
    ws4['!cols']=[{wch:22},{wch:12},{wch:12},{wch:8},{wch:26},{wch:14},{wch:14},{wch:16},{wch:16},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws4, 'Travel');

    // Leaves sheet
    const lRows = applyReportFilters(isHR() ? state.leaves : state.leaves.filter(r=>r.employee===state.profile.employeeName), "from");
    const lvData = lRows.map(r=>{
      const lt = (typeof leaveTypeInfo==='function') ? leaveTypeInfo(r.type) : {label:r.type||''};
      return [r.employee||'', lt.label||r.type||'', r.from||'', r.to||'', (typeof computeLeaveAmount==='function' ? daysNum(computeLeaveAmount(r).days) : (r.days||0)), r.notes||''];
    });
    const wsL = buildDetailSheet('Leaves Log', ['Employee','Type','From','To','Days','Notes'], lvData, '#C62828');
    wsL['!cols']=[{wch:22},{wch:18},{wch:12},{wch:12},{wch:8},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsL, 'Leaves');

    // Departments sheet (HR+)
    if(isHR() && state.departments.length){
      const ws5 = {};
      setCell(ws5,'A1','DEPARTMENTS',{...titleStyle,fill:{fgColor:{rgb:COLORS.purple}}});
      setMerge(ws5,{s:{r:0,c:0},e:{r:0,c:3}});
      setCell(ws5,'A2','Department Name',headerStyle);
      setCell(ws5,'B2','Color',headerStyle);
      setCell(ws5,'C2','Projects',headerStyle);
      setCell(ws5,'D2','Total Hours',headerStyle);
      state.departments.forEach((d,idx)=>{
        const r = 3+idx;
        const alt = idx%2===1;
        const pc = state.projects.filter(p=>p.dept===d.name).length;
        const hr = filterByPeriod(state.daily).filter(x=>x.dept===d.name).reduce((s,x)=>s+Number(x.duration||0),0);
        setCell(ws5,`A${r}`,d.name,{...empNameStyle(alt),font:{bold:true,sz:11,color:{rgb:deptColor(d.name).replace('#','')}}});
        setCell(ws5,`B${r}`,'',{...cellStyle(alt),fill:{fgColor:{rgb:deptColor(d.name).replace('#','')}}});
        setCell(ws5,`C${r}`,pc,numStyle(alt));
        setCell(ws5,`D${r}`,fmtHM(hr),numStyle(alt));
      });
      ws5['!ref']=`A1:D${2+state.departments.length}`;
      ws5['!cols']=[{wch:24},{wch:12},{wch:12},{wch:14}];
      ws5['!rows']=[{hpt:24},{hpt:20}];
      XLSX.utils.book_append_sheet(wb, ws5, 'Departments');
    }

    // Projects (HR+)
    if(isHR() && state.projects.length){
      const ws6 = {};
      setCell(ws6,'A1','PROJECTS',{...titleStyle,fill:{fgColor:{rgb:COLORS.navyLight}}});
      setMerge(ws6,{s:{r:0,c:0},e:{r:0,c:1}});
      setCell(ws6,'A2','Project Name',headerStyle);
      setCell(ws6,'B2','Department',headerStyle);
      state.projects.forEach((p,idx)=>{
        const r=3+idx;
        const alt=idx%2===1;
        const d=state.departments.find(x=>x.name===p.dept);
        const col=deptColor(d?d.name:'');
        setCell(ws6,`A${r}`,p.name,cellStyle(alt));
        setCell(ws6,`B${r}`,p.dept,deptStyle(col,alt));
      });
      ws6['!ref']=`A1:B${2+state.projects.length}`;
      ws6['!cols']=[{wch:32},{wch:18}];
      ws6['!rows']=[{hpt:24},{hpt:20}];
      XLSX.utils.book_append_sheet(wb, ws6, 'Projects');
    }

    XLSX.writeFile(wb, `OpsDeptTrack_${periodSafe}_${todayStr}.xlsx`);
    toast('Excel exported with full formatting ✓');
  }catch(e){
    console.error(e);
    toast('Export failed: ' + e.message);
  }
}
window.exportExcel = exportExcel;

// ═══════════════════════════════════════════════════════════════════════
//  DASHBOARD PDF EXPORT — Colored, Visual Report
// ═══════════════════════════════════════════════════════════════════════
async function exportDashboardPDF(){
  try{
    const period = (typeof getPeriod==='function' ? getPeriod() : 'Report');
    const s = summary();
    const tHrs = s.reduce((a,b)=>a+b.total,0);
    const tOT = s.reduce((a,b)=>a+b.ot,0);
    const tTr = s.reduce((a,b)=>a+b.tDays,0);
    const tPD = s.reduce((a,b)=>a+b.pd,0);
    const todayStr = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});

    // Build SVG donut chart inline
    const empColors = ["#1B5E9B","#C9A84C","#2E7D32","#E65100","#6A1B9A","#3949AB","#00897B","#D81B60"];
    let donutSVG = '<div style="text-align:center;color:#6B7B8F;padding:30px">No data</div>';
    if(tHrs > 0){
      const r=80, cx=100, cy=100;
      let cum = -Math.PI/2;
      const segs = s.filter(x=>x.total>0).map((x,i)=>{
        const a = (x.total/tHrs)*Math.PI*2;
        const x1=cx+r*Math.cos(cum), y1=cy+r*Math.sin(cum);
        cum += a;
        const x2=cx+r*Math.cos(cum), y2=cy+r*Math.sin(cum);
        const large = a>Math.PI?1:0;
        return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${empColors[i%empColors.length]}" stroke="white" stroke-width="2"/>`;
      }).join('');
      donutSVG = `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        ${segs}
        <circle cx="${cx}" cy="${cy}" r="48" fill="white"/>
        <text x="100" y="95" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#1B3A6B" font-weight="700">${fmtHM(tHrs)}</text>
        <text x="100" y="115" text-anchor="middle" font-family="Arial" font-size="9" fill="#6B7B8F" letter-spacing="1">TOTAL HOURS</text>
      </svg>`;
    }

    // Build legend HTML
    const legendHTML = s.map((r,i)=>{
      const color = empColors[i%empColors.length];
      const pct = tHrs>0 ? ((r.total/tHrs)*100).toFixed(1) : '0.0';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#F8FAFD;border-radius:8px;font-size:12px;margin-bottom:4px">
        <span style="width:14px;height:14px;border-radius:4px;background:${color};display:inline-block"></span>
        <span style="flex:1;font-weight:600;color:#1B3A6B">${escapeHtml(r.emp)}</span>
        <span style="font-weight:700">${fmtHM(r.total)}</span>
        <span style="color:#6B7B8F;font-weight:600;min-width:46px;text-align:right">${pct}%</span>
      </div>`;
    }).join('');

    // Department performance blocks
    const deptBlocks = state.departments.map(d=>{
      const tot = s.reduce((acc,r)=>acc+(r.byDept[d.name]||0), 0);
      const mx = Math.max(...s.map(r=>r.byDept[d.name]||0), 0.01);
      const rows = s.map(r=>{
        const hrs = r.byDept[d.name] || 0;
        const pct = tot>0 ? (hrs/tot*100).toFixed(1) : '0.0';
        const bw = (hrs/mx*100).toFixed(1);
        return `<div style="padding:6px 12px;border-bottom:1px solid #E0E8F0;font-size:11px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <span style="font-weight:600;color:#1B3A6B">${escapeHtml(r.emp)}</span>
            <div>
              <span style="font-weight:700;font-variant-numeric:tabular-nums">${fmtHM(hrs)}</span>
              <span style="color:#6B7B8F;margin-left:8px;font-size:10px">${pct}%</span>
            </div>
          </div>
          <div style="height:3px;background:#E0E8F0;border-radius:4px;overflow:hidden">
            <div style="height:100%;background:${deptColor(d.name)};width:${bw}%"></div>
          </div>
        </div>`;
      }).join('');
      return `<div style="border:1px solid #D6E4F0;border-radius:10px;overflow:hidden;margin-bottom:14px;page-break-inside:avoid">
        <div style="background:linear-gradient(135deg,${deptColor(d.name)},${deptColor(d.name)}DD);color:white;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-size:13px;font-weight:700;text-transform:uppercase">${escapeHtml(d.name)}</h3>
          <span style="font-family:Georgia,serif;font-size:18px;font-weight:700">${fmtHM(tot)}</span>
        </div>
        <div style="background:#FFFFFF">${rows}</div>
      </div>`;
    }).join('');

    const tLeave = s.reduce((a,b)=>a+(b.leaveDays||0),0);

    // ── Project health ──────────────────────────────────────────────────
    const PHC=["#03308B","#C9A84C","#2E7D32","#E65100","#6A1B9A","#00897B","#3949AB","#D81B60"];
    const dailyAll = state.daily||[];
    const phStats = (state.projects||[]).filter(p=>String(p.name||'').trim()).map(p=>{
      const nm=String(p.name).trim();
      const mine=dailyAll.filter(x=>String(x.project||'').trim()===nm);
      const logged=mine.reduce((a,x)=>a+Number(x.duration||0),0);
      const est=Number(p.estimatedHours||0);
      const pct=est>0?Math.round(logged/est*100):null;
      const last=mine.reduce((m,x)=>String(x.date||'')>m?String(x.date||''):m,'');
      const openInc=(state.incidents||[]).filter(i=>String(i.project||'').trim()===nm
        && !["Resolved","Closed"].includes(i.status||"Open")).length;
      const pms=(state.pmSchedules||[]).filter(x=>String(x.project||'').trim()===nm && x.active!==false);
      const overdue=pms.filter(x=>(typeof pmDaysLeft==='function'?pmDaysLeft(x):0)<0).length;
      return {name:nm, logged, est, pct, last, openInc, pms:pms.length, overdue,
              people:new Set(mine.map(x=>x.employee)).size};
    }).sort((a,b)=>b.logged-a.logged);

    const phBlocks = phStats.map((p,i)=>{
      const col=PHC[i%PHC.length];
      // Over 100% of the estimate is the number that matters most, so it is
      // coloured as a warning rather than quietly clipped to a full bar.
      const over=p.pct!==null && p.pct>100;
      const barPct=p.pct===null?0:Math.min(p.pct,100);
      const barCol=over?'#C62828':col;
      return `<div class="dept-card" style="border-left-color:${barCol}">
        <div class="dept-row"><span class="dept-name" style="color:${barCol}">${escapeHtml(p.name)}</span>
          <span class="dept-val" style="color:${barCol}">${p.pct===null?fmtHM(p.logged):p.pct+'%'}</span></div>
        <div class="dept-sub">
          ${fmtHM(p.logged)} logged${p.est>0?` of ${fmtHM(p.est)} estimated`:' · no estimate set'} · ${p.people} ${p.people===1?'person':'people'}
          ${p.last?` · last entry ${escapeHtml(p.last)}`:' · no entries yet'}
          ${p.openInc?`<br><span style="color:#C62828;font-weight:700">${p.openInc} open incident${p.openInc>1?'s':''}</span>`:''}
          ${p.overdue?`${p.openInc?' · ':'<br>'}<span style="color:#E65100;font-weight:700">${p.overdue} maintenance overdue</span>`:''}
          ${over?`<br><span style="color:#C62828;font-weight:700">Over the estimate by ${fmtHM(p.logged-p.est)}</span>`:''}
        </div>
        ${p.est>0?`<div class="bar"><div class="bar-fill" style="background:${barCol};width:${barPct}%"></div></div>`:''}
      </div>`;}).join('');

    const phRows = phStats.map(p=>`<tr>
      <td><strong style="color:#1B3A6B">${escapeHtml(p.name)}</strong></td>
      <td style="text-align:right;font-weight:700">${fmtHM(p.logged)}</td>
      <td style="text-align:right">${p.est>0?fmtHM(p.est):'—'}</td>
      <td style="text-align:right;font-weight:700;color:${p.pct!==null&&p.pct>100?'#C62828':'#2E7D32'}">${p.pct===null?'—':p.pct+'%'}</td>
      <td style="text-align:right">${p.people}</td>
      <td style="text-align:right;color:${p.openInc?'#C62828':'#6B7B8F'};font-weight:${p.openInc?'700':'400'}">${p.openInc||'—'}</td>
      <td style="text-align:right;color:${p.overdue?'#E65100':'#6B7B8F'};font-weight:${p.overdue?'700':'400'}">${p.overdue||'—'}</td>
      <td style="text-align:right;font-size:9px;color:#6B7B8F">${p.last?escapeHtml(p.last):'—'}</td>
    </tr>`).join('');

    // KPI cards (5 columns now including leaves)
    const kpis = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:16px">
      <div style="background:#FFFFFF;border-left:4px solid #2E5FA3;border-radius:8px;padding:10px 11px">
        <div style="font-size:9px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Total Hours</div>
        <div style="font-family:Georgia,serif;font-size:16px;color:#2E5FA3;font-weight:700">${fmtHM(tHrs)}</div>
        <div style="font-size:9px;color:#6B7B8F">${applyReportFilters(state.daily).length} sessions</div>
      </div>
      <div style="background:#FFFFFF;border-left:4px solid #E65100;border-radius:8px;padding:10px 11px">
        <div style="font-size:9px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Overtime</div>
        <div style="font-family:Georgia,serif;font-size:16px;color:#E65100;font-weight:700">${fmtHM(tOT)}</div>
        <div style="font-size:9px;color:#6B7B8F">${applyReportFilters(state.overtime).length} entries</div>
      </div>
      <div style="background:#FFFFFF;border-left:4px solid #2E7D32;border-radius:8px;padding:10px 11px">
        <div style="font-size:9px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Travel</div>
        <div style="font-family:Georgia,serif;font-size:16px;color:#2E7D32;font-weight:700">${tTr}</div>
        <div style="font-size:9px;color:#6B7B8F">${applyReportFilters(state.travel).length} trips</div>
      </div>
      <div style="background:#FFFFFF;border-left:4px solid #6A1B9A;border-radius:8px;padding:10px 11px">
        <div style="font-size:9px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Per Diem</div>
        <div style="font-family:Georgia,serif;font-size:16px;color:#6A1B9A;font-weight:700">${fmtMoney(tPD)}</div>
        <div style="font-size:9px;color:#6B7B8F">IQD total</div>
      </div>
      <div style="background:#FFFFFF;border-left:4px solid #C62828;border-radius:8px;padding:10px 11px">
        <div style="font-size:9px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Leave Days</div>
        <div style="font-family:Georgia,serif;font-size:16px;color:#C62828;font-weight:700">${tLeave}</div>
        <div style="font-size:9px;color:#6B7B8F">${applyReportFilters(state.leaves,"from").length} entries</div>
      </div>
    </div>`;

    // Build body using universal template
    const totalLeaveDays = s.reduce((a,b)=>a+(b.leaveDays||0),0);
    // Counted section numbers, so the employee-only variant never prints a gap.
    const KD=(()=>{let n=0;return()=>String(++n).padStart(2,"0");})();
    const dashBodyHTML=`
      <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
        📄 Choose <strong>"Save as PDF"</strong> in the print dialog
        <br><br><button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
        <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
      </div>
      <div class="ksec"><span class="kbad">${KD()}</span><h3>Executive Summary</h3></div>
      <div class="kr">
        <div class="kc kb"><div class="kl">Total Hours</div><div class="kv">${fmtHM(tHrs)}</div><div class="ks">${applyReportFilters(state.daily).length} sessions</div></div>
        <div class="kc ko"><div class="kl">Overtime</div><div class="kv">${fmtHM(tOT)}</div><div class="ks">${applyReportFilters(state.overtime).length} entries</div></div>
        <div class="kc kg"><div class="kl">Travel Days</div><div class="kv">${tTr}</div><div class="ks">${applyReportFilters(state.travel).length} trips</div></div>
        <div class="kc kp"><div class="kl">Per Diem</div><div class="kv">${fmtMoney(tPD)}</div><div class="ks">IQD total</div></div>
        <div class="kc krd"><div class="kl">Leave Days</div><div class="kv">${fmtDays(totalLeaveDays)}</div><div class="ks">${applyReportFilters(state.leaves,"from").length} entries</div></div>
      </div>
      ${!isEmployee()?`<div class="ksec"><span class="kbad">${KD()}</span><h3>Employee Hours Distribution</h3></div>
      <div style="display:flex;align-items:center;gap:20px;margin:10px 0">
        ${donutSVG}
        <div style="flex:1">${legendHTML}</div>
      </div>`:''}
      <div class="ksec"><span class="kbad">${KD()}</span><h3>Department Performance</h3></div>
      ${deptBlocks||'<div class="empty">No departments configured</div>'}

      ${phStats.length?`<div class="ksec"><span class="kbad">${KD()}</span><h3>Project Health</h3></div>
      <p style="font-size:9.5px;color:#6B7B8F;line-height:1.7;margin:0 0 6px">
        Hours logged against each project measured on its estimate, with open incidents and overdue
        maintenance alongside. A figure above 100% means the project has passed its estimated hours.</p>
      <div class="grid2">${phBlocks}</div>
      <table><thead><tr><th>Project</th><th style="text-align:right">Logged</th><th style="text-align:right">Estimated</th>
        <th style="text-align:right">Used</th><th style="text-align:right">People</th>
        <th style="text-align:right">Incidents</th><th style="text-align:right">PM overdue</th>
        <th style="text-align:right">Last entry</th></tr></thead>
      <tbody>${phRows}</tbody></table>`:''}
      <script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script>`;
    await openReportPDF("DASHBOARD", period, dashBodyHTML);
    toast('PDF export ready!');
  } catch(e){
    console.error(e);
    toast('PDF export failed: ' + e.message);
  }
}
window.exportDashboardPDF = exportDashboardPDF;



// ═══════════════════════════════════════════════════════════════════════
//  PWA + Service Worker
// ═══════════════════════════════════════════════════════════════════════
if('serviceWorker' in navigator){
  // Android requires a REAL same-origin sw.js file (not a Blob) to offer full "Install app".
  // Try the real file first; if it's missing (e.g. local single-file use), fall back to Blob.
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js', {scope: './', updateViaCache: 'none'}).then(function(reg){
      // ── "New version available" flow (v90) ──
      // 1) A newer sw.js installs in the background and WAITS (no skipWaiting).
      // 2) We show a banner; the user taps Update whenever convenient.
      // 3) We message SKIP_WAITING → controllerchange fires → ONE clean reload.
      reg.update();
      function showUpdateBar(){
        try{
          if(document.getElementById('updBar')) return;
          var bar=document.createElement('div');
          bar.id='updBar';
          bar.innerHTML='<span class="upd-t">🚀 New version available</span>'
            +'<button class="upd-go" id="updGo">↻ Update now</button>'
            +'<button class="upd-x" id="updX" title="Later">\u2715</button>';
          document.body.appendChild(bar);
          document.getElementById('updGo').addEventListener('click',function(){
            var btn=this;
            try{
              btn.textContent='Updating\u2026'; btn.disabled=true;
              var fired=false;
              function go(){ if(fired)return; fired=true; window.location.reload(); }
              // An unconditional backstop. Everything below can stall: a
              // controllerchange that fires without the new worker taking over,
              // a cache wipe that never settles, a browser that refuses to
              // activate. Any of those left the button reading "Updating…" for
              // ever with the bar still on screen \u2014 the exact symptom
              // reported. This one is not guarded by `fired`, so it cannot be
              // disarmed by a half-finished attempt: after 9 seconds the page
              // reloads regardless, which is the whole point of the button.
              setTimeout(function(){ try{ window.location.reload(); }catch(e){} }, 9000);
              // If nothing has happened after 3 seconds, say so rather than
              // leaving the user staring at a frozen word.
              setTimeout(function(){
                if(fired) return;
                try{ btn.textContent='Still working\u2026'; }catch(e){}
              }, 3000);
              navigator.serviceWorker.addEventListener('controllerchange', go);
              function poke(){ try{
                var w=reg.waiting||reg.installing;
                if(!w){ reg.update(); return; }
                if(w.state==='installed') w.postMessage('SKIP_WAITING');
                else w.addEventListener('statechange',function(){ if(w.state==='installed') w.postMessage('SKIP_WAITING'); });
              }catch(err){} }
              poke(); setTimeout(poke,1600);
              // LAST RESORT (~5s): programmatic cache wipe = the manual "clear cache",
              // done by the button itself. Network-first then guarantees fresh files.
              setTimeout(function(){
                if(fired)return;
                var wipe=(typeof caches!=='undefined'&&caches.keys)?caches.keys().then(function(ks){
                  return Promise.all(ks.map(function(k){ return caches.delete(k); }));
                }):Promise.resolve();
                wipe.catch(function(){}).then(go);
              },5000);
            }catch(err){ window.location.reload(); }
          });
          document.getElementById('updX').addEventListener('click',function(){
            // Removing the bar is not enough: the waiting worker is still there,
            // so the next render or visibility change puts the bar straight
            // back. Remember the dismissal for this session.
            // Remember WHICH build was dismissed, not that a dismissal happened.
            // An installed PWA can stay open for days, so a flag with no version
            // attached would hide every future update as well as this one.
            try{
              versionOf(reg.waiting).then(function(v){
                try{ localStorage.setItem('girek-upd-skip', v||'1'); }catch(e){}
              }).catch(function(){});
            }catch(e){}
            bar.remove();
          });
        }catch(err){}
      }
      // Ask a worker which build it is. Returns null if it cannot answer, so an
      // older worker without the handler simply falls back to the old behaviour.
      function versionOf(worker){
        return new Promise(function(resolve){
          if(!worker) return resolve(null);
          var done=false;
          try{
            var ch=new MessageChannel();
            ch.port1.onmessage=function(ev){ if(!done){done=true; resolve(ev.data||null);} };
            worker.postMessage('WHICH_VERSION',[ch.port2]);
            setTimeout(function(){ if(!done){done=true; resolve(null);} },900);
          }catch(err){ resolve(null); }
        });
      }
      // The banner used to appear whenever a worker sat in "waiting". After an
      // update that worker can still be present holding the SAME build, so the
      // banner came straight back and had to be dismissed by hand. Now the two
      // builds are compared and the banner is shown only when they differ.
      function maybeShowUpdateBar(){
        // Silence only the exact build the user waved away; anything newer is
        // shown normally.
        var skipped="";
        try{ skipped=localStorage.getItem('girek-upd-skip')||""; }catch(e){}
        var waiting = reg.waiting;
        if(!waiting || !navigator.serviceWorker.controller) return;
        Promise.all([versionOf(waiting), versionOf(navigator.serviceWorker.controller)])
          .then(function(v){
            var next=v[0], cur=v[1];
            // Unknown on either side: fall back to showing it, because a missed
            // update is worse than one extra banner.
            if(next && cur && next===cur){
              try{ waiting.postMessage('SKIP_WAITING'); }catch(err){}   // clear it quietly
              return;
            }
            if(next && skipped && next===skipped) return;   // this exact build was dismissed
            try{ localStorage.removeItem('girek-upd-skip'); }catch(e){} // a newer build: start fresh
            showUpdateBar();
          })
          .catch(function(){ showUpdateBar(); });
      }
      // already-downloaded update from a previous visit
      maybeShowUpdateBar();
      // update found during this session
      reg.addEventListener('updatefound', function(){
        var nw=reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange', function(){
          if(nw.state==='installed' && navigator.serviceWorker.controller) maybeShowUpdateBar();
        });
      });
      // re-check when the app returns to the foreground (mobile PWA resume)
      document.addEventListener('visibilitychange', function(){
        if(!document.hidden){ try{ reg.update(); }catch(err){} }
      });
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function(){
        if(refreshing) return;
        refreshing = true;
        window.location.reload();   // happens only after the user tapped Update
      });
    }).catch(function(){
      // Fallback: Blob-based SW (network-first for HTML so the app always updates)
      var swCode = "const CACHE='ejaftech-v258';"
        + "self.addEventListener('install',e=>self.skipWaiting());"
        + "self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));"
        + "self.addEventListener('fetch',e=>{"
        + "if(e.request.url.includes('firebase')||e.request.url.includes('googleapis')||e.request.url.includes('gstatic'))return;"
        + "if(e.request.mode==='navigate'||e.request.destination==='document'){e.respondWith(fetch(e.request,{cache:'no-store'}).then(resp=>{const c=resp.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));return resp;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./'))));return;}"
        + "e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{"
        + "if(e.request.url.startsWith(self.location.origin)){const c=resp.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}"
        + "return resp;}).catch(()=>caches.match('./'))));"
        + "});";
      var blob = new Blob([swCode], {type:'application/javascript'});
      navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(function(){});
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  PM & INCIDENT REPORTS — EJAF-branded PDFs (same engine as HR reports)
// ═══════════════════════════════════════════════════════════════════════
window._pmRptPhotos=[];   // photos attached manually at generation time
window.pmRptAddPhotos=async function(input){
  try{
    const files=Array.from(input.files||[]); input.value="";
    for(const f of files){
      if(window._pmRptPhotos.length>=12){ toast("Max 12 photos per report"); break; }
      const b64=await compressImage(f,1024,0.6);
      const kb=base64SizeKB(b64);
      if(kb>500){ toast(`Image too large (${kb} KB). Skipped.`); continue; }
      window._pmRptPhotos.push({data:b64,sizeKB:kb});
    }
    render();
  }catch(e){ toast("Photo error: "+(e.message||"failed")); }
};
window.pmRptDelPhoto=function(i){ window._pmRptPhotos.splice(i,1); render(); };

function _rptPhotoGrid(photos,label){
  if(!photos||!photos.length) return "";
  return `<div class="ksec"><span class="kbad">📷</span><h3>${label} (${photos.length})</h3></div>
    <div style="display:flex;flex-wrap:wrap;gap:10px">
      ${photos.map((p,i)=>`<div style="page-break-inside:avoid"><img src="${p.data}" style="width:230px;max-height:190px;object-fit:cover;border:1px solid #ccc;border-radius:6px"><div style="font-size:9px;color:#888;text-align:center">Photo ${i+1}</div></div>`).join("")}
    </div>`;
}
const _rptBadge=(t,bg,fg)=>`<span style="background:${bg};color:${fg};padding:2px 10px;border-radius:8px;font-size:10px;font-weight:700">${escapeHtml(t||"—")}</span>`;

// PM schedule → effective system: its own field, else its target device's.
function _pmSysOf(s){
  if(s.system) return s.system;
  if(s.deviceSerial){ const d=(state.devices||[]).find(x=>x.serialNumber===s.deviceSerial); if(d&&d.system) return d.system; }
  return "";
}
window.generatePMReport=async function(){
  if((window._pmRptMode||"records")==="manual") return _generatePMManual();
  const proj=window._pmRptProj||"";
  const sys =window._pmRptSys||"";
  const from=window._pmRptFrom||"";
  const to  =window._pmRptTo||"";
  let scheds=(state.pmSchedules||[]).filter(s=>s.active!==false);
  if(proj) scheds=scheds.filter(s=>(s.project||"").trim()===proj);
  if(sys)  scheds=scheds.filter(s=>_pmSysOf(s)===sys);
  if(!scheds.length) return toast("No PM schedules match this scope");

  // completion rounds inside the period (from schedule history)
  const rounds=[];
  scheds.forEach(s=>(s.history||[]).forEach(h=>{
    if(h.initial) return;
    if(from&&String(h.date)<from) return;
    if(to&&String(h.date)>to) return;
    rounds.push({s,h});
  }));
  rounds.sort((a,b)=>String(b.h.date).localeCompare(String(a.h.date)));
  const overdue=scheds.filter(s=>pmDaysLeft(s)<0);

  const target=s=>{const A=_pmAreasOf(s),S=_pmSitesOf(s);
    return [s.project||"General",A.join(" + "),S.join(" + "),s.deviceSerial?("Device "+s.deviceSerial):""].filter(Boolean).join(" › ");};
  const sysBadge=s=>{const v=_pmSysOf(s);return v?_rptBadge(v,"#E0F2F1","#00695C"):"—";};
  const schedRows=scheds.map(s=>{
    const dl=pmDaysLeft(s);
    return `<tr><td><strong>${escapeHtml(s.title)}</strong></td><td style="font-size:10px">${escapeHtml(target(s))}</td><td>${sysBadge(s)}</td><td>${s.freqDays}d</td><td>${s.lastDone?fmtDate(s.lastDone):"—"}</td><td>${fmtDate(pmNextDue(s))}</td><td>${dl<0?_rptBadge(Math.abs(dl)+"d overdue","#FDECEA","#C62828"):dl<=7?_rptBadge("due in "+dl+"d","#FFF3E0","#E65100"):_rptBadge("on track","#E8F5E9","#2E7D32")}</td></tr>`;
  }).join("");
  const roundRows=rounds.map(({s,h})=>`<tr><td>${fmtDate(h.date)}</td><td><strong>${escapeHtml(s.title)}</strong></td><td style="font-size:10px">${escapeHtml(target(s))}</td><td>${escapeHtml(h.by||"—")}</td><td>${h.sessions!=null?h.sessions:"—"}</td></tr>`).join("");

  const bodyHTML=`
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 Choose <strong>"Save as PDF"</strong> in the print dialog<br><br>
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Summary${proj?` — ${escapeHtml(proj)}`:""}${sys?` · ${escapeHtml(sys)}`:""}</h3></div>
    <div class="kr">
      <div class="kc kb"><div class="kl">Schedules</div><div class="kv">${scheds.length}</div><div class="ks">active in scope</div></div>
      <div class="kc kg"><div class="kl">Rounds Completed</div><div class="kv">${rounds.length}</div><div class="ks">in period</div></div>
      <div class="kc ko"><div class="kl">Overdue</div><div class="kv">${overdue.length}</div><div class="ks">need attention</div></div>
    </div>
    <div class="ksec"><span class="kbad">02</span><h3>Maintenance Schedules</h3></div>
    <table><thead><tr><th>Schedule</th><th>Target</th><th>System</th><th>Every</th><th>Last done</th><th>Next due</th><th>Status</th></tr></thead>
    <tbody>${schedRows}</tbody></table>
    <div class="ksec"><span class="kbad">03</span><h3>Completed Rounds${(from||to)?` — ${from||"start"} → ${to||"today"}`:""}</h3></div>
    <table><thead><tr><th>Date</th><th>Schedule</th><th>Target</th><th>Completed by</th><th>Sessions</th></tr></thead>
    <tbody>${roundRows||'<tr><td colspan="5" style="text-align:center;color:#888">No completed rounds in this period</td></tr>'}</tbody></table>
    ${(window._pmRptDesc||"").trim()?`<div class="ksec"><span class="kbad">04</span><h3>Work Performed — Description</h3></div>
    <div style="font-size:12px;line-height:1.7">${typeof textWithTablesHTML==="function"?textWithTablesHTML(window._pmRptDesc,{dash:false}):`<div style="white-space:pre-wrap">${escapeHtml(window._pmRptDesc.trim())}</div>`}</div>`:""}
    ${_rptPhotoGrid(window._pmRptPhotos,"Maintenance Photos")}
    ${typeof _rptPlanSheets==="function"?_rptPlanSheets(window._pmRptPlans,"Site Plans"):""}
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  const period=(from||to)?`${from||"start"} → ${to||"today"}`:"All time";
  await openReportPDF("PREVENTIVE_MAINTENANCE", [period,proj,sys].filter(Boolean).join(" · "), bodyHTML,{project:proj||""});
  toast("PM Report ready!");
};

window.generateIncidentReport=async function(){
  if((window._incRptMode||"records")==="manual") return _generateIncManual();
  const id=window._incRptSel||"";
  if(!id) return toast("⚠ Pick an incident first");
  const i=(state.incidents||[]).find(x=>x.id===id);
  if(!i) return toast("Incident not found");
  const sev={Low:["#E8F5E9","#2E7D32"],Medium:["#FFF3E0","#E65100"],High:["#FDECEA","#C62828"],Critical:["#F3E5F5","#7B1FA2"]}[i.severity]||["#EEE","#555"];
  const st={Open:["#FDECEA","#C62828"],Investigating:["#FFF3E0","#E65100"],Resolved:["#E8F5E9","#2E7D32"],Closed:["#ECEFF1","#5B6C86"]}[i.status]||["#EEE","#555"];
  const dev=i.deviceSerial?(state.devices||[]).find(d=>d.serialNumber===i.deviceSerial):null;

  const cell=(l,v)=>`<td style="border:1px solid #ddd;padding:7px 10px"><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.6px;font-weight:700">${l}</div><div style="font-size:12px;font-weight:600;color:#1B3A6B">${v||"—"}</div></td>`;
  const bodyHTML=`
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 Choose <strong>"Save as PDF"</strong> in the print dialog<br><br>
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Incident Overview</h3></div>
    <div style="font-family:'DM Serif Display',serif;font-size:18px;color:#03308B;margin:4px 0 8px">${escapeHtml(i.title)}</div>
    <div style="margin-bottom:10px">${_rptBadge(i.severity,sev[0],sev[1])} &nbsp; ${_rptBadge(i.status,st[0],st[1])}</div>
    <table style="border-collapse:collapse;width:100%"><tbody>
      <tr>${cell("Incident date",fmtDate(i.date)+(i.time?" · "+i.time:""))}${cell("Project",escapeHtml(i.project))}${cell("System",escapeHtml(i.system||"Whole project"))}</tr>
      <tr>${cell("Area",escapeHtml(i.area))}${cell("Site",escapeHtml(i.site))}${cell("Device",dev?escapeHtml([dev.deviceName,dev.model,dev.serialNumber].filter(Boolean).join(" · ")):escapeHtml(i.deviceSerial||"—"))}</tr>
      <tr>${cell("Work started",i.startDate?fmtDate(i.startDate):"—")}${cell("Work finished",i.endDate?fmtDate(i.endDate):"—")}${cell("Reported by",escapeHtml(i.reportedBy||"—"))}</tr>
    </tbody></table>
    <div class="ksec"><span class="kbad">02</span><h3>Description</h3></div>
    <div style="font-size:12px;line-height:1.7">${typeof textWithTablesHTML==="function"?textWithTablesHTML(i.description):escapeHtml(i.description||"—")}</div>
    <div class="ksec"><span class="kbad">03</span><h3>Action Taken</h3></div>
    <div style="font-size:12px;line-height:1.7">${typeof textWithTablesHTML==="function"?textWithTablesHTML(i.actionTaken):escapeHtml(i.actionTaken||"—")}</div>
    ${_rptPhotoGrid(i.photos,"Incident Photos")}
    ${i.notes?`<div class="ksec"><span class="kbad">📝</span><h3>Notes</h3></div><div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(i.notes)}</div>`:""}
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  await openReportPDF("INCIDENT", `${fmtDate(i.date)} · ${i.project||""}${i.system?" · "+i.system:""}`, bodyHTML, {project:i.project||""});
  toast("Incident Report ready!");
};

// ═══════════════════════════════════════════════════════════════════════
//  STANDALONE REPORT TABS — PM Report · Incident Report
//  State-backed inputs (survive live data re-renders).
// ═══════════════════════════════════════════════════════════════════════
window._pmRptProj=window._pmRptProj||""; window._pmRptSys=window._pmRptSys||"";
window._pmRptFrom=window._pmRptFrom||""; window._pmRptTo=window._pmRptTo||"";
window._pmRptDesc=window._pmRptDesc||""; window._incRptSel=window._incRptSel||"";
window._incRptProj=window._incRptProj||""; window._incRptSys=window._incRptSys||"";

function _refField(bind,val){
  return `<div class="field" style="grid-column:1/-1">
    <label>Reference <span style="font-weight:500;color:var(--muted);font-size:10px">— contract / work order traceability</span></label>
    <input value="${escapeHtml(val||"")}" oninput="${bind}=this.value" placeholder="PO-2026-1187 / WO-4412 / Prev: RPT-2026-0031">
    <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">The report's own Ref No. is issued automatically. Use this field for the <strong>client's</strong> chain: purchase order or contract · work order or service request · previous report being closed · as-built drawing revision.</div>
  </div>`;
}
function _rptHero(icon,title,sub,grad){
  return `<div class="card" style="background:${grad};color:#fff;padding:18px 16px">
    <div style="font-family:'DM Serif Display',serif;font-size:22px">${icon} ${title}</div>
    <div style="font-size:11px;opacity:.85">${sub}</div>
  </div>`;
}

function _rptModeSeg(varName,mode){
  return `<div class="card" style="padding:10px 12px"><div style="display:flex;gap:6px">
    <button class="btn ${mode!=="manual"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window.${varName}='records';render()">📊 From records</button>
    <button class="btn ${mode==="manual"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window.${varName}='manual';render()">✍️ Manual entry</button>
  </div></div>`;
}
// ═══ PROJECT PROGRESS REPORT (v257) ══════════════════════════════════════
// The CONTRACTOR'S monthly report to the client. It is a different document
// from the two that already exist and answers to a different reader:
//
//   Daily / Weekly Progress  — what the crew did.        Internal, ISO 21502.
//   Project Report (PMBOK)   — how the project is doing. Steering committee.
//   THIS                     — what we are owed and why.  Contractual.
//
// FIDIC Sub-Clause 4.21 sets out what a progress report must contain, and it
// is the clause an ELV subcontract points at. Its list is not arbitrary:
// physical progress by discipline, manpower and plant on site, materials
// delivered, quality and safety records, and — the reason the document
// exists — anything causing delay, with its cause and its effect on the
// completion date. A progress report that records a delay WITHOUT naming its
// cause has, in practice, waived the claim.
//
// So this report leads with physical progress per system and ends with delay
// events and any extension-of-time position. Those two sections are what make
// it a contractual document rather than a summary.
const PPR_SECTIONS = [
  {k:"scopeOfWork", n:"Scope of Work",              h:"What the contract obliges us to deliver on this project. Paste it from the contract or the BOQ \u2014 stated, not paraphrased."},
  {k:"executive",   n:"Executive Summary",          h:"The month in a paragraph: overall standing, the single most important fact, and what is needed from the client."},
  {k:"workDone",    n:"Work Executed This Period",  h:"What was physically installed, terminated, tested or commissioned \u2014 by system and by area."},
  {k:"workNext",    n:"Work Planned Next Period",   h:"What will be executed before the next report, and what each item depends on."},
  {k:"materials",   n:"Materials & Procurement",    h:"Delivered to site, in transit, ordered, and long-lead items with their promised dates."},
  {k:"manpower",    n:"Manpower & Plant",           h:"Staff and labour on site, and any plant or access equipment mobilised."},
  {k:"quality",     n:"Quality & Testing",          h:"Inspections offered, ITRs signed, snags raised and cleared, standards applied."},
  {k:"hse",         n:"Health, Safety & Environment", h:"Man-hours worked, incidents and near misses, toolbox talks, permits."},
  {k:"delays",      n:"Delays, Causes & Effect",    h:"Every event that delayed the works, WHAT caused it, and its effect on the completion date. An unrecorded cause is a claim not made."},
  {k:"eot",         n:"Extension of Time & Claims", h:"Notices served, days claimed, days granted, and anything still outstanding."},
  {k:"instructions",n:"Client Instructions & Pending Decisions", h:"What has been asked of the client, when, and what is held up while it is awaited."},
  {k:"remarks",     n:"Remarks",                    h:"Anything the reader should know that has no home above."},
];

// Physical progress is claimed PER SYSTEM, because an ELV package is accepted
// system by system and a single blended percentage hides the one that is late.
window._ppr = window._ppr || {
  client:"", clientOther:false, project:"", projectOther:false, site:"", siteOther:false,
  contractNo:"", contractRef:"", reportNo:"", from:"", to:"", issueDate:"",
  preparedBy:"", preparedByOther:false, approvedBy:"", approvedByOther:false,
  clientRep:"", consultant:"",
  commencement:"", contractCompletion:"", forecastCompletion:"", eotDays:"",
  overallPlanned:"", overallActual:"", currency:"USD",
  contractValue:"", invoicedToDate:"", certifiedToDate:"",
  weatherDays:"", manhours:"", ltiFree:"",
  sections:{},
};
window._pprSystems = window._pprSystems || [];   // [{system,scope,planned,actual,remark}]
window._pprDelays  = window._pprDelays  || [];   // [{event,from,to,cause,responsibility,effectDays,notice}]
window._pprPhotos  = window._pprPhotos  || [];
window._pprPlans   = window._pprPlans   || [];

window.pprAddSystem = function(){ window._pprSystems.push({system:"",scope:"",planned:"",actual:"",remark:""}); render(); };
window.pprDelSystem = function(i){ window._pprSystems.splice(i,1); render(); };
window.pprSetSystem = function(i,k,v){ if(window._pprSystems[i]) window._pprSystems[i][k]=v; };
window.pprAddDelay  = function(){ window._pprDelays.push({event:"",from:"",to:"",cause:"",responsibility:"Client",effectDays:"",notice:""}); render(); };
window.pprDelDelay  = function(i){ window._pprDelays.splice(i,1); render(); };
window.pprSetDelay  = function(i,k,v){ if(window._pprDelays[i]) window._pprDelays[i][k]=v; };
window.pprAddPhotos = async function(input){
  const files = Array.from((input && input.files) || []);
  for(const f of files){
    if(window._pprPhotos.length >= 12){ toast("Max 12 photos"); break; }
    try{ window._pprPhotos.push({data: await compressImage(f), note:""}); }catch(e){}
  }
  input.value=""; render();
};
window.pprDelPhoto = function(i){ window._pprPhotos.splice(i,1); render(); };

// Weighted physical progress. Weighted by SCOPE VALUE where it is given,
// because a 90%-complete doorbell and a 10%-complete CCTV headend are not
// worth averaging together.
function _pprProgress(){
  const n = v => { const x = Number(String(v==null?"":v).replace(/[^0-9.\-]/g,"")); return isFinite(x)?x:0; };
  let wp=0, wa=0, w=0, plain=[], anyWeight=false;
  (window._pprSystems||[]).forEach(s=>{
    if(!String(s.system||"").trim()) return;
    const weight = n(s.scope);
    if(weight>0) anyWeight = true;
    const k = weight>0 ? weight : 1;
    wp += n(s.planned)*k; wa += n(s.actual)*k; w += k;
    plain.push({p:n(s.planned), a:n(s.actual)});
  });
  if(!w) return {planned:null, actual:null, weighted:false, count:0};
  return {planned:wp/w, actual:wa/w, weighted:anyWeight, count:plain.length};
}
Object.assign(window,{PPR_SECTIONS, _pprProgress});

function pprSectionCard(s, i){
  const path = `_ppr.sections.${s.k}`;
  const val  = (window._ppr.sections && window._ppr.sections[s.k]) || "";
  return `<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">${String(i+1).padStart(2,"0")}</span>
      <b>${escapeHtml(s.n)}</b>
    </div>
    <div style="font-size:11px;color:var(--muted);margin:6px 0 8px">${escapeHtml(s.h)}</div>
    ${typeof tableToolbar==="function"?tableToolbar(path):""}
    ${typeof tablePreviewHTML==="function"?tablePreviewHTML(val, "ppr_"+s.k):""}
    <textarea rows="4" oninput="_ppr.sections.${s.k}=this.value" placeholder="${escapeHtml(s.h)}">${escapeHtml(val)}</textarea>
  </div>`;
}

// Same test the printer uses, so the list and the document cannot disagree.
function pprWillPrint(){
  const m = window._ppr, f = _prjFilled, pg = _pprProgress(), out = [];
  out.push({n:"Contract & Report Details",
    on:[m.client,m.project,m.site,m.contractNo,m.contractRef,m.reportNo,m.from,m.to,
        m.preparedBy,m.approvedBy,m.clientRep,m.consultant].some(f),
    why:"needs at least one contract detail"});
  out.push({n:"Key Dates",
    on:[m.commencement,m.contractCompletion,m.forecastCompletion,m.eotDays].some(f),
    why:"no dates entered"});
  out.push({n:"Overall Physical Progress",
    on:pg.planned!=null || f(m.overallPlanned) || f(m.overallActual),
    why:"needs a system or an overall percentage"});
  out.push({n:"Progress by System", on:(window._pprSystems||[]).some(s=>f(s.system)),
    why:"needs a named system"});
  out.push({n:"Financial Position",
    on:[m.contractValue,m.invoicedToDate,m.certifiedToDate].some(f), why:"no figures entered"});
  out.push({n:"Safety Record", on:[m.manhours,m.ltiFree,m.weatherDays].some(f), why:"no records entered"});
  PPR_SECTIONS.forEach(s => out.push({n:s.n, on:f((m.sections||{})[s.k]), why:"section is empty"}));
  out.push({n:"Delay Events Register", on:(window._pprDelays||[]).some(d=>f(d.event)),
    why:"no delay event recorded"});
  out.push({n:"Site Plans & Drawings", on:(window._pprPlans||[]).length>0, why:"no drawing imported"});
  out.push({n:"Progress Photographs",  on:(window._pprPhotos||[]).length>0, why:"no photo added"});
  out.push({n:"Signatures", on:(typeof sigAny==="function" && sigAny(["ppr_prep","ppr_appr","ppr_client"])),
    why:"nobody has signed"});
  return out;
}
function pprPreviewCard(){
  const rows = pprWillPrint();
  const inc = rows.filter(r=>r.on).length;
  return `<div class="card" style="border:2px solid #C9A84C">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">\u{1F441}\uFE0F</span>
      <b>What the report will contain</b>
    </div>
    <div style="font-size:11px;color:var(--muted);margin:6px 0 10px">
      Anything left blank is left OUT of the finished document, in PDF and Word alike.
      <b>${inc} in, ${rows.length-inc} left out.</b>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px">
      ${rows.map(r=>`<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 6px;border-radius:6px;background:${r.on?"rgba(46,125,50,.08)":"transparent"}">
        <span style="width:16px;text-align:center;color:${r.on?"#2E7D32":"var(--muted)"};font-weight:800">${r.on?"\u2713":"\u00b7"}</span>
        <span style="flex:1;color:${r.on?"var(--fg)":"var(--muted)"};${r.on?"":"text-decoration:line-through;opacity:.65"}">${escapeHtml(r.n)}</span>
        ${r.on?"":`<span style="font-size:10px;color:var(--muted)">${escapeHtml(r.why)}</span>`}
      </div>`).join("")}
    </div>
  </div>`;
}
Object.assign(window,{pprSectionCard, pprWillPrint, pprPreviewCard});

window.generateProjectProgressReport = async function(){
  const m = window._ppr, pg = _pprProgress();
  if(!(m.client || m.project)) return toast("\u26a0 Enter at least the client or project");
  const esc = v => escapeHtml(String(v==null?"":v));
  const filled = v => { if(v==null) return false; const s=String(v).trim();
                        return s!=="" && s!=="\u2014" && s!=="-"; };
  const K = (()=>{ let n=0; return ()=>String(++n).padStart(2,"0"); })();
  const head = (no,t)=>`<div style="margin:16px 0 6px;padding:5px 9px;background:#0B3D2E;color:#fff;font-weight:700;font-size:12px;border-radius:3px">${no}. ${esc(t)}</div>`;
  const row = (l,v)=> filled(v) ? `<tr><td style="border:1px solid #ccc;padding:5px 8px;background:#F7F7F7;font-weight:600;width:36%">${esc(l)}</td><td style="border:1px solid #ccc;padding:5px 8px">${esc(v)}</td></tr>` : "";
  const table = r => String(r).trim() ? `<table style="border-collapse:collapse;width:100%;font-size:11px">${r}</table>` : "";
  const sect = (t,inner) => String(inner).trim() ? head(K(),t)+inner : "";
  const grid = (headers, rows) => {
    if(!rows.length) return "";
    const keep = headers.map((_,c)=>rows.some(r=>filled(r[c])));
    if(!keep.some(Boolean)) return "";
    const th = headers.filter((_,c)=>keep[c]).map(h=>`<th style="border:1px solid #ccc;padding:5px 8px;background:#0B3D2E;color:#fff;text-align:start">${esc(h)}</th>`).join("");
    const tb = rows.map(r=>`<tr>${r.filter((_,c)=>keep[c]).map(c=>`<td style="border:1px solid #ccc;padding:5px 8px">${c&&c.html?c.html:(filled(c)?esc(c):"")}</td>`).join("")}</tr>`).join("");
    return `<table style="border-collapse:collapse;width:100%;font-size:11px"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
  };
  const cur = esc(m.currency||"USD");
  const n = v => { const x=Number(String(v==null?"":v).replace(/[^0-9.\-]/g,"")); return isFinite(x)?x:0; };
  const money = v => filled(v) ? cur+" "+Math.round(n(v)).toLocaleString() : "";
  const period = [m.from?fmtDate(m.from):"", m.to?fmtDate(m.to):""].filter(Boolean).join(" \u2014 ");
  let body = "";

  body += sect("Contract & Report Details", table(`
    ${row("Client", m.client)}${row("Project", m.project)}${row("Site", m.site)}
    ${row("Contract number", m.contractNo)}${row("Contract / BOQ reference", m.contractRef)}
    ${row("Report number", m.reportNo)}${row("Reporting period", period)}
    ${row("Prepared by", m.preparedBy)}${row("Approved by", m.approvedBy)}
    ${row("Client representative", m.clientRep)}${row("Consultant / Engineer", m.consultant)}`));

  body += sect("Key Dates", table(`
    ${row("Commencement", m.commencement?fmtDate(m.commencement):"")}
    ${row("Contract completion", m.contractCompletion?fmtDate(m.contractCompletion):"")}
    ${row("Forecast completion", m.forecastCompletion?fmtDate(m.forecastCompletion):"")}
    ${row("Extension of time granted", filled(m.eotDays)? m.eotDays+" days":"")}`));

  const oPlan = filled(m.overallPlanned) ? n(m.overallPlanned) : pg.planned;
  const oAct  = filled(m.overallActual)  ? n(m.overallActual)  : pg.actual;
  if(oPlan!=null || oAct!=null){
    const slip = (oPlan!=null && oAct!=null) ? oAct-oPlan : null;
    body += head(K(),"Overall Physical Progress") + table(`
      ${row("Planned", oPlan!=null ? oPlan.toFixed(1)+"%" : "")}
      ${row("Actual",  oAct !=null ? oAct.toFixed(1)+"%" : "")}
      ${slip!=null ? `<tr><td style="border:1px solid #ccc;padding:5px 8px;background:#F7F7F7;font-weight:600">Variance</td><td style="border:1px solid #ccc;padding:5px 8px;color:${slip<0?"#C62828":"#2E7D32"};font-weight:700">${slip>0?"+":""}${slip.toFixed(1)}%</td></tr>` : ""}
      ${pg.weighted ? row("Basis","Weighted by scope value") : ""}`);
  }

  body += sect("Progress by System", grid(
    ["System","Scope value","Planned %","Actual %","Remark"],
    (window._pprSystems||[]).filter(s=>filled(s.system)).map(s=>{
      const behind = filled(s.planned) && filled(s.actual) && n(s.actual) < n(s.planned);
      return [ s.system, money(s.scope),
        filled(s.planned)? n(s.planned).toFixed(1)+"%" : "",
        filled(s.actual) ? {html:`<span style="color:${behind?"#C62828":"#2E7D32"};font-weight:600">${n(s.actual).toFixed(1)}%</span>`, toString:()=>s.actual} : "",
        s.remark ];
    })));

  body += sect("Financial Position", table(`
    ${row("Contract value", money(m.contractValue))}
    ${row("Invoiced to date", money(m.invoicedToDate))}
    ${row("Certified to date", money(m.certifiedToDate))}`));

  body += sect("Safety Record", table(`
    ${row("Man-hours this period", m.manhours)}
    ${row("Days without a lost-time injury", m.ltiFree)}
    ${row("Days lost to weather or access", m.weatherDays)}`));

  PPR_SECTIONS.forEach(s=>{
    const txt = (m.sections||{})[s.k] || "";
    if(!filled(txt)) return;
    body += head(K(), s.n) + `<div style="font-size:11px;line-height:1.75">${
      typeof textWithTablesHTML==="function" ? textWithTablesHTML(txt,{dash:false}) : esc(txt)}</div>`;
  });

  body += sect("Delay Events Register", grid(
    ["Event","From","To","Cause","Responsibility","Effect (days)","Notice ref"],
    (window._pprDelays||[]).filter(d=>filled(d.event)).map(d=>[
      d.event, d.from?fmtDate(d.from):"", d.to?fmtDate(d.to):"", d.cause,
      d.responsibility, d.effectDays, d.notice ])));

  if((window._pprPlans||[]).length)  body += (typeof _rptPlanSheets==="function" ? _rptPlanSheets(window._pprPlans,"Site Plans & Drawings") : "");
  if((window._pprPhotos||[]).length) body += (typeof _rptPhotoGrid==="function" ? _rptPhotoGrid(window._pprPhotos,"Progress Photographs") : "");

  if(typeof sigAny==="function" && sigAny(["ppr_prep","ppr_appr","ppr_client"])){
    body += head(K(),"Signatures") + (typeof sigRow==="function" ? sigRow([
      ["ppr_prep",   m.preparedBy || "Prepared by", "Project Engineer",  "EJAF Technology"],
      ["ppr_appr",   m.approvedBy || "Approved by", "Projects Manager",  "EJAF Technology"],
      ["ppr_client", m.clientRep  || m.consultant || "Client / Consultant", "", m.client || ""],
    ]) : "");
  }

  // No standards footnote. The structure follows FIDIC Sub-Clause 4.21 and
  // ISO 21502, and it still does \u2014 but a paragraph telling the client which
  // standard the document was written to is boilerplate on a document they
  // asked for, and the disclaimer about notices of claim invited a legal
  // reading that was never wanted. Removed at William's instruction.

  await openReportPDF("PROGRESS_REPORT",
    [m.reportNo?("No. "+m.reportNo):"", m.client, m.project].filter(Boolean).join(" \u00b7 ") || period,
    body, {project:m.project||"", client:m.client||""});
  toast("Progress report ready!");
};

function renderProjectProgressReport(){
  const P = window._ppr;
  const pg = _pprProgress();
  const opts = (l,c) => (l||[]).map(v=>`<option ${c===v?"selected":""}>${escapeHtml(v)}</option>`).join("");
  const projects = (state.projects ||[]).map(p=>p.name).filter(Boolean);
  const clients  = (state.clients  ||[]).map(c=>c.name).filter(Boolean);
  const sites    = (state.locations||[]).map(l=>l.name).filter(Boolean);
  const everyone = Array.from(new Set((state.users||[]).map(u=>(u.employeeName||u.name||"").trim())
    .filter(Boolean).concat(typeof allEmployees==="function"?allEmployees():[]))).sort();
  const sysNames = (typeof SYS_TEMPLATES!=="undefined"?SYS_TEMPLATES.map(t=>t.name):[])
    .concat((typeof ELV_SUBS!=="undefined"?ELV_SUBS.map(s=>s.name):[]));
  const pct = v => v==null ? "\u2014" : v.toFixed(1)+"%";

  return `${_rptHero("\u{1F4C8}","Project Progress Report",
      "Contractor's periodic report \u2014 FIDIC Sub-Clause 4.21 & ISO 21502",
      "linear-gradient(135deg,#0B3D2E 0%,#14664B 60%,#1E8E68 100%)")}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">01</span>
      <b>Contract & Report Details</b>
    </div>
    <div class="grid2">
      ${_syncSel("\u{1F4C1} Project", projects, "window._ppr.project", "window._ppr.projectOther", P.project, P.projectOther, "Project name")}
      ${_syncSel("\u{1F464} Client",  clients,  "window._ppr.client",  "window._ppr.clientOther",  P.client,  P.clientOther,  "Client name")}
      ${_syncSel("\u{1F4CD} Site",    sites,    "window._ppr.site",    "window._ppr.siteOther",    P.site,    P.siteOther,    "Site or facility")}
      <div class="field"><label>Contract number</label>
        <input class="input" value="${escapeHtml(P.contractNo)}" oninput="window._ppr.contractNo=this.value"></div>
      <div class="field"><label>Contract / BOQ reference</label>
        <input class="input" value="${escapeHtml(P.contractRef)}" oninput="window._ppr.contractRef=this.value"></div>
      <div class="field"><label>Report number</label>
        <input class="input" value="${escapeHtml(P.reportNo)}" oninput="window._ppr.reportNo=this.value" placeholder="e.g. 07"></div>
      <div class="field"><label>Period from</label>
        <input class="input" type="date" value="${escapeHtml(P.from)}" oninput="window._ppr.from=this.value"></div>
      <div class="field"><label>Period to</label>
        <input class="input" type="date" value="${escapeHtml(P.to)}" oninput="window._ppr.to=this.value"></div>
      ${_syncSel("\u270D\uFE0F Prepared by", everyone, "window._ppr.preparedBy", "window._ppr.preparedByOther", P.preparedBy, P.preparedByOther, "Name and title")}
      ${_syncSel("\u2705 Approved by",  everyone, "window._ppr.approvedBy", "window._ppr.approvedByOther", P.approvedBy, P.approvedByOther, "Name and title")}
      <div class="field"><label>\u{1F91D} Client representative</label>
        <input class="input" value="${escapeHtml(P.clientRep)}" oninput="window._ppr.clientRep=this.value" placeholder="Name and title"></div>
      <div class="field"><label>\u{1F3DB}\uFE0F Consultant / Engineer</label>
        <input class="input" value="${escapeHtml(P.consultant)}" oninput="window._ppr.consultant=this.value" placeholder="Supervising consultant"></div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">02</span>
      <b>Key Dates</b>
    </div>
    <div style="font-size:11px;color:var(--muted);margin:6px 0 8px">
      The forecast date is the one the client reads. If it differs from the contract date, the reason belongs in Delays below.
    </div>
    <div class="grid2">
      <div class="field"><label>Commencement</label>
        <input class="input" type="date" value="${escapeHtml(P.commencement)}" oninput="window._ppr.commencement=this.value"></div>
      <div class="field"><label>Contract completion</label>
        <input class="input" type="date" value="${escapeHtml(P.contractCompletion)}" oninput="window._ppr.contractCompletion=this.value"></div>
      <div class="field"><label>Forecast completion</label>
        <input class="input" type="date" value="${escapeHtml(P.forecastCompletion)}" oninput="window._ppr.forecastCompletion=this.value"></div>
      <div class="field"><label>EOT granted (days)</label>
        <input class="input" inputmode="numeric" value="${escapeHtml(P.eotDays)}" oninput="window._ppr.eotDays=this.value"></div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">03</span>
      <b>Progress by System</b>
      <button class="btn btn-sm btn-secondary" style="margin-inline-start:auto" onclick="pprAddSystem()">+ Add</button>
    </div>
    <div style="font-size:11px;color:var(--muted);margin:6px 0 8px">
      Claimed per system, because the package is accepted system by system and one blended figure hides whichever is late.
      Give a scope value to weight the overall figure by money rather than by count.
    </div>
    ${window._pprSystems.length?`<div style="overflow-x:auto"><table class="tbl" style="min-width:640px">
      <thead><tr><th>System</th><th>Scope value</th><th>Planned %</th><th>Actual %</th><th>Remark</th><th></th></tr></thead>
      <tbody>${window._pprSystems.map((s,i)=>`<tr>
        <td><input class="input" list="ppr_sys_list" value="${escapeHtml(s.system)}" onchange="pprSetSystem(${i},'system',this.value)" placeholder="Type or choose"></td>
        <td><input class="input" inputmode="decimal" value="${escapeHtml(s.scope)}" onchange="pprSetSystem(${i},'scope',this.value);render()"></td>
        <td><input class="input" inputmode="decimal" value="${escapeHtml(s.planned)}" onchange="pprSetSystem(${i},'planned',this.value);render()"></td>
        <td><input class="input" inputmode="decimal" value="${escapeHtml(s.actual)}" onchange="pprSetSystem(${i},'actual',this.value);render()"></td>
        <td><input class="input" value="${escapeHtml(s.remark)}" onchange="pprSetSystem(${i},'remark',this.value)"></td>
        <td><button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="pprDelSystem(${i})">\u00d7</button></td>
      </tr>`).join("")}</tbody></table></div>
      <datalist id="ppr_sys_list">${sysNames.map(n=>`<option value="${escapeHtml(n)}">`).join("")}</datalist>
      <div style="display:flex;gap:10px;margin-top:10px">
        <div style="flex:1;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Planned</div>
          <div style="font-size:20px;font-weight:800">${pct(pg.planned)}</div></div>
        <div style="flex:1;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Actual</div>
          <div style="font-size:20px;font-weight:800;color:${pg.actual!=null&&pg.planned!=null&&pg.actual<pg.planned?"#C62828":"#2E7D32"}">${pct(pg.actual)}</div></div>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">${pg.weighted?"Weighted by scope value.":"Unweighted \u2014 add scope values to weight by money."}</div>`
      :`<div style="color:var(--muted);font-size:13px">No systems yet.</div>`}
    <div class="grid2" style="margin-top:10px">
      <div class="field"><label>Overall planned % (override)</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(P.overallPlanned)}" oninput="window._ppr.overallPlanned=this.value"></div>
      <div class="field"><label>Overall actual % (override)</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(P.overallActual)}" oninput="window._ppr.overallActual=this.value"></div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">04</span>
      <b>Financial & Safety Position</b>
    </div>
    <div class="grid2">
      <div class="field"><label>Currency</label>
        <select class="input" onchange="window._ppr.currency=this.value;render()">
          ${["USD","IQD"].map(c=>`<option ${P.currency===c?"selected":""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label>Contract value</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(P.contractValue)}" oninput="window._ppr.contractValue=this.value"></div>
      <div class="field"><label>Invoiced to date</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(P.invoicedToDate)}" oninput="window._ppr.invoicedToDate=this.value"></div>
      <div class="field"><label>Certified to date</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(P.certifiedToDate)}" oninput="window._ppr.certifiedToDate=this.value"></div>
      <div class="field"><label>Man-hours this period</label>
        <input class="input" inputmode="numeric" value="${escapeHtml(P.manhours)}" oninput="window._ppr.manhours=this.value"></div>
      <div class="field"><label>Days without a lost-time injury</label>
        <input class="input" inputmode="numeric" value="${escapeHtml(P.ltiFree)}" oninput="window._ppr.ltiFree=this.value"></div>
      <div class="field"><label>Days lost to weather / access</label>
        <input class="input" inputmode="numeric" value="${escapeHtml(P.weatherDays)}" oninput="window._ppr.weatherDays=this.value"></div>
    </div>
  </div>

  ${PPR_SECTIONS.map((s,i)=>pprSectionCard(s,i)).join("")}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">\u23F1\uFE0F</span>
      <b>Delay Events Register</b>
      <button class="btn btn-sm btn-secondary" style="margin-inline-start:auto" onclick="pprAddDelay()">+ Add</button>
    </div>
    <div style="font-size:11px;color:var(--muted);margin:6px 0 8px">
      A delay recorded without its cause and its responsible party is, in practice, a claim not made.
    </div>
    ${window._pprDelays.length?`<div style="overflow-x:auto"><table class="tbl" style="min-width:760px">
      <thead><tr><th>Event</th><th>From</th><th>To</th><th>Cause</th><th>Responsibility</th><th>Effect (days)</th><th>Notice ref</th><th></th></tr></thead>
      <tbody>${window._pprDelays.map((d,i)=>`<tr>
        <td><input class="input" value="${escapeHtml(d.event)}" onchange="pprSetDelay(${i},'event',this.value)"></td>
        <td><input class="input" type="date" value="${escapeHtml(d.from)}" onchange="pprSetDelay(${i},'from',this.value)"></td>
        <td><input class="input" type="date" value="${escapeHtml(d.to)}" onchange="pprSetDelay(${i},'to',this.value)"></td>
        <td><input class="input" value="${escapeHtml(d.cause)}" onchange="pprSetDelay(${i},'cause',this.value)"></td>
        <td><select class="input" onchange="pprSetDelay(${i},'responsibility',this.value)">
          ${opts(["Client","Consultant","Contractor","Third party","Force majeure"], d.responsibility)}</select></td>
        <td><input class="input" inputmode="numeric" value="${escapeHtml(d.effectDays)}" onchange="pprSetDelay(${i},'effectDays',this.value)"></td>
        <td><input class="input" value="${escapeHtml(d.notice)}" onchange="pprSetDelay(${i},'notice',this.value)" placeholder="Letter ref"></td>
        <td><button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="pprDelDelay(${i})">\u00d7</button></td>
      </tr>`).join("")}</tbody></table></div>`
      :`<div style="color:var(--muted);font-size:13px">No delay events recorded.</div>`}
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">\u{1F4F7}</span>
      <b>Photographs & Drawings</b>
    </div>
    <input type="file" accept="image/*" multiple onchange="pprAddPhotos(this)" style="margin-top:8px">
    ${typeof planBlockHTML==="function"?planBlockHTML("_pprPlans"):""}
    ${window._pprPhotos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${window._pprPhotos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:88px;height:66px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">
        <button class="btn btn-sm" style="position:absolute;top:-6px;inset-inline-end:-6px;background:#C62828;color:#fff;border:none;border-radius:50%;width:22px;height:22px;padding:0" onclick="pprDelPhoto(${i})">\u00d7</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">\u270D\uFE0F</span>
      <b>Signatures</b>
    </div>
    ${typeof signaturePad==="function"?signaturePad("ppr_prep","Prepared by","The author signs here"):""}
    ${typeof signaturePad==="function"?signaturePad("ppr_appr","Approved by","EJAF approval"):""}
    ${typeof signaturePad==="function"?signaturePad("ppr_client","Client / Consultant","Hand the device over"):""}
  </div>

  ${pprPreviewCard()}

  <div class="card" style="background:linear-gradient(135deg,#0B3D2E 0%,#14664B 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${typeof rptFormatToggle==="function"?rptFormatToggle(true):""}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%"
      onclick="generateProjectProgressReport()">${_fmtIcon()} Generate Progress Report (${_fmtName()})</button>
  </div>
  ${typeof srSaveBar==="function"?srSaveBar("ppr"):""}
  ${typeof srSavedList==="function"?srSavedList("ppr"):""}`;
}
Object.assign(window,{renderProjectProgressReport});

// ═══ PROJECT REPORT (v254) ══════════════════════════════════════════════
// A status report for a whole project rather than one system — the document a
// client or a steering committee reads.
//
// The section order follows PMBOK 7 and the Practice Standard for Project
// Status Reporting: what was agreed, what has happened against it, what it has
// cost, what is threatening it, and what is being asked for. That order is not
// decoration. Scope before progress, progress before cost, cost before risk,
// and decisions LAST, because a decision presented before its evidence is an
// opinion.
//
// Earned value is reported with the standard measures (PV, EV, AC \u2192 SPI,
// CPI) because "we are 60% done" means nothing on its own, and because a
// contractor who reports SPI and CPI is speaking the language the client's own
// PMO already uses.
const PRJ_SECTIONS = [
  {k:"summary",   n:"Executive Summary",        h:"The whole report in a paragraph \u2014 status, the one thing that matters most, and what is being asked for."},
  {k:"scope",     n:"Scope & Objectives",       h:"What this project is contracted to deliver. State it as agreed, not as remembered."},
  {k:"progress",  n:"Progress This Period",     h:"What was completed, by whom, and against which milestone."},
  {k:"milestones",n:"Milestones & Schedule",    h:"Planned versus actual dates. A slipped date is stated, never quietly rebased."},
  {k:"cost",      n:"Cost & Earned Value",      h:"Budget, committed, spent. SPI and CPI are calculated for you below."},
  {k:"quality",   n:"Quality & Compliance",     h:"Inspections, test results, snags raised and closed, standards applied."},
  {k:"hse",       n:"Health, Safety & Environment", h:"Incidents, near misses, toolbox talks, man-hours worked without a lost-time injury."},
  {k:"risks",     n:"Risks & Issues",           h:"A risk may happen; an issue already has. Give each an owner and a response."},
  {k:"changes",   n:"Change & Variations",      h:"Variation orders raised, approved, or pending \u2014 with their effect on time and cost."},
  {k:"resources", n:"Resources & Procurement",  h:"Manpower, subcontractors, long-lead items and their delivery status."},
  {k:"nextPlan",  n:"Plan for Next Period",     h:"What will be done before the next report, and what it depends on."},
  {k:"decisions", n:"Decisions & Actions Required", h:"What you need FROM the client, by when, and what happens if it does not arrive."},
];

// RAG status is the one thing a busy reader looks at first, so it is stated
// plainly rather than implied by a colour alone.
const PRJ_RAG = [
  {k:"green",  n:"On track",         c:"#2E7D32", d:"Delivering to plan; no intervention needed."},
  {k:"amber",  n:"At risk",          c:"#E65100", d:"Recoverable, but something must change."},
  {k:"red",    n:"Off track",        c:"#C62828", d:"Will not meet plan without a decision from the client."},
  {k:"hold",   n:"On hold",          c:"#5E5E5E", d:"Suspended \u2014 the reason and the restart condition are stated."},
  {k:"done",   n:"Complete",         c:"#1565C0", d:"Delivered and accepted."},
];

window._prj = window._prj || {
  client:"", clientOther:false, project:"", projectOther:false, site:"", siteOther:false,
  reportNo:"", from:"", to:"", date:"",
  // A report is often prepared or approved by someone who is not on the staff
  // list \u2014 a consultant, a client-side engineer, a new hire not yet added.
  // Forcing a dropdown there means the report is issued with the WRONG name on
  // it, or not issued at all. Each of these can be typed instead.
  preparedBy:"", preparedByOther:false,
  approvedBy:"", approvedByOther:false,
  clientRep:"",
  phase:"", contractRef:"", rag:"green", ragNote:"",
  pctPlanned:"", pctActual:"", budget:"", spent:"", committed:"", currency:"USD",
  plannedValue:"", earnedValue:"", actualCost:"",
  sections:{},          // {sectionKey: text}  — each one takes a Word/Excel import
};
window._prjMilestones = window._prjMilestones || [];  // [{name,planned,actual,status,note}]
window._prjRisks      = window._prjRisks      || [];  // [{title,type,impact,likelihood,owner,response}]
window._prjPhotos     = window._prjPhotos     || [];
window._prjPlans      = window._prjPlans      || [];

// ── Earned value ──
// Reported only when the inputs are actually there. A CPI of 1.00 shown because
// two blank fields divided into each other is worse than no CPI at all: it
// reads as "on budget" to someone who will act on it.
function _prjEV(){
  const n = v => { const x = Number(String(v==null?"":v).replace(/[^0-9.\-]/g,"")); return isFinite(x)?x:0; };
  const pv = n(window._prj.plannedValue), ev = n(window._prj.earnedValue), ac = n(window._prj.actualCost);
  const out = {pv, ev, ac, spi:null, cpi:null, sv:null, cv:null};
  if(pv > 0 && ev > 0){ out.spi = ev/pv; out.sv = ev-pv; }
  if(ac > 0 && ev > 0){ out.cpi = ev/ac; out.cv = ev-ac; }
  return out;
}
function _prjIndexLabel(v){
  if(v == null) return {t:"\u2014", c:"var(--muted)", note:"not enough data"};
  if(v >= 1.0)  return {t:v.toFixed(2), c:"#2E7D32", note:"ahead of / on plan"};
  if(v >= 0.95) return {t:v.toFixed(2), c:"#E65100", note:"slightly behind"};
  return {t:v.toFixed(2), c:"#C62828", note:"behind plan"};
}
Object.assign(window,{PRJ_SECTIONS, PRJ_RAG, _prjEV, _prjIndexLabel});

// ── milestone and risk rows ──
window.prjAddMilestone = function(){ window._prjMilestones.push({name:"",planned:"",actual:"",status:"On track",note:""}); render(); };
window.prjDelMilestone = function(i){ window._prjMilestones.splice(i,1); render(); };
window.prjSetMilestone = function(i,k,v){ if(window._prjMilestones[i]) window._prjMilestones[i][k]=v; };
window.prjAddRisk = function(){ window._prjRisks.push({title:"",type:"Risk",impact:"Medium",likelihood:"Medium",owner:"",response:""}); render(); };
window.prjDelRisk = function(i){ window._prjRisks.splice(i,1); render(); };
window.prjSetRisk = function(i,k,v){ if(window._prjRisks[i]) window._prjRisks[i][k]=v; };
window.prjAddPhotos = async function(input){
  const files = Array.from((input && input.files) || []);
  for(const f of files){
    if(window._prjPhotos.length >= 12){ toast("Max 12 photos"); break; }
    try{ window._prjPhotos.push({data: await compressImage(f), note:""}); }catch(e){}
  }
  input.value=""; render();
};
window.prjDelPhoto = function(i){ window._prjPhotos.splice(i,1); render(); };
window.prjSetRag   = function(v){ window._prj.rag=v; render(); };

// Each PMBOK section is a full import target in its own right \u2014 the same
// Word / Excel / CSV route the other generators use, replace-not-append and
// undoable, so a scope statement can come straight out of the contract.
function prjSectionCard(s, i){
  const path = `_prj.sections.${s.k}`;
  const val  = (window._prj.sections && window._prj.sections[s.k]) || "";
  return `<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">${String(i+1).padStart(2,"0")}</span>
      <b>${escapeHtml(s.n)}</b>
    </div>
    <div style="font-size:11px;color:var(--muted);margin:6px 0 8px">${escapeHtml(s.h)}</div>
    ${typeof tableToolbar==="function"?tableToolbar(path):""}
    ${typeof tablePreviewHTML==="function"?tablePreviewHTML(val, "prj_"+s.k):""}
    <textarea rows="4" oninput="_prj.sections.${s.k}=this.value" placeholder="${escapeHtml(s.h)}">${escapeHtml(val)}</textarea>
  </div>`;
}

// ═══ WHAT WILL ACTUALLY PRINT ═════════════════════════════════════════
// Because empty items are dropped from the finished document, the person needs
// to see BEFORE generating which parts are in and which are out — otherwise
// "hidden because empty" is indistinguishable from "lost". This is the same
// test the printer uses, so the list can never disagree with the document.
function _prjFilled(v){
  if(v == null) return false;
  const s = String(v).trim();
  return s !== "" && s !== "\u2014" && s !== "-";
}
function prjWillPrint(){
  const m = window._prj, ev = _prjEV(), out = [];
  const idFields = [m.client,m.project,m.site,m.contractRef,m.phase,m.from,m.to,
                    m.reportNo,m.preparedBy,m.approvedBy,m.clientRep];
  out.push({n:"Project Identification", on:idFields.some(_prjFilled),
            why:"needs at least one project detail"});
  out.push({n:"Overall Status", on:true, why:"always included \u2014 a status report states a status"});
  out.push({n:"Cost & Schedule Performance", on:!!(ev.pv||ev.ev||ev.ac),
            why:"needs PV, EV or AC"});
  out.push({n:"Milestones & Schedule",
            on:(window._prjMilestones||[]).some(x=>_prjFilled(x.name)), why:"needs a named milestone"});
  out.push({n:"Risk & Issue Register",
            on:(window._prjRisks||[]).some(x=>_prjFilled(x.title)), why:"needs a titled risk or issue"});
  PRJ_SECTIONS.forEach(s => out.push({n:s.n, on:_prjFilled((m.sections||{})[s.k]), why:"section is empty"}));
  out.push({n:"Site Plans & Drawings", on:(window._prjPlans||[]).length>0, why:"no drawing imported"});
  out.push({n:"Site Photographs",      on:(window._prjPhotos||[]).length>0, why:"no photo added"});
  out.push({n:"Approval", on:(typeof sigAny==="function" && sigAny(["prj_prep","prj_appr","prj_client"])),
            why:"nobody has signed"});
  return out;
}
function prjPreviewCard(){
  const rows = prjWillPrint();
  const inc = rows.filter(r=>r.on).length;
  const out = rows.length - inc;
  return `<div class="card" style="border:2px solid #C9A84C">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">\u{1F441}\uFE0F</span>
      <b>What the report will contain</b>
    </div>
    <div style="font-size:11px;color:var(--muted);margin:6px 0 10px">
      Anything left blank is left OUT of the finished document \u2014 in PDF, Word and Excel alike \u2014
      so the client never receives a page of dashes. <b>${inc} in, ${out} left out.</b>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px">
      ${rows.map(r=>`<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 6px;border-radius:6px;background:${r.on?"rgba(46,125,50,.08)":"transparent"}">
        <span style="width:16px;text-align:center;color:${r.on?"#2E7D32":"var(--muted)"};font-weight:800">${r.on?"\u2713":"\u00b7"}</span>
        <span style="flex:1;color:${r.on?"var(--fg)":"var(--muted)"};${r.on?"":"text-decoration:line-through;opacity:.65"}">${escapeHtml(r.n)}</span>
        ${r.on?"":`<span style="font-size:10px;color:var(--muted)">${escapeHtml(r.why)}</span>`}
      </div>`).join("")}
    </div>
  </div>`;
}
Object.assign(window,{prjWillPrint, prjPreviewCard, _prjFilled});

function prjEVCard(){
  const ev = _prjEV();
  const spi = _prjIndexLabel(ev.spi), cpi = _prjIndexLabel(ev.cpi);
  const cur = escapeHtml(window._prj.currency||"USD");
  const money = v => v==null ? "\u2014" : (v<0?"-":"") + cur + " " + Math.abs(Math.round(v)).toLocaleString();
  return `<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">EV</span>
      <b>Earned Value</b>
    </div>
    <div style="font-size:11px;color:var(--muted);margin:6px 0 8px">
      Enter the three standard inputs. SPI and CPI are calculated \u2014 and left blank rather than guessed when a figure is missing.
    </div>
    <div class="grid2">
      <div class="field"><label>Planned Value (PV) \u2014 budgeted cost of work SCHEDULED</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(window._prj.plannedValue)}" oninput="_prj.plannedValue=this.value" onchange="render()"></div>
      <div class="field"><label>Earned Value (EV) \u2014 budgeted cost of work PERFORMED</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(window._prj.earnedValue)}" oninput="_prj.earnedValue=this.value" onchange="render()"></div>
      <div class="field"><label>Actual Cost (AC) \u2014 what has actually been spent</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(window._prj.actualCost)}" oninput="_prj.actualCost=this.value" onchange="render()"></div>
      <div class="field"><label>Currency</label>
        <select class="input" onchange="_prj.currency=this.value;render()">
          ${["USD","IQD"].map(c=>`<option ${window._prj.currency===c?"selected":""}>${c}</option>`).join("")}
        </select></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
      <div style="flex:1;min-width:130px;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--muted)">SPI \u2014 schedule</div>
        <div style="font-size:22px;font-weight:800;color:${spi.c}">${spi.t}</div>
        <div style="font-size:10px;color:var(--muted)">${spi.note}</div>
        <div style="font-size:10px;color:var(--muted)">SV ${money(ev.sv)}</div>
      </div>
      <div style="flex:1;min-width:130px;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--muted)">CPI \u2014 cost</div>
        <div style="font-size:22px;font-weight:800;color:${cpi.c}">${cpi.t}</div>
        <div style="font-size:10px;color:var(--muted)">${cpi.note}</div>
        <div style="font-size:10px;color:var(--muted)">CV ${money(ev.cv)}</div>
      </div>
    </div>
  </div>`;
}
Object.assign(window,{prjSectionCard, prjEVCard});

window.generateProjectReport = async function(){
  const m = window._prj;
  if(!(m.client || m.project)) return toast("\u26a0 Enter at least the client or project");
  const rag = PRJ_RAG.find(r=>r.k===m.rag) || PRJ_RAG[0];
  const ev  = _prjEV();
  const esc = v => escapeHtml(String(v==null?"":v));

  // \u2550\u2550\u2550 NOTHING EMPTY IS PRINTED (v255) \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // A project status report is read by a client, and a page of dashes reads as
  // work not done rather than as a field left blank. Every row, every table and
  // every heading is now printed ONLY when it carries a value: an unused
  // section leaves no trace at all, and a table whose column is empty for every
  // row drops that column rather than ruling an empty strip down the page.
  //
  // The rule is applied at the point of PRINTING, so it holds for PDF, Word and
  // Excel alike \u2014 all three are produced from this same body.
  const filled = v => {
    if(v == null) return false;
    const s = String(v).trim();
    return s !== "" && s !== "\u2014" && s !== "-";
  };
  const dash = v => filled(v) ? esc(v) : "\u2014";
  // Section numbers are COUNTED, never written by hand: inserting a section
  // must never leave the document numbered 1,2,2,4.
  const K = (()=>{ let n=0; return ()=>String(++n).padStart(2,"0"); })();
  // A row is emitted only when it has something to say. `rawRow` exists for the
  // few values that are already HTML (a coloured index), and it applies the
  // same test to the underlying value rather than to the markup.
  const row = (l,v) => filled(v) ? `<tr><td style="border:1px solid #ccc;padding:5px 8px;background:#F7F7F7;font-weight:600;width:34%">${esc(l)}</td><td style="border:1px solid #ccc;padding:5px 8px">${esc(v)}</td></tr>` : "";
  const rawRow = (l,test,html) => filled(test) ? `<tr><td style="border:1px solid #ccc;padding:5px 8px;background:#F7F7F7;font-weight:600;width:34%">${esc(l)}</td><td style="border:1px solid #ccc;padding:5px 8px">${html}</td></tr>` : "";
  // A heading with an empty table under it is worse than no heading.
  const sect = (title, inner) => String(inner).trim() ? head(K(), title) + inner : "";
  const table = rows => String(rows).trim() ? `<table style="border-collapse:collapse;width:100%;font-size:11px">${rows}</table>` : "";
  // Build a grid, dropping any column that is empty in EVERY row. A register
  // where nobody filled in "Likelihood" should not carry an empty Likelihood
  // strip down the whole page \u2014 and dropping it in the printer, not in the
  // form, means the person can still fill it in later without losing anything.
  const grid = (headers, rows) => {
    if(!rows.length) return "";
    const keep = headers.map((_,c) => rows.some(r => filled(r[c])));
    if(!keep.some(Boolean)) return "";
    const th = headers.filter((_,c)=>keep[c])
      .map(h=>`<th style="border:1px solid #ccc;padding:5px 8px;background:#1B3A6B;color:#fff;text-align:start">${esc(h)}</th>`).join("");
    const tb = rows.map(r=>`<tr>${r.filter((_,c)=>keep[c])
      .map(cell=>`<td style="border:1px solid #ccc;padding:5px 8px">${cell && cell.html ? cell.html : (filled(cell)?esc(cell):"")}</td>`).join("")}</tr>`).join("");
    return `<table style="border-collapse:collapse;width:100%;font-size:11px"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
  };
  const head = (no,t) => `<div style="margin:16px 0 6px;padding:5px 9px;background:#1B3A6B;color:#fff;font-weight:700;font-size:12px;border-radius:3px">${no}. ${esc(t)}</div>`;
  const period = [m.from?fmtDate(m.from):"", m.to?fmtDate(m.to):""].filter(Boolean).join(" \u2014 ") || "\u2014";
  const cur = esc(m.currency||"USD");
  const money = v => v==null ? "\u2014" : (v<0?"-":"") + cur + " " + Math.abs(Math.round(v)).toLocaleString();
  const ix = (v,label) => { const L=_prjIndexLabel(v);
    return `<strong style="color:${L.c}">${L.t}</strong> <span style="color:#777;font-size:10px">(${esc(L.note)})</span>`; };

  let body = "";

  // 1. Identification
  body += sect("Project Identification", table(`
    ${row("Client", m.client)}
    ${row("Project", m.project)}
    ${row("Site", m.site)}
    ${row("Contract reference", m.contractRef)}
    ${row("Project phase", m.phase)}
    ${row("Reporting period", period)}
    ${row("Report number", m.reportNo)}
    ${row("Prepared by", m.preparedBy)}
    ${row("Approved by", m.approvedBy)}
    ${row("Client representative", m.clientRep)}`));

  // 2. Status \u2014 the thing the reader looks at first
  // The status badge always prints: a status report without a status is not a
  // status report, and "on track" is a real answer rather than an empty field.
  body += head(K(),"Overall Status") + `
    <div style="display:flex;gap:10px;align-items:stretch;margin-bottom:8px">
      <div style="background:${rag.c};color:#fff;padding:12px 18px;border-radius:6px;font-weight:800;font-size:15px;display:flex;align-items:center">${esc(rag.n)}</div>
      <div style="flex:1;border:1px solid #ccc;border-radius:6px;padding:8px 12px;font-size:11px;line-height:1.6">
        ${esc(rag.d)}${filled(m.ragNote)?`<br><strong>${esc(m.ragNote)}</strong>`:""}
      </div>
    </div>
    ${table(`
      ${row("Planned complete", filled(m.pctPlanned) ? m.pctPlanned+"%" : "")}
      ${row("Actual complete",  filled(m.pctActual)  ? m.pctActual+"%"  : "")}`)}`;

  // 3. Earned value \u2014 printed only when the inputs exist
  if(ev.pv || ev.ev || ev.ac){
    const evTable = table(`
      ${row("Planned Value (PV)", ev.pv ? money(ev.pv) : "")}
      ${row("Earned Value (EV)",  ev.ev ? money(ev.ev) : "")}
      ${row("Actual Cost (AC)",   ev.ac ? money(ev.ac) : "")}
      ${rawRow("Schedule Performance Index (SPI)", ev.spi, ix(ev.spi))}
      ${rawRow("Cost Performance Index (CPI)",     ev.cpi, ix(ev.cpi))}
      ${row("Schedule Variance (SV = EV \u2212 PV)", ev.sv==null ? "" : money(ev.sv))}
      ${row("Cost Variance (CV = EV \u2212 AC)",     ev.cv==null ? "" : money(ev.cv))}`);
    body += sect("Cost & Schedule Performance (Earned Value)", evTable && (evTable +
      `<div style="font-size:9.5px;color:#777;margin-top:4px">Indices are reported to PMBOK convention: 1.00 is on plan, below 1.00 is behind. An index is omitted rather than estimated when an input is missing.</div>`));
  }

  // 4. Milestones
  const ms = window._prjMilestones.filter(x=>filled(x.name));
  body += sect("Milestones & Schedule", grid(
    ["Milestone","Planned","Actual / forecast","Status"],
    ms.map(x=>{
      const late = /late|risk/i.test(x.status||"");
      return [ x.name,
               x.planned ? fmtDate(x.planned) : "",
               x.actual  ? fmtDate(x.actual)  : "",
               filled(x.status) ? {html:`<span style="color:${late?"#C62828":"#2E7D32"};font-weight:600">${esc(x.status)}</span>`, toString:()=>x.status} : "" ];
    })));

  // 5. Risks and issues
  const rk = window._prjRisks.filter(x=>filled(x.title));
  body += sect("Risk & Issue Register", grid(
    ["Title","Type","Impact","Likelihood","Owner","Response"],
    rk.map(x=>[ x.title, x.type,
      filled(x.impact) ? {html:`<span style="color:${/high/i.test(x.impact)?"#C62828":"#333"}">${esc(x.impact)}</span>`, toString:()=>x.impact} : "",
      x.likelihood, x.owner, x.response ])));

  // 6+. The narrative sections, in PMBOK order, each printed only if written.
  // Imported tables print AS TABLES \u2014 the same renderer the other reports use.
  PRJ_SECTIONS.forEach(s=>{
    const txt = (m.sections && m.sections[s.k]) || "";
    if(!filled(txt)) return;
    body += head(K(), s.n) + `<div style="font-size:11px;line-height:1.75">
      ${typeof textWithTablesHTML==="function" ? textWithTablesHTML(txt,{dash:false}) : esc(txt)}
    </div>`;
  });

  // Drawings before photographs: a plan is evidence of scope, a photograph is
  // evidence of work, and they are read in that order.
  if(window._prjPlans.length) body += (typeof _rptPlanSheets==="function" ? _rptPlanSheets(window._prjPlans,"Site Plans & Drawings") : "");
  if(window._prjPhotos.length) body += (typeof _rptPhotoGrid==="function" ? _rptPhotoGrid(window._prjPhotos,"Site Photographs") : "");

  // Signatures \u2014 the same pads and the same printer every other report uses,
  // so an unsigned report simply omits the block rather than printing empty rules.
  if(typeof sigAny==="function" && sigAny(["prj_prep","prj_appr","prj_client"])){
    body += head(K(),"Approval") + (typeof sigRow==="function" ? sigRow([
      ["prj_prep",   m.preparedBy || "Prepared by",          "Project Engineer",       "EJAF Technology"],
      ["prj_appr",   m.approvedBy || "Approved by",          "Projects Manager",       "EJAF Technology"],
      ["prj_client", m.clientRep  || "Client representative", "",                      m.client || ""],
    ]) : "");
  }

  // The standards note belongs in the document, not only in the code: a client
  // reading this should be able to see what it was written against.
  // No standards footnote here either \u2014 same reason as the progress report.

  await openReportPDF("PROJECT_REPORT",
    [m.date?fmtDate(m.date):"", m.client, m.project].filter(Boolean).join(" \u00b7 ") || period,
    body, {project:m.project||"", client:m.client||""});
  toast("Project report ready!");
};

function renderProjectReport(){
  const P = window._prj;
  const rag = PRJ_RAG.find(r=>r.k===P.rag) || PRJ_RAG[0];
  const opts = (list, cur) => (list||[]).map(v=>`<option ${cur===v?"selected":""}>${escapeHtml(v)}</option>`).join("");
  const projects = (state.projects||[]).map(p=>p.name).filter(Boolean);
  const clients  = (state.clients ||[]).map(c=>c.name).filter(Boolean);
  const sites    = (state.locations||[]).map(l=>l.name).filter(Boolean);
  // allEmployees() deliberately returns FIELD staff \u2014 it feeds the daily log,
  // where a manager is not someone you book hours against. An approver is
  // usually a manager, so the approval lists are built from everyone on the
  // system instead, with the field staff merged in.
  const people   = (typeof allEmployees==="function"?allEmployees():[]);
  const everyone = Array.from(new Set(
    (state.users||[]).map(u=>(u.employeeName||u.name||"").trim()).filter(Boolean)
      .concat(people)
  )).sort();

  // _rptHero takes a FOURTH argument, the gradient. Omitting it left the card
  // with no background at all, so white heading text sat on white paper and
  // the title was invisible on the device.
  return `${_rptHero("\u{1F4CB}","Project Report","Status report to PMBOK 7 \u2014 scope, progress, cost, risk, decisions","linear-gradient(135deg,#0F2347 0%,#1B3A6B 60%,#2E5FA3 100%)")}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">01</span>
      <b>Project & Period</b>
    </div>
    <div class="grid2">
      ${_syncSel("\u{1F4C1} Project", projects, "window._prj.project", "window._prj.projectOther", P.project, P.projectOther, "Project name")}
      ${_syncSel("\u{1F464} Client",  clients,  "window._prj.client",  "window._prj.clientOther",  P.client,  P.clientOther,  "Client name")}
      ${_syncSel("\u{1F4CD} Site",    sites,    "window._prj.site",    "window._prj.siteOther",    P.site,    P.siteOther,    "Site or facility")}
      <div class="field"><label>Contract reference</label>
        <input class="input" value="${escapeHtml(P.contractRef)}" oninput="_prj.contractRef=this.value"></div>
      <div class="field"><label>Phase</label>
        <select class="input" onchange="_prj.phase=this.value">
          ${opts(["","Initiation","Planning","Execution","Monitoring & Control","Closing"], P.phase)}</select></div>
      <div class="field"><label>Report number (optional)</label>
        <input class="input" value="${escapeHtml(P.reportNo)}" oninput="_prj.reportNo=this.value" placeholder="e.g. 04"></div>
      <div class="field"><label>Period from</label>
        <input class="input" type="date" value="${escapeHtml(P.from)}" oninput="_prj.from=this.value"></div>
      <div class="field"><label>Period to</label>
        <input class="input" type="date" value="${escapeHtml(P.to)}" oninput="_prj.to=this.value"></div>
      ${_syncSel("\u270D\uFE0F Prepared by", everyone, "window._prj.preparedBy", "window._prj.preparedByOther", P.preparedBy, P.preparedByOther, "Name and title")}
      ${_syncSel("\u2705 Approved by",  everyone, "window._prj.approvedBy", "window._prj.approvedByOther", P.approvedBy, P.approvedByOther, "Name and title")}
      <div class="field full"><label>\u{1F91D} Client representative</label>
        <input class="input" value="${escapeHtml(P.clientRep)}" oninput="window._prj.clientRep=this.value"
               placeholder="Name and title \u2014 typed, since the client's people are not on our staff list"></div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">02</span>
      <b>Overall Status</b>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">
      ${PRJ_RAG.map(r=>`<button type="button" class="btn btn-sm" onclick="prjSetRag('${r.k}')"
        style="background:${P.rag===r.k?r.c:"var(--card)"};color:${P.rag===r.k?"#fff":"var(--fg)"};border:1px solid ${P.rag===r.k?r.c:"var(--line)"};font-weight:700">${escapeHtml(r.n)}</button>`).join("")}
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${escapeHtml(rag.d)}</div>
    <div class="grid2">
      <div class="field"><label>Planned complete (%)</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(P.pctPlanned)}" oninput="_prj.pctPlanned=this.value"></div>
      <div class="field"><label>Actual complete (%)</label>
        <input class="input" inputmode="decimal" value="${escapeHtml(P.pctActual)}" oninput="_prj.pctActual=this.value"></div>
      <div class="field full"><label>Why this status</label>
        <input class="input" value="${escapeHtml(P.ragNote)}" oninput="_prj.ragNote=this.value"
               placeholder="A status without a reason cannot be acted on"></div>
    </div>
  </div>

  ${prjEVCard()}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">MS</span>
      <b>Milestones</b>
      <button class="btn btn-sm btn-secondary" style="margin-inline-start:auto" onclick="prjAddMilestone()">+ Add</button>
    </div>
    ${window._prjMilestones.length?`<div style="overflow-x:auto"><table class="tbl" style="min-width:560px">
      <thead><tr><th>Milestone</th><th>Planned</th><th>Actual / forecast</th><th>Status</th><th></th></tr></thead>
      <tbody>${window._prjMilestones.map((m,i)=>`<tr>
        <td><input class="input" value="${escapeHtml(m.name)}" onchange="prjSetMilestone(${i},'name',this.value)"></td>
        <td><input class="input" type="date" value="${escapeHtml(m.planned)}" onchange="prjSetMilestone(${i},'planned',this.value)"></td>
        <td><input class="input" type="date" value="${escapeHtml(m.actual)}" onchange="prjSetMilestone(${i},'actual',this.value)"></td>
        <td><select class="input" onchange="prjSetMilestone(${i},'status',this.value)">
          ${opts(["On track","Achieved","Late","At risk","Not started"], m.status)}</select></td>
        <td><button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="prjDelMilestone(${i})">\u00d7</button></td>
      </tr>`).join("")}</tbody></table></div>`
      :`<div style="color:var(--muted);font-size:13px">No milestones yet.</div>`}
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">RI</span>
      <b>Risk & Issue Register</b>
      <button class="btn btn-sm btn-secondary" style="margin-inline-start:auto" onclick="prjAddRisk()">+ Add</button>
    </div>
    ${window._prjRisks.length?`<div style="overflow-x:auto"><table class="tbl" style="min-width:640px">
      <thead><tr><th>Title</th><th>Type</th><th>Impact</th><th>Likelihood</th><th>Owner</th><th>Response</th><th></th></tr></thead>
      <tbody>${window._prjRisks.map((r,i)=>`<tr>
        <td><input class="input" value="${escapeHtml(r.title)}" onchange="prjSetRisk(${i},'title',this.value)"></td>
        <td><select class="input" onchange="prjSetRisk(${i},'type',this.value)">${opts(["Risk","Issue"], r.type)}</select></td>
        <td><select class="input" onchange="prjSetRisk(${i},'impact',this.value)">${opts(["Low","Medium","High"], r.impact)}</select></td>
        <td><select class="input" onchange="prjSetRisk(${i},'likelihood',this.value)">${opts(["Low","Medium","High"], r.likelihood)}</select></td>
        <td><input class="input" value="${escapeHtml(r.owner)}" onchange="prjSetRisk(${i},'owner',this.value)"></td>
        <td><input class="input" value="${escapeHtml(r.response)}" onchange="prjSetRisk(${i},'response',this.value)"></td>
        <td><button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="prjDelRisk(${i})">\u00d7</button></td>
      </tr>`).join("")}</tbody></table></div>`
      :`<div style="color:var(--muted);font-size:13px">No risks or issues recorded.</div>`}
  </div>

  ${PRJ_SECTIONS.map((s,i)=>prjSectionCard(s,i)).join("")}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">\u{1F4F7}</span>
      <b>Photos & Drawings</b>
    </div>
    <input type="file" accept="image/*" multiple onchange="prjAddPhotos(this)" style="margin-top:8px">
    ${typeof planBlockHTML==="function"?planBlockHTML("_prjPlans"):""}
    ${window._prjPhotos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${window._prjPhotos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:88px;height:66px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">
        <button class="btn btn-sm" style="position:absolute;top:-6px;inset-inline-end:-6px;background:#C62828;color:#fff;border:none;border-radius:50%;width:22px;height:22px;padding:0" onclick="prjDelPhoto(${i})">\u00d7</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">\u270D\uFE0F</span>
      <b>Approval</b>
    </div>
    ${typeof signaturePad==="function"?signaturePad("prj_prep","Prepared by \u2014 signature","The author signs here"):""}
    ${typeof signaturePad==="function"?signaturePad("prj_appr","Approved by \u2014 signature","EJAF approval"):""}
    ${typeof signaturePad==="function"?signaturePad("prj_client","Client representative \u2014 signature","Hand the device to the client"):""}
  </div>

  ${prjPreviewCard()}

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${typeof rptFormatToggle==="function"?rptFormatToggle(true):""}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%"
      onclick="generateProjectReport()">${_fmtIcon()} Generate Project Report (${_fmtName()})</button>
  </div>
  ${typeof srSaveBar==="function"?srSaveBar("project"):""}
  ${typeof srSavedList==="function"?srSavedList("project"):""}`;
}
Object.assign(window,{renderProjectReport});

// ═══ SITE PLANS FROM PDF (v253) ═══════════════════════════════════════
// A drawing is not text, so it cannot travel the Word route into a text field.
// It is rendered to an image instead and printed alongside the report.
//
// Plans are kept in their OWN array, separate from site photographs, for one
// reason: resolution. A photograph of a rack survives being reduced to 1024px;
// a floor plan does not — at that size the dimension strings and room names
// stop being readable, which is the only reason the drawing is in the report.
// AutoCAD and Revit produce vector PDF, so the page can be redrawn at any
// resolution we ask for, and 2048px is asked for.
//
// The 12-photo ceiling is not shared either. A five-page drawing set would
// otherwise consume most of the allowance for site photographs.
const PLAN_MAX      = 8;
const PLAN_WIDTH    = 2048;   // readable dimension strings
const PLAN_QUALITY  = 0.82;   // line art suffers badly below this
const PLAN_THUMB_W  = 900;    // the reference copy that is stored
const PLAN_THUMB_Q  = 0.55;

// PDF.js ships its parser and its worker separately; the worker has to be
// pointed at explicitly or it silently falls back to blocking the main thread.
async function _planLib(){
  if(!await needLib("pdfjsLib","the drawing reader")) return null;
  try{
    const lib = window.pdfjsLib;
    if(lib && lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc){
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js";
    }
    return lib;
  }catch(e){ return null; }
}

// Draw one page at a width that keeps the lettering legible.
async function _planRenderPage(pdf, pageNo, targetW){
  const page = await pdf.getPage(pageNo);
  const base = page.getViewport({scale:1});
  const scale = Math.max(0.2, Math.min(6, targetW / base.width));
  const vp = page.getViewport({scale});
  const cv = document.createElement("canvas");
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const cx = cv.getContext("2d");
  // A drawing exported from CAD usually has no background of its own; without
  // this it renders as black lines on transparent, which becomes black on
  // black once the PDF viewer composites it.
  cx.fillStyle = "#FFFFFF"; cx.fillRect(0,0,cv.width,cv.height);
  await page.render({canvasContext:cx, viewport:vp}).promise;
  return {data:cv.toDataURL("image/jpeg", PLAN_QUALITY), w:cv.width, h:cv.height};
}

window._planPick = window._planPick || null;   // {pages, name, target, doc}

// Step 1: open the file and find out how many pages it has.
window.planImportOpen = async function(input, targetArr){
  const f = input && input.files && input.files[0];
  if(!f){ return; }
  input.value = "";
  if(!/\.pdf$/i.test(f.name)){ toast("Choose a PDF drawing"); return; }
  const lib = await _planLib();
  if(!lib) return;
  toast("Opening the drawing\u2026");
  try{
    const buf = await f.arrayBuffer();
    const pdf = await lib.getDocument({data:new Uint8Array(buf)}).promise;
    if(pdf.numPages === 1){
      await _planAdd(pdf, 1, targetArr, f.name);
      return;
    }
    window._planPick = {doc:pdf, pages:pdf.numPages, name:f.name, target:targetArr, chosen:{1:true}};
    render();
  }catch(e){
    toast("That PDF could not be read \u2014 it may be password protected");
  }
};

window.planTogglePage = function(n){
  const P = window._planPick; if(!P) return;
  if(P.chosen[n]) delete P.chosen[n]; else P.chosen[n] = true;
  render();
};
window.planPickCancel = function(){ window._planPick = null; render(); };

window.planPickConfirm = async function(){
  const P = window._planPick; if(!P) return;
  const pages = Object.keys(P.chosen).map(Number).sort((a,b)=>a-b);
  if(!pages.length){ toast("Choose at least one page"); return; }
  window._planPick = null;
  render();
  for(const n of pages){ if(!await _planAdd(P.doc, n, P.target, P.name)) break; }
};

async function _planAdd(pdf, pageNo, targetArr, fileName){
  const arr = window[targetArr] = (window[targetArr] || []);
  if(arr.length >= PLAN_MAX){ toast(`Up to ${PLAN_MAX} drawings per report`); return false; }
  toast(`Rendering page ${pageNo}\u2026`);
  try{
    const full = await _planRenderPage(pdf, pageNo, PLAN_WIDTH);
    arr.push({data:full.data, w:full.w, h:full.h, page:pageNo,
              name:(fileName||"Drawing").replace(/\.pdf$/i,""), caption:""});
    render();
    toast("Drawing added \u2713");
    return true;
  }catch(e){ toast(`Page ${pageNo} could not be rendered`); return false; }
}

window.planDelete = function(targetArr, i){
  const arr = window[targetArr]; if(!arr) return;
  arr.splice(i,1); render();
};
window.planCaption = function(targetArr, i, v){
  const arr = window[targetArr]; if(!arr || !arr[i]) return;
  arr[i].caption = v;   // no render(): retyping the field mid-edit loses the caret
};

// The picker shown when a drawing set has more than one page.
function planPickerHTML(){
  const P = window._planPick;
  if(!P) return "";
  const btns = [];
  for(let n=1;n<=P.pages;n++){
    const on = !!P.chosen[n];
    btns.push(`<button type="button" class="btn btn-sm" onclick="planTogglePage(${n})"
      style="background:${on?"#03308B":"var(--card)"};color:${on?"#fff":"var(--fg)"};border:1px solid ${on?"#03308B":"var(--line)"};min-width:44px">${n}</button>`);
  }
  return `<div class="card" style="border:2px solid #C9A84C">
    <div class="card-title">\u{1F4D0} ${escapeHtml(P.name)} \u2014 ${P.pages} pages</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Choose the pages to bring in.</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${btns.join("")}</div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="planPickConfirm()">Add selected</button>
      <button class="btn btn-secondary" onclick="planPickCancel()">Cancel</button>
    </div>
  </div>`;
}

// The editing block that sits inside each generator.
function planBlockHTML(targetArr){
  const arr = window[targetArr] || [];
  return `${planPickerHTML()}
  <div style="margin-top:10px">
    <label class="btn btn-sm btn-secondary" style="cursor:pointer">\u{1F4D0} Import site plan (PDF)
      <input type="file" accept="application/pdf,.pdf" style="display:none"
             onchange="planImportOpen(this,${jsArg(targetArr)})">
    </label>
    <span style="font-size:11px;color:var(--muted);margin-inline-start:8px">
      AutoCAD and Revit drawings redraw sharply. Up to ${PLAN_MAX}, kept at full size for printing \u2014 separate from the photo allowance.
    </span>
    ${arr.length?`<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      ${arr.map((p,i)=>`<div style="display:flex;gap:8px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:8px">
        <img src="${p.data}" style="width:92px;height:70px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:6px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)} \u00b7 p.${p.page}</div>
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px">${p.reference
            ? `<span style="color:#E65100">Reference copy \u2014 re-import the PDF before printing</span>`
            : `${p.w}\u00d7${p.h}px \u00b7 print quality`}</div>
          <input class="input" style="font-size:12px;padding:4px 8px" placeholder="Caption (optional)"
                 value="${escapeHtml(p.caption||"")}" onchange="planCaption(${jsArg(targetArr)},${i},this.value)">
        </div>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="planDelete(${jsArg(targetArr)},${i})">\u00d7</button>
      </div>`).join("")}
    </div>`:""}
  </div>`;
}

// Printed full width, one per page: a plan squeezed into a photo tile is not a
// plan any more.
function _rptPlanSheets(plans, label){
  if(!plans || !plans.length) return "";
  return `<div class="ksec"><span class="kbad">\u{1F4D0}</span><h3>${label} (${plans.length})</h3></div>
    ${plans.map((p,i)=>`<div style="page-break-inside:avoid;margin-bottom:14px;text-align:center">
      <img src="${p.data}" style="max-width:100%;height:auto;border:1px solid #ccc;border-radius:4px">
      <div style="font-size:10px;color:#666;margin-top:3px">${escapeHtml(p.caption||p.name||"Drawing")} \u2014 page ${p.page}${p.reference?" (reference copy)":""}</div>
    </div>`).join("")}`;
}
Object.assign(window,{PLAN_MAX, PLAN_WIDTH, PLAN_THUMB_W, planBlockHTML, planPickerHTML,
  _rptPlanSheets, _planRenderPage, _planAdd});

// ═══ SAVED REPORTS (v250) ════════════════════════════════════════════════
// The four generators held everything in memory: fill in an inspection, export
// it, and the moment the tab changed the work was gone. There was no way to
// correct a typo the next morning, no record of what was issued, and a
// half-finished report could not survive a phone call.
//
// One collection serves all four. Each document names its KIND and carries the
// generator's own state verbatim, so a report opens back into the form that
// produced it and nothing needs to be translated on the way in or out.
//
// PHOTOS: a Firestore document is capped at 1 MB. Report photos are already
// compressed on capture, but a dozen of them still blow past that, and a save
// that fails at the last cylinder is worse than one that never promised. So
// photos are re-compressed HARD for storage and dropped entirely once the
// budget is spent — the report is what matters, and the export the person
// already produced keeps the full-resolution originals.
const SR_DOC_BUDGET = 700 * 1024;   // stay well under the 1 MB document ceiling
const SR_PLAN_REF_W = 900;          // a drawing kept only as a reference
const SR_PLAN_REF_Q = 0.55;
const SR_KINDS = {
  pm:    {label:"PM Report",        state:["_pmMan","_pmManItems"],            photos:"_pmRptPhotos", plans:"_pmRptPlans"},
  fm200: {label:"FM-200 Test",      state:["_fm","_fmCyls","_fmChk"],          photos:"_fmPhotos",    plans:"_fmPlans"},
  tech:  {label:"Technical Report", state:["_sr","_srDevs","_srChk","_srSubs","_srInt"], photos:"_srPhotos", plans:"_srPlans"},
  prog:  {label:"Progress Report",  state:["_pr","_prTasks","_prPeople"],      photos:"_prPhotos", plans:"_prPlans"},
  project:{label:"Project Report", state:["_prj","_prjMilestones","_prjRisks"], photos:"_prjPhotos", plans:"_prjPlans"},
  ppr:   {label:"Project Progress Report", state:["_ppr","_pprSystems","_pprDelays"], photos:"_pprPhotos", plans:"_pprPlans"},
};

// Re-encode a stored photo small enough that a whole report fits in one
// document. Returns null when it cannot be shrunk, so the caller drops it
// rather than saving something that will be refused.
function _srShrink(dataUrl, maxW, quality){
  return new Promise((resolve)=>{
    try{
      const img = new Image();
      img.onload = ()=>{
        try{
          let w = img.width, h = img.height;
          if(w > maxW){ h = Math.round(h * (maxW / w)); w = maxW; }
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          cv.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL("image/jpeg", quality));
        }catch(e){ resolve(null); }
      };
      img.onerror = ()=>resolve(null);
      img.src = dataUrl;
    }catch(e){ resolve(null); }
  });
}

// Fit as many photos as the budget allows, shrinking each one first.
async function _srPackPhotos(list, budget){
  const out = [];
  let used = 0, dropped = 0;
  for(const p of (list||[])){
    const src = p && p.data;
    if(!src){ continue; }
    let small = await _srShrink(src, 640, 0.45);
    if(small && small.length > 120*1024) small = await _srShrink(src, 480, 0.35);
    if(!small){ dropped++; continue; }
    if(used + small.length > budget){ dropped++; continue; }
    used += small.length;
    out.push({data:small, note:(p.note||"")});
  }
  return {photos:out, dropped, used};
}

function _srSnapshot(kind){
  const k = SR_KINDS[kind]; if(!k) return null;
  const st = {};
  k.state.forEach(name=>{ try{ st[name] = JSON.parse(JSON.stringify(window[name] ?? null)); }catch(e){ st[name] = null; } });
  return st;
}

function _srTitleOf(kind){
  const s = window[SR_KINDS[kind].state[0]] || {};
  const bits = [s.project || s.client || "", s.site || s.system || "", s.date || s.from || ""].filter(Boolean);
  return bits.join(" \u2014 ") || SR_KINDS[kind].label;
}

window.srSaveReport = async function(kind, withPhotos){
  const k = SR_KINDS[kind];
  if(!k){ toast("Unknown report type"); return; }
  const state0 = _srSnapshot(kind);
  if(!state0){ toast("Nothing to save"); return; }
  toast("Saving\u2026");
  // Site plans are stored as a REDUCED REFERENCE copy, never at print
  // resolution: one 2048px drawing can exceed a whole Firestore document on
  // its own. The saved copy is there to say WHICH drawing this report used and
  // to let someone recognise it; the print-quality original lives in the file
  // that was exported.
  let plans = [];
  const planSrc = (window[k.plans] || []);
  for(const pl of planSrc){
    let ref = await _srShrink(pl.data, SR_PLAN_REF_W, SR_PLAN_REF_Q);
    if(ref && ref.length > 160*1024) ref = await _srShrink(pl.data, 640, 0.4);
    if(!ref) continue;
    plans.push({data:ref, page:pl.page, name:pl.name||"", caption:pl.caption||"", reference:true,
                fullW:pl.w||0, fullH:pl.h||0});
  }
  let photos = [], dropped = 0;
  if(withPhotos !== false){
    const planBytes = plans.reduce((s,p)=>s+(p.data?p.data.length:0), 0);
    const packed = await _srPackPhotos(window[k.photos], Math.max(80*1024, SR_DOC_BUDGET - planBytes));
    photos = packed.photos; dropped = packed.dropped;
  }else{
    dropped = (window[k.photos]||[]).length;
  }
  const rec = {
    id: window._srEditId || undefined,
    plans, plansAreReference: plans.length > 0,
    kind, kindLabel: k.label,
    title: _srTitleOf(kind),
    state: state0,
    photos,
    photosDropped: dropped,
    savedBy: (state.profile && (state.profile.employeeName || state.profile.email)) || "",
    savedAt: new Date().toISOString(),
    date: (window[k.state[0]]||{}).date || todayStr(),
  };
  try{
    await fbSave("savedReports", rec);
  }catch(e){ toast("Save failed \u2014 nothing was changed"); return; }
  window._srEditId = null;
  srNewReport(kind);
  toast(dropped ? `Report saved \u2713 \u2014 ${dropped} photo${dropped>1?"s":""} not stored`
                : "Report saved \u2713");
};

// Clear the form and go back to the top, ready for the next one.
window.srNewReport = function(kind){
  const k = SR_KINDS[kind]; if(!k) return;
  k.state.forEach(name=>{
    const cur = window[name];
    if(Array.isArray(cur)) window[name] = [];
    else if(cur && typeof cur === "object"){
      // Keep the shape, empty the values \u2014 a field the form expects to exist
      // must not vanish, or the next render reads undefined.
      const blank = {};
      Object.keys(cur).forEach(key=>{
        const v = cur[key];
        blank[key] = Array.isArray(v) ? [] : (v && typeof v === "object") ? {} : (typeof v === "boolean") ? false : "";
      });
      window[name] = blank;
    }
  });
  window[k.photos] = [];
  if(k.plans) window[k.plans] = [];
  window._srEditId = null;
  render();
  try{ window.scrollTo({top:0, behavior:"smooth"}); }catch(e){ try{ window.scrollTo(0,0); }catch(_){} }
};

window.srOpenReport = function(id){
  const r = (state.savedReports||[]).find(x=>x.id===id);
  if(!r){ toast("That report is no longer there"); return; }
  const k = SR_KINDS[r.kind];
  if(!k){ toast("Unknown report type"); return; }
  k.state.forEach(name=>{
    const v = r.state && r.state[name];
    if(v !== undefined && v !== null){ try{ window[name] = JSON.parse(JSON.stringify(v)); }catch(e){} }
  });
  window[k.photos] = (r.photos||[]).map(p=>({data:p.data, note:p.note||""}));
  // The stored drawings are reference copies. They reopen so the report is
  // complete and recognisable, flagged so nobody mistakes them for the
  // print-resolution originals.
  if(k.plans) window[k.plans] = (r.plans||[]).map(p=>({data:p.data, page:p.page||1,
      name:p.name||"", caption:p.caption||"", reference:true, w:p.fullW||0, h:p.fullH||0}));
  window._srEditId = r.id;
  render();
  try{ window.scrollTo({top:0, behavior:"smooth"}); }catch(e){}
  toast("Report opened \u2014 saving will update it");
};

window.srDeleteReport = async function(id){
  const r = (state.savedReports||[]).find(x=>x.id===id);
  if(!r) return;
  if(!confirm(`Delete "${r.title||r.kindLabel}"? This cannot be undone.`)) return;
  try{ await fbDelete("savedReports", id); if(window._srEditId===id) window._srEditId=null; render(); toast("Report deleted"); }
  catch(e){ toast("Could not delete that report"); }
};

// The list that sits under each generator.
function srSavedList(kind){
  const rows = (state.savedReports||[]).filter(r=>r.kind===kind)
    .slice().sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")));
  const editing = window._srEditId;
  return `<div class="card">
    <div class="card-title">\u{1F4BE} Saved ${escapeHtml(SR_KINDS[kind].label)}s ${rows.length?`<span style="font-weight:400;color:var(--muted)">(${rows.length})</span>`:""}</div>
    ${rows.length ? `<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">${rows.slice(0,40).map(r=>`
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid ${editing===r.id?"#C9A84C":"var(--line)"};border-radius:10px;background:${editing===r.id?"rgba(201,168,76,.10)":"transparent"}">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.title||SR_KINDS[kind].label)}</div>
          <div style="font-size:11px;color:var(--muted)">${escapeHtml(String(r.savedAt||"").slice(0,16).replace("T"," "))}${r.savedBy?" \u00b7 "+escapeHtml(r.savedBy):""}${(r.photos&&r.photos.length)?" \u00b7 \u{1F4F7} "+r.photos.length:""}${r.photosDropped?` \u00b7 <span style="color:#E65100">${r.photosDropped} not stored</span>`:""}</div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="srOpenReport(${jsArg(r.id)})">Open</button>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="srDeleteReport(${jsArg(r.id)})">\u00d7</button>
      </div>`).join("")}</div>`
    : `<div style="color:var(--muted);font-size:13px;margin-top:6px">Nothing saved yet. Fill the form above and press Save.</div>`}
  </div>`;
}

// The Save bar that goes at the bottom of each generator.
function srSaveBar(kind){
  const editing = window._srEditId;
  const n = (window[SR_KINDS[kind].photos]||[]).length;
  return `<div class="card">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn" style="background:#2E7D32;color:#fff;border:none;font-weight:700" onclick="srSaveReport(${jsArg(kind)},true)">\u{1F4BE} ${editing?"Update":"Save"} report${n?` (with ${n} photo${n>1?"s":""})`:""}</button>
      ${n?`<button class="btn btn-secondary" onclick="srSaveReport(${jsArg(kind)},false)" title="Store the report only \u2014 much smaller">\u{1F4BE} Save without photos</button>`:""}
      ${editing?`<button class="btn btn-secondary" onclick="srNewReport(${jsArg(kind)})">\u2795 Start a new one</button>`:""}
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:8px">
      ${editing?"You are editing a saved report \u2014 saving updates it in place.":"Saving stores this report and clears the form for the next one."}
      Photos are compressed hard for storage, and site plans are kept only as small reference copies \u2014 the export you generate keeps the originals at full print quality.
    </div>
  </div>`;
}
Object.assign(window,{SR_KINDS, srSavedList, srSaveBar, _srPackPhotos, _srSnapshot});

function renderPMReportTab(){
  if(!(isAdmin()||isHR()||hasCap("canExport"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  const _mode=window._pmRptMode||"records";
  if(_mode==="manual") return _rptHero("🛠️","Preventive Maintenance Report","Manual report — type everything yourself, no records needed","linear-gradient(135deg,#E65100 0%,#BF360C 100%)")+_rptModeSeg("_pmRptMode",_mode)+_pmManualLayout();
  const pmProjs=[...new Set((state.pmSchedules||[]).map(s=>(s.project||"").trim()).filter(Boolean))].sort();
  const systems=(state.systemTypes||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  // live scope preview
  let scope=(state.pmSchedules||[]).filter(s=>s.active!==false);
  if(window._pmRptProj) scope=scope.filter(s=>(s.project||"").trim()===window._pmRptProj);
  if(window._pmRptSys)  scope=scope.filter(s=>_pmSysOf(s)===window._pmRptSys);
  let rounds=0;
  scope.forEach(s=>(s.history||[]).forEach(h=>{
    if(h.initial)return;
    if(window._pmRptFrom&&String(h.date)<window._pmRptFrom)return;
    if(window._pmRptTo&&String(h.date)>window._pmRptTo)return;
    rounds++;
  }));
  const overdue=scope.filter(s=>pmDaysLeft(s)<0).length;
  const photos=window._pmRptPhotos||[];

  return `
  ${_rptHero("🛠️","Preventive Maintenance Report","Branded PDF — scope, completed rounds, work description & photos","linear-gradient(135deg,#E65100 0%,#BF360C 100%)")}
  ${_rptModeSeg("_pmRptMode",_mode)}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">01</span> Scope</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>📁 Project</label>
        <select onchange="window._pmRptProj=this.value;render()">
          <option value="">— All projects —</option>
          ${pmProjs.map(p=>`<option ${window._pmRptProj===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}
        </select></div>
      <div class="field"><label>🧩 System</label>
        <select onchange="window._pmRptSys=this.value;render()">
          <option value="">— All systems —</option>
          ${systems.map(s=>`<option ${window._pmRptSys===s.name?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}
        </select></div>
      <div class="field"><label>From</label><input type="date" value="${window._pmRptFrom}" onchange="window._pmRptFrom=this.value;render()"></div>
      <div class="field"><label>To</label><input type="date" value="${window._pmRptTo}" onchange="window._pmRptTo=this.value;render()"></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <div style="flex:1;min-width:110px;border:1px solid var(--line);border-left:4px solid #2E5FA3;border-radius:8px;padding:10px;background:var(--card,#fff)"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Schedules</div><div style="font-family:'DM Serif Display',serif;font-size:18px;color:#2E5FA3">${scope.length}</div></div>
      <div style="flex:1;min-width:110px;border:1px solid var(--line);border-left:4px solid #2E7D32;border-radius:8px;padding:10px;background:var(--card,#fff)"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Rounds in period</div><div style="font-family:'DM Serif Display',serif;font-size:18px;color:#2E7D32">${rounds}</div></div>
      <div style="flex:1;min-width:110px;border:1px solid var(--line);border-left:4px solid #C62828;border-radius:8px;padding:10px;background:var(--card,#fff)"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Overdue</div><div style="font-family:'DM Serif Display',serif;font-size:18px;color:#C62828">${overdue}</div></div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">02</span> Work Description</div>
    ${typeof tableToolbar==="function"?tableToolbar("_pmRptDesc"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._pmRptDesc):""}
    <textarea rows="4" oninput="window._pmRptDesc=this.value" placeholder="What was performed in this maintenance round — cleaning, tests, replaced parts, findings… (appears in the PDF)" style="width:100%;margin-top:8px">${escapeHtml(window._pmRptDesc)}</textarea>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">03</span> Photos <span style="font-size:10px;color:var(--muted);font-weight:500">(optional · max 12 · embedded in the PDF)</span></div>
    <input type="file" accept="image/*" multiple onchange="pmRptAddPhotos(this)" style="margin-top:8px">
    ${typeof planBlockHTML==="function"?planBlockHTML("_pmRptPlans"):""}
    ${photos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${photos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="annoOpen('_pmRptPhotos',${i})" title="Annotate" style="position:absolute;bottom:-6px;right:-6px;background:#03308B;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:10px;line-height:1">✎</button><button onclick="pmRptDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:700">×</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${rptFormatToggle(true)}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%" onclick="generatePMReport()">${_fmtIcon()} Generate PM Report (${_fmtName()})</button>
  </div>`;
}

function renderIncidentReportTab(){
  if(!(isAdmin()||isHR()||hasCap("canExport"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  const _mode=window._incRptMode||"records";
  if(_mode==="manual") return _rptHero("🚨","Incident Report","Manual report — type everything yourself, no logged incident needed","linear-gradient(135deg,#7B1FA2 0%,#4A148C 100%)")+_rptModeSeg("_incRptMode",_mode)+_incManualLayout();
  let list=(state.incidents||[]).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const projs=[...new Set(list.map(i=>(i.project||"").trim()).filter(Boolean))].sort();
  const systems=[...new Set(list.map(i=>(i.system||"").trim()).filter(Boolean))].sort();
  if(window._incRptProj) list=list.filter(i=>(i.project||"").trim()===window._incRptProj);
  if(window._incRptSys)  list=list.filter(i=>(i.system||"").trim()===window._incRptSys);
  if(window._incRptSel && !list.some(i=>i.id===window._incRptSel)) window._incRptSel="";
  const sel=list.find(i=>i.id===window._incRptSel)||null;
  const sev={Low:["#E8F5E9","#2E7D32"],Medium:["#FFF3E0","#E65100"],High:["#FDECEA","#C62828"],Critical:["#F3E5F5","#7B1FA2"]};
  const st={Open:["#FDECEA","#C62828"],Investigating:["#FFF3E0","#E65100"],Resolved:["#E8F5E9","#2E7D32"],Closed:["#ECEFF1","#5B6C86"]};

  return `
  ${_rptHero("🚨","Incident Report","Detailed branded PDF for any logged incident — info grid, actions & photos","linear-gradient(135deg,#7B1FA2 0%,#4A148C 100%)")}
  ${_rptModeSeg("_incRptMode",_mode)}

  ${(state.incidents||[]).length===0?`<div class="card"><div class="empty empty2"><span class="e-ic">🚨</span><div class="e-t">No incidents logged yet</div><div class="e-m">Log them in <strong>Database → Incidents</strong> first</div></div></div>`:`
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">01</span> Pick Incident</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>📁 Project</label>
        <select onchange="window._incRptProj=this.value;render()">
          <option value="">— All —</option>
          ${projs.map(p=>`<option ${window._incRptProj===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}
        </select></div>
      <div class="field"><label>🧩 System</label>
        <select onchange="window._incRptSys=this.value;render()">
          <option value="">— All —</option>
          ${systems.map(s=>`<option ${window._incRptSys===s?"selected":""}>${escapeHtml(s)}</option>`).join("")}
        </select></div>
      <div class="field" style="grid-column:1/-1"><label>Incident (${list.length})</label>
        <select onchange="window._incRptSel=this.value;render()">
          <option value="">— Select —</option>
          ${list.map(i=>`<option value="${i.id}" ${window._incRptSel===i.id?"selected":""}>${fmtDate(i.date)} — ${escapeHtml(i.title)}${i.project?" · "+escapeHtml(i.project):""}</option>`).join("")}
        </select></div>
    </div>
    ${sel?`<div style="margin-top:12px;border:1.5px solid #C9A84C;border-radius:12px;padding:12px;background:var(--card,#fff)">
      <div style="font-weight:700;font-size:14px;color:#1B3A6B">${escapeHtml(sel.title)}</div>
      <div style="margin:6px 0">
        <span style="background:${(sev[sel.severity]||["#EEE","#555"])[0]};color:${(sev[sel.severity]||["#EEE","#555"])[1]};padding:2px 10px;border-radius:8px;font-size:10px;font-weight:700">${escapeHtml(sel.severity||"—")}</span>
        <span style="background:${(st[sel.status]||["#EEE","#555"])[0]};color:${(st[sel.status]||["#EEE","#555"])[1]};padding:2px 10px;border-radius:8px;font-size:10px;font-weight:700">${escapeHtml(sel.status||"Open")}</span>
        ${sel.system?`<span style="background:#E0F2F1;color:#00695C;padding:2px 10px;border-radius:8px;font-size:10px;font-weight:700">${escapeHtml(sel.system)}</span>`:""}
      </div>
      <div style="font-size:11px;color:var(--muted)">${fmtDate(sel.date)}${sel.time?" · "+sel.time:""} · ${escapeHtml(sel.project||"")}${sel.area?" › "+escapeHtml(sel.area):""}${sel.site?" › "+escapeHtml(sel.site):""}${sel.deviceSerial?" · 📟 "+escapeHtml(sel.deviceSerial):""} · 📷 ${(sel.photos||[]).length}</div>
    </div>`:""}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${rptFormatToggle(true)}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%" onclick="generateIncidentReport()">${_fmtIcon()} Generate Incident Report (${_fmtName()})</button>
  </div>`}`;
}
Object.assign(window,{renderPMReportTab,renderIncidentReportTab});

// ═══════════════════════════════════════════════════════════════════════
//  MANUAL REPORT BUILDERS — no records required, everything typed by hand
// ═══════════════════════════════════════════════════════════════════════
window._pmRptMode=window._pmRptMode||"records";
window._incRptMode=window._incRptMode||"records";
window._pmMan=window._pmMan||{project:"",system:"",from:"",to:"",desc:""};
window._pmManItems=window._pmManItems||[];
window._incMan=window._incMan||{title:"",date:"",time:"",project:"",area:"",site:"",system:"",device:"",severity:"Medium",status:"Resolved",startDate:"",endDate:"",reportedBy:"",description:"",actionTaken:""};
window._incManPhotos=window._incManPhotos||[];

window.pmManAddItem=function(){ window._pmManItems.push({date:today(),text:"",by:""}); render(); };
window.pmManDelItem=function(i){ window._pmManItems.splice(i,1); render(); };
window.incManAddPhotos=async function(input){
  try{
    const files=Array.from(input.files||[]); input.value="";
    for(const f of files){
      if(window._incManPhotos.length>=6){ toast("Max 6 photos"); break; }
      const b64=await compressImage(f,1024,0.6); const kb=base64SizeKB(b64);
      if(kb>500){ toast(`Image too large (${kb} KB). Skipped.`); continue; }
      window._incManPhotos.push({data:b64,sizeKB:kb});
    }
    render();
  }catch(e){ toast("Photo error: "+(e.message||"failed")); }
};
window.incManDelPhoto=function(i){ window._incManPhotos.splice(i,1); render(); };

// Synced select bound to app data, with an "✍️ Other" escape hatch that
// swaps to a free-text input (↩ returns to the list). `flagPath` stores the
// other-mode boolean on the same state object.
function _syncSel(label,opts,path,flagPath,val,isOther,ph,extraOnChange){
  const oc=extraOnChange||"";
  if(isOther) return `<div class="field"><label>${label}</label>
    <div style="display:flex;gap:6px"><input value="${escapeHtml(val||"")}" oninput="${path}=this.value" placeholder="${ph||"Type manually…"}" style="flex:1">
    <button class="btn btn-sm btn-secondary" onclick="${flagPath}=false;${path}='';${oc}render()">↩</button></div></div>`;
  return `<div class="field"><label>${label}</label>
    <select onchange="if(this.value==='__other'){${flagPath}=true;${path}='';}else{${path}=this.value;}${oc}render()">
      <option value="">— Select —</option>
      ${opts.map(o=>`<option value="${escapeHtml(o)}" ${val===o?"selected":""}>${escapeHtml(o)}</option>`).join("")}
      <option value="__other">✍️ Other — type manually…</option>
    </select></div>`;
}
const _projNames=()=> (state.projects||[]).map(p=>(p.name||"").trim()).filter(Boolean).sort();
const _sysNames=()=> (state.systemTypes||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(s=>s.name);
const _mfield=(label,path,val,ph,type)=>`<div class="field"><label>${label}</label>
  <input type="${type||"text"}" value="${escapeHtml(val||"")}" ${type?'onchange':'oninput'}="${path}=this.value${type?';render()':''}" placeholder="${ph||""}"></div>`;

function _pmManualLayout(){
  const m=window._pmMan, items=window._pmManItems, photos=window._pmRptPhotos||[];
  return `
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">01</span> Details</div>
    <div class="form-grid" style="margin-top:10px">
      ${_syncSel("📁 Project",_projNames(),"window._pmMan.project","window._pmMan.projectOther",m.project,m.projectOther,"e.g. Asiacell SLA")}
      ${_syncSel("🧩 System",_sysNames(),"window._pmMan.system","window._pmMan.systemOther",m.system,m.systemOther,"e.g. CCTV")}
      ${_mfield("From","window._pmMan.from",m.from,"","date")}
      ${_mfield("To","window._pmMan.to",m.to,"","date")}
    </div>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">02</span> Maintenance Works <span style="font-size:10px;color:var(--muted);font-weight:500">(${items.length})</span></div>
    ${items.map((it,i)=>`<div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap">
      <input type="date" value="${it.date||""}" onchange="window._pmManItems[${i}].date=this.value" style="width:135px">
      <input value="${escapeHtml(it.text||"")}" oninput="window._pmManItems[${i}].text=this.value" placeholder="Work performed…" style="flex:2;min-width:150px">
      <input value="${escapeHtml(it.by||"")}" oninput="window._pmManItems[${i}].by=this.value" placeholder="By" style="flex:1;min-width:90px">
      <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="pmManDelItem(${i})">×</button>
    </div>`).join("")}
    <button class="btn btn-sm btn-secondary" style="margin-top:10px" onclick="pmManAddItem()">+ Add work item</button>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">03</span> Description</div>
    <textarea rows="4" oninput="window._pmMan.desc=this.value" placeholder="Overall summary — findings, recommendations… (appears in the PDF)" style="width:100%;margin-top:8px">${escapeHtml(m.desc||"")}</textarea>${typeof tableToolbar==="function"?tableToolbar("_pmMan.desc"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._pmMan.desc):""}
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">04</span> Photos <span style="font-size:10px;color:var(--muted);font-weight:500">(max 12)</span></div>
    <input type="file" accept="image/*" multiple onchange="pmRptAddPhotos(this)" style="margin-top:8px">
    ${typeof planBlockHTML==="function"?planBlockHTML("_pmRptPlans"):""}
    ${photos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${photos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="annoOpen('_pmRptPhotos',${i})" title="Annotate" style="position:absolute;bottom:-6px;right:-6px;background:#03308B;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:10px;line-height:1">✎</button><button onclick="pmRptDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:700">×</button></div>`).join("")}
    </div>`:""}
  </div>
  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${rptFormatToggle(true)}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%" onclick="generatePMReport()">${_fmtIcon()} Generate PM Report (${_fmtName()})</button>
  </div>
  ${typeof srSaveBar==="function"?srSaveBar("pm"):""}
  ${typeof srSavedList==="function"?srSavedList("pm"):""}`;
}

async function _generatePMManual(){
  const m=window._pmMan, items=(window._pmManItems||[]).filter(x=>(x.text||"").trim());
  if(!m.project.trim()) return toast("⚠ Project name is required");
  const bodyHTML=`
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 Choose <strong>"Save as PDF"</strong> in the print dialog<br><br>
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Summary — ${escapeHtml(m.project)}${m.system?` · ${escapeHtml(m.system)}`:""}</h3></div>
    <div class="kr">
      <div class="kc kb"><div class="kl">Project</div><div class="kv" style="font-size:14px">${escapeHtml(m.project)}</div><div class="ks">${escapeHtml(m.system||"—")}</div></div>
      <div class="kc kg"><div class="kl">Works Performed</div><div class="kv">${items.length}</div><div class="ks">maintenance items</div></div>
      <div class="kc ko"><div class="kl">Period</div><div class="kv" style="font-size:13px">${m.from||"—"}</div><div class="ks">→ ${m.to||"—"}</div></div>
    </div>
    ${items.length?`<div class="ksec"><span class="kbad">02</span><h3>Maintenance Works</h3></div>
    <table><thead><tr><th>Date</th><th>Work performed</th><th>By</th></tr></thead>
    <tbody>${items.map(it=>`<tr><td style="white-space:nowrap">${it.date?fmtDate(it.date):"—"}</td><td>${escapeHtml(it.text)}</td><td>${escapeHtml(it.by||"—")}</td></tr>`).join("")}</tbody></table>`:""}
    ${(m.desc||"").trim()?`<div class="ksec"><span class="kbad">03</span><h3>Description</h3></div>
    <div style="font-size:12px;line-height:1.7">${typeof textWithTablesHTML==="function"?textWithTablesHTML(m.desc,{dash:false}):`<div style="white-space:pre-wrap">${escapeHtml(m.desc.trim())}</div>`}</div>`:""}
    ${_rptPhotoGrid(window._pmRptPhotos,"Maintenance Photos")}
    ${typeof _rptPlanSheets==="function"?_rptPlanSheets(window._pmRptPlans,"Site Plans"):""}
    <script>setTimeout(()=>window.print(),500)<\/script>`;
  const period=(m.from||m.to)?`${m.from||"start"} → ${m.to||"today"}`:"Manual";
  await openReportPDF("PREVENTIVE_MAINTENANCE",[period,m.project,m.system].filter(Boolean).join(" · "),bodyHTML,{project:m.project||""});
  toast("PM Report ready!");
}

function _incManualLayout(){
  const m=window._incMan, photos=window._incManPhotos;
  const sevs=["Low","Medium","High","Critical"], sts=["Open","Investigating","Resolved","Closed"];
  return `
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">01</span> Incident Details</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field" style="grid-column:1/-1"><label>Title <span class="req">*</span></label>
        <input value="${escapeHtml(m.title||"")}" oninput="window._incMan.title=this.value" placeholder="e.g. CCTV camera 12 offline"></div>
      ${_mfield("📅 Incident date","window._incMan.date",m.date,"","date")}
      ${_mfield("🕐 Time","window._incMan.time",m.time,"","time")}
      ${_syncSel("📁 Project",_projNames(),"window._incMan.project","window._incMan.projectOther",m.project,m.projectOther,"Project name","window._incMan.area='';window._incMan.site='';window._incMan.device='';")}
      ${_syncSel("🧩 System",_sysNames(),"window._incMan.system","window._incMan.systemOther",m.system,m.systemOther,"e.g. Fire Alarm","window._incMan.device='';")}
      ${(()=>{
        if(m.projectOther||!m.project){
          return _mfield("🗺️ Area","window._incMan.area",m.area,"optional")+_mfield("📍 Site","window._incMan.site",m.site,"optional")+_mfield("📟 Device","window._incMan.device",m.device,"name / model / serial — optional");
        }
        const pr=(state.projects||[]).find(p=>(p.name||"").trim()===m.project);
        const areas=pr?getProjectAreas(pr).filter(a=>a.active!==false):[];
        const selArea=areas.find(a=>a.name===m.area);
        const sites=(selArea?.sites||[]).filter(x=>x.active!==false);
        const devPool=(state.devices||[]).filter(d=>(d.project||"").trim()===m.project
          &&(!m.area||d.area===m.area)&&(!m.site||d.site===m.site)
          &&(!m.system||!d.system||d.system===m.system));
        let h="";
        h+=areas.length?_syncSel("🗺️ Area",areas.map(a=>a.name),"window._incMan.area","window._incMan.areaOther",m.area,m.areaOther,"optional","window._incMan.site='';window._incMan.device='';")
                       :_mfield("🗺️ Area","window._incMan.area",m.area,"optional");
        h+=(!m.areaOther&&sites.length)?_syncSel("📍 Site",sites.map(x=>x.name),"window._incMan.site","window._incMan.siteOther",m.site,m.siteOther,"optional","window._incMan.device='';")
                       :_mfield("📍 Site","window._incMan.site",m.site,"optional");
        h+=devPool.length?_syncSel("📟 Device ("+devPool.length+" in scope)",devPool.map(d=>[d.deviceName,d.model,d.serialNumber].filter(Boolean).join(" · ")),"window._incMan.device","window._incMan.deviceOther",m.device,m.deviceOther,"name / model / serial")
                       :_mfield("📟 Device","window._incMan.device",m.device,"name / model / serial — optional");
        return h;
      })()}
      <div class="field"><label>⚠️ Severity</label>
        <select onchange="window._incMan.severity=this.value">${sevs.map(s=>`<option ${m.severity===s?"selected":""}>${s}</option>`).join("")}</select></div>
      <div class="field"><label>📊 Status</label>
        <select onchange="window._incMan.status=this.value">${sts.map(s=>`<option ${m.status===s?"selected":""}>${s}</option>`).join("")}</select></div>
      ${_mfield("▶️ Work started","window._incMan.startDate",m.startDate,"","date")}
      ${_mfield("⏹ Work finished","window._incMan.endDate",m.endDate,"","date")}
      ${_mfield("👤 Reported by","window._incMan.reportedBy",m.reportedBy,"optional")}
      <div class="field" style="grid-column:1/-1"><label>📝 Description</label>
        <textarea rows="3" oninput="window._incMan.description=this.value" placeholder="What happened…">${escapeHtml(m.description||"")}</textarea>${typeof tableToolbar==="function"?tableToolbar("_incMan.description"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(_incMan.description,"mprev_description"):""}</div>
      <div class="field" style="grid-column:1/-1"><label>🛠️ Action taken</label>
        <textarea rows="3" oninput="window._incMan.actionTaken=this.value" placeholder="Diagnosis, fix…">${escapeHtml(m.actionTaken||"")}</textarea>${typeof tableToolbar==="function"?tableToolbar("_incMan.actionTaken"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(_incMan.actionTaken,"mprev_actionTaken"):""}</div>
      <div class="field" style="grid-column:1/-1"><label>📷 Photos <span style="font-size:10px;color:var(--muted)">(max 6)</span></label>
        <input type="file" accept="image/*" multiple onchange="incManAddPhotos(this)">
        ${photos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          ${photos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="annoOpen('_incManPhotos',${i})" title="Annotate" style="position:absolute;bottom:-6px;right:-6px;background:#03308B;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:10px;line-height:1">✎</button><button onclick="incManDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:700">×</button></div>`).join("")}
        </div>`:""}
      </div>
    </div>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${rptFormatToggle(true)}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%" onclick="generateIncidentReport()">${_fmtIcon()} Generate Incident Report (${_fmtName()})</button>
  </div>`;
}

async function _generateIncManual(){
  const m=window._incMan;
  if(!(m.title||"").trim()) return toast("⚠ Title is required");
  const i={...m, deviceSerial:"", photos:window._incManPhotos, notes:""};
  const sev={Low:["#E8F5E9","#2E7D32"],Medium:["#FFF3E0","#E65100"],High:["#FDECEA","#C62828"],Critical:["#F3E5F5","#7B1FA2"]}[i.severity]||["#EEE","#555"];
  const st={Open:["#FDECEA","#C62828"],Investigating:["#FFF3E0","#E65100"],Resolved:["#E8F5E9","#2E7D32"],Closed:["#ECEFF1","#5B6C86"]}[i.status]||["#EEE","#555"];
  const cell=(l,v)=>`<td style="border:1px solid #ddd;padding:7px 10px"><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.6px;font-weight:700">${l}</div><div style="font-size:12px;font-weight:600;color:#1B3A6B">${v||"—"}</div></td>`;
  const bodyHTML=`
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 Choose <strong>"Save as PDF"</strong> in the print dialog<br><br>
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Incident Overview</h3></div>
    <div style="font-family:'DM Serif Display',serif;font-size:18px;color:#03308B;margin:4px 0 8px">${escapeHtml(i.title)}</div>
    <div style="margin-bottom:10px">${_rptBadge(i.severity,sev[0],sev[1])} &nbsp; ${_rptBadge(i.status,st[0],st[1])}</div>
    <table style="border-collapse:collapse;width:100%"><tbody>
      <tr>${cell("Incident date",(i.date?fmtDate(i.date):"—")+(i.time?" · "+i.time:""))}${cell("Project",escapeHtml(i.project))}${cell("System",escapeHtml(i.system||"Whole project"))}</tr>
      <tr>${cell("Area",escapeHtml(i.area))}${cell("Site",escapeHtml(i.site))}${cell("Device",escapeHtml(i.device||"—"))}</tr>
      <tr>${cell("Work started",i.startDate?fmtDate(i.startDate):"—")}${cell("Work finished",i.endDate?fmtDate(i.endDate):"—")}${cell("Reported by",escapeHtml(i.reportedBy||"—"))}</tr>
    </tbody></table>
    <div class="ksec"><span class="kbad">02</span><h3>Description</h3></div>
    <div style="font-size:12px;line-height:1.7">${typeof textWithTablesHTML==="function"?textWithTablesHTML(i.description):escapeHtml(i.description||"—")}</div>
    <div class="ksec"><span class="kbad">03</span><h3>Action Taken</h3></div>
    <div style="font-size:12px;line-height:1.7">${typeof textWithTablesHTML==="function"?textWithTablesHTML(i.actionTaken):escapeHtml(i.actionTaken||"—")}</div>
    ${_rptPhotoGrid(i.photos,"Incident Photos")}
    <script>setTimeout(()=>window.print(),500)<\/script>`;
  await openReportPDF("INCIDENT",[i.date?fmtDate(i.date):"Manual",i.project,i.system].filter(Boolean).join(" · "),bodyHTML,{project:i.project||""});
  toast("Incident Report ready!");
}
Object.assign(window,{_pmManualLayout,_incManualLayout,_generatePMManual,_generateIncManual});

// ═══════════════════════════════════════════════════════════════════════
//  FM-200 REPORTS (clean agent HFC-227ea) — Refilling · Inspection/Test
//  Layout & criteria per NFPA 2001 and ISO 14520 (weight ±5% / pressure
//  ±10% adjusted for temperature → recharge or replace). Manual entry —
//  nothing is stored; everything is typed at generation time.
// ═══════════════════════════════════════════════════════════════════════
window._fmView=window._fmView||"refill";
window._fm=window._fm||{client:"",clientOther:false,project:"",site:"",date:"",system:"FM-200 (HFC-227ea)",technician:"",notes:"",
  time:"",reference:"",representative:"",panelMfr:"",panelModel:"",cylModel:"",agentWt:"",installDate:"",
  resultText:"",engName:"",repName:"",repTitle:"IT Manager"};
window._fmCyls=window._fmCyls||[];
window._fmPhotos=window._fmPhotos||[];
window._fmPlans=window._fmPlans||[];
// Checklist items — verbatim from EJAF's delivered FM200 Test Report format
const FM_CHK_ITEMS=[
  ["c01","Cylinder tight mounted to the wall"],
  ["c02","Cylinder's pressure within the normal range"],
  ["c03","Cylinder & pipes inspection for damage or leakage areas"],
  ["c04","Detectors status — exposed to dust or moisture"],
  ["c05","Mains fail test"],
  ["c06","Battery fail test"],
  ["c07","Zone 1 detectors test"],
  ["c08","Zone 2 detectors test"],
  ["c09","Manual release test"],
  ["c10","Manual abort test"],
  ["c11","Alarm sounders test"],
  ["c12","Cylinder valve activation test"],
];
window._fmChk=window._fmChk||{};
FM_CHK_ITEMS.forEach(([k])=>{ if(!window._fmChk[k]) window._fmChk[k]={s:"Pass",r:""}; });

window.fmAddCyl=function(){ window._fmCyls.push({serial:"",type:"",capL:"",tare:"",gross:"",press:"",mfg:"",hydro:"",result:"Refilled"}); render(); };
// Net agent weight and fill density are derived; refresh the label only.
window.fmCylCalc=function(i){
  const el=document.getElementById("fm_cyl_"+i), c=(window._fmCyls||[])[i];
  if(!el||!c){ render(); return; }
  const net=_fmNet(c), dens=_fmDens(c);
  el.textContent=" 🧯 CYLINDER "+(i+1)+(net!==""?" · net "+net+" kg"+(dens!==""?" · "+dens+" kg/L":""):"");
};
window.fmDelCyl=function(i){ window._fmCyls.splice(i,1); render(); };
window.fmAddPhotos=async function(input){
  try{
    const files=Array.from(input.files||[]); input.value="";
    for(const f of files){
      if(window._fmPhotos.length>=12){ toast("Max 12 photos"); break; }
      const b64=await compressImage(f,1024,0.6); const kb=base64SizeKB(b64);
      if(kb>500){ toast(`Image too large (${kb} KB). Skipped.`); continue; }
      window._fmPhotos.push({data:b64,sizeKB:kb});
    }
    render();
  }catch(e){ toast("Photo error: "+(e.message||"failed")); }
};
window.fmDelPhoto=function(i){ window._fmPhotos.splice(i,1); render(); };

const _fmNet=c=>{const g=parseFloat(c.gross),t=parseFloat(c.tare);return (isFinite(g)&&isFinite(t))?+(g-t).toFixed(2):"";};
const _fmDens=c=>{const n=parseFloat(_fmNet(c)),v=parseFloat(c.capL);return (isFinite(n)&&isFinite(v)&&v>0)?+(n/v).toFixed(3):"";};

function _fmCylsEditor(){
  const cyls=window._fmCyls;
  return `<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">02</span> Cylinders <span style="font-size:10px;color:var(--muted);font-weight:500">(${cyls.length}) · net agent & fill density auto-computed</span></div>
    ${cyls.map((c,i)=>`<div style="border:1px solid var(--line);border-radius:12px;padding:10px;margin-top:10px;background:var(--card,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span id="fm_cyl_${i}" style="font-size:11px;font-weight:700;color:#B71C1C">🧯 CYLINDER ${i+1}${_fmNet(c)!==""?` · net ${_fmNet(c)} kg${_fmDens(c)!==""?` · ${_fmDens(c)} kg/L`:""}`:""}</span>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="fmDelCyl(${i})">×</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Serial No.</label><input value="${escapeHtml(c.serial||"")}" oninput="window._fmCyls[${i}].serial=this.value"></div>
        <div class="field"><label>Type / Model</label><input value="${escapeHtml(c.type||"")}" oninput="window._fmCyls[${i}].type=this.value" placeholder="e.g. 106L welded"></div>
        <div class="field"><label>Capacity (L)</label><input type="number" step="0.1" value="${c.capL||""}" oninput="window._fmCyls[${i}].capL=this.value"></div>
        <div class="field"><label>Tare wt (kg)</label><input type="number" step="0.01" value="${c.tare||""}" onchange="window._fmCyls[${i}].tare=this.value;fmCylCalc(${i})"></div>
        <div class="field"><label>Gross wt (kg)</label><input type="number" step="0.01" value="${c.gross||""}" onchange="window._fmCyls[${i}].gross=this.value;fmCylCalc(${i})"></div>
        <div class="field"><label>Pressure @20°C (bar)</label><input type="number" step="0.1" value="${c.press||""}" oninput="window._fmCyls[${i}].press=this.value" placeholder="e.g. 25"></div>
        <div class="field"><label>Mfg date</label><input type="date" value="${c.mfg||""}" onchange="window._fmCyls[${i}].mfg=this.value"></div>
        <div class="field"><label>Hydro test date</label><input type="date" value="${c.hydro||""}" onchange="window._fmCyls[${i}].hydro=this.value"></div>
        <div class="field"><label>Result</label><select onchange="window._fmCyls[${i}].result=this.value">
          ${["Refilled","Topped up","Pressure adjusted","Passed — no action","Replaced","Sent for hydro test"].map(o=>`<option ${c.result===o?"selected":""}>${o}</option>`).join("")}
        </select></div>
      </div>
    </div>`).join("")}
    <button class="btn btn-sm btn-secondary" style="margin-top:10px" onclick="fmAddCyl()">+ Add cylinder</button>
  </div>`;
}

function renderFM200Section(){
  const m=window._fm, fv=window._fmView;
  const clientOpts=(state.clients||[]).map(c=>c.name).filter(Boolean).sort();
  const photos=window._fmPhotos;
  return `
  ${_rptHero("🧯","FM-200 Reports","Clean agent (HFC-227ea) — per NFPA 2001 & ISO 14520","linear-gradient(135deg,#B71C1C 0%,#7F0000 100%)")}
  <div class="card" style="padding:10px 12px"><div style="display:flex;gap:6px">
    <button class="btn ${fv==="refill"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window._fmView='refill';render()">⛽ Refilling Report</button>
    <button class="btn ${fv==="test"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window._fmView='test';render()">🧪 Test Report</button>
  </div></div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">01</span> General Information</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>👤 Client</label>
        ${m.clientOther
          ?`<div style="display:flex;gap:6px"><input value="${escapeHtml(m.client||"")}" oninput="window._fm.client=this.value" placeholder="Client name…" style="flex:1"><button class="btn btn-sm btn-secondary" onclick="window._fm.clientOther=false;window._fm.client='';render()">↩</button></div>`
          :`<select onchange="if(this.value==='__other'){window._fm.clientOther=true;window._fm.client='';}else{window._fm.client=this.value;}render()">
              <option value="">— Select —</option>
              ${clientOpts.map(n=>`<option ${m.client===n?"selected":""}>${escapeHtml(n)}</option>`).join("")}
              <option value="__other">✍️ Other — type manually…</option>
            </select>`}
      </div>
      ${_syncSel("📁 Project / Facility",_projNames(),"window._fm.project","window._fm.projectOther",m.project,m.projectOther,"Project / facility name","window._fm.site='';")}
      ${(()=>{
        if(m.projectOther||!m.project)
          return `<div class="field"><label>📍 Site / Room</label><input value="${escapeHtml(m.site||"")}" oninput="window._fm.site=this.value" placeholder="e.g. Server Room B1"></div>`;
        const pr=(state.projects||[]).find(p=>(p.name||"").trim()===m.project);
        const areas=pr?getProjectAreas(pr).filter(a=>a.active!==false):[];
        const combos=areas.flatMap(a=>{
          const ss=(a.sites||[]).filter(x=>x.active!==false);
          return ss.length?ss.map(x=>[a.name,x.name].filter(Boolean).join(" › ")):[a.name];
        });
        return combos.length
          ?_syncSel("📍 Site / Room",combos,"window._fm.site","window._fm.siteOther",m.site,m.siteOther,"e.g. Server Room B1")
          :`<div class="field"><label>📍 Site / Room</label><input value="${escapeHtml(m.site||"")}" oninput="window._fm.site=this.value" placeholder="e.g. Server Room B1"></div>`;
      })()}
      <div class="field"><label>📅 Date</label><input type="date" value="${m.date||""}" onchange="window._fm.date=this.value"></div>
      <div class="field"><label>🧯 System</label><input value="${escapeHtml(m.system||"")}" oninput="window._fm.system=this.value"></div>
      <div class="field"><label>👷 Technician</label><input value="${escapeHtml(m.technician||"")}" oninput="window._fm.technician=this.value"></div>
    </div>
  </div>

  ${_fmCylsEditor()}

  ${fv==="test"?`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">03</span> System Information</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>Panel Manufacturer</label><input value="${escapeHtml(m.panelMfr||"")}" oninput="window._fm.panelMfr=this.value" placeholder="e.g. UK"></div>
      <div class="field"><label>Model</label><input value="${escapeHtml(m.panelModel||"")}" oninput="window._fm.panelModel=this.value" placeholder="e.g. Zeta premier EX Pro"></div>
      <div class="field"><label>Cylinder Model</label><input value="${escapeHtml(m.cylModel||"")}" oninput="window._fm.cylModel=this.value" placeholder="e.g. AKRONEX"></div>
      <div class="field"><label>FM200 Clean Agent Weight</label><input value="${escapeHtml(m.agentWt||"")}" oninput="window._fm.agentWt=this.value" placeholder="e.g. 20 Kg"></div>
      <div class="field"><label>Installation Date</label><input type="date" value="${m.installDate||""}" onchange="window._fm.installDate=this.value"></div>
      ${_refField("window._fm.reference",m.reference)}
      <div class="field"><label>🕐 Test Time</label><input type="time" value="${m.time||""}" onchange="window._fm.time=this.value"></div>
      <div class="field"><label>👤 Client Representative</label><input value="${escapeHtml(m.representative||"")}" oninput="window._fm.representative=this.value"></div>
    </div>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">04</span> Check List Report</div>
    ${FM_CHK_ITEMS.map(([k,label],i)=>`<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
      <div style="width:26px;font-size:11px;font-weight:700;color:var(--muted)">${String(i+1).padStart(2,"0")}</div>
      <div style="flex:2;min-width:180px;font-size:12px">${label}</div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm ${window._fmChk[k].s==="Pass"?"":"btn-secondary"}" style="${window._fmChk[k].s==="Pass"?"background:#2E7D32;color:#fff;border:none;":""}font-weight:700" onclick="window._fmChk['${k}'].s='Pass';render()">PASS</button>
        <button class="btn btn-sm ${window._fmChk[k].s==="Fail"?"":"btn-secondary"}" style="${window._fmChk[k].s==="Fail"?"background:#C62828;color:#fff;border:none;":""}font-weight:700" onclick="window._fmChk['${k}'].s='Fail';render()">FAIL</button>
      </div>
    </div>`).join("")}
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">05</span> Result of Test</div>
    ${typeof tableToolbar==="function"?tableToolbar("_fm.resultText"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._fm.resultText):""}
    <textarea rows="4" oninput="window._fm.resultText=this.value" placeholder="e.g. System health for the FM200 infrastructure is verified as optimal. No trouble states, discharge events, or system degradation have been logged…" style="width:100%;margin-top:8px">${escapeHtml(m.resultText||"")}</textarea>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">06</span> Report Approval</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>EJAF Engineer name</label><input value="${escapeHtml(m.engName||"")}" oninput="window._fm.engName=this.value" placeholder="Eng. …"></div>
      <div class="field"><label>Client approver name</label><input value="${escapeHtml(m.repName||"")}" oninput="window._fm.repName=this.value" placeholder="Mr. …"></div>
      <div class="field"><label>Client approver title</label><input value="${escapeHtml(m.repTitle||"")}" oninput="window._fm.repTitle=this.value" placeholder="e.g. IT Manager"></div>
    </div>
    ${signaturePad("fm_eng","EJAF engineer signature","The engineer signs here")}
    ${signaturePad("fm_rep","Client signature","Hand the device to the client representative")}
  </div>`:""}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${fv==="test"?"07":"03"}</span> Notes / Recommendations</div>
    ${typeof tableToolbar==="function"?tableToolbar("_fm.notes"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._fm.notes):""}
    <textarea rows="3" oninput="window._fm.notes=this.value" placeholder="Observations, recommendations… (appears in the PDF)" style="width:100%;margin-top:8px">${escapeHtml(m.notes||"")}</textarea>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${fv==="test"?"08":"04"}</span> Photos <span style="font-size:10px;color:var(--muted);font-weight:500">(max 12)</span></div>
    <input type="file" accept="image/*" multiple onchange="fmAddPhotos(this)" style="margin-top:8px">
    ${typeof planBlockHTML==="function"?planBlockHTML("_fmPlans"):""}
    ${photos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${photos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="annoOpen('_fmPhotos',${i})" title="Annotate" style="position:absolute;bottom:-6px;right:-6px;background:#03308B;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:10px;line-height:1">✎</button><button onclick="fmDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:700">×</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${rptFormatToggle(true)}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%" onclick="${fv==="test"?"generateFM200Test()":"generateFM200Refill()"}">${_fmtIcon()} Generate ${fv==="test"?"Test":"Refilling"} Report (${_fmtName()})</button>
  </div>
  ${typeof srSaveBar==="function"?srSaveBar("fm200"):""}
  ${typeof srSavedList==="function"?srSavedList("fm200"):""}`;
}

function _fmInfoGrid(m){
  const cell=(l,v)=>`<td style="border:1px solid #ddd;padding:7px 10px"><div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.6px;font-weight:700">${l}</div><div style="font-size:12px;font-weight:600;color:#1B3A6B">${v||"—"}</div></td>`;
  return `<table style="border-collapse:collapse;width:100%"><tbody>
    <tr>${cell("Client",escapeHtml(m.client))}${cell("Project / Facility",escapeHtml(m.project))}${cell("Site / Room",escapeHtml(m.site))}</tr>
    <tr>${cell("Date",m.date?fmtDate(m.date):"—")}${cell("System",escapeHtml(m.system))}${cell("Technician",escapeHtml(m.technician))}</tr>
  </tbody></table>`;
}
function _fmCylsTable(){
  const cyls=window._fmCyls.filter(c=>(c.serial||c.type||c.gross));
  if(!cyls.length) return "";
  return `<table><thead><tr><th>#</th><th>Serial</th><th>Type</th><th>Cap. (L)</th><th>Tare (kg)</th><th>Gross (kg)</th><th>Net agent (kg)</th><th>Fill density (kg/L)</th><th>Press. @20°C (bar)</th><th>Hydro test</th><th>Result</th></tr></thead>
  <tbody>${cyls.map((c,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(c.serial||"—")}</td><td>${escapeHtml(c.type||"—")}</td><td>${c.capL||"—"}</td><td>${c.tare||"—"}</td><td>${c.gross||"—"}</td><td><strong>${_fmNet(c)||"—"}</strong></td><td>${_fmDens(c)||"—"}</td><td>${c.press||"—"}</td><td>${c.hydro?fmtDate(c.hydro):"—"}</td><td>${_rptBadge(c.result,"#E8F5E9","#2E7D32")}</td></tr>`).join("")}</tbody></table>`;
}
const _fmPrintBar=`<div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
  📄 Choose <strong>"Save as PDF"</strong> in the print dialog<br><br>
  <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
</div>`;
const _fmStdBanner=`<div style="background:#FDECEA;border:1px solid #F5C6C0;border-radius:8px;padding:8px 12px;margin:10px 0;font-size:10px;color:#7F1D1D">
  <strong>Standards:</strong> Serviced in accordance with <strong>NFPA 2001</strong> (Standard on Clean Agent Fire Extinguishing Systems) and <strong>ISO 14520</strong>. Acceptance criteria: agent net weight within <strong>−5%</strong> and pressure within <strong>−10%</strong> (temperature-adjusted) of nameplate values — containers outside limits are refilled or replaced.
</div>`;

window.generateFM200Refill=async function(){
  const m=window._fm;
  if(!(m.project||m.client)) return toast("⚠ Enter at least the client or project");
  const cyls=window._fmCyls.filter(c=>(c.serial||c.type||c.gross));
  const bodyHTML=`${_fmPrintBar}
    <div class="ksec"><span class="kbad">01</span><h3>FM-200 Refilling Report</h3></div>
    ${_fmInfoGrid(m)} ${_fmStdBanner}
    <div class="ksec"><span class="kbad">02</span><h3>Cylinder Refilling Data (${cyls.length})</h3></div>
    ${_fmCylsTable()||'<div style="color:#888;font-size:12px">No cylinder data entered.</div>'}
    ${(m.notes||"").trim()?`<div class="ksec"><span class="kbad">03</span><h3>Notes / Recommendations</h3></div>
    <div style="font-size:12px;line-height:1.7">${typeof textWithTablesHTML==="function"?textWithTablesHTML(m.notes,{dash:false}):`<div style="white-space:pre-wrap">${escapeHtml(m.notes.trim())}</div>`}</div>`:""}
    ${_rptPhotoGrid(window._fmPhotos,"Photos")}
    ${typeof _rptPlanSheets==="function"?_rptPlanSheets(window._fmPlans,"Site Plans"):""}
    ${sigAny(["fm_eng","fm_rep"])?`<div style="margin-top:26px">${sigRow([
        ["fm_eng", m.technician||m.engName||"Eng.", "Technician", "EJAF Technology"],
        ["fm_rep", m.repName||"Mr.", m.repTitle||"Client representative", m.client||""]])}</div>`:""}
    <script>setTimeout(()=>window.print(),500)<\/script>`;
  await openReportPDF("FM200_REFILLING",[m.date?fmtDate(m.date):"",m.client,m.project].filter(Boolean).join(" · ")||"Manual",bodyHTML,{project:m.project||"",client:m.client||""});
  toast("FM-200 Refilling Report ready!");
};

window.generateFM200Test=async function(){
  const m=window._fm;
  if(!(m.client||m.project)) return toast("⚠ Enter at least the client or project");
  const box="\u2610", tick="\u2611";
  const chkRows=FM_CHK_ITEMS.map(([k,label],i)=>{
    const s=window._fmChk[k].s;
    return `<tr>
      <td style="text-align:center;width:34px">${String(i+1).padStart(2,"0")}</td>
      <td>${label}</td>
      <td style="text-align:center;width:60px;font-size:14px">${s==="Pass"?tick:box}</td>
      <td style="text-align:center;width:60px;font-size:14px">${s==="Fail"?tick:box}</td>
    </tr>`;
  }).join("");
  const fails=FM_CHK_ITEMS.filter(([k])=>window._fmChk[k].s==="Fail").length;
  const infoRow=(l,v)=>`<tr><td style="border:1px solid #ccc;background:#F0F4FA;padding:6px 10px;font-weight:700;font-size:11px;width:42%">${l}</td><td style="border:1px solid #ccc;padding:6px 10px;font-size:12px">${v||"&nbsp;"}</td></tr>`;
  const bodyHTML=`${_fmPrintBar}
    <div style="border:1.5px solid #1B3A6B;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:18px;color:#03308B">TEST REPORT</div>
        <div style="font-size:12px;font-weight:700;color:#B71C1C">FM200 FIRE SUPPRESSION SYSTEM</div>
      </div>
      <table style="border-collapse:collapse;font-size:11px">
        ${m.reference?`<tr><td style="padding:2px 8px;font-weight:700;color:#555">Reference</td><td style="padding:2px 8px">${escapeHtml(m.reference)}</td></tr>`:""}
        <tr><td style="padding:2px 8px;font-weight:700;color:#555">Date of Report</td><td style="padding:2px 8px">${m.date?fmtDate(m.date):"—"}</td></tr>
        <tr><td style="padding:2px 8px;font-weight:700;color:#555">Test Time</td><td style="padding:2px 8px">${m.time||"—"}</td></tr>
      </table>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Client Information</h3></div>
    <table style="border-collapse:collapse;width:100%">
      ${infoRow("Company",escapeHtml(m.client))}
      ${infoRow("Location",escapeHtml(m.site||m.project))}
      ${infoRow("Representative",escapeHtml(m.representative))}
    </table>
    <div class="ksec"><span class="kbad">02</span><h3>System Information</h3></div>
    <table style="border-collapse:collapse;width:100%">
      ${infoRow("Panel Manufacturer",escapeHtml(m.panelMfr))}
      ${infoRow("Model",escapeHtml(m.panelModel))}
      ${infoRow("Cylinder Model",escapeHtml(m.cylModel))}
      ${infoRow("FM200 Clean Agent Weight",escapeHtml(m.agentWt))}
      ${infoRow("Installation Date",m.installDate?fmtDate(m.installDate):"")}
    </table>
    <div class="ksec"><span class="kbad">03</span><h3>Check List Report</h3></div>
    <table><thead><tr><th style="width:34px">No.</th><th>Description</th><th style="width:60px">PASS</th><th style="width:60px">FAIL</th></tr></thead>
    <tbody>${chkRows}</tbody></table>
    <div style="margin-top:6px;font-size:11px;font-weight:700;color:${fails?'#C62828':'#2E7D32'}">${fails?fails+" item(s) FAILED — corrective action required":"All 12 items PASSED \u2713"}</div>
    <div class="ksec"><span class="kbad">04</span><h3>Result of Test</h3></div>
    <div style="border:1px solid #ccc;border-radius:8px;padding:12px;font-size:12px;line-height:1.8;min-height:64px">${(m.resultText||"").trim() ? (typeof textWithTablesHTML==="function"?textWithTablesHTML(m.resultText,{dash:false}):`<div style="white-space:pre-wrap">${escapeHtml(m.resultText.trim())}</div>`) : "&nbsp;"}</div>
    ${cylsBlock()}
    ${_rptPhotoGrid(window._fmPhotos,"Photos")}
    ${typeof _rptPlanSheets==="function"?_rptPlanSheets(window._fmPlans,"Site Plans"):""}
    ${sigAny(["fm_eng","fm_rep"])?`<div class="ksec"><span class="kbad">05</span><h3>Report Approval</h3></div>
    ${sigRow([["fm_eng", m.engName||"Eng.", "Technical Engineer", "EJAF Technology"],
              ["fm_rep", m.repName||"Mr.", m.repTitle||"", m.client||""]])}`:""}
    <div style="margin-top:14px;border:1px solid #ddd;border-radius:8px;padding:10px 12px;display:flex;gap:14px;align-items:center">
      <div style="flex:1;font-size:10px;font-style:italic;color:#555;line-height:1.7">The test and check report have been conducted by EJAF's competent engineers on the dates mentioned above. This report is made for the purpose of protecting the tangible and intangible components of the FM200 cylinders in compliance with the applicable standards ISO 14520 and NFPA 2001.</div>
      <div style="font-size:10px;font-style:italic;font-weight:700;color:#333;white-space:nowrap">Reference Standards<br>ISO 14520 · NFPA 2001</div>
    </div>
    <script>setTimeout(()=>window.print(),500)<\/script>`;
  function cylsBlock(){
    const cyls=window._fmCyls.filter(c=>(c.serial||c.type||c.gross));
    return cyls.length?`<div class="ksec"><span class="kbad">＋</span><h3>Cylinder Weight &amp; Pressure Verification (${cyls.length})</h3></div>${_fmCylsTable()}`:"";
  }
  await openReportPDF("FM200_TEST",[m.date?fmtDate(m.date):"",m.client].filter(Boolean).join(" · ")||"Manual",bodyHTML,{project:m.project||"",client:m.client||""});
  toast("FM-200 Test Report ready!");
};
Object.assign(window,{renderFM200Section});

// ═══════════════════════════════════════════════════════════════════════
//  SYSTEM REPORTS — one engine, six disciplines (v126)
//  Auto mode pulls the device inventory straight from Assets (filtered by
//  project + the System field added in v113); manual mode types everything.
//  Checklists come from Technical Classifications when customised.
// ═══════════════════════════════════════════════════════════════════════
window._srTpl=window._srTpl||"cctv";
window._srMode=window._srMode||"records";
window._sr=window._sr||{client:"",clientOther:false,project:"",projectOther:false,site:"",siteOther:false,
  date:"",time:"",reference:"",representative:"",technician:"",engName:"",repName:"",repTitle:"",
  resultText:"",notes:"",fields:{}};
window._srDevs=window._srDevs||[];   // [{name,model,serial,location,result,remark}]
window._srChk=window._srChk||{};     // {tplId: {idx: {s,r}}}
window._srPhotos=window._srPhotos||[];
window._srPlans=window._srPlans||[];
window._srSubs=window._srSubs||[];    // selected ELV sub-system ids (integrated report)
window._srInt=window._srInt||{};      // {"a>b": {s,r}} interface verification results
window._srIntX=window._srIntX||[];    // custom interfaces [{d,s,r}]

// ── Integrated-report helpers ──
window.srToggleSub=function(id){
  const a=window._srSubs, i=a.indexOf(id);
  if(i<0) a.push(id); else a.splice(i,1);
  render();
};
window.srAllSubs=function(on){
  window._srSubs = on ? ELV_SUBS.map(s=>s.id) : [];
  render();
};
function _srIntState(k){
  if(!window._srInt[k]) window._srInt[k]={s:"Pass",r:""};
  return window._srInt[k];
}
window.srSetInt=function(k,v,el){
  _srIntState(k).s=v;
  if(el && statPaint(el,v)) return;
  render();
};
window.srSetIntX=function(i,v,el){
  if(!window._srIntX[i]) return;
  window._srIntX[i].s=v;
  if(el && statPaint(el,v)) return;
  render();
};
window.srSetIntRemark=function(k,v){ _srIntState(k).r=v; };
window.srAddInt=function(){ window._srIntX.push({d:"",s:"Pass",r:""}); render(); };
window.srDelInt=function(i){ window._srIntX.splice(i,1); render(); };
// Every checklist block the report prints: one per sub-system, then the common one
function _srBlocks(tpl){
  if(!tpl.multi) return [{key:tpl.id,name:tpl.name,icon:tpl.icon,color:tpl.color,items:getSysCheckItems(tpl.id)}];
  const subs=window._srSubs.map(id=>elvSub(id)).filter(Boolean)
    .map(s=>({key:s.id,name:s.name,icon:s.icon,color:s.color,items:getSysCheckItems(s.id)}));
  return subs.concat([{key:tpl.id,name:"Common Infrastructure & Integration",icon:tpl.icon,color:tpl.color,items:getSysCheckItems(tpl.id)}]);
}

function _srChkState(tpl,i){
  window._srChk[tpl]=window._srChk[tpl]||{};
  if(!window._srChk[tpl][i]) window._srChk[tpl][i]={s:"Pass",r:""};
  return window._srChk[tpl][i];
}
// Status commits repaint their own group in place. render() is only the
// fallback for a caller that could not pass its element.
window.srSetChk=function(tpl,i,v,el){
  _srChkState(tpl,i).s=v;
  if(el && statPaint(el,v)){ srCount(tpl); return; }
  render();
};
window.srSetChkRemark=function(tpl,i,v){ _srChkState(tpl,i).r=v; };
window.srSetDev=function(i,v,el){
  if(!window._srDevs[i]) return;
  window._srDevs[i].result=v;
  if(el && statPaint(el,v)) return;
  render();
};
// Live "(15 · 2 failed)" badge for one checklist block
function srCount(key){
  const el=document.getElementById("sr_cnt_"+key);
  if(!el) return;
  const items=getSysCheckItems(key);
  const f=items.filter((_,i)=>_srChkState(key,i).s==="Fail").length;
  el.textContent="("+items.length+(f?" · "+f+" failed":"")+")";
}
window.srAddDev=function(){ window._srDevs.push({name:"",model:"",serial:"",location:"",sub:"",result:"Pass",remark:""}); render(); };
// Only the card header shows the sub-system, so repaint that one label.
window.srSetDevSub=function(i,v){
  const d=(window._srDevs||[])[i]; if(!d) return;
  d.sub=v;
  const el=document.getElementById("sr_dev_"+i), s=elvSub(v), tpl=sysTemplate(window._srTpl);
  if(!el){ render(); return; }
  el.style.color = s ? s.color : tpl.color;
  el.textContent = (s?s.icon:tpl.icon)+" DEVICE "+(i+1)+(s?" · "+s.name.split(" / ")[0]:"");
};
window.srDelDev=function(i){ window._srDevs.splice(i,1); render(); };
window.srAddPhotos=async function(input){
  try{
    const files=Array.from(input.files||[]); input.value="";
    for(const f of files){
      if(window._srPhotos.length>=12){ toast("Max 12 photos"); break; }
      const b64=await compressImage(f,1024,0.6); const kb=base64SizeKB(b64);
      if(kb>500){ toast(`Image too large (${kb} KB). Skipped.`); continue; }
      window._srPhotos.push({data:b64,sizeKB:kb});
    }
    render();
  }catch(e){ toast("Photo error: "+(e.message||"failed")); }
};
window.srDelPhoto=function(i){ window._srPhotos.splice(i,1); render(); };

// Pull the matching devices out of Assets for the chosen project + discipline
window.srLoadDevices=function(){
  const tpl=sysTemplate(window._srTpl);
  const proj=(window._sr.project||"").trim();
  if(!proj) return toast("⚠ Pick the project first");
  if(tpl.multi && !window._srSubs.length) return toast("⚠ Select the sub-systems in scope first");
  const inScope=new Set(window._srSubs);
  const pool=(state.devices||[]).filter(d=>{
    if((d.project||"").trim()!==proj) return false;
    if(window._sr.site && ![d.site,d.area].includes(window._sr.site) &&
       [d.area,d.site].filter(Boolean).join(" › ")!==window._sr.site) return false;
    if(tpl.multi){ const s=elvSubForName(d.system); return s ? inScope.has(s.id) : false; }
    const t=sysTemplateForName(d.system);
    return t ? t.id===tpl.id : false;
  });
  if(!pool.length) return toast(tpl.multi
    ? "No devices in this project match the selected sub-systems — tag them in Assets → System, or add rows manually"
    : `No devices tagged "${tpl.name.split(" ")[0]}" in this project — tag them in Assets → System, or add rows manually`);
  window._srDevs=pool.map(d=>{
    const s=tpl.multi?elvSubForName(d.system):null;
    return {name:d.deviceName||"",model:d.model||"",serial:d.serialNumber||"",
      location:[d.area,d.site].filter(Boolean).join(" › "),
      sub:s?s.id:"",result:"Pass",remark:""};
  });
  toast(`✓ ${pool.length} device(s) loaded from Assets`);
  render();
};

function _srPillList(){
  return SYS_TEMPLATES.map(t=>({id:t.id,ic:t.icon,lb:t.short}))
    .concat([{id:"daily",ic:"📅",lb:"Daily"},{id:"weekly",ic:"📆",lb:"Weekly"},
             {id:"project",ic:"📋",lb:"Project"},
             {id:"ppr",ic:"📈",lb:"Progress Rpt"}]);
}
function renderSystemReports(){
  if(!(isAdmin()||isHR()||hasCap("canExport"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  // Project progress reports live in the same pill row but render their own layout
  if(window._srTpl==="daily"||window._srTpl==="weekly"){
    return _pills('_srTpl',_srPillList()) + renderProgressReport(window._srTpl);
  }
  // The project status report shares the pill row but is a different document:
  // it reports on a PROJECT, not on a system, so it has its own layout.
  if(window._srTpl==="project"){
    return _pills('_srTpl',_srPillList()) + renderProjectReport();
  }
  // The contractor's periodic report to the client — FIDIC 4.21.
  if(window._srTpl==="ppr"){
    return _pills('_srTpl',_srPillList()) + renderProjectProgressReport();
  }
  const tpl=sysTemplate(window._srTpl), m=window._sr, mode=window._srMode;
  const clientOpts=(state.clients||[]).map(c=>c.name).filter(Boolean).sort();
  const projOpts=(state.projects||[]).map(p=>(p.name||"").trim()).filter(Boolean).sort();
  const pr=(state.projects||[]).find(p=>(p.name||"").trim()===m.project);
  const siteOpts=pr?getProjectAreas(pr).filter(a=>a.active!==false).flatMap(a=>{
    const ss=(a.sites||[]).filter(x=>x.active!==false);
    return ss.length?ss.map(x=>[a.name,x.name].filter(Boolean).join(" › ")):[a.name];
  }):[];
  const blocks=_srBlocks(tpl);
  const fails=blocks.reduce((t,bk)=>t+bk.items.filter((_,i)=>_srChkState(bk.key,i).s==="Fail").length,0);
  const ifaces=tpl.multi?elvInterfaces(window._srSubs):[];
  // Section numbers are counted, not hard-coded: the integrated report adds sections
  const N=(()=>{let n=0;return()=>String(++n).padStart(2,"0");})();

  return `
  ${_pills('_srTpl',_srPillList())}
  ${_rptHero(tpl.icon,tpl.name,"Inspection & Test Report","linear-gradient(135deg,"+tpl.color+" 0%,#1B2A33 100%)")}
  <div class="card" style="padding:10px 12px">
    <div style="display:flex;gap:6px">
      <button class="btn ${mode!=="manual"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window._srMode='records';render()">📊 From records</button>
      <button class="btn ${mode==="manual"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window._srMode='manual';render()">✍️ Manual</button>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> General Information</div>
    <div class="form-grid" style="margin-top:10px">
      ${_syncSel("👤 Client",clientOpts,"window._sr.client","window._sr.clientOther",m.client,m.clientOther,"Client name")}
      ${mode==="manual"
        ? `<div class="field"><label>📁 Project / Facility</label><input value="${escapeHtml(m.project||"")}" oninput="window._sr.project=this.value"></div>
           <div class="field"><label>📍 Site / Room</label><input value="${escapeHtml(m.site||"")}" oninput="window._sr.site=this.value"></div>`
        : _syncSel("📁 Project / Facility",projOpts,"window._sr.project","window._sr.projectOther",m.project,m.projectOther,"Project","window._sr.site='';")
          + (siteOpts.length&&!m.projectOther
              ? _syncSel("📍 Site / Room",siteOpts,"window._sr.site","window._sr.siteOther",m.site,m.siteOther,"Site")
              : `<div class="field"><label>📍 Site / Room</label><input value="${escapeHtml(m.site||"")}" oninput="window._sr.site=this.value"></div>`)}
      <div class="field"><label>📅 Date</label><input type="date" value="${m.date||""}" onchange="window._sr.date=this.value"></div>
      <div class="field"><label>🕐 Time</label><input type="time" value="${m.time||""}" onchange="window._sr.time=this.value"></div>
      ${_refField("window._sr.reference",m.reference)}
      <div class="field"><label>👤 Client Representative</label><input value="${escapeHtml(m.representative||"")}" oninput="window._sr.representative=this.value"></div>
      <div class="field"><label>👷 Technician</label><input value="${escapeHtml(m.technician||"")}" oninput="window._sr.technician=this.value"></div>
    </div>
  </div>

  ${tpl.multi?`<div class="card" style="border:2px solid ${tpl.color}">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> Sub-systems in Scope <span style="font-size:10px;color:var(--muted);font-weight:500">(${window._srSubs.length} selected)</span></div>
    <p style="font-size:11px;color:var(--muted);margin:8px 0 10px;line-height:1.6">Everything you tick is inspected and printed as its own section. Anything left unticked is <strong>outside the scope</strong> of this report.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${ELV_SUBS.map(s=>{const on=window._srSubs.includes(s.id);
        return `<button class="btn btn-sm ${on?"":"btn-secondary"}" style="${on?`background:${s.color};color:#fff;border:none;`:""}font-weight:700;font-size:11px" onclick="srToggleSub('${s.id}')">${on?"✓ ":""}${s.icon} ${escapeHtml(s.name.split(" / ")[0])}${s.sup?" · sup":""}</button>`;}).join("")}
    </div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <button class="btn btn-sm btn-secondary" onclick="srAllSubs(true)">Select all</button>
      ${window._srSubs.length?`<button class="btn btn-sm btn-secondary" onclick="srAllSubs(false)">Clear</button>`:""}
    </div>
    ${window._srSubs.length?"":`<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#E65100;line-height:1.6">Nothing selected yet — only the common infrastructure checklist will print. Tick the sub-systems this visit covered.</div>`}
    ${window._srSubs.some(id=>(elvSub(id)||{}).sup)?`<div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.6">ℹ️ Items marked <strong>sup</strong> (UPS, master clock) are supporting infrastructure rather than ELV disciplines — they print under <em>Supporting Services</em> in the scope table.</div>`:""}
  </div>`:""}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> ${tpl.multi?"Integration Platform":"System Information"}</div>
    <div class="form-grid" style="margin-top:10px">
      ${tpl.fields.map(f=>`<div class="field"><label>${escapeHtml(f.l)}</label>
        <input value="${escapeHtml((m.fields||{})[f.k]||"")}" oninput="window._sr.fields['${f.k}']=this.value"></div>`).join("")}
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> Device Inventory & Results <span style="font-size:10px;color:var(--muted);font-weight:500">(${window._srDevs.length})</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
      ${mode!=="manual"?`<button class="btn btn-sm" style="background:${tpl.color};color:#fff;border:none;font-weight:700" onclick="srLoadDevices()">⬇ Load from Assets</button>`:""}
      <button class="btn btn-sm btn-secondary" onclick="srAddDev()">+ Add device</button>
      ${window._srDevs.length?`<button class="btn btn-sm btn-secondary" onclick="window._srDevs=[];render()">Clear</button>`:""}
    </div>
    ${window._srDevs.map((d,i)=>`<div style="border:1px solid var(--line);border-radius:8px;padding:9px;margin-bottom:8px;background:var(--card,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span id="sr_dev_${i}" style="font-size:10px;font-weight:700;color:${(tpl.multi&&elvSub(d.sub))?elvSub(d.sub).color:tpl.color}">${(tpl.multi&&elvSub(d.sub))?elvSub(d.sub).icon:tpl.icon} DEVICE ${i+1}${(tpl.multi&&elvSub(d.sub))?` · ${escapeHtml(elvSub(d.sub).name.split(" / ")[0])}`:""}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${statPills(d.result,`srSetDev(${i},'__V__',__EL__)`)}
          <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="srDelDev(${i})">×</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Name</label><input value="${escapeHtml(d.name||"")}" oninput="window._srDevs[${i}].name=this.value"></div>
        <div class="field"><label>Model</label><input value="${escapeHtml(d.model||"")}" oninput="window._srDevs[${i}].model=this.value"></div>
        <div class="field"><label>Serial</label><input value="${escapeHtml(d.serial||"")}" oninput="window._srDevs[${i}].serial=this.value"></div>
        <div class="field"><label>Location</label><input value="${escapeHtml(d.location||"")}" oninput="window._srDevs[${i}].location=this.value"></div>
        ${tpl.multi?`<div class="field"><label>Sub-system</label><select onchange="srSetDevSub(${i},this.value)">
          <option value="">— unassigned —</option>
          ${ELV_SUBS.map(s=>`<option value="${s.id}" ${d.sub===s.id?"selected":""}>${s.icon} ${escapeHtml(s.name)}</option>`).join("")}
        </select></div>`:""}
        <div class="field" style="grid-column:1/-1"><label>Remarks</label><input value="${escapeHtml(d.remark||"")}" oninput="window._srDevs[${i}].remark=this.value"></div>
      </div>
    </div>`).join("")}
  </div>

  ${blocks.map(bk=>{const bf=bk.items.filter((_,i)=>_srChkState(bk.key,i).s==="Fail").length;
    return `<div class="card"${tpl.multi?` style="border-left:4px solid ${bk.color}"`:""}>
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> ${tpl.multi?`${bk.icon} ${escapeHtml(bk.name)}`:"Inspection Check List"} <span id="sr_cnt_${bk.key}" style="font-size:10px;color:var(--muted);font-weight:500">(${bk.items.length}${bf?` · ${bf} failed`:""})</span></div>
    ${bk.items.map((it,i)=>{const st=_srChkState(bk.key,i);
      return `<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--line)">
        <span style="font-size:10px;font-weight:700;color:var(--muted);min-width:22px">${String(i+1).padStart(2,"0")}</span>
        <span style="flex:2;min-width:170px;font-size:12px">${escapeHtml(it)}</span>
        ${statPills(st.s,`srSetChk('${bk.key}',${i},'__V__',__EL__)`)}
        <input value="${escapeHtml(st.r||"")}" oninput="srSetChkRemark('${bk.key}',${i},this.value)" placeholder="Remarks" style="flex:1;min-width:120px">
      </div>`;}).join("")}
    <p style="font-size:10px;color:var(--muted);margin-top:10px">Per ${escapeHtml(String(chkGroup(bk.key).standards||"").split("·")[0].replace(/\s*\(.*/,"").trim())} — edit in <strong>Technical Classifications → Check Lists</strong>.</p>
  </div>`;}).join("")}

  ${tpl.multi?`<div class="card" style="border-left:4px solid ${tpl.color}">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> 🔗 Integration Verification Matrix <span style="font-size:10px;color:var(--muted);font-weight:500">(${ifaces.length+window._srIntX.length})</span></div>
    <p style="font-size:11px;color:var(--muted);margin:8px 0 4px;line-height:1.6">Interfaces appear automatically when <strong>both</strong> sides are in scope — this is the cause &amp; effect verification an auditor looks for.</p>
    ${(ifaces.length||window._srIntX.length)?"":`<div style="background:#F5F8FC;border:1px dashed var(--line);border-radius:8px;padding:11px;margin-top:8px;font-size:11px;color:var(--muted);line-height:1.6">Select two or more related sub-systems above and their interfaces will be listed here.</div>`}
    ${ifaces.map(x=>{const k=x.a+">"+x.b, st=_srIntState(k), Ax=elvSub(x.a), Bx=elvSub(x.b);
      return `<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--line)">
        <span style="font-size:12px;min-width:52px;font-weight:700">${Ax.icon}→${Bx.icon}</span>
        <span style="flex:2;min-width:170px;font-size:12px">${escapeHtml(x.d)}</span>
        ${statPills(st.s,`srSetInt('${k}','__V__',__EL__)`)}
        <input value="${escapeHtml(st.r||"")}" oninput="srSetIntRemark('${k}',this.value)" placeholder="Remarks" style="flex:1;min-width:120px">
      </div>`;}).join("")}
    ${window._srIntX.map((x,i)=>`<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--line)">
        <span style="font-size:10px;font-weight:700;color:var(--muted);min-width:52px">CUSTOM</span>
        <input value="${escapeHtml(x.d||"")}" oninput="window._srIntX[${i}].d=this.value" placeholder="Describe the interface…" style="flex:2;min-width:170px">
        <div style="display:flex;gap:4px">
          ${statPills(x.s,`srSetIntX(${i},'__V__',__EL__)`)}
          <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="srDelInt(${i})">×</button>
        </div>
        <input value="${escapeHtml(x.r||"")}" oninput="window._srIntX[${i}].r=this.value" placeholder="Remarks" style="flex:1;min-width:120px">
      </div>`).join("")}
    <button class="btn btn-sm btn-secondary" style="margin-top:10px" onclick="srAddInt()">+ Add interface</button>
  </div>`:""}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> Result of Test</div>
    ${typeof tableToolbar==="function"?tableToolbar("_sr.resultText"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._sr.resultText):""}
    <textarea rows="4" oninput="window._sr.resultText=this.value" placeholder="Overall condition, findings and recommendations…" style="width:100%;margin-top:8px">${escapeHtml(m.resultText||"")}</textarea>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> Photos <span style="font-size:10px;color:var(--muted);font-weight:500">(max 12)</span></div>
    <input type="file" accept="image/*" multiple onchange="srAddPhotos(this)" style="margin-top:8px">
    ${typeof planBlockHTML==="function"?planBlockHTML("_srPlans"):""}
    ${window._srPhotos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${window._srPhotos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="annoOpen('_srPhotos',${i})" title="Annotate" style="position:absolute;bottom:-6px;right:-6px;background:#03308B;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:10px;line-height:1">✎</button><button onclick="srDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:700">×</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${N()}</span> Report Approval</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>EJAF Engineer</label><input value="${escapeHtml(m.engName||"")}" oninput="window._sr.engName=this.value" placeholder="Eng. …"></div>
      <div class="field"><label>Client approver</label><input value="${escapeHtml(m.repName||"")}" oninput="window._sr.repName=this.value" placeholder="Mr. …"></div>
      <div class="field"><label>Approver title</label><input value="${escapeHtml(m.repTitle||"")}" oninput="window._sr.repTitle=this.value" placeholder="e.g. IT Manager"></div>
    </div>
    ${signaturePad("sr_eng","EJAF engineer signature","The engineer signs here")}
    ${signaturePad("sr_rep","Client signature","Hand the device to the client representative")}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${rptFormatToggle(true)}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%" onclick="generateSystemReport()">${_fmtIcon()} Generate ${escapeHtml(tpl.multi?"ELV Integrated":tpl.name.split(" ")[0])} Report (${_fmtName()})</button>
  </div>
  ${typeof srSaveBar==="function"?srSaveBar("tech"):""}
  ${typeof srSavedList==="function"?srSavedList("tech"):""}`;
}

window.generateSystemReport=async function(){
  const tpl=sysTemplate(window._srTpl), m=window._sr;
  if(!(m.client||m.project)) return toast("⚠ Enter at least the client or project");
  const box="\u2610", tick="\u2611";
  const blocks=_srBlocks(tpl);
  const subsAll=tpl.multi?window._srSubs.map(id=>elvSub(id)).filter(Boolean):[];
  const subOrder=ELV_SUBS.map(s=>s.id);
  let devs=window._srDevs.filter(d=>d.name||d.serial||d.model);
  // Group the inventory by sub-system so each discipline reads as one block
  if(tpl.multi) devs=devs.slice().sort((a,b)=>subOrder.indexOf(a.sub)-subOrder.indexOf(b.sub));
  const devFail=devs.filter(d=>d.result==="Fail").length;
  const chkFail=blocks.reduce((t,bk)=>t+bk.items.filter((_,i)=>_srChkState(bk.key,i).s==="Fail").length,0);
  const chkTotal=blocks.reduce((t,bk)=>t+bk.items.length,0);
  const ifaces=tpl.multi?elvInterfaces(window._srSubs):[];
  const intRows=tpl.multi
    ? ifaces.map(x=>{const st=_srIntState(x.a+">"+x.b), Ax=elvSub(x.a), Bx=elvSub(x.b);
        return {pair:(Ax?Ax.name.split(" / ")[0]:x.a)+" → "+(Bx?Bx.name.split(" / ")[0]:x.b),d:x.d,s:st.s,r:st.r};})
        .concat(window._srIntX.filter(x=>(x.d||"").trim()).map(x=>({pair:"Custom",d:x.d,s:x.s,r:x.r})))
    : [];
  const intFail=intRows.filter(r=>r.s==="Fail").length;
  // Section numbers are counted so the integrated report can add sections
  const K=(()=>{let n=0;return()=>String(++n).padStart(2,"0");})();
  const infoRow=(l,v)=>`<tr><td style="border:1px solid #ccc;background:#F0F4FA;padding:6px 10px;font-weight:700;font-size:11px;width:42%">${l}</td><td style="border:1px solid #ccc;padding:6px 10px;font-size:12px">${v||"&nbsp;"}</td></tr>`;

  const bodyHTML=`${_fmPrintBar}
    <div style="border:1.5px solid #1B3A6B;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:18px;color:#03308B">INSPECTION &amp; TEST REPORT</div>
        <div style="font-size:12px;font-weight:700;color:${tpl.color}">${tpl.icon} ${escapeHtml(tpl.name.toUpperCase())}</div>
      </div>
      <table style="border-collapse:collapse;font-size:11px">
        ${m.reference?`<tr><td style="padding:2px 8px;font-weight:700;color:#555">Reference</td><td style="padding:2px 8px">${escapeHtml(m.reference)}</td></tr>`:""}
        <tr><td style="padding:2px 8px;font-weight:700;color:#555">Date of Report</td><td style="padding:2px 8px">${m.date?fmtDate(m.date):"—"}</td></tr>
        <tr><td style="padding:2px 8px;font-weight:700;color:#555">Test Time</td><td style="padding:2px 8px">${m.time||"—"}</td></tr>
      </table>
    </div>
    <div class="ksec"><span class="kbad">${K()}</span><h3>Client Information</h3></div>
    <table style="border-collapse:collapse;width:100%">
      ${infoRow("Company",escapeHtml(m.client))}
      ${infoRow("Location",escapeHtml([m.project,m.site].filter(Boolean).join(" — ")))}
      ${infoRow("Representative",escapeHtml(m.representative))}
    </table>
    ${tpl.fields.length?`<div class="ksec"><span class="kbad">${K()}</span><h3>${tpl.multi?"Integration Platform":"System Information"}</h3></div>
    <table style="border-collapse:collapse;width:100%">
      ${tpl.fields.map(f=>infoRow(escapeHtml(f.l),escapeHtml((m.fields||{})[f.k]||""))).join("")}
    </table>`:""}
    ${tpl.multi?`<div class="ksec"><span class="kbad">${K()}</span><h3>Scope of Report — Sub-systems Covered</h3></div>
    <table><thead><tr><th style="width:32px">No.</th><th>Sub-system</th><th style="width:92px">Classification</th><th>Governing standards</th><th style="width:44px">Items</th></tr></thead>
    <tbody>${subsAll.length?subsAll.map((s,i)=>`<tr>
      <td style="text-align:center">${String(i+1).padStart(2,"0")}</td>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td style="font-size:10px">${s.sup?"Supporting service":"ELV discipline"}</td>
      <td style="font-size:9px;line-height:1.5">${escapeHtml(chkGroup(s.id).standards||"")}</td>
      <td style="text-align:center">${getSysCheckItems(s.id).length}</td></tr>`).join("")
      :`<tr><td colspan="5" style="text-align:center;font-size:11px">No sub-system selected — common infrastructure only</td></tr>`}</tbody></table>
    <div style="margin-top:5px;font-size:10px;font-style:italic;color:#555">Any ELV sub-system not listed above was <strong>not</strong> inspected and is outside the scope of this report.</div>`:""}
    ${devs.length?`<div class="ksec"><span class="kbad">${K()}</span><h3>Device Inventory &amp; Test Results (${devs.length})</h3></div>
    <table><thead><tr><th style="width:32px">No.</th><th>Device</th>${tpl.multi?`<th style="width:92px">Sub-system</th>`:""}<th>Model</th><th>Serial</th><th>Location</th><th style="width:48px">PASS</th><th style="width:48px">FAIL</th><th>Remarks</th></tr></thead>
    <tbody>${devs.map((d,i)=>`<tr>
      <td style="text-align:center">${String(i+1).padStart(2,"0")}</td>
      <td><strong>${escapeHtml(d.name||"—")}</strong></td>${tpl.multi?`<td style="font-size:9.5px">${elvSub(d.sub)?escapeHtml(elvSub(d.sub).name.split(" / ")[0]):"—"}</td>`:""}<td style="font-size:10px">${escapeHtml(d.model||"—")}</td>
      <td style="font-size:10px">${escapeHtml(d.serial||"—")}</td><td style="font-size:10px">${escapeHtml(d.location||"—")}</td>
      <td style="text-align:center;font-size:14px">${d.result==="Pass"?tick:box}</td>
      <td style="text-align:center;font-size:14px">${d.result==="Fail"?tick:box}</td>
      <td style="font-size:10px">${escapeHtml(d.remark||(d.result==="N/A"?"N/A":"—"))}</td></tr>`).join("")}</tbody></table>
    <div style="margin-top:5px;font-size:11px;font-weight:700;color:${devFail?"#C62828":"#2E7D32"}">${devFail?`${devFail} device(s) FAILED`:`All ${devs.length} device(s) passed \u2713`}</div>`:""}
    ${blocks.map(bk=>{const bFail=bk.items.filter((_,i)=>_srChkState(bk.key,i).s==="Fail").length;
      return `<div class="ksec"><span class="kbad">${K()}</span><h3>${tpl.multi?escapeHtml(bk.name)+" — Check List":"Inspection Check List"}</h3></div>
    ${tpl.multi?`<div style="font-size:9px;color:#555;font-style:italic;margin:-2px 0 6px;line-height:1.5">${escapeHtml(chkGroup(bk.key).standards||"")}</div>`:""}
    <table><thead><tr><th style="width:32px">No.</th><th>Description</th><th style="width:48px">PASS</th><th style="width:48px">FAIL</th><th>Remarks</th></tr></thead>
    <tbody>${bk.items.map((it,i)=>{const st=_srChkState(bk.key,i);
      return `<tr><td style="text-align:center">${String(i+1).padStart(2,"0")}</td>
        <td style="font-size:11px">${escapeHtml(it)}</td>
        <td style="text-align:center;font-size:14px">${st.s==="Pass"?tick:box}</td>
        <td style="text-align:center;font-size:14px">${st.s==="Fail"?tick:box}</td>
        <td style="font-size:10px">${escapeHtml(st.r||(st.s==="N/A"?"N/A":"—"))}</td></tr>`;}).join("")}</tbody></table>
    <div style="margin-top:5px;font-size:11px;font-weight:700;color:${bFail?"#C62828":"#2E7D32"}">${bFail?`${bFail} of ${bk.items.length} item(s) FAILED — corrective action required`:`all ${bk.items.length} items PASSED \u2713`}</div>`;}).join("")}
    ${tpl.multi?`<div class="ksec"><span class="kbad">${K()}</span><h3>Integration Verification Matrix</h3></div>
    <table><thead><tr><th style="width:32px">No.</th><th style="width:150px">Interface</th><th>Verified function</th><th style="width:48px">PASS</th><th style="width:48px">FAIL</th><th>Remarks</th></tr></thead>
    <tbody>${intRows.length?intRows.map((r,i)=>`<tr>
      <td style="text-align:center">${String(i+1).padStart(2,"0")}</td>
      <td style="font-size:9.5px;font-weight:700">${escapeHtml(r.pair)}</td>
      <td style="font-size:11px">${escapeHtml(r.d)}</td>
      <td style="text-align:center;font-size:14px">${r.s==="Pass"?tick:box}</td>
      <td style="text-align:center;font-size:14px">${r.s==="Fail"?tick:box}</td>
      <td style="font-size:10px">${escapeHtml(r.r||(r.s==="N/A"?"N/A":"—"))}</td></tr>`).join("")
      :`<tr><td colspan="6" style="text-align:center;font-size:11px">No cross-system interfaces within the reported scope</td></tr>`}</tbody></table>
    <div style="margin-top:5px;font-size:11px;font-weight:700;color:${intFail?"#C62828":"#2E7D32"}">${intFail?`${intFail} interface(s) FAILED — cause &amp; effect requires correction`:intRows.length?`all ${intRows.length} interfaces verified \u2713`:"Not applicable"}</div>
    <div class="ksec"><span class="kbad">${K()}</span><h3>Consolidated Result</h3></div>
    <table style="border-collapse:collapse;width:100%">
      ${infoRow("Sub-systems inspected",String(subsAll.length))}
      ${infoRow("Check items assessed",String(chkTotal))}
      ${infoRow("Items failed",`<span style="font-weight:700;color:${chkFail?"#C62828":"#2E7D32"}">${chkFail}</span>`)}
      ${infoRow("Devices assessed",String(devs.length))}
      ${infoRow("Devices failed",`<span style="font-weight:700;color:${devFail?"#C62828":"#2E7D32"}">${devFail}</span>`)}
      ${infoRow("Interfaces verified",String(intRows.length))}
      ${infoRow("Interfaces failed",`<span style="font-weight:700;color:${intFail?"#C62828":"#2E7D32"}">${intFail}</span>`)}
    </table>`:""}
    <div class="ksec"><span class="kbad">${K()}</span><h3>Result of Test</h3></div>
    <div style="border:1px solid #ccc;border-radius:8px;padding:12px;font-size:12px;line-height:1.8;min-height:60px">${(m.resultText||"").trim() ? (typeof textWithTablesHTML==="function"?textWithTablesHTML(m.resultText,{dash:false}):`<div style="white-space:pre-wrap">${escapeHtml(m.resultText.trim())}</div>`) : "&nbsp;"}</div>
    ${_rptPhotoGrid(window._srPhotos,"Photos")}
    ${typeof _rptPlanSheets==="function"?_rptPlanSheets(window._srPlans,"Site Plans"):""}
    ${sigAny(["sr_eng","sr_rep"])?`<div class="ksec"><span class="kbad">${K()}</span><h3>Report Approval</h3></div>
    ${sigRow([["sr_eng", m.engName||m.technician||"Eng.", "Technical Engineer", "EJAF Technology"],
              ["sr_rep", m.repName||m.representative||"Mr.", m.repTitle||"", m.client||""]])}`:""}
    <div style="margin-top:14px;border:1px solid #ddd;border-radius:8px;padding:10px 12px;display:flex;gap:14px;align-items:center">
      <div style="flex:1;font-size:10px;font-style:italic;color:#555;line-height:1.7">This inspection and test report has been carried out by EJAF's competent engineers on the date stated above, in accordance with the applicable international standards for ${tpl.multi?`the ${subsAll.length} sub-system(s) recorded in the Scope of Report`:"this system"}.</div>
      <div style="font-size:9px;font-style:italic;font-weight:700;color:#333;max-width:200px;line-height:1.6">Reference Standards<br><span style="font-weight:500">${escapeHtml(tpl.standards)}${tpl.multi?`<br><br>Each sub-system was assessed against its own governing standards, stated in the Scope of Report table and above every check list.`:""}</span></div>
    </div>
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  const type={cctv:"CCTV_REPORT",fire:"FIRE_ALARM_REPORT",acs:"ACCESS_CONTROL_REPORT",ids:"INTRUSION_REPORT",net:"NETWORK_REPORT",elv:"ELV_REPORT",elvi:"ELV_INTEGRATED_REPORT"}[tpl.id]||"SYSTEM_REPORT";
  await openReportPDF(type,[m.date?fmtDate(m.date):"",m.client,m.project].filter(Boolean).join(" · ")||"Manual",bodyHTML,{project:m.project||"",client:m.client||""});
  toast(`${tpl.multi?"ELV Integrated":tpl.name.split(" ")[0]} report ready!`);
};
Object.assign(window,{renderSystemReports});

// ═══════════════════════════════════════════════════════════════════════
//  HANDOVER DOSSIER (v172)
//  One button, one indexed PDF: everything a client's acceptance committee
//  asks for at project handover, assembled from live data rather than from
//  files someone remembered to keep.
//
//  Why this exists: every artefact already lives in Girêk — the asset
//  register, the PM record, the incident log, the work log, the SLA figures
//  and the governing standards per sub-system. What was missing was the act
//  of BINDING them into one document an auditor can sign. That binding is
//  what wins an ELV contract, and no generic PM tool can produce it because
//  none of them know what EN 50131 or NFPA 72 mean.
// ═══════════════════════════════════════════════════════════════════════

window._hd = window._hd || {
  project:"", from:"", to:"", contractRef:"",
  engName:"", engTitle:"Project Engineer",
  repName:"", repTitle:"", repOrg:"",
  notes:"",
};
window._hdDocs = window._hdDocs || null;   // {project, rows, error?} once fetched
window._hdDocsBusy = false;
// reportLog is append-only and unbounded, so it is queried on demand rather
// than kept in a live listener like the working collections. One equality
// filter only \u2014 ordering server-side would demand a composite index.
window.hdLoadDocs = async function(pname){
  const p = String(pname||"").trim();
  if(!p){ window._hdDocs=null; return; }
  if(window._hdDocsBusy) return;
  window._hdDocsBusy = true; render();
  try{
    const {db, collection, query, where, getDocs} = window.__fb;
    const snap = await getDocs(query(collection(db,"reportLog"), where("project","==",p)));
    const rows = [];
    snap.forEach(d=>rows.push(d.data()));
    rows.sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
    window._hdDocs = {project:p, rows};
  }catch(e){
    console.warn("document trail unavailable", e && e.message);
    window._hdDocs = {project:p, rows:[], error:(e&&e.message)||"unavailable"};
  }
  window._hdDocsBusy = false; render();
};

window._hdSec = window._hdSec || {
  particulars:true, conformity:true, assets:true, pm:true,
  incidents:true, worklog:true, sla:true, warranty:true, docs:true,
};

// ── Data gathering: one pass, every section reads from this ──────────────
function hdCollect(){
  const m = window._hd;
  const pname = (m.project||"").trim();
  const proj  = (state.projects||[]).find(p=>(p.name||"").trim()===pname) || null;
  const from  = m.from || "";
  const to    = m.to   || "";
  const inRange = (d)=>{ if(!d) return false; if(from && d<from) return false; if(to && d>to) return false; return true; };

  const devices = (state.devices||[]).filter(d=>(d.project||"").trim()===pname);
  // Which ELV disciplines does this project actually contain? Derived from the
  // asset register, so the conformity page can never claim a system that is
  // not installed.
  const subs = [];
  devices.forEach(d=>{
    const s = elvSubForName(d.system);
    const key = s ? s.id : ("other:"+String(d.system||"Unclassified").trim());
    if(!subs.some(x=>x.key===key)) subs.push({key, sub:s, label:s?s.name:(String(d.system||"Unclassified").trim()||"Unclassified")});
  });
  subs.forEach(x=>{ x.count = devices.filter(d=>{
    const s=elvSubForName(d.system);
    return (s?s.id:("other:"+String(d.system||"Unclassified").trim()))===x.key;
  }).length; });

  const pms       = (state.pmSchedules||[]).filter(s=>(s.project||"").trim()===pname);
  const incidents = (state.incidents||[]).filter(i=>(i.project||"").trim()===pname && (!i.date || inRange(i.date)));
  const entries   = (state.daily||[]).filter(r=>(r.project||"").trim()===pname && inRange(r.date));
  const requests  = (state.clientRequests||[]).filter(r=>(r.project||"").trim()===pname);

  const hours = entries.reduce((s,r)=>s+Number(r.duration||0),0);
  const est   = Number(proj&&proj.estimatedHours||0);

  const byCat = {};
  entries.forEach(r=>{ const k=(r.taskCategory||"Uncategorised"); byCat[k]=(byCat[k]||0)+Number(r.duration||0); });
  const byEmp = {};
  entries.forEach(r=>{ const k=(r.employee||"—"); byEmp[k]=(byEmp[k]||0)+Number(r.duration||0); });

  const today = (typeof todayStr==="function") ? todayStr() : new Date().toISOString().slice(0,10);
  const warranty = devices
    .filter(d=>d.warrantyEnd)
    .map(d=>({...d, expired: String(d.warrantyEnd) < today}))
    .sort((a,b)=>String(a.warrantyEnd).localeCompare(String(b.warrantyEnd)));

  const areas = proj ? (typeof getProjectAreas==="function" ? getProjectAreas(proj) : (proj.areas||[])) : [];
  const sla   = (typeof slaCompliance==="function") ? slaCompliance(pname) : null;

  // Only a trail fetched for THIS project counts: a stale one left over from a
  // previously selected project must never be printed against another.
  const trail = (window._hdDocs && window._hdDocs.project===pname) ? window._hdDocs : null;
  const docs  = trail ? trail.rows.filter(r=>{
    const d = String(r.at||"").slice(0,10);
    if(!d) return true;
    if(from && d<from) return false;
    if(to   && d>to)   return false;
    return true;
  }) : [];
  return {m, proj, pname, from, to, devices, subs, pms, incidents, entries,
          requests, hours, est, byCat, byEmp, warranty, areas, sla,
          docs, docsError: trail ? (trail.error||null) : null, docsLoaded: !!trail};
}
window.hdCollect = hdCollect;

// Only the sections the user kept, numbered in document order.
function hdSections(D){
  const on = window._hdSec, out = [];
  const add=(id,title)=>{ if(on[id]) out.push({id,title,no:String(out.length+1).padStart(2,"0")}); };
  add("particulars","Project Particulars");
  add("conformity","Scope of Works & Standards Conformity");
  add("assets",     `Asset Register (${D.devices.length})`);
  add("pm",         `Preventive Maintenance Record (${D.pms.length})`);
  add("incidents",  `Incident Log (${D.incidents.length})`);
  add("worklog",    "Work Record Summary");
  add("sla",        `Client Requests & Service Levels (${D.requests.length})`);
  add("warranty",   `Warranty Register (${D.warranty.length})`);
  add("docs",       `Documents Issued (${D.docs.length})`);
  return out;
}
window.hdSections = hdSections;

// ── Document body ───────────────────────────────────────────────────────
const _hdEsc = (v)=>escapeHtml(v==null?"":String(v));
const _hdDash = (v)=>{ const s=String(v==null?"":v).trim(); return s?escapeHtml(s):"—"; };
function _hdRow(l,v){
  return `<tr><td style="padding:6px 10px;border:1px solid #D6E4F0;background:#F5F8FC;font-weight:700;width:36%">${l}</td>
              <td style="padding:6px 10px;border:1px solid #D6E4F0">${v}</td></tr>`;
}
// Every numbered section opens a new page, so the cover and contents keep
// page one to themselves.
function _hdHead(no,title){
  return `<div class="ksec" style="page-break-before:always">
    <span class="kbad">${no}</span><h3>${escapeHtml(title)}</h3></div>`;
}
function _hdEmpty(what){
  return `<div style="padding:14px;border:1px dashed #C9D3E4;border-radius:8px;color:#6B7B8F;font-style:italic">No ${escapeHtml(what)} recorded for this project in the stated period.</div>`;
}

function buildHandoverBody(){
  const D = hdCollect();
  const secs = hdSections(D);
  const m = D.m;
  const period = (D.from||D.to) ? `${D.from?fmtDate(D.from):"start"} \u2192 ${D.to?fmtDate(D.to):"date"}` : "Full project history";
  const S = (id)=>secs.find(x=>x.id===id);
  let body = "";

  // ── Cover ──
  body += `<div style="border:2px solid #03308B;border-radius:10px;padding:22px;margin-bottom:16px;text-align:center">
    <div style="font-size:11px;letter-spacing:3px;color:#6B7B8F;font-weight:700">PROJECT HANDOVER DOSSIER</div>
    <div style="font-size:22px;font-weight:700;color:#03308B;margin:10px 0 4px">${_hdDash(D.pname)}</div>
    <div style="font-size:13px;color:#1B2A44">${_hdDash(D.proj&&D.proj.client)}</div>
    <div style="margin-top:14px;font-size:11px;color:#6B7B8F;line-height:1.9">
      Period covered: <strong style="color:#1B2A44">${escapeHtml(period)}</strong><br>
      ${m.contractRef?`Contract reference: <strong style="color:#1B2A44">${_hdEsc(m.contractRef)}</strong><br>`:""}
      Compiled from the live operational record held in Gir\u00eak.
    </div>
  </div>`;

  // ── Contents ──
  body += `<div class="ksec"><span class="kbad">\u2630</span><h3>Contents</h3></div>
  <table style="border-collapse:collapse;width:100%">
    ${secs.map(s=>`<tr>
      <td style="padding:5px 10px;border:1px solid #D6E4F0;width:44px;text-align:center;font-weight:700;color:#03308B">${s.no}</td>
      <td style="padding:5px 10px;border:1px solid #D6E4F0">${escapeHtml(s.title)}</td></tr>`).join("")}
    <tr><td style="padding:5px 10px;border:1px solid #D6E4F0;text-align:center;font-weight:700;color:#03308B">\u270e</td>
        <td style="padding:5px 10px;border:1px solid #D6E4F0">Declaration &amp; Acceptance</td></tr>
  </table>`;

  // ── 1. Particulars ──
  if(S("particulars")){
    const s=S("particulars");
    const pct = D.est ? Math.round(D.hours/D.est*100) : null;
    body += _hdHead(s.no,s.title) + `<table style="border-collapse:collapse;width:100%">
      ${_hdRow("Client",           _hdDash(D.proj&&D.proj.client))}
      ${_hdRow("Project",          _hdDash(D.pname))}
      ${_hdRow("Department",       _hdDash(D.proj&&D.proj.dept))}
      ${_hdRow("Current status",   _hdDash(D.proj&&D.proj.status))}
      ${_hdRow("Period covered",   escapeHtml(period))}
      ${m.contractRef?_hdRow("Contract reference", _hdEsc(m.contractRef)):""}
      ${_hdRow("Areas &amp; sites", D.areas.length
          ? D.areas.map(a=>`<strong>${escapeHtml(a.name)}</strong>${(a.sites||[]).length?" \u2014 "+(a.sites||[]).map(x=>escapeHtml(x.name)).join(", "):""}`).join("<br>")
          : "\u2014")}
      ${_hdRow("Estimated man-hours", D.est?`${fmtHM(D.est)} (${fmtDays(D.est/9)} day equivalent)`:"\u2014")}
      ${_hdRow("Recorded man-hours",  `${fmtHM(D.hours)}${pct!=null?` \u2014 <strong style="color:${pct>100?"#C62828":"#2E7D32"}">${pct}% of estimate</strong>`:""}`)}
      ${_hdRow("Work entries",     String(D.entries.length))}
      ${_hdRow("Devices on register", String(D.devices.length))}
    </table>
    ${m.notes?`<div style="margin-top:10px;padding:10px 12px;border-left:3px solid #C9A84C;background:#FFFDF5;font-size:11px;line-height:1.7">${typeof textWithTablesHTML==="function"?textWithTablesHTML(m.notes,{dash:false}):_hdEsc(m.notes)}</div>`:""}`;
  }

  // ── 2. Conformity — the centrepiece ──
  if(S("conformity")){
    const s=S("conformity");
    body += _hdHead(s.no,s.title) + `
    <p style="font-size:11px;line-height:1.7;margin-bottom:9px">The sub-systems below are those present on this project's asset register. Each was maintained and inspected against the standards stated beside it.</p>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr>
        <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;width:34px">#</th>
        <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Sub-system</th>
        <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;width:52px">Devices</th>
        <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Governing standards</th>
      </tr></thead>
      <tbody>${D.subs.length ? D.subs.map((x,i)=>`<tr>
        <td style="padding:6px 9px;border:1px solid #D6E4F0;text-align:center">${String(i+1).padStart(2,"0")}</td>
        <td style="padding:6px 9px;border:1px solid #D6E4F0"><strong>${escapeHtml(x.label)}</strong></td>
        <td style="padding:6px 9px;border:1px solid #D6E4F0;text-align:center">${x.count}</td>
        <td style="padding:6px 9px;border:1px solid #D6E4F0;font-size:9.5px;line-height:1.5">${x.sub?escapeHtml(chkGroup(x.sub.id).standards||""):"<em>Not an ELV discipline \u2014 no standard mapped</em>"}</td>
      </tr>`).join("") : `<tr><td colspan="4" style="padding:10px;border:1px solid #D6E4F0;text-align:center;font-style:italic;color:#6B7B8F">No devices are registered against this project, so no sub-system can be certified.</td></tr>`}</tbody>
    </table>
    <div style="margin-top:8px;font-size:10px;font-style:italic;color:#555;line-height:1.6">Any sub-system not listed above is not part of this handover and was not inspected.</div>`;
  }

  // ── 3. Asset register, grouped by sub-system ──
  if(S("assets")){
    const s=S("assets");
    body += _hdHead(s.no,s.title);
    if(!D.devices.length){ body += _hdEmpty("devices"); }
    else {
      D.subs.forEach(grp=>{
        const rows = D.devices.filter(d=>{
          const sub=elvSubForName(d.system);
          return (sub?sub.id:("other:"+String(d.system||"Unclassified").trim()))===grp.key;
        });
        body += `<div style="font-weight:700;color:#03308B;font-size:12px;margin:12px 0 5px">${escapeHtml(grp.label)} <span style="font-weight:400;color:#6B7B8F">(${rows.length})</span></div>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr>
            <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">#</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Device</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Model</th>
            <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Serial</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Location</th>
            <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Installed</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Status</th>
          </tr></thead>
          <tbody>${rows.map((d,i)=>`<tr>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${String(i+1).padStart(2,"0")}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0"><strong>${_hdDash(d.deviceName)}</strong></td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(d.model)}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(d.serialNumber)}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash([d.area,d.site].filter(Boolean).join(" \u203a "))}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${d.installDate?escapeHtml(fmtDate(d.installDate)):"\u2014"}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(d.status)}</td></tr>`).join("")}</tbody>
        </table>`;
      });
    }
  }

  // ── 4. Preventive maintenance record ──
  if(S("pm")){
    const s=S("pm");
    body += _hdHead(s.no,s.title);
    if(!D.pms.length){ body += _hdEmpty("preventive maintenance schedules"); }
    else {
      body += `<table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">#</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Schedule</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">System</th>
          <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Every</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Last done</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Next due</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Round</th>
        </tr></thead>
        <tbody>${D.pms.map((p,i)=>{
          const units=(typeof _pmUnitsOf==="function")?_pmUnitsOf(p):[];
          const done =(typeof _pmRoundDone==="function")?_pmRoundDone(p):[];
          const due  =(typeof pmNextDue==="function")?pmNextDue(p):"";
          return `<tr>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${String(i+1).padStart(2,"0")}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0"><strong>${_hdDash(p.title)}</strong></td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(p.system)}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${p.freqDays?escapeHtml(p.freqDays+" days"):"\u2014"}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${p.lastDone?escapeHtml(fmtDate(p.lastDone)):"\u2014"}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${due?escapeHtml(fmtDate(due)):"\u2014"}</td>
            <td style="padding:6px 9px;border:1px solid #D6E4F0">${units.length?`${done.length}/${units.length} sites`:"single"}</td></tr>`;
        }).join("")}</tbody></table>`;
    }
  }

  // ── 5. Incident log ──
  if(S("incidents")){
    const s=S("incidents");
    body += _hdHead(s.no,s.title);
    if(!D.incidents.length){ body += _hdEmpty("incidents"); }
    else {
      const open=D.incidents.filter(i=>String(i.status||"").toLowerCase()!=="closed").length;
      body += `<table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">#</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Date</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">System</th>
          <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Title</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Severity</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Status</th>
        </tr></thead>
        <tbody>${D.incidents.map((x,i)=>`<tr>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${String(i+1).padStart(2,"0")}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${x.date?escapeHtml(fmtDate(x.date)):"\u2014"}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(x.system)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(x.title)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(x.severity)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(x.status)}</td></tr>`).join("")}</tbody></table>
      <div style="margin-top:6px;font-size:11px;font-weight:700;color:${open?"#C62828":"#2E7D32"}">${open?`${open} incident(s) remain open at the date of this dossier.`:"All recorded incidents are closed."}</div>`;
    }
  }

  // ── 6. Work record summary ──
  if(S("worklog")){
    const s=S("worklog");
    const cats=Object.entries(D.byCat).sort((a,b)=>b[1]-a[1]);
    const emps=Object.entries(D.byEmp).sort((a,b)=>b[1]-a[1]);
    body += _hdHead(s.no,s.title);
    if(!D.entries.length){ body += _hdEmpty("work entries"); }
    else {
      body += `<table style="border-collapse:collapse;width:100%;margin-bottom:12px">
        ${_hdRow("Entries in period", String(D.entries.length))}
        ${_hdRow("Total man-hours",   fmtHM(D.hours))}
        ${_hdRow("Day equivalent",    fmtDays(D.hours/9)+" days at 9 man-hours")}
        ${_hdRow("Engineers involved",String(emps.length))}
      </table>
      <div style="font-weight:700;color:#03308B;font-size:12px;margin:10px 0 5px">By work category</div>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Category</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Man-hours</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Share</th></tr></thead>
        <tbody>${cats.map(([k,v])=>`<tr>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${escapeHtml(k)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${fmtHM(v)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${D.hours?Math.round(v/D.hours*100):0}%</td></tr>`).join("")}</tbody></table>
      <div style="font-weight:700;color:#03308B;font-size:12px;margin:12px 0 5px">By engineer</div>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Engineer</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Man-hours</th></tr></thead>
        <tbody>${emps.map(([k,v])=>`<tr>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${escapeHtml(k)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${fmtHM(v)}</td></tr>`).join("")}</tbody></table>`;
    }
  }

  // ── 7. Requests & service levels ──
  if(S("sla")){
    const s=S("sla");
    body += _hdHead(s.no,s.title);
    if(!D.requests.length){ body += _hdEmpty("client requests"); }
    else {
      body += `${D.sla?`<table style="border-collapse:collapse;width:100%;margin-bottom:10px">
        ${_hdRow("Requests measured", String(D.sla.total))}
        ${_hdRow("Within service level", `<strong style="color:#2E7D32">${D.sla.met}</strong>`)}
        ${_hdRow("Breached", `<strong style="color:${D.sla.breached?"#C62828":"#2E7D32"}">${D.sla.breached}</strong>`)}
        ${_hdRow("Compliance", `<strong style="color:${D.sla.pct>=95?"#2E7D32":D.sla.pct>=85?"#8F6E22":"#C62828"}">${D.sla.pct}%</strong>`)}
        ${_hdRow("Still open", String(D.sla.open))}
      </table>`:""}
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">#</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Raised</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Request</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Status</th>
        </tr></thead>
        <tbody>${D.requests.map((r,i)=>`<tr>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${String(i+1).padStart(2,"0")}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${r.createdAt?escapeHtml(fmtDate(String(r.createdAt).slice(0,10))):"\u2014"}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(r.title)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(r.status)}</td></tr>`).join("")}</tbody></table>`;
    }
  }

  // ── 8. Warranty register ──
  if(S("warranty")){
    const s=S("warranty");
    body += _hdHead(s.no,s.title);
    if(!D.warranty.length){ body += _hdEmpty("devices carrying a warranty date"); }
    else {
      const exp=D.warranty.filter(d=>d.expired).length;
      body += `<table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">#</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Device</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Serial</th>
          <th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">Warranty until</th><th style="padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left">State</th>
        </tr></thead>
        <tbody>${D.warranty.map((d,i)=>`<tr>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${String(i+1).padStart(2,"0")}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(d.deviceName)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${_hdDash(d.serialNumber)}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0">${escapeHtml(fmtDate(d.warrantyEnd))}</td>
          <td style="padding:6px 9px;border:1px solid #D6E4F0";color:${d.expired?"#C62828":"#2E7D32"};font-weight:700">${d.expired?"Expired":"In warranty"}</td></tr>`).join("")}</tbody></table>
      <div style="margin-top:6px;font-size:11px;font-weight:700;color:${exp?"#C62828":"#2E7D32"}">${exp?`${exp} device(s) are outside warranty at the date of this dossier.`:"All listed devices remain within warranty."}</div>`;
    }
  }

  // ── Declaration ──
  // Section 9 — the document trail
  if(S("docs")){
    const s=S("docs");
    body += _hdHead(s.no,s.title);
    if(!D.docsLoaded){
      body += _hdEmpty("document trail (not loaded)");
    } else if(D.docsError){
      body += `<div style="padding:12px;border:1px solid #FFB74D;background:#FFF8E1;border-radius:8px;font-size:11px;color:#7F6000;line-height:1.7">The document register could not be read (${escapeHtml(D.docsError)}). Every report issued from Gir\u00eak carries its own reference number, which remains valid independently of this index.</div>`;
    } else if(!D.docs.length){
      body += `<div style="padding:12px;border:1px dashed #C9D3E4;border-radius:8px;color:#6B7B8F;font-size:11px;line-height:1.7">No referenced documents are on record against this project for the stated period.<br><em>Documents issued before the project reference was introduced are not indexed here; their reference numbers remain valid.</em></div>`;
    } else {
      const TH9='padding:6px 9px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left';
      const TD9='padding:6px 9px;border:1px solid #D6E4F0';
      body += `<p style="font-size:11px;line-height:1.7;margin-bottom:9px">Every document below was issued from Gir\u00eak against this project and carries the reference number shown. Numbering is sequential per document type and per year.</p>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="${TH9};width:34px;text-align:center">#</th>
          <th style="${TH9}">Reference</th><th style="${TH9}">Document</th>
          <th style="${TH9}">Period</th><th style="${TH9}">Issued</th><th style="${TH9}">By</th>
        </tr></thead>
        <tbody>${D.docs.map((r,i)=>`<tr>
          <td style="${TD9};text-align:center">${String(i+1).padStart(2,"0")}</td>
          <td style="${TD9};font-weight:700;color:#03308B">${_hdDash(r.refNo)}</td>
          <td style="${TD9}">${escapeHtml((window.REF_TYPE_LABEL&&window.REF_TYPE_LABEL[r.prefix])||r.reportType||"\u2014")}</td>
          <td style="${TD9};font-size:10px">${_hdDash(r.period)}</td>
          <td style="${TD9}">${r.at?escapeHtml(fmtDate(String(r.at).slice(0,10))):"\u2014"}</td>
          <td style="${TD9};font-size:10px">${_hdDash(r.exportedByName||r.exportedBy)}</td>
        </tr>`).join("")}</tbody></table>`;
    }
  }

  body += `<div class="ksec" style="page-break-before:always"><span class="kbad">\u270e</span><h3>Declaration &amp; Acceptance</h3></div>
  <p style="font-size:11px;line-height:1.8;margin-bottom:12px">
    EJAF Technology confirms that the works described in this dossier were carried out by competent engineers,
    that the asset register above reflects the equipment installed and maintained on this project, and that each
    sub-system was assessed against the standards stated in the conformity section.
    This dossier was compiled from the live operational record on the date of issue shown in the document header.
  </p>
  ${sigRow([["hd_eng", m.engName, m.engTitle, "EJAF Technology"],
            ["hd_rep", m.repName, m.repTitle, m.repOrg || (D.proj&&D.proj.client) || ""]])}`;

  return {D, secs, body};
}
window.buildHandoverBody = buildHandoverBody;

// ── Screen ──────────────────────────────────────────────────────────────
window.hdSet = function(k,v){ window._hd[k]=v; };
window.hdToggle = function(k){ window._hdSec[k]=!window._hdSec[k]; render(); };
window.hdPickProject = function(v){
  window._hd.project = v;
  // Default the period to the project's own dates the first time one is picked.
  const p = (state.projects||[]).find(x=>(x.name||"").trim()===String(v||"").trim());
  if(p && !window._hd.from) window._hd.from = p.startDate || "";
  if(!window._hd.to) window._hd.to = (typeof todayStr==="function") ? todayStr() : new Date().toISOString().slice(0,10);
  if(p && !window._hd.contractRef && p.codes && p.codes.length) window._hd.contractRef = p.codes[0];
  window._hdDocs = null;          // never carry another project's trail across
  render();
  hdLoadDocs(v);                  // async; re-renders when it lands
};

const HD_SECTIONS = [
  {k:"particulars", ic:"\u{1F4CB}", lb:"Particulars"},
  {k:"conformity",  ic:"\u{1F4D0}", lb:"Standards conformity"},
  {k:"assets",      ic:"\u{1F5A5}\uFE0F", lb:"Asset register"},
  {k:"pm",          ic:"\u{1F6E0}\uFE0F", lb:"PM record"},
  {k:"incidents",   ic:"\u{1F6A8}", lb:"Incident log"},
  {k:"worklog",     ic:"\u23F1\uFE0F", lb:"Work record"},
  {k:"sla",         ic:"\u{1F4E8}", lb:"Requests & SLA"},
  {k:"warranty",    ic:"\u{1F6E1}\uFE0F", lb:"Warranty"},
  {k:"docs",        ic:"\u{1F4C4}", lb:"Documents issued"},
];

function renderHandoverDossier(){
  if(!(isAdmin()||hasCap("canViewReports"))) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const m = window._hd;
  const projects = (state.projects||[]).map(p=>p.name).filter(Boolean).sort();
  const D = m.project ? hdCollect() : null;
  const secs = D ? hdSections(D) : [];

  return `
  ${_rptHero("\u{1F4E6}","Handover Dossier","One indexed document for the acceptance committee","linear-gradient(135deg,#0F2347 0%,#03308B 60%,#2E5FA3 100%)")}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">01</span> Project &amp; Period</div>
    <div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label>Project <span class="req">*</span></label>
        <select onchange="hdPickProject(this.value)">
          <option value="">\u2014 select \u2014</option>
          ${projects.map(p=>`<option ${m.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}
        </select></div>
      <div class="field"><label>From</label><input type="date" value="${escapeHtml(m.from||"")}" onchange="hdSet('from',this.value);render()"></div>
      <div class="field"><label>To</label><input type="date" value="${escapeHtml(m.to||"")}" onchange="hdSet('to',this.value);render()"></div>
      <div class="field" style="grid-column:1/-1"><label>Contract / PO reference</label>
        <input value="${escapeHtml(m.contractRef||"")}" oninput="hdSet('contractRef',this.value)" placeholder="e.g. PO-2026-1187"></div>
      <div class="field" style="grid-column:1/-1"><label>Closing note <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 optional, printed under Particulars</span></label>
        <textarea rows="2" oninput="hdSet('notes',this.value)" placeholder="Anything the committee should read first\u2026">${escapeHtml(m.notes||"")}</textarea>${typeof tableToolbar==="function"?tableToolbar("_hd.notes"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML((window._hd||{}).notes):""}</div>
    </div>
    ${!m.project?`<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#E65100;line-height:1.6">Pick a project to see exactly what the dossier will contain.</div>`:""}
  </div>

  ${D?`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">02</span> Sections <span style="font-size:10px;color:var(--muted);font-weight:500">(${secs.length} included)</span></div>
    <p style="font-size:11px;color:var(--muted);margin:6px 0 10px;line-height:1.6">Everything is drawn from live data \u2014 nothing is typed twice. Untick anything the committee does not need.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${HD_SECTIONS.map(s=>{const on=!!window._hdSec[s.k];
        return `<button class="btn btn-sm ${on?"":"btn-secondary"}" style="${on?"background:#03308B;color:#fff;border:none;":""}font-weight:700;font-size:11px" onclick="hdToggle('${s.k}')">${on?"\u2713 ":""}${s.ic} ${escapeHtml(s.lb)}</button>`;}).join("")}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;margin-top:14px">
      ${[["Devices",D.devices.length],["Sub-systems",D.subs.length],["PM schedules",D.pms.length],
         ["Incidents",D.incidents.length],["Work entries",D.entries.length],["Requests",D.requests.length],
         ["Documents",window._hdDocsBusy?"\u2026":D.docs.length]]
        .map(([l,n])=>`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:${n?"#03308B":"var(--muted)"}">${n}</div>
          <div style="font-size:10px;color:var(--muted)">${l}</div></div>`).join("")}
    </div>
    ${window._hdSec.docs && D.docsLoaded && !D.docs.length && !D.docsError
      ? `<div style="background:#F5F8FC;border:1px solid var(--line);border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:var(--muted);line-height:1.6">\u{1F4C4} No documents are indexed against this project yet. Reports record their project from v173 onward \u2014 anything issued before that keeps its reference number but will not appear here.</div>`
      : ""}
    ${D.docsError?`<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#E65100;line-height:1.6">\u26a0 Document register unavailable: ${escapeHtml(D.docsError)}. The dossier will say so rather than claim an empty trail.</div>`:""}
    ${!D.devices.length?`<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#E65100;line-height:1.6">\u26a0 No devices are registered against this project, so the conformity page cannot certify any sub-system. Tag the equipment in <strong>Assets \u2192 System</strong> first.</div>`:""}
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">03</span> Declaration</div>
    <div class="form-grid">
      <div class="field"><label>EJAF signatory</label><input value="${escapeHtml(m.engName||"")}" oninput="hdSet('engName',this.value)" placeholder="Name"></div>
      <div class="field"><label>Title</label><input value="${escapeHtml(m.engTitle||"")}" oninput="hdSet('engTitle',this.value)" placeholder="e.g. Project Engineer"></div>
      <div class="field"><label>Client signatory</label><input value="${escapeHtml(m.repName||"")}" oninput="hdSet('repName',this.value)" placeholder="Name"></div>
      <div class="field"><label>Title</label><input value="${escapeHtml(m.repTitle||"")}" oninput="hdSet('repTitle',this.value)" placeholder="e.g. Facilities Manager"></div>
    </div>
    ${signaturePad("hd_eng","EJAF signatory","Sign inside the box")}
    ${signaturePad("hd_rep","Client acceptance","Hand the device to the client representative")}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${rptFormatToggle(true)}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%" onclick="generateHandoverDossier()">\u{1F4E6} Generate Handover Dossier</button>
  </div>`:""}`;
}

window.generateHandoverDossier = async function(){
  if(!window._hd.project) return toast("\u26a0 Pick the project first");
  const {D, secs, body} = buildHandoverBody();
  if(!secs.length) return toast("\u26a0 Every section is unticked \u2014 nothing to print");
  const period = (D.from||D.to) ? `${D.from||"start"} \u2192 ${D.to||"date"}` : "Full history";
  await openReportPDF("HANDOVER_DOSSIER", `${D.pname} \u2014 ${period}`, body, {project:D.pname, client:(D.proj&&D.proj.client)||""});
  toast("Handover dossier ready!");
};

Object.assign(window,{renderHandoverDossier, buildHandoverBody, hdCollect, hdSections});


// ═══════════════════════════════════════════════════════════════════════
//  PROJECT PROGRESS REPORTS — Daily & Weekly (v131)
//  Structure follows ISO 21502:2020 §7.15 (Reporting) / project performance
//  management and PMBOK work-performance reporting: scope of work up front,
//  accomplishments for the period, look-ahead, RAG status, progress metrics,
//  risks & issues, manpower, HSE. Every field is either pulled from the
//  app's own records or typed by hand — you decide, line by line.
// ═══════════════════════════════════════════════════════════════════════
window._pr = window._pr || {
  client:"",clientOther:false, project:"",projectOther:false, site:"",siteOther:false,
  date:"", from:"", to:"", weekNo:"", contractNo:"", reference:"",
  preparedBy:"", weather:"", representative:"",
  scope:"", summary:"", rag:"Green", plannedPct:"", actualPct:"",
  issues:"", nextPlan:"", hse:"", engName:"", repName:"", repTitle:""
};
window._prTasks  = window._prTasks  || [];
window._prPeople = window._prPeople || [];
window._prPhotos = window._prPhotos || [];

const PR_RAG = { Green:["#E8F5E9","#2E7D32","On track"], Amber:["#FFF3E0","#E65100","At risk"], Red:["#FDECEA","#C62828","Critical"] };

window.prAddTask   = function(){ window._prTasks.push({date:window._pr.date||today(),desc:"",location:"",by:"",hours:"",status:"Completed"}); render(); };
// Derived readouts for the progress report. Typing must never rebuild the form:
// three oninput handlers used to fire render() on every character.
window.prVarCalc=function(){
  const el=document.getElementById("pr_var"), m=window._pr||{};
  if(!el){ render(); return; }
  const has = (m.plannedPct!=="" && m.plannedPct!=null && m.actualPct!=="" && m.actualPct!=null);
  const d = has ? (Number(m.actualPct)-Number(m.plannedPct)) : null;
  el.className = "auto " + (has ? (d>=0?"green":"yellow") : "empty");
  el.textContent = has ? ((d>=0?"+":"")+d+"%") : "—";
};
window.prTotCalc=function(){
  const el=document.getElementById("pr_tot");
  if(!el) return;
  const h=(window._prTasks||[]).reduce((s,t)=>s+Number(t.hours||0),0);
  el.textContent=(window._prTasks||[]).length+" task(s) · "+fmtHM(h);
};
window.prDelTask   = function(i){ window._prTasks.splice(i,1); render(); };
window.prAddPerson = function(){ window._prPeople.push({name:"",role:"",hours:""}); render(); };
window.prDelPerson = function(i){ window._prPeople.splice(i,1); render(); };
window.prAddPhotos = async function(input){
  try{
    const files=Array.from(input.files||[]); input.value="";
    for(const f of files){
      if(window._prPhotos.length>=12){ toast("Max 12 photos"); break; }
      const b64=await compressImage(f,1024,0.6); const kb=base64SizeKB(b64);
      if(kb>500){ toast(`Image too large (${kb} KB). Skipped.`); continue; }
      window._prPhotos.push({data:b64,sizeKB:kb});
    }
    render();
  }catch(e){ toast("Photo error: "+(e.message||"failed")); }
};
window.prDelPhoto = function(i){ window._prPhotos.splice(i,1); render(); };

// Quick range helpers for the weekly report
window.prThisWeek = function(){
  const n=appNow(); const d=n.getDay();            // 0 = Sunday (work week here starts Sunday)
  const s=new Date(n); s.setDate(n.getDate()-d);
  const e=new Date(s); e.setDate(s.getDate()+6);
  const f=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  window._pr.from=f(s); window._pr.to=f(e); render();
};
window.prLastWeek = function(){
  const n=appNow(); const d=n.getDay();
  const s=new Date(n); s.setDate(n.getDate()-d-7);
  const e=new Date(s); e.setDate(s.getDate()+6);
  const f=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  window._pr.from=f(s); window._pr.to=f(e); render();
};

// Pull the period's real work out of the Daily Log — then edit freely
window.prLoadFromRecords = function(kind){
  const m=window._pr;
  const proj=(m.project||"").trim();
  if(!proj) return toast("⚠ Pick the project first");
  const from = kind==="daily" ? (m.date||today()) : (m.from||"");
  const to   = kind==="daily" ? (m.date||today()) : (m.to||"");
  if(!from||!to) return toast("⚠ Set the report date / period first");
  const rows=(state.daily||[]).filter(r=>
    (r.project||"").trim()===proj &&
    String(r.date||"")>=from && String(r.date||"")<=to &&
    (!m.site || [r.site,r.area,[r.area,r.site].filter(Boolean).join(" › ")].includes(m.site)));
  if(!rows.length) return toast("No work entries found for this project in that period");
  rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))||(a.entryNo||0)-(b.entryNo||0));
  window._prTasks = rows.map(r=>({
    date:r.date||"",
    desc:(r.resolutionText||"").trim() || [r.taskCategory,r.taskSubcategory].filter(Boolean).join(" › ") || (r.workType||"") || (r.notes||""),
    location:[r.area,r.site].filter(Boolean).join(" › ") || (r.location||""),
    by:r.employee||"", hours:r.duration||"", status:r.taskStatus||"Completed"
  }));
  // manpower roll-up for the period
  const byEmp={};
  rows.forEach(r=>{ const e=r.employee||"—"; byEmp[e]=(byEmp[e]||0)+Number(r.duration||0); });
  window._prPeople = Object.entries(byEmp).map(([name,h])=>({name,role:"",hours:(+h).toFixed(2)}))
    .sort((a,b)=>Number(b.hours)-Number(a.hours));
  toast(`✓ ${rows.length} entr${rows.length>1?"ies":"y"} · ${window._prPeople.length} person(s) loaded`);
  render();
};

function renderProgressReport(kind){
  if(!(isAdmin()||isHR()||hasCap("canExport"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  kind = (kind==="daily") ? "daily" : "weekly";
  const m=window._pr, daily=(kind==="daily");
  const clientOpts=(state.clients||[]).map(c=>c.name).filter(Boolean).sort();
  const projOpts=(state.projects||[]).map(p=>(p.name||"").trim()).filter(Boolean).sort();
  const pr=(state.projects||[]).find(p=>(p.name||"").trim()===m.project);
  const siteOpts=pr?getProjectAreas(pr).filter(a=>a.active!==false).flatMap(a=>{
    const ss=(a.sites||[]).filter(x=>x.active!==false);
    return ss.length?ss.map(x=>[a.name,x.name].filter(Boolean).join(" › ")):[a.name];
  }):[];
  const totH=window._prTasks.reduce((s,t)=>s+Number(t.hours||0),0);
  const accent=daily?"#2E5FA3":"#00695C";
  // Sections number themselves. A gated section simply does not draw, and the
// ones after it close the gap on their own.
  let _n=0; const N=()=>String(++_n).padStart(2,"0");
  const S=(n,t)=>`<div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">${n}</span> ${t}</div>`;

  return `
  ${_rptHero(daily?"📅":"📆", daily?"Daily Progress Report":"Weekly Progress Report",
     "Project monitoring — ISO 21502 §7.15", `linear-gradient(135deg,${accent} 0%,#1B2A33 100%)`)}

  <div class="card">
    ${S(N(),"Project Information")}
    <div class="form-grid" style="margin-top:10px">
      ${_syncSel("👤 Client",clientOpts,"window._pr.client","window._pr.clientOther",m.client,m.clientOther,"Client name")}
      ${_syncSel("📁 Project",projOpts,"window._pr.project","window._pr.projectOther",m.project,m.projectOther,"Project name","window._pr.site='';")}
      ${(siteOpts.length&&!m.projectOther)
        ? _syncSel("📍 Site / Area",siteOpts,"window._pr.site","window._pr.siteOther",m.site,m.siteOther,"optional")
        : `<div class="field"><label>📍 Site / Area</label><input value="${escapeHtml(m.site||"")}" oninput="window._pr.site=this.value" placeholder="optional"></div>`}
      ${daily
        ? `<div class="field"><label>📅 Report date <span class="req">*</span></label><input type="date" value="${m.date||""}" onchange="window._pr.date=this.value;render()"></div>
           <div class="field"><label>🌤 Weather / site conditions</label><input value="${escapeHtml(m.weather||"")}" oninput="window._pr.weather=this.value" placeholder="e.g. Clear, 41°C"></div>`
        : `<div class="field"><label>From <span class="req">*</span></label><input type="date" value="${m.from||""}" onchange="window._pr.from=this.value;render()"></div>
           <div class="field"><label>To <span class="req">*</span></label><input type="date" min="${m.from||""}" value="${m.to||""}" onchange="window._pr.to=this.value;render()"></div>
           <div class="field"><label>Week no.</label><input value="${escapeHtml(m.weekNo||"")}" oninput="window._pr.weekNo=this.value" placeholder="e.g. W29"></div>`}
      <div class="field"><label>Contract / PO no.</label><input value="${escapeHtml(m.contractNo||"")}" oninput="window._pr.contractNo=this.value"></div>
      ${_refField("window._pr.reference",m.reference)}
      <div class="field"><label>👷 Prepared by</label><input value="${escapeHtml(m.preparedBy||"")}" oninput="window._pr.preparedBy=this.value"></div>
      <div class="field"><label>👤 Client representative</label><input value="${escapeHtml(m.representative||"")}" oninput="window._pr.representative=this.value"></div>
    </div>
    ${daily?"":`<div style="display:flex;gap:6px;margin-top:10px">
      <button class="btn btn-sm btn-secondary" onclick="prThisWeek()">This week</button>
      <button class="btn btn-sm btn-secondary" onclick="prLastWeek()">Last week</button>
    </div>`}
  </div>

  <div class="card" style="border-left:4px solid ${accent}">
    ${S(N(),"Scope of Work")}
    <p style="font-size:11px;color:var(--muted);margin:6px 0 0">Opens the report — the engineer's overview of what this project covers.</p>
    <textarea rows="5" oninput="window._pr.scope=this.value" placeholder="Describe the project scope: systems covered, contracted works, sites, objectives…" style="width:100%;margin-top:8px">${escapeHtml(m.scope||"")}</textarea>
    ${typeof tableToolbar==="function"?tableToolbar("_pr.scope"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._pr.scope):""}
  </div>

  ${daily?"":`<div class="card">
    ${S(N(),"Status & Progress")}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
      ${Object.keys(PR_RAG).map(k=>`<button class="btn btn-sm ${m.rag===k?"":"btn-secondary"}" style="${m.rag===k?`background:${PR_RAG[k][1]};color:#fff;border:none;`:""}font-weight:700" onclick="window._pr.rag='${k}';render()">${k} — ${PR_RAG[k][2]}</button>`).join("")}
    </div>
    <div class="form-grid">
      <div class="field"><label>Planned progress %</label><input type="number" min="0" max="100" value="${m.plannedPct||""}" oninput="window._pr.plannedPct=this.value;prVarCalc()"></div>
      <div class="field"><label>Actual progress %</label><input type="number" min="0" max="100" value="${m.actualPct||""}" oninput="window._pr.actualPct=this.value;prVarCalc()"></div>
      <div class="field"><label>Variance (auto)</label><div id="pr_var" class="auto ${(m.plannedPct!==""&&m.actualPct!=="")?(Number(m.actualPct)>=Number(m.plannedPct)?"green":"yellow"):"empty"}">${(m.plannedPct!==""&&m.actualPct!=="")?((Number(m.actualPct)-Number(m.plannedPct))>=0?"+":"")+(Number(m.actualPct)-Number(m.plannedPct))+"%":"—"}</div></div>
    </div>
  </div>`}

  <div class="card">
    ${S(N(),"Executive Summary")}
    <p style="font-size:11px;color:var(--muted);margin:6px 0 0">${daily?"The day in a few lines — what a manager reads if they read nothing else.":"The week in a few lines — what a manager reads if they read nothing else."}</p>
    <textarea rows="3" oninput="window._pr.summary=this.value" placeholder="${daily?"Overall position of the project today…":"Overall position of the project this week…"}" style="width:100%;margin-top:8px">${escapeHtml(m.summary||"")}</textarea>
    ${typeof tableToolbar==="function"?tableToolbar("_pr.summary"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._pr.summary):""}
  </div>

  <div class="card">
    ${S(N(), daily?"Work Performed Today":"Work Completed This Week")}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
      <button class="btn btn-sm" style="background:${accent};color:#fff;border:none;font-weight:700" onclick="prLoadFromRecords('${kind}')">⬇ Load from Daily Log</button>
      <button class="btn btn-sm btn-secondary" onclick="prAddTask()">+ Add task</button>
      ${window._prTasks.length?`<button class="btn btn-sm btn-secondary" onclick="window._prTasks=[];render()">Clear</button>
      <span id="pr_tot" style="margin-left:auto;font-size:11px;font-weight:700;color:${accent};align-self:center">${window._prTasks.length} task(s) · ${fmtHM(totH)}</span>`:""}
    </div>
    ${window._prTasks.map((t,i)=>`<div style="border:1px solid var(--line);border-radius:8px;padding:9px;margin-bottom:8px;background:var(--card,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:10px;font-weight:700;color:${accent}">TASK ${i+1}</span>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="prDelTask(${i})">×</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Date</label><input type="date" value="${t.date||""}" onchange="window._prTasks[${i}].date=this.value"></div>
        <div class="field"><label>Hours</label><input type="number" step="0.25" value="${t.hours||""}" oninput="window._prTasks[${i}].hours=this.value;prTotCalc()"></div>
        <div class="field" style="grid-column:1/-1"><label>Description</label><input value="${escapeHtml(t.desc||"")}" oninput="window._prTasks[${i}].desc=this.value" placeholder="Work performed"></div>
        <div class="field"><label>Location</label><input value="${escapeHtml(t.location||"")}" oninput="window._prTasks[${i}].location=this.value"></div>
        <div class="field"><label>By</label><input value="${escapeHtml(t.by||"")}" oninput="window._prTasks[${i}].by=this.value"></div>
        <div class="field"><label>Status</label><input value="${escapeHtml(t.status||"")}" oninput="window._prTasks[${i}].status=this.value"></div>
      </div>
    </div>`).join("")}
  </div>

  <div class="card">
    ${S(N(),"Manpower")}
    <div style="display:flex;gap:6px;margin:10px 0">
      <button class="btn btn-sm btn-secondary" onclick="prAddPerson()">+ Add person</button>
      ${window._prPeople.length?`<button class="btn btn-sm btn-secondary" onclick="window._prPeople=[];render()">Clear</button>`:""}
    </div>
    ${window._prPeople.map((p,i)=>`<div style="display:flex;gap:6px;margin-bottom:7px;flex-wrap:wrap;align-items:center">
      <input value="${escapeHtml(p.name||"")}" oninput="window._prPeople[${i}].name=this.value" placeholder="Name" style="flex:2;min-width:130px">
      <input value="${escapeHtml(p.role||"")}" oninput="window._prPeople[${i}].role=this.value" placeholder="Role / trade" style="flex:1;min-width:100px">
      <input type="number" step="0.25" value="${p.hours||""}" oninput="window._prPeople[${i}].hours=this.value" placeholder="Hrs" style="width:80px">
      <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="prDelPerson(${i})">×</button>
    </div>`).join("")}
  </div>

  <div class="card">
    ${S(N(),"Issues, Delays & Risks")}
    <textarea rows="3" oninput="window._pr.issues=this.value" placeholder="${daily?"Obstructions, delays, missing materials, access problems…":"Open risks, delays and mitigation actions…"}" style="width:100%;margin-top:8px">${escapeHtml(m.issues||"")}</textarea>
    ${typeof tableToolbar==="function"?tableToolbar("_pr.issues"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._pr.issues):""}
  </div>

  <div class="card">
    ${S(N(), daily?"Plan for Tomorrow":"Plan for Next Week")}
    <textarea rows="3" oninput="window._pr.nextPlan=this.value" placeholder="Look-ahead activities…" style="width:100%;margin-top:8px">${escapeHtml(m.nextPlan||"")}</textarea>
    ${typeof tableToolbar==="function"?tableToolbar("_pr.nextPlan"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._pr.nextPlan):""}
  </div>

  <div class="card">
    ${S(N(),"HSE / Safety Notes")}
    <textarea rows="2" oninput="window._pr.hse=this.value" placeholder="Safety observations, incidents, toolbox talks…" style="width:100%;margin-top:8px">${escapeHtml(m.hse||"")}</textarea>
    ${typeof tableToolbar==="function"?tableToolbar("_pr.hse"):""}${typeof tablePreviewHTML==="function"?tablePreviewHTML(window._pr.hse):""}
  </div>

  <div class="card">
    ${S(N(),"Photos")} 
    <input type="file" accept="image/*" multiple onchange="prAddPhotos(this)" style="margin-top:8px">
    ${typeof planBlockHTML==="function"?planBlockHTML("_prPlans"):""}
    ${window._prPhotos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${window._prPhotos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="annoOpen('_prPhotos',${i})" title="Annotate" style="position:absolute;bottom:-6px;right:-6px;background:#03308B;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:10px;line-height:1">✎</button><button onclick="prDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:700">×</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card">
    ${S(N(),"Approval")}
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>EJAF Engineer</label><input value="${escapeHtml(m.engName||"")}" oninput="window._pr.engName=this.value" placeholder="Eng. …"></div>
      <div class="field"><label>Client approver</label><input value="${escapeHtml(m.repName||"")}" oninput="window._pr.repName=this.value" placeholder="Mr. …"></div>
      <div class="field"><label>Approver title</label><input value="${escapeHtml(m.repTitle||"")}" oninput="window._pr.repTitle=this.value" placeholder="e.g. Project Manager"></div>
    </div>
    ${signaturePad("pr_eng","EJAF engineer signature","The engineer signs here")}
    ${signaturePad("pr_rep","Client signature","Hand the device to the client representative")}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField==="function"?refOverrideField():""}${typeof brandLink==="function"?brandLink():""}${rptFormatToggle(true)}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%" onclick="generateProgressReport('${kind}')">${_fmtIcon()} Generate ${daily?"Daily":"Weekly"} Report (${_fmtName()})</button>
  </div>
  ${typeof srSaveBar==="function"?srSaveBar("prog"):""}
  ${typeof srSavedList==="function"?srSavedList("prog"):""}`;
}

window.generateProgressReport = async function(kind){
  const m=window._pr, daily=(kind==="daily");
  if(!m.project) return toast("⚠ Project is required");
  if(daily && !m.date)        return toast("⚠ Report date is required");
  if(!daily && (!m.from||!m.to)) return toast("⚠ Period (From / To) is required");
  if(!daily && m.to<m.from)   return toast("⚠ 'To' cannot be before 'From'");

  const tasks=window._prTasks.filter(t=>(t.desc||"").trim());
  const people=window._prPeople.filter(p=>(p.name||"").trim());
  const totH=tasks.reduce((s,t)=>s+Number(t.hours||0),0);
  const manH=people.reduce((s,p)=>s+Number(p.hours||0),0);
  const rag=PR_RAG[m.rag]||PR_RAG.Green;
  const period = daily ? fmtDate(m.date) : `${fmtDate(m.from)} → ${fmtDate(m.to)}`;
  const infoRow=(l,v)=>`<tr><td style="border:1px solid #ccc;background:#F0F4FA;padding:6px 10px;font-weight:700;font-size:11px;width:42%">${l}</td><td style="border:1px solid #ccc;padding:6px 10px;font-size:12px">${v||"&nbsp;"}</td></tr>`;
  const block=(t)=>`<div style="border:1px solid #ccc;border-radius:8px;padding:11px;font-size:12px;line-height:1.8;min-height:44px">${(t||"").trim() ? (typeof textWithTablesHTML==="function"?textWithTablesHTML(t,{dash:false}):`<div style="white-space:pre-wrap">${escapeHtml(String(t).trim())}</div>`) : "&nbsp;"}</div>`;
  let n=0; const K=()=>String(++n).padStart(2,"0");

  const bodyHTML=`${_fmPrintBar}
    <div style="border:1.5px solid #1B3A6B;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:18px;color:#03308B">${daily?"DAILY":"WEEKLY"} PROGRESS REPORT</div>
        <div style="font-size:12px;font-weight:700;color:${daily?"#2E5FA3":"#00695C"}">${escapeHtml(m.project)}</div>
      </div>
      <table style="border-collapse:collapse;font-size:11px">
        ${m.reference?`<tr><td style="padding:2px 8px;font-weight:700;color:#555">Reference</td><td style="padding:2px 8px">${escapeHtml(m.reference)}</td></tr>`:""}
        <tr><td style="padding:2px 8px;font-weight:700;color:#555">${daily?"Date":"Period"}</td><td style="padding:2px 8px">${period}</td></tr>
        ${!daily&&m.weekNo?`<tr><td style="padding:2px 8px;font-weight:700;color:#555">Week</td><td style="padding:2px 8px">${escapeHtml(m.weekNo)}</td></tr>`:""}
      </table>
    </div>

    <div class="ksec"><span class="kbad">${K()}</span><h3>Project Information</h3></div>
    <table style="border-collapse:collapse;width:100%">
      ${infoRow("Client",escapeHtml(m.client))}
      ${infoRow("Project",escapeHtml(m.project))}
      ${m.site?infoRow("Site / Area",escapeHtml(m.site)):""}
      ${m.contractNo?infoRow("Contract / PO",escapeHtml(m.contractNo)):""}
      ${daily&&m.weather?infoRow("Weather / conditions",escapeHtml(m.weather)):""}
      ${infoRow("Prepared by",escapeHtml(m.preparedBy))}
      ${m.representative?infoRow("Client representative",escapeHtml(m.representative)):""}
    </table>

    <div class="ksec"><span class="kbad">${K()}</span><h3>Scope of Work</h3></div>
    ${block(m.scope)}

    ${!daily?`<div class="ksec"><span class="kbad">${K()}</span><h3>Status &amp; Progress</h3></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:stretch;margin-bottom:10px">
      <div style="flex:1;min-width:120px;border:1px solid #ccc;border-left:5px solid ${rag[1]};border-radius:8px;padding:10px;background:${rag[0]}">
        <div style="font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.6px">Overall status</div>
        <div style="font-family:'DM Serif Display',serif;font-size:18px;color:${rag[1]}">${escapeHtml(m.rag)}</div>
        <div style="font-size:10px;color:#666">${rag[2]}</div>
      </div>
      ${(m.plannedPct!==""||m.actualPct!=="")?`
      <div style="flex:2;min-width:200px;border:1px solid #ccc;border-radius:8px;padding:10px">
        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:#666"><span>PLANNED</span><span>${m.plannedPct||0}%</span></div>
        <div style="height:8px;background:#E8EDF5;border-radius:4px;margin:3px 0 8px"><div style="height:100%;width:${Math.min(100,Number(m.plannedPct)||0)}%;background:#8FA8CC;border-radius:4px"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:#666"><span>ACTUAL</span><span>${m.actualPct||0}%</span></div>
        <div style="height:8px;background:#E8EDF5;border-radius:4px;margin:3px 0 6px"><div style="height:100%;width:${Math.min(100,Number(m.actualPct)||0)}%;background:linear-gradient(90deg,#C9A84C,#E9CC7A);border-radius:4px"></div></div>
        <div style="font-size:10px;font-weight:700;color:${(Number(m.actualPct)-Number(m.plannedPct))>=0?"#2E7D32":"#C62828"}">Variance: ${(Number(m.actualPct)-Number(m.plannedPct))>=0?"+":""}${(Number(m.actualPct)||0)-(Number(m.plannedPct)||0)}%</div>
      </div>`:""}
    </div>`:""}
    ${(m.summary||"").trim()?`<div class="ksec"><span class="kbad">${K()}</span><h3>Executive Summary</h3></div>
    ${block(m.summary)}`:""}

    <div class="ksec"><span class="kbad">${K()}</span><h3>${daily?"Work Performed":"Work Completed"} (${tasks.length})</h3></div>
    ${tasks.length?`<table><thead><tr><th style="width:34px">No.</th>${daily?"":"<th>Date</th>"}<th>Description</th><th>Location</th><th>By</th><th>Status</th><th style="width:52px">Hours</th></tr></thead>
    <tbody>${tasks.map((t,i)=>`<tr>
      <td style="text-align:center">${String(i+1).padStart(2,"0")}</td>
      ${daily?"":`<td style="white-space:nowrap;font-size:10px">${t.date?fmtDate(t.date):"—"}</td>`}
      <td style="font-size:11px">${escapeHtml(t.desc)}</td>
      <td style="font-size:10px">${escapeHtml(t.location||"—")}</td>
      <td style="font-size:10px">${escapeHtml(t.by||"—")}</td>
      <td style="font-size:10px">${escapeHtml(t.status||"—")}</td>
      <td style="text-align:right">${t.hours?fmtHM(Number(t.hours)):"—"}</td></tr>`).join("")}
      <tr><td colspan="${daily?5:6}" style="text-align:right;font-weight:700">Total</td><td style="text-align:right;font-weight:700">${fmtHM(totH)}</td></tr>
    </tbody></table>`:`<div style="color:#888;font-size:12px">No tasks recorded for this period.</div>`}

    ${people.length?`<div class="ksec"><span class="kbad">${K()}</span><h3>Manpower (${people.length})</h3></div>
    <table><thead><tr><th style="width:34px">No.</th><th>Name</th><th>Role / trade</th><th style="width:70px">Hours</th></tr></thead>
    <tbody>${people.map((p,i)=>`<tr><td style="text-align:center">${String(i+1).padStart(2,"0")}</td><td><strong>${escapeHtml(p.name)}</strong></td><td style="font-size:11px">${escapeHtml(p.role||"—")}</td><td style="text-align:right">${p.hours?fmtHM(Number(p.hours)):"—"}</td></tr>`).join("")}
      <tr><td colspan="3" style="text-align:right;font-weight:700">Total man-hours</td><td style="text-align:right;font-weight:700">${fmtHM(manH)}</td></tr>
    </tbody></table>`:""}

    <div class="ksec"><span class="kbad">${K()}</span><h3>Issues, Delays &amp; Risks</h3></div>
    ${block(m.issues)}

    <div class="ksec"><span class="kbad">${K()}</span><h3>${daily?"Plan for Tomorrow":"Plan for Next Week"}</h3></div>
    ${block(m.nextPlan)}

    ${(m.hse||"").trim()?`<div class="ksec"><span class="kbad">${K()}</span><h3>HSE / Safety</h3></div>${block(m.hse)}`:""}
    ${_rptPhotoGrid(window._prPhotos,"Site Photos")}
    ${typeof _rptPlanSheets==="function"?_rptPlanSheets(window._prPlans,"Site Plans"):""}

    ${sigAny(["pr_eng","pr_rep"])?`<div class="ksec"><span class="kbad">${K()}</span><h3>Approval</h3></div>
    ${sigRow([["pr_eng", m.engName||m.preparedBy||"Eng.", "Project / Technical Engineer", "EJAF Technology"],
              ["pr_rep", m.repName||m.representative||"Mr.", m.repTitle||"", m.client||""]])}`:""}
    <div style="margin-top:14px;border:1px solid #ddd;border-radius:8px;padding:10px 12px;display:flex;gap:14px;align-items:center">
      <div style="flex:1;font-size:10px;font-style:italic;color:#555;line-height:1.7">This progress report has been prepared by EJAF Technology for the period stated above as part of the project monitoring and control process.</div>
      <div style="font-size:9px;font-style:italic;font-weight:700;color:#333;white-space:nowrap;line-height:1.6">Reference Standards<br><span style="font-weight:500">ISO 21502:2020 §7.15 · PMBOK® Guide</span></div>
    </div>
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  await openReportPDF(daily?"DAILY_PROGRESS":"WEEKLY_PROGRESS",
    [period,m.client,m.project].filter(Boolean).join(" · "), bodyHTML,{project:(window._pr&&window._pr.project)||"",client:(window._pr&&window._pr.client)||""});
  toast(`${daily?"Daily":"Weekly"} report ready!`);
};
Object.assign(window,{renderProgressReport});

// ═══ FORCE UPDATE (v210) ════════════════════════════════════════════════
// The update banner depends on the browser noticing a new worker, that worker
// reaching "waiting", and the app being open at the right moment. Any of those
// can fail quietly — and then someone is stranded on an old build with no way
// out, which is exactly what happened. This button depends on none of them: it
// clears the caches, drops the workers and reloads, whatever any of them think.
window.forceUpdate = async function(){
  if(!await uiConfirm("Fetch the latest version now?\n\nThe app will close and reopen. Your data is safe \u2014 only the cached program files are replaced.")) return;
  toast("Updating\u2026");
  try{ localStorage.removeItem('girek-upd-skip'); }catch(e){}
  // A backstop nothing below can disarm.
  setTimeout(function(){ try{ window.location.reload(); }catch(e){} }, 6000);
  try{
    if(navigator.serviceWorker){
      const regs=await navigator.serviceWorker.getRegistrations();
      for(const r of regs){
        try{ if(r.waiting) r.waiting.postMessage('SKIP_WAITING'); }catch(e){}
        try{ await r.update(); }catch(e){}
      }
    }
  }catch(e){}
  try{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
  }catch(e){}
  try{
    if(navigator.serviceWorker){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister().catch(()=>{})));
    }
  }catch(e){}
  window.location.reload();
};
// The build actually running, so nobody has to infer it from behaviour.
// A single named constant, updated with every release, so the screen can state
// the build without inferring it from a variable that lives inside a function.
const APP_BUILD = "v258";
window.APP_BUILD = APP_BUILD;
window.runningVersion = function(){ return APP_BUILD; };
