import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getPurchaseOrders } from '../services/dataService';

const SatinalmaSiparisler = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getPurchaseOrders();
        setRows(payload);
      } catch (err) {
        setError(err.message || 'Satınalma siparişleri alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Satınalma Siparişleri (PO)" subtitle="Açık ve tamamlanan PO listesi" />

      {loading ? (
        <div className="card subtle-card">PO listesi yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">PO listesi alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'PO', accessor: 'id' },
            { label: 'Tedarikçi', accessor: 'supplier' },
            { label: 'Tutar', accessor: 'total' },
            { label: 'Durum', accessor: 'status' },
            { label: 'Beklenen', accessor: 'expectedDate' },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
};

export default SatinalmaSiparisler;

