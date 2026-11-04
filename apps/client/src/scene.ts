import Phaser from 'phaser';
import { createInitialState, step, TICK_MS, FIGHTERS, type CombatEvent, type FighterId, type GameState, type FighterState, type Input } from '@neon-rival/simulation';
import { trainingComputerInput } from './input/trainingComputer';
import { COMBAT_CODES, keyboardInput } from './input/keyboard';
import { AudioManager } from './audio/AudioManager';
import { advanceAnimation, movementAction, type AnimationClock } from './render/movementAnimation';
import { attackAnimationFrame, type AnimationData } from './render/attackAnimation';
interface Effect { id:string; x:number; y:number; type:CombatEvent['type']; life:number; player:0|1; move:CombatEvent['move'] }

export class FightScene extends Phaser.Scene {
  private state:GameState=createInitialState(); private accumulator=0; private keys!:Record<string,Phaser.Input.Keyboard.Key>; private art!:Phaser.GameObjects.Graphics; private hud!:Phaser.GameObjects.Graphics; private labels:Phaser.GameObjects.Text[]=[]; private sprites:Phaser.GameObjects.Image[]=[]; private paused=false; private active=false; private training=false; private trainingOpponent:'computer'|'player'='computer'; private online=false; private player:0|1=0; private socket:WebSocket|null=null; public onResult:(state:GameState)=>void=()=>{}; public onExit:()=>void=()=>{}; public onPauseChange:(paused:boolean)=>void=()=>{}; private resultShown=false; private audio=new AudioManager(); private effects:Effect[]=[]; private effectIds=new Set<string>(); private onlinePaused=false; private inputSeq=0; private snapshots:{state:GameState;time:number}[]=[]; private pingMs:number|null=null; private animationClocks:[AnimationClock|null,AnimationClock|null]=[null,null];
  private pressed=new Set<string>(); private optionsOpen=false;
  constructor(){super('fight');}
  preload():void {
    // Keep atlas image and frame metadata on the same release in browser caches.
    const revision='poses-20261104';
    for(const name of ['elena','gill','dudley','ryu','ken']){
      this.load.spritesheet(`${name}-frames`,`/assets/sf3/${name}-animations.png?v=${revision}`,{frameWidth:200,frameHeight:180});
      this.load.json(`${name}-data`,`/assets/sf3/${name}-animations.json?v=${revision}`);
    }
    this.load.image('sf3-ryu','/assets/sf3/ryu.png');this.load.image('sf3-ken','/assets/sf3/ken.png');
  }
  create():void {
    this.keys=this.input.keyboard!.addKeys('P,ESC') as Record<string,Phaser.Input.Keyboard.Key>;
    window.addEventListener('keydown',e=>{if(!this.active||!COMBAT_CODES.has(e.code))return;e.preventDefault();if(!this.paused&&!this.onlinePaused&&!this.optionsOpen&&!e.repeat)this.pressed.add(e.code);});
    window.addEventListener('keyup',e=>{this.pressed.delete(e.code);});
    window.addEventListener('blur',()=>{this.pressed.clear();if(this.active&&!this.online)this.setPaused(true);});
    const bg=this.add.graphics();
    bg.fillGradientStyle(0x192b3b,0x192b3b,0xb7755c,0xb7755c).fillRect(0,0,960,400).fillStyle(0xf4bb86).fillCircle(765,125,65);
    bg.fillStyle(0x23323b);for(let i=0;i<16;i++){const h=80+i*53%160;bg.fillRect(i*64,400-h,48,h);for(let y=415-h;y<385;y+=22)for(let x=i*64+8;x<i*64+44;x+=14)if((i+x+y)%3===0)bg.fillStyle(0xd5a16b,.7).fillRect(x,y,4,7).fillStyle(0x23323b);}
    bg.fillStyle(0x192c2e).fillRect(0,285,170,115).fillRect(755,265,205,135);
    bg.fillStyle(0xaa6250).fillRect(20,305,125,70).fillRect(785,295,135,75);bg.fillStyle(0xe7b479).fillRect(26,312,113,55).fillRect(791,302,123,61);
    // The floor begins behind the fighters and extends toward the viewer. Tile edges
    // converge on a vanishing point above the horizon, without a line at their feet.
    const floorTop=325, vanishingY=270, vanishingX=480, floorBottom=540;
    bg.fillGradientStyle(0x4d4b40,0x4d4b40,0x79534a,0x79534a).fillRect(0,floorTop,960,floorBottom-floorTop);
    const rows=[325,331,340,352,367,387,413,446,488,540];
    const project=(x:number,y:number)=>vanishingX+(x-vanishingX)*(y-vanishingY)/(floorBottom-vanishingY);
    for(let row=0;row<rows.length-1;row++){
      const top=rows[row],bottom=rows[row+1];
      for(let col=-14;col<=14;col++){
        const x=vanishingX+col*170, next=x+170;
        if((row+col)%2===0){bg.fillStyle(0xb18c72,.055+row*.006).fillPoints([
          new Phaser.Geom.Point(project(x,top),top),new Phaser.Geom.Point(project(next,top),top),
          new Phaser.Geom.Point(project(next,bottom),bottom),new Phaser.Geom.Point(project(x,bottom),bottom),
        ],true);}
      }
    }
    bg.lineStyle(1,0x2c2926,.32);
    for(let col=-14;col<=14;col++){const x=vanishingX+col*170;bg.lineBetween(project(x,floorTop),floorTop,project(x,floorBottom),floorBottom);}
    for(const y of rows.slice(1))bg.lineBetween(0,y,960,y);
    // A narrow rear curb separates the market from the receding floor.
    bg.fillStyle(0x393b33).fillRect(0,floorTop-7,960,7).fillStyle(0xc7a380,.35).fillRect(0,floorTop-7,960,1);
    bg.lineStyle(2,0x17262c).lineBetween(0,210,960,155);for(let i=0;i<10;i++){const x=i*105+24,y=210-i*6;bg.lineStyle(1,0x18262c).lineBetween(x,y,x,y+10);bg.fillStyle(i%2?0xf2bd75:0xf08069).fillCircle(x,y+14,7);}
    this.art=this.add.graphics();this.sprites=[this.add.image(0,0,'sf3-ryu').setOrigin(.5,1).setVisible(false),this.add.image(0,0,'sf3-ken').setOrigin(.5,1).setVisible(false)];this.hud=this.add.graphics();
    for(let i=0;i<8;i++)this.labels.push(this.add.text(0,0,'',{fontFamily:'Arial',fontStyle:'bold',fontSize:'18px',color:'#f4f3df'}));
  }
  public async toggleAudio():Promise<boolean>{return this.audio.toggle();}
  public begin(mode:'local'|'training'|'online',characters:[FighterId,FighterId],socket:WebSocket|null=null,player:0|1=0,trainingOpponent:'computer'|'player'='computer'):void {this.pressed.clear();this.optionsOpen=false;this.state=createInitialState(characters);this.accumulator=0;this.paused=false;this.training=mode==='training';this.trainingOpponent=trainingOpponent;this.online=mode==='online';this.socket=socket;this.player=player;this.active=true;this.resultShown=false;this.effects=[];this.effectIds.clear();this.onlinePaused=false;this.inputSeq=0;this.snapshots=[];this.animationClocks=[null,null];this.audio.reset();}
  public stop():void{this.optionsOpen=false;this.pressed.clear();this.active=false;this.online=false;this.socket=null;this.paused=false;}
  public setPaused(paused:boolean):void {if(!this.active||this.online)return;this.pressed.clear();this.accumulator=0;this.paused=paused;this.onPauseChange(paused);}
  public setOptionsOpen(open:boolean):void{this.optionsOpen=open;this.pressed.clear();}
  public get isOnlineMatch():boolean {return this.active&&this.online;}
  public restart():void {if(!this.active||this.online)return;this.pressed.clear();this.animationClocks=[null,null];this.state=createInitialState([this.state.fighters[0].character,this.state.fighters[1].character]);this.accumulator=0;this.paused=false;this.effects=[];this.effectIds.clear();this.audio.reset();this.onPauseChange(false);}
  public receive(state:GameState):void{if(!this.active||!this.online)return;this.state=state;this.snapshots.push({state,time:performance.now()});if(this.snapshots.length>10)this.snapshots.shift();this.consumeEvents(state.events);this.maybeResult();}
  public setNetworkPaused(paused:boolean):void{this.onlinePaused=paused;if(paused){this.pressed.clear();this.snapshots=[];}}
  public setPing(ms:number|null):void{this.pingMs=ms;}
  private renderPosition(index:number):{x:number;y:number}{
    const now=performance.now()-50;while(this.snapshots.length>2&&this.snapshots[1].time<=now)this.snapshots.shift();
    if(this.snapshots.length<2)return this.state.fighters[index];
    const a=this.snapshots[0],b=this.snapshots[1];const t=Math.max(0,Math.min(1,(now-a.time)/Math.max(1,b.time-a.time)));
    return {x:a.state.fighters[index].x+(b.state.fighters[index].x-a.state.fighters[index].x)*t,y:a.state.fighters[index].y+(b.state.fighters[index].y-a.state.fighters[index].y)*t};
  }
  private maybeResult():void{if(this.state.phase==='matchEnd'&&!this.resultShown){this.resultShown=true;this.active=false;this.onResult(this.state);}}
  private readInput(p:number):Input {return keyboardInput(this.optionsOpen?new Set<string>():this.pressed,p as 0|1);}
  update(_time:number,delta:number):void {
    const escape=Phaser.Input.Keyboard.JustDown(this.keys.ESC),pause=Phaser.Input.Keyboard.JustDown(this.keys.P);
    if(this.active&&(escape||pause)){if(this.online)this.onExit();else this.setPaused(!this.paused);}
    if(this.active&&!this.paused&&!this.onlinePaused){this.accumulator+=Math.min(delta,100);while(this.accumulator>=TICK_MS){
      if(this.online){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({type:'input',seq:++this.inputSeq,input:this.readInput(0)}));}
      else{const opponentInput=this.training?(this.trainingOpponent==='computer'?trainingComputerInput(this.state):this.readInput(1)):this.readInput(1);this.state=step(this.state,[this.readInput(0),opponentInput]);if(this.training){this.state.timer=99*60;this.state.fighters[0].health=100;this.state.fighters[1].health=100;if(this.state.phase!=='fight'){this.state.phase='fight';this.state.phaseTimer=0;this.state.winner=null;this.state.fighters[0].wins=0;this.state.fighters[1].wins=0;}}this.consumeEvents(this.state.events);this.maybeResult();}
      this.audio.music(this.state.frame);this.effects.forEach(e=>e.life--);this.effects=this.effects.filter(e=>e.life>0);this.accumulator-=TICK_MS;
    }}
    this.draw();
  }
  private consumeEvents(events:CombatEvent[]):void {
    for(const e of events){if(this.effectIds.has(e.id))continue;this.audio.event(e);this.effectIds.add(e.id);if(this.effectIds.size>512)this.effectIds.delete(this.effectIds.values().next().value!);
      if(e.type==='attack')this.effects.push({id:e.id,x:e.x/10,y:e.y/10-105,type:e.type,life:12,player:e.player,move:e.move});
      if(e.type==='hit'||e.type==='block'||e.type==='parry'||e.type==='heal'){this.effects.push({id:e.id,x:e.x/10,y:e.y/10-105,type:e.type,life:e.type==='heal'?38:16,player:e.player,move:e.move});if(e.type==='hit')this.cameras.main.shake(70,.002);}
    }
  }
  private fighterAnimationFrame(p:FighterState,index:0|1):number {
    const appearance=FIGHTERS[p.character].appearance;
    const data=this.cache.json.get(`${appearance}-data`) as AnimationData;
    let action='idle', clock=this.state.frame, loop=true;
    if(p.knockdown>0){loop=false;const elapsed=48-p.knockdown;
      if(p.y<4000){action='fall';clock=elapsed;}
      else if(p.knockdown>19){action='landing';clock=Math.max(0,elapsed-25);}
      else if(p.knockdown>12){action='down';clock=0;}
      else {action='rise';const duration=data.actions.rise.reduce((sum,f)=>sum+f.duration,0);clock=Math.floor((12-p.knockdown)/12*duration);}
    }
    else if(p.move){this.animationClocks[index]=advanceAnimation(this.animationClocks[index],p.move,p.character,this.state.frame);return attackAnimationFrame(data,p.move,FIGHTERS[p.character].moves[p.move],p.moveFrame);}
    else if(p.y<4000){action='jump';clock=Math.max(0,Math.min(40,Math.floor((4000-p.y)/20)));loop=false;}
    else if(p.crouching){action='crouch';clock=0;loop=false;}
    else if(Math.abs(p.vx)>0&&p.stun===0&&p.knockdown===0){action=movementAction(p.vx,p.facing);}
    this.animationClocks[index]=advanceAnimation(this.animationClocks[index],action,p.character,this.state.frame);if(loop)clock=this.animationClocks[index]!.elapsed;
    const seq=data.actions[action];const total=seq.reduce((sum,f)=>sum+f.duration,0);let tick=loop?clock%total:Math.min(clock,total-1);for(const f of seq){if(tick<f.duration)return data.frames[f.key];tick-=f.duration;}return data.frames[seq[seq.length-1].key];
  }
  private draw():void {
    const g=this.art;g.clear();
    // A soft contact shadow grounds the fighters while remaining below them during jumps.
    this.state.fighters.forEach((p,i)=>{const pos=this.online?this.renderPosition(i):p;const height=Math.max(0,400-pos.y/10);const scale=Math.max(.5,1-height/300);g.fillStyle(0x1c1716,.28*scale).fillEllipse(pos.x/10,402,100*scale,13*scale);});
    this.state.fighters.forEach((p,i)=>{const spr=this.sprites[i];const art=FIGHTERS[p.character].appearance;const pos=this.online?this.renderPosition(i):p;const palette:Record<string,number>={elena:0xf4a94f,gill:0x70eaff,ryu:0x66dfff,ken:0xff654f,dudley:0xffca5c};if(p.move==='super'){const pulse=.14+Math.sin(this.state.frame*.22)*.06;g.fillStyle(palette[art],pulse).fillCircle(pos.x/10,pos.y/10-90,105);g.lineStyle(3,palette[art],.48).strokeCircle(pos.x/10,pos.y/10-105,70+Math.sin(this.state.frame*.18)*8);}spr.setVisible(true);const frame=this.fighterAnimationFrame(p,i as 0|1);const offset=(this.cache.json.get(`${art}-data`) as AnimationData).frameOffsets?.[frame];spr.setTexture(art+'-frames',frame);spr.setOrigin(.5,155/180).setPosition(pos.x/10+(offset?.x||0)*1.5*p.facing,pos.y/10+(offset?.y||0)*1.5).setDisplaySize(300,270).setFlipX(p.facing===-1);spr.setTint(p.flash>0?0xffcccc:0xffffff);spr.setAngle(0);});
    for(const p of this.state.projectiles){const x=p.x/10,y=p.y/10;const appearance=FIGHTERS[this.state.fighters[p.owner].character].appearance;const color=appearance==='ken'?0xff5947:appearance==='gill'?0x73eaff:appearance==='dudley'?0xffc35c:appearance==='elena'?0xf79b43:0x65dcff;g.fillStyle(color,.22).fillCircle(x,y,p.move==='super'?42:28);g.fillStyle(color,.9).fillCircle(x,y,p.move==='super'?26:16);g.fillStyle(0xffffff,.8).fillCircle(x+p.direction*5,y,6);}
    for(const e of this.effects){
      if(e.type==='attack'&&e.move){const facing=this.state.fighters[e.player].facing;const alpha=e.life/12;const crouchPunch=e.move==='crouchPunch',crouchKick=e.move==='crouchKick',punch=e.move==='punch'||crouchPunch,kick=e.move==='kick'||crouchKick;const color=punch?0xfff0c2:kick?(crouchKick?0xff8c45:0xffad55):e.move==='special'?0x73eaff:0xffe077;const x=e.x+facing*18,y=e.y;if(punch){const hitY=crouchPunch?y+3:y-15;g.lineStyle(5,color,alpha).lineBetween(x,hitY,x+facing*(52+(12-e.life)*4),hitY);g.fillStyle(color,alpha*.8).fillCircle(x+facing*(52+(12-e.life)*4),hitY,5);}else if(kick){const points=crouchKick?[new Phaser.Geom.Point(x,y+42),new Phaser.Geom.Point(x+facing*35,y+48),new Phaser.Geom.Point(x+facing*68,y+43),new Phaser.Geom.Point(x+facing*88,y+34)]:[new Phaser.Geom.Point(x,y+25),new Phaser.Geom.Point(x+facing*28,y+12),new Phaser.Geom.Point(x+facing*62,y+18),new Phaser.Geom.Point(x+facing*82,y+34)];g.lineStyle(6,color,alpha).strokePoints(points);g.lineStyle(2,0xfff0c2,alpha*.8).strokePoints(points.slice(1));}else{const radius=(12-e.life)*5+15;g.lineStyle(e.move==='super'?5:3,color,alpha).strokeCircle(x+facing*35,y-18,radius);if(e.move==='super')for(let i=0;i<6;i++){const a=i*Math.PI/3;g.lineStyle(3,color,alpha).lineBetween(x+facing*35+Math.cos(a)*radius,y-18+Math.sin(a)*radius,x+facing*35+Math.cos(a)*(radius+14),y-18+Math.sin(a)*(radius+14));}}continue;}
      const color=e.type==='heal'?0x7dff9c:e.type==='parry'?0x8ef8ff:e.type==='block'?0x87bafa:0xffec99;const radius=(e.type==='heal'?38-e.life:16-e.life)*2+12;g.lineStyle(e.type==='heal'?4:3,color,e.type==='heal'?e.life/38:e.life/16).strokeCircle(e.x,e.y,radius);for(let i=0;i<8;i++){const a=i*Math.PI/4;g.lineStyle(3,color,e.type==='heal'?e.life/38:e.life/16).lineBetween(e.x+Math.cos(a)*radius,e.y+Math.sin(a)*radius,e.x+Math.cos(a)*(radius+12),e.y+Math.sin(a)*(radius+12));}
    }
    const h=this.hud;h.clear();const [a,b]=this.state.fighters;h.fillStyle(0x132027).fillRect(25,25,355,20).fillRect(580,25,355,20).fillRect(25,505,260,9).fillRect(675,505,260,9);
    h.fillStyle(0xd8ff48).fillRect(29,29,347*a.health/100,12);h.fillStyle(0xf07869).fillRect(931-347*b.health/100,29,347*b.health/100,12);
    h.fillStyle(0x7ce2e5).fillRect(28,507,254*a.meter/100,5).fillRect(932-254*b.meter/100,507,254*b.meter/100,5);
    this.labels[0].setPosition(25,50).setText(`${FIGHTERS[a.character].name}  ${'◆'.repeat(a.wins)}`);this.labels[1].setOrigin(1,0).setPosition(935,50).setText(`${'◆'.repeat(b.wins)}  ${FIGHTERS[b.character].name}`);
    this.labels[2].setOrigin(.5,0).setPosition(480,17).setFontSize(32).setText(String(Math.ceil(this.state.timer/60)).padStart(2,'0'));
    const show=this.onlinePaused?'CONNECTION PAUSED':this.paused?'PAUSED':this.state.phase!=='fight'||this.state.phaseTimer>0?this.state.message:'';
    this.labels[3].setOrigin(.5).setPosition(480,210).setFontSize(32).setText(show);
    this.labels[4].setPosition(28,95).setText(a.combo>1&&a.comboTimer>0?`${a.combo} HIT COMBO`:'');this.labels[5].setOrigin(1,0).setPosition(932,95).setText(b.combo>1&&b.comboTimer>0?`${b.combo} HIT COMBO`:'');
    this.labels[6].setPosition(25,480).setFontSize(12).setText(this.online&&this.pingMs!==null?`SUPER  •  ${Math.round(this.pingMs)} MS`:'SUPER');this.labels[7].setOrigin(1,0).setPosition(935,480).setFontSize(12).setText('SUPER');
  }
}
