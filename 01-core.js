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
    id:"cctv", short:"CCTV", name:"CCTV / Video Surveillance", icon:"📹", color:"#1565C0",
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
    id:"fire", short:"Fire Alarm", name:"Fire Alarm System", icon:"🔥", color:"#C62828",
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
    id:"acs", short:"Access", name:"Access Control System", icon:"🚪", color:"#00695C",
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
    id:"ids", short:"Intrusion", name:"Intrusion / Hold-up System", icon:"🚨", color:"#7B1FA2",
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
    id:"net", short:"Network", name:"Network / Structured Cabling", icon:"🌐", color:"#2E5FA3",
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
    id:"elv", short:"ELV", name:"ELV Systems (General)", icon:"⚡", color:"#E65100",
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
  {
    id:"elvi", short:"ELV+", name:"ELV \u2014 Integrated Systems", icon:"\ud83e\udde9", color:"#4527A0",
    multi:true,          // reports SEVERAL sub-systems in one document
    match:[],            // never auto-matched from a device System field
    standards:"EN 50130-4 (EMC immunity \u2014 product family standard) \u00b7 EN 50130-5 (environmental classes) \u00b7 plus the governing standards of every sub-system included in the scope below",
    fields:[
      {k:"integ",  l:"Integration platform"},
      {k:"integv", l:"Platform version / build"},
      {k:"visit",  l:"Visit type (PM / CM / handover)"},
      {k:"scope",  l:"Contract / scope reference"},
    ],
    checks:[
      "Integrated platform operational \u2014 no unacknowledged alarms or offline devices",
      "All sub-system panels and head-end equipment inspected and in normal state",
      "Interfaces between sub-systems verified against the cause & effect matrix",
      "Time synchronisation across all sub-systems verified (single reference source)",
      "Power supplies, UPS and battery autonomy verified for each sub-system",
      "Earthing and bonding verified",
      "EMC and environmental conditions acceptable (EN 50130-4 / -5)",
      "Containment, trunking, cable routes and labelling inspected",
      "Server and database backups verified, restore path tested",
      "User accounts, roles and privileges reviewed across all platforms",
      "Firmware and software versions recorded, update status assessed",
      "As-built documentation, O&M manuals and drawings current",
      "Operator training records verified",
      "Spare parts inventory verified",
      "Outstanding defects from the previous visit closed",
    ],
  },
];

// \u2550\u2550\u2550 ELV SUB-SYSTEMS \u2014 the scope catalogue of the integrated report \u2550\u2550\u2550
// Entries whose id equals a SYS_TEMPLATES id inherit that discipline's full
// checklist and standards (so an admin edit to the CCTV list flows straight
// through here). Entries carrying their own `checks` are standalone.
// `sup:true` marks supporting infrastructure rather than an ELV discipline.
const ELV_SUBS = [
  {id:"cctv", name:"CCTV / Video Surveillance",   icon:"\ud83d\udcf9", color:"#1565C0", match:["cctv","camera","video","surveillance"]},
  {id:"acs",  name:"Access Control System",       icon:"\ud83d\udeaa", color:"#00695C", match:["access","acs"]},
  {id:"ids",  name:"Intrusion / Hold-up System",  icon:"\ud83d\udea8", color:"#7B1FA2", match:["intrusion","intruder","burglar","ids"]},
  {id:"fire", name:"Fire Alarm System",           icon:"\ud83d\udd25", color:"#C62828", match:["fire alarm","fire"]},
  {id:"net",  name:"Network / Structured Cabling",icon:"\ud83c\udf10", color:"#2E5FA3", match:["network","networking","lan","cabling","structured"]},
  {
    id:"pava", name:"Public Address / Voice Alarm", icon:"\ud83d\udce3", color:"#00838F",
    match:["public address","voice alarm","voice evacuation","pava","pa/va","pa system"],
    standards:"EN 54-16 (voice alarm control and indicating equipment) \u00b7 EN 54-24 (loudspeakers) \u00b7 ISO 7240-16 \u00b7 IEC 60849 \u00b7 NFPA 72 Chapter 24 (emergency communications)",
    checks:[
      "Amplifier racks and power supplies inspected \u2014 no fault indications",
      "Standby amplifier automatic changeover tested",
      "Loudspeaker line impedance and earth-fault monitoring verified (EN 54-16)",
      "Sound pressure level measured per zone against the design target",
      "Speech intelligibility verified (STI-PA where specified)",
      "Zone selection, priority and override logic verified",
      "Emergency microphone and pre-recorded messages tested",
      "Interface with fire alarm \u2014 alert and evacuation messages verified",
      "Standby battery autonomy verified",
      "Cable fault monitoring and reporting verified",
      "Background music separation and volume limits verified",
    ],
  },
  {
    id:"ups", name:"UPS / DC Power", icon:"\ud83d\udd0b", color:"#EF6C00", sup:true,
    match:["ups","uninterruptible","battery","dc power","rectifier"],
    standards:"IEC 62040-3 (UPS performance and test requirements) \u00b7 EN 50171 (central power supply systems) \u00b7 IEEE 1188 (valve-regulated battery maintenance) \u00b7 IEC 62485-2 (battery safety)",
    checks:[
      "Input and output voltage, frequency and phase readings recorded",
      "Load percentage and power factor within the rated capacity",
      "Battery block voltages, internal resistance and terminal torque verified (IEEE 1188)",
      "Battery autonomy / runtime test performed at the declared load",
      "Battery installation date and replacement due date recorded",
      "Charger float and boost voltages verified",
      "Static and maintenance bypass transfer tested",
      "Alarms, fault indications and event log reviewed",
      "Cooling fans, air filters and ventilation inspected",
      "Battery room / cabinet temperature within limits (IEC 62485-2)",
      "Earthing and bonding of the UPS and battery frame verified",
      "Downstream distribution and breaker coordination verified",
      "Remote monitoring / SNMP notification verified",
      "Firmware version recorded",
    ],
  },
  {
    id:"bms", name:"BMS / Building Management", icon:"\ud83c\udfe2", color:"#546E7A",
    match:["bms","building management","building automation","bacnet","hvac control"],
    standards:"ISO 16484 (building automation and control systems) \u00b7 ASHRAE 135 / ISO 16484-5 (BACnet) \u00b7 EN 15232 (energy performance of building automation)",
    checks:[
      "Head-end workstation and servers operational \u2014 no unacknowledged alarms",
      "Controllers and field panels inspected, communications healthy",
      "Sensor calibration verified (temperature, humidity, pressure, CO / CO2)",
      "Actuators, valves and dampers stroked and verified",
      "Setpoints, time schedules and trend logs reviewed",
      "Alarm routing and notification tested",
      "Interlocks with fire alarm verified (HVAC shutdown / smoke dampers)",
      "Protocol gateways and network integration verified (BACnet / Modbus)",
      "Database backup taken and restore path verified",
      "Graphics and as-built points list current",
    ],
  },
  {
    id:"icom", name:"Intercom / Video Door Entry", icon:"\ud83d\udcde", color:"#5D4037",
    match:["intercom","door entry","video door","door phone"],
    standards:"EN 50486 (audio and video door entry systems) \u00b7 EN/IEC 60839-11-1 where linked to access control",
    checks:[
      "Entrance panels and call buttons operational",
      "Audio quality verified in both directions",
      "Video image quality at door stations verified",
      "Door release integration with access control verified",
      "Indoor monitors / handsets tested per unit",
      "Power supplies and battery backup verified",
      "Cabling, terminations and enclosures inspected",
      "Directory and unit programming verified",
    ],
  },
  {
    id:"gate", name:"Barriers / Gates / ANPR", icon:"\ud83d\udea7", color:"#795548",
    match:["barrier","gate","anpr","lpr","boom","turnstile"],
    standards:"EN 12453 (safety in use of power-operated doors and gates) \u00b7 EN 12978 (safety devices) \u00b7 EN 12604 / EN 12605 (mechanical aspects)",
    checks:[
      "Mechanical operation, alignment and lubrication verified",
      "Safety devices tested \u2014 photocells, loops, pressure-sensitive edges (EN 12978)",
      "Force limitation and closing force verified (EN 12453)",
      "Emergency manual release tested",
      "Vehicle detection loops verified",
      "ANPR / LPR read accuracy verified against a test sample",
      "Integration with access control and visitor management verified",
      "Warning lights, signage and audible alerts operational",
      "Control panel, motor and gearbox inspected",
    ],
  },
  {
    id:"nurse", name:"Nurse Call", icon:"\ud83d\udecf\ufe0f", color:"#AD1457",
    match:["nurse call","nurse","patient call"],
    standards:"EN 50134 series (social alarm systems) \u00b7 VDE 0834 (nurse call systems) \u00b7 HTM 08-03 where applicable",
    checks:[
      "Bedside and bathroom call points tested per room",
      "Pull-cord and pressure-mat devices verified",
      "Corridor lamps and zone indicators verified",
      "Nurse station display and call queue verified",
      "Call escalation and timeout logic verified",
      "Presence / attendance and reassurance functions verified",
      "Standby battery autonomy verified",
      "Event log and response-time report reviewed",
    ],
  },
  {
    id:"clock", name:"Master Clock / Time Sync", icon:"\ud83d\udd50", color:"#37474F", sup:true,
    match:["master clock","time sync","ntp","clock system"],
    standards:"IEEE 1588 (Precision Time Protocol) \u00b7 RFC 5905 (NTPv4) \u00b7 EN 60950 for the equipment",
    checks:[
      "Master clock GPS / radio reference lock verified",
      "Time distribution verified to all sub-systems (NTP / PTP)",
      "Slave clock accuracy checked at sample locations",
      "Daylight-saving and time-zone configuration verified",
      "Holdover accuracy on reference loss verified",
      "Battery backup verified",
    ],
  },
];

// \u2550\u2550\u2550 CROSS-SYSTEM INTERFACES \u2014 only shown when BOTH sides are in scope \u2550\u2550\u2550
const ELV_INTEG = [
  {a:"fire", b:"acs",   d:"Fire alarm releases access-controlled doors on evacuation"},
  {a:"fire", b:"pava",  d:"Fire alarm triggers alert and voice evacuation messages"},
  {a:"fire", b:"bms",   d:"Fire alarm initiates HVAC shutdown and smoke damper control"},
  {a:"fire", b:"cctv",  d:"Fire event calls up associated cameras and bookmarks video"},
  {a:"fire", b:"gate",  d:"Fire alarm opens barriers for emergency vehicle access"},
  {a:"fire", b:"nurse", d:"Fire alarm indication repeated at the nurse station"},
  {a:"ids",  b:"cctv",  d:"Intrusion alarm calls up the camera and starts alarm recording"},
  {a:"ids",  b:"acs",   d:"Arming inhibited while doors are held open or occupancy is present"},
  {a:"ids",  b:"pava",  d:"Intrusion alarm announced over the public address system"},
  {a:"acs",  b:"cctv",  d:"Access events tagged to video \u2014 cardholder image verification"},
  {a:"acs",  b:"icom",  d:"Intercom door release routed through access control"},
  {a:"acs",  b:"gate",  d:"Credential or ANPR read grants vehicle access"},
  {a:"cctv", b:"net",   d:"Video VLAN, QoS and bandwidth verified end to end"},
  {a:"ups",  b:"net",   d:"Network core and edge switches on the protected UPS supply"},
  {a:"ups",  b:"cctv",  d:"Recorders and PoE switches on the protected UPS supply"},
  {a:"ups",  b:"acs",   d:"Controllers and locking supplies on the protected UPS supply"},
  {a:"ups",  b:"fire",  d:"Fire panel supply independent of the UPS, per the fire strategy"},
  {a:"clock",b:"net",   d:"Single time reference distributed \u2014 event logs correlate across systems"},
  {a:"nurse",b:"pava",  d:"Nurse call escalation announced over public address where configured"},
  {a:"bms",  b:"net",   d:"BMS controller network segregated and reachable"},
];

