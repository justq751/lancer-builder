/* ============ TALENTS ============ */
/* view mode toggle for the talents tab: "grid" (multi-column cards, default)
   or "column" (single column, one talent after another) — persisted like
   the picker view-mode toggle so the choice survives reloads. */
let talentsViewMode = localStorage.getItem("talents_view_mode") || "grid";
function talentsViewToggleHTML(){
  return `<div class="viewtoggle">
    <button class="chip ${talentsViewMode==='grid'?'on':''}" data-tvm="grid">▦ ${t("talents.view.grid")}</button>
    <button class="chip ${talentsViewMode==='column'?'on':''}" data-tvm="column">☰ ${t("talents.view.column")}</button>
  </div>`;
}
function renderTalents(){
  const d=derived();
  const over=d.b.talent.used>d.b.talent.cap;
  const rankCap=talentRankCap(d.ll);
  const rankCapExceeded=Object.values(state.talents).some(v=>v>rankCap);
  $("#tab").innerHTML = sechead(t("talents.mark"),t("talents.title"),
    t(rankCap<3?"talents.lead_more":"talents.lead_max", // i18n-dynamic: talents.lead_more, talents.lead_max
      {ll:d.ll, cap:rankCap, next:rankCap+1, at:rankCap, used:d.b.talent.used, total:d.b.talent.cap}))
    + (over?`<div class="warnbox">⚠ ${t("talents.over", {n:d.b.talent.used-d.b.talent.cap})}</div>`:"")
    + (rankCapExceeded?`<div class="warnbox">⚠ ${t("talents.rank_over_ll", {ll:d.ll})}</div>`:"")
    + talentsViewToggleHTML()
    + `<div class="grid ${talentsViewMode==='column'?'stacked':'cards'}" id="tal-list"></div>`;
  $$("#tab [data-tvm]").forEach(b=>b.onclick=()=>{
    talentsViewMode=b.dataset.tvm;
    localStorage.setItem("talents_view_mode", talentsViewMode);
    renderTalents();
  });
  const remaining=d.b.talent.cap-d.b.talent.used;
  $("#tal-list").innerHTML = offered("talents", tal=>state.talents[tal.id]).map(tal=>{
    const v=state.talents[tal.id]||0;
    const capExceeded=v>rankCap;
    const canInc=v<3 && v<rankCap && remaining>=1;
    const nextLocked=!capExceeded && v<3 && v>=rankCap; // next rank exists but not yet unlocked at this LL
    const ranks=tal.ranks.map((r,i)=>`<div class="rankline ${v>=i+1?'active':''}">
      <span class="rk">${["I","II","III"][i]}</span><div><b>${esc(r.name)}</b><div style="margin-top:2px">${rich(r.description)}</div></div></div>`).join("");
    return `<div class="item ${v?'sel':''}" ${capExceeded?'style="border-color:var(--amber)"':''}>
      <div class="top"><div class="nm">${esc(tal.name)}</div>
        <div class="stepper">
          <button class="stepbtn" data-tl="${tal.id}" data-d="-1" ${v<=0?"disabled":""} aria-label="${t("talents.minus", {name:tal.name})}">−</button>
          <span class="pips" role="img" aria-label="${t("common.rank_of3", {v})}">${[1,2,3].map(n=>`<span class="pip ${v>=n?'on':''} ${n>rankCap?'locked':''}"></span>`).join("")}</span>
          <button class="stepbtn" data-tl="${tal.id}" data-d="1" ${canInc?"":"disabled"} aria-label="${t("talents.plus", {name:tal.name})}" ${nextLocked?`title="${t("talents.next_at", {rank:v+1, ll:rankCap})}"`:""}>+</button>
        </div></div>
      <div class="desc">${esc(tal.terse||"")}</div>
      ${capExceeded?`<div class="hint" style="color:var(--amber)">⚠ ${t("talents.cap_exceeded", {v, ll:d.ll, cap:rankCap})}</div>`
        :(nextLocked?`<div class="hint">🔒 ${t("talents.next_locked", {rank:v+1, ll:rankCap})}</div>`:"")}
      <div class="rankbox">${ranks}</div>
    </div>`;
  }).join("");
  $$("#tal-list .stepbtn").forEach(b=>b.onclick=()=>{
    const id=b.dataset.tl, dir=+b.dataset.d;
    const cap=talentRankCap(derived().ll);
    let v=(state.talents[id]||0)+dir;
    v=Math.max(0,Math.min(3,v));
    if(dir>0 && v>cap) v=cap; // extra guard: never let + push past the LL-gated rank cap
    if(v===0) delete state.talents[id]; else state.talents[id]=v;
    render();
  });
}
