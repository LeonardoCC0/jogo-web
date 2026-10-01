/**
 * CYBER NEON SLOTS - Motor dos Rolos e Lógica de Jogo com Auditoria de Transações
 * Gerencia a animação dos rolos, RNG ponderado, física de parada e validação por Ledger.
 */

(function(root) {
  'use strict';

  class SlotMachine {
    constructor({ reelElements, onSpinStart, onReelStop, onSpinComplete }) {
      this.reels = reelElements;
      this.onSpinStart = onSpinStart || (() => {});
      this.onReelStop = onReelStop || (() => {});
      this.onSpinComplete = onSpinComplete || (() => {});

      this.isSpinning = false;
      const symbols = root.CONFIG ? root.CONFIG.SYMBOLS : [];
      this.currentResults = [symbols[0], symbols[1], symbols[2]];
      this.itemHeight = 110;
      this.currentProofNonce = null;

      this.init();
    }

    init() {
      this.updateItemHeight();
      window.addEventListener('resize', () => this.updateItemHeight());

      // Preenche os rolos com símbolos iniciais
      this.reels.forEach((reel, index) => {
        this.renderInitialReel(reel, index);
      });
    }

    updateItemHeight() {
      if (this.reels[0]) {
        const sampleItem = this.reels[0].querySelector('.slot-symbol');
        if (sampleItem) {
          this.itemHeight = sampleItem.offsetHeight || 110;
        }
      }
    }

    // Gera um símbolo baseado nos pesos do RNG
    getRandomSymbol() {
      const symbols = root.CONFIG.SYMBOLS;
      const totalWeight = symbols.reduce((acc, s) => acc + s.weight, 0);
      let rand = Math.random() * totalWeight;

      for (const sym of symbols) {
        if (rand < sym.weight) {
          return sym;
        }
        rand -= sym.weight;
      }
      return symbols[0];
    }

    renderInitialReel(reel, reelIndex) {
      const strip = reel.querySelector('.reel-strip');
      if (!strip) return;

      const symbols = root.CONFIG.SYMBOLS;
      const centerSym = this.currentResults[reelIndex] || symbols[reelIndex % symbols.length];
      const topSym = symbols[(symbols.indexOf(centerSym) + 1) % symbols.length];
      const botSym = symbols[(symbols.indexOf(centerSym) + 2) % symbols.length];

      strip.innerHTML = `
        <div class="slot-symbol" data-id="${topSym.id}">
          <span class="symbol-icon">${topSym.icon}</span>
          <span class="symbol-name">${topSym.name}</span>
        </div>
        <div class="slot-symbol active-center" data-id="${centerSym.id}">
          <span class="symbol-icon">${centerSym.icon}</span>
          <span class="symbol-name">${centerSym.name}</span>
        </div>
        <div class="slot-symbol" data-id="${botSym.id}">
          <span class="symbol-icon">${botSym.icon}</span>
          <span class="symbol-name">${botSym.name}</span>
        </div>
      `;

      strip.style.transform = `translateY(0px)`;
    }

    // Executa o giro sincronizado com o servidor (ou local)
    spin({ isTurbo = false, betAmount = 25, forcedSymbols = null, serverOutcome = null }) {
      if (this.isSpinning) return false;

      // 1. Registra no Ledger de Segurança anti-fraude se local
      try {
        if (!serverOutcome && root.CNS_SECURITY && root.CNS_SECURITY.ledger) {
          this.currentProofNonce = root.CNS_SECURITY.ledger.registerSpinStart(betAmount);
        }
      } catch (err) {
        console.warn('Giro bloqueado pela segurança:', err.message);
        return false;
      }

      this.isSpinning = true;
      this.updateItemHeight();

      // 2. Utiliza os símbolos sorteados pelo servidor se fornecidos
      const finalSymbols = forcedSymbols || [
        this.getRandomSymbol(),
        this.getRandomSymbol(),
        this.getRandomSymbol()
      ];

      this.onSpinStart({ betAmount });
      if (root.audioSystem) {
        root.audioSystem.startSpinSound();
      }

      const delays = isTurbo ? root.CONFIG.REEL_DELAY_TURBO : root.CONFIG.REEL_DELAY_NORMAL;
      const spinPromises = [];

      // 3. Anima cada um dos 3 rolos individualmente
      this.reels.forEach((reel, index) => {
        const promise = this.animateReel({
          reel,
          reelIndex: index,
          targetSymbol: finalSymbols[index],
          duration: delays[index],
          isTurbo
        });
        spinPromises.push(promise);
      });

      // 4. Quando todos os rolos terminarem
      Promise.all(spinPromises).then(() => {
        if (root.audioSystem) {
          root.audioSystem.stopSpinSound();
        }
        this.isSpinning = false;
        this.currentResults = finalSymbols;

        // Se veio do servidor, usa o resultado autoritativo
        const outcome = serverOutcome || this.evaluateWin(finalSymbols, betAmount);

        // 5. Validação da transação no Ledger se foi local
        if (!serverOutcome) {
          try {
            if (root.CNS_SECURITY && root.CNS_SECURITY.ledger && this.currentProofNonce) {
              root.CNS_SECURITY.ledger.validateSpinWin(this.currentProofNonce, outcome);
            }
          } catch (secErr) {
            console.error('🚨 Alerta Crítico de Fraude:', secErr.message);
            outcome.isWin = false;
            outcome.winAmount = 0;
            outcome.type = 'loss';
            outcome.message = 'Transação rejeitada pelo sistema de segurança.';
          }
        }

        this.onSpinComplete(outcome);
      });

      return true;
    }

    animateReel({ reel, reelIndex, targetSymbol, duration, isTurbo }) {
      return new Promise(resolve => {
        const strip = reel.querySelector('.reel-strip');
        const itemHeight = this.itemHeight;
        const symbols = root.CONFIG.SYMBOLS;

        const numIntermediates = isTurbo ? 14 : 22 + (reelIndex * 6);
        const intermediateSymbols = [];

        for (let i = 0; i < numIntermediates; i++) {
          intermediateSymbols.push(this.getRandomSymbol());
        }

        const targetIdx = symbols.indexOf(targetSymbol);
        const topSymbol = symbols[(targetIdx + 1) % symbols.length];
        const botSymbol = symbols[(targetIdx + symbols.length - 1) % symbols.length];

        const allSymbols = [
          ...intermediateSymbols,
          topSymbol,
          targetSymbol,
          botSymbol
        ];

        strip.innerHTML = allSymbols.map((sym, i) => `
          <div class="slot-symbol ${i === allSymbols.length - 2 ? 'target-center' : ''}" data-id="${sym.id}">
            <span class="symbol-icon">${sym.icon}</span>
            <span class="symbol-name">${sym.name}</span>
          </div>
        `).join('');

        reel.classList.add('spinning');

        strip.style.transition = 'none';
        strip.style.transform = `translateY(0px)`;
        strip.offsetHeight;

        const targetIndex = allSymbols.length - 2;
        const targetTranslateY = -(targetIndex - 1) * itemHeight;

        const easing = isTurbo
          ? 'cubic-bezier(0.2, 0.8, 0.4, 1.05)'
          : 'cubic-bezier(0.12, 0.85, 0.28, 1.12)';

        strip.style.transition = `transform ${duration}ms ${easing}`;
        strip.style.transform = `translateY(${targetTranslateY}px)`;

        setTimeout(() => {
          reel.classList.remove('spinning');
          if (root.audioSystem) {
            root.audioSystem.playReelStop(reelIndex);
          }

          const centerElement = strip.querySelector('.target-center');
          if (centerElement) {
            centerElement.classList.add('active-center');
          }

          this.onReelStop({ reelIndex, symbol: targetSymbol });
          resolve(targetSymbol);
        }, duration);
      });
    }

    evaluateWin(symbols, betAmount) {
      const [s1, s2, s3] = symbols;

      // 3 símbolos iguais
      if (s1.id === s2.id && s2.id === s3.id) {
        const multiplier = s1.mult3;
        const winAmount = Math.round(betAmount * multiplier);
        const isJackpot = s1.id === 'crown';
        const isBigWin = multiplier >= 15;

        return {
          isWin: true,
          type: isJackpot ? 'jackpot' : (isBigWin ? 'big_win' : 'triple'),
          symbols,
          winningSymbol: s1,
          matchCount: 3,
          multiplier,
          betAmount,
          winAmount,
          message: isJackpot ? '👑 JACKPOT SUPREMO! 👑' : `VITÓRIA TRIPLA: ${s1.name.toUpperCase()}!`
        };
      }

      // 2 símbolos iguais
      let matchedSymbol = null;
      if (s1.id === s2.id || s1.id === s3.id) {
        matchedSymbol = s1;
      } else if (s2.id === s3.id) {
        matchedSymbol = s2;
      }

      if (matchedSymbol && matchedSymbol.mult2 > 0) {
        const multiplier = matchedSymbol.mult2;
        const winAmount = Math.round(betAmount * multiplier);

        return {
          isWin: true,
          type: 'double',
          symbols,
          winningSymbol: matchedSymbol,
          matchCount: 2,
          multiplier,
          betAmount,
          winAmount,
          message: `PAR DE ${matchedSymbol.name.toUpperCase()}!`
        };
      }

      return {
        isWin: false,
        type: 'loss',
        symbols,
        multiplier: 0,
        betAmount,
        winAmount: 0,
        message: 'Não foi dessa vez. Tente novamente!'
      };
    }

    highlightWin() {
      this.reels.forEach(reel => {
        const active = reel.querySelector('.active-center, .target-center');
        if (active) {
          active.classList.add('win-pulse');
        }
      });
    }

    clearHighlights() {
      this.reels.forEach(reel => {
        const items = reel.querySelectorAll('.win-pulse');
        items.forEach(el => el.classList.remove('win-pulse'));
      });
    }
  }

  root.SlotMachine = SlotMachine;

})(typeof window !== 'undefined' ? window : this);
