#!/usr/bin/env node

import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

console.log(chalk.blue.bold('🗑️  Désinstallation du serveur MCP Facturation.PRO global\n'));

try {
  // 1. Supprimer le wrapper
  const wrapperPath = join(process.env.HOME, '.local', 'bin', 'facturation-pro-mcp-wrapper');
  if (existsSync(wrapperPath)) {
    unlinkSync(wrapperPath);
    console.log(chalk.green('✅ Wrapper supprimé'));
  } else {
    console.log(chalk.yellow('⚠️  Wrapper non trouvé'));
  }

  // 2. Mettre à jour la configuration Cursor
  const mcpConfigPath = join(process.env.HOME, '.cursor', 'mcp.json');
  if (existsSync(mcpConfigPath)) {
    try {
      const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
      
      if (mcpConfig.mcpServers && mcpConfig.mcpServers['facturation-pro']) {
        delete mcpConfig.mcpServers['facturation-pro'];
        
        // Si plus de serveurs, supprimer la clé mcpServers
        if (Object.keys(mcpConfig.mcpServers).length === 0) {
          delete mcpConfig.mcpServers;
        }
        
        writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
        console.log(chalk.green('✅ Configuration Cursor mise à jour'));
      } else {
        console.log(chalk.yellow('⚠️  Configuration facturation-pro non trouvée'));
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Erreur lors de la lecture de la configuration Cursor'));
    }
  } else {
    console.log(chalk.yellow('⚠️  Configuration Cursor non trouvée'));
  }

  console.log(chalk.green.bold('\n✅ Désinstallation terminée !'));
  console.log(chalk.white('\n📋 N\'oubliez pas de :'));
  console.log(chalk.white('1. Redémarrer Cursor'));
  console.log(chalk.white('2. Vérifier que "facturation-pro" n\'apparaît plus dans les paramètres MCP'));

} catch (error) {
  console.error(chalk.red.bold('\n❌ Erreur lors de la désinstallation :'));
  console.error(chalk.red(error.message));
  process.exit(1);
}
