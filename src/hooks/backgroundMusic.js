/*
  Background music: wx's "dusk lofi" loop, played quietly under the sound effects.

  - Uses the Web Audio API so the 52 s loop repeats with no gap at the seam.
  - Only plays while sound is switched on (the speaker button), fading in and out.
  - Sits below the effects: the track is mastered about 10 dB louder than the
    effects, so it plays at 25% (−12 dB) and dips to half whenever an effect plays.
  - Pauses while the tab is hidden.
*/
const MUSIC_URL = '/music/dusk-lofi-loop.mp3';
export const MUSIC_VOLUME = 0.25; // −12 dB: just under the bark and clicks (ducking keeps effects clear)
const DUCK_TO = 0.5; // while a sound effect plays, the music dips to half (−6 dB)
const FADE_IN = 2; // seconds
const FADE_OUT = 0.6; // seconds

export function createMusic() {
  let ctx = null;
  let gain = null;
  let source = null;
  let buffer = null;
  let wanted = false;

  function ensureContext() {
    if (ctx) return;
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    buffer = fetch(MUSIC_URL)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null); // no music is fine; the site works without it
  }

  /** Glide the volume to a value over a few seconds (no clicks or jumps). */
  function rampTo(value, seconds) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(value, t + seconds);
  }

  /** Start (or keep) playing. Browsers only allow this after the visitor has clicked or pressed a key. */
  async function start() {
    wanted = true;
    ensureContext();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const audio = await buffer;
    if (!audio || !wanted || ctx.state !== 'running') return;
    if (!source) {
      source = ctx.createBufferSource();
      source.buffer = audio;
      source.loop = true;
      source.connect(gain);
      source.start();
    }
    rampTo(MUSIC_VOLUME, FADE_IN);
  }

  /** Fade out and stop. */
  function stop() {
    wanted = false;
    if (!ctx) return;
    rampTo(0, FADE_OUT);
    const old = source;
    source = null;
    setTimeout(() => {
      try {
        old?.stop();
      } catch {
        /* already stopped */
      }
    }, FADE_OUT * 1000 + 50);
  }

  /** Briefly lower the music so a sound effect cuts through, then bring it back. */
  function duck() {
    if (!ctx || !source || !wanted) return;
    const t = ctx.currentTime;
    const g = gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(MUSIC_VOLUME * DUCK_TO, t + 0.05);
    g.setValueAtTime(MUSIC_VOLUME * DUCK_TO, t + 0.55);
    g.linearRampToValueAtTime(MUSIC_VOLUME, t + 1);
  }

  /** Pause while the tab is hidden, carry on when it's back. */
  function setHidden(hidden) {
    if (!ctx) return;
    if (hidden) ctx.suspend().catch(() => {});
    else if (wanted) start();
  }

  return { start, stop, duck, setHidden };
}
