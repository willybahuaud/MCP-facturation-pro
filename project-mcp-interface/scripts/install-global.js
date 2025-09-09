#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log(chalk.blue.bold('🚀 Installation du serveur MCP Facturation.PRO global\n'));

try {
  // 1. Créer le répertoire ~/.local/bin s'il n'existe pas
  const localBinDir = join(process.env.HOME, '.local', 'bin');
  if (!existsSync(localBinDir)) {
    console.log(chalk.blue('📁 Création du répertoire ~/.local/bin...'));
    mkdirSync(localBinDir, { recursive: true });
  }

  // 2. Créer le wrapper global
  console.log(chalk.blue('📝 Création du wrapper global...'));
  const wrapperContent = `#!/bin/bash
# Wrapper pour le serveur MCP Facturation.PRO
# Ce script peut être appelé depuis n'importe où

# Chemin vers le projet MCP
MCP_PROJECT_DIR="${projectRoot}"

# Vérifier que le projet existe
if [ ! -d "$MCP_PROJECT_DIR" ]; then
    echo "❌ Erreur: Projet MCP non trouvé à $MCP_PROJECT_DIR" >&2
    exit 1
fi

# Aller dans le répertoire du projet
cd "$MCP_PROJECT_DIR"

# Lancer le serveur MCP
exec node src/functional-index.js
`;

  const wrapperPath = join(localBinDir, 'facturation-pro-mcp-wrapper');
  writeFileSync(wrapperPath, wrapperContent);
  
  // Rendre le script exécutable
  execSync(`chmod +x "${wrapperPath}"`, { stdio: 'inherit' });
  console.log(chalk.green('✅ Wrapper créé et rendu exécutable'));

  // 3. Créer ou mettre à jour la configuration Cursor
  console.log(chalk.blue('⚙️  Configuration de Cursor...'));
  const cursorDir = join(process.env.HOME, '.cursor');
  if (!existsSync(cursorDir)) {
    mkdirSync(cursorDir, { recursive: true });
  }

  const mcpConfigPath = join(cursorDir, 'mcp.json');
  let mcpConfig = {};

  // Lire la configuration existante si elle existe
  if (existsSync(mcpConfigPath)) {
    try {
      const existingConfig = readFileSync(mcpConfigPath, 'utf8');
      mcpConfig = JSON.parse(existingConfig);
    } catch (error) {
      console.log(chalk.yellow('⚠️  Configuration Cursor existante invalide, création d\'une nouvelle'));
    }
  }

  // Ajouter ou mettre à jour la configuration facturation-pro
  if (!mcpConfig.mcpServers) {
    mcpConfig.mcpServers = {};
  }

  mcpConfig.mcpServers['facturation-pro'] = {
    command: wrapperPath
  };

  // Sauvegarder la configuration
  writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  console.log(chalk.green('✅ Configuration Cursor mise à jour'));

  // 4. Synchroniser les données
  console.log(chalk.blue('🔄 Synchronisation des données...'));
  try {
    execSync('npm run sync', { 
      cwd: projectRoot, 
      stdio: 'inherit' 
    });
    console.log(chalk.green('✅ Données synchronisées'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Erreur lors de la synchronisation, vous pourrez la relancer avec: npm run sync'));
  }

  // 5. Résumé
  console.log(chalk.green.bold('\n🎉 Installation terminée avec succès !'));
  console.log(chalk.white('\n📋 Prochaines étapes :'));
  console.log(chalk.white('1. Redémarrez complètement Cursor'));
  console.log(chalk.white('2. Ouvrez n\'importe quel projet'));
  console.log(chalk.white('3. Vérifiez que "facturation-pro" apparaît dans les paramètres MCP'));
  console.log(chalk.white('4. Utilisez des commandes comme "Recherche mes 5 plus gros devis"'));
  
  console.log(chalk.blue('\n🔧 Configuration sauvegardée dans :'));
  console.log(chalk.gray(`   ${mcpConfigPath}`));
  console.log(chalk.blue('📦 Wrapper installé dans :'));
  console.log(chalk.gray(`   ${wrapperPath}`));

} catch (error) {
  console.error(chalk.red.bold('\n❌ Erreur lors de l\'installation :'));
  console.error(chalk.red(error.message));
  process.exit(1);
}
