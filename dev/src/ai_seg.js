/* ===== Настройки ИИ (Gemini и Claude; модель «claude-…» — Claude, с Code.gs ≥ 13): «Данные» → «ИИ», только Даниил. Сервер — действие aiCfg в Code.gs (≥ 12).
   Ключ хранится только в свойствах скрипта таблицы; сайт видит лишь последние 4 знака. ===== */
let AI=null, AIM=null;   /* AI — ответ сервера (настройки, статистика), AIM — список моделей */
const AI_WHO={all:"Все сотрудники", nodriver:"Все, кроме водителя (Гриши)", office:"Только Даниил и Наталья"};
const AI_WHO_HINT={all:"Даниил, Наталья, Склад и Гриша", nodriver:"Даниил, Наталья и Склад", office:"Склад и Гриша — без ИИ"};
const AI_KIND_TXT={order:"Заявки заказчиков («Новый документ» → «Прочитать через ИИ»)", in:"Накладные прихода («Склад» → «+ Приход» → «Фото накладной»)", decl:"Декларации («Склад» → «Декларации» → «Заполнить по файлу»)"};
const aiProv=m=>/^claude/i.test(m||"")?"claude":"gemini", AI_PN={gemini:"Gemini",claude:"Claude"};
function aiErr(m){ return m==="nokey"?"ключ Gemini ещё не вставлен":m==="badkey"?"ключ Gemini не подходит (проверьте, что скопирован полностью)":m==="unknown action"?"скрипт таблицы старый — обновите Code.gs":m||"ошибка"; }
async function aiLoad(n){ const box=$("#ai-box"); if(!box) return;
  if(!D.srvVer){ box.innerHTML=`<p class="muted">Загружаю…</p>`; if((n||0)<40) setTimeout(()=>{ if(!$("#ai-card").hidden) aiLoad((n||0)+1); },700); return; }   /* версия скрипта ещё не пришла с сервера */
  if((D.srvVer||0)<12){ box.innerHTML=`<p class="muted">Полные настройки ИИ (модель, кто может пользоваться, лимиты, свои указания, статистика) заработают после обновления Code.gs. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></p>
    <label class="ai-l">Сменить ключ Gemini<div class="row"><input id="ai-key" type="password" autocomplete="off" placeholder="вставьте новый ключ" style="flex:1 1 240px;min-width:0"><button type="button" class="btn pri sm" id="ai-key-old">Сохранить ключ</button></div></label>`; return; }
  try{ AI=await api({action:"aiCfg", op:"get"}); }catch(e){ box.innerHTML=`<p class="miss">Не получилось загрузить настройки ИИ: ${esc(aiErr(e.message))}</p>`; return; }
  aiDraw(); }
