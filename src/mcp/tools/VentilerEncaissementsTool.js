import { BaseTool } from './BaseTool.js';
import { CalculateRevenueTool } from './CalculateRevenueTool.js';

/**
 * Ventile les encaissements (HT/TTC/TVA) mois par mois pour une année donnée.
 * Alias pratique pour la requête « ventile-moi les encaissements 2024, mois par mois ».
 * Utilise calculate_revenue en interne avec filter_by_payment_date=true.
 */
export class VentilerEncaissementsTool extends BaseTool {
  constructor() {
    super(
      'ventiler_encaissements',
      'Ventile les encaissements (HT/TTC/TVA) par mois pour une année (encaissé réel par date de paiement). Identique à calculate_revenue avec filter_by_payment_date=true. Pour du facturé (par date de facture), utilisez calculate_revenue avec filter_by_payment_date=false.',
      {
        year: {
          type: 'number',
          description: 'Année à ventiler (ex: 2024)',
          required: true,
        },
      }
    );
    this.revTool = new CalculateRevenueTool();
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);
      const { year } = args;

      const res = await this.revTool.execute({ year, filter_by_payment_date: true }, database);
      if (!res.success) return res;

      const r = res.data.revenue || {};
      return this.formatResult({
        year: res.data.year,
        query_type: 'paid_monthly',
        total_invoiced_ht: r.total_invoiced_ht || 0,
        total_invoiced_ttc: r.total_invoiced_ttc || 0,
        total_vat_amount: r.total_vat_amount || 0,
        monthly: r.monthly_breakdown || [],
      });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
