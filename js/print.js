/* ============ PRINT SHEET ============ */
function buildPrintSheet(d){
  const ps=$("#print-sheet"); if(!ps) return;
  const p=state.pilot;
  ps.innerHTML=`<h1 style="font-family:Arial">${esc(p.callsign||"PILOT")} — ${esc(p.name||"")}</h1>
    <p>LL${d.ll} · GRIT +${d.grit} · ${esc(M.bg[p.background]?.name||"")}</p>
    <p><b>${t("print.skills")}</b> ${Object.entries(state.skills).map(([id,v])=>esc(skillInfo(id)?.name)+" +"+v).join(", ")||"—"}</p>
    <p><b>${t("print.talents")}</b> ${Object.entries(state.talents).map(([id,v])=>esc(M.talent[id]?.name)+" "+["I","II","III"][v-1]).join(", ")||"—"}</p>
    <p><b>${t("print.hase")}</b> ${HASE.map(h=>h.en+" "+state.hase[h.k]).join(" · ")}</p>
    <p><b>${t("print.cores")}</b> ${state.cores.map(id=>esc(M.core[id]?.name)).join(", ")||"—"}</p>
    ${d.frame?`<h2 style="font-family:Arial">${t("print.mech", {name:dispName(d.frame), source:d.frame.source})}</h2>
      <p>HP ${d.mech.hp} · Armor ${d.mech.armor} · Evasion ${d.mech.evasion} · E-Def ${d.mech.edef} · Heat ${d.mech.heatcap} · Speed ${d.mech.speed} · Save ${d.mech.save} · SP ${d.sp.used}/${d.sp.cap}</p>
      <p><b>${t("print.weapons")}</b> ${state.mech.mounts.flatMap(mt=>mt.items.map(slot=>"["+tr(mt.type)+"] "+esc(M.weapon[slot.id].name)+(slot.mod?" + "+esc(M.mod[slot.mod]?.name||""):""))).join(", ")||"—"}</p>
      <p><b>${t("print.systems")}</b> ${state.mech.systems.map(id=>esc(M.system[id].name)).join(", ")||"—"}</p>`:""}`;
}
