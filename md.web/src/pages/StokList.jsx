import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { createStockItem, getColors, getStockItems, getStockMovements, updateStockItem, deleteStockItem, createStockMovement, createColor, deleteColor } from '../services/dataService';

const defaultForm = {
  name: '',
  sku: '',
  unit: 'adet',
  supplier: '',
  category: 'Genel',
  warehouse: 'Ana Depo',
  barcode: '',
  color: '',
  onHand: 0,
  reserved: 0,
  critical: 0,
  reorderPoint: 0,
  minOrderQty: 1,
  leadTimeDays: 2,
  unitCost: 0,
  notes: '',
};

const defaultMovement = {
  itemId: '',
  qty: 1,
  type: 'stockIn',
  reason: '',
  operator: 'Otomatik',
  reference: '',
  location: 'Ana Depo',
};

const getStatus = (item) => {
  const available = Math.max(0, (item.onHand || 0) - (item.reserved || 0));
  const threshold = Math.max(item.critical || 0, item.reorderPoint || 0);
  if (available <= 0) return { label: 'Tükendi', tone: 'danger' };
  if (available <= threshold) return { label: 'Kritik', tone: 'danger' };
  if (available <= threshold + Math.max(5, threshold * 0.25)) return { label: 'Düşük', tone: 'warning' };
  return { label: 'Sağlıklı', tone: 'success' };
};

const normalizeItem = (item) => {
  const base = item || {};
  const available = Math.max(0, (base.onHand || 0) - (base.reserved || 0));
  return {
    ...base,
    category: base.category || 'Genel',
    warehouse: base.warehouse || 'Ana Depo',
    barcode: base.barcode || '',
    color: base.color || '',
    unitCost: Number.isFinite(base.unitCost) ? base.unitCost : 0,
    reorderPoint: Number.isFinite(base.reorderPoint) ? base.reorderPoint : base.critical || 0,
    minOrderQty: Number.isFinite(base.minOrderQty) ? base.minOrderQty : 1,
    leadTimeDays: Number.isFinite(base.leadTimeDays) ? base.leadTimeDays : 2,
    notes: base.notes || '',
    lastUpdated: base.lastUpdated || new Date().toISOString().slice(0, 10),
    safetyStock: Number.isFinite(base.safetyStock) ? base.safetyStock : Math.max(base.critical || 0, Math.ceil(available * 0.1)),
  };
};

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value);
const formatCurrency = (value) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value || 0);

