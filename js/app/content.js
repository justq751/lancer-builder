/* ============ CONTENT SELECTION ============
   Which parts of the official supplements are offered for picking, per pack
   and per category — set apart from each other the way the interface and
   data languages are. Switching something off only takes it out of the
   lists: a build that already uses it keeps working, and so does a share
   link from someone with other settings. The core book is always on.
   Where each item came from: CONTENT_ORIGIN, filled by loadBaseData(). */
const CONTENT_CATEGORIES = ["frames","weapons","systems","mods","talents","pilot_gear","core_bonuses","backgrounds"];
// Product names, not translated. Order: as the packs load (CONTENT_PACKS).
const PACK_TITLES = {
  "osr":"Operation Solstice Rain", "wallflower":"No Room for a Wallflower",
  "ows":"Operation Winter Scar", "long-rim":"The Long Rim", "dustgrave":"Dustgrave",
  "ktb":"Karrakin Trade Baronies", "sotw":"Shadow of the Wolf", "ssmr":"Siren's Song, A Mountain's Remorse",
};
/* A pack not named here offers everything. No Room for a Wallflower is a
   campaign: by default only its frames, the rest is the campaign's to give. */
const CONTENT_DEFAULTS = { "wallflower":["frames"] };
// {packId: [enabled categories]} — only packs the pilot changed.
let contentPrefs = (()=>{
  try{
    const v=JSON.parse(localStorage.getItem("lancer_content")||"null");
    return (v && typeof v==="object" && !Array.isArray(v)) ? v : {};
  }catch(_){ return {}; }
})();
function packCategoriesOn(pack){
  const v = pack in contentPrefs ? contentPrefs[pack] : CONTENT_DEFAULTS[pack];
  return Array.isArray(v) ? v : CONTENT_CATEGORIES;
}
const contentPack = (cat, item) => CONTENT_ORIGIN.get(cat+":"+item.id);
function contentOn(cat, item){
  const pack=contentPack(cat, item);
  return !pack || packCategoriesOn(pack).includes(cat);
}
/* L[cat] as offered for picking; `keep(item)` brings back one the build
   already uses, so a list never hides the pilot's own choice. */
const offered = (cat, keep) => (L[cat]||[]).filter(it=>contentOn(cat, it) || (keep && keep(it)));
function setContentPrefs(next){
  contentPrefs=next;
  try{ localStorage.setItem("lancer_content", JSON.stringify(next)); }catch(_){}
}
function setPackCategory(pack, cat, on){
  const cur=new Set(packCategoriesOn(pack));
  if(on) cur.add(cat); else cur.delete(cat);
  setContentPrefs({...contentPrefs, [pack]:CONTENT_CATEGORIES.filter(c=>cur.has(c))});
}
function setPackAll(pack, on){
  setContentPrefs({...contentPrefs, [pack]:on ? CONTENT_CATEGORIES.slice() : []});
}
/* A license track stays on the Licenses tab while anything it unlocks is
   offered — Long Rim weapons with Long Rim frames switched off still need
   their license — or while the pilot has ranks in it. A variant frame's card
   only adds the variant to its base frame's track (items are licensed to
   the base frame), so it follows the variant alone. */
function licenseOffered(f){
  if(contentOn("frames", f) || state.mech.frameId===f.id) return true;
  if(f.variant) return false;
  if(licRank(f.name)>0) return true;
  return ["weapons","systems","mods"].some(cat=>(L[cat]||[]).some(it=>it.license===f.name && contentOn(cat, it)));
}
/* Build parts that come from content switched off: "Enkidu (frames)". */
const CATEGORY_INDEX = {frames:"frame", weapons:"weapon", systems:"system", mods:"mod",
  talents:"talent", pilot_gear:"gear", core_bonuses:"core", backgrounds:"bg"};
