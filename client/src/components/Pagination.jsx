export default function Pagination({ page, totalPages, total, onChange }) {
  if (!total) return null;
  return (
    <div className="pager">
      <span>{total} claim{total === 1 ? '' : 's'} · Page {page} of {totalPages}</span>
      <div className="pager__buttons">
        <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
        <button className="btn btn--ghost btn--sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
