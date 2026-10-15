/* ---------------- RENDER ROOT ---------------- */
/* Every state mutation in this file ends here, which makes render() the one
   honest place to persist from — no mutation site can forget to. */
function render(){
  const restoreFocus=keepFocusAcrossRender();
  syncModeChrome();
  if(viewMode==="sheet") renderSheet();
  else { renderHUD(); renderTab(); renderTabBar(); }
  scheduleSave();
  restoreFocus();
}

function setState(fn){ fn(); render(); }

/* ============ HUD ============ */
function bar(b,label){
  const over=b.used>b.cap;
  const pct=Math.min(100,b.cap?b.used/b.cap*100:0);
  return `<div class="brow">
    <span class="nm">${label}</span>
    <span class="val ${over?'over':''}">${(+b.used.toFixed(1))} / ${b.cap}</span>
    <span class="bar"><i class="${over?'over':''}" style="width:${pct}%"></i></span>
  </div>`;
}
function renderHUD(){
  const d=derived(); const p=state.pilot;
  // Every number carries its key. An icon-only tile needs a hover to be read,
  // and half this product's audience is on a phone, where hover does not
  // exist. `hl` marks a stat the build actually changed — teal has to answer
  // "what is happening here", not decorate three fixed keys.
  const stats = d.mech ? `
    <div class="statgrid">
      ${["hp","evasion","edef","heatcap","speed","armor","sensor_range","tech_attack","save","repcap","size","sp"].map(k=>{
        const base = d.frame && d.frame.stats ? d.frame.stats[k] : null;
        const hl = base!=null && d.mech[k]!==base ? "hl" : "";
        return `<div class="stattile compact ${hl}">${statIconHTML(k,"lg")}
          <span class="col"><span class="k">${esc(L.stat_labels?.[k]||STAT_RU[k][0])}</span>
          <span class="v">${d.mech[k]}</span></span></div>`;
      }).join("")}
    </div>`
    : `<div class="nomech">// ШАССИ НЕ ВЫБРАНО<br>откройте вкладку ШАССИ</div>`;

  // Narrow screens only (the sheet's header): the sheet covers the dock, so
  // it carries its own way out besides Esc and a tap outside.
  $("#hud").innerHTML = `
  <div class="hudsheet-hd">
    <button class="toolbtn" popovertarget="hud" popovertargetaction="hide">✕ ЗАКРЫТЬ</button>
  </div>
  <div class="card">
    <div class="head"><span class="lbl"><b>//</b> РЕЕСТР ПИЛОТА</span></div>
    <div class="body">
      <div class="pid">${esc(p.callsign||"БЕЗЫМЯННЫЙ")}
        <small>${esc(p.name||"имя не задано")}${p.background?" · "+esc(M.bg[p.background]?.name||""):""}</small></div>
      <div class="ll">
        <span class="big">LL${d.ll}</span>
        <span class="meta">GRIT +${d.grit}<br>лицензионный уровень</span>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="head"><span class="lbl"><b>//</b> БЮДЖЕТ ПОСТРОЕНИЯ</span></div>
    <div class="body"><div class="budget">
      ${bar(d.b.skill,"НАВЫКИ")}
      ${bar(d.b.talent,"ТАЛАНТЫ")}
      ${bar(d.b.hase,"МЕХ-НАВЫКИ")}
      ${bar(d.b.license,"ЛИЦЕНЗИИ")}
      ${bar(d.b.core,"CORE-БОНУСЫ")}
      ${d.mech ? bar(d.sp,"СИСТ. ОЧКИ (SP)") : ""}
    </div></div>
  </div>
  <div class="card">
    <div class="head"><span class="lbl"><b>//</b> СВОДКА МЕХА</span>
      ${d.frame?`<span class="lbl" style="color:${srcColor(d.frame.source)}">${esc(dispName(d.frame))}</span>`:""}</div>
    <div class="body">${stats}</div>
  </div>`;
  renderLedger(d);
}

/* The HUD's budget card folded into one line for the dock (≤1020px) — the
   "legality is visible in place" promise kept on a phone without spending a
   screen on it. Each cell is a budget row in miniature: key, used/cap, a 2px
   fill that turns amber over the cap. The whole line is one button: it opens
   the full HUD as a sheet. */
function renderLedger(d){
  const cell=(k,b,full)=>{
    if(!b) return `<span class="lg none"><span class="k" aria-hidden="true">${k}</span><span class="v" aria-hidden="true">—</span><i></i>
      <span class="sr">${full}: шасси не выбрано</span></span>`;
    const over=b.used>b.cap;
    const pct=Math.min(100,b.cap?b.used/b.cap*100:0);
    const used=+b.used.toFixed(1);
    return `<span class="lg ${over?'over':''}"><span class="k" aria-hidden="true">${k}</span>
      <span class="v" aria-hidden="true">${used}/${b.cap}</span><i style="width:${pct}%"></i>
      <span class="sr">${full}: ${used} из ${b.cap}${over?", перебор":""}.</span></span>`;
  };
  $("#ledger").innerHTML = `
    <span class="lg ll"><span class="k" aria-hidden="true">LL</span><span class="v" aria-hidden="true">${d.ll}</span>
      <span class="sr">Лицензионный уровень ${d.ll}.</span></span>
    ${cell("НАВ",d.b.skill,"Навыки")}
    ${cell("ТАЛ",d.b.talent,"Таланты")}
    ${cell("HASE",d.b.hase,"Мех-навыки")}
    ${cell("ЛИЦ",d.b.license,"Лицензии")}
    ${cell("CORE",d.b.core,"CORE-бонусы")}
    ${cell("SP",d.mech?d.sp:null,"Очки систем")}
    <span class="chev" aria-hidden="true"></span>
    <span class="sr">Открыть реестр пилота</span>`;
}

