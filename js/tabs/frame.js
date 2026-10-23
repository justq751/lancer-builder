/* ============ FRAME ============ */
let frameFilter="ALL";
let frameSummaryOpen=true; // collapse state for the "ВЫБРАННОЕ ШАССИ" summary card
// i18n-dynamic: common.collapse, common.expand
/* Traits + CORE system markup, shared by the frame detail modal, the
   selected-frame card on the ШАССИ tab, and the ИТОГ (summary) tab. */
/* Renders one structured action (CORE power sub-action, or eventually a
   weapon's own top-level "actions" entries — same shape) as a proper
   stat-block: name + activation badge, then a stats row ONLY when the
   action actually deals damage or has its own range/burst (a lot of CORE
   actions are pure buffs/utility and have neither — in that case the row
   is simply omitted rather than shown empty), then TRIGGER and EFFECT as
   separate labeled lines. This is what fold_actions() used to flatten away
   into one paragraph; this reads the same source shape without discarding
   the structure. `act.detail` is already locale-overlaid the same way
   weapon on_hit/on_attack are (string or {detail} — see onHitText). */
function actionBlockHTML(act){
  if(!act) return "";
  const av=(act.activation||"").toLowerCase();
  const rangeStr=(act.range||[]).map(r=>`${tr(r.type)} ${r.val}`).join(", ");
  const dmgStr=(act.damage||[]).map(d=>`${d.val} ${tr(d.type)}`).join(", ");
  return `<div class="action-block act-${esc(av)||'free'}">
    <div class="action-head">
      <span class="action-nm">${esc(act.name||"")}</span>
      ${act.activation?`<span class="action-badge">${esc(tr(act.activation))}</span>`:""}
    </div>
    ${(rangeStr||dmgStr)?`<div class="action-stats">
      ${rangeStr?`<span class="action-stat">🎯 ${esc(rangeStr)}</span>`:""}
      ${dmgStr?`<span class="action-stat">💥 ${esc(dmgStr)}</span>`:""}
    </div>`:""}
    ${act.trigger?`<div class="action-row"><span class="action-lbl">${t("frame.action.trigger")}</span>${rich(onHitText(act.trigger))}</div>`:""}
    ${act.detail!==undefined?`<div class="action-row"><span class="action-lbl">${t("frame.action.detail")}</span>${rich(onHitText(act.detail))}</div>`:""}
  </div>`;
}
function frameTraitsCoreHTML(f){
  const cs=f.core_system;
  const traits=f.traits.map(tr8=>`<div style="margin-bottom:10px"><b style="font-family:'Chakra Petch',sans-serif">${esc(tr8.name)}</b><div class="desc" style="margin-top:3px">${rich(tr8.description)}</div></div>`).join("");
  let core="";
  if(cs){
    core=`<h3 style="font-family:'Chakra Petch',sans-serif;margin:6px 0 8px;color:var(--accent)">${t("frame.core_system", {name:cs.name})}</h3>
      ${cs.description?`<div class="desc" style="margin-bottom:8px">${rich(cs.description)}</div>`:""}`;
    if(cs.passive_name){
      core+=`<div style="margin-bottom:8px"><b>${t("frame.passive", {name:cs.passive_name})}</b></div>`;
      core+=cs.passive_effect?`<span class="desc">${rich(cs.passive_effect)}</span>`:"";
      if(cs.passive_actions&&cs.passive_actions.length) core+=cs.passive_actions.map(actionBlockHTML).join("");
    }
    if(cs.active_name){
      core+=`<div style="margin-bottom:8px; margin-top:12px"><b>${t("frame.core_active", {name:cs.active_name})}${cs.activation?` <span class="action-badge">${esc(tr(cs.activation))}</span>`:""}:</b></div>`;
      core+=cs.active_effect?`<span class="desc">${rich(cs.active_effect)}</span>`:"";
      if(cs.active_actions&&cs.active_actions.length) core+=cs.active_actions.map(actionBlockHTML).join("");
    }
  }
  return (traits?`<h3 style="font-family:'Chakra Petch',sans-serif;margin:6px 0 8px">${t("frame.traits")}</h3>${traits}`:"") + core;
}
/* Full frame detail: meta line + description + stat grid + traits/CORE.
   `computed`, if passed, is the fully-derived mech stat object (grit/HASE/
   CORE bonuses already folded in) — used when this is the pilot's actual
   equipped frame, so the numbers here match what's shown elsewhere (HUD,
   ИТОГ). When browsing a frame that ISN'T equipped yet, `computed` is
   omitted and this falls back to the frame's plain base stats, since none
   of those bonuses apply until the frame is actually selected. */
