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
            ${colorChoices.map(c=>`<div onclick="window.wiCategoryForm.color='${c}';render()" style="width:28px;height:28px;border-radius:8px;background:${c};cursor:pointer;border:${c===wiCategoryForm.color?'3px solid #1B3A6B':'1px solid #E0E6ED'};box-shadow:0 2px 4px rgba(0,0,0,0.1)"></div>`).join("")}
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
          <div style="font-size:14px;font-weight:800;color:#03308B;margin-bottom:2px">Work Instructions — IT Access</div>
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
          <div style="font-size:14px;font-weight:800;color:#1B3A6B;margin-bottom:2px">Work Instructions — Reference Library</div>
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
          <div onclick="window.wiActiveCategory='${escapeHtml(c.name)}';render()" style="cursor:pointer;padding:8px 14px;background:${c.name===wiActiveCategory ? c.color : 'white'};color:${c.name===wiActiveCategory ? 'white' : c.color};border:2px solid ${c.color};border-radius:16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;transition:all 0.2s">
            <span>${c.icon||"📁"}</span>
            <span>${escapeHtml(c.name)}</span>
            <span style="font-size:10px;background:${c.name===wiActiveCategory ? 'rgba(255,255,255,0.25)' : c.color+'22'};padding:1px 6px;border-radius:8px">${state.workTasks.filter(t=>t.category===c.name).length}</span>
          </div>
        `).join("")}
      </div>
      ${canEdit ? `
        <div style="display:flex;gap:6px;font-size:11px;flex-wrap:wrap">
          ${cats.map(c=>`<div style="display:flex;gap:4px"><button class="btn btn-sm btn-secondary" onclick="editWICategory('${c.id}')">✎ ${escapeHtml(c.name)}</button><button class="btn btn-sm btn-danger" onclick="delWICategory('${c.id}')">${ICN.del}</button></div>`).join("")}
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
            <textarea rows="6" oninput="window.wiTaskForm.description=this.value" placeholder="Step-by-step instructions, troubleshooting workflow, how to handle this task..." style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font-family:inherit;font-size:13px;resize:vertical">${escapeHtml(wiTaskForm.description||"")}</textarea>
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
            <div style="background:var(--card);border:1px solid var(--line);border-left:4px solid ${catColor};border-radius:12px;padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
                <div style="flex:1">
                  <div style="font-size:14px;font-weight:700;color:#1B3A6B;margin-bottom:3px">${escapeHtml(t.name)}</div>
                  <div style="font-size:11px;color:var(--muted)">${escapeHtml(t.category)}${t.fileName ? ` · ${escapeHtml(t.fileName)}` : ''}</div>
                </div>
                ${canEdit ? `
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-sm btn-secondary" onclick="editWITask('${t.id}')" title="Edit">${ICN.edit}</button>
                    <button class="btn btn-sm btn-danger" onclick="delWITask('${t.id}')" title="Admin: Delete">${ICN.del}</button>
                  </div>
                ` : ''}
              </div>
              ${t.fileLink ? `
                <div style="margin-bottom:8px">
                  <a href="${escapeHtml(t.fileLink)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#E3F2FD;color:#1565C0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:700;border:1px solid #1565C0">
                    📄 ${escapeHtml(t.fileName||"Open document")}
                  </a>
                  ${canEdit ? `<button onclick="removeWITaskFile('${t.id}')" style="margin-left:6px;background:#FEE;color:#C53030;border:1px solid #C53030;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer" title="Admin: Remove file link">×</button>` : ''}
                </div>
              ` : ''}
              ${t.description ? `
                <div style="background:#F7FAFC;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.7;color:#1A202C;white-space:pre-wrap">${escapeHtml(t.description)}</div>
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
  return `<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">${views.map(v=>`<button onclick="window.${stateVar}='${v.id}';window.__navFade=true;render()" style="flex:1;min-width:86px;padding:10px 6px;border:none;border-radius:8px;font-weight:800;font-size:11px;cursor:pointer;background:${cur===v.id?'#03308B':'#E8EEF7'};color:${cur===v.id?'#C9A84C':'#1B3A6B'}">${v.ic} ${v.lb}</button>`).join("")}</div>`;
}

