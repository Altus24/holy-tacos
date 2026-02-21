# Propuesta de mejoras: Gestión de Drivers (Panel Admin)

Documento de análisis y propuesta para la sección de Drivers en el panel de administración.  
**Archivos principales:** `frontend/src/components/admin/DriverManagement.js`, `DriverCountsDashboard.js`.  
**Nota:** No existen actualmente `DriversManagement.js`, `DriverTable.js`, `DriverFilters.js` ni `DriverVerificationActions.js`; toda la lógica está en `DriverManagement.js` (~847 líneas).

---

## 1. Resumen del estado actual

### Lo que está bien
- **Flujo de verificación** claro: pending → approved/rejected, con historial y notas.
- **Regla de negocio** respetada en backend: no se puede activar sin `verificationStatus === 'approved'`.
- **Pestañas** por estado (Activos, Pendientes, Aprobados, Rechazados, Todos) con conteos desde API.
- **Conteos** centralizados en `GET /api/admin/drivers/counts` y uso de `?status=` en listado.
- **Vista Rechazados** dedicada con columnas específicas (motivo, fecha) y mensaje vacío claro.
- **Modales** de verificación (aprobar/rechazar/revocar) y de detalles con historial.

### Lo que se puede mejorar
- **Monolito:** un solo componente de ~847 líneas; difícil de mantener y testear.
- **Sin paginación:** se cargan todos los drivers por pestaña; no escala.
- **Loading genérico:** solo texto "Cargando drivers..."; sin skeletons ni feedback por acción.
- **Búsqueda limitada:** solo nombre/email en cliente; sin filtros por zona, vehículo, etc.
- **Sin acciones en masa:** aprobar/rechazar/activar de a uno.
- **Badges con clases dinámicas:** `bg-${tab.color}-100` puede no generar CSS con Tailwind.
- **Doble fetch al cambiar pestaña:** `loadDrivers(activeTab)` + `loadCounts()` ya en refresh; al montar se hace loadCounts y loadDrivers por separado.
- **Accesibilidad:** botones sin `aria-label` en algunos casos, modales sin foco trap.
- **Responsive:** tablas anchas sin priorización de columnas en móvil.

---

## 2. Mejoras por categoría

### 2.1 Gestión (Management)

| Mejora | Prioridad | Descripción |
|--------|-----------|-------------|
| Filtros avanzados | **Alta** | Búsqueda por zona (`workingAreas`), tipo de vehículo, disponibilidad. Backend: ampliar `GET /drivers?status=&zone=&vehicle=&available=` |
| Paginación | **Alta** | Evitar cargar todos los drivers. Backend: `?page=1&limit=20`, respuesta `{ data, total, page, totalPages }`. Frontend: componente de paginación y estado `page`. |
| Búsqueda en servidor | **Alta** | Enviar `?q=nombre` al backend y filtrar con regex/index en MongoDB en lugar de filtrar solo en cliente. |
| Exportar lista (CSV/Excel) | **Media** | Botón "Exportar" que genere CSV con columnas principales (nombre, email, estado, teléfono, zona). Puede ser solo frontend con los datos ya cargados o endpoint `GET /api/admin/drivers/export`. |
| Ordenación por columnas | **Media** | Cabeceras de tabla clicables para ordenar por nombre, fecha alta, rating, etc. Backend: `?sort=createdAt&order=desc`. |
| Acciones en masa | **Media** | Checkbox por fila + "Seleccionar todos" + barra flotante "Aprobar selección" / "Rechazar selección" (con modal de motivo). Backend: `PUT /api/admin/drivers/bulk-verify` con `{ driverIds: [], status, notes }`. |
| Distribución de columnas | **Baja** | En desktop mantener columnas actuales; en móvil usar tarjetas (cards) por driver en lugar de tabla, o tabla con columnas prioritarias (Nombre, Estado, Acciones). |

**Código sugerido – Backend paginación y búsqueda (adminController.js):**

```javascript
// En getAllDrivers: soportar page, limit, q, sort, order
const getAllDrivers = async (req, res) => {
  try {
    const status = (req.query.status || 'all').toLowerCase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit, 10) || 20));
    const q = (req.query.q || '').trim();
    const sortField = req.query.sort || 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;

    const baseFilter = { role: 'driver' };
    const validStatuses = ['all', 'pending', 'approved', 'rejected'];
    const statusFilter = validStatuses.includes(status) ? status : 'all';

    if (statusFilter === 'all') {
      baseFilter['driverProfile.verificationStatus'] = { $in: ['approved', 'pending'] };
    } else {
      baseFilter['driverProfile.verificationStatus'] = statusFilter;
    }

    if (q) {
      baseFilter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [drivers, total] = await Promise.all([
      User.find(baseFilter).select('-password').sort({ [sortField]: order }).skip(skip).limit(limit).lean(),
      User.countDocuments(baseFilter)
    ]);

    // Normalizar isActive en cada driver para respuesta
    const data = drivers.map(d => {
      if (d.driverProfile && d.driverProfile.isActive === undefined) {
        d.driverProfile = { ...d.driverProfile, isActive: true };
      }
      return d;
    });

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error obteniendo drivers:', error);
    res.status(500).json({ success: false, message: 'Error al obtener lista de drivers' });
  }
};
```

