/**
 * Spinner de carga reutilizable para estados de loading consistentes.
 */
import React from 'react';

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-10 w-10 border-b-2',
    lg: 'h-12 w-12 border-b-4'
  };
  return (
    <div
      className={`animate-spin rounded-full border-orange-600 ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
};

export default LoadingSpinner;
