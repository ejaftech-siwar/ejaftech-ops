// ── Per-type reference sequences ─────────────────────────────────────────
// Every report family runs its OWN yearly counter (reportCounters/{year}_{PREFIX})
// so PM, Incident, FM-200, HR, Daily Log… never share or collide in numbering.
const REF_PREFIX = {
  HR_REPORT:"HR", DAILY_LOG:"DL", TECHNICAL_REPORT:"TR", PERIOD_REPORT:"RPT",
  PREVENTIVE_MAINTENANCE:"PM", INCIDENT:"INC",
  FM200_REFILLING:"FMR", FM200_TEST:"FMT",
  CCTV_REPORT:"CCTV", FIRE_ALARM_REPORT:"FA", ACCESS_CONTROL_REPORT:"ACS",
  INTRUSION_REPORT:"IDS", NETWORK_REPORT:"NET", ELV_REPORT:"ELV", SYSTEM_REPORT:"SYS",
  ELV_INTEGRATED_REPORT:"ELVI", HANDOVER_DOSSIER:"HOD", QUOTATION:"QUO", VARIATION:"VAR",
  DAILY_PROGRESS:"DPR", WEEKLY_PROGRESS:"WPR",
  ASSET_REPORT:"AST", CLIENT_REPORT:"CLR", DASHBOARD:"DSH", GENERAL:"RPT",
};
const REF_TYPE_LABEL = {
  HR:"HR Report", DL:"Daily Log Report", TR:"Technical Report", RPT:"Flexible Report",
  PM:"PM Report", INC:"Incident Report", FMR:"FM-200 Refilling", FMT:"FM-200 Test",
  CCTV:"CCTV Report", FA:"Fire Alarm Report", ACS:"Access Control Report",
  IDS:"Intrusion Report", NET:"Network Report", ELV:"ELV Report", SYS:"System Report",
  ELVI:"ELV Integrated Report", HOD:"Handover Dossier", QUO:"Quotation", VAR:"Variation Order",
  DPR:"Daily Progress Report", WPR:"Weekly Progress Report",
  AST:"Asset Report", CLR:"Client Report", DSH:"Dashboard Export",
};
window.REF_PREFIX=REF_PREFIX; window.REF_TYPE_LABEL=REF_TYPE_LABEL;

