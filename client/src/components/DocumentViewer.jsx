import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Skeleton } from './Skeleton.jsx';

/** Inline preview of the uploaded document (image or PDF). Fetched only when this component mounts. */
export default function DocumentViewer({ documentId, name }) {
  const [doc, setDoc] = useState({ url: '', type: '', error: '' });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setDoc({ url: '', type: '', error: '' });
    api
      .documentBlob(documentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setDoc({ url: objectUrl, type: blob.type, error: '' });
      })
      .catch((err) => !cancelled && setDoc({ url: '', type: '', error: err.message }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  if (doc.error) return <p className="field-error">Could not load the document: {doc.error}</p>;
  if (!doc.url) return <Skeleton h={360} />;

  return (
    <div className="doc">
      {doc.type.startsWith('image/') ? (
        <img src={doc.url} alt={`Uploaded document: ${name}`} className="doc__img" />
      ) : (
        <iframe title={`Uploaded document: ${name}`} src={doc.url} className="doc__frame" />
      )}
      <a className="link" href={doc.url} target="_blank" rel="noreferrer">Open in new tab</a>
    </div>
  );
}
