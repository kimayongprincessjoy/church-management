import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import api from "../api";
import type { Member } from "../types";

export default function MemberDetail() {
  const { id } = useParams();
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Member>(`/members/${id}`).then((r) => setMember(r.data)).catch(() => setError("Member not found"));
  }, [id]);

  if (error) return <div className="empty-state">{error}</div>;
  if (!member) return <div className="loading-screen">Loading…</div>;

  const fields: [string, any][] = [
    ["Category", member.category.replace(/_/g, " ")],
    ["Status", member.status],
    ["Gender", member.gender],
    ["Birthday", member.birthday],
    ["Phone", member.phone],
    ["Address", member.address],
    ["Emergency Contact", member.emergency_contact],
    ["Date Joined", member.joined_date],
    ["Notes", member.notes],
  ];

  return (
    <div>
      <div className="page-header">
        <h2>{member.full_name}</h2>
        <span className={`badge ${member.status === "active" ? "green" : "gray"}`}>{member.status}</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>Profile</h3>
          {member.photo_url && <img src={member.photo_url} alt="" style={{ width: 96, height: 96, borderRadius: 12, objectFit: "cover", marginBottom: 12 }} />}
          <table>
            <tbody>
              {fields.map(([k, v]) => (
                <tr key={k}><td style={{ width: 160, color: "var(--muted)" }}>{k}</td><td>{v ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card qr-box">
          <h3>Member QR Code</h3>
          <p style={{ color: "var(--muted)", fontSize: ".85rem" }}>
            Members present this QR at events for instant check-in.
          </p>
          <QRCodeSVG value={`${window.location.origin}/checkin?token=${member.qr_token}`} size={200} />
          <div style={{ marginTop: 12 }}>
            <a
              className="btn btn-ghost btn-sm"
              href={`${import.meta.env.VITE_API_URL ?? ""}/api/attendance/member-qr/${member.id}.png`}
              target="_blank" rel="noreferrer"
            >
              Download PNG
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
