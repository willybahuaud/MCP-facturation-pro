import { BaseTool } from './BaseTool.js';

/**
 * Outil de recherche avancée de projets similaires
 * Trouve des projets similaires basés sur l'analyse de brief
 */
export class FindSimilarProjectsAdvancedTool extends BaseTool {
  constructor() {
    super(
      'find_similar_projects_advanced',
      'Trouve des projets similaires basés sur l\'analyse d\'un brief de projet',
      {
        brief: {
          type: 'string',
          description: 'Brief de projet à analyser',
          required: true
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de résultats (défaut: 5)',
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
        },
        project_type: {
          type: 'string',
          description: 'Type de projet à rechercher',
          required: false
        }
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);

      const { brief, limit = 5, min_amount, max_amount, project_type } = args;
      
      // Analyser le brief
      const briefAnalysis = this.analyzeBrief(brief);
      
      // Rechercher des projets similaires
      const similarProjects = await this.findSimilarProjects(
        database, 
        briefAnalysis, 
        { limit, min_amount, max_amount, project_type }
      );
      
      return this.formatResult({
        brief_analysis: briefAnalysis,
        similar_projects: similarProjects,
        total_found: similarProjects.length
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

  async findSimilarProjects(database, briefAnalysis, filters) {
    const { limit, min_amount, max_amount, project_type } = filters;
    
    // Construire la requête SQL
    let sql = `
      SELECT 
        q.id,
        q.quote_number,
        q.quote_date,
        q.total_ttc,
        q.total_ht,
        q.notes,
        c.name as customer_name,
        c.city as customer_city,
        GROUP_CONCAT(ql.description, ' | ') as descriptions
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN quote_lines ql ON q.id = ql.quote_id
      WHERE 1=1
    `;

    const params = [];

    // Filtres de montant
    if (min_amount) {
      sql += ' AND q.total_ttc >= ?';
      params.push(min_amount);
    }
    if (max_amount) {
      sql += ' AND q.total_ttc <= ?';
      params.push(max_amount);
    }

    // Filtre de type de projet (si spécifié)
    if (project_type) {
      sql += ' AND q.notes LIKE ?';
      params.push(`%${project_type}%`);
    }

    sql += ' GROUP BY q.id ORDER BY q.quote_date DESC';

    const quotes = await database.all(sql, params);

    // Calculer la similarité pour chaque projet
    const projectsWithSimilarity = quotes.map(quote => {
      const similarity = this.calculateSimilarity(briefAnalysis, quote);
      return {
        ...quote,
        display_id: quote.quote_ref ?? quote.quote_number,
        similarity_score: similarity.score,
        similarity_reasons: similarity.reasons
      };
    });

    // Trier par score de similarité et limiter
    return projectsWithSimilarity
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);
  }

  calculateSimilarity(briefAnalysis, project) {
    let score = 0;
    const reasons = [];

    const projectText = (project.notes + ' ' + project.descriptions).toLowerCase();

    // 1. Similarité de type de projet (40% du score)
    const projectType = this.detectProjectType(projectText);
    if (projectType === briefAnalysis.project_type) {
      score += 40;
      reasons.push(`Même type de projet: ${projectType}`);
    }

    // 2. Similarité de complexité (20% du score)
    const complexity = this.detectComplexity(projectText);
    if (complexity === briefAnalysis.complexity) {
      score += 20;
      reasons.push(`Même niveau de complexité: ${complexity}`);
    }

    // 3. Similarité de fonctionnalités (25% du score)
    const projectFeatures = this.extractFeatures(projectText);
    const commonFeatures = briefAnalysis.features.filter(f => projectFeatures.includes(f));
    const featureScore = (commonFeatures.length / Math.max(briefAnalysis.features.length, 1)) * 25;
    score += featureScore;
    if (commonFeatures.length > 0) {
      reasons.push(`Fonctionnalités communes: ${commonFeatures.join(', ')}`);
    }

    // 4. Similarité de technologies (10% du score)
    const projectTech = this.extractTechnologies(projectText);
    const commonTech = briefAnalysis.technologies.filter(t => projectTech.includes(t));
    const techScore = (commonTech.length / Math.max(briefAnalysis.technologies.length, 1)) * 10;
    score += techScore;
    if (commonTech.length > 0) {
      reasons.push(`Technologies communes: ${commonTech.join(', ')}`);
    }

    // 5. Similarité de taille (5% du score)
    const projectSize = this.estimateSize(projectText);
    if (projectSize === briefAnalysis.size) {
      score += 5;
      reasons.push(`Même taille de projet: ${projectSize}`);
    }

    return {
      score: Math.round(score),
      reasons: reasons
    };
  }
}
