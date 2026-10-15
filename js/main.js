/* ============ TOPBAR WIRING ============ */
function wireTopbar(){
  $("#t-export").onclick=exportBuild;
  $("#t-import").onclick=()=>$("#import-file").click();
  $("#import-file").onchange=e=>{ const f=e.target.files[0]; e.target.value=""; if(f) importBuild(f); };
  $("#t-reset").onclick=()=>{
    if(buildIsEmpty()){
      notice("Сбрасывать нечего", "Сборка и так пуста.");
      return;
    }
    confirmDialog({
      title:"Сброс сборки",
      lead:"Сброс очистит всё и перезапишет автосохранение в этом браузере. Отменить это будет нельзя.",
      losses:buildLossSummary(),
      actions:[
        {label:"⬇ Сначала выгрузить в файл", run:exportBuild},
        {label:"⟲ Сбросить всё", danger:true, run:()=>{
          Object.assign(state, defaultState());
          saveHold=null; // so was clearing it
          activeTab="pilot";
          render();
        }},
      ],
    });
  };
  $("#modal").onclick=e=>{ if(e.target.id==="modal"||e.target.classList.contains("mclose")) closeModal(); };
  $("#t-sheet").onclick=()=>{ if(viewMode==="sheet") exitSheet(); else setViewMode("sheet"); };
  $("#t-link").onclick=shareSheetLink;
  $("#t-print").onclick=()=>window.print();
  wireNarrowChrome();
  wireFocusNet();
  wireCardLinks();
  wireSkipLink();
}

/* Every "open the details of this" card (cardLinkHTML) goes through here —
   one delegated listener instead of an onclick re-bound on each card after
   every render. Ids of equipped items are positions ("mount:slot"). */
const slotPair=k=>k.split(":").map(Number);
const CARD_OPENERS={
  "frame":         id=>openFrame(id),
  "license":       id=>openLicenseDetail(id),
  "core":          id=>openCoreDetail(id),
  "core-selected": i=>viewSelectedCore(+i),
  "weapon":        k=>viewEquippedWeapon(...slotPair(k)),
  "mod":           k=>viewEquippedMod(...slotPair(k)),
  "system":        i=>viewEquippedSystem(+i),
  "gear":          k=>viewPilotGear(k),
};
function wireCardLinks(){
  document.addEventListener("click", e=>{
    const b=e.target.closest(".cardlink[data-open]");
    if(b && CARD_OPENERS[b.dataset.open]) CARD_OPENERS[b.dataset.open](b.dataset.id);
  });
}

/* Skip link: past the header to whatever the page is showing — the tab panel
   in the editor, the sheet in reading mode. Focus moves, the URL does not. */
function wireSkipLink(){
  $("a.skip").onclick=e=>{
    e.preventDefault();
    const target = viewMode==="sheet" ? $("#sheet") : $("#tab");
    target.focus();
  };
}

/* render() keeps focus itself (keepFocusAcrossRender), but many handlers
   redraw just their own part — a filter chip calls renderFrame(), an expand
   button renderLoadout(). This net catches those: after any keyboard or
   pointer action, if the control that had focus was replaced and focus fell
   to <body>, put it on the control's successor. setTimeout, not a microtask:
   it has to run after the target's own handlers, not after this listener. */
function wireFocusNet(){
  let last=null;
  document.addEventListener("focusin", e=>{
    const el=e.target;
    last = el.closest("#modal") ? null : { el, key:focusKeyOf(el), inTab:!!el.closest("#tab") };
  });
  const check=()=>setTimeout(()=>{
    if(!last || last.el.isConnected) return;
    if(document.activeElement!==document.body || $("#modal").classList.contains("show")) return;
    const t=(last.key && document.querySelector(last.key)) || (last.inTab ? $("#tab") : null);
    if(t) t.focus({preventScroll:true});
  });
  document.addEventListener("keydown", check, true);
  document.addEventListener("click", check, true);
}

/* The ⋯ menu and the HUD sheet are popovers only on narrow screens; wide, the
   CSS lays both out in place and nothing here fires. Popovers sit in the top
   layer, above any z-index — so a menu action that opens a dialog must close
   the menu first, or the dialog would open underneath it. */
function wireNarrowChrome(){
  const menu=$("#more-menu"), hud=$("#hud");
  const isOpen=el=>{ try{ return el.matches(":popover-open"); }catch(_){ return false; } };
  menu.addEventListener("click", e=>{ if(e.target.closest("button") && isOpen(menu)) menu.hidePopover(); });
  // popovertarget exposes "expanded" only in the accessibility tree; the
  // attribute is written too, so CSS (the ledger's chevron) can follow it.
  [[hud,$("#ledger")],[menu,$("#t-more")]].forEach(([pop,btn])=>{
    btn.setAttribute("aria-expanded","false");
    pop.addEventListener("toggle", e=>btn.setAttribute("aria-expanded", String(e.newState==="open")));
  });
  // Widening the window past the breakpoint turns both back into in-flow
  // layout; an open popover would stay pinned in the top layer over it.
  matchMedia("(min-width:1021px)").addEventListener("change", e=>{
    if(e.matches) [menu,hud].forEach(el=>{ if(isOpen(el)) el.hidePopover(); });
  });
}

