// src/Components/__tests__/Login.test.tsx
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';


import Login from '../Login';


vi.mock('../../firebase/client', () => ({
  auth: {},
  db: {},
}));


vi.mock('firebase/auth', () => {
  const setCustomParameters = vi.fn();
  return {
    GoogleAuthProvider: vi.fn().mockImplementation(() => ({ setCustomParameters })),
    signInWithEmailAndPassword: vi
      .fn()
      .mockResolvedValue({ user: { getIdToken: async () => 'tok' } }),
    signInWithPopup: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    getAdditionalUserInfo: vi.fn(),
    getAuth: vi.fn(() => ({})),
  };
});



vi.mock('axios', () => {
  const post = vi.fn();
  const defaults = { withCredentials: false };
  return { default: { post, defaults } };
});


vi.mock('../DOCSS/Login.css', () => ({ default: {} }), { virtual: true });
vi.mock('../ImagenesP/ImagenesLogin/flowuplogo.png', () => ({ default: 'logo.png' }), { virtual: true });
vi.mock('/ImagenFondos/fondo.png', () => ({ default: 'fondo.png' }), { virtual: true });


const originalLocation = window.location;
beforeAll(() => {

  vi.stubGlobal('crypto', { randomUUID: () => 'test-id' } as any);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  } as any);

  delete (window as any).location;

  (window as any).location = { ...originalLocation, reload: vi.fn() };
});

afterAll(() => {
  window.location = originalLocation;
});

// =====================
// TESTS
// =====================
describe('Login', () => {
  it('muestra error si envío el formulario vacío', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    expect(
      await screen.findByText(/Todos los campos deben ser completados/i)
    ).toBeInTheDocument();
  });

  it('login exitoso → llama al backend de sesión con el idToken', async () => {
    (axios as any).post.mockResolvedValue({ data: { ok: true, rol: 'USER' } });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText(/Correo/i), 'ana@example.com');
    await userEvent.type(screen.getByPlaceholderText(/Contraseña/i), 'Abc123');
    await userEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    await waitFor(() => {
      expect((axios as any).post).toHaveBeenCalledWith(
        'http://localhost:3000/auth/session',
        { idToken: 'tok' }
      );
    });
  });

  it('credenciales erróneas → muestra toast de “Contraseña incorrecta”', async () => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    (signInWithEmailAndPassword as any).mockRejectedValueOnce({
      code: 'auth/wrong-password',
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText(/Correo/i), 'ana@example.com');
    await userEvent.type(screen.getByPlaceholderText(/Contraseña/i), 'mala');
    await userEvent.click(screen.getByRole('button', { name: /Ingresar/i }));

    expect(
      await screen.findByText(/Contraseña incorrecta/i)
      
    ).toBeInTheDocument();
  });
});
