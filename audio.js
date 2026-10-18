(function () {
  const store = { get(k, d) { try { const v = localStorage.getItem('sg_' + k); return v == null ? d : v === '1'; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem('sg_' + k, v ? '1' : '0'); } catch (_) {} } };
  const S = { music: store.get('music', true), voice: store.get('voice', true), sfx: store.get('sfx', true) };
  let ctx = null, master = null, musicGain = null, sfxGain = null, musicTimer = null, unlocked = false;

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
    }
    return ctx;
  }
  function tone(freq, t0, dur, opts) {
    const o = opts || {}; const c = ac(); if (!c) return;
    const osc = c.createOscillator(); const g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = freq * 0.012; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.1); }
    const peak = o.gain || 0.2, a = o.attack || 0.01;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.dest || sfxGain); osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, gain, freq) {
    const c = ac(); if (!c) return;
    const b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 800;
    const g = c.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t0);
  }

  const SFX = {
    tap() { const t = ac().currentTime; tone(660, t, 0.08, { gain: 0.08, type: 'triangle' }); },
    yay() { const t = ac().currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.35, { gain: 0.14, type: 'triangle' })); },
    oops() { const t = ac().currentTime; tone(330, t, 0.18, { gain: 0.1, type: 'sine', slideTo: 247 }); tone(247, t + 0.18, 0.25, { gain: 0.08 }); },
    coin() { const t = ac().currentTime; tone(988, t, 0.08, { gain: 0.12, type: 'square' }); tone(1319, t + 0.08, 0.25, { gain: 0.1, type: 'square' }); },
    ghanti() { const t = ac().currentTime; [1, 2.76, 5.4].forEach((m, i) => tone(880 * m, t, 1.6 - i * 0.4, { gain: 0.12 / (i + 1) })); },
    shankh() { const t = ac().currentTime; tone(233, t, 1.1, { gain: 0.16, type: 'sawtooth', attack: 0.25, vib: true }); tone(466, t, 1.1, { gain: 0.05, type: 'triangle', attack: 0.25 }); },
    dholak() { const t = ac().currentTime; tone(150, t, 0.3, { gain: 0.35, slideTo: 70 }); noise(t, 0.08, 0.25, 1800); tone(300, t + 0.22, 0.2, { gain: 0.2, slideTo: 140 }); },
    bansuri() { const t = ac().currentTime; tone(784, t, 0.9, { gain: 0.15, attack: 0.08, vib: true }); noise(t, 0.12, 0.04, 3000); }
  };

  // Background music: soft tanpura-style drone + bansuri-like pentatonic melody (generated live).
  const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
  let step = 0, idx = 2;
  function musicTick() {
    const c = ac(); if (!c || !S.music) return;
    const t = c.currentTime + 0.05;
    if (step % 8 === 0) { [130.81, 196.0, 261.63].forEach((f, i) => tone(f, t + i * 0.5, 3.6, { gain: 0.035, type: 'triangle', attack: 0.6, dest: musicGain })); }
    if (step % 2 === 0 && Math.random() > 0.2) {
      idx = Math.max(0, Math.min(scale.length - 1, idx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      tone(scale[idx] * 2, t, 0.9, { gain: 0.05, attack: 0.07, vib: true, dest: musicGain });
    }
    if (step % 4 === 2) tone(98, t, 0.25, { gain: 0.05, slideTo: 60, dest: musicGain });
    step++;
  }
  function setMusic(on) {
    const c = ac(); if (!c) return;
    musicGain.gain.cancelScheduledValues(c.currentTime);
    musicGain.gain.linearRampToValueAtTime(on ? 0.8 : 0, c.currentTime + 0.6);
    if (on && !musicTimer) musicTimer = setInterval(musicTick, 480);
    if (!on && musicTimer) { setTimeout(() => { if (!S.music) { clearInterval(musicTimer); musicTimer = null; } }, 700); }
  }
  function duck(on) { if (!ctx || !S.music) return; musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.linearRampToValueAtTime(on ? 0.25 : 0.8, ctx.currentTime + 0.3); }

  // Voices: the phone's built-in speech, tuned per character.
  const VO = { 'Acharya Ji': { pitch: 0.65, rate: 0.85 }, 'Sneh Didi': { pitch: 1.35, rate: 1.0 }, 'Mithu': { pitch: 1.9, rate: 1.1 }, 'pet': { pitch: 1.7, rate: 1.05 } };
  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /en-IN/i.test(v.lang)) || vs.find((v) => /hi-IN/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  let lastLine = '';
  // Recorded ElevenLabs voices: text -> mp3. Falls back to the phone's voice for anything not recorded.
  const VO_INDEX = window.SG_VO || {};
  const vkey = (t) => t.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  const player = new Audio(); player.preload = 'auto';
  player.addEventListener('playing', () => duck(true));
  player.addEventListener('ended', () => duck(false));
  player.addEventListener('pause', () => duck(false));
  function stopVoice() { try { player.pause(); } catch (_) {} if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  function say(who, text) {
    if (!S.voice || !text) return;
    stopVoice();
    const file = VO_INDEX[vkey(text)];
    if (file) {
      player.src = 'vo/' + file; player.currentTime = 0;
      const p = player.play(); if (p && p.catch) p.catch(() => {});
      return;
    }
    if (!('speechSynthesis' in window)) return;
    const clean = text.replace(/[★☆✓→←·]/g, ' ').replace(/\+(\d+)/g, 'plus $1');
    const u = new SpeechSynthesisUtterance(clean);
    const p = VO[who] || VO['pet'];
    u.pitch = p.pitch; u.rate = p.rate; if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-IN';
    u.onstart = () => duck(true); u.onend = () => duck(false); u.onerror = () => duck(false);
    speechSynthesis.speak(u);
  }

  function unlock() {
    if (unlocked) return; unlocked = true;
    const c = ac(); if (c && c.state === 'suspended') c.resume();
    if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
    try { player.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'; const p = player.play(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
    setMusic(S.music);
    setTimeout(() => window.App && App.render && App.render(), 50);
  }
  document.addEventListener('pointerdown', unlock, { capture: true });

  const NAMES = ['Acharya Ji', 'Sneh Didi', 'Mithu'];
  const INSTR = { Ghanti: 'ghanti', Shankh: 'shankh', Dholak: 'dholak', Bansuri: 'bansuri' };
  let lastLit = '';
  window.SGAudio = {
    onNavigate() { lastLine = ''; lastLit = ''; stopVoice(); },
    afterRender(screen, root) {
      root.querySelectorAll('[data-audio-toggle]').forEach((b) => {
        const k = b.getAttribute('data-audio-toggle'); const on = S[k];
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.style.background = on ? '#2F6B2C' : '#FFFFFF'; b.style.color = on ? '#FFFFFF' : '#6B5A50';
        const lab = b.querySelector('[data-label]'); if (lab) lab.textContent = (k === 'music' ? 'Music' : 'Voice') + (on ? ' on' : ' off');
      });
      if (!unlocked || /^P/.test(screen)) return;
      // Echo game: play the instrument that lights up.
      if (screen === 'KEcho') {
        let lit = '';
        root.querySelectorAll('button[aria-label]').forEach((b) => { if ((b.getAttribute('style') || '').includes('scale(1.06)')) lit = b.getAttribute('aria-label'); });
        if (lit && lit !== lastLit && INSTR[lit] && S.sfx) SFX[INSTR[lit]]();
        lastLit = lit;
      }
      let who = null, text = null;
      const tagged = root.querySelector('[data-say-who]');
      if (tagged) { who = tagged.getAttribute('data-say-who'); text = tagged.textContent.trim(); }
      if (!text) {
        for (const sp of root.querySelectorAll('span')) {
          const n = sp.textContent.trim();
          if (NAMES.includes(n) && sp.nextElementSibling && sp.children.length === 0) { who = n; text = sp.nextElementSibling.textContent.trim(); break; }
        }
      }
      if (text && text !== lastLine) {
        const fresh = lastLine !== '';
        lastLine = text;
        if (S.sfx && fresh) { if (/^(Shabaash|Wah|Yay|You did it|You remembered|So kind|Brave|Good!|You chose)/i.test(text)) SFX.yay(); else if (/^(Oops|Hmm|You gave|Dadi might|Hiding)/i.test(text)) SFX.oops(); }
        say(who, text);
      }
    }
  };

  document.addEventListener('click', (e) => {
    const tg = e.target.closest && e.target.closest('[data-audio-toggle]');
    if (tg) { const k = tg.getAttribute('data-audio-toggle'); S[k] = !S[k]; store.set(k, S[k]); if (k === 'music') setMusic(S[k]); if (k === 'voice' && !S[k]) stopVoice(); window.App && App.render(); e.preventDefault(); return; }
    if (!S.sfx || !ctx) return;
    const b = e.target.closest && e.target.closest('button, a');
    if (!b) return;
    const lab = b.getAttribute('aria-label') || '';
    if (INSTR[lab]) { SFX[INSTR[lab]](); return; }
    const txt = (b.textContent || '').trim();
    if (/Collect|bricks|Build here|Place here/i.test(txt)) SFX.coin(); else SFX.tap();
  }, true);
})();
