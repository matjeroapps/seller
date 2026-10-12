import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthoringAssistantPanel, pollDelay } from '../components/seller/AuthoringAssistantPanel';
import type { AuthoringJob } from '../lib/api/types';

const { mockApi, mockApiError } = vi.hoisted(() => ({
  mockApi: {
    getAuthoringLimits: vi.fn(),
    createAuthoringJob: vi.fn(),
    getAuthoringJob: vi.fn(),
    retryAuthoringJob: vi.fn(),
    updateAuthoringField: vi.fn(),
    acceptAuthoringImage: vi.fn(),
    createMediaUpload: vi.fn(),
    completeMediaUpload: vi.fn()
  },
  mockApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
}));

vi.mock('../lib/api/client', () => ({ sellerApi: mockApi, ApiError: mockApiError }));

const job: AuthoringJob = {
  id: 'job-1',
  store_id: 'store-1',
  status: 'processing',
  text_status: 'processing',
  image_status: 'processing',
  brief: 'برief',
  requested_image_count: 1,
  effective_image_limit: 7,
  attempts: 1,
  error_code: '',
  error_message: '',
  created_at: 'now',
  updated_at: 'now',
  started_at: null,
  completed_at: null,
  fields: [
    {
      id: 'f-1',
      field_key: 'name',
      locale: 'en',
      value: 'Draft name',
      attribute_code: '',
      category_id: null,
      status: 'proposed',
      edited_by_subject: '',
      failure_code: '',
      updated_at: 'now'
    }
  ],
  image_candidates: [
    {
      id: 'c-1',
      store_id: 'store-1',
      source_asset_id: 'asset-1',
      scene_key: 'coffee',
      url: 'https://media.example/scene.png',
      foreground_url: 'https://media.example/foreground.png',
      content_type: 'image/png',
      byte_size: 100,
      visibility: 'hidden',
      status: 'proposed',
      asset_id: null,
      failure_code: '',
      retry_count: 0,
      updated_at: 'now'
    }
  ]
};

function nextMicrotask() { return act(async () => { await Promise.resolve(); }); }

async function advanceMs(ms: number) {
  for (let done = 0; done < ms; done += 250) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  }
}

