import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Admin from '../Admin';

/* =======================
   Mocks de assets/CSS
   ======================= */
vi.mock('../DOCSS/Admin.css', () => ({ default: {} }), { virtual: true });
vi.mock('/image.png', () => ({ default: 'logo.png' }), { virtual: true });

/* =======================
   Mock react-router-dom (useNavigate)
   ======================= */
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return { ...actual, useNavigate: () => vi.fn() };
});

/* =======================
   Mock de SweetAlert2
   - devolvemos confirmación positiva por defecto
   - ejecutamos preConfirm cuando exista (eliminar)
   ======================= */
const { fire } = vi.hoisted(() => ({
  fire: vi.fn(async (opts?: any) => {
    if (opts?.preConfirm) {
      await opts.preConfirm();
    }
    return { isConfirmed: true };
  }),
}));

vi.mock('sweetalert2', () => ({
  default: { fire },
}));

/* =======================
   Mock de axios
   - hacemos que axios.create() devuelva un apiMock único
   - exponemos un getter para accederlo en los tests
   ======================= */
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
      __getApiMock: () => apiMock,
      // compatibilidad (no las usa Admin, pero evitamos errores)
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: { request: { use: vi.fn() } },
      defaults: {},
    },
  };
});

/* =======================
   beforeEach: estado inicial
   ======================= */
beforeEach(async () => {
  const axiosMod: any = (await import('axios')).default;
  const apiMock = axiosMod.__getApiMock();

  apiMock.get.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  fire.mockClear();

  // Respuesta por defecto del listado de usuarios
  apiMock.get.mockResolvedValue({
    data: [
      { id: 'u1', nombre: 'Ana', email: 'ana@example.com', rol: 'USER' },
      { id: 'u2', nombre: 'Luis', email: 'luis@example.com', rol: 'USEREN' },
    ],
  });
});

/* =======================
   TESTS
   ======================= */
describe('Admin — Gestión de usuarios', () => {
  it('cambio de rol exitoso: muestra confirmación, PUT correcto y recarga lista', async () => {
    const axiosMod: any = (await import('axios')).default;
    const apiMock = axiosMod.__getApiMock();

    apiMock.put.mockResolvedValue({ data: { ok: true } });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    // Cargó 2 usuarios
    expect(await screen.findByText(/2 usuarios/i)).toBeInTheDocument();

    // Cambiar rol de Ana (USER) a ADMIN
    const filaAna = screen.getAllByRole('row').find(r => within(r).queryByText('Ana'))!;
    const selectAna = within(filaAna).getByRole('combobox');

    await userEvent.selectOptions(selectAna, 'ADMIN');

    // Se abrió el Swal de confirmación
    expect(fire).toHaveBeenCalled();

    // PUT correcto
    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith('/api/usuarios/u1/rol', { rol: 'ADMIN' });
    });

    // Recargó la lista (GET 2 veces: carga + recarga)
    await waitFor(() => {
      expect(apiMock.get).toHaveBeenCalledTimes(2);
    });
  });

  it('si selecciono el mismo rol no hace nada (no SweetAlert, no PUT)', async () => {
    const axiosMod: any = (await import('axios')).default;
    const apiMock = axiosMod.__getApiMock();

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    expect(await screen.findByText(/2 usuarios/i)).toBeInTheDocument();

    // Luis ya es USEREN → seleccionar USEREN de nuevo
    const filaLuis = screen.getAllByRole('row').find(r => within(r).queryByText('Luis'))!;
    const selectLuis = within(filaLuis).getByRole('combobox');

    await userEvent.selectOptions(selectLuis, 'USEREN');

    expect(fire).not.toHaveBeenCalled();
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('error al cambiar rol: muestra el Swal de error y NO recarga (solo 1 GET)', async () => {
    const axiosMod: any = (await import('axios')).default;
    const apiMock = axiosMod.__getApiMock();

    apiMock.put.mockRejectedValueOnce({
      response: { data: { error: 'Intenta de nuevo' } },
    });

    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );

    expect(await screen.findByText(/2 usuarios/i)).toBeInTheDocument();

    const filaAna = screen.getAllByRole('row').find(r => within(r).queryByText('Ana'))!;
    const selectAna = within(filaAna).getByRole('combobox');

    await userEvent.selectOptions(selectAna, 'ADMIN');

    expect(fire).toHaveBeenCalled(); // confirmación

    await waitFor(() => {
      expect(apiMock.put).toHaveBeenCalledWith('/api/usuarios/u1/rol', { rol: 'ADMIN' });
    });

    // No hubo GET adicional (sigue 1 de carga inicial)
    expect(apiMock.get).toHaveBeenCalledTimes(1);
  });
});