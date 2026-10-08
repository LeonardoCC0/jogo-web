/**
 * COSTA BLACKJACK 21 VIP - Motor e Interface do Jogo de 21
 * Mesa tradicional de cassino, cartas francesas, fichas 3D e regras completas
 */

(function() {
  'use strict';

  const SUITS = ['♠', '♥', '♦', '♣'];
  const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  class CostaBlackjack {
    constructor(options = {}) {
      this.getApp = options.getApp || (() => window.CNS_APP);
      this.onBalanceChange = options.onBalanceChange || null;

      this.currentBet = 0;
      this.lastBet = 25;
      this.status = 'betting'; // 'betting' | 'dealing' | 'playing' | 'dealer_turn' | 'resolved'
      
      this.dealerCards = [];
      this.playerHands = [{ cards: [], bet: 0, status: 'betting', doubled: false }];
      this.activeHandIndex = 0;
      
      this.feltColor = localStorage.getItem('cns_bj_felt') || 'green'; // 'green' ou 'red'
      this.shoe = [];
      this.sessionStats = {
        hands: 0,
        wins: 0,
        blackjacks: 0,
        biggestWin: 0
      };

      this.dom = {};
      this.isBusy = false;
    }

    init() {
      this.cacheDOM();
      this.applyFeltColor(this.feltColor);
      this.bindEvents();
      this.createShoe(6);
      this.updateControls();
      this.updateStatsDisplay();
    }

    cacheDOM() {
      this.dom = {
        table: document.getElementById('bj-table'),
        feltGreenBtn: document.getElementById('btn-felt-green'),
        feltRedBtn: document.getElementById('btn-felt-red'),
        
        dealerCardsRow: document.getElementById('bj-dealer-cards'),
        dealerScoreBadge: document.getElementById('bj-dealer-score-badge'),
        dealerScoreVal: document.getElementById('bj-dealer-score-val'),
        
        playerCardsRow: document.getElementById('bj-player-cards'),
        playerScoreBadge: document.getElementById('bj-player-score-badge'),
        playerScoreVal: document.getElementById('bj-player-score-val'),
        
        splitHandsWrapper: document.getElementById('bj-split-hands-wrapper'),
        bettingSpot: document.getElementById('bj-betting-spot'),
        chipsStack: document.getElementById('bj-chips-stack'),
        spotAmountBadge: document.getElementById('bj-spot-amount-badge'),
        
        // Chip buttons
        chips: document.querySelectorAll('.bj-chip'),
        
        // Quick Bet buttons
        btnClearBet: document.getElementById('btn-bj-clear-bet'),
        btnDoubleBet: document.getElementById('btn-bj-double-bet'),
        btnRebet: document.getElementById('btn-bj-rebet'),
        btnAllIn: document.getElementById('btn-bj-allin'),
        
        // Action buttons
        btnDeal: document.getElementById('btn-bj-deal'),
        btnHit: document.getElementById('btn-bj-hit'),
        btnStand: document.getElementById('btn-bj-stand'),
        btnDouble: document.getElementById('btn-bj-double'),
        btnSplit: document.getElementById('btn-bj-split'),
        btnInsurance: document.getElementById('btn-bj-insurance'),
        
        // Result Overlay
        resultOverlay: document.getElementById('bj-result-overlay'),
        resultTitle: document.getElementById('bj-result-title'),
        resultPayout: document.getElementById('bj-result-payout'),
        
        // Stats
        statHands: document.getElementById('bj-stat-hands'),
        statWins: document.getElementById('bj-stat-wins'),
        statBjs: document.getElementById('bj-stat-bjs'),
        statBiggest: document.getElementById('bj-stat-biggest')
      };
    }

    bindEvents() {
      // Alternador de Feltro
      this.dom.feltGreenBtn?.addEventListener('click', () => this.applyFeltColor('green'));
      this.dom.feltRedBtn?.addEventListener('click', () => this.applyFeltColor('red'));

      // Apostas com Fichas
      this.dom.chips?.forEach(chip => {
        chip.addEventListener('click', () => {
          const val = parseInt(chip.getAttribute('data-value'), 10) || 5;
          this.addChipBet(val);
        });
      });

      // Modificadores de Aposta
      this.dom.btnClearBet?.addEventListener('click', () => this.clearBet());
      this.dom.btnDoubleBet?.addEventListener('click', () => this.multiplyBet(2));
      this.dom.btnRebet?.addEventListener('click', () => this.rebet());
      this.dom.btnAllIn?.addEventListener('click', () => this.allIn());
      this.dom.bettingSpot?.addEventListener('click', () => {
        if (this.status === 'betting') this.addChipBet(25);
      });

      // Ações de Rodada
      this.dom.btnDeal?.addEventListener('click', () => this.startDeal());
      this.dom.btnHit?.addEventListener('click', () => this.hit());
      this.dom.btnStand?.addEventListener('click', () => this.stand());
      this.dom.btnDouble?.addEventListener('click', () => this.doubleDown());
      this.dom.btnSplit?.addEventListener('click', () => this.split());
      this.dom.btnInsurance?.addEventListener('click', () => this.takeInsurance());
    }

    applyFeltColor(color) {
      this.feltColor = color;
      localStorage.setItem('cns_bj_felt', color);
      if (this.dom.table) {
        this.dom.table.classList.remove('felt-green', 'felt-red');
        this.dom.table.classList.add(`felt-${color}`);
      }
      this.dom.feltGreenBtn?.classList.toggle('active', color === 'green');
      this.dom.feltRedBtn?.classList.toggle('active', color === 'red');
    }

    getBalance() {
      const app = this.getApp();
      return app ? app.balance : (window.storage ? window.storage.getBalance() : 1000);
    }

    setBalance(newBalance) {
      const app = this.getApp();
      if (app && typeof app.setBalance === 'function') {
        app.setBalance(newBalance);
      } else if (window.storage) {
        window.storage.setBalance(newBalance);
      }
      if (this.onBalanceChange) this.onBalanceChange(newBalance);
    }

    getAuthToken() {
      const app = this.getApp();
      return app?.authToken || (window.storage ? window.storage.getAuthToken() : null);
    }

    isLoggedIn() {
      const app = this.getApp();
      return !!(app && app.currentUser && this.getAuthToken());
    }

    // =========================================================================
    // GERENCIAMENTO DE APOSTAS
    // =========================================================================

    addChipBet(amount) {
      if (this.status !== 'betting') return;
      const bal = this.getBalance();
      if (this.currentBet + amount > bal) {
        if (this.currentBet < bal) {
          this.currentBet = bal;
        } else {
          this.showToast('Saldo insuficiente para aumentar a aposta.', 'warning');
          return;
        }
      } else {
        this.currentBet += amount;
      }

      window.audioSystem?.playChipPlace();
      this.updateBettingSpot();
      this.updateControls();
    }

    clearBet() {
      if (this.status !== 'betting') return;
      this.currentBet = 0;
      window.audioSystem?.playClick();
      this.updateBettingSpot();
      this.updateControls();
    }

    multiplyBet(factor) {
      if (this.status !== 'betting' || this.currentBet <= 0) return;
      const bal = this.getBalance();
      const target = this.currentBet * factor;
      if (target > bal) {
        this.currentBet = bal;
      } else {
        this.currentBet = target;
      }
      window.audioSystem?.playChipPlace();
      this.updateBettingSpot();
      this.updateControls();
    }

    rebet() {
      if (this.status !== 'betting') return;
      const bal = this.getBalance();
      const bet = Math.min(this.lastBet || 25, bal);
      if (bet <= 0) return;
      this.currentBet = bet;
      window.audioSystem?.playChipPlace();
      this.updateBettingSpot();
      this.updateControls();
    }

    allIn() {
      if (this.status !== 'betting') return;
      const bal = this.getBalance();
      if (bal <= 0) return;
      this.currentBet = bal;
      window.audioSystem?.playChipPlace();
      this.updateBettingSpot();
      this.updateControls();
    }

    updateBettingSpot() {
      if (!this.dom.bettingSpot) return;

      if (this.currentBet > 0) {
        this.dom.bettingSpot.classList.add('has-bet');
        if (this.dom.spotAmountBadge) {
          this.dom.spotAmountBadge.textContent = `${this.currentBet.toLocaleString('pt-BR')}`;
          this.dom.spotAmountBadge.style.display = 'block';
        }
        this.renderChipsStack(this.currentBet);
      } else {
        this.dom.bettingSpot.classList.remove('has-bet');
        if (this.dom.spotAmountBadge) this.dom.spotAmountBadge.style.display = 'none';
        if (this.dom.chipsStack) this.dom.chipsStack.innerHTML = '';
      }
    }

    renderChipsStack(amount) {
      if (!this.dom.chipsStack) return;
      this.dom.chipsStack.innerHTML = '';

      // Decompõe a aposta nas maiores fichas
      const values = [1000, 500, 100, 50, 25, 5];
      let rem = amount;
      const stack = [];

      for (const v of values) {
        while (rem >= v && stack.length < 5) {
          stack.push(v);
          rem -= v;
        }
      }
      if (stack.length === 0 && amount > 0) stack.push(5);

      stack.reverse().forEach((val, idx) => {
        const mini = document.createElement('div');
        mini.className = `bj-chip chip-${val}`;
        mini.style.position = 'absolute';
        mini.style.width = '42px';
        mini.style.height = '42px';
        mini.style.bottom = `${idx * 4}px`;
        mini.style.zIndex = idx + 1;
        mini.innerHTML = `<div class="bj-chip-inner" style="width:24px;height:24px;font-size:0.6rem;">${val >= 1000 ? '1K' : val}</div>`;
        this.dom.chipsStack.appendChild(mini);
      });
    }

    // =========================================================================
    // BARALHO E CÁLCULO DE PONTUAÇÃO
    // =========================================================================

    createShoe(decks = 6) {
      this.shoe = [];
      for (let d = 0; d < decks; d++) {
        for (const suit of SUITS) {
          for (const value of VALUES) {
            this.shoe.push({
              suit,
              value,
              color: ['♥', '♦'].includes(suit) ? 'red' : 'black'
            });
          }
        }
      }
      // Shuffle Fisher-Yates
      for (let i = this.shoe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]];
      }
    }

    drawCard() {
      if (this.shoe.length < 15) this.createShoe(6);
      return this.shoe.pop();
    }

    calcHand(cards) {
      if (!cards || !cards.length) return { total: 0, isSoft: false, isBust: false, isBlackjack: false };
      let total = 0;
      let aces = 0;

      for (const c of cards) {
        if (c.hidden) continue;
        if (c.value === 'A') {
          aces++;
          total += 11;
        } else if (['K', 'Q', 'J'].includes(c.value)) {
          total += 10;
        } else {
          total += parseInt(c.value, 10);
        }
      }

      while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
      }

      return {
        total,
        isSoft: aces > 0,
        isBust: total > 21,
        isBlackjack: cards.length === 2 && total === 21
      };
    }

    // =========================================================================
    // CICLO DA RODADA (DEAL, HIT, STAND, DOUBLE, SPLIT)
    // =========================================================================

    async startDeal() {
      if (this.status !== 'betting' || this.isBusy) return;
      if (this.currentBet <= 0) {
        this.showToast('Faça uma aposta com as fichas para iniciar.', 'warning');
        return;
      }
      const bal = this.getBalance();
      if (this.currentBet > bal) {
        this.showToast('Saldo insuficiente para esta aposta.', 'error');
        return;
      }

      this.isBusy = true;
      this.lastBet = this.currentBet;
      this.hideResultOverlay();

      // Se logado, roda no servidor autoritativo
      if (this.isLoggedIn()) {
        await this.serverDeal();
        return;
      }

      // Modo convidado / offline local
      this.localDeal();
    }

    async serverDeal() {
      try {
        const res = await fetch('/api/blackjack/deal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`
          },
          body: JSON.stringify({ bet: this.currentBet })
        });

        const data = await res.json();
        if (!res.ok) {
          this.showToast(data.error || 'Erro ao iniciar rodada.', 'error');
          this.isBusy = false;
          return;
        }

        this.setBalance(data.balance);
        this.applyRoundState(data.round);
      } catch (e) {
        console.error('Falha na API blackjack/deal:', e);
        this.localDeal();
      } finally {
        this.isBusy = false;
      }
    }

    localDeal() {
      this.setBalance(this.getBalance() - this.currentBet);
      this.status = 'dealing';
      this.updateControls();

      const c1 = this.drawCard();
      const d1 = this.drawCard();
      const c2 = this.drawCard();
      const d2 = { ...this.drawCard(), hidden: true };

      this.dealerCards = [d1, d2];
      this.playerHands = [{
        cards: [c1, c2],
        bet: this.currentBet,
        status: 'playing',
        doubled: false
      }];
      this.activeHandIndex = 0;

      // Animação de distribuição com áudio
      this.renderTableCards();
      window.audioSystem?.playCardDeal();

      setTimeout(() => {
        const pVal = this.calcHand(this.playerHands[0].cards);
        const dVal = this.calcHand([d1, { ...d2, hidden: false }]);

        if (pVal.isBlackjack || dVal.isBlackjack) {
          // Revela dealer
          d2.hidden = false;
          this.renderTableCards(true);

          if (pVal.isBlackjack && dVal.isBlackjack) {
            this.resolveEndRound('push', this.currentBet, 'Blackjack Mútuo! Empate (Push).');
          } else if (pVal.isBlackjack) {
            const win = Math.round(this.currentBet * 2.5);
            this.resolveEndRound('blackjack', win, '👑 NATURAL BLACKJACK! Paga 3:2!');
          } else {
            this.resolveEndRound('loss', 0, 'Dealer possui Blackjack Natural.');
          }
        } else {
          this.status = 'playing';
          this.updateControls();
        }
        this.isBusy = false;
      }, 700);
    }

    async hit() {
      if (this.status !== 'playing' || this.isBusy) return;
      this.isBusy = true;

      if (this.isLoggedIn()) {
        try {
          const res = await fetch('/api/blackjack/hit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.getAuthToken()}`
            }
          });
          const data = await res.json();
          if (res.ok) {
            this.setBalance(data.balance);
            this.applyRoundState(data.round);
          } else {
            this.showToast(data.error || 'Erro ao pedir carta.', 'error');
          }
        } catch (e) {
          console.error(e);
        } finally {
          this.isBusy = false;
        }
        return;
      }

      // Local Hit
      const hand = this.playerHands[this.activeHandIndex];
      const newCard = this.drawCard();
      hand.cards.push(newCard);
      window.audioSystem?.playCardDeal();
      this.renderTableCards();

      const val = this.calcHand(hand.cards);
      if (val.isBust) {
        window.audioSystem?.playBust();
        hand.status = 'bust';
        if (this.activeHandIndex < this.playerHands.length - 1) {
          this.activeHandIndex++;
          this.renderTableCards();
        } else {
          this.resolveDealerTurn();
        }
      } else if (val.total === 21) {
        if (this.activeHandIndex < this.playerHands.length - 1) {
          this.activeHandIndex++;
          this.renderTableCards();
        } else {
          this.resolveDealerTurn();
        }
      }

      this.updateControls();
      this.isBusy = false;
    }

    async stand() {
      if (this.status !== 'playing' || this.isBusy) return;
      this.isBusy = true;

      if (this.isLoggedIn()) {
        try {
          const res = await fetch('/api/blackjack/stand', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.getAuthToken()}`
            }
          });
          const data = await res.json();
          if (res.ok) {
            this.setBalance(data.balance);
            this.applyRoundState(data.round);
          } else {
            this.showToast(data.error || 'Erro ao parar.', 'error');
          }
        } catch (e) {
          console.error(e);
        } finally {
          this.isBusy = false;
        }
        return;
      }

      // Local Stand
      const hand = this.playerHands[this.activeHandIndex];
      if (hand) hand.status = 'stand';

      if (this.activeHandIndex < this.playerHands.length - 1) {
        this.activeHandIndex++;
        this.renderTableCards();
      } else {
        this.resolveDealerTurn();
      }

      this.updateControls();
      this.isBusy = false;
    }

    async doubleDown() {
      if (this.status !== 'playing' || this.isBusy) return;
      const hand = this.playerHands[this.activeHandIndex];
      if (!hand || hand.cards.length !== 2 || hand.doubled) return;

      const bal = this.getBalance();
      if (bal < hand.bet) {
        this.showToast('Saldo insuficiente para dobrar a aposta.', 'warning');
        return;
      }

      this.isBusy = true;

      if (this.isLoggedIn()) {
        try {
          const res = await fetch('/api/blackjack/double', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.getAuthToken()}`
            }
          });
          const data = await res.json();
          if (res.ok) {
            this.setBalance(data.balance);
            this.applyRoundState(data.round);
          } else {
            this.showToast(data.error || 'Erro ao dobrar aposta.', 'error');
          }
        } catch (e) {
          console.error(e);
        } finally {
          this.isBusy = false;
        }
        return;
      }

      // Local Double
      this.setBalance(bal - hand.bet);
      hand.bet *= 2;
      hand.doubled = true;

      window.audioSystem?.playChipPlace();
      const newCard = this.drawCard();
      hand.cards.push(newCard);
      window.audioSystem?.playCardDeal();

      const val = this.calcHand(hand.cards);
      hand.status = val.isBust ? 'bust' : 'stand';

      this.renderTableCards();

      setTimeout(() => {
        if (this.activeHandIndex < this.playerHands.length - 1) {
          this.activeHandIndex++;
          this.renderTableCards();
        } else {
          this.resolveDealerTurn();
        }
        this.updateControls();
        this.isBusy = false;
      }, 500);
    }

    async split() {
      if (this.status !== 'playing' || this.isBusy) return;
      if (this.playerHands.length !== 1) return;
      const hand = this.playerHands[0];
      if (hand.cards.length !== 2) return;

      const c1 = hand.cards[0];
      const c2 = hand.cards[1];
      const isPair = c1.value === c2.value || (['10','J','Q','K'].includes(c1.value) && ['10','J','Q','K'].includes(c2.value));
      if (!isPair) {
        this.showToast('Você só pode dividir quando possui um par.', 'warning');
        return;
      }

      const bal = this.getBalance();
      if (bal < hand.bet) {
        this.showToast('Saldo insuficiente para dividir.', 'warning');
        return;
      }

      this.isBusy = true;

      if (this.isLoggedIn()) {
        try {
          const res = await fetch('/api/blackjack/split', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.getAuthToken()}`
            }
          });
          const data = await res.json();
          if (res.ok) {
            this.setBalance(data.balance);
            this.applyRoundState(data.round);
          } else {
            this.showToast(data.error || 'Erro ao dividir cartas.', 'error');
          }
        } catch (e) {
          console.error(e);
        } finally {
          this.isBusy = false;
        }
        return;
      }

      // Local Split
      this.setBalance(bal - hand.bet);
      window.audioSystem?.playChipPlace();

      const hand1 = { cards: [c1, this.drawCard()], bet: hand.bet, doubled: false, status: 'playing' };
      const hand2 = { cards: [c2, this.drawCard()], bet: hand.bet, doubled: false, status: 'playing' };

      this.playerHands = [hand1, hand2];
      this.activeHandIndex = 0;

      window.audioSystem?.playCardDeal();
      this.renderTableCards();
      this.updateControls();
      this.isBusy = false;
    }

    async takeInsurance() {
      if (this.status !== 'playing' || this.isBusy) return;
      this.showToast('Seguro de 2:1 contratado.', 'info');
      if (this.dom.btnInsurance) this.dom.btnInsurance.disabled = true;
    }

    // =========================================================================
    // RESOLUÇÃO DO DEALER (LOCAL)
    // =========================================================================

    resolveDealerTurn() {
      this.status = 'dealer_turn';
      this.updateControls();

      // Revela a carta oculta
      if (this.dealerCards[1]) {
        this.dealerCards[1].hidden = false;
        window.audioSystem?.playCardFlip();
      }
      this.renderTableCards(true);

      const allBusted = this.playerHands.every(h => this.calcHand(h.cards).isBust);

      const drawNextDealerCard = () => {
        let dVal = this.calcHand(this.dealerCards);
        if (!allBusted && dVal.total < 17) {
          setTimeout(() => {
            const nextCard = this.drawCard();
            this.dealerCards.push(nextCard);
            window.audioSystem?.playCardDeal();
            this.renderTableCards(true);
            drawNextDealerCard();
          }, 600);
        } else {
          setTimeout(() => this.finalizeRoundLocal(), 400);
        }
      };

      setTimeout(drawNextDealerCard, 500);
    }

    finalizeRoundLocal() {
      const dVal = this.calcHand(this.dealerCards);
      let totalPayout = 0;
      let hasWin = false;
      let hasBj = false;
      let hasPush = false;

      for (const hand of this.playerHands) {
        const pVal = this.calcHand(hand.cards);
        if (pVal.isBust) {
          hand.result = 'bust';
        } else if (dVal.isBust) {
          hand.result = 'win';
          totalPayout += hand.bet * 2;
          hasWin = true;
        } else if (pVal.total > dVal.total) {
          hand.result = 'win';
          totalPayout += hand.bet * 2;
          hasWin = true;
        } else if (pVal.total === dVal.total) {
          hand.result = 'push';
          totalPayout += hand.bet;
          hasPush = true;
        } else {
          hand.result = 'loss';
        }
      }

      if (totalPayout > 0) {
        this.setBalance(this.getBalance() + totalPayout);
      }

      let resType = 'loss';
      let msg = `Dealer vence com ${dVal.total}.`;

      if (dVal.isBust) {
        resType = 'win';
        msg = `Dealer estourou com ${dVal.total}! Você venceu!`;
      } else if (hasWin) {
        resType = 'win';
        msg = `Vitória! ${this.calcHand(this.playerHands[0].cards).total} vs ${dVal.total} do dealer.`;
      } else if (hasPush && !hasWin) {
        resType = 'push';
        msg = `Empate (Push)! Suas moedas foram devolvidas.`;
      }

      this.resolveEndRound(resType, totalPayout, msg);
    }

    resolveEndRound(type, payout, message) {
      this.status = 'resolved';
      this.sessionStats.hands++;
      if (type === 'win' || type === 'blackjack') {
        this.sessionStats.wins++;
        if (type === 'blackjack') this.sessionStats.blackjacks++;
        if (payout > this.sessionStats.biggestWin) this.sessionStats.biggestWin = payout;
      }
      this.updateStatsDisplay();

      // Sons e Efeitos
      if (type === 'blackjack') {
        window.audioSystem?.playBlackjack();
        window.particleEngine?.burst(window.innerWidth / 2, window.innerHeight / 2, 70);
      } else if (type === 'win') {
        window.audioSystem?.playWinTriple();
        window.particleEngine?.burst(window.innerWidth / 2, window.innerHeight / 2, 45);
      } else if (type === 'push') {
        window.audioSystem?.playPush();
      } else {
        window.audioSystem?.playBust();
      }

      this.showResultOverlay(type, payout, message);
      this.updateControls();
    }

    applyRoundState(round) {
      if (!round) return;

      this.dealerCards = round.dealerCards || [];
      this.playerHands = round.playerHands || [];
      this.activeHandIndex = round.activeHandIndex || 0;

      const isResolved = round.status === 'resolved';
      this.renderTableCards(isResolved);

      if (isResolved) {
        this.status = 'resolved';
        let resType = 'loss';
        if (round.dealerIsBust || round.totalPayout > this.currentBet) {
          resType = round.playerHands.some(h => h.isBlackjack) ? 'blackjack' : 'win';
        } else if (round.totalPayout === this.currentBet && this.currentBet > 0) {
          resType = 'push';
        }
        this.resolveEndRound(resType, round.totalPayout, round.message);
      } else {
        this.status = round.status || 'playing';
      }

      this.updateControls(round);
    }

    // =========================================================================
    // RENDERIZAÇÃO DE CARTAS E UI
    // =========================================================================

    renderTableCards(revealDealer = false) {
      // 1. Dealer Cards
      if (this.dom.dealerCardsRow) {
        this.dom.dealerCardsRow.innerHTML = '';
        this.dealerCards.forEach((card, idx) => {
          this.dom.dealerCardsRow.appendChild(this.createCardElement(card, idx));
        });

        const dVal = this.calcHand(revealDealer ? this.dealerCards.map(c => ({ ...c, hidden: false })) : this.dealerCards);
        if (this.dom.dealerScoreVal) {
          this.dom.dealerScoreVal.textContent = dVal.total > 0 ? (revealDealer ? dVal.total : `${dVal.total} + ?`) : '0';
        }
        if (this.dom.dealerScoreBadge) {
          this.dom.dealerScoreBadge.classList.toggle('blackjack', dVal.isBlackjack);
          this.dom.dealerScoreBadge.classList.toggle('bust', dVal.isBust);
        }
      }

      // 2. Player Cards (Suporte a Split)
      if (this.playerHands.length > 1) {
        if (this.dom.splitHandsWrapper) {
          this.dom.splitHandsWrapper.style.display = 'flex';
          this.dom.playerCardsRow.style.display = 'none';
          this.dom.splitHandsWrapper.innerHTML = '';

          this.playerHands.forEach((hand, hIdx) => {
            const hVal = this.calcHand(hand.cards);
            const box = document.createElement('div');
            box.className = `bj-hand-box ${hIdx === this.activeHandIndex ? 'active-hand' : ''}`;
            
            const badge = document.createElement('div');
            badge.className = 'bj-score-badge';
            badge.innerHTML = `<span>Mão ${hIdx + 1}:</span> <strong class="bj-score-val">${hVal.total}</strong>`;
            
            const row = document.createElement('div');
            row.className = 'bj-cards-row';
            hand.cards.forEach((card, cIdx) => row.appendChild(this.createCardElement(card, cIdx)));

            box.appendChild(badge);
            box.appendChild(row);
            this.dom.splitHandsWrapper.appendChild(box);
          });
        }
      } else {
        if (this.dom.splitHandsWrapper) this.dom.splitHandsWrapper.style.display = 'none';
        if (this.dom.playerCardsRow) {
          this.dom.playerCardsRow.style.display = 'flex';
          this.dom.playerCardsRow.innerHTML = '';
          const hand = this.playerHands[0] || { cards: [] };
          hand.cards.forEach((card, idx) => {
            this.dom.playerCardsRow.appendChild(this.createCardElement(card, idx));
          });

          const pVal = this.calcHand(hand.cards);
          if (this.dom.playerScoreVal) {
            this.dom.playerScoreVal.textContent = pVal.total > 0 ? (pVal.isSoft && pVal.total < 21 ? `${pVal.total} (Soft)` : pVal.total) : '0';
          }
          if (this.dom.playerScoreBadge) {
            this.dom.playerScoreBadge.classList.toggle('blackjack', pVal.isBlackjack);
            this.dom.playerScoreBadge.classList.toggle('bust', pVal.isBust);
          }
        }
      }
    }

    createCardElement(card, index = 0) {
      const el = document.createElement('div');

      if (card.hidden) {
        el.className = 'bj-card face-down';
        el.style.zIndex = index + 1;
        el.innerHTML = `
          <div class="card-back-pattern">
            <span class="card-back-logo">CS</span>
          </div>
        `;
        return el;
      }

      el.className = `bj-card ${card.color || (['♥', '♦'].includes(card.suit) ? 'red' : 'black')}`;
      el.style.zIndex = index + 1;
      el.innerHTML = `
        <div class="bj-card-corner top-left">
          <span class="bj-card-value">${card.value}</span>
          <span class="bj-card-suit-mini">${card.suit}</span>
        </div>
        <div class="bj-card-center-suit">${card.suit}</div>
        <div class="bj-card-corner bottom-right">
          <span class="bj-card-value">${card.value}</span>
          <span class="bj-card-suit-mini">${card.suit}</span>
        </div>
      `;
      return el;
    }

    updateControls(serverRound = null) {
      const isBetting = this.status === 'betting' || this.status === 'resolved';
      const isPlaying = this.status === 'playing';

      // Fichas e controles de aposta ativos apenas antes de dar cartas
      this.dom.chips?.forEach(c => c.disabled = !isBetting);
      if (this.dom.btnClearBet) this.dom.btnClearBet.disabled = !isBetting || this.currentBet <= 0;
      if (this.dom.btnDoubleBet) this.dom.btnDoubleBet.disabled = !isBetting || this.currentBet <= 0;
      if (this.dom.btnRebet) this.dom.btnRebet.disabled = !isBetting || this.lastBet <= 0;
      if (this.dom.btnAllIn) this.dom.btnAllIn.disabled = !isBetting || this.getBalance() <= 0;

      // Botão DEAL
      if (this.dom.btnDeal) {
        this.dom.btnDeal.disabled = !isBetting || this.currentBet <= 0;
        this.dom.btnDeal.innerHTML = this.status === 'resolved' ? '🔄 NOVA MÃO' : '🃏 DAR CARTAS';
      }

      // Ações táticas
      const activeHand = this.playerHands[this.activeHandIndex] || this.playerHands[0];
      const bal = this.getBalance();

      if (this.dom.btnHit) {
        this.dom.btnHit.disabled = serverRound ? !serverRound.canHit : (!isPlaying || !activeHand || activeHand.status !== 'playing');
      }
      if (this.dom.btnStand) {
        this.dom.btnStand.disabled = serverRound ? !serverRound.canStand : (!isPlaying || !activeHand || activeHand.status !== 'playing');
      }
      if (this.dom.btnDouble) {
        const canDoubleLocal = isPlaying && activeHand && activeHand.cards.length === 2 && !activeHand.doubled && bal >= activeHand.bet;
        this.dom.btnDouble.disabled = serverRound ? (!serverRound.canDouble || bal < (activeHand?.bet || 0)) : !canDoubleLocal;
      }
      if (this.dom.btnSplit) {
        const canSplitLocal = isPlaying && this.playerHands.length === 1 && activeHand && activeHand.cards.length === 2 && (activeHand.cards[0].value === activeHand.cards[1].value || (['10','J','Q','K'].includes(activeHand.cards[0].value) && ['10','J','Q','K'].includes(activeHand.cards[1].value))) && bal >= activeHand.bet;
        this.dom.btnSplit.disabled = serverRound ? (!serverRound.canSplit || bal < (activeHand?.bet || 0)) : !canSplitLocal;
      }
      if (this.dom.btnInsurance) {
        const canInsLocal = isPlaying && this.dealerCards[0] && this.dealerCards[0].value === 'A';
        this.dom.btnInsurance.disabled = serverRound ? !serverRound.canInsurance : !canInsLocal;
      }
    }

    showResultOverlay(type, payout, message) {
      if (!this.dom.resultOverlay) return;
      this.dom.resultOverlay.className = `bj-result-overlay show ${type}`;

      if (this.dom.resultTitle) {
        let title = 'FIM DA RODADA';
        if (type === 'blackjack') title = '👑 NATURAL BLACKJACK!';
        else if (type === 'win') title = '★ VOCÊ VENCEU! ★';
        else if (type === 'push') title = 'EMPATE (PUSH)';
        else if (type === 'loss') title = 'DEALER VENCEU';
        this.dom.resultTitle.textContent = title;
      }

      if (this.dom.resultPayout) {
        this.dom.resultPayout.textContent = payout > 0 ? `+${payout.toLocaleString('pt-BR')} moedas` : message;
      }
    }

    hideResultOverlay() {
      if (this.dom.resultOverlay) {
        this.dom.resultOverlay.className = 'bj-result-overlay';
      }
    }

    updateStatsDisplay() {
      if (this.dom.statHands) this.dom.statHands.textContent = this.sessionStats.hands;
      if (this.dom.statWins) this.dom.statWins.textContent = this.sessionStats.wins;
      if (this.dom.statBjs) this.dom.statBjs.textContent = this.sessionStats.blackjacks;
      if (this.dom.statBiggest) this.dom.statBiggest.textContent = this.sessionStats.biggestWin.toLocaleString('pt-BR');
    }

    showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = message;
      toast.className = `toast-notification show ${type}`;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        toast.className = 'toast-notification';
      }, 3500);
    }
  }

  window.CostaBlackjack = CostaBlackjack;
})();
