import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';

type Message=Record<string,any>;
class Client {
 socket:WebSocket; messages:Message[]=[]; waiters:{predicate:(m:Message)=>boolean;resolve:(m:Message)=>void}[]=[];
 constructor(url:string){this.socket=new WebSocket(url);this.socket.on('message',raw=>{const m=JSON.parse(raw.toString()) as Message;const index=this.waiters.findIndex(w=>w.predicate(m));if(index>=0)this.waiters.splice(index,1)[0].resolve(m);else this.messages.push(m);});}
 async open(){await once(this.socket,'open');}
 send(value:unknown){this.socket.send(JSON.stringify(value));}
 next(type:string,predicate:(m:Message)=>boolean=()=>true,timeout=5000):Promise<Message>{
  const match=(m:Message)=>m.type===type&&predicate(m),index=this.messages.findIndex(match);if(index>=0)return Promise.resolve(this.messages.splice(index,1)[0]);
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const i=this.waiters.findIndex(w=>w.resolve===done);if(i>=0)this.waiters.splice(i,1);reject(new Error(`Timed out waiting for ${type}`));},timeout);const done=(m:Message)=>{clearTimeout(timer);resolve(m);};this.waiters.push({predicate:match,resolve:done});});
 }
 close(){this.socket.terminate();}
}
test('rooms synchronize, recover connections, and require both players for rematches', {timeout:20000},async()=>{
 const server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{cwd:process.cwd(),env:{...process.env,PORT:'0',HOST:'127.0.0.1',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
 let error='';server.stderr.on('data',chunk=>error+=chunk.toString());const clients:Client[]=[];
 try{
  const line=await Promise.race([once(server.stdout,'data'),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error(`Server failed: ${error}`)),5000))]);
  const startup=JSON.parse(String(line[0])) as {event:string;port:number};assert.equal(startup.event,'server_listening');assert.ok(startup.port>0);const url=`ws://127.0.0.1:${startup.port}/ws`;
  const a=new Client(url),b=new Client(url);clients.push(a,b);await Promise.all([a.open(),b.open()]);
  a.send({type:'create',character:'dudley'});const created=await a.next('created');assert.match(created.token,/^[a-f0-9]{48}$/);
  b.send({type:'join',code:created.code,character:'ryu'});const joined=await b.next('joined');assert.notEqual(created.token,joined.token);
  const [startA,startB]=await Promise.all([a.next('start'),b.next('start')]);assert.deepEqual(startA.state.fighters.map((p:Message)=>p.character),['dudley','ryu']);assert.deepEqual(startA.state,startB.state);
  const state=await a.next('state');assert.ok(state.state.frame>0);
  b.close();const paused=await a.next('roomStatus',m=>m.stage==='paused');assert.deepEqual(paused.connected,[true,false]);
  const wrong=new Client(url);clients.push(wrong);await wrong.open();wrong.send({type:'resume',code:created.code,token:'bad'});await wrong.next('resumeError');wrong.close();
  const resumed=new Client(url);clients.push(resumed);await resumed.open();resumed.send({type:'resume',code:created.code,token:joined.token});const recovery=await resumed.next('resumed');assert.equal(recovery.player,1);assert.ok(recovery.state.frame>=state.state.frame);await a.next('roomStatus',m=>m.stage==='playing');
  let seq=0;const input={left:false,right:true,up:false,down:false,punch:false,kick:false,special:false,super:false};
  const attacks=setInterval(()=>{input.special=!input.special;a.send({type:'input',seq:++seq,input});},18);
  const finished=await a.next('state',m=>m.state.phase==='matchEnd',12000);clearInterval(attacks);assert.equal(finished.state.winner,1);
  a.send({type:'rematch'});const waiting=await a.next('roomStatus',m=>m.stage==='finished'&&m.ready[0]);assert.equal(waiting.ready[1],false);
  resumed.send({type:'rematch'});const [againA,againB]=await Promise.all([a.next('start'),resumed.next('start')]);assert.equal(againA.state.frame,0);assert.deepEqual(againA.state,againB.state);
  a.send({type:'leave'});await resumed.next('closed',m=>m.reason.includes('left'));
 }finally{clients.forEach(c=>c.close());server.kill('SIGTERM');}
});
