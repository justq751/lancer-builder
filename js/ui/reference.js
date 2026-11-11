/* ============ QUICK REFERENCE ============
   The ? button in the header: the basic actions of the rules and the
   statuses/conditions, as a table-side cheat sheet. General rules only — the
   build's own systems live on their tabs. Data: L.actions, L.statuses
   (tools/normalize_pack.py). Each line shows the short text; the full rule
   opens under it. */

// Top-level groups by activation; actions chosen inside another action
// (Quick Tech options, Invade options, Jockey options) nest under it.
const REF_GROUPS = [["Move","move"], ["Quick","quick"], ["Full","full"], ["Reaction","reaction"], ["Free","free"]];
const REF_NESTED = {"Quick Tech":"act_quick_tech", "Invade":"act_invade", "Jockey":"act_jockey"};

function refItemHTML(id, name, terse, body, badge, children){
  const head=`<span class="ref-nm">${esc(name)}</span>${badge||""}<span class="ref-terse">${rich(terse)}</span>`;
  // Nothing more to open (a condition whose rule is its summary): a plain line.
  if(!children && (!body || body===terse)) return `<div class="ref-it" data-ref="${esc(id)}"><div class="ref-head">${head}</div></div>`;
  return `<details class="ref-it" data-ref="${esc(id)}"><summary class="ref-head">${head}</summary>
    <div class="ref-body">${body && body!==terse ? `<p>${rich(body)}</p>` : ""}${children||""}</div></details>`;
}

function refActionHTML(a){
  const kids=(L.actions||[]).filter(k=>REF_NESTED[k.activation]===a.id);
  const badge=a.pilot ? `<span class="ref-foot" title="${esc(tText("ref.on_foot_hint"))}">${t("ref.on_foot")}</span>` : "";
  return refItemHTML(a.id, a.name, a.terse, a.detail, badge,
    kids.length ? `<div class="ref-kids">${kids.map(refActionHTML).join("")}</div>` : "");
}

// i18n-dynamic: ref.group.move, ref.group.quick, ref.group.full, ref.group.reaction, ref.group.free, ref.statuses, ref.conditions
function openReference(){
  const groups=REF_GROUPS.map(([act,key])=>{
    const list=(L.actions||[]).filter(a=>a.activation===act);
    return list.length ? `<section class="ref-grp ref-${key}"><h4>${t(`ref.group.${key}`)}</h4>${list.map(refActionHTML).join("")}</section>` : "";
  }).join("");
  // A supplement's status (KTB: Intangible) only while that supplement is on.
  const statuses=(L.statuses||[]).filter(s=>{ const pack=contentPack("statuses", s); return !pack || packCategoriesOn(pack).length>0; });
  const statusGroup=(type, key)=>{
    const list=statuses.filter(s=>s.type===type);
    return list.length ? `<section class="ref-grp ref-status"><h4>${t(key)}</h4>${list.map(s=>refItemHTML(s.id, s.name, s.terse, s.effects)).join("")}</section>` : "";
  };
  modal(tText("ref.title"), `<div class="ref">${groups}${statusGroup("Status","ref.statuses")}${statusGroup("Condition","ref.conditions")}</div>`);
}
