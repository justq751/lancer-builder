/* ============ SHEET VIEW ============
   A deck of reference cards. The editor answers "what can I take"; this
   answers "what does the thing I took do", mid-combat, without a single
   control that could change the build. Mechanics only — flavour and
   descriptions stay in the editor, where there is time to read them. */
const shDmg = w => (w.damage||[]).map(x=>`${x.val} ${trTag(x.type)}`).join(" + ");
const shRng = w => (w.range||[]).map(x=>`${tr(x.type)} ${x.val}`).join(" · ");
const shTags = tags => (tags||[]).length
  ? `<div class="row">${tags.map(t=>`<span class="tag">${esc(trTag(t))}</span>`).join("")}</div>` : "";
function shEff(label, html){
  return html ? `<div class="eff"><b>${label}</b>${rich(html)}</div>` : "";
}
function shKey(k, v){ return `<span class="keystat"><span class="k">${k}</span>${esc(String(v))}</span>`; }

/* Every rule the build breaks. The app already knows all of this — tabWarn(),
   unlocked() and talentRankCap() have known it for eight tabs — the sheet is
   simply where it finally gets said out loud. */
function buildViolations(){
  const d=derived(), out=[];
  const over=(b,label)=>{ if(b.used>b.cap) out.push(`${label}: ${(+b.used.toFixed(1))} из ${b.cap}`); };
  over(d.b.skill,"Перебор навыков");
  over(d.b.talent,"Перебор талантов");
  over(d.b.hase,"Перебор мех-навыков");
  over(d.b.license,"Перебор лицензий");
  if(d.b.core.cap>0 && state.cores.length>d.b.core.cap)
    out.push(`Перебор CORE-бонусов: ${state.cores.length} из ${d.b.core.cap}`);
  if(d.mech && d.sp.used>d.sp.cap)
    out.push(`Перебор системных очков: ${d.sp.used} из ${d.sp.cap} SP`);
  const cap=talentRankCap(d.ll);
  Object.entries(state.talents).forEach(([id,v])=>{
    if(v>cap && M.talent[id]) out.push(`${M.talent[id].name}: ранг ${["I","II","III"][v-1]} выше доступного на LL${d.ll}`);
  });
  if(d.frame && !frameUnlocked(d.frame)) out.push(`Шасси ${dispName(d.frame)} — лицензия не открыта`);
  (state.mech.mounts||[]).forEach(mt=>(mt.items||[]).forEach(s=>{
    const w=M.weapon[s.id];
    if(w && !unlocked(w)) out.push(`${w.name} — лицензия не открыта`);
    const md=s.mod&&M.mod[s.mod];
    if(md && !unlocked(md)) out.push(`${md.name} — лицензия не открыта`);
  }));
  (state.mech.systems||[]).forEach(id=>{
    const sy=M.system[id];
    if(sy && !unlocked(sy)) out.push(`${sy.name} — лицензия не открыта`);
  });
  return out;
}

const SHEET_STATS=["hp","armor","evasion","edef","heatcap","speed","size","save","sensor_range","tech_attack","repcap"];
function statStripHTML(d){
  const cells=SHEET_STATS.map(k=>{
    const base=d.frame&&d.frame.stats?d.frame.stats[k]:null;
    const up = base!=null && d.mech[k]!==base;
    return `<div class="cell ${up?"up":""}"><span class="k">${esc(L.stat_labels?.[k]||STAT_RU[k][0])}</span>
      <span class="v">${esc(String(d.mech[k]))}</span></div>`;
  }).join("");
  const sp=`<div class="cell"><span class="k">SP</span><span class="v">${d.sp.used}/${d.sp.cap}</span></div>`;
  return `<div class="statstrip">${cells}${sp}</div>`;
}

/* A profile action — currently one in the whole dataset (Storm Stance's
   reaction), but its effect line is meaningless without it: "you gain the
   Storm Stance Reaction" and then no reaction anywhere. */
