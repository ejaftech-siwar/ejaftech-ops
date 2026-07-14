async function parseImportFile(file, deptName){
  toast("Reading file...");
  try{
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
    if(rows.length < 2) return toast("File looks empty");

    // Detect columns from the header row (flexible naming, English + Arabic)
    const header = rows[0].map(h=>String(h||"").trim());
    const headerLow = header.map(h=>h.toLowerCase());
    const findCol = (...names)=>{
      for(const n of names){ const i = headerLow.findIndex(h=>h.includes(n)); if(i>=0) return i; }
      return -1;
    };
    const ci = {
      project: findCol("project","مشروع","proj"),
      area:    findCol("area","منطقة","zone","region"),
      site:    findCol("site","موقع","location","loc"),
      status:  findCol("status","حالة","state","active"),
    };

    // If the Project column wasn't auto-detected, ask the user to map columns.
    if(ci.project < 0){
      showColumnMapper(rows, header, deptName);
      return;
    }

    const map = buildImportMap(rows, ci);
    finishImport(map, deptName);
  }catch(err){
    console.error(err);
    toast("Import failed: "+(err.message||"bad file"));
  }
}

// Parse a status cell into a boolean (active). Accepts yes/no, active/inactive, true/false, 1/0.
function parseStatusActive(val){
  const s = String(val||"").trim().toLowerCase();
  if(["inactive","no","false","0","off","disabled","معطل","غير نشط","لا"].includes(s)) return false;
  return true; // default active
}

// Build the structured map from rows + column indices
// Shape: { project: { areas: { areaName: { active, sites: { siteName: active } } } } }
function buildImportMap(rows, ci){
  const map = {};
  for(let r=1; r<rows.length; r++){
    const row = rows[r];
    const pName = String(row[ci.project]||"").trim();
    if(!pName) continue;
    const aName = ci.area>=0 ? String(row[ci.area]||"").trim() : "General";
    const sName = ci.site>=0 ? String(row[ci.site]||"").trim() : "";
    const active = ci.status>=0 ? parseStatusActive(row[ci.status]) : true;
    const areaKey = aName || "General";
    if(!map[pName]) map[pName] = {};
    if(!map[pName][areaKey]) map[pName][areaKey] = {active:true, sites:{}};
    if(sName){
      map[pName][areaKey].sites[sName] = active;
    } else {
      // row defines just an area (its status applies to the area)
      map[pName][areaKey].active = active;
    }
  }
  return map;
}

// Confirm summary then merge
function finishImport(map, deptName){
  const projNames = Object.keys(map);
  if(projNames.length===0) return toast("No valid rows found");
  let totalAreas=0, totalSites=0;
  projNames.forEach(p=>{ const areas=Object.keys(map[p]); totalAreas+=areas.length; areas.forEach(a=>totalSites+=Object.keys(map[p][a].sites).length); });
  if(!confirm(`Import into "${deptName}"?\n\n• ${projNames.length} project(s)\n• ${totalAreas} area(s)\n• ${totalSites} site(s)\n\nThis ADDS to existing data (merge).`)) return;
  mergeImport(map, deptName);
}

