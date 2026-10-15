/* ============ SKILLS ============ */
function renderSkills(){
  const d=derived();
  const over=d.b.skill.used>d.b.skill.cap;
  $("#tab").innerHTML = sechead(t("skills.mark"),t("skills.title"),
    t("skills.lead", {used:+d.b.skill.used, cap:d.b.skill.cap}))
    + (over?`<div class="warnbox">⚠ ${t("skills.over", {n:d.b.skill.used-d.b.skill.cap})}</div>`:"")
    + `<div class="grid" id="skill-list"></div>
       <button class="ghostbtn mt-12" id="add-custom-skill">+ ${t("skills.add_custom")}</button>`;
  const allSkills = [...L.skills, ...(state.customSkills||[])];
  $("#skill-list").innerHTML = allSkills.map(s=>{
    const custom = !L.skills.includes(s) && (state.customSkills||[]).some(cs=>cs.id===s.id);
    const v=state.skills[s.id]||0;
    const remaining=d.b.skill.cap-d.b.skill.used;
    const canInc=v<6 && remaining>=1;
    return `<div class="listrow ${v===6?'maxed':''}">
      <div class="info"><div class="nm">${esc(s.name)}${custom?` <span class="tag" style="margin-left:6px">${t("skills.custom_tag")}</span>`:''}</div><div class="ds">${rich(s.description)}</div></div>
      <div class="stepper">
        <button class="stepbtn" data-sk="${s.id}" data-d="-1" ${v<=0?"disabled":""} aria-label="${t("skills.minus", {name:s.name})}">−</button>
        <span class="stepval">${v?"+"+v:"—"}</span>
        <button class="stepbtn" data-sk="${s.id}" data-d="1" ${canInc?"":"disabled"} aria-label="${t("skills.plus", {name:s.name})}">+</button>
        ${custom?`<button class="xbtn" data-editsk="${s.id}" title="${t("common.edit")}" aria-label="${t("skills.edit_aria")}" style="margin-left:8px">✎</button>
                  <button class="xbtn" data-rmsk="${s.id}" title="${t("common.delete")}" aria-label="${t("skills.delete_aria")}">✕</button>`:""}
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
  // i18n-dynamic: skills.editor.edit_title, skills.editor.new_title, common.save_caps, skills.editor.create
  modal(tText(existing?"skills.editor.edit_title":"skills.editor.new_title"), `
    <div class="field"><label for="csk-name">${t("skills.editor.name")}</label>
      <input class="input" id="csk-name" placeholder="${t("skills.editor.name_ph")}" value="${esc(existing?.name||"")}"></div>
    <div class="field" style="margin-top:12px"><label for="csk-desc">${t("skills.editor.desc")}</label>
      <textarea class="input" id="csk-desc" rows="4" placeholder="${t("skills.editor.desc_ph")}" style="resize:vertical; font-family:inherit">${esc(existing?.description||"")}</textarea></div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="toolbtn" style="border-color:var(--accent);color:var(--accent)" id="csk-save">✓ ${t(existing?"common.save_caps":"skills.editor.create")}</button>
      <button class="toolbtn" id="csk-cancel">${t("common.cancel_caps")}</button>
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
