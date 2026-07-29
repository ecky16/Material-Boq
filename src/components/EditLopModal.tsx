import React, { useState } from 'react';
import { LOPWithItems, LOPItem } from '../types';
import { X, Save, Trash2 } from 'lucide-react';

interface Props {
  lop: LOPWithItems;
  items: LOPItem[];
  onClose: () => void;
  onSave: (lopId: string, updatedItems: LOPItem[]) => void;
}

export const EditLopModal: React.FC<Props> = ({ lop, items, onClose, onSave }) => {
  const [editingItems, setEditingItems] = useState<LOPItem[]>(items);

  const updateItem = (itemId: string, field: keyof LOPItem, value: any) => {
    setEditingItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const deleteItem = (itemId: string) => {
    setEditingItems(prev => prev.filter(item => item.id !== itemId));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-2xl p-8 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-accent">Edit LOP: {lop.name}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto mb-6 pr-2">
          <table className="w-full text-xs">
            <thead className="bg-white/5">
              <tr>
                <th className="p-3 text-left">Designator</th>
                <th className="p-3 text-right">Volume</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {editingItems.map(item => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="p-2"><input value={item.designator} onChange={e => updateItem(item.id, 'designator', e.target.value)} className="w-full bg-transparent border-b border-white/10" /></td>
                  <td className="p-2"><input type="number" value={item.volume} onChange={e => updateItem(item.id, 'volume', Number(e.target.value))} className="w-full bg-transparent border-b border-white/10 text-right" /></td>
                  <td className="p-2 text-center"><button onClick={() => deleteItem(item.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white">Cancel</button>
          <button onClick={() => onSave(lop.id, editingItems)} className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-accent-grad text-[#002244]">Save Changes</button>
        </div>
      </div>
    </div>
  );
};
