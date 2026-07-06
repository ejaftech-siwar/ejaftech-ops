function renderProfile(){
  const p = state.profile || {};
  const u = state.user || {};
  const role = (p.role || 'employee').toUpperCase();
  const roleColor = role === 'ADMIN' ? '#C9A84C' : role === 'HR' ? '#2E5FA3' : '#2E7D32';

  // Last sign-in info
  const lastSignIn = u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).toLocaleString('en-GB') : 'Unknown';
  const accountCreated = u.metadata?.creationTime ? new Date(u.metadata.creationTime).toLocaleString('en-GB') : 'Unknown';

  if(!profileForm) profileForm = { current:"", newPass:"", confirm:"", showOldPass:false, showNewPass:false };

  return `<div class="card" style="background:linear-gradient(135deg,#1B3A6B 0%,#2E5FA3 100%);color:white;border:2px solid #C9A84C">
    <div style="display:flex;align-items:center;gap:14px">
      <div onclick="document.getElementById('profilePhotoInput').click()" title="Tap to change photo" style="position:relative;width:64px;height:64px;border:2px solid #C9A84C;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#1B3A6B;flex-shrink:0;cursor:pointer;overflow:hidden">
        ${p.photoData?`<img src="${p.photoData}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover">`:`<span style="font-family:'DM Serif Display',serif;font-size:20px;color:#C9A84C;font-weight:700">${escapeHtml((p.name||'?').charAt(0).toUpperCase())}</span>`}
        <span style="position:absolute;right:-1px;bottom:-1px;width:22px;height:22px;background:#C9A84C;color:#1B3A6B;border-radius:11px 0 10px 0;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 0 0 2px #1B3A6B">📷</span>
      </div>
      <input type="file" id="profilePhotoInput" accept="image/*" onchange="uploadProfilePhoto(this)" style="display:none">
      <div style="flex:1;min-width:0">
        <h2 style="font-family:'DM Serif Display',serif;font-size:22px;color:white;margin:0;line-height:1.2">${escapeHtml(p.name || 'User')}</h2>
        <div style="font-size:12px;color:#B8CFE8;margin-top:4px">${escapeHtml(p.email || '')}</div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="background:${roleColor};color:#1B3A6B;font-size:11px;padding:3px 10px;border-radius:10px;font-weight:800;letter-spacing:0.5px">${role}</span>
          ${p.photoData
            ? `<button onclick="removeProfilePhoto()" style="background:rgba(255,255,255,0.15);color:#fff;border:none;font-size:11px;padding:4px 10px;border-radius:10px;cursor:pointer;font-family:inherit">Remove photo</button>`
            : `<button onclick="document.getElementById('profilePhotoInput').click()" style="background:rgba(255,255,255,0.15);color:#fff;border:none;font-size:11px;padding:4px 10px;border-radius:10px;cursor:pointer;font-family:inherit">📷 Add photo</button>`}
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">01</span> Account Information</div>
    <div style="display:grid;gap:10px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:white">
        <span style="color:var(--muted);font-size:12px">Email</span>
        <strong style="color:#1B3A6B">${escapeHtml(p.email || 'N/A')}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:white">
        <span style="color:var(--muted);font-size:12px">Full Name</span>
        <strong style="color:#1B3A6B">${escapeHtml(p.name || 'N/A')}</strong>
      </div>
      ${p.employeeName ? `<div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:white">
        <span style="color:var(--muted);font-size:12px">Tracked As</span>
        <strong style="color:#1B3A6B">${escapeHtml(p.employeeName)}</strong>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:white">
        <span style="color:var(--muted);font-size:12px">Role</span>
        <span style="background:${roleColor}22;color:${roleColor};font-size:11px;padding:3px 10px;border-radius:10px;font-weight:700">${role}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:white">
        <span style="color:var(--muted);font-size:12px">Last Sign In</span>
        <span style="color:#1B3A6B;font-size:12px">${lastSignIn}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border:1px solid var(--line);border-radius:8px;background:white">
        <span style="color:var(--muted);font-size:12px">Account Created</span>
        <span style="color:#1B3A6B;font-size:12px">${accountCreated}</span>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">02</span> 🔒 Change Password</div>
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
      ${profileForm.newPass && profileForm.confirm ? `<div class="field full" style="padding:8px 12px;border-radius:6px;background:${profileForm.newPass===profileForm.confirm ? '#E8F5E9' : '#FFEBEE'};border:1px solid ${profileForm.newPass===profileForm.confirm ? '#A5D6A7' : '#EF9A9A'};font-size:12px;color:${profileForm.newPass===profileForm.confirm ? '#2E7D32' : '#C62828'};font-weight:600">
        ${profileForm.newPass===profileForm.confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
      </div>` : ''}
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn btn-primary" onclick="changeMyPassword()" ${(!profileForm.current||!profileForm.newPass||profileForm.newPass!==profileForm.confirm||profileForm.newPass.length<6)?'disabled':''}>🔐 Update Password</button>
      <button class="btn btn-ghost" onclick="window.profileForm={current:'',newPass:'',confirm:'',showOldPass:false,showNewPass:false};render()">Clear</button>
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">03</span> 🔑 Forgot Password?</div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 12px">If you can't remember your current password, click below to receive a reset link via email.</p>
    <button class="btn btn-ghost" style="background:#FFF8E1;border:1px solid #C9A84C;color:#7F6000" onclick="requestPasswordReset()">📧 Send Reset Link to ${escapeHtml(p.email || '')}</button>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">04</span> 🚪 Sign Out</div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 12px">Sign out from this device. You'll need to enter your credentials again to sign back in.</p>
    <button class="btn btn-danger" onclick="if(confirm('Sign out from this device?')) doSignOut()">Sign Out</button>
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
      <span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">⚙</span>
      Report Counter Management
    </div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
      The sequential report number (RPT-YYYY-NNNN) is stored in Firestore.<br>
      Use this to reset the counter to 0 so next export starts from RPT-YYYY-0001.
    </p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-secondary" onclick="viewReportCounter()" style="font-size:12px">👁 View Current Counter</button>
      <button class="btn btn-danger" onclick="resetReportCounter()" style="font-size:12px">🔄 Reset to 0001</button>
    </div>
    <div id="counterStatus" style="margin-top:10px;font-size:12px;color:#2E7D32;display:none"></div>
  </div>

  <div class="card" style="border-left:4px solid #2E7D32">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#2E7D32;color:white;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">📋</span>
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
      <span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">🧹</span>
      Storage Cleanup
    </div>
    <p style="font-size:12px;color:#7F6000;margin-bottom:12px;line-height:1.6">
      Deletes photos only from Daily Log entries matching BOTH the date range AND project. Text descriptions are preserved.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div>
        <label style="font-size:10px;color:#7F6000;display:block;margin-bottom:2px">From Date</label>
        <input type="date" id="purgeFrom" style="padding:6px 10px;border:1px solid #C9A84C;border-radius:6px;font-size:12px">
      </div>
      <div>
        <label style="font-size:10px;color:#7F6000;display:block;margin-bottom:2px">To Date</label>
        <input type="date" id="purgeTo" style="padding:6px 10px;border:1px solid #C9A84C;border-radius:6px;font-size:12px">
      </div>
      <div>
        <label style="font-size:10px;color:#7F6000;display:block;margin-bottom:2px">Project</label>
        <select id="purgeProject" style="padding:6px 10px;border:1px solid #C9A84C;border-radius:6px;font-size:12px;max-width:170px">
          <option value="">All Projects</option>
          ${projects.map(p=>`<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
        </select>
      </div>
      <button class="btn btn-sm" style="background:#C62828;border:none;color:white;font-weight:700;padding:8px 16px;border-radius:6px" onclick="purgeResolutionImagesCustom()">🗑️ Purge Images</button>
    </div>
  </div>`;
  if(emv==="employees") h += `  <!-- ═══ PER-EMPLOYEE ENTRY PERMISSIONS (Admin) ═══ -->
  <div class="card" style="border-left:4px solid #0277BD">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#0277BD;color:white;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">🔐</span>
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
      <span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:800">🤝</span>
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
            <span style="display:inline-flex;align-items:center;gap:5px;background:#FFF8E1;color:#7F6000;padding:5px 8px 5px 12px;border-radius:14px;font-size:12px;font-weight:600">
              ${escapeHtml(w.name)}
              <button onclick="delTechItem('requestStatuses','${w.id}')" style="background:#F5E3B0;border:none;color:#7F6000;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newReqStatus" placeholder="Add request status (e.g. Waiting Parts)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:7px;font-size:12px">
          <button class="btn btn-sm" style="background:#B8860B;color:white;border:none;font-weight:700" onclick="addTechItem('requestStatuses','newReqStatus',${rss.length})">+ Add</button>
        </div>
        <div style="font-size:10px;color:#999;margin-top:5px">💡 The <strong>first</strong> status in this list is what new client requests start as.</div>
      </div>
      <div>
        <div style="font-weight:800;color:#00695C;font-size:13px;margin-bottom:8px">🏗️ Project Statuses <span style="font-weight:400;color:#999;font-size:11px">(defaults: Active · On Hold · Completed)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${pss.length===0?`<span style="font-size:12px;color:#999">Using built-in defaults</span>`:pss.map(w=>`
            <span style="display:inline-flex;align-items:center;gap:5px;background:#E0F2F1;color:#00695C;padding:5px 8px 5px 12px;border-radius:14px;font-size:12px;font-weight:600">
              ${escapeHtml(w.name)}
              <button onclick="delTechItem('projectStatuses','${w.id}')" style="background:#B2DFDB;border:none;color:#00695C;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newProjStatus" placeholder="Add project status (e.g. Handover)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:7px;font-size:12px">
          <button class="btn btn-sm" style="background:#00695C;color:white;border:none;font-weight:700" onclick="addTechItem('projectStatuses','newProjStatus',${pss.length})">+ Add</button>
        </div>
        <div style="font-size:10px;color:#999;margin-top:5px">Set each project's status in <strong>Database → Projects</strong>; clients see it on their portal.</div>
      </div>
    </div>`; }
  // ═══ AUDIT LOG (admin) ═══
  if(emv!=="employees"){
    const rows=window._auditRows;
    h += `<div class="card" style="border-left:4px solid #546E7A">
      <div class="filter-row"><span class="card-title" style="margin:0">🕵️ Audit Log</span>
        <button class="btn btn-sm" style="background:#546E7A;color:white;border:none;font-weight:700" onclick="loadAuditLog()">${rows?'↻ Refresh':'Load latest 100'}</button></div>
      <p style="font-size:11px;color:var(--muted);margin:4px 0 10px">Who changed what, and when — saves and deletions across the whole app. Immutable.</p>
      ${!rows?'':rows.length===0?'<div class="empty">No audit entries yet</div>':`
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Where</th><th>Item</th></tr></thead><tbody>
        ${rows.map(r=>`<tr><td style="white-space:nowrap">${escapeHtml((r.ts||'').slice(0,16).replace('T',' '))}</td><td>${escapeHtml(r.user||'')}</td><td><span style="font-size:10px;font-weight:800;color:${r.action==='delete'?'#C62828':r.action==='create'?'#2E7D32':'#E65100'}">${escapeHtml((r.action||'').toUpperCase())}</span></td><td>${escapeHtml(r.col||'')}</td><td>${escapeHtml(r.label||r.docId||'')}</td></tr>`).join('')}
      </tbody></table></div>`}
    </div>`;
  }
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
    <div style="height:6px;background:#F0F0F0;border-radius:3px;overflow:hidden">
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

    toast("✓ Password updated successfully!");
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
  if(!confirm(`Send password reset link to:\n${email}?`)) return;
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
    const {db, doc, getDoc} = window.__fb;
    if(!db) return toast("Database not ready");
    const year = new Date().getFullYear();
    const snap = await getDoc(doc(db, "reportCounters", String(year)));
    const el = document.getElementById("counterStatus");
    if(!el) return;
    if(snap.exists()){
      const d = snap.data();
      el.style.display = "block";
      el.style.color = "#1B3A6B";
      el.innerHTML = `✅ Current counter for ${year}: <strong>${d.count || 0}</strong> — Next export will be <strong>RPT-${year}-${String((d.count||0)+1).padStart(4,"0")}</strong>`;
    } else {
      el.style.display = "block";
      el.style.color = "#2E7D32";
      el.innerHTML = `✅ No counter yet for ${year} — First export will be <strong>RPT-${year}-0001</strong>`;
    }
  } catch(e){
    toast("Error reading counter: " + e.message);
  }
};

window.resetReportCounter = async function(){
  if(!isAdmin()) return;
  const year = new Date().getFullYear();
  if(!confirm(`Reset the report counter for ${year} to 0?\n\nNext exported report will be RPT-${year}-0001.\n\nThis does not delete any existing reports.`)) return;
  try{
    const {db, doc, setDoc} = window.__fb;
    if(!db) return toast("Database not ready");
    await setDoc(doc(db, "reportCounters", String(year)), { count: 0, year: year });
    const el = document.getElementById("counterStatus");
    if(el){
      el.style.display = "block";
      el.style.color = "#2E7D32";
      el.innerHTML = `✅ Counter reset! Next export will be <strong>RPT-${year}-0001</strong>`;
    }
    toast(`Counter reset ✓ — next report: RPT-${year}-0001`);
  } catch(e){
    toast("Error resetting counter: " + e.message);
  }
};

// Daily Entry Numbering tools (exposed for Profile buttons)
window.assignDailyNumbers = async function(){
  if(!isAdmin()) return;
  const count = state.daily.filter(r=>!r.entryNo).length;
  if(count === 0){ toast("All entries already have numbers ✓"); return; }
  if(!confirm(`Assign sequential numbers to ${count} existing entries?\n\nEntries will be numbered by date order (oldest = 001).`)) return;
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

    <div style="background:white;border:2px solid var(--line);border-radius:12px;padding:20px;text-align:center;margin-bottom:14px">
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

window.loadAuditLog=async function(){
  try{
    const {db,collection,query,orderBy,limit,getDocs}=window.__fb;
    const snap=await getDocs(query(collection(db,"auditLog"),orderBy("ts","desc"),limit(100)));
    window._auditRows=snap.docs.map(d=>({id:d.id,...d.data()}));
    render();
  }catch(e){toast("Audit load failed: "+e.message);}
};
