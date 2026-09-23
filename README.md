# 🎰 CYBER NEON SLOTS - Jogo Web de Caça-Níquel Virtual

Um jogo moderno e imersivo de caça-níqueis em tela única desenvolvido com **HTML5, CSS3 Moderno e Vanilla JavaScript**. Utiliza exclusivamente **moedas virtuais sem valor monetário real**, com efeitos visuais neon, síntese de áudio em tempo real (Web Audio API), ranking global dinâmico e física realista de rolos mecânicos.

---

## 🎮 Como Jogar

1. **Abrir o Jogo:**
   - **Opção 1 (Direto pelo Navegador):** Basta dar um duplo clique no arquivo `index.html` em qualquer navegador (Chrome, Edge, Firefox, Safari). O jogo funciona 100% offline, sem necessidade de servidores ou instalações.
   - **Opção 2 (Servidor Local):** Se preferir executar via servidor local HTTP:
     ```bash
     npx serve .
     # ou
     python -m http.server 8000
     ```

2. **Primeiro Acesso:**
   - Na primeira visita, você receberá um **Bônus de Boas-Vindas de +1.000 moedas virtuais** e poderá escolher seu apelido e avatar neon para o Ranking Global.

3. **Girar os Rolos:**
   - Escolha o valor da sua aposta virtual (fichas rápidas de `10` a `500` moedas, ou ajuste fino pelos botões `+` e `-`).
   - Clique no grande botão neon **GIRAR** ou pressione a barra de **ESPAÇO** do seu teclado.
   - Recursos extras:
     - ⚡ **Modo TURBO:** Rolos com aceleração instantânea.
     - 🔄 **Modo AUTO:** Giros contínuos automáticos com pausa de segurança em caso de saldo zerado.
     - 🪙 **+ Recarga Grátis:** Clique a qualquer momento para abastecer +1.000 moedas virtuais de demonstração.

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

*O jogo opera com um motor RNG (Random Number Generator) ponderado, garantindo uma taxa de acerto de ~47% com alto dinamismo e retorno recreativo generoso de ~88%.*

---

## ✨ Recursos e Destaques

- **Interface Cyber Neon:** Fundo escuro com neons pulsantes, LEDs laterais, curvatura de cilindro 3D com sombras e linha de pagamento laser central.
- **Áudio Nativo (Web Audio API):** Síntese de áudio em tempo real (tique-taque mecânico de giro, impactos de parada de rolo, arpejos de vitória, fanfarra triunfal de Jackpot e tilintar de moedas).
- **Partículas & Confetes (Canvas HTML5):** Efeitos de celebração em alta performance para vitórias normais e grandes prêmios.
- **Ranking Global em Tempo Real:** O jogador sobe de posição dinamicamente na lista conforme acumula saldo e quebra recordes.
- **Histórico de Rodadas:** Exibe os últimos resultados com badges coloridos (verde para ganhos, vermelho para apostas).
- **Persistência Completa (localStorage):** Salva saldo, nome, avatar, recorde de maior vitória, configurações de som e histórico.
- **Design 100% Responsivo:** Otimizado para monitores ultrawide, notebooks, tablets e smartphones (com sistema de abas intuitivo em telas móveis).

---

> ⚠️ **Aviso de Isenção Recreativa:** Este projeto é um simulador de entretenimento com pontuação lúdica e moedas puramente virtuais. Não envolve dinheiro real, não permite apostas financeiras reais, transferências ou pagamentos.
