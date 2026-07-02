import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import { RefreshCw, Layers, Map as MapIcon, Info, Users, CheckCircle2, Navigation } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  color: string;
  role: string;
}

interface PincodeRoute {
  id: string;
  pincode: string;
  employee_id: string;
}

const FRANCHISE_COLORS = [
  '#0ea5e9', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', 
  '#14b8a6', '#db2777', '#64748b', '#eab308', '#22c55e'
];

const REGION_CONFIG = {
  hyderabad: {
    name: 'Hyderabad (City)',
    url: 'https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Hyderabad/ghmc-wards.geojson',
    center: [17.3850, 78.4867] as [number, number],
    zoom: 11
  },
  telangana: {
    name: 'Telangana (State)',
    url: 'https://raw.githubusercontent.com/gpavanb1/Telangana-Visualisation/master/telangana.json',
    center: [18.1124, 79.0193] as [number, number],
    zoom: 7
  },
  andhra: {
    name: 'Andhra Pradesh (State)',
    url: 'https://gist.githubusercontent.com/saketkc/9037706cd0ba4de6ff216f4669894677/raw/Andhra_Pradesh.geojson',
    center: [15.9129, 79.7400] as [number, number],
    zoom: 7
  }
};

export default function AdminRoutingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [routes, setRoutes] = useState<PincodeRoute[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<keyof typeof REGION_CONFIG>('hyderabad');
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  
  // Use Refs for latest state in click handlers to avoid closure traps
  const routesRef = useRef(routes);
  const selectedEmpIdRef = useRef(selectedEmpId);
  
  useEffect(() => { routesRef.current = routes; }, [routes]);
  useEffect(() => { selectedEmpIdRef.current = selectedEmpId; }, [selectedEmpId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchGeoData();
  }, [activeRegionId]);

  async function fetchInitialData() {
    try {
      const { data: empData } = await (supabase as any)
        .from('employees')
        .select('id, name, role')
        .in('role', ['employee', 'manager'])
        .eq('is_active', true);
      const { data: routeData } = await (supabase as any).from('pincode_routes').select('*');
      
      const mappedEmps = (empData || []).map((e: any, index: number) => ({
        ...e,
        color: FRANCHISE_COLORS[index % FRANCHISE_COLORS.length]
      }));
      
      setEmployees(mappedEmps);
      setRoutes(routeData || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchGeoData() {
    setIsLoading(true);
    try {
      const config = REGION_CONFIG[activeRegionId];
      const response = await fetch(config.url);
      if (!response.ok) throw new Error("GeoJSON not available");
      const data = await response.json();
      setGeoData(data);
      
      if (mapRef.current) {
        mapRef.current.setView(config.center, config.zoom);
      }
    } catch (err) {
      console.warn("GeoJSON Error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Map Initialization
  useEffect(() => {
    if (isLoading || !geoData || mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    const config = REGION_CONFIG[activeRegionId];
    const map = L.map('franchise-map-container', { zoomControl: false }).setView(config.center, config.zoom);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    // Premium Map Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    renderLayers();
  }, [isLoading, geoData]);

  // Reactive layer updates
  useEffect(() => {
    if (mapRef.current && geoData) {
      renderLayers();
    }
  }, [routes, selectedEmpId, geoData]);

  function getLabel(props: any) {
    return props.name || props.dist_name || props.district || props.NAME_1 || props.NAME_2 || 'Unknown';
  }

  function renderLayers() {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    if (geoLayerRef.current) {
      mapRef.current.removeLayer(geoLayerRef.current);
    }

    const geoLayer = L.geoJSON(geoData, {
      style: (feature: any) => {
        const label = getLabel(feature.properties);
        const route = routes.find(r => r.pincode === label);
        const emp = employees.find(e => e.id === route?.employee_id);
        
        return {
          fillColor: emp ? emp.color : '#e2e8f0',
          weight: emp ? 2 : 1,
          opacity: 1,
          color: emp ? '#fff' : '#cbd5e1',
          fillOpacity: emp ? 0.8 : 0.3
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const label = getLabel(feature.properties);
        
        layer.on({
          mouseover: () => {
             layer.setStyle({ fillOpacity: 0.95, weight: 3 });
             if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
             }
          },
          mouseout: () => {
             geoLayer.resetStyle(layer);
          },
          click: (e: any) => {
             L.DomEvent.stopPropagation(e);
             const currentEmpId = selectedEmpIdRef.current;
             
             if (!currentEmpId) {
               const route = routesRef.current.find(r => r.pincode === label);
               const emp = employees.find(ev => ev.id === route?.employee_id);
               L.popup({ className: 'custom-popup' })
                .setLatLng(e.latlng)
                .setContent(`
                  <div style="padding: 6px; font-family: 'Inter', sans-serif;">
                    <b style="font-size: 15px; color: #0f172a; text-transform: uppercase;">${label}</b><br/>
                    <div style="margin-top: 8px; font-size: 13px; color: #475569; display: flex; align-items: center; gap: 6px;">
                      ${emp ? 
                        `<div style="width:10px; height:10px; border-radius:50%; background:${emp.color}"></div> <strong style="color:#0f172a;">${emp.name}</strong>` : 
                        "<span>Not Assigned</span>"}
                    </div>
                  </div>
                `)
                .openOn(mapRef.current);
               return;
             }
             
             // Toggle Assignment
             handleToggle(label, currentEmpId);
          }
        });
      }
    }).addTo(mapRef.current);

    geoLayerRef.current = geoLayer;
  }

  function handleToggle(label: string, empId: string) {
    setRoutes(prev => {
      const existing = prev.find(r => r.pincode === label);
      if (existing) {
        if (existing.employee_id === empId) {
          return prev.filter(r => r.pincode !== label);
        } else {
          return prev.map(r => r.pincode === label ? { ...r, employee_id: empId } : r);
        }
      }
      return [...prev, { id: Math.random().toString(), pincode: label, employee_id: empId }];
    });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await (supabase as any).from('pincode_routes').delete().not('id', 'is', null);
      
      const inserts = routes.map(r => ({
        pincode: r.pincode,
        employee_id: r.employee_id
      }));

      if (inserts.length > 0) {
        const { error } = await (supabase as any).from('pincode_routes').insert(inserts);
        if (error) throw error;
      }
      
      alert("Territories saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Save failed. Check console.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppLayout title="Franchise Territories">
      <div className="routing-view-container">
        
        {/* Modern Header Toolbar */}
        <div className="routing-header-card">
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '12px' }}>
              <Navigation size={28} style={{ color: '#0f172a' }} />
            </div>
            <div>
              <h2 className="text-display-xs" style={{ marginBottom: '4px' }}>Territory Management</h2>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>Assign service areas dynamically to your technicians.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <select 
              className="select" 
              style={{ minWidth: '200px', height: '44px', fontWeight: 700, background: '#f8fafc', border: '1px solid #e2e8f0' }} 
              value={activeRegionId} 
              onChange={e => setActiveRegionId(e.target.value as any)}
            >
              {Object.entries(REGION_CONFIG).map(([id, cfg]) => (
                <option key={id} value={id}>{cfg.name}</option>
              ))}
            </select>
            
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || isLoading} style={{ height: '44px', padding: '0 2rem', fontSize: '0.95rem', boxShadow: '0 4px 14px rgba(15,23,42,0.15)' }}>
              {isSaving ? 'Synchronizing...' : 'Save Territories'}
            </button>
          </div>
        </div>

        <div className="routing-grid">
          
          <div className="franchise-sidebar">
            <div className="glass-card franchise-list-card">
               <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   <Users size={18} /> Available Technicians
                 </h3>
                 <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>{employees.length} Active</span>
               </div>
               
               <div className="franchise-scroller">
                  {employees.map(emp => {
                    const count = routes.filter(r => r.employee_id === emp.id).length;
                    const isSelected = selectedEmpId === emp.id;
                    return (
                      <button 
                        key={emp.id}
                        onClick={() => setSelectedEmpId(isSelected ? null : emp.id)}
                        className={`franchise-btn ${isSelected ? 'selected' : ''}`}
                        style={{ borderLeft: `6px solid ${emp.color}`, borderColor: isSelected ? emp.color : '#e2e8f0' }}
                      >
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1 }}>
                           <span className="emp-name" style={{ color: '#0f172a', fontSize: '0.95rem' }}>{emp.name}</span>
                           <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{emp.role}</span>
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                           <span className="zone-count-pill" style={{ background: isSelected ? emp.color : '#f1f5f9', color: isSelected ? 'white' : '#475569' }}>
                             {count} {count === 1 ? 'Zone' : 'Zones'}
                           </span>
                           {isSelected && <CheckCircle2 size={18} style={{ color: emp.color }} />}
                         </div>
                      </button>
                    );
                  })}
               </div>
            </div>

            <div className="glass-card assigned-zones-card desktop-only">
               <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Layers size={16} /> Data Export
               </h3>
               <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1rem' }}>You have <strong>{routes.length}</strong> active mapped zones.</p>
                  <button className="btn btn-secondary" style={{ width: '100%' }}>Export CSV Report</button>
               </div>
            </div>
          </div>

          <div className="glass-card map-view-card">
             <div id="franchise-map-container" style={{ width: '100%', height: '100%', zIndex: 1 }}></div>
             
             <div className="map-overlay-hint">
                {selectedEmpId ? (
                  <>
                    <MapIcon size={16} style={{ color: employees.find(e => e.id === selectedEmpId)?.color }} />
                    <span style={{ fontWeight: 500 }}>Currently Assigning:</span> <b style={{ fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{employees.find(e => e.id === selectedEmpId)?.name}</b> — Tap any map zone to toggle.
                  </>
                ) : (
                  <>
                    <Info size={16} /> <b>How to start:</b> Select a technician from the left menu, then tap zones on the map.
                  </>
                )}
             </div>

             {isLoading && (
               <div className="map-loading-overlay">
                  <RefreshCw size={32} className="animate-spin" style={{ color: '#0f172a' }} />
                  <p style={{ fontWeight: 800, letterSpacing: '0.05em' }}>RENDERING MAP...</p>
               </div>
             )}
          </div>

        </div>
      </div>

      <style>{`
        .routing-view-container { display: flex; flex-direction: column; height: calc(100vh - var(--header-height) - 1.5rem); gap: 1.5rem; }
        
        .routing-header-card { 
          display: flex; justify-content: space-between; align-items: center; 
          background: white; padding: 1.25rem 2rem; border-radius: 16px; 
          border: 1px solid var(--outline); box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          flex-shrink: 0; 
        }

        .routing-grid { flex: 1; display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; min-height: 0; }
        .franchise-sidebar { display: flex; flex-direction: column; gap: 1.5rem; min-height: 0; }
        
        .franchise-list-card { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .franchise-scroller { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-right: 6px; }
        .assigned-zones-card { padding: 1.5rem; display: flex; flex-direction: column; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        
        .franchise-btn {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--outline);
          background: white; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; text-align: left;
        }
        .franchise-btn:hover { border-color: #cbd5e1; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .franchise-btn.selected { 
          border-width: 1px; background: #fff!important; 
          box-shadow: 0 8px 24px rgba(0,0,0,0.06); transform: scale(1.02); z-index: 10;
        }
        .emp-name { font-weight: 800; font-size: 0.9rem; }
        .zone-count-pill { font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 12px; letter-spacing: 0.05em; }
        
        .map-view-card { 
          flex: 1; position: relative; overflow: hidden; height: 100%; 
          border: 1px solid var(--outline); border-radius: 20px; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }

        /* Leaflet Overrides */
        .leaflet-container { background: #f8fafc !important; font-family: 'Inter', sans-serif; }
        .custom-popup .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); border: 1px solid var(--outline); }
        .custom-popup .leaflet-popup-tip { box-shadow: 0 10px 30px rgba(0,0,0,0.15); }

        .map-overlay-hint {
          position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
          z-index: 1000; background: rgba(15, 23, 42, 0.9); color: white;
          padding: 12px 24px; border-radius: 99px; font-size: 0.85rem;
          display: flex; align-items: center; gap: 0.75rem; backdrop-filter: blur(12px);
          white-space: nowrap; pointer-events: none; box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .map-loading-overlay { 
          position: absolute; inset: 0; background: rgba(255,255,255,0.85); 
          z-index: 2000; display: flex; flex-direction: column; align-items: center; 
          justify-content: center; gap: 1rem; backdrop-filter: blur(8px);
        }
        
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .routing-view-container { height: auto; min-height: 100vh; padding-bottom: 2rem; gap: 1rem; }
          .routing-grid { grid-template-columns: 1fr; display: flex; flex-direction: column; }
          .franchise-sidebar { order: 2; padding: 0 1rem; }
          .franchise-scroller { flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 0.5rem 0; gap: 1rem; }
          .franchise-btn { flex: 0 0 auto; min-width: 220px; }
          .map-view-card { order: 1; height: 500px; border-radius: 0; border-left: none; border-right: none; width: 100%; border-radius: 20px; }
          .routing-header-card { margin: 0 1rem; flex-direction: column; align-items: flex-start; gap: 1rem; }
        }
      `}</style>
    </AppLayout>
  );
}
