import { BaseTool } from './BaseTool.js';

/**
 * Outil de recherche dans les devis
 * Principe SOLID : Single Responsibility - Recherche uniquement dans les devis
 */
export class SearchQuotesTool extends BaseTool {
  constructor() {
    super(
      'search_quotes',
      'Recherche des devis par critères (numéro, client, description, etc.)',
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
          description: 'Filtrer par statut (en_attente, accepte, refuse)',
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

      const { query, limit = 20, status, date_from, date_to } = args;

      // Construire la requête SQL avec filtres
      let sql = `
        SELECT DISTINCT
          q.*,
          c.name as customer_name,
          c.email as customer_email,
          c.city as customer_city
        FROM quotes q
        LEFT JOIN customers c ON q.customer_id = c.facturation_id
        LEFT JOIN quote_lines ql ON q.facturation_id = ql.quote_id
        WHERE (
          q.quote_number LIKE ? OR 
          q.notes LIKE ? OR 
          c.name LIKE ? OR
          c.email LIKE ? OR
          ql.description LIKE ?
        )
      `;

      const params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];

      // Ajouter les filtres optionnels
      if (status) {
        const statusMap = {
          'en_attente': 0,
          'accepte': 1,
          'refuse': 9
        };
        if (statusMap[status] !== undefined) {
          sql += ' AND q.status = ?';
          params.push(statusMap[status]);
        }
      }

      if (date_from) {
        sql += ' AND q.quote_date >= ?';
        params.push(date_from);
      }

      if (date_to) {
        sql += ' AND q.quote_date <= ?';
        params.push(date_to);
      }

      sql += ' ORDER BY q.quote_date DESC LIMIT ?';
      params.push(limit);

      const quotes = await database.all(sql, params);

      // Enrichir avec les lignes de devis pour tous les résultats demandés
      const enrichedQuotes = await Promise.all(
        quotes.slice(0, Math.min(limit, quotes.length)).map(async (quote) => {
          const lines = await database.getQuoteLines(quote.id);
          return {
            // Identifiants (préférer le numéro séquentiel humain)
            display_id: quote.quote_ref ?? quote.quote_number,
            quote_ref: quote.quote_ref,
            quote_number: quote.quote_number,

            // Informations principales du devis
            quote_date: quote.quote_date,
            due_date: quote.due_date,
            status: quote.status,
            total_ht: quote.total_ht,
            total_ttc: quote.total_ttc,
            vat_amount: quote.vat_amount,
            notes: quote.notes,
            
            // Informations client
            customer_name: quote.customer_name,
            customer_email: quote.customer_email,
            customer_city: quote.customer_city,
            
            // Lignes de devis
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
        quotes: enrichedQuotes,
        total: quotes.length,
        query: query,
        filters: { status, date_from, date_to }
      });

    } catch (error) {
      return this.handleError(error);
    }
  }
}
