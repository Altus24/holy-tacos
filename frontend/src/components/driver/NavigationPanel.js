import React from 'react';

/**
 * Panel de navegación en pantalla para el driver.
 * Muestra la próxima instrucción, ETA, lista de pasos y accesos rápidos a Google Maps / Waze.
 */
const NavigationPanel = ({
  steps,
  currentStepIndex,
  routeDistanceText,
  routeDurationText,
  onRecalculate,
  onEnd,
  onOpenGoogleMaps,
  onOpenWaze,
  isRecalculating
}) => {
  const safeCurrent = currentStepIndex >= 0 && currentStepIndex < steps.length
    ? steps[currentStepIndex]
    : null;

  return (
    <>
      {/* Barra superior: próxima instrucción + ETA + acciones */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 shadow-md">
        <div className="px-4 py-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Próxima instrucción</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">
              {safeCurrent?.instruction || 'Llegando al destino'}
            </p>
            {safeCurrent && (
              <p className="text-sm text-gray-500 mt-1">
                {safeCurrent.distanceText}
                {safeCurrent.durationText ? ` · ${safeCurrent.durationText}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-gray-600">
              {routeDistanceText} · ~{routeDurationText}
            </span>
            <button
              type="button"
              onClick={onRecalculate}
              disabled={isRecalculating}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
              title="Recalcular ruta"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onEnd}
              className="px-3 py-1.5 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200"
            >
              Finalizar navegación
            </button>
          </div>
        </div>
      </div>

      {/* Panel deslizable de instrucciones (lista de pasos) */}
      <div className="absolute top-[88px] left-2 right-2 bottom-14 z-10 overflow-hidden flex flex-col max-h-[45vh] bg-white/95 backdrop-blur rounded-xl border border-gray-200 shadow-lg">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Instrucciones paso a paso</span>
          <span className="text-xs text-gray-500">
            Paso {Math.min(currentStepIndex + 1, steps.length)} de {steps.length}
          </span>
        </div>
        <div className="overflow-y-auto flex-1 py-2">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`px-4 py-2 flex gap-3 ${i === currentStepIndex ? 'bg-green-50 border-l-4 border-green-500' : 'border-l-4 border-transparent'}`}
            >
              <span className="text-sm font-medium text-gray-400 shrink-0 w-6">{i + 1}</span>
              <div>
                <p className={`text-sm ${i === currentStepIndex ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {step.instruction}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {step.distanceText}
                  {step.durationText ? ` · ${step.durationText}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Abrir en app externa (Google Maps / Waze) */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onOpenGoogleMaps}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200"
        >
          Google Maps
        </button>
        <button
          type="button"
          onClick={onOpenWaze}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-200"
        >
          Waze
        </button>
      </div>
    </>
  );
};

export default NavigationPanel;

