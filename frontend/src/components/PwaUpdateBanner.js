import React, { useState, useEffect } from 'react';

/**
 * Banner de actualizacion del Service Worker.
 * Aparece cuando hay una nueva version de la app lista para instalarse.
 * El usuario elige cuand recargar (no forzado).
 */
const PwaUpdateBanner = () => {
  const [updateRegistration, setUpdateRegistration] = useState(null);

  useEffect(() => {
    // index.js despacha 'sw-update' cuando el SW detecta una nueva version
    const handler = (e) => {
      setUpdateRegistration(e.detail);
    };
    window.addEventListener('sw-update', handler);
    return () => window.removeEventListener('sw-update', handler);
  }, []);

  const handleUpdate = () => {
    if (updateRegistration && updateRegistration.waiting) {
      // Indicarle al nuevo SW que tome el control inmediatamente
      updateRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  if (!updateRegistration) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl
                    flex items-center gap-3 px-4 py-3 animate-pwa-slide-up">
      <svg className="w-5 h-5 shrink-0 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <p className="flex-1 text-sm font-medium">Nueva version disponible</p>
      <button
        type="button"
        onClick={handleUpdate}
        className="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-xl hover:bg-orange-500 transition-colors shrink-0"
      >
        Actualizar
      </button>
    </div>
  );
};

export default PwaUpdateBanner;
