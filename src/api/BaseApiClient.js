import axios from 'axios';
import { config } from '../config.js';

// Logger pour l'API client
const apiLogger = {
  log: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      process.stderr.write(`[API DEBUG] ${args.join(' ')}\n`);
    }
  },
  error: (...args) => {
    process.stderr.write(`[API ERROR] ${args.join(' ')}\n`);
  }
};

/**
 * Client de base pour l'API Facturation.PRO
 * Principe SOLID : Single Responsibility - Gère uniquement la communication HTTP
 */
export class BaseApiClient {
  constructor() {
    this.baseURL = config.facturation.baseUrl;
    this.apiId = config.facturation.apiId;
    this.apiKey = config.facturation.apiKey;
    this.firmId = config.facturation.firmId;
    this.userAgent = config.facturation.userAgent;
    
    // Rate limiting
    this.requestQueue = [];
    this.isProcessing = false;
    this.maxRequestsPerMinute = 30; // Limite conservatrice
    this.requestCount = 0;
    this.lastResetTime = Date.now();
    
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.apiId,
        password: this.apiKey
      },
      headers: {
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 secondes
    });

    this._setupInterceptors();
  }

  _setupInterceptors() {
    // Intercepteur pour les requêtes
    this.client.interceptors.request.use(
      (config) => {
        apiLogger.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        apiLogger.error('Erreur de requête:', error.message);
        return Promise.reject(error);
      }
    );

    // Intercepteur pour les réponses avec retry automatique
    this.client.interceptors.response.use(
      (response) => {
        apiLogger.log(`Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Gestion des erreurs 429 (Too Many Requests)
        if (error.response?.status === 429) {
          apiLogger.log(`Rate limit atteint, attente avant retry...`);
          
          // Attendre avant de retry
          await this._waitForRateLimit();
          
          // Retry la requête
          return this.client(originalRequest);
        }
        
        apiLogger.error(`${error.response?.status || 'Network'} ${error.config?.url}:`, error.message);
        return Promise.reject(this._handleApiError(error));
      }
    );
  }

  async _waitForRateLimit() {
    const waitTime = 60000; // Attendre 1 minute
    apiLogger.log(`Attente de ${waitTime/1000}s pour respecter les limites de taux...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.requestCount = 0;
    this.lastResetTime = Date.now();
  }

  async _checkRateLimit() {
    const now = Date.now();
    
    // Reset du compteur chaque minute
    if (now - this.lastResetTime >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    // Si on dépasse la limite, attendre
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.lastResetTime);
      if (waitTime > 0) {
        apiLogger.log(`Limite de taux atteinte, attente de ${Math.ceil(waitTime/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.lastResetTime = Date.now();
      }
    }
    
    this.requestCount++;
  }

  _handleApiError(error) {
    if (error.response) {
      // Erreur de l'API
      const { status, data } = error.response;
      const message = data?.message || data?.error || `Erreur HTTP ${status}`;
      
      return new Error(`API Error ${status}: ${message}`);
    } else if (error.request) {
      // Erreur réseau
      return new Error('Erreur de connexion à l\'API Facturation.PRO');
    } else {
      // Autre erreur
      return new Error(`Erreur de configuration: ${error.message}`);
    }
  }

  /**
   * Effectue une requête GET avec gestion de la pagination et rate limiting
   * @param {string} endpoint - Point d'accès API
   * @param {Object} params - Paramètres de requête
   * @returns {Promise<Object>} Données paginées
   */
  async getPaginated(endpoint, params = {}) {
    const results = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      try {
        // Vérifier le rate limit avant chaque requête
        await this._checkRateLimit();
        
        const response = await this.client.get(endpoint, {
          params: {
            ...params,
            page: currentPage
          }
        });

        const data = response.data;
        if (Array.isArray(data)) {
          results.push(...data);
        }

        // Récupérer les informations de pagination depuis les headers
        const paginationHeader = response.headers['x-pagination'];
        if (paginationHeader) {
          const pagination = JSON.parse(paginationHeader);
          totalPages = pagination.total_pages;
          currentPage = pagination.current_page + 1;
        } else {
          // Si pas de pagination, on s'arrête
          break;
        }

        // Petite pause entre les pages pour éviter le rate limiting
        if (currentPage <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 seconde entre les pages
        }

      } catch (error) {
        apiLogger.error(`Erreur page ${currentPage}:`, error.message);
        throw error;
      }
    } while (currentPage <= totalPages);

    return results;
  }

  /**
   * Effectue une requête GET simple avec rate limiting
   * @param {string} endpoint - Point d'accès API
   * @param {Object} params - Paramètres de requête
   * @returns {Promise<Object>} Données de la réponse
   */
  async get(endpoint, params = {}) {
    await this._checkRateLimit();
    const response = await this.client.get(endpoint, { params });
    return response.data;
  }

  /**
   * Effectue une requête POST
   * @param {string} endpoint - Point d'accès API
   * @param {Object} data - Données à envoyer
   * @returns {Promise<Object>} Données de la réponse
   */
  async post(endpoint, data = {}) {
    const response = await this.client.post(endpoint, data);
    return response.data;
  }

  /**
   * Effectue une requête PUT
   * @param {string} endpoint - Point d'accès API
   * @param {Object} data - Données à envoyer
   * @returns {Promise<Object>} Données de la réponse
   */
  async put(endpoint, data = {}) {
    const response = await this.client.put(endpoint, data);
    return response.data;
  }

  /**
   * Effectue une requête DELETE
   * @param {string} endpoint - Point d'accès API
   * @returns {Promise<Object>} Données de la réponse
   */
  async delete(endpoint) {
    const response = await this.client.delete(endpoint);
    return response.data;
  }

  /**
   * Construit l'URL complète pour un endpoint
   * @param {string} resource - Ressource API
   * @returns {string} URL complète
   */
  buildUrl(resource) {
    return `/firms/${this.firmId}/${resource}.json`;
  }
}
