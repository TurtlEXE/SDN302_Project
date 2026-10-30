import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OwnerBookingsPage } from '../OwnerBookingsPage.jsx';
import { ownerService } from '../../../services/owner.service.js';

vi.mock('../../../services/owner.service.js', () => ({
  ownerService: {
    listFacilities: vi.fn(),
    listCourts: vi.fn(),
    listBookings: vi.fn(),
    completeBooking: vi.fn(),
    markNoShowBooking: vi.fn(),
    cancelBookingRequest: vi.fn(),
  },
}));

describe('OwnerBookingsPage Component (P18)', () => {
  const mockFacilities = [
    { _id: 'f-1', name: 'CLB Sao Vàng' },
  ];

  const mockCourts = [
    { _id: 'c-1', name: 'Sân 1', facilityId: 'f-1' },
  ];

  const mockBookings = [
    {
      id: 'b-1',
      bookingCode: 'BK-20261101-001',
      facilityId: 'f-1',
      courtId: 'c-1',
      facilityName: 'CLB Sao Vàng',
      courtName: 'Sân 1',
      sportName: 'Bóng đá',
      bookingDate: '2026-11-01',
      startTime: '08:00',
      endTime: '09:00',
      durationMinutes: 60,
      totalPriceVnd: 200000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      contactName: 'Nguyễn Văn Minh',
      contactPhone: '0912345678',
    },
    {
      id: 'b-2',
      bookingCode: 'BK-20261101-002',
      bookingRequestId: 'br-2',
      facilityId: 'f-1',
      courtId: 'c-1',
      facilityName: 'CLB Sao Vàng',
      courtName: 'Sân 1',
      sportName: 'Bóng đá',
      bookingDate: '2026-11-01',
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
      totalPriceVnd: 200000,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      contactName: 'Trần Văn Cường',
      contactPhone: '0987654321',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bookings list, customer contact, and 100% VNPay policy warning', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    ownerService.listBookings.mockResolvedValue({
      data: mockBookings,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    render(
      <BrowserRouter>
        <OwnerBookingsPage />
      </BrowserRouter>
    );

    // Header & VNPay policy notice
    expect(screen.getByText('Quản lý đơn đặt sân & Vận hành')).toBeInTheDocument();
    expect(
      screen.getByText(/Quy chuẩn tài chính 100% VNPay:/)
    ).toBeInTheDocument();

    // Table rows
    await waitFor(() => {
      expect(screen.getByText('BK-20261101-001')).toBeInTheDocument();
      expect(screen.getByText('Nguyễn Văn Minh')).toBeInTheDocument();
      expect(screen.getByText('0912345678')).toBeInTheDocument();
      expect(screen.getByText('BK-20261101-002')).toBeInTheDocument();
    });

    // Action buttons
    expect(screen.getByRole('button', { name: /Hoàn tất/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /No-show/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hủy giữ chỗ/i })).toBeInTheDocument();
  });

  it('opens modal and completes confirmed booking', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    ownerService.listBookings.mockResolvedValue({
      data: mockBookings,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    ownerService.completeBooking.mockResolvedValue({ success: true });

    render(
      <BrowserRouter>
        <OwnerBookingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('BK-20261101-001')).toBeInTheDocument();
    });

    // Click "Hoàn tất"
    const completeBtn = screen.getByRole('button', { name: /Hoàn tất/i });
    fireEvent.click(completeBtn);

    // Modal opens
    expect(screen.getByText('Xác nhận hoàn tất phục vụ')).toBeInTheDocument();

    // Fill note and submit
    const noteInput = screen.getByPlaceholderText(/Ghi chú phục vụ/i);
    fireEvent.change(noteInput, { target: { value: 'Khách đá đủ 60 phút' } });

    const confirmBtn = screen.getByRole('button', { name: /Xác nhận thực hiện/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(ownerService.completeBooking).toHaveBeenCalledWith(
        'b-1',
        'Khách đá đủ 60 phút'
      );
    });
  });

  it('cancels pending payment booking request', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    ownerService.listBookings.mockResolvedValue({
      data: mockBookings,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    ownerService.cancelBookingRequest.mockResolvedValue({ success: true });

    render(
      <BrowserRouter>
        <OwnerBookingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('BK-20261101-002')).toBeInTheDocument();
    });

    // Click "Hủy giữ chỗ"
    const cancelBtn = screen.getByRole('button', { name: /Hủy giữ chỗ/i });
    fireEvent.click(cancelBtn);

    // Modal opens
    expect(screen.getByText('Xác nhận hủy giữ chỗ')).toBeInTheDocument();

    // Fill reason and submit
    const reasonInput = screen.getByPlaceholderText(/Lý do hủy giữ chỗ/i);
    fireEvent.change(reasonInput, { target: { value: 'Khách báo hủy qua điện thoại' } });

    const confirmBtn = screen.getByRole('button', { name: /Xác nhận thực hiện/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(ownerService.cancelBookingRequest).toHaveBeenCalledWith(
        'br-2',
        'Khách báo hủy qua điện thoại'
      );
    });
  });
});

