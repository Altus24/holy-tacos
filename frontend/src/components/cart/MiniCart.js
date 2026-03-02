// MiniCart: panel lateral rápido con resumen del carrito.
// Header con chevron para plegar/desplegar; al agregar ítem se abre expandido.
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useCart } from '../../context/CartContext';

const MiniCart = () => {
  const {
    cartItems,
    getCartTotal,
    getDeliveryFee,
    getFinalTotal,
    getTotalItemsCount,
    isMiniCartOpen,
    closeMiniCart,
    isMiniCartExpanded,
    toggleMiniCartExpanded
  } = useCart();
  const location = useLocation();
  const totalItems = getTotalItemsCount();

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
        {/* Encabezado clickable: toggle expandir/colapsar; chevron a la derecha */}
        <div
          role="button"
          tabIndex={0}
          onClick={toggleMiniCartExpanded}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMiniCartExpanded(); } }}
          className="px-4 py-3 border-b flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors select-none"
          aria-expanded={isMiniCartExpanded}
          aria-label={isMiniCartExpanded ? 'Plegar carrito' : 'Desplegar carrito'}
        >
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-semibold text-gray-900">
              Carrito ({totalItems} {totalItems === 1 ? 'ítem' : 'ítems'})
            </span>
            {!isMiniCartExpanded && (
              <span className="text-sm font-semibold text-orange-600 mt-0.5">
                Total ${getFinalTotal()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-2">
            {/* Chevron más grande y visible en móvil (w-7 h-7), contraste alto */}
            <span className="flex items-center justify-center p-2 -m-2 touch-manipulation" aria-hidden>
              <ChevronDown
                className={`w-7 h-7 min-w-[28px] min-h-[28px] text-gray-700 transition-transform duration-200 ${isMiniCartExpanded ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); closeMiniCart(); }}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded touch-manipulation"
              aria-label="Cerrar mini carrito"
            >
              <span className="text-lg">✕</span>
            </button>
          </div>
        </div>

        {/* Contenido expandible: lista + resumen + botones (animación suave) */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out flex flex-col"
          style={{
            maxHeight: isMiniCartExpanded ? '70vh' : '0',
            opacity: isMiniCartExpanded ? 1 : 0
          }}
        >
          {/* Lista de items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {cartItems.map((item, index) => (
              <div
                key={`${item.restaurantId}-${item.name}-${index}`}
                className="flex justify-between items-start border-b pb-2 last:border-b-0"
              >
                <div className="min-w-0">
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
                <div className="text-sm font-semibold text-gray-800 shrink-0 ml-2">
                  ${item.subtotal}
                </div>
              </div>
            ))}
          </div>

          {/* Resumen y acciones */}
          <div className="border-t px-4 py-3 bg-gray-50 shrink-0">
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
    </div>
  );
};

export default MiniCart;

