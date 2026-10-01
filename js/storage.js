/**
 * CYBER NEON SLOTS - Gerenciador de Persistência Blindado (localStorage + Assinatura Criptográfica)
 * Impede manipulação manual no DevTools através de validação de assinaturas com hash.
 */

(function(root) {
  'use strict';

  const STORAGE_KEYS = {
    BALANCE: 'cns_balance',
    BALANCE_SIG: 'cns_balance_sig',
    PLAYER_NAME: 'cns_player_name',
    PLAYER_AVATAR: 'cns_player_avatar',
    HIGHEST_WIN: 'cns_highest_win',
    HIGHEST_WIN_SIG: 'cns_highest_win_sig',
    SOUND_ENABLED: 'cns_sound_enabled',
    TURBO_ENABLED: 'cns_turbo_enabled',
    HISTORY: 'cns_history',
    HISTORY_SIG: 'cns_history_sig',
    LEADERBOARD: 'cns_leaderboard',
    LEADERBOARD_SIG: 'cns_leaderboard_sig',
    FIRST_VISIT_DONE: 'cns_first_visit_done',
    TOTAL_SPINS: 'cns_total_spins',
    TOTAL_WINS: 'cns_total_wins',
    TAMPER_ALERT: 'cns_tamper_flag',
    AUTH_TOKEN: 'cns_auth_token',
    USER_DATA: 'cns_user_data'
  };

  const sec = root.CNS_SECURITY;

  const storage = {
    // Saldo com verificação criptográfica
    getBalance() {
      const val = localStorage.getItem(STORAGE_KEYS.BALANCE);
      const sig = localStorage.getItem(STORAGE_KEYS.BALANCE_SIG);
      const initial = root.CONFIG ? root.CONFIG.INITIAL_BALANCE : 1000;

      if (val === null) {
        this.setBalance(initial);
        return initial;
      }

      // Validação da assinatura criptográfica
      if (sec && !sec.verifySyncSignature(val, sig)) {
        console.warn('⚠️ SEGURANÇA: Tentativa de adulteração detectada no saldo! Valor rejeitado.');
        localStorage.setItem(STORAGE_KEYS.TAMPER_ALERT, 'true');
        // Restaura saldo seguro padrão e re-assina
        this.setBalance(initial);
        return initial;
      }

      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? initial : Math.max(0, parsed);
    },

    setBalance(balance) {
      const cleanVal = Math.max(0, parseInt(balance, 10) || 0);
      const strVal = String(cleanVal);
      localStorage.setItem(STORAGE_KEYS.BALANCE, strVal);

      if (sec) {
        const sig = sec.computeSyncSignature(strVal);
        localStorage.setItem(STORAGE_KEYS.BALANCE_SIG, sig);
      }
    },

    // Perfil do Jogador com sanitização anti-XSS
    getPlayerName() {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || 'CyberPlayer';
      return sec ? sec.sanitizeInput(raw, 14) : raw.slice(0, 14);
    },

    setPlayerName(name) {
      const sanitized = sec ? sec.sanitizeInput(name || 'CyberPlayer', 14) : (name || 'CyberPlayer').trim().slice(0, 14);
      localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, sanitized || 'CyberPlayer');
      return sanitized || 'CyberPlayer';
    },

    getPlayerAvatar() {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYER_AVATAR) || '⚡';
      return sec ? sec.sanitizeInput(raw, 4) : raw.slice(0, 4);
    },

    setPlayerAvatar(avatar) {
      const cleanAvatar = sec ? sec.sanitizeInput(avatar || '⚡', 4) : '⚡';
      localStorage.setItem(STORAGE_KEYS.PLAYER_AVATAR, cleanAvatar || '⚡');
    },

    // Recorde com assinatura de integridade
    getHighestWin() {
      const val = localStorage.getItem(STORAGE_KEYS.HIGHEST_WIN);
      const sig = localStorage.getItem(STORAGE_KEYS.HIGHEST_WIN_SIG);

      if (val === null) return 0;

      if (sec && !sec.verifySyncSignature(val, sig)) {
        console.warn('⚠️ SEGURANÇA: Tentativa de adulteração detectada no recorde de vitória! Revertendo.');
        localStorage.setItem(STORAGE_KEYS.TAMPER_ALERT, 'true');
        this.setHighestWin(0);
        return 0;
      }

      return parseInt(val, 10) || 0;
    },

    setHighestWin(winAmount) {
      const cleanWin = Math.max(0, parseInt(winAmount, 10) || 0);
      const current = this.getHighestWin();
      if (cleanWin > current) {
        const strVal = String(cleanWin);
        localStorage.setItem(STORAGE_KEYS.HIGHEST_WIN, strVal);
        if (sec) {
          localStorage.setItem(STORAGE_KEYS.HIGHEST_WIN_SIG, sec.computeSyncSignature(strVal));
        }
        return true;
      }
      return false;
    },

    // Configurações
    getSoundEnabled() {
      const val = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
      return val !== null ? val === 'true' : true;
    },

    setSoundEnabled(enabled) {
      localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(!!enabled));
    },

    getTurboEnabled() {
      const val = localStorage.getItem(STORAGE_KEYS.TURBO_ENABLED);
      return val !== null ? val === 'true' : false;
    },

    setTurboEnabled(enabled) {
      localStorage.setItem(STORAGE_KEYS.TURBO_ENABLED, String(!!enabled));
    },

    // Histórico com assinatura
    getHistory() {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
        const sig = localStorage.getItem(STORAGE_KEYS.HISTORY_SIG);
        if (!data) return [];

        if (sec && !sec.verifySyncSignature(data, sig)) {
          console.warn('⚠️ SEGURANÇA: Histórico adulterado. Descartando registros corrompidos.');
          return [];
        }

        return JSON.parse(data);
      } catch (e) {
        return [];
      }
    },

    addHistoryEntry(entry) {
      const history = this.getHistory();
      history.unshift({
        id: Date.now(),
        isWin: !!entry.isWin,
        amount: parseInt(entry.amount, 10) || 0,
        multiplier: parseFloat(entry.multiplier) || 0,
        icons: sec ? sec.sanitizeInput(entry.icons, 20) : entry.icons,
        timestamp: entry.timestamp
      });
      if (history.length > 25) {
        history.pop();
      }
      const serialized = JSON.stringify(history);
      localStorage.setItem(STORAGE_KEYS.HISTORY, serialized);
      if (sec) {
        localStorage.setItem(STORAGE_KEYS.HISTORY_SIG, sec.computeSyncSignature(serialized));
      }
      return history;
    },

    clearHistory() {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.HISTORY_SIG);
    },

    // Leaderboard com assinatura
    getLeaderboard() {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
        const sig = localStorage.getItem(STORAGE_KEYS.LEADERBOARD_SIG);
        if (data && sec && sec.verifySyncSignature(data, sig)) {
          return JSON.parse(data);
        }
      } catch (e) {}

      const initialList = root.CONFIG ? root.CONFIG.INITIAL_LEADERBOARD : [];
      return JSON.parse(JSON.stringify(initialList));
    },

    saveLeaderboard(list) {
      const serialized = JSON.stringify(list);
      localStorage.setItem(STORAGE_KEYS.LEADERBOARD, serialized);
      if (sec) {
        localStorage.setItem(STORAGE_KEYS.LEADERBOARD_SIG, sec.computeSyncSignature(serialized));
      }
    },

    // Estatísticas
    getStats() {
      return {
        spins: parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_SPINS) || '0', 10),
        wins: parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_WINS) || '0', 10)
      };
    },

    recordSpin(isWin) {
      const stats = this.getStats();
      stats.spins += 1;
      if (isWin) stats.wins += 1;
      localStorage.setItem(STORAGE_KEYS.TOTAL_SPINS, String(stats.spins));
      localStorage.setItem(STORAGE_KEYS.TOTAL_WINS, String(stats.wins));
      return stats;
    },

    isFirstVisit() {
      return localStorage.getItem(STORAGE_KEYS.FIRST_VISIT_DONE) !== 'true';
    },

    setFirstVisitDone() {
      localStorage.setItem(STORAGE_KEYS.FIRST_VISIT_DONE, 'true');
    },

    hasTamperAlert() {
      const flag = localStorage.getItem(STORAGE_KEYS.TAMPER_ALERT) === 'true';
      if (flag) {
        localStorage.removeItem(STORAGE_KEYS.TAMPER_ALERT);
      }
      return flag;
    },

    getAuthToken() {
      return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || null;
    },

    setAuthToken(token) {
      if (token) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      }
    },

    clearAuth() {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    },

    getUserData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    setUserData(user) {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        if (user.balance !== undefined) this.setBalance(user.balance);
        if (user.displayName || user.username) this.setPlayerName(user.displayName || user.username);
        if (user.avatar) this.setPlayerAvatar(user.avatar);
        if (user.highestWin !== undefined) this.setHighestWin(user.highestWin);
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      }
    }
  };

  root.storage = storage;

})(typeof window !== 'undefined' ? window : this);
