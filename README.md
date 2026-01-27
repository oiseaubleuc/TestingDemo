# Project Summary — RabbitMQ ↔ Salesforce Integration (POC)

## 1. Projectdoel
Het doel van dit project is het bouwen van een end-to-end integratie waarbij een applicatie orders kan versturen via RabbitMQ naar Salesforce.  
De focus ligt op asynchrone, betrouwbare communicatie tussen systemen, conform integratie-best practices.

---

## 2. Architectuuroverzicht

Producer (API / CLI)
        ↓
   RabbitMQ (Message Queue)
        ↓
Consumer (Worker)
        ↓
Salesforce (CRM – API)

Systemen communiceren niet rechtstreeks, maar via RabbitMQ om loskoppeling, fouttolerantie en schaalbaarheid te garanderen.

---

## 3. Wat is succesvol geïmplementeerd

### 3.1 RabbitMQ
- RabbitMQ is lokaal geïnstalleerd en operationeel
- RabbitMQ Management UI is bereikbaar via `http://localhost:15672`
- Queues zijn aangemaakt:
  - `orders_queue`
  - `orders_dlq`
- Berichten kunnen succesvol:
  - gepubliceerd worden
  - gebufferd worden
  - bekeken worden via de Management UI

Conclusie: RabbitMQ functioneert stabiel en correct.

---

### 3.2 Producer
- Producer kan berichten (orders) publiceren naar RabbitMQ
- Berichten verschijnen correct in `orders_queue`
- Producer is volledig losgekoppeld van Salesforce

Conclusie: asynchrone message publishing werkt correct.

---

### 3.3 Consumer (tot aan Salesforce)
- Consumer start correct op
- Verbindt succesvol met RabbitMQ
- Leest berichten uit de queue
- Probeert Salesforce-authenticatie
- Fouten worden gecontroleerd afgehandeld (geen crash, geen dataverlies)

Conclusie: de consumerlogica en foutafhandeling functioneren zoals verwacht in een integratiecontext.

---

### 3.4 Salesforce – voorbereidende configuratie
- Salesforce Developer Org aangemaakt
- Integratiegebruiker aangemaakt met profiel System Administrator
- OAuth / External Client App geconfigureerd
- Client ID en Client Secret gegenereerd
- Security Token ingesteld

Conclusie: Salesforce is voorbereid op integratieniveau.

---

## 4. Wat momenteel niet werkt

### 4.1 Salesforce API-authenticatie
- OAuth username/password flow faalt met `invalid_grant`
- Zowel `login.salesforce.com` als `test.salesforce.com` endpoints getest
- Probleem situeert zich in Salesforce OAuth policies of flowbeperkingen
- RabbitMQ en message flow blijven volledig operationeel

Belangrijk: dit betreft een externe afhankelijkheid en heeft geen impact op de werking van de queue.

---

## 5. Integratie-observatie
De kern van het project, namelijk betrouwbare en losgekoppelde communicatie via RabbitMQ, werkt volledig correct.

Salesforce wordt behandeld als een externe dependency:
- Berichten blijven veilig in de queue
- Er gaat geen data verloren
- Het systeem blijft operationeel bij externe API-fouten

Dit is het beoogde gedrag van een message queue in professionele integratieprojecten.

---

## 6. Verantwoording van keuzes
In lijn met integratie-best practices en de projectopgave:
- Componenten worden afzonderlijk getest en gedebugd
- Problemen in externe systemen blokkeren de integratielaag niet
- De focus ligt op robuustheid en betrouwbaarheid

Dit sluit aan bij de richtlijn:
“Denk als een integratie-engineer, niet als een appbouwer.”

---

## 7. Huidige projectstatus

| Component        | Status                          |
|------------------|---------------------------------|
| Producer         | Werkend                          |
| RabbitMQ         | Werkend                          |
| Consumer         | Werkend tot aan Salesforce       |
| Salesforce API   | Authenticatie in configuratie    |

---

---

## 9. CI/CD Pipeline

Het project heeft CI/CD pipelines geconfigureerd in `.github/workflows/`.

### CI Pipeline (`.github/workflows/ci.yml`)

**Pipeline Stages:**
1. **Lint** - TypeScript, ESLint checks
2. **Test** - Jest tests met RabbitMQ
3. **Build** - Backend + Frontend build
4. **Build** - Application build

**Triggers:**
- Push naar `main` branch
- Pull requests naar `main`
- Manual trigger via GitHub Actions UI

### CD Pipeline (`.github/workflows/cd.yml`)

**Pipeline Stages:**
1. **Build** - Application build
2. **Build** - Application build
3. **Deploy** - Deployment naar staging/production

**Triggers:**
- Push naar `main` branch (staging)
- Tags (v*) (production)
- Manual trigger met environment selectie

**Environments:**
- `staging` - Automatisch bij push naar main
- `production` - Via manual trigger of tags

## 10. Automatische Commit Messages

Het project gebruikt automatische commit messages beperkt tot **maximaal 3 woorden**.

### Setup

```bash
npm run setup:hooks
```

### Gebruik

**Automatisch committen:**
```bash
npm run commit
```

Dit script:
- Staged alle wijzigingen
- Genereert automatisch een korte commit message (max 3 woorden)
- Commit de wijzigingen

**Handmatig committen:**
Wanneer je handmatig commit, wordt de message automatisch afgekort tot 3 woorden als deze te lang is.

Zie `COMMIT_GUIDE.md` voor meer details.

---

## 11. Development

### Lokale Ontwikkeling

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Start API
npm run start:api

# Start Consumer
npm run start:consumer

# Start Frontend
npm run start:frontend
```

---

## 12. Mogelijke volgende stappen
- Herwerken van Salesforce OAuth-flow
- Activeren van Salesforce-verwerking in de consumer
- Monitoring en observability

---

## 13. Conclusie
Dit Proof of Concept toont aan dat:
- RabbitMQ correct is opgezet en functioneert
- Asynchrone communicatie betrouwbaar verloopt
- Het systeem robuust omgaat met externe API-fouten
- CI pipeline voor geautomatiseerde tests

De basis voor een productieklare integratie is gelegd.
