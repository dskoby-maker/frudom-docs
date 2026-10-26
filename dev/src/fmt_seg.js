/* ---------- форматирование ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
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

