import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PhoneInput from '../components/PhoneInput';
import {
  completeAssembly,
  createCustomer,
  createJob,
  getCustomers,
  getJob,
  getJobs,
  scheduleAssembly,
  startJobApproval,
  updateJobMeasure,
  updateJobOffer,
  updateProductionStatus,
  updateStockStatus,
  closeFinance,
  getStockItems,
  applyLocalStockReservation,
  getJobRoles,
  getJobLogs,
  addJobLog,
  updateJobStatus,
  applyLocalJobPatch,
  createLocalPurchaseOrders,
  uploadDocument,
  getJobDocuments,
  deleteDocument,
  getDocumentDownloadUrl,
} from '../services/dataService';

const normalizeJob = (job) => ({
  ...job,
  roles: Array.isArray(job?.roles) ? job.roles : [],
  payments: job?.payments || {},
  offer: job?.offer || {},
  files: job?.files || {},
  measure: job?.measure || {},
  pendingPO: job?.pendingPO || [],
});

const toMessage = (err) => {
  if (!err) return 'Bilinmeyen hata';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.detail) return err.detail;
  try {
    return JSON.stringify(err);
  } catch (e) {
    return String(err);
  }
};

const formatNumber = (value) => new Intl.NumberFormat('tr-TR').format(value || 0);

// Tutar girişi için formatlama fonksiyonları
const formatCurrency = (value) => {
  if (!value && value !== 0) return '';
  // Sadece rakamları al
  const numericValue = String(value).replace(/[^\d]/g, '');
  if (!numericValue) return '';
  return new Intl.NumberFormat('tr-TR').format(Number(numericValue));
};

const parseCurrency = (formattedValue) => {
  if (!formattedValue) return '';
  // Noktaları kaldır, virgülü noktaya çevir (eğer küsürat varsa)
  const cleaned = String(formattedValue).replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? '' : num;
};

