function canAssignTasks(){
  return isAdmin() || !!(state.profile && state.profile.canAssignTasks);
}

// Badge counts shown on tabs/groups (Requests kept + new My Tasks)
function tabBadgeCount(t){
  if(t==="Requests") return pendingRequestCount();
  if(t==="My Tasks") return myPendingTaskCount();
  return 0;
}
function myPendingTaskCount(){
  const uid = state.profile && state.profile.uid;
  if(!uid) return 0;
  return (state.tasks||[]).filter(t=>t.assignedToUid===uid && t.status==="pending").length;
}

// ── Notifications core ──
function myNotifications(){
  const uid = state.profile && state.profile.uid;
  return (state.notifications||[]).filter(n=>n.toUid===uid)
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
}
function unreadNotifCount(){ return myNotifications().filter(n=>!n.read).length; }

async function pushNotification(toUid, type, title, body, refId){
  if(!toUid) return;
  await fbSave("notifications",{
    toUid, type, title, body, refId: refId||"",
    read:false,
    fromName:(state.profile && (state.profile.name||state.profile.employeeName))||"",
    createdAt:new Date().toISOString(),
  });
}

// Live-refresh the header bell badge without rebuilding the shell.
function updateNotifBell(){
  const b=document.getElementById("notifBellBadge");
  if(!b) return;
  const n=unreadNotifCount();
  if(n>0){ b.style.display="flex"; b.textContent=n>99?"99+":String(n); }
  else{ b.style.display="none"; }
}

// ── Notifications panel (bell click) ──
window.openNotifPanel=function(){
  try{
  const list=myNotifications();
  let ov=document.getElementById("notifOverlay");
  if(!ov){ ov=document.createElement("div"); ov.id="notifOverlay"; document.body.appendChild(ov); }
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9990;display:flex;align-items:flex-start;justify-content:center;padding:60px 12px 12px";
  ov.onclick=(e)=>{ if(e.target===ov) closeNotifPanel(); };
  const items = list.length ? list.map(n=>`
    <div onclick="openNotif('${n.id}')" style="padding:10px 12px;border-bottom:1px solid #eee;cursor:pointer;background:${n.read?'#fff':'#EEF4FF'}">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <strong style="font-size:12.5px;color:#03308B">${n.read?'':'🔵 '}${escapeHtml(n.title||'')}</strong>
        <span style="display:flex;align-items:center;gap:6px;white-space:nowrap"><span style="font-size:10px;color:#999">${escapeHtml(fmtLastSeen(n.createdAt)||'')}</span><button onclick="event.stopPropagation();deleteNotif('${n.id}')" title="Delete" style="background:#FFEBEE;color:#C62828;border:none;width:18px;height:18px;border-radius:9px;font-size:10px;font-weight:800;cursor:pointer;line-height:1">✕</button></span>
      </div>
      <div style="font-size:11.5px;color:#444;margin-top:3px;line-height:1.5">${escapeHtml(n.body||'')}</div>

    </div>`).join("") : `<div style="padding:26px;text-align:center;color:#999;font-style:italic;font-size:12px">No notifications yet</div>`;
  ov.innerHTML=`<div style="background:#fff;border-radius:12px;max-width:420px;width:100%;max-height:75vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.3)">
    <div style="background:linear-gradient(135deg,#03308B,#2E5FA3);color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center">
      <strong style="font-size:14px">🔔 Notifications & Alerts${unreadNotifCount()?` <span style="background:#C62828;padding:1px 8px;border-radius:10px;font-size:11px">${unreadNotifCount()}</span>`:''}</strong>
      <div style="display:flex;gap:6px">
        ${unreadNotifCount()?`<button onclick="markAllNotifsRead()" style="background:rgba(255,255,255,0.15);color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">Mark all read</button>`:''}
        ${list.length?`<button onclick="clearAllNotifs()" style="background:rgba(198,40,40,0.9);color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer">🗑 Clear all</button>`:''}
        <button onclick="closeNotifPanel()" style="background:rgba(255,255,255,0.15);color:#fff;border:none;width:26px;height:26px;border-radius:6px;font-weight:700;cursor:pointer">✕</button>
      </div>
    </div>
    <div style="overflow-y:auto">${(typeof alertsHTML==="function"?alertsHTML():"")}${items}</div>
  </div>`;
  }catch(err){ console.error("Notif panel error:",err); toast("Could not open notifications"); }
};
window.closeNotifPanel=function(){ const ov=document.getElementById("notifOverlay"); if(ov) ov.remove(); };

window.markNotifRead=async function(id){
  const n=(state.notifications||[]).find(x=>x.id===id);
  if(!n||n.read) return;
  n.read=true;                                   // optimistic local
  try{
    const{db,doc,updateDoc}=window.__fb;
    await updateDoc(doc(db,"notifications",id),{read:true});
  }catch(e){ console.error(e); }
  updateNotifBell(); openNotifPanel();
};
// Tap on a notification: mark it read, then jump straight to the right tab
// (no button needed). Types without a destination just get marked read.
window.openNotif=async function(id){
  const n=(state.notifications||[]).find(x=>x.id===id);
  if(!n) return;
  if(!n.read){
    n.read=true;                                  // optimistic
    try{
      const{db,doc,updateDoc}=window.__fb;
      await updateDoc(doc(db,"notifications",id),{read:true});
    }catch(e){ console.error(e); }
    updateNotifBell();
  }
  const tab = n.type==="task_assigned" ? "My Tasks"
            : (n.type==="new_request"||n.type==="task_confirmed") ? "Requests"
            : null;
  if(tab){ closeNotifPanel(); switchTab(tab); }
  else { openNotifPanel(); }                      // just refresh the panel
};

