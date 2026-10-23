/* ============ SHEET VIEW ============
   A deck of reference cards. The editor answers "what can I take"; this
   answers "what does the thing I took do", mid-combat, without a single
   control that could change the build. Mechanics only — flavour and
   descriptions stay in the editor, where there is time to read them. */
const shDmg = w => (w.damage||[]).map(x=>`${x.val} ${trTag(x.type)}`).join(" + ");
const shRng = w => (w.range||[]).map(x=>`${tr(x.type)} ${x.val}`).join(" · ");
const shTags = tags => (tags||[]).length
  ? `<div class="row">${tags.map(tg=>`<span class="tag">${esc(trTag(tg))}</span>`).join("")}</div>` : "";
function shEff(label, html){
  return html ? `<div class="eff"><b>${label}</b>${rich(html)}</div>` : "";
}
function shKey(k, v){ return `<span class="keystat"><span class="k">${k}</span>${esc(String(v))}</span>`; }

/* Every rule the build breaks. The app already knows all of this — tabWarn(),
   unlocked() and talentRankCap() have known it for eight tabs — the sheet is
   simply where it finally gets said out loud. */
function buildViolations(){
  const d=derived(), out=[];
  // Plain text (tText): the list esc()es each line itself.
  const over=(b,label)=>{ if(b.used>b.cap) out.push(tText("viol.over", {label, used:+b.used.toFixed(1), cap:b.cap})); };
  over(d.b.skill,tText("viol.skills"));
  over(d.b.talent,tText("viol.talents"));
  over(d.b.hase,tText("viol.hase"));
  over(d.b.license,tText("viol.licenses"));
  if(d.b.core.cap>0 && state.cores.length>d.b.core.cap)
    out.push(tText("viol.cores", {n:state.cores.length, cap:d.b.core.cap}));
  if(d.mech && d.sp.used>d.sp.cap)
    out.push(tText("viol.sp", {used:d.sp.used, cap:d.sp.cap}));
  const cap=talentRankCap(d.ll);
  Object.entries(state.talents).forEach(([id,v])=>{
    if(v>cap && M.talent[id]) out.push(tText("viol.talent_rank", {name:M.talent[id].name, rank:["I","II","III"][v-1], ll:d.ll}));
  });
  if(d.frame && !frameUnlocked(d.frame)) out.push(tText("viol.frame_locked", {name:dispName(d.frame)}));
  (state.mech.mounts||[]).forEach(mt=>(mt.items||[]).forEach(s=>{
    const w=M.weapon[s.id];
    if(w && !unlocked(w)) out.push(tText("viol.item_locked", {name:w.name}));
    const md=s.mod&&M.mod[s.mod];
    if(md && !unlocked(md)) out.push(tText("viol.item_locked", {name:md.name}));
  }));
  (state.mech.systems||[]).forEach(id=>{
    const sy=M.system[id];
    if(sy && !unlocked(sy)) out.push(tText("viol.item_locked", {name:sy.name}));
  });
  superheavyMissingExtra(state.mech.mounts||[]).forEach(({mi,wi})=>
    out.push(tText("viol.superheavy_extra", {name:M.weapon[state.mech.mounts[mi].items[wi].id].name})));
  if(d.frame && state.cores.includes(MOUNT_RETROFIT_CB) && !(state.mech.mounts||[]).some(mt=>mt.retro))
    out.push(tText("viol.retro_pending", {name:M.core[MOUNT_RETROFIT_CB]?.name||""}));
  state.cores.forEach(id=>{
    const c=M.core[id];
    if(c && !coreBonusUnlocked(c))
      out.push(tText("viol.core_locked", {name:c.name, need:coreBonusRanksNeeded(c), source:c.source, rank:manufacturerRank(c.source)}));
  });
  return out;
}

