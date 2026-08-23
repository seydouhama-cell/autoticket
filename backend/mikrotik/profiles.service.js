const Profile = require('../models/profile');
const Zone = require('../models/zone');

class ProfilesService {
  /**
   * Créer un profil
   */
  async createProfile(data) {
    try {
      const zone = await Zone.findById(data.zoneId);
      if (!zone) {
        return { success: false, message: 'Zone non trouvée' };
      }

      const profile = new Profile(data);
      await profile.save();

      return { success: true, profile };
    } catch (error) {
      console.error('❌ Erreur création profil:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupérer tous les profils d'une zone
   */
  async getProfilesByZone(zoneId) {
    try {
      const profiles = await Profile.find({ zoneId, isActive: true });
      return { success: true, profiles };
    } catch (error) {
      console.error('❌ Erreur récupération profils:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mettre à jour un profil
   */
  async updateProfile(profileId, data) {
    try {
      const profile = await Profile.findById(profileId);
      if (!profile) {
        return { success: false, message: 'Profil non trouvé' };
      }

      Object.keys(data).forEach(key => {
        if (data[key] !== undefined && key !== '_id') {
          profile[key] = data[key];
        }
      });

      await profile.save();
      return { success: true, profile };
    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Supprimer un profil
   */
  async deleteProfile(profileId) {
    try {
      const profile = await Profile.findByIdAndDelete(profileId);
      if (!profile) {
        return { success: false, message: 'Profil non trouvé' };
      }
      return { success: true, message: 'Profil supprimé' };
    } catch (error) {
      console.error('❌ Erreur suppression profil:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ProfilesService();