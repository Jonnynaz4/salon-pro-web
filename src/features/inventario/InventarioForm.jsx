import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';

export const InventarioForm = () => {
  const [items, setItems] = useState([]);
  const [estilistas, setEstilistas] = useState([]);
  const [formData, setFormData] = useState({ 
    nombre: '', 
    tipo: 'servicio', 
    precio_venta: 0,
    precio_compra: 0,
    stock_minimo: 3 
  });

  const [editandoId, setEditandoId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [modalUso, setModalUso] = useState(false);
  const [itemSeleccionado, setItemSeleccionado] = useState(null);
  const [usoData, setUsoData] = useState({ cantidad: 1, id_estilista: '' });

  const cargarDatos = async () => {
    const { data: invData } = await supabase.from('inventario').select('*').order('nombre');
    setItems(invData || []);
    const { data: estData } = await supabase.from('estilistas').select('id, nombre').eq('activo', true).order('nombre');
    setEstilistas(estData || []);
  };

  useEffect(() => { cargarDatos(); }, []);

  const guardarNuevo = async (e) => {
    e.preventDefault();
    if (!formData.nombre) return;
    const itemData = { ...formData, stock_actual: formData.tipo === 'producto' ? 0 : null };
    const { error } = await supabase.from('inventario').insert([itemData]);
    if (!error) {
      setFormData({ nombre: '', tipo: 'servicio', precio_venta: 0, precio_compra: 0, stock_minimo: 3 });
      cargarDatos();
    }
  };

  const iniciarEdicion = (item) => {
    setEditandoId(item.id);
    setEditFormData({ ...item });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditFormData({});
  };

  const guardarEdicion = async () => {
    try {
      const { error } = await supabase
        .from('inventario')
        .update({
          nombre: editFormData.nombre,
          tipo: editFormData.tipo,
          precio_compra: parseFloat(editFormData.precio_compra),
          precio_venta: parseFloat(editFormData.precio_venta),
          stock_minimo: parseInt(editFormData.stock_minimo)
        })
        .eq('id', editandoId);

      if (error) throw error;
      setEditandoId(null);
      cargarDatos();
      alert("✅ Ítem actualizado correctamente");
    } catch (error) {
      alert("Error al actualizar: " + error.message);
    }
  };

  const abrirModalUso = (item) => {
    setItemSeleccionado(item);
    setUsoData({ cantidad: 1, id_estilista: '' });
    setModalUso(true);
  };

  const confirmarUsoInterno = async () => {
    if (!itemSeleccionado || usoData.cantidad <= 0) return;
    if (itemSeleccionado.stock_actual < usoData.cantidad) {
      alert("⚠️ Stock insuficiente.");
      return;
    }
    try {
      await supabase.from('inventario').update({ stock_actual: itemSeleccionado.stock_actual - usoData.cantidad }).eq('id', itemSeleccionado.id);
      const nombreEstilista = estilistas.find(e => e.id === usoData.id_estilista)?.nombre || 'General';
      await supabase.from('uso_interno').insert([{ 
        id_producto: itemSeleccionado.id, 
        cantidad: usoData.cantidad, 
        id_estilista: usoData.id_estilista || null,
        notas: `Uso por: ${nombreEstilista}` 
      }]);
      setModalUso(false);
      cargarDatos();
    } catch (error) { alert("Error: " + error.message); }
  };

  const RenderFila = ({ item, esProducto }) => {
    const isEditing = editandoId === item.id;

    if (isEditing) {
      return (
        <tr className="bg-[var(--color-secundario)] animate-in fade-in duration-300">
          <td className="p-3"><input className="w-full p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none focus:border-[var(--color-acento)]" value={editFormData.nombre} onChange={e => setEditFormData({...editFormData, nombre: e.target.value})} style={{ fontSize: '0.9em' }} /></td>
          {esProducto && (
              <td className="p-3"><input type="number" className="w-20 p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold text-center outline-none focus:border-[var(--color-acento)]" value={editFormData.stock_minimo} onChange={e => setEditFormData({...editFormData, stock_minimo: e.target.value})} style={{ fontSize: '0.9em' }} /></td>
          )}
          <td className="p-3">
            <select className="w-full p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none focus:border-[var(--color-acento)]" value={editFormData.tipo} onChange={e => setEditFormData({...editFormData, tipo: e.target.value})} style={{ fontSize: '0.9em' }}>
              <option value="servicio">Servicio</option>
              <option value="producto">Producto</option>
            </select>
          </td>
          <td className="p-3"><input type="number" className="w-full p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold text-right outline-none focus:border-[var(--color-acento)]" value={editFormData.precio_compra} onChange={e => setEditFormData({...editFormData, precio_compra: e.target.value})} style={{ fontSize: '0.9em' }} /></td>
          <td className="p-3"><input type="number" className="w-full p-2 rounded-lg bg-[var(--color-fondo)] border border-[var(--color-borde)] text-[var(--color-acento)] font-bold text-right outline-none focus:border-[var(--color-acento)]" value={editFormData.precio_venta} onChange={e => setEditFormData({...editFormData, precio_venta: e.target.value})} style={{ fontSize: '0.9em' }} /></td>
          <td className="p-3 text-center flex justify-center gap-2">
            <button onClick={guardarEdicion} className="bg-[var(--color-acento)] text-[var(--color-texto-acento)] p-2 rounded-xl font-black uppercase transition-all" style={{ fontSize: '0.7em' }}>✔</button>
            <button onClick={cancelarEdicion} className="bg-slate-700 text-white p-2 rounded-xl font-black uppercase transition-all" style={{ fontSize: '0.7em' }}>✖</button>
          </td>
        </tr>
      );
    }

    return (
      <tr className="hover:bg-[var(--color-secundario)] transition-colors border-t border-[var(--color-borde)]">
        <td className="p-5 font-bold text-[var(--color-texto-componente)] uppercase" style={{ fontSize: '0.85em' }}>{item.nombre}</td>
        {esProducto && (
          <td className="p-5 text-center font-black opacity-60 text-[var(--color-texto-componente)]">
            {item.stock_actual || 0} / <span className="text-[var(--color-acento)] font-bold" style={{ fontSize: '0.8em' }}>{item.stock_minimo}</span>
          </td>
        )}
        <td className="p-5 text-center"><span className="font-bold opacity-40 text-[var(--color-texto-componente)] uppercase tracking-widest" style={{ fontSize: '0.75em' }}>{item.tipo}</span></td>
        <td className="p-5 text-right font-bold opacity-40 text-[var(--color-texto-componente)]">${item.precio_compra || 0}</td>
        <td className="p-5 text-right font-black text-[var(--color-acento)] text-lg">${item.precio_venta}</td>
        <td className="p-5 text-center space-x-3">
          <button onClick={() => iniciarEdicion(item)} className="opacity-40 hover:opacity-100 hover:text-[var(--color-acento)] transition-colors text-lg text-[var(--color-texto-componente)]">✎</button>
          {esProducto && <button onClick={() => abrirModalUso(item)} className="border border-[var(--color-acento)] text-[var(--color-acento)] px-4 py-1.5 rounded-xl font-black uppercase hover:bg-[var(--color-acento)] hover:text-[var(--color-texto-acento)] transition-all" style={{ fontSize: '0.7em' }}>⚙️ Uso</button>}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in pb-20 relative">
      <div className="lg:w-1/4 bg-[var(--color-componente)] p-8 rounded-[2.5rem] border border-[var(--color-borde)] h-fit sticky top-4 shadow-2xl text-[var(--color-texto-componente)]">
        <h3 className="font-black text-[var(--color-acento)] uppercase mb-6 tracking-[0.3em] text-center" style={{ fontSize: '0.8em' }}>Nuevo Registro</h3>
        <form onSubmit={guardarNuevo} className="space-y-4">
          <input className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none focus:border-[var(--color-acento)] transition-all" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Nombre" style={{ fontSize: '0.9em' }} />
          <select className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none focus:border-[var(--color-acento)]" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} style={{ fontSize: '0.9em' }}>
            <option value="servicio">✂️ Servicio</option>
            <option value="producto">🧴 Producto</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold opacity-50 uppercase ml-2 text-[var(--color-texto-componente)]" style={{ fontSize: '0.65em' }}>Costo</label>
              <input type="number" className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none focus:border-[var(--color-acento)]" value={formData.precio_compra} onChange={e => setFormData({...formData, precio_compra: e.target.value})} placeholder="0.00" style={{ fontSize: '0.8em' }} />
            </div>
            <div className="space-y-1">
              <label className="font-bold opacity-50 uppercase ml-2 text-[var(--color-texto-componente)]" style={{ fontSize: '0.65em' }}>Venta</label>
              <input type="number" className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none focus:border-[var(--color-acento)]" value={formData.precio_venta} onChange={e => setFormData({...formData, precio_venta: e.target.value})} placeholder="0.00" style={{ fontSize: '0.8em' }} />
            </div>
          </div>
          <button className="w-full py-4 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black rounded-2xl shadow-lg uppercase tracking-widest active:scale-95 mt-2" style={{ fontSize: '0.8em' }}>Agregar Item</button>
        </form>
      </div>

      <div className="lg:w-3/4 space-y-12">
        <section>
          <div className="flex items-center gap-4 mb-6 ml-4">
            <h3 className="font-serif italic text-3xl text-[var(--color-texto-componente)] leading-none">Servicios</h3>
            <div className="h-[1px] flex-grow bg-gradient-to-r from-[var(--color-acento)]/50 to-transparent"></div>
          </div>
          <div className="bg-[var(--color-componente)] rounded-[2.5rem] border border-[var(--color-borde)] overflow-hidden shadow-2xl">
            <table className="w-full text-left">
              <thead className="bg-black/20">
                <tr className="font-black text-[var(--color-acento)] uppercase tracking-widest" style={{ fontSize: '0.8em' }}>
                  <th className="p-5">Servicio</th>
                  <th className="p-5 text-center">Tipo</th>
                  <th className="p-5 text-right">Costo</th>
                  <th className="p-5 text-right">Precio</th>
                  <th className="p-5 text-center">Gestión</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(i => i.tipo === 'servicio').map(i => <RenderFila key={i.id} item={i} esProducto={false} />)}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-6 ml-4">
            <h3 className="font-serif italic text-3xl text-[var(--color-texto-componente)] leading-none">Productos</h3>
            <div className="h-[1px] flex-grow bg-gradient-to-r from-[var(--color-acento)]/50 to-transparent"></div>
          </div>
          <div className="bg-[var(--color-componente)] rounded-[2.5rem] border border-[var(--color-borde)] overflow-hidden shadow-2xl">
            <table className="w-full text-left">
              <thead className="bg-black/20">
                <tr className="font-black text-[var(--color-acento)] uppercase tracking-widest" style={{ fontSize: '0.8em' }}>
                  <th className="p-5">Producto</th>
                  <th className="p-5 text-center">Stock/Min</th>
                  <th className="p-5 text-center">Tipo</th>
                  <th className="p-5 text-right">Costo</th>
                  <th className="p-5 text-right">Precio</th>
                  <th className="p-5 text-center">Gestión</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(i => i.tipo === 'producto').map(i => <RenderFila key={i.id} item={i} esProducto={true} />)}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalUso && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-componente)] w-full max-w-md rounded-[3rem] shadow-2xl border border-[var(--color-acento)]/20 p-10 animate-in zoom-in duration-300 text-[var(--color-texto-componente)]">
            <h3 className="font-serif italic text-3xl text-[var(--color-acento)] mb-2 text-center">Uso Interno</h3>
            <p className="font-bold opacity-50 uppercase tracking-widest mb-8 text-center" style={{ fontSize: '0.8em' }}>{itemSeleccionado?.nombre}</p>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="font-black opacity-50 uppercase ml-2" style={{ fontSize: '0.7em' }}>Asignar a Estilista</label>
                <select className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-texto-componente)] font-bold outline-none focus:border-[var(--color-acento)]" value={usoData.id_estilista} onChange={e => setUsoData({...usoData, id_estilista: e.target.value})} style={{ fontSize: '0.9em' }}>
                  <option value="">Gasto General</option>
                  {estilistas.map(est => <option key={est.id} value={est.id}>{est.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-black opacity-50 uppercase ml-2" style={{ fontSize: '0.7em' }}>Cantidad</label>
                <input type="number" min="1" className="w-full p-4 rounded-2xl bg-[var(--color-secundario)] border border-[var(--color-borde)] text-[var(--color-acento)] font-black text-2xl text-center outline-none" value={usoData.cantidad} onChange={e => setUsoData({...usoData, cantidad: parseInt(e.target.value)})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setModalUso(false)} className="flex-1 py-4 font-black uppercase opacity-50 hover:opacity-100 transition-all" style={{ fontSize: '0.8em' }}>Cancelar</button>
                <button onClick={confirmarUsoInterno} className="flex-1 py-4 bg-[var(--color-acento)] text-[var(--color-texto-acento)] font-black uppercase rounded-2xl shadow-lg transition-all" style={{ fontSize: '0.8em' }}>Confirmar Salida</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};