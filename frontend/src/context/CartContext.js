// Context API para manejar el carrito de compras en Holy Tacos
import React, { createContext, useContext, useState, useEffect } from 'react';

// Context para el carrito
const CartContext = createContext();

// Hook personalizado para usar el contexto del carrito
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de un CartProvider');
  }
  return context;
};

// Provider del contexto del carrito
export const CartProvider = ({ children }) => {
  // Estado del carrito - array de items
  const [cartItems, setCartItems] = useState([]);

  // Estado de loading para operaciones del carrito
  const [loading, setLoading] = useState(false);

  // Estado para el mini-cart (panel lateral/dropdown rápido)
  const [isMiniCartOpen, setIsMiniCartOpen] = useState(false);

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    const savedCart = localStorage.getItem('holy-tacos-cart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error al cargar carrito desde localStorage:', error);
        localStorage.removeItem('holy-tacos-cart');
      }
    }
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('holy-tacos-cart', JSON.stringify(cartItems));
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

    // Abrir mini-cart automáticamente al agregar (mejor UX)
    setIsMiniCartOpen(true);
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

  // Función para limpiar todo el carrito
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
    closeMiniCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};