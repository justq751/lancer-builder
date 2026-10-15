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
    next.mech.mounts=arr(m.mounts).map(mt=>({
      type: typeof (mt&&mt.type)==="string" ? mt.type : "Main",
      items: arr(mt&&mt.items).map(slot=>{
        const id = typeof slot==="string" ? slot : (slot && slot.id);
        if(!M.weapon[id]){ if(id) dropped.push(tText("dropped.weapon", {id})); return null; }
        const mod = slot && slot.mod;
        if(mod && !M.mod[mod]){ dropped.push(tText("dropped.mod", {id:mod})); return {id, mod:null}; }
        return {id, mod: mod||null};
      }).filter(Boolean),
    }));
    if(!next.mech.mounts.length) next.mech.mounts=buildMounts(M.frame[next.mech.frameId]);
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
