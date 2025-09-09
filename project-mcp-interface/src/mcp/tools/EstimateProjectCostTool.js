import { BaseTool } from './BaseTool.js';

/**
 * Outil d'estimation de coût de projet
 * Estime le coût d'un projet basé sur l'analyse de brief et projets similaires
 */
export class EstimateProjectCostTool extends BaseTool {
  constructor() {
    super(
      'estimate_project_cost',
      'Estime le coût d\'un projet basé sur l\'analyse de brief et projets similaires',
      {
        brief: {
          type: 'string',
          description: 'Brief de projet à estimer',
          required: true
        },
        similar_projects_limit: {
          type: 'number',
          description: 'Nombre de projets similaires à considérer (défaut: 5)',
          required: false
        },
        include_breakdown: {
          type: 'boolean',
          description: 'Inclure le détail par phase (défaut: true)',
          required: false
        }
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);

      const { brief, similar_projects_limit = 5, include_breakdown = true } = args;
      
      // Analyser le brief
      const briefAnalysis = this.analyzeBrief(brief);
      
      // Trouver des projets similaires
      const similarProjects = await this.findSimilarProjects(database, briefAnalysis, similar_projects_limit);
      
      // Calculer l'estimation
      const estimation = this.calculateEstimation(briefAnalysis, similarProjects);
      
      // Ajouter le détail par phase si demandé
      if (include_breakdown) {
        estimation.breakdown = this.generateBreakdown(briefAnalysis, similarProjects);
      }
      
      return this.formatResult({
        brief_analysis: briefAnalysis,
        similar_projects_used: similarProjects.length,
        estimation: estimation,
        confidence: this.calculateConfidence(similarProjects)
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

  async findSimilarProjects(database, briefAnalysis, limit) {
    // Définir un montant minimum selon le type de projet
    const minAmount = this.getMinimumAmountForProjectType(briefAnalysis.project_type);
    
    let sql = `
      SELECT 
        q.id,
        q.quote_number,
        q.quote_date,
        q.total_ttc,
        q.total_ht,
        q.notes,
        c.name as customer_name,
        GROUP_CONCAT(ql.description, ' | ') as descriptions
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN quote_lines ql ON q.id = ql.quote_id
      WHERE q.total_ttc >= ? AND q.total_ttc > 0
      GROUP BY q.id 
      ORDER BY q.quote_date DESC
      LIMIT ?
    `;

    const quotes = await database.all(sql, [minAmount, limit * 5]); // Récupérer plus pour filtrer

    // Calculer la similarité et filtrer
    const projectsWithSimilarity = quotes.map(quote => {
      const similarity = this.calculateSimilarity(briefAnalysis, quote);
      return {
        ...quote,
        similarity_score: similarity.score,
        similarity_reasons: similarity.reasons
      };
    });

    return projectsWithSimilarity
      .filter(p => p.similarity_score > 50) // Seuil minimum de similarité plus élevé
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);
  }

  calculateSimilarity(briefAnalysis, project) {
    let score = 0;
    const reasons = [];

    const projectText = (project.notes + ' ' + project.descriptions).toLowerCase();

    // Similarité de type de projet
    const projectType = this.detectProjectType(projectText);
    if (projectType === briefAnalysis.project_type) {
      score += 40;
      reasons.push(`Même type: ${projectType}`);
    }

    // Similarité de complexité
    const complexity = this.detectComplexity(projectText);
    if (complexity === briefAnalysis.complexity) {
      score += 20;
      reasons.push(`Même complexité: ${complexity}`);
    }

    // Similarité de fonctionnalités
    const projectFeatures = this.extractFeatures(projectText);
    const commonFeatures = briefAnalysis.features.filter(f => projectFeatures.includes(f));
    const featureScore = (commonFeatures.length / Math.max(briefAnalysis.features.length, 1)) * 25;
    score += featureScore;
    if (commonFeatures.length > 0) {
      reasons.push(`Fonctionnalités: ${commonFeatures.join(', ')}`);
    }

    // Similarité de technologies
    const projectTech = this.extractTechnologies(projectText);
    const commonTech = briefAnalysis.technologies.filter(t => projectTech.includes(t));
    const techScore = (commonTech.length / Math.max(briefAnalysis.technologies.length, 1)) * 10;
    score += techScore;
    if (commonTech.length > 0) {
      reasons.push(`Technologies: ${commonTech.join(', ')}`);
    }

    // Similarité de taille
    const projectSize = this.estimateSize(projectText);
    if (projectSize === briefAnalysis.size) {
      score += 5;
      reasons.push(`Même taille: ${projectSize}`);
    }

    return {
      score: Math.round(score),
      reasons: reasons
    };
  }

  calculateEstimation(briefAnalysis, similarProjects) {
    if (similarProjects.length === 0) {
      // Estimation par défaut basée sur le type de projet
      const defaultEstimation = this.getDefaultEstimation(briefAnalysis);
      return {
        estimated_cost_min: defaultEstimation.min,
        estimated_cost_max: defaultEstimation.max,
        estimated_cost_avg: defaultEstimation.avg,
        estimated_duration_weeks: defaultEstimation.duration,
        method: 'Estimation par défaut (aucun projet similaire trouvé)',
        warning: 'Aucun projet similaire trouvé. Estimation basée sur des moyennes de marché.'
      };
    }

    // Filtrer les projets avec des montants cohérents
    const validProjects = this.filterValidProjects(similarProjects, briefAnalysis);
    
    if (validProjects.length === 0) {
      const defaultEstimation = this.getDefaultEstimation(briefAnalysis);
      return {
        estimated_cost_min: defaultEstimation.min,
        estimated_cost_max: defaultEstimation.max,
        estimated_cost_avg: defaultEstimation.avg,
        estimated_duration_weeks: defaultEstimation.duration,
        method: 'Estimation par défaut (projets similaires non cohérents)',
        warning: 'Les projets similaires trouvés ne sont pas cohérents. Estimation basée sur des moyennes de marché.'
      };
    }

    // Calculer les statistiques des projets similaires valides
    const costs = validProjects.map(p => p.total_ttc);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const avgCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;

    // Vérifier la cohérence des données
    if (avgCost < 100 || maxCost < minCost * 2) {
      const defaultEstimation = this.getDefaultEstimation(briefAnalysis);
      return {
        estimated_cost_min: defaultEstimation.min,
        estimated_cost_max: defaultEstimation.max,
        estimated_cost_avg: defaultEstimation.avg,
        estimated_duration_weeks: defaultEstimation.duration,
        method: 'Estimation par défaut (données incohérentes)',
        warning: 'Les données des projets similaires semblent incohérentes. Estimation basée sur des moyennes de marché.'
      };
    }

    // Ajuster selon la complexité
    const complexityMultiplier = this.getComplexityMultiplier(briefAnalysis.complexity);
    const adjustedMin = Math.max(minCost * complexityMultiplier, this.getMinimumAmountForProjectType(briefAnalysis.project_type));
    const adjustedMax = maxCost * complexityMultiplier;
    const adjustedAvg = avgCost * complexityMultiplier;

    // Estimer la durée (règle empirique: 1k€ = 1 semaine)
    const estimatedDuration = Math.max(1, Math.ceil(adjustedAvg / 1000));

    return {
      estimated_cost_min: Math.round(adjustedMin),
      estimated_cost_max: Math.round(adjustedMax),
      estimated_cost_avg: Math.round(adjustedAvg),
      estimated_duration_weeks: estimatedDuration,
      method: `Basé sur ${validProjects.length} projet(s) similaire(s) de qualité`,
      similar_projects: validProjects.map(p => ({
        quote_number: p.quote_number,
        customer: p.customer_name,
        cost: p.total_ttc,
        date: p.quote_date,
        similarity_score: p.similarity_score
      }))
    };
  }

  getComplexityMultiplier(complexity) {
    const multipliers = {
      'simple': 0.8,
      'moyenne': 1.0,
      'complexe': 1.3
    };
    return multipliers[complexity] || 1.0;
  }

  getDefaultEstimation(briefAnalysis) {
    const baseEstimations = {
      'e-commerce': { min: 5000, max: 25000, avg: 12000, duration: 12 },
      'application_web': { min: 3000, max: 15000, avg: 8000, duration: 8 },
      'site_vitrine': { min: 1500, max: 8000, avg: 4000, duration: 4 },
      'mobile': { min: 4000, max: 20000, avg: 10000, duration: 10 },
      'api': { min: 2000, max: 10000, avg: 5000, duration: 5 },
      'cms': { min: 2000, max: 12000, avg: 6000, duration: 6 },
      'blog': { min: 1000, max: 5000, avg: 2500, duration: 3 },
      'portfolio': { min: 1200, max: 6000, avg: 3000, duration: 3 },
      'autre': { min: 1000, max: 8000, avg: 4000, duration: 4 }
    };

    const base = baseEstimations[briefAnalysis.project_type] || baseEstimations['autre'];
    const complexityMultiplier = this.getComplexityMultiplier(briefAnalysis.complexity);
    
    return {
      min: Math.round(base.min * complexityMultiplier),
      max: Math.round(base.max * complexityMultiplier),
      avg: Math.round(base.avg * complexityMultiplier),
      duration: Math.max(1, Math.round(base.duration * complexityMultiplier))
    };
  }

  filterValidProjects(projects, briefAnalysis) {
    const minAmount = this.getMinimumAmountForProjectType(briefAnalysis.project_type);
    const maxAmount = minAmount * 10; // Maximum 10x le minimum
    
    return projects.filter(project => {
      const cost = project.total_ttc;
      return cost >= minAmount && cost <= maxAmount && cost > 0;
    });
  }

  generateBreakdown(briefAnalysis, similarProjects) {
    const phases = [];

    // Phase 1: Conception
    phases.push({
      phase: 'Conception & Design',
      description: 'Analyse des besoins, wireframes, maquettes',
      estimated_hours: this.estimatePhaseHours('conception', briefAnalysis),
      estimated_cost: 0 // Sera calculé
    });

    // Phase 2: Développement Frontend
    if (briefAnalysis.project_type !== 'api') {
      phases.push({
        phase: 'Développement Frontend',
        description: 'Interface utilisateur, responsive design',
        estimated_hours: this.estimatePhaseHours('frontend', briefAnalysis),
        estimated_cost: 0
      });
    }

    // Phase 3: Développement Backend
    phases.push({
      phase: 'Développement Backend',
      description: 'Logique métier, base de données, API',
      estimated_hours: this.estimatePhaseHours('backend', briefAnalysis),
      estimated_cost: 0
    });

    // Phase 4: Intégrations
    if (briefAnalysis.features.includes('paiement') || briefAnalysis.features.includes('api')) {
      phases.push({
        phase: 'Intégrations',
        description: 'Paiement, API externes, services tiers',
        estimated_hours: this.estimatePhaseHours('integrations', briefAnalysis),
        estimated_cost: 0
      });
    }

    // Phase 5: Tests & Déploiement
    phases.push({
      phase: 'Tests & Déploiement',
      description: 'Tests, mise en production, formation',
      estimated_hours: this.estimatePhaseHours('tests', briefAnalysis),
      estimated_cost: 0
    });

    // Calculer les coûts par phase (basé sur le coût total estimé)
    const totalEstimatedCost = this.calculateEstimation(briefAnalysis, similarProjects).estimated_cost_avg;
    const totalHours = phases.reduce((sum, phase) => sum + phase.estimated_hours, 0);
    const hourlyRate = totalEstimatedCost / totalHours;

    phases.forEach(phase => {
      phase.estimated_cost = Math.round(phase.estimated_hours * hourlyRate);
    });

    return phases;
  }

  estimatePhaseHours(phase, briefAnalysis) {
    const baseHours = {
      'conception': 20,
      'frontend': 40,
      'backend': 60,
      'integrations': 20,
      'tests': 15
    };

    let hours = baseHours[phase] || 20;

    // Ajuster selon la complexité
    const complexityMultiplier = this.getComplexityMultiplier(briefAnalysis.complexity);
    hours *= complexityMultiplier;

    // Ajuster selon le type de projet
    if (briefAnalysis.project_type === 'e-commerce') {
      hours *= 1.5;
    } else if (briefAnalysis.project_type === 'api') {
      hours *= 0.7;
    }

    // Ajuster selon le nombre de fonctionnalités
    const featureMultiplier = 1 + (briefAnalysis.features.length * 0.1);
    hours *= featureMultiplier;

    return Math.round(hours);
  }

  calculateConfidence(similarProjects) {
    if (similarProjects.length === 0) return 'Très faible';
    if (similarProjects.length === 1) return 'Faible';
    if (similarProjects.length <= 3) return 'Moyenne';
    if (similarProjects.length <= 5) return 'Bonne';
    return 'Très bonne';
  }
}
