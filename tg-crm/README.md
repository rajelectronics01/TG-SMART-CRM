# TG Service CRM

A professional Service CRM system for Home Appliances & Electronics businesses.  
Built on **React + Vite + TypeScript + Supabase**.

## Features (Phase 1)
- 🎫 Customer Complaint Registration (no login)
- 🔍 Ticket Status Tracking (public)
- 👷 Employee Portal (secure login)
- 🛡️ Admin Portal (full access)
- 📦 Spares Management
- 📊 Reports & Analytics

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend/DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth (OTP + Password) |
| Storage | Supabase Storage |
| Hosting | Vercel |

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in your Supabase credentials
npm run dev
```

## Architecture
The codebase is structured as a **feature-based monorepo** so that future phases (Brand Website, Product Catalogue, eCommerce) can be added as new feature slices without restructuring anything.

```
src/
├── core/          # Shared: supabase client, auth context, types, utils
├── features/
│   ├── crm/       # Phase 1: CRM (this module)
│   ├── catalogue/ # Phase 2: Product Catalogue (future)
│   └── ecommerce/ # Phase 3: eCommerce (future)  
├── components/    # Shared UI components
├── hooks/         # Shared custom hooks
├── pages/         # Route-level page assembly
└── data/          # Static/mock data
```
