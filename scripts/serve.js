const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../web');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
function createHandler(){return (req,res)=>{
  let file;
  try{
    const url=new URL(req.url,'http://localhost');
    const route=decodeURIComponent(url.pathname);
    if(route.includes('\0'))throw new Error('Null byte');
    file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
  }catch(_){res.writeHead(400);res.end('Bad request');return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  try{fs.readFile(file,(err,body)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(body);
  });}catch(_){res.writeHead(400);res.end('Bad request');}
};}
if(require.main===module){
  const port=Number(process.env.SEAT_GAME_PORT||4173);
  const server=http.createServer(createHandler());
  server.on('error',err=>{console.error(`预览服务启动失败：${err.code}。端口占用时可设置 SEAT_GAME_PORT。`);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`今天怎么坐: http://127.0.0.1:${port}`));
}
module.exports={createHandler};
