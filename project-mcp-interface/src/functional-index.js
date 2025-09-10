import { FunctionalFacturationMCPServer } from './mcp/FunctionalMCPServer.js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement très tôt
dotenv.config({ path: join(__dirname, '..', '.env') });

// Custom logger for functional-index.js
const logger = {
  error: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      process.stderr.write(`[APP ERROR] ${args.join(' ')}\n`);
    }
  },
};

// Log de vérification de la variable MCP_DEBUG
process.stderr.write(`[DEBUG CHECK] process.env.MCP_DEBUG est: ${process.env.MCP_DEBUG}\n`);

// Créer et démarrer le serveur MCP
const server = new FunctionalFacturationMCPServer();

// Gérer les signaux d'arrêt
process.on('SIGINT', async () => {
  logger.error('Arrêt du serveur MCP...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.error('Arrêt du serveur MCP...');
  await server.stop();
  process.exit(0);
});

// Démarrer le serveur
server.start().catch(error => {
  logger.error('Erreur fatale lors du démarrage du serveur MCP:', error.message);
  process.exit(1);
});
