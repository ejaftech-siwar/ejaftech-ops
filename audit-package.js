#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   GIRÊK PACKAGE AUDITOR
   Run from inside a package folder:   node audit-package.js

   Answers one question before anything ships: is this package whole, does it
   run, and has anything been lost or crossed over since the last version.

   It is deliberately blunt. Every check either passes or names exactly what
   failed and where. A warning is a thing to look at; a failure is a thing to
   fix before publishing.

   What it CANNOT see is written at the end of its own report, because a green
   result that is mistaken for "tested in a browser" is worse than no result.
   ══════════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const R = "\x1b[31m", G = "\x1b[32m", Y = "\x1b[33m", C = "\x1b[36m", B = "\x1b[1m", Z = "\x1b[0m";
let PASS = 0, FAIL = 0, WARN = 0;
const failures = [], warnings = [];

function head(t){ console.log(`\n${B}${C}${t}${Z}`); }
function ok(t){ PASS++; console.log(`  ${G}✓${Z} ${t}`); }
function bad(t, detail){ FAIL++; failures.push(t); console.log(`  ${R}✗ ${t}${Z}`); if(detail) console.log(`      ${detail}`); }
function warn(t, detail){ WARN++; warnings.push(t); console.log(`  ${Y}!${Z} ${t}`); if(detail) console.log(`      ${detail}`); }
function check(cond, good, badMsg, detail){ cond ? ok(good) : bad(badMsg || good, detail); return cond; }

const MODULES = ["01-core.js","02-report-engine.js","03-dashboard-logs.js","04-reports.js",
 "05-assets.js","06-database.js","07-instructions.js","08-clients.js","09-tasks-requests.js",
 "10-integrations.js","11-settings.js","12-exports.js","13-fieldops.js","14-finance.js",
 "15-invoicing.js","16-advances.js","17-risks.js","18-performance.js","19-vehicles.js"];
const SUPPORT = ["firebase-init.js","pwa-manifest.js","sw.js","index.html","offline-check.html",
 "app.css","theme.css","manifest.json","README.md"];
const SDK = ["firebase-app.js","firebase-auth.js","firebase-firestore.js"];

const read = f => fs.readFileSync(f, "utf8");
const exists = f => fs.existsSync(f);

/* ── 1. COMPLETENESS ────────────────────────────────────────────────────── */
head("1. PACKAGE COMPLETENESS");
{
  const missing = [...MODULES, ...SUPPORT].filter(f => !exists(f));
  check(!missing.length, `all ${MODULES.length + SUPPORT.length} root files present`,
        `${missing.length} root file(s) MISSING`, missing.join(", "));

  const sdkMissing = SDK.filter(f => !exists(path.join("sdk", f)));
  check(!sdkMissing.length, "sdk/ holds all three Firebase bundles",
        "sdk/ is incomplete — offline cold start will fail", sdkMissing.join(", "));

  // A truncated SDK bundle loads and registers nothing, which fails much later
  // and much less clearly than a missing file.
  const MIN = { "firebase-app.js": 60000, "firebase-auth.js": 90000, "firebase-firestore.js": 300000 };
  let small = [];
  SDK.forEach(f => {
    const p = path.join("sdk", f);
    if(exists(p) && fs.statSync(p).size < MIN[f]) small.push(`${f} is ${Math.round(fs.statSync(p).size/1024)}KB`);
  });
  check(!small.length, "sdk bundles are full size, not truncated",
        "an sdk bundle looks truncated", small.join(", "));
}

/* ── 2. SYNTAX ──────────────────────────────────────────────────────────── */
head("2. SYNTAX");
{
  const js = [...MODULES, "firebase-init.js", "pwa-manifest.js", "sw.js"].filter(exists);
  const broken = [];
  js.forEach(f => {
    try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
    catch(e){ broken.push(`${f}: ${String(e.stderr||"").split("\n")[2]||""}`.trim()); }
  });
  check(!broken.length, `${js.length} JavaScript files parse cleanly`,
        `${broken.length} file(s) have SYNTAX ERRORS`, broken.join("\n      "));

  try { JSON.parse(read("manifest.json")); ok("manifest.json is valid JSON"); }
  catch(e){ bad("manifest.json is not valid JSON", e.message); }
}

