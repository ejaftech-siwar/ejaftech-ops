function renderWorkInstructions(){
  // Permission: Everyone can VIEW. Admin can edit/add/delete all. IT can add tasks only.
  const canEdit = canEditWorkInstructions(); // Admin only
  const canAdd  = canAddWorkInstructions();  // Admin + IT
  if(canEdit && !wiCategoryForm) wiCategoryForm = {name:"", icon:"📁", color:"#2E5FA3"};

  const cats = state.workCategories || [];
  // Auto-select first category on first render
  if(!wiActiveCategory && cats.length > 0) wiActiveCategory = cats[0].name;
  const activeTasks = (state.workTasks || []).filter(t => t.category === wiActiveCategory);

  const iconChoices = ["🏢","🔒","⚙️","🔧","💻","📡","🛠️","📋","🗂️","📚","🔌","🛡️","🚨","🏗️","🔍"];
  const colorChoices = ["#2E7D32","#E65100","#6A1B9A","#1565C0","#C62828","#00838F","#5D4037","#37474F","#AD1457"];

  let h = "";

  // === ADMIN-ONLY: Add Category Form ===
  if(canEdit){
    h += `<div class="card">
      <div class="sec-hdr">${wiCategoryEditId?"Edit":"Add"} Category</div>
      <div class="form-grid">
        <div class="field"><label>Category Name <span class="req">*</span></label>
          <input value="${escapeHtml(wiCategoryForm.name||"")}" oninput="window.wiCategoryForm.name=this.value" placeholder="e.g., Enterprise, Security, Networking"></div>
        <div class="field"><label>Icon</label>
          <select onchange="window.wiCategoryForm.icon=this.value;render()">
            ${iconChoices.map(ic=>`<option value="${ic}" ${ic===wiCategoryForm.icon?"selected":""}>${ic}</option>`).join("")}
          </select>
        </div>
        <div class="field full"><label>Color</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${colorChoices.map(c=>`<div onclick="window.wiCategoryForm.color='${c}';render()" style="width:28px;height:28px;border-radius:6px;background:${c};cursor:pointer;border:${c===wiCategoryForm.color?'3px solid #1B3A6B':'1px solid #E0E6ED'};box-shadow:0 2px 4px rgba(0,0,0,0.1)"></div>`).join("")}
          </div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" onclick="saveWICategory()">${wiCategoryEditId?"Update":"Add Category"}</button>
        ${wiCategoryEditId?`<button class="btn btn-ghost" onclick="cancelWICategory()">Cancel</button>`:""}
      </div>
    </div>`;
  } else if(canAdd) {
    // === IT ROLE: Can add tasks, view categories, but not manage categories ===
    h += `<div class="card" style="background:linear-gradient(135deg,#E8F4FD 0%,#F0F4FA 100%);border-left:4px solid #0277BD">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:28px">💻</div>
        <div>
          <div style="font-size:15px;font-weight:800;color:#03308B;margin-bottom:2px">Work Instructions — IT Access</div>
          <div style="font-size:12px;color:#0277BD;font-weight:600">You can view all instructions and add new tasks to existing categories. Category management is Admin only.</div>
        </div>
      </div>
    </div>`;
  } else {
    // === EMPLOYEE/HR: Read-only banner ===
    h += `<div class="card" style="background:linear-gradient(135deg,#E3F2FD 0%,#F0F4FA 100%);border-left:4px solid #1565C0">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:28px">📖</div>
        <div>
          <div style="font-size:15px;font-weight:800;color:#1B3A6B;margin-bottom:2px">Work Instructions — Reference Library</div>
          <div style="font-size:12px;color:#1565C0;font-weight:600">View-only access. Contact your administrator to add or modify content.</div>
        </div>
      </div>
    </div>`;
  }

  // Categories tabs (visible to everyone)
  h += `<div class="card">
    <div class="card-title">📚 Categories · ${cats.length}</div>
    ${cats.length === 0 ? `<div class="empty">${canEdit ? 'No categories. Add one above to begin.' : 'No instructions available yet. Please check back later.'}</div>` : `
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:${canEdit ? '8px' : '0'}">
        ${cats.map(c => `
          <div onclick="window.wiActiveCategory='${escapeHtml(c.name)}';render()" style="cursor:pointer;padding:8px 14px;background:${c.name===wiActiveCategory ? c.color : 'white'};color:${c.name===wiActiveCategory ? 'white' : c.color};border:2px solid ${c.color};border-radius:20px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;transition:all 0.2s">
            <span>${c.icon||"📁"}</span>
            <span>${escapeHtml(c.name)}</span>
            <span style="font-size:10px;background:${c.name===wiActiveCategory ? 'rgba(255,255,255,0.25)' : c.color+'22'};padding:1px 6px;border-radius:8px">${state.workTasks.filter(t=>t.category===c.name).length}</span>
          </div>
        `).join("")}
      </div>
      ${canEdit ? `
        <div style="display:flex;gap:6px;font-size:11px;flex-wrap:wrap">
          ${cats.map(c=>`<div style="display:flex;gap:4px"><button class="btn btn-sm btn-secondary" onclick="editWICategory('${c.id}')">✎ ${escapeHtml(c.name)}</button><button class="btn btn-sm btn-danger" onclick="delWICategory('${c.id}')">🗑</button></div>`).join("")}
        </div>
      ` : ''}
    `}
  </div>`;

  // Tasks for active category
  if(wiActiveCategory){
    const activeCat = cats.find(c => c.name === wiActiveCategory);
    const catColor = activeCat?.color || "#2E5FA3";

    // === ADMIN + IT: Add/Edit Task Form ===
    if(canAdd){
      if(!wiTaskForm) wiTaskForm = { name:"", category: wiActiveCategory, fileLink:"", fileName:"", description:"" };
      // Ensure form is for active category
      if(wiTaskForm.category !== wiActiveCategory && !wiTaskEditId){
        wiTaskForm = { name:"", category: wiActiveCategory, fileLink:"", fileName:"", description:"" };
      }

      h += `<div class="card" style="border-top:4px solid ${catColor}">
        <div class="sec-hdr">${wiTaskEditId?"Edit":"Add"} Task in <span style="color:${catColor}">${escapeHtml(wiActiveCategory)}</span></div>
        <div class="form-grid">
          <div class="field full"><label>Task Name <span class="req">*</span></label>
            <input value="${escapeHtml(wiTaskForm.name||"")}" oninput="window.wiTaskForm.name=this.value" placeholder="e.g., Switch Configuration, Router Reset, Cable Replacement"></div>
          <div class="field full"><label>Document Link (Google Drive / PDF / Word) <span style="color:var(--muted);font-weight:500">Optional</span></label>
            <input value="${escapeHtml(wiTaskForm.fileLink||"")}" oninput="window.wiTaskForm.fileLink=this.value" placeholder="https://drive.google.com/file/d/... or any sharable link"></div>
          <div class="field full"><label>Document Display Name</label>
            <input value="${escapeHtml(wiTaskForm.fileName||"")}" oninput="window.wiTaskForm.fileName=this.value" placeholder="e.g., Cisco Switch Manual.pdf, Datasheet.docx"></div>
          <div class="field full"><label>Workflow / Solution / Instructions <span class="req">*</span></label>
            <textarea rows="6" oninput="window.wiTaskForm.description=this.value" placeholder="Step-by-step instructions, troubleshooting workflow, how to handle this task..." style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;font-family:inherit;font-size:13px;resize:vertical">${escapeHtml(wiTaskForm.description||"")}</textarea>
            <div style="font-size:10px;color:var(--muted);margin-top:3px">${(wiTaskForm.description||"").length} chars · Markdown line breaks supported</div>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="saveWITask()">${wiTaskEditId?"Update Task":"Add Task"}</button>
          ${wiTaskEditId?`<button class="btn btn-ghost" onclick="cancelWITask()">Cancel</button>`:""}
        </div>
      </div>`;
    }

    // Tasks list (visible to everyone)
    h += `<div class="card">
      <div class="card-title" style="color:${catColor}">${activeCat?.icon||"📁"} ${escapeHtml(wiActiveCategory)} Tasks · ${activeTasks.length}</div>
      ${activeTasks.length === 0 ? `<div class="empty">${canEdit ? 'No tasks yet in this category. Add the first one above.' : 'No tasks in this category yet.'}</div>` : `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${activeTasks.map(t => `
            <div style="background:white;border:1px solid var(--line);border-left:4px solid ${catColor};border-radius:10px;padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
                <div style="flex:1">
                  <div style="font-size:15px;font-weight:700;color:#1B3A6B;margin-bottom:3px">${escapeHtml(t.name)}</div>
                  <div style="font-size:11px;color:var(--muted)">${escapeHtml(t.category)}${t.fileName ? ` · ${escapeHtml(t.fileName)}` : ''}</div>
                </div>
                ${canEdit ? `
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-sm btn-secondary" onclick="editWITask('${t.id}')" title="Edit">✎</button>
                    <button class="btn btn-sm btn-danger" onclick="delWITask('${t.id}')" title="Admin: Delete">🗑</button>
                  </div>
                ` : ''}
              </div>
              ${t.fileLink ? `
                <div style="margin-bottom:8px">
                  <a href="${escapeHtml(t.fileLink)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#E3F2FD;color:#1565C0;text-decoration:none;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #1565C0">
                    📄 ${escapeHtml(t.fileName||"Open document")}
                  </a>
                  ${canEdit ? `<button onclick="removeWITaskFile('${t.id}')" style="margin-left:6px;background:#FEE;color:#C53030;border:1px solid #C53030;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer" title="Admin: Remove file link">×</button>` : ''}
                </div>
              ` : ''}
              ${t.description ? `
                <div style="background:#F7FAFC;padding:10px 12px;border-radius:6px;font-size:12.5px;line-height:1.7;color:#1A202C;white-space:pre-wrap">${escapeHtml(t.description)}</div>
              ` : ''}
            </div>
          `).join("")}
        </div>
      `}
    </div>`;
  }

  return h;
}

