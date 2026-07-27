/* =============================================================
   PANEL DE PRECISIÓN — UI para Edición de Grado de Ingeniería
   Panel flotante que permite ingresar dimensiones exactas:
   distancia, ángulo, coordenadas geográficas.
   ============================================================= */
import { state } from '../config/state.js';
import { toast } from './toolbar.js';
import {
  moveVertexByPolar,
  moveVertexToCoord,
  moveFeatureByPolar,
  moveFeatureToCoord,
  getVertexInfo,
  bearingBetween,
} from '../tools/precision.js';
import { haversine } from '../utils/geo.js';

// ── Estado interno del panel de precisión ─────────────────────
const precisionState = {
  isOpen: false,
  selectedVertexIdx: null,
  isCollapsed: false,
};

function setVertexSelection(idx) {
  precisionState.selectedVertexIdx = idx;
  state.selectedVertexIdx = idx;
  import('../tools/selection.js').then((m) => m.updateEditHandles());
}

// ── Inicialización ────────────────────────────────────────────

export function initPrecisionPanel() {
  if (!state.map) return;

  // Crear estructura HTML del panel
  const container = document.getElementById('precisionPanel');
  if (!container) return;

  container.innerHTML = buildPanelHTML();

  // Bind del botón toggle (colapsar/expandir)
  document.getElementById('precisionToggleBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    precisionState.isCollapsed = !precisionState.isCollapsed;
    container.classList.toggle('collapsed', precisionState.isCollapsed);
  });

  document.getElementById('precisionHeader')?.addEventListener('click', () => {
    precisionState.isCollapsed = !precisionState.isCollapsed;
    container.classList.toggle('collapsed', precisionState.isCollapsed);
  });

  // Escuchar clicks en edit-handles para seleccionar vértice
  state.map.on('click', 'layer-edit-handles', (e) => {
    if (e.features && e.features.length > 0) {
      const idx = e.features[0].properties.idx;
      setVertexSelection(idx);
      openPanel();
      updatePanelContent();
    }
  });

  // Escuchar cualquier click en el mapa para verificar cambios de selección
  state.map.on('click', () => {
    setTimeout(() => updatePanelVisibility(), 50);
  });

  // También actualizar cuando cambian los edit handles (drag end)
  state.map.on('mouseup', () => {
    setTimeout(() => {
      if (precisionState.isOpen) updatePanelContent();
    }, 50);
  });

  // Botones de acción
  bindActionButtons();

  // Estado inicial: oculto
  container.classList.add('hidden');
}

// ── Visibilidad del Panel ─────────────────────────────────────

function updatePanelVisibility() {
  const container = document.getElementById('precisionPanel');
  if (!container) return;

  const hasSelection = state.selectedIds.length === 1;
  const feat = hasSelection
    ? state.features.find((f) => f.properties.id === state.selectedIds[0])
    : null;

  // El panel es relevante solo cuando hay 1 feature seleccionada con vértices editables
  const hasEditableVertices = feat && feat.properties.raw_pts && feat.properties.raw_pts.length > 0;

  if (hasSelection && hasEditableVertices) {
    if (!precisionState.isOpen) openPanel();
    updatePanelContent();
  } else if (hasSelection && feat) {
    // Feature sin raw_pts (ej: house/building parametric) — solo operaciones de feature
    setVertexSelection(null);
    if (!precisionState.isOpen) openPanel();
    updatePanelContent();
  } else {
    closePanel();
  }
}

function openPanel() {
  const container = document.getElementById('precisionPanel');
  if (!container) return;
  container.classList.remove('hidden');
  precisionState.isOpen = true;
}

function closePanel() {
  const container = document.getElementById('precisionPanel');
  if (!container) return;
  container.classList.add('hidden');
  precisionState.isOpen = false;
  setVertexSelection(null);
}

// ── Contenido Dinámico ────────────────────────────────────────

