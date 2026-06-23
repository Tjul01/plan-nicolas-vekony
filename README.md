# Plan Badminton — Nicolas

Application web de suivi d'entraînement badminton avec accès coach/athlète.

## Accès

| Rôle | PIN par défaut |
|------|---------------|
| 🏸 Athlète (Nicolas) | `1234` |
| 🎯 Coach | `9999` |

> Les PIN sont modifiables dans l'onglet **Réglages** (accès coach uniquement).

## Fonctionnalités

### Vue Athlète (Nicolas)
- 📅 Calendrier des séances avec statut (faite / supprimée / déplacée)
- 💪 Plan complet avec détail des exercices et points clés d'exécution
- ⚖️ Suivi du poids avec courbe et trajectoire cible
- 📋 Historique des séances (RPE + notes)
- ⚡ Analyse IA des séances récentes avec conseils personnalisés
- 📩 Réception des messages du coach

### Vue Coach
- 👁️ Vue d'ensemble des stats de Nicolas (séances, RPE moyen, poids)
- ✏️ Modification des séances (intitulé, charge, note coach)
- ➕ Ajout / suppression de séances dans le calendrier
- 📩 Envoi de messages à Nicolas (bannière à la connexion)
- ⚡ Analyse IA avec recommandations d'ajustement du plan

## Déploiement GitHub Pages

### 1. Créer un nouveau repo GitHub

```bash
# Sur GitHub : créer un repo public nommé par exemple "badminton-nicolas"
# Puis en local :
git clone https://github.com/TON-USERNAME/badminton-nicolas.git
cd badminton-nicolas
```

### 2. Copier les fichiers

Copier dans le repo :
```
index.html
app.js
manifest.json
README.md
```

### 3. Pousser sur GitHub

```bash
git add .
git commit -m "Initial deploy — Plan Badminton Nicolas"
git push origin main
```

### 4. Activer GitHub Pages

1. Aller dans **Settings** du repo
2. Section **Pages** (menu gauche)
3. Source : **Deploy from a branch**
4. Branch : **main** · Folder : **/ (root)**
5. Cliquer **Save**

L'app sera disponible sur :
```
https://TON-USERNAME.github.io/badminton-nicolas/
```

> ⚠️ Le repo doit être **public** pour GitHub Pages gratuit.

## Données

Les données sont stockées dans le **localStorage** du navigateur.
- Chaque appareil/navigateur a son propre stockage local
- Nicolas (athlète) : ouvrir l'URL et se connecter avec PIN 1234
- Coach : ouvrir la même URL et se connecter avec PIN 9999

> **Important** : les données de suivi (séances logguées, poids) sont liées au navigateur utilisé. Recommander à Nicolas d'utiliser toujours le même navigateur et d'ajouter l'app à son écran d'accueil (PWA).

## Structure des fichiers

```
badminton-nicolas/
├── index.html      — Structure HTML + styles CSS
├── app.js          — Logique JavaScript complète
├── manifest.json   — Configuration PWA
└── README.md       — Ce fichier
```

## Mise à jour du plan

Pour modifier le plan de base (ajouter des semaines, changer les séances) :
1. Ouvrir `app.js`
2. Modifier l'objet `BASE_PLAN` (dates au format `YYYY-MM-DD`)
3. Pousser les changements sur GitHub

```bash
git add app.js
git commit -m "Mise à jour du plan — semaine X"
git push origin main
```

Les modifications sont disponibles immédiatement après le déploiement GitHub Pages (délai ~1 min).
