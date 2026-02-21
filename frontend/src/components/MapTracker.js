// Componente MapTracker para Holy Tacos
// Muestra mapa interactivo con seguimiento en tiempo real del driver
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GoogleMap,
  LoadScript,
  Marker,
  DirectionsRenderer,
  DirectionsService
} from '@react-google-maps/api';

// Estilos del mapa
const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '8px'
};

// Opciones por defecto del mapa
const defaultMapOptions = {
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

const MapTracker = ({
  restaurantAddress,
  deliveryAddress,
  driverLocation,
  onLocationUpdate,
  className = '',
  showRoute = true,
  showETA = true
}) => {
  const [map, setMap] = useState(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [restaurantCoords, setRestaurantCoords] = useState(null);
  const [deliveryCoords, setDeliveryCoords] = useState(null);
  const [currentDriverLocation, setCurrentDriverLocation] = useState(driverLocation);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [routeInfo, setRouteInfo] = useState(null);

  // Referencias para geocoding
  const geocoderRef = useRef(null);

  // Centro del mapa (se calcula dinámicamente)
  const [center, setCenter] = useState({
    lat: 19.4326, // Ciudad de México por defecto
    lng: -99.1332
  });

  // Callback cuando el mapa se carga (solo se ejecuta cuando el script ya está listo)
  const onMapLoad = useCallback((map) => {
    setMap(map);
    if (typeof window !== 'undefined' && window.google?.maps) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
    console.log('🗺️ Mapa cargado correctamente');
  }, []);

  // Geocoding: convertir dirección a coordenadas
  const geocodeAddress = async (address) => {
    return new Promise((resolve, reject) => {
      if (!geocoderRef.current) {
        reject(new Error('Geocoder no disponible'));
        return;
      }

      geocoderRef.current.geocode({ address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          reject(new Error(`Error en geocoding: ${status}`));
        }
      });
    });
  };

  // Calcular direcciones y ruta (solo cuando la API de Google está disponible)
  const calculateDirections = useCallback(() => {
    if (!restaurantCoords || !deliveryCoords || !currentDriverLocation) {
      return;
    }
    if (typeof window === 'undefined' || !window.google?.maps) {
      return;
    }

    // Origen: ubicación actual del driver
    const origin = new window.google.maps.LatLng(
      currentDriverLocation.lat,
      currentDriverLocation.lng
    );

    // Destino: dirección de entrega del cliente
    const destination = new window.google.maps.LatLng(
      deliveryCoords.lat,
      deliveryCoords.lng
    );

    // Paradas intermedias: restaurante (opcional)
    const waypoints = restaurantCoords ? [{
      location: new window.google.maps.LatLng(
        restaurantCoords.lat,
        restaurantCoords.lng
      ),
      stopover: true
    }] : [];

    // Configurar solicitud de direcciones
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

    // Crear servicio de direcciones
    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(request, (result, status) => {
      if (status === 'OK') {
        setDirectionsResponse(result);

        // Extraer información de la ruta
        const route = result.routes[0];
        if (route && route.legs.length > 0) {
          const totalDistance = route.legs.reduce((total, leg) => total + leg.distance.value, 0);
          const totalDuration = route.legs.reduce((total, leg) => total + leg.duration.value, 0);

          setRouteInfo({
            distance: (totalDistance / 1000).toFixed(1), // km
            duration: Math.ceil(totalDuration / 60), // minutos
            distanceText: route.legs[route.legs.length - 1].distance.text,
            durationText: route.legs[route.legs.length - 1].duration.text
          });
        }
      } else {
        console.error('Error al calcular direcciones:', status);
        setError('Error al calcular la ruta');
      }
    });
  }, [restaurantCoords, deliveryCoords, currentDriverLocation]);

  // Inicializar coordenadas desde direcciones
  useEffect(() => {
    const initializeCoords = async () => {
      try {
        setIsLoading(true);
        setError('');

        // Geocoding del restaurante
        if (restaurantAddress) {
          try {
            const coords = await geocodeAddress(restaurantAddress);
            setRestaurantCoords(coords);
            console.log('🏪 Coordenadas del restaurante:', coords);
          } catch (error) {
            console.error('Error geocoding restaurante:', error);
            setError('Error al localizar el restaurante');
          }
        }

        // Geocoding de la dirección de entrega
        if (deliveryAddress) {
          try {
            const coords = await geocodeAddress(deliveryAddress);
            setDeliveryCoords(coords);
            console.log('🏠 Coordenadas de entrega:', coords);
          } catch (error) {
            console.error('Error geocoding entrega:', error);
            setError('Error al localizar la dirección de entrega');
          }
        }

      } catch (error) {
        console.error('Error inicializando coordenadas:', error);
        setError('Error al inicializar el mapa');
      } finally {
        setIsLoading(false);
      }
    };

    initializeCoords();
  }, [restaurantAddress, deliveryAddress]);

  // Actualizar ubicación del driver y recalcular ruta
  useEffect(() => {
    if (driverLocation) {
      setCurrentDriverLocation(driverLocation);
      console.log('🚗 Ubicación del driver actualizada:', driverLocation);
    }
  }, [driverLocation]);

  // Recalcular ruta cuando cambie la ubicación del driver
  useEffect(() => {
    if (showRoute && currentDriverLocation && deliveryCoords) {
      calculateDirections();
    }
  }, [currentDriverLocation, deliveryCoords, showRoute, calculateDirections]);

  // Ajustar el centro del mapa cuando se carguen las coordenadas
  useEffect(() => {
    if (restaurantCoords && deliveryCoords) {
      // Centro entre restaurante y entrega
      const centerLat = (restaurantCoords.lat + deliveryCoords.lat) / 2;
      const centerLng = (restaurantCoords.lng + deliveryCoords.lng) / 2;
      setCenter({ lat: centerLat, lng: centerLng });
    } else if (deliveryCoords) {
      // Centro en la entrega si no hay restaurante
      setCenter(deliveryCoords);
    } else if (restaurantCoords) {
      // Centro en el restaurante
      setCenter(restaurantCoords);
    }
  }, [restaurantCoords, deliveryCoords]);

  // Callback para actualizaciones de ubicación del driver
  useEffect(() => {
    if (onLocationUpdate) {
      onLocationUpdate(currentDriverLocation);
    }
  }, [currentDriverLocation, onLocationUpdate]);

  // Iconos personalizados para marcadores (solo cuando la API está cargada para evitar "reading 'maps' of undefined")
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

  const icons = scriptLoaded ? getIcons() : null;

  if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${className}`}>
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Clave de Google Maps no configurada
        </h3>
        <p className="text-gray-600">
          Configura REACT_APP_GOOGLE_MAPS_API_KEY en el archivo .env
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
        libraries={['places']}
        onLoad={() => setScriptLoaded(true)}
      >
        {!scriptLoaded || !icons ? (
          <div className="flex items-center justify-center rounded-lg bg-gray-100 border-2 border-dashed border-gray-300" style={{ height: mapContainerStyle.height }}>
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
              <span className="text-gray-600">Cargando mapa...</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Spinner de carga */}
            {isLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
                  <span className="text-gray-600">Cargando mapa...</span>
                </div>
              </div>
            )}

            {/* Mensaje de error */}
            {error && (
              <div className="absolute top-2 left-2 right-2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded z-10">
                {error}
              </div>
            )}

            {/* Información de ruta */}
            {showETA && routeInfo && (
              <div className="absolute top-2 right-2 bg-white shadow-lg rounded-lg p-3 z-10 min-w-48">
                <div className="text-sm font-medium text-gray-900 mb-1">📍 Información del viaje</div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>🚗 Distancia: {routeInfo.distanceText}</div>
                  <div>⏱️ Tiempo estimado: {routeInfo.durationText}</div>
                </div>
              </div>
            )}

            {/* Mapa de Google (solo cuando window.google está disponible) */}
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={13}
              options={defaultMapOptions}
              onLoad={onMapLoad}
            >
              {/* Marcador del restaurante */}
              {restaurantCoords && (
                <Marker
                  position={restaurantCoords}
                  icon={icons.restaurant}
                  title="Restaurante"
                />
              )}

              {/* Marcador de entrega */}
              {deliveryCoords && (
                <Marker
                  position={deliveryCoords}
                  icon={icons.delivery}
                  title="Dirección de entrega"
                />
              )}

              {/* Marcador del driver (móvil) */}
              {currentDriverLocation && (
                <Marker
                  position={currentDriverLocation}
                  icon={icons.driver}
                  title="Conductor"
                  animation={window.google?.maps?.Animation?.BOUNCE}
                />
              )}

              {/* Renderizar ruta */}
              {directionsResponse && showRoute && (
                <DirectionsRenderer
                  directions={directionsResponse}
                  options={{
                    polylineOptions: {
                      strokeColor: '#f97316',
                      strokeWeight: 4,
                      strokeOpacity: 0.8
                    },
                    suppressMarkers: true // No mostrar marcadores por defecto
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

export default MapTracker;