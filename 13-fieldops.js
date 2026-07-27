// ═══════════════════════════════════════════════════════════════════════════
//  13-fieldops.js  (v174)
//  Five field-operations capabilities, deliberately kept in one new module
//  rather than swelling 12-exports.js: each is self-contained, so any single
//  one can be audited or rolled back without touching the report engine.
//
//    A. Geofence verification      — turn a captured GPS fix into proof of attendance
//    B. Photo annotation           — turn a defect photo into evidence
//    C. Spare parts consumption    — the material side of a job's cost
//    D. CSV import                 — onboard a client's asset register in minutes
//    E. Technician dispatch board  — who is going where, this week
//
//  Every feature owns its own window state keys and its own render function.
//  Nothing here mutates another feature's state.
// ═══════════════════════════════════════════════════════════════════════════

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  A.  GEOFENCE VERIFICATION                                             ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// Daily entries already carry gpsLat/gpsLng (see saveDaily). What was missing
// was the other half of the comparison: where the site actually IS. Each site
// may now hold lat/lng/radius, and an entry can be judged against it.

const GEO_DEFAULT_RADIUS = 150;   // metres — generous enough for a building footprint

// Haversine. Returns metres. Accurate to well under a metre at these distances.
function geoDistanceM(lat1, lng1, lat2, lng2){
  const toRad = d => d * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

// Find the fence for an entry's "Area › Site" string.
function geoFenceFor(projectName, siteLabel){
  const proj = (state.projects||[]).find(p=>(p.name||"").trim()===String(projectName||"").trim());
  if(!proj) return null;
  const areas = (typeof getProjectAreas==="function") ? getProjectAreas(proj) : (proj.areas||[]);
  const label = String(siteLabel||"").trim();
  if(!label) return null;
  for(const a of areas){
    for(const s of (a.sites||[])){
      const full = [a.name, s.name].filter(Boolean).join(" \u203a ");
      if(full===label || s.name===label){
        if(s.lat==null || s.lng==null || s.lat==="" || s.lng==="") return null;
        return {area:a.name, site:s.name, lat:Number(s.lat), lng:Number(s.lng),
                radius:Number(s.radius||GEO_DEFAULT_RADIUS)};
      }
    }
  }
  return null;
}

// The verdict for one entry. Never guesses: an absent fence or an absent fix
// is reported as such, not as a pass.
function geoCheck(entry){
  if(!entry) return {state:"none", label:"\u2014"};
  if(entry.gpsDenied)               return {state:"denied",  label:"GPS denied", note:String(entry.gpsDenied)};
  if(entry.gpsLat==null || entry.gpsLng==null)
                                    return {state:"no-gps",  label:"No fix"};
  const fence = geoFenceFor(entry.project, entry.site);
  if(!fence)                        return {state:"no-fence",label:"No fence set"};
  const m = geoDistanceM(Number(entry.gpsLat), Number(entry.gpsLng), fence.lat, fence.lng);
  const inside = m <= fence.radius;
  return {state: inside?"inside":"outside", metres:m, fence,
          label: inside ? `On site (${m} m)` : `${m} m away`};
}

const GEO_STYLE = {
  inside:  {bg:"#E8F5E9", fg:"#2E7D32", ic:"\u2713"},
  outside: {bg:"#FDECEA", fg:"#C62828", ic:"\u2716"},
  denied:  {bg:"#FFF3E0", fg:"#E65100", ic:"\u26a0"},
  "no-gps":{bg:"#F5F8FC", fg:"#6B7B8F", ic:"\u2014"},
  "no-fence":{bg:"#F5F8FC", fg:"#6B7B8F", ic:"\u25CB"},
  none:    {bg:"#F5F8FC", fg:"#6B7B8F", ic:"\u2014"},
};
function geoBadge(entry){
  const r = geoCheck(entry), s = GEO_STYLE[r.state] || GEO_STYLE.none;
  return `<span title="${escapeHtml(r.note||r.label)}" style="background:${s.bg};color:${s.fg};padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap">${s.ic} ${escapeHtml(r.label)}</span>`;
}

// Percentage of GPS-bearing entries that fell inside their fence.
function geoCompliance(projectName, from, to){
  const rows = (state.daily||[]).filter(r=>{
    if(projectName && (r.project||"").trim()!==String(projectName).trim()) return false;
    if(from && (r.date||"")<from) return false;
    if(to   && (r.date||"")>to)   return false;
    return true;
  });
  let inside=0, outside=0, unverifiable=0;
  rows.forEach(r=>{
    const g=geoCheck(r);
    if(g.state==="inside") inside++;
    else if(g.state==="outside") outside++;
    else unverifiable++;
  });
  const judged = inside+outside;
  return {total:rows.length, inside, outside, unverifiable,
          pct: judged ? Math.round(inside/judged*100) : null};
}

Object.assign(window,{geoDistanceM, geoFenceFor, geoCheck, geoBadge, geoCompliance,
                     GEO_DEFAULT_RADIUS});

// ── Site coordinate editing (inside the existing Sites modal) ─────────────
window.geoSetSiteCoord = async function(ai, si, field, value){
  if(!isAdmin()) return toast("Admin only");
  const proj = (state.projects||[]).find(p=>p.id===window.sitesModalProjId);
  if(!proj) return;
  const areas = getProjectAreas(proj).map(a=>({...a, sites:(a.sites||[]).map(s=>({...s}))}));
  const site = areas[ai] && areas[ai].sites && areas[ai].sites[si];
  if(!site) return;
  const v = String(value==null?"":value).trim();
  if(v===""){ delete site[field]; }
  else {
    const n = Number(v);
    if(!isFinite(n)) return toast("Enter a number");
    if(field==="lat" && (n<-90  || n>90))  return toast("Latitude must be between -90 and 90");
    if(field==="lng" && (n<-180 || n>180)) return toast("Longitude must be between -180 and 180");
    if(field==="radius" && (n<10 || n>20000)) return toast("Radius must be 10\u201320000 m");
    site[field] = n;
  }
  await saveAreasToProject(proj, areas);
  if(typeof showSitesModal==="function") showSitesModal();
  saveToast("Site fence updated \u2713");
};

// Drop the current position onto a site — the practical way to set a fence:
// stand at the door and press the button.
window.geoStampSite = async function(ai, si){
  if(!isAdmin()) return toast("Admin only");
  toast("\u{1F4E1} Reading current position\u2026");
  const fix = await captureGPS();
  if(fix.denied) return toast("\u26a0 " + (fix.reason||"Location unavailable"));
  const proj = (state.projects||[]).find(p=>p.id===window.sitesModalProjId);
  if(!proj) return;
  const areas = getProjectAreas(proj).map(a=>({...a, sites:(a.sites||[]).map(s=>({...s}))}));
  const site = areas[ai] && areas[ai].sites && areas[ai].sites[si];
  if(!site) return;
  site.lat = fix.lat; site.lng = fix.lng;
  if(site.radius==null) site.radius = GEO_DEFAULT_RADIUS;
  await saveAreasToProject(proj, areas);
  if(typeof showSitesModal==="function") showSitesModal();
  saveToast(`Fence set from current position (\u00b1${fix.accuracy} m) \u2713`);
};

// The row of controls rendered under each site in the Sites modal.
function geoSiteRow(ai, si, s){
  const has = s.lat!=null && s.lng!=null && s.lat!=="" && s.lng!=="";
  return `<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:5px;padding-left:8px">
    <span style="font-size:10px;font-weight:700;color:${has?"#2E7D32":"var(--muted)"};min-width:56px">${has?"\u{1F4CD} fenced":"\u25CB no fence"}</span>
    <input value="${s.lat!=null?escapeHtml(String(s.lat)):""}" placeholder="lat" inputmode="decimal"
      onchange="geoSetSiteCoord(${ai},${si},'lat',this.value)" style="width:88px;font-size:11px">
    <input value="${s.lng!=null?escapeHtml(String(s.lng)):""}" placeholder="lng" inputmode="decimal"
      onchange="geoSetSiteCoord(${ai},${si},'lng',this.value)" style="width:88px;font-size:11px">
    <input value="${s.radius!=null?escapeHtml(String(s.radius)):""}" placeholder="${GEO_DEFAULT_RADIUS}m" inputmode="numeric"
      onchange="geoSetSiteCoord(${ai},${si},'radius',this.value)" style="width:62px;font-size:11px">
    <button class="btn btn-sm btn-secondary" style="font-size:10px" onclick="geoStampSite(${ai},${si})" title="Set from where you are standing">\u{1F4E1} Here</button>
  </div>`;
}
Object.assign(window,{geoSiteRow});

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  B.  PHOTO ANNOTATION                                                  ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// A photo of a fault proves something happened. A photo with an arrow on the
// loose terminal proves WHAT happened. Same canvas technique as the signature
// pad, flattened back into the same dataURL slot so nothing downstream changes.

window._anno = null;   // {path, index, tool, colour, strokes:[], base, w, h}
const ANNO_COLOURS = ["#E53935","#FB8C00","#FDD835","#43A047","#1E88E5","#FFFFFF","#000000"];
const ANNO_TOOLS   = [
  {id:"arrow", ic:"\u2197", lb:"Arrow"},
  {id:"circle",ic:"\u25EF", lb:"Circle"},
  {id:"box",   ic:"\u25AD", lb:"Box"},
  {id:"free",  ic:"\u270F", lb:"Draw"},
];

// The photo arrays live on window under different names per report. Resolve by
// path so one editor serves every one of them.
function _annoArr(path){
  const a = window[path];
  return Array.isArray(a) ? a : null;
}

window.annoOpen = function(path, index){
  const arr = _annoArr(path);
  if(!arr || !arr[index]) return toast("Photo not found");
  const src = typeof arr[index]==="string" ? arr[index] : (arr[index].data || arr[index].src || "");
  if(!src) return toast("This photo cannot be annotated");
  window._anno = {path, index, tool:"arrow", colour:ANNO_COLOURS[0], strokes:[], base:src, w:0, h:0};
  render();
  setTimeout(annoPaint, 60);
};
window.annoClose = function(){ window._anno=null; render(); };
window.annoTool   = function(t){ if(window._anno){ window._anno.tool=t;   render(); setTimeout(annoPaint,20); } };
window.annoColour = function(c){ if(window._anno){ window._anno.colour=c; render(); setTimeout(annoPaint,20); } };
window.annoUndo   = function(){ const A=window._anno; if(A&&A.strokes.length){ A.strokes.pop(); annoPaint(); } };
window.annoReset  = function(){ const A=window._anno; if(A){ A.strokes=[]; annoPaint(); } };

// Draw base image + every stroke. Called on every change; cheap enough because
// the stroke list is short and the image is already decoded by the browser.
function annoPaint(){
  const A = window._anno; if(!A) return;
  const cv = document.getElementById("annoCanvas"); if(!cv) return;
  const img = document.getElementById("annoImg");   if(!img || !img.complete) return;
  const box = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  if(!cv._sized){
    cv.width  = Math.round(box.width  * dpr);
    cv.height = Math.round(box.height * dpr);
    cv._sized = true;
  }
  A.w = box.width; A.h = box.height;
  const c = cv.getContext("2d");
  c.setTransform(dpr,0,0,dpr,0,0);
  c.clearRect(0,0,box.width,box.height);
  c.drawImage(img, 0, 0, box.width, box.height);
  A.strokes.forEach(s=>_annoDraw(c, s, box.width, box.height));
}
function _annoDraw(c, s, W, H){
  const x1=s.x1*W, y1=s.y1*H, x2=s.x2*W, y2=s.y2*H;
  const lw = Math.max(2, Math.round(Math.min(W,H)/110));
  c.strokeStyle = s.colour; c.fillStyle = s.colour;
  c.lineWidth = lw; c.lineCap="round"; c.lineJoin="round";
  if(s.tool==="free"){
    if(!s.pts || s.pts.length<2) return;
    c.beginPath(); c.moveTo(s.pts[0].x*W, s.pts[0].y*H);
    for(let i=1;i<s.pts.length;i++) c.lineTo(s.pts[i].x*W, s.pts[i].y*H);
    c.stroke(); return;
  }
  if(s.tool==="circle"){
    const cx=(x1+x2)/2, cy=(y1+y2)/2;
    const rx=Math.abs(x2-x1)/2, ry=Math.abs(y2-y1)/2;
    c.beginPath(); c.ellipse(cx,cy,Math.max(rx,3),Math.max(ry,3),0,0,Math.PI*2); c.stroke(); return;
  }
  if(s.tool==="box"){
    c.beginPath(); c.rect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1)); c.stroke(); return;
  }
  // arrow
  c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
  const ang = Math.atan2(y2-y1, x2-x1), head = Math.max(9, lw*3.4);
  c.beginPath();
  c.moveTo(x2,y2);
  c.lineTo(x2-head*Math.cos(ang-Math.PI/7), y2-head*Math.sin(ang-Math.PI/7));
  c.lineTo(x2-head*Math.cos(ang+Math.PI/7), y2-head*Math.sin(ang+Math.PI/7));
  c.closePath(); c.fill();
}

