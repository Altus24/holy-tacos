/**
 * Mapa reutilizable para cliente y driver (estilo Pedidos Ya).
 * Pins: verde = driver, rojo = restaurante, azul = cliente. Ruta azul con tráfico, ETA visible, zoom auto.
 * Opcional: info windows con nombre/dirección.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GoogleMap,
  LoadScript,
  Marker,
  DirectionsRenderer,
  InfoWindow
} from '@react-google-maps/api';

const CONTAINER_STYLE = { width: '100%', height: '100%', minHeight: '360px', borderRadius: '0.75rem' };

const MAP_OPTIONS = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
  ]
};

// Colores Pedidos Ya: verde driver, rojo restaurant, azul cliente
const PIN_SVG = (fillHex) => `
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 4C12.3 4 6 10.3 6 18c0 6.5 11 16 14 18 3-2 14-11.5 14-18 0-7.7-6.3-14-14-14z" fill="${fillHex}" stroke="white" stroke-width="2"/>
    <circle cx="20" cy="16" r="5" fill="white"/>
  </svg>
`;

const MapComponent = ({
  restaurantLocation = null,
  clientLocation = null,
  driverLocation = null,
  restaurantLabel = 'Restaurante',
  clientLabel = 'Cliente',
  driverLabel = 'Conductor',
  restaurantAddress = '',
  clientAddress = '',
  showRoute = true,
  showETA = true,
  showInfoWindows = true,
  className = '',
  containerStyle = CONTAINER_STYLE,
  zoom = 14
}) => {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [center, setCenter] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [activeInfo, setActiveInfo] = useState(null);

  const points = useMemo(
    () => [restaurantLocation, clientLocation, driverLocation].filter(Boolean),
    [restaurantLocation, clientLocation, driverLocation]
  );

  useEffect(() => {
    if (points.length === 0) return;
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    setCenter({ lat: avgLat, lng: avgLng });
  }, [points]);

  const calculateDirections = useCallback(() => {
    if (!driverLocation || !clientLocation || typeof window === 'undefined' || !window.google?.maps) return;
    const origin = new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng);
    const destination = new window.google.maps.LatLng(clientLocation.lat, clientLocation.lng);
    const waypoints = restaurantLocation
      ? [{ location: new window.google.maps.LatLng(restaurantLocation.lat, restaurantLocation.lng), stopover: true }]
      : [];
    const svc = new window.google.maps.DirectionsService();
    svc.route(
      { origin, destination, waypoints, travelMode: 'DRIVING', drivingOptions: { departureTime: new Date(), trafficModel: 'best_guess' } },
      (result, status) => {
        if (status === 'OK') {
          setDirectionsResponse(result);
          const route = result.routes[0];
          if (route?.legs?.length) {
            const totalDistance = route.legs.reduce((a, l) => a + l.distance.value, 0);
            const totalDuration = route.legs.reduce((a, l) => a + l.duration.value, 0);
            setRouteInfo({ distanceText: (totalDistance / 1000).toFixed(1) + ' km', durationText: Math.ceil(totalDuration / 60) + ' min' });
          }
        }
        setLoadingRoute(false);
      }
    );
  }, [driverLocation, clientLocation, restaurantLocation]);

  useEffect(() => {
    if (scriptLoaded && showRoute && driverLocation && clientLocation) {
      setLoadingRoute(true);
      calculateDirections();
    } else {
      setLoadingRoute(false);
    }
  }, [scriptLoaded, showRoute, driverLocation, clientLocation, calculateDirections]);

  const getIcons = () => {
    if (typeof window === 'undefined' || !window.google?.maps) return null;
    return {
      restaurant: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(PIN_SVG('#dc2626')),
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 40)
      },
      client: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(PIN_SVG('#2563eb')),
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 40)
      },
      driver: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(PIN_SVG('#16a34a')),
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 40)
      }
    };
  };

  if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`bg-gray-100 border border-gray-300 rounded-lg p-6 text-center ${className}`}>
        <p className="text-gray-600">Configurá REACT_APP_GOOGLE_MAPS_API_KEY para ver el mapa.</p>
      </div>
    );
  }

  const icons = scriptLoaded ? getIcons() : null;

  return (
    <div className={className} style={{ position: 'relative' }}>
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
        libraries={['places']}
        onLoad={() => setScriptLoaded(true)}
      >
        {!scriptLoaded || !center || !icons ? (
          <div className="flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg" style={containerStyle}>
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : (
          <div className="relative">
            {loadingRoute && showRoute && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-lg">
                <span className="text-gray-600 text-sm">Calculando ruta...</span>
              </div>
            )}
            {showETA && routeInfo && (
              <div className="absolute top-2 right-2 bg-white border border-gray-200 rounded-lg p-2 shadow z-10 text-sm">
                <div className="font-medium text-gray-800">ETA</div>
                <div className="text-gray-600">{routeInfo.distanceText} · {routeInfo.durationText}</div>
              </div>
            )}
            <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={zoom} options={MAP_OPTIONS}>
              {restaurantLocation && (
                <Marker
                  position={restaurantLocation}
                  icon={icons.restaurant}
                  title={restaurantLabel}
                  onClick={() => showInfoWindows && setActiveInfo({ id: 'restaurant', position: restaurantLocation, title: restaurantLabel, address: restaurantAddress })}
                />
              )}
              {clientLocation && (
                <Marker
                  position={clientLocation}
                  icon={icons.client}
                  title={clientLabel}
                  onClick={() => showInfoWindows && setActiveInfo({ id: 'client', position: clientLocation, title: clientLabel, address: clientAddress })}
                />
              )}
              {driverLocation && (
                <Marker
                  position={driverLocation}
                  icon={icons.driver}
                  title={driverLabel}
                  animation={window.google?.maps?.Animation?.BOUNCE}
                  onClick={() => showInfoWindows && setActiveInfo({ id: 'driver', position: driverLocation, title: driverLabel })}
                />
              )}
              {directionsResponse && showRoute && (
                <DirectionsRenderer
                  directions={directionsResponse}
                  options={{
                    polylineOptions: { strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.9 },
                    suppressMarkers: true
                  }}
                />
              )}
              {showInfoWindows && activeInfo && (
                <InfoWindow
                  position={activeInfo.position}
                  onCloseClick={() => setActiveInfo(null)}
                >
                  <div className="p-1 min-w-[140px]">
                    <div className="font-semibold text-gray-900">{activeInfo.title}</div>
                    {activeInfo.address && <div className="text-sm text-gray-600 mt-0.5">{activeInfo.address}</div>}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </div>
        )}
      </LoadScript>
    </div>
  );
};

export default MapComponent;