function profActionHTML(a){
  // trTag handles the "N/Round" shape, so frequency needs no per-item locale
  // work — but the data writes "1/round" while the dictionary is keyed
  // "Round", so the word is capitalised before the lookup.
  const freq = a.frequency
    ? trTag(String(a.frequency).replace(/\/(\w)/, (m, c) => "/" + c.toUpperCase()))
    : "";
  const head=[tr(a.activation||""), freq].filter(Boolean).join(" · ").toUpperCase();
  return `<div class="eff"><b>${esc(head)}${a.name?" — "+esc(a.name):""}</b>
    ${a.trigger?`<span class="trig">Триггер: ${rich(a.trigger)}</span>`:""}${rich(a.detail||"")}</div>`;
}
/* Multi-stage weapons — stances, charge levels, firing modes — carry their
   real numbers per profile, not on the weapon. The editor shows one at a time
   behind a toggle, which is right for browsing and wrong here: paper has no
   toggle, and a player mid-turn needs to compare stances, not click through
   them. Every mode is laid out at once, each with its own damage, range,
   tags and rules. */
function profilesHTML(w){
  const profs=w.profiles||[];
  if(!profs.length) return "";
  return `<div class="profs">
    <div class="profs-hd">РЕЖИМЫ · ${profs.length}</div>
    ${profs.map(p=>`<div class="prof">
      <div class="prof-hd">
        <span class="pname">${esc(p.name)}</span>
        ${(p.damage&&p.damage.length)?shKey("УРОН",profDmgStr(p)):""}
        ${(p.range&&p.range.length)?shKey("ДИСТ",profRngStr(p)):""}
      </div>
      ${shTags(p.tags)}
      ${p.effect?`<div class="eff">${rich(p.effect)}</div>`:""}
      ${(p.actions||[]).map(profActionHTML).join("")}
      ${p.on_attack?shEff("ПРИ АТАКЕ", onHitText(p.on_attack)):""}
      ${p.on_hit?shEff("ПРИ ПОПАДАНИИ", onHitText(p.on_hit)):""}
      ${p.on_crit?shEff("ПРИ КРИТЕ", onHitText(p.on_crit)):""}
    </div>`).join("")}
  </div>`;
}
/* Sheet-deck card, NOT the editor's picker card. These used to both be called
   weaponCardHTML/systemCardHTML; the later declaration silently won, so the
   picker's "separate card" mode rendered a .dcard, wireTagGlossary found no
   #wp-tagdesc to write into and threw — which killed the very next lines,
   the ones wiring "← Назад к списку" and "Установить". The card opened and
   the modal became a dead end. Keep these two families named apart. */