// ── Smart fallback: let the user map which column is which ──
let _importRows = null, _importDept = "";
function showColumnMapper(rows, header, deptName){
  _importRows = rows; _importDept = deptName;
  const opts = (selId)=> header.map((h,i)=>`<option value="${i}">${escapeHtml(h||('Column '+(i+1)))}</option>`).join("");
  const existing = document.getElementById('colMapOverlay');
  if(existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'colMapOverlay';
  wrap.innerHTML = `
  <div onclick="if(event.target===this)document.getElementById('colMapOverlay').remove()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto">
    <div style="background:white;border-radius:16px;max-width:480px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,0.4);margin-top:30px">
      <div style="background:#00897B;color:white;padding:16px 20px;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:16px;font-weight:800">🔗 Match Your Columns</div>
        <button onclick="document.getElementById('colMapOverlay').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;font-weight:700">×</button>
      </div>
      <div style="padding:20px">
        <p style="font-size:12px;color:#555;margin-bottom:16px;line-height:1.6">We could not detect the columns automatically. Tell us which column is which (importing into <strong>${escapeHtml(deptName)}</strong>):</p>
        <div class="field"><label>📁 Project column <span style="color:#c62828">*</span></label>
          <select id="mapProject" style="width:100%;padding:9px;border:1px solid var(--line);border-radius:8px">${opts()}</select></div>
        <div class="field"><label>🗺️ Area column (optional)</label>
          <select id="mapArea" style="width:100%;padding:9px;border:1px solid var(--line);border-radius:8px"><option value="-1">— None —</option>${opts()}</select></div>
        <div class="field"><label>📍 Site column (optional)</label>
          <select id="mapSite" style="width:100%;padding:9px;border:1px solid var(--line);border-radius:8px"><option value="-1">— None —</option>${opts()}</select></div>
        <div class="field"><label>🔘 Status column (optional)</label>
          <select id="mapStatus" style="width:100%;padding:9px;border:1px solid var(--line);border-radius:8px"><option value="-1">— None —</option>${opts()}</select></div>
        <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="applyColumnMapping()">Import with these columns</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap);
}

window.applyColumnMapping = function(){
  const ci = {
    project: parseInt(document.getElementById('mapProject').value),
    area:    parseInt(document.getElementById('mapArea').value),
    site:    parseInt(document.getElementById('mapSite').value),
    status:  parseInt(document.getElementById('mapStatus').value),
  };
  const ov = document.getElementById('colMapOverlay'); if(ov) ov.remove();
  if(!_importRows) return toast("No file loaded");
  const map = buildImportMap(_importRows, ci);
  finishImport(map, _importDept);
};

async function mergeImport(map, deptName){
  toast("Importing...");
  const {db, doc, setDoc, collection, addDoc} = window.__fb;
  let created=0, updated=0, lastProjId=null;

  for(const pName of Object.keys(map)){
    // Find existing project by name (case-insensitive)
    const existing = state.projects.find(p=>(p.name||"").toLowerCase()===pName.toLowerCase());
    const incomingAreas = map[pName];  // { areaName: {active, sites:{siteName:active}} }

    // Start from existing areas (merge, never overwrite)
    let areas = existing ? getProjectAreas(existing).map(a=>({...a, sites:[...(a.sites||[])]})) : [];

    for(const aName of Object.keys(incomingAreas)){
      const incoming = incomingAreas[aName];
      let area = areas.find(a=>(a.name||"").toLowerCase()===aName.toLowerCase());
      if(!area){ area = {name:aName, active:incoming.active!==false, sites:[]}; areas.push(area); }
      else if(incoming.active===false){ area.active = false; }  // status update from file
      // Merge sites
      for(const sName of Object.keys(incoming.sites)){
        const sActive = incoming.sites[sName];
        let site = area.sites.find(s=>(s.name||"").toLowerCase()===sName.toLowerCase());
        if(!site){ area.sites.push({name:sName, active:sActive}); }
        else { site.active = sActive; }  // status update
      }
    }

    if(existing){
      await setDoc(doc(db,"projects",existing.id), {
        name: existing.name, dept: existing.dept||deptName,
        estimatedHours: Number(existing.estimatedHours||0), areas,
      });
      lastProjId = existing.id;
      updated++;
    } else {
      const ref = await addDoc(collection(db,"projects"), {
        name: pName, dept: deptName, estimatedHours: 0, areas,
      });
      lastProjId = ref.id;
      created++;
    }
  }
  toast(`✓ Import done: ${created} new, ${updated} updated`);

  // Auto-open the Areas/Sites editor for review (if a single project was imported)
  if(lastProjId && Object.keys(map).length===1){
    setTimeout(()=>{ openSitesModal(lastProjId); }, 600);
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  AREAS & SITES MODULE  (replaces old Sites/Equipment)
//  Hierarchy: Project → Area → Site. Each Area and Site has active (Yes/No).
//  Data shape on a project doc:
//    areas: [ { name:"Erbil Area", active:true,
//               sites:[ { name:"Tower-A", active:true }, ... ] }, ... ]
// ═══════════════════════════════════════════════════════════════════════
let sitesModalProjId = null;   // which project is open in the modal
let newAreaName = "";          // input buffer for adding an area
let newSiteInputs = {};        // per-area site input buffers {areaIdx: "text"}
let newCodeName = "";          // input buffer for adding a project code

window.openSitesModal = function(projId){
  sitesModalProjId = projId;
  newAreaName = "";
  newSiteInputs = {};
  showSitesModal();
};
window.closeSitesModal = function(){
  sitesModalProjId = null;
  const ov = document.getElementById('sitesOverlay');
  if(ov) ov.remove();
};

// Build and (re)inject the modal overlay into the DOM
function showSitesModal(){
  const existing = document.getElementById('sitesOverlay');
  if(existing) existing.remove();
  if(!sitesModalProjId) return;
  const html = renderSitesModal();
  if(!html) return;
  const wrap = document.createElement('div');
  wrap.id = 'sitesOverlay';
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
}

// Migrate a project's old structure (sites[] with equipment) to new areas[] if needed
function getProjectAreas(proj){
  if(Array.isArray(proj.areas)) return proj.areas;
  // Backward-compat: if old sites[] exists, wrap them under a default area
  if(Array.isArray(proj.sites) && proj.sites.length){
    return [{ name:"General", active:true, sites: proj.sites.map(s=>({name:s.name, active:true})) }];
  }
  return [];
}

function renderSitesModal(){
  if(!sitesModalProjId) return "";
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) { sitesModalProjId=null; return ""; }
  const areas = getProjectAreas(proj);

  const statusPill = (active, onToggle)=>`
    <button onclick="${onToggle}" style="background:${active?'#E0F2F1':'#FFEBEE'};border:1px solid ${active?'#26A69A':'#EF9A9A'};color:${active?'#00897B':'#C62828'};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
      ${active?'● Active':'○ Inactive'}
    </button>`;

  return `<div onclick="if(event.target===this)closeSitesModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto">
    <div style="background:white;border-radius:16px;max-width:580px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,0.4);margin-top:20px">
      <div style="background:#03308B;color:white;padding:16px 20px;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:16px;font-weight:800">🗺️ Areas & Sites</div>
          <div style="font-size:12px;opacity:0.85">${escapeHtml(proj.name)}</div>
        </div>
        <button onclick="closeSitesModal()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;font-weight:700">×</button>
      </div>
      <div style="padding:20px;max-height:70vh;overflow-y:auto">

        <!-- Project Codes -->
        <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:10px;padding:12px;margin-bottom:16px">
          <div style="font-weight:800;color:#F57F17;font-size:13px;margin-bottom:8px">🔖 Project Codes</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
            ${(proj.codes||[]).length===0?`<span style="font-size:12px;color:#999">No codes yet</span>`:(proj.codes||[]).map((c,ci)=>`
              <span style="display:inline-flex;align-items:center;gap:5px;background:white;border:1px solid #FFE082;color:#F57F17;padding:4px 8px 4px 12px;border-radius:12px;font-size:12px;font-weight:700">
                ${escapeHtml(c)}
                <button onclick="delProjectCode(${ci})" style="background:#FFF3E0;border:none;color:#E65100;width:18px;height:18px;border-radius:50%;cursor:pointer;font-weight:700;font-size:11px">×</button>
              </span>`).join("")}
          </div>
          <div style="display:flex;gap:6px">
            <input value="${escapeHtml(newCodeName||'')}" oninput="window._setNewCode(this.value)" placeholder="Add project code (e.g. AC-001)" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:7px;font-size:12px">
            <button class="btn btn-sm" style="background:#F57F17;color:white;border:none;font-weight:700" onclick="addProjectCode()">+ Code</button>
          </div>
        </div>

        <!-- Add new area -->
        <div style="font-weight:800;color:#03308B;font-size:13px;margin-bottom:8px">🗺️ Areas</div>
        <!-- Add new area -->
        <div style="display:flex;gap:6px;margin-bottom:16px">
          <input value="${escapeHtml(newAreaName)}" oninput="window._setNewAreaName(this.value)" placeholder="New area name (e.g. Erbil Area, North Zone)" style="flex:1;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:13px">
          <button class="btn" style="background:#1565C0;color:white;border:none;font-weight:700" onclick="addArea()">+ Area</button>
        </div>

        ${areas.length===0
          ? `<div style="padding:20px;text-align:center;color:#888;background:#F7F7F7;border-radius:10px;font-size:13px">No areas yet. Add the first area above.</div>`
          : areas.map((a,ai)=>`
            <div style="border:1px solid #CBD5E1;border-radius:12px;padding:14px;margin-bottom:12px;background:#F8FAFC">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap">
                <div style="font-weight:800;color:#03308B;font-size:14px;flex:1;min-width:120px">🗺️ ${escapeHtml(a.name)}</div>
                ${statusPill(a.active!==false, `toggleAreaStatus(${ai})`)}
                <button class="btn btn-sm btn-danger" onclick="delArea(${ai})">🗑</button>
              </div>
              <!-- Sites list -->
              <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Sites</div>
              ${(a.sites||[]).length===0
                ? `<div style="font-size:12px;color:#94A3B8;padding:6px 0">No sites yet.</div>`
                : `<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:8px">
                    ${(a.sites||[]).map((s,si)=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:white;border:1px solid #E2E8F0;border-radius:7px;padding:7px 10px">
                      <span style="font-size:12px;color:#1E293B;font-weight:600;flex:1">📍 ${escapeHtml(s.name)}</span>
                      ${statusPill(s.active!==false, `toggleSiteStatus(${ai},${si})`)}
                      <button onclick="delSite(${ai},${si})" style="background:#FEE2E2;border:none;color:#DC2626;width:22px;height:22px;border-radius:5px;cursor:pointer;font-weight:700">×</button>
                    </div>`).join("")}
                  </div>`}
              <!-- Add site -->
              <div style="display:flex;gap:6px">
                <input value="${escapeHtml(newSiteInputs[ai]||'')}" oninput="window._setNewSite(${ai},this.value)" placeholder="e.g. Tower-A, Site-1" style="flex:1;padding:7px 10px;border:1px solid var(--line);border-radius:7px;font-size:12px">
                <button class="btn btn-sm" style="background:#2E7D32;color:white;border:none;font-weight:700" onclick="addSite(${ai})">+ Site</button>
              </div>
            </div>
          `).join("")}

        <div style="background:#E3F2FD;border-radius:8px;padding:10px 12px;font-size:11px;color:#0D47A1;line-height:1.6;margin-top:8px">
          ℹ️ When an employee logs work, they pick this project, then an area, then a site. Inactive areas/sites are hidden from their dropdowns.
        </div>
      </div>
    </div>
  </div>`;
}

window._setNewAreaName = function(v){ newAreaName = v; };
window._setNewSite = function(ai, v){ newSiteInputs[ai] = v; };
window._setNewCode = function(v){ newCodeName = v; };

// Project Codes management
window.addProjectCode = async function(){
  if(!isAdmin()) return toast("Admin only");
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) return;
  const code = (newCodeName||"").trim();
  if(!code) return toast("Enter a project code");
  const codes = [...(proj.codes||[])];
  if(codes.some(c=>c.toLowerCase()===code.toLowerCase())) return toast("Code already exists");
  codes.push(code);
  await fbSave("projects",{id:proj.id, name:proj.name, dept:proj.dept, estimatedHours:Number(proj.estimatedHours||0), areas:getProjectAreas(proj), codes});
  newCodeName = "";
  showSitesModal();
  toast("Code added ✓");
};
window.delProjectCode = async function(ci){
  if(!isAdmin()) return toast("Admin only");
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) return;
  const codes = [...(proj.codes||[])];
  codes.splice(ci,1);
  await fbSave("projects",{id:proj.id, name:proj.name, dept:proj.dept, estimatedHours:Number(proj.estimatedHours||0), areas:getProjectAreas(proj), codes});
  showSitesModal();
  toast("Code removed");
};

async function saveAreasToProject(proj, areas){
  await fbSave("projects", {
    id: proj.id, name: proj.name, dept: proj.dept,
    estimatedHours: Number(proj.estimatedHours||0),
    areas, codes: proj.codes || [],
  });
}

window.addArea = async function(){
  if(!isAdmin()) return toast("Admin only");
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) return;
  const name = (newAreaName||"").trim();
  if(!name) return toast("Enter an area name");
  const areas = getProjectAreas(proj).map(a=>({...a}));
  if(areas.some(a=>(a.name||"").toLowerCase()===name.toLowerCase())) return toast("Area already exists");
  areas.push({name, active:true, sites:[]});
  await saveAreasToProject(proj, areas);
  newAreaName = "";
  showSitesModal();
  toast("Area added ✓");
};
window.delArea = async function(ai){
  if(!isAdmin()) return toast("Admin only");
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) return;
  const areas = getProjectAreas(proj).map(a=>({...a}));
  if(!confirm(`Delete area "${areas[ai]?.name}" and its sites?`)) return;
  areas.splice(ai,1);
  await saveAreasToProject(proj, areas);
  showSitesModal();
  toast("Area deleted");
};
window.toggleAreaStatus = async function(ai){
  if(!isAdmin()) return toast("Admin only");
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) return;
  const areas = getProjectAreas(proj).map(a=>({...a}));
  areas[ai] = {...areas[ai], active: areas[ai].active===false ? true : false};
  await saveAreasToProject(proj, areas);
  showSitesModal();
};
window.addSite = async function(ai){
  if(!isAdmin()) return toast("Admin only");
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) return;
  const val = (newSiteInputs[ai]||"").trim();
  if(!val) return toast("Enter a site name");
  const areas = getProjectAreas(proj).map(a=>({...a}));
  const sites = [...(areas[ai].sites||[])];
  if(sites.some(s=>(s.name||"").toLowerCase()===val.toLowerCase())) return toast("Site already exists");
  sites.push({name:val, active:true});
  areas[ai] = {...areas[ai], sites};
  await saveAreasToProject(proj, areas);
  newSiteInputs[ai] = "";
  showSitesModal();
  toast("Site added ✓");
};
window.delSite = async function(ai, si){
  if(!isAdmin()) return toast("Admin only");
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) return;
  const areas = getProjectAreas(proj).map(a=>({...a}));
  const sites = [...(areas[ai].sites||[])];
  sites.splice(si,1);
  areas[ai] = {...areas[ai], sites};
  await saveAreasToProject(proj, areas);
  showSitesModal();
  toast("Site removed");
};
window.toggleSiteStatus = async function(ai, si){
  if(!isAdmin()) return toast("Admin only");
  const proj = state.projects.find(p=>p.id===sitesModalProjId);
  if(!proj) return;
  const areas = getProjectAreas(proj).map(a=>({...a}));
  const sites = [...(areas[ai].sites||[])];
  sites[si] = {...sites[si], active: sites[si].active===false ? true : false};
  areas[ai] = {...areas[ai], sites};
  await saveAreasToProject(proj, areas);
  showSitesModal();
};



