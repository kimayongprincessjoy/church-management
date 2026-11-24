import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ configured: boolean }>("/church/status").then((r) => setConfigured(r.data.configured));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Church Management System</h1>
        <p className="sub">Sign in to continue</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        {configured === false && (
          <p className="sub" style={{ marginTop: 20 }}>
            First time? <a href="/setup">Set up your church</a>
          </p>
        )}
      </div>
    </div>
  );
}
