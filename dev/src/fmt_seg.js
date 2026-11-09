/* ---------- форматирование ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
/* округление до копеек «как в бухгалтерии и ЕИС»: половина копейки — вверх (1808,325 → 1808,33).
   Сначала убираем ошибку двоичной дроби (13,5 × 133,95 = 1808,3249999…), иначе выходило бы на копейку меньше. */
const r2 = x => { const v=+x; if(!isFinite(v)) return v; const r=Math.round(Number((Math.abs(v)*100).toPrecision(15)))/100; return v<0&&r?-r:r; };
const fm = x => (+x||0).toLocaleString("ru-RU",{minimumFractionDigits:2, maximumFractionDigits:2});
const fq = x => (+x||0).toLocaleString("ru-RU",{maximumFractionDigits:3});
const MON = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
function todayISO(){ const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function fd(iso){ if(!iso) return ""; const [y,m,d]=iso.split("-"); return d+"."+m+"."+y; }
function fdl(iso){ if(!iso) return ""; const [y,m,d]=iso.split("-"); return "«"+d+"» "+MON[+m-1]+" "+y+" г."; }
function fdw(iso){ if(!iso) return ""; const [y,m,d]=iso.split("-"); return (+d)+" "+MON[+m-1]+" "+y+" г."; }
function initials(fio){ const p=(fio||"").trim().split(/\s+/); if(!p[0]) return ""; return p[0]+(p[1]?" "+p[1][0]+".":"")+(p[2]?" "+p[2][0]+".":""); }
const isIP = s => /^(ИП|Индивидуальный)/i.test(s.name||"");

/* сумма прописью */
const O_M=["","один","два","три","четыре","пять","шесть","семь","восемь","девять"], O_F=["","одна","две","три","четыре","пять","шесть","семь","восемь","девять"];
const TEEN=["десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
const TENS=["","","двадцать","тридцать","сорок","пятьдесят","шестьдесят","семьдесят","восемьдесят","девяносто"];
const HUN=["","сто","двести","триста","четыреста","пятьсот","шестьсот","семьсот","восемьсот","девятьсот"];
function plural(n,f){ n=Math.abs(n)%100; const a=n%10; if(n>10&&n<20) return f[2]; if(a>1&&a<5) return f[1]; if(a===1) return f[0]; return f[2]; }
function tri(n,fem){ const t=n%100, r=[HUN[Math.floor(n/100)]]; if(t>=10&&t<20) r.push(TEEN[t-10]); else { r.push(TENS[Math.floor(t/10)]); r.push((fem?O_F:O_M)[t%10]); } return r.filter(Boolean).join(" "); }
function intWords(n,fem){
  if(n===0) return "ноль";
  const G=[[null,fem],[["тысяча","тысячи","тысяч"],true],[["миллион","миллиона","миллионов"],false],[["миллиард","миллиарда","миллиардов"],false]];
  const out=[]; let i=0;
  while(n>0 && i<G.length){ const g=n%1000; if(g){ let w=tri(g,G[i][1]); if(G[i][0]) w+=" "+plural(g,G[i][0]); out.unshift(w); } n=Math.floor(n/1000); i++; }
  return out.join(" ");
}
const cap = s => s ? s[0].toUpperCase()+s.slice(1) : s;
function moneyWords(x){ const c=Math.round(x*100), r=Math.floor(c/100), k=c%100;
  return cap(intWords(r,false)+" "+plural(r,["рубль","рубля","рублей"])+" "+String(k).padStart(2,"0")+" "+plural(k,["копейка","копейки","копеек"])); }

/* ---------- Суммы в полях ввода — с пробелами по тысячам («60 000», «1 250 000,50») ----------
   Правило сайта: любое поле денег показывает разряды пробелами прямо при вводе. Поле узнаётся по MONEY_SEL
   (или атрибуту data-money). Пробелы только на экране: el.value отдаёт число без пробелов («60000,5»), поэтому
   весь остальной код читает поля как раньше. Курсор при вводе не прыгает. Новое поле денег — добавить в MONEY_SEL
   или поставить data-money. */
const MONEY_SEL = [
  "[data-money]",
  /* документ, заявка, цены */ "#d-lines input.price", ".cur[data-cp]", "input[data-p]:not(.q)", "[data-k=maxSum]", "#pd-body [data-k=price]", ".pp",
  /* прибыль, закупка, расходы */ "#po-sum", ".pfbs", ".pfc", ".pfe", ".pfps", ".pdsum", ".pvss", "#pvl-sum", "#pvi-sum", ".pvxs",
  ".dzc", ".dzs", ".dze", ".bzc", ".bzs", ".bze", ".pcp", ".dzt", ".bzt",
  /* банк, счета, акты */ "#bnp-sum", ".bnps", ".invli[data-k=price]", "[data-akt=prior]", "input[data-s=price]",
  /* склад */ ".skbp", ".skf-price", ".skf-ppc", ".skmp", ".mi-price", ".mi-sum", ".mi-total"
].join(",");
const moneyGrp = v => { v=String(v==null?"":v); const s=v.replace(/[\s  ]/g,""), m=s.match(/^(-?)(\d+)([.,]\d*)?$/);
  return m ? m[1]+m[2].replace(/\B(?=(\d{3})+(?!\d))/g," ")+(m[3]||"") : v; };
if(typeof document!=="undefined" && typeof HTMLInputElement!=="undefined"){
  const MND=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
  const moneyOn = el => { if(!el || el._mny || el.type==="number" || el.type==="hidden" && false) return; el._mny=1;
    Object.defineProperty(el,"value",{configurable:true, get(){ return MND.get.call(this).replace(/[\s  ]/g,""); }, set(v){ MND.set.call(this, moneyGrp(v)); }});
    const raw=MND.get.call(el), g=moneyGrp(raw); if(g!==raw) MND.set.call(el,g); };
  window.moneyOn=moneyOn;
  const scan = root => { if(!root || root.nodeType!==1) return; if(root.matches(MONEY_SEL)) moneyOn(root); root.querySelectorAll && root.querySelectorAll(MONEY_SEL).forEach(moneyOn); };
  document.addEventListener("input", e=>{ const el=e.target; if(!el || el.tagName!=="INPUT" || !el.matches(MONEY_SEL)) return; moneyOn(el);
    const raw=MND.get.call(el), pos=el.selectionStart==null?raw.length:el.selectionStart, k=raw.slice(0,pos).replace(/[\s  ]/g,"").length, nv=moneyGrp(raw);
    if(nv===raw) return; MND.set.call(el,nv); let n=0, p=0; while(p<nv.length && n<k){ if(!/\s/.test(nv[p])) n++; p++; } try{ el.setSelectionRange(p,p); }catch(x){} }, true);
  document.addEventListener("focusin", e=>{ const el=e.target; if(el && el.tagName==="INPUT" && el.matches(MONEY_SEL)) moneyOn(el); }, true);
  let mq=[], mt=0; new MutationObserver(L=>{ L.forEach(r=>r.addedNodes.forEach(n=>{ if(n.nodeType===1) mq.push(n); })); if(!mt) mt=requestAnimationFrame(()=>{ mt=0; const q=mq; mq=[]; q.forEach(scan); }); })
    .observe(document.documentElement, {childList:true, subtree:true});
  const st=()=>scan(document.body); if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", st); else st();
}
