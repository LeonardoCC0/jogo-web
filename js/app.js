/**
 * CYBER NEON SLOTS - Controlador Principal com Encapsulamento Fechado (Anti-Tampering)
 * O estado e variáveis de saldo rodam dentro de um escopo protegido privado sem exposição no console.
 */

(function() {
  'use strict';

  // Congela as configurações para impedir modificação em tempo de execução via DevTools
  if (window.CONFIG) {
    Object.freeze(window.CONFIG);
    if (window.CONFIG.SYMBOLS) {
      window.CONFIG.SYMBOLS.forEach(s => Object.freeze(s));
      Object.freeze(window.CONFIG.SYMBOLS);
    }
  }

  const storage = window.storage;
  const audioSystem = window.audioSystem;
  const particleEngine = window.particleEngine;
  const rankingSystem = window.rankingSystem;
  const SlotMachine = window.SlotMachine;
  const sec = window.CNS_SECURITY;

  class App {
    constructor() {
      // Estado estritamente privado nesta instância da closure
      this.balance = storage.getBalance();
      this.currentBet = window.CONFIG.DEFAULT_BET;
      this.isTurbo = storage.getTurboEnabled();
      this.isAutoSpin = false;
      this.autoSpinTimer = null;
      this.slotMachine = null;
      this.lastSpinTime = 0;

      this.dom = {};
    }

    init() {
      this.cacheDOM();
      this.initParticles();
      this.initAudio();
      this.initSlotMachine();
      this.initLeaderboard();
      this.renderHistory();
      this.renderPaytable();
      this.bindEvents();
      this.updateUI();

      // Alerta caso alguma tentativa de alteração manual no LocalStorage tenha sido neutralizada
      if (storage.hasTamperAlert && storage.hasTamperAlert()) {
        setTimeout(() => {
          this.showToast('🛡️ Integridade: Tentativa de alteração no saldo foi neutralizada.');
        }, 1200);
      }

      // Primeiro acesso
      if (storage.isFirstVisit()) {
        this.showWelcomeModal();
      }
    }

    cacheDOM() {
      this.dom = {
        // Topo
        balanceText: document.getElementById('user-balance'),
        btnRefill: document.getElementById('btn-refill'),
        btnSound: document.getElementById('btn-sound'),
        soundIcon: document.getElementById('sound-icon'),
        btnPaytable: document.getElementById('btn-paytable'),
        playerProfile: document.getElementById('player-profile'),
        playerNameText: document.getElementById('player-name-text'),
        playerAvatarIcon: document.getElementById('player-avatar-icon'),
        bestWinText: document.getElementById('best-win-text'),

        // Máquina e Rolos
        slotMachineWrapper: document.getElementById('slot-machine-wrapper'),
        reels: [
          document.getElementById('reel-1'),
          document.getElementById('reel-2'),
          document.getElementById('reel-3')
        ],
        winDisplay: document.getElementById('win-display'),
        winAmountText: document.getElementById('win-amount-text'),
        winMultiplierText: document.getElementById('win-multiplier-text'),

        // Controles de Aposta
        betDisplay: document.getElementById('bet-display'),
        btnBetMinus: document.getElementById('btn-bet-minus'),
        btnBetPlus: document.getElementById('btn-bet-plus'),
        betChips: document.querySelectorAll('.chip-btn'),
        btnMaxBet: document.getElementById('btn-max-bet'),
        btnSpin: document.getElementById('btn-spin'),
        btnTurbo: document.getElementById('btn-turbo'),
        btnAutoSpin: document.getElementById('btn-auto-spin'),

        // Paineis laterais
        leaderboardContainer: document.getElementById('leaderboard-container'),
        historyList: document.getElementById('history-list'),
        btnClearHistory: document.getElementById('btn-clear-history'),

        // Canvas
        particleCanvas: document.getElementById('particle-canvas'),

        // Modais
        modalOverlay: document.getElementById('modal-overlay'),
        welcomeModal: document.getElementById('welcome-modal'),
        paytableModal: document.getElementById('paytable-modal'),
        profileModal: document.getElementById('profile-modal'),
        jackpotModal: document.getElementById('jackpot-modal'),
        modalCloseBtns: document.querySelectorAll('.modal-close-btn'),

        // Formulários
        welcomeInput: document.getElementById('welcome-player-name'),
        btnStartGame: document.getElementById('btn-start-game'),
        profileInput: document.getElementById('profile-player-name'),
        profileAvatarSelect: document.getElementById('profile-avatar-select'),
        btnSaveProfile: document.getElementById('btn-save-profile'),

        // Jackpot Modal
        jackpotWinAmount: document.getElementById('jackpot-win-amount'),
        jackpotMessage: document.getElementById('jackpot-message'),
        btnClaimJackpot: document.getElementById('btn-claim-jackpot'),

        // Toast
        toast: document.getElementById('toast')
      };
    }

    initParticles() {
      if (this.dom.particleCanvas && particleEngine) {
        particleEngine.init(this.dom.particleCanvas);
      }
    }

    initAudio() {
      const isMuted = !storage.getSoundEnabled();
      audioSystem.setMuted(isMuted);
      this.updateSoundIcon(isMuted);
    }

    initSlotMachine() {
      this.slotMachine = new SlotMachine({
        reelElements: this.dom.reels,
        onSpinStart: ({ betAmount }) => {
          this.handleSpinStart(betAmount);
        },
        onReelStop: ({ reelIndex }) => {
          if (navigator.vibrate) {
            navigator.vibrate(25);
          }
        },
        onSpinComplete: (outcome) => {
          this.handleSpinComplete(outcome);
        }
      });
    }

    initLeaderboard() {
      rankingSystem.init(this.dom.leaderboardContainer);
    }

    bindEvents() {
      // Botão Girar com proteção anti-autoclicker
      this.dom.btnSpin.addEventListener('click', () => {
        audioSystem.playClick();
        this.triggerSpin();
      });

      // Tecla de Espaço
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !this.isModalOpen() && e.target.tagName !== 'INPUT') {
          e.preventDefault();
          this.triggerSpin();
        }
      });

      // Recarga de Moedas de Demonstração
      this.dom.btnRefill.addEventListener('click', () => {
        audioSystem.playClick();
        this.refillCoins();
      });

      // Alternar Som
      this.dom.btnSound.addEventListener('click', () => {
        const nowMuted = !audioSystem.isMuted;
        audioSystem.setMuted(nowMuted);
        storage.setSoundEnabled(!nowMuted);
        this.updateSoundIcon(nowMuted);
        if (!nowMuted) {
          audioSystem.playClick();
        }
      });

      // Fichas de aposta rápida
      this.dom.betChips.forEach(chip => {
        chip.addEventListener('click', () => {
          audioSystem.playClick();
          const betVal = parseInt(chip.getAttribute('data-bet'), 10);
          this.setBet(betVal);
        });
      });

      // Ajustes finos de aposta
      this.dom.btnBetMinus.addEventListener('click', () => {
        audioSystem.playClick();
        this.setBet(this.currentBet - 5);
      });

      this.dom.btnBetPlus.addEventListener('click', () => {
        audioSystem.playClick();
        this.setBet(this.currentBet + 5);
      });

      // Aposta Máxima
      this.dom.btnMaxBet.addEventListener('click', () => {
        audioSystem.playClick();
        const maxPossible = Math.min(window.CONFIG.MAX_BET, this.balance > 0 ? this.balance : window.CONFIG.MAX_BET);
        this.setBet(maxPossible);
      });

      // Modo Turbo
      this.dom.btnTurbo.addEventListener('click', () => {
        audioSystem.playClick();
        this.isTurbo = !this.isTurbo;
        storage.setTurboEnabled(this.isTurbo);
        this.dom.btnTurbo.classList.toggle('active', this.isTurbo);
        this.showToast(this.isTurbo ? '⚡ Modo Turbo Ativado' : 'Modo Normal Ativado');
      });
      if (this.isTurbo) {
        this.dom.btnTurbo.classList.add('active');
      }

      // Modo Auto Spin
      this.dom.btnAutoSpin.addEventListener('click', () => {
        audioSystem.playClick();
        this.toggleAutoSpin();
      });

      // Modais
      this.dom.btnPaytable.addEventListener('click', () => {
        audioSystem.playClick();
        this.openModal(this.dom.paytableModal);
      });

      this.dom.playerProfile.addEventListener('click', () => {
        audioSystem.playClick();
        this.openProfileModal();
      });

      this.dom.modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          audioSystem.playClick();
          this.closeAllModals();
        });
      });

      this.dom.modalOverlay.addEventListener('click', (e) => {
        if (e.target === this.dom.modalOverlay) {
          this.closeAllModals();
        }
      });

      // Boas-Vindas Iniciais com Sanitização
      this.dom.btnStartGame.addEventListener('click', () => {
        audioSystem.playClick();
        const rawName = this.dom.welcomeInput.value;
        const name = sec ? sec.sanitizeInput(rawName, 14) : rawName.trim().slice(0, 14);
        storage.setPlayerName(name || 'CyberPlayer');
        storage.setFirstVisitDone();
        this.closeAllModals();
        audioSystem.playRefill();
        particleEngine.burst({ count: 60, type: 'win' });
        this.updateUI();
        this.showToast(`Bem-vindo, ${name || 'CyberPlayer'}! +1.000 moedas adicionadas!`);
      });

      // Salvar Perfil com Sanitização
      this.dom.btnSaveProfile.addEventListener('click', () => {
        audioSystem.playClick();
        const rawName = this.dom.profileInput.value;
        const name = sec ? sec.sanitizeInput(rawName, 14) : rawName.trim().slice(0, 14);
        const avatar = sec ? sec.sanitizeInput(this.dom.profileAvatarSelect.value, 4) : this.dom.profileAvatarSelect.value;
        storage.setPlayerName(name || storage.getPlayerName());
        storage.setPlayerAvatar(avatar || storage.getPlayerAvatar());
        this.closeAllModals();
        this.updateUI();
        rankingSystem.update();
        this.showToast('Perfil atualizado com segurança!');
      });

      // Limpar Histórico
      if (this.dom.btnClearHistory) {
        this.dom.btnClearHistory.addEventListener('click', () => {
          audioSystem.playClick();
          storage.clearHistory();
          this.renderHistory();
          this.showToast('Histórico limpo');
        });
      }

      // Reivindicar Prêmio de Jackpot
      this.dom.btnClaimJackpot.addEventListener('click', () => {
        audioSystem.playClick();
        this.closeAllModals();
        particleEngine.clear();
      });

      // Abas de navegação Mobile
      const mobileTabBtns = document.querySelectorAll('.mobile-tab-btn');
      mobileTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          audioSystem.playClick();
          const targetTab = btn.getAttribute('data-tab');
          mobileTabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          document.querySelectorAll('.tab-content-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === targetTab);
          });
        });
      });
    }

    setBet(newBet) {
      const clamped = Math.max(window.CONFIG.MIN_BET, Math.min(window.CONFIG.MAX_BET, newBet));
      this.currentBet = clamped;
      this.dom.betDisplay.textContent = this.currentBet.toLocaleString('pt-BR');

      this.dom.betChips.forEach(chip => {
        const val = parseInt(chip.getAttribute('data-bet'), 10);
        chip.classList.toggle('chip-active', val === this.currentBet);
      });
    }

    triggerSpin() {
      if (this.slotMachine.isSpinning) return;

      // Rate limit anti-macro bot no cliente
      const now = Date.now();
      if (now - this.lastSpinTime < 280) {
        return;
      }
      this.lastSpinTime = now;

      // Validação de saldo
      if (this.balance < this.currentBet) {
        this.stopAutoSpin();
        this.showNoCoinsAlert();
        return;
      }

      this.slotMachine.clearHighlights();
      this.dom.winDisplay.classList.remove('show', 'jackpot-glow', 'win-pulse');
      this.dom.slotMachineWrapper.classList.remove('machine-winning');

      this.slotMachine.spin({
        isTurbo: this.isTurbo,
        betAmount: this.currentBet
      });
    }

    handleSpinStart(betAmount) {
      this.animateBalanceChange(-betAmount);
      this.dom.btnSpin.disabled = true;
      this.dom.btnSpin.classList.add('spinning');
    }

    handleSpinComplete(outcome) {
      this.dom.btnSpin.disabled = false;
      this.dom.btnSpin.classList.remove('spinning');

      storage.recordSpin(outcome.isWin);

      if (outcome.isWin && outcome.winAmount > 0) {
        this.slotMachine.highlightWin();
        this.dom.slotMachineWrapper.classList.add('machine-winning');
        this.animateBalanceChange(outcome.winAmount);

        const isNewRecord = storage.setHighestWin(outcome.winAmount);
        if (isNewRecord) {
          this.dom.bestWinText.textContent = outcome.winAmount.toLocaleString('pt-BR');
        }

        if (outcome.type === 'jackpot') {
          this.handleJackpot(outcome);
        } else if (outcome.type === 'big_win') {
          this.handleBigWin(outcome);
        } else {
          this.handleNormalWin(outcome);
        }
      } else {
        this.dom.winDisplay.classList.remove('show');
      }

      // Registra no histórico
      const historyEntry = {
        isWin: outcome.isWin,
        amount: outcome.isWin ? outcome.winAmount : -outcome.betAmount,
        multiplier: outcome.multiplier,
        icons: outcome.symbols.map(s => s.icon).join(' '),
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      storage.addHistoryEntry(historyEntry);
      this.renderHistory();

      // Atualiza Ranking Global
      rankingSystem.update();

      if (this.isAutoSpin) {
        const waitTime = outcome.isWin ? (outcome.type === 'jackpot' ? 4500 : 2000) : (this.isTurbo ? 350 : 800);
        this.autoSpinTimer = setTimeout(() => {
          if (this.isAutoSpin) {
            this.triggerSpin();
          }
        }, waitTime);
      }
    }

    handleNormalWin(outcome) {
      audioSystem.playWin(outcome.multiplier);
      particleEngine.burst({ count: 40, type: 'win' });
      this.showWinBanner(outcome.winAmount, outcome.multiplier, outcome.message);
    }

    handleBigWin(outcome) {
      audioSystem.playWin(outcome.multiplier);
      particleEngine.burst({ count: 90, type: 'jackpot' });
      this.dom.winDisplay.classList.add('jackpot-glow');
      this.showWinBanner(outcome.winAmount, outcome.multiplier, `🔥 GRANDE PRÊMIO! ${outcome.multiplier}X 🔥`);
    }

    handleJackpot(outcome) {
      audioSystem.playJackpot();
      particleEngine.burst({ count: 140, type: 'jackpot' });
      particleEngine.rainJackpot(4000);

      this.dom.jackpotWinAmount.textContent = `+${outcome.winAmount.toLocaleString('pt-BR')}`;
      this.dom.jackpotMessage.textContent = `VOCÊ TIROU 3 COROAS SUPREMAS! MULTIPLICADOR DE ${outcome.multiplier}X!`;
      this.openModal(this.dom.jackpotModal);
    }

    showWinBanner(amount, multiplier, message) {
      this.dom.winAmountText.textContent = `+${amount.toLocaleString('pt-BR')} moedas`;
      this.dom.winMultiplierText.textContent = `${multiplier}x • ${message}`;
      this.dom.winDisplay.classList.add('show', 'win-pulse');

      audioSystem.playCoinChime();
    }

    animateBalanceChange(diff) {
      const startVal = this.balance;
      const endVal = Math.max(0, startVal + diff);
      this.balance = endVal;
      storage.setBalance(endVal);

      const duration = 600;
      const startTime = performance.now();

      const step = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentVal = Math.round(startVal + (diff * easeProgress));

        this.dom.balanceText.textContent = currentVal.toLocaleString('pt-BR');

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          this.dom.balanceText.textContent = endVal.toLocaleString('pt-BR');
          this.dom.balanceText.classList.add('balance-pulse');
          setTimeout(() => this.dom.balanceText.classList.remove('balance-pulse'), 300);
        }
      };

      requestAnimationFrame(step);
    }

    refillCoins() {
      const refill = window.CONFIG.REFILL_AMOUNT;
      audioSystem.playRefill();
      particleEngine.burst({ count: 45, type: 'win' });
      this.animateBalanceChange(refill);
      rankingSystem.update();
      this.showToast(`+${refill.toLocaleString('pt-BR')} moedas virtuais adicionadas!`);
    }

    showNoCoinsAlert() {
      audioSystem.playClick();
      const shouldRefill = confirm('Saldo insuficiente para esta aposta! Deseja recarregar +1.000 moedas virtuais de demonstração agora?');
      if (shouldRefill) {
        this.refillCoins();
      }
    }

    toggleAutoSpin() {
      this.isAutoSpin = !this.isAutoSpin;
      this.dom.btnAutoSpin.classList.toggle('active', this.isAutoSpin);

      if (this.isAutoSpin) {
        this.showToast('🔄 Giro Automático Ativado');
        this.triggerSpin();
      } else {
        this.stopAutoSpin();
        this.showToast('Giro Automático Pausado');
      }
    }

    stopAutoSpin() {
      this.isAutoSpin = false;
      this.dom.btnAutoSpin.classList.remove('active');
      if (this.autoSpinTimer) {
        clearTimeout(this.autoSpinTimer);
        this.autoSpinTimer = null;
      }
    }

    renderHistory() {
      if (!this.dom.historyList) return;

      const list = storage.getHistory();
      if (list.length === 0) {
        this.dom.historyList.innerHTML = `
          <div class="empty-history">
            <span>🎰</span>
            <p>Nenhuma rodada recente.<br>Clique em GIRAR para começar!</p>
          </div>
        `;
        return;
      }

      this.dom.historyList.innerHTML = list.map(item => {
        const isWin = item.isWin;
        const badgeClass = isWin ? 'win-badge' : 'loss-badge';
        const sign = isWin ? '+' : '';
        const cleanAmount = parseInt(item.amount, 10) || 0;
        const cleanIcons = sec ? sec.sanitizeInput(item.icons, 20) : item.icons;
        return `
          <div class="history-item ${isWin ? 'history-win' : 'history-loss'}">
            <div class="history-icons">${cleanIcons}</div>
            <div class="history-info">
              <span class="history-amount ${badgeClass}">
                ${sign}${cleanAmount.toLocaleString('pt-BR')} moedas
              </span>
              <span class="history-time">${item.timestamp}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    renderPaytable() {
      const paytableContainer = document.getElementById('paytable-symbols-list');
      if (!paytableContainer) return;

      paytableContainer.innerHTML = window.CONFIG.SYMBOLS.map(sym => `
        <div class="paytable-row ${sym.id === 'crown' ? 'jackpot-row' : ''}">
          <div class="paytable-sym">
            <span class="sym-emoji">${sym.icon}</span>
            <div class="sym-meta">
              <strong style="color: ${sym.color}">${sym.name}</strong>
              <span class="rarity-tag">${sym.rarity}</span>
            </div>
          </div>
          <div class="paytable-mults">
            <div class="mult-badge mult-3">
              <span>3 Iguais</span>
              <strong>${sym.mult3}x</strong>
            </div>
            <div class="mult-badge mult-2">
              <span>2 Iguais</span>
              <strong>${sym.mult2}x</strong>
            </div>
          </div>
        </div>
      `).join('');
    }

    updateUI() {
      this.dom.balanceText.textContent = this.balance.toLocaleString('pt-BR');
      this.dom.playerNameText.textContent = storage.getPlayerName();
      this.dom.playerAvatarIcon.textContent = storage.getPlayerAvatar();
      this.dom.bestWinText.textContent = storage.getHighestWin().toLocaleString('pt-BR');
      this.setBet(this.currentBet);
    }

    updateSoundIcon(muted) {
      if (this.dom.soundIcon) {
        this.dom.soundIcon.textContent = muted ? '🔇' : '🔊';
      }
    }

    openModal(modalElem) {
      if (!modalElem) return;
      this.dom.modalOverlay.classList.add('active');
      document.querySelectorAll('.modal-window').forEach(m => m.classList.remove('active'));
      modalElem.classList.add('active');
    }

    closeAllModals() {
      this.dom.modalOverlay.classList.remove('active');
      document.querySelectorAll('.modal-window').forEach(m => m.classList.remove('active'));
    }

    isModalOpen() {
      return this.dom.modalOverlay.classList.contains('active');
    }

    showWelcomeModal() {
      this.dom.welcomeInput.value = storage.getPlayerName();
      this.openModal(this.dom.welcomeModal);
    }

    openProfileModal() {
      this.dom.profileInput.value = storage.getPlayerName();
      this.dom.profileAvatarSelect.value = storage.getPlayerAvatar();
      this.openModal(this.dom.profileModal);
    }

    showToast(message, duration = 3000) {
      if (!this.dom.toast) return;
      this.dom.toast.textContent = message;
      this.dom.toast.classList.add('show');
      clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        this.dom.toast.classList.remove('show');
      }, duration);
    }
  }

  // Inicializa a aplicação dentro de escopo estritamente isolado (sem expor para o window)
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
    // Intencionalmente NÃO expomos `window.cyberSlots = app` para impedir manipulação via console
  });

})();
