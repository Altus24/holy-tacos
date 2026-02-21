// Campo de foto de perfil con opción de editar (clientes y conductores)
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { getUploadsUrl } from '../../config/api';

const getAbsoluteUrl = (url) => (url ? getUploadsUrl(url) : null);

const sizeClasses = {
  sm: 'w-14 h-14',
  md: 'w-20 h-20',
  lg: 'w-24 h-24'
};

const ProfilePhotoField = ({
  profilePicture,
  onPictureUpdate,
  editable = true,
  size = 'md',
  label = 'Foto de perfil'
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const inputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Solo se permiten imágenes (PNG, JPG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('La imagen no debe superar 5 MB');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      const response = await axios.post('/api/profile/picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const result = response.data;
      if (result.success) {
        onPictureUpdate(result.data.profilePicture);
      } else {
        setUploadError(result.message || 'Error al subir la foto');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al subir la foto';
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <div className={`${sizeClass} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700`}>
          {profilePicture ? (
            <img
              src={getAbsoluteUrl(profilePicture)}
              alt="Foto de perfil"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
              👤
            </div>
          )}
        </div>
        {uploading && (
          <div className={`absolute inset-0 ${sizeClass} rounded-full bg-black/50 flex items-center justify-center`}>
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        {editable && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-1 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium disabled:opacity-50"
            >
              {uploading ? 'Subiendo...' : 'Cambiar foto'}
            </button>
          </>
        )}
        {uploadError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{uploadError}</p>
        )}
      </div>
    </div>
  );
};

export default ProfilePhotoField;
