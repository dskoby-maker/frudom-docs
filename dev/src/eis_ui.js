let eisServerReady=false;
function eisConfig(k){const c=ctr(k.dr.contractId);if(!c||c.customerId!==k.dr.customerId)throw Error('Выберите контракт в накладной. Настройки ЕИС сохраняются отдельно для каждого контракта.');let cfg=null;try{cfg=JSON.parse(c.eis||'null');}catch(e){}return {c,cfg};}
function eisWarn(message){$('#pv-warn').hidden=false;$('#pv-warn').textContent=message;toast('warn','Выгрузка для ЕИС',message);}
function eisSetup(k){
  if(isStaff()){eisWarn('Настроить сопоставление ЕИС может Даниил или Наталья.');return;}
  let holder;try{holder=eisConfig(k);}catch(e){eisWarn(e.message);return;}
  let config=holder.cfg&&clone(holder.cfg);
  const dialog=document.createElement('dialog');dialog.id='fd-eis';dialog.style.cssText='box-sizing:border-box;max-width:calc(100vw - 24px);width:min(800px,94vw);max-height:88vh;overflow:auto;border:0;border-radius:16px;padding:22px;font:15px Arial;color:#29232a';
  dialog.innerHTML='<h2 style="margin-top:0">Настройка выгрузки в ЕИС</h2><p>После настройки кнопка «Скачать XML для ЕИС» скачивает один файл .xml для загрузки в ЕИС. Настройка выполняется один раз для контракта, этапа и адреса: выберите архив УПД или транспортный XML и сопоставьте товары. Подпись из образца не используется.</p><label>Файлы ЕИС: ZIP, основной XML + PRIL, транспортный XML, EDOInfo, полный XML/TXT контракта или XML контракта с адресами (все места поставки)<input id="eis-files" type="file" accept=".zip,.xml,.txt" multiple style="display:block;max-width:100%;margin:12px 0"></label><div id="eis-source-info"></div><div id="eis-info"></div><p id="eis-error" role="alert" style="color:#a21c30;white-space:pre-wrap"></p><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn pri" id="eis-save">Сохранить сопоставление</button><button class="btn" id="eis-close">Закрыть</button></div>';
  document.body.appendChild(dialog);const q=s=>dialog.querySelector(s),err=e=>{q('#eis-error').textContent=e.message||e;};
  function draw(){
    q('#eis-info').replaceChildren();q('#eis-save').disabled=!config;if(!config)return;
    const t=Eis.inspectConfig(config);Eis.checkParty(t,k);
    const ship=String(k.dr.ship||firstAddr(k.c)||k.c.address||'').trim();
    q('#eis-info').innerHTML='<p><b>Контракт '+esc(t.number)+' от '+esc(t.date)+'</b><br>Реестровый номер: '+esc(t.register)+'<br>Этап: '+esc(t.contract.getAttribute('ИдЭтапКонт'))+'<br>Адрес в ЕИС: '+esc(t.address)+((config.addrs||config.catalog?.addrs)?'<br>Все адреса контракта ('+(config.addrs||config.catalog.addrs).length+') — выбираются по адресу накладной':'')+'</p><p>Доступно позиций: '+t.positions.length+'. Выберите товар сайта для каждой нужной позиции. Сверяйте номер, код и точную цену: названия могут повторяться. Пустые строки не будут доступны для выгрузки. Для всех товаров загрузите полный XML контракта после образца УПД.</p>'+t.positions.map(pos=>'<label style="display:block;max-width:100%;margin:12px 0"><b>'+(pos.num?'№ '+esc(pos.num)+' · ':'')+esc(pos.name)+'</b> · '+esc(pos.unit)+(pos.price?' · цена контракта '+esc(pos.price)+' ₽':'')+(pos.code?'<br>Код: '+esc(pos.code):'')+'<select data-eis-pos="'+esc(pos.id)+'" style="display:block;width:100%;padding:10px;margin-top:6px"><option value="">Не сопоставлено</option>'+D.products.filter(p=>config.mapping[p.id]===pos.id).map(p=>'<option value="'+esc(p.id)+'"'+(config.mapping[p.id]===pos.id?' selected':'')+'>'+esc(p.name)+' ('+esc(p.unit)+')</option>').join('')+'</select><span style="display:block;margin-top:6px">Страна, если не заполнена в карточке товара:</span><select data-eis-country="'+esc(pos.id)+'" style="width:100%;padding:8px">'+Object.entries(COUNTRIES).map(([code,name])=>'<option value="'+esc(code)+'"'+(code===((config.countries||{})[pos.id]||pos.link.querySelector('СтранаПроисх')?.getAttribute('Код'))?' selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>').join('')+'<label style="display:block;margin:16px 0"><input type="checkbox" id="eis-ship"'+(config.ship===ship&&ship?' checked':'')+'> Подтверждаю соответствие товаров и стран происхождения. Адрес «'+esc(ship||'не указан')+'» в накладной соответствует адресу в образце ЕИС; этап контракта выбран верно.</label><p style="font-size:13px;color:#666">Сопоставление действует для этого контракта и адреса. При смене этапа или адреса загрузите актуальный образец. После импорта в ЕИС проверьте проект и подпишите своей электронной подписью.</p>';
    // Populate the product list on demand: 61 rows must not create 61 copies of the entire catalog.
    const options='<option value="">Не сопоставлено</option>'+D.products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' ('+esc(p.unit)+')</option>').join('');
    dialog.querySelectorAll('[data-eis-pos]').forEach(s=>{const activate=()=>{if(s.dataset.loaded)return;const value=s.value;s.innerHTML=options;s.value=value;s.dataset.loaded='1';};s.onfocus=activate;s.onpointerdown=activate;});
  }
  q('#eis-files').onchange=async e=>{
    q('#eis-save').disabled=true;q('#eis-error').textContent='Читаю образец…';
    try{
      const next=await Eis.read([...e.target.files]);
      if(next.kind==='edo-info'){
        q('#eis-source-info').innerHTML='<p><b>Сведения ЕИС получены: '+esc(next.name)+'</b></p><p>Этот файл содержит участников ЭДО и ссылки на контракты. Полных товарных позиций, этапов и адресов в нём нет. Скачайте XML контракта по ссылке ниже и загрузите его здесь после образца УПД. Текущие настройки выгрузки сохранены.</p>'+next.contracts.map(c=>'<p>Контракт '+esc(c.register)+' · версия '+esc(c.version)+(c.url?'<br><a href="'+esc(c.url)+'" target="_blank" rel="noopener noreferrer">Скачать полный XML контракта из ЕИС</a>':'<br>В файле нет допустимой ссылки на XML контракта.')+'</p>').join('');
        q('#eis-save').disabled=!config;q('#eis-error').textContent='EDOInfo сам по себе не является накладной и не заменяет полную спецификацию.';return;
      }
      if(next.kind==='places'){
        const addrs=Eis.mergePlaces(config,next);config={...config,addrs};draw();
        q('#eis-error').textContent='Загружены места поставки контракта: '+addrs.length+'. Сайт сам подставит нужный адрес из накладной. Нажмите «Сохранить».';return;
      }
      if(next.kind==='contract'){
        if(!config)throw Error('Полный контракт прочитан: '+next.positions.length+' позиций. Сначала загрузите ZIP образца УПД этого контракта, затем повторно этот XML/TXT. Образец нужен для реквизитов и формата приложения ЕИС.');
        const candidate={...config,catalog:next,ship:''};const t=Eis.inspectConfig(candidate);Eis.checkParty(t,k);
        config=candidate;q('#eis-source-info').replaceChildren();draw();q('#eis-error').textContent='Загружена полная спецификация: '+t.positions.length+' позиций. Проверьте сопоставления и подтвердите адрес/этап.';return;
      }
      if(config?.catalog){const old=config.catalog,base=Eis.inspect(next.main,next.pril);if(old.register===base.register&&old.version===base.contract.getAttribute('ИдВерсКонт'))next.catalog=old;}
      const t=Eis.inspectConfig(next);Eis.checkParty(t,k);q('#eis-source-info').replaceChildren();
      // Only retain explicit mappings to positions that are still present in this contract template.
      if(config)Object.entries(config.mapping||{}).forEach(([pid,id])=>{if(t.positions.some(x=>x.id===id))next.mapping[pid]=id;});
      config=next;draw();q('#eis-error').textContent='';
    }catch(x){err(x);q('#eis-save').disabled=!config;}
  };
  q('#eis-close').onclick=()=>{dialog.close();dialog.remove();};dialog.addEventListener('cancel',()=>dialog.remove());
  q('#eis-save').onclick=async()=>{
    try{
      if(!eisServerReady)throw Error('Сначала установите новый Code.gs в Apps Script и обновите страницу. В текущей версии таблицы нет хранения настроек ЕИС.');
      if(!config||!q('#eis-ship')?.checked)throw Error('Подтвердите адрес поставки и этап контракта.');
      const mapping={};dialog.querySelectorAll('[data-eis-pos]').forEach(s=>{if(!s.value)return;if(mapping[s.value])throw Error('Один товар сайта нельзя сопоставить с двумя позициями ЕИС.');mapping[s.value]=s.dataset.eisPos;});
      if(!Object.keys(mapping).length)throw Error('Сопоставьте хотя бы одну товарную позицию.');
      const countries={};dialog.querySelectorAll('[data-eis-country]').forEach(s=>{countries[s.dataset.eisCountry]=s.value;});config.countries=countries;
      config.mapping=mapping;config.ship=String(k.dr.ship||firstAddr(k.c)||k.c.address||'').trim();if(!config.ship)throw Error('Укажите адрес доставки в накладной.');
      const value=JSON.stringify(config);if(value.length>45000)throw Error('Образец слишком большой для хранения в таблице. Выберите УПД с меньшим числом строк.');
      const record=ctr(k.dr.contractId);if(!record||record.customerId!==k.dr.customerId)throw Error('Контракт изменился. Закройте настройку и выберите его заново.');
      record.eis=value;dirty('contracts',record.id);await flush();dialog.close();dialog.remove();toast('ok','Сопоставление ЕИС подготовлено',hasPending()?'Настройки сохранены на устройстве; дождитесь сохранения в таблице.':'Настройки сохранены в таблице. Нажмите «XML для ЕИС».');
    }catch(e){err(e);}
  };
  try{draw();}catch(e){config=null;q('#eis-save').disabled=true;err(e);}dialog.showModal();
}
$('#pv-eis-setup').onclick=()=>eisSetup(cur.k);
// Дата документа для ЕИС — не раньше сегодняшней (иначе ЕИС не примет); дата отгрузки может быть раньше (задним числом).
function eisDates(k,done){
  const today=new Date().toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}).split('.').reverse().join('-');
  const doc=k.dr.date>today?k.dr.date:today,ship=k.dr.date;
  const d=document.createElement('dialog');d.id='fd-eis-dates';d.style.cssText='box-sizing:border-box;max-width:calc(100vw - 24px);width:min(440px,94vw);border:0;border-radius:16px;padding:22px;font:15px Arial;color:#29232a';
  d.innerHTML='<h3 style="margin-top:0">XML для ЕИС</h3><p style="margin:0 0 12px">УПД № '+esc(k.dr.number)+' — '+esc(shortCus(k))+'</p>'
    +'<label style="display:block;margin:10px 0">Дата документа (УПД) — не раньше сегодняшней<br><input type="date" id="eis-ddoc" min="'+today+'" value="'+doc+'" style="font:inherit;padding:6px;margin-top:4px;width:100%;box-sizing:border-box"></label>'
    +'<label style="display:block;margin:10px 0">Дата отгрузки (передачи товара) — можно задним числом<br><input type="date" id="eis-dship" value="'+ship+'" style="font:inherit;padding:6px;margin-top:4px;width:100%;box-sizing:border-box"></label>'
    +'<p id="eis-derr" style="color:#b3261e;min-height:1.2em;margin:6px 0"></p><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="btn" id="eis-dno">Отмена</button><button class="btn pri" id="eis-dok">Скачать XML</button></div>';
  document.body.appendChild(d);const q=x=>d.querySelector(x),close=()=>{d.close();d.remove();};
  q('#eis-dno').onclick=close;d.addEventListener('cancel',()=>d.remove());
  q('#eis-dok').onclick=()=>{const a=q('#eis-ddoc').value,b=q('#eis-dship').value;
    if(!a||!b){q('#eis-derr').textContent='Укажите обе даты.';return;}
    if(a<today){q('#eis-derr').textContent='Дата документа не может быть раньше сегодняшней — ЕИС такой не примет.';return;}
    try{done(a,b);close();}catch(e){q('#eis-derr').textContent=e.message;}};
  d.showModal();
}
$('#pv-xml').onclick=()=>{
  try{
    const {cfg}=eisConfig(cur.k);if(!cfg){eisSetup(cur.k);return;}
    const sup=(D.suppliers||[]).find(x=>x.id===cur.k.dr.supplierId),base=Object.assign({},cur.k,{s:Object.assign({},cur.k.s,{eisLogin:(sup&&sup.eisLogin)||cur.k.s.eisLogin||''})});
    eisDates(cur.k,(docDate,shipDate)=>{
      const k=Object.assign({},base,{dr:Object.assign({},base.dr,{date:docDate}),shipDate});
      const r=Eis.generate(cfg,k),a=document.createElement('a'),url=URL.createObjectURL(new Blob([r.bytes],{type:'application/xml'}));a.href=url;a.download=r.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      logEv('XML','Скачан XML для ЕИС: УПД № '+cur.k.dr.number+' от '+fd(docDate)+', отгрузка '+fd(shipDate)+' — '+shortCus(cur.k),cur.k.dr.id);
      $('#pv-warn').hidden=false;$('#pv-warn').textContent='Скачан XML для ЕИС: документ от '+fd(docDate)+', дата отгрузки '+fd(shipDate)+'. В личном кабинете поставщика: контракт → «Загрузить документ из файла» → «Документ о приемке/счет-фактура». Проверьте товары, суммы, адрес и подписанта, затем подпишите.';
      toast('ok','XML для ЕИС скачан','Документ от '+fd(docDate)+', отгрузка '+fd(shipDate)+'.');
    });
  }catch(e){eisWarn(e.message);}
};