function frameDetailBodyHTML(f, computed, imgUrl, imgSize){
  const statRows = [
    ["structure","hp","armor"],
    ["stress","heatcap"],
    ["evasion","speed"],
    ["edef","tech_attack"],
    ["sensor_range","repcap"],
    ["save","sp"],
  ];
  const vals = computed || f.stats;
  const rowsHTML = statRows.map(keys=>{
    const cols = keys.length===3 ? "cols3" : "cols2";
    return `<div class="statrow-line ${cols}">${keys.map(k=>
      `<div class="stattile row">${statIconHTML(k,"lg")}<span class="k">${esc(L.stat_labels?.[k]||statShort(k))}</span><span class="v">${vals[k]}</span></div>`
    ).join("")}</div>`;
  }).join("");
  // Image floats at the top, roughly matched in size to the stat table's
  // height — description text wraps around it, then the stat grid is
  // force-cleared onto its own full-width line below, so it never gets
  // squeezed into the narrow space beside the float. Wrapped in a link to
  // the same hotlinked source so people can open/save the original art.
  const sz = imgSize || 150;
  const imgHTML = imgUrl ? `<a href="${imgUrl}" target="_blank" rel="noopener" title="${t("licenses.img_source")}">
    <img src="${imgUrl}" alt="" loading="lazy" onerror="this.closest('a').remove()"
      style="float:right; width:${sz}px; height:${sz}px; object-fit:contain; margin:0 0 12px 16px; border-radius:8px; background:var(--panel-2); cursor:zoom-in"></a>` : "";
  return `
    ${imgHTML}
    <div class="meta" style="margin-bottom:8px;color:${srcColor(f.source)}">${esc(SRC_NAME[f.source]||f.source)} · ${f.mechtype.map(tr).join(" / ")} · ${t("frame.license_ll", {ll:f.license_level})}</div>
    <div class="desc" style="margin-bottom:14px">${rich(f.description)}</div>
    <div class="statrows">${rowsHTML}</div>
    ${frameTraitsCoreHTML(f)}`;
}

