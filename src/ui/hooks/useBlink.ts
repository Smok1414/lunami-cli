import {useState, useEffect} from 'react';

export function useBlink(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible((v) => !v);
    }, 530);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return visible;
}
