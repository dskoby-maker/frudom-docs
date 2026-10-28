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
  function decode(b){const a=new Uint8Array(b),h=new TextDecoder().decode(a.slice(0,180));return new TextDecoder(/encoding\s*=\s*["']utf-8/i.test(h)?'utf-8':'windows-1251',{fatal:true}).decode(a);}
  function inspect(main,pril){
    const m=parse(main),p=parse(pril),root=m.documentElement,pr=p.documentElement;
    if(root.tagName!=='Файл'||attr(root,'ВерсФорм')!=='5.03'||pr.tagName!=='ФайлУПДПрод'||attr(pr,'ВерсФорм')!=='1.23')throw Error('Нужен образец УПД продавца ЕИС: ФНС 5.03 и приложение 1.23, как в предоставленном архиве.');
    const id=attr(root,'ИдФайл'),ids=id.match(/^ON_NSCHFDOPPR_(2ZK-CUS-[^_]+)_(2ZK-SUP-[^_]+)_/);
    if(!ids||attr(pr,'ИдФайл')!==id)throw Error('Основной XML и PRIL должны относиться к одному документу ЕИС.');
    if(!['ДОП','СЧФДОП'].includes(attr(one(m,'Документ'),'Функция')))throw Error('Этот вид УПД не поддерживается.');
    // Do not reuse signature, payment, attachment or correction data from an old document.
    const allowed=['СведКонт','СведПоставщик','СведЗаказчик','СведТов','СведМестаПоставки'];
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
    if(files.length===1&&/\.zip$/i.test(files[0].name)){
      if(files[0].size>20*1024*1024)throw Error('Образец ZIP должен быть меньше 20 МБ.');
      const z=await EisZip.loadAsync(await files[0].arrayBuffer());
      const entries=Object.values(z.files).filter(f=>!f.dir&&/\.xml$/i.test(f.name));
      if(entries.length!==2)throw Error('В ZIP должны быть два XML одного УПД: основной и PRIL.');
      for(const f of entries){if(f._data?.uncompressedSize>300000)throw Error('XML образца слишком большой.');const b=await f.async('uint8array');if(b.length>300000)throw Error('XML образца слишком большой.');docs.push({text:decode(b),bytes:b});}
    }else{
      if(files.length!==2||files.some(f=>f.size>300000))throw Error('Выберите ZIP из ЕИС или два XML: основной и PRIL.');
      for(const f of files){const b=new Uint8Array(await f.arrayBuffer());docs.push({text:decode(b),bytes:b});}
    }
    const main=docs.find(x=>parse(x.text).documentElement.tagName==='Файл'),pril=docs.find(x=>parse(x.text).documentElement.tagName==='ФайлУПДПрод');
    if(!main||!pril)throw Error('Не найдена пара XML УПД и приложения PRIL.');
    const t=inspect(main.text,pril.text),hash=attr(t.p.documentElement,'ХэшФайл');
    if(hash&&hash.toLowerCase()!==eisHash(main.bytes))throw Error('Контрольная сумма основного XML не совпадает с приложением. Выберите исходный архив из ЕИС.');
    return {main:main.text,pril:pril.text,mapping:{},ship:''};
  }
  function generate(config,k){
    const t=inspect(config.main,config.pril);checkParty(t,k);
    const ship=String(k.dr.ship||firstAddr(k.c)||k.c.address||'').trim();
    if(!ship||ship!==config.ship)throw Error('Этот образец ЕИС привязан к другому адресу доставки. Откройте «Настроить ЕИС» и загрузите образец для выбранного адреса.');
    if(!k.dr.number||!/^\d{4}-\d\d-\d\d$/.test(k.dr.date)||!k.lines.length)throw Error('Заполните номер, дату и товарные строки накладной.');
    if(k.rate&&!['5','7','10','20','22'].includes(String(k.rate)))throw Error('Такая ставка НДС пока не поддерживается для ЕИС.');
    const used=new Set(),pairs=k.lines.map(source=>{
      const l=Object.assign({},source); l.country=l.country||(config.countries||{})[config.mapping[l.pid]]||'';
      const id=config.mapping[l.pid],pos=t.positions.find(x=>x.id===id);
      if(!pos)throw Error('Нет сопоставления ЕИС для товара «'+l.name+'». Откройте «Настроить ЕИС».');
      if(used.has(id))throw Error('Несколько строк накладной связаны с одной позицией ЕИС. Объедините их или исправьте сопоставление.');used.add(id);
      if(l.okei!==pos.okei)throw Error('Единица измерения «'+l.name+'» отличается от контракта ЕИС ('+pos.unit+').');
      if(!Number.isFinite(l.qty)||l.qty<=0||!Number.isFinite(l.price)||l.price<0)throw Error('Некорректное количество или цена «'+l.name+'».');
      if(Math.abs(l.qty-Number(qtyS(l.qty)))>1e-9)throw Error('Количество для ЕИС должно содержать не больше трёх знаков после запятой.');
      if(!/^\d{3}$/.test(l.country||''))throw Error('Укажите страну происхождения товара «'+l.name+'» в карточке товара.');
      return {l,pos};
    });
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
    const list=one(p,'СведТов'),tru=one(list,'СведТРУ');tru.replaceChildren();
    const tax=(n,value)=>{n.replaceChildren();const v=m.createElement(k.rate?'СумНал':'БезНДС');v.textContent=k.rate?dec(value,2):'без НДС';n.appendChild(v);};
    pairs.forEach(({l,pos},i)=>{
      const r=pos.row.cloneNode(true),n=pos.link.cloneNode(true),v=one(n,'НеЛПСвед');
      // Rebuild quantity-dependent parts and use the exact name/code of the contract position.
      attrs(r,{НомСтр:i+1,НаимТов:pos.name,КолТов:qtyS(l.qty),ЦенаТов:String(+((k.add?l.priceNet:l.price/(1+(k.rate||0)/100))).toFixed(11)),СтТовБезНДС:dec(l.net,2),НалСт:k.rate?k.rate+'%':'без НДС',СтТовУчНал:dec(l.sum,2)});
      [...r.children].filter(e=>!['ДопСведТов','Акциз','СумНал'].includes(e.tagName)).forEach(e=>e.remove());tax(one(r,'СумНал'),l.vat);
      attrs(v,{НомСтр:i+1,ЭАИдТРУ:guid().replace(/-/g,''),ЦенаИзКонтСНДС:attr(one(pos.link,'НеЛПСвед'),'ЦенаИзКонтСНДС')});
      const origin=one(v,'СтранаПроисх');attrs(origin,{Код:l.country,Наим:COUNTRIES[l.country]||attr(origin,'Наим')});
      if(!COUNTRIES[l.country])throw Error('Нет названия страны с кодом '+l.country+'. Дополните справочник стран.');
      tab.appendChild(r);tru.appendChild(n);
    });
    attrs(total,{СтТовБезНДСВсего:dec(k.t.net,2),СтТовУчНалВсего:dec(k.t.sum,2)});tax(one(total,'СумНалВсего'),k.t.vat);tab.appendChild(total);
    const per=one(m,'СвПер'),bs=t.basis.cloneNode(true);per.replaceChildren(bs);attrs(per,{СодОпер:'Товары переданы',ДатаПер:dd(k.dr.date)});['ДатаНачПер','ДатаОконПер'].forEach(a=>per.removeAttribute(a));
    const main=xml(m),bytes=encode(main),pr=p.documentElement;
    attrs(pr,{ИдФайл:id,ИдПрилож:'PRIL_'+id,ХэшФайл:eisHash(bytes)});
    ['ИдОбъект','ВнешИд'].forEach(a=>pr.removeAttribute(a));attrs(t.place,{ИдМестаПоставки:guid().replace(/-/g,'').toUpperCase()});
    const supplement=xml(p),pb=encode(supplement);
    const packet='<?xml version="1.0" encoding="windows-1251"?>\n<ФайлПакет ИдТрПакет="'+guid()+'" ИдФайл="'+xa(id)+'" ИдПрилож="PRIL_'+xa(id)+'" ДатаВрФормир="'+now.toISOString()+'" ТипПрилож="УПДПрод" ВерсФорм="1.00" ИдОтпр="'+xa(t.sender)+'" ИдПол="'+xa(t.recipient)+'"><Документ><Контент>'+b64(bytes)+'</Контент></Документ><Прилож><Контент>'+b64(pb)+'</Контент></Прилож></ФайлПакет>';
    return {xml:packet,main,supplement,idf:id,bytes:encode(packet)};
  }
  return {inspect,read,generate,encode,decode,checkParty};
})();
