const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// In-memory data storage
const users = new Map();
const balanceUpdates = new Map();
let aviatorCrashPoint = 2.50; // Default crash point
let aviatorGameHistory = [];
let aviatorGameId = 1;

// Aviator game synchronization
let currentGameState = {
    isActive: false,
    startTime: null,
    crashPoint: 2.50,
    gameId: 0,
    duration: 0,
    multiplier: 1.00
};

let gameInterval = null;
let nextGameTime = Date.now() + 5000; // Start first game in 5 seconds

// Start synchronized aviator game
function startSynchronizedGame() {
    if (currentGameState.isActive) return;
    
    currentGameState = {
        isActive: true,
        startTime: Date.now(),
        crashPoint: aviatorCrashPoint,
        gameId: aviatorGameId++,
        duration: 0,
        multiplier: 1.00
    };
    
    console.log(`Starting game ${currentGameState.gameId} with crash point: ${currentGameState.crashPoint}x`);
    
    // Update game every 100ms
    gameInterval = setInterval(() => {
        if (!currentGameState.isActive) return;
        
        currentGameState.duration = (Date.now() - currentGameState.startTime) / 1000;
        currentGameState.multiplier = 1 + (currentGameState.duration * 0.5);
        
        // Check if plane should crash
        if (currentGameState.multiplier >= currentGameState.crashPoint) {
            crashGame();
        }
    }, 100);
}

