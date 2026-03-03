// Context API para el carrito en Holy Tacos. Tras registro de cliente se llama clearCart() para dejarlo vacío.
import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

// Hook personalizado para usar el contexto del carrito
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de un CartProvider');
  }
  return context;
};

const CART_STORAGE_KEY = 'holy-tacos-cart';

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error al cargar carrito desde localStorage:', error);
    localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
}

// Provider del contexto del carrito
export const CartProvider = ({ children }) => {
  // Estado del carrito: inicializar desde localStorage para que al recargar no se pierda
  const [cartItems, setCartItems] = useState(loadCartFromStorage);

  // Estado de loading para operaciones del carrito (disponible para futuras mejoras)
  const [loading] = useState(false);

  // Estado para el mini-cart (panel lateral/dropdown rápido)
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);
  // Estado expandido/colapsado del contenido del mini-cart (header siempre visible cuando abierto)
  const [isMiniCartExpanded, setIsMiniCartExpanded] = useState(true);

  // Guardar carrito en localStorage cuando cambie (no en el primer render, así no se sobrescribe con [])
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  // Función para agregar item al carrito
  const addToCart = (restaurantId, restaurantName, item, quantity = 1) => {
    if (quantity <= 0) return;

    setCartItems(prevItems => {
      // Buscar si el item ya existe en el carrito
      const existingItemIndex = prevItems.findIndex(
        cartItem =>
          cartItem.restaurantId === restaurantId &&
          cartItem.name === item.name
      );

      if (existingItemIndex >= 0) {
        // Si existe, actualizar cantidad
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex].quantity += quantity;
        updatedItems[existingItemIndex].subtotal = updatedItems[existingItemIndex].price * updatedItems[existingItemIndex].quantity;
        return updatedItems;
      } else {
        // Si no existe, agregar nuevo item
        const newItem = {
          restaurantId,
          restaurantName,
          name: item.name,
          price: item.price,
          quantity: quantity,
          subtotal: item.price * quantity,
          description: item.description || ''
        };
        return [...prevItems, newItem];
      }
    });

    // No abrir el menú lateral al agregar; el toast en RestaurantDetail informa al usuario.
  };

  // Función para actualizar cantidad de un item
  const updateQuantity = (restaurantId, itemName, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(restaurantId, itemName);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.restaurantId === restaurantId && item.name === itemName
          ? {
              ...item,
              quantity: newQuantity,
              subtotal: item.price * newQuantity
            }
          : item
      )
    );
  };

  // Función para remover item del carrito
  const removeFromCart = (restaurantId, itemName) => {
    setCartItems(prevItems =>
      prevItems.filter(item =>
        !(item.restaurantId === restaurantId && item.name === itemName)
      )
    );
  };

  // Vaciar carrito (usado tras registro de cliente para iniciar con carrito vacío)
  const clearCart = () => {
    setCartItems([]);
  };

  // Función para obtener el total del carrito
  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.subtotal, 0);
  };

  // Función para obtener el costo de entrega (puede variar por restaurante)
  const getDeliveryFee = () => {
    // Costo fijo de entrega, pero podría calcularse por restaurante
    return cartItems.length > 0 ? 25 : 0;
  };

  // Función para obtener el total final (productos + entrega)
  const getFinalTotal = () => {
    return getCartTotal() + getDeliveryFee();
  };

  // Función para obtener items agrupados por restaurante
  const getItemsByRestaurant = () => {
    const grouped = {};
    cartItems.forEach(item => {
      if (!grouped[item.restaurantId]) {
        grouped[item.restaurantId] = {
          restaurantName: item.restaurantName,
          items: []
        };
      }
      grouped[item.restaurantId].items.push(item);
    });
    return grouped;
  };

  // Función para obtener la cantidad total de items
  const getTotalItemsCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  // Función para verificar si el carrito tiene items de múltiples restaurantes
  const hasMultipleRestaurants = () => {
    const restaurantIds = [...new Set(cartItems.map(item => item.restaurantId))];
    return restaurantIds.length > 1;
  };

  // Control explícito del mini-cart para otros componentes (Navbar, botones, etc.)
  const openMiniCart = () => setIsMiniCartOpen(true);
  const closeMiniCart = () => setIsMiniCartOpen(false);
  const toggleMiniCartExpanded = () => setIsMiniCartExpanded(prev => !prev);

  // Valor del contexto
  const value = {
    cartItems,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    getDeliveryFee,
    getFinalTotal,
    getItemsByRestaurant,
    getTotalItemsCount,
    hasMultipleRestaurants,
    isMiniCartOpen,
    openMiniCart,
    closeMiniCart,
    isMiniCartExpanded,
    toggleMiniCartExpanded
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};