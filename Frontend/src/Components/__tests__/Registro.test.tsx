import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// componente
import Registro from '../Registro';

// =====================
// MOCKS
// =====================

// firebase/client
vi.mock('../../firebase/client', () => ({
  auth: {},
  db: {},
}));

// firebase/auth
vi.mock('firebase/auth', () => {
  return {
    GoogleAuthProvider: vi.fn().mockImplementation(() => ({
      setCustomParameters: vi.fn(),
    })),
    createUserWithEmailAndPassword: vi.fn(),
    updateProfile: vi.fn(),
    signInWithPopup: vi.fn(),
    fetchSignInMethodsForEmail: vi.fn(),
    getAdditionalUserInfo: vi.fn(),
    getAuth: vi.fn(() => ({})),
  };
});

// firebase/firestore
vi.mock('firebase/firestore', () => {
  return {
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
    serverTimestamp: vi.fn(),
  };
});

// assets
vi.mock('../DOCSS/Registro.css', () => ({ default: {} }), { virtual: true });
vi.mock('../ImagenesP/ImagenesLogin/flowuplogo.png', () => ({ default: 'logo.png' }), { virtual: true });
vi.mock('/ImagenFondos/fondo.png', () => ({ default: 'fondo.png' }), { virtual: true });

// =====================
// STUBS GLOBALES
// =====================
beforeAll(() => {
  vi.stubGlobal('crypto', { randomUUID: () => 'test-id' } as any);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// =====================
// TESTS
// =====================
describe('Registro (sin checkbox)', () => {
  it('muestra error si envío el formulario vacío', async () => {
    render(
      <MemoryRouter>
        <Registro />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(
      await screen.findByText(/Todos los campos son obligatorios/i)
    ).toBeInTheDocument();
  });

  it('registro exitoso con correo y contraseña', async () => {
    const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
    const { setDoc } = await import('firebase/firestore');

    (createUserWithEmailAndPassword as any).mockResolvedValueOnce({
      user: { uid: '123', getIdToken: async () => 'tok' },
    });
    (updateProfile as any).mockResolvedValueOnce();
    (setDoc as any).mockResolvedValueOnce();

    render(
      <MemoryRouter>
        <Registro />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText(/Nombre completo/i), 'Ana Gómez');
    await userEvent.type(screen.getByPlaceholderText(/Email/i), 'ana@example.com');
    await userEvent.type(screen.getByPlaceholderText(/^Contraseña$/i), 'Abc123');
    await userEvent.type(screen.getByPlaceholderText(/Confirmar Contraseña/i), 'Abc123');

    await userEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/Registro exitoso/i)
    ).toBeInTheDocument();
  });

  it('registro falla si el correo ya existe', async () => {
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    (createUserWithEmailAndPassword as any).mockRejectedValueOnce({
      code: 'auth/email-already-in-use',
    });

    render(
      <MemoryRouter>
        <Registro />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText(/Nombre completo/i), 'Ana Gómez');
    await userEvent.type(screen.getByPlaceholderText(/Email/i), 'ana@example.com');
    await userEvent.type(screen.getByPlaceholderText(/^Contraseña$/i), 'Abc123');
    await userEvent.type(screen.getByPlaceholderText(/Confirmar Contraseña/i), 'Abc123');

    await userEvent.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(
      await screen.findByText(/Este correo ya está en uso/i)
    ).toBeInTheDocument();
  });
});

