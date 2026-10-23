/* ============ PICKER VIEW MODE (shared: weapon/system/core pickers) ============ */
let pickerViewMode = localStorage.getItem("picker_view_mode") || "inline"; // "inline" default | "card"
function viewToggleHTML(){
  return `<div class="viewtoggle">
    <button class="chip ${pickerViewMode==='inline'?'on':''}" data-vm="inline">☰ ${t("picker.view.inline")}</button>
    <button class="chip ${pickerViewMode==='card'?'on':''}" data-vm="card">▣ ${t("picker.view.card")}</button>
  </div>`;
}
function wireViewToggle(onSwitch){
  $$(".modal [data-vm]").forEach(b=>b.onclick=()=>{
    pickerViewMode=b.dataset.vm;
    localStorage.setItem("picker_view_mode", pickerViewMode);
    onSwitch();
  });
}

/* Weapon detail content without the name/header — used for the inline
   in-list expansion. weaponCardHTML() (below) wraps this with a header for
   standalone modal views (view-installed / card-mode picker). */
/* Multi-stage weapons (e.g. Apocalypse Rail, ZF4 SOLIDCORE) carry a
   "profiles" array — different damage/range/effect depending on a
   charge/die value. profileViewIdx is purely a *display* toggle for
   browsing those stages inside the card; it isn't part of the saved build. */
let profileViewIdx=0;
const profDmgStr = p => (p.damage||[]).map(x=>x.type?`${x.val} ${tr(x.type)}`:`${x.val}`).join(", ")||"—";
const profRngStr = p => (p.range||[]).map(x=>x.type?`${tr(x.type)} ${x.val}`:`${x.val}`).join(", ")||"—";
/* ---- collapsed picker row (weapons + systems) ----------------------------
   Short mono labels for the numeric column. "ДАЛЬНОСТЬ" / "ВЗРЫВНОЙ" blow out
   a 10px label. The short forms have no dictionary in the data, so they are
   interface strings (term.dmg.* / term.rng.*, keyed by the English enum) and
   follow the interface language (ADR 0005); an enum with no short form falls
   back to tr() of the data. */
// i18n-dynamic: term.dmg.Kinetic, term.dmg.Explosive, term.dmg.Energy, term.dmg.Burn, term.dmg.Heat, term.dmg.Variable, term.rng.Range, term.rng.Threat, term.rng.Blast, term.rng.Burst, term.rng.Line, term.rng.Cone
const shortEnum=(kind,ty)=>(UI[`term.${kind}.${ty}`] ? tText(`term.${kind}.${ty}`) : String(tr(ty)||"").toUpperCase());
/* Missing values render as "—" rather than dropping the cell: a vanished cell
   shifts every column after it and the vertical run stops lining up. */
const rowStat=(k,v)=>`<div class="rowstat"><span class="k">${esc(k)}</span><span class="v${v==null||v===""?" none":""}">${v==null||v===""?"—":esc(v)}</span></div>`;
const ROW_TAG_MAX=3;
/* `skip` drops tags that merely repeat the class already printed to their
   left — an AI-type system carries an "AI" tag, and "ИИ · ИИ" is noise. */
function rowTagsHTML(tags, skip){
  const drop=new Set((skip||[]).filter(Boolean).map(s=>String(s).toLowerCase()));
  const list=(tags||[]).map(trTag).filter(tg=>!drop.has(String(tg).toLowerCase()));
  const rest=list.slice(ROW_TAG_MAX);
  return list.slice(0,ROW_TAG_MAX).map(tg=>`<span class="rowtag">${esc(tg)}</span>`).join("")
    + (rest.length?`<span class="rowtag more" title="${esc(rest.join(", "))}">+${rest.length}</span>`:"");
}
/* How a system is used (item.activations — Quick, Protocol, Reaction…, see
   tools/normalize_pack.py): short mono labels, the full name on hover. Like
   the damage/range short forms they have no dictionary in the data, so they
   are interface strings. The tags that only say the same thing ("Quick
   Action") are left off the collapsed row. */
// i18n-dynamic: term.act.Quick, term.act.Full, term.act.QuickTech, term.act.FullTech, term.act.Invade, term.act.Protocol, term.act.Reaction, term.act.Free, term.act_name.Quick, term.act_name.Full, term.act_name.QuickTech, term.act_name.FullTech, term.act_name.Invade, term.act_name.Protocol, term.act_name.Reaction, term.act_name.Free
const ACTIVATION_TAGS = ["Quick Action","Full Action","Quick Tech","Full Tech","Reaction","Protocol","Free Action"];
function actLabelsHTML(item, cls){
  return (item.activations||[]).map(a=>{
    const k=a.replace(/ /g,"");
    return `<span class="${cls} act" title="${esc(tText(`term.act_name.${k}`))}">${t(`term.act.${k}`)}</span>`;
  }).join("");
}
function rowBadgeHTML(item){
  if(!(item.license_level>0)) return "";
  const lk=!unlocked(item);
  return `<span class="rowbadge ${lk?'lock':'unlocked'}">${lk?'🔒':'🔓'} ${esc(licenseDisplayName(item.license))} ${item.license_level}</span>`;
}
/* Multi-stage weapons keep their real numbers in profiles[], so the row shows
   the first stance and says so with a teal chip instead of passing one
   stance's damage off as the weapon's own stat. */
function weaponPickRow(w, open){
  const lk=!unlocked(w);
  const p=(w.profiles&&w.profiles.length)?w.profiles[0]:null;
  const dmgArr=(p&&p.damage&&p.damage.length)?p.damage:(w.damage||[]);
  const rngArr=(p&&p.range&&p.range.length)?p.range:(w.range||[]);
  // Range/Threat is the distance you actually check; Blast/Burst/Line/Cone are
  // area rules, so they read as mechanics on the tag line, not as the number.
  const pri=rngArr.find(r=>r.type==="Range"||r.type==="Threat")||rngArr[0];
  const dmgTypes=[...new Set(dmgArr.map(d=>d.type).filter(Boolean))];
  const chips=(p?`<span class="rowtag stance">${t("picker.stance", {n:w.profiles.length})}</span>`:"")
    + rngArr.filter(r=>r!==pri&&r.type).map(r=>`<span class="rowtag">${esc(trTag(r.type))} ${esc(r.val)}</span>`).join("")
    + (w.sp?`<span class="rowtag sp">${esc(w.sp)} SP</span>`:"");
  return `<div class="listrow pick clickable ${lk?'locked':''} ${open?'open':''}" ${pickRowA11y(open)} data-w="${esc(w.id)}" style="--src:${srcColor(w.source)}">
    <span class="src"></span>
    <div class="info">
      <div class="nmline"><span class="nm">${esc(w.name)}</span>${rowBadgeHTML(w)}</div>
      <div class="clsline"><span class="cls">${esc(tr(w.mount))} · ${esc(tr(w.type))}</span>${chips}${rowTagsHTML(w.tags,[tr(w.mount),tr(w.type)])}</div>
    </div>
    <div class="rowstats">
      ${rowStat(tText("picker.damage")+(dmgTypes.length===1?" · "+shortEnum("dmg",dmgTypes[0]):""), dmgArr.map(d=>d.val).join("+"))}
      ${rowStat(pri&&pri.type?shortEnum("rng",pri.type):tText("term.rng.Range"), pri?pri.val:"")}
    </div>
    <span class="chevron">${open?'⌄':'›'}</span>
  </div>`;
}
/* Picker rows are <div>s (they hold tags/stat blocks a <button> may not), so
   they carry the button semantics themselves; Enter/Space is handled once,
   globally — see the keydown listener next to the modal focus trap. */
