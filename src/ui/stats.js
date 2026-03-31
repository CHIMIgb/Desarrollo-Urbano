import { state } from '../config/state.js';
import { polygonArea, fmtArea, isPointInPolygon, getFeatureCenter } from '../utils/geo.js';

/**
 * Lógica de cálculo y actualización del Dashboard de Métricas Urbanas.
 * Se encarga de analizar todas las entidades del mapa y extraer ratios normativos (Global e Individual).
 */
export function updateGlobalStats() {
  const dashboard = document.getElementById('stats-dashboard');
  if (!dashboard) return;

  const lotListEl = document.getElementById('lot-list');
  const breakdownContainer = document.getElementById('stats-breakdown');

  // --- 1. PREPARACIÓN DE DATOS ---
  const terrainFeatures = state.features.filter(f => f.properties.type === 'terrain');
  const selectedTerrainIds = new Set(state.selectedIds.filter(id => {
    const f = state.features.find(x => x.properties.id === id);
    return f && f.properties.type === 'terrain';
  }));

  // Estructura para almacenar métricas por cada lote
  const lotsMetrics = terrainFeatures.map(t => {
    const coords = t.geometry.type === 'Polygon' ? t.geometry.coordinates[0] : t.geometry.coordinates[0][0];
    return {
      id: t.properties.id,
      name: t.properties.name || `Lote ${t.properties.id}`,
      baseArea: polygonArea(coords),
      coords: coords,
      occupiedArea: 0,
      totalBuiltArea: 0,
      greenArea: 0,
      isSelected: selectedTerrainIds.has(t.properties.id)
    };
  });

  // Métricas Globales
  let globalBaseArea = 0;
  let globalOccupiedArea = 0;
  let globalTotalBuiltArea = 0;
  let globalGreenArea = 0;

  // --- 2. PROCESAMIENTO ESPACIAL (UNA SOLA PASADA) ---
  state.features.forEach(f => {
    const type = f.properties.type;
    const geom = f.geometry;
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return;
    
    const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
    const area = polygonArea(coords);

    // Cálculos Globales
    if (type === 'terrain') {
      globalBaseArea += area;
    } else if (['building', 'house', 'custom_building'].includes(type) && !f.properties.parent_id) {
      globalOccupiedArea += area;
      globalTotalBuiltArea += (area * (f.properties.floors || 1));
    } else if (['park', 'water'].includes(type)) {
      globalGreenArea += area;
    }

    // Cálculos Individuales (Point-in-Polygon)
    if (type !== 'terrain') {
      const center = getFeatureCenter(f);
      if (center) {
        lotsMetrics.forEach(lot => {
          if (isPointInPolygon([center.lng, center.lat], lot.coords)) {
            if (['building', 'house', 'custom_building'].includes(type) && !f.properties.parent_id) {
              lot.occupiedArea += area;
              lot.totalBuiltArea += (area * (f.properties.floors || 1));
            } else if (['park', 'water'].includes(type)) {
              lot.greenArea += area;
            }
          }
        });
      }
    }
  });

  // --- 3. ACTUALIZACIÓN UI ---
  
  // A. Actualizar Sección Resumen (Si hay selección de terreno, priorizar ese; si no, global)
  const activeFocus = lotsMetrics.find(l => l.isSelected) || {
    baseArea: globalBaseArea,
    occupiedArea: globalOccupiedArea,
    totalBuiltArea: globalTotalBuiltArea,
    greenArea: globalGreenArea,
    isGlobal: true
  };

  updateSummaryUI(activeFocus);

  // B. Renderizar Desglose por Lote
  if (breakdownContainer) {
    breakdownContainer.style.display = terrainFeatures.length > 0 ? 'block' : 'none';
    renderLotBreakdown(lotsMetrics);
  }
}

/**
 * Renderiza la lista de tarjetas de lotes individuales.
 */
