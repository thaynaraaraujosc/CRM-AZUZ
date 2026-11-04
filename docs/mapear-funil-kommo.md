# Prompt pra mapear a automação de funil do Kommo

Esta sessão do Claude roda na nuvem e **não alcança o Chrome da Thaynara**. Quem alcança é o
Claude da extensão, rodando no navegador dela. Este arquivo é o pedido pronto pra colar lá.

Foi assim que `docs/referencia-gaio.md` nasceu, e aquele mapeamento funcionou: as medidas vieram
certas e o módulo do Social Seller foi construído em cima delas sem chute.

---

## Como usar

1. Abrir o Kommo no Chrome, já logado, na tela **Leads → funil → Automatizar**
   (a que mostra a grade de gatilhos por etapa).
2. Abrir o Claude da extensão nessa aba.
3. Colar o texto entre as linhas abaixo.
4. Colar a resposta inteira de volta na sessão do CRM.

---

Você está olhando a tela de automação de funil do Kommo. Preciso de um mapeamento escrito, para
reconstruir a mesma coisa em outro CRM. Não resuma: meça e liste.

**1. A grade**
- Quantas colunas, e o que cada cabeçalho mostra (nome, cor, contagem, links, alças de arrastar).
- Largura da coluna, altura da linha, altura do cabeçalho, em pixels.
- O que aparece numa célula vazia, e o que aparece ao passar o mouse nela.
- Como se insere uma etapa nova, e como se reordena uma etapa existente.

**2. Cada cartão de gatilho**
- O texto exato da linha de cima (o "quando") e da linha de baixo (o "o que faz").
- Que botões aparecem no cartão, e quais só aparecem ao passar o mouse.
- Como a ordem entre dois gatilhos da mesma etapa é mostrada.
- Quando um gatilho vale para várias colunas, como isso é desenhado.

**3. A lista completa de GATILHOS ("quando")**
- Abra o "+" de uma célula e liste TODAS as opções, com o texto exato de cada uma.
- Para cada uma, que campos ela pede depois de escolhida.
- Marque quais são de entrada na etapa, quais são por evento e quais são por horário.

**4. A lista completa de AÇÕES ("o que faz")**
- Mesma coisa: todas as opções, texto exato, e os campos de configuração de cada uma.

**5. O painel da esquerda**
- Que seções existem (fontes de lead, pontuação, o que mais), e o que cada uma mostra.
- O que é recurso pago e aparece bloqueado.

**6. A barra de cima**
- Que controles existem, da esquerda pra direita, e o que cada um faz.
- Como a tela salva: botão explícito ou automático.

**7. Cores e tipografia**
- Os valores hexadecimais do azul de ação, do fundo da página, do cartão, da borda e do texto.
- A fonte e os tamanhos usados em cabeçalho de coluna, nome do gatilho e texto de apoio.

Responda em Markdown, com uma seção por item. Onde não conseguir medir, escreva "não verificado"
em vez de estimar — um número inventado vira decisão errada do outro lado.
