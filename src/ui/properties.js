import { state, TYPE_CONFIG } from '../config/state.js';
import { addFeatures } from '../config/store.js';
import { fmtLen, fmtArea, fmtVol } from '../utils/geo.js';
import { pushHistory, getFeatureCenter } from '../tools/interaction.js';
import { refreshMap } from '../map/core.js';
import { toast } from './toolbar.js';
import { deleteSelection, groupSelectedFeatures, ungroupSelectedFeatures } from '../tools/selection.js';
import { generateBuildingParts } from '../models/buildings.js';
import { generateFurnitureParts } from '../models/furniture.js';
import { rebuildLineGeometry } from '../models/roads.js';
import { rebuildPolygonGeometry, rebuildRadiusGeometry } from '../models/zones.js';

export function showPropsPanel(feat, lngLat) {
  const p = feat.properties, cfg = TYPE_CONFIG[p.type] || {};
  const ps = document.getElementById('propsSection');
  if (ps) ps.classList.remove('hidden');
  const form = document.getElementById('propsForm');
  if (!form) return;

  const measHTML = buildMeasureHTML(feat);

  let fields = `
    <div class="form-field"><label>Nombre</label><input type="text" id="prop-name" value="${p.name || ''}" /></div>
    ${measHTML}`;

  if (['house', 'building'].includes(p.type)) {
    if (!p.osm_id) {
      fields += `
        <div class="form-field"><label>Ancho (m)</label><input type="number" id="prop-w" value="${p.width_m || 10}" min="2" max="500" step="0.1"/></div>
        <div class="form-field"><label>Largo (m)</label><input type="number" id="prop-l" value="${p.length_m || 10}" min="2" max="500" step="0.1"/></div>
      `;
    }
    
    fields += `
      <div class="form-field"><label>Altura (m)</label><input type="number" id="prop-height" value="${p.height || 5}" min="1" max="600" step="0.1"/></div>
      <div class="form-field"><label>Pisos</label><input type="number" id="prop-floors" value="${p.floors || 1}" min="1" max="200"/></div>
    `;

    if (!p.osm_id) {
      fields += `
        <div class="form-field">
          <label>Rotación: <span id="propRotLabel">${Math.round(p.rotation || 0)}°</span></label>
          <input type="range" id="prop-rotation" min="0" max="359" step="1" value="${p.rotation || 0}" style="width:100%"/>
        </div>
      `;
    }

    fields += `
      <div class="form-field"><label>Uso de suelo</label><select id="prop-uso">
        <option value="habitacional" ${p.uso_suelo === 'habitacional' ? 'selected' : ''}>Habitacional</option>
        <option value="comercial"    ${p.uso_suelo === 'comercial' ? 'selected' : ''}>Comercial</option>
        <option value="mixto"        ${p.uso_suelo === 'mixto' ? 'selected' : ''}>Mixto</option>
        <option value="industrial"   ${p.uso_suelo === 'industrial' ? 'selected' : ''}>Industrial</option>
      </select></div>
    `;
  } else if (p.type === 'custom_building') {
    fields += `
      <div class="form-field"><label>Altura (m)</label><input type="number" id="prop-height" value="${p.height || 30}" min="1" max="600" step="0.1"/></div>
      <div class="form-field"><label>Pisos</label><input type="number" id="prop-floors" value="${p.floors || 10}" min="1" max="200"/></div>
      <div class="form-field"><label>Uso de suelo</label><select id="prop-uso">
        <option value="habitacional" ${p.uso_suelo === 'habitacional' ? 'selected' : ''}>Habitacional</option>
        <option value="comercial"    ${p.uso_suelo === 'comercial' ? 'selected' : ''}>Comercial</option>
        <option value="mixto"        ${p.uso_suelo === 'mixto' ? 'selected' : ''}>Mixto</option>
        <option value="industrial"   ${p.uso_suelo === 'industrial' ? 'selected' : ''}>Industrial</option>
      </select></div>`;
  } else if (p.type === 'radius') {
    fields += `
      <div class="form-field">
        <label>Alcance (Radio): <span id="propRadLabel">${p.radius_m || 400}</span>m</label>
        <input type="range" id="prop-radius" min="50" max="5000" step="50" value="${p.radius_m || 400}" style="width:100%"/>
      </div>`;
  }
  if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(p.type)) {
    if (p.type === 'water') {
      fields += `<div class="form-field"><label>Profundidad (m)</label><input type="number" id="prop-water-depth" value="${p.depth_m || 2}" min="0.5" max="500" step="0.5"/></div>`;
    }
    if (['terrain', 'zone'].includes(p.type)) {
      fields += `<div class="form-field"><label>Altura Máx. (m)</label><input type="number" id="prop-max-height" value="${p.maxHeight || ''}" placeholder="Sin límite" min="1" max="500" step="0.5"/></div>`;
      fields += `<div class="form-field"><label>CAS Mínimo (%)</label><input type="number" id="prop-min-cas" value="${p.minCAS || ''}" placeholder="Ej. 20" min="0" max="100" step="1"/></div>`;
      fields += `<div class="form-field"><label>Retiro Mín (m)</label><input type="number" id="prop-min-setback" value="${p.minSetback || ''}" placeholder="Ej. 3" min="0" max="50" step="0.5"/></div>`;
    }
    fields += `
      <div class="form-field opt-toggle" style="margin-top:6px;">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="prop-poly-curved" ${p.curved ? 'checked' : ''} style="display:none;" />
          <span class="toggle-track" style="margin:0"><span class="toggle-thumb"></span></span>
          <span style="font-size:11px;color:var(--text-primary);font-weight:500;">Curvas suaves</span>
        </label>
      </div>`;
  }
  if (['furniture'].includes(p.type)) {
    fields += `
      <div class="form-field">
        <label>Rotación: <span id="propRotLabel">${Math.round(p.rotation || 0)}°</span></label>
        <input type="range" id="prop-rotation" min="0" max="359" step="5" value="${Math.round(p.rotation || 0)}" style="width:100%"/>
      </div>`;
  }
  if (['road', 'path', 'sidewalk', 'railway'].includes(p.type)) {
    if (p.type === 'road') {
      fields += `
        <div class="form-field"><label>Tipo de vía</label><select id="prop-roadType">
          <option value="local"        ${p.roadType === 'local' ? 'selected' : ''}>Local</option>
          <option value="secundaria"   ${p.roadType === 'secundaria' ? 'selected' : ''}>Secundaria</option>
          <option value="primaria"     ${p.roadType === 'primaria' ? 'selected' : ''}>Primaria</option>
          <option value="autopista"    ${p.roadType === 'autopista' ? 'selected' : ''}>Autopista</option>
        </select></div>
        <div class="form-field"><label>Ancho (m)</label><input type="number" id="prop-roadW" value="${p.widthM || 8}" min="2" max="60"/></div>
        <div class="form-field"><label>Carriles</label><input type="number" id="prop-lanes" value="${p.lanes || 2}" min="1" max="16"/></div>`;
    } else {
      fields += `<div class="form-field"><label>Ancho (m)</label><input type="number" id="prop-widthM" value="${p.widthM || 4}" min="0.5" max="20"/></div>`;
    }
    fields += `
      <div class="form-field opt-toggle" style="margin-top:6px;">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="prop-curved" ${p.curved ? 'checked' : ''} style="display:none;" />
          <span class="toggle-track" style="margin:0"><span class="toggle-thumb"></span></span>
          <span style="font-size:11px;color:var(--text-primary);font-weight:500;">Curvas suaves</span>
        </label>
      </div>`;
  }
  fields += `
    <div class="form-field"><label>Color</label><input type="color" id="prop-color" value="${p.fillColor || '#6366f1'}"/></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnApplyProps">Aplicar</button>
      ${p.groupId ? `<button class="btn btn-secondary" id="btnUngroup">Desagrupar</button>` : ''}
      <button class="btn btn-secondary" id="btnDeleteSelected">Borrar</button>
    </div>`;

  form.innerHTML = fields;

  if (['house', 'building'].includes(p.type)) {
    const rotRange = document.getElementById('prop-rotation');
    const rotLabel = document.getElementById('propRotLabel');
    const wIn = document.getElementById('prop-w');
    const lIn = document.getElementById('prop-l');
    const hIn = document.getElementById('prop-height');
    const fIn = document.getElementById('prop-floors');

    const rebuildGeom = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      const h = parseFloat(hIn.value) || 5;

      if (f.properties.osm_id) {
        // Solo actualizar altura, preservar geometría original de OSM
        f.properties.height = h;
        if (fIn) f.properties.floors = Math.round(h / 3.5);
      } else {
        const w = parseFloat(wIn?.value) || 10;
        const l = parseFloat(lIn?.value) || 10;
        const rot = parseFloat(rotRange?.value) || 0;

        const baseId = f.properties.id;
        state.features = state.features.filter(x => !(x.properties.id === baseId || x.properties.parent_id === baseId));
        const newParts = generateBuildingParts(baseId, f.properties.center_lng, f.properties.center_lat, w, l, h, rot, f.properties.type);
        addFeatures(...newParts);
      }

      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };

    rotRange?.addEventListener('input', () => { if (rotLabel) rotLabel.textContent = rotRange.value + '°'; rebuildGeom(); });
    [wIn, lIn, hIn].forEach(el => el?.addEventListener('input', rebuildGeom));
    fIn?.addEventListener('input', () => { if (hIn) hIn.value = Math.round(parseFloat(fIn.value) * 3.5); rebuildGeom(); });
  }

  if (p.type === 'furniture') {
    const rotRange = document.getElementById('prop-rotation');
    const rotLabel = document.getElementById('propRotLabel');
    const rebuildFurn = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      const rot = parseFloat(rotRange.value) || 0;
      f.properties.rotation = rot;
      const oldId = f.properties.id;
      state.features = state.features.filter(x => !(x.properties.id === oldId || x.properties.parent_id === oldId));
      const newParts = generateFurnitureParts(oldId, f.properties.center_lng, f.properties.center_lat, rot, f.properties.furniture_type);
      addFeatures(...newParts);
      refreshMap();
    };
    rotRange?.addEventListener('input', () => { if (rotLabel) rotLabel.textContent = rotRange.value + '°'; rebuildFurn(); });
  }

  if (p.type === 'custom_building') {
    const hIn = document.getElementById('prop-height');
    const fIn = document.getElementById('prop-floors');
    const rebuildCB = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      f.properties.height = parseFloat(hIn.value) || 30;
      f.properties.floors = Math.round(f.properties.height / 3.5);
      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };
    hIn?.addEventListener('input', rebuildCB);
    fIn?.addEventListener('input', () => { if (hIn) hIn.value = Math.round(parseFloat(fIn.value) * 3.5); rebuildCB(); });
  }

  if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(p.type)) {
    const curvedCb = document.getElementById('prop-poly-curved');
    const depthIn = document.getElementById('prop-water-depth');
    const rebuildPoly = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      rebuildPolygonGeometry(f, {
        curved: curvedCb ? curvedCb.checked : undefined,
        depth_m: depthIn ? parseFloat(depthIn.value) || 2 : undefined
      });
      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };
    curvedCb?.addEventListener('change', rebuildPoly);
    depthIn?.addEventListener('input', rebuildPoly);
  }

  if (['road', 'path', 'sidewalk', 'railway'].includes(p.type)) {
    const wIn = document.getElementById('prop-roadW') || document.getElementById('prop-widthM');
    const lIn = document.getElementById('prop-lanes');
    const curvedCb = document.getElementById('prop-curved');

    const rebuildLine = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      rebuildLineGeometry(f, {
        widthM: wIn ? parseFloat(wIn.value) || f.properties.widthM : undefined,
        lanes: lIn ? parseInt(lIn.value) || f.properties.lanes : undefined,
        curved: curvedCb ? curvedCb.checked : undefined
      });
      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };

    if (wIn) {
      if (lIn) {
        lIn.addEventListener('input', () => { wIn.value = (parseFloat(lIn.value) * 3.5).toFixed(1) || 3.5; rebuildLine(); });
        wIn.addEventListener('input', () => { lIn.value = Math.max(1, Math.round(parseFloat(wIn.value) / 3.5)) || 1; rebuildLine(); });
      } else {
        wIn.addEventListener('input', rebuildLine);
      }
      curvedCb?.addEventListener('change', rebuildLine);
    }
  }

  if (p.type === 'radius') {
    const radRange = document.getElementById('prop-radius');
    const radLabel = document.getElementById('propRadLabel');
    const rebuildRad = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      const center = getFeatureCenter(f);
      if (!center) return;
      rebuildRadiusGeometry(f, center, parseFloat(radRange.value) || 400);
      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };
    radRange?.addEventListener('input', () => { if (radLabel) radLabel.textContent = radRange.value; rebuildRad(); });
  }

  document.getElementById('btnApplyProps')?.addEventListener('click', () => {
    // ... same code as before (shortened for chunk match if needed)
    // Actually I'll keep it exactly to match correctly.
    pushHistory();
    const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
    if (!f) return;
    f.properties.name = document.getElementById('prop-name').value;
    if (document.getElementById('prop-uso')) f.properties.uso_suelo = document.getElementById('prop-uso').value;
    if (document.getElementById('prop-roadType')) f.properties.roadType = document.getElementById('prop-roadType').value;
    if (document.getElementById('prop-height')) {
      const h = parseFloat(document.getElementById('prop-height').value) || f.properties.height;
      f.properties.height = h;
      if (document.getElementById('prop-floors')) f.properties.floors = parseInt(document.getElementById('prop-floors').value);
    }
    if (document.getElementById('prop-roadW')) {
      rebuildLineGeometry(f, {
        widthM: parseFloat(document.getElementById('prop-roadW').value) || 8,
        lanes: document.getElementById('prop-lanes') ? parseInt(document.getElementById('prop-lanes').value) : undefined
      });
    }
    if (document.getElementById('prop-curved')) {
      rebuildLineGeometry(f, { curved: document.getElementById('prop-curved').checked });
    }
    if (document.getElementById('prop-poly-curved')) {
      rebuildPolygonGeometry(f, { curved: document.getElementById('prop-poly-curved').checked });
    }
    if (document.getElementById('prop-max-height')) {
      f.properties.maxHeight = parseFloat(document.getElementById('prop-max-height').value) || null;
    }
    if (document.getElementById('prop-min-cas')) {
      f.properties.minCAS = parseFloat(document.getElementById('prop-min-cas').value) || null;
    }
    if (document.getElementById('prop-min-setback')) {
      f.properties.minSetback = parseFloat(document.getElementById('prop-min-setback').value) || null;
    }
    const col = document.getElementById('prop-color').value;
    f.properties.fillColor = col; f.properties.color = col;
    refreshMap(); toast('Propiedades actualizadas', 'success');
  });
  document.getElementById('btnDeleteSelected')?.addEventListener('click', deleteSelection);
  document.getElementById('btnUngroup')?.addEventListener('click', ungroupSelectedFeatures);

  state.popup?.remove();
  if (lngLat && state.map) {
    const ctr = getFeatureCenter(feat);
    state.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '220px' })
      .setLngLat(ctr || lngLat)
      .setHTML(`<div class="popup-name">${p.name || cfg.label}</div><div class="popup-type">${cfg.label || p.type}</div>
        <div class="popup-props">
          ${p.width_m ? `<div class="popup-prop"><span class="popup-prop-key">Ancho</span><span class="popup-prop-val">${fmtLen(p.width_m)}</span></div>` : ''}
          ${p.length_m ? `<div class="popup-prop"><span class="popup-prop-key">Largo</span><span class="popup-prop-val">${fmtLen(p.length_m)}</span></div>` : ''}
          ${p.height ? `<div class="popup-prop"><span class="popup-prop-key">Altura</span><span class="popup-prop-val">${p.height}m</span></div>` : ''}
          ${p.area_m2 ? `<div class="popup-prop"><span class="popup-prop-key">Área</span><span class="popup-prop-val">${fmtArea(p.area_m2)}</span></div>` : ''}
        </div>`)
      .addTo(state.map);
  }
}

