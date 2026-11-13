/* ===== Вкладка «Почта» (12.11.2026; Code.gs ≥ 30, действие mail; посредник в Яндекс Облаке — путь /mail/…) =====
   Письма двух ящиков (frudom.ru@mail.ru, info@frudom.ru — любые, подключает Даниил): список, чтение, вложения, ответ с того же ящика.
   Письмо, похожее на заявку (mlOrd), — плашка «Похоже на заявку» и «Сделать документы»: PDF/фото/текст письма — через ИИ (aiRead), Excel/Word — обычным разбором «Заказа из файла». */
const ML={rows:[], acc:[], proxy:null, px:null, loaded:false, busy:false, sync:false, err:"", sel:"", box:"", f:"in", q:"", view:null, comp:null, html:false, imgs:false, set:false, edit:null, more:0, at:0};
const ML_PRE={mailru:{t:"Mail.ru", ih:"imap.mail.ru", sh:"smtp.mail.ru", how:"Mail.ru → значок профиля → «Безопасность» → «Пароли для внешних приложений» → «Добавить» → название «Документы ФД», доступ «Полный доступ к Почте (IMAP, SMTP)» → скопируйте пароль. Обычный пароль от почты сюда не подойдёт."},
  timeweb:{t:"Timeweb", ih:"imap.timeweb.ru", sh:"smtp.timeweb.ru", how:"Timeweb: подходит обычный пароль этого ящика (тот, с которым вы входите на mail.timeweb.com). Если включена двухэтапная проверка — создайте отдельный пароль в панели Timeweb → «Почта»."},
  yandex:{t:"Яндекс", ih:"imap.yandex.ru", sh:"smtp.yandex.ru", how:"Яндекс ID → «Безопасность» → «Пароли приложений» → «Почта» → создайте пароль. В настройках почты включите «Доступ по IMAP»."},
  other:{t:"Другая", ih:"", sh:"", how:"Спросите у почтовой службы адреса серверов IMAP (порт 993) и SMTP (порт 465)."}};
