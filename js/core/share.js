/* ============ CORE: share-link codec ============
   packBuild()/unpackBuild() and the compressed ?s= payload. DOM-free (uses
   only TextEncoder/CompressionStream, present in browsers and Node).
   Reading/writing the URL lives in js/sheet.js.
   ============================================================ */
/* ---- share link ---- */
const SHARE_V = 1;
const b64uEnc = bytes => {
  let s=""; const CH=0x8000;
  for(let i=0;i<bytes.length;i+=CH) s+=String.fromCharCode.apply(null, bytes.subarray(i,i+CH));
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const b64uDec = str => {
  const b64=str.replace(/-/g,"+").replace(/_/g,"/");
  const bin=atob(b64 + "=".repeat((4 - b64.length%4) % 4));
  return Uint8Array.from(bin, c=>c.charCodeAt(0));
};
/* Only ids and numbers travel: empty fields are omitted entirely, so a
   typical build compresses to well under a kilobyte and survives being
   pasted into any messenger. */
function packBuild(){
  const p=state.pilot, o={v:SHARE_V};
  if(p.name) o.n=p.name;
  if(p.callsign) o.c=p.callsign;
  if(p.background) o.b=p.background;
  if(p.ll) o.l=p.ll;
  if(Object.keys(state.skills).length) o.s=state.skills;
  if(state.customSkills.length) o.cs=state.customSkills.map(x=>[x.id,x.name,x.description||""]);
  if(Object.keys(state.talents).length) o.t=state.talents;
  const h=HASE.map(x=>state.hase[x.k]);
  if(h.some(Boolean)) o.h=h;
  const lic=Object.entries(state.licenses).filter(([,v])=>v);
  if(lic.length) o.lc=Object.fromEntries(lic);
  if(state.gear.armor) o.ga=state.gear.armor;
  if(state.gear.weapons.length) o.gw=state.gear.weapons;
  if(state.gear.gear.length) o.gg=state.gear.gear;
  if(state.cores.length) o.cb=state.cores;
  if(state.mech.frameId){
    o.f=state.mech.frameId;
    o.m=(state.mech.mounts||[]).map(mt=>[mt.type,(mt.items||[]).map(s=>s.mod?[s.id,s.mod]:[s.id])]);
    if(state.mech.systems.length) o.sy=state.mech.systems;
  }
  return o;
}
function unpackBuild(o){
  if(!o || typeof o!=="object") return null;
  return {
    pilot:{name:o.n||"", callsign:o.c||"", background:o.b||"", ll:o.l||0},
    skills:o.s||{},
    customSkills:(o.cs||[]).map(a=>({id:a[0], name:a[1], description:a[2]||""})),
    talents:o.t||{},
    hase:HASE.reduce((acc,x,i)=>{ acc[x.k]=(o.h&&o.h[i])||0; return acc; },{}),
    licenses:o.lc||{},
    gear:{armor:o.ga||null, weapons:o.gw||[], gear:o.gg||[]},
    cores:o.cb||[],
    mech:{
      frameId:o.f||null,
      mounts:(o.m||[]).map(a=>({type:a[0], items:(a[1]||[]).map(s=>({id:s[0], mod:s[1]||null}))})),
      systems:o.sy||[],
    },
  };
}
/* deflate-raw ships in every current browser and needs no library, which is
   what keeps this project build-step-free. The "u" prefix is the honest
   fallback for anything that lacks it. */
async function encodeShare(){
  const bytes=new TextEncoder().encode(JSON.stringify(packBuild()));
  if(typeof CompressionStream==="function"){
    try{
      const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const buf=await new Response(stream).arrayBuffer();
      return "z"+b64uEnc(new Uint8Array(buf));
    }catch(e){ console.warn("[Lancer Registry] compression unavailable, the link will be longer:", e); }
  }
  return "u"+b64uEnc(bytes);
}
async function decodeShare(payload){
  const flag=payload[0], body=b64uDec(payload.slice(1));
  let bytes=body;
  if(flag==="z"){
    if(typeof DecompressionStream!=="function") throw new Error("DecompressionStream is not supported");
    const stream=new Blob([body]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  } else if(flag!=="u") throw new Error("unknown link format");
  return JSON.parse(new TextDecoder().decode(bytes));
}
