# Textos do envio — Análise de app da Meta (AZUZ CRM)

Tudo em inglês, pronto para copiar e colar. O que está entre `<<< >>>` você substitui.

> **Antes de qualquer coisa:** o acesso informado ao analista tem que ser o da conta de
> DEMONSTRAÇÃO (`demo@azuzcrm.com.br`), nunca o seu login pessoal. O analista entra no CRM e navega
> sozinho — com a sua conta ele veria dados de clientes reais.

---

## 1. Descrição de uso — uma por permissão

### instagram_business_basic

```
Azuz CRM is a customer service and sales platform used by small and medium businesses in Brazil.

We use instagram_business_basic to read the basic profile metadata of the Instagram professional
account that the business owner connects to their own CRM workspace: the username, the account ID
and the profile picture.

Why it is necessary: the CRM shows Instagram Direct conversations in the same shared inbox it uses
for WhatsApp. Without the username and profile picture, every conversation would be identified only
by an internal numeric ID, and the agent answering would not know who they are talking to. The
profile picture and handle are displayed on the conversation list, on the conversation header and on
the contact record created from that conversation.

We request instagram_business_basic as a dependent permission for instagram_business_manage_messages
and instagram_business_manage_comments.

We do not request or store Instagram account credentials. Access is granted by the business owner
through Instagram Login, and the token is stored encrypted and used only for that workspace.
```

### instagram_business_manage_messages

```
Azuz CRM uses instagram_business_manage_messages so that a business can read and reply to its own
Instagram Direct messages from inside the CRM, in the same inbox used for WhatsApp.

What the app does with it:
- receives Direct messages, story replies and story mentions through the webhook;
- shows them in the shared team inbox, attributed to a contact record;
- lets an agent reply from the CRM within Instagram's 24-hour messaging window;
- lets the business automate a first reply (for example, a welcome message to a first-time sender).

Why it is necessary: the product's core value is that a small business answers WhatsApp and
Instagram from one screen, with one history per customer, instead of switching between apps. Without
this permission the Instagram half of that inbox cannot exist.

Only messages of the connected business account are accessed. Nothing is read from accounts the
business owner has not connected.
```

### instagram_business_manage_comments

```
Azuz CRM uses instagram_business_manage_comments so that a business can see and answer the comments
left on its own Instagram posts, from inside the CRM.

What the app does with it:
- receives new comments on the connected account's posts through the webhook;
- shows them next to the Direct conversations, so the team answers in one place;
- lets an agent reply publicly to the comment, or hide a comment that is spam;
- lets the business automate a reply when a comment contains a chosen keyword.

Why it is necessary: for these businesses, a comment is a sales lead exactly like a Direct message.
Leaving comments outside the CRM means the lead is answered late or not at all, and no history of it
is kept on the customer record.

Only the connected business account's own posts and comments are accessed.
```

### whatsapp_business_messaging

```
Azuz CRM uses whatsapp_business_messaging to send and receive WhatsApp messages on behalf of the
business that connected its own WhatsApp Business account through Embedded Signup.

What the app does with it:
- receives incoming messages through the webhook and shows them in the shared team inbox;
- lets agents reply with text, images, documents, audio and location inside the 24-hour window;
- sends approved message templates to re-engage a customer after the window has closed;
- triggers the business's own automations (welcome message, follow-up, appointment reminder).

Why it is necessary: WhatsApp is the main sales and support channel for small businesses in Brazil.
This permission is what allows the CRM to be the place where those conversations are handled, with
the history attached to the customer record and to the sales pipeline.

Each business connects its own number. Messages are never sent from a number the business owner has
not connected, and the access token is stored encrypted per workspace.
```

### whatsapp_business_management

```
Azuz CRM uses whatsapp_business_management to set up and maintain the WhatsApp Business Account that
the business owner connects through Embedded Signup, without them having to copy any token or ID by
hand.

What the app does with it:
- subscribes the app to the WABA's webhooks, so incoming messages reach the CRM;
- registers the connected phone number on the Cloud API;
- reads the account and phone number metadata shown in the CRM's connection screen: display name,
  verified name, quality rating and verification status;
- reads the list of approved message templates, so the agent can pick one when the 24-hour window
  has closed.

Why it is necessary: without it the connection cannot be completed from inside the product. The
business owner would have to go to Meta's developer tools, create a system user, generate a token
and copy identifiers — which is not something a small business owner can be asked to do.

Only the WABA that the business owner explicitly selects during Embedded Signup is accessed.
```

---

## 2. Instruções para o analista (campo "how to test your app")

```
HOW TO TEST

URL: https://azuzcrm.com.br/login
E-mail: demo@azuzcrm.com.br
Password: <<<senha da conta de demonstração>>>

The interface is available in English. After signing in, use the PT | EN switch at the top right of
the screen and select EN.

Note on the Meta login flow: this app uses front-end Meta login. Instagram Login and WhatsApp
Embedded Signup both run in the browser, so the complete Meta login and permission dialogs are
visible in the screencast and reproducible by the reviewer. This app is not server-to-server and
does not use a system user token to access the Meta API.

--- INSTAGRAM ---

1. In the left menu, open "Settings" > "Other integrations".
2. Find "Instagram Direct" and click "Connect".
3. The Instagram Login dialog opens. Sign in with YOUR OWN Instagram professional account and grant
   the permissions.
4. You are returned to the CRM. The connection card now shows the connected account's handle.
5. PROFILE INFORMATION: open "Instagram" in the left menu. The connected account's username and
   profile picture are shown on the right-hand panel ("Profile information"), together with the
   follower count and whether the account is verified.
6. MESSAGES: send a Direct message to that Instagram account from another account. It arrives in the
   conversation list within a few seconds. Open it and reply from the text box at the bottom. The
   reply is delivered on Instagram.
7. COMMENTS: leave a comment on a post of that account. It appears in the same screen, and the
   "Reply to the comment" action posts a public reply.

--- WHATSAPP ---

8. In the left menu, open "Settings" > "Other integrations".
9. Find "WhatsApp Business (official API)" and click "Connect with the official API (Meta)".
10. Meta's Embedded Signup dialog opens. Select a business portfolio, a WhatsApp Business Account and
    a phone number, and complete the sign-up.
11. You are returned to the CRM and the connection card shows the connected phone number.
12. MESSAGES: send a WhatsApp message to that number from another phone. It arrives in the "WhatsApp"
    inbox in the left menu within a few seconds. Open the conversation and reply from the text box at
    the bottom.

Note: we do not provide Instagram or WhatsApp account credentials, as instructed. The reviewer
connects their own accounts using the CRM credentials above.
```

---

## 3. O que conferir antes de enviar

- [ ] O e-mail na caixa de descrição é `demo@azuzcrm.com.br`, **não** o seu pessoal
- [ ] Os colchetes `[ ]` foram removidos
- [ ] A conta de demonstração está com **Instagram DESCONECTADO** (senão o analista não consegue
      conectar a dele e a análise falha pelo mesmo motivo de antes)
- [ ] A senha da conta de demonstração é exclusiva dela, não usada em mais nada
- [ ] Os dois vídeos foram gravados com o CRM em **EN**
- [ ] O vídeo começa **deslogado** e mostra o diálogo da Meta inteiro, sem corte
