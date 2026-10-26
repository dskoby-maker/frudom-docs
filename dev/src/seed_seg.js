function seed(){
  const P = (name, unit, country, price) => ({id: uid(), name, unit, country, price});
  const products = [
    P("Изюм Малаяр", "кг", "860", 420), P("Изюм Джамбо золотой", "кг", "860", 520),
    P("Курага", "кг", "762", 560), P("Чернослив без косточки", "кг", "860", 480),
    P("Финики Мазафати", "кг", "364", 450), P("Орех грецкий очищенный", "кг", "860", 890),
    P("Миндаль сырой", "кг", "840", 1050), P("Кешью", "кг", "356", 1190)
  ];
  const sup = (name, fio, extra) => Object.assign({id: uid(), name, fio, inn:"", kpp:"", ogrn:"", address:"", phone:"", bank:"", bik:"", rs:"", ks:"", vat:"none", next:1}, extra||{});
  const suppliers = [
    sup("ИП Скобёлкин Даниил Владимирович", "Скобёлкин Даниил Владимирович", {ogrn:"324774600023327", phone:"+7 (999) 833-05-53"}),
    sup("ИП Суховерхова Анастасия", "Суховерхова Анастасия"),
    sup("ИП Байдаров", "Байдаров")
  ];
  suppliers.forEach(x=>{ x.ogrnDate=""; x.accountant=""; });
  const cus = (name, extra) => Object.assign({id: uid(), name, inn:"", kpp:"", address:"", ship:"", contract:"", ikz:""}, extra||{});
  const customers = [
    cus("ГУП «Большой Московский цирк»"),
    cus("АО «Девелопмент Звенигород»", {contract:"Договор поставки № 2309 от 23.09.2026"})
  ];
  const prices = {};
  prices[customers[0].id] = {[products[0].id]:465, [products[2].id]:610, [products[3].id]:530, [products[5].id]:960};
  prices[customers[1].id] = {[products[0].id]:449, [products[2].id]:598, [products[4].id]:495};
  const D = {suppliers, customers, products, prices, journal:[], demo:true, draft:null};
  migrate(D);
  D.draft = newDraft(D);
  return D;
}
function newDraft(D){
  const s = D.suppliers[0], c = D.customers[0];
  return {id: uid(), supplierId: s.id, customerId: c ? c.id : "", number: String(s.next||1), date: todayISO(), basis: c ? c.contract : "", ship:"", lines:[{productId:"", qty:"", price:""}]};
}
/* реквизиты и товары из накладной 1С № 8 от 23.10.2026 */
function migrate(D){
  if((D.v||1)>=2) return D;
  D.suppliers.forEach(x=>{ ["ogrnDate","accountant"].forEach(k=>{ if(x[k]==null) x[k]=""; });
    if(/^ИП Байдаров$/.test(x.name) && !x.inn) Object.assign(x,{name:"ИП Байдаров Ростислав Владимирович", fio:"Байдаров Ростислав Владимирович", inn:"110208432087",
      phone:"+7(999) 833-05-53 или +7 (926) 479-14-99", bank:'Филиал "Центральный" Банка ВТБ (ПАО)', bik:"044525411", rs:"40802810626640009576", ks:"30101810145250000411", next:9}); });
  D.customers.forEach(x=>{ ["bank","bik","rs","ks"].forEach(k=>{ if(x[k]==null) x[k]=""; }); if(!x.acct) x.acct="bank"; });
  D.products.forEach(x=>{ if(x.code==null) x.code=""; });
  if(!D.customers.some(x=>/КИГМ/.test(x.name))){
    const c={id:uid(), name:"ГБПОУ КИГМ № 23", inn:"7718261509", kpp:"", address:"107564, Город Москва, пр-д Погонный, дом 5", ship:"107564, Город Москва, Орджоникидзе, дом 15",
      contract:"ЭЗК-26-91390881 от 30.09.2026", ikz:"", acct:"treasury", rs:"03224643450000007300", bank:"ОКЦ № 1 ГУ Банка России по ЦФО//УФК ПО Г. МОСКВЕ", bik:"004525988", ks:"40102810545370000003"};
    D.customers.push(c); D.prices[c.id]={};
    [["Пюре ягодное замороженное (клубника)","00-00000216",797.21],["Пюре фруктовое замороженное (манго)","00-00000247",960.73],["Пюре фруктовое замороженное (персик)","00-00000217",1027.66],
     ["Апельсин сушёный, нарезанный","00-00000248",2024.26],["Фрукты (ягоды) протёртые (пюре мандарин)","00-00000235",1230.52]].forEach(([name,code,price])=>{
      let p=D.products.find(x=>x.name===name); if(!p){ p={id:uid(), name, code, unit:"кг", country:"", price}; D.products.push(p); }
      D.prices[c.id][p.id]=String(price); });
  }
  D.v=2; return D;
}
