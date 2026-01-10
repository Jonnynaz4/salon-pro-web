import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../api/supabase';
import { useCitas } from '../../hooks/useCitas';

const generarHorarios = () => {
  const horas = [];
  for (let h = 7; h <= 21; h++) {
    const horaPad = h.toString().padStart(2, '0');
    horas.push(`${horaPad}:00`, `${horaPad}:30`);
  }
  horas.push("22:00");
  return horas;
};
const HORARIOS = generarHorarios();

const generarOpcionesDuracion = () => {
  const opciones = [];
  for (let min = 30; min <= 180; min += 30) {
    const horas = Math.floor(min / 60);
    const minutosRestantes = min % 60;
    let label = horas > 0 ? `${horas} ${horas === 1 ? 'Hora' : 'Horas'}` : "";
    if (minutosRestantes > 0) label += ` ${minutosRestantes} Min`;
    opciones.push({ value: min, label });
  }
  return opciones;
};
const OPCIONES_DURACION = generarOpcionesDuracion();

export const Timeline = ({ citas, recargar }) => {
  const [estilistas, setEstilistas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [ahora, setAhora] = useState(new Date());
  const [datosCargados, setDatosCargados] = useState(false);
  const containerRef = useRef(null);
  
  // --- ESTADOS PARA GESTIÓN Y EDICIÓN ---
  const [mostrarGestor, setMostrarGestor] = useState(false);
  const [todasLasCitas, setTodasLasCitas] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [citaEditando, setCitaEditando] = useState(null);
  
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstilista, setFiltroEstilista] = useState('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');

  const [nuevaCita, setNuevaCita] = useState({ 
    estilista_id: '', 
    fecha: new Date().toISOString().split('T')[0],
    hora: '09:00', 
    cliente_id: '', 
    duracion: 30, 
    servicio_id: '', 
    notas: '' 
  });
  
  const { agendarCita } = useCitas();

  useEffect(() => {
    const cargar = async () => {
      const { data: est } = await supabase.from('estilistas').select('*').eq('activo', true);
      const { data: cli } = await supabase.from('clientes').select('*').order('nombre');
      const { data: serv } = await supabase.from('inventario').select('*').eq('tipo', 'servicio');
      setEstilistas(est || []);
      setClientes(cli || []);
      setServicios(serv || []);
      setDatosCargados(true);
    };
    cargar();
    const timer = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const cargarCitasHistorial = async () => {
    setCargandoHistorial(true);
    try {
      let query = supabase.from('citas').select(`*, clientes(nombre), estilistas(nombre), inventario(nombre)`).order('fecha_inicio', { ascending: false });
      if (filtroEstilista) query = query.eq('estilista_id', filtroEstilista);
      if (filtroFechaInicio) query = query.gte('fecha_inicio', `${filtroFechaInicio}T00:00:00Z`);
      if (filtroFechaFin) query = query.lte('fecha_inicio', `${filtroFechaFin}T23:59:59Z`);
      const { data } = await query;
      setTodasLasCitas(data || []);
    } catch (e) { console.error(e); } finally { setCargandoHistorial(false); }
  };

  useEffect(() => { if (mostrarGestor) cargarCitasHistorial(); }, [mostrarGestor, filtroEstilista, filtroFechaInicio, filtroFechaFin]);

  useEffect(() => {
    if (datosCargados && containerRef.current) {
      const h = ahora.getHours();
      if (h >= 7 && h < 23) {
        const offset = (h - 7) * 128 + (ahora.getMinutes() >= 30 ? 64 : 0);
        containerRef.current.scrollTo({ top: offset - 100, behavior: 'smooth' });
      }
    }
  }, [datosCargados]);

  const offsetLinea = (() => {
    const h = ahora.getHours();
    const m = ahora.getMinutes();
    if (h < 7 || h >= 23) return null;
    return 64 + ((h - 7) * 128) + (m * 128 / 60); 
  })();

  const guardarCita = async (e) => {
    e.preventDefault();
    if (!nuevaCita.cliente_id || !nuevaCita.estilista_id || !nuevaCita.servicio_id) return;
    const { error } = await agendarCita({ ...nuevaCita, fecha_inicio: `${nuevaCita.fecha}T${nuevaCita.hora}:00Z`, duracion_minutos: parseInt(nuevaCita.duracion), estatus: 'pendiente', notas: nuevaCita.notas });
    if (!error) { await recargar(); setNuevaCita({ ...nuevaCita, cliente_id: '', servicio_id: '', notas: '', fecha: new Date().toISOString().split('T')[0] }); alert("✅ Agendada"); }
  };

  const manejarGuardarEdicion = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('citas').update({
      estilista_id: citaEditando.estilista_id,
      fecha_inicio: `${citaEditando.fecha}T${citaEditando.hora}:00Z`,
      duracion_minutos: parseInt(citaEditando.duracion),
      servicio_id: citaEditando.servicio_id,
      notas: citaEditando.notas
    }).eq('id', citaEditando.id);

    if (!error) {
      alert("✅ Cita actualizada");
      setCitaEditando(null);
      cargarCitasHistorial();
      recargar();
    }
  };

  const eliminarCita = async (id) => {
    if (!confirm("¿Eliminar cita?")) return;
    await supabase.from('citas').delete().eq('id', id);
    cargarCitasHistorial();
    recargar();
  };

  const renderCell = (estId, hora) => {
    const citasEnEsteSlot = (citas || []).filter(c => {
      const hCita = c.fecha_inicio.substring(11, 16);
      const indexCita = HORARIOS.indexOf(hCita);
      const indexActual = HORARIOS.indexOf(hora);
      const bloques = (c.duracion_minutos || 30) / 30;
      return c.estilista_id === estId && indexActual >= indexCita && indexActual < (indexCita + bloques);
    });
    return (
      <td key={estId} className="p-0 border-r border-[var(--color-borde)] h-16 relative group">
        <button onClick={() => setNuevaCita({ ...nuevaCita, estilista_id: estId, hora: hora })} className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 group-hover:bg-[var(--color-acento)]/10 z-0 font-bold text-[var(--color-acento)]">+</button>
        {citasEnEsteSlot.map((cita) => {
          if (cita.fecha_inicio.substring(11, 16) !== hora) return null;
          const bloques = (cita.duracion_minutos || 30) / 30;
          return (
            <div key={cita.id} className={`absolute inset-x-1 top-1 rounded-xl border p-2 z-10 shadow-lg overflow-hidden flex flex-col justify-start ${cita.estatus === 'pagada' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-900/50' : 'bg-[var(--color-secundario)] border-[var(--color-acento)]/30 text-[var(--color-acento)]'}`} style={{ height: `calc(${bloques * 100}% - 8px)` }}>
              <p className="font-serif italic leading-none truncate mb-1 text-[var(--color-texto-componente)]" style={{ fontSize: '0.9em' }}>{cita.clientes?.nombre}</p>
              <p className="uppercase font-bold opacity-70 tracking-tighter leading-tight" style={{ fontSize: '0.65em' }}>{cita.inventario?.nombre}</p>
            </div>
          );
        })}
      </td>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 md:gap-10 animate-in fade-in duration-500 h-[calc(100vh-160px)] overflow-hidden">
      <div className="xl:w-80 flex-shrink-0 flex flex-col h-full">
        <div className="bg-[var(--color-componente)] p-5 rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)] h-full flex flex-col">
          <h3 className="font-serif italic text-2xl text-[var(--color-acento)] mb-4 text-center">Nueva Cita</h3>
          <form onSubmit={guardarCita} className="space-y-3 flex-grow flex flex-col overflow-hidden">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase opacity-40 ml-2 text-[var(--color-texto-componente)]">Fecha</label>
              <input type="date" className="w-full p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] text-white font-bold outline-none" value={nuevaCita.fecha} onChange={e => setNuevaCita({...nuevaCita, fecha: e.target.value})} style={{ fontSize: '0.85em' }} />
            </div>
            <select className="w-full p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] font-bold uppercase text-white outline-none" value={nuevaCita.estilista_id} onChange={e=>setNuevaCita({...nuevaCita, estilista_id: e.target.value})} style={{ fontSize: '0.85em' }}><option value="">Estilista</option>{estilistas.map(est => <option key={est.id} value={est.id}>{est.nombre}</option>)}</select>
            <select className="w-full p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] font-bold uppercase text-white outline-none" value={nuevaCita.cliente_id} onChange={e=>setNuevaCita({...nuevaCita, cliente_id: e.target.value})} style={{ fontSize: '0.85em' }}><option value="">Cliente</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
            <div className="grid grid-cols-2 gap-2">
              <select className="p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] font-bold text-white outline-none" value={nuevaCita.hora} onChange={e=>setNuevaCita({...nuevaCita, hora: e.target.value})} style={{ fontSize: '0.8em' }}>{HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}</select>
              <select className="p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] font-bold text-white outline-none" value={nuevaCita.duracion} onChange={e=>setNuevaCita({...nuevaCita, duracion: e.target.value})} style={{ fontSize: '0.8em' }}>{OPCIONES_DURACION.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
            </div>
            <select className="w-full p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] font-bold uppercase text-white outline-none" value={nuevaCita.servicio_id} onChange={e=>setNuevaCita({...nuevaCita, servicio_id: e.target.value})} style={{ fontSize: '0.85em' }}><option value="">Servicio</option>{servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
            <textarea className="w-full p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] text-white font-bold outline-none resize-none flex-grow" placeholder="Notas..." value={nuevaCita.notas} onChange={e => setNuevaCita({...nuevaCita, notas: e.target.value})} style={{ fontSize: '0.85em' }} />
            <button type="submit" className="w-full py-3 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase tracking-widest rounded-xl shadow-xl mt-2" style={{ fontSize: '0.8em' }}>Agendar ✨</button>
            <button type="button" onClick={() => setMostrarGestor(true)} className="w-full p-2 border-2 border-dashed border-[var(--color-borde)] text-[var(--color-texto-componente)] rounded-xl font-black uppercase opacity-60" style={{ fontSize: '0.65em' }}>🔍 Gestionar Citas</button>
          </form>
        </div>
      </div>

      <div className="flex-grow bg-[var(--color-componente)] rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)] overflow-hidden relative">
        <div className="overflow-auto h-full relative scroll-smooth custom-scrollbar" ref={containerRef}>
          {offsetLinea && (
            <div className="absolute left-0 w-full z-40 flex items-center pointer-events-none" style={{ top: `${offsetLinea}px` }}>
              <div className="w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24] -ml-1.5"></div>
              <div className="flex-grow h-[2px] bg-amber-400"></div>
              <div className="absolute left-2 bg-amber-400 text-black font-black px-3 py-1 rounded-full text-[0.6em] shadow-lg">{ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          )}
          <table className="w-full border-collapse table-fixed min-w-[800px]">
            <thead className="sticky top-0 z-50 bg-[#0a0a0a] border-b-2 border-[var(--color-acento)]/50">
              <tr className="h-14">
                <th className="w-20 p-2 font-black opacity-70 uppercase tracking-widest bg-[#0f0f0f] text-[var(--color-texto-componente)]" style={{ fontSize: '0.7em' }}>Hora</th>
                {estilistas.map(est => (<th key={est.id} className="p-2 font-serif italic border-l border-[var(--color-borde)] uppercase tracking-tighter text-[var(--color-texto-componente)]" style={{ fontSize: '0.9em' }}>{est.nombre}</th>))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-borde)]">
              {HORARIOS.map(hora => (<tr key={hora} className="h-16"><td className="p-4 font-black opacity-40 text-center bg-[#0f0f0f]/30 text-[var(--color-texto-componente)]" style={{ fontSize: '0.75em' }}>{hora}</td>{estilistas.map(est => renderCell(est.id, hora))}</tr>))}
            </tbody>
          </table>
        </div>
      </div>

      {mostrarGestor && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--color-componente)] w-full max-w-5xl max-h-[85vh] rounded-[3rem] border border-[var(--color-borde)] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-[var(--color-borde)] flex justify-between items-center bg-[var(--color-secundario)] rounded-t-[3rem]">
              <h2 className="text-2xl font-serif italic text-[var(--color-acento)]">Gestor Maestro</h2>
              <button onClick={() => { setMostrarGestor(false); setCitaEditando(null); }} className="text-2xl font-black text-rose-500">✕</button>
            </div>
            {citaEditando ? (
              <form onSubmit={manejarGuardarEdicion} className="p-8 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2 text-[var(--color-texto-componente)]">Fecha</label><input type="date" className="w-full p-4 rounded-xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-white" value={citaEditando.fecha} onChange={e => setCitaEditando({...citaEditando, fecha: e.target.value})} /></div>
                  <div className="space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2 text-[var(--color-texto-componente)]">Estilista</label><select className="w-full p-4 rounded-xl bg-[var(--color-secundario)] text-white" value={citaEditando.estilista_id} onChange={e => setCitaEditando({...citaEditando, estilista_id: e.target.value})}>{estilistas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
                  <div className="space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2 text-[var(--color-texto-componente)]">Hora</label><select className="w-full p-4 rounded-xl bg-[var(--color-secundario)] text-white" value={citaEditando.hora} onChange={e => setCitaEditando({...citaEditando, hora: e.target.value})}>{HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                  <div className="space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2 text-[var(--color-texto-componente)]">Duración</label><select className="w-full p-4 rounded-xl bg-[var(--color-secundario)] text-white" value={citaEditando.duracion} onChange={e => setCitaEditando({...citaEditando, duracion: e.target.value})}>{OPCIONES_DURACION.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
                  <div className="md:col-span-2 space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2 text-[var(--color-texto-componente)]">Servicio</label><select className="w-full p-4 rounded-xl bg-[var(--color-secundario)] text-white" value={citaEditando.servicio_id} onChange={e => setCitaEditando({...citaEditando, servicio_id: e.target.value})}>{servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
                  <div className="md:col-span-2 space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2 text-[var(--color-texto-componente)]">Notas</label><textarea className="w-full p-4 rounded-xl bg-[var(--color-secundario)] border border-[var(--color-borde)] h-20 text-white resize-none" value={citaEditando.notas} onChange={e => setCitaEditando({...citaEditando, notas: e.target.value})} /></div>
                </div>
                <div className="flex gap-4 pt-4"><button type="submit" className="flex-1 py-4 bg-[var(--color-acento)] text-black font-black uppercase rounded-xl">Guardar</button><button type="button" onClick={() => setCitaEditando(null)} className="flex-1 py-4 bg-slate-800 text-white font-black uppercase rounded-xl">Cancelar</button></div>
              </form>
            ) : (
              <div className="flex flex-col flex-grow overflow-hidden">
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-black/20 text-white">
                  <input type="text" placeholder="Cliente..." className="p-3 rounded-xl bg-[var(--color-fondo)] outline-none border border-white/5" value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} />
                  <select className="p-3 rounded-xl bg-[var(--color-fondo)] outline-none border border-white/5" value={filtroEstilista} onChange={e => setFiltroEstilista(e.target.value)}><option value="">Estilista...</option>{estilistas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
                  <input type="date" className="p-3 rounded-xl bg-[var(--color-fondo)] outline-none border border-white/5" value={filtroFechaInicio} onChange={e => setFiltroFechaInicio(e.target.value)} />
                  <input type="date" className="p-3 rounded-xl bg-[var(--color-fondo)] outline-none border border-white/5" value={filtroFechaFin} onChange={e => setFiltroFechaFin(e.target.value)} />
                </div>
                <div className="flex-grow overflow-auto p-4 custom-scrollbar text-white">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-black/40 text-[var(--color-acento)] font-black uppercase text-[0.65em] tracking-widest">
                      <tr><th className="p-4">Fecha/Hora</th><th className="p-4">Cliente</th><th className="p-4">Servicio</th><th className="p-4 text-center">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-borde)]">
                      {todasLasCitas.filter(c => c.clientes?.nombre.toLowerCase().includes(filtroTexto.toLowerCase())).map(cita => (
                        <tr key={cita.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 text-[0.75em] font-bold">{new Date(cita.fecha_inicio).toLocaleDateString()} {cita.fecha_inicio.substring(11, 16)}</td>
                          <td className="p-4 font-serif italic text-lg">{cita.clientes?.nombre}</td>
                          <td className="p-4 opacity-50 uppercase text-[0.6em] truncate max-w-[150px]">{cita.inventario?.nombre}</td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => setCitaEditando({ ...cita, fecha: cita.fecha_inicio.split('T')[0], hora: cita.fecha_inicio.substring(11, 16), duracion: cita.duracion_minutos })} className="bg-amber-400 text-black px-3 py-2 rounded-lg font-black text-[0.65em]">✎ EDITAR</button>
                              <button onClick={() => eliminarCita(cita.id)} className="bg-rose-500 text-white px-3 py-2 rounded-lg font-black text-[0.65em]">ELIMINAR</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};