import { useState, useEffect, useRef } from 'react'

const tok = () => localStorage.getItem('cfo_token') || ''

export default function EvidenceVault({ dbs }) {
  const [files,    setFiles]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const load = () => {
    setLoading(true)
    fetch('/api/audit/evidence', { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.json()).then(d => setFiles(d.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const upload = async (fileList) => {
    if (!fileList?.length) return
    setUploading(true)
    const fd = new FormData()
    Array.from(fileList).forEach(f => fd.append('files', f))
    try {
      const r = await fetch('/api/audit/evidence/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}` },
        body: fd,
      })
      const data = await r.json()
      setFiles(prev => [...(data.uploaded || []), ...prev])
    } finally { setUploading(false) }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    upload(e.dataTransfer.files)
  }

  const fmtSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024)        return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="audit-section">
      <div className="audit-section-header">
        <h3>Evidence Vault</h3>
        <button className="btn" onClick={load} disabled={loading}>↻</button>
      </div>

      <div
        className={`evidence-drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => upload(e.target.files)} />
        {uploading
          ? <span>Uploading…</span>
          : <span>↑ Drop files here or click to upload</span>
        }
      </div>

      {loading ? <div className="audit-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th><th>Upload Date</th><th>Uploaded By</th>
                <th>PBC Ref</th><th>Size</th><th>Download</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12 }}>📄 {f.filename}</td>
                  <td style={{ fontSize: 12 }}>{f.uploaded_at?.slice(0, 16)}</td>
                  <td style={{ fontSize: 12 }}>{f.uploaded_by}</td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{f.pbc_ref || '—'}</td>
                  <td style={{ fontSize: 12 }}>{fmtSize(f.size)}</td>
                  <td>
                    <a href={`/api/audit/evidence/download/${f.id}`}
                      style={{ color: 'var(--primary)', fontSize: 12 }}
                      headers={{ Authorization: `Bearer ${tok()}` }}>
                      ↓ Download
                    </a>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text2)' }}>No evidence uploaded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
