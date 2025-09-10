/**
 * Classe de base pour les outils MCP
 * Principe SOLID : Open/Closed - Base pour l'extension des outils
 */
export class BaseTool {
  constructor(name, description, parameters) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
  }

  /**
   * Méthode abstraite à implémenter par les outils concrets
   * @param {Object} args - Arguments de l'outil
   * @param {Database} database - Instance de la base de données
   * @returns {Promise<Object>} Résultat de l'outil
   */
  async execute(args, database) {
    throw new Error('Méthode execute() doit être implémentée par les classes dérivées');
  }

  /**
   * Valide les arguments de l'outil
   * @param {Object} args - Arguments à valider
   * @returns {boolean} True si valide
   */
  validateArgs(args) {
    // Tolérer les appels sans arguments (sera validé contre les requis)
    args = args || {};
    if (!this.parameters) return true;

    for (const [key, param] of Object.entries(this.parameters)) {
      if (param.required && !(key in args)) {
        throw new Error(`Paramètre requis manquant: ${key}`);
      }

      if (key in args) {
        const value = args[key];
        if (param.type === 'string' && typeof value !== 'string') {
          throw new Error(`Paramètre ${key} doit être une chaîne de caractères`);
        }
        if (param.type === 'number' && typeof value !== 'number') {
          throw new Error(`Paramètre ${key} doit être un nombre`);
        }
        if (param.type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`Paramètre ${key} doit être un booléen`);
        }
      }
    }

    return true;
  }

  /**
   * Formate le résultat de l'outil
   * @param {Object} result - Résultat brut
   * @returns {Object} Résultat formaté
   */
  formatResult(result) {
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Gère les erreurs de l'outil
   * @param {Error} error - Erreur à gérer
   * @returns {Object} Erreur formatée
   */
  handleError(error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
