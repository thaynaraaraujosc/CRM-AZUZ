# Roteiro do vídeo para a análise da Meta — CRM AZUZ

Tirado do código, não de suposição: estas são as permissões que o CRM realmente pede
(`ESCOPOS_INSTAGRAM_LOGIN` e `ESCOPOS_POR_PROVEDOR`).

| # | Permissão | Onde demonstrar |
|---|---|---|
| 1 | `instagram_business_basic` | Configurações → Integrações → Instagram Direct |
| 2 | `instagram_business_manage_messages` | Tela do Instagram (caixa do Direct) |
| 3 | `instagram_business_manage_comments` | Automações (gatilho de comentário) |
| 4 | `whatsapp_business_management` | Configurações → WhatsApp (API oficial) |
| 5 | `whatsapp_business_messaging` | Tela do WhatsApp |
| 6 | `business_management` | Aparece junto do passo 4, na tela de permissões da Meta |

---

## ANTES DE GRAVAR — a parte que já reprovou uma vez

**1. Reconecte o Instagram.** Se o token venceu, a conexão continua dizendo "conectado",
as mensagens até chegam, mas tudo que depende da Meta morre calado: miniatura de story,
Reels compartilhado, anexo. Um vídeo com as miniaturas faltando é reprovação.
Abra o Direct depois de reconectar e confirme que as miniaturas voltaram.

**2. Tenha conversa de verdade na tela.** Pelo menos duas conversas no Direct e duas no
WhatsApp, com mensagem recebida E enviada. Tela vazia lê como "app não funcional".

**3. Crie a conta de cortesia do revisor** (Admin → Agências → nova conta de cortesia).
Ela nasce com assinatura ativa e sem cobrança atrás, então o revisor não bate em
paywall — que é a outra causa clássica de reprovação. Entregue esse e-mail e senha no
campo de credenciais de teste da submissão.

**4. Idioma.** Se o app estiver em português, diga em voz ou em legenda o que cada tela
é. O revisor não fala português e precisa entender sem traduzir.

**5. Grave a tela inteira do navegador**, com a barra de endereço visível. O revisor
precisa ver o domínio do seu app.

---

## O ROTEIRO

### Abertura (10s)
Mostre a barra de endereço com `azuzcrm.com.br` e faça login com a conta de cortesia.
Diga: "This is AZUZ CRM. I'm logging in with the test account provided."

### Bloco 1 — Instagram: conexão (permissões 1 e 2) — 40s
1. Configurações → Integrações → **Instagram Direct** → "Conectar".
2. **Filme a tela de permissões do Instagram inteira**, sem cortar. É aqui que o revisor
   vê as permissões sendo pedidas. Não acelere nem corte este trecho.
3. Autorize e volte para o CRM mostrando "Conectado" com o nome da conta.

### Bloco 2 — Instagram: mensagens (permissão 2) — 50s
1. Abra a tela **Instagram**.
2. Mostre a lista de conversas e abra uma.
3. **Role o histórico** — mensagem recebida e enviada aparecendo.
4. **Responda de verdade, no vídeo**, e mostre a mensagem saindo e aparecendo na conversa.
   Este é o trecho mais importante do vídeo inteiro: é ele que prova
   `instagram_business_manage_messages`. Não substitua por uma tela parada.

### Bloco 3 — Instagram: comentários (permissão 3) — 40s
Esta permissão **não tem tela própria** no CRM: ela vive nas Automações.
1. Abra **Automações** e mostre um fluxo com gatilho **"Comentário no Instagram"**.
2. Mostre as ações disponíveis: **responder o comentário** e **ocultar o comentário**.
3. Se conseguir, comente num post seu pelo celular e mostre a automação disparando.
   Se não der, mostre o fluxo montado e o histórico de execução.

### Bloco 4 — WhatsApp: conexão (permissões 4 e 6) — 40s
1. Configurações → Integrações → **WhatsApp Business (API oficial)** → "Conectar".
2. **Filme a tela de permissões da Meta inteira.** É onde `whatsapp_business_management`
   e `business_management` aparecem.
3. Volte mostrando o número conectado.

### Bloco 5 — WhatsApp: mensagens (permissão 5) — 50s
1. Abra a tela **WhatsApp**.
2. Abra uma conversa, role o histórico.
3. **Envie uma mensagem no vídeo** e mostre ela chegando.

### Fechamento (10s)
Volte para Configurações → Integrações mostrando as duas conexões ativas.

---

## O que NÃO fazer

- **Não corte nem acelere as telas de permissão.** É o trecho que o revisor procura.
- **Não mostre tela vazia.** "Nenhuma conversa ainda" lê como app quebrado.
- **Não mostre o que está "Em breve"** (Azuz IA). Nada que pareça função não entregue.
- **Não use câmera apontada para o monitor.** Grave a tela.
- **Não mostre dado de cliente real** que você não queira que terceiros vejam — o vídeo
  fica com a Meta. Se precisar, use conversas de teste.

---

## Duração

4 a 5 minutos no total. Vídeo curto demais costuma faltar demonstração; longo demais
cansa e o revisor pula justamente o trecho que importa.