const pickRowA11y = open => `role="button" tabindex="0" aria-expanded="${open?"true":"false"}"`;
function systemPickRow(s, open){
  const lk=!unlocked(s);
  return `<div class="listrow pick clickable ${lk?'locked':''} ${open?'open':''}" ${pickRowA11y(open)} data-s="${esc(s.id)}" style="--src:${srcColor(s.source)}">
    <span class="src"></span>
    <div class="info">
      <div class="nmline"><span class="nm">${esc(s.name)}</span>${rowBadgeHTML(s)}</div>
      <div class="clsline"><span class="cls">${esc(tr(s.type))}</span>${actLabelsHTML(s,"rowtag")}${rowTagsHTML(s.tags,[tr(s.type), ...ACTIVATION_TAGS.map(trTag)])}</div>
    </div>
    <div class="rowstats">${rowStat("SP", s.sp)}</div>
    <span class="chevron">${open?'⌄':'›'}</span>
  </div>`;
}
function wireProfileChips(sel, redraw, setIdx){
  setIdx = setIdx || (v=>{profileViewIdx=v;});
  $$(`${sel} .profile-chip`).forEach(b=>b.onclick=()=>{ setIdx(+b.dataset.pi); redraw(); });
}

/* `uid`, when given, namespaces the internal element ids (so several of
   these can be expanded on the same page at once — e.g. several equipped
   weapons in the loadout tab) and `curProfIdx` lets the caller supply its
   own per-instance "which stage is shown" value instead of the shared
   global (used by the single-instance modals/pickers). */
/* Combines base weapon tags with the active profile's own tags (some
   multi-stage weapons, like the Leviathan HAC, only carry certain tags in
   specific modes) into one array — used for both rendering the chips and
   as the `rawTags` index base for wireTagGlossary, so data-tgi stays
   consistent between the two. */
/* Merges a mod's added_tags/added_range/added_damage onto a weapon for
   DISPLAY purposes only — returns a new object, never mutates M.weapon[id]
   (the same base weapon may be equipped elsewhere unmodified). This is the
   "simple, mechanically apply-able" half of a mod's effect; anything more
   involved (on_hit, reroll/reposition mechanics, etc.) stays as text the
   pilot reads and applies manually, same as every other rich-text effect
   in this app — nothing here simulates dice or turn-order logic. */
function effectiveWeapon(w, mod){
  if(!mod) return w;
  return {
    ...w,
    tags: [...(w.tags||[]), ...(mod.added_tags||[])],
    range: mod.added_range?.length ? [...(w.range||[]), ...mod.added_range] : (w.range||[]),
    damage: mod.added_damage?.length ? [...(w.damage||[]), ...mod.added_damage] : (w.damage||[]),
  };
}
function weaponDisplayTags(w, curProfIdx){
  const hasProfiles = w.profiles && w.profiles.length;
  if(!hasProfiles) return w.tags||[];
  const idx = Math.min(curProfIdx!=null?curProfIdx:profileViewIdx, w.profiles.length-1);
  const prof = w.profiles[idx];
  return [...(w.tags||[]), ...((prof&&prof.tags)||[])];
}
/* Default unarmored pilot stats (Lancer core rules) — Armor-type pilot_gear
   overrides some of these via its bonuses[] array. Each bonus entry has an
   id (pilot_armor/pilot_hp/pilot_evasion/pilot_edef/pilot_speed), a val,
   and sometimes replace:true (the value REPLACES the base stat rather than
   adding to it — used for Evasion/E-Defense/Speed, since hardsuits set a
   fixed value rather than stacking). HP never replaces, only adds (shown
   as a "+N" bonus rather than an absolute total, matching the reference
   layout). A handful of items (e.g. the Madrigal boarding carapace) use a
   formula string like "7 + {grit}" instead of a plain number — those are
   shown as-is rather than evaluated, since this card has no pilot context. */
const PILOT_BASE_STATS = {armor:0, evasion:10, edef:10, speed:4};
const PILOT_BONUS_KEY = {pilot_armor:"armor", pilot_hp:"hp", pilot_evasion:"evasion", pilot_edef:"edef", pilot_speed:"speed"};
function pilotGearStatValues(g){
  const out = {...PILOT_BASE_STATS, hp:0};
  (g.bonuses||[]).forEach(b=>{
    const key = PILOT_BONUS_KEY[b.id];
    if(!key) return;
    if(key==="hp"){ out.hp = (typeof b.val==="number" && typeof out.hp==="number") ? out.hp+b.val : b.val; return; }
    if(b.replace) out[key] = b.val;
    else out[key] = (typeof b.val==="number" && typeof out[key]==="number") ? out[key]+b.val : b.val;
  });
  return out;
}
/* Compact one-line version of pilotGearStatsHTML() for the picker's list
   row (no room there for the full tile grid) — same icon+value pairs,
   just inline text instead of boxes. */
/* Armour and E-Defense used to be 🛡 and 🛡️ — the same shield twice, told
   apart only by a variation selector, which is to say not told apart at all.
   The product already ships drawn icons for these stats; use them, and let
   the label do the naming where no icon exists. */
const pgIcon = k => STAT_ICONS[k]
  ? `<img class="pgicon" src="${STAT_ICONS[k]}" alt="" loading="lazy">` : "";
function pilotGearStatsInlineHTML(g){
  const s = pilotGearStatValues(g);
  return t("picker.gear_stats", {armor:s.armor, hp:s.hp, edef:s.edef, evasion:s.evasion, speed:s.speed});
}
function pilotGearStatsHTML(g){
  if(g.type!=="Armor" || !(g.bonuses&&g.bonuses.length)) return "";
  const s = pilotGearStatValues(g);
  const tile=(k,lbl,val)=>`<div class="stattile pg"><div class="ico">${pgIcon(k)}</div><div class="lbl">${lbl}</div><div class="val">${esc(String(val))}</div></div>`;
  return `<div class="pgstats">
    ${tile("armor",t("picker.gear.armor"),s.armor)}
    ${tile("hp",t("picker.gear.hp"),"+"+s.hp)}
    ${tile("edef",t("picker.gear.edef"),s.edef)}
    ${tile("evasion",t("picker.gear.evasion"),s.evasion)}
    ${tile("speed",t("picker.gear.speed"),s.speed)}
  </div>`;
}
/* Pilot gear card — same shape as weaponCardBody/systemCardBody, but pilot
   gear has no license (Lancer's own rules don't gate pilot loadout by
   license) and no profiles, so this is the simple subset of that pattern:
   tags row (with damage/range for Weapon-type gear) + effect text. */