export function showMultiPropsPanel() {
  const ps = document.getElementById('propsSection');
  if (ps) ps.classList.remove('hidden');
  const form = document.getElementById('propsForm');
  if (!form) return;
  form.innerHTML = `
    <div class="form-field"><label style="font-size:14px;color:var(--accent)">${state.selectedIds.length} objetos seleccionados</label></div>
    <div class="form-field"><label>Color unificado</label><input type="color" id="prop-multi-color" value="#6366f1"/></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnMultiApply">Aplicar Color</button>
      <button class="btn btn-secondary" id="btnMultiGroup">Agrupar Objetos</button>
      <button class="btn btn-secondary" id="btnMultiDelete">Borrar Todos</button>
    </div>`;
  document.getElementById('btnMultiDelete')?.addEventListener('click', deleteSelection);
  document.getElementById('btnMultiGroup')?.addEventListener('click', groupSelectedFeatures);
  document.getElementById('btnMultiApply')?.addEventListener('click', () => {
    pushHistory();
    const col = document.getElementById('prop-multi-color').value;
    state.features.forEach(f => {
      if (state.selectedIds.includes(f.properties.id)) { f.properties.color = col; f.properties.fillColor = col; }
    });
    refreshMap(); toast('Color aplicado a todos', 'success');
  });
  state.popup?.remove(); state.popup = null;
}

