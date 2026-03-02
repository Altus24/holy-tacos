// Componente ClientProfileForm para Holy Tacos
// Maneja el formulario de perfil para clientes
// La dirección predeterminada se identifica por índice en el array de savedAddresses
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import AddressForm from '../AddressForm';
import ProfilePhotoField from './ProfilePhotoField';

// Función para encontrar el índice de la dirección predeterminada actual
// comparando todos los campos relevantes
const findDefaultIndex = (addresses, defaultAddr) => {
  if (!defaultAddr || !addresses?.length) return -1;
  return addresses.findIndex(addr =>
    addr.street === defaultAddr.street &&
    addr.number === defaultAddr.number &&
    addr.label === defaultAddr.label
  );
};

const ClientProfileForm = ({
  user,
  onSave,
  onSaveSection,
  onCancel,
  onPictureUpdate
}) => {
  const [addresses, setAddresses] = useState(user?.clientProfile?.savedAddresses || []);
  const [savingSection, setSavingSection] = useState(null);
  // Índice de la dirección predeterminada dentro de savedAddresses (-1 = ninguna)
  const [defaultIndex, setDefaultIndex] = useState(() => {
    const saved = user?.clientProfile?.savedAddresses || [];
    const def = user?.clientProfile?.defaultAddress;
    return findDefaultIndex(saved, def);
  });
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null); // { ...address, index }
  const [minimalError, setMinimalError] = useState(null); // Mensaje si intentan guardar sin datos mínimos

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      dietaryPreferences: user?.clientProfile?.dietaryPreferences?.join(', ') || ''
    }
  });

  // Derivar la dirección predeterminada desde el array + índice
  const defaultAddress = defaultIndex >= 0 && defaultIndex < addresses.length
    ? addresses[defaultIndex]
    : null;

  // Validación mínima: nombre, teléfono y dirección con calle, número y ubicación en mapa (lat/lng) para poder hacer pedidos
  const hasValidCoords = (addr) => {
    const coords = addr?.location?.coordinates;
    return Array.isArray(coords) && coords.length >= 2 && (Number(coords[0]) !== 0 || Number(coords[1]) !== 0);
  };
  const isMinimalComplete = (data, defAddr) => {
    const hasName = data.name?.trim();
    const hasPhone = data.phone?.trim();
    const hasAddress = defAddr && defAddr.street?.trim() && defAddr.number?.trim();
    const hasLocation = hasValidCoords(defAddr);
    return hasName && hasPhone && hasAddress && hasLocation;
  };

  const handleFormSubmit = (data) => {
    setMinimalError(null);
    if (!isMinimalComplete(data, defaultAddress)) {
      setMinimalError('Completá nombre, teléfono y una dirección de entrega (calle, número y ubicación en el mapa) para poder hacer pedidos.');
      return;
    }
    const profileData = {
      name: data.name?.trim(),
      phone: data.phone?.trim(),
      clientProfile: {
        defaultAddress: defaultAddress || null,
        savedAddresses: addresses,
        dietaryPreferences: data.dietaryPreferences
          ? data.dietaryPreferences.split(',').map(pref => pref.trim().toLowerCase()).filter(Boolean)
          : []
      }
    };
    onSave(profileData);
  };

  const saveSection = (sectionKey, data) => {
    if (!onSaveSection) {
      onSave(data);
      return;
    }
    setSavingSection(sectionKey);
    onSaveSection(data).finally(() => setSavingSection(null));
  };

  const handleSavePersonal = (data) => {
    saveSection('personal', {
      name: data.name,
      email: data.email ? data.email.trim().toLowerCase() : user?.email,
      phone: data.phone,
      clientProfile: user?.clientProfile || {}
    });
  };

  const handleSaveDietary = (data) => {
    const prefs = data.dietaryPreferences
      ? data.dietaryPreferences.split(',').map(pref => pref.trim().toLowerCase()).filter(Boolean)
      : [];
    saveSection('dietary', {
      name: user?.name,
      phone: user?.phone,
      clientProfile: {
        ...user?.clientProfile,
        defaultAddress: defaultAddress || user?.clientProfile?.defaultAddress,
        savedAddresses: addresses,
        dietaryPreferences: prefs
      }
    });
  };

  const handleSaveAddresses = () => {
    saveSection('addresses', {
      name: user?.name,
      phone: user?.phone,
      clientProfile: {
        ...user?.clientProfile,
        defaultAddress: defaultAddress || null,
        savedAddresses: addresses,
        dietaryPreferences: user?.clientProfile?.dietaryPreferences || []
      }
    });
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setShowAddressForm(true);
  };

  const handleEditAddress = (address, index) => {
    setEditingAddress({ ...address, index });
    setShowAddressForm(true);
  };

  const handleDeleteAddress = (index) => {
    const addr = addresses[index];
    const confirmMsg = `¿Eliminar la dirección "${addr.label} - ${addr.street} ${addr.number}"?`;
    if (window.confirm(confirmMsg)) {
      const newAddresses = addresses.filter((_, i) => i !== index);
      setAddresses(newAddresses);

      // Ajustar el índice predeterminado
      if (defaultIndex === index) {
        // Se eliminó la predeterminada → limpiar
        setDefaultIndex(-1);
      } else if (defaultIndex > index) {
        // Se eliminó una anterior → ajustar índice
        setDefaultIndex(defaultIndex - 1);
      }
    }
  };

  const handleAddressSubmit = (addressData) => {
    // Remover el flag isDefault del objeto antes de guardar (no se guarda en la dirección)
    const { isDefault, ...cleanAddress } = addressData;

    if (editingAddress !== null && editingAddress.index !== undefined) {
      // Editando dirección existente
      const idx = editingAddress.index;
      const newAddresses = [...addresses];
      newAddresses[idx] = cleanAddress;
      setAddresses(newAddresses);

      if (isDefault) {
        // Marcar esta como predeterminada
        setDefaultIndex(idx);
      } else if (defaultIndex === idx) {
        // Se desmarcó la predeterminada → limpiar
        setDefaultIndex(-1);
      }
    } else {
      // Agregando nueva dirección
      const newAddresses = [...addresses, cleanAddress];
      setAddresses(newAddresses);

      if (isDefault) {
        // La nueva dirección es la última del array
        setDefaultIndex(newAddresses.length - 1);
      }
    }

    setShowAddressForm(false);
    setEditingAddress(null);
  };

  const handleSetDefaultAddress = (index) => {
    setDefaultIndex(index);
  };

  const handleClearDefault = () => {
    setDefaultIndex(-1);
  };

  if (showAddressForm) {
    // Determinar si la dirección que se está editando es la predeterminada
    const isEditingDefault = editingAddress?.index !== undefined && editingAddress.index === defaultIndex;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {editingAddress ? 'Editar Dirección' : 'Agregar Dirección'}
          </h2>
          <button
            onClick={() => { setShowAddressForm(false); setEditingAddress(null); }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <AddressForm
          address={editingAddress}
          onSubmit={handleAddressSubmit}
          onCancel={() => { setShowAddressForm(false); setEditingAddress(null); }}
          isDefault={isEditingDefault}
          canSetDefault={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Información personal */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Información Personal
        </h2>

        {onPictureUpdate && (
          <div className="mb-6">
            <ProfilePhotoField
              profilePicture={user?.profilePicture}
              onPictureUpdate={onPictureUpdate}
              editable={true}
              size="md"
              label="Foto de perfil"
            />
          </div>
        )}

        <form onSubmit={handleSubmit(handleSavePersonal)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              {...register('name', { required: 'El nombre es obligatorio' })}
              placeholder="Ingresa tu nombre"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
            {errors.name && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              {...register('email', {
                required: 'El correo es obligatorio',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Formato de correo inválido'
                }
              })}
              placeholder="tu@correo.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
            {errors.email && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Teléfono
            </label>
            <input
              type="tel"
              {...register('phone', {
                required: 'El teléfono es obligatorio para poder recibir pedidos',
                pattern: {
                  value: /^\+?\d{9,15}$/,
                  message: 'Formato de teléfono inválido (ej: +5491112345678)'
                }
              })}
              placeholder="Ej: +54 9 11 1234-5678"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
            {errors.phone && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.phone.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingSection === 'personal'}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
          >
            {savingSection === 'personal' ? 'Guardando...' : 'Guardar esta sección'}
          </button>
        </form>
      </div>

      {/* Dirección predeterminada */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Dirección de entrega
        </h2>

        {defaultAddress ? (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">
                    {defaultAddress.label === 'Casa' ? '🏠' : defaultAddress.label === 'Trabajo' ? '💼' : '📍'}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">{defaultAddress.label}</span>
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                    Predeterminada
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  {defaultAddress.street} {defaultAddress.number}
                  {defaultAddress.floor && `, Piso ${defaultAddress.floor}`}
                  {defaultAddress.apartment && `, Depto ${defaultAddress.apartment}`}
                </p>
                {defaultAddress.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Nota: {defaultAddress.notes}
                  </p>
                )}
                {/* Indicador de ubicación GeoJSON guardada */}
                {defaultAddress.location?.coordinates?.length === 2 &&
                 (defaultAddress.location.coordinates[0] !== 0 || defaultAddress.location.coordinates[1] !== 0) && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    Ubicación en mapa guardada
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleEditAddress(defaultAddress, defaultIndex)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={handleClearDefault}
                  className="text-gray-500 hover:text-gray-700 text-xs"
                >
                  Quitar predeterminada
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">📍</div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Agregá tu dirección de entrega (calle y número) para poder pedir
            </p>
            {addresses.length > 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Seleccioná una de tus direcciones guardadas como predeterminada
              </p>
            ) : (
              <button
                type="button"
                onClick={handleAddAddress}
                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors mt-2"
              >
                Agregar dirección de entrega
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dirección predeterminada + Direcciones guardadas (una sección) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Direcciones Guardadas ({addresses.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveAddresses()}
              disabled={savingSection === 'addresses'}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
            >
              {savingSection === 'addresses' ? 'Guardando...' : 'Guardar esta sección'}
            </button>
            <button
              onClick={handleAddAddress}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm"
            >
              + Agregar
            </button>
          </div>
        </div>

        {addresses.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">📋</div>
            <p className="text-gray-600 dark:text-gray-400">
              No tenés direcciones guardadas
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((address, index) => {
              const isDefault = index === defaultIndex;
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    isDefault
                      ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-900/10 dark:border-orange-700'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span>
                        {address.label === 'Casa' ? '🏠' : address.label === 'Trabajo' ? '💼' : '📍'}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">{address.label}</span>
                      {isDefault && (
                        <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full">
                          Predeterminada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {address.street} {address.number}
                      {address.floor && `, Piso ${address.floor}`}
                      {address.apartment && `, Depto ${address.apartment}`}
                      {/* Indicador de ubicación en mapa */}
                      {address.location?.coordinates?.length === 2 &&
                       (address.location.coordinates[0] !== 0 || address.location.coordinates[1] !== 0) && (
                        <span className="ml-2 text-green-500 inline-flex items-center" title="Ubicación en mapa">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    {!isDefault && (
                      <button
                        onClick={() => handleSetDefaultAddress(index)}
                        className="text-orange-600 hover:text-orange-700 text-xs font-medium whitespace-nowrap"
                        title="Establecer como predeterminada"
                      >
                        Predeterminar
                      </button>
                    )}
                    <button
                      onClick={() => handleEditAddress(address, index)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(index)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preferencias dietéticas */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Preferencias Dietéticas
        </h2>

        <form onSubmit={handleSubmit(handleSaveDietary)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Preferencias (separadas por coma)
            </label>
            <input
              type="text"
              {...register('dietaryPreferences')}
              placeholder="Ej: vegano, sin gluten, sin lactosa"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Separa las preferencias con comas
            </p>
          </div>
          <button
            type="submit"
            disabled={savingSection === 'dietary'}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
          >
            {savingSection === 'dietary' ? 'Guardando...' : 'Guardar esta sección'}
          </button>
        </form>
      </div>

      {/* Guardar perfil completo (valida nombre, teléfono y dirección predeterminada) */}
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col items-end gap-2">
        {minimalError && (
          <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 w-full">
            {minimalError}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Volver al perfil
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium disabled:opacity-50"
          >
            Guardar perfil
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClientProfileForm;
