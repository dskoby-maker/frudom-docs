/* Почта в посреднике (dev/tbank-proxy/index.js): тестовые IMAP и SMTP серверы (TLS, самоподписанный сертификат).
   Проверяет: вход, чтение новых писем (кодировки 1251/KOI8/UTF-8, quoted-printable, вложения с русскими именами, письмо только в HTML),
   «не помечать прочитанным», вложение отдельно, отправку и копию в «Отправленные», неверный пароль. Запуск: node test/mail-proxy.cjs */
const tls=require('tls'), fs=require('fs'), os=require('os'), path=require('path'), {execSync}=require('child_process');
process.env.MAIL_INSECURE='1'; process.env.SECRET='s3cr3t-0123456789abcdef';
const P=require('../tbank-proxy/index.js'), T=P._t;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mlt-')); execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/k.pem -out ${dir}/c.pem -days 2 -subj /CN=localhost 2>/dev/null`);
const key=fs.readFileSync(dir+'/k.pem'), cert=fs.readFileSync(dir+'/c.pem');
let fails=0; const ok=(c,m)=>{ console.log((c?'OK  ':'FAIL')+' '+m); if(!c) fails++; };
const b64=s=>Buffer.from(s).toString('base64');
const M1=Buffer.from(['From: =?windows-1251?B?'+Buffer.from([0xcc,0xc3,0xd3]).toString('base64')+'?= <zakaz@msu.ru>','To: info@frudom.ru','Subject: =?koi8-r?B?'+Buffer.from([0xfa,0xc1,0xd1,0xd7,0xcb,0xc1]).toString('base64')+'?= na 14.11','Date: Thu, 12 Nov 2026 09:15:00 +0300','Message-ID: <m1@msu.ru>','MIME-Version: 1.0',
 'Content-Type: multipart/mixed; boundary="XX"','','--XX','Content-Type: text/plain; charset=windows-1251','Content-Transfer-Encoding: quoted-printable','','=CF=EE=EC=E8=E4=EE=F0=FB 10 =EA=E3','=CE=E3=F3=F0=F6=FB 5 =EA=E3 =','=EF=F0=EE=E4=EE=EB=E6=E5=ED=E8=E5','--XX',
 "Content-Type: application/pdf; name=\"x.pdf\"","Content-Disposition: attachment; filename*=UTF-8''%D0%B7%D0%B0%D1%8F%D0%B2%D0%BA%D0%B0.pdf",'Content-Transfer-Encoding: base64','',b64('%PDF-1.4 test'),'--XX--',''].join('\r\n'),'latin1');
