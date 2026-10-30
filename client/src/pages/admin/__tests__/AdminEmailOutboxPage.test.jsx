import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminEmailOutboxPage } from '../AdminEmailOutboxPage.jsx';
import { adminService } from '../../../services/admin.service.js';

vi.mock('../../../services/admin.service.js', () => ({
  adminService: {
    listEmailOutbox: vi.fn(),
    retryEmail: vi.fn(),
  },
}));

describe('AdminEmailOutboxPage Component (P19)', () => {
  const mockMessages = [
    {
      _id: 'em-1',
      id: 'em-1',
      eventKey: 'ACTIVATE_OWNER:u-123:1730300000',
      eventType: 'ACTIVATE_OWNER',
      recipientEmail: 'owner@clbsaovang.com',
      recipientName: 'Trần Văn Chủ Sân',
      subject: '[SportBooking] Kích hoạt tài khoản Chủ sân và thiết lập mật khẩu',
      status: 'FAILED',
      attempts: 3,
      maxAttempts: 3,
      lastError: 'SMTP connect timeout',
      lastAttemptAt: '2026-10-31T01:10:00Z',
    },
    {
      _id: 'em-2',
      id: 'em-2',
      eventKey: 'BOOKING_CONFIRMED:b-99:1730301111',
      eventType: 'BOOKING_CONFIRMED',
      recipientEmail: 'customer@gmail.com',
      recipientName: 'Lê Văn Khách',
      subject: '[SportBooking] Xác nhận đặt sân thành công',
      status: 'SENT',
      attempts: 1,
      maxAttempts: 3,
      lastError: null,
      lastAttemptAt: '2026-10-31T01:15:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('renders outbox messages with status badges and retry buttons', async () => {
    adminService.listEmailOutbox.mockResolvedValue({
      success: true,
      data: mockMessages,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    render(
      <BrowserRouter>
        <AdminEmailOutboxPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Hộp thư Email Outbox & Giám sát Lỗi/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ACTIVATE_OWNER')).toBeInTheDocument();
      expect(screen.getByText('Trần Văn Chủ Sân')).toBeInTheDocument();
      expect(screen.getByText('owner@clbsaovang.com')).toBeInTheDocument();
      expect(screen.getByText('Thất bại')).toBeInTheDocument();
      expect(screen.getByText('Đã gửi')).toBeInTheDocument();
      expect(screen.getByText('Gửi lại')).toBeInTheDocument();
    });
  });

  it('retries single failed email and triggers retryEmail API', async () => {
    adminService.listEmailOutbox.mockResolvedValue({
      success: true,
      data: mockMessages,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    adminService.retryEmail.mockResolvedValue({
      success: true,
      message: 'Đã kích hoạt thử lại gửi email thành công.',
    });

    render(
      <BrowserRouter>
        <AdminEmailOutboxPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Gửi lại')).toBeInTheDocument());

    const retryBtn = screen.getByText('Gửi lại');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(adminService.retryEmail).toHaveBeenCalledWith('em-1');
    });
  });

  it('opens detail modal and displays safe event info without exposing tokens', async () => {
    adminService.listEmailOutbox.mockResolvedValue({
      success: true,
      data: mockMessages,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    render(
      <BrowserRouter>
        <AdminEmailOutboxPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('ACTIVATE_OWNER')).toBeInTheDocument());

    const viewBtns = screen.getAllByTitle('Xem chi tiết sự kiện');
    fireEvent.click(viewBtns[0]);

    expect(screen.getByText('Chi tiết Email Outbox')).toBeInTheDocument();
    expect(screen.getAllByText('ACTIVATE_OWNER:u-123:1730300000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SMTP connect timeout').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Bảo mật danh tính/i)).toBeInTheDocument();
  });
});
