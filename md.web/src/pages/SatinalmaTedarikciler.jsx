import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getSuppliers } from '../services/dataService';

const SatinalmaTedarikciler = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getSuppliers();
        setRows(payload);
      } catch (err) {
        setError(err.message || 'Tedarikçiler alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Tedarikçiler" subtitle="Tedarikçi listesi ve iletişim bilgileri" />

      {loading ? (
        <div className="card subtle-card">Tedarikçiler yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Tedarikçiler alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'Ad', accessor: 'name' },
            { label: 'Kategori', accessor: 'category' },
            { label: 'İletişim', accessor: 'contact' },
            { label: 'Puan', accessor: 'rating' },
          ]}
          rows={rows}
        />
      )}
    </div>
  );
};

export default SatinalmaTedarikciler;

