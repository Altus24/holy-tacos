// Mapa del conductor: full-screen, rutas dobles automáticas, botón "Ir" estilo Google Maps móvil,
// navegación paso a paso con voz, capa de tráfico, alertas de tráfico inteligentes.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  GoogleMap,
  LoadScript,
  DirectionsRenderer
} from '@react-google-maps/api';
import { useNavigationSteps } from '../../hooks/useNavigationSteps';
import NavigationPanel from './NavigationPanel';

// Solo 'places'; Marker clásico no requiere la librería 'marker' ni mapId
const GOOGLE_MAP_LIBRARIES = ['places'];

// Mapa sin marcadores POI para mayor claridad visual (sin mapId para evitar errores de config)
const MAP_OPTIONS = {
  zoomControl: false,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] }
  ]
};

// Forma de pin geográfico (punta abajo, círculo arriba) para marcadores de restaurante y cliente
const PIN_PATH = 'M 0,0 C -2,-4 -7,-7 -7,-12 a 7,7 0 1,1 14,0 C 7,-7 2,-4 0,0 Z';

// Centro por defecto (Mendoza, Argentina) cuando no hay ubicación ni restaurantes
const DEFAULT_CENTER = { lat: -32.8895, lng: -68.8458 };

/**
 * Crea el icono del marcador según el tipo:
 * - 'driver'    → círculo azul (se mueve en tiempo real)
 * - 'restaurant'→ pin rojo con punto blanco
 * - 'client'    → pin verde con punto blanco
 * Requiere que window.google.maps esté disponible.
 */
function getMarkerIcon(type) {
  const g = window.google.maps;
  if (type === 'driver') {
    return {
      path: g.SymbolPath.CIRCLE,
      scale: 11,
      fillColor: '#2563EB',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 3
    };
  }
  const color = type === 'restaurant' ? '#dc2626' : '#16a34a';
  return {
    path: PIN_PATH,
    scale: 2.2,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 1.8,
    anchor: new g.Point(0, 0),
    labelOrigin: new g.Point(0, -12)
  };
}

/**
 * Ajusta el mapa para mostrar todos los puntos indicados (fitBounds con padding).
 */
function applyFitBounds(map, points, padding = 80) {
  if (!map || !window.google?.maps || !points.length) return;
  if (points.length === 1) {
    map.panTo(points[0]);
    map.setZoom(15);
    return;
  }
  const bounds = new window.google.maps.LatLngBounds();
  points.forEach(p => bounds.extend(p));
  map.fitBounds(bounds, padding);
}

/**
 * DriverMap — Mapa principal del conductor.
 *
 * Props:
 * - driverLocation: { lat, lng } | null  — posición en tiempo real
 * - activeRestaurants: Array              — todos los restaurantes activos
 * - restaurantsToShow: Array             — filtrado (todos o solo cercanos)
 * - activeOrder: object | null           — orden activa con cliente y ruta
 * - fitBoundsKey: string                 — cambia para reajustar vista
 * - mapHeight: string | number           — altura del mapa
 * - isFullScreen: boolean                — ajusta posición de controles
 * - onCenterMe: function                 — callback al presionar "centrar"
 * - className: string
 */
