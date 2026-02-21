// Mapa permanente para el conductor: ubicación en tiempo real, restaurantes activos con fitBounds,
// doble clic en pin → ruta con tráfico, navegación en pantalla (instrucciones paso a paso, seguir conductor)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  GoogleMap,
  LoadScript,
  Marker,
  DirectionsRenderer
} from '@react-google-maps/api';
import { useNavigationSteps } from '../../hooks/useNavigationSteps';

const MAP_OPTIONS = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
  ]
};

// Centro por defecto (Mendoza) cuando no hay ubicación ni restaurantes
const DEFAULT_CENTER = { lat: -32.8895, lng: -68.8458 };

/**
 * Ajusta el mapa para que se vean todos los puntos (restaurantes y opcionalmente el driver).
 * Usa LatLngBounds y fitBounds para centrado automático al cargar.
 */
function applyFitBounds(map, points, padding = 60) {
  if (!map || !window.google?.maps || !points.length) return;
  const bounds = new window.google.maps.LatLngBounds();
  points.forEach(p => bounds.extend(p));
  map.fitBounds(bounds, padding);
}

/**
 * DriverMap - Mapa del conductor
 *
 * Props:
 * - driverLocation: { lat, lng } | null
 * - activeRestaurants: lista completa de restaurantes activos (para referencia)
 * - restaurantsToShow: lista a mostrar (todos activos o solo cercanos según filtro del padre)
 * - activeOrder: orden activa (cliente + ruta)
 * - fitBoundsKey: 'all' | 'nearby' para reajustar vista al cambiar filtro (driver + restaurantes visibles)
 * - mapHeight, onCenterMe, className
 */
