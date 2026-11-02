function warnings(k){
  const w=[]; const s=k.s, c=k.c;
  if(!k.lines.length) w.push("нет ни одной строки с товаром и количеством");
  if(!s.inn) w.push("ИНН поставщика"); if(!s.address) w.push("адрес поставщика");
  if(!s.rs||!s.bik||!s.bank) w.push("банковские реквизиты поставщика");
  if(!c.priv){ if(!c.inn) w.push("ИНН заказчика"); if(!c.address) w.push("адрес заказчика"); }
  return w;
}
/* факсимиле подписи и печать поставщика (только когда включено «С печатью и подписью») */
let SGN=0;
const SGI = k => { if(!(k && k.sig && k.sig.sign)) return ""; const n=SGN++, dx=-50+((n*37+(k.sig.rot||0))%13)-6, r=((n*53+(k.sig.rot||0))%9)-5; return `<img class="sgi" src="${k.sig.sign}" alt="" style="transform:translateX(${dx}%) rotate(${r}deg)">`; };
const ALL = k => k && k.sig && k.sig.all ? k : null;   /* подписи во всех графах — только для заказчиков, которые этого требуют */
const STI = (k, cls) => k && k.sig && k.sig.stamp ? `<img class="sti ${cls||""}" src="${k.sig.stamp}" alt="" style="transform:rotate(${k.sig.rot||-7}deg)">` : "";
function sigLine(role, name, k){ return `<div class="sig"><span class="nobr">${role}</span><div><div class="u sgu">&nbsp;${SGI(k)}</div><div class="cap">подпись</div></div><span></span><div><div class="u">${esc(name)}</div><div class="cap">расшифровка подписи</div></div></div>`; }

function docInvoice(k){
  const s=k.s, c=k.c, d=k.dr;
  const rows=k.lines.map(l=>`<tr><td class="c">${l.n}</td><td>${esc(l.name)}</td><td class="r">${fq(l.qty)}</td><td class="c">${esc(l.unit)}</td><td class="r">${fm(k.add?l.priceNet:l.price)}</td><td class="r">${fm(k.add?l.net:l.sum)}</td></tr>`).join("");
  const signer = isIP(s) ? sigLine("Индивидуальный предприниматель", initials(s.fio), k) : sigLine("Руководитель", initials(s.fio), k) + sigLine("Бухгалтер", initials(s.fio), k);
  return `<div class="doc doc-invoice">
  <table class="g"><colgroup><col style="width:35%"><col style="width:25%"><col style="width:8%"><col></colgroup>
    <tr><td colspan="2" rowspan="2" style="border-bottom:0">${esc(s.bank)}<br><br><span class="sm">Банк получателя</span></td><td>БИК</td><td style="border-bottom:0">${esc(s.bik)}</td></tr>
    <tr><td>Сч. №</td><td style="border-top:0">${esc(s.ks)}</td></tr>
    <tr><td>ИНН ${esc(s.inn)}</td><td>КПП ${esc(s.kpp)}</td><td rowspan="2">Сч. №</td><td rowspan="2">${esc(s.rs)}</td></tr>
    <tr><td colspan="2">${esc(s.name)}<br><br><span class="sm">Получатель</span></td></tr>
  </table>
  <h1>Счёт на оплату № ${esc(d.number)} от ${fdw(d.date)}</h1><hr class="thick">
  <table class="lbl"><colgroup><col style="width:22%"><col></colgroup>
    <tr><td>Поставщик<br>(Исполнитель):</td><td class="b">${esc(req(s))}</td></tr>
    <tr><td>Покупатель<br>(Заказчик):</td><td class="b">${esc(req(c))}</td></tr>
    <tr><td>Основание:</td><td class="b">${esc(d.basis)}</td></tr>
  </table><br>
  <table class="g"><thead><tr><th style="width:5%">№</th><th>Товары (работы, услуги)</th><th style="width:10%">Кол-во</th><th style="width:7%">Ед.</th><th style="width:13%">Цена</th><th style="width:14%">Сумма</th></tr></thead><tbody>${rows}</tbody></table>
  <table style="margin-top:4px"><tr><td class="r b">Итого:</td><td class="r b" style="width:14%">${fm(k.add?k.t.net:k.t.sum)}</td></tr>
    <tr><td class="r b">${k.add?"НДС "+k.rate+"%:":k.rate?"В том числе НДС "+k.rate+"%:":"Без налога (НДС)"}</td><td class="r b">${k.rate?fm(k.t.vat):"—"}</td></tr>
    <tr><td class="r b">Всего к оплате:</td><td class="r b">${fm(k.t.sum)}</td></tr></table>
  <p>Всего наименований ${k.lines.length}, на сумму ${fm(k.t.sum)} руб.<br><b>${moneyWords(k.t.sum)}</b></p>
  <hr class="thick"><div class="signbox" style="max-width:70%">${signer}${STI(k,"inv")}</div></div>`;
}

