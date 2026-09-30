// UB Sports Map & Timetable (DEFS 2026-2027)
// Application Logic

(function() {
  'use strict';

  // Load data from global TIMETABLE_DATA (from data.js)
  const data = window.TIMETABLE_DATA;
  if (!data) {
    console.error("TIMETABLE_DATA not loaded!");
    return;
  }

  const { reference_points, locations, all_sports, days } = data;
  const refGroz = reference_points.grozavesti_a;
  const refPbt = reference_points.politehnica_business_tower;

  // State management
  let activeLocation = null;
  let activeDay = "all";
  let activeSport = "";
  let activeSort = "default";
  let searchQuery = "";
  let activeRouteLines = [];

  // DOM Elements
  const mapElement = document.getElementById("map");
  const searchInput = document.getElementById("search-input");
  const sortSelect = document.getElementById("sort-select");
  const dayPillsContainer = document.getElementById("day-pills-container");
  const locationsList = document.getElementById("locations-list");
  const locationsCountBadge = document.getElementById("locations-count-badge");
  const previewPanel = document.getElementById("preview-panel");
  const sidebarPanel = document.getElementById("sidebar-panel");
  const btnCloseSidebar = document.getElementById("btn-close-sidebar");
  const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
  const btnReopenSidebar = document.getElementById("btn-reopen-sidebar");
  const btnResetMap = document.getElementById("btn-reset-map");
  const btnFocusGrozavesti = document.getElementById("btn-focus-grozavesti");
  const btnFocusPbt = document.getElementById("btn-focus-pbt");
  const btnOpenTimetable = document.getElementById("btn-open-timetable");
  const btnClosePreview = document.getElementById("btn-close-preview");
  const timetableModal = document.getElementById("timetable-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const modalTbody = document.getElementById("modal-timetable-tbody");
  const previewViewTableBtn = document.getElementById("preview-view-table-btn");
  const btnResetVenueSports = document.getElementById("btn-reset-venue-sports");
  const scheduleFilterStatus = document.getElementById("preview-schedule-filter-status");

  // Venue-specific multi-select sport filter state (does NOT filter global map)
  const venueSelectedSports = new Set();
  let currentVenueId = null;
  // 1. Initialize Leaflet Map
  const map = L.map("map", {
    zoomControl: false,
    minZoom: 10,
    maxZoom: 19
  });

  // Position zoom controls in bottom right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Tile Layers (Clean, watermark-free high quality map providers)
  const tileLayers = {
    streets: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, DeLorme, NAVTEQ, TomTom, increment P Corp., USGS, METI, swisstopo, MapmyIndia',
      maxZoom: 19
    }),
    osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
      maxZoom: 19
    })
  };

  let currentTileLayer = tileLayers.streets.addTo(map);

  // Map Style Switcher (Street, OSM, Satellite)
  document.querySelectorAll(".style-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".style-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const style = btn.getAttribute("data-style");
      if (tileLayers[style]) {
        map.removeLayer(currentTileLayer);
        currentTileLayer = tileLayers[style].addTo(map);
      }
    });
  });

  // Fit bounds initially to encompass all locations & reference points
  const allCoords = [
    [refGroz.lat, refGroz.lng],
    [refPbt.lat, refPbt.lng],
    ...locations.map(loc => [loc.lat, loc.lng])
  ];
  const initialBounds = L.latLngBounds(allCoords);
  map.fitBounds(initialBounds, { padding: [100, 100] });

  // 2. Custom Icons Creation
  function createRefIcon(type, iconEmoji, labelText) {
    const isGroz = type === "grozavesti";
    const bgCol = isGroz ? "#059669" : "#4338ca";
    const borderCol = isGroz ? "#10b981" : "#6366f1";
    const badgeClass = isGroz ? "groz" : "pbt";

    return L.divIcon({
      className: "ref-pin-wrapper",
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      html: `
        <div class="ref-label-badge ${badgeClass}">${labelText}</div>
        <div style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${bgCol};
          border: 3px solid #ffffff;
          box-shadow: 0 6px 16px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          color: white;
          animation: pulse 2.5s infinite;
        ">
          ${iconEmoji}
        </div>
      `
    });
  }

  function createSportsPinIcon(location, isHovered = false, isSelected = false) {
    const isSelectedOrHovered = isHovered || isSelected;
    const pinColor = isSelected ? "#dc2626" : "#e11d48";
    const scale = isSelectedOrHovered ? 1.25 : 1.0;

    return L.divIcon({
      className: `custom-pin-wrapper ${isSelected ? 'active' : ''}`,
      iconSize: [36, 48],
      iconAnchor: [18, 48],
      popupAnchor: [0, -48],
      tooltipAnchor: [0, -48],
      html: `
        <div style="transform: scale(${scale}); transform-origin: bottom center; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          <svg class="pin-svg-sports" width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.05888 0 0 8.05888 0 18C0 31.5 18 48 18 48C18 48 36 31.5 36 18C36 8.05888 27.9411 0 18 0Z" fill="${pinColor}"/>
            <circle cx="18" cy="18" r="13" fill="#FFFFFF"/>
            <text x="18" y="23" font-size="14" text-anchor="middle" font-weight="bold" fill="${pinColor}">🏅</text>
          </svg>
        </div>
      `
    });
  }

  // 3. Render Reference Markers
  const grozMarker = L.marker([refGroz.lat, refGroz.lng], {
    icon: createRefIcon("grozavesti", "🏠", "Grozăvești A")
  }).addTo(map);

  grozMarker.bindPopup(`
    <div style="padding: 6px; font-family: inherit;">
      <h3 style="font-size: 15px; font-weight: 800; color: #065f46; margin-bottom: 4px;">🏠 Cămin Grozăvești A</h3>
      <p style="font-size: 12px; color: #475569; margin-bottom: 4px;"><strong>Student House</strong> • Where students stay.</p>
      <p style="font-size: 11px; color: #64748b;">${refGroz.address}</p>
    </div>
  `);

  const pbtMarker = L.marker([refPbt.lat, refPbt.lng], {
    icon: createRefIcon("pbt", "🏢", "Politehnica Tower")
  }).addTo(map);

  pbtMarker.bindPopup(`
    <div style="padding: 6px; font-family: inherit;">
      <h3 style="font-size: 15px; font-weight: 800; color: #3730a3; margin-bottom: 4px;">🏢 Politehnica Business Tower</h3>
      <p style="font-size: 12px; color: #475569; margin-bottom: 4px;"><strong>Courses Location</strong> • Where all university lectures take place.</p>
      <p style="font-size: 11px; color: #64748b;">${refPbt.address}</p>
    </div>
  `);

  // 4. Render Sports Pins and Hover Tooltips
  const markersMap = new Map();

  function buildTooltipHtml(loc) {
    const sportsChips = loc.sports_list.slice(0, 4).map(s => 
      `<span class="tt-sport-chip">${s}</span>`
    ).join('');
    const extraSports = loc.sports_list.length > 4 ? `<span class="tt-sport-chip">+${loc.sports_list.length - 4} more</span>` : '';

    // Schedule summary: group by day
    const scheduleByDay = {};
    loc.schedule.forEach(slot => {
      if (!scheduleByDay[slot.day]) scheduleByDay[slot.day] = [];
      scheduleByDay[slot.day].push(slot.time);
    });
    const daysSummary = Object.keys(scheduleByDay).slice(0, 3).map(day => {
      const times = Array.from(new Set(scheduleByDay[day])).slice(0, 2).join(', ');
      return `<strong>${day}:</strong> ${times}`;
    }).join(' • ');

    return `
      <div class="custom-hover-tooltip">
        <div class="tt-title">${loc.name}</div>
        <div class="tt-category">📍 ${loc.category} • ${loc.facility_type}</div>
        
        <div class="tt-metrics">
          <div class="tt-metric-row groz">
            <span class="tt-metric-label">🏠 Grozăvești A:</span>
            <span class="tt-metric-val"><strong>${loc.dist_grozavesti_km} km</strong> (🚶 ${loc.walk_grozavesti_min}m | 🚇 ${loc.transit_grozavesti_min}m)</span>
          </div>
          <div class="tt-metric-row pbt">
            <span class="tt-metric-label">🏢 Politehnica:</span>
            <span class="tt-metric-val"><strong>${loc.dist_pbt_km} km</strong> (🚶 ${loc.walk_pbt_min}m | 🚌 ${loc.transit_pbt_min}m)</span>
          </div>
        </div>

        <div style="font-size: 10.5px; font-weight: 700; color: #64748b; margin-bottom: 3px;">SPORTS:</div>
        <div class="tt-sports-chips">
          ${sportsChips} ${extraSports}
        </div>

        <div class="tt-hours-summary">
          ⏰ ${daysSummary}
        </div>
      </div>
    `;
  }

  locations.forEach(loc => {
    const marker = L.marker([loc.lat, loc.lng], {
      icon: createSportsPinIcon(loc, false, false),
      riseOnHover: true
    }).addTo(map);

    // Bind custom hover tooltip
    marker.bindTooltip(buildTooltipHtml(loc), {
      direction: 'top',
      offset: [0, -48],
      opacity: 1,
      className: 'custom-hover-tooltip-container'
    });

    // Hover events
    marker.on("mouseover", () => {
      handleLocationHover(loc);
    });

    marker.on("mouseout", () => {
      handleLocationUnhover(loc);
    });

    marker.on("click", () => {
      handleLocationSelect(loc);
    });

    markersMap.set(loc.id, marker);
  });

  // 5. Dynamic Route Lines on Hover / Selection
  function drawRouteLines(loc) {
    clearRouteLines();

    // Line 1: To Grozăvești A (Green)
    const lineGroz = L.polyline([
      [loc.lat, loc.lng],
      [refGroz.lat, refGroz.lng]
    ], {
      color: "#10b981",
      weight: 3.5,
      dashArray: "8, 8",
      opacity: 0.95
    }).addTo(map);

    lineGroz.bindTooltip(`🏠 Grozăvești: <strong>${loc.dist_grozavesti_km} km</strong> (🚶 ${loc.walk_grozavesti_min}m | 🚇 ${loc.transit_grozavesti_min}m)`, {
      permanent: true,
      direction: "center",
      className: "route-line-label groz"
    });

    // Line 2: To Politehnica Business Tower (Indigo)
    const linePbt = L.polyline([
      [loc.lat, loc.lng],
      [refPbt.lat, refPbt.lng]
    ], {
      color: "#6366f1",
      weight: 3.5,
      dashArray: "8, 8",
      opacity: 0.95
    }).addTo(map);

    linePbt.bindTooltip(`🏢 Politehnica: <strong>${loc.dist_pbt_km} km</strong> (🚶 ${loc.walk_pbt_min}m | 🚌 ${loc.transit_pbt_min}m)`, {
      permanent: true,
      direction: "center",
      className: "route-line-label pbt"
    });

    activeRouteLines = [lineGroz, linePbt];
  }
  function clearRouteLines() {
    activeRouteLines.forEach(line => map.removeLayer(line));
    activeRouteLines = [];
  }

  // 6. Handle Hover & Selection Actions
  function handleLocationHover(loc) {
    drawRouteLines(loc);
    updateQuickPreview(loc);
    highlightSidebarItem(loc.id);

    const marker = markersMap.get(loc.id);
    if (marker) {
      marker.setIcon(createSportsPinIcon(loc, true, activeLocation && activeLocation.id === loc.id));
    }
  }

  function handleLocationUnhover(loc) {
    if (!activeLocation || activeLocation.id !== loc.id) {
      clearRouteLines();
      if (!activeLocation) {
        previewPanel.classList.add("hidden");
        unhighlightSidebarItems();
      } else {
        drawRouteLines(activeLocation);
        updateQuickPreview(activeLocation);
        highlightSidebarItem(activeLocation.id);
      }
    }

    const marker = markersMap.get(loc.id);
    if (marker) {
      marker.setIcon(createSportsPinIcon(loc, false, activeLocation && activeLocation.id === loc.id));
    }
  }

  function handleLocationSelect(loc) {
    if (activeLocation && activeLocation.id === loc.id) {
      // Toggle off
      activeLocation = null;
      clearRouteLines();
      previewPanel.classList.add("hidden");
      unhighlightSidebarItems();
      const marker = markersMap.get(loc.id);
      if (marker) marker.setIcon(createSportsPinIcon(loc, false, false));
      return;
    }

    // Set new active location
    if (activeLocation) {
      const prevMarker = markersMap.get(activeLocation.id);
      if (prevMarker) prevMarker.setIcon(createSportsPinIcon(activeLocation, false, false));
    }

    activeLocation = loc;
    drawRouteLines(loc);
    updateQuickPreview(loc);
    highlightSidebarItem(loc.id);

    const marker = markersMap.get(loc.id);
    if (marker) {
      marker.setIcon(createSportsPinIcon(loc, true, true));
    }

    // Smooth pan to location
    map.flyTo([loc.lat, loc.lng], 15, {
      duration: 0.8
    });
  }

  // 7. Update Floating Quick Preview Card
  function updateQuickPreview(loc) {
    previewPanel.classList.remove("hidden");

    document.getElementById("preview-title").textContent = loc.name;
    document.getElementById("preview-campus-badge").textContent = loc.category;
    document.getElementById("preview-facility-type").textContent = loc.facility_type;

    // Grozăvești metrics
    document.getElementById("preview-groz-dist").textContent = loc.dist_grozavesti_km;
    document.getElementById("preview-groz-walk").textContent = `${loc.walk_grozavesti_min} min`;
    document.getElementById("preview-groz-transit").textContent = `${loc.transit_grozavesti_min} min`;
    document.getElementById("preview-groz-route").innerHTML = `<strong>Transit:</strong> ${loc.transit_grozavesti_route}`;

    // Politehnica metrics
    document.getElementById("preview-pbt-dist").textContent = loc.dist_pbt_km;
    document.getElementById("preview-pbt-walk").textContent = `${loc.walk_pbt_min} min`;
    document.getElementById("preview-pbt-transit").textContent = `${loc.transit_pbt_min} min`;
    document.getElementById("preview-pbt-route").innerHTML = `<strong>Transit:</strong> ${loc.transit_pbt_route}`;

    // Navigation link
    const navLink = document.getElementById("preview-nav-link");
    navLink.href = loc.map_url;

    // Render Venue-Specific Multi-Select Sports and Filtered Schedule
    renderVenueSportsAndSchedule(loc);
  }

  function renderVenueSportsAndSchedule(loc) {
    // If switching to a different location, reset the selected sports
    if (currentVenueId !== loc.id) {
      currentVenueId = loc.id;
      venueSelectedSports.clear();
    }

    // 1. Calculate session count for each sport at this venue
    const sportSessionCounts = {};
    loc.schedule.forEach(slot => {
      let matched = slot.sport;
      for (const sp of loc.sports_list) {
        if (slot.sport.toLowerCase().includes(sp.toLowerCase()) || sp.toLowerCase().includes(slot.sport.toLowerCase())) {
          matched = sp;
          break;
        }
      }
      sportSessionCounts[matched] = (sportSessionCounts[matched] || 0) + 1;
    });

    // 2. Render Multi-Select Sports Available Badges
    const sportsContainer = document.getElementById("preview-sports-container");
    sportsContainer.innerHTML = "";

    const hasSelection = venueSelectedSports.size > 0;

    const sportEmojiMap = {
      "badminton": "🏸", "baschet": "🏀", "fitness": "💪", "fotbal": "⚽",
      "tenis": "🎾", "tenis de masă": "🏓", "volei": "🏐", "karate": "🥋",
      "atletism": "🏃", "judo": "🥋", "șah": "♟️", "dans": "💃",
      "autoapărare": "🤼", "handbal": "🤾", "nautic": "🚣", "aerobic": "🧘",
      "gimnastică": "🩺", "pfg": "🏋️", "kick": "🥊"
    };

    function getSportEmoji(name) {
      const lower = name.toLowerCase();
      for (const [k, emoji] of Object.entries(sportEmojiMap)) {
        if (lower.includes(k)) return emoji;
      }
      return "🏅";
    }

    loc.sports_list.forEach(sp => {
      const isSelected = venueSelectedSports.has(sp);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `sport-badge-pill ${isSelected ? 'active' : (hasSelection ? 'muted' : '')}`;
      
      const count = sportSessionCounts[sp] || 1;
      const emoji = getSportEmoji(sp);
      btn.innerHTML = `
        <span class="check-indicator">${isSelected ? '✓ ' : ''}</span>
        <span>${emoji}</span>
        <span>${sp}</span>
        <span class="sport-count">${count}</span>
      `;
      btn.title = isSelected 
        ? `${sp} este selectat. Click pentru a-l exclude din orar.` 
        : `Click pentru a selecta ${sp} (arată doar orele lui)`;

      // Toggle selection on click (multi-select!)
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (venueSelectedSports.has(sp)) {
          venueSelectedSports.delete(sp);
        } else {
          venueSelectedSports.add(sp);
        }
        renderVenueSportsAndSchedule(loc);
      });

      sportsContainer.appendChild(btn);
    });

    // 3. Reset Button (Show all sports at this location)
    if (btnResetVenueSports) {
      if (hasSelection) {
        btnResetVenueSports.classList.remove("hidden");
        btnResetVenueSports.textContent = `Arată toate (${loc.sports_list.length})`;
        btnResetVenueSports.onclick = (e) => {
          e.stopPropagation();
          venueSelectedSports.clear();
          renderVenueSportsAndSchedule(loc);
        };
      } else {
        btnResetVenueSports.classList.add("hidden");
      }
    }

    // 4. Filter Schedule Slots: ONLY show slots for selected sports ("and for the others you just fuck them")
    let displaySlots = loc.schedule;
    if (hasSelection) {
      displaySlots = loc.schedule.filter(slot => {
        return Array.from(venueSelectedSports).some(selSport => {
          const s1 = slot.sport.toLowerCase();
          const s2 = selSport.toLowerCase();
          return s1.includes(s2) || s2.includes(s1);
        });
      });
    }

    // 5. Update Status Banner
    if (scheduleFilterStatus) {
      if (hasSelection) {
        scheduleFilterStatus.classList.remove("hidden");
        scheduleFilterStatus.textContent = `${displaySlots.length} din ${loc.schedule.length} ore (${venueSelectedSports.size} selectat${venueSelectedSports.size > 1 ? 'e' : ''})`;
      } else {
        scheduleFilterStatus.classList.remove("hidden");
        scheduleFilterStatus.textContent = `${loc.schedule.length} ore total`;
      }
    }

    // 6. Render Schedule by Day
    const scheduleContainer = document.getElementById("preview-schedule-container");
    scheduleContainer.innerHTML = "";

    const daysOrder = ["Luni", "Marți", "Miercuri", "Joi", "Vineri"];
    const grouped = {};
    displaySlots.forEach(slot => {
      let slotDay = slot.day;
      for (const d of daysOrder) {
        if (slot.day.toLowerCase() === d.toLowerCase()) {
          slotDay = d;
          break;
        }
      }
      if (!grouped[slotDay]) grouped[slotDay] = [];
      grouped[slotDay].push(slot);
    });

    let renderedDays = 0;
    daysOrder.forEach(day => {
      if (grouped[day] && grouped[day].length > 0) {
        renderedDays++;
        const dayCard = document.createElement("div");
        dayCard.className = "day-schedule-card";

        let slotsHtml = grouped[day].map(s => {
          let tagsHtml = s.tags.map(t => `<span class="slot-tag">${t}</span>`).join('');
          return `
            <div class="slot-item">
              <span class="slot-time">${s.time}</span>
              <span class="slot-detail"><strong>${s.sport}:</strong> ${s.description} ${tagsHtml}</span>
            </div>
          `;
        }).join('');

        dayCard.innerHTML = `
          <div class="day-schedule-title">
            <span>📅 ${day}</span>
            <span style="font-size: 11px; color: #64748b;">${grouped[day].length} intervale</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${slotsHtml}
          </div>
        `;
        scheduleContainer.appendChild(dayCard);
      }
    });

    if (renderedDays === 0) {
      scheduleContainer.innerHTML = `
        <div style="padding: 18px; text-align: center; color: #64748b; font-size: 12.5px; background: white; border-radius: 8px; border: 1px dashed #cbd5e1;">
          Nicio oră programată pentru sporturile selectate (${Array.from(venueSelectedSports).join(', ')}).
        </div>
      `;
    }
  }

  // 8. Render Left Sidebar List
  function renderSidebarList(filteredLocations) {
    locationsList.innerHTML = "";
    locationsCountBadge.textContent = `${filteredLocations.length} locații`;

    if (filteredLocations.length === 0) {
      locationsList.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">
          Nicio locație găsită conform filtrelor curente.
        </div>
      `;
      return;
    }

    filteredLocations.forEach(loc => {
      const card = document.createElement("div");
      card.className = `location-item-card ${activeLocation && activeLocation.id === loc.id ? 'active' : ''}`;
      card.id = `sidebar-item-${loc.id}`;

      const sportsTags = loc.sports_list.slice(0, 4).map(s => {
        return `<span class="mini-sport-tag" data-sport="${s}" title="Deschide ${loc.name} pentru ${s}">🏅 ${s}</span>`;
      }).join('');
      const moreCount = loc.sports_list.length > 4 ? `<span class="mini-sport-tag" style="background:#e2e8f0; cursor:default;">+${loc.sports_list.length - 4}</span>` : '';

      card.innerHTML = `
        <div class="item-top">
          <div class="item-name">${loc.name}</div>
          <span class="item-badge">${loc.category}</span>
        </div>
        <div class="item-distances">
          <div class="dist-row groz">
            <span class="dist-label">🏠 Grozăvești A:</span>
            <span class="dist-metrics">${loc.dist_grozavesti_km} km • 🚶 ${loc.walk_grozavesti_min}m • 🚇 ${loc.transit_grozavesti_min}m</span>
          </div>
          <div class="dist-row pbt">
            <span class="dist-label">🏢 Politehnica:</span>
            <span class="dist-metrics">${loc.dist_pbt_km} km • 🚶 ${loc.walk_pbt_min}m • 🚌 ${loc.transit_pbt_min}m</span>
          </div>
        </div>
        <div class="item-sports-tags">
          ${sportsTags} ${moreCount}
        </div>
      `;

      card.addEventListener("mouseenter", () => {
        handleLocationHover(loc);
      });

      card.addEventListener("mouseleave", () => {
        handleLocationUnhover(loc);
      });

      card.addEventListener("click", () => {
        handleLocationSelect(loc);
      });

      locationsList.appendChild(card);
      // Attach click listeners to mini-sport-tags so clicking them immediately toggles the sport filter
      // Attach click listeners to mini-sport-tags: select location and pre-select that sport in schedule
      card.querySelectorAll(".mini-sport-tag[data-sport]").forEach(tag => {
        tag.addEventListener("click", (e) => {
          e.stopPropagation();
          const spName = tag.getAttribute("data-sport");
          handleLocationSelect(loc);
          venueSelectedSports.clear();
          venueSelectedSports.add(spName);
          renderVenueSportsAndSchedule(loc);
        });
      });

    });
  }

  function highlightSidebarItem(locId) {
    document.querySelectorAll(".location-item-card").forEach(el => el.classList.remove("active"));
    const activeEl = document.getElementById(`sidebar-item-${locId}`);
    if (activeEl) {
      activeEl.classList.add("active");
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function unhighlightSidebarItems() {
    document.querySelectorAll(".location-item-card").forEach(el => el.classList.remove("active"));
  }

  // 9. Filtering and Sorting Logic
  function applyFilters() {
    let filtered = [...locations];

    // Filter by search query (name, sports, professor, notes)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(loc => {
        const inName = loc.name.toLowerCase().includes(q);
        const inAddress = loc.address.toLowerCase().includes(q);
        const inCampus = loc.category.toLowerCase().includes(q);
        const inSports = loc.sports_list.some(s => s.toLowerCase().includes(q));
        const inSchedule = loc.schedule.some(s => 
          s.sport.toLowerCase().includes(q) || 
          s.description.toLowerCase().includes(q)
        );
        return inName || inAddress || inCampus || inSports || inSchedule;
      });
    }


    // Filter by Day
    if (activeDay !== "all") {
      filtered = filtered.filter(loc => 
        loc.schedule.some(s => s.day.toLowerCase() === activeDay.toLowerCase())
      );
    }

    // Sorting
    if (activeSort === "grozavesti") {
      filtered.sort((a, b) => a.dist_grozavesti_km - b.dist_grozavesti_km);
    } else if (activeSort === "pbt") {
      filtered.sort((a, b) => a.dist_pbt_km - b.dist_pbt_km);
    } else if (activeSort === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Update markers visibility on map
    const activeIds = new Set(filtered.map(l => l.id));
    markersMap.forEach((marker, id) => {
      if (activeIds.has(id)) {
        if (!map.hasLayer(marker)) map.addLayer(marker);
      } else {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
    });

    renderSidebarList(filtered);
  }

  // 10. Populate Full Timetable Modal
  function populateTimetableModal() {
    modalTbody.innerHTML = "";
    
    // Flatten all slots with location context
    const allSlots = [];
    locations.forEach(loc => {
      loc.schedule.forEach(slot => {
        allSlots.push({
          location: loc,
          slot: slot
        });
      });
    });

    // Day sort order
    const dayOrder = { "luni": 1, "marți": 2, "marti": 2, "miercuri": 3, "joi": 4, "vineri": 5 };
    allSlots.sort((a, b) => {
      const dA = dayOrder[a.slot.day.toLowerCase()] || 9;
      const dB = dayOrder[b.slot.day.toLowerCase()] || 9;
      if (dA !== dB) return dA - dB;
      return a.slot.time.localeCompare(b.slot.time);
    });

    allSlots.forEach(({ location, slot }) => {
      const tr = document.createElement("tr");

      const tagsHtml = slot.tags.map(t => `<span class="slot-tag">${t}</span>`).join('');

      tr.innerHTML = `
        <td><strong>${location.name}</strong><br><span style="font-size: 11px; color: #64748b;">${location.category}</span></td>
        <td><strong style="color: #2563eb;">${slot.day}</strong></td>
        <td><strong>${slot.time}</strong></td>
        <td><span class="sport-badge-pill" style="font-size: 11.5px; padding: 2px 8px;">${slot.sport}</span></td>
        <td>${slot.description} ${tagsHtml}</td>
        <td style="font-size: 11px;">
          <div>🏠 Groz: <strong>${location.dist_grozavesti_km} km</strong></div>
          <div>🏢 PBT: <strong>${location.dist_pbt_km} km</strong></div>
        </td>
      `;

      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        timetableModal.classList.remove("open");
        handleLocationSelect(location);
      });

      const sportBadge = tr.querySelector(".sport-badge-pill");
      if (sportBadge) {
        sportBadge.title = `Deschide ${location.name} și afișează orarul pentru ${slot.sport}`;
        sportBadge.addEventListener("click", (e) => {
          e.stopPropagation();
          timetableModal.classList.remove("open");
          handleLocationSelect(location);
          venueSelectedSports.clear();
          venueSelectedSports.add(slot.sport);
          renderVenueSportsAndSchedule(location);
        });
      }

      modalTbody.appendChild(tr);
    });
  }

  // 11. Event Listeners Wiring
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    applyFilters();
  });


  sortSelect.addEventListener("change", (e) => {
    activeSort = e.target.value;
    applyFilters();
  });

  dayPillsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".day-pill");
    if (!btn) return;
    document.querySelectorAll(".day-pill").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    activeDay = btn.getAttribute("data-day");
    applyFilters();
  });

  btnCloseSidebar.addEventListener("click", () => {
    sidebarPanel.classList.add("collapsed");
  });

  btnToggleSidebar.addEventListener("click", () => {
    sidebarPanel.classList.toggle("collapsed");
  });

  btnReopenSidebar.addEventListener("click", () => {
    sidebarPanel.classList.remove("collapsed");
  });

  btnClosePreview.addEventListener("click", () => {
    previewPanel.classList.add("hidden");
    if (activeLocation) {
      const marker = markersMap.get(activeLocation.id);
      if (marker) marker.setIcon(createSportsPinIcon(activeLocation, false, false));
      activeLocation = null;
      clearRouteLines();
      unhighlightSidebarItems();
    }
  });

  btnResetMap.addEventListener("click", () => {
    map.fitBounds(initialBounds, { padding: [80, 80], animate: true });
    if (activeLocation) {
      const marker = markersMap.get(activeLocation.id);
      if (marker) marker.setIcon(createSportsPinIcon(activeLocation, false, false));
      activeLocation = null;
      clearRouteLines();
      previewPanel.classList.add("hidden");
      unhighlightSidebarItems();
    }
  });

  btnFocusGrozavesti.addEventListener("click", () => {
    map.flyTo([refGroz.lat, refGroz.lng], 16, { duration: 1 });
    grozMarker.openPopup();
  });

  btnFocusPbt.addEventListener("click", () => {
    map.flyTo([refPbt.lat, refPbt.lng], 16, { duration: 1 });
    pbtMarker.openPopup();
  });

  btnOpenTimetable.addEventListener("click", () => {
    populateTimetableModal();
    timetableModal.classList.add("open");
  });

  previewViewTableBtn.addEventListener("click", () => {
    populateTimetableModal();
    timetableModal.classList.add("open");
  });

  btnCloseModal.addEventListener("click", () => {
    timetableModal.classList.remove("open");
  });

  timetableModal.addEventListener("click", (e) => {
    if (e.target === timetableModal) {
      timetableModal.classList.remove("open");
    }
  });

  // Initial render of sidebar list
  applyFilters();

  console.log("UB Sports Map application initialized successfully!");
})();
