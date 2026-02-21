// Componente LocationPicker reutilizable para Holy Tacos
// Permite seleccionar ubicación con Google Places Autocomplete, mapa interactivo
// y marcador draggable con reverse geocoding
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  GoogleMap,
  Marker,
  LoadScript,
  Autocomplete
} from '@react-google-maps/api';

// API Key desde las variables de entorno del frontend
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Librerías necesarias para Autocomplete (obligatorio en LoadScript)
const LIBRARIES = ['places'];

// Estilo del contenedor del mapa
const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '400px',
  borderRadius: '0.5rem'
};

// Centro por defecto: Mendoza, Argentina
const DEFAULT_CENTER = {
  lat: -32.8895,
  lng: -68.8458
};

// Opciones del mapa
const MAP_OPTIONS = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi.business',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

/**
 * LocationPicker - Componente reutilizable para seleccionar ubicación
 *
 * Props:
 * @param {string}   address          - Dirección actual en texto
 * @param {object}   coordinates      - Coordenadas actuales { lat, lng }
 * @param {function} onAddressChange  - Callback cuando cambia la dirección (string)
 * @param {function} onLocationChange - Callback cuando cambia la ubicación { address, lat, lng }
 * @param {string}   placeholder      - Texto placeholder del input
 * @param {number}   mapHeight        - Altura del mapa en px (default: 400)
 * @param {boolean}  showCoordinates  - Mostrar lat/lng debajo del mapa
 * @param {boolean}  required         - Si el campo es requerido
 * @param {function} onPlaceSelect    - Callback con componentes parseados de la dirección
 *                                      ({ street, number, city, state, country, postalCode })
 */