// ═══════════════════════════════════════════════════════════════════════
//  ASSET MANAGEMENT MODULE (Phase 1)
//  Central "devices" collection. Each device has link keys + 9 detail fields.
//  Serial Number is the unique identifier (prevents duplicates).
// ═══════════════════════════════════════════════════════════════════════
/* device state hoisted to top (TDZ fix) */
let assetSearch = "", assetFilterProject = "", assetFilterStatus = "";
let assetFilterWarranty = "";   // "" | "expired" | "soon30"  (also set by Smart Alerts)
let selectedDevices = new Set();  // multi-select for bulk delete

// ── Daily Log inline device-edit buffer ──
window._devEdit = null;  // pending edits to the selected device {status, installDate, ...}
window._loadDeviceEdit = function(serial){
  if(!serial){ window._devEdit = null; return; }
  const d = (state.devices||[]).find(x=>x.serialNumber===serial);
  window._devEdit = d ? {
    status: d.status||"Active", installDate: d.installDate||"",
    ipAddress: d.ipAddress||"", model: d.model||"", vendor: d.vendor||"",
    warrantyExp: d.warrantyExp||"", stack: d.stack||""
  } : null;
};
window._setDevEdit = function(field, val){
  if(!window._devEdit) window._devEdit = {};
  window._devEdit[field] = val;
};

const DEVICE_STATUSES = ["Active","Inactive","Faulty","Under Repair","Decommissioned","Spare"];

