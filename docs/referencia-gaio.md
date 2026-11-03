# Referência de interface: o construtor de automações de Instagram que serve de modelo ao Social Seller

Mapeado em 03/11/2026 pela extensão do Chrome, na conta já logada, viewport 1414 × 904 px CSS.
Os valores de cor e medida foram lidos com `getComputedStyle` e das variáveis de `:root` — não são
estimativa, exceto onde está escrito "estimado". "não verificado" = não foi aberto ou confirmado.

Este arquivo é a FONTE das decisões visuais do módulo Social Seller. Quando uma medida daqui e o
código divergirem, o código está errado — foi isso que aconteceu na primeira versão, feita por
captura de tela, em que o azul ficou `#2563eb` em vez de `#0028FE` e o painel do bloco ficou com
380px em vez de 448px.

Logo, nome do produto e ilustrações da referência ficaram de fora de propósito: o que se copia aqui
é estrutura, medida, cor e texto de interface.

## 1. Fundamentos visuais

### Cores

| Papel | Hex |
|---|---|
| Primária / botão de ação | `#0028FE` |
| Hover do botão primário | `#0024D4` |
| Texto sobre primária | `#FAFAFA` |
| Fundo da página e do canvas | `#FAFAFA` |
| Fundo base / cartão / popover | `#FFFFFF` |
| Borda | `#E2E8F0` |
| Borda de input | `#EBEAF0` |
| Texto principal | `#1E293B` |
| Texto em cartão | `#020617` |
| Texto secundário | `#64748B` |
| Fundo suave / secundário | `#F1F5F9` |
| Texto sobre secundário | `#0F172A` |
| Accent | `#E2E8F0` |
| Sucesso / soft | `#16A34A` / `#E3F4E9` |
| Erro / texto / soft | `#EF4444` / `#DC2626` / `#FDE9E9` |
| Alerta e pendente / soft | `#EA580C` / `#FCEBE2` |
| Aviso / soft | `#CA8A04` / `#F9F1E1` |
| Informativo / soft | `#1641FF` / `#E3E8FF` |
| Submenu selecionado: fundo / texto / indicador | `#E7E8FF` / `#0020AD` / `#1641FF` |
| Superfície / texto | `#F9F8FD` / `#3D4051` |
| Input: fundo / texto / placeholder | `#FFFFFF` / `#3D4051` / `#888A99` |
| Anel de foco | `#0028FE`; neutro `#CBD5E1`; erro `#FCA5A5`; sucesso `#86EFAC` |

Escala da marca: 50 `#E7E8FF`, 100 `#B1B6FF`, 200 `#8B97FF`, 300 `#657BFF`, 400 `#3D60FF`,
500 `#1641FF`, 600 `#0028FE`, 700 `#0024D4`, 800 `#0020AD`, 900 `#021984`, 950 `#000622`.

Neutros: 50 `#FAFAFA`, 100 `#F1F5F9`, 200 `#E2E8F0`, 300 `#CBD5E1`, 400 `#94A3B8`, 500 `#64748B`,
600 `#475569`, 700 `#334155`, 800 `#1E293B`, 900 `#0F172A`, 950 `#020617`.

Menu lateral: gradiente vertical `#1641FF` → `#B1B6FF`, texto `#FAFAFA`, hover branco 15%, ativo
branco 20%, borda e anel branco 40%.

### Tipografia

Família em tudo: `Inter, sans-serif`. Corpo 16px/24px, peso 400.

| Uso | Tamanho / altura | Peso | Letter-spacing |
|---|---|---|---|
| Saudação (H1 da Geral) | 30px / 30px | 600 | -1px |
| Títulos de seção (H2) | 24px / 28,8px | 600 | -1px |
| Título do cabeçalho, H2 de gaveta, número de métrica | 20px / 25px | 600 | normal |
| Pergunta em gaveta, título de cartão em gradiente | 18px / 25,2px | 600 | não verificado |
| H2 de lista, título no editor, título do bloco | 16px / 24px | 600 | normal |
| Botão padrão | 14px / 20,3px | 500 | não verificado |
| Nome na linha da lista | 14px / 20px | 600 | não verificado |
| Rótulo secundário da linha | 14px / 20px | 500 | não verificado |
| Selo da linha | 12px / 16px | 600 | não verificado |
| Aba do bloco, "Próximo passo" | 12px / 15,6px | 500 | não verificado |
| Selo de recompensa | 10px / 15px | 500 | não verificado |

### Raios

