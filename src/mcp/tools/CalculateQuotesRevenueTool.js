import { BaseTool } from './BaseTool.js';

/**
 * Outil de calcul des montants de devis par période
 * Fournit un total annuel en un seul appel (évite l'addition mensuelle côté LLM)
 */
export class CalculateQuotesRevenueTool extends BaseTool {
  constructor() {
    super(
      'calculate_quotes_revenue',
      "Calcule les montants de devis (HT/TTC/TVA) par année/période en un seul appel. Utiliser cet outil pour obtenir un total annuel de devis plutôt que d'additionner des mois.",
      {
        year: {
          type: 'number',
          description: 'Année à analyser (optionnel)',
          required: false,
        },
        start_date: {
          type: 'string',
          description: 'Date de début (YYYY-MM-DD)',
          required: false,
        },
        end_date: {
          type: 'string',
          description: 'Date de fin (YYYY-MM-DD)',
          required: false,
        },
        status: {
          type: 'string',
          description: "Filtre statut: 'tous' | 'acceptes' | 'en_attente' | 'refuses'",
          required: false,
        },
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);
      const { year, start_date, end_date, status = 'tous' } = args;

      let currentStartDate;
      let currentEndDate;
      let calculatedYear;

      if (start_date && end_date) {
        currentStartDate = start_date;
        currentEndDate = end_date;
        calculatedYear = new Date(start_date).getFullYear();
      } else if (year) {
        calculatedYear = year;
        currentStartDate = `${year}-01-01`;
        currentEndDate = `${year}-12-31`;
      } else {
        calculatedYear = new Date().getFullYear();
        currentStartDate = `${calculatedYear}-01-01`;
        currentEndDate = `${calculatedYear}-12-31`;
      }

      const statusFilter =
        status === 'acceptes' ? ' AND status = 1' :
        status === 'en_attente' ? ' AND status = 0' :
        status === 'refuses' ? ' AND status = 9' : '';

      const sql = `
        SELECT
          COUNT(id) as total_quotes,
          SUM(total_ttc) as total_quouted_ttc,
          SUM(total_ht) as total_quouted_ht,
          SUM(vat_amount) as total_vat_amount,
          AVG(total_ttc) as avg_quote_amount,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM quotes
        WHERE quote_date >= ? AND quote_date <= ?${statusFilter}
      `;
      const yearSummary = await database.get(sql, [currentStartDate, currentEndDate]);

      const monthlySql = `
        SELECT
          strftime('%m', quote_date) as month,
          COUNT(id) as total_quotes,
          SUM(total_ttc) as total_quouted_ttc,
          SUM(total_ht) as total_quouted_ht,
          SUM(vat_amount) as total_vat_amount
        FROM quotes
        WHERE quote_date >= ? AND quote_date <= ?${statusFilter}
        GROUP BY month
        ORDER BY month
      `;
      const monthlyResults = await database.all(monthlySql, [
        `${calculatedYear}-01-01`, `${calculatedYear}-12-31`
      ]);

      const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthName = this.getMonthName(month);
        const existing = monthlyResults.find(m => parseInt(m.month) === month);
        return {
          month,
          month_name: monthName,
          total_quotes: existing ? existing.total_quotes : 0,
          total_quouted_ttc: existing ? existing.total_quouted_ttc : 0,
          total_quouted_ht: existing ? existing.total_quouted_ht : 0,
          total_vat_amount: existing ? existing.total_vat_amount : 0,
        };
      });

      return this.formatResult({
        year: calculatedYear,
        query_type: 'quotes',
        quotes: {
          total_quotes: yearSummary.total_quotes || 0,
          total_quouted_ttc: yearSummary.total_quouted_ttc || 0,
          total_quouted_ht: yearSummary.total_quouted_ht || 0,
          total_vat_amount: yearSummary.total_vat_amount || 0,
          avg_quote_amount: yearSummary.avg_quote_amount || 0,
          unique_customers: yearSummary.unique_customers || 0,
          monthly_breakdown: monthlyBreakdown,
        },
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  getMonthName(month) {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[month - 1];
  }
}

