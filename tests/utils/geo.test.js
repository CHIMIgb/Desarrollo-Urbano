import { describe, it, expect } from 'vitest';
import { haversine, lineLength, polygonArea, isPointInPolygon, getFeatureCenter } from '../../src/utils/geo.js';

describe('Geo Utilities', () => {
  
  describe('haversine()', () => {
    it('debería calcular la distancia correcta entre dos puntos geográficos (en metros)', () => {
      // Coordenadas aproximadas del Ángel de la Independencia al Zócalo (CDMX)
      // Ángel: -99.1676, 19.4270 | Zócalo: -99.1332, 19.4326
      const dist = haversine(-99.1676, 19.4270, -99.1332, 19.4326);
      
      // La distancia real es de aproximadamente 3.6 - 3.7 km
      expect(dist).toBeGreaterThan(3600);
      expect(dist).toBeLessThan(3800);
    });

    it('debería devolver 0 si el punto inicial y final son los mismos', () => {
      expect(haversine(-99.1332, 19.4326, -99.1332, 19.4326)).toBe(0);
    });
  });

  describe('lineLength()', () => {
    it('debería calcular la longitud total de un arreglo de coordenadas (polilínea)', () => {
      const coords = [
        [-99.1676, 19.4270], // Ángel
        [-99.1550, 19.4290], // Alameda (aprox intermedia)
        [-99.1332, 19.4326]  // Zócalo
      ];
      
      const totalDist = lineLength(coords);
      const sumDist = haversine(coords[0][0], coords[0][1], coords[1][0], coords[1][1]) +
                      haversine(coords[1][0], coords[1][1], coords[2][0], coords[2][1]);
                      
      expect(totalDist).toBeCloseTo(sumDist, 5);
      expect(totalDist).toBeGreaterThan(3600);
    });
  });

  describe('polygonArea()', () => {
    it('debería calcular el área de un polígono cuadrado', () => {
      // Un cuadrado simple en coordenadas geográficas. 
      // 0.001 grados cerca del ecuador son aprox 111.32 metros
      // Un cuadrado de 0.001 x 0.001 grados
      const baseLng = -99.1300;
      const baseLat = 19.4300;
      const offset = 0.001;
      
      const coords = [
        [baseLng, baseLat],
        [baseLng + offset, baseLat],
        [baseLng + offset, baseLat + offset],
        [baseLng, baseLat + offset],
        [baseLng, baseLat] // Cerrado
      ];
      
      const area = polygonArea(coords);
      
      // Debe ser un valor positivo y mayor a 0
      expect(area).toBeGreaterThan(0);
      
      // Aproximadamente 12,392 m2 dependiendo del coseno de la latitud
      // No buscamos exactitud milimétrica sino que el algoritmo shoelace funcione sin regresiones.
      expect(area).toBeGreaterThan(10000);
      expect(area).toBeLessThan(15000);
    });

    it('debería devolver 0 si el polígono tiene menos de 3 puntos', () => {
      expect(polygonArea([[-99.13, 19.43], [-99.12, 19.43]])).toBe(0);
      expect(polygonArea([])).toBe(0);
    });
  });

  describe('isPointInPolygon()', () => {
    const polygon = [
      [-99.15, 19.42],
      [-99.13, 19.42],
      [-99.13, 19.44],
      [-99.15, 19.44],
      [-99.15, 19.42]
    ];

    it('debería devolver true para un punto que se encuentre DENTRO del polígono', () => {
      const point = [-99.14, 19.43];
      expect(isPointInPolygon(point, polygon)).toBe(true);
    });

    it('debería devolver false para un punto que se encuentre FUERA del polígono', () => {
      const point = [-99.16, 19.43]; // Demasiado al oeste
      expect(isPointInPolygon(point, polygon)).toBe(false);
      
      const point2 = [-99.14, 19.45]; // Demasiado al norte
      expect(isPointInPolygon(point2, polygon)).toBe(false);
    });
  });

  describe('getFeatureCenter()', () => {
    it('debería calcular el centroide de un Polygon', () => {
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [-99.15, 19.42],
            [-99.13, 19.42],
            [-99.13, 19.44],
            [-99.15, 19.44],
            [-99.15, 19.42]
          ]]
        }
      };
      
      const center = getFeatureCenter(feature);
      expect(center.lng).toBeCloseTo(-99.142); // El promedio de las X
      expect(center.lat).toBeCloseTo(19.428); // El promedio de las Y
    });

    it('debería calcular el centro de un LineString', () => {
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-99.10, 19.40],
            [-99.11, 19.41], // Centro redondeado
            [-99.12, 19.42]
          ]
        }
      };
      
      const center = getFeatureCenter(feature);
      expect(center.lng).toBe(-99.11);
      expect(center.lat).toBe(19.41);
    });

    it('debería devolver las mismas coordenadas para un Point', () => {
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-99.10, 19.40]
        }
      };
      
      const center = getFeatureCenter(feature);
      expect(center.lng).toBe(-99.10);
      expect(center.lat).toBe(19.40);
    });
  });

});
