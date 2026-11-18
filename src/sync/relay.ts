import type { Transport, TransportStatus, WireMsg } from './types'

/**
 * Cross-device relay over ntfy.sh: a free, open-source pub/sub service that
 * needs no account or API key and works from a static site (HTTPS + SSE, CORS
 * enabled). It also caches messages for ~12h, so a new device replays recent
 * records on connect. It is a *dumb pipe*: all conflict resolution happens in
 * the deterministic merge on every client. In production this is replaced by
 * an authoritative booking service (see EXPLAINER.md).
 */
export class NtfyRelay implements Transport {
  name = 'ntfy.sh relay'
  private es?: EventSource
  private base: string
  private topic: string
  constructor(topic: string, base = 'https://ntfy.sh') {
    this.topic = topic
    this.base = base
  }
  start(onMsg: (m: WireMsg) => void, onStatus: (s: TransportStatus) => void) {
    onStatus('connecting')
    try {
      this.es = new EventSource(`${this.base}/${this.topic}/sse?since=12h`)
    } catch {
      onStatus('error')
      return
    }
    this.es.onopen = () => onStatus('live')
    this.es.onerror = () => onStatus(this.es?.readyState === EventSource.CLOSED ? 'error' : 'connecting')
    this.es.onmessage = (ev) => {
      try {
        const outer = JSON.parse(ev.data)
        if (outer.event !== 'message' || typeof outer.message !== 'string') return
        const m = JSON.parse(outer.message)
        if (m && m.app === 'plottwin') onMsg(m as WireMsg)
      } catch {
        /* ignore foreign/garbage messages on the public topic */
      }
    }
  }
  publish(m: WireMsg) {
    fetch(`${this.base}/${this.topic}`, { method: 'POST', body: JSON.stringify(m) }).catch(() => {})
  }
  stop() {
    this.es?.close()
  }
}
