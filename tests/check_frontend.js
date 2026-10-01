// Run: node tests/check_frontend.js  (no browser or server needed)
// Loads the split scripts with a fake Vue/Swal and checks the template only uses names setup() returns.
const fs=require('fs'), vm=require('vm');
const path=require('path');
const root=path.join(__dirname,'..','js')+path.sep;
const sandbox={console, window:{}, Swal:{fire(){},isVisible(){return false}}, setInterval,clearInterval,
  fetch:async()=>({status:200,text:async()=>JSON.stringify({authenticated:false,csrf:'t'})}),
  Vue:{createApp:(c)=>({mount(){sandbox.__App=c}}),ref:v=>({value:v}),computed:f=>({get value(){return f()}}),onMounted:f=>{}}};
sandbox.window=sandbox; vm.createContext(sandbox);
for (const f of ['utils.js','api.js','template.js']) vm.runInContext(fs.readFileSync(root+f,'utf8'),sandbox,{filename:f});
vm.runInContext(fs.readFileSync(root+'app.js','utf8')+';globalThis.__App=App;',sandbox,{filename:'app.js'});
const App=sandbox.__App; const ret=App.setup();
const names=new Set(Object.keys(ret));
const tpl=App.template;
// identifiers used in template expressions
const exprs=[...tpl.matchAll(/\{\{([\s\S]*?)\}\}/g)].map(m=>m[1]);
for (const m of tpl.matchAll(/(?:v-if|v-else-if|v-show|v-model|v-for|:[a-z-]+|@[a-z.]+)="([^"]*)"/g)) exprs.push(m[1]);
const ignore=new Set(['true','false','null','undefined','in','of','$event','app','n','s','d','doc','l','b','c','t','a','arr','x','i','key','e','res','val','opt','st','r','u','doctor','sp','k','v','id','index','idx','item','row','o','p','h','m','f','g','w','z','y','q','name','value','label','Number','String','Object','Array','Math','Date','JSON','parseInt','parseFloat','isNaN','typeof','new','return','function','if','else','length','includes','toFixed','filter','map','find','join','some','trim']);
const used=new Set();
for (const ex of exprs){ const cleaned=ex.replace(/'[^']*'|"[^"]*"/g,''); for (const m of cleaned.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)) used.add(m[1]); }
const missing=[...used].filter(n=>!names.has(n)&&!ignore.has(n));
console.log('setup exports:',names.size,'| template identifiers checked:',used.size);
console.log('possibly missing (review; loop vars are false positives):',missing.join(', ')||'none');
for (const need of ['authMode','registerForm','handleRegister','loginForm','handleLogin','handleLogout']) if(!names.has(need)) {console.log('MISSING EXPORT',need);process.exitCode=1}