function deckWeaponCardHTML(w, mountType, mod){
  const eff=effectiveWeapon(w, mod);
  const hasProfs=!!(w.profiles&&w.profiles.length);
  const lk=!unlocked(w);
  // With profiles, damage and range belong to the modes, not to the weapon:
  // printing one profile's numbers in the header states them as the weapon's
  // own and is simply false. The header keeps what is genuinely shared.
  // Three or more modes is several cards' worth of content in one card; at a
  // single column width it becomes a tower nobody scans. It earns two.
  const wide=(w.profiles||[]).length>=3 ? " wide" : "";
  const dmg=hasProfs?"":shDmg(eff), rng=hasProfs?"":shRng(eff);
  const modDmg=hasProfs&&mod&&(mod.added_damage||[]).length ? shDmg({damage:mod.added_damage}) : "";
  const modRng=hasProfs&&mod&&(mod.added_range||[]).length ? shRng({range:mod.added_range}) : "";
  return `<article class="dcard${wide} ${lk?"void":""}">
    <div class="src" style="background:${srcColor(w.source)}"></div>
    <div class="hd">
      <span class="nm">${esc(w.name)}</span>
      <span class="slot">${esc(tr(mountType))}${lk?" · 🔒":""}</span>
    </div>
    <div class="keyline">
      ${dmg?shKey("УРОН",dmg):""}
      ${rng?shKey("ДИСТ",rng):""}
      ${modDmg?shKey("ОТ МОДА",'+'+modDmg):""}
      ${modRng?shKey("ОТ МОДА",'+'+modRng):""}
      ${w.sp?shKey("SP",w.sp):""}
    </div>
    <div class="slot">${esc(tr(w.mount))} · ${esc(tr(w.type))}</div>
    ${shTags(hasProfs?(eff.tags||[]):weaponDisplayTags(eff,0))}
    ${shEff("ЭФФЕКТ", w.effect)}
    ${shEff("ПРИ АТАКЕ", w.on_attack)}
    ${shEff("ПРИ ПОПАДАНИИ", w.on_hit)}
    ${shEff("ПРИ КРИТЕ", w.on_crit)}
    ${profilesHTML(w)}
    ${mod?`<div class="sub">
      <div class="hd"><span class="nm" style="font-size:16.5px">+ ${esc(mod.name)}</span>
        <span class="slot">МОД${mod.sp?" · SP "+mod.sp:""}</span></div>
      ${shEff("ЭФФЕКТ", mod.effect)}</div>`:""}
  </article>`;
}
function deckSystemCardHTML(sy){
  const lk=!unlocked(sy);
  return `<article class="dcard ${lk?"void":""}">
    <div class="src" style="background:${srcColor(sy.source)}"></div>
    <div class="hd">
      <span class="nm">${esc(sy.name)}</span>
      <span class="slot">${esc(tr(sy.type||"System"))}${lk?" · 🔒":""}</span>
    </div>
    <div class="keyline">${sy.sp?shKey("SP",sy.sp):""}</div>
    ${shTags(sy.tags)}
    ${shEff("ЭФФЕКТ", sy.effect)}
  </article>`;
}
function coreSystemCardHTML(frame){
  const cs=frame.core_system; if(!cs) return "";
  return `<article class="dcard">
    <div class="src" style="background:${srcColor(frame.source)}"></div>
    <div class="hd"><span class="nm">${esc(cs.name)}</span><span class="slot">CORE-СИСТЕМА</span></div>
    ${shTags(cs.tags)}
    ${cs.passive_name?`<div class="eff"><b>ПАССИВНО — ${esc(cs.passive_name)}</b>${rich(cs.passive_effect)}</div>`:""}
    ${cs.active_name?`<div class="eff"><b>АКТИВНО — ${esc(cs.active_name)}</b>${rich(cs.active_effect)}</div>`:""}
    ${(!cs.active_name&&cs.effect)?shEff("ЭФФЕКТ",cs.effect):""}
  </article>`;
}
function talentCardHTML(id, rank){
  const t=M.talent[id]; if(!t) return "";
  const ranks=(t.ranks||[]).slice(0,rank);
  return `<article class="dcard">
    <div class="src" style="background:var(--accent)"></div>
    <div class="hd"><span class="nm">${esc(t.name)}</span>
      <span class="slot">РАНГ ${["I","II","III"][rank-1]||rank}</span></div>
    ${ranks.map((r,i)=>`<div class="eff"><b>${["I","II","III"][i]} — ${esc(r.name)}</b>${rich(r.description)}</div>`).join("")}
  </article>`;
}
function coreBonusCardHTML(id){
  const cb=M.core[id]; if(!cb) return "";
  return `<article class="dcard">
    <div class="src" style="background:${srcColor(cb.source)}"></div>
    <div class="hd"><span class="nm">${esc(cb.name)}</span><span class="slot">CORE-БОНУС</span></div>
    ${shEff("ЭФФЕКТ", cb.effect)}
    ${shEff("НА КРЕПЛЕНИИ", cb.mounted_effect)}
  </article>`;
}
function gearCardHTML(id){
  const g=M.gear[id]; if(!g) return "";
  const stats=(g.bonuses||[]).map(b=>shKey(esc(String(b.id).replace("pilot_","").toUpperCase()), b.val)).join("");
  return `<article class="dcard">
    <div class="src" style="background:${srcColor(g.source||"GMS")}"></div>
    <div class="hd"><span class="nm">${esc(g.name)}</span><span class="slot">${esc(tr(g.type||""))}</span></div>
    <div class="keyline">${stats}${g.damage&&g.damage.length?shKey("УРОН",shDmg(g)):""}${g.range&&g.range.length?shKey("ДИСТ",shRng(g)):""}</div>
    ${shTags(g.tags)}
    ${shEff("ЭФФЕКТ", g.effect)}
  </article>`;
}
function deckSection(title, cards){
  const list=cards.filter(Boolean);
  if(!list.length) return "";
  return `<section class="decksec">
    <h2>${title}<span class="n">${list.length}</span></h2>
    <div class="deck">${list.join("")}</div>
  </section>`;
}

