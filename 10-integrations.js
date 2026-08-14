function waGetSettings(){
  return state.waSettings || {
    enabledFields: ["employee","date","time","project","location","duration","resolutionText"],
    allowedRoles: ["admin"],
    triggers: ["daily","clientRequests"],
    messageHeader: "🔔 New Task — EJAF Operations",
  };
}

function renderWhatsApp(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Access denied — Admin only</div></div>`;
  if(!waContactForm) waContactForm = {name:"", type:"number", value:""};
  const s = waGetSettings();
  const contacts = state.waContacts || [];

  const wv = window._waView || "contacts";
  let h = _pills('_waView',[{id:"contacts",ic:"👥",lb:"Contacts"},{id:"options",ic:"🧩",lb:"Options"}]);
  if(wv==="contacts") h += `<div class="card" style="border-left:4px solid #25D366">
    <div class="card-title">📲 ${waContactEditId?"Edit Contact":"Add WhatsApp Contact / Group"}</div>
    <div class="form-grid">
      <div class="field"><label>Name / Label <span class="req">*</span></label>
        <input value="${escapeHtml(waContactForm.name||"")}" oninput="window.waContactForm.name=this.value" placeholder="e.g. Operations Group"></div>
      <div class="field"><label>Type <span class="req">*</span></label>
        <select onchange="window.waContactForm.type=this.value;render()">
          <option value="number" ${waContactForm.type==="number"?"selected":""}>📱 Personal Number (auto-send)</option>
          <option value="group" ${waContactForm.type==="group"?"selected":""}>👥 Group (copy + paste)</option>
        </select></div>
    </div>
    <div class="field" style="margin-top:8px">
      <label>${waContactForm.type==="group"?"Group Invite Link":"Phone Number (with country code)"} <span class="req">*</span></label>
      <input value="${escapeHtml(waContactForm.value||"")}" oninput="window.waContactForm.value=this.value"
        placeholder="${waContactForm.type==="group"?"https://chat.whatsapp.com/xxxxx":"9647701234567"}">
      <div style="font-size:10px;color:var(--muted);margin-top:3px">
        ${waContactForm.type==="group"
          ? "Paste the group's invite link (Group Info → Invite to Group via link). Message is copied to clipboard; you paste & send."
          : "Numbers only, no + or spaces. Example: 964 then number → 9647701234567. Message opens ready to send."}
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-primary" style="background:#25D366;border-color:#25D366" onclick="saveWaContact()">${waContactEditId?"Update":"Add Contact"}</button>
      ${waContactEditId?`<button class="btn btn-ghost" onclick="cancelWaContact()">Cancel</button>`:""}
    </div>
  </div>

  <div class="card">
    <div class="filter-row"><span class="card-title" style="margin:0">Saved Contacts & Groups</span><span class="count-pill">${contacts.length}</span></div>
    ${contacts.length===0?`<div class="empty">No contacts yet</div>`:
    `<div style="display:flex;flex-direction:column;gap:8px">
      ${contacts.map(c=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#F7FAF8;border:1px solid #D7E8DD;border-radius:8px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-size:18px">${c.type==="group"?"👥":"📱"}</span>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:13px;color:#1B3A6B">${escapeHtml(c.name)}</div>
            <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.type==="group"?"Group link":escapeHtml(c.value)}</div>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn btn-sm btn-secondary" onclick="editWaContact('${c.id}')">${ICN.edit}</button>
          <button class="btn btn-sm btn-danger" onclick="delWaContact('${c.id}')">${ICN.del}</button>
        </div>
      </div>`).join("")}
    </div>`}
  </div>
`;
  if(wv==="options")  h += `

  <div class="card" style="border-left:4px solid #03308B">
    <div class="card-title">⚙️ Message Content — Fields to Include</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Choose which details appear in the WhatsApp message.</p>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${WA_FIELDS.map(f=>{
        const on = (s.enabledFields||[]).includes(f.id);
        return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:7px 10px;background:${on?'#E8F5E9':'#F7F7F7'};border-radius:8px">
          <input type="checkbox" ${on?"checked":""} onchange="toggleWaField('${f.id}')" style="width:16px;height:16px;cursor:pointer">
          <span style="font-size:14px">${f.icon}</span>
          <span style="font-weight:600;color:${on?'#2E7D32':'#666'}">${f.label}</span>
        </label>`;
      }).join("")}
    </div>
    <div class="field" style="margin-top:12px">
      <label>Message Header</label>
      <input value="${escapeHtml(s.messageHeader||"")}" onchange="window.setWaHeader(this.value)" placeholder="🔔 New Task — EJAF Operations">
    </div>
  </div>

  <div class="card" style="border-left:4px solid #6A1B9A">
    <div class="card-title">👁️ Who Can See the WhatsApp Button</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Admin always has access. Select which other roles can share to WhatsApp.</p>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${[["hr","📋 HR / Manager"],["support","🛠 Support"],["it","💻 IT"],["employee","👤 Employee"]].map(([role,lbl])=>{
        const on = (s.allowedRoles||["admin"]).includes(role);
        return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:7px 10px;background:${on?'#F3E5F5':'#F7F7F7'};border-radius:8px">
          <input type="checkbox" ${on?"checked":""} onchange="toggleWaRole('${role}')" style="width:16px;height:16px;cursor:pointer">
          <span style="font-weight:600;color:${on?'#6A1B9A':'#666'}">${lbl}</span>
        </label>`;
      }).join("")}
    </div>
  </div>

  <div class="card" style="border-left:4px solid #E65100">
    <div class="card-title">🎯 When to Show the Button</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Show the WhatsApp share button after these actions.</p>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${[["daily","📋 After adding a Daily Log entry"],["clientRequests","📨 After a Client Request"]].map(([trig,lbl])=>{
        const on = (s.triggers||[]).includes(trig);
        return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:7px 10px;background:${on?'#FFF3E0':'#F7F7F7'};border-radius:8px">
          <input type="checkbox" ${on?"checked":""} onchange="toggleWaTrigger('${trig}')" style="width:16px;height:16px;cursor:pointer">
          <span style="font-weight:600;color:${on?'#E65100':'#666'}">${lbl}</span>
        </label>`;
      }).join("")}
    </div>
  </div>`;
  return h;
}

async function saveWaContact(){
  if(!isAdmin()) return toast("Admin only");
  const name=(waContactForm.name||"").trim();
  const value=(waContactForm.value||"").trim();
  if(!name) return toast("Name is required");
  if(!value) return toast(waContactForm.type==="group"?"Group link required":"Phone number required");
  if(waContactForm.type==="number"){
    const clean = value.replace(/[^0-9]/g,"");
    if(clean.length < 8) return toast("Invalid phone number");
    waContactForm.value = clean;
  } else {
    if(!value.includes("chat.whatsapp.com")) return toast("Invalid group invite link");
  }
  await fbSave("waContacts",{
    id: waContactEditId||undefined,
    name, type: waContactForm.type, value: waContactForm.value,
    createdBy: state.profile.uid,
  });
  toast(waContactEditId?"Contact updated ✓":"Contact added ✓");
  waContactForm=null; waContactEditId=null;
}
function editWaContact(id){
  const c=(state.waContacts||[]).find(x=>x.id===id);
  if(c){ waContactForm={name:c.name,type:c.type,value:c.value}; waContactEditId=id; render(); window.scrollTo(0,0); }
}
async function delWaContact(id){
  if(!await uiConfirm("Delete this contact?"))return;
  await fbDelete("waContacts",id);
  toast("Deleted");
}
function cancelWaContact(){ waContactForm=null; waContactEditId=null; render(); }
Object.assign(window,{saveWaContact,editWaContact,delWaContact,cancelWaContact});
Object.defineProperty(window,'waContactForm',{get:()=>waContactForm,set:v=>waContactForm=v,configurable:true});

// ── Settings updates ──
async function waSaveSettings(patch){
  if(!isAdmin()) return;
  const {db, doc, setDoc} = window.__fb;
  const cur = waGetSettings();
  const next = {...cur, ...patch};
  await setDoc(doc(db,"settings","whatsapp"), next, {merge:true});
}
window.toggleWaField = async function(fid){
  const s = waGetSettings();
  const arr = [...(s.enabledFields||[])];
  const i = arr.indexOf(fid);
  if(i>=0) arr.splice(i,1); else arr.push(fid);
  await waSaveSettings({enabledFields:arr});
};
window.toggleWaRole = async function(role){
  const s = waGetSettings();
  const arr = [...(s.allowedRoles||["admin"])];
  const i = arr.indexOf(role);
  if(i>=0) arr.splice(i,1); else arr.push(role);
  await waSaveSettings({allowedRoles:arr});
};
window.toggleWaTrigger = async function(trig){
  const s = waGetSettings();
  const arr = [...(s.triggers||[])];
  const i = arr.indexOf(trig);
  if(i>=0) arr.splice(i,1); else arr.push(trig);
  await waSaveSettings({triggers:arr});
};
window.setWaHeader = async function(v){
  await waSaveSettings({messageHeader: v});
  saveToast("Header updated ✓");
};

// ── Build message text from a record using enabled fields ──
function buildWaMessage(record){
  const s = waGetSettings();
  const fields = s.enabledFields || [];
  const lines = [s.messageHeader || "🔔 New Task — EJAF Operations", ""];
  const fieldMap = {
    entryNo:        ()=> record.entryNo ? `#️⃣ Entry: ${formatEntryNo(record.entryNo)}` : "",
    employee:       ()=> record.employee ? `👤 Employee: ${record.employee}` : "",
    date:           ()=> record.date ? `📅 Date: ${fmtDate(record.date)}` : "",
    project:        ()=> record.project ? `📁 Project: ${record.project}` : "",
    dept:           ()=> record.dept ? `🏢 Dept: ${record.dept}` : "",
    location:       ()=> record.location ? `📍 Location: ${record.location}` : "",
    duration:       ()=> (record.duration||record.hours) ? `⏱️ Duration: ${fmtHM(record.duration||record.hours)}` : "",
    resolutionText: ()=> record.resolutionText ? `📝 ${record.resolutionText}` : (record.description ? `📝 ${record.description}` : ""),
    notes:          ()=> record.notes ? `🗒️ Notes: ${record.notes}` : "",
  };
  fields.forEach(f=>{
    const fn = fieldMap[f];
    if(fn){ const line = fn(); if(line) lines.push(line); }
  });
  return lines.join("\n");
}

