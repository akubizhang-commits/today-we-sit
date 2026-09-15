'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {buildContent}=require('./build-content');
const root=fs.realpathSync(path.resolve(__dirname,'..'));
function bundle(entry){
 const modules=new Map();
 function collect(file){
  file=fs.realpathSync(file);
  if(!file.startsWith(root+path.sep))throw new Error('Dependency outside project');
  const id=path.relative(root,file).split(path.sep).join('/');if(modules.has(id))return id;
  const raw=fs.readFileSync(file,'utf8');modules.set(id,'');
  const source=path.extname(file)==='.json'?`module.exports=${JSON.stringify(JSON.parse(raw))};`:raw;
  const code=source.replace(/require\((['"])([^'"]*)\1\)/g,(_,quote,request)=>{
   if(!request.startsWith('.'))throw new Error(`Non-local dependency ${request} in ${id}`);
   let dep=path.resolve(path.dirname(file),request);
   if(!path.extname(dep))dep+='.js';
   if(!dep.startsWith(root+path.sep))throw new Error('Dependency outside project');
   return `require(${JSON.stringify(collect(dep))})`;
  });modules.set(id,code);return id;
 }
 const entryId=collect(path.join(root,entry));
 const code=`/* Generated from project source. */\n(function(){'use strict';const modules={\n${[...modules].map(([id,src])=>`${JSON.stringify(id)}:function(module,exports,require){\n${src}\n}`).join(',\n')}\n};const cache={};function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;if(!modules[id])throw new Error('Missing module: '+id);modules[id](m,m.exports,require);return m.exports;}require(${JSON.stringify(entryId)});})();\n`;
 return {code,modules:[...modules.keys()]};
}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function build(){
 const content=buildContent({root,mode:'production'});
 const web=bundle('web/entry.js'),wx=bundle('game.js');
 for(const output of [web,wx]){
  const forbidden=output.modules.find(id=>id.startsWith('content/')||id.startsWith('tools/editor/')||id==='src/content/levels.js');
  if(forbidden)throw new Error(`Production bundle includes author/editor content: ${forbidden}`);
 }
 const editor=fs.existsSync(path.join(root,'tools/editor/entry.js'))?bundle('tools/editor/entry.js'):null;
 fs.writeFileSync(path.join(root,'web/game.bundle.js'),web.code);
 if(editor)fs.writeFileSync(path.join(root,'web/editor.bundle.js'),editor.code);
 if(fs.existsSync(path.join(root,'web/animals-entry.js')))fs.writeFileSync(path.join(root,'web/animals.bundle.js'),bundle('web/animals-entry.js').code);
 const dest=path.join(root,'dist/wechat');
 // Only this owned generated directory is replaced. Source and neighboring projects are untouched.
 fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
 fs.writeFileSync(path.join(dest,'game.js'),wx.code);
 for(const name of ['game.json','project.config.json'])fs.copyFileSync(path.join(root,name),path.join(dest,name));
 if(fs.existsSync(path.join(root,'assets')))fs.cpSync(path.join(root,'assets'),path.join(dest,'assets'),{recursive:true,filter:p=>!p.includes(`${path.sep}marketing`)});
 const files=walk(dest).map(file=>({path:path.relative(dest,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
 const report={buildId:'1.0.0-local',status:'local-candidate-not-published',contentVersion:content.contentVersion,publishedLevels:content.levelCount,modules:wx.modules,files,totalBytes:files.reduce((s,f)=>s+f.bytes,0)};
 fs.writeFileSync(path.join(root,'dist/build-manifest.json'),JSON.stringify(report,null,2));
 console.log(`Browser: ${web.modules.length} modules, ${(Buffer.byteLength(web.code)/1024).toFixed(1)} KiB`);
 console.log(`WeChat local candidate: ${content.levelCount} puzzles, ${(report.totalBytes/1024/1024).toFixed(2)} MiB, dist/wechat`);
 console.log('This is not a release approval. Run npm run release:check for external readiness.');
 return report;
}
if(require.main===module)build();
module.exports={bundle,build};
