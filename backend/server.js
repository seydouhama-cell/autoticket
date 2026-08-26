// =============================================
// AUTOTICKET - SERVEUR COMPLET AVEC MESOMB
// Niger 🇳🇪
// =============================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const multer = require('multer');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const app = express();
const PORT = 3000;

// =============================================
// CONNEXION MONGODB
// =============================================
const MONGODB_URI = 'mongodb+srv://seydouhama_db_user:96724257Sey@cluster0.bvwootp.mongodb.net/autoticket';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000
})
.then(() => console.log('✅ Connecté à MongoDB Atlas'))
.catch(err => console.log('❌ Erreur MongoDB:', err.message));

app.use(cors());
app.use(express.json());

// =============================================
// ROUTES - MIKROTIK (NOUVELLE ARCHITECTURE)
// =============================================
const mikrotikRoutes = require('./mikrotik/routes');
app.use('/api/mikrotik', mikrotikRoutes);

// =============================================
// CONFIGURATION MESOMB
// =============================================
const MESOMB_API_HOST = 'https://mesomb.hachther.com';
const MESOMB_API_VERSION = 'v1.1';
const MESOMB_API_URL = `${MESOMB_API_HOST}/api/${MESOMB_API_VERSION}`;
const MESOMB_ACCESS_KEY = process.env.MESOMB_ACCESS_KEY || 'votre_access_key_ici';
const MESOMB_SECRET_KEY = process.env.MESOMB_SECRET_KEY || 'votre_secret_key_ici';
const MESOMB_COUNTRY = 'NE';
const MESOMB_CURRENCY = 'XOF';

// =============================================
// CONFIGURATION IMPORT PDF
// =============================================
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
    }
  }
});

// =============================================
// MODÈLES (IMPORTÉS DEPUIS LE DOSSIER models/)
// =============================================
const User = require('./models/user');
const Product = require('./models/product');
const Ticket = require('./models/ticket');
const Order = require('./models/order');
const Withdrawal = require('./models/withdrawal');
const Subscription = require('./models/subscription');
const Zone = require('./models/zone');
const Profile = require('./models/profile');

// =============================================
// SERVICES
// =============================================
const TicketsService = require('./mikrotik/tickets.service');
const RouterOSService = require('./mikrotik/routeros.service');

// =============================================
// FONCTION - CRÉER TICKET DANS MIKROTIK
// =============================================

async function createMikrotikUser(userId, username, password, zoneId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log('⚠️ Utilisateur non trouvé');
      return false;
    }

    let zone;
    if (zoneId) {
      zone = await Zone.findById(zoneId);
    } else {
      const zones = await Zone.find({ ownerId: userId, status: 'active' });
      zone = zones[0];
    }

    if (!zone) {
      console.log('⚠️ Aucune zone active configurée');
      return false;
    }

    const routeros = new RouterOSService({
      ip: zone.ip,
      port: zone.port,
      username: zone.username,
      password: zone.passwordEncrypt,
      ssl: zone.ssl || false,
      serverHotspot: zone.serverHotspot || 'hotspot'
    });

    const result = await routeros.createHotspotUser(
      username,
      password || '123456',
      'ticket-24h'
    );

    return result.success;
  } catch (error) {
    console.error('❌ Erreur création ticket MikroTik:', error.message);
    return false;
  }
}

// =============================================
// ROUTES - ACCUEIL
// =============================================
app.get('/', (req, res) => {
  res.json({ message: '🚀 AutoTicket avec MeSomb, import PDF, MikroTik multiple et GPS !' });
});

