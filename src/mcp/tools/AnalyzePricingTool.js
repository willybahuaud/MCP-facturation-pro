import { BaseTool } from './BaseTool.js';

/**
 * Outil d'analyse des tarifs et statistiques
 * Principe SOLID : Single Responsibility - Analyse uniquement les tarifs
 */
export class AnalyzePricingTool extends BaseTool {
  constructor() {
    super(
      'analyze_pricing',
      'Analyse les tarifs, moyennes et statistiques de facturation',
      {
        product_name: {
          type: 'string',
          description: 'Nom du produit à analyser (optionnel)',
          required: false
        },
        customer_id: {
          type: 'number',
          description: 'ID du client pour filtrer (optionnel)',
          required: false
        },
        period_months: {
          type: 'number',
          description: 'Période d\'analyse en mois (défaut: 12)',
          required: false
        }
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);

      const { product_name, customer_id, period_months = 12 } = args;

      // Calculer la date de début de la période
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - period_months);
      const startDateStr = startDate.toISOString().split('T')[0];

      // Statistiques générales
      const generalStats = await this.getGeneralStats(database, startDateStr, product_name, customer_id);
      
      // Analyse par produit
      const productAnalysis = await this.getProductAnalysis(database, startDateStr, product_name, customer_id);
      
      // Analyse par client
      const customerAnalysis = await this.getCustomerAnalysis(database, startDateStr, product_name, customer_id);
      
      // Évolution des prix
      const priceEvolution = await this.getPriceEvolution(database, startDateStr, product_name, customer_id);

      return this.formatResult({
        period: {
          start_date: startDateStr,
          end_date: new Date().toISOString().split('T')[0],
          months: period_months
        },
        general_stats: generalStats,
        product_analysis: productAnalysis,
        customer_analysis: customerAnalysis,
        price_evolution: priceEvolution
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  async getGeneralStats(database, startDate, product_name, customer_id) {
    // Requête séparée pour les devis
    let quotesSql = `
      SELECT 
        COUNT(*) as total_quotes,
        AVG(total_ttc) as avg_quote_amount,
        SUM(total_ttc) as total_quoted,
        COUNT(DISTINCT customer_id) as unique_customers_quotes
      FROM quotes 
      WHERE quote_date >= ?
    `;

    let quotesParams = [startDate];

    if (product_name) {
      quotesSql += `
        AND id IN (
          SELECT ql.quote_id FROM quote_lines ql 
          WHERE ql.description LIKE ?
        )
      `;
      quotesParams.push(`%${product_name}%`);
    }

    if (customer_id) {
      quotesSql += ' AND customer_id = ?';
      quotesParams.push(customer_id);
    }

    const quotesResult = await database.get(quotesSql, quotesParams);

    // Requête séparée pour les factures
    let invoicesSql = `
      SELECT 
        COUNT(*) as total_invoices,
        AVG(total_ttc) as avg_invoice_amount,
        SUM(total_ttc) as total_invoiced,
        COUNT(DISTINCT customer_id) as unique_customers_invoices
      FROM invoices 
      WHERE invoice_date >= ?
    `;

    let invoicesParams = [startDate];

    if (product_name) {
      invoicesSql += `
        AND id IN (
          SELECT il.invoice_id FROM invoice_lines il 
          WHERE il.description LIKE ?
        )
      `;
      invoicesParams.push(`%${product_name}%`);
    }

    if (customer_id) {
      invoicesSql += ' AND customer_id = ?';
      invoicesParams.push(customer_id);
    }

    const invoicesResult = await database.get(invoicesSql, invoicesParams);

    // Combiner les résultats
    return {
      ...quotesResult,
      ...invoicesResult
    };
  }

  async getProductAnalysis(database, startDate, product_name, customer_id) {
    let sql = `
      SELECT 
        p.name as product_name,
        p.price as catalog_price,
        AVG(ql.unit_price) as avg_quote_price,
        AVG(il.unit_price) as avg_invoice_price,
        MIN(ql.unit_price) as min_quote_price,
        MAX(ql.unit_price) as max_quote_price,
        MIN(il.unit_price) as min_invoice_price,
        MAX(il.unit_price) as max_invoice_price,
        COUNT(DISTINCT ql.quote_id) as quote_count,
        COUNT(DISTINCT il.invoice_id) as invoice_count,
        SUM(ql.total_ht) as total_quoted,
        SUM(il.total_ht) as total_invoiced
      FROM products p
      LEFT JOIN quote_lines ql ON p.id = ql.product_id
      LEFT JOIN invoice_lines il ON p.id = il.product_id
      LEFT JOIN quotes q ON ql.quote_id = q.id
      LEFT JOIN invoices i ON il.invoice_id = i.id
      WHERE (q.quote_date >= ? OR i.invoice_date >= ?)
    `;

    const params = [startDate, startDate];

    if (product_name) {
      sql += ' AND p.name LIKE ?';
      params.push(`%${product_name}%`);
    }

    if (customer_id) {
      sql += ' AND (q.customer_id = ? OR i.customer_id = ?)';
      params.push(customer_id, customer_id);
    }

    sql += `
      GROUP BY p.id, p.name, p.price
      HAVING quote_count > 0 OR invoice_count > 0
      ORDER BY total_invoiced DESC
    `;

    const results = await database.all(sql, params);
    return results;
  }

  async getCustomerAnalysis(database, startDate, product_name, customer_id) {
    let sql = `
      SELECT 
        c.name as customer_name,
        c.city as customer_city,
        COUNT(DISTINCT q.id) as quote_count,
        COUNT(DISTINCT i.id) as invoice_count,
        AVG(q.total_ttc) as avg_quote_amount,
        AVG(i.total_ttc) as avg_invoice_amount,
        SUM(q.total_ttc) as total_quoted,
        SUM(i.total_ttc) as total_invoiced,
        MAX(q.quote_date) as last_quote_date,
        MAX(i.invoice_date) as last_invoice_date
      FROM customers c
      LEFT JOIN quotes q ON c.id = q.customer_id AND q.quote_date >= ?
      LEFT JOIN invoices i ON c.id = i.customer_id AND i.invoice_date >= ?
    `;

    const params = [startDate, startDate];

    if (product_name) {
      sql += `
        AND (q.id IN (
          SELECT ql.quote_id FROM quote_lines ql 
          WHERE ql.description LIKE ?
        ) OR i.id IN (
          SELECT il.invoice_id FROM invoice_lines il 
          WHERE il.description LIKE ?
        ))
      `;
      params.push(`%${product_name}%`, `%${product_name}%`);
    }

    if (customer_id) {
      sql += ' AND c.id = ?';
      params.push(customer_id);
    }

    sql += `
      GROUP BY c.id, c.name, c.city
      HAVING quote_count > 0 OR invoice_count > 0
      ORDER BY total_invoiced DESC
      LIMIT 20
    `;

    const results = await database.all(sql, params);
    return results;
  }

  async getPriceEvolution(database, startDate, product_name, customer_id) {
    let sql = `
      SELECT 
        DATE(q.quote_date) as date,
        AVG(ql.unit_price) as avg_quote_price,
        COUNT(ql.id) as quote_line_count
      FROM quotes q
      JOIN quote_lines ql ON q.id = ql.quote_id
      WHERE q.quote_date >= ?
    `;

    const params = [startDate];

    if (product_name) {
      sql += ' AND ql.description LIKE ?';
      params.push(`%${product_name}%`);
    }

    if (customer_id) {
      sql += ' AND q.customer_id = ?';
      params.push(customer_id);
    }

    sql += `
      GROUP BY DATE(q.quote_date)
      ORDER BY date DESC
      LIMIT 30
    `;

    const results = await database.all(sql, params);
    return results;
  }
}
