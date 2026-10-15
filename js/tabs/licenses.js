/* ============ LICENSES ============ */
function stepLicense(name, dir){
  const v=Math.max(0,Math.min(3,(state.licenses[name]||0)+dir));
  if(v===0) delete state.licenses[name]; else state.licenses[name]=v;
}

/* What a rank of this license unlocks: every frame that shares this license
   track (the base frame plus any variants — see licenseKeyFor()) that opens
   at that exact rank, and any weapons/systems tied to the license at that
   rank. Passing a variant's own frame in still shows the base frame's
   unlocks (and vice versa), since they're the same license. */
function licenseRanksHTML(f){
  const key = licenseKeyFor(f);
  const siblingFrames = L.frames.filter(fr=>licenseKeyFor(fr)===key);
  const items=[
    ...L.weapons.filter(it=>it.license===key).map(it=>({...it,_kind:"w"})),
    ...L.systems.filter(it=>it.license===key).map(it=>({...it,_kind:"s"})),
    ...(L.mods||[]).filter(it=>it.license===key).map(it=>({...it,_kind:"m"})),
  ];
  const byRank={1:[],2:[],3:[]};
  items.forEach(it=>{ const r=it.license_level||1; if(byRank[r]) byRank[r].push(it); });
  const line=it=>{
    // Each line is a button (opens the item's preview); the li stays a plain
    // list item so the list still reads as a list.
    const li=(id,mk,hint)=>`<li class="clickable"><button type="button" class="linkrow" data-viewitem="${id}">
      <span class="mk" aria-hidden="true">${mk}</span> ${esc(it.name)} <span class="hint">${hint}</span></button></li>`;
    if(it._kind==="w") return li(`w:${it.id}`, "⚔", `${tr(it.mount)} · ${dmgStr(it)}`);
    if(it._kind==="m") return li(`m:${it.id}`, "🔧", `мод · ${it.sp||0} SP`);
    return li(`s:${it.id}`, "⚙", `${it.sp} SP`);
  };
  return [1,2,3].map(rank=>{
    const framesHere = siblingFrames.filter(fr=>fr.license_level===rank);
    const list = byRank[rank];
    if(!framesHere.length && !list.length) return "";
    return `<div style="margin-bottom:14px">
      <h4 style="font-family:'Chakra Petch',sans-serif;font-size:15px;margin-bottom:6px;color:var(--accent)">РАНГ ${rank}</h4>
      ${framesHere.map(fr=>`<div class="desc" style="margin-bottom:6px">🔓 Открывает само шасси <b>${esc(dispName(fr))}</b>${fr.variant?` <span class="hint">(вариант лицензии ${esc(fr.variant)})</span>`:""}.</div>`).join("")}
      ${list.length?`<ul class="minilist">${list.map(line).join("")}</ul>`:""}
    </div>`;
  }).join("") || `<div class="hint">На эту лицензию не привязано ни оружия, ни систем, ни модов — только шасси.</div>`;
}
function openLicenseDetail(fid){
  const f=M.frame[fid], key=licenseKeyFor(f), v=licRank(key), d=derived();
  const remaining=d.b.license.cap-d.b.license.used;
  const siblings=L.frames.filter(fr=>licenseKeyFor(fr)===key && fr.id!==f.id).map(fr=>dispName(fr));
  const img=frameImageURL(f);
  const imgHTML = img ? `<a href="${img}" target="_blank" rel="noopener" title="Открыть источник изображения">
    <img src="${img}" alt="" loading="lazy" onerror="this.closest('a').remove()"
      style="float:right; width:300px; height:300px; object-fit:contain; margin:0 0 12px 16px; border-radius:8px; background:var(--panel-2); cursor:zoom-in"></a>` : "";
  modal(dispName(f), `
    ${imgHTML}
    <div class="meta" style="margin-bottom:14px;color:${srcColor(f.source)}">${esc(SRC_NAME[f.source]||f.source)} · ${f.mechtype?.map(tr).join(" / ")||""}</div>
    ${siblings.length?`<div class="desc" style="margin-bottom:14px">Эта лицензия общая с ${siblings.map(n=>`<b>${esc(n)}</b>`).join(", ")} — ранг один на всех, поднимая его здесь, вы поднимаете его и там.</div>`:""}
    <div class="stepper" style="margin-bottom:18px">
      <button class="stepbtn" id="lic-minus" ${v<=0?"disabled":""} aria-label="Понизить ранг лицензии">−</button>
      <span class="pips" aria-hidden="true">${[1,2,3].map(n=>`<span class="pip ${v>=n?'on':''}"></span>`).join("")}</span>
      <button class="stepbtn" id="lic-plus" ${(v<3&&remaining>=1)?"":"disabled"} aria-label="Повысить ранг лицензии">+</button>
      <span class="hint" style="margin-left:10px">ранг ${v}/3</span>
    </div>
    ${licenseRanksHTML(f)}`);
  $("#lic-minus").onclick=()=>{ stepLicense(key,-1); render(); openLicenseDetail(fid); };
  $("#lic-plus").onclick=()=>{ stepLicense(key,1); render(); openLicenseDetail(fid); };
  $$("#modal [data-viewitem]").forEach(el=>el.onclick=()=>{
    const [kind,id]=el.dataset.viewitem.split(":");
    viewLicenseItemPreview(kind, id, ()=>openLicenseDetail(fid));
  });
}