export function buildMeasureHTML(feat) {
  const p = feat.properties;
  const isBuilding = ['house', 'building', 'custom_building'].includes(p.type);
  const isRoad = p.type === 'road';
  const isPoly = ['park', 'zone', 'terrain', 'custom_building', 'water'].includes(p.type);
  const items = [];
  if (p.width_m != null && !isRoad) items.push({ val: fmtLen(p.width_m), lbl: 'Ancho' });
  if (p.length_m != null && !isRoad) items.push({ val: fmtLen(p.length_m), lbl: 'Largo' });
  if (p.height != null && isBuilding) items.push({ val: p.height + 'm', lbl: 'Altura' });
  if (['house', 'building'].includes(p.type) && p.width_m && p.length_m && p.height) {
    items.push({ val: fmtArea(p.width_m * p.length_m), lbl: 'Área piso' }, { val: fmtVol(p.width_m * p.length_m * p.height), lbl: 'Volumen' });
  }
  if (isPoly && p.area_m2) {
    items.push({ val: fmtArea(p.area_m2), lbl: 'Área' });
    if (isBuilding && p.height) items.push({ val: fmtVol(p.area_m2 * p.height), lbl: 'Volumen' });
  }
  if (p.type === 'water') {
    if (p.depth_m) items.push({ val: p.depth_m + 'm', lbl: 'Profundidad' });
    if (p.volume_m3) items.push({ val: fmtVol(p.volume_m3), lbl: 'Volumen' });
  }
  if (isPoly && p.perimeter_m) items.push({ val: fmtLen(p.perimeter_m), lbl: 'Perímetro' });
  if (isRoad && p.length_m) items.push({ val: fmtLen(p.length_m), lbl: 'Longitud' }, { val: (p.widthM || 8) + 'm', lbl: 'Ancho' });
  if (!items.length) return '';
  return `<div class="measure-card" id="liveMeasures">
    <div class="measure-title">Medidas</div>
    <div class="measure-grid">
      ${items.map(i => `<div class="measure-item"><div class="measure-val">${i.val}</div><div class="measure-unit">${i.lbl}</div></div>`).join('')}
    </div>
  </div>`;
}