const StokList = () => {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [colors, setColors] = useState([]);
  const [search, setSearch] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [colorSearch, setColorSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [movementForm, setMovementForm] = useState(defaultMovement);
  const [movementSearch, setMovementSearch] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [stockPayload, movementPayload, colorsPayload] = await Promise.all([
          getStockItems(),
          getStockMovements(),
          getColors().catch(() => []),
        ]);
        setItems(stockPayload.map(normalizeItem));
        setMovements(movementPayload);
        setColors(colorsPayload);
      } catch (err) {
        setError(err.message || 'Stok listesi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const suppliers = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.supplier).filter(Boolean)));
  }, [items]);

  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category).filter(Boolean))), [items]);
  const warehouses = useMemo(() => Array.from(new Set(items.map((item) => item.warehouse).filter(Boolean))), [items]);

  const filteredAndSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const skuQuery = skuSearch.trim().toLowerCase();
    const colorQuery = colorSearch.trim().toLowerCase();
    let data = [...items];

    if (query) {
      data = data.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.supplier.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.warehouse.toLowerCase().includes(query)
      );
    }

    if (skuQuery) {
      data = data.filter((item) => item.sku.toLowerCase().includes(skuQuery));
    }

    if (colorQuery) {
      data = data.filter((item) => (item.color || '').toLowerCase().includes(colorQuery));
    }

    if (supplierFilter !== 'all') {
      data = data.filter((item) => item.supplier === supplierFilter);
    }

    if (categoryFilter !== 'all') {
      data = data.filter((item) => item.category === categoryFilter);
    }

    if (warehouseFilter !== 'all') {
      data = data.filter((item) => item.warehouse === warehouseFilter);
    }

    if (statusFilter !== 'all') {
      data = data.filter((item) => getStatus(item).label === statusFilter);
    }

    if (showIssuesOnly) {
      data = data.filter((item) => getStatus(item).tone !== 'success');
    }

    data.sort((a, b) => {
      const aVal = sortKey === 'available' ? a.onHand - a.reserved : a[sortKey];
      const bVal = sortKey === 'available' ? b.onHand - b.reserved : b[sortKey];
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return data.map((item) => {
      const available = Math.max(0, item.onHand - item.reserved);
      const stockValue = (item.unitCost || 0) * (item.onHand || 0);
      const reorderGap = Math.max(0, (item.reorderPoint || item.critical || 0) - available);
      return { ...item, available, stockValue, reorderGap };
    });
  }, [
    items,
    search,
    skuSearch,
    colorSearch,
    supplierFilter,
    statusFilter,
    categoryFilter,
    warehouseFilter,
    sortKey,
    sortDir,
    showIssuesOnly,
  ]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      supplier: item.supplier,
      category: item.category,
      warehouse: item.warehouse,
      barcode: item.barcode || '',
      color: item.color || '',
      onHand: item.onHand,
      reserved: item.reserved,
      critical: item.critical,
      reorderPoint: item.reorderPoint,
      minOrderQty: item.minOrderQty,
      leadTimeDays: item.leadTimeDays,
      unitCost: item.unitCost,
      notes: item.notes || '',
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Kalem adı gerekli';
    if (!form.sku.trim()) errors.sku = 'SKU gerekli';
    if (!form.unit.trim()) errors.unit = 'Birim gerekli';
    if (!form.supplier.trim()) errors.supplier = 'Tedarikçi gerekli';
    if (!form.color.trim()) errors.color = 'Renk kodu gerekli';
    ['onHand', 'reserved', 'critical', 'reorderPoint', 'minOrderQty', 'leadTimeDays', 'unitCost'].forEach((key) => {
      const value = Number(form[key]);
      if (Number.isNaN(value) || value < 0) errors[key] = '0 veya üzeri olmalı';
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveForm = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name: form.name,
      sku: form.sku,
      unit: form.unit,
      supplier: form.supplier,
      category: form.category,
      warehouse: form.warehouse,
      barcode: form.barcode,
      color: form.color,
      onHand: Number(form.onHand),
      reserved: Number(form.reserved),
      critical: Number(form.critical),
      reorderPoint: Number(form.reorderPoint),
      minOrderQty: Number(form.minOrderQty),
      leadTimeDays: Number(form.leadTimeDays),
      unitCost: Number(form.unitCost),
      notes: form.notes || '',
    };

    try {
      setSubmitting(true);
      if (editing) {
        const updated = await updateStockItem(editing.id, payload);
        setItems((prev) => prev.map((item) => (item.id === editing.id ? normalizeItem(updated) : item)));
      } else {
        const created = await createStockItem(payload);
        setItems((prev) => [normalizeItem(created), ...prev]);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setError(err.message || 'Kayıt yapılamadı');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSubmitting(true);
      await deleteStockItem(deleteTarget.id);
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Silinemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const saveMovement = async (event) => {
    event.preventDefault();
    const { itemId, qty, type, reason, operator, reference, location } = movementForm;
    if (!itemId || !qty || Number.isNaN(Number(qty))) return;

    try {
      setSubmitting(true);
      const result = await createStockMovement({
        itemId,
        qty: Number(qty),
        type,
        reason: reason || null,
        operator: operator || null,
        reference: reference || null,
        location: location || null,
      });

      // Update local state with the returned item
      if (result.item) {
        setItems((prev) =>
          prev.map((item) => (item.id === result.item.id ? normalizeItem(result.item) : item))
        );
      }

      if (result.movement) {
        setMovements((prev) => [result.movement, ...prev]);
      }

      setMovementForm(defaultMovement);
      setMovementOpen(false);
    } catch (err) {
      setError(err.message || 'Hareket kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    const header = [
      'Kalem',
      'SKU',
      'Renk',
      'Tedarikçi',
      'Kategori',
      'Depo',
      'Mevcut',
      'Rezerve',
      'Uygun',
      'Kritik',
      'Reorder',
      'Birim',
      'Birim Maliyet',
      'Stok Değeri',
      'Durum',
    ];
    const rows = items.map((item) => {
      const status = getStatus(item).label;
      const available = Math.max(0, item.onHand - item.reserved);
      const stockValue = (item.unitCost || 0) * (item.onHand || 0);
      return [
        item.name,
        item.sku,
        item.color,
        item.supplier,
        item.category,
        item.warehouse,
        item.onHand,
        item.reserved,
        available,
        item.critical,
        item.reorderPoint,
        item.unit,
        item.unitCost,
        stockValue,
        status,
      ]
        .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stok-listesi.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    const totalItems = items.length;
    const totalOnHand = items.reduce((sum, item) => sum + (item.onHand || 0), 0);
    const totalAvailable = items.reduce((sum, item) => sum + Math.max(0, item.onHand - item.reserved), 0);
    const criticalCount = items.filter((item) => getStatus(item).tone !== 'success').length;
    const totalValue = items.reduce((sum, item) => sum + (item.unitCost || 0) * (item.onHand || 0), 0);
    return [
      { id: 'sum1', label: 'Kalem', value: formatNumber(totalItems), icon: '📦' },
      { id: 'sum2', label: 'Mevcut Stok', value: formatNumber(totalOnHand), icon: '📊' },
      { id: 'sum3', label: 'Açık Kapasite', value: formatNumber(totalAvailable), icon: '🔓' },
      { id: 'sum4', label: 'Dikkat Gereken', value: formatNumber(criticalCount), icon: '⚠️' },
      { id: 'sum5', label: 'Tahmini Değer', value: formatCurrency(totalValue), icon: '💰' },
    ];
  }, [items]);

  const issueItems = useMemo(
    () => filteredAndSorted.filter((item) => getStatus(item).tone !== 'success'),
    [filteredAndSorted]
  );

  const topReserved = useMemo(
    () => [...items].sort((a, b) => b.reserved - a.reserved).slice(0, 3),
    [items]
  );

  const openMovementFor = (item) => {
    setMovementForm({
      ...defaultMovement,
      itemId: item?.id || '',
      location: item?.warehouse || 'Ana Depo',
      operator: 'Otomatik',
      qty: 1,
      type: 'stockIn',
      reason: '',
      reference: '',
    });
    setMovementOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Stok Listesi"
        subtitle="Profesyonel stok takibi: ürün ekle/düzenle/sil, hareket ve uyarılar"
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setMovementOpen(true)}>
              🔄 Hareket Kaydet
            </button>
            <button className="btn btn-secondary" type="button" onClick={exportCsv}>
              ⬇️ CSV Dışa Aktar
            </button>
            <button className="btn btn-primary" type="button" onClick={openCreate}>
              ➕ Yeni Ürün
            </button>
          </>
        }
      />

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        {summary.map((stat) => (
          <div key={stat.id} className="card" style={{ padding: 16 }}>
            <div className="metric-row" style={{ alignItems: 'center' }}>
              <div className="metric-icon" aria-hidden="true">
                {stat.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div className="metric-label">{stat.label}</div>
                <div className="metric-value">{stat.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="search-stock">
            Kalem Ara
          </label>
          <input
            id="search-stock"
            className="filter-input"
            type="search"
            placeholder="Kalem adı, tedarikçi..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="sku-search">
            Ürün Kodu
          </label>
          <input
            id="sku-search"
            className="filter-input"
            type="search"
            placeholder="SKU ara..."
            value={skuSearch}
            onChange={(event) => setSkuSearch(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="color-search">
            Renk Kodu
          </label>
          <input
            id="color-search"
            className="filter-input"
            type="search"
            placeholder="Renk ara..."
            value={colorSearch}
            onChange={(event) => setColorSearch(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="supplier-filter">
            Tedarikçi
          </label>
          <select
            id="supplier-filter"
            className="filter-input"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="all">Tümü</option>
            {suppliers.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="status-filter">
            Durum
          </label>
          <select
            id="status-filter"
            className="filter-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tümü</option>
            <option value="Kritik">Kritik</option>
            <option value="Düşük">Düşük</option>
            <option value="Sağlıklı">Sağlıklı</option>
            <option value="Tükendi">Tükendi</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="category-filter">
            Kategori
          </label>
          <select
            id="category-filter"
            className="filter-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Tümü</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="warehouse-filter">
            Depo
          </label>
          <select
            id="warehouse-filter"
            className="filter-input"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
          >
            <option value="all">Tümü</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse} value={warehouse}>
                {warehouse}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="sorter">
            Sırala
          </label>
          <select
            id="sorter"
            className="filter-input"
            value={`${sortKey}-${sortDir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split('-');
              setSortKey(key);
              setSortDir(dir);
            }}
          >
            <option value="name-asc">Kalem (A→Z)</option>
            <option value="name-desc">Kalem (Z→A)</option>
            <option value="available-desc">Uygun (yüksek → düşük)</option>
            <option value="available-asc">Uygun (düşük → yüksek)</option>
            <option value="critical-desc">Kritik limit (yüksek → düşük)</option>
            <option value="critical-asc">Kritik limit (düşük → yüksek)</option>
          </select>
        </div>
        <div className="filter-group" style={{ alignSelf: 'flex-end' }}>
          <label className="filter-label" htmlFor="issues-only">
            Sadece sorunlu
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="issues-only"
              type="checkbox"
              checked={showIssuesOnly}
              onChange={(e) => setShowIssuesOnly(e.target.checked)}
            />
            <span className="text-muted">Kritik / düşük stok</span>
          </div>
        </div>
      </div>

      <div className="card subtle-card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <h3 className="card-title">Operasyonel görünürlük</h3>
          <span className="badge badge-warning">{issueItems.length} uyarı</span>
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div>
            <div className="metric-label" style={{ marginBottom: 8 }}>
              Yeniden sipariş / kritik listesi
            </div>
            {issueItems.length === 0 ? (
              <div className="text-muted">Tüm kalemler sağlıklı görünüyor.</div>
            ) : (
              issueItems.slice(0, 4).map((item) => {
                const status = getStatus(item);
                return (
                  <div key={item.id} className="metric-row" style={{ marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <strong>{item.name}</strong>
                      <div className="text-muted">
                        Uygun: {formatNumber(item.available)} · Limit: {formatNumber(item.reorderPoint || item.critical)} · Depo: {item.warehouse}
                      </div>
                    </div>
                    <span className={`badge badge-${status.tone}`}>{status.label}</span>
                  </div>
                );
              })
            )}
          </div>
          <div>
            <div className="metric-label" style={{ marginBottom: 8 }}>
              En çok rezerve edilen kalemler
            </div>
            {topReserved.length === 0 ? (
              <div className="text-muted">Henüz rezervasyon yok.</div>
            ) : (
              topReserved.map((item) => (
                <div key={item.id} className="metric-row" style={{ marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{item.name}</strong>
                    <div className="text-muted">
                      Rezerve: {formatNumber(item.reserved)} · Uygun: {formatNumber(Math.max(0, item.onHand - item.reserved))}
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-small" type="button" onClick={() => openMovementFor(item)}>
                    Hareket Ekle
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <Loader text="Stok listesi yükleniyor..." />
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Liste alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Stok Kalemleri</h3>
            <span className="badge badge-secondary">{filteredAndSorted.length} kayıt</span>
          </div>
          <DataTable
            columns={[
              {
                label: 'Kalem',
                accessor: 'name',
                render: (_, row) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{row.name}</div>
                    <div className="text-muted">{row.category} · Depo: {row.warehouse}</div>
                  </div>
                ),
              },
              {
                label: 'Kod',
                accessor: 'sku',
              },
              {
                label: 'Renk',
                accessor: 'color',
              },
              {
                label: 'Stok bilgisi',
                accessor: 'onHand',
                render: (_, row) => (
                  <div>
                    <strong>{formatNumber(row.onHand)} {row.unit}</strong>
                    <div className="text-muted">
                      Rezerve: {formatNumber(row.reserved)} · Uygun: {formatNumber(row.available)}
                    </div>
                  </div>
                ),
              },
              {
                label: 'Durum',
                accessor: 'status',
                render: (_, row) => {
                  const status = getStatus(row);
                  return <span className={`badge badge-${status.tone}`}>{status.label}</span>;
                },
              },
              {
                label: 'Aksiyon',
                accessor: 'actions',
                render: (_, row) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-icon" type="button" onClick={() => openEdit(row)} aria-label="Düzenle">
                      ✏️
                    </button>
                    <button
                      className="btn btn-secondary btn-icon"
                      type="button"
                      onClick={() => openMovementFor(row)}
                      aria-label="Hareket"
                    >
                      🔄
                    </button>
                    <button
                      className="btn btn-danger btn-icon"
                      type="button"
                      onClick={() => setDeleteTarget(row)}
                      aria-label="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filteredAndSorted}
          />
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <h3 className="card-title">Son Hareketler</h3>
          <button className="btn btn-secondary btn-icon" type="button" onClick={() => setMovementOpen(true)} aria-label="Hareket ekle">
            ➕
          </button>
        </div>
        <div className="timeline">
          {movements.slice(0, 6).map((movement) => (
            <div key={movement.id} className="timeline-item">
              <div className="timeline-point" />
              <div>
                <div className="timeline-title">
                  {movement.date} · {movement.item}
                </div>
                <div className="timeline-subtitle">
                  {movement.reason} — {movement.operator}
                  <span
                    className={`badge badge-${movement.change >= 0 ? 'success' : 'danger'}`}
                    style={{ marginLeft: 8 }}
                  >
                    {movement.change >= 0 ? '+' : ''}
                    {movement.change}
                  </span>
                </div>
                <div className="text-muted">
                  Lokasyon: {movement.location || 'Ana Depo'} · Ref: {movement.reference || '-'}
                </div>
              </div>
            </div>
          ))}
          {movements.length === 0 ? <div className="empty-state-description">Henüz kayıt yok.</div> : null}
        </div>
      </div>

      <Modal
        open={formOpen}
        title={editing ? 'Stok Kalemini Düzenle' : 'Yeni Stok Kalemi'}
        size="xlarge"
        onClose={() => setFormOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setFormOpen(false)}>
              İptal
            </button>
            <button className="btn btn-primary" type="submit" form="stock-form">
              Kaydet
            </button>
          </>
        }
      >
        <form id="stock-form" onSubmit={saveForm} className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              Kalem Adı
            </label>
            <input
              id="name"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            {formErrors.name ? <div className="error-text">{formErrors.name}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sku">
              SKU / Kod
            </label>
            <input
              id="sku"
              className="form-input"
              value={form.sku}
              onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
              required
            />
            {formErrors.sku ? <div className="error-text">{formErrors.sku}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="unit">
              Birim
            </label>
            <input
              id="unit"
              className="form-input"
              value={form.unit}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
              required
            />
            {formErrors.unit ? <div className="error-text">{formErrors.unit}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="supplier">
              Tedarikçi
            </label>
            <input
              id="supplier"
              className="form-input"
              value={form.supplier}
              onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))}
              required
            />
            {formErrors.supplier ? <div className="error-text">{formErrors.supplier}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="category">
              Kategori
            </label>
            <input
              id="category"
              className="form-input"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="warehouse">
              Depo / Lokasyon
            </label>
            <input
              id="warehouse"
              className="form-input"
              value={form.warehouse}
              onChange={(e) => setForm((prev) => ({ ...prev, warehouse: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="barcode">
              Barkod / Lot (opsiyonel)
            </label>
            <input
              id="barcode"
              className="form-input"
              value={form.barcode}
              onChange={(e) => setForm((prev) => ({ ...prev, barcode: e.target.value }))}
              placeholder="GTIN / lot kodu"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="color">
              Renk Kodu
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                id="color"
                className="form-select"
                value={colors.find((c) => c.code === form.color || c.name === form.color)?.code || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                style={{ flex: 1 }}
              >
                <option value="">Renk seçin veya yazın</option>
                {colors.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <input
                className="form-input"
                value={form.color}
                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                placeholder="veya manuel girin"
                style={{ flex: 1 }}
              />
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Listede yoksa <a href="/stok/renkler" style={{ color: 'var(--color-primary)' }}>Renkler</a> sayfasından ekleyebilirsiniz.
            </div>
            {formErrors.color ? <div className="error-text">{formErrors.color}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="onHand">
              Mevcut Stok
            </label>
            <input
              id="onHand"
              className="form-input"
              type="number"
              min="0"
              value={form.onHand}
              onChange={(e) => setForm((prev) => ({ ...prev, onHand: Number(e.target.value) }))}
              required
            />
            {formErrors.onHand ? <div className="error-text">{formErrors.onHand}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reserved">
              Rezerve
            </label>
            <input
              id="reserved"
              className="form-input"
              type="number"
              min="0"
              value={form.reserved}
              onChange={(e) => setForm((prev) => ({ ...prev, reserved: Number(e.target.value) }))}
              required
            />
            {formErrors.reserved ? <div className="error-text">{formErrors.reserved}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="critical">
              Kritik Limit
            </label>
            <input
              id="critical"
              className="form-input"
              type="number"
              min="0"
              value={form.critical}
              onChange={(e) => setForm((prev) => ({ ...prev, critical: Number(e.target.value) }))}
              required
            />
            {formErrors.critical ? <div className="error-text">{formErrors.critical}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reorderPoint">
              Yeniden Sipariş Limiti
            </label>
            <input
              id="reorderPoint"
              className="form-input"
              type="number"
              min="0"
              value={form.reorderPoint}
              onChange={(e) => setForm((prev) => ({ ...prev, reorderPoint: Number(e.target.value) }))}
              required
            />
            {formErrors.reorderPoint ? <div className="error-text">{formErrors.reorderPoint}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="minOrderQty">
              Minimum Sipariş Miktarı
            </label>
            <input
              id="minOrderQty"
              className="form-input"
              type="number"
              min="1"
              value={form.minOrderQty}
              onChange={(e) => setForm((prev) => ({ ...prev, minOrderQty: Number(e.target.value) }))}
              required
            />
            {formErrors.minOrderQty ? <div className="error-text">{formErrors.minOrderQty}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="leadTimeDays">
              Tedarik Süresi (gün)
            </label>
            <input
              id="leadTimeDays"
              className="form-input"
              type="number"
              min="0"
              value={form.leadTimeDays}
              onChange={(e) => setForm((prev) => ({ ...prev, leadTimeDays: Number(e.target.value) }))}
              required
            />
            {formErrors.leadTimeDays ? <div className="error-text">{formErrors.leadTimeDays}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="unitCost">
              Birim Maliyet (₺)
            </label>
            <input
              id="unitCost"
              className="form-input"
              type="number"
              min="0"
              value={form.unitCost}
              onChange={(e) => setForm((prev) => ({ ...prev, unitCost: Number(e.target.value) }))}
              required
            />
            {formErrors.unitCost ? <div className="error-text">{formErrors.unitCost}</div> : null}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="notes">
              Not / Tanım (opsiyonel)
            </label>
            <textarea
              id="notes"
              className="form-textarea"
              placeholder="Malzeme, lot veya lokasyon bilgisi ekleyin"
              value={form.notes || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={movementOpen}
        title="Stok Hareketi Kaydet"
        size="large"
        onClose={() => setMovementOpen(false)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setMovementOpen(false)}>
              İptal
            </button>
            <button className="btn btn-primary" type="submit" form="movement-form">
              Kaydet
            </button>
          </>
        }
      >
        <form id="movement-form" onSubmit={saveMovement} className="grid grid-2">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="movement-search">
              Stok Arama (kod / ad / renk)
            </label>
            <input
              id="movement-search"
              className="form-input"
              placeholder="Örn: MDF, LAM-KPK, Antrasit"
              value={movementSearch}
              onChange={(e) => setMovementSearch(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="movement-item">
              Kalem
            </label>
            <select
              id="movement-item"
              className="form-select"
              value={movementForm.itemId}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, itemId: e.target.value }))}
              required
            >
              <option value="">Seçin</option>
              {items
                .filter((item) => {
                  const q = movementSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    item.name.toLowerCase().includes(q) ||
                    item.sku.toLowerCase().includes(q) ||
                    (item.color || '').toLowerCase().includes(q)
                  );
                })
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku} · {item.color || '-'})
                  </option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="movement-type">
              Hareket Tipi
            </label>
            <select
              id="movement-type"
              className="form-select"
              value={movementForm.type}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, type: e.target.value }))}
              required
            >
              <option value="stockIn">Stok Girişi (+)</option>
              <option value="stockOut">Stok Çıkışı (-)</option>
              <option value="reserve">Rezervasyon (+)</option>
              <option value="release">Rezervasyon Çöz (-)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="movement-qty">
              Miktar
            </label>
            <input
              id="movement-qty"
              className="form-input"
              type="number"
              min="0"
              value={movementForm.qty}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, qty: Number(e.target.value) }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="movement-operator">
              Operatör
            </label>
            <input
              id="movement-operator"
              className="form-input"
              value={movementForm.operator}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, operator: e.target.value }))}
              placeholder="İşlemi yapan kişi"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="movement-reason">
              Açıklama / Neden
            </label>
            <input
              id="movement-reason"
              className="form-input"
              value={movementForm.reason}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Satınalma, fire, sevkiyat vb."
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="movement-ref">
              Referans (Opsiyonel)
            </label>
            <input
              id="movement-ref"
              className="form-input"
              value={movementForm.reference}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, reference: e.target.value }))}
              placeholder="PO / İş Kodu / Sipariş No"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="movement-location">
              Lokasyon
            </label>
            <input
              id="movement-location"
              className="form-input"
              value={movementForm.location}
              onChange={(e) => setMovementForm((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="Depo veya raf bilgisi"
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Silme Onayı"
        size="small"
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setDeleteTarget(null)}>
              Vazgeç
            </button>
            <button className="btn btn-danger" type="button" onClick={confirmDelete}>
              Kalemi Sil
            </button>
          </>
        }
      >
        <p>
          <strong>{deleteTarget?.name}</strong> kalemini silmek üzeresiniz. Bu işlem geri alınamaz. Devam etmek
          istediğinize emin misiniz?
        </p>
      </Modal>
    </div>
  );
};

export default StokList;