/* простая накладная (для частных лиц) */
function docNakl(k){
  const s=k.s, c=k.c, d=k.dr, sl=[s.name, s.inn&&("ИНН "+s.inn), s.address, s.phone&&("тел. "+s.phone)].filter(Boolean).join(", ");
  const bl=[c.name||"Частное лицо", c.phone&&("тел. "+c.phone)].filter(Boolean).join(", "), ad=d.ship||c.address||"";
  const rows=k.lines.map(l=>`<tr><td class="c n">${l.n}</td><td>${esc(l.name)}</td><td class="c">${esc(l.unit)}</td><td class="r">${fq(l.qty)}</td><td class="r">${fm(l.price)}</td><td class="r b">${fm(l.sum)}</td></tr>`).join("");
  return `<div class="doc doc-nk">
  <div class="nk-top"><div class="nk-t">Накладная № ${esc(d.number)}</div><div class="nk-d">от ${fdw(d.date)}</div></div>
  <table class="nk-p"><colgroup><col style="width:18%"><col></colgroup>
    <tr><td class="nk-l">Продавец</td><td class="b">${esc(sl)}</td></tr>
    <tr><td class="nk-l">Покупатель</td><td class="b">${esc(bl)}</td></tr>
    ${ad?`<tr><td class="nk-l">Адрес доставки</td><td>${esc(ad)}</td></tr>`:""}
    ${d.basis?`<tr><td class="nk-l">Основание</td><td>${esc(d.basis)}</td></tr>`:""}
  </table>
  <table class="nk-g"><thead><tr><th style="width:6%">№</th><th>Товар</th><th style="width:8%">Ед.</th><th style="width:11%">Кол-во</th><th style="width:14%">Цена, ₽</th><th style="width:16%">Сумма, ₽</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="nk-tot"><div class="nk-tl">${k.rate?(k.add?"НДС "+k.rate+"%":"в т.ч. НДС "+k.rate+"%")+": "+fm(k.t.vat)+" ₽":"Без НДС"}</div><div class="nk-sum"><span>Итого</span><b>${fm(k.t.sum)} ₽</b></div></div>
  <p class="nk-w">Всего наименований ${k.lines.length}${k.t.kg?", общий вес "+fq(k.t.kg)+" кг":""}, на сумму ${fm(k.t.sum)} руб.<br><b>${moneyWords(k.t.sum)}</b></p>
  <div class="nk-sg"><div class="nk-s">${sigLine("Отпустил", initials(s.fio)||"", k)}${STI(k,"inv")}</div><div class="nk-s">${sigLine("Получил", "", null)}</div></div>
  <p class="nk-f">Товар получен в полном объёме, претензий по количеству и качеству нет.</p></div>`;
}

/* (резерв) грубая разбивка по числу знаков */
function paginate(lines, chars, first, other, footer){
  const w = l => Math.max(1, Math.ceil(((l.nameT||l.name)||"").length / chars));
  const pages=[]; let cur=[], cap=first, used=0;
  lines.forEach(l=>{ const h=w(l); if(cur.length && used+h>cap){ pages.push(cur); cur=[]; cap=other; used=0; } cur.push(l); used+=h; });
  if(cur.length>1 && used+footer>cap){ const last=cur.pop(); pages.push(cur); cur=[last]; }
  pages.push(cur);
  return pages;
}
function basisParts(b){ b=b||""; const m=b.match(/^(.*?)\s+от\s+(\d{2}\.\d{2}\.\d{4})/); if(!m) return {no:"",date:""};
  const no=m[1].includes("№") ? m[1].split("№").pop().trim() : m[1].trim(); return {no, date:m[2]}; }
