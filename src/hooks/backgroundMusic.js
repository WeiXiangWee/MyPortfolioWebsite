/*
  Background music: wx's "dusk lofi" loop, played quietly under the sound effects.

  - Uses the Web Audio API so the 52 s loop repeats with no gap at the seam.
  - Only plays while sound is switched on (the speaker button), fading in and out.
  - Sits below the effects: the track is mastered about 10 dB louder than the
    effects, so it plays at 25% (−12 dB) and dips to half whenever an effect plays.
  - Muting is final: every playing copy is stopped and the audio engine is paused.
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
  let buffer = null;
  let wanted = false;
  let stopTimer = 0;
  const sources = new Set(); // every copy that's playing, so mute can stop them all

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

  /** Glide the volume to a value (no clicks or jumps). */
  function rampTo(value, seconds) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(value, t + seconds);
  }

  function stopAllSources() {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    sources.clear();
  }

  /** Start (or keep) playing. Browsers only allow this after the visitor has clicked or pressed a key. */
  async function start() {
    wanted = true;
    clearTimeout(stopTimer);
    ensureContext();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const audio = await buffer;
    // the visitor may have muted while we were waiting; never start in that case
    if (!audio || !wanted || ctx.state !== 'running') return;
    if (sources.size === 0) {
      const source = ctx.createBufferSource();
      source.buffer = audio;
      source.loop = true;
      source.connect(gain);
      source.start();
      sources.add(source);
    }
    rampTo(MUSIC_VOLUME, FADE_IN);
  }

  /** Fade out, then stop every copy and pause the audio engine so nothing keeps playing. */
  function stop() {
    wanted = false;
    if (!ctx) return;
    rampTo(0, FADE_OUT);
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      if (wanted) return; // switched back on during the fade
      stopAllSources();
      ctx.suspend().catch(() => {});
    }, FADE_OUT * 1000 + 50);
  }

  /** Briefly lower the music so a sound effect cuts through, then bring it back. */
  function duck() {
    if (!ctx || !sources.size || !wanted) return;
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

  /** Shut everything down (page unload, or the sound system being replaced). */
  function dispose() {
    wanted = false;
    clearTimeout(stopTimer);
    stopAllSources();
    ctx?.close().catch(() => {});
    ctx = gain = buffer = null;
  }

  return { start, stop, duck, setHidden, dispose };
}
