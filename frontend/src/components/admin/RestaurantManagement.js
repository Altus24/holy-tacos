// Gestión de Restaurantes - Panel de Administración Holy Tacos
// Incluye CRUD completo con selección de ubicación en mapa
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import LocationPicker from '../LocationPicker';

const RestaurantManagement = ({ onStatsUpdate }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    isActive: true,
    menu: [],
    location: { lat: null, lng: null }
  });
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    price: '',
    description: '',
    category: 'plato principal'
  });
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    restaurantId: null,
    restaurantName: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  // Restaurante seleccionado para ver detalle con mapa
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  // Disparar "usar mi ubicación actual" en el LocationPicker (geolocalización igual que clientes)
  const [triggerUseMyLocation, setTriggerUseMyLocation] = useState(null);

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      setLoading(true);
      // Usar la ruta de admin que devuelve TODOS los restaurantes con TODOS los campos
      const response = await axios.get('/api/admin/restaurants');
      const restaurantsData = response.data.data || [];
      setRestaurants(restaurantsData);
    } catch (error) {
      console.error('Error cargando restaurantes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extraer coordenadas de un restaurante desde el formato GeoJSON del backend
  const getCoordinates = useCallback((restaurant) => {
    if (restaurant.location &&
        restaurant.location.coordinates &&
        restaurant.location.coordinates.length === 2 &&
        (restaurant.location.coordinates[0] !== 0 || restaurant.location.coordinates[1] !== 0)) {
      // GeoJSON almacena [lng, lat], devolver como { lat, lng }
      return {
        lat: restaurant.location.coordinates[1],
        lng: restaurant.location.coordinates[0]
      };
    }
    return null;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const dataToSend = {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        isActive: formData.isActive,
        menu: formData.menu.filter(item => item.name && item.price)
      };

      // Incluir coordenadas solo si existen
      if (formData.location.lat != null && formData.location.lng != null) {
        dataToSend.location = {
          lat: formData.location.lat,
          lng: formData.location.lng
        };
      }

      // Usar rutas de admin para crear/actualizar
      if (editingRestaurant) {
        await axios.put(`/api/admin/restaurants/${editingRestaurant._id}`, dataToSend);
      } else {
        await axios.post(`/api/admin/restaurants`, dataToSend);
      }

      resetForm();
      await loadRestaurants();
      onStatsUpdate();
    } catch (error) {
      console.error('Error guardando restaurante:', error);
      alert('Error al guardar restaurante: ' + (error.response?.data?.message || 'Error desconocido'));
    }
  };

  const addMenuItem = () => {
    if (newMenuItem.name && newMenuItem.price) {
      setFormData(prev => ({
        ...prev,
        menu: [...prev.menu, { ...newMenuItem, price: parseFloat(newMenuItem.price) }]
      }));
      setNewMenuItem({
        name: '',
        price: '',
        description: '',
        category: 'plato principal'
      });
    }
  };

  const removeMenuItem = (index) => {
    setFormData(prev => ({
      ...prev,
      menu: prev.menu.filter((_, i) => i !== index)
    }));
  };

  const editRestaurant = (restaurant) => {
    setEditingRestaurant(restaurant);
    const coords = getCoordinates(restaurant);
    setFormData({
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone || '',
      isActive: restaurant.isActive !== false,
      menu: restaurant.menu || [],
      location: coords || { lat: null, lng: null }
    });
    setShowForm(true);
    // Cerrar detalle si estaba abierto
    setSelectedRestaurant(null);
    // Scroll al formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      phone: '',
      isActive: true,
      menu: [],
      location: { lat: null, lng: null }
    });
    setEditingRestaurant(null);
    setShowForm(false);
  };

  const confirmDeleteRestaurant = (restaurant) => {
    setDeleteConfirm({
      show: true,
      restaurantId: restaurant._id,
      restaurantName: restaurant.name
    });
  };

  const executeDeleteRestaurant = async () => {
    try {
      // Primero verificar el estado del restaurante
      const statusResponse = await axios.get(`/api/admin/restaurants/${deleteConfirm.restaurantId}/status`);
      const restaurantStatus = statusResponse.data.data;

      if (!restaurantStatus.canDelete) {
        alert(`No se puede eliminar: ${restaurantStatus.statusMessage}`);
        setDeleteConfirm({ show: false, restaurantId: null, restaurantName: '' });
        return;
      }

      await axios.delete(`/api/admin/restaurants/${deleteConfirm.restaurantId}`);
      loadRestaurants();
      onStatsUpdate();
      alert('Restaurante eliminado exitosamente');
      setDeleteConfirm({ show: false, restaurantId: null, restaurantName: '' });
    } catch (error) {
      console.error('Error eliminando restaurante:', error);
      alert(error.response?.data?.message || 'Error al eliminar restaurante');
    }
  };

  // Callback del LocationPicker cuando cambia la ubicación completa
  const handleLocationChange = useCallback(({ address, lat, lng }) => {
    setFormData(prev => ({
      ...prev,
      address: address,
      location: { lat, lng }
    }));
  }, []);

  // Callback del LocationPicker cuando solo cambia el texto de la dirección
  const handleAddressChange = useCallback((address) => {
    setFormData(prev => ({
      ...prev,
      address: address
    }));
  }, []);

  const filteredRestaurants = restaurants.filter(restaurant => {
    const matchesSearch = restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          restaurant.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'active' && restaurant.isActive) ||
                         (filterStatus === 'inactive' && !restaurant.isActive);
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-orange-600 mx-auto mb-3"></div>
        <p className="text-gray-500">Cargando restaurantes...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Restaurantes</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center space-x-2 transition-colors"
        >
          <span>+</span>
          <span>Agregar Restaurante</span>
        </button>
      </div>

      {/* Filtros y búsqueda */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* ========== FORMULARIO CREAR/EDITAR ========== */}
      {showForm && (
        <div className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-xl font-semibold mb-6 text-gray-900">
            {editingRestaurant ? 'Editar Restaurante' : 'Nuevo Restaurante'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Nombre y Teléfono */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Restaurante <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Ej: Burritos Express"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Ej: +54 261 123 4567"
                />
              </div>
            </div>

            {/* ===== SELECTOR DE UBICACIÓN CON MAPA (geolocalización igual que direcciones de clientes) ===== */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-1">Ubicación del Restaurante</h4>
              <p className="text-sm text-gray-500 mb-4">
                Buscá la dirección, usá tu ubicación actual o seleccioná en el mapa. Podés arrastrar el marcador para ajustar.
              </p>
              <button
                type="button"
                onClick={() => setTriggerUseMyLocation(Date.now())}
                className="w-full py-3 px-4 bg-orange-100 border border-orange-300 rounded-lg text-orange-800 font-medium hover:bg-orange-200 transition-colors flex items-center justify-center gap-2 mb-4"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Consultar mi ubicación actual
              </button>
              <LocationPicker
                address={formData.address}
                coordinates={formData.location.lat ? formData.location : null}
                onAddressChange={handleAddressChange}
                onLocationChange={handleLocationChange}
                placeholder="Escribí la dirección del restaurante..."
                mapHeight={400}
                showCoordinates={true}
                required={true}
                triggerUseMyLocation={triggerUseMyLocation}
              />
            </div>

            {/* ===== MENÚ DEL RESTAURANTE ===== */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium mb-4 text-gray-900">Menú del Restaurante</h4>

              {/* Agregar nuevo item */}
              <div className="bg-white p-4 rounded-lg border mb-4">
                <h5 className="font-medium mb-3 text-gray-700">Agregar Item al Menú</h5>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre del platillo"
                    value={newMenuItem.name}
                    onChange={(e) => setNewMenuItem(prev => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <input
                    type="number"
                    placeholder="Precio"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem(prev => ({ ...prev, price: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    step="0.01"
                  />
                  <select
                    value={newMenuItem.category}
                    onChange={(e) => setNewMenuItem(prev => ({ ...prev, category: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="plato principal">Plato Principal</option>
                    <option value="entrada">Entrada</option>
                    <option value="bebida">Bebida</option>
                    <option value="postre">Postre</option>
                  </select>
                  <button
                    type="button"
                    onClick={addMenuItem}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    + Agregar
                  </button>
                </div>
                <textarea
                  placeholder="Descripción (opcional)"
                  value={newMenuItem.description}
                  onChange={(e) => setNewMenuItem(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={2}
                />
              </div>

              {/* Lista de items del menú */}
              <div className="space-y-2">
                <h5 className="font-medium text-gray-700">Items en el Menú ({formData.menu.length})</h5>
                {formData.menu.length === 0 && (
                  <p className="text-sm text-gray-400 italic py-2">No hay items en el menú todavía.</p>
                )}
                {formData.menu.map((item, index) => (
                  <div key={index} className="flex justify-between items-center bg-white p-3 rounded-lg border">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className="text-orange-600 font-semibold ml-2">${item.price}</span>
                      <span className="text-xs text-gray-500 ml-2 bg-gray-100 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMenuItem(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors ml-2"
                      title="Eliminar item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== ESTADO DEL RESTAURANTE ===== */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-medium text-gray-900">Estado del Restaurante</h4>
                  <p className="text-sm text-gray-600">
                    Controla si el restaurante está visible para los clientes
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    formData.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {formData.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        isActive: e.target.checked
                      }))}
                      className="sr-only"
                    />
                    <div className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full ${
                      formData.isActive ? 'bg-green-600' : 'bg-gray-300'
                    }`}>
                      <span className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out ${
                        formData.isActive ? 'translate-x-6' : 'translate-x-0'
                      }`}></span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Botones del formulario */}
            <div className="flex justify-end space-x-3 border-t pt-6">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                {editingRestaurant ? 'Actualizar Restaurante' : 'Crear Restaurante'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========== DETALLE DE RESTAURANTE CON MAPA ========== */}
      {selectedRestaurant && (
        <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedRestaurant.name}</h3>
                <p className="text-gray-600 mt-1">{selectedRestaurant.address}</p>
                {selectedRestaurant.phone && (
                  <p className="text-gray-500 text-sm mt-1">{selectedRestaurant.phone}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedRestaurant(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Cerrar detalle"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Ubicación del restaurante (sin Static Maps API para evitar 403; la ubicación se edita en el formulario con mapa dinámico) */}
            {(() => {
              const coords = getCoordinates(selectedRestaurant);
              if (coords) {
                return (
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-gradient-to-br from-orange-50 to-gray-50">
                    <div className="h-48 flex flex-col items-center justify-center px-4 text-center">
                      <svg className="w-12 h-12 text-orange-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-800">{selectedRestaurant.address || 'Ubicación guardada'}</p>
                      <p className="text-xs text-gray-500 mt-1">Editá el restaurante para ver o cambiar la ubicación en el mapa</p>
                    </div>
                    <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 flex justify-between border-t border-gray-200">
                      <span>Lat: {coords.lat.toFixed(6)}</span>
                      <span>Lng: {coords.lng.toFixed(6)}</span>
                    </div>
                  </div>
                );
              }
              return (
                <div className="bg-gray-100 rounded-lg p-6 text-center text-gray-500">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm">Sin coordenadas guardadas</p>
                  <p className="text-xs mt-1">Editá el restaurante para agregar ubicación en el mapa</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========== LISTA DE RESTAURANTES (CARDS) ========== */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRestaurants.map(restaurant => {
          const coords = getCoordinates(restaurant);
          return (
            <div key={restaurant._id}
                 className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white">

              {/* Ubicación en la card (placeholder sin Static Maps API para evitar 403) */}
              {coords ? (
                <div
                  className="h-32 bg-gradient-to-br from-orange-50 to-orange-100 cursor-pointer relative group flex items-center justify-center"
                  onClick={() => setSelectedRestaurant(restaurant)}
                  title="Ver ubicación en detalle"
                >
                  <div className="text-center p-3">
                    <svg className="w-10 h-10 mx-auto text-orange-500 mb-1 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-xs text-orange-700 font-medium truncate max-w-full px-2">{restaurant.address || 'Ver ubicación'}</p>
                    <span className="text-xs text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle</span>
                  </div>
                </div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-8 h-8 mx-auto text-orange-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-xs text-orange-400">Sin ubicación</p>
                  </div>
                </div>
              )}

              {/* Contenido de la card */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg text-gray-900 truncate flex-1 mr-2">
                    {restaurant.name}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    restaurant.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {restaurant.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-1 truncate" title={restaurant.address}>
                  {restaurant.address}
                </p>
                {restaurant.phone && (
                  <p className="text-sm text-gray-500 mb-1">{restaurant.phone}</p>
                )}
                <p className="text-sm text-gray-400 mb-3">
                  {restaurant.menu?.length || 0} items en menú
                  {coords && (
                    <span className="ml-2 text-green-500" title="Tiene ubicación en mapa">
                      <svg className="w-3.5 h-3.5 inline" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </p>

                {/* Botones de acción */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => editRestaurant(restaurant)}
                    className="flex-1 text-blue-600 hover:text-blue-800 text-sm font-medium py-1.5 px-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Editar
                  </button>
                  {coords && (
                    <button
                      onClick={() => setSelectedRestaurant(restaurant)}
                      className="text-orange-600 hover:text-orange-800 text-sm font-medium py-1.5 px-2 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
                      title="Ver ubicación"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                  {!restaurant.isActive && (
                    <button
                      onClick={() => confirmDeleteRestaurant(restaurant)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium py-1.5 px-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      title="Eliminar restaurante (solo inactivos)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRestaurants.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-lg font-medium">No se encontraron restaurantes</p>
          <p className="text-sm mt-1">Ajustá los filtros o agregá uno nuevo</p>
        </div>
      )}

      {/* ========== MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ========== */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 p-3 rounded-full mr-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar Eliminación</h3>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que querés eliminar <strong>"{deleteConfirm.restaurantName}"</strong>?
              <br />
              <span className="text-red-600 text-sm font-medium">Esta acción no se puede deshacer.</span>
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, restaurantId: null, restaurantName: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeDeleteRestaurant}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantManagement;
