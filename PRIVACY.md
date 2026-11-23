# Privacy Policy / Política de Privacidade

*Last updated / Última atualização: 2026-11-23*

## English

Lampyris does not collect, store, sell or transmit any personal data. It has no analytics, no tracking and no servers.

- **Settings** (on/off, shortcut, size, sites you turned it off on) are saved with the browser's own `storage.sync`, which your browser may sync between your devices. They never reach the developer.
- **Pages you peek** load directly from the site into the Peek, exactly like opening the link in a tab. Lampyris doesn't read or record them; it only follows the Peek's current address to show it in the toolbar and to open it as a tab or window when you ask.
- **Framing headers:** while a Peek is open, Lampyris removes the `X-Frame-Options` and `Content-Security-Policy` headers from embedded frames *in that tab only*, so sites can be shown inside the Peek. The rule is removed as soon as the Peek closes.
- **Cookies:** so you stay logged in inside the Peek, Lampyris reads the cookies of the site you're peeking and attaches them to that site's own requests, only in that tab and only while the Peek is open (the same cookies the browser sends when you open the site in a tab). They are never stored by the extension or sent anywhere else.
- **Mini Peek:** previews load in a credentialless frame, without your cookies or saved data.
- **Popup background:** when you open the settings popup, Lampyris takes a snapshot of the visible tab and shows it blurred behind the popup (a frosted-glass effect). The image stays in memory while the popup is open and is never saved or sent anywhere.

### Permissions

| Permission | Why |
|---|---|
| Access to all sites | Intercept link clicks on any page and show the Peek |
| `declarativeNetRequest` | Let blocked sites load inside the Peek (see above) |
| `webNavigation` | Follow the Peek's current address and detect pages that fail to load |
| `cookies` | Keep you logged in inside the Peek (see above) |
| `contextMenus` | The "Peek with Lampyris" item when right-clicking a link |
| `storage` | Save your settings |

## Português

O Lampyris não coleta, armazena, vende nem transmite nenhum dado pessoal. Não tem estatísticas, rastreamento nem servidores.

- **As configurações** (ligado/desligado, atalho, tamanho, sites em que você desligou) ficam no `storage.sync` do próprio navegador, que pode sincronizá-las entre seus dispositivos. Elas nunca chegam ao desenvolvedor.
- **As páginas que você espia** carregam direto do site para o Peek, igual a abrir o link numa aba. O Lampyris não as lê nem registra; só acompanha o endereço atual do Peek para mostrá-lo na barra e para abri-lo como aba ou janela quando você pede.
- **Cabeçalhos de bloqueio:** enquanto um Peek está aberto, o Lampyris remove os cabeçalhos `X-Frame-Options` e `Content-Security-Policy` dos quadros embutidos *só naquela aba*, para que os sites possam aparecer dentro do Peek. A regra é removida assim que o Peek fecha.
- **Cookies:** para você continuar logado dentro do Peek, o Lampyris lê os cookies do site que você está espiando e os anexa às requisições do próprio site, só naquela aba e só enquanto o Peek está aberto (os mesmos cookies que o navegador envia quando você abre o site numa aba). Eles nunca são guardados pela extensão nem enviados para outro lugar.
- **Mini Peek:** as prévias carregam num quadro sem credenciais, sem os seus cookies nem dados salvos.
- **Fundo do popup:** quando você abre o popup de configurações, o Lampyris tira uma foto da área visível da aba e a mostra desfocada atrás do popup (efeito de vidro fosco). A imagem fica só na memória enquanto o popup está aberto e nunca é salva nem enviada.

### Permissões

| Permissão | Para quê |
|---|---|
| Acesso a todos os sites | Interceptar cliques em links em qualquer página e mostrar o Peek |
| `declarativeNetRequest` | Deixar sites bloqueados carregarem dentro do Peek (veja acima) |
| `webNavigation` | Acompanhar o endereço atual do Peek e detectar páginas que não carregam |
| `cookies` | Manter você logado dentro do Peek (veja acima) |
| `contextMenus` | O item "Espiar com o Lampyris" no botão direito de um link |
| `storage` | Salvar suas configurações |