function renderFrame(){
  const d=derived();
  $("#tab").innerHTML = sechead(t("frame.mark"),t("frame.title"),
    t("frame.lead"))
    + (d.frame ? `
      <div class="card" style="margin-bottom:20px">
        <div class="head"><span class="lbl"><b>//</b> ${t("frame.selected_head", {name:dispName(d.frame)})}</span>
          <span style="display:flex; align-items:center; gap:10px">
            <span class="lbl" style="color:${srcColor(d.frame.source)}">${esc(d.frame.source)}</span>
            <button class="xbtn expand" id="toggle-frame-summary" title="${t(frameSummaryOpen?"common.collapse":"common.expand")}" aria-label="${t("frame.summary_toggle", {action:tText(frameSummaryOpen?"common.collapse":"common.expand")})}">${frameSummaryOpen?'⌄':'›'}</button>
          </span></div>
        ${frameSummaryOpen?`<div class="body">${frameDetailBodyHTML(d.frame, d.mech, frameImageURL(d.frame))}</div>`:""}
      </div>` : "")
    + `<div class="filters" id="frame-filters">
        ${["ALL","GMS","IPS-N","SSC","HORUS","HA"].map(s=>`<button class="chip ${frameFilter===s?'on':''}" data-ff="${s}">${s==="ALL"?t("common.all"):s}</button>`).join("")}
       </div><div id="frame-list"></div>`;
  const list=offered("frames", f=>f.id===state.mech.frameId).filter(f=>frameFilter==="ALL"||f.source===frameFilter);
  // Group by manufacturer (GMS first, then IPS-N/SSC/HORUS/HA in that fixed
  // order) so each source gets its own row instead of interleaving — each
  // group is its own <div class="grid cards">, which is what forces the
  // next manufacturer's frames onto a new line.
  const groups={};
  list.forEach(f=>(groups[f.source]=groups[f.source]||[]).push(f));
  const srcKeys=Object.keys(groups).sort((a,b)=>sourceOrder(a)-sourceOrder(b));
  $("#frame-list").innerHTML=srcKeys.map(src=>{
    const fr=groups[src].sort((a,b)=>(frameUnlocked(b)-frameUnlocked(a))||dispName(a).localeCompare(dispName(b)));
    return `<h3 style="font-family:'Chakra Petch',sans-serif;font-size:16.5px;margin:20px 0 10px;color:${srcColor(src)}">// ${esc(SRC_NAME[src]||src)}</h3>
      <div class="grid cards">${fr.map(f=>{
        const sel=state.mech.frameId===f.id;
        const lk=!frameUnlocked(f);
        const s=f.stats;
        return `<div class="item has-cardlink ${sel?'sel':''} ${lk?'locked':''}" data-frame="${f.id}">
          <div class="src" style="background:${srcColor(f.source)}"></div>
          <div class="top">${cardLinkHTML("frame", f.id, esc(dispName(f)), "nm")}
            <div class="badge ${lk?'lock':'mfg'}" ${lk?'':`style="--src:${srcColor(f.source)}"`}>${lk?"🔒 LL"+f.license_level:f.source}</div></div>
          <div style="display:flex; gap:12px; align-items:flex-start; margin-top:6px">
            <div style="flex:1; min-width:0">
              <div class="meta">${f.mechtype.map(tr).join(" / ")}</div>
            </div>
            ${frameImageURL(f)?`<img class="frame-thumb lg" src="${frameImageURL(f)}" alt="${t("common.frame_portrait", {name:dispName(f)})}" loading="lazy" onerror="this.remove()">`:""}
          </div>
          <div class="tags stat-grid" style="margin-top:9px">
            <span class="tag stat">HP ${s.hp}</span><span class="tag stat">${t("frame.stat.evasion")} ${s.evasion}</span>
            <span class="tag stat">${t("frame.stat.armor")} ${s.armor}</span>
            <span class="tag stat sp">SP ${s.sp}</span><span class="tag stat">${t("frame.stat.speed")} ${s.speed}</span>
            <span class="tag stat">${t("frame.stat.size")} ${s.size}</span>
          </div>
          <div class="meta" style="margin-top:9px">${t("frame.mounts", {list:f.mounts.map(tr).join(" · ")})}</div>
          <button class="ghostbtn ${(!sel&&lk)?'warn':''}" data-pickframe="${f.id}" ${sel?'aria-disabled="true"':""}
            style="margin-top:11px; width:100%; text-align:center">${sel?"✓ "+t("common.selected"):(lk?"⚠ "+t("frame.pick_force"):"▶ "+t("frame.pick"))}</button>
        </div>`;
      }).join("")}</div>`;
  }).join("");
  $$("#frame-filters .chip").forEach(c=>c.onclick=()=>{frameFilter=c.dataset.ff; renderFrame();});
  // The selected frame's button stays focusable (aria-disabled, not disabled):
  // it is where focus lands after the pick, saying «✓ ВЫБРАНО».
  $$("#frame-list [data-pickframe]").forEach(b=>b.onclick=()=>{
    if(b.getAttribute("aria-disabled")==="true") return;
    pickFrame(b.dataset.pickframe);
  });
  const toggleBtn=$("#toggle-frame-summary");
  if(toggleBtn) toggleBtn.onclick=()=>{ frameSummaryOpen=!frameSummaryOpen; renderFrame(); };
}
function openFrame(id){
  const f=M.frame[id];
  const isSel=state.mech.frameId===id;
  const lk=!frameUnlocked(f);
  modal(dispName(f), frameDetailBodyHTML(f, isSel?derived().mech:null, frameImageURL(f), 300));
  const mhd=$("#modal .mhd");
  const btn=document.createElement("button");
  btn.className="toolbtn";
  if(isSel){
    btn.style.borderColor="var(--accent)"; btn.style.color="var(--accent)";
    btn.textContent="✓ "+tText("common.selected");
    btn.disabled=true; btn.style.opacity=".6";
  } else {
    const clr = lk ? "var(--red)" : "var(--accent)";
    btn.style.borderColor=clr; btn.style.color=clr;
    btn.textContent = lk ? "⚠ "+tText("frame.pick_force") : "▶ "+tText("frame.pick");
    // Close first: pickFrame() may need the modal for its own confirmation.
    btn.onclick=()=>{ closeModal(); pickFrame(id); };
  }
  mhd.insertBefore(btn, mhd.querySelector(".mclose"));
}
