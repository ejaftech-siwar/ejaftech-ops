const TZ_GROUPS=[
  ["🕌 Middle East",[
    ["Asia/Baghdad","🇮🇶 Iraq / Kurdistan Region — Baghdad (UTC+3)"],
    ["Asia/Damascus","🇸🇾 Syria — Damascus (UTC+3)"],
    ["Asia/Riyadh","🇸🇦 Saudi Arabia — Riyadh (UTC+3)"],
    ["Asia/Kuwait","🇰🇼 Kuwait (UTC+3)"],
    ["Asia/Dubai","🇦🇪 UAE — Dubai (UTC+4)"],
    ["Asia/Amman","🇯🇴 Jordan — Amman (UTC+3/+2)"],
    ["Asia/Beirut","🇱🇧 Lebanon — Beirut (UTC+3/+2)"],
    ["Europe/Istanbul","🇹🇷 Turkey — Istanbul (UTC+3)"],
  ]],
  ["🌎 Americas",[
    ["America/New_York","🇺🇸 USA — New York, Eastern (UTC-5/-4)"],
    ["America/Chicago","🇺🇸 USA — Chicago, Central (UTC-6/-5)"],
    ["America/Denver","🇺🇸 USA — Denver, Mountain (UTC-7/-6)"],
    ["America/Los_Angeles","🇺🇸 USA — Los Angeles, Pacific (UTC-8/-7)"],
  ]],
  ["🌍 Europe",[
    ["Europe/London","🇬🇧 UK — London"],
    ["Europe/Paris","🇫🇷 France / Central Europe — Paris"],
  ]],
  ["🌏 Asia-Pacific & World",[
    ["Asia/Kolkata","🇮🇳 India — Kolkata"],
    ["Asia/Shanghai","🇨🇳 China — Shanghai"],
    ["Asia/Tokyo","🇯🇵 Japan — Tokyo"],
    ["Australia/Sydney","🇦🇺 Australia — Sydney"],
    ["UTC","🌐 UTC — Coordinated Universal Time"],
  ]],
];
window.saveAppTZ=async function(tz){
  await fbSave("settings",{..._dtDoc(),id:"dateTime",tz});   // merge: keep manual mode/offset
  saveToast("🌍 Timezone updated ✓");
};
window.applyManualDT=async function(){
  const el=document.getElementById("dtManual");
  if(!el||!el.value) return toast("⚠ Pick a date & time first");
  const chosen=new Date(el.value);
  if(isNaN(chosen)) return toast("⚠ Invalid date/time");
  await fbSave("settings",{..._dtDoc(),id:"dateTime",mode:"manual",offsetMs:chosen.getTime()-Date.now()});
  toast("🕐 Manual date & time applied ✓");
};
window.clearManualDT=async function(){
  await fbSave("settings",{..._dtDoc(),id:"dateTime",mode:"auto",offsetMs:0});
  toast("🕐 Back to automatic time ✓");
};
// ── Dedicated Date & Time tab (Settings) ──────────────────────────────
function renderDateTime(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const tz=getAppTZ();
  return `
  <div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:#fff;text-align:center;padding:28px 16px">
    <div style="font-size:10px;letter-spacing:1.5px;opacity:.75;text-transform:uppercase">Business Time</div>
    <div id="dtClock" style="font-family:'DM Serif Display',serif;font-size:28px;font-weight:700;color:#C9A84C;margin:8px 0 4px;letter-spacing:1px;line-height:1">--:--:--</div>
    <div id="dtDate" style="font-size:13px;opacity:.9">—</div>
    <div style="font-size:10px;opacity:.65;margin-top:8px">${escapeHtml(tz)}${_dtDoc().mode==="manual"?' · <span style="color:#F0D68A;font-weight:800">MANUAL</span>':''}</div>
  </div>

  <div class="card">
    <div class="card-title">🕐 Set Date & Time</div>
    <div style="display:flex;gap:6px;margin:10px 0 12px">
      <button class="btn ${_dtDoc().mode!=="manual"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="clearManualDT()">⚡ Automatic</button>
      <button class="btn ${_dtDoc().mode==="manual"?"btn-primary":"btn-secondary"}" style="flex:1" onclick="(function(){const x=document.getElementById('dtManualRow');if(x)x.style.display='flex';})()">✍️ Manual</button>
    </div>
    <div id="dtManualRow" style="display:${_dtDoc().mode==="manual"?"flex":"none"};gap:8px;flex-wrap:wrap;align-items:center">
      <input type="datetime-local" id="dtManual" value="${(()=>{const n=appNow();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}T${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`})()}" style="flex:1;min-width:190px;padding:9px 10px;border:1.5px solid var(--line);border-radius:8px;font-size:13px;background:var(--card,#fff);color:var(--text)">
      <button class="btn btn-primary" onclick="applyManualDT()">Apply</button>
    </div>
  </div>

  <div class="card">
    <div class="card-title">🌍 Timezone</div>
    ${TZ_GROUPS.map(([region,list])=>`
      <div style="margin-bottom:16px">
        <div style="font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.6px;text-transform:uppercase;margin-bottom:7px">${region}</div>
        <div style="display:grid;gap:6px">
          ${list.map(([v,l])=>`<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${tz===v?'#C9A84C':'var(--line)'};border-radius:8px;cursor:pointer;background:${tz===v?'#FFF8E1':'transparent'}">
            <input type="radio" name="dtTz" value="${v}" ${tz===v?"checked":""} onchange="saveAppTZ(this.value)" style="width:16px;height:16px;accent-color:#C9A84C;flex:0 0 auto">
            <span style="font-size:13px;font-weight:${tz===v?'800':'500'};color:${tz===v?'#7A5A00':'var(--text)'}">${l}</span>
          </label>`).join("")}
        </div>
      </div>`).join("")}
  </div>`;
}
// Ticking clock — updates two DOM nodes directly (not a full re-render) once a
// second while this tab is open, and stops itself the moment it isn't.
window._dtInit=function(){
  clearInterval(window._dtClockTimer);
  function tick(){
    if(state.tab!=="Date & Time"){ clearInterval(window._dtClockTimer); return; }
    const timeEl=document.getElementById('dtClock'), dateEl=document.getElementById('dtDate');
    if(!timeEl){ clearInterval(window._dtClockTimer); return; }
    try{
      const tz=getAppTZ(), now=appNow();
      timeEl.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
      dateEl.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);
    }catch(e){}
  }
  tick();
  window._dtClockTimer=setInterval(tick,1000);
};
function renderProfile(){
  const p = state.profile || {};
  const u = state.user || {};
  const role = (p.role || 'employee').toUpperCase();
  const roleColor = role === 'ADMIN' ? '#C9A84C' : role === 'HR' ? '#2E5FA3' : '#2E7D32';

  // Last sign-in info
  const lastSignIn = u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).toLocaleString('en-GB') : 'Unknown';
  const accountCreated = u.metadata?.creationTime ? new Date(u.metadata.creationTime).toLocaleString('en-GB') : 'Unknown';

  if(!profileForm) profileForm = { current:"", newPass:"", confirm:"", showOldPass:false, showNewPass:false };

  const _sn=(typeof sysNotifEnabled==="function")&&sysNotifEnabled();
  return `<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;border:2px solid #C9A84C">
    <div style="display:flex;align-items:center;gap:14px">
      <div onclick="document.getElementById('profilePhotoInput').click()" title="Tap to change photo" style="position:relative;width:64px;height:64px;border:2px solid #C9A84C;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#1B3A6B;flex-shrink:0;cursor:pointer;overflow:hidden">
        ${p.photoData?`<img src="${p.photoData}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-family:'DM Serif Display',serif;font-size:18px;color:#C9A84C;font-weight:700">${escapeHtml((p.name||'?').charAt(0).toUpperCase())}</span>`}
        <span style="position:absolute;right:-1px;bottom:-1px;width:22px;height:22px;background:#C9A84C;color:#1B3A6B;border-radius:12px 0 10px 0;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 0 0 2px #1B3A6B">📷</span>
      </div>
      <input type="file" id="profilePhotoInput" accept="image/*" onchange="uploadProfilePhoto(this)" style="display:none">
      <div style="flex:1;min-width:0">
        <h2 style="font-family:'DM Serif Display',serif;font-size:22px;color:white;margin:0;line-height:1.2">${escapeHtml(p.name || 'User')}</h2>
        <div style="font-size:12px;color:#B8CFE8;margin-top:4px">${escapeHtml(p.email || '')}</div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="background:${roleColor};color:#1B3A6B;font-size:11px;padding:3px 10px;border-radius:12px;font-weight:800;letter-spacing:0.5px">${role}</span>
          ${p.photoData
            ? `<button onclick="removeProfilePhoto()" style="background:rgba(255,255,255,0.15);color:#fff;border:none;font-size:11px;padding:4px 10px;border-radius:12px;cursor:pointer;font-family:inherit">Remove photo</button>`
            : `<button onclick="document.getElementById('profilePhotoInput').click()" style="background:rgba(255,255,255,0.15);color:#fff;border:none;font-size:11px;padding:4px 10px;border-radius:12px;cursor:pointer;font-family:inherit">📷 Add photo</button>`}
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">01</span> Account Information</div>
    <div style="display:grid;gap:10px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card)">
        <span style="color:var(--muted);font-size:12px">Email</span>
        <strong style="color:#1B3A6B">${escapeHtml(p.email || 'N/A')}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card)">
        <span style="color:var(--muted);font-size:12px">Full Name</span>
        <strong style="color:#1B3A6B">${escapeHtml(p.name || 'N/A')}</strong>
      </div>
      ${p.employeeName ? `<div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card)">
        <span style="color:var(--muted);font-size:12px">Tracked As</span>
        <strong style="color:#1B3A6B">${escapeHtml(p.employeeName)}</strong>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card)">
        <span style="color:var(--muted);font-size:12px">Role</span>
        <span style="background:${roleColor}22;color:${roleColor};font-size:11px;padding:3px 10px;border-radius:12px;font-weight:700">${role}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card)">
        <span style="color:var(--muted);font-size:12px">Last Sign In</span>
        <span style="color:#1B3A6B;font-size:12px">${lastSignIn}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card)">
        <span style="color:var(--muted);font-size:12px">Account Created</span>
        <span style="color:#1B3A6B;font-size:12px">${accountCreated}</span>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">02</span> 🔒 Change Password</div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 12px">Keep your account safe by using a strong password. Minimum 6 characters.</p>

    <div class="form-grid">
      <div class="field full"><label>Current Password <span class="req">*</span></label>
        <div style="position:relative">
          <input type="${profileForm.showOldPass?'text':'password'}" id="profCurrent" value="${escapeHtml(profileForm.current)}" oninput="window.profileForm.current=this.value" placeholder="Enter your current password" autocomplete="current-password" style="padding-right:42px">
          <button type="button" onclick="window.profileForm.showOldPass=!window.profileForm.showOldPass;render()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;cursor:pointer;font-size:16px;color:var(--muted)">${profileForm.showOldPass?'🙈':'👁'}</button>
        </div>
      </div>
      <div class="field"><label>New Password <span class="req">*</span></label>
        <div style="position:relative">
          <input type="${profileForm.showNewPass?'text':'password'}" id="profNew" value="${escapeHtml(profileForm.newPass)}" oninput="window.profileForm.newPass=this.value;render()" placeholder="At least 6 characters" autocomplete="new-password" style="padding-right:42px">
          <button type="button" onclick="window.profileForm.showNewPass=!window.profileForm.showNewPass;render()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;cursor:pointer;font-size:16px;color:var(--muted)">${profileForm.showNewPass?'🙈':'👁'}</button>
        </div>
      </div>
      <div class="field"><label>Confirm Password <span class="req">*</span></label>
        <input type="password" value="${escapeHtml(profileForm.confirm)}" oninput="window.profileForm.confirm=this.value;render()" placeholder="Repeat new password" autocomplete="new-password">
      </div>
      ${profileForm.newPass ? `<div class="field full">
        ${passwordStrengthBar(profileForm.newPass)}
      </div>` : ''}
      ${profileForm.newPass && profileForm.confirm ? `<div class="field full" style="padding:8px 12px;border-radius:8px;background:${profileForm.newPass===profileForm.confirm ? '#E8F5E9' : '#FFEBEE'};border:1px solid ${profileForm.newPass===profileForm.confirm ? '#A5D6A7' : '#EF9A9A'};font-size:12px;color:${profileForm.newPass===profileForm.confirm ? '#2E7D32' : '#C62828'};font-weight:600">
        ${profileForm.newPass===profileForm.confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
      </div>` : ''}
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn btn-primary" onclick="changeMyPassword()" ${(!profileForm.current||!profileForm.newPass||profileForm.newPass!==profileForm.confirm||profileForm.newPass.length<6)?'disabled':''}>🔐 Update Password</button>
      <button class="btn btn-ghost" onclick="window.profileForm={current:'',newPass:'',confirm:'',showOldPass:false,showNewPass:false};render()">Clear</button>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">03</span> 🔑 Forgot Password?</div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 12px">If you can't remember your current password, click below to receive a reset link via email.</p>
    <button class="btn btn-ghost" style="background:#FFF8E1;border:1px solid #C9A84C;color:#7F6000" onclick="requestPasswordReset()">📧 Send Reset Link to ${escapeHtml(p.email || '')}</button>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">04</span> 🚪 Sign Out</div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 12px">Sign out from this device. You'll need to enter your credentials again to sign back in.</p>
    <button class="btn btn-danger" onclick="uiConfirm('Sign out from this device?').then(ok=>{if(ok)doSignOut()})">Sign Out</button>
  </div>

  <div class="card" style="border-left:4px solid ${_sn?'#2E7D32':'#C9A84C'}">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">05</span> 🔔 Device Notifications ${_sn?'<span style="font-size:10px;background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:8px;font-weight:800">ON</span>':''}</div>
    <p style="font-size:12px;color:var(--muted);margin:8px 0 12px">Task assignments & alerts appear in your phone's notification tray with sound — while the app is open or in the background.</p>
    ${_sn?`<button class="btn btn-secondary" onclick="disableSysNotifs()">Turn off</button>`
         :`<button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none" onclick="enableSysNotifs()">🔔 Enable</button>`}
  </div>

  <div class="card" style="background:#F5F8FC;border:1px dashed var(--line)">
    <div style="font-size:12px;color:var(--muted);text-align:center;line-height:1.6">
      <strong style="color:#1B3A6B">EjafTech Girêk</strong><br>
      Account managed via Firebase Authentication · Your data is encrypted and secure<br><span style="font-size:10px;font-style:italic;letter-spacing:0.6px;color:var(--muted)">Powered by Siwar</span>
    </div>
  </div>`;
}

function renderEntryManage(){
  if(!isAdmin()) return `<div class="card"><p style="text-align:center;color:var(--muted);padding:20px">Admin only.</p></div>`;
  const projects = [...new Set(state.daily.map(r=>r.project).filter(Boolean))].sort();
  const emv = window._emView || "counters";
  let h = _pills('_emView',[{id:"counters",ic:"🔢",lb:"Counters"},{id:"employees",ic:"👷",lb:"Employees"},{id:"clients",ic:"🤝",lb:"Clients"},{id:"requests",ic:"📨",lb:"Requests"}]);
  if(emv==="counters") h += `
  <div class="card" style="border-left:4px solid #C9A84C">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">⚙</span>
      Report Counter Management
    </div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
      Every report family runs its <strong>own sequence</strong>: HR-2026-0001 · DL- · TR- · RPT- · PM- · INC- · FMR- · FMT-…<br>
      Reset zeroes <strong>all sequences</strong> for the current year so each family restarts from 0001.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-secondary" onclick="viewReportCounter()" style="font-size:12px">👁 View All Counters</button>
      <button class="btn btn-danger" onclick="resetReportCounter()" style="font-size:12px">🔄 Reset ALL to 0001</button>
      <button class="btn btn-secondary" onclick="viewReportLog()" style="font-size:12px">📜 Report Log</button>
    </div>
    <div id="counterStatus" style="margin-top:10px;font-size:12px;color:#2E7D32;display:none"></div>
    <div id="reportLogBox" style="margin-top:10px;display:none"></div>
  </div>

  <div class="card" style="border-left:4px solid #2E7D32">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#2E7D32;color:white;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">📋</span>
      Daily Log Entry Numbering
    </div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
      Each Daily Log entry gets a unique sequential number (001, 002, 003...).<br>
      Use <strong>Assign Numbers</strong> to number your existing entries by date order.<br>
      New entries will auto-number from that point forward.
    </p>
    <div style="background:#f0fff4;border:1px solid #a5d6a7;border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:#2E7D32">
      📊 Current entries: <strong>${state.daily.length}</strong> total · 
      <strong>${state.daily.filter(r=>r.entryNo).length}</strong> numbered · 
      <strong>${state.daily.filter(r=>!r.entryNo).length}</strong> without number
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-primary" onclick="assignDailyNumbers()" style="font-size:12px;background:#2E7D32;border-color:#2E7D32">
        ✅ Assign Numbers to Existing Entries
      </button>
      <button class="btn btn-danger" onclick="resetDailyNumbers()" style="font-size:12px">
        🔄 Reset All Numbers
      </button>
    </div>
  </div>

  <div class="card" style="border-left:4px solid #C9A84C;background:#FEF3C7">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;color:#7F6000">
      <span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">🧹</span>
      Storage Cleanup
    </div>
    <p style="font-size:12px;color:#7F6000;margin-bottom:12px;line-height:1.6">
      Deletes photos only from Daily Log entries matching BOTH the date range AND project. Text descriptions are preserved.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div>
        <label style="font-size:10px;color:#7F6000;display:block;margin-bottom:2px">From Date</label>
        <input type="date" id="purgeFrom" style="padding:6px 10px;border:1px solid #C9A84C;border-radius:8px;font-size:12px">
      </div>
      <div>
        <label style="font-size:10px;color:#7F6000;display:block;margin-bottom:2px">To Date</label>
        <input type="date" id="purgeTo" style="padding:6px 10px;border:1px solid #C9A84C;border-radius:8px;font-size:12px">
      </div>
      <div>
        <label style="font-size:10px;color:#7F6000;display:block;margin-bottom:2px">Project</label>
        <select id="purgeProject" style="padding:6px 10px;border:1px solid #C9A84C;border-radius:8px;font-size:12px;max-width:170px">
          <option value="">All Projects</option>
          ${projects.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn-sm" style="background:#C62828;border:none;color:white;font-weight:700;padding:8px 16px;border-radius:8px" onclick="purgeResolutionImagesCustom()">🗑️ Purge Images</button>
    </div>
  </div>`;
  if(emv==="employees") h += `  <!-- ═══ PER-EMPLOYEE ENTRY PERMISSIONS (Admin) ═══ -->
  <div class="card" style="border-left:4px solid #0277BD">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#0277BD;color:white;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">🔐</span>
      Entry Permissions per Employee
    </div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
      Control what each employee must provide when adding a Daily Log entry.<br>
      <strong>GPS Required:</strong> employee location captured automatically on save (entry still saves if denied, marked "GPS denied").<br>
      <strong>Resolution Required:</strong> description text + at least 1 photo mandatory.<br>
      <strong>Area/Site Required:</strong> employee must pick an Area + Site (only for projects that have areas).<br>
      <strong>Device Tracking:</strong> shows a Device picker in Daily Log; employee can update device Status + Install Date (syncs centrally).<br>
      <strong>Full Device Edit:</strong> employee can edit ALL device fields from Daily Log (IP, model, vendor…). Requires Device Tracking.
    </p>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${allEmployees().map(emp => {
        const p = getEmpPermissions(emp);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:#F7FAFC;border:1px solid #E2E8F0;border-radius:8px;gap:10px;flex-wrap:wrap">
          <div style="font-weight:700;color:#1A202C;font-size:13px;min-width:140px">${employeeBadge(emp)}</div>
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.gpsRequired?"checked":""} onchange="toggleEmpPerm('${escapeHtml(emp)}','gpsRequired')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.gpsRequired?'#2E7D32':'#999'};font-weight:600">🛰️ GPS Required</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.resolutionRequired?"checked":""} onchange="toggleEmpPerm('${escapeHtml(emp)}','resolutionRequired')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.resolutionRequired?'#03308B':'#999'};font-weight:600">📸 Resolution Required</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.equipmentRequired?"checked":""} onchange="toggleEmpPerm('${escapeHtml(emp)}','equipmentRequired')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.equipmentRequired?'#6A1B9A':'#999'};font-weight:600">🗺️ Area/Site Required</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.deviceTracking?"checked":""} onchange="toggleEmpPerm('${escapeHtml(emp)}','deviceTracking')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.deviceTracking?'#00897B':'#999'};font-weight:600">📟 Device Tracking</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.fullDeviceEdit?"checked":""} onchange="toggleEmpPerm('${escapeHtml(emp)}','fullDeviceEdit')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.fullDeviceEdit?'#E65100':'#999'};font-weight:600">🔧 Full Device Edit</span>
            </label>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>`;
  if(emv==="clients") h += `  <!-- ═══ ENTRY PERMISSION PER CLIENT (Admin) ═══ -->
  <div class="card" style="border-left:4px solid #C9A84C">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">🤝</span>
      Entry Permission per Client
    </div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
      Control what each client can see and do in their portal.<br>
      <strong>Project Details:</strong> client can pick Project → Project Code → Area → Site → Device when submitting a Request (pinpoints exactly what they need).<br>
      <strong>Suggest Device Edits:</strong> client can propose changes to device details — saved as suggestions for your approval, never written directly.<br>
      <strong>Portal Filters:</strong> filter bar in the client portal (Project · Code · Area · Site · Device · Serial · Model).<br>
      <strong>Reports Export:</strong> client can generate branded PDF / Excel reports of their own projects.
    </p>
    ${(state.clients||[]).length===0?`<div class="empty" style="padding:14px">No clients yet — add them in the Clients tab.</div>`:`
    <div style="display:flex;flex-direction:column;gap:6px">
      ${(state.clients||[]).map(c => {
        const p = getClientPermissions(c.id);
        const linked = !!(c.linkedUserEmail || c.linkedUserUid);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:#FFFDF5;border:1px solid #EADFC0;border-radius:8px;gap:10px;flex-wrap:wrap">
          <div style="min-width:150px">
            <div style="font-weight:700;color:#1A202C;font-size:13px">🤝 ${escapeHtml(c.name)}</div>
            <div style="font-size:10px;color:${linked?'#2E7D32':'#C62828'}">${linked?`👤 ${escapeHtml(linkedClientLabel(c)||'linked')}`:'No login linked'}</div>
          </div>
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.projectDetails?"checked":""} onchange="toggleClientPerm('${escapeHtml(c.id)}','projectDetails')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.projectDetails?'#03308B':'#999'};font-weight:600">🗂️ Project Details</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.deviceEditSuggest?"checked":""} onchange="toggleClientPerm('${escapeHtml(c.id)}','deviceEditSuggest')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.deviceEditSuggest?'#E65100':'#999'};font-weight:600">✏️ Suggest Device Edits</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.portalFilters?"checked":""} onchange="toggleClientPerm('${escapeHtml(c.id)}','portalFilters')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.portalFilters?'#6A1B9A':'#999'};font-weight:600">🔎 Portal Filters</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
              <input type="checkbox" ${p.reportsExport?"checked":""} onchange="toggleClientPerm('${escapeHtml(c.id)}','reportsExport')" style="width:16px;height:16px;cursor:pointer">
              <span style="color:${p.reportsExport?'#00897B':'#999'};font-weight:600">📊 Reports Export</span>
            </label>
          </div>
          ${p.reportsExport?`<div style="width:100%;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:6px 0 0 8px;border-top:1px dashed #EADFC0;margin-top:4px">
            <span style="font-size:10px;color:#7F6000;font-weight:700">Report includes:</span>
            ${[["repSummary","Summary"],["repWorkLog","Work Log"],["repDevices","Devices"],["repRequests","Requests"]].map(([k,l])=>`
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;user-select:none">
              <input type="checkbox" ${p[k]?"checked":""} onchange="toggleClientPerm('${escapeHtml(c.id)}','${k}')" style="width:13px;height:13px;cursor:pointer">
              <span style="color:${p[k]?'#00897B':'#999'}">${l}</span>
            </label>`).join("")}
          </div>`:""}
        </div>`;
      }).join("")}
    </div>`}
  </div>`;
  if(emv==="requests"){
    const rss=(state.requestStatuses||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
    const pss=(state.projectStatuses||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
    h += `
    <div class="card" style="border:2px solid #C9A84C">
      <div class="card-title" style="color:#7F6000">📨 Client Request Entry</div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.6">
        Options used in the client <strong>Requests</strong> workflow. Leave a list empty to keep the built-in defaults.<br>
        Deleting an option never touches existing requests — they keep their status; the option just disappears from pickers.
      </p>
      <div style="margin-bottom:18px">
        <div style="font-weight:800;color:#B8860B;font-size:13px;margin-bottom:8px">🔖 Request Statuses <span style="font-weight:400;color:#999;font-size:11px">(defaults: New · In Progress · Completed)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${rss.length===0?`<span style="font-size:12px;color:#999">Using built-in defaults</span>`:rss.map(w=>`
            <span style="display:inline-flex;align-items:center;gap:5px;background:#FFF8E1;color:#7F6000;padding:5px 8px 5px 12px;border-radius:16px;font-size:12px;font-weight:600">
              ${escapeHtml(w.name)}
              <button onclick="delTechItem('requestStatuses','${w.id}')" style="background:#F5E3B0;border:none;color:#7F6000;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newReqStatus" placeholder="Add request status (e.g. Waiting Parts)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px">
          <button class="btn btn-sm" style="background:#B8860B;color:white;border:none;font-weight:700" onclick="addTechItem('requestStatuses','newReqStatus',${rss.length})">+ Add</button>
        </div>
        <div style="font-size:10px;color:#999;margin-top:5px">💡 The <strong>first</strong> status in this list is what new client requests start as.</div>
      </div>
      <div>
        <div style="font-weight:800;color:#00695C;font-size:13px;margin-bottom:8px">🏗️ Project Statuses <span style="font-weight:400;color:#999;font-size:11px">(defaults: Active · On Hold · Completed)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${pss.length===0?`<span style="font-size:12px;color:#999">Using built-in defaults</span>`:pss.map(w=>`
            <span style="display:inline-flex;align-items:center;gap:5px;background:#E0F2F1;color:#00695C;padding:5px 8px 5px 12px;border-radius:16px;font-size:12px;font-weight:600">
              ${escapeHtml(w.name)}
              <button onclick="delTechItem('projectStatuses','${w.id}')" style="background:#B2DFDB;border:none;color:#00695C;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newProjStatus" placeholder="Add project status (e.g. Handover)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px">
          <button class="btn btn-sm" style="background:#00695C;color:white;border:none;font-weight:700" onclick="addTechItem('projectStatuses','newProjStatus',${pss.length})">+ Add</button>
        </div>
        <div style="font-size:10px;color:#999;margin-top:5px">Set each project's status in <strong>Database → Projects</strong>; clients see it on their portal.</div>
      </div>
    </div>`; }
  return h;
}
function passwordStrengthBar(pw){
  let score = 0;
  if(pw.length >= 6) score++;
  if(pw.length >= 10) score++;
  if(/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if(/[0-9]/.test(pw)) score++;
  if(/[^A-Za-z0-9]/.test(pw)) score++;
  const colors = ['#C62828','#E65100','#F9A825','#558B2F','#2E7D32'];
  const labels = ['Very Weak','Weak','Fair','Good','Strong'];
  const idx = Math.min(score, 4);
  const pct = (score/5)*100;
  return `<div style="margin-top:4px">
    <div style="height:6px;background:#F0F0F0;border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${colors[idx]};transition:width 0.3s"></div>
    </div>
    <div style="font-size:11px;color:${colors[idx]};font-weight:700;margin-top:4px">Password strength: ${labels[idx]}</div>
  </div>`;
}

async function changeMyPassword(){
  if(!profileForm.current || !profileForm.newPass) return toast("All fields required");
  if(profileForm.newPass.length < 6) return toast("Password must be 6+ characters");
  if(profileForm.newPass !== profileForm.confirm) return toast("Passwords don't match");
  if(profileForm.newPass === profileForm.current) return toast("New password must be different");

  try {
    const { auth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } = window.__fb;
    const user = auth.currentUser;
    if(!user) return toast("Not signed in");

    // Re-authenticate with current password
    const credential = EmailAuthProvider.credential(user.email, profileForm.current);
    await reauthenticateWithCredential(user, credential);

    // Update to new password
    await updatePassword(user, profileForm.newPass);

    saveToast("✓ Password updated successfully!");
    profileForm = { current:"", newPass:"", confirm:"", showOldPass:false, showNewPass:false };
    render();
  } catch(e) {
    console.error(e);
    let msg = "Failed to change password";
    if(e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") msg = "Current password is incorrect";
    if(e.code === "auth/weak-password") msg = "New password is too weak";
    if(e.code === "auth/requires-recent-login") msg = "Please sign out and sign in again, then try";
    if(e.code === "auth/too-many-requests") msg = "Too many attempts. Try again later.";
    toast("❌ " + msg);
  }
}

async function requestPasswordReset(){
  const email = state.profile?.email;
  if(!email) return toast("No email on file");
  if(!await uiConfirm(`Send password reset link to:\n${email}?`)) return;
  try {
    const { auth, sendPasswordResetEmail } = window.__fb;
    await sendPasswordResetEmail(auth, email);
    alert(`✓ Reset link sent to ${email}!\n\nCheck your inbox (and Spam folder).\n\nThe link expires in 1 hour.`);
  } catch(e) {
    console.error(e);
    toast("❌ Failed to send reset email");
  }
}

window.changeMyPassword = changeMyPassword;
window.requestPasswordReset = requestPasswordReset;
Object.defineProperty(window,'profileForm',{get:()=>profileForm,set:v=>profileForm=v,configurable:true});

// ── Report Counter Admin Tools ────────────────────────────────────────
window.viewReportCounter = async function(){
  if(!isAdmin()) return;
  try{
    const {db, collection, getDocs} = window.__fb;
    if(!db) return toast("Database not ready");
    const year = new Date().getFullYear();
    const snap = await getDocs(collection(db, "reportCounters"));
    const rows=[];
    snap.forEach(d=>{
      const x=d.data();
      if(x.year!==year) return;
      if(!x.prefix){ rows.push({p:"RPT (legacy shared)",c:x.count||0,next:`RPT-${year}-${String((x.count||0)+1).padStart(4,"0")}`}); return; }
      rows.push({p:`${x.prefix} — ${(window.REF_TYPE_LABEL||{})[x.prefix]||x.prefix}`,c:x.count||0,next:`${x.prefix}-${year}-${String((x.count||0)+1).padStart(4,"0")}`});
    });
    const el = document.getElementById("counterStatus");
    if(!el) return;
    el.style.display = "block"; el.style.color = "#1B3A6B";
    el.innerHTML = rows.length
      ? `<strong>Sequences for ${year}:</strong><br>`+rows.sort((a,b)=>a.p.localeCompare(b.p)).map(r=>`• ${r.p}: <strong>${r.c}</strong> → next <strong>${r.next}</strong>`).join("<br>")
      : `✅ No counters yet for ${year} — each family starts at its own 0001 (e.g. PM-${year}-0001, INC-${year}-0001).`;
  } catch(e){ toast("Error reading counters: " + e.message); }
};

window.resetReportCounter = async function(){
  if(!isAdmin()) return;
  const year = new Date().getFullYear();
  if(!await uiConfirm(`Reset ALL report sequences for ${year} to 0?\n\nEvery family (HR, DL, TR, RPT, PM, INC, FMR, FMT, …) will restart from 0001.\n\nThis does not delete any existing reports or the log.`)) return;
  try{
    const {db, doc, setDoc, collection, getDocs} = window.__fb;
    if(!db) return toast("Database not ready");
    const snap = await getDocs(collection(db, "reportCounters"));
    let n=0;
    for(const d of snap.docs){
      const x=d.data();
      if(x.year!==year) continue;
      await setDoc(doc(db,"reportCounters",d.id), {...x, count:0, year});
      n++;
    }
    // legacy shared doc too, in case it exists
    await setDoc(doc(db, "reportCounters", String(year)), { count: 0, year: year });
    const el = document.getElementById("counterStatus");
    if(el){ el.style.display="block"; el.style.color="#2E7D32";
      el.innerHTML=`✅ All sequences reset (${n} counter${n===1?"":"s"}) — every family's next report is its own <strong>0001</strong>.`; }
    toast(`All report sequences reset ✓`);
  } catch(e){ toast("Error resetting: " + e.message); }
};

// ── Report Log: full register of every generated report number ──
window.viewReportLog = async function(){
  if(!isAdmin()) return;
  const box=document.getElementById("reportLogBox");
  if(!box) return;
  if(box.style.display==="block"){ box.style.display="none"; return; }
  box.style.display="block";
  box.innerHTML=`<div style="font-size:12px;color:var(--muted)">Loading log…</div>`;
  try{
    const {db, collection, getDocs} = window.__fb;
    const snap = await getDocs(collection(db, "reportLog"));
    const rows=[];
    snap.forEach(d=>rows.push(d.data()));
    rows.sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));
    const show=rows.slice(0,150);
    box.innerHTML = rows.length===0
      ? `<div class="empty empty2"><span class="e-ic">📜</span><div class="e-t">No reports logged yet</div><div class="e-m">Every generated report number will appear here</div></div>`
      : `<div style="font-size:11px;color:var(--muted);margin-bottom:6px">📜 <strong>${rows.length}</strong> reports logged${rows.length>150?" — showing latest 150":""}</div>
        <div class="tbl-wrap" style="max-height:340px;overflow:auto"><table class="tbl">
        <thead><tr><th>Ref No.</th><th>Type</th><th>By</th><th>Period</th><th>When</th></tr></thead>
        <tbody>${show.map(r=>{
          const pfx=r.prefix||String(r.refNo||"").split("-")[0];
          return `<tr>
            <td style="font-weight:800;color:#03308B;white-space:nowrap">${escapeHtml(r.refNo||"—")}</td>
            <td><span style="font-size:9px;background:#F0F4FF;color:#03308B;padding:1px 8px;border-radius:8px;font-weight:800">${escapeHtml((window.REF_TYPE_LABEL||{})[pfx]||r.reportType||"—")}</span></td>
            <td style="font-size:11px">${escapeHtml(r.exportedByName||r.exportedBy||"—")}</td>
            <td style="font-size:11px">${escapeHtml(r.period||"—")}</td>
            <td style="font-size:11px;white-space:nowrap">${r.at?new Date(r.at).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—"}</td>
          </tr>`;}).join("")}</tbody></table></div>`;
  }catch(e){ box.innerHTML=`<div style="color:#C62828;font-size:12px">Error loading log: ${escapeHtml(e.message)}</div>`; }
};

// Daily Entry Numbering tools (exposed for Profile buttons)
window.assignDailyNumbers = async function(){
  if(!isAdmin()) return;
  const count = state.daily.filter(r=>!r.entryNo).length;
  if(count === 0){ toast("All entries already have numbers ✓"); return; }
  if(!await uiConfirm(`Assign sequential numbers to ${count} existing entries?\n\nEntries will be numbered by date order (oldest = 001).`)) return;
  await assignEntryNumbersToExisting();
};

window.resetDailyNumbers = async function(){
  if(!isAdmin()) return;
  await resetDailyEntryCounter();
};

function renderShare(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Access denied — Admin only</div></div>`;
  const url = window.location.origin + window.location.pathname;

  // Schedule QR generation after render
  setTimeout(()=>{
    const qrDiv = document.getElementById('qrcode-display');
    if(qrDiv && typeof QRCode !== 'undefined'){
      qrDiv.innerHTML = '';
      try{
        new QRCode(qrDiv, {
          text: url,
          width: 220,
          height: 220,
          colorDark: "#1B3A6B",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      }catch(e){
        qrDiv.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">QR generation failed. Use the link below.</div>';
      }
    }
  }, 100);

  return `<div class="card">
    <div class="card-title">Share App with Employees</div>
    <p style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:16px">
      Share this link or QR code with your team. After login, they can install the app on their phone home screen.
    </p>

    <div style="background:var(--card);border:2px solid var(--line);border-radius:12px;padding:20px;text-align:center;margin-bottom:14px">
      <div id="qrcode-display" style="display:flex;justify-content:center;align-items:center;min-height:220px"></div>
      <div style="font-size:11px;color:var(--muted);margin-top:10px">Scan with phone camera to open</div>
    </div>

    <div class="field full">
      <label>App URL</label>
      <input value="${escapeHtml(url)}" readonly onclick="this.select()" style="font-family:monospace;font-size:12px">
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" onclick="copyAppLink()">📋 Copy Link</button>
      <button class="btn btn-secondary" onclick="shareAppLink()">📤 Share</button>
      <button class="btn btn-ghost" onclick="downloadQR()">⬇ Download QR</button>
    </div>
  </div>

  <div class="card" style="background:#E3F2FD;border:1px solid #90CAF9">
    <div class="card-title" style="color:#1565C0">📱 How Employees Install the App</div>
    <ol style="font-size:13px;color:#0D47A1;line-height:1.8;padding-left:18px;margin:0">
      <li>Open the link in <strong>Chrome browser</strong></li>
      <li>Sign in with their email and password</li>
      <li>Tap menu <strong>⋮</strong> → <strong>"Add to Home screen"</strong></li>
      <li>EJAF icon will appear on their phone</li>
      <li>Tap icon to open like a normal app</li>
    </ol>
  </div>

  <div class="card" style="background:#FFF3E0;border:1px solid #FFB74D">
    <div class="card-title" style="color:#E65100">⚠ Before Sharing</div>
    <p style="font-size:13px;color:#BF360C;line-height:1.6;margin:0">
      Make sure you've created accounts for your employees in <strong>Users tab</strong> first, or directly in Firebase Console. Each employee needs their own login.
    </p>
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);color:white">
    <div class="card-title" style="color:#C9A84C">🔒 Backup & Restore</div>
    <p style="font-size:13px;color:#B8CFE8;line-height:1.6;margin-bottom:14px">
      Download a complete backup of all your data as JSON. Keep it safe — if anything happens, you can restore it instantly.
    </p>
    <div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;color:#B8CFE8">
      Current data: ${state.daily.length} daily logs · ${state.overtime.length} overtime · ${state.travel.length} travel · ${state.leaves.length} leaves · ${state.departments.length} departments · ${state.projects.length} projects · ${state.users.length} users
    </div>
    <div class="btn-row">
      <button class="btn btn-sm" style="background:#C9A84C;color:#1B3A6B" onclick="exportBackup()">⬇ Download Backup</button>
      <label class="btn btn-sm btn-ghost" style="background:transparent;color:white;border:1px solid #C9A84C;cursor:pointer;margin:0">
        ⬆ Restore Backup
        <input type="file" accept=".json" onchange="importBackup(this.files[0]);this.value=''" style="display:none">
      </label>
    </div>
    <p style="font-size:11px;color:#8AA8C8;margin-top:12px;line-height:1.5;font-style:italic">
      💡 Tip: Save a backup every month. Store it in Google Drive or email it to yourself.
    </p>
  </div>`;
}

function copyAppLink(){
  const url = window.location.origin + window.location.pathname;
  navigator.clipboard?.writeText(url).then(()=>toast("Link copied ✓")).catch(()=>{
    // fallback
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    toast("Link copied ✓");
  });
}

function shareAppLink(){
  const url = window.location.origin + window.location.pathname;
  if(navigator.share){
    navigator.share({title:'Girêk', text:'Join our team app', url}).catch(()=>{});
  } else {
    copyAppLink();
  }
}

function downloadQR(){
  const qrDiv = document.getElementById('qrcode-display');
  const img = qrDiv?.querySelector('img') || qrDiv?.querySelector('canvas');
  if(!img) return toast("QR not ready");
  try{
    let dataUrl;
    if(img.tagName==='CANVAS'){
      dataUrl = img.toDataURL('image/png');
    } else {
      dataUrl = img.src;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'OperationDeptTrack_QR.png';
    a.click();
    toast("QR downloaded ✓");
  }catch(e){
    toast("Download failed");
  }
}

Object.assign(window, {copyAppLink, shareAppLink, downloadQR});

// ═══════════════════════════════════════════════════════════════════════
//  FLEXIBLE REPORTS — Date range filtering
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  RECYCLE BIN — 30-day recoverable deletes + AUTO-BACKUP center
// ═══════════════════════════════════════════════════════════════════════
const TRASH_DAYS=30;
const _trIcons={daily:"🔧",overtime:"⏰",travel:"✈️",leaves:"🌴",projects:"🏗️",devices:"📟",clients:"🤝",clientRequests:"📨",tasks:"✅",pmSchedules:"🛠️",nametagEmployees:"👤",locations:"📍",branches:"🏢",departments:"🗂️"};
function _trTitle(t){
  const d=t.data||{};
  return d.name||d.title||d.deviceName||d.clientName||[d.employee,d.date].filter(Boolean).join(" · ")||d.serialNumber||t.origId;
}
function _backupCfg(){
  const b=(state.settingsDocs||[]).find(x=>x.id==="backup")||{};
  return {intervalDays:Number(b.intervalDays)||7, lastBackupAt:b.lastBackupAt||""};
}
function renderRecycleBin(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const now=Date.now();
  const items=(state.trash||[]).slice().sort((a,b)=>String(b.deletedAt||"").localeCompare(String(a.deletedAt||"")));
  const bk=_backupCfg();
  const lastD=bk.lastBackupAt?Math.floor((now-new Date(bk.lastBackupAt).getTime())/864e5):null;
  const due=lastD===null||lastD>=bk.intervalDays;
  return `
  <div class="card" style="border-left:4px solid ${due?'#E65100':'#2E7D32'}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div style="font-weight:800;font-size:14px;color:var(--text)">🗄️ Auto-Backup</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">
          ${bk.lastBackupAt?`Last backup: <strong>${fmtDate(bk.lastBackupAt.slice(0,10))}</strong> (${lastD}d ago)`:"<strong>No backup taken yet</strong>"}
          · target every <select onchange="saveBackupInterval(this.value)" style="padding:2px 6px;border:1px solid var(--line);border-radius:8px;font-size:11px;font-weight:700">
            ${[7,14,30].map(v=>`<option value="${v}" ${bk.intervalDays===v?"selected":""}>${v}</option>`).join("")}
          </select> days.
          ${due?'<span style="color:#E65100;font-weight:800"> ⚠ Backup due!</span>':' <span style="color:#2E7D32;font-weight:800">✓ On schedule</span>'}
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">Downloads a full JSON snapshot of ALL data (entries, projects, assets, clients, requests, maintenance…). Keep it in Drive/OneDrive. The bell reminds you when a backup is due.</div>
      </div>
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none" onclick="runFullBackup()">⬇ Backup now</button>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div class="card-title" style="margin:0">🗑 Recycle Bin <span class="count-pill">${items.length}</span></div>
      ${items.length?`<button class="btn btn-sm btn-danger" onclick="emptyTrash()">🧹 Empty bin</button>`:""}
    </div>
    <p style="font-size:11px;color:var(--muted);margin:6px 0 12px">Every deleted record lands here and can be restored with one tap. Items older than ${TRASH_DAYS} days are purged automatically.</p>
    ${items.length===0?'<div class="empty">Bin is empty — deletes are protected from now on.</div>':`
    <div style="display:flex;flex-direction:column;gap:8px">
      ${items.map(t=>{
        const age=Math.floor((now-new Date(t.deletedAt||0).getTime())/864e5);
        const leftD=Math.max(0,TRASH_DAYS-age);
        return `<div style="display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;flex-wrap:wrap">
          <span style="font-size:18px">${_trIcons[t.origCol]||"📄"}</span>
          <div style="flex:1;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:var(--text)">${escapeHtml(_trTitle(t))}</div>
            <div style="font-size:10px;color:var(--muted)">
              <span style="background:#F0F4FF;color:#03308B;padding:1px 7px;border-radius:8px;font-weight:800;font-size:9px">${escapeHtml(t.origCol)}</span>
              · deleted ${fmtDate(String(t.deletedAt||"").slice(0,10))} by ${escapeHtml(t.deletedByName||"—")}
              · <span style="color:${leftD<=5?'#C62828':'var(--muted)'};font-weight:700">${leftD}d left</span>
            </div>
          </div>
          <button class="btn btn-sm" style="background:#2E7D32;color:#fff;border:none;font-weight:800" onclick="restoreTrash('${t.id}')">♻ Restore</button>
          <button class="btn btn-sm btn-danger" onclick="purgeTrashItem('${t.id}')">🗑 Forever</button>
        </div>`;}).join("")}
    </div>`}
  </div>`;
}
window.restoreTrash=async function(id){
  const t=(state.trash||[]).find(x=>x.id===id); if(!t)return;
  const {db,doc,setDoc}=window.__fb;
  await setDoc(doc(db,t.origCol,t.origId), t.data);
  await fbDelete("trash", id);
  toast(`♻ Restored to ${t.origCol} ✓`);
  render();
};
window.purgeTrashItem=async function(id){
  if(!await uiConfirm("Delete FOREVER? This cannot be undone."))return;
  await fbDelete("trash", id); toast("Purged"); render();
};
window.emptyTrash=async function(){
  const n=(state.trash||[]).length;
  if(!await uiConfirm(`Empty the bin? ${n} item(s) will be deleted FOREVER.`))return;
  for(const t of (state.trash||[]).slice()) await fbDelete("trash", t.id);
  toast("🧹 Bin emptied"); render();
};
// auto-purge >30d (admins, once per session)
(function(){ let done=false;
  window._trashAutoPurge=async function(){
    if(done||!isAdmin())return; done=true;
    const cutoff=Date.now()-TRASH_DAYS*864e5;
    const old=(state.trash||[]).filter(t=>new Date(t.deletedAt||0).getTime()<cutoff);
    for(const t of old){ try{ await fbDelete("trash",t.id); }catch(e){} }
    if(old.length) console.log("trash auto-purged:",old.length);
  };
})();
window.saveBackupInterval=async function(v){
  const b=_backupCfg();
  await fbSave("settings",{id:"backup",intervalDays:Number(v)||7,lastBackupAt:b.lastBackupAt||""});
  saveToast("Backup interval saved ✓");
};
window.runFullBackup=async function(){
  try{
    const cols=["daily","overtime","travel","leaves","projects","devices","clients","clientRequests","tasks","pmSchedules","nametagEmployees","locations","branches","departments","workCategories","workTasks","techWorkTypes","techStatuses","techCategories","requestStatuses","projectStatuses","clientPermissions","deviceEditSuggestions","incidents","systemTypes","systemChecks","publicShares","waContacts","emailContacts","settingsDocs","notifications","users"];
    const payload={app:"Girêk — EJAF Technology",exportedAt:new Date().toISOString(),by:(state.profile&&(state.profile.name||state.profile.email))||"",collections:{}};
    let total=0;
    cols.forEach(k=>{ const v=state[k]; if(Array.isArray(v)){ payload.collections[k]=v; total+=v.length; } });
    const blob=new Blob([JSON.stringify(payload,null,1)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`girek-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    await fbSave("settings",{id:"backup",intervalDays:_backupCfg().intervalDays,lastBackupAt:new Date().toISOString()});
    toast(`🗄️ Backup downloaded — ${total} records ✓`);
    render();
  }catch(e){ toast("⚠ Backup failed: "+e.message); }
};