const DriverMap = ({
  driverLocation,
  activeRestaurants = [],
  restaurantsToShow = [],
  activeOrder = null,
  mapHeight = 'min(420px, 60vh)',
  fitBoundsKey = 'all',
  onCenterMe,
  className = ''
}) => {
  // Inicializar true si la API ya está cargada (p. ej. al volver del perfil), para no montar LoadScript de nuevo y evitar "google api is already presented"
  const [scriptLoaded, setScriptLoaded] = useState(() =>
    typeof window !== 'undefined' && !!window.google?.maps
  );
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  /** Ruta al restaurante (doble clic): directions completo, rutas alternativas, índice seleccionado */
  const [routeToRestaurant, setRouteToRestaurant] = useState(null);
  const [routeToRestaurantLoading, setRouteToRestaurantLoading] = useState(false);
  /** Modo navegación en pantalla: instrucciones paso a paso y mapa siguiendo al conductor */
  const [navigationMode, setNavigationMode] = useState(false);
  const { steps: navigationSteps, currentStepIndex, setCurrentStepIndex } = useNavigationSteps(
    routeToRestaurant,
    driverLocation,
    navigationMode
  );
  const mapRef = useRef(null);
  const directionsDebounceRef = useRef(null);
  const trafficLayerRef = useRef(null);
  const lastSpokenStepRef = useRef(-1);

  // No marcar scriptLoaded desde window.google: el mapa debe montarse siempre dentro LoadScript tras onLoad

  // Coordenadas del cliente (orden activa)
  const deliveryCoords = activeOrder?.deliveryLocation?.lat != null
    ? { lat: activeOrder.deliveryLocation.lat, lng: activeOrder.deliveryLocation.lng }
    : null;
  const orderRestaurantCoords = activeOrder?.restaurantLocation
    ? { lat: activeOrder.restaurantLocation.lat, lng: activeOrder.restaurantLocation.lng }
    : (activeOrder?.restaurantId?.location?.coordinates?.length >= 2
        ? { lat: activeOrder.restaurantId.location.coordinates[1], lng: activeOrder.restaurantId.location.coordinates[0] }
        : null);

  // Marcadores de restaurantes a mostrar (con lat/lng desde location.coordinates o ya normalizado)
  const restaurantMarkers = restaurantsToShow
    .filter(r => {
      if (r.location?.coordinates?.length >= 2) return true;
      if (r.lat != null && r.lng != null) return true;
      return false;
    })
    .map(r => ({
      _id: r._id,
      name: r.name,
      address: r.address,
      lat: r.lat ?? r.location.coordinates[1],
      lng: r.lng ?? r.location.coordinates[0]
    }));

  // Ajustar mapa para ver posición del driver y todos los restaurantes mostrados (todos activos o solo cercanos)
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const points = [
      ...restaurantMarkers.map(r => ({ lat: r.lat, lng: r.lng })),
      ...(driverLocation ? [driverLocation] : [])
    ];
    if (points.length === 0) {
      if (driverLocation) {
        mapRef.current.panTo(driverLocation);
        mapRef.current.setZoom(15);
      }
      return;
    }
    applyFitBounds(mapRef.current, points, 80);
    // Re-ejecutar al cambiar filtro (todos / cercanos) o al cambiar la cantidad de restaurantes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantMarkers.length, fitBoundsKey]);

  // Centro del mapa (fallback para zoom inicial): conductor + orden activa o restaurantes
  useEffect(() => {
    const points = [];
    if (driverLocation) points.push(driverLocation);
    if (deliveryCoords) points.push(deliveryCoords);
    if (orderRestaurantCoords) points.push(orderRestaurantCoords);
    if (points.length === 0 && restaurantMarkers.length > 0) {
      points.push({ lat: restaurantMarkers[0].lat, lng: restaurantMarkers[0].lng });
    }
    if (points.length > 0) {
      const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
      setCenter({ lat: avgLat, lng: avgLng });
    }
  }, [driverLocation, deliveryCoords, orderRestaurantCoords, restaurantMarkers.length]);

  // Calcular ruta driver → restaurante (si hay) → cliente (con debounce para no saturar)
  const calculateDirections = useCallback(() => {
    if (!driverLocation || !deliveryCoords || !window.google?.maps) return;

    setDirectionsLoading(true);
    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(deliveryCoords.lat, deliveryCoords.lng);
    const waypoints = orderRestaurantCoords
      ? [{ location: new window.google.maps.LatLng(orderRestaurantCoords.lat, orderRestaurantCoords.lng), stopover: true }]
      : [];

    const svc = new window.google.maps.DirectionsService();
    svc.route(
      { origin, destination, waypoints, travelMode: 'DRIVING' },
      (result, status) => {
        setDirectionsLoading(false);
        if (status === 'OK') {
          setDirectionsResponse(result);
          const route = result.routes[0];
          if (route?.legs?.length) {
            const totalDistance = route.legs.reduce((acc, leg) => acc + leg.distance.value, 0);
            const totalDuration = route.legs.reduce((acc, leg) => acc + leg.duration.value, 0);
            setRouteInfo({
              distanceText: (totalDistance / 1000).toFixed(1) + ' km',
              durationText: Math.ceil(totalDuration / 60) + ' min'
            });
          }
        } else {
          setDirectionsResponse(null);
          setRouteInfo(null);
        }
      }
    );
  }, [driverLocation, deliveryCoords, orderRestaurantCoords]);

  // Debounce: recalcular ruta al moverse el driver (cada 3 s como máximo)
  useEffect(() => {
    if (!scriptLoaded || !activeOrder || !driverLocation || !deliveryCoords) {
      setDirectionsResponse(null);
      setRouteInfo(null);
      return;
    }
    if (directionsDebounceRef.current) clearTimeout(directionsDebounceRef.current);
    directionsDebounceRef.current = setTimeout(calculateDirections, 2500);
    return () => {
      if (directionsDebounceRef.current) clearTimeout(directionsDebounceRef.current);
    };
  }, [scriptLoaded, activeOrder, driverLocation, deliveryCoords, calculateDirections]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    // Capa de tráfico en tiempo real (rojo/amarillo/verde en vías)
    if (window.google?.maps?.TrafficLayer) {
      const layer = new window.google.maps.TrafficLayer();
      layer.setMap(map);
      trafficLayerRef.current = layer;
    }
    // Ajustar vista si ya hay datos
    const pts = [
      ...restaurantMarkers.map(r => ({ lat: r.lat, lng: r.lng })),
      ...(driverLocation ? [driverLocation] : [])
    ];
    if (pts.length > 0) applyFitBounds(map, pts, 80);
  }, [restaurantMarkers.length, driverLocation]);

  // Limpiar capa de tráfico al desmontar
  useEffect(() => {
    return () => {
      if (trafficLayerRef.current?.setMap) trafficLayerRef.current.setMap(null);
    };
  }, []);

  /**
   * Doble clic en pin de restaurante: calcular ruta con tráfico y alternativas.
   * Usa drivingOptions (departureTime, trafficModel) y provideRouteAlternatives.
   * Muestra toasts si hay tráfico pesado o si se elige ruta alternativa automátic.
   */
  const handleRestaurantDblClick = useCallback((restaurant) => {
    if (!driverLocation || !window.google?.maps) return;
    setRouteToRestaurant(null);
    setRouteToRestaurantLoading(true);
    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(restaurant.lat, restaurant.lng);
    const svc = new window.google.maps.DirectionsService();
    const request = {
      origin,
      destination,
      travelMode: 'DRIVING',
      provideRouteAlternatives: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel?.PESSIMISTIC ?? 'pessimistic'
      }
    };
    const applyRouteResult = (result, rest) => {
      setRouteToRestaurantLoading(false);
      const routes = result.routes;
      const routeSummaries = routes.map((route, idx) => {
        const leg = route.legs?.[0];
        const duration = leg?.duration?.value ?? 0;
        const durationInTraffic = leg?.duration_in_traffic?.value ?? duration;
        return {
          index: idx,
          duration,
          durationInTraffic,
          distanceText: leg?.distance?.text ?? '',
          durationText: leg?.duration?.text ?? '',
          durationInTrafficText: leg?.duration_in_traffic?.text ?? leg?.duration?.text ?? ''
        };
      });
      const first = routeSummaries[0];
      if (first.durationInTraffic > first.duration * 1.2 && first.duration > 0) {
        const extraMin = Math.ceil((first.durationInTraffic - first.duration) / 60);
        toast('Hay tráfico pesado en la ruta. Tiempo estimado aumentado en ' + extraMin + ' min.', {
          icon: '🚗',
          duration: 5000
        });
      }
      let bestIndex = 0;
      let bestDuration = routeSummaries[0].durationInTraffic || routeSummaries[0].duration;
      routeSummaries.forEach((r, i) => {
        const d = r.durationInTraffic || r.duration;
        if (d < bestDuration) {
          bestDuration = d;
          bestIndex = i;
        }
      });
      if (bestIndex !== 0) {
        toast('Ruta modificada por tráfico: alternativa más rápida seleccionada. ETA actualizado.', {
          icon: '✓',
          duration: 4000
        });
      }
      const selected = routeSummaries[bestIndex];
      setRouteToRestaurant({
        fullResult: result,
        restaurantName: rest.name,
        destination: { lat: rest.lat, lng: rest.lng },
        routes,
        routeSummaries,
        selectedRouteIndex: bestIndex,
        distanceText: selected.distanceText,
        durationText: selected.durationInTrafficText || selected.durationText
      });
    };

    svc.route(request, (result, status) => {
      if (status === 'OK' && result.routes?.length) {
        applyRouteResult(result, restaurant);
        return;
      }
      // Fallback sin opciones de tráfico (por si la API no las soporta en esta región/cuenta)
      svc.route({ origin, destination, travelMode: 'DRIVING', provideRouteAlternatives: true }, (res2, st2) => {
        if (st2 !== 'OK' || !res2.routes?.length) {
          setRouteToRestaurantLoading(false);
          setRouteToRestaurant(null);
          toast.error('No se puede calcular la ruta por tráfico o conexión.');
          return;
        }
        applyRouteResult(res2, restaurant);
      });
    });
  }, [driverLocation]);

  /** Objeto directions con solo la ruta seleccionada (para DirectionsRenderer) */
  const routeToRestaurantDirections = useMemo(() => {
    if (!routeToRestaurant?.fullResult?.routes?.length) return null;
    const idx = routeToRestaurant.selectedRouteIndex ?? 0;
    const singleRoute = routeToRestaurant.fullResult.routes[idx];
    if (!singleRoute) return null;
    return {
      ...routeToRestaurant.fullResult,
      routes: [singleRoute]
    };
  }, [routeToRestaurant?.fullResult, routeToRestaurant?.selectedRouteIndex]);

  /** Voz: leer instrucción actual cuando cambia (solo en modo navegación) */
  useEffect(() => {
    if (!navigationMode || navigationSteps.length === 0 || currentStepIndex >= navigationSteps.length) return;
    if (lastSpokenStepRef.current === currentStepIndex) return;
    lastSpokenStepRef.current = currentStepIndex;
    const step = navigationSteps[currentStepIndex];
    if (!step?.instruction || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(step.instruction);
    u.lang = 'es-ES';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, [navigationMode, currentStepIndex, navigationSteps]);

  /** Iniciar navegación en pantalla (instrucciones + seguir conductor) */
  const handleStartNavigation = useCallback(() => {
    if (!routeToRestaurant?.destination || !driverLocation) return;
    setNavigationMode(true);
    setCurrentStepIndex(0);
    lastSpokenStepRef.current = -1;
    toast.success('Navegación iniciada. Seguí las instrucciones en pantalla.');
  }, [routeToRestaurant?.destination, driverLocation]);

  /** Abrir navegación en Google Maps (como Uber/PedidosYa). En Android usa intent para que aparezca "Iniciar". */
  const handleOpenInGoogleMaps = useCallback(() => {
    if (!routeToRestaurant?.destination || !driverLocation) return;
    const { lat: dlat, lng: dlng } = driverLocation;
    const { lat: rlat, lng: rlng } = routeToRestaurant.destination;
    const origin = `${dlat},${dlng}`;
    const destination = `${rlat},${rlng}`;
    // URL universal con parámetros codificados (requerido por la documentación de Maps URLs)
    const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    // En Android el intent abre la app de Google Maps con "Iniciar" visible; en el resto, URL web con ruta
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.location.href = `google.navigation:q=${rlat},${rlng}`;
    } else {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
    toast.success('Abriendo Google Maps');
  }, [routeToRestaurant?.destination, driverLocation]);

  /** Abrir navegación en Waze (destino; Waze usa tu ubicación actual como origen) */
  const handleOpenInWaze = useCallback(() => {
    if (!routeToRestaurant?.destination) return;
    const { lat, lng } = routeToRestaurant.destination;
    const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success('Abriendo Waze');
  }, [routeToRestaurant?.destination]);

  /** Salir del modo navegación */
  const handleEndNavigation = useCallback(() => {
    setNavigationMode(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  /** Recalcular ruta desde la posición actual hasta el restaurante (en modo navegación) */
  const handleRecalculateRoute = useCallback(() => {
    if (!driverLocation || !routeToRestaurant?.destination || !window.google?.maps) return;
    setRouteToRestaurantLoading(true);
    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(routeToRestaurant.destination.lat, routeToRestaurant.destination.lng);
    const svc = new window.google.maps.DirectionsService();
    const request = {
      origin,
      destination,
      travelMode: 'DRIVING',
      provideRouteAlternatives: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel?.PESSIMISTIC ?? 'pessimistic'
      }
    };
    svc.route(request, (result, status) => {
      setRouteToRestaurantLoading(false);
      if (status !== 'OK' || !result.routes?.length) {
        toast.error('No se pudo recalcular la ruta');
        return;
      }
      const routes = result.routes;
      const routeSummaries = routes.map((route, idx) => {
        const leg = route.legs?.[0];
        const duration = leg?.duration?.value ?? 0;
        const durationInTraffic = leg?.duration_in_traffic?.value ?? duration;
        return {
          index: idx,
          duration,
          durationInTraffic,
          distanceText: leg?.distance?.text ?? '',
          durationText: leg?.duration?.text ?? '',
          durationInTrafficText: leg?.duration_in_traffic?.text ?? leg?.duration?.text ?? ''
        };
      });
      const first = routeSummaries[0];
      setRouteToRestaurant((prev) =>
        prev
          ? {
              ...prev,
              fullResult: result,
              routes,
              routeSummaries,
              selectedRouteIndex: 0,
              distanceText: first.distanceText,
              durationText: first.durationInTrafficText || first.durationText
            }
          : null
      );
      setCurrentStepIndex(0);
      lastSpokenStepRef.current = -1;
      toast.success('Ruta recalculada');
    });
  }, [driverLocation, routeToRestaurant?.destination]);

  /** En modo navegación, centrar mapa en el conductor al actualizar ubicación */
  useEffect(() => {
    if (!navigationMode || !driverLocation || !mapRef.current) return;
    mapRef.current.panTo(driverLocation);
    mapRef.current.setZoom(17);
  }, [navigationMode, driverLocation?.lat, driverLocation?.lng]);

  const handleCenterMe = useCallback(() => {
    if (driverLocation && mapRef.current) {
      mapRef.current.panTo(driverLocation);
      mapRef.current.setZoom(navigationMode ? 17 : 16);
    }
    onCenterMe?.();
  }, [driverLocation, onCenterMe, navigationMode]);

  // Iconos: azul driver, rojo/naranja restaurante, verde cliente
  const getIcons = () => {
    if (typeof window === 'undefined' || !window.google?.maps) return null;
    return {
      driver: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="16" fill="#2563eb" stroke="white" stroke-width="3"/>
            <path d="M11 20h14l-2.5-5h-9z" fill="white"/>
            <circle cx="14" cy="17" r="1.5" fill="white"/>
            <circle cx="22" cy="17" r="1.5" fill="white"/>
          </svg>
        `),
        scaledSize: { width: 36, height: 36 },
        anchor: { x: 18, y: 36 }
      },
      restaurant: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="14" fill="#dc2626" stroke="white" stroke-width="2"/>
            <path d="M10 12h12v6H10z" fill="white"/>
            <path d="M12 8h8v4h-8z" fill="white"/>
          </svg>
        `),
        scaledSize: { width: 32, height: 32 },
        anchor: { x: 16, y: 32 }
      },
      client: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="14" fill="#16a34a" stroke="white" stroke-width="2"/>
            <path d="M10 14h12v5H10z" fill="white"/>
            <path d="M12 10h8v4h-8z" fill="white"/>
          </svg>
        `),
        scaledSize: { width: 32, height: 32 },
        anchor: { x: 16, y: 32 }
      }
    };
  };

  const containerStyle = {
    width: '100%',
    height: typeof mapHeight === 'number' ? `${mapHeight}px` : mapHeight,
    borderRadius: '8px'
  };

  const icons = scriptLoaded ? getIcons() : null;

  if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${className}`}>
        <p className="text-gray-600">Configurá REACT_APP_GOOGLE_MAPS_API_KEY para ver el mapa.</p>
      </div>
    );
  }

  const loadingPlaceholder = (
    <div
      className="flex items-center justify-center rounded-lg bg-gray-100 border-2 border-dashed border-gray-300"
      style={containerStyle}
    >
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      <span className="ml-2 text-gray-600">Cargando mapa...</span>
    </div>
  );

  const mapContent = (
    <>
            {/* Overlay: orden asignada */}
            {activeOrder && (
              <div className="absolute top-2 left-2 right-2 z-10 bg-green-50 border border-green-300 rounded-lg px-3 py-2 text-sm text-green-800 shadow">
                <span className="font-medium">Orden #{String(activeOrder._id).slice(-6)} asignada</span>
                {routeInfo && (
                  <span className="ml-2 text-green-700">
                    · {routeInfo.distanceText} · ~{routeInfo.durationText}
                  </span>
                )}
              </div>
            )}

            {/* Botón centrar en mi posición (oculto en modo navegación: el mapa ya sigue al conductor) */}
            {!navigationMode && (
              <button
                type="button"
                onClick={handleCenterMe}
                disabled={!driverLocation}
                className="absolute bottom-4 right-4 z-10 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Centrar en mi posición
              </button>
            )}

            {directionsLoading && activeOrder && (
              <div className="absolute top-12 left-2 z-10 bg-white/90 rounded px-2 py-1 text-xs text-gray-600">
                Actualizando ruta...
              </div>
            )}

            {/* Panel ruta al restaurante: estilo Uber/PedidosYa — Navegar = abrir app de mapas */}
            {routeToRestaurant && !navigationMode && (
              <div className="absolute top-2 left-2 right-2 z-10 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">Ruta a {routeToRestaurant.restaurantName}</p>
                    <p className="text-sm text-gray-600">
                      {routeToRestaurant.distanceText} · ~{routeToRestaurant.durationText}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRouteToRestaurant(null); setNavigationMode(false); }}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    aria-label="Cerrar ruta"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {/* Selector de ruta alternativa cuando hay más de una */}
                {routeToRestaurant.routeSummaries && routeToRestaurant.routeSummaries.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-600">Ruta:</label>
                    <select
                      value={routeToRestaurant.selectedRouteIndex ?? 0}
                      onChange={(e) => {
                        const idx = parseInt(e.target.value, 10);
                        setRouteToRestaurant(prev => prev ? { ...prev, selectedRouteIndex: idx, distanceText: prev.routeSummaries[idx].distanceText, durationText: prev.routeSummaries[idx].durationInTrafficText || prev.routeSummaries[idx].durationText } : null);
                      }}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                    >
                      {routeToRestaurant.routeSummaries.map((r, i) => (
                        <option key={i} value={i}>
                          Opción {i + 1}: {r.distanceText} · {r.durationInTrafficText || r.durationText}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Acción principal: Navegar (abre Google Maps, como Uber/PedidosYa) */}
                <button
                  type="button"
                  onClick={handleOpenInGoogleMaps}
                  className="w-full py-3.5 px-4 bg-green-600 text-white font-semibold rounded-xl shadow-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Navegar
                </button>
                <p className="text-xs text-center text-gray-500">Se abre Google Maps con la ruta lista</p>
                {/* Otras apps: Waze + instrucciones en pantalla */}
                <div className="flex gap-2 pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleOpenInWaze}
                    className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                    </svg>
                    Waze
                  </button>
                  <button
                    type="button"
                    onClick={handleStartNavigation}
                    className="flex-1 py-2 px-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Instrucciones aquí
                  </button>
                </div>
              </div>
            )}

            {/* Botón flotante principal "Navegar" (abre Google Maps) — visible si hay ruta y el panel está colapsado o en móvil */}
            {routeToRestaurant && !navigationMode && (
              <button
                type="button"
                onClick={handleOpenInGoogleMaps}
                className="absolute bottom-4 left-4 right-4 z-10 py-3.5 px-4 bg-green-600 text-white font-semibold rounded-xl shadow-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Navegar
              </button>
            )}

            {/* Modo navegación: barra superior con próxima instrucción + panel de pasos */}
            {navigationMode && routeToRestaurant && (
              <>
                {/* Barra superior: próxima instrucción + ETA + acciones */}
                <div className="absolute top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 shadow-md">
                  <div className="px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Próxima instrucción</p>
                      <p className="text-base font-semibold text-gray-900 mt-0.5">
                        {navigationSteps[currentStepIndex]?.instruction || 'Llegando al destino'}
                      </p>
                      {navigationSteps[currentStepIndex] && (
                        <p className="text-sm text-gray-500 mt-1">
                          {navigationSteps[currentStepIndex].distanceText}
                          {navigationSteps[currentStepIndex].durationText ? ` · ${navigationSteps[currentStepIndex].durationText}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium text-gray-600">
                        {routeToRestaurant.distanceText} · ~{routeToRestaurant.durationText}
                      </span>
                      <button
                        type="button"
                        onClick={handleRecalculateRoute}
                        disabled={routeToRestaurantLoading}
                        className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                        title="Recalcular ruta"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={handleEndNavigation}
                        className="px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200"
                      >
                        Finalizar navegación
                      </button>
                    </div>
                  </div>
                </div>

                {/* Panel deslizable de instrucciones (lista de pasos) */}
                <div className="absolute top-[88px] left-2 right-2 bottom-14 z-10 overflow-hidden flex flex-col max-h-[45vh] bg-white/95 backdrop-blur rounded-xl border border-gray-200 shadow-lg">
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Instrucciones paso a paso</span>
                    <span className="text-xs text-gray-500">
                      Paso {Math.min(currentStepIndex + 1, navigationSteps.length)} de {navigationSteps.length}
                    </span>
                  </div>
                  <div className="overflow-y-auto flex-1 py-2">
                    {navigationSteps.map((step, i) => (
                      <div
                        key={i}
                        className={`px-4 py-2 flex gap-3 ${i === currentStepIndex ? 'bg-green-50 border-l-4 border-green-500' : 'border-l-4 border-transparent'}`}
                      >
                        <span className="text-sm font-medium text-gray-400 shrink-0 w-6">{i + 1}</span>
                        <div>
                          <p className={`text-sm ${i === currentStepIndex ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                            {step.instruction}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {step.distanceText}
                            {step.durationText ? ` · ${step.durationText}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Abrir en app externa (Google Maps / Waze) */}
                <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenInGoogleMaps}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200"
                  >
                    Google Maps
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInWaze}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-200"
                  >
                    Waze
                  </button>
                </div>
              </>
            )}
            {routeToRestaurantLoading && (
              <div className="absolute top-2 left-2 z-10 bg-white/95 rounded-lg shadow px-3 py-2 text-sm text-gray-600">
                Calculando ruta...
              </div>
            )}

            {/* Mensaje cuando no hay restaurantes activos */}
            {restaurantMarkers.length === 0 && scriptLoaded && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800 shadow">
                No hay restaurantes activos en este momento
              </div>
            )}

            <GoogleMap
              mapContainerStyle={containerStyle}
              center={center}
              zoom={13}
              options={MAP_OPTIONS}
              onLoad={onMapLoad}
            >
              {/* Marcador del driver */}
              {driverLocation && (
                <Marker
                  position={driverLocation}
                  icon={icons.driver}
                  title="Tu posición"
                  animation={window.google?.maps?.Animation?.BOUNCE}
                />
              )}

              {/* Marcadores de restaurantes: doble clic crea ruta desde tu posición */}
              {restaurantMarkers.map((r) => (
                <Marker
                  key={r._id}
                  position={{ lat: r.lat, lng: r.lng }}
                  icon={icons.restaurant}
                  title={`${r.name} (doble clic para ruta)`}
                  onDblClick={() => handleRestaurantDblClick(r)}
                />
              ))}

              {/* Marcador del cliente (solo si hay orden activa) */}
              {deliveryCoords && (
                <Marker
                  position={deliveryCoords}
                  icon={icons.client}
                  title="Dirección de entrega"
                />
              )}

              {/* Ruta: al restaurante (doble clic, con ruta seleccionada) o a la orden activa */}
              {(routeToRestaurantDirections || directionsResponse) && (
                <DirectionsRenderer
                  directions={routeToRestaurantDirections ?? directionsResponse}
                  options={{
                    polylineOptions: { strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.9 },
                    suppressMarkers: true
                  }}
                />
              )}
            </GoogleMap>
    </>
  );

  // Siempre usar LoadScript; solo mostrar el mapa cuando onLoad haya corrido (google.maps.Map disponible)
  return (
    <div className={`relative ${className}`}>
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
        libraries={['places']}
        onLoad={() => setScriptLoaded(true)}
      >
        {!scriptLoaded || !icons ? loadingPlaceholder : mapContent}
      </LoadScript>
    </div>
  );
};

export default DriverMap;
