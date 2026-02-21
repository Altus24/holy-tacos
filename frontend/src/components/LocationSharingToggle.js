// Componente LocationSharingToggle para Holy Tacos
// Permite al driver activar/desactivar compartir ubicación en tiempo real
// Incluye watchPosition, emisión por socket y mini-mapa de su posición
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';

// Intervalo de emisión de ubicación (en milisegundos)
const EMIT_INTERVAL = 10000; // 10 segundos

const LocationSharingToggle = ({ user, onStatusChange }) => {
  // Estado del toggle
  const [isSharing, setIsSharing] = useState(
    user?.driverProfile?.shareLocation || false
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Estado de la ubicación actual
  const [currentPosition, setCurrentPosition] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [lastEmitted, setLastEmitted] = useState(null);
  const [emitCount, setEmitCount] = useState(0);

  // Estado del permiso de geolocalización
  const [geoPermission, setGeoPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'

  // Referencias
  const watchIdRef = useRef(null);
  const emitIntervalRef = useRef(null);
  const lastPositionRef = useRef(null);

  // Socket
  const { socket, isConnected } = useSocket();

  // Sincronizar con el estado del usuario
  useEffect(() => {
    const serverState = user?.driverProfile?.shareLocation || false;
    setIsSharing(serverState);
  }, [user?.driverProfile?.shareLocation]);

  // Verificar permisos de geolocalización al montar
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setGeoPermission(result.state);
        result.onchange = () => setGeoPermission(result.state);
      }).catch(() => {
        // Algunos navegadores no soportan permissions API
        setGeoPermission('prompt');
      });
    }
  }, []);

  // Función para emitir ubicación al socket
  const emitLocation = useCallback((position) => {
    if (!socket || !isConnected || !position) return;

    socket.emit('shareDriverLocation', {
      lat: position.lat,
      lng: position.lng
    });

    setLastEmitted(new Date());
    setEmitCount(prev => prev + 1);
  }, [socket, isConnected]);

  // Iniciar watchPosition cuando se activa el sharing
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.');
      return;
    }

    // Limpiar watchers anteriores
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // Iniciar watch de posición
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCurrentPosition(newPos);
        setGpsAccuracy(Math.round(position.coords.accuracy));
        lastPositionRef.current = newPos;
        setError('');
      },
      (err) => {
        const errorMessages = {
          1: 'Permiso de ubicación denegado. Habilitalo en la configuración del navegador.',
          2: 'No se pudo determinar tu ubicación. Verificá tu GPS.',
          3: 'Tiempo de espera agotado al obtener la ubicación.'
        };
        setError(errorMessages[err.code] || 'Error al obtener ubicación.');
        setGeoPermission('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    // Iniciar intervalo de emisión
    if (emitIntervalRef.current) {
      clearInterval(emitIntervalRef.current);
    }
    emitIntervalRef.current = setInterval(() => {
      if (lastPositionRef.current) {
        emitLocation(lastPositionRef.current);
      }
    }, EMIT_INTERVAL);

    // Emitir inmediatamente la primera vez
    if (lastPositionRef.current) {
      emitLocation(lastPositionRef.current);
    }
  }, [emitLocation]);

  // Detener watchPosition cuando se desactiva
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (emitIntervalRef.current) {
      clearInterval(emitIntervalRef.current);
      emitIntervalRef.current = null;
    }
    setEmitCount(0);
    setLastEmitted(null);
  }, []);

  // Activar/desactivar watching según estado
  useEffect(() => {
    if (isSharing) {
      startWatching();
    } else {
      stopWatching();
    }

    // Limpieza al desmontar
    return () => {
      stopWatching();
    };
  }, [isSharing, startWatching, stopWatching]);

  // Función para activar el sharing (con confirmación)
  const handleActivate = () => {
    // Mostrar modal de confirmación la primera vez
    if (!user?.driverProfile?.lastLocationShared) {
      setShowConfirmModal(true);
    } else {
      toggleSharing(true);
    }
  };

  // Función para confirmar activación desde el modal
  const confirmActivate = () => {
    setShowConfirmModal(false);
    toggleSharing(true);
  };

  // Toggle del sharing en backend
  const toggleSharing = async (newState) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.put('/api/profile/driver/location-sharing', {
        shareLocation: newState
      });

      if (response.data.success) {
        setIsSharing(newState);
        if (onStatusChange) {
          onStatusChange(newState);
        }
      } else {
        setError(response.data.message || 'Error al cambiar configuración');
      }
    } catch (err) {
      console.error('Error al cambiar compartir ubicación:', err);
      setError(err.response?.data?.message || 'Error al cambiar configuración');
    } finally {
      setIsLoading(false);
    }
  };

  // Forzar envío inmediato de ubicación
  const forceEmit = () => {
    if (lastPositionRef.current) {
      emitLocation(lastPositionRef.current);
    }
  };

  // Formatear hora del último envío
  const formatLastEmitted = (date) => {
    if (!date) return 'Nunca';
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Encabezado */}
      <div className={`px-6 py-4 ${isSharing ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Ícono animado */}
            <div className={`relative ${isSharing ? 'text-green-600' : 'text-gray-400'}`}>
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {isSharing && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Compartir mi ubicación en tiempo real
              </h2>
              <p className={`text-sm font-medium ${isSharing ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {isSharing ? 'Compartiendo ubicación' : 'No compartiendo'}
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            onClick={() => isSharing ? toggleSharing(false) : handleActivate()}
            disabled={isLoading}
            className="relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
            style={{ backgroundColor: isSharing ? '#16a34a' : '#d1d5db' }}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              </div>
            ) : (
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                isSharing ? 'translate-x-8' : 'translate-x-1'
              }`} />
            )}
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-6 py-4 space-y-4">
        {/* Texto explicativo */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Al activar, tu ubicación se compartirá en tiempo real con los clientes que tengan pedidos asignados a vos
            y con el administrador. Se asociará a tu teléfono: <strong>{user?.phone || 'No configurado'}</strong>.
            Podés desactivarlo en cualquier momento.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Estado detallado cuando está compartiendo */}
        {isSharing && (
          <div className="space-y-3">
            {/* Indicadores de estado */}
            <div className="grid grid-cols-2 gap-3">
              {/* GPS */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${currentPosition ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">GPS</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {currentPosition ? 'Conectado' : 'Obteniendo...'}
                </p>
                {gpsAccuracy && (
                  <p className="text-xs text-gray-500">Precisión: ~{gpsAccuracy}m</p>
                )}
              </div>

              {/* Socket */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Conexión</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </p>
                <p className="text-xs text-gray-500">
                  {emitCount > 0 ? `${emitCount} envíos` : 'Esperando...'}
                </p>
              </div>
            </div>

            {/* Coordenadas actuales */}
            {currentPosition && (
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Tu ubicación actual</p>
                    <p className="text-sm font-mono text-green-900 dark:text-green-300">
                      {currentPosition.lat.toFixed(6)}, {currentPosition.lng.toFixed(6)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                      Último envío: {formatLastEmitted(lastEmitted)}
                    </p>
                  </div>
                  <button
                    onClick={forceEmit}
                    disabled={!currentPosition || !isConnected}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Forzar envío inmediato de ubicación"
                  >
                    Enviar ahora
                  </button>
                </div>
              </div>
            )}

            {/* Advertencia de socket desconectado */}
            {!isConnected && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  La conexión al servidor está interrumpida. Tu ubicación se enviará automáticamente cuando se restablezca.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Permiso denegado */}
        {geoPermission === 'denied' && !isSharing && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <p className="text-sm text-orange-800 dark:text-orange-300">
              El permiso de ubicación está bloqueado. Para compartir tu ubicación, habilitalo en la configuración del navegador.
            </p>
          </div>
        )}
      </div>

      {/* ========== MODAL DE CONFIRMACIÓN ========== */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="text-center mb-4">
              <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Compartir ubicación en tiempo real
              </h3>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Al activar esta función:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Tu ubicación será visible para los clientes con pedidos activos asignados a vos
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  El administrador podrá ver tu posición para monitoreo
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Se asociará a tu teléfono: <strong>{user?.phone || 'No configurado'}</strong>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Podés desactivarlo en cualquier momento
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmActivate}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Activar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSharingToggle;
