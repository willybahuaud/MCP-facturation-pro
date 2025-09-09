import { FacturationApiClient } from '../api/FacturationApiClient.js';
import Database from '../database/index.js';
import chalk from 'chalk';

/**
 * Service de synchronisation des données
 * Principe SOLID : Single Responsibility - Gère uniquement la synchronisation
 */
export class SyncService {
  constructor() {
    this.apiClient = new FacturationApiClient();
    this.database = new Database();
    this.isRunning = false;
  }

  /**
   * Initialise le service de synchronisation
   */
  async initialize() {
    await this.database.connect();
    await this.database.initialize();
  }

  /**
   * Synchronise toutes les données depuis l'API
   * @param {boolean} verbose - Mode verbeux
   */
  async syncAll(verbose = false) {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️  Synchronisation déjà en cours...'));
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log(chalk.blue.bold('🔄 Début de la synchronisation...'));

      // Test de connexion
      if (verbose) console.log(chalk.blue('🔍 Test de connexion à l\'API...'));
      const isConnected = await this.apiClient.testConnection();
      if (!isConnected) {
        throw new Error('Impossible de se connecter à l\'API Facturation.PRO');
      }
      if (verbose) console.log(chalk.green('✅ Connexion API établie'));

      // Synchronisation des données de base
      await this.syncCategories(verbose);
      await this.syncCustomers(verbose);
      await this.syncProducts(verbose);
      
      // Synchronisation des données transactionnelles
      await this.syncQuotes(verbose);
      await this.syncInvoices(verbose);

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(chalk.green.bold(`✅ Synchronisation terminée en ${duration}s`));

    } catch (error) {
      console.error(chalk.red.bold('❌ Erreur lors de la synchronisation:'));
      console.error(chalk.red(error.message));
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Synchronise les catégories
   * @param {boolean} verbose - Mode verbeux
   */
  async syncCategories(verbose = false) {
    if (verbose) console.log(chalk.blue('📁 Synchronisation des catégories...'));
    
    const categories = await this.apiClient.getCategories();
    let count = 0;

    for (const category of categories) {
      // Utiliser un nom par défaut si manquant
      const categoryName = category.name && category.name.trim() !== '' 
        ? category.name.trim() 
        : `Catégorie ${category.id}`;

      await this.database.run(`
        INSERT OR REPLACE INTO categories 
        (facturation_id, name, status, created_at, updated_at, last_sync)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        category.id,
        categoryName,
        category.status || 0,
        category.created_at || null,
        category.updated_at || null
      ]);
      count++;
    }

    if (verbose) console.log(chalk.green(`✅ ${count} catégories synchronisées`));
  }

  /**
   * Synchronise les clients
   * @param {boolean} verbose - Mode verbeux
   */
  async syncCustomers(verbose = false) {
    if (verbose) console.log(chalk.blue('👥 Synchronisation des clients...'));
    
    const customers = await this.apiClient.getCustomers();
    let count = 0;

    for (const customer of customers) {
      // Construire le nom du client (priorité: company_name > first_name + last_name > short_name)
      let customerName = '';
      if (customer.company_name && customer.company_name.trim() !== '') {
        customerName = customer.company_name.trim();
      } else if (customer.first_name || customer.last_name) {
        customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      } else if (customer.short_name && customer.short_name.trim() !== '') {
        customerName = customer.short_name.trim();
      } else {
        customerName = `Client ${customer.id}`;
      }

      // Nettoyer les données du client
      const cleanCustomer = {
        ...customer,
        name: customerName,
        email: customer.email ? customer.email.trim() : null,
        phone: customer.phone ? customer.phone.trim() : null,
        address: customer.street ? customer.street.trim() : null,
        city: customer.city ? customer.city.trim() : null,
        postal_code: customer.zip_code ? customer.zip_code.trim() : null,
        country: customer.country ? customer.country.trim() : null,
        vat_number: customer.vat_number ? customer.vat_number.trim() : null
      };

      await this.database.upsertCustomer(cleanCustomer);
      count++;
    }

    if (verbose) console.log(chalk.green(`✅ ${count} clients synchronisés`));
  }

  /**
   * Synchronise les produits
   * @param {boolean} verbose - Mode verbeux
   */
  async syncProducts(verbose = false) {
    if (verbose) console.log(chalk.blue('📦 Synchronisation des produits...'));
    
    const products = await this.apiClient.getProducts();
    let count = 0;

    for (const product of products) {
      // Utiliser un nom par défaut si manquant
      const productName = product.name && product.name.trim() !== '' 
        ? product.name.trim() 
        : `Produit ${product.id}`;

      // Nettoyer les données du produit
      const cleanProduct = {
        ...product,
        name: productName,
        description: product.description ? product.description.trim() : null,
        price: parseFloat(product.price) || 0,
        vat_rate: parseFloat(product.vat_rate) || 0,
        unit: product.unit ? product.unit.trim() : null
      };

      await this.database.upsertProduct(cleanProduct);
      count++;
    }

    if (verbose) console.log(chalk.green(`✅ ${count} produits synchronisés`));
  }

  /**
   * Synchronise les devis
   * @param {boolean} verbose - Mode verbeux
   */
  async syncQuotes(verbose = false) {
    if (verbose) console.log(chalk.blue('📋 Synchronisation des devis...'));
    
    const quotes = await this.apiClient.getQuotes();
    let count = 0;

    for (const quote of quotes) {
      // Utiliser un numéro par défaut si manquant
      const quoteNumber = quote.quote_number && quote.quote_number.trim() !== '' 
        ? quote.quote_number.trim() 
        : `DEV-${quote.id}`;

      // Nettoyer les données du devis
      const cleanQuote = {
        ...quote,
        quote_number: quoteNumber,
        quote_ref: quote.quote_ref || null, // Numéro séquentiel du devis
        quote_date: quote.created_at ? quote.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        total_ht: quote.total || 0,
        total_ttc: quote.total_with_vat || 0,
        vat_amount: (quote.total_with_vat || 0) - (quote.total || 0),
        notes: quote.information ? quote.information.trim() : null
      };

      // Synchroniser le devis
      await this.database.upsertQuote(cleanQuote);
      
      // Synchroniser les lignes du devis si elles sont incluses dans la réponse
      if (quote.items && Array.isArray(quote.items) && quote.items.length > 0) {
        await this.syncQuoteLines(quote.id, quote.items);
      }
      
      count++;
    }

    if (verbose) console.log(chalk.green(`✅ ${count} devis synchronisés`));
  }

  /**
   * Synchronise les lignes d'un devis
   * @param {number} quoteId - ID du devis
   * @param {Array} items - Items du devis (lignes de détail)
   */
  async syncQuoteLines(quoteId, items) {
    // Supprimer les anciennes lignes
    await this.database.run('DELETE FROM quote_lines WHERE quote_id = ?', [quoteId]);

    // Insérer les nouvelles lignes
    for (const item of items) {
      // Calculer le total HT et TTC
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const vatRate = parseFloat(item.vat) || 0;
      const totalHT = quantity * unitPrice;
      const totalTTC = totalHT * (1 + vatRate);

      await this.database.run(`
        INSERT INTO quote_lines 
        (quote_id, product_id, description, quantity, unit_price, vat_rate, total_ht, total_ttc, line_order, created_at, updated_at, last_sync)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        quoteId,
        item.product_id || null,
        item.title || '', // Utiliser title au lieu de description
        quantity,
        unitPrice,
        vatRate,
        totalHT,
        totalTTC,
        item.position || 0, // Utiliser position au lieu de line_order
        item.created_at || null,
        item.updated_at || null
      ]);
    }
  }