const M2=Buffer.from(['From: "Цирк" <buh@circus.ru>','To: frudom.ru@mail.ru','Subject: Акт сверки','Date: Thu, 12 Nov 2026 11:00:00 +0300','Content-Type: text/html; charset=utf-8','Content-Transfer-Encoding: base64','',b64('<html><body><p>Добрый день!</p><p>Пришлите <b>акт</b>&nbsp;сверки</p></body></html>'),''].join('\r\n'),'utf8');
const BOX={uidv:777, msgs:[{uid:5,raw:M1,seen:false},{uid:9,raw:M2,seen:false}], appended:[], sent:[]};
/* IMAP: LOGIN, SELECT, UID SEARCH, UID FETCH (BODY.PEEK[]), LIST, APPEND, LOGOUT */
const imap=tls.createServer({key,cert},s=>{ s.write('* OK test imap\r\n'); let buf='', app=null, auth=false;
  s.on('data',d=>{ if(app){ app.b=Buffer.concat([app.b,d]); if(app.b.length>=app.n+2){ BOX.appended.push({box:app.box, raw:app.b.subarray(0,app.n)}); s.write(app.tag+' OK APPEND done\r\n'); app=null; } return; }
    buf+=d.toString('latin1'); let i; while((i=buf.indexOf('\r\n'))>=0){ const l=buf.slice(0,i); buf=buf.slice(i+2); const [tag,cmd,...r]=l.split(' '), rest=r.join(' ');
      if(/^LOGIN$/i.test(cmd)){ if(rest==='"user@test" "app-pass"'){ auth=true; s.write(tag+' OK logged\r\n'); } else s.write(tag+' NO [AUTHENTICATIONFAILED] Invalid credentials\r\n'); }
      else if(!auth) s.write(tag+' BAD login first\r\n');
      else if(/^SELECT$/i.test(cmd)) s.write(`* ${BOX.msgs.length} EXISTS\r\n* OK [UIDVALIDITY ${BOX.uidv}] UIDs\r\n${tag} OK [READ-WRITE] SELECT done\r\n`);
      else if(/^UID$/i.test(cmd) && /^SEARCH/i.test(rest)){ const m=rest.match(/UID (\d+):\*/); let L=BOX.msgs.map(x=>x.uid); if(m){ L=L.filter(u=>u>=+m[1]); if(!L.length) L=[BOX.msgs[BOX.msgs.length-1].uid]; } s.write(`* SEARCH ${L.join(' ')}\r\n${tag} OK SEARCH done\r\n`); }
      else if(/^UID$/i.test(cmd) && /^FETCH/i.test(rest)){ const set=rest.split(' ')[1].split(',').map(Number);
        if(/RFC822\.SIZE/i.test(rest)){ set.forEach((u,i)=>{ const x=BOX.msgs.find(y=>y.uid===u); if(x) s.write(`* ${i+1} FETCH (UID ${u} RFC822.SIZE ${x.raw.length})\r\n`); }); s.write(tag+' OK FETCH done\r\n'); BOX.sizeAsks=(BOX.sizeAsks||0)+1; }
        else { const u=set[0], x=BOX.msgs.find(y=>y.uid===u), pm=rest.match(/<0\.(\d+)>/); if(x){ if(!/PEEK/.test(rest)) x.seen=true; const body=pm?x.raw.subarray(0,+pm[1]):x.raw; if(pm) BOX.partial=(BOX.partial||0)+1;
          s.write(`* 1 FETCH (UID ${u} BODY[]${pm?'<0>':''} {${body.length}}\r\n`); for(let o=0;o<body.length;o+=16384) s.write(body.subarray(o,o+16384)); s.write(')\r\n'); } s.write(tag+' OK FETCH done\r\n'); } }
      else if(/^LIST$/i.test(cmd)) s.write(`* LIST (\\HasNoChildren) "/" "INBOX"\r\n* LIST (\\HasNoChildren \\Sent) "/" "&BB4EQgQ,BEAEMAQyBDsENQQ9BD0ESwQ1-"\r\n${tag} OK LIST done\r\n`);
      else if(/^APPEND$/i.test(cmd)){ const m=rest.match(/^"([^"]+)".*\{(\d+)\}$/); app={tag, box:m[1], n:+m[2], b:Buffer.alloc(0)}; s.write('+ Ready\r\n'); if(buf.length){ app.b=Buffer.from(buf,'latin1'); buf=''; } }
      else if(/^LOGOUT$/i.test(cmd)){ s.write('* BYE\r\n'+tag+' OK\r\n'); s.end(); }
      else s.write(tag+' BAD unknown\r\n'); } }); s.on('error',()=>{}); });
