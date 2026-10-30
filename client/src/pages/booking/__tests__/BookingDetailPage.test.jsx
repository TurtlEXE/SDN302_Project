import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BookingDetailPage } from '../BookingDetailPage.jsx';
import { bookingService } from '../../../services/booking.service.js';
import { paymentService } from '../../../services/payment.service.js';

vi.mock('../../../services/booking.service.js', () => ({
  bookingService: {
    getBookingById: vi.fn(),
    cancelBookingRequest: vi.fn(),
  },
}));

vi.mock('../../../services/payment.service.js', () => ({
  paymentService: {
    createPaymentUrl: vi.fn(),
  },
}));

describe('BookingDetailPage Component (P17)', () => {
  const mockBooking = {
    id: 'b-detail-1',
    bookingCode: 'BK-20261101-999',
    bookingRequestId: 'req-999',
    facilityName: 'Sân bóng Mỹ Đình',
    courtName: 'Sân 1',
    facilityAddress: 'Lê Đức Thọ, Hà Nội',
    bookingDate: '2026-11-01',
    startTime: '08:00',
    endTime: '09:30',
    durationMinutes: 90,
    pricePerHourVnd: 200000,
    totalPriceVnd: 300000,
    status: 'PENDING_PAYMENT',
    paymentStatus: 'UNPAID',
    holdExpiresAt: new Date(Date.now() + 600000).toISOString(),
    paymentOrder: {
      id: 'po-1',
      vnpayTxnRef: 'TXN-999',
      expectedAmountVnd: 300000,
      status: 'PENDING',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders booking detail card and pending payment action buttons', async () => {
    bookingService.getBookingById.mockResolvedValue({
      success: true,
      data: mockBooking,
    });

    render(
      <MemoryRouter initialEntries={['/my-bookings/b-detail-1']}>
        <Routes>
          <Route path="/my-bookings/:id" element={<BookingDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial loading
    expect(screen.getByText(/Đang tải thông tin/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('booking-detail-card')).toBeInTheDocument();
      expect(screen.getByText('BK-20261101-999')).toBeInTheDocument();
      expect(screen.getByText('Sân 1 — Sân bóng Mỹ Đình')).toBeInTheDocument();
      expect(screen.getByText('TXN-999')).toBeInTheDocument();
      expect(screen.getByTestId('btn-continue-vnpay')).toBeInTheDocument();
      expect(screen.getByTestId('btn-cancel-booking')).toBeInTheDocument();
    });
  });

  it('handles 404 error gracefully', async () => {
    bookingService.getBookingById.mockRejectedValue(new Error('Không tìm thấy đơn'));

    render(
      <MemoryRouter initialEntries={['/my-bookings/non-existent']}>
        <Routes>
          <Route path="/my-bookings/:id" element={<BookingDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy đơn đặt sân')).toBeInTheDocument();
    });
  });
});

