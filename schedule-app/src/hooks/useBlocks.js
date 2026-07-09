import { useCallback } from 'react';
import { supabase } from '../supabaseClient';

export function useBlocks() {
  const getBlocks = useCallback(async (taskId) => {
    const { data, error } = await supabase
      .from('blocks')
      .select('*')
      .eq('task_id', taskId)
      .order('"order"', { ascending: true });
    if (error) { console.error('getBlocks:', error); return []; }
    return data || [];
  }, []);

  const addBlock = useCallback(async (taskId, type, content, order = 0, indent = 0, meta = {}) => {
    const { data, error } = await supabase
      .from('blocks')
      .insert({ task_id: taskId, type, content, "order": order, indent, meta })
      .select().single();
    if (error) { console.error('addBlock:', error); return null; }
    return data;
  }, []);

  const updateBlock = useCallback(async (id, updates) => {
    const { error } = await supabase.from('blocks').update(updates).eq('id', id);
    if (error) console.error('updateBlock:', error);
  }, []);

  const deleteBlock = useCallback(async (id) => {
    const { error } = await supabase.from('blocks').delete().eq('id', id);
    if (error) console.error('deleteBlock:', error);
  }, []);

  const reorderBlocks = useCallback(async (ids) => {
    for (let i = 0; i < ids.length; i++) {
      await supabase.from('blocks').update({ "order": i }).eq('id', ids[i]);
    }
  }, []);

  return { getBlocks, addBlock, updateBlock, deleteBlock, reorderBlocks };
}