function renderSheet(){
  const d=derived(), p=state.pilot;
  const viol=buildViolations();
  const bg=p.background&&M.bg[p.background];

  const skillLines=Object.entries(state.skills).map(([id,v])=>{
    const s=skillInfo(id); return s?`${esc(s.name)} +${v}`:null;
  }).filter(Boolean);

  // Pilot data used to arrive as a separate Arial block after the deck, which
  // on paper read as a different document stapled to the sheet. It belongs
  // here: the dossier states who the pilot is, then what they are piloting.
  // Mech-skills print even at zero — on a paper sheet those are fields you
  // track between missions, not facts you only mention when non-empty.
  const pilotStrip=`<div class="statstrip pilot">
    ${HASE.map(h=>`<div class="cell ${state.hase[h.k]?"up":""}">
      <span class="k">${esc(h.ru)}</span><span class="v">${state.hase[h.k]}</span></div>`).join("")}
  </div>`;

  const head=`
    ${sheetSource==="shared"?`<div class="foreign">// ЧУЖАЯ СБОРКА — открыта по ссылке и не сохраняется в этом браузере</div>`:""}
    <div class="dossier">
      <h1 class="dossier-id">
        <span class="cs">${esc(p.callsign||"БЕЗЫМЯННЫЙ")}</span>
        <span class="nm">${esc(p.name||"имя не задано")}${bg?" · "+esc(bg.name):""}</span>
        <span class="ll">LL${d.ll} · GRIT +${d.grit}</span>
      </h1>
      ${pilotStrip}
      ${skillLines.length?`<div class="dossier-line"><span class="k">ТРИГГЕРЫ</span>${skillLines.join(" · ")}</div>`:""}
      ${d.frame?`<div class="dossier-frame">ШАССИ <b>${esc(dispName(d.frame))}</b> · ${esc(SRC_NAME[d.frame.source]||d.frame.source)} · ${d.frame.mechtype.map(tr).join(" / ")}</div>
        ${statStripHTML(d)}`:`<div class="dossier-frame">ШАССИ НЕ ВЫБРАНО</div>`}
      <div class="stamp ${viol.length?"dev":""}">
        <span>${viol.length?"⚠":"✓"}</span>
        <div class="body">${viol.length?`ДОПУСК: С ОТКЛОНЕНИЯМИ (${viol.length})
          <ul>${viol.map(v=>`<li>${esc(v)}</li>`).join("")}</ul>`:"ДОПУСК ПОДТВЕРЖДЁН — сборка в пределах правил"}</div>
      </div>
    </div>`;

  const weaponCards=[];
  (state.mech.mounts||[]).forEach(mt=>(mt.items||[]).forEach(s=>{
    const w=M.weapon[s.id];
    if(w) weaponCards.push(deckWeaponCardHTML(w, mt.type, s.mod?M.mod[s.mod]:null));
  }));

  const body = (!d.frame && !skillLines.length && !HASE.some(h=>state.hase[h.k]) && !state.gear.armor)
    ? `<div class="sheet-empty">// СБОРКА ПУСТА<br>вернитесь в редактор и начните с уровня лицензии</div>`
    : deckSection("ВООРУЖЕНИЕ", weaponCards)
      + deckSection("СИСТЕМЫ", (state.mech.systems||[]).map(id=>M.system[id]?deckSystemCardHTML(M.system[id]):null))
      + deckSection("CORE", [d.frame?coreSystemCardHTML(d.frame):null, ...state.cores.map(coreBonusCardHTML)])
      + deckSection("ТАЛАНТЫ", Object.entries(state.talents).map(([id,v])=>talentCardHTML(id,v)))
      + deckSection("СНАРЯЖЕНИЕ ПИЛОТА", [state.gear.armor, ...state.gear.weapons, ...state.gear.gear].map(gearCardHTML));

  $("#sheet").innerHTML = head + body;
}

