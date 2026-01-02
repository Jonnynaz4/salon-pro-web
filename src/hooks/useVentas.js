import { supabase } from '../api/supabase';

export function useVentas() {
  const realizarVenta = async (citaId, listaItems, total) => {
    // 1. Registrar la venta en la tabla 'ventas'
    const { data: venta, error: errorVenta } = await supabase
      .from('ventas')
      .insert([{ cita_id: citaId, total: total }])
      .select();

    if (errorVenta) return { error: errorVenta };

    // 2. Si la venta viene de una cita, actualizar estatus a 'pagada'
    if (citaId) {
      await supabase
        .from('citas')
        .update({ estatus: 'pagada' })
        .eq('id', citaId);
    }

    // 3. Restar stock de productos (solo si son tipo 'producto')
    for (const item of listaItems) {
      if (item.tipo === 'producto') {
        const { data: prod } = await supabase
          .from('inventario')
          .select('stock')
          .eq('id', item.id)
          .single();
        
        await supabase
          .from('inventario')
          .update({ stock: (prod?.stock || 0) - 1 })
          .eq('id', item.id);
      }
    }

    return { success: true };
  };

  return { realizarVenta };
}