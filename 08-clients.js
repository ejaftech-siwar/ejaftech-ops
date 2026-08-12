function renderClients(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Access denied — Admin only</div></div>`;
  if(!clientForm) clientForm={name:"", linkedUserEmail:"", linkedUserUid:"", projects:[], notes:""};

  const allProjects = state.projects.map(p=>(p.name||"").trim()).filter(Boolean);
  const clientUsers = state.users.filter(u=>(u.role||"").toLowerCase()==="client");

  let h = `<div class="card" style="border-left:4px solid #C9A84C">
    <div class="card-title">${clientEditId ? "✎ Edit Client" : "🏢 Add Client"}</div>
    <div class="form-grid">
      <div class="field"><label>Client / Company Name <span class="req">*</span></label>
        <input value="${escapeHtml(clientForm.name||"")}" oninput="window.clientForm.name=this.value" placeholder="e.g., National Security Co."></div>
      <div class="field"><label>Linked User Account</label>
        <select onchange="window.clientForm.linkedUserUid=this.value">
          <option value="">— No login account —</option>
          ${clientUsers.map(u=>{const sel=(u.id===clientForm.linkedUserUid)||(!clientForm.linkedUserUid&&u.email&&u.email===clientForm.linkedUserEmail);return `<option value="${escapeHtml(u.id)}" ${sel?"selected":""}>${escapeHtml(u.name||u.email||"Unnamed")}${u.email?` (${escapeHtml(u.email)})`:" (no email)"}</option>`;}).join("")}
        </select>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">Create the user first in Users tab with role "Client"</div>
      </div>
    </div>
    <div class="field" style="margin-top:8px"><label>Assigned Projects <span class="req">*</span></label>
      <div style="display:flex;flex-direction:column;gap:5px;max-height:180px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:10px">
        ${allProjects.length===0?'<span style="font-size:12px;color:var(--muted)">No projects yet — add projects first</span>':
          allProjects.map(p=>`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
            <input type="checkbox" ${(clientForm.projects||[]).includes(p)?"checked":""}
              onchange="window.toggleClientProject('${escapeHtml(p).replace(/'/g,"\\'")}')"
              style="width:15px;height:15px;cursor:pointer">
            ${escapeHtml(p)}
          </label>`).join("")}
      </div>
    </div>
    <div class="field" style="margin-top:8px"><label>Notes</label>
      <input value="${escapeHtml(clientForm.notes||"")}" oninput="window.clientForm.notes=this.value" placeholder="optional"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-primary" onclick="saveClient()">${clientEditId?"Update Client":"Add Client"}</button>
      ${clientEditId?`<button class="btn btn-ghost" onclick="cancelClient()">Cancel</button>`:""}
    </div>
  </div>

  <div class="card">
    <div class="filter-row">
      <span class="card-title" style="margin:0">Clients</span>
      <span class="count-pill">${(state.clients||[]).length}</span>
    </div>
    ${(state.clients||[]).length===0
      ? emptyState({icon:"\u{1F464}",title:"No clients yet",
      why:"A client owns projects, receives quotations and invoices, and can be given a portal login to follow their own work.",
      steps:["Add the client name and contact","Link their projects to them","Optionally create a portal account so they can see progress themselves"],
      action:{label:"+ Add the first client", onclick:"clientNew&&clientNew()"},
      hint:"A client typed on a quotation is not registered here \u2014 add them properly once the work is won."})
      : `<div style="display:flex;flex-direction:column;gap:10px">
        ${(state.clients||[]).map(c=>{
          const projList = (c.projects||[]);
          const totalHrs = state.daily.filter(r=>projList.includes(r.project)).reduce((s,r)=>s+Number(r.duration||0),0);
          const estHrs = projList.reduce((s,pn)=>{
            const p = state.projects.find(x=>(x.name||"").trim()===pn);
            return s + Number(p?.estimatedHours||0);
          },0);
          const pct = estHrs>0 ? Math.min(100, Math.round(totalHrs/estHrs*100)) : null;
          return `<div style="border:1px solid var(--line);border-left:4px solid #C9A84C;border-radius:12px;padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
              <div style="flex:1;min-width:200px">
                <div style="font-weight:700;font-size:14px;color:#03308B">🏢 ${escapeHtml(c.name)}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px">
                  ${linkedClientLabel(c)?`👤 ${escapeHtml(linkedClientLabel(c))}`:'<span style="color:#C62828">No login linked</span>'}
                  ${c.notes?` · ${escapeHtml(c.notes)}`:''}
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">
                  ${projList.map(p=>`<span style="background:#E8F0FE;color:#03308B;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600">${escapeHtml(p)}</span>`).join("")}
                </div>
              </div>
              <div style="text-align:right;min-width:120px">
                <div style="font-size:11px;color:var(--muted)">Total Hours</div>
                <div style="font-size:18px;font-weight:700;color:#03308B">${fmtHM(totalHrs)}</div>
                ${pct!==null?`<div style="margin-top:6px">
                  <div style="font-size:10px;color:var(--muted)">Progress: <strong style="color:${pct>=100?'#2E7D32':'#C9A84C'}">${pct}%</strong></div>
                  <div style="height:6px;background:#E2E8F0;border-radius:4px;margin-top:3px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#C9A84C,#03308B);border-radius:4px"></div>
                  </div>
                </div>`:'<div style="font-size:10px;color:#999;margin-top:4px">Set estimated hours in Projects to track %</div>'}
              </div>
            </div>
            ${(()=>{const sl=(state.publicSharesMeta||[]).find(s=>s.clientId===c.id&&!s.revoked);
              return sl?`<div style="margin-top:10px;background:#F0FAF4;border:1px solid #C8E6C9;border-radius:8px;padding:9px 10px">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="font-size:11px;font-weight:700;color:#2E7D32">🔗 Live share link active</span>
                  ${sl.expires?`<span style="font-size:10px;color:#888">expires ${sl.expires}</span>`:""}
                  <span style="flex:1"></span>
                  <button class="btn btn-sm btn-secondary" onclick="copyShareLink('${sl.id}')">📋 Copy</button>
                  <button class="btn btn-sm btn-secondary" onclick="refreshShareNow()">↻ Refresh</button>
                  <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="revokeShareLink('${sl.id}')">Revoke</button>
                </div>
              </div>`
              :`<div style="margin-top:10px"><button class="btn btn-sm" style="background:#E8F5E9;color:#2E7D32;border:1px solid #C8E6C9;font-weight:700" onclick="createShareLink('${c.id}')">🔗 Create live share link</button></div>`;})()}
            <div style="display:flex;gap:5px;margin-top:10px;justify-content:flex-end">
              <button class="btn btn-sm btn-secondary" onclick="editClient('${c.id}')">${ICN.edit} Edit</button>
              <button class="btn btn-sm btn-danger" onclick="delClient('${c.id}')">${ICN.del} Delete</button>
            </div>
          </div>`;
        }).join("")}
      </div>`}
  </div>`;
  return h;
}

window.toggleClientProject = function(projName){
  if(!clientForm.projects) clientForm.projects=[];
  const i = clientForm.projects.indexOf(projName);
  if(i>=0) clientForm.projects.splice(i,1);
  else clientForm.projects.push(projName);
  render();
};

async function saveClient(){
  if(!isAdmin()) return toast("Admin only");
  const name = (clientForm.name||"").trim();
  if(!name) return toast("Client name is required");
  if(!(clientForm.projects||[]).length) return toast("Assign at least 1 project");
  // Resolve linked user (UID-based; legacy email links still honored)
  let linkedUid = clientForm.linkedUserUid || "";
  let linkedEmail = "";
  if(linkedUid){
    const u = state.users.find(x=>x.id===linkedUid);
    if(!u){ linkedUid=""; } else { linkedEmail = u.email||""; }
  } else if(clientForm.linkedUserEmail){
    const u = state.users.find(x=>(x.email||"").toLowerCase()===clientForm.linkedUserEmail.toLowerCase());
    if(u){ linkedUid = u.id; linkedEmail = u.email||""; }
  }
  await fbSave("clients", {
    id: clientEditId||undefined,
    name,
    linkedUserEmail: linkedEmail,
    linkedUserUid: linkedUid,
    projects: clientForm.projects||[],
    notes: clientForm.notes||"",
    updatedAt: new Date().toISOString(),
  });
  toast(clientEditId?"Client updated ✓":"Client added ✓");
  clientForm=null; clientEditId=null;
}
function editClient(id){
  const c=(state.clients||[]).find(x=>x.id===id);
  if(c){ clientForm={name:c.name,linkedUserEmail:c.linkedUserEmail||"",linkedUserUid:c.linkedUserUid||"",projects:[...(c.projects||[])],notes:c.notes||""}; clientEditId=id; render(); window.scrollTo(0,0); }
}
async function delClient(id){
  if(!await uiConfirm("Delete this client? Their requests will remain."))return;
  await fbDelete("clients",id);
  toast("Client deleted");
}
function cancelClient(){clientForm=null;clientEditId=null;render();}
Object.assign(window,{saveClient,editClient,delClient,cancelClient});
Object.defineProperty(window,'clientForm',{get:()=>clientForm,set:v=>clientForm=v,configurable:true});

// ═══════════════════════════════════════════════════════════════════════
//  CLIENT PORTAL — "My Project" tab for client role
// ═══════════════════════════════════════════════════════════════════════
function renderClientPortal(){
  const c = getMyClientRecord();
  if(!c) return `<div class="card"><div class="empty">⚠ Your account is not linked to any client yet.<br>Please contact the administrator.</div></div>`;
  const perms = getClientPermissions(c.id);
  if(!window._cpf) window._cpf = {project:"",area:"",site:"",device:"",serial:"",model:""};
  const F = window._cpf;

  const myProjects = c.projects||[];
  // Devices belonging to the client's projects
  const myDevicesAll = (state.devices||[]).filter(d=>myProjects.includes(d.project));
  // Apply portal filters (only when the admin enabled them)
  const fActive = perms.portalFilters && (F.project||F.area||F.site||F.device||F.serial||F.model);
  const devMatch = d =>
    (!F.project || d.project===F.project) &&
    (!F.area    || d.area===F.area) &&
    (!F.site    || d.site===F.site) &&
    (!F.device  || (d.deviceName||"")===F.device) &&
    (!F.serial  || (d.serialNumber||"").toLowerCase().includes(F.serial.toLowerCase())) &&
    (!F.model   || (d.model||"").toLowerCase().includes(F.model.toLowerCase()));
  const myDevices = fActive ? myDevicesAll.filter(devMatch) : myDevicesAll;

  const myDaily = state.daily
    .filter(r=>myProjects.includes(r.project))
    .filter(r=>inActivePeriod(r.date))
    .filter(r=>!fActive || (
      (!F.project || r.project===F.project) &&
      (!F.area    || (r.area||"")===F.area) &&
      (!F.site    || (r.site||"")===F.site) &&
      (!F.serial  || (r.deviceSerial||"").toLowerCase().includes(F.serial.toLowerCase()))
    ))
    .sort((a,b)=>{
      const an=Number(a.entryNo||0), bn=Number(b.entryNo||0);
      if(an&&bn)return an-bn;
      return (a.date||"").localeCompare(b.date||"");
    });

  const totalHrs = myDaily.reduce((s,r)=>s+Number(r.duration||0),0);
  const estHrs = myProjects.reduce((s,pn)=>{
    const p = state.projects.find(x=>(x.name||"").trim()===pn);
    return s + Number(p?.estimatedHours||0);
  },0);
  const pct = estHrs>0 ? Math.min(100,Math.round(totalHrs/estHrs*100)) : null;

  // Per-project breakdown
  const perProject = myProjects.map(pn=>{
    const rows = state.daily.filter(r=>r.project===pn && inActivePeriod(r.date));
    const hrs = rows.reduce((s,r)=>s+Number(r.duration||0),0);
    const p = state.projects.find(x=>(x.name||"").trim()===pn);
    const est = Number(p?.estimatedHours||0);
    const ppct = est>0?Math.min(100,Math.round(hrs/est*100)):null;
    return {name:pn, hrs, est, pct:ppct, count:rows.length, status:p?.status||""};
  });

  return `<div class="card" style="background:linear-gradient(135deg,#03308B,#1a4db5);border:none;color:white">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:11px;opacity:0.6;text-transform:uppercase;letter-spacing:1px">Client Portal</div>
        <div style="font-size:18px;font-weight:700;color:#C9A84C;margin-top:2px">🏢 ${escapeHtml(c.name)}</div>
        <div style="font-size:12px;opacity:0.7;margin-top:2px">${myProjects.length} project(s) · ${myDaily.length} work entries</div>
        ${perms.reportsExport?`<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="exportClientPDF()" style="background:#C9A84C;color:#03308B;border:none;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📄 PDF Report</button>
          <button onclick="exportClientExcel()" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(201,168,76,0.6);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📊 Excel Report</button>
        </div>`:""}
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;opacity:0.6">Total Hours Delivered</div>
        <div style="font-size:28px;font-weight:700;color:#C9A84C">${fmtHM(totalHrs)}</div>
        ${pct!==null?`<div style="font-size:13px;font-weight:700;margin-top:2px">${pct}% Complete</div>`:""}
      </div>
    </div>
    ${pct!==null?`<div style="height:8px;background:rgba(255,255,255,0.15);border-radius:4px;margin-top:14px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#C9A84C,#f0d080);border-radius:4px"></div>
    </div>`:""}
  </div>

  <div class="card">
    <div class="card-title">📊 Project Progress</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${perProject.map(p=>`<div style="border:1px solid var(--line);border-radius:8px;padding:12px">
        ${p.status?`<span style="float:right;background:#F0F4FF;color:#03308B;border:1px solid #C9A84C;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:700">${escapeHtml(p.status)}</span>`:""}
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div style="font-weight:700;color:#03308B;font-size:14px">${escapeHtml(p.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${fmtHM(p.hrs)}${p.est?` / ${p.est}h est.`:""} · ${p.count} entries</div>
        </div>
        ${p.pct!==null?`<div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <div style="flex:1;height:7px;background:#E2E8F0;border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${p.pct}%;background:linear-gradient(90deg,${p.pct>=100?'#2E7D32,#66BB6A':'#C9A84C,#03308B'});border-radius:4px"></div>
          </div>
          <span style="font-size:12px;font-weight:700;color:${p.pct>=100?'#2E7D32':'#03308B'}">${p.pct}%</span>
        </div>`:`<div style="font-size:11px;color:#999;margin-top:4px;font-style:italic">Progress tracking not configured</div>`}
      </div>`).join("")}
    </div>
  </div>

  ${perms.portalFilters?`
  <div class="card" style="border-left:4px solid #6A1B9A">
    <div class="card-title" style="margin-bottom:8px">🔎 Filters</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <select onchange="window._cpf.project=this.value;window._cpf.area='';window._cpf.site='';render()" style="flex:1;min-width:130px;padding:7px 10px;border:1px solid #6A1B9A;border-radius:8px;font-size:12px">
        <option value="">📁 All Projects</option>
        ${myProjects.map(p=>`<option value="${escapeHtml(p)}" ${p===F.project?"selected":""}>${escapeHtml(p)}</option>`).join("")}
      </select>
      <input value="${escapeHtml((state.projects||[]).find(p=>p.name===F.project)?.code||"")}" disabled placeholder="🔌 Project Code" style="flex:1;min-width:110px;padding:7px 10px;border:1px solid #ddd;border-radius:8px;font-size:12px;background:#F5F7FA">
      <select onchange="window._cpf.area=this.value;window._cpf.site='';render()" ${!F.project?"disabled":""} style="flex:1;min-width:110px;padding:7px 10px;border:1px solid #6A1B9A;border-radius:8px;font-size:12px">
        <option value="">🗺️ All Areas</option>
        ${(((state.projects||[]).find(p=>p.name===F.project)||{}).areas||[]).map(a=>`<option value="${escapeHtml(a.name)}" ${a.name===F.area?"selected":""}>${escapeHtml(a.name)}</option>`).join("")}
      </select>
      <select onchange="window._cpf.site=this.value;render()" ${!F.area?"disabled":""} style="flex:1;min-width:110px;padding:7px 10px;border:1px solid #6A1B9A;border-radius:8px;font-size:12px">
        <option value="">📍 All Sites</option>
        ${(((((state.projects||[]).find(p=>p.name===F.project)||{}).areas||[]).find(a=>a.name===F.area)||{}).sites||[]).map(s=>`<option value="${escapeHtml(s.name)}" ${s.name===F.site?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}
      </select>
      <select onchange="window._cpf.device=this.value;render()" style="flex:1;min-width:120px;padding:7px 10px;border:1px solid #6A1B9A;border-radius:8px;font-size:12px">
        <option value="">📟 All Devices</option>
        ${[...new Set(myDevicesAll.map(d=>d.deviceName).filter(Boolean))].sort().map(n=>`<option value="${escapeHtml(n)}" ${n===F.device?"selected":""}>${escapeHtml(n)}</option>`).join("")}
      </select>
      <input value="${escapeHtml(F.serial)}" oninput="window._cpf.serial=this.value" onchange="render()" placeholder="🔢 Serial Number" style="flex:1;min-width:120px;padding:7px 10px;border:1px solid #6A1B9A;border-radius:8px;font-size:12px">
      <input value="${escapeHtml(F.model)}" oninput="window._cpf.model=this.value" onchange="render()" placeholder="📱 Model" style="flex:1;min-width:110px;padding:7px 10px;border:1px solid #6A1B9A;border-radius:8px;font-size:12px">
      ${fActive?`<button onclick="window._cpf={project:'',area:'',site:'',device:'',serial:'',model:''};render()" style="background:#C62828;color:white;border:none;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">${ICN.x} Clear</button>`:""}
    </div>
  </div>`:""}

  <div class="card">
    <div class="filter-row">
      <span class="card-title" style="margin:0">📋 Work Log — Your Projects</span>
      <span class="count-pill">${myDaily.length}</span>
    </div>
    ${myDaily.length===0?`<div class="empty">No work entries yet for your projects</div>`:
    `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th style="width:44px;text-align:center">#</th><th>Date</th><th>Project</th><th>Hours</th><th>Resolution</th></tr></thead>
      <tbody>${myDaily.map(r=>`<tr>
        <td style="text-align:center;font-weight:700;color:#03308B;background:#f0f4ff">${r.entryNo?formatEntryNo(r.entryNo):'—'}</td>
        <td>${fmtDate(r.date)}</td>
        <td><strong>${escapeHtml(r.project||"")}</strong></td>
        <td style="color:#2E7D32;font-weight:700">${fmtHM(r.duration)}</td>
        <td style="max-width:280px">
          ${r.resolutionText?`<div style="font-size:12px;color:#444;line-height:1.5">${escapeHtml(r.resolutionText)}</div>`:'<span style="color:#bbb">—</span>'}
          ${(r.resolutionImages||[]).length?`<div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">
            ${r.resolutionImages.map((img,i)=>{const src=img.data||img;return `<img src="${src}" onclick="window.open(this.src,'_blank')" style="width:44px;height:44px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid #ddd">`;}).join("")}
          </div>`:""}
        </td>
      </tr>`).join("")}</tbody>
    </table></div>`}
  </div>

  ${(perms.projectDetails||perms.deviceEditSuggest)?`
  <div class="card">
    <div class="filter-row">
      <span class="card-title" style="margin:0">📟 My Devices</span>
      <span class="count-pill">${myDevices.length}</span>
    </div>
    ${myDevices.length===0?`<div class="empty">No devices${fActive?" match your filters":" registered for your projects yet"}</div>`:
    `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Device</th><th>Serial</th><th>Model</th><th>Site</th><th>Status</th>${perms.deviceEditSuggest?`<th></th>`:""}</tr></thead>
      <tbody>${myDevices.map(d=>{
        const pending=(state.deviceEditSuggestions||[]).some(s=>s.deviceId===d.id && s.status==="pending" && s.clientId===c.id);
        return `<tr>
        <td><strong>${escapeHtml(d.deviceName||"—")}</strong><div style="font-size:10px;color:#888">${escapeHtml(d.project||"")}${d.area?" · "+escapeHtml(d.area):""}</div></td>
        <td>${escapeHtml(d.serialNumber||"—")}</td>
        <td>${escapeHtml(d.model||"—")}</td>
        <td>${escapeHtml(d.site||"—")}</td>
        <td>${deviceStatusBadge(d.status)}</td>
        ${perms.deviceEditSuggest?`<td style="text-align:right">${pending
          ?`<span style="font-size:10px;color:#E65100;font-weight:700">⏳ Pending review</span>`
          :`<button onclick="openDeviceSuggest('${d.id}')" style="background:#03308B;color:#C9A84C;border:none;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">✏️ Suggest edit</button>`}</td>`:""}
      </tr>`;}).join("")}</tbody>
    </table></div>`}
  </div>

  ${window._devSuggestFor?renderDeviceSuggestForm(c):""}
  `:""}`;
}

// ── Client device-edit suggestion form (inline card) ──
window.openDeviceSuggest = function(deviceId){
  const d=(state.devices||[]).find(x=>x.id===deviceId);
  if(!d) return;
  window._devSuggestFor = {deviceId, deviceName:d.deviceName||"", ipAddress:d.ipAddress||"", model:d.model||"", vendor:d.vendor||"", status:d.status||"Active", note:""};
  render(); setTimeout(()=>{const el=document.getElementById("devSuggestCard");if(el)el.scrollIntoView({behavior:"smooth"});},50);
};
function renderDeviceSuggestForm(c){
  const s = window._devSuggestFor;
  const d = (state.devices||[]).find(x=>x.id===s.deviceId);
  if(!d) return "";
  return `<div class="card" id="devSuggestCard" style="border-left:4px solid #E65100">
    <div class="card-title">✏️ Suggest Edit — ${escapeHtml(d.deviceName||d.serialNumber||"Device")}</div>
    <p style="font-size:11px;color:var(--muted);margin-bottom:10px">Your changes are sent as a <strong>suggestion</strong> for the EJAF team to review — nothing is changed until they approve it.</p>
    <div class="form-grid">
      <div class="field"><label>Device Name</label><input value="${escapeHtml(s.deviceName)}" oninput="window._devSuggestFor.deviceName=this.value"></div>
      <div class="field"><label>IP Address</label><input value="${escapeHtml(s.ipAddress)}" oninput="window._devSuggestFor.ipAddress=this.value"></div>
      <div class="field"><label>Model</label><input value="${escapeHtml(s.model)}" oninput="window._devSuggestFor.model=this.value"></div>
      <div class="field"><label>Vendor</label><input value="${escapeHtml(s.vendor)}" oninput="window._devSuggestFor.vendor=this.value"></div>
      <div class="field"><label>Status</label>
        <select onchange="window._devSuggestFor.status=this.value">
          ${["Active","Inactive","Maintenance","Faulty","Spare","Retired"].map(st=>`<option ${st===s.status?"selected":""}>${st}</option>`).join("")}
        </select></div>
      <div class="field full"><label>Reason / Note</label><textarea rows="2" oninput="window._devSuggestFor.note=this.value" placeholder="Why this change?">${escapeHtml(s.note)}</textarea></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn btn-primary" onclick="submitDeviceSuggestion()">📨 Send suggestion</button>
      <button class="btn" style="background:#888;color:white" onclick="window._devSuggestFor=null;render()">Cancel</button>
    </div>
  </div>`;
}
window.submitDeviceSuggestion = async function(){
  const c=getMyClientRecord(); if(!c) return;
  const s=window._devSuggestFor; if(!s) return;
  const d=(state.devices||[]).find(x=>x.id===s.deviceId); if(!d) return;
  // Only keep fields that actually changed
  const changes={};
  [["deviceName","Device Name"],["ipAddress","IP Address"],["model","Model"],["vendor","Vendor"],["status","Status"]].forEach(([k])=>{
    if((s[k]||"")!==(d[k]||"")) changes[k]={from:d[k]||"", to:s[k]||""};
  });
  if(Object.keys(changes).length===0) return toast("No changes made");
  await fbSave("deviceEditSuggestions",{
    id: undefined,
    deviceId: d.id,
    deviceSerial: d.serialNumber||"",
    deviceLabel: d.deviceName||d.model||d.serialNumber||"Device",
    project: d.project||"",
    clientId: c.id,
    clientName: c.name,
    changes,
    note: s.note||"",
    status: "pending",
    createdAt: new Date().toISOString(),
    createdBy: state.profile.uid,
  });
  window._devSuggestFor=null;
  toast("Suggestion sent ✓ — the team will review it");
  render();
};

// ── ADMIN: review client device-edit suggestions ──
function renderDeviceSuggestionsAdmin(){
  const pending=(state.deviceEditSuggestions||[]).filter(s=>s.status==="pending")
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  if(pending.length===0) return "";
  return `<div class="card" style="border-left:4px solid #E65100">
    <div class="filter-row">
      <span class="card-title" style="margin:0">✏️ Device Edit Suggestions</span>
      <span style="background:#E65100;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">${pending.length} PENDING</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${pending.map(s=>`<div style="border:1px solid #FFE0B2;background:#FFFDF7;border-radius:8px;padding:12px">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:200px">
            <div style="font-weight:700;font-size:13px;color:#1A202C">📟 ${escapeHtml(s.deviceLabel||"Device")} <span style="font-weight:400;color:#888;font-size:11px">${s.deviceSerial?("SN: "+escapeHtml(s.deviceSerial)):""}</span></div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">🏢 ${escapeHtml(s.clientName||"")} · 📁 ${escapeHtml(s.project||"")} · ${fmtDate((s.createdAt||"").slice(0,10))}</div>
            <table style="font-size:11px;margin-top:8px;border-collapse:collapse">
              ${Object.entries(s.changes||{}).map(([k,ch])=>`<tr>
                <td style="padding:3px 10px 3px 0;color:#555;font-weight:600">${escapeHtml(prettyStatus(k))}</td>
                <td style="padding:3px 8px;color:#C62828;text-decoration:line-through">${escapeHtml(ch.from||"—")}</td>
                <td style="padding:3px 4px;color:#888">→</td>
                <td style="padding:3px 8px;color:#2E7D32;font-weight:700">${escapeHtml(ch.to||"—")}</td>
              </tr>`).join("")}
            </table>
            ${s.note?`<div style="font-size:11px;color:#7F6000;margin-top:6px;font-style:italic">💬 ${escapeHtml(s.note)}</div>`:""}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn-sm" style="background:#2E7D32;color:white;border:none;font-weight:700" onclick="approveDeviceSuggestion('${s.id}')">✓ Approve</button>
            <button class="btn btn-sm" style="background:#C62828;color:white;border:none;font-weight:700" onclick="rejectDeviceSuggestion('${s.id}')">${ICN.x} Reject</button>
          </div>
        </div>
      </div>`).join("")}
    </div>
  </div>`;
}
window.approveDeviceSuggestion = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const s=(state.deviceEditSuggestions||[]).find(x=>x.id===id); if(!s) return;
  const d=(state.devices||[]).find(x=>x.id===s.deviceId);
  if(!d){ toast("Device no longer exists"); return; }
  const applied={}; Object.entries(s.changes||{}).forEach(([k,ch])=>{applied[k]=ch.to||"";});
  await fbSave("devices",{...d, ...applied, updatedAt:new Date().toISOString()});
  await fbSave("deviceEditSuggestions",{...s, id, status:"approved", reviewedAt:new Date().toISOString(), reviewedBy:state.profile.uid});
  saveToast("Suggestion approved — device updated ✓");
};
window.rejectDeviceSuggestion = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const s=(state.deviceEditSuggestions||[]).find(x=>x.id===id); if(!s) return;
  await fbSave("deviceEditSuggestions",{...s, id, status:"rejected", reviewedAt:new Date().toISOString(), reviewedBy:state.profile.uid});
  toast("Suggestion rejected");
};