Botão, cartão e input 8px; item de gatilho, bloco e cartão em gradiente 12px; modal e borda
esquerda do `main` 16px; selos e switch 9999px.

### Sombras

```css
--shadow-2xs: 0px 1px 0px 0px oklch(0% 0 0/.0509804);
--shadow-xs:  0px 1px 2px 0px oklch(0% 0 0/.0509804);
--shadow-sm:  0px 1px 3px 0px oklch(0% 0 0/.101961), 0px 1px 2px -1px oklch(0% 0 0/.101961);
--shadow-md:  0px 4px 6px -1px oklch(0% 0 0/.101961), 0px 2px 4px -2px oklch(0% 0 0/.101961);
--shadow-lg:  0px 10px 15px -3px oklch(0% 0 0/.101961), 0px 4px 6px -4px oklch(0% 0 0/.101961);
--shadow-xl:  0px 20px 25px -5px oklch(0% 0 0/.101961), 0px 8px 10px -6px oklch(0% 0 0/.101961);
--shadow-2xl: 0px 25px 50px -12px oklch(0% 0 0/.101961);
```

`xs` em inputs e seletores, `sm` em segmento ativo e cartões de gráfico, `lg` em gavetas e modais.

### Espaçamento e movimento

- Escala: 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 112, 128, 144px.
- Modal abre .25s, fecha .15s, escala .96. Dropdown .25s/.15s, escala .97. Gaveta .4s/.35s.
- Curva principal: `cubic-bezier(.22, 1, .36, 1)`.
- Z-index: sticky 10, fixed 30, overlay 50, backdrop 1000, popup 1010, floating 1100, tooltip 1200.

## 2. Estrutura global

- Menu lateral de 64px fixos, altura total, padding 12px, gap 48px, sobre o gradiente. Itens de
  40×40px: página inicial, Geral, Assistente (selo "Beta"), Automações, Leads, Comunidade, consumo
  de contatos (anel com %, 41×57px), divisor, ajuda, avatar 36×36px.
- Conteúdo (`main`) a partir de x=64, fundo `#FAFAFA`, raio `16px 0 0 16px`.
- Cabeçalho de 80px, fundo branco.
- Faixa de upgrade de 56px, fundo `#10172A` a 90%, texto `#E2E8F0`, padding 12px 16px, gap 12px,
  com botão de 79×32px, fundo `#F1F5F9`, texto `#0F172A`, raio 8px, padding 6px 12px.

## 3. Tela Geral

Margem lateral de 24px dentro do `main`.

1. Cabeçalho "Geral" e faixa de upgrade.
2. H1 "Olá, {nome}! Que bom ter você aqui.", com o nome na cor primária.
3. H2 "Resumo da sua conta" e "Métricas atualizadas em {data}". À direita, segmento
   Dia / Semana / Mês: fundo `#E2E8F0`, raio 8px, padding 3px; ativo com fundo branco e sombra `sm`.
4. Quatro cartões de métrica, largura flexível (311px neste viewport), altura 83px, gap 16px,
   borda 1px `#E2E8F0`, raio 8px, padding 16px: mensagens respondidas por automações; cliques em
   links das automações; economia de tempo com automações; novos contatos capturados.
5. Divisor e H2 "Seus próximos passos".
6. Duas colunas de 636px, gap 20px. À esquerda, cartão em gradiente, raio 12px, padding 24px,
   gap 24px, com trilha de missões e recompensas. À direita, cartão de upgrade.
7. H2 "Escolha um objetivo e comece em minutos", botão "Todas automações" e carrossel de cartões
   de 260×117px, padding 16px, gap 20px.
8. Barra com contagem de contatos, data de atualização, fuso horário e seletor de período.
9. H2 "Interações recebidas" e cinco cartões: Mensagens diretas, Comentários, Comentários em Lives,
   Respostas a Stories, Menções em Stories — cada um com ícone de informação e "De {n}".
10. Cartão "Número de interações relevantes classificadas por lista".
11. Dois cartões de 636px com sombra `sm`: "Interações diárias" e "Sentimento das interações".

## 4. Lista de automações

- Cabeçalho: voltar, H1 "Automações", botão "Criar automação" de 183×40px (primário, padding
  10px 24px, gap 8px) e botão de três pontos.
- Submenu de 288px fixos, fundo branco, padding 32px 24px, gap 24px, com botão de recolher. Título
  "Automações" e itens de 48px com gap 12px: Automações, Lista de respostas, Meus templates. Ativo
  com fundo `#E7E8FF` e indicador à esquerda.
