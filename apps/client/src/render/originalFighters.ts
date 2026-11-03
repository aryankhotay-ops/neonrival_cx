import type { FighterState } from '@neon-rival/simulation';
/** Replace these paths with final licensed sprite assets without changing combat. */
export const ORIGINAL_POSES = ['idle','walk-a','walk-b','punch','kick','special','fall'] as const;
export const ORIGINAL_ART:Record<'nova'|'rook',Record<OriginalPose,string>>=Object.fromEntries(
  ['nova','rook'].map(name=>[name,Object.fromEntries(ORIGINAL_POSES.map(pose=>[pose,`/assets/original/${name}-${pose}.svg`]))]),
) as Record<'nova'|'rook',Record<OriginalPose,string>>;
export type OriginalPose = typeof ORIGINAL_POSES[number];
export function originalPose(p:FighterState,frame:number):OriginalPose {
  if(p.knockdown>0)return 'fall';
  if(p.move==='punch')return 'punch';
  if(p.move==='kick')return 'kick';
  if(p.move==='special'||p.move==='super')return 'special';
  if(Math.abs(p.vx)>0&&p.stun===0)return Math.floor(frame/7)%2?'walk-a':'walk-b';
  return 'idle';
}
