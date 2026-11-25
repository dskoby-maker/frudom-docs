/* ===== Стрелки на клавиатуре — переход между полями по всему сайту (25.11.2026, просьба Даниила) =====
   ↑/↓ — поле выше/ниже (сначала в том же столбце), ←/→ — соседнее поле в строке, когда курсор у края текста.
   Срабатывает последним (window, всплытие): если поле само обрабатывает стрелки (подсказки, списки, таблица «Заявки»),
   его обработчик вызывает preventDefault — и здесь ничего не делается. Отключить у поля: data-noarrow. */
const KNAV_SKIP = /^(hidden|checkbox|radio|file|range|color|date|time|datetime-local|month|week|button|submit|reset|image)$/;
function knavOk(el){
  if(!el || el.disabled || el.readOnly || el.closest("[data-noarrow],[inert]")) return false;
  if(el.tagName==="TEXTAREA") return true;
  return el.tagName==="INPUT" && !KNAV_SKIP.test((el.type||"text").toLowerCase());
}
function knavVis(el){ if(!el.offsetWidth && !el.offsetHeight) return false; const r=el.getBoundingClientRect(); if(r.width<4||r.height<4) return false;
  const s=getComputedStyle(el); return s.visibility!=="hidden" && +s.opacity!==0; }
function knavRoot(el){ return el.closest("dialog[open]") || el.closest(":popover-open") || document; }
function knavFind(el, dir){
  const r=el.getBoundingClientRect(), cy=r.top+r.height/2, cx=r.left+r.width/2;
  let best=null, bs=Infinity;
  for(const c of knavRoot(el).querySelectorAll("input,textarea")){
    if(c===el || !knavOk(c) || !knavVis(c)) continue;
    if(knavRoot(c)!==knavRoot(el)) continue;
    const q=c.getBoundingClientRect(), qy=q.top+q.height/2, qx=q.left+q.width/2;
    const gx=Math.max(0, q.left-r.right, r.left-q.right), gy=Math.max(0, q.top-r.bottom, r.top-q.bottom);
    const ov=Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top);           // насколько поля на одной строке
    let s;
    if(dir==="down"||dir==="up"){
      if(dir==="down" ? qy<=cy+r.height/2 : qy>=cy-r.height/2) continue;
      if(ov>Math.min(r.height,q.height)*.5) continue;                         // та же строка — не «ниже»
      s=gy + gx*2 + Math.abs(qx-cx)*.05;
    } else {
      if(ov<Math.min(r.height,q.height)*.5) continue;                         // только в той же строке
      if(dir==="right" ? qx<=cx : qx>=cx) continue;
      s=gx + Math.abs(qy-cy);
    }
    if(s<bs){ bs=s; best=c; }
  }
  return best;
}
const KNAV_VAL = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").get;
function knavEdge(el, dir){                                                    // курсор у края текста?
  if(el.type==="number") return !String(el.value||"").length;
  const v=String((el.tagName==="INPUT" ? KNAV_VAL.call(el) : el.value)||"");  // текст как на экране (у сумм — с пробелами)
  let a, b; try{ a=el.selectionStart; b=el.selectionEnd; }catch(_){ return true; }
  if(a==null) return true; const n=v.length;
  if(el.tagName==="TEXTAREA"){                                                 // в многострочном поле ↑/↓ — по строкам текста
    if(dir==="up") return a===b && !v.slice(0,a).includes("\n");
    if(dir==="down") return a===b && !v.slice(b).includes("\n");
  }
  if(dir==="left") return a===0 && b===0 || (a===0 && b===n && n>0);
  if(dir==="right") return a===n && b===n || (a===0 && b===n && n>0);
  return true;
}
window.addEventListener("keydown", e=>{
  if(e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const dir={ArrowDown:"down",ArrowUp:"up",ArrowLeft:"left",ArrowRight:"right"}[e.key]; if(!dir) return;
  const el=e.target; if(!knavOk(el) || el.getAttribute("aria-expanded")==="true") return;
  if(!knavEdge(el, dir)) return;
  const n=knavFind(el, dir); if(!n) return;
  e.preventDefault();
  n.focus({preventScroll:true});
  try{ n.scrollIntoView({block:"nearest", inline:"nearest"}); }catch(_){}
  if(n.tagName!=="TEXTAREA"){ try{ n.select(); }catch(_){} }
  else { try{ const p=dir==="up"?n.value.length:0; n.setSelectionRange(p,p); }catch(_){} }
});
