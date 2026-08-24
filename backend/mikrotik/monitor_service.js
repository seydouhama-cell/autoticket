const Zone = require('../models/zone');
const RouterOSService = require('./routeros.service');

class MonitorService {
  async monitorAllZones() {
    try {
      const zones = await Zone.find();
      const results = [];

      for (const zone of zones) {
        const status = await this.checkZoneStatus(zone._id);
        results.push({
          zoneId: zone._id,
          nom: zone.nom,
          status: status.status,
          details: status.details
        });
      }

      return { success: true, results };
    } catch (error) {
      console.error('❌ Erreur monitoring:', error);
      return { success: false, error: error.message };
    }
  }

  async checkZoneStatus(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return { status: 'error', details: 'Zone non trouvée' };
      }

      const routeros = new RouterOSService({
        ip: zone.ip,
        port: zone.port,
        username: zone.username,
        password: zone.passwordEncrypt,
        ssl: zone.ssl || false,
        serverHotspot: zone.serverHotspot || 'hotspot'
      });

      const test = await routeros.ping();

      if (test.success) {
        zone.status = 'active';
        await zone.save();
        return { 
          status: 'active', 
          details: 'Zone accessible',
          data: test.data 
        };
      } else {
        zone.status = 'error';
        await zone.save();
        return { 
          status: 'error', 
          details: 'Zone inaccessible',
          error: test.error 
        };
      }
    } catch (error) {
      console.error('❌ Erreur vérification zone:', error);
      return { status: 'error', details: error.message };
    }
  }

  async getZoneStats(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }

      const Ticket = require('../models/ticket');
      const total = await Ticket.countDocuments({ zoneId });
      const disponibles = await Ticket.countDocuments({ zoneId, etat: 'disponible' });
      const vendus = await Ticket.countDocuments({ zoneId, etat: 'vendu' });

      const Profile = require('../models/profile');
      const profils = await Profile.countDocuments({ zoneId, isActive: true });

      return {
        success: true,
        stats: {
          totalTickets: total,
          disponibles,
          vendus,
          profils
        }
      };
    } catch (error) {
      console.error('❌ Erreur stats zone:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MonitorService();