/** Presentation-only animation phase; the authoritative combat state is unchanged. */
export interface AnimationClock { action:string; character:string; elapsed:number; stateFrame:number }
export function advanceAnimation(previous:AnimationClock|null,action:string,character:string,stateFrame:number):AnimationClock {
  if(!previous||previous.action!==action||previous.character!==character||stateFrame<previous.stateFrame)
    return {action,character,elapsed:0,stateFrame};
  // A long network gap should not jump through an entire walking cycle at once.
  const delta=Math.min(8,Math.max(0,stateFrame-previous.stateFrame));
  return {action,character,elapsed:previous.elapsed+delta,stateFrame};
}
export function movementAction(vx:number,facing:1|-1):'idle'|'walk'|'back' {
  return vx===0?'idle':vx*facing>0?'walk':'back';
}
