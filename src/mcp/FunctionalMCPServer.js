import Database from '../database/index.js';
import { SearchQuotesTool } from './tools/SearchQuotesTool.js';
import { SearchInvoicesTool } from './tools/SearchInvoicesTool.js';
import { AnalyzePricingTool } from './tools/AnalyzePricingTool.js';
import { GetSimilarProjectsTool } from './tools/GetSimilarProjectsTool.js';
import { CalculateRevenueTool } from './tools/CalculateRevenueTool.js';
import { AnalyzeProjectBriefTool } from './tools/AnalyzeProjectBriefTool.js';
import { FindSimilarProjectsAdvancedTool } from './tools/FindSimilarProjectsAdvancedTool.js';
import { EstimateProjectCostTool } from './tools/EstimateProjectCostTool.js';
import { config } from '../config.js';
import { createInterface } from 'readline';

// Custom logger to control console.error output
const customLogger = {
  error: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      process.stderr.write(`[MCP ERROR] ${args.join(' ')}\n`);
    }
  },
  log: (message) => {
    // Les messages de log pour stdout ne devraient être que des réponses JSON-RPC
    process.stdout.write(message + '\n');
  }
};

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
      new CalculateRevenueTool(),
      new AnalyzeProjectBriefTool(),
      new FindSimilarProjectsAdvancedTool(),
      new EstimateProjectCostTool()
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
      // Gérer les notifications (pas de réponse requise selon JSON-RPC 2.0)
      if (request.method && request.method.startsWith('notifications/')) {
        // Les notifications ne doivent pas avoir de réponse
        return null;
      }

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
        const toolsList = Array.from(this.tools.values()).map(tool => {
          // Construire un schéma JSON valide et strict (sans "required" dans les propriétés)
          const properties = {};
          const required = [];
          if (tool.parameters) {
            for (const [key, param] of Object.entries(tool.parameters)) {
              const { required: isRequired, ...rest } = param || {};
              properties[key] = rest;
              if (isRequired) required.push(key);
            }
          }

          return {
            name: tool.name,
            description: tool.description,
            inputSchema: {
              type: 'object',
              additionalProperties: false,
              properties,
              required,
            },
          };
        });

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
          customLogger.error(`Outil inconnu: ${name} pour requête ID ${request.id}`);
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
          const result = await tool.execute(args || {}, this.database);
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
          customLogger.error(`Erreur lors de l'exécution de l'outil ${name} (ID requête: ${request.id}):`, error.message);
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32000,
              message: `Erreur lors de l'exécution de l'outil ${name}: ${error.message}`,
            },
          };
        }
      }

      customLogger.error(`Méthode non trouvée: ${request.method} pour requête ID ${request.id}`);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: 'Méthode non trouvée',
        },
      };
    } catch (error) {
      // S'assurer que request et request.id existent avant d'essayer de les utiliser
      const responseId = (request && request.id !== undefined) ? request.id : null;
      customLogger.error(`Erreur interne du serveur lors du traitement de la requête (ID: ${responseId}):`, error.message);
      return {
        jsonrpc: '2.0',
        id: responseId,
        error: {
          code: -32603,
          message: `Erreur interne du serveur: ${error.message}`,
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

      if (process.env.MCP_DEBUG === 'true') {
        customLogger.error('Serveur MCP Facturation.PRO démarré');
        customLogger.error('Base de données initialisée');
        customLogger.error('Outils disponibles:', Array.from(this.tools.keys()).join(', '));
      }

      // Gérer les requêtes stdin (NDJSON: une requête JSON par ligne)
      const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
      rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) return;
        
        // Log temporaire pour diagnostic (TOUJOURS actif)
        if (process.env.MCP_DEBUG === 'true') {
          process.stderr.write(`[DIAGNOSTIC] Reçu: ${input}\n`);
        }
        
        try {
          const request = JSON.parse(input);
          if (process.env.MCP_DEBUG === 'true') {
            process.stderr.write(`[DIAGNOSTIC] Requête parsée: ${JSON.stringify(request, null, 2)}\n`);
          }
          
          const response = await this.handleRequest(request);
          
          if (response !== null) {
            if (process.env.MCP_DEBUG === 'true') {
              process.stderr.write(`[DIAGNOSTIC] Réponse générée: ${JSON.stringify(response, null, 2)}\n`);
            }
            customLogger.log(JSON.stringify(response)); // stdout
            if (process.env.MCP_DEBUG === 'true') {
              process.stderr.write(`[DIAGNOSTIC] Réponse envoyée sur stdout\n`);
            }
          } else {
            if (process.env.MCP_DEBUG === 'true') {
              process.stderr.write(`[DIAGNOSTIC] Notification traitée, aucune réponse nécessaire\n`);
            }
          }
        } catch (error) {
          if (process.env.MCP_DEBUG === 'true') {
            process.stderr.write(`[DIAGNOSTIC] Erreur parsing: ${error.message}\n`);
          }
          customLogger.error('Erreur parsing ligne stdin:', error.message);
        }
      });

    } catch (error) {
      customLogger.error('Erreur lors du démarrage du serveur MCP:', error.message);
      process.exit(1);
    }
  }

  /**
   * Arrête le serveur MCP
   */
  async stop() {
    try {
      await this.database.close();
      if (process.env.MCP_DEBUG === 'true') {
        customLogger.error('Serveur MCP arrêté');
      }
    } catch (error) {
      customLogger.error('Erreur lors de l\'arrêt du serveur:', error.message);
    }
  }
}
