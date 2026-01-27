# VM Update Workflow

## ⚠️ Belangrijk: VM gebruikt wat in Git staat

De VM haalt code uit de Git repository. Als je lokale wijzigingen hebt, moet je deze eerst pushen voordat de VM ze kan gebruiken.

## Stappen om nieuwe versies op VM te krijgen

### 1. Lokaal (op je MacBook)

#### A) Controleer je wijzigingen
```bash
git status
```

#### B) Commit je wijzigingen
```bash
git add .
git commit -m "Update frontend"
```

#### C) Push naar repository
```bash
git push origin main
# of
git push origin master
```

### 2. Op de VM

#### A) Verbind met VM
```bash
ssh itproj@10.2.160.225
cd ~/TestingDemo
```

#### B) Haal nieuwste versie op
```bash
# Stop eerst draaiende services (Ctrl+C)
git pull origin main
# of
git pull origin master
```

#### C) Installeer nieuwe dependencies (als nodig)
```bash
npm install
cd frontend && npm install && cd ..
```

#### D) Herstart services
```bash
# Terminal 1: API
npm run start:api

# Terminal 2: Frontend (nieuwe SSH sessie)
ssh itproj@10.2.160.225
cd ~/TestingDemo
npm run start:frontend
```

## ⚠️ Merge Conflicts

Als jij en je vrienden tegelijk aan dezelfde bestanden werken, kunnen er merge conflicts ontstaan.

### Op VM bij conflict:
```bash
git pull origin main
# Als er conflicts zijn:
git status  # Zie welke bestanden conflicteren
# Los conflicts handmatig op, dan:
git add .
git commit -m "Resolve merge conflicts"
```

## Beste Workflow

1. **Voordat je begint te werken:**
   ```bash
   git pull origin main  # Haal laatste versie op
   ```

2. **Werk aan je code**

3. **Voordat je pusht:**
   ```bash
   git pull origin main  # Haal eventuele nieuwe wijzigingen op
   # Los eventuele conflicts op
   git add .
   git commit -m "Jouw wijzigingen"
   git push origin main
   ```

4. **Op VM:**
   ```bash
   git pull origin main
   npm install  # Als package.json gewijzigd is
   # Herstart services
   ```

## Snelle Check

### Lokaal - zie laatste commit
```bash
git log --oneline -5
```

### Op VM - zie laatste commit
```bash
cd ~/TestingDemo
git log --oneline -5
```

Als de commits verschillen, moet je `git pull` doen op de VM.