  /**
   * Synchronise les factures
   * @param {boolean} verbose - Mode verbeux
   */
  async syncInvoices(verbose = false) {
    if (verbose) console.log(chalk.blue('🧾 Synchronisation des factures...'));
    
    const invoices = await this.apiClient.getInvoices();
    let count = 0;

    for (const invoice of invoices) {
      // Utiliser un numéro par défaut si manquant
      const invoiceNumber = invoice.invoice_number && invoice.invoice_number.trim() !== '' 
        ? invoice.invoice_number.trim() 
        : `FAC-${invoice.id}`;

      // Nettoyer les données de la facture
      const cleanInvoice = {
        ...invoice,
        invoice_number: invoiceNumber,
        invoice_ref: invoice.invoice_ref || null, // Numéro séquentiel de la facture
        invoice_date: invoice.created_at ? invoice.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        total_ht: invoice.total || 0,
        total_ttc: invoice.total_with_vat || 0,
        vat_amount: (invoice.total_with_vat || 0) - (invoice.total || 0),
        notes: invoice.information ? invoice.information.trim() : null,
        // Mapper le statut de paiement
        status: invoice.paid_on ? 1 : 0, // 1 = payée, 0 = non payée
        payment_mode: invoice.payment_mode || 0,
        paid_on: invoice.paid_on || null,
        balance: invoice.balance || 0
      };

      // Synchroniser la facture
      await this.database.upsertInvoice(cleanInvoice);
      
      // Synchroniser les lignes de la facture si elles sont incluses dans la réponse
      if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
        await this.syncInvoiceLines(invoice.id, invoice.items);
      }
      
      count++;
    }

