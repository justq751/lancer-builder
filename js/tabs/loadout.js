/* ============ LOADOUT ============ */
function renderLoadout(){
  const d=derived();
  if(!d.frame){
    $("#tab").innerHTML=sechead(t("loadout.mark"),t("loadout.title"),t("loadout.no_frame_lead"))
      +`<div class="nomech" style="padding:40px">${t("loadout.no_frame")}</div>`;
    return;
  }
  const over=d.sp.used>d.sp.cap;
  $("#tab").innerHTML = sechead(t("loadout.mark"),t("loadout.title_frame", {name:dispName(d.frame)}),
    t("loadout.lead", {used:d.sp.used, cap:d.sp.cap}))
    + (over?`<div class="warnbox">⚠ ${t("loadout.over", {n:d.sp.used-d.sp.cap})}</div>`:"")
    + `<h3 class="subhead" style="margin:6px 0 12px">${t("loadout.mounts_head")}</h3>
       <div id="mounts"></div>
       <h3 class="subhead" style="margin:24px 0 6px">${t("loadout.systems_head")} <span class="mono" style="font-size:12px;color:var(--faint)">(SP ${d.sp.used}/${d.sp.cap})</span></h3>
       <div class="spacer-sm"></div>
       <button class="ghostbtn" id="add-system">+ ${t("loadout.add_system")}</button>
       <div class="grid" id="syslist" style="margin-top:12px"></div>`;

  // mounts
  $("#mounts").innerHTML = state.mech.mounts.map((mt,mi)=>{
    const isInt = mt.type==="Integrated";
    const sizes=mt.items.map(slot=>M.weapon[slot.id]?.mount);
    const can = isInt ? false : allowedNext(mt.type,sizes).length>0;
    const slots = mt.items.map((slot,wi)=>{
      const w=M.weapon[slot.id];
      const mod = slot.mod ? M.mod[slot.mod] : null;
      const ew = effectiveWeapon(w, mod); // mod's added_tags/range/damage folded in, for display only
      const key=`${mi}:${wi}`, dk=`${mi}-${wi}`, open=eqWeaponExpanded.has(key);
      const row=`<div class="equipped">
        <div class="ei clickable has-cardlink">${cardLinkHTML("weapon", key, esc(w.name), "en")}
          <div class="em">${tr(w.mount)} · ${tr(w.type)} · ${dmgStr(ew)} · ${rngStr(ew)}${w.sp?` · ${w.sp} SP`:""}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="xbtn expand" data-expw="${key}" title="${t("common.show_details")}" aria-label="${t(open?"common.collapse_details":"common.expand_details")}">${open?'⌄':'›'}</button>
          <button class="xbtn" data-rmw="${key}" aria-label="${t("loadout.remove_weapon")}">✕</button>
        </div>
      </div>`;
      const expand=open?`<div class="expand-detail">${weaponCardBody(ew, dk, eqWeaponProfIdx.get(key)||0)}</div>`:"";

      // mod sub-row: install button if none, else name + expand/remove
      const compatMods = (L.mods||[]).filter(m=>modCompatible(m,w));
      const modOpen = eqModExpanded.has(key);
      let modRow="";
      if(mod){
        const mlk=!unlocked(mod);
        modRow = `<div class="equipped" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)">
          <div class="ei clickable has-cardlink">${cardLinkHTML("mod", key, `<span aria-hidden="true">🔧</span> ${esc(mod.name)}`, "en")}
            <div class="em">${mlk?`🔒 ${esc(licenseDisplayName(mod.license))} ${mod.license_level}`:`${mod.sp||0} SP`}</div></div>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="xbtn expand" data-expmod="${key}" title="${t("common.show_details")}" aria-label="${t(modOpen?"common.collapse_details":"common.expand_details")}">${modOpen?'⌄':'›'}</button>
            <button class="xbtn" data-rmmod="${key}" aria-label="${t("loadout.remove_mod")}">✕</button>
          </div>
        </div>${modOpen?`<div class="expand-detail">${modCardBody(mod, dk+"-mod")}</div>`:""}`;
      } else if(compatMods.length){
        modRow = `<button class="ghostbtn block mt-10" data-addmod="${key}">+ ${t("loadout.install_mod")}</button>`;
      }
      return `<div class="slot">${row}${expand}${modRow}</div>`;
    }).join("");
    const capLine = isInt
      ? t("loadout.integrated", {n:mt.items.length})
      : `${mt.items.length} / ${mt.type.includes("/")||mt.type==="Flex"?2:1} · ${allowedNext(mt.type,sizes).map(tr).join("/")||t("loadout.filled")}`;
    const restoreBtn = (isInt && !mt.items.length)
      ? `<div class="slot"><button class="ghostbtn" data-restoreint="${mi}">+ ${t("loadout.restore_integrated")}</button></div>` : "";
    return `<div class="mount ${isInt?'integrated':''}">
      <div class="mhead"><span class="mt">${tr(mt.type)}</span>
        <span class="cap">${capLine}</span></div>
      ${slots}
      ${can?`<div class="slot"><button class="ghostbtn" data-addw="${mi}">+ ${t("loadout.install_weapon")}</button></div>`:""}
      ${restoreBtn}
    </div>`;
  }).join("");
  eqWeaponExpanded.forEach(key=>{
    const [emi,ewi]=key.split(":").map(Number);
    const mnt=state.mech.mounts[emi], slot=mnt && mnt.items[ewi], w=slot && M.weapon[slot.id];
    if(!w){ eqWeaponExpanded.delete(key); return; }
    const ew = effectiveWeapon(w, slot.mod ? M.mod[slot.mod] : null);
    const dk=`${emi}-${ewi}`;
    const tagSet=getMap(eqWeaponTagSets,key,()=>new Set());
    wireTagGlossary(`#wp-tags-${dk}`,`#wp-tagdesc-${dk}`, weaponDisplayTags(ew, eqWeaponProfIdx.get(key)||0), tagSet);
    wireProfileChips(`#wp-profiles-${dk}`, renderLoadout, v=>eqWeaponProfIdx.set(key,v));
  });
  eqModExpanded.forEach(key=>{
    const [emi,ewi]=key.split(":").map(Number);
    const mnt=state.mech.mounts[emi], slot=mnt && mnt.items[ewi], mod=slot && slot.mod && M.mod[slot.mod];
    if(!mod){ eqModExpanded.delete(key); return; }
    const dk=`${emi}-${ewi}-mod`;
    const tagSet=getMap(eqModTagSets,key,()=>new Set());
    wireTagGlossary(`#md-tags-${dk}`,`#md-tagdesc-${dk}`, mod.tags||[], tagSet);
  });

  // systems
  $("#syslist").innerHTML = state.mech.systems.length? state.mech.systems.map((id,si)=>{
    const sy=M.system[id];
    const open=eqSystemExpanded.has(si);
    const row=`<div class="listrow">
      <div class="info clickable has-cardlink"><div class="nm">${cardLinkHTML("system", si, esc(sy.name))} <span class="tag sp">${sy.sp} SP</span></div>
        <div class="ds">${esc(tr(sy.type))} · ${esc(sy.source)}${sy.effect?" · "+esc(truncateWords(stripHTML(sy.effect),140)):""}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="xbtn expand" data-exps="${si}" title="${t("common.show_details")}" aria-label="${t(open?"common.collapse_details":"common.expand_details")}">${open?'⌄':'›'}</button>
        <button class="xbtn" data-rms="${si}" aria-label="${t("loadout.remove_system")}">✕</button>
      </div>
    </div>`;
    const expand=open?`<div class="expand-detail">${systemCardBody(sy, String(si))}</div>`:"";
    return `<div class="pickitem">${row}${expand}</div>`;
  }).join("") : `<div class="hint">${t("loadout.no_systems")}</div>`;
  eqSystemExpanded.forEach(si=>{
    const sy=M.system[state.mech.systems[si]];
    if(!sy){ eqSystemExpanded.delete(si); return; }
    const tagSet=getMap(eqSystemTagSets,si,()=>new Set());
    wireTagGlossary(`#sy-tags-${si}`,`#sy-tagdesc-${si}`, sy.tags||[], tagSet);
  });

  $$("#mounts .ghostbtn[data-addw]").forEach(b=>b.onclick=()=>openWeaponPicker(+b.dataset.addw));
  $$("#mounts .ghostbtn[data-restoreint]").forEach(b=>b.onclick=()=>openIntegratedPicker(+b.dataset.restoreint));
  $$("#mounts .xbtn[data-rmw]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const key=b.dataset.rmw, [mi,wi]=key.split(":").map(Number);
    state.mech.mounts[mi].items.splice(wi,1);
    eqWeaponExpanded.delete(key); eqWeaponTagSets.delete(key); eqWeaponProfIdx.delete(key);
    eqModExpanded.delete(key); eqModTagSets.delete(key);
    render();
  });
  $$("#mounts .xbtn[data-expw]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const key=b.dataset.expw;
    if(eqWeaponExpanded.has(key)) eqWeaponExpanded.delete(key); else eqWeaponExpanded.add(key);
    renderLoadout();
  });
  $$("#mounts .ghostbtn[data-addmod]").forEach(b=>b.onclick=()=>{
    const [mi,wi]=b.dataset.addmod.split(":").map(Number);
    openModPicker(mi,wi);
  });
  $$("#mounts .xbtn[data-expmod]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const key=b.dataset.expmod;
    if(eqModExpanded.has(key)) eqModExpanded.delete(key); else eqModExpanded.add(key);
    renderLoadout();
  });
  $$("#mounts .xbtn[data-rmmod]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const key=b.dataset.rmmod, [mi,wi]=key.split(":").map(Number);
    state.mech.mounts[mi].items[wi].mod=null;
    eqModExpanded.delete(key); eqModTagSets.delete(key);
    render();
  });
  $("#add-system").onclick=openSystemPicker;
  $$("#syslist .xbtn[data-rms]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const si=+b.dataset.rms;
    state.mech.systems.splice(si,1);
    eqSystemExpanded.delete(si); eqSystemTagSets.delete(si);
    render();
  });
  $$("#syslist .xbtn[data-exps]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const si=+b.dataset.exps;
    if(eqSystemExpanded.has(si)) eqSystemExpanded.delete(si); else eqSystemExpanded.add(si);
    renderLoadout();
  });
}
/* Strips HTML tags for a plain-text preview, then truncates at a word
   boundary (never mid-word, never mid-tag) with an ellipsis. Used for
   one-line summaries in compact lists — full text is always shown untouched
   in the detail card. */
