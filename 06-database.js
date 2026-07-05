function renderProjects(){
  const allDepts = deptNames();
  if(!projForm) projForm={name:"", dept: allDepts[0] || ""};

  // Group projects by department dynamically
  const g = {};
  allDepts.forEach(d => g[d] = []);
  g["(uncategorized)"] = [];
  state.projects.forEach(p => {
    if(g[p.dept]) g[p.dept].push(p);
    else g["(uncategorized)"].push(p);
  });

  if(allDepts.length === 0){
    return `<div class="card" style="background:#FFF8E1;border:1px solid #FFE082">
      <div class="card-title" style="color:#7F6000">⚠ No Departments Yet</div>
      <p style="font-size:13px;color:#7F6000;line-height:1.6">
        Before adding projects, you need to create at least one department.<br>
        Go to <strong>Departments</strong> tab to add your first department.
      </p>
    </div>`;
  }

  const pv = window._projView || "list";
  let h = _pills('_projView',[{id:"list",ic:"📁",lb:"Projects"},{id:"add",ic:"➕",lb:"Add Project"}]);
  if(pv==="add")  h += `<div class="card">
    <div class="sec-hdr">${projEditId?"Edit":"Add"} Project</div>
    <div class="form-grid">
      <div class="field"><label>Name <span class="req">*</span></label><input value="${escapeHtml(projForm.name)}" oninput="window.projForm.name=this.value" placeholder="e.g. New Project"></div>
      <div class="field"><label>Estimated Hours <span style="font-size:10px;color:var(--muted)">(for % progress)</span></label>
        <input type="number" min="0" step="1" value="${projForm.estimatedHours||""}" oninput="window.projForm.estimatedHours=this.value" placeholder="e.g. 200"></div>
      <div class="field"><label>Department</label><select onchange="window.projForm.dept=this.value;render()">
        ${allDepts.map(d=>`<option ${projForm.dept===d?"selected":""}>${escapeHtml(d)}</option>`).join("")}
      </select></div>
      <div class="field"><label>Status</label><select onchange="window.projForm.status=this.value">
        <option value="">—</option>
        ${getProjStatusList().map(s=>`<option ${projForm.status===s?"selected":""}>${escapeHtml(s)}</option>`).join("")}
      </select></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveProj()">${projEditId?"Update":"Add"}</button>
      ${projEditId?`<button class="btn btn-ghost" onclick="cancelProj()">Cancel</button>`:""}
    </div>
  </div>

  <div class="card" style="background:#E0F2F1;border:1px solid #80CBC4">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="font-weight:800;color:#00695C;font-size:14px">📥 Bulk Import</div>
        <p style="font-size:12px;color:#004D40;margin:4px 0 0;line-height:1.5">Use the <strong>📥 Import</strong> button on any department below to upload projects, areas & sites from a CSV/Excel file. Columns: <strong>Project · Area Name · Site Name · Status</strong>.</p>
      </div>
      <button class="btn btn-sm" style="background:#00897B;color:white;border:none;font-weight:700" onclick="downloadImportTemplate()">⬇ Template</button>
    </div>
  </div>`;
  if(pv==="list") h += `
  ${Object.keys(g).filter(d=>g[d].length>0 || allDepts.includes(d)).map(d=>{
    const isUncategorized = d === "(uncategorized)";
    const color = isUncategorized ? "#6B7B8F" : deptColor(d);
    return `<div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div class="card-title" style="margin:0">${isUncategorized?`<span style="color:#6B7B8F">${d}</span>`:deptBadgeDyn(d)} · ${g[d].length} projects</div>
        ${!isUncategorized?`<button class="btn btn-sm" style="background:#00897B;color:white;border:none;font-weight:700;font-size:11px" onclick="importProjectsForDept('${escapeHtml(d)}')" title="Import projects/sites/equipment from CSV or Excel">📥 Import</button>`:''}
      </div>
      ${g[d].length===0?`<div class="empty">No projects</div>`:`<div class="proj-chips">${g[d].map(p=>{const areaCount=(p.areas&&p.areas.length)?p.areas.length:((p.sites&&p.sites.length)?1:0);return `<span class="proj-chip" style="border-left:3px solid ${color}">${escapeHtml(p.name)}${areaCount>0?`<span style="font-size:9px;background:#1565C0;color:white;padding:1px 5px;border-radius:8px;margin-left:4px">${areaCount} 🗺️</span>`:''}
        <button class="btn btn-sm" style="padding:2px 6px;background:#1565C0;color:white;border:none" onclick="openSitesModal('${p.id}')" title="Manage areas & sites">🗺️</button>
        <button class="btn btn-sm btn-secondary" onclick="editProj('${p.id}')" style="padding:2px 6px">✎</button>
        <button class="btn btn-sm btn-danger" onclick="delProj('${p.id}')" style="padding:2px 6px">🗑</button></span>`}).join("")}</div>`}
    </div>`;
  }).join("")}`;
  return h;
}

async function saveProj(){
  if(!isAdmin()) return toast("Admin only");
  const cleanName=(projForm.name||"").trim();
  if(!cleanName) return toast("Project name is required");
  const dup=(state.projects||[]).find(p=>(p.name||"").trim().toLowerCase()===cleanName.toLowerCase() && p.id!==projEditId);
  if(dup) return toast("⚠ A project with this name already exists");
  // Preserve existing areas/codes when editing (the form only edits name/dept/status/hours)
  const existing = projEditId ? state.projects.find(p=>p.id===projEditId) : null;
  const areas = existing ? getProjectAreas(existing) : [];
  const codes = existing ? (existing.codes||[]) : [];
  await fbSave("projects",{
    id: projEditId||undefined,
    name: cleanName,
    dept: projForm.dept||"",
    status: projForm.status||"",
    estimatedHours: Number(projForm.estimatedHours||0),
    areas, codes,
  });
  toast(projEditId?"Project updated ✓":"Project added ✓");
  projForm=null; projEditId=null; render();
}
function editProj(id){const r=state.projects.find(p=>p.id===id);if(r){projForm={...r};projEditId=id;render();window.scrollTo(0,0);}}
async function delProj(id){if(confirm("Delete?")){await fbDelete("projects",id);toast("Deleted");}}
function cancelProj(){projForm=null;projEditId=null;render();}
Object.assign(window,{saveProj,editProj,delProj,cancelProj});
Object.defineProperty(window,'projForm',{get:()=>projForm,set:v=>projForm=v});

