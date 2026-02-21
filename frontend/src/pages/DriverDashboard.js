// Dashboard del conductor: mapa permanente con ubicación en tiempo real, restaurantes cercanos y orden activa
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Layout from '../components/Layout';
import DriverMap from '../components/driver/DriverMap';
import axios from 'axios';

// Estados que consideramos "orden activa" para mostrar en el mapa (cliente + ruta)
const ACTIVE_ORDER_STATUSES = ['assigned', 'heading_to_restaurant', 'ready_for_pickup', 'at_restaurant', 'on_the_way'];

// Centro por defecto para cargar restaurantes al ingresar (antes de tener ubicación del driver)
const DEFAULT_MAP_CENTER = { lat: -32.8895, lng: -68.8458 };

const DriverDashboard = () => {
  const { user } = useAuth();
  const { onOrderAssigned, onOrderCancelled, onOrderReassignedAway } = useSocket();

  const [driverLocation, setDriverLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  /** Restaurantes activos (todos): para centrar mapa y pins al entrar */
  const [activeRestaurants, setActiveRestaurants] = useState([]);
  /** Restaurantes cercanos al driver: se actualiza con la posición */
  const [nearbyRestaurants, setNearbyRestaurants] = useState([]);
  /** Si true, el mapa muestra solo restaurantes cercanos; si false, todos los activos */
  const [showOnlyNearby, setShowOnlyNearby] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const watchIdRef = useRef(null);
  const nearbyDebounceRef = useRef(null);

  // Primera orden activa del conductor (para marcador cliente + ruta)
  const activeOrder = orders.find(o => ACTIVE_ORDER_STATUSES.includes(o.status)) || null;

  // Cargar pedidos del conductor
  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const res = await axios.get('/api/orders');
      if (res.data.success) {
        setOrders(res.data.data || []);
      }
    } catch (err) {
      console.error('Error al cargar pedidos:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Escuchar asignación/cancelación/reasignación para actualizar lista y mapa
  useEffect(() => {
    const un1 = onOrderAssigned?.(() => loadOrders());
    const un2 = onOrderCancelled?.(() => loadOrders());
    const un3 = onOrderReassignedAway?.(() => loadOrders());
    return () => {
      if (un1) un1();
      if (un2) un2();
      if (un3) un3();
    };
  }, [onOrderAssigned, onOrderCancelled, onOrderReassignedAway, loadOrders]);

  // Geolocalización: actualización cada 5–10 s (watchPosition con maximumAge para no saturar)
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización.');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 8000 // Cache 8 s para no sobrecargar
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setDriverLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationError(null);
      },
      (err) => {
        let message = 'No se pudo obtener tu ubicación.';
        if (err.code === 1) message = 'Permite ubicación para ver el mapa en tiempo real.';
        else if (err.code === 2) message = 'Ubicación no disponible.';
        else if (err.code === 3) message = 'Tiempo de espera agotado.';
        setLocationError(message);
      },
      options
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Al cargar el mapa: obtener todos los restaurantes activos (para centrar y mostrar pins)
  useEffect(() => {
    let cancelled = false;
    const fetchActive = async () => {
      try {
        const res = await axios.get('/api/restaurants', { params: { active: 'true' } });
        if (!cancelled && res.data.success && res.data.data) {
          setActiveRestaurants(res.data.data);
        }
      } catch (err) {
        if (!cancelled) console.error('Error al cargar restaurantes activos:', err);
      }
    };
    fetchActive();
    return () => { cancelled = true; };
  }, []);

  // Restaurantes cercanos al driver: cuando tenemos ubicación, actualizar lista para el filtro "solo cercanos"
  useEffect(() => {
    if (!driverLocation) return;
    if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current);

    nearbyDebounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get('/api/restaurants/nearby', {
          params: { lat: driverLocation.lat, lng: driverLocation.lng, radius: 15 }
        });
        if (res.data.success && res.data.data) {
          setNearbyRestaurants(res.data.data);
        }
      } catch (err) {
        console.error('Error al cargar restaurantes cercanos:', err);
      }
    }, 600);

    return () => {
      if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current);
    };
  }, [driverLocation?.lat, driverLocation?.lng]);

  // Lista que ve el mapa: todos los activos o solo cercanos según el filtro
  const restaurantsToShow = showOnlyNearby ? nearbyRestaurants : activeRestaurants;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Encabezado y enlace a entregas */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Mapa en tiempo real
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Tu posición, restaurantes cercanos y ruta hacia el cliente cuando tengas una orden asignada.
              </p>
            </div>
            <Link
              to="/driver/orders"
              className="inline-flex items-center justify-center px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
            >
              Mis Entregas
            </Link>
          </div>

          {/* Aviso si no hay permiso de ubicación */}
          {locationError && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
              {locationError}
            </div>
          )}

          {/* Filtro: todos los activos o solo cercanos; al cambiar se ajusta el mapa (driver + restaurantes visibles) */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowOnlyNearby(false)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  !showOnlyNearby
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Mostrar todos
              </button>
              <button
                type="button"
                onClick={() => setShowOnlyNearby(true)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  showOnlyNearby
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Solo cercanos
              </button>
            </div>
            <span className="text-gray-500 text-sm">
              Doble clic en un pin para ver la ruta desde tu posición
            </span>
          </div>

          {/* Mapa principal: se ajusta para ver driver + todos/cercanos según el filtro */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <DriverMap
              driverLocation={driverLocation}
              activeRestaurants={activeRestaurants}
              restaurantsToShow={restaurantsToShow}
              activeOrder={activeOrder}
              mapHeight="min(480px, 65vh)"
              className="w-full"
              fitBoundsKey={showOnlyNearby ? 'nearby' : 'all'}
            />
          </div>

          {/* Leyenda y estado */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500" /> Tu posición
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              {showOnlyNearby ? 'Restaurantes cercanos' : 'Restaurantes activos'}
            </span>
            {activeOrder && (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500" /> Cliente (orden #{String(activeOrder._id).slice(-6)})
                </span>
                <Link
                  to={`/driver/orders/${activeOrder._id}`}
                  className="text-orange-600 font-medium hover:underline"
                >
                  Ver detalle de la orden →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DriverDashboard;
