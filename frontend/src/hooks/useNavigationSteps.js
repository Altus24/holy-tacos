/**
 * Hook para extraer pasos de navegación desde routeToRestaurant (Directions)
 * y calcular el índice del paso actual según la posición del conductor.
 */
import { useState, useEffect, useMemo } from 'react';

function stripHtml(html) {
  if (typeof html !== 'string') return '';
  const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (tmp) {
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
  return html.replace(/<[^>]*>/g, '');
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function toLatLng(loc) {
  if (!loc) return null;
  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

/**
 * @param {object} routeToRestaurant - { fullResult, selectedRouteIndex }
 * @returns {Array} steps - { instruction, distanceText, durationText, start, end }
 */
export function getStepsFromRoute(routeToRestaurant) {
  if (!routeToRestaurant?.fullResult?.routes?.length) return [];
  const idx = routeToRestaurant.selectedRouteIndex ?? 0;
  const route = routeToRestaurant.fullResult.routes[idx];
  const steps = [];
  route?.legs?.forEach((leg) => {
    leg.steps?.forEach((s) => {
      steps.push({
        instruction: stripHtml(s.instructions || ''),
        distanceText: s.distance?.text ?? '',
        durationText: s.duration?.text ?? '',
        start: toLatLng(s.start_location),
        end: toLatLng(s.end_location)
      });
    });
  });
  return steps;
}

/**
 * @param {object} routeToRestaurant
 * @param {object} driverLocation - { lat, lng }
 * @param {boolean} navigationMode
 * @returns {{ steps: Array, currentStepIndex: number, setCurrentStepIndex: function }}
 */
export function useNavigationSteps(routeToRestaurant, driverLocation, navigationMode) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = useMemo(
    () => getStepsFromRoute(routeToRestaurant),
    [routeToRestaurant?.fullResult, routeToRestaurant?.selectedRouteIndex]
  );

  useEffect(() => {
    if (!navigationMode || !driverLocation || steps.length === 0) return;
    let best = 0;
    let bestDist = Infinity;
    steps.forEach((step, i) => {
      const toStart = step.start ? distanceMeters(driverLocation, step.start) : Infinity;
      const toEnd = step.end ? distanceMeters(driverLocation, step.end) : Infinity;
      const dist = Math.min(toStart, toEnd);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setCurrentStepIndex((prev) => (best >= prev ? best : prev));
  }, [navigationMode, driverLocation, steps]);

  return { steps, currentStepIndex, setCurrentStepIndex };
}
