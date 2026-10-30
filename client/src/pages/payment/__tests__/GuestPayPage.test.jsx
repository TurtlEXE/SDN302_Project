import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GuestPayPage } from '../GuestPayPage.jsx';
import { paymentService } from '../../../services/payment.service.js';

vi.mock('../../../services/payment.service.js', () => ({
  paymentService: {
    getGuestPaymentOrder: vi.fn(),
  },
}));

describe('GuestPayPage Component (Issue 5 & P19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders order details with non-zero totalAmountVnd and multiple disjoint intervals', async () => {
    paymentService.getGuestPaymentOrder.mockResolvedValueOnce({
      success: true,
      data: {
        paymentOrderId: 'order-123',
        requestNumber: 'REQ-20261031-0001',
        contactName: 'Nguyễn Văn Khách',
        contactPhone: '0912345678',
        facilityName: 'CLB Cầu Lông Mặt Trời',
        courtName: 'Sân 1',
        bookingDate: '2026-10-31',
        totalAmountVnd: 240000,
        status: 'PENDING',
        paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Token=abc',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        intervals: [
          { startTime: '06:00', endTime: '07:00', durationMinutes: 60, totalPriceVnd: 120000 },
          { startTime: '08:00', endTime: '09:00', durationMinutes: 60, totalPriceVnd: 120000 },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={['/guest-pay/order-123?code=secretCode123']}>
        <Routes>
          <Route path="/guest-pay/:paymentOrderId" element={<GuestPayPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Thanh toán đơn #REQ-20261031-0001/i)).toBeInTheDocument();
    });

    // Customer name & phone
    expect(screen.getByText(/Nguyễn Văn Khách \(0912345678\)/i)).toBeInTheDocument();

    // Sân & Cơ sở
    expect(screen.getByText(/Sân 1 - CLB Cầu Lông Mặt Trời/i)).toBeInTheDocument();

    // Total amount must NOT be 0đ
    const totalEl = screen.getByTestId('guest-pay-total-amount');
    expect(totalEl).toHaveTextContent(/240\.000/);
    expect(totalEl).not.toHaveTextContent(/^0\s*₫$/);

    // Disjoint intervals rendered separately
    const intervalsContainer = screen.getByTestId('guest-pay-intervals');
    expect(intervalsContainer).toBeInTheDocument();
    expect(screen.getByText('06:00 - 07:00')).toBeInTheDocument();
    expect(screen.getByText('08:00 - 09:00')).toBeInTheDocument();

    // VNPay button
    const payBtn = screen.getByRole('link', { name: /Thanh toán ngay bằng VNPay/i });
    expect(payBtn).toHaveAttribute(
      'href',
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Token=abc'
    );
  });

  it('renders PAID status when order is already paid', async () => {
    paymentService.getGuestPaymentOrder.mockResolvedValueOnce({
      success: true,
      data: {
        paymentOrderId: 'order-paid-999',
        requestNumber: 'REQ-20261031-0099',
        contactName: 'Trần Thị Khách',
        contactPhone: '0988776655',
        facilityName: 'CLB Bóng Đá Ngôi Sao',
        courtName: 'Sân 2',
        bookingDate: '2026-10-31',
        totalAmountVnd: 150000,
        status: 'PAID',
        paymentUrl: '',
        expiresAt: new Date().toISOString(),
        intervals: [{ startTime: '17:00', endTime: '18:00', durationMinutes: 60, totalPriceVnd: 150000 }],
      },
    });

    render(
      <MemoryRouter initialEntries={['/guest-pay/order-paid-999?code=secretCode123']}>
        <Routes>
          <Route path="/guest-pay/:paymentOrderId" element={<GuestPayPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/✓ ĐÃ THANH TOÁN/i)).toBeInTheDocument();
      expect(screen.getByText(/Đơn đặt sân đã được thanh toán thành công!/i)).toBeInTheDocument();
    });
  });
});

