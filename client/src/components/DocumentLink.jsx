import { useState } from 'react';
import { api } from '../api/client.js';

/** Opens the (auth-protected) document in a new tab. The tab is opened synchronously to avoid popup blockers. */
export default function DocumentLink({ documentId, label = 'View' }) {
  const [state, setState] = useState({ busy: false, error: '' });

  const open = async () => {
    const tab = window.open('', '_blank');
    if (!tab) return setState({ busy: false, error: 'Allow pop-ups to view the document' });
    setState({ busy: true, error: '' });
    try {
      const blob = await api.documentBlob(documentId);
      tab.location.href = URL.createObjectURL(blob);
      setState({ busy: false, error: '' });
    } catch (err) {
      tab.close();
      setState({ busy: false, error: err.message });
    }
  };

  return (
    <>
      <button className="link" onClick={open} disabled={state.busy}>{state.busy ? 'Opening…' : label}</button>
      {state.error && <div className="field-error">{state.error}</div>}
    </>
  );
}
