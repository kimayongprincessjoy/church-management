import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errMsg } from "../api";

export default function ChurchSetup() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", logo_url: "", address: "", denomination: "", phone: "", email: "",
    pastor_name: "", description: "", founded_date: "",
    admin_username: "", admin_email: "", admin_password: "", admin_full_name: "",
  });

  const set = (k: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const OPTIONAL = ["logo_url", "address", "denomination", "phone", "email", "pastor_name", "description", "founded_date"];
    const payload: any = { ...form };
    for (const k of OPTIONAL) if (payload[k] === "") payload[k] = null;
    try {
      await api.post("/church/setup", payload);
      navigate("/login");
    } catch (err: any) {
      setError(errMsg(err, "Setup failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 640 }}>
        <h1>Church Setup</h1>
        <p className="sub">Tell us about your church and create the administrator account.</p>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field"><label>Church Name *</label><input value={form.name} onChange={set("name")} required /></div>
            <div className="field"><label>Logo URL</label><input value={form.logo_url} onChange={set("logo_url")} placeholder="https://…" /></div>
            <div className="field"><label>Denomination</label><input value={form.denomination} onChange={set("denomination")} /></div>
            <div className="field"><label>Phone</label><input value={form.phone} onChange={set("phone")} /></div>
            <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set("email")} /></div>
            <div className="field"><label>Pastor's Name</label><input value={form.pastor_name} onChange={set("pastor_name")} /></div>
            <div className="field"><label>Founded Date</label><input type="date" value={form.founded_date} onChange={set("founded_date")} /></div>
            <div className="field full"><label>Address</label><input value={form.address} onChange={set("address")} /></div>
            <div className="field full"><label>Description</label><textarea rows={3} value={form.description} onChange={set("description")} /></div>
          </div>

          <h3 style={{ color: "var(--navy)", marginTop: 24 }}>Administrator Account</h3>
          <div className="form-grid">
            <div className="field"><label>Full Name *</label><input value={form.admin_full_name} onChange={set("admin_full_name")} required /></div>
            <div className="field"><label>Username *</label><input value={form.admin_username} onChange={set("admin_username")} required /></div>
            <div className="field"><label>Email *</label><input type="email" value={form.admin_email} onChange={set("admin_email")} required /></div>
            <div className="field"><label>Password * (min 8 chars)</label><input type="password" value={form.admin_password} onChange={set("admin_password")} required minLength={8} /></div>
          </div>

          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" disabled={loading} style={{ marginTop: 16, width: "100%" }}>
            {loading ? "Setting up…" : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
