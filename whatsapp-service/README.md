# Serviço de WhatsApp não oficial (Baileys)

Processo Node separado que espelha um número de WhatsApp direto pelo protocolo multi-device
(biblioteca [Baileys](https://github.com/WhiskeySockets/Baileys)), sem navegador. Existe porque a
conexão precisa ficar aberta 24/7 — isso não roda dentro do Next.js na Vercel (funções serverless
não sustentam WebSocket vivo), então este serviço mora à parte.

Cada instância deste serviço cuida de **um único número de WhatsApp** (um `WORKSPACE_ID`). Se no
futuro mais de uma empresa precisar de WhatsApp não oficial ao mesmo tempo, sobe uma instância por
empresa.

## Como funciona

1. Ao subir, o serviço tenta abrir a sessão salva em `PASTA_SESSAO`. Se não existir, gera um QR
   code e manda pro CRM (`CRM_WEBHOOK_URL`) como uma imagem `data:` — o CRM guarda isso na tabela
   `Integracao` e a tela de Configurações → WhatsApp → Conexão não oficial mostra o QR pra escanear.
2. Depois de escaneado, a conexão abre e o serviço avisa o CRM que está `conectado` (com o número).
3. Toda mensagem de texto recebida é repassada pro CRM, que grava em `MensagemExtra` — aparece na
   tela de Conversas normalmente.
4. O CRM pode chamar `POST /enviar` neste serviço pra mandar mensagem pelo número conectado.

## Rodando local (pra testar agora)

```bash
cd whatsapp-service
cp .env.example .env   # preencha WORKSPACE_ID, CRM_WEBHOOK_URL e SERVICO_SEGREDO
npm install
npm run dev
```

Com o CRM rodando em `npm run dev` na raiz do repo (porta 3000) e `CRM_WEBHOOK_URL` apontando pra
`http://localhost:3000/api/webhooks/whatsapp-nao-oficial`, abra Configurações → WhatsApp no CRM,
escolha "Conexão não oficial" e escaneie o QR que aparece.

No `.env` do CRM (raiz do repo), adicione a mesma chave:

```
WHATSAPP_SERVICO_SEGREDO=<mesmo valor de SERVICO_SEGREDO aqui>
WHATSAPP_SERVICO_URL=http://localhost:3333
```

## Deploy no Railway (produção)

1. No projeto Railway que já tem o MySQL, clique em **New → GitHub Repo** e aponte pra este mesmo
   repositório, mas configure o **Root Directory** como `whatsapp-service` (Railway builda só essa
   pasta como um serviço separado do Next.js).
2. Build command: `npm install && npm run build` — Start command: `npm start`.
3. Variáveis de ambiente (aba Variables do serviço): `WORKSPACE_ID`, `CRM_WEBHOOK_URL` (URL pública
   do CRM em produção + `/api/webhooks/whatsapp-nao-oficial`), `SERVICO_SEGREDO`.
4. **Volume persistente**: em Settings → Volumes, monte um volume em `/app/sessao` (ou o caminho de
   `PASTA_SESSAO`). Sem isso, todo redeploy apaga a sessão salva e pede QR code de novo.
5. No `.env` de produção do CRM (Vercel), adicione `WHATSAPP_SERVICO_SEGREDO` (mesmo valor) e
   `WHATSAPP_SERVICO_URL` apontando pra URL pública que o Railway gerar pra este serviço.

## Limitações conhecidas (nesta primeira versão)

- Só mensagens de **texto** são espelhadas (sem mídia/áudio/figurinha) — mesmo escopo inicial que a
  integração oficial da Meta teve.
- Um serviço = um número. Sem suporte a múltiplas empresas na mesma instância ainda.
- É uma conexão não oficial: a sessão pode cair e pedir novo QR code de tempos em tempos, e há risco
  inerente de bloqueio do número pela Meta — trade-off conhecido desse tipo de integração, não é bug.