const LocationPicker = ({
  address = '',
  coordinates = null,
  onAddressChange,
  onLocationChange,
  onPlaceSelect,
  placeholder = 'Escribí la dirección del restaurante...',
  mapHeight = 400,
  showCoordinates = true,
  required = false,
  /** Si el padre pasa un valor (ej. timestamp), se ejecuta "usar mi ubicación actual" una vez */
  triggerUseMyLocation = null
}) => {
  // Estado del mapa y marcador
  const [mapCenter, setMapCenter] = useState(
    coordinates && coordinates.lat ? coordinates : DEFAULT_CENTER
  );
  const [markerPosition, setMarkerPosition] = useState(
    coordinates && coordinates.lat ? coordinates : null
  );
  const [inputAddress, setInputAddress] = useState(address);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');

  // Referencias
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(null);

  // Si la API ya está cargada (p. ej. por otra página), marcar como lista para no depender solo de onLoad
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.maps) {
      setScriptLoaded(true);
    }
  }, []);

  // Sincronizar dirección si cambia externamente
  useEffect(() => {
    if (address !== inputAddress) {
      setInputAddress(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Sincronizar coordenadas si cambian externamente
  useEffect(() => {
    if (coordinates && coordinates.lat && coordinates.lng) {
      const newPos = { lat: coordinates.lat, lng: coordinates.lng };
      setMarkerPosition(newPos);
      setMapCenter(newPos);
    }
  }, [coordinates]);

  // Estilo dinámico del mapa según la prop mapHeight
  const dynamicMapStyle = {
    ...MAP_CONTAINER_STYLE,
    height: `${mapHeight}px`
  };

  // Parsear los address_components de Google Places a campos legibles
  const parseAddressComponents = useCallback((components) => {
    if (!components || !Array.isArray(components)) return null;

    const get = (type) => {
      const comp = components.find(c => c.types.includes(type));
      return comp ? comp.long_name : '';
    };

    return {
      street: get('route'),                          // Nombre de la calle
      number: get('street_number'),                   // Número de la calle
      city: get('locality') || get('sublocality_level_1') || get('administrative_area_level_2'),
      state: get('administrative_area_level_1'),      // Provincia/Estado
      country: get('country'),                        // País
      postalCode: get('postal_code'),                 // Código postal
      neighborhood: get('sublocality') || get('neighborhood') // Barrio
    };
  }, []);

  // Notificar cambios al componente padre
  const notifyChange = useCallback((addr, lat, lng) => {
    if (onAddressChange) {
      onAddressChange(addr);
    }
    if (onLocationChange) {
      onLocationChange({ address: addr, lat, lng });
    }
  }, [onAddressChange, onLocationChange]);

  // Reverse geocoding: coordenadas → dirección + componentes parseados
  const reverseGeocode = useCallback(async (latLng) => {
    if (typeof window === 'undefined' || !window.google?.maps) return;

    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const addr = results[0].formatted_address;
          setInputAddress(addr);
          setGeocodeError('');
          notifyChange(addr, latLng.lat, latLng.lng);

          // Parsear y notificar componentes de la dirección
          if (onPlaceSelect) {
            const parsed = parseAddressComponents(results[0].address_components);
            if (parsed) {
              onPlaceSelect(parsed);
            }
          }
        } else {
          // Si no se encuentra dirección, solo actualizar coordenadas
          notifyChange(inputAddress, latLng.lat, latLng.lng);
        }
      });
    } catch (error) {
      console.error('Error en reverse geocoding:', error);
    }
  }, [notifyChange, inputAddress, onPlaceSelect, parseAddressComponents]);

  // Callback cuando el autocomplete selecciona un lugar
  const handlePlaceChanged = useCallback(() => {
    if (!autocompleteRef.current) return;

    const place = autocompleteRef.current.getPlace();
    if (!place.geometry) {
      setGeocodeError('No se encontró la ubicación. Seleccioná una sugerencia de la lista.');
      return;
    }

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const addr = place.formatted_address || place.name || '';
    const newCoords = { lat, lng };

    // Actualizar todo: input, mapa, marcador
    setInputAddress(addr);
    setMapCenter(newCoords);
    setMarkerPosition(newCoords);
    setGeocodeError('');

    // Centrar y hacer zoom en el mapa
    if (mapRef.current) {
      mapRef.current.panTo(newCoords);
      mapRef.current.setZoom(17);
    }

    notifyChange(addr, lat, lng);

    // Parsear y notificar los componentes de la dirección al padre
    if (onPlaceSelect && place.address_components) {
      const parsed = parseAddressComponents(place.address_components);
      if (parsed) {
        onPlaceSelect(parsed);
      }
    }
  }, [notifyChange, onPlaceSelect, parseAddressComponents]);

  // Manejador cuando el marcador se arrastra a una nueva posición
  const handleMarkerDragEnd = useCallback((event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const newCoords = { lat, lng };

    setMarkerPosition(newCoords);

    // Hacer reverse geocoding para obtener la dirección nueva
    reverseGeocode(newCoords);
  }, [reverseGeocode]);

  // Manejador de clic en el mapa (colocar marcador)
  const handleMapClick = useCallback((event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const newCoords = { lat, lng };

    setMarkerPosition(newCoords);
    reverseGeocode(newCoords);
  }, [reverseGeocode]);

  // Callback cuando el mapa se carga
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;

    // Si ya tenemos coordenadas, centrar el mapa ahí
    if (markerPosition) {
      map.panTo(markerPosition);
      map.setZoom(17);
    }
  }, [markerPosition]);

  // Botón "Usar mi ubicación actual"
  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeocodeError('Tu navegador no soporta geolocalización.');
      return;
    }

    setIsGeolocating(true);
    setGeocodeError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        setMapCenter(userLocation);
        setMarkerPosition(userLocation);

        if (mapRef.current) {
          mapRef.current.panTo(userLocation);
          mapRef.current.setZoom(17);
        }

        // Obtener la dirección de la ubicación actual
        reverseGeocode(userLocation);
        setIsGeolocating(false);
      },
      (error) => {
        setIsGeolocating(false);
        const errorMessages = {
          1: 'Permiso de ubicación denegado. Habilitalo en la configuración del navegador.',
          2: 'No se pudo determinar tu ubicación.',
          3: 'Tiempo de espera agotado al obtener la ubicación.'
        };
        setGeocodeError(errorMessages[error.code] || 'Error al obtener la ubicación.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [reverseGeocode]);

  // Disparar "usar mi ubicación" cuando el padre lo pide (ej. botón "Consultar ubicación actual")
  useEffect(() => {
    if (triggerUseMyLocation != null && scriptLoaded) {
      handleUseMyLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerUseMyLocation, scriptLoaded]);

  // Manejador del input de dirección (escritura libre)
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputAddress(val);
    setGeocodeError('');
    // Solo notificar cambio de texto, no de coordenadas
    if (onAddressChange) {
      onAddressChange(val);
    }
  };

  // --- Renders condicionales ---

  const loadingElement = (
    <div className="space-y-3">
      <div className="h-10 bg-gray-200 rounded animate-pulse" />
      <div
        className="bg-gray-100 rounded-lg flex items-center justify-center animate-pulse"
        style={{ height: `${mapHeight}px` }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-orange-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando mapa...</p>
        </div>
      </div>
    </div>
  );

  // Error al cargar Google Maps
  if (scriptError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Error al cargar Google Maps</p>
        <p className="text-red-600 text-sm mt-1">
          Verificá tu conexión a internet y que la clave API esté configurada correctamente.
        </p>
      </div>
    );
  }

  const mapContent = (
    <div className="space-y-3">
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700">
        Dirección {required && <span className="text-red-500">*</span>}
      </label>

      {/* Input con Google Places Autocomplete */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Autocomplete
            onLoad={(autocomplete) => {
              autocompleteRef.current = autocomplete;
            }}
            onPlaceChanged={handlePlaceChanged}
            options={{
              componentRestrictions: { country: 'ar' },
              fields: ['formatted_address', 'geometry', 'name', 'address_components'],
              types: ['address']
            }}
          >
            <input
              type="text"
              value={inputAddress}
              onChange={handleInputChange}
              placeholder={placeholder}
              required={required}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base
                         focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500
                         placeholder-gray-400 transition-colors"
            />
          </Autocomplete>
        </div>

        {/* Botón usar mi ubicación */}
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isGeolocating}
          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg
                     text-gray-700 text-sm font-medium transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          title="Usar mi ubicación actual"
        >
          {isGeolocating ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
          <span className="hidden sm:inline">Mi ubicación</span>
        </button>
      </div>

      {/* Mensaje de error */}
      {geocodeError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          {geocodeError}
        </div>
      )}

      {/* Instrucción */}
      <p className="text-xs text-gray-500">
        Escribí la dirección o hacé clic/arrastrá el marcador en el mapa para ajustar la ubicación exacta.
      </p>

      {/* Mapa interactivo */}
      <div className="relative rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <GoogleMap
          mapContainerStyle={dynamicMapStyle}
          center={mapCenter}
          zoom={markerPosition ? 17 : 13}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={MAP_OPTIONS}
        >
          {/* Marcador draggable: key para que se actualice al elegir dirección; pin por defecto para que siempre se vea */}
          {markerPosition && (
            <Marker
              key={`marker-${markerPosition.lat}-${markerPosition.lng}`}
              position={markerPosition}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
              animation={window.google?.maps?.Animation?.DROP}
              title="Ubicación del restaurante"
            />
          )}
        </GoogleMap>

        {/* Overlay de instrucción si no hay marcador */}
        {!markerPosition && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10 pointer-events-none">
            <div className="bg-white px-4 py-3 rounded-lg shadow-lg text-center">
              <p className="text-gray-700 font-medium text-sm">
                Buscá una dirección o hacé clic en el mapa
              </p>
              <p className="text-gray-500 text-xs mt-1">
                para colocar el marcador del restaurante
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Información de coordenadas */}
      {showCoordinates && markerPosition && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="font-medium text-orange-800">Ubicación seleccionada</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-1">
              <span className="text-orange-700 font-medium">Lat:</span>
              <span className="font-mono text-orange-900">{markerPosition.lat.toFixed(6)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-orange-700 font-medium">Lng:</span>
              <span className="font-mono text-orange-900">{markerPosition.lng.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const isMapReady = scriptLoaded && typeof window !== 'undefined' && window.google?.maps;

  return (
    <LoadScript
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      libraries={LIBRARIES}
      loadingElement={loadingElement}
      onLoad={() => setScriptLoaded(true)}
      onError={() => setScriptError(new Error('Error al cargar Google Maps'))}
    >
      {isMapReady ? mapContent : loadingElement}
    </LoadScript>
  );
};

export default LocationPicker;