const ML_COL=["#6a2c4e","#1f6f8b","#2f7d4f","#b4532a"];
const ML_IC={minor:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/></svg>', mail0:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8l9 6 9-6"/><path d="M3 8v10h18V8l-9-5z"/></svg>', mail1:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/><circle cx="19" cy="5" r="3.2" fill="currentColor" stroke="none"/></svg>', spam:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5M12 16.5v.01"/></svg>', eye:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>', clip:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.6 8.6a2 2 0 0 1-2.8-2.8L15.5 7"/></svg>',
  reply:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/></svg>',
  ref:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  pen:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
  ai:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>'};
/* понятный текст вместо технической ошибки посредника */
const mlErrTxt = e => { e=String(e||""); return /crashed|JobExecution|ответ 50[234]|out of memory|heap/i.test(e) ? "посредник в Яндекс Облаке не справился — скорее всего, очень большое письмо (например, после переноса старой почты). Обновите код посредника: «⚙ Ящики» → «Посредник» → «Скопировать код», и в Яндекс Облаке поставьте память функции 512 МБ" : e; };
const mlAccOf = id => ML.acc.find(a=>a.id===id) || {};
const mlCol = id => mlAccOf(id).color || ML_COL[Math.max(0, ML.acc.findIndex(a=>a.id===id)) % ML_COL.length];
const mlRO = () => isStaff();   /* Гриша и Склад — только читают: без ответа, отметок и «Сделать документы» */
/* отправители: заказчик / не заказчик / спам — общий лист «Почта: отправители» (Code.gs ≥ 32); со старым скриптом — на этом устройстве (prefs.mlTags) */
const mlAddr = r => String((r&&r.from)||"").trim().toLowerCase();
const mlTag = em => { em=String(em||"").toLowerCase(); return (ML.tags||{})[em] || (getPrefs().mlTags||{})[em] || null; };
const mlSpam = r => { if(!r || r.dir==="sent") return false; const o=mlOrdSt(r)||{}; if(o.spam===1) return true; if(o.spam===0) return false; const t=mlTag(mlAddr(r)); return !!(t && t.kind==="spam"); };
/* «Неважные» — только это письмо, в отдельную папку; отправитель не запоминается (в отличие от спама) */
const mlMinor = r => !!r && r.dir!=="sent" && !mlSpam(r) && (mlOrdSt(r)||{}).minor===1;
const mlUnread = r => r.dir!=="sent" && !r.read && !mlRO() && !mlSpam(r) && !mlMinor(r);
const mlUnIn = r => mlUnread(r) && !mlFld(r);   /* непрочитанное во «Входящих» (не в своей папке) */
const mlIsOrd = r => { try{ const o=r.order?JSON.parse(r.order):null; if(o&&o.st==="no") return false; }catch(e){} if(mlSpam(r) || (mlTag(mlAddr(r))||{}).kind==="no") return false; return r.dir!=="sent" && !!mlOrd(r).ok; };
const mlOrdSt = r => { try{ return r.order?JSON.parse(r.order):null; }catch(e){ return null; } };
/* «Обработано» — в том же поле order (JSON {…, done:{by, at}}), поэтому Code.gs обновлять не нужно; заявку (st) и отметку храним вместе */
const mlDone = r => (mlOrdSt(r)||{}).done || null;
/* «Не обработано» — тоже ставится вручную (жёлтая пометка); «Обработано» и «Не обработано» взаимоисключающие */
const mlTodo = r => (mlOrdSt(r)||{}).todo || null;
const ML_IC_TODO='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l2.5 1.5"/></svg>';
function mlMark(r, k){ const now={by:curUser(), at:new Date().toISOString()}; mlOrdPatch(r, {done:k==="done"?now:null, todo:k==="todo"?now:null}, !!k); if(k) r.read="1";
  mlRowSync(r); mlListMark(); mlCounts(); mlBadge();
  if(ML.sel===r.id){ const v=$("#ml-view"); if(v){ v.innerHTML=mlViewHtml(); const b=v.querySelector(".mldone, .mltodo"); if(b) b.classList.add("pop"); } }
  if(ML.f==="undone" && k!=="todo"){ const b=document.querySelector(`#ml-list .mlr[data-mlid="${CSS.escape(r.id)}"]`); if(b){ b.classList.add("leave"); setTimeout(()=>{ b.remove(); }, 260); } }
  toast(k==="done"?"ok":"info", k==="done"?"Обработано":k==="todo"?"Отмечено: не обработано":"Пометка снята", ""); }
const mlDoneTxt = d => { const x=new Date(d.at); return esc(d.by||"")+(isNaN(x)?"":" · "+(jIso(x)===todayISO()?"сегодня в "+x.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):x.toLocaleString("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).replace(".",""))); };
function mlOrdPatch(r, patch, read){ const o=Object.assign({}, mlOrdSt(r)||{}, patch); Object.keys(o).forEach(k=>{ if(o[k]==null) delete o[k]; }); r.order=Object.keys(o).length?JSON.stringify(o):""; const x={id:r.id, order:r.order}; if(read) x.read=1; mlSet([x]); }
const ML_IC_OK='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const mlDate = iso => { const d=new Date(iso); if(isNaN(d)) return ""; const t=todayISO(), x=jIso(d); return x===t ? d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) : x.slice(0,4)===t.slice(0,4) ? d.toLocaleDateString("ru-RU",{day:"numeric",month:"short"}).replace(".","") : fd(x); };
const mlFull = iso => { const d=new Date(iso); return isNaN(d) ? "" : d.toLocaleString("ru-RU",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
const mlSize = s => s>=1048576 ? (s/1048576).toFixed(1).replace(".",",")+" МБ" : Math.max(1,Math.round(s/1024))+" КБ";
const mlAtts = r => { try{ return JSON.parse(r.atts||"[]")||[]; }catch(e){ return []; } };
/* ---------- заявка ли это: ключевые слова, вложение-таблица/скан, строки «товар N кг», заказчик ---------- */
const ML_KW=/заявк|заказ(?!ч)|поставк|прошу (поставить|привезти|доставить)|потребност|наряд|меню-?раскладк/i, ML_NOT=/акт\b|акт сверки|сч[её]т|счет-фактур|упд|платёжк|платежн|претензи|рассылк|unsubscribe|отписаться/i;
function mlCusOf(r, text){ const p=getPrefs(), mc=p.mlCus||{}, from=String(r.from||"").toLowerCase(), dom=from.split("@")[1]||""; const tg=mlTag(from);
  if(tg && tg.kind==="cus" && cus(tg.customerId)) return {cid:tg.customerId, how:"отмечен как заказчик"}; if(tg && tg.kind==="no") return null;
  if(mc[from] && cus(mc[from])) return {cid:mc[from], how:"по адресу отправителя"};
  const byDom=Object.keys(mc).find(a=>a.split("@")[1]===dom && !/^(mail|bk|inbox|list|yandex|ya|gmail)\./.test(dom) && cus(mc[a])); if(byDom) return {cid:mc[byDom], how:"по домену "+dom};
  const T=(String(r.subject||"")+" "+String(r.fromName||"")+" "+String(text||r.snippet||"")).toLowerCase();
  for(const c of D.customers){ if(isPriv(c.id)) continue; const inn=String(c.inn||"").replace(/\D/g,""); if(inn.length>=10 && T.includes(inn)) return {cid:c.id, how:"по ИНН"}; }
  for(const k of (D.contracts||[])){ const n=String(k.basis||"").match(/№\s*([\wА-Яа-я\-\/().]{4,})/); if(n && T.includes(n[1].toLowerCase()) && cus(k.customerId)) return {cid:k.customerId, how:"по номеру договора"}; }
  for(const c of D.customers){ if(isPriv(c.id)) continue; const nm=[c.short, cusShort(c.name)].filter(Boolean).map(x=>String(x).toLowerCase().replace(/[«»"]/g,"").trim()).filter(x=>x.length>=3);
    if(nm.some(x=>new RegExp("(^|[^а-яёa-z])"+x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"($|[^а-яёa-z])","i").test(T))) return {cid:c.id, how:"по названию"}; }
  return null; }
function mlOrd(r, text){ if(r.dir==="sent") return {ok:false};
  const T=String(r.subject||"")+"\n"+String(text||r.snippet||""), A=mlAtts(r), sub=String(r.subject||"");
  const kw=ML_KW.test(sub) || ML_KW.test(T.slice(0,1500)), not=ML_NOT.test(sub) && !ML_KW.test(sub);
  const fa=A.filter(x=>/\.(pdf|xlsx?|docx?|jpe?g|png|heic|webp|txt|csv)$/i.test(x.n) && !ML_NOT.test(x.n));
  const lines=(T.match(/[а-яёa-z)]\s*[-–—:]?\s*\d+[.,]?\d*\s*(кг|шт|уп|упак|кор|ящ|л|пач|бан|пар)\b\.?/gi)||[]).length;
  const c=mlCusOf(r, text); let sc=(kw?3:0)+(lines>=2?3:lines?1:0)+(fa.length?1:0)+(c?1:0)-(not?4:0);
  return {ok: sc>=4 && (kw||lines>=2), cus:c, files:fa, lines, kw, score:sc}; }
/* ---------- загрузка ---------- */
async function mlLoad(force, quiet){ if(!online()) return; if(ML.sync) return;
  ML.sync=true; mlHead();
  try{ if(!ML.loaded){ const j=await api({action:"mail", op:"list"}); mlTake(j); ML.loaded=true; mlDraw(); }
    if(!ML.acc.length){ ML.sync=false; mlDraw(); return; }
    const j=await apiFetch(API_URL,{method:"POST", tmo:280000, body:JSON.stringify({key:pass(), user:curUser(), action:"mail", op:"sync", force:!!force})});
    const n0=ML.rows.length; mlTake(j); ML.at=Date.now(); ML.err="";
    const errs=Object.keys(j.errs||{}); if(errs.length && !quiet) toast("err","Не все ящики обновились", errs.map(id=>(mlAccOf(id).email||id)+": "+mlErrTxt(j.errs[id])).join("; "));
    if(j.added && !quiet) toast("ok","Новых писем: "+j.added,"");
    if(j.added && quiet && curTab!=="mail") mlBadge();
  }catch(e){ const m=e.message||""; ML.err = m==="unknown action" ? "old" : m==="noproxy" ? "noproxy" : m==="oldproxy" ? "oldproxy" : m; if(m==="unknown action") ML.loaded=true; if(!quiet && !/^(old|noproxy|oldproxy|forbidden)$/.test(ML.err)) toast("err","Почта не обновилась", m); }
  ML.sync=false; ML.loaded=true; mlBadge(); if(curTab==="mail") mlDraw(); }
function mlTake(j){ if(Array.isArray(j.tags)){ ML.tags={}; j.tags.forEach(t=>{ if(t.id) ML.tags[String(t.id).toLowerCase()]={kind:t.kind, customerId:t.customerId, by:t.by, at:t.at}; }); ML.tagSrv=true; } else if(Array.isArray(j.rows) && (D.srvVer||0) && D.srvVer<32) ML.tagSrv=false;
  if(Array.isArray(j.folders)){ ML.folders=j.folders; ML.fldSrv=true; } else if(Array.isArray(j.rows) && ML.fldSrv!==true){ ML.fldSrv=false; ML.folders=(getPrefs().mlFolders||[]); }
  if(Array.isArray(j.rows)) ML.rows=j.rows; if(Array.isArray(j.acc)) ML.acc=j.acc; if(j.proxy!=null) ML.proxy=!!j.proxy; }
function mlBadge(){ const n=ML.rows.filter(mlUnIn).length; document.querySelectorAll('#fd-app nav.tabs button[data-tab="mail"], #mbar [data-mt="mail"]').forEach(b=>{ if(n) b.dataset.n=n>99?"99+":n; else delete b.dataset.n; }); }
function renderMail(){ if(!$("#ml")) return; mlDraw(); if(!ML.loaded || Date.now()-ML.at>120000) mlLoad(false, ML.loaded); }
setInterval(()=>{ if(online() && ML.acc.length && !document.hidden) mlLoad(false, true); }, 300000);
/* ---------- отрисовка ---------- */
function mlList(){ const q=ML.q.trim().toLowerCase(), all=ML.f==="all", uf=ML.f.startsWith("u:")?ML.f.slice(2):"";
  return ML.rows.filter(r=>(!ML.box || r.acc===ML.box) && (all || (uf ? r.dir!=="sent" && !mlSpam(r) && mlFld(r)===uf : (ML.f!=="in" || !mlFld(r)) && (ML.f==="sent" ? r.dir==="sent" : r.dir!=="sent") && (ML.f==="spam" ? mlSpam(r) : ML.f==="minor" ? mlMinor(r) : !mlSpam(r) && !mlMinor(r)) && (ML.f!=="unread" || mlUnread(r)) && (ML.f!=="undone" || !!mlTodo(r)) && (ML.f!=="ord" || mlIsOrd(r))))
    && (!q || [r.subject, r.fromName, r.from, r.to, r.snippet, r.attsText].join(" ").toLowerCase().includes(q))); }
function mlHead(){ const h=$("#ml-sync"); if(h) h.innerHTML=mlSyncTxt(); mlSyncUi(); }
/* идёт проверка ящиков: бегущая полоска над письмами, крутится значок «Проверить почту», мигают точки ящиков */
function mlSyncUi(){ const on=!!ML.sync; ["ml","ml-ov"].forEach(id=>{ const e=document.getElementById(id); if(e) e.classList.toggle("mlsyncing", on); });
  document.querySelectorAll('#ml [data-ml="sync"], #ml-drp [data-mm="dsync"]').forEach(b=>{ b.disabled=on; const t=b.querySelector(".mlsyt"); if(t) t.textContent=on?"Проверяю…":(b.dataset.mm?"Проверить почту":"Проверить почту"); }); }
const mlSyncTxt = () => ML.sync ? `<i class="spin"></i>${mlMob()?"Проверяю…":"Проверяю ящики…"}` : ML.at ? "обновлено в "+new Date(ML.at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) : "";
function mlErrHtml(){ const adm=me().admin; return ML.err && ML.err!=="old" ? `<div class="sknoteb mlerr">${ML.err==="noproxy"?"Не подключён посредник в Яндекс Облаке — письма не забираются. "+(adm?"«⚙ Ящики» → «Посредник».":"Скажите Даниилу."):ML.err==="oldproxy"?"Код посредника в Яндекс Облаке старый (только для банка). "+(adm?"«⚙ Ящики» → «Посредник» → обновить код.":"Скажите Даниилу."):esc(ML.err)}</div>`:""; }
function mlDraw(){ const el=$("#ml"); if(!el) return; const adm=me().admin; el.classList.remove("mob"); const ovk=document.getElementById("ml-ov"); if(ovk) ovk.hidden=true;
  if(ML.err==="forbidden" && mlRO()){ el.innerHTML=`<div class="mlempty"><b>Почта пока закрыта</b><span>Скрипт таблицы старый — попросите Даниила обновить Code.gs.</span></div>`; return; }
  if(ML.err==="old"){ el.innerHTML=`<div class="mlempty"><b>Скрипт таблицы старый</b><span>Почта заработает после обновления Code.gs — ${adm?"нажмите «Как обновить» в жёлтой плашке сверху":"попросите Даниила обновить Code.gs"}.</span></div>`; return; }
  if(ML.set && adm){ el.innerHTML=mlSetHtml(); return; }
  if(ML.comp) mlCompRead();
  if(ML.loaded && !ML.acc.length){ el.innerHTML=`<div class="mlempty"><b>Ящики ещё не подключены</b><span>${adm?"Подключите frudom.ru@mail.ru и info@frudom.ru — письма начнут приходить сюда.":"Попросите Даниила подключить почтовые ящики."}</span>${adm?`<button class="btn pri" type="button" data-ml="set">Подключить ящики</button>`:""}</div>`; return; }
  const spamN=ML.rows.filter(r=>mlSpam(r) && (!ML.box||r.acc===ML.box)).length, undone=ML.rows.filter(r=>r.dir!=="sent" && !mlSpam(r) && !mlMinor(r) && !!mlTodo(r) && (!ML.box||r.acc===ML.box)).length, L=mlList(), unread=ML.rows.filter(r=>mlUnIn(r) && (!ML.box||r.acc===ML.box)).length;
  if(ML.f.startsWith("u:") && !mlFldOf(ML.f.slice(2))) ML.f="in";
  if(mlMob()){ mlMobDraw(el, L); return; } mlOvOff();
  const ra=mlRO()?0:mlRaList().length;
  const chip=(k,t,n)=>`<button type="button" data-mlf="${k}" class="${ML.f===k?"on":""}" aria-pressed="${ML.f===k}">${t}${n?` <em>${n}</em>`:""}</button>`;
  const accs=`<div class="mlacc"><button type="button" data-mlbox="" class="${ML.box?"":"on"}">Все ящики</button>${ML.acc.map(a=>{ const n=ML.rows.filter(r=>r.acc===a.id && mlUnread(r)).length; return `<button type="button" data-mlbox="${a.id}" class="${ML.box===a.id?"on":""}" style="--c:${mlCol(a.id)}" title="${esc(a.err?"Ошибка: "+mlErrTxt(a.err):"")}"><i></i>${esc(a.email)}${n?` <em>${n}</em>`:""}${a.err?` <b class="mlwarn">!</b>`:""}</button>`; }).join("")}</div>`;
  const lim=60+ML.more, list=L.slice(0,lim).map((r,i)=>mlRowHtml(r,i)).join("");
  const oldL=$("#ml-list"), keepY=oldL?oldL.scrollTop:0, calm=!!oldL && ML.calmKey===ML.f+"|"+ML.box;
  el.innerHTML=`<div class="mlhd"><h2>Почта</h2><span class="muted mlsync" id="ml-sync">${mlSyncTxt()}</span><span class="grow"></span>
      <button class="btn ghost sm" type="button" data-ml="sync" ${ML.sync?"disabled":""}><span class="mlsyi">${ML_IC.ref}</span><span class="mlsyt">${ML.sync?"Проверяю…":"Проверить почту"}</span></button>${mlRO()?"":`<button class="btn sm pri" type="button" data-ml="new">${ML_IC.pen} Написать</button>`}${adm?`<button class="btn ghost sm" type="button" data-ml="set" title="Ящики и посредник">⚙ Ящики</button>`:""}</div>
    ${mlErrHtml()}
    ${accs}
    <div class="mlbar"><div class="pfchips mlf">${chip("in","Входящие",unread)}${chip("all","Все письма",0)}${chip("ord","Заявки",0)}${chip("undone","Не обработаны",undone)}${chip("unread","Непрочитанные",0)}${chip("sent","Отправленные",0)}${chip("minor","Неважные",0)}${chip("spam","Спам",0)}${mlFlds().map(f=>chip("u:"+f.id, ML_IC_FLD+esc(f.name), ML.rows.filter(r=>mlFld(r)===f.id && mlUnread(r) && (!ML.box||r.acc===ML.box)).length)).join("")}${mlRO()?"":`<button type="button" class="mlfnew" data-ml="fldnew" title="Создать свою папку">+ Папка</button>`}${spamN&&ML.f!=="spam"?`<small class="muted mlspn">в спаме ${spamN}</small>`:""}</div>
      ${ra?`<button type="button" class="btn ghost sm mlra" data-ml="readall" title="Отметить прочитанными все письма в этой папке">${ML_IC_OK} Прочитать все <em>${ra}</em></button>`:""}<label class="mlq"><input type="search" id="ml-q" placeholder="Поиск: от кого, тема, текст…" value="${esc(ML.q)}" autocomplete="off"></label></div>
    <div class="mlprog" aria-hidden="true"><i></i></div>
    <div class="mlw${ML.sel||ML.comp?" vopen":""}"><div class="mll" id="ml-list" role="list">${mlFolderNote()}${list||`<div class="mlempty sm"><b>${ML.q?"Ничего не найдено":ML.f==="ord"?"Заявок нет":ML.f==="sent"?"Отправленных пока нет":ML.f==="spam"?"В спаме пусто":ML.f==="minor"?"Неважных писем нет":ML.f==="undone"?"Писем с пометкой «Не обработано» нет":"Писем нет"}</b><span>${ML.loaded?"":"Загружаю…"}</span></div>`}
        ${L.length>lim?`<button type="button" class="btn ghost sm mlmore" data-ml="more">Показать ещё (${L.length-lim})</button>`:""}</div>
      <div class="mlv" id="ml-view">${mlViewHtml()}</div></div>`;
  mlSyncUi(); const nl=$("#ml-list"); if(nl){ if(calm){ nl.classList.add("calm"); nl.scrollTop=keepY; } ML.calmKey=ML.f+"|"+ML.box; }
  mlCompFocus(); mlBadge(); }
function mlRowHtml(r,i){ if(mlMob()) return mlRowMob(r,i); const A=mlAtts(r), o=r.dir!=="sent" && mlIsOrd(r), st=mlOrdSt(r), c=o?mlOrd(r).cus:null, who=r.dir==="sent" ? "Кому: "+(r.to||"") : (r.fromName||r.from||"без имени");
  const tg=r.dir!=="sent"?mlTag(mlAddr(r)):null, sp=mlSpam(r);
  const qa = mlRO() ? `<span class="mlqa"><button type="button" data-mlq="menu" title="Действия" aria-label="Действия">⋯</button></span>` : `<span class="mlqa">${r.dir!=="sent"?`<button type="button" data-mlq="read" title="${r.read?"Отметить непрочитанным":"Отметить прочитанным"}" aria-label="Прочитано">${r.read?ML_IC.mail1:ML_IC.mail0}</button><button type="button" data-mlq="todo" class="${mlTodo(r)?"ontodo":""}" title="${mlTodo(r)?"Снять «Не обработано»":"Не обработано"}" aria-label="Не обработано">${ML_IC_TODO}</button><button type="button" data-mlq="done" class="${mlDone(r)?"on":""}" title="${mlDone(r)?"Снять «Обработано»":"Обработано"}" aria-label="Обработано">${ML_IC_OK}</button><button type="button" data-mlq="${mlMinor(r)?"major":"minor"}" title="${mlMinor(r)?"Вернуть во входящие":"В неважные"}" aria-label="Неважные">${ML_IC.minor}</button><button type="button" data-mlq="${sp?"nospam":"spam"}" title="${sp?"Не спам":"В спам"}" aria-label="Спам">${ML_IC.spam}</button>`:""}<button type="button" data-mlq="menu" title="Ещё действия (или правая кнопка мыши)" aria-label="Ещё действия">⋯</button></span>`;
  return `<div class="mlr${mlUnread(r)?" un":""}${ML.sel===r.id?" sel":""}${mlDone(r)?" isdone":""}${mlTodo(r)?" istodo":""}${sp?" isspam":""}" data-mlid="${esc(r.id)}" role="listitem" tabindex="0" style="--c:${mlCol(r.acc)};--d:${Math.min(i,14)*18}ms">${qa}
    <span class="mlr1"><b>${esc(who)}</b><time>${mlDate(r.date)}</time></span>
    <span class="mlr2">${ML.f==="all"?mlWhere(r):""}${r.ans?`<i class="mlans" title="Вы ответили">${ML_IC.reply}</i>`:""}${esc(r.subject||"(без темы)")}</span>
    <span class="mlr3">${esc(String(r.snippet||"").slice(0,140))}</span>
    ${tg&&tg.kind==="cus"?`<span class="mltag cus" title="Отправитель отмечен как заказчик">Заказчик${cus(tg.customerId)?" · "+esc(cusNm(tg.customerId)):""}</span>`:tg&&tg.kind==="no"?`<span class="mltag no">Не заказчик</span>`:""}
    ${mlDone(r)?`<span class="mlr5"><span class="mldbadge">${ML_IC_OK}Обработано</span><small>${mlDoneTxt(mlDone(r))}</small></span>`:mlTodo(r)?`<span class="mlr5"><span class="mltbadge">${ML_IC_TODO}Не обработано</span><small>${mlDoneTxt(mlTodo(r))}</small></span>`:""}
    ${A.length||o?`<span class="mlr4">${A.length?`<span class="mlclip">${ML_IC.clip}${A.length>1?A.length+" ":""}${esc(A[0].n.length>28?A[0].n.slice(0,26)+"…":A[0].n)}</span>`:""}${o?`<span class="mlord${st&&st.st==="taken"?" done":""}">${st&&st.st==="taken"?"Документы сделаны":"Заявка"}${c?" · "+esc(cusNm(c.cid)):""}</span>`:""}</span>`:""}</div>`; }
function mlViewHtml(){ if(ML.comp) mlCompRead(); return mlMob() ? mlPgHtml() : mlViewBody(); }
function mlViewBody(){ if(ML.comp) return mlCompHtml(); const V=ML.view, mob=mlMob();
  if(!ML.sel) return `<div class="mlempty sm"><b>Выберите письмо</b><span>Нажмите на письмо слева — оно откроется здесь.</span></div>`;
  const r=ML.rows.find(x=>x.id===ML.sel); if(!r) return "";
  const A=mlAtts(r), text=V&&V.id===r.id?V.text:"", load=!V||V.id!==r.id, O=mlOrd(r, text), st=mlOrdSt(r), adm=me().admin;
  const html=V&&V.id===r.id&&V.html;
  const body = load ? `<div class="mlbody muted"><i class="spin"></i> Загружаю письмо…</div>` : ML.html && html ? `<iframe class="mlhtml" sandbox="allow-popups allow-popups-to-escape-sandbox" title="Письмо" srcdoc="${esc(mlSrcdoc(html))}"></iframe>` : `<div class="mlbody">${mlLinks(text||r.snippet||"")}</div>`;
  const ordBox = !mlRO() && r.dir!=="sent" && !load && (O.ok || (st&&st.st) || ML.force===r.id) && !(st&&st.st==="no") ? mlOrdHtml(r, O, st) : "";
  return `<div class="mlvh">${mob?"":`<button type="button" class="btn ghost sm mlback" data-ml="back">‹ Письма</button>`}
      <h3>${esc(r.subject||"(без темы)")}</h3>
      <div class="mlmeta"><span class="mlav" style="--c:${mlCol(r.acc)}">${esc(((r.dir==="sent"?r.to:r.fromName||r.from)||"?").trim()[0]||"?").toUpperCase()}</span>
        <span><b>${esc(r.dir==="sent"?"Вы":(r.fromName||r.from))}</b> ${r.dir==="sent"?"":`<small>&lt;${esc(r.from)}&gt;</small>`}<br><small>кому: ${esc(r.to||r.box)}${r.cc?" · копия: "+esc(r.cc):""}</small></span>
        <span class="mlwhen"><small>${esc(mlFull(r.date))}</small><small class="mlbx" style="--c:${mlCol(r.acc)}">${esc(r.box)}</small></span></div>
      ${r.dir!=="sent"?mlTagLine(r):""}${mlSpam(r)?`<div class="mlspam">${ML_IC.spam}<span><b>Письмо в спаме.</b> ${(mlTag(mlAddr(r))||{}).kind==="spam"?"Все письма от "+esc(r.from)+" попадают сюда сами.":""}</span>${mlRO()?"":`<button type="button" class="btn ghost sm" data-ml="nospam">Не спам</button>`}</div>`:""}
      ${mlFld(r)?`<div class="mlminorbar mlinfld">${ML_IC_FLD}<span>Письмо в папке «${esc(mlFldOf(mlFld(r)).name)}»</span>${mlRO()?"":`<button type="button" class="btn ghost sm" data-ml="fldout">Вернуть во входящие</button>`}</div>`:""}
      ${mlMinor(r)?`<div class="mlminorbar">${ML_IC.minor}<span>Письмо в «Неважных»</span>${mlRO()?"":`<button type="button" class="btn ghost sm" data-ml="major">Вернуть во входящие</button>`}</div>`:""}
      ${r.dir==="sent"?"":mlDone(r)?`<div class="mldone"><span class="mldbadge big">${ML_IC_OK}Обработано</span><small>${mlDoneTxt(mlDone(r))}</small>${mlRO()?"":`<button type="button" class="btn ghost sm" data-mk="">Снять</button>`}</div>`
        : mlTodo(r)?`<div class="mltodo"><span class="mltbadge big">${ML_IC_TODO}Не обработано</span><small>${mlDoneTxt(mlTodo(r))}</small>${mlRO()?"":`<button type="button" class="mlmk mkok" data-mk="done">${ML_IC_OK}Обработано</button><button type="button" class="btn ghost sm" data-mk="">Снять</button>`}</div>`
        : mlRO()?"":`<div class="mlst"><button type="button" class="mlmk mkto" data-mk="todo" title="Пометить: ещё нужно разобраться">${ML_IC_TODO}Не обработано</button><button type="button" class="mlmk mkok" data-mk="done" title="Пометить: всё сделано">${ML_IC_OK}Обработано</button></div>`}
      <div class="mlact">${mlRO()?`<span class="muted mlro">Только чтение</span>`:""}${mlRO()||mob?"":r.dir!=="sent"?`<button class="btn sm pri" type="button" data-ml="reply">${ML_IC.reply} Ответить</button>${(r.cc||String(r.to).includes(","))?`<button class="btn sm" type="button" data-ml="replyall">Ответить всем</button>`:""}`:""}${mlRO()||mob?"":`<button class="btn sm ghost" type="button" data-ml="fwd">Переслать</button>`}
        ${r.dir!=="sent"&&!mlRO()&&!mob?`<button class="btn sm ghost" type="button" data-ml="unread">${mlUnread(r)?"Отметить прочитанным":"Не прочитано"}</button>`:""}${!mlRO()&&!O.ok&&r.dir!=="sent"&&!(st&&st.st)&&ML.force!==r.id?`<button class="btn sm ghost" type="button" data-ml="isord">Это заявка</button>`:""}${!mob&&!mlRO()&&r.dir!=="sent"&&!mlSpam(r)?`<button class="btn sm ghost" type="button" data-ml="${mlMinor(r)?"major":"minor"}">${ML_IC.minor} ${mlMinor(r)?"Во входящие":"В неважные"}</button>`:""}${!mob&&!mlRO()&&r.dir!=="sent"&&!mlSpam(r)?`<button class="btn sm ghost" type="button" data-ml="fldpick">${ML_IC_FLD} ${mlFld(r)?"В другую папку":"В папку"}</button>`:""}${!mob&&!mlRO()&&r.dir!=="sent"&&!mlSpam(r)?`<button class="btn sm ghost mlspb" type="button" data-ml="spam">${ML_IC.spam} В спам</button>`:""}${html?`<button class="btn sm ghost" type="button" data-ml="html">${ML.html?"Только текст":"Как в письме"}</button>`:""}</div></div>
    ${ordBox}
    ${A.length?`<div class="mlatts">${A.map((x,i)=>`<div class="mlatt"><span class="mlext">${esc((x.n.split(".").pop()||"").slice(0,4).toUpperCase())}</span><span class="mlan"><b title="${esc(x.n)}">${esc(x.n)}</b><small>${x.s?mlSize(x.s):""}${x.f?"":" · ещё не загружено"}</small></span>
        <button type="button" class="btn ghost sm" data-mlatt="${i}" data-how="view">Посмотреть</button><button type="button" class="btn ghost sm" data-mlatt="${i}" data-how="get" aria-label="Скачать">⤓</button></div>`).join("")}</div>`:""}
    ${body}
    ${ML.html && html && !ML.imgs ? `<p class="muted mlimg">Картинки из интернета скрыты — так безопаснее. <button type="button" class="btn ghost sm" data-ml="imgs">Показать картинки</button></p>`:""}
    ${V&&V.err?`<p class="muted">${esc(V.err)}</p>`:""}`; }
function mlOrdHtml(r, O, st){ const c=(st&&st.cid&&cus(st.cid))?{cid:st.cid, how:"выбрано"}:O.cus, A=mlAtts(r), F=A.map((x,i)=>({x,i})).filter(o=>/\.(pdf|xlsx?|docx?|jpe?g|png|heic|webp|txt|csv)$/i.test(o.x.n));
  const how=x=>/\.(pdf|jpe?g|png|heic|webp)$/i.test(x.n)?"через ИИ":"таблицей, без ИИ";
  return `<div class="mlordbox${st&&st.st==="taken"?" done":""}"><div class="mloh">${ML_IC.ai}<b>${st&&st.st==="taken"?"По этой заявке уже делали документы":"Похоже на заявку"}</b>${c?`<span>от <b>${esc(cusNm(c.cid))}</b> <small class="muted">(${esc(c.how)})</small></span>`:""}</div>
    <div class="mlocus"><label class="f">Заказчик<select id="ml-ocus">${`<option value="">— сайт найдёт сам —</option>`+opts(D.customers.filter(x=>!isPriv(x.id)), c?c.cid:"")}</select></label><label class="mlrem"><input type="checkbox" id="ml-orem" checked> запомнить, что ${esc(r.from)} — этот заказчик</label></div>
    <div class="mlobtn">${F.map(o=>`<button type="button" class="btn sm pri" data-mlmk="${o.i}">${ML_IC.ai} Сделать документы из «${esc(o.x.n.length>30?o.x.n.slice(0,28)+"…":o.x.n)}» <small>${how(o.x)}</small></button>`).join("")}
      <button type="button" class="btn sm${F.length?"":" pri"}" data-mlmk="text">${ML_IC.ai} Из текста письма <small>через ИИ</small></button>
      ${st&&st.st?"":`<button type="button" class="btn sm ghost" data-ml="notord">Это не заявка</button>`}</div></div>`; }
function mlLinks(t){ return esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)»"'])/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/^(&gt;.*)$/gm,'<span class="mlquo">$1</span>'); }
function mlSrcdoc(h){ const csp=`default-src 'none'; style-src 'unsafe-inline'; img-src data: ${ML.imgs?"https: http:":""}; font-src data:`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c2220;margin:12px;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${String(h).replace(/<script[\s\S]*?<\/script>/gi,"").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"")}</body></html>`; }
/* ---------- открыть письмо ---------- */
async function mlOpen(id){ if(mlMob()) mlLayer("v"); ML.sel=id; ML.comp=null; ML.html=false; ML.imgs=false; const r=ML.rows.find(x=>x.id===id); if(!r) return;
  if(ML.view && ML.view.id!==id) ML.view=null; const vw=$("#ml-view"); if(vw && $("#ml-list")){ vw.innerHTML=mlViewHtml(); mlListMark(); } else mlDraw(); mlScrollView();
  if(mlUnread(r) && !mlRO()){ r.read="1"; mlSet([{id, read:1}]); }
  try{ const j=await api({action:"mail", op:"get", id}); if(ML.sel!==id) return; ML.view={id, text:j.text||"", html:j.html||"", err:j.err||""}; }
  catch(e){ if(ML.sel!==id) return; ML.view={id, text:r.snippet||"", html:"", err:"Полный текст не загрузился: "+e.message}; }
  if(ML.comp){ mlBadge(); mlListMark(); return; }   /* уже пишут ответ — форму не перерисовываем, набранное не трогаем */
  const v=$("#ml-view"); if(v){ v.innerHTML=mlViewHtml(); mlCompFocus(); v.classList.add("fresh"); setTimeout(()=>v.classList.remove("fresh"),300); } mlBadge(); mlListMark(); }
function mlListMark(){ mlPgSync(); document.querySelectorAll("#ml-list .mlr").forEach(b=>{ const r=ML.rows.find(x=>x.id===b.dataset.mlid); b.classList.toggle("sel", b.dataset.mlid===ML.sel); if(r) b.classList.toggle("un", mlUnread(r)); }); const w=$("#ml .mlw"); if(w) w.classList.toggle("vopen", !!(ML.sel||ML.comp)); }
function mlScrollView(){ if(mlMob()) return; if(matchMedia("(max-width:899px)").matches){ const v=$("#ml .mlw"); if(v) window.scrollTo({top:v.getBoundingClientRect().top+window.scrollY-80, behavior:"smooth"}); } }
async function mlSet(L){ try{ await api({action:"mail", op:"set", rows:L}); }catch(e){} }
/* ---------- вложения ---------- */
async function mlAttGet(r, i){ const x=mlAtts(r)[i]; const j=await api({action:"mail", op:"att", id:r.id, i}); if(!x.f){ x.f="1"; r.atts=JSON.stringify(mlAtts(r).map((y,k)=>k===i?Object.assign(y,{f:"1"}):y)); }
  const bin=atob(j.data), u8=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) u8[k]=bin.charCodeAt(k); return new File([u8], j.name||x.n, {type:j.mime||x.m||"application/octet-stream"}); }
async function mlAtt(r, i, how){ const t=toast("info","Загружаю файл…","",{sticky:true});
  try{ const f=await mlAttGet(r,i); if(typeof t==="function") t(); const url=URL.createObjectURL(f);
    if(how==="view" && /pdf|image\//.test(f.type)){ const v=document.createElement("dialog"); v.className="dcard wide skview"; const im=/^image\//.test(f.type);
      v.innerHTML=`<div class="dc-head"><div><div class="dc-kicker">Вложение</div><h3>${esc(f.name)}</h3></div><button class="dc-x" autofocus aria-label="Закрыть">×</button></div>${im?`<img src="${url}" alt="${esc(f.name)}">`:`<iframe src="${url}" title="${esc(f.name)}"></iframe>`}<div class="dc-acts"><a class="btn" href="${url}" download="${esc(f.name)}">Скачать</a></div>`;
      document.getElementById("fd-app").appendChild(v); const bye=()=>{ try{ v.close(); }catch(e){} v.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }; v.querySelector(".dc-x").onclick=bye; v.addEventListener("cancel",e=>{ e.preventDefault(); bye(); }); v.addEventListener("click",e=>{ if(e.target===v) bye(); }); v.addEventListener("close",()=>v.remove()); v.showModal(); requestAnimationFrame(()=>v.classList.add("in")); const fr=v.querySelector("iframe"), xb=v.querySelector(".dc-x"); if(fr) fr.addEventListener("load",()=>setTimeout(()=>{ if(v.isConnected) xb.focus(); },150)); }
    else { const a=document.createElement("a"); a.href=url; a.download=f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000); }
    if(ML.view) { const v=$("#ml-view"); if(v && ML.sel===r.id) v.innerHTML=mlViewHtml(); }
  }catch(e){ if(typeof t==="function") t(); toast("err","Файл не открылся", e.message); } }
/* ---------- заявка → документы ---------- */
async function mlMake(r, what){ const cid=($("#ml-ocus")||{}).value||"", rem=($("#ml-orem")||{}).checked;
  if(cid && rem && r.from){ const p=getPrefs(); p.mlCus=Object.assign({}, p.mlCus||{}, {[String(r.from).toLowerCase()]:cid}); setPrefs(p, true); }
  if(cid && rem && r.from) mlTagSet(mlAddr(r), "cus", cid, true);
  let file=null, text="";
  try{ if(what==="text"){ text=((ML.view&&ML.view.id===r.id?ML.view.text:r.snippet)||"").trim(); if(text.length<10) throw new Error("в письме нет текста заявки"); text="Тема письма: "+(r.subject||"")+"\nОт: "+(r.fromName||"")+" <"+(r.from||"")+">\n\n"+text; }
    else { const t=toast("info","Загружаю вложение…","",{sticky:true}); try{ file=await mlAttGet(r, +what); } finally { if(typeof t==="function") t(); } } }
  catch(e){ toast("err","Не получилось", e.message); return; }
  mlOrdPatch(r, {st:"taken", cid, at:new Date().toISOString(), by:curUser()}, true);
  tabBackFrom("Почта", ()=>showTab("doc"));
  setTimeout(()=>{ const c=$("#imp-card"); if(c) window.scrollTo({top:c.getBoundingClientRect().top+window.scrollY-90, behavior:"smooth"}); }, 60);
  if(file && !/\.(pdf|jpe?g|png|heic|heif|webp)$/i.test(file.name)){ impLoad(file); return; }   /* Excel, Word, текст — сайт читает таблицу сам, точнее ИИ */
  mlAi(file ? {file, name:file.name} : {text, name:"письмо «"+(r.subject||"без темы")+"»"}, cid); }
async function mlAi(o, cid){ IMP={file:o.name, busy:1, msg:"читаю через ИИ"}; drawImp();
  try{ let body; if(o.text) body={action:"aiRead", text:o.text}; else { const d=await aiPrep(o.file); if(d.data.length>18e6) throw new Error("файл больше 13 МБ — для ИИ слишком большой"); body={action:"aiRead", mime:d.mime, data:d.data}; }
    let j; try{ j=await apiFetch(API_URL,{method:"POST", tmo:150000, body:JSON.stringify(Object.assign({key:pass(), user:curUser()}, body))}); }
    catch(e){ const m=e.message||""; if(m==="nokey"||m==="badkey"){ IMP={file:o.name, scan:o.file||null, key:m}; drawImp(); return; }
      if(o.text && /не читает/.test(m)){ toast("warn","Скрипт таблицы старый","Текст письма разобран без ИИ. Чтобы читал ИИ — обновите Code.gs."); IMP=null; impLoad(new File([o.text],"письмо.txt",{type:"text/plain"})); return; }
      if(m==="unknown action") throw new Error("скрипт таблицы старый — Даниилу нужно обновить Code.gs"); throw e; }
    let x; try{ x=JSON.parse(String(j.text).replace(/^```(json)?|```$/g,"").trim()); }catch(e){ throw new Error("ИИ ответил не по форме — попробуйте ещё раз"); }
    const src=aiSrc(x); src.how="Заявка из письма прочитана ИИ ("+(/^claude/i.test(j.model||"")?"Claude":"Gemini")+(j.model?", "+j.model:"")+"). Сверьте количество и товары с письмом.";
    logEv("Документ","Заявка из письма «"+o.name+"» прочитана ИИ");
    IMP={file:o.name}; IMP.r=impResolve(ftParse(src, cid||undefined)); impShow();
  }catch(e){ IMP={file:o.name, err:e.message||String(e)}; drawImp(); toast("err","ИИ не прочитал заявку", IMP.err+"."); } }
/* ---------- написать / ответить ---------- */
function mlCompose(kind){ const r=ML.rows.find(x=>x.id===ML.sel), V=ML.view&&r&&ML.view.id===r.id?ML.view:null, mine=new Set(ML.acc.map(a=>a.email.toLowerCase()));
  const acc=r ? r.acc : (ML.box || (ML.acc[0]||{}).id || ""), C={acc, to:"", cc:"", subject:"", text:"", files:[], reply:"", inReply:"", refs:"", kind};
  if(r && (kind==="reply"||kind==="replyall")){ C.reply=r.id; C.to=r.replyTo||r.from; C.subject=/^re:/i.test(r.subject||"")?r.subject:"Re: "+(r.subject||"");
    if(kind==="replyall"){ const all=(String(r.to||"")+","+String(r.cc||"")).split(",").map(s=>s.trim()).filter(s=>s && !mine.has((s.match(/<([^>]+)>/)||[,s])[1].toLowerCase())); C.cc=all.join(", "); }
    C.inReply=r.msgid||""; C.refs=((r.refs||"")+" "+(r.msgid||"")).trim();
    const q=String((V&&V.text)||r.snippet||"").split("\n").slice(0,60).map(l=>"> "+l).join("\n");
    C.text="\n\n"+(mlAccOf(acc).name||"Фруктовый Дом")+"\n\n"+mlFull(r.date)+", "+(r.fromName||r.from)+" <"+r.from+"> написал(а):\n"+q; }
  if(r && kind==="fwd"){ C.subject="Fwd: "+(r.subject||""); C.text="\n\n---------- Пересланное письмо ----------\nОт: "+(r.fromName||"")+" <"+r.from+">\nДата: "+mlFull(r.date)+"\nТема: "+(r.subject||"")+"\nКому: "+(r.to||"")+"\n\n"+String((V&&V.text)||r.snippet||""); C.fwdAtts=mlAtts(r).map((x,i)=>({i, n:x.n, s:x.s, on:true})); C.fwdFrom=r.id; }
  if(mlMob()) mlLayer("v"); ML.comp=C; mlDraw(); mlScrollView(); setTimeout(()=>{ const f=kind==="new"||kind==="fwd"?$("#mlc-to"):$("#mlc-text"); if(f){ f.focus(); if(f.id==="mlc-text") f.setSelectionRange(0,0); } }, 50); }
/* после перерисовки — курсор туда же, где печатали */
function mlCompFocus(){ const C=ML.comp, f=C&&C.foc; if(!f) return; const el=document.getElementById(f.id); if(!el || document.activeElement===el) return;
  try{ el.focus({preventScroll:true}); if(f.s!=null && el.setSelectionRange) el.setSelectionRange(f.s, f.e); if(f.t) el.scrollTop=f.t; }catch(e){} }
function mlCompHtml(){ const C=ML.comp; C.k=C.k||Math.random().toString(36).slice(2,9); const sum=C.files.reduce((s,f)=>s+f.size,0)+(C.fwdAtts||[]).filter(x=>x.on).reduce((s,x)=>s+(+x.s||0),0);
  return `<div class="mlcomp" data-ck="${C.k}"><div class="mlvh">${mlMob()?"":`<button type="button" class="btn ghost sm mlback" data-ml="cclose">‹ Письма</button>`}<h3>${C.kind==="new"?"Новое письмо":C.kind==="fwd"?"Переслать":"Ответ"}</h3></div>
    <label class="f">С ящика<select id="mlc-acc">${ML.acc.map(a=>`<option value="${a.id}"${a.id===C.acc?" selected":""}>${esc((a.name?a.name+" — ":"")+a.email)}</option>`).join("")}</select></label>
    <label class="f">Кому<input id="mlc-to" value="${esc(C.to)}" placeholder="адрес@пример.ru, второй@пример.ru" autocomplete="off" list="mlc-dl"></label>
    <label class="f">Копия<input id="mlc-cc" value="${esc(C.cc)}" placeholder="необязательно" autocomplete="off"></label>
    <datalist id="mlc-dl">${[...new Set(ML.rows.filter(r=>r.dir!=="sent"&&r.from).map(r=>(r.fromName?r.fromName+" <"+r.from+">":r.from)))].slice(0,300).map(x=>`<option value="${esc(x)}">`).join("")}</datalist>
    <label class="f">Тема<input id="mlc-sub" value="${esc(C.subject)}" autocomplete="off"></label>
    <label class="f">Текст<textarea id="mlc-text" rows="12">
${esc(C.text)}</textarea></label>
    <div class="mlcf">${(C.fwdAtts||[]).map(x=>`<label class="mlchip"><input type="checkbox" data-mlfa="${x.i}"${x.on?" checked":""}> ${ML_IC.clip} ${esc(x.n)} <small>${x.s?mlSize(x.s):""}</small></label>`).join("")}
      ${C.files.map((f,i)=>`<span class="mlchip">${ML_IC.clip} ${esc(f.name)} <small>${mlSize(f.size)}</small><button type="button" data-mlfx="${i}" aria-label="Убрать">×</button></span>`).join("")}
      <label class="btn ghost sm">${ML_IC.clip} Прикрепить файл<input type="file" id="mlc-file" multiple hidden></label>${sum>2.3e6?`<span class="neg" style="font-size:12.5px">вложения больше 2,3 МБ — так не уйдёт</span>`:""}</div>
    <div class="mlcb"><button type="button" class="btn pri" data-ml="send" ${C.busy?"disabled":""}>${C.busy?`<i class="spin"></i>Отправляю…`:"Отправить"}</button><button type="button" class="btn ghost" data-ml="cclose">Отмена</button></div></div>`; }
function mlCompRead(){ const C=ML.comp; if(!C) return; const form=document.querySelector('.mlcomp[data-ck="'+(C.k||"")+'"]'); if(!form) return;   /* поля именно этого письма (а не прошлого черновика) */
  const ae=document.activeElement; C.foc = ae && form.contains(ae) && ae.id ? {id:ae.id, s:ae.selectionStart, e:ae.selectionEnd, t:ae.scrollTop} : null;
  const v=id=>(document.getElementById(id)||{}).value; C.acc=v("mlc-acc")??C.acc; C.to=v("mlc-to")??C.to; C.cc=v("mlc-cc")??C.cc; C.subject=v("mlc-sub")??C.subject; C.text=v("mlc-text")??C.text; }
const mlSplit = s => String(s||"").split(/[,;]\s*/).map(x=>x.trim()).filter(Boolean);
const mlB64 = f => new Promise((ok,bad)=>{ const r=new FileReader(); r.onload=()=>{ const u=String(r.result); ok(u.slice(u.indexOf(",")+1)); }; r.onerror=()=>bad(new Error("файл не прочитался")); r.readAsDataURL(f); });
async function mlSend(){ mlCompRead(); const C=ML.comp, to=mlSplit(C.to), cc=mlSplit(C.cc), bad=[...to,...cc].filter(x=>!/[^@\s<]+@[^@\s>]+\.[^@\s>]+/.test(x));
  if(!to.length){ toast("warn","Укажите, кому отправить",""); $("#mlc-to").focus(); return; } if(bad.length){ toast("warn","Адрес написан неверно", bad.join(", ")); return; }
  if(!C.subject.trim() && !confirm("Отправить письмо без темы?")) return;
  C.busy=true; mlDraw();
  try{ const atts=[]; for(const f of C.files) atts.push({name:f.name, mime:f.type||"application/octet-stream", data:await mlB64(f)});
    if(C.fwdFrom){ const r=ML.rows.find(x=>x.id===C.fwdFrom); for(const x of (C.fwdAtts||[]).filter(y=>y.on)){ const f=await mlAttGet(r, x.i); atts.push({name:f.name, mime:f.type, data:await mlB64(f)}); } }
    if(atts.reduce((s,x)=>s+x.data.length,0)>3.2e6) throw new Error("вложения больше 2,3 МБ — отправьте их из обычной почты");
    const j=await apiFetch(API_URL,{method:"POST", tmo:120000, body:JSON.stringify({key:pass(), user:curUser(), action:"mail", op:"send", acc:C.acc, reply:C.reply, msg:{to, cc, subject:C.subject, text:C.text, inReply:C.inReply, refs:C.refs, atts}})});
    if(j.row) ML.rows.unshift(j.row); if(C.reply){ const r=ML.rows.find(x=>x.id===C.reply); if(r) r.ans=new Date().toISOString(); }
    ML.comp=null; mlDraw(); toast("ok","Письмо отправлено", to.join(", ")+(j.saved?"":" · копия в «Отправленных» ящика не сохранилась"));
  }catch(e){ C.busy=false; mlDraw(); toast("err","Письмо не ушло", e.message); } }
/* ---------- настройки ящиков (только Даниил) ---------- */
function mlSetHtml(){ const E=ML.edit, px=ML.px;
  const pxBox = !ML.proxy ? `<div class="mlpx"><b>Посредник в Яндекс Облаке не подключён</b><p>Google не умеет заходить в почтовые ящики Mail.ru и Timeweb напрямую — письма забирает тот же посредник, что и выписку банка.</p>
      <ol><li>Яндекс Облако → «Cloud Functions» → «Создать функцию» (можно взять уже созданную для банка).</li><li>Среда <b>Node.js 22</b>, точка входа <code>index.handler</code>, таймаут <b>60 секунд</b>, память 256 МБ, переменная окружения <code>SECRET</code> = секрет ниже. Функция — <b>публичная</b>.</li>
      <li>Код: кнопка «Скопировать код» → вставить в файл index.js → «Сохранить изменения».</li><li>Ссылку на функцию вставьте сюда и нажмите «Подключить».</li></ol>
      <div class="mlpxf"><label class="f">Ссылка на функцию<input id="mlpx-url" placeholder="https://functions.yandexcloud.net/…" autocomplete="off"></label><label class="f">Секрет<input id="mlpx-sec" value="${esc(typeof bnSecret==="function"?bnSecret():"")}" autocomplete="off"></label></div>
      <div class="row"><button class="btn" type="button" data-ml="pxcopy">Скопировать код</button><button class="btn pri" type="button" data-ml="pxsave">Подключить</button></div></div>`
    : `<div class="mlpx ok"><b>Посредник подключён</b> <span class="muted">(тот же, что для банка)</span>${px&&px.mail===0?`<p class="neg">Его код старый — он умеет только банк. Обновите: «Скопировать код» → Яндекс Облако → ваша функция → «Редактор» → заменить весь index.js → «Сохранить изменения». Там же поставьте таймаут 60 секунд.</p>`:px&&px.mail===1?`<p class="neg">Код посредника нужно обновить — старая версия падает на очень больших письмах (например, после переноса старой почты), и ящик перестаёт обновляться. «Скопировать код» → Яндекс Облако → ваша функция → «Редактор» → заменить весь index.js → «Сохранить изменения». Там же в настройках функции поставьте память 512 МБ и таймаут 60 секунд.</p>`:px&&px.mail?`<p class="pos">Код новый — почту забирает.</p>`:`<p class="muted">Проверяю версию…</p>`}
      <div class="row"><button class="btn ghost sm" type="button" data-ml="pxcopy">Скопировать код посредника</button><button class="btn ghost sm" type="button" data-ml="pxcheck">Проверить</button></div></div>`;
  const list=ML.acc.map(a=>`<div class="mlsa" style="--c:${mlCol(a.id)}"><i></i><span><b>${esc(a.email)}</b><small>${esc(a.name||"")} · ${esc(a.ih)} / ${esc(a.sh)} · пароль …${esc(a.tail)}${a.at?" · проверен "+mlFull(a.at):""}</small>${a.err?`<small class="neg">Ошибка: ${esc(mlErrTxt(a.err))}</small>`:""}</span>
      <button class="btn ghost sm" type="button" data-mlae="${a.id}">Изменить</button><button class="btn ghost sm danger" type="button" data-mlad="${a.id}">${E&&E.del===a.id?"Точно отключить?":"Отключить"}</button></div>`).join("");
  const pre=E&&E.pre?ML_PRE[E.pre]:null;
  const form = E && !E.del ? `<div class="mlform"><h4>${E.id?"Изменить ящик":"Подключить ящик"}</h4>
      <div class="pfchips">${Object.keys(ML_PRE).map(k=>`<button type="button" data-mlpre="${k}" class="${E.pre===k?"on":""}">${ML_PRE[k].t}</button>`).join("")}</div>
      ${pre?`<p class="mlhow">${esc(pre.how)}</p>`:""}
      <div class="mlfg"><label class="f">Адрес ящика<input id="mla-email" value="${esc(E.email||"")}" placeholder="info@frudom.ru" autocomplete="off" inputmode="email"></label>
        <label class="f">Имя отправителя<input id="mla-name" value="${esc(E.name||"Фруктовый Дом")}" autocomplete="off"></label>
        <label class="f">Пароль для внешних приложений<input id="mla-pass" class="mlpw" value="" placeholder="${E.id?"оставьте пустым — останется прежний":"вставьте пароль"}" autocomplete="off" spellcheck="false"></label>
        <label class="f">Логин (обычно = адрес)<input id="mla-user" value="${esc(E.user||"")}" placeholder="как адрес" autocomplete="off"></label>
        <label class="f">Сервер IMAP (чтение)<input id="mla-ih" value="${esc(E.ih||"")}" autocomplete="off"></label><label class="f">Порт<input id="mla-ip" value="${esc(E.ip||993)}" inputmode="numeric" autocomplete="off"></label>
        <label class="f">Сервер SMTP (отправка)<input id="mla-sh" value="${esc(E.sh||"")}" autocomplete="off"></label><label class="f">Порт<input id="mla-sp" value="${esc(E.sp||465)}" inputmode="numeric" autocomplete="off"></label></div>
      ${E.msg?`<p class="${E.okm?"pos":"neg"} mlmsg">${esc(E.msg)}</p>`:""}
      <div class="row"><button class="btn pri" type="button" data-ml="accsave" ${E.busy||!ML.proxy?"disabled":""}>${E.busy?`<i class="spin"></i>Проверяю ящик…`:"Проверить и подключить"}</button><button class="btn ghost" type="button" data-ml="acccancel">Отмена</button>${!ML.proxy?`<small class="muted">сначала подключите посредника</small>`:""}</div>
      <p class="muted" style="font-size:12px">Пароль хранится только в скрипте вашей Google Таблицы; на сайте видны последние 4 знака. Сайт не помечает письма в ящике прочитанными.</p></div>` : "";
  return `<div class="mlhd"><button type="button" class="btn ghost sm" data-ml="setclose">‹ Почта</button><h2>Ящики</h2></div>${pxBox}
    <div class="mlsl">${list||`<p class="muted">Ящиков пока нет.</p>`}</div>${form || `<button class="btn pri" type="button" data-ml="accadd">+ Подключить ящик</button>`}`; }
function mlAccRead(){ const E=ML.edit, v=id=>((document.getElementById(id)||{}).value||"").trim(); if(!E) return; E.email=v("mla-email"); E.name=v("mla-name"); E.user=v("mla-user"); E.ih=v("mla-ih"); E.ip=v("mla-ip"); E.sh=v("mla-sh"); E.sp=v("mla-sp"); E.pass=((document.getElementById("mla-pass")||{}).value||""); }
function mlPreFor(email){ const d=String(email||"").split("@")[1]||""; return /^(mail|bk|inbox|list|internet)\.ru$/.test(d)?"mailru":/^(yandex\.(ru|com)|ya\.ru)$/.test(d)?"yandex":d==="frudom.ru"?"timeweb":""; }
async function mlAccSave(){ mlAccRead(); const E=ML.edit; if(!E.email){ E.msg="Впишите адрес ящика"; E.okm=0; mlDraw(); return; } if(!E.id && !E.pass){ E.msg="Вставьте пароль для внешних приложений"; E.okm=0; mlDraw(); return; }
  E.busy=true; E.msg=""; mlDraw();
  try{ const j=await apiFetch(API_URL,{method:"POST", tmo:280000, body:JSON.stringify({key:pass(), user:curUser(), action:"mail", op:"acc", a:{id:E.id||"", email:E.email, name:E.name, user:E.user||E.email, pass:E.pass, ih:E.ih, ip:E.ip, sh:E.sh, sp:E.sp}})});
    mlTake(j); ML.at=Date.now(); ML.edit=null; ML.loaded=true; mlDraw(); toast("ok","Ящик подключён", E.email+(j.added?" · загружено писем: "+j.added:"")); }
  catch(e){ E.busy=false; E.okm=0; E.msg=e.message==="noproxy"?"Сначала подключите посредника":e.message==="oldproxy"?"Код посредника старый — обновите его (кнопка выше)":"Не подключился: "+e.message; mlDraw(); } }
async function mlPxCheck(){ try{ ML.px=await api({action:"mail", op:"proxyCheck"}); }catch(e){ ML.px=null; } if(ML.set) mlDraw(); }
async function mlPxSave(){ const url=(($("#mlpx-url")||{}).value||"").trim(), secret=(($("#mlpx-sec")||{}).value||"").trim(); if(!url){ toast("warn","Вставьте ссылку на функцию",""); return; }
  try{ await api({action:"bank", op:"proxy", url, secret}); ML.proxy=true; toast("ok","Посредник подключён",""); mlPxCheck(); mlDraw(); }catch(e){ toast("err","Посредник не подключился", e.message); } }
/* ---------- нажатия ---------- */
document.addEventListener("click", e=>{ const root=e.target.closest&&e.target.closest("#ml, #ml-ov"); if(!root) return; const t=e.target;
  if(ML.noClick && Date.now()-ML.noClick<450 && t.closest("#ml-list")){ e.preventDefault(); return; }
  const mm=t.closest("[data-mm]"); if(mm){ e.preventDefault(); mlMobAct(mm.dataset.mm, mm, e); return; }
  const qb=t.closest("[data-mlq]"); if(qb){ e.stopPropagation(); const row=qb.closest(".mlr"), r=row&&ML.rows.find(x=>x.id===row.dataset.mlid); if(r) mlQuick(r, qb.dataset.mlq, e); return; }
  const row=t.closest("[data-mlid]"); if(row){ if(ML.pmode){ mlPickTog(row.dataset.mlid); return; } mlOpen(row.dataset.mlid); return; }
  const f=t.closest("[data-mlf]"); if(f){ ML.f=f.dataset.mlf; ML.more=0; mlDraw(); return; }
  const bx=t.closest("[data-mlbox]"); if(bx){ ML.box=bx.dataset.mlbox; ML.more=0; mlDraw(); return; }
  const at=t.closest("[data-mlatt]"); if(at){ const r=ML.rows.find(x=>x.id===ML.sel); if(r){ if(at.dataset.how==="view") mlViewer(r, +at.dataset.mlatt); else mlAtt(r, +at.dataset.mlatt, at.dataset.how); } return; }
  const mk=t.closest("[data-mlmk]"); if(mk && !mlRO()){ const r=ML.rows.find(x=>x.id===ML.sel); if(r) mlMake(r, mk.dataset.mlmk); return; }
  const fx=t.closest("[data-mlfx]"); if(fx){ mlCompRead(); ML.comp.files.splice(+fx.dataset.mlfx,1); mlDraw(); return; }
  const fa=t.closest("[data-mlfa]"); if(fa){ mlCompRead(); const x=ML.comp.fwdAtts.find(y=>y.i===+fa.dataset.mlfa); if(x) x.on=fa.checked; return; }
  const pre=t.closest("[data-mlpre]"); if(pre){ mlAccRead(); const P=ML_PRE[pre.dataset.mlpre]; Object.assign(ML.edit,{pre:pre.dataset.mlpre}); if(P.ih){ ML.edit.ih=P.ih; ML.edit.sh=P.sh; ML.edit.ip=993; ML.edit.sp=465; } mlDraw(); return; }
  const ae=t.closest("[data-mlae]"); if(ae){ const a=mlAccOf(ae.dataset.mlae); ML.edit=Object.assign({pre:mlPreFor(a.email)}, a); mlDraw(); return; }
  const ad=t.closest("[data-mlad]"); if(ad){ const id=ad.dataset.mlad; if(!(ML.edit&&ML.edit.del===id)){ ML.edit={del:id}; mlDraw(); return; }
    api({action:"mail", op:"delAcc", id}).then(j=>{ mlTake(j); ML.edit=null; mlDraw(); toast("info","Ящик отключён","Письма, что уже пришли, остаются."); }).catch(x=>toast("err","Не отключился", x.message)); return; }
  const mkb=t.closest("[data-mk]"); if(mkb){ const r=ML.rows.find(x=>x.id===ML.sel); if(r && !mlRO()) mlMark(r, mkb.dataset.mk); return; }
  const b=t.closest("[data-ml]"); if(!b) return; const a=b.dataset.ml, r=ML.rows.find(x=>x.id===ML.sel);
  if(a==="sync"){ mlLoad(true); return; }
  if(a==="more"){ ML.more+=60; mlDraw(); return; }
  if(a==="back"){ if(mlMob()){ mlLayerOff(); return; } ML.sel=""; ML.view=null; mlListMark(); return; }
  if(a==="readall"){ mlReadAll(); return; }
  if(!mlRO() && a==="fldnew"){ mlFldNew(); return; }
  if(!mlRO() && a==="fldren"){ mlFldRen(); return; }
  if(!mlRO() && a==="flddel"){ mlFldDel(); return; }
  if(!mlRO() && a==="fldpick" && r){ const b2=b.getBoundingClientRect(); mlFldMenu([r], b2.left, b2.bottom+4); return; }
  if(!mlRO() && a==="fldout" && r){ mlBulkUi([r], "fld:"); return; }
  if(a==="new"){ ML.sel=""; mlCompose("new"); return; }
  if(mlRO() && /^(new|reply|replyall|fwd|send|unread|notord|isord|set)$/.test(a)) return;
  if(a==="reply"||a==="replyall"||a==="fwd"){ mlCompose(a); return; }
  if(a==="cclose"){ if(mlMob() && !ML.sel){ mlLayerOff(); return; } ML.comp=null; mlDraw(); return; }
  if(a==="send"){ mlSend(); return; }
  if(a==="unread" && r){ const un=!mlUnread(r); r.read=un?"":"1"; mlSet([{id:r.id, read:!un}]); const v=$("#ml-view"); if(v) v.innerHTML=mlViewHtml(); mlListMark(); mlBadge(); return; }
  if(a==="html"){ ML.html=!ML.html; $("#ml-view").innerHTML=mlViewHtml(); return; }
  if(a==="imgs"){ ML.imgs=true; $("#ml-view").innerHTML=mlViewHtml(); return; }
  if(r && /^(spam|nospam|minor|major|tagno|tagcus|untag|tagsave|tagx)$/.test(a)){ mlAct(r, a, b); return; }
  if(a==="done" && r && false){ const on=!mlDone(r); mlOrdPatch(r, {done: on?{by:curUser(), at:new Date().toISOString()}:null}, on); if(on) r.read="1"; mlListMark(); mlRowSync(r); const v=$("#ml-view"); if(v) v.innerHTML=mlViewHtml(); const b=v&&v.querySelector(".mldone"); if(b&&on) b.classList.add("pop"); mlBadge(); mlCounts(); toast(on?"ok":"info", on?"Письмо обработано":"Пометка снята",""); return; }
  if(a==="notord" && r){ mlOrdPatch(r, {st:"no", at:new Date().toISOString(), by:curUser()}); mlDraw(); toast("info","Отмечено: не заявка",""); return; }
  if(a==="isord" && r){ ML.force=r.id; $("#ml-view").innerHTML=mlViewHtml(); return; }
  if(a==="set"){ ML.set=true; ML.edit=ML.acc.length?null:{pre:"mailru", ih:ML_PRE.mailru.ih, sh:ML_PRE.mailru.sh, ip:993, sp:465, email:"frudom.ru@mail.ru"}; mlDraw(); if(ML.proxy!==false) mlPxCheck(); return; }
  if(a==="setclose"){ ML.set=false; ML.edit=null; mlDraw(); return; }
  if(a==="accadd"){ const has=new Set(ML.acc.map(x=>x.email)); const em=["frudom.ru@mail.ru","info@frudom.ru"].find(x=>!has.has(x))||""; const p=mlPreFor(em)||"mailru"; ML.edit={pre:p, email:em, ih:ML_PRE[p].ih, sh:ML_PRE[p].sh, ip:993, sp:465}; mlDraw(); return; }
  if(a==="acccancel"){ ML.edit=null; mlDraw(); return; }
  if(a==="accsave"){ mlAccSave(); return; }
  if(a==="pxcheck"){ ML.px=null; mlDraw(); mlPxCheck(); return; }
  if(a==="pxsave"){ mlPxSave(); return; }
  if(a==="pxcopy"){ const code=typeof BN_PROXY_CODE!=="undefined"?BN_PROXY_CODE:""; if(!code){ toast("err","Код не встроен в эту сборку",""); return; }
    (navigator.clipboard?navigator.clipboard.writeText(code):Promise.reject()).then(()=>toast("ok","Код посредника скопирован","Вставьте его в index.js функции в Яндекс Облаке и нажмите «Сохранить изменения»."),()=>{ const ta=document.createElement("textarea"); ta.value=code; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("ok","Код скопирован",""); }); return; }
});
document.addEventListener("input", e=>{ if(e.target.id==="ml-q"){ ML.q=e.target.value; const pos=e.target.selectionStart; mlDraw(); const q=$("#ml-q"); if(q){ q.focus(); try{ q.setSelectionRange(pos,pos); }catch(x){} } }
  if(e.target.id==="mla-email" && ML.edit && !ML.edit.id){ const p=mlPreFor(e.target.value); if(p && p!==ML.edit.pre){ mlAccRead(); ML.edit.pre=p; ML.edit.ih=ML_PRE[p].ih; ML.edit.sh=ML_PRE[p].sh; const pos=e.target.selectionStart; mlDraw(); const x=$("#mla-email"); if(x){ x.focus(); try{ x.setSelectionRange(pos,pos); }catch(y){} } } } });
document.addEventListener("change", e=>{ if(e.target.id==="mlc-file"){ mlCompRead(); ML.comp.files.push(...e.target.files); mlDraw(); } });
document.addEventListener("keydown", e=>{ if(e.target.id==="ml-q" && e.key==="Escape"){ e.target.value=""; ML.q=""; mlDraw(); }
  if((e.ctrlKey||e.metaKey) && e.key==="Enter" && e.target.id==="mlc-text"){ e.preventDefault(); mlSend(); } });

/* перерисовать одну строку списка и счётчики фильтров без мигания */
function mlRowSync(r){ const b=document.querySelector(`#ml-list .mlr[data-mlid="${CSS.escape(r.id)}"]`); if(!b) return; const i=[...b.parentNode.children].indexOf(b); const t=document.createElement("div"); t.innerHTML=mlRowHtml(r,i); const n=t.firstElementChild; n.style.animation="none"; b.replaceWith(n); }
function mlCounts(){ const f=document.querySelector('#ml [data-mlf="undone"]'); if(!f) return; const n=ML.rows.filter(r=>r.dir!=="sent" && !mlSpam(r) && !mlMinor(r) && !!mlTodo(r) && (!ML.box||r.acc===ML.box)).length; f.innerHTML="Не обработаны"+(n?` <em>${n}</em>`:""); }

/* ---------- отправитель: заказчик / не заказчик ---------- */
function mlTagLine(r){ const em=mlAddr(r), t=mlTag(em), ed=ML.tagEd===r.id;
  if(ed) return `<div class="mltl edit"><span>Отправитель <b>${esc(em)}</b> — заказчик:</span><select id="ml-tcus">${`<option value="">— выберите —</option>`+opts(D.customers.filter(x=>!isPriv(x.id)), t&&t.customerId||((mlOrd(r).cus||{}).cid)||"")}</select><button type="button" class="btn sm pri" data-ml="tagsave">Сохранить</button><button type="button" class="btn sm ghost" data-ml="tagx">Отмена</button></div>`;
  const by=t&&t.by?`<small>${esc(t.by)}${t.at?", "+esc(mlDate(t.at)):""}</small>`:"";
  if(t && t.kind==="cus") return `<div class="mltl"><span class="mltag cus">Заказчик${cus(t.customerId)?" · "+esc(cusNm(t.customerId)):""}</span>${by}${mlRO()?"":`<button type="button" class="btn ghost sm" data-ml="tagcus">Изменить</button><button type="button" class="btn ghost sm" data-ml="untag">Снять</button>`}</div>`;
  if(t && t.kind==="no") return `<div class="mltl"><span class="mltag no">Не заказчик</span>${by}${mlRO()?"":`<button type="button" class="btn ghost sm" data-ml="untag">Снять</button>`}</div>`;
  if(mlRO() || (t && t.kind==="spam")) return "";
  return `<div class="mltl"><span class="muted">Кто отправитель?</span><button type="button" class="btn ghost sm" data-ml="tagcus">Это заказчик…</button><button type="button" class="btn ghost sm" data-ml="tagno">Не заказчик</button></div>`; }
async function mlTagSet(email, kind, cid, quiet){ email=String(email||"").toLowerCase(); if(!email) return;
  ML.tags=ML.tags||{}; if(kind) ML.tags[email]={kind, customerId:cid||"", by:curUser(), at:new Date().toISOString()}; else delete ML.tags[email];
  const local=()=>{ const p=getPrefs(); p.mlTags=Object.assign({}, p.mlTags||{}); if(kind) p.mlTags[email]=ML.tags[email]; else delete p.mlTags[email]; setPrefs(p, true); };
  if(ML.tagSrv===false){ local(); if(!quiet) toast("warn","Пометка сохранена только у вас","Чтобы её видели все — обновите Code.gs."); return; }
  try{ const j=await api({action:"mail", op:"tag", email, kind:kind||"", cid:cid||""}); if(Array.isArray(j.tags)) mlTake({tags:j.tags}); }
  catch(e){ if(/unknown op|unknown action/.test(e.message)){ ML.tagSrv=false; local(); if(!quiet) toast("warn","Пометка сохранена только у вас","Чтобы её видели все — обновите Code.gs."); } else toast("err","Пометка не сохранилась", e.message); } }
function mlRefresh(){ const v=$("#ml-view"); const keep=ML.sel; mlDraw(); ML.sel=keep; }
function mlAct(r, a, el){ const em=mlAddr(r);
  if(a==="spam"){ mlOrdPatch(r, {spam:1}, true); r.read="1"; mlTagSet(em, "spam", "", true); if(ML.sel===r.id && ML.f!=="spam"){ ML.sel=""; ML.view=null; }
    mlDraw(); toast("info","Письмо в спаме", "Письма от "+em+" теперь сразу попадают в «Спам». Вернуть — «Спам» → «Не спам»."); return; }
  if(a==="minor"){ mlOrdPatch(r, {minor:1}, true); r.read="1"; if(ML.sel===r.id && ML.f!=="minor"){ ML.sel=""; ML.view=null; } mlDraw(); toast("info","Письмо в «Неважных»","Только это письмо — следующие от "+em+" придут как обычно."); return; }
  if(a==="major"){ mlOrdPatch(r, {minor:null}); mlDraw(); toast("ok","Письмо снова во «Входящих»",""); return; }
  if(a==="nospam"){ mlOrdPatch(r, {spam:0}); if((mlTag(em)||{}).kind==="spam") mlTagSet(em, "", "", true); ML.rows.forEach(x=>{ if(x!==r && mlAddr(x)===em){ const o=mlOrdSt(x)||{}; if(o.spam!==1) return; } }); mlDraw(); toast("ok","Не спам","Письма от "+em+" снова во «Входящих»."); return; }
  if(a==="tagno"){ mlTagSet(em, "no"); mlDraw(); toast("info","Отмечено: не заказчик", em); return; }
  if(a==="untag"){ mlTagSet(em, ""); mlDraw(); return; }
  if(a==="tagcus"){ ML.tagEd=r.id; if(ML.sel!==r.id){ mlOpen(r.id); return; } const v=$("#ml-view"); if(v){ v.innerHTML=mlViewHtml(); const sl=$("#ml-tcus"); if(sl) sl.focus(); } return; }
  if(a==="tagx"){ ML.tagEd=""; const v=$("#ml-view"); if(v) v.innerHTML=mlViewHtml(); return; }
  if(a==="tagsave"){ const cid=($("#ml-tcus")||{}).value||""; if(!cid){ toast("warn","Выберите заказчика",""); return; } ML.tagEd=""; mlTagSet(em, "cus", cid); mlDraw(); toast("ok","Отмечено: заказчик — "+cusNm(cid), "Письма от "+em+" будут с этой пометкой."); return; } }
/* ---------- быстрые кнопки и меню по правой кнопке ---------- */
function mlQuick(r, q, ev){ if(q==="menu"){ const b=ev.target.closest("button").getBoundingClientRect(); mlMenu(r, b.left, b.bottom+4); return; }
  if(q==="read"){ const un=!!r.read; r.read=un?"":"1"; mlSet([{id:r.id, read:!un}]); mlRowSync(r); mlListMark(); mlBadge(); if(ML.sel===r.id){ const v=$("#ml-view"); if(v) v.innerHTML=mlViewHtml(); } return; }
  if(q==="done"||q==="todo"){ mlMark(r, (q==="done"?mlDone(r):mlTodo(r)) ? "" : q); return; }
  if(q==="done"){ const on=!mlDone(r); mlOrdPatch(r, {done: on?{by:curUser(), at:new Date().toISOString()}:null}, on); if(on) r.read="1"; mlRowSync(r); mlCounts(); mlBadge(); if(ML.sel===r.id){ const v=$("#ml-view"); if(v) v.innerHTML=mlViewHtml(); } toast(on?"ok":"info", on?"Письмо обработано":"Пометка снята",""); return; }
  if(q==="spam"||q==="nospam"||q==="minor"||q==="major") mlAct(r, q); }
function mlMenuClose(){ const m=document.getElementById("ml-menu"); if(m){ m.removeAttribute("id"); m.classList.add("out"); setTimeout(()=>m.remove(),120); } }
function mlMenu(r, x, y){ mlMenuClose(); const ro=mlRO(), inb=r.dir!=="sent", t=mlTag(mlAddr(r)), sp=mlSpam(r);
  const it=(k,ic,txt,cls)=>`<button type="button" role="menuitem" data-mlm="${k}" class="${cls||""}">${ic?`<i>${ic}</i>`:"<i></i>"}<span>${txt}</span></button>`, sep=`<hr>`;
  const L=[it("open",ML_IC.eye,"Открыть")];
  if(!ro){ if(inb) L.push(it("reply",ML_IC.reply,"Ответить")); L.push(it("fwd","","Переслать"));
    if(inb){ L.push(sep, it("read", r.read?ML_IC.mail1:ML_IC.mail0, r.read?"Отметить непрочитанным":"Отметить прочитанным"), it("todo", ML_IC_TODO, mlTodo(r)?"Снять «Не обработано»":"Не обработано", "todo"), it("done", ML_IC_OK, mlDone(r)?"Снять «Обработано»":"Обработано", "ok"));
      L.push(sep, t&&t.kind==="cus" ? it("tagcus","","Заказчик: "+esc(cusNm(t.customerId)||"?")+" — изменить…") : it("tagcus","","Это заказчик…"), t&&t.kind==="no" ? it("untag","","Снять «Не заказчик»") : it("tagno","","Не заказчик"));
      L.push(sep, it("fldpick", ML_IC_FLD, mlFld(r)?"В другую папку…":"В папку…"));
      L.push(sep, mlMinor(r) ? it("major",ML_IC.minor,"Вернуть во входящие") : it("minor",ML_IC.minor,"В неважные"), sp ? it("nospam",ML_IC.spam,"Не спам") : it("spam",ML_IC.spam,"В спам — и все письма от него", "bad")); } }
  const m=document.createElement("div"); m.id="ml-menu"; m.className="mlmenu"; m.setAttribute("role","menu"); m.dataset.id=r.id;
  m.innerHTML=`<div class="mlmh">${esc(r.dir==="sent"?r.to:(r.fromName||r.from))}<small>${esc(r.subject||"(без темы)")}</small></div>`+L.join("");
  (document.querySelector("dialog[open]")||document.getElementById("fd-app")).appendChild(m);
  const W=m.offsetWidth, H=m.offsetHeight; m.style.left=Math.max(8, Math.min(x, innerWidth-W-8))+"px"; m.style.top=Math.max(8, Math.min(y, innerHeight-H-8))+"px";
  requestAnimationFrame(()=>m.classList.add("in")); const f=m.querySelector("[data-mlm]"); if(f) f.focus(); }
document.addEventListener("click", e=>{ const m=document.getElementById("ml-menu"); if(!m) return; const b=e.target.closest&&e.target.closest("[data-mlm]");
  if(b && m.contains(b)){ const r=ML.rows.find(x=>x.id===m.dataset.id), k=b.dataset.mlm, rc=m.getBoundingClientRect(); mlMenuClose(); if(!r) return;
    if(k==="fldpick"){ mlFldMenu([r], rc.left, rc.top); return; }
    if(k==="open"){ mlOpen(r.id); return; } if(k==="reply"||k==="fwd"){ mlOpen(r.id).then(()=>mlCompose(k)); return; }
    if(k==="read"||k==="done"||k==="todo"){ mlQuick(r, k); return; } mlAct(r, k); return; }
  if(!m.contains(e.target)) mlMenuClose(); }, true);
document.addEventListener("contextmenu", e=>{ const row=e.target.closest&&e.target.closest("#ml-list .mlr"); if(!row) return; if(mlMob()){ e.preventDefault(); return; } const r=ML.rows.find(x=>x.id===row.dataset.mlid); if(!r) return; e.preventDefault(); mlMenu(r, e.clientX, e.clientY); });
document.addEventListener("keydown", e=>{ const m=document.getElementById("ml-menu");
  if(m){ if(e.key==="Escape"){ e.preventDefault(); mlMenuClose(); return; } if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); const L=[...m.querySelectorAll("[data-mlm]")], i=L.indexOf(document.activeElement); L[(i+(e.key==="ArrowDown"?1:-1)+L.length)%L.length].focus(); } return; }
  const row=e.target.closest&&e.target.closest("#ml-list .mlr"); if(row && e.target===row){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); mlOpen(row.dataset.mlid); } if(e.key==="ContextMenu"||(e.shiftKey&&e.key==="F10")){ e.preventDefault(); const b=row.getBoundingClientRect(); const r=ML.rows.find(x=>x.id===row.dataset.mlid); if(r) mlMenu(r, b.left+40, b.top+20); } } });
window.addEventListener("scroll", ()=>{ if(document.getElementById("ml-menu")) mlMenuClose(); }, true);
window.addEventListener("resize", mlMenuClose);
/* ---------- просмотр вложений на сайте без скачивания ---------- */
const mlKind = (n, m) => /\.pdf$/i.test(n)||/pdf/.test(m) ? "pdf" : /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(n)||/^image\/(jpe?g|png|gif|webp|bmp)/.test(m) ? "img" : /\.(xlsx|xls|xlsm|ods)$/i.test(n) ? "sheet" : /\.(csv|tsv)$/i.test(n) ? "csv"
  : /\.(txt|log|json|xml|html?)$/i.test(n)||/^text\//.test(m) ? "text" : /\.(docx?|rtf|odt|pptx?|odp)$/i.test(n) ? "office" : "";
/* Окно просмотра во весь экран (как просмотр документа): листание страниц, увеличение (кнопки, Ctrl+колесо, два пальца, двойное нажатие), поворот, печать */
const MLV_I={zo:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/></svg>',
  zi:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/></svg>',
  rl:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4v5h5"/><path d="M3.5 9A9 9 0 1 1 6 18.5"/></svg>',
  rr:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4v5h-5"/><path d="M20.5 9A9 9 0 1 0 18 18.5"/></svg>',
  dl:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>'};
const MLV_Z=[0.25,0.33,0.5,0.67,0.75,0.9,1,1.25,1.5,1.75,2,2.5,3,4,5];
async function mlViewer(r, i){ const x=mlAtts(r)[i]; if(!x) return; const kind=mlKind(x.n, x.m||"");
  if(!kind){ toast("info","Этот файл на сайте не посмотреть","Нажмите «⤓», чтобы скачать."); return; }
  const pages=kind==="pdf"||kind==="office"||kind==="img", V={z:1, rot:0, items:[], fs:kind==="text"||kind==="sheet"||kind==="csv"};
  const v=document.createElement("dialog"); v.className="mlvw"+(pages?" pg":" doc"); v.setAttribute("aria-label", x.n);
  const B=(a,t,ic,txt)=>`<button type="button" class="mlvbt" data-mlv="${a}" title="${t}" aria-label="${t}">${ic}${txt?`<span>${txt}</span>`:""}</button>`;
  v.innerHTML=`<div class="mlvbar"><div class="mlvt"><b>${esc(x.n)}</b><small>Вложение${x.s?" · "+mlSize(x.s):""}<span class="mlvpc"></span></small></div>
    <div class="mlvtools"><span class="mlvgrp">${B("zo","Уменьшить",MLV_I.zo)}<button type="button" class="mlvbt mlvzp" data-mlv="fit" title="По ширине экрана">100%</button>${B("zi","Увеличить",MLV_I.zi)}</span>
    ${pages?`<span class="mlvgrp">${B("rl","Повернуть влево",MLV_I.rl)}${B("rr","Повернуть вправо",MLV_I.rr)}</span>`:""}
    <span class="mlvgrp">${pages?`<button type="button" class="mlvbt" data-mlv="print" title="Печать" aria-label="Печать">${D_PRN}<span>Печать</span></button>`:""}${B("dl","Скачать",MLV_I.dl,"Скачать")}<button type="button" class="mlvbt mlvx dc-x" data-mlv="close" title="Закрыть (Esc)" aria-label="Закрыть">×</button></span></div></div>
    <div class="mlvb" tabindex="-1"><div class="mlvl"><i class="spin"></i> ${kind==="office"?"Готовлю просмотр (Word/Excel/PowerPoint превращаются в PDF — до 20 секунд)…":"Загружаю…"}</div></div>`;
  document.getElementById("fd-app").appendChild(v); let url=null; const body=v.querySelector(".mlvb");
  const bye=()=>{ try{ v.close(); }catch(e){} v.remove(); if(url) setTimeout(()=>URL.revokeObjectURL(url),1000); };
  v.addEventListener("cancel",e=>{ e.preventDefault(); bye(); }); v.addEventListener("close",()=>v.remove());
  /* раскладка: ширина страницы на экране = ширина «по экрану» × увеличение; при повороте на 90° меняются местами ширина и высота */
  const fitW=()=>Math.max(160, Math.min(body.clientWidth-(innerWidth<=600?16:48), 1100));
  const lay=()=>{ const zl=v.querySelector(".mlvzp"); if(zl) zl.textContent=Math.round(V.z*100)+"%";
    if(V.fs){ const t=body.querySelector(".mlvtxt,.mlvsheet"); if(t) t.style.fontSize=(13*V.z).toFixed(1)+"px"; return; }
    const side=V.rot%180!==0, W=fitW()*V.z;
    V.items.forEach(it=>{ const a=it.h/it.w, ew=side?W/a:W, eh=side?W:W*a, ww=W, wh=side?W/a:W*a;
      it.wrap.style.width=ww+"px"; it.wrap.style.height=wh+"px"; it.el.style.width=ew+"px"; it.el.style.height=eh+"px"; it.el.style.transform=`translate(-50%,-50%) rotate(${V.rot}deg)`; });
    v.classList.toggle("zm", V.z>1.01); };
  /* увеличение с сохранением точки под пальцем/курсором */
  const zoomTo=(z, cx, cy)=>{ z=Math.min(5, Math.max(0.25, z)); if(Math.abs(z-V.z)<0.001) return; const R=body.getBoundingClientRect();
    if(cx==null){ cx=R.left+body.clientWidth/2; cy=R.top+body.clientHeight/2; }
    const px=body.scrollLeft+cx-R.left, py=body.scrollTop+cy-R.top, k=z/V.z; V.z=z; lay();
    body.scrollLeft=px*k-(cx-R.left); body.scrollTop=py*k-(cy-R.top); };
  const step=d=>{ const L=MLV_Z, j=d>0?L.findIndex(q=>q>V.z+0.001):L.length-1-[...L].reverse().findIndex(q=>q<V.z-0.001); if(j>=0&&j<L.length) zoomTo(L[j]); };
  const rotate=d=>{ const top=body.scrollTop/(body.scrollHeight||1); V.rot=(V.rot+d+360)%360; lay(); body.scrollTop=top*body.scrollHeight; };
  v.addEventListener("click",e=>{ const b=e.target.closest("[data-mlv]"); if(!b) return; const a=b.dataset.mlv;
    if(a==="close") bye(); else if(a==="zi") step(1); else if(a==="zo") step(-1); else if(a==="fit"){ V.z=1; lay(); body.scrollLeft=0; }
    else if(a==="rl") rotate(-90); else if(a==="rr") rotate(90); else if(a==="dl") mlAtt(r, i, "get"); else if(a==="print") mlvPrint(V, x.n); });
  v.addEventListener("keydown",e=>{ if(e.target.closest("input,textarea,select")) return; const k=e.key;
    if(k==="+"||k==="="){ e.preventDefault(); step(1); } else if(k==="-"||k==="_"){ e.preventDefault(); step(-1); } else if(k==="0"){ e.preventDefault(); V.z=1; lay(); }
    else if((k==="r"||k==="к")&&pages&&!e.ctrlKey&&!e.metaKey){ e.preventDefault(); rotate(e.shiftKey?-90:90); } });
  body.addEventListener("wheel",e=>{ if(!(e.ctrlKey||e.metaKey)) return; e.preventDefault(); zoomTo(V.z*Math.exp(-e.deltaY*0.0025), e.clientX, e.clientY); }, {passive:false});
  body.addEventListener("dblclick",e=>{ if(!pages||!e.target.closest(".mlvpg")) return; zoomTo(V.z>1.01?1:2, e.clientX, e.clientY); });
  /* два пальца — увеличение */
  const T=new Map(); let pinch=null;
  body.addEventListener("pointerdown",e=>{ if(e.pointerType!=="touch") return; T.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(T.size===2){ const [a,b]=[...T.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1, z:V.z}; } });
  body.addEventListener("pointermove",e=>{ if(!T.has(e.pointerId)) return; T.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(pinch&&T.size===2){ const [a,b]=[...T.values()]; zoomTo(pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d, (a.x+b.x)/2, (a.y+b.y)/2); } });
  const up=e=>{ T.delete(e.pointerId); if(T.size<2) pinch=null; }; body.addEventListener("pointerup",up); body.addEventListener("pointercancel",up);
  body.addEventListener("touchmove",e=>{ if(e.touches.length>1) e.preventDefault(); }, {passive:false});
  /* какая страница сейчас на экране */
  body.addEventListener("scroll",()=>{ if(V.items.length<2) return; const R=body.getBoundingClientRect(), mid=R.top+R.height/3; let n=1; V.items.forEach((it,j)=>{ if(it.wrap.getBoundingClientRect().top<=mid) n=j+1; }); const pc=v.querySelector(".mlvpc"); if(pc) pc.textContent=` · стр. ${n} из ${V.items.length}`; }, {passive:true});
  let rz=0; const onRz=()=>{ cancelAnimationFrame(rz); rz=requestAnimationFrame(lay); }; addEventListener("resize", onRz); v.addEventListener("close",()=>removeEventListener("resize", onRz));
  v.showModal(); body.focus(); requestAnimationFrame(()=>v.classList.add("in"));
  const addPage=(el, w, h)=>{ const wrap=document.createElement("div"); wrap.className="mlvpg"; el.classList.add("mlvel"); wrap.appendChild(el); body.querySelector(".mlvpdf").appendChild(wrap); const it={wrap, el, w, h}; V.items.push(it); lay(); return it; };
  try{ let f;
    if(kind==="office"){ let j; try{ j=await apiFetch(API_URL,{method:"POST", tmo:120000, body:JSON.stringify({key:pass(), user:curUser(), action:"mail", op:"attPdf", id:r.id, i})}); }
        catch(e){ if(/unknown op/.test(e.message)) throw new Error("для просмотра Word и Excel обновите Code.gs — а пока нажмите «Скачать»"); throw e; }
      const bin=atob(j.data), u8=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) u8[k]=bin.charCodeAt(k); f=new File([u8], j.name||"файл.pdf", {type:"application/pdf"}); }
    else f=await mlAttGet(r, i);
    if(!v.isConnected) return;
    if(kind==="img"){ url=URL.createObjectURL(f); const im=new Image(); im.alt=x.n; im.src=url; await im.decode().catch(()=>{}); if(!v.isConnected) return;
      body.innerHTML=`<div class="mlvpdf"></div>`; addPage(im, im.naturalWidth||800, im.naturalHeight||600); return; }
    if(kind==="text"){ const t=await f.text(); body.innerHTML=`<pre class="mlvtxt">${esc(t.slice(0,300000))}</pre>`; lay(); return; }
    if(kind==="sheet"||kind==="csv"){ const X=await loadXLSX(); const wb=X.read(await f.arrayBuffer(),{type:"array"}); const names=wb.SheetNames;
      const draw=k=>{ const h=X.utils.sheet_to_html(wb.Sheets[names[k]],{editable:false}).replace(/<script[\s\S]*?<\/script>/gi,"").replace(/\son\w+=/gi," data-x="); const m=h.match(/<table[\s\S]*<\/table>/i);
        body.innerHTML=(names.length>1?`<div class="pfchips mlvtabs">${names.map((n,j)=>`<button type="button" data-mlvs="${j}" class="${j===k?"on":""}">${esc(n)}</button>`).join("")}</div>`:"")+`<div class="mlvsheet">${m?m[0]:"<p class='muted'>Лист пустой</p>"}</div>`;
        body.querySelectorAll("[data-mlvs]").forEach(b=>b.onclick=()=>draw(+b.dataset.mlvs)); lay(); };
      draw(0); return; }
    /* PDF (в том числе Word/Excel, превращённые в PDF): страницы рисует pdf.js — работает и в приложении на телефоне */
    try{ const P=await adPdfJs(), doc=await P.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise; body.innerHTML=`<div class="mlvpdf"></div>`;
      const pc=v.querySelector(".mlvpc"); pc.textContent=doc.numPages>1?` · стр. 1 из ${doc.numPages}`:"";
      const N=Math.min(doc.numPages,60), dpr=window.devicePixelRatio||1;
      for(let k=1;k<=N;k++){ if(!v.isConnected) return; const pg=await doc.getPage(k), vp0=pg.getViewport({scale:1}), sc=Math.min(2600, Math.max(1400, fitW()*dpr*1.6))/vp0.width, vp=pg.getViewport({scale:sc});
        const c=document.createElement("canvas"); c.width=Math.round(vp.width); c.height=Math.round(vp.height); const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height);
        addPage(c, vp0.width, vp0.height); await pg.render({canvasContext:g, viewport:vp}).promise; }
      if(doc.numPages>N) body.insertAdjacentHTML("beforeend",`<p class="mlvmore">Показаны первые ${N} страниц из ${doc.numPages} — остальные в скачанном файле.</p>`); }
    catch(e){ url=URL.createObjectURL(f); body.innerHTML=`<iframe class="mlvifr" src="${url}" title="${esc(x.n)}"></iframe>`; v.classList.add("ifr"); }
  }catch(e){ if(v.isConnected) body.innerHTML=`<div class="mlvl"><b>Не получилось показать файл.</b> ${esc(e.message||"")}</div>`; } }
/* печать страниц так, как они повёрнуты на экране */
async function mlvPrint(V, name){ if(!V.items.length){ toast("info","Ещё загружается","Подождите секунду."); return; }
  const urls=V.items.map(it=>{ const s=it.el, sw=s.naturalWidth||s.width, sh=s.naturalHeight||s.height, side=V.rot%180!==0, c=document.createElement("canvas");
    c.width=side?sh:sw; c.height=side?sw:sh; const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.translate(c.width/2,c.height/2); g.rotate(V.rot*Math.PI/180); g.drawImage(s,-sw/2,-sh/2,sw,sh);
    try{ return c.toDataURL("image/jpeg",0.92); }catch(e){ return s.src||""; } });
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(name||"Вложение")}</title><style>@page{size:A4;margin:6mm}html,body{margin:0;padding:0;background:#fff}
    .p{height:285mm;display:flex;align-items:center;justify-content:center;break-after:page;page-break-after:always}.p:last-child{break-after:auto;page-break-after:auto}.p img{max-width:100%;max-height:100%;object-fit:contain}</style></head>
    <body>${urls.map(u=>`<div class="p"><img src="${u}"></div>`).join("")}</body></html>`;
  const f=document.createElement("iframe"); f.setAttribute("aria-hidden","true"); f.style.cssText="position:fixed;left:-4000px;top:0;width:900px;height:1200px;border:0;visibility:hidden";
  document.body.appendChild(f); const d=f.contentWindow.document; d.open(); d.write(html); d.close();
  await Promise.all([...d.images].map(im=>im.complete?0:new Promise(ok=>{ im.onload=im.onerror=ok; })));
  f.contentWindow.focus(); f.contentWindow.print(); setTimeout(()=>f.remove(), 60000); }

/* ================= Почта на телефоне (≤ 899 px): как в почтовых приложениях =================
   Шапка с меню папок (☰), поиском и «⋯»; письма по дням; смахнуть вправо — прочитано/не прочитано, влево — в «Неважные»
   (в «Неважных» — во «Входящие», в «Спаме» — «Не спам»); долгое нажатие или кружок — выбор нескольких писем;
   письмо и новое письмо — страница поверх списка (кнопка «Назад» телефона и смахивание от левого края закрывают её);
   кнопка «Написать» внизу справа. Шаги «Назад» — через history (ML.layer: v — письмо, d — меню папок, p — выбор). */
const mlMob = () => MAILAPP || matchMedia("(max-width:899px)").matches;   /* в приложении «Почта ФД» — всегда как почтовое приложение */
const ML_FN={in:"Входящие", all:"Все письма", ord:"Заявки", undone:"Не обработаны", unread:"Непрочитанные", sent:"Отправленные", minor:"Неважные", spam:"Спам"};
const mlSv = (d, w) => `<svg viewBox="0 0 24 24" width="${w||22}" height="${w||22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const MI={plus:mlSv('<path d="M12 5v14M5 12h14"/>'), menu:mlSv('<path d="M4 7h16M4 12h16M4 17h16"/>'), back:mlSv('<path d="M19 12H5M11 6l-6 6 6 6"/>'), search:mlSv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  more:mlSv('<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>'), x:mlSv('<path d="M6 6l12 12M18 6L6 18"/>'),
  check:mlSv('<path d="M5 12.5l4.5 4.5L19 7.5"/>',20), send:mlSv('<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>'),
  all:mlSv('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'), inbox:mlSv('<path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20"/>',20),
  stack:mlSv('<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',20), doc:mlSv('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',20),
  sent:mlSv('<path d="M4 12l16-8-6 16-2.5-6.5z"/>',20), unread:mlSv('<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/>',20),
  ref:mlSv('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',20), gear:mlSv('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',20),
  pick:mlSv('<rect x="4" y="4" width="7" height="7" rx="1.5"/><path d="M14 6h6M14 9h4M4 15h16M4 19h11"/>',20)};
const mlHue = s => { let h=7; s=String(s||""); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))%360; return h; };
function mlAvTxt(r){ const s=String(r.dir==="sent"?(r.to||""):(r.fromName||r.from||"?")).replace(/<[^>]*>/g,"").replace(/["'«»]/g,"").trim();
  const w=s.split(/[\s@._,-]+/).filter(x=>/[\p{L}\d]/u.test(x)); const a=((w[0]||"?").match(/[\p{L}\d]/u)||["?"])[0], b=s.includes("@")||!w[1]?"":((w[1].match(/[\p{L}\d]/u)||[""])[0]);
  return (a+b).toUpperCase(); }
const mlWhere = r => r.dir==="sent" ? `<i class="mlwh s">Отправлено</i>` : mlSpam(r) ? `<i class="mlwh sp">Спам</i>` : mlMinor(r) ? `<i class="mlwh mi">Неважное</i>` : "";
function mlDayTxt(iso){ const d=new Date(iso); if(isNaN(d)) return "Без даты"; const x=jIso(d), t=todayISO(), y=new Date(); y.setDate(y.getDate()-1);
  if(x===t) return "Сегодня"; if(x===jIso(y)) return "Вчера"; return d.toLocaleDateString("ru-RU", x.slice(0,4)===t.slice(0,4)?{day:"numeric",month:"long",weekday:"long"}:{day:"numeric",month:"long",year:"numeric"}); }
/* в какую сторону что делает смахивание */
const mlSwR = r => mlRO()||r.dir==="sent" ? "" : (r.read ? "unread" : "read");
const mlSwL = r => mlRO()||r.dir==="sent" ? "" : (ML.f==="spam"||mlSpam(r)) ? "nospam" : (ML.f==="minor"||mlMinor(r)) ? "major" : "minor";
const ML_SWT={read:"Прочитано", unread:"Не прочитано", minor:"В неважные", major:"Во входящие", nospam:"Не спам"};
function mlRowMob(r,i){ const A=mlAtts(r), un=mlUnread(r), o=r.dir!=="sent"&&mlIsOrd(r), st=mlOrdSt(r), tg=r.dir!=="sent"?mlTag(mlAddr(r)):null, pk=!!(ML.pick&&ML.pick.has(r.id)), dn=mlDone(r), td=mlTodo(r);
  const who=r.dir==="sent"?"Кому: "+(r.to||""):(r.fromName||r.from||"без имени"), sr=mlSwR(r), sl=mlSwL(r);
  const chips=[ML.f==="all"?mlWhere(r):"", o?`<span class="mlord${st&&st.st==="taken"?" done":""}">${st&&st.st==="taken"?"Документы сделаны":"Заявка"}</span>`:"",
    dn?`<span class="mldbadge">${ML_IC_OK}Обработано</span>`:td?`<span class="mltbadge">${ML_IC_TODO}Не обработано</span>`:"", tg&&tg.kind==="cus"?`<span class="mltag cus">Заказчик${cus(tg.customerId)?" · "+esc(cusNm(tg.customerId)):""}</span>`:""].filter(Boolean).join("");
  return `<div class="mlr mr${un?" un":""}${ML.sel===r.id?" sel":""}${pk?" picked":""}${dn?" isdone":""}${td?" istodo":""}" data-mlid="${esc(r.id)}" data-swr="${sr}" data-swl="${sl}" role="listitem" tabindex="0" style="--c:${mlCol(r.acc)};--h:${mlHue(r.dir==="sent"?r.to:mlAddr(r))};--d:${Math.min(i,12)*14}ms">
    ${sr?`<span class="mrbg l">${sr==="read"?ML_IC.mail1:ML_IC.mail0}<b>${ML_SWT[sr]}</b></span>`:""}${sl?`<span class="mrbg r"><b>${ML_SWT[sl]}</b>${sl==="nospam"?ML_IC_OK:ML_IC.minor}</span>`:""}
    <span class="mrin"><button type="button" class="mrav" data-mm="pick" aria-label="${pk?"Снять выбор":"Выбрать письмо"}"><span class="mravt">${esc(mlAvTxt(r))}</span><span class="mravc">${MI.check}</span></button>
      <span class="mrtx"><span class="mr1">${un?'<i class="mrdot" aria-label="не прочитано"></i>':""}<b>${esc(who)}</b>${ML.acc.length>1&&!ML.box?`<i class="mrbx" title="${esc(r.box||"")}"></i>`:""}<time>${mlDate(r.date)}</time></span>
        <span class="mr2">${r.ans?`<i class="mlans" title="Вы ответили">${ML_IC.reply}</i>`:""}<span>${esc(r.subject||"(без темы)")}</span></span>
        <span class="mr3"><span>${esc(String(r.snippet||"").replace(/\s+/g," ").slice(0,160))}</span>${A.length?`<i class="mrclip" title="${esc(A.map(x=>x.n).join(", "))}">${ML_IC.clip}</i>`:""}</span>
        ${chips?`<span class="mr4">${chips}</span>`:""}</span></span></div>`; }
/* счётчики папок */
function mlCnt(){ const bx=r=>!ML.box||r.acc===ML.box, R=ML.rows.filter(bx);
  const o={in:R.filter(mlUnIn).length, ord:0, undone:R.filter(r=>r.dir!=="sent"&&!mlSpam(r)&&!mlMinor(r)&&!!mlTodo(r)).length,
    unread:R.filter(mlUnread).length, minor:R.filter(r=>mlMinor(r)&&!r.read).length, spam:R.filter(mlSpam).length, all:0, sent:0};
  mlFlds().forEach(f=>{ o["u:"+f.id]=R.filter(r=>mlFld(r)===f.id && mlUnread(r)).length; }); return o; }
function mlAbHtml(){
  if(ML.pmode){ const n=ML.pick.size, P=[...ML.pick].map(id=>ML.rows.find(r=>r.id===id)).filter(Boolean), anyUn=P.some(r=>r.dir!=="sent"&&!r.read), inb=P.some(r=>r.dir!=="sent"), dis=n&&inb?"":" disabled";
    const b=(a,t,ic)=>`<button type="button" class="mlib" data-mm="pact" data-a="${a}" title="${t}" aria-label="${t}"${dis}>${ic}</button>`;
    return `<button type="button" class="mlib" data-mm="pickx" aria-label="Закончить выбор">${MI.x}</button><b class="mlabn" aria-label="Выбрано писем: ${n}">${n||"Выберите"}</b><span class="grow"></span>
      <button type="button" class="mlib" data-mm="pall" title="Выбрать все" aria-label="Выбрать все">${MI.all}</button>${b(anyUn?"read":"unread", anyUn?"Отметить прочитанными":"Отметить непрочитанными", anyUn?ML_IC.mail1:ML_IC.mail0)}${b("done","Обработано",ML_IC_OK)}${b("fld","В папку",ML_IC_FLD)}${ML.f==="spam"?b("nospam","Не спам",ML_IC_OK):b(ML.f==="minor"?"major":"minor", ML.f==="minor"?"Во входящие":"В неважные", ML_IC.minor)+b("spam","В спам",ML_IC.spam)}`; }
  if(ML.srch) return `<button type="button" class="mlib" data-mm="srchx" aria-label="Закрыть поиск">${MI.back}</button><input type="search" id="ml-q" placeholder="Поиск в почте" value="${esc(ML.q)}" autocomplete="off" enterkeyhint="search">${ML.q?`<button type="button" class="mlib" data-mm="qclr" aria-label="Очистить поиск">${MI.x}</button>`:""}`;
  const c=mlCnt(), n=ML.f==="sent"||ML.f==="all"?0:ML.f==="spam"?0:(c[ML.f]||0), bx=ML.box?(mlAccOf(ML.box).email||""):"все ящики";
  return `<button type="button" class="mlib" data-mm="dr" aria-label="Папки и ящики">${MI.menu}</button>
    <button type="button" class="mlabt" data-mm="dr"><span class="mlabh"><b>${esc(mlFName(ML.f))}</b>${n?`<em>${n}</em>`:""}</span><small><span class="mlabx"${ML.box?` style="--c:${mlCol(ML.box)}"`:""}>${esc(bx)}</span> · <span id="ml-sync">${mlSyncTxt()}</span></small></button>
    <button type="button" class="mlib" data-mm="srch" aria-label="Поиск">${MI.search}</button><button type="button" class="mlib" data-mm="more" aria-label="Ещё">${MI.more}</button>`; }
function mlAbSync(){ if(ML.srch) return; const ab=$("#ml-ab"); if(ab) ab.innerHTML=mlAbHtml(); }
function mlEmptyTxt(){ return ML.q?"Ничего не найдено":ML.f==="ord"?"Заявок нет":ML.f==="sent"?"Отправленных пока нет":ML.f==="spam"?"В спаме пусто":ML.f==="minor"?"Неважных писем нет":ML.f==="undone"?"Писем с пометкой «Не обработано» нет":ML.f==="unread"?"Всё прочитано":"Писем нет"; }
function mlMobDraw(el, L){ el.classList.add("mob");
  const lim=60+ML.more; let html="", day="";
  L.slice(0,lim).forEach((r,i)=>{ const d=jIso(new Date(r.date)); if(d!==day){ if(day) html+=`</div>`; day=d; html+=`<div class="mlday">${esc(mlDayTxt(r.date))}</div><div class="mlgrp">`; } html+=mlRowMob(r,i); }); if(day) html+=`</div>`;
  const key=ML.f+"|"+ML.box+"|"+ML.q+"|m", calm=ML.calmKey===key || ML.calmKey===ML.f+"|"+ML.box+"|m";
  if(ML.f.startsWith("u:") && !mlFldOf(ML.f.slice(2))) ML.f="in";
  el.innerHTML=`<div class="mlm${ML.pmode?" selm":""}${ML.srch?" srch":""}"><div class="mlab" id="ml-ab">${mlAbHtml()}</div>${mlErrHtml()}
    <div class="mll mlml${calm?" calm":""}" id="ml-list" role="list">${mlFolderNote()}${html||`<div class="mlempty sm"><b>${mlEmptyTxt()}</b><span>${ML.loaded?"":"Загружаю…"}</span></div>`}${L.length>lim?`<div class="mlsent" id="ml-sent"><i class="spin"></i> Загружаю ещё…</div>`:""}</div></div>`;
  ML.calmKey=ML.f+"|"+ML.box+"|m";
  const o=mlOv(); o.hidden=false; const mb=document.getElementById("mbar"), mbh=mb&&!mb.hidden&&getComputedStyle(mb).display!=="none"?Math.round(mb.getBoundingClientRect().height):0; o.style.setProperty("--mbh", mbh+"px"); el.style.setProperty("--mbh", mbh+"px"); document.documentElement.classList.add("mlmob"); document.documentElement.style.setProperty("--mlmbh", mbh+"px"); const fab=o.querySelector(".mlfab"); if(fab) fab.hidden=mlRO();
  mlPgFill(); mlObs(); mlBadge(); mlSyncUi(); }
/* слой поверх страницы: письмо, меню папок, кнопка «Написать» (прямо в #fd-app — position:fixed не зависит от карточек) */
function mlOv(){ let o=document.getElementById("ml-ov"); if(o) return o;
  o=document.createElement("div"); o.id="ml-ov";
  o.innerHTML=`<div class="mlv mlpage" id="ml-view" aria-hidden="true" inert></div>
    <div class="mldr" id="ml-dr" aria-hidden="true"><div class="mldrs" data-mm="drx"></div><nav class="mldrp" id="ml-drp" aria-label="Папки и ящики"></nav></div>
    <button type="button" class="mlfab" data-ml="new" aria-label="Написать письмо">${ML_IC.pen}<span>Написать</span></button>`;
  (document.getElementById("fd-app")||document.body).appendChild(o); mlPgSwipe(o); return o; }
function mlOvOff(){ document.documentElement.classList.remove("mlmob"); const o=document.getElementById("ml-ov"); if(!o) return; if(ML.layer){ const l=ML.layer; ML.layer=""; if(ML.hp){ ML.hp=false; ML.ign=(ML.ign||0)+1; try{ history.back(); }catch(e){ ML.ign--; } } if(l==="p"){ ML.pmode=false; ML.pick&&ML.pick.clear(); } ML.dr=false; } o.remove(); }
function mlTabOff(){ document.documentElement.classList.remove("mlmob"); const o=document.getElementById("ml-ov"); if(o) o.hidden=true; mlMenuClose(); if(ML.layer){ const l=ML.layer; ML.layer=""; ML.hp=false; mlLayClose(l); } }
/* шаги «Назад»: одна запись в history на открытый слой */
function mlLayer(l){ ML.layer=l; if(!ML.hp){ try{ history.pushState({fdml:1}, ""); ML.hp=true; }catch(e){} } }
function mlLayerOff(){ const l=ML.layer; ML.layer=""; if(ML.hp){ ML.hp=false; ML.ign=(ML.ign||0)+1; try{ history.back(); }catch(e){ ML.ign--; } } mlLayClose(l); }
function mlLayClose(l){ if(l==="v"){ ML.sel=""; ML.comp=null; ML.tagEd=""; ML.force=""; mlListMark(); }
  else if(l==="d") mlDrOpen(false); else if(l==="p"){ ML.pmode=false; if(ML.pick) ML.pick.clear(); mlPickSync(); } }
window.addEventListener("popstate", ()=>{ if(ML.ign){ ML.ign--; return; } if(!ML.hp) return; ML.hp=false; const l=ML.layer; ML.layer=""; mlLayClose(l); });
/* страница письма: открыть/закрыть, прокрутка с начала у нового письма */
function mlPgSync(){ const v=document.getElementById("ml-view"); if(!v || !v.classList.contains("mlpage")) return; const open=!!(ML.sel||ML.comp), k=ML.comp?"c:"+(ML.comp.reply||ML.comp.kind):ML.sel;
  if(open && v.dataset.k!==k){ v.scrollTop=0; v.dataset.k=k; }
  v.classList.toggle("open", open); v.setAttribute("aria-hidden", open?"false":"true"); if(open) v.removeAttribute("inert"); else v.setAttribute("inert","");
  document.documentElement.classList.toggle("mlpgon", open);
  if(!open && ML.layer==="v"){ ML.layer=""; if(ML.hp){ ML.hp=false; ML.ign=(ML.ign||0)+1; try{ history.back(); }catch(e){ ML.ign--; } } } }
function mlPgFill(){ const v=document.getElementById("ml-view"); if(!v || !v.classList.contains("mlpage")) return; const k=ML.comp?"c:"+(ML.comp.reply||ML.comp.kind):ML.sel;
  if(ML.sel||ML.comp){ const y=v.dataset.k===k?v.scrollTop:0; v.innerHTML=mlViewHtml(); v.scrollTop=y; mlCompFocus(); } mlPgSync(); }
function mlPgHtml(){ const ro=mlRO();
  if(ML.comp){ const C=ML.comp; return `<div class="mlpb"><button type="button" class="mlib" data-ml="cclose" aria-label="Закрыть">${MI.x}</button><b class="mlpt">${C.kind==="new"?"Новое письмо":C.kind==="fwd"?"Переслать":"Ответ"}</b><span class="grow"></span>
      <button type="button" class="mlib mlsend" data-ml="send" aria-label="Отправить" title="Отправить"${C.busy?" disabled":""}>${C.busy?`<i class="spin"></i>`:MI.send}</button></div><div class="mlpc">${mlViewBody()}</div>`; }
  const r=ML.rows.find(x=>x.id===ML.sel); if(!r) return `<div class="mlpb"><button type="button" class="mlib" data-ml="back" aria-label="Назад к письмам">${MI.back}</button></div>`;
  const inb=r.dir!=="sent", sp=mlSpam(r), mi=mlMinor(r), many=r.cc||String(r.to||"").includes(",");
  const ib=(a,t,ic)=>`<button type="button" class="mlib" data-mm="one" data-a="${a}" title="${t}" aria-label="${t}">${ic}</button>`;
  return `<div class="mlpb"><button type="button" class="mlib" data-ml="back" aria-label="Назад к письмам">${MI.back}</button><span class="grow"></span>
      ${!ro&&inb?ib(r.read?"unread":"read", r.read?"Отметить непрочитанным":"Отметить прочитанным", r.read?ML_IC.mail0:ML_IC.mail1)+(sp?ib("nospam","Не спам",ML_IC_OK):ib(mi?"major":"minor", mi?"Во входящие":"В неважные", ML_IC.minor)+ib("spam","В спам",ML_IC.spam))+`<button type="button" class="mlib" data-mm="vfld" title="В папку" aria-label="В папку">${ML_IC_FLD}</button>`:""}
      <button type="button" class="mlib" data-mm="vmenu" aria-label="Ещё действия">${MI.more}</button></div>
    <div class="mlpc">${mlViewBody()}</div>
    ${ro?"":`<div class="mlpf">${inb?`<button type="button" class="btn pri" data-ml="reply">${ML_IC.reply} Ответить</button>${many?`<button type="button" class="btn" data-ml="replyall">Всем</button>`:""}`:""}<button type="button" class="btn" data-ml="fwd">Переслать</button></div>`}`; }
/* смахнуть страницу письма от левого края — назад */
function mlPgSwipe(o){ const v=o.querySelector("#ml-view"); let s=null;
  v.addEventListener("touchstart", e=>{ const t=e.touches[0]; s=(t.clientX<26 && v.classList.contains("open") && e.touches.length===1)?{x:t.clientX, y:t.clientY, dx:0, go:false}:null; }, {passive:true});
  v.addEventListener("touchmove", e=>{ if(!s) return; const t=e.touches[0], dx=t.clientX-s.x, dy=t.clientY-s.y; if(!s.go){ if(Math.abs(dy)>12 && Math.abs(dy)>Math.abs(dx)){ s=null; return; } if(dx>10){ s.go=true; v.style.transition="none"; } else return; }
    s.dx=Math.max(0,dx); v.style.transform=`translateX(${s.dx}px)`; }, {passive:true});
  const end=()=>{ if(!s) return; const go=s.go && s.dx>innerWidth*0.3; v.style.transition=""; if(go){ v.style.transform=""; mlLayerOff(); } else v.style.transform=""; s=null; };
  v.addEventListener("touchend", end); v.addEventListener("touchcancel", end); }
/* меню папок и ящиков */
function mlDrHtml(){ const c=mlCnt(), ro=mlRO(), adm=me().admin;
  const F=[["in",MI.inbox],["all",MI.stack],["ord",MI.doc],["undone",ML_IC_TODO],["unread",MI.unread],["sent",MI.sent],["minor",ML_IC.minor],["spam",ML_IC.spam]];
  const it=(k,ic)=>`<button type="button" class="mldi${ML.f===k?" on":""}" data-mm="f" data-f="${k}">${ic}<span>${ML_FN[k]}</span>${c[k]?`<em>${c[k]}</em>`:""}</button>`;
  return `<div class="mldrh"><b>Почта</b><small>${esc(mlSyncTxt().replace(/<[^>]+>/g,""))||"&nbsp;"}</small></div>
    ${ro?"":`<button type="button" class="btn pri mldrnew" data-mm="dnew">${ML_IC.pen} Написать</button>`}
    <div class="mldrg">${F.map(x=>it(x[0],x[1])).join("")}</div>
    ${mlFlds().length||!ro?`<div class="mldrt">Мои папки</div><div class="mldrg">${mlFlds().map(f=>`<button type="button" class="mldi${ML.f==="u:"+f.id?" on":""}" data-mm="f" data-f="u:${esc(f.id)}">${ML_IC_FLD}<span>${esc(f.name)}</span>${c["u:"+f.id]?`<em>${c["u:"+f.id]}</em>`:""}</button>`).join("")}${ro?"":`<button type="button" class="mldi mldinew" data-mm="fnew">${MI.plus}<span>Новая папка</span></button>`}</div>`:""}
    ${ML.acc.length>1?`<div class="mldrt">Ящики</div><div class="mldrg"><button type="button" class="mldi${ML.box?"":" on"}" data-mm="box" data-box="">${MI.stack}<span>Все ящики</span></button>${ML.acc.map(a=>{ const n=ML.rows.filter(r=>r.acc===a.id&&mlUnread(r)).length; return `<button type="button" class="mldi${ML.box===a.id?" on":""}" data-mm="box" data-box="${esc(a.id)}" style="--c:${mlCol(a.id)}"><i class="mldot"></i><span>${esc(a.email)}${a.err?` <b class="mlwarn" title="${esc(mlErrTxt(a.err))}">!</b>`:""}</span>${n?`<em>${n}</em>`:""}</button>`; }).join("")}</div>`:""}
    <div class="mldrt"></div><div class="mldrg"><button type="button" class="mldi" data-mm="dsync">${MI.ref}<span class="mlsyt">${ML.sync?"Проверяю…":"Проверить почту"}</span></button>${ro?"":`<button type="button" class="mldi" data-mm="dread">${MI.all}<span>Прочитать все</span></button>`}${adm?`<button type="button" class="mldi" data-mm="dset">${MI.gear}<span>Ящики и посредник</span></button>`:""}</div>${MAILAPP?mlAppDrHtml():""}`; }
/* приложение «Почта ФД»: уведомления и выход — в меню слева (шапки сайта в приложении нет) */
const ML_IC_BELL='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>';
const ML_IC_OUT='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>';
function mlAppDrHtml(){ const A=window.FrudomApp, n=A&&typeof A.openNotify==="function";
  return `<div class="mldrg mldrapp">${n?`<button type="button" class="mldi" data-mm="anotify">${ML_IC_BELL}<span>Уведомления</span></button>`:""}<button type="button" class="mldi" data-mm="alogout">${ML_IC_OUT}<span>Выйти из «${esc(curUser()||"")}»</span></button></div>`; }
function mlDrOpen(on){ const d=document.getElementById("ml-dr"); if(!d) return; if(on){ document.getElementById("ml-drp").innerHTML=mlDrHtml(); mlLayer("d"); }
  ML.dr=on; d.classList.toggle("open", on); d.setAttribute("aria-hidden", on?"false":"true"); }
(function(){ let s=null; document.addEventListener("touchstart", e=>{ const p=e.target.closest&&e.target.closest("#ml-drp"); s=p&&ML.dr?{x:e.touches[0].clientX, y:e.touches[0].clientY, dx:0}:null; }, {passive:true});
  document.addEventListener("touchmove", e=>{ if(!s) return; const dx=e.touches[0].clientX-s.x, dy=e.touches[0].clientY-s.y; if(!s.go){ if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){ s=null; return; } if(dx<-10) s.go=true; else return; }
    s.dx=Math.min(0,dx); const p=document.getElementById("ml-drp"); if(p){ p.style.transition="none"; p.style.transform=`translateX(${s.dx}px)`; } }, {passive:true});
  document.addEventListener("touchend", ()=>{ if(!s) return; const p=document.getElementById("ml-drp"); if(p){ p.style.transition=""; p.style.transform=""; } if(s.go && s.dx<-70) mlLayerOff(); s=null; }); })();
/* «⋯» в шапке */
function mlMobMenu(btn){ mlMenuClose(); const ro=mlRO(), adm=me().admin, n=ro?0:mlRaList().length, b=btn.getBoundingClientRect();
  const m=document.createElement("div"); m.id="ml-menu"; m.className="mlmenu"; m.setAttribute("role","menu");
  m.innerHTML=[`<button type="button" role="menuitem" data-mm="mm" data-a="sync"><i>${MI.ref}</i>Проверить почту</button>`,
    ro?"":`<button type="button" role="menuitem" data-mm="mm" data-a="readall"${n?"":" disabled"}><i>${MI.all}</i>Прочитать все${n?` <small>${n}</small>`:""}</button>`,
    ro?"":`<button type="button" role="menuitem" data-mm="mm" data-a="pick"><i>${MI.pick}</i>Выбрать письма</button>`,
    adm?`<hr><button type="button" role="menuitem" data-mm="mm" data-a="set"><i>${MI.gear}</i>Ящики и посредник</button>`:""].join("");
  (document.getElementById("ml-ov")||document.getElementById("fd-app")).appendChild(m);
  m.style.left=Math.max(8, Math.min(b.right-m.offsetWidth, innerWidth-m.offsetWidth-8))+"px"; m.style.top=(b.bottom+4)+"px"; requestAnimationFrame(()=>m.classList.add("in")); }
function mlSetOpen(){ ML.set=true; ML.edit=ML.acc.length?null:{pre:"mailru", ih:ML_PRE.mailru.ih, sh:ML_PRE.mailru.sh, ip:993, sp:465, email:"frudom.ru@mail.ru"}; mlDraw(); if(ML.proxy!==false) mlPxCheck(); }
/* выбор нескольких писем */
function mlPickTog(id, on){ if(mlRO()) return; ML.pick=ML.pick||new Set(); if(!ML.pmode){ ML.pmode=true; mlLayer("p"); }
  const had=ML.pick.has(id); if(on===undefined) on=!had; if(on) ML.pick.add(id); else ML.pick.delete(id);
  if(!ML.pick.size && had){ mlLayerOff(); return; } mlPickSync(); }
function mlPickSync(){ const m=$("#ml .mlm"); if(!m) return; m.classList.toggle("selm", !!ML.pmode); const P=ML.pick||new Set();
  document.querySelectorAll("#ml-list .mlr").forEach(b=>{ const on=P.has(b.dataset.mlid); b.classList.toggle("picked", on); const a=b.querySelector(".mrav"); if(a) a.setAttribute("aria-label", on?"Снять выбор":"Выбрать письмо"); });
  const ab=$("#ml-ab"); if(ab && !ML.srch) ab.innerHTML=mlAbHtml(); const f=document.querySelector("#ml-ov .mlfab"); if(f) f.classList.toggle("off", !!ML.pmode); }
/* массовые отметки (с отменой) */
function mlSetMany(L){ const run=async()=>{ for(let i=0;i<L.length;i+=200) await mlSet(L.slice(i,i+200)); }; return run(); }
const mlRaList = () => mlList().filter(r=>r.dir!=="sent" && !r.read);
function mlBulk(L, act){ const S=L.map(r=>({id:r.id, read:r.read||"", order:r.order||""})), tags=[], untag=[], out=[], now={by:curUser(), at:new Date().toISOString()};
  L.forEach(r=>{ if(act!=="read"&&act!=="unread"&&r.dir==="sent") return; if((act==="read"||act==="unread")&&r.dir==="sent") return;
    const o=Object.assign({}, mlOrdSt(r)||{}); let rd=null, ord=true;
    if(act==="read"){ r.read="1"; rd=1; ord=false; } else if(act==="unread"){ r.read=""; rd=0; ord=false; }
    else if(act==="done"){ o.done=now; delete o.todo; r.read="1"; rd=1; }
    else if(act.startsWith("fld:")){ const f=act.slice(4); if(f) o.fld=f; else delete o.fld; delete o.minor; }
    else if(act==="minor"){ o.minor=1; r.read="1"; rd=1; } else if(act==="major"){ delete o.minor; }
    else if(act==="spam"){ o.spam=1; delete o.minor; r.read="1"; rd=1; const em=mlAddr(r); if(em && (mlTag(em)||{}).kind!=="spam" && !tags.includes(em)) tags.push(em); }
    else if(act==="nospam"){ o.spam=0; const em=mlAddr(r); if(em && (mlTag(em)||{}).kind==="spam" && !untag.includes(em)) untag.push(em); }
    if(ord){ Object.keys(o).forEach(k=>{ if(o[k]==null) delete o[k]; }); r.order=Object.keys(o).length?JSON.stringify(o):""; }
    const x={id:r.id}; if(rd!=null) x.read=rd; if(ord) x.order=r.order; out.push(x); });
  if(out.length) mlSetMany(out); tags.forEach(em=>mlTagSet(em,"spam","",true)); untag.forEach(em=>mlTagSet(em,"","",true));
  return {S, tags, untag, n:out.length}; }
function mlRestore(R){ R.S.forEach(x=>{ const r=ML.rows.find(y=>y.id===x.id); if(r){ r.read=x.read; r.order=x.order; } }); mlSetMany(R.S.map(x=>({id:x.id, read:x.read?1:0, order:x.order})));
  R.tags.forEach(em=>mlTagSet(em,"","",true)); R.untag.forEach(em=>mlTagSet(em,"spam","",true)); mlDraw(); mlBadge(); }
const ML_BT={read:"Отмечено прочитанным", unread:"Отмечено непрочитанным", done:"Обработано", minor:"В «Неважных»", major:"Снова во «Входящих»", spam:"В спаме", nospam:"Не спам — снова во «Входящих»"};
function mlBulkUi(L, a){ if(mlRO() || !L.length) return; const R=mlBulk(L, a); if(!R.n){ toast("info","Нечего отмечать",""); return; }
  const w=R.n>1?": "+R.n+" "+plural(R.n,["письмо","письма","писем"]):"", r=L[0];
  if(ML.sel && /^(minor|spam|major|nospam|fld:)/.test(a) && ML.f!=="all" && !mlList().some(x=>x.id===ML.sel) && ML.layer==="v") mlLayerOff();
  mlDraw(); mlBadge();
  const fl=a.startsWith("fld:")?a.slice(4):null;
  toast(a==="spam"?"info":"ok", (fl!=null?(fl?"В папке «"+((mlFldOf(fl)||{}).name||"")+"»":"Снова во «Входящих»"):ML_BT[a])+w, a==="spam"?(R.tags.length?"Следующие письма от "+(R.tags.length>1?"этих отправителей":R.tags[0])+" тоже сразу попадут в спам.":""):a==="minor"&&R.n===1?"Только это письмо — следующие от "+(mlAddr(r)||"отправителя")+" придут как обычно.":"",
    {action:{label:"Отменить", fn:()=>mlRestore(R)}}); }
async function mlReadAll(){ if(mlRO()) return; const L=mlRaList(); if(!L.length){ toast("info","Здесь всё прочитано",""); return; }
  const R=mlBulk(L,"read"); mlDraw(); mlBadge();
  toast("ok","Прочитано: "+R.n+" "+plural(R.n,["письмо","письма","писем"]), ML_FN[ML.f]+(ML.box?" · "+(mlAccOf(ML.box).email||""):""), {action:{label:"Отменить", fn:()=>mlRestore(R)}}); }
/* подгрузка следующих писем при прокрутке вниз */
function mlObs(){ if(ML.io){ ML.io.disconnect(); ML.io=null; } const s=document.getElementById("ml-sent"); if(!s || !("IntersectionObserver" in window)) return;
  ML.io=new IntersectionObserver(es=>{ if(es.some(x=>x.isIntersecting)){ ML.io.disconnect(); ML.io=null; ML.more+=60; mlDraw(); } }, {rootMargin:"700px 0px"}); ML.io.observe(s); }
/* нажатия на телефоне */
function mlMobAct(k, el, e){ const row=el.closest("[data-mlid]"), rr=row?ML.rows.find(x=>x.id===row.dataset.mlid):null, cur=ML.rows.find(x=>x.id===ML.sel);
  if(k==="mm"){ mlMenuClose(); const a=el.dataset.a; if(a==="sync") mlLoad(true); else if(a==="readall") mlReadAll(); else if(a==="pick"){ ML.pick=ML.pick||new Set(); ML.pmode=true; mlLayer("p"); mlPickSync(); } else if(a==="set") mlSetOpen(); return; }
  if(k==="dr"){ mlDrOpen(true); return; }
  if(k==="drx"){ mlLayerOff(); return; }
  if(k==="f"||k==="box"){ if(k==="f") ML.f=el.dataset.f; else ML.box=el.dataset.box; ML.more=0; ML.q=""; ML.srch=false; mlLayerOff(); mlDraw(); window.scrollTo({top:0}); return; }
  if(k==="fnew"){ mlLayerOff(); mlFldNew(); return; }
  if(k==="vfld"){ if(cur){ const b=el.getBoundingClientRect(); mlFldMenu([cur], b.right-240, b.bottom+4); } return; }
  if(k==="dnew"){ mlLayerOff(); ML.sel=""; mlCompose("new"); return; }
  if(k==="dsync"){ mlLayerOff(); mlLoad(true); return; }
  if(k==="dread"){ mlLayerOff(); mlReadAll(); return; }
  if(k==="dset"){ mlLayerOff(); mlSetOpen(); return; }
  if(k==="anotify"){ mlLayerOff(); try{ window.FrudomApp.openNotify(); }catch(e){} return; }
  if(k==="alogout"){ if(!el.classList.contains("armed")){ el.classList.add("armed"); el.querySelector("span").textContent="Точно выйти? Нажмите ещё раз"; setTimeout(()=>{ if(el.isConnected){ el.classList.remove("armed"); el.querySelector("span").textContent="Выйти из «"+(curUser()||"")+"»"; } }, 4000); return; }
    mlLayerOff(); logout(); return; }
  if(k==="srch"){ ML.srch=true; mlDraw(); const q=$("#ml-q"); if(q) q.focus(); return; }
  if(k==="srchx"){ ML.srch=false; ML.q=""; mlDraw(); return; }
  if(k==="qclr"){ ML.q=""; mlDraw(); const q=$("#ml-q"); if(q) q.focus(); return; }
  if(k==="more"){ mlMobMenu(el); return; }
  if(k==="pick"){ if(!rr) return; if(mlRO()){ mlOpen(rr.id); return; } mlPickTog(rr.id); return; }
  if(k==="pickx"){ mlLayerOff(); return; }
  if(k==="pall"){ ML.pick=ML.pick||new Set(); const L=mlList(), all=L.every(r=>ML.pick.has(r.id)); if(all) ML.pick.clear(); else L.forEach(r=>ML.pick.add(r.id)); if(all){ mlLayerOff(); return; } mlPickSync(); return; }
  if(k==="pact"){ const P=[...(ML.pick||[])].map(id=>ML.rows.find(r=>r.id===id)).filter(Boolean), a=el.dataset.a;
    if(a==="fld"){ const b=el.getBoundingClientRect(); mlFldMenu(P, b.right-240, b.bottom+4, ()=>mlLayerOff()); return; } mlLayerOff(); mlBulkUi(P, a); return; }
  if(k==="one"){ if(cur) mlBulkUi([cur], el.dataset.a); return; }
  if(k==="vmenu"){ if(!cur) return; const b=el.getBoundingClientRect(); mlMenu(cur, b.right-250, b.bottom+4); return; } }
/* смахивание строки и долгое нажатие */
const MG={};
function mgReset(){ clearTimeout(MG.lp); if(MG.row && MG.lock){ const i=MG.row.querySelector(".mrin"); if(i){ i.style.transition="transform .22s ease"; i.style.transform=""; } MG.row.classList.remove("swl","swr","arm"); } Object.keys(MG).forEach(k=>delete MG[k]); }
document.addEventListener("pointerdown", e=>{ if(e.pointerType==="mouse" || !mlMob()) return; const row=e.target.closest&&e.target.closest("#ml-list .mlr.mr"); if(!row) return; mgReset();
  Object.assign(MG, {row, x:e.clientX, y:e.clientY, dx:0, pid:e.pointerId, lp:setTimeout(()=>{ if(!MG.row || MG.lock || mlRO()) return; MG.long=true; try{ navigator.vibrate&&navigator.vibrate(12); }catch(x){} mlPickTog(row.dataset.mlid, true); }, 460)}); }, {passive:true});
document.addEventListener("pointermove", e=>{ if(!MG.row || e.pointerId!==MG.pid || MG.long) return; const dx=e.clientX-MG.x, dy=e.clientY-MG.y, row=MG.row;
  if(!MG.lock){ if(Math.abs(dx)>8||Math.abs(dy)>8) clearTimeout(MG.lp); if(Math.abs(dy)>10 && Math.abs(dy)>=Math.abs(dx)){ mgReset(); return; }
    if(Math.abs(dx)>12 && Math.abs(dx)>Math.abs(dy)*1.4 && !ML.pmode && (dx>0?row.dataset.swr:row.dataset.swl)){ MG.lock=true; try{ row.setPointerCapture(e.pointerId); }catch(x){} } else return; }
  const side=dx>0?"r":"l"; if(!(side==="r"?row.dataset.swr:row.dataset.swl)){ MG.dx=0; row.querySelector(".mrin").style.transform=""; return; }
  MG.dx=dx; const w=row.offsetWidth, lim=w*0.32, ax=Math.abs(dx), sh=ax<lim?ax:lim+(ax-lim)*0.6;
  const i=row.querySelector(".mrin"); i.style.transition="none"; i.style.transform=`translateX(${dx>0?sh:-sh}px)`;
  row.classList.toggle("swr", dx>0); row.classList.toggle("swl", dx<0); row.classList.toggle("arm", ax>=lim); }, {passive:true});
document.addEventListener("pointerup", e=>{ if(!MG.row || e.pointerId!==MG.pid) return; clearTimeout(MG.lp);
  if(MG.long){ ML.noClick=Date.now(); Object.keys(MG).forEach(k=>delete MG[k]); return; }
  if(!MG.lock){ Object.keys(MG).forEach(k=>delete MG[k]); return; }
  ML.noClick=Date.now(); const row=MG.row, arm=row.classList.contains("arm"), dx=MG.dx; Object.keys(MG).forEach(k=>delete MG[k]);
  const i=row.querySelector(".mrin"), r=ML.rows.find(x=>x.id===row.dataset.mlid);
  if(!arm || !r){ i.style.transition="transform .22s ease"; i.style.transform=""; setTimeout(()=>row.classList.remove("swl","swr"), 220); return; }
  if(dx>0){ const a=row.dataset.swr; i.style.transition="transform .22s ease"; i.style.transform=""; mlBulk([r], a); setTimeout(()=>{ mlRowSync(r); mlBadge(); mlAbSync(); }, 230); return; }
  const a=row.dataset.swl, stays=ML.f==="all";
  if(stays){ i.style.transition="transform .22s ease"; i.style.transform=""; setTimeout(()=>mlBulkUi([r], a), 220); return; }
  i.style.transition="transform .2s ease"; i.style.transform="translateX(-105%)";
  setTimeout(()=>{ row.style.height=row.offsetHeight+"px"; row.style.overflow="hidden"; row.style.transition="height .22s ease, opacity .22s ease"; requestAnimationFrame(()=>{ row.style.height="0px"; row.style.opacity="0"; }); setTimeout(()=>mlBulkUi([r], a), 240); }, 180); });
document.addEventListener("pointercancel", e=>{ if(MG.row && e.pointerId===MG.pid) mgReset(); });
/* кнопка «Написать» уменьшается при прокрутке вниз */
let mlLastY=0; window.addEventListener("scroll", ()=>{ const f=document.querySelector("#ml-ov .mlfab"); if(!f) return; const y=window.scrollY; if(Math.abs(y-mlLastY)<6) return; f.classList.toggle("mini", y>mlLastY && y>120); mlLastY=y; }, {passive:true});
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && ML.layer && mlMob() && !document.getElementById("ml-menu") && !document.querySelector("dialog[open]")){ e.preventDefault(); mlLayerOff(); } });
(function(){ const mq=matchMedia("(max-width:899px)"); const f=()=>{ if(typeof curTab!=="undefined" && curTab==="mail") mlDraw(); }; if(mq.addEventListener) mq.addEventListener("change", f); else if(mq.addListener) mq.addListener(f); })();
/* ---------- свои папки (Code.gs ≥ 33: свойство MAIL_FOLDERS, op:folders; у письма — order.fld) ---------- */
const ML_IC_FLD='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const mlFlds = () => (ML.folders||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
const mlFldOf = id => (ML.folders||[]).find(f=>f.id===id);
function mlFld(r){ const o=mlOrdSt(r), id=o&&o.fld; return id && mlFldOf(id) ? id : ""; }
function mlFName(k){ if(String(k).startsWith("u:")){ const f=mlFldOf(k.slice(2)); return f?f.name:"Почта"; } return ML_FN[k]||"Почта"; }
/* подпись над письмами: в «Заявках» — что их определяет сайт; в своей папке — переименовать/удалить */
function mlFolderNote(){
  if(ML.f==="ord") return `<div class="mlfnote">${ML_IC_FLD}<span>Сюда сайт <b>сам</b> складывает письма, похожие на заявки (по словам, строкам «товар — кг» и вложениям). Могут попасть и не заявки — лучше перепроверяйте.${mlRO()?"":" Если письмо не заявка — откройте его и нажмите «Это не заявка»."}</span></div>`;
  if(!ML.f.startsWith("u:")) return ""; const f=mlFldOf(ML.f.slice(2)); if(!f) return "";
  return `<div class="mlfnote fld">${ML_IC_FLD}<span>Своя папка <b>«${esc(f.name)}»</b>${ML.fldSrv===false?" · сохранена только на этом устройстве (обновите Code.gs)":""}</span>${mlRO()?"":`<span class="mlfbtn"><button type="button" class="btn ghost sm" data-ml="fldren">Переименовать</button><button type="button" class="btn ghost sm" data-ml="flddel">Удалить папку</button></span>`}</div>`; }
