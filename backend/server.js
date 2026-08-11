// =============================================
// AUTOTICKET - SERVEUR COMPLET AVEC STATISTIQUES
// Niger 🇳🇪
// =============================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = 3000;

// =============================================
// CONNEXION MONGODB
// =============================================
const MONGODB_URI = 'mongodb+srv://seydouhama_db_user:0vhZGIf4XNpcazGp@cluster0.bvwootp.mongodb.net/autoticket';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connecté à MongoDB'))
  .catch(err => console.log('❌ Erreur MongoDB:', err.message));

app.use(cors());
app.use(express.json());

// =============================================
// MODÈLES
// =============================================

// Utilisateur
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Forfait
const ProductSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  duration: { type: String, required: true },
  isActive: { type: Boolean, default: true }
});
const Product = mongoose.model('Product', ProductSchema);

// Ticket
const TicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true, unique: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  isUsed: { type: Boolean, default: false },
  usedAt: { type: Date },
  usedBy: { type: String }
});
const Ticket = mongoose.model('Ticket', TicketSchema);

// Commande
const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  customerPhone: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  transactionId: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);

// Retrait
const WithdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  feeAmount: { type: Number, default: 0 },
  commissionAmount: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },
  phone: { type: String, required: true },
  method: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  transactionId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});
const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

// Abonnement
const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  status: { type: String, enum: ['trial', 'active', 'expired', 'cancelled'], default: 'trial' },
  trialStartDate: { type: Date, default: Date.now },
  trialEndDate: { type: Date, required: true },
  plan: { type: String, enum: ['trial', 'monthly', 'quarterly', 'semester', 'yearly'] },
  subscriptionStartDate: { type: Date },
  subscriptionEndDate: { type: Date },
  paymentMethod: { type: String },
  lastPaymentDate: { type: Date },
  amountPaid: { type: Number },
  autoRenew: { type: Boolean, default: false }
});
const Subscription = mongoose.model('Subscription', SubscriptionSchema);

// =============================================
// ROUTES - ACCUEIL
// =============================================
app.get('/', (req, res) => {
  res.json({ message: '🚀 AutoTicket avec MongoDB et Abonnements !' });
});

// =============================================
// ROUTES - AUTHENTIFICATION
// =============================================

// Inscription
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, phone });
    await user.save();

    // Créer un abonnement avec essai gratuit de 10 jours
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 10);
    const subscription = new Subscription({
      userId: user._id,
      status: 'trial',
      trialEndDate: trialEndDate
    });
    await subscription.save();

    res.status(201).json({
      message: 'Compte créé avec succès ! Essai gratuit de 10 jours offert.',
      user: { id: user._id, name, email, phone, balance: user.balance }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }
    res.json({
      message: 'Connexion réussie !',
      user: { id: user._id, name: user.name, email, phone: user.phone, balance: user.balance }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

// =============================================
// ROUTES - FORFAITS
// =============================================

// Créer un forfait
app.post('/api/products', async (req, res) => {
  try {
    const { userId, name, price, duration } = req.body;
    const product = new Product({ userId, name, price, duration });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

// Lister les forfaits
app.get('/api/products/:userId', async (req, res) => {
  try {
    const products = await Product.find({ userId: req.params.userId, isActive: true });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

// Supprimer un forfait
app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

// =============================================
// ROUTES - TICKETS
// =============================================

// Importer des tickets
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
    res.status(500).json({ message: 'Erreur' });
  }
});

// Voir les tickets disponibles
app.get('/api/tickets/:userId', async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.params.userId, isUsed: false });
    res.json({ total: tickets.length, tickets });
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

// =============================================
// ROUTES - STATISTIQUES DE BASE
// =============================================
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const orders = await Order.find({ userId, status: 'paid' });
    const tickets = await Ticket.countDocuments({ userId, isUsed: false });
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
    res.status(500).json({ message: 'Erreur' });
  }
});

// =============================================
// ROUTES - STATISTIQUES AVANCÉES
// =============================================
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
// ROUTES - SIMULATION PAIEMENT
// =============================================

// Créer un paiement
app.post('/api/payments/simulate/create', async (req, res) => {
  try {
    const { userId, productId, customerPhone } = req.body;
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) return res.status(404).json({ message: 'Forfait non trouvé' });
    const ticket = await Ticket.findOne({ userId, productId, isUsed: false });
    if (!ticket) return res.status(400).json({ message: 'Plus de tickets' });
    const order = new Order({
      userId,
      productId,
      customerPhone,
      amount: product.price,
      transactionId: `SIM-${Date.now()}`
    });
    await order.save();
    res.json({ success: true, orderId: order._id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

// Confirmer un paiement
app.post('/api/payments/simulate/confirm/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Commande non trouvée' });
    if (order.status === 'paid') return res.status(400).json({ message: 'Déjà payée' });
    const ticket = await Ticket.findOne({ userId: order.userId, productId: order.productId, isUsed: false });
    if (!ticket) return res.status(400).json({ message: 'Stock épuisé' });
    ticket.isUsed = true;
    await ticket.save();
    order.status = 'paid';
    order.ticketId = ticket._id;
    await order.save();
    const user = await User.findById(order.userId);
    user.balance += order.amount;
    await user.save();
    res.json({ success: true, ticket: { code: ticket.code } });
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

// =============================================
// ROUTES - ABONNEMENT
// =============================================

// Démarrer essai gratuit (10 jours)
app.post('/api/subscription/start-trial', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 10);

    let subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      subscription = new Subscription({ userId, status: 'trial', trialEndDate });
    } else {
      subscription.status = 'trial';
      subscription.trialEndDate = trialEndDate;
    }
    await subscription.save();

    res.json({ success: true, message: 'Essai gratuit de 10 jours activé !', trialEndDate });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// Payer un abonnement
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

// Récupérer l'abonnement d'un utilisateur
app.get('/api/subscription/:userId', async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.params.userId });
    if (!subscription) {
      return res.json({ status: 'inactive', message: 'Aucun abonnement' });
    }

    const now = new Date();
    let status = subscription.status;
    let daysLeft = 0;

    if (status === 'trial') {
      if (now > subscription.trialEndDate) {
        status = 'expired';
        subscription.status = 'expired';
        await subscription.save();
      } else {
        const diff = subscription.trialEndDate - now;
        daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }
    } else if (status === 'active') {
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
      trialEndDate: subscription.trialEndDate,
      subscriptionEndDate: subscription.subscriptionEndDate,
      plan: subscription.plan || 'trial',
      isActive: status === 'trial' || status === 'active'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// =============================================
// LANCEMENT DU SERVEUR
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 AutoTicket sur http://localhost:${PORT}`);
});