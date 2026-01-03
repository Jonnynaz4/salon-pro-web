import React, { useState, useEffect } from 'react';
import { supabase } from './api/supabase';
import { Timeline } from './features/agenda/Timeline';
import { PuntoVenta } from './features/ventas/PuntoVenta';
import { Login } from './features/auth/Login';
import { PanelConfiguracion } from './features/configuracion/PanelConfiguracion'; 
import { Reportes } from './features/reportes/Reportes';

// --- COMPONENTE DE VALES (PRÉSTAMOS Y ABONOS) ---
const SeccionVales = () => {
  const [prestamos, setPrestamos] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [nuevoPrestamo, setNuevoPrestamo] = useState({ id_estilista: '', monto_total: '', fecha_vencimiento: '', notas: '' });
  const [modalAbono, setModalAbono] = useState(false);
  const [valeSeleccionado, setValeSeleccionado] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');

  useEffect(() => { fetchDatos(); }, []);

  const fetchDatos = async () => {
    const { data: est } = await supabase.from('estilistas').select('*').eq('activo', true).order('nombre');
    setEstilistas(est || []);
    const { data: pres } = await supabase.from('prestamos').select('*, estilistas(nombre)').order('fecha_vencimiento', { ascending: true });
    setPrestamos(pres || []);
  };

  const manejarGuardar = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('prestamos').insert([{
      id_estilista: nuevoPrestamo.id_estilista,
      monto_total: parseFloat(nuevoPrestamo.monto_total),
      saldo_pendiente: parseFloat(nuevoPrestamo.monto_total),
      fecha_vencimiento: nuevoPrestamo.fecha_vencimiento,
      notas: nuevoPrestamo.notas,
      estatus: 'pendiente'
    }]);
    if (!error) { setNuevoPrestamo({ id_estilista: '', monto_total: '', fecha_vencimiento: '', notas: '' }); fetchDatos(); }
  };

  const manejarAbono = async (e) => {
    e.preventDefault();
    if (!valeSeleccionado || !montoAbono) return;
    const nuevoSaldo = valeSeleccionado.saldo_pendiente - parseFloat(montoAbono);
    const { error } = await supabase.from('prestamos').update({ 
      saldo_pendiente: nuevoSaldo < 0 ? 0 : nuevoSaldo,
      estatus: nuevoSaldo <= 0 ? 'pagado' : 'parcial' 
    }).eq('id', valeSeleccionado.id);
    if (!error) { setModalAbono(false); setMontoAbono(''); setValeSeleccionado(null); fetchDatos(); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="mb-8">
        <h2 className="text-3xl font-serif italic text-[var(--color-acento)]">Vales y Préstamos</h2>
        <p className="text-[var(--color-texto-general)] opacity-60 uppercase tracking-widest mt-2">Control de deudas de personal</p>
      </header>

      <div className="bg-[var(--color-componente)] p-6 rounded-2xl shadow-xl border border-[var(--color-borde)]">
        <h3 className="font-bold text-[var(--color-acento)] mb-4 uppercase tracking-widest">Nuevo Vale</h3>
        <form onSubmit={manejarGuardar} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select className="p-3 rounded-xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] outline-none focus:ring-1 ring-[var(--color-acento)]" value={nuevoPrestamo.id_estilista} onChange={e => setNuevoPrestamo({...nuevoPrestamo, id_estilista: e.target.value})} required>
            <option value="">Estilista...</option>
            {estilistas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <input type="number" placeholder="Monto $" className="p-3 rounded-xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] outline-none focus:ring-1 ring-[var(--color-acento)]" value={nuevoPrestamo.monto_total} onChange={e => setNuevoPrestamo({...nuevoPrestamo, monto_total: e.target.value})} required />
          <input type="date" className="p-3 rounded-xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] opacity-50 outline-none focus:ring-1 ring-[var(--color-acento)]" value={nuevoPrestamo.fecha_vencimiento} onChange={e => setNuevoPrestamo({...nuevoPrestamo, fecha_vencimiento: e.target.value})} required />
          <input type="text" placeholder="Concepto" className="p-3 rounded-xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] outline-none focus:ring-1 ring-[var(--color-acento)]" value={nuevoPrestamo.notas} onChange={e => setNuevoPrestamo({...nuevoPrestamo, notas: e.target.value})} />
          <button className="bg-[var(--color-acento)] text-[var(--color-texto-acento)] rounded-xl font-black uppercase tracking-widest shadow-lg">Registrar</button>
        </form>
      </div>

      <div className="bg-[var(--color-componente)] rounded-2xl border border-[var(--color-borde)] overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-black/20 uppercase tracking-widest text-[var(--color-acento)]">
            <tr><th className="p-5">Estilista</th><th className="p-5">Concepto</th><th className="p-5">Original</th><th className="p-5">Saldo Actual</th><th className="p-5 text-center">Acción</th></tr>
          </thead>
          <tbody style={{ color: 'var(--color-texto-componente)' }}>
            {prestamos.map(p => (
              <tr key={p.id} className="border-t border-[var(--color-borde)] hover:bg-white/5 transition-colors">
                <td className="p-5 font-bold">{p.estilistas?.nombre}</td>
                <td className="p-5 opacity-70 italic">{p.notas || '—'}</td>
                <td className="p-5 opacity-60">${p.monto_total}</td>
                <td className="p-5 text-[var(--color-acento)] font-black">${p.saldo_pendiente}</td>
                <td className="p-5 text-center">
                  {p.saldo_pendiente > 0 && (
                    <button onClick={() => { setValeSeleccionado(p); setModalAbono(true); }} className="border border-[var(--color-acento)] text-[var(--color-acento)] px-4 py-1 rounded-lg font-bold uppercase hover:bg-[var(--color-acento)] hover:text-[var(--color-texto-acento)] transition-all">Abonar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAbono && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-componente)] p-8 rounded-[2rem] shadow-2xl border border-[var(--color-borde)] max-w-sm w-full">
            <h3 className="font-serif italic text-2xl text-[var(--color-acento)] mb-6 text-center">Registrar Abono</h3>
            <form onSubmit={manejarAbono} className="space-y-6">
              <input type="number" step="0.01" required autoFocus className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-acento)] text-center text-2xl font-serif outline-none" value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setModalAbono(false)} className="flex-1 py-3 text-slate-500 font-bold uppercase">Cerrar</button>
                <button type="submit" className="flex-1 py-3 bg-[var(--color-acento)] text-[var(--color-texto-acento)] rounded-xl font-black uppercase">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('agenda');
  const [citasDelDia, setCitasDelDia] = useState([]);

  const [tema, setTema] = useState(() => {
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
      tamanioBase: '15'
    };
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const cargarDatosHoy = async () => {
    if (!session) return;
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset() * 60000;
    const localHoy = new Date(hoy - offset).toISOString().split('T')[0];
    const { data } = await supabase.from('citas').select(`*, clientes(nombre), inventario(nombre, precio_venta), estilistas(nombre, comision_porcentaje)`).gte('fecha_inicio', `${localHoy}T00:00:00Z`).lte('fecha_inicio', `${localHoy}T23:59:59Z`).order('fecha_inicio', { ascending: true });
    setCitasDelDia(data || []);
  };

  useEffect(() => { if (session) cargarDatosHoy(); }, [session, tab]);

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
    // AQUÍ SE HOMOLOGA EL TAMAÑO A TODA LA APP
    'fontSize': `${tema.tamanioBase}px`
  };

  if (!session) return <Login />;

  return (
    <div style={estilosVariables} className="min-h-screen bg-[var(--color-fondo)] flex flex-col w-full font-[family-name:var(--fuente-p)] text-[var(--color-texto-general)] leading-relaxed">
      <header className="bg-[var(--color-componente)] border-b border-[var(--color-borde)] px-10 py-2 flex justify-between items-center sticky top-0 z-[110] shadow-2xl min-h-[80px]">
        
        <div className="flex items-center gap-6 cursor-pointer h-full" onClick={() => setTab('agenda')}>
          <img 
            src="/logo.png" 
            alt="Logo Jonny Delgadillo" 
            className="h-14 md:h-16 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" 
          />
          <div className="flex flex-col justify-center">
            <h1 className="text-base font-light tracking-[0.2em] text-white uppercase leading-none">
              Jonny <span className="italic font-serif text-[var(--color-acento)]">Delgadillo</span>
            </h1>
            <span className="uppercase tracking-[0.4em] opacity-50 font-bold mt-1.5" style={{ fontSize: '0.6em' }}>
              Hair Salon
            </span>
          </div>
        </div>

        <nav className="flex gap-8 items-center text-[var(--color-texto-componente)]">
          {['agenda', 'ventas', 'vales', 'reportes', 'config'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`uppercase font-bold relative pb-2 transition-all ${tab === t ? 'text-[var(--color-acento)]' : 'opacity-60 hover:opacity-100 hover:text-[var(--color-acento)]'}`} style={{ fontSize: '0.8em', tracking: '0.2em' }}>
              {t === 'config' ? 'Ajustes' : t === 'ventas' ? 'Caja' : t} {tab === t && <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[var(--color-acento)]"></div>}
            </button>
          ))}
          <div className="h-6 w-px bg-[var(--color-borde)] mx-2"></div>
          <button onClick={() => supabase.auth.signOut()} className="px-5 py-2 border border-[var(--color-borde)] rounded-full font-black uppercase opacity-60 hover:opacity-100 hover:text-[var(--color-acento)] hover:border-[var(--color-acento)]" style={{ fontSize: '0.7em' }}>Salir</button>
        </nav>
      </header>
      <main className="p-8 w-full max-w-[1700px] mx-auto flex-grow animate-in fade-in duration-500">
        {tab === 'agenda' && <Timeline citas={citasDelDia} recargar={cargarDatosHoy} />}
        {tab === 'ventas' && <PuntoVenta citasPendientes={citasDelDia.filter(c => c.estatus?.toLowerCase() === 'pendiente')} alTerminar={() => { cargarDatosHoy(); setTab('agenda'); }} />}
        {tab === 'vales' && <SeccionVales />}
        {tab === 'reportes' && <Reportes />}
        {tab === 'config' && <PanelConfiguracion tema={tema} setTema={setTema} />}
      </main>
    </div>
  );
}

export default App;