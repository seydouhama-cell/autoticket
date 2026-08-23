const axios = require('axios');

/**
 * Service de connexion à l'API RouterOS MikroTik
 */
class RouterOSService {
  constructor(config) {
    this.ip = config.ip;
    this.port = config.port || 8728;
    this.username = config.username;
    this.password = config.password;
    this.ssl = config.ssl || false;
    this.serverHotspot = config.serverHotspot || 'hotspot';
    
    this.baseUrl = `${this.ssl ? 'https' : 'http'}://${this.ip}:${this.port}/rest`;
  }

  /**
   * Créer un utilisateur Hotspot
   */
  async createHotspotUser(username, password, profile, comment = '') {
    try {
      const url = `${this.baseUrl}/ip/hotspot/user/add`;
      const data = {
        name: username,
        password: password || '123456',
        profile: profile || 'ticket-24h',
        comment: comment
      };

      const response = await axios.post(url, data, {
        auth: {
          username: this.username,
          password: this.password
        },
        timeout: 10000
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Erreur création utilisateur Hotspot:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Supprimer un utilisateur Hotspot
   */
  async deleteHotspotUser(username) {
    try {
      const url = `${this.baseUrl}/ip/hotspot/user/remove`;
      const data = { name: username };

      const response = await axios.post(url, data, {
        auth: {
          username: this.username,
          password: this.password
        },
        timeout: 10000
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Erreur suppression utilisateur Hotspot:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifier l'état du routeur
   */
  async ping() {
    try {
      const url = `${this.baseUrl}/system/resource`;
      const response = await axios.get(url, {
        auth: {
          username: this.username,
          password: this.password
        },
        timeout: 5000
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Routeur inaccessible:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupérer les profils Hotspot
   */
  async getHotspotProfiles() {
    try {
      const url = `${this.baseUrl}/ip/hotspot/user/profile`;
      const response = await axios.get(url, {
        auth: {
          username: this.username,
          password: this.password
        },
        timeout: 10000
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Erreur récupération profils:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = RouterOSService;