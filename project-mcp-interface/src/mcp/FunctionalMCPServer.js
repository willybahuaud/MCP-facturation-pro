import Database from '../database/index.js';
import { SearchQuotesTool } from './tools/SearchQuotesTool.js';
import { SearchInvoicesTool } from './tools/SearchInvoicesTool.js';
import { AnalyzePricingTool } from './tools/AnalyzePricingTool.js';
import { GetSimilarProjectsTool } from './tools/GetSimilarProjectsTool.js';
import { CalculateRevenueTool } from './tools/CalculateRevenueTool.js';
import { config } from '../config.js';

/**
 * Serveur MCP fonctionnel pour Facturation.PRO
 * Utilise une approche manuelle pour gérer le protocole MCP
 */
export class FunctionalFacturationMCPServer {
  constructor() {
    this.database = new Database();
    this.tools = new Map();
    this.setupTools();
  }

  /**
   * Configure les outils disponibles
   */
  setupTools() {
    const tools = [
      new SearchQuotesTool(),
      new SearchInvoicesTool(),
      new AnalyzePricingTool(),
      new GetSimilarProjectsTool(),
      new CalculateRevenueTool()
    ];

    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  /**
   * Traite une requête MCP
   */
  async handleRequest(request) {
    try {
      if (request.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: config.mcp.serverName,
              version: '1.0.0',
            },
          },
        };
      }

      if (request.method === 'tools/list') {
        const toolsList = Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: tool.parameters || {},
            required: Object.keys(tool.parameters || {}).filter(
              key => tool.parameters[key].required
            ),
          },
        }));

        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: toolsList,
          },
        };
      }

      if (request.method === 'tools/call') {
        const { name, arguments: args } = request.params;
        
        if (!this.tools.has(name)) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Outil inconnu: ${name}`,
            },
          };
        }

        const tool = this.tools.get(name);
        
        try {
          const result = await tool.execute(args, this.database);
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            },
          };
        } catch (error) {
          console.error(`Erreur lors de l'exécution de l'outil ${name}:`, error);
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                  }, null, 2),
                },
              ],
            },
          };
        }
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: 'Méthode non trouvée',
        },
      };
    } catch (error) {
      console.error('❌ Erreur lors du traitement de la requête:', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32600,
          message: 'Erreur interne du serveur',
        },
      };
    }
  }

  /**
   * Démarre le serveur MCP
   */
  async start() {
    try {
      // Initialiser la base de données
      await this.database.connect();
      await this.database.initialize();

      console.error('🚀 Serveur MCP Facturation.PRO démarré');
      console.error('📊 Base de données initialisée');
      console.error('🛠️  Outils disponibles:', Array.from(this.tools.keys()).join(', '));

      // Gérer les requêtes stdin
      process.stdin.on('data', async (data) => {
        const input = data.toString().trim();
        
        try {
          const request = JSON.parse(input);
          const response = await this.handleRequest(request);
          console.log(JSON.stringify(response));
        } catch (error) {
          console.error('❌ Erreur parsing:', error.message);
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors du démarrage du serveur MCP:', error);
      process.exit(1);
    }
  }

  /**
   * Arrête le serveur MCP
   */
  async stop() {
    try {
      await this.database.close();
      console.error('🛑 Serveur MCP arrêté');
    } catch (error) {
      console.error('❌ Erreur lors de l\'arrêt du serveur:', error);
    }
  }
}
