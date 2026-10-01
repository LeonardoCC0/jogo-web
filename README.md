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

### Administração e fundador

- `/admin`, `/admin/` e `/admin.html` passam pelo backend. O HTML do painel está em `server/admin.html`, fora dos arquivos públicos. As APIs revalidam sessão, ID, banimento e role no banco em cada chamada.
- A conta `47131@raphaeldisanto.com.br` encontrada neste banco foi identificada pelo ID `u_g_291e0b5f`, fixado em `server/founder.json`. No primeiro acesso ao backend, esse ID é persistido em `founderId`; sessões antigas dessa conta são revogadas e será necessário entrar novamente. Os demais dados são preservados.
- Se o banco de produção tiver outro ID para essa conta, configure `FOUNDER_USER_ID` **no servidor**, após conferir a identidade da conta. Essa configuração só inicializa um banco que ainda não tenha `founderId`; não permite trocar um fundador já estabelecido.
- Em banco novo, o primeiro login Google com o email fundador e domínio Workspace verificado (`hd=raphaeldisanto.com.br`) pode inicializar o fundador. Email digitado, role legada ou parâmetro enviado pelo navegador nunca concedem esse acesso. Para contas Google de domínio externo sem Workspace, use o ID conferido pelo operador. Essa distinção segue a [verificação de identidade do Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
- Somente founder promove/revoga admins. A conta fundadora não pode receber alterações administrativas de saldo, banimento, exclusão ou role, nem pelo próprio fundador. O apelido continua editável; ID e email não são editáveis pela API de perfil.
- Admins consultam seus próprios logs; founder consulta todos. Banimentos revogam sessões. Desbanir devolve a role `user`, exigindo nova promoção explícita quando necessário. Exclusão remove conta e sessões e preserva auditoria/histórico, sem foreign keys neste banco JSON.
- Sessões duram sete dias e o mesmo token alimenta um cookie `HttpOnly`, `SameSite=Strict`, usado na navegação ao painel. Na Vercel ele também é `Secure`; fora dela, use HTTPS e `COOKIE_SECURE=true` em produção.
- Rate limit compartilhado no banco: 120 chamadas por minuto por conta para administração e 30 por minuto para autenticação anônima por conexão. Não se confia em `X-Forwarded-For` enviado pelo cliente; atrás de proxy, o limite anônimo pode ser compartilhado. Configure também limites na infraestrutura conforme o volume.
- Saldos administrativos exigem inteiros, motivo, limite de 100.000.000 e confirmação. Alteração e auditoria são gravadas juntas. Um saldo que mudou desde a confirmação gera `409` para atualização da tela.

### Google, nome e foto

O botão Google aparece também na tela de entrar/criar conta. No primeiro login é oferecida a escolha de apelido; depois, clique no perfil para alterá-lo. A foto Google e o apelido são persistidos pelo servidor e compartilhados no ranking. Vincular Google a uma conta existente com o mesmo email exige estar autenticado nessa conta. Cadastre a origem real do site no cliente OAuth do Google; o client ID público já usado pelo projeto foi mantido.

### Persistência, publicação e testes

`npm run build` publica apenas `index.html`, `css/` e `js/` em `dist/`. A Vercel usa essa pasta e inclui o HTML protegido somente na função. Não publique a raiz do repositório como diretório estático.

Na Vercel, Redis é obrigatório (`KV_REST_API_URL`/`KV_REST_API_TOKEN` ou `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`). Falha de persistência retorna erro, sem fallback para banco vazio. Redis usa compare-and-swap para revalidar gravações concorrentes entre instâncias; o JSON local usa fila e substituição atômica e deve rodar em um único processo. O formato antigo do banco é lido sem apagar dados.

Execute `npm test` para testes de segurança, fluxo do jogo, Google simulado e acesso HTTP. Eles usam arquivos temporários, assertions reais e código de saída de falha; nunca apagam o banco do jogo. A autenticação Google real e o deploy exigem validação no ambiente com OAuth e Redis configurados.

- **Sem Recarga de Moedas:** Ao contrário de jogos de teste que concedem recargas infinitas, aqui cada jogador tem uma quantidade inicial estrita e o objetivo é construir o maior saldo possível.
- **Autenticação Real:** Senhas protegidas no backend com hash criptográfico `scrypt` com salt aleatório exclusivo.
- **RNG Autoritativo no Servidor:** As rodadas e prêmios são calculados no backend, impedindo trapaças ou alterações de saldo via DevTools.
- **Ranking 100% Real:** Apenas jogadores humanos que criaram conta e jogaram aparecem na tabela global, ordenados por saldo e recorde de maior vitória.
- **Aviso:** Moedas 100% virtuais para fins lúdicos de entretenimento. Não envolve dinheiro real.
