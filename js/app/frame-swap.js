/* Mount rules (allowedNext, buildMounts) live in js/core/build.js. */
/* ---------------- FRAME SWAP ----------------
   Choosing a frame rebuilds its mount layout, and that is where an existing
   loadout used to vanish without a word. Weapons that still fit the new
   frame's mounts are carried across; the rest are named before anything is
   destroyed, so the choice is made with the cost visible. */
function equippedSlots(){
  return (state.mech.mounts||[]).flatMap(mt=>mt.items||[]).filter(s=>s&&M.weapon[s.id]);
}
function planFrameSwap(newFrame){
  const mounts=buildMounts(newFrame);
  const integrated=new Set(mounts.filter(m=>m.type==="Integrated").flatMap(m=>(m.items||[]).map(s=>s.id)));
  const carried=[], leftBehind=[];
  equippedSlots().forEach(slot=>{
    const w=M.weapon[slot.id];
    // The new frame's own integrated weapon is already in place.
    if(integrated.has(slot.id)) return;
    const target=mounts.find(mt=>mt.type!=="Integrated"
      && allowedNext(mt.type, mt.items.map(s=>M.weapon[s.id]&&M.weapon[s.id].mount)).includes(w.mount));
    if(target){ target.items.push({id:slot.id, mod:slot.mod||null}); carried.push({w, mount:target.type}); }
    else leftBehind.push(w);
  });
  return {mounts, carried, leftBehind};
}
function pickFrame(id){
  const fr=M.frame[id];
  if(!fr || state.mech.frameId===id) return;
  const commit=mounts=>{ state.mech.frameId=id; state.mech.mounts=mounts; render(); };
  if(!equippedSlots().length){ commit(buildMounts(fr)); return; }

  const plan=planFrameSwap(fr);
  const losses=[
    ...plan.carried.map(c=>({kind:"keep", text:`${c.w.name} → ${tr(c.mount)}`})),
    ...plan.leftBehind.map(w=>({kind:"drop", text:`${w.name} — нет подходящего крепления`})),
  ];
  const actions=[];
  if(plan.carried.length) actions.push({
    label:`↳ Перенести совместимое (${plan.carried.length})`,
    run:()=>commit(plan.mounts),
  });
  actions.push({label:"✕ Снять всё", danger:true, run:()=>commit(buildMounts(fr))});

  const tail = !plan.leftBehind.length ? "Всё вооружение переносится:"
             : !plan.carried.length    ? "Перенести не получится ничего:"
             :                           "Переносится не всё:";
  confirmDialog({
    title:"Смена шасси",
    lead:`У <b>${esc(dispName(fr))}</b> другой набор креплений, поэтому вооружение придётся переставить. ${tail}`,
    losses,
    actions,
  });
}