// ── Show the WhatsApp share dialog (pick a contact, then send) ──
function openWaShare(record){
  if(!canUseWhatsApp()) return;
  const contacts = state.waContacts || [];
  const msg = buildWaMessage(record);
  // Stash for the send handler
  window.__waMsg = msg;
  window.__waRecord = record;

  const existing = document.getElementById("waShareDialog");
  if(existing) existing.remove();

  const html = `
    <div id="waShareDialog" style="position:fixed;inset:0;background:rgba(10,22,46,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.remove()">
      <div style="background:var(--card);border-radius:16px;max-width:400px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:85vh;display:flex;flex-direction:column">
        <div style="background:#25D366;padding:16px 20px;color:white;display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">📲</span>
          <div><div style="font-size:16px;font-weight:700">Share to WhatsApp</div><div style="font-size:11px;opacity:0.9">Choose a contact or group</div></div>
        </div>
        <div style="padding:14px 18px;overflow-y:auto">
          <div style="background:#F0F4FA;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:#475569;white-space:pre-wrap;max-height:120px;overflow-y:auto;border:1px solid #E2E8F0">${escapeHtml(msg)}</div>
          ${contacts.length===0
            ? `<div style="text-align:center;padding:20px;color:#999;font-size:13px">No contacts saved yet.<br>Add some in the WhatsApp tab.</div>`
            : `<div style="display:flex;flex-direction:column;gap:7px">
                ${contacts.map(c=>`<button onclick="sendToWa('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:#F7FAF8;border:1px solid #D7E8DD;border-radius:8px;cursor:pointer;text-align:left;width:100%">
                  <span style="font-size:18px">${c.type==="group"?"👥":"📱"}</span>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:13px;color:#1B3A6B">${escapeHtml(c.name)}</div>
                    <div style="font-size:10px;color:#888">${c.type==="group"?"Group — copy & paste":"Number — opens ready to send"}</div>
                  </div>
                  <span style="color:#25D366;font-weight:700;font-size:18px">→</span>
                </button>`).join("")}
              </div>`}
        </div>
        <div style="padding:10px 18px;border-top:1px solid #eee">
          <button onclick="document.getElementById('waShareDialog').remove()" style="width:100%;padding:10px;background:none;border:none;color:#94A3B8;font-size:13px;cursor:pointer">Close</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}
window.openWaShare = openWaShare;

// Open WhatsApp share for a daily entry by its ID (used by the row button)
window.openWaShareById = function(id){
  const r = (state.daily||[]).find(x=>x.id===id);
  if(r) openWaShare(r);
  else toast("Entry not found");
};

window.sendToWa = async function(contactId){
  const c = (state.waContacts||[]).find(x=>x.id===contactId);
  if(!c) return;
  const msg = window.__waMsg || "";
  if(c.type==="number"){
    // Personal number — opens chat with message ready
    const url = `https://wa.me/${c.value}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  } else {
    // Group — copy message to clipboard, then open the group link
    try{
      await navigator.clipboard.writeText(msg);
      toast("✓ Message copied! Paste it in the group.");
    }catch(e){
      toast("Copy failed — message shown below, copy manually");
    }
    setTimeout(()=>{ window.open(c.value, "_blank"); }, 600);
  }
  document.getElementById("waShareDialog")?.remove();
};


// ═══════════════════════════════════════════════════════════════════════
//  EMAIL MODULE (EmailJS) — recipients, settings, send button
// ═══════════════════════════════════════════════════════════════════════
/* email state hoisted to top (TDZ fix) */

const EMAIL_FIELDS = [
  {id:"entryNo",        label:"Entry #",        icon:"#️⃣"},
  {id:"employee",       label:"Employee",       icon:"👤"},
  {id:"date",           label:"Date",           icon:"📅"},
  {id:"time",           label:"Start–End Time", icon:"🕐"},
  {id:"project",        label:"Project",        icon:"📁"},
  {id:"dept",           label:"Department",     icon:"🏢"},
  {id:"location",       label:"Location",       icon:"📍"},
  {id:"duration",       label:"Duration/Hours", icon:"⏱️"},
  {id:"resolutionText", label:"Description",    icon:"📝"},
  {id:"notes",          label:"Notes",          icon:"🗒️"},
];

// ═══════════════════════════════════════════════════════════════════════
//  SCHEDULED REPORTS MODULE
//  Admin configures: date range + send time + recipients + custom message
//  + which reports. Config is SAVED for the future server-side scheduler.
//  A manual "Send Now" button sends a text summary email via EmailJS today.
// ═══════════════════════════════════════════════════════════════════════
function schedGetSettings(){
  const s = state.scheduledReports || {};
  // Defaults + backward compatibility (migrate old single-recipient config to one group)
  const base = {
    enabled: s.enabled || false,
    sendDay: s.sendDay || "1",
    sendTime: s.sendTime || "23:30",
    periodType: s.periodType || "auto",   // "auto" = 25th prev month → 24th current; "manual" = fixed dates
    fromDate: s.fromDate || "",
    toDate: s.toDate || "",
    lastSent: s.lastSent || "",
    groups: Array.isArray(s.groups) ? s.groups : null,
  };
  // If no groups yet but an old recipients list exists, wrap it as the first group
  if(!base.groups){
    base.groups = [{
      id: "g1",
      name: "Main Recipients",
      recipients: s.recipients || [],
      branch: "",      // "" = all branches
      dept: "",        // "" = all departments
      reports: s.reports || ["daily","hr","dashboard"],
      subject: s.subject || "EJAF Operations — Periodic Reports",
      message: s.message || "Please find attached the operations reports for the specified period.",
    }];
  }
  return base;
}

