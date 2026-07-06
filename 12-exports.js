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
  const allowedEmps = (sel.length > 0 && !isEmployee())
    ? allowedEmpsBase.filter(e => sel.includes(e))
    : allowedEmpsBase;
  const projF = f.project || ""; // project filter
  const dailyFiltered = state.daily.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF || r.project===projF));
  const otFiltered = state.overtime.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF || r.project===projF));
  const trFiltered = state.travel.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF || r.project===projF));
  const lvFiltered = state.leaves.filter(r=>leaveInRange(r) && allowedEmps.includes(r.employee));

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

  // ═══════ EXPORT BUTTONS ═══════
  h+=`<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;border:2px solid #C9A84C">
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
    const allowedEmps = isEmployee() ? [state.profile.employeeName] : allEmployees();
    const projF = f.project || "";
    const dr = state.daily.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF||r.project===projF));
    const or = state.overtime.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF||r.project===projF));
    const tr = state.travel.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF||r.project===projF));
    const lv = state.leaves.filter(r=>leaveInRange(r) && allowedEmps.includes(r.employee));

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
    const allowedEmps = isEmployee() ? [state.profile.employeeName] : allEmployees();
    const projF = f.project || "";
    const dr = state.daily.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF||r.project===projF));
    const or = state.overtime.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF||r.project===projF));
    const tr = state.travel.filter(r=>inRange(r) && allowedEmps.includes(r.employee) && (!projF||r.project===projF));
    const lv = state.leaves.filter(r=>leaveInRange(r) && allowedEmps.includes(r.employee));

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
      setCell(ws1, `${lvCol}${rowNum}`, r.leaveDays || 0, {...numStyle(alt), font:{bold:true,sz:11,color:{rgb:'C62828'}}});
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
    navigator.serviceWorker.register('sw.js', {scope: './'}).then(function(reg){
      // Check for updates on every load; if a new SW takes control, reload once.
      reg.update();
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function(){
        if(refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }).catch(function(){
      // Fallback: Blob-based SW (network-first for HTML so the app always updates)
      var swCode = "const CACHE='ejaftech-v77';"
        + "self.addEventListener('install',e=>self.skipWaiting());"
        + "self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));"
        + "self.addEventListener('fetch',e=>{"
        + "if(e.request.url.includes('firebase')||e.request.url.includes('googleapis')||e.request.url.includes('gstatic'))return;"
        + "if(e.request.mode==='navigate'||e.request.destination==='document'){e.respondWith(fetch(e.request).then(resp=>{const c=resp.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));return resp;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./'))));return;}"
        + "e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{"
        + "if(e.request.url.startsWith(self.location.origin)){const c=resp.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}"
        + "return resp;}).catch(()=>caches.match('./'))));"
        + "});";
      var blob = new Blob([swCode], {type:'application/javascript'});
      navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(function(){});
    });
  });
}
