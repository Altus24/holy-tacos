// MiniCart: panel lateral rápido con resumen del carrito
// Muestra items, totales y acceso directo al carrito completo.
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

const MiniCart = () => {
  const {
    cartItems,
    getCartTotal,
    getDeliveryFee,
    getFinalTotal,
    isMiniCartOpen,
    closeMiniCart
  } = useCart();
  const location = useLocation();

  // No mostrar si no hay items
  if (!cartItems || cartItems.length === 0) return null;

  // Ocultar en la página de carrito/checkout (ya se ve el carrito completo)
  if (['/cart', '/checkout'].includes(location.pathname)) return null;

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 w-full max-w-sm transform transition-transform duration-300
        ${isMiniCartOpen ? 'translate-x-0' : 'translate-x-full'}`}
      aria-hidden={!isMiniCartOpen}
    >
      {/* Fondo semitransparente clicable para cerrar */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30"
        onClick={closeMiniCart}
      />

      {/* Panel del mini-cart */}
      <div className="relative h-full bg-white shadow-2xl flex flex-col">
        {/* Encabezado */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Tu carrito</h2>
          <button
            type="button"
            onClick={closeMiniCart}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Cerrar mini carrito"
          >
            ✕
          </button>
        </div>

        {/* Lista de items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {cartItems.map((item, index) => (
            <div
              key={`${item.restaurantId}-${item.name}-${index}`}
              className="flex justify-between items-start border-b pb-2 last:border-b-0"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {item.quantity}x {item.name}
                </p>
                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {item.restaurantName}
                </p>
              </div>
              <div className="text-sm font-semibold text-gray-800">
                ${item.subtotal}
              </div>
            </div>
          ))}
        </div>

        {/* Resumen y acciones */}
        <div className="border-t px-4 py-3 bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>${getCartTotal()}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Entrega</span>
            <span>${getDeliveryFee()}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg mt-2">
            <span>Total</span>
            <span className="text-orange-600">${getFinalTotal()}</span>
          </div>

          <div className="mt-3 flex gap-2">
            <Link
              to="/cart"
              className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg text-sm font-medium text-center hover:bg-orange-700 transition-colors"
              onClick={closeMiniCart}
            >
              Ver carrito
            </Link>
            <button
              type="button"
              onClick={closeMiniCart}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Seguir comprando
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiniCart;

