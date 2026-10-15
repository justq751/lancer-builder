/* =================== LANCER // REGISTRY =================== */
let L = null; // populated asynchronously, see startApp() at the bottom of this file
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = s => (s==null?"":String(s)).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rich = s => s==null?"":String(s); // dataset html is trusted (<br><ul><li><b>)

/* A card that opens a detail view is a button — its name. The card used to be
   a <div onclick>: unreachable by Tab, silent to a screen reader. The
   button's ::after (CSS .cardlink) stretches over the whole card, so a click
   anywhere on it still opens it, and the card's own buttons sit above that
   layer. `inner` is HTML the caller has already escaped. Clicks are handled
   once, by delegation — see CARD_OPENERS / wireCardLinks() in main.js. */
function cardLinkHTML(kind, id, inner, cls=""){
  return `<button type="button" class="cardlink ${cls}" data-open="${kind}" data-id="${esc(String(id))}">${inner}</button>`;
}

/* lookup maps (rebuilt once L is loaded/localized — see rebuildIndexes()) */
const byId = arr => Object.fromEntries(arr.map(x=>[x.id,x]));
let M = {};
let eqWeaponExpanded=new Set(), eqSystemExpanded=new Set(); // sets of "mi:wi" / system-index currently expanded inline
const eqWeaponTagSets=new Map(), eqWeaponProfIdx=new Map(); // per-item tag/profile-stage state, keyed the same way
const eqSystemTagSets=new Map();
let eqModExpanded=new Set(); // "mi:wi" whose installed mod's detail is expanded inline
const eqModTagSets=new Map();
function getMap(map,key,fallback){ if(!map.has(key)) map.set(key,fallback()); return map.get(key); }
let TAGS = {}, TAG_PATTERNS = [];
function rebuildIndexes(){
  M = {
    frame: byId(L.frames), weapon: byId(L.weapons), system: byId(L.systems),
    talent: byId(L.talents), skill: byId(L.skills), core: byId(L.core_bonuses),
    gear: byId(L.pilot_gear), bg: byId(L.backgrounds), mod: byId(L.mods || []),
  };
  TAGS = byId(L.tags || []);
  TAG_PATTERNS = (L.tags || []).map(tg => ({ id: tg.id, re: tagTemplateToRegex(tg.name) }));
  migrateLicenseKeys();
  migrateWeaponSlots();
}
/* Looks up a skill by id among the built-in glossary (M.skill) OR the
   pilot's own custom skills (state.customSkills) — used wherever selected
   skills are displayed (summary, print sheet), since custom ones aren't
   in L.skills/M.skill. */
function skillInfo(id){
  return M.skill[id] || (state.customSkills||[]).find(s=>s.id===id);
}

/* Turns a tag glossary name template (e.g. "Reliable {VAL}", "{VAL}/Round",
   "Heat {VAL} (Self)") into a regex that matches a rendered tag string
   (e.g. "Reliable 2") and captures the value. Works for the current
   language's template too, since translators keep the "{VAL}" token as-is. */
function tagTemplateToRegex(tpl){
  const OPT = "\u0001", REQ = "\u0002";
  // "<space>{VAL}" -> optional numeric group (legacy data sometimes omits
  // the implicit "1", e.g. bare "Accurate" instead of "Accurate 1")
  let src = String(tpl).replace(/\s\{VAL\}/g, OPT);
  src = src.replace(/\{VAL\}/g, REQ); // any remaining {VAL} (e.g. "{VAL}/Round") stays mandatory
  src = src.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  // value can be a plain number OR dice notation like "1d6+2"
  src = src.split(OPT).join("(?:\\s+([\\w./+-]+))?");
  src = src.split(REQ).join("([\\w./+-]+)");
  return new RegExp("^" + src + "$", "i");
}

/* Looks up the glossary entry for a rendered tag string (in whatever
   language is currently active) and returns {name, description} with
   "{VAL}" substituted (defaulting to "1" if the tag string omitted the
   number), or null if no glossary entry matches. */
function describeTag(displayTag){
  if(!displayTag || !TAG_PATTERNS) return null;
  for(const {id, re} of TAG_PATTERNS){
    const m = String(displayTag).match(re);
    if(!m) continue;
    const tag = TAGS[id]; if(!tag) continue;
    const val = m[1] || "1";
    return {
      name: String(tag.name).replace(/\{VAL\}/g, val),
      description: String(tag.description).replace(/\{VAL\}/g, val),
    };
  }
  return null;
}
const SRC = {GMS:"var(--gms)","IPS-N":"var(--ipsn)",SSC:"var(--ssc)",HORUS:"var(--horus)",HA:"var(--ha)",EXOTIC:"var(--exotic)"};
const SRC_NAME_EN = {GMS:"GENERAL MASSIVE SYSTEMS","IPS-N":"IPS-NORTHSTAR",SSC:"SMITH-SHIMANO CORPRO",HORUS:"HORUS",HA:"HARRISON ARMORY",EXOTIC:"EXOTIC / UNKNOWN ORIGIN"};
/* SRC_NAME[code] now returns the localized manufacturer name (via enums.json/source_names),
   falling back to English automatically — every other call site (SRC_NAME[x.source]) is untouched. */
