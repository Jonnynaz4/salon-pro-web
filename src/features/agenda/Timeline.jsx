import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../api/supabase';
import { useCitas } from '../../hooks/useCitas';

// RANGO AMPLIADO: 7 AM a 10 PM
const generarHorarios = () => {
  const horas = [];
  for (let h = 7; h <= 21; h++) {
    const horaPad = h.toString().padStart(2, '0');
    horas.push(`${horaPad}:00`, `${horaPad}:30`);
  }
  // Añadimos las 22:00 al final
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
  
  const [nuevaCita, setNuevaCita] = useState({ 
    estilista_id: '', hora: '09:00', cliente_id: '', duracion: 30, servicio_id: '' 
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

  useEffect(() => {
    if (datosCargados && containerRef.current) {
      const h = ahora.getHours();
      // Ajuste de scroll automático para el nuevo rango (7am a 10pm)
      if (h >= 7 && h < 23) {
        const offset = (h - 7) * 128 + (ahora.getMinutes() >= 30 ? 64 : 0);
        containerRef.current.scrollTo({ top: offset - 100, behavior: 'smooth' });
      }
    }
  }, [datosCargados]);

  // Cálculo de línea de tiempo ajustado al inicio de las 7:00 AM
  const offsetLinea = (() => {
    const h = ahora.getHours();
    const m = ahora.getMinutes();
    if (h < 7 || h >= 23) return null;
    // 64px es el nuevo alto del header (h-16), cada fila h-16 (64px) x 2 (30min+30min) = 128px por hora
    return 64 + ((h - 7) * 128) + (m * 128 / 60); 
  })();

  const guardarCita = async (e) => {
    e.preventDefault();
    if (!nuevaCita.cliente_id || !nuevaCita.estilista_id || !nuevaCita.servicio_id) return;
    const hoy = new Date();
    const tzOffset = hoy.getTimezoneOffset() * 60000;
    const localISO = new Date(hoy - tzOffset).toISOString().split('T')[0];
    const { error } = await agendarCita({ 
      ...nuevaCita, 
      fecha_inicio: `${localISO}T${nuevaCita.hora}:00Z`, 
      duracion_minutos: parseInt(nuevaCita.duracion),
      estatus: 'pendiente'
    });
    if (!error) {
      await recargar();
      setNuevaCita({ ...nuevaCita, cliente_id: '', servicio_id: '' });
    }
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
        <button onClick={() => setNuevaCita({ ...nuevaCita, estilista_id: estId, hora: hora })}
          className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 group-hover:bg-[var(--color-acento)]/10 z-0 text-[10px] font-bold text-[var(--color-acento)] transition-all">+</button>
        {citasEnEsteSlot.map((cita) => {
          if (cita.fecha_inicio.substring(11, 16) !== hora) return null;
          const bloques = (cita.duracion_minutos || 30) / 30;
          return (
            <div key={cita.id} className={`absolute inset-x-1 top-1 rounded-xl border p-3 z-10 shadow-lg overflow-hidden ${cita.estatus === 'pagada' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-900/50' : 'bg-[var(--color-secundario)] border-[var(--color-acento)]/30 text-[var(--color-acento)]'}`} style={{ height: `calc(${bloques * 100}% - 8px)` }}>
              <p className="font-serif italic text-[13px] leading-tight truncate mb-1 text-[var(--color-texto-componente)]">{cita.clientes?.nombre}</p>
              <p className="text-[9px] uppercase font-bold opacity-60 truncate tracking-widest">{cita.inventario?.nombre}</p>
            </div>
          );
        })}
      </td>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-10 animate-in fade-in duration-500 p-4">
      {/* FORMULARIO */}
      <div className="xl:w-96 flex-shrink-0">
        <div className="bg-[var(--color-componente)] p-10 rounded-[3rem] shadow-2xl border border-[var(--color-borde)] sticky top-32">
          <h3 className="font-serif italic text-3xl text-[var(--color-acento)] mb-8 text-center">Nueva Cita</h3>
          <form onSubmit={guardarCita} className="space-y-6">
            <div>
              <label className="text-[10px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Estilista</label>
              <select className="w-full mt-2 p-5 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[14px] uppercase text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)] transition-all" value={nuevaCita.estilista_id} onChange={e=>setNuevaCita({...nuevaCita, estilista_id: e.target.value})}>
                <option value="">¿Quién atiende?</option>
                {estilistas.map(est => <option key={est.id} value={est.id}>{est.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Hora</label>
                <select className="w-full mt-2 p-5 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[14px] text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)]" value={nuevaCita.hora} onChange={e=>setNuevaCita({...nuevaCita, hora: e.target.value})}>
                  {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Duración</label>
                <select className="w-full mt-2 p-5 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[14px] text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)]" value={nuevaCita.duracion} onChange={e=>setNuevaCita({...nuevaCita, duracion: e.target.value})}>
                  {OPCIONES_DURACION.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Servicio</label>
              <select className="w-full mt-2 p-5 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[14px] uppercase text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)]" value={nuevaCita.servicio_id} onChange={e=>setNuevaCita({...nuevaCita, servicio_id: e.target.value})}>
                <option value="">¿Qué servicio?</option>
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Cliente</label>
              <select className="w-full mt-2 p-5 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[14px] uppercase text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)]" value={nuevaCita.cliente_id} onChange={e=>setNuevaCita({...nuevaCita, cliente_id: e.target.value})}>
                <option value="">Buscar Cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full py-6 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase text-[12px] tracking-[0.2em] rounded-2xl shadow-xl mt-6 active:scale-95 transition-all">Agendar ✨</button>
          </form>
        </div>
      </div>

      <div className="flex-grow bg-[var(--color-componente)] rounded-[3rem] shadow-2xl border border-[var(--color-borde)] overflow-hidden relative">
        <div className="overflow-auto max-h-[75vh] relative scroll-smooth" ref={containerRef}>
          
          {offsetLinea && (
            <div className="absolute left-0 w-full z-40 flex items-center pointer-events-none" style={{ top: `${offsetLinea}px`, transition: 'top 0.5s linear' }}>
              <div className="w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24] -ml-1.5"></div>
              <div className="flex-grow h-[2px] bg-amber-400 shadow-[0_0_8px_#fbbf24]"></div>
              <div className="absolute left-2 bg-amber-400 text-black text-[9px] font-black px-3 py-1 rounded-full shadow-lg">
                {ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}

          <table className="w-full border-collapse table-fixed">
            <thead className="sticky top-0 z-50 bg-[#0a0a0a] border-b-2 border-[var(--color-acento)]/50">
              <tr className="h-16"> {/* HEADER MÁS PEQUEÑO EN VERTICAL */}
                <th className="w-24 p-2 text-[10px] font-black opacity-70 uppercase tracking-widest text-[var(--color-texto-componente)] bg-[#0f0f0f]">Hora</th>
                {estilistas.map(est => (
                  <th key={est.id} className="p-2 text-[var(--color-texto-componente)] font-serif italic text-[14px] border-l border-[var(--color-borde)] leading-tight">
                    <span className="block break-words max-w-[120px] mx-auto uppercase tracking-tighter">{est.nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-borde)]">
              {HORARIOS.map(hora => (
                <tr key={hora} className="h-16">
                  <td className="p-4 text-[11px] font-black opacity-40 text-[var(--color-texto-componente)] text-center bg-[#0f0f0f]/30">{hora}</td>
                  {estilistas.map(est => renderCell(est.id, hora))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};