**Código sugerido – Componente DriverFilters.js (nuevo):**

```javascript
// frontend/src/components/admin/DriverFilters.js
import React from 'react';

/**
 * Filtros y búsqueda para la lista de drivers.
 * @param {string} searchTerm - Valor del buscador
 * @param {function} onSearchChange - (value) => void
 * @param {string} zoneFilter - Zona seleccionada (opcional)
 * @param {function} onZoneChange - (value) => void
 * @param {boolean} loading - Deshabilita inputs durante carga
 */
const DriverFilters = ({ searchTerm, onSearchChange, zoneFilter, onZoneChange, loading }) => {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        type="search"
        placeholder="Buscar por nombre, email o teléfono..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        disabled={loading}
        className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-50"
        aria-label="Buscar drivers"
      />
      {/* Futuro: selector de zona si el backend soporta workingAreas */}
      {onZoneChange && (
        <select
          value={zoneFilter}
          onChange={(e) => onZoneChange(e.target.value)}
          disabled={loading}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          aria-label="Filtrar por zona"
        >
          <option value="">Todas las zonas</option>
          {/* Opciones dinámicas desde API o constante */}
        </select>
      )}
    </div>
  );
};

export default DriverFilters;
```

---

### 2.2 Flujo (Workflow)

| Mejora | Prioridad | Descripción |
|--------|-----------|-------------|
| Imposibilidad de activar sin verificación | **Alta** | Ya está en backend (toggleDriverAvailability exige approved). Reforzar en frontend: deshabilitar botón "Activar" con tooltip "Primero debe aprobar la verificación" si no es approved. |
| Modal de rechazo más claro | **Alta** | Dejar explícito que el motivo es obligatorio; contador de caracteres (ej. 50/500); mensaje de advertencia tipo "El driver recibirá este motivo por email/notificación". |
| Confirmación explícita al aprobar | **Media** | Antes de "Aprobar Driver", checklist opcional (ej. "Documentos revisados", "Datos correctos") o doble botón "Revisar documentos" → "Aprobar". |
| Pasos intermedios | **Baja** | Para flujos más complejos: "Solicitar más datos" (estado intermedio) antes de aprobar/rechazar. Requiere cambio de modelo (ej. verificationStatus: 'pending_docs'). |
| Atajos de teclado en modales | **Media** | Enter para confirmar, Escape para cerrar; focus trap dentro del modal. |

**Código sugerido – Deshabilitar Activar si no aprobado (en renderActions):**

```jsx
{/* APPROVED: solo entonces mostrar Activar disponibilidad */}
{vStatus === 'approved' && (
  <button
    onClick={() => toggleAvailability(driver)}
    className={...}
    title={driver.driverProfile?.isAvailable ? 'Desactivar disponibilidad' : 'Activar disponibilidad'}
  >
    {driver.driverProfile?.isAvailable ? 'Desactivar' : 'Activar'}
  </button>
)}
{/* PENDING / REJECTED: no se muestra botón Activar; opcionalmente botón deshabilitado con tooltip */}
{vStatus !== 'approved' && (
  <span
    className="inline-flex px-2 py-1 text-xs rounded bg-gray-200 text-gray-500 cursor-not-allowed"
    title="Solo los drivers aprobados pueden activar disponibilidad"
  >
    Activar (no aprobado)
  </span>
)}
```

**Código sugerido – Modal de rechazo con contador y aviso:**

```jsx
{verifyModal.action === 'reject' && (
  <>
    <p className="text-sm text-red-700 mb-2">
      El driver será desactivado y podrá ver este motivo. <strong>El motivo es obligatorio.</strong>
    </p>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del rechazo *</label>
      <textarea
        value={verifyNotes}
        onChange={(e) => setVerifyNotes(e.target.value)}
        placeholder="Ej.: Documentación incompleta, licencia vencida..."
        rows={3}
        maxLength={500}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        aria-required="true"
      />
      <p className="text-xs text-gray-500 mt-1">{verifyNotes.length}/500</p>
    </div>
  </>
)}
```

---

### 2.3 Recursos (UX / Accesibilidad)

