/* Мост сайта и приложения Android: скачивание файлов (PDF, Excel, XML), печать, кнопка «Назад». */
(function(){
  if (window.__fdApp || !window.FrudomApp || !document.documentElement || !document.body) return; window.__fdApp = 1;
  var A = window.FrudomApp, blobs = {};
  var oc = URL.createObjectURL;
  URL.createObjectURL = function(o){ var u = oc.apply(URL, arguments); try{ if (o instanceof Blob) blobs[u] = o; }catch(e){} return u; };
  function fail(){ A.toast("Не получилось сохранить файл"); }
  function save(blob, name){ var r = new FileReader();
    r.onload = function(){ var s = String(r.result); A.saveFile(s.slice(s.indexOf(",") + 1), name, blob.type || ""); };
    r.onerror = fail; r.readAsDataURL(blob); }
  function handle(a){
    if (!a || !a.hasAttribute || !a.hasAttribute("download")) return false;
    var href = a.href || a.getAttribute("href") || "", name = a.getAttribute("download") || "";
    if (!name){ try{ name = decodeURIComponent((href.split("?")[0].split("/").pop()) || ""); }catch(e){} }
    if (!name || /^[0-9a-f-]{20,}$/i.test(name)) name = "файл";
    if (href.indexOf("blob:") === 0){ var b = blobs[href]; if (b){ save(b, name); return true; }
      fetch(href).then(function(r){ return r.blob(); }).then(function(b){ save(b, name); }).catch(fail); return true; }
    if (href.indexOf("data:") === 0){ fetch(href).then(function(r){ return r.blob(); }).then(function(b){ save(b, name); }).catch(fail); return true; }
    if (/^https?:/i.test(href)){ A.download(href, name); return true; }
    return false;
  }
  var pc = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){ if (handle(this)) return; return pc.apply(this, arguments); };
  HTMLAnchorElement.prototype.dispatchEvent = function(e){
    if (e && e.type === "click" && handle(this)) return false;
    return EventTarget.prototype.dispatchEvent.call(this, e); };
  document.addEventListener("click", function(e){ var a = e.target && e.target.closest && e.target.closest("a[download]");
    if (a && handle(a)){ e.preventDefault(); e.stopImmediatePropagation(); } }, true);

  /* печать: обычная страница и скрытые рамки (документы печатаются через них) */
  window.print = function(){ A.printPage(document.title || "Документ"); };
  function patchFrame(f){ try{ var w = f.contentWindow; if (!w || w.__fdp) return; w.__fdp = 1;
      w.print = function(){ try{ var d = w.document; A.printHtml("<!doctype html>" + d.documentElement.outerHTML, d.title || document.title || "Документ"); }catch(e){ A.toast("Печать недоступна"); } };
    }catch(e){} }
  function scan(n){ if (!n || n.nodeType !== 1) return;
    if (n.tagName === "IFRAME"){ patchFrame(n); n.addEventListener("load", function(){ patchFrame(n); }); }
    else if (n.querySelectorAll) [].forEach.call(n.querySelectorAll("iframe"), scan); }
  new MutationObserver(function(ms){ ms.forEach(function(m){ [].forEach.call(m.addedNodes, scan); }); })
    .observe(document.documentElement, {childList: true, subtree: true});
  scan(document.documentElement);

  /* кнопка «Назад» телефона: сначала закрыть открытое окно на сайте */
  function shown(sel){ var e = document.querySelector(sel); return e && !e.hidden && e.getClientRects().length ? e : null; }
  function overlays(){ return document.querySelectorAll("dialog[open]").length + ["#pv", "#tsheet", "#fd-lb", "#fd-help", "#fd-conflict"].filter(shown).length; }
  window.__fdBack = function(){
    var d = document.querySelector("dialog[open]"); if (d){ try{ d.close(); }catch(e){ d.removeAttribute("open"); } return true; }
    var n = overlays(); if (n){
      document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", code: "Escape", keyCode: 27, bubbles: true}));
      if (overlays() < n) return true;
      if (shown("#pv")){ var b = document.getElementById("pv-close"); if (b){ b.click(); return true; } }
    }
    return false;
  };

  /* вход для уведомлений: приложение запоминает, кто вошёл, и само спрашивает таблицу о новом (раз в час) */
  var lastAcct = null;
  function acct(){ try{ if (!window.__fd || !__fd.acct || !A.setAccount) return; var a = JSON.stringify(__fd.acct());
      if (a !== lastAcct){ lastAcct = a; A.setAccount(a); } }catch(e){} }
  acct(); setInterval(acct, 4000);
})();
