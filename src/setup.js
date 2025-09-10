import inquirer from 'inquirer';
import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { validateConfig } from './config.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const setupLogger = {
  log: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      process.stderr.write(`[SETUP SCRIPT DEBUG] ${args.join(' ')}\n`);
    }
  },
  error: (...args) => {
    process.stderr.write(`[SETUP SCRIPT ERROR] ${args.join(' ')}\n`);
  }
};

async function main() {
  setupLogger.log(chalk.blue.bold('🚀 Configuration du serveur MCP Facturation.PRO\n'));

  const questions = [
    {
      type: 'input',
      name: 'FACTURATION_API_ID',
      message: 'Entrez votre FACTURATION_API_ID:',
      default: process.env.FACTURATION_API_ID || '',
    },
    {
      type: 'input',
      name: 'FACTURATION_API_KEY',
      message: 'Entrez votre FACTURATION_API_KEY:',
      default: process.env.FACTURATION_API_KEY || '',
    },
    {
      type: 'input',
      name: 'FACTURATION_FIRM_ID',
      message: 'Entrez votre FACTURATION_FIRM_ID:',
      default: process.env.FACTURATION_FIRM_ID || '',
    },
    {
      type: 'confirm',
      name: 'CONFIRM_SAVE',
      message: 'Sauvegarder ces configurations dans le fichier .env ?',
      default: true,
    },
  ];

  const answers = await inquirer.prompt(questions);

  if (answers.CONFIRM_SAVE) {
    const envContent = Object.keys(answers)
      .filter((key) => key !== 'CONFIRM_SAVE')
      .map((key) => `${key}=${answers[key]}`)
      .join('\n');

    const envPath = join(__dirname, '..', '.env');
    await fs.writeFile(envPath, envContent, 'utf8');
    
    // Créer le dossier data/ si inexistant
    const dataDir = join(__dirname, '..', 'data');
    await fs.mkdir(dataDir, { recursive: true });

    try {
      validateConfig();
      setupLogger.log(chalk.green.bold('\n✅ Configuration terminée !'));
      setupLogger.log(chalk.green('📁 Fichier .env créé avec vos paramètres'));
      setupLogger.log(chalk.green('📊 Répertoire data/ créé pour la base SQLite'));

      setupLogger.log(chalk.blue('\n📋 Prochaines étapes :'));
      setupLogger.log(chalk.white('1. npm install          # Installer les dépendances'));
      setupLogger.log(chalk.white('2. npm run sync         # Première synchronisation'));
      setupLogger.log(chalk.white('3. npm start            # Démarrer le serveur MCP'));

    } catch (error) {
      setupLogger.error(chalk.red.bold('❌ Erreur lors de la configuration :'));
      setupLogger.error(chalk.red(error.message));
      process.exit(1);
    }
  } else {
    setupLogger.log(chalk.yellow('Configuration annulée.'));
  }
}

main();
