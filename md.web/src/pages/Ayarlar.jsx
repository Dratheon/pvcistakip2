import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { getSettings } from '../services/dataService';

const Ayarlar = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getSettings();
        setRows(payload);
      } catch (err) {
        setError(err.message || 'Ayarlar alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader title="Ayarlar" subtitle="Bildirim ve sistem ayarları" />

      {loading ? (
        <div className="card subtle-card">Ayarlar yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Ayarlar alınamadı</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="metric-list">
              {rows.map((row) => (
                <div className="metric-row" key={row.id}>
                  <div>
                    <div className="metric-label">{row.label}</div>
                    <div className="page-subtitle">{row.description}</div>
                  </div>
                  <span className={`badge badge-${row.value ? 'success' : 'secondary'}`}>
                    {row.value ? 'Açık' : 'Kapalı'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ayarlar;

