import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { getTasks } from '../services/dataService';

const Gorevler = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const payload = await getTasks();
        setTasks(payload);
      } catch (err) {
        setError(err.message || 'Görevler alınamadı');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Görevler"
        subtitle="Ekip görevlerinizi durumlarına göre takip edin"
        actions={
          <button className="btn btn-primary" type="button">
            + Görev Ata
          </button>
        }
      />

      {loading ? (
        <div className="card subtle-card">Görevler yükleniyor...</div>
      ) : error ? (
        <div className="card error-card">
          <div className="error-title">Görevler getirilemedi</div>
          <div className="error-message">{error}</div>
        </div>
      ) : (
        <DataTable
          columns={[
            { label: 'Görev', accessor: 'title' },
            { label: 'Sorumlu', accessor: 'owner' },
            {
              label: 'Durum',
              accessor: 'status',
              render: (value) => <span className="badge badge-secondary">{value}</span>,
            },
            { label: 'Termin', accessor: 'dueDate' },
          ]}
          rows={tasks}
        />
      )}
    </div>
  );
};

export default Gorevler;

