import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';

export const PuntoVenta = ({ citasPendientes, alTerminar }) => {
  const [procesando, setProcesando] = useState(false);
  const [carrito, setCarrito] = useState([]);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [filtro, setFiltro] = useState('servicio');
  
  const [tipoCambio, setTipoCambio] = useState(18.50);
  const [monedaPago, setMonedaPago] = useState('MXN');
  const [monedaCambio, setMonedaCambio] = useState('MXN');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [pagoCon, setPagoCon] = useState('');

  useEffect(() => {
    const cargar = async () => {
      const { data: cat } = await supabase.from('inventario').select('*');
      const { data: config } = await supabase.from('configuracion').select('valor').eq('clave', 'tipo_cambio').single();
      setCatalogo(cat || []);
      if (config) setTipoCambio(parseFloat(config.valor));
    };
    cargar();
  }, []);

  const manejarSeleccionCita = (cita) => {
    setCitaSeleccionada(cita);
    const item = catalogo.find(i => i.id === cita.servicio_id);
    const precio = parseFloat(item?.precio_venta || cita.inventario?.precio_venta || 0);
    setCarrito([{ 
      tempId: Date.now(),
      id: cita.servicio_id, 
      nombre: item?.nombre || cita.inventario?.nombre, 
      precio, 
      cantidad: 1, 
      tipo: 'servicio' 
    }]);
  };

  const agregarAlCarrito = (item) => {
    if (!citaSeleccionada) return alert("Selecciona una cita primero");
    setCarrito([...carrito, { 
      tempId: Date.now(),
      id: item.id, 
      nombre: item.nombre, 
      precio: parseFloat(item.precio_venta), 
      cantidad: 1, 
      tipo: item.tipo 
    }]);
  };

  const actualizarPrecio = (tempId, nuevoPrecio) => {
    setCarrito(carrito.map(item => 
      item.tempId === tempId ? { ...item, precio: parseFloat(nuevoPrecio) || 0 } : item
    ));
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
    if (monedaPago === 'USD' && monedaCambio === 'MXN') return diff * tipoCambio;
    if (monedaPago === 'MXN' && monedaCambio === 'USD') return diff / tipoCambio;
    return diff;
  })();

  const finalizarVenta = async () => {
    if (!citaSeleccionada || totalMXN <= 0 || procesando) return;
    setProcesando(true);
    try {
      const { data: v, error } = await supabase.from('ventas').insert([{
        cita_id: citaSeleccionada.id, estilista_id: citaSeleccionada.estilista_id,
        monto_total_mxn: totalMXN, monto_total_usd: totalUSD,
        metodo_pago: metodoPago, moneda_pago: monedaPago, moneda_cambio: monedaCambio,
        pago_con: parseFloat(pagoCon) || 0, cambio_entregado: cambioFinal
      }]).select();

      if (!error && v) {
        const detalles = carrito.map(i => ({ 
          venta_id: v[0].id, 
          inventario_id: i.id, 
          cantidad: i.cantidad, 
          precio_unitario: i.precio, 
          subtotal: i.precio * i.cantidad, 
          tipo: i.tipo 
        }));
        await supabase.from('ventas_detalles').insert(detalles);
        await supabase.from('citas').update({ estatus: 'pagada' }).eq('id', citaSeleccionada.id);
        alert("Cobro exitoso ✨");
        alTerminar();
      }
    } catch (e) { console.error(e); }
    setProcesando(false);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 md:gap-10 animate-in fade-in pb-20">
      <div className="xl:w-2/3 space-y-8">
        <h3 className="font-serif italic text-2xl md:text-3xl text-[var(--color-acento)]">Citas por Cobrar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {citasPendientes.map(cita => (
            <button key={cita.id} onClick={() => manejarSeleccionCita(cita)} className={`p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border transition-all ${citaSeleccionada?.id === cita.id ? 'border-[var(--color-acento)] bg-[var(--color-secundario)] shadow-xl' : 'border-[var(--color-borde)] bg-[var(--color-componente)] opacity-50'}`}>
              <div className="flex justify-between items-start mb-4">
                <span className="bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black px-3 py-1 rounded-full uppercase tracking-tighter" style={{ fontSize: '0.6em' }}>{new Date(cita.fecha_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <span className="font-bold text-[var(--color-texto-componente)] opacity-50 uppercase tracking-widest" style={{ fontSize: '0.7em' }}>{cita.estilistas?.nombre}</span>
              </div>
              <h4 className="font-serif italic text-xl md:text-2xl text-[var(--color-texto-componente)] text-left leading-tight">{cita.clientes?.nombre}</h4>
              <p className="font-bold text-[var(--color-acento)] uppercase mt-2 tracking-widest text-left" style={{ fontSize: '0.75em' }}>{cita.inventario?.nombre}</p>
            </button>
          ))}
          {citasPendientes.length === 0 && <p className="col-span-full opacity-30 italic p-10 text-center">No hay citas pendientes hoy.</p>}
        </div>
        
        {citaSeleccionada && (
          <div className="bg-[var(--color-componente)] p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl border border-[var(--color-borde)] mt-6 animate-in slide-in-from-bottom-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8">
              <h3 className="font-serif italic text-xl text-[var(--color-texto-componente)]">Añadir Extras</h3>
              <div className="flex bg-[var(--color-secundario)] p-1 rounded-2xl border border-[var(--color-borde)] w-full sm:w-auto">
                {['servicio', 'producto'].map(t => (
                  <button key={t} onClick={() => setFiltro(t)} className={`flex-1 sm:px-8 py-2.5 rounded-xl font-black uppercase transition-all ${filtro === t ? 'bg-[var(--color-acento)] text-[var(--color-texto-acento)] shadow-lg' : 'text-[var(--color-texto-componente)] opacity-40'}`} style={{ fontSize: '0.7em' }}>{t}s</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {catalogo.filter(i => i.tipo === filtro).map(item => (
                <button key={item.id} onClick={() => agregarAlCarrito(item)} className="bg-[var(--color-secundario)] p-4 md:p-5 rounded-[1.5rem] md:rounded-3xl border border-[var(--color-borde)] hover:border-[var(--color-acento)] transition-all text-center">
                  <p className="font-bold text-[var(--color-texto-componente)] opacity-50 uppercase mb-1 tracking-tighter truncate" style={{ fontSize: '0.7em' }}>{item.nombre}</p>
                  <p className="font-serif italic text-[var(--color-acento)] text-base md:text-lg">${parseFloat(item.precio_venta).toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="xl:w-1/3">
        <div className="bg-[var(--color-componente)] rounded-[2.5rem] md:rounded-[4rem] shadow-2xl border border-[var(--color-borde)] overflow-hidden sticky top-24 md:top-32">
          <div className="bg-[var(--color-acento)] p-6 md:p-8 text-[var(--color-texto-acento)] text-center">
            <h2 className="font-serif italic text-2xl md:text-3xl tracking-wide leading-tight">Punto de Venta</h2>
            <div className="flex justify-center gap-4 md:gap-6 mt-4 opacity-70 uppercase font-black tracking-[0.1em]" style={{ fontSize: '0.65em' }}>
              <div>MXN: ${totalMXN.toFixed(2)}</div>
              <div>USD: ${totalUSD.toFixed(2)}</div>
            </div>
          </div>
          
          <div className="p-6 md:p-10 space-y-6 text-[var(--color-texto-componente)]">
            <div className="space-y-3 max-h-[250px] overflow-y-auto border-b border-[var(--color-borde)] pb-6 custom-scrollbar">
              {carrito.map((item) => (
                <div key={item.tempId} className="flex flex-col gap-1 py-2 border-b border-white/5 last:border-0 group">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <button onClick={() => eliminarDelCarrito(item.tempId)} className="text-rose-500 text-xs pr-1">✕</button>
                      <p className="font-serif italic opacity-80 truncate" style={{ fontSize: '0.95em' }}>{item.nombre}</p>
                    </div>
                    <div className="flex items-center text-[var(--color-acento)] font-black flex-shrink-0">
                      <span className="mr-0.5" style={{ fontSize: '0.85em' }}>$</span>
                      <input 
                        type="number" 
                        value={item.precio} 
                        onChange={(e) => actualizarPrecio(item.tempId, e.target.value)}
                        className="bg-transparent text-right font-black w-16 md:w-20 outline-none p-0"
                        style={{ fontSize: '0.95em' }}
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {carrito.length === 0 && <p className="text-center opacity-30 uppercase font-bold tracking-widest py-4" style={{ fontSize: '0.7em' }}>Carrito vacío</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-[var(--color-secundario)] p-3 md:p-4 rounded-2xl border border-[var(--color-borde)]">
                <label className="font-black opacity-40 uppercase block mb-1 tracking-widest" style={{ fontSize: '0.6em' }}>Paga con</label>
                <select value={monedaPago} onChange={e => setMonedaPago(e.target.value)} className="w-full bg-transparent font-bold text-[var(--color-acento)] outline-none" style={{ fontSize: '0.8em' }}>
                  <option value="MXN" className="bg-[var(--color-secundario)]">Pesos</option>
                  <option value="USD" className="bg-[var(--color-secundario)]">USD</option>
                </select>
              </div>
              <div className="bg-[var(--color-secundario)] p-3 md:p-4 rounded-2xl border border-[var(--color-borde)]">
                <label className="font-black opacity-40 uppercase block mb-1 tracking-widest" style={{ fontSize: '0.6em' }}>Cambio en</label>
                <select value={monedaCambio} onChange={e => setMonedaCambio(e.target.value)} className="w-full bg-transparent font-bold text-[var(--color-acento)] outline-none" style={{ fontSize: '0.8em' }}>
                  <option value="MXN" className="bg-[var(--color-secundario)]">Pesos</option>
                  <option value="USD" className="bg-[var(--color-secundario)]">USD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['efectivo', 'tarjeta', 'transf.'].map(m => (
                <button key={m} onClick={() => setMetodoPago(m === 'transf.' ? 'transferencia' : m)} className={`py-2.5 rounded-xl font-black uppercase transition-all ${metodoPago.startsWith(m.substring(0,3)) ? 'bg-[var(--color-acento)] text-[var(--color-texto-acento)] shadow-lg' : 'bg-[var(--color-secundario)] opacity-40 border border-[var(--color-borde)]'}`} style={{ fontSize: '0.6em' }}>{m}</button>
              ))}
            </div>

            <div className="bg-[var(--color-fondo)] p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-[var(--color-borde)] text-center">
              <label className="block font-black opacity-40 uppercase mb-2 tracking-widest" style={{ fontSize: '0.65em' }}>Recibido ({monedaPago})</label>
              <input type="number" value={pagoCon} onChange={e => setPagoCon(e.target.value)} className="w-full bg-transparent text-3xl md:text-5xl font-serif italic text-center text-[var(--color-acento)] outline-none" placeholder="0" />
            </div>

            <div className="flex justify-between items-end border-t border-[var(--color-borde)] pt-4">
              <span className="font-black opacity-40 uppercase tracking-widest" style={{ fontSize: '0.75em' }}>Total:</span>
              <span className="font-serif italic text-3xl md:text-4xl leading-none">${totalACobrar.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-emerald-500 font-bold px-3 py-2 bg-emerald-500/5 rounded-xl">
              <span className="uppercase tracking-[0.1em] font-black" style={{ fontSize: '0.65em' }}>Cambio:</span>
              <span className="text-xl md:text-2xl font-serif italic">${cambioFinal.toFixed(2)}</span>
            </div>

            <button onClick={finalizarVenta} disabled={procesando || !citaSeleccionada} className="w-full py-5 md:py-6 bg-[var(--color-texto-componente)] text-[var(--color-fondo)] font-black uppercase tracking-[0.2em] rounded-[1.5rem] md:rounded-[2rem] shadow-xl active:scale-95 transition-all hover:bg-[var(--color-acento)] hover:text-[var(--color-texto-acento)] disabled:opacity-10" style={{ fontSize: '0.8em' }}>
              {procesando ? 'Cargando...' : 'FINALIZAR COBRO ✨'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};