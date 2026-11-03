/** Pure 60 Hz simulation. Coordinates and velocities are integer tenths of a pixel. */
export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;
export const GROUND = 4000;
import { FIGHTERS, MOVES, type FighterId, type MoveName, type MoveDefinition } from './content/fighters';
export { FIGHTERS, MOVES } from './content/fighters';
export type { FighterId, MoveName, FighterDefinition, MoveDefinition } from './content/fighters';
export interface Input { left: boolean; right: boolean; down: boolean; up: boolean; punch: boolean; kick: boolean; special: boolean; super: boolean }
export const NEUTRAL: Input = { left:false, right:false, down:false, up:false, punch:false, kick:false, special:false, super:false };
export interface Projectile { owner:0|1; x:number; y:number; direction:1|-1; move:'special'|'super'; }
export interface FighterState {
  character:FighterId;
  x:number; y:number; vx:number; vy:number; facing:1|-1; health:number; meter:number; wins:number; crouching:boolean;
  move:MoveName|null; moveFrame:number; moveHit:boolean; stun:number; knockdown:number; parryHigh:number; parryLow:number;
  previous:Input; lastLeft:number; lastRight:number; dash:number; combo:number; comboTimer:number; flash:number;
}
export type CombatEventType = 'attack' | 'hit' | 'block' | 'parry' | 'knockdown' | 'heal' | 'roundEnd' | 'matchEnd';
export interface CombatEvent { id:string; type:CombatEventType; player:0|1; x:number; y:number; move:MoveName|null }
export interface GameState { projectiles:Projectile[]; events:CombatEvent[]; frame:number; fighters:[FighterState,FighterState]; timer:number; round:number; phase:'fight'|'roundEnd'|'matchEnd'; phaseTimer:number; message:string; winner:0|1|2|null }
const fighter=(x:number,facing:1|-1,character:FighterId):FighterState=>({character,x,y:GROUND,vx:0,vy:0,facing,health:100,meter:0,wins:0,crouching:false,move:null,moveFrame:0,moveHit:false,stun:0,knockdown:0,parryHigh:0,parryLow:0,previous:{...NEUTRAL},lastLeft:-100,lastRight:-100,dash:0,combo:0,comboTimer:0,flash:0});
export function createInitialState(characters:[FighterId,FighterId]=['kai','vex']):GameState { return {projectiles:[],events:[],frame:0,fighters:[fighter(2750,1,characters[0]),fighter(6850,-1,characters[1])],timer:99*60,round:1,phase:'fight',phaseTimer:0,message:'ROUND 1',winner:null}; }
const edge=(v:boolean,old:boolean)=>v&&!old;
function resetRound(s:GameState):void { const [a,b]=s.fighters; const aw=a.wins,bw=b.wins; s.fighters=[fighter(2750,1,a.character),fighter(6850,-1,b.character)];s.fighters[0].wins=aw;s.fighters[1].wins=bw;s.projectiles=[];s.timer=99*60;s.phase='fight';s.phaseTimer=90;s.message=`ROUND ${s.round}`;s.winner=null; }
function emit(s:GameState,type:CombatEventType,player:0|1,move:MoveName|null=null):void {const p=s.fighters[player];s.events.push({id:`${s.frame}:${s.events.length}:${type}:${player}`,type,player,x:p.x,y:p.y,move});}
function beginMove(s:GameState,p:FighterState,name:MoveName):void {emit(s,'attack',s.fighters[0]===p?0:1,name);p.move=name;p.moveFrame=0;p.moveHit=false;p.crouching=name==='crouchPunch'||name==='crouchKick';p.meter-=FIGHTERS[p.character].moves[name].cost;}
function resolveHit(s:GameState,att:FighterState,def:FighterState,inp:Input,m:MoveDefinition,hitMove:MoveName|null=att.move,dir:1|-1=att.facing,projectile=false):void {
  const victim:0|1=s.fighters[0]===def?0:1;
  const canParry=(m.height==='low'?def.parryLow:def.parryHigh)>0 && def.knockdown===0;
  const away=def.facing===1?inp.left:inp.right;
  const block=away&&def.y===GROUND&&def.stun===0&&def.knockdown===0&&(!def.move)&&(m.height==='low'?inp.down:true);
  if(canParry){emit(s,'parry',victim,hitMove);def.parryHigh=0;def.parryLow=0;def.flash=14;if(!projectile)att.stun=8;return;}
  if(block){emit(s,'block',victim,hitMove);def.health=Math.max(0,def.health-(m.cost||m.damage>=14?2:0));def.stun=9;def.vx=dir*20;def.flash=6;att.meter=Math.min(100,att.meter+3);return;}
  emit(s,'hit',victim,hitMove);
  def.health=Math.max(0,def.health-m.damage);def.stun=m.stun;def.vx=dir*48;def.flash=10;def.move=null;
  if(m.knockdown){emit(s,'knockdown',victim,hitMove);def.knockdown=48;def.vy=-75;}
  att.combo=att.comboTimer>0?att.combo+1:1;att.comboTimer=90;att.meter=Math.min(100,att.meter+9);def.meter=Math.min(100,def.meter+5);
}
function updateFighter(s:GameState,p:FighterState,other:FighterState,input:Input,otherInput:Input):void {
  const old=p.previous, leftPress=edge(input.left,old.left), rightPress=edge(input.right,old.right);
  p.crouching=p.knockdown===0&&p.stun===0&&p.y===GROUND&&(p.move?p.move==='crouchPunch'||p.move==='crouchKick':input.down);
  if(leftPress){if(s.frame-p.lastLeft<=12)p.dash=-1;p.lastLeft=s.frame;}
  if(rightPress){if(s.frame-p.lastRight<=12)p.dash=1;p.lastRight=s.frame;}
  if(p.flash>0)p.flash--;
  if(p.comboTimer>0)p.comboTimer--;else p.combo=0;
  if(p.stun>0)p.stun--;if(p.knockdown>0)p.knockdown--;
  if(p.stun===0&&p.knockdown===0){
    const choose:MoveName|null=edge(input.super,old.super)?'super':edge(input.special,old.special)?'special':edge(input.kick,old.kick)?(input.down&&p.y===GROUND?'crouchKick':'kick'):edge(input.punch,old.punch)?(input.down&&p.y===GROUND?'crouchPunch':'punch'):null;
    const canCancel=p.move!==null&&p.moveHit&&p.moveFrame>=FIGHTERS[p.character].moves[p.move].startup&&(choose==='special'||choose==='super')&&(p.move!=='super');
    if(choose&&p.meter>=FIGHTERS[p.character].moves[choose].cost&&(!p.move||canCancel))beginMove(s,p,choose);
    if(!p.move){
      const speed=FIGHTERS[p.character].movement.walk;p.vx=(input.right?speed:0)-(input.left?speed:0);
      if(p.dash!==0){p.vx=p.dash*FIGHTERS[p.character].movement.dash;p.dash=0;}
      if(input.down&&p.y===GROUND)p.vx=0;
      if(edge(input.up,old.up)&&p.y===GROUND){p.vy=old.down?-FIGHTERS[p.character].movement.highJump:-FIGHTERS[p.character].movement.jump;}
    }else {const m=FIGHTERS[p.character].moves[p.move];p.vx=p.moveFrame>=m.startup-2&&p.moveFrame<m.startup+m.active?p.facing*m.advance:0;}
  }else p.vx=Math.trunc(p.vx*0.8);
  p.x=Math.max(350,Math.min(9250,p.x+p.vx));p.y+=p.vy;p.vy+=6;if(p.y>=GROUND){p.y=GROUND;p.vy=0;}
  if(p.move){const m=FIGHTERS[p.character].moves[p.move];p.moveFrame++;
    const fireball=m.kind==='projectile';
    if(fireball&&p.moveFrame===m.startup){s.projectiles.push({owner:s.fighters[0]===p?0:1,x:p.x+p.facing*500,y:p.y-1000,direction:p.facing,move:p.move as 'special'|'super'});}
    if(m.kind==='self'&&p.moveFrame===m.startup&&!p.moveHit){p.moveHit=true;p.health=Math.min(100,p.health+35);emit(s,'heal',s.fighters[0]===p?0:1,p.move);}
    if(m.kind==='strike'&&!p.moveHit&&p.moveFrame>=m.startup&&p.moveFrame<m.startup+m.active&&Math.abs(p.x-other.x)<=m.reach&&Math.abs(p.y-other.y)<800&&(other.x-p.x)*p.facing>0&&other.knockdown===0){p.moveHit=true;resolveHit(s,p,other,otherInput,m);}
    if(p.moveFrame>=m.startup+m.active+m.recovery)p.move=null;}

  p.previous={...input};
}
export function step(state:GameState,inputs:[Input,Input]=[{...NEUTRAL},{...NEUTRAL}]):GameState {
  const s:GameState={...state,events:[],projectiles:state.projectiles.map(p=>({...p})),fighters:state.fighters.map(p=>({...p,previous:{...p.previous}})) as [FighterState,FighterState]};s.frame++;
  if(s.phase==='matchEnd')return s;
  if(s.phase==='roundEnd'){
    // Finish knockdown physics after a KO; defeated fighters stay down until the next round.
    for(const p of s.fighters){if(p.knockdown>0){if(p.health>0||p.knockdown>13)p.knockdown--;p.x=Math.max(350,Math.min(9250,p.x+p.vx));p.vx=Math.trunc(p.vx*.8);if(p.y<GROUND||p.vy<0){p.y+=p.vy;p.vy+=6;if(p.y>=GROUND){p.y=GROUND;p.vy=0;}}}}
    if(--s.phaseTimer<=0){if(s.fighters.some(p=>p.wins>=2)){s.phase='matchEnd';emit(s,'matchEnd',s.fighters[0].wins>s.fighters[1].wins?0:1);s.message=s.fighters[0].wins>s.fighters[1].wins?'PLAYER 1 WINS THE MATCH':'PLAYER 2 WINS THE MATCH';}else{s.round++;resetRound(s);}}return s;}
  if(s.phaseTimer>0)s.phaseTimer--;
  const [a,b]=s.fighters;a.facing=a.x<=b.x?1:-1;b.facing=a.facing===1?-1:1;
  for(let i=0;i<2;i++){const p=s.fighters[i], input=inputs[i];if(p.parryHigh>0)p.parryHigh--;if(p.parryLow>0)p.parryLow--;if(p.stun===0&&p.knockdown===0){if(p.facing===1?edge(input.right,p.previous.right):edge(input.left,p.previous.left))p.parryHigh=7;if(edge(input.down,p.previous.down))p.parryLow=7;}}
  updateFighter(s,a,b,inputs[0],inputs[1]);updateFighter(s,b,a,inputs[1],inputs[0]);
  s.projectiles=s.projectiles.filter(p=>{const attacker=s.fighters[p.owner], target=s.fighters[1-p.owner];const move=FIGHTERS[attacker.character].moves[p.move];p.x+=p.direction*move.projectileSpeed;if(Math.abs(p.x-target.x)<400&&Math.abs(p.y-(target.y-1000))<700&&target.knockdown===0){resolveHit(s,attacker,target,inputs[1-p.owner],move,p.move,p.direction,true);if(attacker.move===p.move)attacker.moveHit=true;return false;}return p.x>0&&p.x<9600;});
  if(Math.abs(a.x-b.x)<600){const overlap=600-Math.abs(a.x-b.x);a.x=Math.max(350,a.x-a.facing*Math.ceil(overlap/2));b.x=Math.min(9250,b.x+a.facing*Math.floor(overlap/2));}
  s.timer=Math.max(0,s.timer-1);
  if(a.health<=0||b.health<=0||s.timer===0){s.phase='roundEnd';emit(s,'roundEnd',a.health>=b.health?0:1);s.phaseTimer=150;s.winner=a.health===b.health?0:a.health>b.health?1:2;if(s.winner===1)a.wins++;if(s.winner===2)b.wins++;s.message=s.winner===0?'DRAW':s.winner===1?'PLAYER 1 TAKES THE ROUND':'PLAYER 2 TAKES THE ROUND';}
  return s;
}
