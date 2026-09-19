# ⏱️ WorkTracker — Pointeuse PWA

**WorkTracker** est une application web progressive (PWA) de suivi du temps de travail, pensée pour une utilisation mobile rapide et sans friction. Enregistre tes heures, calcule ton salaire automatiquement et garde un historique complet de tes journées, directement depuis ton téléphone.

🔗 **Accéder à l'app** : [https://worktracker-two.vercel.app](https://worktracker-two.vercel.app)

![Deployed on Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black?logo=vercel&logoColor=white)
![Made with React](https://img.shields.io/badge/made%20with-React-61DAFB?logo=react&logoColor=white)

---

## 📱 Aperçu des 4 onglets

| Onglet | Description |
|---|---|
| 📆 **Calendrier** | Saisie manuelle des heures de travail (arrivée, départ, pause) avec commande vocale intégrée pour dicter une journée en une phrase. |
| 📊 **Stats** | Statistiques agrégées par semaine, mois ou période personnalisée, avec calcul automatique du salaire estimé selon le taux horaire. |
| 📋 **Historique** | Liste chronologique de toutes les sessions enregistrées, avec durée et temps de pause pour chaque journée. |
| 💾 **Sauvegarde** | Export et import des données au format JSON, gestion du thème clair/sombre et informations sur la commande vocale. |

---

## ✨ Fonctionnalités principales

- 📝 **Saisie manuelle des heures** avec gestion des pauses (en minutes)
- 🎤 **Commande vocale** — dis simplement *"aujourd'hui de 8h15 à 16h49"* ou *"lundi 3 juin de 6h à 18h50"* pour ajouter une entrée (100 % reconnaissance vocale native, aucune donnée envoyée à un service externe)
- 📊 **Statistiques** par semaine, mois ou période personnalisée
- 💰 **Calcul automatique du salaire** selon ton taux horaire
- 💾 **Sauvegarde et restauration** des données via export/import de fichier JSON
- 🌗 **Thème clair / sombre** au choix

---

## 📲 Installation sur mobile

### 🍏 iPhone (Safari)

1. Ouvre [https://worktracker-two.vercel.app](https://worktracker-two.vercel.app) dans **Safari**
2. Appuie sur l'icône **Partage** (le carré avec une flèche vers le haut) 🔗
3. Sélectionne **Sur l'écran d'accueil** ➕
4. Confirme en appuyant sur **Ajouter**

L'application apparaît alors comme une app native sur ton écran d'accueil. 🎉

### 🤖 Android (Chrome)

1. Ouvre [https://worktracker-two.vercel.app](https://worktracker-two.vercel.app) dans **Chrome**
2. Appuie sur le menu **⋮** (les 3 points en haut à droite)
3. Sélectionne **Ajouter à l'écran d'accueil**
4. Confirme l'ajout

L'application s'installe comme une app classique, avec son icône dédiée. 🎉

---

## 🛠️ Stack technique

- ⚛️ **React** — interface utilisateur
- ⚡ **Vite** — build tool et serveur de développement
- 📱 **PWA** (Progressive Web App) — installable, utilisable hors ligne
- ▲ **Vercel** — hébergement et déploiement continu

---

## 🚀 Développement local

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Build de production
npm run build
```
