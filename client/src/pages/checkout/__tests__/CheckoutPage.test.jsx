import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CheckoutPage } from '../CheckoutPage.jsx';
import { bookingService } from '../../../services/booking.service.js';

// Mock useAuth
vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      fullName: 'Nguyễn Văn Nam',
      phoneNumber: '0912345678',
      email: 'nam@example.com',
    },
    isAuthenticated: true,
    loading: false,
  }),
}));

vi.mock('../../../services/booking.service.js', () => ({
  bookingService: {
    createBookingRequest: vi.fn(),
    cancelBookingRequest: vi.fn(),
  },
}));

describe('CheckoutPage Component (P17)', () => {
  const mockDraft = {
    facilityId: 'fac-1',
    facilityName: 'CLB Sao Vàng',
    courtId: 'court-1',
    courtName: 'Sân bóng đá 1',
    bookingDate: '2026-11-01',
    pricePerHourVnd: 200000,
    ranges: [
      { startTime: '07:00', endTime: '08:30', durationMinutes: 90, priceVnd: 300000 },
      { startTime: '17:00', endTime: '18:00', durationMinutes: 60, priceVnd: 200000 },
    ],
    totalDurationMinutes: 150,
    totalPriceVnd: 500000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders empty notice when no draft exists in sessionStorage', () => {
    render(
      <BrowserRouter>
        <CheckoutPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Chưa có thông tin đặt sân')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /khám phá danh sách sân/i })).toBeInTheDocument();
  });

  it('renders order breakdown, auto-filled contact info and submits booking', async () => {
    sessionStorage.setItem('sport_booking_draft', JSON.stringify(mockDraft));

    bookingService.createBookingRequest.mockResolvedValue({
      success: true,
      data: {
        bookingRequestId: 'req-123',
        requestNumber: 'REQ-20261101-001',
        totalAmountVnd: 500000,
        holdExpiresAt: new Date(Date.now() + 600000).toISOString(),
        paymentOrder: {
          paymentOrderId: 'p-123',
          paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1',
        },
      },
    });

    render(
      <BrowserRouter>
        <CheckoutPage />
      </BrowserRouter>
    );

    // Order info visible
    expect(screen.getAllByText('CLB Sao Vàng').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sân bóng đá 1')).toBeInTheDocument();
    expect(screen.getByText('2026-11-01')).toBeInTheDocument();

    // Both disjoint ranges displayed
    expect(screen.getByTestId('checkout-range-0')).toHaveTextContent('07:00 - 08:30');
    expect(screen.getByTestId('checkout-range-1')).toHaveTextContent('17:00 - 18:00');

    // Total price
    expect(screen.getByTestId('checkout-total-price')).toHaveTextContent('500.000');

    // Auto-filled contact info
    expect(screen.getByTestId('input-contact-name')).toHaveValue('Nguyễn Văn Nam');
    expect(screen.getByTestId('input-contact-phone')).toHaveValue('0912345678');

    // Click submit
    const submitBtn = screen.getByTestId('btn-submit-booking');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(bookingService.createBookingRequest).toHaveBeenCalledTimes(1);
    });

    expect(bookingService.createBookingRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        courtId: 'court-1',
        bookingDate: '2026-11-01',
        contactName: 'Nguyễn Văn Nam',
        contactPhone: '0912345678',
        selectedSlots: [
          { startTime: '07:00', endTime: '08:30' },
          { startTime: '17:00', endTime: '18:00' },
        ],
        idempotencyKey: expect.stringMatching(/^idemp_/),
      })
    );
  });

  it('displays error message when booking creation fails', async () => {
    sessionStorage.setItem('sport_booking_draft', JSON.stringify(mockDraft));

    bookingService.createBookingRequest.mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Khung giờ này vừa có người giữ chỗ. Vui lòng chọn khung giờ khác.',
          },
        },
      },
    });

    render(
      <BrowserRouter>
        <CheckoutPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByTestId('btn-submit-booking'));

    await waitFor(() => {
      expect(
        screen.getByText('Khung giờ này vừa có người giữ chỗ. Vui lòng chọn khung giờ khác.')
      ).toBeInTheDocument();
    });
  });
});
