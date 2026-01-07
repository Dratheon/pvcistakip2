import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getStockMovements } from '../services/dataService';

const StokHareketler = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getStockMovements();
        setRows(payload);
      } catch (err) {
        setError(err.message || 'Hareketler alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Stok Hareketleri" subtitle="Güncel giriş/çıkış işlemleri" />

      {loading ? (
        <div className="card subtle-card">Hareketler yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Hareketler alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'Tarih', accessor: 'date' },
            { label: 'Kalem', accessor: 'item' },
            {
              label: 'Miktar',
              accessor: 'change',
              render: (value) => <span className={`badge badge-${value >= 0 ? 'success' : 'danger'}`}>{value}</span>,
            },
            { label: 'Neden', accessor: 'reason' },
            { label: 'Operatör', accessor: 'operator' },
            {
              label: 'Lokasyon',
              accessor: 'location',
              render: (value) => <span className="text-muted">{value || 'Ana Depo'}</span>,
            },
            {
              label: 'Referans',
              accessor: 'reference',
              render: (value) => <span className="text-muted">{value || '-'}</span>,
            },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
};

export default StokHareketler;

