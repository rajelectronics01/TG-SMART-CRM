# TG CRM — Master Ledger & Squad Plan
**Version:** 1.1 | **Date:** March 23, 2026

---

## 📋 Project Overview
A web-based **Service CRM** for a Home Appliances & Electronics business. 
Built on **React + Vite + Supabase** with a modular-first architecture. Currently focus: stabilizing field operations and providing admin insights.

---

## 🗺️ Master Roadmap

### Phase 1 — Foundation & Customer Portal ✅ DONE
- [x] Configure Supabase (Auth, DB Schema, Storage, RLS)
- [x] Build Customer Complaint Form (public)
- [x] Build Ticket Confirmation + Tracking Pages

### Phase 2 — Employee Portal ✅ DONE
- [x] Employee Login (OTP / Password)
- [x] Employee Dashboard (My Tickets)
- [x] Ticket Detail + Actions (Status Update, Photo Uploads)
- [x] Spares Management Module

### Phase 3 — Admin & Manager Portals 🔄 IN PROGRESS
- [x] Admin Login & Role Redirection
- [x] All-Tickets View (Filter, Search, Re-assign)
- [x] Employee Management & CRUD (Admin Only)
- [x] **Area Manager Portal** (Regional Oversight - Stabilized)
- [x] Franchise Routing Map (Technician-Pincode assignment)
- [ ] **Admin Reports & Export** (SLA Tracking, Monthly CSV) 👈 **ACTIVE STEP**

### Phase 4 — Notifications & Analytics ⏳ PENDING
- [x] SMS Integration (Fast2SMS)
- [ ] Automated Status Change Alerts (Assigned, Resolved, etc.)
- [ ] Real-time Admin Notifications (Service Bell)
- [ ] Analytics Charts (Resolution Time, High-volume Zones)

---

## 🏗️ Architecture Milestones

| Milestone | Description | Status |
| :--- | :--- | :--- |
| M1 | Core DB Schema & RLS | ✅ Done |
| M2 | Technician Workspace (Mobile First) | ✅ Done |
| M3 | Regional Manager Dashboard | ✅ Done |
| M4 | Admin Command Center | ✅ Done |
| M5 | **Reports & Data Export** | 🔄 In Progress |
| M6 | Automated Customer Notifications | ⏳ Next |

---

## 👥 Squad Status

| Agent | Task | Status |
| :--- | :--- | :--- |
| Antigravity | Building Reports & Export Functionality | 🚀 Processing |

---

## 🚩 Current Trajectory: Reports & Export
- Create `AdminReportsPage.tsx` with date filters.
- Implement CSV Export for ticket data.
- Build "SLA Warning" logic (color coding tickets over 48h).
