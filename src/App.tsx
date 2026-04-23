/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { cn } from './lib/utils';
import { LOP, LOPItem, LOPWithItems, AppUser, DesignatorPrice } from './types';
import { 
  Plus, 
  Download, 
  Filter, 
  User, 
  LogOut, 
  Calendar, 
  Table as TableIcon, 
  ClipboardPaste,
  Trash2,
  Save,
  Loader2,
  Users,
  Key,
  ChevronDown,
  X,
  AlertTriangle,
  Coins,
  DollarSign,
  BarChart3,
  Search,
  ArrowUpRight,
  TrendingUp,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

// --- Helpers ---

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// --- Components ---

const Modal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  variant = 'danger'
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string,
  confirmText?: string,
  cancelText?: string,
  variant?: 'danger' | 'primary'
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md p-8 rounded-3xl border-white/10 shadow-2xl"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
            variant === 'danger' ? "bg-red-500/20 text-red-500" : "bg-accent/20 text-accent"
          )}>
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-xl font-bold uppercase tracking-widest">{title}</h3>
        </div>
        <p className="text-white/60 text-sm mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>{cancelText}</Button>
          <Button 
            variant={variant === 'danger' ? 'danger' : 'primary'} 
            className="flex-1" 
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmText}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', size?: 'sm' | 'md' | 'lg' }) => {
  const variants = {
    primary: 'bg-accent-grad text-[#002244] hover:opacity-90 font-bold uppercase tracking-wider',
    secondary: 'bg-white/10 text-white border border-white/20 hover:bg-white/20',
    danger: 'bg-red-500/80 text-white hover:bg-red-600/80 backdrop-blur-sm',
    ghost: 'hover:bg-white/10 text-white/70 hover:text-white',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-[10px]',
    md: 'px-4 py-2 text-xs',
    lg: 'px-6 py-3 text-sm',
  };
  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      'glass-input w-full px-3 py-2 rounded-lg focus:outline-none focus:border-accent/50 transition-all text-sm',
      className
    )}
    {...props}
  />
);

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('lop_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState<'dashboard' | 'input' | 'users' | 'prices' | 'analytics' | 'lops_manage'>('dashboard');
  const [dashboardMode, setDashboardMode] = useState<'boq' | 'comparison'>('boq');
  const [lops, setLops] = useState<LOPWithItems[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterInputer, setFilterInputer] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Input Form State
  const [inputType, setInputType] = useState<'warehouse' | 'boq'>('warehouse');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [lopName, setLopName] = useState('');
  const [lopDate, setLopDate] = useState(new Date().toISOString().slice(0, 10));
  const [pasteData, setPasteData] = useState('');
  const [parsedItems, setParsedItems] = useState<{ designator: string, volume: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'primary';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  // User Management State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newInputerName, setNewInputerName] = useState('');

  // Price Management State
  const [pricePasteData, setPricePasteData] = useState('');
  const [parsedPrices, setParsedPrices] = useState<{ designator: string, price: number }[]>([]);
  const [isSavingPrices, setIsSavingPrices] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchLops();
      fetchPrices();
      if (currentUser.role === 'admin') {
        fetchUsers();
      }
    }
  }, [currentUser]);

  const fetchLops = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let query = supabase
        .from('lops')
        .select(`*, lop_items(*)`)
        .order('date', { ascending: false });

      // If not admin, only fetch their own data
      if (currentUser.role !== 'admin') {
        query = query.eq('username', currentUser.username);
      }

      const { data: lopsData, error: lopsError } = await query;

      if (lopsError) throw lopsError;
      
      const mapped = (lopsData as any[]).map(lop => ({
        ...lop,
        items: lop.lop_items
      }));

      setLops(mapped);
    } catch (err) {
      console.error('Error fetching LOPs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('app_users').select('*');
      if (error) throw error;
      setAllUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchPrices = async () => {
    try {
      const { data, error } = await supabase.from('designator_prices').select('*');
      if (error) throw error;
      const priceMap: Record<string, number> = {};
      (data as DesignatorPrice[]).forEach(p => {
        priceMap[p.designator] = p.unit_price;
      });
      setPrices(priceMap);
    } catch (err) {
      console.error('Error fetching prices:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const user = formData.get('username') as string;
    const pass = formData.get('password') as string;

    // Hardcoded admin check
    if (user === 'ecky' && pass === 'admin123') {
      const adminUser: AppUser = {
        id: 'admin-id',
        username: 'ecky',
        password_hash: 'admin123',
        inputer_name: 'ecky rakhmat',
        role: 'admin'
      };
      setCurrentUser(adminUser);
      localStorage.setItem('lop_user', JSON.stringify(adminUser));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', user)
        .eq('password_hash', pass)
        .single();

      if (error || !data) {
        alert('Invalid username or password');
        return;
      }

      setCurrentUser(data);
      localStorage.setItem('lop_user', JSON.stringify(data));
    } catch (err) {
      console.error('Login error:', err);
      alert('Login failed. Ensure database is setup.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('lop_user');
    setCurrentUser(null);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newInputerName) return;

    try {
      const { error } = await supabase.from('app_users').insert([{
        username: newUsername,
        password_hash: newPassword,
        inputer_name: newInputerName,
        role: 'user'
      }]);

      if (error) throw error;
      
      alert('User added successfully');
      setNewUsername('');
      setNewPassword('');
      setNewInputerName('');
      fetchUsers();
    } catch (err) {
      console.error('Error adding user:', err);
      alert('Failed to add user');
    }
  };

  const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPasteData(text);
    
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const items = lines.map(line => {
      const parts = line.trim().split(/\t|\s{2,}/);
      if (parts.length >= 2) {
        const designator = parts[0].trim();
        const volume = parseFloat(parts[parts.length - 1].replace(/,/g, ''));
        if (!isNaN(volume)) {
          return { designator, volume };
        }
      }
      return null;
    }).filter(item => item !== null) as { designator: string, volume: number }[];

    setParsedItems(items);
  };

  const handlePricePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPricePasteData(text);
    
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const items = lines.map(line => {
      const parts = line.trim().split(/\t|\s{2,}/);
      if (parts.length >= 2) {
        const designator = parts[0].trim();
        const price = parseFloat(parts[parts.length - 1].replace(/,/g, ''));
        if (!isNaN(price)) {
          return { designator, price };
        }
      }
      return null;
    }).filter(item => item !== null) as { designator: string, price: number }[];

    setParsedPrices(items);
  };

  const savePrices = async () => {
    if (parsedPrices.length === 0) return;
    setIsSavingPrices(true);
    try {
      const { error } = await supabase
        .from('designator_prices')
        .upsert(parsedPrices.map(p => ({
          designator: p.designator,
          unit_price: p.price,
          updated_at: new Date().toISOString()
        })));

      if (error) throw error;
      alert('Prices updated successfully');
      setPricePasteData('');
      setParsedPrices([]);
      fetchPrices();
    } catch (err) {
      console.error('Error saving prices:', err);
      alert('Failed to save prices');
    } finally {
      setIsSavingPrices(false);
    }
  };

  const deletePrice = async (designator: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Price',
      message: `Are you sure you want to delete the price for "${designator}"?`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('designator_prices').delete().eq('designator', designator);
          if (error) throw error;
          fetchPrices();
        } catch (err) {
          console.error('Error deleting price:', err);
        }
      }
    });
  };

  const deleteAllPrices = async () => {
    setModalConfig({
      isOpen: true,
      title: 'Delete ALL Prices',
      message: 'WARNING: This will permanently delete ALL unit prices from the database. This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('designator_prices').delete().neq('designator', 'placeholder_to_allow_all_delete');
          // Note: .neq with a dummy value is a common way to delete all rows in Supabase if not using RPC
          // Alternatively, just .delete().match({}) if supported by policy
          if (error) throw error;
          fetchPrices();
        } catch (err) {
          console.error('Error deleting all prices:', err);
        }
      }
    });
  };

  const saveLop = async () => {
    if (!lopName || !lopDate || parsedItems.length === 0 || !currentUser) return;
    if (inputType === 'boq' && !selectedWarehouseId) {
      alert('Please select a Warehouse LOP to link with this BOQ');
      return;
    }

    setIsSaving(true);
    try {
      const { data: lopData, error: lopError } = await supabase
        .from('lops')
        .insert([{ 
          name: lopName, 
          date: lopDate, 
          username: currentUser.username,
          inputer_name: currentUser.inputer_name,
          type: inputType,
          parent_id: inputType === 'boq' ? selectedWarehouseId : null
        }])
        .select()
        .single();

      if (lopError) throw lopError;

      const itemsToInsert = parsedItems.map(item => ({
        lop_id: lopData.id,
        designator: item.designator,
        volume: item.volume
      }));

      const { error: itemsError } = await supabase
        .from('lop_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      setLopName('');
      setLopDate(new Date().toISOString().slice(0, 10));
      setPasteData('');
      setParsedItems([]);
      setSelectedWarehouseId('');
      setView('dashboard');
      fetchLops();
    } catch (err) {
      console.error('Error saving LOP:', err);
      alert('Failed to save LOP.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLop = async (id: string) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete LOP',
      message: 'Are you sure you want to permanently delete this LOP entry? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('lops').delete().eq('id', id);
          if (error) throw error;
          fetchLops();
        } catch (err) {
          console.error('Error deleting LOP:', err);
        }
      }
    });
  };

  const deleteUser = async (id: string, username: string) => {
    if (username === 'ecky') {
      alert('Cannot delete the primary admin account.');
      return;
    }

    setModalConfig({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete user "${username}"? They will no longer be able to access the system.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('app_users').delete().eq('id', id);
          if (error) throw error;
          fetchUsers();
        } catch (err) {
          console.error('Error deleting user:', err);
        }
      }
    });
  };

  const pivotData = useMemo(() => {
    let filteredLops = lops.filter(lop => lop.date.startsWith(filterMonth));
    
    if (currentUser?.role === 'admin') {
      if (filterInputer !== 'all') {
        filteredLops = filteredLops.filter(lop => lop.inputer_name === filterInputer);
      }
    } else {
      // Non-admins are already filtered at fetch level, but double check here
      filteredLops = filteredLops.filter(lop => lop.username === currentUser?.username);
    }

    // Filter by dashboard mode
    if (dashboardMode === 'boq') {
      filteredLops = filteredLops.filter(l => l.type === 'boq');
    }

    let designators = Array.from(new Set(filteredLops.flatMap(lop => lop.items.map(i => i.designator)))).sort() as string[];
    
    // Apply search filter
    if (searchQuery) {
      designators = designators.filter(d => 
        (d as string).toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const rows = designators.map(designator => {
      const unitPrice = prices[designator] || 0;
      const row: any = { designator, total: 0, unitPrice, totalPrice: 0 };
      filteredLops.forEach(lop => {
        const item = lop.items.find(i => i.designator === designator);
        const volume = item ? item.volume : 0;
        row[lop.id] = volume;
        row.total += volume;
      });
      row.totalPrice = row.total * unitPrice;
      return row;
    });
    return { designators, lops: filteredLops, rows };
  }, [lops, filterMonth, filterInputer, currentUser, prices, searchQuery, dashboardMode]);

  const comparisonData = useMemo(() => {
    if (dashboardMode !== 'comparison') return null;

    // Get all comparison pairs
    const pairs: { warehouse: LOPWithItems, boq: LOPWithItems }[] = [];
    
    const warehouseLops = lops.filter(l => l.type === 'warehouse');
    const boqLops = lops.filter(l => l.type === 'boq');

    warehouseLops.forEach(w => {
      const b = boqLops.find(b => b.parent_id === w.id);
      if (b) {
        pairs.push({ warehouse: w, boq: b });
      }
    });

    const results = pairs.map(({ warehouse, boq }) => {
      const allDesignators = Array.from(new Set([
        ...warehouse.items.map(i => i.designator),
        ...boq.items.map(i => i.designator)
      ])).sort();

      const items = allDesignators.map(d => {
        const wItem = warehouse.items.find(i => i.designator === d);
        const bItem = boq.items.find(i => i.designator === d);
        const wVol = wItem?.volume || 0;
        const bVol = bItem?.volume || 0;
        const diff = bVol - wVol;
        return { designator: d, warehouseVol: wVol, boqVol: bVol, diff };
      });

      return {
        id: `${warehouse.id}-${boq.id}`,
        name: warehouse.name,
        date: warehouse.date,
        inputer: warehouse.inputer_name,
        items: items.filter(i => i.diff !== 0 || searchQuery === '' || i.designator.toLowerCase().includes(searchQuery.toLowerCase()))
      };
    }).filter(pair => pair.items.length > 0);

    return results;
  }, [lops, dashboardMode, searchQuery]);

  const pendingWarehouseLops = useMemo(() => {
    const warehouseLops = lops.filter(l => l.type === 'warehouse');
    const boqLops = lops.filter(l => l.type === 'boq');
    
    return warehouseLops.filter(w => !boqLops.some(b => b.parent_id === w.id));
  }, [lops]);

  const inputerNames = useMemo(() => {
    return Array.from(new Set(lops.map(l => l.inputer_name))).sort();
  }, [lops]);

  const exportToExcel = () => {
    const { lops: currentLops, rows } = pivotData;
    const headers = ['DESIGNATOR', 'UNIT PRICE', 'TOTAL MATERIAL', 'TOTAL PRICE', ...currentLops.map(lop => `${lop.date}\n${lop.name}\n(${lop.inputer_name})`)];
    const excelRows = rows.map(row => [
      row.designator,
      row.unitPrice,
      row.total,
      row.totalPrice,
      ...currentLops.map(lop => row[lop.id] || 0)
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LOP Report");
    XLSX.writeFile(wb, `LOP_Report_${filterMonth}_${filterInputer}.xlsx`);
  };

  const getAnalyticsData = useMemo(() => {
    const { rows, lops: filteredLops } = pivotData;
    
    // Top 5 Materials by Total Price
    const topMaterials = [...rows]
      .sort((a, b) => b.totalPrice - a.totalPrice)
      .slice(0, 5)
      .map(r => ({
        name: r.designator,
        value: r.totalPrice,
        volume: r.total
      }));

    // Volume Distribution (Top 8)
    const volumeDistribution = [...rows]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(r => ({
        name: r.designator,
        volume: r.total
      }));

    // Daily Trend in selected month
    const dailyData: Record<string, { date: string, total: number, value: number }> = {};
    filteredLops.forEach(lop => {
      const day = lop.date;
      if (!dailyData[day]) dailyData[day] = { date: day, total: 0, value: 0 };
      
      lop.items.forEach(item => {
        const price = prices[item.designator] || 0;
        dailyData[day].total += item.volume;
        dailyData[day].value += item.volume * price;
      });
    });

    const trend = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    return { topMaterials, volumeDistribution, trend };
  }, [pivotData, prices]);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-card p-8 rounded-3xl shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-accent-grad rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-accent/20">
              <TableIcon className="text-[#002244] w-8 h-8" />
            </div>
            <h1 className="text-3xl font-light text-white tracking-[0.3em] uppercase">Ma<span className="font-bold">BoQ</span></h1>
            <p className="text-white/50 text-[10px] mt-2 tracking-[0.4em] uppercase">Material BOQ System</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Username</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <Input name="username" placeholder="Username" className="pl-10" required autoFocus />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Password</label>
              <div className="relative">
                <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <Input name="password" type="password" placeholder="••••••••" className="pl-10" required />
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg">
              Initialize Session
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans p-6">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 glass-card rounded-xl flex items-center justify-center border-accent/30">
            <TableIcon className="text-accent w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-light tracking-[0.2em] uppercase">Ma<span className="font-bold">BoQ</span></h1>
            <div className="text-[9px] text-white/50 tracking-[0.2em] uppercase flex items-center gap-2">
              Material BOQ // {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 glass-card rounded-full border-white/10">
            <div className="w-6 h-6 rounded-full bg-accent-grad flex items-center justify-center">
              <User size={12} className="text-[#002244]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-wider uppercase leading-none">{currentUser.inputer_name}</span>
              <span className="text-[8px] text-accent tracking-widest uppercase font-bold">{currentUser.role}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="w-10 h-10 glass-card rounded-full flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/50 transition-all text-white/50 hover:text-white"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-3 glass-card p-1.5 rounded-xl border-white/5">
            <button 
              onClick={() => setView('dashboard')}
              className={cn(
                "px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                view === 'dashboard' ? "bg-accent-grad text-[#002244] shadow-lg shadow-accent/20" : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setView('analytics')}
              className={cn(
                "px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                view === 'analytics' ? "bg-accent-grad text-[#002244] shadow-lg shadow-accent/20" : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              Analytics
            </button>
            <button 
              onClick={() => setView('input')}
              className={cn(
                "px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                view === 'input' ? "bg-accent-grad text-[#002244] shadow-lg shadow-accent/20" : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              Input Data
            </button>
            {currentUser.role === 'admin' && (
              <>
                <button 
                  onClick={() => setView('users')}
                  className={cn(
                    "px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                    view === 'users' ? "bg-accent-grad text-[#002244] shadow-lg shadow-accent/20" : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                >
                  Manage Users
                </button>
                <button 
                  onClick={() => setView('prices')}
                  className={cn(
                    "px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                    view === 'prices' ? "bg-accent-grad text-[#002244] shadow-lg shadow-accent/20" : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                >
                  Manage Prices
                </button>
                <button 
                  onClick={() => setView('lops_manage')}
                  className={cn(
                    "px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                    view === 'lops_manage' ? "bg-accent-grad text-[#002244] shadow-lg shadow-accent/20" : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                >
                  Manage LOPs
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Inputer Filter (Admin only) */}
            {currentUser.role === 'admin' && (
              <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-xl border-white/10">
                <Users size={14} className="text-accent" />
                <select 
                  value={filterInputer}
                  onChange={(e) => setFilterInputer(e.target.value)}
                  className="text-xs font-bold bg-transparent focus:outline-none uppercase tracking-wider cursor-pointer appearance-none pr-4"
                >
                  <option value="all" className="bg-[#2b5876]">All Inputers</option>
                  {inputerNames.map(name => (
                    <option key={name} value={name} className="bg-[#2b5876]">{name}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="text-white/30" />
              </div>
            )}

            <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-xl border-white/10">
              <Filter size={14} className="text-accent" />
              <input 
                type="month" 
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="text-xs font-bold bg-transparent focus:outline-none uppercase tracking-wider cursor-pointer"
              />
            </div>
            <button 
              onClick={exportToExcel} 
              disabled={pivotData.rows.length === 0}
              className="px-6 py-2 border border-accent text-accent rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent hover:text-[#002244] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Download Excel
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {view === 'analytics' ? (
             <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-8"
              >
                {/* Stats Summary - Upgraded Design */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="glass-card p-6 rounded-2xl border-white/10 flex items-center gap-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                      <TableIcon size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Total Volume</div>
                      <div className="text-2xl font-light text-accent">{pivotData.rows.reduce((acc, r) => acc + r.total, 0).toLocaleString()} <span className="text-[10px] opacity-30">Units</span></div>
                    </div>
                  </div>
                  <div className="glass-card p-6 rounded-2xl border-white/10 flex items-center gap-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Total Valuation</div>
                      <div className="text-2xl font-light text-accent">{formatIDR(pivotData.rows.reduce((acc, r) => acc + r.totalPrice, 0))}</div>
                    </div>
                  </div>
                  <div className="glass-card p-6 rounded-2xl border-white/10 flex items-center gap-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                      <BarChart3 size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">LOP Projects</div>
                      <div className="text-2xl font-light text-accent">{pivotData.lops.length} <span className="text-[10px] opacity-30">Entries</span></div>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Valuation Highlight */}
                  <div className="lg:col-span-2 glass-card p-8 rounded-3xl border-white/10 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Monthly Valuation Trend</h3>
                        <p className="text-[10px] text-white/30 uppercase mt-1 tracking-widest">Selected Period: {filterMonth}</p>
                      </div>
                      <div className="bg-accent/10 p-2 rounded-lg text-accent">
                        <TrendingUp size={20} />
                      </div>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getAnalyticsData.trend}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#00f2fe" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="rgba(255,255,255,0.3)" 
                            fontSize={10} 
                            tickFormatter={(val) => new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          />
                          <YAxis 
                            stroke="rgba(255,255,255,0.3)" 
                            fontSize={10} 
                            tickFormatter={(val) => val >= 1000000 ? `Rp${(val / 1000000).toLocaleString()}M` : formatIDR(val)}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            itemStyle={{ color: '#00f2fe' }}
                            labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                          />
                          <Area type="monotone" dataKey="value" stroke="#00f2fe" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Spending Materials */}
                  <div className="glass-card p-8 rounded-3xl border-white/10">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-accent mb-8">Top Value Drivers</h3>
                    <div className="space-y-6">
                      {getAnalyticsData.topMaterials.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-bold text-white/60 truncate max-w-[150px]">{item.name}</span>
                            <span className="text-[10px] font-mono text-accent">{item.value >= 1000000 ? `Rp ${(item.value / 1000000).toFixed(1)}M` : formatIDR(item.value)}</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(item.value / (getAnalyticsData.topMaterials[0]?.value || 1)) * 100}%` }}
                              className="h-full bg-accent-grad shadow-[0_0_10px_rgba(0,242,254,0.3)]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                   {/* Volume Distribution Chart */}
                   <div className="glass-card p-8 rounded-3xl border-white/10">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-accent mb-8">Volume Leaders (Top 10)</h3>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getAnalyticsData.volumeDistribution} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                          <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                          <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.3)" fontSize={10} width={100} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          />
                          <Bar dataKey="volume" fill="#4facfe" radius={[0, 4, 4, 0]}>
                            {getAnalyticsData.volumeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={`url(#gradientBar)`} />
                            ))}
                          </Bar>
                          <defs>
                            <linearGradient id="gradientBar" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#00f2fe" />
                              <stop offset="100%" stopColor="#4facfe" />
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-6 rounded-3xl border-white/10 flex flex-col justify-center items-center text-center">
                      <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-4">
                        <Package size={24} />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Total Items</div>
                      <div className="text-2xl font-light text-white">{pivotData.rows.length}</div>
                    </div>
                    <div className="glass-card p-6 rounded-3xl border-white/10 flex flex-col justify-center items-center text-center">
                      <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-4">
                        <Calendar size={24} />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Active Days</div>
                      <div className="text-2xl font-light text-white">{getAnalyticsData.trend.length}</div>
                    </div>
                    <div className="glass-card p-6 rounded-3xl border-white/10 flex flex-col justify-center items-center text-center">
                      <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-4">
                        <Coins size={24} />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Avg Vol/Day</div>
                      <div className="text-xl font-light text-white">{(pivotData.rows.reduce((acc, r) => acc + r.total, 0) / (getAnalyticsData.trend.length || 1)).toFixed(1)}</div>
                    </div>
                    <div className="glass-card p-6 rounded-3xl border-white/10 flex flex-col justify-center items-center text-center">
                      <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-4">
                        <ArrowUpRight size={24} />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Highest Daily</div>
                      <div className="text-xl font-light text-white">
                        {Math.max(...getAnalyticsData.trend.map(t => t.value), 0) >= 1000000 
                          ? `Rp ${(Math.max(...getAnalyticsData.trend.map(t => t.value), 0) / 1000000).toFixed(1)}M` 
                          : formatIDR(Math.max(...getAnalyticsData.trend.map(t => t.value), 0))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
          ) : view === 'prices' ? (
            <motion.div
              key="prices"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="grid lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-5">
                <div className="glass-card p-8 rounded-3xl border-white/10">
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent mb-8">Update Unit Prices</h2>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Excel Price Paste Area</label>
                      <textarea 
                        className="glass-input w-full h-64 px-3 py-2 rounded-xl focus:outline-none focus:border-accent/50 transition-all text-xs font-mono resize-none leading-relaxed"
                        placeholder="Paste columns from Excel...&#10;ODP-12  1500000&#10;POLE-9M  2500000"
                        value={pricePasteData}
                        onChange={handlePricePaste}
                      />
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mt-2">Format: [Designator] [Price]</p>
                    </div>
                    <Button 
                      className="w-full" 
                      size="lg" 
                      onClick={savePrices}
                      disabled={isSavingPrices || parsedPrices.length === 0}
                    >
                      {isSavingPrices ? <Loader2 className="animate-spin" size={16} /> : "Update Prices Database"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="glass-card p-8 rounded-3xl border-white/10 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Current Price List</h2>
                      <span className="glass-card px-3 py-1 rounded-full text-[10px] font-bold border-white/5">{Object.keys(prices).length} Items</span>
                    </div>
                    {Object.keys(prices).length > 0 && (
                      <button 
                        onClick={deleteAllPrices}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-all border border-red-500/20"
                      >
                        <Trash2 size={12} />
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-white/5">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/5">
                          <th className="text-left p-4 font-bold uppercase tracking-widest text-white/40">Designator</th>
                          <th className="text-right p-4 font-bold uppercase tracking-widest text-white/40">Unit Price</th>
                          <th className="w-16 p-4"></th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {Object.entries(prices).sort().map(([designator, price]) => (
                          <tr key={designator} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                            <td className="p-4 text-white/80">{designator}</td>
                            <td className="p-4 text-right text-accent">{formatIDR(price as number)}</td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => deletePrice(designator)}
                                className="p-1 text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Price"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'lops_manage' ? (
            <motion.div
              key="lops_manage"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="glass-card rounded-3xl border-white/10 overflow-hidden shadow-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                    <TableIcon size={16} /> Manage All LOPs
                  </h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        <th className="text-left p-4 font-bold uppercase tracking-widest text-white/40">Created At</th>
                        <th className="text-left p-4 font-bold uppercase tracking-widest text-white/40">LOP Date</th>
                        <th className="text-left p-4 font-bold uppercase tracking-widest text-white/40">LOP Name</th>
                        <th className="text-left p-4 font-bold uppercase tracking-widest text-white/40">Type</th>
                        <th className="text-left p-4 font-bold uppercase tracking-widest text-white/40">Inputer</th>
                        <th className="text-center p-4 font-bold uppercase tracking-widest text-white/40">Items</th>
                        <th className="text-right p-4 font-bold uppercase tracking-widest text-white/40">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="font-sans">
                      {lops.map(lop => (
                        <tr key={lop.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                          <td className="p-4 font-mono text-white/60">
                            {new Date(lop.created_at).toLocaleString('id-ID')}
                          </td>
                          <td className="p-4 font-mono text-white/80">
                            {new Date(lop.date).toLocaleDateString('id-ID')}
                          </td>
                          <td className="p-4 font-bold text-accent tracking-wide">{lop.name}</td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold",
                              lop.type === 'warehouse' ? "bg-blue-500/20 text-blue-300 border border-blue-500/20" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20"
                            )}>
                              {lop.type}
                            </span>
                          </td>
                          <td className="p-4 text-white/80">{lop.inputer_name}</td>
                          <td className="p-4 text-center font-mono text-white/80">{lop.items.length}</td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => deleteLop(lop.id)}
                              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all ml-auto opacity-50 group-hover:opacity-100"
                              title="Delete LOP"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {lops.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-white/40 font-sans">
                            No LOP entries found in the database.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : view === 'users' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="grid lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-5">
                <div className="glass-card p-8 rounded-3xl border-white/10">
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent mb-8">Add New User</h2>
                  <form onSubmit={handleAddUser} className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Username</label>
                      <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Username" required />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Password</label>
                      <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" placeholder="Password" required />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Nama Inputer</label>
                      <Input value={newInputerName} onChange={e => setNewInputerName(e.target.value)} placeholder="Full Name" required />
                    </div>
                    <Button type="submit" className="w-full" size="lg">Create User Account</Button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="glass-card p-8 rounded-3xl border-white/10 h-full">
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent mb-8">Existing Users</h2>
                  <div className="space-y-4">
                    {allUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-4 glass-card rounded-2xl border-white/5 bg-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                            <User size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold uppercase tracking-wider">{u.inputer_name}</div>
                            <div className="text-[10px] text-white/40 uppercase tracking-widest">@{u.username} • {u.role}</div>
                          </div>
                        </div>
                        {u.username !== 'ecky' && (
                          <button 
                            onClick={() => deleteUser(u.id, u.username)}
                            className="p-2 text-white/20 hover:text-red-400 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'input' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="grid lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-5 space-y-6">
                <div className="glass-card p-8 rounded-3xl border-white/10">
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent mb-8">Data Entry</h2>
                  
                  <div className="mb-8 p-1.5 glass-card rounded-xl border-white/5 flex gap-2">
                    <button 
                      onClick={() => { setInputType('warehouse'); setLopName(''); setLopDate(new Date().toISOString().slice(0, 10)); }}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                        inputType === 'warehouse' ? "bg-accent-grad text-[#002244]" : "text-white/40 hover:bg-white/5"
                      )}
                    >
                      Warehouse
                    </button>
                    <button 
                      onClick={() => setInputType('boq')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                        inputType === 'boq' ? "bg-accent-grad text-[#002244]" : "text-white/40 hover:bg-white/5"
                      )}
                    >
                      BOQ
                    </button>
                  </div>

                  <div className="space-y-6">
                    {inputType === 'boq' ? (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Select Warehouse LOP</label>
                        <select 
                          className="glass-input w-full px-3 py-2 rounded-lg focus:outline-none focus:border-accent/50 transition-all text-sm bg-transparent appearance-none"
                          value={selectedWarehouseId}
                          onChange={(e) => {
                            const lop = pendingWarehouseLops.find(l => l.id === e.target.value);
                            if (lop) {
                              setSelectedWarehouseId(lop.id);
                              setLopName(lop.name);
                              setLopDate(lop.date);
                            } else {
                              setSelectedWarehouseId('');
                              setLopName('');
                            }
                          }}
                        >
                          <option value="" className="bg-[#2b5876]">Choose Pending Warehouse LOP...</option>
                          {pendingWarehouseLops.map(lop => (
                            <option key={lop.id} value={lop.id} className="bg-[#2b5876]">{lop.name} ({new Date(lop.date).toLocaleDateString()})</option>
                          ))}
                        </select>
                        {pendingWarehouseLops.length === 0 && (
                          <p className="text-[9px] text-red-400 uppercase tracking-widest">No pending Warehouse projects available</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Nama LOP</label>
                          <Input 
                            placeholder="e.g. Zone A Fiber Optic" 
                            value={lopName}
                            onChange={(e) => setLopName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Tanggal Pekerjaan</label>
                          <Input 
                            type="date" 
                            value={lopDate}
                            onChange={(e) => setLopDate(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                    
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Excel Paste Area</label>
                      <textarea 
                        className="glass-input w-full h-48 px-3 py-2 rounded-xl focus:outline-none focus:border-accent/50 transition-all text-xs font-mono resize-none leading-relaxed"
                        placeholder="Paste columns from Excel...&#10;ODP-12  10&#10;POLE-9M  5"
                        value={pasteData}
                        onChange={handlePaste}
                      />
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mt-2">Auto-splits designator & volume</p>
                    </div>
                  </div>

                  <Button 
                    className="w-full mt-8" 
                    size="lg" 
                    onClick={saveLop}
                    disabled={isSaving || !lopName || parsedItems.length === 0 || (inputType === 'boq' && !selectedWarehouseId)}
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : `Save ${inputType.toUpperCase()} Entry`}
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="glass-card p-8 rounded-3xl border-white/10 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Parsed Preview</h2>
                    <span className="glass-card px-3 py-1 rounded-full text-[10px] font-bold border-white/5">{parsedItems.length} Items</span>
                  </div>
                  
                  <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-white/5">
                    {parsedItems.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-white/5">
                            <th className="text-left p-4 font-bold uppercase tracking-widest text-white/40">Designator</th>
                            <th className="text-right p-4 font-bold uppercase tracking-widest text-white/40">Volume</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {parsedItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-4 text-white/80">{item.designator}</td>
                              <td className="p-4 text-right text-accent">{item.volume.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-white/20 p-12 text-center">
                        <ClipboardPaste size={48} className="mb-4 opacity-10" />
                        <p className="text-xs uppercase tracking-widest font-bold">Waiting for Excel data...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-8"
            >
              {/* Dashboard Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-full md:w-80">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <Input 
                      placeholder="Search designator..." 
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="p-1 glass-card rounded-xl border-white/5 flex gap-1">
                    <button 
                      onClick={() => setDashboardMode('boq')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                        dashboardMode === 'boq' ? "bg-accent-grad text-[#002244]" : "text-white/40 hover:bg-white/5"
                      )}
                    >
                      BOQ View
                    </button>
                    <button 
                      onClick={() => setDashboardMode('comparison')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                        dashboardMode === 'comparison' ? "bg-accent-grad text-[#002244]" : "text-white/40 hover:bg-white/5"
                      )}
                    >
                      Comparison View
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                   <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-3">
                    {dashboardMode === 'comparison' ? `${comparisonData?.length || 0} Pairs Compared` : `${pivotData.rows.length} Items Found`}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <Loader2 className="animate-spin text-accent" size={48} />
                </div>
              ) : dashboardMode === 'comparison' ? (
                <div className="grid md:grid-cols-2 gap-8">
                  {comparisonData?.map(pair => (
                    <div key={pair.id} className="glass-card rounded-3xl border-white/10 overflow-hidden flex flex-col shadow-xl">
                      <div className="p-6 bg-white/5 border-b border-white/5 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold uppercase tracking-widest">{pair.name}</h3>
                          <p className="text-[9px] text-white/30 uppercase mt-1 tracking-widest">{new Date(pair.date).toLocaleDateString()} // {pair.inputer}</p>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-accent uppercase tracking-widest">Difference Report</span>
                        </div>
                      </div>
                      <div className="overflow-auto max-h-[400px]">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[#3a4b7a] z-10">
                            <tr>
                              <th className="p-4 text-left font-bold uppercase tracking-widest text-white/40">Designator</th>
                              <th className="p-4 text-right font-bold uppercase tracking-widest text-white/40">WH</th>
                              <th className="p-4 text-right font-bold uppercase tracking-widest text-white/40">BOQ</th>
                              <th className="p-4 text-right font-bold uppercase tracking-widest text-white/40">Delta</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono">
                            {pair.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="p-4 text-white/80">{item.designator}</td>
                                <td className="p-4 text-right text-white/40">{item.warehouseVol.toLocaleString()}</td>
                                <td className="p-4 text-right text-white/80">{item.boqVol.toLocaleString()}</td>
                                <td className={cn(
                                  "p-4 text-right font-bold",
                                  item.diff > 0 ? "text-green-400" : item.diff < 0 ? "text-red-400" : "text-white/20"
                                )}>
                                  {item.diff > 0 ? `+${item.diff.toLocaleString()}` : item.diff.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-4 bg-white/5 border-t border-white/5 flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                        <div className="text-red-400">Total Under: {pair.items.filter(i => i.diff < 0).length}</div>
                        <div className="text-green-400">Total Extra: {pair.items.filter(i => i.diff > 0).length}</div>
                      </div>
                    </div>
                  ))}
                  {comparisonData?.length === 0 && (
                    <div className="md:col-span-2 glass-card p-20 rounded-3xl border-white/10 text-center flex flex-col items-center">
                       <AlertTriangle size={48} className="text-white/10 mb-6" />
                       <h3 className="text-xl font-light tracking-widest uppercase mb-2">No Comparisons Available</h3>
                       <p className="text-white/30 text-xs">Pair up Warehouse entries with BOQ entries to see differences here.</p>
                    </div>
                  )}
                </div>
              ) : pivotData.rows.length > 0 ? (
                <div className="glass-card rounded-3xl border-white/10 overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/10">
                          <th className="p-5 text-left border-r border-white/5 font-bold uppercase tracking-[0.2em] text-accent sticky left-0 bg-[#3a4b7a] backdrop-blur-md z-20 min-w-[200px]">Designator</th>
                          <th className="p-5 text-right border-r border-white/5 font-bold uppercase tracking-[0.2em] text-accent sticky left-[200px] bg-[#3a4b7a] backdrop-blur-md z-20 min-w-[120px]">Unit Price</th>
                          <th className="p-5 text-right border-r border-white/5 font-bold uppercase tracking-[0.2em] text-accent sticky left-[320px] bg-[#3a4b7a] backdrop-blur-md z-20 min-w-[120px]">Total Vol</th>
                          <th className="p-5 text-right border-r border-white/5 font-bold uppercase tracking-[0.2em] text-accent sticky left-[440px] bg-[#3a4b7a] backdrop-blur-md z-20 min-w-[150px]">Total Price</th>
                          {pivotData.lops.map(lop => (
                            <th key={lop.id} className="p-5 text-center border-r border-white/5 min-w-[160px]">
                              <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1">{new Date(lop.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                              <div className="text-[11px] font-bold tracking-tight line-clamp-1">{lop.name}</div>
                              <div className="text-[8px] text-accent uppercase tracking-widest mt-1 font-bold">{lop.inputer_name}</div>
                              <button 
                                onClick={() => deleteLop(lop.id)}
                                className="mt-3 text-white/20 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pivotData.rows.map((row, idx) => (
                          <tr 
                            key={row.designator} 
                            className="border-b border-white/5 hover:bg-white/10 transition-colors group"
                          >
                            <td className="p-5 font-bold border-r border-white/5 sticky left-0 bg-[#3a4b7a]/80 backdrop-blur-md z-10 group-hover:bg-[#3a4b7a] transition-colors">{row.designator}</td>
                            <td className="p-5 text-right font-mono border-r border-white/5 sticky left-[200px] bg-[#3a4b7a]/80 backdrop-blur-md z-10 group-hover:bg-[#3a4b7a] transition-colors text-white/50">{formatIDR(row.unitPrice)}</td>
                            <td className="p-5 text-right font-mono font-bold border-r border-white/5 sticky left-[320px] bg-[#3a4b7a]/80 backdrop-blur-md z-10 group-hover:bg-[#3a4b7a] transition-colors text-accent">{row.total.toLocaleString()}</td>
                            <td className="p-5 text-right font-mono font-bold border-r border-white/5 sticky left-[440px] bg-[#3a4b7a]/80 backdrop-blur-md z-10 group-hover:bg-[#3a4b7a] transition-colors text-accent">{formatIDR(row.totalPrice)}</td>
                            {pivotData.lops.map(lop => (
                              <td key={lop.id} className="p-5 text-center font-mono border-r border-white/5 text-white/60">
                                {row[lop.id] ? (
                                  <span className="px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20">
                                    {row[lop.id].toLocaleString()}
                                  </span>
                                ) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-20 rounded-3xl border-white/10 text-center flex flex-col items-center shadow-2xl">
                  <div className="w-24 h-24 glass-card rounded-2xl flex items-center justify-center mb-8 border-white/5">
                    <TableIcon size={48} className="text-white/10" />
                  </div>
                  <h3 className="text-2xl font-light tracking-widest uppercase mb-4">No Data Recorded</h3>
                  <p className="text-white/40 text-sm max-w-md mb-10 leading-relaxed">
                    The dashboard for {new Date(filterMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} is currently empty.
                  </p>
                  <Button onClick={() => setView('input')} className="px-10 py-4">
                    Initialize First Entry
                  </Button>
                </div>
              )}

              {/* Stats Summary */}
              {pivotData.rows.length > 0 && (
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="glass-card p-6 rounded-2xl border-white/10 flex items-center gap-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                      <TableIcon size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Total Volume</div>
                      <div className="text-2xl font-light text-accent">{pivotData.rows.reduce((acc, r) => acc + r.total, 0).toLocaleString()} <span className="text-[10px] opacity-30">Units</span></div>
                    </div>
                  </div>
                  <div className="glass-card p-6 rounded-2xl border-white/10 flex items-center gap-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Total Valuation</div>
                      <div className="text-2xl font-light text-accent">{formatIDR(pivotData.rows.reduce((acc, r) => acc + r.totalPrice, 0))}</div>
                    </div>
                  </div>
                  <div className="glass-card p-6 rounded-2xl border-white/10 flex items-center gap-6">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                      <BarChart3 size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">LOP Projects</div>
                      <div className="text-2xl font-light text-accent">{pivotData.lops.length} <span className="text-[10px] opacity-30">Entries</span></div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 mt-12">
        <div className="flex items-center gap-3 opacity-30">
          <TableIcon size={14} />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em]">MaBoQ // Material BOQ</span>
        </div>
        <div className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-30 italic">
          designed by : eQ
        </div>
      </footer>

      <Modal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        variant={modalConfig.variant}
      />
    </div>
  );
}
