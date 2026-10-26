const fs=require('fs'), {minify}=require('terser'), csso=require('csso');
(async()=>{
  let s=fs.readFileSync(process.argv[2],'utf8');
  const m=s.match(/<script>([\s\S]*)<\/script>/);
  const r=await minify(m[1],{compress:{passes:2},mangle:true,format:{comments:false,ascii_only:false}});
  s=s.replace(m[0],'@@SCRIPT@@');
  s=s.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g,(a,attr,css)=>'<style'+attr+'>'+csso.minify(css,{restructure:false}).css+'</style>');
  s=s.replace('@@SCRIPT@@',()=>'<script>'+r.code+'</script>');
  // html outside script/style: collapse whitespace between tags, drop comments
  const parts=s.split(/(<script>[\s\S]*?<\/script>|<style[^>]*>[\s\S]*?<\/style>)/);
  s=parts.map(p=>/^<(script|style)/.test(p)?p:p.replace(/<!--(?!\s*=)[\s\S]*?-->/g,'').replace(/>\s+</g,'><').replace(/\s{2,}/g,' ')).join('');
  fs.writeFileSync(process.argv[3],s);
  console.log('chars',[...s].length,'bytes',Buffer.byteLength(s));
})();
