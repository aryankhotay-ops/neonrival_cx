import { FIGHTERS, NEUTRAL, type GameState, type Input } from '@neon-rival/simulation';
/** A small deterministic sparring controller. Uses the same input path as a player. */
export function trainingComputerInput(state:GameState):Input {
 const cpu=state.fighters[1],opponent=state.fighters[0],distance=opponent.x-cpu.x,range=Math.abs(distance),towardRight=distance>0;
 const input={...NEUTRAL},moves=FIGHTERS[cpu.character].moves;
 if(cpu.stun>0||cpu.knockdown>0)return input;
 const incoming=opponent.move?FIGHTERS[opponent.character].moves[opponent.move]:null;
 if(incoming&&opponent.moveFrame>=Math.max(0,incoming.startup-6)&&opponent.moveFrame<incoming.startup+incoming.active&&range<incoming.reach+250&&!cpu.move){input.left=towardRight;input.right=!towardRight;input.down=incoming.height==='low';return input;}
 if(cpu.move)return input;
 if(range>Math.min(moves.punch.reach,moves.kick.reach)*.85){
  input.right=towardRight;input.left=!towardRight;
  if(state.frame%90===0&&range<moves.special.reach)input.special=true;
  return input;
 }
 if(cpu.meter>=100&&state.frame%96===0)input.super=true;
 else if(state.frame%72===0)input.special=true;
 else if(state.frame%40===0){input.kick=true;input.down=state.frame%80===0;}
 else if(state.frame%40===20)input.punch=true;
 return input;
}