function pilotGearCardBody(g, uid){
  const tagsId = uid?`pg-tags-${uid}`:"pg-tags", descId = uid?`pg-tagdesc-${uid}`:"pg-tagdesc";
  const hasStats = (g.damage&&g.damage.length) || (g.range&&g.range.length);
  return `${pilotGearStatsHTML(g)}<div class="tags" id="${tagsId}">
      ${g.damage&&g.damage.length?`<span class="tag dmg">${dmgStr(g)}</span>`:""}
      ${g.range&&g.range.length?`<span class="tag rng">${rngStr(g)}</span>`:""}
      ${(g.tags||[]).map((tg,i)=>`<button type="button" class="tag glossary" data-tgi="${i}" aria-expanded="false">${esc(trTag(tg))}</button>`).join("")}
    </div>
    <div id="${descId}"></div>
    ${g.effect?`<div class="desc" style="margin-top:${hasStats?12:0}px">${rich(g.effect)}</div>`:""}
    ${g.description?`<div class="desc" style="margin-top:9px; font-style:italic">${rich(g.description)}</div>`:""}`;
}
function pilotGearCardHTML(g){
  return `<div class="item static">
    <div class="src" style="background:var(--line-bright)"></div>
    <div class="top"><div class="nm" style="font-size:21px">${esc(g.name)}</div>
      <div class="badge">${tr(g.type)}</div></div>
    <div style="margin-top:11px">${pilotGearCardBody(g)}</div>
  </div>`;
}

