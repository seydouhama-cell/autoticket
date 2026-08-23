const Ticket = require('../models/Ticket');
const Zone = require('../models/Zone');
const Profile = require('../models/Profile');
const RouterOSService = require('./routeros.service');

class TicketsService {
  /**
   * Créer un ticket (manuellement)
   */
  async createTicket(data) {
    try {
      const zone = await Zone.findById(data.zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }

      const profile = await Profile.findById(data.profileId);
      if (!profile) {
        return { success: false, message: 'Profil non trouvé' };
      }

      // Vérifier si le ticket existe déjà
      const existing = await Ticket.findOne({ code: data.code });
      if (existing) {
        return { success: false, message: 'Ce ticket existe déjà' };
      }

      const ticket = new Ticket({
        zoneId: data.zoneId,
        profileId: data.profileId,
        username: data.username || data.code,
        password: data.password || '123456',
        code: data.code,
        source: data.source || 'import',
        etat: 'disponible'
      });

      await ticket.save();

      return { success: true, ticket };
    } catch (error) {
      console.error('❌ Erreur création ticket:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupérer les tickets d'une zone
   */
  async getTicketsByZone(zoneId, etat = 'disponible') {
    try {
      const tickets = await Ticket.find({ zoneId, etat })
        .populate('profileId', 'nom prix uptime');
      return { success: true, tickets };
    } catch (error) {
      console.error('❌ Erreur récupération tickets:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vendre un ticket (mise à jour et création sur MikroTik)
   */
  async sellTicket(ticketId, clientPhone) {
    try {
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return { success: false, message: 'Ticket non trouvé' };
      }

      if (ticket.etat !== 'disponible') {
        return { success: false, message: 'Ce ticket n\'est plus disponible' };
      }

      const zone = await Zone.findById(ticket.zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }

      const profile = await Profile.findById(ticket.profileId);
      if (!profile) {
        return { success: false, message: 'Profil non trouvé' };
      }

      // Créer l'utilisateur sur MikroTik
      const routeros = new RouterOSService({
        ip: zone.ip,
        port: zone.port,
        username: zone.username,
        password: zone.password,
        ssl: zone.ssl,
        serverHotspot: zone.serverHotspot
      });

      const createResult = await routeros.createHotspotUser(
        ticket.username,
        ticket.password || '123456',
        profile.nom,
        `Ticket vendu à ${clientPhone}`
      );

      if (!createResult.success) {
        return { success: false, message: 'Erreur création sur MikroTik' };
      }

      // Mettre à jour le ticket
      ticket.etat = 'vendu';
      ticket.dateVente = new Date();
      ticket.clientPhone = clientPhone;
      ticket.usedAt = new Date();
      await ticket.save();

      return { 
        success: true, 
        ticket,
        message: 'Ticket vendu avec succès',
        mikrotik: createResult.data
      };
    } catch (error) {
      console.error('❌ Erreur vente ticket:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Importer des tickets en masse
   */
  async importTickets(zoneId, profileId, codes, source = 'import') {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }

      const profile = await Profile.findById(profileId);
      if (!profile) {
        return { success: false, message: 'Profil non trouvé' };
      }

      const tickets = [];
      const errors = [];

      for (const code of codes) {
        try {
          const existing = await Ticket.findOne({ code: code.trim() });
          if (existing) {
            errors.push({ code, error: 'Ticket déjà existant' });
            continue;
          }

          const ticket = new Ticket({
            zoneId,
            profileId,
            username: code.trim(),
            password: '123456',
            code: code.trim(),
            source,
            etat: 'disponible'
          });

          await ticket.save();
          tickets.push(ticket);
        } catch (err) {
          errors.push({ code, error: err.message });
        }
      }

      return { 
        success: true, 
        imported: tickets.length,
        errors: errors.length,
        tickets,
        errors 
      };
    } catch (error) {
      console.error('❌ Erreur import tickets:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Supprimer un ticket
   */
  async deleteTicket(ticketId) {
    try {
      const ticket = await Ticket.findByIdAndDelete(ticketId);
      if (!ticket) {
        return { success: false, message: 'Ticket non trouvé' };
      }
      return { success: true, message: 'Ticket supprimé' };
    } catch (error) {
      console.error('❌ Erreur suppression ticket:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TicketsService();