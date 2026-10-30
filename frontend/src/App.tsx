import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000/api/safety";
const NCRB_DATASET_URL =
  "https://www.arcgis.com/home/item.html?id=15807229ed3342939bfabd8c9606f25e";
const CITY_CRIME_URL = "https://data.opencity.in/dataset/crime-in-india-2023";
const OFFICIAL_CRIME_URL = "https://www.data.gov.in/catalog/crime-india-2023";

type Contact = {
  id: number;
  name: string;
  phone: string;
};

type Report = {
  id: number;
  category: string;
  description: string;
  created_at: string;
  status: string;
};

type Place = {
  id: string | number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  address?: string;
};

type CrimeData = {
  available?: boolean;
  district?: string;
  state?: string;
  year?: number;
  geography?: string;
  values?: Record<string, number | string | null>;
  source?: string;
  message?: string;
};

type AllCrimeData = {
  categories?: string[];
  source?: string;
  official_source?: string;
};

type ApiError = { detail?: string; message?: string };

const crimeLabels: Record<string, string> = {
  total_crimes_against_women: "Total crimes against women",
  ipc_bns_crimes_against_women: "IPC / BNS crimes against women",
  special_local_law_crimes: "Special and Local Laws",
  assault_on_women: "Assault on women",
  sexual_harassment: "Sexual harassment",
  stalking: "Stalking",
  kidnapping_abduction: "Kidnapping and abduction",
  dowry_prohibition_cases: "Dowry Prohibition Act",
  domestic_violence_act_cases: "Domestic Violence Act",
  women_centric_cyber_crimes: "Women-centric cybercrime",
  pocso_girl_child_cases: "POCSO girl-child cases",
};



// News-seeded incidents. Coordinates are approximate locality pins, NOT exact crime scenes.
// Reports describe alleged incidents; arrests or investigations are included where reported.
const NEWS_INCIDENTS = [
  { id: "n1", title: "Petrol-pump firing and armed robbery", area: "Loharka Road", date: "22 May 2026", type: "Firing / robbery", status: "Police reported arrests in June 2026", lat: 31.6068, lng: 74.8755, source: "https://www.tribuneindia.com/news/amritsar/foreign-linked-extortion-gang-busted-in-amritsar-3-nabbed/" },
  { id: "n2", title: "Jewellery-shop firing / attempted robbery", area: "Batala Road · Khooh Kundian", date: "29 Dec 2025", type: "Firing / attempted robbery", status: "Second accused arrest reported Jan 2026", lat: 31.6515, lng: 74.8840, source: "https://www.tribuneindia.com/news/amritsar/jewellery-shop-firing-case-second-accused-arrested/" },
  { id: "n3", title: "Snatching gang arrests reported", area: "Chheharta · near Max City", date: "May 2026", type: "Snatching / robbery", status: "Four arrests reported", lat: 31.6410, lng: 74.7990, source: "https://newswav.com/article/snatching-gang-busted-4-held-in-amritsar-A2605_7SS5Uh" },
  { id: "n4", title: "Jeweller assaulted and robbed", area: "Near New Flower School · Sultanwind Road", date: "9 Jan 2026", type: "Robbery / assault", status: "Investigation reported", lat: 31.6150, lng: 74.9005, source: "https://www.ptcnews.tv/punjab-2/amritsar-jeweller-attacked-gold-looted-daylight-robbery-punjab-crime-4419772" },
  { id: "n5", title: "Extortion-linked firing reported", area: "Bhaini Gillan · Amritsar district", date: "May 2026", type: "Firing / alleged extortion", status: "Police investigation reported; outside central city", lat: 31.7550, lng: 74.9650, source: "https://www.tribuneindia.com/news/amritsar/extortion-linked-firing-incidents-spark-fear-across-amritsar-villages/" },
];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function GoogleSafetyMap({ places, filter }: { places: Place[]; filter: string }) {
  const mapElement = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any>(null);
  const markersRef = React.useRef<any[]>([]);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapError("Google Maps API key missing. Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env.local and restart Vite.");
      return;
    }
    const w = window as any;
    const initialize = () => {
      if (!mapElement.current || !w.google?.maps) return;
      if (!mapRef.current) {
        mapRef.current = new w.google.maps.Map(mapElement.current, {
          center: { lat: 31.634, lng: 74.8723 },
          zoom: 12,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeId: "roadmap",
        });
      }
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      const info = new w.google.maps.InfoWindow();
      const addMarker = (position: { lat: number; lng: number }, title: string, color: string, detail: string) => {
        const marker = new w.google.maps.Marker({
          map: mapRef.current,
          position,
          title,
          icon: { path: w.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
        });
        marker.addListener("click", () => { info.setContent(`<div style="max-width:240px"><strong>${title}</strong><p style="margin:6px 0">${detail}</p></div>`); info.open({ map: mapRef.current, anchor: marker }); });
        markersRef.current.push(marker);
      };
      NEWS_INCIDENTS.forEach((incident) => {
        const color = incident.type.toLowerCase().includes("firing") ? "#dc2626" : "#f59e0b";
        const circle = new w.google.maps.Circle({ map: mapRef.current, center: { lat: incident.lat, lng: incident.lng }, radius: 450, strokeColor: color, strokeOpacity: .8, strokeWeight: 1, fillColor: color, fillOpacity: .13, clickable: false });
        markersRef.current.push(circle);
        addMarker({ lat: incident.lat, lng: incident.lng }, incident.title, color, `${incident.area} · ${incident.date}<br>${incident.type}<br>${incident.status}<br><a href="${incident.source}" target="_blank" rel="noopener">Read news report</a>`);
      });
      places.forEach((place) => {
        const type = String(place.type || "").toLowerCase();
        const isPolice = type.includes("police");
        const isMedical = type.includes("hospital") || type.includes("clinic");
        if (filter === "police" && !isPolice) return;
        if (filter === "medical" && !isMedical) return;
        addMarker({ lat: place.lat, lng: place.lng }, place.name, isPolice ? "#2563eb" : "#059669", `${place.type}${place.address ? ` · ${place.address}` : ""}`);
      });
    };
    if (w.google?.maps) { initialize(); return; }
    const existing = document.querySelector('script[data-sheild-google-maps="true"]') as HTMLScriptElement | null;
    if (existing) { existing.addEventListener("load", initialize, { once: true }); return; }
    const script = document.createElement("script");
    script.dataset.sheildGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    script.onerror = () => setMapError("Google Maps could not load. Check the demo key and Maps JavaScript API access.");
    document.head.appendChild(script);
  }, [places, filter]);

  return <div style={{ width: "100%", height: 430, position: "relative" }}>
    <div ref={mapElement} style={{ width: "100%", height: "100%" }} />
    {mapError && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, background: "#f1f5f9", color: "#334155", textAlign: "center" }}>{mapError}</div>}
  </div>;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The backend returned an invalid response. Check the FastAPI terminal.");
    }
  }
  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.detail || error.message || `Request failed (${response.status}).`);
  }
  return data as T;
}

