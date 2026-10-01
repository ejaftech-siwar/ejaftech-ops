// ═══════════════════════════════════════════════════════════════════════════
//  TECHNICAL REFERENCE GUIDE  (v272)
//
//  A document built from documents. The engineer imports Word, PDF and Excel
//  files — datasheets, method statements, schedules, drawings — and the app
//  binds them into one EJAF report: the usual header and footer, its own
//  reference number, a contents list, signatures, saved in the app and
//  exported to PDF or Word like every other report.
//
//  How faithfully each kind of file survives is not the same, and the screen
//  says so rather than letting anyone discover it on the printed page:
//
//    PDF    Every page is rendered as an image, exactly as it is. Drawings,
//           photographs, tables, fonts, colours — nothing is re-interpreted.
//           This is the route for anything that must look identical.
//    Word   Converted to formatted HTML: headings, bold/italic/underline,
//           colours, highlight, sizes, alignment, numbered and bulleted lists,
//           tables with shading and merged cells, and embedded pictures.
//           Charts, SmartArt, floating shapes and EMF/WMF drawings have no
//           browser-readable form and are marked where they occurred.
//    Excel  Every visible sheet as a formatted table: fills, bold, colours,
//           merged cells, column widths, and the number format of each cell
//           (currency, percent, dates). Charts and pictures are not read.
//
//  Everything below the first section is pure — string in, string out — so
//  it is tested against real .docx and .xlsx files built for the purpose.
// ═══════════════════════════════════════════════════════════════════════════