- Conteúdo flexível, padding 32px 24px, gap 24px: busca "Buscar por automações" (320×40px, padding
  esquerdo 48px); filtros de 144×44px (Status, Gatilho, Palavra-chave); alternador lista/grade;
  checkbox "Buscar no conteúdo"; seção "Pastas" com contador e "Nova pasta"; seção "Automações" com
  contador e "Ordenar".
- Linha: altura 80px, borda 1px `#E2E8F0`, raio 8px, padding 15px, gap 16px entre linhas. Ícone de
  canal, nome, selos de gatilho (fundo `#F1F5F9`, 12px/600), colunas "Criado", "Última publicação",
  "Execuções", switch de 32×18px com rótulo, e menu de três pontos. A linha inteira abre o editor.

"Lista de respostas" e "Meus templates": não verificado. Conteúdo dos filtros, do menu da linha e
de "Ordenar": não verificado.

## 5. Templates

Rota de comunidade: cabeçalho "Templates", trilha "Comunidade > Templates", botão "Meus templates",
busca "Buscar templates...", "Salvos", "Filtros" e grade de cartões com miniatura, "Detalhes",
autor, nome, selo "Automações", instalações, recursos e botão "Instalar" ou "Usar template".
Medidas e a janela "Templates de automação": não verificado.

## 6. Editor de fluxo

### Barra de cima (80px, branca)

Voltar; nome da automação (16px/600, clicável); lápis; "Testar e publicar" de 144×36px, primário,
desabilitado sem gatilho com o tooltip "Configure o gatilho da automação para poder publicar."; e
"Mais ações" de 36×36px, cujo menu traz Configurações, Clonar automação, Histórico de versões,
Histórico de execuções e Excluir (vermelho).

Ao abrir um fluxo com gatilho aparece o popover "Teste sua automação antes de publicar", com o
botão "Entendi".

### Coluna de ferramentas (direita, botões de 40×40px)

1. Mostrar ou ocultar o assistente — cartão próprio, com gradiente.
2. Adicionar bloco — primário, abre o menu de blocos.
3. Aproximar.
4. Afastar.
5. Desfazer (Ctrl+Z), histórico de 20 passos.
6. Refazer (Ctrl+Y).
7. Organizar (função não verificada).
8. Métricas da automação — gaveta à direita.
9. Guia de boas práticas — modal.

Canto inferior direito: "Salvo em {data} às {hora}" (14px, `#64748B`) ou "Salvando alterações...".
O salvamento é automático. Com pendências aparece um cartão de alerta "{n} blocos com pendências"
e "Ver pendências", que abre o primeiro bloco com problema.

### Canvas

React Flow, fundo `#FAFAFA`, SEM grade e SEM pontos — não existe elemento de background.

### Anatomia do bloco

Bloco de gatilho (raiz), 326×152px:

- Cartão branco, raio 12px, padding `16px 16px 40px`, gap 24px, e
  `box-shadow: #64748B 0 0 0 1px inset` — anel interno, não borda.
- Título "O que inicia a automação" (16px/600).
- Botão "Adicionar gatilho": 294×48px, fundo `#F1F5F9`, raio 8px, padding 12px 32px.
- Rodapé "Próximo passo" (12px/500, `#64748B`) e ponto de saída de 10×10px (`#94A3B8`).
- Com gatilhos: linha "Instagram" acima do título e caixa "Gatilhos ativos" com a lista e selo "+{n}".

Bloco comum, 300px de largura e altura variável:

- Cabeçalho de 44px, raio `12px 12px 0 0`, padding 12px 16px, gap 12px.
- Miolo com raio `0 0 12px 12px`, padding `16px 16px 44px`, gap 12px, anel interno `#E2E8F0`.
- Conteúdo vazio: caixa de 268×92px, raio 8px, padding 20px, gap 8px, anel interno `#CBD5E1`.
- Rodapé "Próximo passo" com círculo de saída (bolinha de 10px `#CBD5E1` sobre base branca de 20px).
- Saídas nomeadas (Sucesso/Falha, Sim/Não, Opção n, Sem resposta) têm ponto próprio, linha curta e
  um "+" quadrado.
- Ponto de entrada à esquerda: 20×20px, fundo `#CBD5E1`, borda branca de 3px, sombra
  `rgba(0,0,0,.15) 0 0 3px 0`, centralizado no cabeçalho.

