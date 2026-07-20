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
  const dailyFiltered = state.daily.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF || r.project===projF));
  const otFiltered = state.overtime.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF || r.project===projF));
  const trFiltered = state.travel.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF || r.project===projF));
  const lvFiltered = state.leaves.filter(r=>leaveInRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r));

  // Stats per department
  const deptStats = state.departments.map(d=>{
    const dHours = dailyFiltered.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.duration||0),0);
    const dCount = dailyFiltered.filter(r=>r.dept===d.name).length;
    const otHours = otFiltered.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.hours||0),0);
    return {...d, hours: dHours, count: dCount, otHours};
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
  let h=`<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;border:2px solid #C9A84C;position:relative;overflow:hidden">
    <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,#C9A84C22,transparent);border-radius:50%"></div>
    <div style="display:flex;align-items:center;gap:14px;position:relative">
      <div style="width:56px;height:56px;border:2px solid #C9A84C;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#1B3A6B">
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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> Filter Period</div>
    <div class="form-grid">
      <div class="field"><label>From Date</label>
        <input type="date" value="${f.from}" onchange="window.setReportFrom(this.value)"></div>
      <div class="field"><label>To Date</label>
        <input type="date" value="${f.to}" onchange="window.setReportTo(this.value)"></div>
    </div>
    <div class="field" style="margin-top:10px">
      <label>Filter by Project</label>
      <select onchange="state.reportFilter.project=this.value;render()" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;font-size:13px">
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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">02</span> Executive Summary</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:10px">
      <div style="border:1px solid var(--line);border-left:4px solid #2E5FA3;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Total Hours</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#2E5FA3;margin-top:2px">${fmtHM(totH)}</div>
        <div style="font-size:10px;color:var(--muted)">${dailyFiltered.length} sessions</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #E65100;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Overtime</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#E65100;margin-top:2px">${fmtHM(totOT)}</div>
        <div style="font-size:10px;color:var(--muted)">${otFiltered.length} entries</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #2E7D32;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Travel Days</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#2E7D32;margin-top:2px">${fmtDays(totTr)}</div>
        <div style="font-size:10px;color:var(--muted)">${trFiltered.length} trips</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #6A1B9A;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Per Diem</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#6A1B9A;margin-top:2px">${fmtMoney(totPD)}</div>
        <div style="font-size:10px;color:var(--muted)">IQD total</div>
      </div>
      <div style="border:1px solid var(--line);border-left:4px solid #C62828;border-radius:8px;padding:12px;background:white">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;letter-spacing:1px">Leave Days</div>
        <div style="font-family:'DM Serif Display',serif;font-size:22px;color:#C62828;margin-top:2px">${fmtDays(totLv)}</div>
        <div style="font-size:10px;color:var(--muted)">${lvFiltered.length} entries</div>
      </div>
    </div>
  </div>`;

  // ═══════ DEPARTMENT PERFORMANCE (Section 03) ═══════
  h+=`<div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">03</span> Department Performance</div>
    ${deptStats.length===0?`<div class="empty">No departments defined yet</div>`:`
    <div style="display:grid;gap:10px;margin-top:10px">
      ${deptStats.map(d=>{
        const pct = totalHours>0 ? (d.hours/totalHours*100) : 0;
        return `<div style="border:1px solid var(--line);border-left:5px solid ${d.color};border-radius:10px;padding:12px 14px;background:white">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <strong style="color:${d.color};font-size:14px">${escapeHtml(d.name)}</strong>
            <span style="font-family:'DM Serif Display',serif;font-size:18px;color:${d.color}">${fmtHM(d.hours)}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${d.count} entries · ${fmtHM(d.otHours)} OT · ${pct.toFixed(1)}% of total</div>
          <div style="height:6px;background:#F0F0F0;border-radius:3px;overflow:hidden"><div style="height:100%;background:${d.color};width:${pct}%;transition:width 0.4s"></div></div>
        </div>`;
      }).join("")}
    </div>`}
  </div>`;

  // ═══════ EMPLOYEE TABLE (Section 04) ═══════
  if(!isEmployee()){
    h+=`<div class="card">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">04</span> Employee Breakdown</div>
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
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">🔖</span> Project Code Breakdown</div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Project</th><th>Code</th><th>Sessions</th><th>Hours</th></tr></thead><tbody>
        ${rowsC.map(([k,v])=>{const i3=k.indexOf("|||");const p=k.slice(0,i3),c=k.slice(i3+3);
          return `<tr><td>${escapeHtml(p)}</td><td><span style="font-size:10px;background:${isPMc(c)?'#FFF3E0':'#F0F4FF'};color:${isPMc(c)?'#E65100':'#03308B'};padding:2px 8px;border-radius:9px;font-weight:800">${escapeHtml(c)}</span></td><td style="font-weight:800">${v.n}</td><td style="font-weight:800;color:#1B3A6B">${fmtHM(v.m)}</td></tr>`;}).join("")}
        </tbody></table></div>
      <p style="font-size:10px;color:var(--muted);margin-top:6px">Sessions = number of work-log entries tagged with the code — e.g. how many visits a maintenance round took.</p>
      </div>`;
    }
  }

  // ═══════ EXPORT BUTTONS (admin/HR, or granted canExport) ═══════
  if(isAdmin()||isHR()||hasCap("canExport")) h+=`<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;border:2px solid #C9A84C">
    <div class="sec-hdr" style="color:#C9A84C;border:none;display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">📤</span> Export Options</div>
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
    const dr = state.daily.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF||r.project===projF));
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
      setCell(ws1,`A${row}`,d.name,{...empNameStyle(alt),font:{bold:true,sz:11,color:{rgb:d.color.replace('#','')}}});
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

    const trData = tr.map(r=>[employeePlainBadge(r.employee||''),r.date||'',r.days||0,r.project||'',r.location||'',r.perDiem||0,(r.perDiemStatus||'received')==='received'?'Received':'Not Received',r.notes||'']);
    const wsT = buildDetail('Travel Log', ['Employee','Date','Days','Project','Location','Per Diem','Per Diem Status','Notes'], trData, COLORS.green);
    wsT['!cols']=[{wch:26},{wch:12},{wch:8},{wch:26},{wch:16},{wch:14},{wch:16},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsT, 'Travel');

    const lvData = lv.map(r=>{
      const lt = (typeof leaveTypeInfo==='function') ? leaveTypeInfo(r.type) : {label:r.type||''};
      return [employeePlainBadge(r.employee||''), lt.label||r.type||'', r.from||'', r.to||'', r.days||0, r.notes||''];
    });
    const wsL = buildDetail('Leaves Log', ['Employee','Type','From','To','Days','Notes'], lvData, COLORS.red);
    wsL['!cols']=[{wch:26},{wch:18},{wch:12},{wch:12},{wch:8},{wch:30}];
    XLSX.utils.book_append_sheet(wb, wsL, 'Leaves');

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
    const dr = state.daily.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && _reportRowOK(r) && (!projF||r.project===projF));
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
      return `<div class="dept-card" style="border-left-color:${d.color}">
        <div class="dept-row"><span class="dept-name" style="color:${d.color}">${escapeHtml(d.name)}</span><span class="dept-val" style="color:${d.color}">${fmtHM(d.hours)}</span></div>
        <div class="dept-sub">${d.count} entries · ${fmtHM(d.otHours)} OT · ${pct}% of total</div>
        <div class="bar"><div class="bar-fill" style="background:${d.color};width:${pct}%"></div></div>
      </div>`;
    }).join('');

    // Employee summary table
    const deptHeaders = state.departments.map(d=>`<th style="border-bottom:3px solid ${d.color}">${escapeHtml(d.name.slice(0,10))}</th>`).join('');
    const empRows = empStats.map(r=>`<tr>
      <td><strong style="color:#1B3A6B">${escapeHtml(r.emp)}</strong></td>
      ${state.departments.map(d=>`<td style="color:${d.color};font-weight:700">${fmtHM(r.byDept[d.name]||0)}</td>`).join('')}
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

    const rangeLabel=`${f.from||'Start'} → ${f.to||'Today'}${f.project?' · Project: '+f.project:''}`;
    const kpiCardsU=`<div class="kr">
      <div class="kc kb"><div class="kl">Total Hours</div><div class="kv">${fmtHM(totH)}</div><div class="ks">${dr.length} sessions</div></div>
      <div class="kc ko"><div class="kl">Overtime</div><div class="kv">${fmtHM(totOT)}</div><div class="ks">${or.length} entries</div></div>
      <div class="kc kg"><div class="kl">Travel Days</div><div class="kv">${fmtDays(totTr)}</div><div class="ks">${tr.length} trips</div></div>
      <div class="kc kp"><div class="kl">Per Diem</div><div class="kv">${fmtMoney(totPD)}</div><div class="ks">IQD total</div></div>
      <div class="kc krd"><div class="kl">Leave Days</div><div class="kv">${fmtDays(totLv)}</div><div class="ks">${lv.length} entries</div></div>
    </div>`;
    const bodyHTMLF=`
      <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
        📄 Choose <strong>"Save as PDF"</strong> in the print dialog
        <br><br><button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
        <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
      </div>
      <div class="ksec"><span class="kbad">01</span><h3>Executive Summary</h3></div>
      ${kpiCardsU}
      <div class="ksec"><span class="kbad">02</span><h3>Department Performance</h3></div>
      ${deptBlocks||'<div class="empty">No departments configured</div>'}
      ${!isEmployee()?`<div class="ksec"><span class="kbad">03</span><h3>Employee Breakdown</h3></div>
      <table><thead><tr><th>Employee</th>${deptHeaders}<th>Total</th><th>OT</th><th>Travel</th><th>Per Diem</th><th>Leave</th></tr></thead>
      <tbody>${empRows}</tbody><tfoot>${grandRow}</tfoot></table>`:''}
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
        fill:{fgColor:{rgb: d.color.replace('#','')}}
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
        setCell(ws1, `${col}${rowNum}`, fmtHM(hrs), deptStyle(d.color, alt));
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
    const trData = tRows.map(r=>[r.employee||'', r.date||'', r.days||0, r.project||'', r.dept||'', r.location||'', r.perDiem||0, (r.perDiemStatus||'received')==='received'?'Received':'Not Received', r.notes||'']);
    const ws4 = buildDetailSheet('Travel Log', ['Employee','Date','Days','Project','Department','Location','Per Diem (IQD)','Per Diem Status','Notes'], trData, '#'+COLORS.green);
    ws4['!cols']=[{wch:22},{wch:12},{wch:8},{wch:26},{wch:14},{wch:14},{wch:16},{wch:16},{wch:30}];
    XLSX.utils.book_append_sheet(wb, ws4, 'Travel');

    // Leaves sheet
    const lRows = applyReportFilters(isHR() ? state.leaves : state.leaves.filter(r=>r.employee===state.profile.employeeName), "from");
    const lvData = lRows.map(r=>{
      const lt = (typeof leaveTypeInfo==='function') ? leaveTypeInfo(r.type) : {label:r.type||''};
      return [r.employee||'', lt.label||r.type||'', r.from||'', r.to||'', r.days||0, r.notes||''];
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
        setCell(ws5,`A${r}`,d.name,{...empNameStyle(alt),font:{bold:true,sz:11,color:{rgb:d.color.replace('#','')}}});
        setCell(ws5,`B${r}`,'',{...cellStyle(alt),fill:{fgColor:{rgb:d.color.replace('#','')}}});
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
        const col=d?d.color:'#6B7B8F';
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
        <span style="width:14px;height:14px;border-radius:3px;background:${color};display:inline-block"></span>
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
          <div style="height:3px;background:#E0E8F0;border-radius:2px;overflow:hidden">
            <div style="height:100%;background:${d.color};width:${bw}%"></div>
          </div>
        </div>`;
      }).join('');
      return `<div style="border:1px solid #D6E4F0;border-radius:10px;overflow:hidden;margin-bottom:14px;page-break-inside:avoid">
        <div style="background:linear-gradient(135deg,${d.color},${d.color}DD);color:white;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-size:13px;font-weight:800;text-transform:uppercase">${escapeHtml(d.name)}</h3>
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:700">${fmtHM(tot)}</span>
        </div>
        <div style="background:white">${rows}</div>
      </div>`;
    }).join('');

    const tLeave = s.reduce((a,b)=>a+(b.leaveDays||0),0);

    // KPI cards (5 columns now including leaves)
    const kpis = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:16px">
      <div style="background:white;border-left:4px solid #2E5FA3;border-radius:8px;padding:10px 11px">
        <div style="font-size:8px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Total Hours</div>
        <div style="font-family:Georgia,serif;font-size:17px;color:#2E5FA3;font-weight:700">${fmtHM(tHrs)}</div>
        <div style="font-size:8px;color:#6B7B8F">${applyReportFilters(state.daily).length} sessions</div>
      </div>
      <div style="background:white;border-left:4px solid #E65100;border-radius:8px;padding:10px 11px">
        <div style="font-size:8px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Overtime</div>
        <div style="font-family:Georgia,serif;font-size:17px;color:#E65100;font-weight:700">${fmtHM(tOT)}</div>
        <div style="font-size:8px;color:#6B7B8F">${applyReportFilters(state.overtime).length} entries</div>
      </div>
      <div style="background:white;border-left:4px solid #2E7D32;border-radius:8px;padding:10px 11px">
        <div style="font-size:8px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Travel</div>
        <div style="font-family:Georgia,serif;font-size:17px;color:#2E7D32;font-weight:700">${tTr}</div>
        <div style="font-size:8px;color:#6B7B8F">${applyReportFilters(state.travel).length} trips</div>
      </div>
      <div style="background:white;border-left:4px solid #6A1B9A;border-radius:8px;padding:10px 11px">
        <div style="font-size:8px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Per Diem</div>
        <div style="font-family:Georgia,serif;font-size:17px;color:#6A1B9A;font-weight:700">${fmtMoney(tPD)}</div>
        <div style="font-size:8px;color:#6B7B8F">IQD total</div>
      </div>
      <div style="background:white;border-left:4px solid #C62828;border-radius:8px;padding:10px 11px">
        <div style="font-size:8px;color:#6B7B8F;text-transform:uppercase;letter-spacing:0.8px;font-weight:600">Leave Days</div>
        <div style="font-family:Georgia,serif;font-size:17px;color:#C62828;font-weight:700">${tLeave}</div>
        <div style="font-size:8px;color:#6B7B8F">${applyReportFilters(state.leaves,"from").length} entries</div>
      </div>
    </div>`;

    // Build body using universal template
    const totalLeaveDays = s.reduce((a,b)=>a+(b.leaveDays||0),0);
    const dashBodyHTML=`
      <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
        📄 Choose <strong>"Save as PDF"</strong> in the print dialog
        <br><br><button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
        <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
      </div>
      <div class="ksec"><span class="kbad">01</span><h3>Executive Summary</h3></div>
      <div class="kr">
        <div class="kc kb"><div class="kl">Total Hours</div><div class="kv">${fmtHM(tHrs)}</div><div class="ks">${applyReportFilters(state.daily).length} sessions</div></div>
        <div class="kc ko"><div class="kl">Overtime</div><div class="kv">${fmtHM(tOT)}</div><div class="ks">${applyReportFilters(state.overtime).length} entries</div></div>
        <div class="kc kg"><div class="kl">Travel Days</div><div class="kv">${tTr}</div><div class="ks">${applyReportFilters(state.travel).length} trips</div></div>
        <div class="kc kp"><div class="kl">Per Diem</div><div class="kv">${fmtMoney(tPD)}</div><div class="ks">IQD total</div></div>
        <div class="kc krd"><div class="kl">Leave Days</div><div class="kv">${fmtDays(totalLeaveDays)}</div><div class="ks">${applyReportFilters(state.leaves,"from").length} entries</div></div>
      </div>
      ${!isEmployee()?`<div class="ksec"><span class="kbad">02</span><h3>Employee Hours Distribution</h3></div>
      <div style="display:flex;align-items:center;gap:20px;margin:10px 0">
        ${donutSVG}
        <div style="flex:1">${legendHTML}</div>
      </div>`:''}
      <div class="ksec"><span class="kbad">${!isEmployee()?'03':'02'}</span><h3>Department Performance</h3></div>
      ${deptBlocks||'<div class="empty">No departments configured</div>'}
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
              btn.textContent='Updating…'; btn.disabled=true;
              var fired=false;
              function go(){ if(fired)return; fired=true; window.location.reload(); }
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
          document.getElementById('updX').addEventListener('click',function(){ bar.remove(); });
        }catch(err){}
      }
      // already-downloaded update from a previous visit
      if(reg.waiting && navigator.serviceWorker.controller) showUpdateBar();
      // update found during this session
      reg.addEventListener('updatefound', function(){
        var nw=reg.installing;
        if(!nw) return;
        nw.addEventListener('statechange', function(){
          if(nw.state==='installed' && navigator.serviceWorker.controller) showUpdateBar();
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
      var swCode = "const CACHE='ejaftech-v132';"
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
const _rptBadge=(t,bg,fg)=>`<span style="background:${bg};color:${fg};padding:2px 10px;border-radius:9px;font-size:10px;font-weight:800">${escapeHtml(t||"—")}</span>`;

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
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
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
    <div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(window._pmRptDesc.trim())}</div>`:""}
    ${_rptPhotoGrid(window._pmRptPhotos,"Maintenance Photos")}
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  const period=(from||to)?`${from||"start"} → ${to||"today"}`:"All time";
  await openReportPDF("PREVENTIVE_MAINTENANCE", [period,proj,sys].filter(Boolean).join(" · "), bodyHTML);
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
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Incident Overview</h3></div>
    <div style="font-family:'DM Serif Display',serif;font-size:19px;color:#03308B;margin:4px 0 8px">${escapeHtml(i.title)}</div>
    <div style="margin-bottom:10px">${_rptBadge(i.severity,sev[0],sev[1])} &nbsp; ${_rptBadge(i.status,st[0],st[1])}</div>
    <table style="border-collapse:collapse;width:100%"><tbody>
      <tr>${cell("Incident date",fmtDate(i.date)+(i.time?" · "+i.time:""))}${cell("Project",escapeHtml(i.project))}${cell("System",escapeHtml(i.system||"Whole project"))}</tr>
      <tr>${cell("Area",escapeHtml(i.area))}${cell("Site",escapeHtml(i.site))}${cell("Device",dev?escapeHtml([dev.deviceName,dev.model,dev.serialNumber].filter(Boolean).join(" · ")):escapeHtml(i.deviceSerial||"—"))}</tr>
      <tr>${cell("Work started",i.startDate?fmtDate(i.startDate):"—")}${cell("Work finished",i.endDate?fmtDate(i.endDate):"—")}${cell("Reported by",escapeHtml(i.reportedBy||"—"))}</tr>
    </tbody></table>
    <div class="ksec"><span class="kbad">02</span><h3>Description</h3></div>
    <div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(i.description||"—")}</div>
    <div class="ksec"><span class="kbad">03</span><h3>Action Taken</h3></div>
    <div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(i.actionTaken||"—")}</div>
    ${_rptPhotoGrid(i.photos,"Incident Photos")}
    ${i.notes?`<div class="ksec"><span class="kbad">📝</span><h3>Notes</h3></div><div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(i.notes)}</div>`:""}
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  await openReportPDF("INCIDENT", `${fmtDate(i.date)} · ${i.project||""}${i.system?" · "+i.system:""}`, bodyHTML);
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

function _rptHero(icon,title,sub,grad){
  return `<div class="card" style="background:${grad};color:#fff;padding:18px 16px">
    <div style="font-family:'DM Serif Display',serif;font-size:22px">${icon} ${title}</div>
    <div style="font-size:11.5px;opacity:.85">${sub}</div>
  </div>`;
}

function _rptModeSeg(varName,mode){
  return `<div class="card" style="padding:10px 12px"><div style="display:flex;gap:6px">
    <button class="btn ${mode!=="manual"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window.${varName}='records';render()">📊 From records</button>
    <button class="btn ${mode==="manual"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="window.${varName}='manual';render()">✍️ Manual entry</button>
  </div></div>`;
}
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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> Scope</div>
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
      <div style="flex:1;min-width:110px;border:1px solid var(--line);border-left:4px solid #2E5FA3;border-radius:8px;padding:10px;background:var(--card,#fff)"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Schedules</div><div style="font-family:'DM Serif Display',serif;font-size:20px;color:#2E5FA3">${scope.length}</div></div>
      <div style="flex:1;min-width:110px;border:1px solid var(--line);border-left:4px solid #2E7D32;border-radius:8px;padding:10px;background:var(--card,#fff)"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Rounds in period</div><div style="font-family:'DM Serif Display',serif;font-size:20px;color:#2E7D32">${rounds}</div></div>
      <div style="flex:1;min-width:110px;border:1px solid var(--line);border-left:4px solid #C62828;border-radius:8px;padding:10px;background:var(--card,#fff)"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Overdue</div><div style="font-family:'DM Serif Display',serif;font-size:20px;color:#C62828">${overdue}</div></div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">02</span> Work Description</div>
    <textarea rows="4" oninput="window._pmRptDesc=this.value" placeholder="What was performed in this maintenance round — cleaning, tests, replaced parts, findings… (appears in the PDF)" style="width:100%;margin-top:8px">${escapeHtml(window._pmRptDesc)}</textarea>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">03</span> Photos <span style="font-size:10px;color:var(--muted);font-weight:500">(optional · max 12 · embedded in the PDF)</span></div>
    <input type="file" accept="image/*" multiple onchange="pmRptAddPhotos(this)" style="margin-top:8px">
    ${photos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${photos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="pmRptDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:800">×</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none;width:100%" onclick="generatePMReport()">📄 Generate PM Report (PDF)</button>
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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> Pick Incident</div>
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
    ${sel?`<div style="margin-top:12px;border:1.5px solid #C9A84C;border-radius:10px;padding:12px;background:var(--card,#fff)">
      <div style="font-weight:800;font-size:14px;color:#1B3A6B">${escapeHtml(sel.title)}</div>
      <div style="margin:6px 0">
        <span style="background:${(sev[sel.severity]||["#EEE","#555"])[0]};color:${(sev[sel.severity]||["#EEE","#555"])[1]};padding:2px 10px;border-radius:9px;font-size:10px;font-weight:800">${escapeHtml(sel.severity||"—")}</span>
        <span style="background:${(st[sel.status]||["#EEE","#555"])[0]};color:${(st[sel.status]||["#EEE","#555"])[1]};padding:2px 10px;border-radius:9px;font-size:10px;font-weight:800">${escapeHtml(sel.status||"Open")}</span>
        ${sel.system?`<span style="background:#E0F2F1;color:#00695C;padding:2px 10px;border-radius:9px;font-size:10px;font-weight:800">${escapeHtml(sel.system)}</span>`:""}
      </div>
      <div style="font-size:11.5px;color:var(--muted)">${fmtDate(sel.date)}${sel.time?" · "+sel.time:""} · ${escapeHtml(sel.project||"")}${sel.area?" › "+escapeHtml(sel.area):""}${sel.site?" › "+escapeHtml(sel.site):""}${sel.deviceSerial?" · 📟 "+escapeHtml(sel.deviceSerial):""} · 📷 ${(sel.photos||[]).length}</div>
    </div>`:""}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none;width:100%" onclick="generateIncidentReport()">📄 Generate Incident Report (PDF)</button>
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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> Details</div>
    <div class="form-grid" style="margin-top:10px">
      ${_syncSel("📁 Project",_projNames(),"window._pmMan.project","window._pmMan.projectOther",m.project,m.projectOther,"e.g. Asiacell SLA")}
      ${_syncSel("🧩 System",_sysNames(),"window._pmMan.system","window._pmMan.systemOther",m.system,m.systemOther,"e.g. CCTV")}
      ${_mfield("From","window._pmMan.from",m.from,"","date")}
      ${_mfield("To","window._pmMan.to",m.to,"","date")}
    </div>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">02</span> Maintenance Works <span style="font-size:10px;color:var(--muted);font-weight:500">(${items.length})</span></div>
    ${items.map((it,i)=>`<div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap">
      <input type="date" value="${it.date||""}" onchange="window._pmManItems[${i}].date=this.value" style="width:135px">
      <input value="${escapeHtml(it.text||"")}" oninput="window._pmManItems[${i}].text=this.value" placeholder="Work performed…" style="flex:2;min-width:150px">
      <input value="${escapeHtml(it.by||"")}" oninput="window._pmManItems[${i}].by=this.value" placeholder="By" style="flex:1;min-width:90px">
      <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="pmManDelItem(${i})">×</button>
    </div>`).join("")}
    <button class="btn btn-sm btn-secondary" style="margin-top:10px" onclick="pmManAddItem()">+ Add work item</button>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">03</span> Description</div>
    <textarea rows="4" oninput="window._pmMan.desc=this.value" placeholder="Overall summary — findings, recommendations… (appears in the PDF)" style="width:100%;margin-top:8px">${escapeHtml(m.desc||"")}</textarea>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">04</span> Photos <span style="font-size:10px;color:var(--muted);font-weight:500">(max 12)</span></div>
    <input type="file" accept="image/*" multiple onchange="pmRptAddPhotos(this)" style="margin-top:8px">
    ${photos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${photos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="pmRptDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:800">×</button></div>`).join("")}
    </div>`:""}
  </div>
  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none;width:100%" onclick="generatePMReport()">📄 Generate PM Report (PDF)</button>
  </div>`;
}

