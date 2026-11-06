/* ===== Настройки ИИ (Gemini): «Данные» → «ИИ», только Даниил. Сервер — действие aiCfg в Code.gs (≥ 12).
   Ключ хранится только в свойствах скрипта таблицы; сайт видит лишь последние 4 знака. ===== */
let AI=null, AIM=null;   /* AI — ответ сервера (настройки, статистика), AIM — список моделей */
const AI_WHO={all:"Все сотрудники", nodriver:"Все, кроме водителя (Гриши)", office:"Только Даниил и Наталья"};
const AI_KIND_TXT={order:"Заявки заказчиков («Новый документ» → «Прочитать через ИИ»)", in:"Накладные прихода («Склад» → «+ Приход» → «Фото накладной»)", decl:"Декларации («Склад» → «Декларации» → «Заполнить по файлу»)"};
function aiErr(m){ return m==="nokey"?"ключ ещё не вставлен":m==="badkey"?"ключ не подходит (проверьте, что скопирован полностью)":m==="unknown action"?"скрипт таблицы старый — обновите Code.gs":m||"ошибка"; }
async function aiLoad(n){ const box=$("#ai-box"); if(!box) return;
  if(!D.srvVer){ box.innerHTML=`<p class="muted">Загружаю…</p>`; if((n||0)<40) setTimeout(()=>{ if(!$("#ai-card").hidden) aiLoad((n||0)+1); },700); return; }   /* версия скрипта ещё не пришла с сервера */
  if((D.srvVer||0)<12){ box.innerHTML=`<p class="muted">Полные настройки ИИ (модель, кто может пользоваться, лимиты, свои указания, статистика) заработают после обновления Code.gs. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></p>
    <label class="ai-l">Сменить ключ Gemini<div class="row"><input id="ai-key" type="password" autocomplete="off" placeholder="вставьте новый ключ" style="flex:1 1 240px;min-width:0"><button type="button" class="btn pri sm" id="ai-key-old">Сохранить ключ</button></div></label>`; return; }
  try{ AI=await api({action:"aiCfg", op:"get"}); }catch(e){ box.innerHTML=`<p class="miss">Не получилось загрузить настройки ИИ: ${esc(aiErr(e.message))}</p>`; return; }
  aiDraw(); }