// ─── A small XML reader ────────────────────────────────────────────────────
// Office files are well-formed XML. A regular expression cannot follow a
// table nested in a table, or a run inside a hyperlink inside a content
// control, so the markup is read into a real tree. Written here rather than
// taken from DOMParser so the identical code runs in the browser and in the
// tests.
const _TRG_ENT = {amp:"&", lt:"<", gt:">", quot:'"', apos:"'"};
function _trgDecode(s){
  return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if(e[0] === "#"){
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try{ return String.fromCodePoint(cp); }catch(_){ return ""; }
    }
    return _TRG_ENT[e];
  });
}
function _trgXml(src){
  src = String(src || "");
  const root = {n:"#root", a:{}, c:[]};
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0; const L = src.length;
  while(i < L){
    const lt = src.indexOf("<", i);
    if(lt < 0){ const t = src.slice(i); if(t) top().c.push({t:_trgDecode(t)}); break; }
    if(lt > i) top().c.push({t:_trgDecode(src.slice(i, lt))});
    if(src.startsWith("<!--", lt)){ const e = src.indexOf("-->", lt + 4); i = e < 0 ? L : e + 3; continue; }
    if(src.startsWith("<![CDATA[", lt)){
      const e = src.indexOf("]]>", lt + 9);
      top().c.push({t: src.slice(lt + 9, e < 0 ? L : e)});
      i = e < 0 ? L : e + 3; continue;
    }
    if(src[lt + 1] === "?" || src[lt + 1] === "!"){ const e = src.indexOf(">", lt); i = e < 0 ? L : e + 1; continue; }
    // End of the tag, ignoring any ">" inside a quoted attribute value.
    let j = lt + 1, q = "";
    while(j < L){
      const ch = src[j];
      if(q){ if(ch === q) q = ""; }
      else if(ch === '"' || ch === "'") q = ch;
      else if(ch === ">") break;
      j++;
    }
    const inner = src.slice(lt + 1, j);
    i = j + 1;
    if(inner[0] === "/"){
      const name = inner.slice(1).trim();
      for(let k = stack.length - 1; k > 0; k--){ if(stack[k].n === name){ stack.length = k; break; } }
      continue;
    }
    const self = inner.endsWith("/");
    const body = self ? inner.slice(0, -1) : inner;
    const sp = body.search(/\s/);
    const name = sp < 0 ? body : body.slice(0, sp);
    const a = {};
    if(sp >= 0){
      const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let m;
      const rest = body.slice(sp);
      while((m = re.exec(rest))) a[m[1]] = _trgDecode(m[3] != null ? m[3] : m[4]);
    }
    const el = {n:name, a, c:[]};
    top().c.push(el);
    if(!self) stack.push(el);
  }
  return root;
}
const _trgKids = (el, n) => (el && el.c ? el.c.filter(x => x.n === n) : []);
const _trgKid  = (el, n) => (el && el.c ? el.c.find(x => x.n === n) : null) || null;
function _trgDesc(el, n, out){
  out = out || [];
  if(!el || !el.c) return out;
  for(const x of el.c){ if(x.n === n) out.push(x); if(x.c) _trgDesc(x, n, out); }
  return out;
}
const _trgAttr = (el, n) => (el && el.a && el.a[n] != null) ? el.a[n] : null;
function _trgText(el){
  if(!el) return "";
  if(el.t != null) return el.t;
  return (el.c || []).map(_trgText).join("");
}
// An OOXML on/off switch: <w:b/> is on, <w:b w:val="0"/> is off.
function _trgOn(el){
  if(!el) return null;
  const v = _trgAttr(el, "w:val");
  return !(v === "0" || v === "false" || v === "off");
}
const _trgEsc = s => String(s == null ? "" : s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// ─── Word: relationships and styles ───────────────────────────────────────
function _trgRels(xml){
  const map = {};
  _trgDesc(_trgXml(xml), "Relationship").forEach(r => {
    map[_trgAttr(r, "Id")] = {target:_trgAttr(r, "Target") || "", external:_trgAttr(r, "TargetMode") === "External"};
  });
  return map;
}
function _trgRunProps(rPr){
  const p = {};
  if(!rPr) return p;
  const b = _trgKid(rPr, "w:b"); if(b) p.b = _trgOn(b);
  const it = _trgKid(rPr, "w:i"); if(it) p.i = _trgOn(it);
  const u = _trgKid(rPr, "w:u"); if(u){ const v = _trgAttr(u, "w:val"); p.u = !!v && v !== "none"; }
  const st = _trgKid(rPr, "w:strike") || _trgKid(rPr, "w:dstrike"); if(st) p.s = _trgOn(st);
  const col = _trgKid(rPr, "w:color"); if(col){ const v = _trgAttr(col, "w:val"); if(v && v !== "auto") p.color = "#" + v; }
  const sz = _trgKid(rPr, "w:sz"); if(sz){ const v = Number(_trgAttr(sz, "w:val")); if(v > 0) p.size = v / 2; }
  const hl = _trgKid(rPr, "w:highlight"); if(hl){ const v = _trgAttr(hl, "w:val"); if(v && v !== "none") p.hl = _TRG_HL[v] || v; }
  const sh = _trgKid(rPr, "w:shd"); if(sh){ const f = _trgAttr(sh, "w:fill"); if(f && f !== "auto") p.hl = "#" + f; }
  const va = _trgKid(rPr, "w:vertAlign"); if(va){ const v = _trgAttr(va, "w:val"); if(v === "superscript" || v === "subscript") p.va = v; }
  const caps = _trgKid(rPr, "w:caps"); if(caps) p.caps = _trgOn(caps);
  const vanish = _trgKid(rPr, "w:vanish"); if(vanish) p.hidden = _trgOn(vanish);
  const rs = _trgKid(rPr, "w:rStyle"); if(rs) p.rStyle = _trgAttr(rs, "w:val");
  return p;
}
const _TRG_HL = {yellow:"#FFFF00", green:"#00FF00", cyan:"#00FFFF", magenta:"#FF00FF", blue:"#0000FF",
  red:"#FF0000", darkBlue:"#000080", darkCyan:"#008080", darkGreen:"#008000", darkMagenta:"#800080",
  darkRed:"#800000", darkYellow:"#808000", darkGray:"#808080", lightGray:"#C0C0C0", black:"#000000", white:"#FFFFFF"};

// Styles are inherited: Heading 2 is based on Heading 1, which is based on
// Normal. A property is looked for along that chain, so a heading that is
// blue because its STYLE says so is blue here too.
function _trgStyles(xml){
  const root = _trgXml(xml);
  const byId = {};
  _trgDesc(root, "w:style").forEach(s => {
    const id = _trgAttr(s, "w:styleId");
    if(!id) return;
    const pPr = _trgKid(s, "w:pPr");
    const jc = pPr ? _trgKid(pPr, "w:jc") : null;
    byId[id] = {
      id, type:_trgAttr(s, "w:type") || "",
      name:(_trgAttr(_trgKid(s, "w:name"), "w:val") || "").toLowerCase(),
      basedOn:_trgAttr(_trgKid(s, "w:basedOn"), "w:val"),
      r:_trgRunProps(_trgKid(s, "w:rPr")),
      jc:jc ? _trgAttr(jc, "w:val") : null,
      num:pPr ? _trgKid(pPr, "w:numPr") : null,
    };
  });
  const dd = _trgDesc(root, "w:rPrDefault")[0];
  const defaults = dd ? _trgRunProps(_trgKid(dd, "w:rPr")) : {};
  const chain = id => { const out = []; const seen = {}; while(id && byId[id] && !seen[id]){ seen[id] = 1; out.unshift(byId[id]); id = byId[id].basedOn; } return out; };
  return {
    byId, defaults,
    // Run properties for a paragraph style + optional character style.
    runFor(pStyle, rStyle){
      const p = Object.assign({}, defaults);
      chain(pStyle).forEach(s => Object.assign(p, s.r));
      chain(rStyle).forEach(s => Object.assign(p, s.r));
      delete p.rStyle;
      return p;
    },
    jcFor(pStyle){ let jc = null; chain(pStyle).forEach(s => { if(s.jc) jc = s.jc; }); return jc; },
    numFor(pStyle){ let n = null; chain(pStyle).forEach(s => { if(s.num) n = s.num; }); return n; },
    headingLevel(pStyle){
      for(const s of chain(pStyle).reverse()){
        const m = /^heading\s*(\d)$/.exec(s.name) || /^Heading(\d)$/.exec(s.id);
        if(m) return +m[1];
        if(s.name === "title" || s.id === "Title") return 1;
        if(s.name === "subtitle" || s.id === "Subtitle") return 2;
      }
      return 0;
    },
    isToc(pStyle){ return chain(pStyle).some(s => /^toc\s*\d*$|^toc heading$/.test(s.name) || /^TOC\d*$|^TOCHeading$/.test(s.id)); },
  };
}

// ─── Word → formatted HTML ────────────────────────────────────────────────
// parts: {document, styles, numbering, rels, media}
//   media: {"word/media/image1.png": "data:image/png;base64,…" | {unsupported:"emf"}}
function trgDocxHtml(parts){
  const doc = _trgXml(parts.document || "");
  const body = _trgDesc(doc, "w:body")[0];
  if(!body) return "";
  const st  = _trgStyles(parts.styles || "");
  const rel = _trgRels(parts.rels || "");
  const num = (typeof _docxNumbering === "function") ? _docxNumbering(parts.numbering || "") : {fmt:()=>null};
  const media = parts.media || {};
  const out = [];
  let blankRun = 0;

  const mediaFor = rid => {
    const r = rel[rid]; if(!r || r.external) return null;
    let t = r.target.replace(/^\/+/, "");
    if(!/^word\//.test(t)) t = "word/" + t;
    return media[t] || null;
  };
  const imgHtml = (rid, cx, cy) => {
    const m = mediaFor(rid);
    if(!m) return "";
    if(typeof m === "object" && m.unsupported){
      return `<span style="display:inline-block;border:1px dashed #C62828;color:#C62828;background:#FDECEA;padding:8px 10px;border-radius:6px;font-size:10px;margin:4px 0">\u26A0 ${_trgEsc(String(m.unsupported).toUpperCase())} drawing \u2014 this format cannot be shown outside Word. Save the Word file as PDF and import the PDF to include it exactly.</span>`;
    }
    const w = cx ? Math.round(Number(cx) / 9525) : 0;              // EMU \u2192 px at 96 dpi
    const h = cy ? Math.round(Number(cy) / 9525) : 0;
    const size = w > 0 ? `width:${Math.min(w, 680)}px;` : "";
    return `<img src="${_trgEsc(m)}" alt="" style="${size}max-width:100%;height:auto;vertical-align:middle"${w&&h?` data-w="${w}" data-h="${h}"`:""}>`;
  };
  const drawingHtml = el => {
    const blip = _trgDesc(el, "a:blip")[0];
    const ext  = _trgDesc(el, "wp:extent")[0];
    if(blip) return imgHtml(_trgAttr(blip, "r:embed") || _trgAttr(blip, "r:link"), ext && _trgAttr(ext, "cx"), ext && _trgAttr(ext, "cy"));
    // A drawing with no picture inside is a chart, SmartArt or shape.
    const kind = _trgDesc(el, "c:chart").length ? "chart" : _trgDesc(el, "dgm:relIds").length ? "SmartArt diagram" : "shape";
    return `<span style="display:inline-block;border:1px dashed #E65100;color:#E65100;background:#FFF3E0;padding:8px 10px;border-radius:6px;font-size:10px;margin:4px 0">\u26A0 Word ${kind} \u2014 not readable outside Word. Import the document as PDF to include it exactly.</span>`;
  };
  const spanStyle = p => {
    const s = [];
    if(p.b) s.push("font-weight:700");
    if(p.i) s.push("font-style:italic");
    const deco = [p.u ? "underline" : "", p.s ? "line-through" : ""].filter(Boolean).join(" ");
    if(deco) s.push("text-decoration:" + deco);
    if(p.color) s.push("color:" + p.color);
    if(p.size) s.push("font-size:" + (+p.size.toFixed(1)) + "pt");
    if(p.hl) s.push("background:" + p.hl);
    if(p.caps) s.push("text-transform:uppercase");
    return s.join(";");
  };

  // Inline content of a paragraph. `fld` tracks complex fields: between
  // "begin" and "separate" is the field CODE (hidden), after it the RESULT.
  function inline(el, pStyle, fld){
    let h = "";
    for(const x of (el.c || [])){
      switch(x.n){
        case "w:r": {
          const rPr = _trgKid(x, "w:rPr");
          const direct = _trgRunProps(rPr);
          const eff = Object.assign(st.runFor(pStyle, direct.rStyle), direct);
          if(eff.hidden) break;
          let txt = "";
          for(const y of x.c || []){
            if(y.n === "w:fldChar"){
              const t = _trgAttr(y, "w:fldCharType");
              if(t === "begin"){ fld.depth++; fld.code = true; }
              else if(t === "separate"){ fld.code = false; }
              else if(t === "end"){ fld.depth = Math.max(0, fld.depth - 1); fld.code = false; }
              continue;
            }
            if(fld.depth && fld.code) continue;               // field code, never shown
            if(y.n === "w:t") txt += _trgEsc(_trgText(y));
            else if(y.n === "w:tab") txt += "\u00A0\u00A0\u00A0\u00A0";
            else if(y.n === "w:br"){
              txt += _trgAttr(y, "w:type") === "page" ? '<span data-trg-pb="1"></span>' : "<br>";
            }
            else if(y.n === "w:cr") txt += "<br>";
            else if(y.n === "w:noBreakHyphen") txt += "-";
            else if(y.n === "w:sym"){
              const ch = _trgAttr(y, "w:char") || "";
              const cp = parseInt(ch, 16);
              txt += (cp >= 0xF000 && cp <= 0xF0FF) ? "\u2022" : (isFinite(cp) ? String.fromCodePoint(cp) : "");
            }
            else if(y.n === "w:drawing") txt += drawingHtml(y);
            else if(y.n === "w:pict" || y.n === "w:object"){
              const im = _trgDesc(y, "v:imagedata")[0];
              if(im) txt += imgHtml(_trgAttr(im, "r:id"), 0, 0);
            }
            else if(y.n === "mc:AlternateContent"){
              const ch = _trgKid(y, "mc:Choice"), fb = _trgKid(y, "mc:Fallback");
              const pick = (ch && _trgDesc(ch, "a:blip").length) ? ch : (fb || ch);
              if(pick){
                const d = _trgDesc(pick, "w:drawing")[0];
                const im = _trgDesc(pick, "v:imagedata")[0];
                if(d) txt += drawingHtml(d); else if(im) txt += imgHtml(_trgAttr(im, "r:id"), 0, 0);
              }
            }
          }
          if(!txt) break;
          if(eff.va === "superscript") txt = `<sup>${txt}</sup>`;
          else if(eff.va === "subscript") txt = `<sub>${txt}</sub>`;
          const css = spanStyle(eff);
          h += css ? `<span style="${css}">${txt}</span>` : txt;
          break;
        }
        case "w:hyperlink": {
          const inner = inline(x, pStyle, fld);
          const r = rel[_trgAttr(x, "r:id")];
          h += (r && r.external && /^https?:/i.test(r.target))
            ? `<a href="${_trgEsc(r.target)}" style="color:#1565C0;text-decoration:underline">${inner}</a>` : inner;
          break;
        }
        case "w:ins": case "w:smartTag": case "w:customXml": case "w:fldSimple":
        case "w:sdtContent": case "w:dir": case "w:bdo":
          h += inline(x, pStyle, fld); break;
        case "w:sdt": { const c = _trgKid(x, "w:sdtContent"); if(c) h += inline(c, pStyle, fld); break; }
        case "mc:AlternateContent": { const ch = _trgKid(x, "mc:Choice") || _trgKid(x, "mc:Fallback"); if(ch) h += inline(ch, pStyle, fld); break; }
        // w:del (tracked deletion), bookmarks, proofing marks: nothing to show
      }
    }
    return h;
  }

  function paragraph(p){
    const pPr = _trgKid(p, "w:pPr");
    const ps  = pPr ? _trgAttr(_trgKid(pPr, "w:pStyle"), "w:val") : null;
    if(ps && st.isToc(ps)) return "";                 // the source's own contents page
    const fld = {depth:0, code:false};
    let content = inline(p, ps, fld);
    const jcEl = pPr ? _trgKid(pPr, "w:jc") : null;
    const jc = (jcEl && _trgAttr(jcEl, "w:val")) || st.jcFor(ps);
    const align = jc === "center" ? "center" : (jc === "right" || jc === "end") ? "right" : jc === "both" ? "justify" : "";
    const level = ps ? st.headingLevel(ps) : 0;
    // numbering: direct first, then from the paragraph style
    let numPr = pPr ? _trgKid(pPr, "w:numPr") : null;
    if(!numPr && ps) numPr = st.numFor(ps);
    let marker = "", indent = 0;
    if(numPr){
      const ni = _trgAttr(_trgKid(numPr, "w:numId"), "w:val");
      const il = +(_trgAttr(_trgKid(numPr, "w:ilvl"), "w:val") || 0);
      if(ni && ni !== "0"){ marker = num.fmt(ni, il) || "\u2022"; indent = il; }
    }
    const pageBreak = content.indexOf('data-trg-pb="1"') >= 0;
    content = content.replace(/<span data-trg-pb="1"><\/span>/g, "");
    const plain = content.replace(/<[^>]+>/g, "").replace(/\u00A0/g, " ").trim();
    const hasImg = /<img |data-trg-ph|\u26A0/.test(content);
    let html = "";
    if(!plain && !hasImg && !marker){
      // Word spaces paragraphs with empty ones. One gap is kept, a run of
      // them is not \u2014 it would print as a half-empty page.
      html = blankRun++ ? "" : `<div style="height:.55em"></div>`;
    } else {
      blankRun = 0;
      const al = align ? `text-align:${align};` : "";
      if(level){
        const sz = ({1:15, 2:13.5, 3:12.5, 4:11.5, 5:11, 6:11})[level] || 12;
        html = `<div style="${al}font-weight:800;font-size:${sz}pt;color:#1B3A6B;margin:${level<=2?12:9}px 0 5px;line-height:1.35">${marker ? _trgEsc(marker) + " " : ""}${content}</div>`;
      } else if(marker){
        html = `<div style="${al}display:flex;gap:6px;margin:2px 0 2px ${14 + indent * 18}px;line-height:1.6"><span style="flex:0 0 auto;min-width:1.2em">${_trgEsc(marker)}</span><span style="flex:1">${content}</span></div>`;
      } else {
        html = `<div style="${al}margin:0 0 5px;line-height:1.6">${content}</div>`;
      }
    }
    if(pageBreak) html += `<div style="page-break-after:always"></div>`;
    return html;
  }

  function table(tbl){
    const tblPr = _trgKid(tbl, "w:tblPr");
    const bordersEl = tblPr ? _trgKid(tblPr, "w:tblBorders") : null;
    // A table with every border set to "none" is a layout table; drawing a
    // grid on it would change what the author built.
    const noBorders = bordersEl && ["w:top","w:left","w:bottom","w:right","w:insideH","w:insideV"]
      .every(n => { const e = _trgKid(bordersEl, n); return e && /^(none|nil)$/.test(_trgAttr(e, "w:val") || ""); });
    const bd = noBorders ? "none" : "1px solid #9E9E9E";
    const grid = _trgKids(_trgKid(tbl, "w:tblGrid"), "w:gridCol").map(g => Number(_trgAttr(g, "w:w")) || 0);
    const gridTot = grid.reduce((a, b) => a + b, 0);
    // Lay every cell onto the grid first, so vertical merges can be counted.
    const rows = _trgKids(tbl, "w:tr").map(tr => {
      const trPr = _trgKid(tr, "w:trPr");
      const header = !!(trPr && _trgKid(trPr, "w:tblHeader"));
      let col = 0;
      const cells = _trgKids(tr, "w:tc").map(tc => {
        const tcPr = _trgKid(tc, "w:tcPr");
        const span = Math.max(1, +(_trgAttr(_trgKid(tcPr, "w:gridSpan"), "w:val") || 1));
        const vmEl = tcPr ? _trgKid(tcPr, "w:vMerge") : null;
        const vm = vmEl ? (_trgAttr(vmEl, "w:val") === "restart" ? "restart" : "continue") : null;
        const shd = tcPr ? _trgKid(tcPr, "w:shd") : null;
        const fill = shd ? _trgAttr(shd, "w:fill") : null;
        const va = tcPr ? _trgAttr(_trgKid(tcPr, "w:vAlign"), "w:val") : null;
        const c = {col, span, vm, fill:(fill && fill !== "auto") ? "#" + fill : "", va, el:tc};
        col += span;
        return c;
      });
      return {header, cells};
    });
    rows.forEach((r, ri) => r.cells.forEach(c => {
      if(c.vm !== "restart") return;
      let n = 1;
      for(let k = ri + 1; k < rows.length; k++){
        const below = rows[k].cells.find(x => x.col === c.col);
        if(below && below.vm === "continue") n++; else break;
      }
      c.rowspan = n;
    }));
    const colgroup = gridTot ? `<colgroup>${grid.map(w => `<col style="width:${(w / gridTot * 100).toFixed(2)}%">`).join("")}</colgroup>` : "";
    const rowHtml = r => `<tr>${r.cells.filter(c => c.vm !== "continue").map(c => {
      const inner = blocks(c.el).join("") || "&nbsp;";
      const css = [`border:${bd}`, "padding:4px 6px", "vertical-align:" + (c.va === "center" ? "middle" : c.va === "bottom" ? "bottom" : "top"),
                   c.fill ? "background:" + c.fill : "", r.header ? "font-weight:700" : ""].filter(Boolean).join(";");
      return `<td${c.span > 1 ? ` colspan="${c.span}"` : ""}${c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : ""} style="${css}">${inner}</td>`;
    }).join("")}</tr>`;
    const head = rows.filter(r => r.header), bodyRows = rows.filter(r => !r.header);
    return `<table style="width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:10.5pt;table-layout:fixed">${colgroup}${
      head.length ? `<thead>${head.map(rowHtml).join("")}</thead>` : ""}<tbody>${bodyRows.map(rowHtml).join("")}</tbody></table>`;
  }

  function blocks(container){
    const res = [];
    for(const x of (container.c || [])){
      if(x.n === "w:p") res.push(paragraph(x));
      else if(x.n === "w:tbl"){ blankRun = 0; res.push(table(x)); }
      else if(x.n === "w:sdt"){ const c = _trgKid(x, "w:sdtContent"); if(c) res.push(...blocks(c)); }
      else if(x.n === "w:customXml" || x.n === "w:ins"){ res.push(...blocks(x)); }
      else if(x.n === "mc:AlternateContent"){ const c = _trgKid(x, "mc:Choice") || _trgKid(x, "mc:Fallback"); if(c) res.push(...blocks(c)); }
    }
    return res;
  }
  out.push(...blocks(body));
  // Trailing gaps and a trailing page break add nothing but a blank page.
  while(out.length && /^<div style="(height:\.55em|page-break-after:always)"><\/div>$/.test(out[out.length - 1])) out.pop();
  return out.filter(Boolean).join("\n");
}

Object.assign(window, {_trgXml, _trgDecode, _trgDesc, _trgText, _trgStyles, _trgRels, trgDocxHtml});

// ─── Excel → formatted HTML tables ─────────────────────────────────────────
// Theme colours are how most modern workbooks colour a header row: "Accent 1,
// lighter 40%" rather than a literal RGB. They are resolved from the theme
// part and the tint applied, or the colour would silently disappear.
function _trgTheme(xml){
  const root = _trgXml(xml);
  const scheme = _trgDesc(root, "a:clrScheme")[0];
  if(!scheme) return [];
  const pick = n => { const e = _trgKid(scheme, n); if(!e) return null;
    const s = _trgKid(e, "a:srgbClr"); if(s) return _trgAttr(s, "val");
    const y = _trgKid(e, "a:sysClr"); return y ? (_trgAttr(y, "lastClr") || null) : null; };
  // Excel's theme index order swaps the first two pairs relative to the XML.
  return ["a:lt1","a:dk1","a:lt2","a:dk2","a:accent1","a:accent2","a:accent3","a:accent4","a:accent5","a:accent6","a:hlink","a:folHlink"].map(pick);
}
const _TRG_IDX = ["000000","FFFFFF","FF0000","00FF00","0000FF","FFFF00","FF00FF","00FFFF",
  "000000","FFFFFF","FF0000","00FF00","0000FF","FFFF00","FF00FF","00FFFF","800000","008000","000080","808000",
  "800080","008080","C0C0C0","808080","9999FF","993366","FFFFCC","CCFFFF","660066","FF8080","0066CC","CCCCFF",
  "000080","FF00FF","FFFF00","00FFFF","800080","800000","008080","0000FF","00CCFF","CCFFFF","CCFFCC","FFFF99",
  "99CCFF","FF99CC","CC99FF","FFCC99","3366FF","33CCCC","99CC00","FFCC00","FF9900","FF6600","666699","969696",
  "003366","339966","003300","333300","993300","993366","333399","333333"];
function _trgXlColor(el, theme){
  if(!el) return "";
  let hex = null;
  const rgb = _trgAttr(el, "rgb"), th = _trgAttr(el, "theme"), ix = _trgAttr(el, "indexed");
  if(rgb) hex = rgb.length === 8 ? rgb.slice(2) : rgb;
  else if(th != null && theme[+th]) hex = theme[+th];
  else if(ix != null && _TRG_IDX[+ix]) hex = _TRG_IDX[+ix];
  if(!hex || !/^[0-9a-fA-F]{6}$/.test(hex)) return "";
  const tint = Number(_trgAttr(el, "tint") || 0);
  if(tint){
    const ch = [0,2,4].map(k => parseInt(hex.slice(k, k + 2), 16))
      .map(v => Math.round(tint > 0 ? v + (255 - v) * tint : v * (1 + tint)));
    hex = ch.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
  }
  return "#" + hex.toUpperCase();
}
const _TRG_NUMFMT = {0:"General",1:"0",2:"0.00",3:"#,##0",4:"#,##0.00",9:"0%",10:"0.00%",11:"0.00E+00",
  12:"# ?/?",13:"# ??/??",14:"dd/mm/yyyy",15:"d-mmm-yy",16:"d-mmm",17:"mmm-yy",18:"h:mm AM/PM",
  19:"h:mm:ss AM/PM",20:"h:mm",21:"h:mm:ss",22:"dd/mm/yyyy h:mm",37:"#,##0 ;(#,##0)",38:"#,##0 ;(#,##0)",
  39:"#,##0.00;(#,##0.00)",40:"#,##0.00;(#,##0.00)",44:"#,##0.00",45:"mm:ss",46:"[h]:mm:ss",47:"mm:ss.0",
  48:"##0.0E+0",49:"@"};
const _TRG_MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
// Render a number the way its cell format asks. Covers what engineering and
// finance sheets actually use; anything unrecognised falls back to the plain
// number rather than to a wrong-looking one.
function _trgFmtNum(v, code){
  if(typeof v !== "number" || !isFinite(v)) return String(v == null ? "" : v);
  code = String(code || "General");
  if(/^general$/i.test(code) || code === "@"){
    if(Number.isInteger(v)) return String(v);
    return String(+v.toPrecision(10));
  }
  const secs = code.split(";");
  let sec = secs[0];
  if(v < 0 && secs[1] != null){ sec = secs[1]; v = -v; }
  else if(v === 0 && secs[2] != null && secs[2].trim()) sec = secs[2];
  const clean = sec.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  // Literal text around the number: quoted strings, [$SYM-409], $ \u20AC \u00A3 etc.
  const lit = s => s.replace(/\[\$([^\]-]*)-?[^\]]*\]/g, "$1").replace(/"([^"]*)"/g, "$1")
                    .replace(/\\(.)/g, "$1").replace(/\[[^\]]*\]/g, "").replace(/_./g, " ").replace(/\*./g, "");
  // Dates and times
  if(/[dy]/i.test(clean) || /h/i.test(clean) || (/m/i.test(clean) && /s/i.test(clean))){
    const ms = Math.round((v - 25569) * 86400000);
    const d = new Date(ms);
    if(isNaN(d)) return String(v);
    const Y = d.getUTCFullYear(), M = d.getUTCMonth(), D = d.getUTCDate();
    const H = d.getUTCHours(), Mi = d.getUTCMinutes(), S = d.getUTCSeconds();
    const ampm = /AM\/PM|A\/P/i.test(sec);
    let f = lit(sec).replace(/AM\/PM|A\/P/gi, "\u0001");
    const hasH = /h/i.test(f);
    f = f.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s/gi, (tok, off) => {
      const t = tok.toLowerCase();
      if(t === "yyyy") return String(Y);
      if(t === "yy") return String(Y).slice(-2);
      if(t === "mmmm") return _TRG_MON[M];
      if(t === "mmm") return _TRG_MON[M].slice(0, 3);
      if(t === "dddd") return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getUTCDay()];
      if(t === "ddd") return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getUTCDay()];
      if(t === "dd") return String(D).padStart(2, "0");
      if(t === "d") return String(D);
      if(t === "hh" || t === "h"){ const hh = ampm ? ((H % 12) || 12) : H; return t === "hh" ? String(hh).padStart(2, "0") : String(hh); }
      if(t === "ss") return String(S).padStart(2, "0");
      if(t === "s") return String(S);
      // m / mm: minutes when next to hours or seconds, otherwise the month
      const before = f.slice(0, off), after = f.slice(off + tok.length);
      const isMin = hasH && (/h[^a-z]*$/i.test(before) || /^[^a-z]*s/i.test(after));
      if(isMin) return t === "mm" ? String(Mi).padStart(2, "0") : String(Mi);
      return t === "mm" ? String(M + 1).padStart(2, "0") : String(M + 1);
    });
    return f.replace(/\u0001/g, H < 12 ? "AM" : "PM").trim();
  }
  const pct = /%/.test(clean);
  if(pct) v = v * 100;
  const sci = /E[+-]/i.test(clean);
  const dotIx = clean.indexOf(".");
  const dec = dotIx >= 0 ? (clean.slice(dotIx + 1).match(/[0#?]/g) || []).length : 0;
  let num;
  if(sci) num = v.toExponential(dec).replace("e", "E").replace(/E([+-])(\d)$/, "E$10$2");
  else {
    const thousands = /[0#?],[0#?]/.test(clean);
    num = v.toLocaleString("en-US", {minimumFractionDigits:dec, maximumFractionDigits:dec, useGrouping:thousands});
  }
  // Put the number where its placeholder stood, keeping any literal text.
  const litSec = lit(sec);
  const m = /[0#?][0#?,.\s]*(E[+-][0#]+)?%?/i.exec(litSec);
  let res = m ? litSec.slice(0, m.index) + num + (pct ? "%" : "") + litSec.slice(m.index + m[0].length) : num;
  if(!m && pct) res += "%";
  return res.replace(/\s+/g, " ").trim();
}
function _trgColIx(ref){ let n = 0; for(const ch of ref){ n = n * 26 + (ch.charCodeAt(0) - 64); } return n - 1; }
function _trgRef(ref){ const m = /^([A-Z]+)(\d+)$/.exec(String(ref || "").replace(/\$/g, "")); return m ? {c:_trgColIx(m[1]), r:+m[2] - 1} : null; }

// parts: {workbook, workbookRels, sharedStrings, styles, theme, sheets:{path: xml}}
// returns [{name, html, rows, cols, truncated}]
const TRG_XL_MAX_ROWS = 400, TRG_XL_MAX_COLS = 30;
function trgXlsxHtml(parts){
  const theme = _trgTheme(parts.theme || "");
  // shared strings (rich text keeps its words; its formatting is not carried)
  const sst = _trgKids(_trgXml(parts.sharedStrings || "").c[0] || {c:[]}, "si")
    .map(si => _trgDesc(si, "t").map(_trgText).join(""));
  // styles
  const sroot = _trgXml(parts.styles || "");
  const fmts = {};
  _trgDesc(sroot, "numFmt").forEach(f => { fmts[+_trgAttr(f, "numFmtId")] = _trgAttr(f, "formatCode") || "General"; });
  const fonts = _trgKids(_trgDesc(sroot, "fonts")[0], "font").map(f => ({
    b:!!_trgKid(f, "b") && _trgOn(_trgKid(f, "b")) !== false && _trgAttr(_trgKid(f, "b"), "val") !== "0",
    i:!!_trgKid(f, "i") && _trgAttr(_trgKid(f, "i"), "val") !== "0",
    u:!!_trgKid(f, "u"),
    color:_trgXlColor(_trgKid(f, "color"), theme),
    sz:Number(_trgAttr(_trgKid(f, "sz"), "val")) || 0,
  }));
  const fills = _trgKids(_trgDesc(sroot, "fills")[0], "fill").map(f => {
    const pf = _trgKid(f, "patternFill");
    if(!pf || (_trgAttr(pf, "patternType") || "none") === "none") return "";
    return _trgXlColor(_trgKid(pf, "fgColor"), theme) || _trgXlColor(_trgKid(pf, "bgColor"), theme);
  });
  const borders = _trgKids(_trgDesc(sroot, "borders")[0], "border").map(b =>
    ["left","right","top","bottom"].some(s => { const e = _trgKid(b, s); return e && _trgAttr(e, "style"); }));
  const xfs = _trgKids(_trgDesc(sroot, "cellXfs")[0], "xf").map(x => {
    const al = _trgKid(x, "alignment");
    return {num:+(_trgAttr(x, "numFmtId") || 0), font:+(_trgAttr(x, "fontId") || 0),
            fill:+(_trgAttr(x, "fillId") || 0), border:+(_trgAttr(x, "borderId") || 0),
            h:al ? _trgAttr(al, "horizontal") : null, v:al ? _trgAttr(al, "vertical") : null,
            wrap:al ? _trgAttr(al, "wrapText") === "1" : false};
  });
  // which sheet part belongs to which visible sheet name
  const rels = _trgRels(parts.workbookRels || "");
  const sheets = _trgDesc(_trgXml(parts.workbook || ""), "sheet")
    .filter(s => (_trgAttr(s, "state") || "visible") === "visible")
    .map(s => {
      let t = (rels[_trgAttr(s, "r:id")] || {}).target || "";
      t = t.replace(/^\/+/, ""); if(!/^xl\//.test(t)) t = "xl/" + t;
      return {name:_trgAttr(s, "name") || "Sheet", path:t};
    });
  const result = [];
  for(const sh of sheets){
    const xml = (parts.sheets || {})[sh.path];
    if(!xml) continue;
    const ws = _trgXml(xml);
    const hiddenCols = new Set(), colW = {};
    _trgDesc(ws, "col").forEach(c => {
      const a = +_trgAttr(c, "min") - 1, b = +_trgAttr(c, "max") - 1;
      for(let k = a; k <= b && k < 16384; k++){
        if(_trgAttr(c, "hidden") === "1") hiddenCols.add(k);
        const w = Number(_trgAttr(c, "width")); if(w > 0) colW[k] = Math.round(w * 7 + 5);
      }
    });
    const cells = {}; const hiddenRows = new Set();
    let maxR = -1, maxC = -1;
    _trgDesc(ws, "row").forEach(row => {
      const r = +_trgAttr(row, "r") - 1;
      if(_trgAttr(row, "hidden") === "1") hiddenRows.add(r);
      _trgKids(row, "c").forEach(c => {
        const ref = _trgRef(_trgAttr(c, "r")); if(!ref) return;
        const t = _trgAttr(c, "t"), s = +(_trgAttr(c, "s") || 0);
        const vEl = _trgKid(c, "v");
        let val = "", raw = vEl ? _trgText(vEl) : "";
        if(t === "s") val = sst[+raw] || "";
        else if(t === "inlineStr") val = _trgDesc(c, "t").map(_trgText).join("");
        else if(t === "str" || t === "e") val = raw;
        else if(t === "b") val = raw === "1" ? "TRUE" : "FALSE";
        else if(t === "d") val = raw;
        else if(raw !== ""){ const xf = xfs[s] || {num:0}; val = _trgFmtNum(Number(raw), fmts[xf.num] || _TRG_NUMFMT[xf.num] || "General"); }
        const xf = xfs[s] || {};
        const styled = !!(fills[xf.fill]);
        if(val === "" && !styled) return;
        cells[ref.r + ":" + ref.c] = {val, s, num:t == null || t === "n"};
        if(val !== ""){ if(ref.r > maxR) maxR = ref.r; if(ref.c > maxC) maxC = ref.c; }
      });
    });
    if(maxR < 0){ continue; }                       // an empty sheet adds nothing
    const merges = {}, covered = new Set();
    _trgDesc(ws, "mergeCell").forEach(m => {
      const [a, b] = String(_trgAttr(m, "ref") || "").split(":").map(_trgRef);
      if(!a || !b) return;
      merges[a.r + ":" + a.c] = {rs:b.r - a.r + 1, cs:b.c - a.c + 1};
      for(let r = a.r; r <= b.r; r++) for(let c = a.c; c <= b.c; c++) if(r !== a.r || c !== a.c) covered.add(r + ":" + c);
      if(b.r > maxR && cells[a.r + ":" + a.c]) maxR = Math.max(maxR, b.r);
      if(b.c > maxC && cells[a.r + ":" + a.c]) maxC = Math.max(maxC, b.c);
    });
    const R = Math.min(maxR + 1, TRG_XL_MAX_ROWS), C = Math.min(maxC + 1, TRG_XL_MAX_COLS);
    const colsShown = []; for(let c = 0; c < C; c++) if(!hiddenCols.has(c)) colsShown.push(c);
    let body = "";
    for(let r = 0; r < R; r++){
      if(hiddenRows.has(r)) continue;
      let tr = "";
      for(const c of colsShown){
        const key = r + ":" + c;
        if(covered.has(key)) continue;
        const cell = cells[key], mg = merges[key];
        const xf = cell ? (xfs[cell.s] || {}) : {};
        const font = fonts[xf.font] || {}, fill = fills[xf.fill] || "";
        const css = ["border:1px solid " + (borders[xf.border] ? "#7F7F7F" : "#D9D9D9"), "padding:3px 6px",
          fill ? "background:" + fill : "", font.b ? "font-weight:700" : "", font.i ? "font-style:italic" : "",
          font.u ? "text-decoration:underline" : "", font.color && font.color !== "#000000" ? "color:" + font.color : "",
          "text-align:" + (xf.h === "center" || xf.h === "centerContinuous" ? "center" : xf.h === "right" ? "right" : xf.h === "left" ? "left" : (cell && cell.num ? "right" : "left")),
          "vertical-align:" + (xf.v === "center" ? "middle" : xf.v === "top" ? "top" : "bottom"),
          xf.wrap ? "white-space:pre-wrap" : "white-space:nowrap"].filter(Boolean).join(";");
        tr += `<td${mg && mg.cs > 1 ? ` colspan="${Math.min(mg.cs, C - c)}"` : ""}${mg && mg.rs > 1 ? ` rowspan="${mg.rs}"` : ""} style="${css}">${cell ? _trgEsc(cell.val) : ""}</td>`;
      }
      body += `<tr>${tr}</tr>`;
    }
    const colgroup = `<colgroup>${colsShown.map(c => `<col style="width:${colW[c] || 64}px">`).join("")}</colgroup>`;
    const truncated = maxR + 1 > TRG_XL_MAX_ROWS || maxC + 1 > TRG_XL_MAX_COLS;
    result.push({
      name:sh.name, rows:R, cols:colsShown.length, truncated,
      html:`<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:9.5pt;margin:4px 0 8px">${colgroup}<tbody>${body}</tbody></table></div>` +
           (truncated ? `<div style="font-size:9pt;color:#E65100">Showing the first ${TRG_XL_MAX_ROWS} rows and ${TRG_XL_MAX_COLS} columns of this sheet.</div>` : ""),
    });
  }
  return result;
}
// CSV: every value exactly as written, as a plain table.
function trgCsvHtml(text){
  const rows = []; let row = [], cur = "", q = false;
  const s = String(text || "").replace(/^\uFEFF/, "");
  for(let i = 0; i < s.length; i++){
    const ch = s[i];
    if(q){ if(ch === '"'){ if(s[i+1] === '"'){ cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if(ch === '"') q = true;
    else if(ch === ","){ row.push(cur); cur = ""; }
    else if(ch === "\n" || ch === "\r"){ if(ch === "\r" && s[i+1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if(cur !== "" || row.length){ row.push(cur); rows.push(row); }
  const kept = rows.filter(r => r.some(v => String(v).trim() !== "")).slice(0, TRG_XL_MAX_ROWS);
  return `<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:9.5pt;margin:4px 0 8px"><tbody>${
    kept.map((r, i) => `<tr>${r.slice(0, TRG_XL_MAX_COLS).map(v => `<td style="border:1px solid #D9D9D9;padding:3px 6px;${i === 0 ? "font-weight:700;background:#F2F2F2" : ""}">${_trgEsc(v)}</td>`).join("")}</tr>`).join("")
  }</tbody></table></div>`;
}
Object.assign(window, {_trgTheme, _trgXlColor, _trgFmtNum, trgXlsxHtml, trgCsvHtml});

// ─── Defence in depth: only known-safe markup reaches the page ─────────────
// The converters above escape every character of document text, so their
// output is already safe. But a saved guide comes back from the database, and
// anything signed in can write there. Stored markup is therefore filtered to
// the tags and attributes the converters actually produce before it is shown.
const _TRG_TAGS = new Set(["div","span","table","thead","tbody","tr","td","th","colgroup","col","img","br","sup","sub","a","b","i","u","p"]);
function _trgSanitize(html){
  return String(html || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (m, tag, attrs) => {
    tag = tag.toLowerCase();
    if(!_TRG_TAGS.has(tag)) return "";
    if(m[1] === "/") return `</${tag}>`;
    const keep = [];
    String(attrs).replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g, (mm, name, _q, v1, v2) => {
      name = name.toLowerCase(); const v = v1 != null ? v1 : v2;
      if(name === "style"){ if(!/expression\s*\(|url\s*\(|javascript:/i.test(v)) keep.push(`style="${v}"`); }
      else if(name === "colspan" || name === "rowspan"){ if(/^\d{1,3}$/.test(v)) keep.push(`${name}="${v}"`); }
      else if(name === "src" && tag === "img"){ if(/^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,[A-Za-z0-9+/=\s]*$/i.test(v)) keep.push(`src="${v}"`); }
      else if(name === "href" && tag === "a"){ if(/^https?:\/\//i.test(v)) keep.push(`href="${v}"`); }
      else if(name === "alt" || name === "data-w" || name === "data-h" || name === "data-trg-pb"){ keep.push(`${name}="${v.replace(/"/g,"")}"`); }
      return "";
    });
    return `<${tag}${keep.length ? " " + keep.join(" ") : ""}>`;
  });
}

// ─── Import: files → sections ──────────────────────────────────────────────
window._trg = window._trg || {
  title:"", subtitle:"", revision:"", date:"",
  client:"", clientOther:false, project:"", projectOther:false, site:"", siteOther:false,
  preparedBy:"", preparedByOther:false, approvedBy:"", approvedByOther:false,
  scope:"", sections:[],
};
window._trgNoPhotos = []; window._trgNoPlans = [];        // the save bar asks for these
const TRG_PDF_WIDTH = 1600, TRG_PDF_MAX = 40;
const _trgSid = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Every path inside the package, read once.
async function _trgUnzip(file){
  const buf = await file.arrayBuffer();
  const cfb = XLSX.CFB.read(new Uint8Array(buf), {type:"array"});
  const files = {};
  (cfb.FileIndex || []).forEach((e, i) => {
    if(!e || !e.content || !e.content.length) return;
    let p = String((cfb.FullPaths && cfb.FullPaths[i]) || e.name || "");
    p = p.replace(/^[^/]*Root Entry\//i, "").replace(/^\/+/, "");
    files[p] = e.content;
  });
  const text = p => { const c = files[p]; return c ? new TextDecoder("utf-8").decode(new Uint8Array(c)) : ""; };
  return {files, text};
}
const _TRG_MIME = {png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", bmp:"image/bmp", webp:"image/webp", svg:"image/svg+xml"};
function _trgB64(bytes){
  const u = new Uint8Array(bytes); let s = "";
  for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
// Pictures inside a Word file are often full-resolution camera photographs.
// A 5 MB photo would make the finished report unwieldy and could not be saved,
// so anything large is redrawn to at most 1600 px; small ones are left as-is.
async function _trgImage(bytes, ext){
  const mime = _TRG_MIME[ext];
  if(!mime) return {unsupported:ext || "unknown"};
  const url = "data:" + mime + ";base64," + _trgB64(bytes);
  if(bytes.length < 450 * 1024 || ext === "svg") return url;
  const small = (typeof _srShrink === "function") ? await _srShrink(url, 1600, 0.85) : null;
  return small || url;
}
async function _trgImportDocx(file){
  const z = await _trgUnzip(file);
  const media = {};
  for(const p of Object.keys(z.files)){
    if(!/^word\/media\//i.test(p)) continue;
    const ext = (p.split(".").pop() || "").toLowerCase();
    media[p] = await _trgImage(z.files[p], ext);
  }
  const html = trgDocxHtml({document:z.text("word/document.xml"), styles:z.text("word/styles.xml"),
    numbering:z.text("word/numbering.xml"), rels:z.text("word/_rels/document.xml.rels"), media});
  if(!html.trim()) throw new Error("This Word file has no readable body.");
  return {kind:"word", html};
}
async function _trgImportXlsx(file){
  const z = await _trgUnzip(file);
  const sheets = {};
  Object.keys(z.files).forEach(p => { if(/^xl\/worksheets\/[^/]+\.xml$/i.test(p)) sheets[p] = z.text(p); });
  const out = trgXlsxHtml({workbook:z.text("xl/workbook.xml"), workbookRels:z.text("xl/_rels/workbook.xml.rels"),
    sharedStrings:z.text("xl/sharedStrings.xml"), styles:z.text("xl/styles.xml"),
    theme:z.text("xl/theme/theme1.xml"), sheets});
  if(!out.length) throw new Error("This workbook has no visible sheet with data.");
  const html = out.map(s => (out.length > 1
      ? `<div style="font-weight:800;color:#1B3A6B;font-size:11pt;margin:10px 0 4px">${_trgEsc(s.name)}</div>` : "") + s.html).join("");
  return {kind:"excel", html};
}

// Pages to import from a long PDF. Up to 40 at a time keeps the report and
// the saved copy a sensible size; a longer document is imported in parts.
window._trgPdfPick = null;
async function _trgImportPdf(file){
  const lib = await _planLib();
  if(!lib) throw new Error("The PDF reader is not available on this device yet.");
  const pdf = await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  if(pdf.numPages > TRG_PDF_MAX){
    window._trgPdfPick = {pdf, name:file.name, size:file.size, pages:pdf.numPages, from:1, to:TRG_PDF_MAX};
    render();
    return null;                                     // the range card takes over
  }
  return {kind:"pdf", pages:await _trgRenderPages(pdf, 1, pdf.numPages)};
}
async function _trgRenderPages(pdf, from, to){
  const pages = [];
  for(let n = from; n <= to; n++){
    toast(`Reading page ${n} of ${to}\u2026`);
    const r = await _planRenderPage(pdf, n, TRG_PDF_WIDTH);
    pages.push({data:r.data, w:r.w, h:r.h, page:n});
  }
  return pages;
}
window.trgPdfRange = async function(){
  const P = window._trgPdfPick; if(!P) return;
  const from = Math.max(1, Math.min(P.pages, parseInt(P.from, 10) || 1));
  const to   = Math.max(from, Math.min(P.pages, parseInt(P.to, 10) || from));
  if(to - from + 1 > TRG_PDF_MAX) return toast(`\u26A0 Up to ${TRG_PDF_MAX} pages at a time \u2014 import the rest as another section`);
  window._trgPdfPick = null;
  try{
    const pages = await _trgRenderPages(P.pdf, from, to);
    _trgAddSection({kind:"pdf", pages}, P.name, P.size, from > 1 || to < P.pages ? ` (pages ${from}\u2013${to})` : "");
  }catch(e){ toast("\u26A0 " + (e && e.message || "That PDF could not be read")); render(); }
};
window.trgPdfRangeCancel = function(){ window._trgPdfPick = null; render(); };

function _trgAddSection(res, name, size, suffix){
  const base = String(name || "Document").replace(/\.(docx|xlsx|xlsm|pdf|csv)$/i, "").replace(/[_-]+/g, " ").trim();
  window._trg.sections.push({sid:_trgSid(), kind:res.kind, title:base + (suffix || ""), note:"",
    file:{name:String(name || ""), size:Number(size) || 0}, html:res.html, pages:res.pages});
  if(typeof srMarkDirty === "function") srMarkDirty();
  render();
  toast(res.kind === "pdf" ? `Added ${res.pages.length} page${res.pages.length === 1 ? "" : "s"} \u2713` : "Document added \u2713");
}
window.trgImport = async function(input){
  const f = input && input.files && input.files[0];
  if(input) input.value = "";
  if(!f) return;
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  if(ext === "doc" || ext === "xls") return toast("\u26A0 Old ." + ext + " format \u2014 open it in Word/Excel and save as ." + ext + "x or PDF first");
  if(f.size > 60 * 1024 * 1024) return toast("\u26A0 That file is over 60 MB \u2014 split it or import it as PDF pages");
  try{
    toast("Reading " + f.name + "\u2026");
    let res = null;
    if(ext === "pdf") res = await _trgImportPdf(f);
    else if(ext === "csv") res = {kind:"csv", html:trgCsvHtml(await f.text())};
    else {
      if(!await needLib("XLSX", "the document reader")) return;
      if(ext === "docx") res = await _trgImportDocx(f);
      else if(ext === "xlsx" || ext === "xlsm") res = await _trgImportXlsx(f);
      else return toast("\u26A0 Choose a Word (.docx), PDF, Excel (.xlsx) or CSV file");
    }
    if(res) _trgAddSection(res, f.name, f.size);
  }catch(e){
    toast("\u26A0 " + (e && e.message ? e.message : "That file could not be read"));
  }
};

// ─── Section editing ──────────────────────────────────────────────────────
const _trgFind = sid => (window._trg.sections || []).findIndex(s => s.sid === sid);
window.trgMove = function(sid, d){
  const a = window._trg.sections, i = _trgFind(sid), j = i + d;
  if(i < 0 || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  srMarkDirty(); render();
};
window.trgDel = function(sid){
  const i = _trgFind(sid); if(i < 0) return;
  if(!confirm(`Remove "${window._trg.sections[i].title}" from the guide?`)) return;
  window._trg.sections.splice(i, 1);
  srMarkDirty(); render();
};
window.trgSet = function(sid, k, v){
  const i = _trgFind(sid); if(i < 0) return;
  window._trg.sections[i][k] = v;
  srMarkDirty();
};
window.trgDelPage = function(sid, pi){
  const i = _trgFind(sid); if(i < 0) return;
  const pages = window._trg.sections[i].pages || [];
  pages.splice(pi, 1);
  if(!pages.length) window._trg.sections.splice(i, 1);
  srMarkDirty(); render();
};

// ─── The builder screen ───────────────────────────────────────────────────
function _trgKindChip(k){
  const m = {pdf:["PDF \u00b7 exact pages","#C62828"], word:["Word \u00b7 formatted","#1565C0"],
             excel:["Excel \u00b7 formatted","#2E7D32"], csv:["CSV","#2E7D32"]}[k] || ["Text","#555"];
  return `<span style="font-size:10px;font-weight:800;color:#fff;background:${m[1]};border-radius:6px;padding:2px 7px">${m[0]}</span>`;
}
function _trgSectionCard(s, i, n){
  const body = s.kind === "pdf"
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${(s.pages || []).map((p, pi) => `
        <div style="position:relative;width:74px">
          <img src="${escapeHtml(p.data)}" style="width:74px;height:104px;object-fit:cover;object-position:top;border:1px solid var(--line);border-radius:4px;background:#fff">
          <div style="font-size:9.5px;text-align:center;color:var(--muted)">p. ${escapeHtml(String(p.page))}</div>
          <button type="button" onclick="trgDelPage(${jsArg(s.sid)},${pi})" title="Leave this page out"
            style="position:absolute;top:-6px;inset-inline-end:-6px;background:#C62828;color:#fff;border:none;border-radius:50%;width:20px;height:20px;padding:0;line-height:1;cursor:pointer">\u00d7</button>
        </div>`).join("")}</div>`
    : `<div style="max-height:360px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:10px;background:#fff;color:#1a1a1a;margin-top:6px;font-size:10.5pt">${_trgSanitize(s.html)}</div>`;
  return foldCard("trg_" + s.sid, String(i + 1).padStart(2, "0"), s.title || "Untitled section", "", `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0 8px">
      ${_trgKindChip(s.kind)}
      <span style="font-size:10.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%">${escapeHtml(s.file && s.file.name || "")}</span>
      <span style="margin-inline-start:auto;display:flex;gap:4px">
        <button type="button" class="btn btn-sm btn-secondary" ${i === 0 ? "disabled" : ""} onclick="trgMove(${jsArg(s.sid)},-1)" title="Move up">\u2191</button>
        <button type="button" class="btn btn-sm btn-secondary" ${i === n - 1 ? "disabled" : ""} onclick="trgMove(${jsArg(s.sid)},1)" title="Move down">\u2193</button>
        <button type="button" class="btn btn-sm" style="background:#FDECEA;color:#C62828;border:none" onclick="trgDel(${jsArg(s.sid)})" title="Remove">\u{1F5D1}\uFE0F</button>
      </span>
    </div>
    <div class="field full"><label>Section title</label>
      <input class="input" value="${escapeHtml(s.title || "")}" oninput="trgSet(${jsArg(s.sid)},'title',this.value)"></div>
    <div class="field full"><label>Note above this section (optional)</label>
      <textarea rows="2" oninput="trgSet(${jsArg(s.sid)},'note',this.value)" placeholder="e.g. Manufacturer datasheet, revision C">${escapeHtml(s.note || "")}</textarea></div>
    ${body}`, true);
}
function renderTechRefGuide(){
  const P = window._trg;
  const projects = (state.projects || []).map(p => p.name).filter(Boolean);
  const clients  = (state.clients  || []).map(c => c.name).filter(Boolean);
  const sites    = (state.locations|| []).map(l => l.name).filter(Boolean);
  const everyone = Array.from(new Set((state.users || []).map(u => (u.employeeName || u.name || "").trim())
    .filter(Boolean).concat(typeof allEmployees === "function" ? allEmployees() : []))).sort();
  const S = P.sections || [];
  const pick = window._trgPdfPick;
  const pages = S.reduce((a, s) => a + (s.pages ? s.pages.length : 0), 0);
  return `${_rptHero("\u{1F4D8}", "Technical Reference Guide",
      "Word, PDF and Excel documents bound into one EJAF report",
      "linear-gradient(135deg,#1A237E 0%,#283593 55%,#3949AB 100%)")}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">01</span>
      <b>Document details</b>
    </div>
    <div class="grid2">
      <div class="field full"><label>Guide title *</label>
        <input class="input" value="${escapeHtml(P.title)}" oninput="window._trg.title=this.value;srMarkDirty()" placeholder="e.g. CCTV System \u2014 Technical Reference"></div>
      <div class="field full"><label>Subtitle</label>
        <input class="input" value="${escapeHtml(P.subtitle)}" oninput="window._trg.subtitle=this.value;srMarkDirty()" placeholder="e.g. Datasheets, drawings and bill of materials"></div>
      <div class="field"><label>Revision</label>
        <input class="input" value="${escapeHtml(P.revision)}" oninput="window._trg.revision=this.value;srMarkDirty()" placeholder="Rev 0"></div>
      <div class="field"><label>Issue date</label>
        <input class="input" type="date" value="${escapeHtml(P.date)}" oninput="window._trg.date=this.value;srMarkDirty()"></div>
      ${_syncSel("\u{1F464} Client",  clients,  "window._trg.client",  "window._trg.clientOther",  P.client,  P.clientOther,  "Client name")}
      ${_syncSel("\u{1F4C1} Project", projects, "window._trg.project", "window._trg.projectOther", P.project, P.projectOther, "Project name")}
      ${_syncSel("\u{1F4CD} Site",    sites,    "window._trg.site",    "window._trg.siteOther",    P.site,    P.siteOther,    "Site or facility")}
      ${_syncSel("\u270D\uFE0F Prepared by", everyone, "window._trg.preparedBy", "window._trg.preparedByOther", P.preparedBy, P.preparedByOther, "Name and title")}
      ${_syncSel("\u2705 Approved by",  everyone, "window._trg.approvedBy", "window._trg.approvedByOther", P.approvedBy, P.approvedByOther, "Name and title")}
    </div>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">02</span>
      <b>Purpose &amp; scope</b>
    </div>
    <textarea rows="3" oninput="window._trg.scope=this.value;srMarkDirty()" placeholder="What this guide covers and who it is for">${escapeHtml(P.scope)}</textarea>
  </div>

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">03</span>
      <b>Documents</b>
      ${S.length ? `<span style="font-weight:400;color:var(--muted);font-size:12px">${S.length} section${S.length === 1 ? "" : "s"}${pages ? ` \u00b7 ${pages} PDF page${pages === 1 ? "" : "s"}` : ""}</span>` : ""}
    </div>
    <label class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;background:#C9A84C;color:#1B3A6B;font-weight:800;margin-top:8px">
      \u{1F4E5} Import Word \u00b7 PDF \u00b7 Excel
      <input type="file" accept=".docx,.pdf,.xlsx,.xlsm,.csv,application/pdf" style="display:none" onchange="trgImport(this)">
    </label>
    <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-top:8px">
      <b>PDF</b> pages are included exactly as they are \u2014 drawings, photographs, tables and fonts untouched.
      <b>Word</b> keeps headings, colours, bold and italic, lists, tables with shading and merged cells, and pictures.
      <b>Excel</b> keeps fills, colours, merged cells and number formats.
      Charts, SmartArt and AutoCAD objects pasted into Word cannot be read outside Word \u2014 save that Word file as PDF and import the PDF.
    </div>
  </div>

  ${pick ? `<div class="card" style="border:2px solid #C9A84C">
    <div class="card-title">\u{1F4C4} ${escapeHtml(pick.name)} \u2014 ${pick.pages} pages</div>
    <div style="font-size:12px;color:var(--muted);margin:4px 0 8px">Up to ${TRG_PDF_MAX} pages at a time. Choose the range for this section.</div>
    <div class="grid2">
      <div class="field"><label>From page</label><input class="input" inputmode="numeric" value="${escapeHtml(String(pick.from))}" oninput="window._trgPdfPick.from=this.value"></div>
      <div class="field"><label>To page</label><input class="input" inputmode="numeric" value="${escapeHtml(String(pick.to))}" oninput="window._trgPdfPick.to=this.value"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700" onclick="trgPdfRange()">Import these pages</button>
      <button class="btn btn-secondary" onclick="trgPdfRangeCancel()">Cancel</button>
    </div>
  </div>` : ""}

  ${S.map((s, i) => _trgSectionCard(s, i, S.length)).join("")}

  <div class="card">
    <div class="sec-hdr" style="display:flex;align-items:center;gap:8px">
      <span style="background:#C9A84C;color:#1B3A6B;font-weight:800;border-radius:8px;padding:2px 8px;font-size:12px">\u270D\uFE0F</span>
      <b>Signatures</b>
    </div>
    ${typeof signaturePad === "function" ? signaturePad("trg_prep", "Prepared by", "The author signs here") : ""}
    ${typeof signaturePad === "function" ? signaturePad("trg_appr", "Approved by", "EJAF approval") : ""}
  </div>

  <div class="card" style="background:linear-gradient(135deg,#1A237E 0%,#3949AB 100%);border:2px solid #C9A84C">
    ${typeof refOverrideField === "function" ? refOverrideField() : ""}${typeof brandLink === "function" ? brandLink() : ""}${typeof rptFormatToggle === "function" ? rptFormatToggle(true) : ""}
    <button class="btn btn-primary" style="background:#C9A84C;color:#1B3A6B;font-weight:700;border:none;width:100%"
      onclick="generateTechRefGuide()">${_fmtIcon()} Generate Reference Guide (${_fmtName()})</button>
  </div>
  ${typeof srSaveBar === "function" ? srSaveBar("trg") : ""}
  ${typeof srSavedList === "function" ? srSavedList("trg") : ""}`;
}

// ─── The finished document ────────────────────────────────────────────────
window.generateTechRefGuide = async function(){
  const m = window._trg, S = m.sections || [];
  if(!String(m.title || "").trim()) return toast("\u26A0 Give the guide a title");
  if(!S.length) return toast("\u26A0 Import at least one document");
  const K = (() => { let n = 0; return () => String(++n).padStart(2, "0"); })();
  const head = (no, t) => `<div style="margin:16px 0 6px;padding:5px 9px;background:#1A237E;color:#fff;font-weight:700;font-size:12px;border-radius:3px">${no}. ${escapeHtml(t)}</div>`;
  let body = `<div style="text-align:center;margin:6px 0 12px">
      <div style="font-size:18pt;font-weight:800;color:#1A237E">${escapeHtml(m.title)}</div>
      ${rptFilled(m.subtitle) ? `<div style="font-size:11pt;color:#555;margin-top:3px">${escapeHtml(m.subtitle)}</div>` : ""}
    </div>`;
  body += rptSect(t => head(K(), t), "Document Details", rptTable(
    rptRow("Client", m.client) + rptRow("Project", m.project) + rptRow("Site", m.site) +
    rptRow("Revision", m.revision) + rptRow("Issue date", m.date ? fmtDate(m.date) : "") +
    rptRow("Prepared by", m.preparedBy) + rptRow("Approved by", m.approvedBy)));
  if(rptFilled(m.scope)) body += head(K(), "Purpose & Scope") +
    `<div style="font-size:11px;line-height:1.75">${typeof textWithTablesHTML === "function" ? textWithTablesHTML(m.scope, {dash:false}) : escapeHtml(m.scope)}</div>`;
  // The contents list names the sections by the numbers they will carry.
  const startAt = (rptFilled(m.client) || rptFilled(m.project) || rptFilled(m.site) || rptFilled(m.revision) ||
                   rptFilled(m.date) || rptFilled(m.preparedBy) || rptFilled(m.approvedBy) ? 1 : 0) + (rptFilled(m.scope) ? 1 : 0) + (S.length > 1 ? 1 : 0);
  if(S.length > 1){
    body += head(K(), "Contents") + `<div style="font-size:11px;line-height:1.9">${S.map((s, i) =>
      `<div style="display:flex;gap:8px"><span style="min-width:2.2em;font-weight:700;color:#1A237E">${String(startAt + i + 1).padStart(2, "0")}.</span><span>${escapeHtml(s.title || "Section")}</span></div>`).join("")}</div>`;
  }
  for(const s of S){
    body += head(K(), s.title || "Section");
    if(rptFilled(s.note)) body += `<div style="font-size:10.5px;color:#555;font-style:italic;margin:0 0 6px">${escapeHtml(s.note)}</div>`;
    if(s.kind === "pdf"){
      body += (s.pages || []).map(p => `<div style="page-break-inside:avoid;text-align:center;margin:0 0 10px">
          <img src="${escapeHtml(p.data)}" style="max-width:100%;height:auto;border:1px solid #DDD">
          <div style="font-size:8.5pt;color:#888;margin-top:2px">${escapeHtml(s.file && s.file.name || "")} \u2014 page ${escapeHtml(String(p.page))}</div>
        </div>`).join("");
    } else {
      body += `<div style="font-size:10.5pt;color:#1a1a1a">${_trgSanitize(s.html)}</div>`;
    }
  }
  if(typeof sigAny === "function" && sigAny(["trg_prep", "trg_appr"])){
    body += head(K(), "Approval") + (typeof sigRow === "function" ? sigRow([
      ["trg_prep", m.preparedBy || "Prepared by", "Author", "EJAF Technology"],
      ["trg_appr", m.approvedBy || "Approved by", "Approval", "EJAF Technology"],
    ]) : "");
  }
  await openReportPDF("TECH_REFERENCE", [m.title, m.revision].filter(Boolean).join(" \u00b7 "), body,
                      {project:m.project || "", client:m.client || ""});
  toast("Reference guide ready!");
};

// ─── Saving: the heavy parts live beside the report, one document each ────
// A guide can hold dozens of rendered pages; Firestore caps a document at
// 1 MB. So the saved report itself stays small \u2014 details, section titles and
// an index \u2014 and every page image and every block of converted markup is its
// own document in reportAssets, linked by reportId. These are NOT synced to
// every phone like the other collections; they are fetched only when a guide
// is opened, so thirty guides do not become thirty downloads for a technician
// who never opens one.
const TRG_CHUNK = 450000;                 // characters \u2014 safe even for 2-byte text
function _trgChunks(s){ const out = []; s = String(s || ""); for(let i = 0; i < s.length; i += TRG_CHUNK) out.push(s.slice(i, i + TRG_CHUNK)); return out.length ? out : [""]; }
async function _trgAssetIds(reportId){
  const fb = window.__fb;
  const q = fb.query(fb.collection(fb.db, "reportAssets"), fb.where("reportId", "==", reportId));
  const snap = await fb.getDocs(q);
  const out = []; snap.forEach(d => out.push({id:d.id, ...d.data()}));
  return out;
}
async function _trgDeleteAssets(reportId){
  let list = [];
  try{ list = await _trgAssetIds(reportId); }catch(e){ return false; }
  for(const a of list) await fbDelete("reportAssets", a.id);
  return true;
}
window.trgSave = async function(){
  const m = window._trg, S = m.sections || [];
  if(!String(m.title || "").trim()) return toast("\u26A0 Give the guide a title before saving");
  const fb = window.__fb;
  if(!fb || !fb.db) return toast("\u26A0 Saving needs the database \u2014 sign in and try again");
  const id = window._srEditId || ("trg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  const total = S.reduce((a, s) => a + (s.kind === "pdf" ? (s.pages || []).length : _trgChunks(s.html).length), 0);
  let done = 0;
  try{
    // Replacing a saved guide: its old pages go first, or a page removed in
    // this edit would reappear the next time it is opened.
    if(window._srEditId) await _trgDeleteAssets(id);
    const index = [];
    for(const s of S){
      const entry = {sid:s.sid, kind:s.kind, title:s.title || "", note:s.note || "", file:s.file || {}, parts:0};
      if(s.kind === "pdf"){
        for(let pi = 0; pi < (s.pages || []).length; pi++){
          const pg = s.pages[pi];
          let data = pg.data;
          if(data.length > 900000 && typeof _srShrink === "function") data = (await _srShrink(data, 1400, 0.72)) || data;
          await fbSave("reportAssets", {id:`${id}__${s.sid}__p${pi}`, reportId:id, sid:s.sid, type:"page", seq:pi,
                                        data, w:pg.w || 0, h:pg.h || 0, page:pg.page || pi + 1});
          entry.parts++; done++; toast(`Saving\u2026 ${done} of ${total}`);
        }
      } else {
        const chunks = _trgChunks(s.html);
        for(let ci = 0; ci < chunks.length; ci++){
          await fbSave("reportAssets", {id:`${id}__${s.sid}__h${ci}`, reportId:id, sid:s.sid, type:"html", seq:ci, data:chunks[ci]});
          entry.parts++; done++; toast(`Saving\u2026 ${done} of ${total}`);
        }
      }
      index.push(entry);
    }
    const meta = {...m}; delete meta.sections;
    await fbSave("savedReports", {id, kind:"trg", kindLabel:"Technical Reference Guide",
      title:[m.title, m.revision].filter(Boolean).join(" \u2014 "), state:{_trg:meta}, trgIndex:index,
      photos:[], plans:[], photosDropped:0,
      savedBy:(state.profile && (state.profile.employeeName || state.profile.email)) || "",
      savedAt:new Date().toISOString(), date:m.date || todayStr()});
  }catch(e){
    return toast("\u26A0 Save did not finish \u2014 " + (e && e.message || "check the connection") + ". Nothing already saved was lost.");
  }
  window._srEditId = null;
  if(typeof srClearDirty === "function") srClearDirty();
  srNewReport("trg");
  window._trg.sections = [];
  render();
  toast(`Reference guide saved \u2713 \u2014 ${S.length} section${S.length === 1 ? "" : "s"}`);
};
window.trgOpen = async function(r){
  const fb = window.__fb;
  if(!fb || !fb.db) return toast("\u26A0 Opening a guide needs the database");
  toast("Opening the guide\u2026");
  let assets = [];
  try{ assets = await _trgAssetIds(r.id); }
  catch(e){ return toast("\u26A0 Could not load this guide's pages \u2014 connect and try again"); }
  const sections = (r.trgIndex || []).map(ix => {
    const mine = assets.filter(a => a.sid === ix.sid).sort((a, b) => a.seq - b.seq);
    const s = {sid:ix.sid, kind:ix.kind, title:ix.title, note:ix.note, file:ix.file || {}};
    if(ix.kind === "pdf") s.pages = mine.filter(a => a.type === "page").map(a => ({data:a.data, w:a.w, h:a.h, page:a.page}));
    else s.html = mine.filter(a => a.type === "html").map(a => a.data).join("");
    s._complete = mine.length === (ix.parts || 0);
    return s;
  });
  const broken = sections.filter(s => !s._complete).length;
  sections.forEach(s => delete s._complete);
  window._trg = Object.assign({title:"", subtitle:"", revision:"", date:"", client:"", clientOther:false,
    project:"", projectOther:false, site:"", siteOther:false, preparedBy:"", preparedByOther:false,
    approvedBy:"", approvedByOther:false, scope:""}, (r.state && r.state._trg) || {}, {sections});
  window._srEditId = r.id;
  if(typeof srClearDirty === "function") srClearDirty();
  render();
  try{ window.scrollTo({top:0, behavior:"smooth"}); }catch(e){}
  toast(broken ? `\u26A0 Opened, but ${broken} section${broken === 1 ? " is" : "s are"} incomplete on this device \u2014 connect and reopen`
               : "Guide opened \u2014 saving will update it");
};

Object.assign(window, {_trgSanitize, _trgUnzip, _trgImportDocx, _trgImportXlsx, _trgImportPdf, _trgRenderPages,
  _trgAddSection, renderTechRefGuide, _trgChunks, _trgAssetIds, _trgDeleteAssets});
