import { useState, useEffect } from 'react';
export function useBlink() {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const shouldBlink = process.env.LUNAMI_NO_BLINK !== '1' &&
            process.env.NO_COLOR !== '1' &&
            process.platform !== 'win32';
        if (!shouldBlink) {
            return;
        }
        const timer = setInterval(() => {
            setVisible((v) => !v);
        }, 530);
        return () => {
            clearInterval(timer);
        };
    }, []);
    return visible;
}
