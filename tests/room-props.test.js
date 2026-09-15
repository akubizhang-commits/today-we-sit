'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {drawRoomProp}=require('../src/ui/room-props');
const kinds=['window','door','stereo','curtain','buffet','lamp','plant','shelf','picture','toybox','dashboard'];

// A strict context records geometry and state instead of silently accepting every API.
function context(){
  const calls=[],stack=[];
  const state={fillStyle:'#123456',strokeStyle:'#654321',lineWidth:7,lineCap:'butt',lineJoin:'miter',
    shadowBlur:4,shadowColor:'#112233',shadowOffsetX:2,shadowOffsetY:3,globalAlpha:.6,
    transform:[1,0,0,1,9,13],clips:0};
  const ctx={calls,state,stack};
  for(const key of Object.keys(state).filter(k=>!['transform','clips'].includes(k))){
    Object.defineProperty(ctx,key,{get:()=>state[key],set:value=>{state[key]=value;},enumerable:true});
  }
  ctx.save=()=>{calls.push(['save']);stack.push(structuredClone(state));};
  ctx.restore=()=>{calls.push(['restore']);assert.ok(stack.length,'restore without save');Object.assign(state,stack.pop());};
  ctx.translate=(x,y)=>{calls.push(['translate',x,y]);state.transform[4]+=x;state.transform[5]+=y;};
  ctx.scale=(x,y)=>{calls.push(['scale',x,y]);state.transform[0]*=x;state.transform[3]*=y;};
  ctx.clip=()=>{calls.push(['clip']);state.clips++;};
  for(const name of ['beginPath','closePath','fill','stroke','rect','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','ellipse','fillRect']){
    ctx[name]=(...args)=>{calls.push([name,...args]);if(name==='fill'||name==='stroke'||name==='fillRect')assert.ok(state.clips>0,'paint before clipping');};
  }
  return ctx;
}
function assertGeometry(calls){
  function point(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=0&&x<=100&&y>=0&&y<=100,`outside unit bounds: ${x},${y}`);}
  for(const [op,...a] of calls){
    if(['moveTo','lineTo','quadraticCurveTo','bezierCurveTo'].includes(op))for(let i=0;i<a.length;i+=2)point(a[i],a[i+1]);
    if(op==='rect'||op==='fillRect'){point(a[0],a[1]);point(a[0]+a[2],a[1]+a[3]);}
    if(op==='arc'){point(a[0]-a[2],a[1]-a[2]);point(a[0]+a[2],a[1]+a[2]);}
    if(op==='ellipse'){const rx=Math.hypot(a[2]*Math.cos(a[4]),a[3]*Math.sin(a[4]));const ry=Math.hypot(a[2]*Math.sin(a[4]),a[3]*Math.cos(a[4]));point(a[0]-rx,a[1]-ry);point(a[0]+rx,a[1]+ry);}
  }
}
for(const kind of kinds)test(`${kind} maps the unit drawing into its rectangle and restores caller state`,()=>{
  for(const size of [[32,40],[60,80],[250,50]]){
    const ctx=context(),before=structuredClone(ctx.state),prop=Object.freeze({kind,x:19,y:27,w:size[0],h:size[1]});
    drawRoomProp(ctx,prop);
    assert.deepEqual(ctx.state,before);assert.equal(ctx.stack.length,0);
    assert.deepEqual(ctx.calls.slice(0,5),[['save'],['translate',19,27],['scale',size[0]/100,size[1]/100],['beginPath'],['rect',0,0,100,100]]);
    assert.equal(ctx.calls[5][0],'clip');assert.equal(ctx.calls.at(-1)[0],'restore');
    assertGeometry(ctx.calls);
    assert.ok(ctx.calls.some(([op])=>op==='fill'),'must actually paint the object');
  }
});

test('unknown kinds and invalid bounds leave the context untouched',()=>{
  for(const prop of [null,{}, {kind:'toString',x:0,y:0,w:50,h:50}, {kind:'unknown',x:0,y:0,w:50,h:50},
    ...[0,-1,NaN,Infinity,'40'].map(w=>({kind:'window',x:0,y:0,w,h:50})),
    {kind:'window',x:NaN,y:0,w:50,h:50},{kind:'door',x:0,y:0,w:50,h:0}]){
    const ctx=context(),before=structuredClone(ctx.state);drawRoomProp(ctx,prop);
    assert.deepEqual(ctx.calls,[]);assert.deepEqual(ctx.state,before);
  }
});

