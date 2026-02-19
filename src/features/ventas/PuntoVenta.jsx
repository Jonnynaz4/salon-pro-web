import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';

export const PuntoVenta = ({ citasPendientes, alTerminar }) => {
  const [procesando, setProcesando] = useState(false);
  const [carrito, setCarrito] = useState([]);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [filtro, setFiltro] = useState('servicio');
  const [modo, setModo] = useState('con_cita'); 
  
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
              <select value={estilistaDirecto} onChange={e => setEstilistaDirecto(e.target.value)} className="w-full p-3.5 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] text-white font-bold outline-none text-sm">
                <option value="">¿Quién vende?</option>
                {estilistas.map(est => <option key={est.id} value={est.id}>{est.nombre}</option>)}
              </select>
            </div>
            <div className="bg-[var(--color-componente)] p-5 rounded-[2.5rem] border border-[var(--color-borde)]">
              <label className="block text-[9px] font-black uppercase opacity-30 mb-2 ml-2 tracking-widest">Cliente</label>
              <select value={clienteDirecto} onChange={e => setClienteDirecto(e.target.value)} className="w-full p-3.5 bg-[var(--color-secundario)] rounded-2xl border border-[var(--color-borde)] text-white font-bold outline-none text-sm">
                <option value="">Cliente Mostrador</option>
                {clientes.map(cli => <option key={cli.id} value={cli.id}>{cli.nombre}</option>)}
              </select>
            </div>
          </div>
        )}

        {modo === 'con_cita' && (
          <div className="space-y-4">
            <h3 className="font-serif italic text-2xl text-[var(--color-acento)] ml-2">Citas Pendientes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {citasPendientes.map(cita => (
                <button key={cita.id} onClick={() => manejarSeleccionCita(cita)} className={`p-5 rounded-[2rem] border transition-all text-left ${citaSeleccionada?.id === cita.id ? 'border-[var(--color-acento)] bg-[var(--color-secundario)] shadow-xl scale-[1.01]' : 'border-[var(--color-borde)] bg-[var(--color-componente)] opacity-60 hover:opacity-100'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="bg-[var(--color-acento)] text-black font-black px-2.5 py-1 rounded-lg text-[9px]">{new Date(cita.fecha_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <span className="text-[9px] font-bold opacity-50 uppercase tracking-widest">{cita.estilistas?.nombre}</span>
                  </div>
                  <h4 className="font-serif italic text-lg text-white truncate">{cita.clientes?.nombre}</h4>
                </button>
              ))}
              {citasPendientes.length === 0 && <p className="opacity-30 italic p-6 text-center w-full col-span-2 text-white">Sin citas.</p>}
            </div>
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
                    <input type="number" value={item.precio} onChange={(e) => actualizarPrecio(item.tempId, e.target.value)} className="bg-transparent text-right font-black w-16 outline-none text-sm text-white" />
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
              <input type="number" value={pagoCon} onChange={e => setPagoCon(e.target.value)} className="w-full bg-transparent text-4xl font-serif italic text-center text-[var(--color-acento)] outline-none" placeholder="0" />
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