function renderTechClassifications(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const workTypes = (state.techWorkTypes||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const statuses  = (state.techStatuses||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const cats2     = (state.techCategories||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const tv = window._techView || "types";
  const systems = (state.systemTypes||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  let h = _pills('_techView',[{id:"types",ic:"🔧",lb:"Work Types"},{id:"statuses",ic:"📊",lb:"Statuses"},{id:"categories",ic:"📁",lb:"Categories"},{id:"systems",ic:"🧩",lb:"Systems"},{id:"checks",ic:"📋",lb:"Check Lists"},{id:"device",ic:"📱",lb:"This Device"},{id:"brand",ic:"🏷️",lb:"Document Branding"},{id:"green",ic:"🌱",lb:"Sustainability"}]);
  // ── This Device (v189) ──────────────────────────────────────────────
  // Appearance, notification permission and offline readiness were three
  // separate cards buried in the Profile screen. They share one trait that
  // nothing else in Settings shares: every one of them is a property of THE
  // PHONE IN YOUR HAND, not of the account or the company. Grouping them says
  // so, and explains why changing them affects nobody else.
  if(tv==="device"){
    const _sn = (typeof sysNotifsOn==="function") ? sysNotifsOn()
              : (typeof Notification!=="undefined" && Notification.permission==="granted");
    return h + `
    <div class="card">
      <div class="sec-hdr">\u{1F504} App version</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:800;color:var(--navy)">${typeof runningVersion==="function"?escapeHtml(runningVersion()):"\u2014"}</span>
        <button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="forceUpdate()">Update now</button>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.7">
        Use this whenever the update banner does not appear. It clears the cached program files and reloads, so it works even when the automatic check has failed. Your records are stored separately and are never touched.
      </div>
    </div>

    <div class="card" style="background:#F5F8FC;border:1px dashed var(--line)">
      <div style="font-size:12px;color:var(--muted);line-height:1.7">
        Everything on this tab applies to <strong>this device only</strong>. It is stored on the phone or computer you are using, not on your account, so changing it here affects nobody else and does not follow you to another device.
      </div>
    </div>
  <div class="card">
    <div class="sec-hdr">\u{1F3A8} Appearance</div>
    <p style="font-size:11px;color:var(--muted);line-height:1.7;margin-bottom:10px">
      The navy and gold of the brand never change \u2014 these change the surface they sit on.
      Saved on this device, because glare depends on where you are standing.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${PALETTES.map(p=>{const on=currentPalette()===p.id;
        return `<button onclick="setPalette('${p.id}')" title="${escapeHtml(p.note)}"
          style="flex:1;min-width:98px;text-align:right;background:${p.sw};border:${on?"2px solid var(--navy)":"1px solid var(--line)"};
                 border-radius:var(--r-md);padding:10px;cursor:pointer">
          <div style="display:flex;gap:5px;margin-bottom:6px">
            <span style="width:16px;height:16px;border-radius:4px;background:#1B3A6B"></span>
            <span style="width:16px;height:16px;border-radius:4px;background:#C9A84C"></span>
            <span style="width:16px;height:16px;border-radius:4px;background:#fff;border:1px solid rgba(0,0,0,.12)"></span>
          </div>
          <div style="font-size:11px;font-weight:800;color:#1A1A2E">${on?"\u2713 ":""}${escapeHtml(p.lb)}</div>
          <div style="font-size:9px;color:#6B7B8F;line-height:1.5;margin-top:2px">${escapeHtml(p.note)}</div>
        </button>`;}).join("")}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);flex-wrap:wrap">
      <span style="font-size:11px;color:var(--muted)">Night shift?</span>
      <button class="btn btn-sm btn-secondary" onclick="toggleTheme();render()">\u{1F319} Toggle dark mode</button>
      <span style="font-size:10px;color:var(--muted)">Dark overrides the palette while it is on.</span>
    </div>
  </div>
  ${isAdmin()?(()=>{ const src=(window.__fb&&window.__fb.sdkSource)||"unknown";
    const ok = src==="bundled" || src==="mirror";
    return `<div class="card" style="border-left:4px solid ${ok?'var(--ok)':'var(--warn)'}">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:var(--f-sm);padding:2px 8px;border-radius:var(--r-md);font-weight:800">📡</span> Offline readiness</div>
      <p style="font-size:var(--f-md);color:var(--muted);margin:8px 0 0;line-height:1.65">Engine loaded via <strong style="color:${ok?'var(--ok)':'var(--warn)'}">${escapeHtml(src)}</strong>.<br>${
        src==="bundled" ? "✅ Guaranteed — the engine ships with the app, so it starts with no signal at all."
        : src==="mirror" ? "✅ Cached on this device — offline launch should work."
        : "⚠️ Loaded straight from the internet, so a cold start with no signal will fail. Put the three Firebase SDK files in a <strong>sdk/</strong> folder beside index.html to fix this permanently."}</p>
    </div>`; })():""}
  <div class="card" style="border-left:4px solid ${_sn?'#2E7D32':'#C9A84C'}">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px"><span style="background:#C9A84C;color:#1B3A6B;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:800">05</span> 🔔 Device Notifications ${_sn?'<span style="font-size:10px;background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:8px;font-weight:800">ON</span>':''}</div>
    <p style="font-size:12px;color:var(--muted);margin:8px 0 12px">Task assignments & alerts appear in your phone's notification tray with sound — while the app is open or in the background.</p>
    ${_sn?`<button class="btn btn-secondary" onclick="disableSysNotifs()">Turn off</button>`
         :`<button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none" onclick="enableSysNotifs()">🔔 Enable</button>`}
  </div>`;
  }

  // ── Document Branding (v206) ────────────────────────────────────────
  // What every exported document says about itself. Kept beside the other
  // company-wide classifications rather than in personal settings, because a
  // report footer is a company decision, not a preference.
  if(tv==="brand"){
    if(!isAdmin()) return h + `<div class="card"><div class="empty">Admin only.</div></div>`;
    const b=brandDraft();
    const F=(k,label,ph,note)=>`<div class="field" style="grid-column:1/-1">
      <label>${escapeHtml(label)}</label>
      <input value="${escapeHtml(String(b[k]==null?"":b[k]))}" oninput="brandSet(${jsArg(k)},this.value)" placeholder="${escapeHtml(ph||"")}">
      ${note?`<div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">${note}</div>`:""}
    </div>`;
    const SW=(k,label,note)=>`<div class="field" style="grid-column:1/-1">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
        <input type="checkbox" ${b[k]?"checked":""} onchange="brandSet(${jsArg(k)},this.checked)">
        ${escapeHtml(label)}
      </label>
      ${note?`<div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">${note}</div>`:""}
    </div>`;
    return h + `
    <div class="card" style="background:#F5F8FC;border:1px dashed var(--line)">
      <div style="font-size:12px;color:var(--muted);line-height:1.7">
        These lines appear on <strong>every</strong> exported document \u2014 PDF and Word alike. A report you send to a client is your company's document, so nothing here is fixed: clear a field to remove that line entirely.
      </div>
    </div>

    <div class="card">
      <div class="sec-hdr">\u{1F4C4} Header</div>
      ${SW("showSubtitle","Show a subtitle under the report title","Turn this off for a header that carries only the report name and your logo.")}
      ${b.showSubtitle?F("subtitle","Subtitle","e.g. EJAF Technology \u00b7 Operations",
        "Printed in small type beneath the report title."):""}
    </div>

    <div class="card">
      <div class="sec-hdr">\u{1F4CB} Footer</div>
      ${F("footerLeft","Left footer","e.g. EJAF Technology","The first line at the bottom left of every page.")}
      ${SW("showFooterNote","Show a generation note","")}
      ${b.showFooterNote?F("footerNote","Generation note","e.g. Automatically generated",""):""}
      ${SW("showFooterRight","Show a line at the bottom right","The document reference number always prints here, with or without this text.")}
      ${b.showFooterRight?F("footerRight","Right footer","e.g. Powered by Siwar",""):""}
    </div>

    <div class="card">
      <div class="sec-hdr">\u{1F512} Confidentiality</div>
      ${SW("confidential","Mark documents confidential",
        "Off by default and deliberately so. A mark that appears on every routine maintenance sheet is ignored within a week \u2014 and then it carries no weight on the document where it genuinely matters. Switch it on when the content warrants it.")}
      ${b.confidential?F("confidentialText","Wording","Confidential",
        "e.g. \u201cConfidential\u201d, \u201cCommercial in Confidence\u201d, \u201c\u0633\u0631\u064a\u201d."):""}
    </div>

    <div class="card">
      <div class="sec-hdr">\u{1F441}\uFE0F Preview</div>
      <div style="border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden">
        <div style="padding:10px 12px;border-bottom:1px solid var(--line);background:var(--surface-2)">
          <div style="font-size:13px;font-weight:800;color:var(--navy)">INCIDENT REPORT</div>
          <div id="bpSub" style="font-size:10px;color:var(--muted);margin-top:2px">${(b.showSubtitle && String(b.subtitle||"").trim())?escapeHtml(String(b.subtitle).trim()):""}</div>
        </div>
        <div style="padding:18px 12px;text-align:center;font-size:11px;color:var(--muted)">\u2026 report body \u2026</div>
        <div style="display:flex;gap:10px;padding:9px 12px;border-top:1px solid var(--line);font-size:9.5px;color:var(--muted);flex-wrap:wrap">
          <div id="bpLeft" style="flex:1;min-width:140px;line-height:1.6">${brandFooterLeft()||"<em>(empty)</em>"}</div>
          <div id="bpRight" style="text-align:right">${(b.showFooterRight && String(b.footerRight||"").trim())?escapeHtml(String(b.footerRight).trim())+" \u00b7 ":""}INC-2026-0001</div>
        </div>
      </div>
      <button class="btn btn-sm btn-secondary" style="margin-top:10px" onclick="brandReset()">Reset to the defaults</button>
    </div>

    <div class="card brand-save${brandDirty()?" dirty":""}">
      ${brandDirty()
        ? `<div style="font-size:12px;color:#8F6E22;line-height:1.7;margin-bottom:10px">
             \u270e You have unsaved changes. Nothing on any report changes until you save \u2014 and when you do, it changes for everyone.
           </div>
           <div style="display:flex;gap:8px;flex-wrap:wrap">
             <button class="btn btn-primary" onclick="brandSave()">Save changes</button>
             <button class="btn btn-secondary" onclick="brandDiscard()">Discard</button>
           </div>`
        : `<div style="font-size:12px;color:var(--muted);line-height:1.7">\u2713 Saved. Every report will use the wording shown above.</div>`}
    </div>`;
  }

  // ── Sustainability factors (v216) ───────────────────────────────────
  // Published as editable defaults on purpose. A carbon figure derived from a
  // factor nobody can see or change would not survive its first challenge, and
  // a client reporting under a specific scheme needs to use that scheme's
  // numbers rather than ours.
  if(tv==="green"){
    if(!isAdmin()) return h + `<div class="card"><div class="empty">Admin only.</div></div>`;
    const g=co2Cfg();
    const N=(k,label,unit,note)=>`<div class="field">
      <label>${escapeHtml(label)}${unit?` <span style="font-weight:500;color:var(--muted);font-size:10px">${escapeHtml(unit)}</span>`:""}</label>
      <input value="${escapeHtml(String(g[k]))}" oninput="co2Set(${jsArg(k)},this.value)" inputmode="decimal">
      ${note?`<div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">${escapeHtml(note)}</div>`:""}
    </div>`;
    return h + `
    <div class="card" style="background:#F5F8FC;border:1px dashed var(--line)">
      <div style="font-size:12px;color:var(--muted);line-height:1.75">
        The environmental footprint is calculated from records the app already holds \u2014 fuel in the expense ledger and in reimbursement claims, and travel days. Nothing has to be entered twice.
        <br><br>These factors are broad public averages. If you report under a client's own scheme, replace them with that scheme's figures: every number the app prints is derived from what is set here.
      </div>
    </div>

    <div class="card">
      <div class="sec-hdr">\u26FD Fuel</div>
      <div class="form-grid">
        <div class="field"><label>Fuel used</label>
          <select onchange="co2Set('fuelType',this.value)">
            <option value="diesel" ${g.fuelType==="diesel"?"selected":""}>Diesel</option>
            <option value="petrol" ${g.fuelType==="petrol"?"selected":""}>Petrol</option>
          </select></div>
        ${N("litrePrice","Price per litre", curBase(), "Fuel is recorded as spend, not as volume; this converts one to the other.")}
        ${N("dieselPerLitre","Diesel", "kg CO\u2082e per litre","")}
        ${N("petrolPerLitre","Petrol", "kg CO\u2082e per litre","")}
      </div>
    </div>

    <div class="card">
      <div class="sec-hdr">\u2708\uFE0F Travel</div>
      <div class="form-grid">
        ${N("kmPerTravelDay","Distance per travel day","km","Used where a trip was recorded but no fuel receipt exists.")}
        ${N("co2PerKm","Vehicle","kg CO\u2082e per km","")}
      </div>
    </div>

    <div class="card">
      <div class="sec-hdr">\u{1F441}\uFE0F Across every project</div>
      ${(function(){
        const f=footprintFor("");
        if(!f.totalCo2) return `<div style="font-size:11px;color:var(--muted);line-height:1.7">Nothing to report yet \u2014 no fuel or travel has been recorded.</div>`;
        return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px">
          <div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:17px;font-weight:800;color:#2E7D32">${f.tonnes}</div>
            <div style="font-size:10px;color:var(--muted)">tonnes CO\u2082e</div></div>
          <div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:17px;font-weight:800">${f.litres.toLocaleString()}</div>
            <div style="font-size:10px;color:var(--muted)">litres</div></div>
          <div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:17px;font-weight:800">${f.travelKm.toLocaleString()}</div>
            <div style="font-size:10px;color:var(--muted)">km</div></div>
        </div>`;
      })()}
    </div>`;
  }

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
  if(tv==="checks"){
    const ct=window._chkTpl||"cctv";
    const tpl=chkGroup(ct);
    const items=getSysCheckItems(ct);
    const custom=(state.systemChecks||[]).filter(x=>x.template===ct).slice().sort((a,b)=>(a.order||0)-(b.order||0));
    h += `<!-- SYSTEM CHECK LISTS -->
      <div style="margin-bottom:14px">
        <div style="font-weight:800;color:#1B3A6B;font-size:13px;margin-bottom:8px">📋 Inspection Check Lists <span style="font-weight:500;font-size:11px;color:var(--muted)">— used by Technical Report → System Reports</span></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          ${chkGroups().map(t=>`<button class="btn btn-sm ${ct===t.id?"":"btn-secondary"}" style="${ct===t.id?`background:${t.color};color:#fff;border:none;`:""}font-weight:700" onclick="window._chkTpl='${t.id}';render()">${t.icon} ${escapeHtml(t.short||t.name.split(" ")[0])}</button>`).join("")}
        </div>
        <div style="background:#F5F8FC;border-left:3px solid ${tpl.color};border-radius:8px;padding:10px 12px;margin-bottom:10px">
          <div style="font-size:12px;font-weight:800;color:#1B3A6B">${tpl.icon} ${escapeHtml(tpl.name)}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.6">📐 ${escapeHtml(tpl.standards||"")}</div>
          <div style="font-size:10px;margin-top:6px;color:${custom.length?"#00695C":"#8A6D00"};font-weight:700">${custom.length?`✏️ Customised — ${custom.length} item(s)`:`📘 Using the ${(tpl.checks||[]).length} standards defaults`}</div>
        </div>
        <div style="display:grid;gap:5px;margin-bottom:10px">
          ${items.map((it,i)=>{
            const rec=custom[i];
            return `<div style="display:flex;align-items:center;gap:8px;background:var(--card,#fff);border:1px solid var(--line);border-radius:8px;padding:7px 10px">
              <span style="font-size:10px;font-weight:800;color:var(--muted);min-width:20px">${String(i+1).padStart(2,"0")}</span>
              <span style="flex:1;font-size:12px">${escapeHtml(it)}</span>
              ${rec?`<button onclick="delTechItem('systemChecks','${rec.id}')" style="background:#FDECEA;border:none;color:#C62828;width:20px;height:20px;border-radius:50%;cursor:pointer;font-weight:800;font-size:11px">×</button>`:""}
            </div>`;}).join("")}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <input id="newSysCheck" placeholder="Add a check item…" style="flex:1;min-width:170px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px">
          <button class="btn btn-sm" style="background:${tpl.color};color:#fff;border:none;font-weight:700" onclick="addSysCheck('${ct}',${items.length})">+ Add</button>
          ${custom.length?`<button class="btn btn-sm btn-secondary" onclick="resetSysChecks('${ct}')">↺ Restore defaults</button>`
                         :`<button class="btn btn-sm btn-secondary" onclick="cloneSysDefaults('${ct}')">✏️ Edit defaults</button>`}
        </div>
        <p style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.6">Leave untouched to keep the standards-based defaults. "Edit defaults" copies them in so you can add, remove or reword any item; "Restore defaults" clears your copy.</p>
      </div>`;
  }
  if(tv==="systems") h += `<!-- SYSTEMS -->
      <div style="margin-bottom:18px">
        <div style="font-weight:800;color:#00695C;font-size:13px;margin-bottom:8px">🧩 Systems <span style="font-weight:500;font-size:11px;color:var(--muted)">— used by device records & Maintenance / Incident reports (e.g. Fire Alarm, CCTV, ELV)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${systems.length===0?`<span style="font-size:12px;color:#999">None yet — e.g. Fire Alarm · CCTV · ELV · Access Control · Public Address · Networking</span>`:systems.map(w=>`
            <span style="display:inline-flex;align-items:center;gap:5px;background:#E0F2F1;color:#00695C;padding:5px 8px 5px 12px;border-radius:16px;font-size:12px;font-weight:600">
              ${escapeHtml(w.name)}
              <button onclick="delTechItem('systemTypes','${w.id}')" style="background:#B2DFDB;border:none;color:#00695C;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newSystemType" placeholder="Add system (e.g. Fire Alarm)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px">
          <button class="btn btn-sm" style="background:#00695C;color:white;border:none;font-weight:700" onclick="addTechItem('systemTypes','newSystemType',${systems.length})">+ Add</button>
        </div>
      </div>`;
  if(tv==="types")      h += `<!-- WORK TYPES -->
      <div style="margin-bottom:18px">
        <div style="font-weight:800;color:#3949AB;font-size:13px;margin-bottom:8px">🧭 Work Types</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${workTypes.length===0?`<span style="font-size:12px;color:#999">None yet</span>`:workTypes.map(w=>`
            <span style="display:inline-flex;align-items:center;gap:5px;background:#E8EAF6;color:#3949AB;padding:5px 8px 5px 12px;border-radius:16px;font-size:12px;font-weight:600">
              ${escapeHtml(w.name)}
              <button onclick="delTechItem('techWorkTypes','${w.id}')" style="background:#C5CAE9;border:none;color:#3949AB;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newWorkType" placeholder="Add work type (e.g. Standby)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px">
          <button class="btn btn-sm" style="background:#3949AB;color:white;border:none;font-weight:700" onclick="addTechItem('techWorkTypes','newWorkType',${workTypes.length})">+ Add</button>
        </div>
      </div>

      `;
  if(tv==="statuses")   h += `<!-- TASK STATUSES -->
      <div style="margin-bottom:18px">
        <div style="font-weight:800;color:#00897B;font-size:13px;margin-bottom:8px">📊 Task Statuses</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
          ${statuses.length===0?`<span style="font-size:12px;color:#999">None yet</span>`:statuses.map(s=>`
            <span style="display:inline-flex;align-items:center;gap:5px;background:#E0F2F1;color:#00897B;padding:5px 8px 5px 12px;border-radius:16px;font-size:12px;font-weight:600">
              ${escapeHtml(s.name)}
              <button onclick="delTechItem('techStatuses','${s.id}')" style="background:#B2DFDB;border:none;color:#00897B;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
            </span>`).join("")}
        </div>
        <div style="display:flex;gap:6px">
          <input id="newStatus" placeholder="Add status (e.g. Waiting Parts)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px">
          <button class="btn btn-sm" style="background:#00897B;color:white;border:none;font-weight:700" onclick="addTechItem('techStatuses','newStatus',${statuses.length})">+ Add</button>
        </div>
      </div>

      `;
  if(tv==="categories") h += `<!-- CATEGORIES + SUBCATEGORIES -->
      <div>
        <div style="font-weight:800;color:#C2185B;font-size:13px;margin-bottom:8px">🗂️ Categories & Subcategories</div>
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <input id="newCategory" placeholder="Add category (e.g. Wireless)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:8px;font-size:12px">
          <button class="btn btn-sm" style="background:#C2185B;color:white;border:none;font-weight:700" onclick="addTechCategory(${cats2.length})">+ Category</button>
        </div>
        ${cats2.map(c=>`
          <div style="border:1px solid #F8BBD0;border-radius:12px;padding:10px 12px;margin-bottom:8px;background:#FFF5F8">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
              <div style="font-weight:800;color:#C2185B;font-size:13px">🗂️ ${escapeHtml(c.name)}</div>
              <button class="btn btn-sm btn-danger" onclick="delTechItem('techCategories','${c.id}')">🗑 Category</button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
              ${(c.subcategories||[]).length===0?`<span style="font-size:11px;color:#aaa">No subcategories</span>`:(c.subcategories||[]).map((sc,si)=>`
                <span style="display:inline-flex;align-items:center;gap:4px;background:var(--card);border:1px solid #F8BBD0;color:#880E4F;padding:4px 7px 4px 10px;border-radius:12px;font-size:11px;font-weight:600">
                  ${escapeHtml(sc)}
                  <button onclick="delSubcategory('${c.id}',${si})" style="background:#FCE4EC;border:none;color:#C2185B;width:16px;height:16px;border-radius:50%;cursor:pointer;font-weight:700;font-size:10px">×</button>
                </span>`).join("")}
            </div>
            <div style="display:flex;gap:5px">
              <input id="newSub_${c.id}" placeholder="Add subcategory" style="flex:1;padding:6px 9px;border:1px solid var(--line);border-radius:8px;font-size:11px">
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
  if(!await uiConfirm(msg)) return;
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
  saveToast("Task saved ✓");
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
  if(!await uiConfirm("Delete this task? This cannot be undone.")) return;
  await fbDelete("workTasks", id);
  toast("Task deleted");
}

async function removeWITaskFile(id){
  if(!isAdmin()) return toast("Only Admin can remove file links");
  const t = state.workTasks.find(x => x.id === id);
  if(!t) return;
  if(!await uiConfirm(`Remove the document link from task "${t.name}"?\n\nThe task itself will be kept, only the file link is removed.`)) return;
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
// ═══ BACKUP ═══════════════════════════════════════════════════
// This used to list its collections by hand: 11 of the app's 38 were exported
// and only 7 were ever restored. The asset register, every client, every
// maintenance schedule, all incidents, the technical classifications and the
// whole commercial ledger were absent — so a "successful" restore still lost
// most of the business. Both routines now walk SYNC_COLLECTIONS, the same list
// the live listeners use, which means a collection added tomorrow is protected
// the day it is added rather than the day someone discovers it was not.
function backupCollections(){
  return (window.SYNC_COLLECTIONS && window.SYNC_COLLECTIONS.length)
    ? window.SYNC_COLLECTIONS.slice()
    : Object.keys(state).filter(k=>Array.isArray(state[k]));
}

function exportBackup(){
  try{
    const cols = backupCollections();
    const data = {}, counts = {};
    let total = 0, empty = [];
    cols.forEach(c=>{
      const rows = Array.isArray(state[c]) ? state[c] : [];
      data[c] = rows; counts[c] = rows.length; total += rows.length;
      if(!rows.length) empty.push(c);
    });
    const backup = {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      exportedBy: (state.profile && state.profile.email) || "",
      projectId: "ejaftech-hr",
      appVersion: (typeof APP_VER!=="undefined") ? APP_VER : "",
      collections: cols,
      data, counts, total,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `girek-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    toast(`\u2713 Backup: ${total} record(s) across ${cols.length} collection(s)`);
  }catch(e){
    console.error(e);
    toast("Backup failed: " + e.message);
  }
}

async function importBackup(file){
  if(!file) return;
  if(!isAdmin()) return toast("Only admin can restore backups");
  let backup;
  try{
    backup = JSON.parse(await file.text());
  }catch(e){ return toast("That file is not valid JSON"); }
  if(!backup || !backup.data) return toast("Invalid backup file");

  // Restore whatever the FILE holds, intersected with what the app knows about.
  // An old v1.1 file still restores its 11 collections; a v2.0 file restores all.
  const known = backupCollections();
  const cols  = Object.keys(backup.data).filter(c=>known.includes(c) && Array.isArray(backup.data[c]));
  const skipped = Object.keys(backup.data).filter(c=>!known.includes(c));
  const total = cols.reduce((s,c)=>s+backup.data[c].length,0);
  if(!total) return toast("That backup contains no records");

  const detail = cols.filter(c=>backup.data[c].length)
    .map(c=>`  ${c}: ${backup.data[c].length}`).join("\n");
  if(!await uiConfirm(
      `Restore the backup taken on ${String(backup.exportedAt||"").slice(0,10)}?\n\n` +
      `${total} record(s) across ${cols.length} collection(s):\n${detail}\n\n` +
      `Records with the same id are OVERWRITTEN; anything not in the file is left alone.` +
      (skipped.length?`\n\nIgnored (unknown to this version): ${skipped.join(", ")}`:""),
      {danger:true, okText:"Restore", title:"Restore backup"})) return;

  const {db, doc, setDoc} = window.__fb;
  let done=0, failed=0;
  for(const col of cols){
    for(const item of backup.data[col]){
      const {id, ...rest} = item || {};
      if(!id){ failed++; continue; }
      try{ await setDoc(doc(db, col, id), rest); done++; }
      catch(e){ failed++; }
    }
  }
  if(failed) toast(`\u26a0 Restored ${done}, failed ${failed} \u2014 check the console`);
  else saveToast(`Restored ${done} record(s) across ${cols.length} collection(s) \u2713`);
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


// ── System check-list editing (Technical Classifications → Check Lists) ──
window.addSysCheck=async function(tpl,order){
  const el=document.getElementById("newSysCheck");
  const name=(el&&el.value||"").trim();
  if(!name) return toast("⚠ Type the check item first");
  await fbSave("systemChecks",{template:tpl,name,order:order||0});
  if(el) el.value="";
  saveToast("✓ Check item added");
  render();
};
// Copy the standards defaults into editable records so they can be reworded
window.cloneSysDefaults=async function(tpl){
  const defs=sysTemplate(tpl).checks||[];
  if(!await uiConfirm(`Copy the ${defs.length} standard items for editing?\n\nYou can then reword or delete any of them.`)) return;
  for(let i=0;i<defs.length;i++) await fbSave("systemChecks",{template:tpl,name:defs[i],order:i});
  toast("✏️ Defaults copied — edit freely");
  render();
};
window.resetSysChecks=async function(tpl){
  const mine=(state.systemChecks||[]).filter(x=>x.template===tpl);
  if(!mine.length) return;
  if(!await uiConfirm(`Remove your ${mine.length} custom item(s) and go back to the standards defaults?`)) return;
  for(const r of mine) await fbDelete("systemChecks",r.id);
  toast("↺ Standards defaults restored");
  render();
};

// ── Document branding writes ─────────────────────────────────────────────
// Saved to settings/branding so it applies to every device and every user:
// two people exporting the same report must produce the same document.
// Pending edits, held until the person saves. A footer that syncs while it is
// being typed is a footer that other people see half-written.
window._brandDraft = window._brandDraft || null;
function brandDraft(){
  if(!window._brandDraft){
    const cur=(state.settingsDocs||[]).find(x=>x.id==="branding")||{};
    window._brandDraft={...brandCfg(), ...{}, id:"branding"};
    Object.keys(cur).forEach(k=>{ if(k!=="id") window._brandDraft[k]=cur[k]; });
  }
  return window._brandDraft;
}
function brandDirty(){
  if(!window._brandDraft) return false;
  const saved=brandCfg();
  return Object.keys(BRAND_DEFAULTS).some(k=>String(window._brandDraft[k])!==String(saved[k]));
}
Object.assign(window,{brandDraft, brandDirty});

window.brandSet = async function(key, value){
  if(!isAdmin()) return toast("Admin only");
  if(!Object.prototype.hasOwnProperty.call(BRAND_DEFAULTS, key)) return;
  const isBool = (typeof BRAND_DEFAULTS[key]==="boolean");
  const v = isBool ? !!value : String(value==null?"":value);
  const d=brandDraft();
  d[key]=v;

  if(isBool){
    // A switch changes WHICH fields exist, so the section genuinely has to be
    // rebuilt. There is no caret to lose on a checkbox.
    render();
  }else{
    // Typing must not rebuild anything. Repainting the page on every keystroke
    // discards the caret, scrolls back to the top and makes the screen jump.
    // Only the preview needs to move, and it can be written in place.
    brandRepaintPreview();
  }
  // Nothing is written here. The person decides when the wording is finished
  // and presses Save; until then this is a draft on their screen only.
};
window.brandSave = async function(){
  if(!isAdmin()) return toast("Admin only");
  if(!window._brandDraft) return;
  const doc={id:"branding"};
  Object.keys(BRAND_DEFAULTS).forEach(k=>{ doc[k]=window._brandDraft[k]; });
  state.settingsDocs=[...(state.settingsDocs||[]).filter(x=>x.id!=="branding"), doc];
  window._brandDraft=null;
  render();
  try{ await fbSave("settings", doc); saveToast("Document branding saved \u2713"); }
  catch(e){ toast("Could not save: "+(e&&e.message||e)); }
};
window.brandDiscard = function(){
  window._brandDraft=null;
  render();
  toast("Changes discarded");
};
// Update just the two lines of the preview, leaving the form untouched.
function brandRepaintPreview(){
  const b=brandCfg();
  const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
  set("bpSub", (b.showSubtitle && String(b.subtitle||"").trim())
    ? escapeHtml(String(b.subtitle).trim()) : "");
  set("bpLeft", brandFooterLeft() || "<em>(empty)</em>");
  set("bpRight", ((b.showFooterRight && String(b.footerRight||"").trim())
    ? escapeHtml(String(b.footerRight).trim())+" \u00b7 " : "") + "INC-2026-0001");
  const bl=document.querySelector(".bl-txt");
  if(bl && typeof brandLink==="function"){
    const tmp=document.createElement("div"); tmp.innerHTML=brandLink();
    const src=tmp.querySelector(".bl-txt");
    if(src) bl.innerHTML=src.innerHTML;
  }
}
Object.assign(window,{brandRepaintPreview});
window.brandReset = async function(){
  if(!isAdmin()) return toast("Admin only");
  if(!await uiConfirm("Restore the default wording on every document?\n\nThe subtitle, both footer lines and the confidentiality setting all return to how they started.")) return;
  const doc={id:"branding", ...BRAND_DEFAULTS};
  state.settingsDocs=[...(state.settingsDocs||[]).filter(x=>x.id!=="branding"), doc];
  render();
  try{ await fbSave("settings", doc); saveToast("Branding reset \u2713"); }
  catch(e){ toast("Could not save: "+(e&&e.message||e)); }
};
