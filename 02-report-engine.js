// ── Per-type reference sequences ─────────────────────────────────────────
// Every report family runs its OWN yearly counter (reportCounters/{year}_{PREFIX})
// so PM, Incident, FM-200, HR, Daily Log… never share or collide in numbering.
const REF_PREFIX = {
  HR_REPORT:"HR", DAILY_LOG:"DL", TECHNICAL_REPORT:"TR", PERIOD_REPORT:"RPT",
  PREVENTIVE_MAINTENANCE:"PM", INCIDENT:"INC",
  FM200_REFILLING:"FMR", FM200_TEST:"FMT",
  ASSET_REPORT:"AST", CLIENT_REPORT:"CLR", DASHBOARD:"DSH", GENERAL:"RPT",
};
const REF_TYPE_LABEL = {
  HR:"HR Report", DL:"Daily Log Report", TR:"Technical Report", RPT:"Flexible Report",
  PM:"PM Report", INC:"Incident Report", FMR:"FM-200 Refilling", FMT:"FM-200 Test",
  AST:"Asset Report", CLR:"Client Report", DSH:"Dashboard Export",
};
window.REF_PREFIX=REF_PREFIX; window.REF_TYPE_LABEL=REF_TYPE_LABEL;

async function generateRefNo(reportType="GENERAL"){
  const prefix = REF_PREFIX[reportType] || "RPT";
  try{
    const {db, doc, getDoc, setDoc, runTransaction, collection, addDoc} = window.__fb;
    if(!db) throw new Error("db not ready");

    const year = new Date().getFullYear();
    const counterRef = doc(db, "reportCounters", `${year}_${prefix}`);

    // Use transaction to safely increment this type's own sequence
    const n = await runTransaction(db, async(tx) => {
      const snap = await tx.get(counterRef);
      const stored = snap.exists() ? snap.data() : {};
      const storedYear = stored.year || 0;
      const current = (storedYear === year) ? (stored.count || 0) : 0;
      const next = current + 1;
      tx.set(counterRef, { count: next, year: year, prefix: prefix });
      return next;
    });

    const refNo = `${prefix}-${year}-${String(n).padStart(4,"0")}`;

    // Log silently — never block export
    addDoc(collection(db, "reportLog"), {
      refNo, reportType, prefix,
      exportedBy:     state.user?.email,
      exportedByName: state.profile?.name || state.profile?.employeeName,
      period:         getPeriod(),
      at:             new Date().toISOString()
    }).catch(()=>{});

    return refNo;

  } catch(e) {
    console.error("generateRefNo failed:", e.message);
    return `${prefix}-${new Date().getFullYear()}-T${Date.now().toString().slice(-5)}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  UNIVERSAL PREMIUM REPORT TEMPLATE
// ═══════════════════════════════════════════════════════════════════════
function buildReportHTML(refNo, reportType, periodLabel, bodyHTML){
  const now=new Date();
  const dt=now.toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  const tm=now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  const user=state.profile?.name||state.profile?.employeeName||state.user?.email||"System";
  const css=`
    @page{margin:0;size:A4}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1A1A2E;font-size:11px;line-height:1.4;background:#fff}

    /* HEADER */
    .rh{background:linear-gradient(135deg,#03308B 0%,#1a4db5 60%,#0a1628 100%);
        padding:20px 26px;display:flex;justify-content:space-between;align-items:flex-start;
        -webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rl{color:white;font-size:22px;font-weight:900;letter-spacing:2px;line-height:1}
    .rl span{color:#C9A84C}
    .rs{color:rgba(255,255,255,.65);font-size:10px;margin-top:4px}
    .rt{color:rgba(255,255,255,.45);font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
    .rr{text-align:right}
    .rn{color:#C9A84C;font-size:13px;font-weight:700}
    .rm{color:rgba(255,255,255,.65);font-size:9px;margin-top:4px;line-height:1.7}

    /* GOLD DIVIDER */
    .rd{height:3px;background:linear-gradient(90deg,#C9A84C,#03308B);
        -webkit-print-color-adjust:exact;print-color-adjust:exact}

    /* BODY */
    .rb{padding:18px 26px}

    /* SECTION HEADERS */
    .ksec{display:flex;align-items:center;gap:10px;margin:18px 0 10px;page-break-inside:avoid}
    .kbad{background:#03308B;color:#C9A84C;font-size:9px;font-weight:700;padding:3px 8px;
          border-radius:4px;letter-spacing:1px;
          -webkit-print-color-adjust:exact;print-color-adjust:exact}
    .ksec h3{font-size:12px;font-weight:700;color:#03308B}

    /* KPI CARDS */
    .kr{display:flex;gap:8px;margin:14px 0}
    .kc{flex:1;padding:12px;border-radius:8px;border-left:4px solid;background:#f8faff;
        page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .kl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#888}
    .kv{font-size:19px;font-weight:700;margin-top:2px}
    .ks{font-size:9px;color:#888;margin-top:1px}
    .kb{border-color:#03308B}.kb .kv{color:#03308B}
    .ko{border-color:#E65100}.ko .kv{color:#E65100}
    .kg{border-color:#2e7d32}.kg .kv{color:#2e7d32}
    .kp{border-color:#6A1B9A}.kp .kv{color:#6A1B9A}
    .krd{border-color:#C62828}.krd .kv{color:#C62828}

    /* TABLES */
    table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px;border-radius:6px;overflow:hidden}
    thead tr{background:#03308B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    thead th{color:white;padding:9px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
    tbody tr:nth-child(even) td{background:#f0f4ff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    tbody td{padding:7px 10px;border-bottom:1px solid #e0e8ff}
    tfoot tr{background:#0a1628;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    tfoot td{color:#C9A84C;padding:9px 10px;font-weight:700;font-size:10px;border-top:2px solid #C9A84C}
    tr.grand td{background:linear-gradient(135deg,#C9A84C,#B58E2E)!important;color:#03308B;font-weight:800!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}

    /* EMPLOYEE BLOCKS */
    .emp-block{margin-bottom:10px;border:1px solid #D6E4F0;border-radius:8px;overflow:hidden;page-break-inside:avoid;border-left:4px solid #03308B}
    .emp-head{background:linear-gradient(135deg,#03308B,#1a4db5);color:white;padding:8px 14px;font-size:11px;font-weight:700;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .emp-head-tag{background:#C9A84C;color:#03308B;padding:2px 9px;border-radius:10px;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .emp-sub{padding:7px 14px;font-size:11px;font-weight:700;color:white;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .emp-block.ot{border-left-color:#E65100}.emp-block.ot .emp-sub{background:linear-gradient(135deg,#E65100,#BF360C)}
    .emp-block.tr{border-left-color:#2e7d32}.emp-block.tr .emp-sub{background:linear-gradient(135deg,#2e7d32,#1B5E20)}
    .emp-block.lv{border-left-color:#C62828}.emp-block.lv .emp-sub{background:linear-gradient(135deg,#C62828,#8B1818)}

    /* FOOTER */
    .rf{margin-top:24px;padding:12px 26px;background:#f0f4ff;border-top:3px solid #03308B;
        display:flex;justify-content:space-between;align-items:center;
        -webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rfl{font-size:9px;color:#888;line-height:1.6}
    .rfr{font-size:9px;color:#03308B;font-weight:700}

    .empty{padding:14px;text-align:center;color:#888;font-style:italic;font-size:10px}
    .actions{padding:12px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000}
    .actions button{background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin:0 4px}
    .lv-badge{padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;display:inline-block}
    /* EJAF watermark — light blue, tilted, centered on every printed page */
    .wm{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;
        display:flex;align-items:center;justify-content:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .wm svg{width:82%;height:auto}
    .rh,.rd,.rb,.rf{position:relative;z-index:1}
    @media print{.no-print{display:none}body{background:#fff}}
  `;
  // EJAF wordmark watermark (letter A drawn WITHOUT its crossbar), tilted, slightly saturated blue.
  const watermark = `<div class="wm"><svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-30 200 70)" fill="#0A3FB0" opacity="0.13" font-family="Arial Black, Arial, sans-serif" font-weight="900">
      <text x="0" y="105" font-size="130" letter-spacing="4">E</text>
      <text x="95" y="105" font-size="130" letter-spacing="4">J</text>
      <polygon points="175,105 210,20 245,105 228,105 210,58 192,105"/>
      <text x="255" y="105" font-size="130" letter-spacing="4">F</text>
    </g>
  </svg></div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>
${watermark}
<div class="rh">
  <div>
    <div class="rl">EJAF <span>TECHNOLOGY</span></div>
    <div class="rs">Girêk</div>
    <div class="rt">${reportType.replace(/_/g," ")}</div>
  </div>
  <div class="rr">
    <div class="rn">${refNo}</div>
    <div class="rm">Exported: ${dt} · ${tm}<br>Period: ${periodLabel}<br>Generated by: ${user}</div>
  </div>
</div>
<div class="rd"></div>
<div class="rb">${bodyHTML}</div>
<div class="rf">
  <div class="rfl">EJAF Technology · Girêk · Confidential<br>Automatically generated by Girêk</div>
  <div class="rfr">Powered by Siwar · ${refNo}</div>
</div>
</body></html>`;
}

async function openReportPDF(reportType, periodLabel, bodyHTML){
  const refNo=await generateRefNo(reportType);
  const html=buildReportHTML(refNo,reportType,periodLabel,bodyHTML);
  const win=window.open("","_blank");
  if(!win){alert("Please allow pop-ups to export PDF");return;}
  win.document.write(html);
  win.document.close();
  win.onload=()=>setTimeout(()=>win.print(),300);
}

// ═══════════════════════════════════════════════════════════════════════
//  EXPORTS (Excel CSV + PDF)
// ═══════════════════════════════════════════════════════════════════════
function csvEscape(v){
  if(v==null) return "";
  const s=String(v);
  if(s.includes(",")||s.includes("\"")||s.includes("\n")) return `"${s.replace(/"/g,'""')}"`;
  return s;
}

function downloadFile(filename, content, mime){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},100);
}

// ═══════════════════════════════════════════════════════════════════════
//  DAILY LOG EXPORT — PDF & EXCEL
// ═══════════════════════════════════════════════════════════════════════
async function exportDailyPDF(){
  if(!canSeeReports()) return toast("Access denied");
  const period = getPeriod();
  // Use the UNIFIED global filters + the local "# Entry" filter
  const filterENo = dailyEntryNo ? Number(dailyEntryNo) : null;
  const rows = applyReportFilters(visibleRows(state.daily))
    .filter(r => {
      if(filterENo !== null && Number(r.entryNo||0) !== filterENo) return false;
      return true;
    })
    .sort((a,b) => {
      const d = (a.date||"").localeCompare(b.date||"");
      return d !== 0 ? d : (a.entryNo||0) - (b.entryNo||0);
    });

  const totalHrs = rows.reduce((s,r)=>s+Number(r.duration||0),0);
  const depts    = [...new Set(rows.map(r=>r.dept).filter(Boolean))];
  const emps     = [...new Set(rows.map(r=>r.employee).filter(Boolean))];

  // Dept summary
  const deptRows = state.departments.map(d=>{
    const dh = rows.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.duration||0),0);
    const dc = rows.filter(r=>r.dept===d.name).length;
    if(!dh && !dc) return '';
    return `<tr><td><span style="background:${d.color}22;color:${d.color};padding:2px 8px;border-radius:10px;font-weight:700;font-size:10px">${escapeHtml(d.name)}</span></td>
      <td style="color:${d.color};font-weight:700">${fmtHM(dh)}</td><td>${dc}</td></tr>`;
  }).filter(Boolean).join('');

  // Emp summary
  const empSummaryRows = emps.map(e=>{
    const eh = rows.filter(r=>r.employee===e).reduce((s,r)=>s+Number(r.duration||0),0);
    const ec = rows.filter(r=>r.employee===e).length;
    return `<tr><td><strong style="color:#03308B">${employeeBadge(e)}</strong></td>
      <td style="color:#03308B;font-weight:700">${fmtHM(eh)}</td><td>${ec}</td></tr>`;
  }).join('');

  // Main entries table
  const entryRows = rows.map(r=>`<tr>
    <td style="text-align:center;font-weight:700;color:#03308B;background:#f0f4ff">${r.entryNo ? formatEntryNo(r.entryNo) : '—'}</td>
    <td>${fmtDate(r.date)}</td>
    <td style="font-size:10px;color:#555;white-space:nowrap">${r.start&&r.end?`${r.start}–${r.end}`:'—'}</td>
    <td><strong style="color:#03308B">${escapeHtml(r.employee||'')}</strong></td>
    <td>${escapeHtml(r.project||'')}${(r.area||r.site)?`<br><span style="font-size:9px;color:#1565C0">${r.area?`🗺️ ${escapeHtml(r.area)}`:''}${r.site?` · 📍 ${escapeHtml(r.site)}`:''}</span>`:''}${(r.taskCategory||r.taskStatus||r.workType)?`<br><span style="font-size:8px;color:#6A1B9A">${r.taskCategory?escapeHtml(r.taskCategory):''}${r.taskSubcategory?'›'+escapeHtml(r.taskSubcategory):''}${r.taskStatus?` · ${escapeHtml(r.taskStatus)}`:''}${r.workType?` · ${escapeHtml(r.workType)}`:''}</span>`:''}</td>
    <td><span style="background:${(state.departments.find(d=>d.name===r.dept)||{color:'#888'}).color}22;color:${(state.departments.find(d=>d.name===r.dept)||{color:'#888'}).color};padding:2px 7px;border-radius:8px;font-size:10px;font-weight:700">${escapeHtml(r.dept||'')}</span></td>
    <td>${r.location?`<span style="background:#E3F2FD;color:#1565C0;padding:2px 7px;border-radius:8px;font-size:10px">📍 ${escapeHtml(r.location)}</span>`:'—'}${r.gpsLat?` <a href="${gpsMapLink(r.gpsLat,r.gpsLng)}" style="font-size:9px;color:#2E7D32;font-weight:700;text-decoration:none">🛰️ Map</a>`:r.gpsDenied?` <span style="font-size:9px;color:#C62828">🚫 GPS</span>`:''}</td>
    <td style="color:#2E7D32;font-weight:700">${fmtHM(r.duration)}</td>
    <td style="font-size:10px;color:#555;max-width:120px;word-break:break-word">${escapeHtml((r.resolutionText||'').slice(0,80))}${(r.resolutionText||'').length>80?'…':''}</td>
  </tr>`).join('');

  const bodyHTML = `
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 Choose <strong>"Save as PDF"</strong> in the print dialog
      <br><br>
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Executive Summary${reportFilterLabel()?' — '+reportFilterLabel():''}</h3></div>
    <div class="kr">
      <div class="kc kb"><div class="kl">Total Hours</div><div class="kv">${fmtHM(totalHrs)}</div><div class="ks">${rows.length} entries</div></div>
      <div class="kc kg"><div class="kl">Employees</div><div class="kv">${emps.length}</div><div class="ks">active</div></div>
      <div class="kc ko"><div class="kl">Departments</div><div class="kv">${depts.length}</div><div class="ks">covered</div></div>
    </div>
    <div class="ksec"><span class="kbad">02</span><h3>Department Breakdown</h3></div>
    <table><thead><tr><th>Department</th><th>Hours</th><th>Entries</th></tr></thead><tbody>${deptRows||'<tr><td colspan="3" style="text-align:center;color:#888">No data</td></tr>'}</tbody></table>
    <div class="ksec"><span class="kbad">03</span><h3>Employee Summary</h3></div>
    <table><thead><tr><th>Employee</th><th>Hours</th><th>Entries</th></tr></thead><tbody>${empSummaryRows||'<tr><td colspan="3" style="text-align:center;color:#888">No data</td></tr>'}</tbody></table>
    <div class="ksec"><span class="kbad">04</span><h3>Daily Entries Detail</h3></div>
    <table>
      <thead><tr><th style="width:44px">#</th><th>Date</th><th>Time</th><th>Employee</th><th>Project</th><th>Dept</th><th>Location</th><th>Hours</th><th>Resolution Summary</th></tr></thead>
      <tbody>${entryRows||'<tr><td colspan="9" style="text-align:center;color:#888">No entries</td></tr>'}</tbody>
      <tfoot><tr><td colspan="7"><strong>GRAND TOTAL</strong></td><td style="color:#C9A84C;font-weight:700">${fmtHM(totalHrs)}</td><td>${rows.length} entries</td></tr></tfoot>
    </table>
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  const activeFilters = [reportFilterLabel(), filterENo ? `Entry #${String(filterENo).padStart(3,'0')}` : ""].filter(Boolean).join(" · ");
  await openReportPDF("DAILY_LOG", activeFilters ? `${period} · ${activeFilters}` : period, bodyHTML);
  toast("Daily Log PDF ready!");
}
window.exportDailyPDF = exportDailyPDF;

async function exportDailyExcel(){
  if(!canSeeReports()) return toast("Access denied");
  if(typeof XLSX === 'undefined') return toast('Excel library not loaded');
  try{
    const {db, doc, setDoc} = window.__fb;
    const refNo = await generateRefNo('EXCEL_DAILY');
    const period = getPeriod();
    const filterENo = dailyEntryNo ? Number(dailyEntryNo) : null;
    const rows = applyReportFilters(visibleRows(state.daily))
      .filter(r => {
        if(filterENo !== null && Number(r.entryNo||0) !== filterENo) return false;
        return true;
      })
      .sort((a,b)=>{
        const d=(a.date||"").localeCompare(b.date||"");
        return d!==0?d:(a.entryNo||0)-(b.entryNo||0);
      });

    const wb = XLSX.utils.book_new();
    const COLORS = {
      navy:"03308B", gold:"C9A84C", green:"2E7D32",
      white:"FFFFFF", bgAlt:"F0F4FF", textDark:"1A1A2E"
    };
    const titleSt = {font:{bold:true,sz:16,color:{rgb:COLORS.gold}},fill:{fgColor:{rgb:COLORS.navy}},alignment:{horizontal:"center"}};
    const subSt   = {font:{italic:true,sz:10,color:{rgb:"6B7B8F"}},alignment:{horizontal:"center"}};
    const hdSt    = {font:{bold:true,sz:10,color:{rgb:COLORS.white}},fill:{fgColor:{rgb:COLORS.navy}},alignment:{horizontal:"center"}};
    const setC    = (ws,addr,val,st)=>{ ws[addr]={v:val,t:typeof val==='number'?'n':'s'}; if(st) ws[addr].s=st; };
    const setM    = (ws,r)=>{ if(!ws['!merges'])ws['!merges']=[]; ws['!merges'].push(r); };

    // ── SHEET 1: Summary ──
    const ws1 = {};
    setC(ws1,'A1',`EJAF Technology — Daily Work Log  |  Ref: ${refNo}`,titleSt);
    setM(ws1,{s:{r:0,c:0},e:{r:0,c:6}});
    setC(ws1,'A2',`Period: ${period}${reportFilterLabel()?' · '+reportFilterLabel():''}  |  Generated: ${new Date().toLocaleString('en-GB')}`,subSt);
    setM(ws1,{s:{r:1,c:0},e:{r:1,c:13}});
    setC(ws1,'A4','#',hdSt); setC(ws1,'B4','Date',hdSt); setC(ws1,'C4','Time',hdSt);
    setC(ws1,'D4','Employee',hdSt); setC(ws1,'E4','Project',hdSt); setC(ws1,'F4','Area',hdSt);
    setC(ws1,'G4','Site',hdSt); setC(ws1,'H4','Work Type',hdSt); setC(ws1,'I4','Status',hdSt);
    setC(ws1,'J4','Category',hdSt); setC(ws1,'K4','Subcategory',hdSt); setC(ws1,'L4','Department',hdSt);
    setC(ws1,'M4','Location',hdSt); setC(ws1,'N4','Hours',hdSt); setC(ws1,'O4','GPS',hdSt);
    rows.forEach((r,i)=>{
      const row=5+i; const alt=i%2===1;
      const bg = alt ? COLORS.bgAlt : COLORS.white;
      const cellSt = {font:{sz:10,color:{rgb:COLORS.textDark}},fill:{fgColor:{rgb:bg}}};
      setC(ws1,`A${row}`,r.entryNo?Number(r.entryNo):i+1,{...cellSt,alignment:{horizontal:"center"},font:{sz:10,bold:true,color:{rgb:COLORS.navy}}});
      setC(ws1,`B${row}`,r.date||'',cellSt);
      setC(ws1,`C${row}`,(r.start&&r.end)?`${r.start}–${r.end}`:'',{...cellSt,font:{sz:9,color:{rgb:COLORS.textDark}}});
      setC(ws1,`D${row}`,r.employee||'',cellSt);
      setC(ws1,`E${row}`,r.project||'',cellSt);
      setC(ws1,`F${row}`,r.area||'',cellSt);
      setC(ws1,`G${row}`,r.site||'',cellSt);
      setC(ws1,`H${row}`,r.workType||'',cellSt);
      setC(ws1,`I${row}`,r.taskStatus||'',cellSt);
      setC(ws1,`J${row}`,r.taskCategory||'',cellSt);
      setC(ws1,`K${row}`,r.taskSubcategory||'',cellSt);
      setC(ws1,`L${row}`,r.dept||'',cellSt);
      setC(ws1,`M${row}`,r.location||'',cellSt);
      setC(ws1,`N${row}`,fmtHM(r.duration),{...cellSt,font:{sz:10,bold:true,color:{rgb:"2E7D32"}}});
      setC(ws1,`O${row}`, r.gpsLat ? gpsMapLink(r.gpsLat,r.gpsLng) : (r.gpsDenied?'GPS denied':''), {...cellSt,font:{sz:9,color:{rgb:r.gpsLat?"2E7D32":"C62828"}}});
    });
    const totRow=5+rows.length;
    const totSt={font:{bold:true,sz:11,color:{rgb:COLORS.gold}},fill:{fgColor:{rgb:"0A1628"}}};
    setC(ws1,`A${totRow}`,'TOTAL',totSt); setM(ws1,{s:{r:totRow-1,c:0},e:{r:totRow-1,c:12}});
    setC(ws1,`N${totRow}`,fmtHM(rows.reduce((s,r)=>s+Number(r.duration||0),0)),totSt);
    ws1['!ref']=`A1:O${totRow}`;
    ws1['!cols']=[{wch:8},{wch:12},{wch:14},{wch:20},{wch:22},{wch:16},{wch:18},{wch:13},{wch:13},{wch:14},{wch:20},{wch:14},{wch:14},{wch:10},{wch:34}];
    XLSX.utils.book_append_sheet(wb,ws1,'Daily Log');

    // ── SHEET 2: Department Summary ──
    const ws2={};
    setC(ws2,'A1','Department Summary',titleSt); setM(ws2,{s:{r:0,c:0},e:{r:0,c:2}});
    setC(ws2,'A3','Department',hdSt); setC(ws2,'B3','Hours',hdSt); setC(ws2,'C3','Entries',hdSt);
    state.departments.forEach((d,i)=>{
      const dh=rows.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.duration||0),0);
      const dc=rows.filter(r=>r.dept===d.name).length;
      if(!dh&&!dc) return;
      const row=4+i;
      setC(ws2,`A${row}`,d.name,{font:{bold:true,sz:10,color:{rgb:d.color.replace('#','')}}}); 
      setC(ws2,`B${row}`,fmtHM(dh),{font:{sz:10,bold:true,color:{rgb:"2E7D32"}}});
      setC(ws2,`C${row}`,dc,{font:{sz:10}});
    });
    ws2['!cols']=[{wch:22},{wch:12},{wch:10}];
    XLSX.utils.book_append_sheet(wb,ws2,'By Department');

    XLSX.writeFile(wb,`EJAF_Daily_Log_${refNo}.xlsx`);
    toast("Daily Log Excel exported ✓");
  } catch(e){
    console.error(e); toast("Excel export failed: "+e.message);
  }
}
window.exportDailyExcel = exportDailyExcel;

function exportCSV(){
  const period=getPeriod().replace(/[^a-z0-9]+/gi,"_");
  const today=new Date().toISOString().split("T")[0];
  const lines=[];

  // BOM for Excel UTF-8 support
  lines.push("Girêk — "+getPeriod());
  lines.push("Exported: "+new Date().toLocaleString());
  lines.push("");

  // Summary
  const s=summary();
  lines.push("STAFF SUMMARY");
  lines.push(["Employee","Enterprise","Security","Ejaf","Total","Overtime","Travel Days","Per Diem IQD"].map(csvEscape).join(","));
  s.forEach(r=>{
    lines.push([r.emp,fmtHM(r.ent),fmtHM(r.sec),fmtHM(r.eja),fmtHM(r.total),fmtHM(r.ot),r.tDays||0,r.pd||0].map(csvEscape).join(","));
  });
  lines.push("");

  // Daily Log
  const dailyRows=applyReportFilters(isHR()?state.daily:state.daily.filter(r=>r.employee===state.profile.employeeName));
  lines.push("DAILY WORK LOG");
  lines.push(["Date","Employee","Project","Area","Site","Work Type","Status","Category","Subcategory","Department","Start","End","Duration","Notes"].map(csvEscape).join(","));
  dailyRows.forEach(r=>{
    lines.push([r.date,r.employee,r.project,r.area||"",r.site||"",r.workType||"",r.taskStatus||"",r.taskCategory||"",r.taskSubcategory||"",r.dept,r.start,r.end,fmtHM(r.duration),r.notes||""].map(csvEscape).join(","));
  });
  lines.push("");

  // Overtime
  const otRows=applyReportFilters(isHR()?state.overtime:state.overtime.filter(r=>r.employee===state.profile.employeeName));
  lines.push("OVERTIME LOG");
  lines.push(["Date","Day","Employee","Start","End","Hours","Project","Department","Location","Notes"].map(csvEscape).join(","));
  otRows.forEach(r=>{
    lines.push([r.date,r.day||"",r.employee,r.start||"",r.end||"",fmtHM(r.hours),r.project||"",r.dept||"",r.location||"",r.notes||""].map(csvEscape).join(","));
  });
  lines.push("");

  // Travel
  const trRows=applyReportFilters(isHR()?state.travel:state.travel.filter(r=>r.employee===state.profile.employeeName));
  lines.push("TRAVEL LOG");
  lines.push(["Date","Employee","Days","Project","Department","Location","Per Diem IQD","Per Diem Status","Notes"].map(csvEscape).join(","));
  trRows.forEach(r=>{
    lines.push([r.date,r.employee,r.days,r.project||"",r.dept||"",r.location||"",r.perDiem||0,(r.perDiemStatus||"received")==="received"?"Received":"Not Received",r.notes||""].map(csvEscape).join(","));
  });

  // UTF-8 BOM so Excel recognizes Arabic and special chars
  const content="\uFEFF"+lines.join("\n");
  downloadFile(`OpsDeptTrack_${period}_${today}.csv`, content, "text/csv;charset=utf-8");
  toast("Excel CSV downloaded ✓");
}

async function exportPDF(){
  const period=getPeriod();
  const s=summary();
  const tot=k=>s.reduce((a,b)=>a+b[k],0);
  const emps = visibleEmployees();
  const totalLeaveDays=s.reduce((a,b)=>a+(b.leaveDays||0),0);
  const depts=state.departments;

  // KPI Cards
  const kpiCards=`<div class="kr">
    <div class="kc kb"><div class="kl">Total Hours</div><div class="kv">${fmtHM(tot("total"))}</div><div class="ks">${applyReportFilters(state.daily).length} sessions</div></div>
    <div class="kc ko"><div class="kl">Overtime</div><div class="kv">${fmtHM(tot("ot"))}</div><div class="ks">${applyReportFilters(state.overtime).length} entries</div></div>
    <div class="kc kg"><div class="kl">Travel Days</div><div class="kv">${fmtDays(tot("tDays"))}</div><div class="ks">${applyReportFilters(state.travel).length} trips</div></div>
    <div class="kc kp"><div class="kl">Per Diem</div><div class="kv">${fmtMoney(tot("pd"))}</div><div class="ks">IQD total</div></div>
    <div class="kc krd"><div class="kl">Leave Days</div><div class="kv">${fmtDays(totalLeaveDays)}</div><div class="ks">${applyReportFilters(state.leaves,"from").length} entries</div></div>
  </div>`;

  // Summary Table
  const deptHeaders=depts.map(d=>`<th>${escapeHtml(d.name.slice(0,10))}</th>`).join('');
  const summaryRows=s.map(r=>`<tr>
    <td><strong style="color:#03308B">${employeeBadge(r.emp)}</strong></td>
    ${depts.map(d=>`<td style="color:${d.color};font-weight:700">${fmtHM(r.byDept[d.name]||0)}</td>`).join('')}
    <td><strong>${fmtHM(r.total)}</strong></td>
    <td style="color:#E65100;font-weight:600">${fmtHM(r.ot)}</td>
    <td style="color:#2e7d32;font-weight:600">${r.tDays||0}</td>
    <td style="color:#6A1B9A;font-weight:600">${fmtMoney(r.pd)}</td>
    <td style="color:#C62828;font-weight:600">${(Number(r.leaveDays)||0).toFixed(2)}</td>
  </tr>`).join('');
  const grandRow=!isEmployee()?`<tr class="grand">
    <td>GRAND TOTAL</td>
    ${depts.map(d=>`<td>${fmtHM(s.reduce((acc,r)=>acc+(r.byDept[d.name]||0),0))}</td>`).join('')}
    <td>${fmtHM(tot("total"))}</td><td>${fmtHM(tot("ot"))}</td>
    <td>${tot("tDays")}</td><td>${fmtMoney(tot("pd"))}</td><td>${fmtDays(totalLeaveDays)}</td>
  </tr>`:'';

  // Leave type summary cards
  const leaveTypeSummary=LEAVE_TYPES.map(lt=>{
    const t=s.reduce((sum,r)=>sum+(r.leaveBreakdown?.[lt.id]||0),0);
    if(!t)return '';
    return `<div class="kc" style="border-left-color:${lt.color};flex:0 0 auto;min-width:100px;padding:10px">
      <div class="kl">${lt.label}</div><div class="kv" style="color:${lt.color};font-size:17px">${fmtDays(t)}</div><div class="ks">days</div></div>`;
  }).filter(Boolean).join('');

  // Leave blocks
  const lvBlocks=emps.map(emp=>{
    const my=applyReportFilters(state.leaves,"from").filter(r=>r.employee===emp);
    if(!my.length)return '';
    const sub=my.reduce((a,r)=>a+Number(r.days||0),0);
    return `<div class="emp-block lv">
      <div class="emp-head"><span>📅 ${employeeBadge(emp)}</span><span class="emp-head-tag">${my.length} leaves</span></div>
      <table><thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Notes</th></tr></thead>
      <tbody>${my.slice().sort((a,b)=>(b.from||"").localeCompare(a.from||"")).map(r=>{
        const lt=leaveTypeInfo(r.type);
        return `<tr><td><span class="lv-badge" style="background:${lt.color}22;color:${lt.color}">${lt.label}</span></td>
          <td>${escapeHtml(r.from||'')}</td><td>${escapeHtml(r.to||'')}</td>
          <td><strong style="color:${lt.color}">${fmtDays(r.days||0)}</strong></td>
          <td style="color:#888;font-size:9px">${escapeHtml(r.notes||'—')}</td></tr>`;
      }).join('')}</tbody></table>
      <div class="emp-sub"><span>Subtotal</span><span>${fmtDays(sub)} days</span></div>
    </div>`;
  }).join('');

  // OT blocks
  const otBlocks=emps.map(emp=>{
    const my=applyReportFilters(state.overtime).filter(r=>r.employee===emp);
    if(!my.length&&!isEmployee())return '';
    const sub=my.reduce((a,r)=>a+Number(r.hours||0),0);
    return `<div class="emp-block ot">
      <div class="emp-head"><span>▶ ${employeeBadge(emp)}</span><span class="emp-head-tag">${my.length} entries</span></div>
      ${!my.length?`<div class="empty">No overtime</div>`:`<table><thead><tr><th>Date</th><th>Time</th><th>Day</th><th>Hours</th><th>Project</th><th>Location</th><th>Notes</th></tr></thead>
      <tbody>${my.map(r=>`<tr><td>${fmtDate(r.date)}</td><td style="font-size:10px;color:#555;white-space:nowrap">${r.start&&r.end?`${r.start}–${r.end}`:'—'}</td><td>${r.day||''}</td><td style="color:#E65100;font-weight:700">${fmtHM(r.hours)}</td><td>${escapeHtml(r.project||'—')}</td><td>${escapeHtml(r.location||'—')}</td><td style="font-size:10px;color:#555">${escapeHtml(r.notes||'—')}</td></tr>`).join('')}</tbody></table>`}
      <div class="emp-sub"><span>Subtotal</span><span>${fmtHM(sub)}</span></div>
    </div>`;
  }).filter(Boolean).join('');

  // Travel blocks
  const trBlocks=emps.map(emp=>{
    const my=applyReportFilters(state.travel).filter(r=>r.employee===emp);
    if(!my.length&&!isEmployee())return '';
    const sd=my.reduce((a,r)=>a+Number(r.days||0),0);
    const sp=my.reduce((a,r)=>a+Number(r.perDiem||0),0);
    return `<div class="emp-block tr">
      <div class="emp-head"><span>▶ ${employeeBadge(emp)}</span><span class="emp-head-tag">${my.length} trips</span></div>
      ${!my.length?`<div class="empty">No travel</div>`:`<table><thead><tr><th>Date</th><th>Days</th><th>Project</th><th>Location</th><th>Per Diem</th><th>Status</th></tr></thead>
      <tbody>${my.map(r=>`<tr><td>${fmtDate(r.date)}</td><td><strong>${fmtDays(r.days)}</strong></td><td>${escapeHtml(r.project||'—')}</td><td>${escapeHtml(r.location||'—')}</td><td style="color:#6A1B9A;font-weight:700">${fmtMoney(r.perDiem)}</td><td style="font-weight:700;color:${(r.perDiemStatus||'received')==='received'?'#2E7D32':'#C62828'}">${(r.perDiemStatus||'received')==='received'?'✅ Received':'❌ Not Received'}</td></tr>`).join('')}</tbody></table>`}
      <div class="emp-sub"><span>Subtotal</span><span>${sd} days · ${fmtMoney(sp)} IQD</span></div>
    </div>`;
  }).filter(Boolean).join('');

  const sn=state.leaves.length>0;
  const bodyHTML=`
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 In the print dialog, choose <strong>"Save as PDF"</strong>
      <br><br><button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Executive Summary</h3></div>
    ${kpiCards}
    <div class="ksec"><span class="kbad">02</span><h3>Staff Work Summary</h3></div>
    <table><thead><tr><th>Employee</th>${deptHeaders}<th>Total</th><th>OT</th><th>Travel</th><th>Per Diem</th><th>Leave</th></tr></thead>
    <tbody>${summaryRows}</tbody><tfoot>${grandRow}</tfoot></table>
    ${sn?`<div class="ksec"><span class="kbad">03</span><h3>Employee Leaves</h3></div>
    ${leaveTypeSummary?`<div class="kr" style="flex-wrap:wrap">${leaveTypeSummary}</div>`:''}
    ${lvBlocks}`:''}
    <div class="ksec"><span class="kbad">${sn?'04':'03'}</span><h3>Overtime by Employee</h3></div>
    ${otBlocks||'<div class="empty">No overtime entries</div>'}
    <div class="ksec"><span class="kbad">${sn?'05':'04'}</span><h3>Travel by Employee</h3></div>
    ${trBlocks||'<div class="empty">No travel entries</div>'}
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  await openReportPDF("HR_REPORT", period, bodyHTML);
  toast("PDF export ready!");
}

window.exportCSV=exportCSV;
window.exportPDF=exportPDF;

// Returns the employees who should appear after applying the global
// employee + branch + staff-department filters (hides non-matching ones entirely).
