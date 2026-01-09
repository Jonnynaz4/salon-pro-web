import React, { useState, useEffect } from 'react';
import { supabase } from '../../api/supabase';

export const EstilistaAdmin = () => {
  const [estilistas, setEstilistas] = useState([]);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaComision, setNuevaComision] = useState(0);
  const [editando, setEditando] = useState(null);

  const cargarEstilistas = async () => {
    const { data } = await supabase.from('estilistas').select('*').order('nombre');
    setEstilistas(data || []);
  };

  useEffect(() => { cargarEstilistas(); }, []);

  const agregarEstilista = async (e) => {
    e.preventDefault();
    if (!nuevoNombre) return;
    await supabase.from('estilistas').insert([{ nombre: nuevoNombre, comision_porcentaje: nuevaComision, activo: true }]);
    setNuevoNombre(''); setNuevaComision(0);
    cargarEstilistas();
  };

  const actualizarEstilista = async (id, campos) => {
    await supabase.from('estilistas').update(campos).eq('id', id);
    setEditando(null);
    cargarEstilistas();
  };

  const estilistasFiltrados = mostrarInactivos ? estilistas : estilistas.filter(e => e.activo);

  return (
    <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-[#1A1A1A] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-[#222] gap-6">
        <div className="text-center sm:text-left">
          <h3 className="text-xl font-serif italic text-white uppercase tracking-widest leading-none">Personal</h3>
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] mt-2" style={{ fontSize: '0.65em' }}>Estatus y comisiones</p>
        </div>
        <button 
          onClick={() => setMostrarInactivos(!mostrarInactivos)}
          className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black uppercase tracking-widest transition-all ${mostrarInactivos ? 'bg-[#C5A059] text-black shadow-lg' : 'bg-[#252525] text-slate-400 border border-[#333]'}`}
          style={{ fontSize: '0.7em' }}
        >
          {mostrarInactivos ? 'Ver Activos' : 'Ver Todos'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3 bg-[#1A1A1A] p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-[#222] h-fit shadow-2xl">
          <h4 className="font-black text-[#C5A059] uppercase mb-6 tracking-widest text-center" style={{ fontSize: '0.8em' }}>Nuevo Estilista</h4>
          <form onSubmit={agregarEstilista} className="space-y-4">
            <input 
              className="w-full p-4 rounded-2xl bg-[#252525] border border-[#333] text-slate-200 font-bold outline-none focus:border-[#C5A059]" 
              placeholder="Nombre completo" 
              value={nuevoNombre} 
              onChange={e=>setNuevoNombre(e.target.value)}
              style={{ fontSize: '0.9em' }}
            />
            <div className="space-y-2">
                <label className="font-bold text-slate-500 uppercase ml-2" style={{ fontSize: '0.65em' }}>Comisión %</label>
                <input 
                  type="number" 
                  className="w-full p-4 rounded-2xl bg-[#252525] border border-[#333] text-slate-200 font-bold outline-none" 
                  value={nuevaComision} 
                  onChange={e=>setNuevaComision(e.target.value)}
                  style={{ fontSize: '0.9em' }}
                />
            </div>
            <button className="w-full py-5 bg-white text-black font-black rounded-2xl shadow-lg uppercase tracking-widest hover:bg-[#C5A059] transition-all" style={{ fontSize: '0.8em' }}>Guardar</button>
          </form>
        </div>

        <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {estilistasFiltrados.map(est => (
            <div key={est.id} className={`p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] bg-[#141414] border-2 transition-all group ${est.activo ? 'border-[#222] shadow-xl hover:border-[#C5A059]/30' : 'opacity-40 grayscale border-dashed border-[#222]'}`}>
              <div className="flex justify-between items-start mb-6 gap-2">
                <div className="font-serif italic text-xl md:text-2xl text-white leading-tight overflow-hidden">
                  {editando === est.id ? 
                    <input className="bg-transparent border-b border-[#C5A059] outline-none w-full" defaultValue={est.nombre} onBlur={e => actualizarEstilista(est.id, {nombre: e.target.value})} autoFocus /> 
                    : <span className="truncate block">{est.nombre}</span>}
                </div>
                <button 
                  onClick={() => actualizarEstilista(est.id, {activo: !est.activo})} 
                  className={`font-black uppercase px-3 py-1.5 rounded-xl flex-shrink-0 ${est.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}
                  style={{ fontSize: '0.6em' }}
                >
                  {est.activo ? 'Activo' : 'Inact.'}
                </button>
              </div>
              <div className="flex items-center gap-3 bg-[#1A1A1A] p-4 rounded-2xl border border-[#222]">
                <span className="font-black text-slate-500 uppercase tracking-widest" style={{ fontSize: '0.65em' }}>Comisión:</span>
                <input type="number" className="w-12 font-black text-[#C5A059] text-xl bg-transparent outline-none" defaultValue={est.comision_porcentaje} onBlur={e => actualizarEstilista(est.id, {comision_porcentaje: e.target.value})} />
                <span className="text-[#C5A059] font-black text-xl">%</span>
                <button onClick={() => setEditando(est.id)} className="ml-auto text-slate-600 hover:text-white" style={{ fontSize: '1.2em' }}>✎</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};