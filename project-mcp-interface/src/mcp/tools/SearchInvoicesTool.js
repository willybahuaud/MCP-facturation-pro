import { BaseTool } from './BaseTool.js';

/**
 * Outil de recherche dans les factures
 * Principe SOLID : Single Responsibility - Recherche uniquement dans les factures
 */
export class SearchInvoicesTool extends BaseTool {
  constructor() {
    super(
      'search_invoices',
      'Recherche des factures par critères (numéro, client, description, etc.)',
      {
        query: {
          type: 'string',
          description: 'Terme de recherche',
          required: true
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de résultats (défaut: 20)',
          required: false
        },
        status: {
          type: 'string',
          description: 'Filtrer par statut (non_paye, paye)',
          required: false
        },
        payment_mode: {
          type: 'string',
          description: 'Filtrer par mode de paiement',
          required: false
        },
        date_from: {
          type: 'string',
          description: 'Date de début (YYYY-MM-DD)',
          required: false
        },
        date_to: {
          type: 'string',
          description: 'Date de fin (YYYY-MM-DD)',
          required: false
        }
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);

      const { query, limit = 20, status, payment_mode, date_from, date_to } = args;

      // Construire la requête SQL avec filtres
      let sql = `
        SELECT DISTINCT
          i.*,
          c.name as customer_name,
          c.email as customer_email,
          c.city as customer_city
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.facturation_id
        LEFT JOIN invoice_lines il ON i.facturation_id = il.invoice_id
        WHERE (
          i.invoice_number LIKE ? OR 
          i.notes LIKE ? OR 
          c.name LIKE ? OR
          c.email LIKE ? OR
          il.description LIKE ?
        )
      `;

      const params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];

      // Ajouter les filtres optionnels
      if (status) {
        const statusMap = {
          'non_paye': 0,
          'paye': 1
        };
        if (statusMap[status] !== undefined) {
          sql += ' AND i.status = ?';
          params.push(statusMap[status]);
        }
      }

      if (payment_mode) {
        sql += ' AND i.payment_mode = ?';
        params.push(parseInt(payment_mode));
      }

      if (date_from) {
        sql += ' AND i.invoice_date >= ?';
        params.push(date_from);
      }

      if (date_to) {
        sql += ' AND i.invoice_date <= ?';
        params.push(date_to);
      }

      sql += ' ORDER BY i.invoice_date DESC LIMIT ?';
      params.push(limit);

      const invoices = await database.all(sql, params);

      // Enrichir avec les lignes de facture pour tous les résultats demandés
      const enrichedInvoices = await Promise.all(
        invoices.slice(0, Math.min(limit, invoices.length)).map(async (invoice) => {
          const lines = await database.getInvoiceLines(invoice.id);
          return {
            // Informations principales de la facture
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            status: invoice.status,
            payment_mode: invoice.payment_mode,
            total_ht: invoice.total_ht,
            total_ttc: invoice.total_ttc,
            vat_amount: invoice.vat_amount,
            notes: invoice.notes,
            
            // Informations client
            customer_name: invoice.customer_name,
            customer_email: invoice.customer_email,
            customer_city: invoice.customer_city,
            
            // Lignes de facture
            lines: lines.map(line => ({
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              total_ht: line.total_ht,
              product_name: line.product_name
            }))
          };
        })
      );

      return this.formatResult({
        invoices: enrichedInvoices,
        total: invoices.length,
        query: query,
        filters: { status, payment_mode, date_from, date_to }
      });

    } catch (error) {
      return this.handleError(error);
    }
  }
}
