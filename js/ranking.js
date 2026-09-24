/**
 * CYBER NEON SLOTS - Sistema de Ranking Global 100% Real (Sem Bots)
 * Conecta-se à API autoritativa (/api/leaderboard) para exibir apenas jogadores reais cadastrados.
 */

(function(root) {
  'use strict';

  class RankingSystem {
    constructor() {
      this.container = null;
      this.previousRank = null;
      this.cachedLeaderboard = [];
      this.isLoading = false;
    }

    init(containerElement) {
      this.container = containerElement;
      this.fetchAndUpdate();
    }

    async fetchLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.leaderboard)) {
            this.cachedLeaderboard = data.leaderboard;
            return this.cachedLeaderboard;
          }
        }
      } catch (err) {
        console.warn('Não foi possível carregar ranking do servidor:', err.message);
      }
      return this.cachedLeaderboard;
    }

    async fetchAndUpdate(currentUser = null) {
      this.isLoading = true;
      const list = await this.fetchLeaderboard();
      this.isLoading = false;
      this.render(list, currentUser);
    }

    getCurrentUserRank(currentUser) {
      if (!currentUser || !this.cachedLeaderboard.length) return null;
      const index = this.cachedLeaderboard.findIndex(p =>
        (p.id && currentUser.id && p.id === currentUser.id) ||
        (p.name && currentUser.username && p.name.toLowerCase() === currentUser.username.toLowerCase())
      );
      return index !== -1 ? index + 1 : null;
    }

    render(list = this.cachedLeaderboard, currentUser = null) {
      if (!this.container) return;

      const currentRank = this.getCurrentUserRank(currentUser);
      const rankChanged = this.previousRank !== null && currentRank !== null && currentRank < this.previousRank;
      this.previousRank = currentRank;

      let html = `
        <div class="ranking-header">
          <div class="ranking-title">
            <span class="ranking-icon">🏆</span>
            <h3>Ranking Global Real</h3>
          </div>
          <span class="ranking-badge">Top Jogadores</span>
        </div>
        <div class="ranking-list">
      `;

      if (!list || list.length === 0) {
        html += `
          <div class="ranking-empty-state">
            <span class="ranking-empty-icon">🎮</span>
            <h4>Nenhum jogador classificado</h4>
            <p>Seja o primeiro a criar uma conta e girar para liderar o topo!</p>
            ${!currentUser ? '<button id="btn-ranking-login" class="btn-ranking-join">ENTRAR / CADASTRAR</button>' : ''}
          </div>
        `;
      } else {
        list.slice(0, 15).forEach((player, idx) => {
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

          const isCurrent = currentUser && (
            (player.id && currentUser.id && player.id === currentUser.id) ||
            (player.name && currentUser.username && player.name.toLowerCase() === currentUser.username.toLowerCase())
          );

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
                <div class="player-record">Melhor Vitória: ⚡ ${cleanWin.toLocaleString('pt-BR')}</div>
              </div>
              <div class="player-score">
                <span class="coin-val">${cleanBalance.toLocaleString('pt-BR')}</span>
                <span class="coin-unit">pts</span>
              </div>
            </div>
          `;
        });
      }

      html += `</div>`;

      this.container.innerHTML = html;

      // Evento no botão de entrar dentro do ranking se vazio
      const rankingLoginBtn = this.container.querySelector('#btn-ranking-login');
      if (rankingLoginBtn && root.openAuthModal) {
        rankingLoginBtn.addEventListener('click', () => root.openAuthModal('register'));
      }

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
        str = root.CNS_SECURITY.sanitizeInput(String(str), 16);
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
