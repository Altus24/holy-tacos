// Modal de confirmación para cancelar un pedido desde el panel de administración
// Muestra información detallada del pedido y diferencia según estado de pago
import React, { useState } from 'react';

const CancelOrderAdminModal = ({
  isOpen,
  onClose,
  onConfirm,
  order,
  isLoading = false
}) => {
  // Estado para el motivo de cancelación
  const [reason, setReason] = useState('');
  // Controlar si se seleccionó un motivo predefinido o se escribe uno personalizado
  const [customReason, setCustomReason] = useState(false);

  // Si el modal no está abierto o no hay pedido, no renderizar
  if (!isOpen || !order) return null;

  // Determinar si el pedido fue pagado
  const isPaid = order.paymentStatus === 'paid';

  // Calcular montos de penalidad si el pedido está pagado
  const penaltyAmount = isPaid ? Math.round(order.total * 0.10 * 100) / 100 : 0;
  const refundAmount = isPaid ? Math.round((order.total - penaltyAmount) * 100) / 100 : 0;

  // Motivos predefinidos de cancelación para el admin
  const predefinedReasons = [
    'Cliente solicitó cancelación',
    'Restaurante sin stock',
    'Restaurante cerrado',
    'Error en el pedido',
    'Error de pago',
    'Driver no disponible',
    'Dirección de entrega inválida',
    'Pedido duplicado',
    'Otro motivo'
  ];

  // Manejar selección de motivo predefinido
  const handleSelectReason = (selected) => {
    if (selected === 'Otro motivo') {
      setCustomReason(true);
      setReason('');
    } else {
      setCustomReason(false);
      setReason(selected);
    }
  };

  // Manejar confirmación
  const handleConfirm = () => {
    onConfirm(reason);
  };

  // Manejar cierre y limpiar estado
  const handleClose = () => {
    setReason('');
    setCustomReason(false);
    onClose();
  };

  return (
    // Fondo oscuro semitransparente
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
      {/* Contenedor del modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">

        {/* Encabezado del modal */}
        <div className={`px-6 py-5 ${isPaid ? 'bg-red-50 border-b border-red-200' : 'bg-yellow-50 border-b border-yellow-200'}`}>
          <div className="flex items-center">
            {/* Icono de admin/escudo */}
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isPaid ? 'bg-red-100' : 'bg-yellow-100'}`}>
              <svg className={`w-6 h-6 ${isPaid ? 'text-red-600' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-bold text-gray-900">
                Cancelar Pedido (Admin)
              </h3>
              <p className="text-sm text-gray-600">
                Pedido #{order._id?.slice(-6)} — Acción administrativa
              </p>
            </div>
          </div>
        </div>

        {/* Cuerpo del modal */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">

          {/* Información del pedido */}
          <div className="bg-gray-50 rounded-lg p-4 mb-5">
            <p className="text-xs font-medium text-gray-500 uppercase mb-3">Detalle del pedido</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Cliente:</span>
                <p className="font-medium text-gray-900">{order.userId?.email || order.userId?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500">Restaurante:</span>
                <p className="font-medium text-gray-900">{order.restaurantId?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500">Total:</span>
                <p className="font-medium text-gray-900">${order.total?.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-gray-500">Estado de pago:</span>
                <p className={`font-medium ${isPaid ? 'text-green-700' : 'text-yellow-700'}`}>
                  {isPaid ? 'Pagado' : 'Pendiente de pago'}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Estado actual:</span>
                <p className="font-medium text-gray-900">{order.status}</p>
              </div>
              <div>
                <span className="text-gray-500">Fecha:</span>
                <p className="font-medium text-gray-900">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            {/* Items */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <span className="text-gray-500 text-xs">Items:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {order.items?.map((item, i) => (
                  <span key={i} className="text-xs bg-white px-2 py-1 rounded border">
                    {item.quantity}x {item.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Mensaje de advertencia según estado de pago */}
          {isPaid ? (
            <div className="space-y-3 mb-5">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium mb-2">
                  Este pedido ya fue pagado. Se aplicará una penalidad del 10%.
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total del pedido:</span>
                    <span className="font-medium">${order.total?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600 font-medium">Penalidad retenida (10%):</span>
                    <span className="text-red-600 font-bold">-${penaltyAmount.toFixed(2)}</span>
                  </div>
                  <hr className="border-red-200" />
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700 font-medium">Reembolso al cliente:</span>
                    <span className="text-green-700 font-bold">${refundAmount.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  El reembolso será procesado en los próximos días hábiles.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5">
              <p className="text-sm text-blue-800">
                Este pedido <span className="font-semibold">no fue pagado</span>. Se cancelará sin penalidad ni reembolso.
              </p>
            </div>
          )}

          {/* Selector de motivo de cancelación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo de cancelación <span className="text-gray-400">(opcional)</span>
            </label>

            {/* Chips con motivos predefinidos */}
            <div className="flex flex-wrap gap-2 mb-3">
              {predefinedReasons.map((predefined) => (
                <button
                  key={predefined}
                  type="button"
                  onClick={() => handleSelectReason(predefined)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    (reason === predefined && !customReason) || (predefined === 'Otro motivo' && customReason)
                      ? 'bg-orange-100 border-orange-400 text-orange-700 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {predefined}
                </button>
              ))}
            </div>

            {/* Campo de texto libre (visible siempre, expandido si se selecciona "Otro motivo") */}
            {customReason && (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Escribí el motivo de la cancelación..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                maxLength={500}
              />
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="px-6 py-4 bg-gray-50 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {/* Botón para no cancelar */}
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            No cancelar
          </button>

          {/* Botón para confirmar cancelación */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center ${
              isPaid
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {isLoading ? (
              <>
                {/* Spinner de carga */}
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cancelando...
              </>
            ) : (
              <>
                {/* Icono de X */}
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {isPaid ? 'Cancelar con penalidad del 10%' : 'Cancelar sin penalidad'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderAdminModal;
