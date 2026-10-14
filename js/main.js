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
