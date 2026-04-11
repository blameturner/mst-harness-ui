import { useEffect, useState } from 'react';

const THINKING_LABELS = [
  'Knocking things off the desk',
  'Chasing a laser pointer',
  'Napping on the keyboard',
  'Ignoring your request',
  'Sharpening claws on the server',
  'Sitting on important documents',
  'Staring at a wall',
  'Plotting world domination',
  'Coughing up a hairball',
  'Judging you silently',
  'Demanding treats',
  'Pushing things off the edge',
  'Zooming around at 3am',
  'Pretending not to hear you',
  'Kneading the data',
  'Fitting into a box too small',
  'Knocking over your coffee',
  'Hunting a bug in production',
  'Taking a strategic nap',
  'Refusing to come when called',
];

export function ThinkingLabel() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * THINKING_LABELS.length));
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((prev) => {
        let next: number;
        do { next = Math.floor(Math.random() * THINKING_LABELS.length); } while (next === prev && THINKING_LABELS.length > 1);
        return next;
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, []);
  return <>{THINKING_LABELS[idx]}</>;
}
