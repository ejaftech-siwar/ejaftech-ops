// ── Per-type reference sequences ─────────────────────────────────────────
// Every report family runs its OWN yearly counter (reportCounters/{year}_{PREFIX})
// so PM, Incident, FM-200, HR, Daily Log… never share or collide in numbering.
const REF_PREFIX = {
  HR_REPORT:"HR", DAILY_LOG:"DL", TECHNICAL_REPORT:"TR", PERIOD_REPORT:"RPT",
  PREVENTIVE_MAINTENANCE:"PM", INCIDENT:"INC",
  FM200_REFILLING:"FMR", FM200_TEST:"FMT",
  CCTV_REPORT:"CCTV", FIRE_ALARM_REPORT:"FA", ACCESS_CONTROL_REPORT:"ACS",
  INTRUSION_REPORT:"IDS", NETWORK_REPORT:"NET", ELV_REPORT:"ELV", SYSTEM_REPORT:"SYS",
  ELV_INTEGRATED_REPORT:"ELVI", HANDOVER_DOSSIER:"HOD", QUOTATION:"QUO", VARIATION:"VAR", COST_REPORT:"CST", INVOICE:"INV", EXPENSE_CLAIM:"EXP", ADVANCES_REGISTER:"ADV",
  DAILY_PROGRESS:"DPR", WEEKLY_PROGRESS:"WPR",
  ASSET_REPORT:"AST", CLIENT_REPORT:"CLR", DASHBOARD:"DSH", GENERAL:"RPT",
};
const REF_TYPE_LABEL = {
  HR:"HR Report", DL:"Daily Log Report", TR:"Technical Report", RPT:"Flexible Report",
  PM:"PM Report", INC:"Incident Report", FMR:"FM-200 Refilling", FMT:"FM-200 Test",
  CCTV:"CCTV Report", FA:"Fire Alarm Report", ACS:"Access Control Report",
  IDS:"Intrusion Report", NET:"Network Report", ELV:"ELV Report", SYS:"System Report",
  ELVI:"ELV Integrated Report", HOD:"Handover Dossier", QUO:"Quotation", VAR:"Variation Order", CST:"Cost & Revenue Report", INV:"Invoice", EXP:"Expense Report", ADV:"Advances Register",
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

// ═══ DOCUMENT BRANDING (v206) ═══════════════════════════════════════════
// The subtitle and the footer were hard-coded, so every document carried the
// tool's own name and an attribution line whether or not that was wanted. A
// report leaving this company is EJAF's document, not the software's, and what
// it says about itself should be the company's decision.
//
// "Confidential" was hard-coded too. A confidentiality mark that appears on
// every page regardless of content is ignored within a week, and marking a
// routine maintenance sheet confidential is the fastest way to make the label
// meaningless on the document where it matters. It is therefore off by default
// and switched on per report family, or globally, from Settings.
const BRAND_DEFAULTS = {
  subtitle:   "Girêk · Operations Management System",
  footerLeft: "EJAF Technology · Girêk",
  footerNote: "Automatically generated by Girêk",
  footerRight:"Powered by Siwar",
  confidential: false,          // opt-in, never assumed
  confidentialText: "Confidential",
  showSubtitle: true,
  showFooterNote: true,
  showFooterRight: true,
};
function brandCfg(){
  const d=(state.settingsDocs||[]).find(x=>x.id==="branding")||{};
  const out={};
  Object.keys(BRAND_DEFAULTS).forEach(k=>{
    out[k] = (d[k]===undefined || d[k]===null) ? BRAND_DEFAULTS[k] : d[k];
  });
  return out;
}
// Assemble the left footer from the parts that are switched on. Building it
// here rather than storing one string means a company can drop the tool's name
// without also losing its own.
function brandFooterLeft(){
  const b=brandCfg();
  const bits=[String(b.footerLeft||"").trim()].filter(Boolean);
  if(b.confidential && String(b.confidentialText||"").trim())
    bits.push(String(b.confidentialText).trim());
  let s=escapeHtml(bits.join(" \u00b7 "));
  if(b.showFooterNote && String(b.footerNote||"").trim())
    s += (s?"<br>":"") + escapeHtml(String(b.footerNote).trim());
  return s;
}
Object.assign(window,{BRAND_DEFAULTS, brandCfg, brandFooterLeft});

function buildReportHTML(refNo, reportType, periodLabel, bodyHTML){
  const now=new Date();
  const dt=now.toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  const tm=now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
  const user=state.profile?.name||state.profile?.employeeName||state.user?.email||"System";
  const css=`
    @page{margin:0;size:A4}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1A1A2E;font-size:10.5pt;line-height:1.55;background:#FFFFFF}
    p{line-height:1.7}

    /* HEADER */
    .rh{background:linear-gradient(135deg,#03308B 0%,#1a4db5 60%,#0a1628 100%);
        padding:20px 26px;display:flex;justify-content:space-between;align-items:flex-start;
        -webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rlrow{display:flex;align-items:center;gap:13px}
    .rlmark{border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.28);-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rl{color:white;font-size:18px;font-weight:700;letter-spacing:1.4px;line-height:1.15;text-transform:uppercase}
    .rl span{color:#C9A84C}
    .rs{color:rgba(255,255,255,.62);font-size:8.5pt;margin-top:5px;letter-spacing:.4px}
    .rt{color:rgba(255,255,255,.45);font-size:8pt;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
    .rr{text-align:right}
    .rn{color:#C9A84C;font-size:12.5pt;font-weight:700;letter-spacing:.3px}
    .rm{color:rgba(255,255,255,.72);font-size:8.5pt;margin-top:5px;line-height:1.75}

    /* GOLD DIVIDER */
    .rd{height:3px;background:linear-gradient(90deg,#C9A84C,#03308B);
        -webkit-print-color-adjust:exact;print-color-adjust:exact}

    /* BODY */
    .rb{padding:18px 26px}

    /* SECTION HEADERS */
    .ksec{display:flex;align-items:center;gap:10px;margin:18px 0 10px;page-break-inside:avoid}
    .kbad{background:#03308B;color:#C9A84C;font-size:9pt;font-weight:700;padding:4px 9px;
          border-radius:4px;letter-spacing:1px;
          -webkit-print-color-adjust:exact;print-color-adjust:exact}
    .ksec h3{font-size:13pt;font-weight:700;color:#03308B;letter-spacing:.2px}

    /* KPI CARDS */
    .kr{display:flex;gap:8px;margin:14px 0}
    .kc{flex:1;padding:12px;border-radius:8px;border-left:4px solid;background:#f8faff;
        page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .kl{font-size:8.5pt;text-transform:uppercase;letter-spacing:1px;color:#6B7B8F}
    .kv{font-size:19pt;font-weight:700;margin-top:3px;line-height:1.1}
    .ks{font-size:8.5pt;color:#6B7B8F;margin-top:2px}
    .kb{border-color:#03308B}.kb .kv{color:#03308B}
    .ko{border-color:#E65100}.ko .kv{color:#E65100}
    .kg{border-color:#2e7d32}.kg .kv{color:#2e7d32}
    .kp{border-color:#6A1B9A}.kp .kv{color:#6A1B9A}
    .krd{border-color:#C62828}.krd .kv{color:#C62828}

    /* TABLES */
    table{width:100%;border-collapse:collapse;margin:10px 0;font-size:9.5pt;border-radius:8px;overflow:hidden}
    thead tr{background:#03308B;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    thead th{color:white;padding:9px 10px;text-align:left;font-size:8.5pt;text-transform:uppercase;letter-spacing:.6px;font-weight:700;line-height:1.35}
    tbody tr:nth-child(even) td{background:#f0f4ff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    /* Rows breathe, and long descriptions wrap instead of being squeezed. */
    tbody td{padding:8px 10px;border-bottom:1px solid #e0e8ff;line-height:1.5;vertical-align:top}
    tfoot tr{background:#0a1628;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    tfoot td{color:#C9A84C;padding:10px;font-weight:700;font-size:10pt;border-top:2px solid #C9A84C}
    tr.grand td{background:linear-gradient(135deg,#C9A84C,#B58E2E)!important;color:#03308B;font-weight:700!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}

    /* BREAKDOWN CARDS \u2014 department, project and project-code blocks */
    .dept-card{border:1px solid #D6E4F0;border-left:4px solid #03308B;border-radius:8px;
      padding:10px 13px;margin-bottom:8px;background:#fff;page-break-inside:avoid}
    .dept-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
    .dept-name{font-size:10.5pt;font-weight:700;letter-spacing:.2px}
    .dept-val{font-size:13.5pt;font-weight:700;font-family:Georgia,serif;white-space:nowrap}
    .dept-sub{font-size:8.5pt;color:#6B7B8F;margin-top:4px;line-height:1.7}
    .bar{height:5px;background:#E8EEF6;border-radius:4px;overflow:hidden;margin-top:6px}
    .bar-fill{height:100%;border-radius:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .kpi-grid{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap}
    .kpi{flex:1;min-width:110px;padding:12px;border-radius:8px;border-left:4px solid #03308B;
      background:#f8faff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .kpi-label{font-size:8pt;text-transform:uppercase;letter-spacing:1px;color:#888}
    .kpi-val{font-size:18px;font-weight:700;margin-top:2px}
    .kpi-sub{font-size:8pt;color:#888;margin-top:1px}
    /* Two-column grid so breakdown cards do not run one-per-line down a page */
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    @media print{ .grid2{grid-template-columns:1fr 1fr} }

    /* EMPLOYEE BLOCKS */
    .emp-block{margin-bottom:10px;border:1px solid #D6E4F0;border-radius:8px;overflow:hidden;page-break-inside:avoid;border-left:4px solid #03308B}
    .emp-head{background:linear-gradient(135deg,#03308B,#1a4db5);color:white;padding:8px 14px;font-size:9.5pt;font-weight:700;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .emp-head-tag{background:#C9A84C;color:#03308B;padding:2px 9px;border-radius:10px;font-size:8.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .emp-sub{padding:7px 14px;font-size:9.5pt;font-weight:700;color:white;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .emp-block.ot{border-left-color:#E65100}.emp-block.ot .emp-sub{background:linear-gradient(135deg,#E65100,#BF360C)}
    .emp-block.tr{border-left-color:#2e7d32}.emp-block.tr .emp-sub{background:linear-gradient(135deg,#2e7d32,#1B5E20)}
    .emp-block.lv{border-left-color:#C62828}.emp-block.lv .emp-sub{background:linear-gradient(135deg,#C62828,#8B1818)}

    /* FOOTER */
    .rf{margin-top:24px;padding:12px 26px;background:#f0f4ff;border-top:3px solid #03308B;
        display:flex;justify-content:space-between;align-items:center;
        -webkit-print-color-adjust:exact;print-color-adjust:exact}
    .rfl{font-size:8pt;color:#888;line-height:1.6}
    .rfr{font-size:8pt;color:#03308B;font-weight:700}

    .empty{padding:14px;text-align:center;color:#888;font-style:italic;font-size:8.5pt}
    .actions{padding:12px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000}
    .actions button{background:#03308B;color:#C9A84C;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;margin:0 4px}
    .lv-badge{padding:2px 8px;border-radius:12px;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.3px;display:inline-block}
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
      ${(function(){ const b=brandCfg();
        return (b.showSubtitle && String(b.subtitle||"").trim())
          ? `<div class="rs">${escapeHtml(String(b.subtitle).trim())}</div>` : ""; })()}
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
  <div class="rfl">${brandFooterLeft()}</div>
  <div class="rfr">${(function(){ const b=brandCfg();
    const r=(b.showFooterRight && String(b.footerRight||"").trim()) ? escapeHtml(String(b.footerRight).trim()) : "";
    return r ? `${r} \u00b7 ${refNo}` : refNo; })()}</div>
</div>
</body></html>`;
}

// Output format is a single global switch, so every report family — Technical,
// PM, Incident, FM-200, System and the Daily/Weekly progress reports — gains
// Word export from one place.
window._rptFormat = window._rptFormat || "pdf";

// ═══ MANUAL DOCUMENT NUMBER (v191) ═════════════════════════════
// Some documents must carry a number the company's own filing system dictates
// rather than the app's sequence — a client's PO format, an ISO document code,
// or a number already quoted in correspondence. Every printed report passes
// through openReportPDF, so putting the override here covers all of them at
// once instead of touching a dozen generators.
//
// The override is deliberately SINGLE-USE: it applies to the very next document
// and is then cleared. A sticky value would silently stamp the same number onto
// every later report, which is far worse than having to type it again.
window._refOverride = window._refOverride || "";
window.setRefOverride = function(v){ window._refOverride = String(v||"").trim(); };
window.clearRefOverride = function(){ window._refOverride = ""; };

// The control every report screen can drop in above its export button.
// A one-line route to the branding settings, shown on every export screen.
// The setting lives in one place; this is a signpost, not a second copy.
function brandLink(){
  if(typeof isAdmin==="function" && !isAdmin()) return "";
  const b=(typeof brandCfg==="function")?brandCfg():null;
  const foot=b?[String(b.footerLeft||"").trim(), (b.confidential?String(b.confidentialText||"").trim():"")].filter(Boolean).join(" \u00b7 "):"";
  return `<div class="brand-link">
    <span class="bl-txt">Document footer: <strong>${escapeHtml(foot||"(none)")}</strong>${b&&b.showFooterRight&&String(b.footerRight||"").trim()?` \u00b7 ${escapeHtml(String(b.footerRight).trim())}`:""}</span>
    <button type="button" class="btn btn-sm btn-secondary" onclick="gotoBranding()">\u{1F3F7}\uFE0F Edit header &amp; footer</button>
  </div>`;
}
window.gotoBranding = function(){
  window._techView="brand";
  if(typeof switchTab==="function") switchTab("Technical Classifications");
  else { state.tab="Technical Classifications"; render(); }
};
// The company name for a spreadsheet banner. Taken from the branding settings
// rather than hard-coded, so it follows whatever the company calls itself.
// (Excel cannot hold the drawn logo: the sheet writer in use has no image
// support, so the name is set in the brand colours instead.)
function xlBrandName(){
  // Guarded: an export must never fail because the branding settings have not
  // loaded yet. The company name is presentation, not data.
  let b=null;
  try{ b=(typeof brandCfg==="function")?brandCfg():null; }catch(e){}
  const left=b?String(b.footerLeft||"").trim():"";
  // "EJAF Technology \u00b7 Gir\u00eak" \u2192 "EJAF Technology"
  const name=left.split("\u00b7")[0].trim();
  return (name || "EJAF Technology").toUpperCase();
}
function xlBrandSubtitle(){
  let b=null;
  try{ b=(typeof brandCfg==="function")?brandCfg():null; }catch(e){}
  return (b && b.showSubtitle && String(b.subtitle||"").trim()) || "";
}
Object.assign(window,{xlBrandName, xlBrandSubtitle});

Object.assign(window,{brandLink});

function refOverrideField(){
  const v = window._refOverride || "";
  return `<div class="field" style="margin-bottom:9px">
    <label>Document number <span style="font-weight:500;color:var(--muted);font-size:10px">— leave blank to let the app issue one</span></label>
    <input value="${escapeHtml(v)}" oninput="setRefOverride(this.value)"
           placeholder="e.g. EJ\\EBL\\04\\FFIN-20260003">
    <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">
      ${v ? `The next document will be numbered <strong>${escapeHtml(v)}</strong>, then this box clears itself so the following one is not stamped with it too.`
          : `Type a number only when company filing requires its own. Otherwise the app issues the next in sequence.`}
    </div>
  </div>`;
}
window.refOverrideField = refOverrideField;

async function openReportPDF(reportType, periodLabel, bodyHTML, meta){
  // A hand-typed number is used verbatim and does NOT consume the automatic
  // sequence, so overriding one document never leaves a gap in the app's own
  // numbering. It is still logged, so the document remains traceable.
  const manual = String(window._refOverride||"").trim();
  let refNo;
  if(manual){
    refNo = manual;
    window._refOverride = "";                       // single use, as documented
    try{
      const {db, collection, addDoc} = window.__fb;
      addDoc(collection(db,"reportLog"), {
        refNo, reportType, prefix:(window.REF_PREFIX&&window.REF_PREFIX[reportType])||"",
        manual:true,
        exportedBy:(state.user&&state.user.email)||"",
        exportedByName:(state.profile&&(state.profile.name||state.profile.employeeName))||"",
        period:(typeof getPeriod==="function")?getPeriod():"",
        project:(meta&&meta.project)?String(meta.project).trim():"",
        client:(meta&&meta.client)?String(meta.client).trim():"",
        at:new Date().toISOString(),
      }).catch(()=>{});
    }catch(e){}
  }else{
    refNo = await generateRefNo(reportType, meta);
  }
  const html=buildReportHTML(refNo,reportType,periodLabel,bodyHTML);
  if(window._rptFormat==="word")  return downloadReportWord(refNo,reportType,html,periodLabel);
  if(window._rptFormat==="excel") return downloadReportExcel(refNo,reportType,bodyHTML,periodLabel);
  const win=window.open("","_blank");
  if(!win){alert("Please allow pop-ups to export PDF");return;}
  win.document.write(html);
  win.document.close();
  win.onload=()=>setTimeout(()=>win.print(),300);
}

// ═══════════════════════════════════════════════════════════════════════
//  EXCEL EXPORT (v238)
// ═══════════════════════════════════════════════════════════════════════
//  A report body is HTML, and a spreadsheet is rows of cells, so the two do
//  not map perfectly. What DOES map is the part a client actually wants in
//  Excel: the tables — checklists, readings, itemised findings — which they
//  filter, sort and re-total themselves. Everything else (headings, prose,
//  signature blocks) is carried across as labelled rows so the document still
//  reads as one piece rather than a pile of loose tables.
//
//  Signatures are deliberately NOT drawn: an image pasted into a spreadsheet
//  is not evidence of anything, and this library cannot embed one. The names
//  and roles are written instead, with a blank line to sign by hand.
function _xlText(html){
  return String(html||"")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}

// Pull every <table> out of a report body, as arrays of rows of plain text.
function _xlTablesFrom(html){
  const out=[];
  const tables=String(html||"").match(/<table[\s\S]*?<\/table>/gi)||[];
  tables.forEach(tb=>{
    const rows=[];
    (tb.match(/<tr[\s\S]*?<\/tr>/gi)||[]).forEach(tr=>{
      const cells=[];
      (tr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi)||[]).forEach(td=>{
        const span=/colspan\s*=\s*["']?(\d+)/i.exec(td);
        cells.push(_xlText(td));
        // A merged cell occupies several columns; pad so the ones after it
        // still line up with the header above them.
        for(let k=1;k<(span?+span[1]:1);k++) cells.push("");
      });
      // A header row is one whose cells are <th>.
      if(cells.some(x=>x!=="")) rows.push({cells, head:/<th[\s>]/i.test(tr)});
    });
    if(rows.length) out.push(rows);
  });
  return out;
}

async function downloadReportExcel(refNo, reportType, bodyHTML, periodLabel){
  if(typeof XLSX==="undefined") return toast("Spreadsheet engine not loaded \u2014 reconnect and try again");
  try{
    const A=[], rowMap={}, cellMap={};
    const title=(typeof REF_TYPE_LABEL!=="undefined" && REF_TYPE_LABEL[String(refNo).split("-")[0]])||String(reportType||"Report").replace(/_/g," ");
    A.push([(typeof xlBrandName==="function")?xlBrandName():"EJAF TECHNOLOGY"]); rowMap[0]="title";
    A.push([title]);                                   rowMap[1]="subtitle";
    A.push([`${refNo||""}${periodLabel?"  \u00b7  "+periodLabel:""}`]); rowMap[2]="subtitle";
    A.push([]);

    // Section headings carry the same numbered badges as the printed document,
    // so a reader can match a sheet row to a page.
    const secs=[...String(bodyHTML||"").matchAll(/<div class="ksec"[\s\S]*?<h3>([\s\S]*?)<\/h3>/gi)]
      .map(m=>_xlText(m[1]));   // matchAll yields arrays, not match objects
    const tables=_xlTablesFrom(bodyHTML);

    tables.forEach((rows,ti)=>{
      if(secs[ti]){ rowMap[A.length]="section"; A.push([secs[ti]]); }
      rows.forEach(r=>{
        if(r.head) rowMap[A.length]="header";
        A.push(r.cells);
      });
      A.push([]);
    });

    if(!tables.length){
      A.push(["This report has no tabular section \u2014 the PDF carries its full layout."]);
      rowMap[A.length-1]="note";
    }

    const widest=A.reduce((m,r)=>Math.max(m,r.length),1);
    const ws=XLSX.utils.aoa_to_sheet(A);
    ws["!cols"]=Array.from({length:widest},(_,i)=>({wch:i===0?34:16}));
    ws["!merges"]=[0,1,2].map(r=>({s:{r,c:0},e:{r,c:Math.max(widest-1,1)}}));
    if(typeof xlDress==="function") xlDress(ws,{rows:rowMap, cells:cellMap,
      rowsHt:[{hpt:26},{hpt:18},{hpt:16}]});

    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const safe=(s)=>String(s||"").replace(/[^A-Za-z0-9._-]+/g,"_").slice(0,40);
    XLSX.writeFile(wb, `${safe(refNo||reportType)}.xlsx`);
    toast("Excel exported \u2713");
  }catch(e){ console.error(e); toast("Excel export failed: "+e.message); }
}
Object.assign(window,{downloadReportExcel, _xlTablesFrom, _xlText});

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
        <td style="font:7.5pt Calibri;color:${W_MUTE};padding-top:6pt">${brandFooterLeft()}</td>
        <td style="font:7.5pt Calibri;color:${W_MUTE};padding-top:6pt;text-align:right">${(function(){ const b=brandCfg();
          const r=(b.showFooterRight && String(b.footerRight||"").trim()) ? escapeHtml(String(b.footerRight).trim()) : "";
          return r ? `${r} &#183; ${refNo}` : refNo; })()}</td>
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
// `withExcel` is passed only by screens that actually have a spreadsheet
// generator. Offering Excel on an inspection certificate would be a promise the
// engine cannot keep, so the third button appears only where it is real.
function rptFormatToggle(withExcel){
  if(withExcel){
    const f=window._rptFormat||"pdf";
    const B=(id,lb,bg,fg)=>`<button class="btn btn-sm ${f===id?"":"btn-secondary"}" style="${f===id?`background:${bg};color:${fg};border:none;`:""}flex:1;font-weight:700" onclick="window._rptFormat='${id}';render()">${lb}</button>`;
    return `<div style="display:flex;gap:6px;margin-bottom:9px">
      ${B("pdf","\u{1F4C4} PDF","#C9A84C","#1B3A6B")}
      ${B("excel","\u{1F4CA} Excel","#1B7A43","#fff")}
      ${B("word","\u{1F4DD} Word","#2E5FA3","#fff")}
    </div>`;
  }
  const w=window._rptFormat==="word";
  return `<div style="display:flex;gap:6px;margin-bottom:9px">
    <button class="btn btn-sm ${w?"btn-secondary":""}" style="${w?"":"background:#C9A84C;color:#1B3A6B;border:none;"}flex:1;font-weight:700" onclick="window._rptFormat='pdf';render()">📄 PDF</button>
    <button class="btn btn-sm ${w?"":"btn-secondary"}" style="${w?"background:#2E5FA3;color:#fff;border:none;":""}flex:1;font-weight:700" onclick="window._rptFormat='word';render()">📝 Word</button>
  </div>`;
}
window.rptFormatToggle=rptFormatToggle;

// Label and icon for whichever format is selected, so a button never says
// "PDF" while Excel is the active choice.
function _fmtName(){ const f=window._rptFormat||"pdf";
  return f==="excel"?"Excel":f==="word"?"Word":"PDF"; }
function _fmtIcon(){ const f=window._rptFormat||"pdf";
  return f==="excel"?"\u{1F4CA}":f==="word"?"\u{1F4DD}":"\u{1F4C4}"; }
Object.assign(window,{_fmtName,_fmtIcon});

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
    <td><strong>${escapeHtml(w.title)}</strong><br><span style="font-size:8pt;color:#888">${fmtDate(w.firstDate)}${w.visits>1?` → ${fmtDate(w.lastDate)}`:""}</span></td>
    <td style="font-size:8.5pt">${escapeHtml(w.scopeLabel)}</td>
    <td style="font-size:8.5pt">${w.timeline.map(t=>escapeHtml(t.status)).join(" → ")}</td>
    <td style="font-size:8.5pt;font-weight:700;color:${w.closed?"#2E7D32":"#E65100"}">${escapeHtml(w.status)}</td>
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
    return `<tr><td><span style="background:${d.color}22;color:${d.color};padding:2px 8px;border-radius:12px;font-weight:700;font-size:8.5pt">${escapeHtml(d.name)}</span></td>
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
    <td style="font-size:8.5pt;color:#555;white-space:nowrap">${r.start&&r.end?`${r.start}–${r.end}`:'—'}</td>
    <td><strong style="color:#03308B">${escapeHtml(r.employee||'')}</strong></td>
    <td>${escapeHtml(r.project||'')}${(r.area||r.site)?`<br><span style="font-size:8pt;color:#1565C0">${r.area?`🗺️ ${escapeHtml(r.area)}`:''}${r.site?` · 📍 ${escapeHtml(r.site)}`:''}</span>`:''}${(r.taskCategory||r.taskStatus||r.workType)?`<br><span style="font-size:8pt;color:#6A1B9A">${r.taskCategory?escapeHtml(r.taskCategory):''}${r.taskSubcategory?'›'+escapeHtml(r.taskSubcategory):''}${r.taskStatus?` · ${escapeHtml(r.taskStatus)}`:''}${r.workType?` · ${escapeHtml(r.workType)}`:''}</span>`:''}</td>
    <td><span style="background:${(state.departments.find(d=>d.name===r.dept)||{color:'#888'}).color}22;color:${(state.departments.find(d=>d.name===r.dept)||{color:'#888'}).color};padding:2px 7px;border-radius:8px;font-size:8.5pt;font-weight:700">${escapeHtml(r.dept||'')}</span></td>
    <td>${r.location?`<span style="background:#E3F2FD;color:#1565C0;padding:2px 7px;border-radius:8px;font-size:8.5pt">📍 ${escapeHtml(r.location)}</span>`:'—'}${r.gpsLat?` <a href="${gpsMapLink(r.gpsLat,r.gpsLng)}" style="font-size:8pt;color:#2E7D32;font-weight:700;text-decoration:none">🛰️ Map</a>`:r.gpsDenied?` <span style="font-size:8pt;color:#C62828">🚫 GPS</span>`:''}</td>
    <td style="color:#2E7D32;font-weight:700">${fmtHM(r.duration)}</td>
    <td style="font-size:8.5pt;color:#555;max-width:120px;word-break:break-word">${escapeHtml((r.resolutionText||'').slice(0,80))}${(r.resolutionText||'').length>80?'…':''}</td>
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

// ═══ TABLES INSIDE TEXT FIELDS (v201) ═══════════════════════════════════
// An incident description is often a set of readings, not a paragraph: four
// cameras and their status, three fuses and their ratings, a before/after
// measurement. Forcing that into prose loses the shape of the information, and
// the report then reads as an apology rather than a record.
//
// The syntax is whatever a spreadsheet already produces. Copying cells out of
// Excel puts TAB-separated rows on the clipboard, so pasting them here simply
// works; typing pipes by hand works too. No editor, no toolbar, no new data
// model — the field stays plain text, so nothing that already reads it breaks.
//
//   Camera      | Location | Status
//   ------------|----------|--------
//   CAM-01      | Lobby    | Offline
//   CAM-02      | Car park | OK
//
// A line is part of a table when it contains a tab or a pipe; a run of such
// lines becomes one table. Everything else is left exactly as it was.
// A pasted cell may itself contain a newline; Excel then wraps that cell in
// double quotes. Splitting the paste on "\n" tears such a row apart, so rows
// are separated here with the quoting respected. Two rows of the equipment
// report we tested against did exactly this.
function _rtRows(txt){
  const s=String(txt==null?"":txt);
  const rows=[]; let cur="", q=false;
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(ch==='"'){
      if(q && s[i+1]==='"'){ cur+='"'; i++; }   // an escaped quote inside a cell
      else q=!q;
      cur+=ch; continue;
    }
    if(!q && (ch==="\n" || (ch==="\r" && s[i+1]!=="\n"))){ rows.push(cur); cur=""; continue; }
    if(!q && ch==="\r"){ continue; }
    cur+=ch;
  }
  rows.push(cur);
  return rows;
}
// Strip the wrapping quotes Excel adds, and turn the doubled quotes back.
function _rtClean(v){
  let s=String(v==null?"":v).trim();
  if(s.length>1 && s[0]==='"' && s[s.length-1]==='"') s=s.slice(1,-1).replace(/""/g,'"');
  return s.trim();
}
function _rtSplitRow(line){
  // Tabs win: an Excel paste can legitimately contain a pipe INSIDE a cell,
  // but never a tab, so choosing tabs first keeps pasted data intact.
  if(line.indexOf("\t")>=0) return line.split("\t").map(_rtClean);
  let s=line.trim();
  if(s.startsWith("|")) s=s.slice(1);
  if(s.endsWith("|"))   s=s.slice(0,-1);
  return s.split("|").map(_rtClean);
}
function _rtIsRow(line){
  return line.indexOf("\t")>=0 || (line.indexOf("|")>=0 && line.trim().length>1);
}
// A separator row (---|---) marks the line above as the header, the way it does
// in every markdown dialect people already know.
function _rtIsSep(line){
  const c=_rtSplitRow(line);
  return c.length>1 && c.every(x=>/^:?-{2,}:?$/.test(x));
}
function textHasTable(txt){
  const lines=_rtRows(txt);
  let run=0;
  for(const l of lines){
    if(_rtIsRow(l)){ run++; if(run>=2) return true; }
    else run=0;
  }
  return false;
}


// A cell whose whole text is a known status word is tinted. Matching only on
// the ENTIRE cell is deliberate: a description that merely mentions "damaged"
// must not light up, or the colour stops meaning anything.
const RT_STATUS = [
  {re:/^(intact|ok|pass|passed|good|working|operational|healthy|no damage|\u0633\u0644\u064a\u0645|\u064a\u0639\u0645\u0644)$/i,
   bg:"#E8F5E9", fg:"#2E7D32"},
  {re:/^(partially damaged|partial|minor damage|degraded|needs? (?:service|cleaning|repair)|warning|attention|\u062c\u0632\u0626\u064a|\u062a\u0644\u0641 \u062c\u0632\u0626\u064a)$/i,
   bg:"#FFF8E1", fg:"#8F6E22"},
  {re:/^(totally damaged|total|destroyed|damaged|fail|failed|faulty|not working|offline|dead|replace|\u062a\u0627\u0644\u0641|\u0645\u062a\u0636\u0631\u0631|\u0644\u0627 \u064a\u0639\u0645\u0644)$/i,
   bg:"#FDECEA", fg:"#C62828"},
  {re:/^(needs? replacement|to be replaced|pending|n\/a|not checked|unknown|\u0642\u064a\u062f \u0627\u0644\u0641\u062d\u0635)$/i,
   bg:"#ECEFF1", fg:"#546E7A"},
];
function _rtStatus(v){
  const s=String(v==null?"":v).trim();
  if(!s || s.length>28) return null;
  for(const x of RT_STATUS){ if(x.re.test(s)) return x; }
  return null;
}


// Join continuation lines back onto the row they belong to. A line is a
// continuation when it carries fewer separators than the table's width — an
// unquoted cell that wrapped. Merging by structure rather than by guessing at
// the text is what keeps quantities attached to their items.
// Excel does not always quote a cell that contains a line break. When it does
// not, the wrapped part arrives as its own line and the row is torn in two —
// which is how a quantity ended up detached from its item.
//
// I tried to repair those rows automatically and could not do it safely. The
// fragment carries no reliable trace of which column it came from: in one
// paste the continuation of a DESCRIPTION arrives in column 1, in another the
// quantity does. Every rule I tested fixed one shape and corrupted another,
// and a table that silently moves a quantity into the wrong column is far more
// dangerous than one that looks untidy — nobody checks a number that looks
// plausible.
//
// So this does not guess. It DETECTS the damage and reports it, leaving the
// data exactly as pasted, with one instruction that removes the cause: turn
// wrapping off in Excel before copying, and every cell arrives on one line.
function _rtBrokenRows(rows){
  if(rows.length<3) return 0;
  const sepOf=(l)=> l.indexOf("\t")>=0 ? "\t" : "|";
  const cellsOf=(l)=> l.split(sepOf(l));
  const numbered=rows.slice(1).filter(l=>/^\s*\d{1,4}\s*$/.test(cellsOf(l)[0]||"")).length;
  if(numbered<2) return 0;               // not a numbered list: nothing to judge
  // Among a numbered list, a line NOT starting with a number is a torn row.
  return rows.slice(1).filter(l=>{
    const a=String(cellsOf(l)[0]||"").trim();
    return a!=="" && !/^\d{1,4}$/.test(a);
  }).length;
}
function _rtStitch(rows){ return rows; }   // kept as the seam for a future fix

// Render for a REPORT: bordered, printable, matching the document style.
function textWithTablesHTML(txt, opts){
  opts=opts||{};
  const src=String(txt==null?"":txt);
  if(!src.trim()) return opts.dash===false ? "" : "\u2014";
  const lines=_rtRows(src);
  const out=[];
  let buf=[];

  const flushText=()=>{
    if(!buf.length) return;
    const body=buf.join("\n").replace(/\n{3,}/g,"\n\n");
    if(body.trim()) out.push(`<div style="white-space:pre-wrap">${escapeHtml(body)}</div>`);
    buf=[];
  };
  const flushTable=(rawRows)=>{
    if(!rawRows.length) return;
    const rows=_rtStitch(rawRows);
    if(!rows.length) return;
    // Header detection: an explicit separator, otherwise assume the first row
    // labels the columns — which is what a spreadsheet paste almost always is.
    let head=null, body=rows;
    if(rows.length>1 && _rtIsSep(rows[1])){ head=_rtSplitRow(rows[0]); body=rows.slice(2); }
    else if(rows.length>1){ head=_rtSplitRow(rows[0]); body=rows.slice(1); }
    const cols=Math.max(head?head.length:0, ...body.map(r=>_rtSplitRow(r).length));
    const TH='padding:5px 8px;border:1px solid #D6E4F0;background:#03308B;color:#fff;text-align:left;font-size:10px;font-weight:700';
    const TD='padding:5px 8px;border:1px solid #D6E4F0;font-size:10.5px;vertical-align:top';
    // Track the previous row so a repeated group label (System, Area, Zone…)
    // can be shown once instead of forty-five times. A wall of repetition is
    // what makes a long equipment list unreadable on paper.
    let prev=[];
    const cell=(v,i,rowCells)=>{
      const s=String(v==null?"":v);
      const st=_rtStatus(s);
      if(st) return `<td style="${TD};background:${st.bg};color:${st.fg};font-weight:700;text-align:center;white-space:nowrap">${escapeHtml(s)}</td>`;
      // Numbers right-align: a column of readings is unreadable ragged.
      const num=/^-?[\d.,]+\s*[%a-zA-Z\u00b0\u03a9]*$/.test(s.trim()) && /\d/.test(s);
      // Repeated values are printed IN FULL. Folding them into a ditto mark was
      // a readability idea that does not survive contact with a real document:
      // an equipment schedule is read row by row, rows get quoted in isolation,
      // and a page break can separate a mark from the value it stands for. If a
      // row says "Access Control System" in Excel, it says so here too.
      return `<td style="${TD}${num?';text-align:right;font-variant-numeric:tabular-nums':''}">${escapeHtml(s).replace(/\n/g,"<br>")}</td>`;
    };
    const pad=(arr)=>{ const a=arr.slice(); while(a.length<cols) a.push(""); return a; };
    out.push(`<table style="border-collapse:collapse;width:100%;margin:8px 0">
      ${head?`<thead><tr>${pad(head).map(h=>`<th style="${TH}">${escapeHtml(String(h))}</th>`).join("")}</tr></thead>`:""}
      <tbody>${body.map((r,ri)=>{
        const cells=pad(_rtSplitRow(r));
        const html=`<tr style="${ri%2?'background:#FAFCFE':''}">${cells.map((v,ci)=>cell(v,ci,cells)).join("")}</tr>`;
        prev=cells;
        return html;
      }).join("")}</tbody>
    </table>`);
  };

  let run=[];
  for(const l of lines){
    if(_rtIsRow(l)){ run.push(l); continue; }
    if(run.length>=2){ flushText(); flushTable(run); }
    else if(run.length===1){ buf.push(run[0]); }
    run=[];
    buf.push(l);
  }
  if(run.length>=2){ flushText(); flushTable(run); }
  else if(run.length===1){ buf.push(run[0]); }
  flushText();
  return out.join("");
}
Object.assign(window,{textHasTable, textWithTablesHTML});

// A live preview under the field. Without it, someone typing pipes has no idea
// whether the app understood them until the PDF is generated — and by then the
// mistake is in a document that has been sent.
function tablePreviewHTML(txt, id){
  if(!textHasTable(txt)) return "";
  // Warn HERE, in the form, where it can still be corrected \u2014 not after the
  // PDF has been produced and sent.
  let broken=0;
  try{ broken=_rtBrokenRows(_rtRows(txt)); }catch(e){}
  return `<div class="tbl-prev" id="${escapeHtml(id||"")}">
    <div class="tbl-prev-h">\u{1F4CA} This will print as a table</div>
    ${broken?`<div class="tbl-warn">\u26a0 ${broken} row${broken>1?"s":""} arrived split across two lines, so some values are on their own row below their item.<br>
      <strong>Fix it in one step:</strong> in Excel select the cells \u2192 Home \u2192 <em>Wrap Text</em> (turn it OFF) \u2192 copy again. Every cell then arrives on a single line.</div>`:""}
    <div class="tbl-prev-b">${textWithTablesHTML(txt)}</div>
  </div>`;
}
// Drop a starter grid into a field so nobody has to remember the syntax.
window.tblInsert = function(setterPath, rows, cols){
  const r=Math.max(2, Number(rows)||3), c=Math.max(2, Number(cols)||3);
  const head=Array.from({length:c},(_,i)=>"Column "+(i+1)).join(" | ");
  const sep =Array.from({length:c},()=>"---").join(" | ");
  const body=Array.from({length:r},()=>Array.from({length:c},()=>" ").join("|")).join("\n");
  const block=`\n${head}\n${sep}\n${body}\n`;
  try{
    // setterPath is a dotted path like "incForm.description" — resolved rather
    // than eval'd so a field name can never become executable.
    const parts=String(setterPath||"").split(".");
    let obj=window;
    for(let i=0;i<parts.length-1;i++) obj=obj[parts[i]];
    const key=parts[parts.length-1];
    if(!obj) return;
    obj[key]=String(obj[key]||"")+block;
    render();
    toast("Table added \u2014 fill in the cells, or paste from Excel");
  }catch(e){}
};
// The control that sits under a field.
function tableToolbar(setterPath){
  return `<div class="tbl-tools">
    <label class="btn btn-sm btn-secondary" style="cursor:pointer;margin:0">
      \u{1F4D7} Import file
      <input type="file" accept=".xlsx,.xlsm,.xls,.csv,.docx" style="display:none"
             onchange="xlImportOpen(this,${jsArg(setterPath)})">
    </label>
    <button type="button" class="btn btn-sm btn-secondary" onclick="tblInsert(${jsArg(setterPath)},3,3)">\u{1F4CA} Blank table</button>
    <span class="tbl-hint">Excel and CSV keep every cell exactly where it is \u2014 safer than pasting, which can split a wrapped cell across two rows.
      Word (.docx) brings across the wording, its line breaks, lists and tables; colours and fonts do not transfer, because this is a text field. A table imported here is still printed as a table in the finished report.</span>
  </div>`;
}
Object.assign(window,{tablePreviewHTML, tableToolbar});

// ═══ IMPORT A SHEET DIRECTLY (v204) ═════════════════════════════════════
// Pasting is guesswork: the clipboard flattens a spreadsheet into text and a
// wrapped cell becomes indistinguishable from a new row. Reading the .xlsx
// itself removes the guessing entirely — the file states which cell holds
// which value, so a description containing five line breaks is still one cell,
// and a quantity can never land in the wrong column.
//
// Merged cells are honoured too: a title merged across eight columns arrives
// as a title, not as a value in column A with seven blanks after it.
window._xlPick = window._xlPick || null;   // {rows, name, sheets, sheet, target}

// Convert a worksheet into a rectangular array, expanding merges so the shape
// on screen matches the shape in Excel.
function _xlSheetRows(ws){
  const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:"", blankrows:false, raw:false});
  const merges = ws["!merges"] || [];
  merges.forEach(m=>{
    const v = (rows[m.s.r]||[])[m.s.c];
    if(v==null || v==="") return;
    for(let r=m.s.r; r<=m.e.r; r++){
      for(let c=m.s.c; c<=m.e.c; c++){
        if(r===m.s.r && c===m.s.c) continue;
        if(!rows[r]) rows[r]=[];
        // Only the anchor keeps the text; the rest stay blank so the value is
        // not repeated eight times across a merged title.
        rows[r][c]="";
      }
    }
  });
  // Trim trailing empty columns: an Excel sheet often reports more columns
  // than it actually uses, and they would print as empty table columns.
  let width=0;
  rows.forEach(r=>{ for(let i=r.length-1;i>=0;i--){ if(String(r[i]||"").trim()!==""){ width=Math.max(width,i+1); break; } } });
  return rows.map(r=>{ const a=r.slice(0,width); while(a.length<width) a.push(""); return a; });
}

// Turn the grid back into the app's own table text, which every existing
// renderer, the PDF engine and the backup already understand. Tabs are the
// separator, and any cell containing one is quoted — so the round trip is
// lossless and nothing downstream needs to change.
function _xlToText(rows){
  const esc=(v)=>{
    let s=String(v==null?"":v);
    if(/[\t\n"]/.test(s)) s='"'+s.replace(/"/g,'""')+'"';
    return s;
  };
  return rows.map(r=>r.map(esc).join("\t")).join("\n");
}
Object.assign(window,{_xlSheetRows, _xlToText});

// A .docx is a zip whose word/document.xml holds the text, and the spreadsheet
// library already bundles a zip reader for .xlsx. Reading it here avoids adding
// a second library for one field. Tables in the document are recovered row by
// row so they land in the field the same way an imported sheet does; if the
// file cannot be read for any reason the person is told plainly rather than
// left with an empty box.
// Read a .docx. A Word file is a zip whose word/document.xml holds the body,
// and the spreadsheet library already bundles a zip reader, so no second
// library is needed for this one field.
//
// What this CAN carry over is structure: the order of the document, its line
// breaks, tables, lists and headings. What it cannot carry is presentation —
// colours, fonts, margins — because the destination is a plain text field, not
// a document canvas. The report engine renders tab-separated lines back into a
// real table when the PDF is produced, so a table imported here is still a
// table in the finished document; it simply is not coloured in the meantime.
function _docxRunsToText(frag){
  // Walk the runs of one paragraph in order, so a soft line break inside a
  // paragraph stays a line break instead of gluing two words together.
  let out = "";
  // Word emits these either self-closed (<w:tab/>) or paired (<w:tab></w:tab>),
  // and a paragraph boundary inside a table cell has to become a space so the
  // cell stays one cell.
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:br\b[^>]*\/?>|<w:cr\b[^>]*\/?>|<\/w:p>/g;
  let m;
  while((m = re.exec(frag))){
    if(m[1] !== undefined)          out += m[1].replace(/<[^>]+>/g, "");
    else if(/^<w:tab/.test(m[0]))   out += "\t";
    else if(/^<\/w:p>/.test(m[0]))  out += "\u0001";  // paragraph boundary marker
    else                            out += "\n";      // <w:br> and <w:cr>
  }
  return out;
}

function _docxParaText(p){
  let txt = _docxRunsToText(p).replace(/\u0001/g, "\n");
  if(!txt.trim()) return "";
  // A list item is marked by numbering properties rather than by a character,
  // so the bullet has to be restored or the list arrives as loose lines.
  if(/<w:numPr[\s>]/.test(p)) txt = "- " + txt.trim();
  return txt;
}

function _docxTableText(tbl){
  const rows = [];
  (tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []).forEach(tr => {
    const cells = (tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [])
      // A cell may hold several paragraphs; they are joined with a space so the
      // cell stays one cell and the columns after it do not shift.
      .map(tc => _docxRunsToText(tc).replace(/\u0001/g, " ").replace(/\s+/g, " ").trim());
    if(cells.some(Boolean)) rows.push(cells.join("\t"));
  });
  return rows;
}

async function _docxToText(file){
  const buf = await file.arrayBuffer();
  const cfb = XLSX.CFB.read(new Uint8Array(buf), {type:"array"});
  let entry = null;
  try{ entry = XLSX.CFB.find(cfb, "/word/document.xml"); }catch(e){}
  if(!entry) entry = (cfb.FileIndex||[]).find(e => /word\/document\.xml$/i.test(e.name||""));
  if(!entry || !entry.content) throw new Error("no document body");
  const xml = new TextDecoder("utf-8").decode(new Uint8Array(entry.content));

  // Walk paragraphs and tables in the order they appear. Reading all the
  // tables first and the paragraphs afterwards — which is what this used to do
  // — silently reordered the document: every table jumped above the text that
  // introduced it.
  const out = [];
  const re = /<w:tbl[\s>][\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g;
  let m;
  while((m = re.exec(xml))){
    const frag = m[0];
    if(frag.startsWith("<w:tbl")){
      const rows = _docxTableText(frag);
      if(rows.length){ if(out.length) out.push(""); out.push(...rows); out.push(""); }
    }else{
      const t = _docxParaText(frag);
      if(t) out.push(t);
    }
  }

  return out.join("\n")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(s,n)=>String.fromCharCode(+n))
    // Collapse runs of blank lines left by empty paragraphs, but keep one so
    // the sections of the document still read apart from each other.
    .replace(/\u0001/g,"\n")
    .replace(/\n{3,}/g,"\n\n")
    .replace(/[ \t]+\n/g,"\n")
    .trim();
}
Object.assign(window,{_docxToText});

window.xlImportOpen = async function(input, targetPath){
  const f = input && input.files && input.files[0];
  if(!f) return;
  if(typeof XLSX==="undefined"){ toast("Excel library not loaded"); return; }

  // Word goes straight into the field \u2014 there is no sheet to choose from.
  if(/\.docx?$/i.test(f.name||"")){
    if(/\.doc$/i.test(f.name||"")){
      toast("Only .docx can be read \u2014 open it in Word and Save As .docx");
      input.value=""; return;
    }
    toast("Reading the document\u2026");
    try{
      const text=await _docxToText(f);
      if(!text){ toast("That document appears to be empty"); input.value=""; return; }
      const parts=String(targetPath||"").split(".");
      let obj=window;
      for(let i=0;i<parts.length-1;i++) obj=obj[parts[i]];
      const key=parts[parts.length-1];
      if(!obj){ toast("Could not reach that field"); input.value=""; return; }
      const cur=String(obj[key]||"");
      obj[key] = cur ? (cur.replace(/\s*$/,"") + "\n" + text) : text;
      input.value="";
      render();
      toast("Document imported \u2713");
    }catch(e){
      console.error(e);
      toast("Could not read that Word file \u2014 try saving it as .xlsx or .csv");
      input.value="";
    }
    return;
  }
  toast("Reading the sheet\u2026");
  try{
    const wb = XLSX.read(await f.arrayBuffer(), {type:"array"});
    if(!wb.SheetNames.length){ toast("That file has no sheets"); return; }
    window._xlPick = {
      name: f.name, target: String(targetPath||""),
      sheets: wb.SheetNames.slice(),
      sheet: wb.SheetNames[0],
      book: wb,
      from: 1, to: 0, headerRow: 1,
    };
    _xlLoadSheet(wb.SheetNames[0]);
  }catch(e){
    console.error(e);
    toast("Could not read that file: "+(e&&e.message||e));
  }finally{
    try{ input.value=""; }catch(e){}
  }
};
function _xlLoadSheet(name){
  const P=window._xlPick; if(!P) return;
  const ws=P.book.Sheets[name];
  P.sheet=name;
  P.rows=_xlSheetRows(ws);
  P.from=1;
  P.to=P.rows.length;
  // Finding the header row by "which row is fullest" fails on a real schedule:
  // every data row is just as full as the headings, so the first one scanned
  // wins — and on this sheet that was a data row. The reliable signal is that
  // a HEADING is a label and a DATA row is not: data rows begin with a serial
  // number and repeat values down the sheet, while headings are short unique
  // words that are never numeric.
  const score=(r)=>{
    const cells=r.map(x=>String(x==null?"":x).trim());
    const filled=cells.filter(Boolean);
    if(filled.length<2) return -1;                  // a merged title line
    let s=filled.length;                            // fuller is more likely
    // A heading row contains no bare numbers: "2" or "50" in the first cells
    // means this is stock, not a heading.
    const numeric=filled.filter(x=>/^-?[\d.,]+$/.test(x)).length;
    s -= numeric*4;
    // Headings are short. A 60-character product description is not a label.
    const longCells=filled.filter(x=>x.length>28).length;
    s -= longCells*3;
    // Headings are distinct from one another; a data row often repeats a value
    // (the same system name in two columns, the code echoed in the description).
    if(new Set(filled.map(x=>x.toLowerCase())).size < filled.length) s -= 3;
    // A sentence is an instruction line, not a heading.
    if(filled.some(x=>/[.:]\s/.test(x) || x.split(/\s+/).length>6)) s -= 4;
    return s;
  };
  let best=1, bestScore=-Infinity;
  P.rows.slice(0,12).forEach((r,i)=>{
    const sc=score(r);
    if(sc>bestScore){ bestScore=sc; best=i+1; }
  });
  P.headerRow=best;
  P.from=best;
  render();
}
window.xlSheet = function(n){ _xlLoadSheet(n); };
window.xlSet   = function(k,v){
  const P=window._xlPick; if(!P) return;
  P[k]=Math.max(1, Number(v)||1);
  render();
};
window.xlCancel = function(){ window._xlPick=null; render(); };
window.xlApply  = function(){
  const P=window._xlPick; if(!P) return;
  const total=P.rows.length;
  const hr  =Math.max(1,Math.min(P.headerRow||1,total));
  const from=Math.max(1,Math.min(P.from,total));
  const to  =Math.max(from,Math.min(P.to,total));
  // Heading first, then the data rows \u2014 with the heading never counted twice
  // if the range happens to include it.
  const data=P.rows.slice(from-1, to).filter((_,i)=>(from+i)!==hr);
  if(!data.length){ toast("That range is empty"); return; }
  const slice=[P.rows[hr-1]||[], ...data];
  const text=_xlToText(slice);
  try{
    const parts=P.target.split(".");
    let obj=window;
    for(let i=0;i<parts.length-1;i++) obj=obj[parts[i]];
    const key=parts[parts.length-1];
    if(!obj) return;
    const cur=String(obj[key]||"");
    obj[key] = cur ? (cur.replace(/\s*$/,"") + "\n\n" + text) : text;
    window._xlPick=null;
    render();
    toast(`Imported ${slice.length} row${slice.length>1?"s":""} \u00d7 ${slice[0].length} column${slice[0].length>1?"s":""}`);
  }catch(e){ toast("Could not insert the table"); }
};

// The picker. Importing blind is how the wrong rows end up in a report, so the
// sheet is shown as it will be inserted, with the range adjustable before
// anything is written.
function renderXlPicker(){
  const P=window._xlPick;
  if(!P || !P.rows) return "";
  const total=P.rows.length;
  const hr  =Math.max(1,Math.min(P.headerRow||1,total));
  const from=Math.max(1,Math.min(P.from,total));
  const to  =Math.max(from,Math.min(P.to,total));
  // The headings come from the header row, ALWAYS \u2014 never from whichever row
  // the data range happens to start on. Conflating the two meant that moving
  // "From row" down by one promoted an item into the column headings.
  const head=P.rows[hr-1]||[];
  const body=P.rows.slice(from-1, to).filter((_,i)=>(from+i)!==hr).slice(0,40);
  const bodyCount=P.rows.slice(from-1, to).filter((_,i)=>(from+i)!==hr).length;
  const TH='padding:5px 8px;border:1px solid var(--line);background:var(--navy);color:#fff;font-size:10px;text-align:left;white-space:nowrap';
  const TD='padding:4px 8px;border:1px solid var(--line);font-size:11px;vertical-align:top';
  return `<div class="xl-ov" onclick="if(event.target===this)xlCancel()">
    <div class="xl-box">
      <div class="xl-hd">
        <span>\u{1F4D7} ${escapeHtml(P.name||"Spreadsheet")}</span>
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="xlCancel()">Cancel</button>
      </div>
      <div class="xl-ctl">
        ${P.sheets.length>1?`<label>Sheet
          <select onchange="xlSheet(this.value)">
            ${P.sheets.map(s=>`<option ${s===P.sheet?"selected":""}>${escapeHtml(s)}</option>`).join("")}
          </select></label>`:""}
        <label>Heading row <input type="number" min="1" max="${total}" value="${hr}" onchange="xlSet('headerRow',this.value)"></label>
        <label>Data from <input type="number" min="1" max="${total}" value="${from}" onchange="xlSet('from',this.value)"></label>
        <label>to <input type="number" min="1" max="${total}" value="${to}" onchange="xlSet('to',this.value)"></label>
        <span class="xl-note">${total} row${total>1?"s":""} in this sheet \u00b7 the heading row is kept separately, so narrowing the data range never turns an item into a column title</span>
      </div>
      <div class="xl-prev">
        <table style="border-collapse:collapse;width:100%">
          <thead><tr><th style="${TH};width:34px">#</th>${head.map(h=>`<th style="${TH}">${escapeHtml(String(h||""))}</th>`).join("")}</tr></thead>
          <tbody>${body.map((r,i)=>`<tr${i%2?' style="background:var(--bg)"':''}>
            <td style="${TD};color:var(--muted);text-align:center">${from+i+(from>hr?0:1)}</td>
            ${r.map(v=>`<td style="${TD}">${escapeHtml(String(v||"")).replace(/\n/g,"<br>")}</td>`).join("")}
          </tr>`).join("")}</tbody>
        </table>
        ${bodyCount>40?`<div class="xl-more">+ ${bodyCount-40} more row(s) will also be imported</div>`:""}
      </div>
      <div class="xl-ft">
        <button class="btn btn-primary" onclick="xlApply()">Insert ${bodyCount} row${bodyCount===1?"":"s"}</button>
        <span class="xl-note">Line breaks inside a cell are preserved \u2014 nothing is split or reordered.</span>
      </div>
    </div>
  </div>`;
}
Object.assign(window,{renderXlPicker});

// ═══════════════════════════════════════════════════════════════════════
//  EXCEL HOUSE STYLE (v225)
// ═══════════════════════════════════════════════════════════════════════
// The finance workbooks were written with aoa_to_sheet and no styling at all,
// so they opened looking like a CSV while the PDFs were typeset. The library in
// use (xlsx-js-style) does support cell formatting, so the fix is to give every
// finance export one shared vocabulary rather than restyling each in isolation.
//
// Sheets are still built with XLSX.utils.aoa_to_sheet \u2014 the path every working
// export in this app uses \u2014 and then dressed by xlDress() below. Keeping the
// data and the presentation in separate steps means styling can never put a
// value or a formula at risk: a cell carrying `f` stays live in Excel, which is
// what finance needs in order to re-check a total.

const XLC = {
  navy:"1B3A6B", navyMid:"2E5FA3", gold:"C9A84C", goldDark:"B58E2E",
  green:"2E7D32", orange:"E65100", purple:"6A1B9A", red:"C62828",
  bgAlt:"F5F8FC", line:"D6E4F0", white:"FFFFFF", ink:"1A1A2E", muted:"6B7B8F"
};

const _xlBorder = (c=XLC.line, style="thin") => ({
  top:{style,color:{rgb:c}}, bottom:{style,color:{rgb:c}},
  left:{style,color:{rgb:c}}, right:{style,color:{rgb:c}}
});

// One place to look up what a named style means.
function xlStyle(name, alt, accent){
  const A = accent || XLC.navy;
  if(typeof name==="string" && name.endsWith("Right")){
    const base = xlStyle(name.slice(0,-5), alt, accent);
    return {...base, alignment:{...(base.alignment||{}), horizontal:"right"}};
  }
  switch(name){
    case "title": return {
      font:{bold:true, sz:16, color:{rgb:XLC.gold}, name:"Calibri"},
      fill:{fgColor:{rgb:XLC.navy}}, alignment:{horizontal:"center", vertical:"center"},
      border:{top:{style:"medium",color:{rgb:XLC.gold}}, bottom:{style:"medium",color:{rgb:XLC.gold}}}};
    case "subtitle": return {
      font:{italic:true, sz:10, color:{rgb:XLC.muted}},
      alignment:{horizontal:"center", vertical:"center"}};
    case "section": return {
      font:{bold:true, sz:11, color:{rgb:XLC.white}},
      fill:{fgColor:{rgb:A}}, alignment:{horizontal:"left", vertical:"center"},
      border:_xlBorder(A)};
    case "header": return {
      font:{bold:true, sz:10, color:{rgb:XLC.white}, name:"Calibri"},
      fill:{fgColor:{rgb:A}}, alignment:{horizontal:"center", vertical:"center", wrapText:true},
      border:{top:{style:"thin",color:{rgb:A}}, bottom:{style:"thin",color:{rgb:XLC.gold}},
              left:{style:"thin",color:{rgb:A}}, right:{style:"thin",color:{rgb:A}}}};
    case "label": return {
      font:{bold:true, sz:10, color:{rgb:XLC.navy}},
      fill:{fgColor:{rgb: alt?XLC.bgAlt:XLC.white}},
      alignment:{vertical:"center"}, border:_xlBorder()};
    case "num": return {
      font:{sz:10, bold:true, color:{rgb:XLC.ink}},
      fill:{fgColor:{rgb: alt?XLC.bgAlt:XLC.white}},
      alignment:{horizontal:"right", vertical:"center"}, border:_xlBorder(),
      numFmt:"#,##0.00"};
    case "int": return {
      font:{sz:10, color:{rgb:XLC.ink}},
      fill:{fgColor:{rgb: alt?XLC.bgAlt:XLC.white}},
      alignment:{horizontal:"right", vertical:"center"}, border:_xlBorder(),
      numFmt:"#,##0"};
    // Currency cells are formatted per currency and never share a column, so a
    // dollar figure can never be read as dinars by accident.
    case "usd": return {
      font:{sz:10, bold:true, color:{rgb:XLC.navy}},
      fill:{fgColor:{rgb: alt?XLC.bgAlt:XLC.white}},
      alignment:{horizontal:"right", vertical:"center"}, border:_xlBorder(),
      numFmt:'"$"#,##0.00'};
    case "iqd": return {
      font:{sz:10, bold:true, color:{rgb:XLC.green}},
      fill:{fgColor:{rgb: alt?XLC.bgAlt:XLC.white}},
      alignment:{horizontal:"right", vertical:"center"}, border:_xlBorder(),
      numFmt:'#,##0" IQD"'};
    case "warn": return {
      font:{sz:10, bold:true, color:{rgb:XLC.orange}},
      fill:{fgColor:{rgb: alt?XLC.bgAlt:XLC.white}},
      alignment:{horizontal:"right", vertical:"center"}, border:_xlBorder(),
      numFmt:"#,##0.00"};
    case "date": return {
      font:{sz:10, color:{rgb:XLC.ink}},
      fill:{fgColor:{rgb: alt?XLC.bgAlt:XLC.white}},
      alignment:{horizontal:"center", vertical:"center"}, border:_xlBorder()};
    case "total": return {
      font:{bold:true, sz:11, color:{rgb:XLC.navy}},
      fill:{fgColor:{rgb:XLC.gold}}, alignment:{vertical:"center"},
      border:{top:{style:"medium",color:{rgb:XLC.navy}}, bottom:{style:"medium",color:{rgb:XLC.navy}},
              left:{style:"thin",color:{rgb:XLC.goldDark}}, right:{style:"thin",color:{rgb:XLC.goldDark}}}};
    case "totalNum": return {
      font:{bold:true, sz:11, color:{rgb:XLC.navy}},
      fill:{fgColor:{rgb:XLC.gold}}, alignment:{horizontal:"right", vertical:"center"},
      border:{top:{style:"medium",color:{rgb:XLC.navy}}, bottom:{style:"medium",color:{rgb:XLC.navy}},
              left:{style:"thin",color:{rgb:XLC.goldDark}}, right:{style:"thin",color:{rgb:XLC.goldDark}}},
      numFmt:"#,##0.00"};
    case "note": return {
      font:{italic:true, sz:9, color:{rgb:XLC.muted}},
      alignment:{vertical:"center", wrapText:true}};
    case "badge": return {
      font:{bold:true, sz:9, color:{rgb:XLC.white}},
      fill:{fgColor:{rgb:A}}, alignment:{horizontal:"center", vertical:"center"},
      border:_xlBorder(A)};
    default: return {
      font:{sz:10, color:{rgb:XLC.ink}},
      fill:{fgColor:{rgb: alt?XLC.bgAlt:XLC.white}},
      alignment:{vertical:"center", wrapText:true}, border:_xlBorder()};
  }
}

Object.assign(window,{XLC, xlStyle});

// Dress an ALREADY-BUILT worksheet. Used where a sheet has intricate formula
// logic that must not be touched: the cells keep their values and formulas,
// and only presentation is added. `spec.rows` maps a 0-based row index to a
// style name; `spec.match` lets a rule be chosen from the row's first cell.
function xlDress(ws, spec){
  if(!ws || !ws["!ref"]) return ws;
  const R = XLSX.utils.decode_range(ws["!ref"]);
  const s = spec||{};
  for(let r=R.s.r; r<=R.e.r; r++){
    // A rule may be set explicitly by index, or inferred from the label cell.
    let name = s.rows && s.rows[r];
    if(!name && s.match){
      const first = ws[XLSX.utils.encode_cell({r, c:0})];
      const label = first ? String(first.v||"") : "";
      for(const [re, nm] of s.match){ if(re.test(label)){ name = nm; break; } }
    }
    for(let c=R.s.c; c<=R.e.c; c++){
      const addr = XLSX.utils.encode_cell({r,c});
      const cell = ws[addr];
      if(!cell) continue;
      // An explicit per-cell rule outranks everything else.
      const exact = s.cells && s.cells[r+","+c];
      if(exact){ cell.s = xlStyle(exact, r%2===1, s.accent); continue; }
      let use = name;
      if(!use){
        // A column rule wins for data cells: it is what carries the currency
        // format, and $ vs IQD must never be decided row by row.
        const byCol = s.colStyles && s.colStyles[c];
        use = byCol ? byCol : ((cell.t==="n" || cell.f) ? "num" : "cell");
      } else if(use==="header" || use==="section" || use==="title" || use==="total"){
        // Totals rows keep their number alignment on numeric cells.
        if(use==="total" && (cell.t==="n" || cell.f)) use="totalNum";
      }
      cell.s = xlStyle(use, r%2===1, s.accent);
    }
  }
  if(s.cols)   ws["!cols"] = s.cols;
  if(s.rowsHt) ws["!rows"] = s.rowsHt;
  return ws;
}
Object.assign(window,{xlDress});
