import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { createCustomer, getCustomers, softDeleteCustomer, updateCustomer } from '../services/dataService';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    segment: 'B2B',
    location: '',
    contact: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getCustomers();
        setCustomers(payload);
      } catch (err) {
        setError(err.message || 'Müşteriler alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      if (editing) {
        const updated = await updateCustomer(editing.id, form);
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setEditing(null);
      } else {
        const newCustomer = await createCustomer(form);
        setCustomers((prev) => [newCustomer, ...prev]);
      }
      setForm({ name: '', segment: 'B2B', location: '', contact: '' });
      setShowModal(false);
    } catch (err) {
      setError(err.message || 'Müşteri kaydı başarısız');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      segment: customer.segment,
      location: customer.location,
      contact: customer.contact,
    });
    setShowModal(true);
  };

  const handleSoftDelete = async (customer) => {
    if (!window.confirm(`${customer.name} silinecek (soft delete). Emin misiniz?`)) return;
    try {
      await softDeleteCustomer(customer.id);
      setCustomers((prev) => prev.map((c) => (c.id === customer.id ? { ...c, deleted: true } : c)));
    } catch (err) {
      setError(err.message || 'Silme işlemi başarısız');
    }
  };

  const activeCustomers = useMemo(() => customers.filter((c) => !c.deleted), [customers]);

  return (
    <div>
      <PageHeader
        title="Müşteriler"
        subtitle="Aktif müşteri listesini ve toplam iş adetlerini görüntüleyin"
        actions={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({ name: '', segment: 'B2B', location: '', contact: '' });
              setShowModal(true);
            }}
          >
            + Yeni Müşteri
          </button>
        }
      />

      <Modal
        open={showModal}
        title={editing ? 'Müşteri Güncelle' : 'Yeni Müşteri Ekle'}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
          setForm({ name: '', segment: 'B2B', location: '', contact: '' });
        }}
        actions={
          <>
            {editing ? (
              <button
                className="btn btn-secondary btn-danger"
                type="button"
                onClick={() => setConfirmTarget(editing)}
                disabled={submitting}
              >
                Sil
              </button>
            ) : null}
            <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} disabled={submitting}>
              Vazgeç
            </button>
            <button className="btn btn-primary" type="submit" form="customer-form" disabled={submitting}>
              {submitting ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="customer-form" className="grid grid-2" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="c-name">
              Ad
            </label>
            <input
              id="c-name"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="c-segment">
              Segment
            </label>
            <select
              id="c-segment"
              className="form-select"
              value={form.segment}
              onChange={(e) => setForm((prev) => ({ ...prev, segment: e.target.value }))}
            >
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="c-location">
              Lokasyon
            </label>
            <input
              id="c-location"
              className="form-input"
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="c-contact">
              İletişim
            </label>
            <input
              id="c-contact"
              className="form-input"
              value={form.contact}
              onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
              required
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmTarget)}
        title="Silme onayı"
        onClose={() => setConfirmTarget(null)}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setConfirmTarget(null)}>
              Vazgeç
            </button>
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => {
                if (confirmTarget) {
                  handleSoftDelete(confirmTarget);
                  setConfirmTarget(null);
                  setShowModal(false);
                  setEditing(null);
                }
              }}
            >
              Sil
            </button>
          </>
        }
      >
        <p>
          <strong>{confirmTarget?.name}</strong> müşterisini silmek üzeresiniz. Bu işlem soft delete olarak
          işaretlenecek.
        </p>
      </Modal>

      {loading ? (
        <div className="card subtle-card">Müşteriler yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Liste yüklenemedi</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <div className="grid grid-3">
          {activeCustomers.map((customer) => (
            <div className="card" key={customer.id}>
              <div className="card-header">
                <h3 className="card-title">{customer.name}</h3>
                <span className="badge badge-secondary">{customer.segment}</span>
              </div>
              <div className="card-body">
                <div className="metric-list">
                  <div className="metric-row">
                    <span className="metric-label">Lokasyon</span>
                    <span className="metric-value">{customer.location}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">Toplam İş</span>
                    <span className="metric-value">{customer.jobs ?? 0}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">İletişim</span>
                    <span className="metric-value">{customer.contact}</span>
                  </div>
                </div>
                <div className="page-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary" type="button" onClick={() => handleEdit(customer)}>
                    Düzenle
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Customers;

