import React, { useState, useEffect } from 'react';

/**
 * Banner de estado offline/online.
 * Aparece en la parte superior cuando el dispositivo pierde conexion.
 * Desaparece 3 segundos despues de recuperarla mostrando confirmacion.
 */
const OfflineBanner = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      // Ocultar el mensaje de "reconectado" a los 3 segundos
      setTimeout(() => setJustReconnected(false), 3000);
    };
    const handleOffline = () => {
      setOnline(false);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cuando esta online y no acaba de reconectarse: no mostrar nada
  if (online && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-white
        transition-all duration-300 ${justReconnected ? 'bg-green-600' : 'bg-gray-900'}`}
      // safe-area-inset-top: no quedar oculto por el notch de iPhone
      style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
    >
      {justReconnected ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Conexion restaurada
        </>
      ) : (
        <>
          <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728" />
          </svg>
          Sin conexion a internet
        </>
      )}
    </div>
  );
};

export default OfflineBanner;
