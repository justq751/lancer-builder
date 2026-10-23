/* ============ CORE: build shape, migrations, sanitizing ============
   The build `state` shape, forward migrations of old saves, and
   applyBuildState() which copies an untrusted build into `state`, dropping
   what the loaded dataset cannot render. DOM-free: reads the shared globals
   L, M and state (declared in js/app/), never document/localStorage/fetch.
   ============================================================ */
function defaultState(){
  return {
    pilot:{ name:"", callsign:"", background:"", ll:0 },
    skills:{},        // id -> 0/2/4/6
    customSkills:[],  // [{id,name,description}] — user-created skill triggers, ranked the same as state.skills
    talents:{},       // id -> 1..3
    hase:{hull:0,agility:0,systems:0,engineering:0},
    licenses:{},      // frameName -> 0..3
    gear:{ armor:null, weapons:[], gear:[] },
    cores:[],         // core bonus ids
    mech:{ frameId:null, mounts:[], systems:[] },
  };
}
const HASE = [
  // en: the game's own term, shown beside the translation as a reference —
  // not interface text. Name and effect in the interface language: haseLabel().
  {k:"hull",       en:"HULL"},
  {k:"agility",    en:"AGILITY"},
  {k:"systems",    en:"SYSTEMS"},
  {k:"engineering",en:"ENGINEERING"},
];
/* Plain text; callers esc() it for HTML.
   i18n-dynamic: hase.hull.name, hase.hull.effect, hase.agility.name, hase.agility.effect, hase.systems.name, hase.systems.effect, hase.engineering.name, hase.engineering.effect */
const haseLabel = (k, part) => tText(`hase.${k}.${part}`);
/* One-time migration: variant frames (frame.variant set) now share their
   base frame's license track (see licenseKeyFor()) instead of tracking
   their own. If a build has progress stored under a variant's own name
   (from before this existed, or an older exported save file), fold it into
   the base key instead of silently losing it. Safe to call repeatedly —
   a no-op once migrated. */
function migrateLicenseKeys(){
  (L.frames||[]).forEach(f=>{
    if(f.variant && state.licenses[f.name]!==undefined){
      const migrated=state.licenses[f.name];
      const cur=state.licenses[f.variant]||0;
      state.licenses[f.variant]=Math.max(cur, migrated);
      delete state.licenses[f.name];
    }
  });
}
/* One-time migration: equipped-weapon mount slots used to be plain weapon-id
   strings (state.mech.mounts[i].items = ["mw_foo", ...]). Weapon mods need
   somewhere to live per-slot (a mod is installed on THIS Nelson, not on
   "Assault Cannon" generically), so each slot is now {id, mod}. Convert any
   surviving plain-string slots (older saves / imported builds) in place.
   Safe to call repeatedly — a no-op once migrated. */
function migrateWeaponSlots(){
  (state.mech.mounts||[]).forEach(mt=>{
    mt.items = (mt.items||[]).map(slot=> typeof slot==="string" ? {id:slot, mod:null} : slot);
  });
}
function buildIsEmpty(){
  const p=state.pilot;
  return !p.name && !p.callsign && !p.background && !p.ll
    && !Object.keys(state.skills).length && !state.customSkills.length
    && !Object.keys(state.talents).length && !Object.keys(state.licenses).length
    && !HASE.some(h=>state.hase[h.k]) && !state.cores.length
    && !state.gear.armor && !state.gear.weapons.length && !state.gear.gear.length
    && !state.mech.frameId;
}
function allowedNext(type,sizes){
  const n=sizes.length;
  if(type==="Main")  return n<1?["Main","Auxiliary"]:[];
  if(type==="Heavy") return n<1?["Heavy","Main","Auxiliary","Superheavy"]:[];
  if(type==="Superheavy") return n<1?["Superheavy"]:[];
  if(type==="Aux/Aux") return n<2?["Auxiliary"]:[];
  if(type==="Flex"){
    if(n>=2||sizes.includes("Main")) return [];
    return n===1?["Auxiliary"]:["Main","Auxiliary"];
  }
  if(type==="Main/Aux"){
    const r=[]; if(!sizes.includes("Main")) r.push("Main");
    if(sizes.filter(s=>s==="Auxiliary").length<1) r.push("Auxiliary"); return r;
  }
  return [];
}
function buildMounts(frame){
  const mounts = frame.mounts.map(type=>({type:type,items:[]}));
  const iw = FRAME_INTEGRATED_WEAPON[frame.id];
  if(iw) mounts.push({type:"Integrated", items:[{id:iw, mod:null}]});
  return mounts;
}
/* Frames whose CORE system is (or includes) a built-in weapon that doesn't
   occupy a normal mount slot — e.g. Raleigh's M35 Mjolnir, Barbarossa's
   Apocalypse Rail. These get an automatic "Integrated" mount, pre-filled;
   if removed, it can only be restored via openIntegratedPicker() (below),
   never filled with anything else. */
