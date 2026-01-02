import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../api/supabase';
import { useCitas } from '../../hooks/useCitas';

const generarHorarios = () => {
  const horas = [];
  for (let h = 9; h <= 18; h++) {
    const horaPad = h.toString().padStart(2, '0');
    horas.push(`${horaPad}:00`, `${horaPad}:30`);
  }
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
      if (h >= 9 && h < 19) {
        const offset = (h - 9) * 128 + (ahora.getMinutes() >= 30 ? 64 : 0);
        containerRef.current.scrollTo({ top: offset - 100, behavior: 'smooth' });
      }
    }
  }, [datosCargados]);

  const offsetLinea = (() => {
    const h = ahora.getHours();
    if (h < 9 || h >= 19) return null;
    return 56 + (h - 9) * 128 + (ahora.getMinutes() * 2.13); 
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
      <td key={estId} className="p-0 border-r border-[var(--color-borde)] h-16 relative group text-[var(--color-texto-componente)]">
        <button onClick={() => setNuevaCita({ ...nuevaCita, estilista_id: estId, hora: hora })}
          className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 group-hover:bg-[var(--color-acento)]/10 z-0 text-[10px] font-bold text-[var(--color-acento)] transition-all">+</button>
        {citasEnEsteSlot.map((cita) => {
          if (cita.fecha_inicio.substring(11, 16) !== hora) return null;
          const bloques = (cita.duracion_minutos || 30) / 30;
          return (
            <div key={cita.id} className={`absolute inset-x-1 top-1 rounded-xl border p-3 z-10 shadow-lg overflow-hidden ${cita.estatus === 'pagada' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-900/50' : 'bg-[var(--color-secundario)] border-[var(--color-acento)]/30 text-[var(--color-acento)]'}`} style={{ height: `calc(${bloques * 100}% - 8px)` }}>
              <p className="font-serif italic text-[11px] truncate mb-1 text-[var(--color-texto-componente)]">{cita.clientes?.nombre}</p>
              <p className="text-[7px] uppercase font-bold opacity-60 truncate tracking-widest">{cita.inventario?.nombre}</p>
            </div>
          );
        })}
      </td>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-10 animate-in fade-in duration-500">
      <div className="xl:w-80 flex-shrink-0">
        <div className="bg-[var(--color-componente)] p-8 rounded-[3rem] shadow-2xl border border-[var(--color-borde)] sticky top-32">
          <h3 className="font-serif italic text-2xl text-[var(--color-acento)] mb-6 text-center">Nueva Cita</h3>
          <form onSubmit={guardarCita} className="space-y-4">
            <div>
              <label className="text-[8px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Estilista</label>
              <select className="w-full mt-1 p-4 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[10px] uppercase text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)] transition-all" value={nuevaCita.estilista_id} onChange={e=>setNuevaCita({...nuevaCita, estilista_id: e.target.value})}>
                <option value="">¿Quién atiende?</option>
                {estilistas.map(est => <option key={est.id} value={est.id}>{est.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Hora</label>
                <select className="w-full mt-1 p-4 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[10px] text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)]" value={nuevaCita.hora} onChange={e=>setNuevaCita({...nuevaCita, hora: e.target.value})}>
                  {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[8px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Duración</label>
                <select className="w-full mt-1 p-4 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[10px] text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)]" value={nuevaCita.duracion} onChange={e=>setNuevaCita({...nuevaCita, duracion: e.target.value})}>
                  {OPCIONES_DURACION.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[8px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Servicio</label>
              <select className="w-full mt-1 p-4 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[10px] uppercase text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)]" value={nuevaCita.servicio_id} onChange={e=>setNuevaCita({...nuevaCita, servicio_id: e.target.value})}>
                <option value="">¿Qué servicio?</option>
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[8px] font-bold opacity-50 uppercase ml-2 tracking-widest text-[var(--color-texto-componente)]">Cliente</label>
              <select className="w-full mt-1 p-4 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] font-bold text-[10px] uppercase text-[var(--color-texto-componente)] outline-none focus:border-[var(--color-acento)]" value={nuevaCita.cliente_id} onChange={e=>setNuevaCita({...nuevaCita, cliente_id: e.target.value})}>
                <option value="">Buscar Cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full py-5 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl mt-4 active:scale-95 transition-all">Agendar ✨</button>
          </form>
        </div>
      </div>

      <div className="flex-grow bg-[var(--color-componente)] rounded-[3rem] shadow-2xl border border-[var(--color-borde)] overflow-hidden relative">
        <div className="overflow-auto max-h-[75vh] relative scroll-smooth" ref={containerRef}>
          {offsetLinea && (
            <div className="absolute left-0 w-full z-40 flex items-center" style={{ top: `${offsetLinea}px`, transition: 'top 0.5s' }}>
              <div className="flex-grow h-[1px] bg-[var(--color-acento)]/60"></div>
              <div className="absolute left-0 bg-[var(--color-acento)] text-[var(--color-texto-acento)] text-[8px] font-black px-2 py-1 rounded-r-full shadow-lg">{ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          )}
          <table className="w-full border-collapse table-fixed">
            <thead className="sticky top-0 z-50 bg-[var(--color-componente)] border-b border-[var(--color-borde)]">
              <tr>
                <th className="w-20 p-5 text-[9px] font-bold opacity-50 uppercase tracking-widest text-[var(--color-texto-componente)]">Hora</th>
                {estilistas.map(est => (
                  <th key={est.id} className="p-5 text-[var(--color-texto-componente)] font-serif italic text-lg border-l border-[var(--color-borde)] uppercase tracking-tighter">
                    {est.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-borde)]">
              {HORARIOS.map(hora => (
                <tr key={hora}>
                  <td className="p-4 text-[10px] font-bold opacity-40 text-[var(--color-texto-componente)] text-center">{hora}</td>
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