async function mlFldSave(L, quiet){ ML.folders=L.map((f,i)=>Object.assign({}, f, {order:i}));
  const local=()=>{ const p=getPrefs(); p.mlFolders=ML.folders; setPrefs(p, true); };
  if(ML.fldSrv===false){ local(); if(!quiet) toast("warn","Папка сохранена только у вас","Чтобы папки видели все — обновите Code.gs."); return true; }
  try{ const j=await api({action:"mail", op:"folders", folders:ML.folders}); if(Array.isArray(j.folders)) ML.folders=j.folders; ML.fldSrv=true; return true; }
  catch(e){ if(/unknown op|unknown action/.test(e.message)){ ML.fldSrv=false; local(); if(!quiet) toast("warn","Папка сохранена только у вас","Чтобы папки видели все — обновите Code.gs."); return true; }
    toast("err","Папка не сохранилась", e.message); return false; } }
/* маленькое окно «Название папки» */
function mlFldAsk(title, val, ok, cb){ const d=document.createElement("dialog"); d.className="mlfdlg";
  d.innerHTML=`<form method="dialog"><b>${esc(title)}</b><input type="text" id="mlf-name" maxlength="40" placeholder="Например: Поставщики, Банк, Документы" value="${esc(val||"")}" autocomplete="off" enterkeyhint="done">
    <small class="mlferr" id="mlf-err"></small><div class="mlfbt"><button type="button" class="btn ghost" data-v="0">Отмена</button><button type="submit" class="btn pri" data-v="1">${esc(ok)}</button></div></form>`;
  (document.getElementById("fd-app")||document.body).appendChild(d);
  const inp=d.querySelector("input"), err=d.querySelector("#mlf-err"), close=()=>{ try{ d.close(); }catch(e){} d.remove(); };
  d.querySelector("form").addEventListener("submit", e=>{ e.preventDefault(); const n=inp.value.replace(/\s+/g," ").trim(); const m=cb(n); if(m){ err.textContent=m; inp.focus(); return; } close(); });
  d.querySelector('[data-v="0"]').addEventListener("click", close); d.addEventListener("cancel", e=>{ e.preventDefault(); close(); });
  d.addEventListener("click", e=>{ if(e.target===d) close(); });
  d.showModal(); inp.focus(); inp.select(); }