const SRC_NAME = new Proxy({}, { get: (_,k) => tr(SRC_NAME_EN[k] || k) });
const srcColor = s => SRC[s]||"var(--line-bright)";
/* Frame portrait — hotlinked to Massif Press's own asset CDN via
   data/frame_images.json (id -> URL), never downloaded/stored locally.
   Returns "" if this frame has no known image (safe to check falsy). */
const frameImageURL = f => (L.frame_images && L.frame_images[f.id]) || "";

/* Short stat label in the interface language (plain text). Where the data
   has its own label (L.stat_labels — data language) callers try that first:
   a game term with a dictionary in the data follows the data (ADR 0005). */
// i18n-dynamic: term.stat.hp, term.stat.armor, term.stat.structure, term.stat.stress, term.stat.heatcap, term.stat.repcap, term.stat.evasion, term.stat.edef, term.stat.speed, term.stat.sensor_range, term.stat.tech_attack, term.stat.save, term.stat.size, term.stat.sp
const statShort = k => tText(`term.stat.${k}`);
/* Stat glossary — from massif-press/lancer-data/lib/glossary.json (data/glossary.json),
   translated via locales/<lang>/glossary.json like everything else. Powers
   the hover-tooltip icon next to each stat label (compcon.app-style). */
/* Per-stat glyph icons (cropped from the COMP/CON-style reference sheet the
   user supplied), shown instead of the generic "i" inside the tooltip
   trigger. Falls back to "ⓘ" for any stat without a matching icon (only
   "size" currently has none). */
const STAT_ICONS = {
  hp: "assets/icons/stat-hp.png",
  armor: "assets/icons/stat-armor.png",
  structure: "assets/icons/stat-structure.png",
  stress: "assets/icons/stat-stress.png",
  heatcap: "assets/icons/stat-heatcap.png",
  repcap: "assets/icons/stat-repcap.png",
  evasion: "assets/icons/stat-evasion.png",
  edef: "assets/icons/stat-edef.png",
  speed: "assets/icons/stat-speed.png",
  sensor_range: "assets/icons/stat-sensor_range.png",
  tech_attack: "assets/icons/stat-tech_attack.png",
  save: "assets/icons/stat-save.png",
  sp: "assets/icons/stat-sp.png",
  size: "assets/icons/stat-size.png",
};

/* Just the hoverable tooltip-icon span for a stat — used standalone by the
   two new bigger stat layouts (statRowHTML / compact HUD tiles). `size`
   picks the CSS size variant (see .stattip.lg in the stylesheet). */
function statIconHTML(k, size){
  const g = L && L.glossary && L.glossary[k];
  const cls = size ? `stattip ${size}` : "stattip";
  if(!g) return `<span class="${cls}" tabindex="0" role="button" aria-label="${t("a11y.help")}">ⓘ</span>`;
  const icon = STAT_ICONS[k] ? `<img class="stattip-icon" src="${STAT_ICONS[k]}" alt="">` : "ⓘ";
  return `<span class="${cls}" tabindex="0" role="button" aria-label="${t("a11y.help_for", {name:g.name})}"
    data-tipname="${esc(g.name)}" data-tipdesc="${esc(g.description)}">${icon}</span>`;
}
function statKeyHTML(k){
  const g = L && L.glossary && L.glossary[k];
  if(!g) return esc(statShort(k));
  return `${esc(statShort(k))}${statIconHTML(k)}`;
}
/* Delegated (registered once, survives re-renders) — shows the stat
   glossary tooltip at a fixed screen position computed from the hovered
   icon's own bounding box, flipping below if there isn't room above. */
(function wireStatTooltips(){
  const box=document.getElementById("global-stattip");
  // The box is a manual popover so it can rise into the top layer: the HUD
  // is a popover sheet on narrow screens, and a plain z-index:1000 box would
  // open underneath it. Each showPopover() lands above whatever is open.
  const lift=on=>{
    try{
      const open=box.matches(":popover-open");
      if(on && !open) box.showPopover();
      else if(!on && open) box.hidePopover();
    }catch(_){} // no Popover API: the z-index fallback still works outside the sheet
  };
  const show=tip=>{
    box.innerHTML = `<b>${tip.dataset.tipname}</b>${tip.dataset.tipdesc}`;
    box.style.display="block";
    lift(true);
    const r=tip.getBoundingClientRect();
    const bw=box.offsetWidth, bh=box.offsetHeight;
    let left=r.left+r.width/2-bw/2;
    left=Math.max(6, Math.min(left, window.innerWidth-bw-6));
    let top=r.top-bh-8;
    if(top<6) top=r.bottom+8;
    box.style.left=left+"px";
    box.style.top=top+"px";
  };
  const hide=()=>{ box.style.display="none"; lift(false); };
  document.addEventListener("mouseover", e=>{
    const tip=e.target.closest(".stattip"); if(!tip) return;
    show(tip);
  });
  document.addEventListener("mouseout", e=>{
    const tip=e.target.closest(".stattip"); if(!tip) return;
    hide();
  });
  document.addEventListener("focus", e=>{
    const tip=e.target.closest && e.target.closest(".stattip"); if(!tip) return;
    show(tip);
  }, true);
  document.addEventListener("blur", e=>{
    const tip=e.target.closest && e.target.closest(".stattip"); if(!tip) return;
    hide();
  }, true);
  document.addEventListener("keydown", e=>{
    if(e.key==="Escape" && box.style.display==="block") hide();
  });
})();
