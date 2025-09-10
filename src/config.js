import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  // Configuration API Facturation.PRO
  facturation: {
    apiId: process.env.FACTURATION_API_ID,
    apiKey: process.env.FACTURATION_API_KEY,
    firmId: process.env.FACTURATION_FIRM_ID,
    baseUrl: 'https://www.facturation.pro/',
    userAgent: 'FacturationPro-MCP (willy@example.com)'
  },
  
  // Configuration base de données
  database: {
    path: process.env.DB_PATH || './data/facturation.db'
  },
  
  // Configuration synchronisation
  sync: {
    interval: parseInt(process.env.SYNC_INTERVAL) || 60, // en minutes
    batchSize: 50, // nombre d'éléments par requête
    // Mode de synchronisation des paiements: 'bulk' (par défaut), 'none', ou 'per_invoice'
    payments_mode: process.env.SYNC_PAYMENTS_MODE || 'bulk',
    // Nombre d'années à couvrir pour le bulk
    payments_years: parseInt(process.env.SYNC_PAYMENTS_YEARS || '2', 10)
  },
  
  // Configuration MCP
  mcp: {
    serverName: process.env.MCP_SERVER_NAME || 'facturation-pro-mcp'
  }
};

// Validation de la configuration
export function validateConfig() {
  const errors = [];
  
  if (!config.facturation.apiId) {
    errors.push('FACTURATION_API_ID est requis');
  }
  
  if (!config.facturation.apiKey) {
    errors.push('FACTURATION_API_KEY est requis');
  }
  
  if (!config.facturation.firmId) {
    errors.push('FACTURATION_FIRM_ID est requis');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration invalide:\n${errors.join('\n')}`);
  }
  
  return true;
}