// =============================================
// ROUTES - AUTHENTIFICATION
// =============================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, phone });
    await user.save();

    const subscription = new Subscription({
      userId: user._id,
      status: 'active',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      plan: 'monthly',
      amountPaid: 0
    });
    await subscription.save();

    res.status(201).json({
      message: 'Compte créé avec succès ! Abonnement actif.',
      user: { id: user._id, name, email, phone, balance: user.balance }
    });
  } catch (error) {
    console.error('Erreur register:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔍 Tentative de connexion pour: ${email}`);

    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`❌ Utilisateur non trouvé: ${email}`);
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log(`❌ Mot de passe incorrect pour: ${email}`);
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    console.log(`✅ Connexion réussie pour: ${email}`);
    res.json({
      message: 'Connexion réussie !',
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        balance: user.balance || 0 
      }
    });
  } catch (error) {
    console.error('❌ Erreur login:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTES - FORFAITS
// =============================================

app.post('/api/products', async (req, res) => {
  try {
    const { userId, zoneId, name, price, duration, profileName } = req.body;
    
    if (!userId || !name || !price || !duration) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const product = new Product({
      userId,
      zoneId: zoneId || null,
      name,
      price,
      duration,
      profileName: profileName || '',
      isActive: true
    });
    
    await product.save();
    res.status(201).json({ 
      success: true, 
      message: 'Forfait ajouté avec succès',
      product 
    });
  } catch (error) {
    console.error('❌ Erreur ajout forfait:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

app.get('/api/products/:userId', async (req, res) => {
  try {
    const products = await Product.find({ 
      userId: req.params.userId, 
      isActive: true 
    });
    res.json(products);
  } catch (error) {
    console.error('❌ Erreur récupération forfaits:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Forfait supprimé' });
  } catch (error) {
    console.error('❌ Erreur suppression forfait:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTES - TICKETS
// =============================================

app.post('/api/tickets/bulk', async (req, res) => {
  try {
    const { userId, codes, productId } = req.body;
    if (!codes || codes.length === 0) {
      return res.status(400).json({ message: 'Aucun code' });
    }
    const tickets = codes.map(code => ({ userId, code: code.trim(), productId }));
    const inserted = await Ticket.insertMany(tickets);
    res.json({ message: `${inserted.length} tickets importés`, tickets: inserted });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

app.get('/api/tickets/:userId', async (req, res) => {
  try {
    const zones = await Zone.find({ ownerId: req.params.userId });
    const zoneIds = zones.map(z => z._id);
    const tickets = await Ticket.find({ zoneId: { $in: zoneIds }, etat: 'disponible' });
    res.json({ total: tickets.length, tickets });
  } catch (error) {
    console.error('❌ Erreur récupération tickets:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTES - IMPORT PDF
// =============================================

app.post('/api/tickets/import-pdf', upload.single('file'), async (req, res) => {
  try {
    const { userId, productId, zoneId } = req.body;
    
    console.log('📥 Import PDF - Début');
    console.log('userId:', userId);
    console.log('productId:', productId);
    console.log('zoneId:', zoneId);
    console.log('Fichier:', req.file ? req.file.originalname : 'Aucun fichier');

    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier PDF envoyé' });
    }

    if (!userId || !productId || !zoneId) {
      return res.status(400).json({ message: 'userId, productId et zoneId sont requis' });
    }

    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({ message: 'Zone non trouvée' });
    }

    const data = await pdfParse(req.file.buffer);
    const text = data.text;
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Format: 4 lettres + 4 chiffres (sans espace)
    const codes = lines.filter(line => /^[a-z]{4}\d{4}$/.test(line));

    if (codes.length === 0) {
      return res.status(400).json({ 
        message: 'Aucun code valide trouvé', 
        preview: text.slice(0, 500) 
      });
    }

    // ✅ AJOUT : profileId = productId
    const tickets = codes.map(code => ({
      userId: userId,
      zoneId: zoneId,
      productId: productId,
      profileId: productId, // ← CHAMP REQUIS
      code: code,
      username: code.substring(0, 4),
      password: code.substring(4, 8),
      etat: 'disponible',
      source: 'import'
    }));

    const existingCodes = await Ticket.find({ 
      zoneId: zoneId, 
      code: { $in: codes } 
    });
    const existingSet = new Set(existingCodes.map(t => t.code));
    const newTickets = tickets.filter(t => !existingSet.has(t.code));

    if (newTickets.length === 0) {
      return res.status(400).json({ message: 'Tous les codes existent déjà' });
    }

    const inserted = await Ticket.insertMany(newTickets);
    
    res.json({
      success: true,
      message: `${inserted.length} tickets importés`,
      total: codes.length,
      imported: inserted.length,
      duplicates: codes.length - newTickets.length,
      tickets: inserted
    });
  } catch (error) {
    console.error('❌ Erreur import PDF:', error);
    res.status(500).json({ 
      message: 'Erreur lors de l\'importation', 
      error: error.message 
    });
  }
});

// =============================================
// ROUTES - STATISTIQUES
// =============================================

app.get('/api/stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const orders = await Order.find({ userId, status: 'paid' });
    const userZones = await Zone.find({ ownerId: userId });
    const zoneIds = userZones.map(z => z._id);
    const tickets = await Ticket.countDocuments({ zoneId: { $in: zoneIds }, etat: 'disponible' });
    const user = await User.findById(userId);
    res.json({
      today: { count: 0, revenue: 0 },
      total: {
        count: orders.length,
        revenue: orders.reduce((s, o) => s + o.amount, 0)
      },
      availableTickets: tickets,
      balance: user ? user.balance : 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

app.get('/api/stats/advanced/:userId/:period', async (req, res) => {
  try {
    const userId = req.params.userId;
    const period = parseInt(req.params.period) || 30;

    const orders = await Order.find({
      userId: userId,
      status: 'paid',
      createdAt: { $gte: new Date(Date.now() - period * 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: 1 });

    const days = [];
    const labels = [];
    const sales = [];
    const revenues = [];
    const now = new Date();

    for (let i = period - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      labels.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
      days.push(dateStr);
      sales.push(0);
      revenues.push(0);
    }

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      const dateStr = orderDate.toISOString().split('T')[0];
      const index = days.indexOf(dateStr);
      if (index !== -1) {
        sales[index] += 1;
        revenues[index] += order.amount;
      }
    });

    const productStats = {};
    orders.forEach(order => {
      const productId = order.productId.toString();
      if (!productStats[productId]) {
        productStats[productId] = { count: 0, amount: 0, name: 'Forfait' };
      }
      productStats[productId].count += 1;
      productStats[productId].amount += order.amount;
    });

    const productIds = Object.keys(productStats);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = {};
    products.forEach(p => { productMap[p._id.toString()] = p.name; });

    const productData = Object.keys(productStats).map(id => ({
      name: productMap[id] || 'Forfait',
      count: productStats[id].count,
      amount: productStats[id].amount
    }));

    res.json({
      labels: labels,
      sales: sales,
      revenues: revenues,
      products: productData,
      summary: {
        totalSales: sales.reduce((a, b) => a + b, 0),
        totalRevenue: revenues.reduce((a, b) => a + b, 0),
        avgRevenue: revenues.length > 0 ? Math.round(revenues.reduce((a, b) => a + b, 0) / revenues.filter(r => r > 0).length || 1) : 0,
        bestDay: sales.indexOf(Math.max(...sales)) !== -1 ? labels[sales.indexOf(Math.max(...sales))] : '-'
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTES - COMMISSIONS
// =============================================

app.get('/api/commissions/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const withdrawals = await Withdrawal.find({
      userId: userId,
      status: 'completed'
    });

    const totalCommission = withdrawals.reduce((sum, w) => sum + (w.commissionAmount || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    res.json({
      totalCommission,
      totalWithdrawn,
      count: withdrawals.length,
      withdrawals: withdrawals.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTES - RETRAIT
// =============================================

app.post('/api/withdrawals', async (req, res) => {
  try {
    const { userId, amount, phone, method } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (amount > user.balance) return res.status(400).json({ message: 'Solde insuffisant' });

    const feesPercent = 4;
    const commissionPercent = 5;
    const feeAmount = Math.round(amount * feesPercent / 100);
    const commissionAmount = Math.round(amount * commissionPercent / 100);
    const netAmount = amount - feeAmount - commissionAmount;

    user.balance -= amount;
    await user.save();

    const withdrawal = new Withdrawal({
      userId,
      amount,
      feeAmount,
      commissionAmount,
      netAmount,
      phone,
      method,
      status: 'pending',
      transactionId: `WTD-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    });
    await withdrawal.save();

    res.json({
      success: true,
      amount,
      fees: feeAmount,
      commission: commissionAmount,
      netAmount,
      newBalance: user.balance,
      transactionId: withdrawal.transactionId
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTES - PAIEMENT AVEC MESOMB (AVEC ZONEID)
// =============================================

app.post('/api/payment/initiate', async (req, res) => {
  try {
    const { userId, productId, customerPhone, method } = req.body;

    console.log(`📝 Tentative de paiement: userId=${userId}, productId=${productId}, phone=${customerPhone}`);

    if (!userId || !productId || !customerPhone) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      console.log(`❌ Forfait non trouvé: ${productId}`);
      return res.status(404).json({ message: 'Forfait non trouvé' });
    }

    const zoneId = product.zoneId;
    if (!zoneId) {
      return res.status(400).json({ message: 'Aucune zone associée à ce forfait' });
    }

    console.log('🔍 DEBUG recherche ticket:');
    console.log('   zoneId utilisé:', zoneId.toString());
    console.log('   productId (= profileId cherché):', productId);
    const totalTicketsZone = await Ticket.countDocuments({ zoneId });
    const totalTicketsProfil = await Ticket.countDocuments({ profileId: productId });
    const totalTicketsDispo = await Ticket.countDocuments({ zoneId, etat: 'disponible' });
    console.log('   Tickets total dans cette zone:', totalTicketsZone);
    console.log('   Tickets total avec ce profileId (toutes zones):', totalTicketsProfil);
    console.log('   Tickets disponibles dans cette zone (tout profileId confondu):', totalTicketsDispo);
    const sample = await Ticket.findOne({ zoneId });
    if (sample) {
      console.log('   Exemple ticket de cette zone -> profileId:', sample.profileId ? sample.profileId.toString() : 'AUCUN', '| etat:', sample.etat);
    }

    const ticket = await Ticket.findOne({ zoneId, profileId: productId, etat: 'disponible' });
    if (!ticket) {
      return res.status(400).json({ message: 'Plus de tickets disponibles pour cette zone' });
    }

    console.log(`✅ Ticket trouvé: ${ticket.code} pour la zone ${zoneId}`);

    const order = new Order({
      userId,
      zoneId,
      productId,
      customerPhone,
      amount: product.price,
      status: 'pending',
      transactionId: `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    });
    await order.save();

    try {
      const response = await axios.post(`${MESOMB_API_URL}/payment/collect`, {
        receiver: customerPhone,
        amount: product.price,
        service: method || 'airtelmoney',
        country: MESOMB_COUNTRY,
        currency: MESOMB_CURRENCY,
        customer: {
          email: 'client@autoticket.com',
          first_name: 'Client',
          last_name: 'AutoTicket',
          town: 'Niamey',
          region: 'Niamey',
          country: MESOMB_COUNTRY,
          address: 'Niger'
        }
      }, {
        headers: {
          'X-Access-Key': MESOMB_ACCESS_KEY,
          'X-Secret-Key': MESOMB_SECRET_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ Réponse MeSomb:', response.data);

      if (response.data && response.data.success) {
        ticket.etat = 'vendu';
        ticket.dateVente = new Date();
        ticket.clientPhone = customerPhone;
        ticket.usedAt = new Date();
        await ticket.save();

        order.status = 'paid';
        order.ticketId = ticket._id;
        await order.save();

        const user = await User.findById(userId);
        if (user) {
          user.balance = (user.balance || 0) + product.price;
          await user.save();
          console.log(`💰 Vendeur crédité: +${product.price} FCFA`);
        }

        await createMikrotikUser(userId, ticket.code, '123456', zoneId);

        return res.json({
          success: true,
          message: 'Paiement confirmé ! Ticket reçu.',
          ticket: { code: ticket.code },
          orderId: order._id,
          amount: product.price
        });
      } else {
        order.status = 'failed';
        await order.save();
        return res.status(400).json({
          success: false,
          message: 'Erreur paiement',
          error: response.data.message
        });
      }
    } catch (mesombError) {
      console.error('❌ Erreur MeSomb:', mesombError.message);
      order.status = 'failed';
      await order.save();
      return res.status(500).json({
        success: false,
        message: 'Erreur de paiement. Veuillez réessayer.',
        error: mesombError.message
      });
    }
  } catch (error) {
    console.error('❌ Erreur paiement:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTE - PAIEMENT I-PAY (AVEC ZONEID)
// =============================================

app.post('/api/payment/ipay/initiate', async (req, res) => {
  try {
    const { userId, productId, customerPhone, paymentType } = req.body;

    console.log(`📝 Paiement i-pay: userId=${userId}, type=${paymentType}, phone=${customerPhone}`);

    if (!userId || !productId || !customerPhone || !paymentType) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      return res.status(404).json({ message: 'Forfait non trouvé' });
    }

    const zoneId = product.zoneId;
    if (!zoneId) {
      return res.status(400).json({ message: 'Aucune zone associée à ce forfait' });
    }

    const ticket = await Ticket.findOne({ zoneId, profileId: productId, etat: 'disponible' });
    if (!ticket) {
      return res.status(400).json({ message: 'Plus de tickets disponibles pour cette zone' });
    }

    const order = new Order({
      userId,
      zoneId,
      productId,
      customerPhone,
      amount: product.price,
      status: 'pending',
      transactionId: `IPAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    });
    await order.save();

    const response = await axios.post('https://api.i-pay.money/v1/payment', {
      amount: product.price,
      msisdn: customerPhone,
      paymentType: paymentType,
      reference: order.transactionId,
      description: `Ticket ${product.name}`,
      country: 'NE',
      currency: 'XOF'
    }, {
      headers: {
        'X-Api-Key': process.env.IPAY_API_KEY,
        'X-Secret-Key': process.env.IPAY_SECRET_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Réponse i-pay:', response.data);

    if (response.data && response.data.success) {
      ticket.etat = 'vendu';
      ticket.dateVente = new Date();
      ticket.clientPhone = customerPhone;
      ticket.usedAt = new Date();
      await ticket.save();

      order.status = 'paid';
      order.ticketId = ticket._id;
      await order.save();

      const user = await User.findById(userId);
      if (user) {
        user.balance = (user.balance || 0) + product.price;
        await user.save();
      }

      await createMikrotikUser(userId, ticket.code, '123456', zoneId);

      return res.json({
        success: true,
        message: 'Paiement confirmé ! Ticket reçu.',
        ticket: { code: ticket.code },
        orderId: order._id,
        amount: product.price
      });
    } else {
      order.status = 'failed';
      await order.save();
      return res.status(400).json({
        success: false,
        message: 'Erreur paiement i-pay',
        error: response.data?.message || 'Transaction échouée'
      });
    }
  } catch (error) {
    console.error('❌ Erreur i-pay:', error.message);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTE - STATUT DE PAIEMENT
// =============================================

app.get('/api/payment/status/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (order.status === 'paid') {
      const ticket = await Ticket.findById(order.ticketId);
      return res.json({
        status: 'paid',
        ticket: ticket ? { code: ticket.code } : null,
        amount: order.amount
      });
    }

    if (order.status === 'failed') {
      return res.json({ status: 'failed', message: 'Paiement échoué' });
    }

    res.json({ status: 'pending', message: 'En attente de confirmation' });
  } catch (error) {
    console.error('❌ Erreur vérification paiement:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTE - WEBHOOK MESOMB
// =============================================

app.post('/api/payment/webhook', async (req, res) => {
  try {
    const { transactionId, status, phone } = req.body;
    const order = await Order.findOne({ transactionId });
    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    if (status === 'success') {
      const ticket = await Ticket.findOne({ zoneId: order.zoneId, profileId: order.productId, etat: 'disponible' });
      if (!ticket) {
        order.status = 'failed';
        await order.save();
        return res.status(400).json({ message: 'Stock épuisé' });
      }

      await createMikrotikUser(order.userId, ticket.code, '123456', order.zoneId);

      ticket.etat = 'vendu';
      ticket.dateVente = new Date();
      ticket.clientPhone = phone || order.customerPhone;
      ticket.usedAt = new Date();
      await ticket.save();

      order.status = 'paid';
      order.ticketId = ticket._id;
      await order.save();

      const user = await User.findById(order.userId);
      if (user) {
        user.balance += order.amount;
        await user.save();
      }

      res.json({ success: true, message: 'Paiement confirmé', ticket: { code: ticket.code } });
    } else {
      order.status = 'failed';
      await order.save();
      res.json({ success: false, message: 'Paiement échoué' });
    }
  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    res.status(500).json({ message: 'Erreur webhook' });
  }
});

// =============================================
// ROUTES - ABONNEMENT
// =============================================

app.post('/api/subscription/pay', async (req, res) => {
  try {
    const { userId, plan, phone, method, amount } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const planDurations = { monthly: 30, quarterly: 90, semester: 180, yearly: 365 };
    const duration = planDurations[plan];
    if (!duration) return res.status(400).json({ message: 'Plan invalide' });

    const transactionId = `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    let subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      subscription = new Subscription({ userId });
    }

    subscription.status = 'active';
    subscription.plan = plan;
    subscription.subscriptionStartDate = new Date();
    subscription.subscriptionEndDate = endDate;
    subscription.paymentMethod = method;
    subscription.lastPaymentDate = new Date();
    subscription.amountPaid = amount;
    subscription.autoRenew = true;
    await subscription.save();

    res.json({
      success: true,
      message: `Abonnement ${plan} activé pour ${duration} jours !`,
      transactionId,
      endDate,
      amount
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

app.get('/api/subscription/:userId', async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.params.userId });
    if (!subscription) {
      return res.json({ status: 'inactive', message: 'Aucun abonnement' });
    }

    const now = new Date();
    let status = subscription.status;
    let daysLeft = 0;

    if (status === 'active') {
      if (subscription.subscriptionEndDate && now > subscription.subscriptionEndDate) {
        status = 'expired';
        subscription.status = 'expired';
        await subscription.save();
      } else {
        const diff = subscription.subscriptionEndDate - now;
        daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }
    }

    res.json({
      status,
      daysLeft,
      subscriptionEndDate: subscription.subscriptionEndDate,
      plan: subscription.plan || 'monthly',
      isActive: status === 'active'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTES ADMIN - COMMISSIONS
// =============================================

app.get('/api/admin/commissions/stats', async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ status: 'completed' });

    if (!withdrawals || withdrawals.length === 0) {
      return res.json({
        totalCommission: 0,
        totalWithdrawn: 0,
        totalFees: 0,
        totalRetraits: 0,
        byMethod: {},
        dailyData: {},
        withdrawals: []
      });
    }

    const totalCommission = withdrawals.reduce((sum, w) => sum + (w.commissionAmount || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const totalFees = withdrawals.reduce((sum, w) => sum + (w.feeAmount || 0), 0);

    const byMethod = {};
    withdrawals.forEach(w => {
      if (!byMethod[w.method]) byMethod[w.method] = { count: 0, amount: 0, commission: 0 };
      byMethod[w.method].count += 1;
      byMethod[w.method].amount += w.amount;
      byMethod[w.method].commission += w.commissionAmount;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyData = {};
    withdrawals.filter(w => w.createdAt >= thirtyDaysAgo).forEach(w => {
      const date = w.createdAt.toISOString().split('T')[0];
      if (!dailyData[date]) dailyData[date] = { count: 0, commission: 0 };
      dailyData[date].count += 1;
      dailyData[date].commission += w.commissionAmount;
    });

    const userIds = withdrawals.map(w => w.userId);
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const withdrawalsWithUser = withdrawals.slice(0, 50).map(w => {
      const user = userMap[w.userId.toString()];
      return {
        ...w._doc,
        userId: user ? { name: user.name, email: user.email, phone: user.phone } : null
      };
    });

    res.json({
      totalCommission,
      totalWithdrawn,
      totalFees,
      totalRetraits: withdrawals.length,
      byMethod,
      dailyData,
      withdrawals: withdrawalsWithUser
    });
  } catch (error) {
    console.error('Erreur stats admin:', error);
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

app.get('/api/admin/withdrawals/recent', async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('userId', 'name email phone');
    
    res.json({ withdrawals });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// ROUTE ADMIN - RETRAIT DES COMMISSIONS
// =============================================
app.post('/api/admin/withdraw-commission', async (req, res) => {
  try {
    const { amount, phone, method } = req.body;

    const withdrawals = await Withdrawal.find({ status: 'completed' });
    const totalCommission = withdrawals.reduce((sum, w) => sum + (w.commissionAmount || 0), 0);

    if (amount > totalCommission) {
      return res.status(400).json({ 
        success: false, 
        message: `Solde de commissions insuffisant. Disponible : ${totalCommission} FCFA` 
      });
    }

    if (amount < 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Montant minimum : 1000 FCFA' 
      });
    }

    if (!phone || phone.length < 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Numéro de téléphone valide requis' 
      });
    }

    const transactionId = `ADMIN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const adminWithdrawal = new Withdrawal({
      userId: null,
      amount: amount,
      feeAmount: 0,
      commissionAmount: 0,
      netAmount: amount,
      phone: phone,
      method: method || 'airtelmoney',
      status: 'completed',
      transactionId: transactionId,
      completedAt: new Date()
    });
    await adminWithdrawal.save();

    res.json({
      success: true,
      message: `Retrait de ${amount} FCFA effectué vers ${phone}`,
      transactionId,
      remainingCommission: totalCommission - amount
    });
  } catch (error) {
    console.error('Erreur retrait admin:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur', 
      error: error.message 
    });
  }
});

// =============================================
// LANCEMENT DU SERVEUR
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 AutoTicket sur http://localhost:${PORT}`);
});