import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Asumsikan API_BASE_URL sudah diatur di environment variable, mirip dengan App.jsx
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'; // Fallback jika VITE_API_BASE_URL tidak ada

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate(); // Hook for navigation

  // If onLoginSuccess is not provided (e.g. direct access to /login page when already logged in and App redirects)
  // this component might not need to do much if App handles the redirect.
  // However, it's good practice to ensure onLoginSuccess is always called.

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); 
    setIsLoading(true);

    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `Terjadi kesalahan: ${response.status}`);
        setIsLoading(false);
        return;
      }

      if (data.success) {
        console.log('Login berhasil:', data);
        // The onLoginSuccess prop (passed from App.jsx) will handle
        // setting localStorage, updating auth state, and navigating.
        if (onLoginSuccess) {
          onLoginSuccess(data); 
        } else {
          // Fallback if onLoginSuccess is not provided, though App.jsx should always provide it.
          // This scenario is less likely with the current App.jsx setup.
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('userData', JSON.stringify(data.user));
          navigate('/'); // Fallback navigation
        }
      } else {
        setError(data.error || 'Login gagal. Silakan coba lagi.');
      }
    } catch (err) {
      console.error('Error saat login:', err);
      setError('Tidak dapat terhubung ke server. Silakan coba lagi nanti.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 font-inter">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-center text-slate-800">
          Login Helpdesk
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Alamat Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors duration-150"
            >
              {isLoading ? 'Memproses...' : 'Masuk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