// Technical Classifications — its own tab (under Settings). Same admin manager
// UI that previously lived inside Work Instructions.
function _pills(stateVar, views){
  const cur = window[stateVar] || views[0].id;
  return `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${views.map(v=>`<button onclick="window.${stateVar}='${v.id}';window.__navFade=true;render()" style="flex:1;min-width:86px;padding:10px 6px;border:none;border-radius:9px;font-weight:800;font-size:11.5px;cursor:pointer;background:${cur===v.id?'#03308B':'#E8EEF7'};color:${cur===v.id?'#C9A84C':'#1B3A6B'}">${v.ic} ${v.lb}</button>`).join("")}</div>`;
}

function renderTechClassifications(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const workTypes = (state.techWorkTypes||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const statuses  = (state.techStatuses||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const cats2     = (state.techCategories||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const tv = window._techView || "types";
  let h = _pills('_techView',[{id:"types",ic:"🔧",lb:"Work Types"},{id:"statuses",ic:"📊",lb:"Statuses"},{id:"categories",ic:"📁",lb:"Categories"}]);
  h += `
    <div class="card" style="margin-top:16px;border:2px solid #6A1B9A">
      <div class="card-title" style="color:#6A1B9A">⚙️ Technical Classifications (Resolution)</div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.6">
        These options appear in the <strong>Resolution</strong> section of Daily Log. Changes apply immediately to all employees.
      </p>
      ${(workTypes.length===0 && statuses.length===0 && cats2.length===0)?`
      <div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:12px;margin-bottom:14px">
        <p style="font-size:12px;color:#E65100;margin:0 0 8px;line-height:1.5"><strong>First time setup:</strong> Load the default classifications (Work Types, Statuses, Categories) to get started. You can edit them afterwards.</p>
        <button class="btn btn-sm" style="background:#E65100;color:white;border:none;font-weight:700" onclick="seedTechDefaults()">⬇ Load Default Classifications</button>
      </div>`:''}

      `;
  if(tv==="types")      h += `<!-- WORK TYPES -->
      <div style="margin-bottom:18px">
        <div style="font-weight:800;color:#3949AB;font-size:13px;margin-bottom:8px">🧭 Work Types</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${workTypes.length===0?`<span style="font-size:12px;color:#999">None yet</span>`:workTypes.map(w=>`
            <span style="display:inline-flex;align-items:center;gap:5px;background:#E8EAF6;color:#3949AB;padding:5px 8px 5px 12px;border-radius:14px;font-size:12px;font-weight:600">
              ${escapeHtml(w.name)}
              <button onclick="delTechItem('techWorkTypes','${w.id}')" style="background:#C5CAE9;border:none;color:#3949AB;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newWorkType" placeholder="Add work type (e.g. Standby)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:7px;font-size:12px">
          <button class="btn btn-sm" style="background:#3949AB;color:white;border:none;font-weight:700" onclick="addTechItem('techWorkTypes','newWorkType',${workTypes.length})">+ Add</button>
        </div>
      </div>

      `;
  if(tv==="statuses")   h += `<!-- TASK STATUSES -->
      <div style="margin-bottom:18px">
        <div style="font-weight:800;color:#00897B;font-size:13px;margin-bottom:8px">📊 Task Statuses</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${statuses.length===0?`<span style="font-size:12px;color:#999">None yet</span>`:statuses.map(s=>`
            <span style="display:inline-flex;align-items:center;gap:5px;background:#E0F2F1;color:#00897B;padding:5px 8px 5px 12px;border-radius:14px;font-size:12px;font-weight:600">
              ${escapeHtml(s.name)}
              <button onclick="delTechItem('techStatuses','${s.id}')" style="background:#B2DFDB;border:none;color:#00897B;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newStatus" placeholder="Add status (e.g. Waiting Parts)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:7px;font-size:12px">
          <button class="btn btn-sm" style="background:#00897B;color:white;border:none;font-weight:700" onclick="addTechItem('techStatuses','newStatus',${statuses.length})">+ Add</button>
        </div>
      </div>

      `;
  if(tv==="categories") h += `<!-- CATEGORIES + SUBCATEGORIES -->
      <div>
        <div style="font-weight:800;color:#C2185B;font-size:13px;margin-bottom:8px">🗂️ Categories & Subcategories</div>
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <input id="newCategory" placeholder="Add category (e.g. Wireless)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:7px;font-size:12px">
          <button class="btn btn-sm" style="background:#C2185B;color:white;border:none;font-weight:700" onclick="addTechCategory(${cats2.length})">+ Category</button>
        </div>
        ${cats2.map(c=>`
          <div style="border:1px solid #F8BBD0;border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#FFF5F8">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
              <div style="font-weight:800;color:#C2185B;font-size:13px">🗂️ ${escapeHtml(c.name)}</div>
              <button class="btn btn-sm btn-danger" onclick="delTechItem('techCategories','${c.id}')">🗑 Category</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
              ${(c.subcategories||[]).length===0?`<span style="font-size:11px;color:#aaa">No subcategories</span>`:(c.subcategories||[]).map((sc,si)=>`
                <span style="display:inline-flex;align-items:center;gap:4px;background:white;border:1px solid #F8BBD0;color:#880E4F;padding:4px 7px 4px 10px;border-radius:12px;font-size:11px;font-weight:600">
                  ${escapeHtml(sc)}
                  <button onclick="delSubcategory('${c.id}',${si})" style="background:#FCE4EC;border:none;color:#C2185B;width:16px;height:16px;border-radius:50%;cursor:pointer;font-weight:700;font-size:10px">×</button>
                </span>`).join("")}
            </div>
            <div style="display:flex;gap:5px">
              <input id="newSub_${c.id}" placeholder="Add subcategory" style="flex:1;padding:6px 9px;border:1px solid var(--line);border-radius:6px;font-size:11px">
              <button class="btn btn-sm" style="background:#AD1457;color:white;border:none;font-weight:700;font-size:11px" onclick="addSubcategory('${c.id}')">+ Sub</button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  h += `</div>`;
  return h;
}
async function saveWICategory(){
  if(!isAdmin()) return toast("Only Admin can save categories");
  const name=(wiCategoryForm.name||"").trim();
  if(!name) return toast("Category name is required");
  const dup=(state.workCategories||[]).find(c=>(c.name||"").trim().toLowerCase()===name.toLowerCase() && c.id!==wiCategoryEditId);
  if(dup) return toast("⚠ A category with this name already exists");
  await fbSave("workCategories",{
    id: wiCategoryEditId||undefined,
    name,
    icon: wiCategoryForm.icon||"📁",
    color: wiCategoryForm.color||"#2E5FA3",
  });
  toast(wiCategoryEditId?"Category updated ✓":"Category added ✓");
  wiCategoryForm=null; wiCategoryEditId=null; render();
}
function editWICategory(id){
  if(!isAdmin()) return toast("Only Admin can edit categories");
  const c = state.workCategories.find(x => x.id === id);
  if(c){ wiCategoryForm = {...c}; wiCategoryEditId = id; render(); window.scrollTo(0,0); }
}

async function delWICategory(id){
  if(!isAdmin()) return toast("Only Admin can delete categories");
  const c = state.workCategories.find(x => x.id === id);
  if(!c) return;
  const taskCount = state.workTasks.filter(t => t.category === c.name).length;
  let msg = `Delete category "${c.name}"?`;
  if(taskCount > 0) msg += `\n\n⚠️ This will also delete ${taskCount} task(s) inside it. This cannot be undone.`;
  if(!confirm(msg)) return;
  // Delete all tasks in this category first
  for(const t of state.workTasks.filter(t => t.category === c.name)){
    await fbDelete("workTasks", t.id);
  }
  await fbDelete("workCategories", id);
  if(wiActiveCategory === c.name) wiActiveCategory = "";
  toast(`Deleted category + ${taskCount} task(s)`);
}

function cancelWICategory(){ wiCategoryForm = null; wiCategoryEditId = null; render(); }

async function saveWITask(){
  if(!canAddWorkInstructions()) return toast("Only Admin and IT can add tasks");
  // IT cannot edit existing tasks, only add new ones
  if(wiTaskEditId && !canEditWorkInstructions()) return toast("Only Admin can edit existing tasks");
  const name = (wiTaskForm.name||"").trim();
  const desc = (wiTaskForm.description||"").trim();
  if(!name) return toast("Task name required");
  if(!desc) return toast("Task description / workflow required");
  if(!wiTaskForm.category) return toast("No category selected");
  // Validate link (if provided)
  const link = (wiTaskForm.fileLink||"").trim();
  if(link && !/^https?:\/\//i.test(link)){
    return toast("Document link must start with http:// or https://");
  }
  await fbSave("workTasks", {
    id: wiTaskEditId || undefined,
    name,
    category: wiTaskForm.category,
    fileLink: link,
    fileName: (wiTaskForm.fileName||"").trim(),
    description: desc,
    createdBy: state.profile.uid,
  });
  wiTaskForm = null;
  wiTaskEditId = null;
  toast("Task saved ✓");
}

function editWITask(id){
  if(!isAdmin()) return toast("Only Admin can edit tasks");
  const t = state.workTasks.find(x => x.id === id);
  if(t){
    wiTaskForm = {...t};
    wiTaskEditId = id;
    wiActiveCategory = t.category;
    render();
    window.scrollTo(0,0);
  }
}

async function delWITask(id){
  if(!isAdmin()) return toast("Only Admin can delete tasks");
  if(!confirm("Delete this task? This cannot be undone.")) return;
  await fbDelete("workTasks", id);
  toast("Task deleted");
}

async function removeWITaskFile(id){
  if(!isAdmin()) return toast("Only Admin can remove file links");
  const t = state.workTasks.find(x => x.id === id);
  if(!t) return;
  if(!confirm(`Remove the document link from task "${t.name}"?\n\nThe task itself will be kept, only the file link is removed.`)) return;
  await fbSave("workTasks", { ...t, id, fileLink:"", fileName:"" });
  toast("File link removed");
}

function cancelWITask(){ wiTaskForm = null; wiTaskEditId = null; render(); }

Object.assign(window, {
  saveWICategory, editWICategory, delWICategory, cancelWICategory,
  saveWITask, editWITask, delWITask, cancelWITask, removeWITaskFile,
});
Object.defineProperty(window,'wiCategoryForm',{get:()=>wiCategoryForm,set:v=>wiCategoryForm=v,configurable:true});
Object.defineProperty(window,'wiTaskForm',{get:()=>wiTaskForm,set:v=>wiTaskForm=v,configurable:true});
Object.defineProperty(window,'wiActiveCategory',{get:()=>wiActiveCategory,set:v=>wiActiveCategory=v,configurable:true});

// ═══════════════════════════════════════════════════════════════════════
//  SHARE — QR Code (Admin only)
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  BACKUP & RESTORE — JSON export/import for data safety
// ═══════════════════════════════════════════════════════════════════════
function exportBackup(){
  try{
    const backup = {
      version: "1.1",
      exportedAt: new Date().toISOString(),
      exportedBy: state.profile.email,
      projectId: "ejaftech-hr",
      data: {
        users: state.users,
        departments: state.departments,
        projects: state.projects,
        locations: state.locations,
        daily: state.daily,
        overtime: state.overtime,
        travel: state.travel,
        leaves: state.leaves,
        workCategories: state.workCategories,
        workTasks: state.workTasks,
        nametagEmployees: state.nametagEmployees,
      },
      counts: {
        users: state.users.length,
        departments: state.departments.length,
        projects: state.projects.length,
        locations: state.locations.length,
        daily: state.daily.length,
        overtime: state.overtime.length,
        travel: state.travel.length,
        leaves: state.leaves.length,
        workCategories: state.workCategories.length,
        workTasks: state.workTasks.length,
        nametagEmployees: (state.nametagEmployees||[]).length,
      }
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `EjafTech_Backup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded ✓ Save it safely!');
  }catch(e){
    console.error(e);
    toast('Backup failed: ' + e.message);
  }
}

async function importBackup(file){
  if(!file) return;
  if(!isAdmin()) return toast('Only admin can restore backups');
  try{
    const text = await file.text();
    const backup = JSON.parse(text);
    if(!backup.data) return toast('Invalid backup file');

    const total = (backup.counts.daily||0) + (backup.counts.overtime||0) + (backup.counts.travel||0) + (backup.counts.leaves||0);
    if(!confirm(`Restore backup from ${backup.exportedAt}?\n\nThis will ADD ${total} records to your current data.\n\nContinue?`)) return;

    const {db, doc, setDoc} = window.__fb;
    let restored = 0;

    // Restore each collection (including leaves)
    const cols = ['departments','projects','locations','daily','overtime','travel','leaves'];
    for(const col of cols){
      const items = backup.data[col] || [];
      for(const item of items){
        const {id, ...data} = item;
        if(id) {
          await setDoc(doc(db, col, id), data);
          restored++;
        }
      }
    }
    toast(`Restored ${restored} records ✓`);
  }catch(e){
    console.error(e);
    toast('Restore failed: ' + e.message);
  }
}
window.exportBackup = exportBackup;
window.importBackup = importBackup;

// ═══════════════════════════════════════════════════════════════════════
//  PROFILE PAGE — My Account, Change Password
// ═══════════════════════════════════════════════════════════════════════
/* profile state hoisted to top (TDZ fix) */

// ═══════════════════════════════════════════════════════════════════════
//  CLIENTS MODULE — Client companies, linked users, project assignment
// ═══════════════════════════════════════════════════════════════════════
/* client state hoisted to top (TDZ fix) */