describe('AI authoring assistant (US1/US3/US4 UI)', () => {
  beforeEach(() => {
    mockApi.getAuthoringLimits.mockResolvedValue({ effective_limit: 7, default_count: 3 });
    // Fresh identity per poll mirrors the fetch path (React must re-run the poll effect). mockApi.getAuthoringJob.mockImplementation(async () => ({ ...job }));
    mockApi.createAuthoringJob.mockResolvedValue(job);
    mockApi.updateAuthoringField.mockImplementation(async (_store, _job, fieldId, req) => ({
      ...job.fields[0],
      id: fieldId,
      status: req.decision === 'accept' ? 'accepted' : 'rejected',
      value: req.decision === 'accept' ? req.value : job.fields[0].value,
      edited_by_subject: 'subject-x'
    }));
    mockApi.acceptAuthoringImage.mockResolvedValue({ ...job.image_candidates[0], status: 'accepted', asset_id: 'asset-9' });
    mockApi.retryAuthoringJob.mockResolvedValue({ ...job, status: 'pending' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders limits from Core and keeps provider vocabulary out of the DOM', async () => {
    const { container } = render(<AuthoringAssistantPanel storeId="store-1" onApplyName={() => {}} />);
    await screen.findByTestId('authoring-assistant');
    await vi.waitFor(() => expect(mockApi.getAuthoringLimits).toHaveBeenCalledWith('store-1'));
    const html = container.innerHTML;
    for (const secret of ['AI_TEXT_API_KEY', 'openai', 'secret-key', 'ai-authoring/']) {
      expect(html, `must not leak ${secret}`).not.toContain(secret);
    }
  });

  it('decides fields one at a time with the edited value', async () => {
    render(<AuthoringAssistantPanel storeId="store-1" onApplyName={() => {}} />);
    fireEvent.click(await screen.findByTestId('authoring-generate'));
    const buttons = await screen.findAllByTestId('authoring-accept-field');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await vi.waitFor(() => {
      expect(mockApi.updateAuthoringField).toHaveBeenCalledWith('store-1', 'job-1', 'f-1', { decision: 'accept', value: 'Draft name' }, expect.any(String));
    });
    // No bulk accept path exists: only per-field buttons are rendered.
    expect(screen.getAllByTestId('authoring-field')).toHaveLength(1);
  });

  it('rejects a field without inserting anything', async () => {
    render(<AuthoringAssistantPanel storeId="store-1" onApplyName={() => {}} />);
    fireEvent.click(await screen.findByTestId('authoring-generate'));
    fireEvent.click((await screen.findAllByTestId('authoring-reject-field'))[0]);
    await vi.waitFor(() => {
      expect(mockApi.updateAuthoringField).toHaveBeenCalledWith('store-1', 'job-1', 'f-1', { decision: 'reject', value: 'Draft name' }, expect.any(String));
    });
    expect(mockApi.updateAuthoringField.mock.calls[0][3].decision).toBe('reject');
  });

  it('accepts one image candidate as hidden and exposes the candidate assets', async () => {
    render(<AuthoringAssistantPanel storeId="store-1" onApplyName={() => {}} />);
    fireEvent.click(await screen.findByTestId('authoring-generate'));
    const acceptImage = await screen.findByTestId('authoring-accept-image');
    expect(screen.getAllByTestId('authoring-candidate')).toHaveLength(1);
    fireEvent.click(acceptImage);
    await vi.waitFor(() => {
      expect(mockApi.acceptAuthoringImage).toHaveBeenCalledWith('store-1', 'job-1', 'c-1', { is_visible: false, alt_text: 'coffee' }, expect.any(String));
    });
  });

  it('retries only the failed part of the job', async () => {
    const failedJob: AuthoringJob = { ...job, image_candidates: [{ ...job.image_candidates[0], status: 'failed', failure_code: 'provider_invalid_output' }] };
    mockApi.getAuthoringJob.mockResolvedValue(failedJob);
    mockApi.createAuthoringJob.mockResolvedValue(failedJob);
    render(<AuthoringAssistantPanel storeId="store-1" onApplyName={() => {}} />);
    // Seed a job by generating one.
    fireEvent.click(await screen.findByTestId('authoring-generate'));
    const retryImage = await screen.findByTestId('authoring-retry-image');
    fireEvent.click(retryImage);
    await vi.waitFor(() => {
      expect(mockApi.retryAuthoringJob).toHaveBeenCalledWith('store-1', 'job-1', { candidate_ids: ['c-1'] }, expect.any(String));
    });
  });

  it('polls a running job: the first hop is 2s and later hops continue', async () => {
    vi.useFakeTimers();
    render(<AuthoringAssistantPanel storeId="store-1" onApplyName={() => {}} />);
    await nextMicrotask();
    fireEvent.click(screen.getByTestId('authoring-generate'));
    await nextMicrotask();
    expect(mockApi.createAuthoringJob).toHaveBeenCalled();
    expect(mockApi.getAuthoringJob).not.toHaveBeenCalled();
    await advanceMs(2300);
    expect(mockApi.getAuthoringJob).toHaveBeenCalledTimes(1);
    await advanceMs(2300);
    expect(mockApi.getAuthoringJob).toHaveBeenCalledTimes(2);

    // A final status stops polling.
    const finished: AuthoringJob = { ...job, status: 'partial' };
    mockApi.getAuthoringJob.mockResolvedValue(finished);
    await advanceMs(2300);
    const callsAfterFinal = mockApi.getAuthoringJob.mock.calls.length;
    await advanceMs(60_000);
    expect(mockApi.getAuthoringJob.mock.calls.length).toBe(callsAfterFinal);
  });

  it('uploads source images through the canonical three-step flow', async () => {
    const uploadedFile = new File(['png-bytes'], 'source.png', { type: 'image/png' });
    Object.defineProperty(uploadedFile, 'arrayBuffer', { value: async () => new ArrayBuffer(8) });
    mockApi.createMediaUpload.mockResolvedValue({
      mode: 'upload',
      upload_url: 'https://storage.test/upload',
      intent_id: 'intent-1',
      upload_token: 'token-1',
      required_headers: { 'x-check': '1' }
    });
    mockApi.completeMediaUpload.mockResolvedValue({ id: 'asset-77' });
    const put = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    render(<AuthoringAssistantPanel storeId="store-1" onApplyName={() => {}} />);
    const input = await screen.findByLabelText(/Upload source images|رفع صور المصدر/);
    Object.defineProperty(input, 'files', { value: [uploadedFile] });
    fireEvent.change(input);
    await vi.waitFor(() => expect(mockApi.completeMediaUpload).toHaveBeenCalledWith('store-1', 'intent-1', 'token-1'));
    expect(mockApi.createMediaUpload).toHaveBeenCalledWith('store-1', expect.objectContaining({
      filename: 'source.png',
      content_type: 'image/png',
      checksum_sha256: expect.any(String)
    }));
    expect(put.mock.calls[0][0]).toBe('https://storage.test/upload');
    await vi.waitFor(() => expect(screen.getByTestId('authoring-source-count')).toHaveTextContent('1'));
    put.mockRestore();
  });

  it('pollDelay tiers follow 2s → 3s → 5s as elapsed time grows', () => {
    const base = Date.now();
    const start = base - 0;
    const realNow = vi.spyOn(Date, 'now').mockReturnValue(base);
    try {
      expect(pollDelay(start)).toBe(2_000);
      expect(pollDelay(start - 59_999)).toBe(2_000);
      expect(pollDelay(start - 60_001)).toBe(3_000);
      expect(pollDelay(start - 179_999)).toBe(3_000);
      expect(pollDelay(start - 180_001)).toBe(5_000);
    } finally {
      realNow.mockRestore();
    }
  });
});