/* ============ TAB BAR ============ */
const TABS=[
  ["pilot","ПИЛОТ"],["skills","НАВЫКИ"],["talents","ТАЛАНТЫ"],["hase","МЕХ-НАВЫКИ"],
  ["licenses","ЛИЦЕНЗИИ"],["frame","ШАССИ"],["loadout","ВООРУЖЕНИЕ"],["core","CORE"],["summary","ИТОГ"]
];
function tabWarn(id){
  const d=derived();
  if(id==="skills")   return d.b.skill.used>d.b.skill.cap;
  if(id==="talents"){
    return d.b.talent.used>d.b.talent.cap ||
      Object.values(state.talents).some(v=>v>talentRankCap(d.ll));
  }
  if(id==="hase")     return d.b.hase.used>d.b.hase.cap;
  if(id==="licenses") return d.b.license.used>d.b.license.cap;
  if(id==="loadout")  return d.mech && d.sp.used>d.sp.cap;
  if(id==="core")     return d.b.core.cap>0 && state.cores.length>d.b.core.cap;
  return false;
}
/* The other half of the dot the CSS always had and the markup never produced:
   teal means "there is budget left here". Levelling up is the moment this
   answers the only question the pilot has — where did my new points go? */
function tabSpare(id){
  const d=derived();
  const spare=b=>b.cap>b.used;
  if(id==="skills")   return spare(d.b.skill);
  if(id==="talents")  return spare(d.b.talent) && Object.values(state.talents).every(v=>v<=talentRankCap(d.ll));
  if(id==="hase")     return spare(d.b.hase);
  if(id==="licenses") return spare(d.b.license);
  if(id==="core")     return d.b.core.cap>state.cores.length;
  return false;
}
function renderTabBar(){
  $("#tabs").innerHTML = TABS.map(([id,nm],i)=>{
    const warn=tabWarn(id);
    const spare=!warn && tabSpare(id);
    const sel=activeTab===id;
    // The dot is never colour alone: it carries a title and an accessible
    // name, because "amber vs teal" is not a distinction a screen reader or
    // a colour-blind player can make.
    const dot = warn ? `<span class="dot warn" title="Перебор бюджета"><span class="sr">перебор бюджета</span></span>`
              : spare ? `<span class="dot" title="Остались нераспределённые очки"><span class="sr">остались очки</span></span>`
              : "";
    return `<button class="tab ${sel?'active':''}" data-tab="${id}" role="tab"
      aria-selected="${sel}" aria-controls="tab" id="tab-btn-${id}" tabindex="${sel?0:-1}">
      <span class="ix mono">${String(i+1).padStart(2,"0")}</span>${nm}
      ${dot}</button>`;
  }).join("");
  const btns=$$("#tabs .tab");
  revealActiveTab();
  // preventScroll: in the dock the tab row is fixed, and letting focus()
  // scroll would fight the scrollTo just above it.
  const activate=b=>{activeTab=b.dataset.tab; render(); window.scrollTo({top:0,behavior:"smooth"}); $(`#tab-btn-${activeTab}`).focus({preventScroll:true});};
  btns.forEach((b,i)=>{
    b.onclick=()=>activate(b);
    b.onkeydown=e=>{
      let ni=null;
      if(e.key==="ArrowRight") ni=(i+1)%btns.length;
      else if(e.key==="ArrowLeft") ni=(i-1+btns.length)%btns.length;
      else if(e.key==="Home") ni=0;
      else if(e.key==="End") ni=btns.length-1;
      if(ni!==null){ e.preventDefault(); activate(btns[ni]); }
    };
  });
}

/* In the dock the tab row is one line that scrolls sideways; the active tab
   must never sit off-screen. Only the row's own scrollLeft moves — never the
   page (scrollIntoView would also scroll the window). A wrapping row has no
   overflow, so this is a no-op on wide screens. */
function revealActiveTab(){
  const row=$("#tabs"), el=$("#tabs .tab.active");
  if(!el || row.scrollWidth<=row.clientWidth) return;
  const pad=24;
  const l=el.getBoundingClientRect().left-row.getBoundingClientRect().left+row.scrollLeft;
  const r=l+el.offsetWidth;
  if(l-pad<row.scrollLeft) row.scrollLeft=Math.max(0,l-pad);
  else if(r+pad>row.scrollLeft+row.clientWidth) row.scrollLeft=r+pad-row.clientWidth;
}

/* ============ TAB ROUTER ============ */
function renderTab(){
  const fn={pilot:renderPilot,skills:renderSkills,talents:renderTalents,hase:renderHase,
    licenses:renderLicenses,frame:renderFrame,loadout:renderLoadout,core:renderCore,summary:renderSummary}[activeTab];
  const tabEl=$("#tab");
  tabEl.setAttribute("aria-labelledby",`tab-btn-${activeTab}`);
  tabEl.innerHTML=""; fn();
}
function sechead(mk,h,p){ return `<div class="sechead"><div class="mk">${mk}</div><h2>${h}</h2><p>${p}</p></div>`; }
