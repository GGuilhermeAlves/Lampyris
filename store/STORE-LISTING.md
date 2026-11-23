# Textos e passo a passo para as lojas

## 1. Textos

**Nome:** Lampyris

**Resumo curto (até 132 caracteres)**
- en: Arc-style Peek for any browser. Alt+click a link to open it in a floating window, or hold Shift over it for a preview.
- pt-BR: O Peek do Arc em qualquer navegador. Alt+clique num link para abri-lo numa janela flutuante, ou segure Shift para uma prévia.

**Descrição (pt-BR)**

O Lampyris traz o Peek do navegador Arc para o Chrome, Edge, Brave e Firefox.

Dê Alt+clique em qualquer link e ele abre numa janela flutuante por cima da página. Dê uma olhada, aperte Esc e você continua exatamente onde estava. Se valer a pena, um clique transforma o Peek numa aba de verdade.

• Alt+clique (ou Shift+clique) em qualquer link
• Mini Peek: segure Shift e pare o mouse num link para ver uma prévia
• Abas fixadas como no Arc: links para outros sites abrem no Peek sozinhos
• Botão direito → Espiar com o Lampyris
• Barra com recarregar, copiar link, abrir numa janela e abrir como aba
• Você continua logado dentro do Peek, como numa aba
• Abre até sites que normalmente bloqueiam ser exibidos dentro de outras páginas
• Se uma página não carregar, ela abre numa janelinha pop-up automaticamente
• Três tamanhos e opção de desligar por site
• Sem coleta de dados, sem rastreamento, sem servidores

**Description (en)**

Lampyris brings the Arc browser's Peek to Chrome, Edge, Brave and Firefox.

Alt+click any link and it opens in a floating window over the page. Take a look, press Esc and you're right where you were. If it's worth keeping, one click turns the Peek into a real tab.

• Alt+click (or Shift+click) any link
• Mini Peek: hold Shift and rest the pointer on a link for a preview
• Pinned tabs like Arc: links to other sites open in a Peek on their own
• Right-click → Peek with Lampyris
• Toolbar with reload, copy link, open in a window and open as a tab
• You stay logged in inside the Peek, just like in a tab
• Opens even sites that normally refuse to be shown inside other pages
• If a page won't load, it opens in a small popup window automatically
• Three sizes and a per-site off switch
• No data collection, no tracking, no servers

**Categoria:** Produtividade (Chrome) · Tabs (Firefox)

**Política de privacidade:** `https://github.com/GGuilhermeAlves/lampyris/blob/main/PRIVACY.md`

## 2. Justificativa das permissões (Chrome Web Store)

- **Acesso a todos os sites (host permission):** o Lampyris precisa detectar cliques em links em qualquer página para abrir o Peek.
- **declarativeNetRequest:** enquanto um Peek está aberto, remove os cabeçalhos X-Frame-Options e Content-Security-Policy dos quadros embutidos só naquela aba, para que o site apareça dentro do Peek. A regra é removida quando o Peek fecha.
- **webNavigation:** acompanha o endereço atual do Peek para mostrá-lo na barra e detecta quando a página não carrega, para abrir uma janela pop-up no lugar.
- **cookies:** mantém você logado dentro do Peek. A extensão lê os cookies do site espiado e os anexa só às requisições desse próprio site, só naquela aba e só enquanto o Peek está aberto. Nada é guardado nem enviado para fora.
- **contextMenus:** adiciona "Espiar com o Lampyris" ao botão direito de links.
- **storage:** salva as configurações.
- **Uso de dados:** marque que a extensão não coleta nenhum tipo de dado.

## 3. Chrome Web Store

1. Rode `./scripts/pack.sh`, que gera `dist/lampyris-1.0.0-chrome.zip` e `dist/lampyris-1.0.0-firefox.zip`.
2. No Developer Dashboard, clique em **New item** e envie o `-chrome.zip`.
3. Preencha os textos acima, o ícone de 128px (`extension/icons/icon128.png`) e as capturas de 1280×800 que já estão em `store/images/` (Peek e Mini Peek, em inglês e português).
4. Em **Privacy**, cole as justificativas da seção 2 e o link da política de privacidade.
5. Envie para revisão. A permissão de acesso a todos os sites costuma deixar a revisão mais demorada.
6. Opcional: publique também na Microsoft Edge Add-ons e no Opera Add-ons, que aceitam o mesmo `-chrome.zip`.

## 4. Firefox Add-ons (AMO)

1. Em <https://addons.mozilla.org/developers/>, clique em **Submit a New Add-on** → **On this site** e envie o `-firefox.zip`.
2. **Source code:** o Lampyris não é minificado nem compilado, então responda **No** quando a loja perguntar se o código precisa de build.
3. **Data collection:** o manifest já declara `data_collection_permissions: { required: ["none"] }`. Confirme que a extensão não coleta dados.
4. O ID fica definido no manifest (`lampyris@lampyris-peek`). Não mude esse ID depois de publicar, porque é por ele que o Firefox entrega as atualizações.
