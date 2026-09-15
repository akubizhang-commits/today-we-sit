'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createAdService}=require('../src/services/ads');
function fixture(overrides={}) {
  let close,error; const removed=[];
  return {ad:{load:()=>Promise.resolve(),show:()=>Promise.resolve(),onClose:fn=>{close=fn;},offClose:fn=>removed.push(fn),onError:fn=>{error=fn;},offError:fn=>removed.push(fn),...overrides},close:value=>close(value),error:value=>error(value),savedClose:()=>close,removed};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('only exact ended true earns once, with immutable original request binding and detached listeners',async()=>{
  const f=fixture(); const service=createAdService({createAd:()=>f.ad,now:()=>0});
  const input={requestId:'one',levelId:'bus-011'}; const pending=service.request(input); input.levelId='bus-012';
  await tick(); assert.equal(service.getState().status,'showing');
  f.close({isEnded:true}); f.close({isEnded:true}); f.error(new Error('late'));
  assert.deepEqual(await pending,{status:'earned',requestId:'one',levelId:'bus-011'});
  assert.equal(service.getState().completed,1); assert.equal(f.removed.length,2);
  assert.equal((await service.request({requestId:'one',levelId:'bus-012'})).status,'unavailable');
});
test('concurrent requests and late callbacks cannot reward a subsequent ad',async()=>{
  const first=fixture(), second=fixture(); let n=0;
  const service=createAdService({createAd:()=> (++n===1?first:second).ad,now:()=>0});
  const a=service.request({requestId:'a',levelId:'old'}); await tick();
  assert.equal((await service.request({requestId:'b',levelId:'new'})).reason,'busy');
  const late=first.savedClose(); first.close({isEnded:false}); assert.equal((await a).status,'cancelled');
  const c=service.request({requestId:'c',levelId:'new'}); await tick(); late({isEnded:true});
  assert.equal(service.getState().completed,0); assert.equal(service.getState().requestId,'c');
  second.close({isEnded:true}); assert.equal((await c).levelId,'new'); assert.equal(service.getState().completed,1);
});
test('missing/false/truthy close values cancel without counting or cooldown',async()=>{
  const f=fixture(); const service=createAdService({createAd:()=>f.ad,now:()=>0});
  for(const [i,result] of [undefined,{}, {isEnded:false},{isEnded:1}].entries()) {
    const p=service.request({requestId:`c${i}`,levelId:'x'}); await tick(); f.close(result);
    assert.equal((await p).status,'cancelled'); assert.equal(service.getState().completed,0);
  }
});
test('cooldown is 90 seconds minimum and session cap counts only three earned ads',async()=>{
  let now=0; const f=fixture(); const service=createAdService({createAd:()=>f.ad,now:()=>now,minIntervalMs:0,maxPerSession:99});
  for(let i=0;i<3;i++) {
    const p=service.request({requestId:`earn${i}`,levelId:'x'}); await tick(); f.close({isEnded:true}); assert.equal((await p).status,'earned');
    now+=89999; assert.equal((await service.request({requestId:`blocked${i}`,levelId:'x'})).status,'unavailable'); now++;
  }
  assert.equal((await service.request({requestId:'four',levelId:'x'})).reason,'session-cap');
});
test('missing factory/ad/IDs, SDK failures and malformed objects never fake earnings',async()=>{
  for(const factory of [undefined,()=>null,()=>({}),()=>{throw Error('factory');}]) {
    const s=createAdService({createAd:factory}); assert.notEqual((await s.request({requestId:'r',levelId:'x'})).status,'earned');
  }
  const s=createAdService({createAd:()=>fixture().ad}); assert.equal((await s.request({levelId:'x'})).status,'unavailable');
  for(const method of ['load','show']) {
    const f=fixture({[method]:()=>Promise.reject(Error(method))}); const service=createAdService({createAd:()=>f.ad});
    assert.equal((await service.request({requestId:'r',levelId:'x'})).status,'error'); assert.equal(service.getState().completed,0);
  }
  const f=fixture(); const service=createAdService({createAd:()=>f.ad}); const p=service.request({requestId:'r',levelId:'x'}); await tick(); f.error({code:1}); assert.equal((await p).status,'error');
});
test('callbacks during loading cannot grant, and terminal errors stop a pending load from showing',async()=>{
  let finishLoad,shows=0;
  const f=fixture({load:()=>new Promise(r=>{finishLoad=r;}),show:()=>{shows++;}});
  const s=createAdService({createAd:()=>f.ad}); const p=s.request({requestId:'r',levelId:'x'});
  await tick(); f.close({isEnded:true}); assert.equal(s.getState().completed,0);
  f.error({}); assert.equal((await p).status,'error'); finishLoad(); await tick(); assert.equal(shows,0);
});
test('unavailable terminals are observable and stricter limits never call the adapter',async()=>{
  const absent=createAdService(); assert.equal((await absent.request({requestId:'r',levelId:'x'})).status,'unavailable');
  assert.equal(absent.getState().status,'unavailable');
  let factories=0; const capped=createAdService({maxPerSession:0,createAd:()=>{factories++;return fixture().ad;}});
  assert.equal((await capped.request({requestId:'r',levelId:'x'})).reason,'session-cap'); assert.equal(factories,0);
  let now=0; const f=fixture(); const slow=createAdService({createAd:()=>f.ad,now:()=>now,minIntervalMs:120000,maxPerSession:1});
  const p=slow.request({requestId:'first',levelId:'x'}); await tick(); f.close({isEnded:true}); await p;
  now=120000; assert.equal((await slow.request({requestId:'second',levelId:'x'})).reason,'session-cap');
});

function fakeTimers() {
  let now=0,nextId=0;
  const jobs=new Map(),scheduled=[],cleared=[];
  return {
    now:()=>now,
    setTimeout(fn,delay){const id=nextId++;const job={id,fn,delay,at:now+delay};jobs.set(id,job);scheduled.push(job);return id;},
    clearTimeout(id){cleared.push(id);jobs.delete(id);},
    advance(ms){
      const end=now+ms;
      for(;;){const job=[...jobs.values()].filter(j=>j.at<=end).sort((a,b)=>a.at-b.at||a.id-b.id)[0];if(!job)break;jobs.delete(job.id);now=job.at;job.fn();}
      now=end;
    },
    pending:()=>jobs.size,scheduled,cleared
  };
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

test('default load deadline is 15s, releases busy state and detaches without earning',async()=>{
  const timers=fakeTimers(),load=deferred();let shows=0;
  const f=fixture({load:()=>load.promise,show:()=>{shows++;}});
  const s=createAdService({createAd:()=>f.ad,...timers});
  const pending=s.request({requestId:'timeout-load',levelId:'old'});await tick();
  assert.deepEqual(timers.scheduled.map(j=>j.delay),[15000]);
  timers.advance(14999);assert.equal(s.getState().status,'loading');
  timers.advance(1);assert.equal(s.getState().status,'error');
  assert.deepEqual(await pending,{status:'error',requestId:'timeout-load',levelId:'old',reason:'load-timeout'});
  assert.equal(s.getState().completed,0);assert.equal(f.removed.length,2);assert.equal(timers.pending(),0);
  load.resolve();await tick();f.close({isEnded:true});assert.equal(shows,0);assert.equal(s.getState().completed,0);
});

test('default 180s deadline covers both unresolved show and resolved show without close',async()=>{
  for(const unresolved of [true,false]){
    const timers=fakeTimers(),show=deferred(),f=fixture({show:()=>unresolved?show.promise:Promise.resolve()});
    const s=createAdService({createAd:()=>f.ad,...timers});
    const pending=s.request({requestId:`show-${unresolved}`,levelId:'cinema-011'});await tick();
    assert.deepEqual(timers.scheduled.map(j=>j.delay),[15000,180000]);assert.equal(timers.pending(),1);
    timers.advance(179999);assert.equal(s.getState().status,'showing');
    timers.advance(1);assert.equal(s.getState().status,'error');
    assert.equal((await pending).reason,'show-timeout');assert.equal(f.removed.length,2);assert.equal(timers.pending(),0);
    show.resolve();f.close({isEnded:true});await tick();assert.equal(s.getState().completed,0);
  }
});

test('injected durations transition from loading to one show/close deadline; retired phase timers are inert',async()=>{
  const timers=fakeTimers(),load=deferred(),f=fixture({load:()=>load.promise});
  const s=createAdService({createAd:()=>f.ad,...timers,loadTimeoutMs:20,showTimeoutMs:50});
  const pending=s.request({requestId:'phase',levelId:'x'});await tick();
  assert.equal(timers.pending(),1);const oldTimer=timers.scheduled[0];
  timers.advance(19);load.resolve();await tick();assert.equal(s.getState().status,'showing');
  assert.deepEqual(timers.scheduled.map(j=>j.delay),[20,50]);assert.ok(timers.cleared.includes(oldTimer.id));
  oldTimer.fn();assert.equal(s.getState().status,'showing');
  timers.advance(49);assert.equal(s.getState().status,'showing');
  timers.advance(1);assert.equal(s.getState().status,'error');assert.equal((await pending).reason,'show-timeout');
});

test('late load resolution/rejection, SDK callbacks and timer callbacks cannot affect a new request',async()=>{
  for(const rejectLoad of [false,true]){
    const timers=fakeTimers(),oldLoad=deferred();let oldShows=0,n=0;
    const old=fixture({load:()=>oldLoad.promise,show:()=>{oldShows++;}}),fresh=fixture();
    const s=createAdService({createAd:()=> (++n===1?old:fresh).ad,...timers,loadTimeoutMs:10,showTimeoutMs:30});
    const first=s.request({requestId:'old',levelId:'old-level'});await tick();const oldTimeout=timers.scheduled[0];
    timers.advance(10);assert.equal(s.getState().status,'error');await first;
    const second=s.request({requestId:'new',levelId:'new-level'});await tick();
    if(rejectLoad)oldLoad.reject(Error('late load'));else oldLoad.resolve();
    old.close({isEnded:true});old.error({});oldTimeout.fn();await tick();
    assert.equal(oldShows,0);assert.deepEqual(s.getState(),{status:'showing',requestId:'new',levelId:'new-level',completed:0,sessionCompleted:0});
    assert.equal(timers.pending(),1);fresh.close({isEnded:true});assert.equal((await second).levelId,'new-level');
    assert.equal(s.getState().completed,1);assert.equal(timers.pending(),0);
  }
});

test('late show rejection and close after show timeout never settle or reward the next request',async()=>{
  const timers=fakeTimers(),oldShow=deferred();let n=0;
  const old=fixture({show:()=>oldShow.promise}),fresh=fixture();
  const s=createAdService({createAd:()=> (++n===1?old:fresh).ad,...timers,showTimeoutMs:25});
  const first=s.request({requestId:'old-show',levelId:'a'});await tick();const oldTimer=timers.scheduled[1];
  timers.advance(25);assert.equal(s.getState().status,'error');assert.equal((await first).reason,'show-timeout');
  const second=s.request({requestId:'new-show',levelId:'b'});await tick();
  oldShow.reject(Error('late show'));old.close({isEnded:true});old.error({});oldTimer.fn();await tick();
  assert.equal(s.getState().requestId,'new-show');assert.equal(s.getState().status,'showing');assert.equal(s.getState().completed,0);
  fresh.close({isEnded:false});assert.equal((await second).status,'cancelled');assert.equal(timers.pending(),0);
});

test('success, cancellation and SDK failures remove all timers as well as listeners',async()=>{
  for(const terminal of ['earned','cancelled','onError','load-reject','show-reject']){
    const timers=fakeTimers();const f=fixture(terminal==='load-reject'?{load:()=>Promise.reject(Error('load'))}:terminal==='show-reject'?{show:()=>Promise.reject(Error('show'))}:{});
    const s=createAdService({createAd:()=>f.ad,...timers});const pending=s.request({requestId:terminal,levelId:'x'});await tick();
    if(terminal==='earned'||terminal==='cancelled')f.close({isEnded:terminal==='earned'});
    if(terminal==='onError')f.error({});
    const value=await pending;assert.equal(timers.pending(),0);assert.equal(f.removed.length,2);
    for(const timer of timers.scheduled)timer.fn();f.close({isEnded:true});
    assert.equal(s.getState().status,value.status);assert.equal(s.getState().completed,terminal==='earned'?1:0);
  }
});

test('invalid timeout options use bounded defaults instead of disabling the deadline',async()=>{
  for(const value of [0,-1,NaN,Infinity,'15',2147483648]){
    const timers=fakeTimers(),f=fixture();const s=createAdService({createAd:()=>f.ad,...timers,loadTimeoutMs:value,showTimeoutMs:value});
    const pending=s.request({requestId:'invalid-duration',levelId:'x'});await tick();
    assert.deepEqual(timers.scheduled.map(j=>j.delay),[15000,180000]);
    f.close({isEnded:false});await pending;assert.equal(timers.pending(),0);
  }
});

test('timer setup failure settles error and cleans listeners without calling unbounded SDK work',async()=>{
  for(const failAt of [1,2]){
    const timers=fakeTimers();let scheduled=0,loads=0,shows=0;
    const f=fixture({load:()=>{loads++;return Promise.resolve();},show:()=>{shows++;return Promise.resolve();}});
    const s=createAdService({createAd:()=>f.ad,...timers,setTimeout(fn,delay){if(++scheduled===failAt)throw Error('timer unavailable');return timers.setTimeout(fn,delay);}});
    const result=await s.request({requestId:`timer-${failAt}`,levelId:'x'});
    assert.equal(result.status,'error');assert.equal(result.reason,'timer-error');assert.equal(s.getState().completed,0);
    assert.equal(loads,failAt===1?0:1);assert.equal(shows,0);assert.equal(f.removed.length,2);assert.equal(timers.pending(),0);
  }
});

test('cleanup errors and reentrant late callbacks cannot prevent timeout settlement or listener cleanup',async()=>{
  const timers=fakeTimers(),removed=[];let lateClose,lateError;
  const f=fixture({
    load:()=>new Promise(()=>{}),
    onClose:fn=>{lateClose=fn;},onError:fn=>{lateError=fn;},
    offClose(fn){removed.push(fn);lateClose({isEnded:true});throw Error('offClose');},
    offError(fn){removed.push(fn);lateError({});}
  });
  const s=createAdService({createAd:()=>f.ad,...timers,loadTimeoutMs:5,clearTimeout(){throw Error('cancel');}});
  const pending=s.request({requestId:'cleanup',levelId:'x'});await tick();timers.advance(5);
  assert.equal(s.getState().status,'error');assert.equal((await pending).reason,'load-timeout');
  assert.deepEqual(removed,[lateClose,lateError]);assert.equal(s.getState().completed,0);
  timers.scheduled[0].fn();assert.equal(s.getState().status,'error');
});

test('session caps are independent, cooldown is global, and busy or late callbacks retain original session binding',async()=>{
  const timers=fakeTimers(),ads=[];
  const s=createAdService({createAd:()=>{const f=fixture();ads.push(f);return f.ad;},...timers,maxPerSession:1});
  const input={requestId:'a',levelId:'bus-011',sessionId:'play-a'};
  const a=s.request(input);await tick();input.sessionId='play-b';
  assert.equal((await s.request({requestId:'busy-b',levelId:'bus-012',sessionId:'play-b'})).reason,'busy');
  ads[0].close({isEnded:true});await a;assert.equal(s.getState().completed,1);assert.equal(s.getState().sessionCompleted,1);
  assert.equal((await s.request({requestId:'cool-b',levelId:'bus-012',sessionId:'play-b'})).reason,'cooldown');
  assert.equal(s.getState().sessionCompleted,0);
  timers.advance(89999);assert.equal((await s.request({requestId:'early-b',levelId:'bus-012',sessionId:'play-b'})).reason,'cooldown');
  timers.advance(1);const b=s.request({requestId:'b',levelId:'bus-012',sessionId:'play-b'});await tick();
  assert.equal(s.getState().status,'showing');assert.equal(s.getState().sessionCompleted,0);
  ads[0].close({isEnded:true});ads[0].error({});assert.equal(s.getState().requestId,'b');assert.equal(s.getState().completed,1);assert.equal(s.getState().sessionCompleted,0);
  ads[1].close({isEnded:true});await b;assert.equal(s.getState().completed,2);assert.equal(s.getState().sessionCompleted,1);
  timers.advance(90000);
  for(const sessionId of ['play-a','play-b']){
    assert.equal((await s.request({requestId:`capped-${sessionId}`,levelId:'same-level',sessionId})).reason,'session-cap');
    assert.equal(s.getState().sessionCompleted,1);
  }
  const c=s.request({requestId:'c',levelId:'bus-011',sessionId:'play-c'});await tick();assert.equal(s.getState().sessionCompleted,0);ads[2].close({isEnded:false});await c;
  assert.equal(s.getState().completed,2);assert.equal(s.getState().sessionCompleted,0);assert.equal(timers.pending(),0);
});

test('legacy omitted session shares one cap across levels and is separate from an explicit session named legacy',async()=>{
  const timers=fakeTimers();let f;
  const s=createAdService({createAd:()=>{f=fixture();return f.ad;},...timers,maxPerSession:1});
  const first=s.request({requestId:'default-one',levelId:'a'});await tick();f.close({isEnded:true});await first;
  timers.advance(90000);
  assert.equal((await s.request({requestId:'default-two',levelId:'b'})).reason,'session-cap');
  const explicit=s.request({requestId:'explicit',levelId:'a',sessionId:'legacy'});await tick();
  assert.equal(s.getState().status,'showing');assert.equal(s.getState().sessionCompleted,0);
  f.close({isEnded:true});await explicit;assert.equal(s.getState().completed,2);assert.equal(s.getState().sessionCompleted,1);
});

test('timed-out session cannot charge a new session and still has its own full allowance',async()=>{
  const timers=fakeTimers(),oldLoad=deferred(),ads=[];
  const s=createAdService({createAd:()=>{const f=fixture(ads.length===0?{load:()=>oldLoad.promise}:{});ads.push(f);return f.ad;},...timers,maxPerSession:1,loadTimeoutMs:10});
  const old=s.request({requestId:'old',levelId:'x',sessionId:'old-session'});await tick();timers.advance(10);await old;
  const fresh=s.request({requestId:'fresh',levelId:'y',sessionId:'new-session'});await tick();
  oldLoad.resolve();ads[0].close({isEnded:true});await tick();assert.equal(s.getState().completed,0);assert.equal(s.getState().sessionCompleted,0);
  ads[1].close({isEnded:true});await fresh;timers.advance(90000);
  const retry=s.request({requestId:'old-retry',levelId:'x',sessionId:'old-session'});await tick();assert.equal(s.getState().status,'showing');assert.equal(s.getState().sessionCompleted,0);
  ads[2].close({isEnded:true});await retry;assert.equal(s.getState().completed,2);assert.equal(s.getState().sessionCompleted,1);
});

test('invalid explicit session IDs fail closed without starting an adapter',async()=>{
  let calls=0;const s=createAdService({createAd:()=>{calls++;return fixture().ad;}});
  for(const [i,sessionId] of [null,'',' ',{},1,'x'.repeat(257)].entries()){
    assert.equal((await s.request({requestId:`bad-${i}`,levelId:'x',sessionId})).reason,'invalid-request');
  }
  assert.equal(calls,0);
});
