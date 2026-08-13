# SQL Trainer (web)

Entraînement SQL façon LeetCode. Site 100% statique : SQLite tourne directement
dans le navigateur via [sql.js](https://github.com/sql-js/sql.js) (WebAssembly).
Aucun backend, aucune donnée envoyée nulle part.

## Lancer en local

Un simple `fetch()` de fichiers locaux (`data/*.json`, `data/*.sql`) ne fonctionne
pas en ouvrant `index.html` directement (`file://`) à cause des restrictions CORS
du navigateur. Il faut le servir via un petit serveur HTTP local :

```bash
cd sql-trainer-web
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

(N'importe quel serveur statique fonctionne : `npx serve`, l'extension VS Code
"Live Server", etc.)

## Modifier les exercices

Tout se passe dans **`data/exercises.json`**. Chaque exercice est un objet :

```json
{
  "id": "select-01",
  "category": "1. SELECT",
  "title": "Colonnes spécifiques",
  "difficulty": "Facile",
  "prompt": "Affiche le prénom (`first_name`) ... de tous les clients.",
  "solution": "SELECT first_name, last_name, city FROM customers;",
  "orderMatters": false,
  "hint": "SELECT col1, col2, col3 FROM table;"
}
```

- `id` : identifiant unique (sert aussi de clé pour la progression sauvegardée).
- `category` : doit correspondre à une entrée du tableau `categories` en haut du fichier.
- `difficulty` : `"Facile"`, `"Moyen"` ou `"Difficile"`.
- `prompt` : énoncé. Le texte entre backticks (`` `col` ``) s'affiche en code.
- `solution` : requête de référence utilisée pour la correction automatique.
- `orderMatters` : `true` si l'ordre des lignes retournées doit être exact
  (typiquement quand l'énoncé impose un `ORDER BY`), sinon `false`.
- `hint` : indice optionnel.

Pour ajouter un exercice, ajoute simplement un nouvel objet dans le tableau
`exercises` (et éventuellement une nouvelle catégorie dans `categories`).
Aucune recompilation n'est nécessaire : recharge juste la page.

La correction compare uniquement les **valeurs** retournées (pas les noms de
colonnes), donc les alias choisis par l'utilisateur importent peu.

## Modifier la base de données

Le schéma et les données sont dans `data/schema.sql` et `data/seed.sql` (SQL brut,
exécuté tel quel au chargement de la page). La base est volontairement "fixe" :
elle ne change pas depuis l'interface, seuls les exercices sont éditables.

## Progression

La progression (exercices résolus) et les brouillons de requêtes sont sauvegardés
dans le `localStorage` du navigateur — persistant après un rechargement de page,
propre à cet appareil/navigateur. Le bouton "Réinitialiser ma progression" efface
tout.

## Structure du projet

```
index.html          page unique
css/styles.css       design (clair/sombre automatique, responsive)
js/app.js            contrôleur principal (rendu, navigation, interactions)
js/db.js             chargement de sql.js + exécution des requêtes
js/queryGuard.js      validation (lecture seule : SELECT / WITH uniquement)
js/grading.js         comparaison résultat utilisateur vs résultat attendu
js/storage.js         persistance localStorage (progression + brouillons)
data/schema.sql       structure des tables
data/seed.sql         données
data/exercises.json   banque d'exercices (éditable)
```

## Déploiement

Le site est 100% statique (HTML/CSS/JS + fichiers de données), déployable
gratuitement sur n'importe quel hébergeur statique (GitHub Pages, Netlify,
Vercel, Cloudflare Pages...). À voir ensemble selon la préférence.
