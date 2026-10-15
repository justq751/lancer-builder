/* ---------------- LICENSE DISPLAY HELPERS ----------------
   HTML/label helpers on top of the rules in js/core/rules.js. */
/* Marks where the installable half ends. In a flat list of sixty items the
   boundary is invisible without it. */
// A function, not a constant: the interface language is known only at boot.
const lockedDivider = () => `<div class="pickdiv">${t("picker.locked_divider")}</div>`;
const dividerBefore = (list,i) => (!unlocked(list[i]) && (i===0 || unlocked(list[i-1]))) ? lockedDivider() : "";
/* item.license (and licenseKeyFor(frame)) are always the frame's English
   name/variant — that's the logic key licenses are tracked by, and it must
   never be swapped for translated text (see the frame.name comment near
   loadBaseData). This resolves that English key to the matching frame's
   *localized* display name, purely for showing it in UI text like the
   weapon/system license badges below — falls back to the raw key if no
   matching frame is found (shouldn't normally happen). */
function licenseDisplayName(key){
  const fr = (L.frames||[]).find(f=>licenseKeyFor(f)===key);
  return fr ? dispName(fr) : key;
}
/* Weapons/systems/mods keep showing which license+rank they're tied to even
   after that requirement is met — closed amber lock while locked, open
   green lock once unlocked — instead of the requirement just disappearing
   and being replaced by mount/type/source. Items with no real license gate
   (license_level 0, e.g. GMS) have nothing to show either way, so the
   caller's fallback text (mount/type/source) is used instead. */
function licenseBadge(item, fallback){
  if(!(item.license_level>0)) return {cls:"", text:fallback};
  const lk=!unlocked(item);
  return {cls: lk?"lock":"unlocked", text:(lk?"🔒 ":"🔓 ")+esc(licenseDisplayName(item.license))+" "+item.license_level};
}