function aiDraw(){ const box=$("#ai-box"); if(!box||!AI) return; const c=AI.cfg, s=AI.stat||{}, num=n=>(+n||0).toLocaleString("ru-RU");
  const when=d=>new Date(d).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  const opts=(v,none)=>{ const L=(AIM||[]).map(m=>m.id); [AI.def.model,AI.def.fallback,c.model,c.fallback].forEach(x=>{ if(x&&!L.includes(x)) L.push(x); });
    return (none?`<option value=""${v?"":" selected"}>— без запасной —</option>`:"")+L.map(id=>{ const m=(AIM||[]).find(x=>x.id===id); return `<option value="${esc(id)}"${id===v?" selected":""}>${esc(id)}${m&&m.name?" — "+esc(m.name):""}${id===AI.def.model||id===AI.def.fallback?" (по умолчанию)":""}</option>`; }).join(""); };
  box.innerHTML=`<div class="bk-st ${AI.hasKey?"ok":"warn"}"><b>${AI.hasKey?"✓ Ключ подключён ("+esc(AI.mask)+")":"⚠ Ключ не вставлен — чтение сканов и фото через ИИ не работает"}</b>
      <span>Сегодня: ${num(s.n)} ${plural(+s.n||0,["запрос","запроса","запросов"])}${s.err?", с ошибкой "+num(s.err):""} · ${num(s.tok)} токенов${c.limit?" · лимит "+num(c.limit)+" в день":""} · за месяц: ${num(s.mn)} / ${num(s.mtok)} токенов</span></div>
    <h3 class="ai-h">Ключ API</h3>
    <div class="row"><input id="ai-key" type="password" autocomplete="off" placeholder="${AI.hasKey?"вставьте новый ключ, чтобы заменить":"вставьте ключ Gemini"}" style="flex:1 1 240px;min-width:0"><button type="button" class="btn pri sm" id="ai-key-save">Сохранить ключ</button><button type="button" class="btn sm" id="ai-test">Проверить</button>${AI.hasKey?`<button type="button" class="btn ghost sm danger" id="ai-key-del">Удалить ключ</button>`:""}</div>
    <p class="muted ai-n">Ключ берётся на <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> → «Create API key». «Проверить» с пустым полем проверяет сохранённый ключ, с заполненным — новый (до сохранения). Ключ хранится только в скрипте вашей таблицы, сайт его не показывает.</p>
    <p id="ai-test-res" class="ai-n" hidden></p>
    <h3 class="ai-h">Модель</h3>
    <div class="ai-g"><label class="ai-l">Основная<select id="ai-model">${opts(c.model)}</select></label><label class="ai-l">Запасная (если основная занята, не найдена или кончился лимит)<select id="ai-fb">${opts(c.fallback,1)}</select></label></div>
    <div class="row"><button type="button" class="btn ghost sm" id="ai-models">${AIM?"Обновить список моделей":"Загрузить список моделей из Google"}</button><label class="ai-l ai-own">или впишите название<input id="ai-model-own" placeholder="например gemini-2.5-pro" autocomplete="off"></label></div>
    <p class="muted ai-n">«flash» — быстрые и почти всегда бесплатные; «pro» — точнее на плохих сканах, но медленнее и быстрее упираются в лимит.</p>
    <h3 class="ai-h">Кто может пользоваться</h3>
    <div class="ai-r">${Object.entries(AI_WHO).map(([k,t])=>`<label><input type="radio" name="ai-who" value="${k}"${c.who===k?" checked":""}> ${t}</label>`).join("")}</div>
    <h3 class="ai-h">Что читает ИИ</h3>
    <div class="ai-r">${Object.entries(AI_KIND_TXT).map(([k,t])=>`<label><input type="checkbox" data-aion="${k}"${c.off[k]?"":" checked"}> ${t}</label>`).join("")}</div>
    <h3 class="ai-h">Ограничения</h3>
    <div class="ai-g"><label class="ai-l">Наибольший размер файла, МБ (1–13)<input id="ai-mb" type="number" min="1" max="13" step="1" value="${c.maxMb}"></label><label class="ai-l">Запросов в день, не больше (0 — без лимита)<input id="ai-limit" type="number" min="0" step="1" value="${c.limit}"></label></div>
    <h3 class="ai-h">Свои указания для ИИ</h3>
    <p class="muted ai-n">Добавляются к основной инструкции. Пишите простыми словами, например: «Количество в коробках не пересчитывай в кг» или «Поставщик Саид — это ИП Алиев». Формат ответа менять нельзя — сайт его разбирает.</p>
    ${Object.keys(AI_KIND_TXT).map(k=>`<label class="ai-l">${esc(AI.kinds[k]||k)}<textarea data-aix="${k}" rows="2" maxlength="2000" placeholder="ничего не добавлено">${esc(c.extra[k]||"")}</textarea></label><details class="ai-p"><summary>Основная инструкция (не меняется)</summary><pre>${esc((AI.prompts||{})[k]||"")}</pre></details>`).join("")}
    <div class="row ai-save"><button type="button" class="btn pri" id="ai-save">Сохранить настройки</button><button type="button" class="btn ghost" id="ai-reset">Вернуть по умолчанию</button></div>
    ${(AI.log||[]).length?`<details class="ai-log"><summary>Последние запросы (${AI.log.length})</summary><div class="bk-list">${AI.log.map(x=>`<div class="bk-r"><span><b>${esc(when(x.at))} · ${esc(x.u||"—")}</b><small>${esc((AI.kinds||{})[x.k]||x.k)} · ${esc(x.m||"")} · ${((+x.ms||0)/1000).toFixed(1)} с${x.t?" · "+num(x.t)+" ток.":""}</small></span><span class="${x.ok?"ai-ok":"miss"}">${x.ok?"✓ прочитано":esc(aiErr(x.e))}</span></div>`).join("")}</div><button type="button" class="btn ghost sm" id="ai-stat-reset">Обнулить счётчики и список</button></details>`:""}`;
}
function aiForm(){ const v=id=>($("#"+id)||{}).value||"", own=v("ai-model-own").trim(), c={model:own||v("ai-model"), fallback:v("ai-fb"), who:(document.querySelector('[name="ai-who"]:checked')||{}).value||"all",
    maxMb:+v("ai-mb")||13, limit:+v("ai-limit")||0, extra:{}, off:{}};
  document.querySelectorAll("[data-aix]").forEach(t=>c.extra[t.dataset.aix]=t.value.trim()); document.querySelectorAll("[data-aion]").forEach(b=>c.off[b.dataset.aion]=!b.checked); return c; }
