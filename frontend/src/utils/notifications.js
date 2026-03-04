// Utilidades de notificación (sonido, etc.)
// Todas las funciones aquí deben ser seguras en navegadores que no soporten AudioContext.

/**
 * Reproduce un beep corto para notificaciones importantes.
 * Usa Web Audio API para evitar cargar archivos de audio adicionales.
 */
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 880; // tono agudo, fácil de escuchar

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    oscillator.start(now);
    oscillator.stop(now + 0.45);
  } catch (err) {
    // Si el navegador bloquea audio automático o no soporta la API, ignorar silenciosamente
    // console.warn('No se pudo reproducir sonido de notificación:', err);
  }
}