window.markAllNotifsRead=async function(){
  const un=myNotifications().filter(n=>!n.read);
  try{
    const{db,doc,updateDoc}=window.__fb;
    for(const n of un){ n.read=true; await updateDoc(doc(db,"notifications",n.id),{read:true}); }
  }catch(e){ console.error(e); }
  updateNotifBell(); openNotifPanel();
};
window.deleteNotif=async function(id){
  const n=(state.notifications||[]).find(x=>x.id===id);
  if(!n) return;
  state.notifications=(state.notifications||[]).filter(x=>x.id!==id);   // optimistic
  try{ await fbDelete("notifications", id); }catch(e){ console.error(e); }
  updateNotifBell(); openNotifPanel();
};
window.clearAllNotifs=async function(){
  const mine=myNotifications();
  if(!mine.length) return;
  if(!confirm(`Delete all ${mine.length} notification(s)?`)) return;
  const ids=mine.map(n=>n.id);
  state.notifications=(state.notifications||[]).filter(x=>!ids.includes(x.id));  // optimistic
  try{ for(const id of ids){ await fbDelete("notifications", id); } }catch(e){ console.error(e); }
  updateNotifBell(); openNotifPanel();
};

// ── Task e-mails (reuses the app's EmailJS settings; fails silently) ──
async function _sendTaskEmail(toEmail, subject, message){
  try{
    const s=emailGetSettings();
    if(!s.serviceId||!s.templateId||!s.publicKey) return false;
    if(typeof emailjs==="undefined" || !toEmail) return false;
    emailjs.init({publicKey:s.publicKey});
    await emailjs.send(s.serviceId, s.templateId, { subject, message, to_email: toEmail });
    return true;
  }catch(e){ console.error("Task email failed:", e); return false; }
}

// ── Employee directory for the cascading pickers (users with accounts) ──
// branch from user doc; dept from user doc (userDept) or matching nametag entry.
function _empDirectory(){
  const tags=state.nametagEmployees||[];
  return (state.users||[]).filter(u=>(u.role||"")!=="client").map(u=>{
    const nm=(u.employeeName||u.name||u.email||"").trim();
    const tag=tags.find(t=>(t.name||"").trim().toLowerCase()===nm.toLowerCase());
    return {
      uid:u.id, name:nm, email:u.email||"",
      branch:((u.branch||(tag&&tag.branch))||"").trim(),
      dept:((u.userDept||(tag&&tag.dept))||"").trim(),
    };
  }).filter(e=>e.name);
}

// ── Assign-task modal (cascading Branch → Department → Employee) ──
window.openAssignTask=function(requestId){
  if(!canAssignTasks()) return toast("You don't have permission to assign tasks");
  window._assignCtx={ requestId:requestId||"", branch:"", dept:"", uid:"", desc:"", title:"" };
  _renderAssignModal();
};
window._assignSet=function(field,val){
  const c=window._assignCtx; if(!c) return;
  c[field]=val;
  if(field==="branch"){ c.dept=""; c.uid=""; }
  if(field==="dept"){ c.uid=""; }
  _renderAssignModal();
};
function _renderAssignModal(){
  const c=window._assignCtx; if(!c) return;
  const dir=_empDirectory();
  const req=c.requestId ? (state.clientRequests||[]).find(r=>r.id===c.requestId) : null;
  const branches=[...new Set(dir.map(e=>e.branch).filter(Boolean))].sort();
  const inBranch=dir.filter(e=>!c.branch||e.branch===c.branch);
  const depts=[...new Set(inBranch.map(e=>e.dept).filter(Boolean))].sort();
  const emps=inBranch.filter(e=>!c.dept||e.dept===c.dept).sort((a,b)=>a.name.localeCompare(b.name));
  let ov=document.getElementById("assignOverlay");
  if(!ov){ ov=document.createElement("div"); ov.id="assignOverlay"; document.body.appendChild(ov); }
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9991;display:flex;align-items:center;justify-content:center;padding:16px";
  ov.onclick=(e)=>{ if(e.target===ov) closeAssignModal(); };
  const inp="width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:#fff;box-sizing:border-box";
  ov.innerHTML=`<div style="background:#fff;border-radius:12px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.3)">
    <div style="background:linear-gradient(135deg,#03308B,#2E5FA3);color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;border-radius:12px 12px 0 0">
      <strong style="font-size:14px">👤 Assign Task</strong>
      <button onclick="closeAssignModal()" style="background:rgba(255,255,255,0.15);color:#fff;border:none;width:26px;height:26px;border-radius:6px;font-weight:700;cursor:pointer">✕</button>
    </div>
    <div style="padding:14px;display:flex;flex-direction:column;gap:10px">
      ${req
        ? `<div style="background:#F0F4FF;border:1px solid #B8CCE0;border-radius:8px;padding:9px 11px;font-size:12px;line-height:1.5"><strong style="color:#03308B">🤝 ${escapeHtml(req.clientName||"")}</strong> — ${escapeHtml(req.title||"")}</div>`
        : `<div><label style="font-size:11px;font-weight:700;color:#555">📌 Task Title *</label><input value="${escapeHtml(c.title||"")}" oninput="window._assignCtx.title=this.value" placeholder="e.g. Check Gate 3 camera" style="${inp}"></div>`}
      <div><label style="font-size:11px;font-weight:700;color:#555">🏢 Branch</label>
        <select onchange="_assignSet('branch',this.value)" style="${inp}">
          <option value="">— All branches —</option>
          ${branches.map(b=>`<option value="${escapeHtml(b)}" ${b===c.branch?"selected":""}>${escapeHtml(b)}</option>`).join("")}
        </select></div>
      <div><label style="font-size:11px;font-weight:700;color:#555">🏛️ Department</label>
        <select onchange="_assignSet('dept',this.value)" style="${inp}">
          <option value="">— All departments —</option>
          ${depts.map(d=>`<option value="${escapeHtml(d)}" ${d===c.dept?"selected":""}>${escapeHtml(d)}</option>`).join("")}
        </select></div>
      <div><label style="font-size:11px;font-weight:700;color:#555">👤 Employee *</label>
        <select onchange="window._assignCtx.uid=this.value" style="${inp}">
          <option value="">— Select employee —</option>
          ${emps.map(e=>`<option value="${e.uid}" ${e.uid===c.uid?"selected":""}>${escapeHtml(e.name)}${e.dept?` · ${escapeHtml(e.dept)}`:""}${e.branch?` (${escapeHtml(e.branch)})`:""}</option>`).join("")}
        </select></div>
      <div><label style="font-size:11px;font-weight:700;color:#555">📝 Task Description *</label>
        <textarea oninput="window._assignCtx.desc=this.value" rows="3" placeholder="Describe what the employee should do..." style="${inp};resize:vertical">${escapeHtml(c.desc||"")}</textarea></div>
      <button onclick="confirmAssignTask()" style="background:#03308B;color:#C9A84C;border:none;padding:11px;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer">👤 Assign Task</button>
    </div>
  </div>`;
}
window.closeAssignModal=function(){ const ov=document.getElementById("assignOverlay"); if(ov) ov.remove(); window._assignCtx=null; };

