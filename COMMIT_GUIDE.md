# Commit Message Guide

## Automatische Commit Messages (Max 3 Woorden)

Dit project gebruikt automatische commit messages die beperkt zijn tot maximaal 3 woorden.

## Setup

Installeer de git hooks:

```bash
npm run setup:hooks
```

Of handmatig:

```bash
bash scripts/setup-git-hooks.sh
```

## Gebruik

### Automatisch Committen

Gebruik het auto-commit script om automatisch te committen met een korte message:

```bash
npm run commit
```

Of handmatig:

```bash
bash scripts/auto-commit.sh
```

Het script zal:
1. Alle wijzigingen stagen
2. Automatisch een commit message genereren (max 3 woorden)
3. De wijzigingen committen

### Handmatig Committen

Wanneer je handmatig commit, zal de git hook automatisch:
- Lege commit messages aanvullen met een korte message (max 3 woorden)
- Te lange commit messages afkorten tot 3 woorden

Voorbeelden:
- ✅ `git commit -m "Update dashboard"` → "Update dashboard"
- ✅ `git commit -m "Fix API bug"` → "Fix API bug"
- ❌ `git commit -m "Update dashboard with new features and improvements"` → "Update dashboard with" (afgekort tot 3 woorden)

## Commit Message Patronen

Het systeem genereert automatisch messages gebaseerd op gewijzigde bestanden:

- Frontend wijzigingen → "Update frontend code"
- API wijzigingen → "Update API server"
- CI/CD wijzigingen → "Update CI config"
- Dependencies → "Update dependencies"
- Documentatie → "Update documentation"

## CI/CD Pipeline

### CI Pipeline
De CI pipeline draait automatisch bij:
- Push naar `main` branch
- Pull requests naar `main`
- Manual trigger

Stappen:
1. Lint (TypeScript, ESLint)
2. Test (Jest met RabbitMQ)
3. Build (Backend + Frontend)
4. Build

### CD Pipeline
De CD pipeline draait bij:
- Push naar `main` branch
- Tags (v*)
- Manual trigger met environment selectie

Stappen:
1. Build applicatie
2. Build application
3. Deploy naar staging/production

## Workflow

1. **Werk aan code**
2. **Auto-commit**: `npm run commit`
3. **Push**: `git push`
4. **CI/CD draait automatisch**

## Troubleshooting

### Git hooks werken niet
```bash
npm run setup:hooks
```

### Commit message wordt niet afgekort
Controleer of de hook geïnstalleerd is:
```bash
ls -la .git/hooks/prepare-commit-msg
```

### Auto-commit script werkt niet
Zorg dat het script executable is:
```bash
chmod +x scripts/auto-commit.sh
```
