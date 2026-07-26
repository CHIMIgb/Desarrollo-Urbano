import { state, publicConfig } from '../config/state.js';
import { escapeHTML } from '../utils/sanitize.js';
import { notify } from './notifications.js';

export function initSearchEvents() {
  let searchTimer;
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  
  if (!searchInput || !searchResults) return;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 3) { searchResults.classList.remove('open'); return; }
    searchTimer = setTimeout(() => doSearch(q), 400);
  });

  searchInput.addEventListener('keydown', e => { 
    if (e.key === 'Escape') { 
      searchResults.classList.remove('open'); 
      searchInput.blur(); 
    } 
  });

  document.addEventListener('click', e => { 
    if (!e.target.closest('.search-box')) searchResults.classList.remove('open'); 
  });
}

async function doSearch(q) {
  const searchResults = document.getElementById('searchResults');
  try {
    const res = await fetch(`${publicConfig.OSM_NOMINATIM_URL}?format=json&limit=5&q=${encodeURIComponent(q)}`, { 
      headers: { 'Accept-Language': 'es' } 
    });
    const data = await res.json();
    searchResults.innerHTML = data.map(r => `
      <div class="search-result-item" data-lng="${r.lon}" data-lat="${r.lat}">
        <strong>${escapeHTML(r.display_name.split(',')[0])}</strong>
        ${escapeHTML(r.display_name.split(',').slice(1, 3).join(','))}
      </div>`).join('');
    searchResults.classList.add('open');
    
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        if (state.map) {
          state.map.flyTo({ 
            center: [parseFloat(item.dataset.lng), parseFloat(item.dataset.lat)], 
            zoom: 14, pitch: 45, duration: 1500 
          });
        }
        searchResults.classList.remove('open');
        const input = document.getElementById('searchInput');
        if (input) input.value = item.querySelector('strong').textContent;
      });
    });
  } catch (e) {
    notify('Error al buscar ubicación', 'error');
  }
}