function mlFldCheck(n, skip){ if(!n) return "Напишите название"; if(Object.values(ML_FN).some(x=>x.toLowerCase()===n.toLowerCase())) return "Такая папка уже есть";
  if(mlFlds().some(f=>f.id!==skip && f.name.toLowerCase()===n.toLowerCase())) return "Такая папка уже есть"; if(mlFlds().length>=60) return "Папок слишком много (до 60)"; return ""; }
function mlFldNew(then){ if(mlRO()) return; mlFldAsk("Новая папка", "", "Создать", n=>{ const m=mlFldCheck(n); if(m) return m;
    const f={id:"f"+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name:n, color:""};
    mlFldSave(mlFlds().concat(f)).then(ok=>{ if(!ok){ ML.folders=mlFlds().filter(x=>x.id!==f.id); mlDraw(); } });
    if(then) then(f); else { ML.f="u:"+f.id; ML.more=0; ML.sel=""; ML.view=null; mlDraw(); toast("ok","Папка «"+n+"» создана","Переложить письмо: «В папку» у письма"+(mlMob()?"":" или правая кнопка мыши")+"."); }
    return ""; }); }
function mlFldRen(){ const f=mlFldOf(ML.f.slice(2)); if(!f || mlRO()) return; mlFldAsk("Переименовать папку", f.name, "Сохранить", n=>{ const m=n===f.name?"":mlFldCheck(n, f.id); if(m) return m;
    mlFldSave(mlFlds().map(x=>x.id===f.id?Object.assign({}, x, {name:n}):x), true); mlDraw(); return ""; }); }