window.confirmAssignTask=async function(){
  const c=window._assignCtx; if(!c) return;
  const req=c.requestId ? (state.clientRequests||[]).find(r=>r.id===c.requestId) : null;
  const title=(req ? (req.title||"") : (c.title||"")).trim();
  if(!title) return toast("Task title is required");
  if(!c.uid) return toast("Please select an employee");
  if(!(c.desc||"").trim()) return toast("Task description is required");
  const emp=_empDirectory().find(e=>e.uid===c.uid);
  if(!emp) return toast("Employee not found");
  const myName=(state.profile&&(state.profile.name||state.profile.employeeName))||"Admin";
  const tid="tsk"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const task={
    id:tid,
    source:req?"request":"manual",
    requestId:c.requestId||"",
    clientName:(req&&req.clientName)||"",
    title,
    description:c.desc.trim(),
    branch:emp.branch||"", dept:emp.dept||"",
    assignedTo:emp.name, assignedToUid:emp.uid,
    assignedBy:myName, assignedByUid:state.profile.uid,
    status:"pending",
    createdAt:new Date().toISOString(),
    confirmedAt:"",
  };
  await fbSave("tasks", task);
  await pushNotification(emp.uid,"task_assigned","📋 New Task Assigned",
    `You have been assigned a task: "${title}" — by ${myName}`, tid);
  const emailed=await _sendTaskEmail(emp.email,
    `📋 New Task Assigned — ${title}`,
    `Hello ${emp.name},\n\nYou have been assigned a new task in Girêk:\n\nTask: ${title}\nDescription: ${task.description}\n${task.clientName?`Client: ${task.clientName}\n`:""}Assigned by: ${myName}\n\nPlease open Girêk → My Tasks and confirm the task.\n\n— EJAF Technology · Girêk`);
  closeAssignModal();
  toast(emailed ? `✓ Assigned to ${emp.name} — notified + emailed` : `✓ Assigned to ${emp.name} — in-app notification sent`);
  render();
};

// ── Employee confirms a task → notify + email the assigner ──
window.confirmTask=async function(id){
  const t=(state.tasks||[]).find(x=>x.id===id);
  if(!t) return;
  const uid=state.profile&&state.profile.uid;
  if(t.assignedToUid!==uid) return toast("Only the assigned employee can confirm");
  if(t.status==="confirmed") return;
  try{
    const{db,doc,updateDoc}=window.__fb;
    await updateDoc(doc(db,"tasks",id),{status:"confirmed",confirmedAt:new Date().toISOString()});
  }catch(e){ return toast("Confirm failed: "+e.message); }
  const myName=(state.profile&&(state.profile.name||state.profile.employeeName))||"";
  await pushNotification(t.assignedByUid,"task_confirmed","✅ Task Confirmed",
    `${myName} confirmed the task: "${t.title}"`, id);
  const assigner=(state.users||[]).find(u=>u.id===t.assignedByUid);
  if(assigner&&assigner.email){
    await _sendTaskEmail(assigner.email,
      `✅ Task Confirmed — ${t.title}`,
      `Hello ${t.assignedBy},\n\n${myName} has CONFIRMED the task:\n\nTask: ${t.title}\n${t.clientName?`Client: ${t.clientName}\n`:""}\n— EJAF Technology · Girêk`);
  }
  toast("✓ Task confirmed");
  render();
};

// ── Delete a task: only its assigner or an admin. Assigned employee is told. ──
window.deleteTask=async function(id){
  const t=(state.tasks||[]).find(x=>x.id===id);
  if(!t) return;
  const uid=state.profile&&state.profile.uid;
  if(!(isAdmin()||t.assignedByUid===uid)) return toast("Only the assigner or an admin can delete this task");
  if(!confirm(`Delete task "${t.title}"?`)) return;
  await fbDelete("tasks", id);
  const myName=(state.profile&&(state.profile.name||state.profile.employeeName))||"";
  if(t.assignedToUid && t.assignedToUid!==uid){
    await pushNotification(t.assignedToUid,"task_cancelled","🗑 Task Cancelled",
      `The task "${t.title}" was cancelled by ${myName}`, "");
  }
  toast("✓ Task deleted");
  render();
};

// ── Assignment info block shown on each client-request card (staff view) ──
function miniAvatar(uid, nameFallback){
  const u=(state.users||[]).find(x=>x.id===uid);
  const nm=(u&&(u.employeeName||u.name||u.email))||nameFallback||"?";
  const ph=u&&u.photoData;
  if(ph) return `<img src="${ph}" alt="" style="width:18px;height:18px;border-radius:50%;object-fit:cover;vertical-align:-4px;margin-right:3px;border:1px solid var(--line)">`;
  return `<span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:var(--navy);color:var(--gold);font-size:9px;font-weight:800;align-items:center;justify-content:center;vertical-align:-4px;margin-right:3px">${escapeHtml(nm.charAt(0).toUpperCase())}</span>`;
}

