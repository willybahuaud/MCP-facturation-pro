import inquirer from 'inquirer';
import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(chalk.blue.bold('🚀 Configuration du serveur MCP Facturation.PRO\n'));

async function setup() {
  try {
    // Vérifier si .env existe déjà
    const envPath = join(__dirname, '..', '.env');
    if (existsSync(envPath)) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Un fichier .env existe déjà. Voulez-vous le remplacer ?',
        default: false
      }]);
      
      if (!overwrite) {
        console.log(chalk.yellow('Configuration annulée.'));
        return;
      }
    }

    // Collecter les informations de configuration
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiId',
        message: 'Votre identifiant API Facturation.PRO :',
        validate: (input) => input.length > 0 || 'L\'identifiant API est requis'
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'Votre clé API Facturation.PRO :',
        validate: (input) => input.length > 0 || 'La clé API est requise'
      },
      {
        type: 'input',
        name: 'firmId',
        message: 'Votre FIRM_ID :',
        validate: (input) => input.length > 0 || 'Le FIRM_ID est requis'
      },
      {
        type: 'input',
        name: 'email',
        message: 'Votre email (pour le User-Agent) :',
        default: 'willy@example.com',
        validate: (input) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(input) || 'Format d\'email invalide';
        }
      },
      {
        type: 'number',
        name: 'syncInterval',
        message: 'Intervalle de synchronisation (en minutes) :',
        default: 60,
        validate: (input) => input > 0 || 'L\'intervalle doit être positif'
      }
    ]);

    // Créer le répertoire data s'il n'existe pas
    const dataDir = join(__dirname, '..', 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Générer le contenu du fichier .env
    const envContent = `# Configuration Facturation.PRO
FACTURATION_API_ID=${answers.apiId}
FACTURATION_API_KEY=${answers.apiKey}
FACTURATION_FIRM_ID=${answers.firmId}

# Configuration de la base de données locale
DB_PATH=./data/facturation.db

# Configuration de la synchronisation (en minutes)
SYNC_INTERVAL=${answers.syncInterval}

# Configuration MCP
MCP_SERVER_NAME=facturation-pro-mcp
USER_EMAIL=${answers.email}
`;

    // Écrire le fichier .env
    writeFileSync(envPath, envContent);

    console.log(chalk.green.bold('\n✅ Configuration terminée !'));
    console.log(chalk.green('📁 Fichier .env créé avec vos paramètres'));
    console.log(chalk.green('📊 Répertoire data/ créé pour la base SQLite'));
    
    console.log(chalk.blue('\n📋 Prochaines étapes :'));
    console.log(chalk.white('1. npm install          # Installer les dépendances'));
    console.log(chalk.white('2. npm run sync         # Première synchronisation'));
    console.log(chalk.white('3. npm start            # Démarrer le serveur MCP'));

  } catch (error) {
    console.error(chalk.red.bold('❌ Erreur lors de la configuration :'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

setup();
