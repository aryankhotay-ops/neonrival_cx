import {test} from 'node:test';
import {strict as a} from 'node:assert';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import WebSocket from 'ws';
test('QA hostile messages, stale input, capacity, session replacement and expiry', {timeout:25000},async()=>{
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,NODE_ENV:'test',PORT:'0',HOST:'127.0.0.1',ALLOWED_ORIGINS:'https://neonrival-cx.vercel.app'},stdio:['ignore','pipe','pipe']});
 let stderr='';server.stderr.on('data',s=>stderr+=s);const clients:WebSocket[]=[];
 try{
  const [chunk]=await once(server.stdout,'data');const port=JSON.parse(String(chunk)).port;a.ok(port);const url=`ws://127.0.0.1:${port}/ws`;
  const open=async()=>{const ws=new WebSocket(url,{origin:'https://neonrival-cx.vercel.app'});clients.push(ws);ws.on('error',()=>{});await once(ws,'open');return ws;};
  const next=(ws:WebSocket,type:string,predicate:(m:any)=>boolean=()=>true,timeout=2500)=>new Promise<any>((resolve,reject)=>{const handler=(raw:any)=>{const m=JSON.parse(raw.toString());if(m.type===type&&predicate(m)){clearTimeout(timer);ws.off('message',handler);resolve(m);}};const timer=setTimeout(()=>{ws.off('message',handler);reject(new Error(`Timeout: ${type}`));},timeout);ws.on('message',handler);});
  for(const raw of ['{','null','[]','42','"text"']){const ws=await open();const closed=new Promise<number>(r=>ws.once('close',c=>r(c)));ws.send(raw);a.equal(await closed,1007);}
  let ws=await open();let closed=new Promise<number>(r=>ws.once('close',c=>r(c)));ws.send(Buffer.from('binary'));a.equal(await closed,1003);
  ws=await open();closed=new Promise<number>(r=>ws.once('close',c=>r(c)));ws.send('x'.repeat(4096));a.equal(await closed,1009);
  ws=await open();closed=new Promise<number>(r=>ws.once('close',c=>r(c)));for(let i=0;i<140;i++)ws.send(JSON.stringify({type:'ping',nonce:i}));a.equal(await closed,1008);
  const evil=new WebSocket(url,{origin:'https://evil.invalid'});clients.push(evil);evil.on('error',()=>{});const rejected=await new Promise<number>(r=>evil.once('unexpected-response',(_req,res)=>r(res.statusCode!)));a.equal(rejected,403);evil.terminate();
  const host=await open();host.send(JSON.stringify({type:'unknown',state:{health:0}}));let response=next(host,'pong');host.send(JSON.stringify({type:'ping',nonce:77}));a.equal((await response).nonce,77);
  response=next(host,'created');host.send(JSON.stringify({type:'create',character:'ryu'}));const created=await response;
  const guest=await open();response=next(guest,'joined');guest.send(JSON.stringify({type:'join',code:created.code,character:'ken'}));const joined=await response;
  const third=await open();response=next(third,'error');third.send(JSON.stringify({type:'join',code:created.code}));a.match((await response).message,/full/);third.terminate();
  await next(host,'state');response=next(host,'state',m=>m.acks[0]===10);host.send(JSON.stringify({type:'input',seq:10,input:{right:true,punch:'yes'},state:{health:0}}));const accepted=await response;a.equal(accepted.state.fighters[0].health,100);a.equal(accepted.state.fighters[0].move,null);
  host.send(JSON.stringify({type:'input',seq:9,input:{left:true}}));host.send(JSON.stringify({type:'input',seq:'11',input:{left:true}}));const later=await next(host,'state',m=>m.state.frame>accepted.state.frame+5);a.equal(later.acks[0],10);a.ok(later.state.fighters[0].x>accepted.state.fighters[0].x);
  const replacement=await open();response=next(replacement,'resumed');const replaced=new Promise<number>(r=>guest.once('close',c=>r(c)));replacement.send(JSON.stringify({type:'resume',code:created.code,token:joined.token}));a.equal((await response).player,1);a.equal(await replaced,4000);
  response=next(host,'roomStatus',m=>m.stage==='paused');replacement.terminate();await response;
  await next(host,'closed',m=>m.reason.includes('expired'),4000);
  const expired=await open();response=next(expired,'resumeError');expired.send(JSON.stringify({type:'resume',code:created.code,token:joined.token}));await response;
  a.doesNotMatch(stderr,/uncaught|unhandled/i);
 }finally{clients.forEach(ws=>ws.terminate());server.kill('SIGTERM');}
});
test('QA configured connection limit rejects excess clients with HTTP 503', {timeout:8000},async()=>{
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,NODE_ENV:'test',PORT:'0',HOST:'127.0.0.1',MAX_CONNECTIONS:'2'},stdio:['ignore','pipe','pipe']});const clients:WebSocket[]=[];
 try{const [chunk]=await once(server.stdout,'data');const port=JSON.parse(String(chunk)).port;
  for(let i=0;i<2;i++){const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);clients.push(ws);await once(ws,'open');}
  const third=new WebSocket(`ws://127.0.0.1:${port}/ws`);clients.push(third);third.on('error',()=>{});const status=await new Promise<number>(r=>third.once('unexpected-response',(_req,res)=>r(res.statusCode!)));a.equal(status,503);
 }finally{clients.forEach(ws=>ws.terminate());server.kill('SIGTERM');}
});
