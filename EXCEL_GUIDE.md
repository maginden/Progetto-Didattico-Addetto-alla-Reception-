# Guida Tecnica Excel - Gestionale Hotel "Da Pippino"

Questa guida contiene tutte le istruzioni tecniche per replicare le funzionalità dell'applicazione "Da Pippino" all'interno di un vero foglio di calcolo Microsoft Excel o Google Sheets.

---

## 1. Struttura del File
Crea tre fogli di lavoro separati:
1. **Tableau**: Per la visualizzazione grafica delle camere.
2. **Registro**: Per l'inserimento dei dati dei clienti.
3. **Calcolatrice**: Per il calcolo rapido dei check-out.

---

## 2. Foglio "Tableau" (La Griglia)

### Formattazione Condizionale
Per far sì che le celle cambino colore in base allo stato inserito:
1. Seleziona l'area delle camere (es. `B2:H6`).
2. Vai su **Home > Formattazione Condizionale > Nuova Regola**.
3. Scegli **Formatta solo le celle che contengono**.
4. Imposta:
   - Testo specifico -> Contenente -> **"Libera"**: Formato Riempimento **Verde**.
   - Testo specifico -> Contenente -> **"Prenotata"**: Formato Riempimento **Blu**.
   - Testo specifico -> Contenente -> **"Occupata"**: Formato Riempimento **Rosso**.
   - Testo specifico -> Contenente -> **"Pulizia"**: Formato Riempimento **Giallo**.
   - Testo specifico -> Contenente -> **"Manutenzione"**: Formato Riempimento **Grigio**.

### Calendario Dinamico
Nella prima cella della data (es. `B1`):
- Inserisci la formula: `=OGGI()` (Excel in italiano) o `=TODAY()` (inglese).
Nelle celle successive (`C1`, `D1`, ecc.):
- Inserisci: `=B1+1`, `=C1+1`, e così via.

---

## 3. Foglio "Registro" (Database)

### Convalida Dati (Menu a tendina)
Per evitare errori nell'inserimento del numero di camera:
1. Seleziona le celle della colonna "Camera".
2. Vai su **Dati > Convalida Dati**.
3. In "Consenti", scegli **Elenco**.
4. In "Origine", scrivi: `101;102;103;104;105`.

### Ricerca Avanzata (Filtro)
Se usi Excel 365, puoi creare una barra di ricerca dinamica:
- Formula: `=FILTRA(A2:D100; VAL.NUMERO(RICERCA(H1; B2:B100)); "Nessun risultato")`
*(Dove H1 è la cella dove scrivi il nome da cercare).*

---

## 4. Foglio "Calcolatrice" (Check-out)

### Formule di Calcolo
Per calcolare il totale del soggiorno:
- **Cella A2**: Numero di Notti
- **Cella B2**: Tariffa Giornaliera (es. 80)
- **Cella C2**: Extra (Bar, Mini-frigo)
- **Formula Totale**: `=(A2*B2)+C2`

### Statistiche (Dashboard)
Per contare quante camere sono occupate oggi nel Tableau:
- Formula: `=CONTA.SE(Tableau!B2:B6; "Occupata")`

---

## 5. Consigli di Stile (Look & Feel)
Per rendere il foglio professionale come l'app:
- **Font**: Usa "Inter" o "Segoe UI".
- **Bordi**: Usa bordi sottili grigio chiaro (`#E2E8F0`).
- **Colori**:
  - Sfondi: Bianco o Grigio chiarissimo (`#F8FAFC`).
  - Intestazioni: Blu scuro (`#1E293B`) con testo bianco.
- **Allineamento**: Centra verticalmente e orizzontalmente i testi nelle celle del Tableau.
