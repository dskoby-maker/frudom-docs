const http=require('http'), fs=require('fs'), vm=require('vm');
const sheets={}, props={}, files={}, backups=[]; let fileN=0;
const bkFile=b=>({getId:()=>b.id,getName:()=>b.name,getDateCreated:()=>b.at,getSize:()=>12345,getUrl:()=>'https://drive/'+b.id,isTrashed:()=>!!b.trash,setTrashed:v=>{ b.trash=v; }});
/* папка Диска: createFile и поиск по имени (склад: повтор загрузки декларации не создаёт второй файл) */
const FAKE_PDF=(()=>{ const o=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>'];
  let t='%PDF-1.4\n'; const off=[]; o.forEach((x,i)=>{ off.push(t.length); t+=(i+1)+' 0 obj\n'+x+'\nendobj\n'; });
  const xr=t.length; t+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n'+off.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(o.length+1)+' /Root 1 0 R >>\nstartxref\n'+xr+'\n%%EOF\n'; return Buffer.from(t,'latin1'); })();
const mkFolder=()=>({getId:()=>'fold1',isTrashed:()=>false,getUrl:()=>'https://drive/folder',getFiles:()=>{ const L=backups.slice(); let i=0; return {hasNext:()=>i<L.length, next:()=>bkFile(L[i++])}; },createFile:b=>{ const id='f'+(++fileN); files[id]=b; return {getId:()=>id, setTrashed:()=>{ delete files[id]; }}; },
  getFilesByName:n=>{ const L=Object.keys(files).filter(k=>files[k]&&files[k].name===n); let i=0; return {hasNext:()=>i<L.length, next:()=>{ const id=L[i++]; return {getId:()=>id}; }}; }});
function mkSheet(name){ const data=[]; const sh={name,data,
  getLastRow:()=>{ let n=data.length; while(n>0 && (!data[n-1]||data[n-1].every(v=>v===''||v==null))) n--; return n; },
  getMaxRows:()=>1000, setFrozenRows(){}, deleteRows(r,n){ data.splice(r-1,n); },
  getRange(r,c,nr,nc){ if(typeof r==='string') return {setNumberFormat(){return this}};
    return { setNumberFormat(){return this}, setFontWeight(){return this},
      setValues(v){ for(let i=0;i<nr;i++){ data[r-1+i]=data[r-1+i]||[]; for(let j=0;j<nc;j++) data[r-1+i][c-1+j]=String(v[i][j]); } return this; },
      getDisplayValues(){ const o=[]; for(let i=0;i<nr;i++){ const row=[]; for(let j=0;j<nc;j++) row.push(((data[r-1+i]||[])[c-1+j])??''); o.push(row);} return o; },
      clearContent(){ for(let i=0;i<nr;i++) if(data[r-1+i]) for(let j=0;j<nc;j++) data[r-1+i][c-1+j]=''; return this; } }; } };
  return sh; }
const ss={ getId:()=>'SS1', getSheetByName:n=>sheets[n]||null, insertSheet:n=>(sheets[n]=mkSheet(n)) };
const ctx={ SpreadsheetApp:{getActive:()=>ss}, LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){},tryLock(){return true}})},
  ContentService:{MimeType:{JSON:'json'}, createTextOutput:t=>({t, setMimeType(){return this}})}, JSON, String, Math, Object, parseInt, Date, isNaN, Array, Session:{getScriptTimeZone:()=>'Europe/Moscow'}, PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v;},deleteProperty:k=>{delete props[k];}})},
  ScriptApp:{ getOAuthToken:()=>'tok-test' },
  UrlFetchApp:{ fetch:(url,o)=>{ if(/googleapis\.com\/drive\/v3\/files\//.test(url)){   /* тестовый Google Диск: копия в формат Google → PDF; ctx.__conv = {n, fail} */
      const cv=ctx.__conv=ctx.__conv||{n:0}, m=url.match(/files\/([^/?]+)\/(copy|export)/)||[];
      if(cv.fail) return {getResponseCode:()=>500, getContentText:()=>'{}'};
      if(m[2]==='copy'){ if(!files[m[1]]) return {getResponseCode:()=>404, getContentText:()=>'{}'}; const nid='g'+(++fileN); files[nid]={getBytes:()=>Buffer.alloc(0)}; cv.last=JSON.parse(o.payload); return {getResponseCode:()=>200, getContentText:()=>JSON.stringify({id:nid})}; }
      cv.n++; cv.exp=m[1]; return {getResponseCode:()=>200, getBlob:()=>({getBytes:()=>FAKE_PDF})}; }
    const tbFake=(u,tok)=>{ const tb=ctx.__tb||{}, T=(tb.tokens||{})[tok]; globalThis.__tbCalls=(globalThis.__tbCalls||0)+1;   /* тестовый Т-Бизнес: ctx.__tb = {tokens:{токен:{accounts, ops}}, sslFail, proxy:{key}} */
      if(!T) return {code:401, text:'{"errorMessage":"unauthorized"}'};
      if(/bank-accounts/.test(u)) return {code:200, text:JSON.stringify(T.accounts.map(a=>({accountNumber:a,currency:'643',name:'Расчётный'})))};
      if(/statement/.test(u)){ const acc=new URL('https://x'+u.replace(/^https?:\/\/[^/]+/,'')).searchParams.get('accountNumber'); return {code:200, text:JSON.stringify({operations:(T.ops||[]).filter(x=>!x.acc||x.acc===acc)})}; }
      return {code:404, text:'{}'}; };
    if(/business\.tbank\.ru/.test(url)){ if((ctx.__tb||{}).sslFail) throw new Error('Ошибка SSL: '+url);
      const r=tbFake(url, (((o&&o.headers)||{}).Authorization||'').replace('Bearer ','')); return {getResponseCode:()=>r.code,getContentText:()=>r.text}; }
    if(/functions\.yandexcloud\.net/.test(url)){ const px=(ctx.__tb||{}).proxy||{}, k=((o&&o.headers)||{})['X-Proxy-Key'];
      if(!px.key) return {getResponseCode:()=>404,getContentText:()=>'not found'};
      if(k!==px.key) return {getResponseCode:()=>403,getContentText:()=>'{"error":"wrong secret"}'};
      const b=JSON.parse(o.payload||'{}'); if(b.path==='/ping') return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(ctx.__mail?{ok:true,proxy:2,mail:1}:{ok:true,proxy:1})};
      if(/^\/mail\//.test(b.path)){ const R=x=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(x)});   /* тестовая почта: ctx.__mail = {boxes:{логин:{pass, uidv, msgs:[письма как отдаёт посредник]}}, sent:[]} */
        if(!ctx.__mail) return {getResponseCode:()=>400,getContentText:()=>'{"error":"path not allowed"}'};
        const a=b.acc||{}, B=ctx.__mail.boxes[a.user]; if(!B||B.pass!==a.pass) return R(b.path==='/mail/test'?{imap:'ящик не пустил: Invalid credentials — проверьте логин и пароль для внешних приложений', smtp:'сервер отправки не пустил'}:{error:'ящик не пустил: Invalid credentials'});
        if(b.path==='/mail/test') return R({imap:'ok', smtp:'ok', exists:B.msgs.length, uidv:B.uidv});
        if(b.path==='/mail/fetch'){ const since=String(b.uidv)===String(B.uidv)?(+b.since||0):0, L=B.msgs.filter(m=>m.uid>since).sort((x,y)=>x.uid-y.uid), take=L.slice(0, b.max||15);
          return R({uidv:B.uidv, last:take.length?take[take.length-1].uid:since, more:L.length>take.length, msgs:JSON.parse(JSON.stringify(take)).map(m=>{ m.atts=(m.atts||[]).map(x=>{ if(x.big){ delete x.data; } return x; }); return m; })}); }
        if(b.path==='/mail/att'){ const m=B.msgs.find(x=>x.uid===+b.uid), x=m&&m.atts[+b.idx||0]; return R(x?{name:x.name,mime:x.mime,size:x.size,data:x.data}:{error:'вложение не найдено'}); }
        if(b.path==='/mail/send'){ ctx.__mail.sent.push(b); return R({ok:true, saved:true, msgid:'<t'+ctx.__mail.sent.length+'@test>'}); }
        return R({error:'?'}); }
      ctx.__pxCalls=(ctx.__pxCalls||0)+1; const r=tbFake(b.path, b.token); return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({code:r.code, body:r.text})}; }
    const fake=process.env.AI_FAKE?fs.readFileSync(process.env.AI_FAKE,'utf8'):'{}'; const key=(o&&o.headers||{})['x-goog-api-key'];
    if(/api\.anthropic\.com/.test(url)){ const ck=(o&&o.headers||{})['x-api-key']; if(ck==='sk-ant-bad-key-000000000000') return {getResponseCode:()=>401,getContentText:()=>'{"type":"error","error":{"type":"authentication_error"}}'};
      if(/\/v1\/models/.test(url)) return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({data:[{id:'claude-sonnet-5-5',display_name:'Claude Sonnet 5.5'},{id:'claude-haiku-5-5',display_name:'Claude Haiku 5.5'}]})};
      const bd=JSON.parse(o.payload); if(bd.model==='claude-nope') return {getResponseCode:()=>404,getContentText:()=>'{"error":{"type":"not_found_error"}}'};
      if(ck==='sk-ant-poor-key-00000000000') return {getResponseCode:()=>400,getContentText:()=>'{"error":{"message":"Your credit balance is too low"}}'};
      globalThis.__lastClaude=bd; const fk=process.env.AI_FAKE?fs.readFileSync(process.env.AI_FAKE,'utf8'):'{}';
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({content:[{type:'text',text:'```json\n'+fk+'\n```'}],usage:{input_tokens:1000,output_tokens:111}})}; }
    if(/\/models\?/.test(url)) return key==='bad'?{getResponseCode:()=>403,getContentText:()=>'{}'}:{getResponseCode:()=>200,getContentText:()=>JSON.stringify({models:[{name:'models/gemini-flash-latest',displayName:'Gemini Flash Latest',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.8-flash',displayName:'Gemini 3.8 Flash',supportedGenerationMethods:['generateContent']},{name:'models/text-embedding-004',supportedGenerationMethods:['embedContent']}]})};
    if(/models\/nope:/.test(url)) return {getResponseCode:()=>404,getContentText:()=>'{"error":{"message":"not found"}}'};
    const code=/:generateContent$/.test(url)?(key==='bad'?403:200):200, t=code===200?JSON.stringify({candidates:[{content:{parts:[{text:fake}]}}],usageMetadata:{totalTokenCount:1234}}):'{"error":{"message":"API key not valid"}}';
    return {getResponseCode:()=>code, getContentText:()=>t}; } },
  /* папка заказчика с актами: ctx.__dir = {id, name, files:[{id, name, mime, b64, at}]} (тест dev/test/akt-dir.py) */
  DriveApp:{ createFolder:n=>mkFolder(), getFolderById:id=>{ const d=ctx.__dir; if(d && id===d.id) return {getId:()=>d.id, getName:()=>d.name, getUrl:()=>'https://drive.google.com/drive/folders/'+d.id, isTrashed:()=>false,
        getFiles:()=>{ const L=d.files.slice(); let i=0; return {hasNext:()=>i<L.length, next:()=>{ const f=L[i++]; return {getId:()=>f.id, getName:()=>f.name, getMimeType:()=>f.mime, getLastUpdated:()=>new Date(f.at||'2026-11-06T10:00:00Z'), getSize:()=>Buffer.from(f.b64,'base64').length, isTrashed:()=>false}; }}; } };
      if(/^DIR/.test(id)) throw new Error('no folder'); return mkFolder(); },
    getFileById:id=>{ const d=ctx.__dir, df=d && d.files.find(f=>f.id===id); if(df){ files[id]={getBytes:()=>Buffer.from(df.b64,'base64')};
        return {getName:()=>df.name, getMimeType:()=>df.mime, getBlob:()=>({getBytes:()=>Buffer.from(df.b64,'base64'), getContentType:()=>df.mime}), getParents:()=>{ let k=0; return {hasNext:()=>k<1, next:()=>{ k++; return {getId:()=>d.id}; }}; }}; }
      if(id==='SS1') return {makeCopy:(n)=>{ const b={id:'bk'+(backups.length+1), name:n, at:new Date(Date.now()+backups.length)}; backups.push(b); return bkFile(b); }};
      if(id==='1u-vIEVcVgk69ttd48kn3yzI-cA5pJn4b' && process.env.PLIST){ const buf=fs.readFileSync(process.env.PLIST); return {getName:()=>'Прайс лист Фруктовый Дом.xlsx', getLastUpdated:()=>fs.statSync(process.env.PLIST).mtime, getMimeType:()=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', getBlob:()=>({getBytes:()=>buf})}; }
      if(!files[id]) throw new Error('nofile'); return {getBlob:()=>files[id], setTrashed:()=>{ delete files[id]; }}; } }, Utilities:{ getUuid:()=>require('crypto').randomUUID(), base64Decode:d=>Buffer.from(d,'base64'), base64Encode:b=>Buffer.from(b).toString('base64'), newBlob:(bytes,type,name)=>({getBytes:()=>bytes,getContentType:()=>type,name,getDataAsString:()=>Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes)}), formatDate:(d,tz,f)=>{ const m=new Date(d.getTime()+3*3600000), p=n=>String(n).padStart(2,'0'); if(f==='yyyy-MM-dd') return m.getUTCFullYear()+'-'+p(m.getUTCMonth()+1)+'-'+p(m.getUTCDate()); return p(m.getUTCDate())+'.'+p(m.getUTCMonth()+1)+'.'+m.getUTCFullYear()+' '+p(m.getUTCHours())+':'+p(m.getUTCMinutes())+':'+p(m.getUTCSeconds()); }} };
vm.createContext(ctx); vm.runInContext((fs.readFileSync(require('path').join(__dirname,'../Passwords.template.gs'),'utf8')+'\n'+fs.readFileSync(require('path').join(__dirname,'../Code.template.gs'),'utf8')).replace(/pass: 'ПАРОЛЬ'/g,(()=>{let i=0;const P=['1111','2222','3333','4444'];return ()=>"pass: '"+P[i++]+"'";})()).replace("'СМЕНИТЕ-ЭТОТ-ПАРОЛЬ'","'test123'"), ctx);
http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){ res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'*'}); res.end(); return; }
  const u=new URL(req.url,'http://x');
  if(u.pathname.startsWith('/page')){ res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); res.end(fs.readFileSync(require('path').join(__dirname,'../out/test.html'),'utf8').split('http://localhost:8787/exec').join('http://'+(req.headers.host||'localhost:8787')+'/exec')); return; }
  if(u.pathname==='/files'){ res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(Object.keys(files).map(k=>({id:k,name:files[k]&&files[k].name})))); return; }
  /* только для тестов: выполнить код внутри «Apps Script» (например, оборвать операцию на середине) */
  if(u.pathname==='/eval'){ let b=''; req.on('data',d=>b+=d); req.on('end',()=>{ vm.runInContext('Object.keys(MEMO_).forEach(k=>delete MEMO_[k]); Object.keys(SH_).forEach(k=>delete SH_[k]);',ctx); let r; try{ r=vm.runInContext(b,ctx); }catch(e){ r='ERR '+e.message; } res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(r===undefined?null:r)); }); return; }
  if(u.pathname==='/dump'){ res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(Object.fromEntries(Object.entries(sheets).map(([k,v])=>[k,v.data])))); return; }
  let body=''; req.on('data',d=>body+=d); req.on('end',()=>{
    vm.runInContext('Object.keys(MEMO_).forEach(k=>delete MEMO_[k]); Object.keys(SH_).forEach(k=>delete SH_[k]);',ctx);
    const out = req.method==='POST' ? ctx.doPost({postData:{contents:body}}) : ctx.doGet({parameter:Object.fromEntries(u.searchParams)});
    res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'}); res.end(out.t); });
}).listen(+process.env.PORT||8787);
console.log('up');
