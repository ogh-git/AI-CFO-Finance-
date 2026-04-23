import { useState, useEffect } from 'react'
import { api } from '../api'

export default function UserManager({ currentUser }) {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [form,    setForm]    = useState({ username:'', email:'', password:'', role:'viewer' })
  const [adding,  setAdding]  = useState(false)
  const [saving,  setSaving]  = useState(false)

  const load = async () => {
    setLoading(true)
    try { setUsers((await api.listUsers()).data) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const add = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) return
    setSaving(true); setError(null)
    try {
      await api.createUser(form)
      setForm({ username:'', email:'', password:'', role:'viewer' })
      setAdding(false)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const toggle = async (u) => {
    try { await api.updateUser(u.id, { is_active: !u.is_active }); await load() }
    catch (e) { setError(e.message) }
  }

  const remove = async (u) => {
    if (!window.confirm(`Delete user "${u.username}"?`)) return
    try { await api.deleteUser(u.id); await load() }
    catch (e) { setError(e.message) }
  }

  const changeRole = async (u, role) => {
    try { await api.updateUser(u.id, { role }); await load() }
    catch (e) { setError(e.message) }
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="card" style={{ textAlign:'center', color:'#8b949e', padding:'60px 0' }}>
        Only admins can manage users.
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      <div className="card">
        <div className="card-title" style={{ justifyContent:'space-between' }}>
          <span>Users</span>
          <button className="btn primary" onClick={() => setAdding(v => !v)}>
            {adding ? '✕ Cancel' : '+ Add User'}
          </button>
        </div>

        {adding && (
          <form onSubmit={add} style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
            <input className="um-input" placeholder="Username *" value={form.username}
              onChange={e => setForm(f=>({...f,username:e.target.value}))} required />
            <input className="um-input" placeholder="Email" value={form.email}
              onChange={e => setForm(f=>({...f,email:e.target.value}))} />
            <input className="um-input" type="password" placeholder="Password *" value={form.password}
              onChange={e => setForm(f=>({...f,password:e.target.value}))} required />
            <select className="um-input" value={form.role}
              onChange={e => setForm(f=>({...f,role:e.target.value}))}>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add User'}
            </button>
          </form>
        )}

        {error && <div className="error-banner" style={{marginBottom:12}}>⚠ {error}</div>}

        {loading ? (
          <div style={{ color:'#8b949e', padding:'20px 0' }}>Loading…</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign:'left' }}>Username</th>
                  <th style={{ textAlign:'left' }}>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight:600 }}>{u.username}</td>
                    <td>{u.email || '–'}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={e => changeRole(u, e.target.value)}
                        disabled={u.username === currentUser.username}
                        style={{ background:'var(--surface2)', border:'1px solid var(--border)',
                          color:'var(--text)', borderRadius:4, padding:'2px 6px', fontSize:12 }}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span style={{
                        fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:10,
                        background: u.is_active ? 'rgba(63,185,80,.15)' : 'rgba(248,81,73,.15)',
                        color: u.is_active ? '#3fb950' : '#f85149',
                      }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize:11, color:'#8b949e' }}>
                      {u.created_at ? u.created_at.slice(0,10) : '–'}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button
                          className="btn"
                          style={{ padding:'3px 10px', fontSize:12 }}
                          onClick={() => toggle(u)}
                          disabled={u.username === currentUser.username}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          className="btn"
                          style={{ padding:'3px 10px', fontSize:12, color:'var(--red)', borderColor:'var(--red)' }}
                          onClick={() => remove(u)}
                          disabled={u.username === currentUser.username}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
