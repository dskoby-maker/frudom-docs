const http=require('http'), fs=require('fs'), vm=require('vm');
const sheets={}, props={}, files={}; let fileN=0;
function mkSheet(name){ const data=[]; const sh={name,data,
  getLastRow:()=>{ let n=data.length; while(n>0 && (!data[n-1]||data[n-1].every(v=>v===''||v==null))) n--; return n; },
  getMaxRows:()=>1000, setFrozenRows(){}, deleteRows(r,n){ data.splice(r-1,n); },
  getRange(r,c,nr,nc){ if(typeof r==='string') return {setNumberFormat(){return this}};
    return { setNumberFormat(){return this}, setFontWeight(){return this},
      setValues(v){ for(let i=0;i<nr;i++){ data[r-1+i]=data[r-1+i]||[]; for(let j=0;j<nc;j++) data[r-1+i][c-1+j]=String(v[i][j]); } return this; },
      getDisplayValues(){ const o=[]; for(let i=0;i<nr;i++){ const row=[]; for(let j=0;j<nc;j++) row.push(((data[r-1+i]||[])[c-1+j])??''); o.push(row);} return o; },
      clearContent(){ for(let i=0;i<nr;i++) if(data[r-1+i]) for(let j=0;j<nc;j++) data[r-1+i][c-1+j]=''; return this; } }; } };
  return sh; }
const ss={ getSheetByName:n=>sheets[n]||null, insertSheet:n=>(sheets[n]=mkSheet(n)) };
const ctx={ SpreadsheetApp:{getActive:()=>ss}, LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{MimeType:{JSON:'json'}, createTextOutput:t=>({t, setMimeType(){return this}})}, JSON, String, Math, Object, parseInt, Date, isNaN, Array, Session:{getScriptTimeZone:()=>'Europe/Moscow'}, PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v;}})},
  DriveApp:{ createFolder:n=>({getId:()=>'fold1',isTrashed:()=>false,createFile:b=>{ const id='f'+(++fileN); files[id]=b; return {getId:()=>id}; }}), getFolderById:id=>({isTrashed:()=>false,createFile:b=>{ const fid='f'+(++fileN); files[fid]=b; return {getId:()=>fid}; }}),
    getFileById:id=>{ if(id==='1u-vIEVcVgk69ttd48kn3yzI-cA5pJn4b' && process.env.PLIST){ const buf=fs.readFileSync(process.env.PLIST); return {getName:()=>'Прайс лист Фруктовый Дом.xlsx', getLastUpdated:()=>fs.statSync(process.env.PLIST).mtime, getMimeType:()=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', getBlob:()=>({getBytes:()=>buf})}; }
      if(!files[id]) throw new Error('nofile'); return {getBlob:()=>files[id], setTrashed:()=>{ delete files[id]; }}; } }, Utilities:{ base64Decode:d=>Buffer.from(d,'base64'), base64Encode:b=>Buffer.from(b).toString('base64'), newBlob:(bytes,type,name)=>({getBytes:()=>bytes,getContentType:()=>type,name}), formatDate:(d,tz,f)=>{ const m=new Date(d.getTime()+3*3600000), p=n=>String(n).padStart(2,'0'); if(f==='yyyy-MM-dd') return m.getUTCFullYear()+'-'+p(m.getUTCMonth()+1)+'-'+p(m.getUTCDate()); return p(m.getUTCDate())+'.'+p(m.getUTCMonth()+1)+'.'+m.getUTCFullYear()+' '+p(m.getUTCHours())+':'+p(m.getUTCMinutes())+':'+p(m.getUTCSeconds()); }} };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../Code.template.gs'),'utf8').replace(/pass: 'ПАРОЛЬ'/g,(()=>{let i=0;const P=['1111','2222','3333','4444'];return ()=>"pass: '"+P[i++]+"'";})()).replace("'СМЕНИТЕ-ЭТОТ-ПАРОЛЬ'","'test123'"), ctx);
http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){ res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-headers':'*'}); res.end(); return; }
  const u=new URL(req.url,'http://x');
  if(u.pathname.startsWith('/page')){ res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); res.end(fs.readFileSync(require('path').join(__dirname,'../out/test.html'))); return; }
  if(u.pathname==='/dump'){ res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(Object.fromEntries(Object.entries(sheets).map(([k,v])=>[k,v.data])))); return; }
  let body=''; req.on('data',d=>body+=d); req.on('end',()=>{
    const out = req.method==='POST' ? ctx.doPost({postData:{contents:body}}) : ctx.doGet({parameter:Object.fromEntries(u.searchParams)});
    res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'}); res.end(out.t); });
}).listen(8787);
console.log('up');