// Compute the active reporting period.
// "auto" → 25th of previous month  to  24th of current month (relative to refDate).
//   e.g. refDate in July → 25 Jun … 24 Jul.  refDate in August → 25 Jul … 24 Aug.
// "manual" → the fixed fromDate/toDate the admin typed.
function computeSchedPeriod(refDate){
  const s = schedGetSettings();
  if((s.periodType||"auto") === "manual"){
    return { from: s.fromDate || "", to: s.toDate || "" };
  }
  const ref = refDate ? new Date(refDate) : new Date();
  const y = ref.getFullYear(), m = ref.getMonth();   // m = 0..11 (current month)
  const to = new Date(y, m, 24);        // 24th of current month
  const from = new Date(y, m - 1, 25);  // 25th of previous month
  const iso = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yy}-${mm}-${dd}`;
  };
  return { from: iso(from), to: iso(to) };
}

// Who can manage scheduled reports: admin always, plus anyone the admin grants
function canManageScheduledReports(){
  if(isAdmin()) return true;
  const allowed = (state.scheduledReports && state.scheduledReports.managers) || [];
  return allowed.includes(state.profile.employeeName) || allowed.includes(state.profile.uid);
}

async function schedSave(patch){
  if(!canManageScheduledReports()) return;
  const {db, doc, setDoc} = window.__fb;
  const next = {...schedGetSettings(), ...patch};
  await setDoc(doc(db,"settings","scheduledReports"), next, {merge:true});
}

function renderScheduledReportsCard(){
  const s = schedGetSettings();
  const REPORT_OPTS = [
    ["daily","📋 Daily Work Log"],
    ["hr","📊 HR Report"],
    ["dashboard","📈 Dashboard"],
    ["technical","🔧 Technical Report"],
  ];
  const branches = (state.branches||[]).map(b=>b.name).filter(Boolean);
  const depts = deptNames();

  return `
  <div class="card" style="border-left:4px solid #1565C0">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">📅</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#1B3A6B">Automatic Scheduled Reports</div>
          <div style="font-size:11px;color:${s.enabled?'#2E7D32':'#999'};font-weight:600">${s.enabled?'● Automatic sending ENABLED (runs on server)':'○ Automatic sending OFF — manual button only'}</div>
        </div>
      </div>
      <div onclick="toggleSchedEnabled()" style="width:52px;height:28px;background:${s.enabled?'#2E7D32':'#ccc'};border-radius:16px;position:relative;cursor:pointer;transition:background 0.3s">
        <div style="position:absolute;top:3px;${s.enabled?'right:3px':'left:3px'};width:22px;height:22px;background:var(--card);border-radius:50%;transition:all 0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>
      </div>
    </div>

    <div style="padding:10px 12px;background:#E3F2FD;border-radius:8px;font-size:11px;color:#0D47A1;line-height:1.7;margin-bottom:12px">
      ℹ️ <strong>How it works:</strong> Create one or more <strong>recipient groups</strong> below. Each group can target a specific branch and/or department and choose its own reports — so each manager receives only what concerns them. On the chosen day each month, the server generates each group's filtered reports as PDF and emails them automatically.
    </div>

    <!-- Period type selector -->
    ${(()=>{
      const isAuto = (s.periodType||"auto")==="auto";
      const p = computeSchedPeriod();   // current computed period for preview
      return `
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;color:#1B3A6B;display:block;margin-bottom:6px">Reporting Period</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <label style="flex:1;min-width:160px;display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:9px 12px;background:${isAuto?'#E8F5E9':'#F7F7F7'};border:2px solid ${isAuto?'#66BB6A':'#ddd'};border-radius:8px">
            <input type="radio" name="periodType" ${isAuto?'checked':''} onchange="setSchedField('periodType','auto')" style="width:16px;height:16px;cursor:pointer">
            <div><div style="font-weight:700;color:${isAuto?'#2E7D32':'#666'}">🔄 Automatic (monthly cycle)</div><div style="font-size:10px;color:#777;margin-top:1px">25th of prev month → 24th of current</div></div>
          </label>
          <label style="flex:1;min-width:160px;display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;padding:9px 12px;background:${!isAuto?'#E3F2FD':'#F7F7F7'};border:2px solid ${!isAuto?'#42A5F5':'#ddd'};border-radius:8px">
            <input type="radio" name="periodType" ${!isAuto?'checked':''} onchange="setSchedField('periodType','manual')" style="width:16px;height:16px;cursor:pointer">
            <div><div style="font-weight:700;color:${!isAuto?'#1565C0':'#666'}">📅 Manual (fixed dates)</div><div style="font-size:10px;color:#777;margin-top:1px">You set From / To yourself</div></div>
          </label>
        </div>
        ${isAuto
          ? `<div style="padding:10px 12px;background:#E8F5E9;border:1px solid #A5D6A7;border-radius:8px;font-size:12px;color:#1B5E20">
              📆 <strong>This month's period:</strong> ${p.from} → ${p.to}
              <div style="font-size:10px;color:#388E3C;margin-top:3px">Recomputed automatically every month — next month it shifts to the following cycle.</div>
            </div>`
          : `<div class="form-grid" style="grid-template-columns:1fr 1fr">
              <div class="field"><label>From Date</label><input type="date" value="${s.fromDate||''}" onchange="setSchedField('fromDate',this.value)"></div>
              <div class="field"><label>To Date</label><input type="date" value="${s.toDate||''}" onchange="setSchedField('toDate',this.value)"></div>
            </div>`}
      </div>`;
    })()}

    <!-- Send day + time -->
    <div class="form-grid" style="grid-template-columns:1fr 1fr">
      <div class="field"><label>📆 Send Day of Month</label><select onchange="setSchedField('sendDay',this.value)">
        ${Array.from({length:31},(_, i)=>i+1).map(d=>`<option value="${d}" ${String(s.sendDay||'1')===String(d)?'selected':''}>Day ${d}</option>`).join('')}
        <option value="last" ${s.sendDay==='last'?'selected':''}>Last day of month</option>
      </select></div>
      <div class="field"><label>Send Time (server)</label><input type="time" value="${s.sendTime||'23:30'}" onchange="setSchedField('sendTime',this.value)"></div>
    </div>
    ${(()=>{
      const isAuto = (s.periodType||"auto")==="auto";
      const periodTxt = isAuto ? "the automatic cycle (25th → 24th)" : `<strong>${s.fromDate||'(set From)'} → ${s.toDate||'(set To)'}</strong>`;
      return `<div style="padding:9px 12px;background:#FFF8E1;border-radius:8px;font-size:11px;color:#7F6000;line-height:1.6;margin-top:8px">
        📅 <strong>Schedule:</strong> Reports for ${periodTxt} are emailed on <strong>${s.sendDay==='last'?'the last day':'day '+(s.sendDay||'1')}</strong> of each month at <strong>${s.sendTime||'23:30'}</strong> (server time), as PDF attachments — one tailored email per group below.
      </div>`;
    })()}

    <!-- Recipient Groups -->
    <div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:13px;font-weight:700;color:#1B3A6B">📬 Recipient Groups (${(s.groups||[]).length})</div>
      <button class="btn btn-sm" style="background:#2E7D32;color:white;border:none;font-weight:700" onclick="addSchedGroup()">+ Add Group</button>
    </div>

    ${(s.groups||[]).map((g,gi)=>`
      <div style="border:1px solid #B3D4FF;border-radius:12px;padding:14px;margin-top:10px;background:#F7FAFF">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
          <input value="${escapeHtml(g.name||'')}" onchange="setSchedGroupField(${gi},'name',this.value)" placeholder="Group name (e.g. Erbil Branch Manager)" style="flex:1;font-weight:700;color:#03308B;padding:7px 10px;border:1px solid #B3D4FF;border-radius:8px;font-size:13px">
          <button class="btn btn-sm btn-danger" onclick="delSchedGroup(${gi})" title="Remove group">${ICN.del}</button>
        </div>

        <!-- Filters for this group -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">🏙️ Branch filter</label>
            <select onchange="setSchedGroupField(${gi},'branch',this.value)" style="width:100%;padding:7px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px;background:var(--card)">
              <option value="">All Branches</option>
              ${branches.map(b=>`<option value="${escapeHtml(b)}" ${b===(g.branch||'')?'selected':''}>${escapeHtml(b)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:3px">🗂️ Department filter</label>
            <select onchange="setSchedGroupField(${gi},'dept',this.value)" style="width:100%;padding:7px 8px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px;background:var(--card)">
              <option value="">All Departments</option>
              ${depts.map(d=>`<option value="${escapeHtml(d)}" ${d===(g.dept||'')?'selected':''}>${escapeHtml(d)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Reports for this group -->
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:5px">Reports for this group:</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${REPORT_OPTS.map(([id,lbl])=>{
            const on = (g.reports||[]).includes(id);
            return `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;padding:5px 9px;background:${on?'#E3F2FD':'#fff'};border:1px solid ${on?'#90CAF9':'#ddd'};border-radius:12px">
              <input type="checkbox" ${on?"checked":""} onchange="toggleSchedGroupReport(${gi},'${id}')" style="width:14px;height:14px;cursor:pointer">
              <span style="font-weight:600;color:${on?'#1565C0':'#777'}">${lbl}</span>
            </label>`;
          }).join("")}
        </div>

        <!-- Subject + message for this group -->
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
          <input value="${escapeHtml(g.subject||'')}" onchange="setSchedGroupField(${gi},'subject',this.value)" placeholder="Email subject" style="padding:7px 10px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px">
          <textarea onchange="setSchedGroupField(${gi},'message',this.value)" rows="2" placeholder="Message for this group..." style="padding:7px 10px;border:1px solid #B3D4FF;border-radius:8px;font-family:inherit;font-size:12px;resize:vertical">${escapeHtml(g.message||'')}</textarea>
        </div>

        <!-- Recipients for this group -->
        <label style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:5px">Recipients (${(g.recipients||[]).length}):</label>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input id="schedGroupEmail_${gi}" type="email" placeholder="director@ejaftech.iq" style="flex:1;padding:7px 10px;border:1px solid #B3D4FF;border-radius:8px;font-size:12px">
          <button class="btn btn-sm" style="background:#1565C0;color:white;border:none;font-weight:700" onclick="addSchedGroupRecipient(${gi})">Add</button>
        </div>
        ${(g.recipients||[]).length===0
          ? `<div style="padding:7px 10px;background:#FFF3E0;border-radius:8px;font-size:11px;color:#E65100">No recipients yet — add at least one.</div>`
          : `<div style="display:flex;flex-wrap:wrap;gap:5px">
              ${(g.recipients||[]).map((em,ri)=>`<span style="display:inline-flex;align-items:center;gap:5px;background:#E3F2FD;border:1px solid #90CAF9;color:#0D47A1;padding:4px 8px 4px 10px;border-radius:12px;font-size:11px;font-weight:600">
                ✉️ ${escapeHtml(em)}
                <button onclick="removeSchedGroupRecipient(${gi},${ri})" style="background:#BBDEFB;border:none;color:#0D47A1;width:16px;height:16px;border-radius:50%;cursor:pointer;font-weight:700;font-size:10px">×</button>
              </span>`).join("")}
            </div>`}
      </div>
    `).join("")}

    ${isAdmin()?renderSchedManagersBlock():''}

    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn" style="background:#1565C0;color:white;border:none;font-weight:700" onclick="sendScheduledReportsNow()">📨 Send Summary Now</button>
      ${s.lastSent?`<span style="font-size:11px;color:var(--muted);align-self:center">Last sent: ${escapeHtml(s.lastSent)}</span>`:''}
    </div>
  </div>`;
}

// Admin-only block: grant other employees the right to manage scheduled reports
function renderSchedManagersBlock(){
  const managers = (state.scheduledReports && state.scheduledReports.managers) || [];
  const emps = allEmployees();
  return `
  <div style="margin-top:16px;border:1px solid #CE93D8;border-radius:12px;padding:14px;background:#FBF5FC">
    <div style="font-size:13px;font-weight:700;color:#6A1B9A;margin-bottom:4px">🔑 Who can manage scheduled reports</div>
    <p style="font-size:11px;color:#777;margin-bottom:10px">By default only Admin can edit this. Grant access to specific people (e.g. HR) so they can manage groups and recipients too.</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${emps.map(emp=>{
        const on = managers.includes(emp);
        return `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;padding:5px 9px;background:${on?'#F3E5F5':'#fff'};border:1px solid ${on?'#CE93D8':'#ddd'};border-radius:12px">
          <input type="checkbox" ${on?"checked":""} onchange="toggleSchedManager('${escapeHtml(emp)}')" style="width:14px;height:14px;cursor:pointer">
          <span style="font-weight:600;color:${on?'#6A1B9A':'#777'}">${escapeHtml(emp)}</span>
        </label>`;
      }).join("")}
    </div>
  </div>`;
}

// ── Settings updates ──
window.toggleSchedEnabled = async function(){
  const s = schedGetSettings();
  await schedSave({enabled: !s.enabled});
  toast(!s.enabled ? "Automatic sending ENABLED — activates on server ✓" : "Automatic sending OFF — manual button still works");
};
window.setSchedField = async function(field, val){ await schedSave({[field]: val}); saveToast("Saved ✓"); };

// ── Group management ──
window.addSchedGroup = async function(){
  const s = schedGetSettings();
  const groups = [...(s.groups||[])];
  groups.push({
    id: "g" + Date.now(),
    name: "New Group",
    recipients: [], branch: "", dept: "",
    reports: ["daily","hr"],
    subject: "EJAF Operations — Periodic Reports",
    message: "Please find attached the operations reports for the specified period.",
  });
  await schedSave({groups});
  saveToast("Group added ✓");
};
window.delSchedGroup = async function(gi){
  const s = schedGetSettings();
  const groups = [...(s.groups||[])];
  if(!await uiConfirm(`Remove group "${groups[gi]?.name||''}"?`)) return;
  groups.splice(gi,1);
  await schedSave({groups});
  toast("Group removed");
};
window.setSchedGroupField = async function(gi, field, val){
  const s = schedGetSettings();
  const groups = [...(s.groups||[])];
  if(!groups[gi]) return;
  groups[gi] = {...groups[gi], [field]: val};
  await schedSave({groups});
  saveToast("Saved ✓");
};
window.toggleSchedGroupReport = async function(gi, id){
  const s = schedGetSettings();
  const groups = [...(s.groups||[])];
  if(!groups[gi]) return;
  const arr = [...(groups[gi].reports||[])];
  const i = arr.indexOf(id); if(i>=0) arr.splice(i,1); else arr.push(id);
  groups[gi] = {...groups[gi], reports: arr};
  await schedSave({groups});
};
window.addSchedGroupRecipient = async function(gi){
  const inp = document.getElementById("schedGroupEmail_"+gi);
  const email = (inp?.value||"").trim();
  if(!email || !email.includes("@") || !email.includes(".")) return toast("Enter a valid email");
  const s = schedGetSettings();
  const groups = [...(s.groups||[])];
  if(!groups[gi]) return;
  const list = [...(groups[gi].recipients||[])];
  if(list.map(e=>e.toLowerCase()).includes(email.toLowerCase())) return saveToast("Already added");
  list.push(email);
  groups[gi] = {...groups[gi], recipients: list};
  await schedSave({groups});
  saveToast("Recipient added ✓");
};
window.removeSchedGroupRecipient = async function(gi, ri){
  const s = schedGetSettings();
  const groups = [...(s.groups||[])];
  if(!groups[gi]) return;
  const list = [...(groups[gi].recipients||[])];
  list.splice(ri,1);
  groups[gi] = {...groups[gi], recipients: list};
  await schedSave({groups});
  toast("Removed");
};

// ── Manager permission (admin grants who can edit scheduled reports) ──
window.toggleSchedManager = async function(emp){
  if(!isAdmin()) return toast("Admin only");
  const {db, doc, setDoc} = window.__fb;
  const cur = (state.scheduledReports && state.scheduledReports.managers) || [];
  const arr = [...cur];
  const i = arr.indexOf(emp); if(i>=0) arr.splice(i,1); else arr.push(emp);
  await setDoc(doc(db,"settings","scheduledReports"), {managers: arr}, {merge:true});
  saveToast("Updated ✓");
};

// Resolve an employee's branch from users/nametag records
function _employeeBranch(empName){
  const u = (state.users||[]).find(x=>x.employeeName===empName || x.name===empName);
  if(u && u.branch) return u.branch;
  const n = (state.nametagEmployees||[]).find(x=>x.name===empName);
  return (n && n.branch) || "";
}

// ── Build a text summary of the reports for the chosen period, filtered for a group ──
function buildScheduledSummary(group){
  const s = schedGetSettings();
  const g = group || (s.groups && s.groups[0]) || {};
  const period = computeSchedPeriod();    // auto (25→24) or manual, as configured
  const from = period.from, to = period.to;
  const inRange = (d) => {
    if(!d) return false;
    if(from && d < from) return false;
    if(to && d > to) return false;
    return true;
  };
  // Apply group filters: branch (by employee's branch) + dept (by record's dept)
  const branchOK = (r) => !g.branch || _employeeBranch(r.employee)===g.branch;
  const deptOK   = (r) => !g.dept   || (r.dept||"")===g.dept;
  const keep = (r) => branchOK(r) && deptOK(r);

  const daily  = (state.daily||[]).filter(r=>inRange(r.date) && keep(r));
  const ot     = (state.overtime||[]).filter(r=>inRange(r.date) && keep(r));
  const travel = (state.travel||[]).filter(r=>inRange(r.date) && keep(r));
  const leaves = (state.leaves||[]).filter(r=>inRange(r.fromDate||r.date) && branchOK(r));

  const totDailyHrs = daily.reduce((a,r)=>a+Number(r.duration||0),0);
  const totOtHrs = ot.reduce((a,r)=>a+Number(r.hours||0),0);
  const totTravelDays = travel.reduce((a,r)=>a+Number(r.days||0),0);
  const totPerDiem = travel.reduce((a,r)=>a+Number(r.perDiem||0),0);
  const reports = g.reports || [];

  const lines = [];
  lines.push(g.message||"");
  lines.push("");
  lines.push("════════════════════════");
  lines.push(`PERIOD: ${from||'—'} to ${to||'—'}`);
  const scope = [g.branch && `Branch: ${g.branch}`, g.dept && `Dept: ${g.dept}`].filter(Boolean).join("  |  ");
  if(scope) lines.push(scope);
  lines.push("════════════════════════");
  lines.push("");

  if(reports.includes("daily")){
    lines.push("📋 DAILY WORK LOG");
    lines.push(`   Entries: ${daily.length}`);
    lines.push(`   Total hours: ${fmtHM(totDailyHrs)}`);
    lines.push("");
  }
  if(reports.includes("hr")){
    lines.push("📊 HR REPORT");
    lines.push(`   Overtime entries: ${ot.length} (${fmtHM(totOtHrs)})`);
    lines.push(`   Travel trips: ${travel.length} (${totTravelDays} days)`);
    lines.push(`   Per diem total: ${fmtMoney(totPerDiem)} IQD`);
    lines.push(`   Leave records: ${leaves.length}`);
    lines.push("");
  }
  if(reports.includes("technical")){
    const cats = {}; daily.forEach(r=>{ if(r.taskCategory){ cats[r.taskCategory]=(cats[r.taskCategory]||0)+1; } });
    const workDays = new Set(daily.map(r=>`${r.employee}|${r.date}`)).size;
    lines.push("🔧 TECHNICAL REPORT");
    lines.push(`   Tasks: ${daily.length}`);
    lines.push(`   Work days: ${workDays}`);
    const topCats = Object.keys(cats).sort((a,b)=>cats[b]-cats[a]).slice(0,5);
    if(topCats.length) lines.push(`   By category: ${topCats.map(c=>`${c} (${cats[c]})`).join(", ")}`);
    lines.push("");
  }
  if(reports.includes("dashboard")){
    const emps = new Set(daily.map(r=>r.employee).filter(Boolean));
    lines.push("📈 DASHBOARD SUMMARY");
    lines.push(`   Active employees: ${emps.size}`);
    lines.push(`   Total work hours: ${fmtHM(totDailyHrs)}`);
    lines.push(`   Total overtime: ${fmtHM(totOtHrs)}`);
    lines.push("");
  }
  lines.push("────────────────────────");
  lines.push("Note: Full PDF reports are attached automatically when the system runs on the company server.");
  lines.push("");
  lines.push("EJAF Technology — Operations Department");
  lines.push("Powered by Siwar");
  return lines.join("\n");
}

window.sendScheduledReportsNow = async function(){
  const s = schedGetSettings();
  const es = emailGetSettings();
  if(!es.serviceId || !es.templateId || !es.publicKey) return toast("Configure EmailJS keys first (above)");
  if(!es.enabled) return toast("Turn ON the main email service first");
  const period = computeSchedPeriod();
  if(!period.from || !period.to){
    return toast((s.periodType||"auto")==="manual" ? "Set From and To dates" : "Period could not be computed");
  }
  const groups = (s.groups||[]).filter(g=>(g.recipients||[]).length>0);
  if(groups.length===0) return toast("Add at least one group with a recipient");
  if(typeof emailjs==="undefined") return toast("EmailJS not loaded");

  toast(`Sending ${groups.length} group email(s) for ${period.from} → ${period.to}...`);
  try{
    if(typeof emailjs==="undefined") await loadLib("emailjs");
    emailjs.init({publicKey:es.publicKey});
    let sent = 0;
    for(const g of groups){
      const body = buildScheduledSummary(g);   // filtered to this group's branch/dept/reports
      for(const email of (g.recipients||[])){
        await emailjs.send(es.serviceId, es.templateId, {
          subject: g.subject || "EJAF Operations — Periodic Reports",
          message: body,
          to_email: email,
        });
        sent++;
      }
    }
    const stamp = new Date().toLocaleString('en-GB');
    await schedSave({lastSent: stamp});
    toast(`📧 Sent ${sent} email(s) across ${groups.length} group(s)`);
  }catch(e){
    toast("Send failed: " + (e.text||e.message||"check setup"));
  }
};


function renderEmailTab(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Access denied — Admin only</div></div>`;
  if(!emailContactForm) emailContactForm = {name:"", email:""};
  const s = emailGetSettings();
  const contacts = state.emailContacts || [];
  const configured = s.serviceId && s.templateId && s.publicKey;

  const ev = window._emailView || "setup";
  const _ep=(id,ic,lb)=>`<button onclick="window._emailView='${id}';window.__navFade=true;render()" style="flex:1;padding:10px 4px;border:none;border-radius:8px;font-weight:700;font-size:11px;cursor:pointer;background:${ev===id?'#03308B':'#E8EEF7'};color:${ev===id?'#C9A84C':'#1B3A6B'}">${ic} ${lb}</button>`;
  let h = `<div style="display:flex;gap:6px;margin-bottom:14px">${_ep("setup","🔑","Setup")}${_ep("recipients","👥","Recipients")}${_ep("options","🧩","Options")}${_ep("scheduled","⏰","Scheduled")}</div>`;
  if(ev==="setup")      h += `
  <!-- MASTER SWITCH -->
  <div class="card" style="border-left:4px solid ${s.enabled?'#2E7D32':'#999'}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">${s.enabled?'📧':'📭'}</span>
        <div>
          <div style="font-size:16px;font-weight:700;color:#1B3A6B">Email Notifications</div>
          <div style="font-size:12px;color:${s.enabled?'#2E7D32':'#999'};font-weight:600">${s.enabled?'● Service ACTIVE':'○ Service OFF (saving budget)'}</div>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none">
        <span style="font-size:13px;font-weight:700;color:${s.enabled?'#2E7D32':'#666'}">${s.enabled?'ON':'OFF'}</span>
        <div onclick="toggleEmailEnabled()" style="width:52px;height:28px;background:${s.enabled?'#2E7D32':'#ccc'};border-radius:16px;position:relative;transition:background 0.3s;cursor:pointer">
          <div style="position:absolute;top:3px;${s.enabled?'right:3px':'left:3px'};width:22px;height:22px;background:var(--card);border-radius:50%;transition:all 0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>
        </div>
      </label>
    </div>
    <div style="margin-top:10px;padding:10px 12px;background:#FFF8E1;border-radius:8px;font-size:11px;color:#7F6000;line-height:1.6">
      💡 <strong>Budget tip:</strong> Free EmailJS plan allows ~200 emails/month. Turn the service OFF anytime to preserve your quota. When OFF, the "Send Email" button is hidden everywhere.
    </div>
  </div>

  <!-- EMAILJS KEYS -->
  <div class="card" style="border-left:4px solid #03308B">
    <div class="card-title">🔑 EmailJS Configuration ${configured?'<span style="color:#2E7D32;font-size:11px">✓ Configured</span>':'<span style="color:#C53030;font-size:11px">⚠ Not configured</span>'}</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Get these from your free <strong>emailjs.com</strong> account (Dashboard → Account / Email Services / Email Templates).</p>
    <div class="field" style="margin-bottom:8px"><label>Service ID</label>
      <input value="${escapeHtml(s.serviceId||"")}" onchange="setEmailKey('serviceId',this.value)" placeholder="service_xxxxxxx"></div>
    <div class="field" style="margin-bottom:8px"><label>Template ID</label>
      <input value="${escapeHtml(s.templateId||"")}" onchange="setEmailKey('templateId',this.value)" placeholder="template_xxxxxxx"></div>
    <div class="field" style="margin-bottom:8px"><label>Public Key</label>
      <input value="${escapeHtml(s.publicKey||"")}" onchange="setEmailKey('publicKey',this.value)" placeholder="xxxxxxxxxxxxxxxx"></div>
    <div style="padding:10px 12px;background:#E8F0FE;border-radius:8px;font-size:11px;color:#1B3A6B;line-height:1.7;margin-top:8px">
      📌 <strong>Your EmailJS template must include these variables:</strong><br>
      <code style="background:var(--card);padding:1px 5px;border-radius:4px">{{subject}}</code>
      <code style="background:var(--card);padding:1px 5px;border-radius:4px">{{message}}</code>
      <code style="background:var(--card);padding:1px 5px;border-radius:4px">{{to_email}}</code><br>
      Set the template's "To Email" field to <code style="background:var(--card);padding:1px 5px;border-radius:4px">{{to_email}}</code>
    </div>
    ${configured?`<button class="btn btn-sm" style="background:#03308B;color:#C9A84C;margin-top:10px" onclick="sendTestEmail()">📨 Send Test Email</button>`:''}
  </div>`;
  if(ev==="recipients") h += `

  <!-- RECIPIENTS -->
  <div class="card" style="border-left:4px solid #25D366">
    <div class="card-title">${emailContactEditId?"Edit Recipient":"➕ Add Email Recipient"}</div>
    <div class="form-grid">
      <div class="field"><label>Name / Label <span class="req">*</span></label>
        <input value="${escapeHtml(emailContactForm.name||"")}" oninput="window.emailContactForm.name=this.value" placeholder="e.g. Operations Manager"></div>
      <div class="field"><label>Email Address <span class="req">*</span></label>
        <input type="email" value="${escapeHtml(emailContactForm.email||"")}" oninput="window.emailContactForm.email=this.value" placeholder="manager@ejaftech.iq"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-primary" style="background:#25D366;border-color:#25D366" onclick="saveEmailContact()">${emailContactEditId?"Update":"Add Recipient"}</button>
      ${emailContactEditId?`<button class="btn btn-ghost" onclick="cancelEmailContact()">Cancel</button>`:""}
    </div>
  </div>

  <div class="card">
    <div class="filter-row"><span class="card-title" style="margin:0">Saved Recipients</span><span class="count-pill">${contacts.length}</span></div>
    ${contacts.length===0?`<div class="empty">No recipients yet</div>`:
    `<div style="display:flex;flex-direction:column;gap:8px">
      ${contacts.map(c=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#F7FAF8;border:1px solid #D7E8DD;border-radius:8px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-size:18px">✉️</span>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:13px;color:#1B3A6B">${escapeHtml(c.name)}</div>
            <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.email)}</div>
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn btn-sm btn-secondary" onclick="editEmailContact('${c.id}')">${ICN.edit}</button>
          <button class="btn btn-sm btn-danger" onclick="delEmailContact('${c.id}')">${ICN.del}</button>
        </div>
      </div>`).join("")}
    </div>`}
  </div>

  <!-- AUTO-SEND -->
  <div class="card" style="border-left:4px solid ${s.autoSend?'#2E7D32':'#999'}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">${s.autoSend?'⚡':'✋'}</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#1B3A6B">Automatic Sending</div>
          <div style="font-size:11px;color:${s.autoSend?'#2E7D32':'#999'};font-weight:600">${s.autoSend?'● Sends instantly on each new task':'○ Manual only (📧 button)'}</div>
        </div>
      </div>
      <div onclick="toggleEmailAutoSend()" style="width:52px;height:28px;background:${s.autoSend?'#2E7D32':'#ccc'};border-radius:16px;position:relative;cursor:pointer;transition:background 0.3s">
        <div style="position:absolute;top:3px;${s.autoSend?'right:3px':'left:3px'};width:22px;height:22px;background:var(--card);border-radius:50%;transition:all 0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>
      </div>
    </div>
    <div style="margin-top:10px;padding:9px 12px;background:#FFF8E1;border-radius:8px;font-size:11px;color:#7F6000;line-height:1.6">
      ⚡ When ON: a new Daily Log entry emails all recipients automatically. "Save & Add for Another Employee" sends one combined email listing every employee. When OFF, use the 📧 button per row.
    </div>
  </div>

  <!-- RECIPIENT SOURCES -->
  <div class="card" style="border-left:4px solid #00838F">
    <div class="card-title">📋 Recipient Sources</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Beyond the manual list above, automatically include:</p>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:9px 11px;background:${s.includeEmployees?'#E0F7FA':'#F7F7F7'};border-radius:8px;margin-bottom:6px">
      <input type="checkbox" ${s.includeEmployees?"checked":""} onchange="toggleEmailIncludeEmployees()" style="width:16px;height:16px;cursor:pointer">
      <span style="font-size:14px">👥</span>
      <span style="font-weight:600;color:${s.includeEmployees?'#00838F':'#666'}">All staff (Employees, HR, Support, IT)</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:9px 11px;background:${s.includeClients?'#E0F7FA':'#F7F7F7'};border-radius:8px">
      <input type="checkbox" ${s.includeClients?"checked":""} onchange="toggleEmailIncludeClients()" style="width:16px;height:16px;cursor:pointer">
      <span style="font-size:14px">🏢</span>
      <span style="font-weight:600;color:${s.includeClients?'#00838F':'#666'}">All Clients</span>
    </label>
    <div style="margin-top:10px;padding:8px 11px;background:#F0F4FA;border-radius:8px;font-size:11px;color:#475569">
      📊 Current recipients: <strong>${resolveEmailRecipients().length}</strong> total (manual + selected sources)
    </div>
  </div>

  <!-- CLIENT REQUEST RECIPIENTS -->
  <div class="card" style="border-left:4px solid #AD1457">
    <div class="card-title">📨 Client Request Notifications</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">When a client submits a new request, these addresses get an automatic email. ${(s.triggers||[]).includes("clientRequests")?'':'<strong style="color:#C62828">⚠ Enable the "After a Client Request" trigger above first.</strong>'}</p>
    <div class="field" style="margin-bottom:8px"><label>Add notification email</label>
      <div style="display:flex;gap:6px">
        <input id="reqEmailInput" type="email" placeholder="manager@ejaftech.iq" style="flex:1">
        <button class="btn btn-sm" style="background:#AD1457;color:white;border:none;font-weight:700" onclick="addRequestRecipient()">Add</button>
      </div>
    </div>
    ${(s.requestRecipients||[]).length===0
      ? `<div style="padding:10px 12px;background:#FCE4EC;border-radius:8px;font-size:11px;color:#880E4F">No dedicated recipients — requests will fall back to the main recipient list above.</div>`
      : `<div style="display:flex;flex-direction:column;gap:6px">
          ${(s.requestRecipients||[]).map((em,idx)=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;background:#FCE4EC;border:1px solid #F8BBD0;border-radius:8px">
            <div style="display:flex;align-items:center;gap:8px;min-width:0"><span style="font-size:16px">✉️</span><span style="font-size:12px;color:#880E4F;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(em)}</span></div>
            <button class="btn btn-sm btn-danger" onclick="removeRequestRecipient(${idx})">${ICN.del}</button>
          </div>`).join("")}
        </div>`}
  </div>`;
  if(ev==="options")    h += `

  <!-- MESSAGE FIELDS -->
  <div class="card" style="border-left:4px solid #6A1B9A">
    <div class="card-title">⚙️ Email Content — Fields to Include</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${EMAIL_FIELDS.map(f=>{
        const on = (s.enabledFields||[]).includes(f.id);
        return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:7px 10px;background:${on?'#F3E5F5':'#F7F7F7'};border-radius:8px">
          <input type="checkbox" ${on?"checked":""} onchange="toggleEmailField('${f.id}')" style="width:16px;height:16px;cursor:pointer">
          <span style="font-size:14px">${f.icon}</span>
          <span style="font-weight:600;color:${on?'#6A1B9A':'#666'}">${f.label}</span>
        </label>`;
      }).join("")}
    </div>
    <div class="field" style="margin-top:12px"><label>Email Subject</label>
      <input value="${escapeHtml(s.subject||"")}" onchange="setEmailSubject(this.value)" placeholder="New Task — EJAF Operations"></div>
  </div>

  <!-- WHO CAN SEE -->
  <div class="card" style="border-left:4px solid #0277BD">
    <div class="card-title">👁️ Who Can Send Emails</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Admin always can. Select other roles (only works while service is ON).</p>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${[["hr","📋 HR / Manager"],["support","🛠 Support"],["it","💻 IT"],["employee","👤 Employee"]].map(([role,lbl])=>{
        const on = (s.allowedRoles||["admin"]).includes(role);
        return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:7px 10px;background:${on?'#E1F5FE':'#F7F7F7'};border-radius:8px">
          <input type="checkbox" ${on?"checked":""} onchange="toggleEmailRole('${role}')" style="width:16px;height:16px;cursor:pointer">
          <span style="font-weight:600;color:${on?'#0277BD':'#666'}">${lbl}</span>
        </label>`;
      }).join("")}
    </div>
  </div>

  <!-- TRIGGERS -->
  <div class="card" style="border-left:4px solid #E65100">
    <div class="card-title">🎯 When to Show the Email Button</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${[["daily","📋 After adding a Daily Log entry"],["clientRequests","📨 After a Client Request"]].map(([trig,lbl])=>{
        const on = (s.triggers||[]).includes(trig);
        return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;padding:7px 10px;background:${on?'#FFF3E0':'#F7F7F7'};border-radius:8px">
          <input type="checkbox" ${on?"checked":""} onchange="toggleEmailTrigger('${trig}')" style="width:16px;height:16px;cursor:pointer">
          <span style="font-weight:600;color:${on?'#E65100':'#666'}">${lbl}</span>
        </label>`;
      }).join("")}
    </div>
  </div>`;
  if(ev==="scheduled")  h += renderScheduledReportsCard();
  return h;
}

async function saveEmailContact(){
  if(!isAdmin()) return toast("Admin only");
  const name=(emailContactForm.name||"").trim();
  const email=(emailContactForm.email||"").trim();
  if(!name) return toast("Name is required");
  if(!email || !email.includes("@") || !email.includes(".")) return toast("Valid email required");
  await fbSave("emailContacts",{
    id: emailContactEditId||undefined,
    name, email, createdBy: state.profile.uid,
  });
  toast(emailContactEditId?"Recipient updated ✓":"Recipient added ✓");
  emailContactForm=null; emailContactEditId=null;
}
function editEmailContact(id){
  window._emailView="recipients";
  const c=(state.emailContacts||[]).find(x=>x.id===id);
  if(c){ emailContactForm={name:c.name,email:c.email}; emailContactEditId=id; render(); window.scrollTo(0,0); }
}
async function delEmailContact(id){
  if(!await uiConfirm("Delete this recipient?"))return;
  await fbDelete("emailContacts",id);
  toast("Deleted");
}
function cancelEmailContact(){ emailContactForm=null; emailContactEditId=null; render(); }
Object.assign(window,{saveEmailContact,editEmailContact,delEmailContact,cancelEmailContact});
Object.defineProperty(window,'emailContactForm',{get:()=>emailContactForm,set:v=>emailContactForm=v,configurable:true});

// ── Settings updates ──
async function emailSaveSettings(patch){
  if(!isAdmin()) return;
  const {db, doc, setDoc} = window.__fb;
  const next = {...emailGetSettings(), ...patch};
  await setDoc(doc(db,"settings","email"), next, {merge:true});
}
window.toggleEmailEnabled = async function(){
  const s = emailGetSettings();
  if(!s.enabled && (!s.serviceId||!s.templateId||!s.publicKey)){
    return toast("Configure EmailJS keys first");
  }
  await emailSaveSettings({enabled: !s.enabled});
  toast(!s.enabled ? "Email service ON ✓" : "Email service OFF — budget saved");
};
window.setEmailKey = async function(key,val){ await emailSaveSettings({[key]:val.trim()}); saveToast("Saved ✓"); };
window.setEmailSubject = async function(v){ await emailSaveSettings({subject:v}); saveToast("Subject updated ✓"); };
window.toggleEmailField = async function(fid){
  const s=emailGetSettings(); const arr=[...(s.enabledFields||[])];
  const i=arr.indexOf(fid); if(i>=0)arr.splice(i,1);else arr.push(fid);
  await emailSaveSettings({enabledFields:arr});
};
window.toggleEmailRole = async function(role){
  const s=emailGetSettings(); const arr=[...(s.allowedRoles||["admin"])];
  const i=arr.indexOf(role); if(i>=0)arr.splice(i,1);else arr.push(role);
  await emailSaveSettings({allowedRoles:arr});
};
window.toggleEmailTrigger = async function(trig){
  const s=emailGetSettings(); const arr=[...(s.triggers||[])];
  const i=arr.indexOf(trig); if(i>=0)arr.splice(i,1);else arr.push(trig);
  await emailSaveSettings({triggers:arr});
};
window.toggleEmailAutoSend = async function(){
  const s=emailGetSettings();
  await emailSaveSettings({autoSend: !s.autoSend});
  toast(!s.autoSend ? "Auto-send ON ⚡" : "Auto-send OFF — manual only");
};
window.toggleEmailIncludeEmployees = async function(){
  const s=emailGetSettings();
  await emailSaveSettings({includeEmployees: !s.includeEmployees});
};
window.toggleEmailIncludeClients = async function(){
  const s=emailGetSettings();
  await emailSaveSettings({includeClients: !s.includeClients});
};
window.addRequestRecipient = async function(){
  const inp = document.getElementById("reqEmailInput");
  const email = (inp?.value||"").trim();
  if(!email || !email.includes("@") || !email.includes(".")) return toast("Enter a valid email");
  const s = emailGetSettings();
  const list = [...(s.requestRecipients||[])];
  if(list.map(e=>e.toLowerCase()).includes(email.toLowerCase())) return saveToast("Already added");
  list.push(email);
  await emailSaveSettings({requestRecipients:list});
  saveToast("Recipient added ✓");
};
window.removeRequestRecipient = async function(idx){
  const s = emailGetSettings();
  const list = [...(s.requestRecipients||[])];
  list.splice(idx,1);
  await emailSaveSettings({requestRecipients:list});
  toast("Removed");
};

// ── Build email body from a record ──
function buildEmailBody(record){
  const s = emailGetSettings();
  const fields = s.enabledFields || [];
  const lines = [];
  const map = {
    entryNo:        ()=> record.entryNo ? `Entry #: ${formatEntryNo(record.entryNo)}` : "",
    employee:       ()=> record.employee ? `Employee: ${record.employee}` : "",
    date:           ()=> record.date ? `Date: ${fmtDate(record.date)}` : "",
    time:           ()=> (record.start&&record.end) ? `Time: ${record.start}–${record.end}` : "",
    project:        ()=> record.project ? `Project: ${record.project}` : "",
    dept:           ()=> record.dept ? `Department: ${record.dept}` : "",
    location:       ()=> record.location ? `Location: ${record.location}` : "",
    duration:       ()=> (record.duration||record.hours) ? `Duration: ${fmtHM(record.duration||record.hours)}` : "",
    resolutionText: ()=> record.resolutionText ? `Description: ${record.resolutionText}` : (record.description?`Description: ${record.description}`:""),
    notes:          ()=> record.notes ? `Notes: ${record.notes}` : "",
  };
  fields.forEach(f=>{ const fn=map[f]; if(fn){const l=fn(); if(l)lines.push(l);} });
  return lines.join("\n");
}

