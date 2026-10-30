import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ownerService } from '../owner.service.js';
import { apiClient } from '../api-client.js';

vi.mock('../api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ownerService (P18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Dashboard
  it('calls getDashboard with query params', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await ownerService.getDashboard({ startDate: '2026-11-01', facilityId: 'f-1' });
    expect(apiClient.get).toHaveBeenCalledWith('/owner/dashboard?startDate=2026-11-01&facilityId=f-1');
  });

  // Facilities
  it('calls listFacilities', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [] });
    await ownerService.listFacilities();
    expect(apiClient.get).toHaveBeenCalledWith('/owner/facilities');
  });

  it('calls getFacilityById', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await ownerService.getFacilityById('f-1');
    expect(apiClient.get).toHaveBeenCalledWith('/owner/facilities/f-1');
  });

  it('calls createFacility', async () => {
    apiClient.post.mockResolvedValue({ success: true, data: {} });
    await ownerService.createFacility({ name: 'Sân bóng mới' });
    expect(apiClient.post).toHaveBeenCalledWith('/owner/facilities', { name: 'Sân bóng mới' });
  });

  it('calls updateFacility', async () => {
    apiClient.patch.mockResolvedValue({ success: true, data: {} });
    await ownerService.updateFacility('f-1', { name: 'Sân bóng cập nhật' });
    expect(apiClient.patch).toHaveBeenCalledWith('/owner/facilities/f-1', { name: 'Sân bóng cập nhật' });
  });

  // Images
  it('calls uploadFacilityImage with FormData', async () => {
    apiClient.post.mockResolvedValue({ success: true, data: {} });
    const dummyFile = new Blob(['image content'], { type: 'image/png' });
    await ownerService.uploadFacilityImage('f-1', dummyFile);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/owner/facilities/f-1/images',
      expect.any(FormData),
      { isFormData: true }
    );
  });

  it('calls deleteFacilityImage', async () => {
    apiClient.delete.mockResolvedValue({ success: true });
    await ownerService.deleteFacilityImage('f-1', 'img-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/owner/facilities/f-1/images/img-1');
  });

  it('calls setCoverImage', async () => {
    apiClient.patch.mockResolvedValue({ success: true });
    await ownerService.setCoverImage('f-1', 'img-1');
    expect(apiClient.patch).toHaveBeenCalledWith('/owner/facilities/f-1/images/img-1/set-cover');
  });

  // Facility Sports
  it('calls listFacilitySports, addFacilitySport, updateFacilitySportStep', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [] });
    await ownerService.listFacilitySports('f-1');
    expect(apiClient.get).toHaveBeenCalledWith('/owner/facilities/f-1/sports');

    apiClient.post.mockResolvedValue({ success: true, data: {} });
    await ownerService.addFacilitySport('f-1', { sportId: 'sp-1', slotStepMinutes: 60 });
    expect(apiClient.post).toHaveBeenCalledWith('/owner/facilities/f-1/sports', {
      sportId: 'sp-1',
      slotStepMinutes: 60,
    });

    apiClient.patch.mockResolvedValue({ success: true, data: {} });
    await ownerService.updateFacilitySportStep('f-1', 'fs-1', { slotStepMinutes: 90 });
    expect(apiClient.patch).toHaveBeenCalledWith('/owner/facilities/f-1/sports/fs-1', {
      slotStepMinutes: 90,
    });
  });

  // Courts
  it('calls listCourts, createCourt, updateCourt', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [] });
    await ownerService.listCourts('f-1');
    expect(apiClient.get).toHaveBeenCalledWith('/owner/courts?facilityId=f-1');

    apiClient.post.mockResolvedValue({ success: true, data: {} });
    await ownerService.createCourt({ name: 'Sân A', facilityId: 'f-1' });
    expect(apiClient.post).toHaveBeenCalledWith('/owner/courts', { name: 'Sân A', facilityId: 'f-1' });

    apiClient.patch.mockResolvedValue({ success: true, data: {} });
    await ownerService.updateCourt('c-1', { isActive: false });
    expect(apiClient.patch).toHaveBeenCalledWith('/owner/courts/c-1', { isActive: false });
  });

  // Court Blocks
  it('calls listCourtBlocks, createCourtBlock, deleteCourtBlock', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [] });
    await ownerService.listCourtBlocks({ courtId: 'c-1', isActive: true });
    expect(apiClient.get).toHaveBeenCalledWith('/owner/court-blocks?courtId=c-1&isActive=true');

    apiClient.post.mockResolvedValue({ success: true, data: {} });
    await ownerService.createCourtBlock({ courtId: 'c-1', reason: 'Bảo trì cỏ' });
    expect(apiClient.post).toHaveBeenCalledWith('/owner/court-blocks', {
      courtId: 'c-1',
      reason: 'Bảo trì cỏ',
    });

    apiClient.delete.mockResolvedValue({ success: true });
    await ownerService.deleteCourtBlock('cb-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/owner/court-blocks/cb-1');
  });

  // Bookings
  it('calls listBookings, getBookingById, completeBooking, markNoShowBooking, cancelBookingRequest', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [] });
    await ownerService.listBookings({ facilityId: 'f-1', status: 'CONFIRMED' });
    expect(apiClient.get).toHaveBeenCalledWith('/owner/bookings?facilityId=f-1&status=CONFIRMED');

    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await ownerService.getBookingById('b-1');
    expect(apiClient.get).toHaveBeenCalledWith('/owner/bookings/b-1');

    apiClient.post.mockResolvedValue({ success: true });
    await ownerService.completeBooking('b-1', 'Đã phục vụ tốt');
    expect(apiClient.post).toHaveBeenCalledWith('/owner/bookings/b-1/complete', {
      note: 'Đã phục vụ tốt',
    });

    apiClient.post.mockResolvedValue({ success: true });
    await ownerService.markNoShowBooking('b-1', 'Không đến');
    expect(apiClient.post).toHaveBeenCalledWith('/owner/bookings/b-1/no-show', {
      reason: 'Không đến',
    });

    apiClient.post.mockResolvedValue({ success: true });
    await ownerService.cancelBookingRequest('br-1', 'Khách đổi ý');
    expect(apiClient.post).toHaveBeenCalledWith('/owner/booking-requests/br-1/cancel', {
      reason: 'Khách đổi ý',
    });
  });

  // On-behalf
  it('calls createOnBehalfBooking', async () => {
    apiClient.post.mockResolvedValue({ success: true, data: {} });
    const payload = {
      courtId: 'c-1',
      bookingDate: '2026-11-01',
      configVersion: 1,
      selectedSlots: [{ startTime: '08:00', endTime: '09:00' }],
      customerName: 'Anh Bình',
      customerPhone: '0901234567',
    };
    await ownerService.createOnBehalfBooking(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/owner/bookings/on-behalf', payload);
  });
});

