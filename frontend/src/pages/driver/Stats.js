/**
 * Estadísticas del conductor: completados, rating, ganancias (placeholder).
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import axios from 'axios';

const DriverStats = () => {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [profileRes, ordersRes] = await Promise.all([
          axios.get('/api/profile'),
          axios.get('/api/orders')
        ]);
        if (profileRes.data?.success && profileRes.data?.data) setProfile(profileRes.data.data);
        if (ordersRes.data?.success && ordersRes.data?.data) setOrders(Array.isArray(ordersRes.data.data) ? ordersRes.data.data : []);
      } catch (e) {
        console.error('Error cargando estadísticas:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const completed = orders.filter(o => o.status === 'completed').length;
  const rating = profile?.driverProfile?.rating ?? 0;
  const ratingText = rating ? Number(rating).toFixed(1) : '—';

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-900">Estadísticas</h1>
            <Link to="/driver/map" className="text-sm text-orange-600 hover:underline">Volver al mapa</Link>
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{completed}</div>
              <div className="text-sm text-gray-600">Entregas completadas</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{ratingText}</div>
              <div className="text-sm text-gray-600">Valoración</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">—</div>
              <div className="text-sm text-gray-600">Ganancias (próximamente)</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DriverStats;