// Auto-send body: ALWAYS includes Start–End time (even if not toggled in settings),
// so automatic task emails always carry the work hours.
function buildEmailBodyAuto(record){
  const s = emailGetSettings();
  const fields = [...(s.enabledFields || [])];
  if(!fields.includes("time")){
    // insert time right after date if present, else at the front
    const di = fields.indexOf("date");
    if(di >= 0) fields.splice(di+1, 0, "time");
    else fields.unshift("time");
  }
  const map = {
    entryNo:        ()=> record.entryNo ? `Entry #: ${formatEntryNo(record.entryNo)}` : "",
    employee:       ()=> record.employee ? `Employee: ${record.employee}` : "",
    date:           ()=> record.date ? `Date: ${fmtDate(record.date)}` : "",
    time:           ()=> (record.start&&record.end) ? `Time: ${record.start}–${record.end}` : "",
    project:        ()=> record.project ? `Project: ${record.project}` : "",
    dept:           ()=> record.dept ? `Department: ${record.dept}` : "",
    location:       ()=> record.location ? `Location: ${record.location}` : "",
    duration:       ()=> (record.duration||record.hours) ? `Duration: ${fmtHM(record.duration||record.hours)}` : "",
    resolutionText: ()=> record.resolutionText ? `Description: ${record.resolutionText}` : (record.description?`Description: ${record.description}`:""),
    notes:          ()=> record.notes ? `Notes: ${record.notes}` : "",
  };
  const lines = [];
  fields.forEach(f=>{ const fn=map[f]; if(fn){const l=fn(); if(l)lines.push(l);} });
  return lines.join("\n");
}
window.sendTestEmail = async function(){
  const s = emailGetSettings();
  if(!s.serviceId||!s.templateId||!s.publicKey) return toast("Configure keys first");
  const contacts = state.emailContacts||[];
  if(contacts.length===0) return toast("Add at least one recipient first");
  if(typeof emailjs==="undefined") return toast("EmailJS not loaded — check connection");
  toast("Sending test...");
  try{
    if(typeof emailjs==="undefined") await loadLib("emailjs");
    emailjs.init({publicKey:s.publicKey});
    await emailjs.send(s.serviceId, s.templateId, {
      subject: (s.subject||"Test") + " (TEST)",
      message: "✅ This is a test email from Girêk.\n\nIf you received this, your EmailJS setup works!",
      to_email: contacts[0].email,
    });
    toast(`✓ Test sent to ${contacts[0].email}`);
  }catch(e){
    toast("Failed: " + (e.text||e.message||"check keys"));
  }
};

