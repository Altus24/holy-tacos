// Barra de progreso según qué tan completo está el perfil (cliente o conductor)
// Si está al 100% no se muestra la barra. Si no, se listan los datos que faltan.
import React from 'react';

/**
 * Calcula el porcentaje de completitud del perfil de un cliente (0-100).
 * Criterios: nombre, teléfono, dirección (calle + número), ubicación en mapa, foto de perfil.
 */
export const getClientProfileProgress = (profile) => {
  if (!profile || profile.role !== 'client') return 0;
  let completed = 0;
  const total = 5;
  if (profile.name?.trim()) completed += 1;
  if (profile.phone?.trim()) completed += 1;
  const def = profile.clientProfile?.defaultAddress;
  if (def?.street?.trim() && def?.number?.trim()) completed += 1;
  const coords = def?.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2 && (Number(coords[0]) !== 0 || Number(coords[1]) !== 0)) {
    completed += 1;
  }
  if (profile.profilePicture) completed += 1;
  return Math.round((completed / total) * 100);
};

/** Lista de datos que faltan para completar el perfil del cliente. */
export const getClientMissingItems = (profile) => {
  if (!profile || profile.role !== 'client') return [];
  const missing = [];
  if (!profile.name?.trim()) missing.push('Nombre');
  if (!profile.phone?.trim()) missing.push('Teléfono');
  const def = profile.clientProfile?.defaultAddress;
  if (!def?.street?.trim() || !def?.number?.trim()) missing.push('Dirección (calle y número)');
  const coords = def?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2 || (Number(coords[0]) === 0 && Number(coords[1]) === 0)) {
    missing.push('Ubicación en el mapa de la dirección');
  }
  if (!profile.profilePicture) missing.push('Foto de perfil');
  return missing;
};

/**
 * Calcula el porcentaje de completitud del perfil de un conductor (0-100).
 * Criterios: nombre, teléfono, vehículo (tipo + placa), licencia (número + vencimiento), 3 documentos.
 */
export const getDriverProfileProgress = (profile) => {
  if (!profile || profile.role !== 'driver') return 0;
  let completed = 0;
  const total = 5;
  if (profile.name?.trim()) completed += 1;
  if (profile.phone?.trim()) completed += 1;
  const v = profile.driverProfile?.vehicle;
  if (v?.type && v?.plate?.trim()) completed += 1;
  if (profile.driverProfile?.licenseNumber?.trim() && profile.driverProfile?.licenseExpiration) completed += 1;
  const docs = profile.driverProfile?.documents;
  if (docs?.licenseFront && docs?.licenseBack && docs?.profileVerification) completed += 1;
  return Math.round((completed / total) * 100);
};

/** Lista de datos que faltan para completar el perfil del conductor. */
export const getDriverMissingItems = (profile) => {
  if (!profile || profile.role !== 'driver') return [];
  const missing = [];
  if (!profile.name?.trim()) missing.push('Nombre');
  if (!profile.phone?.trim()) missing.push('Teléfono');
  const v = profile.driverProfile?.vehicle;
  if (!v?.type || !v?.plate?.trim()) missing.push('Vehículo (tipo y placa)');
  if (!profile.driverProfile?.licenseNumber?.trim() || !profile.driverProfile?.licenseExpiration) {
    missing.push('Licencia (número y fecha de vencimiento)');
  }
  const docs = profile.driverProfile?.documents;
  if (!docs?.licenseFront || !docs?.licenseBack || !docs?.profileVerification) {
    missing.push('Documentos (licencia frente, reverso y foto de verificación)');
  }
  return missing;
};

/**
 * Devuelve el porcentaje según el rol del perfil.
 */
export const getProfileProgress = (profile) => {
  if (!profile) return 0;
  if (profile.role === 'client') return getClientProfileProgress(profile);
  if (profile.role === 'driver') return getDriverProfileProgress(profile);
  return 100; // admin u otro: se considera completo
};

/** Devuelve los ítems faltantes según el rol. */
export const getProfileMissingItems = (profile) => {
  if (!profile) return [];
  if (profile.role === 'client') return getClientMissingItems(profile);
  if (profile.role === 'driver') return getDriverMissingItems(profile);
  return [];
};

const ProfileProgressBar = ({ profile, className = '' }) => {
  if (!profile || (profile.role !== 'client' && profile.role !== 'driver')) return null;

  const percent = getProfileProgress(profile);

  // Ocultar la barra si el perfil está completo al 100%
  if (percent >= 100) return null;

  const missingItems = getProfileMissingItems(profile);
  const label =
    profile.role === 'client'
      ? 'Completitud del perfil (nombre, teléfono, dirección con mapa, foto)'
      : 'Completitud del perfil (nombre, teléfono, vehículo, licencia, documentos)';

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Tu perfil está al <strong>{percent}%</strong> completo
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Completá los datos para activar todo
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out bg-orange-500"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
      {missingItems.length > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Te falta:</span>{' '}
          {missingItems.join(', ')}
        </p>
      )}
    </div>
  );
};

export default ProfileProgressBar;
