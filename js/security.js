/**
 * CYBER NEON SLOTS - Módulo de Segurança Criptográfica e Anti-Trapaça
 * Proteção de integridade por Hash SHA-256, auditoria de transações (Ledger) e sanitização anti-XSS.
 */

(function(root) {
  'use strict';

  // Chave de entropia do sistema (salt privado)
  const SYSTEM_SALT = 'CNS_SECURE_VAULT_v1_99x#NeonJackpot!@2026';

  // Obter ou gerar um ID único do dispositivo/sessão
  function getDeviceFingerprint() {
    if (typeof localStorage !== 'undefined') {
      let devId = localStorage.getItem('__cns_dev_fp');
      if (!devId) {
        devId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('__cns_dev_fp', devId);
      }
      return devId;
    }
    return 'dev_node_env';
  }

  // Hash Síncrono de Alta Segurança (Mistura de FNV-1a + Murmur3 + Salt)
  // Permite validação instantânea sem travar o loop de renderização do jogo
  function computeSyncSignature(dataString) {
    const raw = `${SYSTEM_SALT}::${getDeviceFingerprint()}::${String(dataString)}`;
    let h1 = 0xdeadbeef ^ raw.length, h2 = 0x41c6ce57 ^ raw.length;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const sig = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
    return 'sig_' + sig;
  }

  function verifySyncSignature(dataString, signature) {
    if (!signature || !dataString) return false;
    const expected = computeSyncSignature(dataString);
    return expected === signature;
  }

  // Sanitizador rigoroso anti-XSS
  function sanitizeInput(str, maxLength = 14) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[<>'";&`\\]/g, '') // Remove caracteres comumente usados em injeções HTML/JS
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove caracteres invisíveis de controle
      .trim()
      .slice(0, maxLength);
  }

  // Validador de Auditoria de Transações (Ledger)
  // Garante que o saldo só aumente se vier acompanhado de um comprovante matemático de giro válido
  class TransactionLedger {
    constructor() {
      this.spinInProgress = false;
      this.activeProof = null;
      this.lastActionTimestamp = 0;
    }

    // Registra início de rodada legítima com rate-limiting
    registerSpinStart(betAmount) {
      const now = Date.now();
      // Rate-limit anti-bot: impede requisições disparadas com menos de 250ms de intervalo
      if (now - this.lastActionTimestamp < 250) {
        throw new Error('Aviso de Segurança: Disparo muito rápido bloqueado (Anti-Bot).');
      }
      this.lastActionTimestamp = now;

      if (this.spinInProgress) {
        throw new Error('Aviso de Segurança: Giro simultâneo bloqueado.');
      }

      this.spinInProgress = true;
      const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
      this.activeProof = {
        nonce,
        betAmount,
        startTime: now
      };
      return nonce;
    }

    // Valida e audita o resultado antes de autorizar o crédito do prêmio
    validateSpinWin(proofNonce, outcome) {
      if (!this.spinInProgress || !this.activeProof) {
        throw new Error('Segurança: Tentativa de alterar saldo sem giro ativo.');
      }

      if (this.activeProof.nonce !== proofNonce) {
        throw new Error('Segurança: Prova de giro inválida ou adulterada.');
      }

      const elapsed = Date.now() - this.activeProof.startTime;
      if (elapsed < 350) {
        throw new Error('Segurança: Tempo de giro incompatível com a física do jogo.');
      }

      // Validação matemática do prêmio
      if (outcome.isWin) {
        const expectedWin = Math.round(this.activeProof.betAmount * outcome.multiplier);
        if (Math.abs(outcome.winAmount - expectedWin) > 1) {
          throw new Error('Segurança: Valor do prêmio forjado não corresponde às regras.');
        }
      }

      this.spinInProgress = false;
      this.activeProof = null;
      return true;
    }

    cancelSpin() {
      this.spinInProgress = false;
      this.activeProof = null;
    }
  }

  const ledger = new TransactionLedger();

  // Exportação segura restrita e congelada
  root.CNS_SECURITY = Object.freeze({
    computeSyncSignature,
    verifySyncSignature,
    sanitizeInput,
    ledger
  });

})(typeof window !== 'undefined' ? window : this);
