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
    console.error("[Lancer Registry] не удалось сохранить сборку:", e);
  }
  renderSaveState();
}
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveBuildNow, 400); }
function renderSaveState(){
  const el=document.getElementById("savestate"); if(!el) return;
  if(saveHold){
    el.className="savestate err";
    el.textContent="⚠ НЕ СОХРАНЯЕТСЯ";
    el.title=`Не загрузились данные: ${saveHold.join(", ")}. Сохранённая сборка не тронута — перезагрузите страницу, чтобы вернуть её целиком. Изменения этой сессии можно выгрузить кнопкой СОХРАНИТЬ.`;
    return;
  }
  if(saveFailed){
    el.className="savestate err";
    el.textContent="⚠ НЕ СОХРАНЯЕТСЯ";
    el.title="Браузер не даёт сохранить сборку (приватный режим или переполнено хранилище). Выгрузите её кнопкой СОХРАНИТЬ.";
    return;
  }
  el.className="savestate";
  if(!lastSaveAt){ el.textContent=""; el.removeAttribute("title"); return; }
  const hh=String(lastSaveAt.getHours()).padStart(2,"0");
  const mm=String(lastSaveAt.getMinutes()).padStart(2,"0");
  el.innerHTML=`<i class="pfx">// СОХРАНЕНО </i>${hh}:${mm}`;
  el.title="Сборка автоматически сохраняется в этом браузере. Кнопка СОХРАНИТЬ выгружает её файлом.";
}
function loadSavedBuild(){
  let raw=null;
  try{ raw=localStorage.getItem(BUILD_KEY); }catch(e){ return null; }
  if(!raw) return null;
  try{
    const d=JSON.parse(raw);
    return (d && typeof d==="object" && d.state) ? d : null;
  }catch(e){
    console.warn("[Lancer Registry] сохранённая сборка повреждена, игнорирую");
    return null;
  }
}


/* One line per non-empty part of the current build, for the "this is what
   disappears" list in every destructive dialog. */
function buildLossSummary(){
  const out=[];
  const n=(x,one,few,many)=>{ const m=x%100, k=x%10;
    if(m>=11&&m<=14) return `${x} ${many}`;
    if(k===1) return `${x} ${one}`;
    if(k>=2&&k<=4) return `${x} ${few}`;
    return `${x} ${many}`; };
  const p=state.pilot;
  if(p.callsign||p.name) out.push(`пилот ${p.callsign||p.name}`);
  if(p.ll) out.push(`лицензионный уровень LL${p.ll}`);
  const sk=Object.keys(state.skills).length; if(sk) out.push(n(sk,"навык","навыка","навыков"));
  const tl=Object.keys(state.talents).length; if(tl) out.push(n(tl,"талант","таланта","талантов"));
  const hs=HASE.filter(h=>state.hase[h.k]).length; if(hs) out.push(n(hs,"мех-навык","мех-навыка","мех-навыков"));
  const lc=Object.keys(state.licenses).filter(k=>state.licenses[k]).length;
  if(lc) out.push(n(lc,"лицензия","лицензии","лицензий"));
  const gr=(state.gear.armor?1:0)+state.gear.weapons.length+state.gear.gear.length;
  if(gr) out.push(n(gr,"предмет снаряжения","предмета снаряжения","предметов снаряжения"));
  if(state.cores.length) out.push(n(state.cores.length,"CORE-бонус","CORE-бонуса","CORE-бонусов"));
  const fr=state.mech.frameId&&M.frame[state.mech.frameId];
  if(fr) out.push(`шасси ${dispName(fr)}`);
  const wp=(state.mech.mounts||[]).reduce((a,mt)=>a+(mt.items||[]).length,0);
  if(wp) out.push(n(wp,"единица оружия","единицы оружия","единиц оружия"));
  if(state.mech.systems.length) out.push(n(state.mech.systems.length,"система","системы","систем"));
  return out;
}
