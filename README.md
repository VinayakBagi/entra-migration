# Entra External ID User Migration

Migrate users from PostgreSQL to Microsoft Entra External ID with support for bulk and JIT migration.

## Quick Start

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push
node prisma/seed.js

# Start server
npm run dev
```

Tech Stack

Express.js - API framework
Prisma - Database ORM
PostgreSQL - Database
Microsoft Graph API - Entra integration
bcrypt - Password hashing
JWT - Authentication
