/** Node-only menu and scene regression harness; no browser control required. */
import { build } from 'esbuild';
import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temp=await mkdtemp(join(tmpdir(),'neon-flow-'));
const phaser=`export default {Scene:class {},Game:class {},AUTO:0,Scale:{FIT:0,CENTER_BOTH:0},Input:{Keyboard:{JustDown:k=>{const v=!!k.pressed;k.pressed=false;return v}}}};`;
try {
 const output=join(temp,'scene.mjs');
 await build({entryPoints:['apps/client/src/scene.ts'],bundle:true,platform:'node',format:'esm',outfile:output,plugins:[{name:'phaser',setup(b){b.onResolve({filter:/^phaser$/},()=>({path:'phaser',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:phaser}));}}]});
 const {FightScene}=await import(pathToFileURL(output));const scene=new FightScene();scene.draw=()=>{};scene.keys={P:{},ESC:{}};let paused;scene.onPauseChange=v=>paused=v;
 scene.begin('local',['ryu','ken']);scene.pressed.add('KeyD');scene.keys.ESC.pressed=true;scene.update(0,17);assert.equal(paused,true);const frozen=JSON.stringify(scene.state);scene.update(0,1000);assert.equal(JSON.stringify(scene.state),frozen);assert.equal(scene.pressed.size,0);
 scene.keys.ESC.pressed=true;scene.update(0,17);assert.equal(paused,false);assert.equal(scene.active,true);
 scene.setPaused(true);scene.restart();assert.equal(scene.state.frame,0);assert.equal(scene.paused,false);assert.deepEqual(scene.state.fighters.map(f=>f.character),['ryu','ken']);
 scene.begin('training',['dudley','kai'],null,0,'player');scene.pressed=new Set(['KeyF','KeyK']);scene.update(0,17);assert.equal(scene.state.fighters[0].move,'punch');assert.equal(scene.state.fighters[1].move,'kick');assert.equal(scene.trainingOpponent,'player');
 scene.begin('training',['ryu','vex'],null,0,'computer');assert.equal(scene.state.fighters[1].character,'vex');assert.equal(scene.trainingOpponent,'computer');
 scene.begin('online',['ryu','ken']);scene.keys.ESC.pressed=true;let options=false;scene.onExit=()=>options=true;scene.update(0,0);assert.equal(options,true);assert.equal(scene.active,true);assert.equal(scene.paused,false);scene.pressed.add('KeyF');scene.setOptionsOpen(true);assert.equal(scene.readInput(0).punch,false);scene.setOptionsOpen(false);
 console.log('PASS: Escape/P pause routing, frozen simulation, resume, restart, two-player training, CPU selection, online options.');
 // Exercise the actual DOM menu router with a small in-memory DOM adapter.
 class Element {hidden=false;innerHTML='';classList={values:new Set(),add(...v){v.forEach(x=>this.values.add(x))},remove(...v){v.forEach(x=>this.values.delete(x))},contains(v){return this.values.has(v)}};focus(){}blur(){}querySelector(){return new Element()}addEventListener(name,fn){this[name]=fn}}
 const overlay=new Element(),exit=new Element();globalThis.HTMLElement=Element;globalThis.document={getElementById:id=>id==='overlay'?overlay:exit,activeElement:null};globalThis.sessionStorage={getItem:()=>null,removeItem(){}};
 const main=join(temp,'main.mjs');
 const sceneStub=`export class FightScene {constructor(){globalThis.menuScene=this;} stop(){} setOptionsOpen(){} setPaused(v){this.onPauseChange(v)} begin(...args){this.started=args} get isOnlineMatch(){return false}}`;
 await build({entryPoints:['apps/client/src/main.ts'],bundle:true,platform:'node',format:'esm',outfile:main,define:{'import.meta.env':'{}'},plugins:[{name:'menu-adapter',setup(b){b.onResolve({filter:/^phaser$|^\.\/scene$|\.css$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='phaser'?phaser:a.path==='./scene'?sceneStub:'',loader:'js'}));}}]});
 await import(pathToFileURL(main));const click=action=>overlay.click({target:{closest:()=>({dataset:{action}})}});
 click('training');assert.match(overlay.innerHTML,/VS COMPUTER/);assert.match(overlay.innerHTML,/VS PLAYER/);
 for(const type of ['computer','player']){click('training-'+type);click('pick-dudley');click('confirm-selection');assert.match(overlay.innerHTML,type==='computer'?/CHOOSE COMPUTER/:/PLAYER 2, CHOOSE/);click('pick-kai');click('confirm-selection');click('fight');assert.deepEqual(globalThis.menuScene.started.slice(0,2),['training',['dudley','kai']]);assert.equal(globalThis.menuScene.started[4],type);exit.onclick();assert.match(overlay.innerHTML,/RESUME FIGHT/);assert.doesNotMatch(overlay.innerHTML,/OWN THE/);click('resume');assert.ok(overlay.classList.contains('hidden'));click('menu');assert.ok(!overlay.classList.contains('pause-screen'));}
 console.log('PASS: actual menu routing through both training choices, both fighter selections, versus, fight, pause, resume and main menu.');
} finally {await rm(temp,{recursive:true,force:true});}
