import { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader, bustCache } from '../lib/api';

interface Product {
  id: string;
  name: string;
  buyingPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  category?: string;
}

const fmt = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function RestockPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting]     = useState(false);
  const [search, setSearch]             = useState('');
  const [filter, setFilter]             = useState<'all' | 'low' | 'out'>('all');
  const [activeCategory, setActiveCategory] = useState<string>('__all__');
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [restockQty, setRestockQty]     = useState('');
  const [newBuyPrice, setNewBuyPrice]   = useState('');
  const [newSellPrice, setNewSellPrice] = useState('');
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editForm, setEditForm]         = useState({ name: '', buyingPrice: '', sellingPrice: '', lowStockThreshold: '' });

  const { data: products = [], loading, error, reload } = useFetch<Product[]>(
    () => fetch(`${API_URL}/products`, { headers: authHeader() }).then(r => {
      if (!r.ok) throw new Error('Failed to load products');
      return r.json();
    }),
    [user?.id],
  );

  const { data: categories = [] } = useFetch<string[]>(
    () => fetch(`${API_URL}/products/categories`, { headers: authHeader() }).then(r => r.json()),
    [user?.id],
  );

  const filtered = useMemo(() => products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const threshold = p.lowStockThreshold ?? 0;
    const matchFilter =
      filter === 'all' ||
      (filter === 'out' && p.stockQuantity === 0) ||
      (filter === 'low' && p.stockQuantity > 0 && threshold > 0 && p.stockQuantity <= threshold);
    const matchCat = activeCategory === '__all__' || (p.category ?? 'Uncategorized') === activeCategory;
    return matchSearch && matchFilter && matchCat;
  }), [products, search, filter, activeCategory]);

  const lowCount = products.filter(p => p.stockQuantity > 0 && (p.lowStockThreshold ?? 0) > 0 && p.stockQuantity <= (p.lowStockThreshold ?? 0)).length;
  const outCount = products.filter(p => p.stockQuantity === 0).length;

  const allCategories = ['__all__', ...categories, ...(products.some(p => !p.category) ? ['Uncategorized'] : [])];

  const handleRestock = async (id: string) => {
    const qty = Number(restockQty);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ quantity: -qty }),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error(p.message || 'Failed to restock');
      }
      if (newBuyPrice || newSellPrice) {
        const updates: Record<string, number> = {};
        if (newBuyPrice) updates.buyingPrice = Number(newBuyPrice);
        if (newSellPrice) updates.sellingPrice = Number(newSellPrice);
        await fetch(`${API_URL}/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify(updates),
        });
      }
      toast.success(`Added ${qty} units to stock`);
      setEditingId(null); setRestockQty(''); setNewBuyPrice(''); setNewSellPrice('');
      bustCache('/products'); reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Restock failed'); }
    finally { setSubmitting(false); }
  };

  const handleEditProduct = async (id: string) => {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.name) body.name = editForm.name;
      if (editForm.buyingPrice) body.buyingPrice = Number(editForm.buyingPrice);
      if (editForm.sellingPrice) body.sellingPrice = Number(editForm.sellingPrice);
      if (editForm.lowStockThreshold !== '') body.lowStockThreshold = Number(editForm.lowStockThreshold);
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Product updated');
      setEditingProduct(null);
      bustCache('/products'); reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Update failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`${API_URL}/products/${id}`, { method: 'DELETE', headers: authHeader() });
    toast.success('Product deleted');
    bustCache('/products'); reload();
  };

  return (
    <PageShell title="Stock Management" description="Restock products, update prices, and manage your inventory.">

      {/* Category tabs */}
      {allCategories.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {allCategories.map((cat) => (
            <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeCategory === cat ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {cat === '__all__' ? `All (${products.length})` : cat}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className="w-60 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          placeholder="Search products..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2">
          {(['all', 'low', 'out'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === f ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f === 'all' ? `All (${products.length})` : f === 'low' ? `Low (${lowCount})` : `Out (${outCount})`}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-slate-400">{filtered.length} products</span>
      </div>

      {loading ? <SkeletonList rows={6} />
        : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
            {products.length === 0 ? 'No products yet. Add some from the Inventory page.' : 'No products match your filters.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const threshold = p.lowStockThreshold ?? 0;
              const isOut = p.stockQuantity === 0;
              const isLow = !isOut && threshold > 0 && p.stockQuantity <= threshold;
              const isRestocking = editingId === p.id;
              const isEditing = editingProduct === p.id;

              return (
                <div key={p.id} className={`rounded-2xl border p-4 transition ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        {p.category && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">{p.category}</span>}
                        {isOut && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Out of stock</span>}
                        {isLow && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">Low stock</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Buy {fmt(p.buyingPrice)} · Sell {fmt(p.sellingPrice)}
                        {threshold > 0 && ` · Min ${threshold} units`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xl font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                        {p.stockQuantity}
                      </p>
                      <p className="text-xs text-slate-400">units</p>
                    </div>
                  </div>

                  {!isRestocking && !isEditing && (
                    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                      <button type="button"
                        onClick={() => { setEditingId(p.id); setRestockQty(''); setNewBuyPrice(''); setNewSellPrice(''); setEditingProduct(null); }}
                        className="rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 transition">
                        + Add stock
                      </button>
                      <button type="button"
                        onClick={() => { setEditingProduct(p.id); setEditForm({ name: p.name, buyingPrice: String(p.buyingPrice), sellingPrice: String(p.sellingPrice), lowStockThreshold: String(p.lowStockThreshold ?? 0) }); setEditingId(null); }}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(p.id, p.name)}
                        className="ml-auto text-xs text-slate-400 hover:text-red-500 transition">
                        Delete
                      </button>
                    </div>
                  )}

                  {isRestocking && (
                    <div className="mt-3 border-t border-slate-200 pt-3 space-y-3">
                      <p className="text-xs font-semibold text-slate-700">Add stock to {p.name}</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Units to add</label>
                          <input type="number" min="1" placeholder="e.g. 50" autoFocus
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            value={restockQty} onChange={(e) => setRestockQty(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">New buy price (optional)</label>
                          <input type="number" placeholder={String(p.buyingPrice)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            value={newBuyPrice} onChange={(e) => setNewBuyPrice(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">New sell price (optional)</label>
                          <input type="number" placeholder={String(p.sellingPrice)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            value={newSellPrice} onChange={(e) => setNewSellPrice(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleRestock(p.id)} disabled={submitting}
                          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand-600 transition">
                          {submitting ? 'Saving…' : 'Confirm restock'}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-sm text-slate-400 hover:text-slate-600">Cancel</button>
                      </div>
                    </div>
                  )}

                  {isEditing && (
                    <div className="mt-3 border-t border-slate-200 pt-3 space-y-3">
                      <p className="text-xs font-semibold text-slate-700">Edit product details</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Product name</label>
                          <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Low stock threshold</label>
                          <input type="number" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            value={editForm.lowStockThreshold} onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Buying price (UGX)</label>
                          <input type="number" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            value={editForm.buyingPrice} onChange={(e) => setEditForm({ ...editForm, buyingPrice: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Selling price (UGX)</label>
                          <input type="number" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                            value={editForm.sellingPrice} onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handleEditProduct(p.id)} disabled={submitting}
                          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand-600 transition">
                          {submitting ? 'Saving…' : 'Save changes'}
                        </button>
                        <button type="button" onClick={() => setEditingProduct(null)} className="text-sm text-slate-400 hover:text-slate-600">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </PageShell>
  );
}