const sysTemplate = (id)=> SYS_TEMPLATES.find(t=>t.id===id) || SYS_TEMPLATES[0];
const elvSub = (id)=> ELV_SUBS.find(s=>s.id===id) || null;
// A "check group" is anything holding an editable checklist: a system template
// OR a standalone ELV sub-system. Template-backed subs resolve to the template,
// so one admin edit serves both the single and the integrated report.
const chkGroup = (id)=> SYS_TEMPLATES.find(t=>t.id===id) || ELV_SUBS.find(s=>s.id===id) || SYS_TEMPLATES[0];
// Groups the admin can customise in Technical Classifications -> Check Lists
const chkGroups = ()=> SYS_TEMPLATES.concat(ELV_SUBS.filter(s=>s.checks));
// Best-guess mapping from a device's System field to an ELV sub-system
function elvSubForName(name){
  const n=String(name||"").trim().toLowerCase();
  if(!n) return null;
  return ELV_SUBS.find(s=>(s.match||[]).some(m=>n.includes(m))) || null;
}
// Interfaces whose BOTH endpoints are in the selected scope
function elvInterfaces(subs){
  const set=new Set(subs||[]);
  return ELV_INTEG.filter(x=>set.has(x.a)&&set.has(x.b));
}
// Effective checklist: admin-edited items for this template, else the standards defaults
function getSysCheckItems(tplId){
  const custom=(state.systemChecks||[]).filter(x=>x.template===tplId)
    .slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(x=>x.name).filter(Boolean);
  return custom.length ? custom : (chkGroup(tplId).checks||[]);
}
// Best-guess mapping from a device's System field to a report template
function sysTemplateForName(name){
  const n=String(name||"").trim().toLowerCase();
  if(!n) return null;
  return SYS_TEMPLATES.find(t=>t.match.some(m=>n.includes(m))) || null;
}
Object.assign(window,{SYS_TEMPLATES,ELV_SUBS,ELV_INTEG,sysTemplate,elvSub,chkGroup,chkGroups,
  getSysCheckItems,sysTemplateForName,elvSubForName,elvInterfaces});

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
  // An entry carrying NO status at all says nothing about whether the job is
  // still running — most legacy rows predate the technical-classification
  // fields. Treating them as "open" would flag hundreds of phantom jobs, so
  // they are marked unclassified and excluded from open/stalled counts.
  it.unclassified = !String(last.taskStatus||"").trim();
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
  parts: [],
  quotes: [], variations: [], expenses: [], invoices: [],
  advances: [], expenseReports: [], risks: [],   // uncertainty register (v211)      // work advances + reimbursement claims (v187)          // commercial documents (v179)                                 // spare-parts catalogue (v174)
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
// ═══════════════════════════════════════════════════════════════════════
//  BRANDED DIALOGS (v141) — replaces the browser's native confirm/prompt.
//  The native ones render in the OS chrome: no brand, no theme, no dark
//  mode, and they appear at the most consequential moment (deleting data),
//  which is exactly where a product should look most deliberate.
//  Promise-based, keyboard-accessible, and theme-aware.
// ═══════════════════════════════════════════════════════════════════════
function _uiSheet({title, message, okText, cancelText, danger, input, placeholder, value}){
  return new Promise(resolve=>{
    const prev = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "ui-dlg-wrap";
    wrap.innerHTML = `
      <div class="ui-dlg-bd"></div>
      <div class="ui-dlg" role="dialog" aria-modal="true" aria-label="${escapeHtml(title||"Confirm")}">
        <div class="ui-dlg-ic ${danger?"dg":""}">${danger?"⚠":"?"}</div>
        <div class="ui-dlg-t">${escapeHtml(title||"Are you sure?")}</div>
        ${message?`<div class="ui-dlg-m">${message}</div>`:""}
        ${input?`<input class="ui-dlg-in" type="text" placeholder="${escapeHtml(placeholder||"")}" value="${escapeHtml(value||"")}">`:""}
        <div class="ui-dlg-btns">
          <button class="ui-dlg-b cancel">${escapeHtml(cancelText||"Cancel")}</button>
          <button class="ui-dlg-b ok ${danger?"dg":""}">${escapeHtml(okText||"Confirm")}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(()=>wrap.classList.add("in"));
    const field = wrap.querySelector(".ui-dlg-in");
    setTimeout(()=>{ (field || wrap.querySelector(".ok")).focus(); }, 60);

    const close = (val)=>{
      wrap.classList.remove("in");
      document.removeEventListener("keydown", onKey);
      setTimeout(()=>{ wrap.remove(); try{ prev && prev.focus(); }catch(e){} }, 170);
      resolve(val);
    };
    function onKey(e){
      if(e.key==="Escape"){ e.preventDefault(); close(input?null:false); }
      if(e.key==="Enter" && (!field || document.activeElement===field)){
        e.preventDefault(); close(input ? (field?field.value:"") : true);
      }
    }
    document.addEventListener("keydown", onKey);
    wrap.querySelector(".cancel").onclick = ()=>close(input?null:false);
    wrap.querySelector(".ok").onclick     = ()=>close(input ? (field?field.value:"") : true);
    wrap.querySelector(".ui-dlg-bd").onclick = ()=>close(input?null:false);
  });
}
// Drop-in async replacements. `danger` is inferred from the wording so the
// destructive variant appears without touching every call site.
function uiConfirm(message, opts){
  const o = opts || {};
  const txt = String(message||"");
  const danger = o.danger !== undefined ? o.danger
    : /delete|remove|purge|empty|revoke|reset|clear|permanent|cannot be undone|recycle bin|discard|overwrite|replace all/i.test(txt);
  const parts = txt.split(/\n\n+/);
  const title = o.title || (parts.length>1 ? parts[0] : (danger ? "Confirm deletion" : "Please confirm"));
  const body  = (parts.length>1 ? parts.slice(1).join("<br><br>") : txt).replace(/\n/g,"<br>");
  return _uiSheet({ title, message: escapeHtml(body).replace(/&lt;br&gt;/g,"<br>"),
    okText: o.okText || (danger ? "Delete" : "Confirm"), cancelText:"Cancel", danger });
}
function uiPrompt(message, defaultValue, opts){
  const o = opts || {};
  return _uiSheet({ title: o.title || "Enter a value", message: escapeHtml(String(message||"")),
    input:true, value: defaultValue||"", placeholder:o.placeholder||"",
    okText: o.okText||"OK", cancelText:"Cancel" });
}
Object.assign(window,{uiConfirm,uiPrompt});

// ═══════════════════════════════════════════════════════════════════════
//  OFFLINE SYNC STATUS (v143)
//  Firestore already queues writes locally and replays them on reconnect —
//  what was missing is the technician KNOWING it. Someone standing in a
//  server room with no signal, having just attached six photos, needs proof
//  the work is safe. Silence is indistinguishable from data loss.
// ═══════════════════════════════════════════════════════════════════════
window._syncPending = 0;      // documents written locally, not yet acknowledged
window._syncLastOk  = null;   // when the server last confirmed everything

function isOffline(){ return typeof navigator!=="undefined" && navigator.onLine===false; }

// Called by every listener with metadata: counts collections still holding
// unacknowledged local writes.
window._syncFlags = window._syncFlags || {};
function noteSyncState(key, hasPending){
  const before = window._syncPending;
  window._syncFlags[key] = !!hasPending;
  window._syncPending = Object.values(window._syncFlags).filter(Boolean).length;
  if(before>0 && window._syncPending===0){
    window._syncLastOk = new Date();
    if(!isOffline()) toast("☁️ All changes synced");
  }
  paintSyncPill();
}
window.noteSyncState = noteSyncState;

function paintSyncPill(){
  const el = document.getElementById("syncPill");
  if(!el) return;
  const off = isOffline(), pend = window._syncPending;
  // The words are wrapped so the healthy state can hide them: "Synced" is the
  // app repeating that nothing is wrong, and on a phone that space is better
  // spent on the date. Offline and pending keep their text — those are states
  // a person needs to read, not infer from a colour.
  if(off){
    el.className = "sync-pill off";
    el.innerHTML = `<span class="sp-dot"></span><span class="sp-label">Offline${pend?` \u00b7 ${pend} queued`:""}</span>`;
    el.title = "Working offline \u2014 everything you enter is saved on this device and uploads automatically when you reconnect.";
  } else if(pend){
    el.className = "sync-pill busy";
    el.innerHTML = `<span class="sp-dot"></span><span class="sp-label">Syncing ${pend}</span>`;
    el.title = `${pend} change(s) uploading\u2026`;
  } else {
    el.className = "sync-pill ok";
    el.innerHTML = `<span class="sp-dot"></span><span class="sp-label">Synced</span>`;
    el.title = "Everything is saved to the server.";
  }
}
window.paintSyncPill = paintSyncPill;

// A save that happens offline must SAY so — "Saved ✓" while the network is
// down reads as a lie the moment the app is closed and reopened.
function saveToast(msg){
  // NOTE: this used to call saveToast() again instead of toast() — infinite
  // recursion the moment the network was down. It stayed hidden because the
  // await above it never settled offline, so execution never reached here.
  if(isOffline() || window._lastWriteLocalOnly)
    toast(`📥 ${msg} — saved on this device, will upload automatically`);
  else toast(msg);
}
window.saveToast = saveToast;

// ═══════════════════════════════════════════════════════════════════════
//  TIMESHEET APPROVAL (v144)
//  Until now an entry entered HR reports the instant it was typed: payroll
//  figures rested on unreviewed data, and a mistyped duration reached the
//  final report unchallenged. Entries now carry a review state.
//
//  Backward compatibility is deliberate: an entry with NO approval field is
//  treated as APPROVED. Hundreds of historical entries predate this feature
//  and must not vanish from reports the moment it ships.
//
//  Reports keep counting everything by default and simply DECLARE what is
//  still pending. Excluding unapproved work is a switch the admin flips when
//  the team is ready — silently changing payroll totals on upgrade day would
//  be a liability, not an improvement.
// ═══════════════════════════════════════════════════════════════════════
const APPR = { SUBMITTED:"submitted", APPROVED:"approved", REJECTED:"rejected" };
function apprOf(r){
  const v = r && r.approval;
  if(v===APPR.SUBMITTED || v===APPR.APPROVED || v===APPR.REJECTED) return v;
  return APPR.APPROVED;               // legacy entry — grandfathered
}
const isPendingAppr  = (r)=>apprOf(r)===APPR.SUBMITTED;
const isRejectedAppr = (r)=>apprOf(r)===APPR.REJECTED;
const isApprovedAppr = (r)=>apprOf(r)===APPR.APPROVED;
// Only admins / HR review, and never their own entries — self-approval would
// defeat the whole point of the control.
function canApprove(r){
  if(!(isAdmin()||isHR())) return false;
  const me = (state.profile && (state.profile.employeeName||state.profile.name)) || "";
  return !(me && r && (r.employee||"")===me);
}
function apprRequired(){
  const d=(state.settingsDocs||[]).find(x=>x.id==="approval")||{};
  return !!d.enforce;                 // OFF until the admin turns it on
}
function apprFilter(rows){ return apprRequired() ? (rows||[]).filter(isApprovedAppr) : (rows||[]); }
function apprPendingRows(rows){ return (rows||[]).filter(r=>isPendingAppr(r)||isRejectedAppr(r)); }
const APPR_STYLE = {
  submitted:{lb:"Pending review", bg:"var(--warn-bg)",   fg:"var(--warn)",   ic:"⏳"},
  approved: {lb:"Approved",       bg:"var(--ok-bg)",     fg:"var(--ok)",     ic:"✓"},
  rejected: {lb:"Returned",       bg:"var(--danger-bg)", fg:"var(--danger)", ic:"↩"},
};
// Approved legacy rows stay silent — a wall of green ticks over years of
// history is noise, not information.
function apprBadge(r, always){
  const st = apprOf(r);
  if(st===APPR.APPROVED && !always) return "";
  const s = APPR_STYLE[st];
  const why = (st===APPR.REJECTED && r.approvalNote) ? " — "+r.approvalNote : "";
  return `<span class="appr-badge" style="background:${s.bg};color:${s.fg}" title="${escapeHtml(s.lb+why)}">${s.ic} ${s.lb}</span>`;
}
async function setApproval(id, next, note){
  const r=(state.daily||[]).find(x=>x.id===id);
  if(!r) return false;
  if(!canApprove(r)){ toast("You cannot review your own entries"); return false; }
  const by=(state.profile&&(state.profile.name||state.profile.employeeName))||"";
  await fbSave("daily",{...r, approval:next, approvalNote:note||"",
    approvalBy:by, approvalAt:new Date().toISOString()});
  return true;
}
window.approveEntry = async function(id){
  if(await setApproval(id, APPR.APPROVED, "")) { saveToast("Entry approved ✓"); render(); }
};
window.rejectEntry = async function(id){
  const note = await uiPrompt("Why is this entry being returned?\n\nThe employee will see this note.",
    "", {title:"Return entry", okText:"Return", placeholder:"e.g. duration looks wrong"});
  if(note===null) return;
  if(await setApproval(id, APPR.REJECTED, String(note||"").trim())){
    saveToast("Entry returned to the employee ✓"); render();
  }
};
// Approve everything pending, across every person, in one action. The existing
// button only ever handled one employee, so a supervisor with eight people had
// to find eight buttons and confirm eight times — the repetition the feature
// was supposed to remove. This is the same machinery applied to the whole
// filtered list: one confirmation, one pass, one result.
//
// It approves exactly the rows this reviewer is entitled to see — the same set
// the Approvals screen lists, produced by the same function. Note that
// visibleRows filters by PERMISSION, not by date, so this covers everything
// pending for the people under this reviewer regardless of period. The
// confirmation therefore states the date span explicitly: signing off six weeks
// when you thought you were signing off one is the failure to prevent here.
window.pendingAllVisible = function(){
  const rows = (typeof visibleRows==="function") ? visibleRows(state.daily||[]) : (state.daily||[]);
  return rows.filter(r=>isPendingAppr(r) && canApprove(r));
};
window.approveAllPending = async function(){
  if(window._apprBusy) return toast("Still approving\u2026");
  const list = pendingAllVisible();
  if(!list.length) return toast("Nothing is waiting for approval");

  // Name the people and the span, so the person confirming knows the size of
  // what they are signing. "Approve 143 entries?" tells them nothing useful.
  const people=[...new Set(list.map(r=>(r.employee||"").trim()).filter(Boolean))].sort();
  const dates=list.map(r=>String(r.date||"")).filter(Boolean).sort();
  const span = dates.length ? (dates[0]===dates[dates.length-1]
      ? fmtDate(dates[0])
      : `${fmtDate(dates[0])} \u2192 ${fmtDate(dates[dates.length-1])}`) : "";
  const who = people.length<=6 ? people.join(", ")
            : `${people.slice(0,6).join(", ")} and ${people.length-6} more`;
  if(!await uiConfirm(
      `Approve ${list.length} pending entr${list.length===1?"y":"ies"} across ${people.length} ${people.length===1?"person":"people"}?\n\n` +
      `${who}\n${span?span+"\n":""}\n` +
      `This covers every entry awaiting your approval, not only the period on screen.`,
      {danger:false, okText:`Approve ${list.length}`, title:"Approve everything pending"})) return;

  window._apprBusy = true;
  let done=0, failed=0;
  try{
    render();
    toast(`Approving ${list.length} entr${list.length===1?"y":"ies"}\u2026`);
    // Issued together, not one after another: awaiting each server round trip
    // in turn would freeze the screen for a minute on a month's worth.
    const res = await Promise.all(list.map(r=>
      setApproval(r.id, APPR.APPROVED, "").then(ok=>ok?"ok":"fail").catch(()=>"fail")));
    done   = res.filter(x=>x==="ok").length;
    failed = res.length - done;
  } finally {
    window._apprBusy = false;
    render();
  }
  if(failed) toast(`\u26a0 ${done} approved, ${failed} failed \u2014 press again to retry the remainder`);
  else saveToast(`${done} entr${done===1?"y":"ies"} approved across ${people.length} ${people.length===1?"person":"people"} \u2713`);
};

window.approveAllFor = async function(emp){
  // This awaited each write in turn. Every write waits for its own server
  // acknowledgement, so ten entries meant seconds of a frozen-looking screen
  // with no feedback: the button appeared not to respond, and tapping again
  // started a second run. It now has a re-entrancy guard, visible progress, and
  // issues the writes together rather than one after another.
  if(window._apprBusy) return toast("Still approving\u2026");
  const list=(state.daily||[]).filter(r=>(r.employee||"")===emp && isPendingAppr(r) && canApprove(r));
  if(!list.length) return toast("Nothing pending for this person");
  if(!await uiConfirm(`Approve all ${list.length} pending entr${list.length===1?"y":"ies"} for ${emp}?`,
      {danger:false, okText:"Approve all", title:"Bulk approval"})) return;

  window._apprBusy = true;
  let done=0, failed=0;
  try{
    // Everything after the guard is set stays INSIDE the try. If render() or
    // toast() threw out here, _apprBusy would remain true for the rest of the
    // session and every later press would answer "Still approving\u2026" \u2014 the
    // button would work exactly once and then never again.
    render();                                  // repaints the button as busy
    toast(`Approving ${list.length} entr${list.length===1?"y":"ies"}\u2026`);
    const res = await Promise.all(list.map(r=>
      setApproval(r.id, APPR.APPROVED, "").then(ok=>ok?"ok":"fail").catch(()=>"fail")));
    done   = res.filter(x=>x==="ok").length;
    failed = res.length - done;
  } finally {
    window._apprBusy = false;
    render();
  }
  if(failed) toast(`\u26a0 ${done} approved, ${failed} failed \u2014 try the remainder again`);
  else saveToast(`${done} entr${done===1?"y":"ies"} approved \u2713`);
};

window.toggleApprEnforce = async function(on){
  const d=(state.settingsDocs||[]).find(x=>x.id==="approval")||{};
  await fbSave("settings",{...d, id:"approval", enforce:!!on});
  toast(on ? "🔒 Reports now count approved entries only" : "🔓 Reports count all entries again");
  render();
};
Object.assign(window,{APPR,apprOf,isPendingAppr,isRejectedAppr,isApprovedAppr,canApprove,
  apprRequired,apprFilter,apprPendingRows,apprBadge,setApproval});

// ═══════════════════════════════════════════════════════════════════════
//  OFFLINE BOOT GUARD (v145)
//  A Firestore write promise resolves only when the SERVER acknowledges it.
//  Offline, the data is applied to the local cache instantly but the promise
//  never settles — so `await claimSession(...)` on the boot path hung forever
//  and the app sat on its spinner. Nothing after it ever ran.
//
//  Every boot-path call is now raced against a short deadline: the work still
//  happens (and syncs later), it just cannot block the launch.
// ═══════════════════════════════════════════════════════════════════════
function bootRace(promise, ms, fallback){
  return Promise.race([
    Promise.resolve(promise).catch(()=>fallback),
    new Promise(res=>setTimeout(()=>res(fallback), ms))
  ]);
}
window.bootRace = bootRace;

// ═══════════════════════════════════════════════════════════════════════
//  LOCAL SESSION SNAPSHOT (v158)
//  Firebase Auth is supposed to restore the signed-in user from IndexedDB with
//  no network. On some Android/Chrome builds it simply does not — the listener
//  never fires and auth.currentUser stays null, so a technician with a full
//  local database is left staring at "Restoring your session…".
//
//  So we stop depending on it: every successful sign-in writes a small snapshot
//  of WHO is signed in. If Firebase goes quiet while offline, we restore from
//  our own copy and open the app on the cached data. Firestore's local cache
//  answers reads without needing a fresh token, so everything still works.
//
//  This is identity for OFFLINE READING only. It grants nothing on the server:
//  any write still carries a real Firebase token, and security rules are
//  untouched. Without a valid token the server simply rejects it.
// ═══════════════════════════════════════════════════════════════════════
const LOCAL_SESSION_KEY = "girek-session-v1";
function saveLocalSession(user, profile){
  try{
    if(!user || !profile) return;
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({
      uid:user.uid, email:user.email||"", profile, at:Date.now()
    }));
  }catch(e){}
}
function readLocalSession(){
  try{
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s || !s.uid || !s.profile) return null;
    // 30 days: long enough for any field rotation, short enough to expire a
    // device that stopped being used.
    if(Date.now() - (s.at||0) > 30*24*3600*1000) return null;
    return s;
  }catch(e){ return null; }
}
function clearLocalSession(){ try{ localStorage.removeItem(LOCAL_SESSION_KEY); }catch(e){} }
Object.assign(window,{saveLocalSession,readLocalSession,clearLocalSession});

// When the app opens offline on a partial cache, every figure reads zero and
// looks like a data-loss bug. Say what is actually missing instead.
function partialDataNotice(){
  try{
    if(!state.offlineSession && navigator.onLine !== false) return "";
    const loaded = window._loadedCols ? window._loadedCols.size : 0;
    const total  = window._totalCols || 0;
    if(!total || loaded >= total) return "";
    return `<div class="card" style="border-left:4px solid var(--warn);background:var(--warn-bg)">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:var(--f-2xl)">📴</span>
        <div style="flex:1;min-width:180px">
          <div style="font-size:var(--f-lg);font-weight:800;color:var(--warn-ink)">Showing ${loaded} of ${total} data sets</div>
          <div style="font-size:var(--f-sm);color:var(--warn-ink);opacity:.85;margin-top:2px;line-height:1.55">The rest was not saved on this device yet. Figures below cover only what is here — connect once and everything fills in.</div>
        </div>
      </div></div>`;
  }catch(e){ return ""; }
}
window.partialDataNotice = partialDataNotice;

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
// v128 — SELF-HEALING date roll (replaces the v107 "catch the moment" watcher,
// which only worked if you happened to be standing on the Daily Log tab at
// midnight, and latched itself shut afterwards).
//
// Instead we track INTENT: a date the app filled in carries `dateAuto:true`;
// the moment the user picks a date themselves the flag is cleared forever.
// Any auto date that is no longer today gets rolled forward the next time the
// form renders — so it self-corrects whatever tab you were on, whether the app
// slept through midnight, was killed, or ran for a week.
function rollAutoDate(form){
  try{
    if(!form || !form.dateAuto) return false;
    const t=today();
    if(form.date===t) return false;
    // A same-day travel range must move BOTH ends together
    const single = form.dateTo && form.dateTo===form.date;
    form.date=t;
    if(single) form.dateTo=t;
    return true;   // caller decides whether to notify
  }catch(e){ return false; }
}
window.rollAutoDate=rollAutoDate;
function _checkDayRollover(){
  try{
    const t=today();
    if(t===window._lastKnownDay) return;
    window._lastKnownDay=t;
    let hit=false;
    [dailyForm,otForm,trForm].forEach(f=>{ if(rollAutoDate(f)) hit=true; });   // lexical bindings — same objects the renderers mutate
    if(hit){ saveToast("📅 New day — date updated automatically"); }
    render();
  }catch(e){}
}
window._lastKnownDay = window._lastKnownDay || today();
setInterval(_checkDayRollover, 60000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) _checkDayRollover(); });
window.addEventListener('focus', ()=>_checkDayRollover());
const fmtDate=(d)=>d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"}):"—";
const fmtMoney=(n)=>n==null||n===""?"—":Math.round(Number(n)||0).toLocaleString();
const fmtHM=(hrs)=>{
  if(!hrs||isNaN(hrs))return "0:00";
  const h=Math.floor(hrs),m=Math.round((hrs-h)*60);
  return m===60?`${h+1}:00`:`${h}:${m.toString().padStart(2,"0")}`;
};
// A trip is a RANGE. Legacy rows stored only a start date + a day count, so the
// end date is derived when it is missing — otherwise a 4-day trip starting on
// the 19th showed as a bare "19" with no end in sight.
function trEnd(r){
  if(r.dateTo) return r.dateTo;
  const n = Number(r.days||0);
  if(!r.date || n<=1) return r.date||"";
  const d = new Date(r.date+"T00:00:00");
  if(isNaN(d)) return r.date||"";
  d.setDate(d.getDate()+n-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function trRangeText(r){
  const to = trEnd(r);
  return (to && to!==r.date) ? `${r.date} → ${to}` : (r.date||"");
}
window.trEnd=trEnd; window.trRangeText=trRangeText;

const timeToHrs=(s,e)=>{
  if(!s||!e)return 0;
  const[sh,sm]=s.split(":").map(Number),[eh,em]=e.split(":").map(Number);
  let mins=(eh*60+em)-(sh*60+sm);
  if(mins<0) mins+=24*60;  // overnight shift: end time is on the next calendar day
  return mins/60;
};
const dayName=(d)=>d?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(d).getDay()]:"";

// Format a day count cleanly: 4.2222… → "4.2", 5 → "5", 4.0 → "4"
// Two hours of leave is 2/9ths of a working day, and printing "0.2222222222"
// — or even "0.22" — tells nobody anything. A part-day is best expressed in the
// unit it was actually taken in: hours. Whole days stay whole days, a half day
// says so, and anything else is stated in hours, which is what the person
// requested and what payroll checks against.
function fmtDays(n){
  const v = Number(n) || 0;
  if(!v) return "0";
  if(Number.isInteger(v)) return String(v);
  const wh = (typeof WORK_HOURS_PER_DAY==="number" && WORK_HOURS_PER_DAY>0) ? WORK_HOURS_PER_DAY : 8;
  const whole = Math.floor(v);
  let frac    = v - whole;
  // Floating-point arithmetic leaves specks: 4.0000000001 days should read as
  // "4", not "4d 0:00". Anything under a rounded minute is noise, not leave.
  const wh0 = (typeof WORK_HOURS_PER_DAY==="number" && WORK_HOURS_PER_DAY>0) ? WORK_HOURS_PER_DAY : 8;
  if(frac * wh0 * 60 < 1) return String(whole);
  if((1-frac) * wh0 * 60 < 1) return String(whole+1);
  // A half day is a recognised unit in its own right; say it rather than
  // rendering it as a decimal.
  const isHalf = Math.abs(frac - 0.5) < 0.02;
  const hrs = Math.round(frac * wh * 100) / 100;
  const hLabel = (Math.abs(hrs - Math.round(hrs)) < 0.01)
    ? `${Math.round(hrs)}h`
    : `${(typeof fmtHM==="function") ? fmtHM(hrs) : hrs.toFixed(1)+"h"}`;
  if(whole === 0) return isHalf ? "\u00bd day" : hLabel;
  return isHalf ? `${whole}\u00bd` : `${whole}d ${hLabel}`;
}
// The same value where only a number is acceptable — a spreadsheet cell, a
// column that is summed. Rounded to two places so it stays addable.
function daysNum(n){
  const v = Number(n) || 0;
  return Math.round(v * 100) / 100;
}
Object.assign(window,{daysNum});

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
// ═══ TEACHING EMPTY STATES (v196) ═══════════════════════════════════════
// An empty screen is the first thing a new user sees, and "No devices yet."
// tells them nothing they had not already worked out. With 37 screens and no
// tour, these blank moments are the only place the app can explain itself — so
// each one now says what the screen is FOR, why it matters, and offers the one
// action that fills it.
//
// Deliberately NOT a tour or a walkthrough: those interrupt people who already
// know the app. This teaches only at the exact moment someone is stuck, and
// disappears the instant there is data.
function emptyState(o){
  o = o || {};
  const icon  = o.icon || "\u{1F4ED}";
  const title = o.title || "Nothing here yet";
  const why   = o.why || "";
  const steps = Array.isArray(o.steps) ? o.steps : [];
  const act   = o.action;             // {label, onclick}
  const hint  = o.hint || "";
  return `<div class="empty-teach">
    <div class="et-ic">${icon}</div>
    <div class="et-title">${escapeHtml(title)}</div>
    ${why?`<div class="et-why">${escapeHtml(why)}</div>`:""}
    ${steps.length?`<ol class="et-steps">${steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ol>`:""}
    ${act&&act.label?`<button class="btn btn-primary et-act" onclick="${escapeHtml(act.onclick||"")}">${escapeHtml(act.label)}</button>`:""}
    ${hint?`<div class="et-hint">${escapeHtml(hint)}</div>`:""}
  </div>`;
}
// A filter that hides everything is a different problem from having no data at
// all, and the fix is different too: widen the filter, not create a record.
// Telling someone to "add your first project" when they have fifty is the kind
// of wrong help that erodes trust in every other message the app shows.
function emptyFiltered(what, clearFn){
  return `<div class="empty-teach">
    <div class="et-ic">\u{1F50D}</div>
    <div class="et-title">No ${escapeHtml(what)} match the current filters</div>
    <div class="et-why">There is data here \u2014 the period or the filters you have set are hiding it.</div>
    ${clearFn?`<button class="btn btn-secondary et-act" onclick="${escapeHtml(clearFn)}">Clear the filters</button>`:""}
    <div class="et-hint">Check the period in the header first; it applies to most screens.</div>
  </div>`;
}
Object.assign(window,{emptyState, emptyFiltered});

const escapeHtml=(s)=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
// Passing a value as an ARGUMENT to an inline handler is a different problem
// from displaying it. The browser decodes HTML entities in an attribute BEFORE
// the JS parser runs, so escapeHtml's &#39; becomes a bare apostrophe again and
// terminates a single-quoted JS string: the handler dies with a SyntaxError and
// the button silently does nothing at all. JSON.stringify produces a correctly
// quoted and escaped JS literal, and escaping THAT keeps the attribute intact —
// after decoding, the parser sees exactly the original string.
//   Use as:  onclick="fn(${jsArg(name)})"   \u2014 supply no quotes of your own.
const jsArg=(v)=>escapeHtml(JSON.stringify(v===undefined?null:v));
window.jsArg = jsArg;

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
// Operational attention signals \u2014 critical incidents, maintenance due, stalled
// work \u2014 are a supervisor's concern. An ordinary field employee should see
// their own day, not the whole operation's problems. Admins and the ops roles
// always see them; a plain employee sees them only if their admin ticks the box
// in Users. Anyone who is not an employee is unaffected.
function canSeeOpsAlerts(){
  if(isAdmin() || isSupport() || getUserRole()==="hr") return true;
  if(getUserRole()==="employee") return !!(state.profile && state.profile.canOpsAlerts);
  return true;
}
Object.assign(window,{canSeeOpsAlerts});
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
  // Nametag entries were added unconditionally, so a subcontractor recorded
  // once for a single job appeared in EVERY employee picker for ever. They now
  // follow exactly the same rule as user accounts above: the explicit
  // isTrackedEmployee flag wins, and where it has never been set, an entry
  // marked type:"external" is excluded by default just as a non-employee role
  // is. One concept, one flag, set in one place \u2014 Database \u2192 Users.
  const fromNametags = (state.nametagEmployees || [])
    .filter(n => {
      if(n.isTrackedEmployee === true)  return true;
      if(n.isTrackedEmployee === false) return false;
      return String(n.type||"").toLowerCase() !== "external";
    })
    .map(n => (n.name || "").trim()).filter(Boolean);
  let merged = Array.from(new Set([...EMPLOYEES_DEFAULT, ...fromUsers, ...fromNametags]));

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
    return `<span style="display:inline-flex;align-items:center;gap:5px;color:#7F4A00;font-weight:700">${safe}<span style="background:linear-gradient(135deg,#FF9800 0%,#FFB74D 100%);color:#fff;padding:1px 7px;border-radius:8px;font-size:9px;font-weight:800;letter-spacing:0.5px;box-shadow:0 1px 3px rgba(0,0,0,0.15)">EXT</span></span>`;
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
  return `<div style="background:linear-gradient(135deg,#F0F4FA 0%,#E8F0F9 100%);border:1.5px solid #2E5FA3;border-radius:12px;padding:12px 14px;margin-bottom:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:${sel.length>0?'8px':'0'};flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">🔎</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1B3A6B">${escapeHtml(label||"Filter Report")}</div>
          <div style="font-size:11px;color:#2E5FA3">${allSelected ? `All ${emps.length} employees` : `${sel.length} of ${emps.length} selected`}${branchF?` · 🏙️ ${escapeHtml(branchF)}`:''}${empDeptF?` · 👥 ${escapeHtml(empDeptF)}`:''}${taskDeptF?` · 🗂️ ${escapeHtml(taskDeptF)} tasks`:''}${projF?` · 📁 ${escapeHtml(projF)}`:''}${locF?` · 📍 ${escapeHtml(locF)}`:''}${workTypeF?` · 🔧 ${escapeHtml(workTypeF)}`:''}${statusF?` · 📊 ${escapeHtml(statusF)}`:''}${categoryF?` · 📁 ${escapeHtml(categoryF)}`:''}${subcatF?` · ↳ ${escapeHtml(subcatF)}`:''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:var(--card);border:1.5px solid var(--line);color:#2E5FA3;font-weight:700" onclick="openEmployeeFilterModal()">
          👥 ${allSelected ? 'Employees' : 'Edit'}
        </button>
        ${(!allSelected||projF||locF||branchF||empDeptF||taskDeptF||workTypeF||statusF||categoryF||subcatF) ? `<button class="btn btn-sm" style="background:var(--card);border:1.5px solid var(--line);color:#C53030;font-weight:700" onclick="clearAllReportFilters()">✕ Clear All</button>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button onclick="editPeriod(event)" style="flex:1;min-width:140px;padding:7px 10px;border:1px solid #C9A84C;border-radius:8px;font-size:12px;background:${(getPeriodFrom()||getPeriodTo())?'#FFF8E8':'white'};color:#1B3A6B;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:6px;font-family:inherit">📅 ${escapeHtml(getPeriod())}${(getPeriodFrom()||getPeriodTo())?' ✕':''}</button>
      ${allBranches.length>0?`<select onchange="window.setGlobalBranchFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B;font-weight:600">
        <option value="">🏙️ All Branches</option>
        ${allBranches.map(b=>`<option value="${escapeHtml(b)}" ${b===branchF?"selected":""}>${escapeHtml(b)}</option>`).join("")}
      </select>`:''}
      ${allEmpDepts.length>0?`<select onchange="window.setGlobalEmpDeptFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B;font-weight:600">
        <option value="">👥 All Staff Depts</option>
        ${allEmpDepts.map(d=>`<option value="${escapeHtml(d)}" ${d===empDeptF?"selected":""}>${escapeHtml(d)} staff</option>`).join("")}
      </select>`:''}
      ${allTaskDepts.length>0?`<select onchange="window.setGlobalTaskDeptFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B;font-weight:600">
        <option value="">🗂️ All Task Depts</option>
        ${allTaskDepts.map(d=>`<option value="${escapeHtml(d)}" ${d===taskDeptF?"selected":""}>${escapeHtml(d)} tasks</option>`).join("")}
      </select>`:''}
      <select onchange="window.setGlobalProjectFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B">
        <option value="">📁 All Projects</option>
        ${allProjects.map(p=>`<option value="${escapeHtml(p)}" ${p===projF?"selected":""}>${escapeHtml(p)}</option>`).join("")}
      </select>
      <select onchange="window.setGlobalLocationFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B">
        <option value="">📍 All Locations</option>
        ${allLocations.map(l=>`<option value="${escapeHtml(l)}" ${l===locF?"selected":""}>${escapeHtml(l)}</option>`).join("")}
      </select>
      ${allWorkTypes.length>0?`<select onchange="window.setGlobalWorkTypeFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B;font-weight:600">
        <option value="">🔧 All Work Types</option>
        ${allWorkTypes.map(w=>`<option value="${escapeHtml(w)}" ${w===workTypeF?"selected":""}>${escapeHtml(w)}</option>`).join("")}
      </select>`:''}
      ${allStatuses.length>0?`<select onchange="window.setGlobalTaskStatusFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B;font-weight:600">
        <option value="">📊 All Statuses</option>
        ${allStatuses.map(s2=>`<option value="${escapeHtml(s2)}" ${s2===statusF?"selected":""}>${escapeHtml(s2)}</option>`).join("")}
      </select>`:''}
      ${allCategories.length>0?`<select onchange="window.setGlobalCategoryFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B;font-weight:600">
        <option value="">📁 All Categories</option>
        ${allCategories.map(c=>`<option value="${escapeHtml(c)}" ${c===categoryF?"selected":""}>${escapeHtml(c)}</option>`).join("")}
      </select>`:''}
      ${allSubcats.length>0?`<select onchange="window.setGlobalSubcategoryFilter(this.value)" style="flex:1;min-width:140px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:12px;background:var(--card);color:#1B3A6B;font-weight:600">
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
          return `<span style="background:${bg};color:${fg};padding:3px 10px;border-radius:16px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px">
            ${escapeHtml(e)}${isExt ? '<span style="font-size:9px;background:rgba(0,0,0,0.15);padding:1px 4px;border-radius:4px">EXT</span>' : ''}
            <button onclick="toggleEmployeeFilter(${jsArg(e)});event.stopPropagation()" style="background:rgba(255,255,255,0.3);border:none;color:inherit;width:16px;height:16px;border-radius:50%;cursor:pointer;font-weight:900;font-size:10px;line-height:1;padding:0;display:inline-flex;align-items:center;justify-content:center">×</button>
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
    <div style="background:var(--card);border-radius:16px;max-width:560px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.4)">
      <div style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;padding:16px 20px;border-radius:16px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11px;letter-spacing:2px;color:#C9A84C;font-weight:700">FILTER</div>
          <div style="font-size:16px;font-weight:700;margin-top:2px">Select Employees</div>
        </div>
        <button onclick="document.getElementById('empFilterOverlay').remove()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;font-weight:700">×</button>
      </div>
      <div style="padding:14px 20px;background:#F7FAFC;border-bottom:1px solid #E0E6ED;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:#2E5FA3;color:white;border:none;font-weight:700" onclick="filterSelectAll()">✓ Select All (${emps.length})</button>
        <button class="btn btn-sm" style="background:var(--card);border:1px solid #2E5FA3;color:#2E5FA3;font-weight:700" onclick="filterSelectInternal()">👤 Internal Only</button>
        <button class="btn btn-sm" style="background:var(--card);border:1px solid #FF9800;color:#7F4A00;font-weight:700" onclick="filterSelectExternal()">[EXT] External Only</button>
        <button class="btn btn-sm" style="background:var(--card);border:1px solid #C53030;color:#C53030;font-weight:700" onclick="filterClearAll()">✕ Clear</button>
      </div>
      <div id="empFilterList" style="flex:1;overflow-y:auto;padding:10px 16px;max-height:400px">
        ${sorted.map(e => {
          const isExt = isExternalEmployee(e);
          const checked = sel.length === 0 ? false : sel.includes(e);
          return `<label style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid ${checked?'#2E5FA3':'#E0E6ED'};border-radius:8px;background:${checked?'#F0F4FA':'white'};cursor:pointer;margin-bottom:6px;transition:all 0.15s" onclick="event.stopPropagation()">
            <input type="checkbox" ${checked?'checked':''} onchange="toggleEmployeeFilter(${jsArg(e)},true)" style="width:18px;height:18px;cursor:pointer;accent-color:#2E5FA3">
            <span style="flex:1;font-size:13px;font-weight:600;color:#1A202C">${escapeHtml(e)}</span>
            ${isExt ? '<span style="background:linear-gradient(135deg,#FF9800 0%,#FFB74D 100%);color:#fff;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:800;letter-spacing:0.5px">EXT</span>' : '<span style="background:#E8F5E9;color:#2F855A;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;letter-spacing:0.5px">INTERNAL</span>'}
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
// If the SDK itself could not load, say so plainly. An endless spinner with no
// explanation is the worst possible failure mode for someone standing on site.
function showSdkOffline(msg){
  renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center">
    <div style="font-size:34px">📡</div>
    <h2 style="margin-top:10px">Offline — first launch needs a connection</h2>
    <div class="sub" style="margin-top:8px;line-height:1.7">Girêk stores everything on your device, but the very first launch has to download its engine once.<br><br>Connect to the internet and open the app one time; after that it will start with no signal at all.</div>
    <button class="login-btn" onclick="location.reload()" style="margin-top:18px">Try again</button>
    ${msg?`<div style="font-size:var(--f-2xs);color:var(--muted);margin-top:12px">${escapeHtml(String(msg))}</div>`:""}
  </div></div>`);
}
window.showSdkOffline = showSdkOffline;
// Watchdog: if 'fb-ready' never arrives at all (the module file itself is
// missing from the cache), nothing downstream can ever run.
// Last line of defence. If the page is still blank after 20 seconds — for ANY
// reason, including one nobody has thought of yet — say something rather than
// leave a technician staring at nothing.
window._bootWatchdog = setTimeout(()=>{
  if(window._bootHandled || state.initialized) return;
  const why = (window.__fb && window.__fb.sdkError) ? window.__fb.sdkError
            : !window.__fb ? "the engine file did not run"
            : "startup did not finish";
  showSdkOffline(why);
}, 20000);

window.addEventListener('fb-ready',()=>{
  window._bootHandled = true;
  clearTimeout(window._bootWatchdog);
  if(window.__fb.sdkError){ showSdkOffline(window.__fb.sdkError); return; }
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
  renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center"><div style="font-size:28px">📡</div><div class="sub" style="margin-top:10px">Loading live view…</div></div></div>`);
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
    <div style="font-size:28px">🔗</div>
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
      <div style="width:40px;height:40px;border-radius:12px;background:#03308B;display:flex;align-items:center;justify-content:center;color:#C9A84C;font-weight:900;font-size:13px;border:1.5px solid #C9A84C">EJAF</div>
      <div style="flex:1">
        <div style="color:#fff;font-family:'DM Serif Display',serif;font-size:16px">${escapeHtml(d.clientName||"Client")} — Live Project View</div>
        <div style="color:#9FB6D2;font-size:10px">EJAF Technology · Girêk Operations</div>
      </div>
      <div style="text-align:right">
        <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(46,125,50,.25);color:#A5D6A7;font-size:10px;font-weight:800;padding:3px 10px;border-radius:12px;border:1px solid rgba(165,214,167,.4)"><span style="width:7px;height:7px;border-radius:50%;background:#66BB6A;display:inline-block;animation:cfade 1.2s ease-in-out infinite alternate"></span>LIVE</span>
        <div style="color:#9FB6D2;font-size:9px;margin-top:3px">Updated ${escapeHtml(d.updatedLabel||"")}</div>
      </div>
    </div>
    <div style="max-width:680px;margin:0 auto;padding:16px">
      ${P.length===0?`<div style="background:var(--card);border-radius:16px;padding:30px;text-align:center;color:#888">No projects shared yet.</div>`:P.map(p=>`
      <div style="background:var(--card);border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,.25);margin-bottom:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="color:#fff;font-family:'DM Serif Display',serif;font-size:18px">${escapeHtml(p.name)}</div>
          ${p.status?`<span style="background:rgba(201,168,76,.25);color:#F0D68A;font-size:10px;font-weight:800;padding:3px 10px;border-radius:12px">${escapeHtml(p.status)}</span>`:""}
        </div>
        <div style="padding:14px 16px">
          ${p.estHours?`
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;font-weight:700;margin-bottom:5px"><span>PROGRESS — WORKED HOURS</span><span>${p.hours} / ${p.estHours} h (${p.pct}%)</span></div>
          <div style="height:9px;background:#E8EDF5;border-radius:8px;overflow:hidden;margin-bottom:14px"><div style="height:100%;width:${Math.min(100,p.pct)}%;background:linear-gradient(90deg,#C9A84C,#E9CC7A);border-radius:8px"></div></div>`
          :`<div style="font-size:12px;color:#555;margin-bottom:12px">⏱ <strong>${p.hours}</strong> work hours logged · <strong>${p.sessions}</strong> field sessions</div>`}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <div style="flex:1;min-width:90px;background:#F5F8FC;border-radius:8px;padding:9px;text-align:center"><div style="font-family:'DM Serif Display',serif;font-size:18px;color:#1B3A6B">${p.devices}</div><div style="font-size:9px;color:#888;font-weight:700;text-transform:uppercase">Devices</div></div>
            <div style="flex:1;min-width:90px;background:#F5F8FC;border-radius:8px;padding:9px;text-align:center"><div style="font-family:'DM Serif Display',serif;font-size:18px;color:#2E7D32">${p.pmDone}</div><div style="font-size:9px;color:#888;font-weight:700;text-transform:uppercase">PM rounds done</div></div>
            <div style="flex:1;min-width:90px;background:#F5F8FC;border-radius:8px;padding:9px;text-align:center"><div style="font-family:'DM Serif Display',serif;font-size:18px;color:${p.openReq?'#E65100':'#5B6C86'}">${p.openReq}</div><div style="font-size:9px;color:#888;font-weight:700;text-transform:uppercase">Open requests</div></div>
          </div>
          ${(p.locations||[]).length?(()=>{const mx=Math.max(...p.locations.map(l=>l.hours),0.1);return `
          <div style="font-size:10px;color:#888;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin:2px 0 7px">Work hours by location</div>
          ${p.locations.map(l=>`<div style="display:flex;align-items:center;gap:9px;margin-bottom:6px">
            <div style="width:112px;font-size:11px;color:#333;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${escapeHtml(l.name)}</div>
            <div style="flex:1;height:8px;background:#E8EDF5;border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.max(4,Math.round(l.hours/mx*100))}%;background:linear-gradient(90deg,#2E5FA3,#5E9BFF);border-radius:4px"></div></div>
            <div style="width:58px;text-align:right;font-size:11px;color:#1B3A6B;font-weight:800">${l.hours} h</div>
          </div>`).join("")}
          <div style="margin-bottom:12px"></div>`;})():""}
          ${(p.sites||[]).length?`
          <div style="font-size:10px;color:#888;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Field sites</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
            ${p.sites.map(s=>`<span style="background:#F0F4FF;color:#03308B;border:1px solid #D6E0F5;font-size:10px;font-weight:700;padding:4px 10px;border-radius:12px">${escapeHtml([s.area,s.site].filter(Boolean).join(" › "))} · ${s.devices} dev</span>`).join("")}
          </div>`:""}
          ${(p.workItems||[]).length?`
          <div style="font-size:10px;color:#888;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Work items${p.openJobs?` — ${p.openJobs} open`:""}</div>
          ${p.workItems.map(w=>`<div style="border:1px solid #EDF1F7;border-radius:8px;padding:9px 11px;margin-bottom:7px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:12px;font-weight:700;color:#1B3A6B">${escapeHtml(w.title)}${w.scope?` <span style="font-weight:500;color:#8A9AB0">· ${escapeHtml(w.scope)}</span>`:""}</span>
              <span style="font-size:9px;background:${w.closed?'#E8F5E9':'#FFF3E0'};color:${w.closed?'#2E7D32':'#E65100'};padding:2px 9px;border-radius:8px;font-weight:800">${escapeHtml(w.status)}</span>
            </div>
            ${(w.journey||[]).length>1?`<div style="margin-top:6px;display:flex;align-items:center;flex-wrap:wrap">
              ${w.journey.map((j,i)=>`${i?`<span style="color:#C4D0E0;margin:0 4px;font-size:10px">→</span>`:""}<span style="font-size:10px;color:#5A6B80;background:#F5F8FC;padding:2px 7px;border-radius:8px">${escapeHtml(j.s)} <span style="color:#9AAABF">${fmtD(j.d)}</span></span>`).join("")}
            </div>`:""}
            <div style="margin-top:5px;font-size:10px;color:#9AAABF">${w.visits} visit${w.visits>1?"s":""} · ${fmtD(w.first)}${w.visits>1?` → ${fmtD(w.last)}`:""}</div>
          </div>`).join("")}
          <div style="margin-bottom:10px"></div>`:""}
          ${(p.recent||[]).length?`
          <div style="font-size:10px;color:#888;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Latest activity</div>
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
    <div class="login-logo"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAjkklEQVR4nO2deZQkVZ3vP/dGRK6VtVd1d3V3VXVDN8vAIIqiMOgwKiPoGcdtHuOGM/oc9YjHUWccx/Wo7+FzHcd3eMM8BRT1KMroQwUBBQHZ971puukVmt5qz6zMWO59f0REVnV3LZlZlVldnfdzgOZkx3Ij4ve9y+/+7u8K60VfY4nRS10Aw5IjlurG9hLc0xi84XAOt4mGCaJRAjBGb6iG6fZSVzHUWwDG8A0LJbahugihXgIwhm9YbOoihMUWgDF8Q71ZVCEslgCM4RsazaIIQS5iQQyGpWBB9rdQARjjNxwN1GyHtXaBjOEbjjZq6hLV0gIY4zcczVRln9UKwBi/YTlQsZ1WIwBj/IblREX2WqkAjPEbliPz2u1iuEENhmVLJQIwtb9hOTOn/c4nAGP8hmOBWe14LgEY4zccS8xoz2YMYGhqZhOAqf0NxyJH2LVpAQxNzUwCMLW/4VjmEPs2LYChqTlcAKb2NzQDZTs3LYChqZkuAFP7G5oJDaYFMDQ5RgCGpiYWgOn+GJoRbVoAQ1NjBGBoaowADE2NxPT/DU2MaQEMTY0RgKGpMQIwNDVGAIamxgjA0NQYARiaGiMAQ1NjBGBoaowADE2NEYChqTECMDQ1RgCGpsYIwNDUGAEYmhojAENTYwRgaGqMAAxNTa0bZVeFlAIpqtq/eFHQWhOo+Re8CSGw5MLLp4EgUFWdY1uNqYMCpdG6+sV/jSrf4VT67RZK/QUgBF7eBdcP9/BuxALM+D6OhZVNzH1PAb4X4OdLCy+fJbFakhUfrrWmNFyAGgyzYuJnyiSwEnZV91JKUxqrc/kOp5pvtwjUVQBSCvxJj7e+4SRecWofvlINaQmU0tiW4LEtB/j+fz2OnbRRM3zEsHw+f3JiF3//xlPxla6pfFprpBTsHSrwzavuByXCDzkLQkAQaHIZh0988CwyqbB8Yq6TakRpjS0FV/3mSR55fC922kbN00gJAYGvaW9L8vGLzybpWGg95yMtXnmjb/fEtoNc8bNHsZJOTS1XpdRXAEKgiz5v+ouNvP2Ck+t5qxm56e5tXPmThxApZ8ZaTAiBdn1OXNfBxy46c8H323Nggm9d9QCKubMNCCHQns+ale189h/OXvB9K2H/cIGH79+NzCRQzK0AgUCrgLasw6ffd1ZDync4tz2wk8t//BAy5RDUsRVoQBcIxgsufqDwA9WQPmUQKCxLMpZ3w+psnvK5bli2QOmaxgJKhS3A0GixouMFAnzFqp4WgkATKIVchDHITMTvfHBNe9UuD6U1o/kS2ZQTtgANaAKCQGNZgpGJCr7dItCwQXBs+I0QgAAsS1ZszEKE5RKiRgGIUACWVfn9CDT9q1qxLIFG1O29CMJybezvAMeasSs4F7YlsS3ZMAEIQgEshlOiEowbdKnQmsFVrXW/jYi+8NpVbaSySYJANaQvv1wwAlgqJBy3tr3ut4kH1iu7MnR1pFC+akxVvkwwAlgCAqUhaTHY1waEg+J6IUQ4/m/JJFnTmwNfGfufhhFAgxECAqVIZxKs6mkt/1ZPVOT3PL6/DfxgSSYlj1aMABqOQPuazvYUvZ3p6Jf6GmQ87D2+vwsaMLu6nDACaDChByhgRWeWlkxy6rcGcHx/O0hhsiFPwwigwQgRzgEM9LUANCTeJR5jrOtrg4SFMq1AGSOABiMAAs36NR0AdZ3mL98zamH6+3JkWxOhK9QMA4AGTYQtFkprVDB/UEoQqDAy82it6YQue4Aacrvoha3oytLX3cIz20YQlo1uYGco/ibzH6fRiIZ9u2UkgDBQTdrzV13xrGpbS7KxkYwVoLUGW9IfTYLVXhHris8WIgzXSNgOa1e28swzBxEpu6Fbo1gVznTbVvhne4O+3bIQQBhrA7c/sJ1rbniKZDoxZw2hdfgiN+8YRSadqqf/60mgNCJps2ZFDqhtDsD1fSwhsCyr4nOU1kgE69e0cXOgovvW972EEtVoDV+78i727J/AsecOxwi/nWbrrnFkov7fbnkIQGskkrsefZ5vf/126GqBShaeOBIrm2hIP7sShBD4gaI9l2B1byyAys9XOmwFt+48QEdblpVduapjdNavbW9cq6gBIVBa8+0fPcTzT+2HtFOZK9aWWC2Juhd1WQggJpN2sLuzJDsy+BUIoFGriipFCMALWNHdRnd7Jv614vN1ZO2PbznIScdZoQCobB1BfMSJg51giYZXCp3tafZ1ZnHSdkVeqGNnRdgiopTG9xVWFFq93Ag9QIq+nhyWJcs1eqXENvvMjhH6eqNAugqHAmVX6JoORCpRUQO6mATRNxOBOqrcsMYN2kCEEFEYdNj90TUawtbdI4xNlMJrVHzv8M++nhY62pIEQWBcoRgBNB6tymHQ1Zp/XIvv3DPGaCSAijvJ0bldbWlWdmejoDijACOARiME69a013RqvEZkz/48I2NVtgCEXUjLkgysMlGhMUYADUQpDQmL9ZEAqqmBdXS80oq9Q3mGxypbfnnI/aPWYsNgZygAszTGCKBRhCFAmmQmwaqe6l2gcVU/ni8xPFpidMKtuSwb1nY2JsXDMsAIoGEItK/oakvR25mJfqnSBQqMjJUICi6jE9W3APHdjlvTBrY8qiYIlwojgAYRhkErersy5LKJqd8qJDbVg6OT4AYMj4djgGpEFHe5Bla3YmechrtCj0aW1TyAECLM9mDJeQd/SqmjKgwoDIMO6F/RgoiCvarKfBA9y4GRSfA1o+NudN1qyhD+ubo3R1d7ir0HJrEdqyGTYpaU5W8nxNz3a+S3W1YCKJU8gpECBSuMqZ8VAaQTWLZsaMDXXJTDoKOF8KHRVTMIDo/fPxSmKoznAaoZSAsRzgC3taTpX9nK3j0TiIRVZ2MLLz46PkkwkicozRMKITSkkw37dstCAGFNqfmrczfSd2ULTsKetdbSGiwh+Oyld/L05oPYqZnTIi4JQjO4umNBl9g3PAkCxiaKBEphSVlFXGhoe5aAgb5W7rt/d12D4kJtCqSAyz53HiPjpSgqdLZvF7aKX7j0Lp58+gB2ygTDAZQ/0saBbjYOdFd0znd+8jCb/H0I0diw39nQGrAkA3EmiBqvs39oEmSY9a5Q9MhlorDhCluCuOVZv7YdlG6IM0gIOP/PNlR8/H9c/RhPPLGPBgSsLg8BhIRRhWqejxYHjPl+g1KZVYjSYRh0/4pwKWSts7AHhsfBshjP+4znS+QyyapagJgN/e1hd6NBxOnZ5yqn0hohBJ6vGuamXUYCCJPtynnSD+roJR5Fth9lg1a05BKs7Gkp/1bdNcIT9g0XwJYUiiVGx4v09bRWszamfJ0N/Z01pUqslbAbO3chRRQc2MhvZ9ygDUBEcwAruzL0dFQfBg1TYRD7h4tgSUolxUjkCarGhGPjGuhrI51L4Td5SIQRQAMQAvAD+npzOLYVtVKVnz89DGJ0vAS2BF8xMl6aOqDSskTC6+3M0tOZRgeKZp4WNgJoAOUw6JVhFGjV8fDR4ZNFn7G8i7AEBIrh8WL015VfL0yVqMmkHNb0ZsFTNCgR81GJEUCjUIqBvtrCoOMz8gWXibyHlBKUZrjC/QiOLEp4vfVrO5o+LNoIoFEIwbq+2tKhx4IZK4Suz9iVfnCkNgHE19s40Am6ueMhjAAagNJAQpbXAVRd40YWOzbh4roBQoaf7eBYoabyxHff0N8BFYSVHMsYAdSZMBWoIpFJsqa3tmzQsYGOjJfQcZ9dwNDIZPkeVZUpKsBgXyskmztVohFAvRECFSg625I1hUHDVCj00GgB/CC6rix3gapuUaLD165sI5dLhovVm3QYsKwmwnQ0EzzfMXHQ19FA6AJVrOjK0tqysGzQB0YmpwLJLMHwWNQCVHnB+PgVXVlW9WQY3zKMsJy6pkoMlJp39K+0Rjf42y0rAYTh0JV97KXa4fxwYgGs7s0ihCgHsNXCwZEi6Oj5pWB03K0pIC5eH2xbkoFVbWzedDDcSyyoqVgVUckzx3nunAZG8S4LAcSx89f/8Rkuv/oRktnkrC2BJpw13bRtCJls3FT/bAgEKMX6NWEQ3EKKMzwaDXq1BikYL3gUij65TKKqcAiYSpV43NoObgri9cGL+67iGD2lNf/0jZvZvWccOyFndTxpNJYQPLF1CNmgKN5lIYA4gvHxLQf4+Y8fqiw1YsbBsuXRsShGT6VDXwhDYy6IyEylJD/pUph0QwHUFBJHKMw6vySt4eobn2Z3pakRG/jtloUAYtJJG7sjQ6I9TTCPAIKjZEWYRoMtGFzdDtQWdBB38YfHiuEOLzrcl7hQChgveKzoqt78D3GF2vV3hbbnkrzQnsFO27MmBIufoZHfblkJQGmNHyyv1IhKgUjarI2yQdcyAo4HraPjRYj7+wLckj8tQRZVKSC+5nFrO7DSzrwVykIJlDapEZuNMAxak80mwmxs1OYBivOHjk5EXSANUgq0FzBWjgeqvmwQpUpsTxH41QXoHSsYAdSRMAw6oLczTU+tcwDRn54fMJ53IfJuxXuNDY1PGxhXU7bI2jva0qzqyYIfNGVMkBFAHSm7QFfkSDp21bn8gbICCiWPiYIbjQGi3o6Cg8O1tQAQbTwiBP0rc5EAarjIMscIoI6EYdCq9jBopkKdJ/IlJiZdkNMWlWvN/uHJmssXuxlPGOyEoLJ9Bo41jADqjZraEK+mmdY4JWLBo1gKDrF/hODgSO0CiNkw0NW0a2KMAKh9gXplF6e8DqAWyqHQEy6eFyDF9I2uBcNjcYa4mooGECbrdZozVaIRAIsXNlG2nyhaU2kNjpw2B1C70EYniuBNBa2Fk2GCkThL9ALcqwOrWnGy4caDzdYQNLUABGEmgjhIbaGzL1ofmvojCDRO1gkHmdQYBBeVaWzCDfvpZQVokDAUtQC1LGuMr9XX00J3ewrlq6MqlUwjaGoBSCnQgeb4OF3hAq+nlC5rSBCFQbem6O2M5wCqN664TMPjJZgmLg1gifJEWC3XFtGcQi6bDLdt8prPE7SsBCCFwLZkxf9OTz4rRNjVsW2BbQkcWzI54ZLqTPG2804sX38hhElddfl++IoVnZlww24WVrmOjBUPbaE0ICTj+RIl1w9/qkHBSoUzwIN97eCrBb+D5cayCoUolnz8kQK+FJXtE2xLrHSYitz3FX4+8phoARJ6V2S57MuvZ8NAV7QZ98I+vh+oyEcvomlgRV9vFiklSqlwMXuNjE6UDmmiNHFEqEu+6JJM1PYp40seH6VKbDaWhQDimvz1r9xA12V/g5OYO1Q2jHUXPLRpL9+68j5AcsL6Dj727jMYHiuhlKZ/ZY7XnrWO3s7sgo0/LokfqDD4x7bK+wHEA2ClF9bcjo6VjmhChBRMFDzGJ1w6WzMV7xk8E8f3ty+z/sDisCwEEPdvT1rfzUnrK0uOC7B2ZZZvfvceELCyO8P733r6EccsRs0f4/t+KIAYrUPDWgBxyYYniof4OuN4oGLJZ2S8yADUFBE9FRTXDgmr6TxBy0IAMXFy3PkIAoVlyXLwGAI8X0ddlClPiiXFohk/QMnToKeST2ELBleF6wBqvUtc1pHRSRDikMk0KQVBSZUHwrV0YKZSJbaTzaUoFH1su3magmUlgEqS40JobNYsg+DpAlg0ogU7xVIAKl5yCCRs1qysPQx6+mkj46XQ1znNygWAr8qTYXE5qrp+OVVihhVdaZ7dMYpwmkcAzfOkdSS2yfFCCVSYaS0IFJlsIoy0pHYPULw3wljBK68FOOTvpmWIq7UF0FqTSjisWZFrukxxRgCLhAZeOJCHIByc6kDR05Git6O2MGiYcmu6niI/6R7RAsQH1bJn8HSCqFu5bnVrGBW6oKstL4wAFoFomMHDm/aBiEzdU6zpzZFKOrWFQU9jsuSRn/TCUOjD/1JHO0cuAicMdla128yxgBHAAom9MYWiy+/v3QHpaP+yQNG/KowCVarW5YahuReKPpPFIIp3OEwCQnCwxiS5h7NhoAusoyenUiMwAlggQdTnv+Z3T7Nzy0ESqbDGR2n6a84GHRLbYWHSo1QKZp6lFaKcLqXWOYCpVIltiJRNzXpdhhgBLIB4RVV+0uWLl96BTCamak8B66J1AAslP+lRiuJ0DomGiPIDDY3FKRJru37sLFu9ooVcazJKONAc3SAjgBoJAg2Ek2gf+vKNbNl8ADvtTAXE2YLB1VEy3BqNqexdyrvoGdbsxgFxQ6NRRGitcxrRdXs6svR1Z9F+0Cz2bwRQCVqHk3Bxag+lVJiiUQgu/h838IOrHybRniEIFGEMnMLOJspjgJrHlFF1P14oRe7Jw/8ekJLRiRKeX3tAXDhvEaZKXLe6DbzmCYtuyESYUpogUGUDqTdxjpvps8ZaR7E6FU2EifgfpAx3LRTxD9ET3P7ATj797Vu5/c4dJNoyU3l1BChf0dmeoqstTOClNTUNLOPcRyPjpXCC7bBix4tiJiY9xvMebS2yZieOH82eD65uh2nZooNAl5+h6rTuOo4JrGfa3YVRfwFoTTadCGdmG5SwNr5PS9Yp9yNsW9a88qvk+hwYmWTb7hHufvQ5rrv1WW65byd4ulzzxwghwAtYsyJXXgew0OdwXX/aovXpphSOAQqT3oLfb3zui07sJV69LISgNZuo+ZpT1wb7KG1RhPWir9VNnEIIlOvzshf1sXGgo2F56LUO43x27xvn1vt2gxb0dKU5/+xB1Dx1UaDCWq/kekwUfIbHCwyNljgwPMnYaAmKPtgWdjaBFFOTSDFCgPIUPT0Zznv5QBi1OoP3stLnsC3Bk1sP8uDje5EJ+4iWRBMOYi84Zx1t2UTN63rje217fow77t8NlkU2bXPBOYM4tebpjBpNpQXX3/4so+NuuAipphLWh7oKILwDBJMeeAE1W0Kt2BZWJmwFgkBBIdxXtxw1OX0NbzmMJlKoiPtAIkxGZUscS4YfMBoPzIqAwI/vtwjPnLCxU86c3agg77Io/stp70xpjc6XFuWTiWxyUQMPF4sGdIHAySSWZKXR9OhR25ZY7Zl5zgjR8X919P867BQorVFBBdagq7vffFQSBZtoTS3K+Gr6vaQQWG2ZRbluEMzX9i4NDRsEL/XjlwfBx+j96pXctt5Jc5ca4wY1NDVGAIampiFdICHEIYtTphMoPevgTogj95bS6GgWdm6kENGAlbI3Yr6NFyxLopU+xJMSl2G+7kz8jIc/jxACGe0NNh/xNTQatIh86JVtFmFZ4bNWm3/UskSYxXraSrY5B/iHIWX4fOUIEBF1eecotG3JI46RUkTfqLFd5foLQAh818cfLwJiKvBERe7BbAIr6Rw5hSk0fgD+SB6mG7wtsNrSc3ompCXxJj3Il8CKYugDDW0prNk2YBPgjk5CwsZKWtExAj9Q+GMFREvkxZjlXN/z8fMu5FKhkKIJN9/1wfWxWpJzl1kKPFeF78kSIHRY5pYUTmKevXyFwB0rhe8mlah4OlhKgTtaDD10tgBfQcLByc2+B9t0LEvgFlzIe+H5mtATlUlgpR2YQfMaQWk4D5kklmOhlUZaAq/ggR9g5VJ137JpOnUVgJQCv+Dx0tNXcfHfnk6gYbLooTVk0g6WgP+85lHuuGcXTiZRVr8QgsBTrF6R5Z8/+edh5rbIt7/9+RE+f+lds6YYkVLijRc5/vhOLn7HSzh5fSd+oHj4qQN864f3c3CoiLDFIe84vJ/PJz98Frc9sIu773sOJ5PEd31W9Wb58MVn8bUr7mN0wivXtIc846THaX/Sy3veeApfvfwe9u4r4KQc3LzLGaf3cc7pffzblfdjJWd2ZQop8CY9urtSfPQjZ/GyU1ciBDz05D6+fuW97NtXxM7MvLWQlAI/7/LB95zBzj1jXHfTZuw5NhGcembw8kXe9PoTefsbTqKzJcnBsRLf/3+P85vfPYOTTc1Zi0spcMeKnHrKCv7737yIEwY6QGu27Bzh8l8+zkOP78Walr0jDrfIpCVf+PxruOxnj7L12WGcTILSWJHzzl3PGSev5CuX3YNMHjnfUS/qPwaQUJj02fHCBJuf3s+fnzHABeccz+anD7LjhQkmCl602HsKIUB7Aat6snzk7S/lhQN5tuweY9vz4zy3rzBrcJmUAm+ixKvPGeTBn/0dKzsz/Pg3T3Hd7dsZXNtKNuNEXZEjz9dewIcvPIOXnLQSXQwNXfmKnvYUn3rvy8mmE+gZzhVCoN2ADQMdfPSdL+Pb//IaVNFDWhJd9PjTDd287y2no11/xklAKQS6FNDfl+P+q9/Dmaf28dPrNvGja59i42AXD/7s71g3kEMV/Rn96EIIdMnjor86hVe/vB896c3rcpZS4o+X+PqnXs3lX7qAxzbt54pfPMETm/fzg0vewOc/cg7eWBE5y8yytCTeWJG/v/A07vzhu8g6Nj+9/mmuuWkzHW1pjutvQ7uHZpnTgO1Y5PfnOWGwm29/8jWovAta4DiSK750Aa6vwnfXwJFpXVsApTQy6fDEM/v57Ff2wL5xelbl6GpNc8kXfwu9OUjZWClnxhpLa3hu3yif+tYtMOKBLUEKrLbUTOtCCAJFtsXhp9/4a775g3v5wudugNY0BIrvoKA1jZWwZq5dBAyNTjJZ8hFyaheWQGn2DxfmnmHVmlTC5rYHtvHy0/p41387jauufhQci6Lrh0sWZzFKIQVBvsS/f/av2bprhNe++XJIJ0HAld+9m1/+5N1c9oXzOe8dP8ROOczYjxKCkfES+agymYu4kjjzZav5+EVncsqbvscTd+2E1hSMTvKrPz7LAz+5iGt+v5nHNx3ASR/6beIW7+STe/neF9/AGz/yc6796SOQSwHwn1c9AOkEVkviiP68VhpSDu/97HVsuf4DnPWqddx5/TN87JOvYnTC5ev/5w7stkxFY7zFov5a0xo74ZDtbsHuaSGXSZLNJLB7c+FvM/X/p+E4kvbWFLSlkO0prNYk5c2ipyGlQOVdzj17EMe2uOS7d2P3tZPqSJPsypLoymHLuTdgjgdnuuRTcn206+H5PpYl554M0ppUymb/cIkPffkG/uNzr6O7N4ss+Vhy9s29hQDPDcitzHLuGf185bt3I1vSZLqzpDuzyI4sX7viHs46rY/O1a247uzbGFWa4kUKASWPt7/+FG5/aDdPPPgc6YFOEq1JUoOdPHjvLh58ah8Xnn8y5N0jWhMpBHqixHvfehp3P7qba3/5OOnBLijvVSzDaNIZ3rPSmkQmwb7to1z284f5nx95JYkOm0+97xX80zdvAS0bPmHaEC+QjnZ39AMVTq9P2+1x1r5elFmhozXNzd97OyVPkXIsrrl5M1/+t9tJ5FKHeFYE4SBu40AnO/eMUppwcTIpPL/CiRwpmCi4fPFD5/APbzudRMIi8DXZtBV5OcqxEjPi+4rVvTl+/ZOHufc9Z3LZl87nLW+5cs4ANYFABwErOtuQ0uK5/RMoW+L5oedH2ZJd+yZQGvp6cgzt34tIJBY0RoxPHVjVxrbdo2HaxkARBBqBRmrY/vxIGBY92+MKOHFdFw9v2oe0Lbyix8bBNl539nqKJY8tu0b4wz27kDPEEAWBwmpPc8lld3LHD9/Fr696J/c+9jy/+e3TOIcFFjaCozcvULQXbr7g8pnv/IHRCZ+ELXn+QH7OXcSDICjH6ldlJ1qTStr89MYnufa3T5NuTVOcdFnX3843PnFu1LWY+4paaWQmyUX/8mu23/ghXn7BSewfnsSZRQRxkLAXfXRLTrU08UJ7xxIIofEXKXV5fAU/CHDsI59JizBx8ETBm/FxQ+dYGCJt2xJEOFZa1Z3l3Bf3ccoJKxgZd3npmy7HyqWODN7TYCUshvbk+fcfPcCln/lL/vQt30NYNmIJ1iIf1RNhQghcT3HLvbu5465d3HLXLp5+dhhhyxlerAbH4rEtB1m/poO2jgyBG5BwLOwoiG1Oovidhzft57bfbeGG257l1lu2csu9uyour9IalXHYuXWYj3/j93z/kjfQmgnHATPVplqDdCz27B2jWHI5+bhOdMEl4UichIXOu5y4rpMg0OzaM4pwZhm/REgRdrfi0OjZ1z0IHtuyn1M39oQtcmT0mlAAJ63v5pGn98+46YCI3tVDm/byitNWo/wAO5Pgzkde4E0X/oivXnFv2Pefo5xaaUTC5oEn9/LCgQme3T2KTs6d77VeNFwASlWW3jDGVwrX88D1wfOhNHPNFGiNlU3wx7t38MLBPN/511ej85NM7hundGACL1+adyGM72vSSRvZmiSTS2HlUrRmnYoGZToOIvMVya4s3/q/9/Dc3jG+8MGz2T+UL29vejiOLXFHSvzgV0/w1X88l5aOFPk9YxT2jJHIWHz943/Bj697ivz+PI5jzWpXWmsmCi7BwTyF4QLuUD6cgzjsmZXSiJYE3//FY5y8vpt3/O3puM8NUTyYx31uhPdf9BJW9+b40a8eQ7Ykj5jAU0ohsmmu+K9HOXF9Nx/6wMtx94zgjU2C0khZ2Y47WmucqAVxbDGnYOpJY7tAWtOSdmjJOPP1Jso1Zl93KzdcdiGTbkDCkjyzc4iLL7n5yHkAHXk4ioo3f/garr30rTxy4we595HnyKQdWluSvPtfr2NkvIQ1U3y7hrbWBAnbQgW6vAQSIehoSyGFnnHwHZ+bdCxyLeFAUKARls37P/9bnrnuA4zm/VnTuQdKYbel+fQ3b+WEgXYeu+793HzXdpTWvPJlAzy7Y4hP/K/fY7WlZ0+vEhn5hy98MWeevJJE0sGyBF+94m5u+sN2EtM8Mkpr7JTD9m3DvPOfr+V/f+Y83nnByWzfPcy6/k5OP3kFb/vHX7B3T37GCTGlwU7bbN82zNs+eg3f+9LrecfrTuLxrQfRvuI1Z69jx56x+btrWmNZkvbW5JKGSdZ/PUB8IyEISj5nnt6HY0vuuG/3rBMeQoDyNe1tSS44Z5DWbLjBhJSCfUN5fn7TlllrcyEFfsGltT3JW887kRMGOyiVfO554gVu+OOOWV+2DhTnv2odm7cPs3XbMFbSJvAD2nIpXn3mWq7/4zYmiwHisG5BvOhn/UA769e28bs7diBsKxRjweXcswdIJWxuuH0bcpYaXAgRis5z+ctXrufPXrIWKQR3PPwc1938DMJ2ItHO9K4EyvM56yWrOXGwAydhhzWxJfn93TvYvHXokAmpmHjCcO1gG2957Qn09WTZ/UKeq298ihd2j887GyylxJsosrIvx5tfu5HBvlaKrmLT9oPcdt9unt+XRx42aThV5nDRUHd3hnNevJpf3/os3hLtVN8wAYR3E+HiGK3Liy7mIlAaJg5b6GFJrFxyzvOkFHiegoliVPMKSFjIlsScGRqCvAsJCythlRfIBIGGgovMJmf/QAICNwBPYU1bhhn73NFEoRCzP7CIFuP4EyUohQvcSVjYuRSg5+4hCAgKHrjBoffIJLCS9qz3tSyJW/QgXkwjJbQk5w+9iJCWwCsFMFGKNtfQYFuQcbBsa+6TBQS+hkkPmU0s2Rr8xgqAqdQdlbzgGYPhKgzWEiKspeL3Wsl5lhSE47ep4wThh55vHBAGvR0ZzBUHAVYa5GVJUW7dqglMi4PSplNJIF0cNDh1zuzBiTNxeKBjGA5U2TXCbzT/u60nDXeDVjMAXsiiEq2rX8wxk7FpqHgQPNNh1UY3BnFNWiW1LjqqeJXbLIRzOrWdH36jpRwBHOVuUIOh3hgBGJoaIwBDU2MEYGhqjAAMTY0RgKGpMQIwNDVGAIamxgjA0NQYARiaGiMAQ1NjBGBoaowADE2NEYChqTECMDQ1RgCGpsYIwNDUGAEYmhrJXPn+DIZjHNMCGJoaIwBDU2MEYGhqYgGYcYChGRGmBTA0NUYAhqZmugBMN8jQTAgwLYChyTlcAKYVMDQDZTs3LYChqZlJAKYVMBzLHGLfpgUwNDWzCcC0AoZjkSPs2rQAhqZmLgGYVsBwLDGjPc/XAhgRGI4FZrXjSrpARgSG5cyc9mvGAIamplIBmFbAsByZ126raQGMCAzLiYrstdoukBGBYTlQsZ3WMgYwIjAczVRln7XuFB/fZGm3+TYYpqipYl6oF8i0BoajgZrtcDHcoEYEhqVkQfZXaxdotkKYLpGhUSxKxbtYAogxQjDUm0XtcSy2AGKMEAyLTV262vUSQIwRgmGh1HWMWW8BxEx/CCMGw3w0zLHy/wHm/BVxqyaamgAAAABJRU5ErkJggg==" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:16px"></div>
    <div style="font-size:28px;margin:14px 0">🔒</div>
    <h2 style="color:#C53030">Signed Out</h2>
    <div class="sub" style="margin-top:8px">Your account was opened on another device.</div>
    <button class="login-btn" onclick="location.reload()" style="margin-top:18px">Sign In Again</button>
  </div></div>`);
}

function watchAuth(){
  const{auth,onAuthStateChanged}=window.__fb;
  // Firebase Auth restores the signed-in user from IndexedDB, but offline it can
  // stall trying to refresh the token — and then this callback never runs at all,
  // which is another way to sit on the spinner forever.
  let _authFired = false;

  // ── Fast offline cold start (v220) ────────────────────────────────────
  // Runs only when the browser reports no connection and this device already
  // has a saved session. It is the same restore the 15-second deadline would
  // perform, taken early because there is nothing to wait for. If a connection
  // does exist, or there is no snapshot, this does nothing at all.
  const _fastOffline = setTimeout(async ()=>{
    if(_authFired || state.initialized) return;
    if(navigator.onLine !== false) return;          // might genuinely be loading
    try{ if(auth.currentUser) return; }catch(e){}   // real session won the race
    const local = readLocalSession();
    if(!local) return;                              // nothing to restore
    console.warn("Gir\u00eak: offline with a saved session \u2014 opening straight from cache.");
    state.user    = {uid:local.uid, email:local.email};
    state.profile = local.profile;
    state.offlineSession = true;
    try{ await subscribeData(); }catch(e){ console.error(e); }
    if(!state.initialized){ state.initialized = true; try{ renderApp(); }catch(e){} }
  }, 1200);
  // MY MISTAKE IN v155: this deadline showed the SIGN-IN screen. Offline, signing
  // in is impossible — Firebase must reach its servers — so an already-signed-in
  // user was locked out of their own cached data by the very safety net meant to
  // help them. A slow session restore is not a signed-out user.
  setTimeout(async ()=>{
    if(_authFired || state.initialized) return;
    // The session may already be restored even though the listener has not run.
    const persisted = (()=>{ try{ return auth.currentUser; }catch(e){ return null; } })();
    if(persisted){
      console.warn("Girêk: using the persisted session while auth catches up.");
      return;                      // the listener will still fire; do not disturb it
    }
    // Firebase has gone quiet. Fall back to OUR snapshot rather than stranding
    // someone who is signed in and holding a full local database.
    const local = readLocalSession();
    if(local){
      console.warn("Girêk: Firebase Auth silent — opening from the local session snapshot.");
      state.user    = {uid:local.uid, email:local.email};
      state.profile = local.profile;
      state.offlineSession = true;          // surfaced in the header
      try{ await subscribeData(); }catch(e){ console.error(e); }
      if(!state.initialized){ state.initialized = true; try{ renderApp(); }catch(e){} }
      return;
    }
    if(navigator.onLine === false){
      // Offline and never signed in on this device — nothing to restore, and a
      // password cannot be checked without a server.
      renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center">
        <div style="font-size:34px">📡</div>
        <h2 style="margin-top:10px">Sign in once while connected</h2>
        <div class="sub" style="margin-top:8px;line-height:1.7">This device has no saved session yet. Connect to the internet and sign in once — after that Girêk opens with no signal at all.</div>
        <button class="login-btn" onclick="location.reload()" style="margin-top:18px">Retry</button>
      </div></div>`);
      return;
    }
    console.warn("Girêk: auth did not report in time — showing the sign-in screen.");
    try{ renderLogin(); }catch(e){ console.error(e); }
  }, 15000);
  onAuthStateChanged(auth,async(user)=>{
    _authFired = true;
    try{ clearTimeout(_fastOffline); }catch(e){}
    if(user){
      state.user=user;
      // Distinguish "profile is absent" from "we could not read it yet".
      // 12s, and on timeout we RETRY in the background rather than concluding
      // the account does not exist.
      const _pOk = await bootRace(loadProfile().then(()=>"ok"), 12000, "timeout");
      if(!state.profile && _pOk==="timeout"){
        renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center">
          <div style="font-size:34px">📡</div>
          <h2 style="margin-top:10px">Still connecting…</h2>
          <div class="sub" style="margin-top:8px">Your account is fine — we just could not reach your profile yet.<br>Retrying automatically.</div>
        </div></div>`);
        for(let i=0;i<5 && !state.profile;i++){
          await new Promise(r=>setTimeout(r,3000));
          await bootRace(loadProfile(), 8000, null);
        }
        if(!state.profile){
          renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center">
            <div style="font-size:34px">📡</div>
            <h2 style="margin-top:10px">Cannot reach your profile</h2>
            <div class="sub" style="margin-top:8px">You are still signed in. Check your connection and try again — nothing has been lost.</div>
            <button class="login-btn" onclick="location.reload()" style="margin-top:18px">Try again</button>
          </div></div>`);
          return;                    // never fall through to "Account Not Configured"
        }
      }
      if(state.profile){
        // ── Single-device session lock ──
        // The single-device lock needs the server to be meaningful. Offline it
        // cannot be evaluated, so we let the user in rather than lock them out
        // of their own field data.
        const claim = await bootRace(claimSession(state.profile), 8000, {ok:true, offline:true});
        if(!claim.ok){
          // Another device holds the session → block this login
          const {auth:a, signOut} = window.__fb;
          try{ await signOut(a); }catch(e){}
          renderRoot(`<div class="login-bg"><div class="login-card" style="text-align:center">
            <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:16px"></div>
            <div style="font-size:28px;margin:14px 0">🔒</div>
            <h2 style="color:#C53030">Active on Another Device</h2>
            <div class="sub" style="margin-top:8px">Sign out there first, then try again.</div>
            <button class="login-btn" onclick="location.reload()" style="margin-top:18px">Try Again</button>
          </div></div>`);
          return;
        }
        saveLocalSession(state.user, state.profile);   // for the next offline launch
        await subscribeData();
        watchSessionLock();
      } else {
        const uid = state.user.uid;
        const email = state.user.email;
        renderRoot(`<div class="login-bg"><div class="login-card">
          <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:16px"></div>
          <h2>Account Not Configured</h2>
          <div class="sub">Your account exists but no profile found.</div>
          <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:12px;margin-top:14px;font-size:11px;text-align:left;font-family:monospace;color:#5D4037;word-break:break-all">
            <div style="font-weight:700;color:#1B3A6B;margin-bottom:6px">🔍 Diagnostic Info:</div>
            <div><strong>Email:</strong> ${email}</div>
            <div style="margin-top:6px"><strong>Your User UID:</strong></div>
            <div style="background:var(--card);padding:6px;border-radius:4px;margin-top:4px;user-select:all">${uid}</div>
            <div style="margin-top:8px;color:#7F6000">⚠ Firestore must have a document at:<br><code>users/${uid}</code></div>
          </div>
          <button class="login-btn" onclick="navigator.clipboard?.writeText('${uid}');toast('UID copied!')" style="margin-top:12px">📋 Copy UID</button>
          <button class="login-btn" onclick="doSignOut()" style="margin-top:8px;background:transparent;color:var(--ink-brand);border:2px solid var(--navy)">Sign Out</button>
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

// The single source of truth for "what data does this app hold". The live
// listeners, the backup and the restore all read this one list, so a collection
// added later is protected automatically instead of being quietly left out of
// every backup until the day someone needs one.
const SYNC_SUBS = [
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
    ["parts","parts"],
    ["quotes","quotes"],
    ["variations","variations"],
    ["expenses","expenses"],["invoices","invoices"],["advances","advances"],["expenseReports","expenseReports"],["risks","risks"],
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
  ];;
const SYNC_COLLECTIONS = SYNC_SUBS.map(s=>s[0]);
Object.assign(window,{SYNC_SUBS, SYNC_COLLECTIONS});

async function subscribeData(){
  cleanupSubs();
  const{db,collection,onSnapshot,doc}=window.__fb;
  state.initialized=false;
  renderRoot(`<div class="skel-page"><div class="skel-header"></div><div class="skel-body"><div class="skel skel-bar"></div><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card tall"></div></div></div>`);

  // The single source of truth for "what data does this app hold". Backup and
  // restore read it too, so a collection added later is protected automatically
  // instead of being silently left out of every backup until someone notices.
  const subs = SYNC_SUBS;
  let firstCount=0;
  const firstSeen=new Set();
  window._totalCols = subs.length;
  // THE ETERNAL SPINNER (found in v155):
  // The gate waited for ALL ~30 collections to report before showing the app.
  // Online they all answer in a second. Offline, Firestore serves each one from
  // its local cache — but a collection that was never cached (a feature this
  // company does not use, or one added after the last online session) has
  // nothing to replay and simply never fires. One silent collection out of
  // thirty was enough to hang the launch forever, with no error anywhere.
  //
  // A deadline fixes it in general: after 6 seconds we show the app with
  // whatever has arrived. Late collections still stream in normally afterwards.
  clearTimeout(window._gateTimer);
  window._gateTimer = setTimeout(()=>{
    if(!state.initialized){
      console.warn(`Girêk: opening with ${firstSeen.size}/${subs.length} collections — the rest will stream in.`);
      state.initialized=true;
      try{ renderApp(); }catch(e){ console.error(e); }
    }
  }, 6000);

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
    const unsub=onSnapshot(collection(db,col),{includeMetadataChanges:true},async(snap)=>{
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

      firstSeen.add(col); firstCount=firstSeen.size;
      window._loadedCols = firstSeen;
      try{ noteSyncState(key, snap.metadata && snap.metadata.hasPendingWrites); }catch(e){}
      if(firstCount>=subs.length && !state.initialized){
        clearTimeout(window._gateTimer);
        state.initialized=true;
        renderApp();
      } else if(state.initialized){
        scheduleRender();
      }
      // Each incoming snapshot pushes the "settled" moment further out, so the
      // animation gate only opens once the stream has actually gone quiet.
      window._bootSettled=false;
      clearTimeout(window._settleTimer);
      window._settleTimer=setTimeout(()=>{ window._bootSettled=true; }, 1200);
    },(err)=>{
      console.error(`${col} sync error:`,err);
      // A permission error almost always means this collection has no rule yet.
      // Say so plainly, and remember it so the affected screen can explain too.
      const denied = /permission|insufficient/i.test((err&&(err.code||err.message))||"");
      window._syncDenied = window._syncDenied || {};
      if(denied) window._syncDenied[col] = true;
      toast(denied ? `⚠ "${col}" is blocked by Firestore rules` : `Sync error: ${col}`);
      // IMPORTANT: still count this collection so the app doesn't freeze on the
      // loading screen if one collection fails (e.g. missing Firestore rule).
      firstSeen.add(col); firstCount=firstSeen.size;
      if(firstCount>=subs.length && !state.initialized){
        clearTimeout(window._gateTimer);
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

// ═══ WRITE ACKNOWLEDGEMENT (v171) ═══════════════════════════════
// Firestore's persistent cache applies a write locally at once, but the promise
// from setDoc()/deleteDoc() only settles when the SERVER acknowledges it. With
// no signal it never settles at all, so `await fbSave(...)` froze every form:
// no confirmation, the form never cleared, and technicians re-entered work that
// was already stored on the device — duplicate entries from a successful save.
//
// We now resolve as soon as the write is safely in the local cache and follow
// the server acknowledgement in the background. The pill in the header already
// counts unacknowledged writes (see noteSyncState), so the queue stays visible.
const LOCAL_ACK_MS = 1200;   // a healthy connection acks well inside this
window._lastWriteLocalOnly = false;
function _ackWrite(p){
  let raced = false;
  const tracked = p.then(
    ()=>{ if(raced) paintSyncPill(); return "synced"; },
    (e)=>{
      // A failure that lands AFTER the caller moved on has nobody left to
      // report it, so surface it here.
      if(raced) toast("⚠ A queued change could not sync: " + ((e&&e.message)||e));
      throw e;
    });
  tracked.catch(()=>{});   // late rejections are handled above, never "unhandled"
  // When the device already knows it is offline there is nothing to wait for:
  // confirm the moment the write is in the local cache. The wait only exists
  // for the ambiguous case — "online" but on a weak link or a captive portal.
  const wait = isOffline() ? 0 : LOCAL_ACK_MS;
  return Promise.race([
    tracked,
    new Promise(res=>setTimeout(()=>{ raced = true; res("local"); }, wait))
  ]);
}

Object.assign(window,{_ackWrite,LOCAL_ACK_MS});

async function fbSave(col,item){
  try{
    const{db,doc,setDoc}=window.__fb;
    const id=item.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6));
    const data={...item};delete data.id;
    const how = await _ackWrite(setDoc(doc(db,col,id),data));
    window._lastWriteLocalOnly = (how === "local");
    return how;
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
          await _ackWrite(setDoc(doc(db,"trash", `${col}_${id}_${Date.now()}`),{
            origCol:col, origId:id, data:snap.data(),
            deletedAt:new Date().toISOString(),
            deletedBy:(state.profile&&state.profile.uid)||"",
            deletedByName:(state.profile&&(state.profile.name||state.profile.email))||"",
          }));
        }
      }catch(e){ console.warn("trash copy failed",e); }
    }
    const how = await _ackWrite(deleteDoc(doc(db,col,id)));
    window._lastWriteLocalOnly = (how === "local");
    return how;
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
    if(e.code==="auth/network-request-failed")msg="No connection — signing in for the first time needs internet. If you have signed in before on this device, close and reopen the app.";
    return msg;
  }
  return null;
}

async function doSignOut(){
  clearLocalSession();
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
      <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:16px"></div>
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
        <div class="login-logo"><img src="data:image/png;base64,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" alt="EJAF Technology" style="width:100%;height:100%;object-fit:cover;border-radius:16px"></div>
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

window.showForgotPassword = async function(e){
  if(e) e.preventDefault();
  const email = await uiPrompt("Enter your email address:\n\nWe'll send you a password reset link.");
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
          ${`<p><span id="periodLabelInline" onclick="editPeriod(event)" style="cursor:pointer;white-space:nowrap;display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom;font-size:10px;${(getPeriodFrom()||getPeriodTo())?'background:#C9A84C;color:#03308B;padding:2px 10px;border-radius:12px;font-weight:700':'text-decoration:underline dotted;opacity:0.9'}">${(getPeriodFrom()||getPeriodTo())?'📅 ':''}${escapeHtml(shortPeriod())}${(getPeriodFrom()||getPeriodTo())?' ✕':''}</span></p>`}
        </div>
        <button class="gs-btn" onclick="gsToggle()" title="Search anything" aria-label="Search">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        </button><span id="syncPill" class="sync-pill ok" onclick="paintSyncPill()"></span>${state.offlineSession?`<span class="sync-pill off" title="Opened from the session saved on this device. It will re-authenticate the moment you reconnect." style="margin-left:4px">📴 Local session</span>`:""}<span id="netDot" title="You are offline — changes will sync when back online" style="display:${(typeof navigator!=='undefined'&&navigator.onLine===false)?'inline-flex':'none'};align-items:center;gap:5px;background:#7A1F1F;color:#FFD9D9;font-size:10px;font-weight:800;padding:4px 9px;border-radius:12px;margin-right:4px">📴 OFFLINE</span><button id="themeBtn" onclick="toggleTheme()" title="Light / Dark mode" style="background:rgba(255,255,255,0.14);border:none;border-radius:8px;width:32px;height:32px;font-size:14px;cursor:pointer;margin-right:2px;line-height:1">${document.documentElement.getAttribute('data-theme')==='dark'?ICON_SUN:ICON_MOON}</button><span id="notifBell" onclick="openNotifPanel()" style="position:relative;cursor:pointer;font-size:18px;padding:4px 6px;margin-right:2px;user-select:none" class="bell-btn ${bellCount()>0?'ring':''}">${ICON_BELL}<span id="notifBellBadge" style="position:absolute;top:0;right:-2px;background:#C62828;color:#fff;font-size:9px;font-weight:800;min-width:15px;height:15px;border-radius:8px;display:${bellCount()>0?'flex':'none'};align-items:center;justify-content:center;padding:0 3px">${bellCount()>99?'99+':bellCount()}</span></span>
        <button onclick="switchTab('Profile')" title="My Profile" style="width:40px;height:40px;border-radius:50%;padding:0;border:2px solid var(--gold);background:var(--navy);color:var(--gold);font-weight:800;font-size:14px;cursor:pointer;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${(state.profile&&state.profile.photoData)?`<img src="${state.profile.photoData}" alt="" style="width:100%;height:100%;object-fit:cover">`:escapeHtml(((state.profile&&(state.profile.name||state.profile.employeeName||state.profile.email))||"?").charAt(0).toUpperCase())}</button>
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
  setupOrientation();
}

// ═══════════════════════════════════════════════════════════════════════
//  GROUPED NAVIGATION — main groups (top bar) each contain sub-tabs (2nd bar)
// ═══════════════════════════════════════════════════════════════════════
const TAB_GROUPS = [
  { id:"Dashboard", label:"Dashboard", icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='currentColor' style='vertical-align:-2px'><path d='M4 20h3v-8H4v8zm6.5 0h3V4h-3v16zm6.5 0h3v-5h-3v5z'/></svg>", children:["Dashboard"] },
  { id:"Logs",      label:"Logs",      icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M12 20h9'/><path d='M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'/></svg>", children:["Filters","Daily Log","Approvals","Overtime","Travel","Leaves","My Tasks"] },
  { id:"Reports",   label:"Reports",   icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><polyline points='3 17 9 11 13 15 21 7'/><polyline points='15 7 21 7 21 13'/></svg>", children:["HR Report","Daily Log Report","Reports","Technical Report","Finance Report","Analytics","Executive"] },
  { id:"Database",  label:"Database",  icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><ellipse cx='12' cy='5' rx='8' ry='3'/><path d='M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5'/><path d='M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'/></svg>", children:["Branches","Departments","Locations","Projects","Assets","Maintenance","Finance","Dispatch","Incidents","Risks"] },
  { id:"Clients",   label:"Clients",   icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg>", children:["Clients","Requests"] },
  { id:"Settings",  label:"Settings",  icon:"<svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><circle cx='12' cy='12' r='3'/><path d='M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/></svg>", children:["Profile","This Device","Date & Time","Technical Classifications","Users","Email","WhatsApp","Share","Entry Manage","Recycle Bin"] },
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
    const base = ["Dashboard","Work Instructions","Profile","This Device"];
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // Employee: own-data tabs only
  if(role === "employee"){
    const base = ["Dashboard","Filters","Daily Log","Overtime","Travel","Leaves","My Tasks","Work Instructions","Profile","This Device"];
    if(state.profile && state.profile.canViewReports){
      base.splice(base.indexOf("Work Instructions"), 0, "HR Report","Daily Log Report","Reports","Technical Report");
    }
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // HR: full ops but no Users/Share/Clients
  if(role === "hr"){
    const base = ["Dashboard","Filters","Daily Log","Approvals","Overtime","Travel","Leaves","My Tasks","Work Instructions",
                  "HR Report","Daily Log Report","Technical Report","Reports","Analytics","Requests","Projects","Locations","Departments","Profile","This Device"];
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // Support: full access except Users and Share
  if(role === "support"){
    const base = ["Dashboard","Filters","Daily Log","Approvals","Overtime","Travel","Leaves","My Tasks","Work Instructions",
                  "HR Report","Daily Log Report","Technical Report","Reports","Requests","Projects","Locations","Departments","Profile","This Device"];
    if(!base.includes(state.tab)) state.tab = base[0];
    return base;
  }
  // Admin / Owner: everything
  const base = ["Dashboard","Filters","Daily Log","Approvals","Overtime","Travel","Leaves","Work Instructions",
                "HR Report","Daily Log Report","Technical Report","Reports","Finance Report","Analytics","Executive","Requests","Clients","Projects","Assets","Maintenance","Finance","Dispatch","Incidents","Risks","Locations","Departments","Branches","Users","WhatsApp","Email","Share","Profile","This Device","Technical Classifications","Date & Time","Entry Manage","Recycle Bin","My Tasks"];
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
      // A drawing surface owns its horizontal gestures. A signature IS a sideways
      // stroke, so swipe-to-change-tab was firing mid-signature and throwing the
      // user out of the report form. CSS touch-action:none stops the BROWSER's
      // gestures, not this app's own touch listeners on #content.
      if(tag === "CANVAS") return true;
      if(node.id === "tabBar") return true;
      const cl = node.classList;
      if(cl){
        if(cl.contains("data-table")) return true;
        if(cl.contains("no-swipe")) return true;
        if(cl.contains("sig-wrap") || cl.contains("sig-canvas")) return true;
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

// ── Orientation support (v168) ──────────────────────────────────────────
// The layout itself is handled by height-keyed media queries. Only the
// signature pad needs JS: its backing store is sized from the element's
// on-screen box, so a rotation invalidates it. Ink already on the pad is
// banked to _sigStore first, so turning the phone never loses a signature.
function _sigRebindOnResize(){
  let banked=false;
  const pads=document.querySelectorAll("canvas.sig-canvas");
  pads.forEach(cv=>{
    const key=(cv.id||"").replace(/^sig_/,"");
    if(key && cv._dirty){
      let img=null;
      try{ img=_sigTrim(cv); }catch(_){ try{ img=cv.toDataURL("image/png"); }catch(__){ img=null; } }
      if(img){ window._sigStore[key]=img; banked=true; }
    }
    cv._ready=false; cv._drawing=false; cv._dirty=false;
  });
  return {pads:pads.length, banked};
}
function setupOrientation(){
  if(window._orientBound) return;
  window._orientBound = true;
  // A bare "resize" listener was a mistake: mobile browsers fire resize when the
  // address bar collapses, when the keyboard opens, and repeatedly while the
  // viewport settles during boot. Each one triggered a full render — exactly the
  // shake reported on launch. Only a genuine change of ORIENTATION matters here.
  const shape = ()=> (window.innerWidth >= window.innerHeight) ? "land" : "port";
  window._orientShape = shape();
  const onChange = ()=>{
    if(!window._bootSettled) return;            // never fight the boot sequence
    const now = shape();
    if(now === window._orientShape) return;     // keyboard or address bar, not a rotation
    window._orientShape = now;
    clearTimeout(window._orientTimer);
    window._orientTimer = setTimeout(()=>{
      try{
        const r=_sigRebindOnResize();
        // Repaint only when there is something to repaint: a banked signature
        // must swap to its preview, and a stale pad must be rebuilt at the new
        // size. Otherwise a rotation costs nothing.
        if(r.pads || r.banked) render();
      }catch(e){}
    }, 180);
  };
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("resize", onChange);
}
Object.assign(window,{setupOrientation,_sigRebindOnResize});

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
    // Pointer and touch events fire in a browser-dependent order, and
    // pointerleave/pointercancel can end a stroke with no matching touchend
    // target. A recency stamp closes that gap whatever the ordering.
    if(Date.now() - (window._sigLastDraw||0) < 700) return;

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

// ════════════════════════════════════════════════════════════════════════
//  FORM STABILITY (v164)
//  renderTab() replaces #content.innerHTML wholesale. That is right when the
//  page SHAPE changes, and wrong for a Pass/Fail tap or a recomputed total:
//  the rebuild collapses the document height, so the browser clamps the scroll
//  offset back towards the top, and the focused input is destroyed — which on
//  mobile also dismisses the keyboard. Long manual report forms therefore threw
//  the user back up the page on every single tap.
//
//  Two mechanisms:
//    1. statPills / statPaint — a status group repaints ITSELF in place. No
//       rebuild happens at all, so nothing can move.
//    2. _uiSnapshot / _uiRestore — when a rebuild is genuinely needed (adding
//       a row, deleting a photo, changing scope) scroll offset, focus and caret
//       are captured and restored synchronously, before the browser paints.
// ════════════════════════════════════════════════════════════════════════
const STAT_COL = {Pass:"#2E7D32", Fail:"#C62828", "N/A":"#5B6C86"};
// One Pass/Fail/N/A group. `call` is the JS that commits the value; every
// __V__ is replaced by the option and __EL__ by `this`, and the call must NOT
// invoke render() — statPaint already repaints the group.
function statPills(cur, call, opts){
  opts = opts || ["Pass","Fail","N/A"];
  return `<span class="stat3" style="display:inline-flex;gap:4px">${opts.map(o=>{
    const on = (cur===o);
    return `<button type="button" data-o="${o}" class="btn btn-sm${on?"":" btn-secondary"}" style="${on?`background:${STAT_COL[o]||"#5B6C86"};color:#fff;border:none;`:""}font-size:10px;font-weight:800" onclick="${String(call).replace(/__V__/g,o).replace(/__EL__/g,"this")}">${o}</button>`;
  }).join("")}</span>`;
}
// Repaint the group that owns `el` so the tapped option reads as selected.
window.statPaint = function(el, val){
  const grp = (el && el.closest) ? el.closest(".stat3") : null;
  if(!grp) return false;
  grp.querySelectorAll("button[data-o]").forEach(b=>{
    const o = b.getAttribute("data-o"), on = (o===val);
    b.className = "btn btn-sm" + (on?"":" btn-secondary");
    b.setAttribute("style", (on?`background:${STAT_COL[o]||"#5B6C86"};color:#fff;border:none;`:"") + "font-size:10px;font-weight:800");
  });
  return true;
};

function _uiSnapshot(){
  const c = document.getElementById("content");
  const se = document.scrollingElement || document.documentElement;
  const snap = { y: (se?se.scrollTop:0), idx:-1, sig:"", s:null, e:null };
  const a = document.activeElement;
  if(c && a && c.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){
    const list = c.querySelectorAll("input,textarea,select");
    snap.idx = Array.prototype.indexOf.call(list, a);
    // The bound path (e.g. window._srDevs[3].name=this.value) is a strong
    // identity: if it no longer matches at that index the shape really changed,
    // and refocusing would land on the wrong field.
    snap.sig = a.getAttribute("oninput") || a.getAttribute("onchange") || a.getAttribute("id") || "";
    try{ snap.s = a.selectionStart; snap.e = a.selectionEnd; }catch(_){}
  }
  return snap;
}
function _uiRestore(snap){
  if(!snap) return;
  const c = document.getElementById("content");
  const se = document.scrollingElement || document.documentElement;
  if(snap.idx > -1 && c){
    const list = c.querySelectorAll("input,textarea,select");
    const el = list[snap.idx];
    const sig = el ? (el.getAttribute("oninput") || el.getAttribute("onchange") || el.getAttribute("id") || "") : null;
    if(el && sig === snap.sig){
      try{ el.focus({preventScroll:true}); }catch(_){ try{ el.focus(); }catch(__){} }
      if(snap.s!=null){ try{ el.setSelectionRange(snap.s, snap.e); }catch(_){} }
    }
  }
  // Scroll last: focus() must not be allowed to move the viewport afterwards.
  if(se) se.scrollTop = snap.y;
}
Object.assign(window,{STAT_COL,statPills,_uiSnapshot,_uiRestore});

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

  // A same-tab data repaint must not move. A tab change or a sub-tab switch
  // (which flags itself via __navFade) is navigation and belongs at the top.
  const _isNav = (window._lastViewTab!==state.tab) || !!window.__navFade;
  const _snap = _isNav ? null : _uiSnapshot();

  const fn={
    "Dashboard":renderDashboard,"Daily Log":renderDailyLog,"Overtime":renderOvertime,
    "Travel":renderTravel,"Leaves":renderLeaves,"Filters":renderFiltersTab,"Approvals":renderApprovals,"HR Report":renderHRReport,"Technical Report":renderTechReport,"Reports":renderFlexReports,"Finance Report":renderFinanceReport,"Analytics":renderAnalytics,
    "Projects":renderProjects,"Assets":renderAssets,"Maintenance":renderMaintenance,"Dispatch":renderDispatch,"Finance":renderFinance,"Locations":renderLocations,"Users":renderUsers,
    "Departments":renderDepartments,"Branches":renderBranches,"Work Instructions":renderWorkInstructions,
    "Share":renderShare,"Profile":renderProfile,"Date & Time":renderDateTime,"Incidents":renderIncidents, "Risks": renderRisks,"Recycle Bin":renderRecycleBin,"Executive":renderExecutive,"Permissions":renderPermissions,
    "Clients":renderClients,"Requests":renderRequests,"My Tasks":renderMyTasks,"Daily Log Report":renderDailyLogReport,"My Project":renderClientPortal,
    "WhatsApp":renderWhatsApp,
    "Email":renderEmailTab,
    "This Device":renderThisDevice,
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
        // Open the animation gate for this view change only. Any re-render
        // caused by incoming data lands after it has closed, so nothing replays.
        if(window._bootSettled){
          document.body.classList.add("anim-in");
          clearTimeout(window._animGate);
          window._animGate = setTimeout(()=>document.body.classList.remove("anim-in"), 800);
        }
        if(typeof window._runCountUps==="function") window._runCountUps(c);
      } else if(typeof _cntFmt==="function"){
        c.querySelectorAll(".cnt").forEach(el=>{ if(!el.dataset.done){ el.dataset.done="1"; el.textContent=_cntFmt(el); } });
      }
      if(state.tab==="Date & Time" && typeof window._dtInit==="function") window._dtInit();
      // The photo annotator is a full-screen overlay, so it is appended after
      // the tab has painted rather than being owned by any single screen.
      if(window._xlPick && typeof renderXlPicker==="function"){
        c.insertAdjacentHTML("beforeend", renderXlPicker());
      }
      if(window._profile && typeof renderProfilePanel==="function"){
        c.insertAdjacentHTML("beforeend", renderProfilePanel());
      }
      if(window._gsOpen && typeof renderGlobalSearch==="function"){
        c.insertAdjacentHTML("beforeend", renderGlobalSearch());
        setTimeout(()=>{ const e=document.getElementById("gsInput"); if(e && document.activeElement!==e) e.focus(); }, 40);
      }
      if(window._anno && typeof renderAnnoEditor==="function"){
        c.insertAdjacentHTML("beforeend", renderAnnoEditor());
        if(typeof annoPaint==="function") setTimeout(annoPaint, 40);
      }
    }catch(e){}
    // Synchronous — runs before the browser paints, so there is no visible jump
    try{ _uiRestore(_snap); }catch(e){}
  }
  catch(err){
    console.error("Render failed:", state.tab, err);
    c.innerHTML=`<div class="card" style="border-left:4px solid var(--red)"><div class="empty" style="color:var(--red);font-style:normal">⚠️ ${escapeHtml(state.tab)} failed to render<br><span style="font-size:11px;color:var(--muted)">${escapeHtml((err&&err.message)||String(err))}</span></div></div>`;
  }
  if(window.__navFade){
    window.__navFade=false;
    c.classList.remove("content-fade"); void c.offsetWidth; c.classList.add("content-fade");
  }
  // Navigation lands at the top; without this the document keeps the offset of
  // the view you just left and the new form opens half-way down.
  if(_isNav){ try{ const se=document.scrollingElement||document.documentElement; if(se) se.scrollTop=0; }catch(e){} }
}

// Coalesce data-driven re-renders: any burst of Firestore snapshots in the
// same frame collapses into ONE renderTab (was: 27+ full renders on load).
let _renderQueued=false;
function scheduleRender(){
  // During the opening seconds Firebase delivers ~30 collection snapshots. One
  // render per animation frame meant ~30 full DOM rebuilds in about a second,
  // and the layout visibly jumped as each batch of data arrived — that is the
  // rapid shake on first launch. While the stream is still flowing we coalesce
  // far more aggressively; once it settles we go back to frame-accurate paints.
  if(!window._bootSettled){
    clearTimeout(window._bootRenderTimer);
    window._bootRenderTimer = setTimeout(()=>{ if(state.initialized) renderTab(); }, 260);
    return;
  }
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
      <div style="background:var(--card);border-radius:16px;max-width:380px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
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
            <button onclick="window.applyPeriodPreset('thisMonth')" style="flex:1;min-width:90px;padding:7px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:#334155">This Month</button>
            <button onclick="window.applyPeriodPreset('lastMonth')" style="flex:1;min-width:90px;padding:7px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:#334155">Last Month</button>
            <button onclick="window.applyPeriodPreset('thisYear')" style="flex:1;min-width:90px;padding:7px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;color:#334155">This Year</button>
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
    return `<a href="${gpsMapLink(r.gpsLat,r.gpsLng)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;text-decoration:none">🛰️ GPS</a>`;
  }
  if(r.gpsDenied){
    return `<span style="display:inline-flex;align-items:center;gap:3px;background:#FFEBEE;color:#C62828;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600" title="${escapeHtml(r.gpsDenied)}">🚫 GPS</span>`;
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
  saveToast(`Permissions updated for ${employeeName} ✓`);
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
  saveToast("Client permissions updated ✓");
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
  if(!await uiConfirm("Reset daily entry counter?\n\nThis will remove numbering from all entries. Use \"Assign Numbers\" after to re-number from 001.")) return;
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



// ── Surface palettes (v185) ────────────────────────────────────────────
// The brand stays navy and gold; these change the surface it sits on. Stored
// per device rather than per account, because glare depends on where the
// person is standing, not on who they are.
const PALETTES = [
  {id:"light",    lb:"Classic",  sw:"#F5F8FC", note:"Crisp blue-white \u2014 the original"},
  {id:"sand",     lb:"Sand",     sw:"#F4F0E6", note:"Warm ivory \u2014 least glare in sunlight"},
  {id:"slate",    lb:"Slate",    sw:"#E7EDF4", note:"Cool grey-blue \u2014 tables separate clearly"},
  {id:"mist",     lb:"Mist",     sw:"#E8F1EF", note:"Soft teal \u2014 the freshest"},
  {id:"graphite", lb:"Graphite", sw:"#E9EAEC", note:"Neutral \u2014 no cast on photos"},
];
function currentPalette(){
  try{ return localStorage.getItem("girek-palette") || "light"; }catch(e){ return "light"; }
}
function applyPalette(id){
  const r=document.documentElement;
  if(!id || id==="light") r.removeAttribute("data-palette");
  else r.setAttribute("data-palette", id);
}
window.setPalette = function(id){
  if(!PALETTES.some(p=>p.id===id)) return;
  try{ localStorage.setItem("girek-palette", id); }catch(e){}
  applyPalette(id);
  render();
};
Object.assign(window,{PALETTES, currentPalette, applyPalette});

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
window.addEventListener('offline',()=>{try{if(window._shareMode)return;paintSyncPill();const d=document.getElementById('netDot');if(d)d.style.display='inline-flex';toast('⚠ Offline — your changes are saved locally and will sync automatically');}catch(e){}});
window.addEventListener('online',()=>{try{if(window._shareMode)return;paintSyncPill();const d=document.getElementById('netDot');if(d)d.style.display='none';toast('Back online — syncing ✓');}catch(e){}});

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
  // ═══ FORWARD-LOOKING ALERTS (v199) ═══════════════════════════════════
  // Everything above reports what has already gone wrong. These look at what
  // is ABOUT to: an invoice days from its due date, a project approaching its
  // estimate, cash committed but not collected. The figures all come from
  // functions the app already computes and tests — nothing new is calculated
  // here, it is only surfaced where a decision gets made.
  try{
    const _today = (typeof todayStr==="function") ? todayStr() : new Date().toISOString().slice(0,10);
    const _days = (from,to)=>{
      const a=new Date(String(from)+"T00:00:00Z"), b=new Date(String(to)+"T00:00:00Z");
      return (isNaN(a)||isNaN(b)) ? null : Math.round((b-a)/86400000);
    };

    // ── Money in ──
    if(typeof invoicesFor==="function" && typeof invTotals==="function" && typeof invStatus==="function"){
      const live=invoicesFor("").filter(v=>{
        const st=invStatus(v);
        return st!=="draft" && st!=="cancelled" && st!=="paid";
      });
      const overdue=live.filter(v=>invStatus(v)==="overdue");
      if(overdue.length){
        const worst=overdue.map(v=>daysPastDue(v)).sort((a,b)=>b-a)[0];
        const amt=overdue.reduce((s,v)=>s+invTotals(v).outstanding,0);
        out.push({sev:"high", icon:"\u23F0",
          title:`${overdue.length} invoice${overdue.length>1?"s are":" is"} overdue`,
          meta:`${curFmt(amt, curBase())} outstanding \u00b7 the oldest by ${worst} day${worst>1?"s":""}`,
          go:()=>{ window._finView="invoices"; switchTab("Finance"); }});
      }
      // Due within a week: the window in which a reminder still prevents the
      // problem rather than reporting it.
      const soon=live.filter(v=>{
        if(invStatus(v)==="overdue") return false;
        const d=_days(_today, invDueDate(v));
        return d!=null && d>=0 && d<=7;
      });
      if(soon.length){
        const amt=soon.reduce((s,v)=>s+invTotals(v).outstanding,0);
        out.push({sev:"med", icon:"\u{1F4C5}",
          title:`${soon.length} invoice${soon.length>1?"s fall":" falls"} due within 7 days`,
          meta:`${curFmt(amt, curBase())} \u00b7 chase before, not after`,
          go:()=>{ window._finView="invoices"; switchTab("Finance"); }});
      }
    }

    // ── Money out, and money nobody has asked for yet ──
    if(typeof cashPosition==="function"){
      const cash=cashPosition(curBase());
      if(cash.net<0)
        out.push({sev:"high", icon:"\u{1F4B0}",
          title:"More is owed out than is coming in",
          meta:`${curFmt(cash.receivable, cash.currency)} receivable against ${curFmt(cash.payable, cash.currency)} payable`,
          go:()=>{ window._finView="invoices"; switchTab("Finance"); }});
    }
    if(typeof advOutstandingTotals==="function"){
      const a=advOutstandingTotals();
      if(a.count)
        out.push({sev:a.count>3?"med":"low", icon:"\u{1F4B3}",
          title:`${a.count} work advance${a.count>1?"s are":" is"} unaccounted for`,
          meta:`${a.usd?"$"+a.usd.toLocaleString():""}${a.usd&&a.iqd?" + ":""}${a.iqd?a.iqd.toLocaleString()+" IQD":""} still in pockets`,
          go:()=>{ window._finView="advances"; switchTab("Finance"); }});
    }
    // Work earned but never billed is the quietest way to lose money: nothing
    // is late, because nobody ever asked for it.
    if(typeof invBillingPosition==="function"){
      (state.projects||[]).forEach(p=>{
        try{
          const b=invBillingPosition(p.name);
          if(b && b.earned>0 && b.unbilled > b.earned*0.25 && b.unbilled>0){
            out.push({sev:"med", icon:"\u{1F9FE}",
              title:`${p.name}: ${curFmt(b.unbilled, b.currency)} earned but not invoiced`,
              meta:`${b.pctBilled}% of the contract has been billed`,
              go:()=>{ window._finView="invoices"; switchTab("Finance"); }});
          }
        }catch(e){}
      });
    }

    // ── Margin, while it can still be acted on ──
    if(typeof projectFinance==="function"){
      (state.projects||[]).forEach(p=>{
        try{
          const f=projectFinance(p.name);
          if(!f || f.revenue<=0) return;
          if(f.level==="loss")
            out.push({sev:"high", icon:"\u{1F4C9}",
              title:`${p.name} is running at a loss`,
              meta:`cost ${curFmt(f.cost,f.currency)} against revenue ${curFmt(f.revenue,f.currency)}`,
              go:()=>{ window._finView="pl"; switchTab("Finance"); }});
          else if(f.level==="tight")
            out.push({sev:"med", icon:"\u26A0",
              title:`${p.name} margin is down to ${f.marginPct}%`,
              meta:"cost is within 15% of revenue",
              go:()=>{ window._finView="pl"; switchTab("Finance"); }});
          if(f.expensesUnconverted)
            out.push({sev:"med", icon:"\u{1F4B1}",
              title:`${p.name}: ${f.expensesUnconverted} expense(s) have no exchange rate`,
              meta:"they are excluded from every figure until fixed",
              go:()=>{ window._finView="expenses"; switchTab("Finance"); }});
        }catch(e){}
      });
    }

    // ── Claims waiting on a decision ──
    const pendingClaims=(state.expenseReports||[]).filter(r=>r.status==="submitted").length;
    if(pendingClaims)
      out.push({sev:"med", icon:"\u{1F9FE}",
        title:`${pendingClaims} expense report${pendingClaims>1?"s await":" awaits"} approval`,
        meta:"someone is out of pocket until this is signed",
        go:()=>{ window._finRepView="claims"; switchTab("Finance Report"); }});
  }catch(e){ console.warn("finance alerts:", e); }

  out.forEach(a=>{ a.key = a.icon+"|"+a.title; });    // stable key per alert
  const rank={high:0,med:1,low:2};

  // ═══ FORWARD-LOOKING ALERTS (v199) ═══════════════════════════════════
  // Everything above reports what has already gone wrong. These warn while
  // there is still time to act, which is the difference between a dashboard
  // that describes the business and one that protects it. All of it is computed
  // from data the app already holds — no new collection, no server.
  const _today = (typeof todayStr==="function") ? todayStr() : new Date().toISOString().slice(0,10);
  const _daysTo = (d)=>{
    if(!d) return null;
    const a=new Date(String(d)+"T00:00:00Z"), b=new Date(_today+"T00:00:00Z");
    return isNaN(a)?null:Math.round((a-b)/86400000);
  };

  // (A) Overdue invoices are NOT raised here: the app already warns on them.
  //     Only the FORWARD-looking half is new \u2014 an invoice that has not yet
  //     fallen due, which nothing else reports.


  // B) Cash position. Money owed to you against money you owe: the number that
  //    decides whether wages can be paid, and it is nowhere else in the app.
  // (B) The cash position is already reported above ("more owed out than
  //     coming in"). Only quotations about to lapse remain genuinely new.



  // (C) Unsettled advances already have their own alert above.

  // (D) Unbilled work already has its own per-project alert above.

  // (E) Project hours against estimate is NOT handled here: section 2 above
  //     already raises "near budget" and "over budget" from the same numbers.
  //     A second alert on the same condition produced two entries with two
  //     different keys, so dismissing one left the other behind and the alert
  //     appeared to be undismissable.

  // F) Preventive maintenance due within the week. Overdue PM is already
  //    reported elsewhere; this is the window in which it can still be planned.


  // G) Quotations about to lapse. A quotation that expires unanswered is a
  //    conversation that ended without anyone deciding to end it.
  try{
    const lapsing=(state.quotes||[]).filter(q=>{
      if((typeof quoteEffectiveStatus==="function"?quoteEffectiveStatus(q):q.status)!=="sent") return false;
      const d=_daysTo((typeof quoteValidUntil==="function")?quoteValidUntil(q):null);
      return d!=null && d>=0 && d<=7;
    });
    if(lapsing.length){
      out.push({sev:"med", icon:"\u{1F4B0}", key:"quo-lapse",
        title:`${lapsing.length} quotation${lapsing.length>1?"s expire":" expires"} within a week`,
        meta:lapsing.slice(0,2).map(q=>`${q.title||q.ref||""} (${q.client||""})`).join(", "),
        go:()=>{ window._finView="quotes"; switchTab("Finance"); }});
    }
  }catch(e){}

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
        <span style="font-size:14px">${a.icon}</span>
        <span style="display:flex;flex-direction:column;min-width:0">
          <span style="font-size:12px;font-weight:700;color:#5C4A12">${escapeHtml(a.title)}</span>
          <span style="font-size:10px;color:#8A7530">${escapeHtml(a.meta||'')}</span>
        </span>
      </span>
      <button onclick="event.stopPropagation();snoozeAlert(this.dataset.k)" data-k="${escapeHtml(a.key)}" title="Snooze 7 days" style="background:#F0E2B8;color:#7F6000;border:none;border-radius:8px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;flex:0 0 auto">${ICN.clock} 7d</button>
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

// ═══════════════════════════════════════════════════════════════════════
//  ELECTRONIC SIGNATURE (v160)
//  Every report already had two signature boxes — printed blank, signed by
//  hand, then scanned. Capturing the signature on the device closes that loop:
//  the PDF leaves the app already executed.
//  Pointer events cover finger, stylus and mouse with one code path.
// ═══════════════════════════════════════════════════════════════════════
window._sigStore = window._sigStore || {};          // { key: dataURL }

function signaturePad(key, label, hint){
  const has = !!window._sigStore[key];
  return `<div class="sig-wrap" data-sig="${key}">
    <div class="sig-head">
      <span class="sig-label">✍️ ${escapeHtml(label||"Signature")}</span>
      ${has?`<span class="sig-done">✓ Signed</span>`:""}
      <button type="button" class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="sigClear('${key}')">Clear</button>
    </div>
    ${has
      ? `<img src="${window._sigStore[key]}" class="sig-preview" alt="signature">`
      : `<canvas class="sig-canvas" id="sig_${key}" width="600" height="200"
           onpointerdown="sigStart(event,'${key}')" onpointermove="sigMove(event,'${key}')"
           onpointerup="sigEnd(event,'${key}')" onpointercancel="sigEnd(event,'${key}')"
           onpointerleave="sigEnd(event,'${key}')"></canvas>`}
    <div class="sig-hint">${escapeHtml(hint||"Sign inside the box with your finger")}</div>
  </div>`;
}
function _sigCtx(key){
  const cv = document.getElementById("sig_"+key);
  if(!cv) return null;
  if(!cv._ready){
    // Match the backing store to the displayed size so strokes land under the
    // finger instead of being offset — the usual signature-pad bug.
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width*dpr);
    cv.height = Math.round(r.height*dpr);
    const c = cv.getContext("2d");
    c.scale(dpr,dpr);
    c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = "#1B2A44";
    cv._ready = true;
  }
  return cv.getContext("2d");
}
function _sigPos(e,key){
  const cv = document.getElementById("sig_"+key);
  const r = cv.getBoundingClientRect();
  return { x:e.clientX-r.left, y:e.clientY-r.top };
}
window.sigStart=function(e,key){
  e.preventDefault();
  window._sigLastDraw=Date.now();   // suppresses swipe-to-change-tab; see setupSwipeNavigation
  const c=_sigCtx(key); if(!c) return;
  const p=_sigPos(e,key);
  c.beginPath(); c.moveTo(p.x,p.y);
  const cv=document.getElementById("sig_"+key);
  cv._drawing=true;   // _dirty is set in sigMove: ink requires movement
};
window.sigMove=function(e,key){
  const cv=document.getElementById("sig_"+key);
  if(!cv||!cv._drawing) return;
  e.preventDefault();
  const c=_sigCtx(key); const p=_sigPos(e,key);
  c.lineTo(p.x,p.y); c.stroke();
  cv._dirty=true;                    // real ink on the canvas
  window._sigLastDraw=Date.now();
};
window.sigEnd=function(e,key){
  const cv=document.getElementById("sig_"+key);
  if(!cv||!cv._drawing) return;
  cv._drawing=false;
  window._sigLastDraw=Date.now();
  if(cv._dirty){
    // Trim the transparent margin so the signature sits tight in the PDF cell.
    let img=null;
    try{ img=_sigTrim(cv); }catch(_){ img=cv.toDataURL("image/png"); }
    if(img) window._sigStore[key]=img;   // a blank pad is never recorded as signed
    else    cv._dirty=false;
  }
};
function _sigTrim(cv){
  const c=cv.getContext("2d");
  const {width:w,height:h}=cv;
  const d=c.getImageData(0,0,w,h).data;
  let x0=w,y0=h,x1=0,y1=0,found=false;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    if(d[(y*w+x)*4+3]>8){ found=true;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  }
  if(!found) return null;            // nothing was drawn — caller must not store this
  const pad=8;
  x0=Math.max(0,x0-pad); y0=Math.max(0,y0-pad);
  x1=Math.min(w-1,x1+pad); y1=Math.min(h-1,y1+pad);
  const out=document.createElement("canvas");
  out.width=x1-x0+1; out.height=y1-y0+1;
  out.getContext("2d").drawImage(cv,x0,y0,out.width,out.height,0,0,out.width,out.height);
  return out.toDataURL("image/png");
}
window.sigClear=function(key){
  delete window._sigStore[key];
  const cv=document.getElementById("sig_"+key);
  if(cv){ const c=cv.getContext("2d"); c.clearRect(0,0,cv.width,cv.height); cv._dirty=false; cv._ready=false; }
  render();
};
// Signature block for the branded PDFs — the captured image, or the ruled line
// to sign by hand when nobody signed on the device.
function sigBlockHTML(key, name, title, org){
  const img = window._sigStore[key];
  return `<td style="border:1px solid #ccc;padding:14px;width:50%;vertical-align:top;font-size:12px">
    <strong>${escapeHtml(name||"—")}</strong><br>${escapeHtml(title||"")}<br>${escapeHtml(org||"")}
    ${img ? `<div style="margin-top:10px"><img src="${img}" style="max-height:52px;max-width:190px"></div>
             <div style="border-top:1px solid #999;margin-top:2px;padding-top:3px;color:#666;font-size:9.5px">Signed electronically · ${fmtDate(today())}</div>`
          : `<div style="height:46px"></div><div style="border-top:1px solid #999;padding-top:3px;color:#888;font-size:10.5px">Date &amp; Signature</div>`}
  </td>`;
}
Object.assign(window,{signaturePad,sigBlockHTML});

// ═══════════════════════════════════════════════════════════════════════
//  SLA CLOCK & CONTRACT PROFITABILITY (v161)
//  A global 24h target says nothing about a specific contract. Asiacell may
//  owe 4-hour response while a small site owes 48 — and nobody could see
//  whether either was met, or whether a project was earning or losing money,
//  until long after the fact.
//
//  Response time is measured from the moment a client request is raised to the
//  first work entry logged against that project afterwards: the first time
//  someone actually turned up. Profitability is real logged hours × cost,
//  plus per diem, against the contract value.
// ═══════════════════════════════════════════════════════════════════════
function projectSLA(project){
  const p = (state.projects||[]).find(x=>(x.name||"").trim()===(project||"").trim());
  const g = getSLA();
  return {
    responseHrs: Number(p&&p.slaResponseHrs) || g.responseHrs,
    resolveHrs:  Number(p&&p.slaResolveHrs)  || g.completeHrs,
    perProject:  !!(p && (p.slaResponseHrs || p.slaResolveHrs)),
  };
}
// Hours between a request being raised and the first attendance after it.
function slaResponseFor(req){
  if(!req || !req.createdAt) return null;
  const raised = new Date(req.createdAt);
  if(isNaN(raised)) return null;
  const proj = (req.project||"").trim();
  // Firestore keeps entry dates as YYYY-MM-DD, so same-day attendance counts as
  // the start of that day at the earliest — we compare on dates, not clock time.
  const rows = (state.daily||[])
    .filter(r=>(r.project||"").trim()===proj && r.date && new Date(r.date+"T23:59:59") >= raised)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const first = rows[0];
  const answered = first ? new Date(first.date+"T"+((first.start||"09:00")+":00")) : null;
  const end = answered || appNow();
  const hrs = Math.max(0, (end - raised) / 3600000);
  return { hrs:+hrs.toFixed(1), answered:!!answered, at:first?first.date:null, entryNo:first?first.entryNo:null };
}
function slaStateOf(req){
  const r = slaResponseFor(req);
  if(!r) return null;
  const target = projectSLA(req.project).responseHrs;
  const pct = target>0 ? r.hrs/target : 0;
  const level = pct>1 ? "breached" : pct>0.75 ? "atRisk" : "met";
  return {...r, target, pct:Math.round(pct*100), level, open:!r.answered};
}
const SLA_STYLE = {
  met:     {lb:"Within SLA", bg:"var(--ok-bg)",     fg:"var(--ok)"},
  atRisk:  {lb:"At risk",    bg:"var(--warn-bg)",   fg:"var(--warn)"},
  breached:{lb:"Breached",   bg:"var(--danger-bg)", fg:"var(--danger)"},
};
function slaBadge(req){
  const s = slaStateOf(req);
  if(!s) return "";
  const st = SLA_STYLE[s.level];
  const detail = s.answered
    ? `answered in ${fmtHM(s.hrs)} of ${s.target}h`
    : `${fmtHM(s.hrs)} elapsed, target ${s.target}h — still open`;
  return `<span class="sla-badge" style="background:${st.bg};color:${st.fg}" title="${escapeHtml(detail)}">
    ⏱ ${st.lb} · ${s.pct}%</span>`;
}
// Portfolio compliance — the number that goes in front of a client.
function slaCompliance(project){
  const reqs = (state.clientRequests||[]).filter(r=>
    r.createdAt && (!project || (r.project||"").trim()===String(project).trim()));
  const scored = reqs.map(slaStateOf).filter(Boolean);
  if(!scored.length) return null;
  const met = scored.filter(s=>s.level!=="breached").length;
  return { total:scored.length, met, breached:scored.length-met,
           pct:Math.round(met/scored.length*100),
           open:scored.filter(s=>s.open).length };
}
// Money. Cost of the work actually logged against the contract value.
function projectEconomics(name){
  const p = (state.projects||[]).find(x=>(x.name||"").trim()===(name||"").trim());
  if(!p) return null;
  const rate  = Number(p.hourlyCost)||0;
  const value = Number(p.contractValue)||0;
  const rows  = (state.daily||[]).filter(r=>(r.project||"").trim()===(name||"").trim());
  const hours = rows.reduce((s,r)=>s+Number(r.duration||0),0);
  const perDiem = (state.travel||[])
    .filter(t=>(t.project||"").trim()===(name||"").trim())
    .reduce((s,t)=>s+Number(t.perDiem||0),0);
  const cost = hours*rate + perDiem;
  if(!value && !rate) return null;         // nothing to compare against yet
  const margin = value ? value-cost : null;
  return { hours:+hours.toFixed(1), rate, perDiem, cost:Math.round(cost), value,
           margin: margin===null?null:Math.round(margin),
           marginPct: (value>0) ? Math.round((value-cost)/value*100) : null,
           level: value<=0 ? "unknown" : cost>value ? "loss" : cost>value*0.85 ? "tight" : "healthy" };
}
Object.assign(window,{projectSLA,slaResponseFor,slaStateOf,slaBadge,slaCompliance,projectEconomics});

// ═══ UNIVERSAL SEARCH (v196) ════════════════════════════════════════════
// With 37 screens across 7 groups, finding a known thing meant remembering
// which menu it lived under. This is deliberately NOT the command palette that
// was rejected at v77: no keyboard shortcut, no floating overlay, no commands.
// It is a plain search field in the header that finds RECORDS — a project, a
// device, an incident, a document number — and takes you to it.
window._gsQ = window._gsQ || "";
window._gsOpen = window._gsOpen || false;

const GS_SOURCES = [
  {key:"projects",   ic:"\u{1F3D7}\uFE0F", lb:"Project",   tab:"Projects",
   fields:["name","client","dept","status"], title:r=>r.name, sub:r=>[r.client,r.dept].filter(Boolean).join(" \u00b7 "),
   open:"editProj",
   profile:r=>["project", r.name]},
  {key:"devices",    ic:"\u{1F5A5}\uFE0F", lb:"Device",    tab:"Assets",
   fields:["deviceName","serialNumber","deviceCode","model","brand","system","project","site"],
   title:r=>r.deviceName||r.serialNumber, sub:r=>[r.serialNumber,r.model,r.project].filter(Boolean).join(" \u00b7 "),
   open:"editDevice",
   profile:r=>["device", r.id]},
  {key:"clients",    ic:"\u{1F464}", lb:"Client",    tab:"Clients",
   fields:["name","contact","email","phone"], title:r=>r.name, sub:r=>[r.contact,r.phone].filter(Boolean).join(" \u00b7 "),
   open:"editClient",
   profile:r=>["client", r.name]},
  {key:"incidents",  ic:"\u{1F6A8}", lb:"Incident",  tab:"Incidents",
   fields:["title","project","system","status","severity","ref"],
   title:r=>r.title, sub:r=>[r.project,r.date&&fmtDate(r.date),r.status].filter(Boolean).join(" \u00b7 "),
   open:"editIncident"},
  {key:"pmSchedules",ic:"\u{1F6E0}\uFE0F", lb:"Maintenance", tab:"Maintenance",
   fields:["title","project","system"], title:r=>r.title, sub:r=>[r.project,r.system].filter(Boolean).join(" \u00b7 ")},
  {key:"tasks",      ic:"\u2705", lb:"Task",      tab:"My Tasks",
   fields:["title","assignee","project","status"], title:r=>r.title, sub:r=>[r.assignee,r.status].filter(Boolean).join(" \u00b7 ")},
  {key:"clientRequests",ic:"\u{1F4E8}", lb:"Request", tab:"Requests",
   fields:["title","project","client","status","ref"], title:r=>r.title, sub:r=>[r.client,r.status].filter(Boolean).join(" \u00b7 ")},
  {key:"quotes",     ic:"\u{1F4B0}", lb:"Quotation", tab:"Finance", view:["_finView","quotes"],
   fields:["ref","title","client","project"], title:r=>r.title||r.ref, sub:r=>[r.ref,r.client].filter(Boolean).join(" \u00b7 "),
   open:"quoEdit"},
  {key:"invoices",   ic:"\u{1F9FE}", lb:"Invoice",  tab:"Finance", view:["_finView","invoices"],
   fields:["ref","title","client","project"], title:r=>r.title||r.ref, sub:r=>[r.ref,r.client].filter(Boolean).join(" \u00b7 "),
   open:"invEdit"},
  {key:"variations", ic:"\u{1F501}", lb:"Variation", tab:"Finance", view:["_finView","variations"],
   fields:["ref","title","project","reason"], title:r=>r.title||r.ref, sub:r=>[r.ref,r.project].filter(Boolean).join(" \u00b7 "),
   open:"varEdit"},
  {key:"expenses",   ic:"\u{1F4B8}", lb:"Expense",  tab:"Finance", view:["_finView","expenses"],
   fields:["desc","payee","invoiceRef","project","category"], title:r=>r.desc, sub:r=>[r.payee,r.project].filter(Boolean).join(" \u00b7 "),
   open:"expEdit"},
  {key:"expenseReports",ic:"\u{1F9FE}", lb:"Expense report", tab:"Finance Report", view:["_finRepView","claims"],
   fields:["ref","employee","department"], title:r=>r.employee, sub:r=>[r.ref,r.date&&fmtDate(r.date)].filter(Boolean).join(" \u00b7 "),
   open:"exrEdit"},
  {key:"advances",   ic:"\u{1F4B3}", lb:"Advance",  tab:"Finance", view:["_finView","advances"],
   fields:["employee","purpose","ref","project","projects"], title:r=>r.employee, sub:r=>[r.purpose,r.ref].filter(Boolean).join(" \u00b7 "),
   open:"advEdit"},
  {key:"parts",      ic:"\u{1F527}", lb:"Part",     tab:"Assets", view:["_assetView","parts"],
   fields:["code","name","unit"], title:r=>r.name, sub:r=>r.code},
  // People are what gets looked up most, and they were the one thing missing.
  // Two records describe them \u2014 a login account and a nametag-only entry \u2014 so
  // both are searched, and the result says which it is.
  {key:"users",      ic:"\u{1F464}", lb:"User",     tab:"Users",
   fields:["name","employeeName","email","role","branch","department"],
   title:r=>r.employeeName||r.name, sub:r=>[r.role,r.email].filter(Boolean).join(" \u00b7 "),
   open:"editUser",
   profile:r=>["employee", (r.employeeName||r.name)]},
  {key:"nametagEmployees", ic:"\u{1F465}", lb:"Employee", tab:"Users",
   fields:["name","type","branch","department","title"],
   title:r=>r.name, sub:r=>[r.title,r.type==="external"?"External / Outsource":"Internal"].filter(Boolean).join(" \u00b7 "),
   open:"editNametagEmp",
   profile:r=>["employee", r.name]},
];

// Ranked, not merely filtered: an exact match on a reference number should beat
// a stray word buried in a description, or the result list is noise.
function gsSearch(q, limit){
  const needle=String(q||"").trim().toLowerCase();
  if(needle.length<2) return [];
  const out=[];
  GS_SOURCES.forEach(S=>{
    const rows=state[S.key];
    if(!Array.isArray(rows)) return;
    rows.forEach(r=>{
      let best=0;
      for(const f of S.fields){
        const v=String(r[f]==null?"":r[f]).toLowerCase();
        if(!v) continue;
        if(v===needle){ best=Math.max(best,100); break; }
        if(v.startsWith(needle)) best=Math.max(best,70);
        else if(v.includes(needle)) best=Math.max(best,40);
      }
      if(best) out.push({score:best, src:S, row:r});
    });
  });
  out.sort((a,b)=> b.score-a.score ||
    String(a.src.lb).localeCompare(String(b.src.lb)) ||
    String(a.src.title(a.row)||"").localeCompare(String(b.src.title(b.row)||"")));
  return out.slice(0, limit||30);
}

window.gsToggle = function(){
  window._gsOpen=!window._gsOpen;
  if(!window._gsOpen) window._gsQ="";
  render();
  if(window._gsOpen) setTimeout(()=>{ const e=document.getElementById("gsInput"); if(e) e.focus(); }, 60);
};
window.gsSet = function(v){
  window._gsQ=v;
  const box=document.getElementById("gsResults");
  if(box) box.innerHTML=gsResultsHTML();
};
window.gsGo = function(key, id){
  const S=GS_SOURCES.find(x=>x.key===key);
  if(!S) return;
  const row=(state[S.key]||[]).find(r=>String(r.id)===String(id));
  window._gsOpen=false; window._gsQ="";
  // Where a profile exists, that is the answer to "show me this". Opening an
  // edit form instead answers a question nobody asked: someone searching for a
  // person wants their hours, projects and advances, not a name field.
  if(row && typeof S.profile==="function"){
    try{
      const [kind,pid]=S.profile(row);
      if(kind && pid){ window._profile={kind, id:pid}; render(); return; }
    }catch(e){}
  }
  if(S.view) window[S.view[0]]=S.view[1];
  window._gsFocusId=id;
  if(typeof switchTab==="function") switchTab(S.tab); else { state.tab=S.tab; render(); }

  // Landing on the right SCREEN is not the same as finding the right RECORD.
  // Searching for one device and being shown a list of four hundred is the
  // failure this whole feature exists to remove, so after the tab has painted
  // we run that screen's own "open this record" action — the same function its
  // edit button calls, so the record opens exactly as it always does.
  setTimeout(()=>{
    let opened=false;
    try{
      // Call the function BY REFERENCE with the id as an argument. The earlier
      // version built a source string and eval'd it, which failed inside a
      // module scope and would have executed any id containing a quote.
      const fn = S.open ? window[S.open] : null;
      if(row && typeof fn==="function"){ fn(row.id); opened=true; }
    }catch(e){ console.warn("search deep-link failed:", e); }
    // Where a screen has no editor to open, scroll the row into view and mark
    // it instead. Doing nothing at all would repeat the original complaint.
    if(!opened) gsHighlight(id);
  }, 260);
};
// Find the row by its id anywhere on the page, bring it into view, and flash a
// ring around it so the eye lands on it without hunting.
window.gsHighlight = function(id){
  if(!id) return;
  try{
    const esc = (window.CSS && CSS.escape) ? CSS.escape(String(id)) : String(id).replace(/["\\]/g,"\\$&");
    const el = document.querySelector(`[data-id="${esc}"]`) ||
               document.querySelector(`[onclick*="${esc}"]`);
    if(!el) return;
    const card = el.closest(".card, tr, .proj-card, .dev-row") || el;
    card.scrollIntoView({block:"center", behavior:"smooth"});
    card.classList.add("gs-found");
    setTimeout(()=>card.classList.remove("gs-found"), 2600);
  }catch(e){}
};

function gsResultsHTML(){
  const q=window._gsQ||"";
  if(String(q).trim().length<2)
    return `<div class="gs-hint">Type at least two characters. Searches projects, devices, clients, incidents, maintenance, tasks, requests and every financial document \u2014 including reference numbers.</div>`;
  const hits=gsSearch(q, 30);
  if(!hits.length)
    return `<div class="gs-hint">Nothing matches \u201c${escapeHtml(q)}\u201d. Reference numbers, serial numbers and client names all work here.</div>`;
  return hits.map(h=>{
    const t=String(h.src.title(h.row)||"\u2014");
    const s=String(h.src.sub(h.row)||"");
    return `<button class="gs-row" onclick="gsGo(${jsArg(h.src.key)},${jsArg(h.row.id||"")})">
      <span class="gs-ic">${h.src.ic}</span>
      <span class="gs-txt">
        <span class="gs-t">${escapeHtml(t)}</span>
        ${s?`<span class="gs-s">${escapeHtml(s)}</span>`:""}
      </span>
      <span class="gs-tag">${escapeHtml(h.src.lb)}</span>
    </button>`;
  }).join("");
}
function renderGlobalSearch(){
  if(!window._gsOpen) return "";
  return `<div class="gs-ov" onclick="if(event.target===this)gsToggle()">
    <div class="gs-box">
      <div class="gs-hd">
        <input id="gsInput" value="${escapeHtml(window._gsQ||"")}" oninput="gsSet(this.value)"
               placeholder="Search anything \u2014 name, serial, reference\u2026" autocomplete="off">
        <button class="btn btn-sm btn-secondary" onclick="gsToggle()">Close</button>
      </div>
      <div class="gs-results" id="gsResults">${gsResultsHTML()}</div>
    </div>
  </div>`;
}
Object.assign(window,{gsSearch, renderGlobalSearch, gsResultsHTML, GS_SOURCES});

// ═══ RECORD PROFILE (v198) ══════════════════════════════════════════════
// Searching for "Siwar" and being shown an edit form answers the wrong
// question. The question is "show me everything about this person" — hours,
// projects, advances, leave. Same for a project, a device, a client. This
// assembles that view from the collections the app already holds, and the edit
// form becomes one button on it rather than the destination.
window._profile = window._profile || null;   // {kind, id}

window.openProfile = function(kind, id){
  window._profile = {kind, id};
  window._gsOpen = false; window._gsQ = "";
  render();
};
window.closeProfile = function(){ window._profile=null; render(); };

const _pfSum = (rows, f)=> rows.reduce((s,r)=>s+(Number(f(r))||0), 0);
const _pfDate = (d)=> d ? (typeof fmtDate==="function"?fmtDate(d):d) : "\u2014";

// A block of the profile: a heading, a count, and up to `max` rows. Anything
// beyond that is summarised rather than dumped, because a technician with four
// hundred entries needs the shape of the data, not all of it.
function _pfBlock(title, icon, rows, renderRow, opts){
  opts = opts || {};
  const max = opts.max || 8;
  const shown = rows.slice(0, max);
  return `<div class="pf-block">
    <div class="pf-bh">${icon} ${escapeHtml(title)}
      <span class="pf-count">${rows.length}</span>
      ${opts.total?`<span class="pf-total">${opts.total}</span>`:""}
    </div>
    ${rows.length
      ? shown.map(renderRow).join("") +
        (rows.length>max?`<div class="pf-more">+ ${rows.length-max} more \u2014 open the full screen to see them all</div>`:"")
      : `<div class="pf-none">Nothing recorded.</div>`}
  </div>`;
}
function _pfRow(main, meta, right){
  return `<div class="pf-row">
    <div class="pf-main"><div class="pf-t">${main}</div>${meta?`<div class="pf-m">${meta}</div>`:""}</div>
    ${right?`<div class="pf-r">${right}</div>`:""}
  </div>`;
}
function _pfStat(label, value, colour){
  return `<div class="pf-stat"><div class="pf-sv"${colour?` style="color:${colour}"`:""}>${value}</div><div class="pf-sl">${escapeHtml(label)}</div></div>`;
}

// ── Employee profile: the whole working picture in one place ──────────────
function profileEmployee(name){
  const n=String(name||"").trim();
  const eq=(v)=>String(v||"").trim()===n;
  const daily=(state.daily||[]).filter(r=>eq(r.employee)).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const ot=(state.overtime||[]).filter(r=>eq(r.employee));
  const tr=(state.travel||[]).filter(r=>eq(r.employee));
  const lv=(state.leaves||[]).filter(r=>eq(r.employee));
  const adv=(state.advances||[]).filter(r=>eq(r.employee));
  const claims=(state.expenseReports||[]).filter(r=>eq(r.employee));
  const tasks=(state.tasks||[]).filter(r=>eq(r.assignee) && String(r.status||"").toLowerCase()!=="done");
  const hours=_pfSum(daily,r=>r.duration);
  const otH=_pfSum(ot,r=>r.hours);
  const projects={};
  daily.forEach(r=>{ const p=(r.project||"\u2014").trim(); projects[p]=(projects[p]||0)+Number(r.duration||0); });
  const byProj=Object.entries(projects).sort((a,b)=>b[1]-a[1]);
  const pending=daily.filter(r=>typeof isPendingAppr==="function" && isPendingAppr(r)).length;
  const openAdv=adv.filter(a=>typeof advSettledFully==="function" ? !advSettledFully(a) : true);

  return `
  <div class="pf-stats">
    ${_pfStat("Hours logged", fmtHM(hours))}
    ${_pfStat("Overtime", otH?fmtHM(otH):"\u2014", otH?"#E65100":"")}
    ${_pfStat("Entries", String(daily.length))}
    ${_pfStat("Projects", String(byProj.length))}
    ${pending?_pfStat("Awaiting approval", String(pending), "#8F6E22"):""}
    ${openAdv.length?_pfStat("Open advances", String(openAdv.length), "#E65100"):""}
  </div>
  ${byProj.length?`<div class="pf-block">
    <div class="pf-bh">\u{1F3D7}\uFE0F Where the time went <span class="pf-count">${byProj.length}</span></div>
    ${byProj.slice(0,8).map(([p,h])=>_pfRow(escapeHtml(p),
        `${hours?Math.round(h/hours*100):0}% of total`, fmtHM(h))).join("")}
  </div>`:""}
  ${_pfBlock("Recent work","\u23F1\uFE0F",daily,r=>_pfRow(
      escapeHtml(r.project||"\u2014"),
      `${_pfDate(r.date)}${r.taskCategory?" \u00b7 "+escapeHtml(r.taskCategory):""}${r.site?" \u00b7 "+escapeHtml(r.site):""}`,
      fmtHM(Number(r.duration||0))))}
  ${tasks.length?_pfBlock("Open tasks","\u2705",tasks,t=>_pfRow(
      escapeHtml(t.title||"\u2014"),
      `${t.project?escapeHtml(t.project)+" \u00b7 ":""}${escapeHtml(t.status||"")}`,
      t.due?_pfDate(t.due):"")):""}
  ${openAdv.length?_pfBlock("Advances not yet settled","\u{1F4B3}",openAdv,a=>{
      const o=(typeof advOutstanding==="function")?advOutstanding(a):{usd:a.usd,iqd:a.iqd};
      return _pfRow(escapeHtml(a.purpose||"Advance"),
        `${_pfDate(a.date)}${a.ref?" \u00b7 "+escapeHtml(a.ref):""}`,
        `${o.usd?"$"+o.usd.toLocaleString():""}${o.usd&&o.iqd?" + ":""}${o.iqd?o.iqd.toLocaleString()+" IQD":""}`);
    }):""}
  ${claims.length?_pfBlock("Expense reports","\u{1F9FE}",claims,r=>_pfRow(
      escapeHtml(r.ref||"Claim"), _pfDate(r.date),
      escapeHtml((typeof EXR_STATUS!=="undefined" && EXR_STATUS[r.status||"draft"]||{lb:""}).lb||""))):""}
  ${tr.length?_pfBlock("Travel","\u2708\uFE0F",tr,r=>_pfRow(
      escapeHtml(r.destination||r.project||"\u2014"),
      `${_pfDate(r.from||r.date)}${r.to?" \u2192 "+_pfDate(r.to):""}`,
      r.perDiem?fmtMoney(r.perDiem):"")):""}
  ${lv.length?_pfBlock("Leave","\u{1F334}",lv,r=>_pfRow(
      escapeHtml(r.type||"Leave"),
      `${_pfDate(r.from)} \u2192 ${_pfDate(r.to)}`,
      // fmtDays() exists precisely so a two-hour leave never prints as
      // "0.2222222222222222d". This row was the one place still bypassing it.
      r.days?fmtDays(r.days):"")):""}`;
}

// ── Project profile: cost, people, assets, documents ─────────────────────
function profileProject(name){
  const n=String(name||"").trim();
  const eq=(v)=>String(v||"").trim()===n;
  const p=(state.projects||[]).find(x=>eq(x.name))||{};
  const daily=(state.daily||[]).filter(r=>eq(r.project)).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const devices=(state.devices||[]).filter(r=>eq(r.project));
  const inc=(state.incidents||[]).filter(r=>eq(r.project));
  const pms=(state.pmSchedules||[]).filter(r=>eq(r.project));
  const invs=(state.invoices||[]).filter(r=>eq(r.project));
  const quotes=(state.quotes||[]).filter(r=>eq(r.project));
  const vars=(state.variations||[]).filter(r=>eq(r.project));
  const exps=(state.expenses||[]).filter(r=>eq(r.project));
  const hours=_pfSum(daily,r=>r.duration);
  const fin=(typeof projectFinance==="function")?projectFinance(n):null;
  const people={};
  daily.forEach(r=>{ const e=(r.employee||"\u2014").trim(); people[e]=(people[e]||0)+Number(r.duration||0); });
  const byPerson=Object.entries(people).sort((a,b)=>b[1]-a[1]);
  const openInc=inc.filter(i=>String(i.status||"").toLowerCase()!=="closed");

  return `
  <div class="pf-stats">
    ${_pfStat("Hours", fmtHM(hours))}
    ${_pfStat("People", String(byPerson.length))}
    ${_pfStat("Devices", String(devices.length))}
    ${openInc.length?_pfStat("Open incidents", String(openInc.length), "#C62828"):_pfStat("Incidents", String(inc.length))}
    ${fin&&fin.revenue>0?_pfStat("Margin", (fin.marginPct!=null?fin.marginPct+"%":"\u2014"),
        fin.margin<0?"#C62828":"#2E7D32"):""}
  </div>
  ${fin&&fin.revenue>0?`<div class="pf-block">
    <div class="pf-bh">\u{1F4CA} Money</div>
    ${_pfRow("Revenue","contract + approved variations", curFmt(fin.revenue,fin.currency))}
    ${_pfRow("Cost","labour, overtime, travel, material, expenses", curFmt(fin.cost,fin.currency))}
    ${_pfRow("<strong>Margin</strong>","", `<strong style="color:${fin.margin<0?"#C62828":"#2E7D32"}">${curFmt(fin.margin,fin.currency)}</strong>`)}
  </div>`:""}
  ${typeof evmCard==="function"?evmCard(name):""}
  ${typeof footprintCard==="function"?footprintCard(name):""}
  ${byPerson.length?`<div class="pf-block">
    <div class="pf-bh">\u{1F465} Who worked on it <span class="pf-count">${byPerson.length}</span></div>
    ${byPerson.slice(0,8).map(([e,h])=>_pfRow(escapeHtml(e),
        `${hours?Math.round(h/hours*100):0}% of the hours`, fmtHM(h))).join("")}
  </div>`:""}
  ${openInc.length?_pfBlock("Open incidents","\u{1F6A8}",openInc,i=>_pfRow(
      escapeHtml(i.title||"\u2014"),
      `${_pfDate(i.date)}${i.system?" \u00b7 "+escapeHtml(i.system):""}`,
      escapeHtml(i.severity||""))):""}
  ${_pfBlock("Devices","\u{1F5A5}\uFE0F",devices,d=>_pfRow(
      escapeHtml(d.deviceName||d.serialNumber||"\u2014"),
      `${d.serialNumber?escapeHtml(d.serialNumber):""}${d.site?" \u00b7 "+escapeHtml(d.site):""}`,
      escapeHtml(d.system||"")))}
  ${pms.length?_pfBlock("Maintenance schedules","\u{1F6E0}\uFE0F",pms,s=>_pfRow(
      escapeHtml(s.title||"\u2014"),
      s.freqDays?`every ${escapeHtml(String(s.freqDays))} days`:"",
      (typeof pmNextDue==="function"&&pmNextDue(s))?_pfDate(pmNextDue(s)):"")):""}
  ${invs.length?_pfBlock("Invoices","\u{1F9FE}",invs,v=>{
      const t=(typeof invTotals==="function")?invTotals(v):{total:v.total||0,outstanding:0};
      return _pfRow(escapeHtml(v.ref||v.title||"Invoice"), _pfDate(v.date),
        `${curFmt(t.total,v.currency)}${t.outstanding?` <span style="color:#C62828">(${curFmt(t.outstanding,v.currency)} due)</span>`:""}`);
    }):""}
  ${quotes.length?_pfBlock("Quotations","\u{1F4B0}",quotes,q=>_pfRow(
      escapeHtml(q.title||q.ref||"\u2014"), _pfDate(q.date),
      escapeHtml(String(q.status||"")))):""}
  ${vars.length?_pfBlock("Variations","\u{1F501}",vars,v=>_pfRow(
      escapeHtml(v.title||"\u2014"), escapeHtml(v.status||""),
      (typeof varTotals==="function")?curFmt(varTotals(v).total,v.currency):"")):""}
  ${exps.length?_pfBlock("Expenses","\u{1F4B8}",exps,e=>_pfRow(
      escapeHtml(e.desc||"\u2014"),
      `${_pfDate(e.date)}${e.payee?" \u00b7 "+escapeHtml(e.payee):""}`,
      curFmt(num(e.amount), e.currency))):""}
  ${_pfBlock("Recent work","\u23F1\uFE0F",daily,r=>_pfRow(
      escapeHtml(r.employee||"\u2014"),
      `${_pfDate(r.date)}${r.taskCategory?" \u00b7 "+escapeHtml(r.taskCategory):""}`,
      fmtHM(Number(r.duration||0))))}`;
}

// ── Device profile: its history, not its form ────────────────────────────
function profileDevice(id){
  const d=(state.devices||[]).find(x=>String(x.id)===String(id))||{};
  const sn=String(d.serialNumber||"").trim().toLowerCase();
  const nm=String(d.deviceName||"").trim().toLowerCase();
  const inc=(state.incidents||[]).filter(i=>{
    const blob=[i.title,i.description,i.deviceName,i.serialNumber,i.deviceId].map(x=>String(x||"").toLowerCase()).join(" ");
    return (sn&&blob.includes(sn)) || String(i.deviceId||"")===String(d.id) || (nm&&blob.includes(nm));
  });
  const pms=(state.pmSchedules||[]).filter(s=>String(s.project||"").trim()===String(d.project||"").trim());
  const today=(typeof todayStr==="function")?todayStr():new Date().toISOString().slice(0,10);
  const warrantyLeft = d.warrantyEnd ? (String(d.warrantyEnd)>=today) : null;
  return `
  <div class="pf-stats">
    ${_pfStat("Incidents", String(inc.length), inc.length?"#C62828":"")}
    ${d.installDate?_pfStat("Installed", _pfDate(d.installDate)):""}
    ${d.warrantyEnd?_pfStat(warrantyLeft?"In warranty":"Warranty expired", _pfDate(d.warrantyEnd),
       warrantyLeft?"#2E7D32":"#C62828"):""}
    ${_pfStat("Status", escapeHtml(d.status||"\u2014"))}
  </div>
  <div class="pf-block">
    <div class="pf-bh">\u{1F5A5}\uFE0F Identity</div>
    ${_pfRow("Serial", "", escapeHtml(d.serialNumber||"\u2014"))}
    ${d.deviceCode?_pfRow("Code","",escapeHtml(d.deviceCode)):""}
    ${_pfRow("Model", escapeHtml(d.brand||""), escapeHtml(d.model||"\u2014"))}
    ${_pfRow("System","",escapeHtml(d.system||"\u2014"))}
    ${_pfRow("Location", escapeHtml(d.area||""), escapeHtml(d.site||d.project||"\u2014"))}
  </div>
  ${_pfBlock("Incident history","\u{1F6A8}",inc,i=>_pfRow(
      escapeHtml(i.title||"\u2014"),
      `${_pfDate(i.date)}${i.status?" \u00b7 "+escapeHtml(i.status):""}`,
      escapeHtml(i.severity||"")))}
  ${pms.length?_pfBlock("Maintenance covering this site","\u{1F6E0}\uFE0F",pms,s=>_pfRow(
      escapeHtml(s.title||"\u2014"),
      s.freqDays?`every ${escapeHtml(String(s.freqDays))} days`:"",
      (typeof pmNextDue==="function"&&pmNextDue(s))?_pfDate(pmNextDue(s)):"")):""}`;
}

// ── Client profile ───────────────────────────────────────────────────────
function profileClient(name){
  const n=String(name||"").trim();
  const eq=(v)=>String(v||"").trim()===n;
  const projects=(state.projects||[]).filter(p=>eq(p.client));
  const quotes=(state.quotes||[]).filter(q=>eq(q.client));
  const invs=(state.invoices||[]).filter(v=>eq(v.client));
  const reqs=(state.clientRequests||[]).filter(r=>eq(r.client));
  let billed=0, due=0;
  invs.forEach(v=>{ const t=(typeof invTotals==="function")?invTotals(v):{total:0,outstanding:0};
    billed+=t.total; due+=t.outstanding; });
  const openReq=reqs.filter(r=>String(r.status||"").toLowerCase()!=="closed");
  return `
  <div class="pf-stats">
    ${_pfStat("Projects", String(projects.length))}
    ${_pfStat("Invoiced", curFmt(billed, curBase()))}
    ${_pfStat("Outstanding", curFmt(due, curBase()), due?"#C62828":"#2E7D32")}
    ${openReq.length?_pfStat("Open requests", String(openReq.length), "#E65100"):""}
  </div>
  ${_pfBlock("Projects","\u{1F3D7}\uFE0F",projects,p=>_pfRow(
      escapeHtml(p.name||"\u2014"), escapeHtml(p.status||""),
      p.contractValue?curFmt(p.contractValue, p.contractCurrency||curBase()):""))}
  ${invs.length?_pfBlock("Invoices","\u{1F9FE}",invs,v=>{
      const t=(typeof invTotals==="function")?invTotals(v):{total:0,outstanding:0};
      return _pfRow(escapeHtml(v.ref||v.title||"Invoice"), _pfDate(v.date),
        `${curFmt(t.total,v.currency)}${t.outstanding?` <span style="color:#C62828">(${curFmt(t.outstanding,v.currency)} due)</span>`:""}`);
    }):""}
  ${quotes.length?_pfBlock("Quotations","\u{1F4B0}",quotes,q=>_pfRow(
      escapeHtml(q.title||q.ref||"\u2014"), _pfDate(q.date), escapeHtml(String(q.status||"")))):""}
  ${openReq.length?_pfBlock("Open requests","\u{1F4E8}",openReq,r=>_pfRow(
      escapeHtml(r.title||"\u2014"), _pfDate(String(r.createdAt||"").slice(0,10)),
      escapeHtml(r.status||""))):""}`;
}

// ── The panel ────────────────────────────────────────────────────────────
const PROFILE_KINDS = {
  employee: {ic:"\u{1F464}", lb:"Employee", body:(id)=>profileEmployee(id), edit:null},
  project:  {ic:"\u{1F3D7}\uFE0F", lb:"Project",  body:(id)=>profileProject(id),
             edit:(id)=>{ const p=(state.projects||[]).find(x=>String(x.name).trim()===String(id).trim());
                          return p?["editProj",p.id,"Projects"]:null; }},
  device:   {ic:"\u{1F5A5}\uFE0F", lb:"Device",   body:(id)=>profileDevice(id),
             edit:(id)=>["editDevice",id,"Assets"]},
  client:   {ic:"\u{1F464}", lb:"Client",   body:(id)=>profileClient(id),
             edit:(id)=>{ const c=(state.clients||[]).find(x=>String(x.name).trim()===String(id).trim());
                          return c?["editClient",c.id,"Clients"]:null; }},
};
window.profileEdit = function(){
  const P=window._profile; if(!P) return;
  const K=PROFILE_KINDS[P.kind]; if(!K||!K.edit) return;
  const spec=K.edit(P.id); if(!spec) return;
  const [fn,id,tab]=spec;
  window._profile=null;
  if(typeof switchTab==="function") switchTab(tab); else { state.tab=tab; render(); }
  setTimeout(()=>{ try{ if(typeof window[fn]==="function") window[fn](id); }catch(e){} }, 260);
};
function renderProfilePanel(){
  const P=window._profile; if(!P) return "";
  const K=PROFILE_KINDS[P.kind]; if(!K) return "";
  let body="";
  try{ body=K.body(P.id); }catch(e){ body=`<div class="pf-none">Could not assemble this profile.</div>`; }
  return `<div class="pf-ov" onclick="if(event.target===this)closeProfile()">
    <div class="pf-box">
      <div class="pf-hd">
        <span class="pf-hic">${K.ic}</span>
        <span class="pf-htxt"><span class="pf-hn">${escapeHtml(String(P.id))}</span>
          <span class="pf-hk">${escapeHtml(K.lb)}</span></span>
        ${K.edit?`<button class="btn btn-sm btn-secondary" onclick="profileEdit()">\u270e Edit</button>`:""}
        <button class="btn btn-sm btn-secondary" onclick="closeProfile()">Close</button>
      </div>
      <div class="pf-body">${body}</div>
    </div>
  </div>`;
}
Object.assign(window,{profileEmployee, profileProject, profileDevice, profileClient,
                      renderProfilePanel, PROFILE_KINDS});

// ═══ COPY A VALUE (v214) ════════════════════════════════════════════════
// With selection switched off on touch, the values people actually copy need a
// deliberate way out. A tap target beats a long press and a drag even when
// selection IS available: on a phone, selecting a 17-character serial number
// accurately is a fiddly operation that frequently grabs the label too.
window.copyValue = async function(text, label){
  const v=String(text==null?"":text).trim();
  if(!v) return;
  let ok=false;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(v); ok=true;
    }
  }catch(e){}
  if(!ok){
    // The clipboard API needs a secure context and a user gesture; neither is
    // guaranteed inside every installed web view, so fall back rather than
    // failing silently.
    try{
      const ta=document.createElement("textarea");
      ta.value=v;
      ta.setAttribute("readonly","");
      ta.style.cssText="position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, v.length);
      ok=document.execCommand("copy");
      ta.remove();
    }catch(e){}
  }
  try{ if(ok && navigator.vibrate) navigator.vibrate(20); }catch(e){}
  toast(ok ? `${label?escapeHtml(label)+": ":""}${v.length>28?v.slice(0,28)+"\u2026":v} copied`
           : "Could not copy \u2014 select the text and copy manually");
};
// A value with a copy affordance beside it. Used for the identifiers that get
// quoted elsewhere: serials, references, phone numbers.
function copyable(text, label){
  const v=String(text==null?"":text).trim();
  if(!v) return "\u2014";
  return `<span class="cp-wrap"><span class="sel">${escapeHtml(v)}</span>` +
    `<button class="cp-btn" onclick="event.stopPropagation();copyValue(${jsArg(v)},${jsArg(label||"")})" ` +
    `title="Copy" aria-label="Copy ${escapeHtml(label||v)}">` +
    `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button></span>`;
}
Object.assign(window,{copyValue, copyable});
