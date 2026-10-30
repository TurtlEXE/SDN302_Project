import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MyBookingsPage } from '../MyBookingsPage.jsx';
import { bookingService } from '../../../services/booking.service.js';

vi.mock('../../../services/booking.service.js', () => ({
  bookingService: {
    getMyBookings: vi.fn(),
  },
}));

describe('MyBookingsPage Component (P17)', () => {
  const mockBookings = [
    {
      id: 'b-1',
      bookingCode: 'BK-20261101-001',
      facilityName: 'CLB Sao Vàng',
      courtName: 'Sân bóng đá 1',
      sportName: 'Bóng đá',
      facilityAddress: '123 Cầu Giấy',
      bookingDate: '2026-11-01',
      startTime: '07:00',
      endTime: '08:30',
      durationMinutes: 90,
      totalPriceVnd: 300000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    },
    {
      id: 'b-2',
      bookingCode: 'BK-20261101-002',
      facilityName: 'CLB Sao Vàng',
      courtName: 'Sân bóng đá 1',
      sportName: 'Bóng đá',
      facilityAddress: '123 Cầu Giấy',
      bookingDate: '2026-11-01',
      startTime: '17:00',
      endTime: '18:00',
      durationMinutes: 60,
      totalPriceVnd: 200000,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders booking cards with correct status and payment badges', async () => {
    bookingService.getMyBookings.mockResolvedValue({
      success: true,
      data: mockBookings,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    render(
      <BrowserRouter>
        <MyBookingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('booking-card-b-1')).toBeInTheDocument();
      expect(screen.getByTestId('booking-card-b-2')).toBeInTheDocument();
    });

    expect(screen.getByText('BK-20261101-001')).toBeInTheDocument();
    expect(screen.getByText('Đã xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Chờ thanh toán')).toBeInTheDocument();
    expect(screen.getByText('300.000 ₫')).toBeInTheDocument();
  });

  it('filters by tab when clicked', async () => {
    bookingService.getMyBookings.mockResolvedValue({
      success: true,
      data: [mockBookings[0]],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    render(
      <BrowserRouter>
        <MyBookingsPage />
      </BrowserRouter>
    );

    const upcomingTab = screen.getByTestId('tab-upcoming');
    fireEvent.click(upcomingTab);

    await waitFor(() => {
      expect(bookingService.getMyBookings).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'UPCOMING' })
      );
    });
  });

  it('renders empty state when no bookings exist', async () => {
    bookingService.getMyBookings.mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    render(
      <BrowserRouter>
        <MyBookingsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Chưa có đơn đặt sân nào')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /khám phá sân thể thao/i })).toBeInTheDocument();
    });
  });
});