/* ============ BOOT ============ */
/* The boot overlay used to cost a fixed 1760ms while the work behind it took
   44ms on a warm connection — 97% theatre, charged on every single load, to
   every user, forever. It now follows the real pipeline: a line appears when
   its stage actually completes, held only long enough to be read, and the
   overlay leaves the moment the registry is ready. On a slow connection it
   finally becomes what it always pretended to be — a progress indicator. */
const BOOT_MIN_LINE = 120;   // short enough not to be a toll, long enough to read
const BOOT_MIN_SYNC = 300;   // the one line carrying real information
// The first line ("ИНИЦИАЛИЗАЦИЯ…") ships in the markup, so the clock starts
// when this script parses — that is when the overlay became readable.
let bootLastAt = performance.now();
function bootSay(text, hold){
  const el=$("#boot .blog");
  if(!el) return Promise.resolve();
  const wait=Math.max(0, (hold||BOOT_MIN_LINE)-(performance.now()-bootLastAt));
  return new Promise(done=>setTimeout(()=>{
    el.textContent=text; bootLastAt=performance.now(); done();
  }, wait));
}
function bootFinish(onDone){
  const wait=Math.max(0, BOOT_MIN_LINE-(performance.now()-bootLastAt));
  setTimeout(()=>{
    $("#boot").classList.add("done");
    // The overlay sits at z-index 200, above the modal — anything that has to
    // be said about the restored build waits until it has faded out.
    if(onDone) setTimeout(onDone, 520);
  }, wait);
}

/* ============ LANGUAGE SWITCH ============ */
function wireLangSwitch(){
  const btn=$("#t-lang");
  if(!btn) return;
  btn.textContent = currentLang==="ru" ? "EN / RU" : "RU / EN";
  btn.onclick = async ()=>{
    const next = currentLang==="ru" ? "en" : "ru";
    btn.disabled = true; btn.textContent="…";
    try{
      L = await fetchAndLocalize(next);
      rebuildIndexes();
      wireLangSwitch();
      render();
    } finally { btn.disabled = false; }
  };
}

/* ============ INIT ============ */
(async function startApp(){
  bootSay("ЗАГРУЗКА РЕЕСТРА UNION…"); // not awaited: the fetch must start now
  try{
    L = await fetchAndLocalize(currentLang);
  }catch(e){
    console.error(e);
    return; // loadBaseData() already showed an error message in the DOM
  }
  await bootSay(`СИНХРОНИЗАЦИЯ: ${L.frames.length} ШАССИ · ${L.weapons.length} ОРУЖИЯ · ${L.systems.length} СИСТЕМ`, BOOT_MIN_SYNC);
  rebuildIndexes();

  // A share link wins over the stored build: the reader asked to see that
  // one, and their own work stays untouched in localStorage meanwhile.
  let restoreReport=null, linkFailed=false;
  const shared=await consumeShareLink();
  if(shared && !shared.failed){
    if(shared.dropped.length) restoreReport=shared.dropped;
  } else {
    // A link that failed to decode falls back to the reader's own build too:
    // leaving the state empty here would let the first render() autosave
    // that empty build over their real one.
    if(shared) linkFailed=true;
    // Restore before the first render, so the app never flashes an empty
    // build over work that is actually still there.
    const saved=loadSavedBuild();
    if(saved){
      const dropped=applyBuildState(saved.state);
      holdSaveIfIncomplete(dropped);
      lastSaveAt = saved.savedAt ? new Date(saved.savedAt) : null;
      if(isNaN(lastSaveAt)) lastSaveAt=null;
      if(dropped.length) restoreReport=dropped;
    }
  }

  wireTopbar();
  wireLangSwitch();
  render();
  renderSaveState();
  await bootSay("ДОСТУП РАЗРЕШЁН ▸");
  bootFinish(()=>{
    if(linkFailed) notice("Ссылка не прочитана",
      "Адрес повреждён или собран другой версией реестра. Попросите прислать ссылку заново или файл сборки.");
    else if(restoreReport && saveHold) reportPackFailure(restoreReport);
    else if(restoreReport) reportDropped(sheetSource==="shared"?"Сборка открыта частично":"Сборка восстановлена частично", restoreReport);
  });
})();
