/**
 * CYBER NEON SLOTS - Sistema de Partículas e Confetes (HTML5 Canvas)
 * Renderiza explosões de partículas neon, moedas douradas e confetes para vitórias.
 */

class ParticleEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrame = null;
    this.isActive = false;
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.resize();

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // Explosão de confetes e moedas
  burst({ count = 80, x = null, y = null, type = 'win' } = {}) {
    if (!this.canvas) return;

    const startX = x !== null ? x : this.canvas.width / 2;
    const startY = y !== null ? y : this.canvas.height * 0.55;

    const colors = type === 'jackpot'
      ? ['#ffd700', '#ff007f', '#00f0ff', '#ffffff', '#ff9900', '#a855f7']
      : ['#00f0ff', '#ffd700', '#00ff88', '#ffffff', '#ff3366'];

    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI * 2);
      const speed = Math.random() * (type === 'jackpot' ? 14 : 9) + 3;
      const size = Math.random() * (type === 'jackpot' ? 12 : 8) + 4;
      const isCoin = type === 'jackpot' && Math.random() > 0.6;

      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 4 + 2),
        size,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        gravity: 0.28,
        friction: 0.985,
        decay: Math.random() * 0.012 + 0.008,
        isCoin,
        shape: Math.random() > 0.5 ? 'circle' : 'rect'
      });
    }

    if (!this.isActive) {
      this.isActive = true;
      this.render();
    }
  }

  // Chuva contínua para Jackpot
  rainJackpot(durationMs = 4000) {
    if (!this.canvas) return;
    const interval = setInterval(() => {
      this.burst({
        count: 25,
        x: Math.random() * this.canvas.width,
        y: -10,
        type: 'jackpot'
      });
    }, 140);

    setTimeout(() => {
      clearInterval(interval);
    }, durationMs);
  }

  render() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.vx *= p.friction;
      p.vy *= p.friction;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y > this.canvas.height + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);

      if (p.isCoin) {
        // Moeda dourada com brilho
        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#fff8b3';
        this.ctx.stroke();

        this.ctx.fillStyle = '#b8860b';
        this.ctx.font = `bold ${Math.floor(p.size * 0.9)}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('$', 0, 1);
      } else if (p.shape === 'circle') {
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      } else {
        // Confete retangular
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 6;
        this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }

      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationFrame = requestAnimationFrame(() => this.render());
    } else {
      this.isActive = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  clear() {
    this.particles = [];
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.isActive = false;
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

const particleEngine = new ParticleEngine();
window.particleEngine = particleEngine;