// ═══════════════════════════════════════════════════════════════════════
//  LOCATIONS (HR+)
// ═══════════════════════════════════════════════════════════════════════
function renderLocations(){
  return `<div class="card">
    <div class="sec-hdr">${locEditId?"Edit":"Add"} Location</div>
    <div class="form-grid full">
      <div class="field"><label>City Name <span class="req">*</span></label>
        <input value="${escapeHtml(locForm)}" oninput="window.locForm=this.value" placeholder="e.g. Mosul"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveLoc()">${locEditId?"Update":"Add"}</button>
      ${locEditId?`<button class="btn btn-ghost" onclick="cancelLoc()">Cancel</button>`:""}
    </div>
  </div>
  <div class="card">
    <div class="card-title">Locations · ${state.locations.length}</div>
    <div class="proj-chips">${state.locations.map(l=>`<span class="proj-chip">📍 ${escapeHtml(l.name)}
      <button class="btn btn-sm btn-secondary" onclick="editLoc('${l.id}')" style="padding:2px 6px">✎</button>
      <button class="btn btn-sm btn-danger" onclick="delLoc('${l.id}')" style="padding:2px 6px">🗑</button></span>`).join("")}</div>
  </div>`;
}
async function saveLoc(){
  const name=(locForm||"").trim();
  if(!name)return toast("City name required");
  if(!locEditId&&state.locations.find(l=>(l.name||"").trim()===name))return toast("Already exists");
  const id=locEditId||name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
  if(!id)return toast("Invalid name");

  // ── Cascade rename if name changed (Admin only) ──
  let oldName = null;
  if(locEditId){
    const existing = state.locations.find(l=>l.id===locEditId);
    if(existing && existing.name !== name) oldName = existing.name;
  }
  if(oldName && !isAdmin()) return toast("Only Admin can rename locations");
  if(oldName){
    const affected = state.daily.filter(r=>r.location===oldName).length
      + state.overtime.filter(r=>r.location===oldName).length
      + state.travel.filter(r=>r.location===oldName).length;
    if(affected > 0 && !confirm(`Rename "${oldName}" → "${name}"?\n\nThis will update ${affected} record(s).\n\nThis cannot be undone.`)) return;
  }

  await fbSave("locations",{id,name});

  if(oldName){
    const synced = await cascadeRenameLocation(oldName, name);
    toast(`✓ Renamed & synced ${synced} record(s)`);
  } else {
    toast("Saved ✓");
  }
  locForm="";locEditId=null;
}
function editLoc(id){const r=state.locations.find(l=>l.id===id);if(r){locForm=r.name;locEditId=id;render();window.scrollTo(0,0);}}
async function delLoc(id){if(confirm("Delete?")){await fbDelete("locations",id);toast("Deleted");}}
function cancelLoc(){locForm="";locEditId=null;render();}
Object.assign(window,{saveLoc,editLoc,delLoc,cancelLoc});
Object.defineProperty(window,'locForm',{get:()=>locForm,set:v=>locForm=v});

