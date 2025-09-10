# Facturation.PRO MCP Server

Serveur MCP (Model Context Protocol) pour intégrer vos données Facturation.PRO directement dans Cursor.

## 🚀 Installation rapide

### 1. Cloner le projet
```bash
git clone <votre-repo>
cd project-mcp-interface
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration automatique
```bash
npm run setup:global
```

Cette commande va :
- ✅ Configurer automatiquement le serveur MCP global
- ✅ Créer le wrapper dans `~/.local/bin/`
- ✅ Mettre à jour la configuration Cursor
- ✅ Synchroniser vos données Facturation.PRO

### 4. Redémarrer Cursor
Fermez et rouvrez Cursor pour que les outils MCP soient disponibles.

## 🛠️ Configuration manuelle

Si l'installation automatique ne fonctionne pas :

### 1. Configurer les variables d'environnement
```bash
cp env.example .env
```

Éditez `.env` avec vos informations Facturation.PRO :
```env
FACTURATION_API_ID=votre_api_id
FACTURATION_API_KEY=votre_api_key
FACTURATION_FIRM_ID=votre_firm_id
```

### 2. Synchroniser les données
```bash
npm run sync
```

### 3. Installer le serveur MCP global
```bash
npm run install:global
```

### 4. Configurer Cursor
Ajoutez dans `~/.cursor/mcp.json` :
```json
{
  "mcpServers": {
    "facturation-pro": {
      "command": "/Users/{mon_user}/.local/bin/facturation-pro-mcp-wrapper"
    }
  }
}
```

## 📋 Scripts disponibles

- `npm start` - Démarrer le serveur MCP local
- `npm run sync` - Synchroniser les données depuis l'API
- `npm run setup:global` - Installation complète automatique
- `npm run install:global` - Installer le serveur MCP global uniquement
- `npm run uninstall:global` - Désinstaller le serveur MCP global

## 🎯 Outils MCP disponibles

Une fois configuré, vous aurez accès à ces outils dans Cursor :

### 1. **search_quotes** - Recherche de devis
- Recherche par numéro, client, description
- Filtres par statut, dates
- Exemple : "Recherche mes 5 plus gros devis"

### 2. **search_invoices** - Recherche de factures
- Recherche par numéro, client, description
- Filtres par statut, mode de paiement, dates
- Exemple : "Trouve toutes les factures non payées"

### 3. **analyze_pricing** - Analyse des tarifs
- Statistiques de facturation
- Moyennes par produit/client
- Exemple : "Analyse les tarifs de mes produits"

### 4. **get_similar_projects** - Projets similaires
- Recherche par mots-clés
- Filtres par montant
- Exemple : "Trouve des projets similaires à 'développement web'"

### 5. **calculate_revenue** - Calcul des revenus (encaissés/facturés)
- Calcule les montants encaissés (HT/TTC/TVA) par année/période.
- Fournit une ventilation mois par mois (`monthly_breakdown`).
- Filtre par date de paiement (encaissé réel) par défaut.
- Exemple : "Combien ai-je encaissé (en HT) depuis le 1er janvier 2025 ?"

### 6. **analyze_project_brief** - Analyse de brief projet
- Analyse un brief et extrait les caractéristiques clés.
- Exemple : "Analyse ce brief : 'Création d'un site e-commerce avec intégration Stripe et gestion de stock.'"

### 7. **find_similar_projects_advanced** - Projets similaires (avancé)
- Recherche de projets similaires basée sur l'analyse d'un brief.
- Filtres avancés (montant min/max, type de projet).
- Exemple : "Trouve des projets similaires à ce brief pour un site web : 'Refonte d'un site vitrine avec blog intégré.'"

### 8. **estimate_project_cost** - Estimation de coût projet
- Aide à l'estimation du coût d'un projet en trouvant des projets similaires.
- Exemple : "Estime le coût d'un projet de développement d'application mobile."

### 9. **calculate_quotes_revenue** - Calcul des montants de devis
- Calcule les montants (HT/TTC/TVA) des devis par année/période.
- Filtre par statut (acceptés, en attente, refusés).
- Exemple : "Quel est le montant total de mes devis acceptés en 2024 ?"

### 10. **ventiler_encaissements** - Ventilation mensuelle des encaissements
- Ventile les encaissements (HT/TTC/TVA) par mois pour une année donnée.
- Se base sur la date de paiement (encaissé réel).
- Exemple : "Ventile-moi les encaissements de 2024, mois par mois."

### 11. **encaissements_periode** - Encaissements sur une période
- Calcule l'encaissé (HT/TTC/TVA) sur une période précise (date à date).
- Exemple : "Combien ai-je encaissé entre le 01/03/2024 et le 30/06/2024 ?"

## 🔧 Dépannage

### Le serveur MCP ne s'affiche pas dans Cursor
1. Vérifiez que `~/.cursor/mcp.json` existe et contient la bonne configuration
2. Redémarrez complètement Cursor
3. Vérifiez les logs dans la console de développement de Cursor

### Erreur de synchronisation
1. Vérifiez vos identifiants API dans `.env`
2. Testez la connexion : `npm run test:connection`
3. Relancez la synchronisation : `npm run sync`

### Le serveur ne répond pas
1. Vérifiez que le wrapper est installé : `ls -la ~/.local/bin/facturation-pro-mcp-wrapper`
2. Testez manuellement : `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | ~/.local/bin/facturation-pro-mcp-wrapper`

## 📁 Structure du projet

```
project-mcp-interface/
├── src/
│   ├── api/                 # Client API Facturation.PRO
│   ├── database/            # Gestion base de données SQLite
│   ├── mcp/                 # Serveur MCP et outils
│   └── sync/                # Service de synchronisation
├── data/
│   └── facturation.db       # Base de données locale
├── scripts/
│   └── install-global.js    # Script d'installation globale
└── README.md
```

## 🔐 Sécurité

- Les clés API sont stockées dans `.env` (ne pas commiter)
- La base de données est locale (pas de données envoyées à des tiers)
- Communication sécurisée avec l'API Facturation.PRO

## 📞 Support

En cas de problème :
1. Vérifiez les logs de synchronisation
2. Testez la connexion API
3. Consultez la documentation Facturation.PRO : https://facturation.dev/llm

## 🎉 Utilisation

Une fois configuré, utilisez simplement des commandes naturelles dans Cursor :
- "Recherche mes 5 plus gros devis"
- "Trouve tous les devis de tel client"
- "Analyse les tarifs de mes produits"
- "Factures non payées ce mois"
- "Combien ai-je encaissé (en HT) depuis le 1er janvier 2025 ?"
- "Ventile-moi les encaissements de 2024, mois par mois"
- "Estime le coût d'un projet de développement d'application mobile"