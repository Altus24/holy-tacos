// Mapa permanente para el conductor: ubicación en tiempo real, restaurantes activos con fitBounds,
// doble clic en pin → ruta con tráfico, navegación en pantalla (instrucciones paso a paso, seguir conductor)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  GoogleMap,
  LoadScript,
  DirectionsRenderer
} from '@react-google-maps/api';
import { useNavigationSteps } from '../../hooks/useNavigationSteps';
import NavigationPanel from './NavigationPanel';

const GOOGLE_MAP_LIBRARIES = ['places', 'marker'];

const MAP_OPTIONS = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
  ],
  // Para AdvancedMarkerElement Google exige un mapId válido. Se inyecta vía env del frontend.
  mapId: process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || undefined
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
  const [driverToRestaurantDirections, setDriverToRestaurantDirections] = useState(null);
  const [restaurantToClientDirections, setRestaurantToClientDirections] = useState(null);
  const [driverToRestaurantInfo, setDriverToRestaurantInfo] = useState(null);
  const [restaurantToClientInfo, setRestaurantToClientInfo] = useState(null);
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
  const driverMarkerRef = useRef(null);
  const restaurantMarkersRef = useRef([]);
  const clientMarkerRef = useRef(null);

  // No marcar scriptLoaded desde window.google: el mapa debe montarse siempre dentro LoadScript tras onLoad

  // Coordenadas del cliente (orden activa)
  const deliveryCoords = useMemo(() => {
    if (activeOrder?.deliveryLocation?.lat == null) return null;
    return { lat: activeOrder.deliveryLocation.lat, lng: activeOrder.deliveryLocation.lng };
  }, [activeOrder?.deliveryLocation?.lat, activeOrder?.deliveryLocation?.lng]);
  const orderRestaurantCoords = useMemo(() => {
    if (activeOrder?.restaurantLocation) {
      return { lat: activeOrder.restaurantLocation.lat, lng: activeOrder.restaurantLocation.lng };
    }
    if (activeOrder?.restaurantId?.location?.coordinates?.length >= 2) {
      return { lat: activeOrder.restaurantId.location.coordinates[1], lng: activeOrder.restaurantId.location.coordinates[0] };
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.restaurantLocation?.lat, activeOrder?.restaurantLocation?.lng, activeOrder?.restaurantId?.location?.coordinates]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    driverLocation?.lat,
    driverLocation?.lng,
    deliveryCoords?.lat,
    deliveryCoords?.lng,
    orderRestaurantCoords?.lat,
    orderRestaurantCoords?.lng,
    restaurantMarkers.length
  ]);

  // Calcular ruta driver → restaurante (tramo 1)
  const calculateDriverToRestaurant = useCallback(() => {
    if (!driverLocation || !orderRestaurantCoords || !window.google?.maps) {
      setDriverToRestaurantDirections(null);
      setDriverToRestaurantInfo(null);
      return;
    }

    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(orderRestaurantCoords.lat, orderRestaurantCoords.lng);
    const svc = new window.google.maps.DirectionsService();

    setDirectionsLoading(true);
    svc.route(
      { origin, destination, travelMode: 'DRIVING' },
      (result, status) => {
        if (status === 'OK' && result.routes?.length) {
          setDriverToRestaurantDirections(result);
          const route = result.routes[0];
          if (route?.legs?.length) {
            const totalDistance = route.legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0);
            const totalDuration = route.legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0);
            setDriverToRestaurantInfo({
              distanceMeters: totalDistance,
              durationSeconds: totalDuration,
              distanceText: (totalDistance / 1000).toFixed(1) + ' km',
              durationText: Math.ceil(totalDuration / 60) + ' min'
            });
          } else {
            setDriverToRestaurantInfo(null);
          }
        } else {
          setDriverToRestaurantDirections(null);
          setDriverToRestaurantInfo(null);
        }
        setDirectionsLoading(false);
      }
    );
  }, [driverLocation, orderRestaurantCoords]);

  // Calcular ruta restaurante → cliente (tramo 2)
  const calculateRestaurantToClient = useCallback(() => {
    if (!orderRestaurantCoords || !deliveryCoords || !window.google?.maps) {
      setRestaurantToClientDirections(null);
      setRestaurantToClientInfo(null);
      return;
    }

    const origin = new window.google.maps.LatLng(orderRestaurantCoords.lat, orderRestaurantCoords.lng);
    const destination = new window.google.maps.LatLng(deliveryCoords.lat, deliveryCoords.lng);
    const svc = new window.google.maps.DirectionsService();

    setDirectionsLoading(true);
    svc.route(
      { origin, destination, travelMode: 'DRIVING' },
      (result, status) => {
        if (status === 'OK' && result.routes?.length) {
          setRestaurantToClientDirections(result);
          const route = result.routes[0];
          if (route?.legs?.length) {
            const totalDistance = route.legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0);
            const totalDuration = route.legs.reduce((acc, leg) => acc + (leg.duration?.value || 0), 0);
            setRestaurantToClientInfo({
              distanceMeters: totalDistance,
              durationSeconds: totalDuration,
              distanceText: (totalDistance / 1000).toFixed(1) + ' km',
              durationText: Math.ceil(totalDuration / 60) + ' min'
            });
          } else {
            setRestaurantToClientInfo(null);
          }
        } else {
          setRestaurantToClientDirections(null);
          setRestaurantToClientInfo(null);
        }
        setDirectionsLoading(false);
      }
    );
  }, [orderRestaurantCoords, deliveryCoords]);

  // ETA total sumando ambos tramos (si existen)
  useEffect(() => {
    const totalDistance =
      (driverToRestaurantInfo?.distanceMeters || 0) +
      (restaurantToClientInfo?.distanceMeters || 0);
    const totalDuration =
      (driverToRestaurantInfo?.durationSeconds || 0) +
      (restaurantToClientInfo?.durationSeconds || 0);

    if (!totalDistance || !totalDuration) {
      setRouteInfo(null);
      return;
    }

    setRouteInfo({
      distanceText: (totalDistance / 1000).toFixed(1) + ' km',
      durationText: Math.ceil(totalDuration / 60) + ' min'
    });
  }, [driverToRestaurantInfo, restaurantToClientInfo]);

  // Debounce: recalcular rutas al moverse el driver o cambiar la orden (cada 2.5 s como máximo)
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

    return () => {
      if (directionsDebounceRef.current) clearTimeout(directionsDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scriptLoaded,
    activeOrder?._id,
    driverLocation?.lat,
    driverLocation?.lng,
    orderRestaurantCoords?.lat,
    orderRestaurantCoords?.lng,
    deliveryCoords?.lat,
    deliveryCoords?.lng,
    calculateDriverToRestaurant,
    calculateRestaurantToClient
  ]);

  /**
   * Doble clic en pin de restaurante: calcular ruta con tráfico y alternativas.
   * Usa drivingOptions (departureTime, trafficModel) y provideRouteAlternatives.
   * Muestra toasts si hay tráfico pesado o si se elige ruta alternativa automáticamente.
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantMarkers.length, driverLocation]);

  // Limpiar capa de tráfico al desmontar
  useEffect(() => {
    return () => {
      if (trafficLayerRef.current?.setMap) trafficLayerRef.current.setMap(null);
    };
  }, []);

  // Limpiar marcadores al desmontar
  useEffect(() => {
    return () => {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.map = null;
        driverMarkerRef.current = null;
      }
      if (clientMarkerRef.current) {
        clientMarkerRef.current.map = null;
        clientMarkerRef.current = null;
      }
      if (restaurantMarkersRef.current.length) {
        restaurantMarkersRef.current.forEach(m => {
          if (m) m.map = null;
        });
        restaurantMarkersRef.current = [];
      }
    };
  }, []);

  // Crear/actualizar marcadores usando AdvancedMarkerElement (Google Maps JS API moderno)
  useEffect(() => {
    if (
      !scriptLoaded ||
      !mapRef.current ||
      !window.google?.maps?.marker?.AdvancedMarkerElement
    ) {
      return;
    }

    const AdvancedMarkerElement = window.google.maps.marker.AdvancedMarkerElement;

    // Marcador del driver
    if (driverLocation?.lat != null && driverLocation?.lng != null) {
      const position = { lat: driverLocation.lat, lng: driverLocation.lng };
      if (!driverMarkerRef.current) {
        driverMarkerRef.current = new AdvancedMarkerElement({
          map: mapRef.current,
          position,
          title: 'Tu posición'
        });
      } else {
        driverMarkerRef.current.position = position;
        driverMarkerRef.current.title = 'Tu posición';
      }
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.map = null;
      driverMarkerRef.current = null;
    }

    // Marcadores de restaurantes
    if (restaurantMarkersRef.current.length) {
      restaurantMarkersRef.current.forEach(m => {
        if (m) m.map = null;
      });
      restaurantMarkersRef.current = [];
    }
    if (restaurantMarkers.length) {
      restaurantMarkersRef.current = restaurantMarkers.map(r => {
        const pos = { lat: r.lat, lng: r.lng };
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: pos,
          title: r.name || 'Restaurante'
        });
        marker.addListener?.('dblclick', () => handleRestaurantDblClick(r));
        return marker;
      });
    }

    // Marcador del cliente (dirección de entrega)
    if (deliveryCoords?.lat != null && deliveryCoords?.lng != null) {
      const position = { lat: deliveryCoords.lat, lng: deliveryCoords.lng };
      if (!clientMarkerRef.current) {
        clientMarkerRef.current = new AdvancedMarkerElement({
          map: mapRef.current,
          position,
          title: 'Dirección de entrega'
        });
      } else {
        clientMarkerRef.current.position = position;
        clientMarkerRef.current.title = 'Dirección de entrega';
      }
    } else if (clientMarkerRef.current) {
      clientMarkerRef.current.map = null;
      clientMarkerRef.current = null;
    }
  }, [
    scriptLoaded,
    driverLocation?.lat,
    driverLocation?.lng,
    restaurantMarkers,
    deliveryCoords?.lat,
    deliveryCoords?.lng,
    handleRestaurantDblClick
  ]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeToRestaurant?.destination, driverLocation]);

  /**
   * Botón "Ir" para la orden activa:
   * - En Android abre la app de Google Maps con navegación.
   * - En web inicia la navegación en pantalla reutilizando el panel de instrucciones.
   */
  const handleGoToActiveOrder = useCallback(() => {
    if (!activeOrder || !driverLocation || !orderRestaurantCoords || !window.google?.maps) return;

    const isAndroid = /Android/i.test(navigator.userAgent);
    const { lat, lng } = orderRestaurantCoords;

    if (isAndroid) {
      window.location.href = `google.navigation:q=${lat},${lng}`;
      toast.success('Abriendo Google Maps');
      return;
    }

    // Web: calcular ruta driver → restaurante y activar modo navegación en pantalla
    setRouteToRestaurant(null);
    setRouteToRestaurantLoading(true);

    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(lat, lng);
    const svc = new window.google.maps.DirectionsService();
    const restaurant = {
      lat,
      lng,
      name: activeOrder.restaurantId?.name || activeOrder.restaurantName || 'Restaurante'
    };

    const request = {
      origin,
      destination,
      travelMode: 'DRIVING'
    };

    svc.route(request, (result, status) => {
      setRouteToRestaurantLoading(false);
      if (status !== 'OK' || !result.routes?.length) {
        toast.error('No se pudo calcular la ruta para la orden.');
        return;
      }

      const route = result.routes[0];
      const leg = route?.legs?.[0];
      const duration = leg?.duration?.value ?? 0;
      const durationInTraffic = leg?.duration_in_traffic?.value ?? duration;
      const distanceText = leg?.distance?.text ?? '';
      const durationText = leg?.duration?.text ?? '';

      const routeSummaries = [{
        index: 0,
        duration,
        durationInTraffic,
        distanceText,
        durationText,
        durationInTrafficText: leg?.duration_in_traffic?.text ?? durationText
      }];

      setRouteToRestaurant({
        fullResult: result,
        restaurantName: restaurant.name,
        destination: { lat: restaurant.lat, lng: restaurant.lng },
        routes: result.routes,
        routeSummaries,
        selectedRouteIndex: 0,
        distanceText,
        durationText: leg?.duration_in_traffic?.text ?? durationText
      });

      setNavigationMode(true);
      setCurrentStepIndex(0);
      lastSpokenStepRef.current = -1;
      toast.success('Navegación iniciada. Seguí las instrucciones en pantalla.');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder, driverLocation, orderRestaurantCoords]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation, routeToRestaurant?.destination]);

  /** En modo navegación, centrar mapa en el conductor al actualizar ubicación */
  useEffect(() => {
    if (!navigationMode || !driverLocation || !mapRef.current) return;
    mapRef.current.panTo(driverLocation);
    mapRef.current.setZoom(17);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationMode, driverLocation?.lat, driverLocation?.lng]);

  const handleCenterMe = useCallback(() => {
    if (driverLocation && mapRef.current) {
      mapRef.current.panTo(driverLocation);
      mapRef.current.setZoom(navigationMode ? 17 : 16);
    }
    onCenterMe?.();
  }, [driverLocation, onCenterMe, navigationMode]);

  const containerStyle = {
    width: '100%',
    height: typeof mapHeight === 'number' ? `${mapHeight}px` : mapHeight,
    borderRadius: '8px'
  };

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

            {/* Botón móvil "Ir" para la orden activa: inicia navegación hacia el restaurante */}
            {activeOrder && !navigationMode && !routeToRestaurant && (driverToRestaurantDirections || restaurantToClientDirections) && (
              <button
                type="button"
                onClick={handleGoToActiveOrder}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-6 py-3 bg-blue-600 text-white text-base font-semibold rounded-full shadow-lg hover:bg-blue-700"
              >
                Ir
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
              />
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

              {/* Ruta seleccionada por doble clic en restaurante (tiene prioridad sobre la ruta de la orden activa) */}
              {routeToRestaurantDirections && (
                <DirectionsRenderer
                  directions={routeToRestaurantDirections}
                  options={{
                    polylineOptions: { strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.9 },
                    suppressMarkers: true
                  }}
                />
              )}

              {/* Rutas de la orden activa: driver → restaurante (sólida azul) y restaurante → cliente (naranja punteada) */}
              {!routeToRestaurantDirections && driverToRestaurantDirections && (
                <DirectionsRenderer
                  directions={driverToRestaurantDirections}
                  options={{
                    polylineOptions: { strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.9 },
                    suppressMarkers: true
                  }}
                />
              )}

              {!routeToRestaurantDirections && restaurantToClientDirections && (
                <DirectionsRenderer
                  directions={restaurantToClientDirections}
                  options={{
                    polylineOptions: {
                      strokeColor: '#f97316',
                      strokeWeight: 4,
                      strokeOpacity: 0.9,
                      // Patrón punteado usando iconos espaciados
                      icons: [{
                        icon: {
                          path: window.google?.maps?.SymbolPath?.FORWARD_OPEN_ARROW || window.google?.maps?.SymbolPath?.CIRCLE
                        },
                        offset: '0',
                        repeat: '24px'
                      }]
                    },
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
        libraries={GOOGLE_MAP_LIBRARIES}
        onLoad={() => setScriptLoaded(true)}
      >
        {!scriptLoaded ? loadingPlaceholder : mapContent}
      </LoadScript>
    </div>
  );
};

export default DriverMap;
