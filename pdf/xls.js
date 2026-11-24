// Чтение старых файлов Excel (.xls) для редактора frudom.ru/pdf. Подключается из pdf/tilda_editor.html.
(function(){
// Old Excel 97–2003 (.xls): values, merges and sizes come from SheetJS; fonts, borders, fills and alignment are read from the BIFF8 records.
const XLS_PALETTE=['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','800000','008000','000080','808000','800080','008080','C0C0C0','808080','9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF','000080','FF00FF','FFFF00','00FFFF','800080','800000','008080','0000FF','00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99','3366FF','33CCCC','99CC00','FFCC00','FF9900','FF6600','666699','969696','003366','339966','003300','333300','993300','993366','333399','333333'];
const XLS_BORDER=['','thin','medium','dashed','dotted','thick','double','hair','mediumDashed','dashDot','mediumDashDot','dashDotDot','mediumDashDotDot','slantDashDot'];
function xlsBiff(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=o=>view.getUint16(o,true),u32=o=>view.getUint32(o,true);
 const fonts=[],xfs=[],palette=XLS_PALETTE.slice(),sheets=[];
 const color=(i,fallback)=>i<palette.length&&i!==64&&i!==65?{argb:'FF'+palette[i]}:fallback;
 const text=(o,count)=>{const high=bytes[o]&1;let s='';o++;for(let i=0;i<count;i++,o+=high?2:1)s+=String.fromCharCode(high?u16(o):bytes[o]);return s};
 let pos=0;
 while(pos+4<=bytes.length){const type=u16(pos),len=u16(pos+2),o=pos+4;pos=o+len;if(pos>bytes.length||type===0x0A)break;if(type===0x92&&len>=2){const n=u16(o);for(let i=0;i<n&&8+i<64;i++)palette[8+i]=[0,1,2].map(k=>bytes[o+2+i*4+k].toString(16).padStart(2,'0')).join('').toUpperCase()}}
 pos=0;
 while(pos+4<=bytes.length){const type=u16(pos),len=u16(pos+2),o=pos+4;pos=o+len;if(pos>bytes.length)break;
  if(type===0x0A)break;
  if(type===0x31&&len>=16){const flags=u16(o+2),font={name:text(o+15,bytes[o+14])||'Arial',size:u16(o)/20||10};if(u16(o+6)>=700)font.bold=true;if(flags&2)font.italic=true;if(flags&8)font.strike=true;if(bytes[o+10])font.underline=true;const c=color(u16(o+4));if(c&&c.argb!=='FF000000')font.color=c;fonts.push(font)}
  else if(type===0xE0&&len>=20){
   const ifnt=u16(o),alc=bytes[o+6],trot=bytes[o+7],ind=bytes[o+8],b1=u32(o+10),b2=u32(o+14),fc=u16(o+18),style={};
   const font=fonts[ifnt>=4?ifnt-1:ifnt];if(font)style.font=font;
   const h=['','left','center','right','fill','justify','centerContinuous','distributed'][alc&7],v=['top','middle','bottom','justify','distributed'][(alc>>4)&7];
   const alignment={};if(h)alignment.horizontal=h;if(v&&v!=='bottom')alignment.vertical=v;if(alc&8)alignment.wrapText=true;if(ind&15)alignment.indent=ind&15;if(ind&16)alignment.shrinkToFit=true;if(trot&&trot<=90)alignment.textRotation=trot;else if(trot>90&&trot<=180)alignment.textRotation=90-trot;if(Object.keys(alignment).length)style.alignment=alignment;
   const border={},side=(name,dg,icv)=>{if(dg&&XLS_BORDER[dg])border[name]={style:XLS_BORDER[dg],color:color(icv,{argb:'FF000000'})}};
   side('left',b1&15,(b1>>16)&127);side('right',(b1>>4)&15,(b1>>23)&127);side('top',(b1>>8)&15,b2&127);side('bottom',(b1>>12)&15,(b2>>7)&127);if(Object.keys(border).length)style.border=border;
   if((b2>>>26)===1)style.fill={type:'pattern',pattern:'solid',fgColor:color(fc&127,{argb:'FFFFFFFF'})};
   xfs.push(style);
  }
  else if(type===0x85&&len>=8)sheets.push(u32(o));
 }
 const readSheet=start=>{
  const cells=new Map(),info={breaks:[]};let at=start,depth=0;
  while(at+4<=bytes.length){const type=u16(at),len=u16(at+2),o=at+4;at=o+len;if(at>bytes.length)break;
   if(type===0x809){depth++;continue}if(type===0x0A){if(--depth<=0)break;continue}if(depth>1)continue;
   if([0xFD,0x203,0x27E,0x06,0x201,0x205,0x204].includes(type)&&len>=6)cells.set(u16(o)+':'+u16(o+2),u16(o+4));
   else if(type===0xBD&&len>=6){const r=u16(o),c0=u16(o+2),n=(len-6)/6;for(let i=0;i<n;i++)cells.set(r+':'+(c0+i),u16(o+4+i*6))}
   else if(type===0xBE&&len>=6){const r=u16(o),c0=u16(o+2),n=(len-6)/2;for(let i=0;i<n;i++)cells.set(r+':'+(c0+i),u16(o+4+i*2))}
   else if(type===0xA1&&len>=12){info.paper=u16(o);info.scale=u16(o+2);info.fitW=u16(o+6);info.fitH=u16(o+8);const flags=u16(o+10);if(!(flags&4))info.orientation=flags&2?'portrait':'landscape'}
   else if(type===0x81&&len>=2)info.fit=!!(u16(o)&0x100);
   else if(type===0x83&&len>=2)info.hc=!!u16(o);
   else if(type===0x84&&len>=2)info.vc=!!u16(o);
   else if(type===0x2B&&len>=2)info.grid=!!u16(o);
   else if(type===0x1B&&len>=2){const n=u16(o);for(let i=0;i<n;i++)info.breaks.push(u16(o+2+i*6))}
  }
  return {cells,info};
 };
 return {xfs,sheets:sheets.map(readSheet)};
}
window.frudomXls=async function(file,ExcelJS,loadLib){
 const XLSX=await loadLib('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','XLSX'),buffer=new Uint8Array(await file.arrayBuffer());let book;
 try{book=XLSX.read(buffer,{type:'array',cellStyles:true,cellNF:true,cellFormula:false})}catch(err){throw new Error(/password|encrypt/i.test(err.message)?'Файл защищён паролем. Снимите пароль в Excel и загрузите снова.':'Не удалось прочитать файл .xls. Откройте его в Excel и сохраните как .xlsx.')}
 let biff=null;try{const cfb=XLSX.CFB.read(buffer,{type:'array'}),entry=XLSX.CFB.find(cfb,'Workbook')||XLSX.CFB.find(cfb,'Book');if(entry)biff=xlsBiff(entry.content instanceof Uint8Array?entry.content:Uint8Array.from(entry.content))}catch{biff=null}
 const workbook=new ExcelJS.Workbook(),names=book.Workbook?.Names||[];workbook.properties.date1904=!!book.Workbook?.WBProps?.date1904;
 book.SheetNames.forEach((name,index)=>{
  const src=book.Sheets[name],sheet=workbook.addWorksheet(name.slice(0,31)||'Лист'+(index+1)),meta=book.Workbook?.Sheets?.[index];
  if(meta?.Hidden)sheet.state=meta.Hidden===2?'veryHidden':'hidden';
  const styles=biff?.sheets.length===book.SheetNames.length?biff.sheets[index]:null,info=styles?.info||{};
  for(const key of Object.keys(src)){if(key[0]==='!')continue;const at=XLSX.utils.decode_cell(key),value=src[key],cell=sheet.getCell(at.r+1,at.c+1);
   if(value.t==='n')cell.value=value.v;else if(value.t==='b')cell.value=!!value.v;else if(value.t==='e')cell.value=value.w||'#Н/Д';else if(value.t==='d')cell.value=value.v;else if(value.v!=null&&value.v!=='')cell.value=String(value.v);
   if(value.z&&value.z!=='General'&&value.t==='n')cell.numFmt=value.z;
   if(!styles&&value.s?.patternType==='solid'&&value.s.fgColor?.rgb)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+value.s.fgColor.rgb.slice(-6)}};
  }
  if(styles)for(const [key,ixfe]of styles.cells){const style=biff.xfs[ixfe];if(!style)continue;const [r,c]=key.split(':').map(Number),cell=sheet.getCell(r+1,c+1);
   if(style.font)cell.font=style.font;if(style.alignment)cell.alignment=style.alignment;if(style.border)cell.border=style.border;if(style.fill)cell.fill=style.fill;}
  for(const merge of src['!merges']||[])try{sheet.mergeCells(merge.s.r+1,merge.s.c+1,merge.e.r+1,merge.e.c+1)}catch{}
  (src['!cols']||[]).forEach((col,i)=>{if(!col)return;const column=sheet.getColumn(i+1);if(col.hidden)column.hidden=true;const width=col.width??col.wch;if(width)column.width=width});
  (src['!rows']||[]).forEach((row,i)=>{if(!row)return;const line=sheet.getRow(i+1);if(row.hidden)line.hidden=true;if(row.hpt)line.height=row.hpt});
  const setup=sheet.pageSetup,m=src['!margins'];if(m)setup.margins={left:m.left,right:m.right,top:m.top,bottom:m.bottom,header:m.header||.3,footer:m.footer||.3};
  if(info.paper)setup.paperSize=info.paper;if(info.orientation)setup.orientation=info.orientation;if(info.scale)setup.scale=info.scale;
  if(info.fit){setup.fitToPage=true;setup.fitToWidth=info.fitW??1;setup.fitToHeight=info.fitH??1}
  if(info.hc)setup.horizontalCentered=true;if(info.vc)setup.verticalCentered=true;if(info.grid)setup.showGridLines=true;
  for(const row of info.breaks||[])if(row>0)sheet.getRow(row).addPageBreak();
  const ref=n=>String(n.Ref||'').replace(/'[^']*'!|[^,!]*!/g,'').replace(/\$/g,'');
  const area=names.find(n=>n.Sheet===index&&/^_xlnm\.Print_Area$/i.test(n.Name));if(area&&!/#REF/i.test(area.Ref))setup.printArea=ref(area).split(',').filter(Boolean).join('&&');
  const titles=names.find(n=>n.Sheet===index&&/^_xlnm\.Print_Titles$/i.test(n.Name));
  if(titles)for(const part of ref(titles).split(',')){if(/^\d+:\d+$/.test(part))setup.printTitlesRow=part;else if(/^[A-Z]+:[A-Z]+$/i.test(part))setup.printTitlesColumn=part}
 });
 return workbook;
};
})();
