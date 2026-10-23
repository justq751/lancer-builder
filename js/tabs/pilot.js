/* ============ PILOT ============ */
// What a screen reader says for the LL slider instead of a bare "3".
const llValueText=ll=>tText("pilot.ll.valuetext", {ll, grit:Math.ceil(ll/2)});
function renderPilot(){
  const p=state.pilot;
  const bgOpts = `<option value="">${t("pilot.bg_none")}</option>`+offered("backgrounds", b=>b.id===p.background)
    .map(b=>`<option value="${b.id}" ${p.background===b.id?"selected":""}>${esc(b.name)}</option>`).join("");
  $("#tab").innerHTML = sechead(t("pilot.mark"),t("pilot.title"),t("pilot.lead"))
   + `<div class="row2">
        <div class="field"><label for="f-name">${t("pilot.field.name")}</label>
          <input class="input" id="f-name" value="${esc(p.name)}" placeholder="${t("pilot.field.name_ph")}" autocomplete="off" spellcheck="false"></div>
        <div class="field"><label for="f-call">${t("pilot.field.callsign")}</label>
          <input class="input" id="f-call" value="${esc(p.callsign)}" placeholder="${t("pilot.field.callsign_ph")}" autocomplete="off" spellcheck="false"></div>
      </div>
      <div class="field"><label for="f-bg">${t("pilot.field.background")}</label>
        <select id="f-bg" aria-describedby="bg-desc">${bgOpts}</select>
        <div id="bg-desc" class="hint" style="margin-top:8px"></div></div>
      <div class="field"><label for="f-ll" id="f-ll-label">${t("pilot.field.ll", {ll:p.ll})}</label>
        <div class="llpick">
          <span class="num" aria-hidden="true">${p.ll}</span>
          <div style="flex:1">
            <input type="range" id="f-ll" min="0" max="12" value="${p.ll}" aria-valuetext="${llValueText(p.ll)}">
            <div class="lab" style="display:flex;justify-content:space-between;margin-top:4px">
              <span>${t("pilot.ll.min")}</span><span>${t("pilot.ll.max")}</span></div>
          </div>
          <div class="lab" style="text-align:right">GRIT<br><b style="color:var(--accent);font-size:22px">+${Math.ceil(p.ll/2)}</b></div>
        </div></div>
      <details class="note"><summary>${t("pilot.budget_q")}</summary><div class="body">
        ${t("pilot.budget_body")}
      </div></details>
      <h3 class="subhead" style="margin:28px 0 6px">${t("pilot.gear_head")}</h3>
      <p class="hint" style="margin-bottom:14px">${t("pilot.gear_hint")}</p>
      <div id="pilot-gear-loadout"></div>`;
  renderPilotGearLoadout();

  // These skip render() (it would rebuild the field under the caret), so they
  // must ask for the autosave themselves — render() is where it usually happens.
  $("#f-name").oninput=e=>{state.pilot.name=e.target.value; renderHUD(); scheduleSave();};
  $("#f-call").oninput=e=>{state.pilot.callsign=e.target.value; renderHUD(); scheduleSave();};
  const bgDesc=()=>{ const b=M.bg[state.pilot.background]; $("#bg-desc").innerHTML=b?rich(b.description):""; };
  $("#f-bg").onchange=e=>{state.pilot.background=e.target.value; bgDesc(); renderHUD(); scheduleSave();};
  bgDesc();
  const ll=$("#f-ll");
  ll.oninput=e=>{ state.pilot.ll=+e.target.value;
    $$(".llpick .num").forEach(n=>n.textContent=e.target.value);
    $$(".llpick .lab b").forEach(b=>b.textContent="+"+Math.ceil(state.pilot.ll/2));
    // By id: the old `.field>label` matched the first label on the tab — the
    // pilot's name — and dragging the slider overwrote it.
    $("#f-ll-label").textContent=tText("pilot.field.ll", {ll:e.target.value});
    e.target.setAttribute("aria-valuetext", llValueText(state.pilot.ll));
    renderHUD(); renderTabBar(); };
  ll.onchange=()=>render();
}

