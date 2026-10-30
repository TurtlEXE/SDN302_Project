import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaymentResultPage } from '../PaymentResultPage.jsx';
import { paymentService } from '../../../services/payment.service.js';

vi.mock('../../../services/payment.service.js', () => ({
  paymentService: {
    processVNPayReturn: vi.fn(),
    getPaymentOrderByBookingRequestId: vi.fn(),
  },
}));

describe('PaymentResultPage Component (P17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders success card when server verifies CONFIRMED status', async () => {
    paymentService.processVNPayReturn.mockResolvedValue({
      success: true,
      data: {
        status: 'CONFIRMED',
        bookingRequestId: 'req-confirmed-1',
        amountVnd: 500000,
        message: 'Thanh toán thành công.',
      },
    });

    render(
      <MemoryRouter initialEntries={['/payment/result?vnp_ResponseCode=00&vnp_TxnRef=ref123']}>
        <PaymentResultPage />
      </MemoryRouter>
    );

    // Initial loading
    expect(screen.getByText(/Đang xác minh giao dịch/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('payment-success-card')).toBeInTheDocument();
      expect(screen.getByText('Đặt sân thành công!')).toBeInTheDocument();
      expect(screen.getByText('500.000 ₫')).toBeInTheDocument();
      expect(screen.getByTestId('btn-view-my-bookings')).toBeInTheDocument();
    });
  });

  it('renders review card when server returns REVIEW status', async () => {
    paymentService.processVNPayReturn.mockResolvedValue({
      success: true,
      data: {
        status: 'REVIEW',
        bookingRequestId: 'req-review-1',
        message: 'Giao dịch cần hỗ trợ xác minh.',
      },
    });

    render(
      <MemoryRouter initialEntries={['/payment/result?vnp_ResponseCode=99&vnp_TxnRef=ref123']}>
        <PaymentResultPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-review-card')).toBeInTheDocument();
      expect(screen.getByText('Giao dịch cần hỗ trợ xác minh')).toBeInTheDocument();
    });
  });

  it('renders failed card when payment fails or is rejected', async () => {
    paymentService.processVNPayReturn.mockResolvedValue({
      success: false,
      data: {
        status: 'FAILED',
        message: 'Khách hàng hủy giao dịch tại cổng thanh toán.',
      },
    });

    render(
      <MemoryRouter initialEntries={['/payment/result?vnp_ResponseCode=24&vnp_TxnRef=ref123']}>
        <PaymentResultPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-failed-card')).toBeInTheDocument();
      expect(screen.getByText('Giao dịch chưa hoàn tất')).toBeInTheDocument();
      expect(screen.getByTestId('btn-rebook')).toBeInTheDocument();
    });
  });
});