function formatDate(value: string): string {
  if (!value) return "Date unavailable";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [crimeData, setCrimeData] = useState<CrimeData | null>(null);
  const [allCrime, setAllCrime] = useState<AllCrimeData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("Harassment");
  const [description, setDescription] = useState("");
  const [mapFilter, setMapFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const [contactResponse, reportResponse] = await Promise.all([
        fetch(`${API_BASE}/contacts`),
        fetch(`${API_BASE}/reports`),
      ]);
      const [contactData, reportData] = await Promise.all([
        readJson<Contact[]>(contactResponse),
        readJson<Report[]>(reportResponse),
      ]);
      setContacts(Array.isArray(contactData) ? contactData : []);
      setReports(Array.isArray(reportData) ? reportData : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load dashboard data.");
    }
  }, []);

  const loadAmritsarData = useCallback(async () => {
    setMapLoading(true);
    try {
      const [mapResponse, crimeResponse] = await Promise.all([
        fetch(`${API_BASE}/amritsar/map`),
        fetch(`${API_BASE}/amritsar/crime-data`),
      ]);
      const [mapData, crime] = await Promise.all([
        readJson<{ places?: Place[] }>(mapResponse),
        readJson<{ women_crime_data?: CrimeData; all_crime_data?: AllCrimeData }>(crimeResponse),
      ]);
      setPlaces(Array.isArray(mapData.places) ? mapData.places : []);
      setCrimeData(crime.women_crime_data || null);
      setAllCrime(crime.all_crime_data || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Amritsar data could not be loaded.");
    } finally {
      setMapLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    void loadDashboard();
    void loadAmritsarData();
  }, [loadDashboard, loadAmritsarData]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const visiblePlaces = useMemo(() => {
    return places.filter((place) => {
      const type = String(place.type || "").toLowerCase();
      if (mapFilter === "police") return type.includes("police");
      if (mapFilter === "medical") return type.includes("hospital") || type.includes("clinic");
      return true;
    });
  }, [places, mapFilter]);

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      await readJson<unknown>(response);
      setName("");
      setPhone("");
      setMessage("Trusted contact saved.");
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save contact.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(id: number) {
    if (!window.confirm("Remove this trusted contact?")) return;
    try {
      const response = await fetch(`${API_BASE}/contacts/${id}`, { method: "DELETE" });
      await readJson<unknown>(response);
      setMessage("Contact removed.");
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove contact.");
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, description: description.trim() }),
      });
      const result = await readJson<{ id?: number }>(response);
      setDescription("");
      setMessage(result.id ? `Incident report #${result.id} saved.` : "Incident report saved.");
      await loadDashboard();
      setActiveTab("reports");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report submission failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app">
      <nav className="navbar">
        <div className="brand"><span>✦</span> SHEild</div>
        <div className="system-status">● AMRITSAR SAFETY INTELLIGENCE</div>
      </nav>

      <section className="hero">
        <p className="eyebrow">WOMEN'S SAFETY • PUBLIC SAFETY • DATA INTELLIGENCE</p>
        <h1>Know your city.<br /><span>Navigate with awareness.</span></h1>
        <p className="subtitle">Amritsar's public safety infrastructure, historical crime statistics, emergency resources and incident documentation.</p>
        <div className="hero-tag">AMRITSAR, PUNJAB, INDIA</div>
      </section>

      <section className="emergency-section">
        <div className="emergency-card">
          <div className="sos-icon">!</div>
          <p className="emergency-label">EMERGENCY ASSISTANCE</p>
          <h2>Need immediate help?</h2>
          <p>Contact India's emergency response service.</p>
          <a className="sos-button" href="tel:112">☎ CALL EMERGENCY 112</a>
          <small>Opens your phone dialer. You must initiate the call.</small>
        </div>
      </section>

      <section className="dashboard">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AMRITSAR CONTROL CENTER</p>
            <h2>City Safety Dashboard</h2>
            <p className="section-description">Publicly available data and mapped emergency infrastructure.</p>
          </div>
          <button className="refresh-button" type="button" onClick={refreshAll}>↻ Refresh data</button>
        </div>

        <div className="stats-grid">
          <div className="stat-card"><span>TRUSTED CONTACTS</span><strong>{contacts.length}</strong></div>
          <div className="stat-card"><span>INCIDENT REPORTS</span><strong>{reports.length}</strong></div>
          <div className="stat-card"><span>MAP FACILITIES</span><strong>{places.length}</strong></div>
        </div>

        <div className="tabs">
          <button type="button" className={activeTab === "overview" ? "tab active" : "tab"} onClick={() => setActiveTab("overview")}>City Map &amp; Data</button>
          <button type="button" className={activeTab === "contacts" ? "tab active" : "tab"} onClick={() => setActiveTab("contacts")}>Trusted Circle</button>
          <button type="button" className={activeTab === "reports" ? "tab active" : "tab"} onClick={() => setActiveTab("reports")}>Incident Reports</button>
        </div>

        {activeTab === "overview" && (
          <>
            <section className="map-section">
              <div className="section-heading">
                <div><p className="eyebrow">PUBLIC INFRASTRUCTURE</p><h2>Amritsar Safety Map</h2></div>
                <span className="map-count">{visiblePlaces.length} locations</span>
              </div>
              <div className="map-filters">
                <button type="button" className={mapFilter === "all" ? "filter active" : "filter"} onClick={() => setMapFilter("all")}>All facilities</button>
                <button type="button" className={mapFilter === "police" ? "filter active" : "filter"} onClick={() => setMapFilter("police")}>Police stations</button>
                <button type="button" className={mapFilter === "medical" ? "filter active" : "filter"} onClick={() => setMapFilter("medical")}>Hospitals &amp; clinics</button>
              </div>
              <div className="map-legend">
                <span><i className="legend-dot police-dot" /> Police</span>
                <span><i className="legend-dot medical-dot" /> Medical</span>
              </div>
              <div style={{ position: "relative", width: "100%", minHeight: 430, borderRadius: 16, overflow: "hidden", background: "#e8edf2" }}>
                {mapLoading ? (
                  <div className="map-loading">Loading Amritsar map data...</div>
                ) : (
                  <GoogleSafetyMap places={places} filter={mapFilter} />
                )}
                <aside style={{ position: "absolute", zIndex: 500, top: 12, right: 12, width: "min(290px, calc(100% - 24px))", maxHeight: 390, overflowY: "auto", background: "rgba(255,255,255,0.97)", color: "#172033", padding: 16, borderRadius: 14, boxShadow: "0 5px 24px rgba(0,0,0,.22)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>📊 Amritsar crime snapshot</strong>
                    <span style={{ fontSize: 11, color: "#64748b" }}>NCRB {crimeData?.year || 2024}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#64748b", margin: "6px 0 10px" }}>District-level reported figures · not live street-level data</p>
                  {crimeData?.available && crimeData.values ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {Object.entries(crimeLabels).map(([key, label]) => (
                        <div key={key} style={{ background: "#f1f5f9", borderRadius: 9, padding: 9 }}>
                          <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.3 }}>{label}</div>
                          <strong style={{ display: "block", fontSize: 19, marginTop: 4 }}>{crimeData.values?.[key] ?? "—"}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: "#475569" }}>{crimeData?.message || "Crime statistics are currently unavailable. Use the NCRB source link below to verify published figures."}</div>
                  )}
                  <a href={crimeData?.source || NCRB_DATASET_URL} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "#1d4ed8" }}>Open NCRB source ↗</a>
                </aside>
                <div style={{ position: "absolute", zIndex: 400, left: 12, bottom: 12, background: "rgba(255,255,255,.96)", color: "#172033", padding: "8px 11px", borderRadius: 9, fontSize: 11, boxShadow: "0 2px 10px rgba(0,0,0,.15)" }}>
                  🔴 Red: reported firing · 🟠 Amber: robbery / snatching · 🔵 Police · 🟢 Medical
                </div>
              </div>
              <p className="map-disclaimer">News pins are approximate locality markers based on published reports, not exact incident coordinates or a prediction of danger. A cluster radius is illustrative only. News coverage is incomplete and does not establish that an area is unsafe. NCRB figures remain district-level. Facility records below come from OpenStreetMap and may be incomplete or outdated.</p>
              <div className="facility-list">
                {visiblePlaces.map((place) => (
                  <article className="contact-item" key={`${place.type}-${place.id}`}>
                    <div><strong>{place.name}</strong><span>{place.type}{place.address ? ` · ${place.address}` : ""}</span></div>
                    <a href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`} target="_blank" rel="noreferrer">View map ↗</a>
                  </article>
                ))}
                {!mapLoading && visiblePlaces.length === 0 && <p>No facilities returned. Check the backend's map endpoint.</p>}
              </div>
            </section>

            <section className="crime-section">
              <p className="eyebrow">NCRB PUBLIC DATA</p>
              <h2>Crime Statistics — Amritsar</h2>
              <p className="section-description">Historical reported crime data. These are not live police records.</p>

              <div className="crime-panel">
                <div className="crime-panel-heading"><h3>Crimes against women</h3><span className="data-year">NCRB • {crimeData?.year || 2024}</span></div>
                {crimeData?.available && crimeData.values ? (
                  <>
                    <div className="data-geography">{crimeData.district || "Amritsar"}, {crimeData.state || "Punjab"}{crimeData.geography ? ` · ${crimeData.geography}` : ""}</div>
                    <div className="crime-grid">
                      {Object.entries(crimeLabels).map(([key, label]) => (
                        <div className="crime-stat" key={key}><span>{label}</span><strong>{crimeData.values?.[key] ?? "Not available"}</strong></div>
                      ))}
                    </div>
                    <a className="source-link" href={crimeData.source || NCRB_DATASET_URL} target="_blank" rel="noreferrer">View NCRB data source ↗</a>
                  </>
                ) : (
                  <div className="data-unavailable">
                    <p>{crimeData?.message || "The NCRB data service did not return a record. The dataset link is provided for verification."}</p>
                    <a className="source-link" href={NCRB_DATASET_URL} target="_blank" rel="noreferrer">Open NCRB district dataset ↗</a>
                  </div>
                )}
                <p className="data-warning">District-level figures cover the district, not only Amritsar city. They must not be interpreted as street-level risk scores.</p>
              </div>

              <div className="crime-panel">
                <div className="crime-panel-heading"><h3>All crime categories</h3><span className="data-year">NCRB • 2023</span></div>
                <p>The NCRB 2023 publication includes city-wise IPC and SLL statistics, violent crimes, murder, theft, robbery, kidnapping, cybercrime and other categories.</p>
                <div className="category-chips">
                  {(allCrime?.categories || ["Murder", "Attempt to murder", "Rape", "Kidnapping", "Robbery", "Theft", "Burglary", "Riots", "Cybercrime", "Crimes against women", "Crimes against children"]).map((item) => <span key={item}>{item}</span>)}
                </div>
                <p className="data-warning">This dashboard links to published city-wise records rather than inventing Amritsar crime counts. Confirm the Amritsar row and reporting unit in the source before quoting figures.</p>
                <a className="source-link" href={allCrime?.source || CITY_CRIME_URL} target="_blank" rel="noreferrer">Explore NCRB city-wise crime records ↗</a>
                <a className="source-link" href={allCrime?.official_source || OFFICIAL_CRIME_URL} target="_blank" rel="noreferrer">Official Government data catalogue ↗</a>
              </div>
            </section>

            <section className="resources-section">
              <p className="eyebrow">EMERGENCY DIRECTORY</p>
              <h2>Important Helplines</h2>
              <div className="helpline-grid">
                <a href="tel:112"><span>Emergency response</span><strong>112</strong></a>
                <a href="tel:1091"><span>Women helpline</span><strong>1091</strong></a>
                <a href="tel:1098"><span>Child helpline</span><strong>1098</strong></a>
                <a href="tel:108"><span>Ambulance</span><strong>108</strong></a>
              </div>
              <a className="source-link" href="https://amritsar.nic.in/helpline/" target="_blank" rel="noreferrer">Verify Amritsar district helplines ↗</a>
            </section>
          </>
        )}

        {activeTab === "contacts" && (
          <section className="tool-card">
            <p className="eyebrow">YOUR SUPPORT NETWORK</p>
            <h2>Trusted Circle</h2>
            <p>Add trusted people for your own emergency contact reference.</p>
            <form onSubmit={addContact} className="contact-form">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contact name" maxLength={80} required />
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" inputMode="tel" maxLength={16} required />
              <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Contact"}</button>
            </form>
            {contacts.map((contact) => (
              <div className="contact-item" key={contact.id}>
                <div><strong>{contact.name}</strong><span>{contact.phone}</span></div>
                <button type="button" className="remove-button" onClick={() => void deleteContact(contact.id)}>Remove</button>
              </div>
            ))}
            {contacts.length === 0 && <p>No contacts saved yet.</p>}
          </section>
        )}

        {activeTab === "reports" && (
          <section className="report-area">
            <div className="tool-card">
              <p className="eyebrow">PRIVATE PROTOTYPE LOG</p>
              <h2>Document an Incident</h2>
              <p>Store a description for your own reference. This does not file a police complaint.</p>
              <form onSubmit={submitReport} className="incident-form">
                <label htmlFor="incident-category">Incident category</label>
                <select id="incident-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option>Harassment</option><option>Stalking</option><option>Unsafe public space</option><option>Online abuse</option><option>Theft</option><option>Robbery</option><option>Threat or intimidation</option><option>Other</option>
                </select>
                <label htmlFor="incident-description">Description</label>
                <textarea id="incident-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} placeholder="Describe the incident..." required />
                <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Incident Report"}</button>
              </form>
            </div>
            <h2>Report History</h2>
            {reports.map((report) => (
              <article className="report-card" key={report.id}>
                <div className="report-header"><span>REPORT #{report.id}</span><span>{report.status || "Saved"}</span></div>
                <h3>{report.category}</h3>
                <p>{report.description}</p>
                <small>{formatDate(report.created_at)}</small>
              </article>
            ))}
            {reports.length === 0 && <p>No incident reports have been saved.</p>}
          </section>
        )}

        {message && <div className="message" role="status">{message}<button type="button" onClick={() => setMessage("")}>×</button></div>}
      </section>

      <section className="safety-note">
        <h3>Data, privacy and safety limitations</h3>
        <p>SHEild is a hackathon prototype. NCRB statistics are historical reported cases; they do not establish the safety of a particular street. Map facilities come from OpenStreetMap and may be incomplete. User-submitted incident reports are stored in the prototype database and are not sent to police. Do not enter real sensitive information until authentication, authorization and encryption are implemented. In an emergency, call 112.</p>
      </section>

      <footer>
        <div className="footer-brand">SHEild ✦</div>
        <p>AMRITSAR PUBLIC SAFETY INTELLIGENCE</p>
        <span>YOUR SAFETY. YOUR POWER. YOUR PROTECTION.</span>
      </footer>
    </main>
  );
}

export default App;