const stripHTML = html => String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const truncateWords = (str, max) => {
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…";
};

const dmgStr=w=>(w.damage||[]).map(x=>`${x.val} ${tr(x.type)}`).join(", ")||"—";

/* Wires click handlers on .glossary tag chips inside `tagsSel` so clicking
   one toggles a description box (`boxSel`) looked up from the tag glossary
   (data/tags.json + locales/<lang>/tags.json). `rawTags` must be the same
   array used to render the chips, in the same order (data-tgi is the index). */
let tagOpenSet=new Set();
function wireTagGlossary(tagsSel, boxSel, rawTags, tagSet){
  tagSet = tagSet || tagOpenSet;
  const box=$(boxSel);
  // Callers wire their buttons on the lines after this call. A missing
  // description container must not throw and take those with it.
  if(!box) return;
  const draw=()=>{
    const openIdx=[...tagSet].sort((a,b)=>a-b);
    box.innerHTML = openIdx.map(i=>{
      const raw=rawTags[i];
      const info=describeTag(trTag(raw)) || describeTag(raw);
      return info
        ? `<div class="tagdesc"><b>${esc(info.name)}</b><div style="margin-top:4px">${esc(info.description)}</div></div>`
        : `<div class="tagdesc">${t("loadout.no_tag")}</div>`;
    }).join("");
    $$(`${tagsSel} .glossary`).forEach(el=>{
      const on=tagSet.has(+el.dataset.tgi);
      el.classList.toggle("open", on);
      el.setAttribute("aria-expanded", String(on));
    });
  };
  $$(`${tagsSel} .glossary`).forEach(el=>{
    el.onclick=()=>{
      const i=+el.dataset.tgi;
      if(tagSet.has(i)) tagSet.delete(i); else tagSet.add(i);
      draw();
    };
  });
  draw();
}
const rngStr=w=>(w.range||[]).map(x=>`${tr(x.type)} ${x.val}`).join(", ")||"—";
/* Every keystroke in a picker redraws the modal body, which destroys and
   recreates the search input. Restoring focus alone parks the caret at the
   end, so a typo in the middle of a query could never be corrected — the
   caret position has to travel across the redraw with it. */
function restoreCaret(sel, pos){
  const el=$(sel); if(!el) return;
  el.focus();
  try{ el.setSelectionRange(pos, pos); }catch(e){}
}
/* Distinct damage-type strings for a weapon, used by the weapon-picker's
   damage filter. Multi-profile weapons (w.profiles[]) can carry damage per
   profile instead of on the top-level w.damage, so fall back to
   aggregating across profiles when the top-level array is empty. */
const weaponDamageTypes=w=>{
  const dmg=(w.damage&&w.damage.length)?w.damage:(w.profiles||[]).flatMap(p=>p.damage||[]);
  return [...new Set(dmg.map(d=>d.type))];
};
const onHitText=v=>v==null?"":(typeof v==="string"?v:v.detail);

/* Full weapon detail card markup, shared by the weapon picker's detail view
   and the "view installed weapon" modal opened from the loadout list. */
