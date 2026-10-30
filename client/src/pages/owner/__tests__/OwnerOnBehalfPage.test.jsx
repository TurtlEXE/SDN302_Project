import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OwnerOnBehalfPage } from '../OwnerOnBehalfPage.jsx';
import { ownerService } from '../../../services/owner.service.js';
import { courtService } from '../../../services/court.service.js';

vi.mock('../../../services/owner.service.js', () => ({
  ownerService: {
    listFacilities: vi.fn(),
    listCourts: vi.fn(),
    createOnBehalfBooking: vi.fn(),
  },
}));

vi.mock('../../../services/court.service.js', () => ({
  courtService: {
    getCourtSchedule: vi.fn(),
  },
}));

describe('OwnerOnBehalfPage Component (P18)', () => {
  const mockFacilities = [
    { _id: 'f-1', name: 'CLB Sao Vàng' },
  ];

  const mockCourts = [
    { _id: 'c-1', name: 'Sân 1', pricePerHourVnd: 200000, isActive: true },
  ];

  const mockSchedule = {
    courtId: 'c-1',
    date: '2026-11-01',
    slotStepMinutes: 60,
    configVersion: 1,
    slots: [
      { startTime: '08:00', endTime: '09:00', status: 'AVAILABLE' },
      { startTime: '09:00', endTime: '10:00', status: 'AVAILABLE' },
    ],
  };

  const mockOnBehalfResult = {
    bookingRequestId: 'br-123',
    requestNumber: 'REQ-20261101-001',
    totalAmountVnd: 200000,
    holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    paymentOrder: {
      paymentOrderId: 'po-123',
      vnpayTxnRef: 'TXN-999',
      amountVnd: 200000,
      paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?order=123',
    },
    guestAccessLink: '/guest-pay/po-123?code=secret_code_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form, schedule slots, and 100% VNPay policy warning', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    courtService.getCourtSchedule.mockResolvedValue({
      data: mockSchedule,
    });

    render(
      <BrowserRouter>
        <OwnerOnBehalfPage />
      </BrowserRouter>
    );

    // Header & notice
    expect(
      screen.getByText('Đặt sân hộ khách vãng lai (Tại quầy / Qua điện thoại)')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Bắt buộc thanh toán qua VNPay:/)
    ).toBeInTheDocument();

    // Form inputs
    expect(screen.getByPlaceholderText(/Nguyễn Văn A/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/0912345678/i)).toBeInTheDocument();

    // Schedule slots
    await waitFor(() => {
      expect(screen.getByText('08:00')).toBeInTheDocument();
      const nineOclockElements = screen.getAllByText('09:00');
      expect(nineOclockElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('submits on-behalf booking and renders 10-minute hold expiration and VNPay link', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    courtService.getCourtSchedule.mockResolvedValue({
      data: mockSchedule,
    });
    ownerService.createOnBehalfBooking.mockResolvedValue({
      data: mockOnBehalfResult,
    });

    render(
      <BrowserRouter>
        <OwnerOnBehalfPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('08:00')).toBeInTheDocument();
    });

    // Select slot 08:00
    fireEvent.click(screen.getByText('08:00'));

    // Fill customer info
    const nameInput = screen.getByPlaceholderText(/Nguyễn Văn A/i);
    fireEvent.change(nameInput, { target: { value: 'Lê Hoàng Nam' } });

    const phoneInput = screen.getByPlaceholderText(/0912345678/i);
    fireEvent.change(phoneInput, { target: { value: '0988112233' } });

    // Click submit
    const submitBtn = screen.getByRole('button', {
      name: /Tạo đơn đặt hộ & Giữ chỗ 10 phút/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ownerService.createOnBehalfBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          courtId: 'c-1',
          customerName: 'Lê Hoàng Nam',
          customerPhone: '0988112233',
          selectedSlots: [{ startTime: '08:00', endTime: '09:00' }],
        })
      );
    });

    // Success card appears
    await waitFor(() => {
      expect(
        screen.getByText(/Tạo đơn đặt hộ thành công - Đang giữ chỗ 10 phút/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Đơn đặt: #REQ-20261101-001/)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Mở cổng thanh toán VNPay ngay/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Sao chép link/i)).toBeInTheDocument();
    });
  });
});
