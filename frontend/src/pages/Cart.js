// Página del carrito de compras en Holy Tacos
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import axios from 'axios';

const Cart = () => {
  const { isAuthenticated } = useAuth();
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    getDeliveryFee,
    getFinalTotal,
    getItemsByRestaurant,
    hasMultipleRestaurants
  } = useCart();

  const [pendingOrders, setPendingOrders] = useState([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      setPendingOrders([]);
      return;
    }
    axios.get('/api/orders')
      .then(res => {
        if (res.data.success && Array.isArray(res.data.data)) {
          const pending = res.data.data.filter(o => o.paymentStatus === 'pending');
          setPendingOrders(pending);
        }
      })
      .catch(() => setPendingOrders([]));
  }, [isAuthenticated]);

  const itemsByRestaurant = getItemsByRestaurant();

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <BackButton to="/restaurants" label="Volver a Restaurantes" variant="link" />
          </div>
          {/* Encabezado */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Carrito de Compras
            </h1>
            <p className="text-gray-600 mt-2">
              Revisa y confirma tu pedido antes de proceder al pago.
            </p>
          </div>

          {/* Pedido(s) pendiente(s) de pago */}
          {isAuthenticated() && pendingOrders.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-amber-900 mb-3 flex items-center">
                <span className="mr-2">💳</span>
                Pedido pendiente de pago
              </h2>
              <p className="text-amber-800 text-sm mb-4">
                Tenés un pedido creado que aún no se pagó. Podés completar el pago ahora o verlo en Mis pedidos.
              </p>
              <div className="space-y-3">
                {pendingOrders.map(order => (
                  <div key={order._id} className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-lg p-4 border border-amber-200">
                    <div>
                      <p className="font-medium text-gray-900">
                        Pedido #{order._id.slice(-6)} • {order.restaurantId?.name || 'Restaurante'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {order.items?.length || 0} items • Total: ${order.total}
                      </p>
                    </div>
                    <Link
                      to={`/checkout?orderId=${order._id}`}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium text-sm whitespace-nowrap"
                    >
                      Completar pago
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Carrito vacío */}
          {cartItems.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">🛒</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Tu carrito está vacío
              </h3>
              <p className="text-gray-600 mb-6">
                ¡Agrega algunos platillos deliciosos a tu carrito!
              </p>
              <Link
                to="/restaurants"
                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Ver Restaurantes
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Lista de items del carrito */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow">
                  {/* Encabezado con opción de limpiar */}
                  <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-semibold">
                      Tu Pedido ({cartItems.reduce((total, item) => total + item.quantity, 0)} items)
                    </h2>
                    <button
                      onClick={clearCart}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Limpiar carrito
                    </button>
                  </div>

                  {/* Items agrupados por restaurante */}
                  <div className="divide-y">
                    {Object.entries(itemsByRestaurant).map(([restaurantId, restaurantData]) => (
                      <div key={restaurantId} className="p-6">
                        {/* Nombre del restaurante */}
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          📍 {restaurantData.restaurantName}
                        </h3>

                        {/* Items del restaurante */}
                        <div className="space-y-4">
                          {restaurantData.items.map((item, index) => (
                            <div key={index} className="flex items-center space-x-4 bg-gray-50 rounded-lg p-4">
                              {/* Información del item */}
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900">{item.name}</h4>
                                {item.description && (
                                  <p className="text-sm text-gray-600">{item.description}</p>
                                )}
                                <p className="text-sm text-gray-500">${item.price} c/u</p>
                              </div>

                              {/* Controles de cantidad */}
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => updateQuantity(item.restaurantId, item.name, item.quantity - 1)}
                                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.restaurantId, item.name, item.quantity + 1)}
                                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>

                              {/* Subtotal y eliminar */}
                              <div className="text-right">
                                <p className="font-medium">${item.subtotal}</p>
                                <button
                                  onClick={() => removeFromCart(item.restaurantId, item.name)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resumen del pedido */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow p-6 sticky top-4">
                  <h2 className="text-xl font-semibold mb-6">Resumen del Pedido</h2>

                  {/* Subtotal */}
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>${getCartTotal()}</span>
                  </div>

                  {/* Costo de entrega */}
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Entrega:</span>
                    <span>${getDeliveryFee()}</span>
                  </div>

                  {/* Línea divisoria */}
                  <hr className="my-4" />

                  {/* Total */}
                  <div className="flex justify-between text-lg font-semibold mb-6">
                    <span>Total:</span>
                    <span className="text-orange-600">${getFinalTotal()}</span>
                  </div>

                  {/* Advertencia si hay múltiples restaurantes */}
                  {hasMultipleRestaurants() && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                      <p className="text-yellow-800 text-sm">
                        ⚠️ Tu pedido incluye items de múltiples restaurantes.
                        Se procesarán como pedidos separados.
                      </p>
                    </div>
                  )}

                  {/* Botones de acción */}
                  <div className="space-y-3">
                    <Link
                      to="/checkout"
                      className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium text-center block"
                    >
                      Proceder al Pago
                    </Link>
                    <Link
                      to="/restaurants"
                      className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center block"
                    >
                      Agregar Más Items
                    </Link>
                  </div>

                  {/* Información adicional */}
                  <div className="mt-6 text-xs text-gray-500 text-center">
                    <p>🚚 Entrega gratuita en pedidos mayores a $300</p>
                    <p>⏱️ Tiempo estimado: 25-40 minutos</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Cart;