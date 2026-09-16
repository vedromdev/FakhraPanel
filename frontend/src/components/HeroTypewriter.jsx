import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

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
    <span className="text-2xl sm:text-3xl font-display font-bold">
      <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-[#c4b5fd] to-[#22d3ee]">
        {text}
      </span>
      <span className="inline-block w-[3px] h-[1em] bg-[#22d3ee] ml-1 animate-pulse" />
    </span>
  );
}
