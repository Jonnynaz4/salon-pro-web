import React, { useState } from 'react';
import { supabase } from '../../api/supabase';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [tema] = useState(() => {
    const g = localStorage.getItem('atelier-tema');
    return g ? JSON.parse(g) : {
      fondo: '#0A0A0A',
      componente: '#141414',
      secundario: '#1A1A1A',
      acento: '#C5A059',
      borde: '#222222',
      textoGeneral: '#CBD5E1',
      textoComponente: '#FFFFFF',
      textoAcento: '#000000',
      fuente: 'serif',
      tamanioBase: '14'
    };
  });

  const fuentesMap = {
    serif: 'ui-serif, Georgia, serif',
    sans: 'ui-sans-serif, system-ui, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, monospace',
    display: 'Playfair Display, serif'
  };

  const estilosVariables = {
    '--color-fondo': tema.fondo,
    '--color-componente': tema.componente,
    '--color-secundario': tema.secundario,
    '--color-acento': tema.acento,
    '--color-borde': tema.borde,
    '--color-texto-general': tema.textoGeneral,
    '--color-texto-componente': tema.textoComponente,
    '--color-texto-acento': tema.textoAcento,
    '--fuente-p': fuentesMap[tema.fuente] || fuentesMap.serif,
    'fontSize': `${tema.tamanioBase}px`
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Acceso denegado.");
    setCargando(false);
  };

  return (
    <div style={estilosVariables} className="h-screen w-full flex items-center justify-center relative overflow-hidden font-[family-name:var(--fuente-p)]">
      
      {/* IMAGEN DE FONDO (WALLPAPER) */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[10s] hover:scale-110"
        style={{ backgroundImage: "url('/wallpaper.jpg')" }} 
      >
        {/* Capa de oscurecimiento y desenfoque para que resalte el login */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
      </div>

      {/* CONTENEDOR PRINCIPAL BASADO EN EL DISEÑO DE LA IMAGEN */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] w-full max-w-md max-h-[90vh] flex flex-col justify-center relative z-10 animate-in fade-in zoom-in duration-1000 overflow-hidden">
        
        {/* LOGO EN ORO Y TEXTO */}
        <div className="text-center mb-8 flex flex-col items-center">
          <img 
            src="/logo.png" 
            alt="Jonny Delgadillo Logo" 
            className="h-[18vh] md:h-[22vh] max-h-[180px] w-auto object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" 
          />
          <div className="h-px w-20 bg-gradient-to-r from-transparent via-[var(--color-acento)] to-transparent opacity-40 mt-6"></div>
          <p className="text-[0.6em] font-black text-[var(--color-acento)] uppercase tracking-[0.5em] mt-4 opacity-80">
            Administracion de Citas
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <input 
              type="email" 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 font-bold text-sm text-white outline-none focus:border-[var(--color-acento)] focus:bg-white/10 transition-all placeholder:text-white/20"
              placeholder="USUARIO"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <input 
              type="password" 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 font-bold text-sm text-white outline-none focus:border-[var(--color-acento)] focus:bg-white/10 transition-all placeholder:text-white/20"
              placeholder="CONTRASEÑA"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="py-2 animate-bounce">
               <p className="text-rose-500 text-[0.6em] font-black text-center uppercase tracking-widest">{error}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={cargando}
            className="w-full py-5 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase text-[0.7em] tracking-[0.4em] rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.97] transition-all disabled:opacity-20 mt-2"
          >
            {cargando ? '...' : 'INICIAR SESIÓN'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-[0.5em] text-white/20 uppercase font-black tracking-[0.4em]">
            Jonny Delgadillo Hair Salon • 2026
          </p>
        </div>
      </div>
    </div>
  );
};