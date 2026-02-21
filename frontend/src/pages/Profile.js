// Página Profile para Holy Tacos
// Muestra el perfil y permite editar desde la misma página (sin /profile/edit)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import ProfileHeader from '../components/Profile/ProfileHeader';
import ClientProfileForm from '../components/Profile/ClientProfileForm';
import DriverProfileForm from '../components/Profile/DriverProfileForm';
import LocationSharingToggle from '../components/LocationSharingToggle';
import ProfilePhotoField from '../components/Profile/ProfilePhotoField';
import BackButton from '../components/BackButton';
import axios from 'axios';

const Profile = () => {
  const { user, isAuthenticated, refreshUser, isAdmin } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Refrescar usuario y cargar perfil cuando haya usuario (solo re-ejecutar cuando cambie el id, no en cada actualización de user)
  useEffect(() => {
    if (user?._id) {
      refreshUser().then(() => {
        fetchProfile();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/api/profile');

      if (response.data.success) {
        setProfile(response.data.data);
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error('Error al cargar perfil:', error);
      setError('Error al cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handlePictureUpdate = (newPictureUrl) => {
    setProfile(prev => ({
      ...prev,
      profilePicture: newPictureUrl
    }));
  };

  const handleSaveSectionPromise = (sectionData) => {
    setSaving(true);
    return axios.put('/api/profile', sectionData)
      .then(res => {
        if (res.data.success) return axios.get('/api/profile');
        return null;
      })
      .then(getRes => {
        if (getRes?.data?.success && getRes.data.data) setProfile(getRes.data.data);
      })
      .catch(err => console.error(err))
      .finally(() => setSaving(false));
  };

  const handleSaveProfile = async (profileData) => {
    setSaving(true);
    try {
      await axios.put('/api/profile', profileData);
      const res = await axios.get('/api/profile');
      if (res.data.success && res.data.data) setProfile(res.data.data);
      setEditMode(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-6">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Error al cargar perfil
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error}
            </p>
            <button
              onClick={fetchProfile}
              className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Botón volver (no se muestra para admin; navega por Perfil y Dashboard en el header) */}
          {!isAdmin() && (
            <div className="mb-4">
              <BackButton to="/" label="Volver al Inicio" variant="link" />
            </div>
          )}
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Mi Perfil
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Gestiona tu información personal y preferencias
            </p>
          </div>

          <ProfileHeader
            user={profile}
            onPictureUpdate={handlePictureUpdate}
            isEditing={editMode}
          />

          {editMode ? (
            <>
              {profile?.role === 'client' && (
                <ClientProfileForm
                  user={profile}
                  onSave={handleSaveProfile}
                  onSaveSection={handleSaveSectionPromise}
                  onCancel={handleCancelEdit}
                  onPictureUpdate={handlePictureUpdate}
                />
              )}
              {profile?.role === 'driver' && (
                <>
                  <DriverProfileForm
                    user={profile}
                    onSave={handleSaveProfile}
                    onSaveSection={handleSaveSectionPromise}
                    onCancel={handleCancelEdit}
                    onDocumentsUpdate={(updates) => {
                      setProfile(prev => ({
                        ...prev,
                        driverProfile: { ...prev.driverProfile, ...updates }
                      }));
                    }}
                    onPictureUpdate={handlePictureUpdate}
                  />
                </>
              )}
              {profile?.role === 'admin' && (
                <div className="mt-8">
                  <button
                    onClick={handleCancelEdit}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
                  >
                    Volver
                  </button>
                </div>
              )}
              {saving && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
                    <span>Guardando...</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-8 space-y-6">
              {profile?.role === 'client' && (
                <ClientProfileSection
                  profile={profile}
                  onEdit={() => setEditMode(true)}
                  onPictureUpdate={handlePictureUpdate}
                />
              )}
              {profile?.role === 'driver' && (
                <DriverProfileSection
                  profile={profile}
                  onEdit={() => setEditMode(true)}
                  onProfileRefresh={fetchProfile}
                  onPictureUpdate={handlePictureUpdate}
                />
              )}
              {profile?.role === 'admin' && (
                <AdminProfileSection profile={profile} />
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

// Sección específica para clientes
const ClientProfileSection = ({ profile, onEdit, onPictureUpdate }) => (
  <div className="space-y-6">
    {/* Datos personales */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Datos personales</h2>
        <button type="button" onClick={onEdit} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Editar
        </button>
      </div>
      <div className="mb-6">
        <ProfilePhotoField
          profilePicture={profile?.profilePicture}
          onPictureUpdate={onPictureUpdate}
          editable={true}
          size="md"
          label="Foto de perfil"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Nombre</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {profile.name || 'No especificado'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Teléfono</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {profile.phone || 'No especificado'}
          </p>
        </div>
        <div className="md:col-span-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Correo electrónico</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {profile.email || 'No especificado'}
          </p>
        </div>
      </div>
    </div>

    {/* Dirección predeterminada */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dirección Predeterminada</h2>
        <button type="button" onClick={onEdit} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Editar
        </button>
      </div>

      {profile.clientProfile?.defaultAddress ? (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-lg">
              {profile.clientProfile.defaultAddress.label === 'Casa' ? '🏠' :
               profile.clientProfile.defaultAddress.label === 'Trabajo' ? '💼' : '📍'}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {profile.clientProfile.defaultAddress.label}
            </span>
          </div>
          <p className="text-gray-700 dark:text-gray-300">
            {profile.clientProfile.defaultAddress.street} {profile.clientProfile.defaultAddress.number}
            {profile.clientProfile.defaultAddress.floor && `, Piso ${profile.clientProfile.defaultAddress.floor}`}
            {profile.clientProfile.defaultAddress.apartment && `, Depto ${profile.clientProfile.defaultAddress.apartment}`}
          </p>
          {profile.clientProfile.defaultAddress.notes && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Nota: {profile.clientProfile.defaultAddress.notes}
            </p>
          )}
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400 text-center py-4">
          No tienes una dirección predeterminada configurada
        </p>
      )}
    </div>

    {/* Direcciones guardadas */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Direcciones Guardadas ({profile.clientProfile?.savedAddresses?.length || 0})
        </h2>
        <button type="button" onClick={onEdit} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Editar
        </button>
      </div>

      {profile.clientProfile?.savedAddresses?.length > 0 ? (
        <div className="space-y-3">
          {profile.clientProfile.savedAddresses.map((address, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span>
                    {address.label === 'Casa' ? '🏠' :
                     address.label === 'Trabajo' ? '💼' : '📍'}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">{address.label}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {address.street} {address.number}
                  {address.floor && `, Piso ${address.floor}`}
                  {address.apartment && `, Depto ${address.apartment}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400 text-center py-4">
          No tienes direcciones guardadas adicionales
        </p>
      )}
    </div>

    {/* Preferencias dietéticas */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Preferencias Dietéticas</h2>
        <button type="button" onClick={onEdit} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Editar
        </button>
      </div>

      {profile.clientProfile?.dietaryPreferences?.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {profile.clientProfile.dietaryPreferences.map((preference, index) => (
            <span
              key={index}
              className="bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm"
            >
              {preference}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          No tienes preferencias dietéticas configuradas
        </p>
      )}
    </div>
  </div>
);

// Sección específica para conductores
const DriverProfileSection = ({ profile, onEdit, onProfileRefresh, onPictureUpdate }) => (
  <div className="space-y-6">
    {/* Datos personales */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Datos personales</h2>
        <button type="button" onClick={onEdit} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Editar
        </button>
      </div>
      <div className="mb-6">
        <ProfilePhotoField
          profilePicture={profile?.profilePicture}
          onPictureUpdate={onPictureUpdate}
          editable={true}
          size="md"
          label="Foto de perfil"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Nombre</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {profile.name || 'No especificado'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Teléfono</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {profile.phone || 'No especificado'}
          </p>
        </div>
        <div className="md:col-span-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Correo electrónico</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {profile.email || 'No especificado'}
          </p>
        </div>
      </div>
    </div>

    {/* Información del vehículo */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Información del Vehículo</h2>
        <button type="button" onClick={onEdit} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Editar
        </button>
      </div>

      {profile.driverProfile?.vehicle ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Tipo</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {profile.driverProfile.vehicle.type === 'moto' ? '🏍️ Moto' :
               profile.driverProfile.vehicle.type === 'auto' ? '🚗 Auto' :
               profile.driverProfile.vehicle.type === 'bicicleta' ? '🚲 Bicicleta' : '🔄 Otro'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Marca</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {profile.driverProfile.vehicle.brand || 'No especificada'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Modelo</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {profile.driverProfile.vehicle.model || 'No especificado'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Placa</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {profile.driverProfile.vehicle.plate || 'No especificada'}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          Información del vehículo no configurada
        </p>
      )}
    </div>

    {/* Información de la licencia */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Información de la Licencia</h2>
        <button type="button" onClick={onEdit} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Editar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Número</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {profile.driverProfile?.licenseNumber || 'No especificado'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Expira</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {profile.driverProfile?.licenseExpiration
              ? new Date(profile.driverProfile.licenseExpiration).toLocaleDateString()
              : 'No especificada'}
          </p>
        </div>
      </div>
    </div>

    {/* Zonas de trabajo */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Zonas de Trabajo</h2>
        <button type="button" onClick={onEdit} className="text-orange-600 hover:text-orange-700 text-sm font-medium">
          Editar
        </button>
      </div>

      {profile.driverProfile?.workingAreas?.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {profile.driverProfile.workingAreas.map((area, index) => (
            <span
              key={index}
              className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
            >
              📍 {area}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          No tienes zonas de trabajo configuradas
        </p>
      )}
    </div>

    {/* Geolocalización: compartir ubicación en tiempo real */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Geolocalización
      </h2>
      <LocationSharingToggle
        user={profile}
        onStatusChange={() => onProfileRefresh?.().catch(() => {})}
      />
    </div>

    {/* Estadísticas (solo lectura) */}
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Estadísticas</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {profile.driverProfile?.rating?.toFixed(1) || '5.0'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Calificación</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {profile.driverProfile?.totalDeliveries || 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Entregas</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            profile.driverProfile?.verificationStatus === 'approved' ? 'text-green-600' :
            profile.driverProfile?.verificationStatus === 'rejected' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {profile.driverProfile?.verificationStatus === 'approved' ? '✓' :
             profile.driverProfile?.verificationStatus === 'rejected' ? '✗' : '○'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {profile.driverProfile?.verificationStatus === 'approved' ? 'Aprobado' :
             profile.driverProfile?.verificationStatus === 'rejected' ? 'Rechazado' : 'Pendiente'}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Sección específica para administradores
const AdminProfileSection = ({ profile }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
      Información de Administrador
    </h2>
    <p className="text-gray-600 dark:text-gray-400">
      Como administrador, tienes acceso completo al sistema de Holy Tacos.
      Puedes gestionar restaurantes, usuarios, pedidos y configuraciones del sistema.
    </p>
  </div>
);

export default Profile;