async function _generatePMManual(){
  const m=window._pmMan, items=(window._pmManItems||[]).filter(x=>(x.text||"").trim());
  if(!m.project.trim()) return toast("⚠ Project name is required");
  const bodyHTML=`
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 Choose <strong>"Save as PDF"</strong> in the print dialog<br><br>
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Summary — ${escapeHtml(m.project)}${m.system?` · ${escapeHtml(m.system)}`:""}</h3></div>
    <div class="kr">
      <div class="kc kb"><div class="kl">Project</div><div class="kv" style="font-size:15px">${escapeHtml(m.project)}</div><div class="ks">${escapeHtml(m.system||"—")}</div></div>
      <div class="kc kg"><div class="kl">Works Performed</div><div class="kv">${items.length}</div><div class="ks">maintenance items</div></div>
      <div class="kc ko"><div class="kl">Period</div><div class="kv" style="font-size:13px">${m.from||"—"}</div><div class="ks">→ ${m.to||"—"}</div></div>
    </div>
    ${items.length?`<div class="ksec"><span class="kbad">02</span><h3>Maintenance Works</h3></div>
    <table><thead><tr><th>Date</th><th>Work performed</th><th>By</th></tr></thead>
    <tbody>${items.map(it=>`<tr><td style="white-space:nowrap">${it.date?fmtDate(it.date):"—"}</td><td>${escapeHtml(it.text)}</td><td>${escapeHtml(it.by||"—")}</td></tr>`).join("")}</tbody></table>`:""}
    ${(m.desc||"").trim()?`<div class="ksec"><span class="kbad">03</span><h3>Description</h3></div>
    <div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(m.desc.trim())}</div>`:""}
    ${_rptPhotoGrid(window._pmRptPhotos,"Maintenance Photos")}
    <script>setTimeout(()=>window.print(),500)<\/script>`;
  const period=(m.from||m.to)?`${m.from||"start"} → ${m.to||"today"}`:"Manual";
  await openReportPDF("PREVENTIVE_MAINTENANCE",[period,m.project,m.system].filter(Boolean).join(" · "),bodyHTML);
  toast("PM Report ready!");
}

