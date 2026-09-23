/**
 * CYBER NEON SLOTS - Sistema de Áudio Nativo (Web Audio API)
 * Gera todos os efeitos sonoros em tempo real sem dependências externas.
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.spinInterval = null;
  }

  // Inicializa o contexto de áudio após interação do usuário
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.isMuted) {
      this.stopSpinSound();
    }
  }

  // Som curto e suave de clique de interface
  playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  // Rolo girando: efeito contínuo de tique-taque mecânico e futurista
  startSpinSound() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopSpinSound();
    let tickCount = 0;

    this.spinInterval = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        const baseFreq = (tickCount % 2 === 0) ? 650 : 850;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.035);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.035);
        tickCount++;
      } catch (e) {}
    }, 75);
  }

  stopSpinSound() {
    if (this.spinInterval) {
      clearInterval(this.spinInterval);
      this.spinInterval = null;
    }
  }

  // Parada mecânica pesada de cada rolo com impacto e tom crescente
  playReelStop(reelIndex = 0) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Camada 1: Impacto grave (thump)
      const oscBass = this.ctx.createOscillator();
      const gainBass = this.ctx.createGain();

      const startFreq = 160 + (reelIndex * 35);
      oscBass.type = 'sine';
      oscBass.frequency.setValueAtTime(startFreq, now);
      oscBass.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gainBass.gain.setValueAtTime(0.28, now);
      gainBass.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      oscBass.connect(gainBass);
      gainBass.connect(this.ctx.destination);

      oscBass.start(now);
      oscBass.stop(now + 0.12);

      // Camada 2: Trava metálica (click mecânico)
      const oscClick = this.ctx.createOscillator();
      const gainClick = this.ctx.createGain();

      oscClick.type = 'square';
      oscClick.frequency.setValueAtTime(1200 + (reelIndex * 150), now);
      oscClick.frequency.exponentialRampToValueAtTime(400, now + 0.05);

      gainClick.gain.setValueAtTime(0.1, now);
      gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      oscClick.connect(gainClick);
      gainClick.connect(this.ctx.destination);

      oscClick.start(now);
      oscClick.stop(now + 0.05);
    } catch (e) {}
  }

  // Efeito de moedas computando no saldo
  playCoinChime() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1950, now);
      osc.frequency.exponentialRampToValueAtTime(2600, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  // Melodia de vitória escalonada de acordo com o multiplicador
  playWin(multiplier = 2) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      let notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      if (multiplier >= 15) {
        notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      } else if (multiplier >= 6) {
        notes = [523.25, 659.25, 783.99, 1046.50];
      }

      const noteDuration = 0.12;

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const noteStart = now + (idx * noteDuration);

        osc.type = multiplier >= 15 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.2, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + noteDuration + 0.1);
      });
    } catch (e) {}
  }

  // Fanfarra triunfal de Jackpot
  playJackpot() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const chordNotes = [
        [523.25, 659.25, 783.99],
        [587.33, 739.99, 880.00],
        [659.25, 783.99, 987.77],
        [783.99, 987.77, 1174.66, 1567.98]
      ];

      chordNotes.forEach((chord, chordIdx) => {
        const startTime = now + (chordIdx * 0.22);
        chord.forEach(freq => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.18, startTime + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.38);
        });
      });

      for (let i = 0; i < 8; i++) {
        const sparkleTime = now + 0.9 + (i * 0.06);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500 + (i * 200), sparkleTime);

        gain.gain.setValueAtTime(0.12, sparkleTime);
        gain.gain.exponentialRampToValueAtTime(0.001, sparkleTime + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(sparkleTime);
        osc.stop(sparkleTime + 0.08);
      }
    } catch (e) {}
  }

  // Efeito ao recarregar moedas de demonstração
  playRefill() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = now + (idx * 0.07);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + 0.16);
      });
    } catch (e) {}
  }
}

const audioSystem = new SoundSystem();
window.audioSystem = audioSystem;