function taskStatusChip(t){
  return t.status==="confirmed"
    ? `<span style="background:#E8F5E9;color:#2E7D32;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap">✅ CONFIRMED</span>`
    : `<span style="background:#FFF8E1;color:#B26A00;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:800;white-space:nowrap">⏳ AWAITING CONFIRM</span>`;
}
function taskAssignBlockHTML(r){
  const t=(state.tasks||[]).find(x=>x.requestId===r.id);
  if(t){
    return `<div style="margin-top:8px;background:#F0F7F0;border:1px solid #C8E6C9;border-radius:8px;padding:7px 10px;font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
      <span>👤 Assigned to <strong>${escapeHtml(t.assignedTo||"")}</strong> · by ${escapeHtml(t.assignedBy||"")}</span><span style="display:flex;gap:5px;align-items:center">${taskStatusChip(t)}${(isAdmin()||t.assignedByUid===(state.profile&&state.profile.uid))?`<button onclick="deleteTask('${t.id}')" title="Delete task" style="background:#FFEBEE;color:#C62828;border:none;width:22px;height:22px;border-radius:11px;font-weight:800;cursor:pointer;font-size:11px">🗑</button>`:""}</span></div>`;
  }
  if(canAssignTasks()){
    return `<div style="margin-top:8px"><button onclick="openAssignTask('${r.id}')" style="background:#03308B;color:#C9A84C;border:none;padding:7px 14px;border-radius:8px;font-weight:800;font-size:11px;cursor:pointer">👤 Assign Task</button></div>`;
  }
  return "";
}

// ── Admin: grant/revoke "can assign tasks" (Users tab toggle) ──
window.toggleCanAssign=async function(userId){
  if(!isAdmin()) return toast("Admin only");
  const u=(state.users||[]).find(x=>x.id===userId); if(!u) return;
  const nv=!u.canAssignTasks;
  try{
    const{db,doc,updateDoc}=window.__fb;
    await updateDoc(doc(db,"users",userId),{canAssignTasks:nv});
    toast(nv?"✓ Can now assign tasks":"Assign-tasks permission removed");
  }catch(e){ toast("Failed: "+e.message); }
};

// ── Admin: grant/revoke "view reports" for an employee (Users tab toggle) ──
window.toggleViewReports=async function(userId){
  if(!isAdmin()) return toast("Admin only");
  const u=(state.users||[]).find(x=>x.id===userId); if(!u) return;
  const nv=!u.canViewReports;
  try{
    const{db,doc,updateDoc}=window.__fb;
    await updateDoc(doc(db,"users",userId),{canViewReports:nv});
    toast(nv?"✓ Employee can now view Reports":"Reports access removed");
  }catch(e){ toast("Failed: "+e.message); }
};

