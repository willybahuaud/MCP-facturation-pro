import { FacturationApiClient } from '../api/FacturationApiClient.js';
import Database from '../database/index.js';
import chalk from 'chalk';
import { config } from '../config.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

// Logger pour SyncService
const syncServiceLogger = {
  log: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      process.stderr.write(`[SYNC SERVICE DEBUG] ${args.join(' ')}\n`);
    }
  },
  error: (...args) => {
    process.stderr.write(`[SYNC SERVICE ERROR] ${args.join(' ')}\n`);
  }
};

/**
 * Service de synchronisation des données
 * Principe SOLID : Single Responsibility - Gère uniquement la synchronisation
 */
export class SyncService {
  constructor() {
    this.apiClient = new FacturationApiClient();
    this.database = new Database();
    this.isSyncing = false;
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
  async syncAll(verbose = true) {
    if (this.isSyncing) {
      syncServiceLogger.log(chalk.yellow('⚠️  Synchronisation déjà en cours...'));
      return;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      syncServiceLogger.log(chalk.blue.bold('🔄 Début de la synchronisation...'));

      // Assurer que le répertoire data existe
      await mkdir(dirname(config.database.path), { recursive: true });

      // Connecter et initialiser la base de données
      await this.database.connect();
      await this.database.initialize();

      // Test de connexion API
      if (verbose) syncServiceLogger.log(chalk.blue('🔍 Test de connexion à l\'API...'));
      const apiConnected = await this.apiClient.testConnection();
      if (!apiConnected) {
        throw new Error('Impossible de se connecter à l\'API Facturation.PRO. Vérifiez vos identifiants.');
      }
      if (verbose) syncServiceLogger.log(chalk.green('✅ Connexion API établie'));

      await this.syncCategories(verbose);
      await this.syncCustomers(verbose);
      await this.syncProducts(verbose);
      await this.syncQuotes(verbose);
      await this.syncInvoices(verbose);
      await this.syncRecentData(verbose);

      syncServiceLogger.log(chalk.green.bold(`✅ Synchronisation terminée en ${((Date.now() - startTime) / 1000).toFixed(2)}s`));

    } catch (error) {
      syncServiceLogger.error(chalk.red.bold('❌ Erreur lors de la synchronisation:'));
      syncServiceLogger.error(chalk.red(error.message));
      throw error;
    } finally {
      await this.database.close();
      this.isSyncing = false;
    }
  }

  /**
   * Synchronise les catégories
   * @param {boolean} verbose - Mode verbeux
   */
  async syncCategories(verbose = true) {
    if (verbose) syncServiceLogger.log(chalk.blue('📁 Synchronisation des catégories...'));
    
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

    if (verbose) syncServiceLogger.log(chalk.green(`✅ ${count} catégories synchronisées`));
    return categories.length;
  }

  /**
   * Synchronise les clients
   * @param {boolean} verbose - Mode verbeux
   */
  async syncCustomers(verbose = true) {
    if (verbose) syncServiceLogger.log(chalk.blue('👥 Synchronisation des clients...'));
    
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

    if (verbose) syncServiceLogger.log(chalk.green(`✅ ${count} clients synchronisés`));
    return customers.length;
  }

  /**
   * Synchronise les produits
   * @param {boolean} verbose - Mode verbeux
   */
  async syncProducts(verbose = true) {
    if (verbose) syncServiceLogger.log(chalk.blue('📦 Synchronisation des produits...'));
    
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

    if (verbose) syncServiceLogger.log(chalk.green(`✅ ${count} produits synchronisés`));
    return products.length;
  }

  /**
   * Synchronise les devis
   * @param {boolean} verbose - Mode verbeux
   */
  async syncQuotes(verbose = true) {
    if (verbose) syncServiceLogger.log(chalk.blue('📋 Synchronisation des devis...'));
    
    const quotes = await this.apiClient.getQuotes();
    let count = 0;

    for (const quote of quotes) {
      // Vérifier que l'ID existe
      if (!quote.id) {
        console.warn('Devis sans ID ignoré:', quote);
        continue;
      }

      // Utiliser un numéro par défaut si manquant
      const quoteNumber = quote.quote_number && quote.quote_number.trim() !== '' 
        ? quote.quote_number.trim() 
        : `DEV-${quote.id}`;

      // Vérification finale du quote_number
      if (!quoteNumber || quoteNumber.trim() === '') {
        console.warn('Devis avec quote_number invalide ignoré:', {
          id: quote.id,
          quote_number: quote.quote_number,
          generated: quoteNumber
        });
        continue;
      }

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
      try {
        await this.database.upsertQuote(cleanQuote);
      } catch (error) {
        console.error('Erreur lors de l\'insertion du devis:', {
          id: quote.id,
          quote_number: cleanQuote.quote_number,
          error: error.message,
          cleanQuote: JSON.stringify(cleanQuote, null, 2)
        });
        throw error;
      }
      
      // Synchroniser les lignes du devis si elles sont incluses dans la réponse
      if (quote.items && Array.isArray(quote.items) && quote.items.length > 0) {
        await this.syncQuoteLines(quote.id, quote.items);
      }
      
      count++;
    }

    if (verbose) syncServiceLogger.log(chalk.green(`✅ ${count} devis synchronisés`));
    return quotes.length;
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
  async syncInvoices(verbose = true) {
    if (verbose) syncServiceLogger.log(chalk.blue('🧾 Synchronisation des factures...'));
    
    const invoices = await this.apiClient.getInvoices();
    let count = 0;

    for (const invoice of invoices) {
      // Vérifier que l'ID existe
      if (!invoice.id) {
        console.warn('Facture sans ID ignorée:', invoice);
        continue;
      }

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
        // Mapper le statut de paiement basé sur le balance
        status: (() => {
          const balance = parseFloat(invoice.balance || 0);
          const totalTtc = parseFloat(invoice.total_with_vat || 0);
          
          // Si le balance est 0 ou très proche de 0, la facture est payée
          // Si le balance égale le total TTC, elle n'est pas payée
          const isPaid = balance <= 0.01; // Tolérance de 1 centime pour les arrondis
          
          if (count < 3) { // Log les 3 premières pour voir tous les champs
            console.log(`Facture ${invoice.id} - Champs disponibles:`, {
              id: invoice.id,
              balance: invoice.balance,
              total_ttc: totalTtc,
              isPaid: isPaid,
              paid_on: invoice.paid_on,
              payment_date: invoice.payment_date,
              payment_mode: invoice.payment_mode,
              created_at: invoice.created_at,
              updated_at: invoice.updated_at,
              // Afficher tous les champs pour diagnostic
              all_fields: Object.keys(invoice).join(', ')
            });
          }
          
          return isPaid ? 1 : 0; // 1 = payée, 0 = non payée
        })(),
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

    if (verbose) syncServiceLogger.log(chalk.green(`✅ ${count} factures synchronisées`));
    return invoices.length;
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
  async syncRecentData(verbose = true) {
    if (verbose) syncServiceLogger.log(chalk.blue('🔄 Synchronisation des données récentes...'));
    
    const recentQuotes = await this.apiClient.getRecentQuotes();
    const recentInvoices = await this.apiClient.getRecentInvoices();

    for (const quote of recentQuotes) {
      // Vérifier que l'ID existe
      if (!quote.id) {
        console.warn('Devis récent sans ID ignoré:', quote);
        continue;
      }

      // Utiliser un numéro par défaut si manquant
      const quoteNumber = quote.quote_number && quote.quote_number.trim() !== '' 
        ? quote.quote_number.trim() 
        : `DEV-${quote.id}`;

      // Vérification finale du quote_number
      if (!quoteNumber || quoteNumber.trim() === '') {
        console.warn('Devis récent avec quote_number invalide ignoré:', {
          id: quote.id,
          quote_number: quote.quote_number,
          generated: quoteNumber
        });
        continue;
      }

      // Nettoyer les données du devis récent
      const cleanQuote = {
        ...quote,
        quote_number: quoteNumber,
        quote_ref: quote.quote_ref || null,
        quote_date: quote.created_at ? quote.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        total_ht: quote.total || 0,
        total_ttc: quote.total_with_vat || 0,
        vat_amount: (quote.total_with_vat || 0) - (quote.total || 0),
        notes: quote.information ? quote.information.trim() : null
      };

      try {
        await this.database.upsertQuote(cleanQuote);
      } catch (error) {
        console.error('Erreur lors de l\'insertion du devis récent:', {
          id: quote.id,
          quote_number: cleanQuote.quote_number,
          error: error.message
        });
        throw error;
      }
    }
    for (const invoice of recentInvoices) {
      // Vérifier que l'ID existe
      if (!invoice.id) {
        console.warn('Facture récente sans ID ignorée:', invoice);
        continue;
      }

      // Utiliser un numéro par défaut si manquant
      const invoiceNumber = invoice.invoice_number && invoice.invoice_number.trim() !== '' 
        ? invoice.invoice_number.trim() 
        : `FAC-${invoice.id}`;

      // Vérification finale du invoice_number
      if (!invoiceNumber || invoiceNumber.trim() === '') {
        console.warn('Facture récente avec invoice_number invalide ignorée:', {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          generated: invoiceNumber
        });
        continue;
      }

      // Nettoyer les données de la facture récente
      const cleanInvoice = {
        ...invoice,
        invoice_number: invoiceNumber,
        invoice_ref: invoice.invoice_ref || null,
        invoice_date: invoice.created_at ? invoice.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        total_ht: invoice.total || 0,
        total_ttc: invoice.total_with_vat || 0,
        vat_amount: (invoice.total_with_vat || 0) - (invoice.total || 0),
        notes: invoice.information ? invoice.information.trim() : null,
        // Mapper le statut de paiement basé sur le balance
        status: (() => {
          const balance = parseFloat(invoice.balance || 0);
          const isPaid = balance <= 0.01; // Tolérance de 1 centime
          return isPaid ? 1 : 0;
        })(),
        payment_mode: invoice.payment_mode || 0,
        paid_on: invoice.paid_on || null,
        balance: invoice.balance || 0
      };

      try {
        await this.database.upsertInvoice(cleanInvoice);
      } catch (error) {
        console.error('Erreur lors de l\'insertion de la facture récente:', {
          id: invoice.id,
          invoice_number: cleanInvoice.invoice_number,
          error: error.message
        });
        throw error;
      }
    }
    if (verbose) syncServiceLogger.log(chalk.green(`✅ ${recentQuotes.length} devis et ${recentInvoices.length} factures récents synchronisés`));
  }

  /**
   * Ferme les connexions
   */
  async close() {
    await this.database.close();
  }
}