/* Read-only preview of a weapon/system from the license-rank breakdown —
   no install/remove action, since we're on the ЛИЦЕНЗИИ tab, not editing
   the loadout. "← Назад" returns to the license rank detail it came from. */
function viewLicenseItemPreview(kind, id, back){
  tagOpenSet=new Set(); profileViewIdx=0;
  const draw=()=>{
    const item = kind==="w" ? M.weapon[id] : kind==="m" ? M.mod[id] : M.system[id];
    const html = kind==="w" ? weaponCardHTML(item) : kind==="m" ? modCardHTML(item) : systemCardHTML(item);
    $("#modal .mhd h3").textContent=item.name;
    setModalBody(
      `<button class="ghostbtn mb-14" id="lip-back">← Назад к лицензии</button>`
      + html);
    if(kind==="w") wireTagGlossary("#wp-tags","#wp-tagdesc",weaponDisplayTags(item, profileViewIdx));
    else if(kind==="m") wireTagGlossary("#md-tags","#md-tagdesc",item.tags||[]);
    else wireTagGlossary("#sy-tags","#sy-tagdesc",item.tags||[]);
    if(kind==="w") wireProfileChips("#wp-profiles", draw);
    $("#lip-back").onclick=back;
  };
  draw();
}

function renderLicenses(){
  const d=derived();
  const over=d.b.license.used>d.b.license.cap;
  const remaining=d.b.license.cap-d.b.license.used;
  const licFrames=L.frames.filter(f=>f.source!=="GMS");
  // group by manufacturer
  const groups={};
  licFrames.forEach(f=>(groups[f.source]=groups[f.source]||[]).push(f));
  $("#tab").innerHTML = sechead("// 05 · ЛИЦЕНЗИИ","Лицензии производителей",
    `Тратьте очки лицензий, чтобы открывать шасси, оружие и системы производителей. Каждый ранг лицензии = 1 очко (макс. 3). GMS доступен бесплатно. Потрачено ${d.b.license.used} из ${d.b.license.cap}. Кликните по карточке, чтобы увидеть, что открывает каждый ранг.`)
    + (over?`<div class="warnbox">⚠ Превышено очков лицензий на ${d.b.license.used-d.b.license.cap}.</div>`:"")
    + Object.entries(groups).map(([src,fr])=>`
      <h3 style="font-family:'Chakra Petch',sans-serif;font-size:16.5px;margin:18px 0 10px;color:${srcColor(src)}">// ${esc(SRC_NAME[src]||src)}</h3>
      <div class="grid cards">${fr.map(f=>{
        const key=licenseKeyFor(f);
        const v=licRank(key);
        const nUnlock = [...L.weapons,...L.systems,...(L.mods||[])].filter(it=>it.license===key && (it.license_level||0)<=v).length;
        const nm=dispName(f);
        return `<div class="item has-cardlink ${v?'sel':''} clickable" data-openlic="${f.id}">
          <div class="src" style="background:${srcColor(src)}"></div>
          <div class="top">${cardLinkHTML("license", f.id, esc(nm), "nm")}<div class="badge">${f.mechtype?.map(tr).join(" / ")||""}</div></div>
          <div style="display:flex; gap:12px; align-items:flex-start; margin-top:6px">
            <div style="flex:1; min-width:0">
              <div class="meta">ШАССИ открывается на ранге ${f.license_level} · открыто предметов: ${nUnlock}</div>
              ${f.variant?`<div class="meta" style="color:var(--accent)">↳ общая лицензия с ${esc(f.variant)}</div>`:""}
            </div>
            ${frameImageURL(f)?`<img class="frame-thumb" src="${frameImageURL(f)}" alt="Портрет шасси ${esc(dispName(f))}" loading="lazy" onerror="this.remove()">`:""}
          </div>
          <div class="stepper" style="margin-top:11px">
            <button class="stepbtn" data-lic="${esc(key)}" data-d="-1" ${v<=0?"disabled":""} aria-label="Понизить ранг лицензии ${esc(key)}">−</button>
            <span class="pips" role="img" aria-label="Ранг ${v} из 3">${[1,2,3].map(n=>`<span class="pip ${v>=n?'on':''}"></span>`).join("")}</span>
            <button class="stepbtn" data-lic="${esc(key)}" data-d="1" ${(v<3&&remaining>=1)?"":"disabled"} aria-label="Повысить ранг лицензии ${esc(key)}">+</button>
          </div></div>`;
      }).join("")}</div>`).join("");
  $$("#tab .stepbtn[data-lic]").forEach(b=>b.onclick=()=>{
    stepLicense(b.dataset.lic, +b.dataset.d);
    render();
  });
}
