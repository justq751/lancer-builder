/* ============ QUICK REFERENCE ============
   The ? button in the header: the basic actions of the rules and the
   statuses/conditions, as a table-side cheat sheet. General rules only — the
   build's own systems live on their tabs. Data: L.actions, L.statuses
   (tools/normalize_pack.py).

   Colour is the navigation here: every action type has its hue (--k, from
   the --act-* tokens) and its icon (assets/icons/ref.svg), repeated on the
   turn strip, the section heading and each card's band — so a type is found
   by eye before a word is read. The turn strip is the legend and the filter
   at once. */

// Card order = turn strip order. Overcharge is a Free action in the data but
// has its own place in a turn, so it gets its own type.
const REF_KINDS = ["full", "quick", "move", "overcharge", "reaction", "free"];
const REF_KIND_OF = {Full:"full", Quick:"quick", Move:"move", Reaction:"reaction", Free:"free"};
const refKind = a => a.id==="act_overcharge" ? "overcharge" : REF_KIND_OF[a.activation];
// Actions chosen inside another action nest under it (Quick Tech, Invade and
// Jockey options).
const REF_NESTED = {"Quick Tech":"act_quick_tech", "Invade":"act_invade", "Jockey":"act_jockey"};
// Statuses with a drawn icon; one from a future supplement gets st-generic.
const REF_STATUS_ICONS = new Set(["dangerzone","downandout","engaged","exposed","hidden","invisible","prone",
  "shut-down","immobilized","impaired","jammed","lockon","shredded","slow","stunned","intangible"]);
let refFilter = null;

