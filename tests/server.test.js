const test=require('node:test');
const assert=require('node:assert/strict');
const {createHandler}=require('../scripts/serve');
function request(url){
  return new Promise(resolve=>{
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){resolve({status:this.status,body:String(body)});}};
    createHandler()({url},res);
  });
}
test('malformed null byte request is rejected without crashing server',async()=>{
  assert.equal((await request('/%00')).status,400);
  assert.equal((await request('/')).status,200);
});
test('preview server cannot read files above the web root',async()=>{
  assert.equal((await request('/..%2fpackage.json')).status,403);
});
