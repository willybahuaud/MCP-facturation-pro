import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Logger pour la base de données
const dbLogger = {
  log: (...args) => {
    if (process.env.MCP_DEBUG === 'true') {
      process.stderr.write(`[DB DEBUG] ${args.join(' ')}\n`);
    }
  },
  error: (...args) => {
    process.stderr.write(`[DB ERROR] ${args.join(' ')}\n`);
  }
};

class Database {
  constructor() {
    this.db = null;
    this.dbPath = config.database.path;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          dbLogger.error('Erreur lors de la connexion à la base de données:', err.message);
          reject(err);
        } else {
          dbLogger.log('Connexion à la base de données établie');
          resolve();
        }
      });
    });
  }

  async initialize() {
    try {
      // Lire le schéma SQL
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      // Diviser le schéma en requêtes individuelles
      const statements = this.parseSQLStatements(schema);
      
      dbLogger.log(`Exécution de ${statements.length} requêtes SQL...`);
      
      // Exécuter chaque requête individuellement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            await this.run(statement);
            dbLogger.log(`Requête ${i + 1}/${statements.length} exécutée`);
          } catch (error) {
            dbLogger.error(`Erreur requête ${i + 1}:`, statement.substring(0, 50) + '...');
            dbLogger.error('Erreur:', error.message);
            throw error;
          }
        }
      }
      
      dbLogger.log('Schéma de base de données initialisé');
    } catch (error) {
      dbLogger.error('Erreur lors de l\'initialisation de la base de données:', error.message);
      throw error;
    }
  }

  parseSQLStatements(sql) {
    const statements = [];
    let currentStatement = '';
    let inComment = false;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];
      
      // Gérer les commentaires
      if (!inString && char === '-' && nextChar === '-') {
        inComment = true;
        continue;
      }
      
      if (inComment && char === '\n') {
        inComment = false;
        continue;
      }
      
      if (inComment) continue;
      
      // Gérer les chaînes de caractères
      if (!inString && (char === "'" || char === '"')) {
        inString = true;
        stringChar = char;
        currentStatement += char;
        continue;
      }
      
      if (inString && char === stringChar) {
        inString = false;
        currentStatement += char;
        continue;
      }
      
      if (inString) {
        currentStatement += char;
        continue;
      }
      
      // Fin de requête
      if (char === ';') {
        currentStatement = currentStatement.trim();
        if (currentStatement && !currentStatement.startsWith('--')) {
          statements.push(currentStatement);
        }
        currentStatement = '';
        continue;
      }
      
      currentStatement += char;
    }
    
    // Ajouter la dernière requête si elle n'est pas vide
    currentStatement = currentStatement.trim();
    if (currentStatement && !currentStatement.startsWith('--')) {
      statements.push(currentStatement);
    }
    
    return statements;
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            dbLogger.error('Erreur lors de la fermeture de la base de données:', err.message);
            reject(err);
          } else {
            dbLogger.log('Connexion à la base de données fermée');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  // Méthodes utilitaires pour les opérations courantes
  async upsertCustomer(customerData) {
    const sql = `
      INSERT OR REPLACE INTO customers 
      (facturation_id, name, email, phone, address, city, postal_code, country, vat_number, created_at, updated_at, last_sync)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      customerData.id,
      customerData.name,
      customerData.email || null,
      customerData.phone || null,
      customerData.address || null,
      customerData.city || null,
      customerData.postal_code || null,
      customerData.country || null,
      customerData.vat_number || null,
      customerData.created_at || null,
      customerData.updated_at || null
    ];

    return this.run(sql, params);
  }

  async upsertProduct(productData) {
    const sql = `
      INSERT OR REPLACE INTO products 
      (facturation_id, name, description, price, vat_rate, category_id, unit, created_at, updated_at, last_sync)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      productData.id,
      productData.name,
      productData.description || null,
      productData.price || 0,
      productData.vat_rate || 0,
      productData.category_id || null,
      productData.unit || null,
      productData.created_at || null,
      productData.updated_at || null
    ];

    return this.run(sql, params);
  }

  async upsertQuote(quoteData) {
    const sql = `
      INSERT OR REPLACE INTO quotes 
      (facturation_id, customer_id, quote_number, quote_ref, quote_date, due_date, status, total_ht, total_ttc, vat_amount, notes, created_at, updated_at, last_sync)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      quoteData.id,
      quoteData.customer_id,
      quoteData.quote_number,
      quoteData.quote_ref || null,
      quoteData.quote_date,
      quoteData.due_date || null,
      quoteData.quote_status || 0,
      quoteData.total_ht || 0,
      quoteData.total_ttc || 0,
      quoteData.vat_amount || 0,
      quoteData.notes || null,
      quoteData.created_at || null,
      quoteData.updated_at || null
    ];

    return this.run(sql, params);
  }

  async upsertInvoice(invoiceData) {
    const sql = `
      INSERT OR REPLACE INTO invoices 
      (facturation_id, customer_id, invoice_number, invoice_ref, invoice_date, due_date, payment_mode, payment_date, status, paid_on, balance, total_ht, total_ttc, vat_amount, notes, created_at, updated_at, last_sync)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const params = [
      invoiceData.id,
      invoiceData.customer_id,
      invoiceData.invoice_number,
      invoiceData.invoice_ref || null,
      invoiceData.invoice_date,
      invoiceData.due_date || null,
      invoiceData.payment_mode || 0,
      invoiceData.payment_date || null,
      invoiceData.status || 0,
      invoiceData.paid_on || null,
      invoiceData.balance || 0,
      invoiceData.total_ht || 0,
      invoiceData.total_ttc || 0,
      invoiceData.vat_amount || 0,
      invoiceData.notes || null,
      invoiceData.created_at || null,
      invoiceData.updated_at || null
    ];

    return this.run(sql, params);
  }

  // Méthodes de recherche pour le MCP
  async searchQuotes(query, limit = 50) {
    const sql = `
      SELECT q.*, c.name as customer_name, c.email as customer_email
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.quote_number LIKE ? OR q.notes LIKE ? OR c.name LIKE ?
      ORDER BY q.quote_date DESC
      LIMIT ?
    `;
    
    const searchTerm = `%${query}%`;
    return this.all(sql, [searchTerm, searchTerm, searchTerm, limit]);
  }

  async searchInvoices(query, limit = 50) {
    const sql = `
      SELECT i.*, c.name as customer_name, c.email as customer_email
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.invoice_number LIKE ? OR i.notes LIKE ? OR c.name LIKE ?
      ORDER BY i.invoice_date DESC
      LIMIT ?
    `;
    
    const searchTerm = `%${query}%`;
    return this.all(sql, [searchTerm, searchTerm, searchTerm, limit]);
  }

  async searchCustomers(query, limit = 50) {
    const sql = `
      SELECT * FROM customers
      WHERE name LIKE ? OR email LIKE ? OR city LIKE ?
      ORDER BY name ASC
      LIMIT ?
    `;
    
    const searchTerm = `%${query}%`;
    return this.all(sql, [searchTerm, searchTerm, searchTerm, limit]);
  }

  async getQuoteLines(quoteId) {
    const sql = `
      SELECT ql.*, p.name as product_name
      FROM quote_lines ql
      LEFT JOIN products p ON ql.product_id = p.id
      WHERE ql.quote_id = ?
      ORDER BY ql.line_order ASC
    `;
    
    return this.all(sql, [quoteId]);
  }

  async getInvoiceLines(invoiceId) {
    const sql = `
      SELECT il.*, p.name as product_name
      FROM invoice_lines il
      LEFT JOIN products p ON il.product_id = p.id
      WHERE il.invoice_id = ?
      ORDER BY il.line_order ASC
    `;
    
    return this.all(sql, [invoiceId]);
  }

  async getPricingStats() {
    const sql = `
      SELECT 
        p.name as product_name,
        p.price as unit_price,
        AVG(ql.unit_price) as avg_quote_price,
        AVG(il.unit_price) as avg_invoice_price,
        COUNT(DISTINCT ql.quote_id) as quote_count,
        COUNT(DISTINCT il.invoice_id) as invoice_count
      FROM products p
      LEFT JOIN quote_lines ql ON p.id = ql.product_id
      LEFT JOIN invoice_lines il ON p.id = il.product_id
      GROUP BY p.id, p.name, p.price
      HAVING quote_count > 0 OR invoice_count > 0
      ORDER BY p.name
   `;
    
    return this.all(sql);
  }

  // Paiements
  async getInvoiceLocalIdByFacturationId(facturationId) {
    const row = await this.get('SELECT id FROM invoices WHERE facturation_id = ?', [facturationId]);
    return row?.id || null;
  }

  async getInvoiceByFacturationId(facturationId) {
    return this.get('SELECT id, total_ht, total_ttc FROM invoices WHERE facturation_id = ?', [facturationId]);
  }

  async insertPayment(payment) {
    const sql = `
      INSERT INTO payments
      (invoice_id, payment_date, amount_ht, amount_ttc, amount_vat, payment_mode, note, source, created_at, updated_at, last_sync)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const params = [
      payment.invoice_id,
      payment.payment_date,
      payment.amount_ht,
      payment.amount_ttc,
      payment.amount_vat,
      payment.payment_mode || null,
      payment.note || null,
      payment.source || 'derived',
      payment.created_at || null,
      payment.updated_at || null
    ];
    return this.run(sql, params);
  }

  async deletePaymentsForInvoice(invoiceId, source = null) {
    if (source) {
      return this.run('DELETE FROM payments WHERE invoice_id = ? AND source = ?', [invoiceId, source]);
    }
    return this.run('DELETE FROM payments WHERE invoice_id = ?', [invoiceId]);
  }

  async deletePaymentsByDateRange(startDate, endDate, source = null) {
    if (source) {
      return this.run('DELETE FROM payments WHERE payment_date >= ? AND payment_date <= ? AND source = ?', [startDate, endDate, source]);
    }
    return this.run('DELETE FROM payments WHERE payment_date >= ? AND payment_date <= ?', [startDate, endDate]);
  }

  async getPaymentsCountBetween(startDate, endDate) {
    const row = await this.get('SELECT COUNT(1) as c FROM payments WHERE payment_date >= ? AND payment_date <= ?', [startDate, endDate]);
    return row?.c || 0;
  }
}

export default Database;
