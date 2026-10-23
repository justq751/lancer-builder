/* ============ CORE: game rules ============
   derived() budgets and mech stats, license/unlock checks, list ordering.
   DOM-free: reads the shared globals L, M and state, nothing else.
   ============================================================ */
/* Systems whose effect grants a flat, always-on bonus to a mech stat
   (as opposed to a conditional/reactive bonus, or a bonus to a deployed
   object rather than the mech itself — those stay as descriptive text only,
   since this app doesn't track live combat state). Scanned across the full
   core dataset + all content packs; currently only Personalizations
   qualifies. Extend this map if new content adds more. */
const SYSTEM_STAT_BONUSES = {
  "ms_personalizations": {hp: 2},
};
function systemStatBonusTotal(stat){
  return state.mech.systems.reduce((sum,id)=>{
    const b=SYSTEM_STAT_BONUSES[id];
    return sum + (b && b[stat] ? b[stat] : 0);
  }, 0);
}

/* CORE bonuses' numeric stat effects live in data/core_bonus_stat_mods.json
   (loaded as L.core_stat_mods, see loadBaseData()) instead of being
   hardcoded here — edit that file to add homebrew bonuses, no code changes
   needed. Most entries are a flat {stat: N} add, read generically below.
   The one exception is Size: "increase Size by one increment" isn't a flat
   number, it moves along the fixed 0.5→1→2→3 track — any CORE bonus that
   does this is marked with "size_step":true in the data file instead of a
   normal stat key, and applyFomorianSize() below handles the step/cap. */
function coreStatBonusTotal(stat){
  const mods = L.core_stat_mods || {};
  return state.cores.reduce((sum,id)=>{
    const b=mods[id];
    return sum + (b && typeof b[stat]==="number" ? b[stat] : 0);
  }, 0);
}
const SIZE_STEPS=[0.5,1,2,3];
function applyFomorianSize(size){
  const mods = L.core_stat_mods || {};
  const stepping = state.cores.some(id=>mods[id] && mods[id].size_step);
  if(!stepping) return size;
  const i=SIZE_STEPS.indexOf(size);
  if(i<0) return Math.min(3,size+1); // unrecognized/custom size value: best-effort +1, still capped
  return SIZE_STEPS[Math.min(i+1, SIZE_STEPS.length-1)];
}

function derived(){
  const ll = state.pilot.ll;
  const grit = Math.ceil(ll/2);
  const b = {
    skill:{cap:4+ll}, talent:{cap:3+ll}, hase:{cap:2+ll},
    license:{cap:ll}, core:{cap:Math.floor(ll/3)}
  };
  b.skill.used   = Object.values(state.skills).reduce((a,v)=>a+v/2,0);
  b.talent.used  = Object.values(state.talents).reduce((a,v)=>a+v,0);
  b.hase.used    = Object.values(state.hase).reduce((a,v)=>a+v,0);
  b.license.used = Object.values(state.licenses).reduce((a,v)=>a+v,0);
  b.core.used    = state.cores.length;

  const {hull,agility,systems,engineering} = state.hase;
  const f = state.mech.frameId ? M.frame[state.mech.frameId] : null;
  let mech=null, sp={cap:0,used:0};
  if(f){
    const s=f.stats;
    mech = {
      size:applyFomorianSize(s.size), structure:s.structure, stress:s.stress,
      armor:Math.min(4, s.armor+coreStatBonusTotal("armor")),
      hp:s.hp+grit+2*hull+systemStatBonusTotal("hp")+coreStatBonusTotal("hp"),
      repcap:s.repcap+Math.floor(hull/2),
      evasion:s.evasion+agility+coreStatBonusTotal("evasion"),
      speed:s.speed+Math.floor(agility/2),
      edef:s.edef+systems+coreStatBonusTotal("edef"),
      tech_attack:s.tech_attack+systems,
      heatcap:s.heatcap+engineering+coreStatBonusTotal("heatcap"),
      sensor_range:s.sensor_range,
      save:s.save+grit+coreStatBonusTotal("save"),
      sp:s.sp+Math.floor(systems/2),
      limited_bonus:Math.floor(engineering/2),
      attack:grit,
    };
    sp.cap = mech.sp;
    let used=0;
    state.mech.systems.forEach(id=>{ const sy=M.system[id]; if(sy) used+=sy.sp||0; });
    state.mech.mounts.forEach(mt=>mt.items.forEach(slot=>{
      const w=M.weapon[slot.id]; if(w) used+=w.sp||0;
      if(slot.mod){ const md=M.mod[slot.mod]; if(md) used+=md.sp||0; }
    }));
    sp.used=used;
  }
  return {ll,grit,b,mech,sp,frame:f};
}

