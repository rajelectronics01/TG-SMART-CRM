import { useState, useEffect, useRef } from 'react';
import AppLayout from '../components/AppLayout';
import { supabase } from '../core/supabase/client';
import { Trash2, RefreshCw, Layers, Map as MapIcon, Info, Users } from 'lucide-react';

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
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', 
  '#0891b2', '#be185d', '#475569', '#ca8a04', '#15803d'
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
    const map = L.map('franchise-map-container').setView(config.center, config.zoom);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OSM'
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
          fillColor: emp ? emp.color : '#cbd5e1',
          weight: 1,
          opacity: 1,
          color: 'white',
          fillOpacity: emp ? 0.7 : 0.2
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const label = getLabel(feature.properties);
        
        layer.on({
          mouseover: () => {
             layer.setStyle({ fillOpacity: 0.9, weight: 2 });
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
               // Show current assignment info
               const route = routesRef.current.find(r => r.pincode === label);
               const emp = employees.find(ev => ev.id === route?.employee_id);
               L.popup()
                .setLatLng(e.latlng)
                .setContent(`
                  <div style="padding: 10px; font-family: sans-serif;">
                    <b style="font-size: 14px;">${label}</b><br/>
                    <p style="margin: 5px 0 0; font-size: 12px; color: #444;">
                      ${emp ? `Assigned: <span style="font-weight:bold; color:${emp.color}">${emp.name}</span>` : "Unassigned"}
                    </p>
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
      // Clear and Re-insert
      await (supabase as any).from('pincode_routes').delete().not('id', 'is', null);
      
      const inserts = routes.map(r => ({
        pincode: r.pincode,
        employee_id: r.employee_id
      }));

      if (inserts.length > 0) {
        const { error } = await (supabase as any).from('pincode_routes').insert(inserts);
        if (error) throw error;
      }
      
      alert("Changes saved to database!");
    } catch (err) {
      console.error(err);
      alert("Save failed. Check console.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppLayout title="Franchise Routing Map">
      <div className="routing-view-container">
        
        <div className="routing-toolbar">
           <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
             <select 
               className="select" 
               style={{ minWidth: '180px', height: '40px' }} 
               value={activeRegionId} 
               onChange={e => setActiveRegionId(e.target.value as any)}
             >
               {Object.entries(REGION_CONFIG).map(([id, cfg]) => (
                 <option key={id} value={id}>{cfg.name}</option>
               ))}
             </select>
             <div className="zone-counter">
               {routes.length} Locations Managed
             </div>
           </div>

           <button className="btn btn-primary" onClick={handleSave} disabled={isSaving || isLoading} style={{ height: '40px', padding: '0 1.5rem' }}>
             {isSaving ? 'Saving...' : 'Save Changes'}
           </button>
        </div>

        <div className="routing-grid">
          
          <div className="franchise-sidebar">
            <div className="glass-card franchise-list-card">
               <h3 className="text-title-sm" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Users size={16} /> Select Technician
               </h3>
               <div className="franchise-scroller">
                  {employees.map(emp => {
                    const count = routes.filter(r => r.employee_id === emp.id).length;
                    const isSelected = selectedEmpId === emp.id;
                    return (
                      <button 
                        key={emp.id}
                        onClick={() => setSelectedEmpId(isSelected ? null : emp.id)}
                        className={`franchise-btn ${isSelected ? 'selected' : ''}`}
                        style={{ borderLeft: `4px solid ${emp.color}` }}
                      >
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1 }}>
                           <span className="emp-name" style={{ color: isSelected ? emp.color : 'inherit' }}>{emp.name}</span>
                           <span style={{ fontSize: '0.6rem', color: 'var(--outline)', fontWeight: 800, textTransform: 'uppercase' }}>{emp.role}</span>
                         </div>
                         <span className="zone-count-pill" style={{ background: isSelected ? emp.color : 'var(--surface-highest)', color: isSelected ? 'white' : 'inherit' }}>{count}</span>
                      </button>
                    );
                  })}
               </div>
            </div>

            <div className="glass-card assigned-zones-card desktop-only">
               <h3 className="text-title-sm" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Layers size={16} /> Current Assignments
               </h3>
               <div className="zones-list">
                 {routes.length === 0 ? (
                   <p style={{ opacity: 0.5, fontSize: '0.75rem', textAlign: 'center', padding: '1rem' }}>No assignments yet.</p>
                 ) : routes.map(route => {
                   const emp = employees.find(e => e.id === route.employee_id);
                   return (
                     <div key={route.id} className="zone-item" style={{ borderLeft: `3px solid ${emp?.color}` }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 800, fontSize: '0.75rem', margin: 0 }}>{route.pincode}</p>
                          <p style={{ fontSize: '0.6rem', color: emp?.color, margin: 0 }}>{emp?.name}</p>
                        </div>
                        <button onClick={() => handleToggle(route.pincode, route.employee_id)} className="delete-zone-btn">
                          <Trash2 size={12} />
                        </button>
                     </div>
                   );
                 })}
               </div>
            </div>
          </div>

          <div className="glass-card map-view-card">
             <div id="franchise-map-container" style={{ width: '100%', height: '100%', zIndex: 1 }}></div>
             
             <div className="map-overlay-hint">
                {selectedEmpId ? (
                  <>
                    <MapIcon size={14} style={{ color: employees.find(e => e.id === selectedEmpId)?.color }} />
                    Active: <b>{employees.find(e => e.id === selectedEmpId)?.name}</b> — Tap any zone to assign
                  </>
                ) : (
                  <>
                    <Info size={14} /> 1. Select Technician → 2. Tap Map
                  </>
                )}
             </div>

             {isLoading && (
               <div className="map-loading-overlay">
                  <RefreshCw size={24} className="animate-spin" />
                  <p style={{ fontWeight: 600 }}>Loading Regions...</p>
               </div>
             )}
          </div>

        </div>
      </div>

      <style>{`
        .routing-view-container { display: flex; flex-direction: column; height: calc(100vh - var(--header-height) - 1.5rem); gap: 1rem; }
        .routing-toolbar { display: flex; justify-content: space-between; align-items: center; background: white; padding: 0.75rem 1rem; border-radius: 12px; border: 1px solid var(--outline); flex-shrink: 0; }
        .zone-counter { color: var(--primary); background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 99px; font-size: 0.75rem; font-weight: 800; }
        .routing-grid { flex: 1; display: grid; grid-template-columns: 280px 1fr; gap: 1rem; min-height: 0; }
        .franchise-sidebar { display: flex; flex-direction: column; gap: 1rem; min-height: 0; }
        .franchise-list-card { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 1.25rem; }
        .franchise-scroller { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 4px; }
        .assigned-zones-card { height: 220px; padding: 1.25rem; display: flex; flex-direction: column; }
        .zones-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.4rem; }
        
        .franchise-btn {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid var(--outline);
          background: white; transition: all 0.2s; cursor: pointer; text-align: left;
        }
        .franchise-btn.selected { border-width: 1px; background: rgba(0,0,0,0.02); box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05); }
        .emp-name { font-weight: 700; font-size: 0.85rem; }
        .zone-count-pill { font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 10px; }
        
        .zone-item { display: flex; justify-content: space-between; align-items: center; padding: 0.65rem; background: var(--surface-low); border-radius: 8px; }
        .delete-zone-btn { background: none; border: none; color: var(--error); cursor: pointer; opacity: 0.4; }
        
        .map-view-card { flex: 1; position: relative; overflow: hidden; height: 100%; border: 1px solid var(--outline); border-radius: 16px; }
        .map-overlay-hint {
          position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
          z-index: 1000; background: #1e293b; color: white;
          padding: 8px 20px; border-radius: 99px; font-size: 0.75rem;
          display: flex; align-items: center; gap: 0.6rem; backdrop-filter: blur(8px);
          white-space: nowrap; pointer-events: none; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .map-loading-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.9); z-index: 2000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .routing-view-container { height: auto; min-height: 100vh; padding-bottom: 2rem; }
          .routing-grid { grid-template-columns: 1fr; display: flex; flex-direction: column; }
          .franchise-sidebar { order: 2; padding: 0 1rem; }
          .franchise-scroller { flex-direction: row; overflow-x: auto; overflow-y: hidden; padding: 0.5rem 0; gap: 0.75rem; }
          .franchise-btn { flex: 0 0 auto; min-width: 160px; }
          .map-view-card { order: 1; height: 480px; border-radius: 0; border: none; width: 100%; }
          .routing-toolbar { margin: 0 1rem; }
        }
      `}</style>
    </AppLayout>
  );
}
