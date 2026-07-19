// ═══════════════════════════════════════════════════════════════════════
//  CONSTANTS & STATE
// ═══════════════════════════════════════════════════════════════════════
const EMPLOYEES_DEFAULT = ["Siwar Sheikho","Nawar Raffo","Luay Alrasheed","Elias","Abdullah"];

// ── Technical classification options for Resolution (Phase 1: fixed in code) ──
const WORK_TYPES = ["Onsite","Remote","In Office","Travel","From Home"];
const TASK_STATUSES = ["New","Assigned","In Progress","Pending","On Hold","Resolved","Closed","Cancelled"];
const TASK_CATEGORIES = {
  "Network": ["Troubleshooting","Configuration","Installation","Cabling / Patch","Connectivity Issue","Optimization"],
  "CCTV": ["Camera Installation","Camera Troubleshooting","NVR/DVR/IVS Configuration","NVR/DVR/IVS Issue","Recording / Playback Issue","Camera Adjustment","Storage Issue"],
  "System": ["Server Installation","OS Installation / Configuration","Application Support","System Troubleshooting","Backup / Restore","User Management","Performance Issue"],
  "Onsite Survey": ["Site Survey","Technical Assessment","Coverage Analysis","Pre-Installation Survey","Documentation"],
  "Maintenance": ["Preventive Maintenance (PM)","Corrective Maintenance (CM)","Inspection / Health Check","Cleaning","Firmware / Software Update"],
  "Deployment": ["Device Installation","System Deployment","Network Setup","CCTV Deployment","System Integration"],
  "General": ["Technical Support","Consultation","Follow-up","Escalation"],
  "CR": ["Configuration Change","Access / Permission Change","Firewall / Security Change","Network Change","System Upgrade / Patch","Backup Policy Change"],
};

// ── Dynamic getters: read from Firestore if seeded, else fall back to constants ──
function getWorkTypes(){
  const fromDb = (state.techWorkTypes||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(x=>x.name).filter(Boolean);
  return fromDb.length ? fromDb : WORK_TYPES;
}
function getTaskStatuses(){
  const fromDb = (state.techStatuses||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(x=>x.name).filter(Boolean);
  return fromDb.length ? fromDb : TASK_STATUSES;
}
// ═══════════════════════════════════════════════════════════════════════
//  SYSTEM REPORT TEMPLATES — v126
//  Each ELV discipline is DATA, not code: its info fields, its default
//  inspection checklist (written against the governing standards) and the
//  standards line printed in the PDF. Adding a seventh system later is a
//  data block, never new logic.
//  Checklists are defaults only — Technical Classifications → Check Lists
//  overrides them per system (stored in the `systemChecks` collection).
// ═══════════════════════════════════════════════════════════════════════
const SYS_TEMPLATES = [
  {
    id:"cctv", name:"CCTV / Video Surveillance", icon:"📹", color:"#1565C0",
    match:["cctv","camera","video","surveillance"],
    standards:"IEC/EN 62676-4 (planning, installation, testing, commissioning & maintenance of video surveillance systems) · IEC 62676-1-1 & 1-2 (system and transmission performance) · BS 7958 (management & operation)",
    fields:[
      {k:"nvr",   l:"NVR / VMS make & model"},
      {k:"cams",  l:"Number of cameras"},
      {k:"ret",   l:"Recording retention (days)"},
      {k:"stor",  l:"Storage capacity / free space"},
    ],
    checks:[
      "Camera housings, brackets and mountings secure and undamaged",
      "Field of view unobstructed and matching the design intent",
      "Image quality, focus and resolution verified against DORI category",
      "Day/night switching and IR illumination verified after dark",
      "Recording continuity verified — no gaps in the review period",
      "Retention period meets the agreed policy",
      "Recorder / VMS health: disks, RAID status and temperature",
      "Storage capacity and free space adequate",
      "System date and time synchronised (NTP) across all devices",
      "Motion detection / video analytics rules verified",
      "Video export and playback test performed",
      "PoE switches, power supplies and UPS verified",
      "Cabling, connectors and terminations inspected",
      "Remote and mobile access verified",
      "User accounts and access rights reviewed",
      "Firmware versions recorded and update status assessed",
    ],
  },
  {
    id:"fire", name:"Fire Alarm System", icon:"🔥", color:"#C62828",
    match:["fire","alarm","fire alarm"],
    standards:"NFPA 72 (National Fire Alarm and Signaling Code) · EN 54 series (fire detection and fire alarm systems) · ISO 7240",
    fields:[
      {k:"panel", l:"Panel manufacturer & model"},
      {k:"zones", l:"Zones / loops"},
      {k:"dets",  l:"Number of detectors"},
      {k:"batt",  l:"Standby battery (Ah)"},
    ],
    checks:[
      "Control panel in normal state — no fault, fire or disablement indications",
      "Standby batteries: voltage, terminals and load test",
      "Mains supply and charger output verified",
      "Smoke detectors functionally tested per the sampling schedule",
      "Heat detectors functionally tested",
      "Manual call points operated and reset",
      "Sounders and voice alarm audibility verified",
      "Visual alarm devices (beacons / strobes) verified",
      "Zone and loop indication correct at panel and repeaters",
      "Cause & effect matrix verified",
      "Interfaces tested: HVAC shutdown, door release, lift homing, suppression release",
      "Fault and disablement indication test",
      "Event log reviewed and printed",
      "Remote monitoring / ARC signal transmission test",
      "Zone charts, documentation and spare parts available on site",
    ],
  },
  {
    id:"acs", name:"Access Control System", icon:"🚪", color:"#00695C",
    match:["access","acs","access control"],
    standards:"EN/IEC 60839-11-1 (electronic access control — system and component requirements) · EN/IEC 60839-11-2 (application guidelines) · life-safety egress requirements",
    fields:[
      {k:"ctrl",  l:"Controller make & model"},
      {k:"doors", l:"Number of doors"},
      {k:"rdrs",  l:"Number of readers"},
      {k:"cred",  l:"Credential type"},
      {k:"srv",   l:"Server / software version"},
    ],
    checks:[
      "Controllers, power supplies and enclosures inspected",
      "Readers operational — credential read range and user feedback",
      "Door contacts and request-to-exit devices functional",
      "Locking devices (maglocks / electric strikes) operating correctly",
      "Fail-safe / fail-secure behaviour verified against the fire strategy",
      "Emergency release and break-glass units tested",
      "Interface with fire alarm verified — doors release on alarm",
      "Door forced-open and held-open alarms verified",
      "Anti-passback and interlock rules verified",
      "Time schedules and access levels verified",
      "Battery backup autonomy verified",
      "Credential enrolment and revocation audit performed",
      "Event log and audit trail reviewed",
      "Server / controller database backup verified",
      "Tamper detection tested",
    ],
  },
  {
    id:"ids", name:"Intrusion / Hold-up System", icon:"🚨", color:"#7B1FA2",
    match:["intrusion","intruder","burglar","ids"],
    standards:"EN 50131-1 (intrusion and hold-up systems — system requirements, security Grades 1–4) · IEC 62642 · EN 50131-6 (power supplies) · EN 50130-5 (environmental classes)",
    fields:[
      {k:"grade", l:"Security grade (1–4)"},
      {k:"envc",  l:"Environmental class (I–IV)"},
      {k:"panel", l:"Panel make & model"},
      {k:"zones", l:"Number of zones"},
      {k:"arc",   l:"ARC / monitoring centre"},
      {k:"paths", l:"Communication paths"},
    ],
    checks:[
      "Control and indicating equipment inspected — no fault conditions",
      "Keypads and arming devices operational",
      "Movement detectors walk-tested (PIR / dual-technology)",
      "Magnetic and opening contacts verified",
      "Glass-break and shock detectors tested",
      "Hold-up and panic devices tested",
      "Internal and external sounders / strobes verified",
      "Tamper circuits on all devices and enclosures tested",
      "Standby battery autonomy verified for the declared grade",
      "Entry / exit timers and zone programming verified",
      "Communication paths tested (IP / GSM — dual path where fitted)",
      "Signal transmission to the alarm receiving centre confirmed",
      "Set and unset (arming) sequence verified",
      "Event log reviewed",
      "Declared security grade still appropriate to the assessed risk",
    ],
  },
  {
    id:"net", name:"Network / Structured Cabling", icon:"🌐", color:"#2E5FA3",
    match:["network","networking","lan","cabling","it"],
    standards:"ANSI/TIA-568 (balanced twisted-pair and optical cabling) · TIA-606 (administration & labelling) · TIA-607 (bonding & grounding) · TIA-569 (pathways & spaces) · ISO/IEC 11801 · TIA-942 (data centres)",
    fields:[
      {k:"cat",   l:"Cable category / fibre type"},
      {k:"links", l:"Number of links tested"},
      {k:"sw",    l:"Switch models"},
      {k:"tester",l:"Tester model & calibration date"},
    ],
    checks:[
      "Permanent-link certification: wire map, length, insertion loss, NEXT / PS-NEXT, return loss (TIA-568)",
      "Fibre links tested: insertion loss, OTDR trace and connector end-face inspection",
      "Labelling and administration records per TIA-606",
      "Bonding and grounding verified per TIA-607",
      "Pathways, bend radius and cable dressing inspected (TIA-569)",
      "Patch panels and outlets secure and correctly terminated",
      "Rack / cabinet condition, airflow and cable management",
      "Switch health: port errors, CRC counters, utilisation and temperature",
      "Configuration backups taken and stored securely",
      "Firmware versions recorded and update status assessed",
      "UPS runtime and battery health verified",
      "Environmental conditions within limits (TIA-942)",
      "IP addressing and VLAN documentation current",
      "Redundancy and failover paths verified",
      "Remote management access and credentials reviewed",
    ],
  },
  {
    id:"elv", name:"ELV Systems (General)", icon:"⚡", color:"#E65100",
    match:["elv","extra low voltage","pa","public address","bms"],
    standards:"EN 50130-4 (EMC immunity — product family standard covering fire, intruder, hold-up, CCTV, access control and social alarm components) · EN 50130-5 (environmental) · discipline standards per sub-system",
    fields:[
      {k:"subs",  l:"Sub-systems covered"},
      {k:"integ", l:"Integration platform"},
    ],
    checks:[
      "All ELV sub-system panels inspected and in normal state",
      "Power supplies, UPS and battery autonomy verified",
      "Earthing and bonding verified",
      "Containment, trunking and cable routes inspected",
      "Labelling and as-built documentation current",
      "Integration and interfaces between sub-systems verified",
      "EMC and environmental conditions acceptable (EN 50130-4 / -5)",
      "Public address / voice evacuation audibility verified",
      "Time synchronisation across sub-systems",
      "Operator training records and O&M manuals available",
      "Spare parts inventory verified",
      "Outstanding defects from the previous visit closed",
    ],
  },
];
const sysTemplate = (id)=> SYS_TEMPLATES.find(t=>t.id===id) || SYS_TEMPLATES[0];
// Effective checklist: admin-edited items for this template, else the standards defaults
function getSysCheckItems(tplId){
  const custom=(state.systemChecks||[]).filter(x=>x.template===tplId)
    .slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(x=>x.name).filter(Boolean);
  return custom.length ? custom : sysTemplate(tplId).checks;
}
// Best-guess mapping from a device's System field to a report template
function sysTemplateForName(name){
  const n=String(name||"").trim().toLowerCase();
  if(!n) return null;
  return SYS_TEMPLATES.find(t=>t.match.some(m=>n.includes(m))) || null;
}
Object.assign(window,{SYS_TEMPLATES,sysTemplate,getSysCheckItems,sysTemplateForName});

// ═══════════════════════════════════════════════════════════════════════
//  WORK ITEMS (threads) — v125
//  A daily entry is an EVENT (one visit/session). Several entries about the
//  same job form ONE work item whose CURRENT status is the status of its
//  latest entry. Counting entries by status double-counts a job that moved
//  In Progress → Closed; counting WORK ITEMS is the truth.
//
//  Grouping rules, in order:
//   1. Explicit `threadId` on the entry always wins (set via "continue this
//      work item" in the form) — lets us merge entries whose classification
//      differs, or split deliberately.
//   2. Otherwise entries group by SIGNATURE (project|area|site|device|
//      category|subcategory) — so every legacy entry threads retroactively
//      with no data migration at all.
//   3. A closing status ENDS the thread. A later entry with the same
//      signature starts a NEW work item — so a fault that recurs months
//      later is correctly a second job, not a resurrected one.
// ═══════════════════════════════════════════════════════════════════════
const CLOSED_STATUS_RE = /(closed|resolved|done|complete|finished|cancel)/i;
function isClosedStatus(s){ return CLOSED_STATUS_RE.test(String(s||"")); }

function wiSignature(r){
  return [r.project,r.area,r.site,r.deviceSerial,r.taskCategory,r.taskSubcategory]
    .map(x=>String(x||"").trim().toLowerCase()).join("|");
}
// chronological order key for entries (date, then entry no, then created)
function _wiOrd(r){ return `${r.date||""}|${String(r.entryNo||0).padStart(6,"0")}|${r.id||""}`; }

// Build work items from a set of daily rows.
function buildWorkItems(rows){
  const sorted=(rows||[]).slice().sort((a,b)=>_wiOrd(a).localeCompare(_wiOrd(b)));
  const items=[]; const openBySig={}; const byThread={};
  for(const r of sorted){
    let it;
    if(r.threadId){
      it=byThread[r.threadId];
      if(!it){ it=_wiNew(r,r.threadId); byThread[r.threadId]=it; items.push(it); }
    } else {
      const sig=wiSignature(r);
      it=openBySig[sig];
      if(!it){ it=_wiNew(r,"sig:"+sig+":"+items.length); openBySig[sig]=it; items.push(it); }
    }
    _wiPush(it,r);
    if(!r.threadId && isClosedStatus(r.taskStatus)) delete openBySig[wiSignature(r)];  // thread ends here
  }
  return items.map(_wiFinish).sort((a,b)=>String(b.lastDate).localeCompare(String(a.lastDate)));
}
function _wiNew(r,key){
  return { key, project:r.project||"", area:r.area||"", site:r.site||"", deviceSerial:r.deviceSerial||"",
    taskCategory:r.taskCategory||"", taskSubcategory:r.taskSubcategory||"", entries:[] };
}
function _wiPush(it,r){ it.entries.push(r); }
function _wiFinish(it){
  const es=it.entries;
  const last=es[es.length-1]||{};
  it.status      = last.taskStatus || "(none)";
  it.closed      = isClosedStatus(it.status);
  it.firstDate   = (es[0]||{}).date || "";
  it.lastDate    = last.date || "";
  it.visits      = es.length;
  it.hours       = +es.reduce((s,r)=>s+Number(r.duration||0),0).toFixed(2);
  it.employees   = [...new Set(es.map(r=>r.employee).filter(Boolean))];
  it.title       = [it.taskCategory,it.taskSubcategory].filter(Boolean).join(" › ")
                   || (last.workType||"") || "Work item";
  it.scopeLabel  = [it.project,it.area,it.site,it.deviceSerial?("📟 "+it.deviceSerial):""].filter(Boolean).join(" › ");
  // status journey: only the points where the status actually changed
  const tl=[]; let prev=null;
  for(const r of es){
    const s=r.taskStatus||"(none)";
    if(s!==prev){ tl.push({date:r.date,status:s,by:r.employee||"",entryNo:r.entryNo||null}); prev=s; }
  }
  it.timeline=tl;
  return it;
}
// Open work items matching a scope — powers the "continue this work item" card
function openWorkItemsFor(form){
  if(!form || !form.project) return [];
  const scope=(state.daily||[]).filter(r=>
    (r.project||"")===(form.project||"") &&
    (!form.area || (r.area||"")===form.area) &&
    (!form.site || (r.site||"")===form.site));
  if(!scope.length) return [];
  return buildWorkItems(scope).filter(w=>!w.closed);
}
// Status counts by WORK ITEM (the correct denominator for KPIs/reports)
function statusCountsByWorkItem(rows){
  const out={}; buildWorkItems(rows).forEach(w=>{ out[w.status]=(out[w.status]||0)+1; });
  return out;
}
Object.assign(window,{isClosedStatus,wiSignature,buildWorkItems,openWorkItemsFor,statusCountsByWorkItem});

function getTaskCategories(){
  // Returns { categoryName: [subcategories...] }
  const fromDb = (state.techCategories||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  if(fromDb.length){
    const obj = {};
    fromDb.forEach(c=>{ if(c.name) obj[c.name] = c.subcategories || []; });
    return obj;
  }
  return TASK_CATEGORIES;
}
const EMP_COLORS = ["#1B5E9B","#C9A84C","#2E7D32","#E65100","#6A1B9A","#3949AB","#00897B","#D81B60"];

const DEFAULT_PROJECTS = [
  ["Asia cell","Enterprise"],["Garmian petroleum","Security"],["Inmaa","Enterprise"],
  ["newrozFM200","Security"],["Down town","Enterprise"],["Yana","Security"],
  ["AUK-FM200","Security"],["Alsafi danon","Security"],["MST-Baghdad","Security"],
  ["Alraaedi-FM200","Security"],["Iratrac","Security"],["Justice tower","Enterprise"],
  ["Northholand towers","Security"],["Masarat","Enterprise"],["Greyhound Erbil","Security"],
  ["London Tower","Security"],["Americana","Security"],["Fast Iraq","Enterprise"],
  ["Asia cell Mosul","Enterprise"],["Alwazir","Security"],
  ["HR & Admin Tasks","Ejaf"],["Legal & Compliance","Ejaf"],["Finance & Accounting","Ejaf"],
  ["IT & Infrastructure","Ejaf"],["Company Meetings","Ejaf"],["Training & Development","Ejaf"],
  ["Procurement","Ejaf"],["General Affairs","Ejaf"],
].map(([name,dept])=>({id:name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name,dept}));

const DEFAULT_LOCATIONS = ["Erbil","Sulaymaniyah","Duhok","Kallar","Zakho","Baghdad","Basra"]
  .map(name=>({id:name.toLowerCase(),name}));

const PER_DIEM_RATE = 40000;

const state = {
  user: null,           // Firebase auth user
  profile: null,        // {role, name, email, employeeName, ...} from users collection
  daily: [], overtime: [], travel: [], leaves: [], projects: [], locations: [], users: [], departments: [], branches: [],
  techWorkTypes: [], techStatuses: [], techCategories: [],
  requestStatuses: [], projectStatuses: [],   // Client Request Entry options (admin-editable)
  devices: [],  // Asset Management: central devices collection
  pmSchedules: [],  // Preventive Maintenance schedules
  settingsDocs: [],  // settings collection (sla, etc.)
  trash: [],  // Recycle Bin (30-day recoverable deletes)
  techReportCols: null,  // admin's column selection for Technical Report (from settings/techReport)
  workCategories: [], workTasks: [],  // Work Instructions module
  nametagEmployees: [],  // Admin-managed nametag-only employees (no auth account)
  employeePermissions: [],  // Per-employee entry permissions (GPS / Resolution requirements)
  clientPermissions: [],    // Per-client portal permissions (project details, filters, reports, edit-suggest)
  deviceEditSuggestions: [], // Client-proposed device edits awaiting admin approval
  tasks: [],             // Task-assignment workflow (from client requests or manual)
  notifications: [],     // In-app notifications (header bell)
  clients: [],          // Client companies with linked users + projects
  clientRequests: [],   // Task requests submitted by clients
  waContacts: [],       // WhatsApp contacts/groups (Firestore)
  waSettings: null,     // WhatsApp settings doc (fields, roles, triggers)
  emailContacts: [],    // Email recipients (Firestore)
  emailSettings: null,  // Email settings doc (enabled, keys, fields, triggers)
  scheduledReports: null, // Scheduled reports config (date range, time, recipients, message)
  globalEmployeeFilter: [],  // multi-select filter for reports (empty = all)
  globalProjectFilter: "",     // single project filter for reports (empty = all)
  globalLocationFilter: "",    // single location filter for reports (empty = all)
  globalBranchFilter: "",      // single branch filter for reports (empty = all)
  globalEmpDeptFilter: "",     // filter by EMPLOYEE's department (who they are, not the task's dept)
  globalTaskDeptFilter: "",    // filter by TASK's department (the project's dept, not who did it)
  globalWorkTypeFilter: "",    // technical: Work Type (Onsite, Remote...)
  globalTaskStatusFilter: "",  // technical: Task Status (New, Pending...)
  globalCategoryFilter: "",    // technical: Category (Network, CCTV...)
  globalSubcategoryFilter: "", // technical: Subcategory (cascades from Category)
  tab: "Dashboard",
  initialized: false,
  unsubs: [],           // active Firestore listeners
  _sessionUnsub: null,  // session-lock listener
  reportFilter: { from: "", to: "", project: "" },  // for flexible reports
};

// Forms
let dailyForm=null, dailyEditId=null, dailyFilter="", dailyLocFilter="", dailyProjFilter="", dailyEntryNo="";
let otForm=null, otEditId=null;
let trForm=null, trEditId=null;
let projForm=null, projEditId=null;
let locForm="", locEditId=null;
let userForm=null, userEditId=null;
let nametagForm={name:"", type:"internal", branch:"", dept:""}, nametagEditId=null;
let leaveForm = null, leaveEditId = null, leaveFilter = "";
let deviceForm = null, deviceEditId = null;
let deptForm = null;
let deptEditId = null;
let branchForm=null, branchEditId=null;
let wiCategoryForm = null, wiCategoryEditId = null;
let wiTaskForm = null, wiTaskEditId = null;
let profileForm = null;
let clientForm=null, clientEditId=null;
let requestForm=null;
let waContactForm = null, waContactEditId = null;
let emailContactForm = null, emailContactEditId = null;   // ← hoisted (fixes "Cannot access before initialization")

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════
const $=id=>document.getElementById(id);
// BUSINESS today — uses the company timezone set in Settings → Profile
// (default Asia/Baghdad), NOT the device's own clock/timezone. This way every
// employee's phone — wherever it's configured — agrees on the same "today",
// and the day genuinely rolls over at local midnight in that timezone.
function _dtDoc(){ return (state.settingsDocs||[]).find(x=>x.id==="dateTime")||{}; }
function getAppTZ(){ return _dtDoc().tz || "Asia/Baghdad"; }
window.getAppTZ=getAppTZ;
// Business "now": in Manual mode the admin pins the clock to a chosen date/time;
// we store the difference from real time (offsetMs) so the manual clock keeps
// TICKING forward from the chosen moment instead of standing still.
function appNow(){
  const d=_dtDoc();
  const off=(d.mode==="manual"&&Number.isFinite(d.offsetMs))?d.offsetMs:0;
  return new Date(Date.now()+off);
}
window.appNow=appNow;
const today=(d)=>{
  try{
    return new Intl.DateTimeFormat('en-CA',{timeZone:getAppTZ(),year:'numeric',month:'2-digit',day:'2-digit'}).format(d||appNow());
  }catch(e){
    const x=d||appNow();
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  }
};
// Auto-roll the Daily Log date at midnight (business timezone) for a session
// left open overnight. Only touches the date if the user hasn't already
// changed it away from the day the form was opened on — never overwrites a
// deliberate backfill to a different day.
window._lastKnownDay = window._lastKnownDay || today();
function _checkDayRollover(){
  try{
    const t=today();
    if(t!==window._lastKnownDay){
      const prev=window._lastKnownDay;
      window._lastKnownDay=t;
      if(state.tab==="Daily Log" && dailyForm && !dailyEditId && dailyForm.date===prev){
        dailyForm.date=t;
        toast("📅 New day — date updated automatically");
        render();
      }
    }
  }catch(e){}
}
setInterval(_checkDayRollover, 60000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) _checkDayRollover(); });
const fmtDate=(d)=>d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"}):"—";
const fmtMoney=(n)=>n==null||n===""?"—":Math.round(Number(n)||0).toLocaleString();
const fmtHM=(hrs)=>{
  if(!hrs||isNaN(hrs))return "0:00";
  const h=Math.floor(hrs),m=Math.round((hrs-h)*60);
  return m===60?`${h+1}:00`:`${h}:${m.toString().padStart(2,"0")}`;
};
const timeToHrs=(s,e)=>{
  if(!s||!e)return 0;
  const[sh,sm]=s.split(":").map(Number),[eh,em]=e.split(":").map(Number);
  let mins=(eh*60+em)-(sh*60+sm);
  if(mins<0) mins+=24*60;  // overnight shift: end time is on the next calendar day
  return mins/60;
};
const dayName=(d)=>d?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(d).getDay()]:"";