// Coordinates are stored 0..1 so a stroke survives rotation and any redisplay
// size — the same reason the signature pad rebuilds on resize.
function _annoPos(e){
  const cv=document.getElementById("annoCanvas"); const b=cv.getBoundingClientRect();
  return {x:Math.min(1,Math.max(0,(e.clientX-b.left)/b.width)),
          y:Math.min(1,Math.max(0,(e.clientY-b.top )/b.height))};
}
window.annoDown = function(e){
  const A=window._anno; if(!A) return;
  e.preventDefault();
  const p=_annoPos(e);
  A.live = {tool:A.tool, colour:A.colour, x1:p.x, y1:p.y, x2:p.x, y2:p.y, pts:[p]};
  A.strokes.push(A.live);
  window._sigLastDraw = Date.now();      // shares the swipe-navigation guard
  annoPaint();
};
window.annoMove = function(e){
  const A=window._anno; if(!A||!A.live) return;
  e.preventDefault();
  const p=_annoPos(e);
  A.live.x2=p.x; A.live.y2=p.y;
  if(A.live.tool==="free") A.live.pts.push(p);
  window._sigLastDraw = Date.now();
  annoPaint();
};
window.annoUp = function(e){
  const A=window._anno; if(!A) return;
  // A tap with no movement leaves no mark, exactly like the signature pad.
  if(A.live){
    const moved = Math.abs(A.live.x2-A.live.x1)>0.01 || Math.abs(A.live.y2-A.live.y1)>0.01
                  || (A.live.tool==="free" && A.live.pts.length>3);
    if(!moved) A.strokes.pop();
  }
  A.live=null;
  window._sigLastDraw = Date.now();
  annoPaint();
};

