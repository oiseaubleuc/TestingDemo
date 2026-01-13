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

## 8. Docker & Containerisatie

### 8.1 Docker Setup

Het project is volledig gecontaineriseerd met Docker en Docker Compose voor eenvoudige lokale ontwikkeling en deployment.

#### Vereisten
- Docker Engine 20.10+
- Docker Compose 2.0+

#### Quick Start met Docker Compose

1. **Kopieer environment variabelen:**
   ```bash
   cp docker-compose.env.example .env
   ```

2. **Vul de `.env` file in** met je Salesforce credentials en andere configuratie.

3. **Start alle services:**
   ```bash
   docker-compose up -d
   ```

4. **Bekijk de logs:**
   ```bash
   # Alle services
   docker-compose logs -f
   
   # Specifieke service
   docker-compose logs -f api
   docker-compose logs -f consumer
   ```

5. **Stop alle services:**
   ```bash
   docker-compose down
   ```

#### Beschikbare Services

| Service | Port | Beschrijving |
|---------|------|--------------|
| `api` | 3000 | Backend API server |
| `frontend` | 5173 | React frontend (Nginx) |
| `consumer` | - | RabbitMQ consumer worker |
| `rabbitmq` | 5672, 15672 | RabbitMQ server + Management UI |

#### Docker Images Bouwen

**Backend:**
```bash
docker build -f Dockerfile.backend -t rabbitmq-salesforce-backend .
```

**Frontend:**
```bash
docker build -f Dockerfile.frontend -t rabbitmq-salesforce-frontend .
```

**Consumer:**
```bash
docker build -f Dockerfile.consumer -t rabbitmq-salesforce-consumer .
```

#### Individuele Services Starten

```bash
# Alleen RabbitMQ
docker-compose up -d rabbitmq

# Alleen API
docker-compose up -d api

# Alleen Consumer
docker-compose up -d consumer

# Alleen Frontend
docker-compose up -d frontend
```

#### Health Checks

Alle services hebben health checks geconfigureerd:

```bash
# Check service status
docker-compose ps

# Test API health
curl http://localhost:3000/health

# Test RabbitMQ Management UI
curl http://localhost:15672
```

#### Volumes & Data Persistentie

- `rabbitmq_data`: RabbitMQ data persistentie
- `./logs`: Log bestanden (gedeeld met host)
- `./data`: Data bestanden (gedeeld met host)

#### Docker Compose Commands

```bash
# Rebuild images
docker-compose build --no-cache

# Restart specifieke service
docker-compose restart api

# View logs
docker-compose logs -f consumer

# Execute command in container
docker-compose exec api sh

# Stop en verwijder volumes
docker-compose down -v
```

---

## 9. CI/CD Pipeline

### 9.1 GitHub Actions Workflow

Het project heeft een volledige CI/CD pipeline geconfigureerd in `.github/workflows/ci.yml`.

#### Pipeline Stages

1. **Lint & Test**
   - TypeScript type checking
   - ESLint voor backend en frontend
   - Unit tests met Jest
   - Build verificatie

2. **Docker Build**
   - Build van 3 Docker images:
     - `backend`
     - `frontend`
     - `consumer`
   - Push naar GitHub Container Registry (ghcr.io)
   - Multi-platform support (linux/amd64)

3. **Docker Compose Test**
   - Volledige stack test met docker-compose
   - Health check verificatie
   - Service integratie tests

#### Docker Images in Registry

Images worden automatisch gepusht naar:
```
ghcr.io/<username>/<repository>-backend:latest
ghcr.io/<username>/<repository>-frontend:latest
ghcr.io/<username>/<repository>-consumer:latest
```

#### Pipeline Triggers

- Push naar `main` of `develop` branches
- Pull requests naar `main` of `develop`
- Automatische builds bij elke commit

#### Lokale CI/CD Testen

```bash
# Test de pipeline lokaal (met act)
act push

# Of test specifieke job
act -j lint-and-test
```

---

## 10. Development Workflow

### 10.1 Lokale Ontwikkeling (Zonder Docker)

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Start RabbitMQ (lokaal of via Docker)
docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Start API
npm run start:api

# Start Consumer (in aparte terminal)
npm run start:consumer

# Start Frontend (in aparte terminal)
npm run start:frontend
```

### 10.2 Lokale Ontwikkeling (Met Docker)

```bash
# Start alleen RabbitMQ
docker-compose up -d rabbitmq

# Start API lokaal (met lokale RabbitMQ)
npm run start:api

# Of start alles met Docker
docker-compose up
```

---

## 11. Deployment

### 11.1 Productie Deployment

1. **Pull Docker images:**
   ```bash
   docker pull ghcr.io/<username>/<repository>-backend:latest
   docker pull ghcr.io/<username>/<repository>-frontend:latest
   docker pull ghcr.io/<username>/<repository>-consumer:latest
   ```

2. **Configureer environment:**
   ```bash
   cp docker-compose.env.example .env
   # Vul productie waarden in
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

### 11.2 Kubernetes Deployment (Optioneel)

Docker images kunnen ook gebruikt worden in Kubernetes. Zie `k8s/` directory voor voorbeelden (indien beschikbaar).

---

## 12. Mogelijke volgende stappen
- Herwerken van Salesforce OAuth-flow (Authorization Code of JWT)
- Activeren van Salesforce-verwerking in de consumer
- Kubernetes deployment configuratie
- Monitoring en observability (Prometheus, Grafana)

---

## 13. Conclusie
Dit Proof of Concept toont aan dat:
- RabbitMQ correct is opgezet en functioneert
- Asynchrone communicatie betrouwbaar verloopt
- Het systeem robuust omgaat met externe API-fouten
- Volledige containerisatie met Docker
- CI/CD pipeline voor geautomatiseerde builds en tests

De basis voor een productieklare integratie is gelegd.
