/**
 * CYBER NEON SLOTS - Sistema de Ranking Global com Sanitização Anti-XSS
 * Gerencia a lista dos melhores jogadores e atualiza a posição do jogador em tempo real.
 */

(function(root) {
  'use strict';

  class RankingSystem {
    constructor() {
      this.container = null;
      this.previousRank = null;
    }

    init(containerElement) {
      this.container = containerElement;
      this.update();
    }

    // Atualiza ou insere o jogador atual na tabela e reordena
    getSortedLeaderboard() {
      const list = root.storage.getLeaderboard();
      const playerName = root.storage.getPlayerName();
      const playerAvatar = root.storage.getPlayerAvatar();
      const currentBalance = root.storage.getBalance();
      const highestWin = root.storage.getHighestWin();

      // Filtra entrada antiga do jogador se existir
      const others = list.filter(item => !item.isCurrentPlayer && item.name.toLowerCase() !== playerName.toLowerCase());

      // Cria/atualiza o registro do jogador atual
      const currentPlayerEntry = {
        name: playerName,
        balance: currentBalance,
        highestWin: highestWin,
        isCurrentPlayer: true,
        avatar: playerAvatar
      };

      const combined = [...others, currentPlayerEntry];

      // Ordena decrescente por saldo; se empate, por maior prêmio
      combined.sort((a, b) => {
        if (b.balance !== a.balance) {
          return b.balance - a.balance;
        }
        return b.highestWin - a.highestWin;
      });

      // Salva estado assinado
      root.storage.saveLeaderboard(combined);

      return combined;
    }

    getCurrentPlayerRank() {
      const list = this.getSortedLeaderboard();
      const index = list.findIndex(item => item.isCurrentPlayer);
      return index !== -1 ? index + 1 : list.length;
    }

    // Renderiza a interface do ranking com sanitização estrita
    update() {
      if (!this.container) return;

      const list = this.getSortedLeaderboard();
      const currentRank = this.getCurrentPlayerRank();
      const rankChanged = this.previousRank !== null && currentRank < this.previousRank;
      this.previousRank = currentRank;

      let html = `
        <div class="ranking-header">
          <div class="ranking-title">
            <span class="ranking-icon">🏆</span>
            <h3>Ranking Global</h3>
          </div>
          <span class="ranking-badge">Top Jogadores</span>
        </div>
        <div class="ranking-list">
      `;

      list.slice(0, 10).forEach((player, idx) => {
        const pos = idx + 1;
        let medal = `<span class="pos-num">${pos}º</span>`;
        let posClass = '';

        if (pos === 1) {
          medal = `<span class="medal gold">🥇</span>`;
          posClass = 'rank-1';
        } else if (pos === 2) {
          medal = `<span class="medal silver">🥈</span>`;
          posClass = 'rank-2';
        } else if (pos === 3) {
          medal = `<span class="medal bronze">🥉</span>`;
          posClass = 'rank-3';
        }

        const isCurrent = player.isCurrentPlayer;
        const highlightClass = isCurrent ? 'current-player-row' : '';
        const cleanName = this.escapeHtml(player.name);
        const cleanAvatar = this.escapeHtml(player.avatar || '👤');
        const cleanWin = parseInt(player.highestWin, 10) || 0;
        const cleanBalance = parseInt(player.balance, 10) || 0;

        html += `
          <div class="ranking-item ${posClass} ${highlightClass}" data-rank="${pos}">
            <div class="rank-position">${medal}</div>
            <div class="player-avatar">${cleanAvatar}</div>
            <div class="player-info">
              <div class="player-name">
                ${cleanName}
                ${isCurrent ? '<span class="you-tag">VOCÊ</span>' : ''}
              </div>
              <div class="player-record">Melhor: ⚡ ${cleanWin.toLocaleString('pt-BR')}</div>
            </div>
            <div class="player-score">
              <span class="coin-val">${cleanBalance.toLocaleString('pt-BR')}</span>
              <span class="coin-unit">pts</span>
            </div>
          </div>
        `;
      });

      html += `</div>`;

      this.container.innerHTML = html;

      if (rankChanged) {
        const currentElem = this.container.querySelector('.current-player-row');
        if (currentElem) {
          currentElem.classList.add('rank-up-glow');
          setTimeout(() => currentElem.classList.remove('rank-up-glow'), 2500);
        }
      }
    }

    escapeHtml(str) {
      if (root.CNS_SECURITY && root.CNS_SECURITY.sanitizeInput) {
        str = root.CNS_SECURITY.sanitizeInput(String(str), 15);
      }
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  root.rankingSystem = new RankingSystem();

})(typeof window !== 'undefined' ? window : this);