async function aiOp(btn, busy, fn){ if(btn){ btn.disabled=true; btn.dataset.t=btn.textContent; btn.textContent=busy; } try{ await fn(); }catch(e){ toast("warn","ИИ",aiErr(e.message)); } finally{ if(btn&&btn.isConnected){ btn.disabled=false; btn.textContent=btn.dataset.t; } } }
document.addEventListener("click",e=>{ const t=e.target; if(!t.closest||!t.closest("#ai-box")) return; const b=t.closest("button"); if(!b) return;
  const key=(($("#ai-key")||{}).value||"").trim();
  if(b.id==="ai-key-old") return aiOp(b,"Сохраняю…",async()=>{ if(!key) throw new Error("Вставьте ключ"); await api({action:"aiKey", gkey:key}); $("#ai-key").value=""; logEv("Данные","Заменён ключ ИИ (Gemini)"); toast("ok","Ключ Gemini сохранён","Хранится только в скрипте вашей таблицы."); });
  if(b.id==="ai-key-save") return aiOp(b,"Сохраняю…",async()=>{ if(!key) throw new Error("Вставьте ключ в поле"); await api({action:"aiCfg", op:"key", gkey:key}); logEv("Данные","Заменён ключ ИИ (Gemini)"); toast("ok","Ключ сохранён","Нажмите «Проверить», чтобы убедиться, что он работает."); await aiLoad(); });
  if(b.id==="ai-key-del"){ if(!confirm("Удалить ключ Gemini? Чтение сканов и фото через ИИ перестанет работать, пока не вставите новый.")) return; return aiOp(b,"Удаляю…",async()=>{ await api({action:"aiCfg", op:"delKey"}); logEv("Данные","Удалён ключ ИИ (Gemini)"); toast("ok","Ключ удалён"); await aiLoad(); }); }
  if(b.id==="ai-test") return aiOp(b,"Проверяю…",async()=>{ const out=$("#ai-test-res"), f=aiForm(); out.hidden=false; out.className="ai-n muted"; out.textContent="Спрашиваю Gemini…";
    try{ const j=await api({action:"aiCfg", op:"test", gkey:key, model:f.model}); out.className="ai-n ai-ok"; out.textContent=`✓ Работает: модель ${j.model} ответила «${j.text}» за ${(j.ms/1000).toFixed(1)} с.${key?" Ключ ещё не сохранён — нажмите «Сохранить ключ».":""}`; }
    catch(err){ out.className="ai-n miss"; out.textContent="✗ Не работает: "+aiErr(err.message); } });
  if(b.id==="ai-models") return aiOp(b,"Загружаю…",async()=>{ const j=await api({action:"aiCfg", op:"models", gkey:key}); AIM=j.models||[]; const f=aiForm(); aiDraw(); $("#ai-model").value=f.model; $("#ai-fb").value=f.fallback; toast("ok","Моделей доступно: "+AIM.length); });
  if(b.id==="ai-save") return aiOp(b,"Сохраняю…",async()=>{ const f=aiForm(); if(!/^[\w.\-]{1,80}$/.test(f.model.replace(/^models\//,""))) throw new Error("Неверное название основной модели");
    await api({action:"aiCfg", op:"set", cfg:f}); logEv("Данные",`Настройки ИИ: модель ${f.model}${f.fallback?", запасная "+f.fallback:""}; ${AI_WHO[f.who]}`); toast("ok","Настройки ИИ сохранены","Действуют сразу для всех."); await aiLoad(); });
  if(b.id==="ai-reset"){ if(!confirm("Вернуть настройки ИИ по умолчанию? Ключ останется, свои указания удалятся.")) return; return aiOp(b,"Возвращаю…",async()=>{ await api({action:"aiCfg", op:"reset"}); logEv("Данные","Настройки ИИ возвращены по умолчанию"); toast("ok","Настройки по умолчанию"); await aiLoad(); }); }
  if(b.id==="ai-stat-reset"){ if(!confirm("Обнулить счётчики запросов и список последних запросов?")) return; return aiOp(b,"…",async()=>{ await api({action:"aiCfg", op:"resetStat"}); await aiLoad(); }); }
});
