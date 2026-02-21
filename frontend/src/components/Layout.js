// Componente Layout que envuelve todas las páginas con Navbar y Footer
import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import MiniCart from './cart/MiniCart';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Barra de navegación */}
      <Navbar />
      {/* Mini carrito lateral (se muestra cuando isMiniCartOpen = true) */}
      <MiniCart />

      {/* Contenido principal */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Pie de página */}
      <Footer />
    </div>
  );
};

export default Layout;