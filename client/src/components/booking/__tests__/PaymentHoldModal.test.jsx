import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentHoldModal } from '../PaymentHoldModal.jsx';

describe('PaymentHoldModal Component (P17)', () => {
  it('renders countdown timer, order details and proceed/cancel buttons', () => {
    const onCancel = vi.fn();
    const futureDate = new Date(Date.now() + 300000).toISOString(); // 5 minutes left

    render(
      <PaymentHoldModal
        isOpen={true}
        holdExpiresAt={futureDate}
        paymentUrl="https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1"
        bookingRequestId="req-1"
        requestNumber="REQ-20261101-001"
        totalAmountVnd={300000}
        onCancel={onCancel}
        onExpire={vi.fn()}
      />
    );

    expect(screen.getByTestId('payment-hold-modal')).toBeInTheDocument();
    expect(screen.getByText('Đang giữ chỗ cho bạn')).toBeInTheDocument();
    expect(screen.getByText('REQ-20261101-001')).toBeInTheDocument();
    expect(screen.getByText('300.000 ₫')).toBeInTheDocument();

    const cancelBtn = screen.getByTestId('btn-modal-cancel');
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders expired state when holdExpiresAt is in the past', () => {
    const pastDate = new Date(Date.now() - 5000).toISOString();

    render(
      <PaymentHoldModal
        isOpen={true}
        holdExpiresAt={pastDate}
        paymentUrl="https://example.com"
        bookingRequestId="req-1"
        requestNumber="REQ-1"
        totalAmountVnd={100000}
        onCancel={vi.fn()}
        onExpire={vi.fn()}
      />
    );

    expect(screen.getByText('Hết thời gian giữ chỗ')).toBeInTheDocument();
    expect(screen.getByText(/00:00 — Hết hạn giữ chỗ/i)).toBeInTheDocument();
    expect(screen.queryByTestId('btn-modal-vnpay')).not.toBeInTheDocument();
  });
});

