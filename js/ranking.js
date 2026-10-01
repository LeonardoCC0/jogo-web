/**
 * CYBER NEON SLOTS - Sistema de Ranking Global 100% Real (Sem Bots)
 * Conecta-se à API autoritativa (/api/leaderboard) para exibir apenas jogadores reais cadastrados.
 * Sincroniza em tempo real o saldo e posição do jogador atual com o cabeçalho do jogo.
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
        const res = await fetch('/api/leaderboard?t=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
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

    getCurrentUserRank(currentUser, list = this.cachedLeaderboard) {
      if (!currentUser || !list || !list.length) return null;
      const index = list.findIndex(p =>
        (p.id && currentUser.id && p.id === currentUser.id) ||
        (p.name && currentUser.username && p.name.toLowerCase() === currentUser.username.toLowerCase())
      );
      return index !== -1 ? index + 1 : null;
    }

    render(list = this.cachedLeaderboard, currentUser = null) {
      if (!this.container) return;

      // Trabalha sobre uma cópia da lista
      let displayList = Array.isArray(list) ? list.map(item => ({ ...item })) : [];

      // Sincroniza dados do usuário logado se fornecido
      if (currentUser) {
        let userInList = displayList.find(p =>
          (p.id && currentUser.id && p.id === currentUser.id) ||
          (p.name && currentUser.username && p.name.toLowerCase() === currentUser.username.toLowerCase())
        );

        if (userInList) {
          if (currentUser.balance !== undefined) {
            userInList.balance = currentUser.balance;
          }
          if (currentUser.highestWin !== undefined && currentUser.highestWin > (userInList.highestWin || 0)) {
            userInList.highestWin = currentUser.highestWin;
          }
        } else if (currentUser.username) {
          // Se o usuário ainda não está no retorno da API, inclui para cálculo de posição
          userInList = {
            id: currentUser.id,
            name: currentUser.displayName || currentUser.username,
            avatar: currentUser.avatar || '⚡',
            balance: currentUser.balance !== undefined ? currentUser.balance : 1000,
            highestWin: currentUser.highestWin || 0,
            score: currentUser.balance !== undefined ? currentUser.balance : 1000
          };
          displayList.push(userInList);
        }

        // Reordena pelo saldo atualizado para manter a classificação impecável
        displayList.sort((a, b) => {
          const balA = parseInt(a.balance, 10) || 0;
          const balB = parseInt(b.balance, 10) || 0;
          if (balB !== balA) return balB - balA;
          return (parseInt(b.highestWin, 10) || 0) - (parseInt(a.highestWin, 10) || 0);
        });
      }

      const currentRank = this.getCurrentUserRank(currentUser, displayList);
      const rankChanged = this.previousRank !== null && currentRank !== null && currentRank < this.previousRank;
      this.previousRank = currentRank;

      const topLimit = 20;
      const topSlice = displayList.slice(0, topLimit);
      const isUserInTopSlice = currentUser && topSlice.some(p =>
        (p.id && currentUser.id && p.id === currentUser.id) ||
        (p.name && currentUser.username && p.name.toLowerCase() === currentUser.username.toLowerCase())
      );

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

      if (!displayList || displayList.length === 0) {
        html += `
          <div class="ranking-empty-state">
            <span class="ranking-empty-icon">🎮</span>
            <h4>Nenhum jogador classificado</h4>
            <p>Seja o primeiro a criar uma conta e girar para liderar o topo!</p>
            ${!currentUser ? '<button id="btn-ranking-login" class="btn-ranking-join">ENTRAR / CADASTRAR</button>' : ''}
          </div>
        `;
      } else {
        topSlice.forEach((player, idx) => {
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
          const avatarDisplay = this.getAvatarMarkup(player.avatar);

          // Garante que o saldo do jogador atual no ranking seja estritamente igual ao do topo
          const cleanBalance = (isCurrent && currentUser && currentUser.balance !== undefined)
            ? Math.max(0, parseInt(currentUser.balance, 10))
            : Math.max(0, parseInt(player.balance, 10) || 0);

          const cleanWin = (isCurrent && currentUser && currentUser.highestWin !== undefined)
            ? Math.max(parseInt(player.highestWin, 10) || 0, parseInt(currentUser.highestWin, 10) || 0)
            : Math.max(0, parseInt(player.highestWin, 10) || 0);

          html += `
            <div class="ranking-item ${posClass} ${highlightClass}" data-rank="${pos}">
              <div class="rank-position">${medal}</div>
              <div class="player-avatar">${avatarDisplay}</div>
              <div class="player-info">
                <div class="player-name">
                  ${cleanName}
                  ${isCurrent ? '<span class="you-tag">VOCÊ</span>' : ''}
                </div>
                <div class="player-record">Melhor Vitória: <strong>⚡ ${cleanWin.toLocaleString('pt-BR')}</strong></div>
              </div>
              <div class="player-score">
                <span class="coin-val">${cleanBalance.toLocaleString('pt-BR')}</span>
                <span class="coin-unit">moedas</span>
              </div>
            </div>
          `;
        });
      }

      html += `</div>`;

      // Se o jogador estiver conectado mas não estiver no top exibido, fixa cartão especial dele no rodapé
      if (currentUser && !isUserInTopSlice && currentRank) {
        const userCleanName = this.escapeHtml(currentUser.displayName || currentUser.username);
        const userAvatar = this.getAvatarMarkup(currentUser.avatar);
        const userBal = Math.max(0, parseInt(currentUser.balance, 10) || 0);
        const userWin = Math.max(0, parseInt(currentUser.highestWin, 10) || 0);

        html += `
          <div class="ranking-user-pinned">
            <div class="ranking-item current-player-row is-pinned" data-rank="${currentRank}">
              <div class="rank-position"><span class="pos-num">${currentRank}º</span></div>
              <div class="player-avatar">${userAvatar}</div>
              <div class="player-info">
                <div class="player-name">
                  ${userCleanName}
                  <span class="you-tag">VOCÊ</span>
                </div>
                <div class="player-record">Melhor Vitória: <strong>⚡ ${userWin.toLocaleString('pt-BR')}</strong></div>
              </div>
              <div class="player-score">
                <span class="coin-val">${userBal.toLocaleString('pt-BR')}</span>
                <span class="coin-unit">moedas</span>
              </div>
            </div>
          </div>
        `;
      }

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

    getAvatarMarkup(avatar) {
      const clean = this.escapeHtml(avatar || '👤');
      if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
        const safeUrl = encodeURIComponent(avatar);
        return `
          <img
            src="/api/avatar?url=${safeUrl}"
            alt="Avatar"
            style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;"
            onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='👤';"
          >
        `;
      }
      return clean;
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
