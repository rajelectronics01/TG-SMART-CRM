import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from '../core/supabase/client';
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchRecentTickets = async () => {
    const { data } = await supabase
      .from('tickets')
      .select('id, ticket_number, status, customers(name)')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setRecentTickets(data);
  };

  useEffect(() => {
    fetchRecentTickets();
  }, []);

  useEffect(() => {
    if (!isAdmin && !isManager) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('New ticket alert:', payload);
          setUnreadNotifications(prev => prev + 1);
          fetchRecentTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, isManager]);
  
  let nav = employeeNav;
  if (isAdmin) nav = adminNav;
  else if (isManager) nav = managerNav;

  const initials = employee?.name
    ? employee.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  async function handleSignOut() {
    if (window.confirm("Are you sure you want to sign out?")) {
      await signOut();
      navigate("/login");
    }
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
            <div style={{ position: 'relative' }}>
              <button 
                className="icon-btn relative" 
                title="Notifications" 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setUnreadNotifications(0);
                }}
              >
                <Bell size={16} />
                {unreadNotifications > 0 && (
                  <span className="notification-badge-pulse">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div 
                    onClick={() => setShowNotifications(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 100 }} 
                  />
                  <div className="glass-card" style={{ 
                    position: 'absolute', top: 'calc(100% + 10px)', right: 0, 
                    width: '320px', zIndex: 101, padding: '1rem',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--outline)' }}>
                      <h4 style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>Recent Complaints</h4>
                      <Link to={isAdmin ? "/admin/tickets" : "/manager/tickets"} onClick={() => setShowNotifications(false)} style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>See All</Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {recentTickets.length === 0 ? (
                        <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', padding: '1rem' }}>No recent tickets.</p>
                      ) : recentTickets.map((t) => (
                        <Link 
                          key={t.id} 
                          to={isAdmin ? `/admin/tickets/${t.id}` : `/manager/tickets/${t.id}`}
                          onClick={() => setShowNotifications(false)}
                          style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                            textDecoration: 'none', color: 'inherit', padding: '0.5rem',
                            borderRadius: '8px', background: 'var(--surface-high)'
                          }}
                        >
                          <div>
                            <p style={{ fontWeight: 800, fontSize: '0.85rem' }}>#{t.ticket_number}</p>
                            <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t.customers?.name}</p>
                          </div>
                          <span className={`badge badge-${t.status}`} style={{ transform: 'scale(0.8)' }}>{t.status}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
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
          {nav.slice(0, 5).map((item) => {
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

      <style>{`
        .notification-badge-pulse {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          border: 2px solid #fff;
          box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          animation: pulse-red 2s infinite;
        }

        @keyframes pulse-red {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
