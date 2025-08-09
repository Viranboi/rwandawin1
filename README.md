# RwandaWin Backend

A comprehensive backend system for the RwandaWin betting platform with MongoDB database, Firebase integration, and real-time balance management.

## 🚀 Features

- **MongoDB Database**: Permanent data storage for all user information and balance history
- **Firebase Integration**: Real-time synchronization with Firebase for immediate updates
- **Admin Authentication**: Secure admin panel with JWT authentication
- **Balance Management**: Complete balance tracking with history and audit trail
- **Real-time Updates**: Instant balance updates for online users
- **Offline Support**: Balance changes saved even when users are offline
- **RESTful API**: Clean API endpoints for all operations

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- Firebase project with service account

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rwandawin-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/rwandawin

   # JWT Secrets
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ADMIN_JWT_SECRET=admin-super-secret-jwt-key-change-this-in-production

   # Admin Credentials
   ADMIN_EMAIL=admin@rwandawin.com
   ADMIN_PASSWORD=admin123

   # Firebase Configuration
   FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
   ```

4. **Set up Firebase service account**
   - Download your Firebase service account key from Firebase Console
   - Save it as `firebase-service-account.json` in the root directory

5. **Start MongoDB**
   ```bash
   # Local MongoDB
   mongod

   # Or use MongoDB Atlas (update MONGODB_URI in .env)
   ```

6. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📊 Database Schema

### User Schema
```javascript
{
  email: String (required, unique),
  firstName: String,
  lastName: String,
  phone: String,
  country: String,
  city: String,
  promoCode: String,
  balance: Number (default: 0),
  currentBalance: Number (default: 0),
  balanceHistory: [{
    amount: Number,
    change: Number,
    reason: String,
    updatedBy: String,
    timestamp: Date
  }],
  lastLogin: Date,
  lastUpdated: Date,
  createdAt: Date,
  socialLogin: Boolean
}
```

### Balance Update Schema
```javascript
{
  email: String (required),
  newBalance: Number (required),
  previousBalance: Number (required),
  change: Number (required),
  reason: String (required),
  updatedBy: String (required),
  timestamp: Date,
  permanent: Boolean (default: true)
}
```

## 🔌 API Endpoints

### Authentication
- `POST /api/admin/login` - Admin authentication

### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:email` - Get user by email
- `POST /api/users` - Create new user
- `POST /api/users/balance` - Update user balance (Admin only)
- `GET /api/users/:email/balance-history` - Get user balance history
- `PUT /api/users/:email/login` - Update user login time

### Balance Updates
- `GET /api/balance-updates/:email` - Get balance updates for real-time notifications

### Health Check
- `GET /api/health` - Server health check

## 🔐 Admin Authentication

The admin panel uses JWT authentication. Default credentials:
- Email: `admin@rwandawin.com`
- Password: `admin123`

**Important**: Change these credentials in production!

## 💰 Balance Management

### Admin Balance Update Process
1. Admin enters user email and new balance
2. Backend validates the request
3. Updates MongoDB with complete history
4. Syncs with Firebase for real-time updates
5. Creates balance update record
6. Sends real-time notification

### User Balance Loading Process
1. User logs into dashboard
2. Backend loads user data from MongoDB
3. Checks for offline balance updates
4. Updates last login time
5. Shows balance changes notification if any

## 🔄 Real-time Features

- **Firebase Sync**: All balance changes are synced with Firebase
- **Real-time Notifications**: Users see balance changes immediately
- **Offline Support**: Changes are saved even when users are offline
- **Balance History**: Complete audit trail of all balance changes

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Admin Authorization**: Separate admin authentication system
- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Comprehensive error handling and logging
- **CORS Support**: Cross-origin resource sharing enabled

## 📱 Frontend Integration

The frontend (admin.html, dashboard.html) has been updated to use the backend API:

- **Admin Panel**: Uses backend API for all balance operations
- **User Dashboard**: Loads data from backend with real-time updates
- **Authentication**: Secure admin authentication
- **Error Handling**: Proper error messages and recovery

## 🚀 Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment
1. Set `NODE_ENV=production` in `.env`
2. Use MongoDB Atlas for database
3. Set up proper JWT secrets
4. Configure Firebase service account
5. Deploy to your preferred hosting platform

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/rwandawin
JWT_SECRET=your-production-jwt-secret
ADMIN_JWT_SECRET=your-production-admin-jwt-secret
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-secure-admin-password
```

## 🔧 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env
   - Verify network connectivity

2. **Firebase Authentication Error**
   - Check firebase-service-account.json file
   - Verify Firebase project configuration
   - Ensure proper Firebase permissions

3. **Admin Authentication Failed**
   - Check admin credentials in .env
   - Verify JWT secrets are set
   - Check server logs for errors

4. **Balance Update Errors**
   - Verify user email exists
   - Check balance validation (non-negative)
   - Ensure all required fields are provided

## 📞 Support

For support or questions, please contact the development team.

## 📄 License

This project is licensed under the MIT License. 