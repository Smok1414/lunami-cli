import { jsx as _jsx } from "react/jsx-runtime";
// File: src/ui/components/spinner.tsx
import { useEffect, useState } from 'react';
import { Text } from 'ink';
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
export function Spinner({ color = 'cyan' }) {
    const [frameIndex, setFrameIndex] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => {
            setFrameIndex((prev) => (prev + 1) % spinnerFrames.length);
        }, 80);
        return () => {
            clearInterval(timer);
        };
    }, []);
    return _jsx(Text, { color: color, children: spinnerFrames[frameIndex] });
}
