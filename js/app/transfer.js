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
  r.onerror=()=>notice("Файл не прочитан",
    "Браузер не смог прочитать этот файл. Проверьте, что он не удалён и не открыт в другой программе.");
  r.onload=()=>{
    let d=null;
    try{ d=JSON.parse(r.result); }catch(e){ d=null; }
    if(!d || typeof d!=="object" || !d.state){
      notice("Файл не распознан",
        "Это не файл сборки реестра. Загрузите файл, который выгружает кнопка <b>⬇ СОХРАНИТЬ</b> — обычно это что-то вроде <b>ПОЗЫВНОЙ_lancer.json</b>.");
      return;
    }
    const apply=()=>{
      const dropped=applyBuildState(d.state);
      saveHold=null; // replacing the build was the user's explicit choice
      activeTab="pilot";
      render();
      if(dropped.length) reportDropped("Сборка загружена частично", dropped);
    };
    // Overwriting an empty build costs nothing; overwriting real work does.
    if(buildIsEmpty()){ apply(); return; }
    confirmDialog({
      title:"Загрузка сборки",
      lead:"Загруженная сборка заменит текущую. Текущая сборка не сохранится нигде, кроме уже выгруженных файлов.",
      losses:buildLossSummary(),
      actions:[
        {label:"⬇ Сначала выгрузить текущую", run:exportBuild},
        {label:"⬆ Заменить сборку", danger:true, run:apply},
      ],
    });
  };
  r.readAsText(file);
}
