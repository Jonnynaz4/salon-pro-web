import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';
import { EstilistaAdmin } from '../estilistas/EstilistaAdmin';
import { ClienteForm } from '../clientes/ClienteForm';
import { InventarioForm } from '../inventario/InventarioForm';

export const PanelConfiguracion = ({ tema, setTema }) => {
  const [seccion, setSeccion] = useState('general');
  const [subSeccion, setSubSeccion] = useState('registro'); 
  const [tipoCambio, setTipoCambio] = useState(18.50);
  
  const [productos, setProductos] = useState([]);
  const [carritoCompras, setCarritoCompras] = useState([]);
  const [itemActual, setItemActual] = useState({ id_producto: '', cantidad: '', costo_unitario: '' });
  const [cargando, setCargando] = useState(false);

  const [historialCompras, setHistorialCompras] = useState([]);
  const [historialUso, setHistorialUso] = useState([]);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('configuracion').select('*').eq('clave', 'tipo_cambio').single();
      if (data) setTipoCambio(data.valor);
    };
    const fetchProductos = async () => {
      const { data } = await supabase.from('inventario').select('*').eq('tipo', 'producto').order('nombre');
      setProductos(data || []);
    };
    fetchConfig();
    fetchProductos();
    if (subSeccion === 'historial') cargarHistoriales();
  }, [seccion, subSeccion]);

  const cargarHistoriales = async () => {
    const { data: compras } = await supabase.from('compras').select('*, inventario(nombre)').order('fecha_compra', { ascending: false });
    const { data: uso } = await supabase.from('uso_interno').select('*, inventario(nombre), estilistas(nombre)').order('fecha_uso', { ascending: false });
    setHistorialCompras(compras || []);
    setHistorialUso(uso || []);
  };

  const agregarAlCarrito = () => {
    if (!itemActual.id_producto || !itemActual.cantidad || itemActual.cantidad <= 0) {
      alert("⚠️ Datos inválidos"); return;
    }
    const pInfo = productos.find(p => p.id === itemActual.id_producto);
    setCarritoCompras([...carritoCompras, { ...itemActual, nombre: pInfo.nombre, tempId: Date.now() }]);
    setItemActual({ id_producto: '', cantidad: '', costo_unitario: '' });
  };

  const procesarCompraCompleta = async () => {
    if (carritoCompras.length === 0 || cargando) return;
    setCargando(true);
    try {
      for (const item of carritoCompras) {
        const { data: prod } = await supabase.from('inventario').select('stock_actual').eq('id', item.id_producto).single();
        await supabase.from('compras').insert([{ id_producto: item.id_producto, cantidad: parseInt(item.cantidad), costo_unitario: parseFloat(item.costo_unitario || 0) }]);
        await supabase.from('inventario').update({ stock_actual: (prod?.stock_actual || 0) + parseInt(item.cantidad) }).eq('id', item.id_producto);
      }
      alert("✅ Inventario actualizado"); setCarritoCompras([]); setSubSeccion('historial');
    } catch (e) { alert(e.message); } finally { setCargando(false); }
  };

  const guardarTipoCambio = async () => {
    await supabase.from('configuracion').update({ valor: tipoCambio }).eq('clave', 'tipo_cambio');
    alert("✅ Tipo de cambio actualizado");
  };

  const guardarPreferenciasTema = () => {
    localStorage.setItem('atelier-tema', JSON.stringify(tema));
    alert("🎨 Estilo guardado");
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 md:gap-8 animate-in fade-in pb-20">
      
      {/* Botones laterales responsivos */}
      <div className="xl:w-80 flex flex-row xl:flex-col gap-3 overflow-x-auto pb-2 xl:pb-0 custom-scrollbar">
        {[
          { id: 'general', label: '⚙️ General', desc: 'Sistema' },
          { id: 'tema', label: '🎭 Temas', desc: 'Diseño' },
          { id: 'compras', label: '🛒 Compras', desc: 'Surtir' },
          { id: 'personal', label: '✂️ Personal', desc: 'Comisión' },
          { id: 'inventario', label: '📦 Catálogos', desc: 'Precios' },
          { id: 'clientes', label: '👥 Clientes', desc: 'Directorio' }
        ].map(item => (
          <button key={item.id} onClick={() => setSeccion(item.id)} className={`flex-shrink-0 xl:w-full text-left p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all ${seccion === item.id ? 'bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black shadow-lg' : 'bg-[var(--color-componente)] text-[var(--color-texto-componente)] border-[var(--color-borde)]'}`}>
            <p className="uppercase tracking-[0.1em] whitespace-nowrap" style={{ fontSize: '0.8em' }}>{item.label}</p>
            <p className="hidden md:block font-bold uppercase mt-1 opacity-50" style={{ fontSize: '0.65em' }}>{item.desc}</p>
          </button>
        ))}
      </div>

      <div className="flex-grow bg-[var(--color-componente)] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-[var(--color-borde)] min-h-[500px]">
        {seccion === 'compras' && (
          <div className="animate-in slide-in-from-right-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
              <h3 className="text-2xl font-serif italic text-[var(--color-texto-componente)] uppercase tracking-widest">Surtir Productos</h3>
              <div className="flex bg-[var(--color-secundario)] p-1 rounded-2xl border border-[var(--color-borde)] w-full sm:w-auto">
                <button onClick={() => setSubSeccion('registro')} className={`flex-1 sm:px-6 py-2.5 rounded-xl font-black uppercase ${subSeccion === 'registro' ? 'bg-[var(--color-acento)] text-[var(--color-texto-acento)]' : 'opacity-40'}`} style={{fontSize: '0.7em'}}>Nuevo</button>
                <button onClick={() => setSubSeccion('historial')} className={`flex-1 sm:px-6 py-2.5 rounded-xl font-black uppercase ${subSeccion === 'historial' ? 'bg-[var(--color-acento)] text-[var(--color-texto-acento)]' : 'opacity-40'}`} style={{fontSize: '0.7em'}}>Historial</button>
              </div>
            </div>

            {subSeccion === 'registro' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
                <div className="bg-[var(--color-secundario)] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-[var(--color-borde)] space-y-4 h-fit">
                   <select className="w-full p-4 rounded-xl bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none" value={itemActual.id_producto} onChange={e => setItemActual({...itemActual, id_producto: e.target.value})} style={{ fontSize: '0.9em' }}>
                     <option value="">Seleccionar Producto...</option>
                     {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                   </select>
                   <div className="grid grid-cols-2 gap-4">
                     <input type="number" className="p-4 rounded-xl bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold" value={itemActual.cantidad} onChange={e => setItemActual({...itemActual, cantidad: e.target.value})} placeholder="Cant." style={{ fontSize: '0.9em' }} />
                     <input type="number" className="p-4 rounded-xl bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold" value={itemActual.costo_unitario} onChange={e => setItemActual({...itemActual, costo_unitario: e.target.value})} placeholder="Costo $" style={{ fontSize: '0.9em' }} />
                   </div>
                   <button onClick={agregarAlCarrito} className="w-full bg-[var(--color-acento)] text-[var(--color-texto-acento)] py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg" style={{fontSize: '0.8em'}}>+ Agregar</button>
                </div>
                <div className="flex flex-col">
                  <div className="flex-grow bg-[var(--color-secundario)] rounded-[2rem] border-2 border-dashed border-[var(--color-borde)] p-6 min-h-[200px]">
                    {carritoCompras.length === 0 ? <p className="text-center opacity-30 mt-10 uppercase font-bold" style={{fontSize: '0.7em'}}>Lista vacía</p> : 
                      carritoCompras.map(item => (
                        <div key={item.tempId} className="bg-[var(--color-fondo)] p-4 rounded-2xl shadow-sm flex justify-between items-center mb-2">
                          <p className="font-black text-[var(--color-acento)] uppercase truncate pr-4" style={{fontSize: '0.8em'}}>{item.nombre} ({item.cantidad})</p>
                          <button onClick={() => setCarritoCompras(carritoCompras.filter(i => i.tempId !== item.tempId))} className="text-rose-400 font-black">✕</button>
                        </div>
                    ))}
                  </div>
                  <button disabled={carritoCompras.length === 0 || cargando} onClick={procesarCompraCompleta} className="w-full bg-[var(--color-acento)] text-[var(--color-texto-acento)] p-6 rounded-[2rem] font-black uppercase tracking-widest mt-6 shadow-xl disabled:opacity-30" style={{fontSize: '0.8em'}}>
                    {cargando ? 'Cargando...' : `Confirmar (${carritoCompras.length})`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[var(--color-borde)]">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-black/20 uppercase opacity-50 font-black" style={{fontSize: '0.7em'}}>
                    <tr><th className="p-4">Fecha</th><th className="p-4">Producto</th><th className="p-4 text-center">Cant.</th><th className="p-4 text-right">Costo</th></tr>
                  </thead>
                  <tbody style={{fontSize: '0.85em'}}>
                    {historialCompras.map(h => (
                      <tr key={h.id} className="border-t border-[var(--color-borde)]">
                        <td className="p-4 opacity-40">{new Date(h.fecha_compra).toLocaleDateString()}</td>
                        <td className="p-4 font-bold uppercase">{h.inventario?.nombre}</td>
                        <td className="p-4 text-center font-black text-[var(--color-acento)]">+{h.cantidad}</td>
                        <td className="p-4 text-right font-bold opacity-60">${h.costo_unitario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {seccion === 'general' && (
          <div className="max-w-md animate-in slide-in-from-right-4">
            <h3 className="text-2xl font-serif italic text-[var(--color-texto-componente)] uppercase tracking-widest mb-2">General</h3>
            <div className="bg-[var(--color-secundario)] p-6 md:p-8 rounded-[2rem] border-2 border-dashed border-[var(--color-borde)] mt-8">
              <label className="block font-black opacity-50 uppercase tracking-widest mb-3 ml-2" style={{fontSize: '0.7em'}}>Tipo de Cambio</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <input type="number" step="0.01" value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)} className="w-full p-4 md:p-5 rounded-2xl border-2 border-[var(--color-borde)] bg-[var(--color-fondo)] font-black text-2xl md:text-3xl text-[var(--color-acento)] outline-none" />
                <button onClick={guardarTipoCambio} className="px-8 py-4 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase rounded-2xl shadow-lg" style={{fontSize: '0.8em'}}>Guardar</button>
              </div>
            </div>
          </div>
        )}

        {seccion === 'tema' && (
          <div className="animate-in slide-in-from-right-4 max-w-2xl mx-auto pb-10">
            <h3 className="text-2xl font-serif italic text-[var(--color-acento)] uppercase tracking-widest mb-8 text-center">Laboratorio Visual</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              {[
                { l: 'Fondo Pantalla', v: 'fondo' }, { l: 'Fondo Ventanas', v: 'componente' },
                { l: 'Color Detalle', v: 'acento' }, { l: 'Letra Pantalla', v: 'textoGeneral' },
                { l: 'Letra Ventanas', v: 'textoComponente' }, { l: 'Letra Botones', v: 'textoAcento' }
              ].map(c => (
                <div key={c.v} className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                  <label className="font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]" style={{fontSize: '0.65em'}}>{c.l}</label>
                  <input type="color" className="w-full h-10 bg-transparent cursor-pointer" value={tema[c.v]} onChange={e => setTema({...tema, [c.v]: e.target.value})} />
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                <label className="font-black opacity-50 uppercase block mb-2 tracking-widest" style={{fontSize: '0.65em'}}>Tipografía</label>
                <select className="w-full p-3 rounded-xl bg-[var(--color-fondo)] text-[var(--color-acento)] outline-none font-bold" value={tema.fuente} onChange={e => setTema({...tema, fuente: e.target.value})} style={{fontSize: '0.85em'}}>
                  <option value="serif">Elegante</option><option value="sans">Moderna</option><option value="mono">Técnica</option>
                </select>
              </div>
              <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                <label className="font-black opacity-50 uppercase block mb-2 tracking-widest" style={{fontSize: '0.65em'}}>Tamaño Letra</label>
                <input type="range" min="12" max="26" className="w-full accent-[var(--color-acento)] cursor-pointer" value={tema.tamanioBase} onChange={e => setTema({...tema, tamanioBase: e.target.value})} />
                <p className="text-center font-bold mt-1 text-[var(--color-acento)]" style={{fontSize: '0.8em'}}>{tema.tamanioBase}px</p>
              </div>
            </div>
            <button onClick={guardarPreferenciasTema} className="w-full py-5 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase tracking-widest rounded-2xl shadow-xl mt-8" style={{fontSize: '0.85em'}}>Guardar Todo el Estilo</button>
          </div>
        )}

        {seccion === 'personal' && <EstilistaAdmin />}
        {seccion === 'inventario' && <InventarioForm />}
        {seccion === 'clientes' && <ClienteForm />}
      </div>
    </div>
  );
};