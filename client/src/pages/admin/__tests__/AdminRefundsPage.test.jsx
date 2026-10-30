import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminRefundsPage } from '../AdminRefundsPage.jsx';
import { adminService } from '../../../services/admin.service.js';

vi.mock('../../../services/admin.service.js', () => ({
  adminService: {
    listRefundCases: vi.fn(),
    recordManualRefund: vi.fn(),
    cancelAndRefundBooking: vi.fn(),
    listPaymentTransactions: vi.fn(),
    createExceptionRefund: vi.fn(),
  },
}));

describe('AdminRefundsPage Component (P19)', () => {
  const mockRefundCases = [
    {
      _id: 'rc-1',
      id: 'rc-1',
      refundCaseCode: 'RC-20261031-001',
      bookingCode: 'BK-20261031-100',
      refundAmountVnd: 240000,
      reason: 'Cơ sở ngập nước đột xuất',
      status: 'PENDING',
      proofReference: null,
      proofImageUrl: null,
      createdAt: '2026-10-31T01:00:00Z',
    },
    {
      _id: 'rc-2',
      id: 'rc-2',
      refundCaseCode: 'RC-20261030-002',
      bookingCode: 'BK-20261030-088',
      refundAmountVnd: 180000,
      reason: 'Sự cố mất điện',
      status: 'REFUNDED',
      proofReference: 'VNPAY-REF-998877',
      proofImageUrl: 'https://storage.com/proof.jpg',
      createdAt: '2026-10-30T10:00:00Z',
    },
  ];

  const mockTransactions = [
    {
      _id: 'tx-1',
      id: 'tx-1',
      vnpTxnRef: 'TXN-999901',
      amountVnd: 360000,
      exceptionType: 'LATE_PAYMENT',
      isAccepted: false,
      createdAt: '2026-10-31T00:30:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('renders refund cases list with pending and refunded status', async () => {
    adminService.listRefundCases.mockResolvedValue({
      success: true,
      data: mockRefundCases,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    render(
      <BrowserRouter>
        <AdminRefundsPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Hồ sơ Hoàn tiền & Giao dịch Ngoại lệ/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('RC-20261031-001')).toBeInTheDocument();
      expect(screen.getByText('BK-20261031-100')).toBeInTheDocument();
      expect(screen.getByText('Chờ hoàn tiền')).toBeInTheDocument();
      expect(screen.getByText('Đã hoàn tiền')).toBeInTheDocument();
      expect(screen.getByText('Ghi nhận hoàn thực tế')).toBeInTheDocument();
    });
  });

  it('records manual refund with proofReference', async () => {
    adminService.listRefundCases.mockResolvedValue({
      success: true,
      data: mockRefundCases,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    adminService.recordManualRefund.mockResolvedValue({
      success: true,
      message: 'Ghi nhận hoàn tiền thực tế thành công.',
    });

    render(
      <BrowserRouter>
        <AdminRefundsPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Ghi nhận hoàn thực tế')).toBeInTheDocument());

    const recordBtn = screen.getByText('Ghi nhận hoàn thực tế');
    fireEvent.click(recordBtn);

    expect(screen.getByText('Ghi nhận Hoàn tiền Thực tế')).toBeInTheDocument();

    // Fill proofReference
    const refInput = screen.getByPlaceholderText(/Ví dụ: VNPAY-REF-123456/i);
    fireEvent.change(refInput, { target: { value: 'VNPAY-REF-MANUAL-111' } });

    // Submit
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận Đã Hoàn Tiền/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminService.recordManualRefund).toHaveBeenCalledWith(
        'rc-1',
        expect.objectContaining({
          proofReference: 'VNPAY-REF-MANUAL-111',
        })
      );
    });
  });

  it('cancels a booking and creates refund case through support modal', async () => {
    adminService.listRefundCases.mockResolvedValue({
      success: true,
      data: mockRefundCases,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    adminService.cancelAndRefundBooking.mockResolvedValue({
      success: true,
      message: 'Hủy Booking thành công, đã nhả lịch sân và tạo hồ sơ hoàn tiền.',
    });

    render(
      <BrowserRouter>
        <AdminRefundsPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByTestId('btn-open-cancel-modal')).toBeInTheDocument());

    const openCancelModalBtn = screen.getByTestId('btn-open-cancel-modal');
    fireEvent.click(openCancelModalBtn);

    expect(screen.getByText('Hỗ trợ Hủy & Hoàn Booking')).toBeInTheDocument();

    // Fill booking ID & reason
    fireEvent.change(screen.getByPlaceholderText(/Nhập MongoDB ObjectId của Booking/i), {
      target: { value: 'b-999' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ghi rõ lý do cơ sở không phục vụ/i), {
      target: { value: 'Hỏng dàn đèn chiếu sáng sân 1' },
    });

    const submitBtn = screen.getByRole('button', { name: /Xác nhận Hủy & Tạo Hoàn tiền/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminService.cancelAndRefundBooking).toHaveBeenCalledWith(
        'b-999',
        'Hỏng dàn đèn chiếu sáng sân 1'
      );
    });
  });

  it('switches to payment exceptions tab and creates exception refund', async () => {
    adminService.listRefundCases.mockResolvedValue({
      success: true,
      data: mockRefundCases,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    adminService.listPaymentTransactions.mockResolvedValue({
      success: true,
      data: mockTransactions,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    adminService.createExceptionRefund.mockResolvedValue({
      success: true,
      message: 'Đã tạo hồ sơ hoàn tiền cho giao dịch ngoại lệ thành công.',
    });

    render(
      <BrowserRouter>
        <AdminRefundsPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByTestId('tab-payment-exceptions')).toBeInTheDocument());

    // Switch Tab
    const tabExceptions = screen.getByTestId('tab-payment-exceptions');
    fireEvent.click(tabExceptions);

    await waitFor(() => {
      expect(screen.getByText('TXN-999901')).toBeInTheDocument();
      expect(screen.getByText('LATE_PAYMENT')).toBeInTheDocument();
      expect(screen.getByText('Tạo hoàn ngoại lệ')).toBeInTheDocument();
    });

    // Click "Tạo hoàn ngoại lệ"
    const actionBtn = screen.getByText('Tạo hoàn ngoại lệ');
    fireEvent.click(actionBtn);

    expect(screen.getByText('Tạo Hoàn tiền Ngoại lệ')).toBeInTheDocument();

    const confirmCreateBtn = screen.getByRole('button', { name: /Tạo hồ sơ hoàn tiền/i });
    fireEvent.click(confirmCreateBtn);

    await waitFor(() => {
      expect(adminService.createExceptionRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentTransactionId: 'tx-1',
        })
      );
    });
  });
});