function updatePanelContent() {
  if (!precisionState.isOpen || state.selectedIds.length !== 1) return;

  const featureId = state.selectedIds[0];
  const feat = state.features.find((f) => f.properties.id === featureId);
  if (!feat) return;

  const hasVertices = feat.properties.raw_pts && feat.properties.raw_pts.length > 0;

  // Actualizar selector de vértices
  updateVertexSelector(feat);

  // Actualizar info del vértice seleccionado
  updateVertexInfo(feat);

  // Mostrar/ocultar secciones de vértice
  const vertexSections = document.querySelectorAll('.prec-vertex-section');
  vertexSections.forEach((s) => {
    s.style.display = hasVertices ? 'block' : 'none';
  });

  // Actualizar la sección "Mover Elemento Completo" con centro actual
  updateFeatureInfo(feat);
}

function updateVertexSelector(feat) {
  const select = document.getElementById('precVertexSelect');
  if (!select) return;

  const pts = feat.properties.raw_pts || [];
  const currentVal = select.value;

  select.innerHTML = '<option value="-1">— Seleccionar vértice —</option>';
  pts.forEach((pt, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `V${idx + 1} (${pt[1].toFixed(6)}, ${pt[0].toFixed(6)})`;
    select.appendChild(opt);
  });

  // Restaurar selección
  if (precisionState.selectedVertexIdx !== null && precisionState.selectedVertexIdx < pts.length) {
    select.value = precisionState.selectedVertexIdx;
  } else if (currentVal !== '-1' && parseInt(currentVal) < pts.length) {
    select.value = currentVal;
    setVertexSelection(parseInt(currentVal));
  }
}

function updateVertexInfo(feat) {
  const infoContainer = document.getElementById('precVertexInfo');
  if (!infoContainer) return;

  const featureId = feat.properties.id;
  const idx = precisionState.selectedVertexIdx;

  if (
    idx === null ||
    idx < 0 ||
    !feat.properties.raw_pts ||
    idx >= feat.properties.raw_pts.length
  ) {
    infoContainer.innerHTML =
      '<div class="prec-hint">Haz clic en un vértice del mapa o selecciona uno arriba</div>';
    // Limpiar inputs de coordenadas exactas
    const latIn = document.getElementById('precExactLat');
    const lngIn = document.getElementById('precExactLng');
    if (latIn) latIn.value = '';
    if (lngIn) lngIn.value = '';
    return;
  }

  const info = getVertexInfo(featureId, idx);
  if (!info) {
    infoContainer.innerHTML = '<div class="prec-hint">Vértice no disponible</div>';
    return;
  }

  // Formatear distancias
  const fmtDist = (d) =>
    d != null ? (d >= 1000 ? (d / 1000).toFixed(3) + ' km' : d.toFixed(2) + ' m') : '—';
  const fmtAngle = (a) => (a != null ? a.toFixed(1) + '°' : '—');

  infoContainer.innerHTML = `
    <div class="prec-info-grid">
      <div class="prec-info-item">
        <span class="prec-info-label">Coordenada</span>
        <span class="prec-info-value prec-mono">${info.lat.toFixed(6)}, ${info.lng.toFixed(6)}</span>
      </div>
      <div class="prec-info-item">
        <span class="prec-info-label">Dist. anterior</span>
        <span class="prec-info-value">${fmtDist(info.distPrev)}</span>
      </div>
      <div class="prec-info-item">
        <span class="prec-info-label">Dist. siguiente</span>
        <span class="prec-info-value">${fmtDist(info.distNext)}</span>
      </div>
      <div class="prec-info-item">
        <span class="prec-info-label">Rumbo entrada</span>
        <span class="prec-info-value">${fmtAngle(info.bearingFromPrev)}</span>
      </div>
      <div class="prec-info-item">
        <span class="prec-info-label">Rumbo salida</span>
        <span class="prec-info-value">${fmtAngle(info.bearingToNext)}</span>
      </div>
      <div class="prec-info-item">
        <span class="prec-info-label">Ángulo interior</span>
        <span class="prec-info-value prec-accent">${fmtAngle(info.interiorAngle)}</span>
      </div>
    </div>
  `;

  // Rellenar inputs de coordenadas exactas con la posición actual
  const latIn = document.getElementById('precExactLat');
  const lngIn = document.getElementById('precExactLng');
  if (latIn && !latIn.matches(':focus')) latIn.value = info.lat.toFixed(6);
  if (lngIn && !lngIn.matches(':focus')) lngIn.value = info.lng.toFixed(6);
}

