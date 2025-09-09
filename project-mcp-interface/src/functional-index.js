import { FunctionalFacturationMCPServer } from './mcp/FunctionalMCPServer.js';

// Custom logger for functional-index.js
const logger = {
  error: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      console.error(...args);
    }
  },
};

// Créer et démarrer le serveur MCP
const server = new FunctionalFacturationMCPServer();

// Gérer les signaux d'arrêt
process.on('SIGINT', async () => {
  logger.error('🛑 Arrêt du serveur MCP...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.error('🛑 Arrêt du serveur MCP...');
  await server.stop();
  process.exit(0);
});

// Démarrer le serveur
server.start().catch(error => {
  logger.error('❌ Erreur fatale:', error);
  process.exit(1);
});
