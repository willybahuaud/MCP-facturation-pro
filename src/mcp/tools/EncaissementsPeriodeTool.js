import { BaseTool } from './BaseTool.js';
import { CalculateRevenueTool } from './CalculateRevenueTool.js';

/**
 * Encaissements sur une période (date → date)
 * Utilise calculate_revenue avec start_date/end_date et filter_by_payment_date=true.
 * Parfait pour: « entre le 15 mars 2025 et aujourd'hui ».
 */
export class EncaissementsPeriodeTool extends BaseTool {
  constructor() {
    super(
      'encaissements_periode',
      "Calcule l'encaissé (HT/TTC/TVA) sur une période précise (date à date). Identique à calculate_revenue avec start_date/end_date et filter_by_payment_date=true.",
      {
        start_date: {
          type: 'string',
          description: 'Date de début au format YYYY-MM-DD',
          required: true,
        },
        end_date: {
          type: 'string',
          description: "Date de fin au format YYYY-MM-DD (par défaut: aujourd'hui)",
          required: false,
        },
      }
    );
    this.revTool = new CalculateRevenueTool();
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);
      const { start_date } = args;
      let { end_date } = args;
      if (!end_date) {
        end_date = new Date().toISOString().split('T')[0];
      }

      const res = await this.revTool.execute({ start_date, end_date, filter_by_payment_date: true }, database);
      return res;
    } catch (error) {
      return this.handleError(error);
    }
  }
}