function _incManualLayout(){
  const m=window._incMan, photos=window._incManPhotos;
  const sevs=["Low","Medium","High","Critical"], sts=["Open","Investigating","Resolved","Closed"];
  return `
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> Incident Details</div>
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
        <textarea rows="3" oninput="window._incMan.description=this.value" placeholder="What happened…">${escapeHtml(m.description||"")}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>🛠️ Action taken</label>
        <textarea rows="3" oninput="window._incMan.actionTaken=this.value" placeholder="Diagnosis, fix…">${escapeHtml(m.actionTaken||"")}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>📷 Photos <span style="font-size:10px;color:var(--muted)">(max 6)</span></label>
        <input type="file" accept="image/*" multiple onchange="incManAddPhotos(this)">
        ${photos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          ${photos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="incManDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:800">×</button></div>`).join("")}
        </div>`:""}
      </div>
    </div>
  </div>
  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none;width:100%" onclick="generateIncidentReport()">📄 Generate Incident Report (PDF)</button>
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
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Incident Overview</h3></div>
    <div style="font-family:'DM Serif Display',serif;font-size:19px;color:#03308B;margin:4px 0 8px">${escapeHtml(i.title)}</div>
    <div style="margin-bottom:10px">${_rptBadge(i.severity,sev[0],sev[1])} &nbsp; ${_rptBadge(i.status,st[0],st[1])}</div>
    <table style="border-collapse:collapse;width:100%"><tbody>
      <tr>${cell("Incident date",(i.date?fmtDate(i.date):"—")+(i.time?" · "+i.time:""))}${cell("Project",escapeHtml(i.project))}${cell("System",escapeHtml(i.system||"Whole project"))}</tr>
      <tr>${cell("Area",escapeHtml(i.area))}${cell("Site",escapeHtml(i.site))}${cell("Device",escapeHtml(i.device||"—"))}</tr>
      <tr>${cell("Work started",i.startDate?fmtDate(i.startDate):"—")}${cell("Work finished",i.endDate?fmtDate(i.endDate):"—")}${cell("Reported by",escapeHtml(i.reportedBy||"—"))}</tr>
    </tbody></table>
    <div class="ksec"><span class="kbad">02</span><h3>Description</h3></div>
    <div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(i.description||"—")}</div>
    <div class="ksec"><span class="kbad">03</span><h3>Action Taken</h3></div>
    <div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(i.actionTaken||"—")}</div>
    ${_rptPhotoGrid(i.photos,"Incident Photos")}
    <script>setTimeout(()=>window.print(),500)<\/script>`;
  await openReportPDF("INCIDENT",[i.date?fmtDate(i.date):"Manual",i.project,i.system].filter(Boolean).join(" · "),bodyHTML);
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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">02</span> Cylinders <span style="font-size:10px;color:var(--muted);font-weight:500">(${cyls.length}) · net agent & fill density auto-computed</span></div>
    ${cyls.map((c,i)=>`<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-top:10px;background:var(--card,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:11px;font-weight:800;color:#B71C1C">🧯 CYLINDER ${i+1}${_fmNet(c)!==""?` · net ${_fmNet(c)} kg${_fmDens(c)!==""?` · ${_fmDens(c)} kg/L`:""}`:""}</span>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="fmDelCyl(${i})">×</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Serial No.</label><input value="${escapeHtml(c.serial||"")}" oninput="window._fmCyls[${i}].serial=this.value"></div>
        <div class="field"><label>Type / Model</label><input value="${escapeHtml(c.type||"")}" oninput="window._fmCyls[${i}].type=this.value" placeholder="e.g. 106L welded"></div>
        <div class="field"><label>Capacity (L)</label><input type="number" step="0.1" value="${c.capL||""}" oninput="window._fmCyls[${i}].capL=this.value"></div>
        <div class="field"><label>Tare wt (kg)</label><input type="number" step="0.01" value="${c.tare||""}" onchange="window._fmCyls[${i}].tare=this.value;render()"></div>
        <div class="field"><label>Gross wt (kg)</label><input type="number" step="0.01" value="${c.gross||""}" onchange="window._fmCyls[${i}].gross=this.value;render()"></div>
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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> General Information</div>
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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">03</span> System Information</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>Panel Manufacturer</label><input value="${escapeHtml(m.panelMfr||"")}" oninput="window._fm.panelMfr=this.value" placeholder="e.g. UK"></div>
      <div class="field"><label>Model</label><input value="${escapeHtml(m.panelModel||"")}" oninput="window._fm.panelModel=this.value" placeholder="e.g. Zeta premier EX Pro"></div>
      <div class="field"><label>Cylinder Model</label><input value="${escapeHtml(m.cylModel||"")}" oninput="window._fm.cylModel=this.value" placeholder="e.g. AKRONEX"></div>
      <div class="field"><label>FM200 Clean Agent Weight</label><input value="${escapeHtml(m.agentWt||"")}" oninput="window._fm.agentWt=this.value" placeholder="e.g. 20 Kg"></div>
      <div class="field"><label>Installation Date</label><input type="date" value="${m.installDate||""}" onchange="window._fm.installDate=this.value"></div>
      <div class="field"><label>Reference</label><input value="${escapeHtml(m.reference||"")}" oninput="window._fm.reference=this.value" placeholder="e.g. #S03890"></div>
      <div class="field"><label>🕐 Test Time</label><input type="time" value="${m.time||""}" onchange="window._fm.time=this.value"></div>
      <div class="field"><label>👤 Client Representative</label><input value="${escapeHtml(m.representative||"")}" oninput="window._fm.representative=this.value"></div>
    </div>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">04</span> Check List Report</div>
    ${FM_CHK_ITEMS.map(([k,label],i)=>`<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
      <div style="width:26px;font-size:11px;font-weight:800;color:var(--muted)">${String(i+1).padStart(2,"0")}</div>
      <div style="flex:2;min-width:180px;font-size:12px">${label}</div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm ${window._fmChk[k].s==="Pass"?"":"btn-secondary"}" style="${window._fmChk[k].s==="Pass"?"background:#2E7D32;color:#fff;border:none;":""}font-weight:800" onclick="window._fmChk['${k}'].s='Pass';render()">PASS</button>
        <button class="btn btn-sm ${window._fmChk[k].s==="Fail"?"":"btn-secondary"}" style="${window._fmChk[k].s==="Fail"?"background:#C62828;color:#fff;border:none;":""}font-weight:800" onclick="window._fmChk['${k}'].s='Fail';render()">FAIL</button>
      </div>
    </div>`).join("")}
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">05</span> Result of Test</div>
    <textarea rows="4" oninput="window._fm.resultText=this.value" placeholder="e.g. System health for the FM200 infrastructure is verified as optimal. No trouble states, discharge events, or system degradation have been logged…" style="width:100%;margin-top:8px">${escapeHtml(m.resultText||"")}</textarea>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">06</span> Report Approval</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>EJAF Engineer name</label><input value="${escapeHtml(m.engName||"")}" oninput="window._fm.engName=this.value" placeholder="Eng. …"></div>
      <div class="field"><label>Client approver name</label><input value="${escapeHtml(m.repName||"")}" oninput="window._fm.repName=this.value" placeholder="Mr. …"></div>
      <div class="field"><label>Client approver title</label><input value="${escapeHtml(m.repTitle||"")}" oninput="window._fm.repTitle=this.value" placeholder="e.g. IT Manager"></div>
    </div>
  </div>`:""}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">${fv==="test"?"07":"03"}</span> Notes / Recommendations</div>
    <textarea rows="3" oninput="window._fm.notes=this.value" placeholder="Observations, recommendations… (appears in the PDF)" style="width:100%;margin-top:8px">${escapeHtml(m.notes||"")}</textarea>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">${fv==="test"?"08":"04"}</span> Photos <span style="font-size:10px;color:var(--muted);font-weight:500">(max 12)</span></div>
    <input type="file" accept="image/*" multiple onchange="fmAddPhotos(this)" style="margin-top:8px">
    ${photos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${photos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="fmDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:800">×</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none;width:100%" onclick="${fv==="test"?"generateFM200Test()":"generateFM200Refill()"}">📄 Generate ${fv==="test"?"Test":"Refilling"} Report (PDF)</button>
  </div>`;
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
  <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
</div>`;
const _fmStdBanner=`<div style="background:#FDECEA;border:1px solid #F5C6C0;border-radius:8px;padding:8px 12px;margin:10px 0;font-size:10.5px;color:#7F1D1D">
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
    <div style="font-size:12px;line-height:1.7;white-space:pre-wrap">${escapeHtml(m.notes.trim())}</div>`:""}
    ${_rptPhotoGrid(window._fmPhotos,"Photos")}
    <div style="margin-top:26px;display:flex;gap:40px">
      <div style="flex:1;border-top:1.5px solid #333;padding-top:5px;font-size:10.5px;color:#555">Technician: <strong>${escapeHtml(m.technician||"")}</strong><br>Signature &amp; date</div>
      <div style="flex:1;border-top:1.5px solid #333;padding-top:5px;font-size:10.5px;color:#555">Client representative<br>Signature &amp; date</div>
    </div>
    <script>setTimeout(()=>window.print(),500)<\/script>`;
  await openReportPDF("FM200_REFILLING",[m.date?fmtDate(m.date):"",m.client,m.project].filter(Boolean).join(" · ")||"Manual",bodyHTML);
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
      <td style="text-align:center;width:60px;font-size:15px">${s==="Pass"?tick:box}</td>
      <td style="text-align:center;width:60px;font-size:15px">${s==="Fail"?tick:box}</td>
    </tr>`;
  }).join("");
  const fails=FM_CHK_ITEMS.filter(([k])=>window._fmChk[k].s==="Fail").length;
  const infoRow=(l,v)=>`<tr><td style="border:1px solid #ccc;background:#F0F4FA;padding:6px 10px;font-weight:800;font-size:11px;width:42%">${l}</td><td style="border:1px solid #ccc;padding:6px 10px;font-size:12px">${v||"&nbsp;"}</td></tr>`;
  const bodyHTML=`${_fmPrintBar}
    <div style="border:1.5px solid #1B3A6B;border-radius:6px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:19px;color:#03308B">TEST REPORT</div>
        <div style="font-size:12px;font-weight:800;color:#B71C1C">FM200 FIRE SUPPRESSION SYSTEM</div>
      </div>
      <table style="border-collapse:collapse;font-size:11px">
        ${m.reference?`<tr><td style="padding:2px 8px;font-weight:800;color:#555">Reference</td><td style="padding:2px 8px">${escapeHtml(m.reference)}</td></tr>`:""}
        <tr><td style="padding:2px 8px;font-weight:800;color:#555">Date of Report</td><td style="padding:2px 8px">${m.date?fmtDate(m.date):"—"}</td></tr>
        <tr><td style="padding:2px 8px;font-weight:800;color:#555">Test Time</td><td style="padding:2px 8px">${m.time||"—"}</td></tr>
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
    <div style="border:1px solid #ccc;border-radius:6px;padding:12px;font-size:12px;line-height:1.8;min-height:64px;white-space:pre-wrap">${escapeHtml((m.resultText||"").trim())||"&nbsp;"}</div>
    ${cylsBlock()}
    ${_rptPhotoGrid(window._fmPhotos,"Photos")}
    <div class="ksec"><span class="kbad">05</span><h3>Report Approval</h3></div>
    <table style="border-collapse:collapse;width:100%"><tr>
      <td style="border:1px solid #ccc;padding:14px;width:50%;vertical-align:top;font-size:12px">
        <strong>${escapeHtml(m.engName||"Eng.")}</strong><br>Technical Engineer<br>EJAF Technology<br><br><span style="color:#888;font-size:10.5px">Date &amp; Signature</span>
      </td>
      <td style="border:1px solid #ccc;padding:14px;width:50%;vertical-align:top;font-size:12px">
        <strong>${escapeHtml(m.repName||"Mr.")}</strong><br>${escapeHtml(m.repTitle||"")}<br>${escapeHtml(m.client||"")}<br><br><span style="color:#888;font-size:10.5px">Date &amp; Signature</span>
      </td>
    </tr></table>
    <div style="margin-top:14px;border:1px solid #ddd;border-radius:6px;padding:10px 12px;display:flex;gap:14px;align-items:center">
      <div style="flex:1;font-size:10px;font-style:italic;color:#555;line-height:1.7">The test and check report have been conducted by EJAF's competent engineers on the dates mentioned above. This report is made for the purpose of protecting the tangible and intangible components of the FM200 cylinders in compliance with the applicable standards ISO 14520 and NFPA 2001.</div>
      <div style="font-size:10px;font-style:italic;font-weight:700;color:#333;white-space:nowrap">Reference Standards<br>ISO 14520 · NFPA 2001</div>
    </div>
    <script>setTimeout(()=>window.print(),500)<\/script>`;
  function cylsBlock(){
    const cyls=window._fmCyls.filter(c=>(c.serial||c.type||c.gross));
    return cyls.length?`<div class="ksec"><span class="kbad">＋</span><h3>Cylinder Weight &amp; Pressure Verification (${cyls.length})</h3></div>${_fmCylsTable()}`:"";
  }
  await openReportPDF("FM200_TEST",[m.date?fmtDate(m.date):"",m.client].filter(Boolean).join(" · ")||"Manual",bodyHTML);
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

