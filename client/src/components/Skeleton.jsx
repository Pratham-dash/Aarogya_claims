export const Skeleton = ({ w = '100%', h = 14 }) => <span className="skeleton" style={{ width: w, height: h }} aria-hidden="true" />;

export function TableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="table-wrap" role="status" aria-label="Loading claims">
      <table className="table">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c}><Skeleton w={c === 1 ? '90%' : '60%'} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const StatsSkeleton = () => (
  <div className="stats">
    {Array.from({ length: 4 }, (_, i) => (
      <div className="stat" key={i}><Skeleton w="50%" h={12} /><Skeleton w="35%" h={28} /></div>
    ))}
  </div>
);

export const PageSkeleton = () => (
  <div className="panel" role="status" aria-label="Loading">
    <Skeleton w="30%" h={26} />
    <div className="stack"><Skeleton /><Skeleton w="80%" /><Skeleton w="65%" /></div>
  </div>
);