const SHEET_STATS=["hp","armor","evasion","edef","heatcap","speed","size","save","sensor_range","tech_attack","repcap"];
function statStripHTML(d){
  const cells=SHEET_STATS.map(k=>{
    const base=d.frame&&d.frame.stats?d.frame.stats[k]:null;
    const up = base!=null && d.mech[k]!==base;
    return `<div class="cell ${up?"up":""}"><span class="k">${esc(L.stat_labels?.[k]||statShort(k))}</span>
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
    ${a.trigger?`<span class="trig">${t("sheet.trigger", {triggerHtml:rich(a.trigger)})}</span>`:""}${rich(a.detail||"")}</div>`;
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
    <div class="profs-hd">${t("sheet.modes", {n:profs.length})}</div>
    ${profs.map(p=>`<div class="prof">
      <div class="prof-hd">
        <span class="pname">${esc(p.name)}</span>
        ${(p.damage&&p.damage.length)?shKey(t("sheet.dmg"),profDmgStr(p)):""}
        ${(p.range&&p.range.length)?shKey(t("sheet.rng"),profRngStr(p)):""}
      </div>
      ${shTags(p.tags)}
      ${p.effect?`<div class="eff">${rich(p.effect)}</div>`:""}
      ${(p.actions||[]).map(profActionHTML).join("")}
      ${p.on_attack?shEff(t("sheet.on_attack"), onHitText(p.on_attack)):""}
      ${p.on_hit?shEff(t("sheet.on_hit"), onHitText(p.on_hit)):""}
      ${p.on_crit?shEff(t("sheet.on_crit"), onHitText(p.on_crit)):""}
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
      ${dmg?shKey(t("sheet.dmg"),dmg):""}
      ${rng?shKey(t("sheet.rng"),rng):""}
      ${modDmg?shKey(t("sheet.from_mod"),'+'+modDmg):""}
      ${modRng?shKey(t("sheet.from_mod"),'+'+modRng):""}
      ${w.sp?shKey("SP",w.sp):""}
    </div>
    <div class="slot">${esc(tr(w.mount))} · ${esc(tr(w.type))}</div>
    ${shTags(hasProfs?(eff.tags||[]):weaponDisplayTags(eff,0))}
    ${shEff(t("sheet.effect"), w.effect)}
    ${shEff(t("sheet.on_attack"), w.on_attack)}
    ${shEff(t("sheet.on_hit"), w.on_hit)}
    ${shEff(t("sheet.on_crit"), w.on_crit)}
    ${profilesHTML(w)}
    ${mod?`<div class="sub">
      <div class="hd"><span class="nm" style="font-size:16.5px">+ ${esc(mod.name)}</span>
        <span class="slot">${t("sheet.mod")}${mod.sp?" · SP "+mod.sp:""}</span></div>
      ${shEff(t("sheet.effect"), mod.effect)}</div>`:""}
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
    ${shEff(t("sheet.effect"), sy.effect)}
  </article>`;
}
function coreSystemCardHTML(frame){
  const cs=frame.core_system; if(!cs) return "";
  return `<article class="dcard">
    <div class="src" style="background:${srcColor(frame.source)}"></div>
    <div class="hd"><span class="nm">${esc(cs.name)}</span><span class="slot">${t("sheet.core_system")}</span></div>
    ${shTags(cs.tags)}
    ${cs.passive_name?`<div class="eff"><b>${t("sheet.passive", {name:cs.passive_name})}</b>${rich(cs.passive_effect)}</div>`:""}
    ${cs.active_name?`<div class="eff"><b>${t("sheet.active", {name:cs.active_name})}</b>${rich(cs.active_effect)}</div>`:""}
    ${(!cs.active_name&&cs.effect)?shEff(t("sheet.effect"),cs.effect):""}
  </article>`;
}
function talentCardHTML(id, rank){
  const tal=M.talent[id]; if(!tal) return "";
  const ranks=(tal.ranks||[]).slice(0,rank);
  return `<article class="dcard">
    <div class="src" style="background:var(--accent)"></div>
    <div class="hd"><span class="nm">${esc(tal.name)}</span>
      <span class="slot">${t("sheet.rank", {rank:["I","II","III"][rank-1]||rank})}</span></div>
    ${ranks.map((r,i)=>`<div class="eff"><b>${["I","II","III"][i]} — ${esc(r.name)}</b>${rich(r.description)}</div>`).join("")}
  </article>`;
}
function coreBonusCardHTML(id){
  const cb=M.core[id]; if(!cb) return "";
  return `<article class="dcard">
    <div class="src" style="background:${srcColor(cb.source)}"></div>
    <div class="hd"><span class="nm">${esc(cb.name)}</span><span class="slot">${t("sheet.core_bonus")}</span></div>
    ${shEff(t("sheet.effect"), cb.effect)}
    ${shEff(t("sheet.mounted"), cb.mounted_effect)}
  </article>`;
}
function gearCardHTML(id){
  const g=M.gear[id]; if(!g) return "";
  const stats=(g.bonuses||[]).map(b=>shKey(esc(String(b.id).replace("pilot_","").toUpperCase()), b.val)).join("");
  return `<article class="dcard">
    <div class="src" style="background:${srcColor(g.source||"GMS")}"></div>
    <div class="hd"><span class="nm">${esc(g.name)}</span><span class="slot">${esc(tr(g.type||""))}</span></div>
    <div class="keyline">${stats}${g.damage&&g.damage.length?shKey(t("sheet.dmg"),shDmg(g)):""}${g.range&&g.range.length?shKey(t("sheet.rng"),shRng(g)):""}</div>
    ${shTags(g.tags)}
    ${shEff(t("sheet.effect"), g.effect)}
  </article>`;
}
function deckSection(id, title, cards){
  const list=cards.filter(Boolean);
  if(!list.length) return null;
  return { id, title, n:list.length, html:`<section class="decksec" id="sh-${id}">
    <h2>${title}<span class="n">${list.length}</span></h2>
    <div class="deck">${list.join("")}</div>
  </section>` };
}

/* The dossier used to be sticky: 47% of a 1440×900 screen and ~57% of a
   1280×720 one, leaving ~250px for the cards it was meant to accompany. Now it
   scrolls away and this one line stays instead — the numbers a player glances
   back at mid-fight, and the deck's sections as jump links (on a phone the
   sheet is 6600px long; the links are its table of contents). The stats only
   appear once the dossier has left the screen, so they never sit twice in
   view. */
const SHEETBAR_STATS=["hp","armor","evasion","edef","heatcap","speed"];
function sheetBarHTML(d, p, sections){
  const stats = d.mech ? SHEETBAR_STATS.map(k=>
    `<span class="sb-stat"><span class="k">${esc(statShort(k))}</span><span class="v">${esc(String(d.mech[k]))}</span></span>`).join("") : "";
  return `<nav class="sheetbar" aria-label="${t("sheet.nav")}">
    <div class="sb-id" aria-hidden="true"><span class="cs">${esc(p.callsign||tText("hud.no_callsign"))}</span>${stats}</div>
    <div class="sb-nav">${sections.map(s=>`<a href="#sh-${s.id}">${s.title}<span class="n">${s.n}</span></a>`).join("")}</div>
  </nav>`;
}
let sheetBarObserver=null;
function watchSheetBar(){
  if(sheetBarObserver) sheetBarObserver.disconnect();
  const dossier=$("#sheet .dossier"), bar=$("#sheet .sheetbar");
  if(!bar) return;
  // Jump without writing #sh-… into the address bar: that URL is the one
  // «ССЫЛКА» and the browser's own share button hand out.
  bar.querySelectorAll("a").forEach(a=>a.onclick=e=>{
    e.preventDefault();
    const sec=document.getElementById(a.hash.slice(1)); if(!sec) return;
    sec.scrollIntoView({block:"start"});
    sec.setAttribute("tabindex","-1"); sec.focus({preventScroll:true});
  });
  if(!dossier || !("IntersectionObserver" in window)) return;
  sheetBarObserver=new IntersectionObserver(([e])=>bar.classList.toggle("stuck", !e.isIntersecting));
  sheetBarObserver.observe(dossier);
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
      <span class="k">${esc(haseLabel(h.k,"name"))}</span><span class="v">${state.hase[h.k]}</span></div>`).join("")}
  </div>`;

  const head=`
    ${sheetSource==="shared"?`<div class="foreign">${t("sheet.foreign")}</div>`:""}
    <div class="dossier">
      <h1 class="dossier-id">
        <span class="cs">${esc(p.callsign||tText("hud.no_callsign"))}</span>
        <span class="nm">${esc(p.name||tText("hud.no_name"))}${bg?" · "+esc(bg.name):""}</span>
        <span class="ll">LL${d.ll} · GRIT +${d.grit}</span>
      </h1>
      ${pilotStrip}
      ${skillLines.length?`<div class="dossier-line"><span class="k">${t("sheet.triggers")}</span>${skillLines.join(" · ")}</div>`:""}
      ${d.frame?`<div class="dossier-frame">${t("sheet.frame_line", {name:dispName(d.frame), source:SRC_NAME[d.frame.source]||d.frame.source, types:d.frame.mechtype.map(tr).join(" / ")})}</div>
        ${statStripHTML(d)}`:`<div class="dossier-frame">${t("sheet.no_frame")}</div>`}
      <div class="stamp ${viol.length?"dev":""}">
        <span>${viol.length?"⚠":"✓"}</span>
        <div class="body">${viol.length?`${t("sheet.deviations", {n:viol.length})}
          <ul>${viol.map(v=>`<li>${esc(v)}</li>`).join("")}</ul>`:t("sheet.cleared")}</div>
      </div>
    </div>`;

  const weaponCards=[];
  (state.mech.mounts||[]).forEach(mt=>(mt.items||[]).forEach(s=>{
    const w=M.weapon[s.id];
    if(w) weaponCards.push(deckWeaponCardHTML(w, mt.type, s.mod?M.mod[s.mod]:null));
  }));

  const empty = !d.frame && !skillLines.length && !HASE.some(h=>state.hase[h.k]) && !state.gear.armor;
  const sections = empty ? [] : [
    deckSection("weapons", t("sheet.sec.weapons"), weaponCards),
    deckSection("systems", t("sheet.sec.systems"), (state.mech.systems||[]).map(id=>M.system[id]?deckSystemCardHTML(M.system[id]):null)),
    deckSection("core", "CORE", [d.frame?coreSystemCardHTML(d.frame):null, ...state.cores.map(coreBonusCardHTML)]),
    deckSection("talents", t("sheet.sec.talents"), Object.entries(state.talents).map(([id,v])=>talentCardHTML(id,v))),
    deckSection("gear", t("sheet.sec.gear"), [state.gear.armor, ...state.gear.weapons, ...state.gear.gear].map(gearCardHTML)),
  ].filter(Boolean);
  const body = empty
    ? `<div class="sheet-empty">${t("sheet.empty")}</div>`
    : (sections.length ? sheetBarHTML(d, p, sections) : "") + sections.map(s=>s.html).join("");

  $("#sheet").innerHTML = head + body;
  watchSheetBar();
}

/* ---- share link (codec: packBuild/encodeShare… in js/core/share.js) ---- */
async function shareSheetLink(){
  try{
    const payload=await encodeShare();
    const url=`${location.origin}${location.pathname}?s=${payload}`;
    let copied=false;
    try{ await navigator.clipboard.writeText(url); copied=true; }catch(e){ copied=false; }
    notice(tText("sheet.link.title"),
      t(copied ? "sheet.link.copied" : "sheet.link.manual"), // i18n-dynamic: sheet.link.copied, sheet.link.manual
      [url], "plain");
  }catch(e){
    console.error(e);
    notice(tText("sheet.link.failed_title"), t("sheet.link.failed_lead"));
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
    if(!built) throw new Error("empty build");
    const dropped=applyBuildState(built);
    sheetSource="shared";
    viewMode="sheet";
    return {dropped};
  }catch(e){
    console.error("[Lancer Registry] could not read the link:", e);
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
  // i18n-dynamic: topbar.my_build, topbar.editor
  $("#t-sheet").textContent = sheet ? "◀ "+t(foreign?"topbar.my_build":"topbar.editor") : "▤ "+t("topbar.sheet");
  $("#t-link").hidden=!sheet;
  $("#t-print").hidden=!sheet;
  // Nothing that changes the build belongs beside a read-only sheet. Export
  // stays: writing the file out is how a GM keeps someone else's build.
  ["#t-import","#t-reset"].forEach(sel=>{ $(sel).hidden=sheet; });
}
