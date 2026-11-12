/* ===== Вкладка «Почта» (12.11.2026; Code.gs ≥ 30, действие mail; посредник в Яндекс Облаке — путь /mail/…) =====
   Письма двух ящиков (frudom.ru@mail.ru, info@frudom.ru — любые, подключает Даниил): список, чтение, вложения, ответ с того же ящика.
   Письмо, похожее на заявку (mlOrd), — плашка «Похоже на заявку» и «Сделать документы»: PDF/фото/текст письма — через ИИ (aiRead), Excel/Word — обычным разбором «Заказа из файла». */
const ML={rows:[], acc:[], proxy:null, px:null, loaded:false, busy:false, sync:false, err:"", sel:"", box:"", f:"in", q:"", view:null, comp:null, html:false, imgs:false, set:false, edit:null, more:0, at:0};
const ML_PRE={mailru:{t:"Mail.ru", ih:"imap.mail.ru", sh:"smtp.mail.ru", how:"Mail.ru → значок профиля → «Безопасность» → «Пароли для внешних приложений» → «Добавить» → название «Документы ФД», доступ «Полный доступ к Почте (IMAP, SMTP)» → скопируйте пароль. Обычный пароль от почты сюда не подойдёт."},
  timeweb:{t:"Timeweb", ih:"imap.timeweb.ru", sh:"smtp.timeweb.ru", how:"Timeweb: подходит обычный пароль этого ящика (тот, с которым вы входите на mail.timeweb.com). Если включена двухэтапная проверка — создайте отдельный пароль в панели Timeweb → «Почта»."},
  yandex:{t:"Яндекс", ih:"imap.yandex.ru", sh:"smtp.yandex.ru", how:"Яндекс ID → «Безопасность» → «Пароли приложений» → «Почта» → создайте пароль. В настройках почты включите «Доступ по IMAP»."},
  other:{t:"Другая", ih:"", sh:"", how:"Спросите у почтовой службы адреса серверов IMAP (порт 993) и SMTP (порт 465)."}};
