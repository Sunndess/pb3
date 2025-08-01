import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Gavel, Mail, Lock, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(() => setIsPageLoading(false), 500); // Simulate loading delay
    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor ingrese su correo y contraseña');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result === true) {
        navigate('/dashboard');
      } else {
        setError(result); // Mensaje personalizado (usuario inhabilitado, etc)
      }
    } catch (err: unknown) {
      // Handle fetch/network errors from Supabase or backend
      if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message?: string }).message === 'string' && (err as { message: string }).message.includes('Failed to fetch')) {
        setError('No se pudo conectar con el servidor de autenticación. Verifique su conexión a internet o intente más tarde.');
      } else {
        setError('Error al iniciar sesión. Intente nuevamente.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500 text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Login - Sistema de Gestión de Casos Legales</title>
      </Helmet>
      <div
        className="min-h-screen bg-cover bg-center relative flex items-center justify-center"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1723534042746-f6d1941e6808?w=1000&auto=format&fit=crop&q=80&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1yZWxhdGVkfDF8fHxlbnwwfHx8fHw%3D')",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="container mx-auto flex items-center justify-center relative z-10">
          <div className="max-w-md w-full space-y-8 bg-white p-6 rounded-lg shadow-lg">
            <div>
              <div className="flex justify-center">
                <div className="h-16 w-16 bg-blue-800 text-white rounded-full flex items-center justify-center">
                  <Gavel size={36} />
                </div>
              </div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Sistema de Gestión de Casos Legales
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Inicie sesión en su cuenta
              </p>
            </div>
            
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="rounded-md shadow-sm space-y-4">
                <Input
                  label="Correo electrónico"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail size={18} className="text-gray-400" />}
                  placeholder="correo@ejemplo.com"
                  fullWidth
                />
                
                <Input
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock size={18} className="text-gray-400" />}
                  placeholder="••••••••"
                  fullWidth
                />
              </div>

              <div>
                <Button
                  type="submit"
                  isLoading={isLoading}
                  fullWidth
                >
                  Iniciar sesión
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}