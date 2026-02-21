// Componente ProfileHeader para Holy Tacos
// Muestra la información básica del perfil y foto
import React, { useState } from 'react';
import FileUploader from '../FileUploader';
import axios from 'axios';
import { getUploadsUrl } from '../../config/api';

const getAbsoluteUrl = (url) => (url ? getUploadsUrl(url) : null);

const ProfileHeader = ({
  user,
  onPictureUpdate,
  isEditing = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handlePictureUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await axios.post('/api/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const result = response.data;

      if (result.success) {
        // Actualizar el estado del usuario con la nueva URL
        onPictureUpdate(result.data.profilePicture);
        alert('Foto de perfil actualizada exitosamente');
      } else {
        setUploadError(result.message || 'Error desconocido');
        alert('Error al subir la foto: ' + result.message);
      }
    } catch (error) {
      console.error('Error al subir foto:', error);
      const errorMessage = error.response?.data?.message || 'Error al subir la foto';
      setUploadError(errorMessage);
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-6">
        {/* Foto de perfil */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            {user?.profilePicture ? (
              <img
                src={getAbsoluteUrl(user.profilePicture)}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400">
                👤
              </div>
            )}
          </div>

          {/* Overlay para editar foto */}
          {isEditing && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <FileUploader
                name="profilePicture"
                accept="image/*"
                maxSize={5 * 1024 * 1024}
                onFileSelect={handlePictureUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="text-white text-center">
                <div className="text-2xl">📷</div>
                <div className="text-xs">Cambiar</div>
              </div>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
        </div>

        {/* Información del perfil */}
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user?.name || user?.email?.split('@')[0] || 'Usuario'}
            </h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              user?.role === 'admin'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                : user?.role === 'driver'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {user?.role === 'admin' ? '👑 Admin' :
               user?.role === 'driver' ? '🏍️ Conductor' :
               '👤 Cliente'}
            </span>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {user?.email}
          </p>

          {user?.phone && (
            <p className="text-gray-600 dark:text-gray-400">
              📞 {user.phone}
            </p>
          )}

          {/* Estado del conductor */}
          {user?.role === 'driver' && (
            <div className="mt-3 flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                user.driverProfile?.isAvailable
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  user.driverProfile?.isAvailable ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span>
                  {user.driverProfile?.isAvailable ? 'Disponible' : 'No disponible'}
                </span>
              </div>

              {user.driverProfile?.verificationStatus === 'approved' && (
                <div className="flex items-center space-x-2 px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <span>✅</span>
                  <span>Verificado</span>
                </div>
              )}

              <div className="text-sm text-gray-600 dark:text-gray-400">
                ⭐ {user.driverProfile?.rating?.toFixed(1) || '5.0'} • 🚚 {user.driverProfile?.totalDeliveries || 0} entregas
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;