import { Aurora, FadeIn } from '../components/ui.jsx';

const protocols = [
  { name: 'VLESS', desc: 'Lightweight, no traffic mimicry, ideal for Reality + Vision flow', xray: '✓ In Xray', railway: '✓ WS over TLS' },
  { name: 'VMess', desc: 'Original V2Ray protocol, AES-128-GCM', xray: '✓ In Xray', railway: '✓ WS over TLS' },
  { name: 'Hysteria2', desc: 'UDP-over-QUIC with HCN protocol (Hy2)', xray: '—', railway: '✗ QUIC blocked' },
  { name: 'Shadowsocks', desc: 'Simple proxying, 2022-blake3-aes-256-gcm', xray: '—', railway: '✗ UDP needed' },
  { name: 'Trojan', desc: 'Camouflaged TLS, looks like normal HTTPS', xray: '✓ In Xray', railway: '✓ WS over TLS' },
  { name: 'Tuic', desc: 'Modern QUIC-based, ECCM encryption', xray: '—', railway: '✗ QUIC blocked' },
  { name: 'WireGuard', desc: 'High-performance kernel IPsec replacement', xray: '—', railway: '—' },
];

export default function Protocols() {
  return (
    <>
      <Aurora />
      <div className="ml-64 p-8 pb-20 min-h-screen">
        <FadeIn>
          <h1 className="text-3xl font-display glow-text mb-6">Supported Protocols</h1>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {protocols.map((p, i) => (
            <FadeIn key={p.name} delay={i * 0.1}>
              <div className="glass p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🔐</span>
                  <h3 className="text-xl font-display glow-text">{p.name}</h3>
                </div>
                <p className="text-slate-300 text-sm mb-3">{p.desc}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Xray:</span><span>{p.xray}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Railway:</span><span>{p.railway}</span></div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </>
  );
}
