import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';

// Custom cursor: a dot that follows precisely + a lagging ring, with hover
// feedback and click sparks. Desktop only (pointer:fine).
export default function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const [sparks, setSparks] = useState([]);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 350, damping: 28, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 350, damping: 28, mass: 0.6 });

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    setEnabled(true);

    const move = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const el = e.target.closest?.('a,button,input,select,textarea,[data-cursor]');
      setHover(!!el);
    };
    const dn = () => setDown(true);
    const up = () => {
      setDown(false);
      // spawn sparks on click
      const id = Date.now();
      setSparks((s) => [...s, Array.from({ length: 6 }, (_, i) => ({
        id: id + i, x: e?.clientX ?? 0, y: e?.clientY ?? 0, a: (i / 6) * Math.PI * 2,
      }))]);
      setTimeout(() => setSparks((s) => s.filter((sp) => !String(sp.id).startsWith(String(id)))), 600);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', dn);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', dn);
      window.removeEventListener('mouseup', up);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      {/* trailing ring */}
      <motion.div
        className="fixed z-[9999] pointer-events-none rounded-full border border-glow/70"
        style={{
          x: ringX, y: ringY, translateX: '-50%', translateY: '-50%',
          width: hover ? 46 : 30, height: hover ? 46 : 30,
          scale: down ? 0.75 : 1,
          opacity: hover ? 1 : 0.7,
        }}
        animate={{ width: hover ? 46 : 30, height: hover ? 46 : 30, scale: down ? 0.75 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      />
      {/* precise dot */}
      <motion.div
        className="fixed z-[9999] pointer-events-none rounded-full bg-glow-cyan"
        style={{ x, y, translateX: '-50%', translateY: '-50%', width: 6, height: 6, scale: down ? 2 : 1 }}
      />
      {/* click sparks */}
      <AnimatePresence>
        {sparks.map((sp) => (
          <motion.div
            key={sp.id}
            className="fixed z-[9998] pointer-events-none w-1 h-1 rounded-full bg-glow"
            initial={{ x: sp.x, y: sp.y, opacity: 1, scale: 1 }}
            animate={{ x: sp.x + Math.cos(sp.a) * 34, y: sp.y + Math.sin(sp.a) * 34, opacity: 0, scale: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </>
  );
}