function _srChkState(tpl,i){
  window._srChk[tpl]=window._srChk[tpl]||{};
  if(!window._srChk[tpl][i]) window._srChk[tpl][i]={s:"Pass",r:""};
  return window._srChk[tpl][i];
}
window.srSetChk=function(tpl,i,v){ _srChkState(tpl,i).s=v; render(); };
window.srSetChkRemark=function(tpl,i,v){ _srChkState(tpl,i).r=v; };
window.srAddDev=function(){ window._srDevs.push({name:"",model:"",serial:"",location:"",result:"Pass",remark:""}); render(); };
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
  const pool=(state.devices||[]).filter(d=>{
    if((d.project||"").trim()!==proj) return false;
    if(window._sr.site && ![d.site,d.area].includes(window._sr.site) &&
       [d.area,d.site].filter(Boolean).join(" › ")!==window._sr.site) return false;
    const t=sysTemplateForName(d.system);
    return t ? t.id===tpl.id : false;
  });
  if(!pool.length) return toast(`No devices tagged "${tpl.name.split(" ")[0]}" in this project — tag them in Assets → System, or add rows manually`);
  window._srDevs=pool.map(d=>({name:d.deviceName||"",model:d.model||"",serial:d.serialNumber||"",
    location:[d.area,d.site].filter(Boolean).join(" › "),result:"Pass",remark:""}));
  toast(`✓ ${pool.length} device(s) loaded from Assets`);
  render();
};

