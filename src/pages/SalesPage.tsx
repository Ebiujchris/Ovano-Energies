import { useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader, bustCache } from '../lib/api';

interface ProductItem {
  id: string;
  name: string;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  category?: string;
  brand?: string;
}
interface SaleItem {
  id: string;
  product?: { name: string };
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentType: string;
  customerName?: string;
  status?: string;
  createdAt: string;
  createdByStaffId?: string;
}
interface CartItem {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

const fmt = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function SalesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartCustomer, setCartCustomer] = useState('');
  const [cartPayment, setCartPayment] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  // Two-step picker: category → brand → product
  const [pickerCategory, setPickerCategory] = useState('__all__');
  const [pickerBrand, setPickerBrand] = useState('__all__');
  const [pickerProductId, setPickerProductId] = useState('');
  const [pickerQty, setPickerQty] = useState('1');
  const [pickerPrice, setPickerPrice] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const [filter, setFilter] = useState<'all' | 'cash' | 'credit'>('all');
  const [search, setSearch] = useState('');
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 10;
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data: products = [], loading: prodLoading } = useFetch<ProductItem[]>(
    () => fetch(`${API_URL}/products`, { headers: authHeader() }).then((r) => r.json()),
    [user?.id],
  );

  const { data: sales = [], loading: salesLoading, error, reload } = useFetch<SaleItem[]>(
    () => fetch(`${API_URL}/sales`, { headers: authHeader() }).then((r) => {
      if (!r.ok) throw new Error('Failed to load sales');
      return r.json();
    }),
    [user?.id],
  );

  // Derive categories from products
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category ?? 'Uncategorized'))].sort();
    return cats;
  }, [products]);

  const allCategories = ['__all__', ...categories];



  // Products filtered by selected category, brand, and search
  const categoryProducts = useMemo(() => {
    let filtered = products;
    if (pickerCategory !== '__all__') {
      filtered = filtered.filter(p => (p.category ?? 'Uncategorized') === pickerCategory);
    }
    if (pickerBrand !== '__all__') {
      filtered = filtered.filter(p => p.brand === pickerBrand);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [products, pickerCategory, pickerBrand, productSearch]);

  const handlePickerProduct = (id: string) => {
    setPickerProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) setPickerPrice(String(p.sellingPrice));
  };

  const handleCategoryChange = (cat: string) => {
    setPickerCategory(cat);
    setPickerBrand('__all__');
    setPickerProductId('');
    setPickerPrice('');
    setProductSearch('');
  };

  const handleBrandChange = (brand: string) => {
    setPickerBrand(brand);
    setPickerProductId('');
    setPickerPrice('');
    setProductSearch('');
  };

  const addToCart = () => {
    if (!pickerProductId || !pickerPrice || !pickerQty) { toast.error('Select a product, quantity and price'); return; }
    const product = products.find((p) => p.id === pickerProductId);
    if (!product) return;
    const qty = Number(pickerQty);
    const price = Number(pickerPrice);
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === pickerProductId && c.unitPrice === price);
      if (existing) {
        return prev.map((c) => c.key === existing.key ? { ...c, quantity: c.quantity + qty } : c);
      }
      return [...prev, { key: `${pickerProductId}-${Date.now()}`, productId: pickerProductId, productName: product.name, quantity: qty, unitPrice: price }];
    });
    setPickerProductId('');
    setPickerQty('1');
    setPickerPrice('');
  };

  const removeFromCart = (key: string) => setCart((prev) => prev.filter((c) => c.key !== key));
  const updateCartQty = (key: string, qty: number) => {
    if (qty < 1) { removeFromCart(key); return; }
    setCart((prev) => prev.map((c) => c.key === key ? { ...c, quantity: qty } : c));
  };
  const cartTotal = cart.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        cart.map((item) =>
          fetch(`${API_URL}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              paymentType: cartPayment,
              customerName: cartCustomer.trim() || 'Walk-in customer',
              userId: user?.id,
              // TODO: Add createdByStaffId once backend field is working
              // createdByStaffId: user?.id,
            }),
          }).then(async (r) => {
            const payload = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(payload.message || 'Failed');
            return payload;
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      if (failed.length === 0) {
        toast.success(`${succeeded} item${succeeded > 1 ? 's' : ''} sold — ${fmt(cartTotal)}`);
        setCart([]); setCartCustomer(''); setCartPayment('cash');
      } else {
        toast.error(`${succeeded} sold, ${failed.length} failed: ${failed[0].reason?.message}`);
      }
      bustCache('/sales'); bustCache('/products'); bustCache('/dashboard');
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSales = useMemo(() => sales.filter((s) => {
    // TODO: Re-enable staff filtering once createdByStaffId is working
    // if (!isOwner(user)) {
    //   if (s.createdByStaffId !== user?.id) return false;
    // }
    
    const matchFilter = filter === 'all' || s.paymentType === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || [s.product?.name, s.customerName, s.paymentType].some((v) => v?.toLowerCase().includes(q));
    return matchFilter && matchSearch;
  }), [sales, filter, search, user]);

  const handleVoid = async (id: string) => {
    if (!voidReason.trim()) { toast.error('Enter a reason for voiding'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/sales/${id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ reason: voidReason }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'Failed to void sale');
      toast.success('Sale voided — stock restored');
      setVoidingId(null); setVoidReason('');
      bustCache('/sales'); bustCache('/products'); reload();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Void failed'); }
    finally { setSubmitting(false); }
  };

  const totalTxPages = Math.max(1, Math.ceil(filteredSales.length / TX_PAGE_SIZE));
  const visibleSales = filteredSales.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);
  const loading = prodLoading || salesLoading;

  // selected product for stock warning
  const selectedProduct = products.find(p => p.id === pickerProductId);

  return (
    <PageShell title="Sales" description="Build a cart, then checkout all items at once.">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-center">

        {/* ── Cart builder ── */}
        <div className="space-y-4 w-full lg:w-[640px] lg:shrink-0">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Add item to cart</h2>
            <div className="mt-4 space-y-3">

              {/* Category picker */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {allCategories.map((cat) => (
                    <button key={cat} type="button" onClick={() => handleCategoryChange(cat)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${pickerCategory === cat ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                      {cat === '__all__' ? `All (${products.length})` : `${cat} (${products.filter(p => (p.category ?? 'Uncategorized') === cat).length})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand picker — shown when selected category has brands */}
              {(() => {
                const brandPool = pickerCategory === '__all__'
                  ? products
                  : products.filter(p => (p.category ?? 'Uncategorized') === pickerCategory);
                const brands = [...new Set(brandPool.map(p => p.brand).filter(Boolean) as string[])].sort();
                if (brands.length === 0) return null;
                return (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Brand</label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleBrandChange('__all__')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${pickerBrand === '__all__' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                        All
                      </button>
                      {brands.map(brand => (
                        <button key={brand} type="button" onClick={() => handleBrandChange(brand)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${pickerBrand === brand ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                          {brand} ({brandPool.filter(p => p.brand === brand).length})
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Product search + select */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Product</label>
                <input
                  type="text"
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setPickerProductId(''); setPickerPrice(''); }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none mb-2"
                />
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={pickerProductId}
                  onChange={(e) => handlePickerProduct(e.target.value)}
                >
                  <option value="">Select a product</option>
                  {categoryProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · stock {p.stockQuantity}{p.stockQuantity === 0 ? ' ⚠️ OUT' : p.lowStockThreshold && p.stockQuantity <= p.lowStockThreshold ? ' ⚠️ LOW' : ''}
                    </option>
                  ))}
                </select>
                {/* Stock warning badge */}
                {selectedProduct && selectedProduct.stockQuantity === 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600">
                    ⚠️ Out of stock — sale will be blocked
                  </div>
                )}
                {selectedProduct && selectedProduct.stockQuantity > 0 && selectedProduct.lowStockThreshold && selectedProduct.stockQuantity <= selectedProduct.lowStockThreshold && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-600">
                    ⚠️ Low stock — only {selectedProduct.stockQuantity} left
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Quantity" type="number" min="1" value={pickerQty} onChange={(e) => setPickerQty(e.target.value)} />
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Unit price" type="number" value={pickerPrice} onChange={(e) => setPickerPrice(e.target.value)} />
              </div>
              <button type="button" onClick={addToCart} className="rounded-xl border-2 border-dashed border-brand-300 px-5 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition">
                + Add to cart
              </button>
            </div>
          </div>

          {/* Cart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Cart</h2>
              {cart.length > 0 && (
                <button type="button" onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600">Clear all</button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                No items yet. Add products above.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {cart.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.productName}</p>
                      <p className="text-xs text-slate-500">{fmt(item.unitPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => updateCartQty(item.key, item.quantity - 1)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 text-sm font-bold">−</button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button type="button" onClick={() => updateCartQty(item.key, item.quantity + 1)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 text-sm font-bold">+</button>
                      <span className="w-20 text-right text-sm font-semibold text-slate-900">{fmt(item.quantity * item.unitPrice)}</span>
                      <button type="button" onClick={() => removeFromCart(item.key)} className="ml-1 text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2.5 font-semibold">
                  <span className="text-sm text-slate-700">{cart.reduce((s, c) => s + c.quantity, 0)} items</span>
                  <span className="text-base text-slate-900">{fmt(cartTotal)}</span>
                </div>
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Customer name (optional)" value={cartCustomer} onChange={(e) => setCartCustomer(e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'cash', label: '💵 Cash' },
                    { value: 'credit', label: '📋 Credit' },
                    { value: 'mobile_money', label: '📱 Mobile' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCartPayment(opt.value)}
                      className={`rounded-xl border py-2 text-xs font-semibold transition ${
                        cartPayment === opt.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={handleCheckout} disabled={submitting}
                  className="w-full rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 disabled:opacity-60 transition hover:bg-brand-600 sticky bottom-4">
                  {submitting ? 'Processing…' : `Checkout — ${fmt(cartTotal)}`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Sales history ── */}
        <div className="rounded-2xl border border-slate-200 p-5 w-full lg:max-w-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
            <span className="text-sm text-slate-500">{filteredSales.length} of {sales.length}</span>
          </div>

          <div className="mt-4 space-y-3">
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" placeholder="Search buyer or product..." value={search} onChange={(e) => { setSearch(e.target.value); setTxPage(1); }} />
            <div className="flex gap-2">
              {(['all', 'cash', 'credit'] as const).map((f) => (
                <button key={f} type="button" onClick={() => { setFilter(f); setTxPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === f ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {f === 'all' && `All (${sales.length})`}
                  {f === 'cash' && `Cash (${sales.filter((s) => s.paymentType === 'cash').length})`}
                  {f === 'credit' && `Credit (${sales.filter((s) => s.paymentType === 'credit').length})`}
                </button>
              ))}
            </div>
          </div>

          {loading ? <div className="mt-4"><SkeletonList rows={5} /></div>
            : error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 flex items-center justify-between">
                <span>{error}</span>
                <button type="button" onClick={() => reload()} className="text-xs underline">Retry</button>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                {sales.length === 0 ? 'No sales recorded yet.' : 'No matching sales.'}
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-2">
                  {visibleSales.map((sale) => {
                    const isCredit = sale.paymentType === 'credit';
                    const isMobile = sale.paymentType === 'mobile_money';
                    const isVoided = sale.status === 'voided';
                    return (
                      <div key={sale.id} className={`rounded-xl border p-3 transition ${isVoided ? 'border-slate-200 bg-slate-100 opacity-60' : isCredit ? 'border-amber-200 bg-amber-50' : isMobile ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="truncate font-medium text-slate-900">{sale.product?.name ?? 'Product'}</p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${isCredit ? 'bg-amber-100 text-amber-600' : isMobile ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {sale.paymentType.replace('_', ' ')}
                              </span>
                              {isVoided && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-500">voided</span>}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500">{sale.quantity} units · {sale.customerName ?? 'Walk-in customer'}</p>
                            {sale.createdByStaffId && <p className="text-xs text-slate-400">By staff: {sale.createdByStaffId.slice(0, 8)}</p>}
                            <p className="text-xs text-slate-400">{new Date(sale.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`font-semibold ${isVoided ? 'line-through text-slate-400' : 'text-slate-900'}`}>{fmt(sale.totalAmount)}</p>
                            {!isVoided && (
                              <button type="button"
                                onClick={() => { setVoidingId(voidingId === sale.id ? null : sale.id); setVoidReason(''); }}
                                className="mt-1 text-xs text-slate-400 hover:text-red-500 transition">
                                Void
                              </button>
                            )}
                          </div>
                        </div>
                        {voidingId === sale.id && (
                          <div className="mt-3 border-t border-slate-200 pt-3 flex items-center gap-2">
                            <input autoFocus type="text" placeholder="Reason for void"
                              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-red-400 focus:outline-none"
                              value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
                            <button type="button" onClick={() => handleVoid(sale.id)} disabled={submitting}
                              className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60">
                              {submitting ? '…' : 'Confirm'}
                            </button>
                            <button type="button" onClick={() => setVoidingId(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Pagination */}
                {totalTxPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      {(txPage - 1) * TX_PAGE_SIZE + 1}–{Math.min(txPage * TX_PAGE_SIZE, filteredSales.length)} of {filteredSales.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition">←</button>
                      {Array.from({ length: totalTxPages }, (_, i) => i + 1)
                        .filter(n => n === 1 || n === totalTxPages || Math.abs(n - txPage) <= 1)
                        .reduce<(number | '...')[]>((acc, n, i, arr) => {
                          if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('...');
                          acc.push(n); return acc;
                        }, [])
                        .map((n, i) => n === '...'
                          ? <span key={`e-${i}`} className="px-1 text-xs text-slate-400">…</span>
                          : <button key={n} type="button" onClick={() => setTxPage(n as number)}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${txPage === n ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                              {n}
                            </button>
                        )}
                      <button type="button" onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))} disabled={txPage === totalTxPages}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition">→</button>
                    </div>
                  </div>
                )}
              </>
            )}
        </div>
      </div>
    </PageShell>
  );
}
