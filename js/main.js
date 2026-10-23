/* ============ TOPBAR WIRING ============ */
function wireTopbar(){
  $("#t-export").onclick=exportBuild;
  $("#t-content").onclick=openContentSettings;
  $("#t-import").onclick=()=>$("#import-file").click();
  $("#import-file").onchange=e=>{ const f=e.target.files[0]; e.target.value=""; if(f) importBuild(f); };
  $("#t-reset").onclick=()=>{
    if(buildIsEmpty()){
      notice(tText("dialog.reset.nothing_title"), t("dialog.reset.nothing_lead"));
      return;
    }
    confirmDialog({
      title:tText("dialog.reset.title"),
      lead:t("dialog.reset.lead"),
      losses:buildLossSummary(),
      actions:[
        {label:"⬇ "+tText("dialog.export_first"), run:exportBuild},
        {label:"⟲ "+tText("dialog.reset.confirm"), danger:true, run:()=>{
          Object.assign(state, defaultState());
          saveHold=null; // so was clearing it
          activeTab="pilot";
          render();
        }},
      ],
    });
  };
  $("#modal").onclick=e=>{ if(e.target.id==="modal"||e.target.closest(".mclose")) closeModal(); };
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
    const target=(last.key && document.querySelector(last.key)) || (last.inTab ? $("#tab") : null);
    if(target) target.focus({preventScroll:true});
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
  // Buttons that open another popover (the language button) keep the menu:
  // that panel nests over it, and closing the menu would close it too.
  menu.addEventListener("click", e=>{ const b=e.target.closest("button"); if(b && !b.hasAttribute("popovertarget") && isOpen(menu)) menu.hidePopover(); });
  // popovertarget exposes "expanded" only in the accessibility tree; the
  // attribute is written too, so CSS (the ledger's chevron) can follow it.
  [[hud,$("#ledger")],[menu,$("#t-more")],[$("#lang-panel"),$("#t-lang")]].forEach(([pop,btn])=>{
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
/* Two independent settings (ADR 0005): the interface language (UI_LANG, t())
   and the data language (currentLang, L). The button states both — "RU",
   "EN", or "RU · EN" for interface · data — so the checking-against-the-
   original mode is visible at a glance. */
function renderLangButton(){
  const btn=$("#t-lang"); if(!btn) return;
  const u=UI_LANG, d=currentLang;
  btn.textContent = u===d ? u.toUpperCase() : `${u.toUpperCase()} · ${d.toUpperCase()}`;
  // i18n-dynamic: lang.aria.ui_ru, lang.aria.ui_en, lang.aria.data_ru, lang.aria.data_en
  btn.setAttribute("aria-label", t("lang.aria", {ui:t("lang.aria.ui_"+u), data:t("lang.aria.data_"+d)}));
  $$('#lang-panel input[name="ui-lang"]').forEach(r=>{ r.checked = r.value===u; });
  $$('#lang-panel input[name="data-lang"]').forEach(r=>{ r.checked = r.value===d; });
}
async function setUiLanguage(lang){
  if(!(await loadUiStrings(lang))) return; // superseded by a later choice
  applyStaticStrings();
  // A dialog was built from the old strings; its parts are not re-rendered.
  if($("#modal").classList.contains("show")) closeModal();
  render();
  renderSaveState();
  renderLangButton();
}
/* The row is marked busy, not disabled: disabling would knock focus off the
   radio the keyboard user just moved to. Changes while busy are ignored and
   the radios snap back to the language actually in force. */
let dataLangBusy=false;
async function setDataLanguage(lang){
  if(dataLangBusy){ renderLangButton(); return; }
  dataLangBusy=true;
  const row=$("#lang-data");
  row.setAttribute("aria-busy","true");
  const busy=document.createElement("span"); busy.className="busy"; busy.textContent=" …";
  row.querySelector("legend").append(busy);
  try{
    L = await fetchAndLocalize(lang);
    rebuildIndexes();
    render();
  } catch(e){
    console.error("[Lancer Registry] could not load the data language:", e);
    notice(tText("lang.data_failed_title"), t("lang.data_failed_lead", {lang:lang.toUpperCase()}));
  } finally {
    dataLangBusy=false;
    row.removeAttribute("aria-busy"); busy.remove();
    renderLangButton();
  }
}
function wireLangPanel(){
  $$('#lang-panel input[name="ui-lang"]').forEach(r=>r.onchange=()=>setUiLanguage(r.value));
  $$('#lang-panel input[name="data-lang"]').forEach(r=>r.onchange=()=>setDataLanguage(r.value));
  renderLangButton();
}

const LOAD_ERROR_FALLBACK = "Could not load data/lancer-data.json.<br><br>If you opened index.html straight from the file system (file://), the browser blocks fetch() of local files. Start a local server, for example:<br><br><code>python3 -m http.server</code><br><br>…in the project folder and open http://localhost:8000/ — see README.md.";

/* ============ INIT ============ */
(async function startApp(){
  // Interface and data languages are chosen apart (ADR 0005). Both fetches
  // start now; the interface strings are tiny and awaited first, so even the
  // boot lines speak the chosen language.
  const ls=k=>{ try{ return localStorage.getItem(k); }catch(_){ return null; } };
  const langs=detectLanguages(navigator.language, {ui:ls("lancer_ui_lang"), data:ls("lancer_lang")});
  const dataP=fetchAndLocalize(langs.data);
  dataP.catch(()=>{}); // handled below; keeps an early rejection from going unobserved
  await loadUiStrings(langs.ui);
  applyStaticStrings();
  bootSay(tText("boot.loading")); // not awaited
  try{
    L = await dataP;
  }catch(e){
    console.error(e);
    // Still the developer-facing text (AUDIT P1-4 rewrites this screen).
    // English literal fallback: in the file:// case data/ui.json failed too,
    // and t() would have nothing to show but the key.
    const help = UI["error.load.dev"] ? t("error.load.dev") : LOAD_ERROR_FALLBACK;
    document.body.innerHTML = `<div style="padding:40px;font-family:monospace;color:#e5604f">${help}</div>`;
    return;
  }
  await bootSay(tText("boot.sync", {frames:L.frames.length, weapons:L.weapons.length, systems:L.systems.length}), BOOT_MIN_SYNC);
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
  wireLangPanel();
  render();
  renderSaveState();
  await bootSay(tText("boot.granted")+" ▸");
  bootFinish(()=>{
    if(linkFailed) notice(tText("dialog.link_failed.title"),
      t("dialog.link_failed.lead"));
    else if(restoreReport && saveHold) reportPackFailure(restoreReport);
    else if(restoreReport) reportDropped(tText(sheetSource==="shared"?"dialog.dropped.opened_title":"dialog.dropped.restored_title"), restoreReport); // i18n-dynamic: dialog.dropped.opened_title, dialog.dropped.restored_title
  });
})();
