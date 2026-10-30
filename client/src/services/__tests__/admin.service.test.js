import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from '../admin.service.js';
import { apiClient } from '../api-client.js';

vi.mock('../api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('adminService (P19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Dashboard
  it('calls getDashboard with query params', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await adminService.getDashboard({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/dashboard?startDate=2026-10-01&endDate=2026-10-31');
  });

  // User Management
  it('calls listUsers with filters', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: { items: [], pagination: {} } });
    await adminService.listUsers({ role: 'OWNER', keyword: 'Nguyen' });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/users?role=OWNER&keyword=Nguyen');
  });

  it('calls getUserById', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await adminService.getUserById('u-1');
    expect(apiClient.get).toHaveBeenCalledWith('/admin/users/u-1');
  });

  it('calls provisionOwner with data', async () => {
    apiClient.post.mockResolvedValue({ success: true, message: 'OK' });
    const payload = { fullName: 'Tran Van B', email: 'owner@example.com', phoneNumber: '0901234567' };
    await adminService.provisionOwner(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/users/owners', payload);
  });

  it('calls updateUser with allowed fields', async () => {
    apiClient.patch.mockResolvedValue({ success: true, data: {} });
    await adminService.updateUser('u-1', { fullName: 'New Name', phoneNumber: '0988776655' });
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/users/u-1', { fullName: 'New Name', phoneNumber: '0988776655' });
  });

  it('calls resendOwnerInvitation', async () => {
    apiClient.post.mockResolvedValue({ success: true, message: 'OK' });
    await adminService.resendOwnerInvitation('u-1');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/users/u-1/resend-invitation');
  });

  it('calls lockUser with mandatory reason', async () => {
    apiClient.patch.mockResolvedValue({ success: true, message: 'OK' });
    await adminService.lockUser('u-1', 'Vi phạm điều khoản');
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/users/u-1/lock', { reason: 'Vi phạm điều khoản' });
  });

  it('calls unlockUser with reason', async () => {
    apiClient.patch.mockResolvedValue({ success: true, message: 'OK' });
    await adminService.unlockUser('u-1', 'Đã xác minh lại');
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/users/u-1/unlock', { reason: 'Đã xác minh lại' });
  });

  it('calls resetPassword', async () => {
    apiClient.post.mockResolvedValue({ success: true, message: 'OK' });
    await adminService.resetPassword('u-1');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/users/u-1/reset-password');
  });

  it('calls listActionLogs', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: { items: [], pagination: {} } });
    await adminService.listActionLogs({ page: 1, limit: 10 });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/action-logs?page=1&limit=10');
  });

  // Sport Catalog
  it('calls listSports', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: { items: [] } });
    await adminService.listSports({ keyword: 'Bong da' });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/sports?keyword=Bong+da');
  });

  it('calls getSportById', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await adminService.getSportById('s-1');
    expect(apiClient.get).toHaveBeenCalledWith('/admin/sports/s-1');
  });

  it('calls createSport', async () => {
    apiClient.post.mockResolvedValue({ success: true, data: {} });
    await adminService.createSport({ name: 'Pickleball', description: 'Mon moi' });
    expect(apiClient.post).toHaveBeenCalledWith('/admin/sports', { name: 'Pickleball', description: 'Mon moi' });
  });

  it('calls updateSport', async () => {
    apiClient.patch.mockResolvedValue({ success: true, data: {} });
    await adminService.updateSport('s-1', { name: 'Pickleball Pro', isActive: false });
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/sports/s-1', { name: 'Pickleball Pro', isActive: false });
  });

  it('calls deleteSport', async () => {
    apiClient.delete.mockResolvedValue({ success: true });
    await adminService.deleteSport('s-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/admin/sports/s-1');
  });

  // Refunds & Payment Exceptions
  it('calls listRefundCases', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [], pagination: {} });
    await adminService.listRefundCases({ status: 'PENDING' });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/refunds?status=PENDING');
  });

  it('calls getRefundCaseById', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await adminService.getRefundCaseById('rc-1');
    expect(apiClient.get).toHaveBeenCalledWith('/admin/refunds/rc-1');
  });

  it('calls recordManualRefund with proof details', async () => {
    apiClient.post.mockResolvedValue({ success: true });
    await adminService.recordManualRefund('rc-1', { proofReference: 'VNPAY-REF-999', proofImageUrl: 'https://img.com/p.png' });
    expect(apiClient.post).toHaveBeenCalledWith('/admin/refunds/rc-1/record-manual-refund', {
      proofReference: 'VNPAY-REF-999',
      proofImageUrl: 'https://img.com/p.png',
    });
  });

  it('calls createExceptionRefund', async () => {
    apiClient.post.mockResolvedValue({ success: true });
    await adminService.createExceptionRefund({ paymentTransactionId: 'txn-1', reason: 'Thanh toan tre' });
    expect(apiClient.post).toHaveBeenCalledWith('/admin/refunds/exception-refund', {
      paymentTransactionId: 'txn-1',
      reason: 'Thanh toan tre',
    });
  });

  it('calls listPaymentTransactions', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [], pagination: {} });
    await adminService.listPaymentTransactions({ hasException: 'true' });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/payment-transactions?hasException=true');
  });

  it('calls cancelAndRefundBooking', async () => {
    apiClient.post.mockResolvedValue({ success: true });
    await adminService.cancelAndRefundBooking('b-1', 'Sân bị ngập nước');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/bookings/b-1/cancel-and-refund', {
      reason: 'Sân bị ngập nước',
    });
  });

  // Email Outbox
  it('calls listEmailOutbox', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [], pagination: {} });
    await adminService.listEmailOutbox({ status: 'FAILED' });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/email-outbox?status=FAILED');
  });

  it('calls retryEmail', async () => {
    apiClient.post.mockResolvedValue({ success: true });
    await adminService.retryEmail('em-1');
    expect(apiClient.post).toHaveBeenCalledWith('/admin/email-outbox/em-1/retry');
  });

  // Facility & Bookings Oversight
  it('calls listFacilities', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [] });
    await adminService.listFacilities();
    expect(apiClient.get).toHaveBeenCalledWith('/admin/facilities');
  });

  it('calls lockFacility', async () => {
    apiClient.patch.mockResolvedValue({ success: true });
    await adminService.lockFacility('f-1', 'Vi phạm pháp lý');
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/facilities/f-1/lock', { reason: 'Vi phạm pháp lý' });
  });

  it('calls unlockFacility', async () => {
    apiClient.patch.mockResolvedValue({ success: true });
    await adminService.unlockFacility('f-1');
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/facilities/f-1/unlock');
  });

  it('calls listAdminBookings', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: [], pagination: {} });
    await adminService.listAdminBookings({ bookingCode: 'BK123' });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/bookings?bookingCode=BK123');
  });

  it('calls getAdminBookingById', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await adminService.getAdminBookingById('b-1');
    expect(apiClient.get).toHaveBeenCalledWith('/admin/bookings/b-1');
  });
});