function renderLotBreakdown(lots) {
  const listEl = document.getElementById('lot-list');
  if (!listEl) return;

  if (lots.length === 0) {
    listEl.innerHTML = '<div style="font-size:11px; opacity:0.5; padding:10px">No hay terrenos definidos.</div>';
    return;
  }

  listEl.innerHTML = lots.map(lot => {
    const cos = lot.baseArea > 0 ? (lot.occupiedArea / lot.baseArea) * 100 : 0;
    const cus = lot.baseArea > 0 ? (lot.totalBuiltArea / lot.baseArea) : 0;
    
    return `
      <div class="lot-card ${lot.isSelected ? 'selected' : ''}" data-id="${lot.id}">
        <div class="lot-card-header">
          <span class="lot-name">${lot.name}</span>
          <button class="btn-locate-lot" title="Centrar cámara en este lote" data-id="${lot.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
            </svg>
          </button>
        </div>
        <div class="lot-grid">
          <div class="lot-sub-stat">
            <span class="lot-sub-label">COS</span>
            <span class="lot-sub-val ${cos > 75 ? 'alert' : ''}">${cos.toFixed(1)}%</span>
          </div>
          <div class="lot-sub-stat">
            <span class="lot-sub-label">CUS</span>
            <span class="lot-sub-val ${cus > 4.0 ? 'alert' : ''}">${cus.toFixed(2)}</span>
          </div>
          <div class="lot-sub-stat">
            <span class="lot-sub-label">Área</span>
            <span class="lot-sub-val">${fmtArea(lot.baseArea)}</span>
          </div>
          <div class="lot-sub-stat">
            <span class="lot-sub-label">Verde</span>
            <span class="lot-sub-val">${((lot.greenArea / lot.baseArea) * 100 || 0).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Eventos de clic para seleccionar lote desde el dashboard
  listEl.querySelectorAll('.lot-card').forEach(card => {
    card.onclick = (e) => {
      const id = parseInt(card.dataset.id);
      import('../tools/selection.js').then(m => m.selectFeature(id, null));
    };

    // Botón de localización (Fly-to)
    const btnLocate = card.querySelector('.btn-locate-lot');
    if (btnLocate) {
      btnLocate.onclick = (e) => {
        e.stopPropagation(); // Evitar que el clic en el botón también dispare la selección del lote si no es deseado
        const id = parseInt(btnLocate.dataset.id);
        const feature = state.features.find(f => f.properties.id === id);
        if (feature && state.map) {
          const center = getFeatureCenter(feature);
          if (center) {
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
 * Actualiza la parte superior (resumen) del Dashboard.
 */
function updateSummaryUI(data) {
  const dashboard = document.getElementById('stats-dashboard');
  const titleEl = document.querySelector('.stats-title');
  const elTerrain = document.getElementById('val-terrain-area');
  const elCos = document.getElementById('val-cos');
  const elCus = document.getElementById('val-cus');
  const elGreen = document.getElementById('val-green');
  const elPop = document.getElementById('val-pop');

  const barCos = document.getElementById('bar-cos');
  const barCus = document.getElementById('bar-cus');
  const barGreen = document.getElementById('bar-green');

  if (titleEl) {
    titleEl.style.cursor = data.isGlobal ? 'default' : 'pointer';
    titleEl.title = data.isGlobal ? '' : 'Haga clic para volver a Vista Global';
    
    titleEl.innerHTML = data.isGlobal 
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Métricas Globales`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> ${data.name}`;

    // Click en título para volver a Global
    titleEl.onclick = (e) => {
      if (!data.isGlobal) {
        e.stopPropagation();
        import('../tools/selection.js').then(m => {
          state.selectedIds = [];
          m.updateSelectionUI();
        });
      }
    };
  }

  if (elTerrain) elTerrain.textContent = fmtArea(data.baseArea);

  if (data.baseArea > 0) {
    const cosValue = (data.occupiedArea / data.baseArea) * 100;
    const cusValue = data.totalBuiltArea / data.baseArea;
    const greenRatio = (data.greenArea / data.baseArea) * 100;
    const estimatedPop = Math.floor(data.totalBuiltArea / 35); 

    if (elCos) {
      elCos.textContent = `${cosValue.toFixed(1)}%`;
      elCos.classList.toggle('exceeded', cosValue > 75); 
    }
    if (barCos) barCos.style.width = `${Math.min(cosValue, 100)}%`;

    if (elCus) {
      elCus.textContent = cusValue.toFixed(2);
      elCus.classList.toggle('exceeded', cusValue > 4.0); 
    }
    if (barCus) barCus.style.width = `${Math.min((cusValue / 4) * 100, 100)}%`;

    if (elGreen) elGreen.textContent = `${greenRatio.toFixed(1)}%`;
    if (barGreen) barGreen.style.width = `${Math.min(greenRatio, 100)}%`;

    if (elPop) elPop.textContent = `${estimatedPop.toLocaleString()} hab.`;
    
    dashboard.classList.remove('no-terrain');
  } else {
    if (elCos) elCos.textContent = '0%';
    if (elCus) elCus.textContent = '0.0';
    if (elGreen) elGreen.textContent = '0%';
    if (elPop) elPop.textContent = '0 hab.';
    [barCos, barCus, barGreen].forEach(b => { if (b) b.style.width = '0%'; });
    dashboard.classList.add('no-terrain');
  }
}

/**
 * Inicializa los eventos de interacción del dashboard (colapsar/expandir).
 */
export function initStatsEvents() {
  const toggleBtn = document.getElementById('btnStatsToggle');
  const header = document.getElementById('stats-header');
  const dashboard = document.getElementById('stats-dashboard');

  const toggle = () => {
    dashboard?.classList.toggle('collapsed');
  };

  toggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  header?.addEventListener('click', toggle);
}
