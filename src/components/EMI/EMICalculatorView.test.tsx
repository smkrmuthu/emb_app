import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EMICalculatorView } from './EMICalculatorView';

/**
 * Regression test for the rescan-placeholder bug: uploading a new offer while
 * a previous scan's result was already showing used to leave the OLD
 * comparison table / True APR hero on screen, untouched, for however long the
 * new scan took — only the buttons showed a spinner. Someone glancing at the
 * screen mid-scan could read stale numbers as the new file's result.
 *
 * This is a frontend state-timing bug, not an LLM-extraction-correctness one,
 * so it lives here as a component test rather than in
 * worker/fixtures/run_fixtures.py (which checks what the worker returns, not
 * how the UI reacts while waiting for it).
 */

function tinyPngFile(name: string): File {
  // Content is irrelevant — fetch is mocked below, this just needs to be a
  // real File object for the component's FileReader/upload path.
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });
}

function getUploadInput(container: HTMLElement): HTMLInputElement {
  // EMICalculatorView renders two hidden file inputs: camera (capture=
  // "environment") first, then plain "Upload File" second — see the JSX.
  const inputs = container.querySelectorAll('input[type="file"]');
  return inputs[1] as HTMLInputElement;
}

const threeOptionOffer = {
  productName: 'iPhone',
  retailer: 'Amazon Pay ICICI Credit Card',
  cashPrice: null,
  options: [
    { bankName: 'Amazon Pay ICICI Credit Card', tenureMonths: 3, monthlyEMI: 4000, interestRatePercent: 0, processingFee: null, isNoCost: true, totalCost: 12000 },
    { bankName: 'Amazon Pay ICICI Credit Card', tenureMonths: 6, monthlyEMI: 2094, interestRatePercent: 9.8, processingFee: null, isNoCost: false, totalCost: 12918 },
    { bankName: 'Amazon Pay ICICI Credit Card', tenureMonths: 9, monthlyEMI: 1424, interestRatePercent: 11.7, processingFee: null, isNoCost: false, totalCost: 13166 }
  ]
};

describe('EMICalculatorView — rescan does not leave stale results visible', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides the previous result behind a spinner while a rescan is in flight, and restores it if the rescan fails', async () => {
    // First scan resolves immediately with a real (previously curl-verified)
    // offer — see worker/fixtures/run_fixtures.py's emi_offer_multi_option.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => threeOptionOffer
    } as Response));

    const { container } = render(<EMICalculatorView />);
    const input = getUploadInput(container);
    fireEvent.change(input, { target: { files: [tinyPngFile('first.png')] } });

    await screen.findByText('Compare All 3 Options');
    expect(screen.getAllByText(/Amazon Pay ICICI Credit Card/).length).toBeGreaterThan(0);

    // Second scan: every attempt (including the client's own internal
    // retries) hits this same pending, then rejected, promise.
    let rejectSecond!: (err: Error) => void;
    const secondFetch = new Promise<Response>((_resolve, reject) => { rejectSecond = reject; });
    // The component attaches its own handler asynchronously (after a
    // FileReader round-trip), so rejecting synchronously here would otherwise
    // trip Node's unhandled-rejection detector for that brief window — this
    // extra no-op catch doesn't stop the component's own await from seeing
    // the rejection, it just marks the promise "handled" immediately too.
    secondFetch.catch(() => {});
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(secondFetch));

    fireEvent.change(input, { target: { files: [tinyPngFile('second.png')] } });
    rejectSecond(new Error('network blip'));

    // While the rescan is in flight (including its retry backoff), the stale
    // comparison table must be gone — replaced by the placeholder — not left
    // on screen underneath the spinning buttons.
    await screen.findByText('Reading your offer…');
    expect(screen.queryByText('Compare All 3 Options')).toBeNull();

    // Once every retry is exhausted and the rescan finally fails, the OLD
    // good result must reappear (not stay blank), alongside the error.
    await screen.findByText('Compare All 3 Options', {}, { timeout: 5000 });
    await screen.findByText("Couldn't Read That");
  });
});
