1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Set up Neon PostgreSQL:
   - Go to https://neon.tech
   - Create a free account
   - Create a new project and database
   - Copy the connection string to DATABASE_URL in .env

3. Generate JWT Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Update .env with the generated secret

5. Run migrations:
```bash
npm run migrate
```

6. Start the server:
```bash
npm run dev
```