Abas de cima: 44px de altura, sobrepostas 12px ao cartão (32px visíveis), raio `8px 8px 0 0`,
padding `8px 12px 20px`, gap 8px, 12px/500, texto `#FAFAFA`.

| Aba | Fundo | Largura |
|---|---|---|
| Gatilho | `#64748B` | 88px |
| Selecionado | `#0028FE` | 95px |
| "{n} pendência(s) a resolver" | `#EA580C` | variável |

Estados: selecionado tem aba azul e `box-shadow: #0028FE 0 0 0 1px inset` NO CABEÇALHO; com
pendência, aba e contorno laranja. Linha de ligação `stroke #94A3B8`, 2px, contínua, em degraus com
cantos arredondados. Hover no bloco, hover na linha e seleção múltipla: não verificado.

### Gavetas e janelas

| Elemento | Tipo | Lado / medida |
|---|---|---|
| Gatilhos e configuração de bloco | Gaveta | Esquerda, 448px fixos, sombra `lg` |
| Assistente | Gaveta | Esquerda, ~480px (estimado) |
| Métricas | Gaveta | Direita, ~448px (estimado) |
| Configurar ação | Painel flutuante | Ao lado da gaveta, ~318px (estimado) |
| Menu de blocos | Popover | 250×430px, padding 10px, gap 12px |
| Como funciona cada gatilho | Modal | 512×814px, raio 16px, sombra `lg`, backdrop preto a 80% |
| Guia de boas práticas | Modal | ~640px (estimado), duas colunas |

Cabeçalho da gaveta: 69px, padding 16px, gap 16px, H2 20px/600.

## 7. Gatilhos

Gaveta "Gatilhos", pergunta "O que inicia essa automação?", link "Como funciona cada gatilho?",
botão "Opções avançadas" e rodapé com voltar e "Salvar" (vira "Continuar" ao marcar um gatilho).

Item: label de 403×48px, borda 1px, raio 12px, padding 12px 16px, gap 12px, checkbox de 20×20px com
raio 6px. Marcado: fundo cinza claro e checkbox azul.

### Seção principal

| Nome | Descrição |
|---|---|
| Comentário no Feed ou Reels | Comentam no seu post ou Reels → a automação chama a pessoa no Direct. |
| Resposta nos stories | Respondem a um story seu → a automação continua a conversa no Direct. |
| Mensagem recebida | Te mandam mensagem no Direct → a automação responde na hora. |
| Comentário em Live | Comentam na sua live → a automação chama a pessoa no Direct. |
| Menção nos stories | Marcam você em um story → a automação responde no Direct. |

### Seção "Avançado"

| Nome | Descrição |
|---|---|
| Disparo manual | Crie a automação e envie quando quiser: em massa pela aba Contatos ou para um contato pelo Livechat. |
| Mensagem enviada | Você ou seu time envia uma mensagem → a automação começa na hora. |

Rodapé do modal: "Em todos os casos, depois disso a conversa segue os passos da sua automação."

### Assistente de configuração (verificado só em "Comentário no Feed ou Reels")

- Etapa 1 de 3, "Palavras-chave": "Quais palavras ou frases ativam a automação?" /
  "As palavras-chave valem para todos os gatilhos desta automação." Seleção, padrão "Qualquer
  palavra-chave"; opções: Qualquer palavra-chave; Palavra ou frase exata; A mensagem contém a
  palavra; A palavra aparece no começo.
- Etapa 2 de 3, "Comentário em Posts ou Reels": "Em quais Posts ou Reels a automação deve
  funcionar?" Rádio sem padrão: Post específico; Qualquer post; Meu próximo post. "Continuar"
  desabilitado até escolher.
- Etapa 3 de 3, "Resposta automática": "Responda quem comentar no seu feed", botão "Pular". Texto
  com placeholder "Escreva sua primeira resposta", máximo 128; "Adicionar outra resposta"; "Gerar
  respostas com IA" (desabilitado: "Escreva 1 resposta para a IA aprender seu tom."); "Salvar".

## 8. Blocos do menu "+"

Menu com busca "Buscar"; sem resultado, "Nenhum bloco encontrado". Só "Mensagem" tem descrição. Os
ícones são da biblioteca Lucide, exceto o de Mensagem, que é o ícone do Instagram.

