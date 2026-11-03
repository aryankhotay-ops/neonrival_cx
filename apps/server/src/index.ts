import { createServer, type Server } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { createInitialState, NEUTRAL, step, type FighterId, type GameState, type Input } from '../../../packages/simulation/src/index';

const port=Number(process.env.PORT??3001);
const testMode=process.env.NODE_ENV==='test';
const production=process.env.NODE_ENV==='production';
const host=process.env.HOST??(production?'0.0.0.0':'127.0.0.1');
if(!Number.isInteger(port)||port<(testMode?0:1)||port>65535)throw new Error('Invalid PORT');
const certPath=process.env.TLS_CERT_FILE?.trim()||'';
const keyPath=process.env.TLS_KEY_FILE?.trim()||'';
if(Boolean(certPath)!==Boolean(keyPath))throw new Error('TLS_CERT_FILE and TLS_KEY_FILE must be set together.');
if(production&&!process.env.ALLOWED_ORIGINS?.trim())throw new Error('ALLOWED_ORIGINS is required in production.');
const origins=new Set((process.env.ALLOWED_ORIGINS??'')
 .split(',').map(value=>value.trim()).filter(Boolean).map(value=>{try{return new URL(value).origin;}catch{throw new Error(`Invalid origin in ALLOWED_ORIGINS: ${value}`);}}));