// `meta` lets a generator record WHICH project a document belongs to. Without
// it reportLog knew the type and the period but not the subject, so a project's
// document trail could never be reconstructed.
async function generateRefNo(reportType="GENERAL", meta){
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
      project:        (meta && meta.project) ? String(meta.project).trim() : "",
      client:         (meta && meta.client)  ? String(meta.client).trim()  : "",
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
// ═══════════════════════════════════════════════════════════════════════
//  EJAF BRAND MARK — vector rebuild of the official logo (v137)
//  Drawn as paths, not text: identical in the browser, in print and inside
//  the Word export, with no font dependency and no external image file.
//  The "A" deliberately has no crossbar — that is the brand's signature.
// ═══════════════════════════════════════════════════════════════════════
const EJAF_GLYPHS = `<g fill="#FFFFFF" transform="translate(38,112) scale(0.815)">
  <path d="M0,0 H68 V25 H25 V44 H58 V65 H25 V86 H68 V111 H0 Z"/>
  <path d="M114,0 H139 V78 C139,98 125,111 104,111 H80 V86 H101 C109,86 114,81 114,73 Z"/>
  <path d="M188,0 L224,111 H199 L188,64 L177,111 H152 Z"/>
  <path d="M238,0 H300 V25 H263 V47 H293 V69 H263 V111 H238 Z"/>
</g>
<text x="150" y="243" fill="#FFFFFF" font-family="Arial,Helvetica,sans-serif" font-size="24.5"
      letter-spacing="8" text-anchor="middle">TECHNOLOGY</text>`;
// Raster twin of the mark. Word's HTML engine cannot render inline SVG — it
// flattens <text> nodes into stray words — so the Word export uses this PNG.
const EJAF_LOGO_PNG = "data:image/png;base64,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";
window.EJAF_LOGO_PNG = EJAF_LOGO_PNG;

function ejafLogoSVG(px){
  return `<svg width="${px}" height="${px}" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" style="display:block;flex:0 0 auto">
    <rect width="300" height="300" fill="#0B3190"/>${EJAF_GLYPHS}</svg>`;
}
window.ejafLogoSVG=ejafLogoSVG;

function buildReportHTML(refNo, reportType, periodLabel, bodyHTML){
  const now=new Date();
  const dt=now.toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  const tm=now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  const user=state.profile?.name||state.profile?.employeeName||state.user?.email||"System";
  const css=`
    @page{margin:0;size:A4}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1A1A2E;font-size:11px;line-height:1.4;background:#FFFFFF}

    /* HEADER */
    .rh{background:linear-gradient(135deg,#03308B 0%,#1a4db5 60%,#0a1628 100%);
        padding:20px 26px;display:flex;justify-content:space-between;align-items:flex-start;
        -webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rlrow{display:flex;align-items:center;gap:13px}
    .rlmark{border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.28);-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rl{color:white;font-size:18px;font-weight:800;letter-spacing:1.4px;line-height:1.15;text-transform:uppercase}
    .rl span{color:#C9A84C}
    .rs{color:rgba(255,255,255,.62);font-size:10px;margin-top:5px;letter-spacing:.4px}
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
    .kl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888}
    .kv{font-size:18px;font-weight:700;margin-top:2px}
    .ks{font-size:9px;color:#888;margin-top:1px}
    .kb{border-color:#03308B}.kb .kv{color:#03308B}
    .ko{border-color:#E65100}.ko .kv{color:#E65100}
    .kg{border-color:#2e7d32}.kg .kv{color:#2e7d32}
    .kp{border-color:#6A1B9A}.kp .kv{color:#6A1B9A}
    .krd{border-color:#C62828}.krd .kv{color:#C62828}

    /* TABLES */
    table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px;border-radius:8px;overflow:hidden}
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
    .actions button{background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin:0 4px}
    .lv-badge{padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;display:inline-block}
    /* EJAF watermark — light blue, tilted, centered on every printed page */
    .wm{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;
        display:flex;align-items:center;justify-content:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .wm svg{width:82%;height:auto}
    .rh,.rd,.rb,.rf{position:relative;z-index:1}
    @media print{.no-print{display:none}body{background:#fff}}
  `;
  // EJAF wordmark watermark (letter A drawn WITHOUT its crossbar), tilted, slightly saturated blue.
  const watermark = `<div class="wm"><svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-30 150 150)" opacity="0.11" fill="#0A3FB0">
      <g fill="#0A3FB0" transform="translate(38,112) scale(0.815)">
        <path d="M0,0 H68 V25 H25 V44 H58 V65 H25 V86 H68 V111 H0 Z"/>
        <path d="M114,0 H139 V78 C139,98 125,111 104,111 H80 V86 H101 C109,86 114,81 114,73 Z"/>
        <path d="M188,0 L224,111 H199 L188,64 L177,111 H152 Z"/>
        <path d="M238,0 H300 V25 H263 V47 H293 V69 H263 V111 H238 Z"/>
      </g>
      <text x="150" y="243" fill="#0A3FB0" font-family="Arial,Helvetica,sans-serif" font-size="24.5" letter-spacing="8" text-anchor="middle">TECHNOLOGY</text>
    </g>
  </svg></div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>
${watermark}
<div class="rh">
  <div class="rlrow">
    <div class="rlmark">${ejafLogoSVG(52)}</div>
    <div>
      <div class="rl">${reportType.replace(/_/g," ")}</div>
      <div class="rs">Girêk · Operations Management System</div>
    </div>
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

// Output format is a single global switch, so every report family — Technical,
// PM, Incident, FM-200, System and the Daily/Weekly progress reports — gains
// Word export from one place.
window._rptFormat = window._rptFormat || "pdf";

async function openReportPDF(reportType, periodLabel, bodyHTML, meta){
  const refNo=await generateRefNo(reportType, meta);
  const html=buildReportHTML(refNo,reportType,periodLabel,bodyHTML);
  if(window._rptFormat==="word") return downloadReportWord(refNo,reportType,html,periodLabel);
  const win=window.open("","_blank");
  if(!win){alert("Please allow pop-ups to export PDF");return;}
  win.document.write(html);
  win.document.close();
  win.onload=()=>setTimeout(()=>win.print(),300);
}

// ═══════════════════════════════════════════════════════════════════════
//  WORD EXPORT — a document built FOR Word, not a print page shoved into it.
//  Word's HTML engine is essentially Word-2003: it understands tables and
//  inline styles, and silently drops flexbox, grid, gradients, position:fixed
//  and inline SVG (flattening <text> nodes into stray words). So the shell is
//  rebuilt with tables + inline styles and a PNG mark, and the report body is
//  translated the same way before it goes in.
// ═══════════════════════════════════════════════════════════════════════
const W_NAVY="#03308B", W_GOLD="#C9A84C", W_INK="#1B2A44", W_MUTE="#6B7B8F", W_LINE="#C9D3E4";

// Translate the shared body markup into constructs Word actually honours.
// Done on a real DOM, not with regexes — nested <div> structures cannot be
// matched reliably by pattern, and a half-converted card is worse than none.
function _wordifyBody(html){
  const doc = new DOMParser().parseFromString("<div id='_wroot'>"+html+"</div>", "text/html");
  const root = doc.getElementById("_wroot");
  const txt  = (el,cls)=>{ const n=el.querySelector("."+cls); return n?n.textContent.trim():""; };

  root.querySelectorAll("script, svg, .no-print").forEach(n=>n.remove());

  // ── section heading → full-width banded row ──
  root.querySelectorAll(".ksec").forEach(sec=>{
    const badge=txt(sec,"kbad"), h=sec.querySelector("h3");
    const t=doc.createElement("table");
    t.setAttribute("width","100%"); t.setAttribute("cellpadding","0"); t.setAttribute("cellspacing","0");
    t.setAttribute("style","margin:15pt 0 6pt;border-collapse:collapse");
    t.innerHTML=`<tr>
      <td width="30" style="background:${W_NAVY};color:${W_GOLD};font:bold 9pt Calibri;text-align:center;padding:5pt 0">${badge||"&#9642;"}</td>
      <td style="padding:5pt 9pt;background:#EEF3FB;font:bold 12pt Calibri;color:${W_NAVY}">${h?h.innerHTML:""}</td>
    </tr>`;
    sec.replaceWith(t);
  });

  // ── KPI card row → one table row of equal cells ──
  root.querySelectorAll(".kr").forEach(row=>{
    const cards=[...row.querySelectorAll(".kc")];
    if(!cards.length){ row.remove(); return; }
    const w=Math.floor(100/cards.length);
    const cells=cards.map(c=>`<td width="${w}%" style="border:1px solid ${W_LINE};padding:9pt;vertical-align:top">
        <div style="font:bold 7.5pt Calibri;color:${W_MUTE};text-transform:uppercase;letter-spacing:.5pt">${txt(c,"kl")}</div>
        <div style="font:bold 18pt Calibri;color:${W_NAVY};margin:3pt 0 1pt">${txt(c,"kv")}</div>
        <div style="font:8pt Calibri;color:${W_MUTE}">${txt(c,"ks")}</div></td>`).join("");
    const t=doc.createElement("table");
    t.setAttribute("width","100%"); t.setAttribute("cellpadding","0"); t.setAttribute("cellspacing","0");
    t.setAttribute("style","margin:6pt 0;border-collapse:collapse");
    t.innerHTML=`<tr>${cells}</tr>`;
    row.replaceWith(t);
  });

  // ── data tables get real Word borders and a navy header band ──
  root.querySelectorAll("table").forEach(t=>{
    if(t.getAttribute("cellpadding")) return;      // already converted above
    t.setAttribute("width","100%"); t.setAttribute("cellpadding","5"); t.setAttribute("cellspacing","0");
    t.setAttribute("border","1"); t.setAttribute("bordercolor",W_LINE);
    t.setAttribute("style","border-collapse:collapse;font:9.5pt Calibri;margin:5pt 0");
    t.querySelectorAll("th").forEach(th=>th.setAttribute("style",
      `background:${W_NAVY};color:#FFFFFF;font:bold 9pt Calibri;padding:6pt;text-align:left`));
    t.querySelectorAll("td").forEach(td=>{
      const s=td.getAttribute("style")||"";
      td.setAttribute("style", s+";padding:5pt;border:1px solid "+W_LINE);
    });
  });

  root.querySelectorAll("img").forEach(im=>im.setAttribute("style",
    "max-width:225px;border:1px solid "+W_LINE+";margin:4pt 6pt 4pt 0"));
  // neutralise anything Word cannot lay out
  root.querySelectorAll("[style*='display:flex'],[style*='display: flex']").forEach(n=>{
    n.setAttribute("style",(n.getAttribute("style")||"").replace(/display:\s*flex/gi,"display:block"));
  });
  return root.innerHTML;
}

