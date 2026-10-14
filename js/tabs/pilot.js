/* ============ PILOT ============ */
function renderPilot(){
  const p=state.pilot;
  const bgOpts = `<option value="">— не выбрано —</option>`+L.backgrounds
    .map(b=>`<option value="${b.id}" ${p.background===b.id?"selected":""}>${esc(b.name)}</option>`).join("");
  $("#tab").innerHTML = sechead("// 01 · ИДЕНТИФИКАЦИЯ","Пилот","Базовые данные пилота. Лицензионный уровень (LL) задаёт весь бюджет построения — поднимайте его, чтобы открыть больше навыков, талантов и снаряжения.")
   + `<div class="row2">
        <div class="field"><label>ИМЯ ПИЛОТА</label>
          <input class="input" id="f-name" value="${esc(p.name)}" placeholder="напр. Кейт Аояма"></div>
        <div class="field"><label>ПОЗЫВНОЙ</label>
          <input class="input" id="f-call" value="${esc(p.callsign)}" placeholder="напр. RONIN"></div>
      </div>
      <div class="field"><label>ПРОИСХОЖДЕНИЕ (BACKGROUND)</label>
        <select id="f-bg">${bgOpts}</select>
        <div id="bg-desc" class="hint" style="margin-top:8px"></div></div>
      <div class="field"><label>ЛИЦЕНЗИОННЫЙ УРОВЕНЬ — LL ${p.ll}</label>
        <div class="llpick">
          <span class="num">${p.ll}</span>
          <div style="flex:1">
            <input type="range" id="f-ll" min="0" max="12" value="${p.ll}">
            <div class="lab" style="display:flex;justify-content:space-between;margin-top:4px">
              <span>LL0 · новобранец</span><span>LL12 · ветеран</span></div>
          </div>
          <div class="lab" style="text-align:right">GRIT<br><b style="color:var(--accent);font-size:22px">+${Math.ceil(p.ll/2)}</b></div>
        </div></div>
      <details class="note"><summary>Как считается бюджет?</summary><div class="body">
        На каждом LL вы получаете: <b>+1</b> очко навыков, талантов, мех-навыков и лицензий. GRIT = LL ÷ 2 (округление вверх) и добавляется к HP меха, спасброску и атакам. CORE-бонус выдаётся на каждом чётном уровне.
        <ul><li>Очки навыков: 4 + LL</li><li>Очки талантов: 3 + LL</li><li>Мех-навыки: 2 + LL</li><li>Лицензии: LL</li><li>CORE-бонусы: LL ÷ 2 (вниз)</li></ul>
      </div></details>
      <h3 class="subhead" style="margin:28px 0 6px">// СНАРЯЖЕНИЕ ПИЛОТА (GEAR LOADOUT)</h3>
      <p class="hint" style="margin-bottom:14px">Личное снаряжение пилота — отдельно от снаряжения меха. 1 слот брони, 2 слота оружия, 3 слота прочего снаряжения.</p>
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
    $(".field>label").textContent=`ЛИЦЕНЗИОННЫЙ УРОВЕНЬ — LL ${e.target.value}`;
    renderHUD(); renderTabBar(); };
  ll.onchange=()=>render();
}

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
            <div class="ei clickable" data-viewpg="${key}"><div class="en">${esc(item.name)}</div>
              <div class="em">${tr(item.type)}${item.damage||item.range?` · ${dmgStr(item)} · ${rngStr(item)}`:""}</div></div>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="xbtn expand" data-exppg="${key}" title="Показать подробности" aria-label="${open?'Свернуть':'Развернуть'} подробности">${open?'⌄':'›'}</button>
              <button class="xbtn" data-rmpg="${key}" aria-label="Убрать снаряжение">✕</button>
            </div>
          </div>
          ${open?`<div class="expand-detail">${pilotGearCardBody(item, key)}</div>`:""}
        </div>`);
      } else {
        slots.push(`<div class="slot"><button class="ghostbtn block" data-addpg="${kind}:${i}">+ УСТАНОВИТЬ ${label.toUpperCase()}</button></div>`);
      }
    }
    return `<div class="mount"><div class="mhead"><span class="mt">${label}</span><span class="cap">${isArmorSingle?(items?1:0):items.length} / ${max}</span></div>${slots.join("")}</div>`;
  };

  $("#pilot-gear-loadout").innerHTML =
    slotGroup("Броня", "armor", g.armor, 1, true) +
    slotGroup("Оружие", "weapon", g.weapons, 2, false) +
    slotGroup("Снаряжение", "gear", g.gear, 3, false);

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
  $$("#pilot-gear-loadout [data-viewpg]").forEach(el=>el.onclick=()=>{
    const [kind,idxStr]=el.dataset.viewpg.split(":"), idx=+idxStr;
    const id = kind==="armor"?state.gear.armor:kind==="weapon"?state.gear.weapons[idx]:state.gear.gear[idx];
    const item=M.gear[id];
    modal(item.name, pilotGearCardHTML(item));
    wireTagGlossary("#pg-tags","#pg-tagdesc",item.tags||[]);
  });
}
