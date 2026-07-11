/**
 * useTouchFeedback — Provides instant visual feedback (< 100ms) on button press/click.
 *
 * Applies a CSS class that triggers an opacity + scale transition on pointerdown,
 * then removes it on pointerup/pointerleave. The CSS transition is configured to
 * respond within 100ms (actually ~50ms) for perceptible instant feedback.
 *
 * Usage:
 *   const feedbackProps = useTouchFeedback();
 *   <button {...feedbackProps}>Click me</button>
 *
 * Validates: Requirements 19.6
 */
import { useState, useCallback } from 'react';

const FEEDBACK_CLASS = 'touch-feedback-active';

export interface TouchFeedbackProps {
  className: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
}

/**
 * Returns event handlers and a className to spread onto an interactive element.
 * The class `touch-feedback-active` is toggled on press for instant visual feedback.
 */
export function useTouchFeedback(): TouchFeedbackProps {
  const [active, setActive] = useState(false);

  const onPointerDown = useCallback((_e: React.PointerEvent) => {
    setActive(true);
  }, []);

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    setActive(false);
  }, []);

  const onPointerLeave = useCallback((_e: React.PointerEvent) => {
    setActive(false);
  }, []);

  return {
    className: active ? FEEDBACK_CLASS : '',
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  };
}
