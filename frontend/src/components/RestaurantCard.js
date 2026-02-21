// Componente para mostrar una tarjeta de restaurante en Holy Tacos
import React from 'react';
import { Link } from 'react-router-dom';

const RestaurantCard = ({ restaurant }) => {
  // Calcular calificación promedio (simulada por ahora)
  const rating = (Math.random() * 2 + 3).toFixed(1); // Entre 3.0 y 5.0
  const reviewCount = Math.floor(Math.random() * 500) + 50; // Entre 50 y 550 reseñas

  // Calcular tiempo de entrega estimado
  const deliveryTime = Math.floor(Math.random() * 20) + 20; // Entre 20 y 40 minutos

  // Costo de entrega
  const deliveryFee = 25; // Costo fijo en pesos

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      {/* Imagen del restaurante (placeholder por ahora) */}
      <div className="h-48 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-2 block">🏪</span>
          <p className="text-orange-600 font-medium">{restaurant.name}</p>
        </div>
      </div>

      {/* Información del restaurante */}
      <div className="p-6">
        {/* Nombre y calificación */}
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-semibold text-gray-900">
            <Link
              to={`/restaurant/${restaurant._id}`}
              className="hover:text-orange-600 transition-colors"
            >
              {restaurant.name}
            </Link>
          </h3>
          <div className="flex items-center space-x-1">
            <span className="text-yellow-500">⭐</span>
            <span className="text-sm font-medium">{rating}</span>
            <span className="text-gray-500 text-sm">({reviewCount})</span>
          </div>
        </div>

        {/* Dirección */}
        <p className="text-gray-600 text-sm mb-3 flex items-center">
          <span className="mr-1">📍</span>
          {restaurant.address}
        </p>

        {/* Información de entrega */}
        <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
          <span className="flex items-center">
            <span className="mr-1">🚚</span>
            ${deliveryFee} entrega
          </span>
          <span className="flex items-center">
            <span className="mr-1">⏱️</span>
            {deliveryTime}-{deliveryTime + 10} min
          </span>
        </div>

        {/* Categorías del menú disponibles */}
        {restaurant.menu && restaurant.menu.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Platos disponibles:</p>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set(restaurant.menu.map(item => item.category)))
                .slice(0, 3) // Mostrar máximo 3 categorías
                .map((category, index) => (
                  <span
                    key={index}
                    className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full"
                  >
                    {category}
                  </span>
                ))}
              {restaurant.menu.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{restaurant.menu.length - 3} más
                </span>
              )}
            </div>
          </div>
        )}

        {/* Botón para ver más */}
        <Link
          to={`/restaurant/${restaurant._id}`}
          className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors text-center block font-medium"
        >
          Ver Menú y Pedir
        </Link>
      </div>
    </div>
  );
};

export default RestaurantCard;