// Crash the current game
function crashGame() {
    if (!currentGameState.isActive) return;
    
    currentGameState.isActive = false;
    clearInterval(gameInterval);
    
    // Add to game history
    aviatorGameHistory.push({
        gameId: currentGameState.gameId,
        crashPoint: currentGameState.crashPoint,
        duration: currentGameState.duration,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 50 games
    if (aviatorGameHistory.length > 50) {
        aviatorGameHistory.shift();
    }
    
    console.log(`Game ${currentGameState.gameId} crashed at ${currentGameState.crashPoint}x`);
    
    // Schedule next game
    nextGameTime = Date.now() + 3000; // 3 second delay
    setTimeout(() => {
        startSynchronizedGame();
    }, 3000);
}

// Start the game loop
function startGameLoop() {
    // Start first game
    setTimeout(() => {
        startSynchronizedGame();
    }, 5000);
    
    // Auto-start games when needed
    setInterval(() => {
        if (!currentGameState.isActive && Date.now() >= nextGameTime) {
            startSynchronizedGame();
        }
    }, 1000);
}

// API Routes
app.get('/api/users', (req, res) => {
    const usersArray = Array.from(users.values());
    res.json(usersArray);
});

app.get('/api/users/:email', (req, res) => {
    const email = req.params.email;
    const user = users.get(email);
    
    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.post('/api/users/balance', (req, res) => {
    const { email, balance, balanceChange, reason } = req.body;
    
    if (!email || balance === undefined) {
        return res.status(400).json({ error: 'Email and balance are required' });
    }
    
    let user = users.get(email);
    if (!user) {
        user = {
            email,
            balance: 0,
            balanceHistory: [],
            createdAt: new Date().toISOString()
        };
    }
    
    const previousBalance = user.balance || 0;
    user.balance = parseFloat(balance);
    user.lastUpdated = new Date().toISOString();
    
    // Add to balance history
    if (balanceChange !== undefined) {
        user.balanceHistory = user.balanceHistory || [];
        user.balanceHistory.push({
            balanceChange: parseFloat(balanceChange),
            previousBalance: previousBalance,
            newBalance: user.balance,
            updateTimestamp: new Date().toISOString(),
            updatedBy: 'admin',
            reason: reason || 'Balance update'
        });
    }
    
    users.set(email, user);
    
    // Log balance update
    balanceUpdates.set(email, {
        previousBalance,
        newBalance: user.balance,
        timestamp: new Date().toISOString(),
        reason: reason || 'Balance update'
    });
    
    res.json({
        success: true,
        user: user,
        previousBalance,
        newBalance: user.balance
    });
});

// Create new user
app.post('/api/users', (req, res) => {
    const { email, firstName, lastName, phone, country, city, promoCode } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    if (users.has(email)) {
        return res.status(409).json({ error: 'User already exists' });
    }
    
    const user = {
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        country: country || '',
        city: city || '',
        promoCode: promoCode || '',
        balance: 10000, // Initial balance in Rwandan Francs
        balanceHistory: [{
            balanceChange: 10000,
            previousBalance: 0,
            newBalance: 10000,
            updateTimestamp: new Date().toISOString(),
            updatedBy: 'system',
            reason: 'Initial deposit'
        }],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    };
    
    users.set(email, user);
    
    res.json({
        success: true,
        user: user
    });
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // Simple admin authentication (for demo purposes)
    if (username === 'admin' && password === 'admin123') {
        res.json({
            success: true,
            token: 'admin-token-123',
            message: 'Login successful'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
});

// Aviator Game Endpoints
app.get('/api/aviator/crash-point', (req, res) => {
    res.json({
        crashPoint: aviatorCrashPoint,
        isCustom: aviatorCrashPoint !== 2.50 // Check if admin has set custom odds
    });
});

app.post('/api/aviator/crash-point', (req, res) => {
    const { crashPoint, reason } = req.body;
    
    if (!crashPoint || crashPoint < 1.01) {
        return res.status(400).json({ error: 'Invalid crash point' });
    }
    
    aviatorCrashPoint = parseFloat(crashPoint);
    
    // Add to game history
    aviatorGameHistory.push({
        gameId: aviatorGameId++,
        crashPoint: aviatorCrashPoint,
        duration: 0,
        timestamp: new Date().toISOString(),
        reason: reason || 'Admin set',
        isCustom: true
    });
    
    console.log(`Admin set crash point to: ${aviatorCrashPoint}x`);
    
    res.json({
        success: true,
        crashPoint: aviatorCrashPoint,
        message: `Crash point set to ${aviatorCrashPoint}x`
    });
});

app.get('/api/aviator/history', (req, res) => {
    res.json({
        history: aviatorGameHistory,
        total: aviatorGameHistory.length
    });
});

app.get('/api/aviator/game-state', (req, res) => {
    res.json({
        currentGame: currentGameState,
        nextGameTime: nextGameTime,
        serverTime: Date.now()
    });
});

        // Place bet on Aviator
        app.post('/api/aviator/bet', (req, res) => {
            const { email, amount } = req.body;
            
            if (!email || !amount) {
                return res.status(400).json({ error: 'Email and amount are required' });
            }
            
            console.log(`Bet request received for ${email}: ${amount} Frw`);
            
            const user = users.get(email);
            if (!user) {
                console.log(`User not found: ${email}`);
                return res.status(404).json({ error: 'User not found' });
            }
            
            console.log(`Current balance for ${email}: ${user.balance} Frw`);
            
            if (user.balance < amount) {
                console.log(`Insufficient balance for ${email}: ${user.balance} Frw < ${amount} Frw`);
                return res.status(400).json({ error: 'Insufficient balance' });
            }
            
            user.balance -= parseFloat(amount);
            user.lastUpdated = new Date().toISOString();
            
            // Add to balance history
            user.balanceHistory = user.balanceHistory || [];
            user.balanceHistory.push({
                balanceChange: -parseFloat(amount),
                previousBalance: user.balance + parseFloat(amount),
                newBalance: user.balance,
                updateTimestamp: new Date().toISOString(),
                updatedBy: 'system',
                reason: 'Aviator bet'
            });
            
            users.set(email, user);
            
            console.log(`Bet placed: ${email} bet ${amount} Frw, new balance: ${user.balance} Frw`);
            
            res.json({
                success: true,
                newBalance: user.balance,
                betAmount: amount
            });
        });

        // Cashout bet
        app.post('/api/aviator/cashout', (req, res) => {
            const { email, amount } = req.body;
            
            if (!email || !amount) {
                return res.status(400).json({ error: 'Email and amount are required' });
            }
            
            console.log(`Cashout request received for ${email}: ${amount} Frw`);
            
            const user = users.get(email);
            if (!user) {
                console.log(`User not found for cashout: ${email}`);
                return res.status(404).json({ error: 'User not found' });
            }
            
            console.log(`Current balance for ${email}: ${user.balance} Frw`);
            
            user.balance += parseFloat(amount);
            user.lastUpdated = new Date().toISOString();
            
            // Add to balance history
            user.balanceHistory = user.balanceHistory || [];
            user.balanceHistory.push({
                balanceChange: parseFloat(amount),
                previousBalance: user.balance - parseFloat(amount),
                newBalance: user.balance,
                updateTimestamp: new Date().toISOString(),
                updatedBy: 'system',
                reason: 'Aviator cashout'
            });
            
            users.set(email, user);
            
            console.log(`Cashout: ${email} won ${amount} Frw, new balance: ${user.balance} Frw`);
            
            res.json({
                success: true,
                newBalance: user.balance,
                winnings: amount
            });
        });

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        usersCount: users.size,
        gameActive: currentGameState.isActive,
        currentGame: currentGameState
    });
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/aviator.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'aviator.html'));
});

// Start server and game loop
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Starting synchronized aviator game loop...');
    startGameLoop();
}); 