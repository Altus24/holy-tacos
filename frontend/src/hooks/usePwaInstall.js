import { useState, useEffect } from 'react';

/**
 * Hook para manejar el prompt nativo "Agregar a pantalla de inicio" (A2HS / beforeinstallprompt).
 *
 * Uso:
 *   const { canInstall, isInstalled, install } = usePwaInstall();
 *
 * - canInstall: true si el navegador soporta A2HS y la app no esta instalada todavia
 * - isInstalled: true si la app ya corre como PWA (display: standalone)
 * - install(): muestra el prompt nativo del navegador
 */
export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detectar si ya corre como PWA instalada (standalone)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevenir el mini-banner automatico del navegador para controlarlo nosotros
      e.preventDefault();
      setPromptEvent(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return false;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setPromptEvent(null);
      return true;
    }
    return false;
  };

  return {
    canInstall: !!promptEvent && !isInstalled,
    isInstalled,
    install
  };
}
