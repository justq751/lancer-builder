/* ============ EXPORT / IMPORT ============ */
function exportBuild(){
  const data=JSON.stringify({_app:"lancer-registry",v:1,state},null,2);
  const blob=new Blob([data],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${(state.pilot.callsign||"pilot").replace(/\s+/g,"_")}_lancer.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
function importBuild(file){
  const r=new FileReader();
  r.onerror=()=>notice(tText("dialog.read_failed.title"), t("dialog.read_failed.lead"));
  r.onload=()=>{
    let d=null;
    try{ d=JSON.parse(r.result); }catch(e){ d=null; }
    if(!d || typeof d!=="object" || !d.state){
      notice(tText("dialog.not_build.title"), t("dialog.not_build.lead"));
      return;
    }
    const apply=()=>{
      const dropped=applyBuildState(d.state);
      saveHold=null; // replacing the build was the user's explicit choice
      activeTab="pilot";
      render();
      if(dropped.length) reportDropped(tText("dialog.dropped.loaded_title"), dropped);
    };
    // Overwriting an empty build costs nothing; overwriting real work does.
    if(buildIsEmpty()){ apply(); return; }
    confirmDialog({
      title:tText("dialog.import.title"),
      lead:t("dialog.import.lead"),
      losses:buildLossSummary(),
      actions:[
        {label:"⬇ "+tText("dialog.import.export_first"), run:exportBuild},
        {label:"⬆ "+tText("dialog.import.replace"), danger:true, run:apply},
      ],
    });
  };
  r.readAsText(file);
}
