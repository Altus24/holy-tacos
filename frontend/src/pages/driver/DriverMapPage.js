/**
 * Página de mapa full-screen para el conductor.
 * Diseñada como una app nativa: sin sidebar, sin navbar, solo el mapa y controles flotantes.
 * El mapa ocupa el 100 % de la pantalla (100dvh para soporte de navegadores móviles modernos).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { playNotificationSound } from '../../utils/notifications';
import DriverMap from '../../components/driver/DriverMap';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';

// Estados que consideramos una orden "activa" para mostrar en el mapa
const ACTIVE_ORDER_STATUSES = ['assigned', 'heading_to_restaurant', 'ready_for_pickup', 'at_restaurant', 'on_the_way'];

const DriverMapPage = () => {
  const navigate = useNavigate();
  const { onOrderAssigned } = useSocket();
  const [driverLocation, setDriverLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [activeRestaurants, setActiveRestaurants] = useState([]);
  const [nearbyRestaurants, setNearbyRestaurants] = useState([]);
  const [showOnlyNearby, setShowOnlyNearby] = useState(false);
  const [orders, setOrders] = useState([]);
  const [headerVisible, setHeaderVisible] = useState(true);

  const watchIdRef = useRef(null);
  const nearbyDebounceRef = useRef(null);
  // Ocultar header automáticamente 4 s después de cargar para maximizar el mapa
  const headerTimerRef = useRef(null);

  const activeOrder = orders.find(o => ACTIVE_ORDER_STATUSES.includes(o.status)) || null;
  const restaurantsToShow = showOnlyNearby ? nearbyRestaurants : activeRestaurants;

  // Cargar pedidos activos del conductor
  const loadOrders = useCallback(async () => {
    try {
      const res = await axios.get('/api/orders');
      if (res.data.success && res.data.data) setOrders(res.data.data || []);
    } catch (err) {
      console.error('Error al cargar pedidos:', err);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Escuchar socket "orderAssigned": actualizar lista y mostrar notificación
  useEffect(() => {
    const un = onOrderAssigned?.((payload) => {
      const shortId = payload?.orderId ? String(payload.orderId).slice(-6) : '';
      const message = payload?.message || `Nuevo pedido asignado${shortId ? ` #${shortId}` : ''}`;
      playNotificationSound();
      toast.custom(
        (t) => (
          <div className="flex items-center gap-3 bg-white shadow-xl rounded-2xl px-4 py-3 border border-gray-100">
            <span className="text-2xl">🛵</span>
            <span className="text-gray-800 font-medium text-sm">{message}</span>
            <button
              type="button"
              onClick={() => { navigate('/driver/orders'); toast.dismiss(t.id); }}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 whitespace-nowrap"
            >
              Ver orden
            </button>
          </div>
        ),
        { duration: 10000 }
      );
      loadOrders();
      // Mostrar el header brevemente cuando llega una orden para que el driver lo vea
      setHeaderVisible(true);
      if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
      headerTimerRef.current = setTimeout(() => setHeaderVisible(false), 5000);
    });
    return () => { if (un) un(); };
  }, [onOrderAssigned, loadOrders, navigate]);

  // Ocultar header automáticamente 4 s después de montar (salvo que haya una orden activa)
  useEffect(() => {
    headerTimerRef.current = setTimeout(() => {
      if (!activeOrder) setHeaderVisible(false);
    }, 4000);
    return () => { if (headerTimerRef.current) clearTimeout(headerTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geolocalización continua con watchPosition
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización.');
      return;
    }
    const opts = { enableHighAccuracy: true, timeout: 12000, maximumAge: 8000 };
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      err => setLocationError(err.code === 1 ? 'Permitís ubicación para ver el mapa.' : 'Ubicación no disponible.'),
      opts
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  // Restaurantes activos (todos) — se cargan una vez al montar
  useEffect(() => {
    let cancelled = false;
    axios.get('/api/restaurants', { params: { active: 'true' } })
      .then(res => { if (!cancelled && res.data?.success) setActiveRestaurants(res.data.data || []); })
      .catch(err => { if (!cancelled) console.error(err); });
    return () => { cancelled = true; };
  }, []);

  // Restaurantes cercanos — se actualizan con debounce cuando cambia la posición del driver
  useEffect(() => {
    if (!driverLocation) return;
    if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current);
    nearbyDebounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get('/api/restaurants/nearby', {
          params: { lat: driverLocation.lat, lng: driverLocation.lng, radius: 15 }
        });
        if (res.data?.success) setNearbyRestaurants(res.data.data || []);
      } catch (err) { console.error(err); }
    }, 800);
    return () => { if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLocation?.lat, driverLocation?.lng]);

  // Mostrar header al tocar el mapa (toggle con tap en zona superior)
  const handleToggleHeader = () => {
    setHeaderVisible(v => !v);
    if (headerTimerRef.current) clearTimeout(headerTimerRef.current);
  };

  return (
    // 100dvh: cubre la viewport real en móviles (no la UI del navegador)
    <div className="relative w-full bg-black" style={{ height: '100dvh', minHeight: '100vh' }}>

      {/* Header flotante minimal — se puede ocultar para maximizar el mapa */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 transition-transform duration-300 ${
          headerVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="bg-black/70 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
          <Link to="/driver/orders" className="flex items-center gap-1.5 text-white text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Órdenes
          </Link>

          {/* Filtro todos/cercanos */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setShowOnlyNearby(false)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                !showOnlyNearby ? 'bg-blue-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setShowOnlyNearby(true)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                showOnlyNearby ? 'bg-blue-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Cercanos
            </button>
          </div>

          {/* Botón para ocultar el header */}
          <button
            type="button"
            onClick={handleToggleHeader}
            className="p-1.5 text-white/70 hover:text-white"
            title="Ocultar barra"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>

        {/* Aviso de error de ubicación */}
        {locationError && (
          <div className="bg-amber-500/90 px-4 py-2 text-white text-xs font-medium text-center">
            {locationError}
          </div>
        )}
      </div>

      {/* Botón flotante para mostrar el header cuando está oculto */}
      {!headerVisible && (
        <button
          type="button"
          onClick={handleToggleHeader}
          className="absolute top-3 left-3 z-30 p-2 bg-black/50 backdrop-blur rounded-full text-white hover:bg-black/70 transition-colors"
          title="Mostrar menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Mapa: ocupa el 100 % de la pantalla, el header flota encima */}
      <DriverMap
        driverLocation={driverLocation}
        activeRestaurants={activeRestaurants}
        restaurantsToShow={restaurantsToShow}
        activeOrder={activeOrder}
        mapHeight="100dvh"
        className="absolute inset-0 w-full h-full"
        fitBoundsKey={showOnlyNearby ? 'nearby' : 'all'}
        isFullScreen={true}
      />
    </div>
  );
};

export default DriverMapPage;
