#!/usr/bin/env node

import { SyncService } from './sync/SyncService.js';
import { validateConfig } from './config.js';
import chalk from 'chalk';

async function main() {
  try {
    console.log(chalk.blue.bold('🚀 Synchronisation Facturation.PRO MCP\n'));

    // Valider la configuration
    validateConfig();

    // Créer et initialiser le service de synchronisation
    const syncService = new SyncService();
    await syncService.initialize();

    // Lancer la synchronisation
    await syncService.syncAll(true);

    // Fermer les connexions
    await syncService.close();

    console.log(chalk.green.bold('\n🎉 Synchronisation terminée avec succès !'));

  } catch (error) {
    console.error(chalk.red.bold('\n❌ Erreur lors de la synchronisation:'));
    console.error(chalk.red(error.message));
    
    if (error.message.includes('Configuration invalide')) {
      console.log(chalk.yellow('\n💡 Pour configurer vos jetons API, exécutez:'));
      console.log(chalk.white('npm run setup'));
    }
    
    process.exit(1);
  }
}

main();
