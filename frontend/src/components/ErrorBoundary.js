/**
 * Error Boundary global: captura errores de React y muestra UI de fallback.
 * Incluye botón para reintentar (recargar) y mensaje amigable.
 */
import React from 'react';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Algo salió mal</h1>
            <p className="text-gray-600 mb-6">
              Ocurrió un error inesperado. Podés recargar la página o volver al inicio.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700"
              >
                Recargar página
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300"
              >
                Ir al inicio
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
