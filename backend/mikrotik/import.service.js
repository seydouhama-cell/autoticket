const TicketsService = require('./tickets.service');

class ImportService {
  /**
   * Importer depuis un fichier PDF
   */
  async importFromPDF(zoneId, profileId, codes) {
    return await TicketsService.importTickets(zoneId, profileId, codes, 'import');
  }

  /**
   * Importer depuis Mikhmon (format CSV/JSON)
   */
  async importFromMikhmon(zoneId, profileId, data) {
    // Format Mikhmon: chaque ligne contient un code
    const codes = data.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    return await TicketsService.importTickets(zoneId, profileId, codes, 'import');
  }

  /**
   * Extraire les codes d'un texte
   */
  extractCodes(text) {
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Filtrer les codes valides (alphanumériques, tirets)
    const codes = lines.filter(line => /^[A-Z0-9\-]{4,20}$/i.test(line));
    return codes;
  }
}

module.exports = new ImportService();