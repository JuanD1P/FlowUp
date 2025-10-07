import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import Login from './Components/Login';
import Registro from './Components/Registro';
import Inicio from './Components/Inicio';
import NotFound from './Components/NotFound';
import ProtectedRoute from './Components/PrivateRoute';
import Admin from './Components/Admin';
import Navbar from './Components/Navbar';
import Footer from './Components/Footer';
import InicioEntrenador from './Components/InicioEntrenador';
import PerfilNadador from './Components/PerfilNadador';
import EntrenamientoNadador from './Components/EntrenamientoNadador';
import Recomendaciones from './Components/Recomendaciones';
import AñadirNadadores from './Components/AñadirNadadores';
import VerEquipo from './Components/VerEquipo';
import EquiposAdmin from './Components/EquiposAdmin';
import VerEquipAdmin from './Components/VerEquipAdmin';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/userlogin" />} />

                <Route path="/userlogin" element={<Login />} />
                <Route path="/Registro" element={<Registro />} />

                <Route element={<LayoutWithNavbar />}>
                {/* RUTAS PARA EL ADMINISTRADOR */}

                    <Route path="/Admin" element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                            <Admin />
                        </ProtectedRoute>
                    } />

                    <Route path="/EquiposAdmin" element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                            <EquiposAdmin />
                        </ProtectedRoute>
                    } />

                    <Route path="/VerEquipAdmin" element={
                        <ProtectedRoute allowedRoles={['ADMIN']}>
                            <VerEquipAdmin />
                        </ProtectedRoute>
                    } />

                {/* RUTAS PARA LOS NADADORES */}   

                
                    <Route path="/Inicio" element={
                        <ProtectedRoute allowedRoles={['USER']}>
                            <Inicio />
                        </ProtectedRoute>
                    } />

                    <Route path="/PerfilNadador" element={
                        <ProtectedRoute allowedRoles={['USER']}>
                            <PerfilNadador />
                        </ProtectedRoute>
                    } />

                    <Route path="/EntrenamientoNadador" element={
                        <ProtectedRoute allowedRoles={['USER']}>
                            <EntrenamientoNadador />
                        </ProtectedRoute>
                    } />

                    <Route path="/Recomendaciones" element={
                        <ProtectedRoute allowedRoles={['USER']}>
                            <Recomendaciones />
                        </ProtectedRoute>
                    } />

                {/* RUTAS PARA LOS ENTRENADORES */}   

                
                    <Route path="/InicioEntrenador" element={
                        <ProtectedRoute allowedRoles={['USEREN']}>
                            <InicioEntrenador />
                            
                        </ProtectedRoute>
                    } />
                    <Route path="/AñadirNadadores" element={
                        <ProtectedRoute allowedRoles={['USEREN']}>
                            <AñadirNadadores />
                        </ProtectedRoute>
                    } />
                    <Route path="/perfil/:id" element={
                        <ProtectedRoute allowedRoles={['USEREN']}>
                            <PerfilNadador />
                        </ProtectedRoute>
                    } />
                    <Route path="/VerEquipo" element={
                        <ProtectedRoute allowedRoles={['USEREN']}>
                            <VerEquipo />
                        </ProtectedRoute>
                    } />

                    </Route>

                {/* RUTA NO ENCONTRADA */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    );
}


//Navbar
function LayoutWithNavbar() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}

export default App;
