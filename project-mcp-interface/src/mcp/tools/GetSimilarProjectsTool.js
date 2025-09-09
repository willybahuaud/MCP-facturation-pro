import { BaseTool } from './BaseTool.js';

/**
 * Outil de recherche de projets similaires
 * Principe SOLID : Single Responsibility - Recherche uniquement des projets similaires
 */
export class GetSimilarProjectsTool extends BaseTool {
  constructor() {
    super(
      'get_similar_projects',
      'Trouve des projets similaires basés sur des mots-clés ou descriptions',
      {
        keywords: {
          type: 'string',
          description: 'Mots-clés ou description du projet',
          required: true
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de résultats (défaut: 10)',
          required: false
        },
        min_amount: {
          type: 'number',
          description: 'Montant minimum des projets similaires',
          required: false
        },
        max_amount: {
          type: 'number',
          description: 'Montant maximum des projets similaires',
          required: false
        }
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);

      const { keywords, limit = 10, min_amount, max_amount } = args;

      // Rechercher dans les devis
      const similarQuotes = await this.findSimilarQuotes(database, keywords, limit, min_amount, max_amount);
      
      // Rechercher dans les factures
      const similarInvoices = await this.findSimilarInvoices(database, keywords, limit, min_amount, max_amount);

      // Combiner et trier par pertinence
      const allProjects = [...similarQuotes, ...similarInvoices]
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, limit);

      return this.formatResult({
        projects: allProjects,
        total: allProjects.length,
        keywords: keywords,
        search_criteria: { min_amount, max_amount }
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  async findSimilarQuotes(database, keywords, limit, min_amount, max_amount) {
    const keywordsArray = keywords.toLowerCase().split(/\s+/);
    
    let sql = `
      SELECT 
        q.*,
        c.name as customer_name,
        c.city as customer_city,
        GROUP_CONCAT(ql.description, ' | ') as all_descriptions,
        COUNT(ql.id) as line_count
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN quote_lines ql ON q.id = ql.quote_id
      WHERE (
        q.notes LIKE ? OR
        ql.description LIKE ?
      )
    `;

    const params = [`%${keywords}%`, `%${keywords}%`];

    if (min_amount) {
      sql += ' AND q.total_ttc >= ?';
      params.push(min_amount);
    }

    if (max_amount) {
      sql += ' AND q.total_ttc <= ?';
      params.push(max_amount);
    }

    sql += `
      GROUP BY q.id
      ORDER BY q.quote_date DESC
      LIMIT ?
    `;
    params.push(limit * 2); // Récupérer plus pour le scoring

    const quotes = await database.all(sql, params);

    // Calculer le score de pertinence
    return quotes.map(quote => ({
      ...quote,
      type: 'quote',
      relevance_score: this.calculateRelevanceScore(keywordsArray, quote),
      project_summary: this.generateProjectSummary(quote)
    }));
  }

  async findSimilarInvoices(database, keywords, limit, min_amount, max_amount) {
    const keywordsArray = keywords.toLowerCase().split(/\s+/);
    
    let sql = `
      SELECT 
        i.*,
        c.name as customer_name,
        c.city as customer_city,
        GROUP_CONCAT(il.description, ' | ') as all_descriptions,
        COUNT(il.id) as line_count
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN invoice_lines il ON i.id = il.invoice_id
      WHERE (
        i.notes LIKE ? OR
        il.description LIKE ?
      )
    `;

    const params = [`%${keywords}%`, `%${keywords}%`];

    if (min_amount) {
      sql += ' AND i.total_ttc >= ?';
      params.push(min_amount);
    }

    if (max_amount) {
      sql += ' AND i.total_ttc <= ?';
      params.push(max_amount);
    }

    sql += `
      GROUP BY i.id
      ORDER BY i.invoice_date DESC
      LIMIT ?
    `;
    params.push(limit * 2); // Récupérer plus pour le scoring

    const invoices = await database.all(sql, params);

    // Calculer le score de pertinence
    return invoices.map(invoice => ({
      ...invoice,
      type: 'invoice',
      relevance_score: this.calculateRelevanceScore(keywordsArray, invoice),
      project_summary: this.generateProjectSummary(invoice)
    }));
  }

  calculateRelevanceScore(keywords, project) {
    let score = 0;
    const text = `${project.notes || ''} ${project.all_descriptions || ''}`.toLowerCase();

    // Score basé sur le nombre de mots-clés trouvés
    keywords.forEach(keyword => {
      const matches = (text.match(new RegExp(keyword, 'g')) || []).length;
      score += matches * 2;
    });

    // Bonus pour les correspondances exactes dans les descriptions
    keywords.forEach(keyword => {
      if (project.all_descriptions && project.all_descriptions.toLowerCase().includes(keyword)) {
        score += 5;
      }
    });

    // Bonus pour les correspondances dans les notes
    keywords.forEach(keyword => {
      if (project.notes && project.notes.toLowerCase().includes(keyword)) {
        score += 3;
      }
    });

    // Normaliser le score (0-100)
    return Math.min(100, Math.max(0, score));
  }

  generateProjectSummary(project) {
    const lines = project.all_descriptions ? project.all_descriptions.split(' | ') : [];
    const uniqueLines = [...new Set(lines)].slice(0, 3);
    
    return {
      main_services: uniqueLines,
      customer: project.customer_name,
      city: project.customer_city,
      amount: project.total_ttc,
      date: project.quote_date || project.invoice_date,
      line_count: project.line_count
    };
  }
}