function datePlain(iso){ if(!iso) return ""; const [y,m,d]=iso.split("-"); return `"${d}" ${MON[+m-1]} ${y} года`; }
function bankReq(o){ if(!o.rs) return "";
  return o.acct==="treasury" ? `казн.счет ${o.rs}, в банке ${o.bank}, БИК ТОФК ${o.bik}, ЕКС ${o.ks}` : `р/с ${o.rs}, в банке ${o.bank}, БИК ${o.bik}, к/с ${o.ks}`; }
const partyLine = (o, addr) => [o.name, o.inn&&("ИНН "+o.inn), addr, o.phone&&("тел.: "+o.phone), bankReq(o)].filter(Boolean).join(", ");
const S3 = (label, pos, name, bold, k) => `<div class="s3"><span class="${bold?"b":""}">${label}</span><div><div class="u">${esc(pos)}</div><div class="cap">должность</div></div><div><div class="u sgu">&nbsp;${SGI(k)}</div><div class="cap">подпись</div></div><div><div class="u">${esc(name)}</div><div class="cap">расшифровка подписи</div></div></div>`;

function docTorg12(k, P){
  const s=k.s, c=k.c, d=k.dr, bp=basisParts(d.basis);
  const consignee = partyLine(c, d.ship || firstAddr(c) || c.address);
  const pages = P || [k.lines];
  const vatCell = l => k.rate ? [k.rate+"%", fm(l.vat)] : ["Без НДС", ""];
  const thead = `<thead><tr><th rowspan="2" style="width:3%">Но-<br>мер<br>по по-<br>рядку</th><th colspan="2">Товар</th><th colspan="2">Единица измерения</th><th rowspan="2" style="width:4%">Вид<br>упаков-<br>ки</th><th colspan="2">Количество</th><th rowspan="2" style="width:4.5%">Масса<br>брутто</th><th rowspan="2" style="width:5%">Коли-<br>чество<br>(масса<br>нетто)</th><th rowspan="2" style="width:7%">Цена,<br>руб. коп.</th><th rowspan="2" style="width:8%">Сумма без<br>учета НДС,<br>руб. коп.</th><th colspan="2">НДС</th><th rowspan="2" style="width:8%">Сумма с<br>учетом<br>НДС,<br>руб. коп.</th></tr>
    <tr><th>наименование, характеристика, сорт,<br>артикул товара</th><th style="width:${k.lines.some(l=>l.code)?7:3.5}%">код</th><th style="width:4.5%">наиме-<br>нование</th><th style="width:4%">код по<br>ОКЕИ</th><th style="width:3.5%">в<br>одном<br>месте</th><th style="width:4%">мест,<br>штук</th><th style="width:6%">ставка, %</th><th style="width:7%">сумма,<br>руб. коп.</th></tr>
    <tr class="nums">${[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n=>`<th>${n}</th>`).join("")}</tr></thead>`;
  const totRow = (label, ls) => { const t=ls.reduce((a,l)=>({q:a.q+l.qty,n:a.n+l.net,v:a.v+l.vat,s:a.s+l.sum}),{q:0,n:0,v:0,s:0});
    return `<tr class="tot"><td colspan="7" class="r nb">${label}</td><td></td><td></td><td class="r">${t.q.toFixed(3).replace(".",",")}</td><td class="c">Х</td><td class="r">${fm(t.n)}</td><td class="c">Х</td><td class="r">${k.rate?fm(t.v):""}</td><td class="r">${fm(t.s)}</td></tr>`; };
  const L = (lbl, val, cap) => `<tr><td class="r nobr lab">${lbl}</td><td><div class="u">${esc(val)}</div><div class="cap">${cap}</div></td></tr>`;
  const head = `
  <table class="t12h"><tr><td style="vertical-align:top">
    <div class="r sm" style="visibility:hidden">.</div>
    <table class="lbl">
      ${L("", partyLine(s, s.address), "организация-грузоотправитель, адрес, телефон, факс, банковские реквизиты")}
      ${L("", "", "структурное подразделение")}
      ${L("Грузополучатель", consignee, "организация, адрес, телефон, факс, банковские реквизиты")}
      ${L("Поставщик", partyLine(s, s.address), "организация, адрес, телефон, факс, банковские реквизиты")}
      ${L("Плательщик", partyLine(c, c.address), "организация, адрес, телефон, факс, банковские реквизиты")}
      ${L("Основание", d.basis, "договор, заказ-наряд")}
    </table><table style="width:auto;margin:4px 0 0 30%"><tr><td class="b" style="font-size:11pt;padding-right:12px;vertical-align:bottom">ТОВАРНАЯ НАКЛАДНАЯ</td>
    <td><table class="g bx"><tr><th class="nobr">Номер документа</th><th class="nobr">Дата составления</th></tr><tr><td class="c" style="font-size:9pt">${esc(d.number)}</td><td class="c" style="font-size:9pt">${fd(d.date)}</td></tr></table></td></tr></table></td>
    <td style="width:21%;vertical-align:top">
      <div class="r sm">Унифицированная форма № ТОРГ-12<br>Утверждена постановлением Госкомстата России от 25.12.98 № 132</div>
      <table class="codes">
        <tr><td></td><td class="c box">Коды</td></tr>
        <tr><td class="r">Форма по ОКУД</td><td class="c b box">0330212</td></tr>
        <tr><td class="r">по ОКПО</td><td class="box"></td></tr>
        <tr><td class="r" style="height:22px;vertical-align:bottom">Вид деятельности по ОКДП</td><td class="box"></td></tr>
        <tr><td class="r" style="height:30px;vertical-align:bottom">по ОКПО</td><td class="box"></td></tr>
        <tr><td class="r" style="height:30px;vertical-align:bottom">по ОКПО</td><td class="box"></td></tr>
        <tr><td class="r" style="height:30px;vertical-align:bottom">по ОКПО</td><td class="box"></td></tr>
        <tr><td class="r">номер</td><td class="c b box">${esc(bp.no)}</td></tr>
        <tr><td class="r">дата</td><td class="c b box">${esc(bp.date)}</td></tr>
        <tr><td class="r">Транспортная накладная &nbsp; номер</td><td class="box"></td></tr>
        <tr><td class="r">дата</td><td class="box"></td></tr>
        <tr><td class="r">Вид операции</td><td class="box"></td></tr>
      </table></td></tr></table>
`;
  const footer = `
  <table class="t12f">
    <tr><td style="width:12%"></td><td class="nobr" style="width:22%">Товарная накладная имеет приложение на</td><td colspan="2"><div class="u" style="width:60%">&nbsp;</div></td></tr>
    <tr><td></td><td>и содержит</td><td colspan="2"><div class="u">${cap(intWords(k.lines.length,false))}</div><div class="cap">прописью</div></td><td class="nobr">порядковых номеров записей</td></tr>
  </table>
  <table class="t12f"><tr><td style="width:12%"></td><td style="width:10%"></td><td style="width:20%"></td><td class="r" style="width:18%">Масса груза (нетто)</td><td><div class="u">&nbsp;</div><div class="cap">прописью</div></td><td style="width:16%"><div class="box" style="height:16px;border:1.5px solid #000"></div></td></tr>
    <tr><td></td><td>Всего мест</td><td><div class="u">&nbsp;</div><div class="cap">прописью</div></td><td class="r">Масса груза (брутто)</td><td><div class="u">&nbsp;</div><div class="cap">прописью</div></td><td><div class="box" style="height:16px;border:1.5px solid #000"></div></td></tr></table>
  <table class="t12f"><tr>
    <td style="width:52%;vertical-align:top;padding-right:8px;border-right:1px solid #000">
      <div class="row2">Приложение (паспорта, сертификаты и т.п.) на <span class="u ib" style="width:90px"></span> листах</div>
      <div class="b" style="margin-top:8px">Всего отпущено на сумму</div>
      <div class="u b">${moneyWords(k.t.sum)}</div><div class="cap" style="width:80%">прописью</div>
      ${S3("Отпуск груза разрешил", isIP(s)?"Индивидуальный предприниматель":"Руководитель", initials(s.fio), false, k)}
      ${S3("Главный (старший) бухгалтер", "", isIP(s)?"":initials(s.fio), true, ALL(k)).replace('<div><div class="u"></div><div class="cap">должность</div></div>','<div></div>')}
      ${S3("Отпуск груза произвел", "", "", false, ALL(k))}
      <div class="mp">${STI(k,"t12")}<span>М.П.</span><span>${datePlain(d.date)}</span></div></td>
    <td style="vertical-align:top;padding-left:8px">
      <div class="row2">По доверенности № <span class="u ib" style="width:140px"></span> от <span class="u ib" style="width:180px"></span></div>
      <div class="row2" style="margin-top:8px">выданной <span class="u ib" style="width:78%"></span></div><div class="cap" style="margin-left:20%">кем, кому (организация, должность, фамилия, и. о.)</div>
      <div class="u" style="margin-top:12px">&nbsp;</div><div class="u" style="margin-top:12px">&nbsp;</div>
      ${S3("Груз принял", "", "")}
      ${S3("Груз получил грузополучатель", "", "")}
      <div class="mp"><span>М.П.</span><span>"&nbsp;&nbsp;&nbsp;&nbsp;" _____________ 20&nbsp;&nbsp;&nbsp; года</span></div></td></tr></table>`;
  return pages.map((ls,i)=>{
    const last = i===pages.length-1;
    const rows = ls.map(l=>{ const [r,v]=vatCell(l); return `<tr class="m-row"><td class="r">${l.n}</td><td>${esc(l.nameT||l.name)}</td><td>${esc(l.code)}</td><td class="c">${esc(l.unit)}</td><td class="c">${l.okei}</td><td></td><td></td><td></td><td></td><td class="r">${l.qty.toFixed(3).replace(".",",")}</td><td class="r">${fm(l.priceNet)}</td><td class="r">${fm(l.net)}</td><td>${r}</td><td class="r">${v}</td><td class="r">${fm(l.sum)}</td></tr>`; }).join("");
    return `<div class="doc t12"><div class="m-head">${i===0?head:""}</div><div class="pgno">Страница ${i+1}</div>
      <table class="g sm items">${thead}<tbody>${rows}${totRow("Итого", ls)}${last?totRow("Всего по накладной", k.lines):""}</tbody></table><div class="m-foot">${last?footer:""}</div></div>`;
  });
}

