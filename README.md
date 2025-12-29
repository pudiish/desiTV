# 📺 DesiTV™

**Nostalgic retro TV streaming platform recreating authentic 2000s Indian television vibes**

DesiTV is a full-stack web application that brings back the nostalgic experience of watching Indian TV channels from the early 2000s. Built with modern web technologies, it features a realistic CRT TV interface, time-based programming schedules, and synchronized pseudolive streaming across all devices.

![DesiTV](https://img.shields.io/badge/DesiTV-Nostalgic%20TV%20Streaming-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge)

---

## ✨ Features

### 🎬 Authentic TV Experience
- **CRT TV Interface**: Realistic retro TV frame with scanlines and static effects
- **Remote Control**: Interactive TV remote with channel navigation, volume control, and power button
- **Time-Based Programming**: Channels switch content based on time slots (morning, afternoon, evening, prime time, etc.)
- **Pseudolive Streaming**: Synchronized playback across all devices using global epoch

### 🔄 Synchronization & Performance
- **Perfect Sync**: Mobile and desktop show the same content at the same time
- **Global Epoch System**: Server-authoritative timeline ensures consistency
- **Intelligent Caching**: Redis + in-memory caching with minimal latency
- **Real-time Position**: Automatic position calculation based on server time

### 🎨 User Experience
- **Fullscreen Mode**: Immersive viewing experience with fullscreen API
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Channel Categories**: Organized playlists (categories) with multiple videos
- **Session Persistence**: Remembers your last watched channel across sessions
- **Buffering Overlays**: Smooth transitions with loading indicators

### 🔧 Admin Features
- **Channel Management**: Add, edit, and manage channels and videos
- **Cache Management**: Monitor and clear server-side caches
- **System Controls**: Monitor health, metrics, and system status
- **YouTube Integration**: Fetch video metadata directly from YouTube

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **TailwindCSS** - Utility-first CSS framework
- **Custom CSS** - CRT effects, TV frame animations

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database (with Mongoose ODM)
- **Redis** - Caching layer (with in-memory fallback)
- **JWT** - Authentication

### Key Libraries
- **Helmet** - Security headers
- **express-mongo-sanitize** - Input sanitization
- **compression** - Response compression
- **bcrypt** - Password hashing

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (v6 or higher) - [Installation Guide](https://docs.mongodb.com/manual/installation/)
- **Redis** (v7 or higher) - [Installation Guide](https://redis.io/docs/getting-started/) (Optional - uses in-memory cache as fallback)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/pudiish/desiTV.git
cd desiTV
```

### 2. Install Dependencies

Install root dependencies:
```bash
npm install
```

Install server dependencies:
```bash
cd server
npm install
```

Install client dependencies:
```bash
cd ../client
npm install
```

### 3. Environment Configuration

Create a `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env  # If example exists, or create manually
```

Add the following environment variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
HOST=0.0.0.0

# MongoDB
MONGO_URI=mongodb://localhost:27017/desitv

# Redis (Optional - uses in-memory cache if not provided)
REDIS_URL=redis://localhost:6379

# JWT Secret (generate a strong secret key)
JWT_SECRET=your-super-secret-jwt-key-here

# CORS Origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Admin Credentials (for initial setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123  # Change this!
```

### 4. Database Setup

Make sure MongoDB is running:

```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

### 5. Start Redis (Optional)

```bash
# macOS (with Homebrew)
brew services start redis

# Linux
sudo systemctl start redis

# Windows
redis-server
```

---

## 🎮 Usage

### Development Mode

Run both server and client concurrently:

```bash
# From root directory
npm run dev
```

Or run separately:

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```

The application will be available at:
- **Client**: http://localhost:5173
- **Server API**: http://localhost:5000

### Production Build

Build the client:
```bash
cd client
npm run build
```

Start the server:
```bash
cd server
npm start
```

### Seed Database (Optional)

Populate the database with sample channels:

```bash
cd server
npm run seed
```

---

## 📁 Project Structure

```
desiTV/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── player/    # Video player components
│   │   │   ├── tv/        # TV frame and remote
│   │   │   └── overlays/  # UI overlays
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── logic/         # Business logic
│   │   ├── hooks/         # Custom React hooks
│   │   └── styles/        # CSS files
│   └── public/            # Static assets
├── server/                # Express backend
│   ├── routes/            # API routes
│   ├── models/            # MongoDB models
│   ├── middleware/        # Express middleware
│   └── utils/             # Utility functions
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

---

## 🔌 API Endpoints

### Public Endpoints

- `GET /api/channels` - Get all channels
- `GET /api/channels/:id` - Get channel by ID
- `GET /api/channels/:id/current` - Get current video position
- `GET /api/global-epoch` - Get global broadcast epoch

### Admin Endpoints (Requires Authentication)

- `POST /api/auth/login` - Admin login
- `GET /api/auth/logout` - Admin logout
- `POST /api/channels` - Create channel
- `PUT /api/channels/:id` - Update channel
- `DELETE /api/channels/:id` - Delete channel
- `POST /api/youtube/search` - Search YouTube videos

---

## 🎯 Key Concepts

### Global Epoch
The global epoch is a server-set timestamp that represents when the broadcast timeline started. All channels calculate their current position based on time elapsed since this epoch, ensuring perfect synchronization across devices.

### Pseudolive Streaming
Videos are played in a continuous loop, and the current position is calculated based on elapsed time since the global epoch. This creates a "live" experience where everyone sees the same content at the same time.

### Time-Based Programming
Channels can have different playlists for different time slots (morning, afternoon, evening, prime time, night). The system automatically selects the appropriate playlist based on the current time.

### Position Calculation
Position is calculated server-side using:
- Global epoch (when broadcast started)
- Current server time
- Channel playlist durations
- Time slot selection (if applicable)

---

## 🔒 Security Features

- **Helmet.js** - Security HTTP headers
- **CORS** - Cross-origin resource sharing configuration
- **Rate Limiting** - Prevent abuse
- **Input Sanitization** - MongoDB injection prevention
- **JWT Authentication** - Secure admin access
- **CSRF Protection** - Cross-site request forgery prevention

---

## 🧪 Testing

Run tests:

```bash
# Server tests
cd server
npm test

# Client tests
cd client
npm test
```

---

## 📝 Configuration

### Cache Settings

- **Position Cache TTL**: 1 second (for perfect sync)
- **Epoch Cache TTL**: 2 seconds (client-side)
- **Channel Cache TTL**: 5 minutes (server-side)

### Sync Settings

- **Epoch Refresh Interval**: 3 seconds
- **Position Refresh**: Real-time (calculated on-demand)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use ESLint and Prettier for code formatting
- Follow existing code patterns
- Write meaningful commit messages
- Add tests for new features

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Swarnapudi Ishwar**

- Email: swarnapudiishwar@gmail.com
- GitHub: [@pudiish](https://github.com/pudiish)
- Website: [https://pudiish.github.io/pudi/](https://pudiish.github.io/pudi/)

---

## 🙏 Acknowledgments

- Inspired by the nostalgic 2000s Indian TV experience
- Built with modern web technologies for the best user experience
- Special thanks to all contributors and testers

---

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Documentation](DOCUMENTATION.md)
2. Search existing [Issues](https://github.com/pudiish/desiTV/issues)
3. Create a new issue with detailed information

---

## 🗺️ Roadmap

- [ ] WebSocket support for real-time updates
- [ ] User authentication and profiles
- [ ] Favorite channels and playlists
- [ ] Video quality selection
- [ ] Chromecast support
- [ ] PWA (Progressive Web App) features
- [ ] Offline mode support

---

**Made with ❤️ for the nostalgic 2000s Indian TV experience**

*Power Dabaao Aur Shuru Karo!* 🔴

