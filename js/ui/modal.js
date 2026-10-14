/* ============ MODAL ============ */
/* Every place that redraws the modal body (picker lists, "back to list",
   detail views, profile-chip re-renders, etc.) must reset scroll — not just
   the initial modal() call. Those redraws bypass modal() and write to
   .mbd.innerHTML directly (see openWeaponPicker/openSystemPicker/
   openModPicker/viewLicenseItemPreview), so scroll position from whatever
   was previously shown there would otherwise carry over. Use this instead
   of touching #modal .mbd innerHTML by hand. */
/* keepScroll=true means the CALLER is handling scroll capture/restore
   itself (see drawList() in the pickers — it saves mbd.scrollTop before
   calling this, then restores it after the list is fully populated, since
   restoring too early — before the real rows exist — gets clamped back to
   ~0 by the browser). In that case this function must not touch scroll at
   all, including the deferred rAF reset in resetModalScroll(): that reset
   fires on the *next frame*, i.e. after the caller's restore, and would
   silently undo it. Only genuine navigation (no keepScroll) gets the full
   reset treatment. */
function setModalBody(html, keepScroll){
  const mbd=$("#modal .mbd");
  mbd.innerHTML=html;
  if(!keepScroll) resetModalScroll();
}
/* Plain synchronous scrollTop=0 isn't always enough: openFrame() etc. still
   mutate .mhd (inserting the "ВЫБРАТЬ..." button) *after* modal()/
   setModalBody() already ran, and floated portrait images can resize the
   layout once they finish loading — either can nudge scroll back down a
   moment later, including via the browser's own scroll-anchoring trying to
   "helpfully" preserve visual position across that layout shift. Resetting
   again on the next frame (after all of that has settled) closes both
   gaps; overflow-anchor:none on the containers (see CSS) belts-and-braces
   it by turning off anchoring for these two entirely. */
function resetModalScroll(){
  const mbd=$("#modal .mbd"), mo=$("#modal");
  mbd.scrollTop=0; mo.scrollTop=0;
  requestAnimationFrame(()=>{ mbd.scrollTop=0; mo.scrollTop=0; });
}
let modalReturnFocus=null, modalReturnKey=null;
/* A selector that finds "the same control" again after render() has replaced
   the DOM — nearly every modal action ends in closeModal(); render(). */
function focusKeyOf(el){
  if(!el || el===document.body) return null;
  if(el.id) return "#"+CSS.escape(el.id);
  const d=Object.entries(el.dataset||{})[0];
  return d ? `[data-${d[0].replace(/[A-Z]/g,c=>"-"+c.toLowerCase())}="${CSS.escape(d[1])}"]` : null;
}
function modal(title,html){
  const mhd=$("#modal .mhd");
  // Reset the header to just [h3, close button] on every open — openFrame(),
  // openLicenseDetail() etc. inject extra buttons (e.g. "ВЫБРАТЬ ЭТО ШАССИ")
  // directly into .mhd, and since the modal's DOM persists between opens
  // (only toggled via a CSS class), those buttons would otherwise pile up
  // one per open instead of being replaced.
  [...mhd.children].forEach(el=>{
    if(el.tagName!=="H3" && !el.classList.contains("mclose")) el.remove();
  });
  mhd.querySelector("h3").textContent=title;
  setModalBody(html);
  modalReturnFocus=document.activeElement;
  modalReturnKey=focusKeyOf(modalReturnFocus);
  $("#modal").classList.add("show");
  const panel=$("#modal .panel");
  const focusable=panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  (focusable[0]||panel).focus();
}
function closeModal(){
  $("#modal").classList.remove("show");
  $("#modal .panel").classList.remove("narrow");
  const back=modalReturnFocus, key=modalReturnKey;
  modalReturnFocus=null; modalReturnKey=null;
  if(!back) return;
  // Deferred past the caller's render(): restoring now would focus a node that
  // is about to be replaced, and the keyboard user would land on <body>.
  queueMicrotask(()=>{
    if($("#modal").classList.contains("show")) return; // a follow-up dialog owns focus now
    const target = back.isConnected ? back
      : (key && document.querySelector(key)) || document.querySelector(`#tab-btn-${activeTab}`);
    if(target) target.focus();
  });
}