// ═══════════════════════════════════════════════════════════════════════
//  USERS (ADMIN ONLY)
// ═══════════════════════════════════════════════════════════════════════
function renderUsers(){
  if(!isAdmin())return `<div class="card"><div class="empty">Access denied — Admin only</div></div>`;
  if(!userForm)userForm={name:"",email:"",password:"",role:"employee",employeeName:"",branch:"",userDept:"",jobTitle:"",supervisorName:"",isSupervisor:false};
  const uv = window._usersView || "team";
  const _up=(id,ic,lb)=>`<button onclick="window._usersView='${id}';window.__navFade=true;render()" style="flex:1;padding:10px 6px;border:none;border-radius:9px;font-weight:800;font-size:12px;cursor:pointer;background:${uv===id?'#03308B':'#E8EEF7'};color:${uv===id?'#C9A84C':'#1B3A6B'}">${ic} ${lb}</button>`;
  let h = `<div style="display:flex;gap:6px;margin-bottom:14px">${_up("team","👥","Team Members")}${_up("add","➕","Add User")}${_up("tags","🏷️","Nametags")}</div>`;
  if(uv==="add")  h += `<div class="card">
    <div class="sec-hdr">${userEditId?"Edit":"Add"} User</div>
    ${!userEditId?`<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;padding:10px;font-size:12px;color:#7F6000;margin-bottom:14px">
      <strong>⚠ How user creation works:</strong><br>
      1. This creates a new account temporarily signing you out and into the new account<br>
      2. You'll be signed back in automatically as Admin after creation<br>
      <em>If issues occur, you can also add users manually from Firebase Console.</em>
    </div>`:""}
    <div class="form-grid">
      <div class="field full"><label>Display Name <span class="req">*</span></label>
        <input value="${escapeHtml(userForm.name)}" oninput="window.userForm.name=this.value" placeholder="Full name"></div>
      <div class="field full"><label>Email <span class="req">*</span></label>
        <input type="email" value="${escapeHtml(userForm.email)}" oninput="window.userForm.email=this.value" placeholder="user@ejaftech.com">${userEditId?`<div style="font-size:10px;color:#888;margin-top:3px">ℹ️ Updates the profile email (used for display &amp; linking). The sign-in email stays unchanged.</div>`:""}</div>
      ${!userEditId?`<div class="field full"><label>Temp Password <span class="req">*</span></label>
        <input type="text" value="${escapeHtml(userForm.password)}" oninput="window.userForm.password=this.value" placeholder="Min 6 chars"></div>
      <div class="field full" style="background:#FFF8E1;padding:10px;border-radius:8px;border:1px solid #FFE082"><label style="color:#7F6000">🔒 YOUR Admin Password <span class="req">*</span></label>
        <input type="password" value="${escapeHtml(userForm.adminPassword||'')}" oninput="window.userForm.adminPassword=this.value" placeholder="Your own password (to confirm action)">
        <p style="font-size:11px;color:#7F6000;margin-top:6px;line-height:1.5">Required: We sign back in as you after creating the new user, so Firestore lets us save their profile properly.</p></div>`:""}
      <div class="field"><label>Role <span class="req">*</span></label>
        <select onchange="window.userForm.role=this.value;render()">
          <optgroup label="Management">
            <option value="admin"   ${userForm.role==="admin"  ?"selected":""}>👑 Admin — Full access</option>
            <option value="owner"   ${userForm.role==="owner"  ?"selected":""}>🏛 Owner — Identical to Admin</option>
            <option value="support" ${userForm.role==="support"?"selected":""}>🛠 Support — Full except Users</option>
          </optgroup>
          <optgroup label="Operations">
            <option value="hr"       ${userForm.role==="hr"      ?"selected":""}>📋 HR / Manager</option>
            <option value="it"       ${userForm.role==="it"      ?"selected":""}>💻 IT — Dashboard + Work Instructions</option>
            <option value="employee" ${userForm.role==="employee"?"selected":""}>👤 Employee — Own data only</option>
          </optgroup>
          <optgroup label="External">
            <option value="client"   ${userForm.role==="client"  ?"selected":""}>🏢 Client — Project portal only</option>
          </optgroup>
        </select></div>

      ${userForm.role!=="client"?`
      <div class="field"><label>🏙️ Branch / City</label>
        <select onchange="window.userForm.branch=this.value">
          <option value="">— Select Branch —</option>
          ${(state.branches||[]).map(b=>{const n=(b.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===(userForm.branch||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}
        </select>
        ${(state.branches||[]).length===0?`<p style="font-size:11px;color:#C62828;margin-top:4px">No branches yet — add them in the Branches tab first.</p>`:''}</div>
      <div class="field"><label>🏢 Department</label>
        <select onchange="window.userForm.userDept=this.value">
          <option value="">— Select Department —</option>
          ${state.departments.map(d=>{const n=(d.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===(userForm.userDept||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}
        </select></div>
      <div class="field"><label>💼 Job Title</label>
        <input value="${escapeHtml(userForm.jobTitle||'')}" oninput="window.userForm.jobTitle=this.value" placeholder="e.g. Field Technician"></div>
      <div class="field"><label>👔 Reports To (Supervisor)</label>
        <select onchange="window.userForm.supervisorName=this.value">
          <option value="">— None —</option>
          ${state.users.filter(u=>(u.isSupervisor||(u.role||'').toLowerCase()==='admin') && u.name).map(u=>`<option value="${escapeHtml(u.employeeName||u.name)}" ${(u.employeeName||u.name)===(userForm.supervisorName||'')?"selected":""}>${escapeHtml(u.name)}</option>`).join("")}
        </select>
        <p style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4">The supervisor can enter data for their team members.</p></div>
      <div class="field full" style="background:#F3E5F5;border:1px solid #CE93D8;border-radius:8px;padding:10px">
        <label style="color:#6A1B9A;font-size:13px">
          <input type="checkbox" ${userForm.isSupervisor?'checked':''} onchange="window.userForm.isSupervisor=this.checked;render()" style="margin-right:6px">
          👔 This user is a Supervisor
        </label>
        <p style="font-size:11px;color:#4A148C;margin:6px 0 0;line-height:1.5">Supervisors can add Daily Log / Overtime / Travel / Leave entries for the employees who report to them.</p>
      </div>`:''}
      ${userForm.role==="employee"?`<div class="field"><label>Tracked Name <span class="req">*</span></label>
        <input value="${escapeHtml(userForm.employeeName)}" oninput="window.userForm.employeeName=this.value" placeholder="Name in Daily Log lists">
        <p style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4">This name appears in Daily/Overtime/Travel employee dropdowns</p></div>`:`
      <div class="field full" style="background:#E3F2FD;border:1px solid #90CAF9;border-radius:8px;padding:10px">
        <label style="color:#1565C0;font-size:13px">
          <input type="checkbox" ${userForm.isTrackedEmployee?'checked':''} onchange="window.userForm.isTrackedEmployee=this.checked;render()" style="margin-right:6px">
          Also track this ${userForm.role} as an employee
        </label>
        <p style="font-size:11px;color:#0D47A1;margin:6px 0 0;line-height:1.5">By default, ${userForm.role.toUpperCase()}s don't appear in employee tracking lists. Check this only if they also do regular work to be logged.</p>
        ${userForm.isTrackedEmployee?`<div style="margin-top:8px">
          <label style="font-size:12px;color:#0D47A1">Tracked Name</label>
          <input value="${escapeHtml(userForm.employeeName)}" oninput="window.userForm.employeeName=this.value" placeholder="Name to use in tracking">
        </div>`:''}
      </div>`}
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveUser()">${userEditId?"Update":"Create User"}</button>
      ${userEditId?`<button class="btn btn-ghost" onclick="cancelUser()">Cancel</button>`:""}
    </div>
  </div>`;
  if(uv==="team") h += `  <div class="card">
    <div class="card-title">Team Members · ${state.users.length}</div>
    ${state.users.map(u=>{
      const roleCls=u.role==="admin"||u.role==="owner"?"admin":u.role==="hr"||u.role==="support"||u.role==="client"?"hr":u.role==="it"?"hr":"emp";
      const init=(u.name||u.email||"?").charAt(0).toUpperCase();
      const isAdminUser = (u.role||"").toLowerCase()==="admin" || (u.role||"").toLowerCase()==="owner";
      const multiOn = u.allowMultiDevice === true;
      const hasActiveSession = !!u.activeSession;
      return `<div class="user-row" style="flex-wrap:wrap">
        <div class="user-avatar">${u.photoData?`<img src="${u.photoData}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`:init}</div>
        <div class="user-info">
          <div class="name">${escapeHtml(u.name||"(no name)")} <span class="badge badge-${roleCls}">${(u.role||"").toUpperCase()}</span></div>
          <div class="email">${escapeHtml(u.email||"")} ${u.employeeName?`· ${escapeHtml(u.employeeName)}`:""}</div>
          ${hasActiveSession?`<div style="font-size:10px;color:#2E7D32;margin-top:3px">🟢 Active on: ${escapeHtml(u.activeSessionLabel||"a device")}</div>`:`<div style="font-size:10px;color:#999;margin-top:3px">⚪ Not signed in</div>`}
          ${(u.showLastSeen!==false && u.activeSessionAt)?`<div style="font-size:10px;color:#1565C0;margin-top:2px">🕐 Last seen: ${escapeHtml(fmtLastSeen(u.activeSessionAt))}</div>`:''}
        </div>
        ${u.id!==state.profile.uid?`<button class="btn btn-sm btn-secondary" onclick="editUser('${u.id}')">✎</button>
        <button class="btn btn-sm btn-danger" onclick="delUser('${u.id}')">🗑</button>`:`<button class="btn btn-sm btn-secondary" onclick="editUser('${u.id}')">✎</button><span style="font-size:10px;color:var(--muted);margin-left:4px">YOU</span>`}
        <div style="flex-basis:100%;display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid #eee;flex-wrap:wrap">
          ${isAdminUser
            ? `<span style="font-size:11px;color:#6A1B9A;font-weight:600">👑 Admin — multiple devices always allowed</span>`
            : `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
                <input type="checkbox" ${multiOn?"checked":""} onchange="toggleMultiDevice('${u.id}')" style="width:16px;height:16px;cursor:pointer">
                <span style="color:${multiOn?'#2E7D32':'#666'};font-weight:600">📱💻 Allow Multiple Devices</span>
              </label>`}
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
            <input type="checkbox" ${u.showLastSeen!==false?"checked":""} onchange="toggleShowLastSeen('${u.id}')" style="width:16px;height:16px;cursor:pointer">
            <span style="color:${u.showLastSeen!==false?'#1565C0':'#666'};font-weight:600">🕐 Show Last Seen</span>
          </label>
          ${(u.role||"")!=="client"?`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
            <input type="checkbox" ${u.canAssignTasks?"checked":""} onchange="toggleCanAssign('${u.id}')" style="width:16px;height:16px;cursor:pointer">
            <span style="color:${u.canAssignTasks?'#6A1B9A':'#666'};font-weight:600">🎯 Assign Tasks</span>
          </label>`:""}
          ${(u.role||"")==="employee"?`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;user-select:none">
            <input type="checkbox" ${u.canViewReports?"checked":""} onchange="toggleViewReports('${u.id}')" style="width:16px;height:16px;cursor:pointer">
            <span style="color:${u.canViewReports?'#00695C':'#666'};font-weight:600">📊 View Reports</span>
          </label>`:""}
          ${hasActiveSession && !isAdminUser ? `<button class="btn btn-sm" style="background:#FFF3E0;border:1px solid #FB8C00;color:#E65100;font-size:11px;padding:4px 10px" onclick="resetUserSession('${u.id}')">🔓 Reset Session</button>` : ''}
        </div>
      </div>`;
    }).join("")}
  </div>`;
  if(uv==="tags") h += `  <!-- ═══ NAMETAG EMPLOYEES (no auth account) ═══ -->
  <div class="card" style="border-top:4px solid #D4AF37">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div>
        <div class="card-title" style="margin-bottom:2px">👤 Nametag Employees · ${(state.nametagEmployees||[]).length}</div>
        ${EMPLOYEES_DEFAULT.some(n=>!(state.nametagEmployees||[]).map(e=>(e.name||"").toLowerCase()).includes(n.toLowerCase()) && !state.users.map(u=>(u.employeeName||"").toLowerCase()).includes(n.toLowerCase()))?`
          <button class="btn btn-sm" onclick="migrateDefaultEmployees()" style="background:#E3F2FD;border:1px solid #1565C0;color:#1565C0;font-size:11px;margin-top:4px">⬆ Make Default Employees Editable</button>`:""}
        <div style="font-size:12px;color:var(--muted)">Registered in tracking lists only — no login account required</div>
      </div>
    </div>

    <!-- Add/Edit Nametag Form -->
    <div style="background:#FFFBEB;border:1px solid #D4AF37;border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:800;color:#7F6000;margin-bottom:10px">
        ${nametagEditId ? "✎ Edit Nametag Employee" : "➕ Add Nametag Employee"}
      </div>
      <div class="form-grid">
        <div class="field"><label>Employee Name <span class="req">*</span></label>
          <input value="${escapeHtml((nametagForm||{}).name||"")}" oninput="window.nametagForm.name=this.value" placeholder="e.g., Ahmad Khalil, Outsource-1"></div>
        <div class="field"><label>Type <span class="req">*</span></label>
          <select onchange="window.nametagForm.type=this.value;render()">
            <option value="internal" ${(nametagForm||{}).type==="internal"?"selected":""}>🏢 Internal</option>
            <option value="external" ${(nametagForm||{}).type==="external"?"selected":""}>🔶 External / Outsource</option>
          </select>
        </div>
        <div class="field"><label>🏙️ Branch / City</label>
          <select onchange="window.nametagForm.branch=this.value">
            <option value="">— Select Branch —</option>
            ${(state.branches||[]).map(b=>{const n=(b.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===((nametagForm||{}).branch||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}
          </select>
          ${(state.branches||[]).length===0?`<p style="font-size:11px;color:#C62828;margin-top:4px">Add branches in the Branches tab first.</p>`:''}</div>
        <div class="field"><label>🏢 Department</label>
          <select onchange="window.nametagForm.dept=this.value">
            <option value="">— Select Department —</option>
            ${state.departments.map(d=>{const n=(d.name||"").trim();return `<option value="${escapeHtml(n)}" ${n===((nametagForm||{}).dept||"").trim()?"selected":""}>${escapeHtml(n)}</option>`}).join("")}
          </select></div>
      </div>
      <div style="font-size:11px;color:#7F6000;margin-bottom:10px">
        ${(nametagForm||{}).type==="external" ? '🔶 This employee will appear with <strong>[EXT]</strong> orange badge across all reports.' : '🏢 This employee will appear as a regular internal team member.'}
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" style="background:#D4AF37;color:#1B3A6B" onclick="saveNametagEmp()">${nametagEditId?"Update":"Add Employee"}</button>
        ${nametagEditId?`<button class="btn btn-ghost" onclick="cancelNametagEmp()">Cancel</button>`:""}
      </div>
    </div>

    <!-- Nametag Employees List -->
    ${(state.nametagEmployees||[]).length === 0
      ? `<div class="empty">No nametag employees yet. Add external workers or contractors above.</div>`
      : `<div style="display:flex;flex-direction:column;gap:8px">
          ${(state.nametagEmployees||[]).map(e => {
            const isExt = e.type === "external";
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:${isExt ? "linear-gradient(135deg,#FFF3E0 0%,#FFF8E1 100%)" : "#F7FAFC"};border:1px solid ${isExt ? "#FF9800" : "#CBD5E0"};border-radius:8px;gap:10px">
              <div style="display:flex;align-items:center;gap:10px;flex:1">
                <div style="width:36px;height:36px;background:${isExt ? "linear-gradient(135deg,#FF9800 0%,#FFB74D 100%)" : "#1B3A6B"};color:white;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0">
                  ${(e.name||"?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style="font-weight:700;color:#1A202C;font-size:14px">${escapeHtml(e.name||"")}
                    ${isExt ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;background:linear-gradient(135deg,#FF9800,#FFB74D);color:#7F4A00;border-radius:10px;font-size:10px;font-weight:800">EXT</span>` : `<span style="display:inline-block;margin-left:6px;padding:1px 7px;background:#E8F5E9;color:#2F855A;border-radius:10px;font-size:10px;font-weight:700">INTERNAL</span>`}
                  </div>
                  <div style="font-size:11px;color:var(--muted)">${isExt ? "External / Outsource" : "Internal employee"} · Nametag only</div>
                </div>
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-sm btn-secondary" onclick="editNametagEmp('${e.id}')" title="Edit">✎</button>
                <button class="btn btn-sm btn-danger" onclick="delNametagEmp('${e.id}')" title="Delete (Admin)">🗑</button>
              </div>
            </div>`;
          }).join("")}
        </div>`
    }
  </div>`;
  return h;
}

async function saveUser(){
  if(!userForm.name.trim()||!userForm.email.trim())return toast("Name and email required");

  // Self-edit protection: if you're editing your OWN account, keep your admin/owner
  // role so you can never accidentally lock yourself out of the admin panel.
  if(userEditId && userEditId===state.profile.uid){
    const myRole = (state.profile.role||"").toLowerCase();
    if((myRole==="admin"||myRole==="owner") && userForm.role!==state.profile.role){
      userForm.role = state.profile.role;
      toast("Your admin role is kept for safety");
    }
  }

  // Build user data with proper isTrackedEmployee handling
  const role = userForm.role;
  const isEmp = role === "employee";
  // For HR/admin: only include employeeName if explicitly tracked
  const trackedName = isEmp ? (userForm.employeeName||userForm.name) : (userForm.isTrackedEmployee ? userForm.employeeName : "");
  const userData = {
    name:userForm.name,
    email:userForm.email,
    role:role,
    employeeName: trackedName,
    isTrackedEmployee: isEmp ? true : !!userForm.isTrackedEmployee,
    branch: userForm.branch || "",
    userDept: userForm.userDept || "",
    jobTitle: userForm.jobTitle || "",
    supervisorName: userForm.supervisorName || "",
    isSupervisor: !!userForm.isSupervisor,
  };

  if(userEditId){
    // Update existing user profile (not auth account)
    try{
      const{db,doc,setDoc}=window.__fb;
      await setDoc(doc(db,"users",userEditId), userData, {merge:true});
      userForm=null;userEditId=null;toast("Updated ✓");
    }catch(e){console.error(e);toast("Update failed");}
    return;
  }

  // Create new auth user + Firestore profile
  if(!userForm.password||userForm.password.length<6)return toast("Password must be 6+ chars");
  if(!userForm.adminPassword||userForm.adminPassword.length<6)return toast("Enter YOUR (admin) password to confirm");

  try{
    const{auth,createUserWithEmailAndPassword,signInWithEmailAndPassword,db,doc,setDoc}=window.__fb;
    const adminEmail = state.profile.email;
    const adminPassword = userForm.adminPassword;

    // Step 1: Create the new auth user (auto-signs us in as the new user)
    const cred = await createUserWithEmailAndPassword(auth, userForm.email, userForm.password);
    const newUid = cred.user.uid;

    // Step 2: Sign back in as admin (required so Firestore Rules accept the write)
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    // Step 3: Now write the user profile as admin
    await setDoc(doc(db,"users",newUid), userData);

    toast(`✓ User created successfully`);
    userForm=null;
  }catch(e){
    console.error(e);
    let msg="Create failed";
    if(e.code==="auth/email-already-in-use")msg="Email already registered";
    if(e.code==="auth/weak-password")msg="Password too weak (need 6+ chars)";
    if(e.code==="auth/wrong-password"||e.code==="auth/invalid-credential")msg="Wrong admin password";
    toast(msg);
  }
}

function editUser(id){
  window._usersView="add"; window.scrollTo(0,0);
  const u=state.users.find(x=>x.id===id);
  if(u){userForm={name:u.name||"",email:u.email||"",password:"",role:u.role||"employee",employeeName:u.employeeName||"",branch:u.branch||"",userDept:u.userDept||"",jobTitle:u.jobTitle||"",supervisorName:u.supervisorName||"",isSupervisor:!!u.isSupervisor,isTrackedEmployee:!!u.isTrackedEmployee};userEditId=id;render();window.scrollTo(0,0);}
}

async function delUser(id){
  if(!confirm("Delete this user profile? (Note: this only removes the Firestore profile, not the auth account. Delete the auth account from Firebase Console separately.)"))return;
  await fbDelete("users",id);
  toast("Profile deleted");
}

function cancelUser(){userForm=null;userEditId=null;render();}

Object.assign(window,{saveUser,editUser,delUser,cancelUser});

// ── Multi-device permission & session management (Admin) ──
window.toggleMultiDevice = async function(userId){
  if(!isAdmin()) return toast("Admin only");
  const u = state.users.find(x=>x.id===userId);
  if(!u) return;
  const newVal = !(u.allowMultiDevice === true);
  try{
    const {db, doc, updateDoc} = window.__fb;
    await updateDoc(doc(db,"users",userId),{ allowMultiDevice: newVal });
    toast(newVal ? `${u.name||"User"}: multiple devices allowed ✓` : `${u.name||"User"}: single device only ✓`);
  }catch(e){ toast("Error: "+e.message); }
};

window.toggleShowLastSeen = async function(userId){
  if(!isAdmin()) return toast("Admin only");
  const u = state.users.find(x=>x.id===userId);
  if(!u) return;
  const newVal = !(u.showLastSeen !== false);   // default true → toggling first time turns it off
  try{
    const {db, doc, updateDoc} = window.__fb;
    await updateDoc(doc(db,"users",userId),{ showLastSeen: newVal });
    toast(newVal ? `${u.name||"User"}: last seen shown ✓` : `${u.name||"User"}: last seen hidden`);
  }catch(e){ toast("Error: "+e.message); }
};

// ── Profile photo: client-side compression keeps stored size tiny (~15-25 KB) ──
function compressImageToDataURL(file, maxDim, quality){
  return new Promise((resolve, reject)=>{
    if(!file || !/^image\//.test(file.type)){ reject(new Error("Please choose an image file")); return; }
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error("Could not read the file"));
    reader.onload = (e)=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error("Could not load the image"));
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w >= h){ if(w > maxDim){ h = Math.round(h * maxDim / w); w = maxDim; } }
        else { if(h > maxDim){ w = Math.round(w * maxDim / h); h = maxDim; } }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#1B3A6B"; ctx.fillRect(0,0,w,h);   // flatten transparency to navy
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

window.uploadProfilePhoto = async function(input){
  const file = input && input.files && input.files[0];
  if(!file) return;
  if(!state.profile || !state.profile.uid){ toast("Not signed in"); return; }
  if(file.size > 12 * 1024 * 1024){ toast("Image too large (max 12MB)"); input.value=""; return; }
  try{
    toast("Compressing photo…");
    const dataUrl = await compressImageToDataURL(file, 256, 0.72);
    const {db, doc, updateDoc} = window.__fb;
    await updateDoc(doc(db,"users",state.profile.uid), { photoData: dataUrl });
    state.profile.photoData = dataUrl;
    const me = (state.users||[]).find(x=>x.id===state.profile.uid); if(me) me.photoData = dataUrl;
    const kb = Math.round(dataUrl.length * 3 / 4 / 1024);
    toast("Photo updated ✓ (~"+kb+" KB)");
    render();
  }catch(e){ toast("Error: "+(e.message||e)); }
  input.value="";
};

window.removeProfilePhoto = async function(){
  if(!state.profile || !state.profile.uid) return;
  if(!confirm("Remove your profile photo?")) return;
  try{
    const {db, doc, updateDoc} = window.__fb;
    await updateDoc(doc(db,"users",state.profile.uid), { photoData: "" });
    state.profile.photoData = "";
    const me = (state.users||[]).find(x=>x.id===state.profile.uid); if(me) me.photoData = "";
    toast("Photo removed");
    render();
  }catch(e){ toast("Error: "+(e.message||e)); }
};

window.resetUserSession = async function(userId){
  if(!isAdmin()) return toast("Admin only");
  const u = state.users.find(x=>x.id===userId);
  if(!u) return;
  if(!confirm(`Reset active session for ${u.name||"this user"}?\\n\\nThey will be signed out on their current device and can sign in again anywhere.`)) return;
  try{
    const {db, doc, updateDoc} = window.__fb;
    await updateDoc(doc(db,"users",userId),{ activeSession: "" });
    toast("Session reset ✓ — user can now sign in on any device");
  }catch(e){ toast("Error: "+e.message); }
};
Object.defineProperty(window,'userForm',{get:()=>userForm,set:v=>userForm=v});

// ═══════════════════════════════════════════════════════════════════════
//  NAMETAG EMPLOYEES (name-only, no auth account)
//  Admin-only write. Everyone can read via allEmployees().
// ═══════════════════════════════════════════════════════════════════════
async function saveNametagEmp(){
  if(!isAdmin()) return toast("Admin only");
  const name = (nametagForm.name||"").trim();
  if(!name) return toast("Name is required");
  if(name.length < 2) return toast("Name must be at least 2 characters");

  // Check duplicate against both users AND nametags
  const allNames = [
    ...state.users.map(u=>(u.employeeName||u.name||"").toLowerCase()),
    ...(state.nametagEmployees||[]).filter(e=>e.id!==nametagEditId).map(e=>(e.name||"").toLowerCase()),
  ];
  if(allNames.includes(name.toLowerCase())) return toast(`"${name}" already exists`);

  // ── CASCADE RENAME: if editing and name changed, sync across all collections ──
  let oldName = null;
  if(nametagEditId){
    const existing = (state.nametagEmployees||[]).find(e=>e.id===nametagEditId);
    if(existing && existing.name !== name) oldName = existing.name;
  }

  try {
    // If name changed, count affected records and confirm
    if(oldName){
      const affected = {
        daily:    state.daily.filter(r=>r.employee===oldName).length,
        overtime: state.overtime.filter(r=>r.employee===oldName).length,
        travel:   state.travel.filter(r=>r.employee===oldName).length,
        leaves:   state.leaves.filter(r=>r.employee===oldName).length,
      };
      const total = affected.daily + affected.overtime + affected.travel + affected.leaves;
      if(total > 0){
        const msg = `Rename "${oldName}" → "${name}"?\n\nThis will update ${total} record(s):\n` +
          `· Daily Log: ${affected.daily}\n· Overtime: ${affected.overtime}\n` +
          `· Travel: ${affected.travel}\n· Leaves: ${affected.leaves}\n\nThis cannot be undone.`;
        if(!confirm(msg)) return;
      }
    }

    // Save the nametag record first
    await fbSave("nametagEmployees", {
      id: nametagEditId || undefined,
      name,
      type: nametagForm.type || "internal",
      branch: nametagForm.branch || "",
      dept: nametagForm.dept || "",
      addedBy: state.profile.uid,
      addedAt: new Date().toISOString(),
    });

    // Cascade the rename across all data collections
    if(oldName){
      const {db, doc, updateDoc} = window.__fb;
      let synced = 0;
      const collections = [
        ["daily",    state.daily],
        ["overtime", state.overtime],
        ["travel",   state.travel],
        ["leaves",   state.leaves],
      ];
      for(const [colName, rows] of collections){
        for(const r of rows){
          if(r.employee === oldName){
            await updateDoc(doc(db, colName, r.id), { employee: name });
            synced++;
          }
        }
      }
      toast(`✓ Renamed & synced ${synced} record(s): ${oldName} → ${name}`);
    } else {
      toast(nametagEditId ? `Updated: ${name} ✓` : `Added: ${name} ✓`);
    }

    nametagForm = {name:"", type:"internal", branch:"", dept:""};
    nametagEditId = null;
  } catch(e){ console.error(e); toast("Error: "+e.message); }
}

function editNametagEmp(id){
  window._usersView="tags"; window.scrollTo(0,0);
  if(!isAdmin()) return toast("Admin only");
  const e = (state.nametagEmployees||[]).find(x=>x.id===id);
  if(e){ nametagForm = {name: e.name, type: e.type||"internal", branch: e.branch||"", dept: e.dept||""}; nametagEditId=id; render(); window.scrollTo(0,0); }
}

// Migrate hardcoded default employees into editable nametag records
async function migrateDefaultEmployees(){
  if(!isAdmin()) return toast("Admin only");
  const existing = (state.nametagEmployees||[]).map(e=>(e.name||"").trim().toLowerCase());
  const userNames = state.users.map(u=>(u.employeeName||"").trim().toLowerCase()).filter(Boolean);
  const toMigrate = EMPLOYEES_DEFAULT.filter(n => 
    !existing.includes(n.toLowerCase()) && !userNames.includes(n.toLowerCase())
  );
  if(toMigrate.length === 0){
    return toast("All default employees are already editable ✓");
  }
  if(!confirm(`Make ${toMigrate.length} default employee(s) editable?\n\n${toMigrate.join(", ")}\n\nAfter this, you can edit their names with full data sync.`)) return;
  for(const name of toMigrate){
    await fbSave("nametagEmployees", {
      id: undefined,
      name,
      type: "internal",
      addedBy: state.profile.uid,
      addedAt: new Date().toISOString(),
      migratedFromDefault: true,
    });
  }
  toast(`✓ ${toMigrate.length} employee(s) are now editable`);
}
window.migrateDefaultEmployees = migrateDefaultEmployees;

async function delNametagEmp(id){
  if(!isAdmin()) return toast("Admin only");
  const e = (state.nametagEmployees||[]).find(x=>x.id===id);
  if(!e) return;
  // Warn if this employee has records
  const hasRecords = [...state.daily,...state.overtime,...state.travel,...state.leaves]
    .some(r=>r.employee===e.name);
  const msg = hasRecords
    ? `Delete "${e.name}"?\n\n⚠ This employee has existing records. The records will remain but the name will no longer appear in dropdowns.`
    : `Delete "${e.name}" from the tracking list?`;
  if(!confirm(msg)) return;
  const{db,doc,deleteDoc}=window.__fb;
  try {
    await deleteDoc(doc(db,"nametagEmployees",id));
    toast(`Deleted: ${e.name}`);
  } catch(e){ console.error(e); toast("Error: "+e.message); }
}

function cancelNametagEmp(){ nametagForm={name:"",type:"internal",branch:"",dept:""}; nametagEditId=null; render(); }

Object.assign(window,{saveNametagEmp, editNametagEmp, delNametagEmp, cancelNametagEmp});
Object.defineProperty(window,'nametagForm',{get:()=>nametagForm,set:v=>nametagForm=v,configurable:true});
Object.defineProperty(window,'nametagEditId',{get:()=>nametagEditId,set:v=>nametagEditId=v,configurable:true});


// ═══════════════════════════════════════════════════════════════════════
//  DYNAMIC DEPARTMENT HELPERS
// ═══════════════════════════════════════════════════════════════════════
function getDept(name){
  if(!name) return null;
  return state.departments.find(d=>d.name===name) || null;
}
function deptColor(name){
  const d = getDept(name);
  return d ? d.color : "#6B7B8F";
}
function deptBg(name){
  const c = deptColor(name);
  // Convert hex to rgba with 0.12 opacity
  const hex = c.replace('#','');
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  return `rgba(${r},${g},${b},0.12)`;
}
function deptBadgeDyn(name){
  if(!name) return "";
  const color = deptColor(name);
  return `<span style="background:${deptBg(name)};color:${color};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px">${escapeHtml(name)}</span>`;
}

// Get all dept names from state.departments
function deptNames(){
  return state.departments.map(d=>d.name);
}

// ═══════════════════════════════════════════════════════════════════════
//  DEPARTMENTS MANAGEMENT (HR+)
// ═══════════════════════════════════════════════════════════════════════
/* deptForm state hoisted to top (TDZ fix) */
/* deptEditId state hoisted to top (TDZ fix) */

// ═══════════════════════════════════════════════════════════════════════
//  BRANCHES MODULE — Company branches (cities)
// ═══════════════════════════════════════════════════════════════════════
/* branch state hoisted to top (TDZ fix) */

function renderBranches(){
  if(!isHR()) return `<div class="card"><div class="empty">Access denied — HR/Admin only</div></div>`;
  if(!branchForm) branchForm = {name:""};

  // Count employees per branch (users + nametags)
  const stats = (state.branches||[]).map(b=>{
    const empCount = state.users.filter(u=>(u.branch||"")===b.name).length
                   + (state.nametagEmployees||[]).filter(n=>(n.branch||"")===b.name).length;
    const branchNames = new Set([
      ...state.users.filter(u=>(u.branch||"")===b.name).map(u=>u.employeeName||u.name),
      ...(state.nametagEmployees||[]).filter(n=>(n.branch||"")===b.name).map(n=>n.name),
    ].filter(Boolean));
    const dailyCount = state.daily.filter(r=>branchNames.has(r.employee)).length;
    return {...b, empCount, dailyCount};
  });

  return `<div class="card">
    <div class="sec-hdr">${branchEditId?"Edit":"Add"} Branch / City</div>
    <div class="form-grid">
      <div class="field full"><label>Branch Name <span class="req">*</span></label>
        <input value="${escapeHtml(branchForm.name)}" oninput="window.branchForm.name=this.value" placeholder="e.g. Erbil, Baghdad, Basra"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveBranch()">${branchEditId?"Update":"Add Branch"}</button>
      ${branchEditId?`<button class="btn btn-ghost" onclick="cancelBranch()">Cancel</button>`:""}
    </div>
  </div>

  <div class="card">
    <div class="card-title">Branches · ${(state.branches||[]).length}</div>
    ${(state.branches||[]).length===0?`<div class="empty">No branches yet. Add your first city above (e.g. Erbil).</div>`:`
    <div style="display:grid;gap:10px">
      ${stats.map(b=>`
        <div style="border:1px solid var(--line);border-left:5px solid #1565C0;border-radius:10px;padding:12px 14px;background:white">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;color:#1565C0;font-size:15px">🏙️ ${escapeHtml(b.name)}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">
                ${b.empCount} employee${b.empCount===1?'':'s'} · ${b.dailyCount} work entr${b.dailyCount===1?'y':'ies'}
              </div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="editBranch('${b.id}')">✎</button>
            <button class="btn btn-sm btn-danger" onclick="delBranch('${b.id}')">🗑</button>
          </div>
        </div>
      `).join("")}
    </div>`}
  </div>

  <div class="card" style="background:#E3F2FD;border:1px solid #90CAF9">
    <p style="font-size:12px;color:#0D47A1;margin:0 0 10px;line-height:1.6">
      <strong>ℹ️ How branches work:</strong> Each branch is a city (Erbil, Baghdad, Basra…). When you add an employee in the Users tab, you assign them to a branch and a department. Reports can then be filtered by branch, so you can generate a separate monthly report for each city.
    </p>
    ${(state.branches||[]).length>0 && (state.users.some(u=>!u.branch && (u.role||'')!=='client') || (state.nametagEmployees||[]).some(n=>!n.branch))?`
    <div style="border-top:1px solid #90CAF9;padding-top:10px;margin-top:6px">
      <p style="font-size:12px;color:#0D47A1;margin:0 0 8px"><strong>Quick setup:</strong> ${state.users.filter(u=>!u.branch && (u.role||'')!=='client').length + (state.nametagEmployees||[]).filter(n=>!n.branch).length} member(s) have no branch yet. Assign them all to:</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${(state.branches||[]).map(b=>`<button class="btn btn-sm" style="background:#1565C0;color:white;border:none" onclick="bulkAssignBranch('${escapeHtml(b.name)}')">→ ${escapeHtml(b.name)}</button>`).join("")}
      </div>
    </div>`:''}
  </div>`;
}

// Bulk-assign all branch-less users AND nametag employees to a branch (one-time setup helper)
// ═══════════════════════════════════════════════════════════════════════
//  TECHNICAL CLASSIFICATIONS — ACTIONS (Admin only)
// ═══════════════════════════════════════════════════════════════════════
// One-time loader for existing databases (seed only runs on brand-new DBs)
window.seedTechDefaults = async function(){
  if(!isAdmin()) return toast("Admin only");
  if(!confirm("Load the default Work Types, Statuses, and Categories?")) return;
  const {db, doc, setDoc} = window.__fb;
  try{
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
    toast("✓ Default classifications loaded");
  }catch(e){
    toast("Error: "+(e.message||"failed"));
  }
};

window.addTechItem = async function(col, inputId, count){
  if(!isAdmin()) return toast("Admin only");
  const el = document.getElementById(inputId);
  const name = (el?.value||"").trim();
  if(!name) return toast("Enter a value");
  // Prevent duplicates
  const exists = (state[col]||[]).some(x=>(x.name||"").toLowerCase()===name.toLowerCase());
  if(exists) return toast("Already exists");
  const {db, collection, addDoc} = window.__fb;
  await addDoc(collection(db, col), {name, order: count});
  toast("Added ✓");
};

window.delTechItem = async function(col, id){
  if(!isAdmin()) return toast("Admin only");
  if(!confirm("Delete this item?")) return;
  const {db, doc, deleteDoc} = window.__fb;
  await deleteDoc(doc(db, col, id));
  toast("Deleted");
};

window.addTechCategory = async function(count){
  if(!isAdmin()) return toast("Admin only");
  const el = document.getElementById('newCategory');
  const name = (el?.value||"").trim();
  if(!name) return toast("Enter a category name");
  const exists = (state.techCategories||[]).some(c=>(c.name||"").toLowerCase()===name.toLowerCase());
  if(exists) return toast("Category already exists");
  const {db, collection, addDoc} = window.__fb;
  await addDoc(collection(db, "techCategories"), {name, subcategories: [], order: count});
  toast("Category added ✓");
};

window.addSubcategory = async function(catId){
  if(!isAdmin()) return toast("Admin only");
  const el = document.getElementById('newSub_'+catId);
  const sub = (el?.value||"").trim();
  if(!sub) return toast("Enter a subcategory");
  const cat = (state.techCategories||[]).find(c=>c.id===catId);
  if(!cat) return toast("Category not found");
  const subs = [...(cat.subcategories||[])];
  if(subs.some(s=>s.toLowerCase()===sub.toLowerCase())) return toast("Subcategory already exists");
  subs.push(sub);
  const {db, doc, setDoc} = window.__fb;
  await setDoc(doc(db, "techCategories", catId), {name: cat.name, subcategories: subs, order: cat.order||0});
  toast("Subcategory added ✓");
};

window.delSubcategory = async function(catId, subIndex){
  if(!isAdmin()) return toast("Admin only");
  const cat = (state.techCategories||[]).find(c=>c.id===catId);
  if(!cat) return;
  const subs = [...(cat.subcategories||[])];
  subs.splice(subIndex, 1);
  const {db, doc, setDoc} = window.__fb;
  await setDoc(doc(db, "techCategories", catId), {name: cat.name, subcategories: subs, order: cat.order||0});
  toast("Subcategory removed");
};


window.bulkAssignBranch = async function(branchName){
  const userTargets = state.users.filter(u=>!u.branch && (u.role||'')!=='client');
  const tagTargets = (state.nametagEmployees||[]).filter(n=>!n.branch);
  const total = userTargets.length + tagTargets.length;
  if(total===0) return toast("Everyone already has a branch");
  if(!confirm(`Assign ${total} member(s) to ${branchName}?`)) return;
  const {db, doc, setDoc} = window.__fb;
  let done=0;
  for(const u of userTargets){
    try{ await setDoc(doc(db,"users",u.id), {branch:branchName}, {merge:true}); done++; }catch(e){}
  }
  for(const n of tagTargets){
    try{ await setDoc(doc(db,"nametagEmployees",n.id), {branch:branchName}, {merge:true}); done++; }catch(e){}
  }
  toast(`✓ ${done} member(s) assigned to ${branchName}`);
};

async function saveBranch(){
  if(!isHR()) return toast("HR/Admin only");
  const name=(branchForm.name||"").trim();
  if(!name) return toast("Branch name required");
  // Prevent duplicates
  const exists=(state.branches||[]).some(b=>(b.name||"").toLowerCase()===name.toLowerCase() && b.id!==branchEditId);
  if(exists) return toast("Branch already exists");
  await fbSave("branches",{id:branchEditId||undefined, name});
  toast(branchEditId?"Branch updated ✓":"Branch added ✓");
  branchForm=null; branchEditId=null;
}
function editBranch(id){
  const b=(state.branches||[]).find(x=>x.id===id);
  if(b){ branchForm={name:b.name}; branchEditId=id; render(); window.scrollTo(0,0); }
}
async function delBranch(id){
  if(!confirm("Delete this branch? Employees assigned to it will show no branch until reassigned."))return;
  await fbDelete("branches",id);
  toast("Branch deleted");
}
function cancelBranch(){ branchForm=null; branchEditId=null; render(); }
Object.assign(window,{saveBranch,editBranch,delBranch,cancelBranch});
Object.defineProperty(window,'branchForm',{get:()=>branchForm,set:v=>branchForm=v,configurable:true});


function renderDepartments(){
  if(!isHR()) return `<div class="card"><div class="empty">Access denied — HR/Admin only</div></div>`;
  if(!deptForm) deptForm = {name:"", color:"#2E5FA3"};

  // Count usage stats per department
  const stats = state.departments.map(d=>{
    const projCount = state.projects.filter(p=>p.dept===d.name).length;
    const dailyCount = state.daily.filter(r=>r.dept===d.name).length;
    const hours = state.daily.filter(r=>r.dept===d.name).reduce((s,r)=>s+Number(r.duration||0),0);
    return {...d, projCount, dailyCount, hours};
  });

  const presetColors = ["#2E7D32","#E65100","#6A1B9A","#1565C0","#C62828","#00838F","#5D4037","#37474F","#AD1457","#558B2F"];

  const dv = window._deptView || "list";
  let h = _pills('_deptView',[{id:"list",ic:"🏛️",lb:"Departments"},{id:"add",ic:"➕",lb:"Add"}]);
  if(dv==="add")  h += `<div class="card">
    <div class="sec-hdr">${deptEditId?"Edit":"Add"} Department</div>
    <div class="form-grid">
      <div class="field full"><label>Department Name <span class="req">*</span></label>
        <input value="${escapeHtml(deptForm.name)}" oninput="window.deptForm.name=this.value" placeholder="e.g. Maintenance, Training, Logistics"></div>
      <div class="field full"><label>Color</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          ${presetColors.map(c=>`<div onclick="window.deptForm.color='${c}';render()" style="width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:${deptForm.color===c?'3px solid #1B3A6B':'2px solid #ddd'};box-shadow:${deptForm.color===c?'0 0 0 2px white inset':'none'}"></div>`).join("")}
          <input type="color" value="${deptForm.color}" onchange="window.deptForm.color=this.value;render()" style="width:42px;height:42px;border:2px solid var(--line);border-radius:50%;padding:0;cursor:pointer">
        </div>
      </div>
      <div class="field full"><label>Preview</label>
        <div style="display:flex;gap:8px;align-items:center;padding:10px 14px;background:${deptForm.color}1F;border-left:4px solid ${deptForm.color};border-radius:8px">
          <strong style="color:${deptForm.color};font-size:14px">${escapeHtml(deptForm.name||"Department Preview")}</strong>
        </div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveDept()">${deptEditId?"Update":"Add Department"}</button>
      ${deptEditId?`<button class="btn btn-ghost" onclick="cancelDept()">Cancel</button>`:""}
    </div>
  </div>`;
  if(dv==="list") h += `

  <div class="card">
    <div class="card-title">Departments · ${state.departments.length}</div>
    ${state.departments.length===0?`<div class="empty">No departments yet. Add your first one above.</div>`:`
    <div style="display:grid;gap:10px">
      ${stats.map(d=>`
        <div style="border:1px solid var(--line);border-left:5px solid ${d.color};border-radius:10px;padding:12px 14px;background:white">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;color:${d.color};font-size:15px">${escapeHtml(d.name)}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:4px">
                ${d.projCount} project${d.projCount===1?'':'s'} · ${d.dailyCount} entr${d.dailyCount===1?'y':'ies'} · ${fmtHM(d.hours)} hrs
              </div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="editDept('${d.id}')">✎</button>
            <button class="btn btn-sm btn-danger" onclick="delDept('${d.id}')">🗑</button>
          </div>
        </div>
      `).join("")}
    </div>`}
  </div>

  <div class="card" style="background:#FFF8E1;border:1px solid #FFE082">
    <p style="font-size:12px;color:#7F6000;margin:0;line-height:1.6">
      <strong>⚠ Note:</strong> Deleting a department doesn't delete projects assigned to it. They'll show "uncategorized". Reassign projects first if needed.
    </p>
  </div>`;
  return h;
}

async function saveDept(){
  const name = (deptForm.name||"").trim();
  if(!name) return toast("Name required");
  if(!deptEditId && state.departments.find(d=>(d.name||"").trim()===name)) return toast("Department already exists");
  const id = deptEditId || name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30);
  if(!id) return toast("Invalid name");

  // ── Cascade rename if name changed (Admin only) ──
  let oldName = null;
  if(deptEditId){
    const existing = state.departments.find(d=>d.id===deptEditId);
    if(existing && existing.name !== name) oldName = existing.name;
  }
  if(oldName && !isAdmin()) return toast("Only Admin can rename departments");
  if(oldName){
    const affected = state.daily.filter(r=>r.dept===oldName).length
      + state.overtime.filter(r=>r.dept===oldName).length
      + state.travel.filter(r=>r.dept===oldName).length
      + state.projects.filter(p=>p.dept===oldName).length;
    if(affected > 0 && !confirm(`Rename "${oldName}" → "${name}"?\n\nThis will update ${affected} record(s) including projects assigned to this department.\n\nThis cannot be undone.`)) return;
  }

  await fbSave("departments",{id, name, color:deptForm.color});

  if(oldName){
    const synced = await cascadeRenameDepartment(oldName, name);
    toast(`✓ Renamed & synced ${synced} record(s)`);
  } else {
    toast("Saved ✓");
  }
  deptForm = null; deptEditId = null;
}
function editDept(id){
  const d = state.departments.find(x=>x.id===id);
  if(d){ deptForm={...d}; deptEditId=id; render(); window.scrollTo(0,0); }
}
async function delDept(id){
  const d = state.departments.find(x=>x.id===id);
  if(!d) return;
  const usedBy = state.projects.filter(p=>p.dept===d.name).length;
  const msg = usedBy>0 ? `This department has ${usedBy} project(s) assigned. Delete anyway?` : "Delete this department?";
  if(confirm(msg)){
    await fbDelete("departments",id);
    toast("Deleted");
  }
}
function cancelDept(){ deptForm=null; deptEditId=null; render(); }
Object.assign(window, {saveDept, editDept, delDept, cancelDept});
Object.defineProperty(window,'deptForm',{get:()=>deptForm,set:v=>deptForm=v,configurable:true});

// ═══════════════════════════════════════════════════════════════════════
//  WORK INSTRUCTIONS MODULE
//  Categories → Tasks → (Task Name + Google Drive Link + Description)
// ═══════════════════════════════════════════════════════════════════════
/* wiCat state hoisted to top (TDZ fix) */
/* wiTask state hoisted to top (TDZ fix) */
let wiActiveCategory = "";  // filter UI state

