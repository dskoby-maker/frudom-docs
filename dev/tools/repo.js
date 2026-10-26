const fs=require('fs');
const path=require('path'); const s=fs.readFileSync(process.argv[2]||path.join(__dirname,'../out/min.html'),'utf8');
const m=s.match(/<script>([\s\S]*)<\/script>/);
const markup=s.replace(m[0],'').replace(/<!--\s*=+[^>]*-->/g,'').trim();
const js='/* Документы «Фруктовый Дом» — собрано автоматически, не редактировать вручную */\n(function(){var r=document.getElementById("fd-root");if(!r){r=document.createElement("div");r.id="fd-root";document.body.appendChild(r);}r.innerHTML='+JSON.stringify(markup)+';})();\n'+m[1]+'\n';
const R=path.join(__dirname,'../../')+'/';
fs.writeFileSync(R+'app.js',js);
fs.writeFileSync(R+'index.html','<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Документы ФД</title><meta name="theme-color" content="#5b2a48"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Документы ФД"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" type="image/png" href="favicon.png"><link rel="apple-touch-icon" href="apple-touch-icon.png"></head><body style="margin:0;background:#f4f2ee"><div id="fd-root"></div><script>(function(){var s=document.createElement("script");s.src="app.js?t="+Math.floor(Date.now()/60000);document.body.appendChild(s);if("serviceWorker" in navigator){addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}})();</script></body></html>\n');
//README не трогаем
(()=>{})||fs.writeFileSync(R+'README.md','# Документы «Фруктовый Дом»\n\nГенератор счетов, ТОРГ-12 и УПД. Страница: frudom.ru/1c.\nКод страницы — `app.js` (обновляется автоматически). Данные хранятся в Google Таблице, в этом репозитории их нет.\n');
console.log('app.js', Buffer.byteLength(js));
