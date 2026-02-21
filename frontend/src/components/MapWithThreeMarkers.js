// Componente MapWithThreeMarkers para Holy Tacos
// Muestra un mapa con 3 marcadores (restaurante, cliente, driver) y ruta calculada con ETA
import React, { useState, useEffect, useCallback } from 'react';
import {
  GoogleMap,
  LoadScript,
  Marker,
  DirectionsRenderer
} from '@react-google-maps/api';

// Estilos del contenedor del mapa
const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '420px',
  borderRadius: '0.75rem'
};

// Opciones visuales del mapa
const MAP_OPTIONS = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

/**
 * MapWithThreeMarkers
 *
 * Props:
 * - restaurantLocation: { lat, lng } | null
 * - deliveryLocation:   { lat, lng } | null
 * - driverLocation:     { lat, lng } | null (actualizado en tiempo real)
 * - showRoute:          boolean (mostrar polyline de la ruta)
 * - showETA:            boolean (mostrar distancia/tiempo estimado)
 * - className:          clases extra para el contenedor
 */
const MapWithThreeMarkers = ({
  restaurantLocation,
  deliveryLocation,
  driverLocation,
  showRoute = true,
  showETA = true,
  className = ''
}) => {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [center, setCenter] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Calcular centro del mapa en función de las coordenadas disponibles
  useEffect(() => {
    const points = [restaurantLocation, deliveryLocation, driverLocation].filter(Boolean);
    if (points.length === 0) return;

    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    setCenter({ lat: avgLat, lng: avgLng });
  }, [restaurantLocation, deliveryLocation, driverLocation]);

  // Calcular ruta driver → restaurante (si existe) → cliente
  const calculateDirections = useCallback(() => {
    if (!driverLocation || !deliveryLocation) return;
    if (typeof window === 'undefined' || !window.google?.maps) return;

    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(deliveryLocation.lat, deliveryLocation.lng);

    const waypoints = restaurantLocation
      ? [{
          location: new window.google.maps.LatLng(restaurantLocation.lat, restaurantLocation.lng),
          stopover: true
        }]
      : [];

    const request = {
      origin,
      destination,
      waypoints,
      travelMode: 'DRIVING',
      optimizeWaypoints: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: 'best_guess'
      }
    };

    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(request, (result, status) => {
      if (status === 'OK') {
        setDirectionsResponse(result);
        const route = result.routes[0];
        if (route && route.legs.length > 0) {
          const totalDistance = route.legs.reduce((acc, leg) => acc + leg.distance.value, 0);
          const totalDuration = route.legs.reduce((acc, leg) => acc + leg.duration.value, 0);
          setRouteInfo({
            distanceText: (totalDistance / 1000).toFixed(1) + ' km',
            durationText: Math.ceil(totalDuration / 60) + ' min'
          });
        }
      }
    });
  }, [driverLocation, deliveryLocation, restaurantLocation]);

  // Recalcular ruta cuando cambie la ubicación del driver o se cargue el script
  useEffect(() => {
    if (scriptLoaded && showRoute && driverLocation && deliveryLocation) {
      setIsLoading(false);
      calculateDirections();
    }
  }, [scriptLoaded, showRoute, driverLocation, deliveryLocation, calculateDirections]);

  // Iconos personalizados para cada marcador
  const getIcons = () => {
    if (typeof window === 'undefined' || !window.google?.maps) return null;
    return {
      restaurant: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="#f97316" stroke="white" stroke-width="2"/>
            <path d="M14 16h12v8H14z" fill="white"/>
            <path d="M16 12h8v4h-8z" fill="white"/>
            <circle cx="26" cy="14" r="2" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 40)
      },
      delivery: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="#10b981" stroke="white" stroke-width="2"/>
            <path d="M12 18h16v6H12z" fill="white"/>
            <path d="M16 14h8v4h-8z" fill="white"/>
            <circle cx="28" cy="16" r="2" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 40)
      },
      driver: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="#3b82f6" stroke="white" stroke-width="3"/>
            <path d="M12 22h16l-3-6h-10z" fill="white"/>
            <circle cx="16" cy="18" r="1.5" fill="white"/>
            <circle cx="24" cy="18" r="1.5" fill="white"/>
            <circle cx="20" cy="26" r="2" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 40)
      }
    };
  };

  if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${className}`}>
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Clave de Google Maps no configurada
        </h3>
        <p className="text-gray-600">
          Configurá REACT_APP_GOOGLE_MAPS_API_KEY en el archivo .env para ver el mapa.
        </p>
      </div>
    );
  }

  const icons = scriptLoaded ? getIcons() : null;

  return (
    <div className={className}>
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
        libraries={['places']}
        onLoad={() => setScriptLoaded(true)}
      >
        {!scriptLoaded || !center || !icons ? (
          <div
            className="flex items-center justify-center rounded-lg bg-gray-100 border-2 border-dashed border-gray-300"
            style={{ height: MAP_CONTAINER_STYLE.height }}
          >
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
              <span className="text-gray-600">Cargando mapa...</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Overlay de carga mientras se calcula la ruta */}
            {isLoading && showRoute && (
              <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                  <span className="text-gray-600 text-sm">Calculando ruta...</span>
                </div>
              </div>
            )}

            {/* Información de ruta (distancia / tiempo estimado) */}
            {showETA && routeInfo && (
              <div className="absolute top-3 right-3 bg-white shadow-lg rounded-lg p-3 z-10 min-w-[180px]">
                <div className="text-sm font-medium text-gray-900 mb-1">📍 Información del viaje</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>🚗 Distancia: {routeInfo.distanceText}</div>
                  <div>⏱️ Tiempo estimado: {routeInfo.durationText}</div>
                </div>
              </div>
            )}

            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={center}
              zoom={13}
              options={MAP_OPTIONS}
            >
              {/* Marcador del restaurante */}
              {restaurantLocation && (
                <Marker
                  position={restaurantLocation}
                  icon={icons.restaurant}
                  title="Restaurante"
                />
              )}

              {/* Marcador del cliente */}
              {deliveryLocation && (
                <Marker
                  position={deliveryLocation}
                  icon={icons.delivery}
                  title="Dirección de entrega"
                />
              )}

              {/* Marcador del driver */}
              {driverLocation && (
                <Marker
                  position={driverLocation}
                  icon={icons.driver}
                  title="Conductor"
                  animation={window.google?.maps?.Animation?.BOUNCE}
                />
              )}

              {/* Polyline de la ruta calculada */}
              {directionsResponse && showRoute && (
                <DirectionsRenderer
                  directions={directionsResponse}
                  options={{
                    polylineOptions: {
                      strokeColor: '#2563eb',
                      strokeWeight: 4,
                      strokeOpacity: 0.9
                    },
                    suppressMarkers: true
                  }}
                />
              )}
            </GoogleMap>
          </div>
        )}
      </LoadScript>
    </div>
  );
};

export default MapWithThreeMarkers;

