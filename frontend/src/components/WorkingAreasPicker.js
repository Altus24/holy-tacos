// Zonas de trabajo validadas con Google Places (solo regiones/ciudades)
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const LIBRARIES = ['places'];

const WorkingAreasPicker = ({ value = [], onChange, placeholder = 'Buscar ciudad o zona...', disabled }) => {
  const [inputValue, setInputValue] = useState('');
  const autocompleteRef = useRef(null);
  const list = Array.isArray(value) ? value : [];

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  });

  useEffect(() => {
    if (!Array.isArray(value)) return;
    setInputValue('');
  }, [value]);

  const handlePlaceSelect = useCallback(() => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    const name = place?.formatted_address || place?.name || '';
    if (!name.trim()) return;
    const next = list.includes(name) ? list : [...list, name];
    onChange(next);
    setInputValue('');
  }, [list, onChange]);

  const removeZone = (index) => {
    const next = list.filter((_, i) => i !== index);
    onChange(next);
  };

  if (loadError) {
    return (
      <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
        No se pudo cargar Google Maps. Revisá REACT_APP_GOOGLE_MAPS_API_KEY para validar zonas.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="text-gray-500 text-sm">Cargando búsqueda de zonas...</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {list.map((zone, index) => (
          <span
            key={`${zone}-${index}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
          >
            {zone}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeZone(index)}
                className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                aria-label="Quitar zona"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div>
          <Autocomplete
            onLoad={(ref) => { autocompleteRef.current = ref; }}
            onPlaceChanged={handlePlaceSelect}
            options={{
              types: ['(regions)'],
              componentRestrictions: { country: 'ar' }
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
          </Autocomplete>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Buscá y seleccioná ciudades o zonas desde Google Maps. Solo se agregan zonas validadas.
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkingAreasPicker;