// Format a day count cleanly: 4.2222… → "4.2", 5 → "5", 4.0 → "4"
function fmtDays(n){
  const v = Number(n) || 0;
  if(Number.isInteger(v)) return String(v);
  return v.toFixed(1).replace(/\.0$/, "");
}

// Format a timestamp as a readable "last seen" date + time (e.g. "28 Jun 2026, 14:30")
function fmtLastSeen(iso){
  if(!iso) return "";
  try{
    const d = new Date(iso);
    if(isNaN(d.getTime())) return "";
    const date = d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
    const time = d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
    return `${date}, ${time}`;
  }catch(e){ return ""; }
}
const projDept=(p)=>{const tp=(p||"").trim();return state.projects.find(x=>(x.name||"").trim()===tp)?.dept||"";};
const deptBadge=(d)=>{if(!d)return "";const c=d==="Enterprise"?"ent":d==="Security"?"sec":"eja";return `<span class="badge badge-${c}">${d}</span>`;};
const escapeHtml=(s)=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

// ═══════════════════════════════════════════════════════════════════════
//  IMAGE COMPRESSION HELPER
//  Compresses an image File to a base64 string for Firestore storage.
//  Settings: max 1024px width, 60% JPEG quality → typically ~50-150 KB
// ═══════════════════════════════════════════════════════════════════════
function compressImage(file, maxWidth = 1024, quality = 0.6){
  return new Promise((resolve, reject) => {
    if(!file || !file.type.startsWith('image/')){
      return reject(new Error('Not an image'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Read failed'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image load failed'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if(w > maxWidth){
          h = Math.round(h * (maxWidth / w));
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // White background (handles transparent PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Approximate KB size of a base64 string
function base64SizeKB(b64){
  if(!b64) return 0;
  const len = b64.length - (b64.indexOf(',') + 1);
  return Math.round(len * 3 / 4 / 1024);
}

let toastTimer;

// ── Crisp SVG icon set (currentColor) — replaces emoji in header & main nav ──
const _svg=(p)=>`<svg class="nvic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
// ── Girêk icon set v3 — SOLID fills only (no <defs>, no url(#id) references).
// Why: gradients defined with an id broke when the same icon was rendered in two
// places (top group bar + bottom nav). The duplicate/unresolved reference left the
// plate unpainted, so only the white glyph showed. Solid colors cannot fail; a
// translucent gloss shape keeps the same dimensional feel.
// ── Girêk icon set v4 — PREMIUM GLOSS (safe gradients) ──
// v81 lesson: a gradient defined once broke when its <defs> lived inside the
// hidden top bar (display:none defs don't render → url(#id) painted nothing).
// ── Girêk nav icon suite v5 — premium unified LINE icons ──────────────────
// One geometric language across the whole app (à la Monday / Linear / Notion):
// 24-grid, single stroke weight, rounded caps, currentColor. Inactive tabs sit
// quiet in muted blue-grey; the active tab turns gold and picks up the existing
// CSS glow — no gradients, no <defs>, nothing to collide between instances.
const _NGLY={
  Dashboard:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  Logs:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  Reports:'<path d="M3.5 3.5v15a2 2 0 0 0 2 2h15"/><path d="M7.5 14.5l4-4 3 3 5.5-5.5"/><path d="M16.5 8H20v3.5"/>',
  Database:'<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5V12c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V5.5"/><path d="M4 12v6.5c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8V12"/>',
  Clients:'<circle cx="9" cy="8" r="3.3"/><path d="M3.5 20c.4-3 2.6-5 5.5-5s5.1 2 5.5 5"/><path d="M15.5 5.4a3.3 3.3 0 0 1 0 5.9"/><path d="M17.8 15.4c1.7.9 2.6 2.5 2.7 4.6"/>',
  Settings:'<path d="M4 6h6"/><path d="M14.2 6H20"/><circle cx="12" cy="6" r="2.2"/><path d="M4 12h2"/><path d="M10.2 12H20"/><circle cx="8" cy="12" r="2.2"/><path d="M4 18h8"/><path d="M16.2 18H20"/><circle cx="14" cy="18" r="2.2"/>',
  Help:'<circle cx="12" cy="12" r="8.6"/><path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.1-2.6 3.6"/><path d="M12 17.2v.01"/>',
};
// getters (kept): _svg is hoist-safe here and this stays drop-in compatible
const NAV_ICONS={
  get Dashboard(){ return _svg(_NGLY.Dashboard); },
  get Logs(){      return _svg(_NGLY.Logs); },
  get Reports(){   return _svg(_NGLY.Reports); },
  get Database(){  return _svg(_NGLY.Database); },
  get Clients(){   return _svg(_NGLY.Clients); },
  get Settings(){  return _svg(_NGLY.Settings); },
  get Help(){      return _svg(_NGLY.Help); },
};
// ── ICN: unified inline action icons (SVG, currentColor — identical on every OS) ──
const _icn=(p)=>`<svg class="icn" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${p}"/></svg>`;
const ICN={
  edit:_icn("M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"),
  del:_icn("M9 3h6l1 2h5v2H3V5h5l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h1.6v-8H10zm3.4 0v8H15v-8h-1.6z"),
  check:_icn("M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"),
  pause:_icn("M6 5h4v14H6zM14 5h4v14h-4z"),
  play:_icn("M8 5v14l11-7z"),
  hist:_icn("M13 3a9 9 0 1 0 8.95 10h-2.02A7 7 0 1 1 13 5v3l4.5-4L13 0v3zm-1 5v5.2l4.3 2.5.8-1.3-3.5-2.1V8H12z"),
  pin:_icn("M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z"),
  x:_icn("M18.3 5.71 12 12.01l-6.29-6.3-1.42 1.42 6.3 6.29-6.3 6.29 1.42 1.42 6.29-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.29z"),
  clock:_icn("M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5h-2v6l5 3 1-1.72-4-2.3z"),
};
window.ICN=ICN;

const ICON_BELL=_svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>');
const ICON_SUN=_svg('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>');
const ICON_MOON=_svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');
// Compact period label for the header pill ("25 Jun 2026 -> 24 Jul 2026" -> "25 Jun – 24 Jul")
function shortPeriod(){
  const p = getPeriod();
  return p.replace(/\s*(\d{4})/g,'').replace(/\s*(→|->)\s*/,' – ').trim() || p;
}
// Skeleton page shown until the first data sync completes
function skeletonHTML(){
  const bar=(w)=>`<div class="skl-bar" style="width:${w}"></div>`;
  const card=`<div class="card skl-card">${bar('40%')}${bar('92%')}${bar('86%')}${bar('64%')}</div>`;
  return card+card+card;
}
// Fixed bottom navigation (mobile) — mirrors the main groups
function renderBottomNav(){
  try{
    const all=(getVisibleGroups()||[]);
    let el=document.getElementById('bottomNav');
    if(!all.length || !state.user){ if(el) el.style.display='none'; document.body.classList.remove('has-bnav'); return; }
    if(!el){ el=document.createElement('div'); el.id='bottomNav'; document.body.appendChild(el); }
    el.style.display='';
    document.body.classList.add('has-bnav');
    const cur=groupOfTab(state.tab);
    const main=all.slice(0,4), rest=all.slice(4);
    const moreOn = rest.some(g=>g.id===cur);
    el.innerHTML = main.map(g=>`<button class="bnav-it ${g.id===cur?'on':''}" onclick="switchGroup('${g.id}')">${NAV_ICONS[g.id]||''}<span>${g.label}</span></button>`).join('')
      + (rest.length?`<button class="bnav-it ${moreOn?'on':''}" onclick="toggleMoreSheet()">${_svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>')}<span>More</span></button>`:'');
    // "More" sheet (hidden until toggled)
    let sh=document.getElementById('moreSheet');
    if(!sh){ sh=document.createElement('div'); sh.id='moreSheet'; document.body.appendChild(sh); }
    sh.innerHTML = rest.map(g=>`<button class="msheet-it ${g.id===cur?'on':''}" onclick="switchGroup('${g.id}');toggleMoreSheet(false)">${NAV_ICONS[g.id]||''}<span>${g.label}</span></button>`).join('');
    if(!moreOnKeepOpen()) sh.classList.remove('open');

    // ── Floating Action Button: the day's most common actions, one thumb away ──
    const tabsFlat=(typeof visibleTabs==="function"?visibleTabs():[])||[];
    const acts=[["Daily Log","🔧","Work Entry"],["Overtime","⏰","Overtime"],["Travel","✈️","Travel"],["Leaves","🌴","Leave"]]
      .filter(a=>tabsFlat.includes(a[0]));
    let fab=document.getElementById('fab'), fsh=document.getElementById('fabSheet');
    if(!acts.length){ if(fab)fab.remove(); if(fsh)fsh.remove(); }
    else{
      if(!fab){ fab=document.createElement('button'); fab.id='fab'; fab.setAttribute('aria-label','Quick add'); document.body.appendChild(fab); }
      if(!fsh){ fsh=document.createElement('div'); fsh.id='fabSheet'; document.body.appendChild(fsh); }
      fab.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26" fill="#1B3A6B"><path d="M11 5h2v14h-2z"/><path d="M5 11h14v2H5z"/></svg>';
      fab.onclick=()=>document.body.classList.toggle('fab-open');
      fsh.innerHTML='<div class="fsh-t">Quick add</div>'+acts.map(a=>
        `<button class="fsh-it" onclick="_fabGo('${a[0]}')"><span class="fsh-ic">${a[1]}</span><span>${a[2]}</span></button>`).join('');
    }
  }catch(e){}
}
window._fabGo=function(tab){
  document.body.classList.remove('fab-open');
  switchTab(tab);
  window.scrollTo({top:0,behavior:'smooth'});
};
function moreOnKeepOpen(){ return false; }
window.toggleMoreSheet=function(force){
  const sh=document.getElementById('moreSheet'); if(!sh) return;
  const open = force!==undefined ? force : !sh.classList.contains('open');
  sh.classList.toggle('open', open);
};

function toast(msg){
  const t=$("toast");
  if(!t)return;
  const s=String(msg||"");
  const type=/error|failed|denied|✗/i.test(s)?"err":(/⚠|required|invalid|already|only|missing/i.test(s)?"warn":(/✓|saved|added|updated|sent|ready|deleted|downloaded/i.test(s)?"ok":"info"));
  t.setAttribute("data-type",type);
  if(type==="ok"){ try{ navigator.vibrate && navigator.vibrate(14); }catch(e){} }
  t.textContent=s;t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove("show"),2800);
}

// Role helpers — 6-role system v3.0
// Default: if role is unset/invalid, treat as EMPLOYEE (most restrictive).
function getUserRole(){
  const r = (state.profile?.role || "").toString().toLowerCase().trim();
  if(r === "admin" || r === "owner")  return "admin";   // Owner = full Admin
  if(r === "support")                  return "support"; // Full access except Users
  if(r === "hr" || r === "manager")   return "hr";
  if(r === "it")                       return "it";      // Dashboard + WorkInstructions only
  if(r === "client")                   return "client";  // Client portal: own projects only
  return "employee"; // safe default — most restrictive
}
function isClient(){ return getUserRole() === "client"; }

// Can the current user SEE the "Send Email" button?
// Requires the email service to be enabled AND role permission.
function emailGetSettings(){
  return state.emailSettings || {
    enabled: false, serviceId:"", templateId:"", publicKey:"",
    enabledFields: ["employee","date","time","project","location","duration","resolutionText"],
    allowedRoles: ["admin"], triggers: ["daily","clientRequests"],
    subject: "New Task — EJAF Operations",
    autoSend: true,            // master: send automatically on new task
    requestRecipients: [],     // dedicated emails for client-request alerts
    includeEmployees: false,   // also send to all users with employee role
    includeClients: false,     // also send to all client users
  };
}

// Resolve the full recipient list: manual contacts + (optionally) all employees + all clients.
// Returns array of {name, email}, de-duplicated by email.
function resolveEmailRecipients(){
  const s = emailGetSettings();
  const out = [];
  const seen = new Set();
  const add = (name, email) => {
    if(!email || !email.includes("@")) return;
    const key = email.toLowerCase().trim();
    if(seen.has(key)) return;
    seen.add(key);
    out.push({name: name||email, email: email.trim()});
  };
  // 1. Manual recipients
  (state.emailContacts||[]).forEach(c => add(c.name, c.email));
  // 2. All employee-role users (if enabled)
  if(s.includeEmployees){
    (state.users||[]).forEach(u => {
      const role = (u.role||"").toLowerCase();
      if(role==="employee" || role==="hr" || role==="support" || role==="it") add(u.name, u.email);
    });
  }
  // 3. All client users (if enabled)
  if(s.includeClients){
    (state.users||[]).forEach(u => {
      if((u.role||"").toLowerCase()==="client") add(u.name, u.email);
    });
  }
  return out;
}

function canUseEmail(){
  const s = emailGetSettings();
  if(!s.enabled) return false;  // master switch off
  if(isAdmin()) return true;
  return (s.allowedRoles||["admin"]).includes(getUserRole());
}

// Can the current user SEE the "Share to WhatsApp" button?
// Admin always can; other roles depend on waSettings.allowedRoles.
function canUseWhatsApp(){
  if(isAdmin()) return true;
  const allowed = (state.waSettings?.allowedRoles) || ["admin"];
  return allowed.includes(getUserRole());
}
// Get the client record linked to the logged-in user
// Human label for a client's linked login: email → user name → "linked"
function linkedClientLabel(c){
  if(c.linkedUserEmail) return c.linkedUserEmail;
  if(c.linkedUserUid){
    const u=(state.users||[]).find(x=>x.id===c.linkedUserUid);
    return (u&&(u.name||u.email))||"linked";
  }
  return "";
}
function getMyClientRecord(){
  if(!isClient()) return null;
  return (state.clients||[]).find(c => 
    (c.linkedUserEmail||"").toLowerCase() === (state.profile?.email||"").toLowerCase() ||
    c.linkedUserUid === state.profile?.uid
  ) || null;
}
// Projects visible to the current client
function getMyClientProjects(){
  const c = getMyClientRecord();
  return c ? (c.projects||[]) : [];
}
function isAdmin()   { return getUserRole() === "admin"; }
function isSupport() { return getUserRole() === "support"; }
function isHR()      { const r=getUserRole(); return r==="admin"||r==="hr"||r==="support"; }
function isIT()      { return getUserRole() === "it"; }
function isEmployee(){ return getUserRole() === "employee"; }
// Compound permission checks
function canManageData()  { return isAdmin() || isSupport() || getUserRole()==="hr"; }
// Capability grants (stored on the user doc; admin toggles them in Settings → Permissions)
function hasCap(cap){ if(isAdmin()) return true; return !!(state.profile && state.profile[cap]); }
window.hasCap=hasCap;
function canSeeReports()  { return isAdmin() || isSupport() || getUserRole()==="hr" || !!(state.profile&&state.profile.canViewReports); }
function canManageUsers() { return isAdmin(); } // Owner maps to admin, so covered
function canAddWorkInstructions()  { return isAdmin() || isIT(); }
function canEditWorkInstructions() { return isAdmin(); }

// Filter rows by role
function visibleRows(rows){
  if(isHR()) return rows;
  if(isClient()){
    const myProjects = getMyClientProjects();
    return rows.filter(r=>myProjects.includes(r.project));
  }
  return rows.filter(r=>r.employee===state.profile?.employeeName);
}

// Get list of employees (from users + defaults)
// Only includes users explicitly marked as tracked employees (isTrackedEmployee=true)
// or users whose role is "employee" (default behavior for backward compatibility)
function allEmployees(){
  const fromUsers = state.users
    .filter(u => {
      if(!u.employeeName) return false;
      // Explicit flag takes priority
      if(u.isTrackedEmployee === true) return true;
      if(u.isTrackedEmployee === false) return false;
      // Backward compatibility: include only "employee" role by default
      // HR and admin are EXCLUDED unless explicitly marked
      // Case-insensitive role comparison for safety
      const role = (u.role || "").toString().toLowerCase().trim();
      return role === "employee";
    })
    .map(u => (u.employeeName || "").trim())
    .filter(Boolean);
  const fromNametags = (state.nametagEmployees || []).map(n => (n.name || "").trim()).filter(Boolean);
  const merged = Array.from(new Set([...EMPLOYEES_DEFAULT, ...fromUsers, ...fromNametags]));
  return merged;
}

// ─────────────────────────────────────────────────────────────────────
// SUPERVISOR HELPERS — a supervisor can log data for their team members
// ─────────────────────────────────────────────────────────────────────
// Is the current user a supervisor?
function isSupervisor(){
  const me = state.profile || {};
  return me.isSupervisor === true;
}
// Names of employees who report to the current supervisor (+ the supervisor themselves)
function myTeamEmployees(){
  const me = state.profile || {};
  const myName = me.employeeName || me.name || "";
  const team = state.users
    .filter(u => (u.supervisorName||"") === myName && (u.employeeName||u.name))
    .map(u => (u.employeeName || u.name || "").trim())
    .filter(Boolean);
  // include the supervisor themselves if they have a tracked name
  if(myName) team.unshift(myName);
  return Array.from(new Set(team));
}
// The list of employees the current user is allowed to enter data for
function enterableEmployees(){
  if(isHR()) return allEmployees();              // HR/Admin → everyone
  if(isSupervisor()) return myTeamEmployees();    // Supervisor → their team
  if(isEmployee()) return state.profile.employeeName ? [state.profile.employeeName] : [];
  return [];
}
function isExternalEmployee(name){
  if(!name) return false;
  const n = String(name).trim();
  const tag = (state.nametagEmployees || []).find(e => (e.name||"").trim() === n);
  return tag && tag.type === "external";
}

function employeeBadge(name){
  if(!name) return "—";
  const safe = escapeHtml(name);
  if(isExternalEmployee(name)){
    return `<span style="display:inline-flex;align-items:center;gap:5px;color:#7F4A00;font-weight:700">${safe}<span style="background:linear-gradient(135deg,#FF9800 0%,#FFB74D 100%);color:#fff;padding:1px 7px;border-radius:6px;font-size:9px;font-weight:800;letter-spacing:0.5px;box-shadow:0 1px 3px rgba(0,0,0,0.15)">EXT</span></span>`;
  }
  return safe;
}

function employeePlainBadge(name){
  // For places where HTML is not appropriate (e.g. Excel export)
  if(!name) return "";
  if(isExternalEmployee(name)) return `[EXT] ${name}`;
  return name;
}

// Apply global filter to a list of records by `employee` field
function applyEmployeeFilter(rows){
  const sel = state.globalEmployeeFilter || [];
  if(!sel || sel.length === 0) return rows;
  return rows.filter(r => sel.includes(r.employee));
}

// ── MASTER REPORT FILTER ──
// Applies ALL active filters at once: date period + employee + project + location.
// Used across every report view so filters are consistent everywhere.
// dateField defaults to "date" (use "from" for leaves).
// Project/location filters are skipped for records that don't carry those fields
// (e.g. leaves have no project/location), so they don't vanish unexpectedly.
function applyReportFilters(rows, dateField="date"){
  let out = filterByPeriod(rows, dateField);          // 1. date range
  const sel = state.globalEmployeeFilter || [];
  if(sel.length > 0) out = out.filter(r => sel.includes(r.employee)); // 2. employee
  const pf = state.globalProjectFilter || "";
  if(pf) out = out.filter(r => !("project" in r) || r.project === pf); // 3. project (skip if field absent)
  const lf = state.globalLocationFilter || "";
  if(lf) out = out.filter(r => !("location" in r) || r.location === lf); // 4. location (skip if field absent)
  const bf = state.globalBranchFilter || "";
  if(bf){                                              // 5. branch (map employee → branch via users + nametags)
    const branchEmployees = new Set([
      ...state.users.filter(u=>(u.branch||"")===bf).map(u=>u.employeeName||u.name),
      ...(state.nametagEmployees||[]).filter(n=>(n.branch||"")===bf).map(n=>n.name),
    ].filter(Boolean));
    out = out.filter(r => !("employee" in r) || branchEmployees.has(r.employee));
  }
  const edf = state.globalEmpDeptFilter || "";
  if(edf){                                             // 6. employee's department (who they are, not the task dept)
    const deptEmployees = new Set([
      ...state.users.filter(u=>(u.userDept||"")===edf).map(u=>u.employeeName||u.name),
      ...(state.nametagEmployees||[]).filter(n=>(n.dept||"")===edf).map(n=>n.name),
    ].filter(Boolean));
    out = out.filter(r => !("employee" in r) || deptEmployees.has(r.employee));
  }
  const tdf = state.globalTaskDeptFilter || "";
  if(tdf){                                             // 7. task's department (the record's own dept field)
    out = out.filter(r => !("dept" in r) || r.dept === tdf);
  }
  // 8-11. Technical classification filters (Resolution fields live only on daily records).
  //       Skip records that don't carry the field so non-daily rows don't vanish.
  const wtf = state.globalWorkTypeFilter || "";
  if(wtf) out = out.filter(r => !("workType" in r) || r.workType === wtf);
  const tsf = state.globalTaskStatusFilter || "";
  if(tsf) out = out.filter(r => !("taskStatus" in r) || r.taskStatus === tsf);
  const cf = state.globalCategoryFilter || "";
  if(cf) out = out.filter(r => !("taskCategory" in r) || r.taskCategory === cf);
  const scf = state.globalSubcategoryFilter || "";
  if(scf) out = out.filter(r => !("taskSubcategory" in r) || r.taskSubcategory === scf);
  return out;
}
// True if ANY global filter (beyond date) is active
// Build a short human label of the active filters (for report headers)
function reportFilterLabel(){
  const parts = [];
  const sel = state.globalEmployeeFilter || [];
  if(sel.length===1) parts.push(sel[0]);
  else if(sel.length>1) parts.push(`${sel.length} employees`);
  if(state.globalBranchFilter) parts.push(`Branch: ${state.globalBranchFilter}`);
  if(state.globalEmpDeptFilter) parts.push(`${state.globalEmpDeptFilter} staff`);
  if(state.globalTaskDeptFilter) parts.push(`${state.globalTaskDeptFilter} tasks`);
  if(state.globalProjectFilter) parts.push(state.globalProjectFilter);
  if(state.globalLocationFilter) parts.push(state.globalLocationFilter);
  if(state.globalWorkTypeFilter) parts.push(`🔧 ${state.globalWorkTypeFilter}`);
  if(state.globalTaskStatusFilter) parts.push(`📊 ${state.globalTaskStatusFilter}`);
  if(state.globalCategoryFilter) parts.push(`📁 ${state.globalCategoryFilter}`);
  if(state.globalSubcategoryFilter) parts.push(`↳ ${state.globalSubcategoryFilter}`);
  return parts.join(" · ");
}

function hasActiveReportFilter(){
  return (state.globalEmployeeFilter||[]).length>0 ||
         !!state.globalProjectFilter ||
         !!state.globalLocationFilter ||
         !!state.globalBranchFilter ||
         !!state.globalEmpDeptFilter ||
         !!state.globalTaskDeptFilter ||
         !!state.globalWorkTypeFilter ||
         !!state.globalTaskStatusFilter ||
         !!state.globalCategoryFilter ||
         !!state.globalSubcategoryFilter ||
         !!getPeriodFrom() || !!getPeriodTo();
}

// ─────────────────────────────────────────────────────────────────────
// GLOBAL EMPLOYEE FILTER UI (Multi-Select)
// Used across HR Report, Reports tab, and Dashboard
// ─────────────────────────────────────────────────────────────────────
function renderEmployeeFilterUI(label){
  if(isEmployee()) return "";  // employees don't filter
  const emps = allEmployees();
  const sel = state.globalEmployeeFilter || [];
  const allSelected = sel.length === 0;
  const projF = state.globalProjectFilter || "";
  const locF = state.globalLocationFilter || "";
  const branchF = state.globalBranchFilter || "";
  const empDeptF = state.globalEmpDeptFilter || "";
  const taskDeptF = state.globalTaskDeptFilter || "";
  const workTypeF = state.globalWorkTypeFilter || "";
  const statusF = state.globalTaskStatusFilter || "";
  const categoryF = state.globalCategoryFilter || "";
  const subcatF = state.globalSubcategoryFilter || "";
  const allProjects = [...new Set([...state.daily,...state.overtime,...state.travel].map(r=>r.project).filter(Boolean))].sort();
  const allLocations = [...new Set([...state.daily,...state.overtime,...state.travel].map(r=>r.location).filter(Boolean))].sort();
  const allBranches = (state.branches||[]).map(b=>b.name).filter(Boolean).sort();
  const allEmpDepts = state.departments.map(d=>d.name).filter(Boolean).sort();
  const allTaskDepts = state.departments.map(d=>d.name).filter(Boolean).sort();
  // Technical classification options (from editable lists, falling back to defaults)
  const allWorkTypes = getWorkTypes();
  const allStatuses = getTaskStatuses();
  const catsObj = getTaskCategories();                 // { category: [subs] }
  const allCategories = Object.keys(catsObj).sort();
  // Subcategories: those of the selected category, else all subs across categories
  const allSubcats = categoryF
    ? (catsObj[categoryF] || []).slice().sort()
    : [...new Set(Object.values(catsObj).flat())].sort();
  return `<div style="background:linear-gradient(135deg,#F0F4FA 0%,#E8F0F9 100%);border:1.5px solid #2E5FA3;border-radius:10px;padding:12px 14px;margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:${sel.length>0?'8px':'0'};flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">🔎</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1B3A6B">${escapeHtml(label||"Filter Report")}</div>
          <div style="font-size:11px;color:#2E5FA3">${allSelected ? `All ${emps.length} employees` : `${sel.length} of ${emps.length} selected`}${branchF?` · 🏙️ ${escapeHtml(branchF)}`:''}${empDeptF?` · 👥 ${escapeHtml(empDeptF)}`:''}${taskDeptF?` · 🗂️ ${escapeHtml(taskDeptF)} tasks`:''}${projF?` · 📁 ${escapeHtml(projF)}`:''}${locF?` · 📍 ${escapeHtml(locF)}`:''}${workTypeF?` · 🔧 ${escapeHtml(workTypeF)}`:''}${statusF?` · 📊 ${escapeHtml(statusF)}`:''}${categoryF?` · 📁 ${escapeHtml(categoryF)}`:''}${subcatF?` · ↳ ${escapeHtml(subcatF)}`:''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:white;border:1.5px solid var(--line);color:#2E5FA3;font-weight:700" onclick="openEmployeeFilterModal()">
          👥 ${allSelected ? 'Employees' : 'Edit'}
        </button>
        ${(!allSelected||projF||locF||branchF||empDeptF||taskDeptF||workTypeF||statusF||categoryF||subcatF) ? `<button class="btn btn-sm" style="background:white;border:1.5px solid var(--line);color:#C53030;font-weight:700" onclick="clearAllReportFilters()">✕ Clear All</button>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button onclick="editPeriod(event)" style="flex:1;min-width:140px;padding:7px 10px;border:1px solid #C9A84C;border-radius:6px;font-size:12px;background:${(getPeriodFrom()||getPeriodTo())?'#FFF8E8':'white'};color:#1B3A6B;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:6px;font-family:inherit">📅 ${escapeHtml(getPeriod())}${(getPeriodFrom()||getPeriodTo())?' ✕':''}</button>
      ${allBranches.length>0?`<select onchange="window.setGlobalBranchFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B;font-weight:600">
        <option value="">🏙️ All Branches</option>
        ${allBranches.map(b=>`<option value="${escapeHtml(b)}" ${b===branchF?"selected":""}>${escapeHtml(b)}</option>`).join("")}
      </select>`:''}
      ${allEmpDepts.length>0?`<select onchange="window.setGlobalEmpDeptFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B;font-weight:600">
        <option value="">👥 All Staff Depts</option>
        ${allEmpDepts.map(d=>`<option value="${escapeHtml(d)}" ${d===empDeptF?"selected":""}>${escapeHtml(d)} staff</option>`).join("")}
      </select>`:''}
      ${allTaskDepts.length>0?`<select onchange="window.setGlobalTaskDeptFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B;font-weight:600">
        <option value="">🗂️ All Task Depts</option>
        ${allTaskDepts.map(d=>`<option value="${escapeHtml(d)}" ${d===taskDeptF?"selected":""}>${escapeHtml(d)} tasks</option>`).join("")}
      </select>`:''}
      <select onchange="window.setGlobalProjectFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B">
        <option value="">📁 All Projects</option>
        ${allProjects.map(p=>`<option value="${escapeHtml(p)}" ${p===projF?"selected":""}>${escapeHtml(p)}</option>`).join("")}
      </select>
      <select onchange="window.setGlobalLocationFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B">
        <option value="">📍 All Locations</option>
        ${allLocations.map(l=>`<option value="${escapeHtml(l)}" ${l===locF?"selected":""}>${escapeHtml(l)}</option>`).join("")}
      </select>
      ${allWorkTypes.length>0?`<select onchange="window.setGlobalWorkTypeFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B;font-weight:600">
        <option value="">🔧 All Work Types</option>
        ${allWorkTypes.map(w=>`<option value="${escapeHtml(w)}" ${w===workTypeF?"selected":""}>${escapeHtml(w)}</option>`).join("")}
      </select>`:''}
      ${allStatuses.length>0?`<select onchange="window.setGlobalTaskStatusFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B;font-weight:600">
        <option value="">📊 All Statuses</option>
        ${allStatuses.map(s2=>`<option value="${escapeHtml(s2)}" ${s2===statusF?"selected":""}>${escapeHtml(s2)}</option>`).join("")}
      </select>`:''}
      ${allCategories.length>0?`<select onchange="window.setGlobalCategoryFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B;font-weight:600">
        <option value="">📁 All Categories</option>
        ${allCategories.map(c=>`<option value="${escapeHtml(c)}" ${c===categoryF?"selected":""}>${escapeHtml(c)}</option>`).join("")}
      </select>`:''}
      ${allSubcats.length>0?`<select onchange="window.setGlobalSubcategoryFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:6px;font-size:12px;background:white;color:#1B3A6B;font-weight:600">
        <option value="">↳ All Subcategories</option>
        ${allSubcats.map(sc=>`<option value="${escapeHtml(sc)}" ${sc===subcatF?"selected":""}>${escapeHtml(sc)}</option>`).join("")}
      </select>`:''}
    </div>
    ${sel.length > 0 ? `
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        ${sel.map(e => {
          const isExt = isExternalEmployee(e);
          const bg = isExt ? '#FFB74D' : '#2E5FA3';
          const fg = isExt ? '#7F4A00' : 'white';
          return `<span style="background:${bg};color:${fg};padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px">
            ${escapeHtml(e)}${isExt ? '<span style="font-size:8px;background:rgba(0,0,0,0.15);padding:1px 4px;border-radius:3px">EXT</span>' : ''}
            <button onclick="toggleEmployeeFilter('${escapeHtml(e).replace(/'/g,"&#39;")}');event.stopPropagation()" style="background:rgba(255,255,255,0.3);border:none;color:inherit;width:16px;height:16px;border-radius:50%;cursor:pointer;font-weight:900;font-size:10px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center">×</button>
          </span>`;
        }).join("")}
      </div>
    ` : ''}
  </div>`;
}

// Project / Location global filter setters
window.setGlobalProjectFilter = function(v){ state.globalProjectFilter = v||""; renderApp(); };
window.setGlobalLocationFilter = function(v){ state.globalLocationFilter = v||""; renderApp(); };
window.setGlobalBranchFilter = function(v){ state.globalBranchFilter = v||""; renderApp(); };
window.setGlobalEmpDeptFilter = function(v){ state.globalEmpDeptFilter = v||""; renderApp(); };
window.setGlobalTaskDeptFilter = function(v){ state.globalTaskDeptFilter = v||""; renderApp(); };
window.setGlobalWorkTypeFilter = function(v){ state.globalWorkTypeFilter = v||""; renderApp(); };
window.setGlobalTaskStatusFilter = function(v){ state.globalTaskStatusFilter = v||""; renderApp(); };
window.setGlobalCategoryFilter = function(v){ state.globalCategoryFilter = v||""; state.globalSubcategoryFilter = ""; renderApp(); };  // reset subcat when category changes
window.setGlobalSubcategoryFilter = function(v){ state.globalSubcategoryFilter = v||""; renderApp(); };
window.clearAllReportFilters = function(){
  state.globalEmployeeFilter = [];
  state.globalProjectFilter = "";
  state.globalLocationFilter = "";
  state.globalBranchFilter = "";
  state.globalEmpDeptFilter = "";
  state.globalTaskDeptFilter = "";
  state.globalWorkTypeFilter = "";
  state.globalTaskStatusFilter = "";
  state.globalCategoryFilter = "";
  state.globalSubcategoryFilter = "";
  renderApp();
  toast("All report filters cleared");
};

// Open a modal to select/deselect employees
function openEmployeeFilterModal(){
  const emps = allEmployees();
  if(emps.length === 0){
    toast("No employees available");
    return;
  }
  const sel = state.globalEmployeeFilter || [];
  // Sort: internal first, external last
  const sorted = emps.slice().sort((a, b) => {
    const ae = isExternalEmployee(a), be = isExternalEmployee(b);
    if(ae !== be) return ae ? 1 : -1;
    return a.localeCompare(b);
  });
  const overlay = document.createElement('div');
  overlay.id = "empFilterOverlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,35,71,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:white;border-radius:14px;max-width:560px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.4)">
      <div style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;padding:16px 20px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11px;letter-spacing:2px;color:#C9A84C;font-weight:700">FILTER</div>
          <div style="font-size:17px;font-weight:700;margin-top:2px">Select Employees</div>
        </div>
        <button onclick="document.getElementById('empFilterOverlay').remove()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;font-weight:700">×</button>
      </div>
      <div style="padding:14px 20px;background:#F7FAFC;border-bottom:1px solid #E0E6ED;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:#2E5FA3;color:white;border:none;font-weight:700" onclick="filterSelectAll()">✓ Select All (${emps.length})</button>
        <button class="btn btn-sm" style="background:white;border:1px solid #2E5FA3;color:#2E5FA3;font-weight:700" onclick="filterSelectInternal()">👤 Internal Only</button>
        <button class="btn btn-sm" style="background:white;border:1px solid #FF9800;color:#7F4A00;font-weight:700" onclick="filterSelectExternal()">[EXT] External Only</button>
        <button class="btn btn-sm" style="background:white;border:1px solid #C53030;color:#C53030;font-weight:700" onclick="filterClearAll()">✕ Clear</button>
      </div>
      <div id="empFilterList" style="flex:1;overflow-y:auto;padding:10px 16px;max-height:400px">
        ${sorted.map(e => {
          const isExt = isExternalEmployee(e);
          const checked = sel.length === 0 ? false : sel.includes(e);
          return `<label style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid ${checked?'#2E5FA3':'#E0E6ED'};border-radius:8px;background:${checked?'#F0F4FA':'white'};cursor:pointer;margin-bottom:6px;transition:all 0.15s" onclick="event.stopPropagation()">
            <input type="checkbox" ${checked?'checked':''} onchange="toggleEmployeeFilter('${escapeHtml(e).replace(/'/g,"&#39;")}',true)" style="width:18px;height:18px;cursor:pointer;accent-color:#2E5FA3">
            <span style="flex:1;font-size:13px;font-weight:600;color:#1A202C">${escapeHtml(e)}</span>
            ${isExt ? '<span style="background:linear-gradient(135deg,#FF9800 0%,#FFB74D 100%);color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800;letter-spacing:0.5px">EXT</span>' : '<span style="background:#E8F5E9;color:#2F855A;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:0.5px">INTERNAL</span>'}
          </label>`;
        }).join("")}
      </div>
      <div style="padding:14px 20px;border-top:1px solid #E0E6ED;display:flex;justify-content:space-between;align-items:center;background:#F7FAFC;border-radius:0 0 14px 14px">
        <div id="empFilterCount" style="font-size:12px;color:#4A5568;font-weight:600">${sel.length === 0 ? 'All employees (no filter)' : sel.length + ' employee(s) selected'}</div>
        <button class="btn btn-primary" style="background:#1B3A6B;color:white;font-weight:700" onclick="applyEmployeeFilterModal()">✓ Apply Filter</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function toggleEmployeeFilter(name, fromModal){
  const sel = state.globalEmployeeFilter || [];
  const idx = sel.indexOf(name);
  if(idx >= 0) sel.splice(idx, 1);
  else sel.push(name);
  state.globalEmployeeFilter = sel;
  if(fromModal){
    // Update count in modal without closing it
    const cnt = document.getElementById('empFilterCount');
    if(cnt) cnt.textContent = sel.length === 0 ? 'All employees (no filter)' : sel.length + ' employee(s) selected';
  } else {
    render();
  }
}

function filterSelectAll(){
  state.globalEmployeeFilter = [];  // empty = all
  document.getElementById('empFilterOverlay').remove();
  render();
  toast("All employees shown");
}

function filterSelectInternal(){
  const emps = allEmployees();
  state.globalEmployeeFilter = emps.filter(e => !isExternalEmployee(e));
  document.getElementById('empFilterOverlay').remove();
  render();
  toast(`Internal only: ${state.globalEmployeeFilter.length} employees`);
}

function filterSelectExternal(){
  const emps = allEmployees();
  state.globalEmployeeFilter = emps.filter(e => isExternalEmployee(e));
  if(state.globalEmployeeFilter.length === 0){
    toast("No external employees to filter");
    state.globalEmployeeFilter = [];
    document.getElementById('empFilterOverlay').remove();
    return;
  }
  document.getElementById('empFilterOverlay').remove();
  render();
  toast(`External only: ${state.globalEmployeeFilter.length} employees`);
}

function filterClearAll(){
  state.globalEmployeeFilter = [];
  const inputs = document.querySelectorAll('#empFilterList input[type=checkbox]');
  inputs.forEach(i => i.checked = false);
  const cnt = document.getElementById('empFilterCount');
  if(cnt) cnt.textContent = 'All employees (no filter)';
}

function applyEmployeeFilterModal(){
  document.getElementById('empFilterOverlay').remove();
  render();
  const cnt = (state.globalEmployeeFilter || []).length;
  toast(cnt === 0 ? "Filter cleared — showing all" : `Filter applied: ${cnt} employee(s)`);
}

function clearEmployeeFilter(){
  state.globalEmployeeFilter = [];
  render();
  toast("Filter cleared");
}

Object.assign(window, {
  openEmployeeFilterModal, toggleEmployeeFilter, filterSelectAll, filterSelectInternal,
  filterSelectExternal, filterClearAll, applyEmployeeFilterModal, clearEmployeeFilter
});

// ═══════════════════════════════════════════════════════════════════════
//  FIREBASE INIT & AUTH
// ═══════════════════════════════════════════════════════════════════════
window.addEventListener('fb-ready',()=>{
  if(!window.__fb.isConfigured){showSetupNeeded();return;}
  // ── Public live-share mode: ?share=TOKEN opens a read-only client view
  //    with NO login. It can only read publicShares/{token} — a curated
  //    snapshot document — never the internal collections.
  const _tok=new URLSearchParams(location.search).get("share");
  if(_tok){ enterShareView(_tok); return; }
  watchAuth();
});

function enterShareView(token){
  window._shareMode=true;   // public page: suppress staff-only toasts/timers
  const{db,doc,onSnapshot}=window.__fb;
  document.title="EJAF · Live Project View";
  renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center"><div style="font-size:34px">📡</div><div class="sub" style="margin-top:10px">Loading live view…</div></div></div>`);
  try{
    onSnapshot(doc(db,"publicShares",token),(snap)=>{
      if(!snap.exists()){ _shareGone(); return; }
      const d=snap.data();
      if(d.revoked || (d.expires && today()>d.expires)){ _shareGone(); return; }
      renderShareView(d);
    },(err)=>{ console.error(err); _shareGone(); });
  }catch(e){ _shareGone(); }
}
function _shareGone(){
  renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center">
    <div style="font-size:40px">🔗</div>
    <h2 style="color:#C53030;margin-top:10px">Link unavailable</h2>
    <div class="sub" style="margin-top:8px">This share link has expired or been revoked.<br>Please ask EJAF Technology for a new one.</div>
  </div></div>`);
}
function renderShareView(d){
  const P=d.projects||[];
  const fmtD=(x)=>x?new Date(x).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—";
  const stC={};["Open","#C62828","In Progress","#E65100","new","#C62828","done","#2E7D32","Resolved","#2E7D32","Closed","#5B6C86"].forEach((v,i,a)=>{if(i%2===0)stC[v]=a[i+1];});
  renderRoot(`
  <div style="min-height:100vh;background:linear-gradient(160deg,#0E1E3C 0%,#1B3A6B 100%);padding:0 0 40px">
    <div style="background:rgba(255,255,255,.06);backdrop-filter:blur(8px);border-bottom:1px solid rgba(201,168,76,.35);padding:14px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:5">
      <div style="width:40px;height:40px;border-radius:10px;background:#03308B;display:flex;align-items:center;justify-content:center;color:#C9A84C;font-weight:900;font-size:13px;border:1.5px solid #C9A84C">EJAF</div>
      <div style="flex:1">
        <div style="color:#fff;font-family:'DM Serif Display',serif;font-size:17px">${escapeHtml(d.clientName||"Client")} — Live Project View</div>
        <div style="color:#9FB6D2;font-size:10.5px">EJAF Technology · Girêk Operations</div>
      </div>
      <div style="text-align:right">
        <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(46,125,50,.25);color:#A5D6A7;font-size:10px;font-weight:800;padding:3px 10px;border-radius:12px;border:1px solid rgba(165,214,167,.4)"><span style="width:7px;height:7px;border-radius:50%;background:#66BB6A;display:inline-block;animation:cfade 1.2s ease-in-out infinite alternate"></span>LIVE</span>
        <div style="color:#9FB6D2;font-size:9.5px;margin-top:3px">Updated ${escapeHtml(d.updatedLabel||"")}</div>
      </div>
    </div>
    <div style="max-width:680px;margin:0 auto;padding:16px">
      ${P.length===0?`<div style="background:#fff;border-radius:14px;padding:30px;text-align:center;color:#888">No projects shared yet.</div>`:P.map(p=>`
      <div style="background:#fff;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.25);margin-bottom:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="color:#fff;font-family:'DM Serif Display',serif;font-size:18px">${escapeHtml(p.name)}</div>
          ${p.status?`<span style="background:rgba(201,168,76,.25);color:#F0D68A;font-size:10px;font-weight:800;padding:3px 10px;border-radius:12px">${escapeHtml(p.status)}</span>`:""}
        </div>
        <div style="padding:14px 16px">
          ${p.estHours?`
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;font-weight:700;margin-bottom:5px"><span>PROGRESS — WORKED HOURS</span><span>${p.hours} / ${p.estHours} h (${p.pct}%)</span></div>
          <div style="height:9px;background:#E8EDF5;border-radius:6px;overflow:hidden;margin-bottom:14px"><div style="height:100%;width:${Math.min(100,p.pct)}%;background:linear-gradient(90deg,#C9A84C,#E9CC7A);border-radius:6px"></div></div>`
          :`<div style="font-size:12px;color:#555;margin-bottom:12px">⏱ <strong>${p.hours}</strong> work hours logged · <strong>${p.sessions}</strong> field sessions</div>`}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <div style="flex:1;min-width:90px;background:#F5F8FC;border-radius:9px;padding:9px;text-align:center"><div style="font-family:'DM Serif Display',serif;font-size:19px;color:#1B3A6B">${p.devices}</div><div style="font-size:9px;color:#888;font-weight:700;text-transform:uppercase">Devices</div></div>
            <div style="flex:1;min-width:90px;background:#F5F8FC;border-radius:9px;padding:9px;text-align:center"><div style="font-family:'DM Serif Display',serif;font-size:19px;color:#2E7D32">${p.pmDone}</div><div style="font-size:9px;color:#888;font-weight:700;text-transform:uppercase">PM rounds done</div></div>
            <div style="flex:1;min-width:90px;background:#F5F8FC;border-radius:9px;padding:9px;text-align:center"><div style="font-family:'DM Serif Display',serif;font-size:19px;color:${p.openReq?'#E65100':'#5B6C86'}">${p.openReq}</div><div style="font-size:9px;color:#888;font-weight:700;text-transform:uppercase">Open requests</div></div>
          </div>
          ${(p.locations||[]).length?(()=>{const mx=Math.max(...p.locations.map(l=>l.hours),0.1);return `
          <div style="font-size:10.5px;color:#888;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin:2px 0 7px">Work hours by location</div>
          ${p.locations.map(l=>`<div style="display:flex;align-items:center;gap:9px;margin-bottom:6px">
            <div style="width:112px;font-size:11.5px;color:#333;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${escapeHtml(l.name)}</div>
            <div style="flex:1;height:8px;background:#E8EDF5;border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.max(4,Math.round(l.hours/mx*100))}%;background:linear-gradient(90deg,#2E5FA3,#5E9BFF);border-radius:5px"></div></div>
            <div style="width:58px;text-align:right;font-size:11px;color:#1B3A6B;font-weight:800">${l.hours} h</div>
          </div>`).join("")}
          <div style="margin-bottom:12px"></div>`;})():""}
          ${(p.sites||[]).length?`
          <div style="font-size:10.5px;color:#888;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Field sites</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
            ${p.sites.map(s=>`<span style="background:#F0F4FF;color:#03308B;border:1px solid #D6E0F5;font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:12px">${escapeHtml([s.area,s.site].filter(Boolean).join(" › "))} · ${s.devices} dev</span>`).join("")}
          </div>`:""}
          ${(p.workItems||[]).length?`
          <div style="font-size:10.5px;color:#888;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Work items${p.openJobs?` — ${p.openJobs} open`:""}</div>
          ${p.workItems.map(w=>`<div style="border:1px solid #EDF1F7;border-radius:9px;padding:9px 11px;margin-bottom:7px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:12.5px;font-weight:700;color:#1B3A6B">${escapeHtml(w.title)}${w.scope?` <span style="font-weight:500;color:#8A9AB0">· ${escapeHtml(w.scope)}</span>`:""}</span>
              <span style="font-size:9.5px;background:${w.closed?'#E8F5E9':'#FFF3E0'};color:${w.closed?'#2E7D32':'#E65100'};padding:2px 9px;border-radius:9px;font-weight:800">${escapeHtml(w.status)}</span>
            </div>
            ${(w.journey||[]).length>1?`<div style="margin-top:6px;display:flex;align-items:center;flex-wrap:wrap">
              ${w.journey.map((j,i)=>`${i?`<span style="color:#C4D0E0;margin:0 4px;font-size:10px">→</span>`:""}<span style="font-size:10px;color:#5A6B80;background:#F5F8FC;padding:2px 7px;border-radius:7px">${escapeHtml(j.s)} <span style="color:#9AAABF">${fmtD(j.d)}</span></span>`).join("")}
            </div>`:""}
            <div style="margin-top:5px;font-size:10px;color:#9AAABF">${w.visits} visit${w.visits>1?"s":""} · ${fmtD(w.first)}${w.visits>1?` → ${fmtD(w.last)}`:""}</div>
          </div>`).join("")}
          <div style="margin-bottom:10px"></div>`:""}
          ${(p.recent||[]).length?`
          <div style="font-size:10.5px;color:#888;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Latest activity</div>
          ${p.recent.map(r=>`<div style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-top:1px solid #F0F2F7">
            <div style="font-size:10px;color:#999;white-space:nowrap;padding-top:2px">${fmtD(r.date)}</div>
            <div style="flex:1;font-size:12px;color:#333">${escapeHtml(r.text)}</div>
            ${r.status?`<span style="font-size:9px;font-weight:800;color:${stC[r.status]||'#888'};background:${(stC[r.status]||'#888')}18;padding:2px 8px;border-radius:8px;white-space:nowrap">${escapeHtml(r.status)}</span>`:""}
          </div>`).join("")}`:""}
        </div>
      </div>`).join("")}
      <div style="text-align:center;color:#9FB6D2;font-size:10px;margin-top:20px;line-height:1.7">Read-only live view · Powered by <strong style="color:#C9A84C">EJAF Technology — Girêk</strong><br><span style="font-style:italic">Powered by Siwar</span></div>
    </div>
  </div>`);
}
Object.assign(window,{enterShareView,renderShareView});

// ═══════════════════════════════════════════════════════════════════════
//  SINGLE-DEVICE SESSION LOCK
//  Each device has a persistent deviceId. On login, we claim the user's
//  active session. If another device already holds it (and the user isn't
//  admin and doesn't have multi-device permission), the new login is blocked.
// ═══════════════════════════════════════════════════════════════════════
function getDeviceId(){
  let id = localStorage.getItem("odt_device_id");
  if(!id){
    id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,10);
    localStorage.setItem("odt_device_id", id);
  }
  return id;
}
function getDeviceLabel(){
  const ua = navigator.userAgent || "";
  let device = "Device";
  if(/iPhone|iPad|iPod/i.test(ua)) device = "iPhone/iPad";
  else if(/Android/i.test(ua)) device = "Android";
  else if(/Windows/i.test(ua)) device = "Windows PC";
  else if(/Macintosh/i.test(ua)) device = "Mac";
  else if(/Linux/i.test(ua)) device = "Linux";
  let browser = "";
  if(/Edg/i.test(ua)) browser = "Edge";
  else if(/Chrome/i.test(ua)) browser = "Chrome";
  else if(/Firefox/i.test(ua)) browser = "Firefox";
  else if(/Safari/i.test(ua)) browser = "Safari";
  return browser ? device + " · " + browser : device;
}

// Try to claim the session for this device. Returns {ok:true} or {ok:false, reason, heldBy}.
async function claimSession(profile){
  const {db, doc, getDoc, setDoc} = window.__fb;
  const deviceId = getDeviceId();
  // Admins and multi-device users bypass the lock entirely
  const role = (profile.role||"").toLowerCase();
  const isAdminRole = role === "admin" || role === "owner";
  const multiAllowed = profile.allowMultiDevice === true;
  if(isAdminRole || multiAllowed){
    // Still record this device (informational), but never block
    try{
      await setDoc(doc(db,"users",profile.uid),{
        activeSession: deviceId,
        activeSessionLabel: getDeviceLabel(),
        activeSessionAt: new Date().toISOString(),
      },{merge:true});
    }catch(e){}
    return {ok:true};
  }
  // Single-device users: check current holder
  try{
    const snap = await getDoc(doc(db,"users",profile.uid));
    const data = snap.exists() ? snap.data() : {};
    const current = data.activeSession || "";
    if(current && current !== deviceId){
      // Another device holds the session → block this one
      return {ok:false, reason:"elsewhere", heldBy: data.activeSessionLabel || "another device", since: data.activeSessionAt};
    }
    // Claim it
    await setDoc(doc(db,"users",profile.uid),{
      activeSession: deviceId,
      activeSessionLabel: getDeviceLabel(),
      activeSessionAt: new Date().toISOString(),
    },{merge:true});
    return {ok:true};
  }catch(e){
    console.error("claimSession error:", e);
    return {ok:true}; // fail-open: don't lock people out on errors
  }
}

// Release this device's claim on sign-out (only if we currently hold it)
async function releaseSession(){
  try{
    const {db, doc, getDoc, updateDoc} = window.__fb;
    if(!state.profile) return;
    const deviceId = getDeviceId();
    const snap = await getDoc(doc(db,"users",state.profile.uid));
    if(snap.exists() && snap.data().activeSession === deviceId){
      await updateDoc(doc(db,"users",state.profile.uid),{ activeSession: "" });
    }
  }catch(e){}
}

// Watch the user doc; if another device takes over the session, force logout here.
// (Used when admin resets a session, or for the rare race condition.)
function watchSessionLock(){
  try{
    const {db, doc, onSnapshot} = window.__fb;
    if(!state.profile) return;
    const role = (state.profile.role||"").toLowerCase();
    if(role==="admin"||role==="owner"||state.profile.allowMultiDevice===true) return; // exempt
    const deviceId = getDeviceId();
    if(state._sessionUnsub){ try{state._sessionUnsub();}catch(e){} }
    state._sessionUnsub = onSnapshot(doc(db,"users",state.profile.uid),(snap)=>{
      if(!snap.exists()) return;
      const active = snap.data().activeSession || "";
      if(active && active !== deviceId){
        // Someone else claimed the session → log this device out
        if(state._sessionUnsub){ try{state._sessionUnsub();}catch(e){} state._sessionUnsub=null; }
        forceLogoutElsewhere(snap.data().activeSessionLabel || "another device");
      }
    });
  }catch(e){}
}

async function forceLogoutElsewhere(label){
  try{
    const {auth, signOut} = window.__fb;
    cleanupSubs();
    await signOut(auth);
  }catch(e){}
  renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center">
    <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:18px"></div>
    <div style="font-size:40px;margin:14px 0">🔒</div>
    <h2 style="color:#C53030">Signed Out</h2>
    <div class="sub" style="margin-top:8px">Your account was opened on another device.</div>
    <button class="login-btn" onclick="location.reload()" style="margin-top:18px">Sign In Again</button>
  </div></div>`);
}

function watchAuth(){
  const{auth,onAuthStateChanged}=window.__fb;
  onAuthStateChanged(auth,async(user)=>{
    if(user){
      state.user=user;
      await loadProfile();
      if(state.profile){
        // ── Single-device session lock ──
        const claim = await claimSession(state.profile);
        if(!claim.ok){
          // Another device holds the session → block this login
          const {auth:a, signOut} = window.__fb;
          try{ await signOut(a); }catch(e){}
          renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center">
            <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:18px"></div>
            <div style="font-size:40px;margin:14px 0">🔒</div>
            <h2 style="color:#C53030">Active on Another Device</h2>
            <div class="sub" style="margin-top:8px">Sign out there first, then try again.</div>
            <button class="login-btn" onclick="location.reload()" style="margin-top:18px">Try Again</button>
          </div></div>`);
          return;
        }
        await subscribeData();
        watchSessionLock();
      } else {
        const uid = state.user.uid;
        const email = state.user.email;
        renderRoot(`<div class="login-bg"><div class="login-card">
          <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:18px"></div>
          <h2>Account Not Configured</h2>
          <div class="sub">Your account exists but no profile found.</div>
          <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:12px;margin-top:14px;font-size:11px;text-align:left;font-family:monospace;color:#5D4037;word-break:break-all">
            <div style="font-weight:700;color:#1B3A6B;margin-bottom:6px">🔍 Diagnostic Info:</div>
            <div><strong>Email:</strong> ${email}</div>
            <div style="margin-top:6px"><strong>Your User UID:</strong></div>
            <div style="background:white;padding:6px;border-radius:4px;margin-top:4px;user-select:all">${uid}</div>
            <div style="margin-top:8px;color:#7F6000">⚠ Firestore must have a document at:<br><code>users/${uid}</code></div>
          </div>
          <button class="login-btn" onclick="navigator.clipboard?.writeText('${uid}');toast('UID copied!')" style="margin-top:12px">📋 Copy UID</button>
          <button class="login-btn" onclick="doSignOut()" style="margin-top:8px;background:transparent;color:var(--navy);border:2px solid var(--navy)">Sign Out</button>
        </div></div>`);
      }
    } else {
      state.user=null; state.profile=null;
      cleanupSubs();
      renderLogin();
    }
  });
}

async function loadProfile(){
  try{
    const{db,doc,getDoc}=window.__fb;
    const snap=await getDoc(doc(db,"users",state.user.uid));
    if(snap.exists()){
      state.profile={uid:state.user.uid,...snap.data()};
    } else {
      state.profile=null;
    }
  } catch(e){
    console.error("Load profile error:",e);
    state.profile=null;
  }
  // One-time cleanup: remove OLD shared (non-per-user) date-range keys so a
  // previously-set global filter can't leak between accounts on this device.
  try{
    localStorage.removeItem("opt_period_from");
    localStorage.removeItem("opt_period_to");
  }catch(e){}
}

function cleanupSubs(){
  state.unsubs.forEach(u=>{try{u();}catch(e){}});
  state.unsubs=[];
}

async function subscribeData(){
  cleanupSubs();
  const{db,collection,onSnapshot,doc}=window.__fb;
  state.initialized=false;
  renderRoot(`<div class="skel-page"><div class="skel-header"></div><div class="skel-body"><div class="skel skel-bar"></div><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card tall"></div></div></div>`);

  const subs=[
    ["daily","daily"],["overtime","overtime"],["travel","travel"],["leaves","leaves"],
    ["projects","projects"],["locations","locations"],["users","users"],
    ["departments","departments"],
    ["branches","branches"],
    ["techWorkTypes","techWorkTypes"],
    ["requestStatuses","requestStatuses"],
    ["projectStatuses","projectStatuses"],
    ["techStatuses","techStatuses"],
    ["techCategories","techCategories"],
    ["devices","devices"],
    ["pmSchedules","pmSchedules"],
    ["workCategories","workCategories"],["workTasks","workTasks"],
    ["nametagEmployees","nametagEmployees"],
    ["employeePermissions","employeePermissions"],
    ["clientPermissions","clientPermissions"],
    ["deviceEditSuggestions","deviceEditSuggestions"],
    ["clients","clients"],
    ["clientRequests","clientRequests"],
    ["tasks","tasks"],
    ["notifications","notifications"],
    ["waContacts","waContacts"],
    ["emailContacts","emailContacts"],
    ["settings","settingsDocs"],
    ["systemTypes","systemTypes"],
    ["systemChecks","systemChecks"],
    ["incidents","incidents"],
    ["publicShares","publicSharesMeta"],
    ["trash","trash"],
  ];
  let firstCount=0;

  // Safety net: if collections haven't all loaded within 8 seconds (e.g. a missing
  // Firestore rule blocks one), show the app anyway so it never freezes on loading.
  setTimeout(()=>{
    if(!state.initialized){
      console.warn("Init timeout — showing app with partial data");
      state.initialized=true;
      renderApp();
    }
  }, 8000);

  subs.forEach(([col,key])=>{
    const unsub=onSnapshot(collection(db,col),async(snap)=>{
      const items=[];
      snap.forEach(d=>items.push({id:d.id,...d.data()}));
      if(col==="notifications"){ try{ _sysNotifyNew(items); }catch(e){} }
      if(col==="trash"){ try{ setTimeout(()=>{ if(typeof window._trashAutoPurge==="function") window._trashAutoPurge(); },1200); }catch(e){} }
      if(["daily","overtime","travel"].includes(col)){
        items.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      } else if(col==="users"){
        items.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
      } else if(col==="workTasks"){
        items.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
      } else {
        items.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
      }
      state[key]=items;
      if(col==="notifications") updateNotifBell();
      if(col==="users" && state.user){ const me=items.find(x=>x.id===state.user.uid); if(me) state.profile={uid:state.user.uid,...me}; }

      // Seed defaults on first run (admin only, if projects empty)
      if(col==="projects" && items.length===0 && isAdmin() && !state._seeded){
        state._seeded=true;
        await seedDefaults();
      }

      firstCount++;
      if(firstCount>=subs.length && !state.initialized){
        state.initialized=true;
        renderApp();
      } else if(state.initialized){
        scheduleRender();
      }
    },(err)=>{
      console.error(`${col} sync error:`,err);
      toast(`Sync error: ${col}`);
      // IMPORTANT: still count this collection so the app doesn't freeze on the
      // loading screen if one collection fails (e.g. missing Firestore rule).
      firstCount++;
      if(firstCount>=subs.length && !state.initialized){
        state.initialized=true;
        renderApp();
      }
    });
    state.unsubs.push(unsub);
  });

  // WhatsApp settings (single doc)
  const waUnsub = onSnapshot(doc(db,"settings","whatsapp"),(snap)=>{
    state.waSettings = snap.exists() ? snap.data() : {
      enabledFields: ["employee","date","time","project","location","duration","resolutionText"],
      allowedRoles: ["admin"],
      triggers: ["daily","clientRequests"],
      messageHeader: "🔔 New Task — EJAF Operations",
    };
    if(state.initialized) renderTab();
  });
  state.unsubs.push(waUnsub);

  // Email settings (single doc)
  const emailUnsub = onSnapshot(doc(db,"settings","email"),(snap)=>{
    state.emailSettings = snap.exists() ? snap.data() : {
      enabled: false,
      serviceId: "", templateId: "", publicKey: "",
      enabledFields: ["employee","date","time","project","location","duration","resolutionText"],
      allowedRoles: ["admin"],
      triggers: ["daily","clientRequests"],
      subject: "New Task — EJAF Operations",
      autoSend: true, includeEmployees: false, includeClients: false, requestRecipients: [],
    };
    if(state.initialized) renderTab();
  });
  state.unsubs.push(emailUnsub);

  // Scheduled reports config
  const schedUnsub = onSnapshot(doc(db,"settings","scheduledReports"),(snap)=>{
    state.scheduledReports = snap.exists() ? snap.data() : {
      enabled: false,
      fromDate: "", toDate: "",
      sendTime: "23:30",
      sendDay: "1",
      recipients: [],
      subject: "EJAF Operations — Periodic Reports",
      message: "Please find attached the operations reports for the specified period.",
      reports: ["daily","hr","dashboard"],
      lastSent: "",
    };
    if(state.initialized) renderTab();
  });
  state.unsubs.push(schedUnsub);

  // Technical Report column selection (admin-controlled, shared)
  const techRepUnsub = onSnapshot(doc(db,"settings","techReport"),(snap)=>{
    state.techReportCols = snap.exists() ? (snap.data().columns || null) : null;
    if(state.initialized) renderTab();
  });
  state.unsubs.push(techRepUnsub);
}

async function seedDefaults(){
  const{db,doc,setDoc}=window.__fb;
  try{
    // Seed default departments
    const DEFAULT_DEPTS = [
      {id:"enterprise", name:"Enterprise", color:"#2E7D32"},
      {id:"security", name:"Security", color:"#E65100"},
      {id:"ejaf", name:"Ejaf", color:"#6A1B9A"},
    ];
    for(const d of DEFAULT_DEPTS){
      await setDoc(doc(db,"departments",d.id),{name:d.name,color:d.color});
    }
    // Seed default branch (Erbil)
    await setDoc(doc(db,"branches","erbil"),{name:"Erbil"});
    // Seed technical classification defaults (Work Types, Statuses, Categories)
    for(let i=0;i<WORK_TYPES.length;i++){
      await setDoc(doc(db,"techWorkTypes","wt_"+i),{name:WORK_TYPES[i], order:i});
    }
    for(let i=0;i<TASK_STATUSES.length;i++){
      await setDoc(doc(db,"techStatuses","ts_"+i),{name:TASK_STATUSES[i], order:i});
    }
    let ci=0;
    for(const cat of Object.keys(TASK_CATEGORIES)){
      await setDoc(doc(db,"techCategories","tc_"+ci),{name:cat, subcategories:TASK_CATEGORIES[cat], order:ci});
      ci++;
    }
    for(const p of DEFAULT_PROJECTS){
      await setDoc(doc(db,"projects",p.id),{name:p.name,dept:p.dept});
    }
    for(const l of DEFAULT_LOCATIONS){
      await setDoc(doc(db,"locations",l.id),{name:l.name});
    }
    // Seed default work categories
    const DEFAULT_WORK_CATEGORIES = [
      {id:"enterprise_wi", name:"Enterprise", color:"#2E7D32", icon:"🏢"},
      {id:"security_wi",   name:"Security",   color:"#E65100", icon:"🔒"},
    ];
    for(const wc of DEFAULT_WORK_CATEGORIES){
      await setDoc(doc(db,"workCategories",wc.id),{name:wc.name,color:wc.color,icon:wc.icon});
    }
    toast("Defaults loaded ✓");
  }catch(e){console.error(e);}
}

async function fbSave(col,item){
  try{
    const{db,doc,setDoc}=window.__fb;
    const id=item.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6));
    const data={...item};delete data.id;
    await setDoc(doc(db,col,id),data);
  }catch(e){console.error(e);toast("Save failed: "+e.message);}
}

async function fbDelete(col,id){
  try{
    const{db,doc,deleteDoc,getDoc,setDoc}=window.__fb;
    // ── Recycle Bin: every delete is recoverable for 30 days ──
    if(col!=="trash" && col!=="notifications"){
      try{
        const snap=await getDoc(doc(db,col,id));
        if(snap.exists()){
          await setDoc(doc(db,"trash", `${col}_${id}_${Date.now()}`),{
            origCol:col, origId:id, data:snap.data(),
            deletedAt:new Date().toISOString(),
            deletedBy:(state.profile&&state.profile.uid)||"",
            deletedByName:(state.profile&&(state.profile.name||state.profile.email))||"",
          });
        }
      }catch(e){ console.warn("trash copy failed",e); }
    }
    await deleteDoc(doc(db,col,id));
  }catch(e){console.error(e);toast("Delete failed");}
}

async function doSignIn(email,password){
  try{
    const{auth,signInWithEmailAndPassword}=window.__fb;
    await signInWithEmailAndPassword(auth,email,password);
  }catch(e){
    let msg="Sign in failed";
    if(e.code==="auth/invalid-credential"||e.code==="auth/wrong-password"||e.code==="auth/user-not-found")msg="Invalid email or password";
    if(e.code==="auth/invalid-email")msg="Invalid email format";
    if(e.code==="auth/network-request-failed")msg="Network error — check connection";
    return msg;
  }
  return null;
}

async function doSignOut(){
  try{
    const{auth,signOut}=window.__fb;
    await releaseSession();  // free this device's session claim
    if(state._sessionUnsub){ try{state._sessionUnsub();}catch(e){} state._sessionUnsub=null; }
    cleanupSubs();
    await signOut(auth);
  }catch(e){console.error(e);}
}
window.doSignOut=doSignOut;

// ═══════════════════════════════════════════════════════════════════════
//  RENDERING
// ═══════════════════════════════════════════════════════════════════════
function renderRoot(html){$("root").innerHTML=html;}

function showSetupNeeded(){
  renderRoot(`
    <div class="setup-needed">
      <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:18px"></div>
      <h2>Firebase Setup Required</h2>
      <p>Open <code>index.html</code> and replace the <code>firebaseConfig</code> block with your Firebase keys.<br><br>
      See <strong>FIREBASE_SETUP.md</strong> for the full step-by-step guide.</p>
    </div>
  `);
}

function renderLogin(){
  renderRoot(`
    <div class="login-bg">
      <div class="login-card">
        <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:18px"></div>
        <h2>Girêk</h2>
        <div class="sub">Sign In</div>
        <form id="loginForm" onsubmit="handleLogin(event)">
          <label>Email</label>
          <input type="email" id="loginEmail" required autocomplete="email">
          <label>Password</label>
          <input type="password" id="loginPass" required autocomplete="current-password">
          <button class="login-btn" type="submit" id="loginBtn">Sign In</button>
          <div style="text-align:center;margin-top:14px">
            <a href="#" onclick="showForgotPassword(event)" style="color:#C9A84C;font-size:13px;text-decoration:none;font-weight:600">🔑 Forgot Password?</a>
          </div>
          <div id="loginErr"></div>
        </form>
      </div>
    </div>
  `);
}

window.showForgotPassword = function(e){
  if(e) e.preventDefault();
  const email = prompt("Enter your email address:\n\nWe'll send you a password reset link.");
  if(!email) return;
  if(!email.includes('@')) { alert("Please enter a valid email address."); return; }
  sendResetEmail(email);
};

async function sendResetEmail(email){
  try {
    const { auth, sendPasswordResetEmail } = window.__fb;
    await sendPasswordResetEmail(auth, email.trim());
    alert(`✓ Password reset email sent!\n\nCheck your inbox at: ${email}\n\nIf you don't see it, check your Spam folder.`);
  } catch(e) {
    console.error(e);
    let msg = "Failed to send reset email";
    if(e.code === "auth/user-not-found") msg = "No account found with this email";
    if(e.code === "auth/invalid-email") msg = "Invalid email address";
    if(e.code === "auth/too-many-requests") msg = "Too many attempts. Try again later.";
    alert("❌ " + msg);
  }
}
window.sendResetEmail = sendResetEmail;

window.handleLogin=async function(e){
  e.preventDefault();
  const btn=$("loginBtn");
  const err=$("loginErr");
  err.innerHTML="";
  btn.disabled=true;btn.textContent="Signing in...";
  const msg=await doSignIn($("loginEmail").value.trim(),$("loginPass").value);
  if(msg){
    err.innerHTML=`<div class="login-err">${msg}</div>`;
    btn.disabled=false;btn.textContent="Sign In";
  }
};

function renderApp(){
  const role=state.profile.role||"employee";
  const roleBadge=role.toUpperCase();
  const tabs=getTabs();

  renderRoot(`
    <header class="app-header">
      <div class="header-row">
        <div class="logo-mark"><img src="data:image/png;base64,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" alt="EJAF" style="width:100%;height:100%;object-fit:cover;border-radius:8px"></div>
        <div class="app-title">
          <h1>Girêk</h1>
          ${state.tab==="Dashboard"?"":`<p><span id="periodLabelInline" onclick="editPeriod(event)" style="cursor:pointer;white-space:nowrap;display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom;font-size:10.5px;${(getPeriodFrom()||getPeriodTo())?'background:#C9A84C;color:#03308B;padding:2px 10px;border-radius:12px;font-weight:700':'text-decoration:underline dotted;opacity:0.9'}">${(getPeriodFrom()||getPeriodTo())?'📅 ':''}${escapeHtml(shortPeriod())}${(getPeriodFrom()||getPeriodTo())?' ✕':''}</span></p>`}
        </div>
        <span id="netDot" title="You are offline — changes will sync when back online" style="display:${(typeof navigator!=='undefined'&&navigator.onLine===false)?'inline-flex':'none'};align-items:center;gap:5px;background:#7A1F1F;color:#FFD9D9;font-size:10px;font-weight:800;padding:4px 9px;border-radius:12px;margin-right:4px">📴 OFFLINE</span><button id="themeBtn" onclick="toggleTheme()" title="Light / Dark mode" style="background:rgba(255,255,255,0.14);border:none;border-radius:8px;width:32px;height:32px;font-size:15px;cursor:pointer;margin-right:2px;line-height:1">${document.documentElement.getAttribute('data-theme')==='dark'?ICON_SUN:ICON_MOON}</button><span id="notifBell" onclick="openNotifPanel()" style="position:relative;cursor:pointer;font-size:20px;padding:4px 6px;margin-right:2px;user-select:none" class="bell-btn ${bellCount()>0?'ring':''}">${ICON_BELL}<span id="notifBellBadge" style="position:absolute;top:0;right:-2px;background:#C62828;color:#fff;font-size:9px;font-weight:800;min-width:15px;height:15px;border-radius:8px;display:${bellCount()>0?'flex':'none'};align-items:center;justify-content:center;padding:0 3px">${bellCount()>99?'99+':bellCount()}</span></span>
        <button onclick="switchTab('Profile')" title="My Profile" style="width:40px;height:40px;border-radius:50%;padding:0;border:2px solid var(--gold);background:var(--navy);color:var(--gold);font-weight:800;font-size:15px;cursor:pointer;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${(state.profile&&state.profile.photoData)?`<img src="${state.profile.photoData}" alt="" style="width:100%;height:100%;object-fit:cover">`:escapeHtml(((state.profile&&(state.profile.name||state.profile.employeeName||state.profile.email))||"?").charAt(0).toUpperCase())}</button>
      </div>
      ${(()=>{
        const groups = getVisibleGroups();
        if(!groups){
          // Client portal: keep the simple flat bar
          return `<nav class="tab-bar" id="tabBar">${tabs.map(t=>{
            const nReq = tabBadgeCount(t);
            return `<button class="tab ${t===state.tab?"active":""}" data-tab="${t}" onclick="switchTab('${t}')" style="position:relative">${t}${nReq?`<span style="position:absolute;top:2px;right:2px;background:#C62828;color:white;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px">${nReq}</span>`:""}</button>`;
          }).join("")}<span class="tab-indicator" id="tabIndicator"></span></nav>`;
        }
        const activeGroup = groupOfTab(state.tab);
        const curGroup = groups.find(g=>g.id===activeGroup) || groups[0];
        // Pending-request badge shows on the group that contains Requests
        const groupReqCount = (g)=> g.children.reduce((s,c)=>s+tabBadgeCount(c),0);
        // MAIN bar (groups) + SUB bar (children of active group)
        return `
        <nav class="tab-bar group-bar" id="groupBar">${groups.map(g=>{
          const n = groupReqCount(g);
          const on = g.id===activeGroup;
          return `<button class="tab gtab ${on?"active":""}" data-group="${g.id}" onclick="switchGroup('${g.id}')" style="position:relative">${NAV_ICONS[g.id]||g.icon}<span class="gtab-lb">${g.label}</span>${n?`<span style="position:absolute;top:2px;right:2px;background:#C62828;color:white;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px">${n}</span>`:""}</button>`;
        }).join("")}<span class="tab-indicator" id="groupIndicator"></span></nav>
        ${curGroup.children.length>1?`<nav class="tab-bar sub-bar" id="tabBar">${curGroup.children.map(t=>{
          const nReq = tabBadgeCount(t);
          return `<button class="tab subtab ${t===state.tab?"active":""}" data-tab="${t}" onclick="switchTab('${t}')" style="position:relative">${t}${nReq?`<span style="position:absolute;top:2px;right:2px;background:#C62828;color:white;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px">${nReq}</span>`:""}</button>`;
        }).join("")}<span class="tab-indicator" id="tabIndicator"></span></nav>`:`<span class="tab-indicator" id="tabIndicator" style="display:none"></span>`}`;
      })()}
    </header>
    <main class="content" id="content"></main>
  `);
  renderTab();
  // Position the sliding gold indicators on initial render.
  // Double rAF + timeout fallback ensures layout is fully measured first.
  renderBottomNav();
  if(typeof refreshAlertBadge==="function") refreshAlertBadge();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ positionTabIndicator(); positionGroupIndicator(); }));
  setTimeout(()=>{ positionTabIndicator(); positionGroupIndicator(); }, 100);
  // Enable swipe navigation between tabs (mobile)
  setupSwipeNavigation();
}

// ═══════════════════════════════════════════════════════════════════════
//  GROUPED NAVIGATION — main groups (top bar) each contain sub-tabs (2nd bar)
// ═══════════════════════════════════════════════════════════════════════
const TAB_GROUPS = [
  { id:"Dashboard", label:"Dashboard", icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='currentColor' style='vertical-align:-2px'><path d='M4 20h3v-8H4v8zm6.5 0h3V4h-3v16zm6.5 0h3v-5h-3v5z'/></svg>", children:["Dashboard"] },
  { id:"Logs",      label:"Logs",      icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M12 20h9'/><path d='M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'/></svg>", children:["Daily Log","Overtime","Travel","Leaves","My Tasks"] },
  { id:"Reports",   label:"Reports",   icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><polyline points='3 17 9 11 13 15 21 7'/><polyline points='15 7 21 7 21 13'/></svg>", children:["HR Report","Daily Log Report","Reports","Technical Report","Analytics","Executive"] },
  { id:"Database",  label:"Database",  icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><ellipse cx='12' cy='5' rx='8' ry='3'/><path d='M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5'/><path d='M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'/></svg>", children:["Branches","Departments","Locations","Projects","Assets","Maintenance","Incidents"] },
  { id:"Clients",   label:"Clients",   icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg>", children:["Clients","Requests"] },
  { id:"Settings",  label:"Settings",  icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><circle cx='12' cy='12' r='3'/><path d='M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/></svg>", children:["Profile","Date & Time","Technical Classifications","Users","Email","WhatsApp","Share","Entry Manage","Recycle Bin"] },
  { id:"Help",      label:"Help",      icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><circle cx='12' cy='12' r='10'/><path d='M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4'/><path d='M12 17h.01'/></svg>", children:["Work Instructions"] },
];
function getVisibleGroups(){
  const allowedSet = new Set(getTabs());
  if(getUserRole() === "client") return null;
  const groups = [];
  for(const g of TAB_GROUPS){
    const kids = g.children.filter(c => allowedSet.has(c));
    if(kids.length > 0) groups.push({ ...g, children: kids });
  }
  return groups;
}
function groupOfTab(tabName){
  const groups = getVisibleGroups() || [];
  for(const g of groups){ if(g.children.includes(tabName)) return g.id; }
  return groups[0] ? groups[0].id : null;
}

function getTabs(){
  const role = getUserRole();
  // Client: portal view only
  if(role === "client"){
    const base = ["My Project","Requests","Profile"];
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // IT role: highly restricted — only Dashboard, Work Instructions, Profile
  if(role === "it"){
    const base = ["Dashboard","Work Instructions","Profile"];
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // Employee: own-data tabs only
  if(role === "employee"){
    const base = ["Dashboard","Daily Log","Overtime","Travel","Leaves","My Tasks","Work Instructions","Profile"];
    if(state.profile && state.profile.canViewReports){
      base.splice(base.indexOf("Work Instructions"), 0, "HR Report","Daily Log Report","Reports","Technical Report");
    }
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // HR: full ops but no Users/Share/Clients
  if(role === "hr"){
    const base = ["Dashboard","Daily Log","Overtime","Travel","Leaves","My Tasks","Work Instructions",
                  "HR Report","Daily Log Report","Technical Report","Reports","Analytics","Requests","Projects","Locations","Departments","Profile"];
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // Support: full access except Users and Share
  if(role === "support"){
    const base = ["Dashboard","Daily Log","Overtime","Travel","Leaves","My Tasks","Work Instructions",
                  "HR Report","Daily Log Report","Technical Report","Reports","Requests","Projects","Locations","Departments","Profile"];
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // Admin / Owner: everything
  const base = ["Dashboard","Daily Log","Overtime","Travel","Leaves","Work Instructions",
                "HR Report","Daily Log Report","Technical Report","Reports","Analytics","Executive","Requests","Clients","Projects","Assets","Maintenance","Incidents","Locations","Departments","Branches","Users","WhatsApp","Email","Share","Profile","Technical Classifications","Date & Time","Entry Manage","Recycle Bin","My Tasks"];
  if(!base.includes(state.tab)) state.tab = base[0];
  return base;
}

// Pending request count for notification badge
function pendingRequestCount(){
  if(isClient()){
    // Client sees count of their requests with status changes? Keep simple: no badge for client
    return 0;
  }
  return (state.clientRequests||[]).filter(r=>r.status==="new").length;
}

window.switchTab=function(t){
  window.__navFade=true;
  if(t==="Dashboard") window._dashAnimated=false;   // re-run the KPI count-up on entry
  document.body.classList.remove('fab-open');
  const prevGroup = groupOfTab(state.tab);
  state.tab=t;
  const newGroup = groupOfTab(t);
  // If the group changed (sub-bar must change), rebuild the whole shell.
  // Otherwise just swap content + update active classes (fast path).
  if(prevGroup !== newGroup){
    renderApp();
    window.scrollTo(0,0);
    return;
  }
  const bar = document.getElementById("tabBar");
  if(bar){
    bar.querySelectorAll(".tab").forEach(btn=>{
      btn.classList.toggle("active", btn.getAttribute("data-tab")===t);
    });
  }
  renderTab();
  window.scrollTo(0,0);
  positionTabIndicator();
  if(bar){
    const activeBtn = bar.querySelector(".tab.active");
    if(activeBtn && activeBtn.scrollIntoView){
      try{ activeBtn.scrollIntoView({inline:'center', block:'nearest'}); }catch(e){}
    }
  }
};

// Switch to a main group → opens its FIRST child sub-tab.
window.switchGroup = function(groupId){
  window.__navFade=true;
  const groups = getVisibleGroups() || [];
  const g = groups.find(x=>x.id===groupId);
  if(!g || g.children.length===0) return;
  state.tab = g.children[0];      // first sub-tab of the group
  renderApp();                    // rebuild shell so the sub-bar reflects the new group
  window.scrollTo(0,0);
};

// Navigate prev/next (swipe) — ONLY within the current group's sub-tabs.
window.switchTabByDirection = function(dir){
  const groups = getVisibleGroups();
  if(!groups){   // client flat mode
    const tabs = getTabs();
    const i = tabs.indexOf(state.tab);
    const next = i + dir;
    if(i<0 || next<0 || next>=tabs.length) return;
    switchTab(tabs[next]);
    return;
  }
  const g = groups.find(x=>x.id===groupOfTab(state.tab));
  if(!g) return;
  const kids = g.children;
  const i = kids.indexOf(state.tab);
  const next = i + dir;
  if(i < 0 || next < 0 || next >= kids.length) return;   // stop at group edges (no cross-group swipe)
  switchTab(kids[next]);
};

// Move the gold underline to sit under the active tab
function positionTabIndicator(){
  const bar = document.getElementById("tabBar");
  const ind = document.getElementById("tabIndicator");
  if(!bar || !ind) return;
  const active = bar.querySelector(".tab.active");
  if(!active){ ind.style.width="0"; return; }
  // offsetLeft/offsetWidth are relative to the scrollable nav — correct even when scrolled
  ind.style.left  = active.offsetLeft + "px";
  ind.style.width = active.offsetWidth + "px";
  // Bring the active tab into view if it's off-screen horizontally
  const barRect = bar.getBoundingClientRect();
  const tabRect = active.getBoundingClientRect();
  if(tabRect.right > barRect.right || tabRect.left < barRect.left){
    active.scrollIntoView({behavior:"smooth", inline:"center", block:"nearest"});
  }
}
window.positionTabIndicator = positionTabIndicator;

// Sliding gold indicator for the MAIN group bar.
// Remembers its last position so it animates smoothly even though
// switching groups rebuilds the header (renderApp).
let _lastGroupInd = null;
function positionGroupIndicator(){
  const bar = document.getElementById("groupBar");
  const ind = document.getElementById("groupIndicator");
  if(!bar || !ind) return;
  const active = bar.querySelector(".gtab.active");
  if(!active){ ind.style.width="0"; _lastGroupInd=null; return; }
  const left = active.offsetLeft, width = active.offsetWidth;
  if(_lastGroupInd){
    // Seed the freshly-rebuilt indicator at the previous spot (no animation),
    // then let the transition carry it to the new spot.
    ind.style.transition = "none";
    ind.style.left  = _lastGroupInd.left + "px";
    ind.style.width = _lastGroupInd.width + "px";
    void ind.offsetWidth; // force reflow so the next change animates
    ind.style.transition = "";
  }
  ind.style.left  = left + "px";
  ind.style.width = width + "px";
  _lastGroupInd = { left, width };
  const barRect = bar.getBoundingClientRect();
  const tabRect = active.getBoundingClientRect();
  if(tabRect.right > barRect.right || tabRect.left < barRect.left){
    active.scrollIntoView({behavior:"smooth", inline:"center", block:"nearest"});
  }
}
window.positionGroupIndicator = positionGroupIndicator;

// Keep the gold indicator aligned on screen resize / rotation and after scroll
window.addEventListener("resize", ()=>{ positionTabIndicator(); positionGroupIndicator(); });

// ─────────────────────────────────────────────────────────────────────
// SWIPE NAVIGATION between tabs (mobile)
//   - Works only inside the content area (below the tab bar)
//   - Ignores horizontal swipes that start on a horizontally-scrollable
//     element (wide tables, Assets list, dropdowns) so they keep working
//   - Requires a clear horizontal swipe (> threshold, and mostly horizontal)
//   - Shows a brief hint with the next tab's name
// ─────────────────────────────────────────────────────────────────────
let _swipeStartX = 0, _swipeStartY = 0, _swipeActive = false, _swipeEl = null;
const SWIPE_THRESHOLD = 80;   // px of horizontal travel required (clear swipe)
const SWIPE_MAX_VERT = 60;    // if vertical travel exceeds this, treat as scroll (ignore)

// Does the touch start inside something that scrolls horizontally itself?
function _startsOnHorizontalScroller(el){
  // Lightweight check — NO getComputedStyle (it forces layout and makes
  // touch scrolling sluggish). We only walk a few levels up and use cheap
  // property checks: tag names, a marker class, and scrollWidth overflow.
  let node = el, depth = 0;
  while(node && node !== document.body && depth < 12){
    if(node.nodeType === 1){
      const tag = node.tagName;
      if(tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return true;
      if(node.id === "tabBar") return true;
      const cl = node.classList;
      if(cl){
        if(cl.contains("data-table")) return true;
        if(cl.contains("no-swipe")) return true;
        if(cl.contains("table-scroll")) return true;
      }
      // Cheap overflow check: only when the element is actually wider than its box.
      // (scrollWidth/clientWidth are fast reads; we skip the costly style lookup.)
      if(node.scrollWidth > node.clientWidth + 8 && node.clientWidth > 0){
        // Treat as a horizontal scroller only if it's a TABLE or a wrapping DIV
        if(tag === "TABLE" || tag === "DIV") return true;
      }
    }
    node = node.parentNode;
    depth++;
  }
  return false;
}

function setupSwipeNavigation(){
  const content = document.getElementById("content");
  if(!content || content._swipeBound) return;
  content._swipeBound = true;

  content.addEventListener("touchstart", (e)=>{
    // Ultra-light: just record the start point. NO DOM walking here so that
    // normal vertical scrolling stays perfectly smooth.
    if(e.touches.length !== 1) { _swipeActive = false; return; }
    const t = e.touches[0];
    _swipeEl = e.target;
    _swipeStartX = t.clientX;
    _swipeStartY = t.clientY;
    _swipeActive = true;
  }, {passive:true});

  content.addEventListener("touchend", (e)=>{
    if(!_swipeActive) return;
    _swipeActive = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - _swipeStartX;
    const dy = t.clientY - _swipeStartY;
    // Must be a clear, mostly-horizontal swipe — cheap math checks FIRST.
    if(Math.abs(dx) < SWIPE_THRESHOLD) return;
    if(Math.abs(dy) > SWIPE_MAX_VERT) return;
    if(Math.abs(dx) < Math.abs(dy) * 1.5) return;   // horizontal must dominate
    // Only NOW (confirmed horizontal swipe) do the heavier element check,
    // so it never runs during ordinary scrolling.
    if(_startsOnHorizontalScroller(_swipeEl)) return;

    const tabs = getTabs();
    const i = tabs.indexOf(state.tab);
    if(i < 0) return;
    // Swipe LEFT (dx<0) → next tab; swipe RIGHT (dx>0) → previous tab.
    // No visual hint — switch instantly for the fastest possible response.
    if(dx < 0 && i < tabs.length - 1){
      switchTabByDirection(+1);
    } else if(dx > 0 && i > 0){
      switchTabByDirection(-1);
    }
  }, {passive:true});
}

function renderTab(){
  const c=$("content");
  if(!c)return;
  if(!state.initialized && state.user){ c.innerHTML = skeletonHTML(); return; }

  // Security guard: enforce per-role tab access
  const role = getUserRole();
  if(role === "client"){
    // Client: only portal tabs
    if(!["My Project","Requests","Profile"].includes(state.tab)) state.tab="My Project";
  } else if(role === "it"){
    // IT: only dashboard, work instructions, profile
    if(!["Dashboard","Work Instructions","Profile"].includes(state.tab)) state.tab="Dashboard";
  } else if(role === "employee"){
    // Employee: no admin tabs. Report tabs ARE allowed when admin granted View Reports.
    const _repTabs = ["HR Report","Daily Log Report","Technical Report","Reports"];
    const _blocked = ["Requests","Clients","Projects","Assets","Locations","Departments","Branches","Users","Share","WhatsApp","Email","Entry Manage","Executive","Permissions"];
    if(hasCap("canAssets")){ const _ai=_blocked.indexOf("Assets"); if(_ai>-1)_blocked.splice(_ai,1); }
    if(_blocked.includes(state.tab) || (!(state.profile&&state.profile.canViewReports) && _repTabs.includes(state.tab))) state.tab="Dashboard";
  } else if(role === "support" || role === "hr"){
    // Support/HR: no Users, Share, or Clients management
    if(["Users","Share","Clients","WhatsApp","Email","Entry Manage"].includes(state.tab)) state.tab="Dashboard";
  }

  const fn={
    "Dashboard":renderDashboard,"Daily Log":renderDailyLog,"Overtime":renderOvertime,
    "Travel":renderTravel,"Leaves":renderLeaves,"HR Report":renderHRReport,"Technical Report":renderTechReport,"Reports":renderFlexReports,"Analytics":renderAnalytics,
    "Projects":renderProjects,"Assets":renderAssets,"Maintenance":renderMaintenance,"Locations":renderLocations,"Users":renderUsers,
    "Departments":renderDepartments,"Branches":renderBranches,"Work Instructions":renderWorkInstructions,
    "Share":renderShare,"Profile":renderProfile,"Date & Time":renderDateTime,"Incidents":renderIncidents,"Recycle Bin":renderRecycleBin,"Executive":renderExecutive,"Permissions":renderPermissions,
    "Clients":renderClients,"Requests":renderRequests,"My Tasks":renderMyTasks,"Daily Log Report":renderDailyLogReport,"My Project":renderClientPortal,
    "WhatsApp":renderWhatsApp,
    "Email":renderEmailTab,
    "Technical Classifications":renderTechClassifications,
    "Entry Manage":renderEntryManage,
  }[state.tab]||(isClient()?renderClientPortal:renderDashboard);
  try{
    c.innerHTML=fn();
    // ── polish hooks: animated count-ups + soft view transition ──
    // Animate ONLY on a real tab change — during the initial data sync every
    // arriving collection re-renders, and restarting the animation each time
    // produced a rapid visible shake on first load. Data refreshes now repaint
    // silently; the soft entrance plays once per tab visit.
    try{
      if(window._lastViewTab!==state.tab){
        window._lastViewTab=state.tab;
        c.classList.remove("view-in"); void c.offsetWidth; c.classList.add("view-in");
        if(typeof window._runCountUps==="function") window._runCountUps(c);
      } else if(typeof _cntFmt==="function"){
        c.querySelectorAll(".cnt").forEach(el=>{ if(!el.dataset.done){ el.dataset.done="1"; el.textContent=_cntFmt(el); } });
      }
      if(state.tab==="Date & Time" && typeof window._dtInit==="function") window._dtInit();
    }catch(e){}
  }
  catch(err){
    console.error("Render failed:", state.tab, err);
    c.innerHTML=`<div class="card" style="border-left:4px solid var(--red)"><div class="empty" style="color:var(--red);font-style:normal">⚠️ ${escapeHtml(state.tab)} failed to render<br><span style="font-size:11px;color:var(--muted)">${escapeHtml((err&&err.message)||String(err))}</span></div></div>`;
  }
  if(window.__navFade){
    window.__navFade=false;
    c.classList.remove("content-fade"); void c.offsetWidth; c.classList.add("content-fade");
  }
}

// Coalesce data-driven re-renders: any burst of Firestore snapshots in the
// same frame collapses into ONE renderTab (was: 27+ full renders on load).
let _renderQueued=false;
function scheduleRender(){
  if(_renderQueued) return;
  _renderQueued=true;
  requestAnimationFrame(()=>{ _renderQueued=false; if(state.initialized) renderTab(); });
}
window.render=renderTab;

// ═══════════════════════════════════════════════════════════════════════
//  SUMMARY & DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
//  PERIOD MANAGEMENT (editable label, persisted per-user in localStorage)
// ═══════════════════════════════════════════════════════════════════════
// ═══ PERIOD / DATE-RANGE SYSTEM ═══
// Stored as two real dates (ISO yyyy-mm-dd) in localStorage.
// Empty = no filter (show all). The label is derived from the dates.
function _periodKey(which){
  const uid = (state.profile && state.profile.uid) ? state.profile.uid : "anon";
  return `opt_period_${which}_${uid}`;
}
function getPeriodFrom(){ return localStorage.getItem(_periodKey("from")) || ""; }
function getPeriodTo(){   return localStorage.getItem(_periodKey("to"))   || ""; }
function setPeriodRange(from, to){
  if(from) localStorage.setItem(_periodKey("from"), from); else localStorage.removeItem(_periodKey("from"));
  if(to)   localStorage.setItem(_periodKey("to"), to);     else localStorage.removeItem(_periodKey("to"));
}
// Human-readable label for the header and reports
function getPeriod(){
  const f = getPeriodFrom(), t = getPeriodTo();
  if(!f && !t) return defaultPeriod();
  const fmt = (s)=>{ if(!s) return "…"; const d=new Date(s+"T00:00:00"); return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
  if(f && t) return `${fmt(f)} → ${fmt(t)}`;
  if(f) return `From ${fmt(f)}`;
  return `Until ${fmt(t)}`;
}
function defaultPeriod(){
  const d=new Date();
  return d.toLocaleDateString("en-US",{month:"long",year:"numeric"});
}
// Legacy setter kept for compatibility (no-op text path)
function setPeriod(v){ /* replaced by setPeriodRange */ }

// ── CENTRAL DATE FILTER ──
// Returns true if a record's date falls within the active period range.
// Records without dates pass only when no filter is active.
function inActivePeriod(dateStr){
  const f = getPeriodFrom(), t = getPeriodTo();
  if(!f && !t) return true;        // no filter → everything passes
  if(!dateStr) return false;       // filtered but record has no date
  const d = String(dateStr).slice(0,10);
  if(f && d < f) return false;
  if(t && d > t) return false;
  return true;
}
// Apply the active period filter to an array of records (by their .date field)
function filterByPeriod(rows, dateField="date"){
  const f = getPeriodFrom(), t = getPeriodTo();
  if(!f && !t) return rows;
  return rows.filter(r=>inActivePeriod(r[dateField]));
}

window.editPeriod=function(e){
  if(e) e.stopPropagation();
  openPeriodDialog();
};

// Date-range picker dialog (replaces the old text prompt)
function openPeriodDialog(){
  const f = getPeriodFrom(), t = getPeriodTo();
  const existing = document.getElementById("periodDialog");
  if(existing) existing.remove();
  const html = `
    <div id="periodDialog" style="position:fixed;inset:0;background:rgba(10,22,46,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.remove()">
      <div style="background:white;border-radius:16px;max-width:380px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
        <div style="background:linear-gradient(135deg,#03308B,#1a4db5);padding:18px 22px;color:white">
          <div style="font-size:16px;font-weight:800">📅 Reporting Period</div>
          <div style="font-size:11px;opacity:0.7;margin-top:2px">All tabs and reports will filter to this date range</div>
        </div>
        <div style="padding:20px 22px">
          <div style="margin-bottom:14px">
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:5px">From Date</label>
            <input type="date" id="pdFrom" value="${f}" style="width:100%;padding:11px;border:1px solid #CBD5E1;border-radius:8px;font-size:14px">
          </div>
          <div style="margin-bottom:18px">
            <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:5px">To Date</label>
            <input type="date" id="pdTo" value="${t}" style="width:100%;padding:11px;border:1px solid #CBD5E1;border-radius:8px;font-size:14px">
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px">
            <button onclick="window.applyPeriodPreset('thisMonth')" style="flex:1;min-width:90px;padding:7px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;color:#334155">This Month</button>
            <button onclick="window.applyPeriodPreset('lastMonth')" style="flex:1;min-width:90px;padding:7px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;color:#334155">Last Month</button>
            <button onclick="window.applyPeriodPreset('thisYear')" style="flex:1;min-width:90px;padding:7px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;color:#334155">This Year</button>
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="window.savePeriodDialog()" style="flex:1;padding:12px;background:#03308B;color:#C9A84C;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Apply Filter</button>
            <button onclick="window.clearPeriodDialog()" style="padding:12px 16px;background:#FEE2E2;color:#C62828;border:1px solid #FCA5A5;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Clear</button>
          </div>
          <button onclick="document.getElementById('periodDialog').remove()" style="width:100%;margin-top:8px;padding:9px;background:none;border:none;color:#94A3B8;font-size:12px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}
window.applyPeriodPreset=function(which){
  const now=new Date();
  let from, to;
  if(which==="thisMonth"){
    from=new Date(now.getFullYear(),now.getMonth(),1);
    to=new Date(now.getFullYear(),now.getMonth()+1,0);
  } else if(which==="lastMonth"){
    from=new Date(now.getFullYear(),now.getMonth()-1,1);
    to=new Date(now.getFullYear(),now.getMonth(),0);
  } else if(which==="thisYear"){
    from=new Date(now.getFullYear(),0,1);
    to=new Date(now.getFullYear(),11,31);
  }
  const iso=(d)=>d.toISOString().slice(0,10);
  const fEl=document.getElementById("pdFrom"), tEl=document.getElementById("pdTo");
  if(fEl) fEl.value=iso(from);
  if(tEl) tEl.value=iso(to);
};
window.savePeriodDialog=function(){
  const f=document.getElementById("pdFrom")?.value||"";
  const t=document.getElementById("pdTo")?.value||"";
  if(f && t && f > t){ toast("From date must be before To date"); return; }
  setPeriodRange(f, t);
  document.getElementById("periodDialog")?.remove();
  renderApp();
  toast(f||t ? "Period filter applied ✓" : "Filter cleared");
};
window.clearPeriodDialog=function(){
  setPeriodRange("", "");
  document.getElementById("periodDialog")?.remove();
  renderApp();
  toast("Showing all dates");
};

// ═══════════════════════════════════════════════════════════════════════
//  SEQUENTIAL REPORT NUMBERING — RPT-YYYY-NNNN
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
//  GPS LOCATION CAPTURE + PER-EMPLOYEE PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════
// Get user's GPS position. Returns {lat, lng, accuracy} or {denied:true}
function captureGPS(){
  return new Promise((resolve)=>{
    if(!navigator.geolocation){
      resolve({denied:true, reason:"GPS not supported on this device"});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        resolve({
          lat: +pos.coords.latitude.toFixed(6),
          lng: +pos.coords.longitude.toFixed(6),
          accuracy: Math.round(pos.coords.accuracy||0)
        });
      },
      (err)=>{
        resolve({denied:true, reason: err.code===1 ? "Location permission denied" : "Location unavailable"});
      },
      {enableHighAccuracy:true, timeout:10000, maximumAge:60000}
    );
  });
}
function gpsMapLink(lat,lng){
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
function gpsBadgeHTML(r){
  if(r.gpsLat && r.gpsLng){
    return `<a href="${gpsMapLink(r.gpsLat,r.gpsLng)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;text-decoration:none">🛰️ GPS</a>`;
  }
  if(r.gpsDenied){
    return `<span style="display:inline-flex;align-items:center;gap:3px;background:#FFEBEE;color:#C62828;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600" title="${escapeHtml(r.gpsDenied)}">🚫 GPS</span>`;
  }
  return '';
}

// ── Per-employee entry permissions (managed by Admin in Users tab) ──
// Stored in Firestore: collection "employeePermissions", doc id = employee name
// Fields: { gpsRequired: bool, resolutionRequired: bool }
// Defaults if no record: gpsRequired=true, resolutionRequired=true (for employees)
function getEmpPermissions(employeeName){
  const p = (state.employeePermissions||[]).find(x=>x.id===employeeName || x.employee===employeeName);
  return {
    gpsRequired:        p ? (p.gpsRequired        !== false) : true,
    resolutionRequired: p ? (p.resolutionRequired !== false) : true,
    equipmentRequired:  p ? (p.equipmentRequired  === true)  : false,  // OFF by default
    deviceTracking:     p ? (p.deviceTracking     === true)  : false,  // OFF: show Device picker in Daily Log
    fullDeviceEdit:     p ? (p.fullDeviceEdit      === true)  : false,  // OFF: edit ALL device fields (else Status+InstallDate only)
  };
}
async function saveEmpPermissions(employeeName, perms){
  if(!isAdmin()) return toast("Admin only");
  const {db, doc, setDoc} = window.__fb;
  await setDoc(doc(db, "employeePermissions", employeeName), {
    employee: employeeName,
    gpsRequired:        !!perms.gpsRequired,
    resolutionRequired: !!perms.resolutionRequired,
    equipmentRequired:  !!perms.equipmentRequired,
    deviceTracking:     !!perms.deviceTracking,
    fullDeviceEdit:     !!perms.fullDeviceEdit,
    updatedBy: state.profile.uid,
    updatedAt: new Date().toISOString(),
  });
  toast(`Permissions updated for ${employeeName} ✓`);
}
window.toggleEmpPerm = async function(employeeName, field){
  const cur = getEmpPermissions(employeeName);
  cur[field] = !cur[field];
  await saveEmpPermissions(employeeName, cur);
};

// ── Per-CLIENT entry permissions (managed by Admin in Users tab) ──
// Stored in Firestore: collection "clientPermissions", doc id = client record id
// All OFF by default — the admin opts each client in.
function getClientPermissions(clientId){
  const p = (state.clientPermissions||[]).find(x=>x.id===clientId || x.clientId===clientId);
  return {
    projectDetails: p ? (p.projectDetails === true) : false,  // see Project/Code/Areas/Sites/Devices in Requests
    deviceEditSuggest: p ? (p.deviceEditSuggest === true) : false,  // suggest device edits (admin approves)
    portalFilters: p ? (p.portalFilters === true) : false,  // filter bar in client portal
    reportsExport: p ? (p.reportsExport === true) : false,  // PDF/Excel report buttons
    repSummary: p ? (p.repSummary !== false) : true,   // report content toggles (default on)
    repWorkLog: p ? (p.repWorkLog !== false) : true,
    repDevices: p ? (p.repDevices !== false) : true,
    repRequests: p ? (p.repRequests !== false) : true,
  };
}
async function saveClientPermissions(clientId, perms){
  if(!isAdmin()) return toast("Admin only");
  const {db, doc, setDoc} = window.__fb;
  await setDoc(doc(db, "clientPermissions", clientId), {
    clientId: clientId,
    projectDetails:    !!perms.projectDetails,
    deviceEditSuggest: !!perms.deviceEditSuggest,
    portalFilters:     !!perms.portalFilters,
    reportsExport:     !!perms.reportsExport,
    repSummary:  perms.repSummary  !== false,
    repWorkLog:  perms.repWorkLog  !== false,
    repDevices:  perms.repDevices  !== false,
    repRequests: perms.repRequests !== false,
    updatedBy: state.profile.uid,
    updatedAt: new Date().toISOString(),
  });
  toast("Client permissions updated ✓");
}
window.toggleClientPerm = async function(clientId, field){
  const cur = getClientPermissions(clientId);
  cur[field] = !cur[field];
  await saveClientPermissions(clientId, cur);
};
// Permissions of the currently signed-in client (empty perms if not linked)
function myClientPermissions(){
  const c = getMyClientRecord();
  return c ? getClientPermissions(c.id) : getClientPermissions("__none__");
}

// ═══════════════════════════════════════════════════════════════════════
//  DAILY LOG ENTRY AUTO-NUMBERING
// ═══════════════════════════════════════════════════════════════════════
// Returns next entry number based on current max in state.daily
function getNextDailyEntryNo(){
  if(!state.daily || state.daily.length === 0) return 1;
  const nums = state.daily
    .map(r => parseInt(r.entryNo || 0))
    .filter(n => !isNaN(n) && n > 0);
  return nums.length > 0 ? Math.max(...nums) + 1 : state.daily.length + 1;
}
function formatEntryNo(n){
  return String(n).padStart(3, "0");
}

// Assign entry numbers to existing entries that don't have one
// Called once by admin from Profile — sorts by date then assigns 001,002...
async function assignEntryNumbersToExisting(){
  const {db, doc, setDoc} = window.__fb;
  if(!db) return toast("Database not ready");
  const sorted = [...state.daily].sort((a,b)=>{
    const d = (a.date||"").localeCompare(b.date||"");
    if(d !== 0) return d;
    return (a.start||"").localeCompare(b.start||"");
  });
  let count = 0;
  for(let i = 0; i < sorted.length; i++){
    const r = sorted[i];
    if(!r.entryNo){
      const data = {...r};
      const id = data.id; delete data.id;
      data.entryNo = i + 1;
      await setDoc(doc(db, "daily", id), data, {merge: true});
      count++;
    }
  }
  toast(`Assigned numbers to ${count} entries ✓`);
}

// Reset daily entry counter (sets all entries to re-number from 1 on next assignEntryNumbers call)
async function resetDailyEntryCounter(){
  if(!isAdmin()) return;
  if(!confirm("Reset daily entry counter?\n\nThis will remove numbering from all entries. Use \"Assign Numbers\" after to re-number from 001.")) return;
  const {db, doc, updateDoc, deleteField} = window.__fb;
  if(!updateDoc || !deleteField){
    toast("Update function not available — please refresh");
    return;
  }
  let count = 0;
  for(const r of state.daily){
    if(r.entryNo){
      await updateDoc(doc(db, "daily", r.id), { entryNo: deleteField() });
      count++;
    }
  }
  toast(`Numbers removed from ${count} entries ✓ — use Assign Numbers to re-number`);
}



// ── Light / Dark theme toggle (persisted per device) ──
function toggleTheme(){
  const r=document.documentElement;
  const dark=r.getAttribute('data-theme')==='dark';
  if(dark) r.removeAttribute('data-theme'); else r.setAttribute('data-theme','dark');
  try{ localStorage.setItem('girek-theme', dark?'light':'dark'); }catch(e){}
  const b=document.getElementById('themeBtn'); if(b) b.innerHTML=dark?ICON_MOON:ICON_SUN;
}
window.toggleTheme = toggleTheme;

// Header shrinks subtly on scroll (glass effect pairs with CSS)
window.addEventListener('scroll',()=>{try{document.body.classList.toggle('hdr-compact',(window.scrollY||0)>40)}catch(e){}} ,{passive:true});

// ── Connection awareness: badge + toasts, so field staff always know ──
window.addEventListener('offline',()=>{try{if(window._shareMode)return;const d=document.getElementById('netDot');if(d)d.style.display='inline-flex';toast('⚠ Offline — your changes are saved locally and will sync automatically');}catch(e){}});
window.addEventListener('online',()=>{try{if(window._shareMode)return;const d=document.getElementById('netDot');if(d)d.style.display='none';toast('Back online — syncing ✓');}catch(e){}});

// ═══════════════════════════════════════════════════════════════════════
//  SMART ALERTS — proactive, computed from state (offline-safe, read-only)
//  Surfaces things you'd otherwise have to go looking for. Admin/HR only.
// ═══════════════════════════════════════════════════════════════════════

// ── Alert snoozing: hide an alert for 7 days; it returns if still unresolved ──
const SNOOZE_KEY='girek-alert-snooze';
function _snoozeMap(){ try{ return JSON.parse(localStorage.getItem(SNOOZE_KEY)||'{}'); }catch(e){ return {}; } }
function isSnoozed(key){ const t=_snoozeMap()[key]; return t ? (Date.now() < t) : false; }
window.snoozeAlert=function(key){
  try{ const m=_snoozeMap(); m[key]=Date.now()+7*864e5; localStorage.setItem(SNOOZE_KEY,JSON.stringify(m)); }catch(e){}
  toast("Snoozed 7 days — returns if unresolved");
  try{ if(typeof closeNotifPanel==="function") closeNotifPanel(); }catch(e){}
  render();
};
// ── DEVICE (system-tray) NOTIFICATIONS — fire while the app is open/background ──
let _seenNotifIds=null;
function sysNotifEnabled(){ try{ return localStorage.getItem('girek-sysnotif')==='on'
  && typeof Notification!=='undefined' && Notification.permission==='granted'; }catch(e){ return false; } }
function _sysNotifyNew(items){
  const me=state.profile&&state.profile.uid; if(!me) return;
  const mine=items.filter(n=>n.toUid===me);
  if(_seenNotifIds===null){ _seenNotifIds=new Set(mine.map(n=>n.id)); return; }   // baseline: no spam on load
  const fresh=mine.filter(n=>!_seenNotifIds.has(n.id));
  fresh.forEach(n=>_seenNotifIds.add(n.id));
  if(!fresh.length || !sysNotifEnabled()) return;
  fresh.slice(0,3).forEach(n=>{
    const title=n.title||"Girêk"; const body=n.body||n.text||n.msg||n.message||"";
    try{
      if(navigator.serviceWorker&&navigator.serviceWorker.ready){
        navigator.serviceWorker.ready.then(reg=>reg.showNotification(title,{body,tag:'girek-'+n.id,vibrate:[80,40,80],renotify:false})).catch(()=>{});
      } else if(typeof Notification!=='undefined'){ new Notification(title,{body}); }
    }catch(e){}
  });
}
window.enableSysNotifs=async function(){
  try{
    if(typeof Notification==='undefined') return toast("⚠ Not supported on this browser");
    const p=await Notification.requestPermission();
    if(p==='granted'){
      try{ localStorage.setItem('girek-sysnotif','on'); }catch(e){}
      toast("🔔 Device notifications ON ✓");
      try{ navigator.serviceWorker.ready.then(reg=>reg.showNotification("Girêk",{body:"Device notifications are working ✓",vibrate:[80]})); }catch(e){}
    } else toast("⚠ Permission denied — allow notifications for this site in browser settings");
  }catch(e){ toast("⚠ "+e.message); }
  render();
};
window.disableSysNotifs=function(){ try{localStorage.setItem('girek-sysnotif','off');}catch(e){} toast("Device notifications OFF"); render(); };

// ── SLA config (settings/sla doc, admin-editable in Requests) ──
function getSLA(){
  const d=(state.settingsDocs||[]).find(x=>x.id==="sla")||{};
  return { responseHrs:Number(d.responseHrs)||24, completeHrs:Number(d.completeHrs)||72 };
}
const REQ_FINAL_RE=/complet|closed|done|rejected|cancel/i;

function computeAlerts(){
  if(!(isAdmin()||isHR())) return [];
  const out=[], now=new Date();
  const daily=state.daily||[], devices=state.devices||[], projects=state.projects||[], reqs=state.clientRequests||[];
  const dstr=(n)=>new Date(now-n*864e5).toISOString().slice(0,10);

  // 1) Warranty: expired + expiring within 30 days
  let expired=0, soon=0;
  devices.forEach(d=>{ const s=toDateStr(d.warrantyExp); const w=s?new Date(s):null;
    if(w&&!isNaN(w)){ const diff=(w-now)/864e5; if(diff<0)expired++; else if(diff<=30)soon++; } });
  if(expired>0) out.push({sev:"high",icon:"🛡️",title:`${expired} device${expired>1?'s':''} out of warranty`,meta:"Review renewals / replacements",go:()=>{window.assetFilterWarranty="expired";window.assetFilterProject="";window.assetFilterStatus="";switchTab("Assets");}});
  if(soon>0)    out.push({sev:"med",icon:"⏳",title:`${soon} warranty${soon>1?'ies':'y'} expiring ≤ 30 days`,meta:"Plan ahead",go:()=>{window.assetFilterWarranty="soon30";window.assetFilterProject="";window.assetFilterStatus="";switchTab("Assets");}});

  // 2) Project health: over budget / near budget (needs estimatedHours)
  const projHrs={}; daily.forEach(r=>{const p=(r.project||"").trim(); if(p)projHrs[p]=(projHrs[p]||0)+Number(r.duration||0);});
  projects.filter(p=>Number(p.estimatedHours||0)>0).forEach(p=>{
    if(REQ_FINAL_RE.test(p.status||"")) return;   // completed/closed projects need no budget watching
    const est=Number(p.estimatedHours), used=projHrs[(p.name||"").trim()]||0, pct=Math.round(used/est*100);   // HOURS on both sides
    if(pct>100) out.push({sev:"high",icon:"🏗️",title:`${p.name} is over budget (${pct}%)`,meta:`${fmtHM(used)} of ${fmtHM(est)}`,go:()=>{window.assetFilterProject=p.name;switchTab("Analytics");}});
    else if(pct>=90) out.push({sev:"med",icon:"🏗️",title:`${p.name} near budget (${pct}%)`,meta:"Watch closely",go:()=>switchTab("Analytics")});
  });

  // 3) Idle tracked employees: no entry in 3+ days
  const tracked={}; (state.users||[]).forEach(u=>{ if(u.isTrackedEmployee && u.employeeName) tracked[u.employeeName]=null; });
  daily.forEach(r=>{ if(r.employee && (r.employee in tracked)){ if(!tracked[r.employee]||r.date>tracked[r.employee]) tracked[r.employee]=r.date; } });
  const d3=dstr(3);
  Object.entries(tracked).forEach(([e,last])=>{
    if(!last) out.push({sev:"med",icon:"👤",title:`${e} has no work entries yet`,meta:"Tracked employee",go:()=>{window._logEmpFilter=e;switchTab("Daily Log");}});
    else if(last<d3) out.push({sev:"low",icon:"👤",title:`${e} — no entry since ${fmtDate(last)}`,meta:"3+ days idle",go:()=>{window._logEmpFilter=e;switchTab("Daily Log");}});
  });

  // 4) Pending client requests (new/unfinished) & device-edit suggestions
  const openReq=reqs.filter(r=>r.status==="new").length;
  if(openReq>0) out.push({sev:"med",icon:"📨",title:`${openReq} new client request${openReq>1?'s':''} awaiting review`,meta:"Requests tab",go:()=>switchTab("Requests")});

  // 4b) SLA breaches / at-risk on open client requests
  try{
    const sla=getSLA(), nowT=Date.now();
    const init=(typeof reqInitialStatus==="function")?reqInitialStatus():"new";
    let br=0, wr=0;
    reqs.forEach(r=>{
      if(!r.createdAt || REQ_FINAL_RE.test(r.status||"")) return;
      const isNewR=((r.status||init)===init) && !r.respondedAt;
      const limit=(isNewR?sla.responseHrs:sla.completeHrs)*36e5;
      const left=new Date(r.createdAt).getTime()+limit-nowT;
      if(left<0) br++; else if(left<limit*0.25) wr++;
    });
    if(br>0) out.push({sev:"high",icon:"⏱",title:`${br} request${br>1?'s':''} breached SLA`,meta:"Respond now",go:()=>switchTab("Requests")});
    if(wr>0) out.push({sev:"med", icon:"⏱",title:`${wr} request${wr>1?'s':''} nearing SLA limit`,meta:"At risk",go:()=>switchTab("Requests")});
  }catch(e){}

  // 4c) Backup overdue (admin) — settings/backup {intervalDays, lastBackupAt}
  try{
    if(isAdmin()){
      const b=(state.settingsDocs||[]).find(x=>x.id==="backup")||{};
      const iv=Number(b.intervalDays)||7;
      const last=b.lastBackupAt?new Date(b.lastBackupAt).getTime():0;
      const days=Math.floor((Date.now()-last)/864e5);
      if(days>=iv) out.push({sev:days>=iv*2?"med":"low",icon:"🗄️",title:last?`Backup overdue — last one ${days}d ago`:"No backup taken yet",meta:`Target: every ${iv} days`,go:()=>switchTab("Recycle Bin")});
    }
  }catch(e){}

  // 5) Preventive maintenance due
  if(typeof pmStatusCounts==="function"){
    try{
      const pc=pmStatusCounts();
      if(pc.overdue>0) out.push({sev:"high",icon:"🛠️",title:`${pc.overdue} maintenance task${pc.overdue>1?'s':''} overdue`,meta:"Preventive maintenance",go:()=>switchTab("Maintenance")});
      if(pc.soon>0)    out.push({sev:"med", icon:"🗓️",title:`${pc.soon} maintenance task${pc.soon>1?'s':''} due within 7 days`,meta:"Plan the visits",go:()=>switchTab("Maintenance")});
    }catch(e){}
  }
  out.forEach(a=>{ a.key = a.icon+"|"+a.title; });    // stable key per alert
  const rank={high:0,med:1,low:2};
  return out.filter(a=>!isSnoozed(a.key)).sort((a,b)=>rank[a.sev]-rank[b.sev]);
}
window._alertsCache=[];
function alertCountHigh(){ try{ return window._alertsCache.filter(a=>a.sev==="high").length; }catch(e){ return 0; } }
window.alertsHTML=function(){
  window._alertsCache=computeAlerts();
  const A=window._alertsCache;
  const sevc={high:"#C62828",med:"#E65100",low:"#2E5FA3"};
  if(!A.length) return "";
  return `<div style="background:#FFF8E1;border-bottom:2px solid #C9A84C">
    <div style="padding:8px 12px;font-size:11px;font-weight:800;color:#7F6000;letter-spacing:.5px">⚠️ SMART ALERTS · ${A.length}</div>
    ${A.map((a,i)=>`<div style="display:flex;align-items:center;gap:9px;padding:9px 12px;border-top:1px solid #F0E2B8">
      <span onclick="_alertGo(${i})" style="display:flex;align-items:center;gap:9px;flex:1;min-width:0;cursor:pointer">
        <span style="width:7px;height:7px;border-radius:4px;background:${sevc[a.sev]};flex:0 0 auto"></span>
        <span style="font-size:15px">${a.icon}</span>
        <span style="display:flex;flex-direction:column;min-width:0">
          <span style="font-size:12.5px;font-weight:700;color:#5C4A12">${escapeHtml(a.title)}</span>
          <span style="font-size:10.5px;color:#8A7530">${escapeHtml(a.meta||'')}</span>
        </span>
      </span>
      <button onclick="event.stopPropagation();snoozeAlert(this.dataset.k)" data-k="${escapeHtml(a.key)}" title="Snooze 7 days" style="background:#F0E2B8;color:#7F6000;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;flex:0 0 auto">${ICN.clock} 7d</button>
    </div>`).join("")}
  </div>`;
};
window._openAlertsLegacy=function(){
  window._alertsCache=computeAlerts();
  let ov=document.getElementById('alertsPanel');
  if(!ov){ ov=document.createElement('div'); ov.id='alertsPanel'; document.body.appendChild(ov);
    ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open');}); }
  const A=window._alertsCache;
  const sevc={high:"#C62828",med:"#E65100",low:"#2E5FA3"};
  ov.innerHTML=`<div class="al-box">
    <div class="al-hd"><span>🔔 Smart Alerts</span><button onclick="document.getElementById('alertsPanel').classList.remove('open')" class="al-x">${ICN.x}</button></div>
    <div class="al-list">${A.length?A.map((a,i)=>`<div class="al-it" onclick="_alertGo(${i})">
      <span class="al-dot" style="background:${sevc[a.sev]}"></span>
      <span class="al-ic">${a.icon}</span>
      <span class="al-tx"><span class="al-t">${escapeHtml(a.title)}</span><span class="al-m">${escapeHtml(a.meta||'')}</span></span>
    </div>`).join(''):'<div class="al-empty">✅ All clear — nothing needs attention.</div>'}</div>
    <div class="al-ft">Computed live from your data · updates each time you open this</div>
  </div>`;
  ov.classList.add('open');
};
window._alertGo=function(i){ const a=window._alertsCache[i];
  try{ if(typeof closeNotifPanel==="function") closeNotifPanel(); }catch(e){}
  const ov=document.getElementById('alertsPanel'); if(ov) ov.classList.remove('open');
  if(a&&a.go)a.go(); };
// keep the header badge fresh

// Combined header-bell count: unread notifications + smart alerts
function bellCount(){
  let n=0;
  try{ n+=unreadNotifCount()||0; }catch(e){}
  try{ n+=(computeAlerts()||[]).length; }catch(e){}
  return n;
}

function refreshAlertBadge(){ try{ window._alertsCache=computeAlerts(); }catch(e){} }