function docUPD(k, P){
  const s=k.s, c=k.c, d=k.dr, st = k.rate?1:2;
  const pages = P || [k.lines];
  const listWord = n => n+" "+plural(n,["листе","листах","листах"]);
  const L=(lbl,val,n)=>`<tr><td class="lab">${lbl}</td><td class="u v">${val}</td><td class="nobr sm n">(${n})</td></tr>`;
  const sign=initials(s.fio);
  const thead = `<colgroup><col style="width:3.5%"><col style="width:2%"><col style="width:18%"><col style="width:3%"><col style="width:3%"><col style="width:4.5%"><col style="width:5.5%"><col style="width:6%"><col style="width:6.5%"><col style="width:5%"><col style="width:5%"><col style="width:5%"><col style="width:6.5%"><col style="width:4%"><col style="width:5%"><col style="width:5%"><col style="width:3%"><col style="width:4%"><col style="width:5%"></colgroup><thead><tr><th rowspan="2" style="width:3.5%">Код товара/ работ, услуг</th><th rowspan="2" style="width:2%">№ п/п</th><th rowspan="2" style="width:21.5%">Наименование товара (описание выполненных работ, оказанных услуг), имущественного права</th><th rowspan="2" style="width:3%">Код вида товара</th><th colspan="2">Единица измерения</th><th rowspan="2" style="width:5%">Количество (объем)</th><th rowspan="2" style="width:5.5%">Цена (тариф) за единицу измерения</th><th rowspan="2" style="width:6.5%">Стоимость товаров (работ, услуг), имущественных прав без налога — всего</th><th rowspan="2" style="width:4%">В том числе сумма акциза</th><th rowspan="2" style="width:4%">Налоговая ставка</th><th rowspan="2" style="width:4.5%">Сумма налога, предъявляемая покупателю</th><th rowspan="2" style="width:6.5%">Стоимость товаров (работ, услуг), имущественных прав с налогом — всего</th><th colspan="2">Страна происхождения товара</th><th rowspan="2" style="width:4%">Регистрационный номер декларации на товары или регистрационный номер партии товара, подлежащего прослеживаемости</th><th colspan="2">Количественная единица измерения товара, используемая в целях осуществления прослеживаемости</th><th rowspan="2" style="width:3.5%">Количество товара, подлежащего прослеживаемости, в количественной единице измерения</th></tr>
    <tr><th style="width:3%">код</th><th style="width:4%">условное обозначение (национальное)</th><th style="width:3.5%">цифровой код</th><th style="width:4.5%">краткое наименование</th><th style="width:3%">код</th><th style="width:3%">условное обозначение</th></tr>
    <tr class="nums"><th>А</th><th>1</th><th>1а</th><th>1б</th><th>2</th><th>2а</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>10а</th><th>11</th><th>12</th><th>12а</th><th>13</th></tr></thead>`;
  const head = `
  <table><tr>
    <td class="updleft"><div class="b" style="font-size:9.5pt">Универсальный<br>передаточный<br>документ</div><br>
      <table class="g" style="width:auto"><tr><td>Статус:</td><td class="c b" style="font-size:11pt;padding:1px 9px">${st}</td></tr></table>
      <p class="sm" style="margin-top:6px">1 – счет-фактура и передаточный документ (акт)<br>2 – передаточный документ (акт)</p></td>
    <td style="vertical-align:top;padding-left:6px">
      <div class="r sm">Приложение № 1 к постановлению Правительства Российской Федерации от 26 декабря 2011 г. № 1137<br>(в редакции постановления Правительства Российской Федерации от 23 января 2026 г. № 26)</div>
      <table class="updh fx"><colgroup><col style="width:33%"><col><col style="width:28px"></colgroup>
        <tr><td class="b" style="font-size:9pt">Счет-фактура №</td><td class="u v b" style="font-size:9pt">${esc(d.number)} &nbsp;&nbsp;&nbsp; от &nbsp;&nbsp;&nbsp; ${fdw(d.date)}</td><td class="sm n">(1)</td></tr>
        ${L("Исправление №","-- &nbsp;&nbsp;&nbsp; от &nbsp;&nbsp;&nbsp; --","1а")}
        ${L("Продавец", esc(s.name),"2")}${L("Адрес", esc(s.address),"2а")}${L("ИНН/КПП продавца", esc(s.inn+(s.kpp?"/"+s.kpp:"")),"2б")}
        ${L("Грузоотправитель и его адрес","он же","3")}
        ${L("Грузополучатель и его адрес", esc([c.name, d.ship || firstAddr(c) || c.address].filter(Boolean).join(", ")),"4")}
        ${L("К платежно-расчетному документу №","&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; от","5")}
        ${L("Документ об отгрузке", esc("Универсальный передаточный документ № "+d.number+" от "+fd(d.date)),"5а")}
        ${L("Счет-фактура на аванс", "","5б")}
        ${L("Покупатель", esc(c.name),"6")}${L("Адрес", esc(c.address),"6а")}${L("ИНН/КПП покупателя", esc((c.inn||"")+(c.kpp?"/"+c.kpp:"")),"6б")}
        ${L("Валюта: наименование, код","Российский рубль, 643","7")}
        ${L("Идентификатор государственного контракта, договора (соглашения) (при наличии)", esc(c.ikz||""),"8")}
      </table></td></tr></table>`;
  const footer = `
  <table class="updsig"><tr>
    <td class="updleft sm">Документ составлен на<br>${listWord(pages.length)}</td>
    <td style="padding-left:6px">${isIP(s)
      ? `<div class="s3" style="grid-template-columns:30% 1fr 1fr"><span>Индивидуальный предприниматель<br>или иное уполномоченное лицо</span><div><div class="u sgu">&nbsp;${SGI(ALL(k))}</div><div class="cap">(подпись)</div></div><div><div class="u">${esc(sign)}</div><div class="cap">(ф.и.о.)</div></div></div>
         <div class="u" style="margin-top:4px">ОГРНИП ${esc(s.ogrn)}${s.ogrnDate?" от "+fd(s.ogrnDate):""}</div><div class="cap">(ОГРНИП и дата его присвоения)</div>`
      : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div class="s3" style="grid-template-columns:40% 1fr 1fr"><span>Руководитель организации или иное уполномоченное лицо</span><div><div class="u sgu">&nbsp;${SGI(k)}</div><div class="cap">(подпись)</div></div><div><div class="u">${esc(sign)}</div><div class="cap">(ф.и.о.)</div></div></div><div class="s3" style="grid-template-columns:40% 1fr 1fr"><span>Главный бухгалтер или иное уполномоченное лицо</span><div><div class="u">&nbsp;</div><div class="cap">(подпись)</div></div><div><div class="u">${esc(s.accountant||sign)}</div><div class="cap">(ф.и.о.)</div></div></div></div>`}
    </td></tr></table>
  <div style="border-top:1.5px solid #000;margin:5px 0"></div>
  <table class="updh">
    <tr><td class="lab nobr">Основание передачи (сдачи) / получения (приемки)</td><td class="u v">${esc(d.basis)}</td><td class="sm n">[8]</td></tr>
    <tr><td class="lab"></td><td class="cap">(договор; доверенность и др.)</td><td></td></tr>
    <tr><td class="lab nobr">Данные о транспортировке и грузе</td><td class="u v"></td><td class="sm n">[9]</td></tr>
    <tr><td class="lab"></td><td class="cap">(транспортная накладная, поручение экспедитору, экспедиторская / складская расписка и др. / масса нетто/ брутто груза, если не приведены ссылки на транспортные документы, содержащие эти сведения)</td><td></td></tr>
  </table>
  <table class="upd2"><tr><td class="l">
      <div>Товар (груз) передал / услуги, результаты работ, права сдал</div>
      ${sig4(isIP(s)?"Индивидуальный предприниматель":"", sign, 10, k)}
      <div class="udl">Дата отгрузки, передачи (сдачи) <span class="u ib">${fdl(d.date)}</span> <span class="sm">[11]</span></div>
      <div>Иные сведения об отгрузке, передаче</div><div class="u">&nbsp;</div><div class="cap">(ссылки на неотъемлемые приложения, сопутствующие документы, иные документы и т.п.) <span class="sm">[12]</span></div>
      <div>Ответственный за правильность оформления факта хозяйственной жизни</div>
      ${sig4(isIP(s)?"Индивидуальный предприниматель":"", sign, 13, ALL(k))}
      <div>Наименование экономического субъекта – составителя документа (в т.ч. комиссионера / агента)</div>
      <div class="u">${esc(s.name+(s.inn?", ИНН "+s.inn:""))}</div><div class="cap">(может не заполняться при проставлении печати в М.П., может быть указан ИНН / КПП) <span class="sm">[14]</span></div>
      <div class="mpu">${STI(k,"upd")}М.П.</div></td>
    <td class="r2">
      <div>Товар (груз) получил / услуги, результаты работ, права принял</div>
      ${sig4("", "", 15)}
      <div class="udl">Дата получения (приемки) <span class="u ib">"&nbsp;&nbsp;&nbsp;&nbsp;" _____________ 20&nbsp;&nbsp;&nbsp; г.</span> <span class="sm">[16]</span></div>
      <div>Иные сведения о получении, приемке</div><div class="u">&nbsp;</div><div class="cap">(информация о наличии/отсутствии претензии; ссылки на неотъемлемые приложения, и другие документы и т.п.) <span class="sm">[17]</span></div>
      <div>Ответственный за правильность оформления факта хозяйственной жизни</div>
      ${sig4("", "", 18)}
      <div>Наименование экономического субъекта – составителя документа</div>
      <div class="u">${esc(c.name+(c.inn?", ИНН/КПП "+c.inn+(c.kpp?"/"+c.kpp:""):""))}</div><div class="cap">(может не заполняться при проставлении печати в М.П., может быть указан ИНН / КПП) <span class="sm">[19]</span></div>
      <div class="mpu">М.П.</div></td></tr></table>`;
  return pages.map((ls,i)=>{
    const last=i===pages.length-1;
    const rows=ls.map(l=>{ const ru=!l.country||(l.country==="643" && !k.t12);
      return `<tr class="m-row"><td class="nobr">${esc(l.code)||"--"}</td><td class="r">${l.n}</td><td>${esc(l.name)}</td><td class="c">--</td><td class="c">${l.okei}</td><td class="c">${esc(l.unit)}</td><td class="r">${l.qty.toFixed(3).replace(".",",")}</td><td class="r">${fm(l.priceNet)}</td><td class="r">${fm(l.net)}</td><td class="c nobr">без акциза</td><td class="c">${k.rate?k.rate+"%":"без НДС"}</td><td class="r">${k.rate?fm(l.vat):"без НДС"}</td><td class="r">${fm(l.sum)}</td><td class="c">${ru?"--":l.country}</td><td class="c">${ru?"--":esc(COUNTRIES[l.country]||"")}</td><td class="c">--</td><td class="c">--</td><td class="c">--</td><td class="c">--</td></tr>`; }).join("");
    const total = last ? `<tr class="tot"><td colspan="8" class="b">Всего к оплате (9)</td><td class="r b">${fm(k.t.net)}</td><td colspan="2" class="c">Х</td><td class="r b">${k.rate?fm(k.t.vat):"без НДС"}</td><td class="r b">${fm(k.t.sum)}</td><td colspan="6" class="nb"></td></tr>` : "";
    return `<div class="doc upd" lang="ru"><div class="m-head">${i===0?head:""}</div>${pages.length>1?`<div class="pgno">Страница ${i+1}</div>`:""}<table class="g items">${thead}<tbody>${rows}${total}</tbody></table><div class="m-foot">${last?footer:""}</div></div>`;
  });
}
function sig4(pos, name, n, k){ return `<div class="s4"><div><div class="u">${esc(pos)}</div><div class="cap">(должность)</div></div><div><div class="u sgu">&nbsp;${SGI(k)}</div><div class="cap">(подпись)</div></div><div><div class="u">${esc(name)}</div><div class="cap">(ф.и.о.)</div></div><span class="sm">[${n}]</span></div>`; }

/* раскладка по листам по реальной высоте строк (A4 альбом, поля 8 мм) */
function layout(k, f){
  // Короткая ТОРГ-12 целиком на одном листе: длинные реквизиты не должны
  // выталкивать вторую строку и подписи. Печать/PDF вписывают лист в A4.
  const box=document.getElementById("fd-measure"),single=f(k,[k.lines]); box.innerHTML=single[0];
  if(k.lines.length<=2 && box.querySelector('.doc.t12')){box.innerHTML='';return single;}
  const mm=px=>px*25.4/96, h=e=>e?mm(e.getBoundingClientRect().height):0;
  const head=h(box.querySelector(".m-head")), foot=h(box.querySelector(".m-foot")), th=h(box.querySelector("table.items thead"));
  const tots=[...box.querySelectorAll("tr.tot")].map(h), tot=tots[0]||0, grand=tots.slice(1).reduce((a,b)=>a+b,0);
  const rows=[...box.querySelectorAll("tr.m-row")].map(h); box.innerHTML="";
  if(window.__fdDbg) window.__fdDbg.push({head,foot,th,tot,grand,rows});
  const H=194-8, pages=[]; let cur=[], used=0, cap=H-head-th-tot;
  k.lines.forEach((l,i)=>{ if(cur.length && used+rows[i]>cap){ pages.push(cur); cur=[]; used=0; cap=H-th-tot; } cur.push(l); used+=rows[i]; });
  /* подписи не помещаются под последними строками — переносим на новый лист только последнюю строку (вместе с итогом и подписями), а текущий лист остаётся заполненным */
  const moved=[]; if(used+grand+foot>cap && (cur.length>1 || pages.length)){ const l=cur.pop(); used-=rows[l.n-1]; moved.unshift(l); }
  if(cur.length) pages.push(cur); if(moved.length) pages.push(moved);
  return f(k,pages);
}
