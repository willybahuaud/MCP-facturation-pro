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

      // Si des dates spécifiques sont fournies, calculer pour cette période
      if (start_date && end_date) {
        const periodData = await this.getCustomPeriodRevenue(database, start_date, end_date, status, filter_by_payment_date);
        return this.formatResult({
          period: {
            start_date: start_date,
            end_date: end_date
          },
          revenue: periodData
        });
      }

      // Si une année spécifique est demandée
      if (year) {
        const yearData = await this.getYearRevenue(database, year, status, filter_by_payment_date);
        return this.formatResult({
          year: year,
          revenue: yearData
        });
      }

      // Si une période est demandée
      if (start_year && end_year) {
        const periodData = await this.getPeriodRevenue(database, start_year, end_year, status);
        return this.formatResult({
          period: {
            start_year: start_year,
            end_year: end_year
          },
          revenue: periodData
        });
      }

      // Par défaut, calculer les 5 dernières années
      const currentYear = new Date().getFullYear();
      const years = [];
      for (let i = 4; i >= 0; i--) {
        years.push(currentYear - i);
      }

      const allYearsData = await Promise.all(
        years.map(async (y) => {
          const yearData = await this.getYearRevenue(database, y, status);
          return {
            year: y,
            ...yearData
          };
        })
      );

      return this.formatResult({
        years: allYearsData,
        total_revenue: allYearsData.reduce((sum, year) => sum + year.total_invoiced, 0)
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  async getYearRevenue(database, year, status, filter_by_payment_date = false) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const dateField = filter_by_payment_date ? 'paid_on' : 'invoice_date';
    let sql;
    
    if (filter_by_payment_date) {
      // Pour l'encaissé, calculer le montant réellement perçu (total_ttc - balance)
      sql = `
        SELECT 
          COUNT(*) as total_invoices,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN total_ttc 
            ELSE total_ttc - CAST(balance AS REAL)
          END) as total_invoiced,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN total_ht 
            ELSE total_ht - (total_ht * (CAST(balance AS REAL) / total_ttc))
          END) as total_ht,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN vat_amount 
            ELSE vat_amount - (vat_amount * (CAST(balance AS REAL) / total_ttc))
          END) as total_vat,
          AVG(CASE 
            WHEN balance IS NULL OR balance = '' THEN total_ttc 
            ELSE total_ttc - CAST(balance AS REAL)
          END) as avg_invoice_amount,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM invoices 
        WHERE ${dateField} >= ? AND ${dateField} <= ?
          AND ${dateField} IS NOT NULL
          AND (balance IS NULL OR balance = '' OR CAST(balance AS REAL) < total_ttc)
      `;
    } else {
      sql = `
        SELECT 
          COUNT(*) as total_invoices,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN total_ttc 
            ELSE total_ttc - CAST(balance AS REAL)
          END) as total_invoiced,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN total_ht 
            ELSE total_ht - (total_ht * (CAST(balance AS REAL) / total_ttc))
          END) as total_ht,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN vat_amount 
            ELSE vat_amount - (vat_amount * (CAST(balance AS REAL) / total_ttc))
          END) as total_vat,
          AVG(CASE 
            WHEN balance IS NULL OR balance = '' THEN total_ttc 
            ELSE total_ttc - CAST(balance AS REAL)
          END) as avg_invoice_amount,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM invoices 
        WHERE ${dateField} >= ? AND ${dateField} <= ?
      `;
    }

    const params = [startDate, endDate];

    // Ajouter le filtre de statut si spécifié
    if (!filter_by_payment_date) {
      if (status === 'paye') {
        sql += ' AND status = 1';
      } else if (status === 'non_paye') {
        sql += ' AND status = 0';
      }
    }
    // Note: quand filter_by_payment_date=true, on inclut toutes les factures 
    // (même partiellement payées) et on calcule le montant encaissé via balance

    const result = await database.get(sql, params);

    // Récupérer aussi les détails par mois
    const monthlyData = await this.getMonthlyRevenue(database, year, status, filter_by_payment_date);

    return {
      ...result,
      monthly_breakdown: monthlyData
    };
  }

  async getPeriodRevenue(database, startYear, endYear, status) {
    const startDate = `${startYear}-01-01`;
    const endDate = `${endYear}-12-31`;

    let sql = `
      SELECT 
        strftime('%Y', invoice_date) as year,
        COUNT(*) as total_invoices,
        SUM(total_ttc) as total_invoiced,
        SUM(total_ht) as total_ht,
        SUM(vat_amount) as total_vat,
        AVG(total_ttc) as avg_invoice_amount,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM invoices 
      WHERE invoice_date >= ? AND invoice_date <= ?
    `;

    const params = [startDate, endDate];

    // Ajouter le filtre de statut si spécifié
    if (status === 'paye') {
      sql += ' AND status = 1';
    } else if (status === 'non_paye') {
      sql += ' AND status = 0';
    }

    sql += ' GROUP BY strftime("%Y", invoice_date) ORDER BY year';

    const results = await database.all(sql, params);

    const totalRevenue = results.reduce((sum, year) => sum + (year.total_invoiced || 0), 0);

    return {
      years: results,
      total_revenue: totalRevenue,
      period_total: {
        total_invoices: results.reduce((sum, year) => sum + (year.total_invoices || 0), 0),
        total_invoiced: totalRevenue,
        unique_customers: new Set(results.flatMap(year => year.unique_customers || [])).size
      }
    };
  }

  async getMonthlyRevenue(database, year, status, filter_by_payment_date = false) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const dateField = filter_by_payment_date ? 'paid_on' : 'invoice_date';
    let sql;
    
    if (filter_by_payment_date) {
      // Pour l'encaissé mensuel, calculer le montant réellement perçu
      sql = `
        SELECT 
          strftime('%m', ${dateField}) as month,
          COUNT(*) as total_invoices,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN total_ttc 
            ELSE total_ttc - CAST(balance AS REAL)
          END) as total_invoiced,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN total_ht 
            ELSE total_ht - (total_ht * (CAST(balance AS REAL) / total_ttc))
          END) as total_ht,
          SUM(CASE 
            WHEN balance IS NULL OR balance = '' THEN vat_amount 
            ELSE vat_amount - (vat_amount * (CAST(balance AS REAL) / total_ttc))
          END) as total_vat
        FROM invoices 
        WHERE ${dateField} >= ? AND ${dateField} <= ?
          AND ${dateField} IS NOT NULL
          AND (balance IS NULL OR balance = '' OR CAST(balance AS REAL) < total_ttc)
      `;
    } else {
      sql = `
        SELECT 
          strftime('%m', ${dateField}) as month,
          COUNT(*) as total_invoices,
          SUM(total_ttc) as total_invoiced,
          SUM(total_ht) as total_ht,
          SUM(vat_amount) as total_vat
        FROM invoices 
        WHERE ${dateField} >= ? AND ${dateField} <= ?
      `;
    }

    const params = [startDate, endDate];

    // Ajouter le filtre de statut si spécifié
    if (!filter_by_payment_date) {
      if (status === 'paye') {
        sql += ' AND status = 1';
      } else if (status === 'non_paye') {
        sql += ' AND status = 0';
      }
    }

    sql += ` GROUP BY strftime("%m", ${dateField}) ORDER BY month`;

    const results = await database.all(sql, params);

    // Créer un tableau complet des 12 mois
    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, '0');
      const monthData = results.find(r => r.month === monthStr);
      
      monthlyData.push({
        month: month,
        month_name: this.getMonthName(month),
        total_invoices: monthData?.total_invoices || 0,
        total_invoiced: monthData?.total_invoiced || 0,
        total_ht: monthData?.total_ht || 0,
        total_vat: monthData?.total_vat || 0
      });
    }

    return monthlyData;
  }

  async getCustomPeriodRevenue(database, startDate, endDate, status) {
    let sql = `
      SELECT 
        COUNT(*) as total_invoices,
        SUM(total_ttc) as total_invoiced,
        SUM(total_ht) as total_ht,
        SUM(vat_amount) as total_vat,
        AVG(total_ttc) as avg_invoice_amount,
        COUNT(DISTINCT customer_id) as unique_customers,
        MIN(invoice_date) as first_invoice_date,
        MAX(invoice_date) as last_invoice_date
      FROM invoices 
      WHERE invoice_date >= ? AND invoice_date <= ?
    `;

    const params = [startDate, endDate];

    // Ajouter le filtre de statut si spécifié
    if (status === 'paye') {
      sql += ' AND status = 1';
    } else if (status === 'non_paye') {
      sql += ' AND status = 0';
    }

    const result = await database.get(sql, params);

    // Récupérer aussi les détails par mois dans la période
    const monthlyData = await this.getCustomPeriodMonthlyRevenue(database, startDate, endDate, status);

    return {
      ...result,
      monthly_breakdown: monthlyData
    };
  }

  async getCustomPeriodMonthlyRevenue(database, startDate, endDate, status) {
    let sql = `
      SELECT 
        strftime('%Y', invoice_date) as year,
        strftime('%m', invoice_date) as month,
        COUNT(*) as total_invoices,
        SUM(total_ttc) as total_invoiced,
        SUM(total_ht) as total_ht,
        SUM(vat_amount) as total_vat
      FROM invoices 
      WHERE invoice_date >= ? AND invoice_date <= ?
    `;

    const params = [startDate, endDate];

    // Ajouter le filtre de statut si spécifié
    if (status === 'paye') {
      sql += ' AND status = 1';
    } else if (status === 'non_paye') {
      sql += ' AND status = 0';
    }

    sql += ' GROUP BY strftime("%Y", invoice_date), strftime("%m", invoice_date) ORDER BY year, month';

    const results = await database.all(sql, params);

    // Formater les résultats
    return results.map(row => ({
      year: parseInt(row.year),
      month: parseInt(row.month),
      month_name: this.getMonthName(parseInt(row.month)),
      total_invoices: row.total_invoices,
      total_invoiced: row.total_invoiced,
      total_ht: row.total_ht,
      total_vat: row.total_vat
    }));
  }

  getMonthName(month) {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[month - 1];
  }
}