const DriverMap = ({
  driverLocation,
  activeRestaurants = [],
  restaurantsToShow = [],
  activeOrder = null,
  mapHeight = 'min(420px, 60vh)',
  fitBoundsKey = 'all',
  isFullScreen = false,
  onCenterMe,
  className = ''
}) => {
  const [scriptLoaded, setScriptLoaded] = useState(() =>
    typeof window !== 'undefined' && !!window.google?.maps
  );
  const [mapLoadError, setMapLoadError] = useState(null);
  const [center, setCenter] = useState(DEFAULT_CENTER);

  // Rutas de la orden activa (dos tramos)
  const [driverToRestaurantDirections, setDriverToRestaurantDirections] = useState(null);
  const [restaurantToClientDirections, setRestaurantToClientDirections] = useState(null);
  const [driverToRestaurantInfo, setDriverToRestaurantInfo] = useState(null);
  const [restaurantToClientInfo, setRestaurantToClientInfo] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [directionsLoading, setDirectionsLoading] = useState(false);

  // Ruta seleccionada por doble clic en un restaurante (con tráfico y alternativas)
  const [routeToRestaurant, setRouteToRestaurant] = useState(null);
  const [routeToRestaurantLoading, setRouteToRestaurantLoading] = useState(false);

  // Modo navegación en pantalla (instrucciones paso a paso)
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
  const driverMarkerRef = useRef(null);
  const restaurantMarkersRef = useRef([]);
  const clientMarkerRef = useRef(null);
  const setMapLoadErrorRef = useRef(setMapLoadError);
  setMapLoadErrorRef.current = setMapLoadError;

  // Google Maps llama a gm_authFailure cuando la API key o el dominio no están autorizados
  useEffect(() => {
    window.gm_authFailure = () => {
      setMapLoadErrorRef.current('RefererNotAllowedMapError: agregá tu dominio en Google Cloud Console.');
    };
    return () => { delete window.gm_authFailure; };
  }, []);

  // Coordenadas del cliente (dirección de entrega de la orden activa)
  const deliveryCoords = useMemo(() => {
    if (activeOrder?.deliveryLocation?.lat == null) return null;
    return { lat: activeOrder.deliveryLocation.lat, lng: activeOrder.deliveryLocation.lng };
  }, [activeOrder?.deliveryLocation?.lat, activeOrder?.deliveryLocation?.lng]);

  // Coordenadas del restaurante de la orden activa
  const orderRestaurantCoords = useMemo(() => {
    if (activeOrder?.restaurantLocation) {
      return { lat: activeOrder.restaurantLocation.lat, lng: activeOrder.restaurantLocation.lng };
    }
    const coords = activeOrder?.restaurantId?.location?.coordinates;
    if (coords?.length >= 2) return { lat: coords[1], lng: coords[0] };
    return null;
  }, [
    activeOrder?.restaurantLocation?.lat,
    activeOrder?.restaurantLocation?.lng,
    activeOrder?.restaurantId?.location?.coordinates
  ]);

  // Normalizar lista de restaurantes a mostrar (asegurar lat/lng independiente del formato del backend)
  const restaurantMarkers = restaurantsToShow
    .filter(r => r.location?.coordinates?.length >= 2 || (r.lat != null && r.lng != null))
    .map(r => ({
      _id: r._id,
      name: r.name,
      address: r.address,
      lat: r.lat ?? r.location.coordinates[1],
      lng: r.lng ?? r.location.coordinates[0]
    }));

  // Ajustar bounds al cambiar el filtro (todos/cercanos) o la cantidad de restaurantes mostrados
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    const points = [
      ...restaurantMarkers.map(r => ({ lat: r.lat, lng: r.lng })),
      ...(driverLocation ? [driverLocation] : [])
    ];
    if (!points.length) {
      if (driverLocation) { mapRef.current.panTo(driverLocation); mapRef.current.setZoom(15); }
      return;
    }
    applyFitBounds(mapRef.current, points, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantMarkers.length, fitBoundsKey]);

  // Centro inicial del mapa calculado como promedio de los puntos relevantes
  useEffect(() => {
    const pts = [];
    if (driverLocation) pts.push(driverLocation);
    if (deliveryCoords) pts.push(deliveryCoords);
    if (orderRestaurantCoords) pts.push(orderRestaurantCoords);
    if (!pts.length && restaurantMarkers.length) pts.push({ lat: restaurantMarkers[0].lat, lng: restaurantMarkers[0].lng });
    if (pts.length) {
      setCenter({
        lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
        lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation?.lat, driverLocation?.lng, deliveryCoords?.lat, deliveryCoords?.lng,
    orderRestaurantCoords?.lat, orderRestaurantCoords?.lng, restaurantMarkers.length]);

  // ─── Cálculo de rutas ────────────────────────────────────────────────────────

  const calculateDriverToRestaurant = useCallback(() => {
    if (!driverLocation || !orderRestaurantCoords || !window.google?.maps) {
      setDriverToRestaurantDirections(null);
      setDriverToRestaurantInfo(null);
      return;
    }
    const svc = new window.google.maps.DirectionsService();
    setDirectionsLoading(true);
    svc.route(
      {
        origin: new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng),
        destination: new window.google.maps.LatLng(orderRestaurantCoords.lat, orderRestaurantCoords.lng),
        travelMode: 'DRIVING'
      },
      (result, status) => {
        if (status === 'OK' && result.routes?.length) {
          setDriverToRestaurantDirections(result);
          const leg = result.routes[0]?.legs?.[0];
          if (leg) {
            setDriverToRestaurantInfo({
              distanceMeters: leg.distance?.value ?? 0,
              durationSeconds: leg.duration?.value ?? 0,
              distanceText: leg.distance?.text ?? '',
              durationText: leg.duration?.text ?? ''
            });
          }
        } else {
          setDriverToRestaurantDirections(null);
          setDriverToRestaurantInfo(null);
        }
        setDirectionsLoading(false);
      }
    );
  }, [driverLocation, orderRestaurantCoords]);

  const calculateRestaurantToClient = useCallback(() => {
    if (!orderRestaurantCoords || !deliveryCoords || !window.google?.maps) {
      setRestaurantToClientDirections(null);
      setRestaurantToClientInfo(null);
      return;
    }
    const svc = new window.google.maps.DirectionsService();
    setDirectionsLoading(true);
    svc.route(
      {
        origin: new window.google.maps.LatLng(orderRestaurantCoords.lat, orderRestaurantCoords.lng),
        destination: new window.google.maps.LatLng(deliveryCoords.lat, deliveryCoords.lng),
        travelMode: 'DRIVING'
      },
      (result, status) => {
        if (status === 'OK' && result.routes?.length) {
          setRestaurantToClientDirections(result);
          const leg = result.routes[0]?.legs?.[0];
          if (leg) {
            setRestaurantToClientInfo({
              distanceMeters: leg.distance?.value ?? 0,
              durationSeconds: leg.duration?.value ?? 0,
              distanceText: leg.distance?.text ?? '',
              durationText: leg.duration?.text ?? ''
            });
          }
        } else {
          setRestaurantToClientDirections(null);
          setRestaurantToClientInfo(null);
        }
        setDirectionsLoading(false);
      }
    );
  }, [orderRestaurantCoords, deliveryCoords]);

  // ETA total sumando ambos tramos
  useEffect(() => {
    const d = (driverToRestaurantInfo?.distanceMeters ?? 0) + (restaurantToClientInfo?.distanceMeters ?? 0);
    const t = (driverToRestaurantInfo?.durationSeconds ?? 0) + (restaurantToClientInfo?.durationSeconds ?? 0);
    setRouteInfo(d && t ? { distanceText: (d / 1000).toFixed(1) + ' km', durationText: Math.ceil(t / 60) + ' min' } : null);
  }, [driverToRestaurantInfo, restaurantToClientInfo]);

  // Recalcular rutas de la orden activa con debounce (al moverse el driver o al asignarse una orden)
  useEffect(() => {
    if (!scriptLoaded || !activeOrder) {
      setDriverToRestaurantDirections(null);
      setRestaurantToClientDirections(null);
      setDriverToRestaurantInfo(null);
      setRestaurantToClientInfo(null);
      setRouteInfo(null);
      return;
    }
    if (directionsDebounceRef.current) clearTimeout(directionsDebounceRef.current);
    directionsDebounceRef.current = setTimeout(() => {
      calculateDriverToRestaurant();
      calculateRestaurantToClient();
    }, 2500);
    return () => { if (directionsDebounceRef.current) clearTimeout(directionsDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scriptLoaded, activeOrder?._id,
    driverLocation?.lat, driverLocation?.lng,
    orderRestaurantCoords?.lat, orderRestaurantCoords?.lng,
    deliveryCoords?.lat, deliveryCoords?.lng,
    calculateDriverToRestaurant, calculateRestaurantToClient
  ]);

  // ─── Ruta al restaurante por doble clic (con tráfico) ───────────────────────

  const handleRestaurantDblClick = useCallback((restaurant) => {
    if (!driverLocation || !window.google?.maps) return;
    setRouteToRestaurant(null);
    setRouteToRestaurantLoading(true);
    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(restaurant.lat, restaurant.lng);
    const svc = new window.google.maps.DirectionsService();

    const processResult = (result, rest) => {
      setRouteToRestaurantLoading(false);
      const summaries = result.routes.map((route, idx) => {
        const leg = route.legs?.[0];
        const dur = leg?.duration?.value ?? 0;
        const durTraffic = leg?.duration_in_traffic?.value ?? dur;
        return {
          index: idx,
          duration: dur,
          durationInTraffic: durTraffic,
          distanceText: leg?.distance?.text ?? '',
          durationText: leg?.duration?.text ?? '',
          durationInTrafficText: leg?.duration_in_traffic?.text ?? leg?.duration?.text ?? ''
        };
      });
      const first = summaries[0];
      // Alerta si el tráfico añade más del 20 % al tiempo normal
      if (first.durationInTraffic > first.duration * 1.2 && first.duration > 0) {
        const extraMin = Math.ceil((first.durationInTraffic - first.duration) / 60);
        toast(`Tráfico pesado detectado. Ruta alternativa sugerida (+${extraMin} min).`, { icon: '🚗', duration: 5000, style: { borderLeft: '4px solid #dc2626' } });
      }
      // Seleccionar la ruta más rápida con tráfico
      let bestIdx = 0;
      let bestDur = summaries[0].durationInTraffic || summaries[0].duration;
      summaries.forEach((r, i) => {
        const d = r.durationInTraffic || r.duration;
        if (d < bestDur) { bestDur = d; bestIdx = i; }
      });
      if (bestIdx !== 0) toast('Ruta alternativa más rápida seleccionada.', { icon: '✓', duration: 3000 });
      const best = summaries[bestIdx];
      setRouteToRestaurant({
        fullResult: result,
        restaurantName: rest.name,
        destination: { lat: rest.lat, lng: rest.lng },
        routes: result.routes,
        routeSummaries: summaries,
        selectedRouteIndex: bestIdx,
        distanceText: best.distanceText,
        durationText: best.durationInTrafficText || best.durationText
      });
    };

    svc.route({
      origin, destination, travelMode: 'DRIVING',
      provideRouteAlternatives: true,
      drivingOptions: { departureTime: new Date(), trafficModel: window.google.maps.TrafficModel?.PESSIMISTIC ?? 'pessimistic' }
    }, (result, status) => {
      if (status === 'OK' && result.routes?.length) return processResult(result, restaurant);
      // Fallback sin opciones de tráfico (algunas regiones o cuentas no las soportan)
      svc.route({ origin, destination, travelMode: 'DRIVING', provideRouteAlternatives: true }, (res2, st2) => {
        if (st2 !== 'OK' || !res2.routes?.length) {
          setRouteToRestaurantLoading(false);
          toast.error('No se pudo calcular la ruta.');
          return;
        }
        processResult(res2, restaurant);
      });
    });
  }, [driverLocation]);

  // ─── Callback al cargar el mapa ──────────────────────────────────────────────

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    // Capa de tráfico en tiempo real (rojo/amarillo/verde sobre las vías)
    if (window.google?.maps?.TrafficLayer) {
      trafficLayerRef.current = new window.google.maps.TrafficLayer();
      trafficLayerRef.current.setMap(map);
    }
    const pts = [
      ...restaurantMarkers.map(r => ({ lat: r.lat, lng: r.lng })),
      ...(driverLocation ? [driverLocation] : [])
    ];
    if (pts.length) applyFitBounds(map, pts, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantMarkers.length, driverLocation]);

  // Limpiar capa de tráfico al desmontar
  useEffect(() => () => { if (trafficLayerRef.current?.setMap) trafficLayerRef.current.setMap(null); }, []);

  // Limpiar marcadores al desmontar
  useEffect(() => () => {
    driverMarkerRef.current?.setMap(null);
    clientMarkerRef.current?.setMap(null);
    restaurantMarkersRef.current.forEach(m => m?.setMap(null));
  }, []);

  // ─── Marcadores con colores diferenciados ────────────────────────────────────

  useEffect(() => {
    if (!scriptLoaded || !mapRef.current || !window.google?.maps?.Marker) return;
    const map = mapRef.current;

    // Verificar que el mapa esté correctamente inicializado antes de crear marcadores
    try { if (!map.getDiv?.()) return; } catch { return; }

    try {
      const Marker = window.google.maps.Marker;

      // Marcador del driver (círculo azul, se actualiza con watchPosition)
      if (driverLocation?.lat != null) {
        const pos = { lat: driverLocation.lat, lng: driverLocation.lng };
        if (!driverMarkerRef.current) {
          driverMarkerRef.current = new Marker({ map, position: pos, title: 'Tu posición', icon: getMarkerIcon('driver'), zIndex: 10 });
        } else {
          driverMarkerRef.current.setPosition(pos);
        }
      } else if (driverMarkerRef.current) {
        driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = null;
      }

      // Marcadores de restaurantes (pins rojos)
      restaurantMarkersRef.current.forEach(m => m?.setMap(null));
      restaurantMarkersRef.current = restaurantMarkers.map(r => {
        const m = new Marker({
          map,
          position: { lat: r.lat, lng: r.lng },
          title: r.name || 'Restaurante',
          icon: getMarkerIcon('restaurant'),
          zIndex: 5
        });
        m.addListener('dblclick', () => handleRestaurantDblClick(r));
        return m;
      });

      // Marcador del cliente (pin verde, solo si hay orden activa con dirección de entrega)
      if (deliveryCoords?.lat != null) {
        const pos = { lat: deliveryCoords.lat, lng: deliveryCoords.lng };
        if (!clientMarkerRef.current) {
          clientMarkerRef.current = new Marker({ map, position: pos, title: 'Dirección de entrega', icon: getMarkerIcon('client'), zIndex: 5 });
        } else {
          clientMarkerRef.current.setPosition(pos);
        }
      } else if (clientMarkerRef.current) {
        clientMarkerRef.current.setMap(null);
        clientMarkerRef.current = null;
      }
    } catch (err) {
      console.warn('Error creando marcadores del mapa:', err);
    }
  }, [
    scriptLoaded, driverLocation?.lat, driverLocation?.lng,
    restaurantMarkers, deliveryCoords?.lat, deliveryCoords?.lng,
    handleRestaurantDblClick
  ]);

  // ─── Handlers de navegación ─────────────────────────────────────────────────

  const handleGoToActiveOrder = useCallback(() => {
    if (!activeOrder || !driverLocation || !orderRestaurantCoords || !window.google?.maps) return;
    const { lat, lng } = orderRestaurantCoords;
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = `google.navigation:q=${lat},${lng}`;
      toast.success('Abriendo Google Maps');
      return;
    }
    setRouteToRestaurant(null);
    setRouteToRestaurantLoading(true);
    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(lat, lng);
    const svc = new window.google.maps.DirectionsService();
    const restaurantName = activeOrder.restaurantId?.name || activeOrder.restaurantName || 'Restaurante';

    svc.route({ origin, destination, travelMode: 'DRIVING' }, (result, status) => {
      setRouteToRestaurantLoading(false);
      if (status !== 'OK' || !result.routes?.length) {
        toast.error('No se pudo calcular la ruta para la orden.');
        return;
      }
      const leg = result.routes[0]?.legs?.[0];
      const dur = leg?.duration?.value ?? 0;
      const durationText = leg?.duration_in_traffic?.text ?? leg?.duration?.text ?? '';
      setRouteToRestaurant({
        fullResult: result,
        restaurantName,
        destination: { lat, lng },
        routes: result.routes,
        routeSummaries: [{
          index: 0, duration: dur, durationInTraffic: leg?.duration_in_traffic?.value ?? dur,
          distanceText: leg?.distance?.text ?? '', durationText: leg?.duration?.text ?? '',
          durationInTrafficText: durationText
        }],
        selectedRouteIndex: 0,
        distanceText: leg?.distance?.text ?? '',
        durationText
      });
      setNavigationMode(true);
      setCurrentStepIndex(0);
      lastSpokenStepRef.current = -1;
      toast.success('Navegación iniciada.');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder, driverLocation, orderRestaurantCoords]);

  const handleStartNavigation = useCallback(() => {
    if (!routeToRestaurant?.destination || !driverLocation) return;
    setNavigationMode(true);
    setCurrentStepIndex(0);
    lastSpokenStepRef.current = -1;
    toast.success('Navegación iniciada. Seguí las instrucciones.');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeToRestaurant?.destination, driverLocation]);

  const handleEndNavigation = useCallback(() => {
    setNavigationMode(false);
    window.speechSynthesis?.cancel();
  }, []);

  const handleRecalculateRoute = useCallback(() => {
    if (!driverLocation || !routeToRestaurant?.destination || !window.google?.maps) return;
    setRouteToRestaurantLoading(true);
    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(routeToRestaurant.destination.lat, routeToRestaurant.destination.lng);
    const svc = new window.google.maps.DirectionsService();
    svc.route({
      origin, destination, travelMode: 'DRIVING', provideRouteAlternatives: true,
      drivingOptions: { departureTime: new Date(), trafficModel: window.google.maps.TrafficModel?.PESSIMISTIC ?? 'pessimistic' }
    }, (result, status) => {
      setRouteToRestaurantLoading(false);
      if (status !== 'OK' || !result.routes?.length) { toast.error('No se pudo recalcular la ruta.'); return; }
      const summaries = result.routes.map((route, idx) => {
        const leg = route.legs?.[0];
        const dur = leg?.duration?.value ?? 0;
        return { index: idx, duration: dur, durationInTraffic: leg?.duration_in_traffic?.value ?? dur,
          distanceText: leg?.distance?.text ?? '', durationText: leg?.duration?.text ?? '',
          durationInTrafficText: leg?.duration_in_traffic?.text ?? leg?.duration?.text ?? '' };
      });
      const first = summaries[0];
      setRouteToRestaurant(prev => prev ? {
        ...prev, fullResult: result, routes: result.routes, routeSummaries: summaries,
        selectedRouteIndex: 0, distanceText: first.distanceText, durationText: first.durationInTrafficText || first.durationText
      } : null);
      setCurrentStepIndex(0);
      lastSpokenStepRef.current = -1;
      toast.success('Ruta recalculada.');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation, routeToRestaurant?.destination]);

  const handleOpenInGoogleMaps = useCallback(() => {
    if (!routeToRestaurant?.destination || !driverLocation) return;
    const { lat: dlat, lng: dlng } = driverLocation;
    const { lat: rlat, lng: rlng } = routeToRestaurant.destination;
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = `google.navigation:q=${rlat},${rlng}`;
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${dlat},${dlng}&destination=${rlat},${rlng}&travelmode=driving`, '_blank', 'noopener,noreferrer');
    }
    toast.success('Abriendo Google Maps');
  }, [routeToRestaurant?.destination, driverLocation]);

  const handleOpenInWaze = useCallback(() => {
    if (!routeToRestaurant?.destination) return;
    const { lat, lng } = routeToRestaurant.destination;
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank', 'noopener,noreferrer');
    toast.success('Abriendo Waze');
  }, [routeToRestaurant?.destination]);

  // Centrar mapa en el conductor durante navegación
  useEffect(() => {
    if (!navigationMode || !driverLocation || !mapRef.current) return;
    mapRef.current.panTo(driverLocation);
    mapRef.current.setZoom(17);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationMode, driverLocation?.lat, driverLocation?.lng]);

  // Voz: leer la instrucción actual cuando cambia en modo navegación
  useEffect(() => {
    if (!navigationMode || !navigationSteps.length || currentStepIndex >= navigationSteps.length) return;
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

  const handleCenterMe = useCallback(() => {
    if (driverLocation && mapRef.current) {
      mapRef.current.panTo(driverLocation);
      mapRef.current.setZoom(navigationMode ? 17 : 16);
    }
    onCenterMe?.();
  }, [driverLocation, onCenterMe, navigationMode]);

  // Directions solo con la ruta seleccionada (para DirectionsRenderer)
  const routeToRestaurantDirections = useMemo(() => {
    if (!routeToRestaurant?.fullResult?.routes?.length) return null;
    const idx = routeToRestaurant.selectedRouteIndex ?? 0;
    const singleRoute = routeToRestaurant.fullResult.routes[idx];
    if (!singleRoute) return null;
    return { ...routeToRestaurant.fullResult, routes: [singleRoute] };
  }, [routeToRestaurant?.fullResult, routeToRestaurant?.selectedRouteIndex]);

  // ─── Estilos ─────────────────────────────────────────────────────────────────

  const containerStyle = {
    width: '100%',
    height: typeof mapHeight === 'number' ? `${mapHeight}px` : mapHeight,
    borderRadius: isFullScreen ? '0' : '8px'
  };

  // Posición del botón "Ir": más abajo en full-screen para no chocar con el header
  const irButtonBottom = isFullScreen ? 'bottom-8' : 'bottom-5';

  // ─── Guardas de renderizado ──────────────────────────────────────────────────

  if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${className}`}>
        <p className="text-gray-600">Configurá REACT_APP_GOOGLE_MAPS_API_KEY para ver el mapa.</p>
      </div>
    );
  }

  if (mapLoadError) {
    const isReferer = String(mapLoadError).toLowerCase().includes('referer') || String(mapLoadError).toLowerCase().includes('authorized');
    return (
      <div className={`bg-amber-50 border-2 border-amber-300 rounded-lg p-6 text-center ${className}`}>
        <p className="font-semibold text-amber-900 mb-2">No se pudo cargar el mapa</p>
        {isReferer ? (
          <>
            <p className="text-amber-800 text-sm mb-3">
              Dominio no autorizado. Agregá <code className="bg-amber-100 px-1 rounded">https://holy-tacos.vercel.app/*</code> en los HTTP referrers de tu API key en Google Cloud Console.
            </p>
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
              Abrir Google Cloud Console →
            </a>
          </>
        ) : (
          <p className="text-amber-800 text-sm">{String(mapLoadError)}</p>
        )}
      </div>
    );
  }

  // ─── Contenido del mapa ──────────────────────────────────────────────────────

  const mapContent = (
    <>
      {/* Overlay: info de la orden activa (ETA total de ambos tramos) */}
      {activeOrder && !navigationMode && (
        <div className={`absolute left-2 right-2 z-10 bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-md px-3 py-2 ${isFullScreen ? 'top-16' : 'top-2'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">
                Orden #{String(activeOrder._id).slice(-6)}
                {activeOrder.restaurantId?.name ? ` · ${activeOrder.restaurantId.name}` : ''}
              </p>
              {routeInfo ? (
                <p className="text-xs text-green-700 mt-0.5">
                  {routeInfo.distanceText} · ~{routeInfo.durationText} en total
                </p>
              ) : directionsLoading ? (
                <p className="text-xs text-gray-400 mt-0.5 animate-pulse">Calculando ruta...</p>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">Calculando ruta...</p>
              )}
            </div>
            {/* Leyenda de colores de las rutas */}
            <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-4 h-1.5 rounded-full bg-blue-600 inline-block" /> Vos→Rest.
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 h-1.5 rounded-full bg-orange-500 inline-block" /> Rest.→Cliente
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Panel de ruta seleccionada por doble clic (antes del modo navegación) */}
      {routeToRestaurant && !navigationMode && (
        <div className={`absolute left-2 right-2 z-10 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-4 space-y-3 ${isFullScreen ? 'top-16' : 'top-2'}`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900">Ruta a {routeToRestaurant.restaurantName}</p>
              <p className="text-sm text-gray-600">{routeToRestaurant.distanceText} · ~{routeToRestaurant.durationText}</p>
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

          {/* Selector de ruta alternativa cuando hay más de una opción */}
          {routeToRestaurant.routeSummaries?.length > 1 && (
            <select
              value={routeToRestaurant.selectedRouteIndex ?? 0}
              onChange={e => {
                const idx = parseInt(e.target.value, 10);
                setRouteToRestaurant(prev => prev ? {
                  ...prev, selectedRouteIndex: idx,
                  distanceText: prev.routeSummaries[idx].distanceText,
                  durationText: prev.routeSummaries[idx].durationInTrafficText || prev.routeSummaries[idx].durationText
                } : null);
              }}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
            >
              {routeToRestaurant.routeSummaries.map((r, i) => (
                <option key={i} value={i}>Opción {i + 1}: {r.distanceText} · {r.durationInTrafficText || r.durationText}</option>
              ))}
            </select>
          )}

          {/* Botones de acción: Navegar (Google Maps), instrucciones en pantalla, Waze */}
          <button
            type="button"
            onClick={handleOpenInGoogleMaps}
            className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-xl shadow hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Navegar en Google Maps
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={handleOpenInWaze}
              className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Waze
            </button>
            <button type="button" onClick={handleStartNavigation}
              className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Instrucciones aquí
            </button>
          </div>
        </div>
      )}

      {/* Panel de navegación paso a paso (modo navegación activo) */}
      {navigationMode && routeToRestaurant && (
        <NavigationPanel
          steps={navigationSteps}
          currentStepIndex={currentStepIndex}
          routeDistanceText={routeToRestaurant.distanceText}
          routeDurationText={routeToRestaurant.durationText}
          onRecalculate={handleRecalculateRoute}
          onEnd={handleEndNavigation}
          onOpenGoogleMaps={handleOpenInGoogleMaps}
          onOpenWaze={handleOpenInWaze}
          isRecalculating={routeToRestaurantLoading}
          isFullScreen={isFullScreen}
        />
      )}

      {/* Indicador de carga de ruta */}
      {routeToRestaurantLoading && (
        <div className={`absolute left-2 z-10 bg-white/95 rounded-lg shadow px-3 py-2 text-sm text-gray-600 flex items-center gap-2 ${isFullScreen ? 'top-16' : 'top-2'}`}>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          Calculando ruta...
        </div>
      )}

      {/* Botón "Ir" — se muestra en cuanto hay una orden activa; pulsa mientras las rutas cargan */}
      {activeOrder && !navigationMode && !routeToRestaurant && (
        <button
          type="button"
          onClick={handleGoToActiveOrder}
          disabled={routeToRestaurantLoading}
          className={`absolute left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-10 py-4
            bg-blue-600 text-white text-xl font-bold rounded-full shadow-2xl
            hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-70
            ${!(driverToRestaurantDirections || restaurantToClientDirections) ? 'animate-pulse' : ''}
            ${irButtonBottom}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
          </svg>
          Ir
        </button>
      )}

      {/* Botón centrar en mi posición (oculto en modo navegación ya que el mapa sigue al driver) */}
      {!navigationMode && (
        <button
          type="button"
          onClick={handleCenterMe}
          disabled={!driverLocation}
          className={`absolute right-4 z-10 p-3 bg-white rounded-full shadow-lg border border-gray-200
            hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors
            ${irButtonBottom}`}
          title="Centrar en mi posición"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06z" />
          </svg>
        </button>
      )}

      {/* Aviso cuando no hay restaurantes activos (solo en modo normal sin orden) */}
      {restaurantMarkers.length === 0 && scriptLoaded && !activeOrder && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800 shadow whitespace-nowrap">
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
        {/* Ruta seleccionada por doble clic en un restaurante */}
        {routeToRestaurantDirections && (
          <DirectionsRenderer
            directions={routeToRestaurantDirections}
            options={{ polylineOptions: { strokeColor: '#2563EB', strokeWeight: 5, strokeOpacity: 0.95 }, suppressMarkers: true }}
          />
        )}

        {/* Tramo 1: driver → restaurante (azul sólida gruesa) */}
        {!routeToRestaurantDirections && driverToRestaurantDirections && (
          <DirectionsRenderer
            directions={driverToRestaurantDirections}
            options={{ polylineOptions: { strokeColor: '#2563EB', strokeWeight: 5, strokeOpacity: 0.9 }, suppressMarkers: true }}
          />
        )}

        {/* Tramo 2: restaurante → cliente (naranja, opacidad levemente menor para distinguir) */}
        {!routeToRestaurantDirections && restaurantToClientDirections && (
          <DirectionsRenderer
            directions={restaurantToClientDirections}
            options={{
              polylineOptions: {
                strokeColor: '#f97316',
                strokeWeight: 4,
                strokeOpacity: 0.85,
                icons: [{
                  icon: { path: window.google?.maps?.SymbolPath?.FORWARD_OPEN_ARROW },
                  offset: '0',
                  repeat: '28px'
                }]
              },
              suppressMarkers: true
            }}
          />
        )}
      </GoogleMap>
    </>
  );

  const loadingPlaceholder = (
    <div className="flex items-center justify-center rounded-lg bg-gray-100" style={containerStyle}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="ml-3 text-gray-500">Cargando mapa...</span>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
        libraries={GOOGLE_MAP_LIBRARIES}
        onLoad={() => { setScriptLoaded(true); setMapLoadError(null); }}
        onError={e => setMapLoadError(e?.message || e || 'Error al cargar Google Maps')}
      >
        {!scriptLoaded ? loadingPlaceholder : mapContent}
      </LoadScript>
    </div>
  );
};

export default DriverMap;
