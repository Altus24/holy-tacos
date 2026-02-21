// Página de calificación del conductor y restaurante después de confirmar recepción
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import axios from 'axios';
import toast from 'react-hot-toast';

const StarRating = ({ value, onChange, max = 5 }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].slice(0, max).map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl focus:outline-none transition-transform hover:scale-110 ${
            star <= value ? 'text-yellow-500' : 'text-gray-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
};

const RateOrder = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [driverStars, setDriverStars] = useState(0);
  const [driverComment, setDriverComment] = useState('');
  const [restaurantStars, setRestaurantStars] = useState(0);
  const [restaurantComment, setRestaurantComment] = useState('');

  useEffect(() => {
    if (orderId && isAuthenticated()) loadOrder();
  }, [orderId, isAuthenticated]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`/api/orders/${orderId}`);
      if (res.data.success) {
        const data = res.data.data;
        if (data.userId?._id !== user?._id && data.userId !== user?._id) {
          setError('No tenés permisos para calificar este pedido.');
          return;
        }
        if (data.status !== 'completed') {
          setError('Solo podés calificar pedidos completados.');
          return;
        }
        if (data.driverRating?.stars || data.restaurantRating?.stars) {
          setDriverStars(data.driverRating?.stars || 0);
          setDriverComment(data.driverRating?.comment || '');
          setRestaurantStars(data.restaurantRating?.stars || 0);
          setRestaurantComment(data.restaurantRating?.comment || '');
        }
        setOrder(data);
      } else {
        setError('Pedido no encontrado.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (driverStars < 1 || restaurantStars < 1) {
      toast.error('Debés dar al menos 1 estrella al conductor y al restaurante.');
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`/api/orders/${orderId}/rate`, {
        driverStars,
        driverComment,
        restaurantStars,
        restaurantComment
      });
      setSuccess(true);
      toast.success('Gracias por tu calificación');
      setTimeout(() => navigate('/orders'), 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar la calificación.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
          <div className="text-center max-w-md">
            <p className="text-gray-700 mb-4">{error || 'Pedido no encontrado.'}</p>
            <Link to="/orders" className="text-orange-600 font-medium hover:underline">
              Volver a Mis Pedidos
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (success) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
          <div className="text-center max-w-md bg-white rounded-lg shadow p-8">
            <div className="text-5xl mb-4">⭐</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Gracias por tu calificación</h2>
            <p className="text-gray-600 mb-4">Redirigiendo a Mis Pedidos...</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
          </div>
        </div>
      </Layout>
    );
  }

  const alreadyRated = order.driverRating?.stars || order.restaurantRating?.stars;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="mb-4">
            <BackButton to="/orders" label="Volver a Mis Pedidos" variant="link" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Calificá tu experiencia</h1>
          <p className="text-gray-600 mb-6">
            Pedido #{orderId?.slice(-6)} • {order.restaurantId?.name || 'Restaurante'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Calificación al conductor */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Calificación al conductor</h2>
              <p className="text-sm text-gray-600 mb-3">
                {order.driverId?.name || order.driverId?.email || 'Conductor'}
              </p>
              <div className="mb-3">
                <span className="text-sm font-medium text-gray-700">Estrellas (obligatorio)</span>
                <div className="mt-1">
                  <StarRating value={driverStars} onChange={setDriverStars} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Comentario (opcional)</label>
                <textarea
                  value={driverComment}
                  onChange={(e) => setDriverComment(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Ej: Muy amable, llegó a tiempo."
                />
              </div>
            </div>

            {/* Calificación al restaurante */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Calificación al restaurante / servicio</h2>
              <p className="text-sm text-gray-600 mb-3">
                {order.restaurantId?.name || 'Restaurante'}
              </p>
              <div className="mb-3">
                <span className="text-sm font-medium text-gray-700">Estrellas (obligatorio)</span>
                <div className="mt-1">
                  <StarRating value={restaurantStars} onChange={setRestaurantStars} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Comentario (opcional)</label>
                <textarea
                  value={restaurantComment}
                  onChange={(e) => setRestaurantComment(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Ej: Todo perfecto, muy buena comida."
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={submitting || driverStars < 1 || restaurantStars < 1}
                className="flex-1 bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Enviando...' : 'Enviar calificación'}
              </button>
              <Link
                to="/orders"
                className="flex-1 text-center border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 font-medium"
              >
                {alreadyRated ? 'Volver a Mis Pedidos' : 'Dejar para después'}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default RateOrder;
