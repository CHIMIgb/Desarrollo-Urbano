import { state } from '../config/state.js';
import { polygonArea, isPointInPolygon, getFeatureCenter } from '../utils/geo.js';
import { escapeHTML } from '../utils/sanitize.js';

/**
 * Logica de calculo y actualizacion del Dashboard de Metricas Urbanas.
 * Se encarga de analizar todas las entidades del mapa y extraer ratios normativos (Global e Individual).
 */

/**
 * Calcula todas las metricas urbanas actuales (Globales e Individuales) 
 * basandose en el estado actual de las features. No modifica el DOM.
 * @returns {Object} { global: Object, lots: Array }
 */
export function calculateCurrentMetrics() {
  const terrainFeatures = state.features.filter(f => f.properties.type === 'terrain');

  const lotsMetrics = terrainFeatures.map(t => {
    const coords = t.geometry.type === 'Polygon' ? t.geometry.coordinates[0] : t.geometry.coordinates[0][0];
    return {
      lot_id: t.properties.id,
      name: t.properties.name || `Lote ${t.properties.id}`,
      base_area: polygonArea(coords),
      coords: coords,
      occupied_area: 0,
      built_area: 0,
      green_area: 0,
      cos: 0,
      cus: 0,
      max_allowed_height: t.properties.maxHeight || null,
      min_cas: t.properties.minCAS || null,
      min_setback: t.properties.minSetback || null,
      max_building_height: 0,
      height_violations: 0,
      cas_violations: 0,
      setback_violations: 0
    };
  });

  let globalBaseArea = 0;
  let globalOccupiedArea = 0;
  let globalTotalBuiltArea = 0;
  let globalGreenArea = 0;
  let globalMaxBuildingHeight = 0;

  state.features.forEach(f => {
    const type = f.properties.type;
    const geom = f.geometry;
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return;
    
    const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
    const area = polygonArea(coords);

    if (type === 'terrain') {
      globalBaseArea += area;
    } else if (['building', 'house', 'custom_building'].includes(type) && !f.properties.parent_id) {
      globalOccupiedArea += area;
      globalTotalBuiltArea += (area * (f.properties.floors || 1));
      const h = f.properties.height || (f.properties.floors ? f.properties.floors * 3.5 : 3.5);
      if (h > globalMaxBuildingHeight) globalMaxBuildingHeight = h;
    } else if (['park', 'water'].includes(type)) {
      globalGreenArea += area;
    }

    if (type !== 'terrain') {
      const center = getFeatureCenter(f);
      if (center) {
        lotsMetrics.forEach(lot => {
          if (isPointInPolygon([center.lng, center.lat], lot.coords)) {
            if (['building', 'house', 'custom_building'].includes(type) && !f.properties.parent_id) {
              lot.occupied_area += area;
              lot.built_area += (area * (f.properties.floors || 1));
              const h = f.properties.height || (f.properties.floors ? f.properties.floors * 3.5 : 3.5);
              if (h > lot.max_building_height) lot.max_building_height = h;
              if (lot.max_allowed_height && h > lot.max_allowed_height) lot.height_violations++;
              
              if (lot.min_setback && window.turf) {
                try {
                  const bGeom = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates[0];
                  const lotLine = window.turf.polygonToLine(window.turf.polygon([lot.coords]));
                  const bPoly = window.turf.polygon(bGeom);
                  // Find minimum distance from building to lot edges
                  let minDistance = Infinity;
                  bGeom[0].forEach(pt => {
                    const dist = window.turf.pointToLineDistance(window.turf.point(pt), lotLine, {units: 'meters'});
                    if (dist < minDistance) minDistance = dist;
                  });
                  if (minDistance < lot.min_setback) {
                    lot.setback_violations++;
                  }
                } catch (e) { console.warn("Turf setback check error", e); }
              }
            } else if (['park', 'water'].includes(type)) {
              lot.green_area += area;
            }
          }
        });
      }
    }
  });

  lotsMetrics.forEach(lot => {
    if (lot.base_area > 0) {
      lot.cos = (lot.occupied_area / lot.base_area) * 100;
      lot.cus = lot.built_area / lot.base_area;
      const greenP = (lot.green_area / lot.base_area) * 100;
      if (lot.min_cas && greenP < lot.min_cas) {
        lot.cas_violations = 1;
      }
    }
  });

  return {
    global: {
      total_base_area: globalBaseArea,
      total_occupied_area: globalOccupiedArea,
      total_built_area: globalTotalBuiltArea,
      total_green_area: globalGreenArea,
      cos: globalBaseArea > 0 ? (globalOccupiedArea / globalBaseArea) * 100 : 0,
      cus: globalBaseArea > 0 ? (globalTotalBuiltArea / globalBaseArea) : 0,
      estimated_population: Math.floor(globalTotalBuiltArea / 35),
      max_building_height: globalMaxBuildingHeight,
      max_allowed_height: null,
      height_violations: lotsMetrics.reduce((sum, lot) => sum + lot.height_violations, 0),
      min_cas: null,
      cas_violations: lotsMetrics.reduce((sum, lot) => sum + lot.cas_violations, 0),
      min_setback: null,
      setback_violations: lotsMetrics.reduce((sum, lot) => sum + lot.setback_violations, 0)
    },
    lots: lotsMetrics
  };
}

