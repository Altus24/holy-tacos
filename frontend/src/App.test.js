import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Mock de los providers para aislar el routing
jest.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: () => false,
    hasRole: () => false,
    loading: false
  })
}));

jest.mock('./context/CartContext', () => ({
  CartProvider: ({ children }) => children
}));

jest.mock('./context/SocketContext', () => ({
  SocketProvider: ({ children }) => children
}));

function renderApp() {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

describe('App', () => {
  it('renderiza sin romperse', () => {
    renderApp();
    expect(document.body).toBeTruthy();
  });

  it('incluye la app dentro del router', () => {
    const { container } = renderApp();
    expect(container.querySelector('.App') || container.firstChild).toBeTruthy();
  });
});