| Grupo | Nome | Descrição | Ícone |
|---|---|---|---|
| principal | Mensagem | Texto, vídeo, galeria, botões e outros. | Instagram |
| principal | Adicionar ou remover etiquetas | — | `tag` |
| principal | Aguardar | — | `clock-8` |
| principal | Condicional | — | `workflow` |
| principal | Distribuir | — | `shuffle` |
| Avançado | Iniciar automação | — | `circle-play` |
| Avançado | Pausar automações | — | `circle-pause` |
| Avançado | Matemática | — | `calculator` |
| Avançado | Campo personalizado | — | `variable` |
| Avançado | Requisição HTTP | — | `globe` |
| Avançado | Google Sheets | — | `sheet` |
| Avançado | Código (selo "Beta") | — | `braces` |
| rodapé | Peça à IA | — | `sparkles` |

"Peça à IA" não é bloco: abre a gaveta do assistente. O grupo Avançado fica recolhido atrás de uma
seta. Bloco novo entra já ligado ao anterior.

### Mensagem

Título "Mensagem #{n}". Tela inicial "Escolha um bloco para começar":

| Conteúdo | Descrição | Campos |
|---|---|---|
| Mensagem | Texto e botões de ação | Área de texto "Digite sua mensagem...", máx. 959; "Adicionar botão" |
| Pergunta | — | Área de texto "Insira uma pergunta...", máx. 959; "Salvar resposta em"; "Esperar a resposta por" |
| Cartões | — | "Enviar imagem" (png, jpeg, gif · 8 MB max); "Título do cartão" (máx. 80); "Descrição do cartão" (máx. 80); "Adicionar botão"; "+" para outro cartão |
| Aguardar | — | Número (padrão 1) e unidade (padrão segundos) |
| Áudio | — | "Carregar ou arraste áudio" (aac, m4a, wav · 24 MB max) |
| Imagem | — | "Enviar imagem ou colar a URL" (png, jpeg, gif · 8 MB max) |
| Vídeo | — | "Carregar ou arraste vídeo" (24 MB max) |
| PDF | — | "Carregar ou arraste PDF" (24 MB max) |

"Adicionar conteúdo" abre a mesma lista. Cada conteúdo tem remover, reordenar e duplicar ao lado.

"Esperar a resposta por": seleção, padrão 23 horas. "Sem resposta nesse prazo, o fluxo segue pela
saída 'Sem resposta'. O máximo é 23 h, para que a mensagem dessa saída ainda caiba na janela de 24 h
da conversa. Se a saída não estiver ligada, a pergunta continua aceitando a resposta por até 7 dias."

Ao adicionar botão aparecem "Botão 1", a saída "Sem resposta em 23 horas" e "Esperar o clique por"
(padrão 23 horas; opções 5 min, 15 min, 30 min, 1 h, 3 h, 6 h, 12 h, 23 h).

Painel "Configurar ação #{n}", "Ao clicar neste botão": Mensagem, Abrir um link e, em "Opções
avançadas": Condicional, Distribuir, Campo personalizado, Adicionar ou remover etiquetas, Requisição
HTTP. Com "Abrir um link": "Nome do botão" (máx. 20, obrigatório) e "Link" (prefixo https://,
máx. 1000, botão de variáveis), mais "Mudar", "Adicionar próximo passo" e "Remover".

### Adicionar ou remover etiquetas

"Tipo de ação" (padrão Adicionar; opções Adicionar, Remover) e "Etiquetas" (seleção com criação,
"Selecione ou crie uma etiqueta..."). Cartão vazio: "Selecione as etiquetas".

### Aguardar

"Aguardar": número, padrão 1, mínimo 1, máximo 82800. Unidade: padrão segundos; opções segundos,
minutos, horas. Cartão: "**Aguardar 1 segundo** antes da próxima mensagem".

### Condicional

Saídas Sim e Não. "Condição 1", excluir desabilitado quando é a única, "Adicionar condição".

| "Tipo de campo" | Próximos campos |
|---|---|
| Variável (padrão) | "Variável" ("Selecione uma variável"); "Operador": Igual a, Diferente de, Contém, Não contém; "Valor": "Digite o valor..." |
| Etiqueta | "Operador": Possui etiqueta, Não possui etiqueta; "Etiqueta": "Selecione ou crie uma etiqueta..." |
| Status de seguidor | "Operador": É seguidor, Não é seguidor |
| Janela de 24h (Instagram) | "Operador": Está aberta, Está fechada |

"Operador" fica desabilitado até escolher a variável e então assume "Igual a".

