import type { MoveDefinition, MoveName } from '@neon-rival/simulation';

export interface AnimationData {
  frames:Record<string,number>;
  actions:Record<string,{key:string;duration:number}[]>;
  attackPhases?:Partial<Record<MoveName,{startup:string[];active:string[];recovery:string[]}>>;
  frameOffsets?:Record<number,{x:number;y:number}>;
}
/** Contact poses follow the simulation's active window, independent of clip length. */
export function attackAnimationFrame(data:AnimationData,action:MoveName,timing:MoveDefinition,moveFrame:number):number {
  const phases=data.attackPhases?.[action];
  if(phases){
    const phase=moveFrame<timing.startup?'startup':moveFrame<timing.startup+timing.active?'active':'recovery';
    const offset=phase==='startup'?0:phase==='active'?timing.startup:timing.startup+timing.active;
    const duration=timing[phase];const keys=phases[phase];
    const progress=Math.max(0,Math.min(1,(moveFrame-offset)/Math.max(1,duration)));
    return data.frames[keys[Math.min(keys.length-1,Math.floor(progress*keys.length))]];
  }
  const seq=data.actions[action];const duration=seq.reduce((sum,f)=>sum+f.duration,0);
  const length=timing.startup+timing.active+timing.recovery;
  let tick=Math.floor(Math.max(0,Math.min(1,moveFrame/length))*Math.max(0,duration-1));
  for(const f of seq){if(tick<f.duration)return data.frames[f.key];tick-=f.duration;}
  return data.frames[seq.at(-1)!.key];
}
