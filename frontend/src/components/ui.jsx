import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WORDS = ['Azadi', 'آزادی', 'Freedom', 'Connect', 'Uncensored'];
export default function HeroTypewriter() {
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = WORDS[i % WORDS.length];
    const speed = deleting ? 60 : 120;
    const t = setTimeout(() => {
      setText((t) => (deleting ? current.slice(0, t.length - 1) : current.slice(0, t.length + 1)));
      if (!deleting && text === current) setTimeout(() => setDeleting(true), 900);
      if (deleting && text === '') { setDeleting(false); setI((i) => i + 1); }
    }, speed);
    return () => clearTimeout(t);
  }, [text, deleting, i]);

  return (
    <span className="glow-text font-display text-3xl sm:text-5xl font-bold">
      {text}
      <span className="inline-block w-[3px] h-[1em] bg-glow-cyan ml-1 animate-pulse" />
    </span>
  );
}

export function Aurora() {
  return <div className="aurora" />;
}

export function FadeIn({ children, delay = 0, y = 20 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function StatCard({ label, value, accent = '#7c5cff', icon }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass p-5 relative overflow-hidden"
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-40"
           style={{ background: accent }} />
      <div className="text-slate-400 text-sm flex items-center gap-2">{icon}{label}</div>
      <div className="text-3xl font-display font-bold mt-2 glow-text">{value}</div>
    </motion.div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-glow animate-spin" />
    </div>
  );
}

export function Modal({ open, onClose, children, title }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="glass relative z-10 w-full max-w-md p-6"
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          >
            {title && <h3 className="font-display text-xl mb-4 glow-text">{title}</h3>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toast({ message, show, onDone }) {
  useEffect(() => {
    if (show) { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }
  }, [show]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] glass px-5 py-3 text-sm"
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