| Mejora | Prioridad | Descripción |
|--------|-----------|-------------|
| Skeleton en lugar de "Cargando drivers..." | **Alta** | Mientras `loading`, mostrar tabla con filas skeleton (animación pulse) con mismo número de columnas. |
| Toast/notificaciones | **Alta** | Sustituir o complementar el mensaje en bloque (verde/rojo) por un toast que no ocupe espacio fijo (ej. react-hot-toast o componente propio). |
| Badges con clases fijas | **Alta** | Evitar `bg-${tab.color}-100`; usar clases completas por clave (ej. `pending: 'bg-yellow-100 text-yellow-700'`) para que Tailwind las incluya. |
| Estados vacíos diferenciados | **Media** | Ilustración o icono por pestaña (pendientes, rechazados, etc.) y CTA si aplica ("Ir a Todos"). |
| Accesibilidad: aria y teclado | **Alta** | Botones con `aria-label`; modales con `aria-modal="true"`, `role="dialog"`, y foco inicial en el primer campo o botón; cerrar con Escape. |
| Responsive: cards en móvil | **Media** | En viewport &lt; 768px, en lugar de tabla mostrar lista de cards (avatar, nombre, estado, botón "Ver" / "Acciones"). |
| Tooltips en iconos/acciones | **Media** | En botones "Revocar", "Inactivar", etc., tooltip que explique la consecuencia. |

**Código sugerido – Skeleton de tabla (DriverTableSkeleton.js):**

```javascript
// frontend/src/components/admin/DriverTableSkeleton.js
import React from 'react';

const DriverTableSkeleton = ({ rows = 5, columns = 7 }) => (
  <div className="overflow-x-auto animate-pulse">
    <table className="min-w-full bg-white border rounded-lg">
      <thead className="bg-gray-50">
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-4 py-3">
              <div className="h-4 bg-gray-200 rounded w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={colIndex} className="px-4 py-3">
                <div className={`h-4 bg-gray-200 rounded ${colIndex === 0 ? 'w-32' : 'w-24'}`} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DriverTableSkeleton;
```

**Código sugerido – Badges con clases fijas (evitar dinámicas):**

```jsx
const TAB_STYLES = {
  active: { badge: 'bg-blue-100 text-blue-700' },
  pending: { badge: 'bg-yellow-100 text-yellow-700' },
  approved: { badge: 'bg-green-100 text-green-700' },
  rejected: { badge: 'bg-red-100 text-red-700' },
  all: { badge: 'bg-gray-100 text-gray-700' }
};

// En el map de tabs:
<span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
  tab.key === 'pending' && tab.count > 0 ? 'bg-red-500 text-white' : TAB_STYLES[tab.key]?.badge ?? 'bg-gray-100 text-gray-700'
}`}>
  {tab.count}
</span>
```

---

### 2.4 Optimización (Performance y código)

| Mejora | Prioridad | Descripción |
|--------|-----------|-------------|
| Extraer custom hook useDrivers | **Alta** | Hook `useDrivers(activeTab)` que devuelva `{ drivers, loading, error, refresh, pagination }` y encapsule loadDrivers, loadCounts, refreshAfterAction. Así DriverManagement solo orquesta UI. |
| Extraer componentes: DriverTable, DriverRejectedTable, DriverVerificationModal | **Alta** | Reducir DriverManagement a contenedor; tabla normal y tabla rechazados como componentes que reciben `drivers`, `onAction`, `getVerificationStatus`, etc. |
| Paginación en frontend | **Alta** | Como se indicó antes; reduce datos en memoria y re-renders. |
| React.memo en filas de tabla | **Media** | Componente `DriverRow` memoizado con comparación por `driver._id` y props de callbacks estables (useCallback en padre). |
| Evitar doble request al montar | **Media** | Al montar, hacer una sola carga: o bien obtener counts dentro de la primera respuesta de listado, o cargar counts y list en paralelo con `Promise.all` en un único efecto. |
| Virtualización de lista | **Baja** | Si en el futuro hay listas de cientos de filas, usar react-window o react-virtualized solo para la tabla; con paginación 20–50 por página suele no ser necesario. |
| Caché de conteos | **Baja** | Tras una acción, actualizar conteos de forma optimista (sumar/restar 1) en lugar de refetch, o cachear con stale-while-revalidate. |

**Estructura de archivos recomendada:**

```
frontend/src/
  components/admin/
    DriverManagement.js       → Contenedor: estado de pestaña, modales, orquestación
    DriverCountsDashboard.js → (existente)
    DriverFilters.js         → Buscador + filtros (nuevo)
    DriverTable.js           → Tabla para approved/pending/all/active (nuevo)
    DriverRejectedTable.js   → Tabla específica rechazados (nuevo)
    DriverTableSkeleton.js   → Skeleton (nuevo)
    DriverVerificationModal.js → Modal aprobar/rechazar/revocar (nuevo)
    DriverDetailsModal.js    → Extraer del actual DriverManagement (existente, mover)
  hooks/
    useDrivers.js            → Hook: fetch por tab, pagination, refresh (nuevo)
