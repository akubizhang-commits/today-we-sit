'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createTelemetry}=require('../src/services/telemetry');
function make(options={}) {let i=0;return createTelemetry({now:()=>1000,createId:()=>`anon-${++i}`,buildId:'test',contentVersion:'1',...options});}
test('no identifiers or events before consent; revocation clears data; no automatic transport',async()=>{
  let ids=0,sends=0; const s=make({createId:()=>`id${++ids}`,transport:async()=>{sends++;return {acceptedIds:[]};}});
  assert.equal(s.track('app_open'),false); await s.flush(); assert.equal(ids,0); assert.equal(sends,0);
  s.setConsent(true,'v1'); assert.ok(ids>0); assert.equal(s.track('app_open'),true); assert.equal(sends,0);
  s.setConsent(false); assert.deepEqual(s.getQueue(),[]); assert.equal(s.track('app_open'),false); await s.flush(); assert.equal(sends,0);
});
test('dictionary and scalar allowlist drop secrets, answers, identity, raw errors and revenue',()=>{
  const s=make(); s.setConsent(true,'v1');
  assert.equal(s.track('unknown'),false);
  for(const name of ['app_open','tutorial_complete','level_start','level_exit','level_complete','hint_request','hint_granted','ad_request','ad_show','ad_complete','ad_cancel','ad_error','daily_complete','storage_error','runtime_error']) assert.equal(s.track(name,{levelId:'bus-001',phone:'123',userId:'secret',answer:{a:'s1'},income:99,message:'credential',durationMs:42}),true);
  const q=s.getQueue(); assert.equal(q.length,15); assert.equal(q[0].levelId,'bus-001'); assert.equal(q[0].durationMs,42);
  const json=JSON.stringify(q); for(const secret of ['phone','userId','answer','income','credential']) assert.equal(json.includes(secret),false);
  q[0].levelId='mutated'; assert.equal(s.getQueue()[0].levelId,'bus-001');
});
test('deduplication, event and byte bounds protect errors and handle UTF-8',()=>{
  const s=make(); s.setConsent(true,'v1'); assert.equal(s.track('runtime_error',{code:'E1'},'error'),true);
  assert.equal(s.track('runtime_error',{},'error'),false);
  for(let i=0;i<220;i++) s.track('level_start',{levelId:'bus-001'},`event-${i}`);
  const q=s.getQueue(); assert.equal(q.length,200); assert.ok(q.some(e=>e.eventId==='error')); assert.ok(!q.some(e=>e.eventId==='event-0'));
  assert.ok(Buffer.byteLength(JSON.stringify(q),'utf8')<=256*1024);
  const large=make({buildId:'中'.repeat(256),contentVersion:'文'.repeat(256)}); large.setConsent(true,'v1');
  for(let i=0;i<200;i++) large.track('runtime_error',{levelId:'字'.repeat(256),code:'错'.repeat(256)});
  assert.ok(Buffer.byteLength(JSON.stringify(large.getQueue()),'utf8')<=256*1024); assert.ok(large.getQueue().length<200);
});
test('flush sends at most fifty, acknowledges only matching IDs and retains failures',async()=>{
  let batch,fail=false; const s=make({transport:async value=>{batch=value;if(fail) throw Error('offline');return {acceptedIds:[value.events[0].eventId,'foreign']};}});
  s.setConsent(true,'privacy-1'); for(let i=0;i<60;i++) s.track('app_open',{},`e${i}`);
  await s.flush(); assert.equal(batch.events.length,50); assert.equal(batch.consentVersion,'privacy-1'); assert.equal(batch.environment,'development'); assert.equal(s.getQueue().length,59);
  assert.equal(s.track('app_open',{},'e0'),false);
  fail=true; await s.flush(); assert.equal(s.getQueue().length,59);
  const missing=make(); missing.setConsent(true,'v1'); missing.track('app_open'); await missing.flush(); assert.equal(missing.getQueue().length,1);
});
test('concurrent flushes send once; revocation prevents old acknowledgements affecting a new consent epoch',async()=>{
  let finish,calls=0; const s=make({transport:batch=>{calls++;return new Promise(r=>{finish=()=>r({acceptedIds:batch.events.map(e=>e.eventId)});});}});
  s.setConsent(true,'v1'); s.track('app_open',{},'same'); const a=s.flush(),b=s.flush(); assert.equal(calls,1);
  s.setConsent(false); s.setConsent(true,'v2'); s.track('app_open',{},'same'); finish(); await Promise.all([a,b]); assert.equal(s.getQueue().length,1);
});
test('sampling and retention expire errors after 14 days and gameplay after 30 days',()=>{
  const sampled=make({sampleRate:0}); sampled.setConsent(true,'v1'); assert.equal(sampled.track('app_open'),false);
  let now=0; const s=make({now:()=>now}); s.setConsent(true,'v1'); s.track('app_open'); s.track('runtime_error');
  now=15*86400000; assert.deepEqual(s.getQueue().map(e=>e.name),['app_open']); now=31*86400000; assert.deepEqual(s.getQueue(),[]);
});
test('malformed acknowledgements fail closed and synchronous transport throws retain the queue',async()=>{
  for(const transport of [()=>{throw Error('offline');},()=>null,()=>({acceptedIds:'all'})]) {
    const s=make({transport}); s.setConsent(true,'v1'); s.track('app_open');
    assert.equal((await s.flush()).status,'error'); assert.equal(s.getQueue().length,1);
  }
});