test('rendering errors still restore caller transform, clip and style',()=>{
  const ctx=context(),before=structuredClone(ctx.state);ctx.fill=()=>{throw Error('Canvas failure');};
  assert.throws(()=>drawRoomProp(ctx,{kind:'window',x:5,y:9,w:40,h:65}),/Canvas failure/);
  assert.deepEqual(ctx.state,before);assert.equal(ctx.stack.length,0);
});

test('drawings are deterministic and variants stay in bounds without changing input',()=>{
  for(const [kind,variant] of [['window','night'],['door','closed'],['curtain','closed'],['lamp','hanging'],['dashboard','night']]){
    const prop=Object.freeze({kind,x:0,y:0,w:50,h:70,variant});const first=context(),second=context(),normal=context();
    drawRoomProp(first,prop);drawRoomProp(second,prop);drawRoomProp(normal,{...prop,variant:undefined});
    assert.deepEqual(first.calls,second.calls);assertGeometry(first.calls);
    assert.notDeepEqual(first.calls,normal.calls,`${kind} variant should change visible geometry`);
  }
});

test('drawing needs no clock, randomness, network or scene module',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const forbidden=()=>{throw Error('Unexpected external state access');};
  const math=Object.create(Math);math.random=forbidden;
  const sandbox={module:{exports:{}},Math:math,Date:class{constructor(){forbidden();}static now(){forbidden();}},
    performance:{now:forbidden},fetch:forbidden,XMLHttpRequest:forbidden,
    require(request){assert.equal(request,'./draw','only stateless primitives may be imported');return require('../src/ui/draw');}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/ui/room-props.js'),'utf8'),sandbox,{timeout:1000});
  for(const kind of kinds)sandbox.module.exports.drawRoomProp(context(),{kind,x:1,y:2,w:40,h:70});
});

// Optional offline raster verification. Production code has no native dependency.
// Run with NODE_PATH pointing to an existing @napi-rs/canvas installation to enable.
let createCanvas;
try{({createCanvas}=require('@napi-rs/canvas'));}catch(_){}
test('offline pixels stay within bounds, remain distinct and honor an existing clip',{skip:!createCanvas},()=>{
  const fingerprints=new Set();
  for(const kind of kinds){
    for(const [w,h] of [[32,40],[60,80],[250,50]]){
      const canvas=createCanvas(290,120),ctx=canvas.getContext('2d');
      const prop={kind,x:17,y:19,w,h};drawRoomProp(ctx,prop);
      const pixels=ctx.getImageData(0,0,290,120).data;let painted=0;
      for(let y=0;y<120;y++)for(let x=0;x<290;x++)if(pixels[(y*290+x)*4+3]){
        painted++;assert.ok(x>=17&&x<17+w&&y>=19&&y<19+h,`${kind}: pixel outside bounds at ${x},${y}`);
      }
      assert.ok(painted>w*h*.08,`${kind} should be visible at ${w}x${h}`);
      if(w===60)fingerprints.add(require('node:crypto').createHash('sha256').update(pixels).digest('hex'));
      const copy=createCanvas(290,120);drawRoomProp(copy.getContext('2d'),prop);
      assert.deepEqual(copy.getContext('2d').getImageData(0,0,290,120).data,pixels);
    }
  }
  assert.equal(fingerprints.size,kinds.length,'props must have distinct visible drawings');
  const canvas=createCanvas(100,100),ctx=canvas.getContext('2d');
  ctx.beginPath();ctx.rect(30,30,20,20);ctx.clip();
  drawRoomProp(ctx,{kind:'window',x:0,y:0,w:100,h:100});
  const pixels=ctx.getImageData(0,0,100,100).data;
  for(let y=0;y<100;y++)for(let x=0;x<100;x++)if(pixels[(y*100+x)*4+3])assert.ok(x>=30&&x<50&&y>=30&&y<50);
  ctx.fillStyle='#FF0000';ctx.fillRect(0,0,100,100);
  assert.equal(ctx.getImageData(0,0,1,1).data[3],0,'caller clip must survive rendering');
});