/* ---- share link (codec: packBuild/encodeShare… in js/core/share.js) ---- */
async function shareSheetLink(){
  try{
    const payload=await encodeShare();
    const url=`${location.origin}${location.pathname}?s=${payload}`;
    let copied=false;
    try{ await navigator.clipboard.writeText(url); copied=true; }catch(e){ copied=false; }
    notice("Ссылка на лист",
      copied ? "Ссылка скопирована. Открывший её увидит только лист — его собственная сборка не пострадает."
             : "Скопируйте ссылку вручную. Открывший её увидит только лист — его собственная сборка не пострадает.",
      [url], "plain");
  }catch(e){
    console.error(e);
    notice("Ссылку собрать не удалось", "Не получилось упаковать сборку в адрес. Выгрузите её файлом кнопкой <b>⬇ СОХРАНИТЬ</b>.");
  }
}
/* Reads ?s=… once at startup. A shared build is read-only by construction:
   sheetSource stays "shared", which is what stops saveBuildNow() from
   overwriting the reader's own work. */
async function consumeShareLink(){
  const m=/[?&]s=([^&]+)/.exec(location.search);
  if(!m) return null;
  history.replaceState(null, "", location.pathname);
  try{
    const raw=await decodeShare(decodeURIComponent(m[1]));
    const built=unpackBuild(raw);
    if(!built) throw new Error("пустая сборка");
    const dropped=applyBuildState(built);
    sheetSource="shared";
    viewMode="sheet";
    return {dropped};
  }catch(e){
    console.error("[Lancer Registry] ссылка не прочитана:", e);
    return {failed:true};
  }
}
function setViewMode(mode){
  viewMode = mode==="sheet" ? "sheet" : "build";
  if(sheetSource!=="shared"){
    try{ localStorage.setItem("view_mode", viewMode); }catch(e){}
  }
  window.scrollTo({top:0});
  render();
}
/* Leaving a shared sheet is not "switching tabs": the build on screen was
   never the reader's. Dropping it and restoring their own autosave is the
   only exit that cannot lose someone's work. */
function exitSheet(){
  if(sheetSource==="shared"){
    sheetSource="own";
    Object.assign(state, defaultState());
    const saved=loadSavedBuild();
    if(saved){
      holdSaveIfIncomplete(applyBuildState(saved.state));
      lastSaveAt = saved.savedAt ? new Date(saved.savedAt) : null;
      if(isNaN(lastSaveAt)) lastSaveAt=null;
    }
    renderSaveState();
  }
  setViewMode("build");
}
function syncModeChrome(){
  const sheet=viewMode==="sheet";
  const foreign=sheetSource==="shared";
  document.body.classList.toggle("sheetmode", sheet);
  $("#sheet").hidden=!sheet;
  $("#t-sheet").textContent = sheet ? (foreign?"◀ МОЯ СБОРКА":"◀ РЕДАКТОР") : "▤ ЛИСТ";
  $("#t-link").hidden=!sheet;
  $("#t-print").hidden=!sheet;
  // Nothing that changes the build belongs beside a read-only sheet. Export
  // stays: writing the file out is how a GM keeps someone else's build.
  ["#t-import","#t-reset"].forEach(sel=>{ $(sel).hidden=sheet; });
}
