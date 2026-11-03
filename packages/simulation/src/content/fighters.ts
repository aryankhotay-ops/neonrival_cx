/** Data-only fighter and move definitions. Distances and speeds use simulation tenths of a pixel. */
export type FighterId = 'kai' | 'vex' | 'ryu' | 'ken' | 'dudley';
export type MoveName = 'punch' | 'kick' | 'crouchPunch' | 'crouchKick' | 'special' | 'super';
export interface MoveDefinition {
  name:string; startup:number; active:number; recovery:number; damage:number; reach:number;
  height:'high'|'low'; stun:number; knockdown:boolean; cost:number;
  kind:'strike'|'projectile'|'self'; advance:number; projectileSpeed:number;
}
export interface FighterDefinition {
  id:FighterId; name:string; title:string; style:string; description:string; silhouette:string; traits:string;
  movement:{walk:number;dash:number;jump:number;highJump:number};
  appearance:'elena'|'gill'|'ryu'|'ken'|'dudley'; moves:Record<MoveName,MoveDefinition>;
}
const move=(name:string,startup:number,active:number,recovery:number,damage:number,reach:number,height:'high'|'low',stun:number,knockdown:boolean,cost=0,kind:'strike'|'projectile'|'self'='strike',advance=0,projectileSpeed=90):MoveDefinition=>({name,startup,active,recovery,damage,reach,height,stun,knockdown,cost,kind,advance,projectileSpeed});
const ryuMoves:Record<MoveName,MoveDefinition>={
 punch:move('Straight Punch',5,3,10,5,820,'high',15,false),kick:move('Roundhouse Kick',8,4,15,7,1120,'high',19,false),
 crouchPunch:move('Crouching Jab',5,3,12,4,760,'high',14,false),crouchKick:move('Sweep',10,4,18,8,1140,'low',21,true),
 special:move('Hadoken',12,6,20,10,1400,'high',22,true,0,'projectile',0,90),super:move('Shinku Hadoken',14,8,30,19,1650,'high',32,true,100,'projectile',0,125),
};
const kenMoves:Record<MoveName,MoveDefinition>={
 punch:move('Quick Straight',4,3,9,5,820,'high',14,false),kick:move('Roundhouse Kick',9,4,16,8,1120,'high',20,false),
 crouchPunch:move('Crouching Jab',4,3,11,4,780,'high',14,false),crouchKick:move('Sweep',9,4,18,8,1150,'low',21,true),
 special:move('Shoryuken',10,6,20,11,1050,'high',24,true,0,'strike',24),super:move('Shoryureppa',14,9,28,20,1450,'high',32,true,100,'strike',35),
};
export const FIGHTERS:Record<FighterId,FighterDefinition>={
 // Legacy IDs are retained so existing room messages remain compatible.
 kai:{id:'kai',name:'ELENA',title:'THE CAPOEIRA FIGHTER',style:'Capoeira',silhouette:'Long-legged, acrobatic stance and short white hair',traits:'Fast movement and long kicks',description:'A Kenyan fighter whose fluid capoeira emphasizes acrobatic, long-reaching kicks.',appearance:'elena',movement:{walk:34,dash:72,jump:130,highJump:160},moves:{
  // Elena uses a high kick for her standing punch-button normal.
  punch:move('High Kick',4,3,10,4,800,'high',14,false),kick:move('Standing Roundhouse',7,4,14,6,1180,'high',17,false),
  crouchPunch:move('Crouching Palm',5,3,12,4,790,'high',14,false),crouchKick:move('Capoeira Sweep',8,4,17,8,1240,'low',20,true),
  special:move('Rhino Horn',10,5,18,9,1300,'high',18,false,0,'strike',48),super:move('Brave Dance',13,7,27,18,1600,'high',28,true,100,'strike',65)}},
 vex:{id:'vex',name:'GILL',title:'THE EMPEROR',style:'Pyrokinesis and cryokinesis',silhouette:'Tall, muscular figure with long hair',traits:'Powerful close-range attacks and self-restoring super art',description:'The enigmatic final boss of New Generation, wielding fire and ice.',appearance:'gill',movement:{walk:26,dash:60,jump:115,highJump:145},moves:{
  punch:move('Straight Punch',7,4,13,6,900,'high',18,false),kick:move('Standing Heavy Kick',10,5,18,8,1220,'high',21,false),
  crouchPunch:move('Crouching Strike',6,3,13,5,820,'high',16,false),crouchKick:move('Sweep',10,5,19,8,1190,'low',22,true),
  special:move('Moonsault Knee Drop',11,5,22,10,1150,'high',24,true,0,'strike',58),super:move('Resurrection',16,8,36,0,0,'high',0,false,100,'self')}},
 dudley:{id:'dudley',name:'DUDLEY',title:'THE GENTLEMAN BOXER',style:'Boxing',silhouette:'Boxing gloves, suspenders and upright guard',traits:'Strong close-range punches and advancing pressure',description:'A British boxer who uses precise punches, footwork and relentless pressure.',appearance:'dudley',movement:{walk:29,dash:68,jump:120,highJump:150},moves:{
  punch:move('Jab',4,3,10,4,820,'high',15,false),kick:move('Standing Low Kick',8,4,15,6,920,'high',18,false),
  crouchPunch:move('Crouching Body Blow',5,3,12,4,760,'high',15,false),crouchKick:move('Sweep',9,4,17,7,1040,'low',20,true),
  special:move('Machine Gun Blow',10,7,22,10,1050,'high',22,true,0,'strike',45),super:move('Corkscrew Blow',15,7,28,18,1450,'high',30,true,100,'strike',60)}},
 ryu:{id:'ryu',name:'RYU',title:'THE WANDERER',style:'Shotokan karate',silhouette:'Traditional martial arts gi',traits:'Balanced reach, fireball and fundamentals',description:'A balanced fighter with a projectile and reliable fundamentals.',appearance:'ryu',movement:{walk:27,dash:65,jump:125,highJump:155},moves:ryuMoves},
 ken:{id:'ken',name:'KEN',title:'THE CHALLENGER',style:'Shotokan karate',silhouette:'Traditional martial arts gi',traits:'Fast advancing strikes and close-range pressure',description:'An aggressive karate fighter with an advancing uppercut and multi-hit super.',appearance:'ken',movement:{walk:27,dash:65,jump:125,highJump:155},moves:kenMoves},
};
export const MOVES=ryuMoves;
export function fighterDefinition(id:FighterId):FighterDefinition{return FIGHTERS[id];}
