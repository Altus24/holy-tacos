// Página de lista de restaurantes para Holy Tacos
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import RestaurantCard from '../components/RestaurantCard';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';

const Restaurants = () => {
  // Estado para los restaurantes
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);

  // Estado para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Estado de carga
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Obtener todas las categorías disponibles
  const getAvailableCategories = () => {
    const categories = new Set();
    restaurants.forEach(restaurant => {
      restaurant.menu?.forEach(item => {
        if (item.category) {
          categories.add(item.category);
        }
      });
    });
    return Array.from(categories);
  };

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

  // Aplicar filtros cuando cambian los criterios
  useEffect(() => {
    let filtered = restaurants;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(restaurant =>
        restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        restaurant.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por categoría
    if (selectedCategory) {
      filtered = filtered.filter(restaurant =>
        restaurant.menu?.some(item => item.category === selectedCategory)
      );
    }

    setFilteredRestaurants(filtered);
  }, [searchTerm, selectedCategory, restaurants]);

  const categories = getAvailableCategories();

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <BackButton to="/" label="Volver al Inicio" variant="link" />
          </div>
          {/* Encabezado */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Nuestros Restaurantes
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Descubre una amplia variedad de restaurantes con los mejores platillos
              de tu ciudad. Todos nuestros socios ofrecen entrega rápida y segura.
            </p>
          </div>

          {/* Filtros y búsqueda */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Barra de búsqueda */}
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar restaurante
                </label>
                <div className="relative">
                  <input
                    id="search"
                    type="text"
                    placeholder="Nombre del restaurante o dirección..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-gray-400">🔍</span>
                  </div>
                </div>
              </div>

              {/* Filtro por categoría */}
              <div className="md:w-64">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Filtrar por tipo
                </label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón para limpiar filtros */}
              {(searchTerm || selectedCategory) && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Información de resultados */}
            <div className="mt-4 text-sm text-gray-600">
              {filteredRestaurants.length === restaurants.length ? (
                <span>Mostrando todos los {restaurants.length} restaurantes disponibles</span>
              ) : (
                <span>
                  Mostrando {filteredRestaurants.length} de {restaurants.length} restaurantes
                  {(searchTerm || selectedCategory) && ' (filtrados)'}
                </span>
              )}
            </div>
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
                Verifica que el servidor backend esté ejecutándose en http://localhost:5000
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
                    No se encontraron restaurantes
                  </h3>
                  <p className="text-gray-600">
                    Intenta ajustar tus filtros de búsqueda
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

          {/* Información adicional */}
          <div className="mt-16 bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                ¿Quieres ser parte de Holy Tacos?
              </h3>
              <p className="text-gray-600 mb-6">
                Si eres propietario de un restaurante y quieres unirte a nuestra plataforma,
                contáctanos para más información.
              </p>
              <button className="bg-orange-600 text-white px-8 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium">
                Contactar Soporte
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Restaurants;