function blankDevice(){
  return {
    serialNumber:"", deviceName:"", deviceCode:"",
    project:"", projectCode:"", area:"", site:"",
    ipAddress:"", vendor:"", model:"",
    installDate:"", warrantyExp:"", stack:"", status:"Active"
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  ASSET IMPORT (Phase 2) — comprehensive hierarchical import
//  Columns: Project, Project Code, Area Name, Site Status, Site Name,
//    Device, Device Code, Serial Number, IP Address, Vendor Name, Model,
//    Installation Date, Warranty Expiration Date, Stack, Device Status
//  Builds: Projects (+codes +areas +sites)  AND  central devices collection.
//  Serial Number is the unique key for devices (upsert).
// ═══════════════════════════════════════════════════════════════════════
let _assetImportRows = null;  // cached rows for column-mapper fallback

window.importAssets = function(){
  if(!isHR()) return toast("HR/Admin only");
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.xlsx,.xls';
  input.onchange = (e)=>{ const f = e.target.files[0]; if(f) parseAssetFile(f); };
  input.click();
};

// Download a template with all 15 columns
window.downloadAssetTemplate = function(){
  const sample = [
    ["Project","Project Code","Area Name","Site Status","Site Name","Device","Device Code","Serial Number","IP Address","Vendor Name","Model","Installation Date","Warranty Expiration Date","Stack","Device Status"],
    ["Asia Cell","AC-001","Erbil Area","Active","Tower-A","Core Switch","DEV-001","FOC1234X5YZ","192.168.1.1","Cisco","Catalyst 9300","2025-01-15","2028-01-15","Stack-1","Active"],
    ["Asia Cell","AC-001","Erbil Area","Active","Tower-A","Router","DEV-002","FOC9876Z5XY","192.168.1.2","Cisco","ISR 4451","2025-01-15","2028-01-15","","Active"],
    ["Asia Cell","AC-002","Duhok Area","Active","Site-North","Firewall","DEV-003","FGT60D1234","10.0.0.1","Fortinet","FortiGate 60F","2025-02-01","2027-02-01","","Active"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  ws['!cols']=[{wch:14},{wch:12},{wch:14},{wch:11},{wch:14},{wch:14},{wch:12},{wch:16},{wch:14},{wch:12},{wch:16},{wch:14},{wch:18},{wch:10},{wch:12}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assets");
  XLSX.writeFile(wb, "Girek_Assets_Import_Template.xlsx");
  toast("Template downloaded ✓");
};

async function parseAssetFile(file){
  toast("Reading file...");
  try{
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
    if(rows.length < 2) return toast("File looks empty");

    const header = rows[0].map(h=>String(h||"").trim());
    const headerLow = header.map(h=>h.toLowerCase());
    const find = (...names)=>{ for(const n of names){ const i=headerLow.findIndex(h=>h.includes(n)); if(i>=0) return i; } return -1; };

    const ci = {
      project:    find("project name","project"),
      projectCode:find("project code","code"),
      area:       find("area"),
      siteStatus: find("site status"),
      site:       find("site name","site"),
      device:     find("device name","device "),
      deviceCode: find("device code"),
      serial:     find("serial"),
      ip:         find("ip"),
      vendor:     find("vendor"),
      model:      find("model"),
      install:    find("install"),
      warranty:   find("warranty"),
      stack:      find("stack"),
      deviceStatus:find("device status"),
    };
    // Fallbacks for ambiguous "project" / "site" / "status" matches
    if(ci.project<0) ci.project = find("project");
    if(ci.site<0) ci.site = find("site");

    if(ci.project < 0){
      _assetImportRows = rows;
      showAssetColumnMapper(rows, header);
      return;
    }
    processAssetImport(rows, ci);
  }catch(err){
    console.error(err);
    toast("Import failed: "+(err.message||"bad file"));
  }
}

function statusToActive(val, def){
  const s=String(val||"").trim().toLowerCase();
  if(!s) return def;
  if(["inactive","no","false","0","off","معطل","غير نشط"].includes(s)) return false;
  return true;
}

// Converts a spreadsheet date cell to a "YYYY-MM-DD" string.
// Handles Excel serial numbers (e.g. 46387), JS Date objects, and existing
// date strings. Leaves non-date text untouched.
function toDateStr(v){
  if(v === "" || v === null || v === undefined) return "";
  if(v instanceof Date && !isNaN(v)){
    return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  if(/^\d+(\.\d+)?$/.test(s)){                 // pure number → Excel serial date
    const n = Number(s);
    if(n > 0 && n < 100000){
      const d = new Date(Math.round((n - 25569) * 86400000));  // 25569 = 1899-12-30 → 1970-01-01
      if(!isNaN(d)) return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
    }
  }
  return s;                                     // already a date string / other text
}

async function processAssetImport(rows, ci){
  toast("Processing...");
  const {db, doc, setDoc, collection, addDoc} = window.__fb;

  // Build an in-memory project map from current state (deep-ish copy)
  const projByName = {}; // lowerName -> {ref, name, dept, codes:Set, areas: Map(name->{active,sites:Map(name->active)})}
  state.projects.forEach(p=>{
    const areas = new Map();
    getProjectAreas(p).forEach(a=>{
      const sites = new Map();
      (a.sites||[]).forEach(s=>sites.set(s.name, s.active!==false));
      areas.set(a.name, {active:a.active!==false, sites});
    });
    projByName[(p.name||"").toLowerCase()] = { id:p.id, name:p.name, dept:p.dept||"", codes:new Set(p.codes||[]), areas };
  });

  // Existing devices — indexed by serial (primary key) and by a composite
  // fallback key for devices that have NO serial, so re-imports update them
  // instead of creating duplicates.
  const devBySerial = {};
  const devByComposite = {};
  const compositeKey = (proj, site, name, code, model) =>
    [proj, site, name, code, model].map(x=>String(x||"").trim().toLowerCase()).join("|");
  (state.devices||[]).forEach(d=>{
    if(d.serialNumber) devBySerial[d.serialNumber.toLowerCase()] = d;
    else devByComposite[compositeKey(d.project, d.site, d.deviceName, d.deviceCode, d.model)] = d;
  });

  const deviceWrites = []; // {id?, data}
  let newProjects=0, newDevices=0, updDevices=0, newSites=0;

  for(let r=1; r<rows.length; r++){
    const row = rows[r];
    const get = (k)=> ci[k]>=0 ? String(row[ci[k]]||"").trim() : "";
    const pName = get("project");
    if(!pName) continue;
    const key = pName.toLowerCase();
    if(!projByName[key]){
      projByName[key] = { id:null, name:pName, dept:"", codes:new Set(), areas:new Map() };
      newProjects++;
    }
    const proj = projByName[key];
    const code = get("projectCode");
    if(code) proj.codes.add(code);
    const aName = get("area") || "General";
    if(!proj.areas.has(aName)) proj.areas.set(aName, {active:true, sites:new Map()});
    const area = proj.areas.get(aName);
    const sName = get("site");
    if(sName){
      if(!area.sites.has(sName)) newSites++;
      area.sites.set(sName, statusToActive(get("siteStatus"), true));
    }

    // Device — created when Serial is present OR any device attribute is filled.
    // Devices WITHOUT a serial are matched by a composite key (Project | Site |
    // Device Name | Device Code | Model) so re-imports update them, not duplicate.
    const serial = get("serial");
    const dData = {
      serialNumber: serial,
      deviceName: get("device"),
      deviceCode: get("deviceCode"),
      project: pName, projectCode: code, area: aName, site: sName,
      ipAddress: get("ip"), vendor: get("vendor"), model: get("model"),
      installDate: toDateStr(get("install")), warrantyExp: toDateStr(get("warranty")),
      stack: get("stack"), status: get("deviceStatus") || "Active",
      updatedAt: new Date().toISOString(),
    };
    const hasDeviceData = serial || dData.deviceName || dData.deviceCode ||
                          dData.model || dData.vendor || dData.ipAddress;
    if(hasDeviceData){
      if(serial){
        const ex = devBySerial[serial.toLowerCase()];
        if(ex){ deviceWrites.push({id:ex.id, data:dData}); updDevices++; }
        else { deviceWrites.push({id:null, data:dData}); devBySerial[serial.toLowerCase()]={id:null,...dData}; newDevices++; }
      } else {
        const ck = compositeKey(pName, sName, dData.deviceName, dData.deviceCode, dData.model);
        const ex = devByComposite[ck];
        if(ex){ deviceWrites.push({id:ex.id, data:dData}); updDevices++; }
        else { deviceWrites.push({id:null, data:dData}); devByComposite[ck]={id:null,...dData}; newDevices++; }
      }
    }
  }

  if(newProjects===0 && newDevices===0 && updDevices===0 && newSites===0){
    return toast("Nothing to import (no valid rows)");
  }
  if(!confirm(`Import summary:\n\n• ${newProjects} new project(s)\n• ${newSites} new site(s)\n• ${newDevices} new device(s)\n• ${updDevices} device(s) updated\n\nProceed? (merge — nothing deleted)`)) return;

  toast("Importing...");
  // 1. Write projects (with merged codes + areas)
  for(const key of Object.keys(projByName)){
    const p = projByName[key];
    const areasArr = [];
    p.areas.forEach((a, name)=>{
      const sitesArr = [];
      a.sites.forEach((active, sname)=>sitesArr.push({name:sname, active}));
      areasArr.push({name, active:a.active, sites:sitesArr});
    });
    const payload = { name:p.name, dept:p.dept, estimatedHours:0, areas:areasArr, codes:Array.from(p.codes) };
    if(p.id){ await setDoc(doc(db,"projects",p.id), payload, {merge:true}); }
    else { await addDoc(collection(db,"projects"), payload); }
  }
  // 2. Write devices
  for(const w of deviceWrites){
    if(w.id){ await setDoc(doc(db,"devices",w.id), w.data, {merge:true}); }
    else { await addDoc(collection(db,"devices"), w.data); }
  }

  toast(`✓ Import done: ${newDevices} new + ${updDevices} updated devices`);
}

// ── Column mapper fallback ──
function showAssetColumnMapper(rows, header){
  const opts = ()=> header.map((h,i)=>`<option value="${i}">${escapeHtml(h||('Column '+(i+1)))}</option>`).join("");
  const field = (id,label,req)=>`<div class="field"><label>${label}${req?' <span style="color:#c62828">*</span>':''}</label>
    <select id="${id}" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px">${req?'':'<option value="-1">— None —</option>'}${opts()}</select></div>`;
  const ex=document.getElementById('assetMapOverlay'); if(ex) ex.remove();
  const wrap=document.createElement('div'); wrap.id='assetMapOverlay';
  wrap.innerHTML=`<div onclick="if(event.target===this)document.getElementById('assetMapOverlay').remove()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto">
    <div style="background:white;border-radius:16px;max-width:520px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,0.4);margin-top:20px">
      <div style="background:#00897B;color:white;padding:16px 20px;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:16px;font-weight:800">🔗 Match Columns</div>
        <button onclick="document.getElementById('assetMapOverlay').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;font-weight:700">×</button>
      </div>
      <div style="padding:20px;max-height:70vh;overflow-y:auto">
        <p style="font-size:12px;color:#555;margin-bottom:14px">Match your file's columns. Only Project is required; leave others as None if not present.</p>
        ${field('amProject','📁 Project',true)}
        ${field('amProjectCode','🔖 Project Code')}
        ${field('amArea','🗺️ Area Name')}
        ${field('amSiteStatus','🔘 Site Status')}
        ${field('amSite','📍 Site Name')}
        ${field('amDevice','📟 Device Name')}
        ${field('amDeviceCode','🔢 Device Code')}
        ${field('amSerial','🆔 Serial Number')}
        ${field('amIp','🌐 IP Address')}
        ${field('amVendor','🏭 Vendor')}
        ${field('amModel','📱 Model')}
        ${field('amInstall','📅 Installation Date')}
        ${field('amWarranty','🛡️ Warranty Expiration')}
        ${field('amStack','🔗 Stack')}
        ${field('amDeviceStatus','⚡ Device Status')}
        <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="applyAssetMapping()">Import with these columns</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(wrap);
}

window.applyAssetMapping = function(){
  const g=(id)=>parseInt(document.getElementById(id).value);
  const ci = {
    project:g('amProject'), projectCode:g('amProjectCode'), area:g('amArea'),
    siteStatus:g('amSiteStatus'), site:g('amSite'), device:g('amDevice'),
    deviceCode:g('amDeviceCode'), serial:g('amSerial'), ip:g('amIp'),
    vendor:g('amVendor'), model:g('amModel'), install:g('amInstall'),
    warranty:g('amWarranty'), stack:g('amStack'), deviceStatus:g('amDeviceStatus'),
  };
  const ov=document.getElementById('assetMapOverlay'); if(ov) ov.remove();
  if(!_assetImportRows) return toast("No file loaded");
  processAssetImport(_assetImportRows, ci);
};


// ═══════════════════════════════════════════════════════════════════════
//  ASSET REPORT (Phase 4) — full inventory export (PDF + Excel)
//  Uses the current Assets-tab filters (search, project, status).
// ═══════════════════════════════════════════════════════════════════════
function _filteredDevices(){
  let shown = (state.devices||[]).slice();
  if(assetFilterProject) shown = shown.filter(d=>d.project===assetFilterProject);
  if(assetFilterStatus) shown = shown.filter(d=>(d.status||"")===assetFilterStatus);
  if(assetFilterWarranty) shown = shown.filter(d=>{
    const s=toDateStr(d.warrantyExp), w=s?new Date(s):null;
    if(!w||isNaN(w)) return false;
    const diff=(w-new Date())/864e5;
    return assetFilterWarranty==="expired" ? diff<0 : (diff>=0 && diff<=30);
  });
  if(assetSearch){
    const q = assetSearch.toLowerCase();
    shown = shown.filter(d=>
      (d.serialNumber||"").toLowerCase().includes(q) ||
      (d.deviceName||"").toLowerCase().includes(q) ||
      (d.ipAddress||"").toLowerCase().includes(q) ||
      (d.model||"").toLowerCase().includes(q) ||
      (d.site||"").toLowerCase().includes(q)
    );
  }
  return shown.sort((a,b)=>(a.project||"").localeCompare(b.project||"") || (a.site||"").localeCompare(b.site||""));
}

window.exportAssetPDF = async function(){
  if(!isHR()) return toast("HR/Admin only");
  const devices = _filteredDevices();
  if(devices.length===0) return toast("No devices to export");
  const byStatus = {}; devices.forEach(d=>{const s=d.status||"(none)";byStatus[s]=(byStatus[s]||0)+1;});
  const filterLbl = [assetFilterProject&&`Project: ${assetFilterProject}`, assetFilterStatus&&`Status: ${assetFilterStatus}`, assetFilterWarranty&&`Warranty: ${assetFilterWarranty==="expired"?"Expired":"\u2264 30 days"}`, assetSearch&&`Search: ${assetSearch}`].filter(Boolean).join(" · ");

  const bodyHTML = `
    <div class="actions no-print" style="padding:10px;background:#FFF8E1;border:1px solid #FFE082;border-radius:8px;margin-bottom:14px;text-align:center;font-size:13px;color:#7F6000">
      📄 In the print dialog, choose <strong>"Save as PDF"</strong>
      <br><br><button onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#888">Close</button>
    </div>
    <div class="ksec"><span class="kbad">01</span><h3>Asset Summary</h3></div>
    <div class="kr" style="flex-wrap:wrap">
      <div class="kc kb"><div class="kl">Total Devices</div><div class="kv">${devices.length}</div><div class="ks">assets</div></div>
      ${Object.keys(byStatus).sort((a,b)=>byStatus[b]-byStatus[a]).map((s,i)=>{const cls=["ko","kg","kp","krd"][i%4];return `<div class="kc ${cls}"><div class="kl">${escapeHtml(s)}</div><div class="kv">${byStatus[s]}</div><div class="ks">devices</div></div>`;}).join("")}
    </div>
    <div class="ksec"><span class="kbad">02</span><h3>Device Inventory (${devices.length})</h3></div>
    <table><thead><tr>
      <th>Serial</th><th>Device</th><th>Code</th><th>Project</th><th>Code</th><th>Area</th><th>Site</th><th>IP</th><th>Vendor</th><th>Model</th><th>Install</th><th>Warranty</th><th>Stack</th><th>Status</th>
    </tr></thead><tbody>
      ${devices.map(d=>`<tr>
        <td><strong>${escapeHtml(d.serialNumber||'')}</strong></td>
        <td>${escapeHtml(d.deviceName||'')}</td>
        <td>${escapeHtml(d.deviceCode||'')}</td>
        <td>${escapeHtml(d.project||'')}</td>
        <td>${escapeHtml(d.projectCode||'')}</td>
        <td>${escapeHtml(d.area||'')}</td>
        <td>${escapeHtml(d.site||'')}</td>
        <td>${escapeHtml(d.ipAddress||'')}</td>
        <td>${escapeHtml(d.vendor||'')}</td>
        <td>${escapeHtml(d.model||'')}</td>
        <td>${escapeHtml(toDateStr(d.installDate))}</td>
        <td>${escapeHtml(toDateStr(d.warrantyExp))}</td>
        <td>${escapeHtml(d.stack||'')}</td>
        <td>${deviceStatusBadge(d.status)}</td>
      </tr>`).join("")}
    </tbody></table>
    <script>setTimeout(()=>window.print(),500)<\/script>`;

  await openReportPDF("ASSET_REPORT", filterLbl||"All devices", bodyHTML);
  toast("PDF export ready!");
};

window.exportAssetExcel = async function(){
  if(!isHR()) return toast("HR/Admin only");
  try{
    const devices = _filteredDevices();
    if(devices.length===0) return toast("No devices to export");
    const NAVY="03308B", WHITE="FFFFFF";
    const hd={font:{bold:true,sz:10,color:{rgb:WHITE}},fill:{fgColor:{rgb:NAVY}}};
    const setC=(ws,a,v,s)=>{ws[a]={v:v,t:'s'};if(s)ws[a].s=s;};
    const cols = ["Serial Number","Device Name","Device Code","Project","Project Code","Area","Site","IP Address","Vendor","Model","Install Date","Warranty Exp","Stack","Status"];
    const keys = ["serialNumber","deviceName","deviceCode","project","projectCode","area","site","ipAddress","vendor","model","installDate","warrantyExp","stack","status"];
    const colL=(n)=>{let s="";n++;while(n>0){let m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;};
    const ws={};
    const lastCol=colL(cols.length-1);
    // Branded title banner (navy background, gold text) — matches HR report
    setC(ws,'A1',`EJAF  •  ASSET REPORT  —  ${devices.length} devices`,{font:{bold:true,sz:16,color:{rgb:"C9A84C"}},fill:{fgColor:{rgb:NAVY}},alignment:{horizontal:"center",vertical:"center"}});
    ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:cols.length-1}}];
    cols.forEach((c,i)=>setC(ws,`${colL(i)}2`,c,hd));
    devices.forEach((d,ri)=>{
      keys.forEach((k,ci)=>{ const cv=(k==="installDate"||k==="warrantyExp")?toDateStr(d[k]):(d[k]||""); setC(ws,`${colL(ci)}${ri+3}`,cv,{font:{sz:10},fill:{fgColor:{rgb:ri%2?"F0F4FF":WHITE}}}); });
    });
    ws['!ref']=`A1:${lastCol}${devices.length+2}`;
    ws['!cols']=cols.map(()=>({wch:15}));
    ws['!rows']=[{hpt:26}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Assets");
    XLSX.writeFile(wb,`EJAF_Asset_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast("Asset report exported ✓");
  }catch(e){ toast("Export failed: "+(e.message||"error")); }
};


function renderAssets(){
  if(!isHR()) return `<div class="card"><div class="empty">Access denied — HR/Admin only</div></div>`;
  if(!deviceForm) deviceForm = blankDevice();

  const devices = state.devices || [];
  // Filters
  let shown = devices;
  if(assetFilterProject) shown = shown.filter(d=>d.project===assetFilterProject);
  if(assetFilterStatus) shown = shown.filter(d=>(d.status||"")===assetFilterStatus);
  if(assetFilterWarranty) shown = shown.filter(d=>{
    const s=toDateStr(d.warrantyExp), w=s?new Date(s):null;
    if(!w||isNaN(w)) return false;
    const diff=(w-new Date())/864e5;
    return assetFilterWarranty==="expired" ? diff<0 : (diff>=0 && diff<=30);
  });
  if(assetSearch){
    const q = assetSearch.toLowerCase();
    shown = shown.filter(d=>
      (d.serialNumber||"").toLowerCase().includes(q) ||
      (d.deviceName||"").toLowerCase().includes(q) ||
      (d.ipAddress||"").toLowerCase().includes(q) ||
      (d.model||"").toLowerCase().includes(q) ||
      (d.site||"").toLowerCase().includes(q)
    );
  }

  const allProjects = state.projects.map(p=>p.name).filter(Boolean).sort();
  // Project codes/areas/sites for the selected project in the form
  const selProj = state.projects.find(p=>p.name===deviceForm.project);
  const projCodes = selProj?.codes || [];
  const projAreas = selProj ? getProjectAreas(selProj) : [];
  const selArea = projAreas.find(a=>a.name===deviceForm.area);
  const areaSites = selArea?.sites || [];

  const av = window._assetView || "devices";
  let h = _pills('_assetView',[{id:"devices",ic:"📦",lb:"Devices"},{id:"summary",ic:"📊",lb:"Summary"},{id:"manage",ic:"➕",lb:"Manage"}]);
  if(av==="manage")  h += `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">
        <div class="card-title" style="margin:0">📦 Asset Management</div>
        <p style="font-size:12px;color:var(--muted);margin:4px 0 0">Central device registry. Serial Number is the unique key — no duplicates. ${devices.length} device(s) total.</p>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:#00897B;color:white;border:none;font-weight:700" onclick="importAssets()" title="Import projects, sites & devices from CSV/Excel">📥 Import</button>
        <button class="btn btn-sm" style="background:#0F2347;color:#C9A84C;border:none;font-weight:700" onclick="downloadAssetTemplate()">⬇ Template</button>
        <button class="btn btn-sm" style="background:#C9A84C;color:#0F2347;border:none;font-weight:700" onclick="exportAssetPDF()" title="Full inventory report (PDF)">📄 Report</button>
        <button class="btn btn-sm" style="background:#2E7D32;color:white;border:none;font-weight:700" onclick="exportAssetExcel()" title="Full inventory (Excel)">📊 Excel</button>
      </div>
    </div>
  </div>

  <div class="card" style="background:#E0F2F1;border:1px solid #80CBC4">
    <p style="font-size:12px;color:#004D40;margin:0;line-height:1.6">
      <strong>📥 Bulk Import:</strong> Upload a file to build the full hierarchy at once — Projects, Project Codes, Areas, Sites, and Devices. Serial Number is the unique key (existing devices are updated, not duplicated). 15 columns: Project · Project Code · Area Name · Site Status · Site Name · Device · Device Code · Serial Number · IP Address · Vendor · Model · Installation Date · Warranty Expiration · Stack · Device Status.
    </p>
  </div>`+``;
  if(av==="summary") h += `

  ${(()=>{
    // ── Inventory summary ──
    if(devices.length===0) return "";
    const byStatus = {}; devices.forEach(d=>{const s=d.status||"(none)";byStatus[s]=(byStatus[s]||0)+1;});
    const byVendor = {}; devices.forEach(d=>{const v=d.vendor||"(none)";byVendor[v]=(byVendor[v]||0)+1;});
    // Warranty expiring within 90 days
    const now = new Date(); const soon = new Date(now.getTime()+90*864e5);
    const expiring = devices.filter(d=>{ if(!d.warrantyExp) return false; const w=new Date(toDateStr(d.warrantyExp)); return !isNaN(w) && w>=now && w<=soon; });
    const expired = devices.filter(d=>{ if(!d.warrantyExp) return false; const w=new Date(toDateStr(d.warrantyExp)); return !isNaN(w) && w < now; });
    const topVendors = Object.keys(byVendor).sort((a,b)=>byVendor[b]-byVendor[a]).slice(0,6);
    return `<div class="card">
      <div class="card-title">📊 Inventory Summary</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:14px">
        <div style="background:linear-gradient(135deg,#1B3A6B,#2E5FA3);color:white;border-radius:10px;padding:12px"><div style="font-size:11px;opacity:0.8">TOTAL DEVICES</div><div style="font-size:22px;font-weight:800">${devices.length}</div></div>
        <div style="background:linear-gradient(135deg,#2E7D32,#43A047);color:white;border-radius:10px;padding:12px"><div style="font-size:11px;opacity:0.8">ACTIVE</div><div style="font-size:22px;font-weight:800">${byStatus["Active"]||0}</div></div>
        <div style="background:linear-gradient(135deg,#E65100,#FB8C00);color:white;border-radius:10px;padding:12px"><div style="font-size:11px;opacity:0.8">WARRANTY ≤90d</div><div style="font-size:22px;font-weight:800">${expiring.length}</div></div>
        <div style="background:linear-gradient(135deg,#C62828,#E53935);color:white;border-radius:10px;padding:12px"><div style="font-size:11px;opacity:0.8">EXPIRED</div><div style="font-size:22px;font-weight:800">${expired.length}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <div style="font-size:12px;font-weight:800;color:#03308B;margin-bottom:6px">By Status</div>
          ${Object.keys(byStatus).sort((a,b)=>byStatus[b]-byStatus[a]).map(s=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px"><span>${deviceStatusBadge(s)}</span><strong>${byStatus[s]}</strong></div>`).join("")}
        </div>
        <div>
          <div style="font-size:12px;font-weight:800;color:#6A1B9A;margin-bottom:6px">Top Vendors</div>
          ${topVendors.map(v=>`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px"><span>${escapeHtml(v)}</span><strong>${byVendor[v]}</strong></div>`).join("")}
        </div>
      </div>
    </div>`;
  })()}`+`
    <div class="form-grid">
      <div class="field"><label>Serial Number <span class="req">*</span></label>
        <div style="display:flex;gap:6px"><input style="flex:1" value="${escapeHtml(deviceForm.serialNumber)}" oninput="window.deviceForm.serialNumber=this.value" placeholder="e.g. FOC1234X5YZ" ${deviceEditId?'disabled style="background:#f0f0f0"':''}>${deviceEditId?'':'<button type="button" onclick="openScanner(v=>{window.deviceForm.serialNumber=v;render();})" title="Scan barcode" style="background:#03308B;color:#C9A84C;border:none;border-radius:8px;width:42px;cursor:pointer;font-size:18px">📷</button>'}</div></div>
      <div class="field"><label>Device Name</label>
        <input value="${escapeHtml(deviceForm.deviceName)}" oninput="window.deviceForm.deviceName=this.value" placeholder="e.g. Core Switch"></div>
      <div class="field"><label>Device Code</label>
        <input value="${escapeHtml(deviceForm.deviceCode)}" oninput="window.deviceForm.deviceCode=this.value" placeholder="e.g. DEV-001"></div>

      <div class="field"><label>📁 Project</label>
        <select onchange="window.deviceForm.project=this.value;window.deviceForm.projectCode='';window.deviceForm.area='';window.deviceForm.site='';render()">
          <option value="">— Select —</option>
          ${allProjects.map(p=>`<option value="${escapeHtml(p)}" ${p===deviceForm.project?"selected":""}>${escapeHtml(p)}</option>`).join("")}
        </select></div>
      <div class="field"><label>🔖 Project Code</label>
        <select onchange="window.deviceForm.projectCode=this.value" ${projCodes.length===0?'disabled':''}>
          <option value="">${projCodes.length?'— Select —':'No codes (add in Projects 🗺️)'}</option>
          ${projCodes.map(c=>`<option value="${escapeHtml(c)}" ${c===deviceForm.projectCode?"selected":""}>${escapeHtml(c)}</option>`).join("")}
        </select></div>
      <div class="field"><label>🗺️ Area</label>
        <select onchange="window.deviceForm.area=this.value;window.deviceForm.site='';render()" ${projAreas.length===0?'disabled':''}>
          <option value="">${projAreas.length?'— Select —':'No areas'}</option>
          ${projAreas.map(a=>`<option value="${escapeHtml(a.name)}" ${a.name===deviceForm.area?"selected":""}>${escapeHtml(a.name)}</option>`).join("")}
        </select></div>
      <div class="field"><label>📍 Site</label>
        <select onchange="window.deviceForm.site=this.value" ${areaSites.length===0?'disabled':''}>
          <option value="">${areaSites.length?'— Select —':'Pick area first'}</option>
          ${areaSites.map(s=>`<option value="${escapeHtml(s.name)}" ${s.name===deviceForm.site?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}
        </select></div>

      <div class="field"><label>🌐 IP Address</label>
        <input value="${escapeHtml(deviceForm.ipAddress)}" oninput="window.deviceForm.ipAddress=this.value" placeholder="e.g. 192.168.1.1"></div>
      <div class="field"><label>🏭 Vendor</label>
        <input value="${escapeHtml(deviceForm.vendor)}" oninput="window.deviceForm.vendor=this.value" placeholder="e.g. Cisco"></div>
      <div class="field"><label>📱 Model</label>
        <input value="${escapeHtml(deviceForm.model)}" oninput="window.deviceForm.model=this.value" placeholder="e.g. Catalyst 9300"></div>
      <div class="field"><label>📅 Installation Date</label>
        <input type="date" value="${escapeHtml(deviceForm.installDate)}" onchange="window.deviceForm.installDate=this.value"></div>
      <div class="field"><label>🛡️ Warranty Expiration</label>
        <input type="date" value="${escapeHtml(deviceForm.warrantyExp)}" onchange="window.deviceForm.warrantyExp=this.value"></div>
      <div class="field"><label>🔗 Stack</label>
        <input value="${escapeHtml(deviceForm.stack)}" oninput="window.deviceForm.stack=this.value" placeholder="e.g. Stack-1"></div>
      <div class="field"><label>🔘 Device Status</label>
        <select onchange="window.deviceForm.status=this.value">
          ${DEVICE_STATUSES.map(s=>`<option value="${escapeHtml(s)}" ${s===deviceForm.status?"selected":""}>${escapeHtml(s)}</option>`).join("")}
        </select></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="saveDevice()">${deviceEditId?"Update Device":"Add Device"}</button>
      ${deviceEditId?`<button class="btn btn-ghost" onclick="cancelDevice()">Cancel</button>`:""}
    </div>
  </div>`;
  if(av==="devices") h += `

  <!-- Device list with filters -->
  <div class="card">
    <div class="filter-row">
      <span class="card-title" style="margin:0">Devices</span>
      <span class="count-pill">${shown.length}</span>
      <div style="display:flex;gap:6px;margin-left:auto;flex-wrap:wrap">
        <input value="${escapeHtml(assetSearch)}" oninput="window.assetSearch=this.value;render()" placeholder="🔍 Serial, name, IP, model..." style="padding:6px 10px;border:1px solid var(--line);border-radius:6px;font-size:12px;min-width:160px">
        <select onchange="window.assetFilterProject=this.value;render()" style="padding:6px 10px;border:1px solid var(--line);border-radius:6px;font-size:12px">
          <option value="">All Projects</option>
          ${allProjects.map(p=>`<option value="${escapeHtml(p)}" ${p===assetFilterProject?"selected":""}>${escapeHtml(p)}</option>`).join("")}
        </select>
        <select onchange="window.assetFilterWarranty=this.value;render()" style="padding:6px 10px;border:1px solid ${assetFilterWarranty?'#E65100':'var(--line)'};border-radius:6px;font-size:12px;font-weight:${assetFilterWarranty?'800':'400'};color:${assetFilterWarranty?'#E65100':'inherit'}">
          <option value="">🛡️ All Warranty</option>
          <option value="expired" ${assetFilterWarranty==="expired"?"selected":""}>❌ Expired</option>
          <option value="soon30" ${assetFilterWarranty==="soon30"?"selected":""}>⏳ Expiring ≤ 30 days</option>
        </select>
        <select onchange="window.assetFilterStatus=this.value;render()" style="padding:6px 10px;border:1px solid var(--line);border-radius:6px;font-size:12px">
          <option value="">All Status</option>
          ${DEVICE_STATUSES.map(s=>`<option value="${escapeHtml(s)}" ${s===assetFilterStatus?"selected":""}>${escapeHtml(s)}</option>`).join("")}
        </select>
      </div>
    </div>
    ${shown.length===0?`<div class="empty">No devices match. Add your first device above.</div>`:`
    ${(()=>{
      // Count how many of the currently shown devices are selected
      const shownIds = shown.map(d=>d.id);
      const selShown = shownIds.filter(id=>selectedDevices.has(id));
      if(selShown.length===0) return "";
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:#FFF3E0;border:1px solid #FFB74D;border-radius:10px;padding:10px 14px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:700;color:#E65100">✓ ${selShown.length} device(s) selected</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" style="background:#fff;border:1px solid #FFB74D;color:#E65100;font-weight:700" onclick="clearDeviceSelection()">Clear</button>
          <button class="btn btn-sm btn-danger" style="font-weight:700" onclick="deleteSelectedDevices()">🗑 Delete Selected (${selShown.length})</button>
        </div>
      </div>`;
    })()}
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn btn-sm" style="background:#FFEBEE;border:1px solid #EF9A9A;color:#C62828;font-weight:700;font-size:11px" onclick="deleteAllShownDevices()" title="Delete all devices currently shown by the filters">🗑 Delete All Shown (${shown.length})</button>
    </div>
    <div style="overflow-x:auto">
      <table class="data-table" style="min-width:940px">
        <thead><tr>
          <th style="width:36px;text-align:center"><input type="checkbox" ${shown.length>0 && shown.every(d=>selectedDevices.has(d.id))?'checked':''} onchange="toggleSelectAllDevices(this.checked)" style="cursor:pointer;width:16px;height:16px" title="Select all shown"></th>
          <th>Serial</th><th>Name</th><th>Project</th><th>Site</th><th>IP</th><th>Model</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${shown.map(d=>`<tr style="${selectedDevices.has(d.id)?'background:#FFF8E1':''}">
            <td style="text-align:center"><input type="checkbox" ${selectedDevices.has(d.id)?'checked':''} onchange="toggleDeviceSelect('${d.id}')" style="cursor:pointer;width:16px;height:16px"></td>
            <td style="font-weight:700;color:#03308B;font-size:12px">${escapeHtml(d.serialNumber||"—")}</td>
            <td style="font-size:12px">${escapeHtml(d.deviceName||"—")}</td>
            <td style="font-size:12px">${escapeHtml(d.project||"—")}${d.projectCode?`<br><span style="font-size:9px;color:#888">${escapeHtml(d.projectCode)}</span>`:''}</td>
            <td style="font-size:12px">${escapeHtml(d.site||"—")}${d.area?`<br><span style="font-size:9px;color:#888">${escapeHtml(d.area)}</span>`:''}</td>
            <td style="font-size:11px;font-family:monospace">${escapeHtml(d.ipAddress||"—")}</td>
            <td style="font-size:12px">${escapeHtml(d.model||"—")}</td>
            <td>${deviceStatusBadge(d.status)}</td>
            <td style="white-space:nowrap">
              <button class="btn btn-sm btn-secondary" onclick="editDevice('${d.id}')">✎</button>
              <button class="btn btn-sm btn-danger" onclick="delDevice('${d.id}')">🗑</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`}
  </div>`;
  return h;
}

function deviceStatusBadge(status){
  const map = {
    "Active":"#E8F5E9|#2E7D32", "Inactive":"#FFEBEE|#C62828",
    "Faulty":"#FFF3E0|#E65100", "Under Repair":"#FFF8E1|#F57F17",
    "Decommissioned":"#ECEFF1|#546E7A", "Spare":"#E3F2FD|#1565C0"
  };
  const [bg,fg] = (map[status]||"#F5F5F5|#666").split("|");
  return `<span style="background:${bg};color:${fg};padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap">${escapeHtml(status||"—")}</span>`;
}

async function saveDevice(){
  if(!isHR()) return toast("HR/Admin only");
  const serial = (deviceForm.serialNumber||"").trim();
  if(!serial) return toast("Serial Number is required");

  // Uniqueness check: no two devices with the same serial (except self when editing)
  const dup = (state.devices||[]).find(d=>(d.serialNumber||"").toLowerCase()===serial.toLowerCase() && d.id!==deviceEditId);
  if(dup) return toast("⚠ A device with this Serial Number already exists");

  const data = {
    serialNumber: serial,
    deviceName: deviceForm.deviceName||"",
    deviceCode: deviceForm.deviceCode||"",
    project: deviceForm.project||"",
    projectCode: deviceForm.projectCode||"",
    area: deviceForm.area||"",
    site: deviceForm.site||"",
    ipAddress: deviceForm.ipAddress||"",
    vendor: deviceForm.vendor||"",
    model: deviceForm.model||"",
    installDate: deviceForm.installDate||"",
    warrantyExp: deviceForm.warrantyExp||"",
    stack: deviceForm.stack||"",
    status: deviceForm.status||"Active",
    updatedAt: new Date().toISOString(),
  };

  await fbSave("devices", {id: deviceEditId||undefined, ...data});
  toast(deviceEditId?"Device updated ✓":"Device added ✓");
  deviceForm = blankDevice();
  deviceEditId = null;
}
function editDevice(id){
  const d = (state.devices||[]).find(x=>x.id===id);
  if(d){ deviceForm = {...blankDevice(), ...d, installDate: toDateStr(d.installDate), warrantyExp: toDateStr(d.warrantyExp)}; deviceEditId = id; render(); window.scrollTo(0,0); }
}
async function delDevice(id){
  if(!isHR()) return toast("HR/Admin only");
  const d = (state.devices||[]).find(x=>x.id===id);
  if(!confirm(`Delete device "${d?.serialNumber||''}"?`)) return;
  await fbDelete("devices", id);
  toast("Device deleted");
}
function cancelDevice(){ deviceForm = blankDevice(); deviceEditId = null; render(); }

// ── Multi-select + bulk delete ──
// Recompute the currently filtered/shown devices (mirror of the logic in renderAssets)
function _shownDevices(){
  let shown = (state.devices||[]).slice();
  if(assetFilterProject) shown = shown.filter(d=>d.project===assetFilterProject);
  if(assetFilterStatus) shown = shown.filter(d=>(d.status||"")===assetFilterStatus);
  if(assetFilterWarranty) shown = shown.filter(d=>{
    const s=toDateStr(d.warrantyExp), w=s?new Date(s):null;
    if(!w||isNaN(w)) return false;
    const diff=(w-new Date())/864e5;
    return assetFilterWarranty==="expired" ? diff<0 : (diff>=0 && diff<=30);
  });
  if(assetSearch){
    const q = assetSearch.toLowerCase();
    shown = shown.filter(d=>
      (d.serialNumber||"").toLowerCase().includes(q) ||
      (d.deviceName||"").toLowerCase().includes(q) ||
      (d.ipAddress||"").toLowerCase().includes(q) ||
      (d.model||"").toLowerCase().includes(q) ||
      (d.site||"").toLowerCase().includes(q)
    );
  }
  return shown;
}
window.toggleDeviceSelect = function(id){
  if(selectedDevices.has(id)) selectedDevices.delete(id); else selectedDevices.add(id);
  render();
};
window.toggleSelectAllDevices = function(checked){
  const shown = _shownDevices();
  if(checked){ shown.forEach(d=>selectedDevices.add(d.id)); }
  else { shown.forEach(d=>selectedDevices.delete(d.id)); }
  render();
};
window.clearDeviceSelection = function(){ selectedDevices.clear(); render(); };

async function _bulkDeleteDevices(ids, label){
  if(!isHR()) return toast("HR/Admin only");
  if(ids.length===0) return toast("Nothing selected");
  // Strong confirmation: must type the exact count to proceed
  const typed = prompt(`⚠ You are about to permanently delete ${ids.length} device(s) — ${label}.\n\nThis cannot be undone.\n\nType the number ${ids.length} to confirm:`);
  if(typed === null) return;                       // cancelled
  if(String(typed).trim() !== String(ids.length)){ return toast("Confirmation did not match — nothing deleted"); }
  toast(`Deleting ${ids.length} device(s)...`);
  let done = 0;
  for(const id of ids){
    try{ await fbDelete("devices", id); done++; }
    catch(e){ /* keep going */ }
  }
  selectedDevices.clear();
  toast(`✓ Deleted ${done} device(s)`);
}
window.deleteSelectedDevices = function(){
  const shown = _shownDevices().map(d=>d.id);
  const ids = shown.filter(id=>selectedDevices.has(id));   // only selected among shown
  _bulkDeleteDevices(ids, "the selected devices");
};
window.deleteAllShownDevices = function(){
  const ids = _shownDevices().map(d=>d.id);
  const scope = (assetFilterProject||assetFilterStatus||assetSearch) ? "all devices matching the current filters" : "ALL devices";
  _bulkDeleteDevices(ids, scope);
};

Object.assign(window,{saveDevice,editDevice,delDevice,cancelDevice,renderAssets});
Object.defineProperty(window,'deviceForm',{get:()=>deviceForm,set:v=>deviceForm=v,configurable:true});
Object.defineProperty(window,'assetSearch',{get:()=>assetSearch,set:v=>assetSearch=v,configurable:true});
Object.defineProperty(window,'assetFilterProject',{get:()=>assetFilterProject,set:v=>assetFilterProject=v,configurable:true});
Object.defineProperty(window,'assetFilterStatus',{get:()=>assetFilterStatus,set:v=>assetFilterStatus=v,configurable:true});




// ═══════════════════════════════════════════════════════════════════════
//  BARCODE / QR SCANNER — fills a serial field from the device camera.
//  Uses @zxing/library (loaded in index.html). Fails gracefully if absent.
// ═══════════════════════════════════════════════════════════════════════
let _zxReader=null, _zxStream=null;
window.openScanner=function(targetSetter){
  window._scanTarget=targetSetter;
  let ov=document.getElementById('scanOv');
  if(!ov){ov=document.createElement('div');ov.id='scanOv';document.body.appendChild(ov);}
  ov.innerHTML=`<div class="scan-box">
    <div class="scan-hd"><span>📷 Scan barcode / QR</span><button class="al-x" onclick="closeScanner()">✕</button></div>
    <div class="scan-vidwrap"><video id="scanVid" playsinline></video><div class="scan-frame"></div></div>
    <div class="scan-hint" id="scanHint">Point the camera at the device barcode…</div>
    <div class="scan-ft"><input id="scanManual" placeholder="…or type it manually" oninput="0"><button class="btn btn-sm" style="background:#03308B;color:#C9A84C;border:none;font-weight:700" onclick="scanManualApply()">Use</button></div>
  </div>`;
  ov.classList.add('open');
  startScan();
};
function startScan(){
  const hint=document.getElementById('scanHint');
  if(typeof ZXing==="undefined"){ if(hint){hint.textContent="Scanner library not loaded — type the code manually below."; hint.style.color="#C62828";} return; }
  try{
    _zxReader=new ZXing.BrowserMultiFormatReader();
    _zxReader.decodeFromVideoDevice(null, 'scanVid', (result, err)=>{
      if(result){ const txt=result.getText(); applyScan(txt); }
    }).catch(e=>{ if(hint){hint.textContent="Camera unavailable: "+e.message+" — type manually."; hint.style.color="#C62828";} });
  }catch(e){ if(hint){hint.textContent="Scanner error — type manually."; hint.style.color="#C62828";} }
}
function applyScan(txt){
  try{ if(navigator.vibrate) navigator.vibrate(60); }catch(e){}
  if(window._scanTarget) window._scanTarget(String(txt).trim());
  toast("Scanned: "+txt);
  closeScanner();
}
window.scanManualApply=function(){ const v=(document.getElementById('scanManual')||{}).value; if(v&&v.trim()) applyScan(v.trim()); };
window.closeScanner=function(){
  try{ if(_zxReader){_zxReader.reset();_zxReader=null;} }catch(e){}
  const ov=document.getElementById('scanOv'); if(ov)ov.classList.remove('open');
  render();
};

Object.defineProperty(window,'assetFilterWarranty',{get:()=>assetFilterWarranty,set:v=>assetFilterWarranty=v});