/* SMTP: EHLO, AUTH PLAIN, MAIL, RCPT, DATA, QUIT */
const smtp=tls.createServer({key,cert},s=>{ s.write('220 test smtp\r\n'); let buf='', data=null, cur={};
  s.on('data',d=>{ buf+=d.toString('latin1'); let i; while((i=buf.indexOf('\r\n'))>=0){ const l=buf.slice(0,i); buf=buf.slice(i+2);
    if(data!=null){ if(l==='.'){ BOX.sent.push(Object.assign(cur,{raw:data})); data=null; cur={}; s.write('250 queued\r\n'); } else data+=l.replace(/^\.\./,'.')+'\r\n'; continue; }
    if(/^EHLO/i.test(l)) s.write('250-test\r\n250 AUTH PLAIN LOGIN\r\n');
    else if(/^AUTH PLAIN/i.test(l)) s.write(Buffer.from(l.split(' ')[2],'base64').toString()==='\0user@test\0app-pass'?'235 ok\r\n':'535 5.7.8 auth failed\r\n');
    else if(/^MAIL FROM/i.test(l)){ cur.from=l; s.write('250 ok\r\n'); } else if(/^RCPT TO/i.test(l)){ (cur.to=cur.to||[]).push(l); s.write('250 ok\r\n'); }
    else if(/^DATA/i.test(l)){ data=''; s.write('354 go\r\n'); } else if(/^QUIT/i.test(l)){ s.write('221 bye\r\n'); s.end(); } else s.write('500 ?\r\n'); } }); s.on('error',()=>{}); });
