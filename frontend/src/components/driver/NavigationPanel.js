import React, { useRef, useEffect } from 'react';

/**
 * Mapa de instrucciones de manejo a íconos simples (flecha según texto).
 * Permite mostrar una flecha visual antes de cada instrucción.
 */
function getStepIcon(instruction = '') {
  const t = instruction.toLowerCase();
  if (t.includes('derecha') || t.includes('right')) return '↱';
  if (t.includes('izquierda') || t.includes('left')) return '↰';
  if (t.includes('gire') || t.includes('turn') || t.includes('vuelta') || t.includes('u-turn')) return '↩';
  if (t.includes('recto') || t.includes('continúe') || t.includes('siga') || t.includes('straight') || t.includes('continue')) return '↑';
  if (t.includes('destino') || t.includes('llegó') || t.includes('arrive') || t.includes('destination')) return '🏁';
  if (t.includes('rotonda') || t.includes('roundabout')) return '↻';
  return '↑';
}

/**
 * NavigationPanel — Panel de instrucciones paso a paso.
 *
 * En móvil (< md): bottom-sheet deslizable desde la parte inferior.
 * En desktop (≥ md): panel lateral derecho.
 *
 * Props:
 * - steps: Array<{ instruction, distanceText, durationText }>
 * - currentStepIndex: number
 * - routeDistanceText: string
 * - routeDurationText: string
 * - onRecalculate: function
 * - onEnd: function
 * - onOpenGoogleMaps: function
 * - onOpenWaze: function
 * - isRecalculating: boolean
 * - isFullScreen: boolean  — ajusta el offset superior para evitar el header
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
  isRecalculating,
  isFullScreen = false
}) => {
  const listRef = useRef(null);
  const activeItemRef = useRef(null);

  // Desplazar la lista automáticamente al paso activo cuando cambia
  useEffect(() => {
    if (activeItemRef.current && listRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStepIndex]);

  const safeCurrent = currentStepIndex >= 0 && currentStepIndex < steps.length
    ? steps[currentStepIndex]
    : null;

  const nextStep = currentStepIndex + 1 < steps.length ? steps[currentStepIndex + 1] : null;

  // Offset superior para no solapar con el header en pantalla completa
  const topOffset = isFullScreen ? 'top-14' : 'top-0';

  return (
    <>
      {/* ────────────────────────────────────────────────────────────────────
          Barra superior fija: próxima instrucción + ETA total + acciones
      ──────────────────────────────────────────────────────────────────── */}
      <div className={`absolute left-0 right-0 z-20 bg-blue-700 shadow-lg ${topOffset}`}>
        <div className="px-4 py-3">
          {/* Fila principal: ícono + instrucción + botón salir */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Ícono de dirección */}
              <span className="text-3xl shrink-0 font-bold text-white" aria-hidden="true">
                {safeCurrent ? getStepIcon(safeCurrent.instruction) : '🏁'}
              </span>
              <div className="min-w-0">
                <p className="text-white font-semibold text-base leading-tight truncate">
                  {safeCurrent?.instruction || 'Llegando al destino'}
                </p>
                {safeCurrent?.distanceText && (
                  <p className="text-blue-200 text-sm mt-0.5">
                    en {safeCurrent.distanceText}
                    {safeCurrent.durationText ? ` · ${safeCurrent.durationText}` : ''}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onEnd}
              className="shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Salir
            </button>
          </div>

          {/* Fila secundaria: ETA total + próximo paso + botón recalcular */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-blue-600">
            <div className="flex items-center gap-3 text-sm text-blue-100 min-w-0">
              {/* ETA total */}
              <span className="flex items-center gap-1 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ~{routeDurationText}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {routeDistanceText}
              </span>
              {/* Próxima maniobra (siguiente paso) */}
              {nextStep && (
                <span className="truncate hidden sm:block text-blue-200">
                  Luego: {getStepIcon(nextStep.instruction)} {nextStep.instruction}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onRecalculate}
              disabled={isRecalculating}
              className="shrink-0 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              title="Recalcular ruta"
            >
              <svg className={`w-4 h-4 text-white ${isRecalculating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          Panel de pasos:
          - Móvil: bottom-sheet deslizable (bottom-0, altura limitada)
          - Desktop: no se muestra (los pasos son innecesarios con la barra superior)
          El panel solo aparece en pantallas pequeñas para no tapar el mapa en desktop.
      ──────────────────────────────────────────────────────────────────── */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[35vh] flex flex-col">
        {/* Pastilla de arrastre (visual) */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Título + contador de pasos */}
        <div className="px-4 pb-2 flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-gray-700">Instrucciones</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {Math.min(currentStepIndex + 1, steps.length)} / {steps.length}
          </span>
        </div>

        {/* Lista de pasos con scroll */}
        <div ref={listRef} className="overflow-y-auto flex-1 px-3 pb-2">
          {steps.map((step, i) => {
            const isActive = i === currentStepIndex;
            const isPast = i < currentStepIndex;
            return (
              <div
                key={i}
                ref={isActive ? activeItemRef : null}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl mb-1 transition-colors
                  ${isActive ? 'bg-blue-50 border border-blue-200' : isPast ? 'opacity-40' : ''}`}
              >
                {/* Ícono de dirección */}
                <span className={`text-xl shrink-0 mt-0.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {getStepIcon(step.instruction)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-tight ${isActive ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                    {step.instruction}
                  </p>
                  {step.distanceText && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {step.distanceText}{step.durationText ? ` · ${step.durationText}` : ''}
                    </p>
                  )}
                </div>
                {isActive && (
                  <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Botones para abrir en apps externas */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onOpenGoogleMaps}
            className="flex-1 py-2 text-sm font-semibold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 border border-blue-100"
          >
            Google Maps
          </button>
          <button
            type="button"
            onClick={onOpenWaze}
            className="flex-1 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
          >
            Waze
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          Desktop: panel lateral derecho con lista de pasos
      ──────────────────────────────────────────────────────────────────── */}
      <div className={`hidden md:flex flex-col absolute right-3 z-10 w-72 bg-white/97 backdrop-blur rounded-2xl shadow-xl border border-gray-200 max-h-[55vh] ${isFullScreen ? 'top-36' : 'top-32'}`}>
        <div className="px-4 pt-3 pb-2 border-b border-gray-100 shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Instrucciones</span>
          <span className="text-xs text-gray-400">{Math.min(currentStepIndex + 1, steps.length)} / {steps.length}</span>
        </div>
        <div ref={listRef} className="overflow-y-auto flex-1 py-2 px-2">
          {steps.map((step, i) => {
            const isActive = i === currentStepIndex;
            const isPast = i < currentStepIndex;
            return (
              <div
                key={i}
                ref={isActive ? activeItemRef : null}
                className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl mb-1 transition-colors
                  ${isActive ? 'bg-blue-50 border border-blue-200' : isPast ? 'opacity-35' : ''}`}
              >
                <span className={`text-lg shrink-0 mt-0.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {getStepIcon(step.instruction)}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs leading-snug ${isActive ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                    {step.instruction}
                  </p>
                  {step.distanceText && (
                    <p className="text-xs text-gray-400 mt-0.5">{step.distanceText}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 px-3 py-2.5 border-t border-gray-100 shrink-0">
          <button onClick={onOpenGoogleMaps} type="button"
            className="flex-1 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
            Google Maps
          </button>
          <button onClick={onOpenWaze} type="button"
            className="flex-1 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            Waze
          </button>
        </div>
      </div>
    </>
  );
};

export default NavigationPanel;
