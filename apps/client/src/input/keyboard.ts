import { NEUTRAL, type Input } from '@neon-rival/simulation';
export const PLAYER_KEYS = [
 {left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS',punch:'KeyF',kick:'KeyG',special:'KeyR',super:'KeyT'},
 {left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown',punch:'KeyJ',kick:'KeyK',special:'KeyI',super:'KeyO'},
] as const;
export const COMBAT_CODES = new Set<string>(PLAYER_KEYS.flatMap(keys=>Object.values(keys)));
export function keyboardInput(pressed:ReadonlySet<string>,player:0|1):Input {
 const input={...NEUTRAL};
 for(const action of Object.keys(input) as (keyof Input)[])input[action]=pressed.has(PLAYER_KEYS[player][action]);
 return input;
}
