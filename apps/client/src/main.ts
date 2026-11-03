import Phaser from 'phaser';
import { FightScene } from './scene';
import { FIGHTERS, type FighterId, type GameState } from '@neon-rival/simulation';
import './style.css';
const scene=new FightScene();
new Phaser.Game({type:Phaser.AUTO,parent:'game',width:960,height:540,backgroundColor:'#202e35',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[scene]});
const overlay=document.getElementById('overlay')!;const exitButton=document.getElementById('exit-fight') as HTMLButtonElement;exitButton.onclick=()=>{if(scene.isOnlineMatch)pauseMenu();else scene.setPaused(true);};
type OnlineSession={code:string;token:string;url:string};
const sessionKey='neon-rival-room-v1';
let onlineSession:OnlineSession|null=null;try{onlineSession=JSON.parse(sessionStorage.getItem(sessionKey)||'null') as OnlineSession|null;}catch{sessionStorage.removeItem(sessionKey);}
let retryTimer:ReturnType<typeof setTimeout>|null=null;let pingTimer:ReturnType<typeof setInterval>|null=null;let reconnectUntil=0;let onlineInMatch=false;let onlineResult:GameState|null=null;let onlineReady:boolean[]=[];let latency:number|null=null;
let selected:[FighterId,FighterId]=['ryu','vex'];let previewPlayer:0|1=0;let versusTimer:ReturnType<typeof setTimeout>|null=null;let latestOnlineState:GameState|null=null;let mode:'local'|'training'|'online'='local';let trainingOpponent:'computer'|'player'='computer';let socket:WebSocket|null=null;let onlinePlayer:0|1=0;let sound=false;
const button=(label:string,action:string,extra='')=>`<button class="btn ${extra}" data-action="${action}">${label}</button>`;
function saveSession(value:OnlineSession|null){onlineSession=value;if(value)sessionStorage.setItem(sessionKey,JSON.stringify(value));else sessionStorage.removeItem(sessionKey);}
function closeSocket(){if(retryTimer)clearTimeout(retryTimer);retryTimer=null;if(pingTimer)clearInterval(pingTimer);pingTimer=null;reconnectUntil=0;onlineInMatch=false;onlineResult=null;onlineReady=[];latency=null;saveSession(null);if(socket){const old=socket;socket=null;old.onclose=null;if(old.readyState===WebSocket.OPEN)old.send(JSON.stringify({type:'leave'}));old.close();}}
const portrait:Record<FighterId,string>={kai:'/assets/portraits/elena.jpg',vex:'/assets/portraits/gill.jpg',ryu:'/assets/portraits/ryu.jpg',ken:'/assets/portraits/ken.jpg',dudley:'/assets/portraits/dudley.jpg'};
function screen(content:string,kind:'default'|'select'|'versus'|'pause'='default',background=''){
 if(versusTimer){clearTimeout(versusTimer);versusTimer=null;}
 exitButton.hidden=true;overlay.classList.remove('hidden','select-screen','versus-screen','pause-screen');
 if(kind!=='default')overlay.classList.add(`${kind}-screen`);
 overlay.innerHTML=`${background}<div class="menu">${content}</div>`;overlay.querySelector<HTMLButtonElement>('button')?.focus();
}
function menu(){scene.stop();closeSocket();screen(`<div class="kicker">● &nbsp; THE FIGHT STARTS HERE / 01</div><h1 class="title">OWN THE<br><span>NIGHT.</span></h1><p class="intro">Two fighters. One city. Make your mark in the underground.</p><div class="buttons">${button('01 &nbsp; LOCAL VERSUS ↗','local','primary')}${button('02 &nbsp; ONLINE ROOMS ↗','online')}${button('03 &nbsp; TRAINING ↗','training')}${button('04 &nbsp; CONTROLS ↗','controls')}${button('05 &nbsp; SETTINGS ↗','settings')}${button('06 &nbsp; CREDITS ↗','credits')}</div>`);}
function trainingOptions(){scene.stop();mode='training';screen(`<div class="kicker">TRAINING MODE / PRACTICE YOUR GAME</div><h2 class="panel-title">Choose your opponent<span style="color:#d9ff4d">.</span></h2><p class="help">Practice against a computer-controlled fighter or play locally with a second player. Choose both fighters on the next screen.</p><div class="buttons">${button('VS COMPUTER ↗','training-computer','primary')}${button('VS PLAYER ↗','training-player')}${button('← MAIN MENU','menu','wide')}</div>`);}
function select(){
 const current=selected[previewPlayer];
 const choices:[FighterId,string][]=[['kai','ELENA'],['vex','GILL'],['ryu','RYU'],['ken','KEN'],['dudley','DUDLEY']];
 const heading=mode==='online'?'CHOOSE YOUR FIGHTER':mode==='training'&&previewPlayer===1&&trainingOpponent==='computer'?'CHOOSE COMPUTER':`PLAYER ${previewPlayer+1}, CHOOSE`;
 const opponentLabel=mode==='online'?'AWAITING RIVAL':mode==='training'?(trainingOpponent==='computer'?'COMPUTER':'PLAYER 2'):'PLAYER 2';
 const art=(id:FighterId,side:string,label:string)=>`<div class="select-fighter ${side}" aria-hidden="true"><img src="${portrait[id]}" alt=""><div class="select-fighter-name"><small>${label}</small><strong>${FIGHTERS[id].name}</strong></div></div>`;
 const background=`<div class="select-duel" aria-hidden="true">${art(selected[0],'select-left','PLAYER 1')}${mode==='online'?'<div class="select-fighter select-right select-waiting"><div class="select-fighter-name"><small>PLAYER 2</small><strong>RIVAL</strong></div></div>':art(selected[1],'select-right',opponentLabel)}</div>`;
 const choicesHtml=choices.map(([id,label])=>`<button class="btn choice ${current===id?'selected':''}" data-action="pick-${id}" aria-pressed="${current===id}">${label}</button>`).join('');
 const next=mode==='online'?'CONTINUE TO ROOMS ↗':mode==='training'?(previewPlayer===0?'LOCK IN PLAYER 1 ↗':'START TRAINING ↗'):(previewPlayer===0?'LOCK IN PLAYER 1 ↗':'CONTINUE TO VERSUS ↗');
 const back=mode==='local'&&previewPlayer===1||mode==='training'&&previewPlayer===1?button('← PLAYER 1','previous-player'):mode==='training'?button('← TRAINING OPTIONS','training-options'):button('← MAIN MENU','menu');
 const turn=mode==='online'?'ONLINE / YOUR SELECTION':mode==='training'?`TRAINING / ${previewPlayer===0?'PLAYER 1':trainingOpponent==='computer'?'COMPUTER':'PLAYER 2'}`:`PLAYER ${previewPlayer+1} / SELECT FIGHTER`;
 screen(`<div class="select-turn">${turn}</div><h2 class="panel-title">${heading}<span style="color:#d9ff4d">.</span></h2><div class="choices" role="group" aria-label="${heading}">${choicesHtml}</div><div class="select-details"><strong>${FIGHTERS[current].name}</strong> <span>/ ${FIGHTERS[current].style}</span><p>${FIGHTERS[current].description}</p><p>STAND: ${FIGHTERS[current].moves.punch.name} · ${FIGHTERS[current].moves.kick.name}<br>HOLD DOWN: ${FIGHTERS[current].moves.crouchPunch.name} · ${FIGHTERS[current].moves.crouchKick.name}<br>SPECIAL: ${FIGHTERS[current].moves.special.name} · SUPER: ${FIGHTERS[current].moves.super.name}</p></div><div class="buttons select-actions">${button(next,'confirm-selection','primary')}${back}</div>`, 'select', background);
 overlay.querySelector<HTMLButtonElement>('.choice.selected')?.focus({preventScroll:true});
}