const FRAME_INTEGRATED_WEAPON = {
  "mf_lancaster": "mw_lancaster_integrated",
  "mf_raleigh": "mw_raleigh_integrated",
  "mf_barbarossa": "mw_barbarossa_integrated",
  "mf_sherman": "mw_sherman_integrated",
  "mf_tokugawa_alt_enkidu": "mw_tokugawa_alt_enkidu_integrated",
  "mf_caliban": "mw_caliban_integrated",
  "mf_emperor": "mw_emperor_integrated",
  "mf_Empakaai_alt_blackbeard": "mw_empakaai_alt_blackbeard_integrated",
  "mf_lycan": "mw_integrated_shock_claws",
};
/* ---------------- MOUNTS: superheavy weapons, CORE bonus mounts ----------------
   A mount is {type, items:[slot]}; a slot is {id, mod} plus, for a superheavy
   weapon, `extra`: the index of the second mount it takes up (the rules: a
   Heavy mount and one more mount of any size, which can hold nothing else).
   A mount added by a CORE bonus carries `cb` (the bonus id); a mount Mount
   Retrofitting turned into Main/Aux carries `retro` (its own type before). */
const MOUNT_RETROFIT_CB = "cb_mount_retrofitting";
/* Mounts a CORE bonus adds, appended after the frame's own. `fewerThan3`:
   only when the frame has fewer than three mounts (integrated excluded) —
   counted on the frame's own mounts, so two such bonuses do not cancel out. */
const CORE_BONUS_MOUNTS = {
  "cb_improved_armament":   {type:"Flex", fewerThan3:true},
  "cb_integrated_weapon":   {type:"Integrated"},   // one Auxiliary, no mods
  "cb_superheavy_mounting": {type:"Superheavy", fewerThan3:true},
};
const isFrameIntegratedMount = mt => mt.type==="Integrated" && !mt.cb;
// Neither kind of integrated mount can lend itself to a superheavy weapon.
const isIntegratedMount = mt => mt.type==="Integrated";
const slotMount = slot => M.weapon[slot.id] && M.weapon[slot.id].mount;
const hostsSuperheavy = mt => (mt.items||[]).some(s=>slotMount(s)==="Superheavy");
/* The slot whose superheavy weapon takes up mount `mi` as its second mount. */
function extraOwner(mounts, mi){
  for(let i=0;i<mounts.length;i++){
    const wi=(mounts[i].items||[]).findIndex(s=>s.extra===mi);
    if(wi>=0) return {mi:i, wi};
  }
  return null;
}
/* Mounts a superheavy weapon on mount `hi` may take as its second one —
   occupied ones included (what is on them comes off; the caller says so).
   Superheavy Mounting's own mount must pair with a Heavy mount if there is
   one. */
function extraMountCandidates(mounts, hi){
  const ok=mounts.map((mt,i)=>i).filter(i=>i!==hi
    && !isIntegratedMount(mounts[i]) && !hostsSuperheavy(mounts[i])
    && !extraOwner(mounts, i));
  if(mounts[hi] && mounts[hi].cb==="cb_superheavy_mounting"){
    const heavy=ok.filter(i=>mounts[i].type==="Heavy");
    if(heavy.length) return heavy;
  }
  return ok;
}
/* What mount `mi` still accepts, as weapon mount sizes. */
function mountAllows(mounts, mi){
  const mt=mounts[mi];
  if(!mt || isFrameIntegratedMount(mt) || extraOwner(mounts, mi)) return [];
  const sizes=mt.items.map(slotMount);
  if(mt.type==="Integrated") return sizes.length<1?["Auxiliary"]:[];
  const allow=allowedNext(mt.type, sizes);
  return allow.includes("Superheavy") && !extraMountCandidates(mounts, mi).length
    ? allow.filter(x=>x!=="Superheavy") : allow;
}
/* Puts weapons into a mount of `type` in order; what no longer fits is
   returned as `lost` (slots). */
function refitItems(type, items){
  const kept=[], lost=[];
  items.forEach(slot=>{
    if(allowedNext(type, kept.map(slotMount)).includes(slotMount(slot))) kept.push(slot);
    else lost.push(slot);
  });
  return {kept, lost};
}
/* Removes mount `mi`, keeping every slot.extra pointing at the same mount;
   a superheavy weapon whose second mount was the removed one loses it. */
