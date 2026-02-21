// Componente DriverProfileForm para Holy Tacos
// Maneja el formulario de perfil para conductores
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import FileUploader from '../FileUploader';
import LocationSharingToggle from '../LocationSharingToggle';
import WorkingAreasPicker from '../WorkingAreasPicker';
import ProfilePhotoField from './ProfilePhotoField';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { getUploadsUrl } from '../../config/api';

const getAbsoluteUrl = (url) => (url ? getUploadsUrl(url) : null);

// Función helper para obtener documentos con URLs absolutas
const getDocumentsWithAbsoluteUrls = (documents) => {
  if (!documents) return {};

  return {
    licenseFront: getAbsoluteUrl(documents.licenseFront),
    licenseBack: getAbsoluteUrl(documents.licenseBack),
    profileVerification: getAbsoluteUrl(documents.profileVerification)
  };
};

const DriverProfileForm = ({
  user,
  onSave,
  onSaveSection,
  onCancel,
  onDocumentsUpdate,
  onPictureUpdate
}) => {
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [localAvailability, setLocalAvailability] = useState(user?.driverProfile?.isAvailable || false);
  const [savingSection, setSavingSection] = useState(null);
  const [workingAreasList, setWorkingAreasList] = useState(
    () => (user?.driverProfile?.workingAreas && Array.isArray(user.driverProfile.workingAreas))
      ? [...user.driverProfile.workingAreas]
      : []
  );

  // Estado para notificación de verificación en tiempo real
  const [verificationNotice, setVerificationNotice] = useState(null);
  const { onVerificationUpdate } = useSocket();
  const { refreshUser } = useAuth();

  // Escuchar evento de actualización de verificación desde el admin: actualizar estado local y usuario global
  useEffect(() => {
    const cleanup = onVerificationUpdate?.((data) => {
      console.log('Notificación de verificación recibida:', data);
      setVerificationNotice(data);
      // Actualizar usuario en AuthContext para que "Mis entregas" y el Navbar muestren el estado correcto
      refreshUser?.();
    });
    return () => { if (cleanup) cleanup(); };
  }, [onVerificationUpdate, refreshUser]);

  // Estado para las URLs absolutas de documentos
  const [documentUrls, setDocumentUrls] = useState(() =>
    getDocumentsWithAbsoluteUrls(user?.driverProfile?.documents)
  );

  // Debug inicial
  useEffect(() => {
    console.log('DriverProfileForm montado con documentos:', user?.driverProfile?.documents);
    const initialUrls = getDocumentsWithAbsoluteUrls(user?.driverProfile?.documents);
    console.log('URLs iniciales:', initialUrls);
    setDocumentUrls(initialUrls);
  }, []); // Solo al montar

  // Actualizar URLs cuando cambian los documentos del usuario
  useEffect(() => {
    if (user?.driverProfile?.documents) {
      const newUrls = getDocumentsWithAbsoluteUrls(user?.driverProfile?.documents);
      setDocumentUrls(newUrls);
      console.log('URLs de documentos actualizadas:', newUrls);
    }
  }, [user?.driverProfile?.documents]);

  // Sincronizar estado local con el estado del usuario
  useEffect(() => {
    setLocalAvailability(user?.driverProfile?.isAvailable || false);
  }, [user?.driverProfile?.isAvailable]);

  useEffect(() => {
    const areas = user?.driverProfile?.workingAreas;
    if (areas && Array.isArray(areas)) setWorkingAreasList([...areas]);
  }, [user?.driverProfile?.workingAreas]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch
  } = useForm({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      // Vehículo
      vehicleType: user?.driverProfile?.vehicle?.type || 'moto',
      vehicleBrand: user?.driverProfile?.vehicle?.brand || '',
      vehicleModel: user?.driverProfile?.vehicle?.model || '',
      vehiclePlate: user?.driverProfile?.vehicle?.plate || '',
      vehicleColor: user?.driverProfile?.vehicle?.color || '',
      // Licencia
      licenseNumber: user?.driverProfile?.licenseNumber || '',
      licenseExpiration: user?.driverProfile?.licenseExpiration ?
        new Date(user.driverProfile.licenseExpiration).toISOString().split('T')[0] : '',
      // Zonas
      workingAreas: user?.driverProfile?.workingAreas?.join(', ') || '' // legacy; zonas se manejan con workingAreasList
    }
  });

  const handleFormSubmit = async (data) => {
    const profileData = {
      name: data.name,
      phone: data.phone,
      driverProfile: {
        vehicle: {
          type: data.vehicleType,
          brand: data.vehicleBrand,
          model: data.vehicleModel,
          plate: data.vehiclePlate.toUpperCase(),
          color: data.vehicleColor
        },
        licenseNumber: data.licenseNumber.toUpperCase(),
        licenseExpiration: data.licenseExpiration ? new Date(data.licenseExpiration) : null,
        workingAreas: Array.isArray(workingAreasList) ? workingAreasList : [],
        isAvailable: localAvailability
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
      phone: data.phone
    });
  };

  const handleSaveVehicle = (data) => {
    saveSection('vehicle', {
      driverProfile: {
        vehicle: {
          type: data.vehicleType,
          brand: data.vehicleBrand,
          model: data.vehicleModel,
          plate: (data.vehiclePlate || '').toUpperCase(),
          color: data.vehicleColor
        }
      }
    });
  };

  const handleSaveLicense = (data) => {
    saveSection('license', {
      driverProfile: {
        licenseNumber: (data.licenseNumber || '').toUpperCase(),
        licenseExpiration: data.licenseExpiration ? new Date(data.licenseExpiration) : null
      }
    });
  };

  const handleSaveWorkingAreas = () => {
    saveSection('workingAreas', {
      driverProfile: {
        workingAreas: Array.isArray(workingAreasList) ? workingAreasList : []
      }
    });
  };

  const handleDocumentUpload = async (files) => {
    setUploadingDocuments(true);
    setUploadError(null);

    try {
      const formData = new FormData();

      if (files.licenseFront) formData.append('licenseFront', files.licenseFront);
      if (files.licenseBack) formData.append('licenseBack', files.licenseBack);
      if (files.profileVerification) formData.append('profileVerification', files.profileVerification);

      const response = await axios.post('/api/profile/driver/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const result = response.data;

      if (result.success) {
        alert('Documentos subidos exitosamente');

        // Actualizar el estado local si se proporciona la función de callback
        if (onDocumentsUpdate && result.data?.documents) {
          console.log('Actualizando documentos en estado local:', result.data.documents);
          const updatedDocuments = result.data.documents;

          // Actualizar estado local con URLs absolutas
          setDocumentUrls(getDocumentsWithAbsoluteUrls(updatedDocuments));

          // Actualizar estado del componente padre
          onDocumentsUpdate({
            documents: updatedDocuments
          });
        } else {
          // Como fallback, refrescar la página solo si es necesario
          console.log('No hay callback para actualizar documentos, recargando página');
          window.location.reload();
        }
      } else {
        setUploadError(result.message || 'Error desconocido');
        alert('Error al subir documentos: ' + result.message);
      }
    } catch (error) {
      console.error('Error al subir documentos:', error);
      const errorMessage = error.response?.data?.message || 'Error al subir documentos';
      setUploadError(errorMessage);
      alert(errorMessage);
    } finally {
      setUploadingDocuments(false);
    }
  };

  const toggleAvailability = async () => {
    try {
      const newAvailability = !localAvailability;
      const response = await axios.put('/api/profile/driver/availability', {
        isAvailable: newAvailability
      });

      const result = response.data;

      if (result.success) {
        // Actualizar estado local inmediatamente
        setLocalAvailability(result.data.isAvailable);

        alert(`Disponibilidad ${result.data.isAvailable ? 'activada' : 'desactivada'} exitosamente`);

        // También actualizar el estado del usuario padre
        if (onDocumentsUpdate) {
          onDocumentsUpdate({
            isAvailable: result.data.isAvailable
          });
        }
      } else {
        alert('Error al cambiar disponibilidad: ' + result.message);
      }
    } catch (error) {
      console.error('Error al cambiar disponibilidad:', error);
      alert('Error al cambiar disponibilidad');
    }
  };

  // Obtener estado de verificación actual
  const verificationStatus = user?.driverProfile?.verificationStatus || 'pending';

  return (
    <div className="space-y-6">
      {/* === Banner de estado de verificación === */}
      {verificationStatus === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex items-start">
          <div className="flex-shrink-0 mr-3">
            <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-yellow-800">Verificación pendiente</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Tu cuenta está en revisión. Completá tu perfil, subí tus documentos y esperá la aprobación del administrador para poder activarte y recibir pedidos.
            </p>
          </div>
        </div>
      )}

      {verificationStatus === 'approved' && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-start">
          <div className="flex-shrink-0 mr-3">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-green-800">Cuenta aprobada</h3>
            <p className="text-sm text-green-700 mt-1">
              Tu verificación fue aprobada. Ya podés activarte y recibir pedidos.
            </p>
          </div>
        </div>
      )}

      {verificationStatus === 'rejected' && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start">
          <div className="flex-shrink-0 mr-3">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-800">Verificación rechazada</h3>
            <p className="text-sm text-red-700 mt-1">
              Tu verificación fue rechazada.
              {user?.driverProfile?.verificationNotes && (
                <> <strong>Motivo:</strong> {user.driverProfile.verificationNotes}.</>
              )}
              {' '}Revisá y actualizá tus documentos, luego contactá al administrador.
            </p>
          </div>
        </div>
      )}

      {/* Notificación en tiempo real del admin */}
      {verificationNotice && (
        <div className={`border rounded-lg p-4 flex items-start ${
          verificationNotice.status === 'approved'
            ? 'bg-green-100 border-green-400 text-green-800'
            : verificationNotice.status === 'rejected'
            ? 'bg-red-100 border-red-400 text-red-800'
            : 'bg-yellow-100 border-yellow-400 text-yellow-800'
        }`}>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {verificationNotice.status === 'approved' && 'Tu cuenta fue aprobada. Ya podés activarte y recibir pedidos.'}
              {verificationNotice.status === 'rejected' && `Tu verificación fue rechazada: ${verificationNotice.notes || '—'}. Revisá tus documentos.`}
              {verificationNotice.status === 'pending' && 'Tu verificación fue restablecida a pendiente.'}
            </p>
          </div>
          <button onClick={() => setVerificationNotice(null)} className="ml-3 text-gray-500 hover:text-gray-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Información básica */}
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
              Nombre completo *
            </label>
            <input
              type="text"
              {...register('name', { required: 'El nombre es obligatorio' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
            {errors.name && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Correo electrónico *
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
              Teléfono *
            </label>
            <input
              type="tel"
              {...register('phone', {
                required: 'El teléfono es obligatorio',
                pattern: {
                  value: /^\+?\d{9,15}$/,
                  message: 'Formato de teléfono inválido'
                }
              })}
              placeholder="+549123456789"
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

      {/* Información del vehículo */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Información del Vehículo
        </h2>

        <form onSubmit={handleSubmit(handleSaveVehicle)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de vehículo *
            </label>
            <select
              {...register('vehicleType', { required: 'Selecciona el tipo de vehículo' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="moto">🏍️ Moto</option>
              <option value="auto">🚗 Auto</option>
              <option value="bicicleta">🚲 Bicicleta</option>
              <option value="otro">🔄 Otro</option>
            </select>
            {errors.vehicleType && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.vehicleType.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Marca</label>
              <input
                type="text"
                {...register('vehicleBrand')}
                placeholder="Ej: Honda"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo</label>
              <input
                type="text"
                {...register('vehicleModel')}
                placeholder="Ej: CG 150"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Placa *</label>
              <input
                type="text"
                {...register('vehiclePlate', { required: 'La placa es obligatoria' })}
                placeholder="Ej: ABC123"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white uppercase"
              />
              {errors.vehiclePlate && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.vehiclePlate.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
              <input
                type="text"
                {...register('vehicleColor')}
                placeholder="Ej: Rojo"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingSection === 'vehicle'}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
          >
            {savingSection === 'vehicle' ? 'Guardando...' : 'Guardar esta sección'}
          </button>
        </form>
      </div>

      {/* Información de la licencia */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Información de la Licencia
        </h2>

        <form onSubmit={handleSubmit(handleSaveLicense)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Número de licencia *
            </label>
            <input
              type="text"
              {...register('licenseNumber', { required: 'El número de licencia es obligatorio' })}
              placeholder="Ej: LC12345678"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white uppercase"
            />
            {errors.licenseNumber && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.licenseNumber.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de expiración *
            </label>
            <input
              type="date"
              {...register('licenseExpiration', { required: 'La fecha de expiración es obligatoria' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
            />
            {errors.licenseExpiration && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.licenseExpiration.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={savingSection === 'license'}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
          >
            {savingSection === 'license' ? 'Guardando...' : 'Guardar esta sección'}
          </button>
        </form>
      </div>

      {/* Zonas de trabajo (validadas con Google Maps) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Zonas de Trabajo
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Zonas
            </label>
            <WorkingAreasPicker
              value={workingAreasList}
              onChange={setWorkingAreasList}
              placeholder="Buscar ciudad o zona (ej: Mendoza, Las Heras, Godoy Cruz)"
              disabled={savingSection === 'workingAreas'}
            />
          </div>
          <button
            type="button"
            onClick={handleSaveWorkingAreas}
            disabled={savingSection === 'workingAreas'}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
          >
            {savingSection === 'workingAreas' ? 'Guardando...' : 'Guardar esta sección'}
          </button>
        </div>
      </div>

      {/* Documentos */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Documentos
        </h2>

        <div className="space-y-4">
          {/* Documentos actuales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Licencia (Frente)</h3>
              {documentUrls.licenseFront ? (
                <img
                  key={`licenseFront-${Date.now()}`}
                  src={`${documentUrls.licenseFront}?t=${Date.now()}`}
                  alt="Licencia frente"
                  className="w-full h-32 object-cover rounded-lg border"
                  onError={(e) => console.error('Error cargando imagen licenseFront:', e.target.src)}
                />
              ) : (
                <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500">
                  📄 No subido
                </div>
              )}
            </div>

            <div className="text-center">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Licencia (Reverso)</h3>
              {documentUrls.licenseBack ? (
                <img
                  key={`licenseBack-${Date.now()}`}
                  src={`${documentUrls.licenseBack}?t=${Date.now()}`}
                  alt="Licencia reverso"
                  className="w-full h-32 object-cover rounded-lg border"
                  onError={(e) => console.error('Error cargando imagen licenseBack:', e.target.src)}
                />
              ) : (
                <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500">
                  📄 No subido
                </div>
              )}
            </div>

            <div className="text-center">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Verificación</h3>
              {documentUrls.profileVerification ? (
                <img
                  key={`profileVerification-${Date.now()}`}
                  src={`${documentUrls.profileVerification}?t=${Date.now()}`}
                  alt="Verificación"
                  className="w-full h-32 object-cover rounded-lg border"
                  onError={(e) => console.error('Error cargando imagen profileVerification:', e.target.src)}
                />
              ) : (
                <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500">
                  📄 No subido
                </div>
              )}
            </div>
          </div>

          {/* Formulario para subir documentos */}
          <div className="border-t pt-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">
              Subir Documentos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FileUploader
                label="Licencia (Frente)"
                name="licenseFront"
                accept="image/*"
                currentFile={documentUrls.licenseFront}
                onFileSelect={(file) => {
                  const files = { licenseFront: file };
                  handleDocumentUpload(files);
                }}
              />

              <FileUploader
                label="Licencia (Reverso)"
                name="licenseBack"
                accept="image/*"
                currentFile={documentUrls.licenseBack}
                onFileSelect={(file) => {
                  const files = { licenseBack: file };
                  handleDocumentUpload(files);
                }}
              />

              <FileUploader
                label="Foto de Verificación"
                name="profileVerification"
                accept="image/*"
                currentFile={documentUrls.profileVerification}
                onFileSelect={(file) => {
                  const files = { profileVerification: file };
                  handleDocumentUpload(files);
                }}
              />
            </div>

            {uploadingDocuments && (
              <div className="text-center mt-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Subiendo documentos...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disponibilidad */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Disponibilidad
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              Estado actual: {localAvailability ? 'Disponible' : 'No disponible'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Los clientes solo te verán cuando estés disponible
            </p>
          </div>
          <button
            onClick={toggleAvailability}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              localAvailability
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {localAvailability ? 'Ponerme No Disponible' : 'Ponerme Disponible'}
          </button>
        </div>
      </div>

      {/* Compartir ubicación en tiempo real */}
      <LocationSharingToggle
        user={user}
        onStatusChange={(newState) => {
          if (onDocumentsUpdate) {
            onDocumentsUpdate({ shareLocation: newState });
          }
        }}
      />

      {/* Botón volver */}
      <div className="flex justify-end">
        <button
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Volver al perfil
        </button>
      </div>
    </div>
  );
};

export default DriverProfileForm;