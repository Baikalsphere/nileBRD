# BRM Portal Backend

Node.js Express backend with PostgreSQL (Neon) for the BRM Portal authentication system.

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your Neon database URL and JWT secret
```

3. **Run migrations:**
```bash
npm run migrate
```

4. **Start server:**
```bash
npm run dev
```

## Features

✅ JWT-based authentication
✅ Role-based access control (Stakeholder, BA, IT)
✅ Neon PostgreSQL integration
✅ Bcrypt password hashing
✅ CORS support
✅ Auth logging and audit trail
✅ Email uniqueness validation

## API Endpoints

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token
- `GET /health` - Health check with DB status

## Database Tables

- **users** - User accounts with roles
- **auth_logs** - Audit trail for auth events

## Environment Variables

See `.env.example` for all required variables.

## Technologies

- Express.js 4.18
- PostgreSQL with Neon
- JWT for auth
- Bcrypt for password hashing
- CORS for frontend communication

## Development

```bash
npm run dev      # Start with nodemon
npm start        # Start production server
npm run migrate  # Run database migrations
```
