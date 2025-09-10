import { BaseApiClient } from './BaseApiClient.js';

// Logger pour FacturationApiClient
const facturationApiLogger = {
  error: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      process.stderr.write(`[FACTURATION API ERROR] ${args.join(' ')}\n`);
    }
  },
};

/**
 * Client spécifique pour l'API Facturation.PRO
 * Étend BaseApiClient pour gérer les endpoints spécifiques et la logique métier
 */
export class FacturationApiClient extends BaseApiClient {
  constructor() {
    super();
  }

  /**
   * Récupère tous les clients
   * @returns {Promise<Array>} Liste des clients
   */
  async getCustomers() {
    const endpoint = this.buildUrl('customers');
    return this.getPaginated(endpoint, { with_details: 1 });
  }

  /**
   * Récupère un client par ID
   * @param {number} customerId - ID du client
   * @returns {Promise<Object>} Données du client
   */
  async getCustomer(customerId) {
    const endpoint = this.buildUrl(`customers/${customerId}`);
    return this.get(endpoint);
  }

  /**
   * Récupère tous les produits
   * @returns {Promise<Array>} Liste des produits
   */
  async getProducts() {
    const endpoint = this.buildUrl('products');
    return this.getPaginated(endpoint);
  }

  /**
   * Récupère un produit par ID
   * @param {number} productId - ID du produit
   * @returns {Promise<Object>} Données du produit
   */
  async getProduct(productId) {
    const endpoint = this.buildUrl(`products/${productId}`);
    return this.get(endpoint);
  }

  /**
   * Récupère toutes les catégories
   * @returns {Promise<Array>} Liste des catégories
   */
  async getCategories() {
    const endpoint = this.buildUrl('categories');
    return this.getPaginated(endpoint);
  }

  /**
   * Récupère tous les devis
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<Array>} Liste des devis
   */
  async getQuotes(filters = {}) {
    const endpoint = this.buildUrl('quotes');
    return this.getPaginated(endpoint, { ...filters, with_details: 1 });
  }

  /**
   * Récupère un devis par ID
   * @param {number} quoteId - ID du devis
   * @returns {Promise<Object>} Données du devis
   */
  async getQuote(quoteId) {
    const endpoint = this.buildUrl(`quotes/${quoteId}`);
    return this.get(endpoint);
  }


  /**
   * Récupère toutes les factures
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<Array>} Liste des factures
   */
  async getInvoices(filters = {}) {
    const endpoint = this.buildUrl('invoices');
    return this.getPaginated(endpoint, { ...filters, with_details: 1 });
  }

  /**
   * Récupère une facture par ID
   * @param {number} invoiceId - ID de la facture
   * @returns {Promise<Object>} Données de la facture
   */
  async getInvoice(invoiceId) {
    const endpoint = this.buildUrl(`invoices/${invoiceId}`);
    return this.get(endpoint);
  }


  /**
   * Récupère les devis récents (derniers 30 jours)
   * @returns {Promise<Array>} Liste des devis récents
   */
  async getRecentQuotes() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return this.getQuotes({
      created_at_from: thirtyDaysAgo.toISOString().split('T')[0]
    });
  }

  /**
   * Récupère les factures récentes (derniers 30 jours)
   * @returns {Promise<Array>} Liste des factures récentes
   */
  async getRecentInvoices() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return this.getInvoices({
      created_at_from: thirtyDaysAgo.toISOString().split('T')[0]
    });
  }

  /**
   * Teste la connexion à l'API
   * @returns {Promise<boolean>} True si la connexion fonctionne
   */
  async testConnection() {
    try {
      const response = await this.get('firms');
      return response.length > 0;
    } catch (error) {
      facturationApiLogger.error('Test de connexion échoué:', error.message);
      throw error;
    }
  }
}
