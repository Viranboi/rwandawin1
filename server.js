const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rwandawin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Initialize Firebase Admin
let firebaseAdmin = null;
try {
  const serviceAccount = require('./firebase-service-account.json');
  firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.warn('Firebase Admin initialization failed:', error.message);
  console.warn('Continuing without Firebase integration...');
  // Initialize without Firebase for development
  firebaseAdmin = admin.initializeApp({
    projectId: 'rwandabet-8296f',
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  phone: String,
  country: String,
  city: String,
  promoCode: String,
  balance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  balanceHistory: [{
    amount: Number,
    change: Number,
    reason: String,
    updatedBy: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastLogin: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  socialLogin: { type: Boolean, default: false }
});

const balanceUpdateSchema = new mongoose.Schema({
  email: { type: String, required: true },
  newBalance: { type: Number, required: true },
  previousBalance: { type: Number, required: true },
  change: { type: Number, required: true },
  reason: { type: String, required: true },
  updatedBy: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  permanent: { type: Boolean, default: true }
});

const User = mongoose.model('User', userSchema);
const BalanceUpdate = mongoose.model('BalanceUpdate', balanceUpdateSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin Authentication Middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }

  jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'admin-secret-key', (err, admin) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid admin token' });
    }
    req.admin = admin;
    next();
  });
};

// Routes

// Get all users (Admin only)
app.get('/api/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-balanceHistory');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by email
app.get('/api/users/:email', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create or update user balance (Admin only)
app.post('/api/users/balance', authenticateAdmin, async (req, res) => {
  try {
    const { email, newBalance, reason } = req.body;

    if (!email || newBalance === undefined || !reason) {
      return res.status(400).json({ error: 'Email, balance, and reason are required' });
    }

    if (newBalance < 0) {
      return res.status(400).json({ error: 'Balance cannot be negative' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = new User({
        email,
        balance: newBalance,
        currentBalance: newBalance,
        balanceHistory: [{
          amount: newBalance,
          change: newBalance,
          reason: 'Initial Balance',
          updatedBy: req.admin.email,
          timestamp: new Date()
        }]
      });
    } else {
      // Update existing user
      const previousBalance = user.currentBalance || user.balance || 0;
      const change = newBalance - previousBalance;

      user.balance = newBalance;
      user.currentBalance = newBalance;
      user.lastUpdated = new Date();
      user.balanceHistory.push({
        amount: newBalance,
        change: change,
        reason: reason,
        updatedBy: req.admin.email,
        timestamp: new Date()
      });
    }

    await user.save();

    // Create balance update record
    const balanceUpdate = new BalanceUpdate({
      email,
      newBalance,
      previousBalance: user.balanceHistory[user.balanceHistory.length - 2]?.amount || 0,
      change: newBalance - (user.balanceHistory[user.balanceHistory.length - 2]?.amount || 0),
      reason,
      updatedBy: req.admin.email,
      timestamp: new Date(),
      permanent: true
    });

    await balanceUpdate.save();

    // Sync with Firebase
    try {
      const firestore = admin.firestore();
      await firestore.collection('users').doc(email).set({
        balance: newBalance,
        currentBalance: newBalance,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        updateReason: reason,
        updatedBy: req.admin.email,
        balanceChange: newBalance - (user.balanceHistory[user.balanceHistory.length - 2]?.amount || 0),
        previousBalance: user.balanceHistory[user.balanceHistory.length - 2]?.amount || 0,
        updateTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        balanceHistory: admin.firestore.FieldValue.arrayUnion({
          amount: newBalance,
          change: newBalance - (user.balanceHistory[user.balanceHistory.length - 2]?.amount || 0),
          reason: reason,
          updatedBy: req.admin.email,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        })
      }, { merge: true });

      // Send real-time notification
      await firestore.collection('balanceUpdates').add({
        email: email,
        newBalance: newBalance,
        updateTime: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.admin.email,
        permanent: true
      });
    } catch (firebaseError) {
      console.error('Firebase sync error:', firebaseError);
      // Continue even if Firebase sync fails
    }

    res.json({
      success: true,
      message: `Balance updated successfully for ${email}`,
      user: {
        email: user.email,
        currentBalance: user.currentBalance,
        lastUpdated: user.lastUpdated
      }
    });

  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

// Get user balance history
app.get('/api/users/:email/balance-history', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.balanceHistory);
  } catch (error) {
    console.error('Error fetching balance history:', error);
    res.status(500).json({ error: 'Failed to fetch balance history' });
  }
});

// Create new user
app.post('/api/users', async (req, res) => {
  try {
    const { email, firstName, lastName, phone, country, city, promoCode } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = new User({
      email,
      firstName,
      lastName,
      phone,
      country,
      city,
      promoCode,
      balance: 1000,
      currentBalance: 1000,
      balanceHistory: [{
        amount: 1000,
        change: 1000,
        reason: 'Welcome Bonus',
        updatedBy: 'System',
        timestamp: new Date()
      }]
    });

    await user.save();

    // Sync with Firebase
    try {
      const firestore = admin.firestore();
      await firestore.collection('users').doc(email).set({
        firstName,
        lastName,
        email,
        phone,
        country,
        city,
        promoCode,
        balance: 1000,
        currentBalance: 1000,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        balanceHistory: [{
          amount: 1000,
          change: 1000,
          reason: 'Welcome Bonus',
          updatedBy: 'System',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        }]
      });
    } catch (firebaseError) {
      console.error('Firebase sync error:', firebaseError);
    }

    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        email: user.email,
        currentBalance: user.currentBalance
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user login time
app.put('/api/users/:email/login', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { email: req.params.email },
      { lastLogin: new Date() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, lastLogin: user.lastLogin });
  } catch (error) {
    console.error('Error updating login time:', error);
    res.status(500).json({ error: 'Failed to update login time' });
  }
});

// Get balance updates for real-time notifications
app.get('/api/balance-updates/:email', authenticateToken, async (req, res) => {
  try {
    const updates = await BalanceUpdate.find({ email: req.params.email })
      .sort({ timestamp: -1 })
      .limit(10);
    res.json(updates);
  } catch (error) {
    console.error('Error fetching balance updates:', error);
    res.status(500).json({ error: 'Failed to fetch balance updates' });
  }
});

// Admin authentication
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // In production, you should store admin credentials securely
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@rwandawin.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (email === adminEmail && password === adminPassword) {
      const token = jwt.sign(
        { email, role: 'admin' },
        process.env.ADMIN_JWT_SECRET || 'admin-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token,
        admin: { email, role: 'admin' }
      });
    } else {
      res.status(401).json({ error: 'Invalid admin credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/login.html', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/register.html', (req, res) => {
  res.sendFile(__dirname + '/register.html');
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(__dirname + '/dashboard.html');
});

app.get('/admin.html', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; 