// ── My Tasks tab ──
function _taskCard(t, mineView){
  return `<div class="card" style="border-left:4px solid ${t.status==="confirmed"?"#2E7D32":"#C9A84C"};padding:12px 14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
      <strong style="font-size:13.5px;color:#03308B">${escapeHtml(t.title||"")}</strong>
      ${taskStatusChip(t)}
    </div>
    ${t.clientName
      ? `<div style="font-size:11px;color:#6A1B9A;font-weight:700;margin-top:3px">🤝 ${escapeHtml(t.clientName)}${t.source==="request"?" · from client request":""}</div>`
      : (t.source==="manual" ? `<div style="font-size:10.5px;color:#888;margin-top:3px">✍️ Manual task</div>` : "")}
    <div style="font-size:12px;color:#333;margin-top:6px;line-height:1.6;background:#F8FAFF;border:1px solid #E3ECF7;border-radius:8px;padding:8px 10px">${escapeHtml(t.description||"")}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:6px">
      <span style="font-size:10.5px;color:#666">${mineView
        ? `${miniAvatar(t.assignedByUid,t.assignedBy)} By: <strong>${escapeHtml(t.assignedBy||"")}</strong>`
        : `${miniAvatar(t.assignedToUid,t.assignedTo)} To: <strong>${escapeHtml(t.assignedTo||"")}</strong>`} · 📅 ${escapeHtml(fmtDate((t.createdAt||"").slice(0,10)))}${(t.status==="confirmed"&&t.confirmedAt)?` · ✅ ${escapeHtml(fmtLastSeen(t.confirmedAt)||"")}`:""}</span>
      <div style="display:flex;gap:6px;align-items:center">
        ${(mineView&&t.status==="pending")?`<button onclick="confirmTask('${t.id}')" style="background:#2E7D32;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer">✅ Confirm</button>`:""}
        ${(isAdmin()||t.assignedByUid===(state.profile&&state.profile.uid))?`<button onclick="deleteTask('${t.id}')" title="Delete task" style="background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;padding:8px 12px;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer">🗑</button>`:""}
      </div>
    </div>
  </div>`;
}
function renderMyTasks(){
  const uid=state.profile&&state.profile.uid;
  const byDate=(a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"");
  const mine=(state.tasks||[]).filter(t=>t.assignedToUid===uid).sort(byDate);
  const pend=mine.filter(t=>t.status==="pending").length;
  const canAsg=canAssignTasks();
  const byMe=canAsg?(state.tasks||[]).filter(t=>t.assignedByUid===uid).sort(byDate):[];
  const pendBy=byMe.filter(t=>t.status==="pending").length;
  const mv=canAsg?(window._myTasksView||"inbox"):"inbox";
  let h=`<div class="card" style="background:linear-gradient(135deg,#03308B,#2E5FA3);color:#fff;padding:14px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <div><strong style="font-size:15px">📋 My Tasks</strong>
        <div style="font-size:11px;opacity:0.85;margin-top:2px">${mv==="assigned"
          ? `${byMe.length} assigned by you${pendBy?` · ${pendBy} awaiting confirmation`:""}`
          : `${mine.length} task(s)${pend?` · ${pend} awaiting your confirmation`:""}`}</div></div>
      ${canAsg?`<button onclick="openAssignTask('')" style="background:#C9A84C;color:#03308B;border:none;padding:9px 14px;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer">➕ New Task</button>`:""}
    </div></div>`;
  if(canAsg) h += _pills('_myTasksView',[{id:"inbox",ic:"📥",lb:`Inbox${pend?` (${pend})`:""}`},{id:"assigned",ic:"📤",lb:`Assigned by Me${pendBy?` (${pendBy})`:""}`}]);
  if(mv==="inbox"){
    h += mine.length ? mine.map(t=>_taskCard(t,true)).join("") : `<div class="card"><div class="empty empty2"><span class="e-ic">✅</span><div class="e-t">Nothing assigned to you</div><div class="e-m">New task assignments will land here — with a bell notification</div></div></div>`;
  } else {
    h += byMe.length ? byMe.map(t=>_taskCard(t,false)).join("") : `<div class="card"><div class="empty">You haven't assigned any tasks yet</div></div>`;
  }
  return h;
}
// ── SLA chip: live countdown / breach / met-badge for a request ──
function slaChip(r){
  try{
    const sla=getSLA(); if(!r.createdAt) return "";
    const created=new Date(r.createdAt).getTime(); const hrs=v=>Math.round(v/36e5*10)/10;
    if(REQ_FINAL_RE.test(r.status||"")){
      const end=r.completedAt?new Date(r.completedAt).getTime():(r.statusUpdatedAt?new Date(r.statusUpdatedAt).getTime():null);
      if(!end) return "";
      const took=hrs(end-created), ok=took<=sla.completeHrs;
      return `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:9px;background:${ok?'#E8F5E9':'#FFEBEE'};color:${ok?'#2E7D32':'#C62828'}">${ok?'✔ SLA met':'✖ SLA breached'} · ${took}h</span>`;
    }
    const init=(typeof reqInitialStatus==="function")?reqInitialStatus():"new";
    const isNewR=((r.status||init)===init) && !r.respondedAt;
    const limit=(isNewR?sla.responseHrs:sla.completeHrs)*36e5;
    const left=created+limit-Date.now(), lab=isNewR?"response":"completion", lh=hrs(Math.abs(left));
    if(left<0) return `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:9px;background:#C62828;color:#fff">⚠ ${lab} SLA · ${lh}h over</span>`;
    const warn=left<limit*0.25;
    return `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:9px;background:${warn?'#FFF3E0':'#E3F2FD'};color:${warn?'#E65100':'#1565C0'}">⏱ ${lab}: ${lh}h left</span>`;
  }catch(e){ return ""; }
}
function renderRequests(){
  // CLIENT VIEW: submit + track own requests
  if(isClient()){
    const c = getMyClientRecord();
    if(!c) return `<div class="card"><div class="empty">Account not linked to a client</div></div>`;
    if(!requestForm) requestForm={title:"",description:"",project:(c.projects||[])[0]||"",projectCode:"",area:"",site:"",deviceSerial:""};
    const perms = getClientPermissions(c.id);
    const myReqs = (state.clientRequests||[])
      .filter(r=>r.clientId===c.id)
      .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));

    // Cascading detail pickers (only when admin enabled Project Details)
    let detailFields = "";
    if(perms.projectDetails){
      const proj = (state.projects||[]).find(p=>p.name===requestForm.project);
      const pCodes = proj ? (proj.codes||[]) : [];   // projects store an ARRAY of codes
      const areas = proj ? (proj.areas||[]) : [];
      const areaObj = areas.find(a=>a.name===requestForm.area);
      const sites = areaObj ? (areaObj.sites||[]).filter(s=>s.active!==false) : [];
      const devices = (state.devices||[]).filter(d=>
        d.project===requestForm.project &&
        (!requestForm.area || d.area===requestForm.area) &&
        (!requestForm.site || d.site===requestForm.site)
      );
      detailFields = `
        <div class="field"><label>🔌 Project Code</label>
          ${pCodes.length
            ? `<select onchange="window.requestForm.projectCode=this.value">
                <option value="">${pCodes.length>1?"— Select —":"— Optional —"}</option>
                ${pCodes.map(code=>`<option value="${escapeHtml(code)}" ${code===requestForm.projectCode?"selected":""}>${escapeHtml(code)}</option>`).join("")}
              </select>`
            : `<input value="" disabled placeholder="No codes for this project" style="background:#F5F7FA;color:#999">`}
        </div>
        <div class="field"><label>🗺️ Area</label>
          <select onchange="window.requestForm.area=this.value;window.requestForm.site='';window.requestForm.deviceSerial='';render()">
            <option value="">— Optional —</option>
            ${areas.map(a=>`<option value="${escapeHtml(a.name)}" ${a.name===requestForm.area?"selected":""}>${escapeHtml(a.name)}</option>`).join("")}
          </select></div>
        <div class="field"><label>📍 Site</label>
          <select onchange="window.requestForm.site=this.value;window.requestForm.deviceSerial='';render()" ${!requestForm.area?"disabled":""}>
            <option value="">${requestForm.area?"— Optional —":"Pick area first"}</option>
            ${sites.map(s=>`<option value="${escapeHtml(s.name)}" ${s.name===requestForm.site?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}
          </select></div>
        <div class="field"><label>📟 Device</label>
          <select onchange="window.requestForm.deviceSerial=this.value">
            <option value="">— Optional —</option>
            ${devices.map(d=>{const lbl=[d.deviceName||d.model||"Device",d.serialNumber?`SN:${d.serialNumber}`:"",d.site||""].filter(Boolean).join(" · ");const val=d.serialNumber||("id:"+d.id);return `<option value="${escapeHtml(val)}" ${val===requestForm.deviceSerial?"selected":""}>${escapeHtml(lbl)}</option>`;}).join("")}
          </select></div>`;
    }

    return `<div class="card" style="border-left:4px solid #C9A84C">
      <div class="card-title">📨 Request New Task</div>
      <div class="form-grid">
        <div class="field full"><label>Task Title <span class="req">*</span></label>
          <input value="${escapeHtml(requestForm.title||"")}" oninput="window.requestForm.title=this.value" placeholder="e.g., Install additional camera at gate 3"></div>
        <div class="field ${perms.projectDetails?"":"full"}"><label>Project</label>
          <select onchange="window.requestForm.project=this.value;window.requestForm.projectCode='';window.requestForm.area='';window.requestForm.site='';window.requestForm.deviceSerial='';${perms.projectDetails?"render()":""}">
            ${(c.projects||[]).map(p=>`<option value="${escapeHtml(p)}" ${p===requestForm.project?"selected":""}>${escapeHtml(p)}</option>`).join("")}
          </select></div>
        ${detailFields}
        <div class="field full"><label>Description <span class="req">*</span></label>
          <textarea rows="3" oninput="window.requestForm.description=this.value" placeholder="Describe what you need...">${escapeHtml(requestForm.description||"")}</textarea></div>
      </div>
      <button class="btn btn-primary" style="margin-top:10px" onclick="submitClientRequest()">📨 Submit Request</button>
    </div>

    <div class="card">
      <div class="filter-row"><span class="card-title" style="margin:0">My Requests</span><span class="count-pill">${myReqs.length}</span></div>
      ${myReqs.length===0?`<div class="empty empty2"><span class="e-ic">📨</span><div class="e-t">No requests yet</div><div class="e-m">Submit your first request above — we track it against our SLA</div></div>`:
      `<div style="display:flex;flex-direction:column;gap:8px">
        ${myReqs.map(r=>`<div style="border:1px solid var(--line);border-left:4px solid ${reqStatusColor(r.status)};border-radius:8px;padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
            <div style="flex:1;min-width:180px">
              <div style="font-weight:700;font-size:14px;color:#1A202C">${escapeHtml(r.title)}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHtml(r.project||"")} · ${fmtDate((r.createdAt||"").slice(0,10))}</div>
              ${(r.projectCode||r.area||r.site||r.deviceSerial)?`<div style="font-size:11px;color:#03308B;margin-top:3px">${[r.projectCode&&`🔌 ${escapeHtml(r.projectCode)}`,r.area&&`🗺️ ${escapeHtml(r.area)}`,r.site&&`📍 ${escapeHtml(r.site)}`,r.deviceSerial&&`📟 ${escapeHtml(r.deviceSerial)}`].filter(Boolean).join(" · ")}</div>`:""}
              <div style="font-size:12px;color:#555;margin-top:6px;line-height:1.5">${escapeHtml(r.description||"")}</div>
            </div>
            ${reqStatusBadge(r.status)} ${slaChip(r)}
          </div>
        </div>`).join("")}
      </div>`}
    </div>`;
  }

  // ADMIN/HR/SUPPORT VIEW: manage all requests
  if(!canSeeReports()) return `<div class="card"><div class="empty">Access denied</div></div>`;
  const reqs = (state.clientRequests||[]).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  const newCount = reqs.filter(r=>r.status==="new"||r.status===reqInitialStatus()).length;

  const _sla=getSLA();
  return `${renderDeviceSuggestionsAdmin()}${isAdmin()?`<div class="card" style="border-left:4px solid #C9A84C">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font-size:14px;font-weight:800;color:var(--text)">⏱ Service-Level Targets (SLA)</span>
      <span style="font-size:10px;color:var(--muted)">— your time promise to clients</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:8px">
      <div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px">
        <div style="font-weight:800;font-size:12px;color:#1565C0">🫱 First Response</div>
        <div style="font-size:10.5px;color:var(--muted);margin:3px 0 8px;line-height:1.45">Max time to REACT to a new request (its status leaves "New"). Answers the client's "did they even see it?"</div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" min="1" value="${_sla.responseHrs}" style="width:76px;padding:7px 9px;border:1.5px solid var(--line);border-radius:8px;font-weight:800;font-size:14px" onchange="saveSLA('responseHrs',this.value)">
          <span style="font-size:12px;font-weight:700">hours</span>
          <span style="font-size:10px;color:var(--muted)">≈ ${(Math.round(_sla.responseHrs/24*10)/10)} day(s)</span>
        </div>
      </div>
      <div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px">
        <div style="font-weight:800;font-size:12px;color:#2E7D32">🏁 Completion</div>
        <div style="font-size:10.5px;color:var(--muted);margin:3px 0 8px;line-height:1.45">Max time to fully CLOSE the request (status becomes Completed). Your delivery promise.</div>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" min="1" value="${_sla.completeHrs}" style="width:76px;padding:7px 9px;border:1.5px solid var(--line);border-radius:8px;font-weight:800;font-size:14px" onchange="saveSLA('completeHrs',this.value)">
          <span style="font-size:12px;font-weight:700">hours</span>
          <span style="font-size:10px;color:var(--muted)">≈ ${(Math.round(_sla.completeHrs/24*10)/10)} day(s)</span>
        </div>
      </div>
    </div>
    <div style="margin-top:10px;padding:8px 12px;background:var(--line);border-radius:8px;font-size:10.5px;color:var(--muted);line-height:1.5">
      ⚙️ Both timers start when a request is created. Every request card shows a live countdown chip: 🔵 on time → 🟠 &lt;25% left → 🔴 breached — and freezes on ✔/✖ when closed. Breaches also ring the 🔔 bell, and monthly compliance % appears in Analytics.
    </div>
  </div>`:''}<div class="card">
    <div class="filter-row">
      <span class="card-title" style="margin:0">📨 Client Task Requests</span>
      <span class="count-pill">${reqs.length}</span>
      ${newCount?`<span style="background:#C62828;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">${newCount} NEW</span>`:""}
    </div>
    ${reqs.length===0?`<div class="empty">No client requests yet</div>`:
    `<div style="display:flex;flex-direction:column;gap:10px">
      ${reqs.map(r=>{
        const client = (state.clients||[]).find(c=>c.id===r.clientId);
        return `<div style="border:1px solid var(--line);border-left:4px solid ${reqStatusColor(r.status)};border-radius:10px;padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="font-weight:800;font-size:15px;color:#1A202C">${escapeHtml(r.title)}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">
                🏢 ${escapeHtml(client?.name||"Unknown client")} · 📁 ${escapeHtml(r.project||"—")} · ${fmtDate((r.createdAt||"").slice(0,10))}
              </div>
              ${(r.projectCode||r.area||r.site||r.deviceSerial)?`<div style="font-size:11px;color:#03308B;margin-top:3px;font-weight:600">${[r.projectCode&&`🔌 ${escapeHtml(r.projectCode)}`,r.area&&`🗺️ ${escapeHtml(r.area)}`,r.site&&`📍 ${escapeHtml(r.site)}`,r.deviceSerial&&`📟 ${escapeHtml(r.deviceSerial)}`].filter(Boolean).join(" · ")}</div>`:""}
              <div style="font-size:13px;color:#444;margin-top:8px;line-height:1.6">${escapeHtml(r.description||"")}</div>
              ${taskAssignBlockHTML(r)}
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
              ${reqStatusBadge(r.status)} ${slaChip(r)}
              ${isAdmin()||isHR()?`<select onchange="updateRequestStatus('${r.id}',this.value)" style="padding:5px 10px;border:1px solid var(--line);border-radius:6px;font-size:12px;font-weight:600">
                ${(()=>{const opts=getReqStatusList();const has=opts.some(o=>o.value===r.status);const all=has?opts:[{value:r.status,label:prettyStatus(r.status)},...opts];return all.map(o=>`<option value="${escapeHtml(o.value)}" ${r.status===o.value?"selected":""}>${o.label}</option>`).join("");})()}
              </select>`:""}
              ${isAdmin()?`<button class="btn btn-sm btn-danger" onclick="delRequest('${r.id}')">🗑</button>`:""}
              ${canUseWhatsApp() && (waGetSettings().triggers||[]).includes("clientRequests")?`<button class="btn btn-sm" style="background:#25D366;color:white;border:none;font-weight:700" onclick='openWaShare(${JSON.stringify({employee:r.clientName,project:r.project,date:(r.createdAt||"").slice(0,10),resolutionText:r.title+" — "+r.description,description:r.title+" — "+r.description}).replace(/'/g,"&#39;")})'>📲</button>`:""}${canUseEmail() && (emailGetSettings().triggers||[]).includes("clientRequests")?`<button class="btn btn-sm" style="background:#03308B;color:white;border:none;font-weight:700" onclick='openEmailShare(${JSON.stringify({employee:r.clientName,project:r.project,date:(r.createdAt||"").slice(0,10),resolutionText:r.title+" — "+r.description,description:r.title+" — "+r.description}).replace(/'/g,"&#39;")})'>📧</button>`:""}
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>`}
  </div>`;
}