/* ── 3. VERSION CONSISTENCY ─────────────────────────────────────────────── */
head("3. VERSION CONSISTENCY");
let VERSION = null;
{
  const sw = read("sw.js"), ex = exists("12-exports.js") ? read("12-exports.js") : "";
  const a = /const CACHE = 'ejaftech-(v\d+)'/.exec(sw);
  const b = /var swCode = "const CACHE='ejaftech-(v\d+)'/.exec(ex);
  const c = /const APP_BUILD = "(v\d+)"/.exec(ex);
  const seen = [a && a[1], b && b[1], c && c[1]];
  VERSION = a && a[1];
  const uniq = [...new Set(seen.filter(Boolean))];
  check(seen.every(Boolean), "all three version markers found",
        "a version marker is missing", `sw=${seen[0]} selfExport=${seen[1]} APP_BUILD=${seen[2]}`);
  check(uniq.length === 1, `version is consistently ${uniq[0]} in all three places`,
        "VERSION MISMATCH — the service worker will not update",
        `sw=${seen[0]} selfExport=${seen[1]} APP_BUILD=${seen[2]}`);
}

/* ── 4. WIRING: index.html ↔ sw.js ──────────────────────────────────────── */
head("4. WIRING");
{
  const html = read("index.html"), sw = read("sw.js");
  const inIndex = [...html.matchAll(/src="(\d\d-[a-z-]+\.js)"/g)].map(m => m[1]);
  const inSw = [...sw.matchAll(/'\.\/(\d\d-[a-z-]+\.js)'/g)].map(m => m[1]);

  check(inIndex.length === MODULES.length, `index.html loads all ${MODULES.length} modules`,
        `index.html loads ${inIndex.length} of ${MODULES.length} modules`,
        MODULES.filter(m => !inIndex.includes(m)).join(", "));

  const order = inIndex.join(",") === MODULES.join(",");
  check(order, "modules load in dependency order (01 first)",
        "module load ORDER is wrong — later modules may not find their helpers", inIndex.join(", "));

  const notCached = inIndex.filter(m => !inSw.includes(m));
  check(!notCached.length, "every module is precached for offline use",
        `${notCached.length} module(s) are NOT precached — the app will break offline`, notCached.join(", "));

  // Lazily loaded libraries are no longer <script> tags, so precaching them
  // here is the ONLY thing keeping those features working with no signal.
  const lazyUrls = [...(exists("01-core.js") ? read("01-core.js") : "")
    .matchAll(/^\s*\w+\s*:\s*"(https:\/\/[^"]+)"/gm)].map(m => m[1]);
  const uncached = lazyUrls.filter(u => !sw.includes(u));
  check(!uncached.length, `all ${lazyUrls.length} on-demand libraries are precached`,
        "an on-demand library is NOT precached — that feature dies offline", uncached.join("\n      "));

  const blocking = (html.match(/<script src="https:\/\//g) || []).length;
  check(blocking === 0, "no blocking CDN scripts in the document head",
        `${blocking} blocking CDN script(s) slow every launch`);

  const localAssets = [...html.matchAll(/(?:src|href)="(?!https:|data:|#)([^"]+)"/g)].map(m => m[1]);
  const missingAssets = localAssets.filter(a => !exists(a.split("?")[0]));
  check(!missingAssets.length, "every local asset referenced by index.html exists",
        "index.html references a file that is not in the package", missingAssets.join(", "));
}

/* ── 5. NAME COLLISIONS ─────────────────────────────────────────────────── */
head("5. NAME COLLISIONS");
{
  // A function defined twice does not error: the later module silently REPLACES
  // the earlier one, and a feature stops working with nothing in the console.
  // This has bitten this codebase before.
  const owners = new Map();
  MODULES.filter(exists).forEach(f => {
    const src = read(f);
    // Both forms count. A `const escapeHtml=` in one module and a
    // `function escapeHtml(){}` in another is still one name with two bodies,
    // and whichever module loads last is the one that wins.
    const names = [
      ...[...src.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(/gm)].map(m => m[1]),
      ...[...src.matchAll(/^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)/gm)].map(m => m[1]),
    ];
    names.forEach(n => { if(!owners.has(n)) owners.set(n, new Set()); owners.get(n).add(f); });
  });
  const clashes = [...owners.entries()].filter(([, fs_]) => fs_.size > 1)
    .map(([n, fs_]) => `${n}  defined in ${[...fs_].join(" and ")}`);
  check(!clashes.length, "no function name is defined in two modules",
        `${clashes.length} NAME COLLISION(S) — the later definition silently wins`,
        clashes.slice(0, 12).join("\n      "));
}

/* ── 6. INLINE HANDLERS RESOLVE ─────────────────────────────────────────── */
head("6. INLINE HANDLERS");
{
  const declared = new Set();
  const files = [...MODULES, "firebase-init.js"].filter(exists);
  files.forEach(f => {
    const s = read(f);
    [...s.matchAll(/^(?:async\s+)?function\s+(\w+)/gm)].forEach(m => declared.add(m[1]));
    [...s.matchAll(/^(?:const|let|var)\s+(\w+)/gm)].forEach(m => declared.add(m[1]));
    [...s.matchAll(/window\.(\w+)\s*=/g)].forEach(m => declared.add(m[1]));
    [...s.matchAll(/Object\.assign\(window,\s*\{([^}]*)\}/gs)].forEach(m =>
      [...m[1].matchAll(/(\w+)\s*[,:}]/g)].forEach(x => declared.add(x[1])));
  });
  const DOM = new Set(["click","close","closest","fn","function","getElementById","open","print",
    "preventDefault","reload","remove","replace","round","select","stopPropagation","then",
    "writeText","focus","blur","submit","toFixed","push","splice","filter","map","forEach","value"]);
  const BUILTIN = new Set(["if","for","while","return","typeof","this","event","Number","String",
    "Array","Object","JSON","Math","Date","parseInt","parseFloat","alert","confirm","prompt",
    "console","encodeURIComponent","decodeURIComponent","setTimeout","escape","Boolean"]);
  const called = new Set();
  files.forEach(f => [...read(f).matchAll(
      /on(?:click|change|input|submit|blur|focus|keyup|keydown|paste)="([^"]*)"/g)]
    .forEach(m => [...m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].forEach(x => called.add(x[1]))));
  const unresolved = [...called].filter(n => !declared.has(n) && !DOM.has(n) && !BUILTIN.has(n));
  check(!unresolved.length, `all ${called.size} inline handler functions exist`,
        `${unresolved.length} handler(s) call a function that does not exist — the button will do nothing`,
        unresolved.join(", "));
}

