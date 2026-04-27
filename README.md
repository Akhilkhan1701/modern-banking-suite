# Bank App

A full-stack banking system with PIN-protected transfers and admin workflows.

## Features

- **User Accounts**: Registration, login, and account requests (admin approved).
- **Security**: JWT sessions and 4-digit transaction PINs for all transfers.
- **P2P Transfers**: Send money between accounts with idempotency protection.
- **Admin Panel**: Review account requests, manage funds, and view audit logs.
- **System Reserve**: Automated treasury management for initial fund distribution.

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js, Express, MongoDB
- **Security**: JWT, Bcrypt, Helmet, Rate Limiting
- **DevOps**: Docker, Nginx, GitHub Actions

## Getting Started

1. **Install deps**: `npm run install:all`
2. **Config**: Copy `backend/.env.example` to `backend/.env` and set your secrets.
3. **Database**: Run `npm run seed:system-bank --prefix backend` to setup the system account.
4. **Run**: 
   - Backend: `npm run dev:backend`
   - Frontend: `npm run dev:frontend`

Visit `http://localhost:5173` to see it in action.

## Docker

Run everything with one command:
```bash
docker compose up -d --build
```
App will be at `http://localhost`.

## License
MIT
