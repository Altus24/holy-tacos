// Componente AddressForm para Holy Tacos
// Maneja la creación y edición de direcciones de entrega
// Usa formato GeoJSON para coordenadas (mismo formato que restaurantes)
// Al seleccionar una dirección en el buscador, rellena automáticamente los campos
import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import LocationPicker from './LocationPicker';

// Función auxiliar: extraer { lat, lng } desde formato GeoJSON del backend
const getCoordinatesFromGeoJSON = (address) => {
  if (address?.location?.coordinates?.length === 2) {
    const [lng, lat] = address.location.coordinates;
    if (lng !== 0 || lat !== 0) {
      return { lat, lng };
    }
  }
  return null;
};

const AddressForm = ({
  address = {},
  onSubmit,
  onCancel,
  isDefault = false,
  canSetDefault = true,
  submitLabel = "Guardar Dirección"
}) => {
  // Inicializar coordenadas desde formato GeoJSON si existe
  const [coordinates, setCoordinates] = useState(
    getCoordinatesFromGeoJSON(address)
  );
  // Dirección en texto para el LocationPicker
  const [addressText, setAddressText] = useState(
    address?.street && address?.number
      ? `${address.street} ${address.number}`
      : ''
  );
  // Indicador de que se autorellenaron los campos
  const [autoFilled, setAutoFilled] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    defaultValues: {
      street: address?.street || '',
      number: address?.number || '',
      floor: address?.floor || '',
      apartment: address?.apartment || '',
      notes: address?.notes || '',
      label: address?.label || 'Casa',
      isDefault: isDefault
    }
  });

  const handleFormSubmit = (data) => {
    // Construir la dirección con formato GeoJSON para las coordenadas
    const addressData = {
      street: data.street,
      number: data.number,
      floor: data.floor,
      apartment: data.apartment,
      notes: data.notes,
      label: data.label
    };

    // Agregar coordenadas en formato GeoJSON [lng, lat] (mismo formato que restaurantes)
    if (coordinates) {
      addressData.location = {
        type: 'Point',
        coordinates: [coordinates.lng, coordinates.lat]
      };
    }

    // Siempre enviar el estado del checkbox explícitamente (true o false)
    addressData.isDefault = !!data.isDefault;

    onSubmit(addressData);
  };

  // Callback del LocationPicker cuando cambia la ubicación completa
  const handleLocationChange = useCallback(({ address: addr, lat, lng }) => {
    setCoordinates({ lat, lng });
    setAddressText(addr);
  }, []);

  // Callback del LocationPicker cuando solo cambia el texto
  const handleAddressTextChange = useCallback((addr) => {
    setAddressText(addr);
  }, []);

  // Callback del LocationPicker cuando se selecciona un lugar de Google Places
  // o se hace reverse geocoding al mover el marcador
  // Rellena automáticamente los campos del formulario
  const handlePlaceSelect = useCallback((components) => {
    if (!components) return;

    // Rellenar calle
    if (components.street) {
      setValue('street', components.street, { shouldValidate: true });
    }

    // Rellenar número
    if (components.number) {
      setValue('number', components.number, { shouldValidate: true });
    }

    // Mostrar indicador de autorelleno
    setAutoFilled(true);
    // Ocultar el indicador después de 3 segundos
    setTimeout(() => setAutoFilled(false), 3000);
  }, [setValue]);

  // Valores actuales del formulario para mostrar en resumen
  const currentStreet = watch('street');
  const currentNumber = watch('number');

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">

      {/* ===== PASO 1: Buscar ubicación en el mapa ===== */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">1</span>
          <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            Buscá la dirección en el mapa
          </h4>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
          Escribí la dirección y seleccioná una sugerencia. Los campos de abajo se completarán automáticamente.
        </p>
        <LocationPicker
          address={addressText}
          coordinates={coordinates}
          onAddressChange={handleAddressTextChange}
          onLocationChange={handleLocationChange}
          onPlaceSelect={handlePlaceSelect}
          placeholder="Escribí la dirección, ej: San Martín 123, Mendoza..."
          mapHeight={320}
          showCoordinates={true}
          required={false}
        />
      </div>

      {/* Indicador de autorelleno */}
      {autoFilled && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Campos rellenados automáticamente. Revisá y ajustá si es necesario.
        </div>
      )}

      {/* ===== PASO 2: Detalles de la dirección ===== */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-gray-600 text-white text-xs font-bold px-2 py-1 rounded-full">2</span>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-300">
            Detalles de la dirección
          </h4>
        </div>

        <div className="space-y-4">
          {/* Etiqueta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Etiqueta
            </label>
            <select
              {...register('label', { required: 'Selecciona una etiqueta' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="Casa">Casa</option>
              <option value="Trabajo">Trabajo</option>
              <option value="Otro">Otro</option>
            </select>
            {errors.label && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.label.message}</p>
            )}
          </div>

          {/* Calle y Número */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Calle <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('street', { required: 'La calle es obligatoria' })}
                placeholder="Ej: Avenida San Martín"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white transition-colors ${
                  currentStreet && autoFilled
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.street && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.street.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Número <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('number', { required: 'El número es obligatorio' })}
                placeholder="Ej: 123"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white transition-colors ${
                  currentNumber && autoFilled
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.number && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.number.message}</p>
              )}
            </div>
          </div>

          {/* Piso y Departamento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Piso
              </label>
              <input
                type="text"
                {...register('floor')}
                placeholder="Ej: 5"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Departamento
              </label>
              <input
                type="text"
                {...register('apartment')}
                placeholder="Ej: B"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Notas adicionales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas adicionales
            </label>
            <textarea
              {...register('notes')}
              placeholder="Ej: Timbre roto, tocar puerta, portón verde"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Opción para marcar como predeterminada */}
      {canSetDefault && (
        <div className="flex items-center pt-1">
          <input
            type="checkbox"
            id="isDefault"
            {...register('isDefault')}
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
          />
          <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Establecer como dirección predeterminada
          </label>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

export default AddressForm;
