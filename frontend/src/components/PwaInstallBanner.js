import React, { useState, useEffect } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';

/**
 * Banner de instalacion de la PWA.
 * Aparece en la parte inferior de la pantalla 6 segundos despues de la primera visita.
 * Solo se muestra una vez por sesion (persiste el "no gracias" en localStorage).
 * En iOS muestra instrucciones manuales ya que Safari no soporta beforeinstallprompt.
 */
const PwaInstallBanner = () => {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-install-dismissed') === '1'
  );

  useEffect(() => {
    if (isInstalled || dismissed) return;

    // Detectar iOS (Safari no dispara beforeinstallprompt pero si acepta PWA via "Compartir > Agregar")
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone = window.navigator.standalone;
    setIsIos(ios);

    // Mostrar si: es iOS (guia manual) o si el navegador soporta A2HS
    const shouldShow = (ios && !isInStandalone) || canInstall;
    if (!shouldShow) return;

    const t = setTimeout(() => setVisible(true), 6000);
    return () => clearTimeout(t);
  }, [canInstall, isInstalled, dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('pwa-install-dismissed', '1');
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (isIos) return; // En iOS no hay prompt programatico
    const accepted = await install();
    if (accepted) setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar Holy Tacos"
      className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100
                 flex items-start gap-3 p-4 animate-pwa-slide-up"
    >
      {/* Icono de la app */}
      <div className="shrink-0 w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center">
        <span className="text-2xl">🌮</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm">Instalar Holy Tacos</p>
        {isIos ? (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Toca <strong>Compartir</strong> <span aria-hidden="true">⬆</span> y luego
            <strong> Agregar a inicio</strong> para instalar la app.
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-1">
            Acceso rapido desde tu pantalla de inicio, sin abrir el navegador.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 shrink-0">
        {!isIos && (
          <button
            type="button"
            onClick={handleInstall}
            className="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-xl hover:bg-orange-700 transition-colors"
          >
            Instalar
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-1.5 text-gray-400 text-xs rounded-xl hover:bg-gray-100 transition-colors"
        >
          {isIos ? 'Cerrar' : 'Ahora no'}
        </button>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