/* ── 7. THE APP ACTUALLY RUNS ───────────────────────────────────────────── */
head("7. RUNTIME — every tab, every role");
let ctx = null;
{
  const el = () => ({ style:{}, classList:{add(){},remove(){},toggle(){},contains:()=>false},
    setAttribute(){}, getAttribute:()=>null, appendChild(){}, removeChild(){}, remove(){},
    querySelector:()=>null, querySelectorAll:()=>[], insertAdjacentHTML(){}, addEventListener(){},
    removeEventListener(){}, focus(){}, blur(){}, click(){}, closest:()=>null, scrollIntoView(){},
    innerHTML:"", textContent:"", value:"", checked:false, offsetLeft:0, offsetWidth:0,
    offsetHeight:0, scrollTop:0, scrollHeight:0, dataset:{}, files:[],
    getBoundingClientRect:()=>({left:0,right:0,top:0,bottom:0,width:0,height:0}) });
  // renderTab() WRITES its markup into #content and returns nothing. A stub
  // that swallows innerHTML makes every check on the produced markup pass
  // against an empty string — which is worse than no check at all.
  const NODES = {};
  const node = (id) => NODES[id] || (NODES[id] = el());

  ctx = { console:{log(){},warn(){},error(){},info(){}}, setTimeout, clearTimeout, setInterval,
    clearInterval, Promise, Date, Math, JSON, Intl, isNaN, isFinite, parseInt, parseFloat,
    encodeURIComponent, decodeURIComponent, escape, unescape,
    requestAnimationFrame:f=>setTimeout(f,0), cancelAnimationFrame(){},
    localStorage:{_d:{},getItem(k){return k in this._d?this._d[k]:null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]},clear(){this._d={}}},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    navigator:{onLine:true,userAgent:"audit",vibrate(){},clipboard:{writeText:async()=>{}},
      serviceWorker:{register:async()=>({}),ready:Promise.resolve({}),addEventListener(){}}},
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){}, scrollTo(){}, open:()=>null,
    matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
    getComputedStyle:()=>({getPropertyValue:()=>""}),
    location:{href:"http://x/",origin:"http://x",pathname:"/",search:"",hash:"",reload(){}},
    history:{pushState(){},replaceState(){},back(){}},
    Image:function(){this.onload=null;}, FileReader:function(){this.readAsDataURL=()=>{};},
    Event:function(){}, Blob:function(){}, URL:{createObjectURL:()=>"blob:x",revokeObjectURL(){}},
    fetch:async()=>({ok:true,json:async()=>({}),text:async()=>""}),
    alert(){}, confirm:()=>true, prompt:()=>null, print(){},
    btoa:s=>Buffer.from(s,"binary").toString("base64"),
    atob:s=>Buffer.from(s,"base64").toString("binary"),
    XLSX:{utils:{aoa_to_sheet:()=>({}),book_new:()=>({SheetNames:[],Sheets:{}}),book_append_sheet(){},
      sheet_to_json:()=>[],decode_range:()=>({s:{r:0,c:0},e:{r:0,c:0}})},
      write(){},writeFile(){},read:()=>({SheetNames:["S"],Sheets:{S:{}}}),
      CFB:{read:()=>({FileIndex:[]}),find:()=>null}} };
  ctx.document = { documentElement:el(), body:el(), head:{appendChild(){}},
    getElementById:(id)=>node(id), querySelector:()=>el(), querySelectorAll:()=>[],
    createElement:()=>Object.assign(el(),{ getContext:()=>({drawImage(){},fillRect(){},fillStyle:"",
      measureText:()=>({width:10}),getImageData:()=>({data:[]})}),
      toDataURL:()=>"data:image/png;base64,AAA" }),
    addEventListener(){}, insertAdjacentHTML(){}, createTextNode:()=>el(),
    execCommand(){}, cookie:"", title:"", readyState:"complete" };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);

  let loaded = 0;
  for(const f of MODULES){
    if(!exists(f)) continue;
    try { vm.runInContext(read(f), ctx, { filename:f }); loaded++; }
    catch(e){ bad(`${f} throws while loading`, e.message); }
  }
  check(loaded === MODULES.length, `all ${MODULES.length} modules load without throwing`,
        `only ${loaded} of ${MODULES.length} modules loaded`);

  const S = (() => { try { return vm.runInContext("state", ctx); } catch(e){ return null; } })();
  if(!S){ bad("state object is unreachable — cannot exercise the interface"); }
  else {
    S.initialized = true;
    const COLLECTIONS = ["users","daily","overtime","travel","leaves","projects","locations",
      "branches","departments","devices","parts","quotes","variations","expenses","invoices",
      "advances","expenseReports","risks","pmSchedules","incidents","tasks","clients",
      "clientRequests","notifications","savedReports","trash","workCategories","workTasks",
      "nametagEmployees","techWorkTypes","techStatuses","techCategories","systemTypes",
      "systemChecks","requestStatuses","projectStatuses","employeePermissions",
      "clientPermissions","deviceEditSuggestions","waContacts","emailContacts","settingsDocs",
      "publicSharesMeta"];
    const ROLES = ["admin","hr","manager","employee","technician","client","viewer"];
    let renders = 0, crashes = [], dirty = [], empty = [];

    const runAll = (label) => {
      for(const role of ROLES){
        S.profile = { uid:"u1", employeeName:"Audit User", email:"a@e.iq", role };
        if(!S.users.length) S.users = [{ id:"u1", employeeName:"Audit User", role, email:"a@e.iq" }];
        let tabs = [];
        try { tabs = (vm.runInContext("typeof getTabs==='function'?getTabs():[]", ctx) || [])
          .map(t => typeof t === "string" ? t : (t && (t.id || t.name || t.key))).filter(Boolean); }
        catch(e){}
        for(const tab of tabs){
          S.tab = tab; S.activeTab = tab;
          try {
            vm.runInContext('document.getElementById("content").innerHTML=""', ctx);
            vm.runInContext("renderTab()", ctx);
            const h = String(vm.runInContext(
              'document.getElementById("content").innerHTML', ctx) || "");
            renders++;
            if(!h.length) empty.push(`${label}/${role}/${tab}`);
            if(/>undefined</.test(h) || /\[object Object\]/.test(h) || />NaN</.test(h))
              dirty.push(`${label}/${role}/${tab}`);
          } catch(e){ crashes.push(`${label}/${role}/${tab}: ${e.message}`); }
        }
      }
    };

    COLLECTIONS.forEach(k => S[k] = []);
    runAll("empty");

    // Realistic data: the paths that only execute when there is something to show
    Object.assign(S, {
      users:[{id:"u1",employeeName:"Audit User",role:"admin",email:"a@e.iq"},
             {id:"u2",employeeName:"Second Person",role:"employee",department:"Operations"}],
      daily:[{id:"d1",date:"2026-08-10",employee:"Second Person",project:"P1",location:"Erbil",
              duration:4,taskCategory:"CCTV",taskStatus:"In Progress",description:"Check",
              entryNo:1,workType:"Maintenance",branch:"Erbil"}],
      projects:[{id:"p1",name:"P1",client:"C1",status:"Active"}],
      locations:[{id:"lo1",name:"Erbil"}], branches:[{id:"b1",name:"Erbil"}],
      departments:[{id:"dp1",name:"Operations"}], clients:[{id:"c1",name:"C1"}],
      devices:[{id:"dv1",name:"CAM-01",model:"DS",project:"P1",system:"CCTV",serial:"X1"}],
      invoices:[{id:"i1",ref:"INV-1",client:"C1",amount:2000,currency:"USD",date:"2026-08-01"}],
      advances:[{id:"a1",employee:"Second Person",usd:300,iqd:0,date:"2026-08-01"}],
      expenses:[{id:"e1",date:"2026-08-05",project:"P1",amount:100,currency:"USD"}],
      risks:[{id:"r1",title:"Delay",severity:"Medium",project:"P1",status:"Open"}],
      incidents:[{id:"in1",date:"2026-08-09",project:"P1",description:"Outage",status:"Closed"}],
      tasks:[{id:"tk1",title:"Visit",assignee:"Second Person",status:"Open",due:"2026-08-20"}],
      savedReports:[{id:"sr1",kind:"tech",kindLabel:"Technical Report",title:"T",
        state:{_sr:{project:"P1"}},photos:[],plans:[],savedAt:"2026-08-14T10:00"}],
    });
    runAll("populated");

    check(!crashes.length, `${renders} tab renders across ${ROLES.length} roles, empty and populated`,
          `${crashes.length} TAB(S) CRASH`, crashes.slice(0,8).join("\n      "));
    check(!empty.length, "every tab produced markup — none rendered blank",
          `${empty.length} tab(s) rendered NOTHING`, empty.slice(0,8).join(", "));
    if(dirty.length) warn(`${dirty.length} tab(s) show undefined / NaN / [object Object]`,
          dirty.slice(0,6).join(", "));
    else ok("no undefined, NaN or [object Object] leaked into any screen");
  }
}

