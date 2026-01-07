import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getPayments } from '../services/dataService';

const FinansOdemelerKasa = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getPayments();
        setRows(payload);
      } catch (err) {
        setError(err.message || 'Ödemeler alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Ödemeler / Kasa" subtitle="Tahsilat ve ödeme hareketleri" />

      {loading ? (
        <div className="card subtle-card">Ödemeler yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Ödemeler alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'Hareket', accessor: 'id' },
            { label: 'Tip', accessor: 'kind' },
            { label: 'Açıklama', accessor: 'description' },
            { label: 'Tutar', accessor: 'amount' },
            { label: 'Tarih', accessor: 'date' },
            { label: 'Yöntem', accessor: 'method' },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
};

export default FinansOdemelerKasa;

