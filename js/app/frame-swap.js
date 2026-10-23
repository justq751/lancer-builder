/* Mount rules (allowedNext, buildMounts, planCoreMounts, the superheavy
   helpers) live in js/core/build.js. */
/* ---------------- FRAME SWAP ----------------
   Choosing a frame rebuilds its mount layout, and that is where an existing
   loadout used to vanish without a word. Weapons that still fit the new
   frame's mounts are carried across; the rest are named before anything is
   destroyed, so the choice is made with the cost visible. */
function equippedSlots(){
  return (state.mech.mounts||[]).flatMap(mt=>mt.items||[]).filter(s=>s&&M.weapon[s.id]);
}
/* A frame's mounts with the selected CORE bonuses' mounts added. Mount
   Retrofitting waits for the pilot to choose a mount again. */
const mountsForFrame = frame => planCoreMounts(frame, state.cores, buildMounts(frame)).mounts;
function planFrameSwap(newFrame){
  const mounts=mountsForFrame(newFrame);
  const integrated=new Set(mounts.filter(isFrameIntegratedMount).flatMap(m=>(m.items||[]).map(s=>s.id)));
  const carried=[], leftBehind=[];
  // Superheavy weapons go last: each needs a mount and a second, empty one,
  // and the other weapons have the first claim on mounts.
  const slots=equippedSlots();
  const order=[...slots.filter(s=>slotMount(s)!=="Superheavy"), ...slots.filter(s=>slotMount(s)==="Superheavy")];
  order.forEach(slot=>{
    const w=M.weapon[slot.id];
    // The new frame's own integrated weapon is already in place.
    if(integrated.has(slot.id)) return;
    // Integrated Weapon's mount takes no mods, so a modded weapon looks elsewhere.
    const ti=mounts.findIndex((mt,i)=>!(slot.mod && mt.type==="Integrated")
      && mountAllows(mounts, i).includes(w.mount));
    const xi = ti>=0 && w.mount==="Superheavy"
      ? extraMountCandidates(mounts, ti).find(i=>!mounts[i].items.length) : undefined;
    if(ti<0 || (w.mount==="Superheavy" && xi===undefined)){ leftBehind.push(w); return; }
    const moved={id:slot.id, mod:slot.mod||null};
    if(xi!==undefined) moved.extra=xi;
    mounts[ti].items.push(moved);
    carried.push({w, mount:mounts[ti].type});
  });
  return {mounts, carried, leftBehind};
}
function pickFrame(id){
  const fr=M.frame[id];
  if(!fr || state.mech.frameId===id) return;
  const commit=mounts=>{ state.mech.frameId=id; state.mech.mounts=mounts; render(); };
  if(!equippedSlots().length){ commit(mountsForFrame(fr)); return; }

  const plan=planFrameSwap(fr);
  const losses=[
    ...plan.carried.map(c=>({kind:"keep", text:`${c.w.name} → ${tr(c.mount)}`})),
    ...plan.leftBehind.map(w=>({kind:"drop", text:tText("swap.no_mount", {name:w.name})})),
  ];
  const actions=[];
  if(plan.carried.length) actions.push({
    label:"↳ "+tText("swap.carry", {n:plan.carried.length}),
    run:()=>commit(plan.mounts),
  });
  actions.push({label:"✕ "+tText("swap.strip"), danger:true, run:()=>commit(mountsForFrame(fr))});

  const tail = tText(!plan.leftBehind.length ? "swap.all" : !plan.carried.length ? "swap.none" : "swap.some"); // i18n-dynamic: swap.all, swap.none, swap.some
  confirmDialog({
    title:tText("swap.title"),
    lead:t("swap.lead", {frame:dispName(fr), tail}),
    losses,
    actions,
  });
}

/* ---------------- CORE BONUS MOUNTS ----------------
   Selecting or removing a CORE bonus can add or take away a mount. A mount
   that goes away with weapons on it is named first, as with a frame swap. */
function changeCores(nextCores){
  const f=state.mech.frameId && M.frame[state.mech.frameId];
  const plan=f ? planCoreMounts(f, nextCores, state.mech.mounts) : null;
  const addsRetrofit=nextCores.includes(MOUNT_RETROFIT_CB) && !state.cores.includes(MOUNT_RETROFIT_CB);
  const commit=()=>{
    state.cores=nextCores;
    if(plan) state.mech.mounts=plan.mounts;
    render();
    // Mount Retrofitting is not done until a mount is chosen; ask right away.
    if(f && addsRetrofit) openRetrofitChooser();
  };
  if(!plan || !plan.lost.length){ commit(); return; }
  confirmDialog({
    title:tText("cbmount.remove_title"),
    lead:t("cbmount.remove_lead"),
    losses:plan.lost.map(s=>({kind:"drop", text:M.weapon[s.id].name})),
    actions:[{label:"✕ "+tText("cbmount.remove_confirm"), danger:true, run:commit}],
  });
}