function _srPillList(){
  return SYS_TEMPLATES.map(t=>({id:t.id,ic:t.icon,lb:t.short}))
    .concat([{id:"daily",ic:"📅",lb:"Daily"},{id:"weekly",ic:"📆",lb:"Weekly"}]);
}
function renderSystemReports(){
  if(!(isAdmin()||isHR()||hasCap("canExport"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  // Project progress reports live in the same pill row but render their own layout
  if(window._srTpl==="daily"||window._srTpl==="weekly"){
    return _pills('_srTpl',_srPillList()) + renderProgressReport(window._srTpl);
  }
  const tpl=sysTemplate(window._srTpl), m=window._sr, mode=window._srMode;
  const items=getSysCheckItems(tpl.id);
  const clientOpts=(state.clients||[]).map(c=>c.name).filter(Boolean).sort();
  const projOpts=(state.projects||[]).map(p=>(p.name||"").trim()).filter(Boolean).sort();
  const pr=(state.projects||[]).find(p=>(p.name||"").trim()===m.project);
  const siteOpts=pr?getProjectAreas(pr).filter(a=>a.active!==false).flatMap(a=>{
    const ss=(a.sites||[]).filter(x=>x.active!==false);
    return ss.length?ss.map(x=>[a.name,x.name].filter(Boolean).join(" › ")):[a.name];
  }):[];
  const fails=items.filter((_,i)=>_srChkState(tpl.id,i).s==="Fail").length;

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
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> General Information</div>
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
      <div class="field"><label>Reference</label><input value="${escapeHtml(m.reference||"")}" oninput="window._sr.reference=this.value" placeholder="e.g. #S03890"></div>
      <div class="field"><label>👤 Client Representative</label><input value="${escapeHtml(m.representative||"")}" oninput="window._sr.representative=this.value"></div>
      <div class="field"><label>👷 Technician</label><input value="${escapeHtml(m.technician||"")}" oninput="window._sr.technician=this.value"></div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">02</span> System Information</div>
    <div class="form-grid" style="margin-top:10px">
      ${tpl.fields.map(f=>`<div class="field"><label>${escapeHtml(f.l)}</label>
        <input value="${escapeHtml((m.fields||{})[f.k]||"")}" oninput="window._sr.fields['${f.k}']=this.value"></div>`).join("")}
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">03</span> Device Inventory & Results <span style="font-size:10px;color:var(--muted);font-weight:500">(${window._srDevs.length})</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
      ${mode!=="manual"?`<button class="btn btn-sm" style="background:${tpl.color};color:#fff;border:none;font-weight:700" onclick="srLoadDevices()">⬇ Load from Assets</button>`:""}
      <button class="btn btn-sm btn-secondary" onclick="srAddDev()">+ Add device</button>
      ${window._srDevs.length?`<button class="btn btn-sm btn-secondary" onclick="window._srDevs=[];render()">Clear</button>`:""}
    </div>
    ${window._srDevs.map((d,i)=>`<div style="border:1px solid var(--line);border-radius:9px;padding:9px;margin-bottom:8px;background:var(--card,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:10.5px;font-weight:800;color:${tpl.color}">${tpl.icon} DEVICE ${i+1}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${["Pass","Fail","N/A"].map(o=>`<button class="btn btn-sm ${d.result===o?"":"btn-secondary"}" style="${d.result===o?`background:${o==="Pass"?"#2E7D32":o==="Fail"?"#C62828":"#5B6C86"};color:#fff;border:none;`:""}font-size:10px;font-weight:800" onclick="window._srDevs[${i}].result='${o}';render()">${o}</button>`).join("")}
          <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="srDelDev(${i})">×</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Name</label><input value="${escapeHtml(d.name||"")}" oninput="window._srDevs[${i}].name=this.value"></div>
        <div class="field"><label>Model</label><input value="${escapeHtml(d.model||"")}" oninput="window._srDevs[${i}].model=this.value"></div>
        <div class="field"><label>Serial</label><input value="${escapeHtml(d.serial||"")}" oninput="window._srDevs[${i}].serial=this.value"></div>
        <div class="field"><label>Location</label><input value="${escapeHtml(d.location||"")}" oninput="window._srDevs[${i}].location=this.value"></div>
        <div class="field" style="grid-column:1/-1"><label>Remarks</label><input value="${escapeHtml(d.remark||"")}" oninput="window._srDevs[${i}].remark=this.value"></div>
      </div>
    </div>`).join("")}
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">04</span> Inspection Check List <span style="font-size:10px;color:var(--muted);font-weight:500">(${items.length}${fails?` · ${fails} failed`:""})</span></div>
    ${items.map((it,i)=>{const st=_srChkState(tpl.id,i);
      return `<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--line)">
        <span style="font-size:10px;font-weight:800;color:var(--muted);min-width:22px">${String(i+1).padStart(2,"0")}</span>
        <span style="flex:2;min-width:170px;font-size:12px">${escapeHtml(it)}</span>
        <div style="display:flex;gap:4px">
          ${["Pass","Fail","N/A"].map(o=>`<button class="btn btn-sm ${st.s===o?"":"btn-secondary"}" style="${st.s===o?`background:${o==="Pass"?"#2E7D32":o==="Fail"?"#C62828":"#5B6C86"};color:#fff;border:none;`:""}font-size:10px;font-weight:800" onclick="srSetChk('${tpl.id}',${i},'${o}')">${o}</button>`).join("")}
        </div>
        <input value="${escapeHtml(st.r||"")}" oninput="srSetChkRemark('${tpl.id}',${i},this.value)" placeholder="Remarks" style="flex:1;min-width:120px">
      </div>`;}).join("")}
    <p style="font-size:10.5px;color:var(--muted);margin-top:10px">Per ${escapeHtml(tpl.standards.split("·")[0].replace(/\s*\(.*/,"").trim())} — edit in <strong>Technical Classifications → Check Lists</strong>.</p>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">05</span> Result of Test</div>
    <textarea rows="4" oninput="window._sr.resultText=this.value" placeholder="Overall condition, findings and recommendations…" style="width:100%;margin-top:8px">${escapeHtml(m.resultText||"")}</textarea>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">06</span> Photos <span style="font-size:10px;color:var(--muted);font-weight:500">(max 12)</span></div>
    <input type="file" accept="image/*" multiple onchange="srAddPhotos(this)" style="margin-top:8px">
    ${window._srPhotos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${window._srPhotos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="srDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:800">×</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">07</span> Report Approval</div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>EJAF Engineer</label><input value="${escapeHtml(m.engName||"")}" oninput="window._sr.engName=this.value" placeholder="Eng. …"></div>
      <div class="field"><label>Client approver</label><input value="${escapeHtml(m.repName||"")}" oninput="window._sr.repName=this.value" placeholder="Mr. …"></div>
      <div class="field"><label>Approver title</label><input value="${escapeHtml(m.repTitle||"")}" oninput="window._sr.repTitle=this.value" placeholder="e.g. IT Manager"></div>
    </div>
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none;width:100%" onclick="generateSystemReport()">📄 Generate ${escapeHtml(tpl.name.split(" ")[0])} Report (PDF)</button>
  </div>`;
}

window.generateSystemReport=async function(){
  const tpl=sysTemplate(window._srTpl), m=window._sr;
  if(!(m.client||m.project)) return toast("⚠ Enter at least the client or project");
  const items=getSysCheckItems(tpl.id);
  const box="\u2610", tick="\u2611";
  const devs=window._srDevs.filter(d=>d.name||d.serial||d.model);
  const devFail=devs.filter(d=>d.result==="Fail").length;
  const chkFail=items.filter((_,i)=>_srChkState(tpl.id,i).s==="Fail").length;
  const infoRow=(l,v)=>`<tr><td style="border:1px solid #ccc;background:#F0F4FA;padding:6px 10px;font-weight:800;font-size:11px;width:42%">${l}</td><td style="border:1px solid #ccc;padding:6px 10px;font-size:12px">${v||"&nbsp;"}</td></tr>`;

  const bodyHTML=`${_fmPrintBar}
    <div style="border:1.5px solid #1B3A6B;border-radius:6px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:19px;color:#03308B">INSPECTION &amp; TEST REPORT</div>
        <div style="font-size:12px;font-weight:800;color:${tpl.color}">${tpl.icon} ${escapeHtml(tpl.name.toUpperCase())}</div>
      </div>
      <table style="border-collapse:collapse;font-size:11px">
        ${m.reference?`<tr><td style="padding:2px 8px;font-weight:800;color:#555">Reference</td><td style="padding:2px 8px">${escapeHtml(m.reference)}</td></tr>`:""}
        <tr><td style="padding:2px 8px;font-weight:800;color:#555">Date of Report</td><td style="padding:2px 8px">${m.date?fmtDate(m.date):"—"}</td></tr>
        <tr><td style="padding:2px 8px;font-weight:800;color:#555">Test Time</td><td style="padding:2px 8px">${m.time||"—"}</td></tr>
      </table>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Client Information</h3></div>
    <table style="border-collapse:collapse;width:100%">
      ${infoRow("Company",escapeHtml(m.client))}
      ${infoRow("Location",escapeHtml([m.project,m.site].filter(Boolean).join(" — ")))}
      ${infoRow("Representative",escapeHtml(m.representative))}
    </table>
    ${tpl.fields.length?`<div class="ksec"><span class="kbad">02</span><h3>System Information</h3></div>
    <table style="border-collapse:collapse;width:100%">
      ${tpl.fields.map(f=>infoRow(escapeHtml(f.l),escapeHtml((m.fields||{})[f.k]||""))).join("")}
    </table>`:""}
    ${devs.length?`<div class="ksec"><span class="kbad">03</span><h3>Device Inventory &amp; Test Results (${devs.length})</h3></div>
    <table><thead><tr><th style="width:32px">No.</th><th>Device</th><th>Model</th><th>Serial</th><th>Location</th><th style="width:48px">PASS</th><th style="width:48px">FAIL</th><th>Remarks</th></tr></thead>
    <tbody>${devs.map((d,i)=>`<tr>
      <td style="text-align:center">${String(i+1).padStart(2,"0")}</td>
      <td><strong>${escapeHtml(d.name||"—")}</strong></td><td style="font-size:10px">${escapeHtml(d.model||"—")}</td>
      <td style="font-size:10px">${escapeHtml(d.serial||"—")}</td><td style="font-size:10px">${escapeHtml(d.location||"—")}</td>
      <td style="text-align:center;font-size:15px">${d.result==="Pass"?tick:box}</td>
      <td style="text-align:center;font-size:15px">${d.result==="Fail"?tick:box}</td>
      <td style="font-size:10px">${escapeHtml(d.remark||(d.result==="N/A"?"N/A":"—"))}</td></tr>`).join("")}</tbody></table>
    <div style="margin-top:5px;font-size:11px;font-weight:700;color:${devFail?"#C62828":"#2E7D32"}">${devFail?`${devFail} device(s) FAILED`:`All ${devs.length} device(s) passed \u2713`}</div>`:""}
    <div class="ksec"><span class="kbad">${devs.length?"04":"03"}</span><h3>Inspection Check List</h3></div>
    <table><thead><tr><th style="width:32px">No.</th><th>Description</th><th style="width:48px">PASS</th><th style="width:48px">FAIL</th><th>Remarks</th></tr></thead>
    <tbody>${items.map((it,i)=>{const st=_srChkState(tpl.id,i);
      return `<tr><td style="text-align:center">${String(i+1).padStart(2,"0")}</td>
        <td style="font-size:11px">${escapeHtml(it)}</td>
        <td style="text-align:center;font-size:15px">${st.s==="Pass"?tick:box}</td>
        <td style="text-align:center;font-size:15px">${st.s==="Fail"?tick:box}</td>
        <td style="font-size:10px">${escapeHtml(st.r||(st.s==="N/A"?"N/A":"—"))}</td></tr>`;}).join("")}</tbody></table>
    <div style="margin-top:5px;font-size:11px;font-weight:700;color:${chkFail?"#C62828":"#2E7D32"}">Overall: ${chkFail?`${chkFail} item(s) FAILED — corrective action required`:`all ${items.length} items PASSED \u2713`}</div>
    <div class="ksec"><span class="kbad">${devs.length?"05":"04"}</span><h3>Result of Test</h3></div>
    <div style="border:1px solid #ccc;border-radius:6px;padding:12px;font-size:12px;line-height:1.8;min-height:60px;white-space:pre-wrap">${escapeHtml((m.resultText||"").trim())||"&nbsp;"}</div>
    ${_rptPhotoGrid(window._srPhotos,"Photos")}
    <div class="ksec"><span class="kbad">${devs.length?"06":"05"}</span><h3>Report Approval</h3></div>
    <table style="border-collapse:collapse;width:100%"><tr>
      <td style="border:1px solid #ccc;padding:14px;width:50%;vertical-align:top;font-size:12px">
        <strong>${escapeHtml(m.engName||m.technician||"Eng.")}</strong><br>Technical Engineer<br>EJAF Technology<br><br><span style="color:#888;font-size:10.5px">Date &amp; Signature</span>
      </td>
      <td style="border:1px solid #ccc;padding:14px;width:50%;vertical-align:top;font-size:12px">
        <strong>${escapeHtml(m.repName||m.representative||"Mr.")}</strong><br>${escapeHtml(m.repTitle||"")}<br>${escapeHtml(m.client||"")}<br><br><span style="color:#888;font-size:10.5px">Date &amp; Signature</span>
      </td>
    </tr></table>
    <div style="margin-top:14px;border:1px solid #ddd;border-radius:6px;padding:10px 12px;display:flex;gap:14px;align-items:center">
      <div style="flex:1;font-size:10px;font-style:italic;color:#555;line-height:1.7">This inspection and test report has been carried out by EJAF's competent engineers on the date stated above, in accordance with the applicable international standards for this system.</div>
      <div style="font-size:9.5px;font-style:italic;font-weight:700;color:#333;max-width:200px;line-height:1.6">Reference Standards<br><span style="font-weight:500">${escapeHtml(tpl.standards)}</span></div>
    </div>
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  const type={cctv:"CCTV_REPORT",fire:"FIRE_ALARM_REPORT",acs:"ACCESS_CONTROL_REPORT",ids:"INTRUSION_REPORT",net:"NETWORK_REPORT",elv:"ELV_REPORT"}[tpl.id]||"SYSTEM_REPORT";
  await openReportPDF(type,[m.date?fmtDate(m.date):"",m.client,m.project].filter(Boolean).join(" · ")||"Manual",bodyHTML);
  toast(`${tpl.name.split(" ")[0]} report ready!`);
};
Object.assign(window,{renderSystemReports});

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
  const S=(n,t)=>`<div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">${n}</span> ${t}</div>`;

  return `
  ${_rptHero(daily?"📅":"📆", daily?"Daily Progress Report":"Weekly Progress Report",
     "Project monitoring — ISO 21502 §7.15", `linear-gradient(135deg,${accent} 0%,#1B2A33 100%)`)}

  <div class="card">
    ${S("01","Project Information")}
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
      <div class="field"><label>Reference</label><input value="${escapeHtml(m.reference||"")}" oninput="window._pr.reference=this.value" placeholder="e.g. #S03890"></div>
      <div class="field"><label>👷 Prepared by</label><input value="${escapeHtml(m.preparedBy||"")}" oninput="window._pr.preparedBy=this.value"></div>
      <div class="field"><label>👤 Client representative</label><input value="${escapeHtml(m.representative||"")}" oninput="window._pr.representative=this.value"></div>
    </div>
    ${daily?"":`<div style="display:flex;gap:6px;margin-top:10px">
      <button class="btn btn-sm btn-secondary" onclick="prThisWeek()">This week</button>
      <button class="btn btn-sm btn-secondary" onclick="prLastWeek()">Last week</button>
    </div>`}
  </div>

  <div class="card" style="border-left:4px solid ${accent}">
    ${S("02","Scope of Work")}
    <p style="font-size:11px;color:var(--muted);margin:6px 0 0">Opens the report — the engineer's overview of what this project covers.</p>
    <textarea rows="5" oninput="window._pr.scope=this.value" placeholder="Describe the project scope: systems covered, contracted works, sites, objectives…" style="width:100%;margin-top:8px">${escapeHtml(m.scope||"")}</textarea>
  </div>

  ${daily?"":`<div class="card">
    ${S("03","Status & Progress")}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
      ${Object.keys(PR_RAG).map(k=>`<button class="btn btn-sm ${m.rag===k?"":"btn-secondary"}" style="${m.rag===k?`background:${PR_RAG[k][1]};color:#fff;border:none;`:""}font-weight:800" onclick="window._pr.rag='${k}';render()">${k} — ${PR_RAG[k][2]}</button>`).join("")}
    </div>
    <div class="form-grid">
      <div class="field"><label>Planned progress %</label><input type="number" min="0" max="100" value="${m.plannedPct||""}" oninput="window._pr.plannedPct=this.value;render()"></div>
      <div class="field"><label>Actual progress %</label><input type="number" min="0" max="100" value="${m.actualPct||""}" oninput="window._pr.actualPct=this.value;render()"></div>
      <div class="field"><label>Variance (auto)</label><div class="auto ${(m.plannedPct!==""&&m.actualPct!=="")?(Number(m.actualPct)>=Number(m.plannedPct)?"green":"yellow"):"empty"}">${(m.plannedPct!==""&&m.actualPct!=="")?((Number(m.actualPct)-Number(m.plannedPct))>=0?"+":"")+(Number(m.actualPct)-Number(m.plannedPct))+"%":"—"}</div></div>
    </div>
    <div class="field" style="margin-top:8px"><label>Executive summary</label>
      <textarea rows="3" oninput="window._pr.summary=this.value" placeholder="Overall position of the project this week…" style="width:100%">${escapeHtml(m.summary||"")}</textarea></div>
  </div>`}

  <div class="card">
    ${S(daily?"03":"04", daily?"Work Performed Today":"Work Completed This Week")}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">
      <button class="btn btn-sm" style="background:${accent};color:#fff;border:none;font-weight:700" onclick="prLoadFromRecords('${kind}')">⬇ Load from Daily Log</button>
      <button class="btn btn-sm btn-secondary" onclick="prAddTask()">+ Add task</button>
      ${window._prTasks.length?`<button class="btn btn-sm btn-secondary" onclick="window._prTasks=[];render()">Clear</button>
      <span style="margin-left:auto;font-size:11px;font-weight:800;color:${accent};align-self:center">${window._prTasks.length} task(s) · ${fmtHM(totH)}</span>`:""}
    </div>
    ${window._prTasks.map((t,i)=>`<div style="border:1px solid var(--line);border-radius:9px;padding:9px;margin-bottom:8px;background:var(--card,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:10.5px;font-weight:800;color:${accent}">TASK ${i+1}</span>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="prDelTask(${i})">×</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Date</label><input type="date" value="${t.date||""}" onchange="window._prTasks[${i}].date=this.value"></div>
        <div class="field"><label>Hours</label><input type="number" step="0.25" value="${t.hours||""}" oninput="window._prTasks[${i}].hours=this.value;render()"></div>
        <div class="field" style="grid-column:1/-1"><label>Description</label><input value="${escapeHtml(t.desc||"")}" oninput="window._prTasks[${i}].desc=this.value" placeholder="Work performed"></div>
        <div class="field"><label>Location</label><input value="${escapeHtml(t.location||"")}" oninput="window._prTasks[${i}].location=this.value"></div>
        <div class="field"><label>By</label><input value="${escapeHtml(t.by||"")}" oninput="window._prTasks[${i}].by=this.value"></div>
        <div class="field"><label>Status</label><input value="${escapeHtml(t.status||"")}" oninput="window._prTasks[${i}].status=this.value"></div>
      </div>
    </div>`).join("")}
  </div>

  <div class="card">
    ${S(daily?"04":"05","Manpower")}
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
    ${S(daily?"05":"06","Issues, Delays & Risks")}
    <textarea rows="3" oninput="window._pr.issues=this.value" placeholder="${daily?"Obstructions, delays, missing materials, access problems…":"Open risks, delays and mitigation actions…"}" style="width:100%;margin-top:8px">${escapeHtml(m.issues||"")}</textarea>
  </div>

  <div class="card">
    ${S(daily?"06":"07", daily?"Plan for Tomorrow":"Plan for Next Week")}
    <textarea rows="3" oninput="window._pr.nextPlan=this.value" placeholder="Look-ahead activities…" style="width:100%;margin-top:8px">${escapeHtml(m.nextPlan||"")}</textarea>
  </div>

  <div class="card">
    ${S(daily?"07":"08","HSE / Safety Notes")}
    <textarea rows="2" oninput="window._pr.hse=this.value" placeholder="Safety observations, incidents, toolbox talks…" style="width:100%;margin-top:8px">${escapeHtml(m.hse||"")}</textarea>
  </div>

  <div class="card">
    ${S(daily?"08":"09","Photos")} 
    <input type="file" accept="image/*" multiple onchange="prAddPhotos(this)" style="margin-top:8px">
    ${window._prPhotos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${window._prPhotos.map((p,i)=>`<div style="position:relative"><img src="${p.data}" style="width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"><button onclick="prDelPhoto(${i})" style="position:absolute;top:-6px;right:-6px;background:#C62828;color:#fff;border:none;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;font-weight:800">×</button></div>`).join("")}
    </div>`:""}
  </div>

  <div class="card">
    ${S(daily?"09":"10","Approval")}
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>EJAF Engineer</label><input value="${escapeHtml(m.engName||"")}" oninput="window._pr.engName=this.value" placeholder="Eng. …"></div>
      <div class="field"><label>Client approver</label><input value="${escapeHtml(m.repName||"")}" oninput="window._pr.repName=this.value" placeholder="Mr. …"></div>
      <div class="field"><label>Approver title</label><input value="${escapeHtml(m.repTitle||"")}" oninput="window._pr.repTitle=this.value" placeholder="e.g. Project Manager"></div>
    </div>
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);border:2px solid #C9A84C">
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none;width:100%" onclick="generateProgressReport('${kind}')">📄 Generate ${daily?"Daily":"Weekly"} Report (PDF)</button>
  </div>`;
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
  const infoRow=(l,v)=>`<tr><td style="border:1px solid #ccc;background:#F0F4FA;padding:6px 10px;font-weight:800;font-size:11px;width:42%">${l}</td><td style="border:1px solid #ccc;padding:6px 10px;font-size:12px">${v||"&nbsp;"}</td></tr>`;
  const block=(t)=>`<div style="border:1px solid #ccc;border-radius:6px;padding:11px;font-size:12px;line-height:1.8;white-space:pre-wrap;min-height:44px">${escapeHtml((t||"").trim())||"&nbsp;"}</div>`;
  let n=0; const K=()=>String(++n).padStart(2,"0");

  const bodyHTML=`${_fmPrintBar}
    <div style="border:1.5px solid #1B3A6B;border-radius:6px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-family:'DM Serif Display',serif;font-size:19px;color:#03308B">${daily?"DAILY":"WEEKLY"} PROGRESS REPORT</div>
        <div style="font-size:12px;font-weight:800;color:${daily?"#2E5FA3":"#00695C"}">${escapeHtml(m.project)}</div>
      </div>
      <table style="border-collapse:collapse;font-size:11px">
        ${m.reference?`<tr><td style="padding:2px 8px;font-weight:800;color:#555">Reference</td><td style="padding:2px 8px">${escapeHtml(m.reference)}</td></tr>`:""}
        <tr><td style="padding:2px 8px;font-weight:800;color:#555">${daily?"Date":"Period"}</td><td style="padding:2px 8px">${period}</td></tr>
        ${!daily&&m.weekNo?`<tr><td style="padding:2px 8px;font-weight:800;color:#555">Week</td><td style="padding:2px 8px">${escapeHtml(m.weekNo)}</td></tr>`:""}
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
      <div style="flex:1;min-width:120px;border:1px solid #ccc;border-left:5px solid ${rag[1]};border-radius:6px;padding:10px;background:${rag[0]}">
        <div style="font-size:9px;font-weight:800;color:#666;text-transform:uppercase;letter-spacing:.6px">Overall status</div>
        <div style="font-family:'DM Serif Display',serif;font-size:20px;color:${rag[1]}">${escapeHtml(m.rag)}</div>
        <div style="font-size:10px;color:#666">${rag[2]}</div>
      </div>
      ${(m.plannedPct!==""||m.actualPct!=="")?`
      <div style="flex:2;min-width:200px;border:1px solid #ccc;border-radius:6px;padding:10px">
        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:800;color:#666"><span>PLANNED</span><span>${m.plannedPct||0}%</span></div>
        <div style="height:8px;background:#E8EDF5;border-radius:5px;margin:3px 0 8px"><div style="height:100%;width:${Math.min(100,Number(m.plannedPct)||0)}%;background:#8FA8CC;border-radius:5px"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:800;color:#666"><span>ACTUAL</span><span>${m.actualPct||0}%</span></div>
        <div style="height:8px;background:#E8EDF5;border-radius:5px;margin:3px 0 6px"><div style="height:100%;width:${Math.min(100,Number(m.actualPct)||0)}%;background:linear-gradient(90deg,#C9A84C,#E9CC7A);border-radius:5px"></div></div>
        <div style="font-size:10.5px;font-weight:800;color:${(Number(m.actualPct)-Number(m.plannedPct))>=0?"#2E7D32":"#C62828"}">Variance: ${(Number(m.actualPct)-Number(m.plannedPct))>=0?"+":""}${(Number(m.actualPct)||0)-(Number(m.plannedPct)||0)}%</div>
      </div>`:""}
    </div>
    ${(m.summary||"").trim()?block(m.summary):""}`:""}

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
      <tr><td colspan="${daily?5:6}" style="text-align:right;font-weight:800">Total</td><td style="text-align:right;font-weight:800">${fmtHM(totH)}</td></tr>
    </tbody></table>`:`<div style="color:#888;font-size:12px">No tasks recorded for this period.</div>`}

    ${people.length?`<div class="ksec"><span class="kbad">${K()}</span><h3>Manpower (${people.length})</h3></div>
    <table><thead><tr><th style="width:34px">No.</th><th>Name</th><th>Role / trade</th><th style="width:70px">Hours</th></tr></thead>
    <tbody>${people.map((p,i)=>`<tr><td style="text-align:center">${String(i+1).padStart(2,"0")}</td><td><strong>${escapeHtml(p.name)}</strong></td><td style="font-size:11px">${escapeHtml(p.role||"—")}</td><td style="text-align:right">${p.hours?fmtHM(Number(p.hours)):"—"}</td></tr>`).join("")}
      <tr><td colspan="3" style="text-align:right;font-weight:800">Total man-hours</td><td style="text-align:right;font-weight:800">${fmtHM(manH)}</td></tr>
    </tbody></table>`:""}

    <div class="ksec"><span class="kbad">${K()}</span><h3>Issues, Delays &amp; Risks</h3></div>
    ${block(m.issues)}

    <div class="ksec"><span class="kbad">${K()}</span><h3>${daily?"Plan for Tomorrow":"Plan for Next Week"}</h3></div>
    ${block(m.nextPlan)}

    ${(m.hse||"").trim()?`<div class="ksec"><span class="kbad">${K()}</span><h3>HSE / Safety</h3></div>${block(m.hse)}`:""}
    ${_rptPhotoGrid(window._prPhotos,"Site Photos")}

    <div class="ksec"><span class="kbad">${K()}</span><h3>Approval</h3></div>
    <table style="border-collapse:collapse;width:100%"><tr>
      <td style="border:1px solid #ccc;padding:14px;width:50%;vertical-align:top;font-size:12px">
        <strong>${escapeHtml(m.engName||m.preparedBy||"Eng.")}</strong><br>Project / Technical Engineer<br>EJAF Technology<br><br><span style="color:#888;font-size:10.5px">Date &amp; Signature</span>
      </td>
      <td style="border:1px solid #ccc;padding:14px;width:50%;vertical-align:top;font-size:12px">
        <strong>${escapeHtml(m.repName||m.representative||"Mr.")}</strong><br>${escapeHtml(m.repTitle||"")}<br>${escapeHtml(m.client||"")}<br><br><span style="color:#888;font-size:10.5px">Date &amp; Signature</span>
      </td>
    </tr></table>
    <div style="margin-top:14px;border:1px solid #ddd;border-radius:6px;padding:10px 12px;display:flex;gap:14px;align-items:center">
      <div style="flex:1;font-size:10px;font-style:italic;color:#555;line-height:1.7">This progress report has been prepared by EJAF Technology for the period stated above as part of the project monitoring and control process.</div>
      <div style="font-size:9.5px;font-style:italic;font-weight:700;color:#333;white-space:nowrap;line-height:1.6">Reference Standards<br><span style="font-weight:500">ISO 21502:2020 §7.15 · PMBOK® Guide</span></div>
    </div>
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  await openReportPDF(daily?"DAILY_PROGRESS":"WEEKLY_PROGRESS",
    [period,m.client,m.project].filter(Boolean).join(" · "), bodyHTML);
  toast(`${daily?"Daily":"Weekly"} report ready!`);
};
Object.assign(window,{renderProgressReport});