function updateFeatureInfo(feat) {
  const g = feat.geometry;
  let center = null;

  if (g.type === 'Point') center = { lng: g.coordinates[0], lat: g.coordinates[1] };
  else if (g.type === 'LineString') {
    const m = Math.floor(g.coordinates.length / 2);
    center = { lng: g.coordinates[m][0], lat: g.coordinates[m][1] };
  } else if (g.type === 'Polygon') {
    const c = g.coordinates[0];
    center = {
      lng: c.reduce((s, p) => s + p[0], 0) / c.length,
      lat: c.reduce((s, p) => s + p[1], 0) / c.length,
    };
  }

  const featureCenterEl = document.getElementById('precFeatureCenter');
  if (featureCenterEl && center) {
    featureCenterEl.textContent = `Centro: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
  }

  // Rellenar coordenadas de destino del feature
  const fLatIn = document.getElementById('precFeatureLat');
  const fLngIn = document.getElementById('precFeatureLng');
  if (fLatIn && !fLatIn.matches(':focus') && center) fLatIn.value = center.lat.toFixed(6);
  if (fLngIn && !fLngIn.matches(':focus') && center) fLngIn.value = center.lng.toFixed(6);
}

// ── Acciones ──────────────────────────────────────────────────

function bindActionButtons() {
  // Selector de vértice (dropdown)
  document.getElementById('precVertexSelect')?.addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    setVertexSelection(val >= 0 ? val : null);
    updatePanelContent();

    // Volar al vértice en el mapa para visualizarlo
    if (precisionState.selectedVertexIdx !== null && state.selectedIds.length === 1) {
      const feat = state.features.find((f) => f.properties.id === state.selectedIds[0]);
      if (
        feat &&
        feat.properties.raw_pts &&
        feat.properties.raw_pts[precisionState.selectedVertexIdx]
      ) {
        const pt = feat.properties.raw_pts[precisionState.selectedVertexIdx];
        state.map.easeTo({ center: pt, duration: 500 });
      }
    }
  });

  // Botón: Mover vértice por polar
  document.getElementById('btnPrecMoveVertexPolar')?.addEventListener('click', () => {
    if (state.selectedIds.length !== 1 || precisionState.selectedVertexIdx === null) {
      toast('Selecciona un vértice primero', 'error');
      return;
    }

    const distIn = document.getElementById('precVertexDist');
    const angIn = document.getElementById('precVertexAngle');
    const dist = parseFloat(distIn?.value);
    const angle = parseFloat(angIn?.value);

    if (isNaN(dist) || dist <= 0) {
      toast('Distancia inválida (mínimo 0.1)', 'error');
      return;
    }
    if (isNaN(angle)) {
      toast('Ángulo requerido', 'error');
      return;
    }

    const ok = moveVertexByPolar(
      state.selectedIds[0],
      precisionState.selectedVertexIdx,
      dist,
      angle
    );
    if (ok) {
      toast(`V${precisionState.selectedVertexIdx + 1} desplazado ${dist}m @ ${angle}°`, 'success');
      updatePanelContent();
    } else {
      toast('No se pudo desplazar el vértice', 'error');
    }
  });

  // Botón: Mover vértice a coordenada exacta
  document.getElementById('btnPrecMoveVertexCoord')?.addEventListener('click', () => {
    if (state.selectedIds.length !== 1 || precisionState.selectedVertexIdx === null) {
      toast('Selecciona un vértice primero', 'error');
      return;
    }

    const latIn = document.getElementById('precExactLat');
    const lngIn = document.getElementById('precExactLng');
    const lat = parseFloat(latIn?.value);
    const lng = parseFloat(lngIn?.value);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast('Latitud fuera de rango (-90 a 90)', 'error');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      toast('Longitud fuera de rango (-180 a 180)', 'error');
      return;
    }

    const ok = moveVertexToCoord(state.selectedIds[0], precisionState.selectedVertexIdx, lng, lat);
    if (ok) {
      toast(`V${precisionState.selectedVertexIdx + 1} ubicado en coordenada exacta`, 'success');
      updatePanelContent();
    } else {
      toast('No se pudo reposicionar el vértice', 'error');
    }
  });

  // Botón: Mover feature por polar
  document.getElementById('btnPrecMoveFeaturePolar')?.addEventListener('click', () => {
    if (state.selectedIds.length !== 1) {
      toast('Selecciona un elemento', 'error');
      return;
    }

    const distIn = document.getElementById('precFeatureDist');
    const angIn = document.getElementById('precFeatureAngle');
    const dist = parseFloat(distIn?.value);
    const angle = parseFloat(angIn?.value);

    if (isNaN(dist) || dist <= 0) {
      toast('Distancia inválida (mínimo 0.1)', 'error');
      return;
    }
    if (isNaN(angle)) {
      toast('Ángulo requerido', 'error');
      return;
    }

    const ok = moveFeatureByPolar(state.selectedIds[0], dist, angle);
    if (ok) {
      toast(`Elemento desplazado ${dist}m a ${angle}°`, 'success');
      updatePanelContent();
    } else {
      toast('No se pudo desplazar el elemento', 'error');
    }
  });

  // Botón: Mover feature a coordenada
  document.getElementById('btnPrecMoveFeatureCoord')?.addEventListener('click', () => {
    if (state.selectedIds.length !== 1) {
      toast('Selecciona un elemento', 'error');
      return;
    }

    const latIn = document.getElementById('precFeatureLat');
    const lngIn = document.getElementById('precFeatureLng');
    const lat = parseFloat(latIn?.value);
    const lng = parseFloat(lngIn?.value);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast('Latitud fuera de rango (-90 a 90)', 'error');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      toast('Longitud fuera de rango (-180 a 180)', 'error');
      return;
    }

    const ok = moveFeatureToCoord(state.selectedIds[0], lng, lat);
    if (ok) {
      toast('Elemento ubicado en coordenada exacta', 'success');
      updatePanelContent();
    } else {
      toast('No se pudo reposicionar el elemento', 'error');
    }
  });

  // Atajos de teclado rápidos: Enter en los inputs ejecuta la acción
  ['precVertexDist', 'precVertexAngle'].forEach((id) => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnPrecMoveVertexPolar')?.click();
    });
  });

  ['precExactLat', 'precExactLng'].forEach((id) => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnPrecMoveVertexCoord')?.click();
    });
  });

  ['precFeatureDist', 'precFeatureAngle'].forEach((id) => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnPrecMoveFeaturePolar')?.click();
    });
  });

  ['precFeatureLat', 'precFeatureLng'].forEach((id) => {
    document.getElementById(id)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnPrecMoveFeatureCoord')?.click();
    });
  });
}

// ── Estructura HTML ───────────────────────────────────────────

function buildPanelHTML() {
  return `
    <div class="prec-header" id="precisionHeader">
      <div class="prec-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 3L3 21M21 3H14M21 3v7"/>
          <path d="M14 15l3 3-3 3M15 18H3M9 3L6 6l3 3M6 6h12" opacity="0.5"/>
        </svg>
        Edición Precisa
      </div>
      <button class="prec-toggle" id="precisionToggleBtn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>

    <div class="prec-body" id="precisionBody">
      <!-- SECCIÓN: Selección de Vértice -->
      <div class="prec-section prec-vertex-section">
        <div class="prec-section-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
          </svg>
          Vértice
        </div>
        <select id="precVertexSelect" class="prec-select">
          <option value="-1">— Seleccionar vértice —</option>
        </select>
        <div id="precVertexInfo" class="prec-vertex-info">
          <div class="prec-hint">Haz clic en un vértice del mapa o selecciona uno arriba</div>
        </div>
      </div>

      <!-- SECCIÓN: Mover Vértice por Polar -->
      <div class="prec-section prec-vertex-section">
        <div class="prec-section-label">Desplazar Vértice (Polar)</div>
        <div class="prec-input-row">
          <div class="prec-input-group">
            <label>Distancia</label>
            <div class="prec-input-unit">
              <input type="number" id="precVertexDist" step="0.01" min="0" placeholder="15.5"/>
              <span>m</span>
            </div>
          </div>
          <div class="prec-input-group">
            <label>Ángulo (Rumbo)</label>
            <div class="prec-input-unit">
              <input type="number" id="precVertexAngle" step="0.1" min="0" max="360" placeholder="90"/>
              <span>°</span>
            </div>
          </div>
        </div>
        <div class="prec-compass-hint">0° = Norte · 90° = Este · 180° = Sur · 270° = Oeste</div>
        <button class="btn btn-primary prec-btn" id="btnPrecMoveVertexPolar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          Desplazar Vértice
        </button>
      </div>

      <!-- SECCIÓN: Coordenadas Exactas del Vértice -->
      <div class="prec-section prec-vertex-section">
        <div class="prec-section-label">Coordenadas Exactas</div>
        <div class="prec-input-row">
          <div class="prec-input-group">
            <label>Latitud</label>
            <input type="number" id="precExactLat" step="0.000001" placeholder="19.432600"/>
          </div>
          <div class="prec-input-group">
            <label>Longitud</label>
            <input type="number" id="precExactLng" step="0.000001" placeholder="-99.133200"/>
          </div>
        </div>
        <button class="btn btn-secondary prec-btn" id="btnPrecMoveVertexCoord">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
          Mover a Coordenada
        </button>
      </div>

      <!-- SEPARADOR -->
      <div class="prec-divider"></div>

      <!-- SECCIÓN: Mover Elemento Completo -->
      <div class="prec-section">
        <div class="prec-section-label">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
          </svg>
          Mover Elemento Completo
        </div>
        <div class="prec-feature-center" id="precFeatureCenter">Centro: —</div>
        <div class="prec-input-row">
          <div class="prec-input-group">
            <label>Distancia</label>
            <div class="prec-input-unit">
              <input type="number" id="precFeatureDist" step="0.01" min="0" placeholder="50"/>
              <span>m</span>
            </div>
          </div>
          <div class="prec-input-group">
            <label>Ángulo</label>
            <div class="prec-input-unit">
              <input type="number" id="precFeatureAngle" step="0.1" min="0" max="360" placeholder="0"/>
              <span>°</span>
            </div>
          </div>
        </div>
        <button class="btn btn-primary prec-btn" id="btnPrecMoveFeaturePolar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          Desplazar Elemento
        </button>

        <div class="prec-subsep"></div>

        <div class="prec-input-row">
          <div class="prec-input-group">
            <label>Latitud destino</label>
            <input type="number" id="precFeatureLat" step="0.000001" placeholder="19.432600"/>
          </div>
          <div class="prec-input-group">
            <label>Longitud destino</label>
            <input type="number" id="precFeatureLng" step="0.000001" placeholder="-99.133200"/>
          </div>
        </div>
        <button class="btn btn-secondary prec-btn" id="btnPrecMoveFeatureCoord">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
          Centrar en Coordenada
        </button>
      </div>
    </div>
  `;
}
