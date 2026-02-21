import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function RoleGuard({ user, requiredPermission, children }) {
  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-[#3E4C59]">Cargando usuario...</p>
      </div>
    );
  }

  const hasAccess = requiredPermission(user.role);

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-6 bg-yellow-50 border border-yellow-300 rounded-lg flex gap-4">
          <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-800">Acceso Denegado</h3>
            <p className="text-sm text-yellow-700 mt-1">
              No tienes permisos para acceder a esta sección. Contacta a un administrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}