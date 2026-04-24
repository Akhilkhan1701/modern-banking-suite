# Modern Banking Application

A full-stack banking application with PIN-protected transactions, admin approval workflows, and containerized deployment.

## 🚀 Key Features

### 👤 User Capabilities
- **Secure Auth**: Register and login with JWT-based session management.
- **Transaction PIN**: All sensitive actions require a 4-digit PIN for added security.
- **Account Management**: Request new bank accounts (subject to admin approval).
- **P2P Transfers**: Securely transfer funds to other accounts using their unique ID and your PIN.
- **Transaction History**: Real-time tracking of all credits and debits.

### 🛡️ Admin & System Features
- **Approval Workflow**: Admins review and approve/reject new account requests.
- **Fund Management**: System users can add funds to accounts for initial testing.
- **Audit Logging**: Comprehensive tracking of all major actions for security compliance.
- **System Reserve**: Automatic seeding of a system reserve account for initial liquidity.

### 🛠️ Technical Stack
- **Frontend**: React (Vite), Modern UI with CSS animations.
- **Backend**: Node.js, Express, MongoDB (Mongoose).
- **Security**: JWT, Bcrypt, Helmet, Express Rate Limit, Idempotency keys.
- **DevOps**: Docker, Docker Compose, Nginx, GitHub Actions (CI), Kubernetes manifests.

---

## 🛠️ Local Development

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- npm or yarn

### 2. Setup
Clone the repository and install dependencies:
```bash
# Install all dependencies (root, backend, frontend)
npm run install:all
```

### 3. Environment Configuration
Copy the example environment files and fill in your credentials:
```bash
cp backend/.env.example backend/.env
```
*Note: Ensure `MONGO_URI` and `JWT_SECRET` are properly set.*

### 4. Database Seeding
Create the initial system administrator account:
```bash
npm run seed:system-bank --prefix backend
```

### 5. Start the Application
```bash
# Start backend (port 3000)
npm run dev:backend

# Start frontend (port 5173)
npm run dev:frontend
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Docker Deployment

The application is fully containerized using Docker Compose, including an Nginx reverse proxy.

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f
```
Access the production-ready app at [http://localhost](http://localhost).

---

## 🛡️ Security & Best Practices
- **Idempotency**: All transactions use idempotency keys to prevent duplicate transfers.
- **Audit Trails**: Every sensitive action (login, transfer, approval) is logged in the `Audit` collection.
- **Input Validation**: Strict schema validation using Zod.
- **Rate Limiting**: Protects against brute-force and DoS attacks.

## 📄 License
This project is licensed under the [MIT License](LICENSE).
