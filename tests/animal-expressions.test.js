'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {person}=require('../src/ui/draw');
const {SPECIES,animalProfile}=require('../src/ui/animals');
const moods=['neutral','happy','sad','sleepy','hurt','angry','curious','surprised'];
function recording(){
  const ops=[],stack=[],state={fillStyle:'#ABCDEF',strokeStyle:'#123456',lineWidth:3,lineCap:'butt',lineJoin:'miter',
    shadowBlur:2,shadowColor:'#123456',shadowOffsetX:1,shadowOffsetY:2,globalAlpha:.7,transform:[1,0,0,1,0,0],clip:0};
  const ctx={ops,state,stack};
  for(const key of Object.keys(state).filter(k=>!['transform','clip'].includes(k)))Object.defineProperty(ctx,key,{get:()=>state[key],set:value=>{state[key]=value;ops.push(['style',key,value]);}});
  ctx.save=()=>{stack.push(structuredClone(state));ops.push(['save']);};
  ctx.restore=()=>{assert.ok(stack.length);Object.assign(state,stack.pop());ops.push(['restore']);};
  ctx.translate=(x,y)=>{state.transform[4]+=x;state.transform[5]+=y;ops.push(['translate',x,y]);};
  ctx.scale=(x,y)=>{state.transform[0]*=x;state.transform[3]*=y;ops.push(['scale',x,y]);};
  ctx.clip=()=>{state.clip++;ops.push(['clip']);};
  for(const op of ['beginPath','closePath','moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','ellipse','rect','fill','stroke'])ctx[op]=(...args)=>{
    for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),`${op} received nonfinite geometry`);
    ops.push([op,...args]);
  };
  return ctx;
}
function trace(identity,mood,motion=0){const ctx=recording();person(ctx,0,0,50,'#A8BA99',identity,mood,motion);return ctx.ops;}

test('each stable species has eight distinct expression drawings',()=>{
  assert.equal(SPECIES.length,12);
  for(let i=0;i<12;i++)assert.equal(new Set(moods.map(m=>JSON.stringify(trace(i,m)))).size,8,SPECIES[i].id);
  for(const mood of moods)assert.equal(new Set(SPECIES.map((_,i)=>JSON.stringify(trace(i,mood)))).size,12,mood);
});
test('legacy states are exact aliases at every motion phase and omitted mood remains neutral',()=>{
  for(let i=0;i<12;i++)for(const phase of [-1,0,1])for(const [old,next] of [['satisfied','happy'],['conflict','hurt'],['pending','curious']])assert.deepEqual(trace(i,old,phase),trace(i,next,phase));
  const a=recording(),b=recording();person(a,0,0,50,'#A8BA99',0);person(b,0,0,50,'#A8BA99',0,'neutral',0);assert.deepEqual(a.ops,b.ops);
  for(const mood of ['unknown',null,'constructor','__proto__'])assert.deepEqual(trace(0,mood),trace(0,'neutral'));
});
test('motion changes every species without changing frozen identities and clamps unsafe scalar inputs',()=>{
  for(let i=0;i<12;i++){
    const identity=Object.freeze({name:SPECIES[i].label,id:`stable-${i}`}),before=animalProfile(identity);
    assert.equal(new Set([-1,0,1].map(m=>JSON.stringify(trace(i,'neutral',m)))).size,3,SPECIES[i].id);
    trace(identity,'happy',1);assert.equal(animalProfile(identity),before);
    assert.deepEqual(trace(i,'happy',99),trace(i,'happy',1));assert.deepEqual(trace(i,'happy',-99),trace(i,'happy',-1));
    for(const value of [NaN,Infinity,-Infinity,'1',null])assert.deepEqual(trace(i,'happy',value),trace(i,'happy',0));
  }
});
test('portraits restore all caller state, including after a draw failure',()=>{
  for(const mood of moods){const c=recording(),before=structuredClone(c.state);person(c,19,31,23,'#C66949',9,mood,.75);assert.deepEqual(c.state,before);assert.equal(c.stack.length,0);}
  const c=recording(),before=structuredClone(c.state);c.fill=()=>{throw Error('drawing failed');};
  assert.throws(()=>person(c,10,20,30,'#ABCDEF',0,'happy',1),/drawing failed/);assert.deepEqual(c.state,before);assert.equal(c.stack.length,0);
});
test('expressions and motion do not access time, randomness or platform state',()=>{
  const vm=require('node:vm'),fs=require('node:fs');const fail=()=>{throw Error('External state access');};
  const math=Object.create(Math);math.random=fail;
  const sandbox={module:{exports:{}},Math:math,Date:class{constructor(){fail();}static now(){fail();}},performance:{now:fail},fetch:fail,
    require(id){assert.equal(id,'./animals');return require('../src/ui/animals');}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/ui/draw'),'utf8'),sandbox,{timeout:1000});
  for(let i=0;i<12;i++)for(const mood of moods)sandbox.module.exports.person(recording(),0,0,32,'#A8BA99',i,mood,.7);
});
let createCanvas;try{({createCanvas}=require('@napi-rs/canvas'));}catch(_){}
function raster(identity,mood,motion=0,size=50){const canvas=createCanvas(120,120);const ctx=canvas.getContext('2d');person(ctx,60,60,size,'#A8BA99',identity,mood,motion);return {ctx,pixels:ctx.getImageData(0,0,120,120).data};}
test('offline face crops distinguish all eight moods even at 13px and keep the portrait envelope',{skip:!createCanvas},()=>{
  const hash=require('node:crypto').createHash;
  for(let i=0;i<12;i++)for(const size of [13,15,23,30,44,48,50]){
    const faces=new Set();
    for(const mood of moods){
      const {ctx}=raster(i,mood,0,size),s=size/50;
      const crop=ctx.getImageData(Math.floor(60-11*s),Math.floor(60-13*s),Math.ceil(22*s),Math.ceil(27*s)).data;
      faces.add(hash('sha256').update(crop).digest('hex'));
      for(const motion of [-1,0,1]){
        const {pixels}=raster(i,mood,motion,size);
        for(let y=0;y<120;y++)for(let x=0;x<120;x++)if(pixels[(y*120+x)*4+3]){
          assert.ok(x>=Math.floor(60-28*s)&&x<Math.ceil(60+28*s)&&y>=Math.floor(60-35*s)&&y<Math.ceil(60+34*s),`${SPECIES[i].id}/${mood}/${motion}: outside original portrait envelope`);
        }
      }
    }
    assert.equal(faces.size,8,`${SPECIES[i].id}: distinct faces at ${size}px`);
  }
});
test('offline aliases are pixel-identical and rendering preserves an existing clip',{skip:!createCanvas},()=>{
  for(let i=0;i<12;i++)for(const [old,next] of [['satisfied','happy'],['conflict','hurt'],['pending','curious']])assert.ok(Buffer.from(raster(i,old,.5).pixels).equals(Buffer.from(raster(i,next,.5).pixels)),`${SPECIES[i].id}: ${old} must equal ${next}`);
  const canvas=createCanvas(100,100),ctx=canvas.getContext('2d');ctx.beginPath();ctx.rect(40,40,20,20);ctx.clip();
  person(ctx,50,50,50,'#A8BA99',7,'surprised',1);ctx.fillStyle='#FF0000';ctx.fillRect(0,0,100,100);
  const pixels=ctx.getImageData(0,0,100,100).data;
  for(let y=0;y<100;y++)for(let x=0;x<100;x++)if(pixels[(y*100+x)*4+3])assert.ok(x>=40&&x<60&&y>=40&&y<60);
});
