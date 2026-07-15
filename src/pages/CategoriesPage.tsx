import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { useAuth } from '../context/AuthContext';
import { SkeletonList } from '../components/Skeleton';
import { useFetch } from '../hooks/useFetch';
import { API_URL, authHeader } from '../lib/api';

interface Product {
  id: string;
  name: string;
  category?: string;
  stockQuantity: number;
  lowStockThreshold?: number;
  sellingPrice: number;
}

// Emoji icons for common energy shop categories
const CATEGORY_ICONS: Record<string, string> = {
  'Solar Panels':    '☀️',
  'Solar':           '☀️',
  'Batteries':       '🔋',
  'Inverters':       '⚡',
  'Phones':          '📱',
  'Computers':       '💻',
  'Laptops':         '💻',
  'Lighting':        '💡',
  'Lights':          '💡',
  'Accessories':     '🔌',
  'Cables':          '🔌',
  'Generators':      '🏭',
  'Water Pumps':     '💧',
  'Controllers':     '🎛️',
  'Uncategorized':   '📦',
};

function getCategoryIcon(name: string): string {
  return CATEGORY_ICONS[name] ?? '📦';
}

export default function CategoriesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: products = [], loading, error } = useFetch<Product[]>(
    () => fetch(`${API_URL}/products`, { headers: authHeader() }).then(r => {
      if (!r.ok) throw new Error('Failed to load products');
      return r.json();
    }),
    [user?.id],
  );

  const categoryGroups = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const cat = p.category?.trim() || 'Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return [...map.entries()]
      .map(([name, items]) => {
        const totalStock = items.reduce((s, p) => s + Number(p.stockQuantity), 0);
        const outCount = items.filter(p => Number(p.stockQuantity) === 0).length;
        const lowCount = items.filter(p => {
          const qty = Number(p.stockQuantity);
          const thresh = Number(p.lowStockThreshold ?? 0);
          return qty > 0 && thresh > 0 && qty <= thresh;
        }).length;
        return { name, items, totalStock, outCount, lowCount };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  return (
    <PageShell title="Categories" description="Browse products by category.">
      {loading ? (
        <SkeletonList rows={6} />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : categoryGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500">
          <p className="text-3xl mb-3">📦</p>
          <p className="font-medium">No categories yet</p>
          <p className="text-sm mt-1">Add products with a category from the Inventory page.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categoryGroups.map(({ name, items, totalStock, outCount, lowCount }) => (
            <button
              key={name}
              type="button"
              onClick={() => navigate(`/products?category=${encodeURIComponent(name)}`)}
              className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5"
            >
              {/* Icon + name */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl group-hover:bg-brand-100 transition">
                  {getCategoryIcon(name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{name}</p>
                  <p className="text-xs text-slate-500">{items.length} product{items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Stock summary */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{totalStock} units total</span>
                <div className="flex gap-1.5">
                  {outCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-600 font-medium">
                      {outCount} out
                    </span>
                  )}
                  {lowCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-600 font-medium">
                      {lowCount} low
                    </span>
                  )}
                  {outCount === 0 && lowCount === 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-600 font-medium">
                      In stock
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
}
