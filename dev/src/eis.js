/* EIS seller acceptance packet. Templates remain in the private contract record. */
const Eis = (() => {
  const one=(n,s)=>{const e=n.querySelector(s);if(!e)throw Error('В образце нет элемента «'+s+'»');return e;};
  const attr=(n,k)=>n?.getAttribute(k)||'';
  const serial=n=>new XMLSerializer().serializeToString(n);
  const parse=s=>{if(/<!DOCTYPE|<!ENTITY/i.test(s))throw Error('XML с внешними сущностями не поддерживается');const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('Повреждён XML образца');return d;};
  const attrs=(n,a)=>{Object.entries(a).forEach(([k,v])=>n.setAttribute(k,String(v)));return n;};
  const xml=d=>'<?xml version="1.0" encoding="windows-1251" standalone="yes"?>\n'+serial(d.documentElement);
  const b64=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
  function encode(s){
    // Use the full Windows-1251 table and fail instead of silently replacing characters with '?'.
    const dec=new TextDecoder('windows-1251'),map=new Map();for(let i=0;i<256;i++)map.set(dec.decode(new Uint8Array([i])),i);
    const a=[];for(const c of s){if(!map.has(c))throw Error('Символ «'+c+'» нельзя записать в XML ЕИС. Замените его в накладной.');a.push(map.get(c));}return new Uint8Array(a);
  }
  function decode(b){const a=new Uint8Array(b),h=new TextDecoder().decode(a.slice(0,180));if(/encoding\s*=\s*["']windows-1251/i.test(h))return new TextDecoder('windows-1251',{fatal:true}).decode(a);try{return new TextDecoder('utf-8',{fatal:true}).decode(a);}catch(e){return new TextDecoder('windows-1251',{fatal:true}).decode(a);}}
  // Места поставки контракта: номер места (sid), код ГАР и текст адреса. Один адрес встречается много раз (по каждой позиции).
  function garPlaces(root){
    return [...root.getElementsByTagNameNS('*','byGARInfo')].map(n=>{const v=k=>n.getElementsByTagNameNS('*',k)[0]?.textContent.trim()||'';return {sid:v('sid'),gar:v('GARGuid'),addr:v('GARAddress')};});
  }
  function uniqAddrs(list,sidOf){
    const out=[],seen=new Set();list.forEach((x,i)=>{if(!x.gar||!x.addr||seen.has(x.gar))return;seen.add(x.gar);out.push({place:sidOf(x,i),gar:x.gar,addr:x.addr});});return out;
  }
  // Ключ адреса: слова улицы + дом/строение/корпус. «ул. Орджоникидзе, д. 15» = «Город Москва, улица Орджоникидзе, дом 15».
  const STOP=new Set(['город','москва','улица','ул','проезд','пр','переулок','пер','проспект','кт','шоссе','ш','бульвар','б','р','набережная','наб','площадь','пл','тупик','туп','дом','д','строение','стр','корпус','корп','к','вн','тер','г','муниципальный','округ','россия','российская','федерация']);
  function addrKey(text){
    const t=String(text||'').toLowerCase().replace(/ё/g,'е'),num=re=>(t.match(re)||[])[1]||'';
    return {house:num(/(?:^|[\s,.])(?:дом|д)\.?\s*(\d+[а-я]?)/),bld:num(/(?:строение|стр)\.?\s*(\d+)/),korp:num(/(?:корпус|корп|к)\.?\s*(\d+)(?![\d.])/),words:new Set((t.match(/[а-я]+/g)||[]).filter(w=>w.length>2&&!STOP.has(w)))};
  }
  function streetOf(gar){const seg=String(gar).split(',').map(x=>x.trim()),i=seg.findIndex(x=>/^д\.\s*\d/.test(x));return i>0?seg[i-1]:'';}
  function findAddr(addrs,ship){
    const a=addrKey(ship),hit=(addrs||[]).filter(x=>{const g=addrKey(x.addr),st=addrKey(streetOf(x.addr));return st.words.size&&[...st.words].every(w=>a.words.has(w))&&g.house===a.house&&g.bld===a.bld&&g.korp===a.korp;});
    if(hit.length>1)throw Error('Адрес «'+ship+'» подходит к нескольким местам поставки ЕИС. Уточните адрес в накладной.');
    return hit[0]||null;
  }
  function readPlaces(text){
    const d=parse(text),root=d.documentElement;
    if(root.localName!=='cpElectronicContract')throw Error('Нужен XML контракта ЕИС.');
    const list=garPlaces(root);if(!list.length)throw Error('В XML контракта нет мест поставки.');
    const num=root.getElementsByTagNameNS('*','contractNumber')[0]?.textContent.trim()||'';
    return {kind:'places',number:num,list};
  }
  // Номера мест в реестре ЕИС отличаются от номеров в проекте контракта, но порядок мест одинаковый (проверено загрузкой в ЕИС 29.10.2026).
  function mergePlaces(config,places){
    const c=config&&config.catalog;if(!c)throw Error('Сначала загрузите полный XML контракта из реестра (как раньше) или образец УПД с полной спецификацией.');
    if(places.number&&c.number&&places.number!==c.number)throw Error('Это XML другого контракта ('+places.number+').');
    if(places.list.length!==c.places.length)throw Error('Количество мест поставки в XML ('+places.list.length+') не совпадает с контрактом в реестре ЕИС ('+c.places.length+').');
    const t=inspect(config.main,config.pril),sp=attr(t.place,'ИдМестаПоставкиКонт'),sg=attr(t.place.querySelector('АдрГАР'),'ИдНом'),i=c.places.indexOf(sp);
    if(i<0||(sg&&places.list[i].gar.toLowerCase()!==sg.toLowerCase()))throw Error('Порядок мест поставки в XML не совпадает с образцом ЕИС. Нужен XML контракта из реестра контрактов.');
    return uniqAddrs(places.list,(x,j)=>c.places[j]);
  }
  // Места поставки, уже известные по реестровому номеру контракта (открытые сведения ЕИС; проверено загрузкой 29.10.2026).
  const KNOWN_ADDRS={'2771826150926000233':[{"place": "60520046", "gar": "652d864a-c881-4e2c-9173-84e99c0cfbd2", "addr": "г. Москва, вн.тер.г. муниципальный округ Ивановское, пр-д Напольный, д. 9"}, {"place": "60520047", "gar": "89a5487d-da0e-4a3a-906d-de363bc9d542", "addr": "г. Москва, вн.тер.г. муниципальный округ Донской, ул. Шаболовка, д. 39"}, {"place": "60520048", "gar": "74d697a0-dfe2-4926-b877-1cc527b14993", "addr": "г. Москва, вн.тер.г. муниципальный округ Донской, ул. Орджоникидзе, д. 15"}, {"place": "60520049", "gar": "6425bdd3-4f25-46d9-9713-18a949ea194a", "addr": "г. Москва, вн.тер.г. муниципальный округ Богородское, пр-д Погонный, д. 5"}, {"place": "60520068", "gar": "37a5b19b-2bf5-4673-8864-f1302fdf3be1", "addr": "г. Москва, вн.тер.г. муниципальный округ Богородское, пр-д Погонный, д. 5 стр. 1"}]};
  // Позиция контракта для строки накладной: по точной цене контракта и единице, при совпадении цен — по словам названия.
  function autoPos(positions,l,taken){
    const price=x=>Number(x.price||attr(x.link&&x.link.querySelector('НеЛПСвед'),'ЦенаИзКонтСНДС')),words=n=>String(n||'').toLowerCase().replace(/ё/g,'е').split('.')[0].match(/[а-я]+/g)||[];
    const all=positions.filter(x=>Math.abs(price(x)-Number(l.price))<0.006),byPrice=all.filter(x=>!taken.has(x.id));let c=byPrice.filter(x=>x.okei===l.okei);
    if(all.length&&!byPrice.length)throw Error('Несколько строк накладной связаны с одной позицией ЕИС («'+l.name+'»). Объедините их в одну строку.');
    if(byPrice.length&&!c.length)throw Error('Единица измерения «'+l.name+'» отличается от контракта ЕИС ('+byPrice[0].unit+').');
    if(c.length>1){const nm=String(l.name).toLowerCase().replace(/ё/g,'е');const f=c.filter(x=>words(x.name).every(w=>nm.includes(w)));if(f.length)c=f;}
    if(c.length>1)throw Error('Товар «'+l.name+'» по цене подходит к нескольким позициям контракта ('+c.map(x=>'№ '+(x.num||'?')).join(', ')+'). Нужна ручная настройка.');
    return c[0]||null;
  }
  function readContract(text){
    // Browser XML view copied into a TXT file: remove only its known display notice.
    text=text.replace(/^\uFEFF?\s*This XML file does not appear to have any style information associated with it\. The document tree is shown below\.\s*/, '');
    const d=parse(text),nodes=[...d.getElementsByTagNameNS('http://zakupki.gov.ru/oos/export/1','contract')];
    if(nodes.length!==1)throw Error('Нужен полный XML одного контракта ЕИС (contract).');
    const c=nodes[0],child=(n,key)=>[...(n?.children||[])].filter(e=>e.localName===key),at=(n,path)=>path.split('/').reduce((a,key)=>child(a,key)[0],n),val=(n,path)=>at(n,path)?.textContent.trim()||'';
    const products=child(at(c,'products'),'product');if(!products.length||products.length>200)throw Error('В XML контракта должно быть от 1 до 200 товарных позиций.');
    const positions=products.map(p=>{
      const countries=child(p,'originCountry').map(x=>val(x,'countryCode'));
      const regs=child(at(p,'registrationNumbersInfo'),'registrationNumberInfo');
      if(val(p,'hierarchyType')!=='ND'||val(p,'type')!=='PRODUCT'||val(p,'VATRateInfo/VATCode')!=='RN'||val(p,'improvedProductReplacement')!=='false'||val(p,'isSoftware')!=='false'||countries.length!==1||regs.some(x=>val(x,'typeRegistry')!=='none'))throw Error('Позиция '+val(p,'indexNum')+': пока поддерживаются обычные товары без НДС, без реестровых номеров и замены характеристик.');
      const x={id:val(p,'guid'),tech:val(p,'sid'),ext:val(p,'externalSid'),num:val(p,'indexNum'),name:val(p,'name'),okei:val(p,'OKEI/code'),price:val(p,'price').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,''),code:val(p,'KTRU/code')||val(p,'OKPD2/code'),country:countries[0]};
      if(!/^[A-Fa-f0-9]{32}$/.test(x.id)||!/^\d+$/.test(x.tech)||!/^\d+$/.test(x.num)||!x.name||!['166','796'].includes(x.okei)||!/^\d+(\.\d{1,11})?$/.test(x.price)||!x.code||!/^\d{3}$/.test(x.country))throw Error('В позиции '+x.num+' отсутствуют или не поддерживаются реквизиты ЕИС.');
      return x;
    });
    if(new Set(positions.map(x=>x.id)).size!==positions.length||new Set(positions.map(x=>x.tech)).size!==positions.length)throw Error('В контракте повторяются идентификаторы позиций.');
    const suppliers=child(at(c,'suppliersInfo'),'supplierInfo');if(suppliers.length!==1)throw Error('Поддерживается один поставщик контракта.');
    const catalog={kind:'contract',register:val(c,'regNum'),version:val(c,'id'),number:val(c,'number'),date:val(c,'signDate'),cinn:val(c,'customer/inn'),ckpp:val(c,'customer/kpp'),sinn:val(suppliers[0],'individualPersonRFIndEntr/EGRIPInfo/INN'),stages:child(at(c,'executionPeriod'),'stages').map(n=>({id:val(n,'guid'),tech:val(n,'sid')})),places:child(at(c,'deliveryPlaceInfo'),'byGARInfo').map(n=>val(n,'sid')),positions};
    if(!catalog.sinn||!catalog.cinn||!catalog.version||!catalog.register||!catalog.number||!catalog.stages.length||!catalog.places.length)throw Error('В XML нет реквизитов поставщика, заказчика, этапа или адреса.');
    const own=uniqAddrs(garPlaces(at(c,'deliveryPlaceInfo')||c),x=>x.sid);if(own.length)catalog.addrs=own;
    return catalog;
  }
  function inspectConfig(config){
    const t=inspect(config.main,config.pril),c=config.catalog;if(!c)return t;
    if(c.kind!=='contract'||c.register!==t.register||c.version!==attr(t.contract,'ИдВерсКонт')||c.number!==t.number||dd(c.date)!==t.date||c.sinn!==t.sinn||c.cinn!==t.cinn||c.ckpp!==t.ckpp)throw Error('Полный XML контракта не совпадает с версией, датой или участниками образца УПД. Нужен образец из этой же версии контракта.');
    if(!c.stages.some(s=>s.id===attr(t.contract,'ИдЭтапКонт')&&s.tech===attr(t.contract,'ТехИдЭтапКонт'))||!c.places.includes(attr(t.place,'ИдМестаПоставкиКонт')))throw Error('Этап или адрес образца отсутствует в полном XML контракта.');
    // Cross-check mapping against actual EIS-created rows before using the same fields for new positions.
    for(const pos of t.positions){const x=c.positions.find(x=>x.id===pos.id);if(!x||x.tech!==attr(pos.link,'ТехИдТРУ')||(x.ext||'')!==attr(pos.link,'ВнешТехИдТРУ')||Number(x.price)!==Number(attr(one(pos.link,'НеЛПСвед'),'ЦенаИзКонтСНДС'))||x.okei!==pos.okei)throw Error('Позиции образца не совпадают со спецификацией контракта.');}
    const base=t.positions[0];t.positions=c.positions.map((x,i)=>{
      const row=base.row.cloneNode(true),link=base.link.cloneNode(true),wrapper=base.link.parentNode.cloneNode(false);wrapper.appendChild(link);
      attrs(row,{НомСтр:i+1,НаимТов:x.name,ОКЕИ_Тов:x.okei,НаимЕдИзм:x.okei==='166'?'Килограмм':'Штука'});
      attrs(one(row,'ДопСведТов'),{КодТов:x.code});attrs(link,{ИдТРУ:x.id,ТехИдТРУ:x.tech,НаимТовИсх:x.name});if(x.ext)link.setAttribute('ВнешТехИдТРУ',x.ext);else link.removeAttribute('ВнешТехИдТРУ');attrs(one(link,'НеЛПСвед'),{НомСтр:i+1,ЦенаИзКонтСНДС:x.price});attrs(one(link,'СтранаПроисх'),{Код:x.country,Наим:COUNTRIES[x.country]||''});
      return {...x,unit:attr(row,'НаимЕдИзм'),row,link};
    });return t;
  }
  function readInfo(text){
    const d=parse(text),all=(n,k)=>[...n.getElementsByTagNameNS('*',k)],val=(n,k)=>all(n,k)[0]?.textContent.trim()||'';
    if(!all(d,'EDOInfo').length)throw Error('Это не файл EDOInfo — сведения для внешних систем ЕИС.');
    const supplier=all(d,'nsiEDOSupplier')[0];if(!supplier)throw Error('В EDOInfo нет сведений поставщика.');
    const contracts=all(d,'contractEDOAddInfo').map(n=>{
      const raw=val(n,'url');let url='';try{const u=new URL(raw);if(u.protocol==='https:'&&u.hostname==='zakupki.gov.ru'&&!u.username&&!u.password&&u.pathname==='/epz/contract/integration/viewXml.html')url=u.href;}catch(e){}
      return {register:val(n,'regNum'),version:val(n,'id'),recipient:val(n,'customerID'),url};
    });
    if(!contracts.length)throw Error('В EDOInfo нет выбранных контрактов.');
    return {kind:'edo-info',sender:val(supplier,'supplierID'),name:val(supplier,'fullName'),contracts};
  }
  // Local consistency checks; this is deliberately not advertised as full EIS XSD validation.
  function unpack(text){
    const d=parse(text),root=d.documentElement;
    if(root.tagName!=='ФайлПакет'||attr(root,'ТипПрилож')!=='УПДПрод')throw Error('Нужен транспортный XML ЕИС с титулом продавца УПД.');
    if([...root.children].some(n=>!['Документ','Прилож'].includes(n.tagName)))throw Error('Пакеты с дополнительными вложениями пока не поддерживаются.');
    const take=tag=>{const nodes=[...root.children].filter(n=>n.tagName===tag);if(nodes.length!==1)throw Error('В пакете должен быть один блок '+tag);const parts=[...nodes[0].children].filter(n=>n.tagName==='Контент');if(parts.length!==1)throw Error('В пакете отсутствует единственный Контент: '+tag);const s=parts[0].textContent.replace(/\s/g,'');if(!s||s.length>400000||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error('Некорректный base64 или слишком большой XML: '+tag);const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return {text:decode(bytes),bytes};};
    const main=take('Документ'),pril=take('Прилож'),t=inspect(main.text,pril.text),id=attr(t.m.documentElement,'ИдФайл');
    if(attr(root,'ИдФайл')!==id||attr(root,'ИдПрилож')!==attr(t.p.documentElement,'ИдПрилож')||attr(root,'ИдОтпр')!==t.sender||attr(root,'ИдПол')!==t.recipient)throw Error('Идентификаторы транспортного пакета не совпадают с вложенными документами.');
    if(attr(t.p.documentElement,'ХэшФайл').toLowerCase()!==eisHash(main.bytes))throw Error('Контрольная сумма УПД в пакете не совпадает.');
    return {main:main.text,pril:pril.text,mapping:{},ship:''};
  }
  function inspect(main,pril){
    const m=parse(main),p=parse(pril),root=m.documentElement,pr=p.documentElement;
    if(root.tagName!=='Файл'||attr(root,'ВерсФорм')!=='5.03'||pr.tagName!=='ФайлУПДПрод'||attr(pr,'ВерсФорм')!=='1.23')throw Error('Нужен образец УПД продавца ЕИС: ФНС 5.03 и приложение 1.23, как в предоставленном архиве.');
    const id=attr(root,'ИдФайл'),ids=id.match(/^ON_NSCHFDOPPR_(2ZK-CUS-[^_]+)_(2ZK-SUP-[^_]+)_/);
    if(!ids||attr(pr,'ИдФайл')!==id)throw Error('Основной XML и PRIL должны относиться к одному документу ЕИС.');
    if(!['ДОП','СЧФДОП'].includes(attr(one(m,'Документ'),'Функция')))throw Error('Этот вид УПД не поддерживается.');
    // Do not reuse signature, payment, attachment or correction data from an old document.
    const allowed=['СведКонт','СведПоставщик','СведЗаказчик','СведТов','СведМестаПоставки','Подписант'];
    if([...pr.children].some(n=>!allowed.includes(n.tagName)))throw Error('Образец содержит дополнительные сведения/вложения. Загрузите простой УПД на товары без приложенных файлов.');
    const rows=[...m.querySelectorAll('ТаблСчФакт > СведТов')],links=[...p.querySelectorAll('НедеталТРУ')];
    if(!rows.length||rows.length!==links.length||p.querySelector('ДеталТРУ'))throw Error('Поддерживаются обычные товарные позиции без детализации.');
    const positions=rows.map(r=>{
      const num=attr(r,'НомСтр'),ls=links.filter(l=>l.querySelector('НеЛПСвед')?.getAttribute('НомСтр')===num);
      if(ls.length!==1)throw Error('Не удалось связать строки УПД и приложения ЕИС.');
      const l=ls[0],v=one(l,'НеЛПСвед');
      if([...l.children].some(x=>x.tagName!=='НеЛПСвед')||[...v.children].some(x=>x.tagName!=='СтранаПроисх'))throw Error('Для этой позиции требуются дополнительные сведения ЕИС.');
      for(const key of ['ИдТРУ','ТехИдТРУ'])if(!attr(l,key))throw Error('В образце нет идентификатора позиции контракта.');
      return {id:attr(l,'ИдТРУ'),name:attr(l,'НаимТовИсх')||attr(r,'НаимТов'),unit:attr(r,'НаимЕдИзм'),okei:attr(r,'ОКЕИ_Тов'),row:r,link:l};
    });
    if(new Set(positions.map(x=>x.id)).size!==positions.length)throw Error('В образце есть повторяющиеся позиции контракта.');
    const contract=one(p,'СведКонт'),basis=one(m,'ОснПер'),places=[...p.querySelectorAll('СведМестоПоставки')];
    for(const key of ['РеестрНомКонт','ИдВерсКонт','ИдЭтапКонт','ТехИдЭтапКонт'])if(!attr(contract,key))throw Error('В образце не заполнен реквизит контракта «'+key+'».');
    if(places.length!==1)throw Error('Загрузите образец для одного адреса поставки.');
    const place=places[0],inn=n=>attr(n.querySelector('[ИННЮЛ]'),'ИННЮЛ')||attr(n.querySelector('[ИННФЛ]'),'ИННФЛ');
    return {m,p,positions,contract,basis,place,sender:ids[2],recipient:ids[1],sinn:inn(one(m,'СвПрод')),cinn:inn(one(m,'СвПокуп')),ckpp:attr(m.querySelector('СвПокуп [КПП]'),'КПП'),number:attr(basis,'РеквНомерДок'),date:attr(basis,'РеквДатаДок'),register:attr(contract,'РеестрНомКонт'),address:attr(place.querySelector('ПоГАР'),'СтрокаГАР')||serial(place)};
  }
  function checkParty(t,k){
    if(t.sinn!==digits(k.s.inn)||t.cinn!==digits(k.c.inn))throw Error('ИНН поставщика или заказчика отличается от образца ЕИС. Загрузите образец нужного контракта.');
    if(t.ckpp&&t.ckpp!==digits(k.c.kpp))throw Error('КПП заказчика отличается от образца ЕИС. Проверьте выбранное подразделение.');
    const b=parseBasis(k.dr.basis||'');if(!b||b.num!==t.number)throw Error('Основание накладной не совпадает с контрактом '+t.number+' из образца. Выберите нужный контракт в накладной.');
    const bank=t.p.querySelector('СведПоставщик БанкРекв');
    if(bank&&digits(k.s.rs)&&attr(bank,'РасчСчет')!==digits(k.s.rs))throw Error('Расчётный счёт поставщика отличается от реквизитов контракта в образце. Нужен актуальный образец ЕИС.');
  }
  async function read(files){
    let docs=[];
    if(files.length===1&&/\.(xml|txt)$/i.test(files[0].name)){
      if(files[0].size>3000000)throw Error('XML настройки слишком большой.');
      const text=decode(await files[0].arrayBuffer());
      if(/<(?:(?:\w+):)?contract(?:\s|>)/.test(text))return readContract(text);
      if(/<(?:\w+:)?cpElectronicContract[\s>]/.test(text))return readPlaces(text);
      const d=parse(text);
      if(d.getElementsByTagNameNS('*','EDOInfo').length)return readInfo(text);
      if(d.documentElement.tagName==='ФайлПакет')return unpack(text);
      throw Error('Это отдельный XML документа. Для настройки выберите основной XML вместе с PRIL, ZIP ЕИС или один транспортный XML ФайлПакет. Сайт скачивает готовый результат одним XML.');
    }
    if(files.length===1&&/\.zip$/i.test(files[0].name)){
      if(files[0].size>20*1024*1024)throw Error('Образец ZIP должен быть меньше 20 МБ.');
      const z=await EisZip.loadAsync(await files[0].arrayBuffer());
      // Архив уже принятого документа содержит ещё ответ заказчика (DP_PDPOL…, титул покупателя) — он для образца не нужен.
      let entries=Object.values(z.files).filter(f=>!f.dir&&/\.xml$/i.test(f.name));
      const upd=entries.filter(f=>/(^|\/)(PRIL_)?ON_NSCHF[^/]*\.xml$/i.test(f.name));if(entries.length!==2&&upd.length===2)entries=upd;
      if(entries.length!==2)throw Error('В ZIP должны быть два XML одного УПД: основной и PRIL.');
      for(const f of entries){if(f._data?.uncompressedSize>300000)throw Error('XML образца слишком большой.');const b=await f.async('uint8array');if(b.length>300000)throw Error('XML образца слишком большой.');docs.push({text:decode(b),bytes:b});}
    }else{
      if(files.length!==2||files.some(f=>f.size>300000))throw Error('Выберите ZIP из ЕИС или два XML: основной и PRIL.');
      for(const f of files){const b=new Uint8Array(await f.arrayBuffer());docs.push({text:decode(b),bytes:b});}
    }
    const main=docs.find(x=>parse(x.text).documentElement.tagName==='Файл'),pril=docs.find(x=>parse(x.text).documentElement.tagName==='ФайлУПДПрод');
    if(!main||!pril)throw Error('Не найдена пара XML УПД и приложения PRIL.');
    // Вложения образца (декларации, сведения о стране) относятся к старому документу — в новый не переносятся, их прикрепляют в ЕИС заново.
    if(/<Вложен[\s>]/.test(pril.text)){const d=parse(pril.text);[...d.documentElement.children].filter(n=>n.tagName==='Вложен').forEach(n=>n.remove());pril.text=xml(d);}
    const t=inspect(main.text,pril.text),hash=attr(t.p.documentElement,'ХэшФайл');
    if(hash&&hash.toLowerCase()!==eisHash(main.bytes))throw Error('Контрольная сумма основного XML не совпадает с приложением. Выберите исходный архив из ЕИС.');
    return {main:main.text,pril:pril.text,mapping:{},ship:''};
  }
  function generate(config,k){
    const t=inspectConfig(config);checkParty(t,k);
    if(config.catalog&&k.rate)throw Error('Загруженная спецификация контракта — без НДС. Проверьте режим НДС накладной.');
    const ship=String(k.dr.ship||firstAddr(k.c)||k.c.address||'').trim();
    const addrs=config.addrs||(config.catalog&&config.catalog.addrs)||KNOWN_ADDRS[t.register]||null,picked=addrs&&ship?findAddr(addrs,ship):null;
    if(!ship||(!picked&&ship!==config.ship))throw Error(addrs?'Адрес «'+(ship||'не указан')+'» не найден среди мест поставки контракта в ЕИС: '+addrs.map(x=>streetOf(x.addr)+', '+x.addr.split(',').slice(-1)[0].trim()).join('; ')+'. Проверьте адрес в накладной.':'Этот образец ЕИС привязан к другому адресу доставки. Откройте «Настроить ЕИС» и загрузите образец для выбранного адреса или XML контракта со всеми адресами.');
    if(!k.dr.number||!/^\d{4}-\d\d-\d\d$/.test(k.dr.date)||!k.lines.length)throw Error('Заполните номер, дату и товарные строки накладной.');
    const date=new Date(k.dr.date+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==k.dr.date)throw Error('Некорректная дата накладной.');
    const today=new Date().toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}).split('.').reverse().join('-');
    if(!k.allowPast&&k.dr.date<today)throw Error('Дата документа ('+dd(k.dr.date)+') раньше сегодняшней — ЕИС такой документ не примет. Поставьте сегодняшнюю или более позднюю дату.');
    if(k.shipDate){const sd=new Date(k.shipDate+'T12:00:00Z');if(!/^\d{4}-\d\d-\d\d$/.test(k.shipDate)||!Number.isFinite(sd.getTime())||sd.toISOString().slice(0,10)!==k.shipDate)throw Error('Некорректная дата отгрузки.');}
    const login=String((k.s&&k.s.eisLogin)||'').trim();
    if(!/^[^\s"<>&]{1,100}$/.test(login))throw Error('Укажите «Логин ЕИС подписанта» в карточке поставщика (Справочники → Поставщики). Его можно посмотреть в профиле личного кабинета ЕИС.');
    if(k.rate&&!['5','7','10','20','22'].includes(String(k.rate)))throw Error('Такая ставка НДС пока не поддерживается для ЕИС.');
    const used=new Set(),pairs=k.lines.map(source=>{
      const l=Object.assign({},source),saved=t.positions.find(x=>x.id===(config.mapping||{})[l.pid]);
      // Сопоставление сайт → ЕИС делается автоматически по цене контракта; сохранённая вручную связь используется, если цена совпадает.
      const pos=(saved&&!used.has(saved.id)&&autoPos([saved],l,used))||autoPos(t.positions,l,used),id=pos&&pos.id;
      if(!pos)throw Error('Цена товара «'+l.name+'» ('+l.price+' ₽) не совпадает ни с одной позицией контракта в ЕИС. Проверьте цену в прайсе заказчика — она должна быть точно как в контракте.');
      l.country=l.country||(config.countries||{})[id]||pos.country||'';
      if(used.has(id))throw Error('Несколько строк накладной связаны с одной позицией ЕИС. Объедините их или исправьте сопоставление.');used.add(id);
      if(l.okei!==pos.okei)throw Error('Единица измерения «'+l.name+'» отличается от контракта ЕИС ('+pos.unit+').');
      if(!Number.isFinite(l.qty)||l.qty<=0||!Number.isFinite(l.price)||l.price<0)throw Error('Некорректное количество или цена «'+l.name+'».');
      if(Math.abs(l.qty-Number(qtyS(l.qty)))>1e-9)throw Error('Количество для ЕИС должно содержать не больше трёх знаков после запятой.');
      if(!/^\d{3}$/.test(l.country||''))throw Error('Укажите страну происхождения товара «'+l.name+'» в карточке товара.');
      return {l,pos};
    });
    for(const key of ['net','vat','sum']){
      if(!Number.isFinite(k.t[key])||k.t[key]<0||k.lines.some(l=>!Number.isFinite(l[key])||l[key]<0)||Math.abs(k.lines.reduce((s,l)=>s+l[key],0)-k.t[key])>0.011)throw Error('Итоги накладной не совпадают со строками. Пересчитайте документ перед выгрузкой.');
    }
    if(k.lines.some(l=>Math.abs(l.net+l.vat-l.sum)>0.011))throw Error('Сумма без НДС и НДС не совпадают с итогом строки.');
    const m=t.m,p=t.p,now=new Date(),day=now.toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}),time=now.toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour12:false}).replace(/:/g,'.');
    const id='ON_NSCHFDOPPR_'+t.recipient+'_'+t.sender+'_'+day.split('.').reverse().join('')+'_'+guid().toUpperCase()+'_0_0_0_0_0_00';
    attrs(m.documentElement,{ИдФайл:id,ВерсПрог:'frudom-docs EIS 1.0'});
    attrs(one(m,'Документ'),{ДатаИнфПр:day,ВремИнфПр:time,Функция:k.rate?'СЧФДОП':'ДОП'});
    attrs(one(m,'СвСчФакт'),{НомерДок:k.dr.number,ДатаДок:dd(k.dr.date)});
    // Only supported seller-title data from the template; no old invoice references or signatures.
    const doc=one(m,'Документ');[...doc.children].filter(e=>!['СвСчФакт','ТаблСчФакт','СвПродПер','Подписант'].includes(e.tagName)).forEach(e=>e.remove());
    const sf=one(m,'СвСчФакт');[...sf.children].filter(e=>!['СвПрод','СвПокуп','ДенИзм','ДопСвФХЖ1'].includes(e.tagName)).forEach(e=>e.remove());
    const dop=sf.querySelector('ДопСвФХЖ1');if(dop)[...dop.children].filter(e=>e.tagName!=='ИнфПродЗаГоскКазн').forEach(e=>e.remove());
    doc.setAttribute('НаимДокОпр',k.rate?'Счет-фактура и документ об отгрузке товаров (выполнении работ), передаче имущественных прав (документ об оказании услуг)':DOP_NAME);doc.setAttribute('ПоФактХЖ',DOP_NAME);
    const tab=one(m,'ТаблСчФакт'),total=one(tab,'ВсегоОпл').cloneNode(true);tab.replaceChildren();
    const list=one(p,'СведТов');list.replaceChildren();
    const tax=(n,value)=>{n.replaceChildren();const v=m.createElement(k.rate?'СумНал':'БезНДС');v.textContent=k.rate?dec(value,2):'без НДС';n.appendChild(v);};
    pairs.forEach(({l,pos},i)=>{
      const r=pos.row.cloneNode(true),n=pos.link.cloneNode(true),v=one(n,'НеЛПСвед');
      // Rebuild quantity-dependent parts and use the exact name/code of the contract position.
      attrs(r,{НомСтр:i+1,НаимТов:pos.name,КолТов:qtyS(l.qty),ЦенаТов:String(+((k.add?l.priceNet:l.price/(1+(k.rate||0)/100))).toFixed(11)),СтТовБезНДС:dec(l.net,2),НалСт:k.rate?k.rate+'%':'без НДС',СтТовУчНал:dec(l.sum,2)});
      [...r.children].filter(e=>!['ДопСведТов','Акциз','СумНал'].includes(e.tagName)).forEach(e=>e.remove());tax(one(r,'СумНал'),l.vat);
      attrs(v,{НомСтр:i+1,ЭАИдТРУ:guid().replace(/-/g,''),ЦенаИзКонтСНДС:attr(one(pos.link,'НеЛПСвед'),'ЦенаИзКонтСНДС')});
      const origin=one(v,'СтранаПроисх');attrs(origin,{Код:l.country,Наим:COUNTRIES[l.country]||attr(origin,'Наим')});
      if(!COUNTRIES[l.country])throw Error('Нет названия страны с кодом '+l.country+'. Дополните справочник стран.');
      const tru=pos.link.parentNode.cloneNode(false);tru.appendChild(n);tab.appendChild(r);list.appendChild(tru);
    });
    attrs(total,{СтТовБезНДСВсего:dec(k.t.net,2),СтТовУчНалВсего:dec(k.t.sum,2)});tax(one(total,'СумНалВсего'),k.t.vat);tab.appendChild(total);
    const per=one(m,'СвПер'),bs=t.basis.cloneNode(true);per.replaceChildren(bs);attrs(per,{СодОпер:'Товары переданы',ДатаПер:dd(k.shipDate||k.dr.date)});['ДатаНачПер','ДатаОконПер'].forEach(a=>per.removeAttribute(a));
    const main=xml(m),bytes=encode(main),pr=p.documentElement;
    attrs(pr,{ИдФайл:id,ИдПрилож:'PRIL_'+id,ХэшФайл:eisHash(bytes)});
    ['ИдОбъект','ВнешИд'].forEach(a=>pr.removeAttribute(a));
    // ЕИС требует блок «Сведения о подписанте» (РДИК_ИК_1079): пустой элемент с порядковым номером и логином пользователя ЕИС.
    [...pr.children].filter(e=>e.tagName==='Подписант').forEach(e=>e.remove());
    const signer=p.createElement('Подписант');signer.setAttribute('ПорядНом','1');signer.setAttribute('ЛогинПрод',login);pr.appendChild(signer);attrs(t.place,{ИдМестаПоставки:guid().replace(/-/g,'').toUpperCase()});
    if(picked){
      // Место поставки из контракта: номер места в реестре ЕИС, код ГАР и адрес (проверено загрузкой в ЕИС 29.10.2026).
      attrs(t.place,{ИдМестаПоставкиКонт:picked.place});const g=one(t.place,'ПоГАР'),a=one(g,'АдрГАР');
      if(attr(a,'ИдНом').toLowerCase()!==picked.gar.toLowerCase()){attrs(g,{СтрокаГАР:picked.addr});attrs(a,{ИдНом:picked.gar});a.removeAttribute('Индекс');
        const z=a.querySelector('ЗемелУчасток'),st=streetOf(picked.addr);if(z&&st)z.textContent=st;}
    }
    const supplement=xml(p),pb=encode(supplement);
    const packet='<?xml version="1.0" encoding="windows-1251"?>\n<ФайлПакет ИдТрПакет="'+guid()+'" ИдФайл="'+xa(id)+'" ИдПрилож="PRIL_'+xa(id)+'" ДатаВрФормир="'+now.toISOString()+'" ТипПрилож="УПДПрод" ВерсФорм="1.00" ИдОтпр="'+xa(t.sender)+'" ИдПол="'+xa(t.recipient)+'"><Документ><Контент>'+b64(bytes)+'</Контент></Документ><Прилож><Контент>'+b64(pb)+'</Контент></Прилож></ФайлПакет>';
    unpack(packet);
    return {xml:packet,main,supplement,idf:id,bytes:encode(packet),filename:'DP_PAKET_'+id+'.xml'};
  }
  return {inspect,inspectConfig,readContract,read,readInfo,readPlaces,mergePlaces,findAddr,unpack,generate,encode,decode,checkParty};
})();
