// Botón reutilizable "Volver atrás" para navegación consistente en toda la app.
// Usa to= para redirigir a una ruta fija (ej: /cart, /orders) o navigate(-1) si no se especifica.
import React from 'react';
import { useNavigate } from 'react-router-dom';

const BackButton = ({
  to = null,
  onClick = null,
  label = 'Volver',
  className = '',
  disabled = false,
  title = null,
  variant = 'default' // 'default' | 'ghost' | 'link'
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
      return;
    }
    if (to) {
      navigate(to);
      return;
    }
    // Navegación hacia atrás en el historial; si no hay, el usuario se queda (comportamiento nativo del navegador)
    navigate(-1);
  };

  const baseClasses = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 min-h-[44px] min-w-[44px] touch-manipulation';
  const variantClasses = {
    default: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5',
    ghost: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2',
    link: 'text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline px-0 py-2'
  };
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title || (disabled ? 'No hay página anterior' : label)}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${disabledClasses} ${className}`}
    >
      {/* Icono flecha izquierda (SVG inline, sin dependencia de lucide) */}
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {label && <span>{label}</span>}
    </button>
  );
};

export default BackButton;