/* ── 8. INJECTION SAFETY ────────────────────────────────────────────────── */
head("8. INJECTION SAFETY");
if(ctx){
  const S = vm.runInContext("state", ctx);
  const X = "<script>alert(1)</" + "script>";
  const Q = '"><img src=x onerror=alert(1)>';
  ["daily","projects","locations","devices","parts","incidents","risks","tasks","clients",
   "invoices","expenses","advances","quotes","variations","pmSchedules","savedReports"].forEach(k => {
    S[k] = [{ id:"x1", name:X, title:X, description:Q, employee:X, project:X, client:X, note:Q,
      remark:X, site:X, location:X, ref:X, kind:"tech", kindLabel:X, state:{}, photos:[], plans:[],
      date:"2026-08-10", amount:1, currency:"USD", usd:1, iqd:0, status:X, severity:X }];
  });
  S.profile = { uid:"u1", employeeName:"Audit", email:"a@e.iq", role:"admin" };
  S.users = [{ id:"u1", employeeName:"Audit", role:"admin" }];
  let live = [], scanned = 0;
  let tabs = [];
  try { tabs = (vm.runInContext("typeof getTabs==='function'?getTabs():[]", ctx) || [])
    .map(t => typeof t === "string" ? t : (t && (t.id || t.name || t.key))).filter(Boolean); } catch(e){}
  for(const tab of tabs){
    S.tab = tab; S.activeTab = tab;
    let h = "";
    try {
      vm.runInContext('document.getElementById("content").innerHTML=""', ctx);
      vm.runInContext("renderTab()", ctx);
      h = String(vm.runInContext('document.getElementById("content").innerHTML', ctx) || "");
      if(!h.length) continue;          // nothing rendered is nothing tested
      scanned++;
    } catch(e){ continue; }
    if(/<script>alert/.test(h)) live.push(`${tab}: live <script>`);
    if(/<img[^>]*onerror\s*=/.test(h)) live.push(`${tab}: live onerror attribute`);
  }
  check(!live.length, `hostile text in every field, across ${scanned} tabs — nothing executes`,
        `${live.length} LIVE INJECTION(S)`, live.slice(0,6).join("\n      "));
}

