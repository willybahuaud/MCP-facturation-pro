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
        SELECT 
          q.*,
          c.name as customer_name,
          c.email as customer_email,
          c.city as customer_city
        FROM quotes q
        LEFT JOIN customers c ON q.customer_id = c.facturation_id
        WHERE (
          q.quote_number LIKE ? OR 
          q.notes LIKE ? OR 
          c.name LIKE ? OR
          c.email LIKE ?
        )
      `;

      const params = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];

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
            ...quote,
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