function mlFldDel(){ const f=mlFldOf(ML.f.slice(2)); if(!f || mlRO()) return; const n=ML.rows.filter(r=>mlFld(r)===f.id).length, before=mlFlds();
  mlFldSave(before.filter(x=>x.id!==f.id), true); ML.f="in"; ML.sel=""; ML.view=null; mlDraw(); mlBadge();
  toast("info","Папка «"+f.name+"» удалена", n?n+" "+plural(n,["письмо","письма","писем"])+" снова во «Входящих».":"", {action:{label:"Отменить", fn:()=>{ mlFldSave(before, true).then(()=>{ ML.f="u:"+f.id; mlDraw(); mlBadge(); }); }}}); }
/* меню «В папку»: свои папки, «Во входящие», «+ Новая папка…» */
function mlFldMenu(L, x, y, before){ mlMenuClose(); if(mlRO() || !L.length) return; const cur=L.length===1?mlFld(L[0]):"";
  const m=document.createElement("div"); m.id="ml-menu"; m.className="mlmenu mlfmenu"; m.setAttribute("role","menu");
  m.innerHTML=`<div class="mlmh">В папку${L.length>1?`<small>${L.length} ${plural(L.length,["письмо","письма","писем"])}</small>`:""}</div>`
    + mlFlds().map(f=>`<button type="button" role="menuitem" data-mlfp="${esc(f.id)}"${cur===f.id?' aria-current="true" class="on"':""}><i>${ML_IC_FLD}</i><span>${esc(f.name)}</span></button>`).join("")
    + (L.some(r=>mlFld(r))?`<button type="button" role="menuitem" data-mlfp=""><i>${MI.inbox}</i><span>Во «Входящие»</span></button>`:"")
    + `<hr><button type="button" role="menuitem" data-mlfp="+"><i>${MI.plus}</i><span>Новая папка…</span></button>`;
  (document.getElementById("ml-ov")&&mlMob()?document.getElementById("ml-ov"):document.querySelector("dialog[open]")||document.getElementById("fd-app")).appendChild(m);
  const W=m.offsetWidth, H=m.offsetHeight; m.style.left=Math.max(8, Math.min(x, innerWidth-W-8))+"px"; m.style.top=Math.max(8, Math.min(y, innerHeight-H-8))+"px";
  requestAnimationFrame(()=>m.classList.add("in")); const f0=m.querySelector("[data-mlfp]"); if(f0) f0.focus();
  m.addEventListener("click", e=>{ const b=e.target.closest("[data-mlfp]"); if(!b) return; e.stopPropagation(); mlMenuClose(); const id=b.dataset.mlfp;
    if(id==="+"){ mlFldNew(f=>{ if(before) before(); mlBulkUi(L, "fld:"+f.id); }); return; }
    if(before) before(); mlBulkUi(L, "fld:"+id); }); }
