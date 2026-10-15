/* ============ CORE-БОНУСЫ ============ */
let coreFilter="ALL", coreSearch="";

/* Shared detail-card markup for a CORE bonus, used both when viewing an
   already-selected bonus and when browsing the add-picker. */
function coreCardBody(c){
  const unl=coreBonusUnlocked(c);
  return `${unl?"":`<div class="hint" style="margin-top:2px">Требуется 3+ ранга лицензии на шасси ${esc(c.source)} (сейчас: ${manufacturerRank(c.source)}).</div>`}
    <div class="desc" style="margin-top:10px">${rich(c.effect)}</div>
    ${c.mounted_effect?`<div class="desc" style="margin-top:9px"><b>Если установлено на крепление:</b> ${rich(c.mounted_effect)}</div>`:""}`;
}
function coreCardHTML(c){
  const unl=coreBonusUnlocked(c);
  return `<div class="item static">
    <div class="src" style="background:${srcColor(c.source)}"></div>
    <div class="top"><div class="nm" style="font-size:21px">${esc(c.name)}</div>
      <div class="badge ${unl?'mfg':'lock'}" ${unl?`style="--src:${srcColor(c.source)}"`:''}>${unl?esc(c.source):"🔒 "+esc(c.source)+" 3+"}</div></div>
    <div style="margin-top:11px">${coreCardBody(c)}</div>
  </div>`;
}

function renderCore(){
  const d=derived();
  const capped=d.b.core.cap<1;
  $("#tab").innerHTML = sechead("// 08 · CORE-БОНУСЫ","CORE-бонусы",
      capped
        ? "CORE-бонусы открываются с LL3, и затем ещё по одному за каждые 3 уровня лицензий (LL6, LL9…)."
        : `Выбрано ${state.cores.length} из ${d.b.core.cap}. Бонусы конкретного производителя открываются, когда у вас есть 3+ ранга лицензии на любое шасси этого производителя — иначе доступны только бонусы GMS.`)
    + (capped ? "" : `
      <div id="core-selected"></div>
      <div class="filters" id="core-filters" style="margin-top:18px">${["ALL","GMS","IPS-N","SSC","HORUS","HA","EXOTIC"].map(s=>`<button class="chip ${coreFilter===s?'on':''}" data-cf="${s}">${s==="ALL"?"ВСЕ":s}</button>`).join("")}</div>
      <input class="input" id="core-search" aria-label="Поиск CORE-бонусов" placeholder="поиск CORE-бонусов…" style="margin:12px 0 14px" value="${esc(coreSearch)}">
      <div id="core-list"></div>`);
  if(capped) return;

  $("#core-selected").innerHTML = state.cores.length ? `<div class="mount">` + state.cores.map((id,ci)=>{
    const c=M.core[id];
    return `<div class="slot">
      <div class="equipped">
        <div class="ei clickable has-cardlink">${cardLinkHTML("core-selected", ci, esc(c.name), "en")}
          <div class="em">${esc(c.source)}</div></div>
        <button class="xbtn" data-rmcore="${ci}" aria-label="Убрать CORE-бонус">✕</button>
      </div>
      <div style="margin-top:10px">${coreCardBody(c)}</div>
    </div>`;
  }).join("") + `</div>` : `<div class="hint">// CORE-бонусы не выбраны</div>`;

  $$("#core-selected .xbtn[data-rmcore]").forEach(b=>b.onclick=()=>{
    state.cores.splice(+b.dataset.rmcore,1); render();
  });

  const drawList=()=>{
    const list=L.core_bonuses
      .filter(c=>!state.cores.includes(c.id))
      .filter(c=>coreFilter==="ALL"||c.source===coreFilter)
      .filter(c=>!coreSearch||(c.name+" "+c.source).toLowerCase().includes(coreSearch.toLowerCase()));
    // Group by manufacturer (GMS first, then IPS-N/SSC/HORUS/HA/EXOTIC in
    // that fixed order) — same layout as ШАССИ/ЛИЦЕНЗИИ: each source is its
    // own <div class="grid cards">, which is what forces the next
    // manufacturer's bonuses onto a new row instead of interleaving.
    const groups={};
    list.forEach(c=>(groups[c.source]=groups[c.source]||[]).push(c));
    const srcKeys=Object.keys(groups).sort((a,b)=>sourceOrder(a)-sourceOrder(b));
    const dNow=derived();
    const slotsFull=state.cores.length>=dNow.b.core.cap;
    $("#core-list").innerHTML = srcKeys.length ? srcKeys.map(src=>{
      const fr=groups[src].sort((a,b)=>(coreBonusUnlocked(b)-coreBonusUnlocked(a))||a.name.localeCompare(b.name));
      return `<h3 style="font-family:'Chakra Petch',sans-serif;font-size:16.5px;margin:20px 0 10px;color:${srcColor(src)}">// ${esc(SRC_NAME[src]||src)}</h3>
        <div class="grid cards">${fr.map(c=>{
          const unl=coreBonusUnlocked(c);
          const terse=(L.core_terse?.[c.id]?.[currentLang])||(L.core_terse?.[c.id]?.en)||"";
          return `<div class="item has-cardlink ${!unl?'locked':''}" data-c="${c.id}">
            <div class="src" style="background:${srcColor(c.source)}"></div>
            <div class="top">${cardLinkHTML("core", c.id, esc(c.name), "nm")}
              <div class="badge ${unl?'mfg':'lock'}" ${unl?`style="--src:${srcColor(c.source)}"`:''}>${unl?esc(c.source):"🔒 "+esc(c.source)+" 3+"}</div></div>
            ${terse?`<div class="desc" style="margin-top:8px">${esc(terse)}</div>`:""}
            <button class="ghostbtn ${slotsFull?'':(unl?'':'warn')}" data-pickcore="${c.id}" ${slotsFull?"disabled":""}
              style="margin-top:11px; width:100%; text-align:center">${slotsFull?`⚠ Лимит исчерпан (${state.cores.length}/${dNow.b.core.cap})`:(unl?"✓ Выбрать этот CORE-бонус":"⚠ Выбрать всё равно")}</button>
          </div>`;
        }).join("")}</div>`;
    }).join("") : `<div class="hint">// нет доступных CORE-бонусов по этому запросу</div>`;
    $$("#core-list [data-pickcore]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.pickcore, dd=derived();
      if(state.cores.length>=dd.b.core.cap) return;
      state.cores.push(id); render();
    });
  };
  $$("#core-filters .chip").forEach(ch=>ch.onclick=()=>{
    coreFilter=ch.dataset.cf;
    $$("#core-filters .chip").forEach(x=>x.classList.toggle("on",x.dataset.cf===coreFilter));
    drawList();
  });
  const input=$("#core-search");
  input.oninput=e=>{coreSearch=e.target.value; drawList();};
  drawList();
}