/* ── 9. MONEY DISCIPLINE ────────────────────────────────────────────────── */
head("9. MONEY DISCIPLINE");
{
  const money = ["14-finance.js","15-invoicing.js","16-advances.js","12-exports.js"].filter(exists);
  let mixed = [];
  money.forEach(f => read(f).split("\n").forEach((l, i) => {
    if(l.trim().startsWith("//")) return;
    // one accumulator receiving both currencies is the failure that matters
    if(/\b(usd|USD)\w*\s*\+=\s*[^;]*\b(iqd|IQD)/.test(l) ||
       /\b(iqd|IQD)\w*\s*\+=\s*[^;]*\b(usd|USD)/.test(l)) mixed.push(`${f}:${i+1}  ${l.trim().slice(0,70)}`);
  }));
  check(!mixed.length, "no line adds USD into an IQD total or the reverse",
        "CURRENCIES ARE BEING MIXED", mixed.join("\n      "));

  const everywhere = [...MODULES, "firebase-init.js"].filter(exists).map(read).join("\n");
  check(/function num\(/.test(everywhere), "num() money parser is present",
        "num() is MISSING — money parsing is unsafe");
}

/* ── 10. RENDER STABILITY ───────────────────────────────────────────────── */
head("10. RENDER STABILITY");
{
  let storms = [];
  MODULES.filter(exists).forEach(f => read(f).split("\n").forEach((l, i) => {
    if(l.trim().startsWith("//")) return;
    if(/oninput="[^"]*\brender(App)?\(\)/.test(l)) storms.push(`${f}:${i+1}`);
  }));
  check(!storms.length, "no field re-renders itself while being typed into",
        `${storms.length} field(s) re-render on every keystroke — the caret will jump`,
        storms.join(", "));

  const core = exists("01-core.js") ? read("01-core.js") : "";
  check(/function cleanupSubs/.test(core), "cleanupSubs() exists to release listeners",
        "cleanupSubs() is MISSING — listeners will accumulate");
  check(/function scheduleRender/.test(core), "scheduleRender() coalescer is present",
        "scheduleRender() is MISSING — snapshot bursts will repaint repeatedly");
}

