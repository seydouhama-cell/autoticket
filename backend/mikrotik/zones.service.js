const Zone = require('../models/Zone');
const RouterOSService = require('./routeros.service');

class ZonesService {
  /**
   * Créer une nouvelle zone
   */
  async createZone(data) {
    try {
      // Vérifier si la zone existe déjà
      const existing = await Zone.findOne({ 
        ownerId: data.ownerId, 
        ip: data.ip 
      });
      
      if (existing) {
        return { success: false, message: 'Cette zone existe déjà' };
      }

      const zone = new Zone(data);
      await zone.save();

      // Tester la connexion
      const routeros = new RouterOSService({
        ip: zone.ip,
        port: zone.port,
        username: zone.username,
        password: zone.password,
        ssl: zone.ssl,
        serverHotspot: zone.serverHotspot
      });

      const test = await routeros.ping();
      if (test.success) {
        zone.status = 'active';
        await zone.save();
      }

      return { success: true, zone };
    } catch (error) {
      console.error('❌ Erreur création zone:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupérer toutes les zones d'un propriétaire
   */
  async getZonesByOwner(ownerId) {
    try {
      const zones = await Zone.find({ ownerId });
      return { success: true, zones };
    } catch (error) {
      console.error('❌ Erreur récupération zones:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupérer une zone par ID
   */
  async getZoneById(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }
      return { success: true, zone };
    } catch (error) {
      console.error('❌ Erreur récupération zone:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mettre à jour une zone
   */
  async updateZone(zoneId, data) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && key !== '_id') {
          zone[key] = data[key];
        }
      });

      zone.updatedAt = new Date();
      await zone.save();

      return { success: true, zone };
    } catch (error) {
      console.error('❌ Erreur mise à jour zone:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Supprimer une zone
   */
  async deleteZone(zoneId) {
    try {
      const zone = await Zone.findByIdAndDelete(zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }
      return { success: true, message: 'Zone supprimée' };
    } catch (error) {
      console.error('❌ Erreur suppression zone:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Tester la connexion à une zone
   */
  async testZoneConnection(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }

      const routeros = new RouterOSService({
        ip: zone.ip,
        port: zone.port,
        username: zone.username,
        password: zone.password,
        ssl: zone.ssl,
        serverHotspot: zone.serverHotspot
      });

      const test = await routeros.ping();
      
      if (test.success) {
        zone.status = 'active';
        await zone.save();
      } else {
        zone.status = 'error';
        await zone.save();
      }

      return { success: test.success, status: zone.status, data: test.data };
    } catch (error) {
      console.error('❌ Erreur test connexion:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ZonesService();