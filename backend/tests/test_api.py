from datetime import datetime, timedelta


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_setup_creates_church_and_admin(client):
    payload = {
        "name": "Test Church", "email": "t@t.org",
        "admin_username": "boss", "admin_email": "boss@t.org",
        "admin_password": "password123", "admin_full_name": "Boss",
    }
    resp = client.post("/api/church/setup", json=payload)
    assert resp.status_code == 201
    # second setup is rejected
    assert client.post("/api/church/setup", json=payload).status_code == 409


def test_login_and_me(client, admin_token):
    me = client.get("/api/auth/me", headers=admin_token)
    assert me.status_code == 200
    assert me.json()["username"] == "admin"
    assert me.json()["role"] == "super_admin"


def test_protected_route_requires_auth(client):
    assert client.get("/api/members").status_code == 401


def test_member_crud(client, admin_token):
    h = admin_token
    resp = client.post("/api/members", headers=h, json={
        "first_name": "John", "last_name": "Doe", "category": "youth",
        "phone": "0801", "status": "active",
    })
    assert resp.status_code == 201, resp.text
    member = resp.json()
    assert member["full_name"] == "John Doe"
    assert member["qr_token"]

    mid = member["id"]
    resp = client.put(f"/api/members/{mid}", headers=h, json={"first_name": "Johnny"})
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Johnny"

    resp = client.get("/api/members?search=Doe", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # invalid category rejected
    resp = client.post("/api/members", headers=h, json={"first_name": "X", "category": "bogus"})
    assert resp.status_code == 400


def test_event_and_attendance_flow(client, admin_token):
    h = admin_token
    member = client.post("/api/members", headers=h, json={
        "first_name": "Jane", "last_name": "Smith",
    }).json()
    start = (datetime.utcnow() + timedelta(days=1)).isoformat()
    event = client.post("/api/events", headers=h, json={
        "title": "Sunday Service", "category": "worship",
        "start_at": start, "venue": "Main Hall",
    }).json()
    assert event["id"]

    # manual attendance mark
    resp = client.post("/api/attendance/mark", headers=h, json={
        "event_id": event["id"], "member": str(member["id"]), "status": "present",
    })
    assert resp.status_code == 201, resp.text

    # QR scan duplicate is rejected
    resp = client.post("/api/attendance/qr-scan", headers=h, json={
        "event_id": event["id"], "member": member["qr_token"], "status": "present",
    })
    assert resp.status_code == 409

    # QR scan by token works for a second member
    member2 = client.post("/api/members", headers=h, json={"first_name": "Bob"}).json()
    resp = client.post("/api/attendance/qr-scan", headers=h, json={
        "event_id": event["id"], "member": member2["qr_token"], "status": "present",
    })
    assert resp.status_code == 201

    summary = client.get(f"/api/attendance/summary/{event['id']}", headers=h).json()
    assert summary["present"] == 2
    assert summary["total"] == 2

    # visitor
    resp = client.post("/api/attendance/visitor", headers=h, json={
        "event_id": event["id"], "visitor_name": "Visitor Vic",
    })
    assert resp.status_code == 201
    summary = client.get(f"/api/attendance/summary/{event['id']}", headers=h).json()
    assert summary["visitors"] == 1


def test_ministry_membership(client, admin_token):
    h = admin_token
    member = client.post("/api/members", headers=h, json={"first_name": "Min", "last_name": "Member"}).json()
    ministry = client.post("/api/ministries", headers=h, json={"name": "Youth Ministry"}).json()
    resp = client.post(f"/api/ministries/{ministry['id']}/members", headers=h, json={
        "member_id": member["id"], "role_in_ministry": "Leader",
    })
    assert resp.status_code == 201
    members = client.get(f"/api/ministries/{ministry['id']}/members", headers=h).json()
    assert members[0]["member_name"] == "Min Member"


def test_schedules_and_occurrences(client, admin_token):
    h = admin_token
    resp = client.post("/api/schedules", headers=h, json={
        "name": "Sunday Worship", "day_of_week": 6, "recurrence": "weekly",
        "start_time": "09:00:00", "location": "Main Hall", "is_active": True,
    })
    assert resp.status_code == 201, resp.text
    occ = client.get("/api/schedules/occurrences?days=14", headers=h).json()
    assert len(occ) >= 2
    assert all(o["name"] == "Sunday Worship" for o in occ)


def test_dashboard_stats(client, admin_token):
    h = admin_token
    client.post("/api/members", headers=h, json={"first_name": "A", "status": "active"})
    stats = client.get("/api/dashboard/stats", headers=h).json()
    assert stats["total_members"] == 1
    assert stats["active_members"] == 1
    assert "attendance_today" in stats