/* ============ DIALOGS ============ */
/* Confirmation for anything that destroys work. It replaces confirm(), which
   could neither name what disappears nor look like it belongs to this
   product. Actions run least-destructive first — that ordering is also the
   focus order, since modal() focuses the first control. Escape, the close
   button and Отмена all cancel. */
function confirmDialog({title, lead, losses, actions, cancelLabel="Отмена"}){
  const list=(losses&&losses.length)
    ? `<ul class="losslist ${losses.length>8?"scroll":""}">${losses.map(t=>
        typeof t==="string" ? `<li>${esc(t)}</li>` : `<li class="${t.kind||""}">${esc(t.text)}</li>`
      ).join("")}</ul>` : "";
  modal(title, `<div class="dialog">
    <p>${rich(lead)}</p>
    ${list}
    <div class="dialog-actions">
      ${actions.map((a,i)=>`<button class="ghostbtn ${a.danger?"warn":""}" data-act="${i}">${esc(a.label)}</button>`).join("")}
      <button class="ghostbtn" data-act="cancel">${esc(cancelLabel)}</button>
    </div>
  </div>`);
  $("#modal .panel").classList.add("narrow");
  $$("#modal [data-act]").forEach(b=>{
    b.onclick=()=>{
      const k=b.dataset.act;
      closeModal();
      if(k!=="cancel") actions[+k].run();
    };
  });
}
/* Non-destructive report: something already happened, the user only needs to
   know what. Same shell as confirmDialog so the two read as one component. */
function notice(title, lead, items, kind){
  const cls = kind==="plain" ? "plain" : "drop";
  const list=(items&&items.length)
    ? `<ul class="losslist ${items.length>8?"scroll":""}">${items.map(t=>`<li class="${cls}">${esc(t)}</li>`).join("")}</ul>` : "";
  modal(title, `<div class="dialog">
    <p>${rich(lead)}</p>
    ${list}
    <div class="dialog-actions"><button class="ghostbtn" data-act="ok">Понятно</button></div>
  </div>`);
  $("#modal .panel").classList.add("narrow");
  $("#modal [data-act=ok]").onclick=closeModal;
}
/* The restore lost pieces because packs failed to load — not because the
   content is gone. Say so, and offer the one fix that works: load again. */
function reportPackFailure(dropped){
  confirmDialog({
    title:"Часть данных не загрузилась",
    lead:`Не удалось загрузить: <b>${esc(saveHold.join(", "))}</b> — вероятно, сбой сети. Пока эти данные не загружены, часть сборки не видна. <b>Сохранённая сборка не тронута</b>: автосохранение приостановлено, пока данные не загрузятся.`,
    losses:dropped,
    actions:[{label:"⟳ Повторить загрузку", run:()=>location.reload()}],
    cancelLabel:"Продолжить без них",
  });
}
function reportDropped(title, dropped){
  notice(title,
    `Часть сборки не удалось восстановить: этих записей нет в загруженных данных. Обычно это значит, что сборка сделана с другим набором контент-паков или в другой версии реестра. Остальное на месте.`,
    dropped);
}
document.addEventListener("keydown", e=>{
  if(e.key!=="Enter" && e.key!==" ") return;
  const row=e.target;
  if(!row.matches || !row.matches('.listrow.clickable[role="button"]')) return;
  e.preventDefault();
  const key=focusKeyOf(row);
  row.click();
  // The click redraws the list (or swaps in the card view); put focus back on
  // the same row, or on the first control of whatever replaced the list.
  const again=(key && document.querySelector(`#modal ${key}`)) || $("#modal .mbd button");
  if(again) again.focus();
});
document.addEventListener("keydown", e=>{
  if(!$("#modal").classList.contains("show")) return;
  if(e.key==="Escape"){ closeModal(); return; }
  if(e.key==="Tab"){
    const panel=$("#modal .panel");
    const focusable=[...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el=>!el.disabled && el.offsetParent!==null);
    if(!focusable.length) return;
    const first=focusable[0], last=focusable[focusable.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  }
});