/* ── 11. NOTHING LOST ───────────────────────────────────────────────────── */
head("11. FEATURE PRESERVATION");
{
  const all = [...MODULES, "firebase-init.js", "index.html", "sw.js"].filter(exists).map(read).join("\n");
  const MARKERS = [
    ["dual-currency separation","expInBase"], ["num() money parsing","function num("],
    ["FIFO advance discharge","advApplied"], ["aoa_to_sheet sheet builder","aoa_to_sheet"],
    ["xlDress house style","function xlDress("], ["escapeHtml","const escapeHtml="],
    ["jsArg handler escaping","const jsArg="], ["fmtHM day display","fmtHM"],
    ["Finance Report","renderFinanceReport"], ["Advances Register","advRegisterExcel"],
    ["Expense claims","expenseClaimExcel"], ["Risks register","renderRisks"],
    ["This Device tab","renderThisDevice"], ["project health","dashProjectHealth"],
    ["signature pads","signature"], ["Word/Excel import","xlImportOpen"],
    [".docx extractor","_docxToText"], ["Word numbering","_docxNumbering"],
    ["merged-cell gridSpan","gridSpan"], ["import replaces previous","_importInto"],
    ["import undo","importUndo"], ["saved reports","srSaveReport"],
    ["saved reports list","srSavedList"], ["report photo compression","_srPackPhotos"],
    ["PDF site plans","planImportOpen"], ["plan print sheets","_rptPlanSheets"],
    ["Project Report","generateProjectReport"], ["PMBOK section model","PRJ_SECTIONS"],
    ["earned value (SPI/CPI)","_prjEV"], ["project RAG status","PRJ_RAG"],
    ["project doc series","PROJECT_REPORT"],
    ["empty items suppressed","prjWillPrint"], ["what-will-print preview","prjPreviewCard"],
    ["type-or-choose fields","_syncSel"],
    ["Project Progress Report","generateProjectProgressReport"],
    ["in-place photo strips","photoStripDelete"], ["unsaved-changes marker","srMarkDirty"],
    ["shared print library","function rptRow"], ["collapsible sections","function foldCard"],
    ["fill progress bar","function fillBar"], ["grouped report pills","_srPillGroups"],
    ["configurable limits","function photoMax"],
    ["vehicle register","vehListBodyHTML"], ["fleet search","vehVisible"],
    ["fleet summary","vehFleetSummary"], ["oil interval tracking","function vehOil"],
    ["vehicle report","generateVehicleReport"],
    ["overnight split","function daySegments"], ["range hours","function hoursInRange"],
    ["shift end date","function shiftEndDate"],
    ["vehicle fleet register","function renderVehicles"], ["vehicle maintenance jobs","vehJobSave"],
    ["oil-change distance reminder","function vehOil"], ["vehicle due alerts","function vehAlerts"],
    ["vehicle maintenance report","generateVehicleReport"], ["vehicle doc series","VEHICLE_REPORT"],
    ["FIDIC 4.21 sections","PPR_SECTIONS"], ["weighted system progress","_pprProgress"],
    ["delay events register","pprAddDelay"], ["progress doc series","PROGRESS_REPORT"],
    ["lazy library loader","function loadLib"], ["needLib guard","function needLib"],
    ["recycle bin","Recycle Bin"], ["approval workflow","apprRequired"],
    ["work item threading","buildWorkItems"], ["offline session snapshot","readLocalSession"],
    ["boot deadline race","bootRace"], ["loading gate","_gateTimer"],
    ["unlimited Firestore cache","CACHE_SIZE_UNLIMITED"], ["bundled SDK path","sdk/"],
    ["bottom navigation","bottomNav"], ["SVG nav icons","NAV_ICONS"],
    ["typed toasts","data-type"], ["global search","renderGlobalSearch"],
    ["photo annotator","annoOpen"], ["barcode scanner","openScanner"],
    ["client portal","renderClientPortal"], ["public share links","publicShares"],
    ["PM schedules","pmSchedules"], ["incidents","renderIncidents"],
    ["ELV report templates","SYS_TEMPLATES"], ["ELV sub-systems","ELV_SUBS"],
    ["interface matrix","ELV_INTEG"],
  ];
  const lost = MARKERS.filter(([, m]) => !all.includes(m)).map(([n]) => n);
  check(!lost.length, `all ${MARKERS.length} flagship features still present`,
        `${lost.length} FEATURE(S) LOST`, lost.join(", "));

  const REJECTED = [["Command Palette","commandPalette"],["Audit Log","renderAuditLog"],
                    ["AI Assistant","renderAIAssistant"]];
  const back = REJECTED.filter(([, m]) => all.includes(m)).map(([n]) => n);
  check(!back.length, "the three permanently-rejected features have not returned",
        "a REJECTED feature has come back", back.join(", "));
}

/* ── VERDICT ────────────────────────────────────────────────────────────── */
console.log(`\n${B}${"═".repeat(66)}${Z}`);
console.log(`${B}  GIRÊK ${VERSION || "(version unknown)"} — ${PASS} passed, ${FAIL} failed, ${WARN} to look at${Z}`);
console.log(`${B}${"═".repeat(66)}${Z}`);
if(FAIL){
  console.log(`\n${R}${B}  DO NOT PUBLISH.${Z}`);
  failures.forEach(f => console.log(`    ${R}✗${Z} ${f}`));
} else {
  console.log(`\n${G}${B}  Every automated check passed.${Z}`);
}
if(WARN) warnings.forEach(w => console.log(`    ${Y}!${Z} ${w}`));

console.log(`\n${B}  What this audit CANNOT see${Z} — these still need a real device:`);
[ "visual layout, spacing, and whether anything shakes while scrolling",
  "how a table or a drawing actually looks on a phone screen",
  "Firestore rules, permissions, and multi-device sync",
  "the printed PDF: page breaks, margins, and whether text is legible",
  "camera, file pickers, and anything the operating system provides",
].forEach(x => console.log(`    · ${x}`));
console.log("");
process.exit(FAIL ? 1 : 0);
