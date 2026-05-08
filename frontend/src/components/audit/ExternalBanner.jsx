export default function ExternalBanner({ user }) {
  return (
    <div style={{
      background: '#d29922', color: '#0d1117', padding: '8px 20px',
      fontSize: 13, fontWeight: 600, display: 'flex',
      alignItems: 'center', gap: 16, borderRadius: 6, marginBottom: 16,
    }}>
      <span>🔒 Read-only auditor session</span>
      <span style={{ fontWeight: 400 }}>Logged in as: {user?.username}</span>
      {user?.ext_session_expires && (
        <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
          Session expires: {user.ext_session_expires}
        </span>
      )}
    </div>
  )
}
