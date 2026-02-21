// Modal de confirmación para cancelar un pedido
// Muestra información diferente según si el pedido fue pagado o no
import React, { useState } from 'react';

const CancelOrderModal = ({
  isOpen,
  onClose,
  onConfirm,
  order,
  isLoading = false
}) => {
  // Estado para el motivo de cancelación (opcional)
  const [reason, setReason] = useState('');

  // Si el modal no está abierto, no renderizar nada
  if (!isOpen || !order) return null;

  // Determinar si el pedido fue pagado
  const isPaid = order.paymentStatus === 'paid';

  // Calcular montos de penalidad si el pedido está pagado
  const penaltyAmount = isPaid ? Math.round(order.total * 0.10 * 100) / 100 : 0;
  const refundAmount = isPaid ? Math.round((order.total - penaltyAmount) * 100) / 100 : 0;

  // Motivos predefinidos de cancelación
  const predefinedReasons = [
    'Cambié de opinión',
    'Pedí por error',
    'Encontré mejor opción',
    'Tiempo de espera muy largo',
    'Otro motivo'
  ];

  // Manejar confirmación de cancelación
  const handleConfirm = () => {
    onConfirm(reason);
  };

  // Manejar cierre del modal y limpiar estado
  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    // Fondo oscuro semitransparente
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
      {/* Contenedor del modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        {/* Encabezado del modal con icono de advertencia */}
        <div className={`px-6 py-5 ${isPaid ? 'bg-red-50' : 'bg-yellow-50'}`}>
          <div className="flex items-center">
            {/* Icono circular de advertencia */}
            <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isPaid ? 'bg-red-100' : 'bg-yellow-100'}`}>
              <svg className={`w-6 h-6 ${isPaid ? 'text-red-600' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-bold text-gray-900">
                Cancelar Pedido
              </h3>
              <p className="text-sm text-gray-600">
                Pedido #{order._id?.slice(-6)}
              </p>
            </div>
          </div>
        </div>

        {/* Cuerpo del modal */}
        <div className="px-6 py-5">
          {/* Mensaje principal según estado de pago */}
          {isPaid ? (
            <div className="space-y-3">
              <p className="text-gray-700">
                Este pedido ya fue <span className="font-semibold text-green-700">pagado</span>. Si lo cancelás, se aplicará una <span className="font-semibold text-red-600">penalidad del 10%</span>.
              </p>

              {/* Desglose de montos */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total del pedido:</span>
                  <span className="font-medium">${order.total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600 font-medium">Penalidad (10%):</span>
                  <span className="text-red-600 font-bold">-${penaltyAmount.toFixed(2)}</span>
                </div>
                <hr className="border-red-200" />
                <div className="flex justify-between text-sm">
                  <span className="text-green-700 font-medium">Reembolso estimado:</span>
                  <span className="text-green-700 font-bold">${refundAmount.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                El reembolso será procesado en los próximos días hábiles.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-700">
                ¿Estás seguro de que querés cancelar este pedido? <span className="font-semibold text-green-700">No se aplicará ninguna penalidad</span> ya que aún no fue pagado.
              </p>
            </div>
          )}

          {/* Selector de motivo de cancelación */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo de cancelación <span className="text-gray-400">(opcional)</span>
            </label>

            {/* Chips con motivos predefinidos */}
            <div className="flex flex-wrap gap-2 mb-3">
              {predefinedReasons.map((predefined) => (
                <button
                  key={predefined}
                  type="button"
                  onClick={() => setReason(predefined)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    reason === predefined
                      ? 'bg-orange-100 border-orange-400 text-orange-700 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {predefined}
                </button>
              ))}
            </div>

            {/* Campo de texto libre para motivo personalizado */}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contanos el motivo de la cancelación..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
              maxLength={500}
            />
          </div>

          {/* Resumen del pedido */}
          <div className="mt-4 bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Resumen del pedido</p>
            <div className="space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{order.restaurantId?.name || 'Restaurante'}</span>
              </p>
              <p className="text-sm text-gray-600">
                {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''} • Total: ${order.total?.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">
                Estado de pago: {isPaid ? '✅ Pagado' : '⏳ Pendiente de pago'}
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="px-6 py-4 bg-gray-50 border-t flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {/* Botón para mantener el pedido */}
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            No, mantener pedido
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
                {isPaid ? 'Sí, cancelar con penalidad' : 'Sí, cancelar pedido'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;