    if (verbose) console.log(chalk.green(`✅ ${count} factures synchronisées`));
  }

  /**
   * Synchronise les lignes d'une facture
   * @param {number} invoiceId - ID de la facture
   * @param {Array} items - Items de la facture (lignes de détail)
   */
  async syncInvoiceLines(invoiceId, items) {
    // Supprimer les anciennes lignes
    await this.database.run('DELETE FROM invoice_lines WHERE invoice_id = ?', [invoiceId]);

    // Insérer les nouvelles lignes
    for (const item of items) {
      // Calculer le total HT et TTC
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const vatRate = parseFloat(item.vat) || 0;
      const totalHT = quantity * unitPrice;
      const totalTTC = totalHT * (1 + vatRate);

      await this.database.run(`
        INSERT INTO invoice_lines 
        (invoice_id, product_id, description, quantity, unit_price, vat_rate, total_ht, total_ttc, line_order, created_at, updated_at, last_sync)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        invoiceId,
        item.product_id || null,
        item.title || '', // Utiliser title au lieu de description
        quantity,
        unitPrice,
        vatRate,
        totalHT,
        totalTTC,
        item.position || 0, // Utiliser position au lieu de line_order
        item.created_at || null,
        item.updated_at || null
      ]);
    }
  }

  /**
   * Synchronise uniquement les données récentes
   * @param {boolean} verbose - Mode verbeux
   */
  async syncRecent(verbose = false) {
    if (verbose) console.log(chalk.blue('🔄 Synchronisation des données récentes...'));
    
    try {
      // Synchroniser les devis récents
      const recentQuotes = await this.apiClient.getRecentQuotes();
      for (const quote of recentQuotes) {
        await this.database.upsertQuote(quote);
      }
      
      // Synchroniser les factures récentes
      const recentInvoices = await this.apiClient.getRecentInvoices();
      for (const invoice of recentInvoices) {
        await this.database.upsertInvoice(invoice);
      }
      
      if (verbose) console.log(chalk.green(`✅ ${recentQuotes.length} devis et ${recentInvoices.length} factures récents synchronisés`));
      
    } catch (error) {
      console.error(chalk.red('Erreur lors de la synchronisation récente:'), error.message);
      throw error;
    }
  }

  /**
   * Ferme les connexions
   */
  async close() {
    await this.database.close();
  }
}