function downloadReportWord(refNo, reportType, html, periodLabel){
  try{
    const body = _wordifyBody((html.match(/<div class="rb">([\s\S]*)<\/div>\s*<div class="rf">/i)||[,""])[1] || html);
    const user = (state.profile && (state.profile.name||state.profile.employeeName)) || (state.user&&state.user.email) || "";
    const now  = new Date();
    const dt   = now.toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
    const title= reportType.replace(/_/g," ");

    const header = `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr>
        <td width="66" style="background:${W_NAVY};padding:10pt 0 10pt 10pt;vertical-align:middle">
          <img src="${EJAF_LOGO_PNG}" width="56" height="56" alt="EJAF Technology"/>
        </td>
        <td style="background:${W_NAVY};padding:10pt 12pt;vertical-align:middle">
          <div style="font:bold 15pt Calibri;color:#FFFFFF;letter-spacing:.6pt;text-transform:uppercase">${title}</div>
          <div style="font:8.5pt Calibri;color:#B9C9E6;margin-top:3pt">Gir&#xEA;k &#183; Operations Management System</div>
        </td>
        <td width="215" style="background:${W_NAVY};padding:10pt 12pt;text-align:right;vertical-align:middle">
          <div style="font:bold 11pt Calibri;color:${W_GOLD}">${refNo}</div>
          <div style="font:8pt Calibri;color:#B9C9E6;margin-top:3pt">Issued: ${dt}<br/>Period: ${periodLabel||"&#8212;"}<br/>By: ${user}</div>
        </td>
      </tr>
      <tr><td colspan="3" style="background:${W_GOLD};font-size:0;line-height:0;height:3pt">&nbsp;</td></tr>
    </table>`;

    const footer = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20pt;border-top:1px solid ${W_LINE}">
      <tr>
        <td style="font:7.5pt Calibri;color:${W_MUTE};padding-top:6pt">EJAF Technology &#183; Gir&#xEA;k &#183; Confidential<br/>Automatically generated by Gir&#xEA;k</td>
        <td style="font:7.5pt Calibri;color:${W_MUTE};padding-top:6pt;text-align:right">Powered by Siwar &#183; ${refNo}</td>
      </tr></table>`;

    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title} ${refNo}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  @page WordSection1{size:21cm 29.7cm;margin:1.5cm 1.4cm 1.5cm 1.4cm;mso-header-margin:.8cm;mso-footer-margin:.8cm}
  div.WordSection1{page:WordSection1}
  body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:${W_INK}}
  table{border-collapse:collapse}
  td,th{vertical-align:top}
  h3{font-size:12pt;color:${W_NAVY};margin:0}
  p{margin:4pt 0}
</style></head>
<body><div class="WordSection1">${header}${body}${footer}</div></body></html>`;

    const blob=new Blob(["\ufeff",doc],{type:"application/msword"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`EJAF_${reportType}_${refNo}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast("📝 Word file downloaded ✓");
  }catch(err){ console.error(err); toast("Word export failed: "+err.message); }
}
window.downloadReportWord=downloadReportWord;

// A PDF / Word chooser to sit beside any Generate button
function rptFormatToggle(){
  const w=window._rptFormat==="word";
  return `<div style="display:flex;gap:6px;margin-bottom:9px">
    <button class="btn btn-sm ${w?"btn-secondary":""}" style="${w?"":"background:#C9A84C;color:#1B3A6B;border:none;"}flex:1;font-weight:800" onclick="window._rptFormat='pdf';render()">📄 PDF</button>
    <button class="btn btn-sm ${w?"":"btn-secondary"}" style="${w?"background:#2E5FA3;color:#fff;border:none;":""}flex:1;font-weight:800" onclick="window._rptFormat='word';render()">📝 Word</button>
  </div>`;
}
window.rptFormatToggle=rptFormatToggle;

// ═══════════════════════════════════════════════════════════════════════
//  EXPORTS (Excel CSV + PDF)
// ═══════════════════════════════════════════════════════════════════════
// Work-items block for branded PDFs: one row per JOB with its status journey
function workItemsReportHTML(rows,badge){
  if(typeof buildWorkItems!=="function") return "";
  const wis=buildWorkItems(rows||[]);
  if(!wis.length) return "";
  const open=wis.filter(w=>!w.closed).length;
  return `<div class="ksec"><span class="kbad">${badge||"WI"}</span><h3>Work Items — ${wis.length} job(s), ${open} still open</h3></div>
  <table><thead><tr><th>Work item</th><th>Scope</th><th>Status journey</th><th>Current</th><th>Visits</th><th>Hours</th></tr></thead>
  <tbody>${wis.slice(0,60).map(w=>`<tr>
    <td><strong>${escapeHtml(w.title)}</strong><br><span style="font-size:9px;color:#888">${fmtDate(w.firstDate)}${w.visits>1?` → ${fmtDate(w.lastDate)}`:""}</span></td>
    <td style="font-size:10px">${escapeHtml(w.scopeLabel)}</td>
    <td style="font-size:10px">${w.timeline.map(t=>escapeHtml(t.status)).join(" → ")}</td>
    <td style="font-size:10px;font-weight:800;color:${w.closed?"#2E7D32":"#E65100"}">${escapeHtml(w.status)}</td>
    <td>${w.visits}</td><td>${fmtHM(w.hours)}</td></tr>`).join("")}</tbody></table>`;
}
window.workItemsReportHTML=workItemsReportHTML;

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
  const rows = apprFilter(applyReportFilters(visibleRows(state.daily)))
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
    return `<tr><td><span style="background:${d.color}22;color:${d.color};padding:2px 8px;border-radius:12px;font-weight:700;font-size:10px">${escapeHtml(d.name)}</span></td>
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
    <td>${escapeHtml(r.project||'')}${(r.area||r.site)?`<br><span style="font-size:9px;color:#1565C0">${r.area?`🗺️ ${escapeHtml(r.area)}`:''}${r.site?` · 📍 ${escapeHtml(r.site)}`:''}</span>`:''}${(r.taskCategory||r.taskStatus||r.workType)?`<br><span style="font-size:9px;color:#6A1B9A">${r.taskCategory?escapeHtml(r.taskCategory):''}${r.taskSubcategory?'›'+escapeHtml(r.taskSubcategory):''}${r.taskStatus?` · ${escapeHtml(r.taskStatus)}`:''}${r.workType?` · ${escapeHtml(r.workType)}`:''}</span>`:''}</td>
    <td><span style="background:${(state.departments.find(d=>d.name===r.dept)||{color:'#888'}).color}22;color:${(state.departments.find(d=>d.name===r.dept)||{color:'#888'}).color};padding:2px 7px;border-radius:8px;font-size:10px;font-weight:700">${escapeHtml(r.dept||'')}</span></td>
    <td>${r.location?`<span style="background:#E3F2FD;color:#1565C0;padding:2px 7px;border-radius:8px;font-size:10px">📍 ${escapeHtml(r.location)}</span>`:'—'}${r.gpsLat?` <a href="${gpsMapLink(r.gpsLat,r.gpsLng)}" style="font-size:9px;color:#2E7D32;font-weight:700;text-decoration:none">🛰️ Map</a>`:r.gpsDenied?` <span style="font-size:9px;color:#C62828">🚫 GPS</span>`:''}</td>
    <td style="color:#2E7D32;font-weight:700">${fmtHM(r.duration)}</td>
    <td style="font-size:10px;color:#555;max-width:120px;word-break:break-word">${escapeHtml((r.resolutionText||'').slice(0,80))}${(r.resolutionText||'').length>80?'…':''}</td>
  </tr>`).join('');

  const bodyHTML = `
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 Choose <strong>"Save as PDF"</strong> in the print dialog
      <br><br>
      <button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
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
    const rows = apprFilter(applyReportFilters(visibleRows(state.daily)))
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
      <div class="kl">${lt.label}</div><div class="kv" style="color:${lt.color};font-size:16px">${fmtDays(t)}</div><div class="ks">days</div></div>`;
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
      ${!my.length?`<div class="empty">No travel</div>`:`<table><thead><tr><th>From</th><th>To</th><th>Days</th><th>Project</th><th>Location</th><th>Per Diem</th><th>Status</th></tr></thead>
      <tbody>${my.map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${(()=>{const t=trEnd(r);return (t&&t!==r.date)?fmtDate(t):'<span style="color:#9AA7B8">—</span>';})()}</td><td><strong>${fmtDays(r.days)}</strong></td><td>${escapeHtml(r.project||'—')}</td><td>${escapeHtml(r.location||'—')}</td><td style="color:#6A1B9A;font-weight:700">${fmtMoney(r.perDiem)}</td><td style="font-weight:700;color:${(r.perDiemStatus||'received')==='received'?'#2E7D32':'#C62828'}">${(r.perDiemStatus||'received')==='received'?'✅ Received':'❌ Not Received'}</td></tr>`).join('')}</tbody></table>`}
      <div class="emp-sub"><span>Subtotal</span><span>${sd} days · ${fmtMoney(sp)} IQD</span></div>
    </div>`;
  }).filter(Boolean).join('');

  const sn=state.leaves.length>0;
  const bodyHTML=`
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 In the print dialog, choose <strong>"Save as PDF"</strong>
      <br><br><button onclick="window.print()" style="background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888;color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin-left:6px">Close</button>
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
