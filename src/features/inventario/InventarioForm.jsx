import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';

export const InventarioForm = () => {
  const [items, setItems] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [formData, setFormData] = useState({ nombre: '', tipo: 'servicio', precio_venta: 0, precio_compra: 0, stock_minimo: 3 });
  const [editandoId, setEditandoId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [modalUso, setModalUso] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [usoData, setUsoData] = useState({ cantidad: 1, id_estilista: '' });

  const cargarDatos = async () => {
    const { data: inv } = await supabase.from('inventario').select('*').order('nombre');
    setItems(inv || []);
    const { data: est } = await supabase.from('estilistas').select('id, nombre').eq('activo', true).order('nombre');
    setEstilistas(est || []);
  };

  useEffect(() => { cargarDatos(); }, []);

  const guardarNuevo = async (e) => {
    e.preventDefault();
    if (!formData.nombre) return;
    const { error } = await supabase.from('inventario').insert([{ ...formData, stock_actual: formData.tipo === 'producto' ? 0 : null }]);
    if (!error) { setFormData({ nombre: '', tipo: 'servicio', precio_venta: 0, precio_compra: 0, stock_minimo: 3 }); cargarDatos(); }
  };

  const iniciarEdicion = (item) => { setEditandoId(item.id); setEditFormData({ ...item }); };
  const cancelarEdicion = () => { setEditandoId(null); setEditFormData({}); };

  const guardarEdicion = async () => {
    await supabase.from('inventario').update({ 
      nombre: editFormData.nombre, tipo: editFormData.tipo, 
      precio_compra: parseFloat(editFormData.precio_compra), 
      precio_venta: parseFloat(editFormData.precio_venta), 
      stock_minimo: parseInt(editFormData.stock_minimo) 
    }).eq('id', editandoId);
    setEditandoId(null); cargarDatos();
  };

  const abrirModalUso = (item) => { setItemSeleccionado(item); setUsoData({ cantidad: 1, id_estilista: '' }); setModalUso(true); };

  const confirmarUsoInterno = async () => {
    if (!itemSeleccionado || usoData.cantidad <= 0 || itemSeleccionado.stock_actual < usoData.cantidad) return;
    await supabase.from('inventario').update({ stock_actual: itemSeleccionado.stock_actual - usoData.cantidad }).eq('id', itemSeleccionado.id);
    const estNombre = estilistas.find(e => e.id === usoData.id_estilista)?.nombre || 'General';
    await supabase.from('uso_interno').insert([{ id_producto: itemSeleccionado.id, cantidad: usoData.cantidad, id_estilista: usoData.id_estilista || null, notas: `Uso por: ${estNombre}` }]);
    setModalUso(false); cargarDatos();
  };

  const RenderFila = ({ item, esProducto }) => {
    const isEditing = editandoId === item.id;
    if (isEditing) {
      return (
        <tr className="bg-[var(--color-secundario)]">
          <td className="p-2 md:p-3"><input className="w-full p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none" value={editFormData.nombre} onChange={e => setEditFormData({...editFormData, nombre: e.target.value})} style={{ fontSize: '0.85em' }} /></td>
          {esProducto && <td className="p-2 md:p-3"><input type="number" className="w-16 p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] text-center font-bold" value={editFormData.stock_minimo} onChange={e => setEditFormData({...editFormData, stock_minimo: e.target.value})} style={{ fontSize: '0.85em' }} /></td>}
          <td className="p-2 md:p-3"><select className="w-full p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] font-bold outline-none" value={editFormData.tipo} onChange={e => setEditFormData({...editFormData, tipo: e.target.value})} style={{ fontSize: '0.85em' }}><option value="servicio">Serv.</option><option value="producto">Prod.</option></select></td>
          <td className="p-2 md:p-3"><input type="number" className="w-full p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] font-bold text-right" value={editFormData.precio_venta} onChange={e => setEditFormData({...editFormData, precio_venta: e.target.value})} style={{ fontSize: '0.85em' }} /></td>
          <td className="p-2 md:p-3 text-center flex justify-center gap-1 md:gap-2">
            <button onClick={guardarEdicion} className="bg-[var(--color-acento)] text-[var(--color-texto-acento)] p-2 rounded-lg font-black uppercase" style={{ fontSize: '0.65em' }}>✔</button>
            <button onClick={cancelarEdicion} className="bg-slate-700 text-white p-2 rounded-lg font-black uppercase" style={{ fontSize: '0.65em' }}>✖</button>
          </td>
        </tr>
      );
    }
    return (
      <tr className="hover:bg-[var(--color-secundario)] transition-colors border-t border-[var(--color-borde)]">
        <td className="p-4 md:p-5 font-bold text-[var(--color-texto-componente)] uppercase" style={{ fontSize: '0.8em' }}>{item.nombre}</td>
        {esProducto && <td className="p-4 md:p-5 text-center font-black opacity-60 text-[var(--color-texto-componente)]">{item.stock_actual || 0} / <span className="text-[var(--color-acento)] font-bold" style={{ fontSize: '0.75em' }}>{item.stock_minimo}</span></td>}
        <td className="p-4 md:p-5 text-center"><span className="font-bold opacity-40 uppercase tracking-widest" style={{ fontSize: '0.7em' }}>{item.tipo}</span></td>
        <td className="p-4 md:p-5 text-right font-black text-[var(--color-acento)] text-base md:text-lg">${item.precio_venta}</td>
        <td className="p-4 md:p-5 text-center space-x-3">
          <button onClick={() => iniciarEdicion(item)} className="opacity-40 hover:opacity-100 transition-colors text-lg">✎</button>
          {esProducto && <button onClick={() => abrirModalUso(item)} className="border border-[var(--color-acento)] text-[var(--color-acento)] px-3 py-1.5 rounded-xl font-black uppercase hover:bg-[var(--color-acento)] hover:text-[var(--color-texto-acento)]" style={{ fontSize: '0.6em' }}>⚙️ Uso</button>}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in pb-20 relative">
      <div className="lg:w-1/4 bg-[var(--color-componente)] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-[var(--color-borde)] h-fit lg:sticky lg:top-4 shadow-2xl">
        <h3 className="font-black text-[var(--color-acento)] uppercase mb-6 tracking-widest text-center" style={{ fontSize: '0.8em' }}>Nuevo Registro</h3>
        <form onSubmit={guardarNuevo} className="space-y-4">
          <input className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none focus:border-[var(--color-acento)]" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Nombre" style={{ fontSize: '0.9em' }} />
          <select className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{ fontSize: '0.9em' }}>
            <option value="servicio">✂️ Servicio</option><option value="producto">🧴 Producto</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="font-bold opacity-50 uppercase ml-2 text-[var(--color-texto-componente)]" style={{ fontSize: '0.6em' }}>Costo</label><input type="number" className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] font-bold outline-none" value={formData.precio_compra} onChange={e => setFormData({...formData, precio_compra: e.target.value})} placeholder="0.00" style={{ fontSize: '0.8em' }} /></div>
            <div className="space-y-1"><label className="font-bold opacity-50 uppercase ml-2 text-[var(--color-texto-componente)]" style={{ fontSize: '0.6em' }}>Venta</label><input type="number" className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] font-bold outline-none" value={formData.precio_venta} onChange={e => setFormData({...formData, precio_venta: e.target.value})} placeholder="0.00" style={{ fontSize: '0.8em' }} /></div>
          </div>
          <button className="w-full py-4 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black rounded-2xl shadow-lg uppercase tracking-widest" style={{ fontSize: '0.8em' }}>Agregar</button>
        </form>
      </div>

      <div className="lg:w-3/4 space-y-10">
        {['servicio', 'producto'].map(tipo => (
          <section key={tipo}>
            <div className="flex items-center gap-4 mb-6 ml-4">
              <h3 className="font-serif italic text-2xl md:text-3xl text-[var(--color-texto-componente)] uppercase">{tipo}s</h3>
              <div className="h-[1px] flex-grow bg-gradient-to-r from-[var(--color-acento)]/40 to-transparent"></div>
            </div>
            <div className="bg-[var(--color-componente)] rounded-[2rem] md:rounded-[2.5rem] border border-[var(--color-borde)] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[650px]">
                  <thead className="bg-black/20 font-black text-[var(--color-acento)] uppercase tracking-widest" style={{ fontSize: '0.75em' }}>
                    <tr><th className="p-5">{tipo.charAt(0).toUpperCase()+tipo.slice(1)}</th>{tipo === 'producto' && <th className="p-5 text-center">Stock/Min</th>}<th className="p-5 text-center">Tipo</th><th className="p-5 text-right">Precio</th><th className="p-5 text-center">Gestión</th></tr>
                  </thead>
                  <tbody>{items.filter(i => i.tipo === tipo).map(i => <RenderFila key={i.id} item={i} esProducto={tipo === 'producto'} />)}</tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </div>

      {modalUso && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-componente)] w-full max-w-md rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-[var(--color-acento)]/20 p-8 md:p-10 animate-in zoom-in duration-300">
            <h3 className="font-serif italic text-2xl md:text-3xl text-[var(--color-acento)] mb-2 text-center">Uso Interno</h3>
            <p className="font-bold opacity-50 uppercase tracking-widest mb-8 text-center truncate" style={{ fontSize: '0.75em' }}>{itemSeleccionado?.nombre}</p>
            <div className="space-y-6">
              <div className="space-y-2"><label className="font-black opacity-50 uppercase ml-2" style={{ fontSize: '0.65em' }}>Asignar a</label><select className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none" value={usoData.id_estilista} onChange={e => setUsoData({...usoData, id_estilista: e.target.value})} style={{ fontSize: '0.9em' }}><option value="">Gasto General</option>{estilistas.map(est => <option key={est.id} value={est.id}>{est.nombre}</option>)}</select></div>
              <div className="space-y-2"><label className="font-black opacity-50 uppercase ml-2" style={{ fontSize: '0.65em' }}>Cantidad</label><input type="number" min="1" className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-acento)] font-black text-2xl text-center outline-none" value={usoData.cantidad} onChange={e => setUsoData({...usoData, cantidad: parseInt(e.target.value)})} /></div>
              <div className="flex gap-4 pt-4"><button onClick={() => setModalUso(false)} className="flex-1 py-4 font-black uppercase opacity-50 hover:opacity-100" style={{ fontSize: '0.75em' }}>Cerrar</button><button onClick={confirmarUsoInterno} className="flex-1 py-4 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase rounded-2xl shadow-lg" style={{ fontSize: '0.75em' }}>Confirmar</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};