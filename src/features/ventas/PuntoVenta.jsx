import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../api/supabase';
import { SearchableSelect } from '../../components/ui/SearchableSelect';

export const PuntoVenta = ({ citasPendientes, alTerminar, fechaAgenda, setFechaAgenda, recargar }) => {
  const inputFechaRef = useRef(null);
  const [procesando, setProcesando] = useState(false);
  const [carrito, setCarrito] = useState([]);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [filtro, setFiltro] = useState('servicio');
  const [modo, setModo] = useState('con_cita'); 
  const [mostrarDropCitas, setMostrarDropCitas] = useState(false);
  
  const [estilistas, setEstilistas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [estilistaDirecto, setEstilistaDirecto] = useState('');
  const [clienteDirecto, setClienteDirecto] = useState('');

  const [tipoCambio, setTipoCambio] = useState(18.50);
  const [monedaPago, setMonedaPago] = useState('MXN');
  const [monedaCambio, setMonedaCambio] = useState('MXN');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [pagoCon, setPagoCon] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const { data: cat } = await supabase.from('inventario').select('*').order('nombre');
        const { data: est } = await supabase.from('estilistas').select('*').order('nombre');
        const { data: cli } = await supabase.from('clientes').select('*').order('nombre');
        const { data: config } = await supabase.from('configuracion').select('valor').eq('clave', 'tipo_cambio').single();
        
        setCatalogo(cat || []);
        setEstilistas(est || []);
        setClientes(cli || []);
        if (config) setTipoCambio(parseFloat(config.valor));
      } catch (e) {
        console.error("Error cargando maestros:", e);
      }
    };
    cargar();
  }, []);

  const obtenerIcono = (item) => {
    const nombre = (item.nombre || "").toLowerCase();
    if (item.tipo === 'servicio') {
      if (nombre.includes('corte')) return "💇";
      if (nombre.includes('tinte')) return "🎨";
      if (nombre.includes('barba')) return "🪒";
      return "✂️";
    }
    return "🧴";
  };

  const manejarSeleccionCita = (cita) => {
    setCitaSeleccionada(cita);
    setModo('con_cita');
    const item = catalogo.find(i => i.id === cita.servicio_id);
    setCarrito([{ 
      tempId: Date.now(),
      id: cita.servicio_id, 
      nombre: item?.nombre || cita.inventario?.nombre || 'Servicio', 
      precio: parseFloat(item?.precio_venta || cita.inventario?.precio_venta || 0), 
      cantidad: 1, 
      tipo: 'servicio' 
    }]);
  };

  const agregarAlCarrito = (item) => {
    setCarrito([...carrito, { 
      tempId: Date.now() + Math.random(),
      id: item.id, 
      nombre: item.nombre, 
      precio: parseFloat(item.precio_venta), 
      cantidad: 1, 
      tipo: item.tipo 
    }]);
  };

  const actualizarPrecio = (tempId, nuevoPrecio) => {
    setCarrito(carrito.map(item => item.tempId === tempId ? { ...item, precio: parseFloat(nuevoPrecio) || 0 } : item));
  };

  const eliminarDelCarrito = (tempId) => {
    setCarrito(carrito.filter(item => item.tempId !== tempId));
  };

  const totalMXN = carrito.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  const totalUSD = totalMXN / tipoCambio;
  const totalACobrar = monedaPago === 'MXN' ? totalMXN : totalUSD;

  const cambioFinal = (() => {
    const pago = parseFloat(pagoCon) || 0;
    if (pago < totalACobrar) return 0;
    const diff = pago - totalACobrar;
    return monedaPago === monedaCambio ? diff : (monedaPago === 'USD' ? diff * tipoCambio : diff / tipoCambio);
  })();

  const finalizarVenta = async () => {
    if (totalMXN <= 0 || procesando) return;
    if (modo === 'con_cita' && !citaSeleccionada) return alert("Selecciona una cita");
    if (modo === 'directa' && !estilistaDirecto) return alert("Selecciona un estilista");

    setProcesando(true);
    try {
      const { data: v, error } = await supabase.from('ventas').insert([{
        cita_id: modo === 'con_cita' ? citaSeleccionada.id : null,
        estilista_id: modo === 'con_cita' ? citaSeleccionada.estilista_id : estilistaDirecto,
        cliente_id: modo === 'con_cita' ? citaSeleccionada.cliente_id : (clienteDirecto || null),
        monto_total_mxn: totalMXN,
        monto_total_usd: totalUSD,
        metodo_pago: metodoPago,
        moneda_pago: monedaPago,
        moneda_cambio: monedaCambio,
        pago_con: parseFloat(pagoCon) || 0,
        cambio_entregado: cambioFinal
      }]).select();

      if (error) throw error;

      if (v && v[0]) {
        const detalles = carrito.map(i => ({ 
          venta_id: v[0].id, 
          inventario_id: i.id, 
          cantidad: i.cantidad, 
          precio_unitario: i.precio, 
          subtotal: i.precio * i.cantidad, 
          tipo: i.tipo 
        }));
        await supabase.from('ventas_detalles').insert(detalles);
        if (modo === 'con_cita') await supabase.from('citas').update({ estatus: 'pagada' }).eq('id', citaSeleccionada.id);
        
        alert("✅ Venta cobrada con éxito");
        setCarrito([]); setCitaSeleccionada(null); setPagoCon(''); setEstilistaDirecto(''); setClienteDirecto('');
        alTerminar();
      }
    } catch (e) { 
      alert("Error al procesar: " + e.message);
      console.error(e); 
    }
    setProcesando(false);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in h-[calc(100vh-140px)] overflow-hidden">
      
      <div className="xl:w-2/3 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 h-full">
        
        <div className="flex bg-[var(--color-componente)] p-1.5 rounded-full border border-[var(--color-borde)] shadow-lg w-fit">
          <button onClick={() => setModo('con_cita')} className={`px-8 py-2.5 rounded-full font-black uppercase transition-all ${modo === 'con_cita' ? 'bg-[var(--color-acento)] text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`} style={{ fontSize: '0.65em' }}>🗓️ Cobrar Cita</button>
          <button onClick={() => { setModo('directa'); setCitaSeleccionada(null); setCarrito([]); }} className={`px-8 py-2.5 rounded-full font-black uppercase transition-all ${modo === 'directa' ? 'bg-[var(--color-acento)] text-black shadow-lg' : 'opacity-40 hover:opacity-100'}`} style={{ fontSize: '0.65em' }}>🛍️ Venta Directa</button>
        </div>

        {modo === 'directa' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
            <div className="bg-[var(--color-componente)] p-5 rounded-[2.5rem] border border-[var(--color-borde)]">
              <label className="block text-[9px] font-black uppercase opacity-30 mb-2 ml-2 tracking-widest">Estilista</label>
              <SearchableSelect 
                options={estilistas.map(est => ({ value: est.id, label: est.nombre }))}
                value={estilistaDirecto}
                onChange={val => setEstilistaDirecto(val)}
                placeholder="¿Quién vende?"
              />
            </div>
            <div className="bg-[var(--color-componente)] p-5 rounded-[2.5rem] border border-[var(--color-borde)]">
              <label className="block text-[9px] font-black uppercase opacity-30 mb-2 ml-2 tracking-widest">Cliente</label>
              <SearchableSelect 
                options={[
                  { value: '', label: 'Cliente Mostrador' },
                  ...clientes.map(cli => ({ value: cli.id, label: cli.nombre }))
                ]}
                value={clienteDirecto}
                onChange={val => setClienteDirecto(val)}
                placeholder="Buscar cliente..."
              />
            </div>
          </div>
        )}

        {modo === 'con_cita' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex justify-between items-end ml-2">
              <div className="flex items-center gap-4">
                <h3 className="font-serif italic text-2xl text-[var(--color-acento)]">Citas Pendientes</h3>
                
                {/* SELECTOR DE FECHA PARA CAJA */}
                <div 
                  className="flex items-center gap-2 bg-[var(--color-componente)] px-3 py-1.5 rounded-full border border-[var(--color-borde)] cursor-pointer hover:border-[var(--color-acento)] transition-all group/date-caja"
                  onClick={() => { try { inputFechaRef.current.showPicker(); } catch(e) { inputFechaRef.current.click(); } }}
                >
                  <input 
                    ref={inputFechaRef}
                    type="date" 
                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                    value={fechaAgenda} 
                    onChange={e => {
                      setFechaAgenda(e.target.value);
                      if (recargar) recargar(e.target.value);
                    }}
                  />
                  <span className="text-[10px]">📅</span>
                  <span className="text-[10px] font-black uppercase text-white/60 group-hover/date-caja:text-[var(--color-acento)] transition-colors">
                    {new Date(fechaAgenda + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
              {citaSeleccionada && (
                <button 
                  onClick={() => { setCitaSeleccionada(null); setCarrito([]); setMostrarDropCitas(true); }}
                  className="text-[9px] font-black uppercase text-white/40 hover:text-[var(--color-acento)] transition-colors tracking-widest pb-1"
                >
                  ✕ Cambiar Cita
                </button>
              )}
            </div>

            {!citaSeleccionada ? (
              <div className="relative">
                <button 
                  onClick={() => setMostrarDropCitas(!mostrarDropCitas)}
                  className={`w-full p-6 rounded-[2.5rem] bg-[var(--color-componente)] border ${mostrarDropCitas ? 'border-[var(--color-acento)] shadow-[0_0_30px_rgba(197,160,89,0.1)]' : 'border-[var(--color-borde)]'} flex justify-between items-center transition-all group active:scale-[0.98]`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-acento)]/10 flex items-center justify-center text-xl">🗓️</div>
                    <span className="font-black uppercase tracking-[0.2em] text-xs text-white/80">
                      {citasPendientes.length > 0 ? `Hay ${citasPendientes.length} citas pendientes` : 'Sin citas para hoy'}
                    </span>
                  </div>
                  <span className={`text-[var(--color-acento)] transition-transform duration-300 ${mostrarDropCitas ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {mostrarDropCitas && citasPendientes.length > 0 && (
                  <div className="absolute z-[100] top-full left-0 right-0 mt-3 bg-[#121212] border border-[var(--color-borde)] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      {citasPendientes.map(cita => (
                        <button 
                          key={cita.id} 
                          onClick={() => { manejarSeleccionCita(cita); setMostrarDropCitas(false); }}
                          className="w-full p-5 text-left hover:bg-[var(--color-acento)] group transition-all border-b border-white/5 last:border-0 flex justify-between items-center"
                        >
                          <div className="flex flex-col">
                            <span className="font-serif italic text-lg text-white group-hover:text-black transition-colors">{cita.clientes?.nombre}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-colors">
                              {cita.inventario?.nombre} • {cita.estilistas?.nombre}
                            </span>
                          </div>
                          <span className="bg-white/5 group-hover:bg-black/20 px-3 py-1.5 rounded-full font-black text-[10px] text-[var(--color-acento)] group-hover:text-black">
                            {new Date(cita.fecha_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* TARJETA DE CITA SELECCIONADA - DISEÑO PREMIUM */
              <div className="bg-gradient-to-br from-[var(--color-componente)] to-[var(--color-secundario)] p-8 rounded-[3rem] border border-[var(--color-acento)] shadow-2xl relative overflow-hidden group animate-in zoom-in-95 duration-500">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[var(--color-acento)]/10 rounded-full blur-3xl group-hover:bg-[var(--color-acento)]/20 transition-all"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-[var(--color-acento)] text-black text-[10px] font-black uppercase rounded-full shadow-lg pulse">ACTIVA</span>
                      <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">
                        {new Date(citaSeleccionada.fecha_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <h2 className="font-serif italic text-4xl text-white tracking-tight leading-none overflow-hidden text-ellipsis">
                      {citaSeleccionada.clientes?.nombre}
                    </h2>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--color-acento)] opacity-80">
                      {citaSeleccionada.estilistas?.nombre} • {citaSeleccionada.inventario?.nombre}
                    </p>
                  </div>

                  <div className="flex flex-col items-end bg-black/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md min-w-[120px]">
                    <span className="text-[9px] font-black uppercase opacity-40 mb-1">Precio Base</span>
                    <span className="text-2xl font-serif italic text-white leading-none">
                      ${parseFloat(citaSeleccionada.inventario?.precio_venta || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {citaSeleccionada.notas && (
                  <div className="mt-6 pt-4 border-t border-white/5 italic text-white/40 text-[11px] flex gap-2 items-center">
                    <span className="not-italic">📄</span> "{citaSeleccionada.notas}"
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-[var(--color-componente)] p-6 md:p-8 rounded-[3rem] shadow-2xl border border-[var(--color-borde)] flex-grow">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-serif italic text-2xl text-white">Catálogo</h3>
            <div className="flex bg-[var(--color-fondo)] p-1 rounded-xl border border-[var(--color-borde)]">
              {['servicio', 'producto'].map(t => (
                <button key={t} onClick={() => setFiltro(t)} className={`px-6 py-2 rounded-lg font-black uppercase transition-all ${filtro === t ? 'bg-[var(--color-acento)] text-black' : 'text-white opacity-40 hover:opacity-100'}`} style={{ fontSize: '0.6em' }}>{t}s</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {catalogo.filter(i => i.tipo === filtro).map(item => (
              <button key={item.id} onClick={() => agregarAlCarrito(item)} className="group bg-[var(--color-secundario)] p-5 rounded-[2.5rem] border border-[var(--color-borde)] hover:border-[var(--color-acento)] transition-all flex flex-col items-center gap-3 active:scale-95">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-transform group-hover:scale-110 ${item.tipo === 'servicio' ? 'bg-[var(--color-acento)]/10 text-[var(--color-acento)]' : 'bg-slate-500/10 text-slate-400'}`}>
                    {obtenerIcono(item)}
                </div>
                <div className="text-center w-full">
                    <p className="font-bold text-white text-[10px] uppercase tracking-tighter truncate mb-1.5">{item.nombre}</p>
                    <p className="font-serif italic text-[var(--color-acento)] text-lg">${parseFloat(item.precio_venta).toFixed(2)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="xl:w-1/3 flex flex-col h-full overflow-hidden">
        <div className="bg-[var(--color-componente)] rounded-[3rem] shadow-2xl border border-[var(--color-borde)] overflow-hidden flex flex-col h-full">
          <div className="bg-[var(--color-acento)] p-6 text-black text-center flex-shrink-0">
            <h2 className="font-serif italic text-2xl mb-1 leading-none">Resumen</h2>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
              {modo === 'con_cita' ? (citaSeleccionada ? `Cita: ${citaSeleccionada.clientes?.nombre}` : '---') : 'Venta Directa'}
            </p>
          </div>
          <div className="p-6 space-y-5 flex-grow overflow-y-auto custom-scrollbar scrollbar-hide">
            <div className="space-y-2 border-b border-[var(--color-borde)] pb-4">
              {carrito.map((item) => (
                <div key={item.tempId} className="flex justify-between items-center py-1">
                  <div className="flex items-center gap-2 flex-grow overflow-hidden">
                    <button onClick={() => eliminarDelCarrito(item.tempId)} className="text-rose-500 text-xs font-bold px-1">✕</button>
                    <p className="font-serif italic text-white text-sm truncate">{item.nombre}</p>
                  </div>
                  <div className="flex items-center text-[var(--color-acento)] bg-[var(--color-fondo)] px-3 py-1 rounded-lg border border-white/5">
                    <span className="text-[10px] mr-1 opacity-40">$</span>
                    <input 
                      type="number" 
                      value={item.precio} 
                      onChange={(e) => actualizarPrecio(item.tempId, e.target.value)} 
                      onFocus={(e) => e.target.select()}
                      className="bg-transparent text-right font-black w-16 outline-none text-sm text-white" 
                    />
                  </div>
                </div>
              ))}
              {carrito.length === 0 && <p className="text-center opacity-20 py-4 text-[9px] uppercase font-bold tracking-widest italic text-white">Vacío</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--color-secundario)] p-2.5 rounded-xl border border-[var(--color-borde)] text-center text-white">
                <label className="font-black opacity-30 uppercase block mb-0.5 text-[8px]">Pago con</label>
                <select value={monedaPago} onChange={e => setMonedaPago(e.target.value)} className="bg-transparent font-bold text-[var(--color-acento)] outline-none text-xs w-full text-center">
                  <option value="MXN" className="bg-[#1a1a1a]">Pesos</option>
                  <option value="USD" className="bg-[#1a1a1a]">Dólares</option>
                </select>
              </div>
              <div className="bg-[var(--color-secundario)] p-2.5 rounded-xl border border-[var(--color-borde)] text-center text-white">
                <label className="font-black opacity-30 uppercase block mb-0.5 text-[8px]">Cambio en</label>
                <select value={monedaCambio} onChange={e => setMonedaCambio(e.target.value)} className="bg-transparent font-bold text-[var(--color-acento)] outline-none text-xs w-full text-center">
                  <option value="MXN" className="bg-[#1a1a1a]">Pesos</option>
                  <option value="USD" className="bg-[#1a1a1a]">Dólares</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['efectivo', 'tarjeta', 'transf.'].map(m => (
                <button key={m} onClick={() => setMetodoPago(m === 'transf.' ? 'transferencia' : m)} className={`py-2 rounded-xl font-black uppercase text-[8px] transition-all border ${metodoPago.includes(m.substring(0,3)) ? 'bg-[var(--color-acento)] text-black border-[var(--color-acento)] shadow-lg' : 'opacity-30 border-[var(--color-borde)] text-white'}`}>{m}</button>
              ))}
            </div>
            <div className="bg-[var(--color-fondo)] p-4 rounded-2xl border border-[var(--color-borde)] text-center shadow-inner text-white">
              <label className="block font-black opacity-30 uppercase mb-1 text-[8px]">Pago Recibido ({monedaPago})</label>
              <input 
                type="number" 
                value={pagoCon} 
                onChange={e => setPagoCon(e.target.value)} 
                onFocus={(e) => e.target.value === '0' ? setPagoCon('') : e.target.select()}
                className="w-full bg-transparent text-4xl font-serif italic text-center text-[var(--color-acento)] outline-none" 
                placeholder="0" 
              />
            </div>
            <div className="space-y-1.5 pt-2 text-white">
                <div className="flex justify-between items-end px-2">
                    <span className="font-black opacity-30 uppercase text-[9px]">Total:</span>
                    <span className="font-serif italic text-3xl text-white">${totalACobrar.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-500 font-bold px-4 py-2 bg-emerald-500/5 rounded-xl">
                    <span className="uppercase text-[8px] font-black">Cambio:</span>
                    <span className="text-xl font-serif italic">${cambioFinal.toFixed(2)}</span>
                </div>
            </div>
            <button onClick={finalizarVenta} disabled={procesando || (modo === 'con_cita' && !citaSeleccionada) || (modo === 'directa' && !estilistaDirecto) || carrito.length === 0} className="w-full py-4 bg-white text-black font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl active:scale-95 transition-all hover:bg-[var(--color-acento)] disabled:opacity-10 text-[10px]">
              {procesando ? 'Procesando...' : 'FINALIZAR ✨'}
            </button>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(197, 160, 89, 0.2); border-radius: 10px; } .scrollbar-hide::-webkit-scrollbar { display: none; }`}} />
    </div>
  );
};