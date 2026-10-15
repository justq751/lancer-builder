/* ============ TALENTS ============ */
/* view mode toggle for the talents tab: "grid" (multi-column cards, default)
   or "column" (single column, one talent after another) — persisted like
   the picker view-mode toggle so the choice survives reloads. */
let talentsViewMode = localStorage.getItem("talents_view_mode") || "grid";
function talentsViewToggleHTML(){
  return `<div class="viewtoggle">
    <button class="chip ${talentsViewMode==='grid'?'on':''}" data-tvm="grid">▦ Сетка</button>
    <button class="chip ${talentsViewMode==='column'?'on':''}" data-tvm="column">☰ Одна колонка</button>
  </div>`;
}
function renderTalents(){
  const d=derived();
  const over=d.b.talent.used>d.b.talent.cap;
  const rankCap=talentRankCap(d.ll);
  const rankCapExceeded=Object.values(state.talents).some(v=>v>rankCap);
  $("#tab").innerHTML = sechead("// 03 · ПОДГОТОВКА","Таланты",
    `Каждый ранг таланта стоит 1 очко (макс. ранг 3). На LL${d.ll} доступен ранг до ${rankCap}`
    + (rankCap<3?` — ранг ${rankCap+1} откроется на LL${rankCap}.`:".")
    + ` Потрачено ${d.b.talent.used} из ${d.b.talent.cap}.`)
    + (over?`<div class="warnbox">⚠ Превышен бюджет талантов на ${d.b.talent.used-d.b.talent.cap}.</div>`:"")
    + (rankCapExceeded?`<div class="warnbox">⚠ Есть таланты с рангом выше допустимого для LL${d.ll} — понизьте ранг или повысьте LL пилота.</div>`:"")
    + talentsViewToggleHTML()
    + `<div class="grid ${talentsViewMode==='column'?'stacked':'cards'}" id="tal-list"></div>`;
  $$("#tab [data-tvm]").forEach(b=>b.onclick=()=>{
    talentsViewMode=b.dataset.tvm;
    localStorage.setItem("talents_view_mode", talentsViewMode);
    renderTalents();
  });
  const remaining=d.b.talent.cap-d.b.talent.used;
  $("#tal-list").innerHTML = L.talents.map(t=>{
    const v=state.talents[t.id]||0;
    const capExceeded=v>rankCap;
    const canInc=v<3 && v<rankCap && remaining>=1;
    const nextLocked=!capExceeded && v<3 && v>=rankCap; // next rank exists but not yet unlocked at this LL
    const ranks=t.ranks.map((r,i)=>`<div class="rankline ${v>=i+1?'active':''}">
      <span class="rk">${["I","II","III"][i]}</span><div><b>${esc(r.name)}</b><div style="margin-top:2px">${rich(r.description)}</div></div></div>`).join("");
    return `<div class="item ${v?'sel':''}" ${capExceeded?'style="border-color:var(--amber)"':''}>
      <div class="top"><div class="nm">${esc(t.name)}</div>
        <div class="stepper">
          <button class="stepbtn" data-tl="${t.id}" data-d="-1" ${v<=0?"disabled":""} aria-label="Понизить ранг: ${esc(t.name)}">−</button>
          <span class="pips" role="img" aria-label="Ранг ${v} из 3">${[1,2,3].map(n=>`<span class="pip ${v>=n?'on':''} ${n>rankCap?'locked':''}"></span>`).join("")}</span>
          <button class="stepbtn" data-tl="${t.id}" data-d="1" ${canInc?"":"disabled"} aria-label="Повысить ранг: ${esc(t.name)}" ${nextLocked?`title="Ранг ${v+1} доступен с LL${rankCap}"`:""}>+</button>
        </div></div>
      <div class="desc">${esc(t.terse||"")}</div>
      ${capExceeded?`<div class="hint" style="color:var(--amber)">⚠ Ранг ${v} превышает лимит для LL${d.ll} (макс ${rankCap})</div>`
        :(nextLocked?`<div class="hint">🔒 Ранг ${v+1} — с LL${rankCap}</div>`:"")}
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
