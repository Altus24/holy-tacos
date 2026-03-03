// Componente de pie de página para Holy Tacos
import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Información de la empresa */}
          <div>
            <h5 className="text-lg font-semibold mb-4">🍕 Holy Tacos</h5>
            <p className="text-gray-400 mb-4">
              Tu plataforma de delivery de confianza para comida deliciosa.
              Conectamos los mejores restaurantes con los amantes de la comida.
            </p>
            <div className="flex space-x-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                📘 Facebook
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                📷 Instagram
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                🐦 Twitter
              </a>
            </div>
          </div>

          {/* Enlaces principales */}
          <div>
            <h6 className="font-semibold mb-4">Plataforma</h6>
            <ul className="space-y-2 text-gray-400">
              <li>
                <Link to="/restaurants" className="hover:text-white transition-colors">
                  Restaurantes
                </Link>
              </li>
              <li>
                <Link to="/orders" className="hover:text-white transition-colors">
                  Mis Pedidos
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-white transition-colors">
                  Carrito
                </Link>
              </li>
            </ul>
          </div>

          {/* Soporte */}
          <div>
            <h6 className="font-semibold mb-4">Soporte</h6>
            <ul className="space-y-2 text-gray-400">
              <li>
                <Link to="/help" className="hover:text-white transition-colors">
                  Centro de Ayuda
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contacto
                </Link>
              </li>
              <li>
                <Link to="/report" className="hover:text-white transition-colors">
                  Reportar Problema
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h6 className="font-semibold mb-4">Legal</h6>
            <ul className="space-y-2 text-gray-400">
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:text-white transition-colors">
                  Política de Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Línea divisoria */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              &copy; 2024 Holy Tacos. Todos los derechos reservados.
            </p>

            {/* Información adicional */}
            <div className="flex space-x-6 mt-4 md:mt-0">
              <span className="text-gray-400 text-sm">
                🚚 Entregas en toda la ciudad
              </span>
              <span className="text-gray-400 text-sm">
                ⏰ 24/7 Disponible
              </span>
              <span className="text-gray-400 text-sm">
                ⭐ Más de 1000+ reseñas positivas
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;