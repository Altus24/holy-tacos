// Página principal (Home) de Holy Tacos
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RestaurantCard from '../components/RestaurantCard';
import Layout from '../components/Layout';
import API_BASE_URL from '../config/api';

const Home = () => {
  // Estado para los restaurantes
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);

  // Estado para la búsqueda
  const [searchTerm, setSearchTerm] = useState('');

  // Estado de carga
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar restaurantes al montar el componente
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/restaurants');

        if (response.data.success) {
          setRestaurants(response.data.data);
          setFilteredRestaurants(response.data.data);
        } else {
          setError('Error al cargar los restaurantes');
        }
      } catch (error) {
        console.error('Error al obtener restaurantes:', error);
        setError('Error al conectar con el servidor. Verifica que el backend esté funcionando.');
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Filtrar restaurantes cuando cambia el término de búsqueda
  useEffect(() => {
    if (!searchTerm) {
      setFilteredRestaurants(restaurants);
    } else {
      const filtered = restaurants.filter(restaurant =>
        restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        restaurant.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRestaurants(filtered);
    }
  }, [searchTerm, restaurants]);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
        {/* Sección Hero */}
        <section className="text-center py-16 px-4">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            ¡Pide tu comida favorita en minutos!
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Holy Tacos es tu plataforma de delivery de confianza. Conecta con los mejores restaurantes
            de tu ciudad y recibe tu pedido en la puerta de tu casa.
          </p>

          {/* Barra de búsqueda */}
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar restaurantes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-400">🔍</span>
              </div>
            </div>
          </div>

          {/* Características principales */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="flex items-center space-x-2 text-gray-600">
              <span className="text-2xl">⚡</span>
              <span>Entrega rápida</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <span className="text-2xl">🍽️</span>
              <span>Variedad de opciones</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <span className="text-2xl">🔒</span>
              <span>Pago seguro</span>
            </div>
          </div>
        </section>

        {/* Sección de restaurantes */}
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Restaurantes Disponibles
              </h2>
              {searchTerm && (
                <p className="text-gray-600">
                  {filteredRestaurants.length} restaurante(s) encontrado(s) para "{searchTerm}"
                </p>
              )}
            </div>

            {/* Estados de carga y error */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                <p className="mt-4 text-gray-600">Cargando restaurantes...</p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <div className="text-red-600 mb-4">
                  <span className="text-4xl">❌</span>
                </div>
                <p className="text-red-600 font-medium">{error}</p>
                <p className="text-gray-600 mt-2">
                  Verifica que el backend esté accesible en {API_BASE_URL}
                </p>
              </div>
            )}

            {/* Lista de restaurantes */}
            {!loading && !error && (
              <>
                {filteredRestaurants.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <span className="text-6xl">🍽️</span>
                    </div>
                    <h3 className="text-xl font-medium text-gray-900 mb-2">
                      {searchTerm ? 'No se encontraron restaurantes' : 'No hay restaurantes disponibles'}
                    </h3>
                    <p className="text-gray-600">
                      {searchTerm
                        ? 'Intenta con otro término de búsqueda'
                        : 'Los restaurantes aparecerán aquí cuando estén disponibles'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRestaurants.map((restaurant) => (
                      <RestaurantCard key={restaurant._id} restaurant={restaurant} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Sección de estadísticas */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {restaurants.length}+
                </div>
                <div className="text-gray-600">Restaurantes</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-2">24/7</div>
                <div className="text-gray-600">Disponibilidad</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-2">&lt;30min</div>
                <div className="text-gray-600">Tiempo promedio</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-2">★★★★★</div>
                <div className="text-gray-600">Calidad garantizada</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Home;