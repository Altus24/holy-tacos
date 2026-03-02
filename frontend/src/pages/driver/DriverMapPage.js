/**
 * Mapa full para conductor: solo el mapa a pantalla completa con pins (restaurantes, driver, ruta si hay orden).
 * Reutiliza la misma lógica que el dashboard pero sin sidebar, altura máxima.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import DriverMap from '../../components/driver/DriverMap';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';

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
  const watchIdRef = useRef(null);
  const nearbyDebounceRef = useRef(null);

  const activeOrder = orders.find(o => ACTIVE_ORDER_STATUSES.includes(o.status)) || null;
  const restaurantsToShow = showOnlyNearby ? nearbyRestaurants : activeRestaurants;

  const loadOrders = useCallback(async () => {
    try {
      const res = await axios.get('/api/orders');
      if (res.data.success && res.data.data) setOrders(res.data.data || []);
    } catch (err) {
      console.error('Error al cargar pedidos:', err);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const un = onOrderAssigned?.((payload) => {
      const shortId = payload?.orderId ? String(payload.orderId).slice(-6) : '';
      const message = payload?.message || `Te asignaron un nuevo pedido ${shortId ? `#${shortId}` : ''}`;
      toast.custom(
        (t) => (
          <div className="flex items-center gap-3 bg-white shadow-lg rounded-lg px-4 py-3 border border-gray-200">
            <span className="text-gray-800">{message}</span>
            <button
              type="button"
              onClick={() => {
                navigate('/driver/orders');
                toast.dismiss(t.id);
              }}
              className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-orange-700 whitespace-nowrap"
            >
              Ir a órdenes
            </button>
          </div>
        ),
        { duration: 8000 }
      );
      loadOrders();
    });
    return () => { if (un) un(); };
  }, [onOrderAssigned, loadOrders, navigate]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Tu navegador no soporta geolocalización.');
      return;
    }
    const opts = { enableHighAccuracy: true, timeout: 12000, maximumAge: 8000 };
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setDriverLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        setLocationError(err.code === 1 ? 'Permite ubicación para ver el mapa.' : 'Ubicación no disponible.');
      },
      opts
    );
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchActive = async () => {
      try {
        const res = await axios.get('/api/restaurants', { params: { active: 'true' } });
        if (!cancelled && res.data?.success && res.data?.data) setActiveRestaurants(res.data.data);
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    };
    fetchActive();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!driverLocation) return;
    if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current);
    nearbyDebounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get('/api/restaurants/nearby', {
          params: { lat: driverLocation.lat, lng: driverLocation.lng, radius: 15 }
        });
        if (res.data?.success && res.data?.data) setNearbyRestaurants(res.data.data);
      } catch (err) {
        console.error(err);
      }
    }, 600);
    return () => { if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current); };
  }, [driverLocation]);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
          <Link to="/driver/orders" className="text-sm text-orange-600 hover:underline">Órdenes</Link>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowOnlyNearby(false)}
              className={`px-3 py-1.5 text-sm rounded ${!showOnlyNearby ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setShowOnlyNearby(true)}
              className={`px-3 py-1.5 text-sm rounded ${showOnlyNearby ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Cercanos
            </button>
          </div>
        </div>
        {locationError && (
          <div className="px-4 py-2 bg-amber-50 text-amber-800 text-sm">{locationError}</div>
        )}
        <div className="flex-1 min-h-0">
          <DriverMap
            driverLocation={driverLocation}
            activeRestaurants={activeRestaurants}
            restaurantsToShow={restaurantsToShow}
            activeOrder={activeOrder}
            mapHeight="calc(100vh - 120px)"
            className="w-full"
            fitBoundsKey={showOnlyNearby ? 'nearby' : 'all'}
          />
        </div>
      </div>
    </Layout>
  );
};

export default DriverMapPage;
