/* ============ HASE ============ */
function renderHase(){
  const d=derived();
  const over=d.b.hase.used>d.b.hase.cap;
  const remaining=d.b.hase.cap-d.b.hase.used;
  $("#tab").innerHTML = sechead(t("hase.mark"),t("hase.title"),
    t("hase.lead", {used:d.b.hase.used, cap:d.b.hase.cap}))
    + (over?`<div class="warnbox">⚠ ${t("hase.over", {n:d.b.hase.used-d.b.hase.cap})}</div>`:"")
    + `<div class="grid cards" id="hase-list"></div>`;
  $("#hase-list").innerHTML = HASE.map(h=>{
    const v=state.hase[h.k], name=haseLabel(h.k,"name");
    return `<div class="item ${v?'sel':''}">
      <div class="top">
        <div class="nm">${esc(name)}${name!==h.en?` <span class="mono" style="color:var(--faint);font-size:12px">${h.en}</span>`:""}</div>
        <div class="badge">${t("hase.rank", {v})}</div></div>
      <div class="desc">${esc(haseLabel(h.k,"effect"))}</div>
      <div class="stepper" style="margin-top:12px">
        <button class="stepbtn" data-hs="${h.k}" data-d="-1" ${v<=0?"disabled":""} aria-label="${t("hase.minus", {name})}">−</button>
        <span class="pips" aria-hidden="true">${[1,2,3,4,5,6].map(n=>`<span class="pip ${v>=n?'on':''}"></span>`).join("")}</span>
        <button class="stepbtn" data-hs="${h.k}" data-d="1" ${(v<6&&remaining>=1)?"":"disabled"} aria-label="${t("hase.plus", {name})}">+</button>
      </div></div>`;
  }).join("");
  $$("#hase-list .stepbtn").forEach(b=>b.onclick=()=>{
    const k=b.dataset.hs, dir=+b.dataset.d;
    state.hase[k]=Math.max(0,Math.min(6,state.hase[k]+dir)); render();
  });
}
