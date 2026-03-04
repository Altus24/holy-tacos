import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/ErrorBoundary';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Registrar el Service Worker (cache-first para assets, offline support)
// onUpdate: muestra un toast no intrusivo para que el usuario recargue cuando hay una nueva versión
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    // Notificar en consola; el toast se maneja en el componente PwaUpdateBanner
    window.dispatchEvent(new CustomEvent('sw-update', { detail: registration }));
  },
  onSuccess: () => {
    console.log('[PWA] Contenido guardado. La app funciona sin conexion.');
  }
});

reportWebVitals();