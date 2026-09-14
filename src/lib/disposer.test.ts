import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createDisposer } from './disposer';

describe('createDisposer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs all registered teardowns when dispose() is called', () => {
    const d = createDisposer();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    d.add(fn1);
    d.add(fn2);
    d.dispose();
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('clears the registry after dispose so a second call is a no-op', () => {
    const d = createDisposer();
    const fn1 = vi.fn();
    d.add(fn1);
    d.dispose();
    d.dispose();
    expect(fn1).toHaveBeenCalledTimes(1);
  });

  it('runs teardowns in LIFO order', () => {
    const d = createDisposer();
    const order: number[] = [];
    d.add(() => order.push(1));
    d.add(() => order.push(2));
    d.add(() => order.push(3));
    d.dispose();
    expect(order).toEqual([3, 2, 1]);
  });

  it('on() adds an event listener and removes it on dispose', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const d = createDisposer();

    d.on(target, 'click', handler);
    target.dispatchEvent(new Event('click'));
    expect(handler).toHaveBeenCalledTimes(1);

    d.dispose();
    target.dispatchEvent(new Event('click'));
    // After dispose the listener should be gone
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('interval() runs the callback repeatedly and stops after dispose', () => {
    const fn = vi.fn();
    const d = createDisposer();
    d.interval(100, fn);

    vi.advanceTimersByTime(250);
    expect(fn).toHaveBeenCalledTimes(2);

    d.dispose();
    vi.advanceTimersByTime(500);
    // No additional calls after dispose
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('timeout() fires once and is cancelled by dispose if not yet elapsed', () => {
    const fn = vi.fn();
    const d = createDisposer();
    d.timeout(500, fn);

    d.dispose(); // Cancel before the timer fires
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not throw if a teardown function throws — remaining teardowns still run', () => {
    const d = createDisposer();
    const fn = vi.fn();
    d.add(() => { throw new Error('oops'); });
    d.add(fn);
    expect(() => d.dispose()).not.toThrow();
    expect(fn).toHaveBeenCalled();
  });
});