function removeMountAt(mounts, mi){
  const next=mounts.filter((mt,i)=>i!==mi);
  next.forEach(mt=>mt.items.forEach(s=>{
    if(s.extra===mi) delete s.extra;
    else if(s.extra>mi) s.extra--;
  }));
  return next;
}
const cloneMounts = mounts => mounts.map(mt=>({...mt, items:(mt.items||[]).map(s=>({...s}))}));
/* The mount layout `frame` should have with CORE bonuses `cores`, starting
   from `mounts` (not mutated). Returns {mounts, lost}: lost are the slots
   that had to come off — on a bonus mount that is going away, or no longer
   fitting a mount Mount Retrofitting gives back. Applying Mount Retrofitting
   needs a choice of mount (retrofitMount()), so it is never done here. */
function planCoreMounts(frame, cores, mounts){
  let next=cloneMounts(mounts);
  const lost=[];
  if(!frame) return {mounts:next, lost};
  const want=Object.keys(CORE_BONUS_MOUNTS).filter(id=>cores.includes(id)
    && (!CORE_BONUS_MOUNTS[id].fewerThan3 || frame.mounts.length<3));
  for(let i=next.length-1;i>=0;i--){
    if(next[i].cb && !want.includes(next[i].cb)){ lost.push(...next[i].items); next=removeMountAt(next, i); }
  }
  want.forEach(id=>{
    if(!next.some(mt=>mt.cb===id)) next.push({type:CORE_BONUS_MOUNTS[id].type, items:[], cb:id});
  });
  if(!cores.includes(MOUNT_RETROFIT_CB)) next.forEach(mt=>{
    if(!mt.retro) return;
    mt.type=mt.retro; delete mt.retro;
    const r=refitItems(mt.type, mt.items);
    mt.items=r.kept; lost.push(...r.lost);
  });
  return {mounts:next, lost};
}
/* Mounts Mount Retrofitting may turn into Main/Aux: the frame's own, not
   integrated, not already Main/Aux. */
const retrofitCandidates = mounts =>
  mounts.map((mt,i)=>i).filter(i=>!mounts[i].cb && !isIntegratedMount(mounts[i]) && mounts[i].type!=="Main/Aux");
/* Mount Retrofitting applied to mount `mi`: {mounts, lost}, nothing mutated. */
function retrofitMount(mounts, mi){
  const next=cloneMounts(mounts);
  const mt=next[mi];
  mt.retro=mt.type; mt.type="Main/Aux";
  const r=refitItems(mt.type, mt.items);
  mt.items=r.kept;
  return {mounts:next, lost:r.lost};
}
/* Superheavy weapon at mounts[hi].items[wi] takes mount `xi` as its second
   one; whatever was on `xi` comes off and is returned. Mutates `mounts`. */
function claimExtraMount(mounts, hi, wi, xi){
  const lost=mounts[xi].items;
  mounts[xi].items=[];
  mounts[hi].items[wi].extra=xi;
  return lost;
}
/* Drops `extra` links that do not hold: not a superheavy weapon, a mount that
   is gone, integrated or not empty, or claimed twice. The weapon stays; the
   sheet flags it as missing its second mount. */
function checkExtraMounts(mounts){
  const claimed=new Set();
  mounts.forEach((mt,mi)=>mt.items.forEach(s=>{
    if(s.extra===undefined) return;
    const x=s.extra, target=mounts[x];
    if(slotMount(s)!=="Superheavy" || !Number.isInteger(x) || x===mi || !target
      || isIntegratedMount(target) || target.items.length || claimed.has(x)) delete s.extra;
    else claimed.add(x);
  }));
}
/* Superheavy weapons with no second mount, as {mi, wi}. */
function superheavyMissingExtra(mounts){
  const out=[];
  mounts.forEach((mt,mi)=>mt.items.forEach((s,wi)=>{
    if(slotMount(s)==="Superheavy" && s.extra===undefined) out.push({mi, wi});
  }));
  return out;
}
/* Copies an untrusted build object — restored autosave or an imported file —
   into `state`, keeping only what the currently loaded dataset can render.
   Anything pointing at an id we don't have (a pack that isn't loaded, someone
   else's homebrew, a renamed frame) is dropped and named, instead of crashing
   the renderer on `M.weapon[id].name` several screens later.
   Returns the list of dropped things, in the product's own words. */
