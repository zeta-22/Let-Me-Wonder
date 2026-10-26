# Wanderswipe: brief della prima versione

26 ottobre 2026 · Matteo

## Il problema

In viaggio, decidere cosa fare in due o in gruppo è la parte più noiosa: link sparsi in chat, liste che nessuno riapre, discussioni la sera prima. Le app che esistono aiutano a **scoprire** (TikTok, Mindtrip) o a **organizzare** (Wanderlog), ma nessuna aiuta a **mettersi d'accordo**.

## L'idea in una frase

Scorri schede di posti con foto e video. Quando un posto piace a tutti è un match, e i match diventano il programma.

## Dove vogliamo arrivare

Un'app che segue tutto il viaggio, in sei momenti:

1. dove andare;
2. cosa vedere;
3. il match;
4. l'itinerario;
5. prenotazioni e logistica;
6. in viaggio e dopo.

In ogni momento si decide con lo swipe. A regime l'app serve a coppie, gruppi e chi viaggia da solo, e in futuro alle agenzie, che preparano il mazzo per il cliente e ricevono le sue preferenze.

## La prima versione: "cosa facciamo oggi?"

**Per chi:** noi due, durante il viaggio in Messico (27 dicembre 2026 – 9 gennaio 2027).

**Quando si usa:** la sera prima o la mattina, in ogni tappa del giro. Il giro lo decidiamo a mano entro il 2 novembre.

### Cosa c'è

1. **Un mazzo per tappa**, con 10-15 schede tra posti, esperienze e posti dove mangiare. Ogni scheda ha foto e video, un testo breve, il tempo che richiede (mezza giornata o giornata), gli orari e un prezzo indicativo.
2. **Swipe separato** sui due telefoni: Sì, Forse, No.
3. **Match** quando entrambi dicono sì. Gli altri posti con almeno un sì o un forse vanno nella lista **"Da discutere"**.
4. **Schede dai social:** incolli un link TikTok o Instagram che hai salvato e scegli a quale posto corrisponde.
5. **Il risultato** è la lista dei match della tappa, con un link ad ogni posto su Google Maps.

### Cosa non c'è, e perché

- **Scelta del paese e del giro** (momento 1 e rotta del momento 4): il giro lo decidiamo a mano. Annotiamo dove ci blocchiamo, perché è ricerca per dopo.
- **Itinerario giorno per giorno generato:** per decidere basta la lista dei match. Il programma della giornata lo facciamo noi.
- **Prenotazioni, spese, diario** (momenti 5 e 6): esistono già altrove (Wanderlog, Splitwise).
- **Gruppi oltre le due persone e agenzie:** i dati li prevedono, ma le schermate sono pensate per due.
- **Generatore automatico di mazzi:** i mazzi del Messico li prepariamo noi con l'aiuto di Claude e li rivediamo a mano.

## Cosa vogliamo imparare

1. Usiamo davvero lo swipe in viaggio, o finiamo a decidere in chat?
2. Il match riduce le discussioni? Quanti match e quanti "da discutere" escono per tappa?
3. Che tipo di schede funziona meglio (posti, esperienze, ristoranti)? Cosa guardiamo prima di dire sì?
4. Aggiungiamo schede dai social? Quante?
5. Cosa ci manca? Ogni sera scriviamo due minuti di diario sull'app.

## Come capiamo se funziona

- L'abbiamo usata nella maggior parte delle tappe.
- Almeno metà dei posti dove siamo andati vengono dai match.
- A fine viaggio rispondiamo sì a due domande: "la useremmo nel prossimo viaggio?" e "la consiglieremmo a una coppia di amici?".

A gennaio decidiamo il passo successivo. Le strade possibili sono: estendere l'app al giro e alla scelta del paese, testarla con 3-5 coppie di amici, o parlarne con 2-3 agenzie.

## Calendario

| Quando | Cosa |
|---|---|
| entro 2 nov | Giro deciso a mano, con note su cosa è stato difficile |
| entro ~23 nov | Swipe e match funzionano su due telefoni con un mazzo di prova |
| entro ~13 dic | Mazzi di tutte le tappe pronti e rivisti |
| 14 – 26 dic | Prova generale a casa (es. un mazzo per una serata nella nostra città) e correzioni |
| 27 dic – 9 gen | Test sul campo |
| gennaio | Retrospettiva e decisione sul passo successivo |

## Rischi

- **Contenuti:** ci sono 50-70 schede da preparare. Claude aiuta, ma la revisione resta manuale.
- **Tempo:** lavoriamo la sera e la scadenza del 27 dicembre è fissa. Se siamo in ritardo tagliamo prima le schede dai social e i dettagli Google; swipe e match non si tagliano.
- **Connessione:** in viaggio servirà internet per foto e video, quindi serve una eSIM.

## Decisioni aperte

- Nome definitivo (Wanderswipe o Let Me Wonder) e dominio.
- Quando parlare con le agenzie.
- Regola del match per i gruppi (tutti sì? maggioranza?).

## Da ricordare per il piano tecnico

Il piano tecnico (PDF del 26 ottobre) va aggiornato dopo questo brief. Punti emersi nell'analisi:

- Su iPhone una PWA non compare nel menu Condividi. Per i link social servono l'incolla o un Comando Rapido iOS.
- Il login con link via email non funziona nella PWA installata. Meglio il codice OTP.
- I budget Google mandano solo avvisi. Il tetto vero sono le quote giornaliere per API.
- Rating e orari fanno pagare la chiamata Places a tariffa Enterprise. Bisogna chiedere solo i campi necessari.
