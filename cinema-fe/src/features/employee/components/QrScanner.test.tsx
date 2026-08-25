import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import jsQR from 'jsqr';
import { QrScanner } from './QrScanner';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return { ...actual, useTranslation: () => ({ t: (key: string) => key }) };
});

vi.mock('jsqr', () => ({ default: vi.fn() }));

const mockedJsQR = vi.mocked(jsQR);

describe('QrScanner', () => {
  let stopTrack: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stopTrack = vi.fn();
    const fakeStream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    getUserMedia = vi.fn().mockResolvedValue(fakeStream);
    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 640, height: 480 }),
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    // setTimeout, not a microtask (Promise.resolve().then(...)): a microtask-based stub here
    // recursively reschedules itself faster than the event loop can ever get back to waitFor's
    // own timer, starving it entirely and spinning until the process runs out of memory.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(0), 0) as unknown as number;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

    mockedJsQR.mockReset();
    mockedJsQR.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing while inactive', () => {
    const { container } = render(<QrScanner active={false} onScan={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('requests the rear camera and shows a preview once active', async () => {
    const { unmount } = render(<QrScanner active onScan={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } }));
    expect(await screen.findByLabelText('checkIn.cameraPreviewLabel')).toBeInTheDocument();
    // Stops the frame loop deterministically here, with this test's stubbed rAF/cAF still in
    // place — leaving it to RTL's own auto-cleanup would tear down the component after this
    // test's afterEach has already restored the real globals, letting an in-flight real timer
    // leak into (and intermittently break) whichever test runs next.
    unmount();
  });

  it('shows an error message when camera access fails', async () => {
    getUserMedia.mockRejectedValue(new Error('denied'));
    const { unmount } = render(<QrScanner active onScan={vi.fn()} />);
    expect(await screen.findByText('checkIn.cameraError')).toBeInTheDocument();
    unmount();
  });

  it('calls onScan and stops the camera once a QR code is decoded', async () => {
    mockedJsQR.mockReturnValue({ data: 'TCK-999' } as ReturnType<typeof jsQR>);
    const onScan = vi.fn();
    const { unmount } = render(<QrScanner active onScan={onScan} />);

    await waitFor(() => expect(onScan).toHaveBeenCalledWith('TCK-999'));
    expect(stopTrack).toHaveBeenCalled();
    unmount();
  });

  it('stops the camera when deactivated', async () => {
    const { rerender, unmount } = render(<QrScanner active onScan={vi.fn()} />);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    rerender(<QrScanner active={false} onScan={vi.fn()} />);
    await waitFor(() => expect(stopTrack).toHaveBeenCalled());
    unmount();
  });
});