/* A choice between mounts. `choices`: [{label, lost:[slots]}] — what each
   choice takes off is listed under it. With `back`, the dialog replaces the
   open picker's body and Back returns to it; otherwise it opens on its own. */
function mountChoiceDialog({title, lead, choices, pick, back}){
  const body=`<div class="dialog">
    <p>${lead}</p>
    <div class="mountchoices">${choices.map((c,i)=>`<button class="ghostbtn block" data-mchoice="${i}">
      <span class="mc-label">${esc(c.label)}</span>
      ${c.lost.length?`<span class="mc-lost">✕ ${t("mountchoice.lost", {list:c.lost.map(s=>M.weapon[s.id].name).join(", ")})}</span>`:""}
    </button>`).join("")}</div>
    ${back?`<div class="dialog-actions"><button class="ghostbtn" id="mchoice-back">← ${t("picker.back")}</button></div>`:""}
  </div>`;
  let restore=null;
  if(back){
    const h3=$("#modal .mhd h3"), was=h3.textContent, scroll=$("#modal .mbd").scrollTop;
    h3.textContent=title;
    $("#modal .panel").classList.add("narrow");
    setModalBody(body);
    restore=()=>{ h3.textContent=was; $("#modal .panel").classList.remove("narrow"); back(); $("#modal .mbd").scrollTop=scroll; };
    $("#mchoice-back").onclick=restore;
  } else {
    modal(title, body);
    $("#modal .panel").classList.add("narrow");
  }
  $$("#modal [data-mchoice]").forEach(b=>b.onclick=()=>pick(choices[+b.dataset.mchoice]));
  const first=$("#modal [data-mchoice]");
  if(first) first.focus();
}
/* "Main/Aux — Assault Rifle" / "Heavy — empty": tells two mounts of one type apart. */
function mountLabel(mt){
  const names=mt.items.map(s=>M.weapon[s.id] && M.weapon[s.id].name).filter(Boolean);
  return `${tr(mt.type)} — ${names.length?names.join(", "):tText("mountchoice.empty")}`;
}

/* Mount Retrofitting: pick the mount that becomes Main/Aux. Choosing again
   first gives the current one back its own type. */
function openRetrofitChooser(){
  const f=M.frame[state.mech.frameId];
  if(!f) return;
  const base=planCoreMounts(f, state.cores.filter(id=>id!==MOUNT_RETROFIT_CB), state.mech.mounts);
  const choices=retrofitCandidates(base.mounts).map(mi=>{
    const plan=retrofitMount(base.mounts, mi);
    return {label:mountLabel(base.mounts[mi]), lost:[...base.lost, ...plan.lost], mounts:plan.mounts};
  });
  if(!choices.length){ notice((M.core[MOUNT_RETROFIT_CB]?.name||""), t("retro.none")); return; }
  mountChoiceDialog({
    title:(M.core[MOUNT_RETROFIT_CB]?.name||""),
    lead:t("retro.lead"),
    choices,
    pick:c=>{ closeModal(); state.mech.mounts=c.mounts; render(); },
  });
}

/* A superheavy weapon's second mount. With one empty candidate there is
   nothing to ask; otherwise the pilot chooses, seeing what comes off. */
function chooseExtraMount(mounts, hi, name, put, back){
  const cands=extraMountCandidates(mounts, hi);
  if(cands.length===1 && !mounts[cands[0]].items.length){ put(cands[0]); return; }
  mountChoiceDialog({
    title:tText("superheavy.title"),
    lead:t("superheavy.lead", {name}),
    choices:cands.map(xi=>({label:mountLabel(mounts[xi]), lost:mounts[xi].items, xi})),
    pick:c=>put(c.xi),
    back,
  });
}
/* Loadout: a superheavy weapon already installed without its second mount
   (an older save, or the mount was taken away). */
function openExtraMountChooser(mi, wi){
  const slot=state.mech.mounts[mi] && state.mech.mounts[mi].items[wi];
  if(!slot) return;
  chooseExtraMount(state.mech.mounts, mi, M.weapon[slot.id].name, xi=>{
    closeModal();
    claimExtraMount(state.mech.mounts, mi, wi, xi);
    render();
  });
}
