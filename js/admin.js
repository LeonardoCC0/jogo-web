/**
 * CYBER NEON SLOTS - Painel Administrativo (Frontend)
 * Consome a API administrativa protegida no backend.
 * NENHUMA permissão é verificada aqui — toda autorização é feita no servidor.
 */

(function() {
  'use strict';

  const storage = window.storage;

  class AdminPanel {
    constructor() {
      this.authToken = storage.getAuthToken();
      this.currentUser = null;
      this.isFounder = false;
      this.allUsers = [];
      this.allLogs = [];
      this.currentTab = 'tab-dashboard';
      this.dom = {};
    }

    async init() {
      this.cacheDOM();

      // Verifica autenticação e autorização no backend
      const authorized = await this.checkAdminAccess();
      if (!authorized) {
        this.showAccessDenied();
        return;
      }

      // Usuário autorizado — mostra o painel
      this.showPanel();
      this.bindEvents();
      this.updateHeader();
      await this.loadDashboard();
    }

    cacheDOM() {
      this.dom = {
        accessDeniedScreen: document.getElementById('access-denied-screen'),
        adminApp: document.getElementById('admin-app'),
        adminHeaderTitle: document.getElementById('admin-header-title'),
        adminHeaderSubtitle: document.getElementById('admin-header-subtitle'),
        adminBadgeRole: document.getElementById('admin-badge-role'),
        adminBadgeIcon: document.getElementById('admin-badge-icon'),
        adminBadgeText: document.getElementById('admin-badge-text'),
        currentAdminAvatar: document.getElementById('current-admin-avatar'),
        currentAdminName: document.getElementById('current-admin-name'),
        currentAdminEmail: document.getElementById('current-admin-email'),
        btnAdminLogout: document.getElementById('btn-admin-logout'),

        // Tabs
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabBtnAdmins: document.getElementById('tab-btn-admins'),

        // Dashboard
        statTotalUsers: document.getElementById('stat-total-users'),
        statTotalBalance: document.getElementById('stat-total-balance'),
        statTotalSpins: document.getElementById('stat-total-spins'),
        statTotalBanned: document.getElementById('stat-total-banned'),
        statTotalAdmins: document.getElementById('stat-total-admins'),
        statStorageMode: document.getElementById('stat-storage-mode'),
        btnRefreshStats: document.getElementById('btn-refresh-stats'),

        // Players
        filterPlayerSearch: document.getElementById('filter-player-search'),
        filterPlayerRole: document.getElementById('filter-player-role'),
        filterPlayerSort: document.getElementById('filter-player-sort'),
        playersTableBody: document.getElementById('players-table-body'),
        btnRefreshPlayers: document.getElementById('btn-refresh-players'),

        // Admins
        btnOpenPromoteModal: document.getElementById('btn-open-promote-modal'),
        adminsTableBody: document.getElementById('admins-table-body'),

        // Logs
        filterLogSearch: document.getElementById('filter-log-search'),
        filterLogAction: document.getElementById('filter-log-action'),
        logsTableBody: document.getElementById('logs-table-body'),
        btnRefreshLogs: document.getElementById('btn-refresh-logs'),

        // Modals
        modalChangeBalance: document.getElementById('modal-change-balance'),
        balModalAvatar: document.getElementById('bal-modal-avatar'),
        balModalName: document.getElementById('bal-modal-name'),
        balModalSub: document.getElementById('bal-modal-sub'),
        balModalCurrent: document.getElementById('bal-modal-current'),
        balInputTypeAdd: document.querySelector('input[name="bal-op-type"][value="add"]'),
        balInputTypeSet: document.querySelector('input[name="bal-op-type"][value="set"]'),
        balInputAmount: document.getElementById('bal-input-amount'),
        balLabelAmount: document.getElementById('bal-label-amount'),
        balPreviewNew: document.getElementById('bal-preview-new'),
        balPreviewDiff: document.getElementById('bal-preview-diff'),
        balInputReason: document.getElementById('bal-input-reason'),
        btnConfirmBalance: document.getElementById('btn-confirm-balance'),

        modalBanUser: document.getElementById('modal-ban-user'),
        banModalUsername: document.getElementById('ban-modal-username'),
        banInputReason: document.getElementById('ban-input-reason'),
        btnConfirmBan: document.getElementById('btn-confirm-ban'),

        modalUnbanUser: document.getElementById('modal-unban-user'),
        unbanModalUsername: document.getElementById('unban-modal-username'),
        unbanInputReason: document.getElementById('unban-input-reason'),
        btnConfirmUnban: document.getElementById('btn-confirm-unban'),

        modalDeleteUser: document.getElementById('modal-delete-user'),
        delModalTargetUser: document.getElementById('del-modal-target-user'),
        delModalConfirmTarget: document.getElementById('del-modal-confirm-target'),
        delInputConfirm: document.getElementById('del-input-confirm'),
        delInputReason: document.getElementById('del-input-reason'),
        btnConfirmDelete: document.getElementById('btn-confirm-delete'),

        modalPromoteAdmin: document.getElementById('modal-promote-admin'),
        promoteSelectUser: document.getElementById('promote-select-user'),
        promoteInputReason: document.getElementById('promote-input-reason'),
        btnConfirmPromote: document.getElementById('btn-confirm-promote'),

        modalDemoteAdmin: document.getElementById('modal-demote-admin'),
        demoteModalTarget: document.getElementById('demote-modal-target'),
        demoteInputReason: document.getElementById('demote-input-reason'),
        btnConfirmDemote: document.getElementById('btn-confirm-demote'),

        // Toast
        adminToast: document.getElementById('admin-toast'),

        // Quick chips
        quickChips: document.querySelectorAll('.quick-chip'),

        // Modal close buttons
        modalCloseBtns: document.querySelectorAll('.modal-close-x')
      };
    }

    // =========================================================================
    // AUTENTICAÇÃO E AUTORIZAÇÃO (BACKEND)
    // =========================================================================

    async checkAdminAccess() {
      if (!this.authToken) return false;

      try {
        const res = await fetch('/api/admin/check', {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        });

        if (!res.ok) return false;

        const data = await res.json();
        if (!data.success) return false;

        this.currentUser = data.user;
        this.isFounder = data.isFounder === true;
        return true;
      } catch (e) {
        console.error('Erro ao verificar acesso admin:', e);
        return false;
      }
    }

    showAccessDenied() {
      if (this.dom.adminApp) this.dom.adminApp.classList.add('hidden');
      if (this.dom.accessDeniedScreen) this.dom.accessDeniedScreen.classList.remove('hidden');
    }

    showPanel() {
      if (this.dom.accessDeniedScreen) this.dom.accessDeniedScreen.classList.add('hidden');
      if (this.dom.adminApp) this.dom.adminApp.classList.remove('hidden');
    }

    updateHeader() {
      if (!this.currentUser) return;

      if (this.dom.currentAdminName) {
        this.dom.currentAdminName.textContent = this.currentUser.displayName || this.currentUser.username;
      }
      if (this.dom.currentAdminEmail) {
        this.dom.currentAdminEmail.textContent = this.currentUser.email || this.currentUser.username;
      }
      if (this.dom.currentAdminAvatar) {
        const av = this.currentUser.avatar || '👤';
        if (/^https?:\/\//.test(av) || av.startsWith('data:image/jpeg;base64,')) {
          this.dom.currentAdminAvatar.innerHTML = `<img src="${this.escapeHtml(av)}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
          this.dom.currentAdminAvatar.textContent = av;
        }
      }

      // Badge de role
      if (this.dom.adminBadgeRole) {
        if (this.isFounder) {
          this.dom.adminBadgeRole.className = 'badge-role badge-role-founder';
          if (this.dom.adminBadgeIcon) this.dom.adminBadgeIcon.textContent = '⚡';
          if (this.dom.adminBadgeText) this.dom.adminBadgeText.textContent = 'FOUNDER';
          if (this.dom.adminHeaderTitle) this.dom.adminHeaderTitle.textContent = 'CYBER SLOTS // FOUNDER';
          if (this.dom.adminHeaderSubtitle) this.dom.adminHeaderSubtitle.textContent = 'CONTROLE TOTAL';
        } else {
          this.dom.adminBadgeRole.className = 'badge-role badge-role-admin';
          if (this.dom.adminBadgeIcon) this.dom.adminBadgeIcon.textContent = '⚙';
          if (this.dom.adminBadgeText) this.dom.adminBadgeText.textContent = 'ADMINISTRADOR';
        }
      }

      // Tab de administradores (apenas founder)
      if (this.dom.tabBtnAdmins) {
        if (this.isFounder) {
          this.dom.tabBtnAdmins.classList.remove('hidden');
        } else {
          this.dom.tabBtnAdmins.classList.add('hidden');
        }
      }
    }

    // =========================================================================
    // EVENTOS
    // =========================================================================

    bindEvents() {
      // Tabs
      this.dom.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          this.switchTab(tab);
        });
      });

      // Logout
      if (this.dom.btnAdminLogout) {
        this.dom.btnAdminLogout.addEventListener('click', () => this.handleLogout());
      }

      // Refresh buttons
      if (this.dom.btnRefreshStats) {
        this.dom.btnRefreshStats.addEventListener('click', () => this.loadDashboard());
      }
      if (this.dom.btnRefreshPlayers) {
        this.dom.btnRefreshPlayers.addEventListener('click', () => this.loadPlayers());
      }
      if (this.dom.btnRefreshLogs) {
        this.dom.btnRefreshLogs.addEventListener('click', () => this.loadLogs());
      }
      document.getElementById('btn-more-logs')?.addEventListener('click', () => this.loadLogs(true));

      // Filtros de jogadores
      if (this.dom.filterPlayerSearch) {
        this.dom.filterPlayerSearch.addEventListener('input', () => this.renderPlayersTable());
      }
      if (this.dom.filterPlayerRole) {
        this.dom.filterPlayerRole.addEventListener('change', () => this.renderPlayersTable());
      }
      if (this.dom.filterPlayerSort) {
        this.dom.filterPlayerSort.addEventListener('change', () => this.renderPlayersTable());
      }

      // Filtros de logs
      if (this.dom.filterLogSearch) {
        this.dom.filterLogSearch.addEventListener('input', () => this.renderLogsTable());
      }
      if (this.dom.filterLogAction) {
        this.dom.filterLogAction.addEventListener('change', () => this.renderLogsTable());
      }

      // Modal: Alterar saldo
      if (this.dom.balInputTypeAdd) {
        this.dom.balInputTypeAdd.addEventListener('change', () => this.updateBalancePreview());
      }
      if (this.dom.balInputTypeSet) {
        this.dom.balInputTypeSet.addEventListener('change', () => this.updateBalancePreview());
      }
      if (this.dom.balInputAmount) {
        this.dom.balInputAmount.addEventListener('input', () => this.updateBalancePreview());
      }
      if (this.dom.btnConfirmBalance) {
        this.dom.btnConfirmBalance.addEventListener('click', () => this.handleBalanceChange());
      }

      // Quick chips
      this.dom.quickChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const val = chip.getAttribute('data-val');
          if (val && this.dom.balInputAmount) {
            this.dom.balInputAmount.value = val;
            this.updateBalancePreview();
          }
        });
      });

      // Modal: Banir
      if (this.dom.btnConfirmBan) {
        this.dom.btnConfirmBan.addEventListener('click', () => this.handleBan());
      }

      // Modal: Desbanir
      if (this.dom.btnConfirmUnban) {
        this.dom.btnConfirmUnban.addEventListener('click', () => this.handleUnban());
      }

      // Modal: Deletar
      if (this.dom.delInputConfirm) {
        this.dom.delInputConfirm.addEventListener('input', () => {
          if (this.dom.btnConfirmDelete) {
            this.dom.btnConfirmDelete.disabled = !this.dom.delInputConfirm.value.trim();
          }
        });
      }
      if (this.dom.btnConfirmDelete) {
        this.dom.btnConfirmDelete.addEventListener('click', () => this.handleDelete());
      }

      // Modal: Promover admin
      if (this.dom.btnOpenPromoteModal) {
        this.dom.btnOpenPromoteModal.addEventListener('click', () => this.openPromoteModal());
      }
      if (this.dom.btnConfirmPromote) {
        this.dom.btnConfirmPromote.addEventListener('click', () => this.handlePromote());
      }

      // Modal: Rebaixar admin
      if (this.dom.btnConfirmDemote) {
        this.dom.btnConfirmDemote.addEventListener('click', () => this.handleDemote());
      }

      // Fechar modais
      this.dom.modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const modalId = btn.getAttribute('data-close');
          const modal = document.getElementById(modalId);
          if (modal) modal.classList.add('hidden');
        });
      });

      // Fechar modais clicando fora
      document.querySelectorAll('.admin-modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) overlay.classList.add('hidden');
        });
      });
    }

    switchTab(tabId) {
      this.currentTab = tabId;

      // Atualiza botões
      this.dom.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
      });

      // Atualiza conteúdo
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
      });

      // Carrega dados da aba
      if (tabId === 'tab-dashboard') this.loadDashboard();
      else if (tabId === 'tab-players') this.loadPlayers();
      else if (tabId === 'tab-admins') this.loadAdmins();
      else if (tabId === 'tab-logs') this.loadLogs();
    }

    // =========================================================================
    // DASHBOARD
    // =========================================================================

    async loadDashboard() {
      try {
        const res = await fetch('/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            this.showAccessDenied();
            return;
          }
          return;
        }

        const data = await res.json();
        if (!data.success || !data.stats) return;

        const stats = data.stats;

        if (this.dom.statTotalUsers) this.dom.statTotalUsers.textContent = stats.totalUsers;
        if (this.dom.statTotalBalance) this.dom.statTotalBalance.textContent = stats.totalBalance.toLocaleString('pt-BR');
        if (this.dom.statTotalSpins) this.dom.statTotalSpins.textContent = stats.totalSpins.toLocaleString('pt-BR');
        if (this.dom.statTotalBanned) this.dom.statTotalBanned.textContent = stats.totalBanned;
        if (this.dom.statTotalAdmins) this.dom.statTotalAdmins.textContent = stats.totalAdmins;
        if (this.dom.statStorageMode) {
          this.dom.statStorageMode.textContent = stats.cloudMode ? 'Vercel KV (Cloud)' : 'Local JSON';
        }
      } catch (e) {
        console.error('Erro ao carregar dashboard:', e);
      }
    }

    // =========================================================================
    // JOGADORES
    // =========================================================================

    async loadPlayers() {
      try {
        const res = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            this.showAccessDenied();
            return;
          }
          return;
        }

        const data = await res.json();
        if (!data.success) return;

        this.allUsers = data.users || [];
        this.renderPlayersTable();
      } catch (e) {
        console.error('Erro ao carregar jogadores:', e);
      }
    }

    renderPlayersTable() {
      if (!this.dom.playersTableBody) return;

      const search = (this.dom.filterPlayerSearch?.value || '').toLowerCase();
      const roleFilter = this.dom.filterPlayerRole?.value || 'all';
      const sortBy = this.dom.filterPlayerSort?.value || 'balance_desc';

      let users = [...this.allUsers];

      // Filtro de busca
      if (search) {
        users = users.filter(u =>
          (u.username && u.username.toLowerCase().includes(search)) ||
          (u.displayName && u.displayName.toLowerCase().includes(search)) ||
          (u.email && u.email.toLowerCase().includes(search)) ||
          (u.id && u.id.toLowerCase().includes(search))
        );
      }

      // Filtro de role
      if (roleFilter !== 'all') {
        users = users.filter(u => u.role === roleFilter);
      }

      // Ordenação
      switch (sortBy) {
        case 'balance_asc':
          users.sort((a, b) => (a.balance || 0) - (b.balance || 0));
          break;
        case 'date_desc':
          users.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          break;
        case 'name_asc':
          users.sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username));
          break;
        default:
          users.sort((a, b) => (b.balance || 0) - (a.balance || 0));
      }

      if (users.length === 0) {
        this.dom.playersTableBody.innerHTML = `
          <tr>
            <td colspan="8" class="td-loading">Nenhum jogador encontrado.</td>
          </tr>
        `;
        return;
      }

      this.dom.playersTableBody.innerHTML = users.map(u => {
        const isFounder = u.role === 'founder';
        const isBanned = u.isBanned || u.role === 'banned';
        const roleClass = isFounder ? 'founder' : (u.role === 'admin' ? 'admin' : 'user');
        const roleLabel = isFounder ? 'FOUNDER' : (u.role === 'admin' ? 'Admin' : (isBanned ? 'Banido' : 'Usuário'));
        const statusClass = isBanned ? 'banned' : 'active';
        const statusLabel = isBanned ? 'Banido' : 'Ativo';
        const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-';

        // Ações
        let actions = '';
        if (isFounder) {
          actions = `<span class="protected-tag">🛡 PROTEGIDO</span>`;
        } else {
          actions = `
            <div class="action-buttons-cell">
              <button class="btn-row-action btn-bal" data-action="balance" data-id="${this.escapeHtml(u.id)}" data-name="${this.escapeHtml(u.displayName || u.username)}">🪙 Saldo</button>
              ${isBanned
                ? `<button class="btn-row-action btn-unban" data-action="unban" data-id="${this.escapeHtml(u.id)}" data-name="${this.escapeHtml(u.displayName || u.username)}">✅ Desbanir</button>`
                : `<button class="btn-row-action btn-ban" data-action="ban" data-id="${this.escapeHtml(u.id)}" data-name="${this.escapeHtml(u.displayName || u.username)}">🚫 Banir</button>`
              }
              <button class="btn-row-action btn-del" data-action="delete" data-id="${this.escapeHtml(u.id)}" data-name="${this.escapeHtml(u.displayName || u.username)}" data-username="${this.escapeHtml(u.username)}">🗑 Remover</button>
            </div>
          `;
        }

        actions += `<button class="btn-row-action" data-action="view" data-id="${this.escapeHtml(u.id)}">Ver</button>`;
        return `
          <tr>
            <td>
              <div class="user-cell">
                <span class="user-avatar">${/^(https?:|data:image\/)/.test(u.avatar || '') ? '👤' : this.escapeHtml(u.avatar || '⚡')}</span>
                <div class="user-meta">
                  <span class="user-display-name">${this.escapeHtml(u.displayName || u.username)}</span>
                  <span class="user-username">@${this.escapeHtml(u.username)}</span>
                </div>
              </div>
            </td>
            <td>${this.escapeHtml(u.email || '-')}</td>
            <td><span class="balance-val">${(u.balance || 0).toLocaleString('pt-BR')}</span></td>
            <td>${(u.highestWin || 0).toLocaleString('pt-BR')}</td>
            <td><span class="badge-role-tag ${roleClass}">${roleLabel}</span></td>
            <td><span class="badge-status-tag ${statusClass}"><span class="badge-dot"></span>${statusLabel}</span></td>
            <td>${dateStr}</td>
            <td>${actions}</td>
          </tr>
        `;
      }).join('');

      // Bind action buttons
      this.dom.playersTableBody.querySelectorAll('.btn-row-action').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action');
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          const username = btn.getAttribute('data-username');

          if (action === 'view') this.viewPlayer(id);
          else if (action === 'balance') this.openBalanceModal(id, name);
          else if (action === 'ban') this.openBanModal(id, name);
          else if (action === 'unban') this.openUnbanModal(id, name);
          else if (action === 'delete') this.openDeleteModal(id, name, username);
        });
      });
    }

    // =========================================================================
    // MODAL: ALTERAR SALDO
    // =========================================================================

    viewPlayer(id) {
      const user = this.allUsers.find(u => u.id === id);
      if (!user) return;
      const dialog = document.createElement('dialog');
      dialog.className = 'player-details-dialog';
      const title = document.createElement('h2');
      title.textContent = user.displayName || user.username;
      const details = document.createElement('pre');
      details.textContent = `ID: ${user.id}\nUsername: ${user.username}\nEmail: ${user.email || '-'}\nSaldo: ${user.balance.toLocaleString('pt-BR')}\nRole: ${user.role}\nStatus: ${user.isBanned ? 'Banido' : 'Ativo'}\nMotivo: ${user.banReason || '-'}\nCadastro: ${new Date(user.createdAt).toLocaleString('pt-BR')}`;
      const close = document.createElement('button');
      close.className = 'btn-row-action';
      close.textContent = 'Fechar';
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => dialog.remove());
      dialog.append(title, details, close);
      document.body.append(dialog);
      dialog.showModal();
    }

    openBalanceModal(userId, userName) {
      const user = this.allUsers.find(u => u.id === userId);
      if (!user) return;

      this._balanceTargetId = userId;

      if (this.dom.balModalAvatar) {
        const av = user.avatar || '👤';
        this.dom.balModalAvatar.textContent = /^(https?:|data:image\/)/.test(av) ? '👤' : av;
      }
      if (this.dom.balModalName) this.dom.balModalName.textContent = user.displayName || user.username;
      if (this.dom.balModalSub) this.dom.balModalSub.textContent = `@${user.username} • ${user.email || 'sem email'}`;
      if (this.dom.balModalCurrent) this.dom.balModalCurrent.textContent = (user.balance || 0).toLocaleString('pt-BR');
      if (this.dom.balInputAmount) this.dom.balInputAmount.value = '1000';
      if (this.dom.balInputReason) this.dom.balInputReason.value = '';
      if (this.dom.balInputTypeAdd) this.dom.balInputTypeAdd.checked = true;

      this.updateBalancePreview();

      if (this.dom.modalChangeBalance) this.dom.modalChangeBalance.classList.remove('hidden');
    }

    updateBalancePreview() {
      const user = this.allUsers.find(u => u.id === this._balanceTargetId);
      if (!user) return;

      const currentBalance = user.balance || 0;
      const amount = parseInt(this.dom.balInputAmount?.value, 10) || 0;
      const isAdd = this.dom.balInputTypeAdd?.checked;

      const newBalance = isAdd ? currentBalance + amount : amount;
      const diff = newBalance - currentBalance;

      if (this.dom.balPreviewNew) {
        this.dom.balPreviewNew.textContent = `${newBalance.toLocaleString('pt-BR')} moedas`;
      }
      if (this.dom.balPreviewDiff) {
        const sign = diff >= 0 ? '+' : '';
        this.dom.balPreviewDiff.textContent = `${sign}${diff.toLocaleString('pt-BR')} moedas`;
        this.dom.balPreviewDiff.className = 'preview-diff' + (diff < 0 ? ' negative' : '');
      }
      if (this.dom.balLabelAmount) {
        this.dom.balLabelAmount.textContent = isAdd ? 'Valor a Adicionar:' : 'Novo Saldo:';
      }
    }

    async handleBalanceChange() {
      const user = this.allUsers.find(u => u.id === this._balanceTargetId);
      if (!user) return;

      const amount = Number(this.dom.balInputAmount?.value);
      const reason = (this.dom.balInputReason?.value || '').trim();
      const mode = this.dom.balInputTypeSet?.checked ? 'set' : 'add';

      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100000000) {
        this.showToast('Informe um valor válido.', 'error');
        return;
      }
      if (!reason || reason.length < 3) {
        this.showToast('Informe um motivo (mínimo 3 caracteres).', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/users/balance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({ targetId: this._balanceTargetId, mode, amount, reason, expectedBalance: user.balance })
        });

        const data = await res.json();

        if (!res.ok) {
          this.showToast(data.error || 'Erro ao alterar saldo.', 'error');
          return;
        }

        // Atualiza dados locais
        const updatedUser = data.user;
        const idx = this.allUsers.findIndex(u => u.id === updatedUser.id);
        if (idx !== -1) this.allUsers[idx] = updatedUser;

        this.closeModal('modal-change-balance');
        this.showToast(`✅ Saldo de ${updatedUser.displayName || updatedUser.username} alterado com sucesso!`);
        this.renderPlayersTable();
      } catch (e) {
        this.showToast('Erro de comunicação ao alterar saldo.', 'error');
      }
    }

    // =========================================================================
    // MODAL: BANIR
    // =========================================================================

    openBanModal(userId, userName) {
      this._banTargetId = userId;
      if (this.dom.banModalUsername) this.dom.banModalUsername.textContent = userName;
      if (this.dom.banInputReason) this.dom.banInputReason.value = '';
      if (this.dom.modalBanUser) this.dom.modalBanUser.classList.remove('hidden');
    }

    async handleBan() {
      const reason = (this.dom.banInputReason?.value || '').trim();

      if (!reason || reason.length < 3) {
        this.showToast('Informe o motivo do banimento (mínimo 3 caracteres).', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/users/ban', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({ targetId: this._banTargetId, reason })
        });

        const data = await res.json();

        if (!res.ok) {
          this.showToast(data.error || 'Erro ao banir jogador.', 'error');
          return;
        }

        // Atualiza dados locais
        const updatedUser = data.user;
        const idx = this.allUsers.findIndex(u => u.id === updatedUser.id);
        if (idx !== -1) this.allUsers[idx] = updatedUser;

        this.closeModal('modal-ban-user');
        this.showToast(`🚫 ${updatedUser.displayName || updatedUser.username} foi banido.`);
        this.renderPlayersTable();
      } catch (e) {
        this.showToast('Erro de comunicação ao banir jogador.', 'error');
      }
    }

    // =========================================================================
    // MODAL: DESBANIR
    // =========================================================================

    openUnbanModal(userId, userName) {
      this._unbanTargetId = userId;
      if (this.dom.unbanModalUsername) this.dom.unbanModalUsername.textContent = userName;
      if (this.dom.unbanInputReason) this.dom.unbanInputReason.value = '';
      if (this.dom.modalUnbanUser) this.dom.modalUnbanUser.classList.remove('hidden');
    }

    async handleUnban() {
      const reason = (this.dom.unbanInputReason?.value || '').trim();

      if (!reason || reason.length < 3) {
        this.showToast('Informe o motivo do desbanimento (mínimo 3 caracteres).', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/users/unban', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({ targetId: this._unbanTargetId, reason })
        });

        const data = await res.json();

        if (!res.ok) {
          this.showToast(data.error || 'Erro ao desbanir jogador.', 'error');
          return;
        }

        // Atualiza dados locais
        const updatedUser = data.user;
        const idx = this.allUsers.findIndex(u => u.id === updatedUser.id);
        if (idx !== -1) this.allUsers[idx] = updatedUser;

        this.closeModal('modal-unban-user');
        this.showToast(`✅ ${updatedUser.displayName || updatedUser.username} foi desbanido.`);
        this.renderPlayersTable();
      } catch (e) {
        this.showToast('Erro de comunicação ao desbanir jogador.', 'error');
      }
    }

    // =========================================================================
    // MODAL: DELETAR CONTA
    // =========================================================================

    openDeleteModal(userId, userName, username) {
      this._deleteTargetId = userId;
      this._deleteUsername = username;

      if (this.dom.delModalTargetUser) this.dom.delModalTargetUser.textContent = userName;
      if (this.dom.delModalConfirmTarget) this.dom.delModalConfirmTarget.textContent = username;
      if (this.dom.delInputConfirm) this.dom.delInputConfirm.value = '';
      if (this.dom.delInputReason) this.dom.delInputReason.value = '';
      if (this.dom.btnConfirmDelete) this.dom.btnConfirmDelete.disabled = true;

      if (this.dom.modalDeleteUser) this.dom.modalDeleteUser.classList.remove('hidden');
    }

    async handleDelete() {
      const confirmUsername = (this.dom.delInputConfirm?.value || '').trim();
      const reason = (this.dom.delInputReason?.value || '').trim();

      if (confirmUsername.toLowerCase() !== this._deleteUsername.toLowerCase()) {
        this.showToast('Username de confirmação incorreto.', 'error');
        return;
      }
      if (!reason || reason.length < 3) {
        this.showToast('Informe o motivo da exclusão (mínimo 3 caracteres).', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/users/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({
            targetId: this._deleteTargetId,
            confirmUsername: confirmUsername,
            reason: reason
          })
        });

        const data = await res.json();

        if (!res.ok) {
          this.showToast(data.error || 'Erro ao remover conta.', 'error');
          return;
        }

        // Remove da lista local
        this.allUsers = this.allUsers.filter(u => u.id !== this._deleteTargetId);

        this.closeModal('modal-delete-user');
        this.showToast('🗑 Conta removida permanentemente.');
        this.renderPlayersTable();
      } catch (e) {
        this.showToast('Erro de comunicação ao remover conta.', 'error');
      }
    }

    // =========================================================================
    // ADMINISTRADORES (FOUNDER ONLY)
    // =========================================================================

    async loadAdmins() {
      // A lista de admins já vem carregada em allUsers
      this.renderAdminsTable();
    }

    renderAdminsTable() {
      if (!this.dom.adminsTableBody) return;

      const admins = this.allUsers.filter(u => u.role === 'admin' || u.role === 'founder');

      if (admins.length === 0) {
        this.dom.adminsTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="td-loading">Nenhum administrador encontrado.</td>
          </tr>
        `;
        return;
      }

      this.dom.adminsTableBody.innerHTML = admins.map(u => {
        const isFounder = u.role === 'founder';
        const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-';

        let actions = '';
        if (isFounder) {
          actions = `<span class="protected-tag">🛡 FUNDADOR</span>`;
        } else {
          actions = `
            <div class="action-buttons-cell">
              <button class="btn-row-action btn-demote" data-action="demote" data-id="${this.escapeHtml(u.id)}" data-name="${this.escapeHtml(u.displayName || u.username)}">⬇ Rebaixar</button>
            </div>
          `;
        }

        return `
          <tr>
            <td>
              <div class="user-cell">
                <span class="user-avatar">${/^(https?:|data:image\/)/.test(u.avatar || '') ? '👤' : this.escapeHtml(u.avatar || '👤')}</span>
                <div class="user-meta">
                  <span class="user-display-name">${this.escapeHtml(u.displayName || u.username)}</span>
                  <span class="user-username">@${this.escapeHtml(u.username)}</span>
                </div>
              </div>
            </td>
            <td>${this.escapeHtml(u.email || '-')}</td>
            <td><span class="badge-role-tag ${isFounder ? 'founder' : 'admin'}">${isFounder ? 'FOUNDER' : 'Admin'}</span></td>
            <td><span class="balance-val">${(u.balance || 0).toLocaleString('pt-BR')}</span></td>
            <td>${dateStr}</td>
            <td>${actions}</td>
          </tr>
        `;
      }).join('');

      // Bind demote buttons
      this.dom.adminsTableBody.querySelectorAll('.btn-row-action').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action');
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          if (action === 'demote') this.openDemoteModal(id, name);
        });
      });
    }

    // =========================================================================
    // MODAL: PROMOVER ADMIN
    // =========================================================================

    openPromoteModal() {
      // Preenche select com usuários que não são admin/founder/banned
      const eligible = this.allUsers.filter(u =>
        u.role !== 'admin' && u.role !== 'founder' && !u.isBanned && u.role !== 'banned'
      );

      if (this.dom.promoteSelectUser) {
        if (eligible.length === 0) {
          this.dom.promoteSelectUser.innerHTML = '<option value="">Nenhum usuário elegível</option>';
        } else {
          this.dom.promoteSelectUser.innerHTML =
            '<option value="">Selecione um jogador...</option>' +
            eligible.map(u => `<option value="${this.escapeHtml(u.id)}">${this.escapeHtml(u.displayName || u.username)} (@${this.escapeHtml(u.username)})</option>`).join('');
        }
      }

      if (this.dom.promoteInputReason) this.dom.promoteInputReason.value = '';
      if (this.dom.modalPromoteAdmin) this.dom.modalPromoteAdmin.classList.remove('hidden');
    }

    async handlePromote() {
      const targetId = this.dom.promoteSelectUser?.value;
      const reason = (this.dom.promoteInputReason?.value || '').trim();

      if (!targetId) {
        this.showToast('Selecione um jogador para promover.', 'error');
        return;
      }
      if (!reason || reason.length < 3) {
        this.showToast('Informe o motivo da promoção (mínimo 3 caracteres).', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/admins/promote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({ targetId, reason })
        });

        const data = await res.json();

        if (!res.ok) {
          this.showToast(data.error || 'Erro ao promover administrador.', 'error');
          return;
        }

        // Atualiza dados locais
        const updatedUser = data.user;
        const idx = this.allUsers.findIndex(u => u.id === updatedUser.id);
        if (idx !== -1) this.allUsers[idx] = updatedUser;

        this.closeModal('modal-promote-admin');
        this.showToast(`⚡ ${updatedUser.displayName || updatedUser.username} agora é Administrador!`);
        this.renderAdminsTable();
      } catch (e) {
        this.showToast('Erro de comunicação ao promover administrador.', 'error');
      }
    }

    // =========================================================================
    // MODAL: REBAIXAR ADMIN
    // =========================================================================

    openDemoteModal(userId, userName) {
      this._demoteTargetId = userId;
      if (this.dom.demoteModalTarget) this.dom.demoteModalTarget.textContent = userName;
      if (this.dom.demoteInputReason) this.dom.demoteInputReason.value = '';
      if (this.dom.modalDemoteAdmin) this.dom.modalDemoteAdmin.classList.remove('hidden');
    }

    async handleDemote() {
      const reason = (this.dom.demoteInputReason?.value || '').trim();

      if (!reason || reason.length < 3) {
        this.showToast('Informe o motivo do rebaixamento (mínimo 3 caracteres).', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/admins/demote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify({ targetId: this._demoteTargetId, reason })
        });

        const data = await res.json();

        if (!res.ok) {
          this.showToast(data.error || 'Erro ao rebaixar administrador.', 'error');
          return;
        }

        // Atualiza dados locais
        const updatedUser = data.user;
        const idx = this.allUsers.findIndex(u => u.id === updatedUser.id);
        if (idx !== -1) this.allUsers[idx] = updatedUser;

        this.closeModal('modal-demote-admin');
        this.showToast(`⬇ ${updatedUser.displayName || updatedUser.username} foi rebaixado a usuário comum.`);
        this.renderAdminsTable();
      } catch (e) {
        this.showToast('Erro de comunicação ao rebaixar administrador.', 'error');
      }
    }

    // =========================================================================
    // LOGS DE AUDITORIA
    // =========================================================================

    async loadLogs(append = false) {
      const more = document.getElementById('btn-more-logs');
      if (more) more.disabled = true;
      try {
        const query = append && this.logsCursor ? `?before=${encodeURIComponent(this.logsCursor)}` : '';
        const res = await fetch('/api/admin/logs' + query, {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            this.showAccessDenied();
            return;
          }
          return;
        }

        const data = await res.json();
        if (!data.success) return;

        this.allLogs = append ? [...this.allLogs, ...(data.logs || [])] : (data.logs || []);
        this.logsCursor = data.nextCursor;
        more?.classList.toggle('hidden', !data.nextCursor);
        this.renderLogsTable();
      } catch (e) {
        console.error('Erro ao carregar logs:', e);
      } finally { if (more) more.disabled = false; }
    }

    renderLogsTable() {
      if (!this.dom.logsTableBody) return;

      const search = (this.dom.filterLogSearch?.value || '').toLowerCase();
      const actionFilter = this.dom.filterLogAction?.value || 'all';

      let logs = [...this.allLogs];

      // Filtro de busca
      if (search) {
        logs = logs.filter(l =>
          (l.motivo && l.motivo.toLowerCase().includes(search)) ||
          (l.targetUsername && l.targetUsername.toLowerCase().includes(search)) ||
          (l.adminUsername && l.adminUsername.toLowerCase().includes(search)) ||
          (l.adminEmail && l.adminEmail.toLowerCase().includes(search))
        );
      }

      // Filtro de ação
      if (actionFilter !== 'all') {
        const actionMap = {
          'ban': 'user_banned',
          'unban': 'user_unbanned',
          'delete_user': 'user_deleted',
          'admin_promote': 'admin_promoted',
          'admin_demote': 'admin_demoted'
        };
        const mappedAction = actionMap[actionFilter] || actionFilter;
        logs = logs.filter(l => l.action === mappedAction);
      }

      if (logs.length === 0) {
        this.dom.logsTableBody.innerHTML = `
          <tr>
            <td colspan="7" class="td-loading">Nenhum log encontrado.</td>
          </tr>
        `;
        return;
      }

      this.dom.logsTableBody.innerHTML = logs.map(log => {
        const actionLabels = {
          'balance_change': 'Alteração de Saldo',
          'user_banned': 'Banimento',
          'user_unbanned': 'Desbanimento',
          'user_deleted': 'Remoção de Conta',
          'admin_promoted': 'Promoção de Admin',
          'admin_demote': 'Rebaixamento de Admin'
        };
        const actionLabel = actionLabels[log.action] || log.action;

        const dateStr = log.timestamp
          ? new Date(log.timestamp).toLocaleString('pt-BR')
          : '-';

        let details = '';
        if (log.action === 'balance_change') {
          const sign = log.diferenca >= 0 ? '+' : '';
          details = `${(log.saldoAnterior || 0).toLocaleString('pt-BR')} → ${(log.saldoNovo || 0).toLocaleString('pt-BR')} (${sign}${(log.diferenca || 0).toLocaleString('pt-BR')})`;
        }

        return `
          <tr>
            <td>${dateStr}</td>
            <td><span class="log-action-tag ${log.action}">${actionLabel}</span></td>
            <td>${this.escapeHtml(log.adminUsername || log.adminEmail || '-')}</td>
            <td>${this.escapeHtml(log.targetUsername || '-')}</td>
            <td>${details}</td>
            <td class="log-reason-cell">${this.escapeHtml(log.motivo || '-')}</td>
            <td>${this.escapeHtml(log.ip || '-')}</td>
          </tr>
        `;
      }).join('');
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add('hidden');
    }

    showToast(message, type = 'success') {
      if (!this.dom.adminToast) return;

      this.dom.adminToast.textContent = message;
      this.dom.adminToast.className = `admin-toast ${type}`;
      this.dom.adminToast.classList.remove('hidden');

      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        this.dom.adminToast.classList.add('hidden');
      }, 4000);
    }

    escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = String(str);
      return div.innerHTML;
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

      storage.clearAuth();
      window.location.href = '/';
    }
  }

  // Inicializa o painel admin
  document.addEventListener('DOMContentLoaded', () => {
    const adminPanel = new AdminPanel();
    adminPanel.init();
  });

})();