function applyBuildState(raw){
  const dropped=[];
  const next=defaultState();
  const s=(raw && typeof raw==="object") ? raw : {};
  const int=(v,lo,hi)=>{ const n=Math.round(Number(v)); return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):lo; };
  const str=v=>typeof v==="string"?v:"";
  const obj=v=>(v && typeof v==="object" && !Array.isArray(v))?v:{};
  const arr=v=>Array.isArray(v)?v:[];

  const p=obj(s.pilot);
  next.pilot.name=str(p.name).slice(0,120);
  next.pilot.callsign=str(p.callsign).slice(0,120);
  next.pilot.ll=int(p.ll,0,12);
  if(p.background && !M.bg[p.background]) dropped.push(tText("dropped.background", {id:p.background}));
  next.pilot.background=M.bg[p.background]?p.background:"";

  // Custom skills are user-authored, so they validate by shape, not by id —
  // and they must land before the skills map, which accepts their ids.
  next.customSkills=arr(s.customSkills)
    .filter(c=>c && typeof c==="object" && typeof c.id==="string")
    .map(c=>({id:c.id, name:str(c.name).slice(0,160), description:str(c.description).slice(0,4000)}));
  const customIds=new Set(next.customSkills.map(c=>c.id));

  Object.entries(obj(s.skills)).forEach(([id,v])=>{
    if(M.skill[id]||customIds.has(id)) next.skills[id]=int(v,0,6);
    else dropped.push(tText("dropped.skill", {id}));
  });
  Object.entries(obj(s.talents)).forEach(([id,v])=>{
    if(M.talent[id]) next.talents[id]=int(v,1,3);
    else dropped.push(tText("dropped.talent", {id}));
  });
  const h=obj(s.hase);
  HASE.forEach(x=>{ next.hase[x.k]=int(h[x.k],0,6); });

  // License keys are frame names, not ids; accept both the own name and the
  // base-frame name, since migrateLicenseKeys() folds one into the other.
  const licKeys=new Set();
  (L.frames||[]).forEach(f=>{ if(f.name) licKeys.add(f.name); if(f.variant) licKeys.add(f.variant); });
  Object.entries(obj(s.licenses)).forEach(([k,v])=>{
    if(licKeys.has(k)) next.licenses[k]=int(v,0,3);
    else dropped.push(tText("dropped.license", {id:k}));
  });

  const g=obj(s.gear);
  if(g.armor && !M.gear[g.armor]) dropped.push(tText("dropped.armor", {id:g.armor}));
  next.gear.armor=M.gear[g.armor]?g.armor:null;
  const keepGear=list=>arr(list).filter(id=>{
    if(M.gear[id]) return true;
    dropped.push(tText("dropped.gear", {id})); return false;
  });
  next.gear.weapons=keepGear(g.weapons);
  next.gear.gear=keepGear(g.gear);

  next.cores=arr(s.cores).filter(id=>{
    if(M.core[id]) return true;
    dropped.push(tText("dropped.core", {id})); return false;
  });

  const m=obj(s.mech);
  if(m.frameId && !M.frame[m.frameId]) dropped.push(tText("dropped.frame", {id:m.frameId}));
  next.mech.frameId=M.frame[m.frameId]?m.frameId:null;
  next.mech.systems=arr(m.systems).filter(id=>{
    if(M.system[id]) return true;
    dropped.push(tText("dropped.system", {id})); return false;
  });
  if(next.mech.frameId){
    next.mech.mounts=arr(m.mounts).map(mt=>{
      const out={
        type: typeof (mt&&mt.type)==="string" ? mt.type : "Main",
        items: arr(mt&&mt.items).map(slot=>{
          const id = typeof slot==="string" ? slot : (slot && slot.id);
          if(!M.weapon[id]){ if(id) dropped.push(tText("dropped.weapon", {id})); return null; }
          const mod = slot && slot.mod;
          const kept = {id, mod:null};
          if(mod && !M.mod[mod]) dropped.push(tText("dropped.mod", {id:mod}));
          else kept.mod = mod||null;
          if(slot && Number.isInteger(slot.extra)) kept.extra = slot.extra;
          return kept;
        }).filter(Boolean),
      };
      if(mt && CORE_BONUS_MOUNTS[mt.cb]) out.cb = mt.cb;
      if(mt && typeof mt.retro==="string" && out.type==="Main/Aux") out.retro = mt.retro;
      return out;
    });
    if(!next.mech.mounts.length) next.mech.mounts=buildMounts(M.frame[next.mech.frameId]);
    // Bonus mounts follow the selected bonuses (an older save has none yet).
    const plan=planCoreMounts(M.frame[next.mech.frameId], next.cores, next.mech.mounts);
    plan.lost.forEach(slot=>dropped.push(tText("dropped.weapon_no_mount", {name:M.weapon[slot.id].name})));
    next.mech.mounts=plan.mounts;
    checkExtraMounts(next.mech.mounts);
  } else if(m.mounts && arr(m.mounts).length){
    // Frame is gone, so its mounts have nothing to hang on.
    arr(m.mounts).forEach(mt=>arr(mt&&mt.items).forEach(slot=>{
      const id = typeof slot==="string" ? slot : (slot && slot.id);
      if(id && M.weapon[id]) dropped.push(tText("dropped.weapon_no_frame", {name:M.weapon[id].name}));
    }));
  }

  Object.assign(state, next);
  migrateLicenseKeys();
  migrateWeaponSlots();
  return dropped;
}
