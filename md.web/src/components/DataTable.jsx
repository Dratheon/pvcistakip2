const DataTable = ({ columns, rows = [], getKey = (row) => row.id || row.key || row.name, onRowClick }) => (
  <div className="table-container">
    <table className="table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.accessor}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>
              <div className="empty-state">
                <div className="empty-state-icon">🗂</div>
                <div className="empty-state-title">Kayıt bulunamadı</div>
                <div className="empty-state-description">Filtreleri değiştirerek tekrar deneyin.</div>
              </div>
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={getKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((column) => (
                <td key={column.accessor}>
                  {column.render ? column.render(row[column.accessor], row) : row[column.accessor]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

export default DataTable;