// Formatlı tutar input bileşeni
const CurrencyInput = ({ value, onChange, placeholder, className = 'form-input', style = {} }) => {
  const [displayValue, setDisplayValue] = useState('');
  
  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      setDisplayValue(formatCurrency(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);
  
  const handleChange = (e) => {
    const input = e.target.value;
    // Sadece rakam ve nokta/virgül kabul et
    const cleaned = input.replace(/[^\d.,]/g, '');
    
    // Formatlı göster
    const numericOnly = cleaned.replace(/[^\d]/g, '');
    const formatted = numericOnly ? new Intl.NumberFormat('tr-TR').format(Number(numericOnly)) : '';
    setDisplayValue(formatted);
    
    // Gerçek değeri parent'a gönder
    onChange(numericOnly ? Number(numericOnly) : '');
  };
  
  return (
    <input
      type="text"
      className={className}
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      style={{ textAlign: 'right', ...style }}
    />
  );
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const JobsList = () => {
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [form, setForm] = useState({
    customerId: '',
    customerName: '',
    startType: 'OLCU',
    title: '',
    // Yeni müşteri için genişletilmiş alanlar
    phone: '+90 ',
    phone2: '',
    address: '',
    newCustomer: false,
    segment: 'B2B',
    location: '',
    contact: '',
    roles: [],
    // Müşteri ölçüsü için dosyalar
    customerFiles: [],
    // Servis için
    serviceNote: '',
    serviceFixedFee: '',
  });
  const [jobRoles, setJobRoles] = useState([]);
  const [roleSearch, setRoleSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [jobsPayload, customersPayload] = await Promise.all([getJobs(), getCustomers()]);
        setJobs(jobsPayload.map(normalizeJob));
        setCustomers(customersPayload.filter((c) => !c.deleted));
        const rolesPayload = await getJobRoles();
        setJobRoles(rolesPayload);
      } catch (err) {
        setError(err.message || 'İş listesi alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return jobs
      .filter((job) => {
        if (statusFilter === 'all') return true;
        // Tam eşleşme kontrolü (büyük/küçük harf duyarsız)
        return (job.status || '').toUpperCase() === statusFilter.toUpperCase();
      })
      .filter((job) => {
        if (!normalizedSearch) return true;
        return (
          (job.title || '').toLowerCase().includes(normalizedSearch) ||
          (job.customerName || '').toLowerCase().includes(normalizedSearch) ||
          (job.id || '').toLowerCase().includes(normalizedSearch)
        );
      });
  }, [jobs, search, statusFilter]);

  const columns = [
    { label: 'İş Kodu', accessor: 'id' },
    { label: 'Başlık', accessor: 'title' },
    { label: 'Müşteri', accessor: 'customerName' },
    {
      label: 'İş Kolları',
      accessor: 'roles',
      render: (_v, row) =>
        !row.roles || row.roles.length === 0 ? (
          <span className="text-muted">Belirtilmemiş</span>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.roles.map((r) => (
              <span key={r.id || r.name} className="badge badge-secondary">
                {r.name}
              </span>
            ))}
          </div>
        ),
    },
    {
      label: 'Durum',
      accessor: 'status',
      render: (_value, row) => renderStatus(row.status),
    },
    { label: 'Başlatma', accessor: 'startType' },
  ];

  const openDetail = async (job) => {
    setDetailModal(true);
    setDetailLoading(true);
    setDetailError('');
    setSelectedJob(normalizeJob(job));
    try {
      const payload = await getJob(job.id);
      setSelectedJob(normalizeJob(payload));
    } catch (err) {
      setDetailError(err.message || 'İş detayı alınamadı');
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleRole = (role) => {
    setForm((prev) => {
      const exists = prev.roles.find((r) => r.id === role.id);
      if (exists) {
        return { ...prev, roles: prev.roles.filter((r) => r.id !== role.id) };
      }
      return { ...prev, roles: [...prev.roles, role] };
    });
  };

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return jobRoles;
    return jobRoles.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q)
    );
  }, [jobRoles, roleSearch]);

  // Müşteri arama (isim veya telefon ile)
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    // En az 2 karakter girilmeli
    if (q.length < 2) return [];
    
    return customers.filter((c) => {
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const phoneMatch = (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''));
      const phone2Match = (c.phone2 || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''));
      return nameMatch || phoneMatch || phone2Match;
    }).slice(0, 10); // Max 10 sonuç
  }, [customers, customerSearch]);

  return (
    <div>
      <PageHeader
        title="İş Listesi"
        subtitle="Aktif tüm işlerinizi tek ekranda takip edin"
        actions={
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setForm({
                customerId: '',
                customerName: '',
                startType: 'OLCU',
                title: '',
                newCustomer: false,
                segment: 'B2B',
                location: '',
                contact: '',
                roles: [],
              });
              setShowModal(true);
            }}
          >
            + Yeni İş Başlat
          </button>
        }
      />

      <div className="filter-bar">
        <div className="filter-group">
          <label className="filter-label" htmlFor="search">
            Arama
          </label>
          <input
            id="search"
            className="filter-input"
            type="search"
            placeholder="İş adı, müşteri veya iş kodu"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="status">
            Durum
          </label>
          <select
            id="status"
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Tümü</option>
            <optgroup label="Ölçü/Keşif">
              <option value="OLCU_RANDEVU_BEKLIYOR">Randevu Bekliyor</option>
              <option value="OLCU_RANDEVULU">Randevu Verildi</option>
              <option value="OLCU_ALINDI">Ölçü Alındı</option>
              <option value="MUSTERI_OLCUSU_BEKLENIYOR">Müşteri Ölçüsü Bekleniyor</option>
            </optgroup>
            <optgroup label="Fiyatlandırma">
              <option value="FIYATLANDIRMA">Fiyat Verilecek</option>
              <option value="FIYAT_VERILDI">Fiyat Verildi - Onay Bekliyor</option>
              <option value="ANLASILAMADI">Anlaşılamadı</option>
            </optgroup>
            <optgroup label="Anlaşma/Stok">
              <option value="ANLASMA_YAPILIYOR">Anlaşma Yapılıyor</option>
              <option value="STOK_BEKLIYOR">Stok Bekliyor</option>
            </optgroup>
            <optgroup label="Üretim">
              <option value="URETIME_HAZIR">Üretime Hazır</option>
              <option value="URETIMDE">Üretimde</option>
              <option value="ANLASMADA">Anlaşmada</option>
            </optgroup>
            <optgroup label="Montaj">
              <option value="MONTAJA_HAZIR">Montaja Hazır</option>
              <option value="MONTAJ_TERMIN">Montaj Terminli</option>
            </optgroup>
            <optgroup label="Finans">
              <option value="MUHASEBE_BEKLIYOR">Muhasebe Bekliyor</option>
              <option value="KAPALI">Kapalı</option>
            </optgroup>
            <optgroup label="Servis">
              <option value="SERVIS_RANDEVU_BEKLIYOR">Servis Randevusu Bekliyor</option>
              <option value="SERVIS_RANDEVULU">Servis Randevulu</option>
              <option value="SERVIS_YAPILIYOR">Servis Yapılıyor</option>
              <option value="SERVIS_DEVAM_EDIYOR">Servis Devam Ediyor</option>
              <option value="SERVIS_ODEME_BEKLIYOR">Servis Ödeme Bekliyor</option>
              <option value="SERVIS_KAPALI">Servis Tamamlandı</option>
            </optgroup>
          </select>
        </div>
      </div>

      {loading ? (
        <Loader text="İşler yükleniyor..." />
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Liste yüklenemedi</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredJobs}
          getKey={(row) => row.id}
          onRowClick={openDetail}
          />
      )}

      <Modal
        open={showModal}
        title="🆕 Yeni İş Başlat"
        size="large"
        onClose={() => {
          setShowModal(false);
          setCustomerSearch('');
        }}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)} disabled={submitting}>
              Vazgeç
            </button>
            <button className="btn btn-primary" type="submit" form="job-modal-form" disabled={submitting}>
              {submitting ? 'Kaydediliyor...' : 'İşi Başlat'}
            </button>
          </>
        }
      >
        <form
          id="job-modal-form"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              setSubmitting(true);
              setError('');

              let customerId = form.customerId;
              let customerName = form.customerName;

              if (form.newCustomer) {
                const created = await createCustomer({
                  name: form.customerName,
                  segment: form.segment,
                  phone: form.phone,
                  phone2: form.phone2,
                  address: form.address,
                  location: form.location,
                  contact: form.contact,
                });
                customerId = created.id;
                customerName = created.name;
                setCustomers((prev) => [created, ...prev]);
              }

              const job = await createJob({
                customerId,
                customerName,
                title: form.title,
                startType: form.startType,
                roles: form.roles,
              });
              setJobs((prev) => [normalizeJob(job), ...prev]);
              setForm((prev) => ({ ...prev, roles: [] }));
              setCustomerSearch('');
              setShowModal(false);
            } catch (err) {
              setError(err.message || 'İş oluşturulamadı');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {/* BÖLÜM 1: MÜŞTERİ */}
          <div className="card subtle-card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <h4 className="card-title" style={{ fontSize: 14 }}>👤 Müşteri</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-small ${!form.newCustomer ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm((prev) => ({ ...prev, newCustomer: false }))}
                >
                  Mevcut
                </button>
                <button
                  type="button"
                  className={`btn btn-small ${form.newCustomer ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForm((prev) => ({ ...prev, newCustomer: true, customerId: '', customerName: '' }))}
                >
                  + Yeni
                </button>
              </div>
            </div>
            <div className="card-body" style={{ padding: 16 }}>
              {!form.newCustomer ? (
                // MEVCUT MÜŞTERİ ARAMA
                <div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">🔍 Müşteri Ara (İsim veya Telefon)</label>
                    <input
                      className="form-input"
                      placeholder="Örn: Ahmet veya 532 123..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  
                  {/* Seçili Müşteri */}
                  {form.customerId && (
                    <div style={{ 
                      padding: 12, 
                      background: 'var(--color-success-bg)', 
                      borderRadius: 8, 
                      border: '1px solid var(--color-success)',
                      marginBottom: 12
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>✓ {form.customerName}</div>
                          {(() => {
                            const c = customers.find(c => c.id === form.customerId);
                            return c?.phone ? <div style={{ fontSize: 12 }}>📞 {c.phone}</div> : null;
                          })()}
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => setForm((prev) => ({ ...prev, customerId: '', customerName: '' }))}
                        >
                          Değiştir
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Arama Sonuçları */}
                  {!form.customerId && customerSearch.length >= 2 && (
                    <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                      {filteredCustomers.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center' }} className="text-muted">
                          "{customerSearch}" ile eşleşen müşteri bulunamadı
                        </div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <div
                            key={c.id}
                            style={{ 
                              padding: '10px 16px', 
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--color-border)',
                              transition: 'background 0.2s'
                            }}
                            className="hover-row"
                            onClick={() => {
                              setForm((prev) => ({ ...prev, customerId: c.id, customerName: c.name }));
                              setCustomerSearch('');
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                              {c.phone && `📞 ${c.phone}`}
                              {c.phone && c.address && ' • '}
                              {c.address && `📍 ${c.address.substring(0, 30)}...`}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {!form.customerId && customerSearch.length < 2 && (
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      💡 En az 2 karakter girerek müşteri arayın
                    </div>
                  )}
                </div>
              ) : (
                // YENİ MÜŞTERİ FORMU
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Ad Soyad *</label>
                    <input
                      className="form-input"
                      value={form.customerName}
                      onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Örn: Ahmet Yılmaz"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <PhoneInput
                      label="📞 Telefon 1 *"
                      value={form.phone}
                      onChange={(val) => setForm((prev) => ({ ...prev, phone: val }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <PhoneInput
                      label="📞 Telefon 2 (isteğe bağlı)"
                      value={form.phone2}
                      onChange={(val) => setForm((prev) => ({ ...prev, phone2: val }))}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">📍 Adres</label>
                    <textarea
                      className="form-textarea"
                      value={form.address}
                      onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Tam adres..."
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Segment</label>
                    <select
                      className="form-select"
                      value={form.segment}
                      onChange={(e) => setForm((prev) => ({ ...prev, segment: e.target.value }))}
                    >
                      <option value="B2C">Bireysel (B2C)</option>
                      <option value="B2B">Kurumsal (B2B)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">İlçe / Semt</label>
                    <input
                      className="form-input"
                      value={form.location}
                      onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="Örn: Kadıköy"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BÖLÜM 2: İŞ BİLGİLERİ */}
          <div className="card subtle-card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <h4 className="card-title" style={{ fontSize: 14 }}>📋 İş Bilgileri</h4>
            </div>
            <div className="card-body" style={{ padding: 16 }}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">İş Başlığı *</label>
                  <input
                    className="form-input"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Örn: Balkon PVC Doğrama"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Başlatma Türü</label>
                  <select
                    className="form-select"
                    value={form.startType}
                    onChange={(e) => setForm((prev) => ({ ...prev, startType: e.target.value }))}
                  >
                    <option value="OLCU">📐 Ölçü Randevusu</option>
                    <option value="MUSTERI_OLCUSU">📄 Müşteri Ölçüsü</option>
                    <option value="SERVIS">🔧 Servis/Bakım</option>
                  </select>
                </div>
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                {form.startType === 'OLCU' && '💡 Ölçü randevusu verilecek, sonra fiyatlandırılacak.'}
                {form.startType === 'MUSTERI_OLCUSU' && '💡 Müşteri ölçüsü ile direkt fiyatlandırmaya geçilecek.'}
                {form.startType === 'SERVIS' && '💡 Servis randevusu ve sabit ücret belirlenecek.'}
              </div>
            </div>
          </div>

          {/* BÖLÜM 3: İŞ KOLLARI */}
          <div className="card subtle-card">
            <div className="card-header" style={{ padding: '12px 16px' }}>
              <h4 className="card-title" style={{ fontSize: 14 }}>🏭 İş Kolları</h4>
              <span className="badge badge-secondary">{form.roles.length} seçili</span>
            </div>
            <div className="card-body" style={{ padding: 16 }}>
              {/* Seçili İş Kolları */}
              {form.roles.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {form.roles.map((role) => (
                    <span 
                      key={role.id} 
                      className="badge badge-primary" 
                      style={{ 
                        padding: '6px 12px', 
                        display: 'inline-flex', 
                        gap: 8, 
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleRole(role)}
                    >
                      {role.name}
                      <span style={{ opacity: 0.7 }}>✕</span>
                    </span>
                  ))}
                </div>
              )}
              
              {/* İş Kolu Seçici - Grid Layout */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                gap: 8 
              }}>
                {jobRoles.map((role) => {
                  const isSelected = form.roles.some((r) => r.id === role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      style={{
                        padding: '10px 12px',
                        border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        borderRadius: 8,
                        background: isSelected ? 'var(--color-primary-bg)' : 'var(--color-bg-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => toggleRole(role)}
                    >
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: 13,
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text)'
                      }}>
                        {isSelected && '✓ '}{role.name}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {form.roles.length === 0 && (
                <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                  ⚠️ En az bir iş kolu seçin
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={detailModal}
        title={`İş Detayı ${selectedJob ? `- ${selectedJob.id}` : ''}`}
        size="xxlarge"
        onClose={() => {
          setDetailModal(false);
          setSelectedJob(null);
          setDetailError('');
        }}
      >
        {detailLoading ? (
          <div>Yükleniyor...</div>
        ) : detailError ? (
          <div className="error-card">
            <div className="error-title">Hata</div>
            <div className="error-message">{detailError}</div>
          </div>
        ) : selectedJob ? (
          <JobStepper
            job={selectedJob}
            customers={customers}
            onUpdated={async (updated) => {
              setSelectedJob(updated);
              setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
};

const STATUS_LABELS = {
  // Ölçü aşaması statüleri
  'OLCU_RANDEVU_BEKLIYOR': { label: 'Randevu Bekliyor', tone: 'warning', icon: '📅' },
  'OLCU_RANDEVULU': { label: 'Randevu Verildi', tone: 'info', icon: '📅' },
  'OLCU_ALINDI': { label: 'Ölçü Alındı', tone: 'success', icon: '📐' },
  'MUSTERI_OLCUSU_BEKLENIYOR': { label: 'Müşteri Ölçüsü Bekleniyor', tone: 'warning', icon: '📄' },
  'MUSTERI_OLCUSU_YUKLENDI': { label: 'Müşteri Ölçüsü Yüklendi', tone: 'success', icon: '✓' },
  // Fiyatlandırma statüleri
  'FIYATLANDIRMA': { label: 'Fiyat Verilecek', tone: 'secondary', icon: '💰' },
  'FIYAT_VERILDI': { label: 'Fiyat Verildi - Onay Bekliyor', tone: 'warning', icon: '⏳' },
  'ANLASILAMADI': { label: 'Anlaşılamadı', tone: 'danger', icon: '❌' },
  // Anlaşma (eski: Teklif) statüleri
  'ANLASMA_YAPILIYOR': { label: 'Anlaşma Yapılıyor', tone: 'primary', icon: '📝' },
  'ANLASMA_TAMAMLANDI': { label: 'Anlaşma Tamamlandı', tone: 'success', icon: '✅' },
  // Eski statüler (geriye uyumluluk)
  'OLCU_ASAMASI': { label: 'Ölçü Aşaması', tone: 'primary', icon: '📐' },
  'TEKLIF_TASLAK': { label: 'Teklif Taslak', tone: 'secondary', icon: '📝' },
  'TEKLIF_HAZIR': { label: 'Teklif Hazır', tone: 'primary', icon: '✉️' },
  'ONAY_BEKLIYOR': { label: 'Onay Bekliyor', tone: 'warning', icon: '⏳' },
  // Stok ve üretim
  'STOK_BEKLIYOR': { label: 'Stok Bekliyor', tone: 'warning', icon: '📦' },
  'URETIME_HAZIR': { label: 'Üretime Hazır', tone: 'success', icon: '✅' },
  'URETIMDE': { label: 'Üretimde', tone: 'primary', icon: '🔧' },
  'ANLASMADA': { label: 'Anlaşmada', tone: 'info', icon: '📆' },
  'MONTAJA_HAZIR': { label: 'Montaja Hazır', tone: 'success', icon: '✅' },
  'MONTAJ_TERMIN': { label: 'Montaj Terminli', tone: 'primary', icon: '🚚' },
  'MUHASEBE_BEKLIYOR': { label: 'Muhasebe Bekliyor', tone: 'secondary', icon: '💳' },
  'KAPALI': { label: 'Kapalı', tone: 'success', icon: '✓' },
  // Servis statüleri
  'SERVIS_RANDEVU_BEKLIYOR': { label: 'Servis Randevusu Bekliyor', tone: 'warning', icon: '🔧' },
  'SERVIS_RANDEVULU': { label: 'Servis Randevulu', tone: 'primary', icon: '📅' },
  'SERVIS_YAPILIYOR': { label: 'Servis Yapılıyor', tone: 'info', icon: '🛠️' },
  'SERVIS_DEVAM_EDIYOR': { label: 'Servis Devam Ediyor', tone: 'warning', icon: '🔄' },
  'SERVIS_ODEME_BEKLIYOR': { label: 'Servis Ödeme Bekliyor', tone: 'warning', icon: '💰' },
  'SERVIS_KAPALI': { label: 'Servis Tamamlandı', tone: 'success', icon: '✓' },
};

const renderStatus = (status) => {
  const statusInfo = STATUS_LABELS[status];
  if (statusInfo) {
    return (
      <span className={`badge badge-${statusInfo.tone}`}>
        {statusInfo.icon} {statusInfo.label}
      </span>
    );
  }
  
  // Fallback for unknown statuses
  const label = status || 'Bilinmiyor';
  const normalized = label.toLowerCase();

  let tone = 'secondary';
  if (normalized.includes('ölçü') || normalized.includes('olcu')) tone = 'primary';
  if (normalized.includes('fiyat')) tone = 'secondary';
  if (normalized.includes('teklif')) tone = 'secondary';
  if (normalized.includes('onay')) tone = 'warning';
  if (normalized.includes('stok')) tone = 'warning';
  if (normalized.includes('hazır') || normalized.includes('hazir')) tone = 'success';
  if (normalized.includes('anlaşma') || normalized.includes('anlasma')) tone = 'info';
  if (normalized.includes('üretim')) tone = 'warning';
  if (normalized.includes('montaj')) tone = 'primary';
  if (normalized.includes('muhasebe')) tone = 'secondary';
  if (normalized.includes('kapalı') || normalized.includes('kapali')) tone = 'success';
  if (normalized.includes('servis')) tone = 'info';

  return <span className={`badge badge-${tone}`}>{label}</span>;
};

const STAGE_FLOW = [
  { id: 'measure', label: 'Ölçü/Keşif', statuses: ['OLCU_RANDEVU_BEKLIYOR', 'OLCU_RANDEVULU', 'OLCU_ALINDI', 'MUSTERI_OLCUSU_BEKLENIYOR', 'MUSTERI_OLCUSU_YUKLENDI'] },
  { id: 'pricing', label: 'Fiyatlandırma', statuses: ['FIYATLANDIRMA', 'FIYAT_VERILDI'] },
  { id: 'agreement', label: 'Anlaşma', statuses: ['ANLASMA_YAPILIYOR', 'ANLASMA_TAMAMLANDI'] },
  { id: 'stock', label: 'Stok/Rezervasyon', statuses: ['STOK_BEKLIYOR'] },
  { id: 'production', label: 'Üretim', statuses: ['URETIME_HAZIR', 'URETIMDE', 'ANLASMADA'] },
  { id: 'assembly', label: 'Montaj', statuses: ['MONTAJA_HAZIR', 'MONTAJ_TERMIN'] },
  { id: 'finance', label: 'Finans Kapanış', statuses: ['MUHASEBE_BEKLIYOR', 'KAPALI'] },
];

// Servis işleri için ayrı akış
const SERVICE_STAGE_FLOW = [
  { id: 'service_schedule', label: 'Randevu', statuses: ['SERVIS_RANDEVU_BEKLIYOR'] },
  { id: 'service_start', label: 'Başlat', statuses: ['SERVIS_RANDEVULU'] },
  { id: 'service_work', label: 'Servis', statuses: ['SERVIS_YAPILIYOR', 'SERVIS_DEVAM_EDIYOR'] },
  { id: 'service_payment', label: 'Ödeme', statuses: ['SERVIS_ODEME_BEKLIYOR'] },
  { id: 'service_done', label: 'Tamamlandı', statuses: ['SERVIS_KAPALI'] },
];

const findStageByStatus = (status) =>
  STAGE_FLOW.find((stage) => stage.statuses.includes(status)) || STAGE_FLOW[0];

const getNextStage = (currentStageId) => {
  const idx = STAGE_FLOW.findIndex((s) => s.id === currentStageId);
  if (idx < 0 || idx >= STAGE_FLOW.length - 1) return null;
  return STAGE_FLOW[idx + 1];
};

const JobStepper = ({ job, customers = [], onUpdated }) => {
  // Müşteri detaylarını bul
  const customer = customers.find(c => c.id === job.customerId) || {};
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');
  const [stockItems, setStockItems] = useState([]);
  const [stockQuery, setStockQuery] = useState('');
  const [stockSkuQuery, setStockSkuQuery] = useState('');
  const [stockColorQuery, setStockColorQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  const [reserveQty, setReserveQty] = useState(1);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [reservedLines, setReservedLines] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [pendingPO, setPendingPO] = useState(job.pendingPO || []);
  const [inputs, setInputs] = useState({
    measureNote: '',
    appointment: '',
    measureCall: false,
    measureConfirmed: false,
    measureDraftFile: '',
    techDrawingFile: '',
    orderNo: '',
    cariCode: '',
    offerExpanded: true,
    offerTotal: '',
    pricingNotifiedDate: '', // Fiyat bildirim tarihi
    rejectionReason: '', // Ret açıklaması
    rejectionCategory: '', // Ret kategorisi
    rejectionFollowUp: '', // Takip tarihi
    showRejectionModal: false, // Ret modal göster
    // Pazarlık/İskonto
    roleDiscounts: {}, // İş kolu bazlı iskonto
    showNegotiationPanel: false, // Pazarlık paneli
    payCash: '',
    payCard: '',
    payCheque: '',
    payAfter: '',
    chequeLines: [],
    stockReady: true,
    stockNote: '',
    productionStatus: 'URETIMDE',
    agreementDate: '',
    assemblyDate: '',
    assemblyNote: '',
    assemblyTeam: '',
    proofNote: '',
    financeTotal: '',
    financeCash: '',
    financeCard: '',
    financeCheque: '',
    discountAmount: '',
    discountNote: '',
    // İş kolu bazlı fiyatlar
    rolePrices: {},
    // Servis alanları
    serviceAppointmentDate: '',
    serviceAppointmentTime: '10:00',
    serviceFixedFee: '',
    serviceNote: '',
    serviceVisitDate: '',
    serviceVisitTime: '',
    serviceWorkNote: '',
    serviceMaterials: '',
    serviceExtraCost: '',
    // Ödeme alanları
    servicePaymentCash: '',
    servicePaymentCard: '',
    servicePaymentTransfer: '',
    serviceDiscount: '',
    serviceDiscountNote: '',
    // Devam için yeni randevu
    serviceNewAppointmentDate: '',
    serviceNewAppointmentTime: '10:00',
    serviceNewAppointmentNote: '',
  });

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [jobDocuments, setJobDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  
  // Validasyon state'i
  const [validationErrors, setValidationErrors] = useState([]);
  
  // Aşama geçişi için validasyon fonksiyonu
  const validateStageTransition = (targetStage) => {
    const errors = [];
    
    if (targetStage === 'FIYATLANDIRMA') {
      // Müşteri ölçüsü ile başlatıldıysa dosya kontrolü
      if (job.startType === 'MUSTERI_OLCUSU') {
        if (job.roles?.length > 0) {
          job.roles.forEach((role) => {
            const roleKey = role.id || role.name;
            const roleFiles = job.roleFiles?.[roleKey] || {};
            if (!roleFiles.measure?.length) {
              errors.push(`${role.name} için ölçü çizimi yüklenmedi`);
            }
            if (!roleFiles.technical?.length) {
              errors.push(`${role.name} için teknik çizim yüklenmedi`);
            }
          });
        }
      }
      
      // Normal ölçü ile başlatıldıysa randevu kontrolü
      if (job.startType === 'OLCU' && !inputs.measureConfirmed) {
        errors.push('Ölçü randevusu onaylanmadı');
      }
    }
    
    if (targetStage === 'TEKLIF_HAZIR') {
      const rolePricesTotal = Object.values(inputs.rolePrices).reduce((sum, val) => sum + (Number(val) || 0), 0);
      const total = rolePricesTotal || Number(inputs.offerTotal || 0);
      if (!total || total <= 0) {
        errors.push('Teklif tutarı girilmedi');
      }
    }
    
    if (targetStage === 'ONAY_BEKLIYOR') {
      const planTotal = Number(inputs.payCash || 0) + Number(inputs.payCard || 0) + chequeTotal + Number(inputs.payAfter || 0);
      const offerTotal = Number(job.offer?.total || 0);
      if (Math.abs(planTotal - offerTotal) > 0.01) {
        errors.push(`Ödeme planı (${formatNumber(planTotal)} ₺) teklif tutarıyla (${formatNumber(offerTotal)} ₺) eşleşmiyor`);
      }
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Initialize inputs from job data
  useEffect(() => {
    const measure = job.measure || {};
    const offer = job.offer || {};
    const payments = job.payments || {};
    const assembly = job.assembly?.schedule || {};
    const finance = job.finance || {};

    setInputs((prev) => ({
      ...prev,
      // Measure
      measureNote: measure.note || '',
      appointment: measure.appointment || '',
      measureCall: measure.call || false,
      measureConfirmed: measure.confirm || false,
      // Pricing / Offer
      orderNo: offer.orderNo || '',
      cariCode: offer.cariCode || job.customerAccountCode || '',
      offerTotal: offer.total || '',
      // Payments
      payCash: payments.cash || '',
      payCard: payments.card || '',
      payCheque: payments.cheque || '',
      payAfter: payments.after || '',
      chequeLines: payments.chequeLines || [],
      // Production
      productionStatus: job.status === 'ANLASMADA' ? 'ANLASMADA' : (job.status === 'MONTAJA_HAZIR' ? 'MONTAJA_HAZIR' : 'URETIMDE'),
      agreementDate: job.agreementDate || '',
      // Assembly
      assemblyDate: assembly.date || '',
      assemblyNote: assembly.note || '',
      assemblyTeam: assembly.team || '',
      // Finance
      financeTotal: finance.total || offer.total || '',
      financeCash: finance.cash || payments.cash || '',
      // İş kolu bazlı fiyatlar
      rolePrices: job.rolePrices || {},
      // Servis alanları
      serviceAppointmentDate: job.service?.appointmentDate || '',
      serviceAppointmentTime: job.service?.appointmentTime || '10:00',
      serviceFixedFee: job.service?.fixedFee || '',
      serviceNote: job.service?.note || '',
      serviceWorkNote: job.service?.workNote || '',
      serviceMaterials: job.service?.materials || '',
      serviceExtraCost: job.service?.extraCost || '',
      serviceExtraNote: job.service?.extraNote || '',
      serviceCloseNote: job.service?.closeNote || '',
      financeCard: finance.card || payments.card || '',
      financeCheque: finance.cheque || payments.cheque || '',
      discountAmount: finance.discount || '',
      discountNote: finance.discountNote || '',
    }));
  }, [job]);

  // Servis işi mi kontrol et
  const isServiceJob = job.startType === 'SERVIS';
  
  // Akış seçimi - servis veya normal
  const activeFlow = isServiceJob ? SERVICE_STAGE_FLOW : STAGE_FLOW;
  
  const findStageByStatusForFlow = (status, flow) => {
    return flow.find((stage) => stage.statuses.includes(status)) || flow[0];
  };
  
  const currentStage = findStageByStatusForFlow(job.status || 'OLCU_RANDEVU_BEKLIYOR', activeFlow);
  const [selectedStage, setSelectedStage] = useState(currentStage.id);

  // Job değiştiğinde selectedStage'i güncelle
  useEffect(() => {
    const newStage = findStageByStatusForFlow(job.status || 'OLCU_RANDEVU_BEKLIYOR', activeFlow);
    setSelectedStage(newStage.id);
  }, [job.id, job.status, activeFlow]);

  const isStageSelected = (id) => selectedStage === id;
  const markStage = (id) => setSelectedStage(id);

  const stageState = (id) => {
    const currentIndex = activeFlow.findIndex((s) => s.id === currentStage.id);
    const index = activeFlow.findIndex((s) => s.id === id);
    if (index < currentIndex) return 'done';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  const pushLog = async (action, detail, meta = {}) => {
    try {
      await addJobLog({ jobId: job.id, action, detail, meta });
      const fresh = await getJobLogs(job.id);
      setLogs(fresh);
    } catch (_) {
      // log errors are non-blocking
    }
  };

  // Load job documents
  const loadJobDocuments = async () => {
    try {
      setDocsLoading(true);
      const docs = await getJobDocuments(job.id);
      setJobDocuments(docs);
    } catch (_) {
      // Non-blocking
    } finally {
      setDocsLoading(false);
    }
  };

  // Auto-advance to next stage after successful action
  const advanceToNextStage = (updatedJob) => {
    const flow = updatedJob.startType === 'SERVIS' ? SERVICE_STAGE_FLOW : STAGE_FLOW;
    const newStage = findStageByStatusForFlow(updatedJob.status, flow);
    if (newStage.id !== currentStage.id) {
      setSelectedStage(newStage.id);
    }
  };

  // Check if should auto-advance
  const shouldAutoAdvance = (updatedJob, logMeta) => {
    if (logMeta?.skipAdvance) return false;
    // Always auto-advance to the next stage based on new status
    return true;
  };

  const act = async (fn, logMeta, options = {}) => {
    try {
      setActionLoading(true);
      setActionError('');
      const updated = await fn();
      const normalizedUpdated = normalizeJob(updated);
      onUpdated(normalizedUpdated);
      await pushLog('update', `Aşama: ${currentStage.label}`, { stage: currentStage.id, ...(logMeta || {}) });
      
      // Auto-advance to next stage if allowed
      if (shouldAutoAdvance(normalizedUpdated, logMeta)) {
        advanceToNextStage(normalizedUpdated);
      }
    } catch (err) {
      setActionError(toMessage(err) || 'İşlem başarısız');
    } finally {
      setActionLoading(false);
    }
  };

  // Document upload handler
  const handleDocUpload = async (file, docType, description = '') => {
    if (!file) return;
    try {
      setUploadingDoc(true);
      const doc = await uploadDocument(file, job.id, docType, description);
      setJobDocuments((prev) => [doc, ...prev]);
      return doc;
    } catch (err) {
      setActionError(err.message || 'Dosya yüklenemedi');
      return null;
    } finally {
      setUploadingDoc(false);
    }
  };

  // Document delete handler
  const handleDocDelete = async (docId) => {
    try {
      await deleteDocument(docId);
      setJobDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setActionError(err.message || 'Dosya silinemedi');
    }
  };

  const loadStock = async () => {
    try {
      setStockLoading(true);
      setStockError('');
      const payload = await getStockItems();
      const normalized = (payload || []).map((item) => ({
        ...item,
        available: Math.max(0, (item.onHand || 0) - (item.reserved || 0)),
      }));
      setStockItems(normalized);
    } catch (err) {
      setStockError(err.message || 'Stok listesi alınamadı');
    } finally {
      setStockLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
    loadJobDocuments();
    const loadLogs = async () => {
      try {
        setLogsError('');
        const payload = await getJobLogs(job.id);
        setLogs(payload);
      } catch (err) {
        setLogsError(err.message || 'Loglar alınamadı');
      }
    };
    loadLogs();
    setPendingPO(job.pendingPO || []);
  }, []);

  const stockStatus = (item) => {
    if (!item) return { label: '-', tone: 'secondary' };
    if (item.available <= 0) return { label: 'Tükendi', tone: 'danger' };
    if (item.available <= item.critical) return { label: 'Kritik', tone: 'danger' };
    if (item.available <= item.critical + Math.max(5, item.critical * 0.25)) return { label: 'Düşük', tone: 'warning' };
    return { label: 'Sağlıklı', tone: 'success' };
  };

  const filteredStock = useMemo(() => {
    const q = stockQuery.trim().toLowerCase();
    const skuQ = stockSkuQuery.trim().toLowerCase();
    const colorQ = stockColorQuery.trim().toLowerCase();
    let result = stockItems;
    
    if (q) {
      result = result.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.supplier || '').toLowerCase().includes(q) ||
          (it.category || '').toLowerCase().includes(q)
      );
    }
    
    if (skuQ) {
      result = result.filter((it) => it.sku.toLowerCase().includes(skuQ));
    }
    
    if (colorQ) {
      result = result.filter((it) => (it.color || '').toLowerCase().includes(colorQ));
    }
    
    return result;
  }, [stockItems, stockQuery, stockSkuQuery, stockColorQuery]);

  const stockSummary = useMemo(() => {
    const total = stockItems.reduce((sum, it) => sum + (it.available || 0), 0);
    const critical = stockItems.filter((it) => stockStatus(it).tone !== 'success').length;
    return { total, critical };
  }, [stockItems]);

  const offerTotalValue = useMemo(() => {
    const fromJob = Number(job.offer?.total || 0);
    const local = Number(inputs.offerTotal || 0);
    return local || fromJob || 0;
  }, [job.offer, inputs.offerTotal]);

  const chequeTotal = useMemo(
    () => inputs.chequeLines.reduce((sum, c) => sum + Number(c.amount || 0), 0),
    [inputs.chequeLines]
  );

  const paymentTotal = useMemo(() => {
    return (
      Number(inputs.payCash || 0) +
      Number(inputs.payCard || 0) +
      chequeTotal +
      Number(inputs.payAfter || 0)
    );
  }, [inputs.payCash, inputs.payCard, inputs.payAfter, chequeTotal]);

  const avgChequeDays = useMemo(() => {
    const today = new Date();
    const totalAmount = inputs.chequeLines.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    if (totalAmount <= 0) return 0;
    const weighted = inputs.chequeLines.reduce((sum, c) => {
      const due = c.due ? new Date(c.due) : today;
      const days = Math.max(0, Math.round((due - today) / (1000 * 60 * 60 * 24)));
      return sum + Number(c.amount || 0) * days;
    }, 0);
    return Math.round(weighted / totalAmount);
  }, [inputs.chequeLines]);

  const selectStock = (item) => {
    setSelectedStock(item);
    setReserveQty(1);
  };

  const addReservedLine = () => {
    if (!selectedStock || reserveQty <= 0) return;
    setReservedLines((prev) => {
      const existing = prev.find((line) => line.id === selectedStock.id);
      if (existing) {
        return prev.map((line) =>
          line.id === selectedStock.id ? { ...line, qty: line.qty + reserveQty } : line
        );
      }
      return [
        ...prev,
        {
          id: selectedStock.id,
          name: selectedStock.name,
          sku: selectedStock.sku,
          qty: reserveQty,
          unit: selectedStock.unit,
          available: selectedStock.available,
          supplier: selectedStock.supplier,
          color: selectedStock.color,
        },
      ];
    });
    setSelectedStock(null);
    setReserveQty(1);
    setStockModalOpen(false);
  };

  const removeLine = (id) => {
    setReservedLines((prev) => prev.filter((line) => line.id !== id));
  };

  const status = job.status || '';

  return (
    <div className="grid grid-1" style={{ gap: 16 }}>
      <div className="card subtle-card">
        <div className="card-header">
          <h3 className="card-title">Süreç Haritası</h3>
          <span className="badge badge-secondary">{currentStage.label}</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', padding: '0 12px' }}>
            {activeFlow.map((stage, idx) => {
              const state = stageState(stage.id);
              const isActive = state === 'current';
              const isDone = state === 'done';
              const isLast = idx === activeFlow.length - 1;
              
              // Alt aşama sayısı (noktalar için)
              const subStepCount = stage.statuses?.length || 1;
              // Mevcut durum bu aşamada mı ve kaçıncı alt adımda
              const currentSubIndex = isActive 
                ? stage.statuses?.indexOf(job.status) 
                : isDone ? subStepCount : -1;

              let color = '#e2e8f0'; // gray-200
              if (isActive) color = '#3b82f6'; // blue-500
              if (isDone) color = '#22c55e'; // green-500

              return (
                <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 1,
                      width: 100,
                    }}
                    onClick={() => markStage(stage.id)}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: isActive ? 'white' : color,
                        border: `2px solid ${color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: isActive ? color : 'white',
                        marginBottom: 8,
                        transition: 'all 0.2s',
                        boxShadow: isActive ? `0 0 0 4px ${color}33` : 'none',
                      }}
                    >
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#0f172a' : '#64748b',
                        textAlign: 'center',
                        lineHeight: 1.3,
                      }}
                    >
                      {stage.label}
                    </div>
                  </div>
                  {/* Bağlantı çizgisi ve ara noktalar */}
                  {!isLast && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      position: 'relative',
                      marginTop: -20 // Label'ın üstünde kalması için
                    }}>
                      {/* Ana çizgi */}
                      <div
                        style={{
                          width: subStepCount > 1 ? 30 + (subStepCount - 1) * 16 : 60,
                          height: 3,
                          backgroundColor: isDone ? '#22c55e' : '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-evenly',
                          position: 'relative'
                        }}
                      >
                        {/* Alt adım noktaları - sadece 2'den fazla alt adım varsa göster */}
                        {subStepCount > 1 && Array.from({ length: subStepCount - 1 }).map((_, dotIdx) => {
                          const dotDone = isDone || (isActive && dotIdx < currentSubIndex);
                          return (
                            <div
                              key={dotIdx}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: dotDone ? '#22c55e' : (isActive && dotIdx === currentSubIndex ? '#3b82f6' : '#cbd5e1'),
                                border: isActive && dotIdx === currentSubIndex ? '2px solid #3b82f6' : 'none',
                                boxShadow: isActive && dotIdx === currentSubIndex ? '0 0 0 2px rgba(59,130,246,0.3)' : 'none',
                                transition: 'all 0.2s'
                              }}
                              title={stage.statuses?.[dotIdx + 1] ? STATUS_LABELS[stage.statuses[dotIdx + 1]]?.label || '' : ''}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="card-footer text-muted">
          Seçtiğiniz aşamanın formu aşağıda açılır. Önceki aşamalara dönüp düzeltme yapabilirsiniz.
        </div>
      </div>

      <div className="card subtle-card" style={{ marginBottom: 16 }}>
        <div className="grid grid-2" style={{ gap: 16 }}>
          <div>
            <div className="metric-row" style={{ marginBottom: 8 }}>
              <span className="metric-label">Durum</span>
              {renderStatus(job.status)}
            </div>
            <div className="metric-row" style={{ marginBottom: 8 }}>
              <span className="metric-label">Başlık</span>
              <span className="metric-value">{job.title}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">İş No</span>
              <span className="metric-value" style={{ fontSize: 12 }}>{job.id}</span>
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>👤 {job.customerName}</div>
            {customer.phone && (
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                📞 {customer.phone}
                {customer.phone2 && ` / ${customer.phone2}`}
              </div>
            )}
            {customer.address && (
              <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                📍 {customer.address}
              </div>
            )}
            {!customer.phone && !customer.address && (
              <div className="text-muted" style={{ fontSize: 12 }}>Müşteri detayları bulunamadı</div>
            )}
          </div>
        </div>
      </div>

      {actionError ? (
        <div className="card error-card">
          <div className="error-title">Hata</div>
          <div className="error-message">{actionError}</div>
        </div>
      ) : null}

      {isStageSelected('measure') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              {job.startType === 'MUSTERI_OLCUSU' ? '📄 Müşteri Ölçüsü' : '📐 Ölçü / Keşif'}
            </h3>
            {renderStatus(job.status)}
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            
            {/* İş Kolu Bilgisi */}
            {job.roles?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {job.roles.map((r) => (
                  <span key={r.id || r.name} className="badge badge-secondary">{r.name}</span>
                ))}
              </div>
            )}

            {/* AŞAMA 1: RANDEVU BEKLİYOR */}
            {job.status === 'OLCU_RANDEVU_BEKLIYOR' && job.startType !== 'MUSTERI_OLCUSU' && (
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📅 Randevu Bilgileri</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-3" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Randevu Tarihi *</label>
                      <input
                        className="form-input"
                        type="date"
                        value={inputs.appointment?.split('T')[0] || ''}
                        onChange={(e) => {
                          const time = inputs.appointment?.includes('T') ? inputs.appointment.split('T')[1]?.slice(0, 5) : '10:00';
                          setInputs((p) => ({ ...p, appointment: e.target.value ? `${e.target.value}T${time}` : '' }));
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Saat *</label>
                      <input
                        className="form-input"
                        type="time"
                        value={inputs.appointment?.includes('T') ? inputs.appointment.split('T')[1]?.slice(0, 5) : '10:00'}
                        onChange={(e) => {
                          const date = inputs.appointment?.split('T')[0] || '';
                          if (date) {
                            setInputs((p) => ({ ...p, appointment: `${date}T${e.target.value}` }));
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label">Adres / Not</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Müşteri adresi, iletişim bilgileri, notlar..."
                      rows={2}
                      value={inputs.measureNote}
                      onChange={(e) => setInputs((p) => ({ ...p, measureNote: e.target.value }))}
                    />
                  </div>
                  <button
                    className="btn btn-success"
                    type="button"
                    style={{ marginTop: 12 }}
                    disabled={actionLoading || !inputs.appointment}
                    onClick={() =>
                      act(
                        () =>
                          updateJobMeasure(job.id, {
                            measurements: { note: inputs.measureNote },
                            appointment: { date: inputs.appointment },
                            status: 'OLCU_RANDEVULU',
                          }),
                        { transition: 'OLCU_RANDEVULU' }
                      )
                    }
                  >
                    ✓ Randevuyu Kaydet
                  </button>
                  {!inputs.appointment && (
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                      ⚠️ Randevu tarihi zorunludur.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AŞAMA 2: RANDEVU VERİLDİ - Ölçüye gidilecek */}
            {job.status === 'OLCU_RANDEVULU' && (
              <div className="card" style={{ border: '2px solid var(--color-info)', background: 'var(--color-info-bg)' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📅 Randevu Bilgisi</h4>
                  <span className="badge badge-info">Ölçüye Gidilecek</span>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-2" style={{ gap: 16 }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>RANDEVU</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>
                        {job.measure?.appointment?.date ? 
                          new Date(job.measure.appointment.date).toLocaleString('tr-TR', { 
                            dateStyle: 'long', 
                            timeStyle: 'short' 
                          }) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                      <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                    </div>
                  </div>
                  {job.measure?.measurements?.note && (
                    <div style={{ marginTop: 12, padding: 10, background: 'white', borderRadius: 6 }}>
                      <strong>Not:</strong> {job.measure.measurements.note}
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    type="button"
                    style={{ marginTop: 16 }}
                    disabled={actionLoading}
                    onClick={() =>
                      act(
                        () =>
                          updateJobStatus(job.id, { status: 'OLCU_ALINDI' }),
                        { transition: 'OLCU_ALINDI' }
                      )
                    }
                  >
                    🚗 Ölçü Alındı - Dosya Yüklemeye Geç
                  </button>
                </div>
              </div>
            )}

            {/* AŞAMA 3: ÖLÇÜ ALINDI - Dosya yükleme */}
            {(job.status === 'OLCU_ALINDI' || job.startType === 'MUSTERI_OLCUSU') && job.roles?.length > 0 && (
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📁 Çizim Dosyaları</h4>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    Her iş kolu için dosya yükleyin
                  </span>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  {job.roles.map((role) => {
                    const roleKey = role.id || role.name;
                    // jobDocuments'tan dosya kontrolü
                    const measureDocs = jobDocuments.filter(d => d.type === `measure_${roleKey}`);
                    const techDocs = jobDocuments.filter(d => d.type === `technical_${roleKey}`);
                    const hasMeasureFile = measureDocs.length > 0;
                    const hasTechFile = techDocs.length > 0;
                    const isComplete = hasMeasureFile && hasTechFile;
                    
                    return (
                      <div key={roleKey} style={{ 
                        marginBottom: 16, 
                        padding: 16, 
                        background: isComplete ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                        borderRadius: 8,
                        border: isComplete ? '1px solid var(--color-success)' : '1px solid var(--color-border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isComplete && <span style={{ color: 'var(--color-success)' }}>✓</span>}
                            {role.name}
                          </div>
                          {isComplete && <span className="badge badge-success">Tamamlandı</span>}
                        </div>
                        <div className="grid grid-2" style={{ gap: 12 }}>
                          <div className="form-group">
                            <label className="form-label">
                              Ölçü Çizimi {!hasMeasureFile && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                            </label>
                            <div className="file-upload-zone">
                              <input
                                type="file"
                                id={`measure-file-${roleKey}`}
                                accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    await handleDocUpload(file, `measure_${roleKey}`, `${role.name} - Ölçü Çizimi`);
                                    e.target.value = '';
                                  }
                                }}
                              />
                              <label htmlFor={`measure-file-${roleKey}`} className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                                📐 Dosya Seç
                              </label>
                              {hasMeasureFile && <span className="badge badge-success" style={{ marginLeft: 8 }}>✓</span>}
                            </div>
                            {/* Yüklü dosyalar */}
                            {measureDocs.map(doc => (
                              <div key={doc.id} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                <a 
                                  href={getDocumentDownloadUrl(doc.id)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--color-primary)' }}
                                >
                                  📎 {doc.originalName}
                                </a>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-small btn-icon"
                                  style={{ padding: '2px 6px', fontSize: 10 }}
                                  onClick={() => handleDocDelete(doc.id)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="form-group">
                            <label className="form-label">
                              Teknik Çizim {!hasTechFile && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                            </label>
                            <div className="file-upload-zone">
                              <input
                                type="file"
                                id={`tech-file-${roleKey}`}
                                accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    await handleDocUpload(file, `technical_${roleKey}`, `${role.name} - Teknik Çizim`);
                                    e.target.value = '';
                                  }
                                }}
                              />
                              <label htmlFor={`tech-file-${roleKey}`} className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                                📏 Dosya Seç
                              </label>
                              {hasTechFile && <span className="badge badge-success" style={{ marginLeft: 8 }}>✓</span>}
                            </div>
                            {/* Yüklü dosyalar */}
                            {techDocs.map(doc => (
                              <div key={doc.id} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                <a 
                                  href={getDocumentDownloadUrl(doc.id)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--color-primary)' }}
                                >
                                  📎 {doc.originalName}
                                </a>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-small btn-icon"
                                  style={{ padding: '2px 6px', fontSize: 10 }}
                                  onClick={() => handleDocDelete(doc.id)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Uyarı veya geçiş butonu */}
                  {(() => {
                    const allComplete = job.roles.every((role) => {
                      const roleKey = role.id || role.name;
                      const hasMeasure = jobDocuments.some(d => d.type === `measure_${roleKey}`);
                      const hasTech = jobDocuments.some(d => d.type === `technical_${roleKey}`);
                      return hasMeasure && hasTech;
                    });
                    
                    if (!allComplete) {
                      return (
                        <div className="text-muted" style={{ 
                          padding: 12, 
                          background: 'var(--color-warning-bg)', 
                          borderRadius: 8,
                          fontSize: 13
                        }}>
                          ⚠️ Fiyatlandırmaya geçmek için tüm iş kollarının dosyaları yüklenmelidir.
                        </div>
                      );
                    }
                    
                    return (
                      <button
                        className="btn btn-success"
                        type="button"
                        style={{ marginTop: 8 }}
                        disabled={actionLoading}
                        onClick={() =>
                          act(
                            () =>
                              updateJobStatus(job.id, { status: 'FIYATLANDIRMA' }),
                            { transition: 'FIYATLANDIRMA' }
                          )
                        }
                      >
                        ✓ Fiyatlandırmaya Geç
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Müşteri Ölçüsü - Dosya bekleniyor */}
            {job.status === 'MUSTERI_OLCUSU_BEKLENIYOR' && (
              <div className="card" style={{ border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
                <div className="card-body" style={{ padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Müşteri Ölçüsü Bekleniyor</div>
                  <div className="text-muted">Yukarıdaki alanlara müşteriden gelen ölçü dosyalarını yükleyin.</div>
                </div>
              </div>
            )}

            {/* Validasyon Hataları */}
            {validationErrors.length > 0 && (
              <div className="card error-card">
                <div className="error-title">⚠️ Eksikler var</div>
                <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                  {validationErrors.map((err, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {isStageSelected('pricing') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">💰 Fiyatlandırma</h3>
            {renderStatus(job.status)}
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            
            {/* FIYATLANDIRMA - Fiyat girilecek */}
            {job.status === 'FIYATLANDIRMA' && (
              <>
                {/* Yüklü Dosyalar */}
                {jobDocuments.length > 0 && (
                  <div className="card subtle-card">
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>📁 Yüklü Dosyalar</h4>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {jobDocuments.map((doc) => (
                          <a 
                            key={doc.id}
                            href={getDocumentDownloadUrl(doc.id)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              padding: '6px 12px', 
                              background: 'var(--color-bg-secondary)', 
                              borderRadius: 6,
                              fontSize: 12,
                              textDecoration: 'none',
                              color: 'var(--color-text)'
                            }}
                          >
                            📎 {doc.originalName}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* İş Kolu Bazlı Fiyatlandırma */}
                {job.roles?.length > 0 && (
                  <div className="card subtle-card">
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>💰 İş Kolu Bazlı Fiyatlandırma</h4>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {job.roles.map((role) => {
                          const roleKey = role.id || role.name;
                          return (
                            <div key={roleKey} className="metric-row" style={{ 
                              padding: '12px 16px', 
                              background: 'var(--color-bg-secondary)',
                              borderRadius: 8
                            }}>
                              <div style={{ fontWeight: 600, minWidth: 180 }}>{role.name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CurrencyInput
                                  placeholder="0"
                                  style={{ width: 150 }}
                                  value={inputs.rolePrices[roleKey] || ''}
                                  onChange={(val) => setInputs((p) => ({
                                    ...p,
                                    rolePrices: { ...p.rolePrices, [roleKey]: val }
                                  }))}
                                />
                                <span style={{ color: 'var(--color-text-light)' }}>₺</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Toplam */}
                      <div style={{ 
                        marginTop: 16, 
                        padding: '16px', 
                        background: 'var(--color-primary)', 
                        borderRadius: 8,
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontWeight: 600 }}>TOPLAM</span>
                        <span style={{ fontSize: 24, fontWeight: 700 }}>
                          {formatNumber(
                            Object.values(inputs.rolePrices).reduce((sum, val) => sum + (Number(val) || 0), 0)
                          )} ₺
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fiyat Bildirimi */}
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>📞 Müşteriye Bildirim</h4>
                  </div>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Fiyat Bildirim Tarihi *</label>
                      <input
                        className="form-input"
                        type="date"
                        value={inputs.pricingNotifiedDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setInputs((p) => ({ ...p, pricingNotifiedDate: e.target.value }))}
                      />
                    </div>
                    <button
                      className="btn btn-success"
                      type="button"
                      style={{ marginTop: 12 }}
                      disabled={actionLoading || Object.values(inputs.rolePrices).every(v => !v)}
                      onClick={() => {
                        const total = Object.values(inputs.rolePrices).reduce((sum, val) => sum + (Number(val) || 0), 0);
                        act(
                          () =>
                            updateJobStatus(job.id, {
                              status: 'FIYAT_VERILDI',
                              offer: {
                                total,
                                rolePrices: inputs.rolePrices,
                                notifiedDate: inputs.pricingNotifiedDate || new Date().toISOString().split('T')[0],
                              },
                            }),
                          { transition: 'FIYAT_VERILDI' }
                        );
                      }}
                    >
                      ✓ Fiyat Müşteriye Bildirildi
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* FIYAT_VERILDI - Müşteri onayı bekleniyor */}
            {job.status === 'FIYAT_VERILDI' && (() => {
              // Hesaplamalar - job.roles üzerinden fiyatları al
              const rolePrices = job.offer?.rolePrices || {};
              const originalTotal = job.offer?.total || job.roles?.reduce((sum, role) => {
                const roleKey = role.id || role.name;
                return sum + (Number(rolePrices[roleKey]) || 0);
              }, 0) || 0;
              const currentDiscounts = inputs.roleDiscounts || {};
              const totalDiscount = Object.values(currentDiscounts).reduce((sum, val) => sum + (Number(val) || 0), 0);
              const finalTotal = originalTotal - totalDiscount;
              const hasNegotiation = job.offer?.negotiationHistory?.length > 0;
              
              return (
              <>
                {/* Fiyat Özeti */}
                <div className="card" style={{ border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
                  <div className="card-body" style={{ padding: 20 }}>
                    <div className="grid grid-3" style={{ gap: 16, marginBottom: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 12 }}>İLK FİYAT</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: originalTotal > 0 ? 'var(--color-text)' : 'var(--color-danger)' }}>
                          {originalTotal > 0 ? `${formatNumber(originalTotal)} ₺` : 'Fiyat Girilmedi!'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 12 }}>BİLDİRİM TARİHİ</div>
                        <div style={{ fontWeight: 600 }}>
                          {job.offer?.notifiedDate ? new Date(job.offer.notifiedDate).toLocaleDateString('tr-TR') : '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                        <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                      </div>
                    </div>
                    
                    {/* İş kolu detayları - job.roles üzerinden */}
                    {job.roles?.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 8 }}>İş Kolu Bazlı Fiyatlar:</div>
                        {job.roles.map((role) => {
                          const roleKey = role.id || role.name;
                          const price = Number(rolePrices[roleKey]) || 0;
                          return (
                            <div key={roleKey} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                              <span>{role.name}</span>
                              <span style={{ color: price > 0 ? 'inherit' : 'var(--color-danger)' }}>
                                {price > 0 ? `${formatNumber(price)} ₺` : 'Girilmedi'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fiyat girilmemişse uyarı ve düzeltme */}
                {originalTotal === 0 && (
                  <div className="card" style={{ border: '2px solid var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-danger)', marginBottom: 8 }}>
                        ⚠️ Bu iş için fiyat girilmemiş!
                      </div>
                      <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                        Fiyatlandırma aşamasına geri dönüp iş kolu bazlı fiyatları girmeniz gerekmektedir.
                      </div>
                      <button
                        className="btn btn-warning"
                        type="button"
                        disabled={actionLoading}
                        onClick={() =>
                          act(
                            () => updateJobStatus(job.id, { status: 'FIYATLANDIRMA' }),
                            { transition: 'FIYATLANDIRMA' }
                          )
                        }
                      >
                        ← Fiyatlandırmaya Geri Dön
                      </button>
                    </div>
                  </div>
                )}

                {/* Pazarlık Geçmişi */}
                {hasNegotiation && (
                  <div className="card subtle-card">
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>📜 Pazarlık Geçmişi</h4>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      <table className="table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Tarih</th>
                            <th>İlk Fiyat</th>
                            <th>İskonto</th>
                            <th>Son Fiyat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.offer.negotiationHistory.map((neg, idx) => (
                            <tr key={idx}>
                              <td>{new Date(neg.date).toLocaleDateString('tr-TR')}</td>
                              <td>{formatNumber(neg.originalTotal)} ₺</td>
                              <td style={{ color: 'var(--color-danger)' }}>-{formatNumber(neg.discountTotal)} ₺</td>
                              <td style={{ fontWeight: 600 }}>{formatNumber(neg.finalTotal)} ₺</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pazarlık Paneli */}
                {inputs.showNegotiationPanel && originalTotal > 0 ? (
                  <div className="card" style={{ border: '2px solid var(--color-primary)' }}>
                    <div className="card-header" style={{ padding: '12px 16px', background: 'var(--color-primary-bg)' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>💬 İskonto / Pazarlık</h4>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => setInputs((p) => ({ ...p, showNegotiationPanel: false, roleDiscounts: {} }))}
                      >
                        İptal
                      </button>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ fontSize: 13, color: 'var(--color-text-light)', marginBottom: 12 }}>
                        Her iş kolu için yapılacak iskonto tutarını girin:
                      </div>
                      
                      {/* İş Kolu Bazlı İskonto - job.roles üzerinden */}
                      {job.roles?.map((role) => {
                        const roleKey = role.id || role.name;
                        const originalPrice = Number(rolePrices[roleKey]) || 0;
                        const discount = Number(currentDiscounts[roleKey] || 0);
                        const afterDiscount = originalPrice - discount;
                        
                        return (
                          <div key={roleKey} style={{ 
                            padding: '12px 16px', 
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 8,
                            marginBottom: 8
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontWeight: 600 }}>{role.name}</span>
                              <span style={{ fontSize: 13 }}>Mevcut: {formatNumber(originalPrice)} ₺</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>İskonto Tutarı</label>
                                <CurrencyInput
                                  placeholder="0"
                                  value={currentDiscounts[roleKey] || ''}
                                  onChange={(val) => setInputs((p) => ({
                                    ...p,
                                    roleDiscounts: { ...p.roleDiscounts, [roleKey]: val }
                                  }))}
                                />
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>Yeni Fiyat</div>
                                <div style={{ fontWeight: 700, fontSize: 16, color: discount > 0 ? 'var(--color-success)' : 'inherit' }}>
                                  {formatNumber(afterDiscount)} ₺
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Toplam Özet */}
                      <div style={{ 
                        marginTop: 16, 
                        padding: 16, 
                        background: totalDiscount > 0 ? 'var(--color-success-bg)' : 'var(--color-bg-secondary)',
                        borderRadius: 8,
                        border: totalDiscount > 0 ? '2px solid var(--color-success)' : 'none'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span>İlk Toplam:</span>
                          <span>{formatNumber(originalTotal)} ₺</span>
                        </div>
                        {totalDiscount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--color-danger)' }}>
                            <span>Toplam İskonto:</span>
                            <span>-{formatNumber(totalDiscount)} ₺</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                          <span>ANLAŞILAN FİYAT:</span>
                          <span style={{ color: 'var(--color-success)' }}>{formatNumber(finalTotal)} ₺</span>
                        </div>
                      </div>
                      
                      {/* Onay Butonu */}
                      <button
                        className="btn btn-success"
                        type="button"
                        style={{ width: '100%', marginTop: 16 }}
                        disabled={actionLoading}
                        onClick={() => {
                          // Pazarlık geçmişine ekle
                          const history = job.offer?.negotiationHistory || [];
                          const newHistory = [...history, {
                            date: new Date().toISOString(),
                            originalTotal,
                            discountTotal: totalDiscount,
                            finalTotal,
                            roleDiscounts: { ...currentDiscounts }
                          }];
                          
                          // Yeni fiyatları hesapla
                          const newRolePrices = {};
                          job.roles?.forEach((role) => {
                            const roleKey = role.id || role.name;
                            const oldPrice = Number(rolePrices[roleKey]) || 0;
                            newRolePrices[roleKey] = oldPrice - (Number(currentDiscounts[roleKey]) || 0);
                          });
                          
                          act(
                            () =>
                              updateJobStatus(job.id, {
                                status: 'ANLASMA_YAPILIYOR',
                                offer: {
                                  ...job.offer,
                                  total: finalTotal,
                                  rolePrices: newRolePrices,
                                  negotiationHistory: newHistory,
                                  agreedDate: new Date().toISOString()
                                },
                              }),
                            { transition: 'ANLASMA_YAPILIYOR' }
                          );
                        }}
                      >
                        ✓ Bu Fiyatla Anlaşıldı - Devam Et
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal Butonlar */
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      className="btn btn-success"
                      type="button"
                      style={{ flex: 1 }}
                      disabled={actionLoading}
                      onClick={() =>
                        act(
                          () =>
                            updateJobStatus(job.id, { 
                              status: 'ANLASMA_YAPILIYOR',
                              offer: { ...job.offer, agreedDate: new Date().toISOString() }
                            }),
                          { transition: 'ANLASMA_YAPILIYOR' }
                        )
                      }
                    >
                      ✓ Fiyat Onaylandı
                    </button>
                    <button
                      className="btn btn-warning"
                      type="button"
                      style={{ flex: 1 }}
                      disabled={actionLoading}
                      onClick={() => setInputs((p) => ({ ...p, showNegotiationPanel: true }))}
                    >
                      💬 Pazarlık / İskonto
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      style={{ flex: 1 }}
                      disabled={actionLoading}
                      onClick={() => setInputs((p) => ({ ...p, showRejectionModal: true }))}
                    >
                      ✕ Reddedildi
                    </button>
                  </div>
                )}

                {/* Ret Modal */}
                {inputs.showRejectionModal && (
                  <div className="card" style={{ border: '2px solid var(--color-danger)', background: 'var(--color-danger-bg)' }}>
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14, color: 'var(--color-danger)' }}>❌ Ret / Anlaşılamadı</h4>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div className="grid grid-2" style={{ gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Ret Kategorisi *</label>
                          <select
                            className="form-select"
                            value={inputs.rejectionCategory || ''}
                            onChange={(e) => setInputs((p) => ({ ...p, rejectionCategory: e.target.value }))}
                          >
                            <option value="">Seçin...</option>
                            <option value="FIYAT_YUKSEK">💰 Fiyat Yüksek Bulundu</option>
                            <option value="ZAMANLAMA">📅 Zamanlama Uymuyor</option>
                            <option value="BASKA_FIRMA">🏢 Başka Firmaya Gitti</option>
                            <option value="PROJE_IPTAL">🚫 Projeyi İptal Etti</option>
                            <option value="DUSUNUYOR">🤔 Düşünüyor / Bekliyor</option>
                            <option value="DIGER">📝 Diğer</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Takip Tarihi</label>
                          <input
                            className="form-input"
                            type="date"
                            value={inputs.rejectionFollowUp || ''}
                            onChange={(e) => setInputs((p) => ({ ...p, rejectionFollowUp: e.target.value }))}
                            min={new Date().toISOString().split('T')[0]}
                          />
                          <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                            💡 Bu tarihte tekrar aranacak
                          </div>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Açıklama / Not *</label>
                        <textarea
                          className="form-textarea"
                          placeholder="Detaylı açıklama yazın..."
                          rows={3}
                          value={inputs.rejectionReason || ''}
                          onChange={(e) => setInputs((p) => ({ ...p, rejectionReason: e.target.value }))}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => setInputs((p) => ({ ...p, showRejectionModal: false }))}
                        >
                          İptal
                        </button>
                        <button
                          className="btn btn-danger"
                          type="button"
                          disabled={actionLoading || !inputs.rejectionReason || !inputs.rejectionCategory}
                          onClick={() =>
                            act(
                              () =>
                                updateJobStatus(job.id, {
                                  status: 'ANLASILAMADI',
                                  rejection: {
                                    category: inputs.rejectionCategory,
                                    reason: inputs.rejectionReason,
                                    followUpDate: inputs.rejectionFollowUp || null,
                                    date: new Date().toISOString(),
                                    lastOffer: job.offer
                                  },
                                }),
                              { transition: 'ANLASILAMADI' }
                            )
                          }
                        >
                          İşi Anlaşılamadı Olarak İşaretle
                        </button>
                      </div>
                      {(!inputs.rejectionReason || !inputs.rejectionCategory) && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                          ⚠️ Kategori ve açıklama zorunludur.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
              );
            })()}

            {/* ANLASILAMADI - İş reddedildi */}
            {job.status === 'ANLASILAMADI' && (() => {
              const rejectionCategories = {
                'FIYAT_YUKSEK': { label: 'Fiyat Yüksek Bulundu', icon: '💰', color: 'warning' },
                'ZAMANLAMA': { label: 'Zamanlama Uymuyor', icon: '📅', color: 'secondary' },
                'BASKA_FIRMA': { label: 'Başka Firmaya Gitti', icon: '🏢', color: 'danger' },
                'PROJE_IPTAL': { label: 'Projeyi İptal Etti', icon: '🚫', color: 'danger' },
                'DUSUNUYOR': { label: 'Düşünüyor / Bekliyor', icon: '🤔', color: 'info' },
                'DIGER': { label: 'Diğer', icon: '📝', color: 'secondary' }
              };
              const category = rejectionCategories[job.rejection?.category] || rejectionCategories['DIGER'];
              const lastOffer = job.rejection?.lastOffer || job.offer;
              const hasFollowUp = job.rejection?.followUpDate;
              const isFollowUpPast = hasFollowUp && new Date(job.rejection.followUpDate) <= new Date();
              
              return (
              <div className="card" style={{ border: '2px solid var(--color-danger)' }}>
                <div className="card-header" style={{ background: 'var(--color-danger)', color: 'white' }}>
                  <h3 className="card-title" style={{ color: 'white' }}>❌ Anlaşılamadı</h3>
                  <span style={{ fontSize: 12, opacity: 0.9 }}>
                    {job.rejection?.date ? new Date(job.rejection.date).toLocaleDateString('tr-TR') : ''}
                  </span>
                </div>
                <div className="card-body" style={{ padding: 20 }}>
                  
                  {/* Ret Bilgileri */}
                  <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{job.customerName}</div>
                      {customer.phone && (
                        <div style={{ fontSize: 13, marginTop: 4 }}>📞 {customer.phone}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>RET SEBEBİ</div>
                      <div style={{ fontWeight: 600 }}>
                        {category.icon} {category.label}
                      </div>
                    </div>
                  </div>
                  
                  {/* Ret Açıklaması */}
                  {job.rejection?.reason && (
                    <div style={{ padding: 12, background: 'var(--color-danger-bg)', borderRadius: 8, marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Açıklama:</div>
                      <div>{job.rejection.reason}</div>
                    </div>
                  )}
                  
                  {/* Takip Tarihi */}
                  {hasFollowUp && (
                    <div style={{ 
                      padding: 12, 
                      background: isFollowUpPast ? 'var(--color-warning-bg)' : 'var(--color-bg-secondary)', 
                      borderRadius: 8, 
                      marginBottom: 16,
                      border: isFollowUpPast ? '2px solid var(--color-warning)' : 'none'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--color-text-light)' }}>📅 TAKİP TARİHİ</span>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(job.rejection.followUpDate).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                        {isFollowUpPast && (
                          <span className="badge badge-warning">⏰ Takip Zamanı!</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* İş Özeti */}
                  <div className="card subtle-card" style={{ marginBottom: 16 }}>
                    <div className="card-header" style={{ padding: '12px 16px' }}>
                      <h4 className="card-title" style={{ fontSize: 14 }}>📋 İş Özeti</h4>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                      {/* Ölçü Bilgisi */}
                      <div className="metric-row" style={{ marginBottom: 8 }}>
                        <span className="metric-label">📐 Ölçü Alındı</span>
                        <span className="metric-value">
                          {job.measure?.measurements?.date 
                            ? new Date(job.measure.measurements.date).toLocaleDateString('tr-TR') 
                            : job.measure?.appointment 
                              ? new Date(job.measure.appointment).toLocaleDateString('tr-TR')
                              : '-'}
                        </span>
                      </div>
                      
                      {/* Dosyalar */}
                      {jobDocuments.length > 0 && (
                        <div className="metric-row" style={{ marginBottom: 8 }}>
                          <span className="metric-label">📁 Yüklü Dosyalar</span>
                          <span className="metric-value">{jobDocuments.length} dosya</span>
                        </div>
                      )}
                      
                      {/* Son Fiyat Teklifi */}
                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>💰 Son Fiyat Teklifi:</div>
                        {lastOffer?.rolePrices && Object.entries(lastOffer.rolePrices).map(([key, val]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span>{job.roles?.find(r => (r.id || r.name) === key)?.name || key}</span>
                            <span>{formatNumber(val)} ₺</span>
                          </div>
                        ))}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          fontWeight: 700, 
                          fontSize: 16, 
                          marginTop: 8, 
                          paddingTop: 8, 
                          borderTop: '1px solid var(--color-border)' 
                        }}>
                          <span>TOPLAM:</span>
                          <span>{formatNumber(lastOffer?.total || 0)} ₺</span>
                        </div>
                      </div>
                      
                      {/* Pazarlık Geçmişi */}
                      {lastOffer?.negotiationHistory?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>📜 Pazarlık Geçmişi:</div>
                          {lastOffer.negotiationHistory.map((neg, idx) => (
                            <div key={idx} style={{ fontSize: 12, color: 'var(--color-text-light)', marginBottom: 4 }}>
                              {new Date(neg.date).toLocaleDateString('tr-TR')}: {formatNumber(neg.originalTotal)} ₺ → {formatNumber(neg.finalTotal)} ₺ 
                              <span style={{ color: 'var(--color-danger)' }}> (-{formatNumber(neg.discountTotal)} ₺)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Yeniden Aktifleştirme */}
                  <div style={{ 
                    padding: 16, 
                    background: 'var(--color-bg-secondary)', 
                    borderRadius: 8,
                    border: '1px dashed var(--color-border)'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>🔄 Müşteri Geri Döndü mü?</div>
                    <div className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                      Müşteri tekrar ilgileniyorsa, son fiyat üzerinden yeni iskonto yapabilir veya mevcut fiyatla devam edebilirsiniz.
                    </div>
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        // Son teklifi geri yükle ve FIYAT_VERILDI durumuna dön
                        act(
                          () =>
                            updateJobStatus(job.id, {
                              status: 'FIYAT_VERILDI',
                              offer: {
                                ...lastOffer,
                                reactivatedAt: new Date().toISOString(),
                                reactivatedFrom: job.rejection
                              }
                            }),
                          { transition: 'FIYAT_VERILDI' }
                        );
                      }}
                    >
                      🔄 İşi Yeniden Aktifleştir
                    </button>
                  </div>
                </div>
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {isStageSelected('agreement') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📝 Anlaşma</h3>
            {renderStatus(job.status)}
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            
            {/* Fiyat Özeti */}
            <div className="card" style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)' }}>
              <div className="card-body" style={{ padding: 16 }}>
                <div className="grid grid-3" style={{ gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                    <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>ANLAŞILAN FİYAT</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)' }}>
                      {formatNumber(job.offer?.total || 0)} ₺
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>ONAY TARİHİ</div>
                    <div style={{ fontWeight: 600 }}>{new Date().toLocaleDateString('tr-TR')}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Ödeme Bilgileri */}
            <div className="card subtle-card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>💰 Ödeme Planı</h4>
              <div className="grid grid-4" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Nakit</label>
                  <CurrencyInput
                    placeholder="0"
                    value={inputs.payCash}
                    onChange={(val) => setInputs((p) => ({ ...p, payCash: val }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Kredi Kartı</label>
                  <CurrencyInput
                    placeholder="0"
                    value={inputs.payCard}
                    onChange={(val) => setInputs((p) => ({ ...p, payCard: val }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Çek Toplamı</label>
                  <div className="form-input" style={{ background: 'var(--bg-tertiary)', fontWeight: 600 }}>
                    {formatNumber(chequeTotal)} ₺
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Teslim Sonrası</label>
                  <CurrencyInput
                    placeholder="0"
                    value={inputs.payAfter}
                    onChange={(val) => setInputs((p) => ({ ...p, payAfter: val }))}
                  />
                </div>
              </div>
            </div>

            {/* Çek Detayları */}
            <div className="card subtle-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>📝 Çek Ekle</h4>
                <span className="text-muted" style={{ fontSize: 12 }}>Ortalama vade: {avgChequeDays} gün</span>
              </div>
              <div className="grid grid-3" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Tutar</label>
                  <CurrencyInput
                    placeholder="0"
                    value={inputs.chequeDraftAmount || ''}
                    onChange={(val) => setInputs((p) => ({ ...p, chequeDraftAmount: val }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vade Tarihi</label>
                  <input
                    className="form-input"
                    type="date"
                    value={inputs.chequeDraftDue || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, chequeDraftDue: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Banka</label>
                  <input
                    className="form-input"
                    placeholder="Banka adı"
                    value={inputs.chequeDraftBank || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, chequeDraftBank: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Şube</label>
                  <input
                    className="form-input"
                    placeholder="Şube adı"
                    value={inputs.chequeDraftBranch || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, chequeDraftBranch: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Çek No</label>
                  <input
                    className="form-input"
                    placeholder="Çek numarası"
                    value={inputs.chequeDraftNumber || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, chequeDraftNumber: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => {
                    const amt = Number(inputs.chequeDraftAmount || 0);
                    if (!amt) return;
                    setInputs((p) => ({
                      ...p,
                      chequeLines: [
                        ...p.chequeLines,
                        {
                          amount: amt,
                          due: p.chequeDraftDue || '',
                          bank: p.chequeDraftBank || '',
                          branch: p.chequeDraftBranch || '',
                          number: p.chequeDraftNumber || '',
                        },
                      ],
                      chequeDraftAmount: '',
                      chequeDraftDue: '',
                      chequeDraftBank: '',
                      chequeDraftBranch: '',
                      chequeDraftNumber: '',
                    }));
                  }}
                >
                  + Çek Ekle
                </button>
              </div>
              {inputs.chequeLines.length > 0 && (
                <div className="table-container" style={{ maxHeight: 200, overflow: 'auto', marginTop: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tutar</th>
                        <th>Vade</th>
                        <th>Banka</th>
                        <th>Şube</th>
                        <th>No</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {inputs.chequeLines.map((c, idx) => (
                        <tr key={`${c.number}-${idx}`}>
                          <td><strong>{formatNumber(c.amount)} ₺</strong></td>
                          <td>{formatDate(c.due)}</td>
                          <td>{c.bank || '-'}</td>
                          <td>{c.branch || '-'}</td>
                          <td>{c.number || '-'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger btn-small btn-icon"
              onClick={() =>
                                setInputs((p) => ({
                                  ...p,
                                  chequeLines: p.chequeLines.filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Toplam Özeti */}
            <div className="card subtle-card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>📊 Özet</h4>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="metric-row" style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 8 }}>
                  <div>
                    <div className="metric-label">Teklif Toplamı</div>
                  </div>
                  <strong style={{ fontSize: 18 }}>{formatNumber(offerTotalValue)} ₺</strong>
                </div>
                <div className="metric-row" style={{ background: paymentTotal === offerTotalValue ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', padding: '12px', borderRadius: 8 }}>
                  <div>
                    <div className="metric-label">Ödeme Toplamı</div>
                  </div>
                  <strong style={{ fontSize: 18, color: paymentTotal === offerTotalValue ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatNumber(paymentTotal)} ₺</strong>
                </div>
              </div>
              {paymentTotal !== offerTotalValue && (
                <div className="error-text" style={{ marginTop: 8, padding: 8, background: 'var(--color-danger-bg)', borderRadius: 4 }}>
                  ⚠️ Toplam ödeme, teklif tutarıyla eşleşmiyor. Fark: {formatNumber(Math.abs(offerTotalValue - paymentTotal))} ₺
                </div>
              )}
              {avgChequeDays > 90 && (
                <div style={{ marginTop: 8, padding: 8, background: '#fef3cd', borderRadius: 4, color: '#856404' }}>
                  ⏰ Ortalama vade {avgChequeDays} gün. Uzun vade için ek onay gerekebilir.
                </div>
              )}
            </div>

            {/* Sözleşme Dosyası */}
            <div className="card subtle-card" style={{ padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>📄 Sözleşme Dosyası</h4>
              <div className="file-upload-zone">
                <input
                  type="file"
                  id="contract-file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      await handleDocUpload(file, 'sozlesme', 'İmzalı Sözleşme');
                      e.target.value = '';
                    }
                  }}
                />
                <label htmlFor="contract-file" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  📎 Sözleşme Yükle
                </label>
                {jobDocuments.filter((d) => d.type === 'sozlesme').length > 0 && (
                  <span className="badge badge-success" style={{ marginLeft: 8 }}>
                    ✓ {jobDocuments.filter((d) => d.type === 'sozlesme').length} dosya yüklendi
                  </span>
                )}
              </div>
              {/* Yüklü Sözleşmeler */}
              {jobDocuments.filter((d) => d.type === 'sozlesme').map((doc) => (
                <div key={doc.id} className="metric-row" style={{ marginTop: 8, fontSize: 13 }}>
                  <a
                    href={getDocumentDownloadUrl(doc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary"
                  >
                    📎 {doc.originalName}
                  </a>
                  <button
                    type="button"
                    className="btn btn-danger btn-small btn-icon"
                    onClick={() => handleDocDelete(doc.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                Müşteriye imzalatılan sözleşmeyi yükleyin
              </div>
            </div>

            <div className="btn-group" style={{ gap: 12, marginTop: 8 }}>
              <button
                className="btn btn-success"
                type="button"
                disabled={actionLoading || paymentTotal !== offerTotalValue}
                onClick={() =>
                  act(async () => {
                    if (paymentTotal !== offerTotalValue) {
                      throw new Error('Ödeme toplamı teklif tutarıyla eşleşmiyor.');
                    }
                    const chequeSum = inputs.chequeLines.reduce((s, c) => s + Number(c.amount || 0), 0);
                    if (chequeSum !== chequeTotal) {
                      throw new Error('Çek parçaları toplamı hatalı.');
                    }
                    const payload = {
                    paymentPlan: {
                      cash: Number(inputs.payCash || 0),
                      card: Number(inputs.payCard || 0),
                        cheque: chequeTotal,
                        afterDelivery: Number(inputs.payAfter || 0),
                        cheques: inputs.chequeLines,
                    },
                    contractUrl: jobDocuments.find((d) => d.type === 'sozlesme')?.id || null,
                    stockNeeds: [],
                    };
                    const res = await startJobApproval(job.id, payload);
                    applyLocalJobPatch(job.id, {
                      payments: payload.paymentPlan,
                      offer: { ...job.offer, total: offerTotalValue },
                    });
                    return res;
                  })
                }
              >
                ✓ Anlaşmayı Tamamla - Stok Kontrolüne Geç
            </button>
            </div>
            {paymentTotal !== offerTotalValue && (
              <div className="text-muted" style={{ fontSize: 12, color: 'var(--color-danger)' }}>
                ⚠️ Ödeme toplamı teklif tutarıyla eşleşmiyor. Fark: {formatNumber(Math.abs(offerTotalValue - paymentTotal))} ₺
              </div>
            )}
          </div>
        </div>
      )}

      {isStageSelected('approval') && (
        <div className="card">
          <div className="card-header" style={{ alignItems: 'center' }}>
            <h3 className="card-title">Stok / Rezervasyon</h3>
            <div className="badge badge-secondary">
              Mevcut: {stockSummary.total} • Kritik: {stockSummary.critical}
          </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div className="text-muted">İş için birden fazla kalem rezerve edebilirsiniz.</div>
              <button className="btn btn-secondary" type="button" onClick={() => setStockModalOpen(true)}>
                Stoktan Ekle
              </button>
            </div>

            {/* Seçili Kalemler - Dataframe Görünümü */}
            <div className="card subtle-card">
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h4 className="card-title" style={{ fontSize: 14 }}>Seçili Kalemler</h4>
                <span className="badge badge-secondary">{reservedLines.length} kalem</span>
              </div>
              {reservedLines.length === 0 ? (
                <div className="text-muted" style={{ padding: 16 }}>Henüz ekleme yapmadınız. "Stoktan Ekle" butonuna tıklayın.</div>
              ) : (
                <div className="table-container" style={{ maxHeight: 200, overflow: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Kalem</th>
                        <th>Kod</th>
                        <th>Renk</th>
                        <th>Mevcut</th>
                        <th>Miktar</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservedLines.map((line) => (
                        <tr key={line.id}>
                          <td style={{ fontWeight: 600 }}>{line.name}</td>
                          <td className="text-muted">{line.sku}</td>
                          <td><span className="badge badge-secondary">{line.color || '-'}</span></td>
                          <td>{line.available} {line.unit}</td>
                          <td style={{ minWidth: 100 }}>
                            <input
                              type="number"
                              className="form-input"
                              min="1"
                              value={line.qty}
                              onChange={(e) => {
                                const newQty = Number(e.target.value) || 1;
                                setReservedLines((prev) =>
                                  prev.map((l) => (l.id === line.id ? { ...l, qty: newQty } : l))
                                );
                              }}
                              style={{ width: 80 }}
                            />
                          </td>
                          <td>
                            <button className="btn btn-danger btn-small btn-icon" type="button" onClick={() => removeLine(line.id)}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Rezervasyon Notu */}
            <div className="form-group">
              <label className="form-label">Rezervasyon Notu</label>
              <textarea
                className="form-textarea"
                placeholder="Satınalma / rezervasyon notu"
                value={inputs.stockNote}
                onChange={(e) => setInputs((p) => ({ ...p, stockNote: e.target.value }))}
                rows={3}
              />
            </div>

            <label className="form-label">
              <input
                type="checkbox"
                checked={inputs.stockReady}
                onChange={(e) => setInputs((p) => ({ ...p, stockReady: e.target.checked }))}
              />{' '}
              Stok hazır (rezerv edildi)
            </label>
            {reservedLines.some((l) => l.qty > l.available) ? (
              <div className="card error-card">
                <div className="error-title">Eksik Stok</div>
                <div className="error-message">
                  Bazı kalemler stokta yetersiz. Sipariş bekleniyor olarak işaretlenecek:
                </div>
                <ul className="text-muted" style={{ marginLeft: 16 }}>
                  {reservedLines
                    .filter((l) => l.qty > l.available)
                    .map((l) => (
                      <li key={l.id}>
                        {l.name} ({l.sku}) — Talep: {l.qty} / Mevcut: {l.available}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <button
              className="btn btn-primary"
              type="button"
              disabled={actionLoading || reservedLines.length === 0}
              onClick={() =>
                act(async () => {
                  const payload = {
                    ready: inputs.stockReady,
                    purchaseNotes:
                      inputs.stockNote ||
                      reservedLines
                        .map((l) => `${l.name} (${l.sku}) - ${l.qty} ${l.unit || ''} (mevcut ${l.available})`)
                        .join(' | '),
                    items: reservedLines,
                    pending: reservedLines
                      .filter((l) => l.qty > l.available)
                      .map((l) => ({ ...l, missing: l.qty - l.available })),
                  };
                  const result = await updateStockStatus(job.id, payload);
                  // Mock/local veri tutarlılığı için stokları güncelle
                  applyLocalStockReservation(reservedLines, {
                    ready: inputs.stockReady,
                    note: payload.purchaseNotes,
                    jobId: job.id,
                  });
                  if (payload.pending.length > 0) {
                    const po = createLocalPurchaseOrders(job.id, payload.pending);
                    applyLocalJobPatch(job.id, { pendingPO: payload.pending });
                    setPendingPO(payload.pending);
                    await pushLog('stock_pending', 'Eksik stok için sipariş bekleniyor', {
                      pending: payload.pending,
                      poId: po?.id,
                    });
                  } else {
                    applyLocalJobPatch(job.id, { pendingPO: [] });
                    setPendingPO([]);
                  }
                  setStockItems((prev) =>
                    prev.map((item) => {
                      const line = reservedLines.find((l) => l.id === item.id);
                      if (!line) return item;
                      const next = { ...item };
                      if (inputs.stockReady) {
                        next.onHand = Math.max(0, (next.onHand || 0) - line.qty);
                      } else {
                        next.reserved = (next.reserved || 0) + line.qty;
                      }
                      next.available = Math.max(0, (next.onHand || 0) - (next.reserved || 0));
                      return next;
                    })
                  );
                  setReservedLines([]);
                  return result;
                })
              }
            >
              Rezervasyonu Kaydet
            </button>
          </div>
        </div>
      )}

      <Modal
        open={stockModalOpen}
        title="Stoktan Kalem Ekle"
        size="xlarge"
        onClose={() => {
          setStockModalOpen(false);
          setSelectedStock(null);
          setReserveQty(1);
          setStockQuery('');
          setStockSkuQuery('');
          setStockColorQuery('');
        }}
        actions={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setStockModalOpen(false)}>
              Kapat
            </button>
            <button className="btn btn-primary" type="button" onClick={addReservedLine} disabled={!selectedStock}>
              Ekle
            </button>
          </>
        }
      >
        <div className="filter-bar" style={{ marginBottom: 12 }}>
          <div className="filter-group">
            <label className="filter-label" htmlFor="stock-search-modal">
              Kalem Ara
            </label>
            <input
              id="stock-search-modal"
              className="filter-input"
              placeholder="Kalem adı, tedarikçi..."
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label" htmlFor="stock-sku-modal">
              Ürün Kodu
            </label>
            <input
              id="stock-sku-modal"
              className="filter-input"
              placeholder="SKU ara..."
              value={stockSkuQuery}
              onChange={(e) => setStockSkuQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label" htmlFor="stock-color-modal">
              Renk Kodu
            </label>
            <input
              id="stock-color-modal"
              className="filter-input"
              placeholder="Renk ara..."
              value={stockColorQuery}
              onChange={(e) => setStockColorQuery(e.target.value)}
            />
          </div>
        </div>

        {stockLoading ? (
          <Loader size="small" text="Stok listesi yükleniyor..." />
        ) : stockError ? (
          <div className="card error-card">
            <div className="error-title">Stok alınamadı</div>
            <div className="error-message">{stockError}</div>
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: 320, overflow: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Kalem</th>
                  <th>Kod</th>
                  <th>Renk</th>
                  <th>Durum</th>
                  <th>Mevcut</th>
                  <th>Tedarikçi</th>
                  <th>Seç</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-state-title">Kayıt yok</div>
                        <div className="empty-state-description">Arama kriterini değiştirin.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStock.slice(0, 30).map((item) => {
                    const statusBadge = stockStatus(item);
                    const isPicked = selectedStock?.id === item.id;
                    return (
                      <tr key={item.id} className={isPicked ? 'row-selected' : ''}>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td><span className="text-muted">{item.sku}</span></td>
                        <td><span className="badge badge-secondary">{item.color || '-'}</span></td>
                        <td>
                          <span className={`badge badge-${statusBadge.tone}`}>{statusBadge.label}</span>
                        </td>
                        <td>
                          <strong>{item.available}</strong> / {item.onHand}
                        </td>
                        <td className="text-muted">{item.supplier}</td>
                        <td>
                          <button
                            type="button"
                            className={`btn ${isPicked ? 'btn-primary' : 'btn-secondary'} btn-small`}
                            onClick={() => selectStock(item)}
                            disabled={item.available <= 0}
                          >
                            {isPicked ? '✓' : 'Seç'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {selectedStock && (
          <div className="card subtle-card" style={{ marginTop: 12, padding: 12 }}>
            <div className="metric-row" style={{ marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <strong>{selectedStock.name}</strong>
                <div className="text-muted">
                  Kod: {selectedStock.sku} · Renk: {selectedStock.color || '-'} · Mevcut: {selectedStock.available}
                </div>
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="reserve-qty-modal">Rezervasyon Miktarı</label>
              <input
                id="reserve-qty-modal"
                className="form-input"
                type="number"
                min="1"
                value={reserveQty}
                onChange={(e) => setReserveQty(Number(e.target.value))}
                style={{ maxWidth: 150 }}
              />
            </div>
          </div>
        )}
      </Modal>

      {isStageSelected('production') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Üretim / Montaj Hazırlık</h3>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 12 }}>
            <select
              className="form-select"
              value={inputs.productionStatus}
              onChange={(e) => setInputs((p) => ({ ...p, productionStatus: e.target.value }))}
            >
              <option value="URETIMDE">Üretimde</option>
              <option value="MONTAJA_HAZIR">Montaja Hazır</option>
              <option value="ANLASMADA">Anlaşmada (ileri tarih)</option>
            </select>
            {inputs.productionStatus === 'ANLASMADA' ? (
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div>
                  <label className="form-label">Anlaşma Tarihi</label>
                  <input
                    className="form-input"
                    type="date"
                    value={inputs.agreementDate}
                    onChange={(e) => setInputs((p) => ({ ...p, agreementDate: e.target.value }))}
                  />
                </div>
                <div className="text-muted" style={{ alignSelf: 'center' }}>
                  Tarih geldiğinde üretime geçilmesi için uyarı gösterilecek.
                </div>
              </div>
            ) : null}
            <button
              className="btn btn-primary"
              type="button"
              disabled={actionLoading}
              onClick={() => {
                const payload = { status: inputs.productionStatus };
                if (inputs.productionStatus === 'ANLASMADA' && inputs.agreementDate) {
                  payload.agreementDate = new Date(inputs.agreementDate).toISOString().slice(0, 10);
                }
                // Skip auto-advance only for intermediate statuses (URETIMDE, ANLASMADA)
                const skipAdvance = inputs.productionStatus === 'URETIMDE' || inputs.productionStatus === 'ANLASMADA';
                return act(() => updateProductionStatus(job.id, payload), {
                  production: payload.status,
                  agreement: payload.agreementDate || null,
                  skipAdvance,
                });
              }}
            >
              Güncelle
            </button>
            {pendingPO.length > 0 ? (
              <div className="card subtle-card">
                <div className="card-header">
                  <h4 className="card-title">Sipariş Bekleniyor</h4>
                  <span className="badge badge-warning">{pendingPO.length} kalem</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pendingPO.map((p) => (
                    <div key={p.id} className="metric-row" style={{ alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <strong>{p.name}</strong> <span className="text-muted">({p.sku})</span>
                        <div className="text-muted">
                          Talep: {p.qty} · Mevcut: {p.available} · Eksik: {p.missing || p.qty}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-muted">
                    Eksik kalemler geldiğinde rezervasyonu tamamlayıp üretime geçebilirsiniz.
                  </div>
                </div>
              </div>
            ) : null}
            {inputs.productionStatus === 'ANLASMADA' ? (
              <div className="card subtle-card">
                <div className="metric-row">
                  <span className="metric-label">Anlaşma Tarihi</span>
                  <span className="metric-value">{inputs.agreementDate || '—'}</span>
                </div>
                <div className="text-muted">
                  Tarih yaklaştığında üretime geçmek için hatırlatma bekleniyor.
                </div>
                {!inputs.agreementDate ? (
                  <div className="error-text" style={{ marginTop: 8 }}>Anlaşmada seçildiğinde tarih girmeniz önerilir.</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {isStageSelected('assembly') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Montaj Termin</h3>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 12 }}>
            <div className="grid grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Montaj Tarihi</label>
            <input
              className="form-input"
                  type="date"
                  value={inputs.assemblyDate?.split('T')[0] || inputs.assemblyDate || ''}
                  onChange={(e) => {
                    const time = inputs.assemblyTime || '09:00';
                    setInputs((p) => ({ ...p, assemblyDate: e.target.value ? `${e.target.value}T${time}` : '' }));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Saat</label>
            <input
              className="form-input"
                  type="time"
                  value={inputs.assemblyDate?.includes('T') ? inputs.assemblyDate.split('T')[1]?.slice(0, 5) : '09:00'}
                  onChange={(e) => {
                    const date = inputs.assemblyDate?.split('T')[0] || '';
                    if (date) {
                      setInputs((p) => ({ ...p, assemblyDate: `${date}T${e.target.value}` }));
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ekip</label>
                <input
                  className="form-input"
                  placeholder="Montaj ekibi"
              value={inputs.assemblyTeam}
              onChange={(e) => setInputs((p) => ({ ...p, assemblyTeam: e.target.value }))}
            />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Montaj Notu</label>
            <textarea
              className="form-textarea"
                placeholder="Montaj notu, adres detayları vb."
              value={inputs.assemblyNote}
              onChange={(e) => setInputs((p) => ({ ...p, assemblyNote: e.target.value }))}
            />
            </div>
            <div className="btn-group" style={{ gap: 8 }}>
            <button
                className="btn btn-secondary"
              type="button"
              disabled={actionLoading}
              onClick={() =>
                act(() =>
                  scheduleAssembly(job.id, {
                    date: inputs.assemblyDate,
                    note: inputs.assemblyNote,
                    team: inputs.assemblyTeam,
                  })
                )
              }
            >
                Termin Kaydet
              </button>
              <button
                className="btn btn-success"
                type="button"
                disabled={actionLoading}
                onClick={() =>
                  act(async () => {
                    const result = await completeAssembly(job.id, {
                      date: inputs.assemblyDate,
                      note: inputs.assemblyNote,
                      team: inputs.assemblyTeam,
                      completed: true,
                    });
                    await pushLog('assembly.completed', 'Montaj tamamlandı', { team: inputs.assemblyTeam });
                    return result;
                  })
                }
              >
                ✓ Montaj Bitti
            </button>
            </div>
          </div>
        </div>
      )}

      {isStageSelected('finance') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Son Mutabakat (Kapanış)</h3>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            {/* Teklif Özeti */}
            <div className="card subtle-card">
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h4 className="card-title" style={{ fontSize: 14 }}>Finansal Özet</h4>
              </div>
              <div className="card-body" style={{ padding: 16 }}>
                <div className="grid grid-2" style={{ gap: 16 }}>
                  <div>
                    <div className="metric-row">
                      <span className="metric-label">Teklif Tutarı</span>
                      <span className="metric-value">{formatNumber(offerTotalValue)} ₺</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Ön Alınan</span>
                      <span className="metric-value">
                        {formatNumber(
                          Number(job.approval?.paymentPlan?.cash || 0) +
                          Number(job.approval?.paymentPlan?.card || 0) +
                          Number(job.approval?.paymentPlan?.cheque || 0)
                        )} ₺
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Teslimat Sonrası</span>
                      <span className="metric-value">{formatNumber(Number(job.approval?.paymentPlan?.afterDelivery || 0))} ₺</span>
                    </div>
                  </div>
                  <div>
                    <div className="metric-row">
                      <span className="metric-label">Beklenen Toplam</span>
                      <span className="metric-value">
                        {formatNumber(
                          Number(job.approval?.paymentPlan?.cash || 0) +
                          Number(job.approval?.paymentPlan?.card || 0) +
                          Number(job.approval?.paymentPlan?.cheque || 0) +
                          Number(job.approval?.paymentPlan?.afterDelivery || 0)
                        )} ₺
                      </span>
                    </div>
                    {offerTotalValue !== (
                      Number(job.approval?.paymentPlan?.cash || 0) +
                      Number(job.approval?.paymentPlan?.card || 0) +
                      Number(job.approval?.paymentPlan?.cheque || 0) +
                      Number(job.approval?.paymentPlan?.afterDelivery || 0)
                    ) && (
                      <div className="badge badge-warning" style={{ marginTop: 8 }}>
                        Ödeme planı teklif tutarıyla eşleşmiyor!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Gerçekleşen Tahsilat */}
            <div className="card subtle-card">
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <h4 className="card-title" style={{ fontSize: 14 }}>İş Bitiminde Alınan Tutar</h4>
              </div>
              <div className="card-body" style={{ padding: 16 }}>
                <div className="grid grid-4" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nakit</label>
                    <CurrencyInput
                      placeholder="0"
                      value={inputs.financeCash}
                      onChange={(val) => setInputs((p) => ({ ...p, financeCash: val }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kredi Kartı</label>
                    <CurrencyInput
                      placeholder="0"
                      value={inputs.financeCard}
                      onChange={(val) => setInputs((p) => ({ ...p, financeCard: val }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Çek</label>
                    <CurrencyInput
                      placeholder="0"
                      value={inputs.financeCheque}
                      onChange={(val) => setInputs((p) => ({ ...p, financeCheque: val }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Toplam Alınan</label>
                    <div className="form-input" style={{ background: '#f9fafb', display: 'flex', alignItems: 'center' }}>
                      {formatNumber(
                        Number(inputs.financeCash || 0) +
                        Number(inputs.financeCard || 0) +
                        Number(inputs.financeCheque || 0)
                      )} ₺
                    </div>
                  </div>
                </div>

                {/* Bakiye Kontrolü */}
                {(() => {
                  const preReceived =
                    Number(job.approval?.paymentPlan?.cash || 0) +
                    Number(job.approval?.paymentPlan?.card || 0) +
                    Number(job.approval?.paymentPlan?.cheque || 0);
                  const finishReceived =
                    Number(inputs.financeCash || 0) +
                    Number(inputs.financeCard || 0) +
                    Number(inputs.financeCheque || 0);
                  const discount = Number(inputs.discountAmount || 0);
                  const total = preReceived + finishReceived + discount;
                  const diff = offerTotalValue - total;
                  
                  return (
                    <div style={{ marginTop: 12, padding: 12, background: diff === 0 ? '#ecfdf5' : '#fef2f2', borderRadius: 8 }}>
                      <div className="metric-row">
                        <span className="metric-label">Ön Alınan</span>
                        <span>{formatNumber(preReceived)} ₺</span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-label">Şimdi Alınan</span>
                        <span>{formatNumber(finishReceived)} ₺</span>
                      </div>
                      {discount > 0 && (
                        <div className="metric-row">
                          <span className="metric-label">İskonto</span>
                          <span>{formatNumber(discount)} ₺</span>
                        </div>
                      )}
                      <hr style={{ margin: '8px 0', borderColor: 'rgba(0,0,0,0.1)' }} />
                      <div className="metric-row">
                        <span className="metric-label" style={{ fontWeight: 700 }}>Toplam</span>
                        <span style={{ fontWeight: 700 }}>{formatNumber(total)} ₺</span>
                      </div>
                      <div className="metric-row" style={{ color: diff === 0 ? '#059669' : '#dc2626' }}>
                        <span className="metric-label">Bakiye Farkı</span>
                        <span style={{ fontWeight: 700 }}>{diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)} ₺</span>
                      </div>
                      {diff !== 0 && (
                        <div className="badge badge-danger" style={{ marginTop: 8 }}>
                          {diff > 0 ? 'Eksik tahsilat!' : 'Fazla tahsilat!'}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* İskonto */}
            <div className="grid grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">İskonto Tutarı (opsiyonel)</label>
                <CurrencyInput
                  placeholder="0"
                  value={inputs.discountAmount}
                  onChange={(val) => setInputs((p) => ({ ...p, discountAmount: val }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">İskonto Notu</label>
            <input
              className="form-input"
                  placeholder="İskonto sebebi"
              value={inputs.discountNote}
              onChange={(e) => setInputs((p) => ({ ...p, discountNote: e.target.value }))}
            />
              </div>
            </div>

            <button
              className="btn btn-success"
              type="button"
              disabled={actionLoading}
              onClick={() =>
                act(() =>
                  closeFinance(job.id, {
                    total: Number(inputs.financeTotal || offerTotalValue),
                    payments: {
                      cash: Number(inputs.financeCash || 0),
                      card: Number(inputs.financeCard || 0),
                      cheque: Number(inputs.financeCheque || 0),
                    },
                    discount:
                      Number(inputs.discountAmount || 0) > 0
                        ? { amount: Number(inputs.discountAmount || 0), note: inputs.discountNote || '' }
                        : null,
                  })
                )
              }
            >
              İşi Kapat (Bakiye 0 olmalı)
            </button>
          </div>
        </div>
      )}

      {/* SERVİS AŞAMALARI */}
      {isServiceJob && isStageSelected('service_schedule') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📅 Servis Randevusu</h3>
            <span className="badge badge-warning">Randevu Belirlenmedi</span>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            {/* Müşteri Bilgisi */}
            <div className="card subtle-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{job.title}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>İş Kodu</div>
                  <div style={{ fontWeight: 600 }}>{job.id}</div>
                </div>
              </div>
            </div>

            {/* Randevu Bilgileri */}
            <div className="grid grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">📅 Randevu Tarihi *</label>
                <input
                  className="form-input"
                  type="date"
                  value={inputs.serviceAppointmentDate || ''}
                  onChange={(e) => setInputs((p) => ({ ...p, serviceAppointmentDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">⏰ Saat *</label>
                <input
                  className="form-input"
                  type="time"
                  value={inputs.serviceAppointmentTime || '10:00'}
                  onChange={(e) => setInputs((p) => ({ ...p, serviceAppointmentTime: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">💰 Sabit Servis Ücreti (₺) *</label>
                <CurrencyInput
                  placeholder="Örn: 500"
                  value={inputs.serviceFixedFee || ''}
                  onChange={(val) => setInputs((p) => ({ ...p, serviceFixedFee: val }))}
                />
              </div>
            </div>

            {/* Müşteri Notu */}
            <div className="form-group">
              <label className="form-label">📝 Müşteri Talebi / Adres / Not</label>
              <textarea
                className="form-textarea"
                placeholder="Müşterinin şikayeti, servis adresi, özel notlar..."
                rows={3}
                value={inputs.serviceNote || ''}
                onChange={(e) => setInputs((p) => ({ ...p, serviceNote: e.target.value }))}
              />
            </div>

            {/* Uyarı */}
            {(!inputs.serviceAppointmentDate || !inputs.serviceFixedFee) && (
              <div style={{ padding: 12, background: 'var(--color-warning-bg)', borderRadius: 8, fontSize: 13 }}>
                ⚠️ Randevu tarihi ve servis ücreti zorunludur.
              </div>
            )}

            {/* Tek Buton - Kaydet ve İlerle */}
            <button
              className="btn btn-success"
              type="button"
              style={{ padding: '14px 24px', fontSize: 16 }}
              disabled={actionLoading || !inputs.serviceAppointmentDate || !inputs.serviceFixedFee}
              onClick={() =>
                act(
                  () =>
                    updateJobStatus(job.id, {
                      status: 'SERVIS_RANDEVULU',
                      service: {
                        ...job.service,
                        fixedFee: Number(inputs.serviceFixedFee || 0),
                        note: inputs.serviceNote,
                        visits: [{
                          id: 1,
                          appointmentDate: inputs.serviceAppointmentDate,
                          appointmentTime: inputs.serviceAppointmentTime || '10:00',
                          status: 'scheduled'
                        }]
                      },
                    }),
                  { transition: 'SERVIS_RANDEVULU' }
                )
              }
            >
              ✓ Randevuyu Kaydet ve Onayla
            </button>
          </div>
        </div>
      )}

      {/* SERVİS BAŞLAT - Gidiş Kaydı */}
      {isServiceJob && isStageSelected('service_start') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🚗 Servise Başla</h3>
            <span className="badge badge-primary">Randevu Alındı</span>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            {/* Randevu Bilgileri */}
            <div className="card subtle-card" style={{ padding: 16 }}>
              <div className="grid grid-3" style={{ gap: 16 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                  <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 12 }}>RANDEVU</div>
                  <div style={{ fontWeight: 600 }}>
                    {(() => {
                      const currentVisit = job.service?.visits?.find(v => v.status === 'scheduled');
                      if (currentVisit) {
                        return `${new Date(currentVisit.appointmentDate).toLocaleDateString('tr-TR')} ${currentVisit.appointmentTime}`;
                      }
                      return '-';
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 12 }}>SABİT ÜCRET</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(job.service?.fixedFee || 0)} ₺</div>
                </div>
              </div>
              {job.service?.note && (
                <div style={{ marginTop: 12, padding: 10, background: 'var(--color-warning-bg)', borderRadius: 6 }}>
                  <strong>Not:</strong> {job.service.note}
                </div>
              )}
            </div>

            {/* Gidiş Bilgileri */}
            <div style={{ padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 12 }}>
              <h4 style={{ marginBottom: 12 }}>⏱️ Gidiş Bilgilerini Girin</h4>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Gidiş Tarihi *</label>
                  <input
                    className="form-input"
                    type="date"
                    value={inputs.serviceVisitDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setInputs((p) => ({ ...p, serviceVisitDate: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gidiş Saati *</label>
                  <input
                    className="form-input"
                    type="time"
                    value={inputs.serviceVisitTime || new Date().toTimeString().slice(0, 5)}
                    onChange={(e) => setInputs((p) => ({ ...p, serviceVisitTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <button
              className="btn btn-success"
              type="button"
              style={{ padding: '14px 24px', fontSize: 16 }}
              disabled={actionLoading}
              onClick={() => {
                const visits = [...(job.service?.visits || [])];
                const currentIdx = visits.findIndex(v => v.status === 'scheduled');
                if (currentIdx >= 0) {
                  visits[currentIdx] = {
                    ...visits[currentIdx],
                    visitedAt: `${inputs.serviceVisitDate || new Date().toISOString().split('T')[0]}T${inputs.serviceVisitTime || new Date().toTimeString().slice(0, 5)}`,
                    status: 'in_progress'
                  };
                }
                act(
                  () =>
                    updateJobStatus(job.id, {
                      status: 'SERVIS_YAPILIYOR',
                      service: {
                        ...job.service,
                        visits
                      },
                    }),
                  { transition: 'SERVIS_YAPILIYOR' }
                );
              }}
            >
              🚗 Servise Başla
            </button>
          </div>
        </div>
      )}

      {isServiceJob && isStageSelected('service_work') && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🛠️ Servis Çalışması</h3>
            <span className={`badge badge-${job.status === 'SERVIS_DEVAM_EDIYOR' ? 'warning' : 'primary'}`}>
              {job.status === 'SERVIS_DEVAM_EDIYOR' ? 'Devam Ziyareti' : `Ziyaret #${job.service?.visits?.length || 1}`}
            </span>
          </div>
          <div className="card-body grid grid-1" style={{ gap: 16 }}>
            
            {/* Önceki Ziyaretler */}
            {job.service?.visits?.filter(v => v.status === 'completed').length > 0 && (
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📜 Önceki Ziyaretler</h4>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {job.service.visits.filter(v => v.status === 'completed').map((visit, idx) => (
                    <div key={visit.id} style={{ 
                      padding: '12px 16px', 
                      borderBottom: '1px solid var(--color-border)',
                      background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>#{visit.id}</strong> - {new Date(visit.appointmentDate).toLocaleDateString('tr-TR')} {visit.appointmentTime}
                        </div>
                        <span className="badge badge-success">✓ Tamamlandı</span>
                      </div>
                      {visit.visitedAt && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                          Gidiş: {new Date(visit.visitedAt).toLocaleString('tr-TR')}
                        </div>
                      )}
                      {visit.workNote && (
                        <div style={{ marginTop: 8, fontSize: 13 }}>
                          <strong>İşlem:</strong> {visit.workNote}
                        </div>
                      )}
                      {visit.materials && (
                        <div style={{ marginTop: 4, fontSize: 13 }}>
                          <strong>Malzeme:</strong> {visit.materials}
                        </div>
                      )}
                      {visit.extraCost > 0 && (
                        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--color-primary)' }}>
                          <strong>Ekstra:</strong> {formatNumber(visit.extraCost)} ₺
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mevcut Ziyaret - Devam Durumu için Yeni Randevu */}
            {job.status === 'SERVIS_DEVAM_EDIYOR' && (
              <div className="card" style={{ border: '2px solid var(--color-warning)', background: 'var(--color-warning-bg)' }}>
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>📅 Yeni Randevu Belirle</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-3" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Randevu Tarihi *</label>
                      <input
                        className="form-input"
                        type="date"
                        value={inputs.serviceNewAppointmentDate || ''}
                        onChange={(e) => setInputs((p) => ({ ...p, serviceNewAppointmentDate: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Saat *</label>
                      <input
                        className="form-input"
                        type="time"
                        value={inputs.serviceNewAppointmentTime || '10:00'}
                        onChange={(e) => setInputs((p) => ({ ...p, serviceNewAppointmentTime: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gidiş Tarihi</label>
                      <input
                        className="form-input"
                        type="date"
                        value={inputs.serviceVisitDate || ''}
                        onChange={(e) => setInputs((p) => ({ ...p, serviceVisitDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label">Not</label>
                    <input
                      className="form-input"
                      placeholder="Eksik parça, ilave işlem vb..."
                      value={inputs.serviceNewAppointmentNote || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, serviceNewAppointmentNote: e.target.value }))}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    type="button"
                    style={{ marginTop: 12 }}
                    disabled={actionLoading || !inputs.serviceNewAppointmentDate}
                    onClick={() => {
                      const visits = [...(job.service?.visits || [])];
                      const newVisit = {
                        id: visits.length + 1,
                        appointmentDate: inputs.serviceNewAppointmentDate,
                        appointmentTime: inputs.serviceNewAppointmentTime || '10:00',
                        note: inputs.serviceNewAppointmentNote,
                        visitedAt: inputs.serviceVisitDate ? `${inputs.serviceVisitDate}T${inputs.serviceVisitTime || '10:00'}` : null,
                        status: inputs.serviceVisitDate ? 'in_progress' : 'scheduled'
                      };
                      visits.push(newVisit);
                      act(
                        () =>
                          updateJobStatus(job.id, {
                            status: inputs.serviceVisitDate ? 'SERVIS_YAPILIYOR' : 'SERVIS_RANDEVULU',
                            service: { ...job.service, visits }
                          }),
                        { transition: inputs.serviceVisitDate ? 'SERVIS_YAPILIYOR' : 'SERVIS_RANDEVULU' }
                      );
                    }}
                  >
                    {inputs.serviceVisitDate ? '🚗 Randevuyu Kaydet ve Servise Git' : '📅 Randevuyu Kaydet'}
                  </button>
                </div>
              </div>
            )}

            {/* Aktif Ziyaret Detayları */}
            {job.status === 'SERVIS_YAPILIYOR' && (
              <>
                {/* Servis Bilgileri Özeti */}
                <div className="card subtle-card" style={{ padding: 16 }}>
                  <div className="grid grid-3" style={{ gap: 16 }}>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>MÜŞTERİ</div>
                      <div style={{ fontWeight: 600 }}>{job.customerName}</div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>SABİT ÜCRET</div>
                      <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatNumber(job.service?.fixedFee || 0)} ₺</div>
                    </div>
                    <div>
                      <div className="text-muted" style={{ fontSize: 12 }}>TOPLAM ZİYARET</div>
                      <div style={{ fontWeight: 600 }}>{job.service?.visits?.length || 1}</div>
                    </div>
                  </div>
                  {job.service?.note && (
                    <div style={{ marginTop: 12, padding: 10, background: 'var(--color-warning-bg)', borderRadius: 6 }}>
                      <strong>Müşteri Talebi:</strong> {job.service.note}
                    </div>
                  )}
                </div>

                {/* Yapılan İşlem */}
                <div className="form-group">
                  <label className="form-label">📝 Yapılan İşlem Detayı *</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Servis sırasında yapılan işlemleri detaylı yazın..."
                    rows={3}
                    value={inputs.serviceWorkNote || ''}
                    onChange={(e) => setInputs((p) => ({ ...p, serviceWorkNote: e.target.value }))}
                  />
                </div>

                {/* Malzeme ve Ekstra Maliyet */}
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">🔩 Kullanılan Malzemeler</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Malzeme listesi..."
                      rows={2}
                      value={inputs.serviceMaterials || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, serviceMaterials: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">💰 Bu Ziyaret Ekstra Malzeme Tutarı (₺)</label>
                    <CurrencyInput
                      placeholder="0"
                      value={inputs.serviceExtraCost || ''}
                      onChange={(val) => setInputs((p) => ({ ...p, serviceExtraCost: val }))}
                    />
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                      Sabit ücrete ek malzeme tutarı
                    </div>
                  </div>
                </div>

                {/* Fotoğraflar */}
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>📷 Fotoğraflar (İsteğe Bağlı)</h4>
                    {uploadingDoc && <Loader size="small" />}
                  </div>
                  <div className="card-body" style={{ padding: 16 }}>
                    <div className="grid grid-2" style={{ gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label">Öncesi</label>
                        <div className="file-upload-zone">
                          <input
                            type="file"
                            id="service-before-photo"
                            accept=".jpg,.jpeg,.png,.gif,.webp"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                await handleDocUpload(file, 'servis_oncesi', 'Servis Öncesi');
                                e.target.value = '';
                              }
                            }}
                          />
                          <label htmlFor="service-before-photo" className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                            📷 Seç
                          </label>
                          {jobDocuments.some(d => d.type === 'servis_oncesi') && (
                            <span className="badge badge-success" style={{ marginLeft: 8 }}>✓</span>
                          )}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Sonrası</label>
                        <div className="file-upload-zone">
                          <input
                            type="file"
                            id="service-after-photo"
                            accept=".jpg,.jpeg,.png,.gif,.webp"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                await handleDocUpload(file, 'servis_sonrasi', 'Servis Sonrası');
                                e.target.value = '';
                              }
                            }}
                          />
                          <label htmlFor="service-after-photo" className="btn btn-secondary btn-small" style={{ cursor: 'pointer' }}>
                            📷 Seç
                          </label>
                          {jobDocuments.some(d => d.type === 'servis_sonrasi') && (
                            <span className="badge badge-success" style={{ marginLeft: 8 }}>✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Butonlar */}
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    className="btn btn-warning"
                    type="button"
                    style={{ flex: 1 }}
                    disabled={actionLoading || !inputs.serviceWorkNote}
                    onClick={() => {
                      const visits = [...(job.service?.visits || [])];
                      const currentIdx = visits.findIndex(v => v.status === 'in_progress');
                      if (currentIdx >= 0) {
                        visits[currentIdx] = {
                          ...visits[currentIdx],
                          workNote: inputs.serviceWorkNote,
                          materials: inputs.serviceMaterials,
                          extraCost: Number(inputs.serviceExtraCost || 0),
                          status: 'completed',
                          completedAt: new Date().toISOString()
                        };
                      }
                      act(
                        () =>
                          updateJobStatus(job.id, {
                            status: 'SERVIS_DEVAM_EDIYOR',
                            service: { ...job.service, visits }
                          }),
                        { transition: 'SERVIS_DEVAM_EDIYOR' }
                      );
                    }}
                  >
                    🔄 Servis Devam Ediyor (Yeni Randevu)
                  </button>
                  <button
                    className="btn btn-success"
                    type="button"
                    style={{ flex: 1 }}
                    disabled={actionLoading || !inputs.serviceWorkNote}
                    onClick={() => {
                      const visits = [...(job.service?.visits || [])];
                      const currentIdx = visits.findIndex(v => v.status === 'in_progress');
                      if (currentIdx >= 0) {
                        visits[currentIdx] = {
                          ...visits[currentIdx],
                          workNote: inputs.serviceWorkNote,
                          materials: inputs.serviceMaterials,
                          extraCost: Number(inputs.serviceExtraCost || 0),
                          status: 'completed',
                          completedAt: new Date().toISOString()
                        };
                      }
                      // Toplam ekstra maliyet hesapla
                      const totalExtraCost = visits.reduce((sum, v) => sum + (v.extraCost || 0), 0);
                      act(
                        () =>
                          updateJobStatus(job.id, {
                            status: 'SERVIS_ODEME_BEKLIYOR',
                            service: { 
                              ...job.service, 
                              visits,
                              totalExtraCost,
                              totalCost: (job.service?.fixedFee || 0) + totalExtraCost
                            }
                          }),
                        { transition: 'SERVIS_ODEME_BEKLIYOR' }
                      );
                    }}
                  >
                    💰 Ödemeye Geç
                  </button>
                </div>
                {!inputs.serviceWorkNote && (
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    ⚠️ Devam etmek için "Yapılan İşlem Detayı" alanını doldurun.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isServiceJob && isStageSelected('service_payment') && (() => {
        // Hesaplamalar
        const fixedFee = job.service?.fixedFee || 0;
        const totalExtraCost = job.service?.totalExtraCost || 0;
        const totalCost = job.service?.totalCost || (fixedFee + totalExtraCost);
        
        const paymentCash = Number(inputs.servicePaymentCash || 0);
        const paymentCard = Number(inputs.servicePaymentCard || 0);
        const paymentTransfer = Number(inputs.servicePaymentTransfer || 0);
        const discount = Number(inputs.serviceDiscount || 0);
        const totalReceived = paymentCash + paymentCard + paymentTransfer + discount;
        const balance = totalCost - totalReceived;
        
        return (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">💰 Servis Ödeme</h3>
            </div>
            <div className="card-body grid grid-1" style={{ gap: 16 }}>
              
              {/* Ziyaret Özeti */}
              {job.service?.visits?.length > 0 && (
                <div className="card subtle-card">
                  <div className="card-header" style={{ padding: '12px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 14 }}>📋 Ziyaret Özeti ({job.service.visits.length} ziyaret)</h4>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {job.service.visits.filter(v => v.status === 'completed').map((visit) => (
                      <div key={visit.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <strong>#{visit.id}</strong> - {new Date(visit.appointmentDate).toLocaleDateString('tr-TR')}
                            <div className="text-muted" style={{ fontSize: 12 }}>{visit.workNote}</div>
                          </div>
                          {visit.extraCost > 0 && (
                            <div style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                              +{formatNumber(visit.extraCost)} ₺
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Tutar Özeti */}
              <div className="card" style={{ background: 'var(--color-bg-secondary)', border: '2px solid var(--color-border)' }}>
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sabit Servis Ücreti</span>
                      <span style={{ fontWeight: 600 }}>{formatNumber(fixedFee)} ₺</span>
                    </div>
                    {totalExtraCost > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Ekstra Malzeme Toplamı</span>
                        <span style={{ fontWeight: 600 }}>{formatNumber(totalExtraCost)} ₺</span>
                      </div>
                    )}
                    <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 18, fontWeight: 700 }}>TOPLAM</span>
                        <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>{formatNumber(totalCost)} ₺</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Ödeme Kutucukları */}
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>💳 Ödeme Bilgileri</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="grid grid-3" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">💵 Nakit</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.servicePaymentCash || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, servicePaymentCash: val }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">💳 Kredi Kartı</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.servicePaymentCard || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, servicePaymentCard: val }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">🏦 Havale/EFT</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.servicePaymentTransfer || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, servicePaymentTransfer: val }))}
                      />
                    </div>
                  </div>
                  
                  {/* Alınan Toplam */}
                  <div style={{ marginTop: 16, padding: 12, background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Alınan Toplam:</span>
                      <span style={{ fontWeight: 600, fontSize: 18 }}>{formatNumber(paymentCash + paymentCard + paymentTransfer)} ₺</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* İskonto */}
              <div className="card subtle-card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 14 }}>🏷️ İskonto (İsteğe Bağlı)</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  {balance > 0 && discount === 0 && (
                    <div style={{ marginBottom: 12, padding: 10, background: 'var(--color-warning-bg)', borderRadius: 6, color: 'var(--color-warning-dark)' }}>
                      ⚠️ Toplam tutara {formatNumber(balance)} ₺ eksik. İskonto yapılacaksa aşağıya girin.
                    </div>
                  )}
                  <div className="grid grid-2" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">İskonto Tutarı {balance > 0 && discount === 0 ? '*' : ''}</label>
                      <CurrencyInput
                        placeholder="0"
                        value={inputs.serviceDiscount || ''}
                        onChange={(val) => setInputs((p) => ({ ...p, serviceDiscount: val }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">İskonto Açıklaması {discount > 0 ? '*' : ''}</label>
                      <input
                        className="form-input"
                        placeholder="Örn: Sadık müşteri indirimi"
                        value={inputs.serviceDiscountNote || ''}
                        onChange={(e) => setInputs((p) => ({ ...p, serviceDiscountNote: e.target.value }))}
                      />
                    </div>
                  </div>
                  {discount > 0 && !inputs.serviceDiscountNote && (
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 8, color: 'var(--color-danger)' }}>
                      ⚠️ İskonto tutarı girildiyse açıklama zorunludur.
                    </div>
                  )}
                </div>
              </div>
              
              {/* Bakiye Durumu */}
              <div style={{ 
                padding: 16, 
                borderRadius: 12, 
                background: balance === 0 ? 'var(--color-success-bg)' : balance > 0 ? 'var(--color-warning-bg)' : 'var(--color-danger-bg)',
                border: `2px solid ${balance === 0 ? 'var(--color-success)' : balance > 0 ? 'var(--color-warning)' : 'var(--color-danger)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>Bakiye:</span>
                  <span style={{ 
                    fontWeight: 700, 
                    fontSize: 20,
                    color: balance === 0 ? 'var(--color-success)' : balance > 0 ? 'var(--color-warning-dark)' : 'var(--color-danger)'
                  }}>
                    {balance === 0 ? '✓ 0 ₺ (Tamam)' : `${formatNumber(balance)} ₺`}
                  </span>
                </div>
              </div>
              
              {/* Butonlar */}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  className="btn btn-warning"
                  type="button"
                  style={{ flex: 1 }}
                  disabled={actionLoading}
                  onClick={() =>
                    act(
                      () =>
                        updateJobStatus(job.id, {
                          status: 'SERVIS_DEVAM_EDIYOR',
                          service: {
                            ...job.service,
                            payments: {
                              cash: paymentCash,
                              card: paymentCard,
                              transfer: paymentTransfer,
                            },
                            discount: discount > 0 ? { amount: discount, note: inputs.serviceDiscountNote } : null,
                          },
                        }),
                      { transition: 'SERVIS_DEVAM_EDIYOR' }
                    )
                  }
                >
                  🔄 Servis Devam Ediyor
                </button>
                <button
                  className="btn btn-success"
                  type="button"
                  style={{ flex: 1 }}
                  disabled={actionLoading || balance !== 0 || (discount > 0 && !inputs.serviceDiscountNote)}
                  onClick={() =>
                    act(
                      () =>
                        updateJobStatus(job.id, {
                          status: 'SERVIS_KAPALI',
                          service: {
                            ...job.service,
                            payments: {
                              cash: paymentCash,
                              card: paymentCard,
                              transfer: paymentTransfer,
                            },
                            discount: discount > 0 ? { amount: discount, note: inputs.serviceDiscountNote } : null,
                            paymentStatus: 'paid',
                            completedAt: new Date().toISOString(),
                          },
                        }),
                      { transition: 'SERVIS_KAPALI' }
                    )
                  }
                >
                  ✓ Servisi Kapat
                </button>
              </div>
              
              {balance !== 0 && (
                <div className="text-muted" style={{ fontSize: 12, color: 'var(--color-danger)' }}>
                  ⚠️ Servisi kapatmak için bakiye 0 olmalı. Eksik: {formatNumber(balance)} ₺
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {isServiceJob && isStageSelected('service_done') && (() => {
        const payments = job.service?.payments || {};
        const totalPaid = (payments.cash || 0) + (payments.card || 0) + (payments.transfer || 0);
        const discount = job.service?.discount?.amount || 0;
        
        return (
          <div className="card" style={{ border: '2px solid var(--color-success)' }}>
            <div className="card-header" style={{ background: 'var(--color-success)', color: 'white' }}>
              <h3 className="card-title" style={{ color: 'white' }}>✓ Servis Tamamlandı</h3>
              <span className="badge" style={{ background: 'white', color: 'var(--color-success)' }}>
                {job.service?.paymentStatus === 'paid' ? 'Ödendi' : 'Ödeme Bekliyor'}
              </span>
            </div>
            <div className="card-body" style={{ padding: 20 }}>
              {/* Özet Kartları */}
              <div className="grid grid-4" style={{ gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 16, background: 'var(--color-success-bg)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>TOPLAM</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-success)' }}>
                    {formatNumber(job.service?.totalCost || 0)} ₺
                  </div>
                </div>
                <div style={{ padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>ZİYARET</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    {job.service?.visits?.length || 1}
                  </div>
                </div>
                <div style={{ padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>ALINAN</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    {formatNumber(totalPaid)} ₺
                  </div>
                </div>
                <div style={{ padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-light)', marginBottom: 4 }}>TARİH</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {job.service?.completedAt ? new Date(job.service.completedAt).toLocaleDateString('tr-TR') : '-'}
                  </div>
                </div>
              </div>

              {/* Müşteri & İş Bilgisi */}
              <div className="card subtle-card" style={{ marginBottom: 16 }}>
                <div className="card-header" style={{ padding: '10px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 13 }}>👤 Müşteri Bilgisi</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{job.customerName}</div>
                      <div className="text-muted">{job.title}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="text-muted" style={{ fontSize: 11 }}>İş Kodu</div>
                      <div style={{ fontWeight: 600 }}>{job.id}</div>
                    </div>
                  </div>
                  {job.service?.note && (
                    <div style={{ marginTop: 12, padding: 10, background: 'var(--color-bg-secondary)', borderRadius: 6, fontSize: 13 }}>
                      <strong>Müşteri Talebi:</strong> {job.service.note}
                    </div>
                  )}
                </div>
              </div>

              {/* Ziyaret Geçmişi */}
              {job.service?.visits?.length > 0 && (
                <div className="card subtle-card" style={{ marginBottom: 16 }}>
                  <div className="card-header" style={{ padding: '10px 16px' }}>
                    <h4 className="card-title" style={{ fontSize: 13 }}>📅 Ziyaret Geçmişi</h4>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {job.service.visits.map((visit, idx) => (
                      <div key={visit.id} style={{ 
                        padding: '12px 16px', 
                        borderBottom: idx < job.service.visits.length - 1 ? '1px solid var(--color-border)' : 'none',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <strong>#{visit.id}</strong>
                              <span className="badge badge-success" style={{ fontSize: 10 }}>✓</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                              📅 Randevu: {new Date(visit.appointmentDate).toLocaleDateString('tr-TR')} {visit.appointmentTime}
                            </div>
                            {visit.visitedAt && (
                              <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
                                🚗 Gidiş: {new Date(visit.visitedAt).toLocaleString('tr-TR')}
                              </div>
                            )}
                          </div>
                          {visit.extraCost > 0 && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: 'var(--color-text-light)' }}>Ekstra</div>
                              <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>+{formatNumber(visit.extraCost)} ₺</div>
                            </div>
                          )}
                        </div>
                        {visit.workNote && (
                          <div style={{ marginTop: 8, fontSize: 13, padding: 8, background: 'var(--color-bg-secondary)', borderRadius: 4 }}>
                            🔧 {visit.workNote}
                          </div>
                        )}
                        {visit.materials && (
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-light)' }}>
                            🔩 {visit.materials}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ödeme Detayları */}
              <div className="card subtle-card" style={{ marginBottom: 16 }}>
                <div className="card-header" style={{ padding: '10px 16px' }}>
                  <h4 className="card-title" style={{ fontSize: 13 }}>💰 Ödeme Detayları</h4>
                </div>
                <div className="card-body" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sabit Servis Ücreti</span>
                      <span>{formatNumber(job.service?.fixedFee || 0)} ₺</span>
                    </div>
                    {(job.service?.totalExtraCost || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Ekstra Malzeme</span>
                        <span>{formatNumber(job.service.totalExtraCost)} ₺</span>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>Toplam</span>
                      <span>{formatNumber(job.service?.totalCost || 0)} ₺</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 8, marginTop: 8 }}>
                      {payments.cash > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>💵 Nakit</span>
                          <span>{formatNumber(payments.cash)} ₺</span>
                        </div>
                      )}
                      {payments.card > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>💳 Kart</span>
                          <span>{formatNumber(payments.card)} ₺</span>
                        </div>
                      )}
                      {payments.transfer > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>🏦 Havale</span>
                          <span>{formatNumber(payments.transfer)} ₺</span>
                        </div>
                      )}
                      {discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-warning-dark)' }}>
                          <span>🏷️ İskonto ({job.service?.discount?.note || ''})</span>
                          <span>-{formatNumber(discount)} ₺</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fotoğraflar */}
              {jobDocuments.filter(d => d.type === 'servis_oncesi' || d.type === 'servis_sonrasi').length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📷 Fotoğraflar</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {jobDocuments.filter(d => d.type === 'servis_oncesi' || d.type === 'servis_sonrasi').map(doc => (
                      <a 
                        key={doc.id} 
                        href={getDocumentDownloadUrl(doc.id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          padding: '8px 16px', 
                          background: 'var(--color-primary-bg)', 
                          borderRadius: 8,
                          fontSize: 12,
                          textDecoration: 'none',
                          color: 'var(--color-primary)'
                        }}
                      >
                        📷 {doc.type === 'servis_oncesi' ? 'Öncesi' : 'Sonrası'}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {(status === 'KAPALI' || status === 'SERVIS_KAPALI') && (
        <div className="card subtle-card">
          <div className="metric-row">
            <span className="metric-label">Durum</span>
            <span className="metric-value">{status === 'SERVIS_KAPALI' ? 'SERVİS TAMAMLANDI' : 'KAPALI'}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Not</span>
            <span className="metric-value">Kilitli - değişiklik için yetkili gerekir</span>
          </div>
        </div>
      )}

      {logs.length > 0 ? (
        <div className="card subtle-card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <h3 className="card-title">İş Günlüğü</h3>
            <button className="btn btn-secondary btn-small" type="button" onClick={() => setShowLogs((v) => !v)}>
              {showLogs ? 'Gizle' : 'Göster'}
            </button>
          </div>
          {showLogs ? (
            <div className="timeline">
              {logs.map((log) => (
                <div key={log.id} className="timeline-item">
                  <div className="timeline-point" />
                  <div>
                    <div className="timeline-title">
                      {new Date(log.createdAt).toLocaleString('tr-TR')} · {log.action}
                    </div>
                    <div className="timeline-subtitle">{log.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {logsError ? <div className="error-text">{logsError}</div> : null}
        </div>
      ) : null}

      {actionLoading && (
        <div className="loader-overlay">
          <Loader text="İşlem yapılıyor..." />
        </div>
      )}
    </div>
  );
};

export default JobsList;

