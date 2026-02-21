// Selector de dirección para checkout: direcciones guardadas o buscar/seleccionar en mapa (sin ingreso manual)
import React, { useState, useCallback, useEffect } from 'react';
import LocationPicker from './LocationPicker';

export function formatAddressLine(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  const parts = [addr.street, addr.number].filter(Boolean).join(' ');
  const extra = [addr.floor && `Piso ${addr.floor}`, addr.apartment && `Depto ${addr.apartment}`].filter(Boolean).join(', ');
  const base = [parts, extra].filter(Boolean).join(', ');
  return addr.notes ? `${base} (${addr.notes})` : base;
}

export function getLatLngFromAddress(addr) {
  if (!addr) return { lat: null, lng: null };
  if (typeof addr === 'string') return { lat: null, lng: null };
  if (!addr.location?.coordinates || addr.location.coordinates.length < 2) return { lat: null, lng: null };
  const [lng, lat] = addr.location.coordinates;
  return { lat, lng };
}

// Construir objeto de dirección para guardar en perfil (User.clientProfile)
function buildAddressForProfile(addressText, lat, lng, parsed) {
  const coords = lat != null && lng != null ? [lng, lat] : [0, 0];
  if (parsed && (parsed.street || parsed.number)) {
    return {
      street: parsed.street || '',
      number: parsed.number || '',
      floor: '',
      apartment: '',
      notes: '',
      label: 'Nueva',
      location: { type: 'Point', coordinates: coords }
    };
  }
  return {
    street: addressText?.slice(0, 200) || '',
    number: '',
    floor: '',
    apartment: '',
    notes: '',
    label: 'Nueva',
    location: { type: 'Point', coordinates: coords }
  };
}

const AddressSelector = ({
  profile,
  selectedAddress,
  onSelectAddress,
  deliveryAddressText,
  onDeliveryAddressChange,
  deliveryLat,
  deliveryLng,
  onDeliveryCoordsChange,
  notes,
  onNotesChange,
  onSaveNewAddressToProfile,
  onUseNewAddress,
  onPendingAddressChange,
  disabled = false
}) => {
  const [showMapSearch, setShowMapSearch] = useState(false);
  const [pendingNewAddress, setPendingNewAddress] = useState(null);
  const [triggerUseMyLocation, setTriggerUseMyLocation] = useState(0);

  // Avisar al padre si hay una dirección nueva sin confirmar (obligatorio responder si guardar o no antes de pagar)
  useEffect(() => {
    onPendingAddressChange?.(!!pendingNewAddress?.address);
  }, [pendingNewAddress, onPendingAddressChange]);
  const defaultAddr = profile?.clientProfile?.defaultAddress;
  const savedList = profile?.clientProfile?.savedAddresses || [];
  const hasDefault = defaultAddr && (defaultAddr.street || defaultAddr.number);
  const addresses = hasDefault
    ? [{ ...defaultAddr, label: defaultAddr.label || 'Casa', _isDefault: true }, ...savedList]
    : savedList;

  const handleLocationChange = useCallback(({ address, lat, lng }) => {
    setPendingNewAddress({ address, lat, lng, parsed: null });
  }, []);

  const handlePlaceSelect = useCallback((parsed) => {
    setPendingNewAddress(prev => prev ? { ...prev, parsed } : null);
  }, []);

  const applyNewAddress = useCallback((saveToProfile) => {
    if (!pendingNewAddress) return;
    const { address, lat, lng, parsed } = pendingNewAddress;
    onUseNewAddress?.();
    onDeliveryAddressChange(address);
    onDeliveryCoordsChange(lat, lng);
    if (saveToProfile && onSaveNewAddressToProfile) {
      const addrForProfile = buildAddressForProfile(address, lat, lng, parsed);
      onSaveNewAddressToProfile(addrForProfile);
    }
    setPendingNewAddress(null);
    setShowMapSearch(false);
  }, [pendingNewAddress, onDeliveryAddressChange, onDeliveryCoordsChange, onSaveNewAddressToProfile, onUseNewAddress]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {addresses.length > 0
          ? 'Elegí una dirección guardada o buscá una nueva en el mapa.'
          : 'Buscá tu dirección o seleccioná la ubicación en el mapa.'}
      </p>

      {addresses.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dirección guardada
          </label>
          <select
            value={selectedAddress && !pendingNewAddress ? formatAddressLine(selectedAddress) : ''}
            onChange={(e) => {
              const line = e.target.value;
              if (!line) return;
              const addr = addresses.find(a => formatAddressLine(a) === line);
              if (addr) {
                onSelectAddress(addr);
                onDeliveryAddressChange(formatAddressLine(addr));
                const { lat, lng } = getLatLngFromAddress(addr);
                onDeliveryCoordsChange(lat, lng);
                setPendingNewAddress(null);
                setShowMapSearch(false);
              }
            }}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="">-- Seleccionar dirección guardada --</option>
            {addresses.map((addr, i) => (
              <option key={i} value={formatAddressLine(addr)}>
                {addr._isDefault ? '🏠 Predeterminada: ' : ''}{addr.label || 'Casa'} — {formatAddressLine(addr)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Botón para buscar/seleccionar dirección en mapa */}
      <div>
        <button
          type="button"
          onClick={() => setShowMapSearch(prev => !prev)}
          disabled={disabled}
          className="w-full py-3 px-4 border-2 border-dashed border-orange-300 rounded-lg text-orange-700 font-medium hover:bg-orange-50 transition-colors disabled:opacity-50"
        >
          {showMapSearch ? 'Ocultar mapa' : '📍 Buscar dirección o elegir en el mapa'}
        </button>
      </div>

      {showMapSearch && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
          <button
            type="button"
            onClick={() => setTriggerUseMyLocation(Date.now())}
            className="w-full py-3 px-4 bg-orange-100 border border-orange-300 rounded-lg text-orange-800 font-medium hover:bg-orange-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Consultar mi ubicación actual
          </button>
          <LocationPicker
            address={pendingNewAddress?.address || ''}
            coordinates={pendingNewAddress ? { lat: pendingNewAddress.lat, lng: pendingNewAddress.lng } : null}
            onAddressChange={(addr) => setPendingNewAddress(prev => prev ? { ...prev, address: addr } : null)}
            onLocationChange={handleLocationChange}
            onPlaceSelect={handlePlaceSelect}
            placeholder="Escribí la dirección para buscar..."
            mapHeight={320}
            showCoordinates={false}
            required={false}
            triggerUseMyLocation={triggerUseMyLocation}
          />
        </div>
      )}

      {/* Confirmación de nueva dirección y preguntar si guardar en perfil */}
      {pendingNewAddress?.address && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <p className="font-medium text-green-900 mb-1">Dirección seleccionada:</p>
          <p className="text-green-800 text-sm mb-3">{pendingNewAddress.address}</p>
          <p className="text-sm font-medium text-gray-700 mb-2">¿Guardar esta dirección en tu perfil?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyNewAddress(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm"
            >
              Sí, guardar en mi perfil
            </button>
            <button
              type="button"
              onClick={() => applyNewAddress(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm"
            >
              No, solo usar para este pedido
            </button>
          </div>
        </div>
      )}

      {/* Resumen de dirección que se usará (solo lectura) */}
      {deliveryAddressText && !pendingNewAddress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-900">Entrega a:</p>
          <p className="text-blue-800">{deliveryAddressText}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas adicionales para la entrega
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
          placeholder="Ej: timbre roto, entregar en recepción..."
        />
      </div>
    </div>
  );
};

export default AddressSelector;
