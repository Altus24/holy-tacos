// Componente FileUploader para Holy Tacos
// Maneja la subida de archivos con preview y validación
import React, { useState, useRef, useEffect } from 'react';

const FileUploader = ({
  label,
  name,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB por defecto
  currentFile = null, // Puede ser una URL existente o null
  onFileSelect,
  error = null,
  className = "",
  showPreview = true // Nueva prop para controlar si mostrar preview
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(currentFile); // URL existente o preview generado
  const [fileName, setFileName] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null); // Para preview local inmediato
  const [hasExistingFile, setHasExistingFile] = useState(!!currentFile); // Indica si hay archivo existente
  const inputRef = useRef(null);

  // Actualizar estado cuando cambia currentFile (para imágenes existentes)
  useEffect(() => {
    setPreview(currentFile);
    setHasExistingFile(!!currentFile);
  }, [currentFile]);

  // Manejar selección de archivo
  const handleFileSelect = (file) => {
    if (!file) return;

    // Validar tamaño del archivo
    if (file.size > maxSize) {
      alert(`El archivo es demasiado grande. Máximo ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    // Validar tipo de archivo
    if (accept !== "*" && !file.type.match(accept.replace('*', '.*'))) {
      alert('Tipo de archivo no permitido');
      return;
    }

    setFileName(file.name);

    // Crear preview local inmediato para imágenes (antes de upload)
    if (file.type.startsWith('image/') && showPreview) {
      const localUrl = URL.createObjectURL(file);
      setLocalPreviewUrl(localUrl);

      // También mantener el preview por compatibilidad
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
      setLocalPreviewUrl(null);
    }

    onFileSelect(file);
  };

  // Eventos de drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const removeFile = () => {
    // Limpiar URL local para liberar memoria
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    // Si hay archivo existente, volver a mostrarlo, sino limpiar completamente
    if (hasExistingFile && currentFile) {
      setPreview(currentFile);
      setLocalPreviewUrl(null);
      setFileName('');
      onFileSelect(null); // Indicar que se removió el archivo nuevo, pero queda el existente
    } else {
      setPreview(null);
      setLocalPreviewUrl(null);
      setFileName('');
      setHasExistingFile(false);
      onFileSelect(null);
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      {/* Área de drop */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-orange-400'
        } ${error ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />

        {preview || localPreviewUrl ? (
          // Mostrar preview de imagen (existente, local inmediato o procesado)
          <div className="space-y-4">
            <img
              src={localPreviewUrl || preview}
              alt="Preview"
              className="mx-auto max-w-32 max-h-32 object-cover rounded-lg shadow-md"
            />
            <div className="flex items-center justify-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {fileName || (hasExistingFile ? 'Imagen existente' : 'Imagen seleccionada')}
                {localPreviewUrl && ' (nueva)'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="text-red-500 hover:text-red-700 text-sm"
                title={hasExistingFile ? 'Remover nueva imagen (quedará la existente)' : 'Remover imagen'}
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          // Área vacía para seleccionar archivo
          <div className="space-y-4">
            <div className="text-gray-400 dark:text-gray-500">
              <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">
                Arrastra y suelta un archivo aquí, o{' '}
                <span className="text-orange-600 hover:text-orange-500 font-medium">
                  haz clic para seleccionar
                </span>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {accept === "image/*" ? "PNG, JPG, GIF hasta 5MB" :
                 accept.includes("pdf") ? "Imágenes y PDF hasta 10MB" :
                 "Archivo válido"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mensaje de error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default FileUploader;