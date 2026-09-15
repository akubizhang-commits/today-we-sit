'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),webRoot=path.join(root,'web');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wav':'audio/wav','.png':'image/png','.json':'application/json; charset=utf-8'};
function createHandler(){return(req,res)=>{
 const method=req.method||'GET';
 const end=(status,body,headers={})=>{res.writeHead(status,headers);res.end(method==='HEAD'?undefined:body);};
 if(method!=='GET'&&method!=='HEAD'){end(405,'Method not allowed',{'Allow':'GET, HEAD'});return;}
 let file,base;
 try{
  const url=new URL(req.url,'http://localhost'),route=decodeURIComponent(url.pathname);
  if(route.includes('\0'))throw new Error('Null byte');
  if(route==='/editor'||route==='/editor/'){file=path.join(root,'tools/editor/index.html');base=path.join(root,'tools/editor');}
  else if(route.startsWith('/assets/')){base=path.join(root,'assets');file=path.resolve(base,route.slice('/assets/'.length));}
  else{base=webRoot;file=path.resolve(base,'.'+(route==='/'?'/index.html':route));}
 }catch(_){end(400,'Bad request');return;}
 if(!file.startsWith(base+path.sep)){end(403,'Forbidden');return;}
 // Resolve links before reading: a lexical prefix alone does not contain a file.
 Promise.all([fs.promises.realpath(base),fs.promises.realpath(file)]).then(([realBase,realFile])=>{
  if(!realFile.startsWith(realBase+path.sep)){end(403,'Forbidden');return;}
  fs.readFile(realFile,(err,body)=>{
   if(err){end(404,'Not found');return;}
   end(200,body,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  });
 },()=>end(404,'Not found'));
};}
if(require.main===module){
 const port=Number(process.env.SEAT_GAME_PORT||4173),server=http.createServer(createHandler());
 server.on('error',err=>{console.error(`预览服务启动失败：${err.code}，可设置SEAT_GAME_PORT。`);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log(`游戏 http://127.0.0.1:${port} · 编辑器 /editor`));
}
module.exports={createHandler};
