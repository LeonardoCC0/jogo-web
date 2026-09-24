/**
 * CYBER NEON SLOTS - Controlador Principal
 * Integrado com Autenticação, Persistência de Score no Servidor e Ranking 100% Real
 */

(function() {
  'use strict';

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
      this.balance = storage.getBalance();
      this.currentBet = window.CONFIG.DEFAULT_BET;
      this.isTurbo = storage.getTurboEnabled();
      this.isAutoSpin = false;
      this.autoSpinTimer = null;
      this.slotMachine = null;
      this.lastSpinTime = 0;

      this.currentUser = null;
      this.authToken = storage.getAuthToken();

      this.dom = {};
    }

    async init() {
      this.cacheDOM();
      this.initParticles();
      this.initAudio();
      this.initSlotMachine();
      this.initLeaderboard();
      this.renderHistory();
      this.renderPaytable();
      this.bindEvents();
      this.updateUI();

      // Expõe helper global para abrir modal de auth caso necessário
      window.openAuthModal = (tab) => this.openAuthModal(tab);

      // Verifica sessão do usuário logado
      await this.checkAuthSession();

      // Primeiro acesso sem login
      if (storage.isFirstVisit() && !this.currentUser) {
        this.showWelcomeModal();
      }
    }

    cacheDOM() {
      this.dom = {
        // Topo
        balanceText: document.getElementById('user-balance'),
        btnOpenAuth: document.getElementById('btn-open-auth'),
        btnLogout: document.getElementById('btn-logout'),
        btnSound: document.getElementById('btn-sound'),
        soundIcon: document.getElementById('sound-icon'),
        btnPaytable: document.getElementById('btn-paytable'),
        playerProfile: document.getElementById('player-profile'),
        playerNameText: document.getElementById('player-name-text'),
        playerAvatarIcon: document.getElementById('player-avatar-icon'),
        bestWinText: document.getElementById('best-win-text'),
        btnResetVoluntary: document.getElementById('btn-reset-voluntary'),
        btnResetPunishment: document.getElementById('btn-reset-punishment'),
        gameOverModal: document.getElementById('modal-game-over'),

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
        authModal: document.getElementById('auth-modal'),
        welcomeModal: document.getElementById('welcome-modal'),
        paytableModal: document.getElementById('paytable-modal'),
        profileModal: document.getElementById('profile-modal'),
        jackpotModal: document.getElementById('jackpot-modal'),
        modalCloseBtns: document.querySelectorAll('.modal-close-btn'),

        // Auth Tabs & Forms
        tabLoginBtn: document.getElementById('tab-login-btn'),
        tabRegisterBtn: document.getElementById('tab-register-btn'),
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        loginUsernameInput: document.getElementById('login-username'),
        loginPasswordInput: document.getElementById('login-password'),
        registerUsernameInput: document.getElementById('register-username'),
        registerPasswordInput: document.getElementById('register-password'),
        registerAvatarSelect: document.getElementById('register-avatar'),
        authErrorBox: document.getElementById('auth-error-box'),
        authSuccessBox: document.getElementById('auth-success-box'),

        // Welcome Modal Buttons
        btnWelcomeRegister: document.getElementById('btn-welcome-register'),
        btnWelcomeLogin: document.getElementById('btn-welcome-login'),

        // Profile Modal
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

    // =========================================================================
    // AUTENTICAÇÃO E SESSÃO DO USUÁRIO
    // =========================================================================

    async checkAuthSession() {
      if (!this.authToken) {
        this.currentUser = null;
        this.updateAuthUI();
        rankingSystem.fetchAndUpdate(null);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            this.currentUser = data.user;
            this.balance = data.user.balance;
            storage.setUserData(data.user);
            this.updateAuthUI();
            this.updateUI();
            rankingSystem.fetchAndUpdate(this.currentUser);
            return;
          }
        }
      } catch (e) {
        console.warn('Erro ao validar sessão com o servidor:', e.message);
      }

      // Sessão inválida ou expirada
      this.authToken = null;
      this.currentUser = null;
      storage.clearAuth();
      this.updateAuthUI();
      rankingSystem.fetchAndUpdate(null);
    }

    updateAuthUI() {
      if (this.currentUser) {
        if (this.dom.btnOpenAuth) this.dom.btnOpenAuth.classList.add('hidden');
        if (this.dom.playerProfile) this.dom.playerProfile.classList.remove('hidden');
        if (this.dom.btnLogout) this.dom.btnLogout.classList.remove('hidden');

        if (this.dom.playerNameText) {
          this.dom.playerNameText.textContent = this.currentUser.displayName || this.currentUser.username;
        }
        if (this.dom.playerAvatarIcon) {
          this.dom.playerAvatarIcon.textContent = this.currentUser.avatar || '⚡';
        }
        if (this.dom.bestWinText) {
          this.dom.bestWinText.textContent = (this.currentUser.highestWin || 0).toLocaleString('pt-BR');
        }
      } else {
        if (this.dom.btnOpenAuth) this.dom.btnOpenAuth.classList.remove('hidden');
        if (this.dom.playerProfile) this.dom.playerProfile.classList.add('hidden');
        if (this.dom.btnLogout) this.dom.btnLogout.classList.add('hidden');
      }
    }

    openAuthModal(mode = 'login') {
      this.clearAuthMessages();
      this.setAuthMode(mode);
      this.openModal(this.dom.authModal);
    }

    setAuthMode(mode) {
      this.clearAuthMessages();
      const isLogin = mode === 'login';

      if (this.dom.tabLoginBtn) this.dom.tabLoginBtn.classList.toggle('active', isLogin);
      if (this.dom.tabRegisterBtn) this.dom.tabRegisterBtn.classList.toggle('active', !isLogin);
      if (this.dom.loginForm) this.dom.loginForm.classList.toggle('active', isLogin);
      if (this.dom.registerForm) this.dom.registerForm.classList.toggle('active', !isLogin);

      if (isLogin && this.dom.loginUsernameInput) {
        setTimeout(() => this.dom.loginUsernameInput.focus(), 100);
      } else if (!isLogin && this.dom.registerUsernameInput) {
        setTimeout(() => this.dom.registerUsernameInput.focus(), 100);
      }
    }

    clearAuthMessages() {
      if (this.dom.authErrorBox) {
        this.dom.authErrorBox.textContent = '';
        this.dom.authErrorBox.classList.add('hidden');
      }
      if (this.dom.authSuccessBox) {
        this.dom.authSuccessBox.textContent = '';
        this.dom.authSuccessBox.classList.add('hidden');
      }
    }

    showAuthError(message) {
      if (this.dom.authErrorBox) {
        this.dom.authErrorBox.textContent = message;
        this.dom.authErrorBox.classList.remove('hidden');
      }
      if (this.dom.authSuccessBox) {
        this.dom.authSuccessBox.classList.add('hidden');
      }
    }

    showAuthSuccess(message) {
      if (this.dom.authSuccessBox) {
        this.dom.authSuccessBox.textContent = message;
        this.dom.authSuccessBox.classList.remove('hidden');
      }
      if (this.dom.authErrorBox) {
        this.dom.authErrorBox.classList.add('hidden');
      }
    }

    async handleLoginSubmit(e) {
      e.preventDefault();
      this.clearAuthMessages();

      const username = (this.dom.loginUsernameInput.value || '').trim();
      const password = this.dom.loginPasswordInput.value || '';

      if (!username || !password) {
        this.showAuthError('Preencha todos os campos.');
        return;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          this.showAuthError(data.error || 'Falha ao realizar login.');
          return;
        }

        // Sucesso
        this.authToken = data.token;
        this.currentUser = data.user;
        this.balance = data.user.balance;
        storage.setAuthToken(data.token);
        storage.setUserData(data.user);
        storage.setFirstVisitDone();

        this.closeAllModals();
        this.updateAuthUI();
        this.updateUI();
        rankingSystem.fetchAndUpdate(this.currentUser);

        this.showToast(`✅ Bem-vindo de volta, ${data.user.displayName || data.user.username}!`);
      } catch (err) {
        this.showAuthError('Erro de conexão ao tentar fazer login.');
      }
    }

    async handleRegisterSubmit(e) {
      e.preventDefault();
      this.clearAuthMessages();

      const username = (this.dom.registerUsernameInput.value || '').trim();
      const password = this.dom.registerPasswordInput.value || '';
      const avatar = this.dom.registerAvatarSelect ? this.dom.registerAvatarSelect.value : '⚡';

      if (!username || username.length < 3) {
        this.showAuthError('O nome de usuário deve ter pelo menos 3 caracteres.');
        return;
      }
      if (!password || password.length < 4) {
        this.showAuthError('A senha deve ter pelo menos 4 caracteres.');
        return;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, avatar })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          this.showAuthError(data.error || 'Falha ao registrar conta.');
          return;
        }

        // Sucesso
        this.authToken = data.token;
        this.currentUser = data.user;
        this.balance = data.user.balance;
        storage.setAuthToken(data.token);
        storage.setUserData(data.user);
        storage.setFirstVisitDone();

        this.closeAllModals();
        this.updateAuthUI();
        this.updateUI();
        particleEngine.burst({ count: 70, type: 'win' });
        rankingSystem.fetchAndUpdate(this.currentUser);

        this.showToast(`🎉 Conta criada! +1.000 moedas virtuais adicionadas.`);
      } catch (err) {
        this.showAuthError('Erro de conexão ao tentar cadastrar.');
      }
    }

    async handleLogout() {
      if (this.authToken) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.authToken}` }
          });
        } catch (e) {}
      }

      this.authToken = null;
      this.currentUser = null;
      storage.clearAuth();
      this.stopAutoSpin();
      this.updateAuthUI();
      rankingSystem.fetchAndUpdate(null);
      this.showToast('🚪 Você saiu da sua conta.');
    }

    // =========================================================================
    // EVENTOS E INTERAÇÃO DO JOGO
    // =========================================================================

    bindEvents() {
      // Botão Girar
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

      // Abrir Modal de Autenticação no Cabeçalho
      if (this.dom.btnOpenAuth) {
        this.dom.btnOpenAuth.addEventListener('click', () => {
          audioSystem.playClick();
          this.openAuthModal('login');
        });
      }

      // Logout
      if (this.dom.btnLogout) {
        this.dom.btnLogout.addEventListener('click', () => {
          audioSystem.playClick();
          if (confirm('Deseja realmente sair da sua conta?')) {
            this.handleLogout();
          }
        });
      }

      // Reset Voluntário (o jogador escolhe zerar o progresso manualmente)
      if (this.dom.btnResetVoluntary) {
        this.dom.btnResetVoluntary.addEventListener('click', () => {
          audioSystem.playClick();
          const confirmReset = confirm('Tem certeza de que deseja resetar? Seu saldo voltará para 1.000 moedas.');
          if (confirmReset) {
            this.resetBalance(1000);
          }
        });
      }

      // Reset por Punição (saldo chegou a zero, modal "Fim de Jogo")
      if (this.dom.btnResetPunishment) {
        this.dom.btnResetPunishment.addEventListener('click', () => {
          audioSystem.playClick();
          this.resetBalance(500);
        });
      }

      // Alternar Abas no Modal de Auth
      if (this.dom.tabLoginBtn) {
        this.dom.tabLoginBtn.addEventListener('click', () => this.setAuthMode('login'));
      }
      if (this.dom.tabRegisterBtn) {
        this.dom.tabRegisterBtn.addEventListener('click', () => this.setAuthMode('register'));
      }

      // Submit Login e Cadastro
      if (this.dom.loginForm) {
        this.dom.loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
      }
      if (this.dom.registerForm) {
        this.dom.registerForm.addEventListener('submit', (e) => this.handleRegisterSubmit(e));
      }

      // Botões no Modal de Boas-Vindas
      if (this.dom.btnWelcomeRegister) {
        this.dom.btnWelcomeRegister.addEventListener('click', () => {
          audioSystem.playClick();
          this.closeAllModals();
          this.openAuthModal('register');
        });
      }
      if (this.dom.btnWelcomeLogin) {
        this.dom.btnWelcomeLogin.addEventListener('click', () => {
          audioSystem.playClick();
          this.closeAllModals();
          this.openAuthModal('login');
        });
      }

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

      // Ajustes de aposta
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

      // Tabela de Prêmios
      this.dom.btnPaytable.addEventListener('click', () => {
        audioSystem.playClick();
        this.openModal(this.dom.paytableModal);
      });

      // Fechamento de Modais
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

          // Atualiza ranking real ao abrir aba do ranking
          if (targetTab === 'tab-leaderboard') {
            rankingSystem.fetchAndUpdate(this.currentUser);
          }
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

    // =========================================================================
    // GIRO AUTORITATIVO NO SERVIDOR
    // =========================================================================

    async triggerSpin() {
      if (this.slotMachine.isSpinning) return;

      // Rate limit anti-autoclicker
      const now = Date.now();
      if (now - this.lastSpinTime < 280) return;
      this.lastSpinTime = now;

      // 1. Exige autenticação para girar
      if (!this.currentUser || !this.authToken) {
        this.stopAutoSpin();
        this.showToast('🔒 Faça login ou crie sua conta para jogar e salvar seu score!');
        this.openAuthModal('login');
        return;
      }

      // 2. Validação de saldo (Sem recarga)
      if (this.balance < this.currentBet) {
        this.stopAutoSpin();
        this.showNoCoinsAlert();
        return;
      }

      this.dom.btnSpin.disabled = true;
      this.dom.btnSpin.classList.add('spinning');

      try {
        // Envia requisição de giro ao backend
        const res = await fetch('/api/spin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({ bet: this.currentBet })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          this.dom.btnSpin.disabled = false;
          this.dom.btnSpin.classList.remove('spinning');
          this.stopAutoSpin();
          this.showToast('⚠️ ' + (data.error || 'Erro ao processar rodada.'));
          return;
        }

        const serverOutcome = data.outcome;

        // Mapeia símbolos do servidor para a configuração local
        const forcedSymbols = serverOutcome.symbols.map(serverSym => {
          return window.CONFIG.SYMBOLS.find(cs => cs.id === serverSym.id) || serverSym;
        });

        this.slotMachine.clearHighlights();
        this.dom.winDisplay.classList.remove('show', 'jackpot-glow', 'win-pulse');
        this.dom.slotMachineWrapper.classList.remove('machine-winning');

        // Dispara animação física dos rolos no frontend sincronizada com os símbolos do servidor
        this.slotMachine.spin({
          isTurbo: this.isTurbo,
          betAmount: this.currentBet,
          forcedSymbols,
          serverOutcome
        });

      } catch (err) {
        this.dom.btnSpin.disabled = false;
        this.dom.btnSpin.classList.remove('spinning');
        this.stopAutoSpin();
        this.showToast('⚠️ Erro de comunicação com o servidor.');
      }
    }

    handleSpinStart(betAmount) {
      this.animateBalanceChange(-betAmount);
    }

    handleSpinComplete(outcome) {
      this.dom.btnSpin.disabled = false;
      this.dom.btnSpin.classList.remove('spinning');

      storage.recordSpin(outcome.isWin);

      // Sincroniza saldo e recorde reais confirmados pelo servidor
      if (outcome.newBalance !== undefined) {
        this.balance = outcome.newBalance;
        if (this.currentUser) {
          this.currentUser.balance = outcome.newBalance;
          if (outcome.highestWin !== undefined) {
            this.currentUser.highestWin = outcome.highestWin;
          }
          storage.setUserData(this.currentUser);
        }
      }

      if (outcome.isWin && outcome.winAmount > 0) {
        this.slotMachine.highlightWin();
        this.dom.slotMachineWrapper.classList.add('machine-winning');
        this.animateBalanceChange(outcome.winAmount);

        if (outcome.highestWin) {
          this.dom.bestWinText.textContent = outcome.highestWin.toLocaleString('pt-BR');
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
        amount: outcome.isWin ? outcome.winAmount : -this.currentBet,
        multiplier: outcome.multiplier,
        icons: outcome.symbols.map(s => s.icon).join(' '),
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      storage.addHistoryEntry(historyEntry);
      this.renderHistory();

      // Atualiza Ranking Global Real
      rankingSystem.fetchAndUpdate(this.currentUser);

      // Zerou as moedas? Bloqueia o jogo e força o reset por punição (500 moedas)
      this.checkGameOver();

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

    // Verifica se o saldo zerou e força o modal de "Fim de Jogo"
    checkGameOver() {
      if (this.balance <= 0) {
        this.stopAutoSpin();
        this.dom.btnSpin.disabled = true;
        if (this.dom.gameOverModal) {
          this.openModal(this.dom.gameOverModal);
        }
      }
    }

    // Reseta o saldo (usado pelo botão manual e pelo reset por punição ao zerar moedas)
    // amount: 1000 (voluntário, a qualquer momento) ou 500 (punição, só quando zerou)
    async resetBalance(amount) {
      const resetType = amount === 500 ? 'punishment' : 'voluntary';

      this.balance = amount;
      storage.setBalance(amount);

      if (this.dom.balanceText) {
        this.dom.balanceText.textContent = amount.toLocaleString('pt-BR');
        this.dom.balanceText.classList.add('balance-pulse');
        setTimeout(() => this.dom.balanceText.classList.remove('balance-pulse'), 300);
      }

      // Se o jogador estiver autenticado, o saldo real vive no servidor -
      // sem isso, o próximo giro sobrescreveria o valor local com o saldo antigo.
      if (this.currentUser && this.authToken) {
        try {
          const res = await fetch('/api/reset', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify({ type: resetType })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            this.balance = data.balance;
            this.currentUser.balance = data.balance;
            storage.setUserData(this.currentUser);
            if (this.dom.balanceText) {
              this.dom.balanceText.textContent = data.balance.toLocaleString('pt-BR');
            }
          } else {
            this.showToast('⚠️ ' + (data.error || 'Não foi possível sincronizar o reset com o servidor.'));
          }
        } catch (err) {
          this.showToast('⚠️ Erro de comunicação ao resetar o saldo.');
        }
      }

      if (this.dom.gameOverModal) {
        this.dom.gameOverModal.style.display = 'none';
      }
      this.closeAllModals();
      this.dom.btnSpin.disabled = false;
    }

    // Saldo insuficiente (Sem opção de recarga artificial)
    showNoCoinsAlert() {
      audioSystem.playClick();
      this.showToast(`⚠️ Saldo insuficiente! Você possui apenas ${this.balance.toLocaleString('pt-BR')} moedas.`, 4000);
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
      this.openModal(this.dom.welcomeModal);
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

  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
  });

})();

function handleGoogleLogin(response) {
    const idToken = response.credential;

    // Envia o Token para validação no seu backend
    fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log("Login realizado com sucesso:", data.user);
            // Salva dados do usuário localmente ou atualiza a tela
            localStorage.setItem('user', JSON.stringify(data.user));
            // Carrega o saldo do usuário autenticado se aplicável
        }
    })
    .catch(err => console.error("Erro na autenticação:", err));
}