function buildUsesHiddenContent(){
  const out=[];
  const add=(cat,id)=>{
    const it=id && M[CATEGORY_INDEX[cat]][id];
    if(it && !contentOn(cat, it)) out.push({name:cat==="frames"?dispName(it):it.name, cat});
  };
  add("frames", state.mech.frameId);
  (state.mech.mounts||[]).forEach(mt=>(mt.items||[]).forEach(s=>{ add("weapons", s.id); add("mods", s.mod); }));
  (state.mech.systems||[]).forEach(id=>add("systems", id));
  Object.keys(state.talents).forEach(id=>add("talents", id));
  [state.gear.armor, ...state.gear.weapons, ...state.gear.gear].forEach(id=>add("pilot_gear", id));
  state.cores.forEach(id=>add("core_bonuses", id));
  add("backgrounds", state.pilot.background);
  return out;
}

/* The settings: one block per pack, a switch for the whole pack and one per
   category it has (with how many items). */
// i18n-dynamic: content.cat.frames, content.cat.weapons, content.cat.systems, content.cat.mods, content.cat.talents, content.cat.pilot_gear, content.cat.core_bonuses, content.cat.backgrounds
function openContentSettings(){
  const packs=[...new Set(CONTENT_ORIGIN.values())];
  const draw=()=>{
    const counts={};
    CONTENT_ORIGIN.forEach((pack,key)=>{
      const cat=key.slice(0,key.indexOf(":"));
      (counts[pack]=counts[pack]||{})[cat]=(counts[pack][cat]||0)+1;
    });
    const hidden=buildUsesHiddenContent();
    const body=`<div class="content-settings">
      <p class="hint">${t("content.lead")}</p>
      ${packs.map(pack=>{
        const cats=CONTENT_CATEGORIES.filter(c=>counts[pack][c]);
        const on=packCategoriesOn(pack);
        const n=cats.filter(c=>on.includes(c)).length;
        return `<fieldset class="cpack">
          <legend><label><input type="checkbox" data-cpack="${esc(pack)}" ${n===cats.length?"checked":""} ${n&&n<cats.length?'data-mixed="1"':""}>
            <span class="cp-title">${esc(PACK_TITLES[pack]||pack)}</span></label></legend>
          <div class="cp-cats">${cats.map(c=>`<label class="chip ${on.includes(c)?"on":""}">
            <input type="checkbox" data-cpack="${esc(pack)}" data-ccat="${c}" ${on.includes(c)?"checked":""}>
            ${t(`content.cat.${c}`)} <span class="cp-n">${counts[pack][c]}</span></label>`).join("")}</div>
        </fieldset>`;
      }).join("")}
      ${hidden.length?`<div class="warnbox mt-16">${t("content.in_build", {list:hidden.map(h=>`${h.name} (${tText(`content.cat.${h.cat}`)})`).join(", ")})}</div>`:""}
      <div class="dialog-actions"><button class="ghostbtn" id="content-defaults">${t("content.defaults")}</button></div>
    </div>`;
    const mbd=$("#modal .mbd"), scroll=mbd.scrollTop;
    setModalBody(body, true);
    mbd.scrollTop=scroll;
    $$("#modal [data-cpack][data-mixed]").forEach(b=>{ b.indeterminate=true; });
    $$("#modal input[data-cpack]").forEach(b=>b.onchange=()=>{
      if(b.dataset.ccat) setPackCategory(b.dataset.cpack, b.dataset.ccat, b.checked);
      else setPackAll(b.dataset.cpack, b.checked);
      render();
      draw();
      // Same control, redrawn: keep the keyboard where it was.
      const again=$(`#modal input[data-cpack="${b.dataset.cpack}"]${b.dataset.ccat?`[data-ccat="${b.dataset.ccat}"]`:":not([data-ccat])"}`);
      if(again) again.focus();
    });
    $("#content-defaults").onclick=()=>{ setContentPrefs({}); render(); draw(); $("#content-defaults").focus(); };
  };
  modal(tText("content.title"), "");
  draw();
  const first=$("#modal input[data-cpack]");
  if(first) first.focus();
}
