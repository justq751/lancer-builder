/* ============ SKILLS ============ */
function renderSkills(){
  const d=derived();
  const over=d.b.skill.used>d.b.skill.cap;
  $("#tab").innerHTML = sechead("// 02 · ТРИГГЕРЫ","Навыки пилота",
    `Распределите очки между триггерами навыков. Каждый шаг даёт +2 (максимум +6 на триггер). Потрачено ${(+d.b.skill.used)} из ${d.b.skill.cap}.`)
    + (over?`<div class="warnbox">⚠ Превышен бюджет навыков на ${d.b.skill.used-d.b.skill.cap}. Уменьшите ранги.</div>`:"")
    + `<div class="grid" id="skill-list"></div>
       <button class="ghostbtn mt-12" id="add-custom-skill">+ СВОЙ НАВЫК</button>`;
  const allSkills = [...L.skills, ...(state.customSkills||[])];
  $("#skill-list").innerHTML = allSkills.map(s=>{
    const custom = !L.skills.includes(s) && (state.customSkills||[]).some(cs=>cs.id===s.id);
    const v=state.skills[s.id]||0;
    const remaining=d.b.skill.cap-d.b.skill.used;
    const canInc=v<6 && remaining>=1;
    return `<div class="listrow ${v===6?'maxed':''}">
      <div class="info"><div class="nm">${esc(s.name)}${custom?' <span class="tag" style="margin-left:6px">СВОЙ</span>':''}</div><div class="ds">${rich(s.description)}</div></div>
      <div class="stepper">
        <button class="stepbtn" data-sk="${s.id}" data-d="-1" ${v<=0?"disabled":""}>−</button>
        <span class="stepval">${v?"+"+v:"—"}</span>
        <button class="stepbtn" data-sk="${s.id}" data-d="1" ${canInc?"":"disabled"}>+</button>
        ${custom?`<button class="xbtn" data-editsk="${s.id}" title="Редактировать" aria-label="Редактировать навык" style="margin-left:8px">✎</button>
                  <button class="xbtn" data-rmsk="${s.id}" title="Удалить" aria-label="Удалить навык">✕</button>`:""}
      </div></div>`;
  }).join("");
  $$("#skill-list .stepbtn").forEach(b=>b.onclick=()=>{
    const id=b.dataset.sk, dir=+b.dataset.d;
    let v=(state.skills[id]||0)+dir*2; v=Math.max(0,Math.min(6,v));
    if(v===0) delete state.skills[id]; else state.skills[id]=v;
    render();
  });
  $$("#skill-list .xbtn[data-editsk]").forEach(b=>b.onclick=()=>openCustomSkillEditor(b.dataset.editsk));
  $$("#skill-list .xbtn[data-rmsk]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.rmsk;
    state.customSkills=(state.customSkills||[]).filter(s=>s.id!==id);
    delete state.skills[id];
    render();
  });
  $("#add-custom-skill").onclick=()=>openCustomSkillEditor(null);
}

/* Create/edit a custom pilot skill trigger. `id===null` creates a new one;
   otherwise edits the existing custom skill with that id. */
function openCustomSkillEditor(id){
  const existing = id ? (state.customSkills||[]).find(s=>s.id===id) : null;
  modal(existing?"Редактировать свой навык":"Новый навык пилота", `
    <div class="field"><label>НАЗВАНИЕ</label>
      <input class="input" id="csk-name" placeholder="например, «Взломать реальность»" value="${esc(existing?.name||"")}"></div>
    <div class="field" style="margin-top:12px"><label>ОПИСАНИЕ</label>
      <textarea class="input" id="csk-desc" rows="4" placeholder="Что делает этот навык, когда его применяют" style="resize:vertical; font-family:inherit">${esc(existing?.description||"")}</textarea></div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="toolbtn" style="border-color:var(--accent);color:var(--accent)" id="csk-save">${existing?"✓ СОХРАНИТЬ":"✓ СОЗДАТЬ"}</button>
      <button class="toolbtn" id="csk-cancel">ОТМЕНА</button>
    </div>`);
  $("#csk-name").focus();
  $("#csk-cancel").onclick=closeModal;
  $("#csk-save").onclick=()=>{
    const name=$("#csk-name").value.trim();
    if(!name){ $("#csk-name").focus(); return; }
    const description=$("#csk-desc").value.trim();
    if(existing){
      existing.name=name; existing.description=description;
    } else {
      const newId="custom_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      state.customSkills=state.customSkills||[];
      state.customSkills.push({id:newId, name, description});
    }
    closeModal(); render();
  };
}