Variáveis, grupo CONTATO: Nome do contato; Primeiro nome do contato; Imagem de perfil do contato;
Imagem de perfil do contato (Base64); @ do contato; ID do contato; Pontuação do contato; Contato
verificado; Seguidores do contato; Tags do contato; Mensagem de gatilho; Última mensagem do contato;
Quem enviou a última mensagem; Tipo da última interação; ID do post (comentário); Link do post
(comentário); E-mail do colaborador (mensagem enviada); Conversa (últimos 30 min); Conversa (última
1 hora); Conversa (últimas 24 horas); Data atual; Data e hora atual; Hora atual; Dia da semana; mais
os campos personalizados da conta.

### Distribuir

"Opções de randomização": "Configure de 2 a 20 opções com porcentagens que somem 100%", selo
"Total: 100%", botões "Distribuir igualmente" e "Adicionar opção". Opção 1 e Opção 2: número padrão
50, de 0 a 100, sufixo %, cor própria. Saídas no cartão: "Opção 1 - 50%", "Opção 2 - 50%".

### Iniciar automação

"Iniciar automação" ("Selecione uma automação"); "Atraso" com três contadores H, M e S, padrão 0;
"Rodar em paralelo" (interruptor, padrão desligado): "Ligado, esta automação segue para o próximo
bloco logo depois de iniciar a outra. Desligado, ela espera a outra terminar." Pendência:
"Selecione o workflow."

### Pausar automações

"Duração da pausa": padrão 1 hora; opções 30 min, 1 hora, 4 horas, 1 dia, 3 dias, 7 dias,
Indefinido. Cartão: "Retomar todas as automações após **1 hora**".

### Matemática

"Campo do resultado" ("Selecione um campo"; sem campo numérico, "Nenhum campo personalizado
disponível"); "Valor A" (padrão Campo numérico; opções Campo numérico, Valor fixo); "Campo
personalizado"; "Operação" (padrão Somar (+); opções Somar (+), Subtrair (−), Multiplicar (×),
Dividir (÷), Menor valor, Maior valor, Resto da divisão, Porcentagem (X% de A), Aumentar em %
(A + X%)); "Valor B" (padrão Valor fixo) e o valor ("Ex.: 10").

### Campo personalizado

"Campo personalizado" ("Selecione um campo") e "Valor do campo" ("Digite o valor...", máx. 100,
contador, botão de variáveis). Cartão vazio: "Selecione o campo e o valor".

### Requisição HTTP

Saídas Sucesso e Falha. Abas Configuração, Mapeamento e Histórico.

- Configuração: "Método" (padrão Get; opções Get, Post, Delete, Patch, Put); "Endpoint"
  ("https://api.exemplo.com/endpoint", botão de variáveis, erro "URL inválida"); "Cabeçalhos" com
  par nome/valor (padrão Content-Type / application/json) e "Adicionar cabeçalho". Com Post, "Dados
  da requisição" com abas Visual e JSON e "Adicionar campo".
- Mapeamento: "Enviar teste"; "Guardar a resposta inteira em" (máx. 50) — "Variável desta execução
  com a resposta toda (até 64 KB), para um bloco seguinte ler o que o mapeamento não pega. Não vira
  campo do contato."; "Mapeamento de resposta" com "Adicionar mapeamento".
- Histórico: "Nenhum evento registrado".

### Google Sheets

"Você precisa de uma conta Google conectada para usar o Google Sheets. Conectar agora". Cartão:
"Inserir linha", "Nó não configurado". Demais campos: não verificado.

### Código (Beta)

Saídas Sucesso e Falha. Editor JavaScript com numeração de linha; "Testar o código" com um editor
JSON de variáveis e botão "Testar"; e as saídas explicadas: "Sucesso: o código devolveu o objeto, e
as chaves dele já valem como variáveis" / "Falha: o código deu erro, passou do tempo, devolveu algo
que não é um objeto ou não pôde rodar".

## 9. Outros painéis do editor

- Assistente: "Como posso ajudar?", sugestões de auditoria e melhoria do fluxo, aviso de que a IA
  pode errar, e campo "Pergunte sobre esta automação...".
- Métricas da automação: "Período" ("Desde o início"), "Suas métricas aparecem aqui", e o
  interruptor "Métricas por card" (ligado).
- Guia de boas práticas: busca e índice à esquerda, texto à direita.

## 10. Fluxos

- Criar do zero: bloco "O que inicia a automação", "Testar e publicar" desabilitado, salvamento
  automático; depois "Adicionar gatilho" → marcar gatilhos → Continuar → etapas → Salvar. Cada bloco
  novo entra ligado e abre a própria gaveta.
- Escolher template: não verificado.
