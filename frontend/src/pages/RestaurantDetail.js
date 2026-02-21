// Página de detalle de restaurante en Holy Tacos
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const RestaurantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();

  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});

  // Cargar detalles del restaurante
  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/restaurants/${id}`);

        if (response.data.success) {
          setRestaurant(response.data.data);
        } else {
          setError('Restaurante no encontrado');
        }
      } catch (error) {
        console.error('Error al obtener restaurante:', error);
        setError('Error al cargar el restaurante');
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [id]);

  // Manejar selección de cantidad de items
  const handleQuantityChange = (itemName, quantity) => {
    setSelectedItems({
      ...selectedItems,
      [itemName]: Math.max(0, quantity)
    });
  };

  // Agregar item al carrito
  const handleAddToCart = (item) => {
    const quantity = selectedItems[item.name] || 0;
    if (quantity > 0) {
      if (!isAuthenticated()) {
        navigate('/login');
        return;
      }

      // Agregar al carrito usando el contexto
      addToCart(restaurant._id, restaurant.name, item, quantity);

      // Mostrar toast informativo con acción rápida
      toast((t) => (
        <div className="flex items-start gap-3">
          <div>
            <p className="font-semibold text-gray-900">Agregado al carrito</p>
            <p className="text-sm text-gray-700">
              {quantity}x <span className="font-medium">{item.name}</span>
            </p>
          </div>
          <div className="flex gap-2 ml-3">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                navigate('/cart');
              }}
              className="bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-orange-700 transition-colors"
            >
              Ver carrito
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Seguir comprando
            </button>
          </div>
        </div>
      ), {
        duration: 3500
      });

      // Limpiar la selección del item
      setSelectedItems(prev => ({
        ...prev,
        [item.name]: 0
      }));
    } else {
      toast.error('Seleccioná una cantidad primero');
    }
  };

  // Agrupar items por categoría
  const groupItemsByCategory = (menu) => {
    const grouped = {};
    menu.forEach(item => {
      const category = item.category || 'Otros';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });
    return grouped;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando restaurante...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  const groupedMenu = groupItemsByCategory(restaurant.menu);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Botón volver a restaurantes */}
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <BackButton to="/restaurants" label="Volver a Restaurantes" variant="link" />
        </div>
        {/* Encabezado del restaurante */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Logo/imagen */}
              <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg flex items-center justify-center">
                <span className="text-4xl">🏪</span>
              </div>

              {/* Información */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {restaurant.name}
                </h1>
                <p className="text-gray-600 mb-2 flex items-center">
                  <span className="mr-2">📍</span>
                  {restaurant.address}
                </p>
                {restaurant.phone && (
                  <p className="text-gray-600 flex items-center">
                    <span className="mr-2">📞</span>
                    {restaurant.phone}
                  </p>
                )}
              </div>

              {/* Información de entrega */}
              <div className="text-right">
                <div className="text-sm text-gray-600">Costo de entrega</div>
                <div className="text-lg font-semibold">$25</div>
                <div className="text-sm text-gray-600 mt-1">25-40 min</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Menú organizado por categorías */}
          {Object.entries(groupedMenu).map(([category, items]) => (
            <div key={category} className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 capitalize">
                {category}
              </h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((item, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Aquí podría ir una imagen del platillo */}
                    <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-3xl">
                        {category === 'plato principal' ? '🍽️' :
                         category === 'bebida' ? '🥤' :
                         category === 'entrada' ? '🥗' :
                         category === 'postre' ? '🍰' : '🍽️'}
                      </span>
                    </div>

                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {item.name}
                      </h3>

                      {item.description && (
                        <p className="text-gray-600 text-sm mb-3">
                          {item.description}
                        </p>
                      )}

                      <div className="flex justify-between items-center mb-3">
                        <span className="text-lg font-bold text-orange-600">
                          ${item.price}
                        </span>
                      </div>

                      {/* Controles de cantidad y agregar al carrito */}
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center border border-gray-300 rounded">
                          <button
                            onClick={() => handleQuantityChange(item.name, (selectedItems[item.name] || 0) - 1)}
                            className="px-3 py-1 text-gray-600 hover:text-gray-800"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 border-x border-gray-300">
                            {selectedItems[item.name] || 0}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.name, (selectedItems[item.name] || 0) + 1)}
                            className="px-3 py-1 text-gray-600 hover:text-gray-800"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleAddToCart(item)}
                          className="flex-1 bg-orange-600 text-white py-2 px-4 rounded hover:bg-orange-700 transition-colors text-sm font-medium"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {/* Información adicional */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            💡 Información importante
          </h3>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>• Los precios incluyen IVA</li>
            <li>• Costo de entrega: $25 (gratuito en pedidos mayores a $300)</li>
            <li>• Tiempo estimado de entrega: 25-40 minutos</li>
            <li>• Puedes modificar tu pedido hasta 5 minutos después de confirmarlo</li>
          </ul>
        </div>
        </div>
      </div>
    </Layout>
  );
};

export default RestaurantDetail;