// ── Open email send dialog (pick recipients) ──
function openEmailShare(record){
  if(!canUseEmail()) return;
  const contacts = state.emailContacts || [];
  const body = buildEmailBody(record);
  window.__emailBody = body;

  const existing = document.getElementById("emailShareDialog");
  if(existing) existing.remove();

  const html = `
    <div id="emailShareDialog" style="position:fixed;inset:0;background:rgba(10,22,46,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.remove()">
      <div style="background:var(--card);border-radius:16px;max-width:400px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:85vh;display:flex;flex-direction:column">
        <div style="background:#03308B;padding:16px 20px;color:white;display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">📧</span>
          <div><div style="font-size:16px;font-weight:700">Send Email Notification</div><div style="font-size:11px;opacity:0.9">Select recipients</div></div>
        </div>
        <div style="padding:14px 18px;overflow-y:auto">
          <div style="background:#F0F4FA;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:11px;color:#475569;white-space:pre-wrap;max-height:120px;overflow-y:auto;border:1px solid #E2E8F0">${escapeHtml(body)}</div>
          ${contacts.length===0
            ? `<div style="text-align:center;padding:20px;color:#999;font-size:13px">No recipients saved.<br>Add some in the Email tab.</div>`
            : `<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:12px">
                <button onclick="sendEmailToAll()" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;background:#03308B;color:#C9A84C;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px">📨 Send to All (${contacts.length})</button>
                <div style="text-align:center;font-size:11px;color:#999">— or pick one —</div>
                ${contacts.map(c=>`<button onclick="sendEmailToOne('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 13px;background:#F7FAF8;border:1px solid #D7E8DD;border-radius:8px;cursor:pointer;text-align:left;width:100%">
                  <span style="font-size:18px">✉️</span>
                  <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px;color:#1B3A6B">${escapeHtml(c.name)}</div><div style="font-size:10px;color:#888;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.email)}</div></div>
                </button>`).join("")}
              </div>`}
        </div>
        <div style="padding:10px 18px;border-top:1px solid #eee">
          <button onclick="document.getElementById('emailShareDialog').remove()" style="width:100%;padding:10px;background:none;border:none;color:#94A3B8;font-size:13px;cursor:pointer">Close</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", html);
}
window.openEmailShare = openEmailShare;
window.openEmailShareById = function(id){
  const r = (state.daily||[]).find(x=>x.id===id);
  if(r) openEmailShare(r); else toast("Entry not found");
};

async function doSendEmail(recipients){
  const s = emailGetSettings();
  if(typeof emailjs==="undefined") return toast("EmailJS not loaded");
  const body = window.__emailBody || "";
  toast(`Sending to ${recipients.length}...`);
  try{
    if(typeof emailjs==="undefined") await loadLib("emailjs");
    emailjs.init({publicKey:s.publicKey});
    let sent=0;
    for(const r of recipients){
      await emailjs.send(s.serviceId, s.templateId, {
        subject: s.subject||"New Task — EJAF Operations",
        message: body,
        to_email: r.email,
      });
      sent++;
    }
    toast(`✓ Email sent to ${sent} recipient${sent>1?'s':''}`);
  }catch(e){
    toast("Failed: " + (e.text||e.message||"check setup"));
  }
  document.getElementById("emailShareDialog")?.remove();
}
window.sendEmailToAll = function(){ doSendEmail(resolveEmailRecipients()); };
window.sendEmailToOne = function(id){
  const c=(state.emailContacts||[]).find(x=>x.id===id);
  if(c) doSendEmail([c]);
};

// Silent automatic email for a new task — sends to ALL resolved recipients,
// no dialog. Builds its own body from the record. Used when autoSend is ON.
async function autoSendTaskEmail(record){
  const s = emailGetSettings();
  if(!s.enabled || !s.autoSend) return;                    // master / auto off
  if(!s.serviceId || !s.templateId || !s.publicKey) return; // not configured
  if(typeof emailjs === "undefined") return;                // SDK missing
  const recipients = resolveEmailRecipients();
  if(recipients.length === 0) return;                       // no one to send to
  const body = buildEmailBodyAuto(record);
  try{
    if(typeof emailjs==="undefined") await loadLib("emailjs");
    emailjs.init({publicKey:s.publicKey});
    let sent = 0;
    for(const r of recipients){
      await emailjs.send(s.serviceId, s.templateId, {
        subject: s.subject || "New Task — EJAF Operations",
        message: body,
        to_email: r.email,
      });
      sent++;
    }
    toast(`📧 Auto-emailed ${sent} recipient${sent>1?'s':''}`);
  }catch(e){
    toast("Auto-email failed: " + (e.text||e.message||"check setup"));
  }
}
window.autoSendTaskEmail = autoSendTaskEmail;


