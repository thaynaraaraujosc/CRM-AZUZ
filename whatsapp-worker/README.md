# whatsapp-worker

Serviço separado (não faz parte do deploy da Vercel) que mantém as conexões WhatsApp "não
oficiais" (via QR Code, usando Baileys) vivas — precisa rodar 24h num processo próprio, coisa que
funções serverless da Vercel não suportam.

## Rodando local

```
cp .env.example .env   # preenche WORKER_SECRET (mesmo valor do Next.js) e NEXTJS_BASE_URL
npm install
npm run dev
```

## Deploy no Railway

1. Criar um novo serviço no mesmo projeto Railway que já hospeda o banco MySQL.
2. Apontar o **Root Directory** desse serviço para `whatsapp-worker/` (o Railway builda só esse
   subdiretório, ignorando o resto do repo).
3. Adicionar um **volume persistente** montado em `/data` e configurar `SESSOES_DIR=/data/sessoes`
   nas variáveis de ambiente do serviço — sem isso, toda vez que o Railway reiniciar o serviço as
   sessões conectadas caem e pedem escanear o QR de novo.
4. Variáveis de ambiente do serviço: `WORKER_SECRET` (mesmo valor cadastrado no Vercel),
   `NEXTJS_BASE_URL` (a URL de produção do CRM), `SESSOES_DIR`.
5. Build command: `npm run build`. Start command: `npm run start`.
6. No Vercel, cadastrar `BAILEYS_WORKER_URL` apontando pra URL pública desse serviço Railway, e
   `WORKER_SECRET` com o mesmo valor.
