import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bookingService } from '../booking.service.js';
import { apiClient } from '../api-client.js';

vi.mock('../api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Booking Service (P17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createBookingRequest calls POST /booking-requests with payload', async () => {
    const payload = {
      courtId: 'court-123',
      bookingDate: '2026-11-01',
      selectedSlots: [{ startTime: '07:00', endTime: '08:30' }],
      contactName: 'Nguyễn Văn A',
      contactPhone: '0987654321',
      idempotencyKey: 'idemp_123',
    };

    apiClient.post.mockResolvedValue({ success: true, data: { bookingRequestId: 'req-1' } });

    const result = await bookingService.createBookingRequest(payload);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/booking-requests', payload);
    expect(result.data.bookingRequestId).toBe('req-1');
  });

  it('getBookingRequestById calls GET /booking-requests/:id', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: { id: 'req-1' } });

    await bookingService.getBookingRequestById('req-1');
    expect(apiClient.get).toHaveBeenCalledWith('/booking-requests/req-1');
  });

  it('cancelBookingRequest calls POST /booking-requests/:id/cancel with reason', async () => {
    apiClient.post.mockResolvedValue({ success: true });

    await bookingService.cancelBookingRequest('req-1', 'Hủy do bận đột xuất');
    expect(apiClient.post).toHaveBeenCalledWith('/booking-requests/req-1/cancel', {
      reason: 'Hủy do bận đột xuất',
    });
  });

  it('getMyBookings constructs query parameters correctly', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [] });

    await bookingService.getMyBookings({ status: 'UPCOMING', page: 2, limit: 10 });
    expect(apiClient.get).toHaveBeenCalledWith('/bookings?status=UPCOMING&page=2&limit=10');
  });

  it('getBookingById calls GET /bookings/:id', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: { id: 'b-1' } });

    await bookingService.getBookingById('b-1');
    expect(apiClient.get).toHaveBeenCalledWith('/bookings/b-1');
  });
});