const call=async(p)=>{ const r=await P.handler({headers:{'X-Proxy-Key':process.env.SECRET}, body:JSON.stringify(p)}); return JSON.parse(r.body); };
(async()=>{ await new Promise(r=>imap.listen(0,r)); await new Promise(r=>smtp.listen(0,r));
  const acc={user:'user@test', pass:'app-pass', email:'user@test', ih:'localhost', ip:imap.address().port, sh:'localhost', sp:smtp.address().port};
  const pg=await call({path:'/ping'}); ok(pg.proxy===2 && pg.mail===2, 'ping: новая версия посредника с почтой');
  const t=await call({path:'/mail/test', acc}); ok(t.imap==='ok' && t.smtp==='ok' && t.uidv===777, 'вход в IMAP и SMTP '+JSON.stringify(t));
  const bad=await call({path:'/mail/test', acc:Object.assign({},acc,{pass:'wrong'})}); ok(/не пустил/.test(bad.imap) && /не пустил/.test(bad.smtp), 'неверный пароль — понятная ошибка: '+bad.imap+' / '+bad.smtp);
  const f=await call({path:'/mail/fetch', acc, since:0, days:3650}); ok(f.msgs && f.msgs.length===2 && f.last===9 && f.uidv===777, 'первая загрузка: 2 письма, последний UID 9');
  const a=f.msgs[0]; ok(a.from.n==='МГУ' && a.from.a==='zakaz@msu.ru', 'отправитель в windows-1251: '+JSON.stringify(a.from));
  ok(a.subject==='Заявка na 14.11', 'тема в KOI8-R: '+a.subject);
  ok(/Помидоры 10 кг\nОгурцы 5 кг продолжение/.test(a.text), 'текст 1251 quoted-printable с мягким переносом: '+JSON.stringify(a.text));
  ok(a.atts.length===1 && a.atts[0].name==='заявка.pdf' && Buffer.from(a.atts[0].data,'base64').toString()==='%PDF-1.4 test', 'вложение с русским именем (RFC 2231)');
  ok(f.msgs[1].text==='Добрый день!\nПришлите акт сверки' && /<b>акт<\/b>/.test(f.msgs[1].html), 'письмо только в HTML → текст: '+JSON.stringify(f.msgs[1].text));
  ok(BOX.msgs.every(x=>!x.seen), 'письма в ящике не помечены прочитанными');
  const f2=await call({path:'/mail/fetch', acc, since:9, uidv:777}); ok(f2.msgs.length===0 && f2.last===9, 'повтор — новых писем нет');
  const f3=await call({path:'/mail/fetch', acc, since:9, uidv:1}); ok(f3.msgs.length===2, 'сменился UIDVALIDITY — загрузка заново');
  /* импорт старой почты: письмо 15 МБ — берётся только начало (текст), функция не падает; следующее письмо приходит тоже */
  const BIG=Buffer.from(['From: Old <old@x.ru>','To: info@frudom.ru','Subject: Old big','Date: Wed, 07 Aug 2024 10:00:00 +0300','Content-Type: multipart/mixed; boundary="BB"','','--BB','Content-Type: text/plain; charset=utf-8','','Старая заявка с большим вложением','--BB','Content-Type: application/zip; name="big.zip"','Content-Disposition: attachment; filename="big.zip"','Content-Transfer-Encoding: base64','',Buffer.alloc(11*1048576,7).toString('base64').replace(/.{76}/g,'$&\r\n'),'--BB--',''].join('\r\n'),'utf8');
  BOX.msgs.push({uid:12, raw:BIG, seen:false}, {uid:13, raw:M2, seen:false});
  const fb=await call({path:'/mail/fetch', acc, since:9, uidv:777}); const bm=(fb.msgs||[]).find(x=>x.uid===12);
  ok(bm && bm.big===1 && /Письмо очень большое \(1[45],\d МБ\)/.test(bm.text) && /Старая заявка/.test(bm.text) && bm.atts.length===0 && BOX.partial===1, 'большое письмо: только текст и пометка '+JSON.stringify(bm&&{t:bm.text.slice(0,90), a:bm.atts.length, s:bm.size}));
  ok(fb.msgs.length===2 && fb.last===13, 'письмо после большого тоже пришло, last=13');
  const fbig=await call({path:'/mail/att', acc, uid:12, idx:0}); ok(/больше 2,5 МБ|40 МБ/.test(fbig.error||''), 'вложение большого письма — понятная ошибка, без падения: '+fbig.error);
  BOX.msgs.splice(2);
  const at=await call({path:'/mail/att', acc, uid:5, idx:0}); ok(at.name==='заявка.pdf' && Buffer.from(at.data,'base64').toString()==='%PDF-1.4 test', 'вложение отдельно');
  const s=await call({path:'/mail/send', acc:Object.assign({fromName:'Фруктовый Дом'},acc), msg:{to:['МГУ <zakaz@msu.ru>'], subject:'Re: Заявка', text:'Здравствуйте!\n.точка в начале строки\nПринято.', inReply:'<m1@msu.ru>', refs:'<m1@msu.ru>', fromName:'Фруктовый Дом', atts:[{name:'счёт.pdf', mime:'application/pdf', data:b64('%PDF x')}]}});
  ok(s.ok && s.saved && /^<.+@test>$/.test(s.msgid), 'отправлено и сохранено в «Отправленные» '+JSON.stringify(s));
  const raw=BOX.sent[0]&&BOX.sent[0].raw; ok(BOX.sent.length===1 && /RCPT TO:<zakaz@msu.ru>/.test(BOX.sent[0].to[0]), 'SMTP: получатель zakaz@msu.ru');
  const back=T.mimeMsg(Buffer.from(raw,'latin1')); ok(back.subject==='Re: Заявка' && back.text==='Здравствуйте!\n.точка в начале строки\nПринято.' && back.atts[0].name==='счёт.pdf' && back.from.n==='Фруктовый Дом', 'отправленное письмо читается обратно (тема, текст с точкой, вложение, имя)');
  ok(BOX.appended[0] && BOX.appended[0].box==='&BB4EQgQ,BEAEMAQyBDsENQQ9BD0ESwQ1-' && /In-Reply-To: <m1@msu.ru>/.test(BOX.appended[0].raw.toString('latin1')), 'копия в папке \\Sent с In-Reply-To');
  const ns=await call({path:'/mail/send', acc, msg:{to:[], subject:'x'}}); ok(/получатель/.test(ns.error), 'без получателя — ошибка');
  const nx=await P.handler({headers:{'X-Proxy-Key':'bad'}, body:'{}'}); ok(nx.statusCode===403, 'чужой секрет — 403');
  imap.close(); smtp.close(); console.log('ИТОГ:', fails?fails+' ошибок':'ошибок нет'); process.exit(fails?1:0);
})().catch(e=>{ console.log('FAIL', e); process.exit(1); });
