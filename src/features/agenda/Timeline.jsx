import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../api/supabase';
import { useCitas } from '../../hooks/useCitas';
import { EstilistaAdmin } from '../estilistas/EstilistaAdmin';
import { ClienteForm } from '../clientes/ClienteForm';
import { InventarioForm } from '../inventario/InventarioForm';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

const generarHorarios = () => {
  const horas = [];
  for (let h = 7; h <= 21; h++) {
    horas.push(`${h.toString().padStart(2, '0')}:00`);
  }
  horas.push("22:00");
  return horas;
};
const HORARIOS = generarHorarios();
const formatearHora12h = (hora24) => {
  if (!hora24) return '';
  const [h, m] = hora24.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  const mins = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
  return `${h12}${mins} ${period}`;
};

const formatearDuracion = (minutos) => {
  if (minutos < 60) return `${minutos} min`;
  const horas = minutos / 60;
  return `${horas % 1 === 0 ? horas : horas.toFixed(1)} h`;
};

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

export const Timeline = ({ citas, recargar, fechaAgenda, setFechaAgenda, estilistasProp, clientesProp, serviciosProp, recargarMaestros }) => {
  const estilistas = estilistasProp || [];
  const clientes = clientesProp || [];
  const servicios = serviciosProp || [];
  const [ahora, setAhora] = useState(new Date());
  const [datosCargados, setDatosCargados] = useState(false);
  const containerRef = useRef(null);

  // --- ESTADOS GESTIÓN ---
  const [mostrarGestor, setMostrarGestor] = useState(false);
  const [todasLasCitas, setTodasLasCitas] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [citaEditando, setCitaEditando] = useState(null);
  const [modalAlta, setModalAlta] = useState(null);
  const [mostrarSidebarMobile, setMostrarSidebarMobile] = useState(false);
  const [estilistaSeleccionado, setEstilistaSeleccionado] = useState(null);
  const inputFechaRef = useRef(null);

  // --- BUSQUEDA Y DESPLEGABLES ---
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [showCli, setShowCli] = useState(false);
  const [busquedaEstilista, setBusquedaEstilista] = useState('');
  const [showEst, setShowEst] = useState(false);
  const [busquedaServicio, setBusquedaServicio] = useState('');
  const [showServ, setShowServ] = useState(false);

  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstilista, setFiltroEstilista] = useState('');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');

  const [nuevaCita, setNuevaCita] = useState({
    estilista_id: '',
    fecha: fechaAgenda,
    hora: '09:00',
    cliente_id: '',
    duracion: 30,
    servicio_id: '',
    notas: ''
  });

  const { agendarCita } = useCitas();

  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Sincronizar nuevaCita con la fecha global de App.jsx
  useEffect(() => {
    setNuevaCita(prev => ({ ...prev, fecha: fechaAgenda }));
  }, [fechaAgenda]);

  useEffect(() => {
    if (estilistas.length > 0) {
      if (!estilistaSeleccionado) {
        setEstilistaSeleccionado(estilistas[0].id);
      }
      setDatosCargados(true);
    }
  }, [estilistas]);

  useEffect(() => {
    console.log("📦 [Timeline] Prop 'citas' actualizada. Total recibidas:", citas?.length || 0);
  }, [citas]);

  const cargarCitasHistorial = async () => {
    setCargandoHistorial(true);
    try {
      let query = supabase.from('citas').select(`*, clientes(nombre, telefono), estilistas(nombre), inventario(nombre)`).order('fecha_inicio', { ascending: false });
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
        const offset = (h - 7) * 96 + (ahora.getMinutes() * 96 / 60);
        containerRef.current.scrollTo({ top: offset - 100, behavior: 'smooth' });
      }
    }
  }, [datosCargados]);

  const offsetLinea = (() => {
    const h = ahora.getHours();
    const m = ahora.getMinutes();
    if (h < 7 || h >= 22) return null;
    return 56 + ((h - 7) * 96) + (m * 96 / 60);
  })();

  const guardarCita = async (e) => {
    e.preventDefault();
    if (!nuevaCita.cliente_id || !nuevaCita.estilista_id || !nuevaCita.servicio_id) return;
    const { error } = await agendarCita({ ...nuevaCita, fecha_inicio: `${nuevaCita.fecha}T${nuevaCita.hora}:00Z`, duracion_minutos: parseInt(nuevaCita.duracion), estatus: 'pendiente', notas: nuevaCita.notas });
    if (!error) {
      await recargar(nuevaCita.fecha);
      setNuevaCita({ ...nuevaCita, cliente_id: '', servicio_id: '', notas: '', fecha: fechaAgenda });
      setBusquedaCliente('');
      setBusquedaEstilista('');
      setBusquedaServicio('');
      setMostrarSidebarMobile(false);
      alert("✅ Agendada");
    }
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
    if (!error) { alert("✅ Cita actualizada"); setCitaEditando(null); cargarCitasHistorial(); recargar(fechaAgenda); }
  };

  const modificarFecha = (dias) => {
    const f = new Date(fechaAgenda + 'T00:00:00');
    f.setDate(f.getDate() + dias);
    setFechaAgenda(f.toISOString().split('T')[0]);
  };

  const eliminarCita = async (id) => {
    if (!confirm("¿Eliminar cita?")) return;
    await supabase.from('citas').delete().eq('id', id);
    cargarCitasHistorial();
    recargar(fechaAgenda);
  };

  const enviarConfirmacionWhatsApp = (cita) => {
    const telefono = cita.clientes?.telefono;
    if (!telefono) {
      alert("⚠️ El cliente no tiene un número de WhatsApp registrado.");
      return;
    }

    const nombreCliente = cita.clientes?.nombre || 'Cliente';
    const fechaObj = new Date(cita.fecha_inicio);
    const fecha = fechaObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const hora = formatearHora12h(cita.fecha_inicio.substring(11, 16));
    const servicio = cita.inventario?.nombre || 'su servicio';
    const estilista = cita.estilistas?.nombre || 'nuestro equipo';

    const mensaje = `¡Hola ${nombreCliente}!  Te escribimos de Masaryk Hair Salon para recordarte tu cita para el ${fecha} a las ${hora} para ${servicio} con ${estilista}. ¿Nos podrías confirmar si asistirás? ¡Te esperamos!`;

    const telLimpio = telefono.replace(/\D/g, '');
    const telFinal = telLimpio.length === 10 ? `52${telLimpio}` : telLimpio;

    const url = `https://wa.me/${telFinal}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const renderCell = (estId, hora) => {
    const horaNum = parseInt(hora.split(':')[0]);
    const citasIntersecan = (citas || []).filter(c => {
      if (!c.fecha_inicio) return false;
      const horaStr = c.fecha_inicio.split('T')[1] || '';
      const hCita = parseInt(horaStr.substring(0, 2));
      return c.estilista_id === estId && hCita === horaNum;
    });

    const isSelected = estId === estilistaSeleccionado;
    const hasOverlaps = citasIntersecan.length > 1;

    return (
      <td
        key={estId}
        className={`p-0 border-r border-white/5 h-24 relative group/cell [--stagger:10px] hover:[--stagger:45px] transition-all ${!isSelected ? 'hidden xl:table-cell' : 'table-cell'}`}
      >
        <button onClick={() => setNuevaCita({ ...nuevaCita, estilista_id: estId, hora: hora })} className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 group-hover:bg-[var(--color-acento)]/5 z-0 font-bold text-[var(--color-acento)]">+</button>
        {citasIntersecan.map((cita) => {
          const horaStr = cita.fecha_inicio.split('T')[1] || '';
          const mCita = parseInt(horaStr.substring(3, 5)) || 0;
          const bloques = (cita.duracion_minutos || 60) / 60;
          const esPagada = cita.estatus === 'pagada';
          const topPercent = (mCita / 60) * 100;
          const posIndex = citasIntersecan.findIndex(c => c.id === cita.id);

          return (
            <div
              key={cita.id}
              onClick={() => { setCitaEditando({ ...cita, fecha: cita.fecha_inicio.split('T')[0], hora: cita.fecha_inicio.substring(11, 16), duracion: cita.duracion_minutos }); setMostrarGestor(true); }}
              className={`absolute rounded-xl border-l-[6px] p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between transition-all duration-300 hover:scale-[1.05] hover:z-[200] cursor-pointer group/card ${esPagada
                  ? 'bg-[#E8F5E9] border-[#10B981] text-[#1b3a1b]'
                  : 'bg-[#FFF9E5] border-[#D4AF37] text-[#2d2d2d]'
                } ${hasOverlaps ? 'ring-1 ring-black/5' : ''}`}
              style={{
                top: `calc(${topPercent}% + 2px)`,
                height: `calc(${bloques * 100}% - 4px)`,
                width: hasOverlaps ? '85%' : '92%',
                left: `calc(4% + (var(--stagger) * ${posIndex}))`,
                zIndex: 10 + posIndex
              }}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex justify-between items-start gap-1">
                  <p className="font-bold leading-none truncate uppercase tracking-tight flex-grow" style={{ fontSize: '0.75em' }}>
                    {cita.clientes?.nombre}
                  </p>
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-md font-black text-[9px] shadow-sm ${esPagada ? 'bg-[#10B981] text-white' : 'bg-[#D4AF37] text-white'}`}>
                    {formatearDuracion(cita.duracion_minutos)}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-70 overflow-hidden">
                  <p className="uppercase font-black tracking-widest truncate leading-none" style={{ fontSize: '0.55em' }}>
                    {cita.inventario?.nombre}
                  </p>
                </div>
              </div>
              <div className="flex justify-end items-center">
                {cita.notas && (
                  <div className="text-[10px] opacity-40 group-hover/card:opacity-100 transition-opacity">
                    📄
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </td>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 md:gap-10 animate-in fade-in duration-500 min-h-[600px] h-full">
      <div className={`
        ${mostrarSidebarMobile ? 'fixed inset-0 z-[500] bg-black/80 backdrop-blur-md p-4 animate-in fade-in transition-all' : 'hidden'} 
        xl:relative xl:flex xl:w-80 xl:flex-shrink-0 xl:flex-col xl:h-full xl:p-0 xl:bg-transparent xl:backdrop-blur-none
      `}>
        <div className="bg-[var(--color-componente)] p-5 rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)] h-full flex flex-col relative">
          <button onClick={() => setMostrarSidebarMobile(false)} className="xl:hidden absolute top-4 right-6 text-2xl text-[var(--color-acento)] font-black">✕</button>
          <h3 className="font-serif italic text-2xl text-[var(--color-acento)] mb-4 text-center">Nueva Cita</h3>
          <form onSubmit={guardarCita} className="space-y-3 flex-grow flex flex-col overflow-y-auto custom-scrollbar pr-1">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase opacity-40 ml-2 text-[var(--color-texto-componente)]">Fecha</label>
              <input type="date" className="w-full p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] text-white font-bold outline-none" value={nuevaCita.fecha} onChange={e => { setNuevaCita({ ...nuevaCita, fecha: e.target.value }); setFechaAgenda(e.target.value); }} style={{ fontSize: '0.85em' }} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase opacity-40 text-[var(--color-texto-componente)]">Estilista</label>
                <button type="button" onClick={() => setModalAlta('estilista')} className="text-[var(--color-acento)] text-[9px] font-black hover:underline">+ ALTA</button>
              </div>
              <SearchableSelect
                options={estilistas.map(e => ({ value: e.id, label: e.nombre }))}
                value={nuevaCita.estilista_id}
                onChange={val => setNuevaCita({ ...nuevaCita, estilista_id: val })}
                placeholder="Escoger Estilista..."
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase opacity-40 text-[var(--color-texto-componente)]">Cliente</label>
                <button type="button" onClick={() => setModalAlta('cliente')} className="text-[var(--color-acento)] text-[9px] font-black hover:underline">+ ALTA</button>
              </div>
              <SearchableSelect
                options={clientes.map(c => ({ value: c.id, label: c.nombre }))}
                value={nuevaCita.cliente_id}
                onChange={val => setNuevaCita({ ...nuevaCita, cliente_id: val })}
                placeholder="Buscar Cliente..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] font-bold text-white outline-none" value={nuevaCita.hora} onChange={e => setNuevaCita({ ...nuevaCita, hora: e.target.value })} style={{ fontSize: '0.8em' }}>{HORARIOS.map(h => <option key={h} value={h}>{formatearHora12h(h)}</option>)}</select>
              <select className="p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] font-bold text-white outline-none" value={nuevaCita.duracion} onChange={e => setNuevaCita({ ...nuevaCita, duracion: e.target.value })} style={{ fontSize: '0.8em' }}>{OPCIONES_DURACION.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase opacity-40 text-[var(--color-texto-componente)]">Servicio</label>
                <button type="button" onClick={() => setModalAlta('servicio')} className="text-[var(--color-acento)] text-[9px] font-black hover:underline">+ ALTA</button>
              </div>
              <SearchableSelect
                options={servicios.map(s => ({ value: s.id, label: s.nombre }))}
                value={nuevaCita.servicio_id}
                onChange={val => setNuevaCita({ ...nuevaCita, servicio_id: val })}
                placeholder="Seleccionar Servicio..."
              />
            </div>
            <textarea className="w-full p-3 bg-[var(--color-secundario)] rounded-xl border border-[var(--color-borde)] text-white font-bold outline-none resize-none min-h-[60px]" placeholder="Notas..." value={nuevaCita.notas} onChange={e => setNuevaCita({ ...nuevaCita, notas: e.target.value })} style={{ fontSize: '0.85em' }} />
            <button type="submit" className="w-full py-3 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase tracking-widest rounded-xl shadow-xl mt-2" style={{ fontSize: '0.8em' }}>Agendar ✨</button>
            <button type="button" onClick={() => setMostrarGestor(true)} className="w-full p-2 border-2 border-dashed border-[var(--color-borde)] text-[var(--color-texto-componente)] rounded-xl font-black uppercase opacity-60" style={{ fontSize: '0.65em' }}>🔍 Gestionar Citas</button>
          </form>
        </div>
      </div>

      <div className="flex-grow bg-[var(--color-componente)] rounded-[2.5rem] shadow-2xl border border-[var(--color-borde)] overflow-hidden relative flex flex-col">
        <div className="bg-black/40 backdrop-blur-md p-4 flex flex-col md:flex-row gap-4 border-b border-[var(--color-borde)]">
          <div className="flex items-center gap-2 bg-[#151515] p-1.5 rounded-full border border-white/5 shadow-inner self-center md:self-auto group/date">
            <button onClick={() => modificarFecha(-1)} className="w-8 h-8 flex items-center justify-center text-[var(--color-acento)] font-bold hover:bg-white/5 rounded-full">‹</button>
            <div className="relative flex items-center cursor-pointer px-2 group-hover/date:text-[var(--color-acento)] transition-colors" onClick={() => { try { inputFechaRef.current.showPicker(); } catch (e) { inputFechaRef.current.focus(); inputFechaRef.current.click(); } }}>
              <input ref={inputFechaRef} type="date" className="absolute opacity-0 pointer-events-none w-0 h-0" value={fechaAgenda} onChange={e => setFechaAgenda(e.target.value)} />
              <div className="flex items-center gap-2">
                <span className="text-xs">📅</span>
                <span className="bg-transparent text-[var(--color-acento)] font-black uppercase outline-none text-[0.7em] text-center">{new Date(fechaAgenda + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
              </div>
            </div>
            <button onClick={() => modificarFecha(1)} className="w-8 h-8 flex items-center justify-center text-[var(--color-acento)] font-bold hover:bg-white/5 rounded-full">›</button>
            <button onClick={() => setFechaAgenda(new Date().toISOString().split('T')[0])} className="ml-2 px-3 py-1 bg-white/5 hover:bg-white/10 text-[var(--color-acento)] rounded-full text-[0.6em] font-black uppercase">Hoy</button>
          </div>
          <div className="flex gap-2 overflow-x-auto custom-scrollbar flex-grow pb-1 md:pb-0">
            {estilistas.map(est => (
              <button key={est.id} onClick={() => setEstilistaSeleccionado(est.id)} className={`px-6 py-2 rounded-full font-black uppercase whitespace-nowrap transition-all border ${estilistaSeleccionado === est.id ? 'bg-[var(--color-acento)] text-black border-[var(--color-acento)] shadow-[0_0_15px_var(--color-acento)]' : 'bg-[#151515] text-white/40 border-white/5'}`} style={{ fontSize: '0.65em' }}>{est.nombre}</button>
            ))}
          </div>
        </div>

        <div className="overflow-auto h-full relative scroll-smooth custom-scrollbar" ref={containerRef}>
          {offsetLinea && fechaAgenda === new Date().toISOString().split('T')[0] && (
            <div className="absolute left-0 w-full z-40 flex items-center pointer-events-none" style={{ top: `${offsetLinea}px` }}>
              <div className="w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24] -ml-1.5"></div>
              <div className="flex-grow h-[2px] bg-amber-400"></div>
              <div className="absolute left-2 bg-amber-400 text-black font-black px-3 py-1 rounded-full text-[0.6em] shadow-lg">{ahora.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}</div>
            </div>
          )}
          <table className="w-full border-collapse table-fixed xl:min-w-[800px]">
            <thead className="sticky top-0 z-50 bg-[#0a0a0a] border-b-2 border-[var(--color-acento)]/50">
              <tr className="h-14">
                <th className="w-20 p-2 font-black opacity-70 uppercase tracking-widest bg-[#0f0f0f] text-[var(--color-texto-componente)]" style={{ fontSize: '0.7em' }}>Hora</th>
                {estilistas.map(est => (
                  <th key={est.id} className={`p-2 font-serif italic border-l border-[var(--color-borde)] uppercase tracking-tighter text-[var(--color-texto-componente)] ${est.id === estilistaSeleccionado ? 'table-cell' : 'hidden xl:table-cell'}`} style={{ fontSize: '0.9em' }}>{est.nombre}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-borde)]">
              {HORARIOS.map(hora => (<tr key={hora} className="h-24"><td className="p-4 font-black opacity-40 text-center bg-[#0f0f0f]/30 text-[var(--color-texto-componente)]" style={{ fontSize: '0.75em' }}>{formatearHora12h(hora)}</td>{estilistas.map(est => renderCell(est.id, hora))}</tr>))}
            </tbody>
          </table>
        </div>
      </div>

      {modalAlta && (
        <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto pt-10 pb-20">
          <div className="bg-[var(--color-componente)] p-6 md:p-10 rounded-[3rem] border border-[var(--color-acento)]/30 w-full max-w-6xl shadow-2xl relative my-8">
            <button onClick={() => { setModalAlta(null); recargarMaestros(); }} className="absolute top-6 right-8 text-3xl text-[var(--color-acento)] font-black hover:scale-110 transition-transform">✕</button>
            <div className="mt-4 w-full [&>*]:max-w-none">
              {modalAlta === 'cliente' && <ClienteForm />}
              {modalAlta === 'estilista' && <EstilistaAdmin />}
              {modalAlta === 'servicio' && <InventarioForm />}
            </div>
          </div>
        </div>
      )}

      {mostrarGestor && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto pt-10 pb-20">
          <div className="bg-[var(--color-componente)] w-full max-w-6xl max-h-[85vh] rounded-[3rem] border border-[var(--color-borde)] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-[var(--color-borde)] flex justify-between items-center bg-[var(--color-secundario)] rounded-t-[3rem]">
              <h2 className="text-2xl font-serif italic text-[var(--color-acento)]">Gestor Maestro</h2>
              <button onClick={() => { setMostrarGestor(false); setCitaEditando(null); }} className="text-2xl font-black text-rose-500">✕</button>
            </div>
            {citaEditando ? (
              <form onSubmit={manejarGuardarEdicion} className="p-8 space-y-4 overflow-y-auto">
                <div className="bg-black/20 p-5 rounded-[2rem] border border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                  <div>
                    <p className="text-[10px] uppercase font-black opacity-40 ml-1">Cliente</p>
                    <p className="font-serif italic text-2xl text-[var(--color-acento)]">{citaEditando.clientes?.nombre}</p>
                    <p className="text-[10px] opacity-60 font-bold ml-1 tracking-widest">{citaEditando.clientes?.telefono || 'Sin teléfono'}</p>
                  </div>
                  {(() => {
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    const fechaCita = new Date(citaEditando.fecha_inicio);
                    fechaCita.setHours(0, 0, 0, 0);
                    const esPasada = fechaCita < hoy;

                    if (esPasada) return null;

                    return (
                      <button
                        type="button"
                        onClick={() => enviarConfirmacionWhatsApp(citaEditando)}
                        className="bg-[#25D366] text-white px-6 py-3 rounded-2xl font-black text-[11px] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#25D366]/20 uppercase tracking-widest"
                      >
                        <span>Confirmar</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.06 3.965l-1.127 4.12 4.212-1.105a7.947 7.947 0 0 0 3.788.965h.002c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                        </svg>
                      </button>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2">Fecha</label><input type="date" disabled={citaEditando.estatus === 'pagada'} className="w-full p-4 rounded-xl bg-[var(--color-secundario)] disabled:opacity-50" value={citaEditando.fecha} onChange={e => setCitaEditando({ ...citaEditando, fecha: e.target.value })} /></div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase opacity-50 ml-2">Estilista</label>
                    <SearchableSelect
                      options={estilistas.map(e => ({ value: e.id, label: e.nombre }))}
                      value={citaEditando.estilista_id}
                      onChange={val => setCitaEditando({ ...citaEditando, estilista_id: val })}
                      placeholder="Escoger..."
                      disabled={citaEditando.estatus === 'pagada'}
                    />
                  </div>
                  <div className="space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2">Hora</label><select disabled={citaEditando.estatus === 'pagada'} className="w-full p-4 rounded-xl bg-[var(--color-secundario)] disabled:opacity-50" value={citaEditando.hora} onChange={e => setCitaEditando({ ...citaEditando, hora: e.target.value })}>{HORARIOS.map(h => <option key={h} value={h}>{formatearHora12h(h)}</option>)}</select></div>
                  <div className="space-y-1"><label className="text-[10px] uppercase opacity-50 ml-2">Duración</label><select disabled={citaEditando.estatus === 'pagada'} className="w-full p-4 rounded-xl bg-[var(--color-secundario)] disabled:opacity-50" value={citaEditando.duracion} onChange={e => setCitaEditando({ ...citaEditando, duracion: e.target.value })}>{OPCIONES_DURACION.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] uppercase opacity-50 ml-2">Servicio</label>
                    <SearchableSelect
                      options={servicios.map(s => ({ value: s.id, label: s.nombre }))}
                      value={citaEditando.servicio_id}
                      onChange={val => setCitaEditando({ ...citaEditando, servicio_id: val })}
                      placeholder="¿Qué servicio realizamos?"
                      disabled={citaEditando.estatus === 'pagada'}
                    />
                  </div>
                </div>
                {citaEditando.estatus === 'pagada' ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-center">
                    <p className="text-emerald-500 font-black uppercase text-[10px] tracking-[0.2em]">✨ Cita Finalizada - Vista de solo lectura</p>
                  </div>
                ) : (
                  <div className="flex gap-4 pt-4"><button type="submit" className="flex-1 py-4 bg-[var(--color-acento)] text-black font-black uppercase rounded-xl">Guardar</button><button type="button" onClick={() => setCitaEditando(null)} className="flex-1 py-4 bg-slate-800 text-white font-black uppercase rounded-xl">Cancelar</button></div>
                )}
              </form>
            ) : (
              <div className="flex flex-col flex-grow overflow-hidden text-white">
                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-black/20">
                  <input type="text" placeholder="Cliente..." className="p-3 rounded-xl bg-[var(--color-fondo)] outline-none border border-white/5" value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} />
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Estilista...' },
                      ...estilistas.map(e => ({ value: e.id, label: e.nombre }))
                    ]}
                    value={filtroEstilista}
                    onChange={val => setFiltroEstilista(val)}
                    placeholder="Filtrar por estilista..."
                    className="flex-grow"
                  />
                  <input type="date" className="p-3 rounded-xl bg-[var(--color-fondo)]" value={filtroFechaInicio} onChange={e => setFiltroFechaInicio(e.target.value)} />
                  <input type="date" className="p-3 rounded-xl bg-[var(--color-fondo)]" value={filtroFechaFin} onChange={e => setFiltroFechaFin(e.target.value)} />
                </div>
                <div className="flex-grow overflow-auto p-4 custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-black/40 text-[var(--color-acento)] font-black uppercase text-[0.65em] tracking-widest">
                      <tr>
                        <th className="p-4">Fecha/Hora</th>
                        <th className="p-4">Cliente</th>
                        <th className="p-4">Estilista</th>
                        <th className="p-4">Servicio</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-borde)]">
                      {todasLasCitas.filter(c => c.clientes?.nombre.toLowerCase().includes(filtroTexto.toLowerCase())).map(cita => (
                        <tr key={cita.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 text-[0.75em] font-bold">{new Date(cita.fecha_inicio).toLocaleDateString()} {formatearHora12h(cita.fecha_inicio.substring(11, 16))}</td>
                          <td className="p-4 font-serif italic text-lg">{cita.clientes?.nombre}</td>
                          <td className="p-4 font-bold uppercase text-[10px] text-[var(--color-acento)]">{cita.estilistas?.nombre}</td>
                          <td className="p-4 opacity-50 uppercase text-[0.6em] truncate max-w-[150px]">{cita.inventario?.nombre}</td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                              {(() => {
                                const hoy = new Date();
                                hoy.setHours(0, 0, 0, 0);
                                const fechaCita = new Date(cita.fecha_inicio);
                                fechaCita.setHours(0, 0, 0, 0);
                                if (fechaCita >= hoy && cita.estatus !== 'pagada') {
                                  return (
                                    <button onClick={() => enviarConfirmacionWhatsApp(cita)} className="bg-[#25D366] text-white px-3 py-2 rounded-lg font-black text-[0.65em] flex items-center gap-1 hover:scale-105 transition-transform">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.06 3.965l-1.127 4.12 4.212-1.105a7.947 7.947 0 0 0 3.788.965h.002c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                                      </svg>
                                      <span>CONFIRMAR</span>
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                              <button onClick={() => setCitaEditando({ ...cita, fecha: cita.fecha_inicio.split('T')[0], hora: cita.fecha_inicio.substring(11, 16), duracion: cita.duracion_minutos })} className={`${cita.estatus === 'pagada' ? 'bg-slate-700 text-white' : 'bg-amber-400 text-black'} px-3 py-2 rounded-lg font-black text-[0.65em]`}>{cita.estatus === 'pagada' ? '👁️ VER' : '✎ EDITAR'}</button>
                              {cita.estatus !== 'pagada' && (
                                <button onClick={() => eliminarCita(cita.id)} className="bg-rose-500 text-white px-3 py-2 rounded-lg font-black text-[0.65em]">ELIMINAR</button>
                              )}
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
      <button onClick={() => setMostrarSidebarMobile(true)} className="xl:hidden fixed bottom-6 right-6 w-16 h-16 bg-[var(--color-acento)] text-black rounded-full shadow-[0_0_20px_var(--color-acento)] flex items-center justify-center text-3xl font-black z-[450] hover:scale-110 active:scale-95 transition-all animate-in zoom-in">+</button>
    </div>
  );
};