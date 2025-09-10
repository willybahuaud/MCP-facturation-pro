import { BaseTool } from './BaseTool.js';

/**
 * Outil de calcul des revenus par année
 * Principe SOLID : Single Responsibility - Calcule uniquement les revenus
 */
export class CalculateRevenueTool extends BaseTool {
  constructor() {
    super(
      'calculate_revenue',
      'Calcule les montants encaissés (HT/TTC/TVA) par année/période en un seul appel, et fournit monthly_breakdown pour la ventilation mois par mois. Préférez cet outil à toute addition mensuelle. Par défaut filtre par date de paiement (encaissé réel).',
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

      // Par défaut, on calcule l'encaissement réel (par date de paiement)
      const { year, start_year, end_year, start_date, end_date, status = 'tous', filter_by_payment_date = true } = args;

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
        // En mode encaissé, on utilisera de préférence la table payments si des écritures existent
        baseWhereClause = '';
        monthlyWhereClause = '';
      } else {
        // Pour le facturé, filtrer par invoice_date et statut
        const statusFilter = status === 'paye' ? ' AND status = 1' : status === 'non_paye' ? ' AND status = 0' : '';
        baseWhereClause = `WHERE invoice_date >= ? AND invoice_date <= ? ${statusFilter}`;
        monthlyWhereClause = `WHERE invoice_date >= ? AND invoice_date <= ? ${statusFilter}`;
      }

      // Clauses pour le calcul des montants
      const paidBalance = `IIF(balance IS NULL OR balance = '', 0.0, CAST(balance AS REAL))`;

      // Expressions d'agrégation pour l'encaissé réel:
      // - Facture totalement payée: montant total si paid_on dans la période
      // - Facture partiellement payée: montant partiellement encaissé si COALESCE(payment_date, updated_at) dans la période
      const paidDateExpr = `COALESCE(payment_date, updated_at)`;
      const paidRatioExpr = `IIF(total_ttc = 0, 0.0, (total_ttc - ${paidBalance}) / total_ttc)`;

      const sumCaseTTC = filter_by_payment_date
        ? `SUM(CASE 
              WHEN status = 1 AND paid_on >= ? AND paid_on <= ? THEN total_ttc
              WHEN ((${paidBalance} > 0) AND (${paidBalance} < total_ttc)) AND ${paidDateExpr} >= ? AND ${paidDateExpr} <= ? THEN (total_ttc - ${paidBalance})
              ELSE 0 END)`
        : `SUM(total_ttc)`;

      const sumCaseHT = filter_by_payment_date
        ? `SUM(CASE 
              WHEN status = 1 AND paid_on >= ? AND paid_on <= ? THEN total_ht
              WHEN ((${paidBalance} > 0) AND (${paidBalance} < total_ttc)) AND ${paidDateExpr} >= ? AND ${paidDateExpr} <= ? THEN (total_ht * ${paidRatioExpr})
              ELSE 0 END)`
        : `SUM(total_ht)`;

      const sumCaseVAT = filter_by_payment_date
        ? `SUM(CASE 
              WHEN status = 1 AND paid_on >= ? AND paid_on <= ? THEN vat_amount
              WHEN ((${paidBalance} > 0) AND (${paidBalance} < total_ttc)) AND ${paidDateExpr} >= ? AND ${paidDateExpr} <= ? THEN (vat_amount * ${paidRatioExpr})
              ELSE 0 END)`
        : `SUM(vat_amount)`;

      const avgCaseTTC = filter_by_payment_date
        ? `AVG(CASE 
              WHEN status = 1 AND paid_on >= ? AND paid_on <= ? THEN total_ttc
              WHEN (${paidBalance} < total_ttc) AND ${paidDateExpr} >= ? AND ${paidDateExpr} <= ? THEN (total_ttc - ${paidBalance})
              ELSE NULL END)`
        : `AVG(total_ttc)`;


      // 1. Calcul des totaux globaux pour la période
      let sql;
      let yearParams = [];
      if (filter_by_payment_date) {
        // Utiliser les paiements quand ils existent, et compléter avec les factures qui n'ont pas de paiements enregistrés
        const paymentsCount = await database.getPaymentsCountBetween(currentStartDate, currentEndDate);

        if (paymentsCount > 0) {
          sql = `
            WITH p AS (
              SELECT p.invoice_id, i.customer_id, p.amount_ttc, p.amount_ht, p.amount_vat
              FROM payments p
              JOIN invoices i ON i.id = p.invoice_id
              WHERE p.payment_date >= ? AND p.payment_date <= ?
            )
            SELECT
              COUNT(DISTINCT all_rows.invoice_id) as total_invoices,
              SUM(all_rows.amount_ttc) as total_invoiced_ttc,
              SUM(all_rows.amount_ht) as total_invoiced_ht,
              SUM(all_rows.amount_vat) as total_vat_amount,
              AVG(all_rows.amount_ttc) as avg_invoice_amount,
              COUNT(DISTINCT all_rows.customer_id) as unique_customers
            FROM (
              SELECT invoice_id, customer_id, amount_ttc, amount_ht, amount_vat FROM p
              UNION ALL
              SELECT id as invoice_id, customer_id, total_ttc as amount_ttc, total_ht as amount_ht, vat_amount as amount_vat
              FROM invoices
              WHERE status = 1 AND paid_on >= ? AND paid_on <= ? AND id NOT IN (SELECT invoice_id FROM p)
              UNION ALL
              SELECT id as invoice_id, customer_id,
                     (total_ttc - ${paidBalance}) as amount_ttc,
                     (total_ht * ${paidRatioExpr}) as amount_ht,
                     (vat_amount * ${paidRatioExpr}) as amount_vat
              FROM invoices
              WHERE (${paidBalance} > 0) AND (${paidBalance} < total_ttc)
                AND ${paidDateExpr} >= ? AND ${paidDateExpr} <= ?
                AND id NOT IN (SELECT invoice_id FROM p)
            ) all_rows
          `;
          yearParams = [currentStartDate, currentEndDate, currentStartDate, currentEndDate, currentStartDate, currentEndDate];
        } else {
          // Fallback: calcul à partir des factures et du solde
          sql = `
            SELECT
              COUNT(id) as total_invoices,
              ${sumCaseTTC} as total_invoiced_ttc,
              ${sumCaseHT} as total_invoiced_ht,
              ${sumCaseVAT} as total_vat_amount,
              ${avgCaseTTC} as avg_invoice_amount,
              COUNT(DISTINCT customer_id) as unique_customers
            FROM invoices
          `;
          // Paramètres pour les 3 agrégats + avg (12)
          yearParams = [currentStartDate, currentEndDate, currentStartDate, currentEndDate,
                        currentStartDate, currentEndDate, currentStartDate, currentEndDate,
                        currentStartDate, currentEndDate, currentStartDate, currentEndDate];
        }
      } else {
        sql = `
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
        yearParams = [currentStartDate, currentEndDate];
      }
      if (process.env.MCP_DEBUG === 'true') {
        process.stderr.write(`[MCP DEBUG] SQL totaux annuels: ${sql}\n`);
        process.stderr.write(`[MCP DEBUG] Params totaux annuels: ${JSON.stringify(yearParams)}\n`);
      }
      const yearSummary = await database.get(sql, yearParams);

      // 2. Calcul de la répartition mensuelle pour l'année en cours (ou pour la période si start_date/end_date fournis)
      let monthlySql;
      let monthlyParams = [];
      if (filter_by_payment_date) {
        const yearStart = (start_date && end_date) ? currentStartDate : `${calculatedYear}-01-01`;
        const yearEnd = (start_date && end_date) ? currentEndDate : `${calculatedYear}-12-31`;
        const paymentsCountYear = await database.getPaymentsCountBetween(yearStart, yearEnd);

        if (paymentsCountYear > 0) {
          monthlySql = `
            WITH p AS (
              SELECT p.invoice_id, p.payment_date, p.amount_ttc, p.amount_ht, p.amount_vat
              FROM payments p
              WHERE p.payment_date >= ? AND p.payment_date <= ?
            )
            SELECT month,
                   SUM(total_invoices) as total_invoices,
                   SUM(total_invoiced_ttc) as total_invoiced_ttc,
                   SUM(total_invoiced_ht) as total_invoiced_ht,
                   SUM(total_vat_amount) as total_vat_amount
            FROM (
              SELECT
                strftime('%m', payment_date) as month,
                COUNT(DISTINCT invoice_id) as total_invoices,
                SUM(amount_ttc) as total_invoiced_ttc,
                SUM(amount_ht) as total_invoiced_ht,
                SUM(amount_vat) as total_vat_amount
              FROM p
              GROUP BY month

              UNION ALL

              SELECT
                strftime('%m', paid_on) as month,
                COUNT(id) as total_invoices,
                SUM(total_ttc) as total_invoiced_ttc,
                SUM(total_ht) as total_invoiced_ht,
                SUM(vat_amount) as total_vat_amount
              FROM invoices
              WHERE status = 1 AND paid_on >= ? AND paid_on <= ?
                AND id NOT IN (SELECT invoice_id FROM p)
              GROUP BY month

              UNION ALL

              SELECT
                strftime('%m', ${paidDateExpr}) as month,
                COUNT(id) as total_invoices,
                SUM(total_ttc - ${paidBalance}) as total_invoiced_ttc,
                SUM(total_ht * IIF(total_ttc = 0, 0.0, (total_ttc - ${paidBalance}) / total_ttc)) as total_invoiced_ht,
                SUM(vat_amount * IIF(total_ttc = 0, 0.0, (total_ttc - ${paidBalance}) / total_ttc)) as total_vat_amount
              FROM invoices
              WHERE (${paidBalance} > 0) AND (${paidBalance} < total_ttc)
                AND ${paidDateExpr} >= ? AND ${paidDateExpr} <= ?
                AND id NOT IN (SELECT invoice_id FROM p)
              GROUP BY month
            ) t
            GROUP BY month
            ORDER BY month
          `;
          monthlyParams = [yearStart, yearEnd, yearStart, yearEnd, yearStart, yearEnd];
        } else {
          // Fallback sur la logique basée factures/solde — version UNION pour éviter les doublons et simplifier les paramètres
          monthlySql = `
            SELECT month,
                   SUM(total_invoices) as total_invoices,
                   SUM(total_invoiced_ttc) as total_invoiced_ttc,
                   SUM(total_invoiced_ht) as total_invoiced_ht,
                   SUM(total_vat_amount) as total_vat_amount
            FROM (
              SELECT
                strftime('%m', paid_on) as month,
                COUNT(id) as total_invoices,
                SUM(total_ttc) as total_invoiced_ttc,
                SUM(total_ht) as total_invoiced_ht,
                SUM(vat_amount) as total_vat_amount
              FROM invoices
              WHERE status = 1 AND paid_on >= ? AND paid_on <= ?
              GROUP BY month

              UNION ALL

              SELECT
                strftime('%m', ${paidDateExpr}) as month,
                COUNT(id) as total_invoices,
                SUM(total_ttc - ${paidBalance}) as total_invoiced_ttc,
                SUM(total_ht * IIF(total_ttc = 0, 0.0, (total_ttc - ${paidBalance}) / total_ttc)) as total_invoiced_ht,
                SUM(vat_amount * IIF(total_ttc = 0, 0.0, (total_ttc - ${paidBalance}) / total_ttc)) as total_vat_amount
              FROM invoices
              WHERE (${paidBalance} > 0) AND (${paidBalance} < total_ttc)
                AND ${paidDateExpr} >= ? AND ${paidDateExpr} <= ?
              GROUP BY month
            ) t
            GROUP BY month
            ORDER BY month
          `;
          monthlyParams = [yearStart, yearEnd, yearStart, yearEnd];
        }
      } else {
        monthlySql = `
          SELECT
            strftime('%m', invoice_date) as month,
            COUNT(id) as total_invoices,
            ${sumCaseTTC} as total_invoiced_ttc,
            ${sumCaseHT} as total_invoiced_ht,
            ${sumCaseVAT} as total_vat_amount
          FROM invoices
          ${monthlyWhereClause}
          GROUP BY month
          ORDER BY month
        `;
        monthlyParams = [`${calculatedYear}-01-01`, `${calculatedYear}-12-31`];
      }
      if (process.env.MCP_DEBUG === 'true') {
        process.stderr.write(`[MCP DEBUG] SQL mensuel: ${monthlySql}\n`);
        process.stderr.write(`[MCP DEBUG] Params mensuel: ${JSON.stringify(monthlyParams)}\n`);
      }
      const monthlyResults = await database.all(monthlySql, monthlyParams);

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
