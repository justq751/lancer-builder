/* ============ HASE ============ */
function renderHase(){
  const d=derived();
  const over=d.b.hase.used>d.b.hase.cap;
  const remaining=d.b.hase.cap-d.b.hase.used;
  $("#tab").innerHTML = sechead("// 04 · КАЛИБРОВКА","Мех-навыки (HASE)",
    `Распределите очки между четырьмя характеристиками меха. Эти ранги напрямую меняют статы вашего шасси. Потрачено ${d.b.hase.used} из ${d.b.hase.cap}.`)
    + (over?`<div class="warnbox">⚠ Превышен бюджет мех-навыков на ${d.b.hase.used-d.b.hase.cap}.</div>`:"")
    + `<div class="grid cards" id="hase-list"></div>`;
  $("#hase-list").innerHTML = HASE.map(h=>{
    const v=state.hase[h.k];
    return `<div class="item ${v?'sel':''}">
      <div class="top">
        <div class="nm">${h.ru} <span class="mono" style="color:var(--faint);font-size:12px">${h.en}</span></div>
        <div class="badge">ранг ${v}/6</div></div>
      <div class="desc">${h.eff}</div>
      <div class="stepper" style="margin-top:12px">
        <button class="stepbtn" data-hs="${h.k}" data-d="-1" ${v<=0?"disabled":""} aria-label="Понизить: ${h.ru}">−</button>
        <span class="pips" aria-hidden="true">${[1,2,3,4,5,6].map(n=>`<span class="pip ${v>=n?'on':''}"></span>`).join("")}</span>
        <button class="stepbtn" data-hs="${h.k}" data-d="1" ${(v<6&&remaining>=1)?"":"disabled"} aria-label="Повысить: ${h.ru}">+</button>
      </div></div>`;
  }).join("");
  $$("#hase-list .stepbtn").forEach(b=>b.onclick=()=>{
    const k=b.dataset.hs, dir=+b.dataset.d;
    state.hase[k]=Math.max(0,Math.min(6,state.hase[k]+dir)); render();
  });
}
