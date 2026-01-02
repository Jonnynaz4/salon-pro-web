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
      alert("⚠️ Ingresa producto y cantidad válida");
      return;
    }
    const productoInfo = productos.find(p => p.id === itemActual.id_producto);
    setCarritoCompras([...carritoCompras, { ...itemActual, nombre: productoInfo.nombre, tempId: Date.now() }]);
    setItemActual({ id_producto: '', cantidad: '', costo_unitario: '' });
  };

  const procesarCompraCompleta = async () => {
    if (carritoCompras.length === 0) return;
    const confirmar = window.confirm(`¿Deseas procesar la entrada de ${carritoCompras.length} productos?`);
    if (!confirmar) return;

    setCargando(true);
    try {
      for (const item of carritoCompras) {
        const { data: prod } = await supabase.from('inventario').select('stock_actual').eq('id', item.id_producto).single();
        await supabase.from('compras').insert([{ 
          id_producto: item.id_producto, 
          cantidad: parseInt(item.cantidad), 
          costo_unitario: parseFloat(item.costo_unitario || 0)
        }]);
        await supabase.from('inventario').update({ 
          stock_actual: (prod?.stock_actual || 0) + parseInt(item.cantidad) 
        }).eq('id', item.id_producto);
      }
      alert("✅ Inventario actualizado con éxito");
      setCarritoCompras([]);
      setSubSeccion('historial');
    } catch (e) { 
      alert("Error: " + e.message); 
    } finally { 
      setCargando(false); 
    }
  };

  const guardarTipoCambio = async () => {
    const { error } = await supabase.from('configuracion').update({ valor: tipoCambio }).eq('clave', 'tipo_cambio');
    if (!error) alert("✅ Tipo de cambio actualizado");
  };

  const guardarPreferenciasTema = () => {
    localStorage.setItem('atelier-tema', JSON.stringify(tema));
    alert("🎨 Estilo guardado con éxito");
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in duration-500 w-full pb-20">
      <div className="xl:w-80 space-y-3">
        <h2 className="text-2xl font-serif italic text-[var(--color-acento)] mb-8 ml-2 uppercase tracking-widest">Ajustes</h2>
        {[
          { id: 'general', label: '⚙️ General', desc: 'Sistema y Moneda' },
          { id: 'tema', label: '🎭 Temas', desc: 'Personalizar Colores' },
          { id: 'compras', label: '🛒 Compras', desc: 'Surtir Inventario' },
          { id: 'personal', label: '✂️ Personal', desc: 'Estilistas y Comisiones' },
          { id: 'inventario', label: '📦 Catálogos', desc: 'Servicios y Productos' },
          { id: 'clientes', label: '👥 Clientes', desc: 'Directorio completo' }
        ].map(item => (
          <button key={item.id} onClick={() => setSeccion(item.id)} className={`w-full text-left p-6 rounded-[2rem] border transition-all ${seccion === item.id ? 'bg-[var(--color-acento)] text-[var(--color-texto-acento)] border-[var(--color-acento)] shadow-xl font-black' : 'bg-[var(--color-componente)] text-[var(--color-texto-componente)] border-[var(--color-borde)] hover:border-[var(--color-acento)]'}`}>
            <p className="text-[10px] uppercase tracking-[0.2em]">{item.label}</p>
            <p className="text-[8px] font-bold uppercase mt-1 opacity-50">{item.desc}</p>
          </button>
        ))}
      </div>

      <div className="flex-grow bg-[var(--color-componente)] p-10 rounded-[3rem] shadow-2xl border border-[var(--color-borde)] min-h-[700px] text-[var(--color-texto-componente)]">
        {seccion === 'compras' && (
          <div className="animate-in slide-in-from-right-4">
            <div className="flex justify-between items-center mb-10 px-4">
              <h3 className="text-2xl font-serif italic text-[var(--color-texto-componente)] uppercase tracking-widest">Inventario</h3>
              <div className="flex bg-[var(--color-secundario)] p-1.5 rounded-2xl border border-[var(--color-borde)]">
                <button onClick={() => setSubSeccion('registro')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${subSeccion === 'registro' ? 'bg-[var(--color-acento)] text-[var(--color-texto-acento)]' : 'opacity-40'}`}>Nuevo</button>
                <button onClick={() => setSubSeccion('historial')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${subSeccion === 'historial' ? 'bg-[var(--color-acento)] text-[var(--color-texto-acento)]' : 'opacity-40'}`}>Historial</button>
              </div>
            </div>

            {subSeccion === 'registro' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-[var(--color-secundario)] p-8 rounded-[2.5rem] border border-[var(--color-borde)] space-y-4 h-fit">
                   <select className="w-full p-4 rounded-xl bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold" value={itemActual.id_producto} onChange={e => setItemActual({...itemActual, id_producto: e.target.value})}>
                     <option value="">Seleccionar Producto...</option>
                     {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                   </select>
                   <div className="grid grid-cols-2 gap-4">
                     <input type="number" className="p-4 rounded-xl bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold" value={itemActual.cantidad} onChange={e => setItemActual({...itemActual, cantidad: e.target.value})} placeholder="Cantidad" />
                     <input type="number" className="p-4 rounded-xl bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold" value={itemActual.costo_unitario} onChange={e => setItemActual({...itemActual, costo_unitario: e.target.value})} placeholder="Costo Unitario $" />
                   </div>
                   <button onClick={agregarAlCarrito} className="w-full bg-[var(--color-acento)] text-[var(--color-texto-acento)] p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:opacity-90 shadow-lg">+ Agregar</button>
                </div>
                <div className="flex flex-col">
                  <div className="flex-grow bg-[var(--color-secundario)] rounded-[2.5rem] border-2 border-dashed border-[var(--color-borde)] p-6 min-h-[300px]">
                    {carritoCompras.length === 0 ? <p className="text-center opacity-30 mt-20 uppercase text-[10px] font-bold">Lista vacía</p> : 
                      carritoCompras.map(item => (
                        <div key={item.tempId} className="bg-[var(--color-fondo)] p-4 rounded-2xl shadow-sm flex justify-between items-center mb-2">
                          <p className="text-sm font-black text-[var(--color-acento)] uppercase">{item.nombre} ({item.cantidad})</p>
                          <button onClick={() => setCarritoCompras(carritoCompras.filter(i => i.tempId !== item.tempId))} className="text-rose-400 font-black px-2">✕</button>
                        </div>
                    ))}
                  </div>
                  <button disabled={carritoCompras.length === 0 || cargando} onClick={procesarCompraCompleta} className="w-full bg-[var(--color-acento)] text-[var(--color-texto-acento)] p-6 rounded-[2rem] font-black uppercase text-[11px] tracking-widest mt-6 shadow-xl disabled:opacity-30">
                    {cargando ? 'Procesando...' : `Confirmar Compra (${carritoCompras.length})`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-10 animate-in fade-in">
                <section>
                  <h4 className="text-[11px] font-black text-[var(--color-acento)] uppercase tracking-[0.3em] mb-4 ml-4">Historial de Compras</h4>
                  <div className="bg-[var(--color-secundario)] rounded-[2rem] border border-[var(--color-borde)] overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/20 uppercase opacity-50 font-black">
                        <tr><th className="p-4">Fecha</th><th className="p-4">Producto</th><th className="p-4 text-center">Cant.</th><th className="p-4 text-right">Costo Unit.</th></tr>
                      </thead>
                      <tbody>
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
                </section>
                <section>
                  <h4 className="text-[11px] font-black text-rose-400 uppercase tracking-[0.3em] mb-4 ml-4">Historial de Uso Interno</h4>
                  <div className="bg-[var(--color-secundario)] rounded-[2rem] border border-[var(--color-borde)] overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-black/20 uppercase opacity-50 font-black">
                        <tr><th className="p-4">Fecha</th><th className="p-4">Producto</th><th className="p-4">Estilista</th><th className="p-4 text-center">Cant.</th></tr>
                      </thead>
                      <tbody>
                        {historialUso.map(h => (
                          <tr key={h.id} className="border-t border-[var(--color-borde)]">
                            <td className="p-4 opacity-40">{new Date(h.fecha_uso).toLocaleDateString()}</td>
                            <td className="p-4 font-bold uppercase">{h.inventario?.nombre}</td>
                            <td className="p-4 font-bold text-[var(--color-acento)]">{h.estilistas?.nombre || 'General'}</td>
                            <td className="p-4 text-center font-black text-rose-500">-{h.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {seccion === 'general' && (
          <div className="max-w-md animate-in slide-in-from-right-4">
            <h3 className="text-2xl font-serif italic text-[var(--color-texto-componente)] uppercase tracking-widest mb-2">General</h3>
            <div className="bg-[var(--color-secundario)] p-8 rounded-[2.5rem] border-2 border-dashed border-[var(--color-borde)] mt-8">
              <label className="block text-[10px] font-black opacity-50 uppercase tracking-widest mb-3 ml-2">Tipo de Cambio</label>
              <div className="flex gap-4">
                <input type="number" step="0.01" value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)} className="w-full p-5 rounded-2xl border-2 border-[var(--color-borde)] bg-[var(--color-fondo)] font-black text-3xl text-[var(--color-acento)] shadow-inner outline-none focus:border-[var(--color-acento)] transition-all" />
                <button onClick={guardarTipoCambio} className="px-8 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase text-xs rounded-2xl hover:opacity-90 shadow-lg">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {seccion === 'tema' && (
          <div className="animate-in slide-in-from-right-4 max-w-2xl mx-auto">
            <h3 className="text-2xl font-serif italic text-[var(--color-acento)] uppercase tracking-widest mb-10 text-center">Laboratorio Visual</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                  <label className="text-[9px] font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]">Fondo Pantalla</label>
                  <input type="color" className="w-full h-10 bg-transparent" value={tema.fondo} onChange={e => setTema({...tema, fondo: e.target.value})} />
                </div>
                <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                  <label className="text-[9px] font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]">Fondo Ventanas</label>
                  <input type="color" className="w-full h-10 bg-transparent" value={tema.componente} onChange={e => setTema({...tema, componente: e.target.value})} />
                </div>
                <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                  <label className="text-[9px] font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]">Color Detalle</label>
                  <input type="color" className="w-full h-10 bg-transparent" value={tema.acento} onChange={e => setTema({...tema, acento: e.target.value})} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                  <label className="text-[9px] font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]">Letra Pantalla</label>
                  <input type="color" className="w-full h-10 bg-transparent" value={tema.textoGeneral} onChange={e => setTema({...tema, textoGeneral: e.target.value})} />
                </div>
                <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                  <label className="text-[9px] font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]">Letra Ventanas</label>
                  <input type="color" className="w-full h-10 bg-transparent" value={tema.textoComponente} onChange={e => setTema({...tema, textoComponente: e.target.value})} />
                </div>
                <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                  <label className="text-[9px] font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]">Letra Botones</label>
                  <input type="color" className="w-full h-10 bg-transparent" value={tema.textoAcento} onChange={e => setTema({...tema, textoAcento: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                <label className="text-[9px] font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]">Tipografía</label>
                <select className="w-full p-3 rounded-xl bg-[var(--color-fondo)] text-[var(--color-acento)] text-xs outline-none" value={tema.fuente} onChange={e => setTema({...tema, fuente: e.target.value})}>
                  <option value="serif">Elegante (Serif)</option>
                  <option value="sans">Moderna (Sans)</option>
                  <option value="mono">Técnica (Monospace)</option>
                  <option value="display">Clásica (Playfair)</option>
                </select>
              </div>
              <div className="bg-[var(--color-secundario)] p-4 rounded-2xl border border-[var(--color-borde)]">
                <label className="text-[9px] font-black opacity-50 uppercase block mb-2 tracking-widest text-[var(--color-texto-componente)]">Tamaño Letra</label>
                <input type="range" min="12" max="22" className="w-full accent-[var(--color-acento)]" value={tema.tamanioBase} onChange={e => setTema({...tema, tamanioBase: e.target.value})} />
              </div>
            </div>
            <button onClick={guardarPreferenciasTema} className="w-full py-5 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl mt-10">Guardar Todo el Estilo</button>
          </div>
        )}

        {seccion === 'personal' && <EstilistaAdmin />}
        {seccion === 'inventario' && <InventarioForm />}
        {seccion === 'clientes' && <ClienteForm />}
      </div>
    </div>
  );
};