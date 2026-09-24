# 🎰 CYBER NEON SLOTS - Jogo Web de Caça-Níquel Virtual

Um jogo moderno e imersivo de caça-níqueis em tela única desenvolvido com **HTML5, CSS3 Moderno e Vanilla JavaScript**, integrado a um **Backend Seguro em Node.js** com sistema de **Autenticação, Persistência de Score, Bloqueio de Recarga e Ranking Real**, pronto para hospedagem gratuita na **Vercel** ou execução local.

---

## 🎮 Como Executar Localmente

1. **Iniciar o Servidor:**
   Na pasta do projeto, execute no terminal:
   ```bash
   npm start
   # ou
   node server/server.js
   ```

2. **Acessar o Jogo:**
   Abra seu navegador em:
   ```
   http://localhost:3000
   ```

3. **Cadastro e Saldo Inicial:**
   - Crie uma conta informando seu **Nome de Usuário**, **Senha** e escolhendo seu **Avatar Neon**.
   - Você receberá um saldo inicial de **1.000 moedas virtuais** concedido uma única vez ao cadastrar a conta.
   - **Sem recarga artificial:** Não há botão de recarga. Administre bem suas apostas para subir no ranking!

---

## 🚀 Como Hospedar Grátis na Vercel

O projeto já está estruturado e configurado para a Vercel com Serverless Functions (`api/index.js`) e roteamento (`vercel.json`).

### Passo a Passo:
1. **Envie o código para o GitHub:**
   Faça commit e envie seu repositório para o GitHub (`git push`).

2. **Conectar na Vercel:**
   - Acesse [vercel.com](https://vercel.com) e clique em **Add New... > Project**.
   - Importe seu repositório do GitHub.
   - O Framework Preset pode ser deixado como **Other**.
   - Clique em **Deploy**.

3. **Ativar Banco de Dados Gratuito (Vercel KV) para Persistência:**
   - Para que as contas, scores e ranking permaneçam salvos permanentemente na nuvem sem custo:
   - No painel do seu projeto na Vercel, clique na aba **Storage**.
   - Escolha **KV (Key-Value Database)** e clique em **Create Database** (Plano gratuito).
   - Conecte a base de dados ao seu projeto (Connect Project).
   - As variáveis de ambiente (`KV_REST_API_URL` e `KV_REST_API_TOKEN`) serão adicionadas automaticamente pela Vercel e o jogo passará a salvar todos os dados na nuvem instantaneamente!

---

## 🏆 Tabela de Multiplicadores e Prêmios

| Símbolo | Nome | 3 Iguais (Trinca) | 2 Iguais (Par) | Raridade |
| :---: | :--- | :---: | :---: | :---: |
| 🍒 | Cereja | **3x** | **1x** | Comum |
| 🍋 | Limão | **5x** | **1x** | Comum |
| 🍊 | Laranja | **8x** | **1.5x** | Incomum |
| 🔔 | Sino Dourado | **14x** | **2x** | Incomum |
| ⭐ | Estrela Neon | **25x** | **3x** | Raro |
| 💎 | Diamante Cyber | **50x** | **5x** | Super Raro |
| 7️⃣ | Lucky 7 | **100x** | **8x** | Épico |
| 👑 | Coroa Suprema | **300x** | **15x** | **JACKPOT** |

---

## 🔒 Segurança e Regras

- **Sem Recarga de Moedas:** Ao contrário de jogos de teste que concedem recargas infinitas, aqui cada jogador tem uma quantidade inicial estrita e o objetivo é construir o maior saldo possível.
- **Autenticação Real:** Senhas protegidas no backend com hash criptográfico `scrypt` com salt aleatório exclusivo.
- **RNG Autoritativo no Servidor:** As rodadas e prêmios são calculados no backend, impedindo trapaças ou alterações de saldo via DevTools.
- **Ranking 100% Real:** Apenas jogadores humanos que criaram conta e jogaram aparecem na tabela global, ordenados por saldo e recorde de maior vitória.
- **Aviso:** Moedas 100% virtuais para fins lúdicos de entretenimento. Não envolve dinheiro real.