export function updateGlobalStats() {
  const dashboard = document.getElementById('stats-dashboard');
  if (!dashboard) return;

  const data = calculateCurrentMetrics();
  const selectedTerrainIds = new Set(state.selectedIds.filter(id => {
    const f = state.features.find(x => x.properties.id === id);
    return f && f.properties.type === 'terrain';
  }));

  // Adaptar datos para UI
  const lotsMetricsUI = data.lots.map(l => ({
    ...l,
    id: l.lot_id,
    baseArea: l.base_area,
    occupiedArea: l.occupied_area,
    totalBuiltArea: l.built_area,
    greenArea: l.green_area,
    maxAllowedHeight: l.max_allowed_height,
    maxBuildingHeight: l.max_building_height,
    heightViolations: l.height_violations,
    minCAS: l.min_cas,
    casViolations: l.cas_violations,
    minSetback: l.min_setback,
    setbackViolations: l.setback_violations,
    isSelected: selectedTerrainIds.has(l.lot_id)
  }));

  const activeFocus = lotsMetricsUI.find(l => l.isSelected) || {
    baseArea: data.global.total_base_area,
    occupiedArea: data.global.total_occupied_area,
    totalBuiltArea: data.global.total_built_area,
    greenArea: data.global.total_green_area,
    maxBuildingHeight: data.global.max_building_height,
    maxAllowedHeight: data.global.max_allowed_height,
    heightViolations: data.global.height_violations,
    minCAS: data.global.min_cas,
    casViolations: data.global.cas_violations,
    minSetback: data.global.min_setback,
    setbackViolations: data.global.setback_violations,
    name: 'Metricas Globales',
    isGlobal: true
  };

  updateSummaryUI(activeFocus);

  const btnBack = document.getElementById('btnBackToGlobal');
  if (btnBack) {
    btnBack.style.display = activeFocus.isGlobal ? 'none' : 'flex';
  }

  const breakdownContainer = document.getElementById('stats-breakdown');
  if (breakdownContainer) {
    if (data.lots.length > 0) {
      breakdownContainer.classList.remove('hidden');
    } else {
      breakdownContainer.classList.add('hidden');
    }
    renderLotBreakdown(lotsMetricsUI);
  }

  // Actualizar también los contadores simples de UI (antes en toolbar.js updateStats)
  const cnt = { house: 0, building: 0, road: 0, park: 0, zone: 0, terrain: 0, path: 0, sidewalk: 0 };
  state.features.forEach(f => { 
    if (!f.properties.parent_id) {
      cnt[f.properties.type] = (cnt[f.properties.type] || 0) + 1; 
    }
  });
  const sh = document.getElementById('stat-houses');
  const sb = document.getElementById('stat-buildings');
  const sr = document.getElementById('stat-roads');
  const sp = document.getElementById('stat-parks');
  if (sh) sh.textContent = cnt.house;
  if (sb) sb.textContent = cnt.building + (cnt.custom_building || 0);
  if (sr) sr.textContent = cnt.road;
  if (sp) sp.textContent = cnt.park;
}

