# Kleinanzeigen in English

Userscript, který automaticky přeloží Kleinanzeigen.de z němčiny do angličtiny. Přeloží texty na stránce, inzeráty, filtry, placeholdery i titulek záložky. Obsah, který se načte později, přeloží hned, jak se objeví. Zároveň skryje reklamy: bannery, sponzorované nabídky ve výpisu i u inzerátu a celoobrazovkové okno s reklamou na aplikaci.

## Instalace

1. Nainstalujte si do prohlížeče správce userscriptů:
   - **Safari** (Mac, iPhone, iPad): [Userscripts](https://apps.apple.com/app/userscripts/id1463298887). Zapněte rozšíření v Safari → Nastavení → Rozšíření a povolte ho pro kleinanzeigen.de.
   - **Chrome, Edge, Brave**: [Tampermonkey](https://www.tampermonkey.net/) nebo [Violentmonkey](https://violentmonkey.github.io/). V Chromu navíc otevřete podrobnosti rozšíření (`chrome://extensions`) a zapněte **Povolit uživatelské skripty**.
   - **Firefox**: [Tampermonkey](https://www.tampermonkey.net/) nebo [Violentmonkey](https://violentmonkey.github.io/).
2. Otevřete skript přímo z GitHubu:

   https://raw.githubusercontent.com/kasparek-net/kleinanzeigen-translate/main/kleinanzeigen-translate.user.js

3. Potvrďte instalaci. V Safari otevřete na té stránce nabídku rozšíření Userscripts a klikněte na **Install**.
4. Obnovte otevřené záložky s Kleinanzeigen.

## Jak to funguje

Skript posílá texty stránky ve větších dávkách na Google Translate a přeložené je vrací zpět na místo. Překlady si pamatuje, takže opakované texty se nepřekládají znovu.

## Omezení

- Přeloží i názvy míst (třeba čtvrť Porz jako „Porcelain“).
- Reklamní snímek v galerii fotek na mobilu zůstane prázdný, aby se galerie nerozbila.
- Když Kleinanzeigen změní názvy reklamních prvků, může nějaká reklama znovu prosáknout.
- Používá neoficiální rozhraní Google Translate. Při velkém množství požadavků ho Google může dočasně blokovat a část stránky pak zůstane německy.
- Texty stránky se odesílají Googlu.

## Test

```
npm install
npm test
```