function weaponCardBody(w, uid, curProfIdx){
  const tagsId = uid?`wp-tags-${uid}`:"wp-tags", descId = uid?`wp-tagdesc-${uid}`:"wp-tagdesc", profId = uid?`wp-profiles-${uid}`:"wp-profiles";
  const hasProfiles = w.profiles && w.profiles.length;
  const curIdx = curProfIdx!=null ? curProfIdx : profileViewIdx;
  const idx = hasProfiles ? Math.min(curIdx, w.profiles.length-1) : -1;
  const prof = hasProfiles ? w.profiles[idx] : null;
  const dmg = prof ? profDmgStr(prof) : dmgStr(w);
  const rng = prof ? profRngStr(prof) : rngStr(w);
  const dispTags = weaponDisplayTags(w, curIdx);
  return `${hasProfiles?`<div class="profiles" id="${profId}">${w.profiles.map((p,i)=>
      `<button class="chip profile-chip ${i===idx?'on':''}" data-pi="${i}">${esc(p.name)}</button>`).join("")}</div>`:""}
    <div class="tags" id="${tagsId}">
      <span class="tag dmg">${dmg}</span><span class="tag rng">${rng}</span>
      ${w.sp?`<span class="tag sp">${w.sp} SP</span>`:""}
      ${dispTags.map((tg,i)=>`<button type="button" class="tag glossary" data-tgi="${i}" aria-expanded="false">${esc(trTag(tg))}</button>`).join("")}
    </div>
    <div id="${descId}"></div>
    ${w.effect?`<div class="desc" style="margin-top:12px">${rich(w.effect)}</div>`:""}
    ${prof && prof.effect?`<div class="desc" style="margin-top:9px"><b>${esc(prof.name)}:</b> ${rich(prof.effect)}</div>`:""}
    ${w.on_attack?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_attack")}</b> ${rich(onHitText(w.on_attack))}</div>`:""}
    ${w.on_hit?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_hit")}</b> ${rich(onHitText(w.on_hit))}</div>`:""}
    ${w.on_crit?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_crit")}</b> ${rich(onHitText(w.on_crit))}</div>`:""}
    ${prof && prof.on_attack?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_attack_p", {name:prof.name})}</b> ${rich(onHitText(prof.on_attack))}</div>`:""}
    ${prof && prof.on_hit?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_hit_p", {name:prof.name})}</b> ${rich(onHitText(prof.on_hit))}</div>`:""}
    ${prof && prof.on_crit?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_crit_p", {name:prof.name})}</b> ${rich(onHitText(prof.on_crit))}</div>`:""}`;
}
function weaponCardHTML(w){
  const badge=licenseBadge(w, tr(w.mount));
  return `<div class="item static">
    <div class="src" style="background:${srcColor(w.source)}"></div>
    <div class="top"><div class="nm" style="font-size:21px">${esc(w.name)}</div>
      <div class="badge ${badge.cls}">${badge.text}</div></div>
    <div class="meta" style="margin-top:6px">${tr(w.mount)} · ${tr(w.type)}${w.source?" · "+esc(w.source):""}</div>
    <div style="margin-top:11px">${weaponCardBody(w)}</div>
  </div>`;
}

/* Full system detail card markup, shared by the system picker's detail view
   and the "view installed system" modal opened from the loadout list. */
/* Same split as weaponCardBody/weaponCardHTML, for systems. `uid` namespaces
   ids the same way as weaponCardBody, for independently-expandable rows. */
function systemCardBody(s, uid){
  const tagsId = uid?`sy-tags-${uid}`:"sy-tags", descId = uid?`sy-tagdesc-${uid}`:"sy-tagdesc";
  return `<div class="tags" id="${tagsId}">
      <span class="tag sp">${s.sp} SP</span>${actLabelsHTML(s,"tag")}
      ${(s.tags||[]).map((tg,i)=>`<button type="button" class="tag glossary" data-tgi="${i}" aria-expanded="false">${esc(trTag(tg))}</button>`).join("")}
    </div>
    <div id="${descId}"></div>
    ${s.description?`<div class="desc" style="margin-top:12px">${rich(s.description)}</div>`:""}
    ${s.effect?`<div class="desc" style="margin-top:9px">${rich(s.effect)}</div>`:""}`;
}
function systemCardHTML(s){
  const badge=licenseBadge(s, tr(s.type));
  return `<div class="item static">
    <div class="src" style="background:${srcColor(s.source)}"></div>
    <div class="top"><div class="nm" style="font-size:21px">${esc(s.name)}</div>
      <div class="badge ${badge.cls}">${badge.text}</div></div>
    <div class="meta" style="margin-top:6px">${esc(tr(s.type))}${s.source?" · "+esc(s.source):""}</div>
    <div style="margin-top:11px">${systemCardBody(s)}</div>
  </div>`;
}

/* A mod is compatible with a weapon if the weapon's TYPE (Rifle, Melee, …)
   is in the mod's allowed_types, and the weapon's MOUNT size isn't one of
   the mod's restricted_sizes (e.g. UNCLE-Class Comp/Con can't go on
   Superheavy weapons). */
function modCompatible(mod, w){
  return (mod.allowed_types||[]).includes(w.type) && !(mod.restricted_sizes||[]).includes(w.mount);
}
/* Mod detail body — same shape as systemCardBody/weaponCardBody. Shows the
   SP cost, the mod's own tags, and — when present — a one-line summary of
   the "simple" stat changes (added_tags/added_range/added_damage) that
   effectiveWeapon() actually applies to the equipped weapon's display,
   followed by the full effect text (and on_hit/on_attack/on_crit, same
   pattern as weapons) for everything else the pilot has to apply by hand. */
function modCardBody(mod, uid){
  const tagsId = uid?`md-tags-${uid}`:"md-tags", descId = uid?`md-tagdesc-${uid}`:"md-tagdesc";
  const statBits = [
    mod.added_range?.length ? mod.added_range.map(r=>`+${r.val} ${tr(r.type)}`).join(", ") : "",
    mod.added_damage?.length ? mod.added_damage.map(d=>`+${d.val} ${tr(d.type)}`).join(", ") : "",
    mod.added_tags?.length ? mod.added_tags.map(tg=>trTag(tg)).join(", ") : "",
  ].filter(Boolean).join(" · ");
  return `<div class="tags" id="${tagsId}">
      <span class="tag sp">${mod.sp||0} SP</span>
      ${(mod.tags||[]).map((tg,i)=>`<button type="button" class="tag glossary" data-tgi="${i}" aria-expanded="false">${esc(trTag(tg))}</button>`).join("")}
    </div>
    <div id="${descId}"></div>
    ${statBits?`<div class="desc" style="margin-top:10px"><b>${t("picker.mod_stats")}</b> ${esc(statBits)}</div>`:""}
    ${mod.effect?`<div class="desc" style="margin-top:9px">${rich(mod.effect)}</div>`:""}
    ${mod.on_attack?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_attack")}</b> ${rich(onHitText(mod.on_attack))}</div>`:""}
    ${mod.on_hit?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_hit")}</b> ${rich(onHitText(mod.on_hit))}</div>`:""}
    ${mod.on_crit?`<div class="desc" style="margin-top:9px"><b>${t("picker.on_crit")}</b> ${rich(onHitText(mod.on_crit))}</div>`:""}`;
}
function modCardHTML(mod){
  const badge=licenseBadge(mod, esc(mod.source));
  return `<div class="item static">
    <div class="src" style="background:${srcColor(mod.source)}"></div>
    <div class="top"><div class="nm" style="font-size:21px">${esc(mod.name)}</div>
      <div class="badge ${badge.cls}">${badge.text}</div></div>
    <div class="meta" style="margin-top:6px">${t("picker.mod_mounts", {list:(mod.allowed_types||[]).map(tr).join(" / ")})}</div>
    <div style="margin-top:11px">${modCardBody(mod)}</div>
  </div>`;
}

/* Opens a read-only-ish detail card for an already-installed weapon, with a
   button to remove it from its mount — triggered by clicking the equipped
   slot in the loadout tab. */



/* weapon picker — inline-expand list (default) or separate detail card,
   toggled via viewToggleHTML()/wireViewToggle(). */
let wpSearch="", wpFilter="ALL", wpSizeFilter="ALL", wpTypeFilter="ALL", wpDmgFilter="ALL", wpExpanded=null;
let pgExpanded=null; // pilot-gear picker: "mi:wi"-style expand state, but keyed by slot type + index
let pilotGearOpenSet=new Set(); // separate from eqWeaponExpanded — that Set is cleaned up by renderLoadout's own loop, which would wrongly delete pilot-gear keys
/* ---- SP over the cap -------------------------------------------------------
   Going over the SP cap is allowed (the sheet flags it), but never by
   accident: an install that would overspend first swaps the picker's body for
   a confirmation. "Back" returns to the picker where it was — same list, same
   scroll, focus on the install button. A license lock on the same item is
   named in the same step, so one confirmation covers both. `extraSp` is what
   the install adds (for a mod replacing another one, the difference). */
function installWithSpCheck(item, extraSp, install, back){
  const d=derived();
  const after=d.sp.used+(extraSp||0);
  if(!d.mech || !(extraSp>0) || after<=d.sp.cap){ install(); return; }
  const h3=$("#modal .mhd h3"), title=h3.textContent;
  const scroll=$("#modal .mbd").scrollTop;
  h3.textContent=tText("sp_over.title");
  $("#modal .panel").classList.add("narrow"); // the dialog shell, as confirmDialog()
  const lk=!unlocked(item);
  setModalBody(`<div class="dialog">
    <p>${t("sp_over.lead", {name:item.name, sp:extraSp, used:after, cap:d.sp.cap, n:after-d.sp.cap})}</p>
    ${lk?`<ul class="losslist"><li class="drop">${t("sp_over.locked", {license:licenseDisplayName(item.license), rank:item.license_level})}</li></ul>`:""}
    <div class="dialog-actions">
      <button class="ghostbtn warn" id="sp-over-yes">⚠ ${t("sp_over.install")}</button>
      <button class="ghostbtn" id="sp-over-back">← ${t("picker.back")}</button>
    </div>
  </div>`);
  const restore=()=>{
    h3.textContent=title; $("#modal .panel").classList.remove("narrow");
    back(); $("#modal .mbd").scrollTop=scroll;
  };
  $("#sp-over-yes").focus();
  // The picker is put back first: an install that keeps the picker open (the
  // system picker does) finds its list as the person left it.
  $("#sp-over-yes").onclick=()=>{ restore(); install(); };
  $("#sp-over-back").onclick=()=>{
    restore();
    const again=$("#modal .mbd [id$='-install-inline'], #modal .mbd [id$='-install']");
    if(again) again.focus();
  };
}
function openWeaponPicker(mi){
  const mt=state.mech.mounts[mi];
  const allow=mountAllows(state.mech.mounts, mi);
  wpSearch=""; wpFilter="ALL"; wpSizeFilter="ALL"; wpTypeFilter="ALL"; wpDmgFilter="ALL"; wpExpanded=null;

  // A superheavy weapon also takes a second mount — chosen here, after the SP check.
  const install=(id, back)=>installWithSpCheck(M.weapon[id], M.weapon[id].sp, ()=>{
    const w=M.weapon[id], mounts=state.mech.mounts;
    const put=xi=>{
      mounts[mi].items.push({id, mod:null});
      if(xi!==undefined) claimExtraMount(mounts, mi, mounts[mi].items.length-1, xi);
      closeModal(); render();
    };
    if(w.mount==="Superheavy") chooseExtraMount(mounts, mi, w.name, put, back); else put();
  }, back);

  const drawDetail=(id)=>{
    const w=M.weapon[id], lk=!unlocked(w);
    tagOpenSet=new Set(); profileViewIdx=0;
    $("#modal .mhd h3").textContent=w.name;
    setModalBody(
      `<button class="ghostbtn mb-14" id="wp-back">← ${t("picker.back")}</button>`
      + weaponCardHTML(w) +
      `<button class="ghostbtn block mt-16" id="wp-install">
        ${lk?"⚠ "+t("picker.install_anyway"):"✓ "+t("picker.install_weapon")}
      </button>`);
    wireTagGlossary("#wp-tags", "#wp-tagdesc", weaponDisplayTags(w, profileViewIdx));
    wireProfileChips("#wp-profiles", ()=>drawDetail(id));
    $("#wp-back").onclick=drawList;
    $("#wp-install").onclick=()=>install(w.id, ()=>drawDetail(id));
  };

  const drawList=(keepScroll)=>{
    const mbd=$("#modal .mbd");
    const savedScroll = keepScroll ? mbd.scrollTop : null;
    const base=offered("weapons").filter(w=>allow.includes(w.mount) && w.type!=="???" && w.source)
      .filter(w=>wpFilter==="ALL"?w.source!=="EXOTIC":w.source===wpFilter);
    // Facet options are derived from `base` (post mount-size + source, pre
    // everything else) and intentionally don't narrow each other further —
    // picking a type filter won't shrink the damage-type chip row, mirroring
    // how the source chips already behave. Keeps chips from disappearing
    // out from under the user mid-selection.
    const typeOptions=[...new Set(base.map(w=>w.type))].sort();
    const dmgOptions=[...new Set(base.flatMap(weaponDamageTypes))].sort();
    const list=base
      .filter(w=>wpSizeFilter==="ALL"||w.mount===wpSizeFilter)
      .filter(w=>wpTypeFilter==="ALL"||w.type===wpTypeFilter)
      .filter(w=>wpDmgFilter==="ALL"||weaponDamageTypes(w).includes(wpDmgFilter))
      .filter(w=>!wpSearch||(w.name+" "+tr(w.type)+" "+w.source+" "+(w.tags||[]).map(trTag).join(" ")).toLowerCase().includes(wpSearch.toLowerCase()))
      .sort(pickerOrder);
    $("#modal .mhd h3").textContent=tText("picker.weapon_title", {mount:tr(mt.type)});
    setModalBody(
      `<div class="hint" style="margin-bottom:10px">${t("picker.allowed_size", {list:allow.map(tr).join(" / ")})}</div>
       ${viewToggleHTML()}
       <div class="picker-filters">
         <div class="filter-row"><span class="filter-lbl">${t("picker.f.maker")}</span>
           <div class="filters">${["ALL","GMS","IPS-N","SSC","HORUS","HA","EXOTIC"].map(s=>`<button class="chip ${wpFilter===s?'on':''}" data-wpf="${s}">${s==="ALL"?t("common.all"):s}</button>`).join("")}</div></div>
         ${allow.length>1?`<div class="filter-row"><span class="filter-lbl">${t("picker.f.mount")}</span>
           <div class="filters">${["ALL",...allow].map(sz=>`<button class="chip ${wpSizeFilter===sz?'on':''}" data-wpsz="${sz}">${sz==="ALL"?t("common.all"):tr(sz)}</button>`).join("")}</div></div>`:""}
         <div class="filter-row"><span class="filter-lbl">${t("picker.f.type")}</span>
           <div class="filters">${["ALL",...typeOptions].map(ty=>`<button class="chip ${wpTypeFilter===ty?'on':''}" data-wpty="${ty}">${ty==="ALL"?t("common.all"):tr(ty)}</button>`).join("")}</div></div>
         <div class="filter-row"><span class="filter-lbl">${t("picker.f.damage")}</span>
           <div class="filters">${["ALL",...dmgOptions].map(d=>`<button class="chip ${wpDmgFilter===d?'on':''}" data-wpdm="${d}">${d==="ALL"?t("common.all"):tr(d)}</button>`).join("")}</div></div>
       </div>
       <input class="input" id="wp-search" aria-label="${t("picker.search.weapons")}" placeholder="${t("picker.search.weapons_ph")}" style="margin-bottom:14px" value="${esc(wpSearch)}">
       <div class="grid" id="wp-list" style="gap:8px"></div>`, keepScroll);
    $("#wp-list").innerHTML=list.map((w,_i)=>{
      const lk=!unlocked(w);
      const open=pickerViewMode==="inline" && wpExpanded===w.id;
      const row=weaponPickRow(w, open);
      const expand=open?`<div class="expand-detail">${weaponCardBody(w)}
        <button class="ghostbtn block mt-14" id="wp-install-inline">
          ${lk?"⚠ "+t("picker.install_anyway"):"✓ "+t("picker.install_weapon")}
        </button></div>`:"";
      return dividerBefore(list,_i)+`<div class="pickitem">${row}${expand}</div>`;
    }).join("")||`<div class="hint">${t("picker.no_weapons")}</div>`;
    if(savedScroll!==null) mbd.scrollTop=savedScroll;

    wireViewToggle(drawList);
    $$(".modal .chip[data-wpf]").forEach(c=>c.onclick=()=>{wpFilter=c.dataset.wpf; drawList();});
    $$(".modal .chip[data-wpsz]").forEach(c=>c.onclick=()=>{wpSizeFilter=c.dataset.wpsz; drawList();});
    $$(".modal .chip[data-wpty]").forEach(c=>c.onclick=()=>{wpTypeFilter=c.dataset.wpty; drawList();});
    $$(".modal .chip[data-wpdm]").forEach(c=>c.onclick=()=>{wpDmgFilter=c.dataset.wpdm; drawList();});
    const input=$("#wp-search");
    input.oninput=e=>{ const pos=e.target.selectionStart; wpSearch=e.target.value; drawList(); restoreCaret("#wp-search", pos); };
    if(wpSearch) input.setSelectionRange(input.value.length,input.value.length);

    $$("#wp-list .listrow").forEach(it=>it.onclick=()=>{
      const id=it.dataset.w;
      if(pickerViewMode==="card"){ drawDetail(id); return; }
      wpExpanded = wpExpanded===id?null:id;
      tagOpenSet=new Set(); profileViewIdx=0;
      drawList(true);
    });
    if(pickerViewMode==="inline" && wpExpanded){
      const w=M.weapon[wpExpanded];
      wireTagGlossary("#wp-tags", "#wp-tagdesc", weaponDisplayTags(w, profileViewIdx));
      wireProfileChips("#wp-profiles", ()=>drawList(true));
      $("#wp-install-inline").onclick=()=>install(w.id, ()=>drawList());
    }
  };

  modal(tText("picker.weapon_title", {mount:tr(mt.type)}), "");
  drawList();
}

/* Restores a frame's integrated weapon after it was removed from its
   Integrated mount. Uses the exact same list→detail flow as the normal
   weapon picker (view toggle, inline expand, tag glossary, profile
   switching all work identically) — the only difference is the list
   contains exactly one weapon: the one built into this frame. */
/* Pilot gear picker — one shared function for all three slot kinds (armor/
   weapon/gear), filtered by pilot_gear's own "type" field. No license gate
   (pilot loadout isn't license-restricted in Lancer) and no profiles, so
   this is simpler than openWeaponPicker: just a searchable list -> install.
   `slotKind` is "Armor"|"Weapon"|"Gear"; `onInstall(id)` does the actual
   state write for whichever of the three arrays/slot it came from. */
function openPilotGearPicker(slotKind, onInstall){
  pgExpanded=null;
  let pgSearch="";

  const install=id=>{ onInstall(id); closeModal(); render(); };

  const drawDetail=(id)=>{
    const g=M.gear[id];
    setModalBody(
      `<button class="ghostbtn mb-14" id="pg-back">← ${t("picker.back")}</button>`
      + pilotGearCardHTML(g) +
      `<button class="ghostbtn block mt-16" id="pg-install">✓ ${t("picker.install_gear")}</button>`);
    wireTagGlossary("#pg-tags", "#pg-tagdesc", g.tags||[]);
    $("#pg-back").onclick=drawList;
    $("#pg-install").onclick=()=>install(g.id);
  };

  const drawList=(keepScroll)=>{
    const mbd=$("#modal .mbd");
    const savedScroll = keepScroll ? mbd.scrollTop : null;
    const list=offered("pilot_gear").filter(g=>g.type===slotKind && !(g.tags||[]).includes("Exotic Gear"))
      .filter(g=>!pgSearch||(g.name+" "+(g.tags||[]).map(trTag).join(" ")).toLowerCase().includes(pgSearch.toLowerCase()))
      .sort((a,b)=>a.name.localeCompare(b.name));
    // i18n-dynamic: picker.gear_title.Armor, picker.gear_title.Weapon, picker.gear_title.Gear
    $("#modal .mhd h3").textContent=tText(`picker.gear_title.${slotKind}`);
    setModalBody(
      `<input class="input" id="pg-search" aria-label="${t("picker.search.gear")}" placeholder="${t("picker.search.gear_ph")}" style="margin-bottom:14px" value="${esc(pgSearch)}">
       <div class="grid" id="pg-list" style="gap:8px"></div>`, keepScroll);
    $("#pg-list").innerHTML=list.map(g=>{
      const open=pgExpanded===g.id;
      const hasArmorStats = g.type==="Armor" && g.bonuses && g.bonuses.length;
      const hint = g.damage||g.range ? `${dmgStr(g)} · ${rngStr(g)}` : hasArmorStats ? pilotGearStatsInlineHTML(g) : tr(g.type);
      const row=`<div class="listrow clickable ${open?'open':''}" ${pickRowA11y(open)} data-g="${g.id}">
        <div class="info"><div class="nm">${esc(g.name)}</div><div class="ds">${hint}</div></div>
        <span class="chevron">${open?'⌄':'›'}</span>
      </div>`;
      const expand=open?`<div class="expand-detail">${pilotGearCardBody(g)}
        <button class="ghostbtn block mt-14" id="pg-install-inline">✓ ${t("picker.install_gear")}</button></div>`:"";
      // Pilot gear has no licence gate in Lancer's rules, so nothing to divide.
      return `<div class="pickitem">${row}${expand}</div>`;
    }).join("")||`<div class="hint">${t("picker.no_gear")}</div>`;
    if(savedScroll!==null) mbd.scrollTop=savedScroll;

    const input=$("#pg-search");
    input.oninput=e=>{ const pos=e.target.selectionStart; pgSearch=e.target.value; drawList(true); restoreCaret("#pg-search", pos); };
    if(pgSearch) input.setSelectionRange(input.value.length,input.value.length);

    $$("#pg-list .listrow").forEach(it=>it.onclick=()=>{
      const id=it.dataset.g;
      pgExpanded = pgExpanded===id?null:id;
      drawList(true);
    });
    if(pgExpanded){
      const g=M.gear[pgExpanded];
      wireTagGlossary("#pg-tags", "#pg-tagdesc", g.tags||[]);
      $("#pg-install-inline").onclick=()=>install(g.id);
    }
  };

  modal("", "");
  drawList();
}

function openIntegratedPicker(mi){
  const mt=state.mech.mounts[mi];
  const w=M.weapon[FRAME_INTEGRATED_WEAPON[state.mech.frameId]];
  wpExpanded=null;

  const install=()=>{ mt.items=[{id:w.id, mod:null}]; closeModal(); render(); };

  const drawDetail=()=>{
    tagOpenSet=new Set(); profileViewIdx=0;
    $("#modal .mhd h3").textContent=w.name;
    setModalBody(
      `<button class="ghostbtn mb-14" id="wp-back">← ${t("picker.back")}</button>`
      + weaponCardHTML(w) +
      `<button class="ghostbtn block mt-16" id="wp-install">✓ ${t("picker.restore_weapon")}</button>`);
    wireTagGlossary("#wp-tags", "#wp-tagdesc", weaponDisplayTags(w, profileViewIdx));
    wireProfileChips("#wp-profiles", drawDetail);
    $("#wp-back").onclick=drawList;
    $("#wp-install").onclick=install;
  };

  const drawList=(keepScroll)=>{
    const mbd=$("#modal .mbd");
    const savedScroll = keepScroll ? mbd.scrollTop : null;
    const open=pickerViewMode==="inline" && wpExpanded===w.id;
    $("#modal .mhd h3").textContent=tText("picker.restore_title");
    setModalBody(
      `<div class="hint" style="margin-bottom:10px">${t("picker.restore_hint")}</div>
       ${viewToggleHTML()}
       <div class="grid" id="wp-list" style="gap:8px"></div>`, keepScroll);
    const row=weaponPickRow(w, open);
    const expand=open?`<div class="expand-detail">${weaponCardBody(w)}
      <button class="ghostbtn block mt-14" id="wp-install-inline">✓ ${t("picker.restore_weapon")}</button></div>`:"";
    $("#wp-list").innerHTML=`<div class="pickitem">${row}${expand}</div>`;
    if(savedScroll!==null) mbd.scrollTop=savedScroll;

    wireViewToggle(drawList);
    $$("#wp-list .listrow").forEach(it=>it.onclick=()=>{
      if(pickerViewMode==="card"){ drawDetail(); return; }
      wpExpanded = wpExpanded===w.id?null:w.id;
      tagOpenSet=new Set(); profileViewIdx=0;
      drawList(true);
    });
    if(pickerViewMode==="inline" && wpExpanded){
      wireTagGlossary("#wp-tags", "#wp-tagdesc", weaponDisplayTags(w, profileViewIdx));
      wireProfileChips("#wp-profiles", ()=>drawList(true));
      $("#wp-install-inline").onclick=install;
    }
  };

  modal(tText("picker.restore_title"), "");
  drawList();
}

/* Mod picker for one equipped weapon slot — list of mods whose allowed_types
   includes this weapon's type and whose restricted_sizes doesn't exclude
   its mount. Flat inline-expand list (mods have no profiles/stances to
   switch between, so the fuller weapon-picker machinery isn't needed). */
let mpFilter="ALL", mpSearch="", mpExpanded=null;
function openModPicker(mi, wi){
  const slot=state.mech.mounts[mi].items[wi], w=M.weapon[slot.id];
  mpFilter="ALL"; mpSearch=""; mpExpanded=null;

  const install=(id, back)=>{
    const prev=slot.mod && M.mod[slot.mod];
    installWithSpCheck(M.mod[id], (M.mod[id].sp||0)-((prev&&prev.sp)||0),
      ()=>{ slot.mod=id; closeModal(); render(); }, back);
  };

  const drawDetail=(id)=>{
    const m=M.mod[id], lk=!unlocked(m);
    tagOpenSet=new Set();
    $("#modal .mhd h3").textContent=m.name;
    setModalBody(
      `<button class="ghostbtn mb-14" id="mp-back">← ${t("picker.back")}</button>`
      + modCardHTML(m) +
      `<button class="ghostbtn ${lk?'warn':''} block mt-16" id="mp-install">
        ${lk?"⚠ "+t("picker.install_anyway"):"✓ "+t("picker.install_mod")}
      </button>`);
    wireTagGlossary("#md-tags", "#md-tagdesc", m.tags||[]);
    $("#mp-back").onclick=drawList;
    $("#mp-install").onclick=()=>install(m.id, ()=>drawDetail(id));
  };

  const drawList=(keepScroll)=>{
    const mbd=$("#modal .mbd");
    const savedScroll = keepScroll ? mbd.scrollTop : null;
    const list=offered("mods").filter(m=>modCompatible(m,w))
      .filter(m=>mpFilter==="ALL"?m.source!=="EXOTIC":m.source===mpFilter)
      .filter(m=>!mpSearch||(m.name+" "+m.source+" "+(m.tags||[]).map(trTag).join(" ")).toLowerCase().includes(mpSearch.toLowerCase()))
      .sort(pickerOrder);
    $("#modal .mhd h3").textContent=tText("picker.mod_title", {name:w.name});
    setModalBody(
      `<div class="hint" style="margin-bottom:10px">${t("picker.mod_compat", {type:tr(w.type)})}</div>
       ${viewToggleHTML()}
       <div class="filters">${["ALL","GMS","IPS-N","SSC","HORUS","HA","EXOTIC"].map(s=>`<button class="chip ${mpFilter===s?'on':''}" data-mpf="${s}">${s==="ALL"?t("common.all"):s}</button>`).join("")}</div>
       <input class="input" id="mp-search" aria-label="${t("picker.search.mods")}" placeholder="${t("picker.search.mods_ph")}" style="margin-bottom:14px" value="${esc(mpSearch)}">
       <div class="grid" id="mp-list" style="gap:8px"></div>`, keepScroll);
    $("#mp-list").innerHTML=list.map((m,_i)=>{
      const lk=!unlocked(m);
      const open=pickerViewMode==="inline" && mpExpanded===m.id;
      const row=`<div class="listrow clickable ${lk?'locked':''} ${open?'open':''}" ${pickRowA11y(open)} data-m="${m.id}">
        <div class="info"><div class="nm">${esc(m.name)}</div>
          <div class="ds">${esc(m.source)} · ${m.sp||0} SP</div></div>
        <div style="display:flex; align-items:center; gap:8px">
          ${m.license_level>0?`<span class="rowbadge ${lk?'lock':'unlocked'}">${lk?'🔒':'🔓'} ${esc(licenseDisplayName(m.license))} ${m.license_level}</span>`:""}
          <span class="chevron">${open?'⌄':'›'}</span>
        </div>
      </div>`;
      const expand=open?`<div class="expand-detail">${modCardBody(m)}
        <button class="ghostbtn ${lk?'warn':''} block mt-14" id="mp-install-inline">
          ${lk?"⚠ "+t("picker.install_anyway"):"✓ "+t("picker.install_mod")}
        </button></div>`:"";
      return dividerBefore(list,_i)+`<div class="pickitem">${row}${expand}</div>`;
    }).join("")||`<div class="hint">${t("picker.no_mods")}</div>`;
    if(savedScroll!==null) mbd.scrollTop=savedScroll;

    wireViewToggle(drawList);
    $$(".modal .chip[data-mpf]").forEach(c=>c.onclick=()=>{mpFilter=c.dataset.mpf; drawList();});
    const input=$("#mp-search");
    input.oninput=e=>{ const pos=e.target.selectionStart; mpSearch=e.target.value; drawList(); restoreCaret("#mp-search", pos); };
    if(mpSearch) input.setSelectionRange(input.value.length,input.value.length);

    $$("#mp-list .listrow").forEach(it=>it.onclick=()=>{
      const id=it.dataset.m;
      if(pickerViewMode==="card"){ drawDetail(id); return; }
      mpExpanded = mpExpanded===id?null:id;
      drawList(true);
    });
    if(pickerViewMode==="inline" && mpExpanded){
      const m=M.mod[mpExpanded];
      wireTagGlossary("#md-tags", "#md-tagdesc", m.tags||[]);
      $("#mp-install-inline").onclick=()=>install(m.id, ()=>drawList());
    }
  };

  modal(tText("picker.mod_title", {name:w.name}), "");
  drawList();
}

/* Detail view for an already-installed mod — opened by clicking the mod
   sub-row under an equipped weapon. Mirrors viewEquippedWeapon/System: full
   card + a single "remove" action, nothing else to manage here. */
function viewEquippedMod(mi, wi){
  const slot=state.mech.mounts[mi].items[wi], mod=M.mod[slot.mod];
  modal(mod.name, modCardHTML(mod) +
    `<button class="ghostbtn warn block mt-16" id="md-remove">✕ ${t("picker.remove_mod")}</button>`);
  wireTagGlossary("#md-tags", "#md-tagdesc", mod.tags||[]);
  $("#md-remove").onclick=()=>{ slot.mod=null; closeModal(); render(); };
}


/* Full-card modal view for an already-installed weapon — opened by clicking
   the equipped row itself. The separate accordion toggle button (next to ✕)
   handles inline in-list expansion instead; this modal is for a focused,
   full-screen look with the same tag glossary / profile switching. */
function viewEquippedWeapon(mi, wi){
  const slot=state.mech.mounts[mi].items[wi];
  const w=M.weapon[slot.id];
  const ew=effectiveWeapon(w, slot.mod ? M.mod[slot.mod] : null);
  tagOpenSet=new Set(); profileViewIdx=0;
  const draw=()=>{
    modal(w.name, weaponCardHTML(ew) +
      `<button class="ghostbtn warn block mt-16" id="wp-remove">✕ ${t("picker.remove_weapon")}</button>`);
    wireTagGlossary("#wp-tags", "#wp-tagdesc", weaponDisplayTags(ew, profileViewIdx));
    wireProfileChips("#wp-profiles", draw);
    $("#wp-remove").onclick=()=>{ state.mech.mounts[mi].items.splice(wi,1); closeModal(); render(); };
  };
  draw();
}

/* Same, for an already-installed system. */
function viewEquippedSystem(si){
  const s=M.system[state.mech.systems[si]];
  tagOpenSet=new Set();
  modal(s.name, systemCardHTML(s) +
    `<button class="ghostbtn warn block mt-16" id="sy-remove">✕ ${t("picker.remove_system")}</button>`);
  wireTagGlossary("#sy-tags", "#sy-tagdesc", s.tags||[]);
  $("#sy-remove").onclick=()=>{ state.mech.systems.splice(si,1); closeModal(); render(); };
}


/* system picker — same inline/card toggle as weapons, but installing a
   system does NOT close the modal (per request): the list just refreshes
   (the newly-installed system drops out, since it's now in state.mech.systems),
   so several systems can be added in one sitting. */
let syFilter="ALL", sySearch="", syExpanded=null;
function openSystemPicker(){
  syFilter="ALL"; sySearch=""; syExpanded=null;

  const install=(id, back)=>installWithSpCheck(M.system[id], M.system[id].sp, ()=>commit(id), back);
  const commit=id=>{
    const at=$$("#sy-list .listrow").findIndex(r=>r.dataset.s===id);
    state.mech.systems.push(id);
    syExpanded=null;
    render();       // updates the loadout tab/HUD (SP counters) behind the modal
    // Refresh the picker in place: the installed system drops out of the list
    // and everything else stays where the eye left it. Redrawing from the top
    // would throw away the scroll position someone spent reading to reach.
    drawList(true);
    // The focused install button went with its row; the keyboard user's place
    // is the row that now sits where the installed one was.
    if(!$("#modal .panel").contains(document.activeElement)){
      const rows=$$("#sy-list .listrow");
      (rows[Math.min(Math.max(at,0), rows.length-1)] || $("#sy-search")).focus();
    }
  };

  const drawDetail=(id)=>{
    const s=M.system[id], lk=!unlocked(s);
    tagOpenSet=new Set();
    $("#modal .mhd h3").textContent=s.name;
    setModalBody(
      `<button class="ghostbtn mb-14" id="sy-back">← ${t("picker.back")}</button>`
      + systemCardHTML(s) +
      `<button class="ghostbtn block mt-16" id="sy-install">
        ${lk?"⚠ "+t("picker.install_anyway"):"✓ "+t("picker.install_system")}
      </button>`);
    wireTagGlossary("#sy-tags", "#sy-tagdesc", s.tags||[]);
    $("#sy-back").onclick=drawList;
    $("#sy-install").onclick=()=>install(s.id, ()=>drawDetail(id));
  };

  const drawList=(keepScroll)=>{
    const mbd=$("#modal .mbd");
    const savedScroll = keepScroll ? mbd.scrollTop : null;
    const list=offered("systems")
      .filter(s=>s.source)
      .filter(s=>syFilter==="ALL"?s.source!=="EXOTIC":s.source===syFilter)
      .filter(s=>!state.mech.systems.includes(s.id))
      .filter(s=>!sySearch||(s.name+" "+tr(s.type)+" "+s.source+" "+(s.tags||[]).map(trTag).join(" ")).toLowerCase().includes(sySearch.toLowerCase()))
      .sort(pickerOrder);
    $("#modal .mhd h3").textContent=tText("picker.system_title");
    setModalBody(
      `${viewToggleHTML()}
       <div class="filters">${["ALL","GMS","IPS-N","SSC","HORUS","HA","EXOTIC"].map(s=>`<button class="chip ${syFilter===s?'on':''}" data-syf="${s}">${s==="ALL"?t("common.all"):s}</button>`).join("")}</div>
       <input class="input" id="sy-search" aria-label="${t("picker.search.systems")}" placeholder="${t("picker.search.systems_ph")}" style="margin-bottom:14px" value="${esc(sySearch)}">
       <div class="grid" id="sy-list" style="gap:8px"></div>`, keepScroll);
    $("#sy-list").innerHTML=list.map((s,_i)=>{
      const lk=!unlocked(s);
      const open=pickerViewMode==="inline" && syExpanded===s.id;
      const row=systemPickRow(s, open);
      const expand=open?`<div class="expand-detail">${systemCardBody(s)}
        <button class="ghostbtn block mt-14" id="sy-install-inline">
          ${lk?"⚠ "+t("picker.install_anyway"):"✓ "+t("picker.install_system")}
        </button></div>`:"";
      return dividerBefore(list,_i)+`<div class="pickitem">${row}${expand}</div>`;
    }).join("")||`<div class="hint">${t("picker.no_systems")}</div>`;
    if(savedScroll!==null) mbd.scrollTop=savedScroll;

    wireViewToggle(drawList);
    $$(".modal .chip[data-syf]").forEach(c=>c.onclick=()=>{syFilter=c.dataset.syf; drawList();});
    const input=$("#sy-search");
    input.oninput=e=>{ const pos=e.target.selectionStart; sySearch=e.target.value; drawList(); restoreCaret("#sy-search", pos); };
    if(sySearch) input.setSelectionRange(input.value.length,input.value.length);

    $$("#sy-list .listrow").forEach(it=>it.onclick=()=>{
      const id=it.dataset.s;
      if(pickerViewMode==="card"){ drawDetail(id); return; }
      syExpanded = syExpanded===id?null:id;
      tagOpenSet=new Set();
      drawList(true);
    });
    if(pickerViewMode==="inline" && syExpanded){
      const s=M.system[syExpanded];
      wireTagGlossary("#sy-tags", "#sy-tagdesc", s.tags||[]);
      $("#sy-install-inline").onclick=()=>install(s.id, ()=>drawList());
    }
  };

  modal(tText("picker.system_title"), "");
  drawList();
}