/**
 * Renderiza la lista de tarjetas de lotes individuales.
 */
function renderLotBreakdown(lots) {
  const listEl = document.getElementById('lot-list');
  if (!listEl) return;

  if (lots.length === 0) {
    listEl.innerHTML = '<div class="empty-text">No hay terrenos definidos.</div>';
    return;
  }

  listEl.innerHTML = lots.map(lot => {
    const cos = lot.baseArea > 0 ? (lot.occupiedArea / lot.baseArea) * 100 : 0;
    const cus = lot.baseArea > 0 ? (lot.totalBuiltArea / lot.baseArea) : 0;
    
    return `
      <div class="lot-card ${lot.isSelected ? 'selected' : ''}" data-id="${lot.id}">
        <div class="lot-card-header">
          <span class="lot-name">${escapeHTML(lot.name)}</span>
          <button class="btn-locate-lot" title="Centrar camara en este lote" data-id="${lot.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
            </svg>
          </button>
        </div>
        <div class="lot-grid">
          <div class="lot-sub-stat">
            <span class="lot-sub-label">COS</span>
            <span class="lot-sub-val">${cos.toFixed(1)}%</span>
          </div>
          <div class="lot-sub-stat">
            <span class="lot-sub-label">CUS</span>
            <span class="lot-sub-val">${cus.toFixed(2)}</span>
          </div>
          <div class="lot-sub-stat">
            <span class="lot-sub-label">Area (B)</span>
            <span class="lot-sub-val">${Math.round(lot.baseArea).toLocaleString()} m2</span>
          </div>
          <div class="lot-sub-stat ${lot.heightViolations > 0 ? 'violation' : ''}" title="${lot.heightViolations > 0 ? 'Edificios exceden altura max' : ''}">
            <span class="lot-sub-label">Alt. Máx</span>
            <span class="lot-sub-val">${lot.maxAllowedHeight ? lot.maxBuildingHeight.toFixed(1) + '/' + lot.maxAllowedHeight : lot.maxBuildingHeight.toFixed(1)} m</span>
          </div>
          <div class="lot-sub-stat ${lot.casViolations > 0 ? 'violation' : ''}" title="${lot.casViolations > 0 ? 'No cumple CAS Mínimo' : ''}">
            <span class="lot-sub-label">Á. Verde</span>
            <span class="lot-sub-val">${lot.minCAS ? ((lot.greenArea/lot.baseArea)*100).toFixed(1) + '/' + lot.minCAS + '%' : ((lot.greenArea/lot.baseArea)*100).toFixed(1) + '%'}</span>
          </div>
          <div class="lot-sub-stat ${lot.setbackViolations > 0 ? 'violation' : ''}" title="${lot.setbackViolations > 0 ? 'Invasión de Retiro Perimetral' : ''}">
            <span class="lot-sub-label">Retiro</span>
            <span class="lot-sub-val">${lot.minSetback ? (lot.setbackViolations === 0 ? 'OK' : 'Violado') : '-'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Re-enlazar eventos
  listEl.querySelectorAll('.lot-card').forEach(card => {
    card.onclick = (e) => {
      const id = parseInt(card.dataset.id);
      import('../tools/selection.js').then(m => m.selectFeature(id, null));
    };

    // Boton de localizacion (Fly-to)
    const btnLocate = card.querySelector('.btn-locate-lot');
    if (btnLocate) {
      btnLocate.onclick = (e) => {
        e.stopPropagation(); 
        const id = parseInt(btnLocate.dataset.id);
        const feature = state.features.find(f => f.properties.id === id);
        if (feature) {
          const center = getFeatureCenter(feature);
          if (center && state.map) {
            state.map.flyTo({
              center: [center.lng, center.lat],
              zoom: 17,
              pitch: 45,
              duration: 2000
            });
          }
        }
      };
    }
  });
}

/**
 * Actualiza la seccion superior de resumen (Total o Lote Seleccionado).
 */
function updateSummaryUI(metrics) {
  const elArea = document.getElementById('val-terrain-area');
  const elCos = document.getElementById('val-cos');
  const elCus = document.getElementById('val-cus');
  const elGreen = document.getElementById('val-green');
  const elHeight = document.getElementById('val-height');
  const elPop = document.getElementById('val-pop');

  const barCos = document.getElementById('bar-cos');
  const barCus = document.getElementById('bar-cus');
  const barGreen = document.getElementById('bar-green');

  const dashboard = document.getElementById('stats-dashboard');
  if (!dashboard) return;

  if (metrics.baseArea > 0) {
    const cos = (metrics.occupiedArea / metrics.baseArea) * 100;
    const cus = (metrics.totalBuiltArea / metrics.baseArea);
    const greenP = (metrics.greenArea / metrics.baseArea) * 100;

    if (elArea) elArea.textContent = Math.round(metrics.baseArea).toLocaleString() + ' m2';
    if (elCos) elCos.textContent = cos.toFixed(1) + '%';
    if (elCus) elCus.textContent = cus.toFixed(2);
    if (elGreen) {
      elGreen.textContent = metrics.minCAS ? greenP.toFixed(1) + ' / ' + metrics.minCAS + '%' : greenP.toFixed(1) + '%';
      if (metrics.casViolations > 0) elGreen.classList.add('violation');
      else elGreen.classList.remove('violation');
    }
    if (elHeight) {
       elHeight.textContent = metrics.maxAllowedHeight ? metrics.maxBuildingHeight.toFixed(1) + ' / ' + metrics.maxAllowedHeight + ' m' : metrics.maxBuildingHeight.toFixed(1) + ' m';
       if (metrics.heightViolations > 0) elHeight.classList.add('violation');
       else elHeight.classList.remove('violation');
    }
    if (elPop) {
      const pop = Math.floor(metrics.totalBuiltArea / 35);
      elPop.textContent = pop.toLocaleString() + ' hab.';
    }

    if (barCos) barCos.style.width = Math.min(cos, 100) + '%';
    if (barCus) barCus.style.width = Math.min(cus * 20, 100) + '%';
    if (barGreen) barGreen.style.width = Math.min(greenP, 100) + '%';
    dashboard.classList.remove('no-terrain');
  } else {
    if (elArea) elArea.textContent = '0 m2';
    if (elCos) elCos.textContent = '0%';
    if (elCus) elCus.textContent = '0.0';
    if (elGreen) {
       elGreen.textContent = '0%';
       elGreen.classList.remove('violation');
    }
    if (elHeight) {
       elHeight.textContent = '0 m';
       elHeight.classList.remove('violation');
    }
    if (elPop) elPop.textContent = '0 hab.';
    [barCos, barCus, barGreen].forEach(b => { if (b) b.style.width = '0%'; });
    dashboard.classList.add('no-terrain');
  }
}

/**
 * Inicializa los eventos de interaccion del dashboard (colapsar/expandir).
 */
export function initStatsEvents() {
  const toggleBtn = document.getElementById('btnStatsToggle');
  const header = document.getElementById('stats-header');
  const dashboard = document.getElementById('stats-dashboard');

  const toggle = () => {
    dashboard?.classList.toggle('collapsed');
    const isCollapsed = dashboard?.classList.contains('collapsed');
    toggleBtn?.setAttribute('aria-expanded', !isCollapsed);
  };

  toggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  header?.addEventListener('click', toggle);

  document.getElementById('btnBackToGlobal')?.addEventListener('click', (e) => {
    e.stopPropagation();
    import('../tools/selection.js').then(m => {
      state.selectedIds = [];
      m.updateSelectionUI();
    });
  });
}
