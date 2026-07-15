import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader, bustCache } from '../lib/api';

interface ProductItem {
  id: string;
  name: string;
  buyingPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  category?: string;
  subcategory?: string;
}

const fmt = (n: number) =>
  `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

type StockFilter = 'all' | 'low' | 'out';

export default function ProductsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [activeCategory, setActiveCategory] = useState<string>('__all__');
  const [activeSubcategory, setActiveSubcategory] = useState<string>('__all__');
  const [form, setForm] = useState({
    name: '', buyingPrice: '', sellingPrice: '',
    stockQuantity: '', lowStockThreshold: '', category: '', subcategory: '',
  });

  // Sync category from URL parameter
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setActiveCategory(categoryParam);
    } else {
      setActiveCategory('__all__');
    }
  }, [searchParams]);

  const { data: products = [], loading, error, reload } = useFetch<ProductItem[]>(
    () => fetch(`${API_URL}/products`, { headers: authHeader() }).then((r) => {
      if (!r.ok) throw new Error('Failed to load products');
      return r.json();
    }),
    [user?.id],
  );

  const { data: categories = [] } = useFetch<string[]>(
    () => fetch(`${API_URL}/products/categories`, { headers: authHeader() }).then((r) => r.json()),
    [user?.id],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          name: form.name.trim(),
          buyingPrice: Number(form.buyingPrice),
          sellingPrice: Number(form.sellingPrice),
          stockQuantity: Number(form.stockQuantity),
          lowStockThreshold: Number(form.lowStockThreshold || 0),
          category: form.category.trim() || null,
          subcategory: form.subcategory.trim() || null,
          userId: user?.id,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Array.isArray(payload.message) ? payload.message[0] : payload.message || 'Failed');
      toast.success(`Added ${payload.name}`);
      bustCache('/products');
      setForm({ name: '', buyingPrice: '', sellingPrice: '', stockQuantity: '', lowStockThreshold: '', category: '', subcategory: '' });
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  // Derive grouped data
  const filtered = useMemo(() => products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const threshold = p.lowStockThreshold ?? 0;
    const matchStock =
      stockFilter === 'all' ||
      (stockFilter === 'out' && p.stockQuantity === 0) ||
      (stockFilter === 'low' && p.stockQuantity > 0 && threshold > 0 && p.stockQuantity <= threshold);
    const matchCat = activeCategory === '__all__' || (p.category ?? 'Uncategorized') === activeCategory;
    const matchSubcat = activeSubcategory === '__all__' || (p.subcategory ?? 'Uncategorized') === activeSubcategory;
    return matchSearch && matchStock && matchCat && matchSubcat;
  }), [products, search, stockFilter, activeCategory, activeSubcategory]);

  const lowCount = products.filter((p) => p.stockQuantity > 0 && (p.lowStockThreshold ?? 0) > 0 && p.stockQuantity <= (p.lowStockThreshold ?? 0)).length;
  const outCount = products.filter((p) => p.stockQuantity === 0).length;

  const subcategories = useMemo(() => {
    if (activeCategory === '__all__') return [];
    const cats = [...new Set(products.filter(p => (p.category ?? 'Uncategorized') === activeCategory).map(p => p.subcategory ?? 'Uncategorized'))].sort();
    return cats;
  }, [products, activeCategory]);
  const allSubcategories = ['__all__', ...subcategories];

  const isCategoryView = activeCategory !== '__all__';

  return (
    <PageShell
      title={isCategoryView ? activeCategory : 'Products'}
      description={isCategoryView ? `${filtered.length} items in this category` : 'Add inventory and track stock for your shop.'}
    >
      <div className="max-w-4xl mx-auto">

        {/* Category view — just the list, no form */}
        {isCategoryView ? (
          <div className="rounded-2xl border border-slate-200 p-5">
            {/* Subcategory tabs */}
            {allSubcategories.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {allSubcategories.map((subcat) => (
                  <button key={subcat} type="button" onClick={() => setActiveSubcategory(subcat)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activeSubcategory === subcat ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {subcat === '__all__'
                      ? `All (${products.filter(p => (p.category ?? 'Uncategorized') === activeCategory).length})`
                      : `${subcat} (${products.filter(p => (p.category ?? 'Uncategorized') === activeCategory && (p.subcategory ?? 'Uncategorized') === subcat).length})`}
                  </button>
                ))}
              </div>
            )}
            {/* Search */}
            <input type="text" placeholder={`Search in ${activeCategory}...`} value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none mb-4" />

            {loading ? <SkeletonList rows={5} />
              : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                  No products in this category yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((p) => {
                    const threshold = p.lowStockThreshold ?? 0;
                    const isOut = p.stockQuantity === 0;
                    const isLow = !isOut && threshold > 0 && p.stockQuantity <= threshold;
                    return (
                      <div key={p.id} className={`rounded-xl border p-3 ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="truncate font-medium text-slate-900">{p.name}</p>
                              {p.subcategory && <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">{p.subcategory}</span>}
                              {isOut && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Out</span>}
                              {isLow && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">Low</span>}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">Buy {fmt(p.buyingPrice)} · Sell {fmt(p.sellingPrice)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>{p.stockQuantity} units</p>
                            {threshold > 0 && <p className="text-xs text-slate-400">min {threshold}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        ) : (
          /* Default view — form + full inventory list */
          <div className="grid gap-6 lg:grid-cols-[340px,1fr]">

            {/* Add form */}
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold text-slate-900">Add product</h2>
              <div className="mt-4 space-y-3">
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Category</label>
                  <input list="cat-list" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="e.g. Solar Equipment, Lighting…"
                    value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  <datalist id="cat-list">
                    {categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Subcategory</label>
                  <input list="subcat-list" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="e.g. Panels, Inverters, LED Bulbs…"
                    value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
                  <datalist id="subcat-list">
                    {[...new Set(products.filter(p => p.category === form.category).map(p => p.subcategory).filter(Boolean))].map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Buying price" type="number" value={form.buyingPrice} onChange={(e) => setForm({ ...form, buyingPrice: e.target.value })} required />
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Selling price" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Stock quantity" type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} required />
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Low stock threshold" type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
                </div>
                <button className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save product'}
                </button>
              </div>
            </form>

            {/* Inventory list */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Inventory</h2>
                <span className="text-sm text-slate-500">{filtered.length} of {products.length} items</span>
              </div>
              <div className="space-y-2 mb-3">
                <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
                <div className="flex gap-2">
                  {(['all', 'low', 'out'] as StockFilter[]).map((f) => (
                    <button key={f} type="button" onClick={() => setStockFilter(f)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${stockFilter === f ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {f === 'all' && `All (${products.length})`}
                      {f === 'low' && `Low (${lowCount})`}
                      {f === 'out' && `Out (${outCount})`}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? <SkeletonList rows={5} />
                : error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center justify-between">
                    <span>{error}</span>
                    <button type="button" onClick={() => reload()} className="text-xs underline">Retry</button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                    {products.length === 0 ? 'No products yet. Add your first item.' : 'No products match your filters.'}
                  </div>
                ) : (
                  <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
                    {filtered.map((p) => {
                      const threshold = p.lowStockThreshold ?? 0;
                      const isOut = p.stockQuantity === 0;
                      const isLow = !isOut && threshold > 0 && p.stockQuantity <= threshold;
                      return (
                        <div key={p.id} className={`rounded-xl border p-3 ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="truncate font-medium text-slate-900">{p.name}</p>
                                {p.category && <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">{p.category}</span>}
                                {isOut && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Out</span>}
                                {isLow && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">Low</span>}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">Buy {fmt(p.buyingPrice)} · Sell {fmt(p.sellingPrice)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>{p.stockQuantity} units</p>
                              {threshold > 0 && <p className="text-xs text-slate-400">min {threshold}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