function aiDraw(){ const box=$("#ai-box"); if(!box||!AI) return; const c=AI.cfg, s=AI.stat||{}, num=n=>(+n||0).toLocaleString("ru-RU");
  const when=d=>new Date(d).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  const cl=(D.srvVer||0)>=13, has=pv=>pv==="claude"?!!AI.cKey:!!AI.hasKey;
  const opts=(v,none)=>{ const L={gemini:[],claude:[]}, add=(id,name)=>{ if(!id) return; const pv=aiProv(id); if(pv==="claude"&&!cl) return; if(!L[pv].some(x=>x.id===id)) L[pv].push({id,name:name||""}); };
    (AIM||[]).forEach(m=>add(m.id,m.name)); [AI.def.model,AI.def.fallback,c.model,c.fallback].concat(cl?AI.claudeDef||[]:[]).forEach(x=>add(x));
    const o=x=>`<option value="${esc(x.id)}"${x.id===v?" selected":""}>${esc(x.id)}${x.name?" — "+esc(x.name):""}${x.id===AI.def.model||x.id===AI.def.fallback?" (по умолчанию)":""}${has(aiProv(x.id))?"":" — нужен ключ"}</option>`;
    return (none?`<option value=""${v?"":" selected"}>— без запасной —</option>`:"")+Object.keys(L).filter(pv=>L[pv].length).map(pv=>`<optgroup label="${pv==="claude"?"Claude (Anthropic) — платный":"Google Gemini"}">${L[pv].map(o).join("")}</optgroup>`).join(""); };
  const keyBlock=pv=>{ const g=pv==="gemini", pre=g?"ai-":"ai-c", k=g?AI.hasKey:AI.cKey, mask=g?AI.mask:AI.cMask;
    return `<div class="ai-kb"><div class="ai-kh"><b>${g?"Google Gemini":"Claude (Anthropic)"}</b><span class="${k?"ai-ok":"muted"}">${k?"✓ ключ подключён ("+esc(mask)+")":"ключ не вставлен"}</span></div>
    <div class="row"><input id="${pre}key" type="password" autocomplete="off" placeholder="${k?"вставьте новый ключ, чтобы заменить":"вставьте ключ "+AI_PN[pv]}" style="flex:1 1 240px;min-width:0"><button type="button" class="btn pri sm" id="${pre}key-save" data-prov="${pv}">Сохранить ключ</button><button type="button" class="btn sm" id="${pre}test" data-prov="${pv}">Проверить</button>${k?`<button type="button" class="btn ghost sm danger" id="${pre}key-del" data-prov="${pv}">Удалить ключ</button>`:""}</div>
    <p class="muted ai-n">${g?`Ключ — на <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> → «Create API key». Есть бесплатный дневной лимит.`:`Ключ — на <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> → «API keys» → «Create key» (ключ начинается с sk-ant-). Claude платный: за каждый запрос списываются деньги с баланса в Anthropic, баланс пополняется там же картой. Хорошо читает плохие сканы и рукописное; фото HEIC и фото больше 5 МБ не читает — такие пойдут в запасную модель.`}</p>
    <p id="${pre}test-res" class="ai-n" hidden></p></div>`; };
  const mainOk=has(aiProv(c.model));
  box.innerHTML=`<div class="bk-st ${mainOk?"ok":"warn"}"><b>${mainOk?"✓ ИИ работает: "+esc(c.model)+(c.fallback?", запасная — "+esc(c.fallback):""):"⚠ Нет ключа "+AI_PN[aiProv(c.model)]+" для основной модели — чтение сканов и фото через ИИ не работает"}</b>
      <span>Сегодня: ${num(s.n)} ${plural(+s.n||0,["запрос","запроса","запросов"])}${s.err?", с ошибкой "+num(s.err):""} · ${num(s.tok)} токенов${c.limit?" · лимит "+num(c.limit)+" в день":""} · за месяц: ${num(s.mn)} / ${num(s.mtok)} токенов</span></div>
    <h3 class="ai-h">Ключи</h3>
    <p class="muted ai-n">«Проверить» с пустым полем проверяет сохранённый ключ, с заполненным — новый (до сохранения). Ключи хранятся только в скрипте вашей таблицы, сайт их не показывает.</p>
    ${keyBlock("gemini")}${cl?keyBlock("claude"):`<p class="muted ai-n">Claude (второй ИИ) появится после обновления Code.gs. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></p>`}
    <h3 class="ai-h">Модель</h3>
    <div class="ai-g"><label class="ai-l">Основная<select id="ai-model">${opts(c.model)}</select></label><label class="ai-l">Запасная (если основная занята, не найдена или кончился лимит)<select id="ai-fb">${opts(c.fallback,1)}</select></label></div>
    <div class="ai-mrow"><label class="ai-l ai-own">Или впишите название модели вручную<input id="ai-model-own" placeholder="например gemini-2.5-pro или claude-opus-5-5" autocomplete="off"></label><button type="button" class="btn" id="ai-models">${AIM?"Обновить список моделей":"Загрузить список моделей"}</button></div>
    <p class="muted ai-n">Gemini «flash» — быстрые и почти всегда бесплатные, «pro» — точнее, но медленнее и быстрее упираются в лимит. Claude «haiku» — быстрый и дешёвый, «sonnet» — точнее на плохих сканах и рукописном. Удобно: основная — одна, запасная — другая (если одна не ответила, прочитает вторая).</p>
    <h3 class="ai-h">Кто может пользоваться</h3>
    <div class="ai-r">${Object.entries(AI_WHO).map(([k,t])=>`<label class="ai-o"><input type="radio" name="ai-who" value="${k}"${c.who===k?" checked":""}><span><b>${t}</b><small>${AI_WHO_HINT[k]}</small></span></label>`).join("")}</div>
    <h3 class="ai-h">Что читает ИИ</h3>
    <div class="ai-r">${Object.entries(AI_KIND_TXT).map(([k,t])=>`<label class="ai-o"><input type="checkbox" data-aion="${k}"${c.off[k]?"":" checked"}><span><b>${t.replace(/\s*\(.*$/,"")}</b><small>${(t.match(/\((.*)\)$/)||[])[1]||""}</small></span></label>`).join("")}</div>
    <h3 class="ai-h">Ограничения</h3>
    <div class="ai-g"><label class="ai-l">Наибольший размер файла, МБ (1–13)<input id="ai-mb" type="number" min="1" max="13" step="1" value="${c.maxMb}"></label><label class="ai-l">Запросов в день, не больше (0 — без лимита)<input id="ai-limit" type="number" min="0" step="1" value="${c.limit}"></label></div>
    <h3 class="ai-h">Свои указания для ИИ</h3>
    <p class="muted ai-n">Добавляются к основной инструкции. Пишите простыми словами, например: «Количество в коробках не пересчитывай в кг» или «Поставщик Саид — это ИП Алиев». Формат ответа менять нельзя — сайт его разбирает.</p>
    ${Object.keys(AI_KIND_TXT).map(k=>`<label class="ai-l">${esc(AI.kinds[k]||k)}<textarea data-aix="${k}" rows="2" maxlength="2000" placeholder="ничего не добавлено">${esc(c.extra[k]||"")}</textarea></label><details class="ai-p"><summary>Основная инструкция (не меняется)</summary><pre>${esc((AI.prompts||{})[k]||"")}</pre></details>`).join("")}
    <div class="row ai-save"><button type="button" class="btn pri" id="ai-save">Сохранить настройки</button><button type="button" class="btn ghost" id="ai-reset">Вернуть по умолчанию</button></div>
    ${(AI.log||[]).length?`<details class="ai-log"><summary>Последние запросы (${AI.log.length})</summary><div class="bk-list">${AI.log.map(x=>`<div class="bk-r"><span><b>${esc(when(x.at))} · ${esc(x.u||"—")}</b><small>${esc((AI.kinds||{})[x.k]||(x.k==="chat"?"Помощник (вопросы)":x.k))} · ${esc(x.m||"")} · ${((+x.ms||0)/1000).toFixed(1)} с${x.t?" · "+num(x.t)+" ток.":""}</small></span><span class="${x.ok?"ai-ok":"miss"}">${x.ok?"✓ прочитано":esc(aiErr(x.e))}</span></div>`).join("")}</div><button type="button" class="btn ghost sm" id="ai-stat-reset">Обнулить счётчики и список</button></details>`:""}`;
}
function aiForm(){ const v=id=>($("#"+id)||{}).value||"", own=v("ai-model-own").trim(), c={model:own||v("ai-model"), fallback:v("ai-fb"), who:(document.querySelector('[name="ai-who"]:checked')||{}).value||"all",
    maxMb:+v("ai-mb")||13, limit:+v("ai-limit")||0, extra:{}, off:{}};
  document.querySelectorAll("[data-aix]").forEach(t=>c.extra[t.dataset.aix]=t.value.trim()); document.querySelectorAll("[data-aion]").forEach(b=>c.off[b.dataset.aion]=!b.checked); return c; }
async function aiOp(btn, busy, fn){ if(btn){ btn.disabled=true; btn.dataset.t=btn.textContent; btn.textContent=busy; } try{ await fn(); }catch(e){ toast("warn","ИИ",aiErr(e.message)); } finally{ if(btn&&btn.isConnected){ btn.disabled=false; btn.textContent=btn.dataset.t; } } }
document.addEventListener("click",e=>{ const t=e.target; if(!t.closest||!t.closest("#ai-box")) return; const b=t.closest("button"); if(!b) return;
  const pv=b.dataset.prov||"gemini", pn=AI_PN[pv], pre=pv==="claude"?"ai-c":"ai-", key=(($("#"+pre+"key")||{}).value||"").trim();
  if(b.id==="ai-key-old") return aiOp(b,"Сохраняю…",async()=>{ if(!key) throw new Error("Вставьте ключ"); await api({action:"aiKey", gkey:key}); $("#ai-key").value=""; logEv("Данные","Заменён ключ ИИ (Gemini)"); toast("ok","Ключ Gemini сохранён","Хранится только в скрипте вашей таблицы."); });
  if(b.id===pre+"key-save") return aiOp(b,"Сохраняю…",async()=>{ if(!key) throw new Error("Вставьте ключ в поле"); await api({action:"aiCfg", op:"key", prov:pv, gkey:key}); logEv("Данные","Заменён ключ ИИ ("+pn+")"); toast("ok","Ключ "+pn+" сохранён","Нажмите «Проверить», чтобы убедиться, что он работает."); await aiLoad(); });
  if(b.id===pre+"key-del"){ const used=[AI.cfg.model,AI.cfg.fallback].some(m=>m&&aiProv(m)===pv); if(!confirm("Удалить ключ "+pn+"?"+(used?" Модель "+pn+" выбрана в настройках — она перестанет работать.":""))) return; return aiOp(b,"Удаляю…",async()=>{ await api({action:"aiCfg", op:"delKey", prov:pv}); logEv("Данные","Удалён ключ ИИ ("+pn+")"); toast("ok","Ключ "+pn+" удалён"); await aiLoad(); }); }
  if(b.id===pre+"test") return aiOp(b,"Проверяю…",async()=>{ const out=$("#"+pre+"test-res"), f=aiForm(), m=[f.model,f.fallback].find(x=>x&&aiProv(x)===pv)||""; out.hidden=false; out.className="ai-n muted"; out.textContent="Спрашиваю "+pn+"…";
    try{ const j=await api({action:"aiCfg", op:"test", prov:pv, gkey:key, model:m}); out.className="ai-n ai-ok"; out.textContent=`✓ Работает: модель ${j.model} ответила «${j.text}» за ${(j.ms/1000).toFixed(1)} с.${key?" Ключ ещё не сохранён — нажмите «Сохранить ключ».":""}`; }
    catch(err){ out.className="ai-n miss"; out.textContent="✗ Не работает: "+aiErr(err.message); } });
  if(b.id==="ai-models") return aiOp(b,"Загружаю…",async()=>{ const j=await api({action:"aiCfg", op:"models"}); AIM=j.models||[]; const f=aiForm(); aiDraw(); $("#ai-model").value=f.model; $("#ai-fb").value=f.fallback; toast(j.warn?"warn":"ok","Моделей доступно: "+AIM.length, j.warn||""); });
  if(b.id==="ai-save") return aiOp(b,"Сохраняю…",async()=>{ const f=aiForm(); if(!/^[\w.\-]{1,80}$/.test(f.model.replace(/^models\//,""))) throw new Error("Неверное название основной модели");
    await api({action:"aiCfg", op:"set", cfg:f}); logEv("Данные",`Настройки ИИ: модель ${f.model}${f.fallback?", запасная "+f.fallback:""}; ${AI_WHO[f.who]}`); toast("ok","Настройки ИИ сохранены","Действуют сразу для всех."); await aiLoad(); });
  if(b.id==="ai-reset"){ if(!confirm("Вернуть настройки ИИ по умолчанию? Ключ останется, свои указания удалятся.")) return; return aiOp(b,"Возвращаю…",async()=>{ await api({action:"aiCfg", op:"reset"}); logEv("Данные","Настройки ИИ возвращены по умолчанию"); toast("ok","Настройки по умолчанию"); await aiLoad(); }); }
  if(b.id==="ai-stat-reset"){ if(!confirm("Обнулить счётчики запросов и список последних запросов?")) return; return aiOp(b,"…",async()=>{ await api({action:"aiCfg", op:"resetStat"}); await aiLoad(); }); }
});
