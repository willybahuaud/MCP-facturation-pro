import { BaseTool } from './BaseTool.js';

/**
 * Outil d'analyse de brief de projet
 * Extrait les caractéristiques clés d'un brief pour faciliter l'estimation
 */
export class AnalyzeProjectBriefTool extends BaseTool {
  constructor() {
    super(
      'analyze_project_brief',
      'Analyse un brief de projet et extrait ses caractéristiques clés',
      {
        brief: {
          type: 'string',
          description: 'Brief de projet à analyser',
          required: true
        }
      }
    );
  }

  async execute(args, database) {
    try {
      this.validateArgs(args);

      const { brief } = args;
      
      // Analyser le brief
      const analysis = this.analyzeBrief(brief);
      
      return this.formatResult({
        brief: brief,
        analysis: analysis,
        suggestions: this.generateSuggestions(analysis)
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  analyzeBrief(brief) {
    const text = brief.toLowerCase();
    
    // 1. Détecter le type de projet
    const projectType = this.detectProjectType(text);
    
    // 2. Détecter la complexité
    const complexity = this.detectComplexity(text);
    
    // 3. Extraire les fonctionnalités
    const features = this.extractFeatures(text);
    
    // 4. Détecter les technologies
    const technologies = this.extractTechnologies(text);
    
    // 5. Estimer la taille
    const size = this.estimateSize(text);
    
    // 6. Détecter les contraintes
    const constraints = this.extractConstraints(text);
    
    return {
      project_type: projectType,
      complexity: complexity,
      features: features,
      technologies: technologies,
      size: size,
      constraints: constraints,
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

    // Détecter par nombre de fonctionnalités
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
    // Détecter des indicateurs de taille
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

    // Détecter par nombre de fonctionnalités
    const featureCount = this.extractFeatures(text).length;
    if (featureCount <= 3) return 'petit';
    if (featureCount <= 6) return 'moyen';
    return 'grand';
  }

  extractConstraints(text) {
    const constraints = {
      'delai': this.extractDeadline(text),
      'budget': this.extractBudget(text),
      'technique': this.extractTechnicalConstraints(text)
    };

    return constraints;
  }

  extractDeadline(text) {
    const deadlinePatterns = [
      /(\d+)\s*(jour|semaine|mois)/g,
      /dans\s*(\d+)\s*(jour|semaine|mois)/g,
      /avant\s*(\d+)\s*(jour|semaine|mois)/g
    ];

    for (const pattern of deadlinePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  extractBudget(text) {
    const budgetPatterns = [
      /(\d+)\s*€/g,
      /budget\s*(\d+)/g,
      /(\d+)\s*euros?/g
    ];

    for (const pattern of budgetPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  extractTechnicalConstraints(text) {
    const constraints = [];
    
    if (text.includes('hébergement')) constraints.push('hébergement');
    if (text.includes('sécurité')) constraints.push('sécurité');
    if (text.includes('performance')) constraints.push('performance');
    if (text.includes('accessibilité')) constraints.push('accessibilité');
    if (text.includes('conformité')) constraints.push('conformité');
    
    return constraints;
  }

  extractKeywords(text) {
    // Extraire des mots-clés importants
    const words = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))
      .slice(0, 10); // Limiter à 10 mots-clés

    return [...new Set(words)]; // Supprimer les doublons
  }

  isStopWord(word) {
    const stopWords = ['avec', 'pour', 'dans', 'sur', 'sous', 'par', 'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'mais', 'donc', 'car', 'que', 'qui', 'quoi', 'où', 'quand', 'comment', 'pourquoi'];
    return stopWords.includes(word.toLowerCase());
  }

  generateSuggestions(analysis) {
    const suggestions = [];

    // Suggestions basées sur le type de projet
    if (analysis.project_type === 'e-commerce') {
      suggestions.push('Considérer l\'intégration de paiement (Stripe, PayPal)');
      suggestions.push('Prévoir une gestion des stocks et commandes');
      suggestions.push('Penser au SEO pour les produits');
    }

    if (analysis.project_type === 'site_vitrine') {
      suggestions.push('Optimiser pour le référencement (SEO)');
      suggestions.push('Prévoir un CMS pour la mise à jour du contenu');
    }

    // Suggestions basées sur la complexité
    if (analysis.complexity === 'complexe') {
      suggestions.push('Prévoir une phase de conception détaillée');
      suggestions.push('Considérer un développement en plusieurs phases');
    }

    // Suggestions basées sur les fonctionnalités
    if (analysis.features.includes('paiement')) {
      suggestions.push('Vérifier la conformité PCI DSS');
      suggestions.push('Prévoir des tests de sécurité');
    }

    if (analysis.features.includes('admin')) {
      suggestions.push('Prévoir une interface d\'administration intuitive');
      suggestions.push('Considérer les droits d\'accès par rôle');
    }

    return suggestions;
  }
}
