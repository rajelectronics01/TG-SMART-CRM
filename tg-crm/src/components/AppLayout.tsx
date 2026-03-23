import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Ticket, User,
  LogOut, Bell, Settings, ChevronRight, MapPin, Users
} from "lucide-react";
import { useAuth } from "../core/auth/AuthContext";

interface AppLayoutProps {
  readonly children: React.ReactNode;
  readonly title?: string;
}

const employeeNav = [
  { to: "/dashboard", label: "My Tickets", icon: <Ticket size={18} /> },
];

const managerNav = [
  { to: "/manager", label: "Area Overview", icon: <LayoutDashboard size={18} /> },
  { to: "/manager/tickets", label: "Regional Tickets", icon: <Ticket size={18} /> },
  { to: "/manager/technicians", label: "My Team", icon: <Users size={18} /> },
];

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { to: "/admin/tickets", label: "All Tickets", icon: <Ticket size={18} /> },
  { to: "/admin/employees", label: "Employees", icon: <User size={18} /> },
  { to: "/admin/routing", label: "Franchise Map", icon: <MapPin size={18} /> },
  { to: "/admin/reports", label: "Reports", icon: <ChevronRight size={18} /> },
  { to: "/admin/settings", label: "Settings", icon: <Settings size={18} /> },
];

export default function AppLayout({ children, title }: AppLayoutProps) {
  const { employee, isAdmin, isManager, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  let nav = employeeNav;
  if (isAdmin) nav = adminNav;
  else if (isManager) nav = managerNav;

  const initials = employee?.name
    ? employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const portalName = isAdmin ? "Admin Portal" : isManager ? "Area Manager" : "Staff Portal";

  return (
    <div className="app-layout-wrapper" style={{ display: "flex", minHeight: "100vh", background: "var(--surface-lowest)" }}>
      {/* --- SIDEBAR (Desktop Only) --- */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <img src="/tg-logo.jpg" alt="TG Logo" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontFamily: "var(--font-headline)", fontWeight: 800, fontSize: "1.25rem", color: "var(--on-background)", lineHeight: 1 }}>
              CRM
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--on-surface-variant)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: '0.25rem', fontWeight: 700 }}>
              {portalName}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {nav.map((item) => {
            const isActive = item.to === "/admin" || item.to === "/manager"
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} className={`nav-item ${isActive ? "active" : ""}`}>
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--on-surface)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {employee?.name ?? "Loading..."}
            </div>
          </div>
          <button onClick={handleSignOut} title="Sign out"
            style={{ background: "none", border: "none", color: "var(--outline)", cursor: "pointer", padding: "4px" }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Responsive Header */}
        <header style={{
          height: "var(--header-height)", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 2rem", borderBottom: "1px solid var(--outline)",
          background: "var(--surface-low)", flexShrink: 0,
        }}>
          {/* Mobile Logo (Left) */}
          <div className="mobile-only" style={{ display: 'flex', alignItems: "center", gap: "0.6rem" }}>
            <img src="/tg-logo.jpg" alt="Logo" style={{ width: 44, height: 32, objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em", color: 'var(--on-background)' }}>CRM</span>
          </div>

          {/* Desktop Title */}
          <div className="desktop-only">
            {title && (
              <h1 style={{ fontFamily: "var(--font-headline)", fontSize: "1.1rem", fontWeight: 700, color: "var(--on-background)" }}>
                {title}
              </h1>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button className="desktop-only" style={{ background: "var(--surface-highest)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--on-surface-variant)" }}>
              <Bell size={16} />
            </button>
            <div className="avatar" style={{ width: 32, height: 32, fontSize: "0.7rem" }}>{initials}</div>
            <button className="mobile-only" onClick={handleSignOut} style={{ background: "none", border: "none", color: "var(--on-surface-variant)" }}>
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="mobile-bottom-nav mobile-only">
          {nav.slice(0, 4).map((item) => {
             const isActive = item.to === "/admin" || item.to === "/manager"
             ? location.pathname === item.to
             : location.pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} className={`mobile-nav-item ${isActive ? "active" : ""}`}>
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