const ML_COL=["#6a2c4e","#1f6f8b","#2f7d4f","#b4532a"];
const ML_IC={clip:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.6 8.6a2 2 0 0 1-2.8-2.8L15.5 7"/></svg>',
  reply:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/></svg>',
  ref:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  pen:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
  ai:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>'};
const mlAccOf = id => ML.acc.find(a=>a.id===id) || {};
const mlCol = id => mlAccOf(id).color || ML_COL[Math.max(0, ML.acc.findIndex(a=>a.id===id)) % ML_COL.length];
const mlUnread = r => r.dir!=="sent" && !r.read;
const mlIsOrd = r => { try{ const o=r.order?JSON.parse(r.order):null; if(o&&o.st==="no") return false; }catch(e){} return r.dir!=="sent" && !!mlOrd(r).ok; };
const mlOrdSt = r => { try{ return r.order?JSON.parse(r.order):null; }catch(e){ return null; } };
const mlDate = iso => { const d=new Date(iso); if(isNaN(d)) return ""; const t=todayISO(), x=jIso(d); return x===t ? d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) : x.slice(0,4)===t.slice(0,4) ? d.toLocaleDateString("ru-RU",{day:"numeric",month:"short"}).replace(".","") : fd(x); };
const mlFull = iso => { const d=new Date(iso); return isNaN(d) ? "" : d.toLocaleString("ru-RU",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
const mlSize = s => s>=1048576 ? (s/1048576).toFixed(1).replace(".",",")+" МБ" : Math.max(1,Math.round(s/1024))+" КБ";
const mlAtts = r => { try{ return JSON.parse(r.atts||"[]")||[]; }catch(e){ return []; } };
/* ---------- заявка ли это: ключевые слова, вложение-таблица/скан, строки «товар N кг», заказчик ---------- */
const ML_KW=/заявк|заказ(?!ч)|поставк|прошу (поставить|привезти|доставить)|потребност|наряд|меню-?раскладк/i, ML_NOT=/акт\b|акт сверки|сч[её]т|счет-фактур|упд|платёжк|платежн|претензи|рассылк|unsubscribe|отписаться/i;
function mlCusOf(r, text){ const p=getPrefs(), mc=p.mlCus||{}, from=String(r.from||"").toLowerCase(), dom=from.split("@")[1]||"";
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
async function mlLoad(force, quiet){ if(!online() || isStaff()) return; if(ML.sync) return;
  ML.sync=true; if(!quiet) mlHead();
  try{ if(!ML.loaded){ const j=await api({action:"mail", op:"list"}); mlTake(j); ML.loaded=true; mlDraw(); }
    if(!ML.acc.length){ ML.sync=false; mlDraw(); return; }
    const j=await apiFetch(API_URL,{method:"POST", tmo:280000, body:JSON.stringify({key:pass(), user:curUser(), action:"mail", op:"sync", force:!!force})});
    const n0=ML.rows.length; mlTake(j); ML.at=Date.now(); ML.err="";
    const errs=Object.keys(j.errs||{}); if(errs.length && !quiet) toast("err","Не все ящики обновились", errs.map(id=>(mlAccOf(id).email||id)+": "+j.errs[id]).join("; "));
    if(j.added && !quiet) toast("ok","Новых писем: "+j.added,"");
    if(j.added && quiet && curTab!=="mail") mlBadge();
  }catch(e){ const m=e.message||""; ML.err = m==="unknown action" ? "old" : m==="noproxy" ? "noproxy" : m==="oldproxy" ? "oldproxy" : m; if(m==="unknown action") ML.loaded=true; if(!quiet && !/^(old|noproxy|oldproxy)$/.test(ML.err)) toast("err","Почта не обновилась", m); }
  ML.sync=false; ML.loaded=true; mlBadge(); if(curTab==="mail") mlDraw(); }
function mlTake(j){ if(Array.isArray(j.rows)) ML.rows=j.rows; if(Array.isArray(j.acc)) ML.acc=j.acc; if(j.proxy!=null) ML.proxy=!!j.proxy; }
function mlBadge(){ const n=ML.rows.filter(mlUnread).length; document.querySelectorAll('#fd-app nav.tabs button[data-tab="mail"], #mbar [data-mt="mail"]').forEach(b=>{ if(n) b.dataset.n=n>99?"99+":n; else delete b.dataset.n; }); }
function renderMail(){ if(isStaff()) return; if(!$("#ml")) return; mlDraw(); if(!ML.loaded || Date.now()-ML.at>120000) mlLoad(false, ML.loaded); }
setInterval(()=>{ if(online() && !isStaff() && ML.acc.length && !document.hidden) mlLoad(false, true); }, 300000);
/* ---------- отрисовка ---------- */
function mlList(){ const q=ML.q.trim().toLowerCase();
  return ML.rows.filter(r=>(!ML.box || r.acc===ML.box) && (ML.f==="sent" ? r.dir==="sent" : r.dir!=="sent") && (ML.f!=="unread" || mlUnread(r)) && (ML.f!=="ord" || mlIsOrd(r))
    && (!q || [r.subject, r.fromName, r.from, r.to, r.snippet, r.attsText].join(" ").toLowerCase().includes(q))); }
function mlHead(){ const h=$("#ml-sync"); if(h) h.innerHTML=mlSyncTxt(); }
const mlSyncTxt = () => ML.sync ? `<i class="spin"></i>Проверяю ящики…` : ML.at ? "обновлено в "+new Date(ML.at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) : "";
function mlDraw(){ const el=$("#ml"); if(!el) return; const adm=me().admin;
  if(ML.err==="old"){ el.innerHTML=`<div class="mlempty"><b>Скрипт таблицы старый</b><span>Почта заработает после обновления Code.gs — ${adm?"нажмите «Как обновить» в жёлтой плашке сверху":"попросите Даниила обновить Code.gs"}.</span></div>`; return; }
  if(ML.set && adm){ el.innerHTML=mlSetHtml(); return; }
  if(ML.loaded && !ML.acc.length){ el.innerHTML=`<div class="mlempty"><b>Ящики ещё не подключены</b><span>${adm?"Подключите frudom.ru@mail.ru и info@frudom.ru — письма начнут приходить сюда.":"Попросите Даниила подключить почтовые ящики."}</span>${adm?`<button class="btn pri" type="button" data-ml="set">Подключить ящики</button>`:""}</div>`; return; }
  const L=mlList(), unread=ML.rows.filter(r=>mlUnread(r) && (!ML.box||r.acc===ML.box)).length, ord=ML.rows.filter(r=>(!ML.box||r.acc===ML.box) && mlIsOrd(r) && !(mlOrdSt(r)||{}).st).length;
  const chip=(k,t,n)=>`<button type="button" data-mlf="${k}" class="${ML.f===k?"on":""}" aria-pressed="${ML.f===k}">${t}${n?` <em>${n}</em>`:""}</button>`;
  const accs=`<div class="mlacc"><button type="button" data-mlbox="" class="${ML.box?"":"on"}">Все ящики</button>${ML.acc.map(a=>{ const n=ML.rows.filter(r=>r.acc===a.id && mlUnread(r)).length; return `<button type="button" data-mlbox="${a.id}" class="${ML.box===a.id?"on":""}" style="--c:${mlCol(a.id)}" title="${esc(a.err?"Ошибка: "+a.err:"")}"><i></i>${esc(a.email)}${n?` <em>${n}</em>`:""}${a.err?` <b class="mlwarn">!</b>`:""}</button>`; }).join("")}</div>`;
  const lim=60+ML.more, list=L.slice(0,lim).map((r,i)=>mlRowHtml(r,i)).join("");
  el.innerHTML=`<div class="mlhd"><h2>Почта</h2><span class="muted mlsync" id="ml-sync">${mlSyncTxt()}</span><span class="grow"></span>
      <button class="btn ghost sm" type="button" data-ml="sync" ${ML.sync?"disabled":""}>${ML_IC.ref} Проверить почту</button><button class="btn sm pri" type="button" data-ml="new">${ML_IC.pen} Написать</button>${adm?`<button class="btn ghost sm" type="button" data-ml="set" title="Ящики и посредник">⚙ Ящики</button>`:""}</div>
    ${ML.err && ML.err!=="old" ? `<div class="sknoteb mlerr">${ML.err==="noproxy"?"Не подключён посредник в Яндекс Облаке — письма не забираются. "+(adm?"«⚙ Ящики» → «Посредник».":"Скажите Даниилу."):ML.err==="oldproxy"?"Код посредника в Яндекс Облаке старый (только для банка). "+(adm?"«⚙ Ящики» → «Посредник» → обновить код.":"Скажите Даниилу."):esc(ML.err)}</div>`:""}
    ${accs}
    <div class="mlbar"><div class="pfchips mlf">${chip("in","Входящие",unread)}${chip("ord","Заявки",ord)}${chip("unread","Непрочитанные",0)}${chip("sent","Отправленные",0)}</div>
      <label class="mlq"><input type="search" id="ml-q" placeholder="Поиск: от кого, тема, текст…" value="${esc(ML.q)}" autocomplete="off"></label></div>
    <div class="mlw${ML.sel||ML.comp?" vopen":""}"><div class="mll" id="ml-list" role="list">${list||`<div class="mlempty sm"><b>${ML.q?"Ничего не найдено":ML.f==="ord"?"Заявок нет":ML.f==="sent"?"Отправленных пока нет":"Писем нет"}</b><span>${ML.loaded?"":"Загружаю…"}</span></div>`}
        ${L.length>lim?`<button type="button" class="btn ghost sm mlmore" data-ml="more">Показать ещё (${L.length-lim})</button>`:""}</div>
      <div class="mlv" id="ml-view">${mlViewHtml()}</div></div>`;
  mlBadge(); }
function mlRowHtml(r,i){ const A=mlAtts(r), o=r.dir!=="sent" && mlIsOrd(r), st=mlOrdSt(r), c=o?mlOrd(r).cus:null, who=r.dir==="sent" ? "Кому: "+(r.to||"") : (r.fromName||r.from||"без имени");
  return `<button type="button" class="mlr${mlUnread(r)?" un":""}${ML.sel===r.id?" sel":""}" data-mlid="${esc(r.id)}" role="listitem" style="--c:${mlCol(r.acc)};--d:${Math.min(i,14)*18}ms">
    <span class="mlr1"><b>${esc(who)}</b><time>${mlDate(r.date)}</time></span>
    <span class="mlr2">${r.ans?`<i class="mlans" title="Вы ответили">${ML_IC.reply}</i>`:""}${esc(r.subject||"(без темы)")}</span>
    <span class="mlr3">${esc(String(r.snippet||"").slice(0,140))}</span>
    ${A.length||o?`<span class="mlr4">${A.length?`<span class="mlclip">${ML_IC.clip}${A.length>1?A.length+" ":""}${esc(A[0].n.length>28?A[0].n.slice(0,26)+"…":A[0].n)}</span>`:""}${o?`<span class="mlord${st&&st.st==="taken"?" done":""}">${st&&st.st==="taken"?"Документы сделаны":"Заявка"}${c?" · "+esc(cusNm(c.cid)):""}</span>`:""}</span>`:""}</button>`; }
function mlViewHtml(){ if(ML.comp) return mlCompHtml(); const V=ML.view;
  if(!ML.sel) return `<div class="mlempty sm"><b>Выберите письмо</b><span>Нажмите на письмо слева — оно откроется здесь.</span></div>`;
  const r=ML.rows.find(x=>x.id===ML.sel); if(!r) return "";
  const A=mlAtts(r), text=V&&V.id===r.id?V.text:"", load=!V||V.id!==r.id, O=mlOrd(r, text), st=mlOrdSt(r), adm=me().admin;
  const html=V&&V.id===r.id&&V.html;
  const body = load ? `<div class="mlbody muted"><i class="spin"></i> Загружаю письмо…</div>` : ML.html && html ? `<iframe class="mlhtml" sandbox="allow-popups allow-popups-to-escape-sandbox" title="Письмо" srcdoc="${esc(mlSrcdoc(html))}"></iframe>` : `<div class="mlbody">${mlLinks(text||r.snippet||"")}</div>`;
  const ordBox = r.dir!=="sent" && !load && (O.ok || (st&&st.st) || ML.force===r.id) && !(st&&st.st==="no") ? mlOrdHtml(r, O, st) : "";
  return `<div class="mlvh"><button type="button" class="btn ghost sm mlback" data-ml="back">‹ Письма</button>
      <h3>${esc(r.subject||"(без темы)")}</h3>
      <div class="mlmeta"><span class="mlav" style="--c:${mlCol(r.acc)}">${esc(((r.dir==="sent"?r.to:r.fromName||r.from)||"?").trim()[0]||"?").toUpperCase()}</span>
        <span><b>${esc(r.dir==="sent"?"Вы":(r.fromName||r.from))}</b> ${r.dir==="sent"?"":`<small>&lt;${esc(r.from)}&gt;</small>`}<br><small>кому: ${esc(r.to||r.box)}${r.cc?" · копия: "+esc(r.cc):""}</small></span>
        <span class="mlwhen"><small>${esc(mlFull(r.date))}</small><small class="mlbx" style="--c:${mlCol(r.acc)}">${esc(r.box)}</small></span></div>
      <div class="mlact">${r.dir!=="sent"?`<button class="btn sm pri" type="button" data-ml="reply">${ML_IC.reply} Ответить</button>${(r.cc||String(r.to).includes(","))?`<button class="btn sm" type="button" data-ml="replyall">Ответить всем</button>`:""}`:""}<button class="btn sm ghost" type="button" data-ml="fwd">Переслать</button>
        ${r.dir!=="sent"?`<button class="btn sm ghost" type="button" data-ml="unread">${mlUnread(r)?"Отметить прочитанным":"Не прочитано"}</button>`:""}${!O.ok&&r.dir!=="sent"&&!(st&&st.st)&&ML.force!==r.id?`<button class="btn sm ghost" type="button" data-ml="isord">Это заявка</button>`:""}${html?`<button class="btn sm ghost" type="button" data-ml="html">${ML.html?"Только текст":"Как в письме"}</button>`:""}</div></div>
    ${ordBox}
    ${A.length?`<div class="mlatts">${A.map((x,i)=>`<div class="mlatt"><span class="mlext">${esc((x.n.split(".").pop()||"").slice(0,4).toUpperCase())}</span><span class="mlan"><b title="${esc(x.n)}">${esc(x.n)}</b><small>${x.s?mlSize(x.s):""}${x.f?"":" · ещё не загружено"}</small></span>
        <button type="button" class="btn ghost sm" data-mlatt="${i}" data-how="view">Открыть</button><button type="button" class="btn ghost sm" data-mlatt="${i}" data-how="get" aria-label="Скачать">⤓</button></div>`).join("")}</div>`:""}
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
async function mlOpen(id){ ML.sel=id; ML.comp=null; ML.html=false; ML.imgs=false; const r=ML.rows.find(x=>x.id===id); if(!r) return;
  if(ML.view && ML.view.id!==id) ML.view=null; mlDraw(); mlScrollView();
  if(mlUnread(r)){ r.read="1"; mlSet([{id, read:1}]); }
  try{ const j=await api({action:"mail", op:"get", id}); if(ML.sel!==id) return; ML.view={id, text:j.text||"", html:j.html||"", err:j.err||""}; }
  catch(e){ if(ML.sel!==id) return; ML.view={id, text:r.snippet||"", html:"", err:"Полный текст не загрузился: "+e.message}; }
  const v=$("#ml-view"); if(v){ v.innerHTML=mlViewHtml(); v.classList.add("fresh"); setTimeout(()=>v.classList.remove("fresh"),300); } mlBadge(); mlListMark(); }
function mlListMark(){ document.querySelectorAll("#ml-list .mlr").forEach(b=>{ const r=ML.rows.find(x=>x.id===b.dataset.mlid); b.classList.toggle("sel", b.dataset.mlid===ML.sel); if(r) b.classList.toggle("un", mlUnread(r)); }); const w=$("#ml .mlw"); if(w) w.classList.toggle("vopen", !!(ML.sel||ML.comp)); }
function mlScrollView(){ if(matchMedia("(max-width:899px)").matches){ const v=$("#ml .mlw"); if(v) window.scrollTo({top:v.getBoundingClientRect().top+window.scrollY-80, behavior:"smooth"}); } }
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
  let file=null, text="";
  try{ if(what==="text"){ text=((ML.view&&ML.view.id===r.id?ML.view.text:r.snippet)||"").trim(); if(text.length<10) throw new Error("в письме нет текста заявки"); text="Тема письма: "+(r.subject||"")+"\nОт: "+(r.fromName||"")+" <"+(r.from||"")+">\n\n"+text; }
    else { const t=toast("info","Загружаю вложение…","",{sticky:true}); try{ file=await mlAttGet(r, +what); } finally { if(typeof t==="function") t(); } } }
  catch(e){ toast("err","Не получилось", e.message); return; }
  r.order=JSON.stringify({st:"taken", cid, at:new Date().toISOString(), by:curUser()}); mlSet([{id:r.id, order:r.order, read:1}]);
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
  ML.comp=C; mlDraw(); mlScrollView(); setTimeout(()=>{ const f=kind==="new"||kind==="fwd"?$("#mlc-to"):$("#mlc-text"); if(f){ f.focus(); if(f.id==="mlc-text") f.setSelectionRange(0,0); } }, 50); }
function mlCompHtml(){ const C=ML.comp, sum=C.files.reduce((s,f)=>s+f.size,0)+(C.fwdAtts||[]).filter(x=>x.on).reduce((s,x)=>s+(+x.s||0),0);
  return `<div class="mlcomp"><div class="mlvh"><button type="button" class="btn ghost sm mlback" data-ml="cclose">‹ Письма</button><h3>${C.kind==="new"?"Новое письмо":C.kind==="fwd"?"Переслать":"Ответ"}</h3></div>
    <label class="f">С ящика<select id="mlc-acc">${ML.acc.map(a=>`<option value="${a.id}"${a.id===C.acc?" selected":""}>${esc((a.name?a.name+" — ":"")+a.email)}</option>`).join("")}</select></label>
    <label class="f">Кому<input id="mlc-to" value="${esc(C.to)}" placeholder="адрес@пример.ru, второй@пример.ru" autocomplete="off" list="mlc-dl"></label>
    <label class="f">Копия<input id="mlc-cc" value="${esc(C.cc)}" placeholder="необязательно" autocomplete="off"></label>
    <datalist id="mlc-dl">${[...new Set(ML.rows.filter(r=>r.dir!=="sent"&&r.from).map(r=>(r.fromName?r.fromName+" <"+r.from+">":r.from)))].slice(0,300).map(x=>`<option value="${esc(x)}">`).join("")}</datalist>
    <label class="f">Тема<input id="mlc-sub" value="${esc(C.subject)}" autocomplete="off"></label>
    <label class="f">Текст<textarea id="mlc-text" rows="12">${esc(C.text)}</textarea></label>
    <div class="mlcf">${(C.fwdAtts||[]).map(x=>`<label class="mlchip"><input type="checkbox" data-mlfa="${x.i}"${x.on?" checked":""}> ${ML_IC.clip} ${esc(x.n)} <small>${x.s?mlSize(x.s):""}</small></label>`).join("")}
      ${C.files.map((f,i)=>`<span class="mlchip">${ML_IC.clip} ${esc(f.name)} <small>${mlSize(f.size)}</small><button type="button" data-mlfx="${i}" aria-label="Убрать">×</button></span>`).join("")}
      <label class="btn ghost sm">${ML_IC.clip} Прикрепить файл<input type="file" id="mlc-file" multiple hidden></label>${sum>2.3e6?`<span class="neg" style="font-size:12.5px">вложения больше 2,3 МБ — так не уйдёт</span>`:""}</div>
    <div class="mlcb"><button type="button" class="btn pri" data-ml="send" ${C.busy?"disabled":""}>${C.busy?`<i class="spin"></i>Отправляю…`:"Отправить"}</button><button type="button" class="btn ghost" data-ml="cclose">Отмена</button></div></div>`; }
function mlCompRead(){ const C=ML.comp; if(!C) return; const v=id=>(document.getElementById(id)||{}).value; C.acc=v("mlc-acc")??C.acc; C.to=v("mlc-to")??C.to; C.cc=v("mlc-cc")??C.cc; C.subject=v("mlc-sub")??C.subject; C.text=v("mlc-text")??C.text; }
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
    : `<div class="mlpx ok"><b>Посредник подключён</b> <span class="muted">(тот же, что для банка)</span>${px&&px.mail===0?`<p class="neg">Его код старый — он умеет только банк. Обновите: «Скопировать код» → Яндекс Облако → ваша функция → «Редактор» → заменить весь index.js → «Сохранить изменения». Там же поставьте таймаут 60 секунд.</p>`:px&&px.mail?`<p class="pos">Код новый — почту забирает.</p>`:`<p class="muted">Проверяю версию…</p>`}
      <div class="row"><button class="btn ghost sm" type="button" data-ml="pxcopy">Скопировать код посредника</button><button class="btn ghost sm" type="button" data-ml="pxcheck">Проверить</button></div></div>`;
  const list=ML.acc.map(a=>`<div class="mlsa" style="--c:${mlCol(a.id)}"><i></i><span><b>${esc(a.email)}</b><small>${esc(a.name||"")} · ${esc(a.ih)} / ${esc(a.sh)} · пароль …${esc(a.tail)}${a.at?" · проверен "+mlFull(a.at):""}</small>${a.err?`<small class="neg">Ошибка: ${esc(a.err)}</small>`:""}</span>
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
document.addEventListener("click", e=>{ const root=e.target.closest&&e.target.closest("#ml"); if(!root) return; const t=e.target;
  const row=t.closest("[data-mlid]"); if(row){ mlOpen(row.dataset.mlid); return; }
  const f=t.closest("[data-mlf]"); if(f){ ML.f=f.dataset.mlf; ML.more=0; mlDraw(); return; }
  const bx=t.closest("[data-mlbox]"); if(bx){ ML.box=bx.dataset.mlbox; ML.more=0; mlDraw(); return; }
  const at=t.closest("[data-mlatt]"); if(at){ const r=ML.rows.find(x=>x.id===ML.sel); if(r) mlAtt(r, +at.dataset.mlatt, at.dataset.how); return; }
  const mk=t.closest("[data-mlmk]"); if(mk){ const r=ML.rows.find(x=>x.id===ML.sel); if(r) mlMake(r, mk.dataset.mlmk); return; }
  const fx=t.closest("[data-mlfx]"); if(fx){ mlCompRead(); ML.comp.files.splice(+fx.dataset.mlfx,1); mlDraw(); return; }
  const fa=t.closest("[data-mlfa]"); if(fa){ mlCompRead(); const x=ML.comp.fwdAtts.find(y=>y.i===+fa.dataset.mlfa); if(x) x.on=fa.checked; return; }
  const pre=t.closest("[data-mlpre]"); if(pre){ mlAccRead(); const P=ML_PRE[pre.dataset.mlpre]; Object.assign(ML.edit,{pre:pre.dataset.mlpre}); if(P.ih){ ML.edit.ih=P.ih; ML.edit.sh=P.sh; ML.edit.ip=993; ML.edit.sp=465; } mlDraw(); return; }
  const ae=t.closest("[data-mlae]"); if(ae){ const a=mlAccOf(ae.dataset.mlae); ML.edit=Object.assign({pre:mlPreFor(a.email)}, a); mlDraw(); return; }
  const ad=t.closest("[data-mlad]"); if(ad){ const id=ad.dataset.mlad; if(!(ML.edit&&ML.edit.del===id)){ ML.edit={del:id}; mlDraw(); return; }
    api({action:"mail", op:"delAcc", id}).then(j=>{ mlTake(j); ML.edit=null; mlDraw(); toast("info","Ящик отключён","Письма, что уже пришли, остаются."); }).catch(x=>toast("err","Не отключился", x.message)); return; }
  const b=t.closest("[data-ml]"); if(!b) return; const a=b.dataset.ml, r=ML.rows.find(x=>x.id===ML.sel);
  if(a==="sync"){ mlLoad(true); return; }
  if(a==="more"){ ML.more+=60; mlDraw(); return; }
  if(a==="back"){ ML.sel=""; ML.view=null; mlListMark(); return; }
  if(a==="new"){ ML.sel=""; mlCompose("new"); return; }
  if(a==="reply"||a==="replyall"||a==="fwd"){ mlCompose(a); return; }
  if(a==="cclose"){ ML.comp=null; mlDraw(); return; }
  if(a==="send"){ mlSend(); return; }
  if(a==="unread" && r){ const un=!mlUnread(r); r.read=un?"":"1"; mlSet([{id:r.id, read:!un}]); const v=$("#ml-view"); if(v) v.innerHTML=mlViewHtml(); mlListMark(); mlBadge(); return; }
  if(a==="html"){ ML.html=!ML.html; $("#ml-view").innerHTML=mlViewHtml(); return; }
  if(a==="imgs"){ ML.imgs=true; $("#ml-view").innerHTML=mlViewHtml(); return; }
  if(a==="notord" && r){ r.order=JSON.stringify({st:"no", at:new Date().toISOString(), by:curUser()}); mlSet([{id:r.id, order:r.order}]); mlDraw(); toast("info","Отмечено: не заявка",""); return; }
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