/* Max talent rank a pilot can put points into at a given license level.
   At LL0 a pilot picks 3 rank-1 talents; each subsequent LL both grants
   1 more talent point AND unlocks the next rank tier — so rank 3 needs
   LL2, rank 2 needs LL1, capped at the game's rank-3 ceiling. */
function talentRankCap(ll){ return Math.min(3, ll+1); }

/* license helpers */
const licRank = name => state.licenses[name]||0;
/* Canonical license-track key for a frame. Variant frames (frame.variant
   set, e.g. Enkidu -> "Tokugawa") share their base frame's license rank
   instead of tracking their own — ranking up either the base or the variant
   raises the same counter, and both unlock together. Use this everywhere a
   frame's license progress is read or written; never key off frame.name
   directly for licensing (frame.name is still fine for display/traits). */
function licenseKeyFor(f){ return f.variant || f.name; }
/* GMS first, then the rest of the manufacturers grouped together in this
   fixed order, unknown sources last — used to sort weapon/system lists so
   items from the same manufacturer stay together instead of interleaving. */
const SOURCE_ORDER = ["GMS","IPS-N","SSC","HORUS","HA","EXOTIC"];
const sourceOrder = src => { const i=SOURCE_ORDER.indexOf(src); return i<0?999:i; };
/* Picker ordering. Manufacturer used to be the first key, so opening a
   licence only lifted an item inside its own manufacturer block — a weapon
   the pilot had just earned still sat below dozens that cannot be installed
   at all. Availability comes first now; GMS still leads because it needs no
   licence and therefore counts as available, and manufacturer grouping is
   preserved inside each half. */
const pickerOrder = (a,b) =>
     (unlocked(b)-unlocked(a))
  || (sourceOrder(a.source)-sourceOrder(b.source))
  || a.name.localeCompare(b.name);
/* License ranks the pilot has invested across all of a manufacturer's frames,
   summed: rank 1 in three different HORUS frames counts as 3 HORUS ranks.
   Variant frames share their base frame's track (licenseKeyFor), so each
   track is counted once. GMS has no such requirement. */
function manufacturerRank(source){
  const keys = new Set(L.frames.filter(f=>f.source===source).map(licenseKeyFor));
  return [...keys].reduce((sum,k)=>sum+licRank(k), 0);
}
/* Each CORE bonus from a manufacturer costs 3 of its license ranks: the
   first needs 3, the second 6, and so on. A selected bonus is checked by its
   place among the selected bonuses of the same manufacturer (the earliest
   ones are the legal ones); an unselected one as the next to be taken. */
function coreBonusRanksNeeded(c){
  const same = state.cores.filter(id=>M.core[id] && M.core[id].source===c.source);
  const at = same.indexOf(c.id);
  return 3*((at<0 ? same.length : at)+1);
}
function coreBonusUnlocked(c){
  return c.source==="GMS" || manufacturerRank(c.source)>=coreBonusRanksNeeded(c);
}
function unlocked(item){
  if(item.source==="GMS"||item.license==="GMS"||(item.license_level||0)===0) return true;
  return licRank(item.license) >= (item.license_level||0);
}
function frameUnlocked(f){
  if(f.source==="GMS"||f.license_level===0) return true;
  return licRank(licenseKeyFor(f)) >= f.license_level;
}