const maxConnections=Number(process.env.MAX_CONNECTIONS??200);
if(!Number.isSafeInteger(maxConnections)||maxConnections<2)throw new Error('MAX_CONNECTIONS must be an integer of at least 2.');
const graceMs=testMode?1800:30_000, lobbyMs=5*60_000, introMs=testMode?50:3200, tickMs=testMode?1:1000/60;
const log=(level:'info'|'warn'|'error',event:string,details:Record<string,unknown>={})=>process.stdout.write(`${JSON.stringify({time:new Date().toISOString(),level,event,...details})}\n`);
const secure=Boolean(certPath);
const requestHandler=(req:import('node:http').IncomingMessage,res:import('node:http').ServerResponse)=>{
 const pathname=new URL(req.url??'/','http://server.invalid').pathname;
 if(req.method==='GET'&&pathname==='/health'){
  res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify({status:'ok',service:'neon-rival-multiplayer',uptimeSeconds:Math.floor(process.uptime()),version:process.env.RENDER_GIT_COMMIT?.slice(0,12)||'local'}));return;
 }
 res.writeHead(404,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({error:'not found'}));
};
const http:Server=secure?createSecureServer({cert:readFileSync(certPath),key:readFileSync(keyPath)},requestHandler):createServer(requestHandler);
http.headersTimeout=10_000;http.requestTimeout=15_000;http.keepAliveTimeout=5_000;
const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
http.on('upgrade',(req,socket,head)=>{
 let pathname:string;try{pathname=new URL(req.url??'/','http://server.invalid').pathname;}catch{socket.destroy();return;}
 if(pathname!=='/ws'){socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 const origin=req.headers.origin;
 if(origin&&(production||origins.size>0)){let normalized:string;try{normalized=new URL(origin).origin;}catch{normalized='';}if(!origins.has(normalized)){log('warn','ws_origin_rejected',{origin});socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}}
 if(wss.clients.size>=maxConnections){socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 const clientSocket=socket as import('node:net').Socket;clientSocket.setTimeout(10_000,()=>clientSocket.destroy());wss.handleUpgrade(req,socket,head,ws=>{clientSocket.setTimeout(0);wss.emit('connection',ws,req);});
});
type Slot={socket:WebSocket|null;token:string;character:FighterId;input:Input;seq:number;lastInput:number;ready:boolean;expiry:ReturnType<typeof setTimeout>|null};
type Room={code:string;players:Slot[];state:GameState|null;timer:ReturnType<typeof setInterval>|null;startTimer:ReturnType<typeof setTimeout>|null;lobbyTimer:ReturnType<typeof setTimeout>|null;stage:'waiting'|'intro'|'playing'|'paused'|'finished';resumeStage:'intro'|'playing'|'finished'|null};
const rooms=new Map<string,Room>();
const send=(ws:WebSocket|null,data:unknown)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
const broadcast=(room:Room,data:unknown)=>room.players.forEach(p=>send(p.socket,data));
const character=(v:unknown):FighterId=>v==='vex'||v==='ryu'||v==='ken'||v==='dudley'?v:'kai';
const clean=(v:unknown):Input=>{const o=(typeof v==='object'&&v!==null?v:{}) as Record<string,unknown>;return {left:o.left===true,right:o.right===true,up:o.up===true,down:o.down===true,punch:o.punch===true,kick:o.kick===true,special:o.special===true,super:o.super===true};};
function stopClock(room:Room){if(room.timer)clearInterval(room.timer);if(room.startTimer)clearTimeout(room.startTimer);room.timer=null;room.startTimer=null;}
function deleteRoom(room:Room,reason:string){stopClock(room);if(room.lobbyTimer)clearTimeout(room.lobbyTimer);room.players.forEach(p=>{if(p.expiry)clearTimeout(p.expiry);});rooms.delete(room.code);broadcast(room,{type:'closed',reason});}
function status(room:Room){broadcast(room,{type:'roomStatus',stage:room.stage,connected:room.players.map(p=>!!p.socket),ready:room.players.map(p=>p.ready),graceMs});}
function runClock(room:Room){
 if(room.players.length!==2||room.players.some(p=>!p.socket)||!room.state)return;
 room.stage='playing';status(room);
 room.timer=setInterval(()=>{if(!room.state)return;const now=Date.now();const inputs=room.players.map(p=>now-p.lastInput>500?{...NEUTRAL}:p.input) as [Input,Input];room.state=step(room.state,inputs);broadcast(room,{type:'state',state:room.state,serverTime:now,acks:room.players.map(p=>p.seq)});
  if(room.state.phase==='matchEnd'){stopClock(room);room.stage='finished';room.players.forEach(p=>{p.ready=false;p.input={...NEUTRAL};});room.lobbyTimer=setTimeout(()=>deleteRoom(room,'Room expired after the match.'),lobbyMs);status(room);}
 },tickMs);
}
function begin(room:Room){
 stopClock(room);if(room.lobbyTimer)clearTimeout(room.lobbyTimer);room.lobbyTimer=null;
 room.state=createInitialState([room.players[0].character,room.players[1].character]);room.stage='intro';room.resumeStage=null;
 room.players.forEach(p=>{p.ready=false;p.input={...NEUTRAL};p.seq=-1;p.lastInput=0;});
 broadcast(room,{type:'start',state:room.state,introMs});status(room);
 room.startTimer=setTimeout(()=>{room.startTimer=null;runClock(room);},introMs);
}
function disconnect(room:Room,slot:Slot,ws:WebSocket){
 if(slot.socket!==ws)return;slot.socket=null;slot.input={...NEUTRAL};
 if(room.state&&room.stage!=='paused'){room.resumeStage=room.stage==='finished'?'finished':room.stage==='intro'?'intro':'playing';stopClock(room);room.stage='paused';}
 status(room);slot.expiry=setTimeout(()=>{if(rooms.has(room.code)&&!slot.socket)deleteRoom(room,'Reconnect window expired.');},graceMs);
}
function equalToken(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
wss.on('connection',(socket,request)=>{type AliveSocket=WebSocket&{isAlive:boolean};const aliveSocket=socket as AliveSocket;let room:Room|null=null,slot:Slot|null=null;let rateStarted=Date.now(),messages=0;aliveSocket.isAlive=true;socket.on('pong',()=>{aliveSocket.isAlive=true;});socket.on('error',error=>log('warn','ws_error',{message:error.message}));socket.on('message',(raw:RawData,isBinary:boolean)=>{const now=Date.now();if(now-rateStarted>=1000){rateStarted=now;messages=0;}if(++messages>120){socket.close(1008,'rate limit');return;}if(socket.bufferedAmount>64*1024){socket.close(1013,'client too slow');return;}if(isBinary){socket.close(1003,'text messages required');return;}let data:Record<string,unknown>;try{data=JSON.parse(raw.toString());if(!data||typeof data!=='object'||Array.isArray(data)){socket.close(1007,'invalid message');return;}}catch{socket.close(1007,'invalid message');return;}
 if(data.type==='ping'){send(socket,{type:'pong',nonce:data.nonce});return;}
 if(data.type==='create'&&!room){if(rooms.size>=100){send(socket,{type:'error',message:'Server is full.'});return;}let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));slot={socket,token:randomBytes(24).toString('hex'),character:character(data.character),input:{...NEUTRAL},seq:-1,lastInput:0,ready:false,expiry:null};room={code,players:[slot],state:null,timer:null,startTimer:null,lobbyTimer:null,stage:'waiting',resumeStage:null};rooms.set(code,room);const created=room;room.lobbyTimer=setTimeout(()=>deleteRoom(created,'Room expired while waiting.'),lobbyMs);send(socket,{type:'created',code,player:0,token:slot.token});log('info','room_created',{code});return;}
 if(data.type==='join'&&!room){const target=typeof data.code==='string'&&/^[0-9A-F]{6}$/i.test(data.code)?rooms.get(data.code.toUpperCase()):undefined;if(!target||target.players.length!==1||target.state||!target.players[0].socket){send(socket,{type:'error',message:'Room not found or full.'});return;}slot={socket,token:randomBytes(24).toString('hex'),character:character(data.character),input:{...NEUTRAL},seq:-1,lastInput:0,ready:false,expiry:null};room=target;target.players.push(slot);send(socket,{type:'joined',code:target.code,player:1,token:slot.token});log('info','room_joined',{code:target.code});begin(target);return;}
 if(data.type==='resume'&&!room){const target=typeof data.code==='string'?rooms.get(data.code.toUpperCase()):undefined;const token=typeof data.token==='string'?data.token:'';const index=target?.players.findIndex(p=>equalToken(p.token,token))??-1;if(!target||index<0){send(socket,{type:'resumeError',message:'Room or recovery token expired.'});return;}slot=target.players[index];room=target;const previous=slot.socket;slot.socket=socket;if(previous&&previous!==socket)previous.close(4000,'Session replaced');if(slot.expiry)clearTimeout(slot.expiry);slot.expiry=null;slot.input={...NEUTRAL};slot.lastInput=0;slot.seq=-1;
  const allConnected=target.players.every(p=>p.socket);if(target.stage==='paused'&&allConnected){const stage=target.resumeStage;target.resumeStage=null;if(stage==='intro'){target.stage='intro';target.startTimer=setTimeout(()=>{target.startTimer=null;runClock(target);},introMs);}else if(stage==='playing'){runClock(target);}else target.stage='finished';}
  send(socket,{type:'resumed',code:target.code,player:index,token:slot.token,stage:target.stage,state:target.state,ready:target.players.map(p=>p.ready)});if(target.stage==='intro'&&allConnected)broadcast(target,{type:'start',state:target.state,introMs});status(target);return;}
 if(!room||!slot||slot.socket!==socket)return;
 if(data.type==='leave'){deleteRoom(room,'Opponent left the room.');return;}
 if(data.type==='input'&&room.stage==='playing'&&Number.isSafeInteger(data.seq)&&Number(data.seq)>slot.seq){slot.seq=Number(data.seq);slot.input=clean(data.input);slot.lastInput=Date.now();return;}
 if(data.type==='rematch'&&room.stage==='finished'){slot.ready=true;status(room);if(room.players.length===2&&room.players.every(p=>p.socket&&p.ready))begin(room);}
 });socket.on('close',(code,reason)=>{log('info','ws_closed',{code,reason:reason.toString()});if(room&&slot&&rooms.has(room.code))disconnect(room,slot,socket);});log('info','ws_connected',{origin:request.headers.origin??'unspecified'});});
const heartbeat=setInterval(()=>{for(const socket of wss.clients){const aliveSocket=socket as WebSocket&{isAlive:boolean};if(!aliveSocket.isAlive){socket.terminate();continue;}aliveSocket.isAlive=false;socket.ping();}},30_000);heartbeat.unref();
http.on('error',error=>log('error','http_server_error',{message:error.message}));
http.listen(port,host,()=>{const address=http.address();log('info','server_listening',{host:typeof address==='object'&&address?address.address:host,port:typeof address==='object'&&address?address.port:port,protocol:secure?'https':'http',websocketPath:'/ws',allowedOriginCount:origins.size,maxConnections});});
for(const sig of ['SIGINT','SIGTERM'] as const)process.on(sig,()=>{clearInterval(heartbeat);log('info','server_shutdown',{signal:sig});for(const room of rooms.values())deleteRoom(room,'Server stopped.');wss.close();http.close(()=>process.exit(0));});
