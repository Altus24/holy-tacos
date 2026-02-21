// Página de checkout/pago en Holy Tacos con Stripe Checkout
// Usa la dirección predeterminada del perfil del cliente; permite elegir otra guardada o editarla
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import Layout from '../components/Layout';
import BackButton from '../components/BackButton';
import StripeCheckoutForm from '../components/StripeCheckoutForm';
import AddressSelector, { formatAddressLine, getLatLngFromAddress } from '../components/AddressSelector';
import axios from 'axios';

const Checkout = () => {
  const { isAuthenticated, user } = useAuth();
  const {
    cartItems,
    getCartTotal,
    getDeliveryFee,
    getFinalTotal,
    getItemsByRestaurant,
    clearCart
  } = useCart();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryLat, setDeliveryLat] = useState(null);
  const [deliveryLng, setDeliveryLng] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [hasPendingAddressConfirmation, setHasPendingAddressConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderCreated, setOrderCreated] = useState(false);
  const [resumedOrder, setResumedOrder] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const orderIdFromUrl = searchParams.get('orderId');

  // Reanudar pago: si hay ?orderId= y el pedido es propio y está pendiente de pago, mostrar solo formulario Stripe
  useEffect(() => {
    if (!orderIdFromUrl || !isAuthenticated()) {
      setResumeLoading(false);
      return;
    }
    let cancelled = false;
    setResumeLoading(true);
    axios.get(`/api/orders/${orderIdFromUrl}`)
      .then(res => {
        if (cancelled) return;
        const order = res.data?.data;
        if (order && order.paymentStatus === 'pending') {
          setOrderId(order._id);
          setOrderCreated(true);
          setResumedOrder({ _id: order._id, total: order.total, restaurantId: order.restaurantId });
        }
      })
      .catch(() => { if (!cancelled) setResumedOrder(null); })
      .finally(() => { if (!cancelled) setResumeLoading(false); });
    return () => { cancelled = true; };
  }, [orderIdFromUrl, isAuthenticated]);

  // Cargar perfil del cliente para obtener defaultAddress y savedAddresses
  useEffect(() => {
    if (!isAuthenticated()) {
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    axios.get('/api/profile')
      .then(res => {
        if (!cancelled && res.data.success && res.data.data) {
          setProfile(res.data.data);
          const def = res.data.data.clientProfile?.defaultAddress;
          if (def && (def.street || def.number)) {
            setDeliveryAddress(formatAddressLine(def));
            const { lat, lng } = getLatLngFromAddress(def);
            setDeliveryLat(lat);
            setDeliveryLng(lng);
            setSelectedAddress({ ...def, _isDefault: true });
          }
        }
      })
      .catch(() => { if (!cancelled) setProfile(null); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleSelectAddress = (addr) => {
    setSelectedAddress(addr);
    setDeliveryAddress(formatAddressLine(addr));
    const { lat, lng } = getLatLngFromAddress(addr);
    setDeliveryLat(lat);
    setDeliveryLng(lng);
  };

  const handleDeliveryCoordsChange = (lat, lng) => {
    setDeliveryLat(lat);
    setDeliveryLng(lng);
  };

  const handleSaveNewAddressToProfile = async (newAddress) => {
    if (!profile?.clientProfile) return;
    const current = profile.clientProfile;
    const savedAddresses = [...(current.savedAddresses || []), newAddress];
    try {
      await axios.put('/api/profile', {
        clientProfile: { ...current, savedAddresses }
      });
      const res = await axios.get('/api/profile');
      if (res.data.success && res.data.data) setProfile(res.data.data);
    } catch (err) {
      console.error('Error al guardar dirección:', err);
      alert(err.response?.data?.message || 'No se pudo guardar la dirección.');
    }
  };

  // Crear orden y proceder al pago (envía dirección y coordenadas al backend)
  const handleCreateOrderAndPay = async () => {
    const addressTrimmed = deliveryAddress.trim();
    if (!addressTrimmed) {
      alert('Por favor elegí una dirección guardada o buscá/seleccioná una en el mapa.');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        restaurantId: Object.keys(getItemsByRestaurant())[0],
        items: cartItems.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        deliveryAddress: addressTrimmed,
        notes: notes.trim() || undefined
      };
      if (deliveryLat != null && deliveryLng != null) {
        orderData.deliveryLat = deliveryLat;
        orderData.deliveryLng = deliveryLng;
      }

      const response = await axios.post('/api/orders', orderData);
      const orderResult = response.data;
      setOrderId(orderResult.data._id);
      setOrderCreated(true);
    } catch (error) {
      console.error('Error al crear orden:', error);
      const errorMessage = error.response?.data?.message || 'Error al procesar tu pedido. Inténtalo de nuevo.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Si no está autenticado, mostrar mensaje
  if (!isAuthenticated()) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Acceso requerido
            </h2>
            <p className="text-gray-600 mb-6">
              Debes iniciar sesión para proceder con tu compra.
            </p>
            <div className="space-x-4">
              <Link
                to="/login"
                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/register"
                className="border border-orange-600 text-orange-600 px-6 py-3 rounded-lg hover:bg-orange-50 transition-colors font-medium"
              >
                Registrarse
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Si el carrito está vacío y no estamos reanudando un pedido pendiente, redirigir
  if (cartItems.length === 0 && !resumedOrder && !orderIdFromUrl) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-4">🛒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Carrito vacío
            </h2>
            <p className="text-gray-600 mb-6">
              Agrega algunos productos antes de proceder al pago.
            </p>
            <Link
              to="/restaurants"
              className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              Explorar Restaurantes
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Reanudar pago: pedido no encontrado o ya pagado
  if (orderIdFromUrl && !resumeLoading && !resumedOrder) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
          <div className="max-w-md w-full text-center">
            <div className="text-6xl mb-4">💳</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Pedido no disponible
            </h2>
            <p className="text-gray-600 mb-6">
              No se encontró el pedido o ya fue pagado. Revisá <Link to="/orders" className="text-orange-600 font-medium hover:underline">Mis pedidos</Link> o volvé al carrito.
            </p>
            <div className="space-x-4">
              <Link to="/cart" className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium">
                Ir al carrito
              </Link>
              <Link to="/orders" className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 font-medium">
                Mis pedidos
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Vista simplificada: solo completar pago de un pedido pendiente (reanudar)
  if (resumedOrder && orderCreated) {
    const restaurantName = resumedOrder.restaurantId?.name || 'Restaurante';
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 py-12 px-4">
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <BackButton to="/cart" label="Volver al carrito" variant="link" />
            </div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Completar pago
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                Pedido #{resumedOrder._id.slice(-6)} • {restaurantName}
              </p>
              <StripeCheckoutForm
                amount={resumedOrder.total}
                orderId={resumedOrder._id}
                onPaymentSuccess={() => {
                  alert('¡Pago exitoso! Tu pedido está siendo procesado.');
                  clearCart();
                  window.location.href = '/orders';
                }}
                onPaymentError={(error) => alert(`Error en el pago: ${error}`)}
              />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (resumeLoading && orderIdFromUrl) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600" />
          <p className="ml-3 text-gray-600">Cargando pedido...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Botón volver al carrito */}
          <div className="mb-4">
            <BackButton to="/cart" label="Volver al carrito" variant="link" />
          </div>
          {/* Encabezado */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Finalizar Compra
            </h1>
            <p className="text-gray-600 mt-2">
              Completa tu información y procede al pago seguro.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Información del pedido */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center">
                  <span className="mr-2">📦</span>
                  Resumen del Pedido
                </h2>

                {/* Items del carrito */}
                <div className="space-y-3 mb-6">
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <span className="font-medium">{item.quantity}x</span>
                        <span className="ml-2">{item.name}</span>
                      </div>
                      <span className="font-medium">${item.total}</span>
                    </div>
                  ))}
                </div>

                {/* Totales */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>${getCartTotal()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Entrega:</span>
                    <span>${getDeliveryFee()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span className="text-orange-600">${getFinalTotal()}</span>
                  </div>
                </div>
              </div>

              {/* Información de entrega: dirección del perfil o ingresada */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center">
                  <span className="mr-2">🏠</span>
                  Información de Entrega
                </h2>
                {profileLoading ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600" />
                    Cargando tu dirección...
                  </div>
                ) : (
                  <AddressSelector
                    profile={profile}
                    selectedAddress={selectedAddress}
                    onSelectAddress={handleSelectAddress}
                    deliveryAddressText={deliveryAddress}
                    onDeliveryAddressChange={setDeliveryAddress}
                    deliveryLat={deliveryLat}
                    deliveryLng={deliveryLng}
                    onDeliveryCoordsChange={handleDeliveryCoordsChange}
                    notes={notes}
                    onNotesChange={setNotes}
                    onSaveNewAddressToProfile={handleSaveNewAddressToProfile}
                    onUseNewAddress={() => setSelectedAddress(null)}
                    onPendingAddressChange={setHasPendingAddressConfirmation}
                    disabled={orderCreated}
                  />
                )}
                {!profileLoading && !profile?.clientProfile?.defaultAddress?.street && !profile?.clientProfile?.savedAddresses?.length && (
                  <p className="mt-3 text-sm text-amber-700 bg-amber-50 rounded p-2">
                    No tenés una dirección guardada. Buscá una dirección o elegí en el mapa arriba; podés guardarla en tu perfil al confirmar.
                  </p>
                )}
              </div>
            </div>

            {/* Sección de pago */}
            <div>
              {!orderCreated ? (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-6 flex items-center">
                    <span className="mr-2">💳</span>
                    Pago Seguro
                  </h2>

                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🔒</span>
                        <div>
                          <h4 className="font-semibold text-blue-900">Pago procesado por Stripe</h4>
                          <p className="text-sm text-blue-700">
                            Tu información de pago está completamente segura y encriptada.
                          </p>
                        </div>
                      </div>
                    </div>

                    {hasPendingAddressConfirmation && (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-800 text-sm">
                        <p className="font-medium">Respondé si deseas guardar la dirección</p>
                        <p className="mt-1">Arriba, en la sección de entrega, elegí &quot;Sí, guardar en mi perfil&quot; o &quot;No, solo usar para este pedido&quot; antes de continuar al pago.</p>
                      </div>
                    )}

                    <button
                      onClick={handleCreateOrderAndPay}
                      disabled={loading || hasPendingAddressConfirmation}
                      className="w-full bg-orange-600 text-white py-4 px-6 rounded-lg hover:bg-orange-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                          Creando pedido...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">💳</span>
                          Proceder al Pago Seguro
                        </>
                      )}
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                      Al continuar, aceptas nuestros términos y condiciones.
                      Serás redirigido a Stripe para completar tu pago.
                    </p>
                  </div>
                </div>
              ) : (
                <StripeCheckoutForm
                  amount={getFinalTotal()}
                  orderId={orderId}
                  onPaymentSuccess={() => {
                    alert('¡Pago exitoso! Tu pedido está siendo procesado.');
                    clearCart();
                    window.location.href = '/orders';
                  }}
                  onPaymentError={(error) => {
                    alert(`Error en el pago: ${error}`);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
