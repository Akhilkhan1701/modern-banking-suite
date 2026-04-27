import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./index.css";

const TOKEN_KEY = "bank_frontend_token";
const USER_KEY = "bank_frontend_user";

function buildHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }
  return data;
}

function generateIdempotencyKey(prefix = "TXN") {
  // Not security sensitive; just needs low collision risk.
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  const authValue = useMemo(
    () => ({
      token,
      user,
      setAuth(nextToken, nextUser) {
        setToken(nextToken);
        setUser(nextUser);
        localStorage.setItem(TOKEN_KEY, nextToken);
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      },
      clearAuth() {
        setToken(null);
        setUser(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      },
    }),
    [token, user],
  );

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={
          <PublicOnly token={token}>
            <AuthPage mode="login" authValue={authValue} />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly token={token}>
            <AuthPage mode="register" authValue={authValue} />
          </PublicOnly>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <Protected token={token}>
            <DashboardShell authValue={authValue} />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to={token ? "/dashboard/accounts" : "/"} replace />} />
    </Routes>
  );
}

function Landing() {
  useEffect(() => {
    document.title = "Banking App";
  }, []);

  return (
    <div className="page-shell">
      <header className="topbar card" style={{ background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', color: '#fff' }}>
        <div>
          <h2 style={{ margin: 0 }}>Banking App</h2>
          <p className="muted" style={{ color: '#e0e0e0', marginTop: '0.5rem' }}>PIN-based transfers. Admin approvals. Production-ready container setup.</p>
        </div>
        <div className="row">
          <Link className="nav-pill active-pill" to="/login" style={{ background: '#fff', color: '#1e3c72' }}>
            Login
          </Link>
          <Link className="nav-pill" to="/register" style={{ color: '#fff', borderColor: '#fff' }}>
            Register
          </Link>
        </div>
      </header>

      <section className="card" style={{ marginTop: '2rem' }}>
        <h3 style={{ color: '#4f46e5' }}>What you can do</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>Create accounts (admin approval required)</li>
          <li>Send money using a 4-digit PIN</li>
          <li>View transaction history</li>
          <li>Admin panel: approve accounts + fund users</li>
        </ul>
      </section>
    </div>
  );
}

function PublicOnly({ token, children }) {
  if (token) return <Navigate to="/dashboard/accounts" replace />;
  return children;
}

function Protected({ token, children }) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AuthPage({ mode, authValue }) {
  const isLogin = mode === "login";
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin ? { email, password } : { name, email, password, pin };
      const data = await apiRequest(path, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      authValue.setAuth(data.token, data.user);
      navigate("/dashboard/accounts", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-form card">
        <h1>{isLogin ? "Sign In" : "Open New Profile"}</h1>
        <p className="muted">Secure banking with admin approvals and PIN transactions.</p>
        <form className="form" onSubmit={onSubmit}>
          {!isLogin && (
            <>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                4-digit PIN
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  required
                  placeholder="****"
                />
              </label>
            </>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          {error ? <div className="alert error-alert">Error: {error}</div> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
          </button>
        </form>
        <p className="muted">
          {isLogin ? "Need account?" : "Already registered?"}{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => navigate(isLogin ? "/register" : "/login")}
          >
            {isLogin ? "Register" : "Login"}
          </button>
        </p>
      </div>

      <div className="hero-panel card">
        <div className="slide-track">
          <div className="slide">Fast transfers with transaction PIN validation.</div>
          <div className="slide">New account requests require admin approval.</div>
          <div className="slide">Admin funding panel for controlled top-ups.</div>
        </div>
      </div>
    </div>
  );
}

function DashboardShell({ authValue }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = !!authValue.user?.systemUser;

  function logout() {
    authValue.clearAuth();
    navigate("/login", { replace: true });
  }

  const navItems = [
    { to: "/dashboard/accounts", label: "Accounts" },
    { to: "/dashboard/transfer", label: "Transfer" },
    { to: "/dashboard/history", label: "History" },
  ];
  if (isAdmin) {
    navItems.push({ to: "/dashboard/admin", label: "Admin" });
  }

  return (
    <div className="page-shell">
      <header className="topbar card" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: '#111827' }}>
        <div>
          <h2 style={{ margin: 0 }}>Banking Control Center</h2>
          <p className="muted" style={{ color: '#374151', marginTop: '0.5rem' }}>
            User: <strong>{authValue.user?.name || authValue.user?.email}</strong>
          </p>
        </div>
        <button onClick={logout} style={{ background: '#111827', color: '#fff' }}>Logout</button>
      </header>

      <nav className="card nav-grid">
        {navItems.map((item) => (
          <Link
            key={item.to}
            className={`nav-pill ${location.pathname === item.to ? "active-pill" : ""}`}
            to={item.to}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <Routes>
        <Route path="accounts" element={<AccountsPage authValue={authValue} />} />
        <Route path="transfer" element={<TransferPage authValue={authValue} />} />
        <Route path="history" element={<HistoryPage authValue={authValue} />} />
        <Route
          path="admin"
          element={isAdmin ? <AdminPage authValue={authValue} /> : <Navigate to="/dashboard/accounts" replace />}
        />
        <Route path="*" element={<Navigate to="/dashboard/accounts" replace />} />
      </Routes>
    </div>
  );
}

function AccountsPage({ authValue }) {
  const [accounts, setAccounts] = useState([]);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAccounts() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/accounts", { headers: buildHeaders(authValue.token) });
      setAccounts(data.accounts || []);
      setUnlocked(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadAccounts();
    }, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAccount() {
    setCreating(true);
    setMessage("");
    setError("");
    try {
      const data = await apiRequest("/api/accounts", {
        method: "POST",
        headers: buildHeaders(authValue.token),
      });
      setMessage(data.message || "Account request submitted");
      await loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function unlockBalances(event) {
    event.preventDefault();
    setUnlocking(true);
    setMessage("");
    setError("");
    try {
      const data = await apiRequest("/api/accounts/unlock", {
        method: "POST",
        headers: buildHeaders(authValue.token),
        body: JSON.stringify({ pin: unlockPin }),
      });
      setAccounts(data.accounts || []);
      setUnlocked(true);
      setUnlockPin("");
      setMessage("Balances unlocked for this session.");
    } catch (err) {
      setError(err.message);
      setUnlocked(false);
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h3>My Accounts</h3>
          <p className="muted">For privacy, balances are hidden until you unlock with your PIN.</p>
        </div>
        <div className="row">
          <button onClick={loadAccounts} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button onClick={createAccount} disabled={creating}>
            {creating ? "Submitting..." : "Request New Account"}
          </button>
        </div>
      </div>

      <form className="inline-form" onSubmit={unlockBalances}>
        <label className="inline-label">
          Unlock balances (PIN)
          <input
            type="password"
            value={unlockPin}
            onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="****"
            inputMode="numeric"
            required
          />
        </label>
        <button type="submit" disabled={unlocking}>
          {unlocking ? "Unlocking..." : unlocked ? "Unlocked" : "Unlock"}
        </button>
      </form>

      {message ? <div className="alert success-alert">{message}</div> : null}
      {error ? <div className="alert error-alert">Error: {error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account ID</th>
              <th>Status</th>
              <th>Currency</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", color: "#6b7280" }}>No accounts found.</td>
              </tr>
            ) : accounts.map((account) => (
              <tr key={account._id}>
                <td><span style={{ fontFamily: "monospace", color: "#4f46e5", fontWeight: 600 }}>{account._id}</span></td>
                <td><span className={`status-badge status-${account.status?.toLowerCase()}`}>{account.status}</span></td>
                <td>{account.currency}</td>
                <td><strong>{unlocked ? `₹${account.balance ?? 0}` : "Locked"}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TransferPage({ authValue }) {
  const [accounts, setAccounts] = useState([]);
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAccounts() {
    const data = await apiRequest("/api/accounts", { headers: buildHeaders(authValue.token) });
    const active = (data.accounts || []).filter((account) => account.status === "Active");
    setAccounts(active);
    if (active.length) {
      setFromAccount(active[0]._id);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadAccounts().catch(() => {});
    }, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function transferMoney(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await apiRequest("/api/transactions", {
        method: "POST",
        headers: buildHeaders(authValue.token),
        body: JSON.stringify({
          fromAccount,
          toAccount,
          amount: Number(amount),
          pin,
          idempotencyKey: generateIdempotencyKey("TXN"),
        }),
      });
      setMessage("Transfer completed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h3>Send Money</h3>
      <p className="muted">Transfers require your 4-digit transaction PIN.</p>
      <form className="form" onSubmit={transferMoney}>
        <label>
          From Account
          <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} required>
            {accounts.length === 0 && <option value="" disabled>No active accounts available</option>}
            {accounts.map((account) => (
              <option key={account._id} value={account._id}>
                {account._id}
              </option>
            ))}
          </select>
        </label>
        <label>
          To Account ID
          <input value={toAccount} onChange={(e) => setToAccount(e.target.value)} required placeholder="Destination Account ID" />
        </label>
        <label>
          Amount
          <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="e.g. 100.00" />
        </label>
        <label>
          PIN
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            required
            placeholder="****"
          />
        </label>
        <button type="submit" disabled={loading || accounts.length === 0}>{loading ? "Sending..." : "Send Money"}</button>
      </form>
      {message ? <div className="alert success-alert">{message}</div> : null}
      {error ? <div className="alert error-alert">Error: {error}</div> : null}
    </section>
  );
}

function HistoryPage({ authValue }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/transactions/me", { headers: buildHeaders(authValue.token) });
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadHistory();
    }, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="card">
      <div className="section-head" style={{ marginBottom: '1rem' }}>
        <h3>Transaction History</h3>
        <button onClick={loadHistory} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
      </div>
      {error ? <div className="alert error-alert">Error: {error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", color: "#6b7280" }}>No transactions yet.</td>
              </tr>
            ) : transactions.map((txn) => (
              <tr key={txn._id}>
                <td><span style={{ fontFamily: "monospace", fontSize: "0.85em", color: "#6b7280" }}>{txn._id.slice(-8)}</span></td>
                <td><span style={{ fontFamily: "monospace" }}>{txn.fromAccount}</span></td>
                <td><span style={{ fontFamily: "monospace" }}>{txn.toAccount}</span></td>
                <td><strong style={{ color: txn.type === 'CREDIT' ? '#047857' : '#1f2937' }}>₹{txn.amount}</strong></td>
                <td><span className={`status-badge status-${txn.status?.toLowerCase()}`}>{txn.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminPage({ authValue }) {
  const [pendingAccounts, setPendingAccounts] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [targetAccountId, setTargetAccountId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [funding, setFunding] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPending() {
    setError("");
    try {
      const data = await apiRequest("/api/accounts/admin/pending", {
        headers: buildHeaders(authValue.token),
      });
      setPendingAccounts(data.accounts || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadAllAccounts() {
    setError("");
    try {
      const data = await apiRequest("/api/accounts/admin/all", {
        headers: buildHeaders(authValue.token),
      });
      setAllAccounts(data.accounts || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPending();
      loadAllAccounts();
    }, 0);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reviewAccount(accountId, action) {
    setMessage("");
    setError("");
    try {
      await apiRequest(`/api/accounts/admin/${action}/${accountId}`, {
        method: "POST",
        headers: buildHeaders(authValue.token),
        body: JSON.stringify({ note: `${action}d by admin` }),
      });
      await loadPending();
      setMessage(`Account ${action}d.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function fundAccount(event) {
    event.preventDefault();
    setFunding(true);
    setMessage("");
    setError("");
    try {
      await apiRequest("/api/transactions/system/initial-funds", {
        method: "POST",
        headers: buildHeaders(authValue.token),
        body: JSON.stringify({
          toAccount: targetAccountId,
          amount: Number(fundAmount),
          idempotencyKey: generateIdempotencyKey("ADMIN_FUND"),
        }),
      });
      setMessage("Funds added successfully.");
      setTargetAccountId("");
      setFundAmount("");
      await loadAllAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setFunding(false);
    }
  }

  async function manageAccount(accountId, action) {
    setMessage("");
    setError("");
    try {
      await apiRequest(`/api/accounts/admin/${action}/${accountId}`, {
        method: "POST",
        headers: buildHeaders(authValue.token),
        body: JSON.stringify({ note: `${action}d by admin` }),
      });
      await loadAllAccounts();
      setMessage(`Account ${action}d.`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <h3>Admin Controls</h3>
      {message ? <div className="alert success-alert">{message}</div> : null}
      {error ? <div className="alert error-alert">Error: {error}</div> : null}

      <h4>Pending Account Approvals</h4>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>User</th>
              <th>Email</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingAccounts.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", color: "#6b7280" }}>No pending accounts.</td>
              </tr>
            ) : pendingAccounts.map((account) => (
              <tr key={account._id}>
                <td><span style={{ fontFamily: "monospace" }}>{account._id}</span></td>
                <td>{account.user?.name}</td>
                <td>{account.user?.email}</td>
                <td className="row">
                  <button type="button" onClick={() => reviewAccount(account._id, "approve")}>Approve</button>
                  <button type="button" className="danger" onClick={() => reviewAccount(account._id, "reject")}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 style={{ marginTop: '2rem' }}>Direct Funding</h4>
      <form className="form" onSubmit={fundAccount}>
        <label>
          Target Account ID
          <input value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)} required placeholder="Target Account ID" />
        </label>
        <label>
          Amount
          <input type="number" min="1" step="0.01" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} required placeholder="e.g. 5000.00" />
        </label>
        <button type="submit" disabled={funding}>{funding ? "Funding..." : "Fund Account"}</button>
      </form>

      <h4 style={{ marginTop: '2rem' }}>Manage Accounts</h4>
      <p className="muted" style={{ marginBottom: '1rem' }}>View account owners and revoke/restore access.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Owner</th>
              <th>Email</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {allAccounts.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", color: "#6b7280" }}>No accounts found.</td>
              </tr>
            ) : allAccounts.map((account) => (
              <tr key={account._id}>
                <td><span style={{ fontFamily: "monospace" }}>{account._id}</span></td>
                <td>{account.user?.name}</td>
                <td>{account.user?.email}</td>
                <td><span className={`status-badge status-${account.status?.toLowerCase()}`}>{account.status}</span></td>
                <td><strong>₹{account.balance ?? 0}</strong></td>
                <td className="row">
                  {account.status === "FROZEN" ? (
                    <button type="button" onClick={() => manageAccount(account._id, "unrevoke")}>
                      Restore
                    </button>
                  ) : (
                    <button type="button" className="danger" onClick={() => manageAccount(account._id, "revoke")}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default App;
