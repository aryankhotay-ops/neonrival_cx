import type { CombatEvent } from '@neon-rival/simulation';
/** Original synthesized placeholders. No copyrighted Street Fighter audio is bundled. */
export class AudioManager {
  private context: AudioContext | null = null;
  private enabled = false;
  private seen = new Set<string>();
  private lastBeat = -1;
  async toggle(): Promise<boolean> {
    this.context ??= new AudioContext();
    await this.context.resume();
    this.enabled = !this.enabled;
    return this.enabled;
  }
  reset(): void { this.seen.clear(); this.lastBeat = -1; }
  private tone(freq:number,duration:number,volume:number,type:OscillatorType='sine',slide=1):void {
    if(!this.context||!this.enabled)return;
    const ctx=this.context, now=ctx.currentTime, osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq*slide),now+duration);
    gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain).connect(ctx.destination);osc.start(now);osc.stop(now+duration);
  }
  event(e:CombatEvent):void {
    if(this.seen.has(e.id))return;this.seen.add(e.id);
    if(this.seen.size>512)this.seen.delete(this.seen.values().next().value!);
    if(e.type==='attack')this.tone(e.move==='super'?170:260,.09,.045,'sawtooth',.45);
    if(e.type==='hit')this.tone(145,.14,.10,'square',.4);
    if(e.type==='block')this.tone(390,.10,.06,'triangle',.7);
    if(e.type==='parry')this.tone(880,.14,.07,'sine',1.5);
    if(e.type==='heal'){this.tone(440,.18,.07,'sine',1.5);this.tone(660,.24,.05,'triangle',1.35);}
    if(e.type==='roundEnd'||e.type==='matchEnd')this.tone(220,.35,.07,'triangle',1.7);
  }
  music(frame:number):void {
    if(!this.enabled)return;
    const beat=Math.floor(frame/15);if(beat===this.lastBeat)return;this.lastBeat=beat;
    const notes=[110,110,165,110,130.81,110,146.83,164.81];this.tone(notes[beat%notes.length],.18,.025,'triangle');
    if(beat%4===0)this.tone(55,.12,.035,'sine',.65);
  }
}
