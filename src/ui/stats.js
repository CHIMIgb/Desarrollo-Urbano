import { state } from '../config/state.js';
import { polygonArea, fmtArea } from '../utils/geo.js';

/**
 * Lógica de cálculo y actualización del Dashboard de Métricas Urbanas.
 * Se encarga de analizar todas las entidades del mapa y extraer ratios normativos.
 */
export function updateGlobalStats() {
  const dashboard = document.getElementById('stats-dashboard');
  if (!dashboard) return;

  let totalTerrainArea = 0;
  let occupiedArea = 0;      // Área de desplante (pisada) de edificios
  let totalBuiltArea = 0;     // Área total (desplante * niveles)
  let greenArea = 0;          // Áreas de parques y agua

  state.features.forEach(f => {
    const type = f.properties.type;
    const geom = f.geometry;
    
    // Ignorar si no tiene geometría de polígono válida
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return;
    
    // El cálculo de área necesita las coordenadas del anillo exterior
    const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
    const area = polygonArea(coords);

    if (type === 'terrain') {
      totalTerrainArea += area;
    } else if (['building', 'house', 'custom_building'].includes(type)) {
      // Evitar contar hijos de edificios (ventanas, techos) para no duplicar área
      if (f.properties.parent_id) return;
      
      occupiedArea += area;
      const floors = f.properties.floors || 1;
      totalBuiltArea += (area * floors);
    } else if (['park', 'water'].includes(type)) {
      greenArea += area;
    }
  });

  // Actualizar UI
  const elTerrain = document.getElementById('val-terrain-area');
  const elCos = document.getElementById('val-cos');
  const elCus = document.getElementById('val-cus');
  const elGreen = document.getElementById('val-green');
  const elPop = document.getElementById('val-pop');

  const barCos = document.getElementById('bar-cos');
  const barCus = document.getElementById('bar-cus');
  const barGreen = document.getElementById('bar-green');

  if (elTerrain) elTerrain.textContent = fmtArea(totalTerrainArea);

  if (totalTerrainArea > 0) {
    const cosValue = (occupiedArea / totalTerrainArea) * 100;
    const cusValue = totalBuiltArea / totalTerrainArea;
    const greenRatio = (greenArea / totalTerrainArea) * 100;
    const estimatedPop = Math.floor(totalBuiltArea / 35); // 35m2 por persona

    if (elCos) {
      elCos.textContent = `${cosValue.toFixed(1)}%`;
      elCos.classList.toggle('exceeded', cosValue > 70); // Alerta si > 70%
    }
    if (barCos) barCos.style.width = `${Math.min(cosValue, 100)}%`;

    if (elCus) {
      elCus.textContent = cusValue.toFixed(2);
      elCus.classList.toggle('exceeded', cusValue > 3.0); // Alerta si densidad extrema
    }
    if (barCus) barCus.style.width = `${Math.min((cusValue / 4) * 100, 100)}%`;

    if (elGreen) elGreen.textContent = `${greenRatio.toFixed(1)}%`;
    if (barGreen) barGreen.style.width = `${Math.min(greenRatio, 100)}%`;

    if (elPop) elPop.textContent = `${estimatedPop.toLocaleString()} hab.`;
    
    dashboard.classList.remove('no-terrain');
  } else {
    // Si no hay terreno, resetear a cero o mostrar aviso
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