function showVersus(fighters:[FighterId,FighterId],online=false){
 const [left,right]=fighters;
 const body=`<div class="versus-art" aria-hidden="true"><div class="versus-side versus-left"><img src="${portrait[left]}" alt=""></div><div class="versus-side versus-right"><img src="${portrait[right]}" alt=""></div></div>`;
 screen(`<div class="versus-content"><div class="kicker">${online?'ONLINE MATCH':'NEXT CHALLENGE'} / GET READY</div><div class="versus-names"><div><small>PLAYER 1</small><strong>${FIGHTERS[left].name}</strong><span>${FIGHTERS[left].style}</span></div><b class="versus-mark">VS</b><div><small>${mode==='training'&&trainingOpponent==='computer'?'COMPUTER':'PLAYER 2'}</small><strong>${FIGHTERS[right].name}</strong><span>${FIGHTERS[right].style}</span></div></div>${online?'<p class="versus-wait">MATCH STARTING…</p>':`<div class="versus-actions">${button('FIGHT ↗','fight','primary')}${button('← CHANGE FIGHTERS','select')}</div>`}</div>`, 'versus',body);
}
function start(){if(mode==='online'){roomMenu();return;}showVersus(selected);}
function beginLocal(){overlay.classList.add('hidden');document.activeElement instanceof HTMLElement&&document.activeElement.blur();exitButton.hidden=false;scene.begin(mode,selected,null,0,mode==='training'?trainingOpponent:'player');}
function pauseMenu(){const online=scene.isOnlineMatch;if(online)scene.setOptionsOpen(true);screen(`<div class="pause-card"><div class="kicker">${online?'ONLINE MATCH / OPTIONS':'MATCH PAUSED / LOCAL ARCADE'}</div><h2 class="panel-title">${online?'Match options':'Take a breath'}<span style="color:#d9ff4d">.</span></h2><p class="help">${online?'Online matches keep running while this panel is open.':'The fight is frozen. Resume when you are ready.'}</p><div class="buttons">${button(online?'RETURN TO FIGHT ↗':'RESUME FIGHT ↗',online?'resume-online':'resume','primary')}${online?'':button('RESTART MATCH','restart-fight')}${button(online?'← LEAVE ROOM':'← MAIN MENU','menu','wide')}</div>${online?'':'<p class="pause-hint">P / ESC TO RESUME</p>'}</div>`,'pause');}
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function defaultServer(){if(import.meta.env.VITE_WS_URL)return import.meta.env.VITE_WS_URL;const address=new URL('/ws',location.href);address.protocol=location.protocol==='https:'?'wss:':'ws:';return address.toString();}
function roomMenu(message='',url=onlineSession?.url||defaultServer(),connecting=false){
 screen(`<div class="kicker">ONLINE / PRIVATE ROOMS</div><h2 class="panel-title">Bring a rival<span style="color:#d9ff4d">.</span></h2><p class="help">Both players must use the same reachable server. Create a room and share its code, or join an existing room.</p><label class="network-label" for="server-url">SERVER ADDRESS</label><input class="room-code server-url" id="server-url" value="${escapeHtml(url)}" aria-label="Server WebSocket address"><label class="network-label" for="room-code">ROOM CODE</label><input class="room-code" id="room-code" maxlength="6" placeholder="ROOM CODE" aria-label="Room code"><p class="message" id="room-message">${escapeHtml(message)}</p><div class="buttons">${button('CREATE ROOM ↗','create','primary')}${button('JOIN ROOM ↗','join')}${button('← CHARACTER SELECT','select','wide')}</div>`);
 if(connecting){overlay.querySelectorAll<HTMLButtonElement>('[data-action="create"],[data-action="join"]').forEach(button=>button.disabled=true);}
}
function waitingRoom(code:string){screen(`<div class="kicker">ROOM ${escapeHtml(code)} / WAITING FOR OPPONENT</div><h2 class="panel-title">ROOM ${escapeHtml(code)}</h2><p class="help">Share this code with your opponent. The match begins when they join.</p><div class="buttons">${button('← LEAVE ROOM','menu')}</div>`);}
function recoveryScreen(message:string){screen(`<div class="kicker">ONLINE / ROOM RECOVERY</div><h2 class="panel-title">Connection paused<span style="color:#d9ff4d">.</span></h2><p class="help">${escapeHtml(message)}</p><div class="buttons">${button('← LEAVE ROOM','menu')}</div>`);}
function resultScreen(s:GameState){
 onlineResult=s;const mine=onlineReady[onlinePlayer]===true,other=onlineReady[1-onlinePlayer]===true;
 screen(`<div class="kicker">MATCH COMPLETE / BEST OF THREE</div><h2 class="panel-title">${s.winner===1?'PLAYER 1':'PLAYER 2'} <span style="color:#d9ff4d">WINS.</span></h2><p class="help">${FIGHTERS[s.fighters[0].character].name} ${s.fighters[0].wins} — ${s.fighters[1].wins} ${FIGHTERS[s.fighters[1].character].name}</p>${mode==='online'?`<p class="message">${mine?'You are ready. Waiting for your opponent.':other?'Your opponent wants a rematch.':'Both players must agree to a rematch.'}</p><div class="buttons">${mine?'':button('REQUEST REMATCH ↗','rematch','primary')}${button('← LEAVE ROOM','menu')}</div>`:`<div class="buttons">${button('PLAY AGAIN ↗','select','primary')}${button('← MAIN MENU','menu')}</div>`}`);
}
function connect(kind:'create'|'join'){
 const code=(document.getElementById('room-code') as HTMLInputElement|null)?.value.trim().toUpperCase()||'';
 const url=(document.getElementById('server-url') as HTMLInputElement|null)?.value.trim()||defaultServer();
 if(kind==='join'&&!/^[0-9A-F]{6}$/.test(code)){roomMenu('Enter a six-character room code.',url);return;}
 try{const parsed=new URL(url);if(!['ws:','wss:'].includes(parsed.protocol)||(location.protocol==='https:'&&parsed.protocol!=='wss:'))throw new Error();}catch{roomMenu('Enter a valid ws:// or wss:// address (HTTPS pages require wss://).',url);return;}
 closeSocket();openConnection(url,{type:kind,character:selected[0],code},false);
}
function openConnection(url:string,request:Record<string,unknown>,recovering:boolean){
 let ws:WebSocket;try{ws=new WebSocket(url);}catch{if(recovering)scheduleRecovery();else roomMenu('Invalid server address.',url);return;}
 socket=ws;if(!recovering)roomMenu('Connecting to server… A sleeping server can take up to a minute to start.',url,true);
 const connectTimeout=setTimeout(()=>{if(ws.readyState===WebSocket.CONNECTING)ws.close();},recovering?Math.max(1,Math.min(8000,reconnectUntil-Date.now())):65000);
 ws.onopen=()=>{clearTimeout(connectTimeout);if(socket!==ws){ws.close();return;}ws.send(JSON.stringify(request));if(pingTimer)clearInterval(pingTimer);const ping=()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ping',nonce:performance.now()}));};ping();pingTimer=setInterval(ping,3000);};
 ws.onmessage=e=>{let m:Record<string,any>;try{m=JSON.parse(String(e.data));}catch{return;}if(socket!==ws)return;
  if(m.type==='pong'&&typeof m.nonce==='number'){const sample=Math.max(0,performance.now()-m.nonce);latency=latency===null?sample:latency*.75+sample*.25;scene.setPing(latency);}
  if(m.type==='created'||m.type==='joined'){onlinePlayer=m.player as 0|1;saveSession({code:String(m.code),token:String(m.token),url});reconnectUntil=0;if(m.type==='created')waitingRoom(String(m.code));}
  if(m.type==='error'||m.type==='resumeError'){const error=String(m.message||'Unable to join room.');closeSocket();scene.stop();roomMenu(error,url);return;}
  if(m.type==='start'){
   const state=m.state as GameState;latestOnlineState=state;onlineResult=null;onlineReady=[];onlineInMatch=false;
   const fighters:[FighterId,FighterId]=[state.fighters[0].character,state.fighters[1].character];showVersus(fighters,true);
   versusTimer=setTimeout(()=>{versusTimer=null;if(socket!==ws||!latestOnlineState)return;overlay.classList.add('hidden');exitButton.hidden=false;scene.begin('online',fighters,ws,onlinePlayer);scene.setPing(latency);scene.receive(latestOnlineState);latestOnlineState=null;onlineInMatch=true;},Math.max(0,Number(m.introMs||3200)-400));
  }
  if(m.type==='resumed'){
   onlinePlayer=m.player as 0|1;saveSession({code:String(m.code),token:String(m.token),url});reconnectUntil=0;onlineReady=Array.isArray(m.ready)?m.ready:[];const state=m.state as GameState|null;latestOnlineState=state;
   if(m.stage==='waiting')waitingRoom(String(m.code));
   else if(m.stage==='paused')recoveryScreen('Waiting for the other player to reconnect. The match is paused.');
   else if(m.stage==='playing'&&state){const fighters:[FighterId,FighterId]=[state.fighters[0].character,state.fighters[1].character];scene.begin('online',fighters,ws,onlinePlayer);scene.setPing(latency);scene.receive(state);latestOnlineState=null;onlineInMatch=true;overlay.classList.add('hidden');exitButton.hidden=false;}
   else if(m.stage==='finished'&&state){onlineInMatch=false;resultScreen(state);}
  }
  if(m.type==='state'){const state=m.state as GameState;if(versusTimer||!onlineInMatch)latestOnlineState=state;else scene.receive(state);}
  if(m.type==='roomStatus'){
   onlineReady=Array.isArray(m.ready)?m.ready:[];
   if(m.stage==='paused'){scene.setNetworkPaused(true);recoveryScreen('Waiting for the other player to reconnect. The match is paused for up to 30 seconds.');}
   else if(m.stage==='playing'){
    if(!onlineInMatch&&latestOnlineState){const state=latestOnlineState;const fighters:[FighterId,FighterId]=[state.fighters[0].character,state.fighters[1].character];scene.begin('online',fighters,ws,onlinePlayer);scene.setPing(latency);scene.receive(state);latestOnlineState=null;onlineInMatch=true;}
    if(onlineInMatch){scene.setNetworkPaused(false);overlay.classList.add('hidden');exitButton.hidden=false;}
   }else if(m.stage==='finished'&&(onlineResult||latestOnlineState)){scene.setNetworkPaused(false);onlineInMatch=false;resultScreen((onlineResult||latestOnlineState)!);}
  }
  if(m.type==='closed'){const reason=String(m.reason||'Room closed.');closeSocket();scene.stop();roomMenu(reason,url);}
 };
 ws.onerror=()=>{};
 ws.onclose=()=>{clearTimeout(connectTimeout);if(socket!==ws)return;socket=null;if(pingTimer)clearInterval(pingTimer);pingTimer=null;scene.setNetworkPaused(true);if(onlineSession){if(!reconnectUntil)reconnectUntil=Date.now()+28_000;scheduleRecovery();}else roomMenu('Unable to connect. Check the server address and that it is running.',url);};
}
function scheduleRecovery(){
 if(!onlineSession)return;if(Date.now()>=reconnectUntil){const url=onlineSession.url;saveSession(null);scene.stop();roomMenu('Could not reconnect before the room recovery window expired.',url);return;}
 recoveryScreen('Reconnecting to your room. The match is paused while the connection recovers.');
 if(retryTimer)clearTimeout(retryTimer);retryTimer=setTimeout(()=>{retryTimer=null;if(onlineSession)openConnection(onlineSession.url,{type:'resume',code:onlineSession.code,token:onlineSession.token},true);},800);
}

scene.onResult=(s)=>{onlineInMatch=false;resultScreen(s);};
scene.onExit=()=>{if(overlay.classList.contains('pause-screen')&&!overlay.classList.contains('hidden')){scene.setOptionsOpen(false);overlay.classList.add('hidden');exitButton.hidden=false;}else pauseMenu();};
scene.onPauseChange=(paused)=>{if(paused)pauseMenu();else if(!overlay.classList.contains('hidden')){overlay.classList.add('hidden');exitButton.hidden=false;}};
overlay.addEventListener('click',e=>{const el=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');if(!el)return;const a=el.dataset.action;
 if(a==='menu')menu();else if(a==='resume')scene.setPaused(false);else if(a==='resume-online'){scene.setOptionsOpen(false);overlay.classList.add('hidden');exitButton.hidden=false;}else if(a==='restart-fight'){scene.restart();overlay.classList.add('hidden');exitButton.hidden=false;}else if(a==='local'||a==='online'){mode=a;previewPlayer=0;select();}else if(a==='training-options')trainingOptions();else if(a==='training-computer'||a==='training-player'){mode='training';trainingOpponent=a==='training-computer'?'computer':'player';previewPlayer=0;select();}else if(a==='training')trainingOptions();else if(a==='select')select();else if(a==='confirm-selection'){if((mode==='local'||mode==='training')&&previewPlayer===0){previewPlayer=1;select();}else start();}else if(a==='previous-player'){previewPlayer=0;select();}else if(a==='start')start();else if(a==='fight')beginLocal();else if(a==='rematch'){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'rematch'}));}else if(a==='create'||a==='join')connect(a);else if(a?.startsWith('pick-')){const id=a.slice(5) as FighterId;if(id in FIGHTERS){selected[previewPlayer]=id;select();}}
 else if(a==='controls')screen(`<div class="kicker">HOW TO PLAY / ONE KEYBOARD</div><h2 class="panel-title">Learn the fight.</h2><p class="help">PLAYER 1: W/A/S/D move, jump and crouch · F punch · G kick · R special · T super<br><br>PLAYER 2: arrows move, jump and crouch · J punch · K kick · I special · O super<br><br>Hold DOWN with punch for a crouching punch or with kick for a sweep. Hold DOWN alone to crouch in place. Standing kick always uses the standing kick; crouching kick always sweeps.<br><br>Online: use Player 1's keys. Hold away to block. Tap toward or down to parry. Double-tap to dash. Cancel a landed attack into a special or super. P pauses local play; restart from the pause menu; Esc opens the fight menu.</p><div class="buttons">${button('← MAIN MENU','menu','primary')}</div>`);
 else if(a==='settings')settings();else if(a==='sound'){void scene.toggleAudio().then(on=>{sound=on;settings();});}
 else if(a==='credits')screen(`<div class="kicker">CREDITS / 01</div><h2 class="panel-title">Made for the fight.</h2><p class="help">NEON RIVAL is an original fighting-game prototype. Built with Phaser and TypeScript. Ryu, Elena, Gill and Dudley animation frames were extracted from user-supplied Street Fighter III sprite sheets; stage and synthesized audio are original. Ken animations are recolored fan-made Ryu frames. Street Fighter characters belong to Capcom. Moves are simplified.</p><div class="buttons">${button('← MAIN MENU','menu','primary')}</div>`);
});
function settings(){screen(`<div class="kicker">OPTIONS</div><h2 class="panel-title">Settings<span style="color:#d9ff4d">.</span></h2><p class="help">Audio starts only after you enable it. Sound and background music are synthesized original placeholders.</p><div class="buttons">${button(sound?'SOUND: ON':'SOUND: OFF','sound','primary')}${button('← MAIN MENU','menu')}</div>`);}
if(onlineSession){mode='online';reconnectUntil=Date.now()+28_000;openConnection(onlineSession.url,{type:'resume',code:onlineSession.code,token:onlineSession.token},true);}else menu();
