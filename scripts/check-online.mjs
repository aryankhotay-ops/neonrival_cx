import { createRequire } from 'node:module';
import { strict as assert } from 'node:assert';
const require=createRequire(new URL('../apps/server/package.json',import.meta.url));
const WebSocket=require('ws');
const address=new URL(process.argv[2]||'');
const origin=process.argv[3]||'https://neonrival-cx.vercel.app';
if(address.protocol!=='wss:'&&!(address.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(address.hostname)))throw new Error('Use a public wss:// endpoint, or ws:// for a local check.');
class Client {
 constructor(){this.queue=[];this.waiters=[];this.socket=new WebSocket(address,{origin,handshakeTimeout:65000,maxPayload:256*1024});this.socket.on('error',()=>{});this.socket.on('message',raw=>{const m=JSON.parse(raw.toString());const i=this.waiters.findIndex(w=>w.match(m));if(i>=0)this.waiters.splice(i,1)[0].resolve(m);else{this.queue.push(m);if(this.queue.length>400)this.queue.shift();}});}
 open(){return new Promise((resolve,reject)=>{this.socket.once('open',resolve);this.socket.once('error',reject);});}
 send(data){this.socket.send(JSON.stringify(data));}
 next(type,predicate=()=>true,timeout=10000){const match=m=>m.type===type&&predicate(m),i=this.queue.findIndex(match);if(i>=0)return Promise.resolve(this.queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const waiter={match,resolve:m=>{clearTimeout(timer);resolve(m)}};const timer=setTimeout(()=>{this.waiters=this.waiters.filter(w=>w!==waiter);reject(new Error(`Timed out waiting for ${type}`))},timeout);this.waiters.push(waiter);});}
 close(){this.socket.terminate();}
}
const clients=[];
try {
 const a=new Client(),b=new Client();clients.push(a,b);await Promise.all([a.open(),b.open()]);
 a.send({type:'create',character:'ryu'});const room=await a.next('created');assert.match(room.code,/^[A-F0-9]{6}$/);
 b.send({type:'join',code:room.code,character:'ken'});const joined=await b.next('joined');
 const [sa,sb]=await Promise.all([a.next('start'),b.next('start')]);assert.deepEqual(sa.state,sb.state);assert.deepEqual(sa.state.fighters.map(f=>f.character),['ryu','ken']);
 const stateB=await b.next('state');const stateA=await a.next('state',m=>m.state.frame===stateB.state.frame);assert.deepEqual(stateA.state,stateB.state);
 a.send({type:'input',seq:1,input:{right:true}});const ack=await a.next('state',m=>m.acks[0]===1);assert.ok(ack.state.fighters[0].x>sa.state.fighters[0].x);
 b.close();await a.next('roomStatus',m=>m.stage==='paused');
 const c=new Client();clients.push(c);await c.open();c.send({type:'resume',code:room.code,token:joined.token});const recovered=await c.next('resumed');assert.equal(recovered.player,1);assert.ok(recovered.state.frame>=ack.state.frame);await a.next('roomStatus',m=>m.stage==='playing');
 a.send({type:'leave'});await c.next('closed',m=>m.reason.includes('left'));
 console.log('PASS: secure-origin room creation, join, matching fight state, input acknowledgement, disconnect pause, recovery and leave.');
} finally {clients.forEach(c=>c.close());}