const refIcon = (id, cls="ic") => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="assets/icons/ref.svg#${id}"/></svg>`;
const refKids = a => (L.actions||[]).filter(k=>REF_NESTED[k.activation]===a.id);

/* One entry. Card (top level, coloured band) or option row inside a card;
   it only folds when there is more to read than the short line. */
function refEntryHTML(e, {kind, icon, card}){
  const kids=e.kids||[];
  const more=(e.body && e.body!==e.terse) || kids.length;
  const badge=e.pilot ? `<span class="ref-foot" title="${esc(tText("ref.on_foot_hint"))}">${t("ref.on_foot")}</span>` : "";
  const name=`<span class="ref-nm">${esc(e.name)}</span>`;
  const head = card
    ? `<span class="rc-band">${refIcon(icon)}${name}${badge}${more?'<span class="chev" aria-hidden="true"></span>':""}</span>
       <span class="ref-terse">${rich(e.terse)}</span>
       ${kids.length?`<span class="rc-opts"><span class="rc-opts-l">${t("ref.options")}</span>${kids.map(k=>`<span class="rc-chip">${esc(k.name)}</span>`).join("")}</span>`:""}`
    : `<span class="rk-line">${more?'<span class="chev" aria-hidden="true"></span>':""}${name}${badge}</span><span class="ref-terse">${rich(e.terse)}</span>`;
  const cls=`ref-it ${card?"rc":"rk"} k-${kind}`;
  if(!more) return `<div class="${cls}" data-ref="${esc(e.id)}"><div class="ref-head">${head}</div></div>`;
  const kidsHTML=kids.length
    ? `<div class="ref-kids"><h5 class="rk-h">${t("ref.options")}</h5>${kids.map(k=>refEntryHTML(refActionEntry(k), {kind, card:false})).join("")}</div>` : "";
  return `<details class="${cls}" data-ref="${esc(e.id)}"><summary class="ref-head">${head}</summary>
    <div class="ref-body">${e.body && e.body!==e.terse ? `<div class="ref-text">${rich(e.body)}</div>` : ""}${kidsHTML}</div></details>`;
}
const refActionEntry = a => ({id:a.id, name:a.name, terse:a.terse, body:a.detail, pilot:a.pilot, kids:refKids(a)});

function refSectionHTML(kind, label, icon, entries){
  return `<section class="ref-sec k-${kind}" data-kind="${kind}">
    <h4 class="ref-sh">${icon?refIcon(icon):""}<span>${label}</span><span class="ref-n">${entries.length}</span></h4>
    <div class="ref-grid">${entries.join("")}</div></section>`;
}

/* The turn strip: what a turn allows, one tile per type. A tile filters the
   cards below to its type; pressing it again shows everything. */
// i18n-dynamic: ref.tile.full, ref.tile.quick, ref.tile.move, ref.tile.overcharge, ref.tile.reaction, ref.tile.free, ref.limit.turn, ref.limit.two, ref.limit.round, ref.limit.any
function refTurnHTML(){
  const tile=(kind, limit)=>`<button type="button" class="rt-tile k-${kind}" data-kind="${kind}" aria-pressed="false">
    ${refIcon("act-"+kind, "ic rt-ic")}<span class="rt-l">${t(`ref.tile.${kind}`)}</span><span class="rt-lim">${t(`ref.limit.${limit}`)}</span></button>`;
  return `<div class="ref-turn" role="group" aria-label="${esc(tText("ref.turn"))}">
    <div class="rt-pair">${tile("full","turn")}<span class="rt-or">${t("ref.turn.or")}</span>${tile("quick","two")}</div>
    ${tile("move","turn")}${tile("overcharge","turn")}${tile("reaction","round")}${tile("free","any")}
  </div>
  <p class="ref-hint"><span>${t("ref.turn_hint")}</span><button type="button" class="ghostbtn ref-all" hidden>${t("ref.show_all")}</button></p>`;
}

// i18n-dynamic: ref.group.full, ref.group.quick, ref.group.move, ref.group.overcharge, ref.group.reaction, ref.group.free, ref.statuses, ref.conditions, ref.tab.actions, ref.tab.statuses
function openReference(){
  const top=(L.actions||[]).filter(a=>!REF_NESTED[a.activation]);
  const actions=REF_KINDS.map(kind=>{
    const list=top.filter(a=>refKind(a)===kind);
    return list.length ? refSectionHTML(kind, t(`ref.group.${kind}`), "act-"+kind,
      list.map(a=>refEntryHTML(refActionEntry(a), {kind, icon:"act-"+kind, card:true}))) : "";
  }).join("");
  // A supplement's status (KTB: Intangible) only while that supplement is on.
  const statuses=(L.statuses||[]).filter(s=>{ const pack=contentPack("statuses", s); return !pack || packCategoriesOn(pack).length>0; });
  const statusSection=(type, kind, key)=>{
    const list=statuses.filter(s=>s.type===type);
    return list.length ? refSectionHTML(kind, t(key), null, list.map(s=>refEntryHTML(
      {id:s.id, name:s.name, terse:s.terse, body:s.effects},
      {kind, icon:REF_STATUS_ICONS.has(s.id) ? "st-"+s.id : "st-generic", card:true}))) : "";
  };
  let tab="actions";
  try{ if(localStorage.getItem("ref_tab")==="statuses") tab="statuses"; }catch(_){}
  const tabBtn=(id, key)=>`<button type="button" role="tab" class="ref-tab" id="ref-tab-${id}" data-reftab="${id}"
    aria-controls="ref-panel-${id}" aria-selected="${tab===id}" tabindex="${tab===id?0:-1}">${t(key)}</button>`;
  refFilter=null;
  modal(tText("ref.title"), `<div class="ref">
    <div class="ref-tabs" role="tablist" aria-label="${esc(tText("ref.title"))}">${tabBtn("actions","ref.tab.actions")}${tabBtn("statuses","ref.tab.statuses")}</div>
    <div class="ref-panel" role="tabpanel" id="ref-panel-actions" aria-labelledby="ref-tab-actions" ${tab==="actions"?"":"hidden"}>${refTurnHTML()}${actions}</div>
    <div class="ref-panel" role="tabpanel" id="ref-panel-statuses" aria-labelledby="ref-tab-statuses" ${tab==="statuses"?"":"hidden"}>
      ${statusSection("Status","status","ref.statuses")}${statusSection("Condition","cond","ref.conditions")}</div>
  </div>`);
  wireReference();
}

function wireReference(){
  const tabs=$$("#modal .ref-tab");
  const select=btn=>{
    tabs.forEach(b=>{ const on=b===btn; b.setAttribute("aria-selected", on); b.tabIndex=on?0:-1;
      $("#"+b.getAttribute("aria-controls")).hidden=!on; });
    try{ localStorage.setItem("ref_tab", btn.dataset.reftab); }catch(_){}
    $("#modal .mbd").scrollTop=0;
  };
  tabs.forEach((b,i)=>{
    b.onclick=()=>select(b);
    b.onkeydown=e=>{
      if(e.key!=="ArrowRight" && e.key!=="ArrowLeft") return;
      e.preventDefault();
      const next=tabs[(i+(e.key==="ArrowRight"?1:tabs.length-1))%tabs.length];
      select(next); next.focus();
    };
  });
  const applyFilter=()=>{
    $$("#modal .rt-tile").forEach(b=>b.setAttribute("aria-pressed", b.dataset.kind===refFilter));
    $$("#ref-panel-actions .ref-sec").forEach(s=>{ s.hidden=!!refFilter && s.dataset.kind!==refFilter; });
    $("#modal .ref").classList.toggle("filtered", !!refFilter);
    $("#modal .ref-all").hidden=!refFilter;
  };
  $$("#modal .rt-tile").forEach(b=>b.onclick=()=>{ refFilter=refFilter===b.dataset.kind?null:b.dataset.kind; applyFilter(); });
  $("#modal .ref-all").onclick=()=>{ refFilter=null; applyFilter(); $(`#modal .rt-tile`).focus(); };
}
