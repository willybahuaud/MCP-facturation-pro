import { BaseTool } from './BaseTool.js';

/**
 * Outil de recherche de projets similaires pour estimation
 * Trouve des projets similaires dans l'historique pour aider à l'estimation
 */
export class EstimateProjectCostTool extends BaseTool {
  constructor() {
    super(
      'estimate_project_cost',
      'Trouve des projets similaires dans l\'historique pour aider à l\'estimation de coût',
      {
        brief: {
          type: 'string',
          description: 'Brief de projet à analyser',
          required: true
        },
        similar_projects_limit: {
          type: 'number',
          description: 'Nombre de projets similaires à retourner (défaut: 10)',
          required: false
        },
        min_amount: {
          type: 'number',
          description: 'Montant minimum des projets à considérer',
          required: false
        },
        max_amount: {
          type: 'number',
          description: 'Montant maximum des projets à considérer',
          required: false
        }
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);

      const { brief, similar_projects_limit = 10, min_amount, max_amount } = args;
      
      // Analyser le brief pour comprendre le type de projet
      const briefAnalysis = this.analyzeBrief(brief);
      
      // Trouver des projets similaires
      const similarProjects = await this.findSimilarProjects(
        database, 
        briefAnalysis, 
        similar_projects_limit,
        min_amount,
        max_amount
      );
      
      // Retourner les données brutes pour qu'un LLM externe puisse les analyser
      return this.formatResult({
        brief_analysis: briefAnalysis,
        similar_projects: similarProjects,
        total_found: similarProjects.length,
        pricing_insights: this.extractPricingInsights(similarProjects),
        usage_note: "Utilisez ces données avec un LLM externe pour faire une estimation personnalisée basée sur vos habitudes de tarification"
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  analyzeBrief(brief) {
    const text = brief.toLowerCase();
    
    return {
      project_type: this.detectProjectType(text),
      complexity: this.detectComplexity(text),
      features: this.extractFeatures(text),
      technologies: this.extractTechnologies(text),
      size: this.estimateSize(text),
      keywords: this.extractKeywords(text)
    };
  }

  detectProjectType(text) {
    const types = {
      'e-commerce': ['e-commerce', 'boutique', 'shop', 'vente en ligne', 'panier', 'commande', 'produit'],
      'site_vitrine': ['site vitrine', 'présentation', 'corporate', 'institutionnel', 'showcase'],
      'application_web': ['application web', 'web app', 'dashboard', 'interface', 'gestion'],
      'mobile': ['mobile', 'app mobile', 'ios', 'android', 'smartphone'],
      'api': ['api', 'service', 'microservice', 'backend', 'endpoint'],
      'cms': ['cms', 'wordpress', 'drupal', 'content management', 'gestion de contenu'],
      'blog': ['blog', 'actualités', 'articles', 'news'],
      'portfolio': ['portfolio', 'galerie', 'créatif', 'artiste', 'photographe']
    };

    for (const [type, keywords] of Object.entries(types)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return type;
      }
    }
    
    return 'autre';
  }

  detectComplexity(text) {
    const complexityIndicators = {
      'simple': ['simple', 'basique', 'standard', 'classique', 'template'],
      'moyenne': ['moyen', 'intermédiaire', 'personnalisé', 'sur mesure'],
      'complexe': ['complexe', 'avancé', 'sophistiqué', 'innovant', 'unique', 'spécifique']
    };

    for (const [level, keywords] of Object.entries(complexityIndicators)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return level;
      }
    }

    const featureCount = this.extractFeatures(text).length;
    if (featureCount <= 3) return 'simple';
    if (featureCount <= 6) return 'moyenne';
    return 'complexe';
  }

  extractFeatures(text) {
    const features = {
      'authentification': ['connexion', 'login', 'authentification', 'compte', 'utilisateur'],
      'paiement': ['paiement', 'stripe', 'paypal', 'cb', 'carte bancaire', 'facturation'],
      'panier': ['panier', 'commande', 'achat', 'boutique'],
      'recherche': ['recherche', 'filtre', 'tri', 'catalogue'],
      'admin': ['admin', 'administration', 'gestion', 'backoffice', 'dashboard'],
      'seo': ['seo', 'référencement', 'google', 'moteur de recherche'],
      'responsive': ['responsive', 'mobile', 'tablet', 'adaptatif'],
      'multilingue': ['multilingue', 'traduction', 'langue', 'international'],
      'api': ['api', 'intégration', 'webhook', 'service'],
      'analytics': ['analytics', 'statistique', 'suivi', 'métrique'],
      'newsletter': ['newsletter', 'email', 'marketing', 'communication'],
      'chat': ['chat', 'messagerie', 'support', 'contact'],
      'galerie': ['galerie', 'photo', 'image', 'média'],
      'blog': ['blog', 'actualité', 'article', 'news'],
      'formulaire': ['formulaire', 'contact', 'demande', 'devis']
    };

    const detectedFeatures = [];
    for (const [feature, keywords] of Object.entries(features)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        detectedFeatures.push(feature);
      }
    }

    return detectedFeatures;
  }

  extractTechnologies(text) {
    const technologies = {
      'wordpress': ['wordpress', 'wp'],
      'react': ['react', 'jsx'],
      'vue': ['vue', 'vuejs'],
      'angular': ['angular'],
      'node': ['node', 'nodejs'],
      'php': ['php'],
      'python': ['python', 'django', 'flask'],
      'laravel': ['laravel'],
      'symfony': ['symfony'],
      'mysql': ['mysql'],
      'postgresql': ['postgresql', 'postgres'],
      'mongodb': ['mongodb', 'mongo'],
      'redis': ['redis'],
      'docker': ['docker', 'container'],
      'aws': ['aws', 'amazon'],
      'azure': ['azure', 'microsoft']
    };

    const detectedTech = [];
    for (const [tech, keywords] of Object.entries(technologies)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        detectedTech.push(tech);
      }
    }

    return detectedTech;
  }

