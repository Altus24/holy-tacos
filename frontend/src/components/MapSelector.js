// Componente MapSelector para Holy Tacos
// Permite seleccionar ubicación en Google Maps con geocoding y reverse geocoding
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  GoogleMap,
  LoadScript,
  Marker,
  useLoadScript,
  Autocomplete
} from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Configuración del mapa
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '8px'
};

const defaultCenter = {
  lat: -34.6037, // Buenos Aires como centro por defecto
  lng: -58.3816
};

// Libraries de Google Maps (debe ser estático para evitar recargas)
const libraries = ['places', 'geometry'];

const MapSelector = ({
  address = '',
  coordinates = null,
  onCoordinatesChange,
  onAddressChange,
  placeholder = "Ingresa una dirección para buscar..."
}) => {
  const [mapCenter, setMapCenter] = useState(coordinates || defaultCenter);
  const [markerPosition, setMarkerPosition] = useState(coordinates);
  const [searchAddress, setSearchAddress] = useState(address);
  const [isSearching, setIsSearching] = useState(false);
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);

  // Hook para verificar si Google Maps cargó correctamente
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries
  });

  // Función para geocodificar dirección (dirección → coordenadas)
  const geocodeAddress = useCallback(async (address) => {
    if (!address.trim() || !window.google) return;

    setIsSearching(true);
    try {
      const geocoder = new window.google.maps.Geocoder();

      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          const lat = location.lat();
          const lng = location.lng();

          const newCoords = { lat, lng };

          // Actualizar mapa y marcador
          setMapCenter(newCoords);
          setMarkerPosition(newCoords);

          // Notificar al componente padre
          onCoordinatesChange(newCoords);

          // Centrar el mapa en la nueva ubicación
          if (mapRef.current) {
            mapRef.current.panTo(newCoords);
            mapRef.current.setZoom(17); // Zoom más cercano para ver mejor
          }

          console.log('📍 Dirección geocodificada:', address, '→', newCoords);
        } else {
          console.warn('❌ No se pudo geocodificar la dirección:', status);
          // Mostrar mensaje de error más amigable
          const errorMessages = {
            'ZERO_RESULTS': 'No se encontró la dirección. Verifica que esté escrita correctamente.',
            'OVER_QUERY_LIMIT': 'Demasiadas búsquedas. Inténtalo en unos minutos.',
            'REQUEST_DENIED': 'Error de autenticación con Google Maps.',
            'INVALID_REQUEST': 'Dirección inválida.',
            'UNKNOWN_ERROR': 'Error desconocido. Inténtalo nuevamente.'
          };

          alert(errorMessages[status] || 'No se pudo encontrar la dirección. Inténtalo con una dirección más específica.');
        }
        setIsSearching(false);
      });
    } catch (error) {
      console.error('Error en geocoding:', error);
      alert('Error al buscar la dirección. Verifica tu conexión a internet.');
      setIsSearching(false);
    }
  }, [onCoordinatesChange]);

  // Función para reverse geocoding (coordenadas → dirección)
  const reverseGeocode = useCallback(async (latLng) => {
    if (!window.google) return;

    try {
      const geocoder = new window.google.maps.Geocoder();

      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const address = results[0].formatted_address;
          setSearchAddress(address);
          onAddressChange(address);
          console.log('📍 Coordenadas reverse geocodificadas:', latLng, '→', address);
        }
      });
    } catch (error) {
      console.error('Error en reverse geocoding:', error);
    }
  }, [onAddressChange]);

  // Manejador de clic en el mapa
  const handleMapClick = useCallback((event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const newCoords = { lat, lng };

    setMarkerPosition(newCoords);
    onCoordinatesChange(newCoords);

    // Reverse geocoding para obtener la dirección
    reverseGeocode(event.latLng);
  }, [onCoordinatesChange, reverseGeocode]);

  // Manejador de cambio en el input de dirección
  const handleAddressInputChange = (e) => {
    setSearchAddress(e.target.value);
    onAddressChange(e.target.value);
  };

  // Manejador de búsqueda de dirección
  const handleSearch = () => {
    if (searchAddress.trim()) {
      geocodeAddress(searchAddress);
    }
  };

  // Manejador de tecla Enter en el input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Callback cuando el mapa se carga
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;

    // Si ya tenemos coordenadas, centrar el mapa
    if (coordinates) {
      map.panTo(coordinates);
      map.setZoom(17);
    } else {
      // Intentar obtener la ubicación actual del usuario
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setMapCenter(userLocation);
            map.panTo(userLocation);
            console.log('📍 Centrando mapa en ubicación actual');
          },
          (error) => {
            console.warn('⚠️ No se pudo obtener ubicación actual:', error.message);
            // Mantener centro por defecto
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      }
    }
  }, [coordinates]);

  // Mostrar error si Google Maps no carga
  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">
          Error al cargar Google Maps. Verifica tu conexión a internet y la clave API.
        </p>
      </div>
    );
  }

  // Mostrar loading mientras carga
  if (!isLoaded) {
    return (
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-orange-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Cargando mapa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Input de búsqueda de dirección con autocompletado */}
      <div className="flex space-x-2">
        {isLoaded && (
          <Autocomplete
            onLoad={(autocomplete) => {
              autocompleteRef.current = autocomplete;
            }}
            onPlaceChanged={() => {
              if (autocompleteRef.current) {
                const place = autocompleteRef.current.getPlace();
                if (place.geometry) {
                  const lat = place.geometry.location.lat();
                  const lng = place.geometry.location.lng();
                  const newCoords = { lat, lng };

                  setSearchAddress(place.formatted_address || place.name);
                  setMapCenter(newCoords);
                  setMarkerPosition(newCoords);
                  onCoordinatesChange(newCoords);

                  if (mapRef.current) {
                    mapRef.current.panTo(newCoords);
                    mapRef.current.setZoom(17);
                  }

                  console.log('📍 Dirección seleccionada de autocomplete:', place.formatted_address);
                }
              }
            }}
            options={{
              componentRestrictions: { country: 'ar' }, // Restringir a Argentina
              fields: ['formatted_address', 'geometry', 'name'],
              types: ['address']
            }}
          >
            <input
              type="text"
              value={searchAddress}
              onChange={handleAddressInputChange}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
          </Autocomplete>
        )}
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !searchAddress.trim()}
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isSearching ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Buscando...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>Buscar</span>
            </>
          )}
        </button>
      </div>

      {/* Mapa */}
      <div className="relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={15}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          {/* Marcador de la ubicación seleccionada */}
          {markerPosition && (
            <Marker
              position={markerPosition}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" fill="#f97316" stroke="white" stroke-width="3"/>
                    <circle cx="20" cy="20" r="8" fill="white"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 40)
              }}
            />
          )}
        </GoogleMap>

        {/* Controles */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
          <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-md text-sm text-gray-600 dark:text-gray-400">
            📍 Click en el mapa para seleccionar ubicación
          </div>

          <button
            type="button"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const userLocation = {
                      lat: position.coords.latitude,
                      lng: position.coords.longitude
                    };
                    setMapCenter(userLocation);
                    setMarkerPosition(userLocation);
                    onCoordinatesChange(userLocation);
                    reverseGeocode({ lat: userLocation.lat, lng: userLocation.lng });

                    if (mapRef.current) {
                      mapRef.current.panTo(userLocation);
                      mapRef.current.setZoom(17);
                    }
                  },
                  (error) => {
                    console.warn('⚠️ No se pudo obtener ubicación actual:', error.message);
                    alert('No se pudo acceder a tu ubicación. Verifica los permisos del navegador.');
                  }
                );
              } else {
                alert('Tu navegador no soporta geolocalización.');
              }
            }}
            className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-2 rounded-lg shadow-md text-sm text-gray-600 dark:text-gray-400 transition-colors"
            title="Centrar en mi ubicación"
          >
            📍 Mi ubicación
          </button>
        </div>
      </div>

      {/* Información de coordenadas */}
      {markerPosition && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Latitud:</span>
              <span className="ml-2 font-mono">{markerPosition.lat.toFixed(6)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Longitud:</span>
              <span className="ml-2 font-mono">{markerPosition.lng.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapSelector;