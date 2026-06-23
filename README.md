# Plan Badminton — Nicolas

Application web de suivi d'entraînement badminton avec accès coach/athlète.
**Données partagées en temps réel via Supabase.**

## Accès

| Rôle | PIN par défaut |
|------|---------------|
| 🏸 Athlète (Nicolas) | `1234` |
| 🎯 Coach | `9999` |

> Les PIN sont modifiables dans l'onglet **Réglages** (accès coach uniquement).
> Les PIN sont stockés hashés (SHA-256) dans Supabase — jamais en clair.

## Architecture

```
GitHub Pages  ←→  app.js  ←→  Supabase (base de données)
```

- **GitHub Pages** : héberge les fichiers statiques (index.html, app.js)
- **Supabase** : stocke toutes les données (séances, poids, messages, plan)
- **Partage en temps réel** : Nicolas et le coach voient les mêmes données,
  quel que soit l'appareil ou le navigateur utilisé

## Déploiement GitHub Pages

### 1. Créer un repo GitHub public

```
Nom suggéré : badminton-nicolas
Visibilité : Public (requis pour GitHub Pages gratuit)
```

### 2. Uploader les 4 fichiers

Via l'interface GitHub (glisser-déposer) :
```
index.html
app.js
manifest.json
README.md
```

### 3. Activer GitHub Pages

**Settings** → **Pages** → Branch: `main` / Folder: `/ (root)` → **Save**

URL de l'app :
```
https://TON-USERNAME.github.io/badminton-nicolas/
```

## Mise à jour du plan

Pour modifier les séances planifiées, ouvrir `app.js` et modifier l'objet `BASE_PLAN`.

```bash
git add app.js
git commit -m "Mise à jour plan semaine X"
git push origin main
```

## Structure

```
badminton-nicolas/
├── index.html     — HTML + CSS
├── app.js         — Logique JS + connexion Supabase
├── manifest.json  — PWA
└── README.md
```