  estimateSize(text) {
    const sizeIndicators = {
      'petit': ['petit', 'mini', 'simple', '1-5 pages'],
      'moyen': ['moyen', 'standard', '10-20 pages', 'modéré'],
      'grand': ['grand', 'important', 'complet', '50+ pages', 'entreprise']
    };

    for (const [size, keywords] of Object.entries(sizeIndicators)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return size;
      }
    }

    const featureCount = this.extractFeatures(text).length;
    if (featureCount <= 3) return 'petit';
    if (featureCount <= 6) return 'moyen';
    return 'grand';
  }

  extractKeywords(text) {
    const words = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))
      .slice(0, 10);

    return [...new Set(words)];
  }

  isStopWord(word) {
    const stopWords = ['avec', 'pour', 'dans', 'sur', 'sous', 'par', 'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'mais', 'donc', 'car', 'que', 'qui', 'quoi', 'où', 'quand', 'comment', 'pourquoi'];
    return stopWords.includes(word.toLowerCase());
  }

  getMinimumAmountForProjectType(projectType) {
    const minimumAmounts = {
      'e-commerce': 5000,      // E-commerce minimum 5000€
      'application_web': 3000, // Application web minimum 3000€
      'site_vitrine': 1500,    // Site vitrine minimum 1500€
      'mobile': 4000,          // App mobile minimum 4000€
      'api': 2000,             // API minimum 2000€
      'cms': 2000,             // CMS minimum 2000€
      'blog': 1000,            // Blog minimum 1000€
      'portfolio': 1200,       // Portfolio minimum 1200€
      'autre': 1000            // Autre minimum 1000€
    };
    
    return minimumAmounts[projectType] || 1000;
  }

  async findSimilarProjects(database, briefAnalysis, limit, minAmount, maxAmount) {
    // Utiliser les montants fournis ou des valeurs par défaut
    const defaultMinAmount = this.getMinimumAmountForProjectType(briefAnalysis.project_type);
    const finalMinAmount = minAmount || defaultMinAmount;
    const finalMaxAmount = maxAmount || (defaultMinAmount * 20); // Maximum 20x le minimum
    
    // Recherche simplifiée car les quote_lines sont vides
    let sql = `
      SELECT 
        q.id,
        q.quote_number,
        q.quote_date,
        q.total_ttc,
        q.total_ht,
        q.notes,
        c.name as customer_name,
        c.city as customer_city
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.total_ttc >= ? AND q.total_ttc <= ? AND q.total_ttc > 0
      ORDER BY q.quote_date DESC
      LIMIT ?
    `;

    const quotes = await database.all(sql, [finalMinAmount, finalMaxAmount, limit * 2]);

    // Calculer la similarité basée sur les montants et les données disponibles
    const projectsWithSimilarity = quotes.map(quote => {
      const similarity = this.calculateSimilarity(briefAnalysis, quote);
      return {
        ...quote,
        similarity_score: similarity.score,
        similarity_reasons: similarity.reasons
      };
    });

    return projectsWithSimilarity
      .filter(p => p.similarity_score > 10) // Seuil très bas car peu de données
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);
  }

  calculateSimilarity(briefAnalysis, project) {
    let score = 0;
    const reasons = [];

    // Comme les notes sont vides, on se base sur les montants et les données disponibles
    const projectText = (project.notes || '').toLowerCase();
    const projectAmount = project.total_ttc;

    // Similarité basée sur le montant (40% du score)
    const amountSimilarity = this.calculateAmountSimilarity(briefAnalysis, projectAmount);
    score += amountSimilarity.score;
    if (amountSimilarity.reason) {
      reasons.push(amountSimilarity.reason);
    }

    // Similarité basée sur les notes si disponibles (30% du score)
    if (project.notes && project.notes.trim()) {
      const projectType = this.detectProjectType(projectText);
      if (projectType === briefAnalysis.project_type) {
        score += 30;
        reasons.push(`Même type détecté: ${projectType}`);
      }
    } else {
      // Si pas de notes, on donne un score de base basé sur le montant
      score += 20;
      reasons.push('Projet similaire par montant');
    }

    // Similarité basée sur la date (projets récents = plus pertinents) (20% du score)
    const dateSimilarity = this.calculateDateSimilarity(project.quote_date);
    score += dateSimilarity.score;
    if (dateSimilarity.reason) {
      reasons.push(dateSimilarity.reason);
    }

    // Similarité basée sur le client (10% du score)
    if (project.customer_name) {
      score += 10;
      reasons.push(`Client: ${project.customer_name}`);
    }

    return {
      score: Math.round(score),
      reasons: reasons
    };
  }

  calculateAmountSimilarity(briefAnalysis, projectAmount) {
    const expectedRanges = {
      'e-commerce': { min: 5000, max: 25000 },
      'application_web': { min: 3000, max: 15000 },
      'site_vitrine': { min: 1500, max: 8000 },
      'mobile': { min: 4000, max: 20000 },
      'api': { min: 2000, max: 10000 },
      'cms': { min: 2000, max: 12000 },
      'blog': { min: 1000, max: 5000 },
      'portfolio': { min: 1200, max: 6000 },
      'autre': { min: 1000, max: 8000 }
    };

    const range = expectedRanges[briefAnalysis.project_type] || expectedRanges['autre'];
    
    if (projectAmount >= range.min && projectAmount <= range.max) {
      return { score: 40, reason: `Montant cohérent: ${projectAmount}€` };
    } else if (projectAmount >= range.min * 0.5 && projectAmount <= range.max * 1.5) {
      return { score: 20, reason: `Montant proche: ${projectAmount}€` };
    } else {
      return { score: 5, reason: `Montant différent: ${projectAmount}€` };
    }
  }

  calculateDateSimilarity(projectDate) {
    const projectDateObj = new Date(projectDate);
    const now = new Date();
    const monthsDiff = (now - projectDateObj) / (1000 * 60 * 60 * 24 * 30);

    if (monthsDiff <= 6) {
      return { score: 20, reason: 'Projet récent (≤6 mois)' };
    } else if (monthsDiff <= 12) {
      return { score: 15, reason: 'Projet récent (≤12 mois)' };
    } else if (monthsDiff <= 24) {
      return { score: 10, reason: 'Projet moyennement récent (≤24 mois)' };
    } else {
      return { score: 5, reason: 'Projet ancien (>24 mois)' };
    }
  }

  extractPricingInsights(similarProjects) {
    if (similarProjects.length === 0) {
      return {
        message: "Aucun projet similaire trouvé pour analyser les habitudes de tarification",
        recommendations: [
          "Consultez l'historique complet des devis pour ce type de projet",
          "Utilisez les outils de recherche de devis et factures pour explorer vos tarifications passées"
        ]
      };
    }

    const costs = similarProjects.map(p => p.total_ttc);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const avgCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    const medianCost = this.calculateMedian(costs);

    // Analyser les patterns de tarification
    const recentProjects = similarProjects.filter(p => {
      const projectDate = new Date(p.quote_date);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return projectDate > sixMonthsAgo;
    });

    const recentAvgCost = recentProjects.length > 0 
      ? recentProjects.reduce((sum, p) => sum + p.total_ttc, 0) / recentProjects.length
      : avgCost;

    return {
      pricing_range: {
        min: Math.round(minCost),
        max: Math.round(maxCost),
        average: Math.round(avgCost),
        median: Math.round(medianCost)
      },
      recent_trend: {
        recent_average: Math.round(recentAvgCost),
        recent_projects_count: recentProjects.length,
        trend_direction: recentAvgCost > avgCost ? 'hausse' : recentAvgCost < avgCost ? 'baisse' : 'stable'
      },
      project_breakdown: similarProjects.map(p => ({
        quote_number: p.quote_number,
        customer: p.customer_name,
        amount: p.total_ttc,
        date: p.quote_date,
        similarity_score: p.similarity_score,
        notes: p.notes?.substring(0, 100) + '...' || 'Aucune note'
      })),
      recommendations: [
        "Analysez les détails des projets similaires pour comprendre la composition des tarifs",
        "Consultez les lignes de devis pour identifier les postes récurrents",
        "Comparez avec des projets récents pour détecter les tendances de tarification"
      ]
    };
  }

  calculateMedian(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

}
