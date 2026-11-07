/* Магазин «Фруктовый Дом» (тестовая страница frudom.ru/test).
   Подключается на Тильде блоком HTML: <div id="fd-shop"></div> + этот скрипт (см. shop/tilda-block.html).
   Товары и цены — массив PRODUCTS ниже. price — розница за кг, opt — опт за кг (от OPT_MIN кг). null — «по запросу». */
(function () {
  "use strict";
  var OPT_MIN = 5;
  var PHONE = "+79998330553", PHONE_TXT = "+7 999 833-05-53", MAIL = "info@frudom.ru";
  var CATS = ["Все", "Орехи", "Сухофрукты", "Ягоды", "Цукаты", "Сладости", "Семена"];
  var PRODUCTS = [
    { id: "kuraga", name: "Курага", origin: "Узбекистан", cat: "Сухофрукты", tint: "#FFF1E2", price: null, opt: null },
    { id: "chernosliv", name: "Чернослив без косточки", origin: "Чили", cat: "Сухофрукты", tint: "#F3ECF7", price: null, opt: null },
    { id: "finiki", name: "Финики", origin: "Иран", cat: "Сухофрукты", tint: "#F6EEDF", price: null, opt: null },
    { id: "inzhir", name: "Инжир", origin: "Турция", cat: "Сухофрукты", tint: "#FBE9EA", price: null, opt: null },
    { id: "izyum", name: "Изюм", origin: "Узбекистан", cat: "Сухофрукты", tint: "#FFF6D9", price: null, opt: null },
    { id: "keshyu", name: "Кешью", origin: "Вьетнам", cat: "Орехи", tint: "#FFF6D9", price: null, opt: null },
    { id: "mindal", name: "Миндаль", origin: "США", cat: "Орехи", tint: "#F6EEDF", price: null, opt: null },
    { id: "funduk", name: "Фундук", origin: "Азербайджан", cat: "Орехи", tint: "#F4F6F1", price: null, opt: null },
    { id: "gretskiy", name: "Грецкий орех", origin: "Чили", cat: "Орехи", tint: "#F6EEDF", price: null, opt: null },
    { id: "fistashki", name: "Фисташки", origin: "Иран", cat: "Орехи", tint: "#E7F2E7", price: null, opt: null },
    { id: "smes", name: "Ореховая смесь", origin: "Своя фасовка", cat: "Орехи", tint: "#E7F2E7", price: null, opt: null },
    { id: "shipovnik", name: "Шиповник", origin: "Россия", cat: "Ягоды", tint: "#FBE9EA", price: null, opt: null }
  ];

  var root = document.getElementById("fd-shop");
  if (!root || root.getAttribute("data-ready")) return;
  root.setAttribute("data-ready", "1");
  var me = document.currentScript && document.currentScript.src;
  var BASE = me ? me.replace(/[^\/?#]*([?#].*)?$/, "") : "./";
  var LOGO = BASE + "logo.png";

  var KEY = "frudom-shop-cart";
  var S = { mode: "retail", cat: "Все", cart: {} };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && saved.cart) { S.cart = saved.cart; S.mode = saved.mode === "opt" ? "opt" : "retail"; } } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ cart: S.cart, mode: S.mode })); } catch (e) {} }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ") + " ₽"; }
  function byId(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }
  function step() { return S.mode === "opt" ? OPT_MIN : 1; }
  function unitPrice(p, kg) { var o = p.opt != null && (S.mode === "opt" || kg >= OPT_MIN); return o ? p.opt : p.price; }
  function plural(n, a, b, c) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }

  var ICON = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    bag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11H6.2z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    truck: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
    phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  var CSS = [
    "#fd-shop{--ink:#1B2418;--muted:#4F5A4B;--muted2:#5B6657;--line:#E3E8DE;--line2:#D9E0D3;--soft:#F4F6F1;--green:#2E7D32;--green-d:#1B5E20;--orange:#E69A46;--peach:#FFF1E2;",
    "font-family:'Onest',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.45;color:var(--ink);background:#fff;-webkit-font-smoothing:antialiased;text-align:left}",
    "#fd-shop *,#fd-shop *::before,#fd-shop *::after{box-sizing:border-box}",
    "#fd-shop h1,#fd-shop h2,#fd-shop p{margin:0}",
    "#fd-shop a{color:inherit}",
    "#fd-shop button{font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    "#fd-shop .w{max-width:1200px;margin:0 auto;padding:0 24px}",
    "@media(max-width:600px){#fd-shop .w{padding:0 16px}}",
    "#fd-shop .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    /* шапка */
    "#fd-shop .hd{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}",
    "#fd-shop .hd .w{min-height:72px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 28px;padding-top:10px;padding-bottom:10px}",
    "#fd-shop .logo{display:inline-flex;align-items:center;gap:10px;font-size:17px;font-weight:700;letter-spacing:-.02em;text-decoration:none}",
    "#fd-shop .logo img{width:48px;height:48px;border-radius:50%;display:block}",
    "#fd-shop .nav{display:flex;gap:4px 22px;font-size:14px}",
    "#fd-shop .nav a{text-decoration:none;color:var(--muted)}#fd-shop .nav a:hover{color:var(--green)}",
    "#fd-shop .srch{flex:1 1 220px;min-width:0;height:44px;display:flex;align-items:center;gap:10px;padding:0 14px;border-radius:12px;background:var(--soft);color:#7A8076}",
    "#fd-shop .srch input{flex:1;min-width:0;border:0;background:transparent;font:inherit;color:var(--ink);outline:none;-webkit-appearance:none}",
    "#fd-shop .srch:focus-within{box-shadow:0 0 0 2px var(--green)}",
    "#fd-shop .tel{display:inline-flex;align-items:center;gap:6px;font-weight:600;text-decoration:none;font-size:14px}",
    "#fd-shop .cartb{height:44px;padding:0 14px;border:0;border-radius:12px;background:var(--peach);color:var(--ink);font-weight:600;font-size:14px;display:inline-flex;align-items:center;gap:8px}",
    "#fd-shop .cartb b{min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:var(--orange);font-size:12px;display:none;align-items:center;justify-content:center}",
    "#fd-shop .cartb.has b{display:inline-flex}",
    "@media(max-width:760px){#fd-shop .nav,#fd-shop .tel span{display:none}#fd-shop .hd .w{gap:10px 8px}#fd-shop .srch{order:5;flex-basis:100%}#fd-shop .logo{margin-right:auto}#fd-shop .tel{width:44px;height:44px;justify-content:center}}",
    "@media(max-width:420px){#fd-shop .cartb>span{display:none}#fd-shop .logo{font-size:16px}}",
    /* главный блок */
    "#fd-shop main{display:flex;flex-direction:column;gap:64px;padding-bottom:96px}",
    "#fd-shop .hero{margin-top:28px;padding:clamp(22px,4vw,48px);border-radius:28px;background:var(--green);color:#fff;display:flex;flex-wrap:wrap;gap:28px 40px;align-items:center}",
    "#fd-shop .hero .t{flex:1 1 320px;display:flex;flex-direction:column;gap:18px}",
    "#fd-shop .hero h1{font-size:clamp(28px,5vw,48px);line-height:1.06;font-weight:700;letter-spacing:-.035em}",
    "#fd-shop .hero p{max-width:460px;font-size:17px;line-height:1.55;color:#E4F1E4}",
    "#fd-shop .hero .cta{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center}",
    "#fd-shop .btn{height:48px;padding:0 22px;border:0;border-radius:12px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}",
    "#fd-shop .btn-w{background:#fff;color:var(--green-d)}",
    "#fd-shop .btn-g{background:var(--green);color:#fff}",
    "#fd-shop .btn-o{background:var(--orange);color:var(--ink)}",
    "#fd-shop .btn-l{background:#fff;color:var(--ink);border:1px solid var(--line2)}",
    "#fd-shop .lnk{display:inline-flex;gap:6px;font-weight:600;text-decoration:none;color:#fff;transition:gap .2s}#fd-shop .lnk:hover{gap:10px}",
    "#fd-shop .pic{flex:1 1 320px;position:relative;height:clamp(200px,32vw,380px);border-radius:20px;background:var(--peach);overflow:hidden;display:flex;align-items:flex-end;padding:18px}",
    "#fd-shop .pic .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8C8F86;font-size:13px}",
    "#fd-shop .pic .tag{position:relative;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;background:#fff;color:var(--ink);font-size:14px;font-weight:600;box-shadow:0 6px 18px rgba(27,36,24,.1);animation:fdsFloat 4s ease-in-out infinite}",
    "#fd-shop .pic .tag svg{color:var(--green)}",
    /* условия */
    "#fd-shop .terms{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 24px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}",
    "#fd-shop .terms div{padding:18px 0;display:flex;flex-direction:column;gap:3px}",
    "#fd-shop .terms b{font-weight:600}#fd-shop .terms span{font-size:14px;color:var(--muted2)}",
    /* каталог */
    "#fd-shop .ch{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;justify-content:space-between}",
    "#fd-shop h2{font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1.15}",
    "@media(max-width:600px){#fd-shop h2{font-size:22px}}",
    "#fd-shop .seg{position:relative;display:grid;grid-template-columns:1fr 1fr;width:230px;padding:3px;border-radius:12px;background:var(--soft)}",
    "#fd-shop .seg i{position:absolute;top:3px;left:3px;width:calc(50% - 3px);height:38px;border-radius:9px;background:#fff;box-shadow:0 1px 3px rgba(27,36,24,.12);transition:transform .32s cubic-bezier(.3,.7,.2,1)}",
    "#fd-shop .seg.is-opt i{transform:translateX(100%)}",
    "#fd-shop .seg button{position:relative;z-index:1;height:38px;border:0;border-radius:9px;background:transparent;font-size:14px;font-weight:600;color:#7A8076;transition:color .25s}",
    "#fd-shop .seg button[aria-pressed=true]{color:var(--ink)}",
    "#fd-shop .chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0;scrollbar-width:none}#fd-shop .chips::-webkit-scrollbar{display:none}",
    "@media(max-width:600px){#fd-shop .chips{margin:0 -16px;padding:2px 16px}}",
    "#fd-shop .chip{flex:none;height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--line2);background:#fff;color:var(--ink);font-size:14px;transition:background-color .2s,color .2s,border-color .2s,transform .15s}",
    "#fd-shop .chip[aria-pressed=true]{background:var(--green);border-color:var(--green);color:#fff}",
    "#fd-shop .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(210px,calc(50% - 8px)),1fr));gap:28px 16px}",
    "@media(max-width:600px){#fd-shop .grid{gap:22px 12px}}",
    "#fd-shop .card{display:flex;flex-direction:column;gap:10px;min-width:0;animation:fdsUp .55s cubic-bezier(.2,.7,.2,1) both}",
    "#fd-shop .img{border-radius:18px;overflow:hidden}",
    "#fd-shop .img div{position:relative;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;color:#8C8F86;font-size:12px;transition:transform .6s cubic-bezier(.2,.7,.2,1)}",
    "@supports not (aspect-ratio:1/1){#fd-shop .img div{height:0;padding-bottom:100%}}",
    "#fd-shop .card:hover .img div{transform:scale(1.03)}",
    "#fd-shop .img em{position:absolute;left:10px;top:10px;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.92);font-size:12px;font-style:normal;color:var(--muted)}",
    "#fd-shop .nm{font-weight:500;line-height:1.35;min-height:40px}",
    "#fd-shop .row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px}",
    "#fd-shop .pr{display:flex;flex-direction:column;min-width:0}",
    "#fd-shop .pr b{font-size:18px;font-weight:700;letter-spacing:-.01em}#fd-shop .pr b.na{font-size:15px;font-weight:600;color:var(--muted)}",
    "#fd-shop .pr span{font-size:12px;color:var(--muted2)}",
    "#fd-shop .add{flex:none;width:44px;height:44px;border:0;border-radius:12px;background:var(--green);color:#fff;display:inline-flex;align-items:center;justify-content:center;animation:fdsPop .28s cubic-bezier(.2,.8,.3,1.15) both}",
    "#fd-shop .stp{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;height:44px;border-radius:12px;background:var(--green);color:#fff;animation:fdsPop .28s cubic-bezier(.2,.8,.3,1.15) both}",
    "#fd-shop .stp button{height:44px;border:0;background:transparent;color:inherit;font-size:19px}",
    "#fd-shop .stp span{text-align:center;font-size:14px;font-weight:600}",
    "#fd-shop .empty{grid-column:1/-1;padding:40px 0;text-align:center;color:var(--muted2)}",
    "#fd-shop .btn,#fd-shop .add,#fd-shop .chip,#fd-shop .cartb,#fd-shop .stp button{transition:transform .15s ease,box-shadow .2s ease,background-color .2s,color .2s}",
    "#fd-shop .btn:active,#fd-shop .add:active,#fd-shop .chip:active,#fd-shop .cartb:active,#fd-shop .stp button:active{transform:scale(.95)}",
    "@media(hover:hover){#fd-shop .btn:hover,#fd-shop .add:hover{box-shadow:0 4px 14px rgba(27,36,24,.14)}}",
    "#fd-shop :focus-visible{outline:2px solid var(--orange);outline-offset:2px}",
    /* опт */
    "#fd-shop .opt{border-radius:24px;background:var(--soft);padding:clamp(20px,4vw,36px);display:flex;flex-wrap:wrap;gap:20px 32px;align-items:center;justify-content:space-between}",
    "#fd-shop .opt .t{flex:1 1 320px;display:flex;flex-direction:column;gap:8px}",
    "#fd-shop .opt h2{font-size:22px}#fd-shop .opt p{color:var(--muted);line-height:1.55}",
    "#fd-shop .opt .a{display:flex;flex-wrap:wrap;gap:10px}",
    "@media(max-width:600px){#fd-shop .opt .a{width:100%}#fd-shop .opt .a .btn{flex:1 1 140px}}",
    /* подвал */
    "#fd-shop .ft{border-top:1px solid var(--line)}",
    "#fd-shop .ft .w{padding-top:28px;padding-bottom:28px;display:flex;flex-wrap:wrap;gap:16px 40px;font-size:14px;color:var(--muted);align-items:center}",
    "#fd-shop .ft .logo{flex:1 1 200px;font-size:15px}#fd-shop .ft .logo img{width:40px;height:40px}",
    /* панель корзины и окно */
    "#fd-shop .bar{position:fixed;left:50%;bottom:16px;z-index:30;width:min(560px,calc(100% - 24px));transform:translate(-50%,140%);opacity:0;transition:transform .4s cubic-bezier(.2,.8,.2,1),opacity .3s}",
    "#fd-shop .bar.on{transform:translate(-50%,0);opacity:1}",
    "#fd-shop .bar button{width:100%;height:58px;border:0;border-radius:16px;background:var(--green);color:#fff;font-weight:600;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 18px;box-shadow:0 10px 28px rgba(27,36,24,.24)}",
    "#fd-shop .bar .l{display:inline-flex;align-items:center;gap:10px}",
    "#fd-shop .bar .r{height:42px;padding:0 16px;border-radius:12px;background:var(--orange);color:var(--ink);font-weight:700;display:inline-flex;align-items:center}",
    "#fd-shop .ov{position:fixed;inset:0;z-index:40;background:rgba(27,36,24,.4);display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s}",
    "#fd-shop .ov.on{opacity:1;pointer-events:auto}",
    "#fd-shop .sh{width:min(560px,100%);max-height:86vh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;padding:20px 20px 24px;transform:translateY(40px);transition:transform .35s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;gap:16px}",
    "#fd-shop .ov.on .sh{transform:none}",
    "@media(min-width:640px){#fd-shop .ov{align-items:center}#fd-shop .sh{border-radius:24px}}",
    "#fd-shop .sh .top{display:flex;align-items:center;justify-content:space-between}",
    "#fd-shop .sh .x{width:44px;height:44px;border:0;border-radius:12px;background:var(--soft);display:inline-flex;align-items:center;justify-content:center}",
    "#fd-shop .ln{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}",
    "#fd-shop .ln i{width:44px;height:44px;border-radius:10px;flex:none}",
    "#fd-shop .ln div{flex:1;min-width:0;display:flex;flex-direction:column}#fd-shop .ln small{color:var(--muted2);font-size:13px}",
    "#fd-shop .ln .stp{width:132px;flex:none}",
    "#fd-shop .note{padding:14px;border-radius:14px;background:var(--peach);font-size:14px;line-height:1.5}",
    "#fd-shop .tot{display:flex;justify-content:space-between;font-size:17px;font-weight:700}",
    "@keyframes fdsUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
    "@keyframes fdsPop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}",
    "@keyframes fdsFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}",
    "@media(prefers-reduced-motion:reduce){#fd-shop *{animation:none!important;transition:none!important}}"
  ].join("\n");

  if (!document.getElementById("fd-shop-font")) {
    var lk = document.createElement("link"); lk.id = "fd-shop-font"; lk.rel = "stylesheet";
    lk.href = "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap";
    document.head.appendChild(lk);
  }
  var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

  root.innerHTML =
    '<header class="hd"><div class="w">' +
      '<a class="logo" href="#fds-top"><img src="' + LOGO + '" alt="" width="48" height="48">Фруктовый Дом</a>' +
      '<nav class="nav" aria-label="Разделы"><a href="#fds-catalog">Каталог</a><a href="#fds-opt">Оптом</a><a href="#fds-contacts">Контакты</a></nav>' +
      '<label class="srch">' + ICON.search + '<span class="sr">Поиск по товарам</span><input type="search" data-q placeholder="Курага, кешью, финики" autocomplete="off"></label>' +
      '<a class="tel" href="tel:' + PHONE + '" aria-label="Позвонить ' + PHONE_TXT + '">' + ICON.phone + '<span>' + PHONE_TXT + '</span></a>' +
      '<button type="button" class="cartb" data-open>' + ICON.bag + '<span>Корзина</span><b data-count>0</b></button>' +
    '</div></header>' +
    '<main class="w" id="fds-top">' +
      '<section class="hero"><div class="t">' +
        '<h1>Орехи и сухофрукты напрямую от поставщика</h1>' +
        '<p>От 1 кг для дома, от ' + OPT_MIN + ' кг — по оптовой цене. Доставка по Москве и области на следующий день.</p>' +
        '<div class="cta"><a class="btn btn-w" href="#fds-catalog">Перейти в каталог</a><a class="lnk" href="#fds-opt">Оптовый прайс<span aria-hidden="true">→</span></a></div>' +
      '</div><div class="pic"><span class="ph">фото: орехи и сухофрукты</span><span class="tag">' + ICON.truck + 'Привезём завтра</span></div></section>' +
      '<section class="terms" aria-label="Условия">' +
        '<div><b>Розница от 1 кг</b><span>Без наценки маркетплейсов</span></div>' +
        '<div><b>Опт от ' + OPT_MIN + ' кг</b><span>Ниже цена за каждый килограмм</span></div>' +
        '<div><b>Доставка завтра</b><span>Москва и область или самовывоз</span></div>' +
        '<div><b>Документы для бизнеса</b><span>Счёт, накладная, УПД</span></div>' +
      '</section>' +
      '<section id="fds-catalog" style="display:flex;flex-direction:column;gap:20px">' +
        '<div class="ch"><h2>Каталог</h2><div class="seg" role="group" aria-label="Какие цены показать"><i aria-hidden="true"></i>' +
          '<button type="button" data-mode="retail">Розница</button><button type="button" data-mode="opt">Опт от ' + OPT_MIN + ' кг</button></div></div>' +
        '<div class="chips">' + CATS.map(function (c) { return '<button type="button" class="chip" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join("") + '</div>' +
        '<div class="grid" data-grid></div>' +
      '</section>' +
      '<section class="opt" id="fds-opt"><div class="t"><h2>Закупаете для кафе или учреждения?</h2>' +
        '<p>Пришлём оптовый прайс и условия договора. Работаем с НДС и без НДС, поставки по Москве и области.</p></div>' +
        '<div class="a"><a class="btn btn-g" href="tel:' + PHONE + '">Позвонить</a><a class="btn btn-l" href="mailto:' + MAIL + '?subject=' + encodeURIComponent("Оптовый прайс") + '">Написать на почту</a></div></section>' +
    '</main>' +
    '<footer class="ft" id="fds-contacts"><div class="w">' +
      '<span class="logo"><img src="' + LOGO + '" alt="" width="40" height="40">Фруктовый Дом</span>' +
      '<a href="tel:' + PHONE + '">' + PHONE_TXT + '</a><a href="mailto:' + MAIL + '">' + MAIL + '</a>' +
      '<span>Москва, Мелитопольская ул., 1к2с2</span><span>Пн–пт 9:00–18:00, сб 9:00–17:00</span>' +
    '</div></footer>' +
    '<div class="bar" data-bar><button type="button" data-open><span class="l">' + ICON.bag + '<span data-bartxt></span></span><span class="r">Оформить</span></button></div>' +
    '<div class="ov" data-ov role="dialog" aria-modal="true" aria-label="Корзина"><div class="sh" data-sheet></div></div>';

  var $ = function (s) { return root.querySelector(s); };
  var grid = $("[data-grid]"), seg = $(".seg"), qInput = $("[data-q]"), ov = $("[data-ov]");
  var lastFocus = null;

  function priceHtml(p) {
    var v = S.mode === "opt" ? p.opt : p.price;
    if (v == null) return '<b class="na">Цена по запросу</b><span>' + (S.mode === "opt" ? "опт от " + OPT_MIN + " кг" : "за кг") + '</span>';
    return '<b>' + money(v) + '</b><span>' + (S.mode === "opt" ? "за кг · от " + OPT_MIN + " кг" : "за кг") + '</span>';
  }
  function stepperHtml(p, q) {
    return '<div class="stp"><button type="button" data-minus="' + p.id + '" aria-label="Меньше: ' + esc(p.name) + '">−</button><span>' + q + ' кг</span><button type="button" data-plus="' + p.id + '" aria-label="Больше: ' + esc(p.name) + '">+</button></div>';
  }
  function cardActs(p) {
    var q = S.cart[p.id] || 0;
    return '<div class="row"><div class="pr" data-pr>' + priceHtml(p) + '</div>' +
      (q ? '' : '<button type="button" class="add" data-plus="' + p.id + '" aria-label="Добавить: ' + esc(p.name) + '">' + ICON.plus + '</button>') + '</div>' +
      (q ? stepperHtml(p, q) : '');
  }
  function visible() {
    var q = (qInput.value || "").trim().toLowerCase();
    return PRODUCTS.filter(function (p) { return (S.cat === "Все" || p.cat === S.cat) && (!q || p.name.toLowerCase().indexOf(q) >= 0); });
  }
  function drawGrid() {
    var list = visible();
    grid.innerHTML = list.length ? list.map(function (p, i) {
      return '<article class="card" data-card="' + p.id + '" style="animation-delay:' + Math.min(i, 10) * 50 + 'ms">' +
        '<div class="img"><div style="background:' + p.tint + '">фото<em>' + esc(p.origin) + '</em></div></div>' +
        '<span class="nm">' + esc(p.name) + '</span><div data-acts>' + cardActs(p) + '</div></article>';
    }).join("") : '<p class="empty">Ничего не нашли. Попробуйте другое название или позвоните нам.</p>';
  }
  function drawCard(id) {
    var el = grid.querySelector('[data-card="' + id + '"] [data-acts]');
    if (el) el.innerHTML = cardActs(byId(id));
  }
  function drawControls() {
    seg.classList.toggle("is-opt", S.mode === "opt");
    root.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === S.mode)); });
    root.querySelectorAll("[data-cat]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-cat") === S.cat)); });
  }
  function totals() {
    var ids = Object.keys(S.cart).filter(function (k) { return S.cart[k] > 0 && byId(k); });
    var kg = 0, sum = 0, unknown = false;
    ids.forEach(function (k) { var q = S.cart[k], p = byId(k), u = unitPrice(p, q); kg += q; if (u == null) unknown = true; else sum += u * q; });
    return { ids: ids, kg: kg, sum: sum, unknown: unknown };
  }
  function drawCart() {
    var t = totals(), n = t.ids.length;
    var cb = $(".cartb"); cb.classList.toggle("has", n > 0); $("[data-count]").textContent = n;
    $("[data-bar]").classList.toggle("on", n > 0 && !ov.classList.contains("on"));
    $("[data-bartxt]").textContent = n + " " + plural(n, "товар", "товара", "товаров") + " · " + t.kg + " кг" + (t.sum && !t.unknown ? " · " + money(t.sum) : "");
    if (ov.classList.contains("on")) drawSheet();
  }
  function drawSheet() {
    var t = totals();
    var html = '<div class="top"><h2 style="font-size:22px">Корзина</h2><button type="button" class="x" data-close aria-label="Закрыть">' + ICON.close + '</button></div>';
    if (!t.ids.length) html += '<p style="color:var(--muted)">Пока пусто. Добавьте товары кнопкой «+».</p>';
    else {
      html += '<div>' + t.ids.map(function (k) {
        var p = byId(k), q = S.cart[k], u = unitPrice(p, q);
        return '<div class="ln"><i style="background:' + p.tint + '" aria-hidden="true"></i><div><span>' + esc(p.name) + '</span><small>' + (u == null ? "цена по запросу" : money(u) + " за кг · " + money(u * q)) + '</small></div>' + stepperHtml(p, q) + '</div>';
      }).join("") + '</div>';
      html += '<div class="tot"><span>Итого, ' + t.kg + ' кг</span><span>' + (t.unknown ? (t.sum ? "от " + money(t.sum) : "по запросу") : money(t.sum)) + '</span></div>';
      html += '<p class="note">Онлайн-оплата скоро появится. Сейчас заказ можно оформить по телефону — назовите товары из корзины, менеджер подтвердит цену и время доставки.</p>';
      html += '<a class="btn btn-g" href="tel:' + PHONE + '">' + ICON.phone + 'Позвонить ' + PHONE_TXT + '</a>';
      html += '<button type="button" class="btn btn-l" data-clear>Очистить корзину</button>';
    }
    $("[data-sheet]").innerHTML = html;
  }
  function openSheet() {
    lastFocus = document.activeElement; drawSheet(); ov.classList.add("on"); drawCart();
    var x = ov.querySelector("[data-close]"); if (x) x.focus();
  }
  function closeSheet() { ov.classList.remove("on"); drawCart(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  function setQty(id, q) {
    var p = byId(id); if (!p) return;
    if (q <= 0) delete S.cart[id]; else S.cart[id] = q;
    save(); drawCard(id); drawCart();
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("button") : null;
    if (!t || !root.contains(t)) return;
    var id;
    if ((id = t.getAttribute("data-plus"))) { var q = S.cart[id] || 0; setQty(id, q ? q + 1 : step()); }
    else if ((id = t.getAttribute("data-minus"))) { var q2 = (S.cart[id] || 0) - 1; setQty(id, q2 < step() && S.mode === "opt" ? 0 : q2); }
    else if (t.hasAttribute("data-mode")) { S.mode = t.getAttribute("data-mode"); save(); drawControls(); grid.querySelectorAll("[data-card]").forEach(function (c) { drawCard(c.getAttribute("data-card")); }); drawCart(); }
    else if (t.hasAttribute("data-cat")) { S.cat = t.getAttribute("data-cat"); drawControls(); drawGrid(); }
    else if (t.hasAttribute("data-open")) openSheet();
    else if (t.hasAttribute("data-close")) closeSheet();
    else if (t.hasAttribute("data-clear")) { S.cart = {}; save(); drawGrid(); drawCart(); }
  });
  ov.addEventListener("click", function (e) { if (e.target === ov) closeSheet(); });
  root.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov.classList.contains("on")) closeSheet(); });
  var qt; qInput.addEventListener("input", function () { clearTimeout(qt); qt = setTimeout(drawGrid, 150); });

  drawControls(); drawGrid(); drawCart();
})();
