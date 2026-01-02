import { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';

export function useInventario() {
  const [items, setItems] = useState([]);

  const fetchInventario = async () => {
    const { data } = await supabase.from('inventario').select('*');
    setItems(data || []);
  };

  const agregarItem = async (nuevoItem) => {
    const { error } = await supabase.from('inventario').insert([nuevoItem]);
    if (!error) fetchInventario();
  };

  useEffect(() => { fetchInventario(); }, []);

  return { items, agregarItem };
}