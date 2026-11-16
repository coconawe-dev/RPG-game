// 아주 작은 WebAudio 효과음 신스 (외부 파일 없이)
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }

  init() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.enabled = false; return; }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.28;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.enabled = false;
    }
  }

  tone(opts) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const o = opts || {};
    const now = this.ctx.currentTime + (o.delay || 0);
    const dur = o.dur === undefined ? 0.16 : o.dur;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, now);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), now + dur);
    const vol = o.vol === undefined ? 0.5 : o.vol;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.value = vol === undefined ? 0.35 : vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
  }

  swing() { this.tone({ freq: 520, to: 190, dur: 0.16, type: 'triangle', vol: 0.32 }); this.noise(0.12, 0.16, 2400); }
  hit() { this.tone({ freq: 180, to: 70, dur: 0.14, type: 'square', vol: 0.28 }); this.noise(0.1, 0.24, 900); }
  crit() { this.tone({ freq: 720, to: 240, dur: 0.18, type: 'square', vol: 0.3 }); this.noise(0.16, 0.3, 1600); }
  bow() { this.tone({ freq: 900, to: 320, dur: 0.12, type: 'triangle', vol: 0.24 }); this.noise(0.08, 0.14, 3200); }
  orb() { this.tone({ freq: 320, to: 780, dur: 0.22, type: 'sine', vol: 0.24 }); }
  magic() { this.tone({ freq: 240, to: 900, dur: 0.3, type: 'sine', vol: 0.26 }); this.tone({ freq: 480, to: 1200, dur: 0.24, type: 'triangle', vol: 0.14, delay: 0.05 }); }
  hurt() { this.tone({ freq: 260, to: 90, dur: 0.2, type: 'sawtooth', vol: 0.24 }); }
  levelup() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.22, type: 'sine', vol: 0.22, delay: i * 0.08 })); }
  skill() { this.tone({ freq: 420, to: 880, dur: 0.22, type: 'triangle', vol: 0.26 }); }
  boss() { this.tone({ freq: 90, to: 48, dur: 1.1, type: 'sawtooth', vol: 0.3 }); this.noise(0.9, 0.24, 420); }
  victory() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ freq: f, dur: 0.5, type: 'triangle', vol: 0.2, delay: i * 0.13 }));
  }
  death() { [330, 262, 196, 147].forEach((f, i) => this.tone({ freq: f, dur: 0.4, type: 'sine', vol: 0.22, delay: i * 0.14 })); }
  gate() { this.tone({ freq: 300, to: 420, dur: 0.4, type: 'sine', vol: 0.16 }); }
  coin() { this.tone({ freq: 880, dur: 0.09, type: 'triangle', vol: 0.2 }); this.tone({ freq: 1320, dur: 0.12, type: 'triangle', vol: 0.16, delay: 0.07 }); }
  potion() { this.tone({ freq: 300, to: 760, dur: 0.26, type: 'sine', vol: 0.22 }); this.noise(0.14, 0.08, 2600); }
  // 대쉬: 바람을 가르고 내닫는 소리
  dash() { this.noise(0.16, 0.26, 1900); this.tone({ freq: 620, to: 190, dur: 0.15, type: 'triangle', vol: 0.2 }); }
  dashDeny() { this.tone({ freq: 150, to: 110, dur: 0.1, type: 'square', vol: 0.12 }); }
  // 막기: 금속이 맞물리는 짧은 쇳소리
  block() {
    this.tone({ freq: 1580, to: 980, dur: 0.1, type: 'square', vol: 0.16 });
    this.tone({ freq: 2520, to: 1500, dur: 0.16, type: 'triangle', vol: 0.11, delay: 0.01 });
    this.noise(0.07, 0.18, 4200);
  }
  staminaOut() { this.tone({ freq: 200, to: 90, dur: 0.28, type: 'sawtooth', vol: 0.18 }); }
  staminaReady() { this.tone({ freq: 520, to: 780, dur: 0.18, type: 'sine', vol: 0.14 }); this.tone({ freq: 780, dur: 0.12, type: 'sine', vol: 0.1, delay: 0.09 }); }
  shop() { this.tone({ freq: 660, dur: 0.1, type: 'triangle', vol: 0.18 }); this.tone({ freq: 990, dur: 0.16, type: 'triangle', vol: 0.14, delay: 0.08 }); }
  buy() { this.tone({ freq: 520, dur: 0.1, type: 'square', vol: 0.16 }); this.tone({ freq: 1040, dur: 0.2, type: 'triangle', vol: 0.18, delay: 0.09 }); }
}
