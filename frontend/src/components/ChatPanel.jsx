import { useState, useRef, useEffect } from 'react'

export default function ChatPanel({ open, onClose, context }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!open) return null

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="chat-logo">AI</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>CFO Assistant</div>
            <div style={{ fontSize: 11, color: '#8b949e' }}>{context.company_name}</div>
          </div>
        </div>
        <button className="chat-close" onClick={onClose}>✕</button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ask me anything</div>
            <div style={{ fontSize: 12, color: '#8b949e' }}>
              I have access to the current dashboard data. Try:
            </div>
            {[
              "What's our biggest expense category?",
              "Which customers owe the most?",
              "How is profitability trending?",
              "What's our cash risk from overdue AR?",
            ].map(q => (
              <button key={q} className="chat-suggestion" onClick={() => setInput(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            <div className="chat-bubble-label">
              {msg.role === 'user' ? 'You' : 'CFO AI'}
            </div>
            <div className="chat-bubble-text" style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-bubble assistant">
            <div className="chat-bubble-label">CFO AI</div>
            <div className="chat-thinking">
              <span /><span /><span />
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">⚠ {error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          rows={2}
          placeholder="Ask about revenue, expenses, AR, trends…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          className={`chat-send ${loading ? 'disabled' : ''}`}
          onClick={send}
          disabled={loading}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
