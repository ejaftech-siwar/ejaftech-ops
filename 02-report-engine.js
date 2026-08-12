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
// The company mark, taken from the very artwork the app itself displays, so a
// printed report and the app show an identical logo. Previously the report
// used a hand-drawn vector rebuild of the logo, and a rebuild is only ever an
// approximation — the "A" came out a different shape, which is exactly the
// kind of difference a client notices on a document.
const EJAF_LOGO_IMG = "data:image/png;base64,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";
window.EJAF_LOGO_IMG = EJAF_LOGO_IMG;
// Kept under its historical name: the Word export already refers to it.
const EJAF_LOGO_PNG = EJAF_LOGO_IMG;
window.EJAF_LOGO_PNG = EJAF_LOGO_PNG;

function ejafLogoSVG(px){
  // Name kept for the callers; it now emits the real artwork rather than a
  // drawing of it. print-color-adjust keeps the mark from being washed out by
  // a printer's ink-saving pass.
  return `<img src="${EJAF_LOGO_IMG}" width="${px}" height="${px}" alt="EJAF Technology"
    style="display:block;flex:0 0 auto;border-radius:${Math.round(px*0.14)}px;object-fit:cover;
           -webkit-print-color-adjust:exact;print-color-adjust:exact"/>`;
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
    .wm img{width:70%;height:auto}
    .rh,.rd,.rb,.rf{position:relative;z-index:1}
    @media print{.no-print{display:none}body{background:#fff}}
  `;
  // The page watermark. This was the second copy of the hand-drawn mark, so it
  // carried the same wrong letterforms as the header did. It now uses the real
  // artwork, tilted and faded, which also guarantees the watermark and the
  // header logo can never disagree with each other.
  const watermark = `<div class="wm"><img src="${EJAF_LOGO_IMG}" alt=""
    style="width:70%;height:auto;opacity:0.07;transform:rotate(-30deg);
           -webkit-print-color-adjust:exact;print-color-adjust:exact"/></div>`;
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
  // Indent level is kept, so a sub-point still reads as a sub-point.
  if(/<w:numPr[\s>]/.test(p)){
    const lvl = /<w:ilvl[^>]*w:val="(\d+)"/.exec(p);
    txt = "  ".repeat(Math.min(+((lvl&&lvl[1])||0), 4)) + "- " + txt.trim();
    return txt;
  }

  // Word marks a heading with a style, not with formatting we could carry into
  // a text field. Keeping it on its own with a blank line before it preserves
  // the shape of the document \u2014 the reader still sees where a section starts.
  const st = /<w:pStyle[^>]*w:val="([^"]+)"/.exec(p);
  if(st && /^heading/i.test(st[1])) return "\u0002" + txt.trim();
  return txt;
}

function _docxTableText(tbl){
  const rows = [];
  (tbl.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []).forEach(tr => {
    const cells = [];
    (tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []).forEach(tc => {
      // A cell may hold several paragraphs; they join with a space so the cell
      // stays one cell and the columns after it do not shift.
      const txt = _docxRunsToText(tc).replace(/\u0001/g, " ").replace(/\s+/g, " ").trim();
      cells.push(txt);
      // A cell spanning N columns must occupy N of them, or everything to its
      // right slides one column left and lands under the wrong heading.
      const gs = /<w:gridSpan[^>]*w:val="(\d+)"/.exec(tc);
      for(let k = 1; k < (gs ? +gs[1] : 1); k++) cells.push("");
    });
    if(cells.some(Boolean)) rows.push(cells);
  });
  // Square the grid: a short row would otherwise leave the columns ragged when
  // the report engine rebuilds the table.
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map(r => {
    const padded = r.slice();
    while(padded.length < width) padded.push("");
    return padded.join("\t");
  });
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
      let t = _docxParaText(frag);
      if(t){
        // A heading is separated from what came before it, so sections do not
        // run together once the marker is removed.
        if(t.charCodeAt(0) === 2){
          t = t.slice(1);
          if(out.length && out[out.length-1] !== "") out.push("");
        }
        out.push(t);
      }
    }
  }

  return out.join("\n")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(s,n)=>String.fromCharCode(+n))
    // Collapse runs of blank lines left by empty paragraphs, but keep one so
    // the sections of the document still read apart from each other.
    .replace(/\u0001/g,"\n").replace(/\u0002/g,"")
    .replace(/\n{3,}/g,"\n\n")
    // Trailing SPACES are tidied, but never tabs: a tab at the end of a line is
    // an empty final column, and removing it silently narrows the table.
    .replace(/ +\n/g,"\n")
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
