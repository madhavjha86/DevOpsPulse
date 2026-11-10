import React, { useEffect, useState } from 'react';

interface CountUpProps {
  value: number | string;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * CountUp performs a 60fps smooth easing count-up animation for KPI metrics.
 * Respects prefers-reduced-motion.
 */
export const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 800,
  className,
  prefix = '',
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => String(value));

  useEffect(() => {
    // If value is non-numeric, display immediately
    const rawStr = String(value).trim();
    const hasPercent = rawStr.endsWith('%');
    const numericStr = rawStr.replace(/[^\d.-]/g, '');
    const target = parseFloat(numericStr);

    if (isNaN(target)) {
      setDisplayValue(rawStr);
      return;
    }

    // Check prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayValue(rawStr);
      return;
    }

    const isFloat = numericStr.includes('.');
    const decimals = isFloat ? numericStr.split('.')[1].length : 0;
    const start = 0;
    const startTime = performance.now();

    let animationFrameId: number;

    const updateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: 1 - Math.pow(1 - progress, 3)
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * easeOutProgress;

      const formatted = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();
      setDisplayValue(`${formatted}${hasPercent ? '%' : ''}`);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        setDisplayValue(rawStr);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
};

export default CountUp;
