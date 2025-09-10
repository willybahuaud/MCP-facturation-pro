import { BaseTool } from './BaseTool.js';

/**
 * Outil de calcul des revenus par année
 * Principe SOLID : Single Responsibility - Calcule uniquement les revenus
 */
export class CalculateRevenueTool extends BaseTool {
  constructor() {
    super(
      'calculate_revenue',
      'Calcule les montants encaissés par année et période',
      {
        year: {
          type: 'number',
          description: 'Année spécifique à analyser (optionnel)',
          required: false
        },
        start_year: {
          type: 'number',
          description: 'Année de début pour la période (optionnel)',
          required: false
        },
        end_year: {
          type: 'number',
          description: 'Année de fin pour la période (optionnel)',
          required: false
        },
        start_date: {
          type: 'string',
          description: 'Date de début (YYYY-MM-DD) pour calcul précis',
          required: false
        },
        end_date: {
          type: 'string',
          description: 'Date de fin (YYYY-MM-DD) pour calcul précis',
          required: false
        },
        status: {
          type: 'string',
          description: 'Statut des factures (paye, non_paye, tous)',
          required: false
        },
        filter_by_payment_date: {
          type: 'boolean',
          description: 'Si true, filtre par date de paiement au lieu de date de facture (pour calculer l\'encaissé réel)',
          required: false
        }
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);

      const { year, start_year, end_year, start_date, end_date, status = 'tous', filter_by_payment_date = false } = args;

      let calculatedYear;
      let currentStartDate;
      let currentEndDate;

      if (start_date && end_date) {
        currentStartDate = start_date;
        currentEndDate = end_date;
        calculatedYear = new Date(start_date).getFullYear(); // Assumer start_date définit l'année pour affichage
      } else if (year) {
        calculatedYear = year;
        currentStartDate = `${year}-01-01`;
        currentEndDate = `${year}-12-31`;
      } else if (start_year && end_year) {
        // Pour une plage d'années, on traitera la première année du range pour la vue détaillée par défaut
        calculatedYear = start_year;
        currentStartDate = `${start_year}-01-01`;
        currentEndDate = `${end_year}-12-31`; // On conserve la plage complète pour le filtre principal si nécessaire
      } else {
        // Par défaut, l'année en cours
        calculatedYear = new Date().getFullYear();
        currentStartDate = `${calculatedYear}-01-01`;
        currentEndDate = `${calculatedYear}-12-31`;
      }

      const dateField = filter_by_payment_date ? 'paid_on' : 'invoice_date';
      let baseWhereClause;
      let monthlyWhereClause;

      if (filter_by_payment_date) {
        // Pour l'encaissé, filtrer par COALESCE(paid_on, invoice_date) et s'assurer qu'un montant a été encaissé
        const paidAmountCheck = `(total_ttc - IIF(balance IS NULL OR balance = '', 0.0, CAST(balance AS REAL))) > 0`;
        baseWhereClause = `WHERE COALESCE(paid_on, invoice_date) >= ? AND COALESCE(paid_on, invoice_date) <= ? AND ${paidAmountCheck}`;
        monthlyWhereClause = `WHERE COALESCE(paid_on, invoice_date) >= ? AND COALESCE(paid_on, invoice_date) <= ? AND ${paidAmountCheck}`;
      } else {
        // Pour le facturé, filtrer par invoice_date et statut
        const statusFilter = status === 'paye' ? ' AND status = 1' : status === 'non_paye' ? ' AND status = 0' : '';
        baseWhereClause = `WHERE invoice_date >= ? AND invoice_date <= ? ${statusFilter}`;
        monthlyWhereClause = `WHERE invoice_date >= ? AND invoice_date <= ? ${statusFilter}`;
      }

      // Clauses pour le calcul des montants, gérant les paiements partiels si filter_by_payment_date est vrai
      const paidBalance = `IIF(balance IS NULL OR balance = '', 0.0, CAST(balance AS REAL))`;
      
      const sumCaseTTC = filter_by_payment_date
        ? `SUM(total_ttc - ${paidBalance})`
        : `SUM(total_ttc)`;
      const sumCaseHT = filter_by_payment_date
        ? `SUM(total_ht - (total_ht * (${paidBalance} / IIF(total_ttc = 0, 1, total_ttc))))`
        : `SUM(total_ht)`;
      const sumCaseVAT = filter_by_payment_date
        ? `SUM(vat_amount - (vat_amount * (${paidBalance} / IIF(total_ttc = 0, 1, total_ttc))))`
        : `SUM(vat_amount)`;
      const avgCaseTTC = filter_by_payment_date
        ? `AVG(total_ttc - ${paidBalance})`
        : `AVG(total_ttc)`;


      // 1. Calcul des totaux globaux pour la période
      let sql = `
        SELECT
          COUNT(id) as total_invoices,
          ${sumCaseTTC} as total_invoiced_ttc,
          ${sumCaseHT} as total_invoiced_ht,
          ${sumCaseVAT} as total_vat_amount,
          ${avgCaseTTC} as avg_invoice_amount,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM invoices
        ${baseWhereClause}
      `;
      const yearSummary = await database.get(sql, [currentStartDate, currentEndDate]);

      // 2. Calcul de la répartition mensuelle pour l'année en cours (ou spécifiée)
      let monthlySql = `
        SELECT
          strftime('%m', COALESCE(paid_on, invoice_date)) as month,
          COUNT(id) as total_invoices,
          ${sumCaseTTC} as total_invoiced_ttc,
          ${sumCaseHT} as total_invoiced_ht,
          ${sumCaseVAT} as total_vat_amount
        FROM invoices
        ${monthlyWhereClause}
        GROUP BY month
        ORDER BY month
      `;
      const monthlyResults = await database.all(monthlySql, [`${calculatedYear}-01-01`, `${calculatedYear}-12-31`]);

      // Remplir les mois manquants
      const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthName = this.getMonthName(month);
        const existingData = monthlyResults.find(m => parseInt(m.month) === month);
        return {
          month: month,
          month_name: monthName,
          total_invoices: existingData ? existingData.total_invoices : 0,
          total_invoiced_ttc: existingData ? existingData.total_invoiced_ttc : 0,
          total_invoiced_ht: existingData ? existingData.total_invoiced_ht : 0,
          total_vat_amount: existingData ? existingData.total_vat_amount : 0,
        };
      });

      return this.formatResult({
        year: calculatedYear,
        query_type: filter_by_payment_date ? 'paid' : 'invoiced',
        revenue: {
          total_invoices: yearSummary.total_invoices || 0,
          total_invoiced_ttc: yearSummary.total_invoiced_ttc || 0,
          total_invoiced_ht: yearSummary.total_invoiced_ht || 0,
          total_vat_amount: yearSummary.total_vat_amount || 0,
          avg_invoice_amount: yearSummary.avg_invoice_amount || 0,
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