function reqStatusColor(s){
  if(s==="completed") return "#2E7D32";
  if(s==="in_progress") return "#E65100";
  if(s==="new") return "#C62828";
  return "#03308B";   // custom admin-defined status
}
function prettyStatus(s){ return String(s||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }
// Custom request-status options (Technical Classifications → Client Request Entry).
// Empty list → the built-in trio. Old requests keep their status even if removed (Choice 1).
function getReqStatusList(){
  const custom=(state.requestStatuses||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(x=>x.name).filter(Boolean);
  if(custom.length) return custom.map(n=>({value:n,label:n}));
  return [{value:"new",label:"🆕 New"},{value:"in_progress",label:"⚙️ In Progress"},{value:"completed",label:"✅ Completed"}];
}
function reqInitialStatus(){ return getReqStatusList()[0].value; }
function getProjStatusList(){
  const custom=(state.projectStatuses||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(x=>x.name).filter(Boolean);
  return custom.length?custom:["Active","On Hold","Completed"];
}
function reqStatusBadge(s){
  const map={
    new:`<span style="background:#FFEBEE;color:#C62828;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:800;white-space:nowrap">🆕 NEW</span>`,
    in_progress:`<span style="background:#FFF3E0;color:#E65100;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:800;white-space:nowrap">⚙️ IN PROGRESS</span>`,
    completed:`<span style="background:#E8F5E9;color:#2E7D32;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:800;white-space:nowrap">✅ COMPLETED</span>`,
  };
  return map[s]||`<span style="background:#F0F4FF;color:#03308B;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:800;white-space:nowrap">📌 ${escapeHtml(prettyStatus(s)).toUpperCase()}</span>`;
}

async function submitClientRequest(){
  const c = getMyClientRecord();
  if(!c) return toast("Account not linked to a client");
  const title=(requestForm.title||"").trim();
  const desc=(requestForm.description||"").trim();
  if(!title) return toast("Task title is required");
  if(!desc) return toast("Description is required");
  const savedRequest = {
    clientId: c.id,
    clientName: c.name,
    project: requestForm.project||"",
    projectCode: requestForm.projectCode||"",
    area: requestForm.area||"",
    site: requestForm.site||"",
    deviceSerial: requestForm.deviceSerial||"",
    title, description: desc,
    status: reqInitialStatus(),
    createdAt: new Date().toISOString(),
  };
  await fbSave("clientRequests",{
    id: undefined,
    ...savedRequest,
    createdBy: state.profile.uid,
  });
  requestForm=null;
  toast("Request submitted ✓ — our team will review it");
  // Bell 🔔 notification to everyone who can access the Requests tab.
  notifyRequestStaff(savedRequest);
  // Auto-email the admin-specified recipients about this new request.
  autoSendRequestEmail(savedRequest);
}

// Fan-out an in-app bell 🔔 notification about a NEW client request to all
// staff roles that can open the Requests tab (admin / owner / hr / support).
async function notifyRequestStaff(req){
  try{
    const staff=(state.users||[]).filter(u=>["admin","owner","hr","support"].includes((u.role||"").toLowerCase()));
    const me=state.profile&&state.profile.uid;
    for(const s of staff){
      if(s.id===me) continue;
      await pushNotification(s.id,"new_request","📨 New Client Request",
        `${req.clientName||"A client"} submitted: "${req.title}"${req.project?` — ${req.project}`:""}`, "");
    }
  }catch(e){ console.error("notifyRequestStaff:", e); }
}

// Silent auto-email for a NEW client request → goes to the request-notification
// recipients the admin configured (falls back to the main email recipients).
async function autoSendRequestEmail(req){
  const s = emailGetSettings();
  if(!s.enabled) return;                                    // master off
  if(!(s.triggers||[]).includes("clientRequests")) return;  // trigger off
  if(!s.serviceId || !s.templateId || !s.publicKey) return; // not configured
  if(typeof emailjs === "undefined") return;
  // Use dedicated request recipients if set, else fall back to all email recipients
  let recipients = [];
  const reqList = s.requestRecipients || [];
  if(reqList.length > 0){
    recipients = reqList.filter(e=>e && e.includes("@")).map(e=>({name:e, email:e}));
  } else {
    recipients = resolveEmailRecipients();
  }
  if(recipients.length === 0) return;
  const detailLine = [req.projectCode&&`Code: ${req.projectCode}`, req.area&&`Area: ${req.area}`, req.site&&`Site: ${req.site}`, req.deviceSerial&&`Device: ${req.deviceSerial}`].filter(Boolean).join("\n");
  const body =
    `🔔 New Client Request\n\n` +
    `Client: ${req.clientName||"—"}\n` +
    `Project: ${req.project||"—"}\n` +
    (detailLine?detailLine+"\n":"") +
    `Title: ${req.title||"—"}\n` +
    `Description: ${req.description||"—"}\n` +
    `Submitted: ${fmtDate((req.createdAt||"").slice(0,10))}`;
  try{
    emailjs.init({publicKey:s.publicKey});
    let sent = 0;
    for(const r of recipients){
      await emailjs.send(s.serviceId, s.templateId, {
        subject: (s.subject||"EJAF Operations") + " — New Client Request",
        message: body,
        to_email: r.email,
      });
      sent++;
    }
    toast(`📧 Request notification sent to ${sent} recipient${sent>1?'s':''}`);
  }catch(e){
    toast("Request email failed: " + (e.text||e.message||"check setup"));
  }
}
window.autoSendRequestEmail = autoSendRequestEmail;
async function updateRequestStatus(id, status){
  if(!isAdmin() && !isHR()) return toast("Not allowed");
  const r=(state.clientRequests||[]).find(x=>x.id===id);
  if(!r) return;
  const patch={...r, id, status, statusUpdatedAt:new Date().toISOString(), statusUpdatedBy:state.profile.uid};
  // SLA milestones (stamped once)
  const _init=(typeof reqInitialStatus==="function")?reqInitialStatus():"new";
  if(!r.respondedAt && (r.status||_init)===_init && status!==_init) patch.respondedAt=new Date().toISOString();
  if(REQ_FINAL_RE.test(status||"") && !r.completedAt) patch.completedAt=new Date().toISOString();
  await fbSave("clientRequests",patch);
  toast(`Status → ${status.replace("_"," ")} ✓`);
}
async function delRequest(id){
  if(!isAdmin()) return;
  if(!confirm("Delete this request?"))return;
  await fbDelete("clientRequests",id);
  toast("Request deleted");
}
Object.assign(window,{submitClientRequest,updateRequestStatus,delRequest});
Object.defineProperty(window,'requestForm',{get:()=>requestForm,set:v=>requestForm=v,configurable:true});

// ═══════════════════════════════════════════════════════════════════════
//  CASCADE RENAME — Projects, Departments, Locations (Admin)
// ═══════════════════════════════════════════════════════════════════════
async function cascadeRenameProject(oldName, newName){
  const {db, doc, updateDoc} = window.__fb;
  let synced=0;
  // daily, overtime, travel records
  for(const [col, rows] of [["daily",state.daily],["overtime",state.overtime],["travel",state.travel]]){
    for(const r of rows){
      if(r.project===oldName){ await updateDoc(doc(db,col,r.id),{project:newName}); synced++; }
    }
  }
  // clients' project lists
  for(const c of (state.clients||[])){
    if((c.projects||[]).includes(oldName)){
      const np=(c.projects||[]).map(p=>p===oldName?newName:p);
      await updateDoc(doc(db,"clients",c.id),{projects:np}); synced++;
    }
  }
  // client requests
  for(const r of (state.clientRequests||[])){
    if(r.project===oldName){ await updateDoc(doc(db,"clientRequests",r.id),{project:newName}); synced++; }
  }
  return synced;
}
async function cascadeRenameDepartment(oldName, newName){
  const {db, doc, updateDoc} = window.__fb;
  let synced=0;
  for(const [col, rows] of [["daily",state.daily],["overtime",state.overtime],["travel",state.travel]]){
    for(const r of rows){
      if(r.dept===oldName){ await updateDoc(doc(db,col,r.id),{dept:newName}); synced++; }
    }
  }
  // projects that belong to this department
  for(const p of state.projects){
    if(p.dept===oldName){ await updateDoc(doc(db,"projects",p.id),{dept:newName}); synced++; }
  }
  return synced;
}
async function cascadeRenameLocation(oldName, newName){
  const {db, doc, updateDoc} = window.__fb;
  let synced=0;
  for(const [col, rows] of [["daily",state.daily],["overtime",state.overtime],["travel",state.travel]]){
    for(const r of rows){
      if(r.location===oldName){ await updateDoc(doc(db,col,r.id),{location:newName}); synced++; }
    }
  }
  return synced;
}
window.cascadeRenameProject=cascadeRenameProject;
window.cascadeRenameDepartment=cascadeRenameDepartment;
window.cascadeRenameLocation=cascadeRenameLocation;


// ═══════════════════════════════════════════════════════════════════════
//  WHATSAPP MODULE — contacts, settings, and share button
// ═══════════════════════════════════════════════════════════════════════
/* wa state hoisted to top (TDZ fix) */

// Available message fields the admin can toggle
const WA_FIELDS = [
  {id:"entryNo",        label:"Entry #",        icon:"#️⃣"},
  {id:"employee",       label:"Employee",       icon:"👤"},
  {id:"date",           label:"Date",           icon:"📅"},
  {id:"project",        label:"Project",        icon:"📁"},
  {id:"dept",           label:"Department",     icon:"🏢"},
  {id:"location",       label:"Location",       icon:"📍"},
  {id:"duration",       label:"Duration/Hours", icon:"⏱️"},
  {id:"resolutionText", label:"Description",    icon:"📝"},
  {id:"notes",          label:"Notes",          icon:"🗒️"},
];


window.saveSLA=async function(k,v){
  const cur=getSLA();
  await fbSave("settings",{id:"sla",...cur,[k]:Math.max(1,Number(v)||cur[k])});
  toast("⏱ SLA target saved ✓");
};
