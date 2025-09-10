#!/usr/bin/env node

import { SyncService } from './sync/SyncService.js';
import chalk from 'chalk';
import { validateConfig } from './config.js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const syncScriptLogger = {
  log: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      process.stderr.write(`[SYNC SCRIPT DEBUG] ${args.join(' ')}\n`);
    }
  },
  error: (...args) => {
    process.stderr.write(`[SYNC SCRIPT ERROR] ${args.join(' ')}\n`);
  }
};

async function main() {
  try {
    validateConfig();
    syncScriptLogger.log(chalk.blue.bold('🚀 Synchronisation Facturation.PRO MCP\n'));
    
    const syncService = new SyncService();
    await syncService.syncAll();
    
    syncScriptLogger.log(chalk.green.bold('\n🎉 Synchronisation terminée avec succès !'));
  } catch (error) {
    syncScriptLogger.error(chalk.red.bold('\n❌ Erreur lors de la synchronisation:'));
    syncScriptLogger.error(chalk.red(error.message));
    
    if (error.message.includes('requis')) {
      syncScriptLogger.log(chalk.yellow('\n💡 Pour configurer vos jetons API, exécutez:'));
      syncScriptLogger.log(chalk.white('npm run setup'));
    }
    process.exit(1);
  }
}

main();
