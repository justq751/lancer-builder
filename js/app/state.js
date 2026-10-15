/* ---------------- STATE ---------------- */
const state = defaultState();
let activeTab = "pilot";

/* ---------------- PERSISTENCE ----------------
   There is no server and no account: the tab IS the storage. Every mutation
   in this file ends in render(), so render() is where the build is written —
   debounced, because a held-down stepper would otherwise write on every
   frame. The file export stays the way to move a build between devices. */
const BUILD_KEY = "lancer_build";
const BUILD_V = 1;
let saveTimer = null, lastSaveAt = null, saveFailed = false;
/* Set (to the list of failed packs) when the stored build was restored with
   pieces missing only because some pack did not load. Writing the trimmed
   build back would turn a network hiccup into permanent loss, so autosave
   stays off until a reload brings the data back — or until the user replaces
   the build on purpose (import, reset), which is their call to make. */
let saveHold = null;
function holdSaveIfIncomplete(dropped){
  if(dropped.length && PACK_LOAD_FAILURES.length) saveHold = PACK_LOAD_FAILURES.slice();
}
/* "build" = the editor, "sheet" = the read-only reference deck. sheetSource
   is "shared" when the build came in through a link: someone else's build
   must never overwrite the reader's own autosave. */
let viewMode = (localStorage.getItem("view_mode")==="sheet") ? "sheet" : "build";
let sheetSource = "own";

function saveBuildNow(){
  clearTimeout(saveTimer); saveTimer=null;
  if(sheetSource==="shared") return; // reading someone else's build
  if(saveHold){ renderSaveState(); return; } // stored build is more complete than this one
  try{
    // A first visit that touched nothing has nothing worth claiming to have
    // saved; once anything is stored, an emptied build is a real change.
    if(buildIsEmpty() && !localStorage.getItem(BUILD_KEY)) return;
    localStorage.setItem(BUILD_KEY, JSON.stringify(
      {_app:"lancer-registry", v:BUILD_V, savedAt:new Date().toISOString(), state}));
    lastSaveAt=new Date(); saveFailed=false;
  }catch(e){
    // Private browsing and a full quota both land here. Losing the autosave is
    // survivable; losing it silently is not — the header goes amber.
    saveFailed=true;
    console.error("[Lancer Registry] could not save the build:", e);
  }
  renderSaveState();
}
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveBuildNow, 400); }
function renderSaveState(){
  const el=document.getElementById("savestate"); if(!el) return;
  if(saveHold){
    el.className="savestate err";
    el.textContent="⚠ "+tText("save.not_saving");
    el.title=tText("save.hold_title", {packs:saveHold.join(", ")});
    return;
  }
  if(saveFailed){
    el.className="savestate err";
    el.textContent="⚠ "+tText("save.not_saving");
    el.title=tText("save.failed_title");
    return;
  }
  el.className="savestate";
  if(!lastSaveAt){ el.textContent=""; el.removeAttribute("title"); return; }
  const time=new Intl.DateTimeFormat(UI_LANG, {hour:"2-digit", minute:"2-digit"}).format(lastSaveAt);
  el.innerHTML=`<i class="pfx">// ${t("save.saved")} </i>${esc(time)}`;
  el.title=tText("save.title");
}
function loadSavedBuild(){
  let raw=null;
  try{ raw=localStorage.getItem(BUILD_KEY); }catch(e){ return null; }
  if(!raw) return null;
  try{
    const d=JSON.parse(raw);
    return (d && typeof d==="object" && d.state) ? d : null;
  }catch(e){
    console.warn("[Lancer Registry] the saved build is corrupted, ignoring it");
    return null;
  }
}


/* One line per non-empty part of the current build, for the "this is what
   disappears" list in every destructive dialog. */
function buildLossSummary(){
  const out=[];
  // Plain text (tText): confirmDialog esc()es each line itself.
  const p=state.pilot;
  if(p.callsign||p.name) out.push(tText("loss.pilot", {name:p.callsign||p.name}));
  if(p.ll) out.push(tText("loss.ll", {ll:p.ll}));
  const sk=Object.keys(state.skills).length; if(sk) out.push(tText("loss.skills", {n:sk}));
  const tl=Object.keys(state.talents).length; if(tl) out.push(tText("loss.talents", {n:tl}));
  const hs=HASE.filter(h=>state.hase[h.k]).length; if(hs) out.push(tText("loss.hase", {n:hs}));
  const lc=Object.keys(state.licenses).filter(k=>state.licenses[k]).length;
  if(lc) out.push(tText("loss.licenses", {n:lc}));
  const gr=(state.gear.armor?1:0)+state.gear.weapons.length+state.gear.gear.length;
  if(gr) out.push(tText("loss.gear", {n:gr}));
  if(state.cores.length) out.push(tText("loss.cores", {n:state.cores.length}));
  const fr=state.mech.frameId&&M.frame[state.mech.frameId];
  if(fr) out.push(tText("loss.frame", {name:dispName(fr)}));
  const wp=(state.mech.mounts||[]).reduce((a,mt)=>a+(mt.items||[]).length,0);
  if(wp) out.push(tText("loss.weapons", {n:wp}));
  if(state.mech.systems.length) out.push(tText("loss.systems", {n:state.mech.systems.length}));
  return out;
}