// ── CLIENT REPORTS (PDF / Excel) — content controlled by the admin ──
function clientReportData(){
  const c=getMyClientRecord(); if(!c) return null;
  const perms=getClientPermissions(c.id);
  const myProjects=c.projects||[];
  const F=window._cpf||{project:"",area:"",site:"",device:"",serial:"",model:""};
  const fActive=perms.portalFilters&&(F.project||F.area||F.site||F.device||F.serial||F.model);
  const daily=state.daily
    .filter(r=>myProjects.includes(r.project))
    .filter(r=>inActivePeriod(r.date))
    .filter(r=>!fActive||((!F.project||r.project===F.project)&&(!F.area||(r.area||"")===F.area)&&(!F.site||(r.site||"")===F.site)&&(!F.serial||(r.deviceSerial||"").toLowerCase().includes(F.serial.toLowerCase()))))
    .sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const devices=(state.devices||[]).filter(d=>myProjects.includes(d.project))
    .filter(d=>!fActive||((!F.project||d.project===F.project)&&(!F.area||d.area===F.area)&&(!F.site||d.site===F.site)&&(!F.device||(d.deviceName||"")===F.device)&&(!F.serial||(d.serialNumber||"").toLowerCase().includes(F.serial.toLowerCase()))&&(!F.model||(d.model||"").toLowerCase().includes(F.model.toLowerCase()))));
  const requests=(state.clientRequests||[]).filter(r=>r.clientId===c.id)
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  const totalHrs=daily.reduce((s,r)=>s+Number(r.duration||0),0);
  return {c,perms,myProjects,daily,devices,requests,totalHrs};
}
window.exportClientPDF = async function(){
  const D=clientReportData(); if(!D) return toast("Not linked to a client");
  const {c,perms,myProjects,daily,devices,requests,totalHrs}=D;
  if(!perms.reportsExport) return toast("Reports not enabled for your account");
  let n=1, body=`
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 In the print dialog, choose <strong>"Save as PDF"</strong>
      <br><br><button onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888">Close</button>
    </div>`;
  if(perms.repSummary){
    body+=`<div class="ksec"><span class="kbad">0${n++}</span><h3>Summary — ${escapeHtml(c.name)}</h3></div>
    <div class="kr">
      <div class="kc kb"><div class="kl">Projects</div><div class="kv">${myProjects.length}</div><div class="ks">assigned</div></div>
      <div class="kc ko"><div class="kl">Hours Delivered</div><div class="kv">${fmtHM(totalHrs)}</div><div class="ks">in period</div></div>
      <div class="kc kg"><div class="kl">Work Entries</div><div class="kv">${daily.length}</div><div class="ks">entries</div></div>
    </div>`;
  }
  if(perms.repWorkLog){
    body+=`<div class="ksec"><span class="kbad">0${n++}</span><h3>Work Log (${daily.length})</h3></div>
    <table><thead><tr><th>#</th><th>Date</th><th>Project</th><th>Hours</th><th>Resolution</th></tr></thead>
    <tbody>${daily.map(r=>`<tr><td>${r.entryNo?formatEntryNo(r.entryNo):"—"}</td><td>${fmtDate(r.date)}</td><td>${escapeHtml(r.project||"")}</td><td>${fmtHM(r.duration)}</td><td>${escapeHtml((r.resolutionText||"").slice(0,140))}</td></tr>`).join("")}</tbody></table>`;
  }
  if(perms.repDevices){
    body+=`<div class="ksec"><span class="kbad">0${n++}</span><h3>Devices (${devices.length})</h3></div>
    <table><thead><tr><th>Device</th><th>Serial</th><th>Model</th><th>Site</th><th>Status</th></tr></thead>
    <tbody>${devices.map(d=>`<tr><td>${escapeHtml(d.deviceName||"—")}</td><td>${escapeHtml(d.serialNumber||"—")}</td><td>${escapeHtml(d.model||"—")}</td><td>${escapeHtml(d.site||"—")}</td><td>${deviceStatusBadge(d.status)}</td></tr>`).join("")}</tbody></table>`;
  }
  if(perms.repRequests){
    body+=`<div class="ksec"><span class="kbad">0${n++}</span><h3>Requests (${requests.length})</h3></div>
    <table><thead><tr><th>Date</th><th>Title</th><th>Project</th><th>Status</th></tr></thead>
    <tbody>${requests.map(r=>`<tr><td>${fmtDate((r.createdAt||"").slice(0,10))}</td><td>${escapeHtml(r.title||"")}</td><td>${escapeHtml(r.project||"")}</td><td>${escapeHtml(prettyStatus(r.status))}</td></tr>`).join("")}</tbody></table>`;
  }
  body+=`<script>setTimeout(()=>window.print(),500)<\/script>`;
  await openReportPDF("CLIENT_REPORT", getPeriod(), body);
  toast("PDF report ready!");
};
window.exportClientExcel = function(){
  if(typeof XLSX==="undefined") return toast("Spreadsheet engine not loaded \u2014 reconnect and try again");
  const D=clientReportData(); if(!D) return toast("Not linked to a client");
  const {c,perms,myProjects,daily,devices,requests,totalHrs}=D;
  if(!perms.reportsExport) return toast("Reports not enabled for your account");
  const NAVY="03308B", GOLD="C9A84C", WHITE="FFFFFF";
  const hd={font:{bold:true,sz:10,color:{rgb:WHITE}},fill:{fgColor:{rgb:NAVY}}};
  const setC=(ws,a,v,s)=>{ws[a]={v:v,t:typeof v==='number'?'n':'s'};if(s)ws[a].s=s;};
  const colL=(x)=>String.fromCharCode(65+x);
  const wb=XLSX.utils.book_new();
  if(perms.repSummary){
    const ws={};
    setC(ws,'A1',`EJAF  •  CLIENT REPORT  —  ${c.name}  —  ${getPeriod()}`,{font:{bold:true,sz:14,color:{rgb:GOLD}},fill:{fgColor:{rgb:NAVY}}});
    ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:3}}];
    [["Projects",myProjects.length],["Hours Delivered",fmtHM(totalHrs)],["Work Entries",daily.length],["Devices",devices.length]].forEach((p,i)=>{setC(ws,`A${i+3}`,p[0],hd);setC(ws,`B${i+3}`,p[1]);});
    ws['!ref']='A1:D7'; ws['!cols']=[{wch:20},{wch:18},{wch:14},{wch:14}]; ws['!rows']=[{hpt:24}];
    XLSX.utils.book_append_sheet(wb,ws,"Summary");
  }
  if(perms.repWorkLog){
    const ws={}; const cols=["#","Date","Project","Hours","Resolution"];
    cols.forEach((cl,i)=>setC(ws,`${colL(i)}1`,cl,hd));
    daily.forEach((r,ri)=>{[r.entryNo?formatEntryNo(r.entryNo):"—",fmtDate(r.date),r.project||"",fmtHM(r.duration),(r.resolutionText||"").slice(0,180)].forEach((v,ci)=>setC(ws,`${colL(ci)}${ri+2}`,v));});
    ws['!ref']=`A1:E${daily.length+1}`; ws['!cols']=[{wch:8},{wch:12},{wch:22},{wch:9},{wch:50}];
    XLSX.utils.book_append_sheet(wb,ws,"Work Log");
  }
  if(perms.repDevices){
    const ws={}; const cols=["Device","Serial","Model","Site","Status"];
    cols.forEach((cl,i)=>setC(ws,`${colL(i)}1`,cl,hd));
    devices.forEach((d,ri)=>{[d.deviceName||"",d.serialNumber||"",d.model||"",d.site||"",d.status||""].forEach((v,ci)=>setC(ws,`${colL(ci)}${ri+2}`,v));});
    ws['!ref']=`A1:E${devices.length+1}`; ws['!cols']=[{wch:20},{wch:16},{wch:16},{wch:16},{wch:12}];
    XLSX.utils.book_append_sheet(wb,ws,"Devices");
  }
  if(perms.repRequests){
    const ws={}; const cols=["Date","Title","Project","Status"];
    cols.forEach((cl,i)=>setC(ws,`${colL(i)}1`,cl,hd));
    requests.forEach((r,ri)=>{[fmtDate((r.createdAt||"").slice(0,10)),r.title||"",r.project||"",prettyStatus(r.status)].forEach((v,ci)=>setC(ws,`${colL(ci)}${ri+2}`,v));});
    ws['!ref']=`A1:D${requests.length+1}`; ws['!cols']=[{wch:12},{wch:34},{wch:20},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,"Requests");
  }
  if(wb.SheetNames.length===0) return toast("Nothing enabled for your report — ask the admin");
  XLSX.writeFile(wb,`Client_Report_${c.name.replace(/[^a-z0-9]/gi,"_")}_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast("Excel report downloaded ✓");
};

// ═══════════════════════════════════════════════════════════════════════
//  REQUESTS MODULE — Client task requests with status workflow
// ═══════════════════════════════════════════════════════════════════════
/* request state hoisted to top (TDZ fix) */

// ═══════════════════════════════════════════════════════════════════════
//  TASK ASSIGNMENT WORKFLOW + IN-APP NOTIFICATIONS (bell 🔔)
//  Assign from client requests or manually → employee confirms → assigner notified.
// ═══════════════════════════════════════════════════════════════════════

// Who may assign tasks: admins, plus anyone the admin granted via Users tab.

// ═══════════════════════════════════════════════════════════════════════
//  LIVE CLIENT SHARE LINKS (no-login, read-only)
//  Each link = one doc in publicShares/{token} holding a CURATED snapshot
//  (project progress, counts, recent activity titles). The public page can
//  read ONLY that doc — internal collections stay fully protected.
//  Staff sessions refresh active snapshots automatically (debounced) so the
//  client view stays live.
// ═══════════════════════════════════════════════════════════════════════
function _shareToken(){
  const a=new Uint8Array(24); crypto.getRandomValues(a);
  return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");
}
function _shareUrl(t){ return location.origin+location.pathname+"?share="+t; }

function _buildSharePayload(client){
  const projList=client.projects||[];
  const projects=projList.map(pn=>{
    const p=(state.projects||[]).find(x=>(x.name||"").trim()===pn)||{};
    const entries=(state.daily||[]).filter(r=>(r.project||"").trim()===pn);
    const hours=entries.reduce((s,r)=>s+Number(r.duration||0),0);
    const est=Number(p.estimatedHours||0);
    const devices=(state.devices||[]).filter(d=>(d.project||"").trim()===pn).length;
    let pmDone=0;
    (state.pmSchedules||[]).filter(s=>(s.project||"").trim()===pn).forEach(s=>{
      pmDone+=(s.history||[]).filter(x=>!x.initial).length;
    });
    const reqs=(state.clientRequests||[]).filter(r=>r.clientId===client.id&&(!r.project||(r.project||"").trim()===pn));
    const openReq=reqs.filter(r=>!["done","Resolved","Closed","closed"].includes(r.status||"new")).length;
    // recent activity: request status changes + PM completions (titles only — no internal notes)
    const recent=[
      ...reqs.slice(-6).map(r=>({date:r.createdAt||"",text:"Request: "+(r.title||"—"),status:r.status||"new"})),
      ...(state.pmSchedules||[]).filter(s=>(s.project||"").trim()===pn).flatMap(s=>(s.history||[]).filter(x=>!x.initial).slice(-3).map(x=>({date:x.date,text:"Preventive maintenance completed — "+s.title,status:"done"})))
    ].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
    // work hours per location (from daily entries)
    const locMap={};
    entries.forEach(r=>{ const L=(r.location||"").trim(); if(!L)return;
      (locMap[L]=locMap[L]||{name:L,hours:0,sessions:0}); locMap[L].hours+=Number(r.duration||0); locMap[L].sessions++; });
    const locations=Object.values(locMap).map(l=>({...l,hours:+l.hours.toFixed(1)}))
      .sort((a,b)=>b.hours-a.hours).slice(0,8);
    // field sites map (from device records: area › site · device count)
    const siteMap={};
    (state.devices||[]).filter(d=>(d.project||"").trim()===pn).forEach(d=>{
      const k=[(d.area||"").trim(),(d.site||"").trim()].join("›"); if(k==="›")return;
      (siteMap[k]=siteMap[k]||{area:(d.area||"").trim(),site:(d.site||"").trim(),devices:0}); siteMap[k].devices++; });
    const sites=Object.values(siteMap).sort((a,b)=>b.devices-a.devices).slice(0,12);
    // Work items: one entry per JOB with its status journey (never raw internal notes)
    let workItems=[], openJobs=0;
    try{
      const wis=(typeof buildWorkItems==="function")?buildWorkItems(entries):[];
      openJobs=wis.filter(w=>!w.closed).length;
      workItems=wis.slice(0,8).map(w=>({
        title:w.title, scope:[w.area,w.site].filter(Boolean).join(" › "),
        status:w.status, closed:w.closed, visits:w.visits,
        first:w.firstDate, last:w.lastDate,
        journey:w.timeline.map(t=>({s:t.status,d:t.date}))
      }));
    }catch(e){}
    return { name:pn, status:p.status||"", hours:+hours.toFixed(1), estHours:est||0,
      pct:est>0?Math.min(999,Math.round(hours/est*100)):0, sessions:entries.length,
      devices, pmDone, openReq, recent, locations, sites, workItems, openJobs };
  });
  return { clientId:client.id, clientName:client.name||"",
    projects, updatedAt:new Date().toISOString(),
    updatedLabel:new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) };
}

window.createShareLink=async function(clientId){
  if(!isAdmin()) return toast("Admin only");
  const client=(state.clients||[]).find(c=>c.id===clientId); if(!client) return;
  const token=_shareToken();
  const payload=_buildSharePayload(client);
  await fbSave("publicShares",{id:token,...payload,revoked:false,createdAt:new Date().toISOString()});
  try{ await navigator.clipboard.writeText(_shareUrl(token)); toast("🔗 Link created & copied ✓"); }
  catch(e){ toast("🔗 Link created ✓"); }
  render();
};
window.copyShareLink=async function(token){
  try{ await navigator.clipboard.writeText(_shareUrl(token)); toast("📋 Link copied ✓"); }
  catch(e){ await uiPrompt("Copy this link:",_shareUrl(token),{title:"Share link",okText:"Done"}); }
};
window.revokeShareLink=async function(token){
  if(!await uiConfirm("Revoke this link? The client's page will stop working immediately."))return;
  const{db,doc,updateDoc}=window.__fb;
  try{ await updateDoc(doc(db,"publicShares",token),{revoked:true}); toast("Link revoked ✓"); }
  catch(e){ toast("Revoke failed: "+e.message); }
  render();
};
window.refreshShareNow=async function(){ await _refreshAllShares(true); };

// staff-side auto-refresher: rewrites every active share snapshot (debounced)
let _shareRefreshBusy=false;
async function _refreshAllShares(manual){
  if(_shareRefreshBusy) return; _shareRefreshBusy=true;
  try{
    const links=(state.publicSharesMeta||[]).filter(s=>!s.revoked);
    for(const sl of links){
      const client=(state.clients||[]).find(c=>c.id===sl.clientId);
      if(!client) continue;
      const payload=_buildSharePayload(client);
      // skip write when nothing visible changed — keeps Firestore writes minimal
      if(!manual && JSON.stringify(sl.projects||[])===JSON.stringify(payload.projects)) continue;
      await fbSave("publicShares",{id:sl.id,...sl,...payload});
    }
    if(manual) toast("↻ Live view refreshed ✓");
  }catch(e){ console.error(e); }
  _shareRefreshBusy=false;
}
// refresh on staff app load (after data settles) + every 3 minutes while open
setTimeout(()=>{ if(state.user&&isAdmin&&isAdmin()) _refreshAllShares(false); }, 15000);
setInterval(()=>{ if(state.user&&isAdmin&&isAdmin()) _refreshAllShares(false); }, 180000);
