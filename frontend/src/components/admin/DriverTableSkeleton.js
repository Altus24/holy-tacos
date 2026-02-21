// Skeleton de tabla para estado de carga en la gestión de drivers
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
                <div
                  className={`h-4 bg-gray-200 rounded ${colIndex === 0 ? 'w-32' : 'w-24'}`}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DriverTableSkeleton;
