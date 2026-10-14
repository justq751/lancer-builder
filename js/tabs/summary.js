/* ============ SUMMARY ============ */
function renderSummary(){
  const d=derived(); const p=state.pilot;
  const skills=Object.entries(state.skills).map(([id,v])=>`<li><span class="mk">+${v}</span> ${esc(skillInfo(id)?.name||id)}</li>`).join("")||"<li class='hint'>—</li>";
  const tals=Object.entries(state.talents).map(([id,v])=>`<li><span class="mk">${["I","II","III"][v-1]}</span> ${esc(M.talent[id]?.name||id)}</li>`).join("")||"<li class='hint'>—</li>";
  const cores=state.cores.map(id=>`<li><span class="mk">◆</span> ${esc(M.core[id]?.name||id)}</li>`).join("")||"<li class='hint'>—</li>";
  const hase=HASE.map(h=>`<div class="kv"><span class="k">${h.ru}</span><span>${state.hase[h.k]}</span></div>`).join("");
  let mechBlock=`<div class="hint">// шасси не выбрано</div>`;
  if(d.frame){
    const wlist=state.mech.mounts.flatMap(mt=>mt.items.map(slot=>{
      const w=M.weapon[slot.id], ew=effectiveWeapon(w, slot.mod?M.mod[slot.mod]:null);
      const modTag=slot.mod?` <span class="hint">+ ${esc(M.mod[slot.mod]?.name||"")}</span>`:"";
      return `<li><span class="mk">[${tr(mt.type)}]</span> ${esc(w.name)}${modTag} <span class="hint">(${dmgStr(ew)})</span></li>`;
    })).join("")||"<li class='hint'>оружие не установлено</li>";
    const slist=state.mech.systems.map(id=>`<li><span class="mk">▸</span> ${esc(M.system[id].name)} <span class="hint">(${M.system[id].sp} SP)</span></li>`).join("")||"<li class='hint'>систем нет</li>";
    mechBlock=`
      <div class="kv" style="margin-bottom:12px">
        <span class="k">ШАССИ</span><span style="color:${srcColor(d.frame.source)}">${esc(dispName(d.frame))} (${esc(d.frame.source)})</span>
        <span class="k">ТИП</span><span>${d.frame.mechtype.join(" / ")}</span></div>
      <div class="statgrid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        ${["hp","armor","evasion","edef","heatcap","repcap","speed","sensor_range","tech_attack","save","size","sp"].map(k=>
          `<div class="stattile"><span class="k">${statKeyHTML(k)}</span><span class="v">${d.mech[k]}</span></div>`).join("")}
      </div>
      <h3 style="margin-top:6px"><span class="hash">//</span> ОРУЖИЕ</h3><ul class="minilist">${wlist}</ul>
      <h3 style="margin-top:14px"><span class="hash">//</span> СИСТЕМЫ <span class="hint mono">SP ${d.sp.used}/${d.sp.cap}</span></h3><ul class="minilist">${slist}</ul>
      <div style="margin-top:14px">${frameTraitsCoreHTML(d.frame)}</div>`;
  }
  $("#tab").innerHTML = sechead("// 09 · СВОДКА","Лист персонажа",
    "Полная сводка пилота и меха. Сохраните сборку в файл или распечатайте лист.")
    + `<div class="sheet">
      <div class="card"><div class="head"><span class="lbl"><b>//</b> ПИЛОТ</span></div><div class="body">
        <div class="kv">
          <span class="k">ПОЗЫВНОЙ</span><span>${esc(p.callsign||"—")}</span>
          <span class="k">ИМЯ</span><span>${esc(p.name||"—")}</span>
          <span class="k">ПРОИСХОЖДЕНИЕ</span><span>${esc(M.bg[p.background]?.name||"—")}</span>
          <span class="k">LL / GRIT</span><span>LL${d.ll} · +${d.grit}</span>
        </div>
        <h3 style="margin-top:14px"><span class="hash">//</span> НАВЫКИ</h3><ul class="minilist">${skills}</ul>
        <h3 style="margin-top:14px"><span class="hash">//</span> ТАЛАНТЫ</h3><ul class="minilist">${tals}</ul>
        <h3 style="margin-top:14px"><span class="hash">//</span> CORE-БОНУСЫ</h3><ul class="minilist">${cores}</ul>
      </div></div>
      <div class="card"><div class="head"><span class="lbl"><b>//</b> МЕХ</span></div><div class="body">
        <h3><span class="hash">//</span> МЕХ-НАВЫКИ</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;margin-bottom:6px">${hase}</div>
        ${mechBlock}
      </div></div>
    </div>
    <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="toolbtn" style="border-color:var(--accent);color:var(--accent)" onclick="window.print()">🖨 РАСПЕЧАТАТЬ</button>
      <button class="toolbtn" id="sum-export">⬇ СОХРАНИТЬ В ФАЙЛ</button>
    </div>`;
  $("#sum-export").onclick=exportBuild;
  buildPrintSheet(d);
}

/* CORE bonuses live on the summary side — add a quick picker via summary cores section: handled on pilot? 
   We expose CORE selection through a dedicated control: */
