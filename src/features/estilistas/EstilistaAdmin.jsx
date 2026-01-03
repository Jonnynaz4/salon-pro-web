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
    <div className="flex flex-col gap-8 animate-in fade-in">
      <div className="flex justify-between items-center bg-[#1A1A1A] p-8 rounded-[2.5rem] border border-[#222] shadow-2xl">
        <div>
          <h3 className="text-xl font-serif italic text-white uppercase tracking-widest">Gestión de Personal</h3>
          <p className="text-slate-500 font-black uppercase tracking-[0.3em] mt-1" style={{ fontSize: '0.7em' }}>Configuración de comisiones y estatus</p>
        </div>
        <button 
          onClick={() => setMostrarInactivos(!mostrarInactivos)}
          className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 ${mostrarInactivos ? 'bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/10' : 'bg-[#252525] text-slate-400 border border-[#333] hover:border-slate-600'}`}
          style={{ fontSize: '0.7em' }}
        >
          {mostrarInactivos ? 'Ver solo activos' : 'Ver todos'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Formulario */}
        <div className="lg:w-1/3 bg-[#1A1A1A] p-8 rounded-[3rem] border border-[#222] h-fit shadow-2xl">
          <h4 className="font-black text-[#C5A059] uppercase mb-6 tracking-widest text-center" style={{ fontSize: '0.8em' }}>Registrar Nuevo</h4>
          <form onSubmit={agregarEstilista} className="space-y-4">
            <input 
              className="w-full p-4 rounded-2xl bg-[#252525] border border-[#333] text-slate-200 font-bold outline-none focus:border-[#C5A059] transition-all" 
              placeholder="Nombre completo" 
              value={nuevoNombre} 
              onChange={e=>setNuevoNombre(e.target.value)}
              style={{ fontSize: '0.9em' }}
            />
            <div className="space-y-2">
                <label className="font-bold text-slate-500 uppercase ml-2" style={{ fontSize: '0.65em' }}>Comisión pactada %</label>
                <input 
                  type="number" 
                  className="w-full p-4 rounded-2xl bg-[#252525] border border-[#333] text-slate-200 font-bold outline-none focus:border-[#C5A059] transition-all" 
                  placeholder="0" 
                  value={nuevaComision} 
                  onChange={e=>setNuevaComision(e.target.value)}
                  style={{ fontSize: '0.9em' }}
                />
            </div>
            <button className="w-full py-5 bg-white text-black font-black rounded-2xl shadow-lg uppercase tracking-widest hover:bg-[#C5A059] transition-all active:scale-95 mt-2" style={{ fontSize: '0.8em' }}>Guardar Estilista</button>
          </form>
        </div>

        {/* Listado */}
        <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
          {estilistasFiltrados.map(est => (
            <div key={est.id} className={`p-8 rounded-[3rem] bg-[#141414] border-2 transition-all group ${est.activo ? 'border-[#222] shadow-xl hover:border-[#C5A059]/30' : 'opacity-40 grayscale border-dashed border-[#222]'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className="font-serif italic text-2xl text-white">
                  {editando === est.id ? 
                    <input className="bg-transparent border-b border-[#C5A059] outline-none w-full" defaultValue={est.nombre} onBlur={e => actualizarEstilista(est.id, {nombre: e.target.value})} autoFocus /> 
                    : est.nombre}
                </div>
                <button 
                  onClick={() => actualizarEstilista(est.id, {activo: !est.activo})} 
                  className={`font-black uppercase px-3 py-1.5 rounded-xl transition-all ${est.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}
                  style={{ fontSize: '0.65em' }}
                >
                  {est.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
              <div className="flex items-center gap-3 bg-[#1A1A1A] p-4 rounded-2xl border border-[#222]">
                <span className="font-black text-slate-500 uppercase tracking-widest" style={{ fontSize: '0.7em' }}>Comisión:</span>
                <input type="number" className="w-12 font-black text-[#C5A059] text-xl bg-transparent outline-none" defaultValue={est.comision_porcentaje} onBlur={e => actualizarEstilista(est.id, {comision_porcentaje: e.target.value})} />
                <span className="text-[#C5A059] font-black text-xl">%</span>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditando(est.id)} className="text-slate-600 hover:text-white" style={{ fontSize: '1.2em' }}>✎</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};