// Flatten at the image's OWN resolution, not the on-screen size, so the saved
// photo keeps its detail.
window.annoSave = async function(){
  const A=window._anno; if(!A) return;
  if(!A.strokes.length) return toast("Nothing drawn yet");
  const img=document.getElementById("annoImg");
  if(!img || !img.naturalWidth) return toast("Image not ready");
  const out=document.createElement("canvas");
  out.width=img.naturalWidth; out.height=img.naturalHeight;
  const c=out.getContext("2d");
  c.drawImage(img,0,0,out.width,out.height);
  A.strokes.forEach(s=>_annoDraw(c,s,out.width,out.height));
  let data;
  try{ data = out.toDataURL("image/jpeg", 0.82); }
  catch(e){ return toast("Could not save the annotation"); }
  const arr=_annoArr(A.path);
  if(!arr || !arr[A.index]) return toast("Photo no longer available");
  if(typeof arr[A.index]==="string") arr[A.index]=data;
  else if(arr[A.index] && typeof arr[A.index]==="object"){
    if("data" in arr[A.index]) arr[A.index].data=data; else arr[A.index].src=data;
    arr[A.index].annotated=true;
  }
  window._anno=null;
  render();
  toast("Annotation applied \u2713");
};

function renderAnnoEditor(){
  const A=window._anno; if(!A) return "";
  return `<div class="no-swipe" style="position:fixed;inset:0;z-index:9000;background:rgba(10,18,32,.94);display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#0F2347;color:#fff;flex-wrap:wrap">
      <strong style="font-size:13px">\u{1F58D} Annotate photo</strong>
      <span style="font-size:10px;opacity:.75">${A.strokes.length} mark${A.strokes.length===1?"":"s"}</span>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button class="btn btn-sm btn-secondary" onclick="annoUndo()">Undo</button>
        <button class="btn btn-sm btn-secondary" onclick="annoReset()">Clear</button>
        <button class="btn btn-sm btn-secondary" onclick="annoClose()">Cancel</button>
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:8px;overflow:hidden">
      <div style="position:relative;max-width:100%;max-height:100%">
        <img id="annoImg" src="${escapeHtml(A.base)}" onload="annoPaint()"
             style="display:block;max-width:100%;max-height:66vh;visibility:hidden;position:absolute">
        <canvas id="annoCanvas" class="no-swipe"
          style="display:block;max-width:100%;max-height:66vh;width:min(92vw,720px);height:auto;aspect-ratio:4/3;touch-action:none;background:#000;border-radius:8px"
          onpointerdown="annoDown(event)" onpointermove="annoMove(event)"
          onpointerup="annoUp(event)" onpointerleave="annoUp(event)" onpointercancel="annoUp(event)"></canvas>
      </div>
    </div>
    <div style="padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#0F2347">
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
        ${ANNO_TOOLS.map(t=>`<button class="btn btn-sm ${A.tool===t.id?"":"btn-secondary"}" style="${A.tool===t.id?"background:#C9A84C;color:#1B3A6B;border:none;":""}font-weight:700;font-size:11px" onclick="annoTool('${t.id}')">${t.ic} ${t.lb}</button>`).join("")}
      </div>
      <div style="display:flex;gap:7px;justify-content:center;margin-top:9px">
        ${ANNO_COLOURS.map(c=>`<button onclick="annoColour('${c}')" title="${c}" style="width:26px;height:26px;border-radius:50%;background:${c};border:${A.colour===c?"3px solid #C9A84C":"2px solid rgba(255,255,255,.4)"};cursor:pointer"></button>`).join("")}
      </div>
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:800;border:none;width:100%;margin-top:10px" onclick="annoSave()">\u2713 Apply to photo</button>
    </div>
  </div>`;
}
Object.assign(window,{renderAnnoEditor, annoPaint, ANNO_COLOURS, ANNO_TOOLS});

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  C.  SPARE PARTS CONSUMPTION                                           ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// Girêk already knew what a job COST in labour. It did not know what it cost
// in material, so warranty claims and job profitability were both incomplete.
// A catalogue lives in `parts`; consumption is recorded on the work entry.

window._partForm = window._partForm || {code:"", name:"", unit:"pcs", unitCost:"", stock:""};
window._partEdit = window._partEdit || null;
const PART_UNITS = ["pcs","m","roll","box","set","kg","L"];

function partsList(){
  return (state.parts||[]).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
}
function partByCode(code){
  const c=String(code||"").trim().toLowerCase();
  return (state.parts||[]).find(p=>String(p.code||"").trim().toLowerCase()===c) || null;
}
// Total material value on one entry. Falls back to the catalogue price when the
// line does not carry its own, but a line's own price always wins so history is
// not rewritten by a later price change.
function partsLineCost(line){
  const unit = (line.unitCost!=null && line.unitCost!=="") ? Number(line.unitCost)
             : Number((partByCode(line.code)||{}).unitCost||0);
  return (Number(line.qty||0) * (isFinite(unit)?unit:0));
}
function partsEntryCost(entry){
  return ((entry&&entry.partsUsed)||[]).reduce((s,l)=>s+partsLineCost(l),0);
}
// Consumption across a project / period, aggregated per part.
function partsConsumption(projectName, from, to){
  const rows=(state.daily||[]).filter(r=>{
    if(projectName && (r.project||"").trim()!==String(projectName).trim()) return false;
    if(from && (r.date||"")<from) return false;
    if(to   && (r.date||"")>to)   return false;
    return Array.isArray(r.partsUsed) && r.partsUsed.length;
  });
  const agg={};
  rows.forEach(r=>(r.partsUsed||[]).forEach(l=>{
    const k=String(l.code||l.name||"?").trim();
    if(!agg[k]) agg[k]={code:l.code||"", name:l.name||k, unit:l.unit||"", qty:0, cost:0};
    agg[k].qty  += Number(l.qty||0);
    agg[k].cost += partsLineCost(l);
  }));
  const lines=Object.values(agg).sort((a,b)=>b.cost-a.cost);
  return {lines, totalCost:lines.reduce((s,l)=>s+l.cost,0), entries:rows.length};
}
Object.assign(window,{partsList, partByCode, partsLineCost, partsEntryCost, partsConsumption, PART_UNITS});

// ── Catalogue admin ──
window.partSet = function(k,v){ window._partForm[k]=v; };
window.partEditStart = function(id){
  const p=(state.parts||[]).find(x=>x.id===id); if(!p) return;
  window._partEdit=id;
  window._partForm={code:p.code||"", name:p.name||"", unit:p.unit||"pcs",
                    unitCost:p.unitCost!=null?String(p.unitCost):"", stock:p.stock!=null?String(p.stock):""};
  render();
};
window.partEditCancel = function(){ window._partEdit=null; window._partForm={code:"",name:"",unit:"pcs",unitCost:"",stock:""}; render(); };
window.partSave = async function(){
  if(!isAdmin()) return toast("Admin only");
  const f=window._partForm;
  const name=String(f.name||"").trim(), code=String(f.code||"").trim();
  if(!name) return toast("\u26a0 Part name is required");
  if(!code) return toast("\u26a0 Part code is required");
  const clash=(state.parts||[]).find(p=>p.id!==window._partEdit &&
      String(p.code||"").trim().toLowerCase()===code.toLowerCase());
  if(clash) return toast(`\u26a0 Code "${code}" already exists`);
  await fbSave("parts",{
    id: window._partEdit||undefined,
    code, name,
    unit: f.unit||"pcs",
    unitCost: f.unitCost===""?0:Number(f.unitCost||0),
    stock:    f.stock===""?null:Number(f.stock||0),
  });
  const editing=!!window._partEdit;
  window._partEdit=null;
  window._partForm={code:"",name:"",unit:"pcs",unitCost:"",stock:""};
  saveToast(editing?"Part updated \u2713":"Part added \u2713");
  render();
};
window.partDel = async function(id){
  if(!isAdmin()) return toast("Admin only");
  const p=(state.parts||[]).find(x=>x.id===id); if(!p) return;
  // Consumption records embed the part's own name and price, so deleting the
  // catalogue entry never corrupts history — but say how many rows refer to it.
  const used=(state.daily||[]).filter(r=>(r.partsUsed||[]).some(l=>
      String(l.code||"").toLowerCase()===String(p.code||"").toLowerCase())).length;
  const msg = used
    ? `Delete "${p.name}"?\n\n${used} work entr${used>1?"ies":"y"} already recorded it. Those records keep their own description and price \u2014 only the catalogue entry goes.`
    : `Delete "${p.name}"?`;
  if(!await uiConfirm(msg)) return;
  await fbDelete("parts", id);
  toast("Part deleted");
};

// ── Consumption lines on a work entry ──
window.puAdd = function(){
  if(!Array.isArray(window.dailyForm.partsUsed)) window.dailyForm.partsUsed=[];
  window.dailyForm.partsUsed.push({code:"",name:"",unit:"",qty:1,unitCost:""});
  render();
};
window.puDel = function(i){ (window.dailyForm.partsUsed||[]).splice(i,1); render(); };
window.puPick = function(i,code){
  const L=(window.dailyForm.partsUsed||[])[i]; if(!L) return;
  const p=partByCode(code);
  L.code = code||"";
  if(p){ L.name=p.name||""; L.unit=p.unit||""; L.unitCost=(p.unitCost!=null?String(p.unitCost):""); }
  render();
};
window.puSet = function(i,k,v){
  const L=(window.dailyForm.partsUsed||[])[i]; if(!L) return;
  L[k]=v;
  const el=document.getElementById("puTotal");
  if(el) el.textContent = fmtMoney(partsEntryCost(window.dailyForm));
};

function renderPartsLines(){
  const lines=(window.dailyForm && window.dailyForm.partsUsed) || [];
  const cat=partsList();
  return `<div class="card" style="border-left:4px solid #6D4C41">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\u{1F527} Spare parts used
      <span style="font-size:10px;color:var(--muted);font-weight:500">(${lines.length})</span>
      <span style="margin-left:auto;font-size:12px;font-weight:800;color:#6D4C41">Material: <span id="puTotal">${fmtMoney(partsEntryCost(window.dailyForm||{}))}</span></span>
    </div>
    ${!cat.length?`<div style="font-size:11px;color:var(--muted);line-height:1.6;padding:6px 0">No parts catalogue yet \u2014 add parts in <strong>Assets \u2192 Spare Parts</strong> first, or type a description directly on a line.</div>`:""}
    ${lines.map((L,i)=>`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px;padding-bottom:8px;border-bottom:1px solid var(--line)">
      <span style="font-size:10px;font-weight:800;color:var(--muted);min-width:20px">${String(i+1).padStart(2,"0")}</span>
      <select onchange="puPick(${i},this.value)" style="flex:1;min-width:130px">
        <option value="">\u2014 free text \u2014</option>
        ${cat.map(p=>`<option value="${escapeHtml(p.code||"")}" ${String(L.code||"")===String(p.code||"")?"selected":""}>${escapeHtml(p.code||"")} \u00b7 ${escapeHtml(p.name||"")}</option>`).join("")}
      </select>
      <input value="${escapeHtml(L.name||"")}" oninput="puSet(${i},'name',this.value)" placeholder="Description" style="flex:1;min-width:120px">
      <input value="${escapeHtml(String(L.qty==null?"":L.qty))}" oninput="puSet(${i},'qty',this.value)" placeholder="Qty" inputmode="decimal" style="width:62px">
      <input value="${escapeHtml(String(L.unitCost==null?"":L.unitCost))}" oninput="puSet(${i},'unitCost',this.value)" placeholder="Unit cost" inputmode="decimal" style="width:86px">
      <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="puDel(${i})">\u00d7</button>
    </div>`).join("")}
    <button class="btn btn-sm btn-secondary" style="margin-top:10px" onclick="puAdd()">+ Add part</button>
  </div>`;
}

function renderSpareParts(){
  if(!(isAdmin()||hasCap("canAssets"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  // The catalogue is a new Firestore collection. Until a rule exists the listener
  // is denied, and a bare empty list would look like a bug in the app.
  if(window._syncDenied && window._syncDenied.parts){
    return `<div class="card" style="background:#FFF8E1;border:1px solid #FFE082">
      <div class="card-title" style="color:#7F6000">⚠ Firestore rule missing for "parts"</div>
      <p style="font-size:12px;color:#7F6000;line-height:1.8">The spare-parts catalogue is a new collection, so your security rules do not allow it yet. Add this beside the other collections, publish, then reload:</p>
      <pre style="background:#1B2A44;color:#E8F0FE;padding:10px 12px;border-radius:8px;font-size:11px;overflow-x:auto;line-height:1.7">match /parts/{id} {
  allow read:  if request.auth != null;
  allow write: if request.auth != null;
}</pre>
      <p style="font-size:11px;color:#7F6000;line-height:1.7;margin-top:8px">Use the same conditions you already have for <strong>devices</strong>. Nothing else in the app is affected.</p>
    </div>`;
  }
  const f=window._partForm, cat=partsList();
  const used = (code)=>(state.daily||[]).reduce((s,r)=>s+((r.partsUsed||[]).filter(l=>
      String(l.code||"").toLowerCase()===String(code||"").toLowerCase())
      .reduce((q,l)=>q+Number(l.qty||0),0)),0);
  return `<div class="card">
    <div class="sec-hdr">\u{1F527} ${window._partEdit?"Edit part":"Add a part"}</div>
    <div class="form-grid">
      <div class="field"><label>Code <span class="req">*</span></label><input value="${escapeHtml(f.code||"")}" oninput="partSet('code',this.value)" placeholder="e.g. CBL-CAT6-305"></div>
      <div class="field"><label>Name <span class="req">*</span></label><input value="${escapeHtml(f.name||"")}" oninput="partSet('name',this.value)" placeholder="e.g. Cat6 UTP cable box"></div>
      <div class="field"><label>Unit</label><select onchange="partSet('unit',this.value)">
        ${PART_UNITS.map(u=>`<option ${f.unit===u?"selected":""}>${u}</option>`).join("")}</select></div>
      <div class="field"><label>Unit cost</label><input value="${escapeHtml(String(f.unitCost||""))}" oninput="partSet('unitCost',this.value)" inputmode="decimal" placeholder="0"></div>
      <div class="field"><label>Stock on hand <span style="font-weight:500;color:var(--muted);font-size:10px">\u2014 optional</span></label><input value="${escapeHtml(String(f.stock||""))}" oninput="partSet('stock',this.value)" inputmode="decimal" placeholder="leave blank if not tracked"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <button class="btn btn-primary" onclick="partSave()">${window._partEdit?"Save changes":"Add part"}</button>
      ${window._partEdit?`<button class="btn btn-secondary" onclick="partEditCancel()">Cancel</button>`:""}
    </div>
  </div>
  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">Catalogue <span style="font-size:10px;color:var(--muted);font-weight:500">(${cat.length})</span></div>
    ${!cat.length?`<div class="empty">No parts yet.</div>`:cat.map(p=>{
      const q=used(p.code);
      const low = p.stock!=null && p.stock!=="" && Number(p.stock)<=0;
      return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="flex:1;min-width:150px">
          <div style="font-weight:800;font-size:12px">${escapeHtml(p.name||"")}</div>
          <div style="font-size:10px;color:var(--muted)">${escapeHtml(p.code||"")} \u00b7 ${escapeHtml(p.unit||"")} \u00b7 ${fmtMoney(p.unitCost||0)}${p.stock!=null&&p.stock!==""?` \u00b7 stock ${escapeHtml(String(p.stock))}`:""}</div>
        </div>
        ${q?`<span style="background:#EFEBE9;color:#6D4C41;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">used ${q}</span>`:""}
        ${low?`<span style="background:#FDECEA;color:#C62828;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">out of stock</span>`:""}
        <button class="btn btn-sm btn-secondary" onclick="partEditStart('${p.id}')">\u270e</button>
        <button class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="partDel('${p.id}')">\u00d7</button>
      </div>`;}).join("")}
  </div>`;
}
Object.assign(window,{renderSpareParts, renderPartsLines});

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  D.  CSV IMPORT                                                        ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// Winning a contract used to mean typing a client's whole asset register by
// hand. The parser below is written out rather than pulled from a library
// because a naive split(",") mangles every real export: quoted fields hold
// commas, quotes are escaped by doubling, records span lines, Excel writes a
// BOM and CRLF, and a trailing newline must not create a phantom row.

function csvParse(text){
  let s = String(text==null?"":text);
  if(s.charCodeAt(0)===0xFEFF) s = s.slice(1);          // strip the Excel BOM
  const rows=[]; let row=[]; let field=""; let i=0; let q=false; let any=false;
  const endField=()=>{ row.push(field); field=""; any=true; };
  const endRow  =()=>{ endField(); rows.push(row); row=[]; any=false; };
  while(i < s.length){
    const ch=s[i];
    if(q){
      if(ch === '"'){
        if(s[i+1] === '"'){ field+='"'; i+=2; continue; }   // "" -> literal quote
        q=false; i++; continue;
      }
      field+=ch; i++; continue;
    }
    if(ch === '"'){ q=true; any=true; i++; continue; }
    if(ch === ','){ endField(); i++; continue; }
    if(ch === '\r'){ if(s[i+1] === '\n') i++; endRow(); i++; continue; }
    if(ch === '\n'){ endRow(); i++; continue; }
    field+=ch; i++;
  }
  // A trailing newline must not become an empty record.
  if(field !== "" || any || row.length) endRow();
  return rows.filter(r=>!(r.length===1 && String(r[0]).trim()===""));
}
Object.assign(window,{csvParse});

// What a row may be mapped onto. `req` marks a column the row cannot exist
// without; `norm` cleans the raw text.
const CSV_TARGETS = {
  devices:{
    label:"Assets / devices", col:"devices",
    fields:[
      {k:"deviceName",   lb:"Device name",  req:true},
      {k:"serialNumber", lb:"Serial number", key:true},
      {k:"model",        lb:"Model"},
      {k:"brand",        lb:"Brand"},
      {k:"system",       lb:"System"},
      {k:"project",      lb:"Project", req:true},
      {k:"area",         lb:"Area"},
      {k:"site",         lb:"Site"},
      {k:"status",       lb:"Status"},
      {k:"installDate",  lb:"Install date", norm:"date"},
      {k:"warrantyEnd",  lb:"Warranty end", norm:"date"},
    ],
  },
  parts:{
    label:"Spare parts catalogue", col:"parts",
    fields:[
      {k:"code",     lb:"Code", req:true, key:true},
      {k:"name",     lb:"Name", req:true},
      {k:"unit",     lb:"Unit"},
      {k:"unitCost", lb:"Unit cost", norm:"num"},
      {k:"stock",    lb:"Stock",     norm:"num"},
    ],
  },
};
window._csv = window._csv || {target:"devices", raw:"", rows:null, header:[], map:{}, busy:false, done:null, fileName:""};

// Accepts 2026-07-26, 26/07/2026, 26-07-2026, 07/26/2026 is NOT assumed —
// ambiguity is refused rather than guessed at.
function csvNormDate(v){
  const s=String(v==null?"":v).trim();
  if(!s) return {ok:true, value:""};
  let m=/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/.exec(s);
  if(m) return {ok:true, value:`${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`};
  m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(s);
  if(m){
    const d=+m[1], mo=+m[2];
    if(d>31||mo>12) return {ok:false, why:`"${s}" is not a valid date`};
    if(d<=12 && mo<=12 && d!==mo) return {ok:false, why:`"${s}" is ambiguous \u2014 use YYYY-MM-DD`};
    return {ok:true, value:`${m[3]}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`};
  }
  return {ok:false, why:`"${s}" is not a recognised date \u2014 use YYYY-MM-DD`};
}
function csvNormNum(v){
  const s=String(v==null?"":v).trim().replace(/,/g,"");
  if(!s) return {ok:true, value:0};
  const n=Number(s);
  if(!isFinite(n)) return {ok:false, why:`"${v}" is not a number`};
  return {ok:true, value:n};
}

// Guess the mapping from the header row: exact match, then a loose match.
function csvAutoMap(header, target){
  const T=CSV_TARGETS[target]; const map={};
  const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  header.forEach((h,idx)=>{
    const hn=norm(h);
    if(!hn) return;
    let hit=T.fields.find(f=>norm(f.k)===hn) || T.fields.find(f=>norm(f.lb)===hn);
    if(!hit) hit=T.fields.find(f=>hn.includes(norm(f.k)) || norm(f.lb).includes(hn));
    if(hit && !Object.values(map).includes(hit.k)) map[idx]=hit.k;
  });
  return map;
}

// Validate every row WITHOUT writing anything. This is the whole point: the
// user sees exactly what would happen before a single document is created.
function csvDryRun(){
  const C=window._csv, T=CSV_TARGETS[C.target];
  if(!C.rows || C.rows.length<2) return {ok:[], bad:[], dupes:[], updates:[]};
  const mapped=Object.entries(C.map);
  const ok=[], bad=[], dupes=[], updates=[], nokey=[];
  const keyField=T.fields.find(f=>f.key);
  const seen=new Map();
  const existing=new Map();
  if(keyField) (state[T.col]||[]).forEach(r=>{
    const k=String(r[keyField.k]||"").trim().toLowerCase();
    if(k) existing.set(k, r);
  });

  for(let i=1;i<C.rows.length;i++){
    const raw=C.rows[i];
    if(!raw.length || raw.every(x=>String(x).trim()==="")) continue;
    const rec={}; const errs=[];
    mapped.forEach(([idx,fk])=>{
      const f=T.fields.find(x=>x.k===fk); if(!f) return;
      const cell=raw[+idx];
      if(f.norm==="date"){ const r=csvNormDate(cell); r.ok?rec[fk]=r.value:errs.push(`${f.lb}: ${r.why}`); }
      else if(f.norm==="num"){ const r=csvNormNum(cell); r.ok?rec[fk]=r.value:errs.push(`${f.lb}: ${r.why}`); }
      else rec[fk]=String(cell==null?"":cell).trim();
    });
    T.fields.filter(f=>f.req).forEach(f=>{
      if(!String(rec[f.k]||"").trim()) errs.push(`${f.lb} is required`);
    });
    // A project that does not exist would create an orphan asset.
    if(C.target==="devices" && rec.project &&
       !(state.projects||[]).some(p=>(p.name||"").trim()===rec.project))
      errs.push(`Project "${rec.project}" does not exist`);

    if(errs.length){ bad.push({line:i+1, rec, errs}); continue; }
    if(keyField){
      const k=String(rec[keyField.k]||"").trim().toLowerCase();
      if(k && seen.has(k)){ dupes.push({line:i+1, rec, why:`${keyField.lb} repeated in this file (line ${seen.get(k)})`}); continue; }
      if(k) seen.set(k, i+1);
      if(k && existing.has(k)){ updates.push({line:i+1, rec, id:existing.get(k).id}); continue; }
      // No key means no way to match this row against anything, now or later:
      // importing the same file twice would create it twice. Allowed, but said.
      if(!k) nokey.push({line:i+1, rec});
    }
    ok.push({line:i+1, rec});
  }
  return {ok, bad, dupes, updates, nokey};
}
Object.assign(window,{csvDryRun, csvAutoMap, csvNormDate, csvNormNum, CSV_TARGETS});

window.csvPickTarget = function(t){
  window._csv.target=t;
  if(window._csv.header.length) window._csv.map=csvAutoMap(window._csv.header,t);
  window._csv.done=null; render();
};
window.csvSetMap = function(idx,fk){
  const M=window._csv.map;
  // A field can be mapped once only: two columns writing one field is a silent
  // data loss, so claiming it releases the previous holder.
  Object.keys(M).forEach(k=>{ if(M[k]===fk && String(k)!==String(idx)) delete M[k]; });
  if(fk) M[idx]=fk; else delete M[idx];
  window._csv.done=null; render();
};
window.csvLoadFile = async function(input){
  const file=input && input.files && input.files[0];
  if(!file) return;
  if(file.size > 4*1024*1024) return toast("\u26a0 File larger than 4 MB \u2014 split it first");
  let text="";
  try{ text = await file.text(); }
  catch(e){ return toast("Could not read the file"); }
  const rows=csvParse(text);
  if(rows.length<2) return toast("\u26a0 The file needs a header row and at least one data row");
  window._csv.raw=text; window._csv.rows=rows;
  window._csv.header=rows[0].map(h=>String(h||"").trim());
  window._csv.fileName=file.name||"import.csv";
  window._csv.map=csvAutoMap(window._csv.header, window._csv.target);
  window._csv.done=null;
  render();
  toast(`\u2713 ${rows.length-1} data row(s) read`);
};
window.csvClear = function(){
  window._csv={target:window._csv.target, raw:"", rows:null, header:[], map:{}, busy:false, done:null, fileName:""};
  render();
};

window.csvCommit = async function(){
  if(!isAdmin()) return toast("Admin only");
  const C=window._csv, T=CSV_TARGETS[C.target];
  const dry=csvDryRun();
  const total=dry.ok.length+dry.updates.length;
  if(!total) return toast("\u26a0 Nothing valid to import");
  if(!await uiConfirm(
      `Import into ${T.label}?\n\n${dry.ok.length} new record(s)\n${dry.updates.length} existing record(s) will be updated\n${dry.bad.length+dry.dupes.length} row(s) skipped\n\nThis cannot be undone in bulk.`)) return;
  C.busy=true; render();
  let created=0, updated=0, failed=0;
  try{
    for(const r of dry.ok){
      try{ await fbSave(T.col, {...r.rec}); created++; }catch(e){ failed++; }
    }
    for(const r of dry.updates){
      try{ await fbSave(T.col, {...r.rec, id:r.id}); updated++; }catch(e){ failed++; }
    }
  } finally {
    C.busy=false;
    C.done={created, updated, failed, skipped:dry.bad.length+dry.dupes.length};
    render();
  }
  saveToast(`Imported \u2713 ${created} new, ${updated} updated${failed?`, ${failed} failed`:""}`);
};

function renderCsvImport(){
  if(!isAdmin()) return `<div class="card"><div class="empty">Admin only.</div></div>`;
  const C=window._csv, T=CSV_TARGETS[C.target];
  const dry = C.rows ? csvDryRun() : null;
  const sample = C.rows ? C.rows.slice(1,4) : [];

  return `<div class="card">
    <div class="sec-hdr">\u{1F4E5} What are you importing?</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${Object.entries(CSV_TARGETS).map(([k,v])=>`<button class="btn btn-sm ${C.target===k?"":"btn-secondary"}" style="${C.target===k?"background:#03308B;color:#fff;border:none;":""}font-weight:700;font-size:11px" onclick="csvPickTarget('${k}')">${escapeHtml(v.label)}</button>`).join("")}
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.7">
      Expected columns: ${T.fields.map(f=>`<strong>${escapeHtml(f.lb)}</strong>${f.req?"*":""}`).join(" \u00b7 ")}<br>
      <span style="font-size:10px">* required. Column order does not matter \u2014 headings are matched automatically and you can correct any of them below. Dates: <strong>YYYY-MM-DD</strong>.</span>
    </div>
    <div class="field" style="margin-top:12px"><label>CSV file</label>
      <input type="file" accept=".csv,text/csv,text/plain" onchange="csvLoadFile(this)"></div>
    ${C.rows?`<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
      <span style="font-size:11px;font-weight:700">${escapeHtml(C.fileName)}</span>
      <span style="font-size:11px;color:var(--muted)">${C.rows.length-1} data row(s), ${C.header.length} column(s)</span>
      <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="csvClear()">Clear</button>
    </div>`:""}
  </div>

  ${C.rows?`<div class="card">
    <div class="sec-hdr">Column mapping</div>
    ${C.header.map((h,i)=>`<div style="display:flex;gap:8px;align-items:center;margin-top:7px;flex-wrap:wrap;padding-bottom:7px;border-bottom:1px solid var(--line)">
      <div style="flex:1;min-width:120px">
        <div style="font-size:12px;font-weight:700">${escapeHtml(h||"(unnamed)")}</div>
        <div style="font-size:10px;color:var(--muted)">${sample.map(r=>escapeHtml(String(r[i]==null?"":r[i]).slice(0,22))).filter(Boolean).join(" \u00b7 ")||"\u2014"}</div>
      </div>
      <select onchange="csvSetMap(${i},this.value)" style="min-width:150px">
        <option value="">\u2014 ignore \u2014</option>
        ${T.fields.map(f=>`<option value="${f.k}" ${C.map[i]===f.k?"selected":""}>${escapeHtml(f.lb)}${f.req?" *":""}</option>`).join("")}
      </select>
    </div>`).join("")}
    ${(()=>{const miss=T.fields.filter(f=>f.req && !Object.values(C.map).includes(f.k));
      return miss.length?`<div style="background:#FDECEA;border:1px solid #EF9A9A;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#C62828;line-height:1.6">\u26a0 Not mapped yet: ${miss.map(f=>escapeHtml(f.lb)).join(", ")}. Every row will be rejected until these are assigned.</div>`:"";})()}
  </div>

  <div class="card">
    <div class="sec-hdr">Dry run \u2014 nothing is written yet</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px">
      ${[["New",dry.ok.length,"#2E7D32"],["Updates",dry.updates.length,"#1565C0"],
         ["Errors",dry.bad.length,"#C62828"],["Duplicates",dry.dupes.length,"#E65100"]]
        .map(([l,n,c])=>`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:19px;font-weight:800;color:${n?c:"var(--muted)"}">${n}</div>
          <div style="font-size:10px;color:var(--muted)">${l}</div></div>`).join("")}
    </div>
    ${dry.nokey.length?`<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#E65100;line-height:1.6">\u26a0 ${dry.nokey.length} row(s) carry no ${escapeHtml((T.fields.find(f=>f.key)||{}).lb||"key")}. They will be created, but nothing can match them later \u2014 importing this file again would duplicate them.</div>`:""}
    ${dry.updates.length?`<div style="background:#E3F2FD;border:1px solid #90CAF9;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#0D47A1;line-height:1.6">\u2139 ${dry.updates.length} row(s) match an existing record on its key and will be <strong>overwritten</strong>, not duplicated.</div>`:""}
    ${dry.bad.length?`<div style="margin-top:10px">
      <div style="font-size:11px;font-weight:800;color:#C62828;margin-bottom:5px">Rows that will be skipped</div>
      ${dry.bad.slice(0,12).map(b=>`<div style="font-size:11px;padding:5px 8px;background:#FDECEA;border-radius:6px;margin-bottom:4px;line-height:1.5">
        <strong>Line ${b.line}</strong> \u2014 ${b.errs.map(e=>escapeHtml(e)).join("; ")}</div>`).join("")}
      ${dry.bad.length>12?`<div style="font-size:10px;color:var(--muted)">\u2026 and ${dry.bad.length-12} more</div>`:""}
    </div>`:""}
    ${dry.dupes.length?`<div style="margin-top:10px">
      <div style="font-size:11px;font-weight:800;color:#E65100;margin-bottom:5px">Duplicates inside the file</div>
      ${dry.dupes.slice(0,8).map(b=>`<div style="font-size:11px;padding:5px 8px;background:#FFF3E0;border-radius:6px;margin-bottom:4px">
        <strong>Line ${b.line}</strong> \u2014 ${escapeHtml(b.why)}</div>`).join("")}
    </div>`:""}
    ${C.done?`<div style="background:#E8F5E9;border:1px solid #A5D6A7;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:12px;color:#1B5E20;line-height:1.7">
      \u2713 Imported: <strong>${C.done.created}</strong> new, <strong>${C.done.updated}</strong> updated${C.done.failed?`, <strong>${C.done.failed}</strong> failed`:""}${C.done.skipped?`, ${C.done.skipped} skipped`:""}.</div>`:""}
    <button class="btn btn-primary" style="width:100%;margin-top:12px" ${C.busy?"disabled":""} onclick="csvCommit()">
      ${C.busy?"Importing\u2026":`\u{1F4E5} Import ${dry.ok.length+dry.updates.length} row(s)`}</button>
  </div>`:""}`;
}
Object.assign(window,{renderCsvImport});

// ╔═════════════════════════════════════════════════════════════════════════╗
// ║  E.  TECHNICIAN DISPATCH BOARD                                         ║
// ╚═════════════════════════════════════════════════════════════════════════╝
// The data to answer "who is going where this week" already existed, scattered
// across tasks, PM schedules and the work log. This puts it on one grid so a
// clash or an idle engineer is visible instead of inferred.

window._dsp = window._dsp || {weekStart:"", project:"", cell:null};

function dspMonday(dateStr){
  const d = dateStr ? new Date(dateStr+"T00:00:00") : new Date();
  if(isNaN(d)) return null;
  const dow = d.getDay();                    // 0=Sun
  const back = (dow===0) ? 6 : dow-1;        // weeks start Monday
  d.setDate(d.getDate()-back);
  return d.toISOString().slice(0,10);
}
function dspAddDays(ds, n){
  const d=new Date(ds+"T00:00:00");
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function dspWeek(){
  const start = window._dsp.weekStart || dspMonday();
  return Array.from({length:7},(_,i)=>dspAddDays(start,i));
}
window.dspShift = function(n){
  const start = window._dsp.weekStart || dspMonday();
  window._dsp.weekStart = dspAddDays(start, n*7);
  window._dsp.cell = null;
  render();
};
window.dspToday   = function(){ window._dsp.weekStart=dspMonday(); window._dsp.cell=null; render(); };
window.dspProject = function(v){ window._dsp.project=v; window._dsp.cell=null; render(); };
window.dspCell    = function(who,day){
  const k=who+"|"+day;
  window._dsp.cell = (window._dsp.cell===k) ? null : k;
  render();
};

// Every name the app has ever seen. This is the CANDIDATE list, not the board.
function dspCandidates(){
  const set=new Set();
  (state.users||[]).forEach(u=>{ const n=(u.name||u.employeeName||"").trim(); if(n && (u.role!=="client")) set.add(n); });
  (state.nametagEmployees||[]).forEach(e=>{ const n=(e.name||"").trim(); if(n) set.add(n); });
  (state.daily||[]).forEach(r=>{ const n=(r.employee||"").trim(); if(n) set.add(n); });
  return [...set].sort((a,b)=>a.localeCompare(b));
}
// Which of them the board tracks. Stored in settings/dispatch so the choice
// follows the account, not the device. An empty selection means "not chosen
// yet" and shows everyone, so the board is never blank on first use.
function dspTracked(){
  const d=(state.settingsDocs||[]).find(x=>x.id==="dispatch")||{};
  return Array.isArray(d.people)?d.people.filter(Boolean):[];
}
function dspPeople(){
  const tracked=dspTracked();
  if(!tracked.length) return dspCandidates();
  // A tracked name is kept even with no records yet, so a new hire appears on
  // the board before their first entry.
  return [...new Set(tracked)].filter(Boolean).sort((a,b)=>a.localeCompare(b));
}
window.dspToggleTracked = async function(name){
  if(!isAdmin()) return toast("Admin only");
  const d=(state.settingsDocs||[]).find(x=>x.id==="dispatch")||{};
  let list=dspTracked();
  if(!list.length) list=dspCandidates();       // the first edit starts from everyone
  const i=list.indexOf(name);
  if(i<0) list.push(name); else list.splice(i,1);
  await fbSave("settings",{...d, id:"dispatch", people:list});
  render();
};
window.dspTrackAll = async function(on){
  if(!isAdmin()) return toast("Admin only");
  const d=(state.settingsDocs||[]).find(x=>x.id==="dispatch")||{};
  await fbSave("settings",{...d, id:"dispatch", people: on?dspCandidates():[]});
  render();
};
window.dspPickerToggle = function(){ window._dsp.picker=!window._dsp.picker; render(); };

// Three kinds of thing can occupy a person-day.
function dspLoad(){
  const days=dspWeek(), proj=(window._dsp.project||"").trim();
  const okProj=(p)=>!proj || String(p||"").trim()===proj;
  const cells={};   // "name|date" -> {logged:[], tasks:[], leave:[]}
  const touch=(who,day)=>{
    const k=who+"|"+day;
    if(!cells[k]) cells[k]={logged:[],tasks:[],leave:[]};
    return cells[k];
  };
  (state.daily||[]).forEach(r=>{
    if(!days.includes(r.date) || !okProj(r.project)) return;
    const who=(r.employee||"").trim(); if(!who) return;
    touch(who,r.date).logged.push(r);
  });
  (state.tasks||[]).forEach(t=>{
    const day=String(t.due||"").slice(0,10);
    if(!days.includes(day) || !okProj(t.project)) return;
    const who=(t.assignee||"").trim(); if(!who) return;
    touch(who,day).tasks.push(t);
  });
  (state.leaves||[]).forEach(l=>{
    const who=(l.employee||"").trim(); if(!who) return;
    days.forEach(d=>{ if(String(l.from||"")<=d && d<=String(l.to||"")) touch(who,d).leave.push(l); });
  });
  // Unassigned PM work is a week-level warning, not a person-day.
  const pmDue=(state.pmSchedules||[]).filter(s=>{
    if(!okProj(s.project)) return false;
    const due=(typeof pmNextDue==="function")?pmNextDue(s):"";
    return due && days.includes(due);
  });
  return {days, cells, pmDue};
}

function renderDispatch(){
  if(!(isAdmin()||hasCap("canMaintenance"))) return `<div class="card"><div class="empty">No access.</div></div>`;
  const {days, cells, pmDue} = dspLoad();
  const people = dspPeople();
  const projects=(state.projects||[]).map(p=>p.name).filter(Boolean).sort();
  const today=(typeof todayStr==="function")?todayStr():new Date().toISOString().slice(0,10);
  const DOW=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const hoursOf=(c)=>(c?c.logged:[]).reduce((s,r)=>s+Number(r.duration||0),0);
  const openCell=window._dsp.cell;

  const weekHours = people.reduce((s,p)=>s+days.reduce((t,d)=>t+hoursOf(cells[p+"|"+d]),0),0);
  const busiest  = people.map(p=>({p, h:days.reduce((t,d)=>t+hoursOf(cells[p+"|"+d]),0)}))
                         .sort((a,b)=>b.h-a.h)[0];
  const idle = people.filter(p=>days.every(d=>{
    const c=cells[p+"|"+d];
    return !c || (!c.logged.length && !c.tasks.length);
  }));

  return `
  <div class="card">
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" onclick="dspShift(-1)">\u2039 Prev</button>
      <button class="btn btn-sm btn-secondary" onclick="dspToday()">This week</button>
      <button class="btn btn-sm btn-secondary" onclick="dspShift(1)">Next \u203a</button>
      <strong style="font-size:12px;margin-left:auto">${escapeHtml(fmtDate(days[0]))} \u2013 ${escapeHtml(fmtDate(days[6]))}</strong>
    </div>
    <div class="field" style="margin-top:10px"><label>Project filter</label>
      <select onchange="dspProject(this.value)">
        <option value="">All projects</option>
        ${projects.map(p=>`<option ${window._dsp.project===p?"selected":""}>${escapeHtml(p)}</option>`).join("")}
      </select></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;margin-top:10px">
      ${[["Employees",people.length],["Logged hours",fmtHM(weekHours)],
         ["Busiest",busiest&&busiest.h?busiest.p.split(" ")[0]:"\u2014"],["Idle all week",idle.length]]
        .map(([l,v])=>`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:15px;font-weight:800;color:#03308B">${escapeHtml(String(v))}</div>
          <div style="font-size:10px;color:var(--muted)">${l}</div></div>`).join("")}
    </div>
    <div style="display:flex;gap:6px;align-items:center;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" onclick="dspPickerToggle()">👥 Who to track (${dspTracked().length?dspTracked().length:"all"})</button>
      ${!dspTracked().length?`<span style="font-size:10px;color:var(--muted)">no selection yet — showing everyone</span>`:""}
    </div>
    ${window._dsp.picker?`<div style="background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:8px">
      <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:8px">Tick only the people this board should follow. Subcontractors and one-off names can stay off it.</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${dspCandidates().map(n=>{const on=dspPeople().includes(n);
          return `<button class="btn btn-sm ${on?"":"btn-secondary"}" style="${on?"background:#03308B;color:#fff;border:none;":""}font-size:11px;font-weight:700" onclick="dspToggleTracked('${escapeHtml(n).replace(/'/g,"&#39;")}')">${on?"✓ ":""}${escapeHtml(n)}</button>`;}).join("")}
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn btn-sm btn-secondary" onclick="dspTrackAll(true)">Select all</button>
        <button class="btn btn-sm btn-secondary" onclick="dspTrackAll(false)">Reset to all</button>
      </div>
    </div>`:""}
    ${pmDue.length?`<div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:8px;padding:9px 11px;margin-top:10px;font-size:11px;color:#E65100;line-height:1.6">\u{1F6E0}\uFE0F ${pmDue.length} preventive maintenance visit(s) fall in this week and are not assigned to anyone: ${pmDue.slice(0,4).map(s=>escapeHtml(s.title||s.system||"PM")).join(", ")}${pmDue.length>4?"\u2026":""}</div>`:""}
  </div>

  <div class="card" style="overflow-x:auto">
    <div class="sec-hdr">\u{1F4C5} Week board</div>
    ${!people.length?`<div class="empty">No employees selected yet.</div>`:`
    <table class="data-table" style="border-collapse:collapse;min-width:640px;width:100%">
      <thead><tr>
        <th style="position:sticky;left:0;background:#03308B;color:#fff;padding:6px 9px;text-align:left;font-size:11px;z-index:1">Employee</th>
        ${days.map((d,i)=>`<th style="background:${d===today?"#C9A84C":"#03308B"};color:${d===today?"#1B3A6B":"#fff"};padding:6px 4px;font-size:10px;min-width:74px">
          ${DOW[i]}<br><span style="font-weight:400">${escapeHtml(d.slice(8)+"/"+d.slice(5,7))}</span></th>`).join("")}
      </tr></thead>
      <tbody>${people.map(who=>`<tr>
        <td style="position:sticky;left:0;background:var(--card);padding:6px 9px;font-size:11px;font-weight:700;border:1px solid var(--line);white-space:nowrap">${escapeHtml(who)}</td>
        ${days.map(d=>{
          const c=cells[who+"|"+d], k=who+"|"+d;
          const h=hoursOf(c), t=(c?c.tasks.length:0), lv=(c?c.leave.length:0);
          const bg = lv ? "#ECEFF1" : h ? "#E8F5E9" : t ? "#FFF8E1" : "transparent";
          return `<td onclick="dspCell('${escapeHtml(who).replace(/'/g,"&#39;")}','${d}')"
            style="border:1px solid var(--line);padding:4px;text-align:center;cursor:pointer;background:${bg};${openCell===k?"outline:2px solid #03308B;":""}">
            ${lv?`<div style="font-size:9px;color:#546E7A;font-weight:700">leave</div>`:""}
            ${h?`<div style="font-size:11px;font-weight:800;color:#2E7D32">${fmtHM(h)}</div>`:""}
            ${t?`<div style="font-size:9px;color:#8F6E22;font-weight:700">${t} task${t>1?"s":""}</div>`:""}
            ${(!h&&!t&&!lv)?`<span style="color:var(--line)">\u00b7</span>`:""}
          </td>`;
        }).join("")}
      </tr>`).join("")}</tbody>
    </table>`}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:9px;font-size:10px;color:var(--muted)">
      <span><span style="display:inline-block;width:10px;height:10px;background:#E8F5E9;border:1px solid var(--line)"></span> hours logged</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#FFF8E1;border:1px solid var(--line)"></span> task due</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#ECEFF1;border:1px solid var(--line)"></span> on leave</span>
    </div>
  </div>

  ${openCell?(()=>{
    const [who,d]=openCell.split("|");
    const c=cells[openCell]||{logged:[],tasks:[],leave:[]};
    return `<div class="card" style="border:2px solid #03308B">
      <div class="sec-hdr" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${escapeHtml(who)} \u00b7 ${escapeHtml(fmtDate(d))}
        <button class="btn btn-sm btn-secondary" style="margin-left:auto" onclick="dspCell('${escapeHtml(who).replace(/'/g,"&#39;")}','${d}')">Close</button></div>
      ${c.leave.length?`<div style="font-size:11px;color:#546E7A;padding:6px 0"><strong>On leave</strong> \u2014 ${c.leave.map(l=>escapeHtml(l.type||"leave")).join(", ")}</div>`:""}
      ${c.logged.length?`<div style="font-weight:800;font-size:11px;color:#2E7D32;margin-top:6px">Work logged</div>
        ${c.logged.map(r=>`<div style="font-size:11px;padding:5px 0;border-bottom:1px solid var(--line);line-height:1.6">
          <strong>${fmtHM(Number(r.duration||0))}</strong> \u00b7 ${escapeHtml(r.project||"\u2014")}${r.site?" \u00b7 "+escapeHtml(r.site):""}
          ${r.taskCategory?`<br><span style="color:var(--muted)">${escapeHtml(r.taskCategory)}</span>`:""}
          ${(r.gpsLat!=null||r.gpsDenied)?`<br>${geoBadge(r)}`:""}
          ${(r.partsUsed&&r.partsUsed.length)?`<br><span style="font-size:10px;color:#6D4C41">\u{1F527} ${r.partsUsed.length} part(s) \u00b7 ${fmtMoney(partsEntryCost(r))}</span>`:""}
        </div>`).join("")}`:""}
      ${c.tasks.length?`<div style="font-weight:800;font-size:11px;color:#8F6E22;margin-top:10px">Tasks due</div>
        ${c.tasks.map(t=>`<div style="font-size:11px;padding:5px 0;border-bottom:1px solid var(--line)">
          ${escapeHtml(t.title||"\u2014")} <span style="color:var(--muted)">\u00b7 ${escapeHtml(t.status||"")}</span></div>`).join("")}`:""}
      ${(!c.logged.length&&!c.tasks.length&&!c.leave.length)?`<div class="empty">Nothing scheduled or logged.</div>`:""}
    </div>`;})():""}`;
}
Object.assign(window,{renderDispatch, dspMonday, dspAddDays, dspWeek, dspPeople, dspCandidates, dspTracked, dspLoad});
