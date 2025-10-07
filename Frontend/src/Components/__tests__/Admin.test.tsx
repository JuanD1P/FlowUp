import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Admin from '../Admin';

// ================
// Mocks de assets/CSS
// ================
vi.mock('../DOCSS/Admin.css', () => ({ default: {} }), { virtual: true });
vi.mock('/image.png', () => ({ default: 'logo.png' }), { virtual: true });

// Mock de react-router-dom (useNavigate)
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return { ...actual, useNavigate: () => vi.fn() };
});

// ================
// SweetAlert2 (hoisted para evitar errores de hoisting)
// ================
const { fire } = vi.hoisted(() => {
  return {
    fire: vi.fn(async (opts?: any) => {
      // Si se provee preConfirm (en eliminar usuario), ejecútalo.
      if (opts?.preConfirm) {
        await opts.preConfirm();
      }
      // Por defecto confirmamos en los tests que lo requieren
      return { isConfirmed: true };
    }),
  };
});

vi.mock('sweetalert2', () => ({
  default: { fire },
}));

// ================
// axios (mock completo y expuesto)
// ================
vi.mock('axios', () => {
  const apiMock = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  };
  const create = vi.fn(() => apiMock);
  return {
    default: {
      create,
      __apiMock: apiMock, // <- para acceder desde los tests
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: { request: { use: vi.fn() } },
      defaults: {},
    },
  };
});

beforeEach(() => {
  // estado por defecto: lista inicial de usuarios (USER y USEREN)
  const axiosMod = require('axios').default;
  const apiMock = axiosMod.__apiMock as {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  apiMock.get.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();

  apiMock.get.mockResolvedValue({
    data: [
      { id: 'u1', nombre: 'Ana', email: 'ana@example.com', rol: 'USER' },
      { id: 'u2', nombre: 'Luis', email: 'luis@example.com', rol: 'USEREN' },
    ],
  });

  fire.mockClear();
});

describe('Admin — Cambio de roles', () => {
  it('cambio de rol exitoso: abre confirmación, hace PUT y recarga usuarios', async () => {
    const axiosMod = require('axios').default;
    const apiMock = axiosMod.__apiMock as { put: any; get: any };

    // PUT exitoso
    apiMock.put.mockResolvedValue({ data: { ok: true } });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    // espera render con los 2 usuarios
    expect(await screen.findByText(/2 usuarios/i)).toBeInTheDocument();

    // fila de Ana (USER) → cambiar a ADMIN
    const filaAna = screen.getAllByRole('row').find((r) => within(r).queryByText('Ana'))!;
    const selectAna = within(filaAna).getByRole('combobox');

    await userEvent.selectOptions(selectAna, 'ADMIN');

    // se mostró el modal de SweetAlert
    expect(fire).toHaveBeenCalled();

    // hizo PUT al endpoint correcto con el payload correcto
    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith('/api/usuarios/u1/rol', { rol: 'ADMIN' });
    });

    // y recarga usuarios (GET llamado 2 veces: carga + recarga)
    await waitFor(() => {
      expect(apiMock.get).toHaveBeenCalledTimes(2);
    });
  });

  it('si selecciono el mismo rol no hace nada (no SweetAlert, no PUT)', async () => {
    const axiosMod = require('axios').default;
    const apiMock = axiosMod.__apiMock as { put: any };

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    expect(await screen.findByText(/2 usuarios/i)).toBeInTheDocument();

    // Luis ya es USEREN → seleccionar el mismo rol
    const filaLuis = screen.getAllByRole('row').find((r) => within(r).queryByText('Luis'))!;
    const selectLuis = within(filaLuis).getByRole('combobox');

    await userEvent.selectOptions(selectLuis, 'USEREN');

    expect(fire).not.toHaveBeenCalled();
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('error al cambiar rol: muestra alerta de error y NO recarga (solo 1 GET)', async () => {
    const axiosMod = require('axios').default;
    const apiMock = axiosMod.__apiMock as { put: any; get: any };

    // Forzamos error al actualizar rol
    apiMock.put.mockRejectedValueOnce({
      response: { data: { error: 'Intenta de nuevo' } },
    });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    expect(await screen.findByText(/2 usuarios/i)).toBeInTheDocument();

    const filaAna = screen.getAllByRole('row').find((r) => within(r).queryByText('Ana'))!;
    const selectAna = within(filaAna).getByRole('combobox');

    await userEvent.selectOptions(selectAna, 'ADMIN');

    expect(fire).toHaveBeenCalled(); // confirmación inicial

    // intento de PUT con error
    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith('/api/usuarios/u1/rol', { rol: 'ADMIN' });
    });

    // NO se llamó un GET extra (sigue en 1: carga inicial)
    expect(apiMock.get).toHaveBeenCalledTimes(1);
  });
});