/* key is "armor:0" / "weapon:1" / "gear:2" — the slot, as cardLinkHTML got it. */
function viewPilotGear(key){
  const [kind,idxStr]=key.split(":"), idx=+idxStr;
  const id = kind==="armor"?state.gear.armor:kind==="weapon"?state.gear.weapons[idx]:state.gear.gear[idx];
  const item=M.gear[id]; if(!item) return;
  modal(item.name, pilotGearCardHTML(item));
  wireTagGlossary("#pg-tags","#pg-tagdesc",item.tags||[]);
}
// i18n-dynamic: common.collapse_details, common.expand_details
function renderPilotGearLoadout(){
  const g=state.gear;
  const slotGroup=(label, kind, items, max, isArmorSingle)=>{
    const slots=[];
    for(let i=0;i<max;i++){
      const id = isArmorSingle ? (i===0?items:null) : (items[i]||null);
      if(id){
        const item=M.gear[id];
        const key=`${kind}:${i}`, open=pilotGearOpenSet.has(key);
        slots.push(`<div class="slot">
          <div class="equipped">
            <div class="ei clickable has-cardlink">${cardLinkHTML("gear", key, esc(item.name), "en")}
              <div class="em">${tr(item.type)}${item.damage||item.range?` · ${dmgStr(item)} · ${rngStr(item)}`:""}</div></div>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="xbtn expand" data-exppg="${key}" title="${t("common.show_details")}" aria-label="${t(open?"common.collapse_details":"common.expand_details")}">${open?'⌄':'›'}</button>
              <button class="xbtn" data-rmpg="${key}" aria-label="${t("pilot.gear_remove")}">✕</button>
            </div>
          </div>
          ${open?`<div class="expand-detail">${pilotGearCardBody(item, key)}</div>`:""}
        </div>`);
      } else {
        slots.push(`<div class="slot"><button class="ghostbtn block" data-addpg="${kind}:${i}">+ ${t("pilot.slot.install", {what:label.toUpperCase()})}</button></div>`);
      }
    }
    return `<div class="mount"><div class="mhead"><span class="mt">${label}</span><span class="cap">${isArmorSingle?(items?1:0):items.length} / ${max}</span></div>${slots.join("")}</div>`;
  };

  $("#pilot-gear-loadout").innerHTML =
    slotGroup(tText("pilot.slot.armor"), "armor", g.armor, 1, true) +
    slotGroup(tText("pilot.slot.weapon"), "weapon", g.weapons, 2, false) +
    slotGroup(tText("pilot.slot.gear"), "gear", g.gear, 3, false);

  $$("#pilot-gear-loadout [data-addpg]").forEach(b=>b.onclick=()=>{
    const [kind,idxStr]=b.dataset.addpg.split(":"), idx=+idxStr;
    const slotKind = kind==="armor"?"Armor":kind==="weapon"?"Weapon":"Gear";
    openPilotGearPicker(slotKind, id=>{
      if(kind==="armor") state.gear.armor=id;
      else if(kind==="weapon") state.gear.weapons[idx]=id;
      else state.gear.gear[idx]=id;
    });
  });
  $$("#pilot-gear-loadout [data-rmpg]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const [kind,idxStr]=b.dataset.rmpg.split(":"), idx=+idxStr;
    if(kind==="armor") state.gear.armor=null;
    else if(kind==="weapon") state.gear.weapons.splice(idx,1);
    else state.gear.gear.splice(idx,1);
    render();
  });
  $$("#pilot-gear-loadout [data-exppg]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const key=b.dataset.exppg;
    if(pilotGearOpenSet.has(key)) pilotGearOpenSet.delete(key); else pilotGearOpenSet.add(key);
    renderPilotGearLoadout();
  });
}