/* View an already-selected CORE bonus (opened from the slot list) — mirrors
   the pattern used for equipped weapons/systems: no back button, just a remove action. */
function viewSelectedCore(ci){
  const c=M.core[state.cores[ci]];
  modal(c.name, coreCardHTML(c) +
    `<button class="ghostbtn warn block mt-16" id="core-remove">✕ Убрать этот CORE-бонус</button>`);
  $("#core-remove").onclick=()=>{ state.cores.splice(ci,1); closeModal(); render(); };
}

/* Detail view for a not-yet-selected bonus, opened by clicking a card in the
   on-page list — mirrors openFrame(): the list itself always stays on the
   page, only the "select this one" step happens in a modal. */
function openCoreDetail(id){
  const c=M.core[id], d=derived();
  const full=state.cores.length>=d.b.core.cap;
  const unl=coreBonusUnlocked(c);
  modal(c.name, coreCardHTML(c) +
    `<button class="ghostbtn ${full?'':(unl?'':'warn')} block mt-16" id="core-select" ${full?"disabled":""}>
      ${full?`⚠ Лимит исчерпан (${state.cores.length}/${d.b.core.cap})`:(unl?"✓ Выбрать этот CORE-бонус":`⚠ Выбрать всё равно (лицензия ${esc(c.source)} не открыта)`)}
    </button>`);
  $("#core-select").onclick=()=>{
    if(full) return;
    state.cores.push(id); closeModal(); render();
  };
}
