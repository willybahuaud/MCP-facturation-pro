import { FunctionalFacturationMCPServer } from './mcp/FunctionalMCPServer.js';

// Créer et démarrer le serveur MCP
const server = new FunctionalFacturationMCPServer();

// Gérer les signaux d'arrêt
process.on('SIGINT', async () => {
  console.error('🛑 Arrêt du serveur MCP...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('🛑 Arrêt du serveur MCP...');
  await server.stop();
  process.exit(0);
});

// Démarrer le serveur
server.start().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