```

**Código sugerido – useDrivers.js (esqueleto):**

```javascript
// frontend/src/hooks/useDrivers.js
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const getStatusForTab = (tab) => (tab === 'active' || tab === 'all') ? (tab === 'active' ? 'approved' : 'all') : tab;

export function useDrivers(activeTab, options = {}) {
  const { pageSize = 20 } = options;
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const loadDrivers = useCallback(async (tab, page = 1) => {
    const status = getStatusForTab(tab);
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`/api/admin/drivers`, {
        params: { status, page, limit: pageSize }
      });
      let data = res.data?.data ?? [];
      if (tab === 'active') {
        data = data.filter(d => d.driverProfile?.isActive !== false);
      }
      setDrivers(data);
      setPagination(res.data?.pagination ?? { page: 1, total: data.length, totalPages: 1 });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al cargar drivers');
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadDrivers(activeTab, 1);
  }, [activeTab, loadDrivers]);

  const refresh = useCallback(() => {
    loadDrivers(activeTab, pagination.page);
  }, [activeTab, pagination.page, loadDrivers]);

  return { drivers, loading, error, pagination, refresh, setPage: (p) => loadDrivers(activeTab, p) };
}
```

---

## 3. Backend: cambios recomendados

- **GET /api/admin/drivers:** añadir query params `page`, `limit`, `q` (búsqueda), `sort`, `order`. Respuesta incluir `pagination: { page, limit, total, totalPages }`.
- **GET /api/admin/drivers (opcional):** `zone`, `vehicleType`, `available` para filtros avanzados cuando se implementen.
- **PUT /api/admin/drivers/bulk-verify (opcional):** cuerpo `{ driverIds: string[], status: 'approved'|'rejected', notes?: string }` para acciones en masa.
- **GET /api/admin/drivers/export (opcional):** devolver CSV o permitir que el frontend genere CSV con los datos ya paginados.

---

## 4. Lista priorizada de implementación

Implementar en este orden para máximo impacto con esfuerzo acotado:

1. **Alta – Paginación (backend + frontend)**  
   Backend: `page`, `limit`, respuesta con `pagination`. Frontend: estado `page`, botones/select "Página X de Y", llamar API con `page`.

2. **Alta – Skeleton de carga**  
   Reemplazar "Cargando drivers..." por `DriverTableSkeleton` en `DriverManagement.js`.

3. **Alta – Badges con clases fijas**  
   En `DriverManagement.js`, reemplazar `bg-${tab.color}-100` por objeto `TAB_STYLES` con clases completas.

4. **Alta – Búsqueda en servidor**  
   Backend: param `q` en `getAllDrivers`. Frontend: pasar `q` desde el input de búsqueda (y opcionalmente debounce 300 ms).

5. **Alta – Custom hook useDrivers y refactor**  
   Crear `useDrivers.js`; usar en `DriverManagement`; extraer al menos `DriverVerificationModal` y `DriverTable` a archivos propios.

6. **Media – Modal de rechazo mejorado**  
   Contador de caracteres, texto de aviso de que el driver verá el motivo.

7. **Media – DriverFilters componente**  
   Crear `DriverFilters.js` con búsqueda (y luego zona/vehículo si el backend lo soporta); usarlo en `DriverManagement`.

8. **Media – Toast en lugar de mensaje en bloque**  
   Añadir react-hot-toast (o similar) y mostrar éxito/error de acciones con toast; opcionalmente mantener el bloque para errores graves.

9. **Media – Accesibilidad modales**  
   `aria-modal`, `role="dialog"`, foco inicial, Escape para cerrar, y `aria-label` en botones de acción.

10. **Media – Acciones en masa (bulk)**  
    Checkbox por fila, barra de acciones, endpoint `bulk-verify`; útil cuando haya muchos pendientes.

11. **Baja – Ordenación por columnas**  
    Backend `sort`/`order`; frontend cabeceras clicables.

12. **Baja – Exportar CSV**  
    Botón que genere CSV en cliente con los drivers visibles (o endpoint de export).

13. **Baja – Vista responsive en cards**  
    En móvil, mostrar cards en lugar de tabla.

---

**Resumen:** El estado actual es funcional y las reglas de negocio están bien aplicadas. Las mejoras de mayor impacto son paginación, skeleton, badges correctos, búsqueda en servidor y refactor con hook + componentes extraídos; después, UX (modal rechazo, toasts, accesibilidad) y opcionalmente acciones en masa y exportación.
